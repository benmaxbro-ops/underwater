// Undernite - procedural models. Everything is built from primitives so the
// game ships without any binary assets. Forward is -z for all models.
import * as THREE from 'three';
import { SUITS, RARITY, FISH, BOSSES } from './shared.js';
import { makeRealFish, makeRealShark, makeRealOcto, makeRealBoss } from './creatures.js';
import { makeShip } from './ship.js';
import { buildRealDiver } from './diver.js';
import { buildMech } from './mech.js';
import { polymer, brushed, stipple, neoprene, steelWear, steelRough, polyWear, engraving } from './textures.js';

const TAU = Math.PI * 2;
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, ...o });
const glow = (color, i = 1.5, o = {}) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i, roughness: 0.4, ...o });
function add(parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m;
}
// shared geometries (never disposed)
const zCapsule = (r, len, seg = 10) => new THREE.CapsuleGeometry(r, len, 4, seg).rotateX(Math.PI / 2);
const zCyl = (r1, r2, len, seg = 12) => new THREE.CylinderGeometry(r1, r2, len, seg).rotateX(Math.PI / 2);
const GEO = {
  torso: zCapsule(0.3, 0.7), head: new THREE.SphereGeometry(0.23, 14, 10), visor: new THREE.SphereGeometry(0.17, 12, 8),
  tank: zCyl(0.13, 0.13, 0.6), arm: zCapsule(0.08, 0.5, 6), leg: zCapsule(0.1, 0.7, 6), fin: new THREE.BoxGeometry(0.28, 0.03, 0.55),
  gun: new THREE.BoxGeometry(0.09, 0.13, 0.7), barrel: zCyl(0.035, 0.035, 0.5, 6), plate: new THREE.BoxGeometry(0.3, 0.18, 0.42),
  box: new THREE.BoxGeometry(1, 1, 1), sph: new THREE.SphereGeometry(1, 16, 12), cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
  zcyl: zCyl(1, 1, 1, 14), torus: new THREE.TorusGeometry(1, 0.08, 6, 20),
};
const WCOL = [0xffe066, 0x4de8ff, 0xff9838, 0xf2f6f8, 0xff4d4d, 0xff4d4d, 0xd86bff, 0x7dffb0];
const SUIT_COL = { manta: 0x1fd6b4, triton: 0xf08a24, bulwark: 0x8a2f3a, goliath: 0x5a6a78, sepia: 0x9a4dff, barrakuda: 0xe8e8e8, nautilus: 0xffb347, hammerhai: 0x3fa9f5 };

function tri(a, b, c) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
  g.computeVertexNormals();
  return g;
}

export function makeTag(text, color = '#e8fbff') {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 48;
  const c = cv.getContext('2d');
  c.font = '600 26px Bahnschrift, "Segoe UI", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = 'rgba(3,16,26,0.55)';
  const w = Math.min(250, c.measureText(text).width + 22);
  c.beginPath(); c.roundRect(128 - w / 2, 6, w, 36, 10); c.fill();
  c.fillStyle = color; c.fillText(text, 128, 25);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(3.2, 0.6, 1);
  return s;
}

// ---------- divers & mech ----------
function buildDiver(suit, accent) {
  const S = SUITS[suit], g = new THREE.Group();
  const body = std(SUIT_COL[suit]), dark = std(0x26333f), acc = glow(accent, 0.45);
  const heavy = suit === 'bulwark', slim = suit === 'manta';
  add(g, GEO.torso, body).scale.set(heavy ? 1.3 : slim ? 0.85 : 1, heavy ? 1.15 : 1, 1);
  add(g, GEO.head, dark, 0, 0.05, -0.82).scale.setScalar(heavy ? 1.2 : 1);
  add(g, GEO.visor, glow(0x7df9ff, 1.4), 0, 0.02, -0.93).scale.setScalar(heavy ? 1.15 : 1);
  if (heavy) { add(g, GEO.tank, dark, -0.17, 0.4, 0.05); add(g, GEO.tank, dark, 0.17, 0.4, 0.05); add(g, GEO.plate, dark, -0.45, 0.1, -0.4); add(g, GEO.plate, dark, 0.45, 0.1, -0.4); }
  else add(g, GEO.tank, slim ? acc : std(0xd8dde2, { metalness: 0.7 }), 0, 0.36, 0.05);
  add(g, new THREE.BoxGeometry(heavy ? 0.7 : 0.5, 0.05, 0.12), acc, 0, heavy ? 0.36 : 0.3, -0.35);
  add(g, GEO.arm, body, -0.26, -0.18, -0.85); add(g, GEO.arm, body, 0.26, -0.18, -0.85);
  const gun = new THREE.Group(); gun.position.set(0, -0.22, -1.2); g.add(gun);
  const gunMat = std(0x3a4650), gunGlow = glow(WCOL[0], 1.2);
  add(gun, GEO.gun, gunMat); add(gun, GEO.barrel, gunGlow, 0, 0.02, -0.5);
  const legs = [];
  for (const sx of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(sx * 0.14, 0, 0.55); g.add(hip);
    add(hip, GEO.leg, body, 0, 0, 0.45); add(hip, GEO.fin, acc, 0, 0, 1.08).scale.set(slim ? 0.8 : 1, 1, slim ? 0.8 : 1);
    legs.push(hip);
  }
  if (slim) {
    const wm = glow(accent, 0.5, { side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
    add(g, tri([0.25, 0.08, -0.4], [1.35, 0.08, 0.45], [0.25, 0.08, 0.5]), wm);
    add(g, tri([-0.25, 0.08, -0.4], [-0.25, 0.08, 0.5], [-1.35, 0.08, 0.45]), wm);
  }
  g.scale.setScalar(S.scale);
  return { g, legs, gunGlow, mech: false };
}
// Der Goliath-Mech steht jetzt in mech.js (buildMech)

// Returns a group with userData.update(dt, {yaw, pitch, speed, t, weapon})
export function makePlayerModel(suit, id, name, tagColor) {   // tagColor: Farbe des Namensschilds (grün = Teamkamerad)
  const accent = new THREE.Color().setHSL((id * 0.137) % 1, 0.9, 0.6).getHex();
  const root = new THREE.Group();
  const parts = suit === 'goliath' ? buildMech(accent) : buildRealDiver(suit, accent);
  const inner = parts.g; inner.rotation.order = 'YXZ'; root.add(inner);
  if (name) { const tag = makeTag(name, tagColor); tag.position.y = suit === 'goliath' ? 3.0 : 1.5; root.add(tag); root.userData.tag = tag; }
  let phase = Math.random() * 6, lastW = -2, tilt = 0, heldKey = '', heldMesh = null, gunModel = null;
  root.userData.inner = inner;
  // wo die Mündung der Waffe gerade ist (null, wenn keine Waffe sichtbar ist)
  root.userData.muzzle = () => gunModel && parts.gun && parts.gun.visible ? gunModel.userData.muzzle : null;
  let knife = null, handBase = null;
  root.userData.update = (dt, s) => {
    inner.rotation.y = s.yaw;
    phase += dt * (3 + Math.min(14, s.speed) * 0.8);
    const amp = 0.12 + Math.min(1, s.speed / 9) * 0.4;
    if (parts.mech) {
      inner.rotation.x = s.pitch * 0.2;
      // Waffe in der rechten Zange: Oberarm hängt, Unterarm zeigt nach vorne (90°). Das Modell ist mech-groß.
      if (s.weapon !== lastW && s.weapon >= 0) {
        lastW = s.weapon;
        if (!parts.mgun) { parts.mgun = new THREE.Group(); parts.mgun.position.set(0, -1.1, -1.25); parts.arms[1].add(parts.mgun); }
        parts.mgun.clear(); gunModel = makeWaterGun(s.weapon); gunModel.scale.setScalar(3.8); parts.mgun.add(gunModel);
      }
      if (gunModel) { gunModel.userData.setGills(s.gills || 0); gunModel.userData.setCharge(s.charge || 0); }
      // Nachladen wie ein Roboter (MECH_RELOAD): Waffe kippt 90° (Magazin nach links), linker Arm schwenkt rein, Magazin raus und rein, zurück
      const R = s.rl || 0, seg = (a, b) => Math.max(0, Math.min(1, (R - a) / (b - a))), ease = (x) => x * x * (3 - 2 * x);
      const tilt = R > 0 ? ease(seg(0, 0.15)) * (1 - ease(seg(0.85, 1))) : 0;   // kippen am Anfang, zurück am Ende
      const reach = R > 0 ? ease(seg(0.12, 0.3)) * (1 - ease(seg(0.7, 0.88))) : 0; // linker Arm kommt rein und geht wieder
      if (parts.mgun) parts.mgun.rotation.z = -Math.PI / 2 * tilt;
      // beide Arme schwenken beim Nachladen zur Körpermitte und treffen sich vor der Brust (rechts mit der Waffe, links greift ans Magazin)
      parts.arms[1].rotation.set(s.pitch * (1 - tilt * 0.8) + tilt * 0.25, tilt * 0.95, 0);
      parts.arms[0].rotation.set(0.15 + reach * 0.3, -reach * 1.15, 0);
      if (gunModel && gunModel.userData.mag) { const M = gunModel.userData.mag, out = R > 0 ? Math.sin(Math.min(1, Math.max(0, (R - 0.3) / 0.4)) * Math.PI) : 0; M.g.position.copy(M.seat).addScaledVector(M.out, out * M.len * 1.3); }   // Magazin raus und wieder rein
      parts.legs[0].rotation.x = Math.sin(phase * 0.6) * amp; parts.legs[1].rotation.x = -Math.sin(phase * 0.6) * amp;
      if (parts.animate) parts.animate(dt, s.speed || 0, 0.25 + 0.15 * Math.sin(phase * 0.3));   // Propeller drehen, Zangen bewegen sich leicht
      // Goliath-Finisher: nach vorne greifen, hoch über den Kopf heben … und werfen!
      if (s.fin) {
        const p = s.fin.p, k = (a, b) => Math.max(0, Math.min(1, (p - a) / (b - a)));
        const x = p < 0.22 ? k(0, 0.22) * 0.5 : p < 0.45 ? 0.5 + k(0.22, 0.45) * 1.9 : 2.4 - k(0.45, 0.52) * 2.6;
        for (const a of parts.arms) a.rotation.x = p < 0.7 ? x : s.pitch;
      }
    } else {
      // at the surface the diver turns upright and treads water, head out of the water
      tilt += ((s.surf ? 1 : 0) - tilt) * Math.min(1, dt * 3);
      inner.rotation.x = s.pitch * (1 - tilt) + 1.15 * tilt;
      inner.rotation.z = Math.sin(phase * 0.5) * 0.05;
      if (parts.animate) parts.animate(dt, s, phase, 0.5 + amp * 1.6);
      else { parts.legs[0].rotation.x = Math.sin(phase) * amp; parts.legs[1].rotation.x = -Math.sin(phase) * amp; }
      // neue Waffe in der Hand: das passende weiß-blaue Modell einsetzen
      if (s.weapon !== lastW && s.weapon >= 0) {
        lastW = s.weapon;
        parts.gun.clear();
        gunModel = makeWaterGun(s.weapon); gunModel.scale.setScalar(0.9); parts.gun.add(gunModel);
      }
      if (gunModel) { gunModel.userData.setGills(s.gills || 0); gunModel.userData.setCharge(s.charge || 0); }
      // a fish or boss held in the hand instead of the weapon
      const hk = s.held ? JSON.stringify(s.held) : '';
      if (hk !== heldKey && parts.hand) {
        heldKey = hk;
        if (heldMesh) { parts.hand.remove(heldMesh); heldMesh = null; }
        if (s.held) { heldMesh = makeTrophy(s.held, s.held.b != null ? 1.5 : 0.8); heldMesh.position.set(0.1, 0.05, s.held.b != null ? -0.85 : -0.55); parts.hand.add(heldMesh); }
        parts.gun.visible = !s.held;
      }
      if (heldMesh) heldMesh.userData.update(dt, { yaw: Math.PI / 2, pitch: 0, state: 1 });
      // Finisher: Manta schneidet mit dem Messer, Bollwerk schlägt mit der Faust (Triton schießt einfach)
      if (parts.hand) {
        if (!handBase) handBase = parts.hand.rotation.clone();
        const f = s.fin && (s.fin.type === 'manta' || s.fin.type === 'bulwark') ? s.fin : null;
        if (f && f.type === 'manta' && !knife) {
          knife = new THREE.Group();
          add(knife, GEO.box, std(0x22282e), 0, 0, 0).scale.set(0.03, 0.03, 0.1);                                         // Griff
          add(knife, GEO.box, std(0xdfe8ee, { metalness: 0.9, roughness: 0.2 }), 0, 0.004, -0.15).scale.set(0.006, 0.035, 0.2);   // Klinge
          knife.position.set(0, 0, -0.32); parts.hand.add(knife);
        }
        if (knife) knife.visible = !!f && f.type === 'manta';
        if (parts.gun) parts.gun.visible = !f && !s.held;
        parts.hand.rotation.copy(handBase);
        if (f && f.type === 'manta') {          // ausholen … und quer durchziehen
          const p = f.p, cut = Math.max(0, Math.min(1, (p - 0.45) / 0.1));   // 0 = ausgeholt, 1 = durchgezogen
          parts.hand.rotation.y = handBase.y + (p < 0.45 ? 0.9 * Math.min(1, p / 0.3) : 0.9 - cut * 1.9);
        } else if (f) {                          // Bollwerk: Arm nach vorne, hält die Minigun (die Minigun selbst baut finisher.js)
          parts.hand.rotation.x = handBase.x - 0.35 * Math.min(1, f.p / 0.12);
        }
      }
    }
  };
  return root;
}

// ---------- vehicles ----------
export function makeSub() {
  const root = new THREE.Group(), g = new THREE.Group(); g.rotation.order = 'YXZ'; root.add(g);
  const hull = std(0xf2b705, { roughness: 0.4 }), dark = std(0x2c3d49);
  add(g, zCapsule(1.5, 4.4, 16), hull);
  add(g, GEO.sph, glow(0x7fdcf0, 0.35, { transparent: true, opacity: 0.85 }), 0, 0.1, -2.9).scale.setScalar(1.15);
  add(g, GEO.cyl, hull, 0, 1.7, -0.3).scale.set(0.7, 1.1, 0.7);
  add(g, GEO.cyl, dark, 0.2, 2.6, -0.3).scale.set(0.07, 0.9, 0.07);
  for (const sx of [-1, 1]) {
    add(g, zCapsule(0.45, 2.2), dark, sx * 1.75, -0.5, 0.2);
    add(g, GEO.box, hull, sx * 1.2, 0, 3.2).scale.set(1.6, 0.1, 0.9);
    add(g, GEO.sph, glow(0xfff2c0, 3), sx * 0.9, -0.6, -3.3).scale.setScalar(0.16);
  }
  add(g, GEO.box, hull, 0, 0.9, 3.2).scale.set(0.1, 1.6, 0.9);
  add(g, GEO.box, glow(0xff5a36, 0.8), 0, 0, 0).scale.set(3.05, 0.25, 0.5);
  const prop = new THREE.Group(); prop.position.z = 3.95; g.add(prop);
  for (let i = 0; i < 4; i++) { const b = add(prop, GEO.box, dark); b.scale.set(1.3, 0.08, 0.3); b.rotation.z = i * Math.PI / 4; }
  const ring = add(g, GEO.torus, dark, 0, 0, 3.95); ring.scale.setScalar(1.0);
  const beam = add(g, new THREE.ConeGeometry(3, 22, 16, 1, true).rotateX(Math.PI / 2).translate(0, 0, -14),
    new THREE.MeshBasicMaterial({ color: 0xcff6ff, transparent: true, opacity: 0.04, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  // MG-Kugel unten: Halterung, Glaskugel und zwei Läufe, die sich zum Blick des Schützen drehen (2-Mann-U-Boot)
  add(g, GEO.cyl, dark, 0, -1.45, 0).scale.set(0.45, 0.2, 0.45);
  const tur = new THREE.Group(); tur.position.set(0, -1.95, 0); g.add(tur);
  add(tur, GEO.sph, new THREE.MeshStandardMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.3, depthWrite: false }), 0, 0, 0).scale.setScalar(0.55);
  add(tur, GEO.torus, dark, 0, 0, 0).scale.setScalar(0.56);
  const guns = new THREE.Group(); tur.add(guns);
  for (const sx of [-1, 1]) { add(guns, GEO.zcyl, dark, sx * 0.16, -0.05, -0.55).scale.set(0.045, 0.045, 0.6); add(guns, GEO.zcyl, std(0x3a4046, { metalness: 0.8, roughness: 0.4 }), sx * 0.16, -0.05, -0.9).scale.set(0.06, 0.06, 0.12); }
  root.userData.body = g;   // hier hängt der Innenraum dran (Ego-Sicht im U-Boot)
  root.userData.update = (dt, s) => {
    g.rotation.y = s.yaw; g.rotation.x = s.pitch; prop.rotation.z += dt * (2 + s.speed * 1.5); beam.visible = !!s.driven;
    tur.rotation.y = s.gunner ? (s.gyaw || 0) - s.yaw : 0;   // Kugel dreht sich zum Blick des Schützen
    guns.rotation.x = s.gunner ? Math.max(-1.2, Math.min(0.4, (s.gpitch || 0) - s.pitch)) : 0;
  };
  return root;
}
// Jetski-Scooter: schlanker roter Rumpf mit weißem Streifen, Lenker, Sitz, zwei Kufen und einer leuchtenden Düse hinten
// Torpedo-Rochen: flacher Rochen-Körper mit zwei schlagenden Flügeln, Schwanz, Sattel und zwei Torpedos unter den Flügeln
export function makeRay() {
  const root = new THREE.Group(), g = new THREE.Group(); g.rotation.order = 'YXZ'; root.add(g);
  const b = new THREE.Group(); b.position.set(0, -0.7, 0); g.add(b);
  const skin = std(0x2f4a5c, { roughness: 0.55 }), belly = std(0xd8e2e6, { roughness: 0.6 }), dark = std(0x1d2329, { roughness: 0.5 });
  const wingShape = new THREE.Shape(); wingShape.moveTo(0, -0.9); wingShape.quadraticCurveTo(1.6, -0.4, 2.3, 0.35); wingShape.quadraticCurveTo(1.2, 0.6, 0, 0.9); wingShape.closePath();
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 }).rotateX(Math.PI / 2);
  add(b, GEO.sph, skin, 0, 0, 0).scale.set(0.75, 0.28, 1.25);                          // Körper
  add(b, GEO.sph, belly, 0, -0.08, 0.05).scale.set(0.65, 0.18, 1.1);                    // heller Bauch
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(s * 0.45, 0, 0); b.add(w);
    const m = add(w, wingGeo, skin, 0, 0.04, 0); m.scale.set(s, 1, 1);
    const pod = add(w, GEO.zcyl, dark, s * 0.9, -0.22, -0.1); pod.scale.set(0.12, 0.12, 1.1);   // Torpedo unter dem Flügel
    add(w, new THREE.ConeGeometry(0.12, 0.25, 12).rotateX(-Math.PI / 2), std(0xd8a818), s * 0.9, -0.22, -0.78);
    wings.push({ w, s });
  }
  const tail = add(b, GEO.zcyl, skin, 0, 0, 1.9); tail.scale.set(0.05, 0.05, 1.5);
  add(b, GEO.box, dark, 0, 0.28, 0.1).scale.set(0.5, 0.08, 0.9);                        // Sattel
  add(b, GEO.box, dark, 0, 0.4, -0.55).scale.set(0.55, 0.04, 0.05);                      // Haltegriff
  for (const s of [-1, 1]) add(b, GEO.sph, glow(0x7df9ff, 2), s * 0.32, 0.08, -1.08).scale.setScalar(0.07);   // leuchtende Augen
  let ph = Math.random() * 6;
  root.userData.update = (dt, s) => {
    g.rotation.y = s.yaw; g.rotation.x = s.pitch;
    ph += dt * (1.2 + (s.speed || 0) * 0.12);
    for (const { w, s: sd } of wings) w.rotation.z = sd * Math.sin(ph) * (0.18 + Math.min(0.25, (s.speed || 0) / 80));   // Flügelschlag
  };
  return root;
}
export function makeJetski() {
  const root = new THREE.Group(), g = new THREE.Group(); g.rotation.order = 'YXZ'; root.add(g);
  const b = new THREE.Group(); b.position.set(0, -0.55, -0.4); g.add(b);
  const red = std(0xd8262c, { roughness: 0.3, metalness: 0.2 }), white = std(0xf2f4f6, { roughness: 0.35 }), dark = std(0x1d2329, { roughness: 0.5 });
  add(b, zCapsule(0.32, 1.5, 14), red).scale.set(1.15, 0.7, 1);                        // Rumpf
  add(b, zCyl(0.3, 0.02, 0.6, 14), white, 0, 0, -1.3).scale.set(1.1, 0.7, 1);          // Nase (spitz nach vorne)
  add(b, GEO.box, white, 0, 0.2, -0.2).scale.set(0.5, 0.05, 1.3);                      // weißer Streifen oben
  add(b, GEO.box, dark, 0, 0.27, 0.35).scale.set(0.36, 0.1, 0.75);                     // Sitz
  add(b, GEO.cyl, dark, 0, 0.42, -0.45).scale.set(0.03, 0.4, 0.03);                    // Lenksäule
  add(b, GEO.box, dark, 0, 0.6, -0.45).scale.set(0.7, 0.04, 0.05);                     // Lenker
  for (const s of [-1, 1]) {
    add(b, zCapsule(0.08, 1.2, 8), white, s * 0.42, -0.18, 0.05);                       // Kufen
    add(b, GEO.box, red, s * 0.25, -0.1, 0.05).scale.set(0.2, 0.04, 0.9);
  }
  add(b, GEO.torus, dark, 0, -0.02, 1.15).scale.setScalar(0.18);                       // Düse
  const jet = add(b, GEO.sph, glow(0x4de8ff, 2.2), 0, -0.02, 1.2); jet.scale.set(0.13, 0.13, 0.05);
  root.userData.update = (dt, s) => { g.rotation.y = s.yaw; g.rotation.x = s.pitch; g.rotation.z = (s.roll || 0); jet.scale.z = 0.05 + Math.min(1, (s.speed || 0) / 30) * 0.25; };
  return root;
}
export function makeScooter() {
  const root = new THREE.Group(), g = new THREE.Group(); g.rotation.order = 'YXZ'; root.add(g);
  const b = new THREE.Group(); b.position.set(0, -0.5, -1.25); g.add(b);
  const hull = std(0x23c2e8, { roughness: 0.35 }), dark = std(0x26333f);
  add(b, zCyl(0.26, 0.26, 1.3), hull);
  add(b, zCyl(0.02, 0.26, 0.45), glow(0xffe066, 0.8), 0, 0, -0.87);
  add(b, GEO.box, dark, 0, 0.12, 0.45).scale.set(1.0, 0.05, 0.06);
  const ring = add(b, GEO.torus, dark, 0, 0, 0.72); ring.scale.setScalar(0.36);
  const prop = new THREE.Group(); prop.position.z = 0.72; b.add(prop);
  for (let i = 0; i < 3; i++) { const p = add(prop, GEO.box, dark); p.scale.set(0.6, 0.04, 0.1); p.rotation.z = i * Math.PI / 3; }
  root.userData.update = (dt, s) => { g.rotation.y = s.yaw; g.rotation.x = s.pitch; prop.rotation.z += dt * (3 + s.speed * 2); };
  return root;
}

