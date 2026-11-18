// Undernite – Deko auf dem Meeresboden (nur zum Anschauen, der Server kennt davon nur die Kollisionskugeln aus shared.js):
//   Schiffswrack (genau gebaut: Rumpf in zwei Teilen, Brücke, Schornstein, Masten, Anker mit Kette, Schraube, Bullaugen, Trümmer)
//   Containerfeld, Flugzeugwrack, Schwarze Raucher (mit Rauch), Pipeline, Walskelette
//   Kleinzeug am Boden: Kiesel, Seegras, Seeigel, Seesterne, Muscheln, Schwämme, Anemonen
// Das Kleinzeug wird nur in deiner Nähe gezeichnet (SCATTER.radius), sonst wäre es zu viel für die Grafikkarte.
import * as THREE from 'three';
import { rng, SURFACE } from './shared.js';

const TAU = Math.PI * 2;
// Wie viel Kleinzeug auf der ganzen Karte liegt (bei Grafik „hoch“) und bis wie weit weg man es sieht (Meter)
export const SCATTER = { radius: 95, pebbles: 26000, grass: 15000, urchins: 2600, stars: 2200, shells: 3600, sponges: 1400, anemones: 2400 };
let QUAL = 1;
export function setPropsQuality(q) { QUAL = q; }

