# PIXELWOLF – Mission Weltraum

Ein browserbasiertes Weltraum-Actionspiel mit PixiJS. Starte `index.html` über einen lokalen Webserver; eine Internetverbindung wird beim ersten Laden für PixiJS benötigt.

## Spielsteuerung

- Pfeiltasten oder `WASD`: Rakete bewegen
- Leertaste: feuern; nach dem Shop-Upgrade gedrückt halten und loslassen, um den Energieschuss aufzuladen
- `Q`: eingesammelte Schockwelle auslösen
- `Esc`: pausieren

Auf Touch-Geräten erscheinen passende Bildschirmtasten.

## Projektstruktur

- `index.html`: Einstiegspunkt und feste PixiJS-Version
- `core.js`: Spielzustände, Eingabe, Speicherzugriff und Hilfsfunktionen
- `ui.js`: Menüs, Shop, Mitteilungen und Touch-Bedienung
- `app.js`: Spiellogik, Figuren, Kollisionen, Spawning, Fortschritt und Effekte
- `assets/`: Grafiken für Rakete, Projektile und UFOs

## Fortschritt

Highscore, Münzen, XP und gekaufte Upgrades werden lokal im Browser gespeichert. Eine neue Runde setzt ausschließlich den aktuellen Lauf zurück; der dauerhafte Fortschritt bleibt erhalten.

## Dauerhafte Upgrades

Im Menü **UPGRADES** lassen sich fünf Stufen je Verbesserung kaufen. Die erste Stufe kostet 20 Münzen; jede weitere kostet 20 % mehr (20, 24, 29, 35, 42 Münzen).

- Feuergeschwindigkeit: +15 % je Stufe
- Münzmagnet: +35 Pixel Sammelradius je Stufe
- Antrieb: +12 % Bewegungsgeschwindigkeit je Stufe
