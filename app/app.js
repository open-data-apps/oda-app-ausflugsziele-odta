/*
 * Ausflugsziele (ODTA – Tourist Attraction) – App-Logik
 *
 * Funktion: app(configdata, enclosingHtmlDivElement)
 *  - Laedt Places.json (schema.org-konform) der OpenData Ostschweiz Tourismus
 *  - Zeigt KPI-Kacheln, Filter + Suche, Listenansicht mit Paging,
 *    Leaflet-Karte mit POI-Markern, Detailansicht pro POI und
 *    ODTA-konformen JSON-LD-Export pro POI
 *  - Schale-4-Komponenten: KPI-Kontexttexte, Methodik-Kasten,
 *    Datenfrische-Indikator, verwandte Links (nur wenn konfiguriert)
 *
 * Datenstruktur (Place.json): Array von schema.org-Objekten mit
 *   @type, name{de,en,fr,it}, description{}, address{PostalAddress,
 *   telephone,url,email}, geo{GeoCoordinates}, image[ImageObject],
 *   license, dateModified, identifier (UUID), amenityFeature[],
 *   additionalProperty, openingHours/Specification, copyrightHolder
 */

// F-42: Monotoner Instanzzähler; der eigentliche Zustand liegt pro Instanz im
// von app() erzeugten state-Objekt (kein Modul-Global mehr).
let appInstanzZaehler = 0;

// F-51: Container -> state, damit onPageLeave die Laufzeitressourcen genau
// dieser Instanz freigeben kann (Muster wie oda-app-brunnenkarte).
const ausflugInstances = new Map();

/* Wird von app/app-base.js zu Beginn von loadPage() aufgerufen, bevor die
 * naechste Seite rendert. Gibt ausschliesslich eigene Ressourcen frei. */
function onPageLeave(page) {
  ausflugInstances.forEach((state, container) => {
    state.disposed = true;
    if (state.map) {
      try {
        state.map.remove();
      } catch (error) {
        console.warn("Fehler beim Entfernen der Leaflet-Karte:", error);
      }
      state.map = null;
    }
    state.markerLayer = null;
    ausflugInstances.delete(container);
  });
}

const LICENSE_URLS = {
  CC0: "https://creativecommons.org/publicdomain/zero/1.0/",
  "CC BY": "https://creativecommons.org/licenses/by/4.0/",
  "CC BY-SA": "https://creativecommons.org/licenses/by-sa/4.0/",
  "CC BY-NC": "https://creativecommons.org/licenses/by-nc/4.0/",
};

const ODAS_PUBLISHER = {
  "@type": "schema:Organization",
  "schema:name": "Ostschweiz Tourismus / CONTENTDESK",
  "schema:url": "https://opendata.ost.contentdesk.io",
};

const SOURCE_BASE = "https://opendata.ost.contentdesk.io/api/Place.json";

function app(configdata = {}, enclosingHtmlDivElement) {
  // F-42: pro Instanz geschlossener State (Closure in app())
  const state = {
    uid: "i" + ++appInstanzZaehler,
    root: enclosingHtmlDivElement,
    config: configdata,
    disposed: false, // wird von onPageLeave gesetzt (F-51)
    allPois: [],
    filteredPois: [],
    activeLang: pickLang(["de", "en", "fr", "it"], configdata.standardSprache),
    filters: {
      search: "",
      type: "",
      language: "",
      license: "",
    },
    map: null,
    markerLayer: null,
    page: 0,
    pageSize: 10,
    detailPoiId: null,
    availableTypes: [],
    availableLicenses: [],
    availableLanguages: [],
    latestDate: null,
  };

  // F-51: eine evtl. noch offene Vorgaengerinstanz desselben Containers
  // abraeumen, dann diese Instanz registrieren.
  const vorherigerState = ausflugInstances.get(enclosingHtmlDivElement);
  if (vorherigerState) {
    vorherigerState.disposed = true;
    if (vorherigerState.map) {
      try {
        vorherigerState.map.remove();
      } catch (error) {
        console.warn("Fehler beim Entfernen der Leaflet-Karte:", error);
      }
      vorherigerState.map = null;
    }
  }
  ausflugInstances.set(enclosingHtmlDivElement, state);

  state.root.innerHTML = renderShell();

  bindFilterControls(state);
  bindListControls(state);

  loadData(state)
    .then(() => {
      if (state.disposed) return; // F-70: Container evtl. waehrend loadData() entsorgt worden
      if (state.allPois.length === 0) return;
      computeAvailableFacets(state);
      renderFilterOptions(state);
      applyFilters(state);
      renderSchale4Blocks(state);
    })
    .catch((err) => {
      if (state.disposed) return; // F-70
      console.error("Daten konnten nicht geladen werden:", err);
    });
}

function pickLang(available, preferred) {
  if (preferred && available.includes(preferred)) return preferred;
  if (available.includes("de")) return "de";
  return available[0] || "de";
}

