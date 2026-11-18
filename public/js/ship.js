// Undernite - the trader's pirate ship at the surface. Own cartoon design
// ("Seehund"): toon shading with black outlines, chubby wooden hull, white curly
// railings, a big main sail with our own fish-skeleton emblem, a red/white striped
// rear sail, a bow cannon and a friendly seal figurehead on a long curved neck.
// y = 0 is the waterline, the bow points to -z.
import * as THREE from 'three';
import { makeTag } from './models.js';

const TAU = Math.PI * 2;
function spline(keys, t) {
  const n = keys.length;
  if (t <= keys[0][0]) return keys[0][1];
  if (t >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 0; while (t > keys[i + 1][0]) i++;
  const p0 = keys[Math.max(0, i - 1)][1], p1 = keys[i][1], p2 = keys[i + 1][1], p3 = keys[Math.min(n - 1, i + 2)][1];
  const u = (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
  return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
}
// 3-step toon shading
let GRAD = null;
function gradient() {
  if (GRAD) return GRAD;
  GRAD = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]), 3, 1);
  GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter; GRAD.needsUpdate = true;
  return GRAD;
}
const toon = (color, o = {}) => new THREE.MeshToonMaterial({ color, gradientMap: gradient(), ...o });
const glow = (color, i = 2) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i, roughness: 0.4 });
const LINE = new THREE.MeshBasicMaterial({ color: 0x14100c, side: THREE.BackSide });
const BOX = new THREE.BoxGeometry(1, 1, 1), CYL = new THREE.CylinderGeometry(1, 1, 1, 14), SPH = new THREE.SphereGeometry(1, 20, 14);
function put(p, geo, mat, x, y, z, sx = 1, sy = sx, sz = sx) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); p.add(m); return m; }
// cartoon outline: a slightly inflated black copy rendered from the back
function outline(mesh, w = 0.06) {
  const g = mesh.geometry.clone(); if (!g.attributes.normal) g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal, s = mesh.scale;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * w / s.x, p.getY(i) + n.getY(i) * w / s.y, p.getZ(i) + n.getZ(i) * w / s.z);
  const o = new THREE.Mesh(g, LINE); mesh.add(o); return mesh;
}
function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// chubby hull shape along t (0 = bow, 1 = stern)
const LEN = 20, Z0 = -10;
const HB = [[0, 0.5], [0.1, 2.2], [0.3, 3.4], [0.6, 3.6], [0.85, 3.4], [1, 2.8]];
const DEP = [[0, 2.4], [0.15, 3.8], [0.5, 4.3], [0.9, 4.0], [1, 3.3]];
const SHEER = [[0, 3.3], [0.2, 2.5], [0.55, 2.2], [0.8, 2.8], [1, 3.5]];
const zAt = (t) => Z0 + LEN * t;
const DECK_Y = 1.85;

function hullGeometry() {
  const rings = 44, seg = 64, pos = [], col = [], idx = [], C = new THREE.Color();
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, hb = spline(HB, t), dep = spline(DEP, t), sh = spline(SHEER, t), z = zAt(t);
    for (let j = 0; j <= seg; j++) {
      const a = j / seg * Math.PI, c = Math.cos(a), s = Math.sin(a);
      const x = hb * Math.sign(c) * Math.abs(c) ** 0.45, y = sh - dep * s ** 1.3;
      pos.push(x, y, z);
      if (sh - y < 0.28) C.setHex(0xf4efe2);                       // white trim along the top
      else if (y < -0.2) C.setHex(0x4a2c1a);                       // dark bottom
      else {                                                      // big cartoon planks
        const plank = Math.floor((y + 0.2) / 0.55);
        C.setHex(plank % 2 ? 0xb3743e : 0x9a5f2c);
      }
      col.push(C.r, C.g, C.b);
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
    const a = i * (seg + 1) + j, b = a + 1, c = a + seg + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function shapeMesh(pts, mat) { return new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])))), mat); }
function sail(w, h, tex, bulge = 1.0) {
  const g = new THREE.PlaneGeometry(w, h, 12, 10), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (w / 2), y = p.getY(i) / (h / 2); p.setZ(i, -bulge * (1 - x * x * 0.7) * (1 - (y * 0.8) ** 2)); }
  g.computeVertexNormals();
  return new THREE.Mesh(g, toon(0xffffff, { map: tex, side: THREE.DoubleSide }));
}

