# Changelog

## 1.3.0 - 2026-07-30

- **FIX:** Laufzeitfehler nach dem Laden der Konfiguration werden jetzt sichtbar gemeldet; `handleRouting()` wird `await`et und besitzt einen Fehlerpfad. Bisher blieb die Seite bei einem Fehler im Seitenaufbau stumm leer
- **FIX:** `getConfigUrl()` schneidet bei einer URL ohne abschliessenden Schraegstrich nicht mehr das letzte Verzeichnis ab; die Konfiguration wird auch unter `.../app` gefunden
- **FIX:** Klick auf einen Hash-Link, der bereits die aktive Seite bezeichnet, rendert die Seite neu (`setupSamePageLinks()`) - das Logo fuehrt damit aus Unteransichten zurueck zur Startseite
- **ENH:** `app/app-base.js` ist wieder byte-identisch zum Template `oda-generic` 1.4.0; app-spezifisches Aufraeumen laeuft ueber den neuen Hook `onPageLeave(page)` in `app/app.js`
- **FIX:** Der Pfad zur Branding-CSS wird jetzt relativ zum App-Verzeichnis aufgeloest (`../assets/branding.css`); bisher wurde die Datei beim lokalen Test unterhalb von `app/` gesucht und deshalb nicht gefunden

## 1.2.0 - 2026-07-24

- **FIX:** Laufzeit-Fehlermeldung wird vor der Anzeige HTML-maskiert (`escapeHtmlForBase`); ein Fehlertext kann kein Markup mehr in die Seite einschleusen (XSS)
- **FIX:** Startseiten-Renderer wird nun `await`et; bei asynchronen Apps erscheint kein kurzzeitiges `[object Promise]` in `#main-content`

## 1.1.0 - 2026-07-23

- **ENH:** Datenabruf auf den Schalter `proxyAktiv` umgestellt; direkte Abrufe sind der Standard, der ODAS-Proxy wird nur noch bei `ja` verwendet
- **ENH:** Einfachen Standalone-Betrieb hinter Traefik mit derselben `odas-config/config.json` wie in der Entwicklung ergänzt
- **ENH:** Traefik-Anbindung auf das externe Netzwerk `proxynet`, den EntryPoint `websecure` und den Zertifikatsresolver `letsencrypt` festgelegt
- **FIX:** Proxy-Basispfad funktioniert jetzt auch bei URLs mit `index.html`; der Ziel-Pfad wird URL-kodiert
- **FIX:** Proxy-Basispfad brach bei URLs mit index.html; jetzt kanonische Ableitung
- **DOC:** Start über `STANDALONE=true make up` dokumentiert

## 23.06.2026 (Version 1.0.1 – Ausflugsziele (ODTA – Tourist Attraction))

- FIX: README-Frontmatter-Fehler behoben (führendes `---` entfernt)
- CHG: Version auf 1.0.1 angehoben (Re-Upload derselben Version 1.0.0 wurde von ODAS mit HTTP 400 abgelehnt)

## 22.06.2026 (Version 1.0.0 – Ausflugsziele (ODTA – Tourist Attraction))

- ENH: App auf Datenquelle OpenData Ostschweiz Tourismus (Place.json, schema.org-konform, CC0/CC-BY/CC-BY-SA) umgestellt
- ENH: KPI-Kacheln (Gesamte Orte, Ortstypen, Lizenzen, Sprachen)
- ENH: Volltextsuche + Filter (Typ, SUI-Kategorie, Sprache, Lizenz)
- ENH: Listenansicht mit clientseitigem Paging
- ENH: Leaflet-Karte mit POI-Markern (dynamisch nachgeladen)
- ENH: Detailansicht pro POI (Bildergalerie, mehrsprachige Beschreibung, Adresse, GPS, Kontakt, Ausstattung, Lizenz)
- ENH: ODTA-konformer JSON-LD-Export pro POI (anzeigen, kopieren, herunterladen)
- ENH: Schale-4-Komponenten (KPI-Kontexttexte, Methodik-Kasten, Datenfrische-Indikator, verwandte Links)
- ENH: App-spezifisches Topic-Icon (Karten-Pin + Berge)
- DOC: KONZEPT.md mit ODTA-Mapping und Datenquellen-Doku ergänzt
- DOC: README und app-package.json app-spezifisch ausgefüllt

## ToDo

- Config über Nginx laden

## 19.05.2026

- ENH: ODAS-Proxy-Hilfsfunktionen in `app/app.js` ergänzt
- ENH: v1-konformes Instanz-Config-Feld `proxyAktiv` zum Aktivieren des ODAS-Proxys ergänzt
- FIX: `fusszeile.format.typ` auf v1-kompatibles `string` korrigiert
- DOC: Hinweis ergänzt, dass echte Proxy-Aufrufe nur im ODAS-Live-System funktionieren

## 21.02.2025

- ENH: app-package mit Multiline Strings
- ENH: Feldtypen von HTML auf Markdown umgestellt

## 17.02.2025

- FIX: Loadpage Funktion optimiert

## 12.2.2025 (Version 1.0.0)

- ENH: Anzeige config.json
- ENH: Config-File mit Multiline-String (als Array)
- FIX: Code-Teilung in app-base und app
- FIX: Docker korrigiert, läuft wieder
