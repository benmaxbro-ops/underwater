// Undernite - Sounds (WebAudio). Die Schüsse und das Nachladen sind echte Aufnahmen (CC0, siehe public/sounds/QUELLEN.txt),
// alles andere wird aus Tönen und Rauschen gebaut. Die echten Aufnahmen laufen durch eine Unterwasser-Kette und bekommen
// eine Plasma-Schicht dazu. Hier kannst du drehen:
import { SHOT_CHARGE, WEAPON_IDS } from './shared.js';
export const UNDERWATER = {
  cutoff: 1600,    // Hz: darüber wird es gedämpft (Wasser schluckt hohe Töne). Kleiner = dumpfer
  bass: 7,         // dB: mehr Bass für die Druckwelle
  pitch: 0.88,     // 1 = Originalhöhe, kleiner = tiefer
  wobble: 0.0018,  // wie stark der Klang "wabert" (Sekunden Verzögerungsschwankung)
  echo: 0.32,      // wie viel Echo zurückkommt (0 = keins)
  echoTime: 0.14,  // Sekunden bis zum Echo
  shotBass: 1,     // dB: Bass-Anhebung für eigene Schüsse (klein, sonst überdeckt der Bass den Knall – echte Waffen sind vor allem Mitten und Knall)
  shotCutoff: 11000, // Hz: eigene Schüsse behalten ihren hellen Knall (sonst klingen sie wie ein Spielzeug)
  presence: 8,     // dB: Anhebung bei 2500 Hertz für eigene Schüsse – der Knall kommt "nach vorne" (wie im Tonstudio)
  metal: 0.25,     // metallischer Nachklang (0 = aus). Unter Wasser klingt Kampflärm blechern … (zu viel klingt nach Blechdose)
  metalTime: 0.0045, // … weil Schall im Wasser viermal so schnell ist und von überall gleichzeitig zu kommen scheint
};
// Ein Schuss besteht aus Schichten (wie bei Profi-Spielen):
//   crack = der scharfe Knall-Anfang (die ersten 35 ms, ungefiltert) → das "Snap", das man spürt
//   body  = die Aufnahme selbst (leicht übersteuert)
//   boom  = ein kurzer, straffer Bass-Schlag (kurz, damit schnelle Schüsse nicht verschmieren)
//   mech  = der Verschluss klackt (das Gefühl "ich halte eine Waffe")
//   duck  = alle anderen Geräusche werden im Moment des Schusses kurz leiser → der Schuss wirkt lauter
//   wumms = tiefer Druck-Schlag, den man auch auf Laptop-Lautsprechern hört (Punch bei 80–180 Hertz + Obertöne)
//   sub   = ganz tiefer Bass-Stoß (50–60 Hertz), den man im Bauch spürt – das "Boom"
//   loud  = Gesamtlautstärke aller Schüsse
// duck geht von 0 (nichts wird leiser) bis 0.9 (alles andere fast stumm)
//   harm  = Boom mit Obertönen: der tiefe Schlag wird angezerrt, so hört man ihn auch auf Laptop-Lautsprechern (die keine ganz tiefen Töne können)
//   boomLen = wie lange der Boom nachdröhnt (Sekunden)
// BOOM_BUS = wie laut der Boom-Weg (am Kompressor vorbei) insgesamt ist
export const BOOM_BUS = 0.45;
//   subHz = wie tief der Tiefbass ist (Hertz, kleiner = tiefer) · punch / punchHz = Knall-Boom in der Mitte (Lautstärke / Tonhöhe)
// Abgestimmt nach einer echten Glock 17 (gemessen): am lautesten sind Mitten und Knall, dazu etwas mehr Boom als im Original
export const SHOT = { crack: 3.2, body: 3.6, boom: 1.1, mech: 0.6, duck: 0.6, wumms: 0.6, sub: 0.6, subHz: 78, harm: 1.6, boomLen: 0.45, punch: 4.0, punchHz: 190, loud: 1.4 };
// Holztür-Schlag bei jedem Schuss: vol = Lautstärke bei fremden Schüssen, own = bei eigenen,
// range = bis so viele Meter weit hört man ihn, pitchSmall / pitchBig = Tonhöhe (kleiner = tiefer),
// body = zusätzlicher tiefer Bass-Schlag darunter
// "Ah!" beim Verbrennen: vol = Lautstärke, delay = so viele Sekunden nach der Hitze-Welle
export const AH = { vol: 2.4, delay: 0.35 };
// Treffer in einen Körper: crack = scharfes Knacken, flesh = nasser Einschlag, body = dumpfer Schlag (Lautstärken)
export const HITS = { crack: 0.5, flesh: 1.6, body: 1.4 };
// Schuss knapp vorbei: vol = Lautstärke, pan = wie stark links/rechts (0 = gar nicht, 1 = ganz)
export const WHOOSH = { vol: 1.6, pan: 0.6 };
export const KNOCK = { vol: 1.8, own: 0.5, range: 260, pitchSmall: 0.75, pitchBig: 0.6, body: 1.0 };
export const PLASMA = {
  ring: 0,         // elektrisches Brummen (Ringmodulation): 0 = aus (echte Waffen brummen nicht)
  zap: 0,          // Lautstärke des "Dzzzt" (0 = aus, klang nach Spielzeug-Laser)
};
// ---------- Physik der Gasblase (Rayleigh-Willis-Formel) ----------
// Bei jedem Schuss und jeder Explosion unter Wasser entsteht eine Gasblase. Sie dehnt sich aus, fällt in sich zusammen
// ("Plopp") und schwingt nach – jedes Mal leiser. Wie lange eine Schwingung dauert, hängt von der Ladung W (kg) und der
// Tiefe D (m) ab:   T = 2,11 · W^(1/3) / (D + 10)^(5/6)   Sekunden.
// Je tiefer, desto höher der Wasserdruck → desto schneller schwingt die Blase (in der Tiefsee ein kurzes, hartes "Brrumm").
export const bubblePeriod = (W, depth) => 2.11 * Math.cbrt(W) / Math.pow(Math.max(0, depth) + 10, 5 / 6);
// Ladung (kg) je Waffe – nur für den Klang (Reihenfolge wie WEAPON_IDS)
const CHARGE = [0.004, 0.003, 0.008, 0.01, 0.03, 0.03, 0.006, 0.015, 0.009, 0.002, 0.012, 0.012, 0.004, 0.004, 0.004];
// Schuss-Aufnahme je Waffe (Reihenfolge wie WEAPON_IDS)
const SHOT_FILES = ['shot_glock', 'shot_needler', 'shot_scatter', 'shot_harpoon', 'shot_torpedo', 'shot_torpedo', 'shot_plasma', 'shot_sonic', 'shot_glock', 'shot_needler', 'shot_torpedo', 'shot_plasma', 'shot_pistol', 'shot_pistol', 'shot_pistol'];   // Pistole + Revolver: echte Glock 17
const FILES = [...new Set(SHOT_FILES), 'mag_out', 'mag_in', 'mag_in_rifle', 'slide_back', 'slide_fwd', 'knock_small', 'knock_big', 'burn_ah1', 'burn_ah2', 'hit_flesh', 'hit_body'];
export class Sfx {
  constructor() { this.ctx = null; this.depth = 30; this.vol = 0.8; }
  // Lautstärke aus den Einstellungen (0 … 1)
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = 0.9 * v; if (this.boomBus) this.boomBus.gain.value = BOOM_BUS * v; }
  setDepth(d) { this.depth = d; }   // main.js sagt jedes Bild, wie tief man ist (für die Gasblasen-Physik)
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    // Kompressor am Ende: macht laute Spitzen gleichmäßiger, so kann alles lauter sein, ohne zu übersteuern
    // dahinter wird alles wieder lauter gemacht (makeup) – so klingt es kräftig, ohne zu verzerren (wie ein Limiter im Tonstudio)
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -20; comp.knee.value = 6; comp.ratio.value = 8; comp.attack.value = 0.003; comp.release.value = 0.15;
    const makeup = ctx.createGain(); makeup.gain.value = 2.6;   // wie viel lauter nach dem Kompressor (mehr = lauter, der Begrenzer verhindert Verzerren)
    // weicher Begrenzer ganz am Ende: Spitzen über 1 werden sanft abgerundet statt hart abgehackt (das klang verzerrt und billig)
    const soft = ctx.createWaveShaper(), sc = new Float32Array(2048);
    for (let i = 0; i < 2048; i++) { const x = (i / 1023.5 - 1) * 2; sc[i] = Math.tanh(x * 1.1) * 0.88; }   // 0.88 statt 1: etwas Abstand, weil das Umrechnen (oversample) Spitzen minimal überschwingen lässt
    soft.curve = sc; soft.oversample = '2x';
    const pre = ctx.createGain(); pre.gain.value = 0.5;   // Kurve geht von −2 bis +2
    comp.connect(makeup).connect(pre).connect(soft).connect(ctx.destination);
    this.master = ctx.createGain(); this.master.gain.value = 0.9 * this.vol; this.master.connect(comp);
    // Boom-Weg am Kompressor vorbei: sonst drückt der helle Knall den Boom im selben Moment leiser (er wird "erdrückt").
    // Er geht nur durch den weichen Begrenzer, damit nichts verzerrt. BOOM_BUS = Lautstärke dieses Wegs
    this.boomBus = ctx.createGain(); this.boomBus.gain.value = BOOM_BUS * this.vol; this.boomBus.connect(pre);
    this.world = ctx.createGain(); this.world.connect(this.master);   // alles außer den eigenen Schüssen (wird beim Schuss kurz leiser)
    // noise buffer shared by all noise based sounds
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    // ambient rumble
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 170;
    const g = ctx.createGain(); g.gain.value = 0.5;
    src.connect(lp).connect(g).connect(this.world); src.start();
    this.makeWater();
    this.load();
  }
  // die Aufnahmen laden (bis sie da sind, spielen die gebauten Ersatz-Sounds)
  load() {
    this.bufs = {};
    this.norm = {};   // Schuss-Aufnahmen auf gleiche Lautstärke bringen (manche Dateien sind leiser gespeichert als andere)
    for (const f of FILES) fetch(`./sounds/${f}.wav`).then(r => r.arrayBuffer()).then(b => this.ctx.decodeAudioData(b)).then(buf => {
      // Energie der ersten 0,25 s messen: kurze, knappe Aufnahmen werden so laut gemacht wie die Glock (sonst übertönt der Boom sie)
      if (f.startsWith('shot_')) { const d = buf.getChannelData(0), n = Math.min(d.length, Math.round(buf.sampleRate * 0.25)); let pk = 0, e = 0; for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i])); for (let i = 0; i < n; i++) e += d[i] * d[i]; this.norm[f] = { pk, rms: Math.sqrt(e / n) }; }
      this.bufs[f] = buf; }).catch(() => {});
  }
  // Unterwasser-Kette: Bass rauf → Höhen weg → Wabern (Chorus) → Echo
  makeWater() {
    this.uw = this.chain(UNDERWATER.cutoff, this.world);          // dumpf: Nachladen, Explosionen, Plasma-Zap …
    this.uwShot = this.chain(UNDERWATER.shotCutoff, this.master, UNDERWATER.shotBass, UNDERWATER.presence); // hell: Schüsse (sonst fehlt der Knall)
  }
  // Unterwasser-Kette: Bass rauf → Höhen weg → Wabern (Chorus) → Echo. Gibt den Eingang zurück.
  chain(cutoff, out, bass = UNDERWATER.bass, presence = 0) {
    const ctx = this.ctx, U = UNDERWATER, input = ctx.createGain();
    const shelf = ctx.createBiquadFilter(); shelf.type = 'lowshelf'; shelf.frequency.value = 150; shelf.gain.value = bass;
    const pres = ctx.createBiquadFilter(); pres.type = 'peaking'; pres.frequency.value = 2500; pres.Q.value = 0.9; pres.gain.value = presence;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff; lp.Q.value = 0.7;
    input.connect(shelf).connect(pres).connect(lp).connect(out);
    // Wabern: eine winzige Verzögerung, die 5-mal pro Sekunde schwankt, wird dazugemischt
    const wob = ctx.createDelay(0.05); wob.delayTime.value = 0.008;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5; lg.gain.value = U.wobble; lfo.connect(lg).connect(wob.delayTime); lfo.start();
    const wg = ctx.createGain(); wg.gain.value = 0.4; lp.connect(wob).connect(wg).connect(out);
    // metallischer Nachklang (Kammfilter): eine winzige Verzögerung, die sich immer wieder selbst wiederholt → blechernes Klingeln
    const md = ctx.createDelay(0.05), mfb = ctx.createGain(), mbp = ctx.createBiquadFilter(), mout = ctx.createGain();
    md.delayTime.value = U.metalTime; mfb.gain.value = 0.62; mbp.type = 'bandpass'; mbp.frequency.value = 1400; mbp.Q.value = 0.8; mout.gain.value = U.metal;
    lp.connect(md); md.connect(mbp).connect(mfb).connect(md); mbp.connect(mout).connect(out);
    // Echo: kommt gedämpft zurück und wird jedes Mal leiser
    const ed = ctx.createDelay(1), fb = ctx.createGain(), elp = ctx.createBiquadFilter(), send = ctx.createGain();
    ed.delayTime.value = U.echoTime; fb.gain.value = U.echo; elp.type = 'lowpass'; elp.frequency.value = 650; send.gain.value = 0.4;
    lp.connect(send).connect(ed); ed.connect(elp).connect(fb).connect(ed); elp.connect(out);
    // leichte Übersteuerung (Sättigung) für Schüsse: schneidet Spitzen weich ab → klingt lauter und härter
    const sh = ctx.createWaveShaper(), c = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; c[i] = Math.tanh(x * 2.6) / Math.tanh(2.6); }
    sh.curve = c; sh.connect(input); input.shaper = sh;
    return input;
  }
  // eine Aufnahme abspielen. plasma = wie viel elektrisches Brummen dazukommt. Gibt false zurück, wenn sie noch nicht geladen ist.
  // bus = 'shot' für die helle Schuss-Kette, sonst die dumpfe
  sample(name, vol = 1, { rate = 1, at = 0, plasma = 0, drive = false, bus = '' } = {}) {
    const ctx = this.ctx, buf = this.bufs && this.bufs[name];
    if (!ctx || !buf) return false;
    if (vol < 0.01) return true;
    const t = ctx.currentTime + at, src = ctx.createBufferSource(); src.buffer = buf;
    const r = rate * UNDERWATER.pitch * (0.96 + Math.random() * 0.08);   // jedes Mal minimal anders, klingt natürlicher
    src.playbackRate.value = r;
    const N = this.norm && this.norm[name], G = this.norm && this.norm.shot_glock;
    const k = N && G ? Math.min(4, (0.9 / G.pk) * (G.rms / N.rms)) : N ? 0.9 / N.pk : 1;   // gleiche Energie wie die (auf 0,9 gebrachte) Glock
    const g = ctx.createGain(); g.gain.value = vol * k;
    const into = bus === 'shot' ? this.uwShot : this.uw;
    src.connect(g).connect(drive ? into.shaper : into);
    if (plasma > 0) {
      // Ringmodulation: die Lautstärke wird ~95-mal pro Sekunde zwischen + und − umgeschaltet → elektrisches Brummen
      const rm = ctx.createGain(); rm.gain.value = 0;
      const osc = ctx.createOscillator(); osc.frequency.value = 80 + Math.random() * 30; osc.connect(rm.gain);
      const pg = ctx.createGain(); pg.gain.value = plasma * vol;
      src.connect(rm).connect(pg).connect(into);
      osc.start(t); osc.stop(t + buf.duration / r + 0.05);
    }
    src.start(t);
    return true;
  }
  // Plasma-"Dzzzt": ein Sägezahn-Ton, der von hoch nach tief fällt, durch einen wandernden Filter, dazu Knistern
  zap(big, vol) {
    const ctx = this.ctx; if (!ctx || vol < 0.01) return;
    const t = ctx.currentTime, d = 0.12 + big * 0.12;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(2200 - big * 900, t); o.frequency.exponentialRampToValueAtTime(140, t + d);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 7; bp.frequency.setValueAtTime(4200, t); bp.frequency.exponentialRampToValueAtTime(380, t + d);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(bp).connect(g).connect(this.uw); o.start(t); o.stop(t + d + 0.02);
    for (let i = 0; i < 4; i++) this.noise(0.012, 5000 + Math.random() * 3000, 4, vol * 0.5, 'bandpass', 0, Math.random() * d * 0.7);   // Knistern
  }
  // echter Schuss: Aufnahme (unter Wasser) + Plasma-Brummen + Dzzzt + ein tiefer Druckstoß
  // echter Schuss mit BUM: die Aufnahme (leicht übersteuert für mehr Biss), darunter ein großer Bass-Schlag (BUM),
  // ein dumpfer Druck-Knall, das Plasma-"Dzzzt" und bei Torpedos das "Wusch" der Druckluft
  realShot(w, vol, dist = 0) {
    const name = SHOT_FILES[w] || SHOT_FILES[0], buf = this.bufs && this.bufs[name], ctx = this.ctx;
    if (!buf) return false;
    vol *= SHOT.loud;
    const big = w === 7 ? 1 : w >= 4 && w <= 5 ? 0.95 : w === 6 ? 0.8 : w === 3 ? 0.85 : w === 2 ? 0.75 : w === 0 ? 0.55 : 0.35;
    const t = ctx.currentTime;
    // 1) metallisches Klicken: unter Wasser gibt es keinen hellen Knall, sondern ein hartes "Klick" (Verschluss + Druckwelle)
    const own = vol > 0.95;   // eigener Schuss: man hört ihn auch über die Knochen, also härter. Fremde Schüsse: dumpfer
    this.cur = this.uwShot;
    // Knall-Anfang: ein ganz kurzer, heller Rausch-Stoß (wie der Überschallknall einer echten Waffe) – kein Piepton
    this.noise(0.012, 2500, 0.5, SHOT.crack * vol * (own ? 0.9 : 0.35), 'highpass');
    this.noise(0.03, 1200, 0.9, SHOT.crack * vol * (own ? 0.6 : 0.25), 'bandpass', 500);
    this.cur = null;
    // 2) Körper: die Aufnahme durch die helle Unterwasser-Kette, leicht übersteuert
    this.sample(name, SHOT.body * vol, { plasma: PLASMA.ring, drive: true, bus: own ? 'shot' : '', rate: 1.08 });
    // 3) kurzer, straffer Bass-Schlag (nicht nachklingen lassen, sonst verschmiert es)
    this.cur = this.boomBus;   // Boom-Schichten: am Kompressor vorbei
    this.tone(82 - big * 16, 44, 0.08 + big * 0.08, (1.2 + big * 0.4) * SHOT.boom * vol, 'sine');     // harter, dumpfer Schlag
    // Sub-Boom: sehr tiefer Stoß, der kurz nachwirkt (das spürt man mehr, als man es hört)
    this.tone(SHOT.subHz - big * 12, SHOT.subHz * 0.6, 0.22 + big * 0.25, SHOT.sub * vol * (own ? 1 : 0.5) * (0.6 + big * 0.5), 'sine');
    // Knall-Boom in der Mitte (120–200 Hertz): kurzer, harter Schlag wie eine Bass-Trommel – der "Wumm" in der Brust
    const PU = SHOT.punch * vol * (own ? 1 : 0.6);
    this.tone(SHOT.punchHz - big * 40, SHOT.punchHz * 0.45, 0.1 + big * 0.06, PU, 'sine');
    this.tone((SHOT.punchHz - big * 40) * 2, SHOT.punchHz * 0.9, 0.05, PU * 0.35, 'triangle');   // Oberton, macht ihn knackiger
    this.noise(0.05 + big * 0.03, 320, 0.9, PU * 0.7, 'bandpass', 130);                          // dumpfer Druck-Knall
    this.boomHarm(SHOT.subHz * 0.9 - big * 12, SHOT.boomLen * (0.7 + big * 0.6), SHOT.harm * vol * (own ? 1 : 0.55) * (0.7 + big * 0.4));
    this.tone(130 - big * 30, 60, 0.05, 0.7 * SHOT.boom * vol, 'triangle');
    this.noise(0.05 + big * 0.06, 400, 0.8, 0.5 * SHOT.boom * vol, 'lowpass', 90);
    // 3b) Wumms: der hörbare Druck-Schlag. Grundton fällt von ~150 auf ~55 Hertz, dazu die doppelte Frequenz (Oberton),
    //     damit auch kleine Lautsprecher ihn spielen können. Große Waffen: tiefer und länger.
    const W = SHOT.wumms * vol * (own ? 1 : 0.6), wl = Math.max(0.12, (SHOT_CHARGE[WEAPON_IDS[w]] || 0.1) * 1.6) + big * 0.1;   // so lang wie die Druckwelle
    this.tone(150 - big * 40, 55 - big * 10, wl, 1.1 * W, 'sine');
    this.tone(300 - big * 80, 110 - big * 20, wl * 0.7, 0.45 * W, 'triangle');
    this.noise(wl * 0.8, 220, 1.2, 0.6 * W, 'lowpass', 70);           // dumpfes Druck-Rauschen (Wasser wird weggedrückt)
    this.cur = null;
    // 4) Mechanik: der Verschluss klackt kurz nach dem Schuss (bei Werfern ein dumpfes Klonk)
    this.sample(w === 4 || w === 5 || w === 7 ? 'mag_in' : 'slide_fwd', SHOT.mech * vol * (w === 1 ? 0.5 : 1), { at: 0.02, rate: 1.2, bus: 'shot' });
    // 4b) Physik: Druckstoß, Gasblase und Kavitation
    this.shotPhysics(w, vol, own);
    // 4c) Holztür-Schlag: so hört man Schüsse auch von weit weg (tiefe Töne tragen im Wasser weit)
    this.knock(w, dist, own, big);
    // 5) Plasma-"Dzzzt" (leise darunter) und bei Torpedos das "Wusch"
    this.zap(big, PLASMA.zap * vol * (0.6 + big * 0.4));
    if (w === 4 || w === 5) this.launch(vol);
    // 6) Ducking: alles andere kurz leiser, nur bei eigenen Schüssen (vol = 1)
    if (own && SHOT.duck > 0) {
      const gw = this.world.gain, dk = Math.min(0.9, SHOT.duck); gw.cancelScheduledValues(t); gw.setValueAtTime(gw.value, t);
      gw.linearRampToValueAtTime(1 - dk, t + 0.008); gw.setTargetAtTime(1, t + 0.06, 0.09);
    }
    return true;
  }
  // Boom mit Obertönen: ein tiefer Ton (f Hertz) wird stark angezerrt. Dabei entstehen Obertöne (2×, 3×, 4× f = 100–250 Hertz),
  // die auch kleine Lautsprecher spielen können – das Ohr "rechnet" daraus den tiefen Boom zurück, obwohl er selbst fehlt.
  boomHarm(f, dur, vol) {
    const ctx = this.ctx; if (!ctx || vol <= 0.003) return;
    if (!this.boomCurve) { const c = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; c[i] = Math.tanh(x * 7) / Math.tanh(7); } this.boomCurve = c; }
    const t = ctx.currentTime, o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f * 1.6, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.04); o.frequency.exponentialRampToValueAtTime(f * 0.7, t + dur);   // Schlag fällt schnell ab
    const env = ctx.createGain(); env.gain.setValueAtTime(0.001, t); env.gain.exponentialRampToValueAtTime(1, t + 0.006); env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const sh = ctx.createWaveShaper(); sh.curve = this.boomCurve;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 0.9;   // nur die tiefen Obertöne behalten (sonst schnarrt es)
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = f * 1.7; hp.Q.value = 0.7;   // den Grundton selbst weglassen – nur die Obertöne (sonst wird es zu tief)
    const g = ctx.createGain(); g.gain.value = vol * 1.1;
    o.connect(env).connect(sh).connect(hp).connect(lp).connect(g).connect(this.boomBus || this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  // Schuss wie ein Faustschlag gegen eine Holztür: echter Holzschlag (CC0, siehe QUELLEN.txt), tiefer gestimmt,
  // durch die Unterwasser-Kette mit Echo. Große Waffen: zuschlagende Tür, noch tiefer.
  knock(w, dist, own, big) {
    const v = own ? KNOCK.own : KNOCK.vol * Math.max(0, 1 - dist / KNOCK.range) ** 1.3;
    if (v < 0.02) return;
    const heavy = big >= 0.75, rate = (heavy ? KNOCK.pitchBig : KNOCK.pitchSmall) * (1.1 - big * 0.2);
    this.sample(heavy ? 'knock_big' : 'knock_small', v, { rate, drive: true });
    this.cur = this.uw;   // dazu ein tiefer Körper-Schlag, damit es richtig dumpf wird
    this.tone(120 - big * 45, 45, 0.16 + big * 0.18, 0.9 * v * KNOCK.body, 'sine');
    this.cur = null;
  }
  // ---------- Hitze ----------
  // "Ah!" – verbrannt an der überhitzten Waffe (echte Aufnahme, CC0). Eigener Schrei klingt näher (im Helm), fremde dumpf.
  // Kommt 0,35 s NACH dem Wumms der Hitze-Welle, sonst wird es von ihm übertönt. AH.vol = Lautstärke
  ah(vol = 1) {
    if (vol < 0.03) return;
    this.sample(Math.random() < 0.5 ? 'burn_ah1' : 'burn_ah2', AH.vol * vol, { rate: 1.08 + Math.random() * 0.1, at: AH.delay, bus: vol > 0.95 ? 'shot' : '' });
  }
  // Hitze ablassen – der Wumms: tiefer Druck-Schlag (hörbar auch auf kleinen Lautsprechern), die zuschlagende Tür
  // ganz tief gestimmt und ein langes Grollen, das durchs Wasser rollt. heat 0…1 = wie stark
  ventBoom(vol = 1, heat = 0.5, dist = 0) {
    const v = Math.max(vol, 1.4 * Math.max(0, 1 - dist / 220) ** 1.3);   // tiefe Töne tragen weit
    if (v < 0.03) return;
    const k = 0.6 + heat * 0.6;
    this.cur = this.master;
    this.tone(150, 38, 0.5 + heat * 0.4, 1.4 * v * k, 'sine');                 // Wumms
    this.tone(300, 70, 0.3, 0.5 * v * k, 'triangle');                          // Oberton, damit man ihn überall hört
    this.noise(0.9 + heat * 0.8, 260, 0.9, 0.8 * v * k, 'lowpass', 60);        // Grollen
    this.cur = null;
    this.sample('knock_big', 1.6 * v * k, { rate: 0.45, drive: true });       // zuschlagende Tür, ganz tief
    if (vol > 0.95 && SHOT.duck > 0 && this.world) {                           // alles andere kurz leiser → wirkt lauter
      const t = this.ctx.currentTime, gw = this.world.gain; gw.cancelScheduledValues(t); gw.setValueAtTime(gw.value, t);
      gw.linearRampToValueAtTime(0.35, t + 0.01); gw.setTargetAtTime(1, t + 0.15, 0.25);
    }
  }
  // Hitze ablassen: heißes Zischen, das langsam leiser wird, dazu viele aufsteigende Blasen. heat 0…1 = wie lange und laut
  hiss(vol = 1, heat = 0.5) {
    if (vol < 0.03) return;
    const dur = 0.5 + heat * 1.1;
    this.cur = vol > 0.95 ? this.uwShot : this.uw;
    this.noise(dur, 5200, 0.8, 0.5 * vol, 'highpass', 2600);                   // Zischen
    this.noise(dur * 0.8, 1800, 1.2, 0.35 * vol, 'bandpass', 700);             // Brodeln darunter
    this.tone(90, 40, 0.25, 0.6 * vol, 'sine');                                // dumpfes "Wumpf" beim Ablassen
    for (let i = 0; i < 6 + heat * 14; i++) { const at = Math.random() * dur, p = 160 + Math.random() * 300; this.tone(p, p * 2.2, 0.05, 0.1 * vol, 'sine', at); }   // Blasen
    this.cur = null;
  }
  // Ohrenpfeifen, wenn man benommen ist: hoher, leiser Ton, der langsam verschwindet (im Kopf, nicht unter Wasser)
  tinnitus(sec = 1) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 3600 + Math.random() * 600;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.045, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3 + sec * 2.5);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.4 + sec * 2.5);
  }
  // Aufladen vor dem Schuss: ein Brummen, das lauter und höher wird, dazu Zischen (Druck baut sich auf).
  // Große Waffen brummen tiefer. dur = Sekunden bis zum Schuss.
  charge(w, dur) {
    const ctx = this.ctx; if (!ctx || dur <= 0) return;
    const big = w === 7 ? 1 : w >= 4 && w <= 5 ? 0.95 : w === 6 ? 0.8 : w === 3 ? 0.85 : w === 2 ? 0.75 : w === 0 ? 0.55 : 0.35;
    const t = ctx.currentTime, out = this.uwShot || this.master;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(70 + (1 - big) * 60, t); o.frequency.exponentialRampToValueAtTime(180 + (1 - big) * 260, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(1400, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.35, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.02);
    o.connect(lp).connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
    const n = ctx.createBufferSource(); n.buffer = this.noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.5; bp.frequency.setValueAtTime(500, t); bp.frequency.exponentialRampToValueAtTime(2600, t + dur);
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.001, t); ng.gain.exponentialRampToValueAtTime(0.2, t + dur); ng.gain.linearRampToValueAtTime(0, t + dur + 0.02);
    n.connect(bp).connect(ng).connect(out); n.start(t, Math.random()); n.stop(t + dur + 0.05);
  }
  shotPhysics(w, vol, own) {
    const T = bubblePeriod(CHARGE[w] || 0.004, this.depth), f = Math.min(160, Math.max(35, 0.9 / T));   // Blasen-Schwingzeit und -ton
    this.cur = own ? this.uwShot : this.uw;
    // Druckstoß: wenige Millisekunden, durchs Wasser gedämpft – ein hartes "Tock"
    this.noise(0.006, 1400, 0.7, 0.9 * vol, 'bandpass');
    this.tone(900, 500, 0.008, 0.35 * vol, 'triangle');
    // Gasblase: fällt nach T in sich zusammen ("Plopp") und schwingt 2-mal nach, jedes Mal schwächer
    let at = T, v = 0.75;
    for (let i = 0; i < 3; i++) {
      if (at > 0.006) { this.tone(f * 3.2, f * 1.6, 0.03, v * vol * 0.5, 'sine', at); this.noise(0.035, 700, 1, v * vol * 0.45, 'lowpass', 160, at); }
      this.tone(f * 1.2, f * 0.8, 3 / f, v * vol * 0.6, 'sine', at);   // die Blase "wummert" in ihrer Eigenschwingung
      at += T * (0.72 - i * 0.08); v *= 0.5;
    }
    // Kavitation: die Kugel zieht einen Hohlraum hinter sich her – kurzes "Zzzip" (nur bei kleinen Waffen deutlich)
    if (w <= 3 || w === 6) this.noise(0.13, 3600, 1.6, (own ? 0.22 : 0.1) * vol, 'bandpass', 1100, 0.005);
    // Gasblasen gurgeln nach oben
    for (let i = 0; i < 5; i++) { const a = 0.12 + Math.random() * 0.5, p = 140 + Math.random() * 220; this.tone(p, p * 2.1, 0.05, 0.07 * vol, 'sine', a); }
    this.cur = null;
  }
  // Torpedo-Start: Druckluft stößt ihn raus ("Pfff"), dann läuft der Propeller an ("Wuuusch")
  launch(vol = 1) {
    this.noise(0.35, 500, 0.9, 0.7 * vol, 'bandpass', 2400);
    this.noise(0.9, 900, 1.4, 0.45 * vol, 'bandpass', 300, 0.15);
    this.tone(160, 820, 0.7, 0.12 * vol, 'sawtooth', 0.1);
    for (let i = 0; i < 8; i++) { const at = 0.05 + Math.random() * 0.6, p = 150 + Math.random() * 250; this.tone(p, p * 2.2, 0.06, 0.12 * vol, 'sine', at); }   // Blasen
  }
  noise(dur, freq, q, vol, type = 'bandpass', slide = 0, at = 0) {
    const ctx = this.ctx; if (!ctx || vol <= 0.003) return;
    const t = ctx.currentTime + at, src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.cur || this.world || this.master); src.start(t, Math.random()); src.stop(t + dur + 0.02);
  }
  tone(f0, f1, dur, vol, type = 'sine', at = 0) {
    const ctx = this.ctx; if (!ctx || vol <= 0.003) return;
    const t = ctx.currentTime + at, o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.cur || this.world || this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  shot(w, vol, dist = 0) {
    if (this.realShot(w, vol, dist)) return;
    if (w === 1) { this.noise(0.07, 2600, 2, 0.35 * vol, 'bandpass', 900); this.tone(900, 300, 0.06, 0.12 * vol, 'square'); }
    else if (w === 2) { this.noise(0.22, 900, 0.8, 0.6 * vol, 'lowpass', 200); }
    else if (w === 3) { this.tone(500, 90, 0.25, 0.4 * vol, 'sawtooth'); this.noise(0.18, 1800, 3, 0.3 * vol); }
    else if (w === 6) { this.tone(1400, 400, 0.12, 0.25 * vol, 'sawtooth'); this.noise(0.08, 3000, 2, 0.2 * vol, 'bandpass', 1500); }
    else if (w === 7) { this.tone(90, 40, 0.6, 0.6 * vol, 'sine'); this.tone(300, 60, 0.3, 0.3 * vol, 'square'); }
    else if (w >= 4) { this.tone(160, 60, 0.45, 0.5 * vol, 'sine'); this.noise(0.4, 500, 1, 0.3 * vol, 'lowpass', 120); }
    else { this.noise(0.1, 1500, 1.5, 0.45 * vol, 'bandpass', 500); this.tone(420, 150, 0.09, 0.2 * vol, 'triangle'); }
  }
  // Wasserstrahl mit Druck – ein Schuss in drei Teilen:
  //   A) Aufladen: ein kurzes Hochjaulen (der Druck baut sich auf, ca. 0,06 s)
  //   B) Abschuss: Druckstoß (tiefer Bums), Knall (Ventil), Strahl (Rauschen, das nach oben rast), Nachhall
  //   C) Abschluss: ein tiefes "Bwwww", das ausklingt, und das Ventil klackt zu ("Tschk")
  // big: 0 = kleine Waffe (hell, kurz) … 1 = große Waffe (tief, lang)
  jet(w, vol, dist = 0) {
    if (this.realShot(w, vol, dist)) return;
    const big = w === 6 ? 1 : w === 3 ? 0.9 : w === 2 ? 0.75 : w === 0 ? 0.4 : 0.15;   // Plasmalanze, Harpune, Splitterwerfer, Pistole, Nadler
    const dur = 0.1 + big * 0.12, at = 0.018;                          // at = wann der Abschuss kommt (nach einem ganz kurzen Aufladen)
    // A) Aufladen
    this.tone(400 + big * 80, 1800 - big * 400, at, (0.06 + big * 0.04) * vol, 'sawtooth');
    this.noise(at, 1200, 2, 0.08 * vol, 'bandpass', 3600);
    // B) Abschuss
    this.tone(150 - big * 70, 38, 0.12 + big * 0.1, (0.95 + big * 0.3) * vol, 'sine', at);           // Wumms (stärker)
    this.noise(0.012, 5000, 0.8, (0.7 + big * 0.2) * vol, 'highpass', 0, at);                         // scharfer Knall-Anfang
    this.tone(95 - big * 30, 30, 0.08, 0.35 * vol, 'triangle', at);
    this.noise(0.035, 2600 - big * 900, 1.5, (0.55 + big * 0.2) * vol, 'bandpass', 0, at);
    this.tone(1800 - big * 600, 700, 0.03, 0.12 * vol, 'square', at);
    this.noise(dur, 450 - big * 150, 1.4, (0.5 + big * 0.2) * vol, 'bandpass', 5200 - big * 1600, at + 0.01);
    this.noise(dur * 0.7, 7500, 0.7, 0.14 * vol, 'highpass', 0, at + 0.01);
    this.noise(0.35 + big * 0.3, 380, 0.6, 0.2 * vol, 'lowpass', 90, at + 0.04);
    // C) Abschluss
    const tail = 0.15 + big * 0.3;
    this.tone(210 - big * 60, 65, tail, (0.22 + big * 0.18) * vol, 'sine', at + 0.06);            // Bwwww
    this.tone(105 - big * 30, 50, tail, (0.1 + big * 0.08) * vol, 'triangle', at + 0.06);
    this.tone(1500, 950, 0.025, (0.08 + big * 0.06) * vol, 'square', at + dur + 0.05);            // Ventil klackt zu
    this.noise(0.12, 6000, 0.8, (0.06 + big * 0.05) * vol, 'highpass', 0, at + dur + 0.05);       // Pssst
    // Echo: der Knall kommt gedämpft zweimal zurück (vom Meeresboden und von Felsen)
    for (const [d, v] of [[0.13, 0.32], [0.29, 0.15]]) {
      this.tone(130 - big * 50, 40, 0.16, (0.45 + big * 0.2) * v * vol, 'sine', at + d);
      this.noise(0.2, 650, 0.7, 0.3 * v * vol, 'lowpass', 160, at + d);
    }
  }
  // Durchladen: Schlitten / Spannhebel nach hinten ziehen (metallisches Schaben) und loslassen (Tschak!)
  cockBack() { if (this.sample('slide_back', 0.9)) return; this.noise(0.12, 2600, 3, 0.3, 'bandpass', 1600); this.tone(900, 600, 0.04, 0.15, 'square'); }
  cockRelease() { if (this.sample('slide_fwd', 1, { plasma: 0.15 })) { this.zap(0.2, 0.12); return; } this.tone(1400, 800, 0.03, 0.35, 'square'); this.noise(0.05, 3000, 2, 0.5, 'bandpass'); this.tone(200, 90, 0.08, 0.4, 'sine'); }
  // "Schusch": ein Schuss fliegt knapp an dir vorbei. pan = von welcher Seite (−1 links … +1 rechts)
  // Knapp vorbei: "Schwuuusch". vol 0…1 = wie knapp (1 = ganz knapp), pan −1 (links) … +1 (rechts).
  // Rauschen, dessen Tonhöhe hoch- und wieder runtergeht (Doppler: es kommt auf dich zu … und fliegt weg),
  // dazu ein Druckstoß; ganz knapp zusätzlich ein scharfes "Zipp". Leicht links/rechts, damit man weiß, wo es war. Stärke: WHOOSH
  whoosh(vol, pan = 0) {
    const ctx = this.ctx; if (!ctx || vol < 0.03) return;
    const t = ctx.currentTime, W = WHOOSH, v = Math.min(1, vol) * W.vol, dur = 0.42;
    const out = ctx.createStereoPanner(); out.pan.value = Math.max(-1, Math.min(1, pan)) * W.pan;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6000; out.connect(lp).connect(this.master);   // direkt am Ohr, nur leicht gedämpft
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.9;
    f.frequency.setValueAtTime(380, t); f.frequency.exponentialRampToValueAtTime(3200, t + 0.13); f.frequency.exponentialRampToValueAtTime(320, t + dur);   // kommt näher … und weg
    const g = ctx.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.9 * v, t + 0.12); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(out); src.start(t, Math.random()); src.stop(t + dur + 0.02);
    const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.setValueAtTime(190, t + 0.06); o.frequency.exponentialRampToValueAtTime(70, t + 0.3);   // Druckstoß
    og.gain.setValueAtTime(0.001, t); og.gain.exponentialRampToValueAtTime(0.5 * v, t + 0.11); og.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    o.connect(og).connect(out); o.start(t); o.stop(t + 0.35);
    if (vol > 0.6) {   // ganz knapp: scharfes Zipp (Kugel reißt das Wasser direkt neben dem Kopf auf)
      const z = ctx.createBufferSource(); z.buffer = this.noiseBuf; const zf = ctx.createBiquadFilter(); zf.type = 'highpass'; zf.frequency.value = 3500;
      const zg = ctx.createGain(); zg.gain.setValueAtTime(0.001, t + 0.1); zg.gain.exponentialRampToValueAtTime(0.7 * v, t + 0.115); zg.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
      z.connect(zf).connect(zg).connect(out); z.start(t + 0.1, Math.random()); z.stop(t + 0.2);
      const zt = ctx.createOscillator(), zt2 = ctx.createGain(); zt.type = 'sawtooth'; zt.frequency.setValueAtTime(2800, t + 0.1); zt.frequency.exponentialRampToValueAtTime(500, t + 0.2);
      zt2.gain.setValueAtTime(0.001, t + 0.1); zt2.gain.exponentialRampToValueAtTime(0.08 * v, t + 0.11); zt2.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      zt.connect(zt2).connect(out); zt.start(t + 0.1); zt.stop(t + 0.24);
    }
  }
  // ---------- Magazin wechseln ----------
  magOut() { if (this.sample('mag_out', 0.9)) return; this.tone(1500, 1100, 0.03, 0.22, 'square'); this.noise(0.12, 1800, 2, 0.25, 'bandpass', 900, 0.02); }          // Klick – Magazin löst sich und rutscht raus
  stow() {                                                                                                                       // ins Rucksack-Fach stecken, Kompressor zischt kurz
    this.noise(0.18, 700, 1, 0.22, 'lowpass', 300); this.tone(220, 120, 0.08, 0.25, 'square', 0.1);
    this.noise(0.35, 5000, 1, 0.08, 'highpass', 0, 0.15);
  }
  magGrab() { this.noise(0.1, 900, 1, 0.18, 'lowpass', 400); this.tone(900, 700, 0.03, 0.12, 'square', 0.05); }                // neues Magazin aus dem Fach ziehen
  magIn(w = 0) { if (this.sample(w === 0 ? 'mag_in' : 'mag_in_rifle', 1)) return; this.tone(260, 110, 0.07, 0.5, 'square'); this.noise(0.05, 2400, 2, 0.45, 'bandpass'); this.tone(1700, 1300, 0.025, 0.2, 'square', 0.04); }   // Klack!
  ready() { this.noise(0.25, 4500, 1, 0.14, 'highpass', 0); this.tone(1900, 2100, 0.05, 0.12, 'triangle', 0.05); }            // Pssst – Druck liegt an, bereit
  // Schild zerbricht: wie Glas – viele kurze helle Splitter, fallende Glas-Töne und ein dumpfer Schlag
  shieldBreak(vol = 1) {
    this.tone(220, 60, 0.25, 0.5 * vol, 'sine');                               // dumpfer Schlag
    this.noise(0.08, 2500, 0.8, 0.6 * vol, 'highpass');                        // Krach
    for (let i = 0; i < 14; i++) {                                             // Splitter
      const at = Math.random() * 0.3, fr = 3000 + Math.random() * 6000;
      this.noise(0.03 + Math.random() * 0.05, fr, 8, (0.25 + Math.random() * 0.2) * vol, 'bandpass', fr * 0.8, at);
    }
    for (const [f0, at] of [[2600, 0], [3300, 0.04], [2100, 0.09], [2900, 0.15]]) this.tone(f0, f0 * 0.55, 0.35, 0.09 * vol, 'triangle', at);   // klirrende Töne
    this.tone(880, 330, 0.5, 0.12 * vol, 'sine', 0.05);                        // "Schild weg"-Ton, nach unten
  }
  // "Ahhr!" wenn man getroffen wird: eine Stimme besteht aus einem Grundton (Stimmbänder) und zwei
  // Resonanzen (Formanten) im Mund. 700 Hz und 1150 Hz klingen wie ein "a". Unter Wasser klingt alles dumpfer (Tiefpass).
  grunt(deep = 1) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime, dur = 0.38 + Math.random() * 0.12, f0 = (125 + Math.random() * 40) / deep;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0 * 1.25, t); o.frequency.linearRampToValueAtTime(f0, t + 0.08); o.frequency.exponentialRampToValueAtTime(f0 * 0.8, t + dur);
    const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 9; vg.gain.value = f0 * 0.04; vib.connect(vg).connect(o.frequency);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1900;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    for (const [fr, q, v] of [[700 / deep, 5, 1], [1150 / deep, 7, 0.6], [2500, 6, 0.15]]) {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fr; bp.Q.value = q;
      const bg = ctx.createGain(); bg.gain.value = v;
      o.connect(bp).connect(bg).connect(lp);
    }
    lp.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.05); vib.start(t); vib.stop(t + dur + 0.05);
    this.noise(0.15, 1200, 0.8, 0.12, 'bandpass', 600);   // Luft beim Ausatmen
  }
  // ---------- Atmen durch den Lungenautomaten ----------
  // Einatmen: das Ventil öffnet und Luft zischt durch (wird lauter und wieder leiser)
  // rate = Atemtempo (1 = ruhig, größer = schneller): dann ist jeder Atemzug kürzer
  inhale(vol = 1, rate = 1) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime, dur = 1.05 / Math.pow(rate, 0.8), src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4; f.frequency.setValueAtTime(1800, t); f.frequency.linearRampToValueAtTime(2600, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.linearRampToValueAtTime(0.13 * vol, t + 0.25); g.gain.linearRampToValueAtTime(0.1 * vol, t + dur * 0.8); g.gain.linearRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master); src.start(t, Math.random()); src.stop(t + dur + 0.05);
    this.tone(2900, 3100, 0.05, 0.03 * vol, 'sine');   // leises Klicken des Ventils
  }
  // Ausatmen: dumpfes Blubbern, die Blasen steigen aus dem Ventil
  exhale(vol = 1, rate = 1) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime, dur = 1.1 / Math.pow(rate, 0.8), src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.linearRampToValueAtTime(0.32 * vol, t + 0.12); g.gain.linearRampToValueAtTime(0.001, t + dur);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(), wob = ctx.createGain(); lfo.frequency.value = 11; lg.gain.value = 0.6; wob.gain.value = 1; lfo.connect(lg).connect(wob.gain);
    src.connect(f).connect(wob).connect(g).connect(this.master); src.start(t, Math.random()); src.stop(t + dur + 0.05); lfo.start(t); lfo.stop(t + dur + 0.05);
    for (let i = 0; i < 9; i++) { const at = Math.random() * dur * 0.8, p = 140 + Math.random() * 260; this.tone(p, p * 2, 0.05, 0.08 * vol, 'sine', at); }
  }
  // ---------- Finisher: Triton beschwört einen Fischschwarm ----------
  summon() {   // magisches Glitzern, das nach oben steigt
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, f * 1.01, 0.5, 0.12, 'triangle', i * 0.07));
    this.noise(0.8, 2000, 1, 0.12, 'bandpass', 6000);
  }
  swarm(dur = 1) {   // Rauschen von hunderten Flossen, das anschwillt
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime, src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.9; f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(1800, t + dur * 0.6);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.45, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(), wob = ctx.createGain(); lfo.frequency.value = 22; lg.gain.value = 0.4; wob.gain.value = 1; lfo.connect(lg).connect(wob.gain);
    src.connect(f).connect(wob).connect(g).connect(this.master); src.start(t, Math.random()); src.stop(t + dur + 0.05); lfo.start(t); lfo.stop(t + dur + 0.05);
  }
  // ---------- Finisher: Bollwerks Minigun ----------
  spin(up, dur) {    // der Motor dreht hoch (up = true) oder runter
    this.tone(up ? 80 : 900, up ? 900 : 60, dur, 0.18, 'sawtooth');
    this.noise(dur, up ? 300 : 1500, 2, 0.15, 'bandpass', up ? 1500 : 200);
  }
  minigun(dur) {     // schnelles Rattern: viele kurze Schüsse hintereinander
    const n = Math.round(dur * 28);
    for (let i = 0; i < n; i++) { const at = i / 28; this.tone(140, 45, 0.05, 0.4, 'sine', at); this.noise(0.03, 2200, 1.4, 0.35, 'bandpass', 900, at); }
    this.tone(900, 900, dur, 0.06, 'sawtooth');   // Motor läuft weiter
  }
  // ---------- Finisher: Goliath packt und wirft ----------
  grab() { this.tone(160, 90, 0.2, 0.6, 'square'); this.noise(0.15, 600, 1, 0.5, 'lowpass', 200); this.tone(1800, 1200, 0.06, 0.15, 'square', 0.03); }
  hurl() { this.noise(0.6, 400, 1.2, 0.6, 'bandpass', 2500); this.tone(120, 40, 0.4, 0.5, 'sine'); }
  zoneZap() { this.noise(0.9, 3000, 4, 0.4, 'bandpass', 600); this.tone(70, 35, 0.8, 0.5, 'sawtooth'); this.tone(1300, 200, 0.5, 0.12, 'square'); }
  // Finisher-Sounds
  knife() { this.noise(0.12, 5000, 3, 0.45, 'bandpass', 9000); this.tone(3000, 5200, 0.08, 0.06, 'triangle'); }           // "Schhk"
  hoseCut() {                                                                                                              // Luft entweicht zischend und blubbernd
    this.noise(1.2, 2500, 1.2, 0.45, 'bandpass', 700, 0.03);
    for (let i = 0; i < 14; i++) { const at = 0.05 + Math.random() * 1.1, p = 160 + Math.random() * 300; this.tone(p, p * 2.4, 0.06, 0.16, 'sine', at); }
  }
  headshot() { this.tone(2600, 2400, 0.35, 0.22, 'sine'); this.tone(3900, 3700, 0.25, 0.1, 'sine'); this.noise(0.05, 3000, 1, 0.6, 'highpass'); this.tone(160, 40, 0.25, 0.7, 'sine'); }
  punch() { this.tone(130, 40, 0.22, 0.9, 'sine'); this.noise(0.09, 900, 1.2, 0.7, 'lowpass', 150); this.noise(0.03, 3000, 2, 0.35, 'bandpass'); }
  slam() { this.tone(90, 25, 0.6, 1, 'sine'); this.tone(240, 50, 0.3, 0.5, 'square'); this.noise(0.8, 500, 0.7, 0.8, 'lowpass', 60); this.noise(0.06, 2200, 1, 0.5, 'bandpass'); }
  // Einschlag. body = trifft einen Körper (Taucher, Fisch, Hai): dann klingt es wie eine Kugel, die richtig durchschlägt –
  // 1) scharfes Knacken, 2) nasser Einschlag (echte Aufnahme, CC0), 3) dumpfer Körper-Schlag (echte Aufnahme, CC0).
  // Sonst (Fels, Sand) nur Klatsch und Blasenzischen. Lautstärken: HITS
  hit(vol, body = false) {
    if (vol < 0.02) return;
    this.tone(2100, 1500, 0.012, 0.35 * vol, 'square');                          // Klatsch / Knack
    this.noise(0.03, 2600, 2, 0.4 * vol, 'bandpass');
    this.noise(0.28, 4500, 1.2, 0.16 * vol, 'bandpass', 1800, 0.025);            // Zischen der Blasenspur
    if (!body) return;
    this.cur = this.uwShot;
    this.noise(0.018, 5200, 1.5, HITS.crack * vol, 'highpass', 2500);            // 1) Knacken beim Eindringen
    this.cur = null;
    this.sample('hit_flesh', HITS.flesh * vol, { rate: 0.95 + Math.random() * 0.15, bus: 'shot' });   // 2) nasser Einschlag
    this.sample('hit_body', HITS.body * vol, { rate: 0.85 + Math.random() * 0.1, at: 0.008 });       // 3) dumpfer Schlag
  }
  // selbst getroffen: die Kugel geht durch dich durch – lauter, tiefer, direkt im Kopf (nicht durchs Wasser gedämpft)
  hitMe(amount = 15) {
    const k = Math.min(1.6, 0.7 + amount / 40);
    this.sample('hit_flesh', HITS.flesh * 1.3 * k, { rate: 0.8, bus: 'shot' });
    this.sample('hit_body', HITS.body * 1.5 * k, { rate: 0.7 });
    this.cur = this.master; this.tone(90, 38, 0.3, 0.9 * k, 'sine'); this.cur = null;   // Wucht im Brustkorb
  }
  hitmark(kill) { this.tone(kill ? 1300 : 950, kill ? 1900 : 950, kill ? 0.22 : 0.05, 0.22, 'triangle'); }
  // far = Lautstärke der tiefen Teile (tragen sehr weit), near = Lautstärke des Klicks (nur in der Nähe), W = Ladung in kg
  boom(far, near = far, W = 3) {
    if (far < 0.01) return;
    const T = bubblePeriod(W, this.depth);   // z. B. 10 m tief: 0,3 s – 400 m tief: 0,04 s
    // 1) Stoßwelle: hartes, metallisches Klick + Knacken (nur in der Nähe deutlich)
    if (near > 0.02) { this.tone(3200, 1800, 0.02, 0.8 * near, 'square'); this.noise(0.03, 4000, 2, 0.9 * near, 'bandpass'); this.noise(0.012, 900, 0.7, 1.0 * near, 'bandpass'); }
    // 2) tiefes Grollen und Rumpeln (trägt weit)
    this.tone(58, 16, 1.4, 1.2 * far, 'sine');
    this.noise(1.8, 260, 0.7, 0.9 * far, 'lowpass', 30, 0.02);
    // 3) Blasen-Pulse: die Gasblase fällt zusammen und dehnt sich wieder aus – im Takt T, jedes Mal schwächer
    let at = T, v = 0.75;
    for (let i = 0; i < 4 && v > 0.08; i++) {
      this.tone(52, 22, Math.max(0.12, T * 0.9), v * far, 'sine', at);
      this.noise(Math.max(0.1, T * 0.8), 220, 0.7, v * 0.75 * far, 'lowpass', 45, at);
      if (near > 0.02) this.tone(2400, 1600, 0.015, v * 0.45 * near, 'square', at);
      at += T * (0.75 - i * 0.07); v *= 0.55;
    }
    // 4) Gasblasen blubbern hoch – in flachem Wasser länger (die Blase ist größer)
    const n = Math.round(8 + Math.min(14, T * 40));
    for (let i = 0; i < n; i++) { const t2 = at + Math.random() * (0.6 + T * 3), p = 70 + Math.random() * 160; this.tone(p, p * 2, 0.12, 0.2 * far, 'sine', t2); }
    // 5) ganz nah: Ohrenpfeifen (der Druckstoß trifft das Trommelfell)
    if (near > 0.5) this.tone(5200, 5000, 1.6, 0.04 * near, 'sine', 0.05);
  }
  // ---------- Dauer-Geräusche (laufen, solange etwas passiert) ----------
  // Torpedo: hohes, sirrendes Heulen + Zischen (Kavitation). Gibt { set(lautstärke), stop() } zurück.
  torpedoWhine() {
    const ctx = this.ctx; if (!ctx) return null;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 1350 + Math.random() * 150;
    const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 23; vg.gain.value = 18; vib.connect(vg).connect(o.frequency);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 5;
    const n = ctx.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 3000; const ng = ctx.createGain(); ng.gain.value = 0.35;
    const g = ctx.createGain(); g.gain.value = 0;
    o.connect(bp).connect(g); n.connect(nf).connect(ng).connect(g); g.connect(this.uw);
    o.start(); vib.start(); n.start(0, Math.random());
    return {
      set: (v) => g.gain.setTargetAtTime(Math.max(0, v) * 0.22, ctx.currentTime, 0.05),
      stop: () => { const t = ctx.currentTime; g.gain.setTargetAtTime(0, t, 0.04); o.stop(t + 0.3); vib.stop(t + 0.3); n.stop(t + 0.3); },
    };
  }
  // Schiffsschraube des U-Boots: rhythmisches Wummern + Rauschen/Zischen. level 0…1 (aus … volle Fahrt)
  // ---------- Goliath-Mech ----------
  // Dauergeräusch im Mech: Elektromotor (tiefes Brummen mit Oberton), Propeller (Rauschen, das im Takt wummert)
  // und ein leises Lüftersummen im Cockpit. on = man sitzt im Mech, speed = wie schnell er schwimmt (m/s)
  mechLoop(on, speed = 0) {
    const ctx = this.ctx; if (!ctx) return;
    if (!this.mech) {
      if (!on) return;
      const g = ctx.createGain(); g.gain.value = 0; g.connect(this.uw);
      const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 48;
      const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 96;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 2;
      const og = ctx.createGain(); og.gain.value = 0.35; o1.connect(lp); o2.connect(lp); lp.connect(og).connect(g);
      const n = ctx.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 1.2;
      const ng = ctx.createGain(); ng.gain.value = 0.25;
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 6; lg.gain.value = 0.18; lfo.connect(lg).connect(ng.gain);   // Propeller-Wummern
      n.connect(bp).connect(ng).connect(g);
      const fan = ctx.createOscillator(); fan.type = 'sine'; fan.frequency.value = 1180; const fg = ctx.createGain(); fg.gain.value = 0.012; fan.connect(fg).connect(this.master);   // Lüfter im Cockpit
      o1.start(); o2.start(); n.start(); lfo.start(); fan.start();
      this.mech = { g, o1, o2, lp, lfo, bp, fg };
    }
    const m = this.mech, t = ctx.currentTime, k = Math.min(1, speed / 8);
    m.g.gain.setTargetAtTime(on ? 0.22 + k * 0.4 : 0, t, 0.15);
    m.fg.gain.setTargetAtTime(on ? 0.012 : 0, t, 0.2);
    m.o1.frequency.setTargetAtTime(48 + k * 40, t, 0.3); m.o2.frequency.setTargetAtTime(96 + k * 80, t, 0.3);
    m.lp.frequency.setTargetAtTime(260 + k * 500, t, 0.3); m.lfo.frequency.setTargetAtTime(6 + k * 14, t, 0.3); m.bp.frequency.setTargetAtTime(700 + k * 900, t, 0.3);
  }
  // Schritt / Gelenkbewegung: Hydraulik zischt, das Gelenk rastet mit einem dumpfen Klonk ein, ein Servo surrt kurz
  mechStep(vol = 1) {
    if (vol < 0.03) return;
    this.cur = this.uw;
    this.noise(0.22, 3200, 1.2, 0.22 * vol, 'highpass', 1800);                 // Hydraulik-Zischen
    this.tone(85, 40, 0.22, 0.7 * vol, 'sine', 0.05);                         // Klonk
    this.noise(0.08, 500, 1, 0.4 * vol, 'lowpass', 150, 0.05);
    this.tone(620 + Math.random() * 120, 880, 0.18, 0.06 * vol, 'square');     // Servo
    this.cur = null;
  }
  // schnelles Drehen im Mech: Servos surren (amt 0…1 = wie schnell man sich dreht)
  mechServo(amt) {
    if (amt < 0.15 || this.servoT > (this.ctx?.currentTime || 0)) return;
    this.servoT = this.ctx.currentTime + 0.25;
    this.cur = this.uw; this.tone(500 + amt * 500, 700 + amt * 600, 0.25, 0.05 + amt * 0.06, 'sawtooth'); this.cur = null;
  }
  engine(level) {
    const ctx = this.ctx; if (!ctx) return;
    if (!this.eng) {
      const n = ctx.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 280;
      const thump = ctx.createGain(); thump.gain.value = 0.5;
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 4; lg.gain.value = 0.5; lfo.connect(lg).connect(thump.gain);   // Wummern im Takt der Schraube
      const hiss = ctx.createBiquadFilter(); hiss.type = 'bandpass'; hiss.frequency.value = 2200; hiss.Q.value = 0.8; const hg = ctx.createGain(); hg.gain.value = 0.2;
      const g = ctx.createGain(); g.gain.value = 0;
      n.connect(lp).connect(thump).connect(g); n.connect(hiss).connect(hg).connect(g); g.connect(this.uw);
      n.start(); lfo.start();
      this.eng = { g, lfo, hg };
    }
    const t = ctx.currentTime, L = Math.max(0, Math.min(1, level));
    this.eng.g.gain.setTargetAtTime(L * 0.55, t, 0.2);
    this.eng.lfo.frequency.setTargetAtTime(2 + L * 7, t, 0.3);          // schneller drehende Schraube
    this.eng.hg.gain.setTargetAtTime(0.1 + L * L * 0.4, t, 0.3);         // bei voller Fahrt zischt es (Kavitation)
  }
  // Sonar: heller, durchdringender Ping, der im Rumpf nachhallt
  // Sonar-Ping: kurzer reiner Ton, dann ein langer, langsam abklingender Nachhall mit einzelnen Echo-Spitzen
  // (so klingt aktives Sonar: das Echo vom Wasser, Boden und Fischen). vol = Lautstärke, pitch = Tonhöhe (1 = 1480 Hertz)
  sonar(vol = 1, pitch = 1) {
    if (vol < 0.005) return;
    const f = 1480 * pitch;
    this.tone(f, f * 0.985, 0.9, 0.28 * vol, 'sine');
    this.tone(f * 2, f * 1.98, 0.4, 0.06 * vol, 'sine');
    for (const [at, v] of [[0.11, 0.12], [0.23, 0.07], [0.37, 0.04], [0.62, 0.025], [0.95, 0.015]]) this.tone(f, f * 0.98, 0.6, v * vol, 'sine', at);   // Echos
    this.noise(1.6, f, 18, 0.05 * vol, 'bandpass', f * 0.9, 0.05);   // langer, rauschender Nachhall
  }
  // kleines "Ding", wenn das Radar einen Gegner erwischt
  sonarBlip(vol = 1) { if (vol < 0.005) return; this.tone(2350, 2300, 0.18, 0.12 * vol, 'sine'); this.tone(4700, 4650, 0.08, 0.02 * vol, 'sine'); }
  hurt() { this.tone(180, 70, 0.18, 0.45, 'sawtooth'); }
  bite(vol) { this.noise(0.16, 300, 1, 0.8 * vol, 'lowpass', 90); this.tone(240, 60, 0.2, 0.4 * vol, 'square'); }
  pickup() { this.tone(660, 990, 0.09, 0.2, 'triangle'); setTimeout(() => this.tone(990, 1320, 0.1, 0.18, 'triangle'), 70); }
  ping() { this.tone(1250, 1180, 1.1, 0.22, 'sine'); }
  shock() { this.noise(0.25, 3200, 6, 0.4, 'bandpass', 1200); }
  crate() { this.noise(0.3, 500, 1, 0.4, 'lowpass', 1500); this.tone(330, 660, 0.25, 0.2, 'triangle'); }
}
