// Undernite server: static file host + authoritative game simulation over WebSocket.
// Start with:  node server.js   (PORT env var optional, default 8080)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import {
  World, SUITS, SUIT_ORDER, WEAPONS, WEAPON_IDS, RARITY, VEHICLES, VEHICLE_IDS,
  CREATURES, CREATURE_IDS, SURFACE, TICK_HZ, segSphere, creatureR, FINISHER, COMPRESSOR, DEEP, GLOW_CORALS,
  EXP_HP, EXP_BOAT, EXP_RESPAWN, EXP_START_MONEY, REGEN_DELAY, REGEN_RATE, REGEN_RATE_SURFACE, FLOORS, floorAt, FISH, GOLD_CHANCE, GOLD_MUL, BOSSES, BOSS_RESPAWN,
  TANKS, LUNGS, LAMPS, airUse, SHOP_WEAPONS, PLAY, fishValue, AQUARIUM, aqIncome, catchToNet, EXP_LEDGES, EXP_MAX_DEPTH, brReward, BR_UPGRADES, upMul, HEAT, heatStart, suitOwned, GADGETS, gadgetOf, BR_WEAPONS, ATTACHMENTS, modDef, DRAW_TIME, ULTI, ULTIS, eyeHeight, leagueOf, MAP_K, MAP_STUFF, BR_UPGRADES as BR_UPS,
} from './public/js/shared.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(DIR, 'public');
const PORT = +process.env.PORT || 8080;
const SPEED = +process.env.UN_SPEED || 1;     // sim steps per timer tick (testing only)
const DT = 1 / TICK_HZ;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json', '.wav': 'audio/wav', '.txt': 'text/plain; charset=utf-8' };

const server = http.createServer((req, res) => {
  let u;
  try { u = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  if (u === '/') u = '/index.html';
  const f = path.normalize(path.join(PUB, u));
  if (!f.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});
const wss = new WebSocketServer({ server });

// ---------- helpers ----------
const rnd = Math.random;
const r2 = v => Math.round(v * 100) / 100;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
const dist2d = (a, x, z) => Math.sqrt((a.x - x) ** 2 + (a.z - z) ** 2);
const pick = arr => arr[(rnd() * arr.length) | 0];
function lanUrls() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces()))
    for (const i of list || []) if (i.family === 'IPv4' && !i.internal) out.push(`http://${i.address}:${PORT}`);
  return out;
}

const BOT_NAMES = ['Käpt\'n Kiemen', 'Graf Zackenbarsch', 'Tiefsee-Tina', 'Blubber-Bernd', 'Sardinen-Susi', 'Hummer-Hans',
  'Qualle-Kalle', 'Muräne-Mona', 'Seestern-Stefan', 'Krabben-Klaus', 'Plankton-Paula', 'Nautilus-Nils', 'Koralle-Karla',
  'Dorsch-Dieter', 'Rochen-Rita', 'Algen-Achim', 'Barrakuda-Bea', 'Tintenfisch-Tom', 'Seegurken-Sven', 'Anglerfisch-Anna',
  'Makrelen-Max', 'Flossen-Frieda', 'Kugelfisch-Kurt', 'Perlen-Pia'];
const PHASES = [
  { wait: 50, shrink: 45, r: 260, dps: 2 }, { wait: 35, shrink: 32, r: 150, dps: 3 },   // große Karte: erste Ringe größer
  { wait: 30, shrink: 25, r: 70, dps: 5 }, { wait: 25, shrink: 20, r: 32, dps: 7 },
  { wait: 20, shrink: 20, r: 10, dps: 10 }, { wait: 10, shrink: 15, r: 0, dps: 14 },
];
const LOOT_W = [['needler', 30], ['scatter', 22], ['harpoon', 22], ['torpedo', 12], ['pistol', 14], ['revolver', 8], ['spikemg', 8], ['netgun', 6], ['staff', 6], ['trident', 5], ['espear', 4]];   // das Magnet-Gewehr gibt es nicht als Beute (jeder außer Goliath hat es)
const W_SCORE = { pistol: 1, needler: 2.2, scatter: 2.0, harpoon: 2.2, torpedo: 2.6 };
const W_PREF = { pistol: 16, needler: 18, scatter: 8, harpoon: 30, torpedo: 24 };

// ---------- state ----------
const clients = new Map();   // ws -> client
let nextId = 1;
// ---------- Räume: einer pro Liga ----------
// Jeder Raum ist eine eigene Lobby mit eigener Runde und eigener Welt. G ist immer der Raum, an dem der Server gerade arbeitet
// (vor jeder Nachricht und jedem Tick wird G auf den richtigen Raum gestellt). So spielen Anfänger mit Anfängern, Profis mit Profis.
function makeRoom(league) {
  const g = {
    league, phase: 'lobby', mode: 'br', seed: (rnd() * 1e9) | 0, world: null, bots: 11, time: 0,
    players: new Map(), creatures: [], vehicles: new Map(), pickups: new Map(), crates: [], proj: [],
    zone: null, events: [], endT: 0, noHumanT: 0,
    bossT: [], fishT: [],                 // expedition: boss respawn timers, fish spawn timers per floor
  };
  g.world = new World(g.seed, g.mode);
  return g;
}
const rooms = new Map();   // Liga (1–4) -> Raum
const roomFor = (league) => { if (!rooms.has(league)) rooms.set(league, makeRoom(league)); return rooms.get(league); };
let G = roomFor(1);
// alle Verbindungen, die im aktuellen Raum G sind
const roomClients = () => [...clients.values()].filter(c => c.room === G);
// Spieler in den Raum seiner Liga setzen (nur in der Lobby – mitten in einer Runde wird niemand verschoben)
function placeClient(c) {
  const L = leagueOf(upsOf(c.name)), old = c.room;
  if (old && old.league === L) return;
  if (old && old.phase !== 'lobby' && old.players.has(c.id)) return;
  c.room = roomFor(L);
  if (old) { G = old; broadcast(lobbyMsg()); }
  G = c.room; broadcast(lobbyMsg());
}

function send(ws, obj) { if (ws.readyState === 1) ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj)); }
function broadcast(obj) { const s = JSON.stringify(obj); for (const c of roomClients()) send(c.ws, s); }   // nur an den aktuellen Raum
function lobbyMsg() {
  return { t: 'lobby', seed: G.seed, mode: G.mode, bots: G.bots, duo: G.duo ? 1 : 0, urls: lanUrls(),
    league: G.league, players: roomClients().map(c => ({ id: c.id, name: c.name, suit: c.suit, pearls: pearlsOf(c.name), up: upsOf(c.name), league: leagueOf(upsOf(c.name)), suits: suitsOf(c.name), gads: gadsOf(c.name), weps: wepsOf(c.name), atts: attsOf(c.name), load: loadOf(c.name) })) };
}
const ev = (...a) => G.events.push(a);

// ---------- match setup ----------
function mkPlayer(id, name, suit, bot) {
  const S = SUITS[suit];
  return { id, name, suit, bot, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, lx: 0, ly: 0, lz: 0, yaw: 0, pitch: 0,
    hp: S.hp, maxhp: S.hp, shield: 0, alive: true, weapons: [newWeapon(...(S.start || ['pistol', 0])), null, null],   // Startwaffe je Anzug
    slot: 0, reload: 0, reloadT: 1, nextFire: 0, veh: 0, kills: 0, grabbed: 0, ink: 0, shockT: 0, boost: false, place: 0,
    zoneAcc: 0, ye: [],
    thinkT: rnd() * 0.4, goal: null, crate: -1, target: null, mode: 'loot', skill: 0.12 + rnd() * 0.08, reactT: 0,   // skill = aim error (higher = worse)
    phase: rnd() * 6.28, stuckT: 0, burst: 0, holdT: 0, strT: 0, fightUntil: 0, peaceUntil: 0 };
}
function rollRarity(bonus = 0) { const r = rnd() - bonus; return r < 0.05 ? 3 : r < 0.2 ? 2 : r < 0.5 ? 1 : 0; }
function rollWeapon() {
  let t = rnd() * 100;
  for (const [id, w] of LOOT_W) { if ((t -= w) < 0) return id; }
  return 'needler';
}
function addPickup(k, x, y, z, wid = '', rar = 0, ammo = -1, spare = null) {
  const p = { id: nextId++, k, wid, rar, ammo: ammo < 0 && wid ? WEAPONS[wid].mag : ammo, spare, x, y, z };
  G.pickups.set(p.id, p);
  ev('pk+', p.id, k, wid, rar, r2(x), r2(y), r2(z));
  return p;
}
function removePickup(p) { G.pickups.delete(p.id); ev('pk-', p.id); }
const LIM = PLAY - 18;   // so weit draußen dürfen Bots und Tiere höchstens hin
function randSpot(rad, lift) {
  const W = G.world;
  for (let i = 0; i < 30; i++) {
    const a = rnd() * 6.283, d = Math.sqrt(rnd()) * rad;
    const x = Math.cos(a) * d, z = Math.sin(a) * d, y = W.heightAt(x, z) + lift;
    if (!W.cols.some(c => (c.x - x) ** 2 + (c.y - y) ** 2 + (c.z - z) ** 2 < (c.r + 2) ** 2)) return { x, y, z };
  }
  return { x: 0, y: W.heightAt(0, 0) + lift, z: 0 };
}

function startMatch() {
  const W = G.world;
  G.phase = 'play'; G.time = 0; G.noHumanT = 0;
  G.players = new Map(); G.proj = []; G.pickups = new Map(); G.events = [];
  G.crates = W.crates.map(c => ({ x: c.x, y: c.y, z: c.z, open: false }));
  G.vehicles = new Map();
  for (const s of W.vehSpawns) {
    const v = { id: nextId++, type: s.type, x: s.x, y: s.y, z: s.z, yaw: s.yaw, pitch: 0, hp: VEHICLES[s.type].hp, driver: 0, nextFire: 0 };
    G.vehicles.set(v.id, v);
  }
  G.creatures = [];
  if (G.mode !== 'wave') for (let i = 0; i < MAP_STUFF.sharks; i++) {
    const p = randSpot(250 * MAP_K, 10 + rnd() * 25);
    G.creatures.push({ id: nextId++, type: 'shark', ...p, vx: 0, vy: 0, vz: 0, yaw: rnd() * 6.28, pitch: 0, hp: CREATURES.shark.hp,
      state: 'patrol', wp: null, tid: 0, scanT: rnd(), t: 0, bites: 0 });
  }
  if (G.mode !== 'wave') for (const l of W.lairs) G.creatures.push({ id: nextId++, type: 'octo', x: l.x, y: l.y, z: l.z, vx: 0, vy: 0, vz: 0, yaw: rnd() * 6.28, pitch: 0,
    hp: CREATURES.octo.hp, state: 'lurk', lair: l, tid: 0, cool: 0, grip: 0, acc: 0, scanT: rnd() });
  if (G.mode !== 'wave') for (const s of W.swarms) {
    const ph = rnd() * 6.28;
    for (let i = 0; i < 7; i++) G.creatures.push({ id: nextId++, type: 'jelly', x: s.x, y: s.y, z: s.z, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0,
      hp: CREATURES.jelly.hp, state: 'drift', sw: s, sph: ph, ox: (rnd() - 0.5) * 12, oy: (rnd() - 0.5) * 7, oz: (rnd() - 0.5) * 12, ph: rnd() * 6.28 });
  }
  // participants
  for (const c of roomClients()) {
    const p = mkPlayer(c.id, c.name, c.suit, false); p.up = upsOf(c.name);
    p.hp = p.maxhp = Math.round(p.maxhp * upMul(p.up, 'hp'));   // Zäher Anzug: mehr Leben
    // Ausrüstung aus dem Ausrüstungs-Fenster: Gadget (wenn gekauft und nicht abgelegt) und Startwaffe
    const L = loadOf(c.name)[c.suit] || {}, gi = gadgetOf(c.suit);
    p.gad = gi >= 0 && L.gad !== false && gadsOf(c.name).includes(GADGETS[gi].k) ? gi : -1; p.gadT = 0;
    const [sw, sr] = SUITS[c.suit].start || ['pistol', 0];
    const wid = L.wep && (L.wep === 'pistol' || wepsOf(c.name).includes(L.wep)) && WEAPONS[L.wep] ? L.wep : sw, rar = wid === sw && !L.wep ? sr : 0;
    p.weapons[0] = newWeapon(wid, rar, null, null, ((L.mods || {})[wid] || []).filter(k => attsOf(c.name).includes(wid + ':' + k)));   // Startwaffe mit Aufsätzen
    G.players.set(p.id, p); c.playing = true;
  }
  G.baits = []; G.drones = [];
  const names = [...BOT_NAMES].sort(() => rnd() - 0.5);
  const nBots = G.mode === 'wave' ? Math.max(0, WAVE.team - roomClients().length) : G.bots;   // Wellen: immer zu viert (Bots füllen auf)
  for (let i = 0; i < nBots; i++) {
    const p = mkPlayer(nextId++, names[i % names.length], pick(SUIT_ORDER), true);
    G.players.set(p.id, p);
  }
  // Faire Bots: sie bekommen die Upgrades, die die Spieler im Durchschnitt gekauft haben (mehr Leben, schneller nachladen …)
  const humans = [...G.players.values()].filter(p => !p.bot);
  if (humans.length) {
    const avg = {};
    for (const u of BR_UPS) avg[u.k] = Math.round(humans.reduce((a, p) => a + ((p.up && p.up[u.k]) | 0), 0) / humans.length);
    for (const p of G.players.values()) if (p.bot) { p.up = { ...avg }; p.hp = p.maxhp = Math.round(p.maxhp * upMul(p.up, 'hp')); }
  }
  // jeder außer dem Goliath hat ein Magnet-Gewehr mit 2 Schuss dabei (Platz 3) – damit kann man einen Mech lahmlegen
  for (const p of G.players.values()) if (!SUITS[p.suit].mech) p.weapons[2] = newWeapon('magrifle', 0);
  // Duo: je zwei Spieler bilden ein Team (zuerst die Menschen, dann die Bots). team 0 = kein Team (Solo)
  const all = [...G.players.values()];
  all.forEach((p, i) => { p.team = G.mode === 'wave' ? 1 : G.duo ? Math.floor(i / 2) + 1 : 0; });   // Wellen: alle in einem Team
  const mates = new Map();
  for (const p of all) {
    const m = p.team && mates.get(p.team);
    if (m) { p.x = p.lx = m.x + 3; p.z = p.lz = m.z + 2; p.y = p.ly = m.y; p.yaw = m.yaw; p.pitch = m.pitch; continue; }   // Teamkamerad startet direkt daneben
    const a = rnd() * 6.283, d = G.mode === 'wave' ? 0 : (60 + rnd() * 190) * MAP_K;   // Wellen: alle starten zusammen in der Mitte
    p.x = p.lx = Math.cos(a) * d; p.z = p.lz = Math.sin(a) * d; p.y = p.ly = SURFACE - DEEP.brCeil - 4;   // Start unter der Tiefsee-Grenze
    p.yaw = Math.atan2(p.x, p.z); p.pitch = -0.6;
    if (p.team) mates.set(p.team, p);
  }
  // floor loot
  for (let i = 0; i < MAP_STUFF.loot; i++) {
    const s = randSpot(260 * MAP_K, 1.0), r = rnd();
    if (r < 0.55) addPickup('w', s.x, s.y, s.z, rollWeapon(), rollRarity(-0.15));
    else addPickup(r < 0.78 ? 'med' : 'sh', s.x, s.y, s.z);
  }
  G.events = [];
  const zr = 430 * MAP_K; G.zone = { x: 0, z: 0, r: zr, fx: 0, fz: 0, fr: zr, nx: 0, nz: 0, nr: zr, ph: 0, t: 0, sh: false };
  pickNextZone();
  G.wave = G.mode === 'wave' ? { n: 0, state: 'break', t: WAVE.firstBreak } : null;
  for (const c of roomClients()) send(c.ws, startMsg(c));
  console.log(`[match] Liga ${G.league} started: ${roomClients().length} human(s), ${G.bots} bot(s), seed ${G.seed}`);
}
function startMsg(c) {
  const me = G.players.get(c.id);
  return { t: 'start', seed: G.seed, mode: G.mode, you: c.id, spectator: !me, spawn: me ? [r2(me.x), r2(me.y), r2(me.z), r2(me.yaw)] : null,
    players: [...G.players.values()].map(p => [p.id, p.name, p.suit, p.bot ? 1 : 0, p.team || 0]),
    crates: G.crates.map(c => c.open ? 1 : 0),
    pickups: [...G.pickups.values()].map(p => [p.id, p.k, p.wid, p.rar, r2(p.x), r2(p.y), r2(p.z)]) };
}
function pickNextZone() {
  const z = G.zone, P = PHASES[z.ph];
  if (!P) { z.nx = z.x; z.nz = z.z; z.nr = 0; return; }
  const maxOff = Math.max(0, z.r - P.r) * 0.9;
  const a = rnd() * 6.283, d = Math.sqrt(rnd()) * (z.ph === 0 ? 90 * MAP_K : maxOff), zc = 170 * MAP_K;
  z.nx = clamp(z.x + Math.cos(a) * d, -zc, zc); z.nz = clamp(z.z + Math.sin(a) * d, -zc, zc); z.nr = P.r;
}
function updateZone(dt) {
  const z = G.zone, P = PHASES[z.ph];
  if (!P || G.wave) return;   // Wellen-Modus: kein Schwarzwasser
  z.t += dt;
  if (!z.sh) {
    if (z.t >= P.wait) { z.sh = true; z.t = 0; z.fx = z.x; z.fz = z.z; z.fr = z.r; ev('msg', 'Das Schwarzwasser rückt vor!'); }
  } else {
    const k = Math.min(1, z.t / P.shrink);
    z.x = z.fx + (z.nx - z.fx) * k; z.z = z.fz + (z.nz - z.fz) * k; z.r = z.fr + (z.nr - z.fr) * k;
    if (k >= 1) { z.ph++; z.sh = false; z.t = 0; pickNextZone(); }
  }
}
const zoneDps = () => PHASES[Math.min(G.zone.ph, PHASES.length - 1)].dps;
const aliveCount = () => { let n = 0; for (const p of G.players.values()) if (p.alive) n++; return n; };
// Duo: wie viele Teams noch jemanden am Leben haben (Solo: wie viele Spieler)
const aliveTeams = () => { const t = new Set(); for (const p of G.players.values()) if (p.alive) t.add(p.team || -p.id); return t.size; };

