// Undernite – der Goliath-Mech. Vorbild: echte Panzer-Tauchanzüge (Newtsuit, Exosuit) und Arbeits-Unterwasserroboter (ROVs):
//   gelber, runder Druckkörper · Glaskuppel, in der der Pilot sitzt (innen warmes Licht) · Arme und Beine aus Ringsegmenten
//   mit schwarzen Drehgelenken · Hydraulik-Greifzangen · gelber Auftriebsblock und Propeller in Schutzringen auf dem Rücken
//   · Scheinwerfer und Kamera an den Schultern.
// Alles ist in "Mech-Einheiten" gebaut und am Ende verkleinert (MECH.scale).
import * as THREE from 'three';
import { brushed, polymer, neoprene, engraving } from './textures.js';
// gelb-schwarze Warnstreifen (für Kanten und Gefahrenstellen am Mech)
const STRIPES = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 32; const x = c.getContext('2d'); x.fillStyle = '#e3a51b'; x.fillRect(0, 0, 128, 32); x.fillStyle = '#15181b'; for (let i = -2; i < 10; i++) { x.beginPath(); x.moveTo(i * 16, 32); x.lineTo(i * 16 + 8, 32); x.lineTo(i * 16 + 24, 0); x.lineTo(i * 16 + 16, 0); x.closePath(); x.fill(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();

// paint = Lackfarbe, foam = Auftriebsblock, glass = Kuppel (opacity = wie durchsichtig), cabin = Licht innen in der Kuppel
// dome = Größe der Glaskuppel (nur der Kopf des Piloten schaut raus – kleiner = schwerer zu treffen)
export const MECH = { dome: 0.48, scale: 0.75, paint: 0xe3a51b, foam: 0xf0c02a, steel: 0x9aa5ae, rubber: 0x17191c, cabin: 0xffd49a, cockpitLight: 0xff3a2a, glassOpacity: 0.22 };

const SPH = new THREE.SphereGeometry(1, 40, 28), CYL = new THREE.CylinderGeometry(1, 1, 1, 32), ZCYL = new THREE.CylinderGeometry(1, 1, 1, 32).rotateX(Math.PI / 2);
const RING = new THREE.TorusGeometry(1, 0.16, 14, 40), THIN = new THREE.TorusGeometry(1, 0.06, 10, 40), BOX = new THREE.BoxGeometry(1, 1, 1);
// abgerundeter Kasten (für Auftriebsblock und Platten)
const RBOX = (() => {
  const s = new THREE.Shape(), h = 0.5, r = 0.14;
  s.moveTo(-h + r, -h); s.lineTo(h - r, -h); s.quadraticCurveTo(h, -h, h, -h + r); s.lineTo(h, h - r); s.quadraticCurveTo(h, h, h - r, h);
  s.lineTo(-h + r, h); s.quadraticCurveTo(-h, h, -h, h - r); s.lineTo(-h, -h + r); s.quadraticCurveTo(-h, -h, -h + r, -h);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.72, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.12, bevelSegments: 4, curveSegments: 6 });
  g.translate(0, 0, -0.36); g.computeVertexNormals(); return g;
})();
// Glied-Segment: eine glatte Röhre mit runden Kanten (Höhe 1, Radius 1) – wie die Arme echter Panzer-Tauchanzüge
const BARREL = new THREE.LatheGeometry([[0, -0.5], [0.7, -0.5], [0.92, -0.44], [1, -0.3], [1, 0.3], [0.92, 0.44], [0.7, 0.5], [0, 0.5]].map(([x, y]) => new THREE.Vector2(x, y)), 40);
const ZBARREL = BARREL.clone().rotateX(Math.PI / 2);
// Glanz am Rand der Glaskuppel (man sieht Glas vor allem dort, wo es das Licht spiegelt)
const rimMat = (color, power = 2.5, strength = 0.8) => new THREE.ShaderMaterial({
  uniforms: { c: { value: new THREE.Color(color) } },
  vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
  fragmentShader: `uniform vec3 c; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), ${power.toFixed(1)}); gl_FragColor = vec4(c * f * ${strength.toFixed(2)}, 1.0); }`,
  transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
});
// Druckkörper: rundlich, unten etwas schmaler (Drehkörper aus einem Umriss)
const HULL = new THREE.LatheGeometry([[0, -0.85], [0.62, -0.8], [0.9, -0.5], [1.02, 0], [1.0, 0.35], [0.88, 0.62], [0.62, 0.78], [0, 0.8]].map(([x, y]) => new THREE.Vector2(x, y)), 48);

const at = (parent, geo, mat, x, y, z, sx = 1, sy = sx, sz = sx) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m); return m; };

