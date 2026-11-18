// Undernite - shared definitions and deterministic world generation.
// Imported by both the Node server and the browser client, so everything
// in here must be pure JS without DOM or Node APIs.

export const SURFACE = 130;      // y of the water surface
// MAP_K = wie viel größer die Battle-Royale-Karte ist als früher (1.4 = 1,4-mal so breit, also fast doppelt so viel Fläche).
// Die Expedition bleibt so groß wie vorher (dort zählt der Trichter in der Mitte).
export const MAP_K = 1.4;
export const SIZE = 900;         // world edge length in metres
export const HALF = SIZE / 2;
export const PLAY = HALF - 32;   // playable half extent (inside the rim)
export const GRID_N = 360;       // height grid cells per edge (2,5 m pro Kästchen)
// Wie viel von allem auf der großen Karte verteilt wird (Battle Royale)
export const MAP_STUFF = { subs: 4, scooters: 16, jetskis: 8, rays: 4, crates: 30, rocks: 190, reefs: 6, kelp: 6, swarms: 9, sharks: 10, loot: 40 };
export const CELL = SIZE / GRID_N;
export const TICK_HZ = 20;

// Neue Taucher immer HINTEN anhängen (Finisher schicken die Nummer in dieser Liste)
export const SUIT_ORDER = ['manta', 'triton', 'bulwark', 'goliath', 'sepia', 'barrakuda', 'nautilus', 'hammerhai'];
// dmg = Schaden mit Waffen (1 = normal). start = Startwaffe [Waffe, Seltenheit 0–3].
// Je schwächer der Anzug, desto besser die Startwaffe – je stärker, desto schlechter schießt er.
// build = Körperbau (slim = schlank, normal, heavy = Panzer), tank = Farbe der Flasche, col = Farbe der Anzug-Streifen
// price = Perlen zum Freischalten im Shop (ohne price = von Anfang an frei), fin = welche Finisher-Animation er benutzt
// fill = sein Kompressor braucht nur so viel Zeit (0.65 = 35 % schneller), sense = sieht Gegner bis so viele Meter auf der Minikarte
// ink = stößt bei wenig Leben (unter ink × 100 %) automatisch Tinte aus (blendet Gegner in der Nähe), einmal alle inkCool Sekunden
export const SUITS = {
  manta:   { name: 'Manta',    hp: 70,  speed: 13.5, boost: 1.7,  r: 0.7, scale: 0.85, cam: 4.2, dmg: 1.0,  start: ['needler', 1],
             desc: 'Schlank, klein, extrem wendig. Schwer zu treffen, hält wenig aus. Startet mit einem seltenen Nadler.' },
  triton:  { name: 'Triton',   hp: 100, speed: 11.0, boost: 1.6,  r: 0.9, scale: 1.0,  cam: 4.8, dmg: 1.0,  start: ['pistol', 1],
             desc: 'Der Allrounder. Ausgewogen in Tempo und Panzerung. Startet mit einer seltenen Pistole.' },
  bulwark: { name: 'Bollwerk', hp: 150, speed: 8.6,  boost: 1.5,  r: 1.2, scale: 1.3,  cam: 5.8, dmg: 0.95, start: ['pistol', 0],
             desc: 'Schwerer Panzeranzug. Langsam, aber zäh. Schießt etwas schwächer.' },
  goliath: { name: 'Goliath',  hp: 240, speed: 6.3,  boost: 1.45, r: 1.9, scale: 1.0,  cam: 8.5, dmg: 0.85, mech: true, start: ['pistol', 0],
             desc: 'Tiefsee-Mech. Riesig, träge, enorm stark – aber mit Waffen der schwächste Schütze. Passt in kein Fahrzeug, kein Oktopus hält ihn.' },
  // ----- freischaltbar im Perlen-Shop -----
  sepia:     { name: 'Sepia',     hp: 80,  speed: 12.5, boost: 1.75, r: 0.75, scale: 0.9,  cam: 4.4, dmg: 1.0,  start: ['scatter', 0], price: 1500, build: 'slim', tank: 0x3a2a4a, col: 0x9a4dff, fin: 'manta',
               ink: 0.3, inkCool: 20, desc: 'Tintenflucht: Bei wenig Leben stößt sie automatisch eine Tintenwolke aus – Gegner in der Nähe sind kurz blind. Startet mit dem Splitterwerfer.' },
  barrakuda: { name: 'Barrakuda', hp: 75,  speed: 15.0, boost: 1.95, r: 0.7,  scale: 0.88, cam: 4.3, dmg: 1.05, start: ['needler', 0], price: 1500, build: 'slim', tank: 0xb8c4cc, col: 0xe8e8e8, fin: 'manta',
               desc: 'Sprinter: der schnellste Taucher mit dem stärksten Schub. Trifft etwas härter, hält aber am wenigsten aus.' },
  nautilus:  { name: 'Nautilus',  hp: 105, speed: 10.8, boost: 1.55, r: 0.9,  scale: 1.0,  cam: 4.8, dmg: 1.0,  start: ['pistol', 2], price: 1500, build: 'normal', tank: 0xc87a3a, col: 0xffb347, fin: 'triton',
               fill: 0.65, desc: 'Techniker: sein Kompressor füllt Magazine 35 % schneller. Startet mit einer sehr seltenen Pistole.' },
  hammerhai: { name: 'Hammerhai', hp: 135, speed: 9.6,  boost: 1.5,  r: 1.05, scale: 1.15, cam: 5.3, dmg: 1.0,  start: ['harpoon', 0], price: 1500, build: 'heavy', tank: 0x56606a, col: 0x3fa9f5, fin: 'bulwark',
               sense: 60, desc: 'Elektrosinn: spürt Gegner bis 60 m und sieht sie auf der Minikarte. Startet mit der Harpune.' },
};

// Neue Waffen immer HINTEN anhängen (der Server schickt die Nummer in dieser Liste)
export const WEAPON_IDS = ['pistol', 'needler', 'scatter', 'harpoon', 'torpedo', 'subtorp', 'plasma', 'sonic', 'revolver', 'spikemg', 'netgun', 'magrifle', 'trident', 'espear', 'staff'];
// range = how far (metres) a shot flies before it is gone. The starter pistol has the shortest.
// hitscan: true = trifft sofort (kein Flug), schießt einen Wasserstrahl. beam = Dicke des Strahls in Metern.
// scope: true = mit der rechten Maustaste durchs Zielfernrohr schauen (je weniger Leben, desto wackliger).
export const WEAPONS = {
  pistol:  { name: 'Bolzenpistole',  dmg: 14, rate: 3.5, speed: 95,  mag: 12, reload: 2.4, spread: 0.008, range: 22, pellets: 1, splash: 0, hitscan: true, beam: 0.07 },
  needler: { name: 'Nadler',         dmg: 10, rate: 9,   speed: 115, mag: 30, reload: 2.8, spread: 0.022, range: 38, pellets: 1, splash: 0, hitscan: true, beam: 0.05 },
  scatter: { name: 'Splitterwerfer', dmg: 9,  rate: 1.3, speed: 85,  mag: 5,  reload: 3.0, spread: 0.085, range: 26, pellets: 7, splash: 0, hitscan: true, beam: 0.06 },
  harpoon: { name: 'Harpune',        dmg: 68, rate: 0.9, speed: 150, mag: 3,  reload: 3.0, spread: 0.002, range: 65, pellets: 1, splash: 0, hitscan: true, beam: 0.08, scope: true },
  torpedo: { name: 'Torpedowerfer',  dmg: 80, rate: 0.7, speed: 44,  mag: 2,  reload: 3.6, spread: 0.004, range: 80, pellets: 1, splash: 9 },
  subtorp: { name: 'Bordtorpedo',    dmg: 60, rate: 1.1, speed: 58,  mag: 99, reload: 0,   spread: 0.004, range: 90, pellets: 1, splash: 8 },
  // expedition shop only (not in the Battle Royale loot)
  plasma:  { name: 'Plasmalanze',    dmg: 32, rate: 5,   speed: 170, mag: 25, reload: 3.0, spread: 0.006, range: 75, pellets: 1, splash: 0, hitscan: true, beam: 0.11 },
  sonic:   { name: 'Schallkanone',   dmg: 150, rate: 1.1, speed: 120, mag: 4, reload: 3.6, spread: 0.003, range: 110, pellets: 1, splash: 10 },
  // ----- neue Waffen (Battle Royale: Beute und Ausrüstungs-Fenster) -----
  // net = so viele Sekunden ist ein Getroffener langsam (Netz), emp = so viele Sekunden ist ein Mech komplett lahm (Taucher: kurz)
  revolver: { name: 'Bolzen-Revolver', dmg: 42, rate: 1.6, speed: 120, mag: 6,  reload: 2.9, spread: 0.005, range: 30, pellets: 1, splash: 0, hitscan: true, beam: 0.09 },
  spikemg:  { name: 'Stachel-MG',      dmg: 7,  rate: 13,  speed: 110, mag: 50, reload: 3.6, spread: 0.035, range: 34, pellets: 1, splash: 0, hitscan: true, beam: 0.04 },
  netgun:   { name: 'Netzwerfer',      dmg: 12, rate: 0.8, speed: 38,  mag: 3,  reload: 3.2, spread: 0.01,  range: 40, pellets: 1, splash: 0, net: 3 },
  // Magnet-Gewehr: bekommt jeder außer dem Goliath zu Rundenbeginn. Nur 2 Schuss (1 im Magazin + 1 Ersatz-Magnet), der Kompressor füllt nichts nach.
  magrifle: { name: 'Magnet-Gewehr',   dmg: 22, rate: 1.0, speed: 150, mag: 1,  reload: 3.4, spread: 0.003, range: 55, pellets: 1, splash: 0, hitscan: true, beam: 0.1, emp: 3.5, scope: true, spares: 1, noRefill: true },
  // ----- Stabwaffen (Nahkampf): keine Munition, kein Nachladen, keine Hitze. Linksklick = Stoß nach vorne. -----
  // range = Reichweite des Stoßes (Meter), arc = wie genau man zielen muss (0.8 = ca. 37° nach jeder Seite), push = wegstoßen, stun = lähmt (Sekunden)
  trident: { name: 'Dreizack',     dmg: 38, rate: 1.4, speed: 30, mag: 1, reload: 0, spread: 0, range: 3.2, pellets: 1, splash: 0, melee: true, arc: 0.82 },
  espear:  { name: 'Elektro-Speer', dmg: 24, rate: 1.1, speed: 30, mag: 1, reload: 0, spread: 0, range: 3.6, pellets: 1, splash: 0, melee: true, arc: 0.86, stun: 0.9 },
  staff:   { name: 'Kampfstab',    dmg: 20, rate: 2.0, speed: 30, mag: 1, reload: 0, spread: 0, range: 2.7, pellets: 1, splash: 0, melee: true, arc: 0.72, push: 14 },
};
for (const w of Object.values(WEAPONS)) w.life = w.range / w.speed;   // flight time in seconds
// Aufladen vor jedem Schuss (Sekunden): erst baut sich der Druck auf (die Kiemen gehen auf), dann geht der Schuss
// mit einer Druckwelle raus, die genauso lange dauert. Je größer das Kaliber, desto länger. 0 = sofort.
// Hitze (nur Battle Royale): Jeder Schuss heizt die Waffe auf, und sie kühlt die ganze Zeit langsam wieder ab.
// Während man schießt, passiert nichts. Hört man auf (pause) oder lädt nach, kommt die Hitze auf einen Schlag raus:
// Schallwelle mit Wumms. Hat man zu lange am Stück geballert, verbrennt man sich DANN (nicht mitten im Kampf).
//   start = ab diesem Anteil des Magazins tut es weh (1/3 → Pistole mit 12 Schuss: ab dem 5. schnellen Schuss), minStart = frühestens ab so vielen
//   cool  = wie schnell sie abkühlt, wenn man langsamer als im vollen Tempo schießt (1 = pro verpasstem Schuss eine Hitze weniger)
//   dmg   = so viel Schaden ungefähr, wenn man ein ganzes Magazin am Stück leerschießt (Pistole: 12 Schuss → ca. 20 Schaden)
//   pause = so viele Sekunden ohne Schuss gelten als "aufgehört"
//   daze  = so viele Sekunden ist man höchstens benommen (verschwommen, schwankend, Ohrenpfeifen)
//   holster = so viele Sekunden muss man die Waffe wegstecken, wenn der Schaden mindestens holsterAt × dmg war
export const HEAT = { start: 1 / 3, minStart: 4, cool: 1, dmg: 20, pause: 0.8, daze: 4, holster: 2, holsterAt: 0.7 };
export const heatStart = (mag) => Math.max(HEAT.minStart, Math.round(mag * HEAT.start));   // ab so viel Hitze (in Schüssen) tut es weh
export const SHOT_CHARGE = { pistol: 0.1, needler: 0.08, scatter: 0.15, harpoon: 0.3, torpedo: 0.25, subtorp: 0, plasma: 0.08, sonic: 0.3, revolver: 0.12, spikemg: 0.03, netgun: 0.2, magrifle: 0.25, trident: 0, espear: 0, staff: 0 };
// Kompressor im Rucksack: Jede Waffe hat ein Magazin in der Waffe und "spares" Ersatzmagazine im Rucksack.
// Der Kompressor füllt die Ersatzmagazine nacheinander wieder auf. fill = Sekunden, bis ein leeres Magazin wieder voll ist.
// Beim Nachladen kommt das alte Magazin zurück in den Rucksack und wird dort wieder gefüllt.
// Abgestimmt: Im Dauerfeuer schießt jede Waffe nur etwa 1/5 so schnell wie mit vollen Magazinen (fill = mag / (rate × 0,22)).
// Man kann also nicht durchgehend ballern, sondern muss mit der Munition haushalten.
export const COMPRESSOR = {
  spares: 2,
  fill: { pistol: 16, needler: 15, scatter: 17, harpoon: 15, torpedo: 13, subtorp: 1, plasma: 23, sonic: 17, revolver: 17, spikemg: 18, netgun: 17, magrifle: 18, trident: 1, espear: 1, staff: 1 },
};