// ---------- damage ----------
function damage(p, amt, src, how, sx, sz) {
  if (!p.alive || amt <= 0) return;
  // Schild-Generator (Bollwerk): Schüsse von Gegnern prallen ab
  if (G.time < (p.bubbleT || 0) && src && src.id && src !== p && how !== 'zone') { ev('deflect', p.id); return; }
  // Duo: Teamkameraden können sich nicht verletzen (auch nicht mit Explosionen)
  if (p.team && src && src !== p && src.team === p.team && how !== 'zone') return;
  // Manta-Ulti (Matrix): weicht jeder Kugel aus – nur Zone, Hitze und Bluten treffen noch
  if (p.suit === 'manta' && G.time < (p.ultT || 0) && src && src !== p && how !== 'zone' && how !== 'burn' && how !== 'bleed') { ev('dodge', p.id); return; }
  // Bollwerk-Ulti (Festung): nur ein Drittel Schaden kommt durch
  if (p.suit === 'bulwark' && G.time < (p.ultT || 0) && how !== 'zone') amt *= ULTIS.bulwark.armor;
  if (!p.bot && src && src.bot) amt *= 0.7;        // bots hit humans a little softer
  if (p.bot && (how === 'shark' || how === 'octo' || how === 'jelly')) amt *= 0.5;
  if (p.bot && src && src.bot) amt *= 0.1;   // keep bot-vs-bot fights from emptying the lobby too early
  const v = p.veh && G.vehicles.get(p.veh);
  if (v && v.type === 'sub' && how !== 'zone') { damageVehicle(v, amt, src); return; }
  let a = amt;
  p.hurtT = G.time;   // expedition: pauses health regeneration
  const hadShield = p.shield > 0;
  if (how !== 'zone' && how !== 'bleed' && how !== 'burn') { const s = Math.min(p.shield, a); p.shield -= s; a -= s; }   // gegen Verbrennen hilft kein Schild
  const shieldBroke = hadShield && p.shield <= 0;
  if (shieldBroke && !p.bot) p.ye.push(['shb']);   // dein eigenes Schild ist kaputt
  p.hp -= a;
  // wer trifft, lädt seine Ulti schneller auf
  if (src && src.id && src !== p && ULTIS[src.suit] && G.time >= (src.ultT || 0)) src.ult = Math.min(100, (src.ult || 0) + amt * ULTI.perDmg);
  if (!p.bot) p.ye.push(['hurt', Math.round(amt), r2(sx ?? p.x), r2(sz ?? p.z), how === 'zone' || how === 'bleed' || how === 'burn' ? 1 : 0]);
  if (src && src.id && !src.bot && src !== p) src.ye.push(['hm', Math.round(amt), p.hp <= 0 ? 1 : 0, +(Math.max(0, p.hp) / p.maxhp).toFixed(2), shieldBroke ? 1 : 0]);
  if (p.bot && src && src.id && src !== p && src.alive && (!src.bot || G.time >= p.peaceUntil) && (!p.target || rnd() < 0.5)) {
    if (src.bot) p.fightUntil = G.time + 5 + rnd() * 4; p.target = { k: 'p', ref: src }; p.reactT = Math.min(p.reactT, 0.25); }
  // Sepia: Tintenflucht – bei wenig Leben automatisch eine Tintenwolke, Gegner in der Nähe sind kurz blind
  const SP = SUITS[p.suit];
  if (SP.ink && p.hp > 0 && p.hp < p.maxhp * SP.ink && G.time >= (p.inkCool || 0)) {
    p.inkCool = G.time + SP.inkCool;
    ev('ink', r2(p.x), r2(p.y), r2(p.z));
    for (const q of G.players.values()) if (q !== p && q.alive && dist(p, q) < 9) { q.ink = Math.max(q.ink, 2.5); if (q.bot) { q.reactT = Math.max(q.reactT, 1.5); q.target = null; } }
  }
  if (p.hp <= 0) { if (G.mode === 'exp') expDown(p, src, how); else kill(p, src, how); }
}
function damageVehicle(v, amt, src) {
  if (v.dead) return;
  v.hp -= amt;
  const d = v.driver && G.players.get(v.driver);
  if (d && !d.bot) d.ye.push(['hurt', Math.round(amt), r2(v.x), r2(v.z), 0]);
  const gn0 = v.gunner && G.players.get(v.gunner); if (gn0 && !gn0.bot) gn0.ye.push(['hurt', Math.round(amt), r2(v.x), r2(v.z), 0]);
  if (src && src.id && !src.bot && d && src !== d) src.ye.push(['hm', Math.round(amt), 0, +(Math.max(0, v.hp) / VEHICLES[v.type].hp).toFixed(2), 0]);
  if (v.hp <= 0) {
    v.dead = true; G.vehicles.delete(v.id);
    ev('boom', 0, r2(v.x), r2(v.y), r2(v.z), 7);
    ev('vdie', v.id);
    if (d) { d.veh = 0; damage(d, 35, src, 'wreck', v.x, v.z); }
    const gn = v.gunner && G.players.get(v.gunner); if (gn) { gn.veh = 0; damage(gn, 35, src, 'wreck', v.x, v.z); }
  }
}
// Finisher: p erledigt den Gegner mit der id, wenn er nah genug ist und wenig Leben hat (Regeln: FINISHER in shared.js).
// Alle Browser bekommen 'fin' und spielen die Animation ab: [Angreifer, Opfer, Klasse Angreifer, Klasse Opfer, x, y, z, Blickrichtung Opfer]
function finisher(p, id) {
  if (G.mode === 'exp' || p.veh || p.grabbed || G.time < (p.finCool || 0)) return;
  const t = G.players.get(id);
  if (!t || !t.alive || t === p || t.veh) return;
  if (dist(p, t) > FINISHER.range[p.suit] + 1.5 || t.hp > t.maxhp * FINISHER.hp + 1) return;
  p.finCool = G.time + 2;
  ev('fin', p.id, t.id, SUIT_ORDER.indexOf(p.suit), SUIT_ORDER.indexOf(t.suit), r2(t.x), r2(t.y), r2(t.z), r2(t.yaw));
  kill(t, p, 'fin');
}
function kill(p, src, how) {
  p.alive = false; p.hp = 0;
  p.place = p.team ? aliveTeams() + ([...G.players.values()].some(q => q.alive && q !== p && q.team === p.team) ? 0 : 1) : aliveCount() + 1; p.deathT = G.time;
  if (p.veh) { const v = G.vehicles.get(p.veh); if (v) { if (v.gunner === p.id) v.gunner = 0; else v.driver = 0; } p.veh = 0; }
  if (p.grabbed) { const o = G.creatures.find(c => c.id === p.grabbed); if (o) releaseOcto(o); }
  for (const w of p.weapons) if (w && !(w.id === 'pistol' && w.rar === 0) && w.id !== 'magrifle')   // Magnet-Gewehr fällt nicht als Beute
    addPickup('w', p.x + (rnd() - 0.5) * 2, p.y + rnd(), p.z + (rnd() - 0.5) * 2, w.id, w.rar, w.ammo, w.spare);
  if (rnd() < 0.6) addPickup(rnd() < 0.5 ? 'med' : 'sh', p.x, p.y + 0.5, p.z);
  const label = { zone: 'Schwarzwasser', shark: 'Hai', octo: 'Oktopus', jelly: 'Qualle', left: 'Verbindung', wreck: 'Explosion', coral: 'Koralle', bleed: 'Verblutet', burn: 'Verbrannt' }[how];
  let by = label || '?';
  if (src && src.id && src !== p) { src.kills++; by = src.name; } else if (src && src.id && src === p) by = 'Eigentor';
  ev('kill', by, p.name, p.id, src && src.id && src !== p ? src.id : 0);
  if (!p.bot) p.ye.push(['dead', p.place, by]);
}
function damageCreature(c, amt, src) {
  if (c.dead) return;
  c.hp -= amt;
  if (src && !src.bot) src.ye.push(['hm', Math.round(amt), c.hp <= 0 ? 1 : 0, +(Math.max(0, c.hp) / (c.maxhp || CREATURES[c.type].hp)).toFixed(2), 0]);
  if (c.type === 'fish' || c.type === 'boss') return expCreatureHurt(c, src);
  if (c.type === 'octo' && c.state === 'hold') c.grip -= amt;
  if (c.type === 'shark' && src && src.alive && c.state !== 'retreat') { c.state = 'hunt'; c.tid = src.id; }
  if (c.hp <= 0) {
    c.dead = true;
    if (c.type === 'octo') releaseOcto(c);
    ev('cdie', c.id, r2(c.x), r2(c.y), r2(c.z));
    if (src && c.type !== 'jelly') ev('kill', src.name, CREATURES[c.type].name, 0, src.id);
    if (c.type === 'shark') addPickup('sh', c.x, c.y, c.z);
    if (c.type === 'octo') addPickup('w', c.x, c.y + 0.5, c.z, rollWeapon(), Math.max(1, rollRarity(0.1)));
  }
}

