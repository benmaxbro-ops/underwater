// Undernite - browser client: networking, input, camera, entity sync, effects.
import * as THREE from 'three';
import { World, SUITS, WEAPONS, WEAPON_IDS, RARITY, VEHICLES, VEHICLE_IDS, CREATURES, CREATURE_IDS, SURFACE, dirFrom, segSphere, FINISHER, DEEP,
  creatureR, FISH, BOSSES, EXP_BOAT, LAMPS, catchFromNet, catchName, catchRate, deepGlow, SHOT_CHARGE, upMul, REEF_HITBOX, HEAT, GADGETS, gadgetOf, modDef, DRAW_TIME, ULTIS, SUIT_ORDER, eyeHeight } from './shared.js';
// gekaufte Verbesserungen aus dem Perlen-Shop (kommen mit der Lobby-Nachricht). Wirken nur im Battle Royale.
let myUp = {};
const UP = (k) => mode === 'exp' ? 1 : upMul(myUp, k);
import { buildEnvironment } from './world.js';
import { makePlayerModel, makeShark, makeOcto, makeJelly, makeSub, makeScooter, makeJetski, makeRay, makeCrate, makePickup, makeProjectile, makeBeam, makeWaterGun, makeViewArms, makeReloadHand, poseReload, reloadRoll, RELOAD_STEPS, makeFish, makeBoss, makeTrophy, makeGunEnv, makeSwimArms } from './models.js';
import { Hud, SONAR, SONAR_SND } from './hud.js';
import { Sfx } from './audio.js';
import { startFinisher } from './finisher.js';
import { settings, onSettings, openSettings, closeSettings, QUALITY } from './settings.js';
import { setReefQuality } from './reef.js';
import { setPropsQuality } from './props.js';
import { makeShock, makeBlast, SHOCK } from './shock.js';
// so weit hinter der Mündung sitzen die Seitenkiemen je Waffe (Meter) – dort kommt beim Hitze-Ablassen der Druck raus
const GILL_BACK = [0.14, 0.2, 0.26, 0.3, 0.55, 0.55, 0.32, 0.6, 0.16, 0.24, 0.4, 0.32, 0.3, 0.3, 0.3];
import { makeLensPass } from './lens.js';
import { makeMechViewArms, makeCockpit, makeMechReloadHand } from './mech.js';
import { makeSubInterior, SUBROOM } from './subint.js';
import { initTouch, isTouch } from './touch.js';
import { makeTutorial } from './tutorial.js';
import { Music } from './music.js';
const tut = makeTutorial(); let tutShots = 0;   // Einführung für neue Spieler (tutorial.js)
import './water.js';   // Wasser schluckt Farben (Rot zuerst) – muss geladen sein, bevor etwas gezeichnet wird
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
makeGunEnv(renderer);   // Spiegel-Umgebung für das Metall der Waffen
const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x2b8fb0, 0.01);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.25, 900);
camera.rotation.order = 'YXZ'; scene.add(camera);
const hemi = new THREE.HemisphereLight(0xb5e8ff, 0x12303c, 1.25); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xdff6ff, 1.35); sun.position.set(0.35, 1, 0.2); scene.add(sun);
// Helmlampe: kaltweißes LED-Licht, sitzt am Helm des Tauchers (nicht an der Kamera) und leuchtet nur einen engen Kegel
// in Blickrichtung aus. penumbra 0.35 = ziemlich scharfer Rand, decay 1.6 = wird mit der Entfernung schnell schwächer.
const LAMP_COLOR = 0xf2f7ff;
const lamp = new THREE.SpotLight(LAMP_COLOR, 0, 90, 0.42, 0.35, 1.6);
scene.add(lamp); scene.add(lamp.target);
// visible light cone of the expedition flashlight (apex at the diver, opening towards -z)
const torchBeam = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 24, 1, true).translate(0, -0.5, 0).rotateX(Math.PI / 2),
  new THREE.ShaderMaterial({   // bright at the lamp, fading out towards the end of the cone
    // Weicher Lichtdunst statt harter Kegel: an den Rändern (wo man flach auf den Kegel schaut) blendet er aus,
    // und mit der Entfernung von der Lampe wird er schwächer – so sieht ein Lampenstrahl in trübem Wasser aus.
    uniforms: { c: { value: new THREE.Color(LAMP_COLOR) }, o: { value: 0.07 } },
    vertexShader: 'varying float vz; varying vec3 vN; varying vec3 vV; void main() { vz = -position.z; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 c; uniform float o; varying float vz; varying vec3 vN; varying vec3 vV; void main() { float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6); gl_FragColor = vec4(c, o * pow(1.0 - vz, 2.2) * edge); }',
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
torchBeam.rotation.order = 'YXZ'; torchBeam.visible = false; scene.add(torchBeam);
// Goliath: zwei Scheinwerfer links und rechts an der Kuppel, die schräg zur Mitte leuchten (statt einer Lampe aus der Brust).
// side = so weit links/rechts, up = Höhe, fwd = nach vorne, focus = in so vielen Metern treffen sich die Lichtkegel, power = Helligkeit je Lampe (× normale Lampe)
const MECH_LAMPS = { side: 0.52, up: 1.46, fwd: 0.25, focus: 16, power: 0.6, haze: 0.018 };   // haze = wie sichtbar der Lichtkegel im Wasser ist
const mechLamps = [-1, 1].map(s => {
  const l = new THREE.SpotLight(LAMP_COLOR, 0, 90, 0.3, 0.4, 1.6); scene.add(l); scene.add(l.target);
  const b = torchBeam.clone(); b.material = torchBeam.material.clone(); b.material.uniforms.o.value = MECH_LAMPS.haze; b.visible = false; scene.add(b);
  return { s, l, b };
});
function resize() {
  renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  if (post.composer) { post.composer.setPixelRatio(renderer.getPixelRatio()); post.composer.setSize(innerWidth, innerHeight); }
}
// ---------- Grafik-Nachbearbeitung (je nach Qualitätsstufe) ----------
// Das Bild wird erst normal gezeichnet und dann bearbeitet:
//   GTAO  = weiche Schatten in Spalten, Höhlen und Ecken (macht alles weniger "blockig")
//   Bloom = helle, leuchtende Dinge strahlen in ihre Umgebung (Korallen, Quallen, Mündungsblitz, Lampe)
//   Linse = Bodycam-Look: Fischauge, Farbsäume, dunkler Rand, Filmkorn (Werte in lens.js)
const post = { on: false, composer: null, bloom: null, ao: null, lens: null };
function setupPost(Q) {
  post.on = Q.bloom > 0 || Q.ao || Q.lens;
  if (!post.on) return;
  if (!post.composer) {
    post.composer = new EffectComposer(renderer);
    post.composer.addPass(new RenderPass(scene, camera));
    post.ao = new GTAOPass(scene, camera, innerWidth, innerHeight);
    post.ao.updateGtaoMaterial({ radius: 1.4, distanceExponent: 1.6, thickness: 2, scale: 1.3, samples: 12 });
    post.composer.addPass(post.ao);
    post.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.55, 0.7);
    post.composer.addPass(post.bloom);
    post.composer.addPass(new OutputPass());   // Farben und Helligkeit wie ohne Nachbearbeitung (Tone Mapping)
    post.lens = makeLensPass(); post.composer.addPass(post.lens);   // zuletzt: die Bodycam-Linse
  }
  post.lens.enabled = !!Q.lens;
  post.ao.enabled = !!Q.ao;
  post.bloom.enabled = Q.bloom > 0; post.bloom.strength = Q.bloom;
  post.composer.setPixelRatio(renderer.getPixelRatio()); post.composer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', resize); resize();

const hud = new Hud(), sfx = new Sfx();
const music = new Music(sfx); let lastShotT = -99, hurtT = 0;   // Musik (music.js); lastShotT = wann zuletzt geschossen wurde (für die Spannung)
const dyn = new THREE.Group(); scene.add(dyn);
let W = null, env = null;
let waveInfo = null;   // Wellen-Modus: [Nummer, Pause-Sekunden oder −Haie übrig]
let mode = 'br', phase = 'connecting', myId = 0, mySuit = 'triton', you = null, zone = null, aliveN = 0, frameNo = 0, time = 0;
const meta = new Map(), players = new Map(), creatures = new Map(), vehicles = new Map(), pickups = new Map(), projs = new Map();
let crates = [];
const me = { x: 0, y: 60, z: 0, vx: 0, vy: 0, vz: 0, hyaw: 0, hpitch: 0, byaw: 0, bpitch: 0, energy: 100, boost: false, exhaust: false };
const LAVA_SKY = new THREE.Color(0xff9a50), LAVA_GROUND = new THREE.Color(0xff3a08), PRIM_SKY = new THREE.Color(0x6fa8ff), PRIM_GROUND = new THREE.Color(0x10204a);
let held = -1;   // expedition: index of the caught fish/boss in your hand (-1 = weapon)
// Wasserstrahlen der Hitscan-Waffen, die gerade sichtbar sind. BEAM_TIME = wie lange einer zu sehen ist (Sekunden).
const beams = [], BEAM_TIME = 0.18;
// Waffe in der Ego-Perspektive: hängt an der Kamera, rechts unten im Bild.
// gills = wie weit die Kiemen offen sind (0…1), charge = wie voll das Druckfenster ist (0…1), kick = Rückstoß nach einem Schuss
const flashLight = new THREE.PointLight(0x9fe4ff, 0, 5, 1.6); flashLight.position.set(0.15, -0.08, -0.6); camera.add(flashLight);
// Streulicht der Helmlampe auf Hände und Waffe (sitzt oben am Helm, reicht nur bis zu den Händen)
const handLight = new THREE.PointLight(0xe8f0ff, 0, 1.4, 2); handLight.position.set(0.05, 0.22, 0.05); camera.add(handLight);
// Mech-Cockpit: Glaskuppel, Kragen, Armaturenbrett und warmes Licht innen (nur in der Ego-Sicht des Goliath)
// Mech-Freelook: im Goliath-Cockpit (Ego-Sicht) dreht die Maus nur den KOPF – Cockpit und Waffe bleiben, wo der Mech hinschaut.
// Mit Rechtsklick dreht sich der ganze Mech zum Blick, und man zielt.
// yaw = so weit kann man den Kopf zur Seite drehen, pitchUp/pitchDown = nach oben/unten (Winkel), turn = wie schnell der Mech folgt
const FREELOOK = { yaw: 1.9, pitchUp: 1.3, pitchDown: 0.7, turn: 7 };
const head = { yaw: 0, pitch: 0 };   // so weit ist der Kopf gerade gegenüber dem Mech gedreht
const mechFrame = new THREE.Group(); camera.add(mechFrame);   // Cockpit und Waffe hängen hier dran und drehen gegen den Kopf
// COCKPIT_SIZE = wie groß das Cockpit um deinen Kopf ist (kleiner = Arme und Waffe sind draußen vor der Scheibe)
const COCKPIT_SIZE = 0.5;
const cockpit = makeCockpit(); cockpit.visible = false; cockpit.scale.setScalar(COCKPIT_SIZE); mechFrame.add(cockpit);
// ---------- U-Boot von innen (Ego-Sicht mit V): sitzen am Steuerpult, mit B aufstehen und herumlaufen ----------
const subIn = { stand: false, peri: false, gunIn: false, x: SUBROOM.seat[0], z: SUBROOM.seat[1] };   // peri = schaut gerade durchs Periskop
// Periskop: up = so hoch über dem U-Boot ist die Linse, fov = Zoom (kleiner = näher), reach = so nah muss man dran stehen
const PERI = { up: 3.2, fov: 28, reach: 0.65, pos: [0, 0.45] };
const nearHatch = () => subIn.stand && Math.hypot(subIn.x - SUBROOM.hatch[0], subIn.z - SUBROOM.hatch[1]) < 0.6;
// Platz im U-Boot wechseln (gleich hier im Browser umstellen, damit nichts ruckelt; der Server bestätigt es)
function switchSeat(to) {
  const v = you && you.veh ? vehicles.get(you.veh) : null; if (!v) return;
  send({ t: 'seat', s: to });
  if (to === 'gun') { v.driver = 0; v.gunner = myId; subIn.stand = false; subIn.gunIn = false; subIn.peri = false; }
  else { v.gunner = 0; v.driver = myId; me.x = v.x; me.y = v.y; me.z = v.z; me.hyaw = v.yaw; subIn.gunIn = false; subIn.stand = false; firstPerson = true; }   // im Cockpit bleiben
  sfx.noise(0.35, 500, 1, 0.3, 'lowpass', 150);
}
const nearPeri = () => subIn.stand && Math.hypot(subIn.x - PERI.pos[0], subIn.z - PERI.pos[1]) < PERI.reach;   // x, z = wo man im U-Boot steht
let subRoom = null;   // der Innenraum (wird beim ersten Einsteigen gebaut)
// bist du gerade in der Ego-Sicht in deinem U-Boot? Dann gibt es das U-Boot zurück, sonst null
// (der Schütze ist auch "drin", wenn er aus der Kugel ins U-Boot geklettert ist: subIn.gunIn)
function inSubFP() { const v = you && you.alive && you.veh ? vehicles.get(you.veh) : null; if (!v || v.type !== 'sub') return null; return v.gunner === myId ? (subIn.gunIn ? v : null) : firstPerson ? v : null; }
// 2-Mann-U-Boot: sitze ich als Schütze in der MG-Kugel? Dann gibt es das U-Boot zurück. BALL_DY = so weit unter der U-Boot-Mitte hängt die Kugel
const BALL_DY = -1.95, SUB_MG_RATE = 11;   // SUB_MG_RATE muss zu SUB_MG.rate in server.js passen
function myGunSub() { const v = you && you.alive && you.veh ? vehicles.get(you.veh) : null; return v && v.type === 'sub' && v.gunner === myId ? v : null; }
const nearSeat = () => Math.hypot(subIn.x - SUBROOM.seat[0], subIn.z - SUBROOM.seat[1]) < 0.8;
function toggleStand() {
  if (!subIn.stand) { subIn.stand = true; subIn.x = SUBROOM.seat[0]; subIn.z = SUBROOM.seat[1] + 0.5; sfx.noise(0.2, 400, 1, 0.3, 'lowpass', 150); return; }
  if (!nearSeat()) { hud.banner('Geh zum Sitz vorne, um dich hinzusetzen', 1.2); return; }
  subIn.stand = false; subIn.x = SUBROOM.seat[0]; subIn.z = SUBROOM.seat[1]; sfx.noise(0.25, 300, 1, 0.35, 'lowpass', 100);
}
// Laufen im U-Boot: W/A/S/D in Blickrichtung, aber nur waagrecht und nur innerhalb des Raums
function updateSubWalk(dt, v) {
  const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const rel = camYaw - v.yaw, sp = SUBROOM.walkSpeed * dt;   // Blick relativ zum U-Boot
  subIn.x += (-Math.sin(rel) * f + Math.cos(rel) * s) * sp; subIn.z += (-Math.cos(rel) * f - Math.sin(rel) * s) * sp;
  const Wk = SUBROOM.walk; subIn.x = Math.max(-Wk.x, Math.min(Wk.x, subIn.x)); subIn.z = Math.max(Wk.z0, Math.min(Wk.z1, subIn.z));
  const pd = Math.hypot(subIn.x, subIn.z - 0.45); if (pd < 0.3) { subIn.x = subIn.x / (pd || 1) * 0.3; subIn.z = 0.45 + (subIn.z - 0.45) / (pd || 1) * 0.3; }   // nicht durchs Periskop
}
// Mündungsblitz: zwei gekreuzte leuchtende Scheiben und ein heller Kern (blau-weiß, wie ein Druckstoß aus Wasser)
function makeFlash() {
  const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: 0xbff0ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  for (const r of [0, Math.PI / 2]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.14), m); p.position.z = -0.06; p.rotation.set(Math.PI / 2, 0, r); g.add(p); }
  const c = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), m); c.position.z = -0.015; g.add(c);
  return g;
}
const view = { g: new THREE.Group(), gun: null, arms: null, rHand: null, rl: 0, widx: -2, gills: 0, charge: 0, kick: 0, bob: 0, tilt: 0, rsnd: 0, inX: 0, inY: 0, swim: 0 };
// Brustschwimmen (Ego-Sicht): minSpeed = ab diesem Tempo (m/s), rate = Züge pro Sekunde im Stand + rateSpeed pro m/s,
// blendIn/blendOut = wie schnell die Arme kommen bzw. die Waffe wieder hochkommt
const SWIM = { minSpeed: 2.5, rate: 0.35, rateSpeed: 0.035, blendIn: 3, blendOut: 10 };
// Waffe vor der Kamera (Bodycam): hip = wo sie ohne Zielen sitzt [rechts, oben, nach innen gedreht] je Waffenart.
// Pistole beidhändig unten in der Mitte, Gewehre etwas rechts, Werfer rechts.
// inertia = wie stark sie beim Drehen nachschwingt, inertiaMax = höchstens so weit, inertiaBack = wie schnell sie zurückkommt
// breathe = wie stark sie beim Atmen auf und ab geht, hands = Licht der Helmlampe auf Händen und Waffe (an / aus)
// mechGun = wo die Waffe am Goliath hängt (rechts, weit vorne vor der Kuppel), mechReload = beim Nachladen schwenkt sie dorthin (Bildmitte, trotzdem draußen)
// mechPack = Magazin-Halter links vorne AUSSEN am Mech, mechElbow = dort sitzt das Gelenk der Nachlade-Zange (links außen)
const VIEW = { mechGun: [0.34, -0.2, -0.3], mechReload: [0.06, -0.14, -0.38], mechPack: [-0.5, -0.32, -1.0], mechElbow: [-0.8, -0.55, -0.75], hip: { pistol: [0.03, -0.112, 0.04], rifle: [0.1, -0.13, 0.02], tube: [0.15, -0.13, 0] },
  inertia: 0.35, inertiaMax: 0.05, inertiaBack: 9, breathe: 0.0025, hands: [0.35, 0.06] };
view.g.position.set(0.15, -0.13, 0);   // rechts, unten (die Tiefe kommt von der Waffe selbst, siehe updateViewModel)
mechFrame.add(view.g);   // normal (ohne Freelook) ist mechFrame genau die Kamera
// firstPerson = Taste V gedrückt (Ego-Perspektive), fpOn = sie ist gerade wirklich aktiv (nicht in Fahrzeugen)
let firstPerson = false, fpOn = false;
let camYaw = 0, camPitch = -0.35, camDist = 5, firing = false, nextFire = 0, specId = 0, shockUntil = 0, shake = 0, deadInfo = null, promptT = 0, sendT = 0;
let vehSince = 0, headUp = 0;
// expedition flashlight: on/off with L, battery in seconds, recharges at the surface
const torch = { on: false, bat: LAMPS[0].battery, lvl: 0, hinted: false };
const keys = {};
const lerpAngle = (a, b, k) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; else if (d < -Math.PI) d += Math.PI * 2; return a + d * k; };
const approachAngle = (a, b, step) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; else if (d < -Math.PI) d += Math.PI * 2; return a + Math.max(-step, Math.min(step, d)); };
// Schuss-Richtungsanzeige: Schüsse bis SHOT_DIR_RANGE Meter zeigen einen Pfeil am Ring in der Bildmitte
const SHOT_DIR_RANGE = 80;
function shotFrom(x, z) {
  if (!you || !you.alive || Math.hypot(x - me.x, z - me.z) > SHOT_DIR_RANGE || Math.hypot(x - me.x, z - me.z) < 1) return;
  hud.shotDir(Math.atan2(x - me.x, -(z - me.z)) + camYaw);
}
const distTo = (x, y, z) => Math.hypot(x - camera.position.x, y - camera.position.y, z - camera.position.z);
const volAt = (x, y, z) => { const d = Math.hypot(x - camera.position.x, y - camera.position.y, z - camera.position.z); return Math.max(0, 1 - d / 95) ** 2; };