// Finisher (nur Battle Royale): hat ein Gegner höchstens hp × 100 % Leben und ist nah genug (range in Metern),
// kann man ihn mit G erledigen. Jede Klasse hat ihre eigene Animation (siehe finisher.js).
export const FINISHER = { hp: 0.3, range: { manta: 4, triton: 14, bulwark: 10, goliath: 9, sepia: 4, barrakuda: 4, nautilus: 14, hammerhai: 10 } };   // Goliath ist riesig und greift weit
export const finStyle = (suit) => SUITS[suit]?.fin || suit;   // neue Taucher benutzen die Finisher-Animation eines alten
export const suitOwned = (owned, suit) => !SUITS[suit]?.price || (owned || []).includes(suit);   // frei oder gekauft?

// Perlen (nur Battle Royale): Belohnung am Rundenende, wird unter deinem Namen gespeichert (saves/battleroyale.json).
// kill = pro Kill, minute = pro Minute überlebt, place = Bonus für Platz 1, 2 und 3.
export const BR_REWARD = { kill: 50, minute: 10, place: [300, 150, 75] };
// Perlen-Shop (Lobby): Verbesserungen fürs Battle Royale, jede hat 3 Stufen. Gilt nur im Battle Royale, nicht für Bots.
// bonus = Plus in Prozent auf jeder Stufe, gerechnet von 100 % (ohne Verbesserung). +100 % = doppelt so gut.
//   Beispiel Schnellladen +60 %: man lädt 1,6-mal so schnell nach. price = Preis pro Stufe in Perlen.
// Eine normale Runde bringt ca. 100–250 Perlen → Stufe 1 nach einer Runde, Stufe 3 nach ein paar Runden.
export const BR_UPGRADES = [
  { k: 'reload', name: 'Schnellladen',      what: 'Nachladetempo',       bonus: [30, 60, 100],  price: [150, 400, 900] },
  { k: 'recoil', name: 'Rückstoßdämpfer',   what: 'Rückstoß-Kontrolle',  bonus: [35, 80, 150],  price: [150, 400, 900] },
  { k: 'scope',  name: 'Ruhiges Visier',    what: 'Zielruhe',            bonus: [50, 120, 250], price: [120, 350, 800] },
  { k: 'swim',   name: 'Profi-Flossen',     what: 'Schwimmtempo',        bonus: [10, 20, 32],   price: [200, 500, 1100] },
  { k: 'comp',   name: 'Turbo-Kompressor',  what: 'Füllgeschwindigkeit', bonus: [30, 65, 110],  price: [150, 400, 900] },
  { k: 'draw',   name: 'Schnellziehen',     what: 'Waffe ziehen',        bonus: [30, 60, 100],  price: [100, 300, 700] },
  { k: 'hp',     name: 'Zäher Anzug',       what: 'Leben',               bonus: [10, 20, 30],   price: [250, 600, 1300] },
];
// Waffe wechseln oder aus dem Holster holen dauert so viele Sekunden (ohne Schnellziehen)
export const DRAW_TIME = 0.5;
// Gadgets (Battle Royale, Taste Q): jeder Taucher hat sein eigenes. price = Perlen, cool = Sekunden bis man es wieder benutzen kann.
// Neue Gadgets immer HINTEN anhängen (der Server schickt die Nummer in dieser Liste).
export const GADGETS = [
  { k: 'bait',   suit: 'manta',     name: 'Haiköder',         price: 400, cool: 30, range: 14, time: 8,
    desc: 'Wirft einen blutigen Köder. Haie in der Nähe greifen die Gegner dort an.' },
  { k: 'sonar',  suit: 'triton',    name: 'Sonar-Boje',       price: 350, cool: 25, range: 90, time: 10,
    desc: 'Ein Sonar-Ping: 10 Sekunden lang siehst du alle Gegner bis 90 m auf der Minikarte und als Markierung.' },
  { k: 'shield', suit: 'bulwark',   name: 'Schild-Generator', price: 450, cool: 28, time: 4,
    desc: 'Eine Druckblase um dich: 4 Sekunden lang prallen alle Schüsse ab.' },
  { k: 'stomp',  suit: 'goliath',   name: 'Bodenstampfer',    price: 450, cool: 22, range: 10, dmg: 18,
    desc: 'Der Mech stampft: eine Druckwelle schleudert Gegner in der Nähe weg und macht 18 Schaden.' },
  { k: 'inkbomb', suit: 'sepia',    name: 'Tintenbombe',      price: 350, cool: 20, range: 16, radius: 7, time: 3.5,
    desc: 'Wirft eine Tintenwolke dorthin, wo du zielst. Gegner darin sind 3,5 Sekunden blind.' },
  { k: 'grapple', suit: 'barrakuda', name: 'Seilharpune',     price: 400, cool: 12, range: 40,
    desc: 'Schießt ein Seil an Fels oder Riff und zieht dich blitzschnell hin.' },
  { k: 'drone',  suit: 'nautilus',  name: 'Geschütz-Drohne',  price: 500, cool: 35, range: 35, time: 15, dmg: 0.6,
    desc: 'Eine kleine Drohne schwimmt 15 Sekunden neben dir und schießt auf Gegner in der Nähe.' },
  { k: 'zap',    suit: 'hammerhai', name: 'Elektroschocker',  price: 400, cool: 22, range: 8, dmg: 10, time: 1.8,
    desc: 'Ein Stromstoß: Gegner bis 8 m sind 1,8 Sekunden gelähmt (langsam, können nicht schießen) und bekommen 10 Schaden.' },
];
// Augenhöhe über der Körpermitte: hier sitzt die Kamera in der Ego-Sicht – und hier starten auch die Schüsse,
// damit sie genau durchs Fadenkreuz fliegen (der Goliath sitzt hoch oben in der Kuppel)
export const eyeHeight = (suit) => SUITS[suit] && SUITS[suit].mech ? 1.4 : 0.5;
export const gadgetOf = (suit) => GADGETS.findIndex(g => g.suit === suit);   // Nummer des Gadgets dieses Tauchers (-1 = keins)

