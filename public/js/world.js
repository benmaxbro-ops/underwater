// Undernite - environment rendering: seafloor, flora, wreck, ruins, water
// surface, light shafts, plankton, bubbles, effects and the zone wall.
import * as THREE from 'three';
import { buildReef } from './reef.js';
import { buildProps } from './props.js';
import { sand, rock, rockColor } from './textures.js';
import { SIZE, HALF, GRID_N, SURFACE, EXP_BOAT, deepGlow, DEEP } from './shared.js';
const LAVA_FOG = new THREE.Color(0x4a1206), PRIM_FOG = new THREE.Color(0x061a3a);
import { makeBoat, makeTag } from './models.js';
import { SNOW, makeSnowMaterial } from './water.js';

const TAU = Math.PI * 2;
const CAUSTIC = `
float caustic(vec2 uv, float t){
  vec2 p = mod(uv*6.28318, 6.28318) - 250.0;
  vec2 i = p; float c = 1.0; const float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.0; c = 1.17 - pow(c, 1.4);
  return pow(abs(c), 8.0);
}`;
let causticFade = '1.0';   // expedition: sunlight patterns fade out in the deep
function addCaustics(mat, uTime, strength = 1) {
  const fade = causticFade;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 wp4 = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wp4 = instanceMatrix * wp4;
        #endif
        vWp = (modelMatrix * wp4).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec3 vWp;\n' + CAUSTIC)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { float cz = caustic(vWp.xz * 0.035, uTime * 0.55);
          float df = smoothstep(-25.0, 100.0, vWp.y);
          totalEmissiveRadiance += vec3(0.45, 0.8, 0.85) * cz * (0.10 + 0.5 * df) * ${strength.toFixed(2)} * ${fade}; }`);
  };
  return mat;
}
function noiseTexture(size, draw) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  draw(cv.getContext('2d'), size);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- underwater bases (expedition): floor 1, 50 m deep, around the cliff edge ----------
function buildBase(root, W, B) {
  const c = B.c, g = new THREE.Group(); g.position.set(c.x, c.y, c.z); root.add(g);
  const metal = new THREE.MeshStandardMaterial({ color: 0xd9a63a, roughness: 0.45, metalness: 0.6 });     // yellow station paint
  const steel = new THREE.MeshStandardMaterial({ color: 0x6c7880, roughness: 0.4, metalness: 0.8 });
  const glassM = new THREE.MeshStandardMaterial({ color: 0xbff2ff, transparent: true, opacity: 0.2, roughness: 0.05, metalness: 0.4, depthWrite: false, side: THREE.DoubleSide });
  const glowM = (c, i = 2.5) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i });
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  // platform + stilts down to the slope
  add(new THREE.CylinderGeometry(10, 10, 0.6, 32), metal, 0, -0.3, 0);
  add(new THREE.TorusGeometry(10, 0.18, 8, 48), steel, 0, 0, 0).rotation.x = Math.PI / 2;
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, x = Math.cos(a) * 8.5, z = Math.sin(a) * 8.5;
    const ground = W.heightAt(c.x + x, c.z + z) - c.y, len = Math.max(0.5, -ground + 1);
    if (ground > -0.5) continue;   // that side rests on the cliff
    add(new THREE.CylinderGeometry(0.35, 0.45, len, 10), steel, x, -len / 2, z);
  }
  // glass dome with ribs and a warm light inside
  const dome = new THREE.Group(); dome.position.set(0, 0, -3.5); g.add(dome);
  dome.add(new THREE.Mesh(new THREE.SphereGeometry(4.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), glassM));
  for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.09, 6, 24, Math.PI), steel); r.rotation.y = i / 6 * Math.PI; dome.add(r); }
  const ringB = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.2, 8, 40), metal); ringB.rotation.x = Math.PI / 2; dome.add(ringB);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.9, 16), steel); inner.position.y = 0.45; dome.add(inner);   // console inside
  const lampIn = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), glowM(0xffe2a0, 3)); lampIn.position.y = 3.2; dome.add(lampIn);
  const pl = new THREE.PointLight(0xffd9a0, 30, 18); pl.position.y = 2.5; dome.add(pl);
  // airlock tube on the side
  const tube = add(new THREE.CylinderGeometry(1.1, 1.1, 3.4, 16), metal, -5.4, 1.1, -3.5); tube.rotation.z = Math.PI / 2;
  const hatch = add(new THREE.TorusGeometry(1.1, 0.16, 8, 24), steel, -7.1, 1.1, -3.5); hatch.rotation.y = Math.PI / 2;
  add(new THREE.CircleGeometry(1.0, 20), glowM(0x5ef2e0, 0.8), -7.12, 1.1, -3.5).rotation.y = -Math.PI / 2;
  // round aquarium: glass cylinder with water, sand, plants, rings
  const tank = new THREE.Group(); tank.position.set(0, 0, 5); g.add(tank);   // big enough for bosses
  const tw = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.7, 5.2, 36, 1, true), glassM); tw.position.y = 2.6; tank.add(tw);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 5, 36), new THREE.MeshStandardMaterial({ color: 0x40c8f0, transparent: true, opacity: 0.16, depthWrite: false })); water.position.y = 2.6; tank.add(water);
  for (const y of [0.05, 5.2]) { const r = new THREE.Mesh(new THREE.TorusGeometry(3.75, 0.16, 8, 40), metal); r.rotation.x = Math.PI / 2; r.position.y = y; tank.add(r); }
  const sand = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.3, 32), new THREE.MeshStandardMaterial({ color: 0xe8d6a0, roughness: 1 })); sand.position.y = 0.15; tank.add(sand);
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2, r = 1.8 + (i % 3) * 0.6, h = 0.8 + (i % 4) * 0.35;
    const pl2 = new THREE.Mesh(new THREE.ConeGeometry(0.12, h, 5), new THREE.MeshStandardMaterial({ color: i % 2 ? 0x2f8f4a : 0x3fae5a })); pl2.position.set(Math.cos(a) * r, 0.3 + h / 2, Math.sin(a) * r); tank.add(pl2);
  }
  const tl = new THREE.PointLight(0x9fe8ff, 16, 11); tl.position.y = 4.6; tank.add(tl);
  // beacon on top + a faint light beam up to the surface so you can find it
  const beacon = add(new THREE.SphereGeometry(0.4, 12, 8), glowM(0x5ef2e0, 4), 0, 4.6, -3.5);
  const beam = add(new THREE.CylinderGeometry(0.6, 1.6, 48, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x5ef2e0, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), 0, 28, -3.5);
  let sign = null;
  const setOwner = (text, mine) => { if (sign) { g.remove(sign); sign.material.map.dispose(); sign.material.dispose(); } sign = makeTag(text, mine ? '#ffe066' : '#5ef2e0'); sign.scale.multiplyScalar(2.2); sign.position.set(0, 7.2, 0); g.add(sign); };
  setOwner('Freie Basis', false);
  let t = 0;
  return { group: g, tank, tankR: 2.6, tankH: [0.9, 4.4], setOwner, update(dt) { t += dt; beacon.material.emissiveIntensity = 2.5 + Math.sin(t * 3) * 1.5; beam.material.opacity = 0.05 + Math.sin(t * 3) * 0.02; } };
}

export function buildEnvironment(scene, W) {
  const root = new THREE.Group(); scene.add(root);
  const exp = W.mode === 'exp';
  // Sonnenlicht-Muster am Boden: in der Expedition nur oben, im Battle Royale (Tiefsee) gar nicht
  causticFade = exp ? 'smoothstep(60.0, 115.0, vWp.y)' : '0.0';
  const uTime = { value: 0 };
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), E = new THREE.Euler(), C = new THREE.Color();
  const put = (im, i, x, y, z, rx, ry, rz, sx, sy, sz) => { Q.setFromEuler(E.set(rx, ry, rz)); im.setMatrixAt(i, M4.compose(V.set(x, y, z), Q, S.set(sx, sy, sz))); };

  // ----- seafloor -----
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, GRID_N, GRID_N); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, W.heightAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const nor = geo.attributes.normal, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), slope = 1 - nor.getY(i);
    const rock = THREE.MathUtils.smoothstep(slope, 0.1, 0.38), deep = 1 - THREE.MathUtils.smoothstep(y, -18, 28);
    const j = 0.92 + ((Math.sin(pos.getX(i) * 12.9898 + pos.getZ(i) * 78.233) * 43758.5453) % 1) * 0.08;
    let r = 0.50 + (0.22 - 0.50) * rock, g = 0.45 + (0.26 - 0.45) * rock, b = 0.31 + (0.30 - 0.31) * rock;
    r += (0.12 - r) * deep * 0.7; g += (0.19 - g) * deep * 0.7; b += (0.27 - b) * deep * 0.7;
    if (exp) { const ab = 1 - THREE.MathUtils.smoothstep(y, -200, -40); r += (0.10 - r) * ab * 0.6; g += (0.07 - g) * ab * 0.6; b += (0.18 - b) * ab * 0.6; }
    col[i * 3] = r * j; col[i * 3 + 1] = g * j; col[i * 3 + 2] = b * j;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const sandTex = sand(); sandTex.repeat.set(SIZE / 5, SIZE / 5);   // alle 5 m wiederholt sich das Sandmuster
  const floor = new THREE.Mesh(geo, addCaustics(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, map: sandTex, bumpMap: sandTex, bumpScale: 1.5 }), uTime));
  root.add(floor);

  // ----- rocks -----
  const rg = new THREE.IcosahedronGeometry(1, 3), rp = rg.attributes.position;   // 3 = fein unterteilt (rund statt kantig, aber noch schnell)
  for (let i = 0; i < rp.count; i++) {
    const x = rp.getX(i), y = rp.getY(i), z = rp.getZ(i);
    const n = 1 + 0.16 * Math.sin(x * 5.1 + y * 3.3) * Math.cos(z * 4.7 + x * 2.1) + 0.08 * Math.sin(y * 9 + z * 7);
    rp.setXYZ(i, x * n, y * n, z * n);
  }
  rg.computeVertexNormals();
  const rockTex = rock(), rockCol = rockColor();   // grau für die Unebenheit, farbig (Algen, Krusten) für das Aussehen
  const rocks = new THREE.InstancedMesh(rg, addCaustics(new THREE.MeshStandardMaterial({ color: 0xa8b2b8, roughness: 0.95, map: rockCol, bumpMap: rockTex, bumpScale: 3 }), uTime, 0.8), W.rocks.length);
  W.rocks.forEach((r, i) => put(rocks, i, r.x, r.y, r.z, 0, r.rot, 0, r.r * r.sx, r.r * r.sy, r.r * r.sz));
  root.add(rocks);

  // ----- kelp -----
  const kg = new THREE.PlaneGeometry(0.7, 1, 1, 10).translate(0, 0.5, 0), kp = kg.attributes.position, kc = new Float32Array(kp.count * 3);
  for (let i = 0; i < kp.count; i++) { const t = kp.getY(i); kc[i * 3] = 0.05 + 0.2 * t; kc[i * 3 + 1] = 0.22 + 0.4 * t; kc[i * 3 + 2] = 0.1 + 0.08 * t; kp.setX(i, kp.getX(i) * (1 - t * 0.7)); }
  kg.setAttribute('color', new THREE.BufferAttribute(kc, 3));
  const kmat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  kmat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float kh = position.y;
        #ifdef USE_INSTANCING
          float kph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.21;
        #else
          float kph = 0.0;
        #endif
        transformed.x += sin(uTime * 1.1 + kph + kh * 5.0) * kh * kh * 1.1;
        transformed.z += cos(uTime * 0.9 + kph * 1.3 + kh * 4.0) * kh * kh * 0.7;`);
  };
  const kelp = new THREE.InstancedMesh(kg, kmat, W.kelp.length * 2);
  W.kelp.forEach((k, i) => { put(kelp, i * 2, k.x, k.y, k.z, 0, k.rot, 0, 1.6, k.h, 1.6); put(kelp, i * 2 + 1, k.x, k.y, k.z, 0, k.rot + 1.57, 0, 1.6, k.h * 0.92, 1.6); });
  root.add(kelp);

  // ----- Korallen und Fischschwärme: alles in reef.js -----
  const reef = buildReef(root, W, (m) => addCaustics(m, uTime, 0.8), uTime);

  // ----- ruins -----
  const stone = addCaustics(new THREE.MeshStandardMaterial({ color: 0xa89f86, roughness: 0.9 }), uTime, 0.7);
  const colG = new THREE.CylinderGeometry(1, 1.12, 1, 12).translate(0, 0.5, 0);
  const cols = new THREE.InstancedMesh(colG, stone, W.columns.length);
  W.columns.forEach((c, i) => put(cols, i, c.x, c.y, c.z, 0, 0, 0, c.r, c.h, c.r));
  root.add(cols);
  const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), stone, W.columns.length + W.lintels.length);
  W.columns.forEach((c, i) => put(caps, i, c.x, c.y + c.h + 0.3, c.z, 0, 0, 0, c.r * 2.7, 0.6, c.r * 2.7));
  W.lintels.forEach((l, i) => put(caps, W.columns.length + i, l.x, l.y + 0.6, l.z, 0, l.yaw, 0, l.len, 1.0, 2.2));
  root.add(caps);

  // ----- Schiffswrack, Containerfeld, Flugzeug, Schwarze Raucher, Pipeline, Walskelette, Kleinzeug am Boden: props.js -----
  const props = buildProps(root, W, (m) => addCaustics(m, uTime, 0.7), uTime);

  // ----- expedition: glowing crystals in the deep + trader boat -----
  let boat = null, base = null, bases = [];
  if (exp) {
    if (W.crystals.length) {
      const cg = new THREE.OctahedronGeometry(0.5, 0).scale(0.6, 2.2, 0.6).translate(0, 0.9, 0);
      const cm = new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 0.1, emissive: 0xffffff, emissiveIntensity: 0.9, flatShading: true, transparent: true, opacity: 0.9 });
      const im = new THREE.InstancedMesh(cg, cm, W.crystals.length);
      W.crystals.forEach((c, i) => { put(im, i, c.x, c.y, c.z, c.tilt, c.rot, c.tilt * 0.5, c.s, c.s, c.s); im.setColorAt(i, C.setHex(c.col)); });
      im.instanceColor.needsUpdate = true;
      cm.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= diffuseColor.rgb;'); };
      root.add(im);
    }
    boat = makeBoat(); boat.position.set(EXP_BOAT.x, SURFACE, EXP_BOAT.z); root.add(boat);
    bases = W.bases.map(B => buildBase(root, W, B)); base = bases[0];
  }

  // ----- water surface + light shafts -----
  const surfTex = noiseTexture(256, (c, n) => {
    c.fillStyle = '#7fd8ee'; c.fillRect(0, 0, n, n);
    for (let i = 0; i < 140; i++) { const x = Math.random() * n, y = Math.random() * n, r = 8 + Math.random() * 26; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) { c.beginPath(); c.arc(x + ox, y + oy, r, 0, TAU); c.fill(); } }
  });
  surfTex.repeat.set(26, 26);
  // seen from below: bright, shimmering ceiling
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(SIZE * 2.4, SIZE * 2.4).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ map: surfTex, color: 0xd8fbff }));
  surface.position.y = SURFACE; root.add(surface);
  surface.visible = exp;   // in der Tiefsee sieht man keine Oberfläche
  // seen from above: deep blue sea, slightly see-through
  const seaTop = new THREE.Mesh(new THREE.PlaneGeometry(SIZE * 2.4, SIZE * 2.4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: surfTex, color: 0x2a7aa6, transparent: true, opacity: 0.94, depthWrite: false }));
  seaTop.position.y = SURFACE + 0.02; root.add(seaTop);
  const rayN = 70;
  // Sonnenstrahlen unter Wasser: weicher Rand, oben hell, laufen nach unten aus, flackern mit den Wellen, verschwinden in der Ferne
  const rayMat = new THREE.ShaderMaterial({
    uniforms: { uTime: uTime, uColor: { value: new THREE.Color(0xbff4ff) }, uOp: { value: 0.05 } },
    vertexShader: `
      uniform float uTime; varying float vT; varying float vEdge; varying float vFar; varying float vFlick;
      void main() {
        vec4 lp = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          lp = instanceMatrix * lp;
          vec2 seed = instanceMatrix[3].xz;
        #else
          vec2 seed = vec2(0.0);
        #endif
        vec4 mv = viewMatrix * modelMatrix * lp;
        vec3 n = normalize(mat3(viewMatrix * modelMatrix) * normal);
        vEdge = pow(abs(dot(n, normalize(-mv.xyz))), 2.0);
        vT = (position.y + 40.0) / 80.0;                 // 1 = oben an der Oberfläche, 0 = unten
        vFar = exp(-length(mv.xyz) * 0.012);
        vFlick = 0.55 + 0.45 * sin(uTime * (0.7 + fract(seed.x * 0.37) * 0.8) + seed.y * 0.21) * sin(uTime * 0.33 + seed.x);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uOp; varying float vT; varying float vEdge; varying float vFar; varying float vFlick;
      void main() {
        float a = uOp * vEdge * smoothstep(0.0, 0.75, vT) * smoothstep(1.0, 0.92, vT) * vFar * vFlick;
        gl_FragColor = vec4(uColor * a, 1.0);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  const rays = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.8, 6, 80, 16, 1, true), rayMat, rayN);
  for (let i = 0; i < rayN; i++) put(rays, i, (Math.random() * 2 - 1) * 300, SURFACE - 40, (Math.random() * 2 - 1) * 300, (Math.random() - 0.5) * 0.25, 0, 0.18 + (Math.random() - 0.5) * 0.2, 0.6 + Math.random(), 1, 0.6 + Math.random());
  root.add(rays);

  // ----- Meeresschnee (Schwebeteilchen), blitzt im Lampenkegel auf – Werte in water.js -----
  const PN = SNOW.count, PR = SNOW.radius, pArr = new Float32Array(PN * 3);
  for (let i = 0; i < PN * 3; i++) pArr[i] = (Math.random() * 2 - 1) * PR;
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pArr, 3));
  const snowMat = makeSnowMaterial();
  const plankton = new THREE.Points(pGeo, snowMat);
  plankton.frustumCulled = false; root.add(plankton);

  // ----- bubbles -----
  // Every bubble has its own size: big ones rise faster, all of them wobble on the way
  // up, grow a little (less pressure) and pop at the surface.
  const BN = 2600, bArr = new Float32Array(BN * 3).fill(-9999), bVel = new Float32Array(BN * 3), bLife = new Float32Array(BN);
  const bSize = new Float32Array(BN), bAlpha = new Float32Array(BN), bPh = new Float32Array(BN);
  let bNext = 0;
  const bGeo = new THREE.BufferGeometry();
  bGeo.setAttribute('position', new THREE.BufferAttribute(bArr, 3));
  bGeo.setAttribute('size', new THREE.BufferAttribute(bSize, 1));
  bGeo.setAttribute('alpha', new THREE.BufferAttribute(bAlpha, 1));
  const bTex = noiseTexture(128, (c) => {   // shiny air bubble: clear middle, bright rim, highlights
    c.clearRect(0, 0, 128, 128);
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 62);
    g.addColorStop(0, 'rgba(210,245,255,0.05)'); g.addColorStop(0.7, 'rgba(200,240,255,0.12)');
    g.addColorStop(0.88, 'rgba(230,252,255,0.75)'); g.addColorStop(0.97, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(64, 64, 62, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.95)'; c.beginPath(); c.ellipse(44, 40, 14, 9, -0.7, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.ellipse(86, 90, 7, 4, -0.7, 0, TAU); c.fill();
  });
  const bMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: bTex }, scale: { value: 500 } }, transparent: true, depthWrite: false,
    vertexShader: `attribute float size; attribute float alpha; uniform float scale; varying float vA;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / max(0.1, -mv.z);
        vA = alpha * clamp(1.0 + mv.z / 75.0, 0.0, 1.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; varying float vA; void main() { vec4 c = texture2D(map, gl_PointCoord); gl_FragColor = vec4(c.rgb, c.a * vA); }`,
  });
  const bubbles = new THREE.Points(bGeo, bMat);
  bubbles.frustumCulled = false; root.add(bubbles);
  // size = bubble diameter in metres (0 = random, mostly small); vel > 0 = burst (explosions)
  function bubble(x, y, z, n = 1, spread = 0.3, vel = 0, size = 0) {
    for (let i = 0; i < n; i++) {
      const k = bNext; bNext = (bNext + 1) % BN;
      bArr[k * 3] = x + (Math.random() - 0.5) * spread; bArr[k * 3 + 1] = y + (Math.random() - 0.5) * spread; bArr[k * 3 + 2] = z + (Math.random() - 0.5) * spread;
      const sz = size || 0.03 + Math.random() ** 2.2 * 0.16;
      bSize[k] = sz; bAlpha[k] = 0.9; bPh[k] = Math.random() * TAU;
      bVel[k * 3] = (Math.random() - 0.5) * (0.25 + vel); bVel[k * 3 + 1] = 0.35 + sz * 7 + vel * 0.3; bVel[k * 3 + 2] = (Math.random() - 0.5) * (0.25 + vel);
      bLife[k] = vel > 0 ? 1.5 + Math.random() * 1.5 : Math.min(16, 2.5 + sz * 80);
    }
  }

  // ----- transient effects -----
  const fx = [];
  const boomGeo = new THREE.SphereGeometry(1, 18, 12);
  function explosion(x, y, z, r) {
    const m = new THREE.Mesh(boomGeo, new THREE.MeshBasicMaterial({ color: 0xffc27a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.set(x, y, z); root.add(m);
    fx.push({ m, t: 0, dur: 0.55, upd: (f, k) => { f.m.scale.setScalar(0.5 + r * 0.9 * (1 - (1 - k) * (1 - k))); f.m.material.opacity = 0.9 * (1 - k); } });
    bubble(x, y, z, 45, r * 0.8, 5);
  }
  function ink(x, y, z) {
    const m = new THREE.Mesh(boomGeo, new THREE.MeshBasicMaterial({ color: 0x05060a, transparent: true, opacity: 0.92, depthWrite: false, fog: false }));
    m.position.set(x, y, z); root.add(m);
    fx.push({ m, t: 0, dur: 5, upd: (f, k) => { f.m.scale.setScalar(1 + 5 * Math.sqrt(k)); f.m.material.opacity = 0.92 * (1 - k * k); } });
  }
  function blood(x, y, z) {
    const m = new THREE.Mesh(boomGeo, new THREE.MeshBasicMaterial({ color: 0x7a0a12, transparent: true, opacity: 0.55, depthWrite: false }));
    m.position.set(x, y, z); root.add(m);
    fx.push({ m, t: 0, dur: 2.2, upd: (f, k) => { f.m.scale.setScalar(0.6 + 2.6 * Math.sqrt(k)); f.m.material.opacity = 0.55 * (1 - k); } });
  }

  // ----- zone wall -----
  const zTex = noiseTexture(256, (c, n) => {
    c.fillStyle = '#12021f'; c.fillRect(0, 0, n, n);
    for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(${150 + Math.random() * 90},${40 + Math.random() * 50},255,${0.05 + Math.random() * 0.22})`; const x = Math.random() * n, w = 2 + Math.random() * 10, h = 30 + Math.random() * 140, y = Math.random() * n; c.fillRect(x, y, w, h); c.fillRect(x, y - n, w, h); }
  });
  zTex.repeat.set(40, 2);
  const zoneWall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 240, 96, 1, true), new THREE.MeshBasicMaterial({ map: zTex, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
  zoneWall.position.y = 60; zoneWall.visible = false; zoneWall.renderOrder = 5; root.add(zoneWall);

  // ----- minimap base image -----
  const mini = document.createElement('canvas'); mini.width = mini.height = 128;
  { const c = mini.getContext('2d'), img = c.createImageData(128, 128);
    for (let py = 0; py < 128; py++) for (let px = 0; px < 128; px++) {
      const h = W.heightAt((px / 127 * 2 - 1) * HALF, (py / 127 * 2 - 1) * HALF), k = Math.max(0, Math.min(1, exp ? (h + 230) / 330 : (h + 15) / 110)), o = (py * 128 + px) * 4;
      img.data[o] = 8 + 70 * k * k; img.data[o + 1] = 34 + 120 * k; img.data[o + 2] = 58 + 110 * k; img.data[o + 3] = 255;
    }
    c.putImageData(img, 0, 0); }
  // ----- Sonar-Bild (nur Battle Royale): feiner, grün, mit Höhenlinien alle 8 m; Riff-Hügel geben ein helles Echo -----
  let sonar = null;
  if (!exp) {
    const N = 384; sonar = document.createElement('canvas'); sonar.width = sonar.height = N;
    const c = sonar.getContext('2d'), img = c.createImageData(N, N);
    for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
      const h = W.heightAt((px / (N - 1) * 2 - 1) * HALF, (py / (N - 1) * 2 - 1) * HALF), k = Math.max(0, Math.min(1, (h + 15) / 110));
      const fr = ((h / 8) % 1 + 1) % 1, line = fr < 0.12 ? 0.3 : 0, v = Math.min(1, 0.12 + 0.5 * k + line), o = (py * N + px) * 4;
      img.data[o] = 20 * v; img.data[o + 1] = 230 * v; img.data[o + 2] = 110 * v; img.data[o + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    c.fillStyle = 'rgba(150,255,180,.55)';
    for (const m of W.reefMounds || []) { c.beginPath(); c.arc((m.x + HALF) / SIZE * N, (m.z + HALF) / SIZE * N, Math.max(1, m.r * (m.sx + m.sz) / 2 / SIZE * N), 0, 7); c.fill(); }
  }

  const shallow = new THREE.Color(0x2b8fb0), deepC = new THREE.Color(0x05202e), toxic = new THREE.Color(0x1d0a33), abyss = new THREE.Color(0x010307);
  const LD = new THREE.Vector3();
  return {
    seed: W.seed, mode: W.mode, mini, sonar, bubble, explosion, ink, blood, boat, base, bases, glow: reef.glow,
    // Helmlampe → Meeresschnee leuchtet in ihrem Kegel auf
    setLamp(l) {
      const u = snowMat.uniforms;
      u.uLampOn.value = l.intensity > 0 ? 1 : 0;
      u.uLampPos.value.copy(l.position); u.uLampDir.value.copy(LD.subVectors(l.target.position, l.position).normalize());
      u.uLampCos.value = Math.cos(l.angle); u.uLampRange.value = l.distance || 60;
    },
    update(dt, t, cam, zone, outside) {
      uTime.value = t;
      reef.update(t);
      surfTex.offset.x = t * 0.004; surfTex.offset.y = t * 0.0025;
      zTex.offset.y = -t * 0.12; zTex.offset.x = t * 0.004;
      // plankton wraps around the camera
      const cx = cam.position.x, cy = cam.position.y, cz = cam.position.z;
      props(dt, cx, cz);
      for (let i = 0; i < PN; i++) {
        const o = i * 3;
        let dx = pArr[o] - cx, dy = pArr[o + 1] - cy, dz = pArr[o + 2] - cz;
        if (dx > PR) pArr[o] -= 2 * PR; else if (dx < -PR) pArr[o] += 2 * PR;
        if (dy > PR) pArr[o + 1] -= 2 * PR; else if (dy < -PR) pArr[o + 1] += 2 * PR;
        if (dz > PR) pArr[o + 2] -= 2 * PR; else if (dz < -PR) pArr[o + 2] += 2 * PR;
        pArr[o + 1] += dt * 0.08;
      }
      pGeo.attributes.position.needsUpdate = true;
      for (let i = 0; i < BN; i++) {
        if (bLife[i] <= 0) continue;
        bLife[i] -= dt; const o = i * 3;
        if (bLife[i] <= 0 || bArr[o + 1] > SURFACE - 0.05) { bArr[o + 1] = -9999; bLife[i] = 0; bSize[i] = 0; continue; }
        const sz = bSize[i], wob = 0.12 + sz * 2.2;
        bPh[i] += dt * (5 + 10 * (0.2 - Math.min(0.2, sz)) * 10);
        bArr[o] += (bVel[o] + Math.sin(bPh[i]) * wob) * dt; bArr[o + 1] += bVel[o + 1] * dt; bArr[o + 2] += (bVel[o + 2] + Math.cos(bPh[i] * 0.8) * wob) * dt;
        bVel[o] *= 0.97; bVel[o + 2] *= 0.97;
        bSize[i] = Math.min(0.45, sz * (1 + dt * 0.02));
        bAlpha[i] = Math.min(0.9, bLife[i] * 1.5);
      }
      bGeo.attributes.position.needsUpdate = true; bGeo.attributes.size.needsUpdate = true; bGeo.attributes.alpha.needsUpdate = true;
      bMat.uniforms.scale.value = innerHeight * Math.min(devicePixelRatio, 1.5) / (2 * Math.tan(cam.fov * Math.PI / 360));
      for (let i = fx.length - 1; i >= 0; i--) {
        const f = fx[i]; f.t += dt; const k = Math.min(1, f.t / f.dur); f.upd(f, k);
        if (k >= 1) { root.remove(f.m); f.m.material.dispose(); fx.splice(i, 1); }
      }
      // depth dependent fog / background
      // Expedition: nach 60 m ist das Wasser dunkel. Battle Royale (Tiefsee): immer fast schwarz und man sieht nicht weit
      const d = exp ? Math.max(0, Math.min(1, (SURFACE - cy) / 60)) : 1;
      const fog = scene.fog; fog.color.copy(shallow).lerp(deepC, Math.pow(d, 0.8));
      if (!exp) fog.color.lerp(abyss, 0.7);
      if (outside) fog.color.lerp(toxic, 0.75);
      fog.density = 0.0085 + 0.006 * d + (exp ? 0 : 0.007) + (outside ? 0.012 : 0);
      if (exp) {   // the deeper, the darker
        const dd = Math.max(0, Math.min(1, (SURFACE - cy - 120) / 220));
        fog.color.lerp(abyss, dd); fog.density += 0.008 * dd;
        const g = deepGlow(SURFACE - cy);   // red lava glow on floor 6, blue shimmer on floor 7
        fog.color.lerp(LAVA_FOG, g.lava * 0.9).lerp(PRIM_FOG, g.prim * 0.8);
        boat.userData.update(dt); for (const b of bases) b.update(dt);
        // the guiding light beam only shows once you are deeper down
        boat.userData.beam.material.opacity = 0.07 * Math.max(0, Math.min(1, (SURFACE - cy - 10) / 30));
      }
      // camera above the water: sky, clear air, no plankton or light shafts
      const above = cy > SURFACE;
      if (above) { fog.color.setHex(0xa9d9ef); fog.density = 0.0016; }
      plankton.visible = !above; rays.visible = !above && exp;   // Lichtstrahlen von oben gibt es in der Tiefsee nicht
      // Meeresschnee: ohne Lampe sieht man ihn nur oben im hellen Wasser, in der Tiefe nur im Lichtkegel
      snowMat.uniforms.uDark.value = SNOW.dark + (exp ? 0.55 * Math.max(0, 1 - (SURFACE - cy) / 80) : 0);
      if (!exp) fog.density = -fog.density;   // Tiefsee-Zeichen für water.js: kein Sonnenlicht von oben (Nebel bleibt gleich)
      snowMat.uniforms.uFogDensity.value = Math.abs(fog.density);
      snowMat.uniforms.uScale.value = innerHeight * Math.min(devicePixelRatio, 1.5) / (2 * Math.tan(cam.fov * Math.PI / 360));
      scene.background = fog.color;
      if (zone) { zoneWall.visible = zone[2] > 0.5 && zone[2] < 650; zoneWall.position.set(zone[0], 60, zone[1]); zoneWall.scale.set(zone[2], 1, zone[2]); }
      else zoneWall.visible = false;
    },
    dispose() {
      scene.remove(root);
      root.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
    },
  };
}
