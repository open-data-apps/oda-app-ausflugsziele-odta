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

const APP_STATE = {
  allPois: [],
  filteredPois: [],
  activeLang: "de",
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
  if (APP_STATE.map) {
    try { APP_STATE.map.remove(); } catch (e) {}
    APP_STATE.map = null;
    APP_STATE.markerLayer = null;
  }
  APP_STATE.page = 0;

  window.__odaConfigdata = configdata;
  APP_STATE.activeLang = pickLang(["de", "en", "fr", "it"], configdata.standardSprache);

  enclosingHtmlDivElement.innerHTML = renderShell();

  bindFilterControls();
  bindListControls();

  loadData(configdata)
    .then(() => {
      computeAvailableFacets();
      renderFilterOptions();
      applyFilters();
      renderSchale4Blocks(configdata);
    })
    .catch((err) => {
      console.error("Daten konnten nicht geladen werden:", err);
      showError("Daten konnten nicht geladen werden: " + (err && err.message ? err.message : err));
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

async function loadData(configdata) {
  const apiUrl = String(configdata.apiurl || "").trim();

  if (APP_STATE.allPois.length > 0) {
    document.getElementById("oda-loading").style.display = "none";
    return;
  }

  if (!apiUrl) {
    showError("Keine API-URL konfiguriert (instanz-config 'apiurl').");
    throw new Error("missing apiurl");
  }

  const raw = await fetchOdasResource(apiUrl, configdata);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    showError("Die Places-Daten konnten nicht als JSON gelesen werden.");
    throw e;
  }

  APP_STATE.allPois = Array.isArray(parsed) ? parsed : [];
  document.getElementById("oda-loading").style.display = "none";

  if (APP_STATE.allPois.length === 0) {
    showError("Es wurden keine Orte in den Daten gefunden.");
    return;
  }

  APP_STATE.latestDate = computeLatestDate(APP_STATE.allPois);
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

function computeAvailableFacets() {
  const types = new Set();
  const licenses = new Set();
  const languages = new Set();
  for (const p of APP_STATE.allPois) {
    if (p["@type"]) types.add(p["@type"]);
    if (p.license) licenses.add(p.license);
    for (const fld of ["name", "description", "disambiguatingDescription"]) {
      const v = p[fld];
      if (v && typeof v === "object") Object.keys(v).forEach((l) => languages.add(l));
    }
  }
  APP_STATE.availableTypes = Array.from(types).sort();
  APP_STATE.availableLicenses = Array.from(licenses).sort();
  APP_STATE.availableLanguages = Array.from(languages).sort();
}

function renderFilterOptions() {
  const typeSel = document.getElementById("oda-filter-type");
  const langSel = document.getElementById("oda-filter-language");
  const licSel = document.getElementById("oda-filter-license");

  typeSel.innerHTML =
    `<option value="">Alle</option>` +
    APP_STATE.availableTypes.map((t) => `<option value="${escapeAttr(t)}">${escapeHtml(t)}</option>`).join("");

  langSel.innerHTML =
    `<option value="">Alle</option>` +
    APP_STATE.availableLanguages.map((l) => `<option value="${escapeAttr(l)}">${escapeHtml(l)}</option>`).join("");

  licSel.innerHTML =
    `<option value="">Alle</option>` +
    APP_STATE.availableLicenses.map((l) => `<option value="${escapeAttr(l)}">${escapeHtml(l)}</option>`).join("");
}

function bindFilterControls() {
  document.getElementById("oda-search").addEventListener("input", (e) => {
    APP_STATE.filters.search = e.target.value.trim().toLowerCase();
    APP_STATE.page = 0;
    applyFilters();
  });
  document.getElementById("oda-filter-type").addEventListener("change", (e) => {
    APP_STATE.filters.type = e.target.value;
    APP_STATE.page = 0;
    applyFilters();
  });
  document.getElementById("oda-filter-language").addEventListener("change", (e) => {
    APP_STATE.filters.language = e.target.value;
    APP_STATE.page = 0;
    applyFilters();
  });
  document.getElementById("oda-filter-license").addEventListener("change", (e) => {
    APP_STATE.filters.license = e.target.value;
    APP_STATE.page = 0;
    applyFilters();
  });
  document.getElementById("oda-filter-reset").addEventListener("click", () => {
    APP_STATE.filters = { search: "", type: "", language: "", license: "" };
    document.getElementById("oda-search").value = "";
    document.getElementById("oda-filter-type").value = "";
    document.getElementById("oda-filter-language").value = "";
    document.getElementById("oda-filter-license").value = "";
    APP_STATE.page = 0;
    applyFilters();
  });
}

function bindListControls() {
  document.getElementById("oda-pager").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-page]");
    if (!btn) return;
    APP_STATE.page = Number(btn.getAttribute("data-page"));
    renderList();
  });
}