// ---------- Ultis (Battle Royale, Taste 4) ----------
// Die Ulti-Leiste füllt sich von allein (voll nach fill Sekunden) und schneller, wenn du Gegner triffst
// (perDmg = so viel Prozent pro Schadenspunkt). Ist sie voll, drückst du 4.
export const ULTI = { fill: 120, perDmg: 0.35 };
// time = so viele Sekunden wirkt die Ulti. Taucher ohne Eintrag haben (noch) keine Ulti.
export const ULTIS = {
  manta:   { name: 'Matrix',      time: 5, speed: 1.35,
             desc: 'Zeitlupe wie in Matrix: 5 Sekunden lang weichst du jeder Kugel aus und schwimmst schneller.' },
  goliath: { name: 'Zielcomputer', time: 6,
             desc: 'Der Mech-Computer zielt 6 Sekunden lang automatisch auf den nächsten Gegner, den du siehst.' },
  // n = so viele Torpedos, dmg = Schaden pro Torpedo, splash = Explosionsradius, range = so weit sucht er Ziele
  // turn = wie stark die Torpedos zum Ziel lenken, life = so viele Sekunden fliegen sie, fuse = so nah dran explodieren sie (Annäherungszünder)
  triton:  { name: 'Torpedo-Salve', time: 0.8, n: 3, dmg: 40, speed: 45, splash: 6, range: 90, turn: 5, life: 3.0, fuse: 2.8,
             desc: '3 zielsuchende Torpedos schießen nacheinander los und verfolgen den nächsten Gegner, den du siehst.' },
  // armor = so viel Schaden kommt noch durch (0.33 = ein Drittel), push = wer näher kommt (Meter), wird weggestoßen
  bulwark: { name: 'Festung',     time: 6, armor: 0.33, push: 5,
             desc: '6 Sekunden lang bekommst du nur ein Drittel Schaden, und wer zu nah kommt, wird weggestoßen.' },
  sepia:   { name: 'Tarnung',     time: 5,
             desc: '5 Sekunden unsichtbar wie ein echter Tintenfisch. Wenn du schießt, ist die Tarnung vorbei.' },
  // speed = so schnell schießt du nach vorne (m/s), dmg = Schaden für jeden, den du rammst
  barrakuda: { name: 'Rammstoß',  time: 0.6, speed: 45, dmg: 35,
             desc: 'Du schießt blitzschnell nach vorne. Wen du rammst, der wird weggeschleudert und bekommt 35 Schaden.' },
  nautilus:  { name: 'Reparatur', time: 0.5, heal: 60, shield: 100,
             desc: 'Sofort 60 Leben zurück und das Schild wieder voll.' },
  // range = so weit sieht er Gegner durch Felsen, speed = so viel schneller schwimmt er
  hammerhai: { name: 'Blutrausch', time: 8, range: 90, speed: 1.2,
             desc: '8 Sekunden lang siehst du Gegner durch Felsen als rote Markierung und schwimmst schneller.' },
};
// Waffen-Aufsätze (Ausrüstungs-Fenster, nur für die Startwaffe). Pro Platz (slot) passt einer drauf.
// for = auf welche Waffen er passt. Gekauft wird er für jede Waffe einzeln.
// Wirkung (malgenommen): mag = Magazin, reload = Nachladezeit, spread = Streuung, range = Reichweite, speed = Geschosstempo,
// recoil = Rückstoß, sway = Wackeln beim Zielen, scope = Zielfernrohr (rechte Maustaste), dmg = Schaden
export const ATTACHMENTS = [
  { k: 'dot',   slot: 'Visier',    name: 'Leuchtpunkt-Visier', price: 200, for: ['pistol', 'needler', 'scatter', 'revolver', 'spikemg'], sway: 0.6,
    desc: 'Grüner Leuchtpunkt statt Kimme und Korn: Zielen wackelt 40 % weniger.' },
  { k: 'scope', slot: 'Visier',    name: 'Zielfernrohr 4×',    price: 450, for: ['needler', 'scatter', 'spikemg'], scope: true, sway: 0.8,
    desc: 'Mit der rechten Maustaste durchs Fernrohr zielen – für weite Schüsse.' },
  { k: 'mag',   slot: 'Magazin',   name: 'Großes Magazin',     price: 300, for: ['pistol', 'needler', 'scatter', 'harpoon', 'revolver', 'spikemg', 'netgun'], mag: 1.5, reload: 1.1,
    desc: '50 % mehr Schuss pro Magazin, dafür dauert Nachladen 10 % länger.' },
  { k: 'drum',  slot: 'Magazin',   name: 'Trommelmagazin',     price: 550, for: ['needler', 'spikemg'], mag: 2, reload: 1.35,
    desc: 'Doppelt so viele Schuss! Nachladen dauert 35 % länger.' },
  { k: 'comp',  slot: 'Mündung',   name: 'Kompensator',        price: 250, for: ['pistol', 'needler', 'harpoon', 'revolver', 'spikemg'], recoil: 0.6, spread: 0.8,
    desc: 'Lenkt den Druck zur Seite ab: 40 % weniger Rückstoß, etwas genauer.' },
  { k: 'choke', slot: 'Mündung',   name: 'Würgebohrung',       price: 300, for: ['scatter'], spread: 0.55, range: 1.2,
    desc: 'Die Splitter bleiben enger zusammen und fliegen weiter.' },
  { k: 'laser', slot: 'Unterlauf', name: 'Laservisier',        price: 300, for: ['pistol', 'needler', 'scatter', 'harpoon', 'torpedo', 'revolver', 'spikemg', 'netgun', 'magrifle'], spread: 0.65,
    desc: 'Ein roter Laser zeigt, wohin du triffst: 35 % weniger Streuung.' },
  { k: 'boost', slot: 'Lauf',      name: 'Druck-Verstärker',   price: 400, for: ['pistol', 'needler', 'scatter', 'harpoon', 'torpedo', 'revolver', 'spikemg', 'netgun', 'magrifle'], range: 1.3, speed: 1.2,
    desc: 'Mehr Druck im Lauf: 30 % mehr Reichweite, schnellere Geschosse.' },
];
// Werte einer Waffe mit ihren Aufsätzen (mods = ['mag', 'laser', …]). Ohne Aufsätze = die normalen Werte.
const MOD_CACHE = new Map();
export function modDef(wid, mods) {
  const base = WEAPONS[wid]; if (!mods || !mods.length) return base;
  const key = wid + ':' + mods.join(','); if (MOD_CACHE.has(key)) return MOD_CACHE.get(key);
  const d = { ...base, recoil: 1, sway: 1, mods: [...mods] };
  for (const k of mods) {
    const A = ATTACHMENTS.find(a => a.k === k); if (!A || !A.for.includes(wid)) continue;
    if (A.mag) d.mag = Math.round(d.mag * A.mag); if (A.reload) d.reload *= A.reload; if (A.spread) d.spread *= A.spread;
    if (A.range) d.range *= A.range; if (A.speed) d.speed *= A.speed; if (A.recoil) d.recoil *= A.recoil; if (A.sway) d.sway *= A.sway;
    if (A.scope) d.scope = true; if (A.dmg) d.dmg *= A.dmg;
  }
  d.life = d.range / d.speed;
  MOD_CACHE.set(key, d); return d;
}
// Startwaffen (Ausrüstungs-Fenster): einmal kaufen, dann bei jedem Taucher als Startwaffe wählbar (in normaler Seltenheit).
// Ohne Auswahl startet jeder Taucher mit seiner eigenen Startwaffe (SUITS[…].start, oft seltener und damit stärker).
export const BR_WEAPONS = [
  { wid: 'pistol',  price: 0 },
  { wid: 'needler', price: 300 },
  { wid: 'scatter', price: 450 },
  { wid: 'harpoon', price: 700 },
  { wid: 'torpedo', price: 1000 },
  { wid: 'revolver', price: 550 },
  { wid: 'netgun',   price: 650 },
  { wid: 'spikemg',  price: 900 },
  { wid: 'staff',    price: 350 },
  { wid: 'trident',  price: 600 },
  { wid: 'espear',   price: 800 },
];
// Bonus in Prozent für einen Spieler (up = { reload: 2, ... }), 0 = nicht gekauft
export const upBonus = (up, k) => { const u = BR_UPGRADES.find(x => x.k === k), l = (up && up[k]) | 0; return u && l > 0 ? u.bonus[Math.min(l, u.bonus.length) - 1] : 0; };
// Umrechnung für das Spiel: Schwimmtempo und Leben werden mit (1 + Bonus) malgenommen,
// alles andere (Nachladezeit, Rückstoß, Wackeln, Füllzeit) durch (1 + Bonus) geteilt – es wird kleiner, also besser.
export const upMul = (up, k) => { const b = 1 + upBonus(up, k) / 100; return k === 'swim' || k === 'hp' ? b : 1 / b; };   // Tempo und Leben: mehr; alles andere: weniger Zeit
// Liga: aus den gekauften Upgrades (jede Stufe zählt 1) wird ein Level, daraus Liga 1 (Anfänger) bis 4 (Profi).
// LEAGUE = ab so vielen Upgrade-Stufen beginnt Liga 2, 3, 4
export const LEAGUE = [6, 11, 16];
export const upgradeLevel = (up) => Object.values(up || {}).reduce((a, b) => a + (b | 0), 0);
export const leagueOf = (up) => { const l = upgradeLevel(up); return 1 + LEAGUE.filter(x => l >= x).length; };
export const brReward = (kills, secs, place) => {
  const k = kills * BR_REWARD.kill, m = Math.floor(secs / 60) * BR_REWARD.minute, p = BR_REWARD.place[place - 1] || 0;
  return { k, m, p, sum: k + m + p };
};

// Tiefsee: Battle Royale spielt in brOffset Metern Tiefe (kein Sonnenlicht, keine Oberfläche).
// brCeil = so viele Meter unter der alten Oberfläche ist die obere Grenze, höher kann man nicht schwimmen.
export const DEEP = { brOffset: 380, brCeil: 25 };

// Leuchtkorallen auf dem ganzen Meeresboden: leuchten (etwas heller als Quallen) und sind scharf.
// Wer sie berührt, schneidet sich (dmg) und blutet danach bleed Sekunden lang (bleedDps Schaden pro Sekunde, geht durchs Schild).
// Höhlen um Truhen im Riff: ring = Abstand der Felsbrocken von der Truhe, stones = Anzahl, stone = Größe, height = Dachhöhe
export const CAVE = { ring: 3.6, stones: 9, stone: 1.9, height: 3.6 };
// Korallen-Berge an jedem Riff: count Hügel mit Radius min…max Metern
// Korallen-Berge an jedem Riff: count Hügel mit Radius min…max Metern, dicht in spread Metern um die Riffmitte.
// Sie stapeln sich aufeinander → ein großes, zusammenhängendes Riff mit Bergen und Graten.
export const REEF_MOUNDS = { count: 95, min: 3, max: 12, spread: 36 };
// Riff-Adern (nur Battle Royale): lange, kurvige Riff-Stränge über die ganze Karte, die ein Netz bilden.
// cross = Adern quer von Rand zu Rand (dazu kommt ein Ring durch die 4 Riffe), step = Meter zwischen zwei Hügeln,
// min/max = Hügelgröße, wobble = wie stark sich die Ader schlängelt, width = wie breit (Meter)
export const REEF_VEINS = { cross: 3, step: 5, min: 2.5, max: 7, wobble: 10, width: 6 };
// Hitbox der Riff-Hügel: 1 = so groß wie der sichtbare Hügel, kleiner = man taucht ein Stück in den Hügel hinein
export const REEF_HITBOX = 1.05;
export const GLOW_CORALS = { count: 520, dmg: 6, bleed: 4, bleedDps: 2.5, cooldown: 1.2 };