function renderShell() {
  return `
    <section id="oda-poi-app" class="oda-poi-app">
      <div id="oda-loading" class="oda-loading">
        <div class="oda-spinner"></div>
        <span>Daten werden geladen…</span>
      </div>

      <div id="oda-schale4-top" class="oda-schale4-top"></div>

      <div id="oda-kpi" class="oda-kpi-grid"></div>

      <div class="oda-toolbar mb-3">
        <div class="oda-search-wrap">
          <svg class="oda-search-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="search" id="oda-search" class="oda-search-input" placeholder="Ort, Name oder Beschreibung suchen…">
        </div>
        <select id="oda-filter-type" class="oda-filter-select"></select>
        <select id="oda-filter-language" class="oda-filter-select"></select>
        <select id="oda-filter-license" class="oda-filter-select"></select>
        <button type="button" id="oda-filter-reset" class="oda-reset-btn" title="Filter zurücksetzen">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
        <span id="oda-filter-count" class="oda-filter-count"></span>
      </div>

      <div class="oda-map-wrap">
        <div id="oda-map" class="oda-map"></div>
      </div>

      <div id="oda-list" class="oda-list-group"></div>
      <nav id="oda-pager" class="oda-pager"></nav>

      <div id="oda-schale4-bottom" class="oda-schale4-bottom"></div>
    </section>
  `;
}

async function loadData(state) {
  if (state.disposed) return; // F-70

  const apiUrl = getOdasApiUrl(state.config, "ausflugsziele");

  if (state.allPois.length > 0) {
    state.root.querySelector("#oda-loading").style.display = "none";
    return;
  }

  if (!apiUrl || /^\{\{.*\}\}$/.test(apiUrl) || /^<.*>$/.test(apiUrl)) {
    showInfo(state, "Es ist keine Datenquelle konfiguriert.");
    return;
  }

  let raw;
  try {
    raw = await fetchOdasResource(apiUrl, state.config);
  } catch (e) {
    showError(state, e.message || String(e));
    throw e;
  }
  if (state.disposed) return; // F-70: Container evtl. waehrend des Fetches entsorgt worden

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    showError(state, "Die Places-Daten konnten nicht als JSON gelesen werden.");
    throw e;
  }

  state.allPois = Array.isArray(parsed) ? parsed : [];
  state.root.querySelector("#oda-loading").style.display = "none";

  if (state.allPois.length === 0) {
    showInfo(state, "Keine Orte in der Datenquelle gefunden.");
    return;
  }

  state.latestDate = computeLatestDate(state.allPois);
}

function computeLatestDate(pois) {
  let latest = null;
  for (const p of pois) {
    const d = p && p.dateModified ? Date.parse(p.dateModified) : NaN;
    if (!isNaN(d)) {
      const ms = new Date(d);
      if (!latest || ms > latest) latest = ms;
    }
  }
  return latest;
}

function computeAvailableFacets(state) {
  const types = new Set();
  const licenses = new Set();
  const languages = new Set();
  for (const p of state.allPois) {
    if (p["@type"]) types.add(p["@type"]);
    if (p.license) licenses.add(p.license);
    for (const fld of ["name", "description", "disambiguatingDescription"]) {
      const v = p[fld];
      if (v && typeof v === "object") Object.keys(v).forEach((l) => languages.add(l));
    }
  }
  state.availableTypes = Array.from(types).sort();
  state.availableLicenses = Array.from(licenses).sort();
  state.availableLanguages = Array.from(languages).sort();
}

function renderFilterOptions(state) {
  const typeSel = state.root.querySelector("#oda-filter-type");
  const langSel = state.root.querySelector("#oda-filter-language");
  const licSel = state.root.querySelector("#oda-filter-license");

  typeSel.innerHTML =
    `<option value="">Alle</option>` +
    state.availableTypes.map((t) => `<option value="${escapeAttr(t)}">${escapeHtml(t)}</option>`).join("");

  langSel.innerHTML =
    `<option value="">Alle</option>` +
    state.availableLanguages.map((l) => `<option value="${escapeAttr(l)}">${escapeHtml(l)}</option>`).join("");

  licSel.innerHTML =
    `<option value="">Alle</option>` +
    state.availableLicenses.map((l) => `<option value="${escapeAttr(l)}">${escapeHtml(l)}</option>`).join("");
}

function bindFilterControls(state) {
  state.root.querySelector("#oda-search").addEventListener("input", (e) => {
    state.filters.search = e.target.value.trim().toLowerCase();
    state.page = 0;
    applyFilters(state);
  });
  state.root.querySelector("#oda-filter-type").addEventListener("change", (e) => {
    state.filters.type = e.target.value;
    state.page = 0;
    applyFilters(state);
  });
  state.root.querySelector("#oda-filter-language").addEventListener("change", (e) => {
    state.filters.language = e.target.value;
    state.page = 0;
    applyFilters(state);
  });
  state.root.querySelector("#oda-filter-license").addEventListener("change", (e) => {
    state.filters.license = e.target.value;
    state.page = 0;
    applyFilters(state);
  });
  state.root.querySelector("#oda-filter-reset").addEventListener("click", () => {
    state.filters = { search: "", type: "", language: "", license: "" };
    state.root.querySelector("#oda-search").value = "";
    state.root.querySelector("#oda-filter-type").value = "";
    state.root.querySelector("#oda-filter-language").value = "";
    state.root.querySelector("#oda-filter-license").value = "";
    state.page = 0;
    applyFilters(state);
  });
}