// ---------- creatures (realistic versions live in creatures.js) ----------
export function makeShark(tint) { return makeRealShark(tint ? { back: tint } : {}); }
export function makeOcto(color) { return makeRealOcto(color); }
// Qualle: durchsichtige Glocke mit Leuchtkanälen und gewelltem Rand, innen 4 leuchtende Ringe (Keimdrüsen),
// darunter 4 gerüschte Mundarme und viele dünne Fangfäden, die im Wasser nachschwingen.
// JELLY_LOOK: tentacles = Anzahl Fangfäden, len = ihre Länge (Meter)
const JELLY_LOOK = { tentacles: 28, len: 2.6, pts: 14 };
const JELLY = (() => {
  const prof = [];   // Umriss der Glocke (von oben in der Mitte bis zum Rand), wird rundherum gedreht
  for (let i = 0; i <= 14; i++) { const t = i / 14, a = t * Math.PI * 0.52; prof.push(new THREE.Vector2(Math.sin(a) * 0.78 + t * t * 0.04, Math.cos(a) * 0.62 - 0.1 * t * t)); }
  const bell = new THREE.LatheGeometry(prof, 32);
  const rim = new THREE.TorusGeometry(0.8, 0.035, 6, 64); const rp = rim.attributes.position;
  for (let i = 0; i < rp.count; i++) { const x = rp.getX(i), y = rp.getY(i), a = Math.atan2(y, x), k = 1 + 0.035 * Math.sin(a * 16); rp.setXY(i, x * k, y * k); rp.setZ(i, rp.getZ(i) + 0.03 * Math.sin(a * 16)); }
  rim.rotateX(Math.PI / 2); rim.translate(0, -0.1, 0);
  // Leuchtkanäle: 16 Linien von oben bis zum Rand, auf der Glocke
  const cp = [];
  for (let c = 0; c < 16; c++) { const az = c / 16 * TAU; for (let i = 0; i < 14; i++) for (const ii of [i, i + 1]) { const pt = prof[ii]; cp.push(Math.cos(az) * pt.x * 1.01, pt.y + 0.005, Math.sin(az) * pt.x * 1.01); } }
  const canals = new THREE.BufferGeometry(); canals.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
  const gonad = new THREE.TorusGeometry(0.13, 0.035, 6, 16, Math.PI * 1.5);
  return { bell, rim, canals, gonad };
})();
export function makeJelly(id) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const c = [0xff7ad9, 0x7ae6ff, 0xb48cff][id % 3], col = new THREE.Color(c);
  root.userData.glowColor = c;   // so leuchtet die Qualle (main.js setzt dort ein schwaches Licht hin)
  const bellM = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.45, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, roughness: 0.15 });
  const bell = add(body, JELLY.bell, bellM);
  const inner = add(body, JELLY.bell, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: c, emissiveIntensity: 0.25, transparent: true, opacity: 0.18, side: THREE.BackSide, depthWrite: false })); inner.scale.setScalar(0.82);
  const rim = add(body, JELLY.rim, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.2, transparent: true, opacity: 0.85, depthWrite: false }));
  const add_ = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
  const canals = new THREE.LineSegments(JELLY.canals, new THREE.LineBasicMaterial({ color: col.clone().lerp(new THREE.Color(0xffffff), 0.4), opacity: 0.55, ...add_ })); body.add(canals);
  for (let i = 0; i < 4; i++) { const gd = add(body, JELLY.gonad, glow(c, 2.2), Math.cos(i / 4 * TAU) * 0.2, 0.32, Math.sin(i / 4 * TAU) * 0.2); gd.rotation.set(Math.PI / 2, 0, i / 4 * TAU); }   // 4 Leuchtringe
  const core = add(body, GEO.sph, glow(c, 1.6), 0, 0.15, 0); core.scale.set(0.16, 0.1, 0.16);
  // Fangfäden: dünne Linien, jedes Bild neu gebogen
  const JL = JELLY_LOOK, NT = JL.tentacles, NP = JL.pts, tp = new Float32Array(NT * (NP - 1) * 2 * 3);
  const tGeo = new THREE.BufferGeometry(); tGeo.setAttribute('position', new THREE.BufferAttribute(tp, 3)); tGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -JL.len / 2, 0), JL.len + 1);
  const tent = new THREE.LineSegments(tGeo, new THREE.LineBasicMaterial({ color: col.clone().lerp(new THREE.Color(0xffffff), 0.25), opacity: 0.6, ...add_ })); root.add(tent);
  // Mundarme: 4 gerüschte Bänder in der Mitte
  const NA = 4, AP = 12, ap = new Float32Array(NA * AP * 2 * 3), ai = [];
  for (let a = 0; a < NA; a++) for (let k = 0; k < AP - 1; k++) { const o = (a * AP + k) * 2; ai.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
  const aGeo = new THREE.BufferGeometry(); aGeo.setAttribute('position', new THREE.BufferAttribute(ap, 3)); aGeo.setIndex(ai); aGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -1, 0), 2.5);
  const oral = new THREE.Mesh(aGeo, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.7, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })); root.add(oral);
  let ph = (id * 1.7) % 6;
  root.userData.update = (dt) => {
    ph += dt * 2.4; const k = Math.sin(ph);
    body.scale.set(1 + k * 0.14, 1 - k * 0.18, 1 + k * 0.14);
    const rr = 0.8 * (1 + k * 0.14), ry = -0.1 * (1 - k * 0.18);
    let n = 0;
    for (let t = 0; t < NT; t++) {
      const az = t / NT * TAU, sx = Math.cos(az), sz = Math.sin(az);
      let px = sx * rr * 0.97, py = ry, pz = sz * rr * 0.97;
      for (let i = 1; i < NP; i++) {
        const f = i / (NP - 1), sway = Math.sin(ph * 0.8 - f * 3.2 + t) * 0.18 * f;   // die Welle läuft nach unten durch den Faden
        const nx = sx * rr * (0.97 - f * 0.25 * (1 - k * 0.6)) + sway * -sz, ny = ry - f * JL.len * (0.9 + 0.1 * Math.sin(t * 7.3)), nz = sz * rr * (0.97 - f * 0.25 * (1 - k * 0.6)) + sway * sx;
        tp[n++] = px; tp[n++] = py; tp[n++] = pz; tp[n++] = nx; tp[n++] = ny; tp[n++] = nz;
        px = nx; py = ny; pz = nz;
      }
    }
    n = 0;
    for (let a = 0; a < NA; a++) {
      const az = a / NA * TAU + 0.4;
      for (let i = 0; i < AP; i++) {
        const f = i / (AP - 1), y = -0.05 - f * 1.5, ruff = 0.07 * Math.sin(f * 14 + ph * 1.5 + a) * (0.4 + f), sw = Math.sin(ph * 0.7 - f * 2.5 + a) * 0.12 * f;
        const cx = Math.cos(az) * (0.08 + f * 0.12) + sw, cz = Math.sin(az) * (0.08 + f * 0.12), w = 0.1 + f * 0.06;
        const px = -Math.sin(az), pz = Math.cos(az);   // Richtung quer zum Band
        ap[n++] = cx - px * w + ruff; ap[n++] = y; ap[n++] = cz - pz * w;
        ap[n++] = cx + px * w - ruff; ap[n++] = y + ruff * 0.5; ap[n++] = cz + pz * w;
      }
    }
    tGeo.attributes.position.needsUpdate = true; aGeo.attributes.position.needsUpdate = true; aGeo.computeVertexNormals();
  };
  root.userData.update(0);
  return root;
}

// ---------- expedition: fish, bosses, ship ----------
export function makeFish(S, gold) { return makeRealFish(S, gold); }
// Floor boss with a name tag above it.
export function makeBoss(B) {
  const inner = makeRealBoss(B);
  const root = new THREE.Group(); root.add(inner);
  const tag = makeTag('☠ ' + B.name, '#ffc94d'); tag.scale.multiplyScalar(1.7); tag.position.y = B.r + 3; root.add(tag);
  root.userData.update = (dt, s) => inner.userData.update(dt, s);
  return root;
}
export function makeBoat() { return makeShip(); }
// A caught fish ({s, g}) or boss ({b}) as a small model about len metres long (for the hand and the aquarium).
export function makeTrophy(e, len) {
  const inner = e.b != null ? makeRealBoss(BOSSES[e.b]) : makeRealFish(FISH[e.s], !!e.g);
  const root = new THREE.Group(); root.add(inner);
  inner.userData.update(0, { yaw: 0, pitch: 0, state: 0 });
  const size = new THREE.Box3().setFromObject(inner).getSize(new THREE.Vector3());
  root.scale.setScalar(len / Math.max(0.01, size.x, size.y, size.z));
  root.userData.update = (dt, st) => inner.userData.update(dt, st);
  return root;
}

// ---------- loot ----------
export function makeCrate() {
  const g = new THREE.Group();
  const hull = std(0x13616e, { metalness: 0.55, roughness: 0.4 }), band = std(0xd9a441, { metalness: 0.8, roughness: 0.3 });
  add(g, GEO.box, hull, 0, 0.45, 0).scale.set(1.5, 0.9, 1.0);
  for (const x of [-0.5, 0.5]) add(g, GEO.box, band, x, 0.45, 0).scale.set(0.14, 0.94, 1.04);
  const lid = new THREE.Group(); lid.position.set(0, 0.9, 0.5); g.add(lid);
  add(lid, GEO.box, hull, 0, 0.13, -0.5).scale.set(1.5, 0.26, 1.0);
  for (const x of [-0.5, 0.5]) add(lid, GEO.box, band, x, 0.13, -0.5).scale.set(0.14, 0.3, 1.04);
  const seam = add(g, GEO.box, glow(0xffd166, 2.5), 0, 0.9, 0); seam.scale.set(1.52, 0.05, 1.02);
  // kein Lichtstrahl mehr nach oben: Truhen sind versteckt (in den Höhlen der Korallen-Berge) und müssen gesucht werden
  const beam = add(g, GEO.cyl, new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 9, 0);
  beam.scale.set(0.3, 16, 0.3); beam.visible = false;
  g.userData.open = (instant) => { lid.rotation.x = 1.9; seam.visible = false; beam.visible = false; g.userData.isOpen = true; };
  return g;
}
export function makePickup(kind, wid, rar) {
  const g = new THREE.Group(), spin = new THREE.Group(); g.add(spin);
  let col;
  if (kind === 'w') {
    col = new THREE.Color(RARITY[rar].color).getHex();
    const wc = { pistol: 0, needler: 1, scatter: 2, harpoon: 3, torpedo: 4 }[wid] ?? 0;
    const len = { pistol: 0.5, needler: 0.85, scatter: 0.7, harpoon: 1.2, torpedo: 1.0 }[wid] ?? 0.7;
    const thick = wid === 'torpedo' ? 0.26 : wid === 'scatter' ? 0.2 : 0.13;
    add(spin, GEO.box, std(0x2b343c, { metalness: 0.6 })).scale.set(thick, thick + 0.05, len);
    add(spin, GEO.box, std(0x2b343c), 0, -0.16, len * 0.25).scale.set(0.08, 0.22, 0.1);
    add(spin, GEO.zcyl, glow(WCOL[wc], 1.5), 0, 0.02, -len * 0.55).scale.set(0.05, 0.05, len * 0.5);
  } else if (kind === 'med') {
    col = 0x4dff88;
    add(spin, GEO.box, std(0xf2f6f8)).scale.set(0.55, 0.45, 0.3);
    add(spin, GEO.box, glow(0x2ee66b, 1.6)).scale.set(0.36, 0.1, 0.32); add(spin, GEO.box, glow(0x2ee66b, 1.6)).scale.set(0.1, 0.34, 0.32);
  } else {
    col = 0x4db8ff;
    add(spin, new THREE.IcosahedronGeometry(0.34, 0), glow(0x4db8ff, 1.4, { transparent: true, opacity: 0.85, flatShading: true }));
  }
  const ring = add(g, GEO.torus, new THREE.MeshBasicMaterial({ color: col }), 0, -0.45, 0);
  ring.rotation.x = Math.PI / 2; ring.scale.setScalar(0.5);
  const halo = add(g, GEO.sph, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.setScalar(0.85);
  const by = Math.random() * 6;
  g.userData.update = (t) => { spin.rotation.y = t * 1.4 + by; spin.position.y = Math.sin(t * 2 + by) * 0.12; };
  return g;
}

// ---------- projectiles ----------
const PGEO = [zCapsule(0.05, 0.5, 5), zCapsule(0.035, 0.7, 5), new THREE.SphereGeometry(0.08, 6, 5), zCyl(0.03, 0.03, 1.6, 5), zCapsule(0.16, 0.8, 8), zCapsule(0.2, 1.0, 8), zCapsule(0.07, 1.1, 6), new THREE.TorusGeometry(0.35, 0.06, 6, 16),
  zCapsule(0.06, 0.5, 5), zCapsule(0.025, 0.45, 4), new THREE.IcosahedronGeometry(0.35, 1), zCapsule(0.06, 0.9, 6),
  zCapsule(0.03, 0.3, 4), zCapsule(0.03, 0.3, 4), zCapsule(0.03, 0.3, 4)];   // Stabwaffen (fliegen nicht, nur Platzhalter)   // Revolver, Stachel-MG, Netz, Magnet
// Alle Waffen schießen komprimiertes Wasser: jede Waffe hat ihr eigenes Blau (hell = klein, dunkel/kräftig = groß).
//               Pistole   Nadler    Splitter  Harpune   Torpedo   Bordtorp. Plasma    Schall    Revolver  Stachel   Netz      Magnet
const SHOT_COL = [0x9fe4ff, 0x6fd6ff, 0xbff0ff, 0xe8f8ff, 0x2f8cff, 0x2f8cff, 0x4dc3ff, 0x1f6bff, 0xcfefff, 0x8fe0ff, 0xd8ffe0, 0xc28bff, 0xffffff, 0x5ef2e0, 0xffffff];
const PMAT = SHOT_COL.map(c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85 }));
export function makeProjectile(widx) { return new THREE.Mesh(PGEO[widx] || PGEO[0], PMAT[widx] || PMAT[0]); }