// ---------- network ----------
const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
const send = (o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };
ws.onclose = () => hud.conn(true);
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.t === 's') onSnap(m);
  else if (m.t === 'welcome') { myId = m.id; send({ t: 'set', name: prefs.name, suit: prefs.suit }); }
  else if (m.t === 'meta') { for (const p of m.players) meta.set(p[0], { name: p[1], suit: p[2], bot: !!p[3], team: p[4] || 0 }); }
  else if (m.t === 'lobby') { ensureWorld(m.seed, m.mode); if (phase !== 'play') { phase = 'lobby'; clearDyn(); hud.show('lobby'); if (document.pointerLockElement) document.exitPointerLock(); } hud.setLobby(m, myId); const mine = m.players.find(p => p.id === myId); if (mine) { mySuit = mine.suit; myUp = mine.up || {}; } }
  else if (m.t === 'start') onStart(m);
  else if (m.t === 'end') { endDeath(); document.getElementById('deathFx').style.opacity = '0'; phase = 'end'; hud.end(m, myId); hud.show('end'); if (document.pointerLockElement) document.exitPointerLock(); }
};
const prefs = hud.buildLobby((c) => {
  sfx.init();
  if (c.start) { send({ t: 'start' }); canvas.requestPointerLock?.(); }
  else if (c.mode) send({ t: 'set', mode: c.mode });
  else send({ t: 'set', ...c });
});

function ensureWorld(seed, wmode = 'br') {
  if (env && env.seed === seed && env.mode === wmode) return;
  if (env) env.dispose();
  W = new World(seed, wmode); env = buildEnvironment(scene, W);
}
// ---------- expedition shop ----------
const nearBoat = () => Math.hypot(me.x - EXP_BOAT.x, me.z - EXP_BOAT.z) < 20 && SURFACE - me.y < 9;
// your own base (the server gives every diver one of the 6); foreign bases only refill air
const myBase = () => W && W.bases && you && you.x && you.x.base != null ? W.bases[you.x.base] : null;
const nearBase = () => { const b = myBase(); return !!b && Math.hypot(me.x - b.c.x, me.y - b.c.y, me.z - b.c.z) < 16; };
const otherBaseOwner = () => { if (!W || !W.bases) return null; const i = W.bases.findIndex(b => Math.hypot(me.x - b.c.x, me.y - b.c.y, me.z - b.c.z) < 16);
  if (i < 0 || (you && you.x && i === you.x.base)) return null; const o = (baseInfo || []).find(b => b[0] === i); return o ? o[2] : 'niemand'; };
let baseInfo = null;   // [[base index, owner id, owner name, aquarium], ...] from the server
function openShop(kind) { hud.openShop(you, kind); firing = false; if (document.pointerLockElement) document.exitPointerLock(); }
function closeShop() { hud.closeShop(); lock(); }
hud.initShop((k, i) => send({ t: 'buy', k, i }), closeShop, () => { hud.closeShop(); send({ t: 'quit' }); });
function clearDyn() {
  for (const p of projs.values()) if (p.whine) p.whine.stop();
  sfx.engine(0); sfx.mechLoop(false);
  dyn.clear(); shocks.length = 0; corpses.length = 0; gfx.shields.clear(); gfx.drones.clear(); gfx.ropes.length = 0; gfx.grapple = null; gfx.sonarUntil = 0; players.clear(); creatures.clear(); vehicles.clear(); pickups.clear(); projs.clear(); crates = [];
  you = null; zone = null; deadInfo = null; specId = 0; endDeath(); document.getElementById('deathFx').style.opacity = '0';
}
function onStart(m) {
  mode = m.mode || 'br'; holster.on = false; cling = null; daze.t = 0; daze.burn = 0; holsterUntil = 0;
  ensureWorld(m.seed, mode); clearDyn();
  phase = 'play'; meta.clear(); hud.setMode(mode);
  torch.on = false; torchBeam.visible = false; torch.bat = LAMPS[torch.lvl].battery;   // Akku zurücksetzen (im Battle Royale war er unendlich)
  for (const p of m.players) meta.set(p[0], { name: p[1], suit: p[2], bot: !!p[3], team: p[4] || 0 });
  const mine = meta.get(myId), mate = mine && mine.team ? [...meta.entries()].find(([id, x]) => id !== myId && x.team === mine.team) : null;
  if (mate) setTimeout(() => hud.banner(`Duo: dein Teamkamerad ist ${mate[1].name}`, 3), 1200);
  if (meta.has(myId)) mySuit = meta.get(myId).suit;
  if (mode === 'br') crates = W.crates.map((c, i) => { const g = makeCrate(); g.position.set(c.x, c.y, c.z); g.rotation.y = c.yaw; if (m.crates[i]) g.userData.open(); dyn.add(g); return g; });
  for (const p of m.pickups) addPickup(p);
  if (m.spawn) { me.x = m.spawn[0]; me.y = m.spawn[1]; me.z = m.spawn[2]; me.vx = me.vy = me.vz = 0; camYaw = m.spawn[3]; camPitch = -0.55; me.energy = 100; }
  hud.show('game'); hud.spec(null);
  hud.banner(mode === 'exp' ? 'Tiefsee-Expedition! Jag Fische und verkauf sie am Boot.' : m.spectator ? 'Runde läuft – du schaust zu' : 'Abtauchen! Such dir Ausrüstung.', 4);
  hud.pause(!document.pointerLockElement && !isTouch());   // auf dem Handy gibt es keine Maus-Sperre – also auch keine Pause-Anzeige
}
function addPickup(p) {
  const mesh = makePickup(p[1], p[2], p[3]); mesh.position.set(p[4], p[5], p[6]); dyn.add(mesh);
  pickups.set(p[0], { id: p[0], k: p[1], wid: p[2], rar: p[3], x: p[4], y: p[5], z: p[6], mesh });
}
// Duo: ist das mein Teamkamerad?
function isMate(id) { const a = meta.get(myId), b = meta.get(id); return id !== myId && !!(a && b && a.team && a.team === b.team); }
function spawnPlayer(id) {
  const m = meta.get(id) || { name: '?', suit: 'triton' };
  const mesh = makePlayerModel(m.suit, id, id === myId ? null : m.name, isMate(id) ? '#7dff9a' : undefined); dyn.add(mesh);   // Teamkamerad: grünes Namensschild
  const e = { id, mesh, suit: m.suit, name: m.name, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, tx: 0, ty: 0, tz: 0, tyaw: 0, tpitch: 0, hp: 0, fl: 0, w: 0, veh: 0, fresh: true, speed: 0, seen: 0, bubT: 0 };
  players.set(id, e); return e;
}
function sync(map, id, make) {
  let e = map.get(id);
  if (!e) { e = make(); e.fresh = true; e.speed = 0; dyn.add(e.mesh); map.set(id, e); }
  e.seen = frameNo; return e;
}
function prune(map) { for (const [id, e] of map) if (e.seen !== frameNo) { dyn.remove(e.mesh); map.delete(id); } }
function target(e, a, o) { e.tx = a[o]; e.ty = a[o + 1]; e.tz = a[o + 2]; e.tyaw = a[o + 3]; e.tpitch = a[o + 4]; if (e.fresh) { e.x = e.tx; e.y = e.ty; e.z = e.tz; e.yaw = e.tyaw; e.pitch = e.tpitch; e.fresh = false; } }

function onSnap(m) {
  if (phase !== 'play') return;
  const c = m.c; frameNo++;
  zone = c.z; aliveN = c.n; baseInfo = c.b || null; waveInfo = c.wv || null;
  for (const h of c.hm || []) { const p = projs.get(h[0]); if (!p) continue; p.x = h[1]; p.y = h[2]; p.z = h[3]; p.dx = h[4]; p.dy = h[5]; p.dz = h[6]; p.life = Math.max(p.life, 0.5); p.mesh.lookAt(p.x + p.dx, p.y + p.dy, p.z + p.dz); }   // Lenk-Torpedos vom Server
  const wasAlive = you && you.alive;
  you = m.you;
  for (const a of c.p) { const e = players.get(a[0]) || spawnPlayer(a[0]); e.seen = frameNo; target(e, a, 1); e.hp = a[6]; e.fl = a[8]; e.w = e.weapon = a[9]; e.veh = a[10]; }
  prune(players);
  for (const a of c.c) {
    const type = CREATURE_IDS[a[1]];
    const e = sync(creatures, a[0], () => ({ type, sub: a[8], gold: a[10], r: creatureR(type, a[8]),
      mesh: type === 'shark' ? makeShark() : type === 'octo' ? makeOcto() : type === 'fish' ? makeFish(FISH[a[8]], a[10]) : type === 'boss' ? makeBoss(BOSSES[a[8]]) : makeJelly(a[0]) }));
    target(e, a, 2); e.state = a[7]; e.hpPct = a[9];
    if (a[11] && !e.big) { e.big = true; e.mesh.scale.multiplyScalar(2.3); e.r *= 2.3; }   // Riesenhai (Wellen-Modus)
  }
  prune(creatures);
  for (const a of c.v) { const type = VEHICLE_IDS[a[1]]; const e = sync(vehicles, a[0], () => ({ type, mesh: type === 'sub' ? makeSub() : type === 'jetski' ? makeJetski() : type === 'ray' ? makeRay() : makeScooter() })); target(e, a, 2); e.hp = a[7]; e.driver = a[8]; e.gunner = a[9] || 0; e.gyaw = a[10] || 0; e.gpitch = a[11] || 0; }
  prune(vehicles);
  for (const e of c.e) onEvent(e);
  for (const e of m.ye) onPrivate(e);
  if (wasAlive && you && !you.alive && document.pointerLockElement) { /* keep lock for spectating */ }
}

// Wo ist die Mündung der Waffe von Spieler id gerade? (in der Ego-Perspektive: die Waffe vor der Kamera)
const MZ = new THREE.Vector3();
function muzzleOf(id) {
  let m = null;
  if (id === myId && view.g.visible && view.gun) m = view.gun.userData.muzzle;
  else { const e = players.get(id); if (e && e.mesh.visible && e.mesh.userData.muzzle) m = e.mesh.userData.muzzle(); }
  return m ? m.getWorldPosition(MZ) : null;
}
// Knapp vorbei: wie nah (Meter) ein fremder Schuss an dir vorbei muss, damit es "Schusch" macht
const NEAR_MISS = 4.5;
function whooshAt(x, y, z, d) {
  const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);                     // "rechts" von der Kamera aus
  const side = ((x - me.x) * rx + (z - me.z) * rz) / Math.max(0.3, d);
  sfx.whoosh(Math.pow(1 - d / (NEAR_MISS + 0.5), 0.8), side);
}
function nearMiss(x0, y0, z0, x1, y1, z1) {
  if (!you || !you.alive) return;
  // der Punkt auf dem Strahl, der mir am nächsten ist
  const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, L = dx * dx + dy * dy + dz * dz || 1;
  const k = Math.max(0, Math.min(1, ((me.x - x0) * dx + (me.y - y0) * dy + (me.z - z0) * dz) / L));
  const px = x0 + dx * k, py = y0 + dy * k, pz = z0 + dz * k, d = Math.hypot(px - me.x, py - me.y, pz - me.z);
  if (d < NEAR_MISS) whooshAt(px, py, pz, d);
}
function addBeam(x0, y0, z0, x1, y1, z1, r) {
  const mesh = makeBeam(x0, y0, z0, x1, y1, z1, r);
  dyn.add(mesh);
  beams.push({ mesh, t: BEAM_TIME });
}
// ---------- Schockwelle bei jedem Schuss (Aussehen und Größe: siehe shock.js) ----------
const shocks = [];
// scale = größer bei mehr Hitze, heat = 0…1 (färbt die Welle warm)
function addShock(x, y, z, dx, dy, dz, widx, mine, scale = 1, heat = 0) {
  const s = makeShock(dyn, x, y, z, dx, dy, dz, widx, mine, scale, heat); if (!s) return;
  shocks.push(s);
}
// Benommen nach dem Verbrennen: t = Sekunden übrig, max = Anfangswert, burn = roter Hitzeblitz am Rand (0…1)
const daze = { t: 0, max: 1, burn: 0 };
function updateShocks(dt) { for (let i = shocks.length - 1; i >= 0; i--) if (!shocks[i].update(dt)) shocks.splice(i, 1); updateGadgetFx(dt); }

