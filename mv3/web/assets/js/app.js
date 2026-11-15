// MV3 – live tracker van de Falcon 8X PH-UTL. Gegevens van de 112Heli-server, kaart en plaatsnamen van Apple.
import { t, lang, locale, applyStatic, setLang } from "./i18n.js";

const CFG = window.MV3_CONFIG;
const API = CFG.api.replace(/\/+$/, "");
const HEX = CFG.hex;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const now = () => Date.now() / 1000;

// ------------------------------------------------------------------ settings

const SET_KEY = "mv3.settings";
const settings = Object.assign({ units: "metric", time: "local", follow: true, circuits: true, theme: "auto" }, (() => { try { return JSON.parse(localStorage.getItem(SET_KEY)) || {}; } catch { return {}; } })());
const saveSettings = () => { try { localStorage.setItem(SET_KEY, JSON.stringify(settings)); } catch {} };

// ------------------------------------------------------------------ theme (auto follows the device)

const darkMQ = matchMedia("(prefers-color-scheme: dark)");
const themeNow = () => (settings.theme === "auto" ? (darkMQ.matches ? "dark" : "light") : settings.theme);
function applyTheme() {
  const th = themeNow();
  document.documentElement.dataset.theme = th;
  document.getElementById("themeColor")?.setAttribute("content", th === "dark" ? "#07080b" : "#f4f4f1");
  const scheme = () => (th === "dark" ? mk.Map.ColorSchemes.Dark : mk.Map.ColorSchemes.Light);
  if (typeof mk !== "undefined" && mk) { if (map) map.colorScheme = scheme(); if (thMap) thMap.colorScheme = scheme(); }
}
darkMQ.addEventListener?.("change", () => { if (settings.theme === "auto") applyTheme(); });

// ------------------------------------------------------------------ formatting

const nf = (d = 0) => new Intl.NumberFormat(locale(), { maximumFractionDigits: d, minimumFractionDigits: d });
const U = {
  alt(ft) {
    if (ft == null) return "–";
    return settings.units === "metric" ? `${nf().format(Math.round((ft * 0.3048) / 10) * 10)}<small>m</small>` : `${nf().format(Math.round(ft / 50) * 50)}<small>ft</small>`;
  },
  speed(kt) {
    if (kt == null) return "–";
    if (settings.units === "aviation") return `${nf().format(Math.round(kt))}<small>kt</small>`;
    if (settings.units === "imperial") return `${nf().format(Math.round(kt * 1.15078))}<small>mph</small>`;
    return `${nf().format(Math.round(kt * 1.852))}<small>km/u</small>`.replace("km/u", lang === "nl" ? "km/u" : "km/h");
  },
  dist(km, plain = false) {
    if (km == null) return "–";
    const [v, u] = settings.units === "aviation" ? [km / 1.852, "nm"] : settings.units === "imperial" ? [km / 1.609344, "mi"] : [km, "km"];
    const s = nf(v < 10 ? 1 : 0).format(v);
    return plain ? `${s} ${u}` : `${s}<small>${u}</small>`;
  },
  vs(ftmin) {
    if (ftmin == null) return "–";
    const arrow = ftmin > 150 ? "↑ " : ftmin < -150 ? "↓ " : "";
    if (settings.units === "metric") return `${arrow}${nf().format(Math.round(Math.abs(ftmin) * 0.3048 / 10) * 10)}<small>m/min</small>`;
    return `${arrow}${nf().format(Math.round(Math.abs(ftmin) / 50) * 50)}<small>ft/min</small>`;
  },
  plain: (html) => html.replace(/<small>/g, " ").replace(/<\/small>/g, ""),
};
const tz = () => (settings.time === "utc" ? "UTC" : undefined);
const fmtTime = (ts) => new Date(ts * 1000).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit", timeZone: tz() }) + (settings.time === "utc" ? " UTC" : "");
const fmtDate = (ts, o = {}) => new Date(ts * 1000).toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short", timeZone: tz(), ...o });
const fmtDur = (s) => {
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}<small>u</small> ${String(m).padStart(2, "0")}<small>m</small>`.replace(/<small>u<\/small>/, lang === "nl" ? "<small>u</small>" : "<small>h</small>") : `${m}<small>min</small>`;
};
const clock = (s) => {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}`;
};
function ago(ts) {
  if (!ts) return "";
  const s = Math.max(0, now() - ts);
  if (s < 90) return t("ago.s", { n: Math.round(s) });
  if (s < 5400) return t("ago.m", { n: Math.round(s / 60) });
  if (s < 172800) return t("ago.h", { n: Math.round(s / 3600) });
  return t("ago.d", { n: Math.round(s / 86400) });
}
const DIRS = { nl: ["N", "NO", "O", "ZO", "Z", "ZW", "W", "NW"], en: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] };
const compass = (d) => (d == null ? "–" : `${Math.round(d)}°<small>${DIRS[lang][Math.floor(((d % 360) + 382.5) / 45) % 8]}</small>`);
const flag = (cc) => (cc && cc.length === 2 ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 127397 + c.charCodeAt(0))) : "");

// ------------------------------------------------------------------ geo helpers

