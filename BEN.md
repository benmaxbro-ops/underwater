# Hallo Ben! 🤿

Das hier ist **dein** Spiel: Undernite. Es besteht aus etwa 4.000 Zeilen Code – und du kannst jede davon ändern.
Keine Sorge, du musst dafür nicht alles verstehen. Du fängst mit kleinen Sachen an und wirst jedes Mal ein bisschen besser.

---

## 1. Was ist Code überhaupt?

Code ist eine Liste von Anweisungen für den Computer, in einer Sprache, die er versteht. Undernite ist in
**JavaScript** geschrieben – der Sprache, die jeder Browser spricht.

Das Spiel hat zwei Teile:

| Teil | Was er macht | Datei |
|---|---|---|
| **Server** | Das „Gehirn“: rechnet aus, wo jeder Fisch schwimmt, wer getroffen wird, wie viel Geld du hast | [server.js](server.js) |
| **Browser** | Das „Auge“: malt die 3D-Welt, spielt Sounds, nimmt deine Tasten entgegen | Ordner [public/js/](public/js/) |

Und dann gibt es eine ganz besondere Datei: **[shared.js](public/js/shared.js)**. Da stehen alle Spielwerte drin –
wie viel ein Fisch wert ist, wie stark die Bosse sind, wie viel Geld du am Anfang hast. **Hier fängst du an.**

---

## 2. Das Spiel starten

1. Im Ordner `undernite` die Datei **`start.bat`** doppelklicken. Ein schwarzes Fenster geht auf – das ist der Server. **Offen lassen!**
2. Der Browser öffnet sich auf http://localhost:8080. Rechts **Tiefsee-Expedition** wählen und loslegen.

**Nach jeder Änderung:** schwarzes Fenster schließen → `start.bat` neu starten → im Browser **F5** drücken.

---

## 3. Mit Claude arbeiten

Claude ist die KI hier rechts in VS Code. Du schreibst ihr einfach auf Deutsch, was du willst – so wie einem Freund,
der programmieren kann. Claude kennt dich schon (sie hat eine Anleitung in [CLAUDE.md](CLAUDE.md)) und erklärt dir alles Schritt für Schritt.

Gute Sätze zum Anfangen:

- „Erklär mir, was in dieser Datei passiert.“
- „Wo im Code steht, wie viel Leben ein Hai hat?“
- „Ich will einen neuen Fisch. Hilf mir, ihn selbst einzubauen.“
- „Das Spiel startet nicht mehr. Hier ist die Fehlermeldung: …“
- „Speichere den Stand.“ – „Mach das rückgängig.“

**Tipps:**
- Je genauer du sagst, was du willst, desto besser. Statt „mach das Spiel cooler“ lieber
  „ich will, dass goldene Fische glitzern“.
- Frag immer **„Warum?“**, wenn du etwas nicht verstehst. Dafür ist Claude da.
- Claude kann sich irren. Probier jede Änderung im Spiel aus, bevor du weitermachst.
- **Speichern nicht vergessen:** Wenn etwas klappt, sag „Speichere den Stand“. Das ist wie ein Speicherpunkt im Spiel –
  wenn später etwas kaputtgeht, kommst du immer dorthin zurück.

---

## 4. Deine ersten Missionen

Mach die ersten drei **selbst** – ohne dass Claude den Code ändert. Du brauchst nur eine Zahl zu ändern.
Klick auf den Link, dann springt VS Code an die richtige Stelle. Nach dem Ändern **Strg+S** zum Speichern der Datei.

### Mission 1: Reich starten 💰
In [shared.js Zeile 71](public/js/shared.js#L71) steht:
```js
export const EXP_START_MONEY = 100;
```
Das ist eine **Variable**: ein Name (`EXP_START_MONEY`) mit einem Wert (`100`). Mach aus der `100` eine `5000`.
Starte das Spiel neu und tauche mit einem **neuen Spielernamen** ein (der alte Name hat schon sein Geld).
Hast du 5.000 €? Dann hast du gerade zum ersten Mal ein Programm verändert! 🎉

### Mission 2: Pinke Sardinen 🐟
In [Zeile 91](public/js/shared.js#L91) steht die Sardine. Jede Zeile in dieser Liste ist ein Fisch.
Such `col: 0xc9d6e0` – das ist die Farbe. Ersetze sie durch `0xff00ff` (pink).
Farben im Code sind drei Zahlenpaare: **Rot, Grün, Blau** von `00` (nichts) bis `ff` (voll).
`ff0000` ist rot, `00ff00` grün, `ffff00` gelb. Probier deine Lieblingsfarbe aus!

### Mission 3: Goldrausch ⭐
In [Zeile 113](public/js/shared.js#L113) steht `GOLD_CHANCE = 0.04`. Das heißt: 4 % der Fische sind golden.
Was passiert bei `0.5`? Und bei `1`?
(Danach ruhig wieder zurückstellen – sonst ist es zu leicht.)

### Mission 4: Dein eigener Fisch (zusammen mit Claude) 🐡
Schreib Claude: *„Ich will einen neuen Fisch auf Etage 1 einbauen. Erklär mir, wie die Fisch-Liste funktioniert,
und lass mich die Zeile selbst schreiben.“*
Denk dir Name, Farbe, Wert und ob er beißt selbst aus.

### Mission 5: Deine eigene Idee 🚀
Jetzt bist du dran. Ein paar Anregungen:
- ein neuer Boss
- ein neues Teil für den Laden
- ein Sound, wenn man einen goldenen Fisch fängt
- eine neue Waffe

Sag Claude zuerst die Idee und frag: *„Wie schwer ist das? In welche kleinen Schritte können wir das zerlegen?“*

---

## 5. Wenn etwas kaputtgeht

Das passiert **jedem** Programmierer, ständig. Das ist normal.

- **Schwarzes Fenster zeigt rote Fehler oder geht sofort zu?** Kopier die Fehlermeldung und gib sie Claude.
- **Spiel bleibt schwarz?** Im Browser **F12** drücken → Reiter „Konsole“ → rote Zeilen an Claude geben.
- **Gar nichts geht mehr?** Sag Claude: *„Setz alles auf den letzten gespeicherten Stand zurück.“*

Viel Spaß beim Bauen! 🌊