// ---------- Gadgets (Taste Q) – was sie machen, steht in GADGETS (shared.js), wirken tut es am Server ----------
const gfx = { sonarUntil: 0, stunUntil: 0, netUntil: 0, empUntil: 0, grapple: null, drones: new Map(), shields: new Map(), ropes: [] };
function useGadget() {
  if (!you || !you.alive || !you.gd || you.gd[1] > 0) { if (you && you.gd && you.gd[1] > 0) hud.banner(`${GADGETS[you.gd[0]].name} lädt noch ${Math.ceil(you.gd[1])} s`, 1); return; }
  send({ t: 'gad', d: dirFrom(camYaw, camPitch).map(v => +v.toFixed(3)) });
}
// ---------- Ultis (Taste 4) – Werte in ULTIS (shared.js) ----------
const ultOn = () => !!(you && you.alive && you.ul && you.ul[1] > 0);   // läuft deine Ulti gerade?
function useUlti() {
  if (!you || !you.alive || !you.ul) return;
  const U = ULTIS[mySuit];
  if (you.ul[1] > 0) return;
  if (you.ul[0] < 100) { hud.banner(`${U.name} lädt noch (${you.ul[0]} %)`, 1); return; }
  send({ t: 'ult', d: dirFrom(camYaw, camPitch).map(v => +v.toFixed(3)) });
}
// Goliath-Zielcomputer: dreht die Kamera von selbst zum nächsten Gegner, den man sieht.
// range = so weit (Meter) sucht er, cone = nur Gegner ungefähr vor dir (Winkel), turn = wie schnell er nachzieht
const AUTOAIM = { range: 70, cone: 1.1, turn: 10 };
let aimLock = 0;   // Nummer des Gegners, auf den der Computer gerade zielt
function autoAim(dt) {
  const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z, look = dirFrom(camYaw, camPitch);
  const ok = (e) => {
    if (!e || e.id === myId || !e.mesh.visible || isMate(e.id)) return false;
    const dx = e.x - cx, dy = e.y + 0.3 - cy, dz = e.z - cz, d = Math.hypot(dx, dy, dz);
    if (d > AUTOAIM.range || d < 0.5) return false;
    if (Math.acos(Math.max(-1, Math.min(1, (dx * look[0] + dy * look[1] + dz * look[2]) / d))) > AUTOAIM.cone) return false;
    return W.segmentHit(cx, cy, cz, e.x, e.y + 0.3, e.z) < 0;   // kein Fels dazwischen
  };
  let t = ok(players.get(aimLock)) ? players.get(aimLock) : null;
  if (!t) { let bd = Infinity; for (const e of players.values()) if (ok(e)) { const d = Math.hypot(e.x - cx, e.y - cy, e.z - cz); if (d < bd) { bd = d; t = e; } } }
  aimLock = t ? t.id : 0; if (!t) return;
  const dx = t.x - cx, dy = t.y + 0.3 - cy, dz = t.z - cz;
  camYaw = approachAngle(camYaw, Math.atan2(-dx, -dz), AUTOAIM.turn * dt);
  const tp = Math.atan2(dy, Math.hypot(dx, dz)); camPitch += Math.max(-AUTOAIM.turn * dt, Math.min(AUTOAIM.turn * dt, tp - camPitch));
}
// Hammerhai-Blutrausch: rote Markierungen über Gegnern, auch durch Felsen hindurch
const rageMarks = [];
function drawRage() {
  const on = mySuit === 'hammerhai' && ultOn() && phase === 'play';
  let n = 0;
  if (on) for (const e of players.values()) {
    if (e.id === myId || (e.fl & 8) || Math.hypot(e.x - me.x, e.y - me.y, e.z - me.z) > ULTIS.hammerhai.range) continue;
    V.set(e.x, e.y + 0.4, e.z).project(camera); if (V.z > 1) continue;   // hinter dir
    let d = rageMarks[n]; if (!d) { d = document.createElement('div'); d.className = 'rage'; document.getElementById('hud').appendChild(d); rageMarks.push(d); }
    d.style.display = ''; d.style.left = ((V.x + 1) / 2 * innerWidth) + 'px'; d.style.top = ((1 - V.y) / 2 * innerHeight) + 'px'; n++;
  }
  for (let i = n; i < rageMarks.length; i++) rageMarks[i].style.display = 'none';
}
function onUlti(e) {
  const pe = players.get(e[1]), suit = SUIT_ORDER[e[2]], U = ULTIS[suit]; if (!pe || !U) return;
  const mine = e[1] === myId, vol = mine ? 1 : volAt(pe.x, pe.y, pe.z);
  if (mine) hud.banner(`${U.name}!`, 1.4);
  if (suit === 'manta') { sfx.tone(320, 55, 1.1, 0.55 * vol, 'sine'); sfx.noise(1.0, 600, 0.8, 0.3 * vol, 'lowpass', 120); }   // tiefes Wuuumm: die Zeit wird langsam
  else if (suit === 'goliath') { for (let i = 0; i < 3; i++) sfx.tone(1300, 1300, 0.07, 0.25 * vol, 'square', i * 0.12); }   // Piep-piep-piep: der Zielcomputer schaltet sich ein
  else if (suit === 'triton') { for (let i = 0; i < 3; i++) sfx.tone(700, 1500, 0.12, 0.2 * vol, 'triangle', i * 0.25); }   // drei Torpedos zischen los
  else if (suit === 'bulwark') { sfx.tone(90, 45, 0.6, 0.6 * vol, 'sine'); sfx.noise(0.4, 300, 1, 0.4 * vol, 'lowpass', 80); }   // dumpfes Wumm: die Panzerung schließt sich
  else if (suit === 'sepia') { sfx.noise(0.7, 2500, 1, 0.3 * vol, 'bandpass', 600); }   // Pssschhh: sie verschwindet
  else if (suit === 'barrakuda') { sfx.whoosh(0.9 * vol); sfx.noise(0.5, 900, 1, 0.4 * vol, 'lowpass', 200); }   // Wuuusch nach vorne
  else if (suit === 'nautilus') { sfx.summon(); }   // Glitzern: Reparatur
  else if (suit === 'hammerhai') { sfx.tone(140, 60, 0.8, 0.5 * vol, 'sawtooth'); sfx.tone(70, 70, 1.2, 0.3 * vol, 'sine', 0.1); }   // tiefes Knurren
}
const SHIELD_GEO = new THREE.SphereGeometry(1, 32, 18), DRONE_GEO = new THREE.SphereGeometry(0.16, 16, 12), DRONE_RING = new THREE.TorusGeometry(0.24, 0.035, 8, 24);
function onGadget(e) {
  const [, id, gi, x, y, z] = e, g = GADGETS[gi], pe = players.get(id); if (!g) return;
  const mine = id === myId, vol = mine ? 1 : volAt(x, y, z);
  switch (g.k) {
    case 'bait': env.blood(x, y, z); env.bubble(x, y, z, 12, 0.6, 1); sfx.noise(0.3, 600, 1, 0.4 * vol, 'lowpass', 200); break;
    case 'sonar': {
      if (mine) gfx.sonarUntil = time + g.time;
      const b = makeBlast(dyn, x, y, z, 0, 0, -1, 1, 0, mine, 0); if (b) shocks.push(b);
      sfx.tone(1400, 1350, 0.9, 0.35 * vol, 'sine'); sfx.tone(700, 690, 1.4, 0.2 * vol, 'sine', 0.05);   // "Piiing"
      break;
    }
    case 'shield': {
      const m = new THREE.Mesh(SHIELD_GEO, new THREE.MeshBasicMaterial({ color: 0x6fd6ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      dyn.add(m); gfx.shields.set(id, { m, until: time + g.time, r: (pe ? SUITS[pe.suit].r : 1) * 1.9 });
      sfx.tone(180, 420, 0.4, 0.4 * vol, 'sawtooth'); sfx.noise(0.5, 900, 1, 0.3 * vol, 'bandpass', 2400);
      break;
    }
    case 'stomp': {
      const b = makeBlast(dyn, x, y - 0.8, z, 0, 1, 0, 7, 0.5, mine, 0); if (b) shocks.push(b);
      env.bubble(x, y - 1, z, 50, 3, 2); sfx.ventBoom(vol, 0.7, distTo(x, y, z));
      shake = Math.max(shake, mine ? 0.5 : Math.max(0, 0.5 - distTo(x, y, z) / 30));
      break;
    }
    case 'inkbomb': sfx.noise(0.4, 400, 0.8, 0.5 * vol, 'lowpass', 120); break;   // die Wolke selbst kommt mit 'ink'
    case 'grapple': {
      if (pe) gfx.ropes.push({ id, x, y, z, t: 0.6 });
      if (mine) gfx.grapple = { x, y, z, t: 1.2 };
      sfx.noise(0.15, 2600, 2, 0.4 * vol, 'bandpass', 900); sfx.tone(900, 300, 0.25, 0.2 * vol, 'square');   // "Zing"
      break;
    }
    case 'drone': {
      const grp = new THREE.Group();
      grp.add(new THREE.Mesh(DRONE_GEO, new THREE.MeshStandardMaterial({ color: 0xd8dde2, metalness: 0.8, roughness: 0.25, emissive: 0xffb347, emissiveIntensity: 0.25 })));
      const ring = new THREE.Mesh(DRONE_RING, new THREE.MeshBasicMaterial({ color: 0xffb347 })); grp.add(ring);
      dyn.add(grp); gfx.drones.set(id, { m: grp, ring, until: time + g.time });
      sfx.tone(300, 900, 0.3, 0.3 * vol, 'triangle');
      break;
    }
    case 'zap': {
      const b = makeBlast(dyn, x, y, z, 0, 0, -1, 0, 0, mine, 0); if (b) shocks.push(b);
      sfx.zap(1, 0.8 * vol); sfx.noise(0.5, 3000, 3, 0.4 * vol, 'bandpass', 800);
      for (let i = 0; i < 6; i++) { const a = Math.random() * 6.28, r = 2 + Math.random() * 5; addBeam(x, y, z, x + Math.cos(a) * r, y + (Math.random() - 0.5) * 3, z + Math.sin(a) * r, 0.03); }   // Blitze
      break;
    }
  }
}
// ---------- Getroffener Gegner: sackt zusammen und sinkt ----------
// Eine Kopie des Tauchers bleibt liegen: er sackt nach vorne, sinkt langsam zum Boden, die Waffe trudelt hinterher,
// eine dunkle Wolke breitet sich aus. Nach CORPSE.time Sekunden verblasst alles. (Beim Finisher gibt es eine eigene Animation.)
const CORPSE = { time: 9, sink: 1.4 };
const corpses = [];
function spawnCorpse(id) {
  const pe = players.get(id); if (!pe || id === myId || !pe.mesh) return;
  const m = makePlayerModel(pe.suit, id, ''), mats = [];
  m.traverse((o) => { if (o.material) { const b = o.material.opacity; o.material = o.material.clone(); o.material.transparent = true; o.material.userData.baseOp = b; mats.push(o.material); } });
  m.position.set(pe.x, pe.y, pe.z); dyn.add(m);
  const gun = pe.weapon >= 0 ? makeWaterGun(pe.weapon) : null;
  if (gun) { gun.position.set(pe.x + 0.4, pe.y + 0.2, pe.z); dyn.add(gun); }
  env.ink(pe.x, pe.y + 0.4, pe.z); env.blood(pe.x, pe.y + 0.4, pe.z); env.bubble(pe.x, pe.y + 0.6, pe.z, 25, 0.6, 2);
  corpses.push({ m, mats, gun, t: 0, yaw: pe.yaw || 0, spin: (Math.random() - 0.5) * 2, tilt: 0 });
  dyn.remove(pe.mesh); players.delete(id);   // der lebende Taucher verschwindet, die Kopie übernimmt
}
function updateCorpses(dt) {
  for (let i = corpses.length - 1; i >= 0; i--) {
    const c = corpses[i]; c.t += dt; const k = c.t / CORPSE.time;
    const ground = W.heightAt(c.m.position.x, c.m.position.z) + 0.35;
    if (c.m.position.y > ground) c.m.position.y = Math.max(ground, c.m.position.y - dt * CORPSE.sink * Math.min(1, c.t));   // sinkt langsam
    c.tilt += (1.35 - c.tilt) * Math.min(1, dt * 1.5);                                   // sackt nach vorne zusammen
    c.m.userData.update(dt, { yaw: c.yaw + Math.sin(c.t * 0.7) * 0.15, pitch: -c.tilt, speed: 0, weapon: -1, surf: false });
    if (c.gun) {   // Waffe trudelt zum Boden
      const g = c.gun, gg = W.heightAt(g.position.x, g.position.z) + 0.05;
      if (g.position.y > gg) { g.position.y -= dt * 2.2; g.rotation.x += dt * c.spin * 2; g.rotation.z += dt * c.spin; } else g.position.y = gg;
    }
    const fade = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
    for (const mt of c.mats) mt.opacity = Math.max(0, fade) * (mt.userData.baseOp ?? 1);
    if (k >= 1) { dyn.remove(c.m); if (c.gun) dyn.remove(c.gun); corpses.splice(i, 1); }
  }
}
function updateGadgetFx(dt) {
  updateCorpses(dt);
  for (const [id, s] of gfx.shields) {
    const pe = players.get(id);
    if (!pe || time > s.until) { dyn.remove(s.m); s.m.material.dispose(); gfx.shields.delete(id); continue; }
    s.m.position.set(pe.x, pe.y + 0.3, pe.z); s.m.scale.setScalar(s.r * (1 + Math.sin(time * 9) * 0.03));
    s.m.material.opacity = 0.12 + 0.06 * Math.sin(time * 5) + (s.hit = Math.max(0, (s.hit || 0) - dt * 3)) * 0.3;
  }
  for (const [id, d] of gfx.drones) {
    const pe = players.get(id);
    if (!pe || time > d.until) { dyn.remove(d.m); gfx.drones.delete(id); continue; }
    d.m.position.set(pe.x + Math.cos(pe.yaw || 0) * 0.9, pe.y + 0.9 + Math.sin(time * 3) * 0.08, pe.z - Math.sin(pe.yaw || 0) * 0.9);
    d.ring.rotation.set(time * 2, time * 3, 0);
  }
  for (let i = gfx.ropes.length - 1; i >= 0; i--) {   // Seil: kurz sichtbar als dünner Strahl vom Taucher zum Fels
    const r = gfx.ropes[i]; r.t -= dt; const pe = players.get(r.id);
    if (r.t <= 0 || !pe) { gfx.ropes.splice(i, 1); continue; }
    if (!r.drawn) { addBeam(pe.x, pe.y, pe.z, r.x, r.y, r.z, 0.025); r.drawn = true; }
  }
}
function onEvent(e) {
  switch (e[0]) {
    case 'pj': {
      // sichtbarer Start an der Mündung der Waffe (der Server rechnet weiter mit seinem eigenen Startpunkt)
      const mz = muzzleOf(e[3]); if (mz) { e[4] = mz.x; e[5] = mz.y; e[6] = mz.z; }
      const widx = e[2], def = WEAPONS[WEAPON_IDS[widx]], mesh = makeProjectile(widx);
      mesh.position.set(e[4], e[5], e[6]); mesh.lookAt(e[4] + e[7], e[5] + e[8], e[6] + e[9]); dyn.add(mesh);
      projs.set(e[1], { mesh, x: e[4], y: e[5], z: e[6], dx: e[7], dy: e[8], dz: e[9], sp: def.speed, life: def.life, trail: widx >= 4 ? 0.03 : 0.09, tt: 0, mine: e[3] === myId,
        whine: widx === 4 || widx === 5 ? sfx.torpedoWhine() : null });   // Torpedos: hohes, sirrendes Heulen
      if (def.pellets === 1 || !projs.lastShot || projs.lastShot !== time) {
        sfx.shot(widx, e[3] === myId ? 1 : volAt(e[4], e[5], e[6]), distTo(e[4], e[5], e[6]));
        if (e[3] !== myId) shotFrom(e[4], e[6]);   // Richtungsanzeige: woher wird geschossen?
      }
      projs.lastShot = time;
      if (e[3] === myId) { shake = Math.max(shake, widx >= 3 ? 0.25 : 0.08); view.kick = 1; }
      if (projs.gasT !== time) { projs.gasT = time; const mz = muzzleOf(e[3]); gasBubble(mz ? mz.x : e[4], (mz ? mz.y : e[5]) + 0.05, mz ? mz.z : e[6], widx >= 3); }   // Gasblase
      break;
    }
    case 'beam': {
      // Hitscan-Wasserstrahl: e = ['beam', Waffe, Schütze, Start x y z, Ende x y z]
      const widx = e[1], def = WEAPONS[WEAPON_IDS[widx]];
      const mz = muzzleOf(e[2]); if (mz) { e[3] = mz.x; e[4] = mz.y; e[5] = mz.z; }   // der Strahl beginnt an der Mündung
      addBeam(e[3], e[4], e[5], e[6], e[7], e[8], def.beam || 0.06);
      if (e[2] !== myId) nearMiss(e[3], e[4], e[5], e[6], e[7], e[8]);
      // ein paar Blasen entlang des Strahls
      for (let i = 0; i < 4; i++) { const k = Math.random(); env.bubble(e[3] + (e[6] - e[3]) * k, e[4] + (e[7] - e[4]) * k, e[5] + (e[8] - e[5]) * k, 1, 0.15, 0.5); }
      // Splitterwerfer schießt 7 Strahlen gleichzeitig – das Geräusch nur einmal abspielen
      if (beams.lastShot !== time) {
        sfx.jet(widx, e[2] === myId ? 1 : volAt(e[3], e[4], e[5]), distTo(e[3], e[4], e[5]));
        if (e[2] !== myId && e[2] > 0) shotFrom(e[3], e[5]);   // Richtungsanzeige: woher wird geschossen?
      }
      if (beams.lastShot !== time) gasBubble(e[3], e[4] + 0.05, e[5], widx === 3 || widx === 8);   // Gasblase an der Mündung (Harpune/Revolver: größer)
      beams.lastShot = time;
      if (e[2] === myId) { shake = Math.max(shake, widx >= 3 ? 0.25 : 0.08); view.kick = 1; }
      break;
    }
    case 'hit': removeProj(e[1]); env.bubble(e[2], e[3], e[4], 7, 0.4, 2); if (e[5] === 1 || e[5] === 3) env.blood(e[2], e[3], e[4]); sfx.hit(volAt(e[2], e[3], e[4]), e[5] === 1 || e[5] === 3); break;   // Körper: Durchschlag-Sound
    case 'boom': {
      removeProj(e[1]); env.explosion(e[2], e[3], e[4], e[5]);
      // Wasser trägt tiefe Töne sehr weit: das Grollen hört man bis 600 m, das metallische Klicken nur in der Nähe
      const d = Math.hypot(e[2] - camera.position.x, e[3] - camera.position.y, e[4] - camera.position.z);
      const far = Math.max(0, 1 - d / 600) ** 1.4, near = volAt(e[2], e[3], e[4]);
      sfx.boom(far, near);
      shake = Math.max(shake, near * 1.4 + far * 0.25);   // Druckstoß: man spürt ihn als Schlag
      break;
    }
    case 'kill': { const mine = e[3] === myId || e[4] === myId; hud.feed(`<b>${esc(e[1])}</b> ▸ <i>${esc(e[2])}</i>`, mine); spawnCorpse(e[3]); break; }
    case 'gad': onGadget(e); break;
    case 'ult': onUlti(e); break;
    // Manta in Matrix-Zeitlupe weicht aus: die Kugel zischt vorbei
    case 'dodge': { const pe = players.get(e[1]); if (pe) sfx.whoosh(0.6 * (e[1] === myId ? 1 : volAt(pe.x, pe.y, pe.z))); break; }
    // Stabwaffe: ['melee', Spieler, Waffe, getroffen, x, y, z] – Wusch, bei Treffer ein dumpfer Schlag und Blasen
    case 'melee': {
      const pe = players.get(e[1]); if (!pe) break;
      if (e[1] !== myId) sfx.noise(0.18, 700, 1, 0.3 * volAt(pe.x, pe.y, pe.z), 'bandpass', 1800);
      if (e[3]) {
        const v = e[1] === myId ? 1 : volAt(e[4], e[5], e[6]);
        sfx.tone(140, 55, 0.18, 0.8 * v, 'sine'); sfx.noise(0.12, 900, 1, 0.5 * v, 'lowpass', 200);
        env.bubble(e[4], e[5], e[6], 10, 0.4, 1.5);
        if (WEAPON_IDS[e[2]] === 'espear') { sfx.zap(0.6, 0.7 * v); for (let i = 0; i < 4; i++) { const a = Math.random() * 6.28; addBeam(e[4], e[5], e[6], e[4] + Math.cos(a), e[5] + (Math.random() - 0.5), e[6] + Math.sin(a), 0.02); } }
        if (e[1] === myId) shake = Math.max(shake, 0.15);
      }
      break;
    }
    // Treffer mit Netz oder Magnet sieht man auch bei anderen: Netz = Blasenwolke, Magnet = violette Blitze
    case 'net': { const pe = players.get(e[1]); if (pe) env.bubble(pe.x, pe.y, pe.z, 16, 0.8, 0.5); break; }
    case 'emp': {
      const pe = players.get(e[1]); if (!pe) break;
      for (let i = 0; i < 5; i++) { const a = Math.random() * 6.28, r = 1 + Math.random() * 1.5; addBeam(pe.x, pe.y + 0.6, pe.z, pe.x + Math.cos(a) * r, pe.y + 0.6 + (Math.random() - 0.5) * 2, pe.z + Math.sin(a) * r, 0.025); }
      sfx.zap(0.8, 0.6 * (e[1] === myId ? 1 : volAt(pe.x, pe.y, pe.z)));
      break;
    }
    case 'deflect': { const s = gfx.shields.get(e[1]); if (s) s.hit = 1; const pe = players.get(e[1]); if (pe) sfx.tone(1800, 900, 0.08, 0.3 * (e[1] === myId ? 1 : volAt(pe.x, pe.y, pe.z)), 'triangle'); break; }   // Schuss prallt am Schild ab
    // Hitze: ['burn', Spieler, wie heiß 0…1] – er hat sich an der überhitzten Waffe verbrannt
    case 'burn': {
      const pe = players.get(e[1]); if (!pe) break;
      const now = performance.now(); if (now - (pe.ahT || 0) > 700) { pe.ahT = now; sfx.ah(e[1] === myId ? 1 : volAt(pe.x, pe.y, pe.z)); }   // "Ah!" (nicht bei jedem Schuss)
      if (e[1] === myId) { daze.t = Math.max(daze.t, HEAT.daze * (0.35 + 0.65 * e[2])); daze.max = Math.max(daze.t, 0.1); daze.burn = 1; sfx.tinnitus(0.4 + e[2]); }
      env.bubble(pe.x, pe.y + 0.5, pe.z, 3, 0.3, 1.5);
      break;
    }
    // Hitze ablassen: ['vent', Spieler, Waffe, wie viel Hitze 0…1, hält er sie gerade] – Schockwelle, heiße Blasen, Zischen
    case 'vent': {
      const pe = players.get(e[1]); if (!pe) break;
      const mz = e[4] ? muzzleOf(e[1]) : null, P = mz ? mz.clone() : new THREE.Vector3(pe.x, pe.y + 0.3, pe.z);
      const d = e[1] === myId ? dirFrom(camYaw, camPitch) : dirFrom(pe.yaw || 0, pe.pitch || 0);
      // Wumms: Druckstrahlen aus den Kiemen + große Schallwelle, die sich weit ausbreitet (bleibt in der Welt stehen)
      const back = GILL_BACK[e[2]] ?? 0.25;
      const b = makeBlast(dyn, P.x, P.y, P.z, d[0], d[1], d[2], e[2], e[3], e[1] === myId, back); if (b) shocks.push(b);
      addShock(P.x, P.y, P.z, d[0], d[1], d[2], e[2], e[1] === myId, 0.8 + e[3] * 0.8, e[3]);   // kurzer Druckstoß aus der Mündung
      // heiße Blasen sprudeln aus beiden Kiemen
      const sx = -d[2], sz = d[0], sl = Math.hypot(sx, sz) || 1, gx = P.x - d[0] * back, gy = P.y - d[1] * back, gz = P.z - d[2] * back;
      for (const s of [1, -1]) env.bubble(gx + sx / sl * 0.12 * s, gy, gz + sz / sl * 0.12 * s, 8 + Math.round(e[3] * 25), 0.15 + e[3] * 0.3, 2.5);
      const vv = e[1] === myId ? 1 : volAt(P.x, P.y, P.z);
      sfx.ventBoom(vv, e[3], distTo(P.x, P.y, P.z)); sfx.hiss(vv, e[3]);
      // Druckwelle spürt man: Kamera wackelt (eigene stark, fremde je nach Entfernung)
      shake = Math.max(shake, e[1] === myId ? 0.35 + e[3] * 0.4 : Math.max(0, 0.4 - distTo(P.x, P.y, P.z) / 40));
      break;
    }
    case 'pk+': addPickup(e.slice(1)); break;
    case 'pk-': { const p = pickups.get(e[1]); if (p) { dyn.remove(p.mesh); pickups.delete(e[1]); } break; }
    case 'crate': { const c = crates[e[1]]; if (c) { c.userData.open(); env.bubble(c.position.x, c.position.y + 1, c.position.z, 14, 1, 1); if (volAt(c.position.x, c.position.y, c.position.z) > 0.3) sfx.crate(); } break; }
    case 'msg': hud.banner(e[1], 3.2); sfx.ping(); break;
    case 'cdie': env.blood(e[2], e[3], e[4]); env.bubble(e[2], e[3], e[4], 22, 1.5, 2); break;
    case 'bite': env.blood(e[1], e[2], e[3]); sfx.bite(volAt(e[1], e[2], e[3])); break;
    case 'ink': env.ink(e[1], e[2], e[3]); break;
    case 'fin': {
      // der Gegner verschwindet sofort, an seiner Stelle spielt eine Kopie die Finisher-Animation
      const ve = players.get(e[2]); if (ve) { dyn.remove(ve.mesh); players.delete(e[2]); }
      const f = startFinisher(finCtx, e);
      fins.push(f);
      if (e[1] === myId) { myFin = f; firing = false; }
      break;
    }
  }
}
// ---------- Finisher ----------
const fins = [];      // alle Finisher, die gerade laufen
let myFin = null;     // mein eigener (dann steuert die Animation meinen Taucher und die Kamera)
// Kamerafahrt beim eigenen Finisher: [Winkel (rad, 0 = hinter dir), Abstand (m), Höhe (m)] für die drei Abschnitte,
// zoom = so viel Grad Zoom im Moment des Treffers
const FIN_CAM = { shoulder: [0.35, 2.8, 0.6], side: [1.55, 3.6, 0.1], pull: [2.1, 6.5, 2.2], zoom: 14 };
let fpsN = 0, fpsT = 0;
let lastGrunt = 0, sonarT = 2, bleedT = 0, bleedPuff = 0;   // bleedT = so lange blutest du noch   // sonarT = Sekunden bis zum nächsten Sonar-Ping im U-Boot
const finCtx = {
  dyn, sfx, get env() { return env; },
  posOf: (id) => id === myId ? me : players.get(id),
  muzzleOf, beam: addBeam, shake: (v) => { shake = Math.max(shake, v); }, zone: () => zone,
};
// welcher Gegner kann gerade gefinisht werden? (nah genug und wenig Leben)
function finTarget() {
  if (mode === 'exp' || !you || !you.alive || you.veh || myFin) return null;
  const range = FINISHER.range[mySuit]; let best = null, bd = 1e9;
  for (const e of players.values()) {
    if (e.id === myId || !e.mesh.visible || e.hp > SUITS[e.suit].hp * FINISHER.hp) continue;
    const d = Math.hypot(e.x - me.x, e.y - me.y, e.z - me.z);
    if (d < range && d < bd) { bd = d; best = e; }
  }
  return best;
}
function updateFinishers(dt) {
  for (let i = fins.length - 1; i >= 0; i--) if (!fins[i].update(dt)) { if (fins[i] === myFin) myFin = null; fins.splice(i, 1); }
  document.body.classList.toggle("cine", !!myFin);   // Kinobalken während des eigenen Finishers
  updateDeath(dt);
  // während meines Finishers bewegt die Animation meinen Taucher
  if (myFin && myFin.pose) { const P = myFin.pose; me.x = P.x; me.y = P.y; me.z = P.z; me.vx = me.vy = me.vz = 0; me.byaw = P.yaw; me.bpitch = 0; }
}
// ---------- Selbst sterben (Battle Royale) ----------
// dim = so dunkel wird es zuerst (0…1) in dimTime Sekunden, dann in blackTime Sekunden ganz schwarz, dann "Du bist tot"
const DEATH = { dim: 0.6, dimTime: 0.9, hold: 0.5, blackTime: 1.1 };
const death = { on: false, t: 0, shown: false };
function updateDeath(dt) {
  const fx = document.getElementById('deathFx');
  if (!death.on) { if (fx.style.opacity !== '0') fx.style.opacity = '0'; return; }
  const nowS = performance.now() / 1000; death.t = nowS - (death.start ??= nowS);   // echte Zeit (gleich lang auch auf langsamen Computern)
  const D = DEATH, t = death.t, a = t < D.dimTime ? D.dim * t / D.dimTime : t < D.dimTime + D.hold ? D.dim
    : Math.min(1, D.dim + (1 - D.dim) * (t - D.dimTime - D.hold) / D.blackTime);
  fx.style.opacity = a.toFixed(3);
  if (!death.shown && a >= 1) {
    death.shown = true;
    document.getElementById('deathInfo').textContent = deadInfo ? `PLATZ ${deadInfo.place} · ERWISCHT VON ${String(deadInfo.by).toUpperCase()}` : '';
    document.getElementById('deathBox').classList.remove('hidden');
    if (document.pointerLockElement) document.exitPointerLock();
  }
}
function endDeath() { death.on = false; death.shown = false; document.getElementById('deathBox').classList.add('hidden'); }
document.getElementById('deathWatch').onclick = () => { endDeath(); lock(); };                                   // weiter zuschauen
document.getElementById('deathLobby').onclick = () => { endDeath(); hud.show('lobby'); };                       // schon den nächsten Taucher wählen
document.getElementById('deathShop').onclick = () => { endDeath(); hud.show('lobby'); document.getElementById('brShopBtn').click(); };
function onPrivate(e) {
  switch (e[0]) {
    case 'push': me.vx += e[1]; me.vy += e[2]; me.vz += e[3]; shake = Math.max(shake, 0.4); break;   // weggeschleudert (Bodenstampfer)
    case 'stun': gfx.stunUntil = performance.now() + e[1] * 1000; shockUntil = time + e[1]; hud.shock(); sfx.shock(); chargeShot = null; break;   // gelähmt (Elektroschocker)
    // viel zu heiß geschossen: Waffe wegstecken, e[1] Sekunden warten
    case 'holster': {
      holsterUntil = performance.now() + e[1] * 1000; chargeShot = null; firing = false;
      sfx.stow(); hud.banner(`Zu heiß! Waffe weggesteckt – ${e[1]} Sekunden warten …`, e[1]);
      break;
    }
    case 'hurt': { hurtT = time + 4;   // Musik wird für 4 Sekunden spannend
      if (e[4]) { hud.hurt(null); break; }
      const rel = Math.atan2(e[2] - me.x, -(e[3] - me.z)) + camYaw;
      hud.hurt(rel); sfx.hurt(); sfx.hitMe(e[1]); shake = Math.max(shake, 0.35);   // die Kugel geht durch dich durch
      // Treffer-Wackler: die Kamera wird kurz zur Seite und nach oben gerissen (stärker bei mehr Schaden)
      const jolt = Math.min(0.08, 0.01 + e[1] * 0.0015);
      camYaw += (Math.random() - 0.5) * jolt * 1.5; camPitch += (Math.random() * 0.6 - 0.2) * jolt; view.kick = Math.max(view.kick, 0.6);
      if (time - lastGrunt > 0.7) { lastGrunt = time; sfx.grunt(mySuit === 'goliath' ? 1.5 : mySuit === 'bulwark' ? 1.15 : 1); }
      break;
    }
    // Treffer: e = ['hm', Schaden, Kill, Leben übrig 0…1, Schild zerbrochen]
    case 'hm': hud.hitmark(e[1], e[2], e[3]); sfx.hitmark(e[2]); if (e[4]) sfx.shieldBreak(1); break;
    case 'bleed': bleedT = e[1]; hud.banner('Autsch! An einer scharfen Koralle geschnitten – du blutest!', 2.2); break;
    case 'shb': sfx.shieldBreak(0.8); hud.banner('Schild zerstört!', 1.2); shake = Math.max(shake, 0.35); break;   // dein eigenes Schild
    case 'warn': hud.banner(e[1], 2.5); break;
    case 'grab': hud.banner('Ein Oktopus hat dich gepackt – F hämmern!', 3); break;
    case 'shock': shockUntil = time + 0.8; hud.shock(); sfx.shock(); break;
    // vom Netz getroffen: e[1] Sekunden langsam, kein Schub
    case 'net': gfx.netUntil = time + e[1]; hud.banner('Im Netz! Du bist langsam …', 1.5); sfx.noise(0.4, 900, 1, 0.4, 'lowpass', 300); break;
    // Magnet-Treffer: e[1] Sekunden kann man sich nicht bewegen und nicht schießen (im Mech: Schaltkreise überlastet)
    case 'emp': gfx.empUntil = time + e[1]; gfx.stunUntil = performance.now() + e[1] * 1000; chargeShot = null;
      hud.banner(SUITS[mySuit].mech ? 'Magnet-Treffer! Schaltkreise überlastet …' : 'Magnet-Treffer!', Math.min(2.5, e[1])); hud.shock(); sfx.zap(1, 0.9); break;
    case 'got': sfx.pickup(); hud.feed(e[1] === 'w' ? `Aufgenommen: <b style="color:${RARITY[e[3]].color}">${WEAPONS[e[2]].name}</b> · ${RARITY[e[3]].name}` : e[1] === 'med' ? 'Reparaturkit: <b>+50 Leben</b>' : 'Schildzelle: <b>+50 Schild</b>', true); break;
    case 'dead': held = -1; deadInfo = { place: e[1], by: e[2], lost: e[3] || 0 }; firing = false; if (hud.shopOpen) hud.closeShop();
      if (mode !== 'exp') { death.t = 0; death.start = null; death.on = true; sfx.tinnitus(2); sfx.tone(70, 35, 0.8, 0.9, 'sine'); }   // Battle Royale: Bild wird dunkel, dann "Du bist tot"
      break;
    // Wellen-Modus: in der Pause zurück ins Spiel geholt
    case 'revive': endDeath(); document.getElementById('deathFx').style.opacity = '0'; me.x = e[1]; me.y = e[2]; me.z = e[3]; me.vx = me.vy = me.vz = 0; deadInfo = null; specId = 0; hud.spec(null); hud.banner('Du bist wieder dabei!', 2.5); break;
    case 'spawn': torch.on = false; torch.bat = LAMPS[torch.lvl].battery; me.x = e[1]; me.y = e[2]; me.z = e[3]; me.vx = me.vy = me.vz = 0; camYaw = e[4]; camPitch = -0.3; me.energy = 100; deadInfo = null; specId = 0; hud.spec(null); hud.banner('Du wachst am Boot wieder auf.', 2.5); break;
    case 'fish': { const S = FISH[e[1]]; sfx.pickup(); hud.feed(`${e[2] ? '⭐ <b style="color:#ffd34d">Goldener</b> ' : 'Gefangen: '}<b>${S.name}</b> · +${e[3]} €`, true); break; }
    case 'aqfree': hud.feed(`Freigelassen: <b>${catchName(catchFromNet(e[1]))}</b>`, true); break;
    case 'sold': hud.banner(`${e[1]} Fische verkauft: +${e[2].toLocaleString('de-DE')} €`, 3); sfx.ping(); break;
    case 'bought': hud.shopMsg(`Gekauft: ${e[1]}`, true); hud.feed(`Gekauft: <b>${esc(e[1])}</b>`, true); sfx.crate(); break;
    case 'shop': hud.shopMsg(e[1]); hud.banner(e[1], 2); break;
    case 'bagHint': hud.banner(`${e[1]} Fische dabei (${e[2].toLocaleString('de-DE')} €) – drück E zum Verkaufen!`, 4); break;
    case 'baseHint': hud.banner(e[1] ? 'Basis: Fang in die Hand (4–9) + E = ins Aquarium!' : 'Basis: Hier wird deine Luft aufgefüllt.', 4); sfx.ping(); break;
    case 'aqin': { const c = catchFromNet(e[1]); sfx.pickup(); hud.feed(`Ins Aquarium: <b>${catchName(c)}</b> · +${catchRate(c).toLocaleString('de-DE', { maximumFractionDigits: 2 })} €/s`, true); break; }
    case 'aqoffline': hud.banner(`Während du weg warst, hat dein Aquarium ${e[1].toLocaleString('de-DE')} € verdient!`, 5); sfx.ping(); break;
    case 'boss': hud.banner(`${BOSSES[e[1]].name} besiegt! Verkaufen: ${e[2].toLocaleString('de-DE')} € – oder ins Aquarium: ${BOSSES[e[1]].aq} €/s`, 6); hud.feed(`☠ <b>${BOSSES[e[1]].name}</b> ist in deiner Fang-Leiste – am Boot verkaufen <b>oder</b> in der Basis ins Aquarium setzen`, true); sfx.ping(); break;
  }
}
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function removeProj(id) { const p = projs.get(id); if (p) { dyn.remove(p.mesh); if (p.whine) p.whine.stop(); projs.delete(id); } }

// ---------- input ----------
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  if (phase !== 'play' || !you || !you.alive) return;
  if (e.code === 'KeyV') { firstPerson = !firstPerson; if (!firstPerson) subIn.stand = false; return; }   // Ego-Perspektive an/aus
  if (e.code === 'KeyK' && inSubFP() && nearHatch() && !myGunSub()) { const v = inSubFP(); if (!v.gunner) { switchSeat('gun'); return; } }   // Fahrer: durch die Bodenluke in die Kugel
  if (e.code === 'KeyB' && myGunSub() && subIn.gunIn && nearSeat()) { const v = myGunSub(); if (!v.driver) { switchSeat('drive'); return; } }   // Schütze im U-Boot: am Sitz ans Steuer
  if (e.code === 'KeyB' && myGunSub()) {   // Schütze: aus der Kugel ins U-Boot klettern und zurück
    subIn.gunIn = !subIn.gunIn; subIn.peri = false; subIn.stand = subIn.gunIn; subIn.x = 0; subIn.z = 0.9;
    sfx.noise(0.3, 500, 1, 0.3, 'lowpass', 150); return;
  }
  if (e.code === 'KeyB' && inSubFP()) { if (subIn.peri) subIn.peri = false; else toggleStand(); return; }   // im U-Boot aufstehen / hinsetzen
  if (e.code === 'KeyP' && inSubFP() && (subIn.peri || nearPeri())) { subIn.peri = !subIn.peri; sfx.noise(0.35, 700, 1.2, 0.25, 'bandpass', 300); return; }   // Periskop
  if (e.code === 'KeyC' && canCling()) { toggleCling(); return; }  // Deckung: am Riff festhalten / loslassen
  if (e.code === 'KeyQ' && mode !== 'exp') { useGadget(); return; } // Gadget
  if (e.code === 'Digit4' && mode !== 'exp') { useUlti(); return; } // Ulti
  if (e.code === 'KeyG') { const t = finTarget(); if (t) send({ t: 'fin', id: t.id }); return; }   // Finisher
  if (e.code === 'KeyL') {
    if (mode === 'exp' && torch.bat <= 0) hud.banner('Lampe leer – oben an der Oberfläche aufladen!', 2);
    else { torch.on = !torch.on; sfx.hitmark(false); }
    return;
  }
  if (mode === 'exp' && e.code === 'KeyE') {
    if (hud.shopOpen) closeShop();
    else if (held >= 0 && nearBase()) placeHeld();
    else if (nearBoat()) openShop('boat'); else if (nearBase()) openShop('base');
    return;
  }
  // catch bar: 4-9 take a fish/boss in the hand (same key again = back to the weapon), Q = next one
  if (mode === 'exp' && /^Digit[4-9]$/.test(e.code)) {
    const i = (held >= 6 ? held - 5 : 0) + (+e.code.slice(5) - 4);
    held = held === i || !you.x.bagL[i] ? -1 : i; firing = false; return;
  }
  if (mode === 'exp' && e.code === 'KeyQ') { const n = you.x.bagL.length; held = held + 1 < n ? held + 1 : -1; firing = false; return; }
  if (/^Digit[1-3]$/.test(e.code)) held = -1;
  if (e.code === 'KeyH' && mode !== 'exp') { setHolster(!holster.on); return; }   // Waffe wegstecken / rausholen
  if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') { const i = +e.code.slice(5) - 1; if (you.w[i] && i !== you.slot) { send({ t: 'slot', i }); holster.readyAt = performance.now() + DRAW_TIME * UP('draw') * 1000; } if (holster.on) setHolster(false); }   // Waffe ziehen braucht kurz Zeit
  else if (e.code === 'KeyR') send({ t: 'r' });
  else if (e.code === 'KeyE') send({ t: 'e' });
  else if (e.code === 'KeyF') { send({ t: 'x' }); env.bubble(me.x, me.y, me.z, 4, 1, 2); }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; firing = false; });
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  const sens = 0.0022 * settings.sens * camera.fov / FOV;   // Mausempfindlichkeit aus den Einstellungen; mit Zoom entsprechend langsamer
  const my = e.movementY * sens * (settings.invertY ? -1 : 1);
  if (mechFree() && !scoping) {   // Freelook: nur den Kopf drehen
    head.yaw = Math.max(-FREELOOK.yaw, Math.min(FREELOOK.yaw, head.yaw - e.movementX * sens));
    head.pitch = Math.max(-FREELOOK.pitchDown, Math.min(FREELOOK.pitchUp, head.pitch - my));
    return;
  }
  camYaw -= e.movementX * sens; camPitch = Math.max(-1.45, Math.min(1.45, camPitch - my));
});
// Freelook gibt es nur im Mech, in der Ego-Sicht, lebendig und nicht im Fahrzeug
function mechFree() { return fpOn && !!(you && you.alive) && !!SUITS[mySuit].mech && !you.veh; }
const QH = new THREE.Quaternion(), QB = new THREE.Quaternion(), EB = new THREE.Euler(0, 0, 0, 'YXZ');
// jedes Bild: beim Rechtsklick dreht der Mech zum Blick (der Kopf kommt dabei zurück nach vorne)
function updateHead(dt) {
  if (!mechFree()) { head.yaw = head.pitch = 0; return; }
  if (scoping) {
    const k = Math.min(1, dt * FREELOOK.turn), dy = head.yaw * k, dp = head.pitch * k;
    camYaw += dy; head.yaw -= dy;
    const np = Math.max(-1.45, Math.min(1.45, camPitch + dp)); head.pitch -= np - camPitch; camPitch = np;
  }
}
const lock = () => { sfx.init(); if (phase === 'play' && document.pointerLockElement !== canvas) canvas.requestPointerLock?.(); };
canvas.addEventListener('mousedown', (e) => { if (document.pointerLockElement !== canvas) { lock(); return; } if (e.button === 2) { scoping = true; return; } if (e.button !== 0) return; if (held >= 0) { if (nearBase()) placeHeld(); return; } firing = true; });
document.getElementById('pause').addEventListener('click', lock);
// Einstellungen: aus der Lobby und aus dem Pause-Bildschirm (Esc) erreichbar
hud.initBrShop((k) => send({ t: 'brbuy', k }));   // Perlen-Shop in der Lobby
hud.initLoadout((m) => send({ t: 'load', ...m }));   // Ausrüstungs-Fenster pro Taucher
for (const id of ['setBtnLobby', 'setBtnPause']) document.getElementById(id).addEventListener('click', (e) => { e.stopPropagation(); openSettings(); });
document.getElementById('tutBtn').addEventListener('click', (e) => { e.stopPropagation(); tut.restart(); hud.banner('Die Einführung startet in der nächsten Runde', 2); });
addEventListener('keydown', (e) => { if (e.code === 'Escape') closeSettings(); });

