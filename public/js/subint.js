// Undernite – Innenraum des Mini-U-Boots (Ego-Sicht im U-Boot).
// Alles in U-Boot-Koordinaten: x = rechts, y = oben, −z = vorne (dort ist die Glaskuppel).
// Vorbild echte U-Boote: vorne Steuer und Bildschirme, in der Mitte das Periskop,
// an Wänden und Decke Rohre, Ventilräder und Druckanzeigen, hinten Koje und Schott-Tür.
import * as THREE from 'three';

// Wichtige Stellen im U-Boot (zum Ändern): Sitz, wie hoch die Augen sind, wo man herumlaufen darf
export const SUBROOM = {
  seat: [0, -1.25],          // x, z des Pilotensitzes
  eyeSit: 0.05,              // Augenhöhe im Sitzen
  eyeStand: 0.5,             // Augenhöhe im Stehen
  walk: { x: 0.85, z0: -1.7, z1: 2.0 },   // so weit kann man laufen (links/rechts, vorne/hinten)
  walkSpeed: 1.6,            // Meter pro Sekunde beim Laufen im U-Boot
  hatch: [0, 1.25],          // x, z der Bodenluke zur MG-Kugel
};

const R = 1.44, FLOOR = -0.95;
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.4, ...o });
const glow = (color) => new THREE.MeshBasicMaterial({ color });
function add(p, geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); p.add(m); return m; }
const BOX = new THREE.BoxGeometry(1, 1, 1), CYL = new THREE.CylinderGeometry(1, 1, 1, 16), SPH = new THREE.SphereGeometry(1, 12, 8);
const zCyl = new THREE.CylinderGeometry(1, 1, 1, 14).rotateX(Math.PI / 2), xCyl = new THREE.CylinderGeometry(1, 1, 1, 14).rotateZ(Math.PI / 2);

// rotes Ventilrad mit Speichen (an der Wand, zeigt nach innen)
function valve(p, mat, x, y, z, ry, s = 0.12) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; p.add(g);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(s, s * 0.14, 8, 24), mat); g.add(rim);
  for (let i = 0; i < 3; i++) { const sp = add(g, BOX, mat); sp.scale.set(s * 2, s * 0.12, s * 0.12); sp.rotation.z = i * Math.PI / 3; }
  add(g, zCyl, mat, 0, 0, -0.04).scale.set(s * 0.25, s * 0.25, 0.1);
  return g;
}
// Druckanzeige: weißes Zifferblatt mit Messingring und rotem Zeiger
function gauge(p, brass, x, y, z, ry, s = 0.07) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; p.add(g);
  add(g, zCyl, glow(0xdde6e2)).scale.set(s, s, 0.01);
  add(g, new THREE.TorusGeometry(s, s * 0.12, 8, 24), brass, 0, 0, 0.006);
  const n = new THREE.Group(); n.position.z = 0.008; g.add(n);
  add(n, BOX, glow(0xc02a20), 0, s * 0.4, 0).scale.set(s * 0.08, s * 0.8, 0.003);
  n.rotation.z = (Math.random() - 0.5) * 2;
  return n;
}