// ---------- weapons ----------
// mods = Aufsätze (nur an der Startwaffe aus dem Ausrüstungs-Fenster); wdef(w) = Werte der Waffe mit ihren Aufsätzen
const newWeapon = (id, rar, ammo = null, spare = null, mods = []) => ({ id, rar, mods, ammo: ammo ?? modDef(id, mods).mag, spare: spare ? [...spare] : Array(WEAPONS[id].spares ?? COMPRESSOR.spares).fill(1) });
const wdef = (w) => modDef(w.id, w.mods);
// das vollste Ersatzmagazin im Rucksack (Index), -1 wenn es keins gibt
function bestSpare(w) {
  if (!w.spare) w.spare = Array(COMPRESSOR.spares).fill(1);
  let b = -1; for (let i = 0; i < w.spare.length; i++) if (b < 0 || w.spare[i] > w.spare[b]) b = i;
  return b;
}
// Nachladen geht nur, wenn im Rucksack ein Magazin ist, das voller ist als das in der Waffe
function startReload(p) {
  const w = p.weapons[p.slot];
  if (!w || p.reload > 0) return;
  const d = wdef(w);
  if (w.ammo >= d.mag) return;
  const b = bestSpare(w);
  if (b < 0 || Math.floor(w.spare[b] * d.mag + 1e-6) <= w.ammo) {
    if (!p.bot && G.time > (p.noMagT || 0)) { p.noMagT = G.time + 2; p.ye.push(['warn', 'Keine vollen Magazine – der Kompressor füllt nach …']); }
    return;
  }
  p.reload = p.reloadT = d.reload * upMul(p.up, 'reload');   // Schnellladen aus dem Perlen-Shop
}
// Nachladen fertig: das alte Magazin (mit dem Rest darin) kommt in den Rucksack, das vollste kommt in die Waffe
function finishReload(p) {
  p.reload = 0;
  const w = p.weapons[p.slot]; if (!w) return;
  const d = wdef(w), b = bestSpare(w); if (b < 0) return;
  const take = Math.floor(w.spare[b] * d.mag + 1e-6);
  w.spare[b] = w.ammo / d.mag;
  w.ammo = take;
}
// Scharfe Leuchtkorallen: wer eine berührt, schneidet sich und blutet danach eine Weile (Bots passen auf und bleiben verschont)
function coralCut(p, dt) {
  if (!p.alive || p.bot || p.veh) return;
  if (p.bleed > 0) {   // Bluten: jede Sekunde ein bisschen Schaden
    p.bleed -= dt; p.bleedAcc = (p.bleedAcc || 0) + GLOW_CORALS.bleedDps * dt;
    if (p.bleedAcc >= 1) { const a = Math.floor(p.bleedAcc); p.bleedAcc -= a; damage(p, a, null, 'bleed'); if (!p.alive) return; }
  }
  if (G.time < (p.cutT || 0)) return;
  const r = SUITS[p.suit].r;
  for (const c of G.world.glowCorals) {
    const dx = p.x - c.x, dz = p.z - c.z;
    if (dx > 3 || dx < -3 || dz > 3 || dz < -3) continue;
    const dy = p.y - (c.y + 0.45 * c.s);
    if (dx * dx + dy * dy + dz * dz < (r * 0.8 + 0.35 * c.s) ** 2) {   // nur bei echter Berührung
      p.cutT = G.time + GLOW_CORALS.cooldown;
      p.bleed = GLOW_CORALS.bleed;
      p.ye.push(['bleed', GLOW_CORALS.bleed]);
      damage(p, GLOW_CORALS.dmg, null, 'coral', c.x, c.z);
      return;
    }
  }
}
// Der Kompressor füllt pro Waffe immer das Ersatzmagazin, das schon am vollsten (aber noch nicht voll) ist
function compress(p, dt) {
  for (const w of p.weapons) {
    if (!w) continue;
    if (WEAPONS[w.id].noRefill) continue;   // Magnet-Gewehr: kein Nachfüllen
    bestSpare(w);
    let b = -1; for (let i = 0; i < w.spare.length; i++) if (w.spare[i] < 1 && (b < 0 || w.spare[i] > w.spare[b])) b = i;
    if (b >= 0) w.spare[b] = Math.min(1, w.spare[b] + dt / ((COMPRESSOR.fill[w.id] || 8) * upMul(p.up, 'comp') * (SUITS[p.suit].fill || 1)));   // Turbo-Kompressor, Nautilus
  }
}
// Lag-Ausgleich: Im Browser sieht man alles ca. 0,1 s zu spät. Hat der Spieler genau auf ein Ziel gezielt
// (aim = [Art, id], 1 = Spieler, 3 = Kreatur), zählt ein Hitscan-Treffer bei diesem Ziel noch AIM_HELP Meter daneben.
const AIM_HELP = 1.5;
function spawnProj(p, wid, ox, oy, oz, d, mul, vehId, aim, def = WEAPONS[wid]) {   // def: Werte mit Aufsätzen
  let dx = d[0] + (rnd() * 2 - 1) * def.spread, dy = d[1] + (rnd() * 2 - 1) * def.spread, dz = d[2] + (rnd() * 2 - 1) * def.spread;
  const l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1; dx /= l; dy /= l; dz /= l;
  const pr = { id: nextId++, o: p.id, wid, x: ox, y: oy, z: oz, dx, dy, dz, sp: def.speed, life: def.life, dmg: def.dmg * mul, splash: def.splash, veh: vehId || 0 };
  if (def.hitscan) {
    pr.aim = aim;
    // Hitscan: die ganze Strecke (range) in einem einzigen Schritt prüfen, der Schuss trifft sofort
    pr.sp = def.range;
    const end = moveProj(pr, 1);
    pr.dead = true;
    ev('beam', WEAPON_IDS.indexOf(wid), p.id, r2(ox), r2(oy), r2(oz), r2(end[0]), r2(end[1]), r2(end[2]));
    return;
  }
  G.proj.push(pr);
  ev('pj', pr.id, WEAPON_IDS.indexOf(wid), p.id, r2(ox), r2(oy), r2(oz), +dx.toFixed(3), +dy.toFixed(3), +dz.toFixed(3));
}
// MG in der Glaskugel unter dem U-Boot: rate = Schuss pro Sekunde, dmg = Schaden, range = Reichweite (m)
const SUB_MG = { ...WEAPONS.spikemg, dmg: 8, rate: 11, range: 55, spread: 0.018, hitscan: true, beam: 0.05, pellets: 1 };
function fire(p, d, aim) {
  if (!p.alive || !Array.isArray(d) || d.length !== 3 || d.some(v => typeof v !== 'number' || !isFinite(v))) return;
  if (!Array.isArray(aim) || aim.length !== 2 || !aim.every(Number.isInteger)) aim = null;
  const l = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
  if (l < 0.5) return;
  d = [d[0] / l, d[1] / l, d[2] / l];
  const v = p.veh && G.vehicles.get(p.veh);
  if (v && v.type === 'sub' && v.gunner === p.id) {   // Schütze in der MG-Kugel unter dem U-Boot
    if (G.time < (v.gunNext || 0) - 0.02) return;
    v.gunNext = G.time + 1 / SUB_MG.rate;
    spawnProj(p, 'spikemg', p.x + d[0] * 0.8, p.y + eyeHeight(p.suit) + d[1] * 0.8, p.z + d[2] * 0.8, d, 1, v.id, aim, SUB_MG);
    return;
  }
  if (v && v.type === 'ray') {   // Torpedo-Rochen: Torpedo aus dem Bauch
    const RY = VEHICLES.ray; if (G.time < v.nextFire - 0.06) return;
    v.nextFire = G.time + 1 / RY.torpRate;
    spawnProj(p, 'subtorp', v.x + d[0] * 2.6, v.y + d[1] * 2.6 - 0.5, v.z + d[2] * 2.6, d, 1, v.id, null, { ...WEAPONS.subtorp, dmg: RY.torpDmg, splash: 6 });
    return;
  }
  if (v && v.type === 'sub') {
    if (G.time < v.nextFire - 0.06) return;
    v.nextFire = G.time + 1 / WEAPONS.subtorp.rate;
    spawnProj(p, 'subtorp', v.x + d[0] * 4.4, v.y + d[1] * 4.4 - 0.6, v.z + d[2] * 4.4, d, 1, v.id);
    return;
  }
  const w = p.weapons[p.slot];
  if (!w || p.reload > 0 || G.time < p.nextFire - 0.06 || G.time < (p.holsterT || 0) || G.time < (p.stunT || 0)) return;   // weggesteckt (zu heiß) oder gelähmt: nicht schießen
  if (WEAPONS[w.id].melee) return melee(p, w, d);   // Stabwaffe: Stoß statt Schuss
  if (w.ammo <= 0) { startReload(p); return; }
  p.invisT = 0;   // wer schießt, ist nicht mehr getarnt (Sepia-Ulti)
  const def = wdef(w), S = SUITS[p.suit];
  w.ammo--; p.nextFire = G.time + 1 / def.rate;
  const o = S.r + 0.5, eye = eyeHeight(p.suit);   // Schuss startet auf Augenhöhe (genau hinter dem Fadenkreuz)
  for (let i = 0; i < def.pellets; i++) spawnProj(p, w.id, p.x + d[0] * o, p.y + eye + d[1] * o, p.z + d[2] * o, d, RARITY[w.rar].mul * S.dmg, 0, aim, def);
  if (G.mode !== 'exp') heatUp(p, w, def);
  if (w.ammo === 0) startReload(p);
}
// Hitze: jeder Schuss am Stück heizt die Waffe auf (und sie kühlt dabei langsam ab). Während man schießt, passiert nichts –
// erst wenn man aufhört oder nachlädt, kommt alles auf einen Schlag raus (ventHeat). Nicht im Kampf bestraft, sondern danach.
function heatUp(p, w, def) {
  coolDown(w, def);
  w.heat = (w.heat || 0) + 1; w.shotT = G.time; w.peak = Math.max(w.peak || 0, w.heat);
}
// Abkühlen zwischen zwei Schüssen: Im vollen Tempo (mit 30 % Spielraum) kühlt sie gar nicht ab – jeder Schuss zählt.
// Jede Zeit darüber hinaus kühlt sie ab: HEAT.cool Schuss pro Schuss-Abstand.
function coolDown(w, def) {
  const gap = w.coolT != null ? G.time - w.coolT : 0; w.coolT = G.time;
  if (w.heat) w.heat = Math.max(0, w.heat - Math.max(0, gap - 1.3 / def.rate) * def.rate * HEAT.cool);
}
// Hitze ablassen, sobald man aufhört zu schießen (kurze Pause) oder die Waffe nachlädt:
// Schallwelle mit Wumms (je mehr Hitze, desto stärker). War es zu viel, verbrennt man sich JETZT: Schaden, "Ah!", benommen.
// War es viel zu viel, muss man die Waffe wegstecken und HEAT.holster Sekunden warten.
function ventHeat(p) {
  for (const w of p.weapons) {
    if (!w || !w.shotT) continue;
    const def = wdef(w), held = w === p.weapons[p.slot];
    const stopped = G.time - w.shotT >= Math.max(HEAT.pause, 1.6 / def.rate);   // langsame Waffen: etwas länger warten
    if (!stopped && !(held && p.reload > 0)) continue;
    const peak = w.peak || 0, s0 = heatStart(def.mag);
    w.heat = 0; w.peak = 0; w.shotT = 0; w.coolT = null;
    if (!p.alive || peak < 2) continue;
    ev('vent', p.id, WEAPON_IDS.indexOf(w.id), +Math.min(1, peak / s0 * 0.6).toFixed(2), held ? 1 : 0);
    if (peak <= s0) continue;
    // so verteilt, dass ein ganzes Magazin im Dauerfeuer genau HEAT.dmg Schaden macht (mehr als ein Magazin am Stück: bis 30 % mehr)
    const span = Math.max(1, def.mag * 0.8 - s0), hot = Math.min(1, (peak - s0) / span), dmg = HEAT.dmg * Math.min(1.3, (peak - s0) / span);
    if (dmg < 1) continue;   // so wenig, dass es nicht wehtut
    if (SUITS[p.suit].mech) continue;   // der Goliath sitzt geschützt im Mech: kein Hitzeschaden (die Schallwelle kommt trotzdem)
    ev('burn', p.id, +hot.toFixed(2));   // alle hören das "Ah", der Schütze wird benommen
    damage(p, dmg, null, 'burn');
    if (p.alive && dmg >= HEAT.dmg * HEAT.holsterAt) {   // viel zu heiß: Waffe wegstecken, Strafe
      p.holsterT = G.time + HEAT.holster;
      if (!p.bot) p.ye.push(['holster', HEAT.holster]);
    }
  }
}
// ---------- Stabwaffen: Stoß nach vorne ----------
// Getroffen wird, wer höchstens range Meter (plus eigene Größe) entfernt ist und ungefähr vor einem liegt (arc).
// Es zählt nur ein Treffer pro Stoß: der nächste. Kampfstab stößt weg, Elektro-Speer lähmt kurz.
function melee(p, w, d) {
  const def = WEAPONS[w.id], S = SUITS[p.suit], reach = def.range + S.r;
  p.nextFire = G.time + 1 / def.rate;
  let best = null, bd = 1e9, kind = 0;
  const test = (x, y, z, r, obj, k) => {
    const dx = x - p.x, dy = y - p.y, dz = z - p.z, dl = Math.hypot(dx, dy, dz) || 1;
    if (dl - r > reach || (dx * d[0] + dy * d[1] + dz * d[2]) / dl < def.arc) return;
    if (G.world.segmentHit(p.x, p.y, p.z, x, y, z) > 0 && dl > 1.5) return;   // Fels dazwischen
    if (dl < bd) { bd = dl; best = obj; kind = k; }
  };
  for (const q of G.players.values()) if (q !== p && q.alive) test(q.x, q.y, q.z, SUITS[q.suit].r, q, 1);
  for (const c of G.creatures) if (!c.dead) test(c.x, c.y, c.z, creatureR(c.type, c.sub), c, 3);
  const dmg = def.dmg * RARITY[w.rar].mul * S.dmg;
  if (best && kind === 1) {
    damage(best, dmg, p, 'melee', p.x, p.z);
    if (best.alive) {
      if (def.push) pushAway(best, d[0] * def.push, d[1] * def.push + 2, d[2] * def.push);
      if (def.stun) { best.stunT = Math.max(best.stunT || 0, G.time + def.stun); best.shockT = Math.max(best.shockT, G.time + def.stun); if (best.bot) best.reactT = Math.max(best.reactT, def.stun); else best.ye.push(['stun', def.stun]); }
    }
  } else if (best && kind === 3) damageCreature(best, dmg, p);
  ev('melee', p.id, WEAPON_IDS.indexOf(w.id), best ? 1 : 0, best ? r2(best.x) : 0, best ? r2(best.y) : 0, best ? r2(best.z) : 0);
}
// ---------- Besondere Treffer der neuen Waffen ----------
// Netz: langsam (net Sekunden). Magnet-Gewehr: ein Mech ist emp Sekunden komplett lahm (Schaltkreise überlastet),
// ein normaler Taucher nur ganz kurz, weil er kaum Elektronik hat.
function hitEffects(q, def) {
  if (def.net) {
    q.shockT = Math.max(q.shockT, G.time + def.net);
    if (q.bot) q.reactT = Math.max(q.reactT, 0.6); else q.ye.push(['net', def.net]);
    ev('net', q.id, def.net);
  }
  if (def.emp) {
    const t = SUITS[q.suit].mech ? def.emp : 0.5;
    q.stunT = Math.max(q.stunT || 0, G.time + t); q.empT = Math.max(q.empT || 0, G.time + t);
    if (q.bot) q.reactT = Math.max(q.reactT, t); else q.ye.push(['emp', t]);
    ev('emp', q.id, t);
  }
}
// ---------- Gadgets (Battle Royale, Taste Q) – Werte in GADGETS (shared.js) ----------
// Punkt, auf den man zielt: bis range Meter weit, oder früher, wenn Fels/Riff im Weg ist (hit = true)
function aimPoint(p, d, range) {
  const W = G.world, t = W.segmentHit(p.x, p.y, p.z, p.x + d[0] * range, p.y + d[1] * range, p.z + d[2] * range);
  const k = t > 0 ? t * range - 0.8 : range;
  return { x: p.x + d[0] * k, y: p.y + d[1] * k, z: p.z + d[2] * k, hit: t > 0 };
}
const foesNear = (p, x, y, z, r) => [...G.players.values()].filter(q => q !== p && q.alive && !(p.team && q.team === p.team) && Math.hypot(q.x - x, q.y - y, q.z - z) < r);
// jemanden wegstoßen: Bots direkt, echte Spieler bekommen den Stoß geschickt (ihre Position steuert der Browser)
function pushAway(q, vx, vy, vz) { if (q.bot) { q.vx += vx; q.vy += vy; q.vz += vz; } else q.ye.push(['push', r2(vx), r2(vy), r2(vz)]); }
function useGadget(p, m) {
  if (p.gad < 0 || G.time < (p.gadT || 0) || p.veh) return;
  const g = GADGETS[p.gad];
  let d = Array.isArray(m.d) && m.d.length === 3 && m.d.every(Number.isFinite) ? m.d : null;
  const l = d ? Math.hypot(...d) : 0; d = l > 0.5 ? d.map(v => v / l) : [0, 0, -1];
  let at = { x: p.x, y: p.y, z: p.z };
  switch (g.k) {
    case 'bait': at = aimPoint(p, d, g.range); G.baits.push({ ...at, o: p.id, until: G.time + g.time }); break;
    case 'sonar': break;   // der Browser zeigt die Gegner an
    case 'shield': p.bubbleT = G.time + g.time; break;
    case 'stomp':
      for (const q of foesNear(p, p.x, p.y, p.z, g.range)) {
        const dx = q.x - p.x, dy = q.y - p.y + 1, dz = q.z - p.z, dl = Math.hypot(dx, dy, dz) || 1, f = 22 * (1 - dl / g.range * 0.5);
        pushAway(q, dx / dl * f, dy / dl * f * 0.6 + 4, dz / dl * f); damage(q, g.dmg, p, 'stomp', p.x, p.z);
      }
      break;
    case 'inkbomb':
      at = aimPoint(p, d, g.range); ev('ink', r2(at.x), r2(at.y), r2(at.z));
      for (const q of foesNear(p, at.x, at.y, at.z, g.radius)) { q.ink = Math.max(q.ink, g.time); if (q.bot) { q.reactT = Math.max(q.reactT, g.time); q.target = null; } }
      break;
    case 'grapple': at = aimPoint(p, d, g.range); if (!at.hit) { if (!p.bot) p.ye.push(['warn', 'Kein Fels in Reichweite für das Seil']); return; } break;
    case 'drone': G.drones.push({ o: p.id, until: G.time + g.time, next: G.time + 0.6 }); break;
    case 'zap':
      for (const q of foesNear(p, p.x, p.y, p.z, g.range)) {
        q.stunT = G.time + g.time; q.shockT = G.time + g.time; damage(q, g.dmg, p, 'zap', p.x, p.z);
        if (q.bot) q.reactT = Math.max(q.reactT, g.time); else q.ye.push(['stun', g.time]);
      }
      break;
  }
  p.gadT = G.time + g.cool;
  ev('gad', p.id, p.gad, r2(at.x), r2(at.y), r2(at.z));   // alle sehen und hören es
}
// ---------- Ultis (Battle Royale, Taste 4) – Werte in ULTIS (shared.js) ----------
// Blickrichtung: vom Browser mitgeschickt (m.d), bei Bots zum Ziel hin, sonst aus der Körperdrehung
function ultDir(p, m) {
  let d = m && Array.isArray(m.d) && m.d.length === 3 && m.d.every(Number.isFinite) ? m.d : null;
  const t = p.bot && p.target && p.target.ref;
  if (!d && t) d = [t.x - p.x, t.y - p.y, t.z - p.z];
  if (!d) { const cp = Math.cos(p.pitch || 0); d = [-Math.sin(p.yaw) * cp, Math.sin(p.pitch || 0), -Math.cos(p.yaw) * cp]; }
  const l = Math.hypot(...d) || 1; return d.map(v => v / l);
}
function useUlti(p, m) {
  const U = ULTIS[p.suit];
  if (!U || (p.ult || 0) < 100 || p.veh || G.time < (p.ultT || 0)) return;
  p.ult = 0; p.ultT = G.time + U.time;
  const d = ultDir(p, m);
  switch (p.suit) {
    case 'triton': p.salvo = { n: U.n, next: G.time, d }; break;                     // Torpedos starten nacheinander (ultTick)
    case 'sepia': p.invisT = p.ultT; break;                                           // unsichtbar, bis man schießt
    case 'barrakuda': p.rammed = new Set(); pushAway(p, d[0] * U.speed, d[1] * U.speed, d[2] * U.speed); break;
    case 'nautilus': p.hp = Math.min(p.maxhp, p.hp + U.heal); p.shield = Math.max(p.shield, U.shield); break;
  }
  ev('ult', p.id, SUIT_ORDER.indexOf(p.suit));   // alle sehen und hören es
}
// was Ultis jede Runde (Tick) tun: Torpedo-Salve, Festung stößt weg, Rammstoß trifft
function ultTick() {
  if (G.mode === 'exp') return;
  for (const p of G.players.values()) {
    if (!p.alive) { p.salvo = null; continue; }
    const on = G.time < (p.ultT || 0), U = ULTIS[p.suit];
    if (p.salvo && G.time >= p.salvo.next) {
      const T = ULTIS.triton; let best = null, bd = T.range;
      for (const q of foesNear(p, p.x, p.y, p.z, T.range)) if (G.time >= (q.invisT || 0) && los(p, q)) { const dd = dist(p, q); if (dd < bd) { bd = dd; best = q; } }
      let d = p.salvo.d;
      if (best) { const dx = best.x - p.x, dy = best.y + 0.3 - p.y, dz = best.z - p.z, l = Math.hypot(dx, dy, dz) || 1; d = [dx / l, dy / l, dz / l]; }
      spawnProj(p, 'torpedo', p.x + d[0] * 1.8, p.y + d[1] * 1.8 + 0.3, p.z + d[2] * 1.8, d, 1, 0, null,
        { ...WEAPONS.torpedo, dmg: T.dmg, speed: T.speed, splash: T.splash, spread: 0.02, life: T.life });
      const tp = G.proj[G.proj.length - 1]; tp.ult = 1;   // Ulti-Torpedos verletzen dich selbst nicht
      if (best) tp.home = best.id;   // zielsuchend: verfolgt diesen Gegner
      if (--p.salvo.n <= 0) p.salvo = null; else p.salvo.next = G.time + 0.25;
    }
    if (!on) continue;
    if (p.suit === 'bulwark' && G.time >= (p.pushT || 0)) {   // Festung: alle 0,5 s wegstoßen, wer zu nah ist
      p.pushT = G.time + 0.5;
      for (const q of foesNear(p, p.x, p.y, p.z, U.push + SUITS[p.suit].r)) { const dx = q.x - p.x, dy = q.y - p.y, dz = q.z - p.z, l = Math.hypot(dx, dy, dz) || 1; pushAway(q, dx / l * 16, dy / l * 16 + 2, dz / l * 16); }
    }
    if (p.suit === 'barrakuda' && p.rammed) {   // Rammstoß: jeden Gegner, den man berührt, einmal treffen
      for (const q of foesNear(p, p.x, p.y, p.z, 4)) {
        if (p.rammed.has(q.id) || dist(p, q) > SUITS[p.suit].r + SUITS[q.suit].r + 0.8) continue;
        p.rammed.add(q.id);
        const dx = q.x - p.x, dy = q.y - p.y, dz = q.z - p.z, l = Math.hypot(dx, dy, dz) || 1;
        pushAway(q, dx / l * 20, dy / l * 20 + 3, dz / l * 20); damage(q, U.dmg, p, 'ram', p.x, p.z);
        ev('boom', 0, r2(q.x), r2(q.y), r2(q.z), 2);   // Rumms: kleine Druckwolke
      }
    }
  }
}
function gadgetTick() {
  // Köder: Haie in der Nähe stürzen sich auf Gegner am Köder
  G.baits = (G.baits || []).filter(b => G.time < b.until);
  for (const b of G.baits) for (const c of G.creatures) {
    if (c.type !== 'shark' || c.dead || c.state === 'hunt' || Math.hypot(c.x - b.x, c.y - b.y, c.z - b.z) > 160) continue;
    const q = [...G.players.values()].find(q => q.id !== b.o && q.alive && !q.veh && Math.hypot(q.x - b.x, q.y - b.y, q.z - b.z) < 16);
    if (q) { c.state = 'hunt'; c.tid = q.id; if (!q.bot) q.ye.push(['warn', 'Haie wittern den Köder – weg hier!']); }
  }
  // Drohnen: schießen auf den nächsten Gegner in Reichweite, den sie sehen können
  G.drones = (G.drones || []).filter(dr => { const o = G.players.get(dr.o); return o && o.alive && G.time < dr.until; });
  for (const dr of G.drones) {
    if (G.time < dr.next) continue;
    const o = G.players.get(dr.o), g = GADGETS[gadgetOf('nautilus')], W = G.world;
    const fx = o.x + Math.cos(o.yaw) * 0.9, fy = o.y + 0.9, fz = o.z - Math.sin(o.yaw) * 0.9;
    let best = null, bd = g.range;
    for (const q of foesNear(o, fx, fy, fz, g.range)) {
      const dd = Math.hypot(q.x - fx, q.y - fy, q.z - fz);
      if (dd < bd && W.segmentHit(fx, fy, fz, q.x, q.y, q.z) < 0) { bd = dd; best = q; }
    }
    if (!best) continue;
    dr.next = G.time + 0.55;
    const def = WEAPONS.pistol, dx = (best.x - fx) / bd, dy = (best.y - fy) / bd, dz = (best.z - fz) / bd;
    const pr = { id: nextId++, o: o.id, wid: 'pistol', x: fx, y: fy, z: fz, dx, dy, dz, sp: def.range * 1.3, life: 1, dmg: def.dmg * g.dmg, splash: 0, veh: 0 };
    const end = moveProj(pr, 1);
    ev('beam', 0, -o.id, r2(fx), r2(fy), r2(fz), r2(end[0]), r2(end[1]), r2(end[2]));   // negative Nummer = die Drohne schießt (nicht die Waffe)
  }
}
function explode(pr, x, y, z) {
  const owner = G.players.get(pr.o);
  ev('boom', pr.id, r2(x), r2(y), r2(z), pr.splash);
  const fall = (d) => pr.dmg * (1 - 0.7 * d / pr.splash);
  if (G.mode !== 'exp') for (const q of G.players.values()) {   // expedition is co-op: explosions never hurt divers
    if (!q.alive || (pr.ult && q === owner)) continue;
    const d = Math.sqrt((q.x - x) ** 2 + (q.y - y) ** 2 + (q.z - z) ** 2) - SUITS[q.suit].r;
    if (d < pr.splash) damage(q, fall(Math.max(0, d)) * (q === owner ? 0.5 : 1), owner, 'p', x, z);
  }
  for (const v of [...G.vehicles.values()]) {
    if (v.type !== 'sub' || v.driver) continue;   // driven subs are damaged through their driver
    const d = dist(v, { x, y, z }) - 3;
    if (d < pr.splash) damageVehicle(v, fall(Math.max(0, d)), owner);
  }
  for (const c of G.creatures) {
    if (c.dead) continue;
    const d = dist(c, { x, y, z }) - creatureR(c.type, c.sub);
    if (d < pr.splash) damageCreature(c, fall(Math.max(0, d)), owner);
  }
}
function stepProjectiles(dt) {
  // zielsuchende Torpedos (Torpedo-Salve): drehen sich jedes Mal ein Stück zum Ziel (turn = Grad-Lenkung pro Sekunde in Bogenmaß)
  for (const pr of G.proj) {
    if (!pr.home) continue;
    const t = G.players.get(pr.home); if (!t || !t.alive) { pr.home = 0; continue; }
    const tx = t.x - pr.x, ty = t.y + 0.3 - pr.y, tz = t.z - pr.z, tl = Math.hypot(tx, ty, tz) || 1, k = Math.min(1, ULTIS.triton.turn * dt);
    if (tl < ULTIS.triton.fuse) { explode(pr, pr.x, pr.y, pr.z); pr.dead = true; continue; }   // Annäherungszünder: nah genug dran = Bumm
    pr.dx += (tx / tl - pr.dx) * k; pr.dy += (ty / tl - pr.dy) * k; pr.dz += (tz / tl - pr.dz) * k;
    const l = Math.hypot(pr.dx, pr.dy, pr.dz) || 1; pr.dx /= l; pr.dy /= l; pr.dz /= l;
  }
  for (const pr of G.proj) moveProj(pr, dt);
  G.proj = G.proj.filter(p => !p.dead);
}
// moves one projectile for dt seconds and returns where it is now (or the point where it hit something)
function moveProj(pr, dt) {
  const W = G.world;
  const sx = pr.dx * pr.sp * dt, sy = pr.dy * pr.sp * dt, sz = pr.dz * pr.sp * dt;
  let best = W.segmentHit(pr.x, pr.y, pr.z, pr.x + sx, pr.y + sy, pr.z + sz), hit = null, kind = 0;
  if (best < 0) best = 2;
  for (const q of G.players.values()) {
    if (!q.alive || q.id === pr.o) continue;
    const inSub = q.veh && G.vehicles.get(q.veh)?.type === 'sub';
    if (inSub) continue;
    const help = pr.aim && pr.aim[0] === 1 && pr.aim[1] === q.id ? AIM_HELP : 0;
    const t = segSphere(pr.x, pr.y, pr.z, sx, sy, sz, q.x, q.y, q.z, SUITS[q.suit].r * 1.05 + help);
    if (t >= 0 && t < best) { best = t; hit = q; kind = 1; }
  }
  for (const v of G.vehicles.values()) {
    if (v.type !== 'sub' || v.id === pr.veh) continue;
    const t = segSphere(pr.x, pr.y, pr.z, sx, sy, sz, v.x, v.y, v.z, 3);
    if (t >= 0 && t < best) { best = t; hit = v; kind = 2; }
  }
  for (const c of G.creatures) {
    if (c.dead) continue;
    const help = pr.aim && pr.aim[0] === 3 && pr.aim[1] === c.id ? AIM_HELP : 0;
    const t = segSphere(pr.x, pr.y, pr.z, sx, sy, sz, c.x, c.y, c.z, creatureR(c.type, c.sub) + help);
    if (t >= 0 && t < best) { best = t; hit = c; kind = 3; }
  }
  const owner = G.players.get(pr.o);
  if (best <= 1) {
    const hx = pr.x + sx * best, hy = pr.y + sy * best, hz = pr.z + sz * best;
    pr.dead = true;
    if (pr.splash) explode(pr, hx, hy, hz);
    else {
      ev('hit', pr.id, r2(hx), r2(hy), r2(hz), kind);
      if (kind === 1) { damage(hit, pr.dmg, owner, 'p', pr.x, pr.z); if (hit.alive) hitEffects(hit, WEAPONS[pr.wid]); }
      else if (kind === 2) { const d = hit.driver && G.players.get(hit.driver); if (d) damage(d, pr.dmg, owner, 'p', pr.x, pr.z); else damageVehicle(hit, pr.dmg, owner); }
      else if (kind === 3) damageCreature(hit, pr.dmg, owner);
    }
    return [hx, hy, hz];
  }
  pr.x += sx; pr.y += sy; pr.z += sz; pr.life -= dt;
  if (pr.life <= 0) { pr.dead = true; if (pr.splash) explode(pr, pr.x, pr.y, pr.z); }
  return [pr.x, pr.y, pr.z];
}

