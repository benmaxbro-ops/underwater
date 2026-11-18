// Undernite – Musik, komplett im Code erzeugt (keine Dateien, keine Lizenzen).
// Lobby: ruhige, schwebende Akkorde. Im Spiel: dunkler Tiefsee-Klangteppich mit fernen Walrufen.
// Je spannender es wird (Schüsse, Schwarzwasser, wenig Leben), desto mehr kommen pulsierender Bass und leise Trommeln dazu.

// Zum Einstellen: vol = Grundlautstärke, bpm = Tempo der Spannungs-Schicht, chordSec = so lange dauert ein Akkord,
// whale = wie oft ein Walruf kommt (pro Minute)
export const MUSIC = { vol: 0.32, bpm: 96, chordSec: 8, whale: 2.5 };
// Akkorde als Frequenzen (Hertz). Lobby: hell (a-Moll, F-Dur, C-Dur, G-Dur), Spiel: dunkler und tiefer
const N = (semi) => 110 * Math.pow(2, semi / 12);   // 0 = A2 (110 Hertz)
const CHORDS = {
  lobby: [[0, 3, 7, 12], [-4, 0, 3, 8], [3, 7, 10, 15], [-2, 2, 5, 10]],
  play:  [[-12, 0, 3, 7], [-7, -4, 0, 5], [-5, -2, 2, 7], [-9, -5, -2, 3]],
};