// ---------- kleine Helfer ----------
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3(), E = new THREE.Euler(), UP = new THREE.Vector3(0, 1, 0), N = new THREE.Vector3();
function mesh(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz); parent.add(m); return m;
}
// Viele Einzelteile zu wenigen großen Formen verschmelzen (eine pro Material) – sonst muss die Grafikkarte
// hunderte kleine Teile einzeln zeichnen und das Spiel ruckelt. Linien und Teilchen bleiben, wie sie sind.
function bake(g) {
  g.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), rel = new THREE.Matrix4(), buckets = new Map(), keep = [];
  g.traverse(o => {
    if (o === g) return;
    if (o.isMesh && !o.isInstancedMesh) { if (!buckets.has(o.material)) buckets.set(o.material, []); buckets.get(o.material).push(o); }
    else if (o.isLine || o.isPoints || o.isInstancedMesh) keep.push(o);
  });
  for (const o of keep) { rel.multiplyMatrices(inv, o.matrixWorld); rel.decompose(o.position, o.quaternion, o.scale); }
  g.clear();
  for (const [mat, list] of buckets) {
    const parts = list.map(o => { const c = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); c.applyMatrix4(rel.multiplyMatrices(inv, o.matrixWorld)); return c; });
    let n = 0; for (const c of parts) n += c.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3).fill(1);
    let o = 0;
    for (const c of parts) {
      const k = c.attributes.position.count;
      pos.set(c.attributes.position.array, o * 3);
      if (c.attributes.normal) nor.set(c.attributes.normal.array, o * 3);
      if (c.attributes.uv) uv.set(c.attributes.uv.array, o * 2);
      if (c.attributes.color) col.set(c.attributes.color.array, o * 3);
      o += k;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (mat.vertexColors) geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.add(new THREE.Mesh(geo, mat));
  }
  for (const o of keep) g.add(o);
  return g;
}
function canvasTex(size, draw, rep = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// Rost: Stahlplatten mit Nähten und Nieten, orange-braune Flecken, Rostfahnen, die nach unten laufen
function rustTex(R) {
  return canvasTex(512, (c, n) => {
    c.fillStyle = '#8a8580'; c.fillRect(0, 0, n, n);
    for (let i = 0; i < 260; i++) { const x = R() * n, y = R() * n, r = 6 + R() * 40, g = c.createRadialGradient(x, y, 0, x, y, r);
      const col = R() < 0.5 ? '150,70,30' : R() < 0.5 ? '90,50,30' : '60,70,60';
      g.addColorStop(0, `rgba(${col},${0.25 + R() * 0.45})`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
    c.strokeStyle = 'rgba(30,22,18,0.55)'; c.lineWidth = 2;
    for (let y = 0; y < n; y += 64) { c.beginPath(); c.moveTo(0, y); c.lineTo(n, y); c.stroke(); }                // Plattennähte
    for (let y = 0; y < n; y += 64) for (let x = (y / 64 % 2) * 64; x < n; x += 128) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 64); c.stroke(); }
    c.fillStyle = 'rgba(40,28,20,0.7)';
    for (let y = 0; y < n; y += 64) for (let x = 4; x < n; x += 9) { c.beginPath(); c.arc(x, y + 5, 1.6, 0, TAU); c.fill(); }   // Nieten
    for (let i = 0; i < 120; i++) { const x = R() * n, y = R() * n, h = 20 + R() * 90, g = c.createLinearGradient(x, y, x, y + h);   // Rostfahnen
      g.addColorStop(0, 'rgba(140,60,25,0.55)'); g.addColorStop(1, 'rgba(140,60,25,0)'); c.fillStyle = g; c.fillRect(x, y, 2 + R() * 4, h); }
    for (let i = 0; i < 500; i++) { c.fillStyle = `rgba(230,225,210,${0.15 + R() * 0.4})`; c.beginPath(); c.arc(R() * n, R() * n, 0.8 + R() * 2.2, 0, TAU); c.fill(); }   // Seepocken
  });
}
function plankTex(R) {
  return canvasTex(256, (c, n) => {
    for (let y = 0; y < n; y += 16) { const v = 70 + R() * 40; c.fillStyle = `rgb(${v},${v * 0.82},${v * 0.6})`; c.fillRect(0, y, n, 16);
      c.fillStyle = 'rgba(20,15,10,0.8)'; c.fillRect(0, y, n, 1.5); for (let x = R() * 120; x < n; x += 80 + R() * 80) c.fillRect(x, y, 1.5, 16); }
    for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(${R() < 0.5 ? '40,60,40' : '20,20,20'},${0.2 + R() * 0.4})`; c.beginPath(); c.arc(R() * n, R() * n, 2 + R() * 14, 0, TAU); c.fill(); }   // Algen, Löcher
  });
}

// ---------- Schiffswrack ----------
// Rumpf: Querschnitte von hinten (t = 0) nach vorne (t = 1), Deck oben bei y = 0
const SHIP = { L: 36, B: 4.4, D: 5.2 };
const hullB = (t) => SHIP.B * (0.82 + 0.18 * Math.min(1, t / 0.15)) * (t > 0.62 ? Math.pow(Math.max(0, 1 - ((t - 0.62) / 0.38) ** 2), 0.7) : 1);
const hullD = (t) => SHIP.D * (1 - 0.4 * Math.pow(Math.max(0, (t - 0.8) / 0.2), 1.5));
function hullGeo(t0, t1, R, jagFront, jagBack) {
  const NS = 36, NA = 22, pos = [], uv = [], col = [], idx = [];
  const holes = Array.from({ length: 4 }, () => ({ t: t0 + R() * (t1 - t0), a: (R() - 0.5) * 2.2, r: 0.02 + R() * 0.03 }));
  const C = new THREE.Color(), RED = new THREE.Color(0x8a3422), TOP = new THREE.Color(0x5e5a55), RUST = new THREE.Color(0x9a5228);
  for (let i = 0; i <= NS; i++) {
    const t = t0 + (t1 - t0) * i / NS, x = (t - 0.5) * SHIP.L, b = hullB(t), d = hullD(t);
    for (let j = 0; j <= NA; j++) {
      const th = -Math.PI / 2 + Math.PI * j / NA, s = Math.sin(th), c = Math.cos(th);
      let xx = x;
      if (i === 0 && jagBack) xx += (R() - 0.3) * 1.8;
      if (i === NS && jagFront) xx -= (R() - 0.3) * 1.8;
      const y = -d * Math.pow(c, 0.42), z = b * s;
      pos.push(xx, y, z); uv.push(t * SHIP.L / 7, j / NA * 2.2);
      C.copy(y < -d * 0.62 ? RED : TOP).lerp(RUST, Math.max(0, Math.sin(xx * 1.7 + j) * 0.5 + (R() - 0.5) * 0.4));
      if (y > -0.35) C.multiplyScalar(0.8);                                                         // Kante oben dunkler
      for (const h of holes) if (Math.hypot(t - h.t, (th - h.a) * 0.05) < h.r) C.setRGB(0.02, 0.02, 0.025);   // Löcher im Rumpf
      col.push(C.r, C.g, C.b);
    }
  }
  for (let i = 0; i < NS; i++) for (let j = 0; j < NA; j++) { const a = i * (NA + 1) + j, b = a + 1, c = a + NA + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
function deckGeo(t0, t1) {
  const NS = 24, pos = [], uv = [], idx = [];
  for (let i = 0; i <= NS; i++) { const t = t0 + (t1 - t0) * i / NS, x = (t - 0.5) * SHIP.L, b = hullB(t) * 0.98; pos.push(x, 0, -b, x, 0, b); uv.push(t * SHIP.L / 5, 0, t * SHIP.L / 5, b * 2 / 5); }
  for (let i = 0; i < NS; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function buildShip(root, W, mat) {
  const R = rng(W.seed ^ 0x51f0a3);
  const wr = new THREE.Group(); wr.position.set(W.wreck.x, W.wreck.y + 2.0, W.wreck.z); wr.rotation.set(0, W.wreck.yaw, 0.28); root.add(wr);
  const hullM = mat(new THREE.MeshStandardMaterial({ vertexColors: true, map: rustTex(R), roughness: 0.85, metalness: 0.35, side: THREE.DoubleSide }));
  const steel = mat(new THREE.MeshStandardMaterial({ color: 0x6d6560, map: rustTex(R), roughness: 0.8, metalness: 0.4 }));
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.7, metalness: 0.5 });
  const deckM = mat(new THREE.MeshStandardMaterial({ color: 0xb0a090, map: plankTex(R), roughness: 0.95, side: THREE.DoubleSide }));
  const glassM = new THREE.MeshStandardMaterial({ color: 0x0b1418, emissive: 0x2fb8b0, emissiveIntensity: 0.0, roughness: 0.1, metalness: 0.6 });
  const brass = new THREE.MeshStandardMaterial({ color: 0x6a5a2a, roughness: 0.5, metalness: 0.8 });
  const box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 12), sph = new THREE.SphereGeometry(1, 14, 10);
  // hinterer Teil (mit Brücke) und vorderer Teil (abgebrochen, verdreht, tiefer eingesunken)
  const aft = new THREE.Group(); wr.add(aft);
  const bow = new THREE.Group(); bow.position.set(1.6, -0.9, 0.6); bow.rotation.set(0.12, 0.22, -0.18); wr.add(bow);
  mesh(aft, hullGeo(0, 0.55, R, true, false), hullM); mesh(aft, deckGeo(0, 0.55), deckM, 0, -0.02, 0);
  mesh(bow, hullGeo(0.58, 1, R, false, true), hullM); mesh(bow, deckGeo(0.58, 1), deckM, 0, -0.02, 0);
  // Heckspiegel (flache Platte hinten)
  { const pts = []; for (let j = 0; j <= 16; j++) { const th = -Math.PI / 2 + Math.PI * j / 16; pts.push(new THREE.Vector2(hullB(0) * Math.sin(th), -hullD(0) * Math.pow(Math.cos(th), 0.42))); }
    const sg = new THREE.ShapeGeometry(new THREE.Shape(pts)); sg.rotateY(Math.PI / 2); mesh(aft, sg, steel, -SHIP.L / 2, 0, 0).material.side = THREE.DoubleSide; }
  // Reling: Pfosten und Handlauf an beiden Seiten, einige fehlen (verrostet abgefallen)
  const rail = (grp, t0, t1) => { for (let t = t0; t < t1; t += 0.035) for (const s of [-1, 1]) { if (R() < 0.18) continue; const x = (t - 0.5) * SHIP.L, z = s * hullB(t) * 0.97;
    mesh(grp, cyl, steel, x, 0.55, z, 0, 0, 0, 0.04, 1.1, 0.04); if (R() < 0.8) { const t2 = t + 0.035, x2 = (t2 - 0.5) * SHIP.L, z2 = s * hullB(t2) * 0.97, l = Math.hypot(x2 - x, z2 - z);
      mesh(grp, box, steel, (x + x2) / 2, 1.1, (z + z2) / 2, 0, -Math.atan2(z2 - z, x2 - x), 0, l, 0.06, 0.06); } } };
  rail(aft, 0.02, 0.53); rail(bow, 0.6, 0.95);
  // Aufbauten: zwei Etagen mit Fensterreihen, Brückennock, Schornstein mit Streifen
  const sx = -SHIP.L * 0.28;
  mesh(aft, box, steel, sx, 1.6, 0, 0, 0, 0, 7, 3.2, 7.2);
  mesh(aft, box, steel, sx + 0.6, 4.4, 0, 0, 0, 0, 5.2, 2.4, 6.4);
  mesh(aft, box, steel, sx + 1.4, 4.9, 0, 0, 0, 0, 1.2, 0.4, 9.6);                        // Brückennock (seitlich überstehend)
  for (const [y, w, n] of [[2.2, 7.25, 6], [4.6, 6.45, 5]]) for (let k = 0; k < n; k++) for (const s of [-1, 1]) {
    mesh(aft, box, glassM, sx - 2.6 + k * (5.2 / (n - 1)) + (y > 3 ? 0.6 : 0), y, s * w / 2, 0, 0, 0, 0.7, 0.8, 0.06); }
  for (let k = 0; k < 5; k++) mesh(aft, box, glassM, sx + 3.25, 4.6, -2.4 + k * 1.2, 0, 0, 0, 0.06, 0.9, 0.9);   // Brückenfenster vorne
  const fun = mesh(aft, cyl, steel, sx - 1.8, 7.6, 0, 0, 0, -0.18, 1.1, 4.4, 1.3);
  mesh(aft, cyl, new THREE.MeshStandardMaterial({ color: 0x6a1a14, roughness: 0.8 }), sx - 2.25, 8.9, 0, 0, 0, -0.18, 1.13, 0.6, 1.33);   // roter Streifen
  mesh(aft, cyl, darkSteel, sx - 2.6, 9.8, 0, 0, 0, -0.18, 0.95, 0.1, 1.15);
  mesh(aft, cyl, steel, sx + 1.2, 7.4, 0, 0, 0, 0, 0.12, 3, 0.12);                        // Funkmast
  mesh(aft, box, steel, sx + 1.2, 8.4, 0, 0, 0, 0, 0.08, 0.08, 2.4);
  // Rettungsboot am Davit (hängt schief)
  mesh(aft, box, steel, sx - 1, 3.8, 4.1, 0, 0, 0.0, 0.15, 1.6, 0.15);
  const lb = new THREE.Mesh(new THREE.CapsuleGeometry(0.75, 3.2, 4, 10).rotateZ(Math.PI / 2), mat(new THREE.MeshStandardMaterial({ color: 0x9a5a2a, roughness: 0.8 })));
  lb.position.set(sx - 1, 2.7, 4.6); lb.rotation.set(0.5, 0, 0.15); aft.add(lb);
  // Ladeluken und ein Ladebaum auf dem Vorschiff, vorne ein Mast
  for (const t of [0.66, 0.78]) { const x = (t - 0.5) * SHIP.L; mesh(bow, box, steel, x, 0.45, 0, 0, 0, 0, 3.4, 0.9, 4.4); mesh(bow, box, darkSteel, x + 0.5, 0.92, 0.6, 0, 0.1, 0.05, 1.4, 0.06, 2.0); }
  const mx = (0.72 - 0.5) * SHIP.L;
  mesh(bow, cyl, steel, mx, 5, 0, 0, 0, 0.05, 0.22, 10, 0.22); mesh(bow, box, steel, mx, 8.2, 0, 0, 0, 0, 0.2, 0.2, 4.4);
  const boom = mesh(bow, cyl, steel, mx + 2.4, 2.2, 0.6, 0, 0.2, -1.05, 0.14, 5.4, 0.14);
  // Takelage: Drähte vom Mast zum Deck (als Linien)
  { const lp = [], top = new THREE.Vector3(mx, 9.6, 0); for (const [x, z] of [[mx - 6, -3], [mx - 6, 3], [mx + 6, -2.4], [mx + 6, 2.4]]) lp.push(top.x, top.y, top.z, x, 0.6, z);
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); bow.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x3a3430 }))); }
  // Bullaugen (Messingringe mit dunklem Glas) unter dem Deck
  const pr = new THREE.TorusGeometry(0.22, 0.05, 6, 14);
  for (let t = 0.08; t < 0.52; t += 0.045) for (const s of [-1, 1]) { const x = (t - 0.5) * SHIP.L, z = s * hullB(t) * 1.0;
    mesh(aft, pr, brass, x, -1.0, z, 0, Math.PI / 2, 0); mesh(aft, new THREE.CircleGeometry(0.2, 12), glassM, x, -1.0, z + s * 0.01, 0, s * Math.PI / 2, 0); }
  // Schiffsschraube und Ruder hinten
  const prop = new THREE.Group(); prop.position.set(-SHIP.L / 2 - 0.9, -SHIP.D * 0.62, 0); aft.add(prop);
  mesh(prop, sph, brass, 0, 0, 0, 0, 0, 0, 0.45);
  for (let k = 0; k < 4; k++) { const bl = mesh(prop, sph, brass, 0, Math.cos(k / 4 * TAU) * 0.9, Math.sin(k / 4 * TAU) * 0.9, k / 4 * TAU, 0.4, 0, 0.12, 0.95, 0.42); bl.rotation.order = 'XYZ'; }
  mesh(aft, box, steel, -SHIP.L / 2 - 1.8, -SHIP.D * 0.45, 0, 0, 0, 0.1, 1.6, 3.2, 0.25);
  mesh(aft, cyl, steel, -SHIP.L / 2 - 0.4, -SHIP.D * 0.62, 0, 0, 0, Math.PI / 2, 0.15, 1.2, 0.15);   // Welle
  // Anker am Bug, Kette führt zum Boden
  const anc = new THREE.Group(); anc.position.set(SHIP.L * 0.42, -1.6, hullB(0.92) + 0.4); bow.add(anc);
  mesh(anc, box, darkSteel, 0, -0.7, 0, 0, 0, 0, 0.18, 1.6, 0.18);
  mesh(anc, new THREE.TorusGeometry(0.6, 0.11, 6, 14, Math.PI), darkSteel, 0, -1.4, 0, 0, 0, Math.PI);
  for (const s of [-1, 1]) mesh(anc, new THREE.ConeGeometry(0.2, 0.5, 4), darkSteel, s * 0.62, -1.25, 0, 0, 0, s * 0.6);
  const link = new THREE.TorusGeometry(0.16, 0.05, 5, 10);
  for (let k = 0; k < 26; k++) { const f = k / 25; mesh(bow, link, darkSteel, SHIP.L * 0.42 + f * 3.5, -0.4 - f * 5.2 + Math.sin(f * Math.PI) * 0.8, hullB(0.92) + 0.4 + f * 1.4, 0, k % 2 ? Math.PI / 2 : 0, 0.6); }
  // Glühende Fenster bei manchen Bullaugen (wie bisher: geheimnisvoll beleuchtet)
  glassM.emissiveIntensity = 0.35;
  // abgerissene Bleche an der Bruchstelle und Trümmer am Boden
  for (let k = 0; k < 7; k++) { const t = 0.55 + (R() - 0.5) * 0.02, x = (t - 0.5) * SHIP.L; mesh(aft, box, hullM, x + R() * 0.8, -R() * 4, (R() - 0.5) * 7, R(), R(), R(), 1.2 + R() * 1.8, 0.05, 0.8 + R() * 1.4); }
  const debris = new THREE.Group(); root.add(debris);
  const barrelM = mat(new THREE.MeshStandardMaterial({ color: 0x8a5a24, map: rustTex(R), roughness: 0.8, metalness: 0.3 }));
  const ringM = new THREE.MeshStandardMaterial({ color: 0xd8501e, roughness: 0.7 });
  for (let k = 0; k < 22; k++) {
    const a = R() * TAU, d = 10 + R() * 22, x = W.wreck.x + Math.cos(a) * d, z = W.wreck.z + Math.sin(a) * d, y = W.heightAt(x, z);
    const kind = R();
    if (kind < 0.45) mesh(debris, box, hullM, x, y + 0.05, z, (R() - 0.5) * 0.4, R() * TAU, (R() - 0.5) * 0.4, 1 + R() * 2.5, 0.06, 0.8 + R() * 1.5);   // Blechplatte
    else if (kind < 0.8) mesh(debris, cyl, barrelM, x, y + 0.35, z, R() < 0.5 ? Math.PI / 2 : 0, R() * TAU, 0, 0.35, 0.95, 0.35);                    // Fass
    else if (kind < 0.9) mesh(debris, new THREE.TorusGeometry(0.42, 0.13, 8, 16), ringM, x, y + 0.13, z, Math.PI / 2, 0, R());                         // Rettungsring
    else mesh(debris, cyl, steel, x, y + 0.2, z, Math.PI / 2, R() * TAU, 0, 0.15, 3 + R() * 3, 0.15);                                                // Rohr
  }
  bake(wr); bake(debris);
}

// ---------- Containerfeld ----------
const CONT_COL = [0x8a2a20, 0x1f4a7a, 0x2a6a3a, 0xb8621a, 0x6a6a6a, 0x8a7a2a];
function buildContainers(root, W, mat) {
  if (!W.containers || !W.containers.length) return;
  const R = rng(W.seed ^ 0x2a7b11);
  // Wellblech: helle und dunkle Streifen (auch als Unebenheit), dazu Rost und Algen
  const corr = canvasTex(256, (c, n) => { for (let x = 0; x < n; x += 16) { const g = c.createLinearGradient(x, 0, x + 16, 0); g.addColorStop(0, '#b4b4b4'); g.addColorStop(0.5, '#f2f2f2'); g.addColorStop(1, '#a8a8a8'); c.fillStyle = g; c.fillRect(x, 0, 16, n); }
    for (let i = 0; i < 40; i++) { const x = R() * n, y = R() * n, r = 4 + R() * 22, g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${R() < 0.6 ? '120,60,25' : '40,70,40'},0.4)`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); } });
  corr.repeat.set(2, 1);
  const all = new THREE.Group(); root.add(all); const mats = {};
  const box = new THREE.BoxGeometry(1, 1, 1), bar = new THREE.CylinderGeometry(0.03, 0.03, 2.3, 6);
  const frameM = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.7, metalness: 0.5 }), darkIn = new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 1, side: THREE.BackSide });
  for (const c of W.containers) {
    const g = new THREE.Group(); g.position.set(c.x, c.y + 1.3, c.z); g.rotation.set(c.tilt, c.yaw, c.tilt * 0.5); all.add(g);
    const m = mats[c.col] || (mats[c.col] = mat(new THREE.MeshStandardMaterial({ color: CONT_COL[c.col], map: corr, roughness: 0.7, metalness: 0.35 })));
    mesh(g, box, m, 0, 0, 0, 0, 0, 0, 6.06, 2.59, 2.44);
    if (c.open) { mesh(g, box, darkIn, 3.0, 0, 0, 0, 0, 0, 0.1, 2.4, 2.25); for (const s of [-1, 1]) mesh(g, box, m, 3.05 + 0.9, 0, s * 1.15 + s * 0.4, 0, s * 1.1, 0, 0.05, 2.45, 1.2); }   // Türen aufgeschwungen
    else for (let k = 0; k < 4; k++) mesh(g, bar, frameM, 3.06, 0, -0.9 + k * 0.6);   // Verriegelungsstangen an den Türen
    for (const x of [-3, 3]) for (const y of [-1.25, 1.25]) for (const z of [-1.17, 1.17]) mesh(g, box, frameM, x, y, z, 0, 0, 0, 0.18, 0.18, 0.18);   // Eckbeschläge
  }
  bake(all);
}

