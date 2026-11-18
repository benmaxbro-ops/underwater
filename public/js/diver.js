// Undernite - realistic scuba diver: neoprene wetsuit, hood, mask with reflective glass,
// regulator, yellow tank with valve and hoses, BCD, gloves, long fins and a flutter kick
// from hips, knees and ankles. The diver lies horizontally, head towards -z, back up (+y).
import * as THREE from 'three';
import { loft } from './creatures.js';
import { neoprene } from './textures.js';
import { SUITS } from './shared.js';

const TAU = Math.PI * 2;
// Materialien gleicher Farbe werden wiederverwendet (dann kann man mehr Teile verschmelzen). Mit Textur (bumpMap) immer neu.
const MATS = new Map();
const mat = (color, o = {}) => { if (o.bumpMap || o.side) return new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.05, ...o });
  const k = color + JSON.stringify(o); if (!MATS.has(k)) MATS.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.05, ...o })); return MATS.get(k); };
const SPH = new THREE.SphereGeometry(1, 20, 14), CYL = new THREE.CylinderGeometry(1, 1, 1, 16), BOX = new THREE.BoxGeometry(1, 1, 1);
function put(p, geo, m, x, y, z, sx = 1, sy = sx, sz = sx) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); p.add(o); return o; }
// limb segment along -z from the joint: tapered capsule-like lathe
const limbCache = new Map();
function limbGeo(r0, r1, len) {
  const k = `${r0}|${r1}|${len}`;
  if (limbCache.has(k)) return limbCache.get(k);
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, r = (r0 + (r1 - r0) * t) * (1 + 0.12 * Math.sin(t * Math.PI));   // a bit of muscle bulge
    pts.push(new THREE.Vector2(Math.max(0.001, r * Math.sin(Math.min(1, Math.min(t, 1 - t) * 8) * Math.PI / 2)), t * len));
  }
  const g = new THREE.LatheGeometry(pts, 14).rotateX(-Math.PI / 2);   // along -z
  limbCache.set(k, g); return g;
}
function hose(parent, points, m, r = 0.012) {
  const c = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  parent.add(new THREE.Mesh(new THREE.TubeGeometry(c, 24, r, 6), m));
}

// Alle Teile, die direkt in derselben Gruppe hängen (also gemeinsam bewegt werden), zu einer Form pro Material verschmelzen.
// Gelenke (Untergruppen) bleiben beweglich. So muss die Grafikkarte pro Taucher nur ein paar Dutzend Teile zeichnen statt hunderte.
function bakeLocal(grp) {
  const meshes = grp.children.filter(o => o.isMesh && !o.isInstancedMesh), buckets = new Map();
  for (const o of meshes) { o.updateMatrix(); if (!buckets.has(o.material)) buckets.set(o.material, []); buckets.get(o.material).push(o); }
  for (const [m, list] of buckets) {
    if (list.length < 2) continue;
    const parts = list.map(o => { const c = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); c.applyMatrix4(o.matrix); return c; });
    let n = 0; for (const c of parts) n += c.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3).fill(1); let k = 0;
    for (const c of parts) { const cnt = c.attributes.position.count; pos.set(c.attributes.position.array, k * 3); if (c.attributes.normal) nor.set(c.attributes.normal.array, k * 3);
      if (c.attributes.uv) uv.set(c.attributes.uv.array, k * 2); if (c.attributes.color) col.set(c.attributes.color.array, k * 3); k += cnt; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (m.vertexColors) geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    for (const o of list) grp.remove(o);
    grp.add(new THREE.Mesh(geo, m));
  }
}
const TOR = new THREE.TorusGeometry(1, 0.18, 8, 20);
function ring(p, m, x, y, z, r, rx = 0, ry = 0, rz = 0, th = 1) { const o = put(p, TOR, m, x, y, z, r, r, r * th); o.rotation.set(rx, ry, rz); return o; }