export function buildMech(accent) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  body.scale.setScalar(MECH.scale); body.position.y = 0.55;
  const paint = new THREE.MeshStandardMaterial({ color: MECH.paint, roughness: 0.42, metalness: 0.25, bumpMap: polymer(), bumpScale: 0.6 });
  const foam = new THREE.MeshStandardMaterial({ color: MECH.foam, roughness: 0.85, metalness: 0, bumpMap: neoprene(), bumpScale: 1.5 });
  const steel = new THREE.MeshStandardMaterial({ color: MECH.steel, roughness: 0.3, metalness: 0.85, bumpMap: brushed(), bumpScale: 0.4 });
  const rubber = new THREE.MeshStandardMaterial({ color: MECH.rubber, roughness: 0.75, metalness: 0.05, bumpMap: neoprene(), bumpScale: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a3138, roughness: 0.5, metalness: 0.5 });
  const acc = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.9, roughness: 0.4 });
  const lens = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f8ff, emissiveIntensity: 2.6, roughness: 0.1 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, roughness: 0.04, metalness: 0.1, transparent: true, opacity: MECH.glassOpacity, depthWrite: false, side: THREE.DoubleSide });
  const cabin = new THREE.MeshBasicMaterial({ color: MECH.cockpitLight, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });

  // ----- Druckkörper mit Bauchring und Brustplatte -----
  at(body, HULL, paint, 0, 0.2, 0, 1.05, 1.0, 0.92);
  at(body, RING, rubber, 0, -0.25, 0, 1.0, 1.0, 0.9).rotation.x = Math.PI / 2;                 // schwarzer Gummiring um den Bauch
  const chest = at(body, RBOX, paint, 0, 0.15, -0.72, 0.95, 0.75, 0.3); chest.rotation.x = 0.12;
  for (const sx of [-1, 1]) at(body, SPH, steel, sx * 0.3, 0.32, -0.9, 0.05);                  // Schrauben an der Brustplatte
  at(body, BOX, acc, 0, -0.08, -0.86, 0.6, 0.05, 0.02);                                       // Farbstreifen (Spielerfarbe)
  // ----- Glaskuppel mit Pilot und Licht innen -----
  const D = MECH.dome, dy = 0.95 + D * 0.55;   // Kuppel sitzt oben auf dem Rumpf, nur so groß wie der Kopf
  at(body, RING, steel, 0, 0.9, -0.15, D + 0.06, D + 0.06, 0.8).rotation.x = Math.PI / 2;     // Metallkragen
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; at(body, SPH, steel, Math.cos(a) * (D + 0.06), 0.98, -0.15 + Math.sin(a) * (D + 0.06), 0.035); }   // Schrauben am Kragen
  const pilot = new THREE.Group(); pilot.position.set(0, dy - 0.04, -0.15); body.add(pilot);   // nur Kopf und Hals schauen in die Kuppel
  at(pilot, SPH, rubber, 0, 0.05, 0.05, 0.2, 0.23, 0.21);                                     // Kopf mit Haube
  at(pilot, SPH, new THREE.MeshStandardMaterial({ color: 0x1c2228, roughness: 0.2, metalness: 0.6 }), 0, 0.04, -0.13, 0.12, 0.07, 0.04);   // Headset
  at(pilot, CYL, rubber, 0, -0.2, 0.05, 0.11, 0.25, 0.11);                                    // Hals (Schultern stecken im Rumpf)
  at(body, SPH, cabin, 0, dy, -0.15, D * 0.85);                                               // Licht innen
  at(body, SPH, glass, 0, dy, -0.15, D);                                                      // die Kuppel selbst
  at(body, SPH, rimMat(0xd8f2ff), 0, dy, -0.15, D + 0.005);                                   // Glanz am Rand der Kuppel
  // ----- mehr Details: Warnstreifen, Nummer, Lüftungsgitter, Hydraulik-Schläuche, Antenne -----
  const stripeM = new THREE.MeshStandardMaterial({ map: STRIPES, roughness: 0.5, metalness: 0.2 });
  at(body, BOX, stripeM, 0, 0.5, -0.86, 0.8, 0.08, 0.02);                                       // Warnstreifen oben an der Brustplatte
  for (const sx of [-1, 1]) at(body, BOX, stripeM, sx * 0.5, -0.62, -0.42, 0.35, 0.06, 0.02);  // Warnstreifen an den Hüften
  const num = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.14), new THREE.MeshStandardMaterial({ map: engraving('G-07', 256, 64), transparent: true, depthWrite: false, roughness: 0.5 }));
  num.position.set(0.18, 0.22, -0.885); num.rotation.y = Math.PI; num.rotation.x = 0.12; body.add(num);   // Nummer auf der Brust
  for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) at(body, BOX, dark, sx * 0.98, 0.05 + i * 0.07, 0.15, 0.03, 0.025, 0.36);   // Lüftungsgitter an den Seiten
  const hoseM = new THREE.MeshStandardMaterial({ color: 0x15181b, roughness: 0.7 });
  for (const sx of [-1, 1]) {   // Hydraulik-Schläuche vom Rucksack zur Schulter
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(sx * 0.7, 0.75, 0.5), new THREE.Vector3(sx * 1.05, 0.95, 0.3), new THREE.Vector3(sx * 1.2, 0.75, 0.05)]);
    body.add(new THREE.Mesh(new THREE.TubeGeometry(c, 16, 0.045, 8), hoseM));
  }
  at(body, CYL, steel, 0.6, 1.55, 1.0, 0.015, 0.7, 0.015); at(body, SPH, new THREE.MeshStandardMaterial({ color: 0xff3a2a, emissive: 0xff3a2a, emissiveIntensity: 2 }), 0.6, 1.92, 1.0, 0.035);   // Antenne mit rotem Licht
  // ----- Rücken: Auftriebsblock, Propeller, Kamera -----
  const pack = new THREE.Group(); pack.position.set(0, 0.55, 0.95); body.add(pack);
  at(pack, RBOX, foam, 0, 0, 0, 1.8, 1.15, 0.9);
  at(pack, BOX, dark, 0, 0.02, -0.05, 1.82, 0.12, 0.92);                                      // schwarzer Streifen
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) at(pack, CYL, steel, sx * 0.86, sy * 0.52, -0.2, 0.05, 0.4, 0.05);   // Rahmenstangen
  const props = [];
  const thruster = (x, y, z, rx, ry) => {   // Propeller in einem Schutzring
    const t = new THREE.Group(); t.position.set(x, y, z); t.rotation.set(rx, ry, 0); body.add(t);
    at(t, RING, dark, 0, 0, 0, 0.34);
    at(t, ZCYL, steel, 0, 0, 0, 0.08, 0.08, 0.28);
    const rot = new THREE.Group(); t.add(rot); props.push(rot);
    for (let i = 0; i < 4; i++) { const b = at(rot, BOX, steel, 0, 0, 0, 0.05, 0.26, 0.015); b.rotation.z = i * Math.PI / 2; b.position.set(Math.sin(i * Math.PI / 2) * 0.14, Math.cos(i * Math.PI / 2) * 0.14, 0); b.rotation.y = 0.5; }
    for (let i = 0; i < 4; i++) { const s = at(t, BOX, dark, 0, 0, 0.02, 0.02, 0.68, 0.02); s.rotation.z = i * Math.PI / 4; }   // Gitter vorne
  };
  thruster(-0.72, 0.15, 1.5, 0, 0); thruster(0.72, 0.15, 1.5, 0, 0);
  thruster(-0.62, 1.22, 0.95, Math.PI / 2, 0); thruster(0.62, 1.22, 0.95, Math.PI / 2, 0);
  // ----- Schulter-Scheinwerfer und Kamera -----
  for (const sx of [-1, 1]) {
    const L = new THREE.Group(); L.position.set(sx * (MECH.dome + 0.2), 0.95 + MECH.dome * 0.55, -0.3); L.rotation.y = -sx * 0.12; body.add(L);   // Scheinwerfer links/rechts an der Kuppel, leicht zur Mitte gedreht
    at(L, ZCYL, dark, 0, 0, 0, 0.13, 0.13, 0.26); at(L, ZCYL, lens, 0, 0, -0.135, 0.105, 0.105, 0.01);
    at(L, THIN, steel, 0, 0, -0.13, 0.13);
  }
  const cam = new THREE.Group(); cam.position.set(0.45, 1.0, -0.5); body.add(cam);
  at(cam, BOX, dark, 0, 0, 0, 0.16, 0.14, 0.24); at(cam, ZCYL, new THREE.MeshStandardMaterial({ color: 0x0a0d10, roughness: 0.05, metalness: 0.9 }), 0, 0, -0.13, 0.05, 0.05, 0.04);
  // ----- Arme: Ringsegmente mit Drehgelenken, Hydraulik-Kolben, Greifzange -----
  const arms = [], legs = [], claws = [];
  // gelbes Röhren-Segment (Länge 2 × len) mit einem schmalen Gelenkring aus Stahl am oberen/hinteren Ende
  const seg = (parent, x, y, z, r, len, axis = 'y') => {
    const s = at(parent, axis === 'y' ? BARREL : ZBARREL, paint, x, y, z, r, axis === 'y' ? len * 2 : r, axis === 'z' ? len * 2 : r);
    if (axis === 'z') s.scale.set(r, r, len * 2);
    const ring = at(parent, THIN, steel, x, y + (axis === 'y' ? len : 0), z + (axis === 'z' ? len : 0), r * 1.02);
    if (axis === 'y') ring.rotation.x = Math.PI / 2;
    return s;
  };
  for (const sx of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(sx * 1.22, 0.55, -0.05); body.add(sh);
    at(sh, SPH, dark, 0, 0, 0, 0.36); at(sh, RING, steel, 0, 0, 0, 0.36).rotation.y = Math.PI / 2;   // Schultergelenk (Drehlager)
    seg(sh, 0, -0.38, 0, 0.3, 0.26); seg(sh, 0, -0.75, 0, 0.27, 0.22);                          // Oberarm
    at(sh, SPH, dark, 0, -1.08, 0, 0.25); at(sh, RING, steel, 0, -1.08, 0, 0.25).rotation.y = Math.PI / 2;   // Ellbogen
    seg(sh, 0, -1.1, -0.35, 0.26, 0.24, 'z'); seg(sh, 0, -1.1, -0.78, 0.24, 0.22, 'z');        // Unterarm nach vorne
    for (const k of [-1, 1]) { const p = at(sh, ZCYL, steel, k * 0.2, -0.9, -0.5, 0.045, 0.045, 0.7); p.rotation.x = 0.28; at(sh, ZCYL, dark, k * 0.2, -0.98, -0.25, 0.06, 0.06, 0.25).rotation.x = 0.28; }   // Hydraulik-Kolben
    at(sh, RING, acc, 0, -1.1, -1.05, 0.2).rotation.y = 0;                                      // Leuchtring am Handgelenk (Spielerfarbe)
    const claw = new THREE.Group(); claw.position.set(0, -1.1, -1.12); sh.add(claw);
    at(claw, ZCYL, steel, 0, 0, 0, 0.17, 0.17, 0.14);
    const fingers = [];
    for (let i = 0; i < 3; i++) {   // drei Greiffinger, die auf- und zugehen
      const f = new THREE.Group(); f.rotation.z = i * TAU3; claw.add(f);
      const hinge = new THREE.Group(); hinge.position.set(0, 0.12, -0.06); f.add(hinge);
      at(hinge, BOX, steel, 0, 0, -0.16, 0.07, 0.06, 0.32); const tip = at(hinge, BOX, dark, 0, -0.05, -0.33, 0.06, 0.12, 0.08); tip.rotation.x = 0.5;
      fingers.push(hinge);
    }
    claws.push(fingers);
    arms.push(sh);
    // ----- Beine -----
    const hip = new THREE.Group(); hip.position.set(sx * 0.5, -0.75, 0.05); body.add(hip);
    at(hip, SPH, dark, 0, 0, 0, 0.32); at(hip, RING, steel, 0, 0, 0, 0.32).rotation.y = Math.PI / 2;   // Hüftgelenk
    seg(hip, 0, -0.45, 0, 0.32, 0.3); seg(hip, 0, -0.9, 0, 0.29, 0.26);
    at(hip, SPH, dark, 0, -1.25, 0, 0.26); at(hip, RING, steel, 0, -1.25, 0, 0.26).rotation.y = Math.PI / 2;   // Knie
    seg(hip, 0, -1.6, 0.02, 0.27, 0.28);
    const foot = at(hip, RBOX, dark, 0, -2.0, -0.12, 0.62, 0.22, 0.95);
    at(hip, BOX, acc, 0, -1.92, -0.6, 0.5, 0.03, 0.02);
    legs.push(hip);
  }
  // Animation: Propeller drehen sich, Greifzangen gehen leicht auf und zu (open 0…1)
  const animate = (dt, speed, open = 0.3) => {
    for (const p of props) p.rotation.z += dt * (4 + speed * 2.5);
    for (const fs of claws) for (const h of fs) h.rotation.x = -0.15 - open * 0.55;
  };
  return { g, legs, arms, mech: true, animate };
}
const TAU3 = Math.PI * 2 / 3;

