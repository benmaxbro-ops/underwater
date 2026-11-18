// Undernite – Einstellungen: Lautstärke, Maus, Sichtfeld, Grafikqualität, FPS-Anzeige.
// Sie werden im Browser gespeichert (localStorage) und gelten beim nächsten Start wieder.
// Neue Einstellung hinzufügen: in DEFAULTS eintragen, in ROWS eine Zeile dazu, und in main.js bei onSettings anwenden.

// Handy oder Tablet? (Touchscreen als Hauptbedienung) – dann startet das Spiel mit der sparsamen Handy-Grafik
export const IS_PHONE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod/i.test(typeof navigator === 'object' ? navigator.userAgent : '');
export const DEFAULTS = { volume: 0.8, music: 0.5, sens: 1, invertY: false, fov: 72, quality: IS_PHONE ? 'phone' : 'high', fps: false };
// Grafikqualität: pr = Bildauflösung (Pixel pro Bildpunkt), reef = wie dicht die Riffe sind (1 = normal),
// bloom = wie stark Leuchtendes strahlt (0 = aus), ao = weiche Schatten in Spalten und Ecken (Ambient Occlusion)
export const QUALITY = {
  phone: { name: 'Handy',   pr: 0.6,  reef: 0.12, bloom: 0,    ao: false, lens: false },   // so wenig wie möglich, damit das Handy nicht heiß wird
  low:   { name: 'Niedrig', pr: 0.75, reef: 0.35, bloom: 0,    ao: false, lens: true },
  mid:   { name: 'Mittel',  pr: 1,    reef: 0.65, bloom: 0.55, ao: false, lens: true },
  high:  { name: 'Hoch',    pr: 1.5,  reef: 1,    bloom: 0.7,  ao: true,  lens: true },
  ultra: { name: 'Ultra',   pr: 2,    reef: 1.5,  bloom: 0.9,  ao: true,  lens: true,
           warn: '⚠️ Ultra belastet die Grafikkarte sehr stark: Sie kann heiß und laut werden, und das Spiel kann ruckeln. Nur mit einer starken Grafikkarte benutzen.' },
};
const KEY = 'undernite.settings';

function load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* privates Fenster: dann eben ohne Speichern */ } }

export const settings = load();
const listeners = [];
// fn wird sofort und bei jeder Änderung aufgerufen
export function onSettings(fn) { listeners.push(fn); fn(settings); }
export function setSetting(k, v) { settings[k] = v; save(); for (const f of listeners) f(settings, k); }

// ---------- das Menü ----------
// type: 'range' (Schieberegler), 'check' (an/aus), 'select' (Auswahl). fmt = wie der Wert angezeigt wird
const ROWS = [
  { k: 'volume', label: 'Lautstärke', type: 'range', min: 0, max: 1, step: 0.05, fmt: (v) => Math.round(v * 100) + ' %' },
  { k: 'music', label: 'Musik', type: 'range', min: 0, max: 1, step: 0.05, fmt: (v) => Math.round(v * 100) + ' %' },
  { k: 'sens', label: 'Mausempfindlichkeit', type: 'range', min: 0.2, max: 3, step: 0.05, fmt: (v) => v.toFixed(2) + '×' },
  { k: 'invertY', label: 'Maus umkehren (hoch/runter)', type: 'check' },
  { k: 'fov', label: 'Sichtfeld', type: 'range', min: 60, max: 100, step: 1, fmt: (v) => v + '°' },
  { k: 'quality', label: 'Grafikqualität', type: 'select', options: QUALITY, note: 'Leuchten und Schatten gelten sofort, die Riff-Dichte ab der nächsten Runde.' },
  { k: 'fps', label: 'FPS anzeigen (Bilder pro Sekunde)', type: 'check' },
];

export function openSettings() { buildUI(); document.getElementById('settings').classList.remove('hidden'); }
export function closeSettings() { document.getElementById('settings').classList.add('hidden'); }

let built = false;
function buildUI() {
  if (built) return; built = true;
  const box = document.getElementById('setRows');
  for (const r of ROWS) {
    const row = document.createElement('label'); row.className = 'setRow';
    const name = document.createElement('span'); name.textContent = r.label; row.appendChild(name);
    let input;
    if (r.type === 'range') {
      input = document.createElement('input'); input.type = 'range'; input.min = r.min; input.max = r.max; input.step = r.step; input.value = settings[r.k];
      const val = document.createElement('b'); val.className = 'num'; val.textContent = r.fmt(settings[r.k]);
      input.oninput = () => { const v = +input.value; val.textContent = r.fmt(v); setSetting(r.k, v); };
      row.appendChild(input); row.appendChild(val);
    } else if (r.type === 'check') {
      input = document.createElement('input'); input.type = 'checkbox'; input.checked = !!settings[r.k];
      input.onchange = () => setSetting(r.k, input.checked);
      row.appendChild(input);
    } else {
      input = document.createElement('select');
      for (const [id, o] of Object.entries(r.options)) { const op = document.createElement('option'); op.value = id; op.textContent = o.name; input.appendChild(op); }
      input.value = settings[r.k];
      row.appendChild(input);
      // Warnung anzeigen, wenn die gewählte Stufe eine hat (z. B. Ultra)
      const warn = document.createElement('div'); warn.className = 'setWarn';
      const showWarn = () => { const w = r.options[input.value].warn; warn.textContent = w || ''; warn.style.display = w ? '' : 'none'; };
      input.onchange = () => { setSetting(r.k, input.value); showWarn(); };
      box.appendChild(row); box.appendChild(warn); showWarn();
      if (r.note) { const n = document.createElement('div'); n.className = 'setNote'; n.textContent = r.note; box.appendChild(n); }
      continue;
    }
    box.appendChild(row);
    if (r.note) { const n = document.createElement('div'); n.className = 'setNote'; n.textContent = r.note; box.appendChild(n); }
  }
  document.getElementById('setClose').onclick = closeSettings;
  document.getElementById('setReset').onclick = () => { for (const [k, v] of Object.entries(DEFAULTS)) setSetting(k, v); built = false; box.innerHTML = ''; buildUI(); };
}