// suit: 'manta' | 'triton' | 'bulwark'. accent: player colour (stripes, fin rails).
export function buildRealDiver(suit, accent) {
  const g = new THREE.Group();
  const S = SUITS[suit] || {}, heavy = suit === 'bulwark' || S.build === 'heavy', slim = suit === 'manta' || S.build === 'slim';
  // Neopren: das Strickmuster kommt als "bump"-Textur, so sieht der Anzug nach Stoff aus statt nach Plastik
  const suitBlack = mat(0x121519, { roughness: 0.5, metalness: 0.08, bumpMap: neoprene(), bumpScale: 1.2 });
  const rubber = mat(0x0b0c0e, { roughness: 0.65 });
  const acc = mat(accent, { roughness: 0.45, emissive: accent, emissiveIntensity: 0.18 });
  const tankCol = S.tank ?? (slim ? 0xc8ced4 : heavy ? 0x3e4a56 : 0xd9d24a);   // neue Taucher: eigene Flaschenfarbe
  const tankM = mat(tankCol, { roughness: 0.3, metalness: slim ? 0.85 : 0.35 });
  const chrome = mat(0xd8dde2, { roughness: 0.2, metalness: 0.95 });
  const hoseM = mat(0x16181b, { roughness: 0.6 }), yellowHose = mat(0xe8c21a, { roughness: 0.5 });

  // ----- torso: neoprene with coloured side panels -----
  const A = new THREE.Color(accent), BLK = new THREE.Color(0x121519), GRY = new THREE.Color(0x2a3036), C = new THREE.Color();
  const wide = slim ? 0.88 : heavy ? 1.15 : 1;
  const torso = loft({ w: [[0, 0.07], [0.1, 0.19 * wide], [0.22, 0.225 * wide], [0.5, 0.185 * wide], [0.78, 0.165 * wide], [1, 0.17 * wide]],
    h: [[0, 0.08], [0.1, 0.13], [0.3, 0.148], [0.6, 0.128], [1, 0.13]], y: [[0, 0.02], [1, 0]] }, 0.43, (t, u, v) => {
    C.copy(BLK);
    if (Math.abs(v) < 0.22 && Math.abs(u) > 0.75 && t > 0.15) C.copy(A);          // side panel
    else if (v > 0.55 && t < 0.3) C.copy(GRY);                                     // shoulder panel
    else if (v < -0.6 && t > 0.2 && t < 0.55) C.copy(GRY).multiplyScalar(0.8);     // Brustpanel (gummiert)
    if (Math.abs(Math.abs(v) - 0.22) < 0.03 && t > 0.15) C.multiplyScalar(0.55);    // Nähte an den Seitenstreifen
    if (Math.abs(t - 0.3) < 0.008 || Math.abs(t - 0.72) < 0.008) C.multiplyScalar(0.6);   // Quernähte
    return C;
  }, 40, 26);
  const torsoMesh = put(g, torso, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.08, bumpMap: neoprene(), bumpScale: 1.2 }), 0, 0, -0.12);
  // BCD vest: back plate, shoulder straps, waist belt, inflator hose
  const bcd = mat(0x24292f, { roughness: 0.6 });
  put(g, BOX, bcd, 0, 0.12, -0.18, 0.36 * wide, 0.05, 0.52);
  for (const s of [-1, 1]) { const st = put(g, BOX, bcd, s * 0.15 * wide, 0.05, -0.47, 0.06, 0.26, 0.05); st.rotation.z = s * 0.35; }
  const belt = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 8, 24), bcd); belt.scale.set(0.18 * wide, 0.125, 1); belt.position.set(0, 0, 0.2); g.add(belt);
  put(g, BOX, chrome, 0, -0.12, 0.2, 0.06, 0.02, 0.05);   // buckle
  // Tarierweste genauer: Wing-Luftsack um die Flasche, Schulterpolster, D-Ringe, Schnallen, Bleitaschen, Brustgurt
  const wingM = mat(0x1c2026, { roughness: 0.55, bumpMap: neoprene(), bumpScale: 0.6 });
  put(g, SPH, wingM, 0, 0.17, -0.12, 0.27 * wide, 0.06, 0.36);                             // Luftsack (flach, rund)
  for (const s of [-1, 1]) put(g, SPH, acc, s * 0.262 * wide, 0.17, -0.12, 0.012, 0.016, 0.3);   // farbige Kante am Luftsack
  for (const s of [-1, 1]) {
    put(g, SPH, wingM, s * 0.14 * wide, 0.12, -0.46, 0.08, 0.04, 0.09);                      // Schulterpolster
    ring(g, chrome, s * 0.17 * wide, -0.05, -0.42, 0.022, 0, Math.PI / 2, 0);                // D-Ring am Schultergurt
    put(g, BOX, mat(0x2c3138, { roughness: 0.4, metalness: 0.4 }), s * 0.165 * wide, -0.02, -0.36, 0.035, 0.012, 0.03);   // Schnellverschluss
    // Bleitasche mit gelbem Zuggriff
    put(g, BOX, wingM, s * 0.2 * wide, -0.06, 0.12, 0.05, 0.08, 0.12);
    ring(g, yellowHose, s * 0.225 * wide, -0.1, 0.12, 0.025, 0, Math.PI / 2, 0, 0.5);
  }
  put(g, BOX, wingM, 0, -0.14, -0.36, 0.3 * wide, 0.015, 0.03);                             // Brustgurt
  put(g, BOX, chrome, 0, -0.152, -0.36, 0.035, 0.012, 0.035);
  // Inflator-Schlauch über die linke Schulter mit Ventilkopf (zwei Knöpfe)
  hose(g, [[-0.1, 0.24, -0.46], [-0.19, 0.12, -0.52], [-0.2, -0.06, -0.47], [-0.15, -0.14, -0.36]], wingM, 0.014);
  const inf = put(g, CYL, mat(0x2a2f36, { roughness: 0.4 }), -0.15, -0.15, -0.33, 0.022, 0.07, 0.022); inf.rotation.x = Math.PI / 2;
  for (const z of [-0.31, -0.35]) put(g, CYL, mat(0x2fa8ff, { roughness: 0.4 }), -0.15, -0.172, z, 0.012, 0.008, 0.012);
  // Oberflächenboje (orange Wurst) unten an der Weste
  const smb = put(g, CYL, mat(0xff6a1a, { roughness: 0.6 }), 0, 0.1, 0.24, 0.035, 0.22, 0.035); smb.rotation.z = Math.PI / 2;
  for (const x of [-0.07, 0.07]) { const st = put(g, CYL, rubber, x, 0.1, 0.24, 0.038, 0.012, 0.038); st.rotation.z = Math.PI / 2; }
  if (heavy) {   // armour plates for the "Bollwerk"
    const plate = mat(0x55606a, { roughness: 0.35, metalness: 0.7 });
    for (const s of [-1, 1]) { put(g, BOX, plate, s * 0.2, 0.02, -0.4, 0.14, 0.2, 0.22).rotation.z = s * 0.4; put(g, BOX, plate, s * 0.12, -0.11, -0.25, 0.14, 0.04, 0.3); }
  }

  // ----- tank(s) on the back with valve and first stage -----
  const tanks = heavy ? [-0.11, 0.11] : [0];
  for (const tx of tanks) {
    const r = heavy ? 0.085 : 0.095;
    put(g, CYL, tankM, tx, 0.215, -0.1, r, 0.62, r).rotation.x = Math.PI / 2;
    put(g, SPH, tankM, tx, 0.215, -0.41, r, r, r * 0.9);
    put(g, SPH, tankM, tx, 0.215, 0.21, r, r, r * 0.7);
    for (const z of [-0.2, 0.05]) { const band = put(g, CYL, rubber, tx, 0.215, z, r + 0.008, 0.04, r + 0.008); band.rotation.x = Math.PI / 2; }
  }
  for (const tx of tanks) {
    const r = heavy ? 0.085 : 0.095;
    put(g, CYL, rubber, tx, 0.215, 0.24, r * 1.02, 0.08, r * 1.02).rotation.x = Math.PI / 2;   // Gummifuß unten an der Flasche
    put(g, CYL, mat(0xf2f2ee, { roughness: 0.5 }), tx, 0.215, -0.28, r + 0.002, 0.08, r + 0.002).rotation.x = Math.PI / 2;   // weißes Etikett
    for (const z of [-0.2, 0.05]) put(g, BOX, chrome, tx + 0.02, 0.215 + r + 0.012, z, 0.035, 0.012, 0.03);   // Schnallen der Flaschenbänder
  }
  ring(g, mat(0x1a1d22, { roughness: 0.5 }), 0, 0.33, -0.5, 0.035, Math.PI / 2, 0, 0, 0.6);   // Handrad am Ventil
  for (let k = 0; k < 3; k++) { const sp = put(g, BOX, rubber, 0, 0.33, -0.5, 0.06, 0.008, 0.008); sp.rotation.y = k / 3 * Math.PI; }
  put(g, CYL, chrome, 0, 0.26, -0.5, 0.03, 0.12, 0.03).rotation.x = Math.PI / 2;      // valve
  put(g, CYL, rubber, 0, 0.32, -0.5, 0.04, 0.03, 0.04);                                // valve knob
  put(g, SPH, chrome, 0.05, 0.27, -0.55, 0.04, 0.035, 0.04);                           // first stage

  // ----- Rucksack-Kompressor: füllt ständig die Magazine nach -----
  const compM = mat(0x2a3138, { roughness: 0.4, metalness: 0.6 }), glowB = mat(0x2fa8ff, { emissive: 0x2fa8ff, emissiveIntensity: 1.4 });
  const magGlass = mat(0x9fe4ff, { emissive: 0x2fa8ff, emissiveIntensity: 0.7, transparent: true, opacity: 0.75, roughness: 0.1 });
  put(g, CYL, compM, 0, 0.2, 0.33, 0.075, 0.28, 0.075).rotation.z = Math.PI / 2;          // Kompressor quer unter der Flasche
  for (const s of [-1, 1]) put(g, CYL, glowB, s * 0.1, 0.2, 0.33, 0.078, 0.012, 0.078).rotation.z = Math.PI / 2;   // blaue Ringe
  put(g, BOX, glowB, 0, 0.27, 0.33, 0.06, 0.012, 0.035);                                   // leuchtendes Druckfenster
  hose(g, [[0, 0.24, 0.27], [0, 0.26, 0.22], [0, 0.23, 0.18]], hoseM, 0.012);             // Leitung zur Flasche
  // Magazinhalter links und rechts an der Weste, mit je zwei Druckmagazinen
  for (const s of [-1, 1]) {
    put(g, BOX, compM, s * 0.19 * wide, 0.1, 0.0, 0.035, 0.07, 0.2);
    for (const z of [-0.05, 0.05]) put(g, CYL, magGlass, s * 0.215 * wide, 0.11, z, 0.018, 0.075, 0.018);
  }

  // ----- head: hood, mask, regulator -----
  const head = new THREE.Group(); head.position.set(0, 0.04, -0.68); g.add(head);
  // Kopflampe auf der Haube: leuchtet immer ein bisschen, damit man andere Taucher im Dunkeln erkennt
  const lampM = mat(0xf2f7ff, { emissive: 0xf2f7ff, emissiveIntensity: 2.4 });   // kaltweiße LED
  put(head, CYL, rubber, 0, 0.1, -0.05, 0.03, 0.05, 0.03).rotation.x = Math.PI / 2 - 0.4;
  put(head, SPH, lampM, 0, 0.11, -0.077, 0.022, 0.022, 0.012);
  put(g, CYL, suitBlack, 0, 0.03, -0.58, 0.07, 0.12, 0.07).rotation.x = Math.PI / 2 - 0.3;   // neck
  put(head, SPH, suitBlack, 0, 0, 0, 0.11, 0.115, 0.13);                                         // hooded head
  put(head, SPH, mat(0x0d0f12, { roughness: 0.6 }), 0, -0.02, 0.08, 0.1, 0.1, 0.1);              // back of hood
  const skirt = new THREE.Mesh(new THREE.TorusGeometry(1, 0.22, 10, 28), rubber);               // Maskenrahmen (rund)
  skirt.scale.set(0.082, 0.04, 0.12); skirt.position.set(0, -0.04, -0.148); skirt.rotation.x = -0.25; head.add(skirt);
  // Gesicht hinter der Maske: Haut, Augen mit Pupillen, Augenbrauen – so sieht man, dass ein Mensch im Anzug steckt
  const skin = mat(0xd9a27e, { roughness: 0.6 }), eyeW = mat(0xf4f4f0, { roughness: 0.2 }), iris = mat(0x2a4a6a, { roughness: 0.2 }), brow = mat(0x3a2a20);
  const face = new THREE.Group(); face.position.set(0, -0.038, -0.128); face.rotation.x = -0.25; head.add(face);
  put(face, SPH, skin, 0, 0, 0, 0.068, 0.034, 0.025);
  for (const s of [-1, 1]) {
    put(face, SPH, eyeW, s * 0.03, 0.002, -0.017, 0.013, 0.009, 0.008);
    put(face, SPH, iris, s * 0.03, 0.002, -0.024, 0.006, 0.006, 0.003);
    put(face, BOX, brow, s * 0.03, 0.016, -0.02, 0.024, 0.004, 0.004).rotation.z = -s * 0.15;
  }
  put(face, SPH, skin, 0, -0.016, -0.02, 0.009, 0.012, 0.01);   // Nase (steckt in der Nasentasche der Maske)
  // Maskenglas: durchsichtig mit Spiegelung, damit man das Gesicht dahinter sieht
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xbfe8f8, metalness: 0.2, roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.32 });
  const lens = put(head, BOX, glass, 0, -0.04, -0.155, 0.145, 0.06, 0.012); lens.rotation.x = -0.25;
  put(head, BOX, rubber, 0, -0.05, -0.158, 0.012, 0.05, 0.016).rotation.x = -0.25;                // Steg zwischen den zwei Gläsern
  put(head, SPH, rubber, 0, -0.072, -0.152, 0.022, 0.02, 0.02);                                   // Nasentasche
  for (const s of [-1, 1]) put(head, BOX, mat(0x2a2f36, { roughness: 0.4 }), s * 0.098, -0.03, -0.1, 0.012, 0.028, 0.03);   // Riemenschnallen
  ring(head, rubber, 0, -0.05, -0.125, 0.095, -0.25, 0, 0, 0.35).scale.set(0.095, 0.075, 0.03);   // Gesichtsdichtung der Haube
  // Schnorchel links am Maskenband: gebogenes Rohr, oben orange Spitze
  hose(head, [[-0.11, -0.12, -0.12], [-0.125, -0.02, -0.04], [-0.12, 0.1, 0.02], [-0.1, 0.2, 0.06]], rubber, 0.012);
  put(head, CYL, mat(0xff6a1a, { roughness: 0.5 }), -0.1, 0.215, 0.065, 0.016, 0.05, 0.016).rotation.x = 0.4;
  const strap = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 6, 20), rubber); strap.scale.set(0.12, 0.12, 0.12); strap.rotation.y = Math.PI / 2; strap.rotation.z = 0.3; strap.position.set(0, -0.02, 0); head.add(strap);
  // regulator in the mouth with the exhaust tee where the bubbles come out
  put(head, CYL, rubber, 0, -0.1, -0.12, 0.028, 0.06, 0.028).rotation.x = Math.PI / 2;
  put(head, BOX, mat(0x2b2f35), 0, -0.13, -0.135, 0.07, 0.025, 0.03);
  put(head, CYL, mat(0x2b2f35), 0, -0.1, -0.16, 0.035, 0.02, 0.035).rotation.x = Math.PI / 2;     // Gehäuse der 2. Stufe
  put(head, CYL, mat(0x5a6068, { roughness: 0.4 }), 0, -0.1, -0.172, 0.022, 0.006, 0.022).rotation.x = Math.PI / 2;   // Luftdusche-Knopf
  for (const s of [-1, 1]) put(head, BOX, rubber, s * 0.045, -0.14, -0.13, 0.03, 0.018, 0.025).rotation.z = s * 0.4;   // Ausatem-Ventil (Schnurrbart)
  // hoses: regulator to first stage over the right shoulder, yellow octopus, gauge
  hose(g, [[0.03, -0.06, -0.8], [0.12, -0.02, -0.74], [0.17, 0.12, -0.6], [0.06, 0.27, -0.55]], hoseM, 0.014);
  hose(g, [[0.05, 0.27, -0.56], [-0.16, 0.18, -0.52], [-0.19, -0.05, -0.35], [-0.1, -0.12, -0.22]], yellowHose, 0.012);
  hose(g, [[0.06, 0.26, -0.56], [0.22, 0.15, -0.4], [0.24, -0.02, -0.05], [0.2, -0.08, 0.15]], hoseM, 0.011);
  const con = new THREE.Group(); con.position.set(0.2, -0.1, 0.17); con.rotation.set(0.3, 0, 0.2); g.add(con);   // Konsole: Druckanzeige + Kompass
  put(con, BOX, rubber, 0, 0, 0.03, 0.06, 0.03, 0.13);
  put(con, CYL, mat(0xe8e8e0, { roughness: 0.3 }), 0, -0.017, 0, 0.026, 0.004, 0.026);
  put(con, BOX, mat(0xd02a2a), 0.006, -0.02, -0.006, 0.003, 0.002, 0.02).rotation.y = 0.7;   // Zeiger
  put(con, CYL, mat(0x1a1d22, { roughness: 0.2 }), 0, -0.017, 0.06, 0.024, 0.004, 0.024);
  put(con, BOX, mat(0xff4a2a, { emissive: 0xff4a2a, emissiveIntensity: 0.4 }), 0, -0.02, 0.055, 0.002, 0.002, 0.016);   // Kompassnadel

  // ----- arms: right arm holds the weapon forward, left arm tucked in -----
  const padM = mat(0x2a3036, { roughness: 0.8, bumpMap: neoprene(), bumpScale: 2 });   // Polster (Knie, Ellbogen)
  const arm = (side, shoulderRot, elbowRot) => {
    const sh = new THREE.Group(); sh.position.set(side * 0.2 * wide, 0.0, -0.5); sh.rotation.set(...shoulderRot); g.add(sh);
    put(sh, SPH, suitBlack, 0, 0, 0, 0.06);
    sh.add(new THREE.Mesh(limbGeo(0.055, 0.047, 0.28), suitBlack));
    const el = new THREE.Group(); el.position.z = -0.28; el.rotation.set(...elbowRot); sh.add(el);
    el.add(new THREE.Mesh(limbGeo(0.047, 0.036, 0.25), suitBlack));
    put(el, SPH, suitBlack, 0, 0, 0, 0.05);   // elbow
    put(el, SPH, padM, 0, 0.03, 0.01, 0.045, 0.02, 0.055);                    // Ellbogenpolster
    ring(el, rubber, 0, 0, -0.255, 0.04, 0, 0, 0, 0.8);                       // Handgelenk-Dichtung
    if (side < 0) {   // Tauchcomputer am linken Handgelenk: leuchtendes Display
      put(el, BOX, rubber, 0, 0.038, -0.215, 0.045, 0.018, 0.05);
      put(el, BOX, mat(0x5ef2e0, { emissive: 0x5ef2e0, emissiveIntensity: 1.2, roughness: 0.2 }), 0, 0.048, -0.215, 0.032, 0.002, 0.036);
      for (const z of [-0.18, -0.25]) ring(el, rubber, 0, 0, z, 0.042, 0, 0, 0, 0.5);   // Armband
    }
    glove(el, side);
    return el;
  };
  // Handschuh: Handfläche, vier gekrümmte Finger (umgreifen den Griff) und ein Daumen
  const fingerGeo = new THREE.CapsuleGeometry(0.009, 0.028, 4, 8);
  const gloveTop = mat(0x1d2126, { roughness: 0.75, bumpMap: neoprene(), bumpScale: 1.5 });
  const glove = (el, side) => {
    const h = new THREE.Group(); h.position.set(0, 0, -0.29); el.add(h);
    put(h, SPH, rubber, 0, 0, 0, 0.034, 0.02, 0.045);                          // Handfläche
    put(h, SPH, gloveTop, 0, 0.008, -0.004, 0.032, 0.014, 0.04);                // Handrücken (anderes Material)
    for (let i = 0; i < 4; i++) {                                                 // Finger mit drei Gliedern, nach unten gekrümmt
      const fz = -0.03 + i * 0.012 - 0.018, fx = side * (0.01 - i * 0.004), L = 1 - Math.abs(i - 1.3) * 0.12;
      put(h, SPH, gloveTop, fx, 0.0, fz - 0.012, 0.011, 0.01, 0.011);           // Knöchel
      const f1 = put(h, fingerGeo, rubber, fx, -0.018, fz - 0.02); f1.rotation.x = 1.2; f1.scale.setScalar(L);
      const f2 = put(h, fingerGeo, rubber, fx, -0.04, fz - 0.012); f2.rotation.x = 2.3; f2.scale.setScalar(0.85 * L);
      const f3 = put(h, fingerGeo, rubber, fx, -0.05, fz + 0.006); f3.rotation.x = 2.9; f3.scale.setScalar(0.65 * L);
    }
    const th = put(h, fingerGeo, rubber, -side * 0.028, -0.005, -0.03); th.rotation.set(1.1, 0, -side * 0.6);   // Daumen
    const th2 = put(h, fingerGeo, rubber, -side * 0.036, -0.022, -0.05); th2.rotation.set(1.6, 0, -side * 0.4); th2.scale.setScalar(0.8);
  };
  const rightHand = arm(1, [-0.32, 0.28, 0], [0.18, -0.05, 0]);
  arm(-1, [-0.36, -0.32, 0], [0.22, 0.08, 0]);   // linke Hand stützt die Waffe (beidhändig)
  // weapon in the right hand: the white-blue water gun is put in here by makePlayerModel (models.js)
  const gun = new THREE.Group(); gun.position.set(0, 0.05, -0.25); rightHand.add(gun);

  // ----- legs with long fins -----
  const finM = mat(0x0f1114, { roughness: 0.55, side: THREE.DoubleSide });
  // Flosse in zwei Teilen: fester Fußteil und biegsames Blatt (FIN_BEND = wie stark sich die Spitze biegt)
  const FIN_BEND = 0.5;
  const baseShape = new THREE.Shape();
  baseShape.moveTo(-0.06, 0); baseShape.lineTo(0.06, 0); baseShape.lineTo(0.107, 0.35); baseShape.lineTo(-0.107, 0.35); baseShape.closePath();
  const tipShape = new THREE.Shape();
  tipShape.moveTo(-0.107, 0); tipShape.lineTo(0.107, 0); tipShape.lineTo(0.12, 0.1); tipShape.quadraticCurveTo(0.13, 0.31, 0.06, 0.33);
  tipShape.lineTo(0, 0.25); tipShape.lineTo(-0.06, 0.33); tipShape.quadraticCurveTo(-0.13, 0.31, -0.12, 0.1); tipShape.closePath();
  const ext = (sh) => new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: false }).rotateX(Math.PI / 2);   // Blatt entlang +z, flach in xz
  const finBase = ext(baseShape), finTip = ext(tipShape);
  const legs = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(side * 0.09 * wide, -0.02, 0.27); g.add(hip);
    put(hip, SPH, suitBlack, 0, 0, 0, 0.085, 0.085, 0.1);   // hip joint
    const thigh = new THREE.Mesh(limbGeo(0.08, 0.06, 0.42), suitBlack); thigh.rotation.y = Math.PI; hip.add(thigh);   // along +z
    if (side < 0) { put(hip, BOX, wingM, -0.075, 0, 0.2, 0.035, 0.09, 0.14); put(hip, BOX, acc, -0.094, 0.02, 0.2, 0.004, 0.03, 0.12); }   // Beintasche mit farbigem Streifen
    const knee = new THREE.Group(); knee.position.z = 0.42; hip.add(knee);
    put(knee, SPH, suitBlack, 0, 0, 0, 0.062);   // knee
    put(knee, SPH, padM, 0, -0.045, 0.02, 0.06, 0.025, 0.08);                  // Kniepolster (unten = vorne beim Schwimmen)
    if (side > 0) {   // Tauchmesser in der Scheide am rechten Unterschenkel, mit zwei Gummibändern
      put(knee, BOX, mat(0x1a1d22, { roughness: 0.5 }), 0.06, -0.01, 0.2, 0.02, 0.035, 0.16);
      put(knee, BOX, mat(0xff6a1a, { roughness: 0.6 }), 0.06, -0.01, 0.1, 0.022, 0.028, 0.05);   // Griff
      for (const z of [0.16, 0.26]) ring(knee, rubber, 0, 0, z, 0.058, 0, 0, 0, 0.5);
    }
    const shin = new THREE.Mesh(limbGeo(0.058, 0.04, 0.4), suitBlack); shin.rotation.y = Math.PI; knee.add(shin);
    const ankle = new THREE.Group(); ankle.position.z = 0.4; knee.add(ankle);
    put(ankle, SPH, rubber, 0, 0, 0, 0.045);
    ring(ankle, rubber, 0, 0, -0.02, 0.045, 0, 0, 0, 0.7);                         // Knöchel-Dichtung
    put(ankle, SPH, rubber, 0, 0, 0.08, 0.045, 0.034, 0.12);                       // foot pocket (rund)
    put(ankle, BOX, rubber, 0, 0.012, 0.11, 0.075, 0.03, 0.14);
    const spring = ring(ankle, chrome, 0, 0.005, 0.03, 0.05, Math.PI / 2, 0, 0, 0.4); spring.scale.set(0.05, 0.07, 0.02);   // Federband an der Ferse
    const fin = new THREE.Group(); fin.position.set(0, -0.01, 0.1); ankle.add(fin);
    fin.add(new THREE.Mesh(finBase, finM));
    const tip = new THREE.Group(); tip.position.z = 0.35; fin.add(tip);
    tip.add(new THREE.Mesh(finTip, finM));
    for (const x of [-0.035, 0, 0.035]) put(fin, BOX, rubber, x, 0.01, 0.2, 0.008, 0.012, 0.26);     // Rippen auf dem Blatt
    for (const s of [-1, 1]) put(fin, BOX, mat(0x020203), s * 0.045, 0.008, 0.05, 0.03, 0.014, 0.012);   // Lüftungsschlitze vorne
    for (const x of [-0.05, 0.05]) put(tip, BOX, rubber, x, 0.01, 0.1, 0.008, 0.01, 0.18);
    for (const s of [-1, 1]) {   // farbige Leisten am Rand, auf beiden Teilen
      const r1 = put(fin, BOX, acc, s * 0.083, 0.008, 0.18, 0.012, 0.02, 0.34); r1.rotation.y = -s * 0.13;
      const r2 = put(tip, BOX, acc, s * 0.112, 0.008, 0.08, 0.012, 0.02, 0.16); r2.rotation.y = -s * 0.04;
    }
    legs.push({ hip, knee, ankle, fin, tip });
  }
  g.scale.setScalar({ manta: 0.92, triton: 1, bulwark: 1.12 }[suit] ?? 1);
  const groups = []; g.traverse(o => { if (!o.isMesh && o !== gun) groups.push(o); });
  for (const o of groups) bakeLocal(o);

  return {
    g, gun, hand: rightHand, mech: false, legs: [],
    // flutter kick: legs move up and down from the hip, knees and fins follow with a delay
    animate(dt, s, phase, amp) {
      for (let i = 0; i < 2; i++) {
        const L = legs[i], ph = phase + i * Math.PI;
        L.hip.rotation.x = Math.sin(ph) * 0.3 * amp - 0.05;
        L.knee.rotation.x = -Math.max(0, Math.sin(ph + 0.9)) * 0.55 * amp - 0.08;
        L.ankle.rotation.x = 0.15;
        L.fin.rotation.x = Math.sin(ph - 1.1) * 0.35 * amp;
        L.tip.rotation.x = Math.sin(ph - 1.7) * FIN_BEND * amp;   // die Spitze biegt sich hinterher (wie echte Flossen)
      }
    },
  };
}