// ---------- loot / interaction ----------
function openCrate(i) {
  const c = G.crates[i];
  if (!c || c.open) return;
  c.open = true; ev('crate', i);
  const drop = (k, wid, rar) => { const a = rnd() * 6.283; addPickup(k, c.x + Math.cos(a) * 1.8, c.y + 1.2 + rnd() * 0.6, c.z + Math.sin(a) * 1.8, wid, rar); };
  drop('w', rollWeapon(), rollRarity(0.05));
  if (rnd() < 0.65) drop(rnd() < 0.5 ? 'med' : 'sh');
  if (rnd() < 0.35) drop('w', rollWeapon(), rollRarity(0));
}
const wScore = (w) => w ? W_SCORE[w.id] * RARITY[w.rar].mul : 0;
const pkScore = (pk) => W_SCORE[pk.wid] * RARITY[pk.rar].mul;
function takeWeapon(p, pk, slot) {
  const old = p.weapons[slot];
  if (old) addPickup('w', p.x, p.y + 0.3, p.z, old.id, old.rar, old.ammo, old.spare);
  p.weapons[slot] = newWeapon(pk.wid, pk.rar, pk.ammo, pk.spare);
  p.slot = slot; p.reload = 0;
  removePickup(pk);
  if (!p.bot) p.ye.push(['got', pk.k, pk.wid, pk.rar]);
}
function autoCollect(p) {
  const S = SUITS[p.suit], reach = S.r + 2.2;
  for (const pk of G.pickups.values()) {
    const dx = pk.x - p.x, dy = pk.y - p.y, dz = pk.z - p.z;
    if (dx * dx + dy * dy + dz * dz > reach * reach) continue;
    if (pk.k === 'med') { if (p.hp < p.maxhp) { p.hp = Math.min(p.maxhp, p.hp + 50); removePickup(pk); if (!p.bot) p.ye.push(['got', 'med', '', 0]); } }
    else if (pk.k === 'sh') { if (p.shield < 100) { p.shield = Math.min(100, p.shield + 50); removePickup(pk); if (!p.bot) p.ye.push(['got', 'sh', '', 0]); } }
    else {
      const freeSlot = p.weapons.indexOf(null);
      const dupe = p.weapons.some(w => w && w.id === pk.wid && w.rar >= pk.rar);
      if (dupe) continue;
      if (freeSlot >= 0) takeWeapon(p, pk, freeSlot);
      else if (p.bot) {
        let worst = 0; for (let i = 1; i < 3; i++) if (wScore(p.weapons[i]) < wScore(p.weapons[worst])) worst = i;
        if (pkScore(pk) > wScore(p.weapons[worst]) * 1.15) takeWeapon(p, pk, worst);
      }
    }
  }
}
function interact(p) {
  if (!p.alive) return;
  if (p.veh) { const v = G.vehicles.get(p.veh); if (v) { if (v.gunner === p.id) v.gunner = 0; else v.driver = 0; } p.veh = 0; return; }
  const S = SUITS[p.suit];
  let best = null, bd = 1e9;
  for (const pk of G.pickups.values()) if (pk.k === 'w') { const d = dist(p, pk); if (d < S.r + 3.5 && d < bd) { bd = d; best = { k: 'pk', pk }; } }
  G.crates.forEach((c, i) => { if (!c.open) { const d = dist(p, c); if (d < S.r + 4.5 && d < bd) { bd = d; best = { k: 'crate', i }; } } });
  if (!S.mech && !p.grabbed) for (const v of G.vehicles.values()) {
    const d = dist(p, v) - (v.type === 'sub' ? 2 : 0); if (d >= S.r + 4.5 || d >= bd) continue;
    if (!v.driver && !v.gunner) { bd = d; best = { k: v.type === 'sub' && p.y < v.y - 1.2 ? 'gun' : 'veh', v }; }   // unter dem U-Boot: gleich in die MG-Kugel
    else if (!v.driver && v.type === 'sub' && v.gunner && p.y >= v.y - 1.2) { bd = d; best = { k: 'veh', v }; }   // jemand sitzt schon in der Kugel: ans Steuer
    // 2-Mann-U-Boot: fährt dein Teamkamerad, kannst du unten in die MG-Kugel steigen
    else if (v.type === 'sub' && !v.gunner && p.team && (G.players.get(v.driver) || {}).team === p.team) { bd = d; best = { k: 'gun', v }; }
  }
  if (!best) return;
  if (best.k === 'pk') takeWeapon(p, best.pk, p.slot);
  else if (best.k === 'crate') openCrate(best.i);
  else if (best.k === 'gun') { best.v.gunner = p.id; p.veh = best.v.id; }
  else { best.v.driver = p.id; p.veh = best.v.id; }
}
function releaseOcto(o) {
  const p = G.players.get(o.tid);
  if (p && p.grabbed === o.id) p.grabbed = 0;
  o.state = 'return'; o.cool = 10; o.tid = 0;
}
function struggle(p) {
  if (!p.grabbed) return;
  const o = G.creatures.find(c => c.id === p.grabbed);
  if (o) o.grip -= 9;
}

// ---------- creatures ----------
function steer(c, tx, ty, tz, speed, dt, r) {
  let dx = tx - c.x, dy = ty - c.y, dz = tz - c.z;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  const k = Math.min(1, 2.5 * dt);
  c.vx += (dx / d * speed - c.vx) * k; c.vy += (dy / d * speed - c.vy) * k; c.vz += (dz / d * speed - c.vz) * k;
  c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
  G.world.collide(c, r);
  const h = Math.sqrt(c.vx * c.vx + c.vz * c.vz);
  if (h > 0.3) { c.yaw = Math.atan2(-c.vx, -c.vz); c.pitch = Math.atan2(c.vy, h); }
  return d;
}
const los = (a, b) => G.world.segmentHit(a.x, a.y, a.z, b.x, b.y, b.z) < 0;
const inSub = (p) => p.veh && G.vehicles.get(p.veh)?.type === 'sub';