const RAD = Math.PI / 180;
function km(aLat, aLon, bLat, bLon) {
  const h = Math.sin(((bLat - aLat) * RAD) / 2) ** 2 + Math.cos(aLat * RAD) * Math.cos(bLat * RAD) * Math.sin(((bLon - aLon) * RAD) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}
function bearing(aLat, aLon, bLat, bLon) {
  const y = Math.sin((bLon - aLon) * RAD) * Math.cos(bLat * RAD);
  const x = Math.cos(aLat * RAD) * Math.sin(bLat * RAD) - Math.sin(aLat * RAD) * Math.cos(bLat * RAD) * Math.cos((bLon - aLon) * RAD);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}
function move(lat, lon, brg, distKm) {
  const d = distKm / 6371, b = brg * RAD, p1 = lat * RAD, l1 = lon * RAD;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [p2 / RAD, ((l2 / RAD + 540) % 360) - 180];
}
/** Points on the great circle from a to b (for the route art on a card). */
function arc(aLat, aLon, bLat, bLon, n = 48) {
  const out = [], d = km(aLat, aLon, bLat, bLon), b = bearing(aLat, aLon, bLat, bLon);
  for (let i = 0; i <= n; i++) out.push(move(aLat, aLon, b, (d * i) / n));
  return out;
}
const routeKm = (pts) => pts.reduce((s, p, i) => (i ? s + km(pts[i - 1].lat, pts[i - 1].lon, p.lat, p.lon) : 0), 0);

// ------------------------------------------------------------------ data

async function get(path) {
  const r = await fetch(API + path, { signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
const S = { jet: null, flights: null, track: [], f1: null, fixAt: 0 };

// ------------------------------------------------------------------ MapKit

let mkReady = null;
function loadMapKit() {
  if (mkReady) return mkReady;
  mkReady = new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.core.js";
    s.crossOrigin = "anonymous";
    s.dataset.libraries = "map,annotations,overlays,services";
    s.dataset.callback = "__mv3mk";
    let done = false;
    window.__mv3mk = () => {
      const mk = window.mapkit;
      mk.init({
        language: lang,
        authorizationCallback: async (cb) => {
          try { const { token } = await get("/v1/mapkit-token"); cb(token); if (!done) { done = true; resolve(mk); } } catch { resolve(null); }
        },
      });
      mk.addEventListener("error", () => resolve(null));
    };
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
    setTimeout(() => resolve(window.mapkit && done ? window.mapkit : null), 15000);
  });
  return mkReady;
}

/** Reverse geocoding via Apple, cached per ~1 km in localStorage. */
const GEO_KEY = "mv3.geo." + lang;
const geoCache = (() => { try { return JSON.parse(localStorage.getItem(GEO_KEY)) || {}; } catch { return {}; } })();
let geocoder = null, geoQueue = Promise.resolve();
function place(lat, lon) {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  if (geoCache[key]) return Promise.resolve(geoCache[key]);
  geoQueue = geoQueue.then(async () => {
    if (geoCache[key]) return geoCache[key];
    const mk = await loadMapKit();
    if (!mk || !mk.Geocoder) return null;
    geocoder ||= new mk.Geocoder({ language: lang, getsUserLocation: false });
    const r = await new Promise((res) => geocoder.reverseLookup(new mk.Coordinate(lat, lon), (err, data) => res(err ? null : data?.results?.[0] || null)));
    const p = r ? { city: r.locality || r.subLocality || r.administrativeArea || r.name || null, region: r.administrativeArea || null, country: r.country || null, cc: r.countryCode || null } : { city: null, country: null, cc: null, sea: true };
    geoCache[key] = p;
    try { localStorage.setItem(GEO_KEY, JSON.stringify(geoCache)); } catch {}
    return p;
  }).catch(() => null);
  return geoQueue;
}
const placeName = (p, fallback) => (p?.city ? `${p.city}${p.country && p.country !== p.city ? `, ${p.country}` : ""}` : p?.sea ? t("over.sea") : fallback || t("unknown"));
const cityName = (p, fallback) => (p?.city ? p.city : p?.sea ? t("over.sea") : (fallback || "").split(",")[0] || t("unknown"));

// The jet seen from above, nose up; turned by its track.
const JET_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true"><path fill="#ff6a13" stroke="#111" stroke-width="1.6" stroke-linejoin="round"
  d="M32 3c2.3 0 3.6 3.2 3.8 8.6l.3 11.2 19.6 12.6c.9.6 1.4 1.5 1.4 2.5v2.3l-21-6.6.4 13.4 6.6 5.1v3.6l-8.6-2.2c-.6 1.6-1.4 2.4-2.5 2.4s-1.9-.8-2.5-2.4l-8.6 2.2v-3.6l6.6-5.1.4-13.4-21 6.6v-2.3c0-1 .5-1.9 1.4-2.5l19.6-12.6.3-11.2C28.4 6.2 29.7 3 32 3z"/>
  <path fill="#2b2f38" d="M30.2 9.5h3.6l-.4 3h-2.8z"/></svg>`;

// ------------------------------------------------------------------ live map

let mk = null, map = null, jetAnn = null, trail = null, circuitAnns = [], styleIdx = 0, fitted = false;
const STYLES = () => [mk.Map.MapTypes.MutedStandard, mk.Map.MapTypes.Hybrid, mk.Map.MapTypes.Satellite];

async function initMap() {
  mk = await loadMapKit();
  const el = $("map");
  if (!mk) { el.innerHTML = `<div class="map-fallback">${esc(t("map.error"))}</div>`; return; }
  map = new mk.Map(el, {
    colorScheme: themeNow() === "dark" ? mk.Map.ColorSchemes.Dark : mk.Map.ColorSchemes.Light, mapType: mk.Map.MapTypes.MutedStandard, showsPointsOfInterest: false,
    showsMapTypeControl: false, showsZoomControl: false, showsUserLocationControl: false, showsCompass: mk.FeatureVisibility.Hidden,
    showsScale: mk.FeatureVisibility.Hidden, padding: new mk.Padding(80, 40, 120, innerWidth > 900 ? 480 : 20),
    region: new mk.CoordinateRegion(new mk.Coordinate(46, 6), new mk.CoordinateSpan(28, 40)),
  });
  // A drag or zoom by the visitor stops following.
  map.addEventListener("scroll-start", () => { if (settings.follow) setFollow(false); });
  drawCircuits();
  liveDraw();
}

function setFollow(on) {
  settings.follow = on; saveSettings();
  $("btnFollow").setAttribute("aria-pressed", String(on));
  $("setFollow").checked = on;
  if (on) centerJet(true);
}

function jetElement() {
  const d = document.createElement("div");
  d.className = "jet-pin";
  d.innerHTML = JET_SVG;
  return d;
}

/** Position now: the last fix moved on along its track at its speed (at most 2 minutes). */
function jetNow() {
  const a = S.jet;
  if (!a || a.lat == null) return null;
  if (!a.airborne || !a.gs) return { lat: a.lat, lon: a.lon };
  const dt = Math.min(120, Math.max(0, now() - (a.seen || S.fixAt)));
  const [lat, lon] = move(a.lat, a.lon, a.track || 0, (a.gs * 1.852 * dt) / 3600);
  return { lat, lon };
}

function liveDraw() {
  if (!map || !S.jet || S.jet.lat == null) return;
  const p = jetNow(), c = new mk.Coordinate(p.lat, p.lon);
  if (!jetAnn) {
    jetAnn = new mk.Annotation(c, jetElement, { calloutEnabled: false, anchorOffset: new DOMPoint(0, 0), displayPriority: 1000 });
    map.addAnnotation(jetAnn);
  } else jetAnn.coordinate = c;
  const el = jetAnn.element;
  if (el) {
    el.classList.toggle("air", !!S.jet.airborne);
    const svg = el.querySelector("svg");
    if (svg) svg.style.transform = `rotate(${S.jet.airborne ? S.jet.track || 0 : S.jet.track || 0}deg)`;
  }
  const coords = S.track.map((q) => new mk.Coordinate(q.lat, q.lon));
  if (S.jet.airborne) coords.push(c);
  if (trail) map.removeOverlay(trail);
  trail = null;
  if (coords.length > 1) {
    trail = new mk.PolylineOverlay(coords, { style: new mk.Style({ strokeColor: "#ff6a13", lineWidth: 3.5, lineCap: "round", lineJoin: "round", strokeOpacity: 0.95 }) });
    map.addOverlay(trail);
  }
  if (!fitted) { fitted = true; fitRoute(false); }
  else if (settings.follow) centerJet(false);
}

function centerJet(animated) {
  const p = jetNow();
  if (!map || !p) return;
  map.setCenterAnimated(new mk.Coordinate(p.lat, p.lon), animated);
}

function fitRoute(animated = true) {
  if (!map || !S.jet) return;
  if (trail && S.jet.airborne) map.showItems([trail, jetAnn], { animate: animated, padding: new mk.Padding(80, 60, 140, innerWidth > 900 ? 500 : 30) });
  else {
    const p = jetNow();
    map.setRegionAnimated(new mk.CoordinateRegion(new mk.Coordinate(p.lat, p.lon), new mk.CoordinateSpan(1.6, 2.4)), animated);
  }
}

function drawCircuits() {
  if (!map) return;
  if (circuitAnns.length) map.removeAnnotations(circuitAnns);
  circuitAnns = [];
  if (!settings.circuits || !S.f1?.kalender?.length) return;
  const next = S.f1.volgende?.naam;
  circuitAnns = S.f1.kalender.map((r) => new mk.Annotation(new mk.Coordinate(r.lat, r.lon), () => {
    const d = document.createElement("div");
    d.className = `f1-pin${r.naam === next ? " next" : ""}`; d.textContent = "🏁"; d.title = `${r.naam} · ${r.circuit}`;
    return d;
  }, { calloutEnabled: false, title: r.naam }));
  map.addAnnotations(circuitAnns);
}

// ------------------------------------------------------------------ HUD

let lastPlaceKey = "";
async function hud() {
  const a = S.jet, st = $("state");
  if (!a) {
    st.className = "state"; st.innerHTML = `<i></i>${esc(t("state.away"))}`;
    $("place").textContent = "PH-UTL";
    const f = S.flights?.[0];
    $("placeSub").textContent = f ? `${t("t.lastseen")}: ${fmtDate(f.end || f.start)} · ${f.endPlace || f.startPlace || ""}` : t("hero.sub");
    ["tAlt", "tGs", "tHdg", "tVs", "tSince", "tDist"].forEach((id) => ($(id).innerHTML = "–"));
    return;
  }
  const air = !!a.airborne;
  st.className = `state ${air ? "air" : "ground"}`;
  st.innerHTML = `<i></i>${esc(t(air ? "state.air" : "state.ground"))}`;
  setTele("tAlt", air ? U.alt(a.alt) : "–");
  setTele("tGs", air ? U.speed(a.gs) : "–");
  setTele("tHdg", air ? compass(a.track) : "–");
  $("needle").style.transform = `rotate(${a.track || 0}deg)`;
  setTele("tVs", air ? U.vs(vertical()) : "–");
  $("tSinceL").textContent = t(air ? "t.since" : "t.since.ground");
  const cur = currentFlight();
  setTele("tDist", air && S.track.length > 1 ? U.dist(routeKm(S.track)) : "–");
  // place name, geocoded at most every ~10 km
  const p = jetNow(), key = `${p.lat.toFixed(1)},${p.lon.toFixed(1)}`;
  if (key !== lastPlaceKey) {
    lastPlaceKey = key;
    const g = await place(p.lat, p.lon);
    const fb = a.boven || a.plek;
    const name = g?.city || (fb ? fb.split(",")[0] : null);
    $("place").textContent = g?.sea && air ? t("over.sea") : name ? (air ? t("above", { p: name }) : t("at", { p: name })) : "PH-UTL";
    if (g?.cc && name) $("place").textContent += ` ${flag(g.cc)}`;
  }
  if (air && cur) {
    const from = cur.startLat != null ? cityName(await place(cur.startLat, cur.startLon), cur.startPlace) : cur.startPlace || t("unknown");
    $("placeSub").textContent = `${lang === "nl" ? "Vertrokken uit" : "Departed"} ${from} · ${fmtTime(cur.start)}`;
  } else if (!air) {
    const last = S.flights?.find((f) => f.end);
    $("placeSub").textContent = last ? `${lang === "nl" ? "Geland" : "Landed"} ${fmtDate(last.end)} · ${fmtTime(last.end)}` : t("hero.sub");
  }
  hudProfile();
}
function setTele(id, html) {
  const el = $(id);
  if (el.innerHTML !== html) { el.innerHTML = html; el.parentElement.classList.remove("flash"); void el.offsetWidth; el.parentElement.classList.add("flash"); }
}
const currentFlight = () => (S.flights?.[0] && !S.flights[0].end ? S.flights[0] : null);
function vertical() {
  const p = S.track.filter((q) => q.alt != null && q.ts);
  if (p.length < 2) return null;
  const x = p[p.length - 2], y = p[p.length - 1], dt = (y.ts - x.ts) / 60;
  return dt > 0 && dt < 6 ? (y.alt - x.alt) / dt : null;
}
function tick() {
  const a = S.jet;
  $("ago").textContent = a?.seen ? ago(a.seen) : "";
  if (a?.since) $("tSince").innerHTML = clock(now() - a.since);
  else if (a) $("tSince").innerHTML = "–";
  if (S.jet?.airborne) liveDraw();
  countdown();
}
function hudProfile() {
  const el = $("hudProfile"), p = S.track.filter((q) => q.alt != null);
  if (!S.jet?.airborne || p.length < 3) { el.hidden = true; return; }
  el.hidden = false;
  const maxA = Math.max(...p.map((q) => q.alt), 1000), t0 = p[0].ts, t1 = p[p.length - 1].ts || t0 + 1;
  const pts = p.map((q) => `${((q.ts - t0) / (t1 - t0)) * 400},${64 - (q.alt / maxA) * 58}`).join(" ");
  el.innerHTML = `<div class="lbl"><span>${esc(t("th.legendAlt"))}</span><span>${U.plain(U.alt(maxA))} max</span></div>
    <svg viewBox="0 0 400 64" preserveAspectRatio="none"><defs><linearGradient id="hg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ff6a13" stop-opacity=".5"/><stop offset="1" stop-color="#ff6a13" stop-opacity="0"/></linearGradient></defs>
    <polygon points="0,64 ${pts} 400,64" fill="url(#hg)"/><polyline points="${pts}" fill="none" stroke="#ff8a3d" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
}

// ------------------------------------------------------------------ flights

function circuitAt(lat, lon, ts) {
  if (lat == null || !S.f1?.kalender) return null;
  for (const r of S.f1.kalender) {
    const days = Math.abs(ts - Date.parse(`${r.datum}T${r.tijd || "14:00:00Z"}`) / 1000) / 86400;
    if (days <= 6 && km(lat, lon, r.lat, r.lon) <= 80) return r;
  }
  return null;
}
const nearMonaco = (lat, lon) => lat != null && km(lat, lon, 43.7347, 7.4206) <= 35;

function routeArt(f) {
  const a = [f.startLat, f.startLon], b = [f.end ? f.endLat : S.jet?.lat, f.end ? f.endLon : S.jet?.lon];
  if (a[0] == null || b[0] == null) return `<svg viewBox="0 0 300 130"></svg>`;
  const pts = arc(a[0], a[1], b[0], b[1]);
  const lats = pts.map((p) => p[0]), lons = pts.map((p) => p[1]);
  const cLat = (Math.min(...lats) + Math.max(...lats)) / 2, k = Math.cos(cLat * RAD);
  const xs = lons.map((l) => l * k), ys = lats.map((l) => -l);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, (maxY - minY) * 2.3, 0.4), s = 230 / span;
  const ox = 150 - ((minX + maxX) / 2) * s, oy = 65 - ((minY + maxY) / 2) * s;
  const P = xs.map((x, i) => [x * s + ox, ys[i] * s + oy]);
  const d = P.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const [s0, e0] = [P[0], P[P.length - 1]];
  const grid = Array.from({ length: 7 }, (_, i) => `<line x1="${i * 50}" y1="0" x2="${i * 50}" y2="130" style="stroke:rgba(var(--ink),.05)"/>`).join("")
    + Array.from({ length: 3 }, (_, i) => `<line x1="0" y1="${i * 50 + 15}" x2="300" y2="${i * 50 + 15}" style="stroke:rgba(var(--ink),.05)"/>`).join("");
  return `<svg viewBox="0 0 300 130" aria-hidden="true">${grid}
    <path d="${d}" fill="none" stroke="rgba(255,106,19,.25)" stroke-width="8" stroke-linecap="round"/>
    <path d="${d}" fill="none" stroke="#ff6a13" stroke-width="2.4" stroke-linecap="round" ${f.end ? "" : 'stroke-dasharray="6 6"'}/>
    <circle cx="${s0[0]}" cy="${s0[1]}" r="4.5" style="fill:var(--art)" stroke="#fff" stroke-width="2"/>
    <circle cx="${e0[0]}" cy="${e0[1]}" r="5" fill="#ff6a13" stroke="#fff" stroke-width="2"/></svg>`;
}

