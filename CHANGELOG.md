# Changelog

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
