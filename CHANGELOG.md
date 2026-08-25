# Changelog

## 1.29.0 - 2026-08-25
- **CHG:** `proxyAktiv`-Schalter wiedereingeführt (Default `nein`). Der ODAS-Proxy erlaubt seit Plattform-Update 2026-08-24 Datenabrufe für jede in den `apiurls` konfigurierte Quelle-Origin.


## 1.28.0 - 2026-08-25
- **CHG:** Proxy-Aufruf sendet die vollständige Ziel-URL statt nur Pfad+Query, damit die neue Origin-Allowlist-Prüfung der ODAS-Plattform greift (bisher implizite Auflösung gegen den ersten konfigurierten `apiurl`).
- **FIX:** Tote Anbieter-Shortcodes in Kontakt/Impressum ersetzt (`{{odp.anbieter.url-extern}}` → `{{odp.anbieter.url}}`, `tel:{{odp.anbieter.telcode}}` → `tel:{{odp.anbieter.tel}}`).


## 1.27.0 - 2026-08-22
- **CHG:** `version` in `app-package.json` zu `app-version` umbenannt.
- **ENH:** Top-Level-Feld `app-package-version` ergänzt (Wert `"2"`: mehrere benannte API-URLs über `instanz-config.apiurls`).

## 1.26.0 - 2026-08-21
- **CHG:** Skalares `apiurl` durch das Array-Feld `apiurls` ersetzt (`typ: "array"`, Eintrag `ausflugsziele`). Neuer Standard portfolioweit; `apiurl` entfällt. `app.js` liest die Datenquelle jetzt über `getOdasApiUrl(configdata, "ausflugsziele")`.