function applyFilters() {
  const f = APP_STATE.filters;
  const q = f.search;
  APP_STATE.filteredPois = APP_STATE.allPois.filter((p) => {
    if (f.type && p["@type"] !== f.type) return false;
    if (f.license && p.license !== f.license) return false;
    if (f.language) {
      const langs = collectLangs(p);
      if (!langs.includes(f.language)) return false;
    }
    if (q) {
      const blob = [
        localizedText(p.name, APP_STATE.activeLang),
        localizedText(p.disambiguatingDescription, APP_STATE.activeLang),
        localizedText(p.description, APP_STATE.activeLang),
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

  renderKpis();
  renderList();
  renderMap();
  document.getElementById("oda-filter-count").textContent = `${APP_STATE.filteredPois.length} von ${APP_STATE.allPois.length} Orten`;
}

function collectLangs(p) {
  const langs = new Set();
  for (const fld of ["name", "description", "disambiguatingDescription"]) {
    const v = p[fld];
    if (v && typeof v === "object") Object.keys(v).forEach((l) => langs.add(l));
  }
  return Array.from(langs);
}

function renderKpis() {
  const all = APP_STATE.allPois;
  const filtered = APP_STATE.filteredPois;
  const types = new Set(filtered.map((p) => p["@type"]).filter(Boolean));
  const licenses = new Set(filtered.map((p) => p.license).filter(Boolean));
  const langs = new Set();
  filtered.forEach((p) => collectLangs(p).forEach((l) => langs.add(l)));

  const cd = window.__odaConfigdata || {};
  const tiles = [
    { id: 1, label: "Gesamte Orte", value: filtered.length, total: all.length, ctx: String(cd.kpiKontext1 || "").trim() },
    { id: 2, label: "Ortstypen", value: types.size, total: APP_STATE.availableTypes.length, ctx: String(cd.kpiKontext2 || "").trim() },
    { id: 3, label: "Lizenzen", value: licenses.size, total: APP_STATE.availableLicenses.length, ctx: String(cd.kpiKontext3 || "").trim() },
    { id: 4, label: "Sprachen", value: langs.size, total: APP_STATE.availableLanguages.length, ctx: String(cd.kpiKontext4 || "").trim() },
  ];

  document.getElementById("oda-kpi").innerHTML = tiles
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

function renderList() {
  const list = document.getElementById("oda-list");
  const pager = document.getElementById("oda-pager");
  const pois = APP_STATE.filteredPois;
  const start = APP_STATE.page * APP_STATE.pageSize;
  const slice = pois.slice(start, start + APP_STATE.pageSize);

  if (pois.length === 0) {
    list.innerHTML = `<div class="oda-empty">Keine Orte gefunden für die aktuellen Filter.</div>`;
    pager.innerHTML = "";
    return;
  }

    list.innerHTML = `<div class="oda-list-group">` +
    slice
      .map((p) => {
        const name = localizedText(p.name, APP_STATE.activeLang) || "(ohne Name)";
        const type = p["@type"] || "Place";
        const ort = p.address ? p.address.addressLocality : "";
        const img = firstImage(p);
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
    el.addEventListener("click", () => toggleDetail(el.getAttribute("data-poi-id")));
  });

  const totalPages = Math.max(1, Math.ceil(pois.length / APP_STATE.pageSize));
  if (totalPages <= 1) {
    pager.innerHTML = `<span class="oda-pager-info">Seite ${APP_STATE.page + 1} / ${totalPages}</span>`;
    return;
  }
  let pagerHtml = "";
  pagerHtml += `<button type="button" class="oda-pager-btn" data-page="${Math.max(0, APP_STATE.page - 1)}" ${APP_STATE.page === 0 ? "disabled" : ""}>‹</button>`;
  pagerHtml += `<span class="oda-pager-info">Seite ${APP_STATE.page + 1} / ${totalPages}</span>`;
  pagerHtml += `<button type="button" class="oda-pager-btn" data-page="${Math.min(totalPages - 1, APP_STATE.page + 1)}" ${APP_STATE.page >= totalPages - 1 ? "disabled" : ""}>›</button>`;
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

function renderMap() {
  loadLeaflet()
    .then(() => {
      const el = document.getElementById("oda-map");
      if (!el) return;
      if (!APP_STATE.map) {
        APP_STATE.map = L.map(el, { scrollWheelZoom: true }).setView([47.37, 9.0], 8);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetmap-Mitwirkende",
          maxZoom: 18,
        }).addTo(APP_STATE.map);
        APP_STATE.markerLayer = L.layerGroup().addTo(APP_STATE.map);
      }
      APP_STATE.markerLayer.clearLayers();
      const pts = [];
      for (const p of APP_STATE.filteredPois) {
        const g = p.geo;
        if (!g || g.latitude == null || g.longitude == null) continue;
        const lat = Number(g.latitude);
        const lon = Number(g.longitude);
        if (isNaN(lat) || isNaN(lon)) continue;
        pts.push([lat, lon]);
        const name = localizedText(p.name, APP_STATE.activeLang) || "(ohne Name)";
        const marker = L.marker([lat, lon]).bindPopup(
          `<strong>${escapeHtml(name)}</strong><br><span class="small">${escapeHtml(p["@type"] || "Place")}</span>`
        );
        marker.on("click", () => scrollToPoi(p.identifier));
        APP_STATE.markerLayer.addLayer(marker);
      }
      if (pts.length === 1) {
        APP_STATE.map.setView(pts[0], 12);
      } else if (pts.length > 1) {
        APP_STATE.map.fitBounds(L.latLngBounds(pts).pad(0.1));
      }
      setTimeout(() => APP_STATE.map.invalidateSize(), 100);
    })
    .catch((err) => {
      const el = document.getElementById("oda-map");
      if (el)
        el.innerHTML = `<div class="alert alert-warning">Karte konnte nicht geladen werden: ${escapeHtml(err.message)}</div>`;
    });
}

let leafletLoading = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  if (leafletLoading) return leafletLoading;
  leafletLoading = new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => {
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
      resolve();
    };
    script.onerror = () => reject(new Error("Leaflet konnte nicht geladen werden"));
    document.head.appendChild(script);
  });
  return leafletLoading;
}

function toggleDetail(poiId) {
  const wrap = document.querySelector(`.oda-list-item-wrap[data-poi-id="${cssEscape(poiId)}"]`);
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
    const p = APP_STATE.allPois.find((x) => String(x.identifier) === String(poiId));
    if (!p) return;
    detail.innerHTML = detailHtml(p);
    detail.hidden = false;
    bindDetailControls(p);
    bindGallery(detail);
    wrap.classList.add("oda-list-item-open");
    if (chevron) chevron.style.transform = "rotate(90deg)";
  }
}