function bindListControls(state) {
  state.root.querySelector("#oda-pager").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-page]");
    if (!btn) return;
    state.page = Number(btn.getAttribute("data-page"));
    renderList(state);
  });
}

function applyFilters(state) {
  if (state.disposed) return; // F-70

  const f = state.filters;
  const q = f.search;
  state.filteredPois = state.allPois.filter((p) => {
    if (f.type && p["@type"] !== f.type) return false;
    if (f.license && p.license !== f.license) return false;
    if (f.language) {
      const langs = collectLangs(p);
      if (!langs.includes(f.language)) return false;
    }
    if (q) {
      const blob = [
        localizedText(p.name, state.activeLang),
        localizedText(p.disambiguatingDescription, state.activeLang),
        localizedText(p.description, state.activeLang),
        p.address ? p.address.addressLocality : "",
        p.address ? p.address.streetAddress : "",
        p["@type"] || "",
      ]
        .join(" ")
        .toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });

  renderKpis(state);
  renderList(state);
  renderMap(state);
  state.root.querySelector("#oda-filter-count").textContent = `${state.filteredPois.length} von ${state.allPois.length} Orten`;
}

function collectLangs(p) {
  const langs = new Set();
  for (const fld of ["name", "description", "disambiguatingDescription"]) {
    const v = p[fld];
    if (v && typeof v === "object") Object.keys(v).forEach((l) => langs.add(l));
  }
  return Array.from(langs);
}

function renderKpis(state) {
  if (state.disposed) return; // F-70

  const all = state.allPois;
  const filtered = state.filteredPois;
  const types = new Set(filtered.map((p) => p["@type"]).filter(Boolean));
  const licenses = new Set(filtered.map((p) => p.license).filter(Boolean));
  const langs = new Set();
  filtered.forEach((p) => collectLangs(p).forEach((l) => langs.add(l)));

  const cd = state.config || {};
  const tiles = [
    { id: 1, label: "Gesamte Orte", value: filtered.length, total: all.length, ctx: String(cd.kpiKontext1 || "").trim() },
    { id: 2, label: "Ortstypen", value: types.size, total: state.availableTypes.length, ctx: String(cd.kpiKontext2 || "").trim() },
    { id: 3, label: "Lizenzen", value: licenses.size, total: state.availableLicenses.length, ctx: String(cd.kpiKontext3 || "").trim() },
    { id: 4, label: "Sprachen", value: langs.size, total: state.availableLanguages.length, ctx: String(cd.kpiKontext4 || "").trim() },
  ];

  state.root.querySelector("#oda-kpi").innerHTML = tiles
    .map(
      (t) => `
      <div class="oda-kpi-card">
        <div class="oda-kpi-value">${t.value}${t.total ? ` <span class="oda-kpi-total">/ ${t.total}</span>` : ""}</div>
        <div class="oda-kpi-label">${escapeHtml(t.label)}</div>
        ${t.ctx ? `<div class="oda-kpi-context">${t.ctx}</div>` : ""}
      </div>`
    )
    .join("");
}

function renderList(state) {
  if (state.disposed) return; // F-70

  const list = state.root.querySelector("#oda-list");
  const pager = state.root.querySelector("#oda-pager");
  const pois = state.filteredPois;
  const start = state.page * state.pageSize;
  const slice = pois.slice(start, start + state.pageSize);

  if (pois.length === 0) {
    list.innerHTML = `<div class="oda-empty">Keine Orte gefunden für die aktuellen Filter.</div>`;
    pager.innerHTML = "";
    return;
  }

    list.innerHTML = `<div class="oda-list-group">` +
    slice
      .map((p) => {
        const name = localizedText(p.name, state.activeLang) || "(ohne Name)";
        const type = p["@type"] || "Place";
        const ort = p.address ? p.address.addressLocality : "";
        const img = safeHttpUrl(firstImage(p));
        const thumb = img
          ? `<img src="${escapeAttr(img)}" alt="" class="oda-list-thumb" loading="lazy">`
          : `<div class="oda-list-thumb oda-list-thumb-placeholder"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>`;
        return `
          <div class="oda-list-item-wrap" data-poi-id="${escapeAttr(p.identifier)}">
            <button type="button" class="oda-list-item" data-poi-id="${escapeAttr(p.identifier)}">
              ${thumb}
              <div class="oda-list-body">
                <div class="oda-list-title">${escapeHtml(name)}</div>
                <div class="oda-list-meta"><span class="oda-list-type">${escapeHtml(type)}</span>${ort ? `<span class="oda-list-ort"> · ${escapeHtml(ort)}</span>` : ""}</div>
              </div>
              <svg class="oda-list-chevron" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
            </button>
            <div class="oda-list-detail" hidden></div>
          </div>`;
      })
      .join("") +
    `</div>`;

  list.querySelectorAll(".oda-list-item").forEach((el) => {
    el.addEventListener("click", () => toggleDetail(state, el.getAttribute("data-poi-id")));
  });

  const totalPages = Math.max(1, Math.ceil(pois.length / state.pageSize));
  if (totalPages <= 1) {
    pager.innerHTML = `<span class="oda-pager-info">Seite ${state.page + 1} / ${totalPages}</span>`;
    return;
  }
  let pagerHtml = "";
  pagerHtml += `<button type="button" class="oda-pager-btn" data-page="${Math.max(0, state.page - 1)}" ${state.page === 0 ? "disabled" : ""}>‹</button>`;
  pagerHtml += `<span class="oda-pager-info">Seite ${state.page + 1} / ${totalPages}</span>`;
  pagerHtml += `<button type="button" class="oda-pager-btn" data-page="${Math.min(totalPages - 1, state.page + 1)}" ${state.page >= totalPages - 1 ? "disabled" : ""}>›</button>`;
  pager.innerHTML = pagerHtml;
}

function firstImage(p) {
  if (!p.image) return "";
  if (Array.isArray(p.image)) {
    const img = p.image.find((i) => i && (i.contentUrl || i.url)) || p.image[0];
    return img ? img.contentUrl || img.url || "" : "";
  }
  if (typeof p.image === "string") return p.image;
  if (p.image.contentUrl) return p.image.contentUrl;
  return "";
}

function localizedText(value, lang) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    if (value[lang]) return value[lang];
    const keys = Object.keys(value);
    if (keys.length) return value[keys[0]];
  }
  return "";
}