addEventListener('mouseup', (e) => { if (e.button === 0) firing = false; if (e.button === 2) scoping = false; });
addEventListener('wheel', (e) => {
  if (phase !== 'play' || !you || !you.alive) return;
  const dir = e.deltaY > 0 ? 1 : -1;
  for (let k = 1; k <= 3; k++) { const i = (you.slot + dir * k + 6) % 3; if (you.w[i]) { if (i !== you.slot) send({ t: 'slot', i }); break; } }
}, { passive: true });
addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('pointerlockchange', () => { if (isTouch()) return; hud.pause(phase === 'play' && document.pointerLockElement !== canvas); if (document.pointerLockElement !== canvas) firing = false; });
// Handy-Steuerung (nur mit Touchscreen): Joystick, Wischen zum Umschauen, Knöpfe (touch.js)
const touch = initTouch({
  lookBy(dx, dy) { if (phase !== 'play') return; if (mechFree() && !scoping) { head.yaw = Math.max(-FREELOOK.yaw, Math.min(FREELOOK.yaw, head.yaw - dx)); head.pitch = Math.max(-FREELOOK.pitchDown, Math.min(FREELOOK.pitchUp, head.pitch - dy)); return; }
    camYaw -= dx; camPitch = Math.max(-1.45, Math.min(1.45, camPitch - dy)); },
  fire(on) { sfx.init(); firing = on && phase === 'play'; },
  scope(on) { scoping = on; },
  playing: () => phase === 'play',
});

