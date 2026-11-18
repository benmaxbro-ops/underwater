// Undernite – sichtbare Schockwelle bei jedem Schuss.
// Unter Wasser sieht man eine Druckwelle fast nur am Rand: dort bricht sie das Licht und schimmert.
// Deshalb leuchten alle Teile nur an ihren Kanten (das nennt man "Fresnel-Effekt").
//   Druckblase  = schimmernde Kugel, die nach vorne aufplatzt
//   Fächer      = feine Druck-Streifen, die aus der Mündung auffächern
//   Kiemen-Stöße = kleine Blasen, die links und rechts aus den Seitenkiemen schießen
import * as THREE from 'three';
import { SHOT_CHARGE, WEAPON_IDS } from './shared.js';

// size = Größe je Waffe in Metern (Pistole, Nadler, Splitter, Harpune, Torpedo, Bordtorpedo, Plasma, Schall)
// glow = wie hell (1 = normal, 2 = doppelt), color = Farbe, hot = Farbe bei voller Hitze, streaks = Streifen im Fächer
// Die Welle kommt beim Hitze-Ablassen: nach ein paar Sekunden Pause (HEAT.pause in shared.js)
export const SHOCK = { size: [1.1, 0.8, 1.5, 1.9, 2.6, 2.2, 1.5, 3.4, 1.5, 0.9, 1.8, 2.2, 1, 1, 1], glow: 1.0, color: 0xc8f4ff, hot: 0xffa060, streaks: 70 };

