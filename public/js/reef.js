// Undernite – Riff-Deko: neue Korallenarten und Fischschwärme. Alles hier ist nur zum Anschauen
// (der Server weiß nichts davon), deshalb kann man es frei ändern, ohne das Spiel kaputt zu machen.
//   Korallen: Geweihkoralle, Hirnkoralle, Tischkoralle, Fächerkoralle, Röhrenschwämme, Anemonen (wiegen sich)
//   Fische:   Schwärme kleiner Fische, die um die Riffe ziehen
import * as THREE from 'three';
import { seeded, pores, fanLattice, rock } from './textures.js';

const TAU = Math.PI * 2;
// Wie viele neue Korallen pro alter Koralle und wie viele Fische – hier kannst du drehen!
// perCoral = neue Korallen pro alter Koralle, lettuce = Plattenkorallen pro Riff-Koralle,
// schoolsPerReef = Fischschwärme um jedes Riff, fishPerSchool = Fische pro Schwarm, glow = wie stark die Riffkorallen leuchten
// mound = Korallen pro Meter Hügel-Radius, moundGlow = wie stark die Korallen-Berge leuchten
// colorful = Anteil bunter Korallen auf den Hügeln (0 = alle warmgelb, 1 = alle bunt)
// brGlow = im Battle Royale (dunkle Tiefsee) leuchtet das Riff so viel stärker (2 = doppelt so hell)
export const REEF = { stones: 320, perCoral: 1, lettuce: 1, schoolsPerReef: 8, extraSchools: 4, fishPerSchool: 60, glow: 0.22, fishGlow: 0.4, mound: 3.4, moundMax: 44, moundGlow: 0.28, colorful: 0.6, brGlow: 2.5 };
// Grafikqualität (aus den Einstellungen): 1 = alles, kleiner = weniger Korallen, Fische und Steine
let QUAL = 1;
export function setReefQuality(q) { QUAL = q; }
// bunte Korallenfarben für den Bewuchs auf den Hügeln
const BRIGHT = [0xff5d8f, 0xff9a3c, 0xc86bff, 0xffd84d, 0x35e0c8, 0xff6b5e, 0x7fb2ff, 0xff7ad9, 0x8fe86a, 0xffb0a0];
// Riff-Farben: warm und leicht trüb (Gelb, Bernstein, Creme, Ocker) – so leuchten die Korallen-Berge
const PAL = [0xe8c070, 0xd8a850, 0xf0d898, 0xc89048, 0xe0b878, 0xb8a070, 0xf2e2b0, 0xd0a060];
const WARM_GLOW = 0xffc46a;   // Lichtfarbe der leuchtenden Riffkorallen
// wie weit die Oberfläche eines Korallen-Hügels in Richtung (x, y, z) vom Mittelpunkt weg ist (1 = Kugel)
const moundN = (x, y, z) => 1 + 0.16 * Math.sin(x * 4.1 + z * 2.3) * Math.cos(y * 3.7 + x) + 0.07 * Math.sin(x * 9 + y * 7 + z * 5) + 0.04 * Math.sin(x * 17 - z * 13);

// ---------- Hilfsmittel: viele Teile zu einer einzigen Form verschmelzen (schneller zu zeichnen) ----------
// parts = [{ geo, m: Matrix4, shade(x, y, z) -> Helligkeit 0…1 }]
function merge(parts) {
  const list = parts.map(p => { const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone(); g.applyMatrix4(p.m); return [g, p.shade]; });
  const n = list.reduce((a, [g]) => a + g.attributes.position.count, 0);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const [g, shade] of list) {
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
    for (let i = 0; i < P.count; i++, o++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i), s = shade ? shade(x, y, z) : 1;
      pos[o * 3] = x; pos[o * 3 + 1] = y; pos[o * 3 + 2] = z;
      nor[o * 3] = N.getX(i); nor[o * 3 + 1] = N.getY(i); nor[o * 3 + 2] = N.getZ(i);
      col[o * 3] = col[o * 3 + 1] = col[o * 3 + 2] = s;
      if (U) { uv[o * 2] = U.getX(i); uv[o * 2 + 1] = U.getY(i); }
    }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}
const UP = new THREE.Vector3(0, 1, 0);
// Matrix für ein Teil: Position p, Richtung dir (zeigt die y-Achse hin), Größe s
const place = (p, dir, s) => new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()), s);
const tipShade = (top) => (x, y) => Math.min(1, 0.55 + (y / top) * 0.5);     // Spitzen heller als der Fuß