function scrollToPoi(poiId) {
  const wrap = document.querySelector(`.oda-list-item-wrap[data-poi-id="${cssEscape(poiId)}"]`);
  if (!wrap) return;
  wrap.scrollIntoView({ behavior: "smooth", block: "center" });
  const detail = wrap.querySelector(".oda-list-detail");
  if (detail && detail.hidden) {
    toggleDetail(poiId);
  }
  wrap.classList.add("oda-list-item-flash");
  setTimeout(() => wrap.classList.remove("oda-list-item-flash"), 1200);
}

function cssEscape(s) {
  if (window.CSS && CSS.escape) return CSS.escape(s);
  return String(s).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function detailHtml(p) {
  const name = localizedText(p.name, APP_STATE.activeLang) || "(ohne Name)";
  const type = p["@type"] || "Place";
  const desc = localizedText(p.description, APP_STATE.activeLang);
  const short = localizedText(p.disambiguatingDescription, APP_STATE.activeLang);
  const addr = p.address || {};
  const geo = p.geo || {};
  const images = Array.isArray(p.image) ? p.image : p.image ? [p.image] : [];
  const license = p.license || "";
  const licenseUrl = LICENSE_URLS[license] || "";
  const copyright = p.copyrightHolder || "";
  const tel = addr.telephone || "";
  const url = addr.url || "";
  const email = addr.email || "";
  const amenity = Array.isArray(p.amenityFeature) ? p.amenityFeature : [];
  const modified = p.dateModified || "";

  const galleryHtml = images.length
    ? `<div class="oda-gallery">
        ${images
          .map(
            (img, i) =>
              `<img src="${escapeAttr(img.contentUrl || img.url || "")}" alt="${escapeAttr(name)}" class="oda-gallery-img ${i === 0 ? "active" : ""}" loading="lazy">`
          )
          .join("")}
       </div>
       ${images.length > 1 ? `<div class="oda-gallery-thumbs">
         ${images
           .map(
             (img, i) =>
               `<img src="${escapeAttr(img.contentUrl || img.url || "")}" alt="" class="oda-gallery-thumb ${i === 0 ? "active" : ""}" data-idx="${i}" loading="lazy">`
           )
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

    ${desc ? `<div class="oda-detail-desc">${desc}</div>` : ""}

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
        ${tel ? `<a href="tel:${escapeAttr(tel)}" class="oda-contact-link">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          ${escapeHtml(tel)}
        </a>` : ""}
        ${email ? `<a href="mailto:${escapeAttr(email)}" class="oda-contact-link">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/></svg>
          ${escapeHtml(email)}
        </a>` : ""}
        ${url ? `<a href="${escapeAttr(url)}" target="_blank" rel="noopener" class="oda-contact-link">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          ${escapeHtml(url.replace(/^https?:\/\//, ""))}
        </a>` : ""}
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

function bindDetailControls(p) {
  const accordion = document.getElementById("oda-jsonld-accordion");
  const codeEl = accordion ? accordion.querySelector("code") : null;
  if (accordion && codeEl) {
    accordion.addEventListener("toggle", () => {
      if (accordion.open && !codeEl.textContent) {
        codeEl.textContent = JSON.stringify(toOdtaJsonLd(p), null, 2);
      }
    });
  }

  const copy = document.getElementById("oda-jsonld-copy");
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
  const dl = document.getElementById("oda-jsonld-download");
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

function renderSchale4Blocks(configdata) {
  const top = document.getElementById("oda-schale4-top");
  const bottom = document.getElementById("oda-schale4-bottom");

  const methodik = String(configdata.datenquelleHinweis || "").trim();
  const datenStandText = String(configdata.datenStand || "").trim();
  const links = String(configdata.verwandteLinks || "").trim();
  const freshness = APP_STATE.latestDate
    ? new Date(APP_STATE.latestDate).toLocaleDateString("de-DE")
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

function showError(msg) {
  const el = document.getElementById("oda-loading");
  if (el) el.innerHTML = `<div class="oda-error-box">${escapeHtml(msg)}</div>`;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
  } catch (e) {
    return url;
  }
}

function getOdasProxyEndpoint(targetUrl) {
  const fullPath = window.location.pathname.replace(/\/+$/, "");
  const apiPath = extractPathFromUrl(targetUrl);
  return `${fullPath}/odp-data?path=${encodeURIComponent(apiPath)}`;
}

async function fetchViaOdasProxy(targetUrl) {
  const response = await fetch(getOdasProxyEndpoint(targetUrl), { method: "POST" });
  if (!response.ok) throw new Error(`Proxy-Fehler: HTTP ${response.status}`);
  const proxyData = await response.json();
  if (!proxyData || typeof proxyData.content !== "string") {
    throw new Error("Proxy-Antwort enthaelt keinen content-String");
  }
  return proxyData.content;
}

async function fetchOdasResource(targetUrl, configdata = {}) {
  if (isOdasProxyEnabled(configdata)) {
    return fetchViaOdasProxy(targetUrl);
  }
  const response = await fetch(targetUrl);
  if (!response.ok) throw new Error(`HTTP-Fehler: ${response.status}`);
  return response.text();
}

function addToHead() {}