// ---------- Flugzeugwrack ----------
function buildPlane(root, W, mat) {
  const P = W.plane; if (!P) return;
  const R = rng(W.seed ^ 0x6c11ee);
  const skin = canvasTex(256, (c, n) => { c.fillStyle = '#d8d8d4'; c.fillRect(0, 0, n, n);
    for (let y = 0; y < n; y += 32) { c.fillStyle = 'rgba(80,80,80,0.5)'; c.fillRect(0, y, n, 1); for (let x = 0; x < n; x += 5) c.fillRect(x, y + 3, 1.5, 1.5); }
    for (let i = 0; i < 160; i++) { const x = R() * n, y = R() * n, r = 4 + R() * 30, g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${R() < 0.5 ? '60,90,50' : '110,90,60'},0.55)`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); } });
  const alu = mat(new THREE.MeshStandardMaterial({ color: 0xc8ccd0, map: skin, roughness: 0.55, metalness: 0.6, side: THREE.DoubleSide }));
  const dark = new THREE.MeshStandardMaterial({ color: 0x16191c, roughness: 0.6, metalness: 0.4 });
  const stripe = new THREE.MeshStandardMaterial({ color: 0x1d3f7a, roughness: 0.6 });
  const g = new THREE.Group(); g.position.set(P.x, P.y + 1.5, P.z); g.rotation.set(0, P.yaw, P.roll); root.add(g);
  const fus = new THREE.CylinderGeometry(1.7, 1.7, 1, 24, 1, true).rotateZ(Math.PI / 2);
  mesh(g, fus, alu, -1, 0, 0, 0, 0, 0, 12, 1, 1);                                            // vorderer Rumpf
  mesh(g, new THREE.SphereGeometry(1.7, 24, 14, 0, TAU, 0, Math.PI / 2).rotateZ(-Math.PI / 2), alu, 5, 0, 0, 0, 0, 0, 1.8, 1, 1);   // Nase
  for (let k = 0; k < 4; k++) mesh(g, new THREE.BoxGeometry(0.5, 0.35, 0.05), dark, 6.4 + k * 0.05, 0.95, -0.9 + k * 0.6, 0, 0, -0.5);   // Cockpitfenster
  for (let k = 0; k < 9; k++) for (const s of [-1, 1]) mesh(g, new THREE.BoxGeometry(0.35, 0.45, 0.05), dark, -6 + k * 1.2, 0.6, s * 1.69);   // Fensterreihe
  mesh(g, new THREE.CylinderGeometry(1.71, 1.71, 1, 24, 1, true).rotateZ(Math.PI / 2), stripe, -1, 0, 0, 0, 0, 0, 12, 0.18, 1.0).position.y = -0.2;
  // Flügel mit Motoren (einer abgebrochen)
  const wing = new THREE.BoxGeometry(2.6, 0.22, 1);
  for (const s of [-1, 1]) {
    const len = s > 0 ? 12 : 6.5, w = mesh(g, wing, alu, 0.5, -0.6, s * (1.6 + len / 2), 0, 0, s * 0.04, 1, 1, len);
    if (s < 0) w.rotation.x = 0.25;
    const ez = s * (1.6 + Math.min(len, 5) * 0.75);
    mesh(g, new THREE.CylinderGeometry(0.65, 0.55, 3, 14).rotateZ(Math.PI / 2), alu, 1, -1.1, ez);
    mesh(g, new THREE.CylinderGeometry(0.5, 0.5, 0.1, 14).rotateZ(Math.PI / 2), dark, 2.55, -1.1, ez);
    for (let k = 0; k < 3; k++) mesh(g, new THREE.BoxGeometry(0.06, 1.3, 0.22), dark, 2.65, -1.1, ez, k / 3 * TAU, 0, 0.3);   // Propeller (verbogen)
  }
  // abgebrochenes Heck, liegt verdreht daneben
  const tail = new THREE.Group(); tail.position.set(-9.5, -0.6, 1.2); tail.rotation.set(0.3, P.tailYaw, 0.15); g.add(tail);
  mesh(tail, new THREE.CylinderGeometry(1.0, 1.65, 1, 20, 1, true).rotateZ(Math.PI / 2), alu, -3, 0, 0, 0, 0, 0, 6, 1, 1);
  mesh(tail, new THREE.BoxGeometry(2.4, 3, 0.15), alu, -5.4, 1.8, 0, 0, 0, -0.35);            // Seitenleitwerk
  mesh(tail, new THREE.BoxGeometry(1.8, 0.12, 5.6), alu, -5.5, 0.4, 0);                     // Höhenleitwerk
  mesh(tail, new THREE.BoxGeometry(0.9, 0.6, 0.16), stripe, -5.2, 2.2, 0.09, 0, 0, -0.35);
  bake(g);
}

// ---------- Schwarze Raucher ----------
function buildVents(root, W, mat) {
  if (!W.vents || !W.vents.length) return null;
  const R = rng(W.seed ^ 0x77a1c3);
  const vg = new THREE.CylinderGeometry(0.55, 1, 1, 12, 8).translate(0, 0.5, 0), vp = vg.attributes.position;
  for (let i = 0; i < vp.count; i++) { const x = vp.getX(i), y = vp.getY(i), z = vp.getZ(i), n = 1 + 0.25 * Math.sin(y * 13 + x * 5) * Math.cos(z * 6 + y * 4) + 0.12 * Math.sin(y * 31); vp.setXYZ(i, x * n, y, z * n); }
  vg.computeVertexNormals();
  const rockM = mat(new THREE.MeshStandardMaterial({ color: 0x3a3230, roughness: 0.95, metalness: 0.1 }));
  const hotM = new THREE.MeshStandardMaterial({ color: 0xff7a2a, emissive: 0xff5a10, emissiveIntensity: 1.6, roughness: 0.6 });
  const whiteM = new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.6 }), redM = new THREE.MeshStandardMaterial({ color: 0xd82a2a, roughness: 0.5 });
  const smokeSrc = [], vgp = new THREE.Group(); root.add(vgp);
  for (const v of W.vents) {
    mesh(vgp, vg, rockM, v.x, v.y, v.z, (R() - 0.5) * 0.15, R() * TAU, (R() - 0.5) * 0.15, v.r, v.h, v.r);
    mesh(vgp, new THREE.CylinderGeometry(0.4, 0.5, 0.25, 10), hotM, v.x, v.y + v.h - 0.05, v.z, 0, 0, 0, v.r * 0.9, 1, v.r * 0.9);   // glühende Öffnung
    // Röhrenwürmer am Fuß: weiße Röhren mit roten Federbüscheln
    for (let k = 0; k < 14; k++) { const a = R() * TAU, d = v.r * (1.1 + R() * 1.2), x = v.x + Math.cos(a) * d, z = v.z + Math.sin(a) * d, y = W.heightAt(x, z), h = 0.6 + R() * 1.2;
      mesh(vgp, new THREE.CylinderGeometry(0.06, 0.08, h, 6), whiteM, x, y + h / 2, z, (R() - 0.5) * 0.3, 0, (R() - 0.5) * 0.3);
      mesh(vgp, new THREE.SphereGeometry(0.12, 8, 6), redM, x, y + h + 0.05, z, 0, 0, 0, 1, 0.7, 1); }
    smokeSrc.push({ x: v.x, y: v.y + v.h, z: v.z, r: v.r });
  }
  bake(vgp);
  // Rauch: dunkle Wolken-Teilchen steigen auf, werden größer und blasser
  const NP = 70 * smokeSrc.length, arr = new Float32Array(NP * 3), size = new Float32Array(NP), alpha = new Float32Array(NP), life = new Float32Array(NP), src = new Uint8Array(NP);
  for (let i = 0; i < NP; i++) { src[i] = i % smokeSrc.length; life[i] = Math.random() * 6; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(arr, 3)); geo.setAttribute('size', new THREE.BufferAttribute(size, 1)); geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
  const tex = canvasTex(64, (c, n) => { const g = c.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, n, n); });
  const pm = new THREE.ShaderMaterial({ uniforms: { map: { value: tex } }, transparent: true, depthWrite: false,
    vertexShader: 'attribute float size; attribute float alpha; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * 600.0 / max(0.1,-mv.z); vA = alpha; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform sampler2D map; varying float vA; void main(){ float a = texture2D(map, gl_PointCoord).a * vA; gl_FragColor = vec4(0.05, 0.045, 0.04, a); }' });
  const pts = new THREE.Points(geo, pm); pts.frustumCulled = false; root.add(pts);
  return (dt) => {
    for (let i = 0; i < NP; i++) {
      life[i] += dt; const L = 6;
      if (life[i] > L) life[i] -= L;
      const s = smokeSrc[src[i]], k = life[i] / L, ph = i * 1.7;
      arr[i * 3] = s.x + Math.sin(ph + k * 4) * k * 2.5; arr[i * 3 + 1] = s.y + k * 18; arr[i * 3 + 2] = s.z + Math.cos(ph + k * 3) * k * 2.5;
      size[i] = s.r * (0.6 + k * 4); alpha[i] = Math.min(1, k * 8) * (1 - k) * 0.55;
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.size.needsUpdate = true; geo.attributes.alpha.needsUpdate = true;
  };
}

// ---------- Pipeline ----------
function buildPipe(root, W, mat) {
  if (!W.pipe || W.pipe.length < 4) return;
  const pts = W.pipe.filter((p, i) => i % 3 === 0 || i === W.pipe.length - 1).map(p => new THREE.Vector3(p.x, p.y, p.z));
  const curve = new THREE.CatmullRomCurve3(pts);
  const tex = canvasTex(256, (c, n) => { c.fillStyle = '#b8a878'; c.fillRect(0, 0, n, n); const R = rng(W.seed ^ 0x9911);
    for (let i = 0; i < 200; i++) { const x = R() * n, y = R() * n, r = 3 + R() * 24, g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${R() < 0.5 ? '50,80,40' : '90,70,40'},0.55)`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); } });
  tex.repeat.set(pts.length * 2, 1);
  const m = mat(new THREE.MeshStandardMaterial({ color: 0xc8b890, map: tex, roughness: 0.85, metalness: 0.2 }));
  root.add(new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 4, 0.8, 12, false), m));
  const fl = new THREE.TorusGeometry(0.86, 0.12, 6, 18), steel = new THREE.MeshStandardMaterial({ color: 0x4a4440, roughness: 0.7, metalness: 0.5 }), sup = new THREE.BoxGeometry(0.5, 1, 2.2);
  const P = new THREE.Vector3(), T = new THREE.Vector3(), n = Math.floor(curve.getLength() / 12);
  const flI = new THREE.InstancedMesh(fl, steel, n), supI = new THREE.InstancedMesh(sup, steel, n);
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n; curve.getPointAt(u, P); curve.getTangentAt(u, T);
    const yaw = Math.atan2(-T.z, T.x);
    Q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), T); flI.setMatrixAt(i, M4.compose(P, Q, SC.set(1, 1, 1)));
    const gy = W.heightAt(P.x, P.z), h = Math.max(0.3, P.y - 0.8 - gy + 0.3);
    Q.setFromEuler(E.set(0, yaw, 0)); supI.setMatrixAt(i, M4.compose(V.set(P.x, gy + h / 2 - 0.2, P.z), Q, SC.set(1, h, 1)));
  }
  root.add(flI, supI);
}