async function renderFlights() {
  const el = $("flights");
  if (!S.flights) { el.innerHTML = `<div class="empty">${esc(t("fl.error"))}</div>`; return; }
  if (!S.flights.length) { el.innerHTML = `<div class="empty">${esc(t("fl.none"))}</div>`; return; }
  el.innerHTML = S.flights.slice(0, 24).map((f) => {
    const c = circuitAt(f.endLat, f.endLon, f.end || f.start) || circuitAt(f.startLat, f.startLon, f.start);
    const home = !c && f.end && nearMonaco(f.endLat, f.endLon);
    const dur = (f.end || now()) - f.start;
    const dist = f.startLat != null && (f.end ? f.endLat : S.jet?.lat) != null ? km(f.startLat, f.startLon, f.end ? f.endLat : S.jet.lat, f.end ? f.endLon : S.jet.lon) : null;
    return `<button class="fcard reveal${openId === f.id ? " on" : ""}" data-id="${f.id}">
      <div class="art">${routeArt(f)}</div>
      ${f.end ? "" : `<span class="badge is-live">● ${esc(t("fl.live"))}</span>`}
      ${c ? `<span class="badge f1">🏁 ${esc(c.naam.replace(" Grand Prix", " GP"))}</span>` : home ? `<span class="badge f1">🏠 Monaco</span>` : ""}
      <div class="body">
        <div class="when">${esc(fmtDate(f.start))} · ${esc(fmtTime(f.start))}</div>
        <div class="route"><span data-geo="${f.startLat},${f.startLon}" data-fb="${esc(f.startPlace || "")}">${esc((f.startPlace || t("unknown")).split(",")[0])}</span><i>→</i><span ${f.end ? `data-geo="${f.endLat},${f.endLon}" data-fb="${esc(f.endPlace || "")}"` : ""}>${esc(f.end ? (f.endPlace || t("unknown")).split(",")[0] : "…")}</span></div>
        <div class="meta"><span>${U.plain(fmtDur(dur))}</span>${dist != null ? `<span>≈ ${U.dist(dist, true)}</span>` : ""}</div>
      </div></button>`;
  }).join("");
  el.querySelectorAll(".fcard").forEach((b) => b.addEventListener("click", () => openFlight(Number(b.dataset.id), true)));
  reveal();
  // better names (with flag) from Apple, one after the other
  for (const span of el.querySelectorAll("[data-geo]")) {
    const [la, lo] = span.dataset.geo.split(",").map(Number);
    if (!Number.isFinite(la)) continue;
    place(la, lo).then((g) => { if (g?.city) span.textContent = `${g.city} ${flag(g.cc)}`.trim(); });
  }
}