// ---------- Deckung: Triton und Manta halten sich mit C an einem Riff-Hügel fest ----------
// reach = so viele Meter darf man höchstens vom Hügel weg sein, sway = Zielwackeln beim Festhalten (0.35 = nur noch 35 %)
const CLING = { reach: 1.8, sway: 0.35 };
let cling = null;   // { x, y, z } = hier hängt man gerade, null = man schwimmt frei
const canCling = () => mode !== 'exp' && (mySuit === 'triton' || mySuit === 'manta') && you && you.alive && !you.veh;   // nur Battle Royale
function nearReef() {
  const R = SUITS[mySuit].r;
  for (const m of (W && W.reefMounds) || []) {
    const d = Math.hypot(me.x - m.x, me.y - m.y, me.z - m.z) - m.r * (m.sx + m.sy + m.sz) / 3 * REEF_HITBOX - R;
    if (d < CLING.reach) return true;
  }
  return false;
}
function toggleCling() {
  if (cling) { cling = null; sfx.noise(0.15, 500, 1, 0.25, 'lowpass', 200); return; }
  if (!nearReef()) { hud.banner('Zu weit weg – schwimm näher an den Riff-Hügel!', 1.2); return; }
  cling = { x: me.x, y: me.y, z: me.z }; me.vx = me.vy = me.vz = 0;
  sfx.noise(0.12, 900, 1, 0.35, 'lowpass', 300); sfx.tone(160, 90, 0.08, 0.25, 'sine');   // Hand packt den Fels
}
// ---------- Flüssig schwimmen ----------
// input = wie schnell die Tasten "anlaufen" (kleiner = weicher), accel = wie schnell man auf Tempo kommt,
// glide = wie schnell man ausgleitet, wenn man loslässt (kleiner = längeres Gleiten),
// roll = wie stark sich die Kamera beim Seitwärtsschwimmen neigt, rollSpeed = wie schnell sie das tut
const FLOW = { input: 8, accel: 4.5, glide: 2.2, roll: 0.045, rollSpeed: 4 };
const flow = { f: 0, s: 0, u: 0, roll: 0 };
// ---------- local player ----------
function controlMe(dt) {
  const gs = myGunSub();
  if (gs) {   // Schütze: man hängt in der Kugel unter dem U-Boot, der Fahrer bewegt alles
    me.x = gs.x; me.y = gs.y + BALL_DY - eyeHeight(mySuit); me.z = gs.z; me.vx = me.vy = me.vz = 0; me.hyaw = me.byaw = camYaw; me.hpitch = me.bpitch = camPitch;
    gs.gyaw = camYaw; gs.gpitch = camPitch;   // eigene Kugel sofort mitdrehen (nicht erst, wenn der Server antwortet)
    return;
  }
  const S = SUITS[mySuit], v = you.veh ? vehicles.get(you.veh) : null, vt = v ? v.type : null;
  if (mySuit === 'goliath' && ultOn()) autoAim(dt);   // Zielcomputer-Ulti
  let speed = S.speed * UP('swim') * (holster.on ? HOLSTER.speed : 1) * ((mySuit === 'manta' || mySuit === 'hammerhai') && ultOn() ? ULTIS[mySuit].speed : 1), accel = 5, r = S.r, strafe = 1, canBoost = true;   // Profi-Flossen
  if (vt === 'ray') { const J = VEHICLES.ray; speed = J.speed; accel = J.accel; strafe = J.strafe; r = J.r; canBoost = false; }
  if (vt === 'jetski') { const J = VEHICLES.jetski; speed = J.speed; accel = J.accel; strafe = J.strafe; r = J.r; canBoost = false; }
  if (vt === 'scooter') { speed = VEHICLES.scooter.speed; accel = VEHICLES.scooter.accel; strafe = 0.35; r = VEHICLES.scooter.r; canBoost = false; }
  else if (vt === 'sub') { speed = VEHICLES.sub.speed; accel = VEHICLES.sub.accel; strafe = 0; r = VEHICLES.sub.r; canBoost = false; }
  if (vt === 'sub' && subIn.stand) { /* im U-Boot herumlaufen: das U-Boot behält seine Richtung */ }
  else if (vt === 'jetski' || vt === 'ray') { const J = VEHICLES[vt]; me.hyaw = approachAngle(me.hyaw, camYaw, J.turn * dt); me.hpitch += Math.max(-J.turn * dt, Math.min(J.turn * dt, camPitch - me.hpitch)); }   // Jetski: weite Kurven
  else if (vt === 'sub') { me.hyaw = approachAngle(me.hyaw, camYaw, 1.6 * dt); me.hpitch += Math.max(-1.1 * dt, Math.min(1.1 * dt, camPitch - me.hpitch)); }
  else { me.hyaw = camYaw; me.hpitch = camPitch; }
  const shop = hud.shopOpen || (vt === 'sub' && subIn.stand);   // im Shop nicht schwimmen; wer im U-Boot steht, steuert nicht (es bremst ab)
  const down = canCling() ? keys.KeyX : (keys.KeyC || keys.KeyX);   // Triton/Manta: C = festhalten, also sinken nur mit X
  const f = shop ? 0 : (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), s = shop ? 0 : (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), u = shop ? 0 : (keys.Space ? 1 : 0) - (down ? 1 : 0);
  // Tasten weich anlaufen lassen (zu Fuß), damit Richtungswechsel nicht eckig sind; Fahrzeuge reagieren direkt
  const ki = vt ? 1 : Math.min(1, dt * FLOW.input);
  flow.f += (f - flow.f) * ki; flow.s += (s - flow.s) * ki; flow.u += (u - flow.u) * ki;
  if (!vt) accel = (f || s || u) ? FLOW.accel : FLOW.glide;   // loslassen = im Wasser ausgleiten
  flow.roll += (-flow.s * FLOW.roll * (vt ? 0 : 1) - flow.roll) * Math.min(1, dt * FLOW.rollSpeed);
  const fw = dirFrom(me.hyaw, me.hpitch), rx = Math.cos(me.hyaw), rz = -Math.sin(me.hyaw);
  let wx = fw[0] * flow.f + rx * flow.s * strafe, wy = fw[1] * flow.f + flow.u, wz = fw[2] * flow.f + rz * flow.s * strafe;
  const wl = Math.hypot(wx, wy, wz); if (wl > 1) { wx /= wl; wy /= wl; wz /= wl; }
  // body direction: swimming backwards (S) the diver turns around and faces where he swims;
  // otherwise (and while shooting) he looks where the camera looks
  const hl = Math.hypot(wx, wz);
  if (!vt && f < 0 && !firing && hl > 0.1) {
    me.byaw = approachAngle(me.byaw ?? me.hyaw, Math.atan2(-wx, -wz), 7 * dt);
    me.bpitch += (Math.atan2(wy, hl) * 0.8 - me.bpitch) * Math.min(1, dt * 5);
  } else {
    me.byaw = approachAngle(me.byaw ?? me.hyaw, me.hyaw, (vt ? 50 : 9) * dt);
    me.bpitch += (me.hpitch - me.bpitch) * Math.min(1, dt * (vt ? 50 : 8));
  }
  // Seilharpune: das Seil zieht dich schnell zum Fels (bis 2 m davor oder nach 1,2 s)
  if (gfx.grapple) {
    const G0 = gfx.grapple, gx = G0.x - me.x, gy = G0.y - me.y, gz = G0.z - me.z, gl = Math.hypot(gx, gy, gz);
    G0.t -= dt;
    if (gl < 2 || G0.t <= 0 || vt) gfx.grapple = null;
    else { const sp = 34; me.vx = gx / gl * sp; me.vy = gy / gl * sp; me.vz = gz / gl * sp; cling = null; }
  }
  // am Riff festhalten: ganz still hängen. Wegschwimmen (WASD, Leertaste, X) lässt los.
  if (cling && (f || s || u || vt || you.grab || !canCling())) cling = null;
  if (cling) {
    me.x = cling.x; me.y = cling.y; me.z = cling.z; me.vx = me.vy = me.vz = 0; me.boost = false;
    me.energy = Math.min(100, me.energy + 13 * dt);
    return;
  }
  me.boost = canBoost && (keys.ShiftLeft || keys.ShiftRight) && wl > 0.1 && !me.exhaust;
  if (me.boost) { me.energy = Math.max(0, me.energy - 26 * dt); if (me.energy <= 0) me.exhaust = true; speed *= S.boost; }
  else { me.energy = Math.min(100, me.energy + 13 * dt); if (me.energy > 20) me.exhaust = false; }
  if (you.grab) speed *= 0.3;
  if (time < shockUntil) speed *= 0.5;
  if (time < (gfx.netUntil || 0)) { speed *= 0.35; me.boost = false; }   // im Netz
  if (time < (gfx.empUntil || 0)) speed = 0;                           // Magnet-Treffer: lahm
  const k = Math.min(1, accel * dt);
  me.vx += (wx * speed - me.vx) * k; me.vy += (wy * speed - me.vy) * k; me.vz += (wz * speed - me.vz) * k;
  me.x += me.vx * dt; me.y += me.vy * dt; me.z += me.vz * dt;
  // divers may swim right up until head and shoulders are out of the water (vehicles stay below)
  // Expedition: bis an die Oberfläche (Kopf schaut raus). Battle Royale: Tiefsee, die obere Grenze liegt tief unter der Oberfläche
  // Notausgang aktiv: sanft zum nächsten freien Platz gleiten – OHNE Kollision mit Hügeln (die würde einen zurückschieben)
  if (me.escape) {
    const E = me.escape, ex = E.x - me.x, ey = E.y - me.y, ez = E.z - me.z, el = Math.hypot(ex, ey, ez), st = Math.min(el, 8 * dt);
    if (el < 0.05) me.escape = null; else { me.x = me.x - me.vx * dt + ex / el * st; me.y = me.y - me.vy * dt + ey / el * st; me.z = me.z - me.vz * dt + ez / el * st; me.vx = me.vy = me.vz = 0; }
    me.y = Math.max(me.y, W.heightAt(me.x, me.z) + r);
  } else W.collide(me, r, mode === 'exp' ? (vt ? undefined : SURFACE - 0.15) : SURFACE - DEEP.brCeil);
  // Notausgang: wer schwimmen will, aber 1 Sekunde lang zwischen Hügeln festhängt, gleitet zum nächsten freien Platz
  if (!me.escape && wl > 0.1 && me.hits > 0) {
    me.stuckT = (me.stuckT || 0) + dt;
    if (!me.stuckFrom) me.stuckFrom = { x: me.x, y: me.y, z: me.z };
    if (me.stuckT > 1.2) {   // in 1,2 s weniger als 1 m vorangekommen, obwohl man schwimmt
      if (Math.hypot(me.x - me.stuckFrom.x, me.y - me.stuckFrom.y, me.z - me.stuckFrom.z) < 1) me.escape = W.freeSpot(me.x, me.y, me.z, r);
      me.stuckT = 0; me.stuckFrom = null;
    }
  } else { me.stuckT = 0; me.stuckFrom = null; }
  // splash when breaking through the surface
  const atTop = SURFACE - me.y < 0.6;
  if (atTop && !me.surfaced && me.vy > 0.5) { env.bubble(me.x, SURFACE - 0.4, me.z, 28, 1.4, 1.5); sfx.noise(0.45, 1100, 0.7, 0.35, 'lowpass', 250); }
  me.surfaced = atTop;
}
// ---------- aquariums in the underwater bases: every base shows its owner's fish ----------
const aqViews = new Map(); let aqWorld = null;
function updateAquarium(dt) {
  if (mode !== 'exp' || !env || !env.bases || !env.bases.length || !you || !you.x) return;
  if (aqWorld !== env) { aqWorld = env; aqViews.clear(); }   // new world
  env.bases.forEach((B, i) => updateTank(B, i, dt));
}
function updateTank(B, i, dt) {
  const o = (baseInfo || []).find(b => b[0] === i), list = o ? o[3] : [];
  let v = aqViews.get(i); if (!v) { v = { key: '', fish: [], label: '' }; aqViews.set(i, v); }
  const mine = !!o && o[1] === myId, label = !o ? 'Freie Basis' : mine ? '🐠 DEINE BASIS' : '🐠 Basis von ' + o[2];
  if (label !== v.label) { v.label = label; B.setOwner(label, mine); }
  const key = JSON.stringify(list);
  if (key !== v.key) {   // the fish in the tank changed: rebuild them
    v.key = key;
    for (const f of v.fish) f.mesh.removeFromParent();
    v.fish = list.map((net) => {
      const c = catchFromNet(net), mesh = makeTrophy(c, c.b != null ? 1.6 + c.b * 0.2 : 0.45 + FISH[c.s].size * 0.45); B.tank.add(mesh);
      const a = Math.random() * 6.28, r = Math.random() * B.tankR;
      return { mesh, x: Math.cos(a) * r, y: B.tankH[0] + Math.random() * (B.tankH[1] - B.tankH[0]), z: Math.sin(a) * r, tx: 0, ty: 2, tz: 0, yaw: 0, t: 0 };
    });
  }
  // only animate when you are close enough to see it
  if (Math.hypot(camera.position.x - B.group.position.x, camera.position.y - B.group.position.y, camera.position.z - B.group.position.z) > 80) return;
  for (const f of v.fish) {
    if ((f.t -= dt) <= 0) {
      f.t = 2 + Math.random() * 3; const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * B.tankR;
      f.tx = Math.cos(a) * r; f.tz = Math.sin(a) * r; f.ty = B.tankH[0] + Math.random() * (B.tankH[1] - B.tankH[0]);
    }
    const dx = f.tx - f.x, dy = f.ty - f.y, dz = f.tz - f.z, d = Math.hypot(dx, dy, dz) || 1, sp = Math.min(d, 0.6 * dt);
    f.x += dx / d * sp; f.y += dy / d * sp; f.z += dz / d * sp;
    f.yaw = lerpAngle(f.yaw, Math.atan2(-dx, -dz), Math.min(1, dt * 3));
    f.mesh.position.set(f.x, f.y, f.z);
    f.mesh.userData.update(dt, { yaw: f.yaw, pitch: Math.asin(Math.max(-0.5, Math.min(0.5, dy / d))) * 0.5, state: 0 });
  }
}
// minimap names: boat, "Deine Basis" for yours, the owner's name for the others
function expPois() {
  const l = [{ n: 'Boot', x: EXP_BOAT.x, z: EXP_BOAT.z }];
  W.bases.forEach((b, i) => { const o = (baseInfo || []).find(q => q[0] === i); if (you && you.x && you.x.base === i) l.push({ n: 'Deine Basis', x: b.c.x, z: b.c.z }); else if (o) l.push({ n: o[2], x: b.c.x, z: b.c.z }); });
  return l;
}
// put the fish/boss in your hand into the aquarium
function placeHeld() {
  if (held < 0 || !you.x.bagL[held]) return;
  send({ t: 'buy', k: 'aq', i: held }); held = -1;
}
// ---------- Leuchtende Quallen und Korallen als schwache Lichtquellen ----------
// Jedes Licht kostet Rechenzeit, darum gibt es nur GLOW.lights Stück. Sie springen viermal pro Sekunde zu den
// Quallen und leuchtenden Korallen, die dir am nächsten sind. So sieht man um sie herum dezent den Boden.
const GLOW = { lights: 8, range: 10, jelly: 16, coral: 5, near: 70 };   // Helligkeit: Quallen 16, Korallen 5
const glowLights = [];
for (let i = 0; i < GLOW.lights; i++) { const l = new THREE.PointLight(0xffffff, 0, GLOW.range, 2); scene.add(l); glowLights.push(l); }
let glowT = 0, glowPick = [];
function updateGlow(dt) {
  if (!env) return;
  const cp = camera.position, d2 = (o) => (o.x - cp.x) ** 2 + (o.y - cp.y) ** 2 + (o.z - cp.z) ** 2, max = GLOW.near * GLOW.near;
  glowT -= dt;
  if (glowT <= 0) {   // die nächsten Leuchtquellen suchen
    glowT = 0.25;
    const cand = [];
    for (const c of creatures.values()) if (c.type === 'jelly') { const d = d2(c); if (d < max) cand.push({ c, d }); }
    for (const g of env.glow || []) { const d = d2(g); if (d < max) cand.push({ g, d }); }
    cand.sort((a, b) => a.d - b.d); glowPick = cand.slice(0, GLOW.lights);
  }
  glowLights.forEach((l, i) => {
    const p = glowPick[i];
    if (!p) { l.intensity = 0; return; }
    if (p.c) {   // Qualle: wandert mit und pulsiert mit ihrem Schwimmtakt
      l.position.set(p.c.x, p.c.y + 0.2, p.c.z); l.color.setHex(p.c.mesh.userData.glowColor || 0x7ae6ff);
      l.intensity = GLOW.jelly * (0.75 + 0.25 * Math.sin(time * 2.4 + i));
    } else { l.position.set(p.g.x, p.g.y, p.g.z); l.color.setHex(p.g.col); l.intensity = p.g.I || GLOW.coral; }
  });
}
// ---------- Licht ----------
// Je tiefer, desto dunkler. darkDepth = ab hier ist es fast schwarz (nur noch ambientMin übrig), sunDepth = hier endet das Sonnenlicht.
// Battle Royale wird schneller dunkel, in der Expedition etwas langsamer (dort hat die Lampe einen Akku).
// Im Battle Royale ist man immer in der Tiefsee (DEEP.brOffset Meter), dort kommt gar kein Sonnenlicht mehr an.
const LIGHT = { br: { darkDepth: 70, sunDepth: 40, ambientMin: 0.03 }, exp: { darkDepth: 60, sunDepth: 30, ambientMin: 0.025 } };
const depthOffset = () => mode === 'exp' ? 0 : DEEP.brOffset;   // so viele Meter kommen zur echten Tiefe dazu
const BR_LAMP = { range: 70, power: 300, angle: 0.34, battery: Infinity };   // Helmlampe im Battle Royale (enger Kegel)
function updateTorch(dt, depth) {
  const exp = mode === 'exp', lvl = exp ? you.x.lamp || 0 : 0, L = exp ? LAMPS[lvl] : BR_LAMP;
  if (exp && lvl !== torch.lvl) { torch.lvl = lvl; torch.bat = L.battery; }   // new lamp bought: comes fully charged
  if (!exp) torch.bat = Infinity;
  else if (depth < 2.6) torch.bat = Math.min(L.battery, torch.bat + L.battery * 0.25 * dt);
  else if (torch.on && you.alive) {
    torch.bat = Math.max(0, torch.bat - dt);
    if (torch.bat <= 0) { torch.on = false; hud.banner('Lampe leer – oben an der Oberfläche aufladen!', 3); }
  }
  if (!torch.hinted && !torch.on && depth > (exp ? 70 : 30) && torch.bat > 0) { torch.hinted = true; hud.banner('Zu dunkel? Drück L für die Taschenlampe!', 3.5); }
  const on = torch.on && you.alive && !inSubFP(), isMech = !!SUITS[mySuit].mech;   // im U-Boot innen ist Licht – die Lampe würde nur blenden
  // Goliath: zwei Lampen an der Kuppel, die mittlere (Brust-)Lampe bleibt aus
  for (const M of mechLamps) {
    M.l.intensity = on && isMech ? L.power * MECH_LAMPS.power : 0; M.b.visible = M.l.intensity > 0;
    if (!M.b.visible) continue;
    const yaw = me.hyaw ?? camYaw, d = dirFrom(yaw, camPitch), rx = Math.cos(yaw), rz = -Math.sin(yaw), Ls = MECH_LAMPS;
    M.l.distance = L.range;
    M.l.position.set(me.x + rx * Ls.side * M.s + d[0] * Ls.fwd, me.y + Ls.up + d[1] * Ls.fwd, me.z + rz * Ls.side * M.s + d[2] * Ls.fwd);
    M.l.target.position.set(me.x + d[0] * Ls.focus, me.y + Ls.up + d[1] * Ls.focus, me.z + d[2] * Ls.focus);
    const tx = M.l.target.position.x - M.l.position.x, ty = M.l.target.position.y - M.l.position.y, tz = M.l.target.position.z - M.l.position.z;
    const len = L.range * 0.5, r = len * Math.tan(0.3) * 0.7;
    M.b.scale.set(r, r, len); M.b.position.copy(M.l.position); M.b.rotation.set(Math.atan2(ty, Math.hypot(tx, tz)), Math.atan2(-tx, -tz), 0);
  }
  lamp.intensity = on && !isMech ? L.power : 0; lamp.distance = L.range; lamp.angle = L.angle;
  // die Lampe sitzt vorne am Helm und zeigt dorthin, wo du hinschaust
  const dir = dirFrom(camYaw, camPitch), up = SUITS[mySuit].mech ? 1.4 : 0.15, fwd = SUITS[mySuit].mech ? 0.5 : 0.65;
  lamp.position.set(me.x + dir[0] * fwd, me.y + up + dir[1] * fwd, me.z + dir[2] * fwd);
  lamp.target.position.set(lamp.position.x + dir[0] * 10, lamp.position.y + dir[1] * 10, lamp.position.z + dir[2] * 10);
  torchBeam.visible = lamp.intensity > 0;
  if (torchBeam.visible) {
    const len = L.range * 0.6, r = len * Math.tan(L.angle) * 0.75;
    torchBeam.scale.set(r, r, len);
    torchBeam.position.copy(lamp.position);
    torchBeam.rotation.set(camPitch, camYaw, 0);
  }
}
// Umgebungslicht (hemi) und Sonne werden mit der Tiefe schwächer – nicht gleichmäßig, sondern zuerst schnell, dann langsam
function darkness(dep, D) {
  const a = Math.max(0, Math.min(1, 1 - dep / D.darkDepth)), s = Math.max(0, Math.min(1, 1 - dep / D.sunDepth));
  hemi.intensity = 1.25 * Math.max(D.ambientMin, a * a);
  sun.intensity = 1.35 * s * s;
}
function aimDir() {
  const cd = dirFrom(camYaw, camPitch), cp = camera.position;
  let D = 150;
  const t = W.segmentHit(cp.x, cp.y, cp.z, cp.x + cd[0] * D, cp.y + cd[1] * D, cp.z + cd[2] * D);
  if (t > 0) D *= t;
  // aimAt merkt sich, wen das Fadenkreuz trifft: [1, id] = Spieler, [3, id] = Kreatur (für den Lag-Ausgleich am Server)
  aimAt = null;
  const test = (x, y, z, r, who) => { const tt = segSphere(cp.x, cp.y, cp.z, cd[0] * D, cd[1] * D, cd[2] * D, x, y, z, r); if (tt > 0) { D *= tt; aimAt = who; } };
  for (const e of players.values()) if (e.id !== myId) test(e.x, e.y, e.z, SUITS[e.suit].r, [1, e.id]);
  for (const [id, c] of creatures) test(c.x, c.y, c.z, c.r, [3, id]);
  D = Math.max(D, camDist + 5);
  // Richtung vom Schuss-Start (Augenhöhe, wie im Server) zum Punkt unter dem Fadenkreuz
  const ax = cp.x + cd[0] * D - me.x, ay = cp.y + cd[1] * D - (me.y + eyeHeight(mySuit)), az = cp.z + cd[2] * D - me.z, l = Math.hypot(ax, ay, az) || 1;
  return [ax / l, ay / l, az / l];
}
let aimAt = null;
// Aufladen: chargeShot merkt sich, welche Waffe gerade Druck aufbaut. Nach chargeEnd geht der Schuss raus,
// auch wenn man die Maustaste schon losgelassen hat. Waffe gewechselt, Nachladen oder tot → Schuss fällt aus.
let chargeShot = null, chargeStart = 0, chargeEnd = 0, holsterUntil = 0;
// Waffe selbst wegstecken (Taste H): Hände frei, 8 % schneller schwimmen. Rausholen dauert HOLSTER.draw Sekunden.
const HOLSTER = { speed: 1.08 };   // Rausholen dauert DRAW_TIME (shared.js), mit Schnellziehen kürzer
const holster = { on: false, readyAt: 0 };
function setHolster(on) {
  if (on === holster.on) return;
  holster.on = on; chargeShot = null;
  if (on) { firing = false; sfx.stow(); } else { holster.readyAt = performance.now() + DRAW_TIME * UP('draw') * 1000; sfx.cockBack(); }
}
function tryFire(now) {
  if (subIn.stand) return;   // im U-Boot herumlaufen: nicht schießen
  if (holster.on) { if (firing) { setHolster(false); firing = false; } return; }   // Klick holt die Waffe raus (schießt noch nicht)
  if (now < holster.readyAt) return;
  if (now < holsterUntil || now < gfx.stunUntil) return;   // Waffe weggesteckt (zu heiß) oder gelähmt
  if (chargeShot) {
    if (now < chargeEnd) return;
    const c = chargeShot; chargeShot = null;
    const w = you && you.alive && you.slot === c.slot && !you.veh ? you.w[you.slot] : null;
    if (w && w[0] === c.id && you.rl <= 0 && w[2] > 0) { w[2]--; shoot(null, w); }
    return;
  }
  if (!firing || held >= 0) return;
  const v = you.veh ? vehicles.get(you.veh) : null;
  let rate, w = null;
  if (v && v.type === 'sub' && v.gunner === myId) rate = SUB_MG_RATE;   // MG der Kugel
  else if (v && v.type === 'sub') rate = WEAPONS.subtorp.rate;
  else if (v && v.type === 'ray') rate = VEHICLES.ray.torpRate;   // Torpedo-Rochen
  else { w = you.w[you.slot]; if (!w || you.rl > 0 || w[2] <= 0) return; rate = modDef(w[0], w[4]).rate; }
  if (now < nextFire) return;
  const ct = w ? (SHOT_CHARGE[w[0]] || 0) * 1000 : 0;
  nextFire = now + Math.max(1000 / rate, ct * 2);   // Aufladen + Druckwelle müssen vorbei sein
  if (ct > 0) {
    chargeShot = { slot: you.slot, id: w[0] }; chargeStart = now; chargeEnd = now + ct;
    sfx.charge(WEAPON_IDS.indexOf(w[0]), ct / 1000);
    return;
  }
  if (w && !WEAPONS[w[0]].melee) w[2]--;   // Stabwaffen haben keine Munition
  shoot(v, w);
}
function shoot(v, w) {
  tutShots++; lastShotT = time;
  view.lastShotT = performance.now();   // nach einem Schuss nicht gleich wieder Brustschwimmen
  const d = aimDir().map(x => +x.toFixed(4));
  send(aimAt ? { t: 'f', d, a: aimAt } : { t: 'f', d });
  if (w && WEAPONS[w[0]].melee) { view.kick = 1; view.kickPow = 1; sfx.noise(0.18, 700, 1, 0.35, 'bandpass', 1800); return; }   // Stoß: Waffe fährt nach vorne, Wusch
  recoil(v ? (v.gunner === myId ? WEAPONS.spikemg : WEAPONS.subtorp) : modDef(w[0], w[4]));
}
function computePrompt() {
  if (!you || !you.alive) return null;
  if (you.grab) return ['F', 'Befreien – mehrfach drücken!'];
  if (cling) return ['C', 'Loslassen (oder wegschwimmen)'];
  if (canCling() && nearReef()) return ['C', 'Am Riff festhalten (Deckung)'];
  if (mode === 'exp' && held >= 0 && !hud.shopOpen && nearBase()) { const c = catchFromNet(you.x.bagL[held]); return ['E', `${catchName(c)} ins Aquarium setzen (+${catchRate(c).toLocaleString('de-DE', { maximumFractionDigits: 2 })} €/s)`]; }
  if (mode === 'exp' && !hud.shopOpen && !nearBoat() && !nearBase() && otherBaseOwner()) return ['–', `Basis von ${otherBaseOwner()} · nur Luft tanken`];
  if (mode === 'exp') return hud.shopOpen ? null : nearBoat() ? ['E', 'Händler-Boot: Fische verkaufen & Ausrüstung'] : nearBase() ? ['E', 'Unterwasser-Basis: Aquarium'] : null;
  const ft = finTarget(); if (ft) return ['G', `Finisher: ${ft.name}`];
  if (myGunSub() && !subIn.gunIn) return ['B', 'Aus der Kugel ins U-Boot klettern'];
  if (myGunSub() && subIn.gunIn && nearSeat() && !myGunSub().driver) return ['B', 'Ans Steuer setzen'];
  if (myGunSub() && subIn.gunIn && !subIn.peri && !nearPeri()) return ['B', 'Zurück in die MG-Kugel'];
  if (inSubFP() && !myGunSub() && nearHatch() && !inSubFP().gunner) return ['K', 'Durch die Luke in die MG-Kugel'];
  if (inSubFP()) return subIn.peri ? ['P', 'Periskop einfahren'] : subIn.stand ? (nearPeri() ? ['P', 'Durchs Periskop schauen'] : nearSeat() ? ['B', 'Hinsetzen und steuern'] : null) : ['B', 'Aufstehen und im U-Boot umsehen'];
  if (you.veh) { if (!vehSince) vehSince = time; return time - vehSince < 4 ? ['E', 'Aussteigen'] : null; }
  vehSince = 0;
  const S = SUITS[mySuit]; let best = null, bd = 1e9;
  const d3 = (o) => Math.hypot(o.x - me.x, o.y - me.y, o.z - me.z);
  for (const p of pickups.values()) if (p.k === 'w') { const d = d3(p); if (d < S.r + 3.5 && d < bd) { bd = d; best = ['E', `${WEAPONS[p.wid].name} (${RARITY[p.rar].name}) ${you.w.includes(0) ? 'aufheben' : 'tauschen'}`]; } }
  crates.forEach((c) => { if (!c.userData.isOpen) { const d = d3(c.position); if (d < S.r + 4.5 && d < bd) { bd = d; best = ['E', 'Truhe öffnen']; } } });
  if (!S.mech) for (const v of vehicles.values()) { const d = d3(v) - (v.type === 'sub' ? 2 : 0); if (d >= S.r + 4.5 || d >= bd) continue;
    if (!v.driver && !v.gunner) { bd = d; best = v.type === 'sub' && me.y < v.y - 1.2 ? ['E', 'Unten in die MG-Kugel steigen'] : ['E', `${VEHICLES[v.type].name} steuern`]; }
    else if (!v.driver && v.type === 'sub') { bd = d; best = ['E', 'Mini-U-Boot steuern']; }
    else if (v.type === 'sub' && !v.gunner && isMate(v.driver)) { bd = d; best = ['E', 'Als Schütze in die MG-Kugel steigen']; } }
  return best;
}