function sharkStep(c, dt) {
  const W = G.world;
  if (c.state === 'patrol') {
    if (!c.wp || dist(c, c.wp) < 7) { const z = G.zone, s = randSpot(Math.min(250 * MAP_K, Math.max(40, z.r)), 6 + rnd() * 28); c.wp = { x: clamp(s.x + z.x, -LIM, LIM), y: s.y, z: clamp(s.z + z.z, -LIM, LIM) }; }
    steer(c, c.wp.x, c.wp.y, c.wp.z, 5.5, dt, 1.2);
    c.scanT -= dt;
    if (c.scanT <= 0 && (G.time > 35 || c.wave)) {
      c.scanT = 0.5;
      let best = null, bd = 1e9;
      for (const p of G.players.values()) {
        if (!p.alive) continue;
        const d = dist(c, p), range = c.wave ? 600 : (p.hp < p.maxhp * 0.5 ? 70 : 36) * (inSub(p) ? 0.5 : 1);
        if (d < range && d < bd && los(c, p)) { bd = d; best = p; }
      }
      if (best) { c.state = 'hunt'; c.tid = best.id; if (!best.bot) best.ye.push(['warn', 'Ein Hai hat dich gewittert!']); }
    }
  } else if (c.state === 'hunt') {
    const p = G.players.get(c.tid);
    if (!p || !p.alive || (!c.wave && (dist(c, p) > 85 || c.hp < 25))) { c.state = 'patrol'; c.wp = null; c.scanT = 0; return; }
    const d = steer(c, p.x, p.y, p.z, 14.5, dt, 1.2);
    const reach = (inSub(p) ? 3 : SUITS[p.suit].r) + 1.8;
    if (d < reach) {
      ev('bite', r2(p.x), r2(p.y), r2(p.z));
      damage(p, c.dmg || 18, null, 'shark', c.x, c.z);
      c.state = 'retreat'; c.t = 2.4;
      const ax = c.x - p.x, az = c.z - p.z, al = Math.sqrt(ax * ax + az * az) || 1;
      c.rp = { x: c.x + ax / al * 30 + (rnd() - 0.5) * 20, y: Math.min(SURFACE - (G.mode === 'exp' ? 8 : DEEP.brCeil + 3), c.y + 8), z: c.z + az / al * 30 + (rnd() - 0.5) * 20 };
    }
  } else {
    c.t -= dt;
    steer(c, c.rp.x, c.rp.y, c.rp.z, 10, dt, 1.2);
    if (c.t <= 0) { if (++c.bites >= 2 || rnd() < 0.35) { c.state = 'patrol'; c.wp = null; c.bites = 0; c.scanT = 10 + rnd() * 8; } else c.state = 'hunt'; }
  }
  const g = W.heightAt(c.x, c.z) + 2.5;
  if (c.y < g) c.y = g;
}
function octoStep(c, dt) {
  const L = c.lair;
  if (c.state === 'lurk') {
    c.cool -= dt; c.scanT -= dt;
    c.vx = c.vy = c.vz = 0;
    if (c.cool <= 0 && c.scanT <= 0) {
      c.scanT = 0.3;
      let best = null, bd = 13;
      for (const p of G.players.values()) {
        if (!p.alive || p.grabbed || SUITS[p.suit].mech || inSub(p)) continue;
        const d = dist(c, p);
        if (d < bd) { bd = d; best = p; }
      }
      if (best) { c.state = 'lunge'; c.tid = best.id; }
    }
  } else if (c.state === 'lunge') {
    const p = G.players.get(c.tid);
    if (!p || !p.alive || p.grabbed || inSub(p) || dist(c, L) > 30) { c.state = 'return'; c.cool = 5; return; }
    const d = steer(c, p.x, p.y, p.z, 13, dt, 1.0);
    if (d < SUITS[p.suit].r + 1.3) {
      c.state = 'hold'; c.grip = 45; c.acc = 0; p.grabbed = c.id; p.ink = 3.5;
      ev('ink', r2(p.x), r2(p.y), r2(p.z));
      if (!p.bot) p.ye.push(['grab']);
    }
  } else if (c.state === 'hold') {
    const p = G.players.get(c.tid);
    if (!p || !p.alive || p.grabbed !== c.id || c.grip <= 0 || inSub(p)) { releaseOcto(c); return; }
    c.x = p.x; c.y = p.y - 0.4; c.z = p.z; c.yaw = p.yaw; c.pitch = 0;
    c.acc += 6 * dt;
    if (c.acc >= 3) { c.acc -= 3; damage(p, 3, null, 'octo', c.x, c.z); }
  } else {
    const d = steer(c, L.x, L.y, L.z, 6, dt, 1.0);
    c.cool -= dt;
    if (d < 2) { c.state = 'lurk'; c.pitch = 0; }
  }
}
function jellyStep(c) {
  const t = G.time, s = c.sw;
  c.x = s.x + Math.cos(t * 0.05 + c.sph) * 25 + c.ox;
  c.z = s.z + Math.sin(t * 0.05 + c.sph) * 25 + c.oz;
  c.y = Math.max(G.world.heightAt(c.x, c.z) + 3, s.y + c.oy + Math.sin(t * 0.7 + c.ph) * 1.6);
  for (const p of G.players.values()) {
    if (!p.alive || inSub(p) || G.time < p.shockT) continue;
    const rr = SUITS[p.suit].r + 1.2;
    if ((p.x - c.x) ** 2 + (p.y - c.y) ** 2 + (p.z - c.z) ** 2 < rr * rr) {
      p.shockT = G.time + 0.8;
      if (!p.bot) p.ye.push(['shock']);
      damage(p, 8, null, 'jelly', c.x, c.z);
    }
  }
}

// ---------- bots ----------
function botThink(b) {
  const W = G.world, z = G.zone, S = SUITS[b.suit];
  // target acquisition
  let best = null, bd = G.time < 30 ? 0 : 30;
  // bots fight each other in short bursts with breaks in between, so rounds last long enough for humans
  const cur = b.target && b.target.k === 'p' ? b.target.ref : null;
  if (cur && cur.bot && G.time > b.fightUntil) { b.target = null; b.peaceUntil = G.time + 7 + rnd() * 9; }
  if (cur && G.time < (cur.invisT || 0)) b.target = null;   // Ziel hat sich getarnt
  const peace = G.time < b.peaceUntil;
  for (const p of G.players.values()) {
    if (p === b || !p.alive || (peace && p.bot) || G.time < (p.invisT || 0) || (b.team && p.team === b.team)) continue;   // nie den Teamkameraden   // Getarnte sieht der Bot nicht
    const d = dist(b, p);
    if (d < bd && los(b, p)) { bd = d; best = { k: 'p', ref: p }; }
  }
  for (const c of G.creatures) {
    if (c.dead) continue;
    const mine = (c.type === 'shark' && c.tid === b.id && c.state !== 'patrol') || (c.type === 'octo' && c.state === 'lunge' && c.tid === b.id) || (c.wave && dist(b, c) < 45);   // Wellen: jeder Hai in der Nähe
    if (!mine) continue;
    const d = dist(b, c);
    if (d < 24 && d < bd + 10) { bd = d; best = { k: 'c', ref: c }; }
  }
  const prev = b.target;
  if (best && (!prev || prev.ref !== best.ref)) { b.reactT = 0.6 + rnd() * 0.7; if (best.k === 'p' && best.ref.bot) b.fightUntil = G.time + 5 + rnd() * 4; }
  if (best || !prev || !targetOk(prev) || dist(b, prev.ref) > 60) b.target = best;
  // choose weapon for the range
  if (b.target) {
    const d = dist(b, b.target.ref); let bi = b.slot, bs = -1;
    b.weapons.forEach((w, i) => {
      if (!w) return;
      let s = wScore(w);
      if (w.id === 'scatter') s *= d < 14 ? 1.6 : d > 25 ? 0.3 : 1;
      if (w.id === 'harpoon') s *= d > 25 ? 1.4 : 1;
      if (w.id === 'torpedo') s *= d < 10 ? 0.2 : 1;
      if (s > bs) { bs = s; bi = i; }
    });
    if (bi !== b.slot && b.reload <= 0) b.slot = bi;
  }
  // zone awareness
  const tz = z.nr > 0 ? { x: z.nx, z: z.nz, r: z.nr } : { x: z.x, z: z.z, r: Math.max(z.r, 4) };
  const P = PHASES[z.ph];
  const tLeft = P ? (z.sh ? 0 : P.wait - z.t) : 0;
  const outNow = dist2d(b, z.x, z.z) > z.r - 8;
  if (outNow || (dist2d(b, tz.x, tz.z) > tz.r * 0.8 && (z.sh || tLeft < 25))) {
    b.mode = 'zone';
    const a = rnd() * 6.283, d = tz.r * 0.35 * rnd();
    const x = tz.x + Math.cos(a) * d, zz = tz.z + Math.sin(a) * d;
    if (!b.goal || !b.goal.zone) b.goal = { x, y: W.heightAt(x, zz) + 5 + rnd() * 8, z: zz, zone: true };
    return;
  }
  if (b.mode === 'zone') { b.mode = 'loot'; b.goal = null; }
  if (b.target) return;
  // loot
  const have = b.weapons.filter(Boolean).length;
  let goal = null, gd = 1e9; b.crate = -1;
  const inNext = (o) => dist2d(o, tz.x, tz.z) < tz.r;
  for (const pk of G.pickups.values()) {
    const want = pk.k === 'med' ? b.hp < b.maxhp * 0.75 : pk.k === 'sh' ? b.shield < 60
      : (have < 3 || pkScore(pk) > Math.min(...b.weapons.map(wScore)) * 1.15);
    if (!want || !inNext(pk)) continue;
    const d = dist(b, pk);
    if (d < 70 && d < gd) { gd = d; goal = { x: pk.x, y: pk.y, z: pk.z }; }
  }
  if (!goal && (have < 3 || b.shield < 50)) G.crates.forEach((c, i) => {
    if (c.open || !inNext(c)) return;
    const d = dist(b, c);
    if (d < 160 && d < gd) { gd = d; goal = { x: c.x, y: c.y + 1.2, z: c.z }; b.crate = i; }
  });
  if (goal) { b.goal = goal; if (b.crate >= 0 && gd < S.r + 4) openCrate(b.crate); return; }
  if (!b.goal || b.goal.zone || dist(b, b.goal) < 4) {
    const a = rnd() * 6.283, d = tz.r * 0.7 * Math.sqrt(rnd());
    const x = clamp(tz.x + Math.cos(a) * d, -LIM, LIM), zz = clamp(tz.z + Math.sin(a) * d, -LIM, LIM);
    b.goal = { x, y: W.heightAt(x, zz) + 4 + rnd() * 12, z: zz };
  }
}
const targetOk = (T) => T && (T.k === 'p' ? T.ref.alive : !T.ref.dead);
function botStep(b, dt) {
  const W = G.world, S = SUITS[b.suit];
  if (b.grabbed) { b.strT -= dt; if (b.strT <= 0) { struggle(b); b.strT = 0.35; } }
  b.thinkT -= dt;
  if (b.thinkT <= 0) { b.thinkT = 0.25 + rnd() * 0.15; botThink(b); }
  if (!targetOk(b.target)) b.target = null;
  const tgt = b.target ? b.target.ref : null;
  let gx = b.x, gy = b.y, gz = b.z;
  if (tgt && b.mode !== 'zone') {
    const dx = tgt.x - b.x, dy = tgt.y - b.y, dz = tgt.z - b.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1, dh = Math.sqrt(dx * dx + dz * dz) || 1;
    const w = b.weapons[b.slot], pref = w ? W_PREF[w.id] : 15;
    const s = Math.sin(G.time * 0.9 + b.phase) * 7;
    gx = tgt.x - dx / d * pref + (-dz / dh) * s; gz = tgt.z - dz / d * pref + (dx / dh) * s;
    gy = tgt.y - dy / d * pref * 0.3 + Math.cos(G.time * 0.7 + b.phase) * 3;
  } else if (b.goal) { gx = b.goal.x; gy = b.goal.y; gz = b.goal.z; }
  let dx = gx - b.x, dy = gy - b.y, dz = gz - b.z;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (d > 1) { dx /= d; dy /= d; dz /= d; } else { dx = dy = dz = 0; }
  if (b.y < W.heightAt(b.x, b.z) + S.r + 1.5) dy += 0.7;
  const sp = S.speed * (b.mode === 'zone' ? S.boost * 0.9 : 1) * (b.grabbed ? 0.3 : 1) * (G.time < b.shockT ? 0.5 : 1) * (G.time < (b.empT || 0) ? 0 : 1);   // Magnet-Treffer: komplett lahm
  b.boost = b.mode === 'zone';
  const k = Math.min(1, 4 * dt);
  b.vx += (dx * sp - b.vx) * k; b.vy += (dy * sp - b.vy) * k; b.vz += (dz * sp - b.vz) * k;
  const ox = b.x, oy = b.y, oz = b.z;
  b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  W.collide(b, S.r, G.mode === 'exp' ? undefined : SURFACE - DEEP.brCeil);   // im Battle Royale bleiben auch Bots unter der Tiefsee-Grenze
  const moved = Math.sqrt((b.x - ox) ** 2 + (b.y - oy) ** 2 + (b.z - oz) ** 2);
  if (d > 3 && moved < sp * dt * 0.25) {
    b.stuckT += dt;
    if (b.stuckT > 1) { b.stuckT = 0; if (b.goal) b.goal.y = Math.min(SURFACE - DEEP.brCeil - 3, b.goal.y + 12); b.vy += 6; }
  } else b.stuckT = Math.max(0, b.stuckT - dt);
  // facing + fire
  if (tgt) {
    const ax = tgt.x - b.x, ay = tgt.y - b.y, az = tgt.z - b.z, ad = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
    b.yaw = Math.atan2(-ax, -az); b.pitch = Math.asin(clamp(ay / ad, -1, 1));
    b.reactT -= dt;
    const w = b.weapons[b.slot];
    if (w && b.reactT <= 0 && ad < Math.min(42, WEAPONS[w.id].range * 0.9) && G.time >= b.nextFire && G.time >= b.holdT && b.reload <= 0) {
      const def = WEAPONS[w.id], tt = ad / def.speed, e = b.skill;
      // bots only half-predict where you are going, so moving targets are harder for them to hit.
      // Hitscan trifft sofort: dann zielen Bots dorthin, wo du gerade eben warst (Reaktionszeit), sonst wären sie zu gut.
      const lead = def.hitscan ? -(0.08 + rnd() * 0.15) : tt * (0.3 + rnd() * 0.4);
      const px = tgt.x + (tgt.vx || 0) * lead - b.x, py = tgt.y + (tgt.vy || 0) * lead - (b.y + eyeHeight(b.suit)), pz = tgt.z + (tgt.vz || 0) * lead - b.z;   // von Augenhöhe aus zielen (da startet der Schuss)
      const pl = Math.sqrt(px * px + py * py + pz * pz) || 1;
      fire(b, [px / pl + (rnd() + rnd() - 1) * e, py / pl + (rnd() + rnd() - 1) * e, pz / pl + (rnd() + rnd() - 1) * e]);
      b.burst++;
      // Hitze: an der Schmerzgrenze warten, bis die Waffe abgekühlt ist (manchmal übertreiben sie es aber, wie echte Spieler)
      if (b.greed == null) b.greed = rnd() < 0.25 ? 1 + Math.floor(rnd() * 2) : 0;
      if ((w.heat || 0) >= heatStart(def.mag) + b.greed) { b.holdT = G.time + HEAT.pause + 0.2 + rnd() * 0.6; b.burst = 0; b.greed = null; }
      else if (def.rate > 5 && b.burst >= 6 + rnd() * 6) { b.holdT = G.time + 0.5 + rnd(); b.burst = 0; }
      else b.holdT = G.time + rnd() * 0.15;
    }
  } else {
    const h = Math.sqrt(b.vx * b.vx + b.vz * b.vz);
    if (h > 0.5) { b.yaw = Math.atan2(-b.vx, -b.vz); b.pitch = Math.atan2(b.vy, h); }
    const w = b.weapons[b.slot];
    if (w && w.ammo < WEAPONS[w.id].mag * 0.5) startReload(b);
  }
}