export const RARITY = [
  { name: 'Gewöhnlich', color: '#9fb2bd', mul: 1.0 },
  { name: 'Selten',     color: '#3fa9f5', mul: 1.15 },
  { name: 'Episch',     color: '#b970ff', mul: 1.3 },
  { name: 'Legendär',   color: '#ffb52e', mul: 1.45 },
];

export const VEHICLE_IDS = ['scooter', 'sub', 'jetski', 'ray'];   // neue Fahrzeuge immer HINTEN anhängen
export const VEHICLES = {
  scooter: { name: 'U-Scooter',   hp: 0,   speed: 24, accel: 3.0, r: 1.1, cam: 6.5 },
  // Jetski-Scooter: viel schneller, aber man kann nicht seitwärts fahren (strafe 0) und er dreht weit
  jetski:  { name: 'Jetski',      hp: 0,   speed: 38, accel: 2.2, r: 1.2, cam: 7.5, strafe: 0, turn: 2.4 },
  // Torpedo-Rochen: gleitet wie ein Mantarochen, schießt Torpedos (torpDmg = Schaden, torpRate = Schuss pro Sekunde)
  ray:     { name: 'Torpedo-Rochen', hp: 0, speed: 27, accel: 2.4, r: 1.6, cam: 8.5, strafe: 0, turn: 2.0, torpDmg: 40, torpRate: 0.8 },
  sub:     { name: 'Mini-U-Boot', hp: 450, speed: 17, accel: 1.6, r: 3.0, cam: 16 },
};

export const CREATURE_IDS = ['shark', 'octo', 'jelly', 'fish', 'boss'];
export const CREATURES = {
  shark: { name: 'Hai',     r: 1.5, hp: 90 },
  octo:  { name: 'Oktopus', r: 1.3, hp: 80 },
  jelly: { name: 'Qualle',  r: 0.9, hp: 18 },
  fish:  { name: 'Fisch',   r: 0.6, hp: 10 },   // real values per species in FISH
  boss:  { name: 'Boss',    r: 3.0, hp: 500 },  // real values per floor in BOSSES
};
// hit radius of a creature (fish and bosses carry their own)
export const creatureR = (type, sub) => type === 'fish' ? Math.max(0.5, FISH[sub].size * 0.9) : type === 'boss' ? BOSSES[sub].r : CREATURES[type].r;

// ======================================================================
// Tiefsee-Expedition (mode 'exp'): dive deeper, hunt fish, sell them at
// the boat, buy better gear. All balance values for the mode live here.
// ======================================================================
export const EXP_HP = 100;
export const EXP_BOAT = { x: 0, z: 0 };           // shop boat floats at the surface here
export const EXP_RESPAWN = 5;                     // seconds until you wake up at the boat
export const EXP_START_MONEY = 100;               // new divers start with this much money
// Health regeneration: starts after REGEN_DELAY seconds without damage.
export const REGEN_DELAY = 5, REGEN_RATE = 4, REGEN_RATE_SURFACE = 15;
// Floors ("Etagen") by depth in metres below the surface.
export const FLOORS = [
  { name: 'Sonnenriff',   top: 0,   bot: 60,  fish: 16 },
  { name: 'Zwielicht',    top: 60,  bot: 130, fish: 14 },
  { name: 'Mitternacht',  top: 130, bot: 210, fish: 13 },
  { name: 'Abgrund',      top: 210, bot: 290, fish: 11 },
  { name: 'Tiefseegraben', top: 290, bot: 370, fish: 10 },
  { name: 'Vulkanschlund', top: 370, bot: 450, fish: 9 },
  { name: 'Urzeittiefe',   top: 450, bot: 540, fish: 8 },
];
// how much the deep floors glow at a depth: lava = floor 6 (Vulkanschlund), prim = floor 7 (Urzeittiefe), 0..1
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const deepGlow = (depth) => ({ lava: ss(355, 390, depth) * (1 - ss(440, 470, depth)), prim: ss(440, 470, depth) });
export const floorAt = (depth) => { for (let i = FLOORS.length - 1; i >= 0; i--) if (depth >= FLOORS[i].top) return i; return 0; };
// Fish species. value = money when sold, dmg > 0 means it bites back.
// shape: 0 normal, 1 tall/flat, 2 long (eel), 3 angler (lure light)
export const FISH = [
  { name: 'Sardine',        floor: 0, value: 4,    hp: 6,   size: 0.35, speed: 7,  col: 0xc9d6e0, glow: 0, shape: 0, w: 55 },
  { name: 'Clownfisch',     floor: 0, value: 8,    hp: 10,  size: 0.4,  speed: 6,  col: 0xff7b1c, glow: 0, shape: 1, w: 30 },
  { name: 'Doktorfisch',    floor: 0, value: 15,   hp: 16,  size: 0.55, speed: 7,  col: 0x2f6bff, glow: 0, shape: 1, w: 15 },
  { name: 'Makrele',        floor: 1, value: 25,   hp: 22,  size: 0.7,  speed: 10, col: 0x5d8fa8, glow: 0, shape: 0, w: 55 },
  { name: 'Thunfisch',      floor: 1, value: 45,   hp: 45,  size: 1.2,  speed: 11, col: 0x34506e, glow: 0, shape: 0, w: 30 },
  { name: 'Barrakuda',      floor: 1, value: 65,   hp: 40,  size: 1.1,  speed: 12, col: 0x8fa3ad, glow: 0, shape: 2, w: 15, dmg: 6 },
  { name: 'Laternenfisch',  floor: 2, value: 90,   hp: 30,  size: 0.5,  speed: 8,  col: 0x1b2a3a, glow: 0x4dfff0, shape: 0, w: 55 },
  { name: 'Beilfisch',      floor: 2, value: 125,  hp: 50,  size: 0.6,  speed: 8,  col: 0xb8c8d8, glow: 0x9fd8ff, shape: 1, w: 30 },
  { name: 'Viperfisch',     floor: 2, value: 170,  hp: 65,  size: 0.95, speed: 11, col: 0x23182e, glow: 0xff4df0, shape: 2, w: 15, dmg: 9 },
  { name: 'Geisterfisch',   floor: 3, value: 250,  hp: 80,  size: 0.8,  speed: 9,  col: 0xdfe8ff, glow: 0xbfd0ff, shape: 1, w: 55 },
  { name: 'Tiefsee-Aal',    floor: 3, value: 330,  hp: 105, size: 1.6,  speed: 9,  col: 0x2e2a22, glow: 0xffb03a, shape: 2, w: 30 },
  { name: 'Anglerfisch',    floor: 3, value: 430,  hp: 125, size: 1.0,  speed: 8,  col: 0x2a1d1a, glow: 0xfff07a, shape: 3, w: 15, dmg: 12 },
  { name: 'Kristallfisch',  floor: 4, value: 650,  hp: 140, size: 0.9,  speed: 9,  col: 0x9ff7ff, glow: 0x6ff0ff, shape: 1, w: 55 },
  { name: 'Drachenfisch',   floor: 4, value: 850,  hp: 170, size: 1.4,  speed: 12, col: 0x1a0d14, glow: 0xff3355, shape: 2, w: 30, dmg: 15 },
  { name: 'Leuchtrochen',   floor: 4, value: 1100, hp: 220, size: 1.8,  speed: 8,  col: 0x251a40, glow: 0xb06bff, shape: 1, w: 15 },
  { name: 'Glutbarsch',     floor: 5, value: 1500, hp: 300, size: 1.0,  speed: 10, col: 0x2a0a06, glow: 0xff5a1a, shape: 0, w: 55 },
  { name: 'Magma-Aal',      floor: 5, value: 2000, hp: 380, size: 1.8,  speed: 11, col: 0x1a0804, glow: 0xff7a20, shape: 2, w: 30, dmg: 18 },
  { name: 'Feuerrochen',    floor: 5, value: 2800, hp: 480, size: 2.0,  speed: 9,  col: 0x3a0a04, glow: 0xffa040, shape: 1, w: 15 },
  { name: 'Quastenflosser', floor: 6, value: 3800, hp: 600, size: 1.5,  speed: 9,  col: 0x1c2a4a, glow: 0x9fd8ff, shape: 0, w: 55 },
  { name: 'Säbelzahnfisch', floor: 6, value: 5000, hp: 750, size: 1.6,  speed: 13, col: 0x0a0a10, glow: 0xff3355, shape: 2, w: 30, dmg: 22 },
  { name: 'Sternenrochen',  floor: 6, value: 7000, hp: 950, size: 2.3,  speed: 9,  col: 0x0a0a20, glow: 0xffffff, shape: 1, w: 15 },
];
export const GOLD_CHANCE = 0.04, GOLD_MUL = 5;
// Money a caught fish is worth. Bag/aquarium entries are { s: species index, g: 1 if golden }.
// (Very old saves only kept the value: { v: euros }.)
// Caught things ("Fang"): a fish { s: species, g: golden } or a boss { b: boss index }.
export const fishValue = (e) => e.v ?? (e.b != null ? BOSSES[e.b].reward : FISH[e.s].value * (e.g ? GOLD_MUL : 1));
// Aquarium: everything living there earns money every second.
export const AQUARIUM = {
  rate: 0.08 / 60,                              // a fish earns 8 % of its value per minute
  sizes: [3, 6, 10, 15, 20, 25, 30],                          // places per upgrade level
  prices: [0, 2500, 10000, 30000, 75000, 180000, 400000],     // price of each upgrade level
  afkTime: 60,                                  // no money after 60 s without moving/looking around (and none while offline)
};
// € per second of one caught thing in the aquarium (bosses have their own, much higher number)
export const catchRate = (e) => e.v != null ? 0 : e.b != null ? BOSSES[e.b].aq : fishValue(e) * AQUARIUM.rate;
export const aqIncome = (aq) => aq.reduce((a, e) => a + catchRate(e), 0);   // € per second
export const catchName = (e) => e.v != null ? 'Alter Fang' : e.b != null ? '☠ ' + BOSSES[e.b].name : (e.g ? '⭐ Goldener ' : '') + FISH[e.s].name;
// network form: fish [s, g], boss [-2, b], very old catch [-1, euros]
export const catchToNet = (e) => e.v != null ? [-1, e.v] : e.b != null ? [-2, e.b] : [e.s, e.g ? 1 : 0];
export const catchFromNet = (a) => a[0] === -1 ? { v: a[1] } : a[0] === -2 ? { b: a[1] } : { s: a[0], g: a[1] };
// One boss per floor. dmg is per bite. aq = € per second in the aquarium (harder boss = more money).
export const BOSSES = [
  { name: 'Riffkönig',      hp: 450,  dmg: 20, reward: 300,   aq: 5,   model: 'shark', scale: 2.2, col: 0xffc94d, r: 3.0, speed: 10 },
  { name: 'Krakenmutter',   hp: 950,  dmg: 20, reward: 800,   aq: 12,  model: 'octo',  scale: 3.2, col: 0x9a2fd6, r: 3.6, speed: 9 },
  { name: 'Laternenschlund', hp: 1700, dmg: 20, reward: 2000, aq: 30,  model: 'fish',  scale: 6,   col: 0x2a1d1a, glow: 0xfff07a, shape: 3, r: 4.0, speed: 9 },
  { name: 'Knochenhai',     hp: 2700, dmg: 20, reward: 5000,  aq: 70,  model: 'shark', scale: 3.2, col: 0x3b4450, r: 4.2, speed: 12 },
  { name: 'Leviathan',      hp: 4200, dmg: 20, reward: 12000, aq: 150, model: 'fish',  scale: 7,   col: 0x10202a, glow: 0x5ef2e0, shape: 2, r: 4.5, speed: 11 },
  { name: 'Glutkrake',      hp: 7500, dmg: 25, reward: 30000, aq: 320, model: 'octo',  scale: 3.8, col: 0xd2401a, r: 4.8, speed: 10 },
  { name: 'Megalodon',      hp: 12000, dmg: 30, reward: 80000, aq: 700, model: 'shark', scale: 4.6, col: 0x2a3036, r: 5.6, speed: 13 },
];
export const BOSS_RESPAWN = 120;
// Air tanks: cap = air units, maxDepth = safe depth (below it the pressure hurts).
export const TANKS = [
  { name: 'Mini-Flasche',        cap: 90,   maxDepth: 70,  price: 0 },
  { name: 'Stahlflasche',        cap: 160,  maxDepth: 140, price: 2000 },
  { name: 'Doppelflasche',       cap: 260,  maxDepth: 220, price: 7500 },
  { name: 'Tiefsee-Rebreather',  cap: 400,  maxDepth: 300, price: 22000 },
  { name: 'Abyss-Kreislaufgerät', cap: 600, maxDepth: 400, price: 55000 },
  { name: 'Titan-Tieftaucher',   cap: 850,  maxDepth: 470, price: 140000 },
  { name: 'Urzeit-Kreislauf X',  cap: 1200, maxDepth: 560, price: 320000 },
];
// Breathing training: multiplies air use.
export const LUNGS = [
  { name: 'Untrainiert',     mul: 1.0,  price: 0 },
  { name: 'Atemtraining I',  mul: 0.85, price: 1200 },
  { name: 'Atemtraining II', mul: 0.72, price: 5000 },
  { name: 'Atemtraining III', mul: 0.6, price: 15000 },
  { name: 'Freitaucher-Profi', mul: 0.5, price: 40000 },
  { name: 'Tiefsee-Legende', mul: 0.4, price: 120000 },
];
// Flashlights: toggle with L, battery (seconds) recharges at the surface.
export const LAMPS = [
  { name: 'Taschenlampe',      range: 40,  power: 120, angle: 0.38, battery: 150, price: 0 },   // länger, weil es jetzt schnell dunkel wird
  { name: 'Tauchlampe',        range: 60,  power: 200, angle: 0.42, battery: 120, price: 1500 },
  { name: 'Halogen-Strahler',  range: 85,  power: 300, angle: 0.47, battery: 200, price: 6000 },
  { name: 'Tiefsee-Flutlicht', range: 120, power: 450, angle: 0.55, battery: 320, price: 20000 },
  { name: 'Sonnen-Strahler',   range: 170, power: 650, angle: 0.6,  battery: 480, price: 90000 },
];
// Air used per second at a given depth (before training).
export const airUse = (depth) => 1 + Math.max(0, depth) / 60;
export const SHOP_WEAPONS = [
  { wid: 'needler', rar: 0, price: 750 },
  { wid: 'scatter', rar: 0, price: 1500 },
  { wid: 'harpoon', rar: 1, price: 3500 },
  { wid: 'needler', rar: 2, price: 6000 },
  { wid: 'torpedo', rar: 1, price: 10000 },
  { wid: 'harpoon', rar: 2, price: 16000 },
  { wid: 'needler', rar: 3, price: 25000 },
  { wid: 'torpedo', rar: 3, price: 42500 },
  { wid: 'plasma',  rar: 1, price: 70000 },
  { wid: 'plasma',  rar: 3, price: 160000 },
  { wid: 'sonic',   rar: 2, price: 230000 },
  { wid: 'sonic',   rar: 3, price: 400000 },
];
// Terrace profile of the expedition funnel: [inner radius, height step]
// (7 floors: ground at about 35 / 90 / 170 / 255 / 340 / 420 / 500 m depth)
const EXP_STEPS = [[30, 80], [62, 80], [98, 85], [138, 85], [185, 80], [232, 55]];
const EXP_BOTTOM = SURFACE - 500;
export const EXP_MAX_DEPTH = 560;                 // nobody can dive below this
// Ledge of each floor: radius range where its boss lives.
export const EXP_LEDGES = [[248, 278], [200, 228], [153, 182], [112, 135], [77, 95], [44, 58], [0, 20]];

