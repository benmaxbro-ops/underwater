// Undernite – Finisher: kurze Animationen, wenn man einen Gegner mit wenig Leben per G erledigt (nur Battle Royale).
// Jede Klasse hat ihren eigenen Finisher:
//   Manta    – schleicht sich hinter den Gegner und schneidet mit dem Messer den Luftschlauch durch
//   Triton   – beschwört einen leuchtenden Fischschwarm und schickt ihn auf den Gegner
//   Bollwerk – zieht eine Minigun und ballert den Gegner weg
//   Goliath  – packt den Gegner, hebt ihn hoch und wirft ihn ins Schwarzwasser (die Zone)
// Der Server hat den Gegner schon erledigt. Hier wird nur gezeigt, wie es passiert: dafür wird eine Kopie
// des Gegners ("ghost") an seine Stelle gesetzt und animiert.
import * as THREE from 'three';
import { SUIT_ORDER, dirFrom, finStyle } from './shared.js';
import { makePlayerModel } from './models.js';
import { schoolFishGeo } from './reef.js';

// wie lange jeder Finisher dauert (Sekunden) und wann genau der Treffer passiert (0 = Anfang, 1 = Ende)
export const FIN_TIME = { manta: 1.8, triton: 2.4, bulwark: 2.4, goliath: 2.8 };
// Zeitlupe um den Treffer herum: speed = so schnell läuft die Zeit dann (0.3 = 30 %), before/after = wie lange (Anteil des Finishers)
export const SLOWMO = { speed: 0.3, before: 0.04, after: 0.1 };
const HIT_AT = { manta: 0.5, triton: 0.6, bulwark: 0.25, goliath: 0.22 };

const TAU = Math.PI * 2;
const ease = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };   // weich anfahren und abbremsen
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// ---------- Minigun (Bollwerk) ----------
// Gebaut entlang +z, damit lookAt sie direkt auf den Gegner richten kann
function makeMinigun() {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x4a545c, roughness: 0.35, metalness: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1f24, roughness: 0.6, metalness: 0.4 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f7fa, roughness: 0.35, emissive: 0x55606a, emissiveIntensity: 0.4 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x2fa8ff, emissive: 0x2fa8ff, emissiveIntensity: 1.5 });
  const cyl = (r, len, mat, z, x = 0, y = 0, seg = 20) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2), mat); m.position.set(x, y, z); return m; };
  g.add(cyl(0.11, 0.42, white, -0.05));                       // Gehäuse mit Motor
  g.add(cyl(0.115, 0.02, blue, 0.1)); g.add(cyl(0.115, 0.02, blue, -0.2));
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 24), white); drum.position.set(-0.17, -0.06, -0.08); drum.rotation.z = Math.PI / 2; g.add(drum);   // Munitionstrommel (Druckwasser)
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.015, 8, 20, Math.PI), dark); handle.position.set(0, 0.11, -0.05); handle.rotation.y = Math.PI / 2; g.add(handle);
  const barrels = new THREE.Group(); barrels.position.z = 0.17; g.add(barrels);
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; barrels.add(cyl(0.018, 0.75, metal, 0.37, Math.cos(a) * 0.055, Math.sin(a) * 0.055, 10)); }
  barrels.add(cyl(0.085, 0.03, dark, 0.12)); barrels.add(cyl(0.085, 0.03, dark, 0.55)); barrels.add(cyl(0.08, 0.03, blue, 0.73));
  g.userData.barrels = barrels;
  g.userData.muzzleZ = 0.8;
  return g;
}

