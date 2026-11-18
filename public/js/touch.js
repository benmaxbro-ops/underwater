// Undernite – Handy-Steuerung (nur auf Geräten mit Touchscreen).
// Links ein Joystick zum Schwimmen, rechts wischen zum Umschauen, dazu Knöpfe.
// Die Knöpfe tun so, als würde man eine Taste drücken (gleiche Tasten wie am PC) – so funktioniert alles wie gewohnt.

// Zum Einstellen: look = wie schnell man sich beim Wischen dreht, dead = so weit muss man den Joystick schieben, bis man schwimmt
export const TOUCH = { look: 0.006, dead: 0.3, stick: 60 };

export const isTouch = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// api: lookBy(dx, dy) dreht die Kamera, fire(on) schießt, scope(on) zielt, playing() = läuft gerade eine Runde?
export function initTouch(api) {
  if (!isTouch()) return null;
  const key = (code, down) => dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
  const root = document.createElement('div'); root.id = 'touch'; document.body.appendChild(root);
  root.innerHTML = `
    <div class="stick"><i></i></div>
    <div class="tbtns">
      <b data-act="fire" class="big">🔫</b><b data-act="scope">🎯</b>
      <b data-key="Space">⬆</b><b data-key="KeyX">⬇</b><b data-key="KeyR">R</b>
      <b data-key="KeyE">E</b><b data-key="KeyQ">Q</b><b data-key="Digit4">4</b><b data-act="slot">⇄</b><b data-key="KeyV">👁</b><b data-key="ShiftLeft">⚡</b>
    </div>`;
  // ----- Joystick -----
  const stick = root.querySelector('.stick'), knob = stick.querySelector('i');
  let stickId = null, sx = 0, sy = 0;
  const setMove = (dx, dy) => {   // dx/dy von −1 bis 1: in WASD umrechnen
    const want = { KeyW: dy < -TOUCH.dead, KeyS: dy > TOUCH.dead, KeyA: dx < -TOUCH.dead, KeyD: dx > TOUCH.dead };
    for (const k in want) if (want[k] !== !!setMove.state[k]) { setMove.state[k] = want[k]; key(k, want[k]); }
  };
  setMove.state = {};
  stick.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; stickId = t.identifier; const r = stick.getBoundingClientRect(); sx = r.left + r.width / 2; sy = r.top + r.height / 2; e.preventDefault(); }, { passive: false });
  // ----- Umschauen: irgendwo rechts wischen -----
  let lookId = null, lx = 0, ly = 0;
  root.addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) if (t.identifier !== stickId && lookId === null && !t.target.closest('.tbtns') && t.clientX > innerWidth * 0.35) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; }
  }, { passive: true });
  addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) {
        let dx = (t.clientX - sx) / TOUCH.stick, dy = (t.clientY - sy) / TOUCH.stick; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
        knob.style.transform = `translate(${dx * TOUCH.stick * 0.6}px, ${dy * TOUCH.stick * 0.6}px)`; setMove(dx, dy);
      } else if (t.identifier === lookId) { api.lookBy((t.clientX - lx) * TOUCH.look, (t.clientY - ly) * TOUCH.look); lx = t.clientX; ly = t.clientY; }
    }
    if (api.playing()) e.preventDefault();
  }, { passive: false });
  const end = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) { stickId = null; knob.style.transform = ''; setMove(0, 0); }
      if (t.identifier === lookId) lookId = null;
    }
  };
  addEventListener('touchend', end); addEventListener('touchcancel', end);
  // ----- Knöpfe -----
  let slot = 0;
  for (const b of root.querySelectorAll('.tbtns b')) {
    const down = (e) => {
      e.preventDefault(); b.classList.add('on');
      if (b.dataset.key) key(b.dataset.key, true);
      else if (b.dataset.act === 'fire') api.fire(true);
      else if (b.dataset.act === 'scope') { b.scope = !b.scope; api.scope(b.scope); b.classList.toggle('lock', b.scope); }
      else if (b.dataset.act === 'slot') { slot = (slot + 1) % 3; key('Digit' + (slot + 1), true); key('Digit' + (slot + 1), false); }
    };
    const up = (e) => { e.preventDefault(); b.classList.remove('on'); if (b.dataset.key) key(b.dataset.key, false); else if (b.dataset.act === 'fire') api.fire(false); };
    b.addEventListener('touchstart', down, { passive: false }); b.addEventListener('touchend', up, { passive: false }); b.addEventListener('touchcancel', up, { passive: false });
  }
  return { show(on) { root.style.display = on ? 'block' : 'none'; } };
}