// ------------------------------------------------------------------ theater (one flight, replay)

let openId = null, thMap = null, thRoute = null, thJet = null, thPins = [], thPts = [], playing = false, speed = 240, tRel = 0, lastFrame = 0;

async function openFlight(id, scroll) {
  const f = S.flights?.find((x) => x.id === id);
  if (!f) return;
  openId = id;
  document.querySelectorAll(".fcard").forEach((c) => c.classList.toggle("on", Number(c.dataset.id) === id));
  history.replaceState(null, "", `#vlucht=${id}`);
  const th = $("theater");
  th.hidden = false;
  if (scroll) th.scrollIntoView({ behavior: "smooth", block: "start" });
  stop();
  let pts = [];
  try { pts = ((await get(`/v1/flights/${id}/track`)).points || []).filter((p) => p.lat != null && p.ts); } catch {}
  if (!f.end && S.jet?.lat != null) pts.push({ ts: S.jet.seen || now(), lat: S.jet.lat, lon: S.jet.lon, alt: S.jet.alt, gs: S.jet.gs, track: S.jet.track });
  thPts = pts;
  const [gA, gB] = await Promise.all([
    f.startLat != null ? place(f.startLat, f.startLon) : null,
    f.end && f.endLat != null ? place(f.endLat, f.endLon) : null,
  ]);
  const from = cityName(gA, f.startPlace), to = f.end ? cityName(gB, f.endPlace) : "…";
  $("thWhen").textContent = `${t("th.flight")} · ${fmtDate(f.start, { weekday: "long", day: "numeric", month: "long" })}`;
  $("thTitle").innerHTML = `${esc(from)} ${flag(gA?.cc)} <span style="color:var(--or)">→</span> ${esc(to)} ${f.end ? flag(gB?.cc) : ""}`;
  const c = circuitAt(f.endLat, f.endLon, f.end || f.start), c2 = circuitAt(f.startLat, f.startLon, f.start);
  const tag = $("thTag");
  if (c && f.end) { tag.hidden = false; tag.textContent = `🏁 ${t("th.landedAt", { c: c.circuit, gp: c.naam })}`; }
  else if (c2) { tag.hidden = false; tag.textContent = `🏁 ${t("th.departedAt", { c: c2.circuit, gp: c2.naam })}`; }
  else if (f.end && nearMonaco(f.endLat, f.endLon)) { tag.hidden = false; tag.textContent = `🏠 ${t("th.home")}`; }
  else tag.hidden = true;
  share(f, from, to);
  facts(f, pts, from, to);
  profileChart(pts);
  await theaterMap(f, pts);
  setT(0);
}