function renderMap(state) {
  if (state.disposed) return; // F-70

  loadLeaflet()
    .then(() => {
      if (state.disposed) return; // F-70: Container evtl. waehrend loadLeaflet() entsorgt worden
      const el = state.root.querySelector("#oda-map");
      if (!el) return;
      if (!state.map) {
        state.map = L.map(el, { scrollWheelZoom: true }).setView([47.37, 9.0], 8);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetmap-Mitwirkende",
          maxZoom: 18,
        }).addTo(state.map);
        state.markerLayer = L.layerGroup().addTo(state.map);
      }
      state.markerLayer.clearLayers();
      const pts = [];
      for (const p of state.filteredPois) {
        const g = p.geo;
        if (!g || g.latitude == null || g.longitude == null) continue;
        const lat = Number(g.latitude);
        const lon = Number(g.longitude);
        if (isNaN(lat) || isNaN(lon)) continue;
        pts.push([lat, lon]);
        const name = localizedText(p.name, state.activeLang) || "(ohne Name)";
        const marker = L.marker([lat, lon]).bindPopup(
          `<strong>${escapeHtml(name)}</strong><br><span class="small">${escapeHtml(p["@type"] || "Place")}</span>`
        );
        marker.on("click", () => scrollToPoi(state, p.identifier));
        state.markerLayer.addLayer(marker);
      }
      if (pts.length === 1) {
        state.map.setView(pts[0], 12);
      } else if (pts.length > 1) {
        state.map.fitBounds(L.latLngBounds(pts).pad(0.1));
      }
      setTimeout(() => {
        if (state.disposed || !state.map) return; // F-51
        state.map.invalidateSize();
      }, 100);
    })
    .catch((err) => {
      if (state.disposed) return; // F-70
      const el = state.root.querySelector("#oda-map");
      if (el)
        el.innerHTML = `<div class="alert alert-warning">Karte konnte nicht geladen werden: ${escapeHtml(err.message)}</div>`;
    });
}

// App-Container: pro Instanz im state-Objekt (state.root); der Library-Load
// bleibt ein Modul-Cache (unveränderlich, F-42)
let leafletLoading = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  if (leafletLoading) return leafletLoading;
  leafletLoading = new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "vendor/leaflet/leaflet.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "vendor/leaflet/leaflet.js";
    script.onload = () => {
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "vendor/leaflet/images/marker-icon-2x.png",
        iconUrl: "vendor/leaflet/images/marker-icon.png",
        shadowUrl: "vendor/leaflet/images/marker-shadow.png",
      });
      resolve();
    };
    script.onerror = () => reject(new Error("Leaflet konnte nicht geladen werden"));
    document.head.appendChild(script);
  });
  return leafletLoading;
}