export function makeShip() {
  const ship = new THREE.Group();
  const wood = toon(0x8a5a32), darkWood = toon(0x4a2e1a), white = toon(0xf4efe2), iron = toon(0x2c3036), gold = toon(0xe8b84a);

  // ----- hull, deck, stern -----
  ship.add(outline(new THREE.Mesh(hullGeometry(), new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradient(), side: THREE.DoubleSide, emissive: 0x2a1408, emissiveIntensity: 0.5 })), 0.09));
  const deckTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#c99a62'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#bd8d56' : '#d2a46c'; c.fillRect(i * 32, 0, 30, h); c.fillStyle = '#7a5530'; c.fillRect(i * 32 + 30, 0, 2, h); }
  });
  deckTex.wrapS = deckTex.wrapT = THREE.RepeatWrapping; deckTex.repeat.set(0.3, 0.1);
  const deckPts = [];
  for (let i = 0; i <= 30; i++) { const t = 0.04 + 0.96 * i / 30; deckPts.push([spline(HB, t) * 0.97, zAt(t)]); }
  for (let i = 30; i >= 0; i--) { const t = 0.04 + 0.96 * i / 30; deckPts.push([-spline(HB, t) * 0.97, zAt(t)]); }
  const deck = shapeMesh(deckPts, toon(0xffffff, { map: deckTex, side: THREE.DoubleSide })); deck.rotation.x = Math.PI / 2; deck.position.y = DECK_Y; ship.add(deck);
  const sternPts = [];
  for (let j = 0; j <= 16; j++) { const a = j / 16 * Math.PI, c = Math.cos(a), s = Math.sin(a); sternPts.push([spline(HB, 1) * Math.sign(c) * Math.abs(c) ** 0.45, spline(SHEER, 1) - spline(DEP, 1) * s ** 1.3]); }
  const transom = shapeMesh(sternPts, toon(0x8a5530, { side: THREE.DoubleSide })); transom.position.z = zAt(1) - 0.01; ship.add(transom);
  // round stern window with a golden frame
  const win = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), glow(0xffd27a, 1.3)); win.position.set(0, 2.2, zAt(1) + 0.03); ship.add(win);
  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.11, 8, 24), gold); frame.position.set(0, 2.2, zAt(1) + 0.05); ship.add(frame);
  put(ship, BOX, darkWood, 0, -1.3, zAt(1) + 0.25, 0.25, 3, 1);   // rudder

  // ----- white curly railings -----
  for (const s of [-1, 1]) {
    for (const [dy, r] of [[1.0, 0.11], [0.25, 0.08]]) {
      const pts = [];
      for (let i = 0; i <= 26; i++) { const t = 0.03 + 0.94 * i / 26; pts.push(new THREE.Vector3(s * spline(HB, t) * 0.98, spline(SHEER, t) + dy, zAt(t))); }
      ship.add(outline(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 70, r, 8), white), 0.035));
    }
    for (let i = 0; i <= 30; i++) {   // balusters
      const t = 0.05 + 0.9 * i / 30, x = s * spline(HB, t) * 0.98, y = spline(SHEER, t);
      put(ship, CYL, white, x, y + 0.62, zAt(t), 0.06, 0.75, 0.06);
    }
    // scroll curls at both ends of the railing
    for (const [t, flip] of [[0.06, 1], [0.95, -1]]) {
      const curl = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.13, 8, 22, Math.PI * 1.55), white);
      curl.position.set(s * spline(HB, t) * 1.02, spline(SHEER, t) + 0.55, zAt(t));
      curl.rotation.set(0, Math.PI / 2, flip > 0 ? 0.6 : Math.PI + 0.6);
      ship.add(outline(curl, 0.03));
    }
  }

  // ----- stern cabin + bow deck -----
  const cab = put(ship, BOX, toon(0xa06a3a), 0, DECK_Y + 1.15, 6.6, 5.0, 2.3, 4.6); outline(cab, 0.05);
  put(ship, BOX, white, 0, DECK_Y + 2.4, 6.6, 5.4, 0.22, 5.0);
  for (const s of [-1, 1]) { put(ship, new THREE.CircleGeometry(0.42, 18), glow(0xffd27a, 1.2), s * 2.51, DECK_Y + 1.3, 6.6, 1).rotation.y = s * Math.PI / 2; }
  const door = put(ship, BOX, toon(0x6a4022), 0, DECK_Y + 0.95, 4.28, 1.1, 1.9, 0.08); outline(door, 0.03);
  put(ship, SPH, gold, 0.36, DECK_Y + 0.95, 4.22, 0.08);
  // little railing around the cabin roof
  for (const [x, z, w, d] of [[0, 4.2, 5.2, 0.08], [0, 9.0, 5.2, 0.08], [-2.6, 6.6, 0.08, 4.8], [2.6, 6.6, 0.08, 4.8]]) put(ship, BOX, white, x, DECK_Y + 3.05, z, w, 0.12, d);
  for (const [x, z] of [[-2.6, 4.2], [2.6, 4.2], [-2.6, 9], [2.6, 9], [0, 9], [-1.3, 4.2], [1.3, 4.2]]) put(ship, CYL, white, x, DECK_Y + 2.8, z, 0.06, 0.55, 0.06);
  const wheel = new THREE.Group(); wheel.position.set(0, DECK_Y + 3.3, 5.0); ship.add(wheel);
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 6, 20), wood));
  for (let i = 0; i < 8; i++) { const sp = put(wheel, CYL, wood, 0, 0, 0, 0.035, 1.3, 0.035); sp.rotation.z = i / 8 * Math.PI; }
  put(ship, CYL, wood, 0, DECK_Y + 2.9, 5.15, 0.1, 0.8, 0.1);

  // ----- sails -----
  const emblemSail = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#f1e6c8'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(150,120,80,.45)'; c.lineWidth = 3;
    for (let x = 42; x < w; x += 42) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    drawEmblem(c, w / 2, h / 2 + 4, 0.95, '#26201a');
  });
  const stripes = canvasTex(256, 256, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#f4efe2' : '#c8322a'; c.fillRect(i * 32, 0, 32, h); } });
  // main mast with the big emblem sail and a crow's nest
  const mainZ = -1.2, mainH = 16;
  put(ship, CYL, wood, 0, DECK_Y + mainH / 2, mainZ, 0.3, mainH, 0.3);
  for (const y of [11.6, 3.4]) { const yard = put(ship, CYL, darkWood, 0, DECK_Y + y, mainZ - 0.25, 0.14, 10.4, 0.14); yard.rotation.z = Math.PI / 2; }
  const ms = sail(9.6, 8.2, emblemSail, 1.3); ms.position.set(0, DECK_Y + 7.5, mainZ - 0.45); ship.add(ms);
  const nest = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.85, 1.1, 18, 1, true), toon(0x8a5a32, { side: THREE.DoubleSide }));
  nest.position.set(0, DECK_Y + 13.4, mainZ); ship.add(outline(nest, 0.04));
  put(ship, CYL, darkWood, 0, DECK_Y + 12.85, mainZ, 0.9, 0.1, 0.9);
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; put(ship, BOX, darkWood, Math.cos(a) * 0.95, DECK_Y + 13.4, mainZ + Math.sin(a) * 0.95, 0.06, 1.1, 0.06); }
  // rear mast with the red/white striped sail
  const rearZ = 6.6, rearH = 11.5;
  put(ship, CYL, wood, 0, DECK_Y + 2.4 + rearH / 2, rearZ, 0.2, rearH, 0.2);
  const rs = sail(4.8, 5.4, stripes, 0.8); rs.position.set(0, DECK_Y + 2.4 + 6.0, rearZ - 0.3); ship.add(rs);
  for (const y of [8.9, 3.5]) { const yard = put(ship, CYL, darkWood, 0, DECK_Y + 2.4 + y, rearZ - 0.15, 0.1, 5.6, 0.1); yard.rotation.z = Math.PI / 2; }
  // pirate flag on top of the main mast
  const flagTex = canvasTex(256, 160, (c, w, h) => { c.fillStyle = '#121418'; c.fillRect(0, 0, w, h); drawEmblem(c, w / 2, h / 2, 0.6, '#f4efe2'); });
  const flagG = new THREE.PlaneGeometry(2.6, 1.6, 10, 4).translate(1.3, 0, 0);
  const flag = new THREE.Mesh(flagG, new THREE.MeshBasicMaterial({ map: flagTex, side: THREE.DoubleSide }));
  flag.position.set(0, DECK_Y + mainH + 0.4, mainZ); flag.rotation.y = Math.PI / 2; ship.add(flag);
  const flagBase = flagG.attributes.position.array.slice();

  // ----- bow cannon -----
  const bowY = spline(SHEER, 0.08), bowZ = zAt(0.08);
  const cannon = new THREE.Group(); cannon.position.set(1.0, bowY + 0.6, bowZ + 0.6); cannon.rotation.y = 0.12; ship.add(cannon);
  const barrel = put(cannon, new THREE.CylinderGeometry(0.28, 0.4, 2.8, 16), iron, 0, 0.1, -0.9); barrel.rotation.x = Math.PI / 2 - 0.08; outline(barrel, 0.035);
  put(cannon, new THREE.TorusGeometry(0.33, 0.07, 8, 16), iron, 0, 0.2, -2.3);
  for (const s of [-1, 1]) put(cannon, new THREE.CylinderGeometry(0.42, 0.42, 0.14, 16), wood, s * 0.45, -0.35, 0.1).rotation.z = Math.PI / 2;
  put(cannon, BOX, darkWood, 0, -0.2, 0.2, 0.7, 0.4, 1.2);

  // ----- seal figurehead on a long curved neck -----
  const seal = toon(0xa9b3ba), sealLight = toon(0xe2e6e8), black = toon(0x0d0d0f);
  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, spline(SHEER, 0.02) - 0.6, zAt(0.02) + 0.6), new THREE.Vector3(0, 3.9, zAt(0) - 0.9),
    new THREE.Vector3(0, 5.4, zAt(0) - 1.5), new THREE.Vector3(0, 6.8, zAt(0) - 1.3)]);
  const neck = new THREE.Mesh(new THREE.TubeGeometry(neckCurve, 40, 0.5, 14), seal); ship.add(outline(neck, 0.06));
  const headP = new THREE.Vector3(0, 7.45, zAt(0) - 1.55);
  const head = new THREE.Group(); head.position.copy(headP); ship.add(head);
  outline(put(head, SPH, seal, 0, 0, 0, 1.15, 1.0, 1.1), 0.07);
  for (const s of [-1, 1]) {
    outline(put(head, SPH, sealLight, s * 0.3, -0.3, -0.92, 0.42, 0.34, 0.36), 0.04);      // muzzle cheeks
    put(head, SPH, black, s * 0.45, 0.28, -0.88, 0.24, 0.27, 0.16);                         // big shiny eyes
    put(head, SPH, white, s * 0.4, 0.38, -1.0, 0.07, 0.07, 0.04);                           // eye highlight
    for (let k = -1; k <= 1; k++) {                                                         // whiskers
      const w = put(head, CYL, toon(0x3a3a3a), s * 0.75, -0.3 + k * 0.08, -1.0, 0.012, 0.6, 0.012);
      w.rotation.z = s * (Math.PI / 2 - k * 0.18); w.rotation.y = s * -0.25;
    }
    for (const [x, y, z, r] of [[0.55, 0.55, -0.2, 0.12], [0.75, -0.05, 0.25, 0.1], [0.35, 0.75, 0.3, 0.09]]) put(head, SPH, toon(0x7f8a92), s * x, y, z, r, r * 0.4, r);   // spots
    const flip = put(ship, SPH, seal, s * 0.75, 4.2, zAt(0) - 0.9, 0.18, 0.55, 0.35); flip.rotation.z = s * 0.7; outline(flip, 0.03);   // little flippers
  }
  put(head, SPH, black, 0, -0.08, -1.15, 0.2, 0.14, 0.12);                                   // nose
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 6, 16, Math.PI), black); smile.position.set(0, -0.48, -1.04); smile.rotation.z = Math.PI; head.add(smile);

  // ----- lanterns, rigging, sign, light beam -----
  for (const [x, y, z] of [[2.4, DECK_Y + 3.6, 9.0], [-2.4, DECK_Y + 3.6, 9.0]]) { put(ship, BOX, iron, x, y + 0.4, z, 0.1, 0.5, 0.1); put(ship, SPH, glow(0xffc46a, 3), x, y, z, 0.22); }
  const lines = [];
  for (const [mz, top] of [[mainZ, DECK_Y + mainH - 0.4], [rearZ, DECK_Y + 2.4 + rearH - 0.3]]) for (const s of [-1, 1]) for (const dz of [-1, 0.6]) {
    const t = (mz + dz + 1.4 - Z0) / LEN;
    lines.push(new THREE.Vector3(0, top, mz), new THREE.Vector3(s * spline(HB, t), spline(SHEER, t) + 1, mz + dz + 1.4));
  }
  lines.push(new THREE.Vector3(0, DECK_Y + mainH - 0.4, mainZ), new THREE.Vector3(0, 6.6, zAt(0) - 1.3));
  lines.push(new THREE.Vector3(0, DECK_Y + mainH - 0.4, mainZ), new THREE.Vector3(0, DECK_Y + 2.4 + rearH - 0.3, rearZ));
  ship.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines), new THREE.LineBasicMaterial({ color: 0x2a2018 })));
  const sign = makeTag('⚓ HÄNDLER', '#ffc94d'); sign.scale.multiplyScalar(2.4); sign.position.set(0, DECK_Y + 5.0, 6.6); ship.add(sign);
  const beam = put(ship, CYL, new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), 0, -92, 0, 3, 180, 3);

  // rocking on the waves, waving flag, the seal nods a little
  let t = 0;
  ship.userData.beam = beam;
  ship.userData.update = (dt) => {
    t += dt;
    ship.rotation.z = Math.sin(t * 0.7) * 0.035; ship.rotation.x = Math.sin(t * 0.5) * 0.02;
    ship.position.y = (ship.userData.baseY ??= ship.position.y) + Math.sin(t * 0.9) * 0.15;
    head.rotation.x = Math.sin(t * 0.9) * 0.08; head.rotation.y = Math.sin(t * 0.4) * 0.12;
    const fp = flagG.attributes.position;
    for (let i = 0; i < fp.count; i++) { const x = flagBase[i * 3]; fp.setZ(i, Math.sin(x * 2.2 - t * 5) * 0.18 * (x / 2.6)); }
    fp.needsUpdate = true;
  };
  return ship;
}