// ---------- per-frame updates ----------
function updateEntities(dt) {
  const k = 1 - Math.exp(-dt * 14), alive = you && you.alive;
  for (const e of players.values()) {
    if (e.id === myId && alive) { e.x = me.x; e.y = me.y; e.z = me.z; e.yaw = me.byaw; e.pitch = me.bpitch; e.speed = Math.hypot(me.vx, me.vy, me.vz); }
    else {
      const ox = e.x, oy = e.y, oz = e.z;
      e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; e.z += (e.tz - e.z) * k; e.yaw = lerpAngle(e.yaw, e.tyaw, k); e.pitch += (e.tpitch - e.pitch) * k;
      e.speed += (Math.hypot(e.x - ox, e.y - oy, e.z - oz) / dt - e.speed) * 0.2;
    }
    e.surf = SURFACE - e.y < 1.3;   // at the surface the diver floats upright
    e.held = e.id === myId && held >= 0 && you && you.x ? catchFromNet(you.x.bagL[held]) : null;
    // nur vom eigenen Taucher weiß das Spiel, wann er nachlädt – also gehen nur bei dir die Kiemen auf
    e.gills = e.id === myId ? view.gills : 0; e.charge = e.id === myId ? view.charge : 0;
    // wie weit das Nachladen ist (für die Mech-Animation von außen). Bei anderen schätzen wir es: Start merken, Dauer der Waffe
    if (e.id === myId) e.rl = you && you.rl > 0 && you.rlT ? Math.min(1, 1 - you.rl / you.rlT) : 0;
    else if (e.fl & 16) { e.rlStart ??= time; const wd = WEAPONS[WEAPON_IDS[e.w]]; e.rl = Math.min(1, (time - e.rlStart) / ((wd && wd.reload) || 2.5)); }
    else { e.rlStart = undefined; e.rl = 0; }
    e.fin = fins.find(f => f.attacker === e.id) || null;
    const veh = e.veh ? vehicles.get(e.veh) : null;
    // im U-Boot sieht man den Taucher nicht, und in der Ego-Perspektive nicht den eigenen Körper
    e.mesh.visible = !(veh && veh.type === 'sub') && !(e.id === myId && fpOn) && !(e.id !== myId && (e.fl & 8));   // 8 = getarnt (Sepia-Ulti)
    e.mesh.position.set(e.x, e.y, e.z);
    e.mesh.userData.update(dt, e);
    const near = e.mesh.position.distanceToSquared(camera.position);
    if (e.mesh.userData.tag) e.mesh.userData.tag.visible = near < 55 * 55;
    // breathing: every few seconds the diver exhales a cloud of bubbles from the regulator
    // Atemtempo: beim Sprinten steigt es schnell auf BREATH_SPRINT (fast 3-mal so schnell), danach beruhigt es sich langsam wieder
    const sprint = e.id === myId ? me.boost : !!(e.fl & 2);
    e.brate = (e.brate ?? 1) + ((sprint ? BREATH_SPRINT : 1) - (e.brate ?? 1)) * Math.min(1, dt * (sprint ? 1.2 : 0.18));
    e.breath = (e.breath ?? Math.random() * 4) - dt * e.brate;
    const myBreath = e.id === myId && you && you.alive && SURFACE - e.y > 1.2 && !myFin;
    const pant = (e.brate - 1) / (BREATH_SPRINT - 1);   // 0 = ruhig, 1 = außer Atem: kürzer und lauter
    if (myBreath && !e.inhaled && e.breath < 1.9) { e.inhaled = true; sfx.inhale(BREATH_VOL * (1 + pant * 0.6), e.brate); }
    if (e.breath <= 0) { e.breath = 3.4 + Math.random() * 1.4; e.exhale = 0.9; e.inhaled = false; if (myBreath) sfx.exhale(BREATH_VOL * (1 + pant * 0.5), e.brate); }
    if (e.exhale > 0 && near < 90 * 90 && SURFACE - e.y > 1.2) {
      e.exhale -= dt;
      const f = dirFrom(e.yaw, e.pitch), big = e.exhale > 0.45, n = Math.random() < (big ? 0.9 : 0.5) ? (big ? 2 : 1) : 0;
      for (let i = 0; i < n; i++) env.bubble(e.x + f[0] * 0.8, e.y + f[1] * 0.8 - 0.05, e.z + f[2] * 0.8, 1, 0.1, 0, big ? 0.04 + Math.random() ** 1.5 * 0.17 : 0.02 + Math.random() * 0.06);
    }
  }
  let engine = 0;
  for (const v of vehicles.values()) {
    if (v.type === 'sub' && v.driver) { const d = Math.hypot(v.x - camera.position.x, v.y - camera.position.y, v.z - camera.position.z); engine = Math.max(engine, Math.min(1, (v.speed || 0) / 12 + 0.25) * Math.max(0, 1 - d / 150)); }
    if (v.driver === myId && alive) { v.x = me.x; v.y = me.y; v.z = me.z; v.yaw = me.hyaw; v.pitch = me.hpitch; v.speed = Math.hypot(me.vx, me.vy, me.vz); }
    else { const ox = v.x, oz = v.z, oy = v.y; v.x += (v.tx - v.x) * k; v.y += (v.ty - v.y) * k; v.z += (v.tz - v.z) * k; v.yaw = lerpAngle(v.yaw, v.tyaw, k); v.pitch += (v.tpitch - v.pitch) * k; v.speed += (Math.hypot(v.x - ox, v.y - oy, v.z - oz) / dt - v.speed) * 0.2; }
    v.mesh.position.set(v.x, v.y, v.z); v.driven = !!v.driver;
    v.mesh.userData.update(dt, v);
    if (v.driver === myId && v.type === 'sub' && alive) { sonarT -= dt; if (sonarT <= 0) { sonarT = 6; sfx.sonar(SONAR_SND.sub); } }
    // fremdes U-Boot mit Fahrer: man hört sein Sonar in der Nähe (leiser, je weiter weg)
    else if (v.driver && v.type === 'sub') {
      v.sonarT = (v.sonarT ?? Math.random() * 6) - dt;
      if (v.sonarT <= 0) { v.sonarT = 6; const d = Math.hypot(v.x - camera.position.x, v.y - camera.position.y, v.z - camera.position.z); if (d < SONAR_SND.nearRange) sfx.sonar(SONAR_SND.near * (1 - d / SONAR_SND.nearRange) ** 2, 0.96); }
    }
    if (v.driver && v.speed > 3 && Math.random() < dt * 25) { const f = dirFrom(v.yaw, v.pitch), o = v.type === 'sub' ? 4.2 : 0.6; env.bubble(v.x - f[0] * o, v.y - f[1] * o, v.z - f[2] * o, 1, 0.8, 1); }
  }
  sfx.engine(engine);
  for (const c of creatures.values()) {
    c.x += (c.tx - c.x) * k; c.y += (c.ty - c.y) * k; c.z += (c.tz - c.z) * k; c.yaw = lerpAngle(c.yaw, c.tyaw, k); c.pitch += (c.tpitch - c.pitch) * k;
    c.mesh.position.set(c.x, c.y, c.z); c.mesh.userData.update(dt, c);
  }
  for (const p of pickups.values()) p.mesh.userData.update(time);
  for (const [id, p] of projs) {
    const st = p.sp * dt; p.x += p.dx * st; p.y += p.dy * st; p.z += p.dz * st; p.life -= dt;
    p.mesh.position.set(p.x, p.y, p.z);
    // fremdes Geschoss fliegt knapp an mir vorbei → "Schusch" (nur einmal pro Geschoss)
    if (!p.mine && !p.wh && you && you.alive) { const d = Math.hypot(p.x - me.x, p.y - me.y, p.z - me.z); if (d < NEAR_MISS + 0.5) { p.wh = true; whooshAt(p.x, p.y, p.z, d); } }
    p.tt -= dt; if (p.tt <= 0) { p.tt = p.trail; env.bubble(p.x, p.y, p.z, 1, 0.1, 0, 0.025 + Math.random() * 0.03); }
    if (p.whine) { const d = Math.hypot(p.x - camera.position.x, p.y - camera.position.y, p.z - camera.position.z); p.whine.set(Math.max(0, 1 - d / 140) ** 1.5); }
    if (p.life <= -0.15 || p.y < W.heightAt(p.x, p.z) - 0.5) removeProj(id);
  }
  updateShocks(dt);
  // Wasserstrahlen verblassen in BEAM_TIME Sekunden und verschwinden dann
  for (let i = beams.length - 1; i >= 0; i--) {
    const b = beams[i]; b.t -= dt;
    if (b.t <= 0) { dyn.remove(b.mesh); b.mesh.userData.dispose(); beams.splice(i, 1); }
    else b.mesh.userData.fade(b.t / BEAM_TIME);
  }
}
// ---------- Zielfernrohr (Harpune) ----------
// Rechte Maustaste halten: Zoom (Sichtfeld von FOV auf SCOPE_FOV Grad), Fernrohr-Bild, und das Zielen wackelt.
// Je weniger Leben man hat, desto mehr wackelt es (SWAY_MIN bei vollem Leben, SWAY_MAX kurz vor dem Tod).
// Rechte Maustaste halten = zielen. Waffen mit Zielfernrohr (scope: true) zoomen stark auf SCOPE_FOV,
// alle anderen holt man vors Auge und schaut über Kimme und Korn (ADS_FOV = leichter Zoom).
let FOV = 72; const SCOPE_FOV = 16, ADS_FOV = 50, SWAY_MIN = 0.0015, SWAY_MAX = 0.018;
let scoping = false, aim = 0, scoped = 0, swayT = 0, swayX = 0, swayY = 0;
// Einstellungen anwenden (hier, weil FOV erst ab dieser Stelle existiert)
onSettings((s) => {
  const Q = QUALITY[s.quality] || QUALITY.high;
  sfx.setVolume(s.volume); music.setVolume(s.music);
  renderer.setPixelRatio(Math.min(devicePixelRatio, Q.pr)); resize();
  setupPost(Q);                 // Leuchten und weiche Schatten
  setReefQuality(Q.reef); setPropsQuality(Q.reef);       // gilt ab der nächsten Welt (nächste Runde)
  FOV = s.fov;
  document.getElementById('fpsBox').classList.toggle('hidden', !s.fps);
});
const BREATH_VOL = 0.8;     // Lautstärke der Atemgeräusche
const BREATH_SPRINT = 2.8; // so viel schneller atmet man beim Sprinten
function updateScope(dt) {
  const w = you && you.alive && !you.veh && held < 0 ? you.w[you.slot] : null;
  const def = w ? modDef(w[0], w[4]) : null, isScope = !!(def && def.scope);   // Werte mit Aufsätzen (Zielfernrohr-Aufsatz!)
  const can = scoping && def && !myFin && !(you.rl > 0) && !SUITS[mySuit].mech;   // Goliath: Rechtsklick dreht nur den Mech (kein Zielen über Kimme und Korn)          // beim Nachladen kann man nicht zielen
  aim += ((can ? 1 : 0) - aim) * Math.min(1, dt * 12);
  scoped = isScope ? aim : 0;
  const fov = FOV + ((isScope ? SCOPE_FOV : ADS_FOV) - FOV) * aim;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  hud.scope(scoped > 0.5, aim > 0.5);
  view.scopeKick = Math.max(0, (view.scopeKick || 0) - dt * 3.5);
  hud.scopeKick(view.scopeKick);
  // Wackeln: zwei langsame Wellen übereinander, das sieht aus wie zitternde Hände. Es verschiebt das echte Zielen!
  const lifeLeft = you && you.mhp ? Math.max(0, Math.min(1, you.hp / you.mhp)) : 1;
  const amp = (SWAY_MIN + (SWAY_MAX - SWAY_MIN) * (1 - lifeLeft)) * aim * (isScope ? 1 : 0.45) * UP('scope') * (cling ? CLING.sway : 1) * (def?.sway || 1);   // über Kimme und Korn wackelt es weniger; Ruhiges Visier, Visier-Aufsatz
  swayT += dt;
  // benommen (verbrannt): das Bild schwankt langsam, auch ohne zu zielen, und Zielen wackelt viel mehr
  daze.t = Math.max(0, daze.t - dt); daze.burn = Math.max(0, daze.burn - dt * 1.2);
  const dz = daze.t > 0 ? Math.min(1, daze.t / daze.max * 1.4) : 0;
  const amp2 = amp * (1 + dz * 3), dw = dz * 0.035;
  const nx = (Math.sin(swayT * 0.9) + Math.sin(swayT * 2.3 + 1) * 0.45) * amp2 + Math.sin(swayT * 1.7) * dw, ny = (Math.cos(swayT * 1.1) + Math.sin(swayT * 2.9) * 0.4) * amp2 + Math.cos(swayT * 1.3) * dw * 0.7;
  camYaw += nx - swayX; camPitch += ny - swayY; swayX = nx; swayY = ny;
}
// Rückstoß: die Kamera springt beim Schuss nach oben (und etwas zur Seite) und federt dann zum Großteil zurück.
// Mehr Schaden pro Schuss = mehr Rückstoß. RECOIL_BACK = wie viel davon zurückfedert (0.75 = 75 %).
const RECOIL = 0.0006, RECOIL_BACK = 0.75;
// Rückstoß wie im Bodycam-Video: Waffe und Kamera reißen ZUSAMMEN hoch, aber das Wasser bremst –
// wie eine Feder in Honig. stiff = wie stark die Feder zurückzieht, damp = wie stark das Wasser bremst,
// punch = wie heftig der Stoß ist (größer = höher)
const RSPRING = { stiff: 140, damp: 17, punch: 23 };
const rspring = { p: 0, v: 0, yaw: 0, vy: 0, keep: 0 };   // p = wie weit die Kamera gerade hochgerissen ist
function recoil(def) {
  const k = Math.min(0.09, 0.006 + def.dmg * def.pellets * RECOIL) * UP('recoil') * (def.recoil || 1);   // Rückstoßdämpfer, Kompensator
  rspring.v += k * RSPRING.punch;                              // der Stoß: die Feder bekommt Schwung nach oben
  rspring.vy += (Math.random() - 0.5) * k * 0.6 * RSPRING.punch;
  rspring.keep += k * (1 - RECOIL_BACK);                       // ein Teil bleibt (man muss nachziehen)
  shake = Math.max(shake, k * 2.5);
  view.kick = 1;
  view.kickPow = 0.7 + Math.min(1.5, def.dmg * def.pellets / 45);   // große Waffen schlagen stärker zurück
  view.kickRoll = (Math.random() - 0.5) * 0.12;
  // durchs Zielfernrohr: stärker hoch, das Fernrohr-Bild springt mit, und es federt langsamer zurück
  if (scoped > 0.5) { rspring.v += k * 0.6 * RSPRING.punch; view.scopeKick = 1; }
}
// Feder jedes Bild ein Stück weiterrechnen und nur die Änderung auf die Kamera geben (die Maus bleibt frei)
function updateRecoil(dt) {
  const R = rspring, pp = R.p, py = R.yaw;
  for (const s of [dt / 2, dt / 2]) {   // zwei kleine Schritte = ruhiger
    R.v += (-RSPRING.stiff * R.p - RSPRING.damp * R.v) * s; R.p += R.v * s;
    R.vy += (-RSPRING.stiff * R.yaw - RSPRING.damp * R.vy) * s; R.yaw += R.vy * s;
  }
  const keep = R.keep * Math.min(1, dt * 10); R.keep -= keep;
  camPitch = Math.min(1.45, camPitch + (R.p - pp) + keep); camYaw += R.yaw - py;
}
// Gasblase: beim Schuss quillt das Treibgas als glänzende Blase aus der Waffe, wackelt nach oben und platzt
const GAS = { size: 0.07, rise: 0.9, life: 1.4 };
const GAS_GEO = new THREE.SphereGeometry(1, 14, 10), gasBubbles = [];
const GAS_MAT = new THREE.MeshStandardMaterial({ color: 0xd8f4ff, emissive: 0x2a5566, transparent: true, opacity: 0.4, roughness: 0.05, metalness: 0.6, depthWrite: false });
function gasBubble(x, y, z, big) {
  const m = new THREE.Mesh(GAS_GEO, GAS_MAT); m.position.set(x, y, z); m.renderOrder = 2; scene.add(m);
  gasBubbles.push({ m, t: 0, s: GAS.size * (big ? 1.6 : 1) * (0.8 + Math.random() * 0.4), ph: Math.random() * 6, vx: (Math.random() - 0.5) * 0.4, vz: (Math.random() - 0.5) * 0.4 });
}
function updateGas(dt) {
  for (let i = gasBubbles.length - 1; i >= 0; i--) {
    const b = gasBubbles[i]; b.t += dt;
    if (b.t > GAS.life) { env.bubble(b.m.position.x, b.m.position.y, b.m.position.z, 5, 0.12, 0.6); b.m.removeFromParent(); gasBubbles.splice(i, 1); continue; }   // platzt in kleine Bläschen
    const g = Math.min(1, b.t * 6), w = Math.sin(b.t * 14 + b.ph) * 0.18;   // erst aufquellen, dann wabbeln
    b.m.position.x += (b.vx + Math.sin(b.t * 5 + b.ph) * 0.15) * dt; b.m.position.z += b.vz * dt; b.m.position.y += GAS.rise * Math.min(1, b.t * 2) * dt;
    b.vx *= 1 - dt * 2; b.vz *= 1 - dt * 2;
    const s = b.s * g * (1 + b.t * 0.3); b.m.scale.set(s * (1 + w), s * (1 - w), s * (1 + w * 0.5));
  }
}
// ---------- Nachladen: Magazin wechseln (die Bewegungen stehen in models.js bei poseReload) ----------
// Nachlade-Geräusche: [Zeitpunkt 0…1, Name des Sounds in audio.js]
const RELOAD_SOUNDS = [[0.11, 'magOut'], [0.3, 'stow'], [0.4, 'magGrab'], [0.6, 'magIn'], [0.73, 'cockBack'], [0.8, 'cockRelease'], [0.85, 'ready']];
// Rucksack und Ellbogen der zweiten Hand – in Kamera-Koordinaten (unten links, außerhalb des Bildes)
const PACK_CAM = new THREE.Vector3(-0.32, -0.55, 0.02), ELBOW_CAM = new THREE.Vector3(-0.35, -0.6, -0.12);
const IM = new THREE.Matrix4(), PL = new THREE.Vector3(), EL = new THREE.Vector3();
// Kiemen, Druckanzeige, Nachladen und die Waffe vor der Kamera (Ego-Perspektive)
function updateViewModel(dt) {
  // Rückstoß zurückfedern lassen
  updateRecoil(dt); updateGas(dt);
  updateScope(dt);
  const w = you && you.alive ? you.w[you.slot] : null;
  // Der Server schickt den Nachlade-Stand nur 20-mal pro Sekunde. Damit die Animation flüssig ist, zählt der Browser
  // selbst in jedem Bild weiter und gleicht sich nur an, wenn er mehr als 0,15 s danebenliegt.
  if (w && you.rl > 0) view.rl = view.rl > 0 && Math.abs(view.rl - you.rl) < 0.15 ? Math.max(0.001, view.rl - dt) : you.rl;
  else view.rl = 0;
  const reloading = !!w && view.rl > 0;
  const done = reloading ? Math.min(1, 1 - view.rl / you.rlT) : 0;
  // Nachlade-Geräusche: jedes einmal, wenn sein Zeitpunkt erreicht ist
  if (!reloading) view.rsnd = 0;
  else while (view.rsnd < RELOAD_SOUNDS.length && done >= RELOAD_SOUNDS[view.rsnd][0]) sfx[RELOAD_SOUNDS[view.rsnd++][1]](WEAPON_IDS.indexOf(w[0]));
  // Kiemen: beim Aufladen gehen sie langsam auf, beim Schuss puffen sie kurz auf (der Druck entweicht)
  const chg = chargeShot ? Math.min(1, (performance.now() - chargeStart) / Math.max(1, chargeEnd - chargeStart)) : 0;
  view.gills = Math.max(view.gills - dt * 4, view.kick * 0.7, chg);
  // Druckanzeige = wie voll das Magazin in der Waffe ist
  const def = w ? modDef(w[0], w[4]) : null;
  view.charge = def ? (reloading ? Math.max(0, done - RELOAD_STEPS.insert) / (1 - RELOAD_STEPS.insert) : w[2] / def.mag) : 0;
  // Brustschwimmen: in der Ego-Sicht, beim Schwimmen ohne zu schießen/zielen/nachladen → Waffe runter, Arme ziehen
  const spd = Math.hypot(me.vx, me.vy, me.vz), mechNow = !!SUITS[mySuit].mech;
  const wantSwim = fpOn && !!(you && you.alive) && !you.veh && !mechNow && held < 0 && !cling
    && ((!firing && aim < 0.1 && !(you.rl > 0) && !chargeShot && spd > SWIM.minSpeed && performance.now() - (view.lastShotT || 0) > 700) || holster.on);   // weggesteckt: Hände immer frei
  view.swim += ((wantSwim ? 1 : 0) - view.swim) * Math.min(1, dt * (wantSwim ? SWIM.blendIn : SWIM.blendOut));
  if (!view.swimArms || view.swimSuit !== mySuit) { if (view.swimArms) camera.remove(view.swimArms); view.swimArms = makeSwimArms(mySuit); view.swimSuit = mySuit; camera.add(view.swimArms); }
  view.swimArms.visible = view.swim > 0.02 && fpOn;
  if (view.swimArms.visible) {
    view.swimPh = (view.swimPh || 0) + dt * (SWIM.rate + spd * SWIM.rateSpeed);
    view.swimArms.userData.pose(view.swimPh);
    view.swimArms.position.set(0, -0.45 * (1 - view.swim), 0.1 * (1 - view.swim));   // Arme kommen von unten ins Bild
  }
  handLight.intensity = view.swimArms.visible ? (lamp.intensity > 0 ? VIEW.hands[0] : VIEW.hands[1]) : 0;   // Helmlampe beleuchtet die Arme
  // im Mech sitzt man in der Ego-Perspektive hinter der Glaskuppel
  cockpit.visible = fpOn && !!(you && you.alive) && !!SUITS[mySuit].mech;
  const near = cockpit.visible ? 0.06 : 0.25;   // im kleinen Cockpit ist alles sehr nah an den Augen
  if (camera.near !== near) { camera.near = near; camera.updateProjectionMatrix(); }
  if (cockpit.visible) { cockpit.userData.update(dt, flow.f, flow.s, blurCam.x * 30, time);   // Steuerhebel kippen mit, Zeiger zittern
    const cw = you.w[you.slot]; cockpit.userData.screen({ hp: you.hp, mhp: you.mhp, ammo: cw ? cw[2] : 0, mag: cw ? WEAPONS[cw[0]].mag : 0, ult: you.ul ? you.ul[0] : 0 }); }
  // Mech-Geräusche: Motor und Propeller je nach Tempo, Hydraulik bei jedem Schritt, Servos beim schnellen Drehen
  const inMech = phase === 'play' && !!(you && you.alive) && !!SUITS[mySuit].mech && mode !== 'exp';
  const mspd = Math.hypot(me.vx, me.vy, me.vz);
  sfx.mechLoop(inMech, mspd);
  if (inMech) {
    view.mstep = (view.mstep || 0) + dt * (0.6 + mspd * 0.35);
    if (mspd > 1.2 && view.mstep > Math.PI) { view.mstep -= Math.PI; sfx.mechStep(0.7); }
    sfx.mechServo(Math.min(1, Math.abs(view.inX) * 25));
  }
  // die Waffe vor der Kamera nur in der Ego-Perspektive, mit Waffe in der Hand (nicht mit Fisch)
  view.g.visible = fpOn && !you.veh && !!w && held < 0 && scoped < 0.5 && performance.now() >= holsterUntil && view.swim < 0.9 && !holster.on;   // Fernrohr oder weggesteckt: keine Waffe
  if (!view.g.visible) return;
  const widx = WEAPON_IDS.indexOf(w[0]);
  const modKey = (w[4] || []).join(",");
  if (widx !== view.widx || view.suit !== mySuit || modKey !== view.modKey) {   // Waffe, Taucher oder Aufsätze gewechselt: neues Modell bauen
    view.widx = widx; view.suit = mySuit; view.modKey = modKey; view.g.clear();
    view.gun = makeWaterGun(widx, true, w[4]); view.g.add(view.gun);
    // Arm und Hände halten die Waffe – im Mech sind es Roboter-Greifarme
    view.arms = SUITS[mySuit].mech ? makeMechViewArms(view.gun.userData) : makeViewArms(mySuit, view.gun.userData); view.gun.add(view.arms);
    view.rHand = SUITS[mySuit].mech ? makeMechReloadHand() : makeReloadHand(mySuit); view.gun.add(view.rHand);                   // zweite Hand fürs Nachladen
  }
  const U = view.gun.userData;
  U.setGills(view.gills);
  U.setCharge(view.charge);
  // Nachladen: zweite Hand und Magazin bewegen, die normale linke Hand ausblenden
  const rl = reloading && (!!U.mag || !!U.revolver);   // Revolver: Trommel statt Magazin
  if (view.arms.userData.left) view.arms.userData.left.visible = !rl;
  // Kippen: beim Magazinwechsel Boden nach links, beim Durchladen fast gerade
  const roll = rl ? reloadRoll(done) * (U.revolver ? 0.3 : U.freshOnly ? 0.2 : 1) : 0;   // Revolver und Magnet: nur leicht kippen, damit man Trommel bzw. Magnet sieht
  view.tilt += (roll - view.tilt) * Math.min(1, dt * 14);
  // Zielen über Kimme und Korn: die Waffe wandert in die Bildmitte, so dass die Visierlinie genau im Fadenkreuz liegt
  const ads = aim * (scoped > 0 ? 0 : 1);
  // Schwanken beim Schwimmen (beim Zielen viel weniger), Rückstoß beim Schießen
  const speed = Math.hypot(me.vx, me.vy, me.vz);
  view.bob += dt * (2 + speed * 0.6);
  view.kick = Math.max(0, view.kick - dt * 9);
  const sway = Math.min(1, speed / 10) * 0.012 * (1 - ads * 0.8);
  const K = view.kick * (view.kickPow || 1);
  const sh = U.fpShift, z = -(U.rear + 0.3) + sh[2], sx = sh[0] * (1 - ads), sy = sh[1] * (1 - ads);
  // Trägheit (Bodycam): dreht man sich, bleibt die Waffe kurz zurück und kippt etwas – wie echte Arme mit Gewicht
  const dYaw = (camYaw - (view.lastYaw ?? camYaw)), dPitch = (camPitch - (view.lastPitch ?? camPitch)); view.lastYaw = camYaw; view.lastPitch = camPitch;
  const inT = Math.min(1, dt * VIEW.inertiaBack);
  view.inX += (Math.max(-VIEW.inertiaMax, Math.min(VIEW.inertiaMax, -dYaw * VIEW.inertia)) - view.inX) * inT;
  view.inY += (Math.max(-VIEW.inertiaMax, Math.min(VIEW.inertiaMax, -dPitch * VIEW.inertia)) - view.inY) * inT;
  const breathe = Math.sin(time * 1.5) * VIEW.breathe * (1 - ads * 0.7);            // ganz leichtes Atmen
  const hip = VIEW.hip[U.kind] || VIEW.hip.rifle;                                    // wo die Waffe ohne Zielen sitzt
  view.g.position.set(hip[0] * (1 - ads), hip[1] * (1 - ads) - view.swim * 0.4, view.swim * 0.1);   // beim Brustschwimmen nach unten weg
  if (SUITS[mySuit].mech) {   // Goliath: Waffe hängt rechts außen am Roboter; beim Nachladen schwenkt der Arm zur Mitte (bleibt vor der Kuppel)
    view.mrl = (view.mrl || 0) + ((rl ? 1 : 0) - (view.mrl || 0)) * Math.min(1, dt * 6);
    const a = VIEW.mechGun, b = VIEW.mechReload, k = view.mrl;
    view.g.position.set(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k);
  }
  view.gun.position.set(
    sx - U.sightAt[0] * ads + Math.cos(view.bob) * sway - view.tilt * 0.08 + view.inX * 0.5,
    sy - U.sightAt[1] * ads + Math.abs(Math.sin(view.bob)) * sway + view.tilt * 0.1 + K * 0.012 + rspring.p * 0.35 + view.inY * 0.5 + breathe,   // reißt mit der Kamera hoch
    z - ads * 0.04 + (U.kind === 'pole' ? -K * 0.35 : K * 0.075));             // Rückstoß: die Waffe fährt nach hinten – Stabwaffe: Stoß nach vorne
  view.gun.rotation.set(K * 0.08 + rspring.p * 3.2 + view.tilt * 0.15 - view.inY * 1.2, view.tilt * 0.3 + view.inX * 1.4 + (hip[2] || 0) * (1 - ads),
    -view.tilt * 1.15 + K * (view.kickRoll || 0) + view.inX * 1.8);              // −z-Drehung = Boden nach links
  // der Schlitten / Spannhebel fährt bei jedem Schuss kurz zurück
  if (rl) {
    // Rucksack und Ellbogen von Kamera- in Waffen-Koordinaten umrechnen
    view.gun.updateMatrix(); IM.copy(view.gun.matrix).invert();
    const mech = !!SUITS[mySuit].mech;   // Goliath: Magazin-Halter und Zangen-Gelenk sind draußen links vorne, nicht hinter dir
    PL.set(...(mech ? VIEW.mechPack : PACK_CAM.toArray())).sub(view.g.position).applyMatrix4(IM); EL.set(...(mech ? VIEW.mechElbow : ELBOW_CAM.toArray())).sub(view.g.position).applyMatrix4(IM);
    poseReload(done, U, view.rHand, PL, EL);
  } else {
    view.rHand.visible = false;
    if (U.mag) { U.mag.g.position.copy(U.mag.seat); U.mag.g.visible = !U.freshOnly || view.charge > 0; U.mag.fill.emissiveIntensity = 0.4 + 1.4 * view.charge; }   // Magnet weg, wenn verschossen
    if (U.revolver) { const R = U.revolver; R.crane.rotation.z = 0; R.cyl.visible = true; R.cyl.rotation.z = 0; R.loose.visible = false; R.fill.emissiveIntensity = 0.4 + 1.4 * view.charge; }
  }
  // Schuss-Mechanik: Schlitten, Verschluss, Pumpe, Hahn, Trommel, fliegende Hülsen (siehe models.js)
  if (U.fireAnim) U.fireAnim(view.kick, dt, rl);
  // Mündungsblitz: ganz kurz hell an der Mündung, und er beleuchtet die Hände
  const fl = Math.max(0, (view.kick - 0.55) / 0.45);
  if (!U.flash) { U.flash = makeFlash(); U.muzzle.add(U.flash); }
  U.flash.visible = fl > 0; U.flash.scale.setScalar(0.6 + fl * (view.kickPow || 1) * 0.5); U.flash.rotation.z = Math.random() * 6;
  flashLight.intensity = fl * 6;
  handLight.intensity = view.g.visible && !SUITS[mySuit].mech ? (lamp.intensity > 0 ? VIEW.hands[0] : VIEW.hands[1]) : 0;   // im Mech leuchtet das Cockpit-Licht
}
const V = new THREE.Vector3();
function updateCamera(dt) {
  let tx, ty, tz, want, side = 0.9, up = 0.5;
  const alive = you && you.alive;
  fpOn = false;
  if (myFin) {
    // Kamerafahrt wie im Kino (Werte in FIN_CAM): 1) über deiner Schulter, 2) im Moment des Treffers schwenkt sie zur Seite
    // und geht tief, 3) danach zieht sie zurück und nach oben. Weich verbunden, damit nichts springt.
    const G = myFin.ghost.position, p = myFin.p, h = myFin.hitAt, C = FIN_CAM;
    if (!myFin.cam) { const dx = myFin.ghost.position.x - me.x, dz = myFin.ghost.position.z - me.z; myFin.cam = { base: Math.atan2(dx, dz), pos: camera.position.clone() }; }
    const ease = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
    const k1 = ease(p / h), k2 = ease((p - h) / (1 - h));
    const ang = myFin.cam.base + Math.PI + C.shoulder[0] + (C.side[0] - C.shoulder[0]) * k1 + (C.pull[0] - C.side[0]) * k2;
    const dist = C.shoulder[1] + (C.side[1] - C.shoulder[1]) * k1 + (C.pull[1] - C.side[1]) * k2 + Math.hypot(me.x - G.x, me.z - G.z) * 0.35;
    const hgt = C.shoulder[2] + (C.side[2] - C.shoulder[2]) * k1 + (C.pull[2] - C.side[2]) * k2;
    const look = 0.35 + 0.4 * k1;                                   // Blick wandert von dir zum Gegner
    const mx = me.x + (G.x - me.x) * look, my = me.y + (G.y - me.y) * look + 0.4, mz = me.z + (G.z - me.z) * look;
    let px = mx + Math.sin(ang) * dist, py = my + hgt, pz = mz + Math.cos(ang) * dist;
    py = Math.min(SURFACE - 0.6, Math.max(py, W.heightAt(px, pz) + 0.8));
    myFin.cam.pos.lerp(V.set(px, py, pz), Math.min(1, dt * 6));   // sanft hinterher
    shake = Math.max(0, shake - dt * 2.2);
    const sh = shake * 0.6, st = time * 40;
    camera.position.set(myFin.cam.pos.x + Math.sin(st) * sh, myFin.cam.pos.y + Math.sin(st * 1.3) * sh, myFin.cam.pos.z);
    camera.lookAt(mx, my, mz);
    const zoom = C.zoom * Math.max(0, 1 - Math.abs(p - h) / 0.15);   // kurzer Zoom im Moment des Treffers
    if (Math.abs(camera.fov - (FOV - zoom)) > 0.1) { camera.fov = FOV - zoom; camera.updateProjectionMatrix(); }
    return;
  }
  if (alive) {
    const v = you.veh ? vehicles.get(you.veh) : null;
    want = v ? VEHICLES[v.type].cam : SUITS[mySuit].cam;
    if (v && v.type === 'sub') { side = 0; up = 2.2; }
    tx = me.x; ty = me.y + eyeHeight(mySuit); tz = me.z;
    if (myGunSub()) { want = 0; side = 0; up = 0; fpOn = true; }   // Schütze: Kamera mitten in der Glaskugel
    // swimming at the surface: head out of the water, the camera looks across the sea
    if (SURFACE - me.y < 3.2) { headUp += (1 - headUp) * Math.min(1, dt * 3); } else headUp += (0 - headUp) * Math.min(1, dt * 4);
    // Ego-Perspektive: Kamera fährt in den Kopf (Abstand 0), nicht zur Seite, nicht nach oben
    if ((firstPerson || aim > 0.5) && !v) { fpOn = true; want = 0; side = 0; up = 0; }
    else if (inSubFP()) { want = 0; side = 0; up = 0; }   // im U-Boot: Kamera im Innenraum (siehe unten)
    else ty += headUp * 2.2;
  } else {
    let e = players.get(specId);
    if (!e) { for (const p of players.values()) { if (!e || (!meta.get(p.id)?.bot && meta.get(e.id)?.bot)) e = p; } specId = e ? e.id : 0; }
    if (e) { tx = e.x; ty = e.y + 0.6; tz = e.z; } else { tx = me.x; ty = me.y; tz = me.z; }
    want = 8; side = 0;
  }
  camDist += (want - camDist) * Math.min(1, dt * 5);
  const cd = dirFrom(camYaw, camPitch), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
  let px = tx - cd[0] * camDist + rx * side, py = ty - cd[1] * camDist + up, pz = tz - cd[2] * camDist + rz * side;
  const t = W.segmentHit(tx, ty, tz, px, py, pz);
  if (t > 0) { const q = Math.max(0.15, t - 0.08); px = tx + (px - tx) * q; py = ty + (py - ty) * q; pz = tz + (pz - tz) * q; }
  py = Math.min(headUp > 0.5 ? SURFACE + 14 : SURFACE - 0.6, Math.max(py, W.heightAt(px, pz) + 0.5));
  if (headUp > 0.5 && py < SURFACE + 0.8 && py > SURFACE - 0.8) py = SURFACE + 0.8;   // never sit exactly in the water plane
  // U-Boot innen: Kamera auf Augenhöhe am Sitz bzw. dort, wo man steht; Innenraum einblenden
  const sv = inSubFP();
  // von innen: alle Außenteile (Glaskugel, Scheinwerferkegel, Leuchtstreifen …) ausblenden, sonst blendet es weiß
  const showHull = (body, on) => { for (const c of body.children) if (c !== subRoom) c.visible = on; };
  if (subRoom && subRoom.parent && (!sv || subRoom.parent !== sv.mesh.userData.body)) showHull(subRoom.parent, true);
  if (!sv || !subIn.stand) subIn.peri = false;
  if (subIn.peri) { if (camera.fov !== PERI.fov) { camera.fov = PERI.fov; camera.updateProjectionMatrix(); } hud.scope(true, true); }
  hud.periscope(subIn.peri ? camYaw : null);
  if (!myGunSub()) subIn.gunIn = false;
  if (!sv) { subIn.stand = false; if (subRoom) { subRoom.visible = false; if (subRoom.parent) subRoom.parent.remove(subRoom); } }
  else {
    const body = sv.mesh.userData.body;
    if (!subRoom) subRoom = makeSubInterior();
    if (subRoom.parent !== body) body.add(subRoom);
    subRoom.visible = true; showHull(body, false);
    if (subIn.stand && !subIn.peri) updateSubWalk(dt, sv);
    sv.mesh.updateMatrixWorld(true);
    if (subIn.peri) V.set(PERI.pos[0], PERI.up, PERI.pos[1] - 0.7);   // Periskop: die Linse sitzt oben über dem Turm
    else V.set(subIn.x, subIn.stand ? SUBROOM.eyeStand + Math.sin(time * 1.3) * 0.01 : SUBROOM.eyeSit, subIn.z);
    body.localToWorld(V);
    px = V.x; py = V.y; pz = V.z;
    subRoom.userData.update(dt, subIn.stand ? 0 : flow.f || ((keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0)), (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), time, sv.speed || 0);
  }
  shake = Math.max(0, shake - dt * 2.2);
  camera.position.set(px + (Math.random() - 0.5) * shake, py + (Math.random() - 0.5) * shake, pz + (Math.random() - 0.5) * shake);
  updateHead(dt);
  camera.rotation.set(Math.max(-1.5, Math.min(1.5, camPitch + head.pitch)), camYaw + head.yaw, alive ? flow.roll : 0);   // leichte Neigung beim Seitwärtsschwimmen; im Mech + Kopf
  // Cockpit und Waffe bleiben in Mech-Richtung: mechFrame = (Kamera-Drehung)⁻¹ × (Mech-Drehung)
  if (head.yaw || head.pitch) { QB.setFromEuler(EB.set(camPitch, camYaw, 0)); mechFrame.quaternion.copy(camera.quaternion).invert().multiply(QB); }
  else mechFrame.quaternion.identity();
  // Fadenkreuz nur, wenn man wirklich in Schussrichtung schaut
  const crossEl = document.getElementById('cross'); if (crossEl) crossEl.style.visibility = Math.hypot(head.yaw, head.pitch) > 0.08 ? 'hidden' : '';
}
function lobbyCamera() {
  view.g.visible = false; lamp.intensity = 0; torchBeam.visible = false; for (const l of glowLights) l.intensity = 0;   // keine Waffe und keine Lampe in der Lobby
  if (camera.fov !== FOV) { camera.fov = FOV; camera.updateProjectionMatrix(); } aim = scoped = 0; hud.scope(false, false);   // Zoom aus
  if (!W) return;
  const a = time * 0.05, w = W.wreck;
  camera.position.set(w.x + Math.cos(a) * 46, w.y + 20, w.z + Math.sin(a) * 46);
  camera.lookAt(V.set(w.x, w.y + 6, w.z));
}

