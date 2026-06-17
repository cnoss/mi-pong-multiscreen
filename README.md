# mi-pong-multiscreen

Eine kleine Multiscreen-/Multiuser-Demo des Klassikers **Pong**. Das Spielfeld
läuft auf einem großen, gemeinsamen Bildschirm (z. B. Beamer oder TV), während
zwei Spieler ihre Schläger jeweils über das eigene Smartphone per Touch steuern.

Die Demo ist im Rahmen der Medieninformatik an der TH Köln entstanden.

## Idee

- Ein **Server-Screen** (`server.html`) zeigt das eigentliche Spielfeld und
  blendet für jeden der beiden Spieler einen **QR-Code** ein.
- Jeder Spieler scannt den QR-Code mit dem Smartphone und öffnet so seinen
  **Client** (`index.html`).
- Auf dem Smartphone wird per Touch-/Pan-Geste der eigene Schläger bewegt.
- Sobald sich beide Spieler verbunden haben (beide QR-Codes verschwinden),
  startet das Spiel automatisch.

## Aufbau

| Datei | Rolle |
| --- | --- |
| `server.html` / `assets/js/server.js` | Spielfeld, Spiellogik, Ball, Schläger, Scoreboard, QR-Codes |
| `index.html` / `assets/js/main.js` | Spieler-Client auf dem Smartphone (Touch-Steuerung) |
| `assets/css/main.css` | Styling für Server- und Client-Ansicht |
| `assets/fonts/` | Spielschrift (FFFForward) |
| `assets/imgs/` | Logos und Footer-Grafiken |
| `assets/lib/` | Hilfsbibliotheken (u. a. QR-Code-Generator, Hammer.js) |

### Verwendete Bibliotheken

- **Socket.io** – Echtzeit-Kommunikation zwischen Server-Screen und Clients
- **Hammer.js** – Touch-Gesten auf dem Smartphone
- **Tone.js** / `StartAudioContext.js` – Sound-Effekte
- **http-server** – lokaler Webserver für die Entwicklung (Dev-Dependency)

## Kommunikation

Die Spieldaten laufen nicht direkt zwischen den Geräten, sondern über einen
externen Socket.io-Server. Dessen Adresse ist in `server.js` und `main.js` als
`connect.uri` hinterlegt:

```js
connect.uri = 'https://perasmus.serpens.uberspace.de';
```

Ablauf:

1. Der Server-Screen registriert sich mit einer zufälligen Spiel-ID und der
   Rolle `host`.
2. Die QR-Codes verweisen auf die eigene URL inkl. Spiel-ID und Spielerrolle
   (`?<id>__playerOne` bzw. `?<id>__playerTwo`).
3. Der Client sendet Bewegungen als `move`-Nachrichten (normalisierte
   Koordinaten), der Server verschiebt daraufhin den passenden Schläger.
4. Bei einem Treffer schickt der Server eine `notify`-Nachricht zurück, sodass
   beim jeweiligen Spieler ein Sound ausgelöst wird.

## Spielregeln

- Der Ball wird zwischen den beiden Schlägern hin- und hergespielt und mit jedem
  Treffer leicht schneller.
- Wer den Ball nicht abwehrt, schenkt dem Gegner einen Punkt.
- Nach 300 Punkten ist das Spiel vorbei; danach startet automatisch eine neue
  Runde.

## Lokal starten

Voraussetzung: [Node.js](https://nodejs.org/).

```bash
npm install
npm run dev
```

Anschließend im Browser öffnen:

```
http://localhost:8080/server.html
```

Den Server-Screen auf dem großen Display anzeigen und die eingeblendeten
QR-Codes mit zwei Smartphones scannen.

## Auf echten Geräten testen (VS Code Port Forwarding)

Die Smartphones müssen den Server-Screen erreichen *und* der QR-Code muss eine
für sie gültige URL enthalten. Wichtig: Die QR-Code-URLs werden in
`assets/js/server.js` fest mit `https://` und **ohne Portnummer** gebaut. Eine
einfache lokale IP per `http://…:8080` funktioniert deshalb nicht – du brauchst
eine öffentliche **HTTPS-URL ohne sichtbaren Port**. Am bequemsten geht das mit
dem in VS Code eingebauten Port Forwarding (Dev Tunnels):

1. Dev-Server starten: `npm run dev` (lauscht auf Port `8080`).
2. In VS Code den **Ports**-Tab öffnen (Befehlspalette → „Ports: Focus on Ports
   View", oder neben dem Terminal).
3. **Add Port** → `8080` eintragen. Der Port ist als „Pong Server" beschriftet
   (siehe `.vscode/settings.json`).
4. Rechtsklick auf den Port → **Port Visibility → Public**. Dieser Schritt ist
   einmalig nötig und lässt sich nicht per Datei automatisieren; ohne ihn käme
   das Smartphone nur nach Login durch.
5. Die erzeugte `https://…devtunnels.ms`-URL kopieren und auf dem **großen
   Display** mit angehängtem `/server.html` öffnen.
6. Die nun eingeblendeten QR-Codes zeigen automatisch auf dieselbe Tunnel-URL
   und sind von den Smartphones erreichbar.

Der Socket.io-Server liegt extern (siehe `connect.uri`) und läuft unabhängig
davon – es muss also nur die statische Seite getunnelt werden.

## Autoren

Jorge Pereira, Patrick Erasmus, Christian Noss

## Lizenz

ISC