// ---------- Walskelette ----------
function buildWhales(root, W, mat, exp) {
  const R = rng(W.seed ^ 0x4b0e5), lim = exp ? 250 : W.lim - 40;
  const bone = mat(new THREE.MeshStandardMaterial({ color: 0xe0d8c4, roughness: 0.8 }));
  const vert = new THREE.CylinderGeometry(0.28, 0.28, 0.45, 10).rotateZ(Math.PI / 2), rib = new THREE.TorusGeometry(1, 0.08, 6, 16, Math.PI * 0.85);
  for (let n = 0; n < (exp ? 1 : 3); n++) {
    const x = (R() * 2 - 1) * lim, z = (R() * 2 - 1) * lim, y = W.heightAt(x, z);
    if (exp && y < -40) continue;
    const g = new THREE.Group(); g.position.set(x, y + 0.5, z); g.rotation.set(0, R() * TAU, (R() - 0.5) * 0.3); root.add(g);
    // Schädel: lang und flach, vorne spitz
    mesh(g, new THREE.SphereGeometry(1, 16, 10), bone, 4.8, 0.2, 0, 0, 0, 0, 3.2, 0.7, 1.4);
    mesh(g, new THREE.ConeGeometry(0.9, 3.4, 10).rotateZ(-Math.PI / 2), bone, 8.6, 0.1, 0, 0, 0, 0, 1, 0.5, 1);
    for (const s of [-1, 1]) mesh(g, new THREE.CylinderGeometry(0.15, 0.1, 6.5, 8).rotateZ(Math.PI / 2), bone, 6.4, -0.3, s * 1.1, 0, s * 0.12, 0.08);   // Unterkiefer
    // Wirbelsäule (wird nach hinten kleiner und senkt sich zum Boden) und Rippen
    for (let k = 0; k < 30; k++) { const f = k / 29, s = 1 - f * 0.75; mesh(g, vert, bone, 2.4 - k * 0.55, 0.5 - f * f * 0.6, Math.sin(f * 3) * 0.6, 0, 0, 0, 1, s, s); }
    for (let k = 0; k < 12; k++) { const x0 = 1.8 - k * 0.6, r = 1.9 - k * 0.08; if (R() < 0.15) continue;
      for (const s of [-1, 1]) { const rb = mesh(g, rib, bone, x0, 0.5 - r * 0.15, 0, 0, 0, 0, r, r * 0.9, r); rb.rotation.set(0, s > 0 ? 0 : Math.PI, 0); rb.rotation.order = 'YXZ'; rb.rotation.x = Math.PI / 2 + 0.15; rb.rotation.z = -Math.PI / 2 + s * 0.2; } }
    bake(g);
  }
}

