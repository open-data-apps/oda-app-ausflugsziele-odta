---

Die App **Ausflugsziele (ODTA – Tourist Attraction)** macht die touristischen Orte der Ostschweiz entdeckbar:
Sehenswürdigkeiten, historische Gebäude, Naturattraktionen wie der Rheinfall, Berge, Gewässer und Touren
werden auf einer interaktiven Karte, in einer filterbaren Liste und in einer Detailansicht präsentiert.
Jeder Ort lässt sich zusätzlich als ODTA-konformer JSON-LD-Datensatz anzeigen, kopieren oder herunterladen.

Die App ist für die Verwendung im [Open Data App Store](https://open-data-app-store.de/) gemacht
und entspricht der [Open Data App](https://open-data-apps.github.io/open-data-app-docs/open-data-app-spezifikation/).

Mehr zu Open Data Apps unter https://github.com/open-data-apps

---

## Funktionen
Die App ist eine Single Page Application (Webapp) mit:

- Logo-Anzeige
- Menü
- Seiten für Impressum, Datenschutz, Beschreibung, Kontakt, Hauptinhalt
- Inhaltsbereich
- Fußzeile

Die Konfiguration wird vom ODAS geladen. Die App zeigt folgende Inhalte:

- **KPI-Kacheln**: Gesamte Orte, Ortstypen, Lizenzen, Sprachen – mit konfigurierbaren Kontexttexten
- **Volltextsuche und Filter**: Suche nach Name, Beschreibung, Adresse; Filter nach Typ, Sprache und Lizenz
- **Listenansicht**: Clientseitiges Paging, Inline-Detailansicht pro Ort
- **Interaktive Karte**: Leaflet.js mit OpenStreetMap-Kacheln, POI-Markern und Klick-Navigation zur Detailansicht
- **Detailansicht**: Bildergalerie, mehrsprachige Beschreibung, Adresse, GPS, Kontakt, Ausstattungsmerkmale und Lizenzinformationen
- **ODTA-konformer JSON-LD-Export**: Anzeigen, Kopieren und Herunterladen pro POI
- **Schale-4-Komponenten**: Methodik-Kasten, Datenfrische-Indikator und verwandte Links – optional konfigurierbar

---

## Für wen ist diese App?
Diese App richtet sich an Gäste und Einheimische, die touristische Orte der Ostschweiz erkunden möchten,
sowie an Kommunen und Tourismusverantwortliche, die ODTA-konforme Daten visualisieren wollen.
Es sind keine besonderen Datenkenntnisse nötig – die Bedienung erfolgt über Karte, Liste und Filter.

---

## Datenformat
Die App lädt schema.org-konformes JSON direkt im Browser:

- **Place.json**: Array von schema.org-Objekten mit `@type`, mehrsprachigem `name`/`description`, `address` (PostalAddress), `geo` (GeoCoordinates), `image` (ImageObject-Array), `license`, `dateModified`, `identifier` (UUID), `amenityFeature`, `openingHours` und weiteren Feldern
- Die Quelle erlaubt CORS (`Access-Control-Allow-Origin: *`) – ein direkter `fetch` im Browser ist möglich
- Kein API-Key erforderlich

---

## Kompatible Datensätze
Die App ist kompatibel mit CONTENTDESK-basierten OpenData-Portalen, die schema.org-konforme Places-Daten bereitstellen:

| Datensatz | Quelle | Lizenz |
| --- | --- | --- |
| Places (POIs / Tourist Attractions) | OpenData Portal Ostschweiz Tourismus | CC0 / CC BY / CC BY-SA |
| OpenStreetMap-Kacheln | OpenStreetMap contributors | ODbL |

Die Datenendpunkt-URL kann in der Instanz-Konfiguration auf andere CONTENTDESK-basierte Portale umgestellt werden.

---

### Systemvoraussetzungen
- Docker / Docker Compose
- Make

Die Entwicklung wurde getestet unter Windows und Ubuntu.

### Starten
```bash
make build up
```

Die App wird gestartet und steht auf Port 8089 zur Verfügung: http://localhost:8089

Weil die App mit localhost gestartet wird, wird die Konfiguration lokal geladen.

### Lokale Entwicklung mit VS Code Live Server

Alternativ kann die App mit VS Code Live Server aus der Projektwurzel gestartet werden. Öffne dann `http://127.0.0.1:<live-server-port>/app/`; Live Server nutzt standardmäßig Port `5500`.

Empfohlene ODAS-Einstellungen:

```json
{
  "liveServer.settings.host": "127.0.0.1",
  "liveServer.settings.root": "/",
  "liveServer.settings.file": "app/index.html"
}
```

`liveServer.settings.file` ist optional. `liveServer.settings.root` sollte für ODAS-Apps normalerweise `/` bleiben, damit `app/` und `odas-config/` gleichzeitig erreichbar sind. Falls `app/app-base.js` für lokale Tests den auskommentierten `getConfigUrl()`-Localhost-Block nutzt, muss dieser vor ZIP-Erstellung und ODAS-Live-Auslieferung wieder auskommentiert werden.

### Aufbau der App
Der Inhaltsbereich wird in `app/app.js` erstellt. Dort sind Datenladen, CORS-Proxy-Fallback, Filter, Paginierung, Leaflet-Karte, Detailansicht, JSON-LD-Export und Schale-4-Komponenten implementiert. Template-eigene Dateien (`app/app-base.js`, `app/app-base.css`, `app/index.html`) werden nicht verändert. Leaflet wird dynamisch nachgeladen.

#### Screenshots

**Startseite mit Karte und Filterleiste**

![Screenshot 1](assets/Desktop_Screenshot_1.png)

**Detailansicht eines POI**

![Screenshot 2](assets/Desktop_Screenshot_2.png)

**JSON-LD-Export und Schale-4-Bereich**

![Screenshot 3](assets/Desktop_Screenshot_3.png)

### Wichtige Dateien
| Datei | Beschreibung |
| --- | --- |
| `app/app.js` | Hauptlogik: Datenladen, Filter, Karte, Detailansicht, JSON-LD-Export, Schale 4 |
| `app-package.json` | App-Metadaten und Instanz-Konfigurationsfelder für den ODAS |
| `assets/schema.json` | Frictionless Data Schema – allgemeingültiges Datenmodell |
| `assets/odas-app-icon.svg` | ODAS-konformes App-Icon |
| `odas-config/config.json` | Lokale Konfiguration für die Entwicklung |

---

## Konfiguration (Instanz)
Folgende Parameter werden bei der App-Instanzierung im ODAS konfiguriert:

| Parameter | Beschreibung | Pflicht |
| --- | --- | --- |
| `apiurl` | URL zu den Places-Daten (schema.org-konformes JSON) | ja |
| `urlDaten` | URL zur Katalog-Seite des Datensatzes im ODP | ja |
| `standardSprache` | Anzeigesprache für mehrsprachige Felder (de/en/fr/it) | ja |
| `proxyAktiv` | ODAS-Proxy aktivieren (`ja`/`nein`). Die Ostschweiz-Quelle erlaubt CORS – Standard ist `nein`. | ja |
| `sprache` | Sprache der App (`de`) | ja |
| `lizenz` | Lizenz der App | ja |
| `titel` | Anzeigetitel der App | ja |
| `seitentitel` | Browser-Tab-Titel | ja |
| `kpiKontext1` | KPI-Kontexttext: Gesamte Orte | nein |
| `kpiKontext2` | KPI-Kontexttext: Ortstypen | nein |
| `kpiKontext3` | KPI-Kontexttext: Lizenzen | nein |
| `kpiKontext4` | KPI-Kontexttext: Sprachen | nein |
| `datenquelleHinweis` | Methodik-Kasten (Markdown) | nein |
| `datenStand` | Zusätzlicher Text zum Datenstand | nein |
| `verwandteLinks` | Verwandte Links (Markdown) | nein |

---

## ODAS-Proxy
Die Ostschweiz-Quelle erlaubt CORS und kann direkt per `fetch` geladen werden:

- `proxyAktiv: "nein"` (Standard) lädt Ressourcen direkt.
- `proxyAktiv: "ja"` lädt Ressourcen über den ODAS-Proxy-Endpunkt `odp-data`.

Echte Proxy-Aufrufe funktionieren nur im ODAS-Live-System. Lokal kann nur geprüft werden,
ob die Konfiguration geladen und der Proxy-Status korrekt angezeigt wird sowie der
Direct-Modus funktioniert.

---

## Autor
© 2026, Ondics GmbH