## 1.25.0 - 2026-08-20
- DOC: Pflicht-Link zum [Open Data App Store](https://open-data-app-store.de/) in der Referenzbeschreibung (Abschnitt „Open Data App“) ergänzt; lokale `odas-config/config.json` semantisch als HTML-Anker gespiegelt.

## 1.24.0 - 2026-08-20
- **NEU:** Abschnitt „ODTA-Daten" in der Beschreibung (`beschreibung`, Store & App-Seite) — erklärt, was ODTA ist (Open Data Tourism Alliance, DACH-Initiative der nationalen Tourismusorganisationen, Domain Specifications auf schema.org-Basis) und welche ODTA-/schema.org-Felder die App auswertet und als JSON-LD exportiert
- **NEU:** Abschnitt „Andere ODTA-Datensätze verwenden" nach „Datenquelle" — beschreibt die Voraussetzungen an eine kompatible Quelle (JSON-Array, schema.org-/ODTA-Stil, `geo`, CORS) und listet live geprüfte Beispiel-Endpunkte desselben Portals (`LodgingBusiness.json`, `LocalBusiness.json`, `FoodEstablishment.json`, `category.json`) sowie den Hinweis auf andere CONTENTDESK-/discover.swiss-basierte Portale
- **CHG:** Zweiter Absatz der Einleitung benennt jetzt explizit den ODTA-Standard statt „strukturierte Open-Data-Informationen"
- **CHG:** `apiurl`-Hilfetext im ODAS-Editor um dieselben Anforderungen und Beispiel-Endpunkte ergänzt
- FIX: Top-Level-`beschreibung` (Store) und `instanz-config.beschreibung` (App-Seite „Über diese App") waren durch eine manuelle Zwischenänderung auseinandergelaufen („Open Data App" vs. „Open Data App Store", doppeltes „den den"); beide Ebenen sind jetzt wieder inhaltlich identisch

## 1.23.0 - 2026-08-20
- **CHG:** Rich-Text-Felder (`beschreibung` [Store & App-Seite], `kontakt`, `impressum`, `datenschutz`, `datenquelleHinweis`, `verwandteLinks`, `weiterfuehrendeLinks`) von HTML-Passthrough auf echtes Markdown umgestellt, gemäß `open-data-app-spezifikation.md`: ODAS wandelt `format.typ: "markdown"`-Felder vor der Auslieferung selbst in HTML um. Die lokale `odas-config/config.json` bleibt bewusst HTML — sie simuliert das Ergebnis der ODAS-Konvertierung für den Live-Server-Test.
- **NEU:** Abschnitt „Methodik" in der App-Beschreibung (`beschreibung`), zwischen „Für wen ist diese App?" und „Datenquelle" — erläutert Datenherkunft, Normalisierung und Limitierungen ausführlicher als der Startseiten-Kasten (`datenquelleHinweis`, bleibt unverändert bestehen)
- **NEU:** Abschnitt „Open Data App Store" verlinkt jetzt zusätzlich den Quellcode: die GitHub-Organisation `open-data-apps` und das App-eigene Repository `oda-app-ausflugsziele-odta`
- FIX: CSS-Selektor für „Verwandte Links" (`app/app.css`) greift jetzt über `.oda-schale4-card ul`, da der ODAS-Markdown-Konverter kein `class="oda-link-list"` mehr mitliefert

## 1.22.0 - 2026-08-20
- FIX: Drei-Datenzustände-Kontrakt umgesetzt — fehlende `apiurl` und 0 gefundene Orte rufen jetzt `showInfo()` (`alert-info`) statt eine Exception zu werfen; Ladefehler rufen weiterhin `showError()` (`alert-danger`) auf (F-69)

## 1.21.0 - 2026-08-20
- FIX: `state.disposed` wird jetzt in `loadData()`, `applyFilters()`, `renderKpis()`, `renderList()`, `renderMap()` und `renderSchale4Blocks()` geprüft, nicht mehr nur in einem einzelnen `setTimeout`-Callback (F-70)

## 1.20.0 - 2026-08-18
- `proxyAktiv`-Schalter entfernt (`app-package.json`, `odas-config/config.json`): Der ODAS-Proxy wird umgebaut und funktioniert nach der aktuellen Host-Regel nicht mit `opendata.ost.contentdesk.io` (kein passendes ODP-Portal); das Feld wird bis zum Abschluss des Umbaus bewusst nicht angeboten. Die App lief bereits im Direktmodus (`proxyAktiv: "nein"`), das Verhalten ändert sich nicht.

## 1.19.0 - 2026-08-17
- `urlDaten` zeigte identisch auf den JSON-API-Endpunkt von `apiurl` (`opendata.ost.contentdesk.io/api/Place.json`); jetzt auf die echte Portal-Dokumentationsseite `https://opendata.ost.contentdesk.io/` verweisend (live verifiziert, HTTP 200) (F-68)

## 1.18.0 - 2026-08-17
- `fetchOdasJson()` wirft jetzt bei nicht-JSON-Antworten (CSV, HTML, leerer Body) eine sprechende Konfigurationsfehlermeldung statt der rohen `JSON.parse`-Parserfehlermeldung (F-66)

## 1.17.0 - 2026-08-17
- **CHG:** `instanz-config`-`category`-Vokabular auf Deutsch umgestellt (`allgemein`, `beschreibung`, `datenherkunft`, `kontakt-rechtliches`, `sonstiges`); die entfallenen Kategorien `metrics` und `advanced` wurden auf `beschreibung` bzw. `sonstiges` verteilt

## 1.16.0 - 2026-08-12
- FIX: `app/index.html` auf den Template-Stand (F-47): Datei byte-gleich aus `oda-generic` übernommen — gültiges HTML, deutsche ARIA-Labels, Footer im Body; Titel und Fußzeile bleiben Platzhalter und werden zur Laufzeit aus der Instanz-Config überschrieben

## 1.15.0 - 2026-08-12
- FIX: Laufzeitressourcen einer Leaflet-Instanz werden beim Seitenwechsel freigegeben (F-51): neuer Modul-Hook `onPageLeave` raeumt ueber die Registry `ausflugInstances` (Container -> state) alle offenen Karten der jeweiligen Instanz ab; Wiedereintritt in denselben Container entfernt eine evtl. noch offene Vorgaengerinstanz; der 100-ms-`invalidateSize`-Timer laeuft nicht mehr auf einer abgeraumten Karte (Guard auf `state.disposed`/`state.map`)

## 1.14.0 - 2026-08-11
- FIX: Listen-Thumbnails auf HTTP und HTTPS beschraenkt (F-35-Konsistenz zur Galerie): renderList validiert die Thumbnail-URL jetzt ueber `safeHttpUrl(firstImage(p))`; ungueltige Schemata wie `javascript:`, `data:` oder `vbscript:` werden nicht mehr als `<img src>` gerendert, sondern fallen auf den vorhandenen Platzhalter `.oda-list-thumb-placeholder` zurueck

## 1.13.0 - 2026-08-11
- FIX: Laufzeitzustand pro App-Instanz isoliert (F-42): Modul-Konstante `APP_STATE` und Modul-`odaRoot` durch ein pro `app()`-Aufruf geschlossenes `state`-Objekt (uid, root, config, Daten, Filter, Karte) ersetzt; `window.__odaConfigdata` entfernt (Config läuft über `state.config`); Cache-Short-Circuit und KPI-Kontexttexte instanzlokal; `leafletLoading` bleibt als unveränderlicher Modul-Cache für den Library-Load

## 1.12.0 - 2026-08-11
- FIX: XSS- und URL-Vertrag geschlossen (F-35): neuer Top-Level-Helfer `safeHttpUrl`; Beschreibungstexte, Adress-URLs und Bild-URLs in der Detailansicht nur noch über Escaping bzw. http(s)-Schema-Validierung ins HTML; `tel:`- und `mailto:`-Links aus externen Daten entfallen ersatzlos

## 1.11.0 - 2026-08-06
- CHG: DOM-Zugriffe auf den App-Container gescopt (F-25, Tranche 3): alle Elemente der App werden über den App-Container (Modul-Variable `odaRoot`, `odaRoot.querySelector`) angesprochen statt über document; alle IDs waren bereits mit `oda-` präfixiert, es waren keine Renames nötig; der Klassen-Selektor `.oda-list-item-wrap[data-poi-id=…]` wird über den App-Container gescopt (kein Rename)

## 1.10.0 - 2026-08-06
- FIX: Datenschutzangabe beschreibt den tatsaechlichen Stand nach dem Vendoring (Welle G)

## 1.9.0 - 2026-08-06
- FIX: Drittanbietersektion nennt keine Beim-Aufruf-Behauptung mehr (Welle G)

## 1.8.0 - 2026-08-06
- FIX: Base auf Template oda-generic 1.6.0 vereinheitlicht (Hook renderPageOverride)

## 1.7.0 - 2026-08-04
- FIX: Datenschutzhinweis "Beim Aufruf kontaktierte Drittanbieter" an das Vendoring angepasst — jetzt lokal ausgelieferte Bibliotheken (Bootstrap/Leaflet/Chart.js) sind aus der Liste entfernt, weiterhin extern geladene Dienste (Kartenkacheln, Zusatzbibliotheken) bleiben genannt

## 1.6.0 - 2026-08-04
- FIX: Bootstrap, Leaflet vendored in `app/vendor/` statt von CDN geladen (F-07 Teil 2) — Standalone-Betrieb laedt diese Bibliotheken nicht mehr extern

## 1.5.0 - 2026-08-04
- FIX: Drittanbieter (CDN, Kartendienste) in `datenschutz`-Default und README dokumentiert (F-07 Teil 1)
- FIX: Bootstrap CSS/JS auf einheitlich 5.3.8 gezogen (vorher gemischt 5.3.0/5.3.1 bzw. 5.3.0/5.3.0) (F-31)

## 1.4.0 - 2026-07-31
- CHG: toter Konfigurationsschlüssel lizenz entfernt (F-17)
- CHG: brandingCSS und brandingCSSFile als Base-Abhängigkeiten deklariert und lokal gespiegelt (F-17)
- CHG: dropdown-Default auf Feldebene verschoben statt in format (F-18)

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