// ---------- math helpers ----------
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(ix, iz, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
function fbm(x, z, seed, oct) {
  let s = 0, a = 1, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += vnoise(x * f, z * f, seed + i * 17) * a; n += a; a *= 0.5; f *= 2; }
  return s / n;
}
export function sstep(e0, e1, x) {
  let t = (x - e0) / (e1 - e0);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * (3 - 2 * t);
}
// Forward vector for yaw/pitch. yaw 0 looks down -z, positive pitch looks up.
export function dirFrom(yaw, pitch) {
  const cp = Math.cos(pitch);
  return [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp];
}
// Segment (a, a+d) against sphere. Returns t in [0,1] or -1.
export function segSphere(ax, ay, az, dx, dy, dz, cx, cy, cz, r) {
  const fx = ax - cx, fy = ay - cy, fz = az - cz;
  const c = fx * fx + fy * fy + fz * fz - r * r;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy + dz * dz;
  if (a === 0) return -1;
  const b = 2 * (fx * dx + fy * dy + fz * dz);
  let disc = b * b - 4 * a * c;
  if (disc < 0) return -1;
  disc = Math.sqrt(disc);
  const t = (-b - disc) / (2 * a);
  return t >= 0 && t <= 1 ? t : -1;
}

const HC = 16; // collider hash cell size
const hkey = (cx, cz) => (cx + 64) * 256 + (cz + 64);

// ---------- world ----------
export class World {
  constructor(seed, mode = 'br') {
    this.seed = seed | 0;
    this.mode = mode;
    const exp = mode === 'exp';
    const R = rng(this.seed ^ 0x9e3779b9);
    const TAU = Math.PI * 2;

    // seamount position feeds into the height field
    const sa = R() * TAU;
    const K = exp ? 1 : MAP_K, MS = MAP_STUFF;   // Battle Royale: alles weiter verteilt und mehr davon
    this.lim = exp ? 288 : PLAY;                  // bis hierhin kann man schwimmen
    this.smx = Math.cos(sa) * 150 * K; this.smz = Math.sin(sa) * 150 * K;

    const n1 = GRID_N + 1;
    this.grid = new Float32Array(n1 * n1);
    for (let iz = 0; iz < n1; iz++) for (let ix = 0; ix < n1; ix++) {
      this.grid[iz * n1 + ix] = this._raw(ix * CELL - HALF, iz * CELL - HALF);
    }

    this.cols = [];      // sphere colliders
    this.rocks = []; this.kelp = []; this.coral = []; this.columns = []; this.lintels = [];
    this.crates = []; this.vehSpawns = []; this.lairs = []; this.swarms = []; this.pois = [];

    const farFrom = (x, z, list, d) => list.every(p => (p.x - x) ** 2 + (p.z - z) ** 2 > d * d);
    const pickSite = (maxR, others, d) => {
      for (let i = 0; i < 60; i++) {
        const x = (R() * 2 - 1) * maxR, z = (R() * 2 - 1) * maxR;
        if (farFrom(x, z, others, d)) return { x, z };
      }
      return { x: (R() * 2 - 1) * maxR, z: (R() * 2 - 1) * maxR };
    };
    const sites = [{ x: this.smx, z: this.smz }];
    // expedition: decorations sit on the ledges of the funnel
    const ringSite = (r0, r1) => { const a = R() * TAU, d = r0 + R() * (r1 - r0); return { x: Math.cos(a) * d, z: Math.sin(a) * d }; };

    // wreck
    const ws = exp ? ringSite(186, 204) : pickSite(190 * K, sites, 130 * K); sites.push(ws);
    this.wreck = { x: ws.x, z: ws.z, y: this.heightAt(ws.x, ws.z), yaw: R() * TAU };
    for (const k of [-12, -6, 0, 6, 12]) {
      const x = ws.x + Math.cos(this.wreck.yaw) * k, z = ws.z - Math.sin(this.wreck.yaw) * k;
      this.cols.push({ x, y: this.heightAt(x, z) + 2, z, r: 5 });
    }
    // ruins
    const rs = exp ? ringSite(126, 144) : pickSite(190 * K, sites, 130 * K); sites.push(rs);
    this.ruins = { x: rs.x, z: rs.z, y: this.heightAt(rs.x, rs.z) };
    const ring = (count, rad, miss) => {
      const out = [];
      for (let i = 0; i < count; i++) {
        if (R() < miss) { out.push(null); continue; }
        const a = i / count * TAU;
        const x = rs.x + Math.cos(a) * rad, z = rs.z + Math.sin(a) * rad;
        const c = { x, z, y: this.heightAt(x, z) - 0.5, h: 9 + R() * 6, r: 1.2 };
        this.columns.push(c); out.push(c);
        for (const f of [0.15, 0.5, 0.85]) this.cols.push({ x, y: c.y + c.h * f, z, r: c.r + 0.4 });
      }
      return out;
    };
    const outer = ring(10, 15, 0.2); ring(5, 7, 0.3);
    for (let i = 0; i < outer.length; i++) {
      const a = outer[i], b = outer[(i + 1) % outer.length];
      if (a && b && R() < 0.65) {
        const top = Math.min(a.y + a.h, b.y + b.h);
        this.lintels.push({ x: (a.x + b.x) / 2, y: top + 0.5, z: (a.z + b.z) / 2,
          len: Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2) + 2, yaw: Math.atan2(-(b.z - a.z), b.x - a.x) });
      }
    }