// ---------- Kleinzeug am Boden ----------
function makeKinds() {
  const merge = (list) => {   // mehrere Formen zu einer verbinden
    const geos = list.map(([g, m]) => { const c = g.index ? g.toNonIndexed() : g.clone(); c.applyMatrix4(m); c.deleteAttribute('uv'); return c; });
    let n = 0; for (const g of geos) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
    for (const g of geos) { pos.set(g.attributes.position.array, o); nor.set(g.attributes.normal.array, o); o += g.attributes.position.count * 3; }
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); return out;
  };
  const mk = (x, y, z, rx, ry, rz, sx, sy, sz) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy ?? sx, sz ?? sx));
  // Kiesel: unregelmäßige, flache Steine
  const peb = new THREE.IcosahedronGeometry(1, 1), pp = peb.attributes.position;
  for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i), k = 1 + 0.2 * Math.sin(x * 4 + z * 3); pp.setXYZ(i, x * k, y * k * 0.55, z * k); }
  peb.computeVertexNormals();
  // Seegras: 7 gebogene Halme
  const blade = new THREE.PlaneGeometry(0.06, 1, 1, 4).translate(0, 0.5, 0), bp = blade.attributes.position;
  for (let i = 0; i < bp.count; i++) { const y = bp.getY(i); bp.setX(i, bp.getX(i) * (1 - y * 0.8)); bp.setZ(i, y * y * 0.25); }
  const grass = merge(Array.from({ length: 7 }, (_, k) => [blade, mk(Math.cos(k * 2.4) * 0.12, 0, Math.sin(k * 2.4) * 0.12, 0, k * 2.4, 0, 1, 0.6 + (k % 3) * 0.25, 1)]));
  // Seeigel: Kugel mit vielen Stacheln
  const spikes = [[new THREE.SphereGeometry(1, 10, 8), mk(0, 0, 0, 0, 0, 0, 1, 0.75, 1)]], cone = new THREE.ConeGeometry(0.07, 1.6, 4).translate(0, 0.8, 0);
  for (let k = 0; k < 34; k++) { const y = 1 - (k + 0.5) / 34 * 1.3, r = Math.sqrt(Math.max(0, 1 - y * y)), a = k * 2.4; const d = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r).normalize();
    spikes.push([cone, new THREE.Matrix4().compose(d.clone().multiplyScalar(0.8), new THREE.Quaternion().setFromUnitVectors(UP, d), new THREE.Vector3(1, 1, 1))]); }
  const urchin = merge(spikes);
  // Seestern: 5 Arme
  const sp = []; for (let k = 0; k <= 10; k++) { const a = k / 10 * TAU, r = k % 2 ? 0.38 : 1; sp.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r)); }
  const star = new THREE.ExtrudeGeometry(new THREE.Shape(sp), { depth: 0.12, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.1, bevelSegments: 2 }); star.rotateX(-Math.PI / 2); star.deleteAttribute('uv');
  // Muschel: halbe, flache, gerippte Kugel
  const shell = new THREE.SphereGeometry(1, 16, 6, 0, Math.PI, 0, Math.PI / 2), shp = shell.attributes.position;
  for (let i = 0; i < shp.count; i++) { const x = shp.getX(i), y = shp.getY(i), z = shp.getZ(i), a = Math.atan2(z, x), k = 1 + 0.06 * Math.cos(a * 18); shp.setXYZ(i, x * k, y * 0.35, z * k); }
  shell.computeVertexNormals();
  // Fassschwamm: dicker Becher, oben offen
  const sponge = new THREE.LatheGeometry([0.3, 0.55, 0.75, 0.85, 0.8, 0.6, 0.55].map((r, i) => new THREE.Vector2(r, i * 0.25)), 12);
  // Anemone: Fuß mit Tentakeln oben (die Spitzen wiegen sich im Shader)
  const anem = [[new THREE.CylinderGeometry(0.28, 0.35, 0.5, 10).translate(0, 0.25, 0), mk(0, 0, 0, 0, 0, 0, 1)]], ten = new THREE.ConeGeometry(0.04, 0.6, 4).translate(0, 0.3, 0);
  for (let k = 0; k < 18; k++) { const a = k * 2.4, r = 0.08 + (k % 6) * 0.04; anem.push([ten, mk(Math.cos(a) * r, 0.5, Math.sin(a) * r, Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6, 1)]); }
  const anemone = merge(anem);
  return { peb, grass, urchin, star, shell, sponge, anemone };
}
// Material mit Wiegen (für Seegras und Anemonen): die Höhe des Punkts bestimmt, wie stark er schwingt
function swayMat(m, uTime, amount) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float sph = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.27;
        #else
          float sph = 0.0;
        #endif
        float sh2 = max(0.0, position.y);
        transformed.x += sin(uTime * 1.3 + sph) * sh2 * sh2 * ${amount.toFixed(2)};
        transformed.z += cos(uTime * 1.1 + sph * 1.4) * sh2 * sh2 * ${(amount * 0.7).toFixed(2)};`);
  };
  m.customProgramCacheKey = () => 'sway' + amount;
  return m;
}
function buildScatter(root, W, mat, uTime, exp) {
  const K = makeKinds(), R = rng(W.seed ^ 0x13579b), lim = exp ? 280 : W.lim - 4, q = QUAL;
  const types = [
    { n: SCATTER.pebbles, geo: K.peb, m: mat(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 })), s: [0.08, 0.4], cols: [0x7a7268, 0x5e5a54, 0x8a8070, 0x4a4844, 0x9a9080], tilt: 1, sink: 0.4 },
    { n: SCATTER.grass, geo: K.grass, m: swayMat(new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }), uTime, 0.22), s: [0.5, 1.2], cols: [0x3a6a2a, 0x4a7a30, 0x2a5a30, 0x5a7a2a], tilt: 0.3, flat: true },
    { n: SCATTER.urchins, geo: K.urchin, m: mat(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })), s: [0.12, 0.22], cols: [0x2a1030, 0x1a1418, 0x4a1a4a, 0x6a2a2a], tilt: 0.3, sink: 0.3 },
    { n: SCATTER.stars, geo: K.star, m: mat(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 })), s: [0.12, 0.25], cols: [0xff6a2a, 0xd83a3a, 0x9a3ad8, 0xffb03a, 0xff4a8a], tilt: 1 },
    { n: SCATTER.shells, geo: K.shell, m: mat(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, side: THREE.DoubleSide })), s: [0.06, 0.16], cols: [0xf0e0c8, 0xe8b890, 0xd8c8b8, 0xf0d0d8], tilt: 1 },
    { n: SCATTER.sponges, geo: K.sponge, m: mat(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide })), s: [0.5, 1.3], cols: [0xd87a3a, 0xb85a5a, 0xd8b84a, 0x8a5aa8], tilt: 0.25, sink: 0.1 },
    { n: SCATTER.anemones, geo: K.anemone, m: swayMat(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0.12 }), uTime, 0.35), s: [0.35, 0.8], cols: [0xff5a9a, 0x5affd8, 0xffd84a, 0xb07aff, 0xff7a3a], tilt: 0.4 },
  ];
  const C = new THREE.Color(), lists = [];
  const normalAt = (x, z) => N.set(W.heightAt(x - 1, z) - W.heightAt(x + 1, z), 2, W.heightAt(x, z - 1) - W.heightAt(x, z + 1)).normalize();
  for (const T of types) {
    const n = Math.round(T.n * q), mats = new Float32Array(n * 16), cols = new Float32Array(n * 3), xz = new Float32Array(n * 2);
    let c = 0;
    for (let i = 0; i < n; i++) {
      const x = (R() * 2 - 1) * lim, z = (R() * 2 - 1) * lim, y = W.heightAt(x, z);
      if (y > SURFACE - 3) continue;
      const nrm = normalAt(x, z); if (nrm.y < 0.75 && !T.tilt) continue;
      const s = T.s[0] + R() * (T.s[1] - T.s[0]);
      Q.setFromUnitVectors(UP, V.copy(UP).lerp(nrm, T.tilt).normalize()).multiply(new THREE.Quaternion().setFromAxisAngle(UP, R() * TAU));
      M4.compose(V.set(x, y - s * (T.sink || 0), z), Q, SC.set(s * (0.8 + R() * 0.4), s, s * (0.8 + R() * 0.4)));
      M4.toArray(mats, c * 16); C.setHex(T.cols[(R() * T.cols.length) | 0]).multiplyScalar(0.8 + R() * 0.4); cols[c * 3] = C.r; cols[c * 3 + 1] = C.g; cols[c * 3 + 2] = C.b;
      xz[c * 2] = x; xz[c * 2 + 1] = z; c++;
    }
    const max = Math.max(1, Math.ceil(c * (Math.PI * SCATTER.radius ** 2) / (4 * lim * lim) * 2.2) + 50);
    const im = new THREE.InstancedMesh(T.geo, T.m, max); im.count = 0; im.frustumCulled = false;
    im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    root.add(im); lists.push({ im, mats, cols, xz, n: c, max });
  }
  let lastX = 1e9, lastZ = 1e9;
  // nur das Kleinzeug in deiner Nähe in die Grafikkarte schicken (neu, wenn du 8 m weiter geschwommen bist)
  return (cx, cz) => {
    if ((cx - lastX) ** 2 + (cz - lastZ) ** 2 < 64) return;
    lastX = cx; lastZ = cz; const r2 = SCATTER.radius ** 2;
    for (const L of lists) {
      const A = L.im.instanceMatrix.array, CA = L.im.instanceColor.array; let k = 0;
      for (let i = 0; i < L.n && k < L.max; i++) {
        const dx = L.xz[i * 2] - cx, dz = L.xz[i * 2 + 1] - cz; if (dx * dx + dz * dz > r2) continue;
        for (let j = 0; j < 16; j++) A[k * 16 + j] = L.mats[i * 16 + j];
        CA[k * 3] = L.cols[i * 3]; CA[k * 3 + 1] = L.cols[i * 3 + 1]; CA[k * 3 + 2] = L.cols[i * 3 + 2]; k++;
      }
      L.im.count = k; L.im.instanceMatrix.needsUpdate = true; L.im.instanceColor.needsUpdate = true;
    }
  };
}

// ---------- alles zusammen ----------
// mat(m) = Material mit Lichtmuster (aus world.js), uTime = Zeit für das Wiegen.
// Gibt update(dt, camX, camZ) zurück.
export function buildProps(root, W, mat, uTime) {
  const exp = W.mode === 'exp';
  buildShip(root, W, mat);
  buildContainers(root, W, mat);
  buildPlane(root, W, mat);
  const smoke = buildVents(root, W, mat);
  buildPipe(root, W, mat);
  buildWhales(root, W, mat, exp);
  const scatter = buildScatter(root, W, mat, uTime, exp);
  return (dt, cx, cz) => { if (smoke) smoke(dt); scatter(cx, cz); };
}