function toggleDetail(state, poiId) {
  const wrap = state.root.querySelector(`.oda-list-item-wrap[data-poi-id="${cssEscape(poiId)}"]`);
  if (!wrap) return;
  const detail = wrap.querySelector(".oda-list-detail");
  const chevron = wrap.querySelector(".oda-list-chevron");
  const isOpen = !detail.hidden;
  if (isOpen) {
    detail.hidden = true;
    detail.innerHTML = "";
    wrap.classList.remove("oda-list-item-open");
    if (chevron) chevron.style.transform = "";
  } else {
    const p = state.allPois.find((x) => String(x.identifier) === String(poiId));
    if (!p) return;
    detail.innerHTML = detailHtml(state, p);
    detail.hidden = false;
    bindDetailControls(state, p);
    bindGallery(detail);
    wrap.classList.add("oda-list-item-open");
    if (chevron) chevron.style.transform = "rotate(90deg)";
  }
}

function scrollToPoi(state, poiId) {
  const wrap = state.root.querySelector(`.oda-list-item-wrap[data-poi-id="${cssEscape(poiId)}"]`);
  if (!wrap) return;
  wrap.scrollIntoView({ behavior: "smooth", block: "center" });
  const detail = wrap.querySelector(".oda-list-detail");
  if (detail && detail.hidden) {
    toggleDetail(state, poiId);
  }
  wrap.classList.add("oda-list-item-flash");
  setTimeout(() => wrap.classList.remove("oda-list-item-flash"), 1200);
}