// own pirate emblem: a fish skeleton above two crossed harpoons
function drawEmblem(c, cx, cy, s, color) {
  c.save(); c.translate(cx, cy); c.scale(s, s); c.strokeStyle = color; c.fillStyle = color; c.lineCap = 'round';
  c.lineWidth = 9;
  for (const a of [-0.6, 0.6]) {
    c.save(); c.rotate(a); c.beginPath(); c.moveTo(0, -95); c.lineTo(0, 95); c.stroke();
    c.beginPath(); c.moveTo(0, -112); c.lineTo(-15, -86); c.lineTo(15, -86); c.closePath(); c.fill(); c.restore();
  }
  c.lineWidth = 7;
  c.beginPath(); c.moveTo(-58, -8); c.lineTo(52, -8); c.stroke();
  c.beginPath(); c.arc(-62, -8, 22, 0, TAU); c.fill();
  c.fillStyle = color === '#26201a' ? '#f1e6c8' : '#121418'; c.beginPath(); c.arc(-67, -14, 6, 0, TAU); c.fill(); c.fillStyle = color;
  for (let i = 0; i < 6; i++) { const x = -30 + i * 14; c.beginPath(); c.moveTo(x, -8); c.lineTo(x + 6, -34 + i * 3); c.moveTo(x, -8); c.lineTo(x + 6, 18 - i * 3); c.stroke(); }
  c.beginPath(); c.moveTo(52, -8); c.lineTo(76, -30); c.lineTo(70, -8); c.lineTo(76, 14); c.closePath(); c.fill();
  c.restore();
}