export function makeSubInterior() {
  const g = new THREE.Group();
  const wall = std(0x4a5a52, { roughness: 0.75, side: THREE.BackSide }), steel = std(0x8a949a, { roughness: 0.35, metalness: 0.8 });
  const dark = std(0x23292e), red = std(0xb8261c, { roughness: 0.45 }), brass = std(0xc8a050, { roughness: 0.3, metalness: 0.9 });
  const yellow = std(0xd8a818, { roughness: 0.5 }), cushion = std(0x3a2a22, { roughness: 0.9, metalness: 0 });

  // Rumpf von innen: grüngraue Wand, Spanten (Ringe) und hinten ein Schott mit runder Tür
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 4.5, 36, 1, true).rotateX(Math.PI / 2), wall); hull.position.z = 0.05; g.add(hull);
  for (let z = -2.0; z <= 2.2; z += 0.7) { const rib = add(g, new THREE.TorusGeometry(R - 0.03, 0.045, 8, 40), steel, 0, 0, z); }
  const bulk = add(g, new THREE.CircleGeometry(R, 36), std(0x3e4c45, { side: THREE.DoubleSide }), 0, 0, 2.3); bulk.rotation.y = Math.PI;
  add(g, new THREE.TorusGeometry(0.55, 0.06, 10, 32), steel, 0, -0.1, 2.27);                // Tür-Rahmen
  add(g, new THREE.CircleGeometry(0.55, 32), dark, 0, -0.1, 2.28).rotation.y = Math.PI;     // Tür
  valve(g, red, 0, -0.1, 2.22, Math.PI, 0.16);                                               // Rad an der Tür
  // vorne der Rahmen um die Glaskuppel
  add(g, new THREE.TorusGeometry(1.12, 0.07, 10, 40), steel, 0, 0.1, -2.15);

  // Boden: Gitterrost mit Längsstreben
  add(g, BOX, dark, 0, FLOOR - 0.03, 0.05).scale.set(2.0, 0.05, 4.4);
  for (let x = -0.9; x <= 0.9; x += 0.15) add(g, BOX, steel, x, FLOOR, 0.05).scale.set(0.02, 0.03, 4.3);
  for (let z = -2.1; z <= 2.2; z += 0.3) add(g, BOX, steel, 0, FLOOR + 0.005, z).scale.set(1.9, 0.02, 0.02);

  // Bodenluke zur MG-Kugel (Ring mit Handrad im Boden)
  add(g, new THREE.TorusGeometry(0.3, 0.04, 8, 28), steel, SUBROOM.hatch[0], FLOOR + 0.02, SUBROOM.hatch[1]).rotation.x = Math.PI / 2;
  add(g, new THREE.CircleGeometry(0.28, 24), dark, SUBROOM.hatch[0], FLOOR + 0.015, SUBROOM.hatch[1]).rotation.x = -Math.PI / 2;
  valve(g, red, SUBROOM.hatch[0], FLOOR + 0.05, SUBROOM.hatch[1], 0, 0.1).rotation.x = -Math.PI / 2;
  // Pilotensitz
  const [sx, sz] = SUBROOM.seat;
  add(g, CYL, steel, sx, FLOOR + 0.2, sz).scale.set(0.05, 0.4, 0.05);
  add(g, BOX, cushion, sx, FLOOR + 0.45, sz).scale.set(0.5, 0.1, 0.48);
  const back = add(g, BOX, cushion, sx, FLOOR + 0.82, sz + 0.26); back.scale.set(0.48, 0.65, 0.1); back.rotation.x = 0.15;

  // Steuerpult unter der Kuppel: schräge Platte, Bildschirme, Knöpfe und die Steuerhebel
  const desk = add(g, BOX, dark, 0, -0.3, -1.95); desk.scale.set(1.5, 0.12, 0.55); desk.rotation.x = -0.35;
  add(g, BOX, dark, 0, -0.62, -1.95).scale.set(1.5, 0.6, 0.4);
  const sonarTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; return c; })();
  const sonarCtx = sonarTex.getContext('2d'), sonarMap = new THREE.CanvasTexture(sonarTex);
  const sonar = add(g, new THREE.PlaneGeometry(0.34, 0.26), new THREE.MeshBasicMaterial({ map: sonarMap }), -0.38, -0.15, -1.83); sonar.rotation.x = -0.35;
  const depth = add(g, new THREE.PlaneGeometry(0.26, 0.18), glow(0x103a24), 0.4, -0.17, -1.84); depth.rotation.x = -0.35;
  for (let i = 0; i < 5; i++) add(g, BOX, glow([0x5ef2e0, 0xffd36b, 0x7dff9a, 0xff6b5e, 0x5ef2e0][i]), -0.16 + i * 0.08, -0.25, -1.78).scale.set(0.035, 0.012, 0.012);
  const yoke = new THREE.Group(); yoke.position.set(0, -0.36, -1.62); g.add(yoke);                        // Steuerhorn
  add(yoke, zCyl, steel, 0, 0, -0.12).scale.set(0.025, 0.025, 0.25);
  add(yoke, BOX, dark, 0, 0, 0).scale.set(0.42, 0.05, 0.05);
  for (const s of [-1, 1]) add(yoke, CYL, std(0x15191c, { roughness: 0.9 }), 0.21 * s, 0.07, 0).scale.set(0.025, 0.16, 0.025);
  const throttle = new THREE.Group(); throttle.position.set(0.45, -0.55, -1.4); g.add(throttle);         // Gashebel rechts neben dem Sitz
  add(g, BOX, dark, 0.45, -0.62, -1.4).scale.set(0.12, 0.08, 0.25);
  add(throttle, CYL, steel, 0, 0.1, 0).scale.set(0.012, 0.2, 0.012);
  add(throttle, SPH, red, 0, 0.21, 0).scale.setScalar(0.035);

  // Periskop in der Mitte und Leiter nach oben zur Luke (im Turm)
  add(g, CYL, steel, 0, 0.25, 0.45).scale.set(0.09, 2.4, 0.09);
  add(g, BOX, dark, 0, 0.45, 0.33).scale.set(0.22, 0.16, 0.16);                    // Okular
  for (const s of [-1, 1]) add(g, xCyl, std(0x15191c, { roughness: 0.9 }), 0.19 * s, 0.38, 0.45).scale.set(0.03, 0.14, 0.03);   // Griffe
  for (const s of [-1, 1]) add(g, CYL, steel, 0.2 * s, 0.25, -0.35).scale.set(0.02, 2.4, 0.02);   // Leiter-Holme
  for (let y = FLOOR + 0.3; y < 1.3; y += 0.3) add(g, xCyl, steel, 0, y, -0.35).scale.set(0.015, 0.4, 0.015);
  add(g, new THREE.TorusGeometry(0.32, 0.05, 10, 28), steel, 0, 1.38, -0.35).rotation.x = Math.PI / 2;   // Luke oben

  // Rohre an der Decke und an den Wänden (rot = Wasser, gelb = Luft, silber = Hydraulik)
  for (const [x, y, r, m] of [[-0.45, 1.25, 0.05, red], [-0.3, 1.32, 0.035, yellow], [0.4, 1.27, 0.045, steel], [0.55, 1.18, 0.03, yellow],
    [-1.25, 0.55, 0.04, steel], [-1.28, 0.38, 0.03, red], [1.25, 0.6, 0.045, yellow], [1.3, 0.42, 0.03, steel]]) {
    add(g, zCyl, m, x, y, 0.05).scale.set(r, r, 4.4);
  }
  // Ventilräder und Druckanzeigen an den Wänden (zeigen zur Mitte)
  const needles = [];
  for (const [x, y, z] of [[-1.25, 0.1, -0.9], [-1.25, 0.15, 0.9], [1.25, 0.1, -0.2], [1.25, 0.2, 1.4]]) valve(g, red, x, y, z, x < 0 ? Math.PI / 2 : -Math.PI / 2);
  for (const [x, y, z] of [[-1.2, 0.35, -0.5], [-1.2, 0.35, -0.3], [1.2, 0.4, -0.7], [1.2, 0.4, -0.5], [1.2, 0.4, 0.6], [-1.2, 0.4, 1.3]]) needles.push(gauge(g, brass, x, y, z, x < 0 ? Math.PI / 2 : -Math.PI / 2));
  // Schaltkasten rechts mit Kippschaltern
  add(g, BOX, std(0x5a6a62), 1.2, -0.25, 0.3).scale.set(0.08, 0.5, 0.6);
  for (let i = 0; i < 6; i++) add(g, BOX, steel, 1.15, -0.1 - (i % 2) * 0.2, 0.1 + Math.floor(i / 2) * 0.2).scale.set(0.04, 0.02, 0.02);

  // hinten: Koje links, Spind rechts
  add(g, BOX, steel, -0.8, -0.4, 1.6).scale.set(0.6, 0.06, 1.1);
  add(g, BOX, std(0x506070, { roughness: 0.95, metalness: 0 }), -0.8, -0.33, 1.6).scale.set(0.55, 0.08, 1.05);   // Matratze
  add(g, BOX, std(0x445056), 0.85, -0.3, 1.7).scale.set(0.45, 1.2, 0.7);
  for (let i = 0; i < 3; i++) add(g, BOX, dark, 0.62, 0.1 - i * 0.35, 1.7).scale.set(0.01, 0.02, 0.3);   // Spind-Griffe

  // Feuerlöscher an der linken Wand (rot, mit Halterung und Schlauch)
  add(g, CYL, red, -1.18, -0.55, 0.15).scale.set(0.07, 0.42, 0.07);
  add(g, CYL, dark, -1.18, -0.3, 0.15).scale.set(0.03, 0.08, 0.03);
  add(g, BOX, steel, -1.22, -0.5, 0.15).scale.set(0.02, 0.06, 0.16);
  // Kartentisch rechts hinter dem Sitz: Tisch mit leuchtender Seekarte
  const chartTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 96; const x = c.getContext('2d');
    x.fillStyle = '#0d2a33'; x.fillRect(0, 0, 128, 96); x.strokeStyle = 'rgba(120,220,200,.45)';
    for (let i = 0; i < 9; i++) { x.beginPath(); for (let k = 0; k <= 128; k += 8) x.lineTo(k, 12 + i * 10 + Math.sin(k * 0.08 + i) * 4); x.stroke(); }   // Tiefenlinien
    x.strokeStyle = '#ffd36b'; x.lineWidth = 2; x.beginPath(); x.moveTo(20, 80); x.lineTo(60, 50); x.lineTo(100, 30); x.stroke();   // Kurs
    x.fillStyle = '#ff6b5e'; x.beginPath(); x.arc(100, 30, 4, 0, 7); x.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  add(g, BOX, dark, 0.85, -0.5, -0.55).scale.set(0.5, 0.06, 0.45);
  const chart = add(g, new THREE.PlaneGeometry(0.44, 0.36), new THREE.MeshBasicMaterial({ map: chartTex }), 0.85, -0.465, -0.55); chart.rotation.x = -Math.PI / 2;
  add(g, CYL, steel, 0.85, -0.73, -0.55).scale.set(0.03, 0.4, 0.03);
  // Kabelbündel an der Decke (schwarz, in Haltern)
  for (const x of [-0.15, -0.08, 0.08]) add(g, zCyl, std(0x15181b, { roughness: 0.8 }), x, 1.37, 0.05).scale.set(0.015, 0.015, 4.3);
  for (let z = -1.6; z <= 2.0; z += 0.6) add(g, BOX, steel, 0, 1.33, z).scale.set(0.4, 0.015, 0.03);
  // Lautsprecher der Bordsprechanlage und ein gelbes Notfall-Schild
  add(g, CYL, dark, 0.95, 0.85, -1.2).scale.set(0.08, 0.05, 0.08);
  const sign = add(g, new THREE.PlaneGeometry(0.22, 0.1), new THREE.MeshBasicMaterial({ color: 0xffc94d }), -1.24, 0.75, -1.3); sign.rotation.y = Math.PI / 2;
  // Lampen in Schutzkörben und warmes Licht
  for (const z of [-1.0, 0.6, 1.8]) {
    add(g, SPH, glow(0xffe2b0), 0, 1.3, z).scale.set(0.08, 0.05, 0.08);
    add(g, new THREE.TorusGeometry(0.1, 0.01, 6, 16), steel, 0, 1.28, z).rotation.x = Math.PI / 2;
  }
  // LIGHT = Helligkeit der Lampen innen (größer = heller)
  const LIGHT = { warm: 7, screens: 3 };
  for (const z of [-0.8, 1.2]) { const light = new THREE.PointLight(0xffd9a0, LIGHT.warm, 5, 1.4); light.position.set(0, 1.05, z); g.add(light); }
  const front = new THREE.PointLight(0x9fe8ff, LIGHT.screens, 2.5, 1.6); front.position.set(0, -0.15, -1.6); g.add(front);   // Bildschirm-Licht vorne
  g.add(new THREE.HemisphereLight(0xffe6c8, 0x202820, 0.35));   // etwas Grundlicht, damit nichts ganz schwarz ist

  // jedes Bild: f, s = Steuern (−1…1), t = Zeit, speed = Tempo
  let ang = 0;
  g.userData.update = (dt, f, s, t, speed) => {
    yoke.rotation.set(-f * 0.25, 0, -s * 0.4);
    throttle.rotation.x = -0.6 * Math.min(1, speed / 15) + 0.3;
    needles.forEach((n, i) => { n.rotation.z += Math.sin(t * (1 + i * 0.3)) * dt * 0.2; });
    // Sonar-Bildschirm: grüner Strahl dreht sich
    ang += dt * 2;
    const c = sonarCtx; c.fillStyle = 'rgba(2,20,10,0.25)'; c.fillRect(0, 0, 128, 128);
    c.strokeStyle = 'rgba(90,255,150,0.25)'; c.lineWidth = 1; for (const rr of [20, 40, 60]) { c.beginPath(); c.arc(64, 64, rr, 0, 7); c.stroke(); }
    c.strokeStyle = '#7dffb0'; c.lineWidth = 3; c.beginPath(); c.moveTo(64, 64); c.lineTo(64 + Math.cos(ang) * 62, 64 + Math.sin(ang) * 62); c.stroke();
    sonarMap.needsUpdate = true;
  };
  return g;
}