// Leuchten in der eigenen Farbe: normalerweise leuchtet ein Material in EINER Farbe. Hier wird das Leuchten mit der
// Farbe jedes einzelnen Exemplars malgenommen – so leuchtet jede Koralle (und jeder Fisch) schwach in ihrer eigenen Farbe.
function glowTint(mat, strength) {
  mat.emissive = new THREE.Color(0xffffff); mat.emissiveIntensity = strength;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n  totalEmissiveRadiance *= vColor.rgb;\n#endif');
  };
  const key = (prev ? prev.toString().length : 0) + ':' + strength;
  mat.customProgramCacheKey = () => 'glowTint' + key;
  return mat;
}
// ---------- die Korallen-Formen ----------
function pillarGeo() {       // Säulenkoralle: mehrere dicke, knubbelige Säulen mit runden Köpfen
  const R = seeded(31), parts = [];
  for (let i = 0; i < 5; i++) {
    const r = 0.07 + R() * 0.06, h = 0.5 + R() * 1.1, a = R() * TAU, d = i ? 0.08 + R() * 0.18 : 0;
    const p = new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d), dir = new THREE.Vector3((R() - 0.5) * 0.25, 1, (R() - 0.5) * 0.25);
    parts.push({ geo: new THREE.CylinderGeometry(r * 0.9, r, h, 7, 1, true).translate(0, h / 2, 0), m: place(p, dir, new THREE.Vector3(1, 1, 1)), shade: (x, y) => 0.55 + Math.min(0.45, y * 0.3) });
    parts.push({ geo: new THREE.SphereGeometry(r * 0.92, 7, 4), m: place(p.clone().addScaledVector(dir.clone().normalize(), h), dir, new THREE.Vector3(1, 1, 1)), shade: () => 1 });
  }
  return merge(parts);
}
function whipGeo() {         // Peitschenkoralle: lange, dünne, leicht gebogene Ruten
  const R = seeded(43), parts = [];
  for (let i = 0; i < 7; i++) {
    const a = R() * TAU, lean = 0.1 + R() * 0.35, h = 1.2 + R() * 1.4, segs = 5;
    let p = new THREE.Vector3(Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05);
    for (let k = 0; k < segs; k++) {
      const dir = new THREE.Vector3(Math.cos(a) * lean * (k / segs) * 1.5, 1, Math.sin(a) * lean * (k / segs) * 1.5).normalize(), len = h / segs, r = 0.025 * (1 - k / segs * 0.7);
      parts.push({ geo: new THREE.CylinderGeometry(r * 0.75, r, len, 4, 1, true).translate(0, len / 2, 0), m: place(p, dir, new THREE.Vector3(1, 1, 1)), shade: () => 0.5 + k / segs * 0.6 });
      p = p.clone().addScaledVector(dir, len);
    }
  }
  return merge(parts);
}
function barrelGeo() {       // Tonnenschwamm: große, oben offene Vase mit Rippen
  const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(new THREE.Vector2(0.25 + 0.35 * Math.sin(t * 1.9) + 0.03 * Math.sin(t * 40), t * 1.1)); }
  const g = new THREE.LatheGeometry(pts, 24), P = g.attributes.position, col = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), a = Math.atan2(z, x), rib = 1 + 0.06 * Math.sin(a * 12); P.setX(i, x * rib); P.setZ(i, z * rib); const s = 0.6 + P.getY(i) * 0.35; col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = s; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  return g;
}
function lettuceGeo() {      // Plattenkoralle (wie Salatblätter): mehrere gewellte Platten übereinander, mit hellem Rand
  const R = seeded(23), parts = [];
  for (let i = 0; i < 6; i++) {
    const r = 0.3 + R() * 0.35, g = new THREE.CircleGeometry(r, 18, 0, TAU), P = g.attributes.position;
    for (let k = 0; k < P.count; k++) { const x = P.getX(k), y = P.getY(k), d = Math.hypot(x, y) / r, a = Math.atan2(y, x); P.setZ(k, Math.sin(a * 7 + i) * 0.05 * d + d * d * 0.08); }
    g.rotateX(-Math.PI / 2); g.computeVertexNormals();
    const a = R() * TAU, off = i ? 0.15 + R() * 0.3 : 0;
    parts.push({ geo: g, m: new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * off, 0.12 + i * 0.07 + R() * 0.05, Math.sin(a) * off), new THREE.Quaternion().setFromEuler(new THREE.Euler((R() - 0.5) * 0.4, R() * TAU, (R() - 0.5) * 0.4)), new THREE.Vector3(1, 1, 1)),
      shade: (x, y, z) => Math.min(1.25, 0.6 + Math.hypot(x - Math.cos(a) * off, z - Math.sin(a) * off) / r * 0.65) });   // Rand heller
  }
  parts.push({ geo: new THREE.CylinderGeometry(0.06, 0.12, 0.3, 8).translate(0, 0.12, 0), m: new THREE.Matrix4(), shade: () => 0.5 });
  return merge(parts);
}
function staghornGeo() {     // Geweihkoralle: Äste, die sich immer wieder teilen
  const R = seeded(5), parts = [], cyl = new THREE.CylinderGeometry(0.55, 1, 1, 6, 1, true).translate(0, 0.5, 0), tip = new THREE.ConeGeometry(0.55, 0.6, 6).translate(0, 0.3, 0);
  const branch = (p, dir, len, r, depth) => {
    parts.push({ geo: cyl, m: place(p, dir, new THREE.Vector3(r, len, r)), shade: tipShade(1.4) });
    const end = p.clone().addScaledVector(dir, len);
    if (depth >= 3) { parts.push({ geo: tip, m: place(end, dir, new THREE.Vector3(r, r, r)), shade: () => 1 }); return; }
    const n = 2 + (R() < 0.15 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const a = R() * TAU, tilt = 0.35 + R() * 0.45;
      const d = dir.clone().applyAxisAngle(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), tilt).normalize();
      branch(end, d, len * (0.7 + R() * 0.15), r * 0.7, depth + 1);
    }
  };
  for (let k = 0; k < 3; k++) { const a = k / 3 * TAU; branch(new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a) * 0.35, 1, Math.sin(a) * 0.35).normalize(), 0.45, 0.07, 0); }
  return merge(parts);
}
function brainGeo() {        // Hirnkoralle: Halbkugel mit gewundenen Rillen
  const g = new THREE.SphereGeometry(1, 40, 20, 0, TAU, 0, Math.PI / 2), P = g.attributes.position, col = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const groove = Math.sin(x * 16 + Math.sin(z * 9) * 2.4) * Math.cos(z * 14 + Math.sin(x * 7) * 2.1);
    const k = 1 + 0.045 * groove;
    P.setXYZ(i, x * k, y * k * 0.62, z * k);
    const s = 0.62 + 0.38 * (groove * 0.5 + 0.5); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = s;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  return g;
}
function tableGeo() {        // Tischkoralle: flache Platte auf einem kurzen Stiel
  const parts = [], Y = new THREE.Vector3(0, 1, 0), o = new THREE.Vector3();
  parts.push({ geo: new THREE.CylinderGeometry(0.1, 0.16, 0.5, 12).translate(0, 0.25, 0), m: new THREE.Matrix4(), shade: () => 0.6 });
  parts.push({ geo: new THREE.CylinderGeometry(1, 0.8, 0.1, 40), m: place(o.set(0, 0.52, 0), Y, new THREE.Vector3(1, 1, 1)), shade: (x, y, z) => 0.7 + Math.hypot(x, z) * 0.3 });
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; parts.push({ geo: new THREE.SphereGeometry(0.08, 5, 3), m: place(new THREE.Vector3(Math.cos(a) * 0.97, 0.56, Math.sin(a) * 0.97), Y, new THREE.Vector3(1, 0.7, 1)), shade: () => 1 }); }
  return merge(parts);
}
function tubesGeo() {        // Röhrenschwämme: mehrere oben offene Röhren
  const R = seeded(9), parts = [];
  for (let i = 0; i < 6; i++) {
    const r = 0.08 + R() * 0.08, h = 0.4 + R() * 0.9, a = R() * TAU, d = i ? 0.12 + R() * 0.2 : 0;
    const geo = new THREE.CylinderGeometry(r * 1.2, r, h, 8, 1, true).translate(0, h / 2, 0);
    const dir = new THREE.Vector3((R() - 0.5) * 0.3, 1, (R() - 0.5) * 0.3);
    parts.push({ geo, m: place(new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d), dir, new THREE.Vector3(1, 1, 1)), shade: tipShade(1.3) });
    parts.push({ geo: new THREE.TorusGeometry(r * 1.2, 0.018, 4, 12).rotateX(Math.PI / 2).translate(0, h, 0), m: place(new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d), dir, new THREE.Vector3(1, 1, 1)), shade: () => 1 });
  }
  return merge(parts);
}
function anemoneGeo() {      // Anemone: dicker Fuß und viele Fangarme (die sich im Wasser wiegen)
  const R = seeded(13), parts = [], tent = new THREE.CylinderGeometry(0.006, 0.026, 0.4, 4, 2).translate(0, 0.2, 0);
  parts.push({ geo: new THREE.CylinderGeometry(0.17, 0.2, 0.22, 20).translate(0, 0.11, 0), m: new THREE.Matrix4(), shade: () => 0.55 });
  for (let i = 0; i < 26; i++) {
    const a = R() * TAU, rr = Math.sqrt(R()) * 0.16, out = rr / 0.16;
    const dir = new THREE.Vector3(Math.cos(a) * (0.2 + out), 1, Math.sin(a) * (0.2 + out));
    parts.push({ geo: tent, m: place(new THREE.Vector3(Math.cos(a) * rr, 0.21, Math.sin(a) * rr), dir, new THREE.Vector3(1, 0.7 + R() * 0.6, 1)), shade: (x, y) => Math.min(1, 0.5 + (y - 0.2) * 1.6) });
  }
  return merge(parts);
}
function fanGeo() {          // Fächerkoralle: flaches Netz (die Löcher kommen aus der Textur)
  const g = new THREE.PlaneGeometry(1.6, 1.5, 1, 1).translate(0, 0.75, 0);
  const col = new Float32Array(g.attributes.position.count * 3).fill(1); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

// ---------- kleine Schwarmfische ----------
export function schoolFishGeo() {
  // Körper: ein gedrehtes Profil (wie beim Töpfern), seitlich etwas flacher; Nase vorne (-z), Schwanz hinten (+z)
  const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector2(Math.max(0.002, 0.11 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.08)), 0.75)), t)); }
  const body = new THREE.LatheGeometry(pts, 8).rotateX(Math.PI / 2).translate(0, 0, -0.5);
  body.scale(0.55, 1, 1);
  const tail = new THREE.BufferGeometry(); tail.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.42, 0, 0.13, 0.68, 0, -0.13, 0.68], 3)); tail.computeVertexNormals();
  const geo = merge([{ geo: body, m: new THREE.Matrix4(), shade: (x, y) => y > 0.01 ? 0.35 : 1 }, { geo: tail, m: new THREE.Matrix4(), shade: () => 0.6 }]);
  geo.scale(0.32, 0.32, 0.32);
  return geo;
}