    // rocks
    for (let i = 0; i < (exp ? 95 : MS.rocks); i++) {
      const x = (R() * 2 - 1) * 275 * K, z = (R() * 2 - 1) * 275 * K;
      if (!farFrom(x, z, [ws, rs], 26)) continue;
      const r = R() < 0.12 ? 8 + R() * 5 : 2 + R() * 4.5;
      const y = this.heightAt(x, z) + r * 0.25;
      this.rocks.push({ x, y, z, r, sx: 0.8 + R() * 0.5, sy: 0.7 + R() * 0.6, sz: 0.8 + R() * 0.5, rot: R() * TAU });
      this.cols.push({ x, y, z, r: r * 0.92 });
    }

    // expedition: 6 underwater bases, all with the platform at 50 m depth on the cliff edge of the first floor,
    // spread around the rim every 60° (the first one on the left / west). They share one aquarium.
    this.base = null; this.bases = [];
    if (exp) {
      for (let k = 0; k < 6; k++) {
        const a = Math.PI + k * Math.PI / 3, dx = Math.cos(a), dz = Math.sin(a);
        let br = 240;
        for (let r = 196; r <= 286; r += 0.5) if (SURFACE - this.heightAt(dx * r, dz * r) <= 53) { br = r; break; }
        // 16 m out from the cliff edge, over the abyss on stilts (closer it would stick in the rock wall)
        const c = { x: dx * (br - 16), y: SURFACE - 50, z: dz * (br - 16) };
        this.bases.push({ c, dome: { x: c.x, y: c.y, z: c.z - 3.5 }, tank: { x: c.x, y: c.y, z: c.z + 5 } });
        const near = (o) => (o.x - c.x) ** 2 + (o.z - c.z) ** 2 < 16 * 16 && Math.abs(o.y - c.y) < 16;
        this.rocks = this.rocks.filter(o => !near(o)); this.cols = this.cols.filter(o => !near(o));   // clear the building site
        this.cols.push({ x: c.x, y: c.y + 1.2, z: c.z - 3.5, r: 4.6 }, { x: c.x, y: c.y + 1.6, z: c.z + 5, r: 3.7 }, { x: c.x, y: c.y + 3.6, z: c.z + 5, r: 3.7 });
      }
      this.base = this.bases[0];
    }

    // collider hash
    this.hash = new Map();
    for (const c of this.cols) {
      const pad = c.r + 4;
      for (let cx = Math.floor((c.x - pad) / HC); cx <= Math.floor((c.x + pad) / HC); cx++)
        for (let cz = Math.floor((c.z - pad) / HC); cz <= Math.floor((c.z + pad) / HC); cz++) {
          const k = hkey(cx, cz); let l = this.hash.get(k);
          if (!l) this.hash.set(k, l = []);
          l.push(c);
        }
    }

    const free = (x, y, z, pad) => !this.cols.some(c => (c.x - x) ** 2 + (c.y - y) ** 2 + (c.z - z) ** 2 < (c.r + pad) ** 2);
    const spot = (cx, cz, rad, lift, pad = 2) => {
      let p;
      for (let i = 0; i < 40; i++) {
        const a = R() * TAU, d = rad * Math.sqrt(R());
        let x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        const lim = exp ? 270 : PLAY - 18; x = Math.max(-lim, Math.min(lim, x)); z = Math.max(-lim, Math.min(lim, z));
        p = { x, y: this.heightAt(x, z) + lift, z, yaw: R() * TAU };
        if (free(p.x, p.y, p.z, pad)) return p;
      }
      return p;
    };
    this.spot = spot;

    // kelp forests
    const kelpSites = [];
    for (let i = 0; i < (exp ? 4 : MS.kelp); i++) { const s = exp ? ringSite(245, 268) : pickSite(220 * K, sites.concat(kelpSites), 70 * K); kelpSites.push(s); }
    for (const s of kelpSites) for (let i = 0; i < 170; i++) {
      const p = spot(s.x, s.z, 38, 0, 0.5);
      this.kelp.push({ x: p.x, y: p.y - 0.3, z: p.z, h: 7 + R() * 12, rot: R() * Math.PI });
    }
    this.kelpSites = kelpSites;
    // coral reefs + scattered coral
    const reefs = []; this.reefSites = reefs;
    for (let i = 0; i < (exp ? 4 : MS.reefs); i++) reefs.push(exp ? ringSite(i < 3 ? 245 : 185, i < 3 ? 268 : 205) : pickSite(230 * K, reefs, 80 * K));
    const pal = [0xff5d8f, 0xff9a3c, 0xc86bff, 0xffd84d, 0x35e0c8, 0xff6b5e];
    const nReef = exp ? 480 : 720, nCoral = exp ? 620 : 1000;
    for (let i = 0; i < nCoral; i++) {
      const s = i < nReef ? reefs[i % reefs.length] : { x: 0, z: 0 };
      const p = spot(s.x, s.z, i < nReef ? 34 : 270 * K, 0, 0.3);
      if (exp && i >= nReef && p.y < 20) continue;     // no stray coral in the dark deep
      this.coral.push({ x: p.x, y: p.y, z: p.z, s: 0.5 + R() * 1.6, type: (R() * 3) | 0, col: pal[(R() * pal.length) | 0], rot: R() * TAU });
    }

    // loot crates
    const addCrates = (cx, cz, rad, n) => { for (let i = 0; i < n; i++) this.crates.push(spot(cx, cz, rad, 0.05, 2.2)); };
    addCrates(ws.x, ws.z, 22, 5);
    addCrates(rs.x, rs.z, 16, 5);
    addCrates(this.smx, this.smz, 30, 4);
    for (const s of kelpSites) addCrates(s.x, s.z, 30, 3);
    for (const s of reefs) addCrates(s.x, s.z, 28, 2);
    addCrates(0, 0, 265 * K, exp ? 16 : MS.crates);

    // vehicles
    this.vehSpawns.push({ type: 'sub', ...spot(ws.x, ws.z, 30, 3.5, 4) });
    this.vehSpawns.push({ type: 'sub', ...spot(rs.x, rs.z, 28, 3.5, 4) });
    for (let i = 0; i < (exp ? 2 : MS.subs); i++) this.vehSpawns.push({ type: 'sub', ...spot(0, 0, 240 * K, 3.5, 4) });
    for (let i = 0; i < (exp ? 9 : MS.scooters); i++) this.vehSpawns.push({ type: 'scooter', ...spot(0, 0, 250 * K, 1.4, 2) });
    // Jetskis: neben den ersten 4 Scootern (ohne neue Zufallszahlen, damit der Rest der Karte gleich bleibt)
    for (const sc of this.vehSpawns.filter(v => v.type === 'scooter').slice(0, 4)) {
      const x = sc.x + 5, z = sc.z + 3; this.vehSpawns.push({ type: 'jetski', x, y: this.heightAt(x, z) + 1.8, z, yaw: sc.yaw });
    }
    // Torpedo-Rochen: neben drei anderen Scootern (auch ohne neue Zufallszahlen)
    for (const sc of this.vehSpawns.filter(v => v.type === 'scooter').slice(4, 7)) {
      const x = sc.x - 6, z = sc.z - 4; this.vehSpawns.push({ type: 'ray', x, y: this.heightAt(x, z) + 2.2, z, yaw: sc.yaw });
    }
    // große Karte: noch mehr Jetskis und Rochen, überall verteilt (auch bei Wrack, Ruinen, Riffen und Kelpwäldern)
    if (!exp) {
      const hot = [ws, rs, ...reefs, ...kelpSites];
      for (let i = 0; i < MS.jetskis; i++) { const h = i < hot.length ? hot[i] : { x: 0, z: 0 }; this.vehSpawns.push({ type: 'jetski', ...spot(h.x, h.z, i < hot.length ? 40 : 250 * K, 1.8, 2.5) }); }
      for (let i = 0; i < MS.rays; i++) this.vehSpawns.push({ type: 'ray', ...spot(0, 0, 250 * K, 2.2, 2.5) });
    }

    // creature sites
    this.lairs.push(spot(ws.x, ws.z, 14, 1.3, 1.5), spot(rs.x, rs.z, 10, 1.3, 1.5));
    for (const s of reefs.slice(0, exp ? 2 : 4)) this.lairs.push(spot(s.x, s.z, 18, 1.3, 1.5));
    this.lairs.push(spot(kelpSites[0].x, kelpSites[0].z, 15, 1.3, 1.5));
    if (!exp) this.lairs.push(spot(kelpSites[3].x, kelpSites[3].z, 15, 1.3, 1.5));
    for (let i = 0; i < (exp ? 5 : MS.swarms); i++) { const p = spot(0, 0, 220 * K, 0, 3); p.y += 12 + R() * 22; this.swarms.push(p); }