// =====================================================================
// ---------- Tiefsee-Expedition ----------
// Dive, hunt fish, sell them at the boat, buy better gear, beat a boss
// on every floor. Progress is saved per player name in saves/.
// =====================================================================
const SAVE_FILE = path.join(DIR, 'saves', 'expedition.json');
let saves = {};
try { saves = JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8')); } catch { saves = {}; }
let saveTimer = null;
const saveKey = (name) => name.toLowerCase();
function storeProgress(p) {
  saves[saveKey(p.name)] = { money: p.money, tank: p.tank, lung: p.lung, lamp: p.lamp, bag: p.bag, aq: p.aq, aqLvl: p.aqLvl, base: p.baseIdx, last: Date.now(),
    weapons: p.weapons.map(w => w ? { id: w.id, rar: w.rar } : null) };
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    fs.mkdir(path.dirname(SAVE_FILE), { recursive: true }, () =>
      fs.writeFile(SAVE_FILE, JSON.stringify(saves, null, 1), (e) => { if (e) console.error('[save]', e.message); }));
  }, 1000);
}
// Battle-Royale-Konto: Perlen pro Spielername (getrennt vom Expeditions-Geld)
const BR_FILE = path.join(DIR, 'saves', 'battleroyale.json');
let brSaves = {};
try { brSaves = JSON.parse(fs.readFileSync(BR_FILE, 'utf8')); } catch { brSaves = {}; }
const pearlsOf = (name) => brSaves[saveKey(name)]?.pearls || 0;
const upsOf = (name) => ({ ...(brSaves[saveKey(name)]?.up || {}) });   // gekaufte Verbesserungen { reload: 2, ... }
const saveBr = () => fs.mkdir(path.dirname(BR_FILE), { recursive: true }, () =>
  fs.writeFile(BR_FILE, JSON.stringify(brSaves, null, 1), (e) => { if (e) console.error('[save]', e.message); }));
function addPearls(name, amt) {
  const s = brSaves[saveKey(name)] ||= { pearls: 0 };
  s.pearls += amt; s.last = Date.now();
  saveBr();
  return s.pearls;
}
const suitsOf = (name) => [...(brSaves[saveKey(name)]?.suits || [])];   // gekaufte Taucher
const gadsOf = (name) => [...(brSaves[saveKey(name)]?.gads || [])];     // gekaufte Gadgets
const wepsOf = (name) => [...(brSaves[saveKey(name)]?.weps || [])];     // gekaufte Startwaffen
const attsOf = (name) => [...(brSaves[saveKey(name)]?.atts || [])];     // gekaufte Aufsätze: ['needler:mag', …]
const loadOf = (name) => ({ ...(brSaves[saveKey(name)]?.load || {}) });  // Ausrüstung pro Taucher: { triton: { wep: 'scatter', gad: true }, … }
// Ausrüstung eines Tauchers speichern (nur gekaufte Sachen): wep = Startwaffe (null = seine eigene), gad = Gadget mitnehmen
function setLoadout(c, m) {
  if (!SUITS[m.suit]) return;
  const s = brSaves[saveKey(c.name)] ||= { pearls: 0 };
  const L = (s.load ||= {})[m.suit] ||= {};
  if (m.wep === null || (BR_WEAPONS.some(w => w.wid === m.wep) && (m.wep === 'pistol' || (s.weps || []).includes(m.wep)))) L.wep = m.wep;
  if (typeof m.gad === 'boolean') L.gad = m.gad;
  // Aufsätze für eine Waffe: nur gekaufte, passende, einer pro Platz
  if (typeof m.modsFor === 'string' && WEAPONS[m.modsFor] && Array.isArray(m.mods)) {
    const owned = s.atts || [], used = new Set(), ok = [];
    for (const k of m.mods) { const A = ATTACHMENTS.find(a => a.k === k); if (A && A.for.includes(m.modsFor) && owned.includes(m.modsFor + ':' + k) && !used.has(A.slot)) { used.add(A.slot); ok.push(k); } }
    (L.mods ||= {})[m.modsFor] = ok;
  }
  saveBr();
}
// Im Perlen-Shop kaufen (nur in der Lobby): k = Verbesserung (nächste Stufe) oder 'suit:name' (Taucher freischalten)
function brBuy(c, k) {
  const s = brSaves[saveKey(c.name)] ||= { pearls: 0 };
  if (typeof k === 'string' && k.startsWith('suit:')) {
    const id = k.slice(5), S = SUITS[id];
    if (!S || !S.price || (s.suits || []).includes(id) || (s.pearls || 0) < S.price) return;
    s.pearls -= S.price; (s.suits ||= []).push(id); s.last = Date.now(); c.suit = id;   // gleich auswählen
    saveBr(); return;
  }
  if (typeof k === 'string' && k.startsWith('att:')) {   // Aufsatz für eine Waffe: 'att:needler:mag'
    const [, wid, ak] = k.split(':'), A = ATTACHMENTS.find(a => a.k === ak), key = wid + ':' + ak;
    if (!A || !A.for.includes(wid) || (s.atts || []).includes(key) || (s.pearls || 0) < A.price) return;
    s.pearls -= A.price; (s.atts ||= []).push(key); s.last = Date.now();
    saveBr(); return;
  }
  if (typeof k === 'string' && k.startsWith('wep:')) {
    const W0 = BR_WEAPONS.find(x => x.wid === k.slice(4));
    if (!W0 || !W0.price || (s.weps || []).includes(W0.wid) || (s.pearls || 0) < W0.price) return;
    s.pearls -= W0.price; (s.weps ||= []).push(W0.wid); s.last = Date.now();
    saveBr(); return;
  }
  if (typeof k === 'string' && k.startsWith('gad:')) {
    const G0 = GADGETS.find(x => x.k === k.slice(4));
    if (!G0 || (s.gads || []).includes(G0.k) || (s.pearls || 0) < G0.price) return;
    s.pearls -= G0.price; (s.gads ||= []).push(G0.k); s.last = Date.now();
    saveBr(); return;
  }
  const u = BR_UPGRADES.find(x => x.k === k); if (!u) return;
  s.up ||= {};
  const lvl = s.up[k] | 0, price = u.price[lvl];
  if (price == null || (s.pearls || 0) < price) return;
  s.pearls -= price; s.up[k] = lvl + 1; s.last = Date.now();
  saveBr();
}
const depthOf = (o) => SURFACE - o.y;
const nearBoat = (p, r = 16, d = 6) => dist2d(p, EXP_BOAT.x, EXP_BOAT.z) < r && depthOf(p) < d;
// the underwater base with the aquarium and an air station
const nearBase = (p, r = 16) => !!G.world.bases && G.world.bases.some(b => dist(p, b.c) < r);   // any base: air station
const nearOwnBase = (p, r = 16) => !!G.world.bases && p.baseIdx != null && dist(p, G.world.bases[p.baseIdx].c) < r;
const baseOwner = (i) => [...G.players.values()].find(q => q.baseIdx === i);
// every diver gets an own base (their saved one if it is free, otherwise the first free one)
function pickBase(p, want) {
  const n = G.world.bases.length, taken = new Set([...G.players.values()].filter(q => q !== p).map(q => q.baseIdx));
  if (Number.isInteger(want) && want >= 0 && want < n && !taken.has(want)) return want;
  for (let i = 0; i < n; i++) if (!taken.has(i)) return i;
  return G.players.size % n;   // more than 6 divers: then two share one
}
// wake up in the water next to the ship (it is 24 m long along z, 7 m wide)
const boatSpawn = () => { const s = rnd() < 0.5 ? -1 : 1; return { x: EXP_BOAT.x + s * (6 + rnd() * 2), y: SURFACE - 2.5, z: EXP_BOAT.z + (rnd() - 0.5) * 12, yaw: s > 0 ? 1.57 : -1.57 }; };

function expJoin(c) {
  const p = mkPlayer(c.id, c.name, 'triton', false);
  const s = saves[saveKey(c.name)];
  p.money = s ? (s.money || 0) : EXP_START_MONEY;   // brand-new divers get starting money
  p.tank = clamp(s?.tank || 0, 0, TANKS.length - 1); p.lung = clamp(s?.lung || 0, 0, LUNGS.length - 1);
  p.lamp = clamp(s?.lamp || 0, 0, LAMPS.length - 1);
  // caught fish: { s: species, g: golden } (very old saves stored only the value)
  const fishList = (l) => Array.isArray(l) ? l.map(e => typeof e === 'number' ? { v: e } : e).filter(e => e && (e.v != null || (e.b != null ? BOSSES[e.b] : FISH[e.s]))) : [];
  p.bag = fishList(s?.bag);
  p.aq = fishList(s?.aq).filter(e => e.v == null); p.aqLvl = clamp(s?.aqLvl || 0, 0, AQUARIUM.sizes.length - 1); p.aqAcc = 0;
  // the aquarium only earns while you really play (no offline money, no AFK money)
  p.actT = G.time; p.act = null; p.afk = false;
  p.baseIdx = pickBase(p, s?.base);
  if (s?.weapons) p.weapons = s.weapons.map(w => w && WEAPONS[w.id] ? newWeapon(w.id, w.rar) : null);
  if (!p.weapons.some(Boolean)) p.weapons[0] = newWeapon(...(SUITS[p.suit].start || ['pistol', 0]));
  p.slot = Math.max(0, p.weapons.findIndex(Boolean));
  p.hp = p.maxhp = EXP_HP; p.air = TANKS[p.tank].cap; p.envAcc = 0; p.warnT = 0; p.respawnT = 0; p.lowAir = false;
  const s0 = boatSpawn(); p.x = p.lx = s0.x; p.y = p.ly = s0.y; p.z = p.lz = s0.z; p.yaw = s0.yaw; p.pitch = -0.3;
  G.players.set(p.id, p); c.playing = true;
  return p;
}
const metaMsg = () => ({ t: 'meta', players: [...G.players.values()].map(p => [p.id, p.name, p.suit, p.bot ? 1 : 0, p.team || 0]) });

