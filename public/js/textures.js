// Undernite – Texturen, die per Code gemalt werden (das Spiel hat keine Bilddateien).
// Jede Textur ist ein kleines Bild auf einer Canvas-Leinwand. Graue "bump"-Texturen machen die
// Oberfläche uneben (hell = Erhebung, dunkel = Vertiefung), ohne dass das Modell mehr Ecken braucht.
import * as THREE from 'three';

const cache = new Map();
// Zufallszahlen mit festem Startwert: so sieht jede Textur jedes Mal gleich aus
export function seeded(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// malt eine Textur (size × size Pixel) und merkt sie sich, repeat = wie oft sie sich wiederholt
function tex(key, size, draw, { color = false, repeat = 1, cached = true } = {}) {
  if (cached && cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  draw(cv.getContext('2d'), size);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 4;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  if (cached) cache.set(key, t);
  return t;
}
// feines Rauschen über ein ganzes Bild (Grundlage für viele Texturen)
function speckle(c, n, R, amount, base = 128) {
  const img = c.getImageData(0, 0, n, n), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const v = Math.max(0, Math.min(255, (d[i] || base) + (R() - 0.5) * amount)); d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  c.putImageData(img, 0, 0);
}

// Neopren (Taucheranzug, Handschuhe): feines Strickmuster mit Nähten
export const neoprene = () => tex('neoprene', 256, (c, n) => {
  const R = seeded(7); c.fillStyle = '#808080'; c.fillRect(0, 0, n, n);
  for (let y = 0; y < n; y += 4) for (let x = 0; x < n; x += 4) { c.fillStyle = (x + y) % 8 ? '#8c8c8c' : '#747474'; c.fillRect(x, y, 3, 3); }
  c.strokeStyle = '#3a3a3a'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, n * 0.5); c.lineTo(n, n * 0.5); c.stroke();          // Naht
  c.strokeStyle = '#a8a8a8'; c.lineWidth = 1; c.setLineDash([4, 4]);
  for (const o of [-5, 5]) { c.beginPath(); c.moveTo(0, n * 0.5 + o); c.lineTo(n, n * 0.5 + o); c.stroke(); }                  // Steppstiche
  speckle(c, n, R, 30);
}, { repeat: 3 });

// Kunststoff-Gehäuse der Waffen: ganz feine Körnung
export const polymer = () => tex('polymer', 256, (c, n) => { const R = seeded(3); c.fillStyle = '#808080'; c.fillRect(0, 0, n, n); speckle(c, n, R, 46); }, { repeat: 6 });

// Griff: Noppen-Muster, damit die Hand nicht abrutscht
export const stipple = () => tex('stipple', 128, (c, n) => {
  c.fillStyle = '#6a6a6a'; c.fillRect(0, 0, n, n);
  for (let y = 0; y < n; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < n; x += 8) {
    const g = c.createRadialGradient(x + 2, y + 2, 0, x + 2, y + 2, 3.5); g.addColorStop(0, '#e0e0e0'); g.addColorStop(1, '#6a6a6a');
    c.fillStyle = g; c.beginPath(); c.arc(x + 2, y + 2, 3.5, 0, 7); c.fill();
  }
}, { repeat: 8 });

// gebürstetes Metall: feine Längsstreifen
export const brushed = () => tex('brushed', 256, (c, n) => {
  const R = seeded(11); c.fillStyle = '#808080'; c.fillRect(0, 0, n, n);
  for (let i = 0; i < 900; i++) { const y = R() * n, v = 90 + R() * 80; c.fillStyle = `rgb(${v},${v},${v})`; c.fillRect(R() * n, y, 20 + R() * 120, 1); }
}, { repeat: 4 });

// Sand am Meeresboden: Körner und kleine Wellenrippel (Farbe wird mit der Bodenfarbe gemischt, deshalb grau)
export const sand = () => tex('sand', 512, (c, n) => {
  const R = seeded(21); c.fillStyle = '#e6d9bd'; c.fillRect(0, 0, n, n);
  // geschwungene Rippel wie echter Sand (kachelbar: die Wellen passen an allen Rändern zusammen)
  const img = c.getImageData(0, 0, n, n), d = img.data, T = Math.PI * 2 / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const w = y + 9 * Math.sin(x * T * 2) + 5 * Math.sin(x * T * 3 + 1.3) + 3 * Math.sin((x + y) * T * 5);   // Welle verbiegen
    const r = Math.sin(w * T * 17), v = 205 + (r > 0 ? r * 26 : r * 14);   // Kamm heller und schmaler als das Tal
    const o = (y * n + x) * 4; d[o] = v + 18; d[o + 1] = v + 6; d[o + 2] = v - 22; d[o + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  for (let i = 0; i < 6000; i++) { const v = 150 + R() * 105; c.fillStyle = `rgb(${v},${v - 4},${v - 10})`; c.fillRect(R() * n, R() * n, 1 + R() * 1.6, 1 + R() * 1.6); }
  for (let i = 0; i < 90; i++) { const v = 120 + R() * 40; c.fillStyle = `rgba(${v},${v},${v},0.6)`; c.beginPath(); c.arc(R() * n, R() * n, 1.5 + R() * 3, 0, 7); c.fill(); }   // Steinchen
  c.lineWidth = 1.4;
  for (let i = 0; i < 40; i++) { c.strokeStyle = `rgba(250,246,236,${0.5 + R() * 0.4})`; const x = R() * n, y = R() * n, a = R() * 6; c.beginPath(); c.arc(x, y, 2 + R() * 3, a, a + 2 + R()); c.stroke(); }   // Muschelstückchen
}, { cached: false });

// Fels: fleckig mit Rissen
export const rock = () => tex('rock', 256, (c, n) => {
  const R = seeded(31); c.fillStyle = '#b8b8b8'; c.fillRect(0, 0, n, n);
  for (let i = 0; i < 260; i++) { const v = 120 + R() * 120, r = 4 + R() * 26; c.fillStyle = `rgba(${v},${v},${v},0.35)`; c.beginPath(); c.arc(R() * n, R() * n, r, 0, 7); c.fill(); }
  c.strokeStyle = 'rgba(60,60,60,0.5)';
  for (let i = 0; i < 26; i++) { c.lineWidth = 0.5 + R() * 1.5; c.beginPath(); let x = R() * n, y = R() * n; c.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (R() - 0.5) * 40; y += (R() - 0.5) * 40; c.lineTo(x, y); } c.stroke(); }
  speckle(c, n, R, 40, 180);
}, { cached: false, repeat: 2 });

// Fels in Farbe: graue Grundfarbe mit Algen (grün/braun), Bewuchs-Krusten (hell) und dunklen Spalten
export const rockColor = () => tex('rockCol', 256, (c, n) => {
  const R = seeded(33); c.fillStyle = '#8c9296'; c.fillRect(0, 0, n, n);
  for (let i = 0; i < 220; i++) { const v = 110 + R() * 70, r = 4 + R() * 22; c.fillStyle = `rgba(${v},${v + 4},${v + 6},0.35)`; c.beginPath(); c.arc(R() * n, R() * n, r, 0, 7); c.fill(); }   // Flecken
  for (let i = 0; i < 260; i++) { const g = R() < 0.6; c.fillStyle = g ? `rgba(80,${105 + R() * 35},70,0.09)` : `rgba(${115 + R() * 25},95,65,0.09)`; c.beginPath(); c.arc(R() * n, R() * n, 3 + R() * 14, 0, 7); c.fill(); }   // Algen grün und braun
  for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(225,220,208,${0.2 + R() * 0.3})`; c.beginPath(); c.arc(R() * n, R() * n, 0.8 + R() * 2.2, 0, 7); c.fill(); }   // helle Krusten (Seepocken)
  c.strokeStyle = 'rgba(30,32,34,0.3)';
  for (let i = 0; i < 26; i++) { c.lineWidth = 0.5 + R() * 1.5; c.beginPath(); let x = R() * n, y = R() * n; c.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (R() - 0.5) * 40; y += (R() - 0.5) * 40; c.lineTo(x, y); } c.stroke(); }   // Spalten
}, { color: true, cached: false, repeat: 2 });

// Korallen: kleine Poren (Polypen)
export const pores = () => tex('pores', 256, (c, n) => {
  const R = seeded(41); c.fillStyle = '#c8c8c8'; c.fillRect(0, 0, n, n);
  for (let i = 0; i < 700; i++) { const x = R() * n, y = R() * n, r = 1.5 + R() * 3; c.fillStyle = '#5a5a5a'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.strokeStyle = '#f0f0f0'; c.lineWidth = 1; c.stroke(); }
}, { cached: false, repeat: 2 });

// Fächerkoralle: ein Netz aus Ästen (weiß = Koralle, durchsichtig = Loch)
export const fanLattice = () => tex('fan', 256, (c, n) => {
  const R = seeded(51); c.clearRect(0, 0, n, n); c.strokeStyle = '#fff'; c.lineCap = 'round';
  const branch = (x, y, a, len, w, depth) => {
    if (depth > 7 || len < 4) return;
    const x2 = x + Math.cos(a) * len, y2 = y - Math.sin(a) * len;
    c.lineWidth = w; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke();
    branch(x2, y2, a + 0.35 + R() * 0.25, len * 0.78, w * 0.75, depth + 1);
    branch(x2, y2, a - 0.35 - R() * 0.25, len * 0.78, w * 0.75, depth + 1);
  };
  branch(n / 2, n, Math.PI / 2, n * 0.22, 7, 0);
  c.lineWidth = 1.2; c.globalAlpha = 0.8;
  for (let i = 0; i < 160; i++) { const x = R() * n, y = R() * n * 0.9; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (R() - 0.5) * 22, y + (R() - 0.5) * 22); c.stroke(); }   // Quer-Verbindungen
}, { cached: false });

// ---------- Gebrauchsspuren für Waffen ----------
// Stahl-Abnutzung (Farbe): brüniertes Gunmetal mit feinen, blank gescheuerten Kratzern und hellen Kanten-Flecken
export const steelWear = () => tex('steelWear', 512, (c, n) => {
  const R = seeded(61); c.fillStyle = '#c4c8cc'; c.fillRect(0, 0, n, n);
  for (let i = 0; i < 1400; i++) { const v = 170 + R() * 60; c.fillStyle = `rgba(${v},${v + 2},${v + 4},0.25)`; c.fillRect(R() * n, R() * n, 1 + R() * 3, 1 + R() * 3); }   // feine Flecken
  c.lineCap = 'round';
  for (let i = 0; i < 260; i++) {   // Kratzer: kurze, leicht gebogene helle Linien
    const x = R() * n, y = R() * n, a = R() * 6.28, l = 4 + R() * 30, w = 0.4 + R() * 0.8;
    c.strokeStyle = `rgba(245,247,250,${0.25 + R() * 0.45})`; c.lineWidth = w;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (R() - 0.5) * 4, y + Math.sin(a) * l * 0.5 + (R() - 0.5) * 4, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
  }
  for (let i = 0; i < 30; i++) { const g = c.createRadialGradient(0, 0, 0, 0, 0, 1); const x = R() * n, y = R() * n, r = 6 + R() * 18;   // blank gescheuerte Stellen
    c.save(); c.translate(x, y); c.scale(r, r * (0.3 + R() * 0.5)); g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 1, 0, 7); c.fill(); c.restore(); }
}, { color: true, repeat: 2 });
// Stahl-Rauheit: wo Kratzer sind, glänzt es mehr (dunkler = glatter)
export const steelRough = () => tex('steelRough', 512, (c, n) => {
  const R = seeded(61); c.fillStyle = '#7a7a7a'; c.fillRect(0, 0, n, n);
  speckle(c, n, R, 50, 122);
  c.lineCap = 'round';
  for (let i = 0; i < 260; i++) { const x = R() * n, y = R() * n, a = R() * 6.28, l = 4 + R() * 30; c.strokeStyle = `rgba(30,30,30,0.6)`; c.lineWidth = 0.6 + R() * 0.8; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
}, { repeat: 2 });
// Polymer: matt mit hellen Schrammen und abgegriffenen, glatteren Stellen
export const polyWear = () => tex('polyWear', 512, (c, n) => {
  const R = seeded(71); c.fillStyle = '#b9bcbf'; c.fillRect(0, 0, n, n);
  for (let i = 0; i < 3000; i++) { const v = 160 + R() * 70; c.fillStyle = `rgba(${v},${v},${v},0.3)`; c.fillRect(R() * n, R() * n, 1, 1); }
  for (let i = 0; i < 90; i++) { const x = R() * n, y = R() * n, a = R() * 6.28, l = 3 + R() * 14; c.strokeStyle = `rgba(235,235,235,${0.2 + R() * 0.3})`; c.lineWidth = 0.5 + R(); c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
}, { color: true, repeat: 2 });
// Gravur: Schrift in den Stahl/Kunststoff geprägt (hell = Buchstaben). Wird als kleines Schild auf die Waffe gesetzt.
const gravCache = new Map();
export function engraving(text, w = 512, h = 64) {
  const k = text + w; if (gravCache.has(k)) return gravCache.get(k);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d');
  c.clearRect(0, 0, w, h); c.font = `600 ${Math.round(h * 0.62)}px "Bahnschrift", "Arial Narrow", sans-serif`; c.textBaseline = 'middle';
  c.fillStyle = 'rgba(0,0,0,0.85)'; c.fillText(text, 6, h / 2 + 1.5);          // Schatten der Vertiefung
  c.fillStyle = 'rgba(205,210,214,0.9)'; c.fillText(text, 5, h / 2);           // helle Kante
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  gravCache.set(k, t); return t;
}