// root = Gruppe der Welt, W = die Welt (shared.js), decorate(mat) = fügt Lichtmuster (Kaustik) hinzu, uTime = Zeit für Shader
export function buildReef(root, W, decorate, uTime) {
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3(), C = new THREE.Color();
  const poreTex = pores(), fanTex = fanLattice();
  const kinds = [
    { geo: staghornGeo(), mat: decorate(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, bumpMap: poreTex, bumpScale: 0.8 })), s: [0.7, 1.4] },
    { geo: brainGeo(),    mat: decorate(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, bumpMap: poreTex, bumpScale: 0.6 })), s: [0.35, 0.9] },
    { geo: tableGeo(),    mat: decorate(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, bumpMap: poreTex, bumpScale: 0.6 })), s: [0.6, 1.4] },
    // Fächerkorallen und Anemonen leuchten schwach (Biolumineszenz) – im Dunkeln sieht man sie noch
    { geo: fanGeo(),      mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, map: fanTex, alphaTest: 0.35, side: THREE.DoubleSide, emissive: WARM_GLOW, emissiveIntensity: 0.35, emissiveMap: fanTex }), s: [0.7, 1.5] },
    { geo: tubesGeo(),    mat: decorate(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide, bumpMap: poreTex, bumpScale: 0.5 })), s: [0.6, 1.3] },
    { geo: anemoneGeo(),  mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, emissive: 0xffa040, emissiveIntensity: 0.3 }), s: [0.7, 1.3] },
    { geo: lettuceGeo(),  mat: decorate(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide, bumpMap: poreTex, bumpScale: 0.6 })), s: [0.8, 1.7] },
    { geo: pillarGeo(),   mat: decorate(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, bumpMap: poreTex, bumpScale: 1.0 })), s: [0.7, 1.4] },
    { geo: whipGeo(),     mat: decorate(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 })), s: [0.7, 1.3] },
    { geo: barrelGeo(),   mat: decorate(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide, bumpMap: poreTex, bumpScale: 1.4 })), s: [0.6, 1.4] },
  ];
  // Anemonen-Fangarme wiegen sich: im Shader werden die oberen Punkte hin und her geschoben
  kinds[5].mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float h = max(0.0, position.y - 0.21);
        #ifdef USE_INSTANCING
          float ph = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.4;
        #else
          float ph = 0.0;
        #endif
        transformed.x += sin(uTime * 1.6 + ph + position.z * 9.0) * h * h * 1.4;
        transformed.z += cos(uTime * 1.3 + ph + position.x * 9.0) * h * h * 1.1;`);
  };
  // Positionen: rund um jede vorhandene Koralle ein paar neue (immer gleich, weil der Zufall einen festen Startwert hat)
  const G = W.mode === 'exp' ? 1 : REEF.brGlow;   // Battle Royale: Riff leuchtet stärker
  for (const t of [0, 1, 2, 4, 6, 7, 8, 9]) glowTint(kinds[t].mat, REEF.glow * G);   // Riffkorallen leuchten leicht in ihrer Farbe
  const spots = kinds.map(() => []);
  // ---------- Korallen-Berge (Positionen aus shared.js – der Server kennt sie, man kann nicht hindurch) ----------
  const mounds = W.reefMounds || [];
  if (mounds.length) {
    const mg = new THREE.SphereGeometry(1, 40, 26), MP = mg.attributes.position, mcol = new Float32Array(MP.count * 3);
    for (let i = 0; i < MP.count; i++) {
      let x = MP.getX(i), y = MP.getY(i), z = MP.getZ(i);
      const n = moundN(x, y, z);   // knubbelig
      x *= n; y *= n; z *= n;
      if (y < -0.25) y = -0.25 + (y + 0.25) * 0.25;   // unten flach (steht auf dem Boden)
      MP.setXYZ(i, x, y, z);
      const s = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(x * 6 + z * 5 + y * 3));   // Flecken: helle und dunkle Stellen
      mcol[i * 3] = mcol[i * 3 + 1] = mcol[i * 3 + 2] = s;
    }
    mg.setAttribute('color', new THREE.BufferAttribute(mcol, 3)); mg.computeVertexNormals();
    const mm = glowTint(decorate(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, bumpMap: poreTex, bumpScale: 1.6 })), REEF.moundGlow * G);
    const im = new THREE.InstancedMesh(mg, mm, mounds.length);
    mounds.forEach((m, i) => {
      im.setMatrixAt(i, M4.compose(V.set(m.x, m.y, m.z), Q.setFromEuler(E.set(0, m.rot, 0)), S.set(m.r * m.sx, m.r * m.sy, m.r * m.sz)));
      im.setColorAt(i, C.setHex(PAL[i % PAL.length]));
    });
    im.instanceColor.needsUpdate = true; root.add(im);
    // dicht bewachsen: Platten-, Hirn-, Tisch-Korallen und Röhrenschwämme auf der oberen Hälfte jedes Hügels
    mounds.forEach((m, i) => {
      const R = seeded(i * 6151 + 11), n = Math.round(Math.min(REEF.moundMax, m.r * REEF.mound) * QUAL), big = 0.7 + m.r * 0.12;   // auf großen Hügeln größere Korallen
      for (let k = 0; k < n; k++) {
        // Richtung auf dem Hügel (lokal, vor der Drehung), dann genau die Oberfläche in dieser Richtung nehmen
        const a = R() * TAU, up = 0.25 + R() * 0.75, h = Math.sqrt(1 - up * up), dx = Math.cos(a) * h, dz = Math.sin(a) * h, n = moundN(dx, up, dz) * 0.97;
        const cr = Math.cos(m.rot), sr = Math.sin(m.rot), lx = dx * n * m.r * m.sx, lz = dz * n * m.r * m.sz;
        const x = m.x + lx * cr + lz * sr, y = m.y + up * n * m.r * m.sy, z = m.z - lx * sr + lz * cr;
        const t = [6, 6, 6, 1, 2, 4, 3, 7, 8, 9, 7, 6][(R() * 12) | 0];
        const col = R() < REEF.colorful ? BRIGHT[(R() * BRIGHT.length) | 0] : PAL[(R() * PAL.length) | 0];
        spots[t].push({ x, y, z, s: (0.6 + R() * 0.8) * big, rot: R() * TAU, tilt: (1 - up) * 0.8 * (R() < 0.5 ? -1 : 1), col, light: 0.9 + R() * 0.3 });
      }
    });
  }
  // ---------- Steine und verwinkelte Felsplatten zwischen den Korallen ----------
  {
    const stoneTex = rock(), stoneMat = decorate(new THREE.MeshStandardMaterial({ color: 0x8a8070, roughness: 0.95, map: stoneTex, bumpMap: stoneTex, bumpScale: 2, flatShading: true }));
    const stoneGeo = new THREE.DodecahedronGeometry(1, 1);   // kantig, mit Flächen – wirkt wie gebrochener Fels
    const list = [];
    (W.reefSites || []).forEach((s, si) => {
      const R = seeded(si * 7331 + 1);
      for (let k = 0; k < REEF.stones * QUAL; k++) {
        const a = R() * TAU, d = Math.sqrt(R()) * 30, x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d, slab = R() < 0.3;
        const r = slab ? 0.6 + R() * 1.2 : 0.15 + R() * R() * 1.1;
        // Felsplatten: flach und schräg gestellt → Nischen und Spalten
        list.push({ x, y: W.heightAt(x, z) + r * (slab ? 0.25 : 0.2), z, sx: r * (slab ? 1.4 : 1), sy: r * (slab ? 0.25 : 0.6 + R() * 0.4), sz: r * (slab ? 0.9 : 1), rx: slab ? (R() - 0.5) * 1.2 : R(), ry: R() * TAU, rz: slab ? (R() - 0.5) * 1.2 : R() });
      }
    });
    const im = new THREE.InstancedMesh(stoneGeo, stoneMat, Math.max(1, list.length));
    list.forEach((p, i) => im.setMatrixAt(i, M4.compose(V.set(p.x, p.y, p.z), Q.setFromEuler(E.set(p.rx, p.ry, p.rz)), S.set(p.sx, p.sy, p.sz))));
    root.add(im);
  }
  // Plattenkorallen dicht an dicht in den Riffen (wie auf dem Foto), dazu Korallen auf den Höhlendächern
  const LET_COL = PAL;
  W.coral.forEach((c, i) => {
    if (i >= 480) return;   // nur Riff-Korallen
    const R = seeded(i * 4241 + 5);
    if (R() < 0.6) { const a = R() * TAU, d = 1 + R() * 3, x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
      spots[7 + ((R() * 3) | 0)].push({ x, y: W.heightAt(x, z) - 0.05, z, s: 0.7 + R() * 0.7, rot: R() * TAU, tilt: (R() - 0.5) * 0.2, col: PAL[(R() * PAL.length) | 0], light: 1 }); }
    for (let k = 0; k < REEF.lettuce; k++) { const a = R() * TAU, d = 0.6 + R() * 2.2, x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
      spots[6].push({ x, y: W.heightAt(x, z) - 0.05, z, s: 0.8 + R() * 0.9, rot: R() * TAU, tilt: (R() - 0.5) * 0.3, col: LET_COL[(R() * LET_COL.length) | 0], light: 0.9 + R() * 0.3 }); }
  });
  (W.caves || []).forEach((cv, i) => {
    const R = seeded(i * 977 + 3);
    for (let k = 0; k < 5; k++) { const a = R() * TAU, d = R() * cv.ring, t = [6, 0, 6, 2, 3][k];
      spots[t].push({ x: cv.x + Math.cos(a) * d, y: cv.top + cv.ring * 0.6, z: cv.z + Math.sin(a) * d, s: 0.8 + R() * 0.7, rot: R() * TAU, tilt: 0, col: PAL[(R() * PAL.length) | 0], light: 1 }); }
  });
  // die alten Korallen der Welt bekommen die neuen, schöneren Formen: Kugel → Hirnkoralle, Kegel → Geweihkoralle, Halbkreis → Fächerkoralle
  const BASE_KIND = [1, 0, 3], BASE_SCALE = [0.65, 0.8, 0.9];
  W.coral.forEach((c, i) => spots[BASE_KIND[c.type]].push({ x: c.x, y: c.y - 0.05, z: c.z, s: c.s * BASE_SCALE[c.type], rot: c.rot, tilt: 0, col: PAL[i % PAL.length], light: 1 }));
  W.coral.forEach((c, i) => {
    const R = seeded(i * 7919 + 13), pc = REEF.perCoral * QUAL, n = Math.floor(pc) + (R() < pc % 1 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const t = (R() * 6) | 0, a = R() * TAU, d = 0.8 + R() * 2.4;
      const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d, y = W.heightAt(x, z) - 0.05;
      const [s0, s1] = kinds[t].s, s = s0 + R() * (s1 - s0);
      spots[t].push({ x, y, z, s, rot: R() * TAU, tilt: (R() - 0.5) * 0.25, col: PAL[(R() * PAL.length) | 0], light: 0.8 + R() * 0.35 });
    }
  });
  // leuchtende Korallen (Fächerkorallen und Anemonen) als Lichtquellen für main.js: Position + Lichtfarbe (+ Helligkeit I)
  const glow = [];
  // ---------- scharfe Leuchtkorallen auf dem ganzen Boden (Positionen kommen aus shared.js, der Server kennt sie auch) ----------
  const GC_COL = [0x3ff5e0, 0x7dff6a, 0xb57bff];   // türkis, grün, violett
  const spikeGeo = (() => {   // ein Büschel spitzer Stacheln – man sieht, dass sie scharf sind
    const R = seeded(77), parts = [];
    parts.push({ geo: new THREE.SphereGeometry(0.16, 10, 6, 0, TAU, 0, Math.PI / 2), m: new THREE.Matrix4(), shade: () => 0.5 });
    for (let i = 0; i < 13; i++) {
      const a = R() * TAU, out = 0.15 + R() * 0.7, h = 0.45 + R() * 0.65;
      const cone = new THREE.ConeGeometry(0.035 + R() * 0.03, h, 6).translate(0, h / 2, 0);
      parts.push({ geo: cone, m: place(new THREE.Vector3(Math.cos(a) * 0.08, 0.05, Math.sin(a) * 0.08), new THREE.Vector3(Math.cos(a) * out, 1, Math.sin(a) * out), new THREE.Vector3(1, 1, 1)), shade: (x, y) => Math.min(1, 0.45 + y * 0.8) });
    }
    return merge(parts);
  })();
  GC_COL.forEach((col, ci) => {
    const list = (W.glowCorals || []).filter(c => c.col === ci); if (!list.length) return;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, color: col, emissive: col, emissiveIntensity: 0.9, roughness: 0.4 });
    const im = new THREE.InstancedMesh(spikeGeo, mat, list.length);
    list.forEach((c, i) => {
      im.setMatrixAt(i, M4.compose(V.set(c.x, c.y - 0.05, c.z), Q.setFromEuler(E.set(0, c.rot, 0)), S.set(c.s, c.s, c.s)));
      glow.push({ x: c.x, y: c.y + 0.6 * c.s, z: c.z, col, I: 20 });   // leuchten etwas stärker als Quallen (16)
    });
    root.add(im);
  });
  for (const p of spots[3]) glow.push({ x: p.x, y: p.y + 0.7 * p.s, z: p.z, col: WARM_GLOW });
  for (const p of spots[5]) glow.push({ x: p.x, y: p.y + 0.4 * p.s, z: p.z, col: WARM_GLOW });
  kinds.forEach((k, t) => {
    const list = spots[t]; if (!list.length) return;
    const im = new THREE.InstancedMesh(k.geo, k.mat, list.length);
    list.forEach((p, i) => {
      im.setMatrixAt(i, M4.compose(V.set(p.x, p.y, p.z), Q.setFromEuler(E.set(p.tilt, p.rot, p.tilt * 0.6)), S.set(p.s, p.s, p.s)));
      im.setColorAt(i, C.setHex(p.col).multiplyScalar(p.light));
    });
    im.instanceColor.needsUpdate = true;
    root.add(im);
  });

  // ---------- Fischschwärme ----------
  const anchors = [];
  (W.reefSites || []).forEach((s, i) => {   // um jedes Riff mehrere Schwärme
    const R = seeded(i * 131 + 9);
    for (let k = 0; k < REEF.schoolsPerReef; k++) {
      const a = R() * TAU, d = R() * 30, x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d;
      let y = W.heightAt(x, z);
      for (const m of W.reefMounds || []) if (Math.hypot(m.x - x, m.z - z) < m.r + 14) y = Math.max(y, m.y + m.r * m.sy);   // über die Berge
      anchors.push({ x, y, z });
    }
  });
  for (const c of W.coral) { if (anchors.length >= (W.reefSites || []).length * REEF.schoolsPerReef + REEF.extraSchools) break; if (anchors.every(a => Math.hypot(a.x - c.x, a.z - c.z) > 30)) anchors.push(c); }
  const N = anchors.length * Math.round(REEF.fishPerSchool * QUAL);
  const fishMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.45, side: THREE.DoubleSide });
  fishMat.onBeforeCompile = (sh) => {      // Schwanz schlägt hin und her
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float fph = instanceMatrix[3].x * 3.1 + instanceMatrix[3].y * 1.7;
        #else
          float fph = 0.0;
        #endif
        transformed.x += sin(uTime * 13.0 + fph + position.z * 14.0) * 0.035 * smoothstep(-0.05, 0.22, position.z);`);
  };
  const fish = new THREE.InstancedMesh(schoolFishGeo(), fishMat, Math.max(1, N));
  fish.count = N;
  glowTint(fishMat, REEF.fishGlow);   // Fische leuchten leicht in ihrer Farbe
  const tints = [0xffa040, 0xffd84d, 0xc86bff, 0xff7ab0, 0x9fc8e8, 0xffb060];   // Orange, Gelb, Lila, Pink wie Fahnenbarsche
  const members = [];
  anchors.forEach((a, si) => {
    const R = seeded(si * 31 + 7), tint = new THREE.Color(tints[si % tints.length]);
    const school = { ax: a.x, ay: a.y + 3 + R() * 3, az: a.z, rad: 6 + R() * 6, w: 0.08 + R() * 0.06, ph: R() * TAU };
    for (let i = 0; i < Math.round(REEF.fishPerSchool * QUAL); i++) {
      members.push({ school, ox: (R() - 0.5) * 6, oy: (R() - 0.5) * 2.4, oz: (R() - 0.5) * 6, ph: R() * TAU, s: 1.3 + R() * 0.8 });   // etwas größer, damit man sie sieht
      fish.setColorAt(members.length - 1, tint);
    }
  });
  if (fish.instanceColor) fish.instanceColor.needsUpdate = true;
  fish.frustumCulled = false;
  root.add(fish);
  const P0 = new THREE.Vector3(), P1 = new THREE.Vector3(), LM = new THREE.Matrix4(), UPV = new THREE.Vector3(0, 1, 0);
  const pathAt = (sc, t, out) => out.set(sc.ax + Math.cos(t * sc.w + sc.ph) * sc.rad, sc.ay + Math.sin(t * sc.w * 1.7 + sc.ph) * 1.5, sc.az + Math.sin(t * sc.w * 0.8 + sc.ph) * sc.rad);

  return {
    glow,
    update(t) {
      // jeder Fisch folgt der Bahn seines Schwarms, mit eigenem kleinen Versatz, und schaut in Schwimmrichtung
      for (let i = 0; i < members.length; i++) {
        const m = members[i], sc = m.school, lag = (m.oz * 0.35) / (sc.rad * sc.w);
        pathAt(sc, t - lag, P0); pathAt(sc, t - lag + 0.1, P1);
        const wob = Math.sin(t * 1.3 + m.ph) * 0.3;
        P0.x += m.ox + wob; P0.y += m.oy + Math.cos(t * 1.1 + m.ph) * 0.2; P0.z += m.oz * 0.4;
        P1.x += m.ox + wob; P1.y += m.oy; P1.z += m.oz * 0.4;
        // lookAt richtet die z-Achse vom Ziel weg aus (z = P0 − P1 = nach hinten). Unsere Fische schauen nach −z, also nach vorne zu P1.
        LM.lookAt(P0, P1, UPV); Q.setFromRotationMatrix(LM);
        fish.setMatrixAt(i, M4.compose(P0, Q, S.set(m.s, m.s, m.s)));
      }
      fish.instanceMatrix.needsUpdate = true;
    },
  };
}