// c = Hilfsmittel aus main.js: { dyn, env, sfx, posOf(id), muzzleOf(id), beam(...), shake(stärke), zone() }
// e = ['fin', Angreifer, Opfer, Klasse Angreifer, Klasse Opfer, x, y, z, Blickrichtung Opfer]
export function startFinisher(c, e) {
  const attacker = e[1], type = finStyle(SUIT_ORDER[e[3]]), vSuit = SUIT_ORDER[e[4]];   // neue Taucher: Animation eines alten
  const V = { x: e[5], y: e[6], z: e[7], yaw: e[8] };
  const A0 = { ...(c.posOf(attacker) || { x: V.x + 3, y: V.y, z: V.z }) };
  // Kopie des Gegners; ihre Materialien werden kopiert, damit sie durchsichtig werden kann, ohne andere Taucher zu ändern
  const ghost = makePlayerModel(vSuit, e[2], '');
  const mats = [];
  ghost.traverse((o) => { if (o.material) { const base = o.material.opacity; o.material = o.material.clone(); o.material.transparent = true; o.material.userData.baseOp = base; mats.push(o.material); } });   // baseOp: Glas bleibt durchsichtig
  ghost.position.set(V.x, V.y, V.z);
  c.dyn.add(ghost);
  const gs = { yaw: V.yaw, pitch: 0, speed: 0, weapon: -1, surf: false };
  // Richtung vom Angreifer zum Gegner (waagerecht)
  let dx = V.x - A0.x, dz = V.z - A0.z; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
  const faceV = Math.atan2(-dx, -dz);                 // Blickrichtung "zum Gegner hin"
  const vf = dirFrom(V.yaw, 0);                       // wohin der Gegner schaut
  // wo der Angreifer am Ende stehen soll
  const goal = type === 'manta' ? { x: V.x - vf[0] * 1.2, y: V.y + 0.1, z: V.z - vf[2] * 1.2, yaw: V.yaw }   // direkt hinter ihm
    : type === 'goliath' ? { x: V.x - dx * 2.2, y: V.y, z: V.z - dz * 2.2, yaw: faceV }                       // ganz nah ran zum Packen
    : { x: A0.x, y: A0.y, z: A0.z, yaw: faceV };                                                              // Triton und Bollwerk bleiben stehen
  const moveEnd = type === 'manta' ? 0.4 : type === 'goliath' ? 0.2 : 0.01;
  // Manta: Zwischenpunkt seitlich vom Gegner, damit er im Bogen hinter ihn schwimmt
  const sideSign = ((A0.x - V.x) * vf[2] - (A0.z - V.z) * vf[0]) > 0 ? 1 : -1;
  const side = { x: V.x + vf[2] * 2.4 * sideSign, y: V.y + 0.4, z: V.z - vf[0] * 2.4 * sideSign };
  const dur = FIN_TIME[type], hitAt = HIT_AT[type];
  let t = 0, hit = false, gone = 0;
  const extras = [];    // zusätzliche Dinge (Fische, Minigun), die am Ende entfernt werden

  // ----- Triton: Fischschwarm -----
  let fish = null, fishData = null;
  if (type === 'triton') {
    const N = 56, mat = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x9fe8ff, emissive: 0x1fa8e0, emissiveIntensity: 0.9, metalness: 0.5, roughness: 0.3, side: THREE.DoubleSide, transparent: true });
    fish = new THREE.InstancedMesh(schoolFishGeo(), mat, N); fish.frustumCulled = false;
    fishData = Array.from({ length: N }, (_, i) => ({ a: (i / N) * TAU * 3, r: 0.6 + Math.random() * 0.8, h: Math.random() - 0.5, d: Math.random() * 0.25, s: 1 + Math.random() * 0.8, prev: new THREE.Vector3(A0.x, A0.y, A0.z), q: new THREE.Quaternion() }));
    c.dyn.add(fish); extras.push(fish);
    c.sfx.summon(); c.sfx.swarm(dur * 0.85);
  }
  // ----- Bollwerk: Minigun -----
  let gun = null, spin = 0, fireT = 0;
  if (type === 'bulwark') { gun = makeMinigun(); c.dyn.add(gun); extras.push(gun); c.sfx.spin(true, dur * hitAt); }
  // ----- Goliath: Wurf ins Schwarzwasser -----
  let throwFrom = null, throwTo = null, landed = false;

  const M4 = new THREE.Matrix4(), P = new THREE.Vector3(), S = new THREE.Vector3(), UPV = new THREE.Vector3(0, 1, 0), G = new THREE.Vector3();

  const f = {
    attacker, type, p: 0, pose: null, ghost, hitAt,
    // gibt false zurück, wenn der Finisher vorbei ist
    update(dt) {
      // Zeitlupe kurz vor bis kurz nach dem Treffer (SLOWMO.speed = wie langsam)
      const pp = t / dur; if (pp > hitAt - SLOWMO.before && pp < hitAt + SLOWMO.after) dt *= SLOWMO.speed;
      t += dt; const p = f.p = Math.min(1, t / dur);
      // 1) Angreifer bewegt sich in Position
      const m = ease(p / moveEnd);
      if (type === 'manta') {   // im Bogen seitlich um den Gegner herum (nicht durch ihn hindurch)
        const u = 1 - m, bx = u * u * A0.x + 2 * u * m * side.x + m * m * goal.x, by = u * u * A0.y + 2 * u * m * side.y + m * m * goal.y, bz = u * u * A0.z + 2 * u * m * side.z + m * m * goal.z;
        const yaw = m < 0.98 ? Math.atan2(-(bx - (f.pose?.x ?? bx)), -(bz - (f.pose?.z ?? bz))) : goal.yaw;
        f.pose = { x: bx, y: by, z: bz, yaw: Number.isFinite(yaw) && (Math.abs(bx - (f.pose?.x ?? bx)) + Math.abs(bz - (f.pose?.z ?? bz)) > 1e-4) ? yaw : (f.pose?.yaw ?? goal.yaw) };
      } else f.pose = { x: A0.x + (goal.x - A0.x) * m, y: A0.y + (goal.y - A0.y) * m, z: A0.z + (goal.z - A0.z) * m, yaw: goal.yaw };
      // 2) der Treffer
      if (!hit && p >= hitAt) { hit = true; onHit(); if (vSuit === 'goliath') breakMech(); }
      // 3) was mit dem Gegner (und Fischen, Minigun) passiert
      if (type === 'manta') manta(dt, p);
      else if (type === 'triton') triton(dt, p);
      else if (type === 'bulwark') bulwark(dt, p);
      else goliath(dt, p);
      if (broken) updateBroken(dt, p); else ghost.userData.update(dt, gs);
      // am Ende ausblenden
      const fade = type === 'triton' ? 1 - gone : 1 - ease((p - 0.82) / 0.18);
      for (const mt of mats) mt.opacity = fade * (mt.userData.baseOp ?? 1);
      if (p >= 1) { c.dyn.remove(ghost); for (const x of extras) c.dyn.remove(x); return false; }
      return true;
    },
  };

  // ----- Ist das Opfer ein Mech, bricht er beim Treffer auseinander -----
  // Jedes Teil (Arme, Beine, Rückenblock, Propeller, Scheinwerfer …) fliegt von der Mitte weg, dreht sich und sinkt langsam,
  // die Glaskuppel zerspringt (verschwindet in einer Blasenwolke), Funken sprühen aus den Gelenken.
  let broken = null;
  function breakMech() {
    const body = ghost.userData.inner && ghost.userData.inner.children[0]; if (!body) return;
    broken = [];
    for (const ch of [...body.children]) {
      const glass = ch.material && (ch.material.isShaderMaterial || (ch.material.userData.baseOp ?? 1) < 0.5);
      if (glass) { ch.visible = false; continue; }                                    // Kuppel zerspringt
      const dir = ch.position.clone(); if (dir.lengthSq() < 0.04) dir.set(Math.random() - 0.5, 0.3, Math.random() - 0.5); dir.normalize();
      const core = ch.position.length() < 0.6;                                          // der Rumpf selbst fliegt kaum
      broken.push({ o: ch, v: dir.multiplyScalar(core ? 0.6 : 2.5 + Math.random() * 3.5).add(new THREE.Vector3(0, core ? 0.2 : 1.2, 0)),
        w: new THREE.Vector3((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 7, (Math.random() - 0.5) * 7).multiplyScalar(core ? 0.15 : 1) });
    }
    const g = ghost.position;
    c.env.bubble(g.x, g.y + 1.2, g.z, 60, 1.2, 3); c.env.explosion(g.x, g.y + 0.5, g.z, 2.5);
    c.sfx.zap(1, 1); c.shake(0.5);
  }
  function updateBroken(dt, p) {
    for (const b of broken) {
      b.o.position.addScaledVector(b.v, dt); b.v.multiplyScalar(1 - dt * 1.1); b.v.y -= dt * 1.2;   // Wasser bremst, Teile sinken
      b.o.rotation.x += b.w.x * dt; b.o.rotation.y += b.w.y * dt; b.o.rotation.z += b.w.z * dt;
    }
    if (p < hitAt + 0.3 && Math.random() < 0.5) {   // Funken aus den Gelenken
      const g = ghost.position, a = Math.random() * TAU, r = 0.6 + Math.random() * 1.2, y = g.y + Math.random() * 2;
      c.beam(g.x, y, g.z, g.x + Math.cos(a) * r, y + (Math.random() - 0.3) * r, g.z + Math.sin(a) * r, 0.012);
    }
  }

  function onHit() {
    const g = ghost.position;
    if (type === 'manta') { c.sfx.knife(); c.sfx.hoseCut(); c.shake(0.15); }
    else if (type === 'triton') { c.sfx.bite(1); setTimeout(() => c.sfx.bite(0.8), 120); setTimeout(() => c.sfx.bite(0.9), 260); c.env.bubble(g.x, g.y, g.z, 40, 0.8, 3); }
    else if (type === 'bulwark') c.sfx.minigun(dur * (0.78 - hitAt));
    else { c.sfx.grab(); c.shake(0.4); }
  }

  // Manta: Luft sprudelt aus dem durchgeschnittenen Schlauch, der Gegner zappelt, dann sinkt er bewusstlos weg
  function manta(dt, p) {
    if (!hit) return;
    const g = ghost, s = Math.max(0, 1 - (p - hitAt) * 2.5);
    g.rotation.z = Math.sin(t * 13) * 0.3 * s + Math.sin(t * 7.3) * 0.12 * s;   // zappelt (flüssig, nicht zittrig)
    g.rotation.x = -ease((p - 0.65) / 0.3) * 1.2;
    g.position.y -= dt * 0.9 * ease((p - 0.6) / 0.2);
    if (Math.random() < 0.8) c.env.bubble(g.position.x - vf[0] * 0.35, g.position.y + 0.35, g.position.z - vf[2] * 0.35, 2, 0.1, 2.5, 0.03 + Math.random() * 0.05);
  }

  // Triton: Schwarm entsteht in einer Spirale um Triton, schießt zum Gegner, wirbelt um ihn herum und verschwindet mit ihm
  function triton(dt, p) {
    const A = f.pose, g = ghost.position;
    for (let i = 0; i < fishData.length; i++) {
      const fd = fishData[i];
      const spiral = (k) => P.set(A.x + Math.cos(fd.a + t * 4) * (0.5 + 2.2 * fd.r * k), A.y + 0.4 + fd.h * 1.6 + Math.sin(t * 3 + fd.a) * 0.2, A.z + Math.sin(fd.a + t * 4) * (0.5 + 2.2 * fd.r * k));
      const swirlR = 1.3 * (1 - clamp01((p - hitAt) / 0.28) * 0.55);
      const swirl = () => G.set(g.x + Math.cos(fd.a * 2 + t * 9) * swirlR * fd.r, g.y + fd.h * 2 + Math.sin(t * 5 + fd.a) * 0.3, g.z + Math.sin(fd.a * 2 + t * 9) * swirlR * fd.r);
      let scale = fd.s;
      if (p < 0.28) { spiral(ease(p / 0.28)); scale *= ease(p / 0.15); }
      else if (p < hitAt) {
        const k = ease((p - 0.28) / (hitAt - 0.28) * (1 + fd.d) - fd.d);
        spiral(1); swirl(); P.lerp(G, k); P.y += Math.sin(k * Math.PI) * 2;   // im Bogen zum Gegner
      } else if (p < 0.88) { swirl(); P.copy(G); }
      else { swirl(); P.copy(G); const k = (p - 0.88) / 0.12; P.x += Math.cos(fd.a) * k * 8; P.z += Math.sin(fd.a) * k * 8; P.y += fd.h * k * 4; scale *= 1 - k; }   // Schwarm stiebt auseinander
      // Blickrichtung = Bewegungsrichtung
      if (P.distanceToSquared(fd.prev) > 1e-6) { M4.lookAt(fd.prev, P, UPV); fd.q.setFromRotationMatrix(M4); }
      fd.prev.copy(P);
      fish.setMatrixAt(i, M4.compose(P, fd.q, S.set(scale, scale, scale)));
    }
    fish.instanceMatrix.needsUpdate = true;
    if (p > 0.92) fish.material.opacity = 1 - (p - 0.92) / 0.08;
    if (hit) {   // der Gegner wird herumgewirbelt und verschwindet im Schwarm
      ghost.rotation.y += dt * 9;
      gone = clamp01((p - hitAt) / 0.25);
      ghost.scale.setScalar(Math.max(0.01, 1 - gone));
      if (Math.random() < 0.5) c.env.bubble(g.x, g.y, g.z, 3, 0.8, 2);
    }
  }

  // Bollwerk: Minigun ausfahren, hochdrehen, ballern (viele kleine Wasserstrahlen), runterdrehen
  function bulwark(dt, p) {
    const A = f.pose, g = ghost.position;
    const fx = -Math.sin(A.yaw), fz = -Math.cos(A.yaw), rx = Math.cos(A.yaw), rz = -Math.sin(A.yaw);
    const out = ease(p / 0.12);
    gun.position.set(A.x + fx * 0.55 + rx * 0.35, A.y - 0.05 - (1 - out) * 0.4, A.z + fz * 0.55 + rz * 0.35);
    gun.lookAt(g.x, g.y, g.z); gun.updateMatrixWorld(true);
    gun.scale.setScalar(Math.max(0.01, out) * 1.5);   // 1,5-mal so groß, damit man sie gut sieht
    const firing = p >= hitAt && p < 0.78;
    spin = firing ? Math.min(40, spin + dt * 80) : p < hitAt ? Math.min(30, spin + dt * 30) : Math.max(0, spin - dt * 25);
    gun.userData.barrels.rotation.z += spin * dt;
    if (firing) {
      fireT -= dt;
      while (fireT <= 0) {
        fireT += 1 / 28;
        const mz = gun.localToWorld(P.set(0, 0, gun.userData.muzzleZ));   // Mündung (localToWorld rechnet die Größe mit ein)
        const jx = (Math.random() - 0.5) * 0.5, jy = (Math.random() - 0.3) * 0.7, jz = (Math.random() - 0.5) * 0.5;
        c.beam(mz.x, mz.y, mz.z, g.x + jx, g.y + jy, g.z + jz, 0.03);
        c.env.bubble(g.x + jx, g.y + jy, g.z + jz, 2, 0.15, 1.5);
        if (Math.random() < 0.25) c.env.blood(g.x + jx, g.y + jy, g.z + jz);
      }
      // der Gegner wird zurückgedrückt und durchgeschüttelt
      ghost.position.x += fx * dt * 2.2; ghost.position.z += fz * dt * 2.2;
      ghost.rotation.z = Math.sin(t * 23) * 0.13 + Math.sin(t * 37) * 0.05; ghost.rotation.x = Math.sin(t * 19) * 0.09;   // wird durchgeschüttelt (flüssig)
      c.shake(0.12);
    }
    if (p >= 0.78 && !f.spunDown) { f.spunDown = true; c.sfx.spin(false, 0.5); }
    if (p >= 0.78) { ghost.rotation.x = -ease((p - 0.78) / 0.2) * 1.4; ghost.position.y -= dt * 0.8; }   // kippt um und sinkt
  }

  // Goliath: packen, hochheben, werfen – im hohen Bogen ins Schwarzwasser
  function goliath(dt, p) {
    const A = f.pose, fx = -Math.sin(A.yaw), fz = -Math.cos(A.yaw), g = ghost.position;
    if (p < hitAt) return;
    if (p < 0.45) {                                     // in der Mech-Hand, wird hochgehoben und zappelt
      const lift = ease((p - hitAt) / (0.45 - hitAt));
      g.set(A.x + fx * (1.6 - lift * 0.8), A.y + 1.2 + lift * 2.6, A.z + fz * (1.6 - lift * 0.8));
      ghost.rotation.z = Math.sin(t * 18) * 0.35; ghost.rotation.x = Math.sin(t * 13) * 0.2;
      return;
    }
    if (!throwFrom) {
      // Ziel: der nächste Rand der Zone, ein Stück dahinter (höchstens 55 m weit). Ohne Zone einfach weit nach vorne.
      throwFrom = g.clone();
      const z = c.zone();
      if (z && z[2] > 1) {
        let ox = g.x - z[0], oz = g.z - z[1]; const ol = Math.hypot(ox, oz) || 1; ox /= ol; oz /= ol;
        throwTo = new THREE.Vector3(z[0] + ox * (z[2] + 8), g.y - 2, z[1] + oz * (z[2] + 8));
      } else throwTo = new THREE.Vector3(g.x + fx * 40, g.y, g.z + fz * 40);
      const d = throwTo.distanceTo(throwFrom);
      if (d > 55) throwTo.sub(throwFrom).multiplyScalar(55 / d).add(throwFrom);
      c.sfx.hurl(); c.shake(0.6);
    }
    const k = clamp01((p - 0.45) / 0.42), arc = Math.min(14, throwFrom.distanceTo(throwTo) * 0.3);
    g.lerpVectors(throwFrom, throwTo, k); g.y += Math.sin(k * Math.PI) * arc;      // hoher Bogen
    ghost.rotation.x -= dt * 9; ghost.rotation.z += dt * 4;                         // überschlägt sich
    if (Math.random() < 0.6) c.env.bubble(g.x, g.y, g.z, 2, 0.3, 0.5);
    if (k >= 1 && !landed) { landed = true; c.sfx.zoneZap(); c.env.ink(g.x, g.y, g.z); c.env.explosion(g.x, g.y, g.z, 3); }
  }
  return f;
}