function share(f, from, to) {
  const url = `${location.origin}/#vlucht=${f.id}`;
  const text = `✈️ PH-UTL: ${from} → ${to} (${fmtDate(f.start)})`;
  $("thWa").href = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
  $("thX").href = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  $("thCopy").onclick = async () => { try { await navigator.clipboard.writeText(url); toast(t("share.copied")); } catch { prompt(t("share.copy"), url); } };
}

function facts(f, pts, from, to) {
  const end = f.end || (pts.length ? pts[pts.length - 1].ts : now());
  const dist = pts.length > 1 ? routeKm(pts) : null;
  const maxAlt = Math.max(0, ...pts.map((p) => p.alt || 0));
  const maxGs = Math.max(0, ...pts.map((p) => p.gs || 0));
  const avgKt = dist && end > f.start ? dist / 1.852 / ((end - f.start) / 3600) : null;
  $("facts").innerHTML = [
    [t("th.dep"), fmtTime(f.start), from],
    [f.end ? t("th.arr") : t("th.now"), fmtTime(end), f.end ? to : t("th.ongoing")],
    [t("th.dur"), fmtDur(end - f.start), ""],
    [t("th.dist"), dist ? U.dist(dist) : "–", t("th.route")],
    [t("th.maxalt"), maxAlt ? U.alt(maxAlt) : "–", ""],
    [t("th.avg"), avgKt ? U.speed(avgKt) : "–", maxGs ? t("th.maxgs", { v: U.plain(U.speed(maxGs)) }) : ""],
  ].map(([k, v, s]) => `<div class="fact"><span>${esc(k)}</span><b>${v}</b><small>${esc(s)}</small></div>`).join("");
}

async function theaterMap(f, pts) {
  const el = $("thMap");
  mk ||= await loadMapKit();
  if (!mk) { el.innerHTML = `<div class="map-fallback">${esc(t("map.error"))}</div>`; return; }
  if (!thMap) {
    thMap = new mk.Map(el, { colorScheme: themeNow() === "dark" ? mk.Map.ColorSchemes.Dark : mk.Map.ColorSchemes.Light, mapType: mk.Map.MapTypes.MutedStandard, showsPointsOfInterest: false,
      showsMapTypeControl: false, showsCompass: mk.FeatureVisibility.Hidden, showsScale: mk.FeatureVisibility.Hidden });
  }
  if (thRoute) thMap.removeOverlays(thRoute);
  if (thPins.length) thMap.removeAnnotations(thPins);
  if (thJet) { thMap.removeAnnotation(thJet); thJet = null; }
  thRoute = null; thPins = [];
  if (pts.length < 2) return;
  const coords = pts.map((p) => new mk.Coordinate(p.lat, p.lon));
  const casing = new mk.PolylineOverlay(coords, { style: new mk.Style({ strokeColor: "#ff6a13", strokeOpacity: 0.22, lineWidth: 12, lineCap: "round", lineJoin: "round" }) });
  const line = new mk.PolylineOverlay(coords, { style: new mk.Style({ strokeColor: "#ff6a13", lineWidth: 3.5, lineCap: "round", lineJoin: "round" }) });
  thRoute = [casing, line];
  thMap.addOverlays(thRoute);
  const pin = (p, label, cls) => new mk.Annotation(new mk.Coordinate(p.lat, p.lon), () => { const d = document.createElement("div"); d.className = `ap-pin ${cls}`; d.textContent = label; return d; }, { calloutEnabled: false });
  thPins = [pin(pts[0], t("th.dep"), "start")];
  if (f.end) thPins.push(pin(pts[pts.length - 1], t("th.arr"), "end"));
  thMap.addAnnotations(thPins);
  thJet = new mk.Annotation(coords[0], jetElement, { calloutEnabled: false, displayPriority: 1000 });
  thMap.addAnnotation(thJet);
  thMap.showItems([line], { animate: true, padding: new mk.Padding(60, 60, 60, 60) });
}