    // glowing crystals on the deep floors (expedition only, decoration)
    this.crystals = [];
    if (exp) for (let i = 0; i < 260; i++) {
      const a = R() * TAU, d = Math.sqrt(R()) * 215, x = Math.cos(a) * d, z = Math.sin(a) * d, y = this.heightAt(x, z);
      if (y > -30) continue;
      this.crystals.push({ x, y: y - 0.3, z, s: 0.6 + R() * 1.8, rot: R() * TAU, tilt: (R() - 0.5) * 0.6, col: [0x5ef2e0, 0xb06bff, 0x4db8ff, 0xff4df0][(R() * 4) | 0] });
    }
    // boss lairs: one on each floor's ledge, hovering a bit above the ground
    this.bossLairs = EXP_LEDGES.map(([r0, r1], i) => {
      let best = null;
      for (let k = 0; k < 40; k++) {
        const p = ringSite(r0, r1), y = this.heightAt(p.x, p.z), depth = SURFACE - y;
        const lair = { x: p.x, z: p.z, y: Math.min(SURFACE - FLOORS[i].top - 6, y + 7) };
        if (!best) best = lair;
        if (this.bases.some(b => Math.hypot(b.c.x - lair.x, b.c.z - lair.z) < 55)) continue;   // keep bosses away from the bases
        if (depth > FLOORS[i].top + 5 && depth < FLOORS[i].bot + 10) { best = lair; break; }
      }
      return best;
    });
    this.pois = exp ? [{ n: 'Boot', x: EXP_BOAT.x, z: EXP_BOAT.z }, ...this.bases.map(b => ({ n: 'Basis', x: b.c.x, z: b.c.z }))] : [
      { n: 'Wrack', x: ws.x, z: ws.z }, { n: 'Ruinen', x: rs.x, z: rs.z },
      { n: 'Seeberg', x: this.smx, z: this.smz }, { n: 'Kelpwald', x: kelpSites[0].x, z: kelpSites[0].z },
      { n: 'Riff', x: reefs[0].x, z: reefs[0].z }, { n: 'Riff', x: reefs[3].x, z: reefs[3].z }, { n: 'Kelpwald', x: kelpSites[3].x, z: kelpSites[3].z },
    ];
    // Leuchtkorallen überall auf dem Boden. Eigener Zufall (RG), damit sich der Rest der Welt nicht verschiebt.
    const RG = rng(this.seed ^ 0x51ed270b);
    this.glowCorals = [];
    const gcN = exp ? GLOW_CORALS.count : Math.round(GLOW_CORALS.count * MAP_K * MAP_K), gcR = exp ? 280 : PLAY - 8;
    for (let i = 0; i < gcN; i++) {
      const x = (RG() * 2 - 1) * gcR, z = (RG() * 2 - 1) * gcR, s = 0.6 + RG() * 0.9, col = (RG() * 3) | 0, rot = RG() * TAU;
      if (exp && Math.hypot(x - EXP_BOAT.x, z - EXP_BOAT.z) < 40) continue;                      // nicht unter dem Boot
      if ((this.bases || []).some(b => Math.hypot(b.c.x - x, b.c.z - z) < 14)) continue;          // nicht in den Basen
      const y = this.heightAt(x, z);
      if (y > SURFACE - 8) continue;                                                               // nicht oben am Rand
      this.glowCorals.push({ x, y, z, s, col, rot });
    }
    // Höhlen im Riff: um Truhen, die in einem Riff liegen, wird ein Ring aus Felsbrocken mit einem schmalen Eingang
    // und ein Dach gebaut. So sind die Truhen versteckt und man muss hineinschwimmen. Eigener Zufall (RC).
    const RC = rng(this.seed ^ 0x2c1b3c6d);
    this.caves = [];
    const addCol = (c) => {   // Fels zum Kollisions-Gitter hinzufügen (das Gitter ist schon gebaut)
      this.cols.push(c);
      const pad = c.r + 4;
      for (let cx = Math.floor((c.x - pad) / HC); cx <= Math.floor((c.x + pad) / HC); cx++)
        for (let cz = Math.floor((c.z - pad) / HC); cz <= Math.floor((c.z + pad) / HC); cz++) {
          const k = hkey(cx, cz); let l = this.hash.get(k); if (!l) this.hash.set(k, l = []); l.push(c);
        }
    };
    this.reefMounds = [];   // Korallen-Berge und Höhlenwände (Kugeln: Position + Radius), werden in reef.js gezeichnet
    // Hitbox kleiner als die sichtbare (knubbelige) Form, damit man nie gegen "Luft" stößt
    // hit = wie groß die Hitbox im Vergleich zum sichtbaren Hügel ist (1 = gleich groß). Höhlensteine kleiner, damit die Eingänge frei bleiben.
    const rock = (x, y, z, r, hit = 0.78) => { const sx = 0.9 + RC() * 0.3, sy = 0.8 + RC() * 0.3, sz = 0.9 + RC() * 0.3; this.reefMounds.push({ x, y, z, r, sx, sy, sz, rot: RC() * TAU }); addCol({ x, y, z, r: r * (hit < 0.9 ? Math.min(sx, sy, sz) : (sx + sy + sz) / 3) * hit }); };
    for (const cr of this.crates) {
      if (!reefs.some(s => Math.hypot(s.x - cr.x, s.z - cr.z) < 36)) continue;   // nur Truhen im Riff
      const door = RC() * TAU, ring = CAVE.ring;
      for (let i = 0; i < CAVE.stones; i++) {
        const a = door + (i + 1) / (CAVE.stones + 1) * TAU;                        // rundherum, nur am Eingang (door) bleibt eine Lücke
        const x = cr.x + Math.cos(a) * ring, z = cr.z + Math.sin(a) * ring, r = CAVE.stone + RC() * 0.4;
        rock(x, Math.max(this.heightAt(x, z), cr.y - 0.5) + r * 0.55, z, r);
      }
      const top = cr.y + CAVE.height;
      rock(cr.x, top, cr.z, ring * 0.95);                                            // Dach
      for (let i = 0; i < 3; i++) { const a = door + Math.PI + (i - 1) * 1.6; rock(cr.x + Math.cos(a) * ring * 0.8, top - 0.6, cr.z + Math.sin(a) * ring * 0.8, CAVE.stone * 0.9); }
      this.caves.push({ x: cr.x, y: cr.y, z: cr.z, door, ring, top });
    }
    // großes Riff: viele Korallen-Hügel dicht beieinander, die sich aufeinander stapeln (Berge und Grate).
    // Frei bleiben: das Innere der Höhlen, ein Gang vor jedem Höhleneingang und die übrigen Truhen.
    const blocksCave = (x, z, r) => this.caves.some(c => {
      if (Math.hypot(c.x - x, c.z - z) < c.ring + r * 0.55) return true;                      // Höhle selbst
      const ex = Math.cos(c.door), ez = Math.sin(c.door), px = x - c.x, pz = z - c.z;         // Gang vor dem Eingang (8 m lang)
      const along = px * ex + pz * ez, side = Math.abs(-px * ez + pz * ex);
      return along > 0 && along < c.ring + 8 + r && side < r + 1.6;
    });
    const start = this.reefMounds.length;
    const mound = (x, z, r) => {
      if (blocksCave(x, z, r)) return;
      if (this.crates.some(c => !this.caves.some(cv => cv.x === c.x && cv.z === c.z) && Math.hypot(c.x - x, c.z - z) < r + 2)) return;
      // auf die schon gebauten Hügel setzen (stapeln), sonst auf den Boden
      let y = this.heightAt(x, z) + r * 0.3;
      for (let i = start; i < this.reefMounds.length; i++) {
        const m = this.reefMounds[i], hd = Math.hypot(m.x - x, m.z - z);
        if (hd < m.r * 0.9) y = Math.max(y, m.y + Math.sqrt(m.r * m.r * 0.81 - hd * hd) * m.sy - r * 0.45);
      }
      rock(x, y, z, r, REEF_HITBOX);
    };
    for (const s of reefs) for (let k = 0; k < REEF_MOUNDS.count; k++) {
      const a = RC() * TAU, d = Math.pow(RC(), 0.7) * REEF_MOUNDS.spread, x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d;
      const r = REEF_MOUNDS.min + RC() * RC() * (REEF_MOUNDS.max - REEF_MOUNDS.min) * (1 - d / REEF_MOUNDS.spread * 0.5);   // in der Mitte größer
      mound(x, z, r);
    }
    // Riff-Adern (nur Battle Royale): ein Ring durch die 4 Riffe und ein paar lange Adern von Rand zu Rand.
    // Jede Ader ist eine Kurve, die sich schlängelt; entlang der Kurve steht alle paar Meter ein Korallen-Hügel.
    if (!exp) {
      const RV = rng(this.seed ^ 0x7e1a5b33), VN = REEF_VEINS, edge = PLAY - 25;
      const ring = [...reefs].sort((a, b) => Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x));
      const veins = ring.map((s, i) => [s, ring[(i + 1) % ring.length]]);
      for (let i = 0; i < VN.cross; i++) {
        const a = RV() * TAU, b = a + Math.PI + (RV() - 0.5) * 1.2;
        veins.push([{ x: Math.cos(a) * edge, z: Math.sin(a) * edge }, { x: Math.cos(b) * edge, z: Math.sin(b) * edge }]);
      }
      // frei lassen: Wrack, Ruinen und die Fahrzeuge
      const tooClose = (x, z, r) => Math.hypot(ws.x - x, ws.z - z) < 32 + r || Math.hypot(rs.x - x, rs.z - z) < 28 + r
        || this.vehSpawns.some(v => Math.hypot(v.x - x, v.z - z) < r + 6);
      for (const [A, B] of veins) {
        const dx = B.x - A.x, dz = B.z - A.z, len = Math.hypot(dx, dz), nx = -dz / len, nz = dx / len;
        const bend = (RV() - 0.5) * len * 0.5, ph = RV() * TAU, steps = Math.ceil(len / VN.step);
        for (let k = 0; k <= steps; k++) {
          const t = k / steps, off = bend * 4 * t * (1 - t) + Math.sin(t * 9 + ph) * VN.wobble;
          const x = A.x + dx * t + nx * off + (RV() - 0.5) * VN.width, z = A.z + dz * t + nz * off + (RV() - 0.5) * VN.width;
          const r = VN.min + RV() * RV() * (VN.max - VN.min);
          if (Math.max(Math.abs(x), Math.abs(z)) > PLAY - 12 || tooClose(x, z, r)) continue;
          mound(x, z, r);
        }
      }
    }
    // ----- neue Orte auf der großen Karte (nur Battle Royale) -----
    // Containerfeld, Flugzeugwrack, Schwarze Raucher (heiße Quellen) und eine Pipeline quer über die Karte.
    // Eigener Zufall (RL), damit sich der Rest der Welt nicht verschiebt. Gezeichnet wird alles in props.js.
    this.containers = []; this.plane = null; this.vents = []; this.pipe = [];
    if (!exp) {
      const RL = rng(this.seed ^ 0x3d5a9e21), lim = PLAY - 60;
      const taken = [ws, rs, { x: this.smx, z: this.smz }, ...reefs, ...kelpSites];
      const site = (minD) => {
        let p = null;
        for (let i = 0; i < 120; i++) {
          const x = (RL() * 2 - 1) * lim, z = (RL() * 2 - 1) * lim;
          p = { x, z }; if (farFrom(x, z, taken, minD)) break;
        }
        taken.push(p); return p;
      };
      const crate = (x, z) => this.crates.push({ x, y: this.heightAt(x, z) + 0.05, z, yaw: RL() * TAU });
      // Containerfeld: Container liegen kreuz und quer, manche gestapelt, manche offen
      const cs = site(95), cyaw = RL() * TAU;
      for (let i = 0; i < 13; i++) {
        const a = RL() * TAU, d = 4 + RL() * 22, x = cs.x + Math.cos(a) * d, z = cs.z + Math.sin(a) * d;
        const yaw = cyaw + (RL() < 0.6 ? 0 : Math.PI / 2) + (RL() - 0.5) * 0.5, y = this.heightAt(x, z);
        const c = { x, y, z, yaw, col: (RL() * 6) | 0, open: RL() < 0.35, tilt: (RL() - 0.5) * 0.12 };
        this.containers.push(c);
        if (i < 4 && RL() < 0.8) this.containers.push({ x, y: y + 2.6, z, yaw: yaw + (RL() - 0.5) * 0.3, col: (RL() * 6) | 0, open: false, tilt: (RL() - 0.5) * 0.08 });   // obendrauf
      }
      for (const c of this.containers) for (const k of [-2, 0, 2]) addCol({ x: c.x + Math.cos(c.yaw) * k, y: c.y + 1.3, z: c.z - Math.sin(c.yaw) * k, r: 1.45 });
      for (let i = 0; i < 3; i++) { const a = RL() * TAU, d = 8 + RL() * 18; crate(cs.x + Math.cos(a) * d, cs.z + Math.sin(a) * d); }
      this.pois.push({ n: 'Containerfeld', x: cs.x, z: cs.z });
      // Flugzeugwrack: Rumpf in zwei Teilen, Flügel, Motoren
      const ps = site(95), pyaw = RL() * TAU;
      this.plane = { x: ps.x, z: ps.z, y: this.heightAt(ps.x, ps.z), yaw: pyaw, tailYaw: (RL() - 0.5) * 0.8, roll: (RL() - 0.5) * 0.4 };
      for (const k of [-8, -3, 2]) addCol({ x: ps.x + Math.cos(pyaw) * k, y: this.plane.y + 1.6, z: ps.z - Math.sin(pyaw) * k, r: 2.1 });
      for (let i = 0; i < 2; i++) { const a = RL() * TAU, d = 9 + RL() * 10; crate(ps.x + Math.cos(a) * d, ps.z + Math.sin(a) * d); }
      this.pois.push({ n: 'Flugzeug', x: ps.x, z: ps.z });
      // Schwarze Raucher: Schlote aus Gestein, aus denen schwarzes, heißes Wasser quillt
      const vs = site(90);
      for (let i = 0; i < 6; i++) {
        const a = RL() * TAU, d = i ? 3 + RL() * 13 : 0, x = vs.x + Math.cos(a) * d, z = vs.z + Math.sin(a) * d;
        const v = { x, y: this.heightAt(x, z) - 0.3, z, h: 4 + RL() * (i ? 7 : 12), r: 0.8 + RL() * 0.9 };
        this.vents.push(v);
        for (let k = 0; k < 3; k++) addCol({ x, y: v.y + v.h * (0.2 + k * 0.32), z, r: v.r * (1.25 - k * 0.25) });
      }
      for (let i = 0; i < 2; i++) { const a = RL() * TAU, d = 10 + RL() * 8; crate(vs.x + Math.cos(a) * d, vs.z + Math.sin(a) * d); }
      this.pois.push({ n: 'Raucher', x: vs.x, z: vs.z });
      // Pipeline: liegt auf Stützen quer über die Karte (von Rand zu Rand), schlängelt sich etwas
      const pa = RL() * TAU, edge = PLAY - 30, bend = (RL() - 0.5) * 160;
      const A = { x: Math.cos(pa) * edge, z: Math.sin(pa) * edge }, B = { x: -A.x, z: -A.z }, len = Math.hypot(B.x - A.x, B.z - A.z);
      const nx = -(B.z - A.z) / len, nz = (B.x - A.x) / len;
      for (let d = 0; d <= len; d += 2) {
        const t = d / len, off = bend * 4 * t * (1 - t), x = A.x + (B.x - A.x) * t + nx * off, z = A.z + (B.z - A.z) * t + nz * off;
        const y = this.heightAt(x, z) + 1.4;
        this.pipe.push({ x, y, z });
        addCol({ x, y, z, r: 0.95 });
      }
      // Fahrzeuge an den neuen Orten
      for (const s of [cs, ps, vs]) { const x = s.x + 14, z = s.z - 10; this.vehSpawns.push({ type: 'jetski', x, y: this.heightAt(x, z) + 1.8, z, yaw: RL() * TAU }); }
    }
  }

  _raw(x, z) {
    const s = this.seed;
    if (this.mode === 'exp') {
      // a terraced funnel: every step down is a new floor ("Etage")
      const r = Math.sqrt(x * x + z * z) + (fbm(x * 0.008, z * 0.008, s + 7, 3) - 0.5) * 36;
      let h = EXP_BOTTOM;
      for (const [r0, step] of EXP_STEPS) h += step * sstep(r0, r0 + 12, r);
      h += (fbm(x * 0.03, z * 0.03, s + 50, 2) - 0.5) * 5;
      h += 30 * sstep(250, 320, Math.max(Math.abs(x), Math.abs(z)));   // Rand (die Expedition ist so groß wie früher)
      return h;
    }
    let h = fbm(x * 0.0055, z * 0.0055, s, 4) * 52;
    h += (fbm(x * 0.035, z * 0.035, s + 50, 2) - 0.5) * 5;
    const tz = (fbm(x * 0.004, 3.7, s + 99, 2) - 0.5) * 300 * MAP_K;      // winding trench
    h -= 34 * (1 - sstep(10, 46, Math.abs(z - tz)));
    const mx = x - this.smx, mz = z - this.smz;
    h += 55 * (1 - sstep(15, 95 * MAP_K, Math.sqrt(mx * mx + mz * mz)));   // seamount
    h += 80 * sstep(HALF - 70, HALF, Math.max(Math.abs(x), Math.abs(z))); // rim
    return h;
  }

  heightAt(x, z) {
    let gx = (x + HALF) / CELL, gz = (z + HALF) / CELL;
    const m = GRID_N - 0.001;
    gx = gx < 0 ? 0 : gx > m ? m : gx; gz = gz < 0 ? 0 : gz > m ? m : gz;
    const ix = gx | 0, iz = gz | 0, fx = gx - ix, fz = gz - iz;
    const g = this.grid, i = iz * (GRID_N + 1) + ix;
    const a = g[i], b = g[i + 1], c = g[i + GRID_N + 1], d = g[i + GRID_N + 2];
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  }

  // Push a sphere {x,y,z,vx,vy,vz} out of terrain, colliders and world bounds.
  // top: highest allowed y (default keeps the sphere just under the water surface)
  collide(p, r, top = SURFACE - r - 0.4) {
    const L = this.lim;
    if (p.x < -L) { p.x = -L; if (p.vx < 0) p.vx = 0; } else if (p.x > L) { p.x = L; if (p.vx > 0) p.vx = 0; }
    if (p.z < -L) { p.z = -L; if (p.vz < 0) p.vz = 0; } else if (p.z > L) { p.z = L; if (p.vz > 0) p.vz = 0; }
    // Aus Felsen und Riff-Hügeln hinausschieben. Mehrmals hintereinander, damit man zwischen 3 Hügeln nicht hin- und
    // hergeschoben wird (und stecken bleibt). Schwung in die Wand hinein wird weggenommen → man gleitet an Hügeln entlang.
    const list = this.hash.get(hkey(Math.floor(p.x / HC), Math.floor(p.z / HC)));
    p.hits = 0;
    if (list) for (let pass = 0; pass < 4; pass++) {
      let moved = false;
      for (const c of list) {
        const dx = p.x - c.x, dy = p.y - c.y, dz = p.z - c.z, rr = c.r + r;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < rr * rr && d2 > 1e-6) {
          const d = Math.sqrt(d2), k = (rr - d) / d, nx = dx / d, ny = dy / d, nz = dz / d;
          p.x += dx * k; p.y += dy * k; p.z += dz * k; moved = true; p.hits++;
          if (p.vx !== undefined) { const vn = p.vx * nx + p.vy * ny + p.vz * nz; if (vn < 0) { p.vx -= vn * nx; p.vy -= vn * ny; p.vz -= vn * nz; } }
        }
      }
      if (!moved) break;
    }
    const g = this.heightAt(p.x, p.z) + r;
    if (p.y < g) { p.y = g; if (p.vy < 0) p.vy = 0; }
    if (p.y > top) { p.y = top; if (p.vy > 0) p.vy = 0; }
  }

  // Nächster freier Platz für eine Kugel mit Radius r (nicht im Boden, in keinem Felsen/Hügel), höchstens maxD Meter weit.
  // Wird benutzt, wenn jemand zwischen Riff-Hügeln feststeckt. Gibt null zurück, wenn nichts frei ist.
  freeSpot(x, y, z, r, maxD = 9) {
    const free = (px, py, pz) => {
      if (py < this.heightAt(px, pz) + r) return false;
      const list = this.hash.get(hkey(Math.floor(px / HC), Math.floor(pz / HC)));
      if (list) for (const c of list) if ((px - c.x) ** 2 + (py - c.y) ** 2 + (pz - c.z) ** 2 < (c.r + r + 0.15) ** 2) return false;
      return true;
    };
    for (let d = 0.6; d <= maxD; d += 0.6) for (let i = 0; i < 26; i++) {
      const u = (i + 0.5) / 26 * 2 - 1, a = i * 2.39996, s = Math.sqrt(1 - u * u);   // gleichmäßig verteilte Richtungen
      const px = x + Math.cos(a) * s * d, py = y + u * d, pz = z + Math.sin(a) * s * d;
      if (free(px, py, pz) && free(px, py + 2.5, pz)) return { x: px, y: py, z: pz };   // auch nach oben frei (kein Dach aus Hügeln)
    }
    return null;
  }

  // First hit of a segment against terrain/colliders. Returns t in (0,1] or -1.
  segmentHit(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const n = Math.max(1, Math.ceil(len / 1.5));
    for (let i = 1; i <= n; i++) {
      const t = i / n, x = ax + dx * t, y = ay + dy * t, z = az + dz * t;
      if (y < this.heightAt(x, z) || y > SURFACE) return t;
      const list = this.hash.get(hkey(Math.floor(x / HC), Math.floor(z / HC)));
      if (list) for (const c of list) {
        const ex = x - c.x, ey = y - c.y, ez = z - c.z;
        if (ex * ex + ey * ey + ez * ez < c.r * c.r) return t;
      }
    }
    return -1;
  }
}