function startExp() {
  const W = G.world;
  G.phase = 'play'; G.time = 0; G.noHumanT = 0;
  G.players = new Map(); G.proj = []; G.pickups = new Map(); G.events = []; G.crates = []; G.vehicles = new Map();
  G.creatures = []; G.zone = null;
  G.bossT = BOSSES.map(() => 0); G.fishT = FLOORS.map(() => 0);
  for (let i = 0; i < BOSSES.length; i++) spawnBoss(i);
  for (let f = 0; f < FLOORS.length; f++) for (let k = 0; k < FLOORS[f].fish; k++) spawnFish(f, true);
  for (const c of roomClients()) expJoin(c);
  for (const c of roomClients()) send(c.ws, startMsg(c));
  console.log(`[expedition] Liga ${G.league} started with ${roomClients().length} diver(s), seed ${G.seed}`);
}
function spawnBoss(i) {
  const B = BOSSES[i], L = G.world.bossLairs[i];
  G.creatures.push({ id: nextId++, type: 'boss', sub: i, x: L.x, y: L.y, z: L.z, vx: 0, vy: 0, vz: 0, yaw: rnd() * 6.28, pitch: 0,
    hp: B.hp, maxhp: B.hp, state: 'idle', lair: L, tid: 0, cool: 0, scanT: 0, t: 0, orb: rnd() * 6.28, dmgBy: new Set() });
}
function pickSpecies(f) {
  const list = FISH.map((s, i) => i).filter(i => FISH[i].floor === f);
  let t = rnd() * list.reduce((a, i) => a + FISH[i].w, 0);
  for (const i of list) if ((t -= FISH[i].w) < 0) return i;
  return list[0];
}
function waterSpot(f, near) {
  const F = FLOORS[f], W = G.world;
  for (let k = 0; k < 14; k++) {
    let x, z;
    if (near) { const a = rnd() * 6.283, d = 28 + rnd() * 40; x = near.x + Math.cos(a) * d; z = near.z + Math.sin(a) * d; }
    else { const a = rnd() * 6.283, d = Math.sqrt(rnd()) * Math.min(PLAY - 10, EXP_LEDGES[f][1] + 20); x = Math.cos(a) * d; z = Math.sin(a) * d; }
    if (Math.abs(x) > PLAY - 6 || Math.abs(z) > PLAY - 6) continue;
    const ground = W.heightAt(x, z), yTop = SURFACE - F.top - 3, yBot = Math.max(SURFACE - F.bot, ground + 2);
    if (yBot >= yTop) continue;
    return { x, y: yBot + rnd() * (yTop - yBot), z };
  }
  return null;
}
function spawnFish(f, initial) {
  // most fish appear around divers on that floor, the rest anywhere on the floor
  const divers = [...G.players.values()].filter(p => p.alive && floorAt(depthOf(p)) === f);
  const near = !initial && divers.length && rnd() < 0.65 ? pick(divers) : null;
  const s = waterSpot(f, near) || waterSpot(f, null);
  if (!s) return;
  const sub = pickSpecies(f), S = FISH[sub];
  G.creatures.push({ id: nextId++, type: 'fish', sub, gold: rnd() < GOLD_CHANCE, ...s, vx: 0, vy: 0, vz: 0, yaw: rnd() * 6.28, pitch: 0,
    hp: S.hp, maxhp: S.hp, state: 'swim', wp: null, tid: 0, cool: 0, age: 0, scanT: rnd() * 0.5, fleeT: 0 });
}
function nearestDiver(c, range) {
  let best = null, bd = range;
  for (const p of G.players.values()) { if (!p.alive) continue; const d = dist(c, p); if (d < bd) { bd = d; best = p; } }
  return best;
}
function fishStep(c, dt) {
  const S = FISH[c.sub], F = FLOORS[S.floor], W = G.world;
  c.age += dt; c.cool -= dt; c.scanT -= dt;
  if (c.scanT <= 0) {
    c.scanT = 0.3;
    const p = nearestDiver(c, S.dmg ? 18 : 13);
    if (p) { c.tid = p.id; c.state = S.dmg ? 'attack' : 'flee'; c.fleeT = 2.5; }
    else if (c.state === 'attack' || (c.state === 'flee' && (c.fleeT -= 0.3) <= 0)) c.state = 'swim';
    // fish far away from every diver swim off and appear somewhere new later
    if (c.age > 45 && !nearestDiver(c, 160)) { c.dead = true; return; }
  }
  const p = c.tid && G.players.get(c.tid);
  const yTop = SURFACE - F.top - 2, yBot = SURFACE - F.bot;
  if (c.state === 'attack' && p && p.alive) {
    const d = steer(c, p.x, p.y, p.z, S.speed, dt, S.size * 0.6);
    if (d < S.size + SUITS[p.suit].r + 0.8 && c.cool <= 0) {
      c.cool = 1.4; p.lastHitBy = S.name;
      ev('bite', r2(p.x), r2(p.y), r2(p.z));
      damage(p, S.dmg, null, 'beast', c.x, c.z);
    }
  } else if (c.state === 'flee' && p) {
    const ax = c.x - p.x, ay = c.y - p.y, az = c.z - p.z, al = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
    steer(c, c.x + ax / al * 10, clamp(c.y + ay / al * 10, yBot, yTop), c.z + az / al * 10, S.speed * 1.5, dt, S.size * 0.6);
  } else {
    if (!c.wp || dist(c, c.wp) < 3) {
      const a = rnd() * 6.283, d = 8 + rnd() * 22;
      const x = clamp(c.x + Math.cos(a) * d, -PLAY + 8, PLAY - 8), z = clamp(c.z + Math.sin(a) * d, -PLAY + 8, PLAY - 8);
      c.wp = { x, y: clamp(c.y + (rnd() - 0.5) * 10, Math.max(yBot, W.heightAt(x, z) + 2), yTop), z };
    }
    steer(c, c.wp.x, c.wp.y, c.wp.z, S.speed * 0.45, dt, S.size * 0.6);
  }
  if (c.y > yTop) c.y = yTop;
}
function bossStep(c, dt) {
  const B = BOSSES[c.sub], L = c.lair;
  c.cool -= dt; c.scanT -= dt;
  const p = c.tid && G.players.get(c.tid);
  if (c.state === 'idle' || c.state === 'return') {
    if (c.state === 'idle') { c.orb += dt * 0.25; steer(c, L.x + Math.cos(c.orb) * 8, L.y + Math.sin(c.orb * 2) * 1.5, L.z + Math.sin(c.orb) * 8, B.speed * 0.3, dt, B.r * 0.8); }
    else if (steer(c, L.x, L.y, L.z, B.speed * 0.8, dt, B.r * 0.8) < 6) c.state = 'idle';
    c.hp = Math.min(c.maxhp, c.hp + c.maxhp * 0.02 * dt);      // slowly heals when left alone
    if (c.hp >= c.maxhp) c.dmgBy.clear();
    if (c.scanT <= 0) {
      c.scanT = 0.4;
      const t = nearestDiver(c, 32);
      if (t && los(c, t)) { c.state = 'chase'; c.tid = t.id; if (!t.bot) t.ye.push(['warn', `${B.name} greift an!`]); }
    }
    return;
  }
  if (!p || !p.alive || dist(c, L) > 75) { c.state = 'return'; c.tid = 0; return; }
  if (c.state === 'swing') {
    steer(c, c.sx, c.sy, c.sz, B.speed, dt, B.r * 0.8);
    if ((c.t -= dt) <= 0) c.state = 'chase';
    return;
  }
  const d = steer(c, p.x, p.y, p.z, B.speed, dt, B.r * 0.8);
  if (d < B.r + SUITS[p.suit].r + 1.2 && c.cool <= 0) {
    c.cool = 1.6; p.lastHitBy = B.name;
    ev('bite', r2(p.x), r2(p.y), r2(p.z));
    damage(p, B.dmg, null, 'beast', c.x, c.z);
    // swim past and turn around for the next bite
    const ax = c.vx, az = c.vz, al = Math.sqrt(ax * ax + az * az) || 1;
    c.state = 'swing'; c.t = 1.3; c.sx = c.x + ax / al * 16; c.sy = c.y + 3; c.sz = c.z + az / al * 16;
  }
}
function expCreatureHurt(c, src) {
  if (c.type === 'boss') {
    if (src && src.id) { c.dmgBy.add(src.id); if (c.state === 'idle' || c.state === 'return') { c.state = 'chase'; c.tid = src.id; } }
  } else if (src && src.alive) { c.tid = src.id; c.state = FISH[c.sub].dmg ? 'attack' : 'flee'; c.fleeT = 3; }
  if (c.hp > 0) return;
  c.dead = true;
  ev('cdie', c.id, r2(c.x), r2(c.y), r2(c.z));
  if (c.type === 'fish') {
    if (!src || !src.id || !G.players.has(src.id)) return;
    const S = FISH[c.sub], value = S.value * (c.gold ? GOLD_MUL : 1);
    src.bag.push({ s: c.sub, g: c.gold ? 1 : 0 });
    src.ye.push(['fish', c.sub, c.gold ? 1 : 0, value]);
  } else {
    const B = BOSSES[c.sub];
    G.bossT[c.sub] = BOSS_RESPAWN;
    ev('kill', src?.name || '?', B.name, 0, src?.id || 0);
    ev('msg', `${B.name} wurde besiegt!`);
    for (const id of c.dmgBy) {
      const p = G.players.get(id);
      if (!p) continue;
      // no money right away: the boss goes into your catch. Sell it at the boat (reward) OR put it into the aquarium (€/s) – not both.
      p.bag.push({ b: c.sub }); p.ye.push(['boss', c.sub, B.reward]); storeProgress(p);
    }
  }
}
function expDown(p, src, how) {
  p.alive = false; p.hp = 0; p.respawnT = EXP_RESPAWN; p.vx = p.vy = p.vz = 0;
  const lost = Math.ceil(p.bag.length / 2);
  p.bag.splice(0, lost);
  const by = how === 'coral' || how === 'bleed' ? 'Scharfe Koralle' : how === 'zone' ? (p.lastHitBy || 'Tiefsee') : how === 'beast' ? (p.lastHitBy || 'Raubfisch') : src && src.name ? src.name : 'Tiefsee';
  ev('kill', by, p.name, p.id, 0);
  p.ye.push(['dead', 0, by, lost]);
  storeProgress(p);
}
// selling fish and the aquarium (no money needed for these)
function expFishAction(p, m) {
  const i = m.i | 0;
  if (m.k === 'sellall' && p.bag.length) {
    const value = p.bag.reduce((a, e) => a + fishValue(e), 0), n = p.bag.length;
    p.money += value; p.bag = []; p.ye.push(['sold', n, value]);
  } else if (m.k === 'sell' && p.bag[i]) {
    const value = fishValue(p.bag[i]); p.money += value; p.bag.splice(i, 1); p.ye.push(['sold', 1, value]);
  } else if (m.k === 'aq' && p.bag[i]) {
    if (p.bag[i].v != null) { p.ye.push(['shop', 'Dieser alte Fang kann nur verkauft werden.']); return true; }
    if (p.aq.length >= AQUARIUM.sizes[p.aqLvl]) { p.ye.push(['shop', 'Dein Aquarium ist voll – vergrößere es oder verkaufe einen Fisch daraus.']); return true; }
    const f = p.bag.splice(i, 1)[0]; p.aq.push(f);
    p.ye.push(['aqin', catchToNet(f)]);
  } else if (m.k === 'aqsell' && p.aq[i]) {
    // set free: makes room, but no money – it already earned money per second (selling OR aquarium, not both)
    const f = p.aq.splice(i, 1)[0]; p.ye.push(['aqfree', catchToNet(f)]);
  } else return false;
  storeProgress(p);
  return true;
}
function expBuy(p, m) {
  const atBase = ['aq', 'aqsell', 'aqup'].includes(m.k);   // aquarium things happen in the base, everything else at the ship
  if (!p.alive || !(atBase ? nearOwnBase(p, 20) : nearBoat(p, 22, 10))) { p.ye.push(['shop', atBase ? (nearBase(p, 20) ? 'Das ist nicht deine Basis – dein Aquarium ist in deiner eigenen!' : 'Du musst an deiner Basis sein!') : 'Du musst am Boot sein!']); return; }
  if (expFishAction(p, m)) return;
  let price, label, apply;
  if (m.k === 'aqup' && AQUARIUM.sizes[p.aqLvl + 1]) {
    price = AQUARIUM.prices[p.aqLvl + 1]; label = `Aquarium mit ${AQUARIUM.sizes[p.aqLvl + 1]} Plätzen`; apply = () => { p.aqLvl++; };
  } else if (m.k === 'tank' && TANKS[p.tank + 1]) {
    const T = TANKS[p.tank + 1]; price = T.price; label = T.name; apply = () => { p.tank++; p.air = T.cap; };
  } else if (m.k === 'lamp' && LAMPS[p.lamp + 1]) {
    const L = LAMPS[p.lamp + 1]; price = L.price; label = L.name; apply = () => { p.lamp++; };
  } else if (m.k === 'lung' && LUNGS[p.lung + 1]) {
    const L = LUNGS[p.lung + 1]; price = L.price; label = L.name; apply = () => { p.lung++; };
  } else if (m.k === 'w' && SHOP_WEAPONS[m.i]) {
    const it = SHOP_WEAPONS[m.i];
    if (p.weapons.some(w => w && w.id === it.wid && w.rar >= it.rar)) { p.ye.push(['shop', 'Die hast du schon (oder eine bessere)!']); return; }
    price = it.price; label = `${WEAPONS[it.wid].name} (${RARITY[it.rar].name})`;
    apply = () => {
      // same weapon type gets upgraded, otherwise a free slot, otherwise the weakest slot
      let slot = p.weapons.findIndex(w => w && w.id === it.wid);
      if (slot < 0) slot = p.weapons.indexOf(null);
      if (slot < 0) { slot = 0; for (let i = 1; i < 3; i++) if (wScore(p.weapons[i]) < wScore(p.weapons[slot])) slot = i; }
      p.weapons[slot] = newWeapon(it.wid, it.rar); p.slot = slot; p.reload = 0;
    };
  } else return;
  if (p.money < price) { p.ye.push(['shop', `Zu wenig Geld – dir fehlen ${price - p.money} €`]); return; }
  p.money -= price; apply();
  p.ye.push(['bought', label, price]);
  storeProgress(p);
}
function tickExp(dt) {
  G.time += dt;
  for (const p of G.players.values()) {
    if (!p.alive) {
      if ((p.respawnT -= dt) <= 0) {
        const s = boatSpawn();
        Object.assign(p, { alive: true, hp: p.maxhp, shield: 0, air: TANKS[p.tank].cap, x: s.x, y: s.y, z: s.z, lx: s.x, ly: s.y, lz: s.z, yaw: s.yaw, envAcc: 0, lowAir: false, reload: 0 });
        for (const w of p.weapons) if (w) { w.ammo = WEAPONS[w.id].mag; w.spare = Array(COMPRESSOR.spares).fill(1); }
        p.ye.push(['spawn', r2(s.x), r2(s.y), r2(s.z), r2(s.yaw)]);
      }
      continue;
    }
    const k = 0.5;
    p.vx += ((p.x - p.lx) / dt - p.vx) * k; p.vy += ((p.y - p.ly) / dt - p.vy) * k; p.vz += ((p.z - p.lz) / dt - p.vz) * k;
    p.lx = p.x; p.ly = p.y; p.lz = p.z;
    if (p.reload > 0) { p.reload -= dt; if (p.reload <= 0) finishReload(p); }
    compress(p, dt);
    coralCut(p, dt);
    // air and pressure
    const depth = depthOf(p), T = TANKS[p.tank];
    if (depth < 2.6 || nearBase(p, 14)) { p.air = Math.min(T.cap, p.air + T.cap * 0.35 * dt); p.lowAir = false; }   // surface or air station in the base
    else p.air = Math.max(0, p.air - airUse(depth) * LUNGS[p.lung].mul * (p.boost ? 1.4 : 1) * dt);
    if (!p.lowAir && p.air < T.cap * 0.25) { p.lowAir = true; p.ye.push(['warn', 'Luft wird knapp – auftauchen!']); }
    let hurt = 0;
    if (p.air <= 0) { hurt += 8; p.lastHitBy = 'Luftmangel'; }
    if (depth > T.maxDepth) {
      hurt += 6; p.lastHitBy = 'Wasserdruck';
      if ((p.warnT -= dt) <= 0) { p.warnT = 3; p.ye.push(['warn', `Zu tief für die ${T.name}! Max. ${T.maxDepth} m`]); }
    }
    // health regeneration after a few seconds without damage, faster at the surface
    if (p.hp < p.maxhp && G.time - (p.hurtT || 0) > REGEN_DELAY) p.hp = Math.min(p.maxhp, p.hp + (depth < 2.6 ? REGEN_RATE_SURFACE : REGEN_RATE) * dt);
    if (hurt) { p.envAcc += hurt * dt; if (p.envAcc >= 1) { const a = Math.floor(p.envAcc); p.envAcc -= a; damage(p, a, null, 'zone', p.x, p.z); } }
    // back at the boat with fish: remind once to sell them or put them into the aquarium
    const atBoat = nearBoat(p);
    if (atBoat && !p.atBoat && p.bag.length) p.ye.push(['bagHint', p.bag.length, p.bag.reduce((a, e) => a + fishValue(e), 0)]);
    p.atBoat = atBoat;
    const atBase = nearOwnBase(p);
    if (atBase && !p.atBase) p.ye.push(['baseHint', p.bag.length]);
    p.atBase = atBase;
    // someone else's base: say whose it is (air is refilled there too)
    const other = !atBase && nearBase(p) ? G.world.bases.findIndex(b => dist(p, b.c) < 16) : -1;
    if (other >= 0 && other !== p.atOther) { const o = baseOwner(other); p.ye.push(['warn', o ? `Basis von ${o.name} – hier kannst du nur Luft tanken` : 'Freie Basis – hier kannst du nur Luft tanken']); }
    p.atOther = other;
  }
  // aquarium income – only while you actually play: after AFK_TIME seconds without
  // swimming, looking around or shooting it pauses (no money for standing around AFK)
  for (const p of G.players.values()) {
    const afk = G.time - p.actT > AQUARIUM.afkTime;
    if (afk !== p.afk) { p.afk = afk; if (p.aq && p.aq.length) p.ye.push(['warn', afk ? 'AFK – dein Aquarium verdient gerade nichts!' : 'Weiter geht’s – das Aquarium verdient wieder.']); }
    if (afk || !p.aq || !p.aq.length) continue;
    p.aqAcc += aqIncome(p.aq) * dt;
    if (p.aqAcc >= 1) { const a = Math.floor(p.aqAcc); p.aqAcc -= a; p.money += a; if ((p.aqSaveT = (p.aqSaveT || 0) + a) > 50) { p.aqSaveT = 0; storeProgress(p); } }
  }
  // creatures + respawning
  for (const c of G.creatures) {
    if (c.dead) continue;
    if (c.type === 'fish') fishStep(c, dt); else if (c.type === 'boss') bossStep(c, dt);
  }
  G.creatures = G.creatures.filter(c => !c.dead);
  for (let i = 0; i < BOSSES.length; i++) if (G.bossT[i] > 0 && (G.bossT[i] -= dt) <= 0) { spawnBoss(i); ev('msg', `${BOSSES[i].name} ist zurück in Etage ${i + 1}!`); }
  const counts = FLOORS.map(() => 0);
  for (const c of G.creatures) if (c.type === 'fish') counts[FISH[c.sub].floor]++;
  for (let f = 0; f < FLOORS.length; f++) if (counts[f] < FLOORS[f].fish && (G.fishT[f] -= dt) <= 0) { G.fishT[f] = 1.2; spawnFish(f, false); }
  stepProjectiles(dt);
  if (roomClients().length === 0) toLobby();
}
function quitExp() {
  for (const p of G.players.values()) storeProgress(p);
  toLobby();
}