// ---------- Wasserdruck-Waffen (weiß-blau, mit Kiemen) ----------
// Jede Waffe wird aus Seitenprofilen gebaut: ein Umriss (u = nach vorne, v = nach oben, in Metern),
// der dick gemacht wird und abgerundete Kanten bekommt. Der Ursprung (0, 0) ist da, wo die Hand den Griff hält.
// kind: 'pistol' = Pistole, 'rifle' = Gewehr, 'tube' = Werferrohr. L = Länge, H = Höhe, W = Breite, R = Rohr-Radius.
const GUNS = [
  /* 0 Bolzenpistole  */ { kind: 'pistol', L: 0.2,  H: 0.034, W: 0.03,  barrel: 0.02, br: 0.009, gills: 3 },
  /* 1 Nadler         */ { kind: 'rifle',  L: 0.28, H: 0.05,  W: 0.04,  barrel: 0.16, br: 0.009, gills: 3, stock: 'short', magK: 1 },
  /* 2 Splitterwerfer */ { kind: 'rifle',  L: 0.34, H: 0.06,  W: 0.05,  barrel: 0.3,  br: 0.02,  gills: 4, stock: 'full', pump: true, magK: 1.2 },
  /* 3 Harpune        */ { kind: 'rifle',  L: 0.34, H: 0.05,  W: 0.04,  barrel: 0.45, br: 0.012, gills: 4, stock: 'full', scope: true, magK: 0.85, spear: true },
  /* 4 Torpedowerfer  */ { kind: 'tube',   L: 0.75, R: 0.075, gills: 5 },
  /* 5 Bordtorpedo    */ { kind: 'tube',   L: 0.75, R: 0.075, gills: 5 },
  /* 6 Plasmalanze    */ { kind: 'rifle',  L: 0.4,  H: 0.065, W: 0.05,  barrel: 0.3,  br: 0.016, gills: 4, stock: 'full', scope: true, magK: 1.15 },
  /* 7 Schallkanone   */ { kind: 'tube',   L: 0.85, R: 0.095, gills: 6, dish: true },
  /* 8 Bolzen-Revolver*/ { kind: 'pistol', L: 0.24, H: 0.04,  W: 0.034, barrel: 0.03, br: 0.011, gills: 3, drum: true },
  /* 9 Stachel-MG     */ { kind: 'rifle',  L: 0.36, H: 0.055, W: 0.045, barrel: 0.26, br: 0.01,  gills: 5, stock: 'full', magK: 1.35, spikes: true },
  /*10 Netzwerfer     */ { kind: 'tube',   L: 0.6,  R: 0.085, gills: 4, net: true },
  /*11 Magnet-Gewehr  */ { kind: 'rifle',  L: 0.42, H: 0.06,  W: 0.05,  barrel: 0.38, br: 0.014, gills: 4, stock: 'full', scope: true, magK: 1.0, coil: true },
  /*12 Dreizack       */ { kind: 'pole',   L: 1.5,  R: 0.016, head: 'trident' },
  /*13 Elektro-Speer  */ { kind: 'pole',   L: 1.6,  R: 0.015, head: 'spear' },
  /*14 Kampfstab      */ { kind: 'pole',   L: 1.4,  R: 0.022, head: 'staff' },
];
const GUN_WHITE = 0xf2f7fa, GUN_BLUE = 0x2fa8ff;
const SIGHT_GLOW = 0x6dff8a;   // Farbe der Leuchtpunkte auf Kimme und Korn (grün wie echte Leuchtvisiere)
// Aussehen der Waffen: body = Gehäuse (Kunststoff), metal = Stahlteile, grip = Gummigriff, bodyGlow = wie stark das Gehäuse
// von selbst leuchtet (damit man es im Dunkeln noch erahnt). Die alten weißen Waffen: body 0xf2f7fa, bodyGlow 0.45
// Echte Waffen-Optik: Rahmen aus mattem schwarz-grauem Polymer, Stahlteile in Gunmetal-Grau (brüniert), Griff mit Noppen-Gummi.
// Nur die Kiemen sind weiß-blau (gills / gillEdge). brass = Messing der Bolzen im Magazin.
export const GUN_LOOK = { body: 0x34383c, metal: 0x4c5359, grip: 0x1b1f22, bodyGlow: 0.06, gills: 0xf2f7fa, gillEdge: 0x2fa8ff, brass: 0xb8914a };
// Spiegel-Umgebung für Metall (wird in main.js einmal erzeugt): oben helles Wasser, unten dunkel,
// dazu zwei weiche helle Flecken (wie Lampen), damit Kanten und Rundungen Glanzlichter bekommen
export const GUN_ENV = { tex: null };
export function makeGunEnv(renderer) {
  const sc = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vP; void main(){
      vec3 d = normalize(vP); float y = d.y;
      vec3 top = vec3(0.62, 0.8, 0.92), mid = vec3(0.08, 0.2, 0.28), bot = vec3(0.015, 0.03, 0.045);
      vec3 c = y > 0.0 ? mix(mid, top, pow(y, 1.4)) : mix(mid, bot, pow(-y, 0.6));
      c += vec3(1.0, 0.97, 0.9) * 2.2 * pow(max(0.0, dot(d, normalize(vec3(0.3, 0.75, -0.6)))), 40.0);    // Lampe vorne oben
      c += vec3(0.6, 0.85, 1.0) * 0.9 * pow(max(0.0, dot(d, normalize(vec3(-0.8, 0.3, 0.4)))), 16.0);    // Streulicht seitlich
      gl_FragColor = vec4(c, 1.0); }` });
  sc.add(new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), mat));
  const pm = new THREE.PMREMGenerator(renderer);
  GUN_ENV.tex = pm.fromScene(sc, 0.02).texture; pm.dispose();
}
// Profile werden pro Waffe nur einmal gebaut und dann wiederverwendet (spart Speicher)
const GUN_GEO = new Map();
// Würfel mit abgerundeten Kanten (1 × 1 × 1), damit nichts mehr kantig aussieht
const RBOX = (() => {
  const bs = 0.14, bt = 0.14, h = 0.5 - bs, r = 0.12, s = new THREE.Shape();
  s.moveTo(-h + r, -h); s.lineTo(h - r, -h); s.quadraticCurveTo(h, -h, h, -h + r); s.lineTo(h, h - r); s.quadraticCurveTo(h, h, h - r, h);
  s.lineTo(-h + r, h); s.quadraticCurveTo(-h, h, -h, h - r); s.lineTo(-h, -h + r); s.quadraticCurveTo(-h, -h, -h + r, -h);
  const d = 1 - 2 * bt, geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: bt, bevelSize: bs, bevelSegments: 3, curveSegments: 4 });
  geo.translate(0, 0, -d / 2); geo.computeVertexNormals();
  return geo;
})();
const GUN_CYL = zCyl(1, 1, 1, 32);     // glatte Zylinder (32 Ecken statt 14)
const GUN_CYL_Y = new THREE.CylinderGeometry(1, 1, 1, 24);   // stehender Zylinder (für Magazine)
const GUN_TUBE = new THREE.CylinderGeometry(1, 1, 1, 32, 1, true).rotateX(Math.PI / 2);   // Rohr ohne Deckel (offen)
const FINGER = new THREE.CylinderGeometry(1, 1, 1, 14).rotateX(Math.PI / 2), KNUCKLE = new THREE.SphereGeometry(1, 16, 12);
const FINGER_T = new THREE.CylinderGeometry(0.86, 1, 1, 16).rotateX(Math.PI / 2);   // Fingerglied: vorne 14 % dünner als hinten
// weicher Klotz für Handflächen: stärker abgerundet als RBOX, damit Hände nicht wie Bauklötze aussehen
const RBOX_SOFT = (() => {
  const bs = 0.24, bt = 0.26, h = 0.5 - bs, r = 0.2, s = new THREE.Shape();
  s.moveTo(-h + r, -h); s.lineTo(h - r, -h); s.quadraticCurveTo(h, -h, h, -h + r); s.lineTo(h, h - r); s.quadraticCurveTo(h, h, h - r, h);
  s.lineTo(-h + r, h); s.quadraticCurveTo(-h, h, -h, h - r); s.lineTo(-h, -h + r); s.quadraticCurveTo(-h, -h, -h + r, -h);
  const d = 1 - 2 * bt, geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: bt, bevelSize: bs, bevelSegments: 5, curveSegments: 6 });
  geo.translate(0, 0, -d / 2); geo.computeVertexNormals();
  return geo;
})();
// Unterarm wie ein echter Arm: am Handgelenk (z = −0.5) schmal, dann der Muskel, zum Ellbogen (z = +0.5) wieder etwas dünner.
// ARM_PROFILE = [Stelle von 0 (Handgelenk) bis 1 (Ellbogen), Dicke] – zum Ausprobieren einfach die Zahlen ändern
const ARM_PROFILE = [[0, 0.66], [0.12, 0.7], [0.35, 0.92], [0.55, 1.0], [0.8, 0.95], [1, 0.86]];
const FORE = (() => {
  const pts = [new THREE.Vector2(0, 0)];
  for (let i = 0; i <= 24; i++) {   // weich zwischen den Profil-Punkten
    const u = i / 24; let j = 0; while (j < ARM_PROFILE.length - 2 && u > ARM_PROFILE[j + 1][0]) j++;
    const [u0, r0] = ARM_PROFILE[j], [u1, r1] = ARM_PROFILE[j + 1], k = (u - u0) / (u1 - u0), sk = k * k * (3 - 2 * k);
    pts.push(new THREE.Vector2(r0 + (r1 - r0) * sk, u - 0.5));
  }
  pts.push(new THREE.Vector2(0, 0.5));
  return new THREE.LatheGeometry(pts, 24).rotateX(Math.PI / 2);   // Achse zeigt nach z (wie FINGER)
})();
// Bündchen: kurzes, glattes Rohr, am Handgelenk enger (statt dicker Kugeln)
const CUFF = new THREE.CylinderGeometry(1, 0.82, 1, 24).rotateX(Math.PI / 2);
function cuff(parent, mat, a, b, r) {
  const A = new THREE.Vector3(...a), d = new THREE.Vector3(...b).sub(A), len = d.length(); d.normalize();
  const m = new THREE.Mesh(CUFF, mat); m.scale.set(r, r * 0.9, len); m.position.copy(A).addScaledVector(d, len / 2); m.quaternion.setFromUnitVectors(Z_AXIS, d); parent.add(m); return m;
}
const ARM_FLAT = 0.84;   // Unterarm ist oben/unten etwas flacher als breit (nicht kreisrund)
// Unterarm von a (Handgelenk) nach b (Ellbogen) mit Dicke r, dazu zwei Neopren-Falten am Handgelenk
function limb(parent, mat, a, b, r) {
  const A = new THREE.Vector3(...a), d = new THREE.Vector3(...b).sub(A), len = d.length(); d.normalize();
  const m = new THREE.Mesh(FORE, mat); m.scale.set(r, r * ARM_FLAT, len); m.position.copy(A).addScaledVector(d, len / 2); m.quaternion.setFromUnitVectors(Z_AXIS, d); parent.add(m);
  for (const u of [0.07, 0.13]) { const f = new THREE.Mesh(GEO.torus, mat); f.scale.set(r * 0.74, r * 0.74 * ARM_FLAT, r * 0.5); f.position.copy(A).addScaledVector(d, len * u); f.quaternion.copy(m.quaternion); parent.add(f); }
  return m;
}
function profileGeo(key, pts, depth, holes = []) {
  if (GUN_GEO.has(key)) return GUN_GEO.get(key);
  const sh = new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v)));
  for (const h of holes) sh.holes.push(new THREE.Path(h.map(([u, v]) => new THREE.Vector2(u, v))));
  const bev = Math.min(0.005, depth * 0.22), d = Math.max(0.002, depth - bev * 2);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.7, bevelSegments: 4, curveSegments: 10 });   // mehr Rundungsstufen = sauberere Glanzkanten
  geo.translate(0, 0, -d / 2);
  geo.rotateY(Math.PI / 2);            // Umriss-u zeigt jetzt nach vorne (-z), die Dicke liegt quer (x)
  GUN_GEO.set(key, geo);
  return geo;
}
// fp = true: Version für die Ego-Perspektive (ohne Schaft – der steckt an der Schulter, außerhalb des Bildes)
export function makeWaterGun(widx, fp = false, mods = null) {   // mods = Aufsätze (nur Ego-Sicht)
  const P = GUNS[widx] || GUNS[0], K = 'g' + widx + ':';
  const g = new THREE.Group();
  // Materialien (jede Waffe eigene, weil Kiemen und Druckanzeige leuchten). Farben: GUN_LOOK oben.
  // Gehäuse: matter Kunststoff mit feiner Körnung · Metall: gebürsteter Stahl, spiegelt die Umgebung · Griff: Gummi mit Noppen
  const L = GUN_LOOK, env = GUN_ENV.tex;
  // Polymer mit Schrammen (polyWear) · Stahl mit Kratzern und blank gescheuerten Stellen (steelWear / steelRough)
  const white = new THREE.MeshStandardMaterial({ color: L.body, emissive: L.body, emissiveIntensity: L.bodyGlow, map: polyWear(), roughness: 0.62, metalness: 0.2, bumpMap: polymer(), bumpScale: 0.5, roughnessMap: polymer(), envMap: env, envMapIntensity: 0.35 });
  const metal = new THREE.MeshStandardMaterial({ color: L.metal, emissive: 0x0c1014, emissiveIntensity: 0.4, map: steelWear(), roughness: 0.3, roughnessMap: steelRough(), metalness: 0.95, bumpMap: brushed(), bumpScale: 0.5, envMap: env, envMapIntensity: 1.6 });
  const gripM = new THREE.MeshStandardMaterial({ color: L.grip, emissive: 0x0a0d10, emissiveIntensity: 0.4, roughness: 0.85, metalness: 0.05, bumpMap: stipple(), bumpScale: 1.8, envMap: env, envMapIntensity: 0.15 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x15191d, emissive: 0x06090c, emissiveIntensity: 0.4, roughness: 0.6, metalness: 0.4, envMap: env, envMapIntensity: 0.4 });
  // Früher leuchtend blaue Zierteile (Ringe, Bodenplatten, Knöpfe): jetzt dunkler, brünierter Stahl wie bei echten Waffen
  const blue = new THREE.MeshStandardMaterial({ color: 0x2c3136, map: steelWear(), roughness: 0.36, roughnessMap: steelRough(), metalness: 0.9, bumpMap: brushed(), bumpScale: 0.4, envMap: env, envMapIntensity: 1.25 });
  // Gravur-Schild: Schrift, die in die Seite der Waffe geprägt ist. u0..u1 = von hinten nach vorne, v = Höhe, h = Schrifthöhe, x = Seite (+ rechts, − links)
  const engrave = (text, u0, u1, v, h, x) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(u1 - u0, h), new THREE.MeshStandardMaterial({ map: engraving(text), transparent: true, depthWrite: false, roughness: 0.5, metalness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.position.set(x, v, -(u0 + u1) / 2); m.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2; tgt.add(m); return m;
  };
  // Stift / Schraube quer durch die Waffe (sieht man auf beiden Seiten)
  const pin = (u, v, w, r = 0.0022) => { const p = part(GUN_CYL, metal, 0, v, -u); p.scale.set(r, r, w + 0.002); p.rotation.y = Math.PI / 2; return p; };
  // Kiemen: das Einzige in Weiß-Blau
  const gillWhite = new THREE.MeshStandardMaterial({ color: L.gills, emissive: L.gills, emissiveIntensity: 0.25, roughness: 0.4 });
  const gillEdge = new THREE.MeshStandardMaterial({ color: L.gillEdge, emissive: L.gillEdge, emissiveIntensity: 1.3, roughness: 0.3 });
  const brassM = new THREE.MeshStandardMaterial({ color: L.brass, roughness: 0.3, metalness: 0.9, envMap: env, envMapIntensity: 1.0 });
  const magBody = new THREE.MeshStandardMaterial({ color: 0x23272b, roughness: 0.7, metalness: 0.15, bumpMap: polymer(), bumpScale: 0.6, envMap: env, envMapIntensity: 0.3 });
  const gillIn = new THREE.MeshStandardMaterial({ color: 0x08233d, emissive: GUN_BLUE, emissiveIntensity: 0.15, roughness: 0.5 });
  // Linsen (Zielfernrohr, Visier): leicht getöntes Glas, spiegelt – leuchtet nicht
  const glass = new THREE.MeshStandardMaterial({ color: 0x3a5560, transparent: true, opacity: 0.75, roughness: 0.05, metalness: 0.6, envMap: env, envMapIntensity: 1.4 });
  const fill = new THREE.MeshStandardMaterial({ color: 0x2a2f34, roughness: 0.5, metalness: 0.6 });   // (früher leuchtende Druckanzeige)
  const anim = { t: 9, prev: 0, n: 0, coverA: 0, coverOpen: false };   // Schuss-Mechanik (Schlitten, Verschluss, Hahn …), siehe fireAnim unten
  let tgt = g;   // wohin neue Teile kommen (normalerweise die Waffe selbst, beim Schlitten in dessen Gruppe)
  const part = (geo, mat, x = 0, y = 0, z = 0) => add(tgt, geo, mat, x, y, z);
  // Box von u0 bis u1 (vorne), v0 bis v1 (oben), Breite w, seitlich verschoben um x
  const box = (mat, u0, u1, v0, v1, w, x = 0) => { const m = part(RBOX, mat, x, (v0 + v1) / 2, -(u0 + u1) / 2); m.scale.set(w, v1 - v0, u1 - u0); return m; };
  // Zylinder entlang der Waffe (nach vorne), von u0 bis u1 auf Höhe v
  const tube = (mat, u0, u1, v, r) => { const m = part(GUN_CYL, mat, 0, v, -(u0 + u1) / 2); m.scale.set(r, r, u1 - u0); return m; };
  const side = (key, mat, pts, w, holes) => part(profileGeo(K + key, pts, w, holes), mat);
  const ring = (u, v, r, mat = blue) => tube(mat, u - 0.004, u + 0.004, v, r);
  const flaps = [];   // Kiemen-Lamellen
  // Magazin: eine Gruppe, deren Ursprung das obere Ende ist (das Ende, das in der Waffe steckt); es zeigt nach unten (−y).
  // magFill leuchtet je nachdem, wie voll das Magazin ist.
  const magFill = brassM;   // oben im Magazin schauen die Messing-Bolzen raus
  let mag = null;
  const makeMag = (kind, k = 1) => {
    const m = new THREE.Group(), at = (geo, mat, y, sx, sy, sz) => { const o = new THREE.Mesh(geo, mat); o.position.y = y; o.scale.set(sx, sy, sz); m.add(o); return o; };
    let len;
    if (kind === 'pistol') {          // flaches Magazin, steckt fast ganz im Griff, unten die blaue Bodenplatte
      len = 0.104;
      at(RBOX, magBody, -0.05, P.W * 0.62, 0.1, 0.03); at(RBOX, magFill, -0.004, P.W * 0.4, 0.008, 0.02);   // Magazin aus Polymer, oben der erste Bolzen
      at(RBOX, blue, -0.101, P.W * 0.9, 0.009, 0.046);
    } else if (kind === 'rifle') {    // durchsichtige Druckpatrone mit Metallkappe
      len = 0.1 * k;
      at(RBOX, magBody, -0.045 * k, 0.026 * k, 0.09 * k, 0.04 * k).rotation.x = 0.12;   // Kastenmagazin (leicht gebogen)
      at(RBOX, magBody, -0.095 * k, 0.03 * k, 0.012, 0.046 * k); at(RBOX, magFill, -0.003, 0.012 * k, 0.006, 0.03 * k);

    } else if (kind === 'magnet') { // Magnet-Gewehr: Hufeisen-Magnet, der vorne auf den Lauf gesetzt wird (er zeigt nach −y = nach vorne)
      len = 0.07;
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.008, 10, 20, Math.PI), magFill); arc.position.y = -0.045; arc.rotation.z = Math.PI; m.add(arc);
      at(RBOX, metal, -0.022, 0.016, 0.03, 0.016); arc.position.x = 0;
      for (const sx of [-1, 1]) { at(RBOX, magBody, -0.02, 0.012, 0.03, 0.012).position.x = sx * 0.022; at(RBOX, blue, -0.006, 0.013, 0.006, 0.013).position.x = sx * 0.022; }
    } else {                          // dicke Patrone für die Werfer
      len = 0.15;
      at(GUN_CYL_Y, metal, -0.065, P.R * 0.62, 0.13, P.R * 0.62); at(GUN_CYL_Y, magBody, -0.03, P.R * 0.64, 0.02, P.R * 0.64);   // Stahl-Patrone mit Gummiring
      at(GUN_CYL_Y, metal, -0.14, P.R * 0.68, 0.02, P.R * 0.68); at(GUN_CYL_Y, blue, -0.128, P.R * 0.69, 0.006, P.R * 0.69);
    }
    return { m, len };
  };
  const seatMag = (kind, k, x, y, z, tilt) => {
    const { m, len } = makeMag(kind, k);
    m.position.set(x, y, z); m.rotation.x = tilt; g.add(m);
    const out = new THREE.Vector3(0, -1, 0).applyQuaternion(m.quaternion);   // in diese Richtung wird es herausgezogen
    mag = { g: m, seat: m.position.clone(), seatQ: m.quaternion.clone(), out, len, fill: magFill };
  };
  let rear = 0, chargeBars = [];
  // muzzleAt = wo der Schuss rauskommt, gripTop/gripW = Griff für die rechte Hand, support = Stelle für die linke Hand
  let muzzleAt = [0, 0, 0], gripTop = 0, gripW = 0.04, support = null;
  // cock = Teil, das beim Durchladen nach hinten gezogen wird (Schlitten oder Spannhebel), sightAt = Höhe/Seite der Visierlinie
  let cock = null, sightAt = [0, 0];
  // Kiemen: n senkrechte Schlitze auf beiden Seiten (x = ±sx), von u0 nach vorne, Höhe h um v
  const gills = (n, u0, du, v, h, sx) => {
    for (const s of [-1, 1]) for (let i = 0; i < n; i++) {
      const u = u0 + i * du;
      box(gillIn, u - du * 0.25, u + du * 0.25, v - h / 2, v + h / 2, 0.004, s * sx);           // leuchtender Schlitz
      for (let k = 0; k < 3; k++) {                                                          // 3 Lamellen, die sich auffächern
        const hinge = new THREE.Group(); hinge.position.set(s * (sx + 0.002 + k * 0.0015), v, -(u + du * 0.3)); tgt.add(hinge);
        const len = du * (0.42 - k * 0.1), hh = h * (1 - k * 0.12);   // schmale Lamellen mit Lücken (wie Lüftungsschlitze)
        const lam = add(hinge, GEO.box, gillWhite, 0, 0, len / 2); lam.scale.set(0.0025, hh, len);
        const edge = add(hinge, GEO.box, gillEdge, s * 0.0014, 0, len - 0.002); edge.scale.set(0.001, hh, 0.003);   // blaue Kante
        flaps.push({ hinge, s, k });
      }
    }
  };
  // Druckanzeige: dunkles Fenster mit blauem Balken, der beim Komprimieren voll wird
  const chargeBar = (u0, u1, v, h, sx) => {
    return;   // echte Waffen haben keine leuchtende Druckanzeige
    for (const s of [-1, 1]) {
      box(dark, u0, u1, v - h / 2, v + h / 2, 0.003, s * sx);
      const bar = box(fill, u0 + 0.003, u1 - 0.003, v - h * 0.3, v + h * 0.3, 0.003, s * (sx + 0.001));
      chargeBars.push({ bar, u0: u0 + 0.003, len: u1 - u0 - 0.006 });
    }
  };
  // Griff mit Abzugsbügel und Abzug; top = Unterkante des Gehäuses
  const grip = (top, w, len = 0.1, plate = true) => {
    // Pistolengriff wie bei echten Gewehren: schräg nach hinten geneigt, vorne eine Fingermulde, hinten ein Buckel für die Handfläche
    const k = len / 0.1;
    side('grip', gripM, [[-0.016, top], [0.03, top], [0.022, top - 0.018 * k], [0.016, top - 0.034 * k], [0.019, top - 0.046 * k], [0.008, top - 0.08 * k], [0.0, top - 0.097 * k],
      [-0.026, top - 0.1 * k], [-0.034, top - 0.092 * k], [-0.034, top - 0.06 * k], [-0.028, top - 0.025 * k], [-0.022, top - 0.008 * k]], w * 0.8);
    if (plate) box(white, -0.03, 0.002, top - 0.103 * k, top - 0.096 * k, w * 0.82);                           // Griffboden
    side('guard', white, [[0.03, top], [0.098, top], [0.098, top - 0.008], [0.09, top - 0.032], [0.026, top - 0.032]], w * 0.35,
      [[[0.036, top - 0.005], [0.091, top - 0.005], [0.085, top - 0.026], [0.036, top - 0.026]]]);
    const trig = box(metal, 0.052, 0.058, top - 0.024, top - 0.002, w * 0.2); trig.rotation.x = 0.35; anim.trig = trig;
  };

  if (P.kind === 'pistol' && P.drum) {
    // ----- Revolver: Rahmen mit Fenster für die Trommel, schwerer Lauf mit Unterlauf, Hahn, runder Griff -----
    const { L, W } = P, cy = 0.018, top = 0.056, t = -0.014;   // cy = Höhe der Trommelmitte
    side('rframe', white, [[-0.034, t], [0.085, t], [0.085, top], [-0.016, top], [-0.03, top - 0.012], [-0.036, 0.02]], W,
      [[[0.006, -0.008], [0.066, -0.008], [0.066, top - 0.01], [0.006, top - 0.01]]]);          // Fenster für die Trommel
    tube(metal, 0.085, L, cy + 0.012, P.br * 1.5);                                              // Lauf
    box(metal, 0.085, L - 0.004, cy - 0.012, cy + 0.01, W * 0.58);                              // Unterlauf (unter dem Lauf, ganz durch)
    box(dark, 0.088, L - 0.006, cy + 0.024, cy + 0.03, W * 0.32);                               // Laufschiene oben
    tube(dark, L - 0.0005, L + 0.0005, cy + 0.012, P.br * 0.8);                                 // Laufbohrung
    box(metal, L - 0.02, L - 0.012, cy + 0.028, cy + 0.04, 0.004);                              // Korn
    box(dark, -0.02, -0.012, top, top + 0.006, 0.006, -0.005); box(dark, -0.02, -0.012, top, top + 0.006, 0.006, 0.005);   // Kimme
    const dotV = new THREE.MeshStandardMaterial({ color: SIGHT_GLOW, emissive: SIGHT_GLOW, emissiveIntensity: 2.2 });
    add(g, KNUCKLE, dotV, 0, cy + 0.037, -(L - 0.016) - 0.004).scale.setScalar(0.0021);
    // Hahn hinten oben (fährt beim Schuss kurz zurück)
    const hamP = new THREE.Group(); hamP.position.set(0, top - 0.014, 0.034); g.add(hamP);     // Drehpunkt des Hahns
    const hamG = new THREE.Group(); hamG.position.set(0, -(top - 0.014), -0.034); hamP.add(hamG); tgt = hamG;
    const ham = box(metal, -0.04, -0.028, top - 0.016, top + 0.004, 0.008); ham.rotation.x = -0.35;
    box(dark, -0.048, -0.036, top - 0.002, top + 0.008, 0.01);                                  // geriffelter Hahnsporn
    for (let i = 0; i < 3; i++) box(metal, -0.047 + i * 0.004, -0.0455 + i * 0.004, top + 0.008, top + 0.0095, 0.0105);   // Rillen auf dem Sporn
    tgt = g; anim.ham = hamP;
    tube(metal, -0.03, -0.024, cy + 0.012, 0.0045);                                             // Schlagbolzen-Buchse
    pin(-0.03, top - 0.014, W * 1.05);                                                          // Hahnstift
    cock = { g: hamG, at: new THREE.Vector3(0, top + 0.01, 0.045), travel: 0.008 };
    // runder Griff und runder Abzugsbügel
    side('rgrip', gripM, [[-0.036, t + 0.004], [0.012, t], [0.016, t - 0.03], [0.009, t - 0.07], [0.004, t - 0.094], [-0.018, t - 0.1], [-0.04, t - 0.09], [-0.049, t - 0.06], [-0.045, t - 0.03], [-0.04, t - 0.008]], W * 0.95);
    side('rguard', white, [[0.012, t], [0.07, t], [0.064, t - 0.022], [0.048, t - 0.034], [0.026, t - 0.032], [0.012, t - 0.02]], W * 0.38,
      [[[0.02, t - 0.004], [0.062, t - 0.004], [0.052, t - 0.024], [0.03, t - 0.026], [0.02, t - 0.018]]]);
    const tr = box(metal, 0.034, 0.04, t - 0.024, t - 0.002, W * 0.22); tr.rotation.x = 0.35; anim.trig = tr;
    box(dark, -0.006, 0.004, 0.002, 0.012, 0.004, -W * 0.5);                                    // Trommel-Entriegelung links
    gills(3, 0.095, 0.022, cy + 0.0, 0.016, W * 0.3);                                           // Kiemen seitlich am Unterlauf
    engrave('.44 HYDRO MAGNUM', 0.16, L - 0.02, cy + 0.017, 0.007, -P.br * 1.5 - 0.001);    // Gravur am Lauf links
    pin(-0.02, cy + 0.02, W); pin(0.075, t + 0.01, W);
    sightAt = [0, top + 0.006]; rear = 0.05;
    muzzleAt = [0, cy + 0.012, -(L + 0.005)]; gripTop = t; gripW = W;
  } else if (P.kind === 'pistol') {
    const { L, H, W } = P;
    // Schlitten (oben, weiß): eine eigene Gruppe, damit er beim Schuss und beim Durchladen nach hinten fahren kann
    const slideG = new THREE.Group(); g.add(slideG); tgt = slideG;
    side('slide', white, [[-0.03, 0], [L - 0.03, 0], [L - 0.03, H * 0.75], [L - 0.04, H], [-0.025, H], [-0.03, H * 0.85]], W);
    tgt = g;
    // Rahmen (unten)
    side('frame', white, [[-0.022, -0.014], [L - 0.04, -0.014], [L - 0.04, 0], [-0.022, 0]], W * 0.88);
    // Zubehörschiene unter dem Lauf (Picatinny): Leiste mit Querschlitzen, dazu die "Staubschutz"-Nase vorne am Rahmen
    box(white, L * 0.42, L - 0.04, -0.024, -0.012, W * 0.72);
    for (let i = 0; i < 3; i++) { const u = L * 0.48 + i * 0.016; box(dark, u, u + 0.006, -0.0255, -0.02, W * 0.74); }
    tgt = slideG;
    for (let i = 0; i < 6; i++) box(dark, -0.024 + i * 0.006, -0.021 + i * 0.006, H * 0.15, H * 0.9, W + 0.002);   // Griffrillen am Schlitten
    tgt = g;
    // Lauf: eine eigene Gruppe mit Drehpunkt vorne – beim Zurückfahren des Schlittens senkt sich hinten das Patronenlager (wie bei echten Pistolen)
    const barrelG = new THREE.Group(); barrelG.position.set(0, H * 0.5, -(L - 0.035)); g.add(barrelG);
    const bIn = new THREE.Group(); bIn.position.set(0, -H * 0.5, L - 0.035); barrelG.add(bIn); tgt = bIn;
    tube(metal, L - 0.04, L - 0.029, H * 0.5, P.br * 1.15);                               // Laufende, bündig mit dem Schlitten
    tube(dark, L - 0.0295, L - 0.0285, H * 0.5, P.br * 0.75);                           // Laufbohrung (dunkel)
    box(metal, 0.034, 0.071, H * 0.6, H + 0.0014, W * 0.46, W * 0.1);                   // Laufhaube (sieht man oben im Auswurffenster)
    box(brassM, 0.03, 0.034, H * 0.72, H * 0.86, W * 0.2, W * 0.1);                     // Patronenboden im Lager
    tgt = g; anim.barrel = barrelG; anim.barrelZ = -(L - 0.035);
    // Führungsstange der Schließfeder vorne unter dem Lauf, Auszieher und Ladeanzeige
    tube(metal, L - 0.042, L - 0.03, H * 0.14, 0.0035);
    tgt = slideG;                                                                         // alles Weitere sitzt auf dem Schlitten
    box(dark, -0.026, -0.02, H, H + 0.007, 0.008, -0.007); box(dark, -0.026, -0.02, H, H + 0.007, 0.008, 0.007);   // Kimme
    box(blue, L - 0.05, L - 0.045, H, H + 0.007, 0.004);                                  // Korn (blau leuchtend)
    box(glass, 0.02, 0.09, H - 0.003, H + 0.001, W * 0.5);                                // Fenster oben
    chargeBar(0.015, 0.075, H * 0.25, 0.008, W / 2 + 0.002);
    gills(3, 0.085, 0.024, H * 0.5, H * 0.75, W / 2 + 0.002);
    // Auswurffenster rechts oben: dunkle Öffnung, darin sieht man das Laufende (Stahl)
    box(dark, 0.03, 0.075, H - 0.002, H + 0.001, W * 0.62, W * 0.12);
    box(dark, 0.03, 0.075, H * 0.55, H, 0.002, W / 2 + 0.0005);                          // Fenster reicht rechts nach unten
    box(metal, 0.022, 0.034, H * 0.62, H * 0.78, 0.003, W / 2 + 0.0012);                 // Auszieher (Kralle, zieht die Hülse raus)
    box(metal, -0.031, -0.029, H * 0.25, H * 0.8, W * 0.6);                              // hintere Abdeckplatte des Schlittens
    for (let i = 0; i < 5; i++) box(dark, 0.08 + i * 0.008, 0.084 + i * 0.008, H - 0.0005, H + 0.0012, W * 0.3);   // Entlastungsschnitte oben
    engrave('UNDERNITE  P9-H', 0.005, 0.07, H * 0.3, 0.0075, -W / 2 - 0.0012);   // Gravur links auf dem Schlitten
    engrave('9 mm HYDRO', 0.0, 0.03, H * 0.3, 0.0065, W / 2 + 0.0012);         // Gravur rechts
    for (let i = 0; i < 4; i++) box(dark, L - 0.075 + i * 0.006, L - 0.072 + i * 0.006, H * 0.2, H * 0.85, W + 0.002);   // vordere Griffrillen
    // Leuchtvisier wie bei echten Pistolen (Tritium): zwei grüne Punkte hinten auf der Kimme, einer vorne auf dem Korn
    const dotM = new THREE.MeshStandardMaterial({ color: SIGHT_GLOW, emissive: SIGHT_GLOW, emissiveIntensity: 2.2 });
    for (const x of [-0.007, 0.007]) add(slideG, KNUCKLE, dotM, x, H + 0.005, 0.0235).scale.setScalar(0.0019);   // Punkte auf der Kimme
    add(slideG, KNUCKLE, dotM, 0, H + 0.006, -(L - 0.05) - 0.0028).scale.setScalar(0.0021);                        // Punkt auf dem Korn
    tgt = g;
    cock = { g: slideG, at: new THREE.Vector3(0, H + 0.012, 0.012), travel: 0.032 };   // hinten oben an den Griffrillen anfassen
    sightAt = [0, H + 0.005];
    // Griff wie bei einer echten Polymer-Pistole: oben hinten der "Biberschwanz" (schützt die Hand vor dem Schlitten),
    // hinten ein geschwungener Rücken, vorne Fingermulden, unten ein ausgestellter Magazinschacht
    {
      const t = -0.014;
      side('pgrip', gripM, [[-0.04, t + 0.004], [-0.031, t - 0.004], [-0.028, t - 0.03], [-0.031, t - 0.065], [-0.036, t - 0.098], [-0.04, t - 0.104],
        [0.014, t - 0.104], [0.013, t - 0.095], [0.016, t - 0.08], [0.013, t - 0.07], [0.018, t - 0.058], [0.015, t - 0.048], [0.021, t - 0.037], [0.026, t - 0.018], [0.03, t]], W * 0.92);
      box(white, -0.041, 0.015, t - 0.108, t - 0.1, W * 0.98);                              // Magazinboden (unten am Griff)
      // Abzugsbügel: vorne eckig (zum Abstützen des Fingers), mit Loch
      side('pguard', white, [[0.026, t], [0.078, t], [0.08, t - 0.004], [0.076, t - 0.032], [0.07, t - 0.036], [0.024, t - 0.034]], W * 0.38,
        [[[0.034, t - 0.005], [0.072, t - 0.005], [0.069, t - 0.029], [0.034, t - 0.029]]]);
      const tr = box(metal, 0.044, 0.05, t - 0.026, t - 0.002, W * 0.22); tr.rotation.x = 0.3; anim.trig = tr;   // Abzug
      box(metal, 0.044, 0.046, t - 0.018, t - 0.006, W * 0.08);                                // Sicherungszunge im Abzug
      // Bedienteile links: Magazinknopf, Schlittenfanghebel, Zerlegehebel
      box(dark, 0.022, 0.03, t - 0.012, t - 0.002, 0.004, -W * 0.47);
      box(metal, -0.005, 0.03, -0.006, -0.002, 0.004, -W * 0.48);
      box(metal, 0.04, 0.05, -0.008, -0.003, 0.004, -W * 0.46);
      pin(0.012, t - 0.004, W * 0.92); pin(0.062, t + 0.008, W * 0.9); pin(-0.018, t - 0.012, W * 0.92);   // Stifte im Rahmen
      engrave('Nr. 04172', 0.075, 0.11, -0.019, 0.005, W * 0.37);   // Seriennummer vorne am Rahmen
    }
    if (!P.drum) seatMag('pistol', 1, 0, -0.016, -0.014, -0.207);   // schräg wie der Griff (der Revolver hat stattdessen eine Trommel)
    rear = 0.035; anim.slide = slideG; anim.shellAt = [W * 0.3, H + 0.004, -0.05]; anim.shellSize = [0.0045, 0.0045, 0.019];
    muzzleAt = [0, H * 0.5, -(L - 0.015)]; gripTop = -0.014; gripW = W;
  } else if (P.kind === 'rifle') {
    const { L, H, W } = P, back = L * 0.35, front = L * 0.65;
    // Gehäuse
    side('recv', white, [[-back, -H / 2], [front, -H / 2], [front, H * 0.3], [front - H * 0.4, H / 2], [-back + H * 0.2, H / 2], [-back, H * 0.3]], W);
    // Schiene oben mit Zähnen
    box(metal, -back * 0.7, front * 0.9, H / 2, H / 2 + 0.006, W * 0.45);
    for (let u = -back * 0.65; u < front * 0.85; u += 0.016) box(metal, u, u + 0.008, H / 2 + 0.006, H / 2 + 0.01, W * 0.5);
    // Handschutz mit Lüftungsschlitzen
    const hg = P.barrel * 0.55;
    side('hand', white, [[front - 0.005, -H * 0.42], [front + hg, -H * 0.32], [front + hg, H * 0.3], [front - 0.005, H * 0.38]], W * 0.85);
    // M-LOK-Schlitze: zwei Reihen längliche Löcher an den Seiten, unten eine Reihe
    const nS = Math.max(3, Math.round(hg / 0.03));
    for (let i = 0; i < nS; i++) { const u = front + hg * (0.08 + i * 0.86 / nS);
      for (const v of [H * 0.12, -H * 0.16]) box(dark, u, u + hg * 0.5 / nS, v - H * 0.06, v + H * 0.06, W * 0.87);
      box(dark, u, u + hg * 0.5 / nS, -H * 0.44, -H * 0.36, W * 0.3); }
    box(metal, front, front + hg - 0.004, H * 0.3, H * 0.3 + 0.006, W * 0.42);                    // Schiene oben auf dem Handschutz
    for (let u = front + 0.004; u < front + hg - 0.01; u += 0.016) box(metal, u, u + 0.008, H * 0.3 + 0.006, H * 0.3 + 0.01, W * 0.48);
    // Lauf und Mündung
    const bv = H * 0.05, tip = front + P.barrel;
    tube(metal, front + hg - 0.01, tip, bv, P.br);
    box(metal, front + hg + 0.004, front + hg + 0.022, bv - P.br * 1.4, bv + P.br * 1.6, P.br * 2.6);   // Gasblock
    // Mündungsbremse: Klotz mit seitlichen Öffnungen (dort strömt das Wasser zur Seite aus)
    box(metal, tip, tip + 0.042, bv - P.br * 1.5, bv + P.br * 1.5, P.br * 3.0);
    for (let i = 0; i < 3; i++) box(dark, tip + 0.006 + i * 0.012, tip + 0.012 + i * 0.012, bv - P.br * 1.1, bv + P.br * 1.1, P.br * 3.08);
    tube(dark, tip + 0.0415, tip + 0.0425, bv, P.br * 0.9);
    // Kimme und Korn, mit grünen Leuchtpunkten
    box(dark, -back * 0.5, -back * 0.5 + 0.01, H / 2 + 0.01, H / 2 + 0.022, W * 0.4);
    box(blue, front + hg - 0.012, front + hg - 0.006, H * 0.3, H * 0.3 + 0.03, 0.004);
    const dotR = new THREE.MeshStandardMaterial({ color: SIGHT_GLOW, emissive: SIGHT_GLOW, emissiveIntensity: 2.2 });
    for (const x of [-W * 0.12, W * 0.12]) add(g, KNUCKLE, dotR, x, H / 2 + 0.019, back * 0.5 - 0.005).scale.setScalar(0.0022);
    add(g, KNUCKLE, dotR, 0, H * 0.3 + 0.03, -(front + hg - 0.009)).scale.setScalar(0.0024);
    // Zielfernrohr
    if (P.scope) {
      const sv = H / 2 + 0.03;
      // Zielfernrohr wie ein echtes: Mittelrohr, vorne dickes Objektiv (Glas), hinten Okular, oben und rechts Verstelltürme, zwei Ringe
      const s0 = -back * 0.35, s1 = front * 0.62, sr = 0.013;
      tube(dark, s0, s1, sv, sr);
      tube(dark, s1, s1 + 0.018, sv, sr * 1.25); tube(dark, s1 + 0.018, s1 + 0.045, sv, sr * 1.65);   // Übergang + Objektiv
      tube(glass, s1 + 0.0445, s1 + 0.0455, sv, sr * 1.45);
      tube(dark, s0 - 0.03, s0, sv, sr * 1.35); tube(glass, s0 - 0.0305, s0 - 0.0295, sv, sr * 1.1);   // Okular
      const tu = (s0 + s1) / 2;
      const tt = part(GUN_CYL_Y, metal, 0, sv + sr + 0.006, -tu); tt.scale.set(0.009, 0.014, 0.009);             // Turm oben (Höhe)
      const tsd = part(GUN_CYL_Y, metal, sr + 0.006, sv, -tu); tsd.scale.set(0.009, 0.014, 0.009); tsd.rotation.z = Math.PI / 2;   // Turm rechts (Seite)
      for (const u of [s0 + 0.02, s1 - 0.025]) { box(metal, u, u + 0.012, H / 2 + 0.006, sv - sr * 0.4, W * 0.5); const rr = add(g, GEO.torus, metal, 0, sv, -(u + 0.006)); rr.scale.set(sr * 1.15, sr * 1.15, sr * 1.6); }
    }
    // Pump-Griff (Splitterwerfer)
    if (P.pump) {
      tube(metal, front + hg - 0.02, front + hg + 0.13, -H * 0.4, P.br * 0.7);              // Röhrenmagazin unter dem Lauf (bleibt stehen)
      const pumpG = new THREE.Group(); g.add(pumpG); tgt = pumpG;                            // Pumpe: wird nach jedem Schuss zurück- und vorgerissen
      tube(metal, front + hg, front + hg + 0.1, -H * 0.4, P.br * 1.2);
      for (let i = 0; i < 6; i++) tube(dark, front + hg + 0.01 + i * 0.015, front + hg + 0.017 + i * 0.015, -H * 0.4, P.br * 1.3);
      for (const sd of [-1, 1]) box(metal, front * 0.5, front + hg, -H * 0.38, -H * 0.33, 0.002, sd * (W / 2 + 0.002));   // Pumpstangen
      tgt = g; anim.pump = pumpG;
    }
    // Druckpatrone (Magazin): durchsichtig, innen leuchtet das Wasser, unten nach vorne geneigt
    const mu = Math.max(0.13, front * 0.5);                                                     // vor dem Abzugsbügel
    box(metal, mu - 0.02, mu + 0.02, -H / 2 - 0.008, -H / 2 + 0.002, W * 0.7);                  // Magazinschacht
    if (!P.coil) seatMag('rifle', P.magK || 1, 0, -H / 2 + 0.004, -mu, 0.25);   // das Magnet-Gewehr hat stattdessen vorne einen Magneten
    // Schaft
    if (fp) rear = back;
    else if (P.stock === 'full') {
      // moderner verstellbarer Schaft: Rohr (Puffer) aus dem Gehäuse, darauf der Schaft mit Wangenauflage und Gummi-Schulterpolster
      tube(metal, -back - 0.13, -back, H * 0.1, H * 0.22);
      side('stock', white, [[-back - 0.08, -H * 0.2], [-back - 0.08, H * 0.4], [-back - 0.21, H * 0.42], [-back - 0.22, H * 0.3], [-back - 0.22, -H / 2 - 0.05], [-back - 0.19, -H / 2 - 0.05], [-back - 0.1, -H * 0.3]], W * 0.75,
        [[[-back - 0.12, -H * 0.15], [-back - 0.17, -H * 0.15], [-back - 0.17, -H / 2 - 0.025], [-back - 0.14, -H * 0.35]]]);
      box(gripM, -back - 0.232, -back - 0.218, -H / 2 - 0.052, H * 0.42, W * 0.82);       // Gummi-Schulterpolster
      box(white, -back - 0.2, -back - 0.1, H * 0.4, H * 0.5, W * 0.6);                   // Wangenauflage
      rear = back + 0.24;
    } else {
      side('stock', white, [[-back, -H / 2], [-back, H * 0.3], [-back - 0.09, H * 0.2], [-back - 0.1, -H / 2 - 0.02], [-back - 0.04, -H / 2]], W * 0.7);
      rear = back + 0.1;
    }
    box(dark, front * 0.15, front * 0.45, H * 0.05, H * 0.35, 0.004, W / 2 + 0.001);       // Auswurffenster rechts
    // Verschluss: blanker Verschlussträger mit rundem Verschlusskopf – fährt bei jedem Schuss zurück und wieder vor
    { const p0 = front * 0.15, p1 = front * 0.45, pv0 = H * 0.05, pv1 = H * 0.35, px = W / 2 + 0.0035, pm = (pv0 + pv1) / 2;
      const carrier = box(metal, p0 + 0.002, p1 - 0.002, pv0 + 0.004, pv1 - 0.004, 0.002, px);
      const boltG = new THREE.Group(); g.add(boltG); tgt = boltG;
      const head = part(GUN_CYL, metal, px + 0.0006, pm, -(p1 - 0.008)); head.scale.set((pv1 - pv0) * 0.32, (pv1 - pv0) * 0.32, 0.01);
      box(dark, p1 - 0.014, p1 - 0.004, pm + (pv1 - pv0) * 0.18, pm + (pv1 - pv0) * 0.28, 0.0015, px + 0.0018);   // Auszieher-Kralle
      part(GUN_CYL, brassM, px + 0.0004, pm, -(p1 - 0.0025)).scale.set((pv1 - pv0) * 0.22, (pv1 - pv0) * 0.22, 0.003);   // Patronenboden
      tgt = g;
      anim.bolt = { carrier, head: boltG, a: p0 + 0.002, b: p1 - 0.002, travel: (p1 - p0) * 0.7 };
      // Staubschutzklappe: unten am Fenster angeschlagen, springt beim ersten Schuss auf und bleibt offen
      const cov = new THREE.Group(); cov.position.set(px + 0.0025, pv0, -(p0 + p1) / 2); g.add(cov); tgt = cov;
      box(blue, -(p1 - p0) / 2 - 0.002, (p1 - p0) / 2 + 0.002, 0, pv1 - pv0 + 0.003, 0.0015, 0);
      box(metal, -(p1 - p0) / 2, (p1 - p0) / 2, -0.001, 0.001, 0.003, 0);                  // Scharnierstift
      tgt = g; anim.cover = cov;
      // Hülsenabweiser hinter dem Fenster, Schließhilfe (Knopf schräg hinten rechts)
      box(white, p0 - 0.016, p0 - 0.002, pv1 - 0.004, pv1 + 0.01, 0.01, W / 2 + 0.004);
      const fa = part(GUN_CYL, metal, W / 2 + 0.007, pv1 + 0.002, -(p0 - 0.03)); fa.scale.set(0.006, 0.006, 0.03); fa.rotation.y = -0.25;
      part(GUN_CYL, dark, W / 2 + 0.0085, pv1 + 0.002, -(p0 - 0.047)).scale.set(0.0065, 0.0065, 0.004);
      anim.shellAt = [px + 0.004, pm, -(p1 - 0.01)]; anim.shellSize = [0.0042, 0.0042, 0.024]; }
    // links: Verschlussfanghebel und Sicherungshebel (mit S / F graviert), rechts: Magazinknopf
    box(metal, front * 0.06, front * 0.13, -H * 0.3, -H * 0.05, 0.003, -W / 2 - 0.0015);
    { const sel = box(metal, -0.03, 0.0, -H * 0.12, -H * 0.04, 0.003, -W / 2 - 0.002); sel.rotation.x = 0.4;
      const hub = part(GUN_CYL, metal, -W / 2 - 0.002, -H * 0.08, 0.015); hub.scale.set(0.007, 0.007, 0.003); hub.rotation.y = Math.PI / 2; }
    engrave('S   F', -0.045, 0.01, -H * 0.3, 0.007, -W / 2 - 0.0012);
    { const mb = part(GUN_CYL, dark, W / 2 + 0.002, -H * 0.28, -(mu + 0.03)); mb.scale.set(0.006, 0.006, 0.003); mb.rotation.y = Math.PI / 2; }
    { const sw = add(g, GEO.torus, metal, 0, -H * 0.42 - 0.01, -(front + hg * 0.85)); sw.scale.set(0.008, 0.008, 0.008); sw.rotation.y = Math.PI / 2; }   // Riemenöse
    for (const [u, v] of [[-back * 0.7, -H * 0.25], [-back * 0.2, -H * 0.25], [front * 0.75, -H * 0.25], [front * 0.75, H * 0.3]]) {
      for (const sd of [-1, 1]) { const sc = part(GUN_CYL, metal, sd * (W / 2 + 0.001), v, -u); sc.scale.set(0.004, 0.004, 0.003); sc.rotation.y = Math.PI / 2; }   // Schrauben
    }
    ring(-back + 0.01, 0, H * 0.45);
    // Spannhebel: läuft in einer Schiene an der linken Seite
    box(dark, front * 0.05, front * 0.55, H * 0.2, H * 0.36, 0.004, -W / 2 - 0.001);              // Schiene
    const chG = new THREE.Group(); g.add(chG); tgt = chG;
    box(metal, front * 0.45, front * 0.55, H * 0.17, H * 0.39, 0.014, -W / 2 - 0.006);
    const knob = part(GUN_CYL, blue, -W / 2 - 0.02, H * 0.28, -front * 0.5); knob.scale.set(0.008, 0.008, 0.02); knob.rotation.y = Math.PI / 2;
    tgt = g;
    cock = { g: chG, at: new THREE.Vector3(-W / 2 - 0.03, H * 0.28, -front * 0.5), travel: front * 0.4 };
    sightAt = [0, P.scope ? H / 2 + 0.03 : H / 2 + 0.016];
    chargeBar(-back * 0.85, -back * 0.15, H * 0.15, 0.012, W / 2 + 0.002);
    engrave('UN-17  KAL. WASSER  Nr. 0' + (311 + widx * 47), -back * 0.85, -back * 0.05, H * 0.12, 0.009, -W / 2 - 0.0012);   // Gravur links am Gehäuse
    for (const [u, v] of [[-back * 0.5, -H * 0.38], [front * 0.25, -H * 0.38], [front * 0.6, H * 0.05]]) pin(u, v, W);
    gills(P.gills, front * 0.5, 0.024, H * 0.05, H * 0.7, W / 2 + 0.002);   // vor dem Auswurffenster, damit man den Verschluss sieht
    grip(-H / 2, W);
    muzzleAt = [0, bv, -(tip + 0.045)]; gripTop = -H / 2; gripW = W; support = [0, -H * 0.42, -(front + hg * 0.5)];
  } else if (P.kind === 'pole') {
    // Stabwaffe: langer Schaft, die rechte Hand hält ihn hinten (Ursprung), die linke weiter vorne
    const { L, R } = P, back = 0.28, front = L - back, tipU = front;
    tube(metal, -back, front, 0, R);                                                         // Schaft
    for (let i = 0; i < 9; i++) tube(gripM, -0.06 + i * 0.016, -0.06 + i * 0.016 + 0.012, 0, R * 1.18);   // Griffwicklung hinten
    for (let i = 0; i < 9; i++) tube(gripM, 0.32 + i * 0.016, 0.32 + i * 0.016 + 0.012, 0, R * 1.18);    // Griffwicklung vorne
    ring(-back, 0, R * 1.3); ring(front - 0.02, 0, R * 1.25);                                  // blaue Ringe an den Enden
    if (P.head === 'trident') {   // Dreizack: Querstück und drei Zinken mit Widerhaken
      box(metal, front, front + 0.03, -0.016, 0.016, 0.19);
      for (const x of [-0.08, 0, 0.08]) {
        const len = x ? 0.28 : 0.34, z = part(GUN_CYL, metal, x, 0, -(front + 0.025 + len / 2)); z.scale.set(0.01, 0.01, len);
        const tip = part(new THREE.ConeGeometry(1, 1, 12).rotateX(-Math.PI / 2), blue, x, 0, -(front + 0.025 + len + 0.025)); tip.scale.set(0.016, 0.016, 0.07);
        const barb = part(GEO.box, metal, x + (x ? Math.sign(x) * 0.008 : 0.008), 0, -(front + 0.025 + len - 0.03)); barb.scale.set(0.004, 0.005, 0.03); barb.rotation.y = x ? Math.sign(x) * 0.5 : 0.5;
      }
      muzzleAt = [0, 0, -(front + 0.42)];
    } else if (P.head === 'spear') {   // Elektro-Speer: Spulen, dann eine flache Klinge mit leuchtender Kante
      const coilM = new THREE.MeshStandardMaterial({ color: 0xb87333, roughness: 0.35, metalness: 0.9 });   // Kupferspulen
      for (let i = 0; i < 5; i++) { const c = add(g, GEO.torus, coilM, 0, 0, -(front - 0.12 + i * 0.022)); c.scale.setScalar(R * 1.6); }
      const blade = part(KNUCKLE, metal, 0, 0, -(front + 0.17)); blade.scale.set(0.055, 0.011, 0.21);
      const edge = part(KNUCKLE, coilM, 0, 0, -(front + 0.17)); edge.scale.set(0.058, 0.004, 0.214);
      muzzleAt = [0, 0, -(front + 0.38)];
    } else {   // Kampfstab: schwere Endstücke mit Gummi-Kappe
      for (const u of [-back - 0.04, front]) { tube(metal, u, u + 0.06, 0, R * 1.5); tube(dark, u + (u < 0 ? -0.02 : 0.06), u + (u < 0 ? 0 : 0.08), 0, R * 1.35); }
      muzzleAt = [0, 0, -(front + 0.08)];
    }
    rear = 0.12; gripTop = 0.034; gripW = 0.03; support = [0, -0.035, -0.36];
  } else {
    // Werferrohr
    const { L, R } = P, u0 = -L * 0.3, u1 = L * 0.7;
    // Rohr hinten offen: außen weiß, innen ein dunkler Ladeschacht, in den die Patrone geschoben wird
    const pipe = (mat, a, b, r) => { const m = part(GUN_TUBE, mat, 0, 0, -(a + b) / 2); m.scale.set(r, r, b - a); return m; };
    pipe(white, u0, u1, R);
    const darkIn = dark.clone(); darkIn.side = THREE.DoubleSide;                             // von innen sichtbar
    pipe(darkIn, u0 - 0.03, u0 + 0.22, R * 0.66);                                           // Ladeschacht (innen dunkel)
    tube(dark, u0 + 0.21, u0 + 0.22, 0, R * 0.66);                                          // Boden des Schachts
    const rim = new THREE.Mesh(new THREE.RingGeometry(R * 0.66, R * 1.08, 32), metal);     // Rand hinten (Ring mit Loch)
    rim.position.z = -(u0 - 0.03); g.add(rim);
    const rimIn = new THREE.Mesh(new THREE.RingGeometry(R * 0.66, R, 32), white); rimIn.position.z = -u0; rimIn.rotation.y = Math.PI; g.add(rimIn);
    tube(metal, u1, u1 + 0.03, 0, R * 1.12);                                                // vorderer Rand
    tube(dark, u1 + 0.02, u1 + 0.031, 0, R * 0.85);                                         // dunkle Öffnung
    pipe(metal, u0 - 0.03, u0, R * 1.08);                                                   // hinterer Ring (außen)
    seatMag('tube', 1, 0, 0, -(u0 + 0.12), -Math.PI / 2);                                   // Patrone wird von hinten eingeschoben
    for (const u of [u0 + 0.04, L * 0.15, u1 - 0.05]) pipe(blue, u - 0.004, u + 0.004, R * 1.03);   // blaue Bänder (echte Ringe, innen hohl)
    if (P.dish) {                                                                           // Schallkanone: Trichter vorne
      const cone = part(new THREE.CylinderGeometry(R * 1.6, R * 1.05, 0.08, 20, 1, true).rotateX(Math.PI / 2), metal, 0, 0, -(u1 + 0.07)); cone.material.side = THREE.DoubleSide;
      const ringT = add(g, GEO.torus, blue, 0, 0, -(u1 + 0.11)); ringT.scale.setScalar(R * 1.6);
    }
    // Drucktanks an der Seite (leuchten beim Komprimieren)
    for (const s of [-1, 1]) {
      const t1 = part(GEO.zcyl, metal, s * R * 0.95, -R * 0.45, -L * 0.25); t1.scale.set(0.022, 0.022, L * 0.45);   // Druckluftflasche aus Stahl
      const t2 = part(GEO.zcyl, fill, s * R * 0.95, -R * 0.45, -L * 0.25); t2.scale.set(0.014, 0.014, L * 0.42);
      chargeBars.push({ tank: t2 });
    }
    // Zielvisier oben links: Gehäuse auf einer Halterung, vorne und hinten Glas
    box(metal, L * 0.06, L * 0.12, R * 0.85, R + 0.012, 0.012, -R * 0.45);                       // Halterung
    box(dark, L * 0.03, L * 0.2, R + 0.01, R + 0.042, 0.032, -R * 0.45);                         // Gehäuse
    for (const u of [L * 0.03 - 0.001, L * 0.2 + 0.001]) { const ln = box(glass, u, u + 0.002, R + 0.016, R + 0.036, 0.024, -R * 0.45); }
    // Tragegriff oben (Bogen) und Gummi-Stoßschutz vorne und hinten
    const ch = add(g, new THREE.TorusGeometry(1, 0.12, 8, 20, Math.PI), metal, 0, R, -L * 0.32); ch.scale.set(0.06, 0.05, 0.06); ch.rotation.y = Math.PI / 2;
    pipe(gripM, u1 - 0.035, u1 + 0.005, R * 1.1);
    pipe(gripM, u0 + 0.02, u0 + 0.055, R * 1.1);
    // hinten ein ausgestellter Trichter (Düse), wie bei echten rückstoßfreien Werfern
    const bell = part(new THREE.CylinderGeometry(R * 1.0, R * 1.35, 0.06, 32, 1, true).rotateX(-Math.PI / 2), metal, 0, 0, -(u0 - 0.06)); bell.material = metal.clone(); bell.material.side = THREE.DoubleSide;
    // Schulterstütze unter dem Rohr
    box(gripM, -L * 0.05, L * 0.12, -R - 0.03, -R + 0.005, 0.05);
    // Vordergriff: richtiger senkrechter Griff mit Noppen
    { const fu = L * 0.4, ft = -R * 0.95;
      side('fgrip', gripM, [[fu - 0.022, ft], [fu + 0.022, ft], [fu + 0.018, ft - 0.09], [fu + 0.012, ft - 0.1], [fu - 0.016, ft - 0.1], [fu - 0.02, ft - 0.09]], 0.034);
      box(metal, fu - 0.026, fu + 0.026, ft - 0.004, ft + 0.006, 0.04); }
    gills(P.gills, -L * 0.15, 0.03, R * 0.1, R * 0.9, R * 0.98);
    engrave('ACHTUNG  DRUCK  —  WERFER M3', L * 0.22, L * 0.6, R * 0.5, 0.016, -R - 0.002);
    const chG = new THREE.Group(); g.add(chG); tgt = chG;
    box(metal, L * 0.0, L * 0.06, R * 0.1, R * 0.45, 0.02, -R - 0.004);
    const knob = part(GUN_CYL, blue, -R - 0.025, R * 0.3, -L * 0.03); knob.scale.set(0.011, 0.011, 0.03); knob.rotation.y = Math.PI / 2;
    tgt = g;
    cock = { g: chG, at: new THREE.Vector3(-R - 0.04, R * 0.3, -L * 0.03), travel: 0.07 };
    sightAt = [-R * 0.4, R + 0.03];
    grip(-R * 0.85, 0.04);
    rear = L * 0.3 + 0.03;
    muzzleAt = [0, 0, -(u1 + (P.dish ? 0.12 : 0.035))]; gripTop = -R * 0.85; gripW = 0.04; support = [0, -R - 0.06, -L * 0.4];
  }

  // Kiemen öffnen: die Lamellen fächern nacheinander auf (zuerst die äußere, dann die nächste …)
  g.userData.setGills = (open) => {
    for (const f of flaps) {
      const o = Math.max(0, Math.min(1, open * 1.6 - f.k * 0.3));
      const e = o * o * (3 - 2 * o);                                  // weich beschleunigen und abbremsen
      f.hinge.rotation.y = f.s * e * (0.45 + f.k * 0.3);              // hinten klappt die Lamelle nach außen auf
    }
    gillIn.emissiveIntensity = 0.15 + open * 2.6;                      // dahinter leuchtet das einströmende Wasser
  };
  // Druckanzeige füllen
  g.userData.setCharge = (c) => {
    for (const b of chargeBars) {
      if (b.bar) { const l = Math.max(0.001, b.len * c); b.bar.scale.z = l; b.bar.position.z = -(b.u0 + l / 2); }
      if (b.tank) b.tank.material.emissiveIntensity = 0.3 + c * 2.2;
    }
    blue.emissiveIntensity = 1.3 + c * 1.4;
  };
  // ===== Schuss-Mechanik wie bei echten Waffen =====
  // Bei jedem Schuss: Pistole – Schlitten fährt zurück, der Lauf kippt hinten nach unten, eine Hülse fliegt rechts raus.
  // Gewehr – der Verschluss fährt im Auswurffenster zurück und wieder vor, die Staubschutzklappe springt auf.
  // Pump-Gewehr – nach dem Schuss wird die Pumpe zurück- und vorgerissen (erst dann fliegt die Hülse).
  // Revolver – der Hahn schlägt nach vorne, spannt sich wieder und die Trommel dreht eine Kammer weiter.
  const ease = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  const cyc = (t, a, b, c) => t < a ? 0 : t < b ? ease((t - a) / (b - a)) : t < c ? 1 - ease((t - b) / (c - b)) : 0;   // 0 → 1 (hinten) → 0
  const trigRest = anim.trig ? anim.trig.rotation.x : 0, shells = [];
  const eject = () => {
    if (!anim.shellAt) return;
    let s = shells.find(o => o.life <= 0);
    if (!s) { if (shells.length >= 4) s = shells[0]; else { const m = add(g, GUN_CYL, brassM); m.scale.set(...anim.shellSize); s = { m, v: [0, 0, 0] }; shells.push(s); } }
    s.life = 0.5; s.m.visible = true; s.m.position.set(...anim.shellAt); s.m.rotation.set(0, 0, 0);
    s.v[0] = 0.8 + Math.random() * 0.4; s.v[1] = 0.55 + Math.random() * 0.3; s.v[2] = 0.15 + Math.random() * 0.15; s.spin = 18 + Math.random() * 10;
  };
  g.userData.fireAnim = (kick, dt, reloading) => {
    if (kick >= 0.99 && anim.prev < 0.95 && !reloading) { anim.t = 0; anim.n++; anim.ejected = false; anim.coverOpen = true; } else anim.t += dt;
    anim.prev = kick;
    const t = anim.t;
    if (!reloading) {
      if (anim.slide && cock) anim.slide.position.z = cock.travel * cyc(t, 0, 0.028, 0.1);
      if (anim.bolt) {
        const k = anim.pump ? cyc(t, 0.12, 0.22, 0.34) : cyc(t, 0, 0.022, 0.085);
        anim.boltK = k;
      }
      if (anim.pump) anim.pump.position.z = 0.045 * cyc(t, 0.12, 0.22, 0.34);
      if (!anim.ejected && t >= (anim.pump ? 0.2 : 0.018)) { anim.ejected = true; eject(); }
      if (anim.trig) anim.trig.rotation.x = trigRest + 0.4 * (t < 0.1 ? 1 - ease(t / 0.1) : 0);   // Abzug gedrückt, dann springt er vor
    } else if (anim.bolt && cock) anim.boltK = cock.g.position.z / cock.travel;   // beim Durchladen zieht der Spannhebel den Verschluss mit
    // Pistolenlauf folgt dem Schlitten: erst ein Stück mit nach hinten, dann kippt er ab
    if (anim.barrel && anim.slide && cock) { const s = anim.slide.position.z / cock.travel;
      anim.barrel.position.z = anim.barrelZ + 0.004 * Math.min(1, s * 4); anim.barrel.rotation.x = 0.07 * ease((s - 0.2) / 0.5); }
    if (anim.bolt) { const B = anim.bolt, off = B.travel * (anim.boltK || 0), len = B.b - B.a - off;
      B.carrier.scale.z = Math.max(0.001, len); B.carrier.position.z = -(B.a + len / 2); B.head.position.z = off; }
    if (anim.cover) { anim.coverA += ((anim.coverOpen ? 1 : 0) - anim.coverA) * Math.min(1, dt * 35); anim.cover.rotation.z = -2.5 * anim.coverA; }
    if (anim.ham) anim.ham.rotation.x = t < 0.12 ? -0.08 : -0.08 + 0.6 * ease((t - 0.12) / 0.16);   // Hahn: schlägt zu, dann wieder gespannt
    if (g.userData.revolver && !reloading && anim.n) g.userData.revolver.cyl.rotation.z = (anim.n - 1 + ease((t - 0.12) / 0.16)) * TAU / 6;   // Trommel dreht weiter
    for (const s of shells) {   // fliegende Hülsen: unter Wasser schnell gebremst, sinken langsam
      if (s.life <= 0) continue;
      s.life -= dt; const dr = Math.max(0, 1 - dt * 3);
      s.v[0] *= dr; s.v[1] = s.v[1] * dr - dt * 1.2; s.v[2] *= dr;
      s.m.position.x += s.v[0] * dt; s.m.position.y += s.v[1] * dt; s.m.position.z += s.v[2] * dt;
      s.m.rotation.x += s.spin * dt; s.m.rotation.y += s.spin * 0.6 * dt;
      if (s.life <= 0) s.m.visible = false;
    }
  };
  g.userData.rear = rear;   // wie weit die Waffe hinter der Hand weitergeht (für die Ego-Perspektive)
  const muzzle = new THREE.Object3D(); muzzle.position.set(...muzzleAt); g.add(muzzle);
  // fpShift: Werferrohre sitzen in der Ego-Perspektive weiter vorne und weiter rechts (sonst schaut man ins Rohr)
  const fpShift = P.kind === 'tube' ? [0.07, -0.035, -0.32] : P.kind === 'pole' ? [0.02, 0.02, 0.05] : [0, 0, 0];
  Object.assign(g.userData, { muzzle, gripTop, gripW, support, fpShift, mag, cock, sightAt, kind: P.kind });
  g.userData.setGills(0); g.userData.setCharge(1);
  // Besonderheiten der neuen Waffen
  const mzp = g.userData.muzzle.position;
  if (P.drum) {   // Revolver: Trommel mit 6 Kammern auf einem Schwenkarm (crane), der zum Nachladen nach links ausklappt
    const RCY = 0.018, RZ = -0.036;   // Trommelmitte (Höhe und wie weit vorne) – passt ins Fenster des Rahmens
    const crane = new THREE.Group(); crane.position.set(-0.02, RCY - 0.02, RZ); g.add(crane);
    add(crane, GEO.box, metal, 0.008, 0.008, 0).scale.set(0.006, 0.02, 0.05);                 // Schwenkarm
    const makeCyl = () => { const c = new THREE.Group();
      add(c, GUN_CYL, metal, 0, 0, 0).scale.set(0.024, 0.024, 0.05);
      for (let i = 0; i < 6; i++) { const a = (i + 0.5) / 6 * TAU, fl = add(c, GEO.box, dark, Math.cos(a) * 0.0235, Math.sin(a) * 0.0235, -0.004); fl.scale.set(0.006, 0.006, 0.032); fl.rotation.z = a; }   // eingefräste Rillen
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; add(c, GUN_CYL, magFill, Math.cos(a) * 0.014, Math.sin(a) * 0.014, 0.026).scale.set(0.005, 0.005, 0.003); }   // leuchtende Kammern (voll)
      return c; };
    const cyl = makeCyl(); cyl.position.set(0.02, 0.02, 0); crane.add(cyl);
    const loose = makeCyl(); loose.visible = false; g.add(loose);                              // die Trommel in der Hand beim Nachladen
    g.userData.revolver = { crane, cyl, loose, fill: magFill, seat: new THREE.Vector3(0, RCY, RZ) };
  }
  if (P.spear) {   // Harpune wie eine echte Druckluft-Harpune: der Pfeil liegt oben auf dem Lauf, vorne der Mündungskopf mit Wasserlöchern
    const sv = mzp.y + P.br * 2.6, sEnd = mzp.z - 0.07;
    const sh = add(g, GUN_CYL, metal, 0, sv, (sEnd - 0.05 + mzp.z + 0.5) / 2); sh.scale.set(0.0035, 0.0035, Math.abs(sEnd - (mzp.z + 0.5)));   // Pfeilschaft
    const tip = add(g, new THREE.ConeGeometry(1, 1, 3).rotateX(-Math.PI / 2), metal, 0, sv, sEnd - 0.02); tip.scale.set(0.007, 0.007, 0.04);  // dreikantige Spitze
    for (const sd of [-1, 1]) { const b = add(g, GEO.box, metal, sd * 0.004, sv, sEnd + 0.012); b.scale.set(0.002, 0.004, 0.02); b.rotation.y = sd * 0.5; }   // Widerhaken
    const head = add(g, GUN_CYL, blue, mzp.x, mzp.y, mzp.z + 0.02); head.scale.set(P.br * 2.4, P.br * 2.4, 0.03);              // Mündungskopf
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4, hl = add(g, GUN_CYL, dark, mzp.x + Math.cos(a) * P.br * 2.3, mzp.y + Math.sin(a) * P.br * 2.3, mzp.z + 0.02); hl.scale.set(0.003, 0.003, 0.032); }   // Wasserlöcher
  }
  if (P.spikes) {   // Stachel-MG: Kranz aus Stacheln um die Mündung und ein Kühlmantel
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, s = add(g, GEO.zcyl, metal, mzp.x + Math.cos(a) * 0.016, mzp.y + Math.sin(a) * 0.016, mzp.z + 0.01); s.scale.set(0.003, 0.003, 0.03); }
    for (let i = 0; i < 5; i++) add(g, GUN_CYL, dark, mzp.x, mzp.y, mzp.z + 0.05 + i * 0.022).scale.set(0.013, 0.013, 0.008);
  }
  if (P.net) {   // Netzwerfer: zusammengefaltetes Netz sichtbar in der Mündung
    const n = add(g, new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xd8ffe0, wireframe: true }), 0, 0, mzp.z + 0.05); n.scale.setScalar(P.R * 0.6);
  }
  if (P.coil) {   // Magnet-Gewehr: violett leuchtende Spulen um den Lauf, vorne sitzt der Magnet (= das Magazin)
    const coilM = new THREE.MeshStandardMaterial({ color: 0xb87333, roughness: 0.35, metalness: 0.9 });   // Kupferspulen
    for (let i = 0; i < 6; i++) add(g, GEO.torus, coilM, mzp.x, mzp.y, mzp.z + 0.06 + i * 0.03).scale.setScalar(0.02);
    seatMag('magnet', 1, mzp.x, mzp.y, mzp.z + 0.005, Math.PI / 2);   // zeigt nach vorne
    g.userData.mag = mag; g.userData.freshOnly = true;   // Nachladen: es gibt kein altes Magazin, nur einen neuen Magneten vom Rücken
    mzp.z -= 0.075;                                     // der Schuss kommt vorne aus dem Magneten
  }
  if (mods && mods.length) addGunMods(g, mods, metal, dark);
  return g;
}
// Aufsätze sichtbar an die Waffe bauen (Ego-Sicht). Positionen kommen aus der Waffe: Mündung, Visierlinie, Griff.
function addGunMods(g, mods, metal, dark) {
  const U = g.userData, mz = U.muzzle.position, top = U.sightAt[1], has = (k) => mods.includes(k);
  const len = -mz.z;   // so lang ist die Waffe vom Griff bis zur Mündung
  if (has('dot')) {   // Leuchtpunkt-Visier: kleines Gehäuse oben mit Glasfenster und grünem Punkt
    const v = add(g, RBOX, dark, 0, top + 0.016, -len * 0.35); v.scale.set(0.028, 0.03, 0.045);
    const lensM = new THREE.MeshStandardMaterial({ color: 0x88ccaa, transparent: true, opacity: 0.35, roughness: 0.05 });
    add(g, GEO.box, lensM, 0, top + 0.02, -len * 0.35 - 0.024).scale.set(0.02, 0.018, 0.002);
    add(g, GEO.sph, new THREE.MeshBasicMaterial({ color: SIGHT_GLOW }), 0, top + 0.02, -len * 0.35 - 0.026).scale.setScalar(0.0022);
  }
  if (has('scope')) {   // Zielfernrohr: Rohr mit Ringen oben
    const sv = top + 0.03;
    const t = add(g, GUN_CYL, metal, 0, sv, -len * 0.35); t.scale.set(0.015, 0.015, len * 0.55);
    for (const z of [-len * 0.15, -len * 0.55]) { const r = add(g, GUN_CYL, dark, 0, sv, z); r.scale.set(0.019, 0.019, 0.012); }
    add(g, GEO.box, dark, 0, top + 0.012, -len * 0.35).scale.set(0.008, 0.024, 0.02);
  }
  if (has('mag') || has('drum')) {   // größeres Magazin: unten länger bzw. eine runde Trommel
    if (U.mag) { if (has('drum')) { const d = add(U.mag.g, GUN_CYL, metal, 0, -0.07, 0); d.scale.set(0.035, 0.035, 0.03); d.rotation.y = Math.PI / 2; } else U.mag.g.scale.y = 1.4; }
  }
  if (has('comp') || has('choke')) {   // Mündungsaufsatz: Zylinder mit Schlitzen vor der Mündung
    const c = add(g, GUN_CYL, metal, mz.x, mz.y, mz.z - 0.02); c.scale.set(0.014, 0.014, 0.045);
    for (let i = 0; i < 3; i++) add(g, GEO.box, dark, mz.x, mz.y + 0.012, mz.z - 0.008 - i * 0.012).scale.set(0.02, 0.004, 0.005);
    U.muzzle.position.z -= 0.045;
  }
  if (has('boost')) {   // Druck-Verstärker: leuchtende Spulen um den Lauf
    for (let i = 0; i < 3; i++) { const r = add(g, GEO.torus, new THREE.MeshStandardMaterial({ color: 0x2fa8ff, emissive: 0x2fa8ff, emissiveIntensity: 1.4 }), mz.x, mz.y, mz.z + 0.02 + i * 0.016); r.scale.setScalar(0.016); }
  }
  if (has('laser')) {   // Laservisier unter dem Lauf, mit rotem Strahl nach vorne
    const y = mz.y - 0.03, z = mz.z * 0.55;
    const b = add(g, RBOX, dark, 0, y, z); b.scale.set(0.02, 0.018, 0.05);
    add(g, GEO.sph, new THREE.MeshBasicMaterial({ color: 0xff3030 }), 0, y, z - 0.026).scale.setScalar(0.004);
    const beam = add(g, GEO.box, new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }), 0, y, z - 0.026 - 15);
    beam.scale.set(0.0018, 0.0018, 30);
  }
}

// ---------- Arme und Hände in der Ego-Perspektive ----------
const Z_AXIS = new THREE.Vector3(0, 0, 1);
// gun = userData der Waffe (gripTop, gripW, support, rear). Die Arme werden an die Waffe gehängt und bewegen sich mit ihr.
// Finger als Kette: Glieder (Zylinder) mit runden Knöcheln (Kugeln) an jedem Gelenk; pts = Gelenkpunkte, r = Dicke
// taper < 1 (Finger): jedes Glied wird dünner, die Gelenke sind so dick wie der Finger an der Stelle.
// taper = 1 (Arme, Bündchen): überall gleich dick.
function chain(parent, mat, pts, r, taper = 1) {
  for (let i = 0; i < pts.length; i++) {
    const ri = r * Math.pow(taper, i), last = i === pts.length - 1;
    const k = new THREE.Mesh(KNUCKLE, mat); k.position.set(...pts[i]); k.scale.setScalar(ri * (taper < 1 ? (last ? 0.9 : 0.99) : 1)); parent.add(k);
    if (i > 0) {
      const rp = r * Math.pow(taper, i - 1), A = new THREE.Vector3(...pts[i - 1]), d = new THREE.Vector3(...pts[i]).sub(A), len = d.length();
      const m = new THREE.Mesh(taper < 1 ? FINGER_T : FINGER, mat); m.scale.set(rp, rp, len); m.position.copy(A).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(Z_AXIS, d.normalize()); parent.add(m);
    }
  }
}
const FINGER_SLIM = 0.9;   // Finger etwas schlanker (1 = alte Dicke)
const finger = (parent, mat, pts, r) => chain(parent, mat, pts, r * FINGER_SLIM, 0.86);
// gun = userData der Waffe (gripTop, gripW, support, rear). Die Arme hängen an der Waffe und bewegen sich mit ihr.
export function makeViewArms(suit, gun) {
  const g = new THREE.Group(), col = SUIT_COL[suit] || 0x1fd6b4;
  const sleeve = new THREE.MeshStandardMaterial({ color: 0x1c2126, emissive: 0x0c1014, emissiveIntensity: 0.7, roughness: 0.8, bumpMap: neoprene(), bumpScale: 1.2 });
  const glove = new THREE.MeshStandardMaterial({ color: 0x353d45, emissive: 0x141a20, emissiveIntensity: 0.65, roughness: 0.55, bumpMap: neoprene(), bumpScale: 0.8 });
  const acc = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.4, roughness: 0.45, bumpMap: neoprene(), bumpScale: 0.6 });
  const big = suit === 'bulwark' ? 1.3 : suit === 'manta' ? 0.9 : 1;   // Bollwerk hat dicke Panzerarme
  const t = gun.gripTop, w = gun.gripW, back = gun.rear + 0.2, R = w / 2 + 0.009;
  // rechte Hand: Handfläche rechts am Griff, die Finger legen sich vorne herum bis auf die linke Seite
  // Handfläche aus weichen, ovalen Formen (wie Muskeln unter dem Handschuh) statt aus Klötzen
  const palm = add(g, KNUCKLE, glove, R + 0.006, t - 0.047, 0.008); palm.scale.set(0.013, 0.04, 0.032);    // Handfläche rechts am Griff
  add(g, KNUCKLE, glove, R * 0.55, t - 0.05, 0.027).scale.set(0.015, 0.024, 0.017);                        // Daumenballen
  add(g, KNUCKLE, glove, R * 0.25, t - 0.03, 0.034).scale.set((w + 0.024) / 2, 0.025, 0.017);             // Handballen hinter dem Griff
  add(g, KNUCKLE, glove, R + 0.012, t - 0.03, -0.004).scale.set(0.007, 0.033, 0.015);                      // Fingerknöchel-Polster
  for (let i = 0; i < 3; i++) {                                                                  // Mittel-, Ring-, kleiner Finger
    const y = t - 0.034 - i * 0.02, f = -(0.028 - i * 0.004), r = 0.0098 - i * 0.0008;
    finger(g, glove, [[R, y, f + 0.026], [R + 0.002, y, f - 0.004], [0, y - 0.002, f - 0.014], [-R, y - 0.002, f - 0.002], [-R - 0.002, y - 0.001, f + 0.016]], r);
  }
  finger(g, glove, [[R, t - 0.014, -0.006], [R - 0.002, t - 0.016, -0.034], [0.006, t - 0.02, -0.052], [0, t - 0.03, -0.058]], 0.009);   // Zeigefinger am Abzug
  finger(g, glove, [[R * 0.6, t - 0.04, 0.03], [-R * 0.3, t - 0.02, 0.026], [-R - 0.004, t - 0.008, 0.004], [-R - 0.004, t - 0.004, -0.02]], 0.0105);   // Daumen
  cuff(g, acc, [0.004, t - 0.058, 0.034], [0.01, t - 0.07, 0.07], 0.027 * big);                // Bündchen in Anzugfarbe
  // Klettverschluss am Handgelenk wie bei echten Tauchhandschuhen
  const strapM = new THREE.MeshStandardMaterial({ color: 0x15191d, roughness: 0.9, bumpMap: neoprene(), bumpScale: 2 });
  const strap = add(g, RBOX, strapM, 0.007, t - 0.064, 0.048); strap.scale.set(0.062 * big, 0.058 * big, 0.014); strap.rotation.x = -0.3;
  add(g, RBOX, acc, 0.04 * big, t - 0.062, 0.048).scale.set(0.01, 0.03, 0.02);                          // Lasche
  limb(g, sleeve, [0.01, t - 0.07, 0.068], [0.16, t - 0.34, back], 0.036 * big);              // Unterarm bis aus dem Bild
  if (big > 1.2) { const p = add(g, RBOX, acc, 0.05, t - 0.13, 0.19); p.scale.set(0.09, 0.05, 0.16); p.rotation.set(-0.6, 0.3, 0.2); }   // Panzerplatte
  // linke Hand (Gewehre und Werfer): Handfläche unten, Finger rechts hoch, Daumen links
  const right = g; g.userData.left = null;
  if (gun.kind === 'pistol') {
    // Pistole beidhändig wie bei der Polizei: die linke Hand legt sich von links um die rechte,
    // ihre Finger umfassen vorne die Finger der rechten Hand, der linke Daumen zeigt am Rahmen entlang nach vorne.
    const g = new THREE.Group(); right.add(g); right.userData.left = g;
    const L = -(R + 0.016);
    const lp = add(g, KNUCKLE, glove, L - 0.004, t - 0.05, 0.004); lp.scale.set(0.012, 0.038, 0.032); lp.rotation.y = 0.18;   // Handfläche links am Griff
    for (let i = 0; i < 4; i++) {                                                                 // Finger umfassen vorne die rechte Hand
      const y = t - 0.04 - i * 0.017, r = i === 3 ? 0.0082 : 0.0095;
      finger(g, glove, [[L, y, -0.022], [L + 0.008, y - 0.002, -0.048], [-0.004, y - 0.003, -0.056], [R * 0.7, y - 0.002, -0.05], [R + 0.01, y - 0.001, -0.036]], r);
    }
    finger(g, glove, [[L + 0.004, t - 0.03, 0.012], [L + 0.002, t - 0.012, -0.018], [L + 0.004, t - 0.004, -0.048], [L + 0.006, t - 0.001, -0.07]], 0.0105);   // Daumen nach vorne
    cuff(g, acc, [L - 0.004, t - 0.062, 0.04], [L - 0.012, t - 0.075, 0.074], 0.026 * big);    // Bündchen
    limb(g, sleeve, [L - 0.012, t - 0.075, 0.072], [-0.2, t - 0.33, back], 0.035 * big);      // Unterarm bis aus dem Bild
  } else if (gun.support) {
    const g = new THREE.Group(); right.add(g); right.userData.left = g;
    const [sx, sy, sz] = gun.support;
    const h = add(g, RBOX_SOFT, glove, sx, sy - 0.022, sz + 0.005); h.scale.set(0.058, 0.026, 0.075);
    for (let i = 0; i < 4; i++) { const z = sz - 0.03 + i * 0.019, r = i === 3 ? 0.0078 : 0.0092; finger(g, glove, [[0.016, sy - 0.028, z], [0.032, sy - 0.012, z], [0.034, sy + 0.012, z - 0.003], [0.026, sy + 0.028, z - 0.006]], r); }
    finger(g, glove, [[-0.018, sy - 0.03, sz + 0.02], [-0.032, sy - 0.006, sz + 0.008], [-0.03, sy + 0.02, sz - 0.012]], 0.0105);
    cuff(g, acc, [-0.004, sy - 0.04, sz + 0.04], [-0.012, sy - 0.055, sz + 0.075], 0.026 * big);
    limb(g, sleeve, [-0.012, sy - 0.055, sz + 0.072], [-0.24, sy - 0.32, back], 0.035 * big);
  }
  return right;
}
// Die linke Hand beim Nachladen: hält das Magazin zwischen Daumen und Fingern.
// setArm(hand, ellbogen) setzt die Hand an einen Punkt und zieht den Unterarm bis zum Ellbogen (außerhalb des Bildes).
export function makeReloadHand(suit) {
  const g = new THREE.Group(), col = SUIT_COL[suit] || 0x1fd6b4;
  const glove = new THREE.MeshStandardMaterial({ color: 0x353d45, emissive: 0x141a20, emissiveIntensity: 0.65, roughness: 0.55, bumpMap: neoprene(), bumpScale: 0.8 });
  const sleeve = new THREE.MeshStandardMaterial({ color: 0x1c2126, emissive: 0x0c1014, emissiveIntensity: 0.7, roughness: 0.8, bumpMap: neoprene(), bumpScale: 1.2 });
  const acc = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.4, roughness: 0.45 });
  const big = suit === 'bulwark' ? 1.3 : suit === 'manta' ? 0.9 : 1;
  const hand = new THREE.Group(); g.add(hand);
  add(hand, RBOX_SOFT, glove, 0, -0.014, 0.014).scale.set(0.058, 0.026, 0.07);                                    // Handfläche
  for (let i = 0; i < 4; i++) { const x = -0.018 + i * 0.012; finger(hand, glove, [[x, -0.01, -0.012], [x, 0.008, -0.03], [x * 0.8, 0.02, -0.036]], i === 3 ? 0.0075 : 0.0088); }   // Finger umfassen das Magazin
  finger(hand, glove, [[0.026, -0.012, 0.01], [0.032, 0.006, -0.008], [0.026, 0.02, -0.02]], 0.01);         // Daumen
  const cuff = new THREE.Mesh(FINGER, acc), arm = new THREE.Mesh(FORE, sleeve); g.add(cuff); g.add(arm);
  const A = new THREE.Vector3(), B = new THREE.Vector3(), D = new THREE.Vector3();
  const seg = (m, a, b, r) => { D.copy(b).sub(a); const l = D.length() || 0.001; m.scale.set(r, r, l); m.position.copy(a).addScaledVector(D, 0.5); m.quaternion.setFromUnitVectors(Z_AXIS, D.normalize()); };
  g.userData.setArm = (handPos, elbowPos) => {
    hand.position.copy(handPos);
    A.copy(handPos).add(new THREE.Vector3(0, -0.02, 0.03)); B.copy(elbowPos).sub(A).setLength(0.04).add(A);   // Bündchen immer 4 cm lang
    seg(cuff, A, B, 0.03 * big); seg(arm, B, elbowPos, 0.035 * big); arm.scale.y *= ARM_FLAT;
  };
  return g;
}

// ---------- Brustschwimmen in der Ego-Sicht ----------
// Zwei Arme vor der Kamera (Kamera-Koordinaten: x rechts, y oben, −z nach vorne). Jeder Arm: Schulter (außerhalb des Bildes)
// → Ellbogen → Handgelenk → flache Hand mit geschlossenen Fingern. poseSwim(p) setzt alles für den Zeitpunkt p (0…1) im Zug.
// Schlüssel-Momente für die RECHTE Hand (die linke ist gespiegelt): [Zeitpunkt, Position, Drehung (kippen, drehen, rollen)]
//   Gleiten: Hände vorne zusammen · Auseinander: nach außen drücken · Ziehen: unter die Brust · Zurück: unter dem Kinn zusammen
// Drehung = [kippen (− = Finger nach unten), drehen (− = Finger nach außen), rollen (+ = Handfläche nach außen, − = nach innen)]
// Ablauf wie bei echten Brustschwimmern: langsam auseinander (Handflächen nach außen), dann Finger nach unten und
// Handflächen nach hinten (fassen), schneller Zug nach innen unter die Brust, Handflächen zueinander vors Kinn, nach vorne schieben.
export const SWIM_KEYS = [
  [0.0,  [0.06, -0.1, -0.5],   [0.0, 0.05, 0.3]],     // Gleiten: Arme vorne, Handflächen nach unten (leicht nach außen)
  [0.25, [0.32, -0.1, -0.44],  [-0.1, -0.3, 1.25]],   // Auseinander: Handflächen drehen nach AUSSEN (ruhig, langsam)
  [0.38, [0.34, -0.2, -0.38],  [-0.9, -0.15, 0.4]],   // Fassen: Finger zeigen nach unten, Handflächen nach HINTEN
  [0.52, [0.13, -0.3, -0.3],   [-1.0, 0.3, -0.7]],    // Zug nach innen (schnell, die Kraftphase): Handflächen nach hinten-innen
  [0.64, [0.05, -0.2, -0.27],  [0.25, 0.15, -1.5]],   // vor dem Kinn: Handflächen zueinander
  [0.82, [0.05, -0.13, -0.42], [0.05, 0.08, -0.6]],   // nach vorne schieben, Handflächen drehen wieder nach unten
  [1.0,  [0.06, -0.1, -0.5],   [0.0, 0.05, 0.3]],     // wieder Gleiten
];
export function makeSwimArms(suit) {
  const g = new THREE.Group(), col = SUIT_COL[suit] || 0x1fd6b4, big = suit === 'bulwark' || suit === 'hammerhai' ? 1.25 : suit === 'manta' || suit === 'barrakuda' ? 0.9 : 1;
  const glove = new THREE.MeshStandardMaterial({ color: 0x353d45, emissive: 0x141a20, emissiveIntensity: 0.65, roughness: 0.55, bumpMap: neoprene(), bumpScale: 0.8 });
  const sleeve = new THREE.MeshStandardMaterial({ color: 0x1c2126, emissive: 0x0c1014, emissiveIntensity: 0.7, roughness: 0.8, bumpMap: neoprene(), bumpScale: 1.2 });
  const acc = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.4, roughness: 0.45 });
  const D = new THREE.Vector3(), E = new THREE.Euler(), sides = [];
  const seg = (m, a, b, r) => { D.copy(b).sub(a); const l = D.length() || 0.001; m.scale.set(r, r, l); m.position.copy(a).addScaledVector(D, 0.5); m.quaternion.setFromUnitVectors(Z_AXIS, D.normalize()); };
  for (const s of [1, -1]) {
    const hand = new THREE.Group(); hand.scale.setScalar(1.35); g.add(hand);   // in Ego-Spielen sind die Hände etwas größer, sonst sieht man sie kaum
    // flache Hand: Handfläche, vier gestreckte Finger (leicht gebogen), Daumen seitlich – Finger zeigen nach −z, Handfläche nach unten
    add(hand, RBOX_SOFT, glove, 0, 0, 0.01).scale.set(0.075, 0.024, 0.085);
    for (let i = 0; i < 4; i++) { const x = (-0.027 + i * 0.018) * s, len = [0.07, 0.08, 0.076, 0.062][i]; finger(hand, glove, [[x, 0, -0.03], [x * 1.02, -0.003, -0.03 - len * 0.55], [x * 1.04, -0.008, -0.03 - len]], i === 3 ? 0.0078 : 0.009); }
    finger(hand, glove, [[-0.035 * s, -0.004, 0.02], [-0.05 * s, -0.006, -0.006], [-0.056 * s, -0.008, -0.03]], 0.0105);
    const cuff = new THREE.Mesh(FINGER, acc), fore = new THREE.Mesh(FORE, sleeve), upper = new THREE.Mesh(FORE, sleeve), elbowB = new THREE.Mesh(KNUCKLE, sleeve);
    g.add(cuff, fore, upper, elbowB);
    sides.push({ s, hand, cuff, fore, upper, elbowB, wrist: new THREE.Vector3(), elbow: new THREE.Vector3(), shoulder: new THREE.Vector3(0.24 * s, -0.46, 0.12), back: new THREE.Vector3() });
  }
  const P = new THREE.Vector3(), Q = new THREE.Vector3(), R = new THREE.Vector3(), R2 = new THREE.Vector3();
  const smooth = (x) => x * x * (3 - 2 * x);
  // p = Zeitpunkt im Zug (0…1)
  g.userData.pose = (p) => {
    p = ((p % 1) + 1) % 1;
    let i = 0; while (i < SWIM_KEYS.length - 2 && p > SWIM_KEYS[i + 1][0]) i++;
    const [t0, p0, r0] = SWIM_KEYS[i], [t1, p1, r1] = SWIM_KEYS[i + 1], k = smooth((p - t0) / (t1 - t0));
    P.set(...p0).lerp(Q.set(...p1), k); R.set(...r0).lerp(R2.set(...r1), k);
    for (const S of sides) {
      const s = S.s;
      S.hand.position.set(P.x * s, P.y, P.z);
      S.hand.rotation.copy(E.set(R.x, R.y * s, R.z * s, 'YXZ'));
      S.wrist.set(0, 0, 0.06).applyEuler(S.hand.rotation).add(S.hand.position);                         // Handgelenk hinter der Hand
      S.back.copy(S.wrist).sub(S.shoulder);
      S.elbow.copy(S.shoulder).addScaledVector(S.back, 0.5).add(R2.set(0.09 * s, -0.08, 0.04));          // Ellbogen nach außen-unten geknickt
      seg(S.cuff, S.wrist, R2.copy(S.elbow).sub(S.wrist).setLength(0.045).add(S.wrist), 0.03 * big);
      seg(S.fore, R2.copy(S.elbow).sub(S.wrist).setLength(0.045).add(S.wrist), S.elbow, 0.034 * big);
      seg(S.upper, S.elbow, S.shoulder, 0.042 * big); S.fore.scale.y *= ARM_FLAT;
      S.elbowB.position.copy(S.elbow); S.elbowB.scale.setScalar(0.038 * big);
    }
  };
  g.userData.pose(0);
  return g;
}

// ---------- Nachladen: Magazin wechseln ----------
// Die zweite Hand zieht das alte Magazin raus, steckt es hinten in den Rucksack (dort füllt es der Kompressor wieder),
// holt das vollste Magazin raus, schiebt es ein und klopft es fest. Die Abschnitte (0 = Anfang, 1 = fertig):
export const RELOAD_STEPS = {
  grab: 0.1,      // Waffe kippt (Boden nach links), Hand kommt zum Magazin
  pull: 0.2,      // altes Magazin rausziehen
  stow: 0.36,     // nach hinten in den Rucksack stecken
  fetch: 0.5,     // neues Magazin aus dem Rucksack holen
  insert: 0.6,    // einschieben – Klack!
  slap: 0.64,     // festklopfen
  toCock: 0.72,   // Waffe dreht zurück, Hand greift Schlitten / Spannhebel
  cockBack: 0.8,  // nach hinten ziehen
  release: 0.84,  // loslassen – schnappt nach vorne, fertig
};
// wie stark die Waffe gekippt ist (0 = normal, 1 = Boden ganz nach links)
export function reloadRoll(done) {
  const S = RELOAD_STEPS, k = (a, b) => { const x = Math.max(0, Math.min(1, (done - a) / (b - a))); return x * x * (3 - 2 * x); };
  if (done < S.slap) return k(0, S.grab);
  if (done < S.release) return 1 - 0.7 * k(S.slap, S.toCock);
  return 0.3 * (1 - k(S.release, 1));
}
const RV = { hand: new THREE.Vector3(), tmp: new THREE.Vector3(), mag: new THREE.Vector3(), out: new THREE.Vector3() };
// done = 0…1 Fortschritt, gunUD = userData der Waffe, rHand = makeReloadHand(...),
// pack / elbow = Rucksack und Ellbogen in Waffen-Koordinaten (beide außerhalb des Bildes)
// Revolver: Trommel klappt nach links aus, alte Trommel raus und in den Rucksack, neue 6er-Trommel holen,
// einsetzen, mit einem Ruck zuschlagen (die Trommel dreht sich dabei kurz), Hand zurück an den Griff.
function poseRevolver(done, U, rHand, pack, elbow) {
  const R = U.revolver, k = (a, b) => { const x = Math.max(0, Math.min(1, (done - a) / (b - a))); return x * x * (3 - 2 * x); };
  const open = -1.25;                                        // so weit klappt der Schwenkarm aus (nach links)
  let swing = 0, inCrane = true, loose = false, fresh = done >= 0.42;
  R.crane.updateMatrixWorld(true);
  const cylAt = (s) => { R.crane.rotation.z = s; R.crane.updateMatrix(); return RV.mag.copy(R.cyl.position).applyMatrix4(R.crane.matrix); };
  if (done < 0.12) { swing = open * k(0.02, 0.12); RV.hand.copy(pack).lerp(cylAt(swing), k(0, 0.12)); }                 // Hand kommt, Trommel klappt aus
  else if (done < 0.26) { swing = open; inCrane = false; loose = true; RV.hand.copy(cylAt(open)); RV.hand.x -= 0.06 * k(0.12, 0.26); }   // alte Trommel abziehen
  else if (done < 0.4) { swing = open; inCrane = false; loose = done < 0.38; RV.hand.copy(cylAt(open)).setX(cylAt(open).x - 0.06).lerp(pack, k(0.26, 0.4)); }   // in den Rucksack
  else if (done < 0.56) { swing = open; inCrane = false; loose = done > 0.42; RV.hand.copy(pack).lerp(cylAt(open).setX(cylAt(open).x - 0.06), k(0.4, 0.56)); }   // neue holen
  else if (done < 0.66) { swing = open; inCrane = false; loose = true; RV.hand.copy(cylAt(open)); RV.hand.x -= 0.06 * (1 - k(0.56, 0.66)); if (done > 0.65) { inCrane = true; loose = false; } }   // einsetzen
  else if (done < 0.74) { swing = open * (1 - k(0.66, 0.72)); RV.hand.copy(cylAt(swing)); RV.hand.x -= 0.03; }           // zuschlagen!
  else { swing = 0; RV.hand.copy(cylAt(0)).lerp(U.support ? RV.tmp.set(...U.support) : pack, k(0.74, 1)); }
  R.crane.rotation.z = swing;
  R.cyl.visible = inCrane;
  R.cyl.rotation.z = done > 0.66 && done < 0.8 ? (done - 0.66) * 30 : 0;                 // Trommel dreht sich beim Zuschlagen
  R.loose.visible = loose; if (loose) R.loose.position.copy(RV.hand);
  R.fill.emissiveIntensity = fresh ? 1.8 : 0.3;                                          // alte Trommel leer (dunkel), neue voll (hell)
  rHand.visible = true;
  rHand.userData.setArm(RV.hand, elbow);
}
export function poseReload(done, gunUD, rHand, pack, elbow) {
  if (gunUD.revolver) return poseRevolver(done, gunUD, rHand, pack, elbow);
  const M = gunUD.mag, C = gunUD.cock, S = RELOAD_STEPS; if (!M) return;
  const k = (a, b) => { const x = Math.max(0, Math.min(1, (done - a) / (b - a))); return x * x * (3 - 2 * x); };
  const seat = M.seat, out = RV.out.copy(M.out).multiplyScalar(M.len + 0.04).add(seat);
  const bottom = (p, into = RV.hand) => into.copy(M.out).multiplyScalar(M.len).add(p);   // die Hand hält das Magazin unten
  let magPos = seat, showMag = true, newMag = done >= S.stow, cockZ = 0;
  // Magnet-Gewehr: der Magnet ist beim Schuss verbraucht – kein altes Magazin, die Hand geht gleich zum Rücken
  if (gunUD.freshOnly && done < S.stow) { RV.hand.copy(bottom(seat, RV.tmp)).lerp(pack, k(0, S.stow)); showMag = false; }
  else if (done < S.grab) RV.hand.copy(pack).lerp(bottom(seat, RV.tmp), k(0, S.grab));
  else if (done < S.pull) { magPos = RV.mag.copy(seat).lerp(out, k(S.grab, S.pull)); bottom(magPos); }
  else if (done < S.stow) { magPos = RV.mag.copy(out).lerp(pack, k(S.pull, S.stow)); bottom(magPos); showMag = done < S.stow - 0.03; }
  else if (done < S.fetch) { magPos = RV.mag.copy(pack).lerp(out, k(S.stow, S.fetch)); bottom(magPos); showMag = done > S.stow + 0.03; }
  else if (done < S.insert) { magPos = RV.mag.copy(out).lerp(seat, k(S.fetch, S.insert)); bottom(magPos); }
  else if (done < S.slap) { bottom(seat); RV.hand.addScaledVector(M.out, -0.012 * Math.sin(k(S.insert, S.slap) * Math.PI)); }   // Klaps von unten
  else if (C && done < S.toCock) RV.hand.copy(bottom(seat, RV.tmp)).lerp(C.at, k(S.slap, S.toCock));                              // Hand zum Schlitten
  else if (C && done < S.cockBack) { cockZ = C.travel * k(S.toCock, S.cockBack); RV.hand.copy(C.at); RV.hand.z += cockZ; }      // nach hinten ziehen
  else if (C && done < S.release) { const r = Math.min(1, (done - S.cockBack) / ((S.release - S.cockBack) * 0.35)); cockZ = C.travel * (1 - r); RV.hand.copy(C.at); RV.hand.z += C.travel; RV.hand.x -= 0.02 * r; }   // loslassen
  else { const from = C ? RV.tmp.copy(C.at).setZ(C.at.z + C.travel) : bottom(seat, RV.tmp); RV.hand.copy(from).lerp(gunUD.support ? RV.mag.set(...gunUD.support) : pack, k(C ? S.release : S.slap, 1)); }
  M.g.position.copy(magPos); M.g.visible = showMag;
  M.fill.emissiveIntensity = newMag ? 1.8 : 0.35;     // altes Magazin dunkel (fast leer), neues hell (voll)
  if (C) C.g.position.z = cockZ;
  rHand.visible = true;
  rHand.userData.setArm(RV.hand, elbow);
}

// ---------- Wasserstrahl (Hitscan-Waffen) ----------
// Ein dicker, sehr hellblauer Strahl von (x0,y0,z0) bis (x1,y1,z1). r = Dicke (Radius) in Metern.
// Außen ein leuchtender blauer Mantel, innen ein fast weißer Kern – so sieht es nach Druckwasser aus.
const BEAM_GEO = zCyl(1, 1, 1, 10);
export function makeBeam(x0, y0, z0, x1, y1, z1, r) {
  const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0) || 0.01;
  const g = new THREE.Group();
  g.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  g.lookAt(x1, y1, z1);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x5fd4ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xe6faff, transparent: true, opacity: 0.95, depthWrite: false });
  const glowM = new THREE.Mesh(BEAM_GEO, glowMat); glowM.scale.set(r * 2.2, r * 2.2, len); g.add(glowM);
  const coreM = new THREE.Mesh(BEAM_GEO, coreMat); coreM.scale.set(r, r, len); g.add(coreM);
  // fade = 1 (frisch) … 0 (weg): der Strahl wird dünner und durchsichtiger
  g.userData.fade = (f) => {
    glowMat.opacity = 0.55 * f; coreMat.opacity = 0.95 * f;
    glowM.scale.x = glowM.scale.y = r * 2.2 * (0.6 + 0.4 * f);
    coreM.scale.x = coreM.scale.y = r * (0.4 + 0.6 * f);
  };
  g.userData.dispose = () => { glowMat.dispose(); coreMat.dispose(); };
  return g;
}
export { WCOL };