// profile chart
const CW = 1000, CH = 230, PL = 56, PR = 64, PT = 22, PB = 30;
function niceMax(v) { const e = 10 ** Math.floor(Math.log10(Math.max(v, 1))), n = v / e; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * e; }
function profileChart(pts) {
  const el = $("profile");
  if (pts.length < 2) { el.innerHTML = `<p class="note" style="padding:20px">${esc(t("th.few"))}</p>`; return; }
  const t0 = pts[0].ts, t1 = pts[pts.length - 1].ts || t0 + 1;
  const altU = settings.units === "metric" ? 0.3048 : 1, gsU = settings.units === "metric" ? 1.852 : settings.units === "imperial" ? 1.15078 : 1;
  const yA = niceMax(Math.max(...pts.map((p) => (p.alt || 0) * altU))), yG = niceMax(Math.max(...pts.map((p) => (p.gs || 0) * gsU)));
  const x = (tt) => PL + ((tt - t0) / (t1 - t0)) * (CW - PL - PR);
  const ya = (v) => PT + (1 - v / yA) * (CH - PT - PB), yg = (v) => PT + (1 - v / yG) * (CH - PT - PB);
  const area = `M${x(t0)},${ya(0)} ` + pts.map((p) => `L${x(p.ts).toFixed(1)},${ya((p.alt || 0) * altU).toFixed(1)}`).join(" ") + ` L${x(t1)},${ya(0)}Z`;
  const gs = pts.filter((p) => p.gs != null).map((p, i) => `${i ? "L" : "M"}${x(p.ts).toFixed(1)},${yg(p.gs * gsU).toFixed(1)}`).join(" ");
  const f = nf();
  const grid = [0, 0.25, 0.5, 0.75, 1].map((k) => { const yy = PT + (1 - k) * (CH - PT - PB); return `<line x1="${PL}" x2="${CW - PR}" y1="${yy}" y2="${yy}" class="g"/><text x="${PL - 8}" y="${yy + 4}" class="ax ax-l">${f.format(yA * k)}</text><text x="${CW - PR + 8}" y="${yy + 4}" class="ax ax-r">${f.format(yG * k)}</text>`; }).join("");
  const xt = Array.from({ length: 6 }, (_, i) => t0 + ((t1 - t0) * i) / 5).map((tt) => `<text x="${x(tt)}" y="${CH - 8}" class="ax" text-anchor="middle">${fmtTime(tt).replace(" UTC", "")}</text>`).join("");
  const ua = settings.units === "metric" ? "m" : "ft", ug = settings.units === "metric" ? (lang === "nl" ? "km/u" : "km/h") : settings.units === "imperial" ? "mph" : "kt";
  el.innerHTML = `<div class="legend"><span><i style="background:#ff8a3d"></i>${esc(t("th.legendAlt"))} (${ua})</span><span><i style="background:#6f88ff"></i>${esc(t("th.legendGs"))} (${ug})</span></div>
    <svg viewBox="0 0 ${CW} ${CH}" preserveAspectRatio="none" role="img" aria-label="${esc(t("th.legendAlt"))} / ${esc(t("th.legendGs"))}">
    <defs><linearGradient id="pa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6a13" stop-opacity=".55"/><stop offset="1" stop-color="#ff6a13" stop-opacity=".03"/></linearGradient></defs>
    ${grid}<path d="${area}" fill="url(#pa)" stroke="#ff8a3d" stroke-width="2"/><path d="${gs}" fill="none" stroke="#6f88ff" stroke-width="2"/>${xt}
    <line id="cur" class="cur" x1="${PL}" x2="${PL}" y1="${PT}" y2="${CH - PB}"/></svg>`;
  const svg = el.querySelector("svg");
  const seek = (cx) => { const r = svg.getBoundingClientRect(); const fx = ((cx - r.left) / r.width) * CW; setT(Math.min(1, Math.max(0, (fx - PL) / (CW - PL - PR)))); };
  let drag = false;
  svg.addEventListener("pointerdown", (e) => { drag = true; stop(); seek(e.clientX); });
  addEventListener("pointerup", () => (drag = false));
  svg.addEventListener("pointermove", (e) => { if (drag || e.pointerType === "mouse") seek(e.clientX); });
}

/** Point at relative time r (0..1), interpolated. */
function at(r) {
  const p = thPts;
  if (p.length < 2) return null;
  const tt = p[0].ts + r * (p[p.length - 1].ts - p[0].ts);
  let i = 1;
  while (i < p.length - 1 && p[i].ts < tt) i++;
  const a = p[i - 1], b = p[i], k = b.ts > a.ts ? Math.min(1, Math.max(0, (tt - a.ts) / (b.ts - a.ts))) : 0;
  const lerp = (x, y) => (x == null ? y : y == null ? x : x + (y - x) * k);
  return { ts: tt, lat: lerp(a.lat, b.lat), lon: lerp(a.lon, b.lon), alt: lerp(a.alt, b.alt), gs: lerp(a.gs, b.gs),
    track: km(a.lat, a.lon, b.lat, b.lon) > 0.05 ? bearing(a.lat, a.lon, b.lat, b.lon) : b.track ?? a.track };
}
function setT(r) {
  tRel = r;
  const q = at(r);
  $("scrub").value = String(Math.round(r * 1000));
  if (!q) return;
  $("rdTime").textContent = fmtTime(q.ts);
  $("rdAlt").innerHTML = U.plain(U.alt(q.alt));
  $("rdGs").innerHTML = U.plain(U.speed(q.gs));
  $("rdHdg").innerHTML = U.plain(compass(q.track));
  const cur = document.getElementById("cur");
  if (cur) { const xx = PL + r * (CW - PL - PR); cur.setAttribute("x1", xx); cur.setAttribute("x2", xx); }
  if (thJet && mk) {
    thJet.coordinate = new mk.Coordinate(q.lat, q.lon);
    const svg = thJet.element?.querySelector("svg");
    if (svg) { svg.style.transition = "none"; svg.style.transform = `rotate(${q.track || 0}deg)`; }
  }
}
function frame(ts) {
  if (!playing) return;
  const dt = lastFrame ? (ts - lastFrame) / 1000 : 0;
  lastFrame = ts;
  const dur = thPts.length > 1 ? thPts[thPts.length - 1].ts - thPts[0].ts : 1;
  const r = tRel + (dt * speed) / dur;
  if (r >= 1) { setT(1); stop(); return; }
  setT(r);
  requestAnimationFrame(frame);
}
function play() {
  if (thPts.length < 2) return;
  if (tRel >= 1) setT(0);
  playing = true; lastFrame = 0;
  $("playIcon").setAttribute("d", "M6 4h4v16H6zM14 4h4v16h-4z");
  requestAnimationFrame(frame);
}
function stop() { playing = false; $("playIcon").setAttribute("d", "M7 4.5v15l13-7.5z"); }

// ------------------------------------------------------------------ stats

