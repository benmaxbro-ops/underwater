# Undernite

Battle Royale unter Wasser – 3D, Third-Person, läuft im Browser.
Ein kleiner Node.js-Server auf dem Windows-PC hostet das Spiel für alle Geräte im Heimnetz
und füllt freie Plätze mit Bots auf.

## Starten (Windows)

1. Einmalig [Node.js LTS](https://nodejs.org) installieren (oder `winget install OpenJS.NodeJS.LTS`).
2. Repo klonen (oder als ZIP laden und entpacken), `start.bat` doppelklicken. Der Browser öffnet sich auf `http://localhost:8080`.
3. Mitspieler im selben WLAN/LAN öffnen die Adresse, die im Serverfenster und in der Lobby
   unter „Mitspieler im Heimnetz“ steht (z. B. `http://192.168.x.y:8080`).
   Beim ersten Start fragt die Windows-Firewall nach – für **private Netzwerke** zulassen.

Beim ersten Start installiert `start.bat` einmalig die einzige Abhängigkeit (`ws`) per `npm install`.
Danach läuft alles offline; three.js liegt unter `public/vendor/` bei.
Anderer Port: `set PORT=9000` vor `node server.js`.

## Steuerung

| Taste | Aktion |
|---|---|
| W A S D | schwimmen (in Blickrichtung, volle 3D-Bewegung) |
| Maus | zielen / umsehen |
| (Schießen) | Rückstoß wie bei einer Bodycam: Waffe und Kamera reißen zusammen hoch, das Wasser bremst sie weich ab (`RSPRING` in `main.js`). Aus der Waffe quillt eine Gasblase (`GAS`). |
| (Grafik) | Bodycam-Linse (ab Qualität „Niedrig“): schnelles Drehen verwischt das Bild, beim Zielen wird der Rand unscharf (`motion` und `focus` in `lens.js`) |
| (Waffen) | Alle Waffen sehen aus wie echte: Stahl in Gunmetal-Grau, schwarzes Polymer, Noppen-Griffe, Messing-Bolzen im Magazin. Nur die **Kiemen** (gehen auf, wenn Druck und Hitze abgelassen werden) sind weiß-blau. Farben: `GUN_LOOK` in `models.js` |
| Maus im Goliath (Ego-Sicht) | **Freelook:** Die Maus dreht nur deinen Kopf im Cockpit – nach oben durch die Kuppel, zur Seite, nach unten. Mit **rechter Maustaste** dreht sich der ganze Mech zum Blick (ohne Zoom, ohne Kimme und Korn). Die Waffe hängt rechts außen am Roboter (`mechGun`), innen leuchtet es leicht rot, die Lampe (L) sind zwei Scheinwerfer links und rechts an der Kuppel (`MECH_LAMPS`). Werte: `FREELOOK` in `main.js` |
| V im U-Boot | Ego-Sicht **im** U-Boot: du sitzt am Steuerpult (Sonar-Bildschirm, Steuerhorn, Gashebel) und schaust durch die Glaskuppel. **B** = aufstehen: dann bleibt das U-Boot stehen, du läufst mit W/A/S/D herum (Periskop, Leiter, Rohre, Ventile, Koje) und schaust dich um. Vorne am Sitz wieder **B** = hinsetzen. Neben dem Periskop **P** = durchs Periskop schauen (Zoom, Gradzahl). Werte: `SUBROOM` in `subint.js`, `PERI` in `main.js` |
| E am Jetski | **Jetski-Scooter** (rot, 4 Stück neben den Scootern): viel schneller als der Scooter, aber nur vorwärts und mit weiten Kurven. Werte: `jetski` in `VEHICLES` (shared.js) |
| E am Rochen | **Torpedo-Rochen** (3 Stück neben Scootern): gleitet mit schlagenden Flügeln, nur vorwärts, **Linksklick = Torpedo** (40 Schaden, Explosion). Werte: `ray` in `VEHICLES` (shared.js) |
| (Handy) | Auf Geräten mit Touchscreen erscheint eine **Handy-Steuerung**: links Joystick (schwimmen), rechts wischen (umschauen), Knöpfe für Feuer, Zielen, Hoch/Runter, R, E, Q, 4, Waffe wechseln, Ego-Sicht, Sprint. Werte: `TOUCH` in `touch.js` |
| F1 | **Tasten-Übersicht** mit allen Tasten. Beim ersten Battle Royale führt eine **Einführung** Schritt für Schritt durch die Steuerung (jeder Schritt wartet, bis du es gemacht hast). In der Lobby: „Einführung nochmal“. Schritte: `TUT_STEPS` in `tutorial.js` |
| (Musik) | Musik wird im Code erzeugt: in der Lobby ruhige Akkorde, im Spiel ein dunkler Tiefsee-Klang mit fernen Walrufen. Wird geschossen, getroffen oder rückt das Schwarzwasser vor, kommen Bass und Trommeln dazu. Lautstärke: Regler „Musik“ in den Einstellungen, Werte: `MUSIC` in `music.js` |
| Leertaste / C | aufwärts / abwärts – ganz oben schaut dein Kopf aus dem Wasser (X geht auch abwärts) |
| H | Waffe wegstecken / rausholen (weggesteckt: Hände frei, 8 % schneller) |
| (Schwimmen) | Bewegungen laufen weich an, beim Loslassen gleitest du aus, beim Seitwärtsschwimmen neigt sich die Kamera leicht (Werte: `FLOW` in `main.js`) |
| Q | Gadget benutzen (Battle Royale) |
| 4 | Ulti zünden, wenn die goldene Leiste voll ist (Battle Royale). Sie lädt sich langsam von selbst und schneller, wenn du triffst. Manta: **Matrix** – 5 s Zeitlupe, jede Kugel geht daneben, schneller schwimmen. Goliath: **Zielcomputer** – 6 s lang zielt die Kamera von selbst auf den nächsten Gegner, den du siehst (schießen musst du selbst). Triton: **Torpedo-Salve** (3 zielsuchende Torpedos verfolgen den nächsten Gegner und explodieren, wenn sie nah dran sind). Bollwerk: **Festung** (6 s nur ein Drittel Schaden, Gegner werden weggestoßen). Sepia: **Tarnung** (5 s unsichtbar, bis du schießt). Barrakuda: **Rammstoß** (blitzschnell nach vorne, 35 Schaden). Nautilus: **Reparatur** (+60 Leben, Schild voll). Hammerhai: **Blutrausch** (8 s Gegner durch Felsen sehen, schneller). Werte: `ULTI`/`ULTIS` in `shared.js` |
| C (Triton, Manta) | Battle Royale: am Riff-Hügel festhalten = Deckung (ganz still, ruhigeres Zielen). Abwärts dann mit X |
| Shift | Schub (verbraucht Energie) |
| Linksklick | feuern |
| 1 2 3 / Mausrad | Waffe wechseln |
| R | nachladen: Magazin wechseln (das alte kommt in den Rucksack, der Kompressor füllt es wieder auf) |
| E | Truhe öffnen, Waffe aufheben/tauschen, Fahrzeug ein-/aussteigen |
| F | aus dem Oktopusgriff befreien (hämmern) |
| L | Helmlampe an/aus (in der Tiefe ist es stockdunkel) |
| V | Ego-Perspektive an/aus (nicht in Fahrzeugen) |
| G | Finisher (Battle Royale): Gegner mit höchstens 30 % Leben in der Nähe erledigen (Manta 4 m, Triton 14 m, Bollwerk 10 m, Goliath 9 m) |
| Rechtsklick (halten) | zielen über Kimme und Korn (alle Waffen), die Harpune mit Zielfernrohr – je weniger Leben, desto mehr wackelt es |

## Was drin ist (v0.1)

- **Runde:** Start in der Tiefsee (rund 400 m tief, ohne Lampe stockdunkel, die Oberfläche ist unerreichbar), Ausrüstung suchen, das *Schwarzwasser* (die Zone) zieht sich in
  sechs Phasen zusammen, der Letzte gewinnt. Dauer ca. 5 Minuten.
- **Anzüge:** Manta (klein, schnell, 70 LP) · Triton (Allrounder, 100 LP) · Bollwerk (Panzeranzug, 150 LP) ·
  Goliath (Mech wie ein Panzer-Tauchanzug mit Glaskuppel, in der Ego-Sicht sitzt man hinter dem Kuppelfenster, 240 LP, +12 % Schaden, passt in kein Fahrzeug, Oktopusse können ihn nicht halten).
- **Neue Taucher (Perlen-Shop, je 1500 🦪):** Sepia (Tintenflucht: bei wenig Leben blendet eine Tintenwolke die Gegner), Barrakuda (schnellster Sprinter),
  Nautilus (Techniker: Kompressor 35 % schneller), Hammerhai (Elektrosinn: hört Gegner bis 60 m auf dem Sonar).
- **Gadgets (Perlen-Shop, Taste Q):** jeder Taucher hat eins – Manta Haiköder, Triton Sonar-Boje, Bollwerk Schild-Generator, Goliath Bodenstampfer,
  Sepia Tintenbombe, Barrakuda Seilharpune, Nautilus Geschütz-Drohne, Hammerhai Elektroschocker. Werte: `GADGETS` in `shared.js`.
- **Ausrüstung (⚙ auf jeder Taucher-Karte):** Startwaffe wählen (Standard oder gekaufte: Nadler, Splitterwerfer, Harpune, Torpedowerfer) und Gadget mitnehmen oder ablegen – pro Taucher gespeichert.
- **Waffen-Aufsätze (im Ausrüstungs-Fenster, für die Startwaffe):** Leuchtpunkt-Visier, Zielfernrohr 4×, großes Magazin, Trommelmagazin,
  Kompensator, Würgebohrung, Laservisier, Druck-Verstärker – je nach Waffe, einer pro Platz. Werte: `ATTACHMENTS` in `shared.js`.
- **Waffen:** Bolzenpistole, Nadler, Splitterwerfer, Harpune, Torpedowerfer, Bolzen-Revolver, Stachel-MG, Netzwerfer (macht langsam),
  – jeweils in vier Seltenheitsstufen. **Stabwaffen** (Nahkampf, keine Munition): Dreizack (harter Stoß), Elektro-Speer (lähmt kurz),
  Kampfstab (stößt weg). Dazu hat jeder außer dem Goliath ein **Magnet-Gewehr** mit nur 2 Schuss (legt einen Mech 3,5 s lahm).
- **Fahrzeuge:** U-Scooter (schnell, Fahrer ungeschützt) und Mini-U-Boot (450 Rumpfpunkte, Bordtorpedos).
- **Raubtiere:** Haie wittern Verletzte aus großer Entfernung und greifen im Vorbeischwimmen an,
  Oktopusse lauern an Wrack, Ruinen und Riffen, packen zu und vernebeln die Sicht, Quallenschwärme
  verteilen Stromschläge. Alle lassen sich erlegen und hinterlassen Beute.
- **Welt:** bei jeder Runde neu erzeugt – Graben, Seeberg, Wrack, Ruinen, Kelpwälder und ein leuchtendes Netz aus Riff-Adern
  quer über den Boden (feste Hügel: man kann nicht hindurch, Kugeln auch nicht → Deckung).
  Die Karte ist 1,4-mal so breit wie früher (MAP_K in shared.js) – dafür liegen mehr Fahrzeuge herum (6 U-Boote, 16 Scooter,
  15 Jetskis, 7 Rochen), mehr Kisten, Riffe, Kelpwälder, Haie und Quallen (MAP_STUFF). Neue Orte: Containerfeld, Flugzeugwrack,
  Schwarze Raucher (heiße Schlote mit Rauch) und eine Pipeline quer über die Karte, dazu Walskelette und viel Kleinzeug am Boden
  (Kiesel, Seegras, Seeigel, Seesterne, Muscheln, Schwämme, Anemonen – gezeichnet nur in deiner Nähe, siehe props.js).
- **Schießen:** Vor jedem Schuss baut sich kurz Druck auf (Pistole 0,1 s, Harpune 0,3 s), dann geht er mit einem Wumms raus.
  Von weitem klingen Schüsse wie ein dumpfer Schlag gegen eine Holztür.
- **Hitze:** Jeder schnelle Schuss heizt die Waffe auf. Während man schießt, passiert nichts. Hört man auf oder lädt nach,
  kommt die Hitze auf einen Schlag raus: Schallwelle mit Wumms, heiße Blasen, Zischen. War es zu viel am Stück (ab einem Drittel
  des Magazins im vollen Tempo), verbrennt man sich DANN: ein ganzes Pistolen-Magazin = 20 Schaden (kein Schild hilft), „Ah!“,
  ein paar Sekunden benommen, und bei sehr viel Hitze muss man die Waffe 2 Sekunden wegstecken. Wer langsamer schießt, verbrennt sich nicht. Der Goliath sitzt geschützt im Mech und bekommt keinen Hitzeschaden.
  Werte: `HEAT` in `shared.js`.
- **Unterwasser-Licht:** Wasser schluckt Rot zuerst, dann Grün (Werte in `water.js`). Schwebeteilchen blitzen im Lampenkegel auf.
- **Richtungsanzeige:** Ein feiner Ring um die Bildmitte; schießt jemand bis 80 m entfernt, zeigt ein gelber Pfeil in seine Richtung (rot = du wurdest getroffen).
- **Sterben:** Das Bild wird dunkel, dann schwarz, dann „Du bist tot“ – zuschauen, schon den nächsten Taucher wählen oder in den Shop (Einkaufen geht nach dem Tod auch während der Runde).
- **Ligen:** Aus deinen gekauften Upgrades wird ein Level, daraus Liga 1 (Anfänger) bis 4 (Profi) – steht in der Lobby neben dem Namen.
  Jede Liga hat ihren **eigenen Raum** mit eigener Lobby und Runde – Anfänger spielen mit Anfängern, Profis mit Profis, alles gleichzeitig.
  Die Bots bekommen dieselben Upgrades wie die Spieler im Raum. Grenzen: `LEAGUE` in `shared.js`.
- **Wellen-Überleben** (dritter Modus in der Lobby): ihr kämpft zu viert (Bots füllen auf) in der Mitte der Karte gegen Hai-Wellen.
  Jede Welle mehr und stärkere Haie, alle 5 Wellen ein Riesenhai. In der Pause zwischen den Wellen kommen Gefallene zurück,
  alle bekommen Leben und Munition. Vorbei ist es erst, wenn alle gleichzeitig tot sind. 25 Perlen pro geschaffter Welle. Werte: `WAVE` in `server.js`.
- **Duo-Modus** (Häkchen "Duo" in der Lobby): alle spielen in Zweier-Teams, auch die Bots. Teamkameraden starten nebeneinander,
  können sich nicht verletzen, haben ein grünes Namensschild und sind auf dem Sonar ein grüner Punkt. Das letzte Team gewinnt.
  **2-Mann-U-Boot:** Fährt dein Teamkamerad ein U-Boot, steigst du mit **E** unten in die Glaskugel mit zwei MGs und schießt, während er fährt.
  Mit **B** kletterst du aus der Kugel ins U-Boot (herumlaufen, Periskop) und mit **B** wieder zurück – oder am Sitz mit **B** ans Steuer.
  **Auch allein:** Als Fahrer stehst du auf (B) und kletterst an der Bodenluke mit **K** in die Kugel. Von unten (unter dem U-Boot) steigst du mit **E** direkt in die Kugel.
- **Perlen 🦪:** Am Rundenende gibt es 50 pro Kill, 10 pro überlebter Minute und 300 / 150 / 75 für Platz 1–3.
  Sie werden unter deinem Namen gespeichert (`saves/battleroyale.json`), getrennt vom Expeditions-Geld.
- **Perlen-Shop** (Knopf oben rechts in der Lobby): Verbesserungen mit je 3 Stufen – Schnellladen, Rückstoßdämpfer,
  Ruhiges Visier, Profi-Flossen, Turbo-Kompressor, Schnellziehen (Waffe wechseln/rausholen geht schneller), Zäher Anzug (bis +30 % Leben). Gelten nur im Battle Royale.
- **Sonar-Radar** (oben rechts, nur Battle Royale): du bist in der Mitte, vorne ist oben. Ein grüner Strahl dreht sich alle 3 Sekunden einmal herum;
  wo er drüberstreicht, leuchten Boden, Riffe und Gegner in der Nähe (bis 45 m) kurz auf – mit leisem Sonar-Ping pro Umdrehung und "Ding" pro Gegner.
  **Im U-Boot** zeigt das Bord-Sonar alle Gegner bis 90 m durchgehend. Fährt jemand ein U-Boot, hört man dessen Sonar in der Nähe. Werte: `SONAR` und `SONAR_SND` in `hud.js`.
  Auf dem Radar siehst du auch, **was in der Nähe ist** (bis 90 m): gelbe Symbole für freie Fahrzeuge (Ellipse = U-Boot, Dreieck = Jetski,
  Raute = Rochen, Kreis = Scooter), orange Kästchen = Truhen, Punkte in Seltenheitsfarbe = Waffen, grünes/blaues Kreuz = Medikit/Schild.
  Darunter steht die Liste „In der Nähe: …“. Ist nichts in Reichweite, zeigt ein Pfeil am Rand zum nächsten Fahrzeug und zur nächsten Truhe (mit Entfernung, `NEAR` in `hud.js`).

## Modus: Tiefsee-Expedition (v0.2)

In der Lobby rechts zwischen **Battle Royale** und **Tiefsee-Expedition** wählen.

- **Die Welt ist ein Trichter mit 7 Etagen:** Sonnenriff (bis 60 m), Zwielicht (bis 130 m), Mitternacht (bis 210 m),
  Abgrund (bis 290 m), Tiefseegraben (bis 370 m), **Vulkanschlund** (bis 450 m, glüht rot) und **Urzeittiefe** (bis ca. 540 m, ganz unten in der Mitte). In der Mitte an der Oberfläche liegt das **Händler-Boot**.
- **Fische jagen:** 21 Fischarten, 3 pro Etage, tauchen zufällig auf. Je tiefer, desto wertvoller. Selten gibt es
  **goldene Fische** (5× Wert). Manche beißen zurück (Barrakuda, Viperfisch, Anglerfisch, Drachenfisch, Magma-Aal, Säbelzahnfisch).
- **Verkaufen:** Am Boot E drücken – Fische einzeln oder alle verkaufen, Ausrüstung kaufen.
- **6 Unterwasser-Basen:** alle auf Etage 1, 50 m tief, rund um den Rand verteilt (etwa alle 60°). **Jeder Spieler bekommt seine eigene Basis**
  (bis zu 6 Spieler, die gespeicherte bekommst du wieder, wenn sie frei ist). Auf der Minikarte gelb als „Deine Basis“, die anderen mit dem Namen des Besitzers.
  Fische einsetzen nur in der eigenen Basis; Luft tanken kann man an jeder. In jeder Basis sieht man das Aquarium ihres Besitzers.
- **Fang-Leiste:** Alles, was du fängst (Fische *und* besiegte Endbosse), liegt in Slots über den Waffen. Mit **4–9** oder **Q** nimmst du es in die Hand (1–3 = zurück zur Waffe).
  In der Basis setzt du es mit **E** (oder Klick) ins Aquarium. Jeder Slot zeigt, wie viel € pro Sekunde er im Aquarium macht.
- **Aquarium:** Fische darin verdienen jede Minute 8 % ihres Werts (Tiefseefische viel mehr, goldene 5×) – aber **nur während du wirklich spielst**: offline gibt es nichts, und nach 60 s ohne Bewegen/Umschauen (AFK) pausiert das Aquarium.
  **Endbosse** verdienen am meisten, je schwerer, desto mehr: Riffkönig 5 €/s, Krakenmutter 12, Laternenschlund 30, Knochenhai 70, Leviathan 150, Glutkrake 320, Megalodon 700 €/s.
  Es steht als rundes Glasbecken in der Basis. Start mit 3 Plätzen, dort vergrößerbar bis 30. Einkommen wird pro Sekunde angezeigt.
- **Laden (E am Boot):** bessere Waffen, größere **Flaschen** (mehr Luft, tiefer erlaubt), **Atemtraining** (weniger Luftverbrauch) und hellere **Lampen**.
  Alles ist teuer – die besten Sachen kosten mehrere 100.000 €. Nur im Tauch-Modus gibt es **Plasmalanze** und **Schallkanone**;
  Explosionen verletzen dort keine Taucher (Koop).
- **Taschenlampe (L):** hast du von Anfang an. Unten ist es stockdunkel! Der Akku lädt sich an der Oberfläche wieder auf.
- **Reichweite:** jede Waffe schießt nur so weit wie ihre Reichweite (Bolzenpistole 22 m, Splitterwerfer 26 m, Nadler 38 m, Harpune 65 m, Torpedowerfer 80 m).
- **Luft:** sinkt unter Wasser, je tiefer desto schneller. Unter der Maximaltiefe der Flasche macht der Druck Schaden.
  An der Oberfläche füllt sich die Luft wieder.
- **Bosse:** einer pro Etage, jeder Biss macht **20 Schaden** (Glutkrake 25, Megalodon 30), du hast **100 Leben**. Alle, die mitkämpfen, bekommen den Boss in ihre Fang-Leiste. Dann entscheidest du: **am Boot verkaufen** (Belohnung in €) **oder** in der Basis **ins Aquarium** (€ pro Sekunde), nicht beides.
  Was im Aquarium ist, kann man nur noch freilassen (Platz machen), nicht mehr verkaufen.
  Nach 2 Minuten kommt der Boss zurück.
- **Leben regenerieren:** 5 s ohne Schaden, dann heilst du 4 Leben pro Sekunde, an der Oberfläche 15.
- **Startgeld:** neue Taucher beginnen mit 100 €.
- **Ohnmächtig?** Nach 5 s wachst du am Boot auf, die Hälfte deines Fangs ist weg, Geld und Ausrüstung bleiben.
- **Spielstand** wird pro Spielername in `saves/expedition.json` gespeichert.

Alle Werte (Fische, Preise, Flaschen, Bosse) stehen oben in `public/js/shared.js` und lassen sich leicht ändern.
`node test-exp.mjs` spielt bei laufendem Server einen Testtaucher durch die Expedition.

## Aufbau

```
server.js            Node-Server: liefert public/ aus und simuliert das Spiel (20 Hz, autoritativ)
public/js/shared.js  Regeln, Werte und deterministische Welterzeugung (Server und Client)
public/js/main.js    Client: Netzwerk, Eingabe, Kamera, Entity-Sync
public/js/world.js   Meeresboden, Flora, Wasser, Partikel, Zonenwand
public/js/models.js  prozedurale Modelle (Taucher, Mech, U-Boot, Kisten, Projektile)
public/js/creatures.js realistische Meerestiere (Fische, Haie, Krake, Rochen, Bosse)
public/js/ship.js    das Piratenschiff des Händlers
public/js/hud.js     HUD, Lobby, Ergebnis
public/js/audio.js   synthetische Sounds (WebAudio)
```

Balance-Werte (Leben, Tempo, Waffen, Zonenphasen) stehen oben in `shared.js` bzw. `server.js` (`PHASES`).
`node test-sim.mjs` spielt bei laufendem Server eine Runde als Testclient durch
(`UN_SPEED=25` am Server = Zeitraffer).

## Sounds und Danke

Die Schuss- und Nachlade-Sounds sind echte Aufnahmen (Liste mit Herkunft: `public/sounds/QUELLEN.txt`).
Fast alle sind CC0 (frei ohne Namensnennung). Die Glock-17-Aufnahme für Pistole und Revolver stammt von **JKirsch**
([SoundBible](https://soundbible.com/1382-9mm-Glock-17.html), Lizenz CC BY 3.0 – deshalb steht der Name hier).
