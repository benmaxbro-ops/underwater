// Undernite – Einführung für neue Spieler und Tasten-Übersicht (F1).
// Die Einführung kommt beim ersten Battle Royale. Jeder Schritt wartet, bis man es wirklich gemacht hat.
// Danach merkt sich der Browser, dass sie fertig ist (localStorage "un_tutorial").

// Schritte: text = was angezeigt wird, keys = diese Tasten zählen als "gemacht", check(s) = eigene Prüfung
// s = { moved (Meter geschwommen), turned (wie weit umgeschaut), shots, reloaded, dark (ist es dunkel?) }
export const TUT_STEPS = [
  { text: 'Schwimm mit <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>', check: (s) => s.moved > 6 },
  { text: 'Schau dich mit der <b>Maus</b> um', check: (s) => s.turned > 2 },
  { text: 'Hoch mit <kbd>Leertaste</kbd>, runter mit <kbd>X</kbd>', keys: ['Space', 'KeyX', 'KeyC'] },
  { text: 'Hier unten ist es dunkel: Lampe an mit <kbd>L</kbd>', keys: ['KeyL'] },
  { text: 'Schießen mit der <b>linken Maustaste</b>', check: (s) => s.shots > 0 },
  { text: 'Nachladen mit <kbd>R</kbd> – das leere Magazin füllt der Kompressor im Rucksack wieder auf', keys: ['KeyR'] },
  { text: 'Waffe wechseln mit <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> oder dem Mausrad', keys: ['Digit1', 'Digit2', 'Digit3'] },
  { text: 'Sprinten mit <kbd>Shift</kbd> – das kostet Puste (gelber Balken)', keys: ['ShiftLeft', 'ShiftRight'] },
  { text: 'Ego-Sicht an und aus mit <kbd>V</kbd>', keys: ['KeyV'] },
  { text: 'Waffen aufheben, Kisten öffnen, in Fahrzeuge steigen: <kbd>E</kbd> (geh nah ran, unten steht dann ein Hinweis)', keys: ['KeyE'], skipAfter: 25 },
  { text: 'Dein Gadget mit <kbd>Q</kbd>, deine Ulti mit <kbd>4</kbd>, wenn die goldene Leiste voll ist', keys: ['KeyQ', 'Digit4'], skipAfter: 15 },
  { text: 'Oben rechts ist dein <b>Sonar</b>: rote Punkte sind Gegner in der Nähe', skipAfter: 7 },
  { text: 'Bleib im Kreis! Draußen ist <b>Schwarzwasser</b> – das tut weh. Der Letzte, der überlebt, gewinnt. Viel Glück!', skipAfter: 8 },
];
const KEY_HELP = [
  ['W A S D', 'schwimmen'], ['Maus', 'umschauen / zielen'], ['Leertaste / X', 'hoch / runter'], ['Shift', 'sprinten'],
  ['Linke Maustaste', 'schießen'], ['Rechte Maustaste', 'zielen'], ['R', 'nachladen'], ['1 2 3 / Mausrad', 'Waffe wechseln'],
  ['E', 'aufheben, Kiste, Fahrzeug'], ['Q', 'Gadget'], ['4', 'Ulti'], ['G', 'Finisher (Gegner fast tot und nah)'],
  ['H', 'Waffe wegstecken'], ['C', 'am Riff festhalten (Triton, Manta)'], ['V', 'Ego-Sicht'], ['L', 'Lampe'],
  ['B / P', 'im U-Boot aufstehen / Periskop'], ['F1', 'diese Übersicht'], ['Esc', 'Pause'],
];

export function makeTutorial() {
  const box = document.createElement('div'); box.id = 'tut'; box.className = 'hidden';
  box.innerHTML = '<small id="tutN"></small><div id="tutT"></div><button id="tutSkip">Überspringen</button>';
  const help = document.createElement('div'); help.id = 'keyhelp'; help.className = 'hidden';
  help.innerHTML = '<h3>Tasten</h3><table>' + KEY_HELP.map(([k, v]) => `<tr><td><kbd>${k}</kbd></td><td>${v}</td></tr>`).join('') + '</table><small>F1 zum Schließen</small>';
  document.body.append(box, help);
  let done = false; try { done = localStorage.getItem('un_tutorial') === 'done'; } catch {}
  let step = -1, stepT = 0, pressed = new Set(), start = null, yaw0 = 0, turned = 0, lastYaw = null;
  const finish = () => { done = true; step = -1; box.classList.add('hidden'); try { localStorage.setItem('un_tutorial', 'done'); } catch {} };
  box.querySelector('#tutSkip').addEventListener('click', (e) => { e.stopPropagation(); finish(); });
  addEventListener('keydown', (e) => {
    if (e.code === 'F1') { e.preventDefault(); help.classList.toggle('hidden'); return; }
    pressed.add(e.code);
  });
  const show = () => {
    const S = TUT_STEPS[step];
    box.querySelector('#tutN').textContent = `Einführung ${step + 1} / ${TUT_STEPS.length}`;
    box.querySelector('#tutT').innerHTML = S.text; box.classList.remove('hidden');
    box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
    pressed.clear(); stepT = 0;
  };
  return {
    // jedes Bild: playing = läuft eine Battle-Royale-Runde, s = { x, z, yaw, shots, dt }
    update(playing, s) {
      if (done || !playing) { if (!done && step >= 0) box.classList.add('hidden'); return; }
      if (step < 0) { step = 0; start = { x: s.x, z: s.z }; show(); }
      else box.classList.remove('hidden');
      if (lastYaw !== null) turned += Math.abs(s.yaw - lastYaw); lastYaw = s.yaw;
      stepT += s.dt;
      const S = TUT_STEPS[step], st = { moved: Math.hypot(s.x - start.x, s.z - start.z), turned, shots: s.shots };
      const ok = (S.keys && S.keys.some(k => pressed.has(k))) || (S.check && S.check(st)) || (S.skipAfter && stepT > S.skipAfter);
      if (ok && stepT > 0.8) {   // kurz stehen lassen, damit man den Text lesen kann
        step++; if (step >= TUT_STEPS.length) finish(); else { show(); if (step === 1) turned = 0; }
      }
    },
    restart() { done = false; step = -1; try { localStorage.removeItem('un_tutorial'); } catch {} },
  };
}