// =====================================================================
// Ego-Sicht im Mech: man sitzt hinter der Glaskuppel
// =====================================================================
const Z_AXIS = new THREE.Vector3(0, 0, 1);
// Röhre von Punkt A nach Punkt B (gelbes Segment mit Stahlringen und Hydraulik-Kolben daneben)
function limb(parent, A, B, r, paint, steel, dark) {
  const a = new THREE.Vector3(...A), b = new THREE.Vector3(...B), d = b.clone().sub(a), len = d.length(), q = new THREE.Quaternion().setFromUnitVectors(Z_AXIS, d.clone().normalize());
  const n = Math.max(2, Math.round(len / (r * 3.2)));
  for (let i = 0; i < n; i++) {   // mehrere Segmente hintereinander, dazwischen Stahlringe
    const c = a.clone().addScaledVector(d, (i + 0.5) / n), s = new THREE.Mesh(ZBARREL, paint);
    s.position.copy(c); s.quaternion.copy(q); s.scale.set(r, r, len / n * 0.96); parent.add(s);
    const ring = new THREE.Mesh(THIN, steel); ring.position.copy(a.clone().addScaledVector(d, (i + 1) / n)); ring.quaternion.copy(q); ring.scale.setScalar(r * 1.04); parent.add(ring);
  }
  for (const k of [-1, 1]) {   // zwei Hydraulik-Kolben oben auf dem Arm
    const side = new THREE.Vector3(k * r * 0.75, r * 0.85, 0).applyQuaternion(q);
    const p = new THREE.Mesh(ZCYL, steel); p.position.copy(a.clone().addScaledVector(d, 0.55).add(side)); p.quaternion.copy(q); p.scale.set(r * 0.16, r * 0.16, len * 0.6); parent.add(p);
    const p2 = new THREE.Mesh(ZCYL, dark); p2.position.copy(a.clone().addScaledVector(d, 0.85).add(side)); p2.quaternion.copy(q); p2.scale.set(r * 0.24, r * 0.24, len * 0.3); parent.add(p2);
  }
}
// Greifzange um einen Punkt: drei Finger umfassen den Griff. dir = in diese Richtung zeigt die Zange (Handgelenk → Griff)
function claw(parent, at3, dir, r, steel, dark, acc) {
  const g = new THREE.Group(); g.position.set(...at3); g.quaternion.setFromUnitVectors(Z_AXIS, new THREE.Vector3(...dir).normalize()); parent.add(g);
  const w = new THREE.Mesh(ZCYL, steel); w.scale.set(r * 1.1, r * 1.1, r * 0.9); g.add(w);
  const ring = new THREE.Mesh(THIN, acc); ring.position.z = r * 0.45; ring.scale.setScalar(r * 0.9); g.add(ring);
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Group(); f.rotation.z = i * TAU3 + 0.5; g.add(f);
    const h = new THREE.Group(); h.position.set(0, r * 0.9, -r * 0.4); h.rotation.x = 0.55; f.add(h);
    const a = new THREE.Mesh(BOX, steel); a.scale.set(r * 0.45, r * 0.35, r * 1.6); a.position.z = -r * 0.8; h.add(a);
    const tip = new THREE.Mesh(BOX, dark); tip.scale.set(r * 0.42, r * 0.7, r * 0.45); tip.position.set(0, -r * 0.28, -r * 1.6); tip.rotation.x = -0.6; h.add(tip);
  }
  return g;
}
// Roboterarme für die Ego-Sicht, an der Waffe befestigt (gun = userData der Waffe wie bei makeViewArms)
export function makeMechViewArms(gun) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: MECH.paint, roughness: 0.42, metalness: 0.25, bumpMap: polymer(), bumpScale: 0.6 });
  const steel = new THREE.MeshStandardMaterial({ color: MECH.steel, roughness: 0.3, metalness: 0.85, bumpMap: brushed(), bumpScale: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a3138, roughness: 0.5, metalness: 0.5 });
  const acc = new THREE.MeshStandardMaterial({ color: 0x5ef2e0, emissive: 0x5ef2e0, emissiveIntensity: 0.35 });
  const t = gun.gripTop, back = gun.rear + 0.25, r = 0.045;
  // rechter Arm: Zange am Griff, Unterarm nach hinten unten rechts aus dem Bild
  claw(g, [0, t - 0.035, 0.03], [0, 0.35, -1], r, steel, dark, acc);
  limb(g, [0.01, t - 0.06, 0.08], [0.2, t - 0.36, back], r * 1.25, paint, steel, dark);
  // Der Mech hält jede Waffe nur mit der RECHTEN Zange. Die linke bleibt auf ihrer Seite (nur für Finisher und Nachladen).
  const sup = null;
  const left = new THREE.Group(); g.add(left); g.userData.left = sup ? left : null;
  if (sup) {
    claw(left, sup, [0.3, 0.6, -0.7], r * 0.95, steel, dark, acc);
    limb(left, [sup[0] - 0.02, sup[1] - 0.04, sup[2] + 0.05], [-0.24, t - 0.36, back], r * 1.2, paint, steel, dark);
  }
  return g;
}
// Nachlade-Zange des Mechs (Ego-Sicht): gelber Gelenkarm mit Greifzange – kommt von links außen,
// nie ins Cockpit. Gleiche Bedienung wie makeReloadHand (models.js): setArm(handPos, elbowPos) in Waffen-Koordinaten.
export function makeMechReloadHand() {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: MECH.paint, roughness: 0.42, metalness: 0.25, bumpMap: polymer(), bumpScale: 0.6 });
  const steel = new THREE.MeshStandardMaterial({ color: MECH.steel, roughness: 0.3, metalness: 0.85, bumpMap: brushed(), bumpScale: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a3138, roughness: 0.5, metalness: 0.5 });
  const acc = new THREE.MeshStandardMaterial({ color: 0x5ef2e0, emissive: 0x5ef2e0, emissiveIntensity: 0.35 });
  const hand = new THREE.Group(); g.add(hand);
  claw(hand, [0, -0.01, 0.01], [0, 0.9, -0.3], 0.04, steel, dark, acc);   // Zange greift das Magazin von unten
  const arm = new THREE.Mesh(ZBARREL, paint), r1 = new THREE.Mesh(THIN, steel), r2 = new THREE.Mesh(THIN, steel);
  const piston = new THREE.Mesh(ZCYL, steel); g.add(arm, r1, r2, piston);
  const D = new THREE.Vector3(), A = new THREE.Vector3(), Q = new THREE.Quaternion();
  g.userData.setArm = (handPos, elbowPos) => {
    hand.position.copy(handPos);
    A.copy(handPos).add(D.set(0, -0.05, 0.02));   // Handgelenk unter der Zange
    D.copy(elbowPos).sub(A); const len = D.length() || 0.01; D.normalize(); Q.setFromUnitVectors(Z_AXIS, D);
    arm.quaternion.copy(Q); arm.position.copy(A).addScaledVector(D, len / 2); arm.scale.set(0.05, 0.05, len);
    r1.quaternion.copy(Q); r1.position.copy(A).addScaledVector(D, 0.03); r1.scale.setScalar(0.053);
    r2.quaternion.copy(Q); r2.position.copy(A).addScaledVector(D, len * 0.5); r2.scale.setScalar(0.053);
    piston.quaternion.copy(Q); piston.position.copy(A).addScaledVector(D, len * 0.5).add(new THREE.Vector3(0, 0.045, 0)); piston.scale.set(0.008, 0.008, len * 0.6);
  };
  return g;
}
// Cockpit um die Kamera: Kuppelrand (Glas spiegelt am Rand), Metallkragen, Armaturenbrett mit Anzeigen, warmes Licht innen
export function makeCockpit() {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: MECH.steel, roughness: 0.3, metalness: 0.85, bumpMap: brushed(), bumpScale: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x20262c, roughness: 0.6, metalness: 0.4 });
  // Fensterrahmen der Kuppel: ein dicker Metallring mit Schrauben, den man an den Bildrändern sieht (wie bei echten Tauchkugeln)
  const frame = new THREE.Group(); frame.position.set(0, -0.04, -0.62); g.add(frame);
  const fr = new THREE.Mesh(new THREE.TorusGeometry(1, 0.09, 16, 64), steel); fr.scale.set(0.84, 0.6, 0.84); frame.add(fr);
  const gasket = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 10, 64), dark); gasket.scale.set(0.76, 0.545, 0.76); gasket.position.z = -0.01; frame.add(gasket);
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, b = new THREE.Mesh(SPH, steel); b.position.set(Math.cos(a) * 0.84, Math.sin(a) * 0.6, 0.06); b.scale.setScalar(0.018); frame.add(b); }
  // Glas: ganz leicht getönt, mit Lichtspiegelungen (vom Licht innen) und feinen Kratzern
  const pane = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.035, blending: THREE.AdditiveBlending, depthWrite: false }));
  pane.scale.set(0.8, 0.57, 1); pane.position.set(0, -0.04, -0.64); g.add(pane);
  const refl = new THREE.MeshBasicMaterial({ color: 0xfff1d8, transparent: true, opacity: 0.11, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  for (const [x, y, rz, s, arc] of [[-0.3, 0.2, 0.9, 0.3, 0.8], [-0.24, 0.16, 0.9, 0.24, 0.6], [0.38, 0.18, -0.6, 0.2, 0.7]]) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.01, 6, 40, arc), refl); m.position.set(x, y, -0.63); m.rotation.z = rz; m.scale.setScalar(s); g.add(m);
  }
  const scratch = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.018, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(BOX, scratch); s.position.set(-0.5 + Math.random(), -0.3 + Math.random() * 0.5, -0.635); s.scale.set(0.02 + Math.random() * 0.06, 0.0008, 0.001); s.rotation.z = (Math.random() - 0.5) * 1.2; g.add(s); }
  // Armaturenbrett unten im Bild, mit Lämpchen und einem kleinen Display
  const dash = new THREE.Mesh(RBOX, dark); dash.position.set(0, -0.43, -0.58); dash.scale.set(0.95, 0.14, 0.2); dash.rotation.x = -0.5; g.add(dash);
  const leds = [0x5ef2e0, 0xffd36b, 0x7dff9a, 0xff6b5e, 0x5ef2e0, 0x7dff9a];
  leds.forEach((c, i) => { const l = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ color: c })); l.position.set(-0.36 + i * 0.05, -0.375, -0.585); l.scale.set(0.022, 0.01, 0.006); l.rotation.x = -0.5; g.add(l); });
  const scr = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ color: 0x0f4a46 })); scr.position.set(0.3, -0.37, -0.57); scr.scale.set(0.15, 0.07, 0.005); scr.rotation.set(-0.5, -0.2, 0); g.add(scr);
  // Kuppel rundum (sieht man, wenn man im Freelook nach oben oder zur Seite schaut):
  // Glasschale, Metallbögen von links nach rechts, eine Mittelstrebe und eine Luke ganz oben
  const DOME_R = 0.92;
  const shell = new THREE.Mesh(new THREE.SphereGeometry(DOME_R, 48, 24, 0, Math.PI * 2, 0, 1.25),
    new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.04, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide }));
  shell.position.set(0, -0.04, 0.05); g.add(shell);
  for (const z of [-0.3, 0.05, 0.4]) {   // Bögen über dem Kopf
    const r = Math.sqrt(DOME_R * DOME_R - z * z);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(r, 0.022, 10, 56, Math.PI), steel); arch.position.set(0, -0.04, 0.05 + z); g.add(arch);
    for (let i = 1; i < 6; i++) { const a = i / 6 * Math.PI, b = new THREE.Mesh(SPH, steel); b.position.set(Math.cos(a) * r, -0.04 + Math.sin(a) * r, 0.05 + z + 0.02); b.scale.setScalar(0.012); g.add(b); }   // Nieten
  }
  // Mittelstrebe: fängt erst 55° über dem Blick nach vorne an (damit sie geradeaus nicht stört) und läuft über den Kopf nach hinten
  const spineP = new THREE.Group(); spineP.rotation.y = Math.PI / 2; spineP.position.set(0, -0.04, 0.05); g.add(spineP);
  const spine = new THREE.Mesh(new THREE.TorusGeometry(DOME_R, 0.026, 10, 56, Math.PI * 125 / 180), steel); spine.rotation.z = Math.PI * 55 / 180; spineP.add(spine);
  const hatch = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 12, 40), steel); hatch.rotation.x = Math.PI / 2; hatch.position.set(0, DOME_R - 0.06, 0.12); g.add(hatch);   // Luke oben
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 8, 32), dark); wheel.rotation.x = Math.PI / 2; wheel.position.set(0, DOME_R - 0.1, 0.12); g.add(wheel);   // Handrad der Luke
  for (let i = 0; i < 4; i++) { const sp = new THREE.Mesh(BOX, dark); sp.position.set(0, DOME_R - 0.1, 0.12); sp.rotation.y = i * Math.PI / 4; sp.scale.set(0.16, 0.008, 0.008); g.add(sp); }
  for (const s of [-1, 1]) {   // zwei kleine Lampen an den Bögen
    const lamp = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ color: 0xffe2b0 })); lamp.position.set(0.42 * s, 0.72, 0.2); lamp.scale.set(0.06, 0.012, 0.03); lamp.rotation.z = -0.5 * s; g.add(lamp);
  }
  // Steuerhebel links und rechts unten: Sockel mit Gummimanschette, Stange, Griff mit Knöpfen.
  // Sie kippen mit, wenn du steuerst (update unten).
  const rubber = new THREE.MeshStandardMaterial({ color: 0x111417, roughness: 0.95 });
  const grip = new THREE.MeshStandardMaterial({ color: 0x2a3036, roughness: 0.7, metalness: 0.2 });
  const sticks = [];
  for (const s of [-1, 1]) {
    const base = new THREE.Group(); base.position.set(0.44 * s, -0.5, -0.52); base.rotation.x = -0.1; g.add(base);
    const plate = new THREE.Mesh(RBOX, dark); plate.scale.set(0.16, 0.03, 0.14); base.add(plate);
    const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.045, 0.06, 16), rubber); boot.position.y = 0.04; base.add(boot);
    const stick = new THREE.Group(); stick.position.y = 0.03; base.add(stick);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.16, 12), steel); rod.position.y = 0.08; stick.add(rod);
    const hand = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.06, 6, 12), grip); hand.position.set(0, 0.19, 0.005); hand.rotation.x = 0.15; stick.add(hand);
    const top = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ color: s < 0 ? 0xff5040 : 0xffc94d })); top.position.set(0, 0.235, -0.006); top.scale.set(0.016, 0.006, 0.016); stick.add(top);   // Feuerknopf oben
    const hat = new THREE.Mesh(BOX, steel); hat.position.set(0.012 * -s, 0.215, -0.018); hat.scale.set(0.01, 0.01, 0.01); stick.add(hat);   // kleiner Daumenknopf
    sticks.push(stick);
  }
  // Seitenpanele mit Kippschaltern und runden Zeigern (Druck, Hitze)
  const needles = [];
  for (const s of [-1, 1]) {
    const p = new THREE.Group(); p.position.set(0.66 * s, -0.36, -0.6); p.rotation.set(0, -0.75 * s, 0.15 * s); p.scale.setScalar(0.75); g.add(p);
    const board = new THREE.Mesh(RBOX, dark); board.scale.set(0.2, 0.26, 0.02); p.add(board);
    for (let i = 0; i < 3; i++) {   // Kippschalter mit kleinem Licht darüber
      const sw = new THREE.Mesh(BOX, steel); sw.position.set(-0.06 + i * 0.06, -0.07, 0.016); sw.scale.set(0.01, 0.024, 0.01); sw.rotation.x = i === 1 ? -0.5 : 0.5; p.add(sw);
      const l = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ color: [0x7dff9a, 0xffd36b, 0x5ef2e0][i] })); l.position.set(-0.06 + i * 0.06, -0.03, 0.012); l.scale.set(0.012, 0.006, 0.004); p.add(l);
    }
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.01, 32), new THREE.MeshBasicMaterial({ color: 0xd9e6e8 })); dial.rotation.x = Math.PI / 2; dial.position.set(0, 0.05, 0.013); p.add(dial);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.047, 0.006, 8, 32), steel); ring.position.set(0, 0.05, 0.016); p.add(ring);
    const needle = new THREE.Group(); needle.position.set(0, 0.05, 0.02); p.add(needle);
    const nm = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ color: 0xd0302a })); nm.position.y = 0.018; nm.scale.set(0.004, 0.036, 0.002); needle.add(nm);
    needles.push(needle);
  }
  // Bildschirm unten in der Mitte: Rumpf-Leben, Munition, Ulti (wird jedes Bild neu gemalt)
  const scrC = document.createElement('canvas'); scrC.width = 256; scrC.height = 128; const scrX = scrC.getContext('2d'), scrT = new THREE.CanvasTexture(scrC);
  const infoScr = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.11), new THREE.MeshBasicMaterial({ map: scrT, color: 0x5a5a5a }));   // color = Helligkeit (dunkler = weniger Blenden) infoScr.position.set(0, -0.24, -0.58); infoScr.rotation.x = -0.35; g.add(infoScr);
  const scrFrame = new THREE.Mesh(RBOX, dark); scrFrame.position.set(0, -0.243, -0.586); scrFrame.rotation.x = -0.35; scrFrame.scale.set(0.245, 0.135, 0.01); g.add(scrFrame);
  let scrKey = '';
  g.userData.screen = (info) => {   // info = { hp, mhp, ammo, mag, ult }
    const k = info ? [info.hp, info.ammo, info.ult].join('|') : ''; if (k === scrKey) return; scrKey = k;
    const x = scrX; x.fillStyle = '#04140f'; x.fillRect(0, 0, 256, 128); if (!info) { scrT.needsUpdate = true; return; }
    x.font = 'bold 20px monospace'; x.fillStyle = '#7dff9a';
    x.fillText('RUMPF', 12, 30); x.fillText('MUN', 12, 70); x.fillText('ULTI', 12, 108);
    const bar = (y, f, col) => { x.strokeStyle = '#2f6b4a'; x.strokeRect(80, y - 16, 160, 18); x.fillStyle = col; x.fillRect(82, y - 14, 156 * Math.max(0, Math.min(1, f)), 14); };
    bar(30, info.hp / info.mhp, info.hp / info.mhp < 0.3 ? '#ff5a4a' : '#7dff9a'); bar(108, info.ult / 100, info.ult >= 100 ? '#ffc94d' : '#5ef2e0');
    x.fillStyle = '#ffd36b'; x.fillText(info.ammo + ' / ' + info.mag, 90, 70);
    scrT.needsUpdate = true;
  };
  // warmes Licht innen (beleuchtet Kragen, Arme und Waffe)
  const light = new THREE.PointLight(MECH.cockpitLight, 0.7, 2.4, 2); light.position.set(0, 0.3, 0.15); g.add(light);   // leicht rote Beleuchtung innen
  g.userData.light = light;
  // jedes Bild: f = vor/zurück, s = links/rechts (−1…1), t = Zeit. Linker Hebel = Schwimmen, rechter = Drehen/Zielen.
  const tilt = { lx: 0, lz: 0, rx: 0, rz: 0 };
  g.userData.update = (dt, f, s, turn, t) => {
    const k = Math.min(1, dt * 10);
    tilt.lx += (-f * 0.35 - tilt.lx) * k; tilt.lz += (-s * 0.3 - tilt.lz) * k;
    tilt.rx += (0 - tilt.rx) * k; tilt.rz += (Math.max(-0.35, Math.min(0.35, -turn * 0.8)) - tilt.rz) * k;
    sticks[0].rotation.set(tilt.lx, 0, tilt.lz); sticks[1].rotation.set(tilt.rx, 0, tilt.rz);
    needles[0].rotation.z = 0.6 - Math.abs(f) * 0.9 + Math.sin(t * 7) * 0.03;   // Druck: geht hoch, wenn du schwimmst
    needles[1].rotation.z = -0.4 + Math.sin(t * 1.3) * 0.1 + Math.sin(t * 11) * 0.02; // Hitze: zittert leicht
  };
  return g;
}
