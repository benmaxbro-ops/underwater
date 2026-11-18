// Headless smoke test for the Tiefsee-Expedition mode (server must be running).
// Plays a scripted diver: hunt fish -> sell at boat -> buy gear -> fight boss -> dive too deep -> respawn.
import WebSocket from 'ws';
import { FISH, BOSSES, SURFACE, EXP_BOAT, World } from './public/js/shared.js';
let base = null, world = null;   // own underwater base position (every diver has one of the 6)

const ws = new WebSocket('ws://localhost:' + (process.env.PORT || 8080));
const send = (o) => ws.send(JSON.stringify(o));
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const t0 = Date.now();
let step = 'hunt', me = null, pos = null, caught = 0, stepT = 0, seen = {};
const ok = {};

function aimAt(t) {
  // park 6 m from the target and shoot at it
  const dx = t[2] - pos.x, dy = t[3] - pos.y, dz = t[4] - pos.z, d = Math.hypot(dx, dy, dz) || 1;
  pos = { x: t[2] - dx / d * 6, y: t[3] - dy / d * 6, z: t[4] - dz / d * 6 };
  send({ t: 'm', ...pos, yaw: 0, pitch: 0 });
  send({ t: 'f', d: [dx / d, dy / d, dz / d] });
}

ws.on('message', (raw) => {
  const m = JSON.parse(raw);
  if (m.t === 'welcome') { send({ t: 'set', name: 'Testtaucher', suit: 'triton', mode: 'exp' }); setTimeout(() => send({ t: 'start' }), 200); }
  if (m.t === 'start') { log('start mode', m.mode); ok.start = m.mode === 'exp'; world = new World(m.seed, 'exp'); }
  if (m.t !== 's' || !m.you) return;
  const y = m.you, x = y.x; stepT++;
  if (!base && world && x.base != null) { base = world.bases[x.base].c; log('own base', x.base, 'at', base.x.toFixed(1), base.z.toFixed(1), (SURFACE - base.y) + ' m deep'); }
  for (const e of m.ye) {
    seen[e[0]] = (seen[e[0]] || 0) + 1;
    if (e[0] === 'fish') { caught++; if (caught <= 3) log('caught', FISH[e[1]].name, e[3], '$'); }
    if (['sold', 'bought', 'shop', 'boss', 'dead', 'spawn', 'warn'].includes(e[0])) log('event', JSON.stringify(e));
    if (e[0] === 'spawn') { pos = { x: e[1], y: e[2], z: e[3] }; ok.respawn = true; }
  }
  if (!pos && y.alive) pos = { x: 0, y: SURFACE - 3, z: 0 };
  if (!y.alive) return;
  const fish = m.c.c.filter(c => c[1] === 3), boss = m.c.c.filter(c => c[1] === 4);
  if (step === 'hunt') {
    // first floor fish only (cheap ones in shallow water)
    const t = fish.filter(c => FISH[c[8]].floor === 0).sort((a, b) => Math.hypot(a[2] - pos.x, a[4] - pos.z) - Math.hypot(b[2] - pos.x, b[4] - pos.z))[0];
    if (t) aimAt(t);
    if (caught >= 12 || stepT > 900) { log('bag', x.bag, 'fish worth', x.bagV, '€, air', x.air); ok.hunt = x.bag > 0; ok.airHunt = x.air; step = 'sell'; stepT = 0; }
  } else if (step === 'sell') {
    // at the underwater base: two fish into the aquarium (and air gets refilled there)
    if (stepT < 40) {
      pos = { x: base.x + 7, y: base.y + 1, z: base.z }; send({ t: 'm', ...pos, yaw: 0, pitch: 0 });
      if (stepT === 3) { send({ t: 'buy', k: 'sellall' }); }   // selling at the base must be refused
      if (stepT === 6) { send({ t: 'buy', k: 'aq', i: 0 }); send({ t: 'buy', k: 'aq', i: 0 }); }
      if (stepT === 39) { log('aquarium', JSON.stringify(x.aq), 'income', x.aqRate, '€/s, air', ok.airHunt, '->', x.air, 'at 50 m'); ok.aquarium = x.aq.length === 2 && x.aqRate > 0 && x.bag > 0; ok.airStation = x.air > ok.airHunt; }   // without the station the air would drop at 50 m
    } else {
      // then at the boat: sell the rest
      pos = { x: EXP_BOAT.x + 7, y: SURFACE - 2, z: EXP_BOAT.z }; send({ t: 'm', ...pos, yaw: 0, pitch: 0 });
      if (stepT === 45) send({ t: 'buy', k: 'sellall' });
      if (stepT > 45 && x.bag === 0) { log('money after selling', x.money); ok.sell = x.money > 0; step = 'buy'; }
    }
  } else if (step === 'buy') {
    send({ t: 'buy', k: 'w', i: 0 }); send({ t: 'buy', k: 'tank' });
    step = 'boss'; stepT = 0;
  } else if (step === 'boss') {
    if (stepT === 2) log('weapons', JSON.stringify(y.w), 'tank', x.tank, 'money', x.money);
    const b = boss.find(c => c[8] === 0);
    if (b) { if (stepT % 4 === 0) aimAt(b); if (stepT % 40 === 0) log('boss hp', b[9] + '%', 'my hp', y.hp); }
    if (y.hp < 100 && !ok.bossHit) { ok.bossHit = true; log('boss bit me, hp', y.hp); }
    if (!ok.bossTrophy && x.bagL.some(f => f[0] === -2)) { ok.bossTrophy = true; log('boss trophy in the bag', JSON.stringify(x.bagL.filter(f => f[0] === -2)), 'money', x.money); }
    if (stepT > 260 || ok.bossTrophy) { step = 'trophy'; stepT = 0; }
  } else if (step === 'trophy') {
    // bring the beaten boss to the base and put it into the aquarium
    pos = { x: base.x + 7, y: base.y + 1, z: base.z }; send({ t: 'm', ...pos, yaw: 0, pitch: 0 });
    const bi = x.bagL.findIndex(f => f[0] === -2);
    if (stepT === 5) { if (bi >= 0) send({ t: 'buy', k: 'aqsell', i: 0 }); }   // make room: take one fish out (sold)
    if (stepT === 10 && bi >= 0) { ok.rateBefore = x.aqRate; send({ t: 'buy', k: 'aq', i: bi }); }
    if (stepT === 20) { log('aquarium now', JSON.stringify(x.aq), 'income', x.aqRate, '€/s'); ok.bossInAq = x.aq.some(f => f[0] === -2) && x.aqRate > (ok.rateBefore || 0) + 4; }
    if (stepT > 22) { step = 'deep'; stepT = 0; }
  } else if (step === 'deep') {
    // far too deep for the tank: pressure + air should knock us out
    pos = { x: 5, y: SURFACE - 340, z: 5 }; send({ t: 'm', ...pos, yaw: 0, pitch: 0 });
  }
});
ws.on('close', () => log('closed'));
const finish = () => {
  log('RESULT', JSON.stringify(ok), 'private events', JSON.stringify(seen));
  process.exit(ok.start && ok.hunt && ok.aquarium && ok.airStation && ok.sell && ok.respawn ? 0 : 1);
};
setInterval(() => { if (ok.respawn) finish(); }, 500);
setTimeout(finish, 120000);