// ---------- main tick ----------
// ---------- Wellen-Überleben ----------
// team = so viele kämpfen zusammen (Bots füllen auf), firstBreak / pause = Sekunden vor der ersten / zwischen den Wellen,
// sharks = Haie in Welle 1, more = so viele kommen pro Welle dazu, hpUp = so viel stärker pro Welle (0.15 = +15 %),
// bite = Biss-Schaden, boss = alle so viele Wellen kommt ein Riesenhai, pearls = Perlen pro geschaffter Welle
const WAVE = { team: 4, firstBreak: 10, pause: 12, sharks: 4, more: 3, hpUp: 0.25, bite: 20, boss: 5, pearls: 25 };
function waveTick(dt) {
  const V = G.wave; if (!V) return;
  const alivePl = [...G.players.values()].filter(p => p.alive);
  if (V.state === 'break') {
    V.t -= dt;
    if (V.t > 0) return;
    V.n++; V.state = 'fight';
    const k = 1 + (V.n - 1) * WAVE.hpUp, n = WAVE.sharks + (V.n - 1) * WAVE.more, boss = V.n % WAVE.boss === 0;
    for (let i = 0; i < n + (boss ? 1 : 0); i++) {
      const big = boss && i === n, a = rnd() * 6.283, d = 80 + rnd() * 40;
      const t = alivePl[i % Math.max(1, alivePl.length)];
      const cx = clamp((t ? t.x : 0) + Math.cos(a) * d, -LIM, LIM), cz = clamp((t ? t.z : 0) + Math.sin(a) * d, -LIM, LIM);
      const cy = Math.min(SURFACE - DEEP.brCeil - 3, G.world.heightAt(cx, cz) + 8 + rnd() * 15);
      G.creatures.push({ id: nextId++, type: 'shark', x: cx, y: cy, z: cz, vx: 0, vy: 0, vz: 0, yaw: rnd() * 6.28, pitch: 0,
        hp: CREATURES.shark.hp * k * (big ? 6 : 1), state: 'hunt', wp: null, tid: t ? t.id : 0, scanT: 0, t: 0, bites: 0,
        dmg: WAVE.bite * (1 + (V.n - 1) * 0.12) * (big ? 2 : 1), big: big ? 1 : 0, wave: 1 });
    }
    ev('msg', boss ? 'Welle ' + V.n + ' – ein RIESENHAI kommt!' : 'Welle ' + V.n + ' – ' + n + ' Haie kommen!');
    return;
  }
  // Welle geschafft, wenn alle Haie dieser Welle tot sind
  if (!G.creatures.some(c => c.wave && !c.dead)) {
    V.state = 'break'; V.t = WAVE.pause;
    const anyAlive = alivePl.length ? alivePl[0] : null;
    for (const p of G.players.values()) {
      if (!p.alive && anyAlive) {   // Gefallene kommen zurück – neben einem Lebenden, mit halbem Leben
        p.alive = true; p.hp = p.maxhp * 0.5; p.shield = 0; p.x = p.lx = anyAlive.x + (rnd() - 0.5) * 6; p.y = p.ly = anyAlive.y; p.z = p.lz = anyAlive.z + (rnd() - 0.5) * 6;
        if (!p.bot) p.ye.push(['revive', r2(p.x), r2(p.y), r2(p.z)]);
      } else if (p.alive) p.hp = Math.min(p.maxhp, p.hp + p.maxhp * 0.3);
      for (const w of p.weapons) if (w && WEAPONS[w.id].mag) w.ammo = Math.max(w.ammo, WEAPONS[w.id].mag);   // Munition auffüllen
    }
    ev('msg', 'Welle ' + V.n + ' geschafft! Pause – Gefallene sind zurück.');
  }
}
function tick(dt) {
  if (G.mode === 'exp') return tickExp(dt);
  waveTick(dt);
  G.time += dt;
  updateZone(dt);
  const z = G.zone, dps = zoneDps();
  for (const p of G.players.values()) {
    if (!p.alive) continue;
    if (p.bot) botStep(p, dt);
    else {
      const k = 0.5;
      p.vx += ((p.x - p.lx) / dt - p.vx) * k; p.vy += ((p.y - p.ly) / dt - p.vy) * k; p.vz += ((p.z - p.lz) / dt - p.vz) * k;
      p.lx = p.x; p.ly = p.y; p.lz = p.z;
    }
    if (p.reload > 0) { p.reload -= dt; if (p.reload <= 0) finishReload(p); }
    compress(p, dt);
    ventHeat(p);
    coralCut(p, dt);
    if (p.ink > 0) p.ink -= dt;
    // Ulti-Leiste füllt sich langsam von allein (nicht, während die Ulti läuft); Bots zünden sie, wenn sie kämpfen
    if (p.alive && ULTIS[p.suit] && G.time >= (p.ultT || 0)) p.ult = Math.min(100, (p.ult || 0) + dt * 100 / ULTI.fill);
    if (p.bot && p.alive && p.ult >= 100 && p.target) useUlti(p);
    if (dist2d(p, z.x, z.z) > z.r) { p.zoneAcc += dps * dt; if (p.zoneAcc >= 1) { const a = Math.floor(p.zoneAcc); p.zoneAcc -= a; damage(p, a, null, 'zone', z.x, z.z); } }
    if (p.alive) autoCollect(p);
  }
  gadgetTick();
  ultTick();
  for (const v of G.vehicles.values()) {
    const d = v.driver && G.players.get(v.driver);
    if (d && d.alive && d.veh === v.id) { v.x = d.x; v.y = d.y; v.z = d.z; v.yaw = d.yaw; v.pitch = d.pitch; }
    else if (v.driver) v.driver = 0;
  }
  for (const c of G.creatures) {
    if (c.dead) continue;
    if (c.type === 'shark') sharkStep(c, dt); else if (c.type === 'octo') octoStep(c, dt); else jellyStep(c);
  }
  G.creatures = G.creatures.filter(c => !c.dead);
  stepProjectiles(dt);
  // end conditions
  const alive = [...G.players.values()].filter(p => p.alive);
  const humansAlive = alive.filter(p => !p.bot).length;
  if (roomClients().length === 0) { toLobby(); return; }
  if (G.wave) { if (alive.length === 0) endMatch(); }   // Wellen: erst vorbei, wenn alle gleichzeitig tot sind
  else if (alive.length <= 1 || (G.duo && aliveTeams() <= 1)) endMatch();   // Duo: das letzte Team gewinnt
  else if (humansAlive === 0) { G.noHumanT += dt; if (G.noHumanT > 6) endMatch(); }
}
function snapshot() {
  const z = G.zone, P = z && PHASES[z.ph];
  const common = {
    tm: r2(G.time), n: aliveCount(),
    hm: G.proj.filter(p => p.home).map(p => [p.id, r2(p.x), r2(p.y), r2(p.z), +p.dx.toFixed(3), +p.dy.toFixed(3), +p.dz.toFixed(3)]),   // zielsuchende Torpedos
    wv: G.wave ? [G.wave.n, G.wave.state === 'break' ? Math.ceil(G.wave.t) : -G.creatures.filter(c => c.wave && !c.dead).length] : null,   // Welle: Nummer, Sekunden Pause oder −Haie übrig
    z: z ? [r2(z.x), r2(z.z), r2(z.r), r2(z.nx), r2(z.nz), r2(z.nr), z.ph, P ? Math.ceil((z.sh ? P.shrink : P.wait) - z.t) : 0, z.sh ? 1 : 0] : null,
    p: [...G.players.values()].filter(p => p.alive).map(p => [p.id, r2(p.x), r2(p.y), r2(p.z), r2(p.yaw), r2(p.pitch), Math.ceil(p.hp), Math.round(p.shield),
      (p.boost ? 2 : 0) | (p.grabbed ? 4 : 0) | (G.time < (p.invisT || 0) ? 8 : 0) | (p.reload > 0 ? 16 : 0),   // 16 = lädt gerade nach   // 8 = getarnt (Sepia-Ulti)
      p.weapons[p.slot] ? WEAPON_IDS.indexOf(p.weapons[p.slot].id) : -1, p.veh]),
    c: G.creatures.map(c => [c.id, CREATURE_IDS.indexOf(c.type), r2(c.x), r2(c.y), r2(c.z), r2(c.yaw), r2(c.pitch),
      ['hunt', 'lunge', 'chase', 'swing', 'attack', 'flee'].includes(c.state) ? 1 : c.state === 'hold' ? 2 : 0,
      c.sub || 0, c.maxhp ? Math.max(0, Math.ceil(c.hp / c.maxhp * 100)) : 100, c.gold ? 1 : 0, c.big ? 1 : 0]),   // 11: Riesenhai
    v: [...G.vehicles.values()].map(v => { const gn = v.gunner && G.players.get(v.gunner); return [v.id, VEHICLE_IDS.indexOf(v.type), r2(v.x), r2(v.y), r2(v.z), r2(v.yaw), r2(v.pitch), Math.ceil(v.hp), v.driver, v.gunner || 0, gn ? r2(gn.yaw) : 0, gn ? r2(gn.pitch) : 0]; }),   // 9-11: Schütze, seine Blickrichtung
    e: G.events,
    // expedition: who owns which base + their aquarium (so everybody sees the fish in the other bases)
    b: G.mode === 'exp' ? [...G.players.values()].filter(p => p.baseIdx != null).map(p => [p.baseIdx, p.id, p.name, p.aq.map(catchToNet)]) : undefined,
  };
  const cs = JSON.stringify(common);
  for (const c of roomClients()) {
    const p = G.players.get(c.id);
    let you = null, ye = [];
    if (p) {
      const v = p.veh && G.vehicles.get(p.veh);
      you = { alive: p.alive, hp: Math.ceil(p.hp), mhp: p.maxhp, sh: Math.round(p.shield), slot: p.slot, kills: p.kills, place: p.place,
        w: p.weapons.map(w => w ? [w.id, w.rar, w.ammo, (w.spare || []).map(s => Math.round(s * 100) / 100), w.mods || []] : 0), rl: r2(p.reload), rlT: p.reloadT, veh: p.veh, vhp: v ? Math.ceil(v.hp) : 0,
        grab: p.grabbed ? 1 : 0, ink: r2(Math.max(0, p.ink)),
        gd: p.gad >= 0 ? [p.gad, r2(Math.max(0, (p.gadT || 0) - G.time))] : null,   // Gadget: Nummer und wie lange es noch abkühlt
        ul: ULTIS[p.suit] && G.mode !== 'exp' ? [Math.floor(p.ult || 0), r2(Math.max(0, (p.ultT || 0) - G.time))] : null };   // Ulti: Prozent geladen, Sekunden noch aktiv
      if (G.mode === 'exp') you.x = { money: p.money, bag: p.bag.length, bagV: p.bag.reduce((a, e) => a + fishValue(e), 0), air: r2(p.air),
        tank: p.tank, lung: p.lung, lamp: p.lamp, rt: r2(Math.max(0, p.respawnT)),
        bagL: p.bag.map(catchToNet), aq: p.aq.map(catchToNet), aqLvl: p.aqLvl, aqRate: Math.round(aqIncome(p.aq) * 100) / 100, afk: p.afk ? 1 : 0, base: p.baseIdx };
      ye = p.ye; p.ye = [];
    }
    send(c.ws, `{"t":"s","c":${cs},"you":${JSON.stringify(you)},"ye":${JSON.stringify(ye)}}`);
  }
  G.events = [];
}
function endMatch() {
  if (G.phase !== 'play') return;
  const rest = [...G.players.values()].filter(p => p.alive).sort((a, b) => b.hp + b.shield - a.hp - a.shield);
  if (G.duo) {   // Duo: Teams nach ihrem gemeinsamen Leben sortieren, beide im Team bekommen denselben Platz
    const tl = new Map(); for (const p of rest) tl.set(p.team, (tl.get(p.team) || 0) + p.hp + p.shield);
    const order = [...tl.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);
    for (const p of rest) p.place = order.indexOf(p.team) + 1;
  } else rest.forEach((p, i) => { p.place = i + 1; });
  const rank = [...G.players.values()].sort((a, b) => a.place - b.place).map(p => {
    const r = { id: p.id, n: p.name, place: p.place, k: p.kills, bot: p.bot ? 1 : 0, suit: p.suit };
    if (!p.bot) {   // Perlen für echte Spieler: Kills + überlebte Minuten + Platz-Bonus
      r.pearls = brReward(p.kills, p.alive ? G.time : p.deathT || 0, G.wave ? 99 : p.place);
      if (G.wave) { r.pearls.wave = Math.max(0, G.wave.n - 1) * WAVE.pearls; r.pearls.sum += r.pearls.wave; }   // Perlen für jede geschaffte Welle
      r.pearls.total = addPearls(p.name, r.pearls.sum);
    }
    return r;
  });
  snapshot();
  G.phase = 'end'; G.endT = 10;
  broadcast({ t: 'end', rank, total: G.players.size });
  console.log(`[match] ended after ${Math.round(G.time)}s, winner: ${rank[0]?.n}`);
}
function toLobby() {
  if (G.mode === 'exp') for (const p of G.players.values()) storeProgress(p);
  G.phase = 'lobby';
  G.seed = (rnd() * 1e9) | 0; G.world = new World(G.seed, G.mode);
  G.players = new Map(); G.creatures = []; G.proj = []; G.events = [];
  broadcast(lobbyMsg());
}

setInterval(() => {
  for (const room of rooms.values()) {   // jeden Liga-Raum nacheinander berechnen
    G = room;
    try {
      if (G.phase === 'play') {
        for (let i = 0; i < SPEED && G.phase === 'play'; i++) tick(DT);
        if (G.phase === 'play') snapshot();
      } else if (G.phase === 'end') { G.endT -= DT * SPEED; if (G.endT <= 0) toLobby(); }
    } catch (e) { console.error('[tick error]', e); }
  }
}, 1000 / TICK_HZ);

// ---------- network ----------
const cleanName = (s) => String(s || '').replace(/[<>&"]/g, '').trim().slice(0, 16) || 'Taucher';
wss.on('connection', (ws) => {
  const c = { id: nextId++, ws, name: 'Taucher', suit: 'triton', playing: false };
  c.room = roomFor(leagueOf(upsOf(c.name))); G = c.room;
  clients.set(ws, c);
  send(ws, { t: 'welcome', id: c.id });
  if (G.phase === 'lobby') broadcast(lobbyMsg());
  else {
    send(ws, lobbyMsg());
    // battle royale: watch the running round. expedition: joins as soon as the name arrives ('set')
    if (G.phase === 'play' && G.mode === 'br') send(ws, startMsg(c));
  }
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    G = c.room;   // ab hier: der Raum dieses Spielers
    if (m.t === 'set' && m.name !== undefined) { c.name = cleanName(m.name); placeClient(c); G = c.room; }   // anderer Name = evtl. andere Liga
    const p = G.phase === 'play' ? G.players.get(c.id) : null;
    switch (m.t) {
      case 'set':
        if (m.name !== undefined) c.name = cleanName(m.name);
        if (SUITS[m.suit] && suitOwned(suitsOf(c.name), m.suit)) c.suit = m.suit;   // nur freie oder gekaufte Taucher
        if (!suitOwned(suitsOf(c.name), c.suit)) c.suit = 'triton';                 // anderer Name: Taucher evtl. nicht gekauft
        if (Number.isFinite(m.bots)) G.bots = clamp(Math.round(m.bots), 0, 23);
        if (typeof m.duo === 'boolean' && G.phase === 'lobby') G.duo = m.duo;   // Duo-Modus: Zweier-Teams
        if ((m.mode === 'br' || m.mode === 'exp' || m.mode === 'wave') && m.mode !== G.mode && G.phase === 'lobby') { G.mode = m.mode; G.world = new World(G.seed, G.mode); }
        if (G.phase === 'lobby') broadcast(lobbyMsg());
        else if (G.phase === 'play' && G.mode === 'exp' && !G.players.has(c.id)) {
          expJoin(c); broadcast(metaMsg()); send(ws, startMsg(c));
          ev('msg', `${c.name} taucht mit!`);
        }
        break;
      case 'start': if (G.phase === 'lobby') { if (G.mode === 'exp') startExp(); else startMatch(); } break;
      case 'buy': if (p && G.mode === 'exp') expBuy(p, m); break;
      // Einkaufen und Ausrüsten: in der Lobby – oder während der Runde, wenn man schon tot ist (oder nur zuschaut)
      case 'brbuy': if (G.phase === 'lobby' || !p || !p.alive) { brBuy(c, m.k); send(ws, lobbyMsg()); if (G.phase === 'lobby') { broadcast(lobbyMsg()); placeClient(c); G = c.room; } } break;   // neues Upgrade = evtl. neue Liga
      case 'load': if (G.phase === 'lobby' || !p || !p.alive) { setLoadout(c, m); send(ws, lobbyMsg()); if (G.phase === 'lobby') broadcast(lobbyMsg()); } break;
      case 'ult': if (p && p.alive && G.mode !== 'exp') useUlti(p, m); break;
      case 'gad': if (p && p.alive && G.mode !== 'exp') { try { useGadget(p, m); } catch (err) { console.error('[gadget error]', err); } } break;
      case 'quit': if (G.phase === 'play' && G.mode === 'exp') quitExp(); break;
      case 'm':
        if (p && p.alive && [m.x, m.y, m.z, m.yaw, m.pitch].every(Number.isFinite)) {
          p.x = clamp(m.x, -300, 300); p.y = clamp(m.y, SURFACE - EXP_MAX_DEPTH, G.mode === 'exp' ? SURFACE : SURFACE - DEEP.brCeil); p.z = clamp(m.z, -300, 300);
          // activity check for the aquarium: really moved or looked around (just bobbing in the water does not count)
          if (!p.act || dist(p, p.act) > 1.5 || Math.abs(m.yaw - p.act.yaw) > 0.15 || Math.abs(m.pitch - p.act.pitch) > 0.15) { p.act = { x: p.x, y: p.y, z: p.z, yaw: m.yaw, pitch: m.pitch }; p.actT = G.time; }
          p.yaw = m.yaw; p.pitch = clamp(m.pitch, -1.6, 1.6); p.boost = !!m.b;
        }
        break;
      case 'f': if (p) { p.actT = G.time; fire(p, m.d, m.a); } break;
      case 'r': if (p && p.alive) startReload(p); break;
      case 'fin': if (p && p.alive) finisher(p, m.id); break;
      case 'slot': if (p && p.alive && [0, 1, 2].includes(m.i) && p.weapons[m.i] && m.i !== p.slot) { p.slot = m.i; p.reload = 0; p.nextFire = Math.max(p.nextFire, G.time + DRAW_TIME * upMul(p.up, 'draw') - 0.1); } break;   // Waffe ziehen braucht kurz Zeit
      case 'e': if (p) interact(p); break;
      // im U-Boot den Platz wechseln: s = 'gun' (vom Steuer in die Kugel) oder 'drive' (aus der Kugel ans Steuer)
      case 'seat': if (p && p.alive && p.veh) { const v = G.vehicles.get(p.veh);
        if (v && v.type === 'sub') {
          if (m.s === 'gun' && v.driver === p.id && !v.gunner) { v.driver = 0; v.gunner = p.id; }
          else if (m.s === 'drive' && v.gunner === p.id && !v.driver) { v.gunner = 0; v.driver = p.id; p.x = v.x; p.y = v.y; p.z = v.z; }
        } } break;
      case 'x': if (p && p.alive) struggle(p); break;
    }
  });
  ws.on('close', () => {
    G = c.room;
    clients.delete(ws);
    const p = G.players.get(c.id);
    if (G.phase === 'play' && p && G.mode === 'exp') { storeProgress(p); G.players.delete(c.id); ev('msg', `${p.name} ist aufgetaucht und weg.`); }
    else if (G.phase === 'play' && p && p.alive) kill(p, null, 'left');
    if (G.phase === 'lobby') broadcast(lobbyMsg());
  });
  ws.on('error', () => {});
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log('\n  UNDERNITE server is running\n');
  console.log(`  This PC:        ${url}`);
  for (const u of lanUrls()) console.log(`  Home network:   ${u}`);
  console.log('\n  Keep this window open while playing. Close it to stop the server.\n');
  if (process.platform === 'win32' && !process.env.UN_NO_OPEN) exec(`start "" "${url}"`);
});