function cssEscape(s) {
  if (window.CSS && CSS.escape) return CSS.escape(s);
  return String(s).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function detailHtml(state, p) {
  const name = localizedText(p.name, state.activeLang) || "(ohne Name)";
  const type = p["@type"] || "Place";
  const desc = localizedText(p.description, state.activeLang);
  const short = localizedText(p.disambiguatingDescription, state.activeLang);
  const addr = p.address || {};
  const geo = p.geo || {};
  const images = Array.isArray(p.image) ? p.image : p.image ? [p.image] : [];
  const license = p.license || "";
  const licenseUrl = LICENSE_URLS[license] || "";
  const copyright = p.copyrightHolder || "";
  const tel = addr.telephone || "";
  const url = addr.url || "";
  const u = safeHttpUrl(url);
  const email = addr.email || "";
  const amenity = Array.isArray(p.amenityFeature) ? p.amenityFeature : [];
  const modified = p.dateModified || "";

  const galleryHtml = images.length
    ? `<div class="oda-gallery">
        ${images
          .map((img, i) => {
            const imgUrl = safeHttpUrl(img.contentUrl || img.url || "");
            return imgUrl
              ? `<img src="${escapeAttr(imgUrl)}" alt="${escapeAttr(name)}" class="oda-gallery-img ${i === 0 ? "active" : ""}" loading="lazy">`
              : "";
          })
          .join("")}
       </div>
       ${images.length > 1 ? `<div class="oda-gallery-thumbs">
         ${images
           .map((img, i) => {
             const imgUrl = safeHttpUrl(img.contentUrl || img.url || "");
             return imgUrl
               ? `<img src="${escapeAttr(imgUrl)}" alt="" class="oda-gallery-thumb ${i === 0 ? "active" : ""}" data-idx="${i}" loading="lazy">`
               : "";
           })
           .join("")}
       </div>` : ""}`
    : "";

  const langBadges = collectLangs(p)
    .map((l) => `<span class="oda-lang-badge">${escapeHtml(l)}</span>`)
    .join(" ");

  const typeIcon = typeIconSvg(type);

  return `
    <div class="oda-detail-header">
      <div class="oda-detail-type-row">
        <span class="oda-detail-type-badge">${typeIcon}${escapeHtml(type)}</span>
        ${p.additionalType && p.additionalType !== type ? `<span class="oda-detail-type-badge oda-detail-type-sub">${escapeHtml(p.additionalType)}</span>` : ""}
        ${langBadges}
      </div>
      <h2 class="oda-detail-title">${escapeHtml(name)}</h2>
      ${short ? `<p class="oda-detail-short">${escapeHtml(short)}</p>` : ""}
    </div>

    ${galleryHtml}

    ${desc ? `<div class="oda-detail-desc">${escapeHtml(desc)}</div>` : ""}

    <div class="oda-detail-grid">
      <div class="oda-detail-section">
        <h3 class="oda-detail-section-title">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          Adresse
        </h3>
        <div class="oda-detail-info">
          ${addr.streetAddress ? `<div>${escapeHtml(addr.streetAddress)}</div>` : ""}
          ${(addr.postalCode || addr.addressLocality) ? `<div>${addr.postalCode ? escapeHtml(addr.postalCode) + " " : ""}${addr.addressLocality ? escapeHtml(addr.addressLocality) : ""}</div>` : ""}
          ${addr.addressCountry && addr.addressCountry.name ? `<div>${escapeHtml(addr.addressCountry.name.toUpperCase())}</div>` : ""}
        </div>
        ${tel ? `<div>${escapeHtml(tel)}</div>` : ""}
        ${email ? `<div>${escapeHtml(email)}</div>` : ""}
        ${u ? `<a href="${escapeAttr(u)}" target="_blank" rel="noopener" class="oda-contact-link">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          ${escapeHtml(u.replace(/^https?:\/\//, ""))}
        </a>` : url ? `<div>${escapeHtml(url)}</div>` : ""}
      </div>

      <div class="oda-detail-section">
        <h3 class="oda-detail-section-title">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v6m0 8v6M2 12h6m8 0h6"/><circle cx="12" cy="12" r="3"/></svg>
          Position
        </h3>
        <div class="oda-detail-info">
          ${geo.latitude != null ? `<div><span class="oda-info-label">Breite</span> <span class="oda-info-value">${escapeHtml(String(geo.latitude))}</span></div>` : ""}
          ${geo.longitude != null ? `<div><span class="oda-info-label">Länge</span> <span class="oda-info-value">${escapeHtml(String(geo.longitude))}</span></div>` : ""}
          ${geo.altitude != null ? `<div><span class="oda-info-label">Höhe</span> <span class="oda-info-value">${escapeHtml(String(geo.altitude))} m</span></div>` : ""}
        </div>
        ${geo.latitude != null && geo.longitude != null ? `<a href="https://www.openstreetmap.org/?mlat=${escapeAttr(String(geo.latitude))}&mlon=${escapeAttr(String(geo.longitude))}#map=14/${escapeAttr(String(geo.latitude))}/${escapeAttr(String(geo.longitude))}" target="_blank" rel="noopener" class="oda-contact-link">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/><path d="M3 12h12"/></svg>
          In OpenStreetMap öffnen
        </a>` : ""}
      </div>

      ${amenity.length ? `<div class="oda-detail-section">
        <h3 class="oda-detail-section-title">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/></svg>
          Ausstattung
        </h3>
        <div class="oda-amenity-list">
          ${amenity.map((a) => `<span class="oda-amenity-tag">${escapeHtml(a.name || "")}${a.value != null ? `: ${escapeHtml(String(a.value))}` : ""}</span>`).join("")}
        </div>
      </div>` : ""}

      <div class="oda-detail-section">
        <h3 class="oda-detail-section-title">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
          Daten &amp; Lizenz
        </h3>
        <div class="oda-detail-info">
          ${license ? `<div><span class="oda-info-label">Lizenz</span> ${licenseUrl ? `<a href="${escapeAttr(licenseUrl)}" target="_blank" rel="noopener" class="oda-info-value oda-link">${escapeHtml(license)}</a>` : `<span class="oda-info-value">${escapeHtml(license)}</span>`}</div>` : ""}
          ${copyright ? `<div><span class="oda-info-label">©</span> <span class="oda-info-value">${escapeHtml(copyright)}</span></div>` : ""}
          ${modified ? `<div><span class="oda-info-label">Stand</span> <span class="oda-info-value">${escapeHtml(modified.split("T")[0])}</span></div>` : ""}
        </div>
      </div>
    </div>

    <details class="oda-jsonld-accordion" id="oda-jsonld-accordion">
      <summary class="oda-jsonld-summary">
        <svg class="oda-jsonld-chevron" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
        <span class="oda-jsonld-label">ODTA-JSON-LD</span>
        <span class="oda-jsonld-hint">konformer Datenexport</span>
      </summary>
      <div class="oda-jsonld-body">
        <div class="oda-jsonld-actions">
          <button type="button" id="oda-jsonld-copy" class="oda-icon-btn" title="In Zwischenablage kopieren">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <span>Kopieren</span>
          </button>
          <button type="button" id="oda-jsonld-download" class="oda-icon-btn" title="Als .jsonld-Datei herunterladen">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            <span>Download</span>
          </button>
        </div>
        <pre class="oda-jsonld-pre"><code></code></pre>
      </div>
    </details>
  `;
}

function typeIconSvg(type) {
  const t = String(type || "").toLowerCase();
  if (t.includes("water") || t.includes("waterfall") || t.includes("lake") || t.includes("river"))
    return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`;
  if (t.includes("mountain"))
    return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>`;
  if (t.includes("landmark") || t.includes("historic") || t.includes("building"))
    return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 21 18 0M3 21l3-3M21 21l-3-3M5 18V8l7-5 7 5v10M9 18v-6h6v6"/></svg>`;
  if (t.includes("tour"))
    return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`;
  return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
}

function bindDetailControls(state, p) {
  const accordion = state.root.querySelector("#oda-jsonld-accordion");
  const codeEl = accordion ? accordion.querySelector("code") : null;
  if (accordion && codeEl) {
    accordion.addEventListener("toggle", () => {
      if (accordion.open && !codeEl.textContent) {
        codeEl.textContent = JSON.stringify(toOdtaJsonLd(p), null, 2);
      }
    });
  }

  const copy = state.root.querySelector("#oda-jsonld-copy");
  if (copy) {
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(toOdtaJsonLd(p), null, 2));
        const label = copy.querySelector("span");
        const orig = label ? label.textContent : "";
        if (label) label.textContent = "Kopiert!";
        copy.classList.add("oda-icon-btn-success");
        setTimeout(() => {
          if (label) label.textContent = orig;
          copy.classList.remove("oda-icon-btn-success");
        }, 1500);
      } catch (e) {
        const label = copy.querySelector("span");
        if (label) label.textContent = "Fehler";
      }
    });
  }
  const dl = state.root.querySelector("#oda-jsonld-download");
  if (dl) {
    dl.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(toOdtaJsonLd(p), null, 2)], { type: "application/ld+json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${(p.identifier || "poi").replace(/[^a-z0-9-]/gi, "_")}.jsonld`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }
}

function bindGallery(el) {
  const thumbs = el.querySelectorAll(".oda-gallery-thumb");
  const imgs = el.querySelectorAll(".oda-gallery-img");
  thumbs.forEach((t) => {
    t.addEventListener("click", () => {
      const idx = Number(t.getAttribute("data-idx"));
      imgs.forEach((im) => im.classList.remove("active"));
      thumbs.forEach((th) => th.classList.remove("active"));
      if (imgs[idx]) imgs[idx].classList.add("active");
      t.classList.add("active");
    });
  });
}

function toOdtaJsonLd(p) {
  const out = {
    "@context": { schema: "https://schema.org/", odta: "https://odta.io/voc/" },
    "@type": "schema:TouristAttraction",
  };
  if (p["@type"] && p["@type"] !== "Place") {
    out["schema:additionalType"] = "schema:" + p["@type"];
  }
  if (p.identifier) {
    out["@id"] = `${SOURCE_BASE}#${p.identifier}`;
  }
  if (p.name) out["schema:name"] = p.name;
  if (p.description) out["schema:description"] = p.description;
  if (p.disambiguatingDescription) out["schema:disambiguatingDescription"] = p.disambiguatingDescription;

  if (p.address) {
    const a = p.address;
    const addr = { "@type": "schema:PostalAddress" };
    if (a.streetAddress) addr["schema:streetAddress"] = a.streetAddress;
    if (a.postalCode) addr["schema:postalCode"] = a.postalCode;
    if (a.addressLocality) addr["schema:addressLocality"] = a.addressLocality;
    if (a.addressCountry) {
      const c = a.addressCountry;
      addr["schema:addressCountry"] =
        typeof c === "string" ? c : { "@type": "schema:Country", "schema:name": c.name || "" };
    }
    out["schema:address"] = addr;
    if (a.telephone) out["schema:telephone"] = a.telephone;
    if (a.url) out["schema:url"] = a.url;
    if (a.email) out["schema:email"] = a.email;
  }

  if (p.geo) {
    out["schema:geo"] = {
      "@type": "schema:GeoCoordinates",
      "schema:latitude": Number(p.geo.latitude),
      "schema:longitude": Number(p.geo.longitude),
    };
    if (p.geo.altitude != null) out["schema:geo"]["schema:elevation"] = p.geo.altitude;
  }

  const images = Array.isArray(p.image) ? p.image : p.image ? [p.image] : [];
  if (images.length) {
    out["schema:image"] = images.map((im) => ({
      "@type": "schema:ImageObject",
      "schema:contentUrl": im.contentUrl || im.url || "",
    }));
  }

  if (Array.isArray(p.amenityFeature) && p.amenityFeature.length) {
    out["schema:amenityFeature"] = p.amenityFeature;
  }
  if (p.additionalProperty) out["schema:additionalProperty"] = p.additionalProperty;
  if (p.openingHours) out["schema:openingHours"] = p.openingHours;
  if (p.openingHoursSpecification) out["schema:openingHoursSpecification"] = p.openingHoursSpecification;
  if (p.isAccessibleForFree != null) out["schema:isAccessibleForFree"] = p.isAccessibleForFree;
  if (p.priceRange) out["schema:priceRange"] = p.priceRange;

  if (p.identifier) {
    out["schema:identifier"] = {
      "@type": "schema:PropertyValue",
      "schema:name": "Ostschweiz OpenData UUID",
      "schema:value": p.identifier,
    };
    out["schema:sameAs"] = [`${SOURCE_BASE}#${p.identifier}`];
  }

  if (p.license) {
    out["sdLicense"] = LICENSE_URLS[p.license] || p.license;
  }
  out["sdPublisher"] = ODAS_PUBLISHER;
  if (p.dateModified) out["sdDatePublished"] = p.dateModified.split("T")[0];

  return out;
}

function renderSchale4Blocks(state) {
  if (state.disposed) return; // F-70

  const top = state.root.querySelector("#oda-schale4-top");
  const bottom = state.root.querySelector("#oda-schale4-bottom");

  const methodik = String(state.config.datenquelleHinweis || "").trim();
  const datenStandText = String(state.config.datenStand || "").trim();
  const links = String(state.config.weiterfuehrendeLinks || state.config.verwandteLinks || "").trim();
  const freshness = state.latestDate
    ? new Date(state.latestDate).toLocaleDateString("de-DE")
    : "";

  let topHtml = "";
  if (methodik) {
    topHtml += `<div class="oda-schale4-card"><h2>Methodik &amp; Datenquelle</h2><div>${methodik}</div></div>`;
  }
  if (freshness || datenStandText) {
    topHtml += `<div class="oda-freshness">Datenstand: ${freshness}${datenStandText ? " – " + escapeHtml(datenStandText) : ""}</div>`;
  }
  top.innerHTML = topHtml;

  let bottomHtml = "";
  if (links) {
    bottomHtml += `<div class="oda-schale4-card"><h2>Verwandte Links</h2><div>${links}</div></div>`;
  }
  bottom.innerHTML = bottomHtml;
}

function showError(state, msg) {
  const el = state.root.querySelector("#oda-loading");
  if (el) {
    el.style.display = "";
    el.innerHTML = `<div class="oda-error-box alert alert-danger" role="alert"><strong>Fehler beim Laden der Daten:</strong> ${escapeHtml(msg)}</div>`;
  }
}

function showInfo(state, msg) {
  const el = state.root.querySelector("#oda-loading");
  if (el) {
    el.style.display = "";
    el.innerHTML = `<div class="oda-info-box alert alert-info" role="alert">${escapeHtml(msg)}</div>`;
  }
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeHttpUrl(value) {
  const s = String(value || "").trim();
  return /^https?:\/\//i.test(s) ? s : "";
}

function escapeAttr(value = "") {
  return escapeHtml(value);
}

function isOdasProxyEnabled(configdata = {}) {
  return String(configdata.proxyAktiv || "").trim().toLowerCase() === "ja";
}

function extractPathFromUrl(url) {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.pathname + parsedUrl.search;
  } catch (_error) {
    return String(url || "");
  }
}

function getOdasAppBasePath(pathname) {
  let appPath =
    pathname === undefined
      ? typeof window !== "undefined"
        ? window.location.pathname
        : "/"
      : String(pathname || "/");

  if (!appPath.endsWith("/")) {
    const lastSlashIndex = appPath.lastIndexOf("/");
    const lastSegment = appPath.substring(lastSlashIndex + 1);
    if (lastSegment.includes(".")) {
      appPath = appPath.substring(0, lastSlashIndex + 1);
    }
  }

  return appPath.replace(/\/+$/, "");
}

function getOdasProxyEndpoint(targetUrl, pathname) {
  const appPath = getOdasAppBasePath(pathname);
  return `${appPath}/odp-data?path=${encodeURIComponent(targetUrl)}`;
}

async function fetchViaOdasProxy(targetUrl) {
  const response = await fetch(getOdasProxyEndpoint(targetUrl), {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`ODAS-Proxy-Fehler: HTTP ${response.status}`);
  }

  const proxyData = await response.json();
  if (!proxyData || typeof proxyData.content !== "string") {
    throw new Error("ODAS-Proxy-Antwort enthält keinen content-String.");
  }

  return proxyData.content;
}

async function fetchOdasResource(targetUrl, configdata = {}) {
  if (isOdasProxyEnabled(configdata)) {
    return fetchViaOdasProxy(targetUrl);
  }

  try {
    const response = await fetch(targetUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.text();
  } catch (error) {
    throw new Error(
      `Direkter Datenabruf fehlgeschlagen (${error.message}). Bitte prüfen Sie die Daten-URL und die CORS-Freigabe der Datenquelle.`,
    );
  }
}

/**
 * Löst eine benannte Datenressource aus configdata.apiurls auf.
 * Neue apiurls-Form (typ: "array"); das frühere skalare apiurl wird nicht mehr gelesen.
 * @returns {string} getrimmte URL, oder "" für den Zustand "keine Quelle konfiguriert"
 */
function getOdasApiUrl(configdata, name) {
  const liste = Array.isArray(configdata && configdata.apiurls) ? configdata.apiurls : [];
  const treffer = liste.find((eintrag) => eintrag && eintrag.name === name);
  return String((treffer && treffer.url) || "").trim();
}

async function fetchOdasJson(targetUrl, configdata = {}) {
  const rawContent = await fetchOdasResource(targetUrl, configdata);
  try {
    return JSON.parse(rawContent);
  } catch (_error) {
    throw new Error(
      `Die konfigurierte Daten-URL liefert kein JSON, sondern ${describeNonJsonPayload(rawContent)}. ` +
        "Bitte in der Instanzkonfiguration den API-Endpunkt der Datenquelle eintragen, " +
        "nicht den Datensatz- oder Download-Link.",
    );
  }
}

function describeNonJsonPayload(rawContent) {
  const text = String(rawContent == null ? "" : rawContent).trim();
  if (!text) return "eine leere Antwort";
  if (text.startsWith("<")) return "eine HTML-Seite";
  const firstLine = text.split(/\r?\n/, 1)[0];
  if (/[,;]/.test(firstLine)) return "eine CSV- oder Textdatei";
  return "unlesbaren Inhalt";
}

function addToHead() {}