export class Music {
  constructor(sfx) { this.sfx = sfx; this.on = false; this.vol = 0.5; this.mode = 'lobby'; this.tension = 0; this.chordI = 0; this.nextChord = 0; this.nextBeat = 0; this.beat = 0; this.nextWhale = 0; }
  start() {
    const ctx = this.sfx.ctx; if (!ctx || this.on) return;
    this.on = true; this.ctx = ctx;
    this.out = ctx.createGain(); this.out.gain.value = MUSIC.vol * this.vol; this.out.connect(this.sfx.master);
    // weicher Hall: zwei Verzögerungen, die sich wiederholen (klingt wie ein großer Raum unter Wasser)
    const d1 = ctx.createDelay(1), d2 = ctx.createDelay(1), fb = ctx.createGain(), lp = ctx.createBiquadFilter();
    d1.delayTime.value = 0.37; d2.delayTime.value = 0.53; fb.gain.value = 0.45; lp.type = 'lowpass'; lp.frequency.value = 1400;
    this.wet = ctx.createGain(); this.wet.gain.value = 0.5;
    this.wet.connect(d1); d1.connect(lp); lp.connect(d2); d2.connect(fb); fb.connect(d1); lp.connect(this.out);
    // Pad-Bus mit Filter (im Spiel dunkler)
    this.padF = ctx.createBiquadFilter(); this.padF.type = 'lowpass'; this.padF.frequency.value = 1100; this.padF.Q.value = 0.7;
    this.pad = ctx.createGain(); this.pad.gain.value = 0.5; this.pad.connect(this.padF); this.padF.connect(this.out); this.padF.connect(this.wet);
    // Spannungs-Bus (Bass und Trommeln), wird mit der Spannung lauter
    this.tens = ctx.createGain(); this.tens.gain.value = 0; this.tens.connect(this.out);
    // tiefes Brummen (Drone) – nur im Spiel hörbar
    this.drone = ctx.createGain(); this.drone.gain.value = 0; this.drone.connect(this.out);
    for (const [f, t] of [[55, 'sine'], [55.4, 'triangle'], [82.4, 'sine']]) { const o = ctx.createOscillator(); o.type = t; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = t === 'triangle' ? 0.12 : 0.25; o.connect(g).connect(this.drone); o.start(); }
    this.nextChord = ctx.currentTime + 0.1; this.nextBeat = ctx.currentTime + 0.5; this.nextWhale = ctx.currentTime + 8;
  }
  setVolume(v) { this.vol = v; if (this.out) this.out.gain.setTargetAtTime(MUSIC.vol * v, this.ctx.currentTime, 0.3); }
  // ein Akkord: jede Note aus zwei leicht verstimmten Tönen, langsam ein- und ausblenden
  chord(notes, t, dur) {
    const ctx = this.ctx;
    for (const n of notes) for (const det of [-4, 4]) {
      const o = ctx.createOscillator(); o.type = this.mode === 'lobby' ? 'triangle' : 'sine'; o.frequency.value = N(n); o.detune.value = det;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06, t + dur * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.15);
      o.connect(g).connect(this.pad); o.start(t); o.stop(t + dur * 1.2);
    }
  }
  // Walruf: ein Ton, der langsam hoch- und wieder runtergleitet, mit Zittern, weit weg (viel Hall)
  whale(t) {
    const ctx = this.ctx, o = ctx.createOscillator(), vib = ctx.createOscillator(), vg = ctx.createGain(), g = ctx.createGain();
    const f0 = 160 + Math.random() * 120; o.type = 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * 1.8, t + 1.2); o.frequency.linearRampToValueAtTime(f0 * 1.2, t + 2.6);
    vib.frequency.value = 5; vg.gain.value = 6; vib.connect(vg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 0.6); g.gain.linearRampToValueAtTime(0.0001, t + 2.8);
    o.connect(g); g.connect(this.wet); o.start(t); vib.start(t); o.stop(t + 3); vib.stop(t + 3);
  }
  // ein Schlag der Spannungs-Schicht: Bass auf jedem Schlag, Trommel auf 1 und 3, Rauschen dazwischen
  beatAt(t, root) {
    const ctx = this.ctx, i = this.beat++ % 8;
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = N(root - 12);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
    g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(f).connect(g).connect(this.tens); o.start(t); o.stop(t + 0.25);
    if (i % 4 === 0) {   // dumpfe Trommel
      const k = ctx.createOscillator(), kg = ctx.createGain(); k.frequency.setValueAtTime(90, t); k.frequency.exponentialRampToValueAtTime(40, t + 0.18);
      kg.gain.setValueAtTime(0.5, t); kg.gain.exponentialRampToValueAtTime(0.001, t + 0.3); k.connect(kg).connect(this.tens); k.start(t); k.stop(t + 0.32);
    }
    if (i % 2 === 1) {   // leises Rauschen (wie ein gedämpftes Becken)
      const s = ctx.createBufferSource(); s.buffer = this.sfx.noiseBuf; const hf = ctx.createBiquadFilter(); hf.type = 'highpass'; hf.frequency.value = 5000;
      const sg = ctx.createGain(); sg.gain.setValueAtTime(0.05, t); sg.gain.exponentialRampToValueAtTime(0.001, t + 0.08); s.connect(hf).connect(sg).connect(this.tens); s.start(t, Math.random()); s.stop(t + 0.1);
    }
  }
  // jedes Bild: mode = 'lobby' oder 'play', tension = 0 (ruhig) … 1 (Kampf)
  update(mode, tension) {
    if (!this.on) { if (this.sfx.ctx) this.start(); else return; }
    const ctx = this.ctx, now = ctx.currentTime;
    if (mode !== this.mode) { this.mode = mode; this.chordI = 0; this.nextChord = now + 0.1; }
    this.tension += (tension - this.tension) * 0.02;
    this.padF.frequency.setTargetAtTime(mode === 'lobby' ? 1100 : 520 + this.tension * 500, now, 0.5);
    this.drone.gain.setTargetAtTime(mode === 'play' ? 0.35 : 0, now, 1.5);
    this.tens.gain.setTargetAtTime(mode === 'play' ? this.tension * 0.9 : 0, now, 0.8);
    const chords = CHORDS[mode] || CHORDS.lobby;
    if (now >= this.nextChord - 0.05) { this.chord(chords[this.chordI % chords.length], this.nextChord, MUSIC.chordSec); this.chordI++; this.nextChord += MUSIC.chordSec; }
    if (mode === 'play' && this.tension > 0.05) { const step = 60 / MUSIC.bpm / 2; while (this.nextBeat < now + 0.2) { this.beatAt(this.nextBeat, chords[(this.chordI + chords.length - 1) % chords.length][0]); this.nextBeat += step; } }
    else this.nextBeat = now + 0.1;
    if (mode === 'play' && now >= this.nextWhale) { this.whale(now + 0.05); this.nextWhale = now + (60 / MUSIC.whale) * (0.6 + Math.random() * 0.8); }
  }
}