async function renderStats() {
  const fl = (S.flights || []).filter((f) => f.startLat != null);
  const done = fl.filter((f) => f.end);
  const secs = fl.reduce((s, f) => s + ((f.end || now()) - f.start), 0);
  const dist = done.reduce((s, f) => s + km(f.startLat, f.startLon, f.endLat, f.endLon), 0);
  const longest = done.reduce((m, f) => (f.end - f.start > (m ? m.end - m.start : 0) ? f : m), null);
  const h = secs / 3600;
  $("bigstats").innerHTML = `
    <div class="big reveal"><b class="cu" data-v="${fl.length}">0</b><span>${esc(t("st.flights"))}</span>${fl.length ? `<em>${esc(t("st.avg", { d: U.plain(fmtDur(secs / fl.length)) }))}</em>` : ""}</div>
    <div class="big reveal"><b class="cu" data-v="${h.toFixed(1)}" data-d="1">0</b><span>${esc(t("st.hours"))}</span></div>
    <div class="big reveal"><b><small style="margin:0 .15em 0 0">≈</small><span class="cu" data-v="${Math.round(settings.units === "aviation" ? dist / 1.852 : settings.units === "imperial" ? dist / 1.609 : dist)}">0</span><small>${settings.units === "aviation" ? "nm" : settings.units === "imperial" ? "mi" : "km"}</small></b><span>${esc(t("st.dist"))}</span>${dist > 4000 ? `<em>${esc(t("st.earth", { n: nf(1).format(dist / 40075) }))}</em>` : ""}</div>
    <div class="big reveal"><b>${longest ? fmtDur(longest.end - longest.start) : "–"}</b><span>${esc(t("st.longest"))}</span>${longest ? `<em data-geo-l="1">${esc((longest.startPlace || "").split(",")[0])} → ${esc((longest.endPlace || "").split(",")[0])}</em>` : ""}</div>`;
  countUp();
  // flying days: last 30 days
  const days = Array.from({ length: 30 }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - 29 + i); return d; });
  const per = days.map((d) => {
    const a = d.getTime() / 1000, b = a + 86400;
    return fl.reduce((s, f) => s + Math.max(0, Math.min(b, f.end || now()) - Math.max(a, f.start)), 0) / 3600;
  });
  const maxH = Math.max(...per, 1);
  $("heat").innerHTML = days.map((d, i) => `<div ${per[i] ? `data-h style="--a:${(0.25 + (0.75 * per[i]) / maxH).toFixed(2)}"` : ""} class="${i === 29 ? "today" : ""}" title="${esc(d.toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short" }))}: ${per[i] ? nf(1).format(per[i]) + " h" : "–"}"></div>`).join("");
  // countries and destinations via Apple
  const ends = done.map((f) => [f.endLat, f.endLon, f.endPlace]);
  const geo = [];
  for (const [la, lo, fb] of ends) geo.push({ g: await place(la, lo), fb });
  const cc = new Map();
  for (const f of fl) {
    for (const [la, lo, fb] of [[f.startLat, f.startLon, f.startPlace], [f.endLat, f.endLon, f.endPlace]]) {
      if (la == null) continue;
      const g = await place(la, lo);
      if (g?.cc) cc.set(g.cc, g.country);
      else if (fb && fb.includes(",")) { const land = fb.split(",").pop().trim(); cc.set(land, land); }
      else if (fb && km(la, lo, 52.2, 5.4) < 200) cc.set("NL", lang === "nl" ? "Nederland" : "Netherlands");
    }
  }
  $("countries").innerHTML = cc.size ? [...cc].map(([c, n]) => `<span>${c.length === 2 ? flag(c) + " " : ""}${esc(n)}</span>`).join("") : `<span>–</span>`;
  const count = new Map();
  for (const { g, fb } of geo) { const n = cityName(g, fb); count.set(n, (count.get(n) || 0) + 1); }
  const top = [...count].sort((a, b) => b[1] - a[1]).slice(0, 5), mx = top[0]?.[1] || 1;
  $("topDest").innerHTML = top.map(([n, c]) => `<li style="--w:${Math.round((c / mx) * 100)}%"><span>${esc(n)}</span><b>${c}×</b></li>`).join("") || "<li><span>–</span></li>";
}
function countUp() {
  document.querySelectorAll(".cu").forEach((el) => {
    const v = Number(el.dataset.v), d = Number(el.dataset.d || 0), f = nf(d), t0 = performance.now();
    const step = (ts) => { const k = Math.min(1, (ts - t0) / 1200), e = 1 - (1 - k) ** 3; el.textContent = f.format(v * e); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}

// ------------------------------------------------------------------ season

function raceTime(r) { return r ? Date.parse(`${r.datum}T${r.tijd || "14:00:00Z"}`) / 1000 : null; }
function renderSeason() {
  const d = S.f1;
  if (!d || (!d.laatste && !d.volgende)) { $("next").innerHTML = `<p>${esc(t("se.none"))}</p>`; $("last").hidden = true; return; }
  const n = d.volgende;
  const nk = n && d.kalender?.find((r) => r.naam === n.naam && r.datum === n.datum);
  $("next").innerHTML = n ? `<span class="eyebrow">${esc(t("se.next"))} · ${esc(t("se.round", { n: n.ronde ?? "–" }))}</span>
    <h3>${esc(n.naam)}</h3><p>${esc(n.circuit || "")}${n.plaats ? ` · ${esc(n.plaats)}` : ""}</p>
    <p style="margin-top:6px">${esc(fmtDate(raceTime(n), { weekday: "long", day: "numeric", month: "long" }))} · ${esc(fmtTime(raceTime(n)))}</p>
    <div class="count" id="count"><div><b id="cD">–</b><span>${esc(t("se.days"))}</span></div><div><b id="cH">–</b><span>${esc(t("se.hours"))}</span></div><div><b id="cM">–</b><span>${esc(t("se.min"))}</span></div><div><b id="cS">–</b><span>${esc(t("se.sec"))}</span></div></div>
    <p class="jetdist" id="jetdist" ${nk && S.jet?.lat != null ? "" : "hidden"}></p>` : `<p>${esc(t("se.none"))}</p>`;
  const l = d.laatste;
  if (l) {
    const rows = [...(l.top3 || [])].map((x, i) => ({ ...x, positie: x.positie ?? i + 1 }));
    if (l.max && !rows.some((x) => x.code === "VER" || /Verstappen/.test(x.naam))) rows.push({ ...l.max, naam: l.max.naam || "Max Verstappen" });
    $("last").innerHTML = `<span class="eyebrow">${esc(t("se.last"))} · ${esc(t("se.round", { n: l.ronde ?? "–" }))}</span>
      <h3>${esc(l.naam)}</h3><p>${esc(l.circuit || "")} · ${esc(fmtDate(raceTime(l), { weekday: "long", day: "numeric", month: "long" }))}</p>
      <ol class="podium">${rows.map((x) => `<li class="${/Verstappen/.test(x.naam) ? "max" : ""}"><b>P${esc(x.positie ?? "–")}</b>${esc(x.naam)}<span>${esc(x.team || "")}${x.punten ? ` · ${esc(t("se.points", { n: x.punten }))}` : ""}</span></li>`).join("")}</ol>`;
  } else $("last").hidden = true;
  const nt = raceTime(n);
  $("calendar").innerHTML = (d.kalender || []).map((r) => {
    const rt = raceTime(r), done = rt < now() - 3 * 3600, isNext = n && r.naam === n.naam && r.datum === n.datum;
    const spot = (S.flights || []).some((f) => (f.end && circuitAt(f.endLat, f.endLon, f.end)?.naam === r.naam) || circuitAt(f.startLat, f.startLon, f.start)?.naam === r.naam);
    return `<li class="${done ? "done" : ""}${isNext ? " next" : ""}"><span class="r">${esc(t("se.round", { n: r.ronde ?? "" }))} · ${esc(fmtDate(rt, { weekday: undefined, day: "numeric", month: "short" }))}</span>
      <b>${esc(r.naam)}</b><small>${esc(r.plaats || r.circuit || "")}</small>${spot ? `<span class="spot">✈️ ${esc(t("se.spot"))}</span>` : ""}</li>`;
  }).join("");
  // ticker
  if (n && nt > now()) {
    $("ticker").hidden = false;
    $("tkName").textContent = n.naam;
  }
  jetDist();
}
function jetDist() {
  const n = S.f1?.volgende, nk = n && S.f1.kalender?.find((r) => r.naam === n.naam && r.datum === n.datum), p = jetNow();
  const txt = nk && p ? (km(p.lat, p.lon, nk.lat, nk.lon) < 80 ? t("se.jetthere") : t("se.jetdist", { d: U.dist(km(p.lat, p.lon, nk.lat, nk.lon), true) })) : "";
  const el = $("jetdist");
  if (el) { el.textContent = txt ? `✈️ ${txt}` : ""; el.hidden = !txt; }
  $("tkDist").textContent = txt;
}
function countdown() {
  const n = S.f1?.volgende, rt = raceTime(n);
  if (!rt) return;
  const s = Math.max(0, rt - now());
  const D = Math.floor(s / 86400), H = Math.floor((s % 86400) / 3600), M = Math.floor((s % 3600) / 60), X = Math.floor(s % 60);
  if ($("cD")) { $("cD").textContent = D; $("cH").textContent = String(H).padStart(2, "0"); $("cM").textContent = String(M).padStart(2, "0"); $("cS").textContent = String(X).padStart(2, "0"); }
  $("tkCount").textContent = `${D}${lang === "nl" ? "d" : "d"} ${String(H).padStart(2, "0")}:${String(M).padStart(2, "0")}:${String(X).padStart(2, "0")}`;
}

// ------------------------------------------------------------------ chrome

function toast(msg) { const el = $("toast"); el.textContent = msg; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), 2200); }
let io = null;
function reveal() {
  io ||= new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll(".reveal:not(.in)").forEach((el) => io.observe(el));
}
function chrome() {
  const top = $("top");
  addEventListener("scroll", () => top.classList.toggle("solid", scrollY > 40), { passive: true });
  const links = [...document.querySelectorAll(".nav a")];
  const spy = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) links.forEach((a) => a.classList.toggle("on", a.getAttribute("href") === `#${e.target.id}`)); }), { rootMargin: "-45% 0px -50% 0px" });
  ["live", "vluchten", "cijfers", "seizoen", "over"].forEach((id) => spy.observe($(id)));
  $("setBtn").addEventListener("click", () => { const s = $("settings"); s.hidden = !s.hidden; $("setBtn").setAttribute("aria-expanded", String(!s.hidden)); });
  document.addEventListener("click", (e) => { if (!e.target.closest("#settings, #setBtn")) { $("settings").hidden = true; $("setBtn").setAttribute("aria-expanded", "false"); } });
  $("setTheme").value = settings.theme;
  $("setTheme").addEventListener("change", (e) => { settings.theme = e.target.value; saveSettings(); applyTheme(); });
  $("themeBtn").addEventListener("click", () => { settings.theme = themeNow() === "dark" ? "light" : "dark"; saveSettings(); $("setTheme").value = settings.theme; applyTheme(); });
  $("setUnits").value = settings.units; $("setTime").value = settings.time; $("setFollow").checked = settings.follow; $("setCircuits").checked = settings.circuits;
  $("setUnits").addEventListener("change", (e) => { settings.units = e.target.value; saveSettings(); rerender(); });
  $("setTime").addEventListener("change", (e) => { settings.time = e.target.value; saveSettings(); rerender(); });
  $("setFollow").addEventListener("change", (e) => setFollow(e.target.checked));
  $("setCircuits").addEventListener("change", (e) => { settings.circuits = e.target.checked; saveSettings(); drawCircuits(); });
  $("btnFollow").setAttribute("aria-pressed", String(settings.follow));
  $("btnFollow").addEventListener("click", () => setFollow(!settings.follow));
  $("btnFit").addEventListener("click", () => { setFollow(false); fitRoute(true); });
  $("btnStyle").addEventListener("click", () => { if (!map) return; styleIdx = (styleIdx + 1) % 3; map.mapType = STYLES()[styleIdx]; });
  $("langBtn").addEventListener("click", () => { setLang(lang === "nl" ? "en" : "nl"); location.reload(); });
  $("play").addEventListener("click", () => (playing ? stop() : play()));
  $("scrub").addEventListener("input", (e) => { stop(); setT(Number(e.target.value) / 1000); });
  document.querySelectorAll("[data-speed]").forEach((b) => b.addEventListener("click", () => {
    speed = Number(b.dataset.speed);
    document.querySelectorAll("[data-speed]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  }));
  $("thClose").addEventListener("click", () => { stop(); $("theater").hidden = true; openId = null; history.replaceState(null, "", location.pathname); document.querySelectorAll(".fcard").forEach((c) => c.classList.remove("on")); $("vluchten").scrollIntoView({ behavior: "smooth" }); });
}
function rerender() {
  lastPlaceKey = "";
  hud(); renderFlights(); renderStats(); renderSeason();
  if (openId) openFlight(openId, false);
}

// ------------------------------------------------------------------ loop

async function poll(first = false) {
  const [live, fl] = await Promise.all([get("/v1/live").catch(() => null), get(`/v1/flights?days=30&hex=${HEX}`).catch(() => null)]);
  if (live) {
    const a = (live.aircraft || []).find((x) => x.hex === HEX) || null;
    if (a && (!S.jet || a.seen !== S.jet.seen)) S.fixAt = now();
    S.jet = a;
  }
  const prevLen = S.flights?.length, prevEnd = S.flights?.[0]?.end;
  if (fl) S.flights = fl.flights || [];
  const cur = currentFlight();
  if (cur) { try { S.track = ((await get(`/v1/flights/${cur.id}/track`)).points || []).filter((p) => p.lat != null); } catch {} }
  else S.track = [];
  hud();
  liveDraw();
  if (first || prevLen !== S.flights?.length || prevEnd !== S.flights?.[0]?.end) { renderFlights(); renderStats(); }
  else if (cur) renderFlights();
  jetDist();
}

async function start() {
  applyStatic();
  applyTheme();
  chrome();
  initMap();
  S.f1 = await get("/v1/f1").catch(() => null);
  await poll(true);
  renderSeason();
  drawCircuits();
  reveal();
  const m = location.hash.match(/vlucht=(\d+)/);
  if (m) openFlight(Number(m[1]), true);
  setInterval(tick, 1000);
  setInterval(() => poll(false), (CFG.pollSeconds || 20) * 1000);
  setInterval(async () => { S.f1 = await get("/v1/f1").catch(() => S.f1); renderSeason(); drawCircuits(); }, 30 * 60 * 1000);
}
start();