const VERT = `
varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying float vD;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vUv = uv; vD = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
// rim = nur der Rand leuchtet, fan = Streifen + an beiden Enden ausblenden
const frag = (fan) => `
uniform float uOp; uniform vec3 uColor; uniform float uStreaks;
varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying float vD;
void main() {
  float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), ${fan ? '1.5' : '3.0'});
  ${fan ? 'rim *= (0.35 + 0.65 * pow(0.5 + 0.5 * sin(vUv.x * uStreaks), 3.0)) * vUv.y * (1.0 - vUv.y) * 4.0;' : 'rim *= 1.6;'}
  float far = clamp(1.0 - vD / 70.0, 0.0, 1.0);   // weit weg im trüben Wasser kaum noch zu sehen
  gl_FragColor = vec4(uColor * rim * uOp * far, 1.0);
}`;
const material = (fan) => new THREE.ShaderMaterial({
  uniforms: { uOp: { value: 0 }, uColor: { value: new THREE.Color(SHOCK.color) }, uStreaks: { value: SHOCK.streaks } },
  vertexShader: VERT, fragmentShader: frag(fan),
  transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
});

const SPHERE = new THREE.SphereGeometry(1, 40, 20);
// Fächer: offener Kegel, Spitze an der Mündung, öffnet sich nach vorne (+z)
const CONE = new THREE.CylinderGeometry(1, 0.04, 1, 48, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2);
const Z = new THREE.Vector3(0, 0, 1), UPV = new THREE.Vector3(0, 1, 0);

// Eine Schockwelle starten. group = wo sie hinkommt (Szene), x/y/z = Mündung, dx/dy/dz = Schussrichtung,
// mine = eigener Schuss (direkt vor der Kamera etwas schwächer). Gibt ein Objekt zurück, das man mit update(dt) bewegt.
// scale = größer (bei viel Hitze), heat = 0…1: je heißer, desto wärmer die Farbe (hellblau → orange)
export function makeShock(group, x, y, z, dx, dy, dz, widx, mine, scale = 1, heat = 0) {
  const dir = new THREE.Vector3(dx, dy, dz); if (dir.lengthSq() < 1e-6) return null; dir.normalize();
  const size = (SHOCK.size[widx] ?? 1) * scale, dur = Math.max(0.16, (SHOT_CHARGE[WEAPON_IDS[widx]] || 0.1) * 1.8) * (1 + heat * 1.5);
  const tint = new THREE.Color(SHOCK.color).lerp(new THREE.Color(SHOCK.hot), heat);
  const side = new THREE.Vector3().crossVectors(dir, UPV); if (side.lengthSq() < 1e-4) side.set(1, 0, 0); side.normalize();
  const P = new THREE.Vector3(x, y, z), qF = new THREE.Quaternion().setFromUnitVectors(Z, dir);
  const op = SHOCK.glow * (mine ? 0.55 : 1) * (1 + heat * 0.8);   // mehr Hitze = heller
  const parts = [];
  const add = (geo, fan, quat, move, k = 1) => {
    const m = new THREE.Mesh(geo, material(fan)); m.material.uniforms.uColor.value.copy(tint); m.quaternion.copy(quat); m.scale.setScalar(0.001); m.position.copy(P);
    m.frustumCulled = false; group.add(m); parts.push({ m, move, k });
  };
  // Druckblase: platzt nach vorne auf, ist dabei etwas flacher als lang
  add(SPHERE, false, qF, (m, e) => { const r = size * (0.08 + 0.85 * e); m.scale.set(r, r, r * 0.75); m.position.copy(P).addScaledVector(dir, size * 1.25 * e); });
  // zweite, kleinere Welle kurz dahinter (Nachdruck)
  add(SPHERE, false, qF, (m, e) => { const r = size * 0.55 * e; m.scale.set(r, r, r * 0.7); m.position.copy(P).addScaledVector(dir, size * 0.6 * e); }, 0.6);
  // Fächer aus Druck-Streifen
  add(CONE, true, qF, (m, e) => { m.scale.set(size * 0.6 * e, size * 0.6 * e, size * 2.2 * e); }, 0.9);
  // Kiemen-Stöße links und rechts, ein Stück hinter der Mündung
  for (const s of [1, -1]) {
    const sd = side.clone().multiplyScalar(s), base = P.clone().addScaledVector(dir, -0.22);
    const q = new THREE.Quaternion().setFromUnitVectors(Z, sd);
    const g = (0.12 + size * 0.15) * (mine ? 0.22 : 1);   // klein bleiben, vor allem direkt vor der eigenen Kamera
    add(SPHERE, false, q, (m, e) => { const r = g * e; m.scale.set(r, r, r * 1.5); m.position.copy(base).addScaledVector(sd, 0.04 + g * 1.4 * e); }, 0.8);
  }
  return makeUpdater(group, parts, dur, op);
}

// Hitze ablassen – die große Schallwelle. P = Mündung, dir = wohin die Waffe zeigt, back = so weit hinter der Mündung
// sitzen die Kiemen (Meter), heat 0…1. Alles bleibt an seinem Platz in der Welt: dreht man sich, sieht man sie weiterlaufen.
//   1) aus jeder Seitenkieme schießt ein Druckstrahl zur Seite
//   2) eine schimmernde Kugel-Schale breitet sich von der Waffe aus in alle Richtungen aus – 10 bis 35 m weit
//   3) eine zweite, langsamere Schale dahinter (Nachdruck)
export const BLAST = { range: 10, rangeHot: 25, time: 1.5, timeHot: 1.5, jet: 1.6, jetHot: 3.5 };
export function makeBlast(group, x, y, z, dx, dy, dz, widx, heat, mine, back = 0.25) {
  const dir = new THREE.Vector3(dx, dy, dz); if (dir.lengthSq() < 1e-6) return null; dir.normalize();
  const side = new THREE.Vector3().crossVectors(dir, UPV); if (side.lengthSq() < 1e-4) side.set(1, 0, 0); side.normalize();
  const gill = new THREE.Vector3(x, y, z).addScaledVector(dir, -back);
  const tint = new THREE.Color(SHOCK.color).lerp(new THREE.Color(SHOCK.hot), heat);
  const R = BLAST.range + BLAST.rangeHot * heat, dur = BLAST.time + BLAST.timeHot * heat, J = BLAST.jet + BLAST.jetHot * heat;
  const parts = [];
  const add = (geo, quat, pos, move, k = 1) => {
    const m = new THREE.Mesh(geo, material(false)); m.material.uniforms.uColor.value.copy(tint); m.quaternion.copy(quat);
    m.scale.setScalar(0.001); m.position.copy(pos); m.frustumCulled = false; group.add(m); parts.push({ m, move, k });
  };
  for (const s of [1, -1]) {   // Druckstrahlen aus den Kiemen: lang gezogen, schießen schnell zur Seite und werden breiter
    const sd = side.clone().multiplyScalar(s), q = new THREE.Quaternion().setFromUnitVectors(Z, sd);
    add(SPHERE, q, gill, (m, e) => { const r = (0.05 + 0.5 * e) * (0.6 + heat * 0.6); m.scale.set(r, r, J * 0.35 * (0.2 + e)); m.position.copy(gill).addScaledVector(sd, 0.05 + J * 0.6 * e); }, 1.3);
  }
  const Q0 = new THREE.Quaternion();
  add(SPHERE, Q0, gill, (m, e) => { m.scale.setScalar(0.1 + R * e); }, 1.0);                 // große Druckwelle in alle Richtungen
  add(SPHERE, Q0, gill, (m, e) => { m.scale.setScalar(0.1 + R * 0.55 * e * e); }, 0.6);     // Nachdruck
  return makeUpdater(group, parts, dur, SHOCK.glow * (mine ? 0.7 : 1) * (1 + heat * 0.6), 1.2);
}

// gemeinsame Bewegung: e = 0 → 1 (schnell raus, dann langsamer), kurz aufblitzen, dann langsam verblassen
function makeUpdater(group, parts, dur, op, fadePow = 1.6) {
  let t = 0;
  return {
    // gibt false zurück, wenn sie fertig ist (dann wurde alles entfernt)
    update(dt) {
      t += dt / dur;
      if (t >= 1) { for (const p of parts) { group.remove(p.m); p.m.material.dispose(); } return false; }
      const e = 1 - (1 - t) ** 3;                                   // schnell raus, dann langsamer – wie eine echte Druckwelle
      const fade = op * (t < 0.06 ? t / 0.06 : (1 - (t - 0.06) / 0.94) ** fadePow);   // kurz aufblitzen, dann verblassen
      for (const p of parts) { p.move(p.m, e); p.m.material.uniforms.uOp.value = fade * p.k; }
      return true;
    },
    remove() { for (const p of parts) { group.remove(p.m); p.m.material.dispose(); } },
  };
}