const blurCam = { x: 0, y: 0 };   // Bewegungsunschärfe (lens.js)
let last = performance.now();
function frame(now) {
  // Musik: Spannung aus eigenen Schüssen, Treffern in der Nähe, wenig Leben, Schwarzwasser rückt vor, Wellen-Kampf
  if (sfx.ctx) {
    const fight = time - lastShotT < 5 ? 0.8 : 0, low = you && you.alive && you.hp < you.mhp * 0.35 ? 0.6 : 0, zoneMove = zone && zone[8] ? 0.5 : 0, wv = waveInfo && waveInfo[1] < 0 ? 0.7 : 0;
    music.update(phase === 'play' ? 'play' : 'lobby', Math.min(1, Math.max(fight, low, zoneMove, wv, hurtT > time ? 0.8 : 0)));
  }
  if (touch) { const on = phase === 'play'; if (touch.on !== on) { touch.on = on; touch.show(on); } }   // Handy-Knöpfe nur während einer Runde
  const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
  let outside = false;
  if (phase === 'play' && W) {
    const alive = you && you.alive;
    if (alive) {
      if (!myFin) { controlMe(dt); tryFire(now); }
      sendT += dt; if (sendT >= 1 / 30) { sendT = 0; send({ t: 'm', x: +me.x.toFixed(2), y: +me.y.toFixed(2), z: +me.z.toFixed(2), yaw: +me.byaw.toFixed(3), pitch: +me.bpitch.toFixed(3), b: me.boost ? 1 : 0 }); }
    }
    updateFinishers(dt); updateViewModel(dt); updateEntities(dt); updateCamera(dt); updateGlow(dt);
    sfx.setDepth(SURFACE - camera.position.y + depthOffset());   // die Gasblasen-Physik der Sounds hängt von der Tiefe ab
    if (bleedT > 0 && you && you.alive) { bleedT -= dt; bleedPuff -= dt; if (bleedPuff <= 0) { bleedPuff = 0.35; env.blood(me.x + (Math.random() - 0.5) * 0.6, me.y, me.z + (Math.random() - 0.5) * 0.6); } }
    const fx = alive ? me : camera.position;
    outside = !!zone && Math.hypot(fx.x - zone[0], fx.z - zone[1]) > zone[2];
    promptT -= dt; if (promptT <= 0) { promptT = 0.12; hud.prompt(computePrompt()); }
    if (mode === 'exp' && you && you.x) { if (held >= you.x.bagL.length || !you.alive) held = -1; updateTorch(dt, SURFACE - fx.y); updateAquarium(dt); }
    tut.update(mode !== 'exp' && !!(you && you.alive) && !myFin, { x: me.x, z: me.z, yaw: camYaw, shots: tutShots, dt });
    hud.update({ you, zone, wave: waveInfo, alive: aliveN, energy: me.energy, depth: SURFACE - fx.y + depthOffset(), suit: mySuit, outside, time, dt,
      lamp: mode === 'exp' ? { on: torch.on, bat: torch.bat, cap: LAMPS[torch.lvl].battery } : null, held });
    let marks = [];
    // Hammerhai (Elektrosinn): Gegner in der Nähe erscheinen als rote Punkte auf der Minikarte
    // Sonar-Boje (Triton): solange sie läuft, sieht man alle Gegner bis 90 m
    const sonar = time < gfx.sonarUntil ? GADGETS[gadgetOf('triton')].range : 0;
    const sense = mode !== 'exp' && you && you.alive ? Math.max(SUITS[mySuit].sense || 0, sonar) : 0;
    hud.gadget(mode !== 'exp' && you && you.alive ? you.gd : null);
    hud.ulti(mode !== 'exp' && you && you.alive ? you.ul : null, mySuit);
    drawRage();
    if (sense) for (const e of players.values()) if (e.id !== myId && e.mesh.visible && Math.hypot(e.x - me.x, e.y - me.y, e.z - me.z) < sense) marks.push({ x: e.x, z: e.z, c: '#ff4d4d', s: 3 });
    if (mode === 'exp') {
      // boss health bar for the closest boss nearby, boss dots + boat on the minimap
      let bb = null, bd = 70;
      marks = [{ x: EXP_BOAT.x, z: EXP_BOAT.z, c: '#ffc94d', s: 4 }, ...W.bases.map((b, i) => ({ x: b.c.x, z: b.c.z, c: you && you.x && you.x.base === i ? '#ffe066' : '#5ef2e0', s: you && you.x && you.x.base === i ? 5 : 3.5 }))];
      for (const c of creatures.values()) if (c.type === 'boss') {
        marks.push({ x: c.x, z: c.z, c: '#ff4d4d', s: 3.5 });
        const d = Math.hypot(c.x - fx.x, c.y - fx.y, c.z - fx.z); if (d < bd) { bd = d; bb = c; }
      }
      hud.boss(bb ? { name: BOSSES[bb.sub].name, hp: bb.hpPct } : null);
      hud.renderShop(you);
      if (hud.shopOpen && !(hud.shopKind === 'base' ? nearBase() : nearBoat())) hud.closeShop();
      // it gets darker the deeper you dive
      const df = Math.max(0, Math.min(1, (SURFACE - camera.position.y) / 300));
      // below ~150 m it is almost pitch black without a lamp
      const dep = SURFACE - camera.position.y;
      darkness(dep, LIGHT.exp);
      // floor 6 (Vulkanschlund) glows red from the lava below, floor 7 (Urzeittiefe) has a faint blue shimmer
      const lava = deepGlow(dep).lava, prim = deepGlow(dep).prim;
      hemi.color.setHex(0xb5e8ff).lerp(LAVA_SKY, lava).lerp(PRIM_SKY, prim);
      hemi.groundColor.setHex(0x12303c).lerp(LAVA_GROUND, lava).lerp(PRIM_GROUND, prim);
      hemi.intensity = Math.max(hemi.intensity, 0.9 * lava + 0.45 * prim);
    } else { darkness(SURFACE - camera.position.y + DEEP.brOffset, LIGHT.br); hemi.color.setHex(0xb5e8ff); hemi.groundColor.setHex(0x12303c); }
    if (mode === 'exp' || !env.sonar) hud.drawMini(env.mini, zone, { x: fx.x, z: fx.z, yaw: camYaw }, vehicles.values(), mode === 'exp' ? expPois() : W.pois, marks);
    else {
      // Battle Royale: Sonar-Radar. Gegner hört es bis SONAR.hear Meter, Hammerhai und Sonar-Boje weiter
      // Im U-Boot: das Bord-Sonar zeigt durchgehend ALLE Gegner in Reichweite (auch getarnte und welche in anderen U-Booten)
      const sv = you && you.alive && you.veh ? vehicles.get(you.veh) : null, mySub = !!(sv && sv.type === 'sub');
      const hear = mySub ? SONAR.range : Math.max(SONAR.hear, sense), blips = [];
      const mates = [];   // Teamkamerad: immer als grüner Punkt, nie als Gegner
      for (const e of players.values()) {
        if (e.id === myId) continue;
        if (isMate(e.id)) { mates.push({ x: e.x, z: e.z, c: '#7dff9a', s: 4 }); continue; }
        if ((mySub || e.mesh.visible) && Math.hypot(e.x - fx.x, e.y - fx.y, e.z - fx.z) < hear) blips.push({ id: e.id, x: e.x, z: e.z });
      }
      // Dinge in der Nähe fürs Radar: freie Fahrzeuge, geschlossene Truhen, Waffen und Medikits am Boden
      const items = [];
      for (const v of vehicles.values()) if (!v.driver && !v.gunner) items.push({ x: v.x, z: v.z, k: v.type });
      for (const c of crates) if (!c.userData.isOpen) items.push({ x: c.position.x, z: c.position.z, k: 'crate' });
      for (const p of pickups.values()) items.push({ x: p.x, z: p.z, k: p.k, rar: p.rar });
      const hits = hud.drawSonar(env.sonar, zone, { x: fx.x, z: fx.z, yaw: camYaw }, items, W.pois, mates, blips, time, mySub);
      if (you && you.alive && !mySub) {   // Taucher: leises Ping bei jeder Umdrehung, "Ding" für jeden erwischten Gegner
        if (hud.sweepWrapped) sfx.sonar(SONAR_SND.radar, 1.12);
        if (hits) sfx.sonarBlip(SONAR_SND.blip);
      }
    }
    if (mode === 'exp' && you && !you.alive && deadInfo) hud.spec(`<b>Ohnmächtig!</b>Erwischt von ${esc(deadInfo.by)}${deadInfo.lost ? ` · ${deadInfo.lost} Fische verloren` : ''} · aufwachen in ${Math.ceil(you.x?.rt || 0)} s`);
    else if (you && !you.alive && deadInfo) { const s = players.get(specId); hud.spec(`<b>Platz ${deadInfo.place}</b>Erwischt von ${esc(deadInfo.by)}${s ? ` · du beobachtest ${esc(s.name)}` : ''}`); }
    else if (!you) { const s = players.get(specId); hud.spec(`Zuschauer${s ? ` · ${esc(s.name)}` : ''}`); }
    else if (you.alive) hud.spec(null);
    if (mode !== 'exp' && you) updateTorch(dt, SURFACE - fx.y + DEEP.brOffset);
  } else lobbyCamera();
  if (env) { env.setLamp(lamp); env.update(dt, time, camera, phase === 'play' ? zone : null, outside); }
  // Bewegungsunschärfe: wie weit sich die Kamera seit dem letzten Bild gedreht hat (auf den Bildschirm umgerechnet, gedeckelt)
  const mdy = camYaw - (blurCam.yaw ?? camYaw), mdp = camPitch - (blurCam.pitch ?? camPitch); blurCam.yaw = camYaw; blurCam.pitch = camPitch;
  const cl = (v) => Math.max(-0.03, Math.min(0.03, v));
  blurCam.x += (cl(mdy * 0.35) - blurCam.x) * 0.5; blurCam.y += (cl(-mdp * 0.35 * camera.aspect) - blurCam.y) * 0.5;
  if (post.on) { if (post.lens.enabled) post.lens.tick(time, camera.aspect, daze.t > 0 ? Math.min(1, daze.t / daze.max * 1.4) : 0, daze.burn, blurCam.x, blurCam.y, fpOn ? aim : 0); post.composer.render(); } else renderer.render(scene, camera);
  // FPS-Anzeige (Bilder pro Sekunde), zweimal pro Sekunde aktualisiert
  if (settings.fps) { fpsN++; fpsT += dt; if (fpsT >= 0.5) { document.getElementById('fpsBox').textContent = Math.round(fpsN / fpsT) + ' FPS'; fpsN = 0; fpsT = 0; } }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// small hook for automated smoke tests
window.__un = { get state() { return { phase, myId, you, aliveN, me, aimLock, camYaw, camPitch, mySuit, subIn, players: players.size, creatures: creatures.size, pickups: pickups.size, projs: projs.size }; },
  look(y, p) { camYaw = y; camPitch = p; }, key(c, d) { keys[c] = d; }, fire(b) { firing = b; }, send, tp(x, y, z) { me.x = x; me.y = y; me.z = z; }, world: () => W, ents: () => ({ players, creatures, vehicles, crates, pickups }) };
