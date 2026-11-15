// MV3 – live tracker van de Falcon 8X PH-UTL. Eén kaart met een paneel: Live, Vlucht, Logboek, Cijfers, Seizoen, Info.
// Gegevens van de 112Heli-server; kaart en plaatsnamen van Apple.
import { t, lang, locale, applyStatic, setLang } from "./i18n.js?v=6";
import { AIRPORTS } from "./airports.js?v=6";

const CFG = window.MV3_CONFIG;
const API = CFG.api.replace(/\/+$/, "");
const HEX = CFG.hex;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const now = () => Date.now() / 1000;

// ------------------------------------------------------------------ settings

const SET_KEY = "mv3.settings";
const DEFAULTS = { dist: "km", speed: "kmh", alt: "m", time: "local", clock: "24", follow: true, circuits: true, theme: "auto" };
const settings = (() => {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(SET_KEY)) || {}; } catch {}
  if (s.units === "aviation") Object.assign(s, { dist: "nm", speed: "kt", alt: "ft" });
  if (s.units === "imperial") Object.assign(s, { dist: "mi", speed: "mph", alt: "ft" });
  delete s.units;
  return { ...DEFAULTS, ...s };
})();
const saveSettings = () => { try { localStorage.setItem(SET_KEY, JSON.stringify(settings)); } catch {} };

// ------------------------------------------------------------------ theme

let mk = null, map = null;
const darkMQ = matchMedia("(prefers-color-scheme: dark)");
const themeNow = () => (settings.theme === "auto" ? (darkMQ.matches ? "dark" : "light") : settings.theme);
function applyTheme() {
  const th = themeNow();
  document.documentElement.dataset.theme = th;
  document.getElementById("themeColor")?.setAttribute("content", th === "dark" ? "#07080b" : "#f4f4f1");
  if (mk && map) map.colorScheme = th === "dark" ? mk.Map.ColorSchemes.Dark : mk.Map.ColorSchemes.Light;
}
darkMQ.addEventListener?.("change", () => { if (settings.theme === "auto") applyTheme(); });

// ------------------------------------------------------------------ formatting

const nf = (d = 0) => new Intl.NumberFormat(locale(), { maximumFractionDigits: d, minimumFractionDigits: d });
const kmhLabel = () => (lang === "nl" ? "km/u" : "km/h");
const U = {
  alt(ft) {
    if (ft == null) return "–";
    return settings.alt === "m" ? `${nf().format(Math.round((ft * 0.3048) / 10) * 10)}<small>m</small>` : `${nf().format(Math.round(ft / 50) * 50)}<small>ft</small>`;
  },
  speed(kt) {
    if (kt == null) return "–";
    if (settings.speed === "kt") return `${nf().format(Math.round(kt))}<small>kt</small>`;
    if (settings.speed === "mph") return `${nf().format(Math.round(kt * 1.15078))}<small>mph</small>`;
    return `${nf().format(Math.round(kt * 1.852))}<small>${kmhLabel()}</small>`;
  },
  dist(km, plain = false) {
    if (km == null) return "–";
    const [v, u] = settings.dist === "nm" ? [km / 1.852, "nm"] : settings.dist === "mi" ? [km / 1.609344, "mi"] : [km, "km"];
    const s = nf(v < 10 ? 1 : 0).format(v);
    return plain ? `${s} ${u}` : `${s}<small>${u}</small>`;
  },
  vs(ftmin) {
    if (ftmin == null) return "–";
    const arrow = ftmin > 150 ? "↑ " : ftmin < -150 ? "↓ " : "";
    if (settings.alt === "m") return `${arrow}${nf().format(Math.round((Math.abs(ftmin) * 0.3048) / 10) * 10)}<small>m/min</small>`;
    return `${arrow}${nf().format(Math.round(Math.abs(ftmin) / 50) * 50)}<small>ft/min</small>`;
  },
  plain: (html) => html.replace(/<small>/g, " ").replace(/<\/small>/g, ""),
};
const tz = () => (settings.time === "utc" ? "UTC" : undefined);
const fmtTime = (ts) => new Date(ts * 1000).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit", hour12: settings.clock === "12", timeZone: tz() }) + (settings.time === "utc" ? " UTC" : "");
const fmtDate = (ts, o = {}) => new Date(ts * 1000).toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short", timeZone: tz(), ...o });
const fmtDur = (s) => {
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}<small>${lang === "nl" ? "u" : "h"}</small> ${String(m).padStart(2, "0")}<small>m</small>` : `${m}<small>min</small>`;
};
const clock = (s) => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
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
const latlon = (lat, lon) => `${Math.abs(lat).toFixed(3)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(3)}° ${lon >= 0 ? (lang === "nl" ? "O" : "E") : "W"}`;

// ------------------------------------------------------------------ geo

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
const angle = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const routeKm = (pts) => pts.reduce((s, p, i) => (i ? s + km(pts[i - 1].lat, pts[i - 1].lon, p.lat, p.lon) : 0), 0);

// ------------------------------------------------------------------ data

async function get(path, init) {
  const r = await fetch(API + path, { signal: AbortSignal.timeout(12000), ...init });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
const S = { jet: null, flights: null, track: [], f1: null, fixAt: 0 };
const currentFlight = () => (S.flights?.[0] && !S.flights[0].end ? S.flights[0] : null);

// ------------------------------------------------------------------ MapKit + Apple place names

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
      const k = window.mapkit;
      k.init({ language: lang, authorizationCallback: async (cb) => {
        try { const { token } = await get("/v1/mapkit-token"); cb(token); if (!done) { done = true; resolve(k); } } catch { resolve(null); }
      } });
      k.addEventListener("error", () => resolve(null));
    };
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
    setTimeout(() => resolve(window.mapkit && done ? window.mapkit : null), 15000);
  });
  return mkReady;
}
const GEO_KEY = "mv3.geo." + lang;
const geoCache = (() => { try { return JSON.parse(localStorage.getItem(GEO_KEY)) || {}; } catch { return {}; } })();
let geocoder = null, geoQueue = Promise.resolve();
function place(lat, lon) {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  if (geoCache[key]) return Promise.resolve(geoCache[key]);
  geoQueue = geoQueue.then(async () => {
    if (geoCache[key]) return geoCache[key];
    const k = await loadMapKit();
    if (!k || !k.Geocoder) return null;
    geocoder ||= new k.Geocoder({ language: lang, getsUserLocation: false });
    const r = await new Promise((res) => geocoder.reverseLookup(new k.Coordinate(lat, lon), (err, data) => res(err ? null : data?.results?.[0] || null)));
    const p = r ? { city: r.locality || r.subLocality || r.administrativeArea || r.name || null, country: r.country || null, cc: r.countryCode || null } : { sea: true };
    geoCache[key] = p;
    try { localStorage.setItem(GEO_KEY, JSON.stringify(geoCache)); } catch {}
    return p;
  }).catch(() => null);
  return geoQueue;
}
const cityName = (p, fallback) => (p?.city ? p.city : p?.sea ? t("over.sea") : (fallback || "").split(",")[0] || t("unknown"));

const JET_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true"><path fill="#ff6a13" stroke="#111" stroke-width="1.6" stroke-linejoin="round"
  d="M32 3c2.3 0 3.6 3.2 3.8 8.6l.3 11.2 19.6 12.6c.9.6 1.4 1.5 1.4 2.5v2.3l-21-6.6.4 13.4 6.6 5.1v3.6l-8.6-2.2c-.6 1.6-1.4 2.4-2.5 2.4s-1.9-.8-2.5-2.4l-8.6 2.2v-3.6l6.6-5.1.4-13.4-21 6.6v-2.3c0-1 .5-1.9 1.4-2.5l19.6-12.6.3-11.2C28.4 6.2 29.7 3 32 3z"/>
  <path fill="#2b2f38" d="M30.2 9.5h3.6l-.4 3h-2.8z"/></svg>`;
function jetElement() { const d = document.createElement("div"); d.className = "jet-pin"; d.innerHTML = JET_SVG; return d; }

// ------------------------------------------------------------------ map

let jetAnn = null, trail = null, destAnn = null, circuitAnns = [], styleIdx = 0, fitted = false;
let flightLayer = { overlays: [], anns: [], jet: null };
let tab = "live", openId = null;
const mobile = () => matchMedia("(max-width: 760px)").matches;
const pad = () => (mobile() ? new mk.Padding(80, 40, innerHeight * 0.46 + 20, 40) : new mk.Padding(90, 80, 40, 490));

async function initMap() {
  mk = await loadMapKit();
  const el = $("map");
  if (!mk) { el.innerHTML = `<div class="map-fallback">${esc(t("map.error"))}</div>`; return; }
  map = new mk.Map(el, {
    colorScheme: themeNow() === "dark" ? mk.Map.ColorSchemes.Dark : mk.Map.ColorSchemes.Light, mapType: mk.Map.MapTypes.MutedStandard,
    showsPointsOfInterest: false, showsMapTypeControl: false, showsZoomControl: false, showsUserLocationControl: false,
    showsCompass: mk.FeatureVisibility.Hidden, showsScale: mk.FeatureVisibility.Hidden, isRotationEnabled: true,
    region: new mk.CoordinateRegion(new mk.Coordinate(46, 6), new mk.CoordinateSpan(28, 40)),
  });
  map.addEventListener("scroll-start", () => { if (settings.follow) setFollow(false); });
  drawCircuits();
  liveDraw();
  if (tab === "vlucht" && openId) openFlight(openId, false);
}
function setFollow(on) {
  settings.follow = on; saveSettings();
  $("btnFollow").setAttribute("aria-pressed", String(on));
  $("setFollow").checked = on;
  if (on) centerJet(true);
}
function jetNow() {
  const a = S.jet;
  if (!a || a.lat == null) return null;
  if (!a.airborne || !a.gs) return { lat: a.lat, lon: a.lon };
  const dt = Math.min(a.oor ? 1800 : 120, Math.max(0, now() - (a.seen || S.fixAt)));
  const [lat, lon] = move(a.lat, a.lon, a.track || 0, (a.gs * 1.852 * dt) / 3600);
  return { lat, lon };
}
function liveDraw() {
  if (!map || !S.jet || S.jet.lat == null) return;
  const p = jetNow(), c = new mk.Coordinate(p.lat, p.lon);
  if (!jetAnn) { jetAnn = new mk.Annotation(c, jetElement, { calloutEnabled: false, displayPriority: 1000 }); map.addAnnotation(jetAnn); }
  else jetAnn.coordinate = c;
  const el = jetAnn.element;
  if (el) { el.classList.toggle("air", !!S.jet.airborne); const svg = el.querySelector("svg"); if (svg) svg.style.transform = `rotate(${S.jet.track || 0}deg)`; }
  if (tab === "vlucht") return; // the flight tab shows its own route
  const coords = S.track.map((q) => new mk.Coordinate(q.lat, q.lon));
  if (S.jet.airborne) coords.push(c);
  if (trail) map.removeOverlay(trail);
  trail = null;
  if (coords.length > 1) {
    trail = new mk.PolylineOverlay(coords, { style: new mk.Style({ strokeColor: "#ff6a13", lineWidth: 3.5, lineCap: "round", lineJoin: "round" }) });
    map.addOverlay(trail);
  }
  drawDestPin();
  if (!fitted) { fitted = true; fitRoute(false); }
  else if (settings.follow) centerJet(false);
}
function centerJet(animated) { const p = jetNow(); if (map && p) map.setCenterAnimated(new mk.Coordinate(p.lat, p.lon), animated); }
function fitRoute(animated = true) {
  if (!map || !S.jet) return;
  if (tab === "vlucht" && flightLayer.overlays.length) { map.showItems([flightLayer.overlays[1]], { animate: animated, padding: pad() }); return; }
  if (trail && S.jet.airborne) map.showItems([trail, jetAnn, ...(destAnn ? [destAnn] : [])], { animate: animated, padding: pad() });
  else { const p = jetNow(); map.setRegionAnimated(new mk.CoordinateRegion(new mk.Coordinate(p.lat, p.lon), new mk.CoordinateSpan(1.6, 2.4)), animated); }
}
function drawCircuits() {
  if (!map) return;
  if (circuitAnns.length) map.removeAnnotations(circuitAnns);
  circuitAnns = [];
  if (!settings.circuits || !S.f1?.kalender?.length) return;
  const next = S.f1.volgende?.naam;
  circuitAnns = S.f1.kalender.map((r) => new mk.Annotation(new mk.Coordinate(r.lat, r.lon), () => {
    const d = document.createElement("div"); d.className = `f1-pin${r.naam === next ? " next" : ""}`; d.textContent = "🏁"; d.title = `${r.naam} · ${r.circuit}`; return d;
  }, { calloutEnabled: false, title: r.naam }));
  map.addAnnotations(circuitAnns);
}

// ------------------------------------------------------------------ estimated destination

const raceTime = (r) => (r ? Date.parse(`${r.datum}T${r.tijd || "14:00:00Z"}`) / 1000 : null);
function vertical() {
  const p = S.track.filter((q) => q.alt != null && q.ts);
  if (p.length < 2) return null;
  const x = p[p.length - 2], y = p[p.length - 1], dt = (y.ts - x.ts) / 60;
  return dt > 0 && dt < 6 ? (y.alt - x.alt) / dt : null;
}
/** The airport straight ahead that fits the descent best; a race-week circuit airport and Nice weigh in. Null when there is no good guess. */
function estimateDest() {
  const a = S.jet;
  if (!a?.airborne || a.lat == null || !a.gs || a.track == null) return null;
  const p = jetNow(), vs = vertical(), gsKmh = a.gs * 1.852;
  const touch = vs != null && vs < -400 && a.alt ? (a.alt / -vs) * (gsKmh / 60) : null; // km to touchdown at this descent
  const gp = (S.f1?.kalender || []).find((r) => Math.abs(now() - raceTime(r)) < 6 * 86400);
  let best = null;
  for (const [code, name, la, lo] of AIRPORTS) {
    const d = km(p.lat, p.lon, la, lo);
    if (d < 15 || d > 9000) continue;
    const off = angle(bearing(p.lat, p.lon, la, lo), a.track);
    if (off > (d < 150 ? 35 : d < 600 ? 18 : 10)) continue;
    const nearGp = gp && km(la, lo, gp.lat, gp.lon) < 90;
    let score = off * 3 + (touch != null ? Math.abs(d - touch) / 10 : d / 150);
    if (nearGp) score -= 40;
    if (code === "NCE") score -= 8;
    if (!best || score < best.score) best = { code, name, lat: la, lon: lo, d, score, gp: nearGp ? gp : null };
  }
  if (!best) return null;
  if (touch == null && !best.gp && best.code !== "NCE" && best.d > 1500) return null; // too uncertain while cruising
  return { ...best, eta: now() + (best.d / gsKmh) * 3600 + (touch == null ? 12 * 60 : 0) };
}
function drawDest() {
  const d = estimateDest(), el = $("dest");
  if (!d) { el.hidden = true; return d; }
  el.hidden = false;
  el.innerHTML = `<span class="ic">🛬</span><div><small>${esc(t("dest.likely"))}</small><b>${esc(d.name)}</b><small>${esc(d.gp ? t("dest.gp", { gp: d.gp.naam }) : t("dest.est"))}</small></div>
    <div class="eta"><small>${esc(t("dest.eta"))}</small><b>${esc(fmtTime(d.eta).replace(" UTC", ""))}</b><small>${esc(U.dist(d.d, true))}</small></div>`;
  return d;
}
function drawDestPin() {
  if (!map) return;
  const d = tab === "vlucht" ? null : estimateDest();
  if (!d) { if (destAnn) { map.removeAnnotation(destAnn); destAnn = null; } return; }
  const c = new mk.Coordinate(d.lat, d.lon);
  if (!destAnn) {
    destAnn = new mk.Annotation(c, () => { const x = document.createElement("div"); x.className = "ap-pin dest"; x.textContent = d.name; return x; }, { calloutEnabled: false });
    map.addAnnotation(destAnn);
  } else { destAnn.coordinate = c; if (destAnn.element) destAnn.element.textContent = d.name; }
}

// ------------------------------------------------------------------ live pane

let lastPlaceKey = "";
function setTele(id, html) {
  const el = $(id);
  if (el.innerHTML !== html) { el.innerHTML = html; el.parentElement.classList.remove("flash"); void el.offsetWidth; el.parentElement.classList.add("flash"); }
}
async function live() {
  const a = S.jet, st = $("state");
  if (!a) {
    st.className = "state"; st.innerHTML = `<i></i>${esc(t("state.away"))}`;
    const f = S.flights?.[0];
    $("place").textContent = "PH-UTL";
    $("placeSub").textContent = f ? `${t("t.lastseen")}: ${fmtDate(f.end || f.start)} · ${(f.endPlace || f.startPlace || "").split(",")[0]}` : t("hero.sub");
    ["tAlt", "tGs", "tHdg", "tVs", "tSince", "tDist"].forEach((id) => ($(id).innerHTML = "–"));
    $("tPos").textContent = "–";
    $("dest").hidden = true;
    return;
  }
  const air = !!a.airborne;
  st.className = `state ${air ? "air" : "ground"}`;
  st.innerHTML = `<i></i>${esc(t(a.oor ? "state.oor" : air ? "state.air" : "state.ground"))}`;
  setTele("tAlt", air ? U.alt(a.alt) : "–");
  setTele("tGs", air ? U.speed(a.gs) : "–");
  setTele("tHdg", air ? compass(a.track) : "–");
  setTele("tVs", air && !a.oor ? U.vs(vertical()) : "–");
  $("tSinceL").textContent = t(air ? "t.since" : "t.since.ground");
  setTele("tDist", air && S.track.length > 1 ? U.dist(routeKm(S.track)) : "–");
  const p = jetNow(), key = `${p.lat.toFixed(1)},${p.lon.toFixed(1)}`;
  $("tPos").textContent = latlon(p.lat, p.lon);
  drawDest();
  miniProfile();
  const cur = currentFlight();
  if (air && cur) {
    const from = cur.startLat != null ? cityName(await place(cur.startLat, cur.startLon), cur.startPlace) : cur.startPlace || t("unknown");
    $("placeSub").textContent = `${lang === "nl" ? "Vertrokken uit" : "Departed"} ${from} · ${fmtTime(cur.start)}` + (a.oor ? ` · ${t("oor.note", { t: fmtTime(a.seen) })}` : "");
  } else if (air && a.oor) {
    $("placeSub").textContent = t("oor.note", { t: fmtTime(a.seen) });
  } else if (!air) {
    const last = S.flights?.find((f) => f.end);
    $("placeSub").textContent = last ? `${lang === "nl" ? "Geland" : "Landed"} ${fmtDate(last.end)} · ${fmtTime(last.end)}` : t("hero.sub");
  }
  if (key !== lastPlaceKey) {
    lastPlaceKey = key;
    const g = await place(p.lat, p.lon);
    const fb = a.boven || a.plek, name = g?.city || (fb ? fb.split(",")[0] : null);
    $("place").textContent = g?.sea && air ? t("over.sea") : name ? (air ? t("above", { p: name }) : t("at", { p: name })) : "PH-UTL";
    if (g?.cc && name) $("place").textContent += ` ${flag(g.cc)}`;
  }
}
function miniProfile() {
  const el = $("hudProfile"), p = S.track.filter((q) => q.alt != null && q.ts);
  if (!S.jet?.airborne || p.length < 3) { el.hidden = true; return; }
  el.hidden = false;
  const maxA = Math.max(...p.map((q) => q.alt), 1000), t0 = p[0].ts, t1 = p[p.length - 1].ts || t0 + 1;
  const pts = p.map((q) => `${((q.ts - t0) / (t1 - t0)) * 400},${56 - (q.alt / maxA) * 50}`).join(" ");
  el.innerHTML = `<div class="lbl"><span>${esc(t("th.legendAlt"))}</span><span>${U.plain(U.alt(maxA))} max</span></div>
    <svg viewBox="0 0 400 56" preserveAspectRatio="none"><defs><linearGradient id="hg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ff6a13" stop-opacity=".5"/><stop offset="1" stop-color="#ff6a13" stop-opacity="0"/></linearGradient></defs>
    <polygon points="0,56 ${pts} 400,56" fill="url(#hg)"/><polyline points="${pts}" fill="none" stroke="#ff8a3d" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
}
function gpStrip() {
  const n = S.f1?.volgende, el = $("gpStrip"), rt = raceTime(n);
  if (!n || !rt || rt < now()) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<div><span class="l">${esc(t("tk.next"))}</span><b>${esc(n.naam)}</b><small id="gpDist"></small></div><span class="cd" id="gpCd"></span>`;
  el.onclick = () => setTab("seizoen");
}

// ------------------------------------------------------------------ log

function circuitAt(lat, lon, ts) {
  if (lat == null || !S.f1?.kalender) return null;
  for (const r of S.f1.kalender) if (Math.abs(ts - raceTime(r)) / 86400 <= 6 && km(lat, lon, r.lat, r.lon) <= 80) return r;
  return null;
}
const nearMonaco = (lat, lon) => lat != null && km(lat, lon, 43.7347, 7.4206) <= 35;
function miniArc(f) {
  const bLat = f.end ? f.endLat : S.jet?.lat, bLon = f.end ? f.endLon : S.jet?.lon;
  if (f.startLat == null || bLat == null) return `<svg viewBox="0 0 54 34"></svg>`;
  const d = km(f.startLat, f.startLon, bLat, bLon), b = bearing(f.startLat, f.startLon, bLat, bLon);
  const pts = Array.from({ length: 17 }, (_, i) => move(f.startLat, f.startLon, b, (d * i) / 16));
  const k = Math.cos(((f.startLat + bLat) / 2) * RAD), xs = pts.map((q) => q[1] * k), ys = pts.map((q) => -q[0]);
  const w = Math.max(Math.max(...xs) - Math.min(...xs), (Math.max(...ys) - Math.min(...ys)) * 1.6, 0.2), s = 42 / w;
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const P = xs.map((x, i) => [27 + (x - cx) * s, 17 + (ys[i] - cy) * s]);
  return `<svg viewBox="0 0 54 34" aria-hidden="true"><path d="${P.map((q, i) => `${i ? "L" : "M"}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join("")}" fill="none" stroke="#ff6a13" stroke-width="2" stroke-linecap="round" ${f.end ? "" : 'stroke-dasharray="3 3"'}/>
    <circle cx="${P[0][0]}" cy="${P[0][1]}" r="2.6" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="${P[16][0]}" cy="${P[16][1]}" r="3" fill="#ff6a13"/></svg>`;
}
function renderLog() {
  const el = $("log");
  if (!S.flights) { el.innerHTML = `<li class="muted">${esc(t("fl.error"))}</li>`; return; }
  if (!S.flights.length) { el.innerHTML = `<li class="muted">${esc(t("fl.none"))}</li>`; $("logSum").textContent = ""; return; }
  const secs = S.flights.reduce((s, f) => s + ((f.end || now()) - f.start), 0);
  $("logSum").textContent = t("log.sum", { n: S.flights.length, h: U.plain(fmtDur(secs)) });
  el.innerHTML = S.flights.slice(0, 60).map((f) => {
    const c = circuitAt(f.endLat, f.endLon, f.end || f.start) || circuitAt(f.startLat, f.startLon, f.start);
    const home = !c && f.end && nearMonaco(f.endLat, f.endLon);
    return `<li><button data-id="${f.id}" class="${openId === f.id ? "on" : ""}">${miniArc(f)}
      <div><div class="r"><span data-geo="${f.startLat},${f.startLon}">${esc((f.startPlace || t("unknown")).split(",")[0])}</span><i>→</i><span ${f.end ? `data-geo="${f.endLat},${f.endLon}"` : ""}>${f.end ? esc((f.endPlace || t("unknown")).split(",")[0]) : "…"}</span></div>
      <div class="w">${esc(fmtDate(f.start))} · ${esc(fmtTime(f.start))}${c ? ` · 🏁 ${esc(c.naam.replace(" Grand Prix", " GP"))}` : home ? " · 🏠 Monaco" : ""}</div></div>
      <div class="d">${f.end ? U.plain(fmtDur(f.end - f.start)) : `<span class="lv">● ${esc(t("fl.live"))}</span>`}</div></button></li>`;
  }).join("");
  el.querySelectorAll("button[data-id]").forEach((b) => b.addEventListener("click", () => openFlight(Number(b.dataset.id), true)));
  for (const span of el.querySelectorAll("[data-geo]")) {
    const [la, lo] = span.dataset.geo.split(",").map(Number);
    if (Number.isFinite(la)) place(la, lo).then((g) => { if (g?.city) span.textContent = `${g.city} ${flag(g.cc)}`.trim(); });
  }
}

// ------------------------------------------------------------------ flight pane + replay on the main map

let thPts = [], thFlight = null, playing = false, speed = 240, tRel = 0, lastFrame = 0;

function clearFlightLayer() {
  if (!map) return;
  if (flightLayer.overlays.length) map.removeOverlays(flightLayer.overlays);
  if (flightLayer.anns.length) map.removeAnnotations(flightLayer.anns);
  if (flightLayer.jet) map.removeAnnotation(flightLayer.jet);
  flightLayer = { overlays: [], anns: [], jet: null };
}

async function openFlight(id, switchTab) {
  const f = S.flights?.find((x) => x.id === id);
  if (!f) return;
  openId = id; thFlight = f;
  if (switchTab) setTab("vlucht", true);
  document.querySelectorAll(".log button").forEach((b) => b.classList.toggle("on", Number(b.dataset.id) === id));
  history.replaceState(null, "", `#vlucht=${id}`);
  stop();
  const box = $("flight");
  box.innerHTML = `<div class="skeleton"></div>`;
  let pts = [];
  try { pts = ((await get(`/v1/flights/${id}/track`)).points || []).filter((p) => p.lat != null && p.ts); } catch {}
  if (!f.end && S.jet?.lat != null) pts.push({ ts: S.jet.seen || now(), lat: S.jet.lat, lon: S.jet.lon, alt: S.jet.alt, gs: S.jet.gs, track: S.jet.track });
  thPts = pts;
  const [gA, gB] = await Promise.all([f.startLat != null ? place(f.startLat, f.startLon) : null, f.end && f.endLat != null ? place(f.endLat, f.endLon) : null]);
  const from = cityName(gA, f.startPlace), to = f.end ? cityName(gB, f.endPlace) : "…";
  const c = circuitAt(f.endLat, f.endLon, f.end || f.start), c2 = circuitAt(f.startLat, f.startLon, f.start);
  const tag = c && f.end ? `🏁 ${t("th.landedAt", { c: c.circuit, gp: c.naam })}` : c2 ? `🏁 ${t("th.departedAt", { c: c2.circuit, gp: c2.naam })}` : f.end && nearMonaco(f.endLat, f.endLon) ? `🏠 ${t("th.home")}` : "";
  const end = f.end || (pts.length ? pts[pts.length - 1].ts : now());
  const dist = pts.length > 1 ? routeKm(pts) : null;
  const maxAlt = Math.max(0, ...pts.map((p) => p.alt || 0)), maxGs = Math.max(0, ...pts.map((p) => p.gs || 0));
  const avgKt = dist && end > f.start ? dist / 1.852 / ((end - f.start) / 3600) : null;
  const url = `${location.origin}/#vlucht=${f.id}`, text = `✈️ PH-UTL: ${from} → ${to} (${fmtDate(f.start)})`;
  box.innerHTML = `
    <div class="fl-when">${esc(t("th.flight"))} · ${esc(fmtDate(f.start, { weekday: "long", day: "numeric", month: "long" }))}</div>
    <h2 class="fl-route">${esc(from)} ${flag(gA?.cc)} <i>→</i> ${esc(to)} ${f.end ? flag(gB?.cc) : ""}</h2>
    ${tag ? `<span class="tag">${esc(tag)}</span>` : ""}
    <div class="share"><button class="chip" id="cp">${esc(t("share.copy"))}</button>
      <a class="chip" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}">WhatsApp</a>
      <a class="chip" target="_blank" rel="noopener" href="https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}">X</a></div>
    <div class="player">
      <button class="play" id="play" aria-label="Afspelen"><svg viewBox="0 0 24 24" aria-hidden="true"><path id="playIcon" d="M7 4.5v15l13-7.5z"/></svg></button>
      <div class="scrub"><input type="range" id="scrub" min="0" max="1000" value="0" aria-label="Tijdlijn">
        <div class="scrub-read"><b id="rdTime">–</b><span id="rdAlt">–</span><span id="rdGs">–</span><span id="rdHdg">–</span></div>
        <div class="speeds" role="group" aria-label="Afspeelsnelheid">${[60, 240, 900].map((v) => `<button data-speed="${v}" aria-pressed="${v === speed}">${v}×</button>`).join("")}</div></div>
    </div>
    <div class="profile" id="profile"></div>
    <div class="facts">${[
      [t("th.dep"), fmtTime(f.start), from], [f.end ? t("th.arr") : t("th.now"), fmtTime(end), f.end ? to : t("th.ongoing")], [t("th.dur"), fmtDur(end - f.start), ""],
      [t("th.dist"), dist ? U.dist(dist) : "–", t("th.route")], [t("th.maxalt"), maxAlt ? U.alt(maxAlt) : "–", ""],
      [t("th.avg"), avgKt ? U.speed(avgKt) : "–", maxGs ? t("th.maxgs", { v: U.plain(U.speed(maxGs)) }) : ""],
    ].map(([k, v, s]) => `<div class="fact"><span>${esc(k)}</span><b>${v}</b><small>${esc(s)}</small></div>`).join("")}</div>`;
  $("cp").onclick = async () => { try { await navigator.clipboard.writeText(url); toast(t("share.copied")); } catch { prompt(t("share.copy"), url); } };
  $("play").onclick = () => (playing ? stop() : play());
  $("scrub").oninput = (e) => { stop(); setT(Number(e.target.value) / 1000); };
  box.querySelectorAll("[data-speed]").forEach((b) => (b.onclick = () => { speed = Number(b.dataset.speed); box.querySelectorAll("[data-speed]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); }));
  profileChart(pts);
  flightOnMap(f, pts);
  setT(0);
}

function flightOnMap(f, pts) {
  if (!map || tab !== "vlucht") return;
  clearFlightLayer();
  if (trail) { map.removeOverlay(trail); trail = null; }
  if (destAnn) { map.removeAnnotation(destAnn); destAnn = null; }
  if (pts.length < 2) return;
  const coords = pts.map((p) => new mk.Coordinate(p.lat, p.lon));
  const casing = new mk.PolylineOverlay(coords, { style: new mk.Style({ strokeColor: "#ff6a13", strokeOpacity: 0.22, lineWidth: 12, lineCap: "round", lineJoin: "round" }) });
  const line = new mk.PolylineOverlay(coords, { style: new mk.Style({ strokeColor: "#ff6a13", lineWidth: 3.5, lineCap: "round", lineJoin: "round" }) });
  flightLayer.overlays = [casing, line];
  map.addOverlays(flightLayer.overlays);
  const pin = (p, label, cls) => new mk.Annotation(new mk.Coordinate(p.lat, p.lon), () => { const d = document.createElement("div"); d.className = `ap-pin ${cls}`; d.textContent = label; return d; }, { calloutEnabled: false });
  flightLayer.anns = [pin(pts[0], t("th.dep"), "start")];
  if (f.end) flightLayer.anns.push(pin(pts[pts.length - 1], t("th.arr"), "end"));
  map.addAnnotations(flightLayer.anns);
  flightLayer.jet = new mk.Annotation(coords[0], jetElement, { calloutEnabled: false, displayPriority: 1001 });
  map.addAnnotation(flightLayer.jet);
  if (settings.follow) { settings.follow = false; $("btnFollow").setAttribute("aria-pressed", "false"); $("setFollow").checked = false; }
  map.showItems([line], { animate: true, padding: pad() });
}

let CW = 1000;
const CH = 170, PL = 44, PR = 50, PT = 10, PB = 24;
function niceMax(v) { const e = 10 ** Math.floor(Math.log10(Math.max(v, 1))), n = v / e; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * e; }
function profileChart(pts) {
  const el = $("profile");
  CW = Math.max(280, Math.round(el.clientWidth - 8));
  if (pts.length < 2) { el.innerHTML = `<p class="muted" style="padding:14px">${esc(t("th.few"))}</p>`; return; }
  const t0 = pts[0].ts, t1 = pts[pts.length - 1].ts || t0 + 1;
  const altU = settings.alt === "m" ? 0.3048 : 1, gsU = settings.speed === "kmh" ? 1.852 : settings.speed === "mph" ? 1.15078 : 1;
  const yA = niceMax(Math.max(...pts.map((p) => (p.alt || 0) * altU))), yG = niceMax(Math.max(...pts.map((p) => (p.gs || 0) * gsU)));
  const x = (tt) => PL + ((tt - t0) / (t1 - t0)) * (CW - PL - PR);
  const ya = (v) => PT + (1 - v / yA) * (CH - PT - PB), yg = (v) => PT + (1 - v / yG) * (CH - PT - PB);
  const area = `M${x(t0)},${ya(0)} ` + pts.map((p) => `L${x(p.ts).toFixed(1)},${ya((p.alt || 0) * altU).toFixed(1)}`).join(" ") + ` L${x(t1)},${ya(0)}Z`;
  const gs = pts.filter((p) => p.gs != null).map((p, i) => `${i ? "L" : "M"}${x(p.ts).toFixed(1)},${yg(p.gs * gsU).toFixed(1)}`).join(" ");
  const f = nf();
  const grid = [0, 0.5, 1].map((k) => { const yy = PT + (1 - k) * (CH - PT - PB); return `<line x1="${PL}" x2="${CW - PR}" y1="${yy}" y2="${yy}" class="g"/><text x="${PL - 6}" y="${yy + 4}" class="ax ax-l">${f.format(yA * k)}</text><text x="${CW - PR + 6}" y="${yy + 4}" class="ax ax-r">${f.format(yG * k)}</text>`; }).join("");
  const xt = Array.from({ length: 4 }, (_, i) => t0 + ((t1 - t0) * i) / 3).map((tt) => `<text x="${x(tt)}" y="${CH - 6}" class="ax" text-anchor="middle">${fmtTime(tt).replace(" UTC", "")}</text>`).join("");
  const ua = settings.alt, ug = settings.speed === "kmh" ? kmhLabel() : settings.speed;
  el.innerHTML = `<div class="legend"><span><i style="background:#ff8a3d"></i>${esc(t("th.legendAlt"))} (${ua})</span><span><i style="background:#6f88ff"></i>${esc(t("th.legendGs"))} (${ug})</span></div>
    <svg viewBox="0 0 ${CW} ${CH}" role="img" aria-label="${esc(t("th.legendAlt"))} / ${esc(t("th.legendGs"))}">
    <defs><linearGradient id="pa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6a13" stop-opacity=".55"/><stop offset="1" stop-color="#ff6a13" stop-opacity=".03"/></linearGradient></defs>
    ${grid}<path d="${area}" fill="url(#pa)" stroke="#ff8a3d" stroke-width="2" vector-effect="non-scaling-stroke"/><path d="${gs}" fill="none" stroke="#6f88ff" stroke-width="2" vector-effect="non-scaling-stroke"/>${xt}
    <line id="cur" class="cur" x1="${PL}" x2="${PL}" y1="${PT}" y2="${CH - PB}" vector-effect="non-scaling-stroke"/></svg>`;
  const svg = el.querySelector("svg");
  const seek = (cx) => { const r = svg.getBoundingClientRect(); setT(Math.min(1, Math.max(0, (((cx - r.left) / r.width) * CW - PL) / (CW - PL - PR)))); };
  let drag = false;
  svg.addEventListener("pointerdown", (e) => { drag = true; stop(); seek(e.clientX); });
  addEventListener("pointerup", () => (drag = false));
  svg.addEventListener("pointermove", (e) => { if (drag || e.pointerType === "mouse") seek(e.clientX); });
}
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
  const q = at(r), sc = $("scrub");
  if (!sc) return;
  sc.value = String(Math.round(r * 1000));
  if (!q) return;
  $("rdTime").textContent = fmtTime(q.ts);
  $("rdAlt").innerHTML = U.plain(U.alt(q.alt)); $("rdGs").innerHTML = U.plain(U.speed(q.gs)); $("rdHdg").innerHTML = U.plain(compass(q.track));
  const cur = document.getElementById("cur");
  if (cur) { const xx = PL + r * (CW - PL - PR); cur.setAttribute("x1", xx); cur.setAttribute("x2", xx); }
  if (flightLayer.jet && mk) {
    flightLayer.jet.coordinate = new mk.Coordinate(q.lat, q.lon);
    const svg = flightLayer.jet.element?.querySelector("svg");
    if (svg) svg.style.transform = `rotate(${q.track || 0}deg)`;
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
function play() { if (thPts.length < 2) return; if (tRel >= 1) setT(0); playing = true; lastFrame = 0; $("playIcon")?.setAttribute("d", "M6 4h4v16H6zM14 4h4v16h-4z"); requestAnimationFrame(frame); }
function stop() { playing = false; $("playIcon")?.setAttribute("d", "M7 4.5v15l13-7.5z"); }

// ------------------------------------------------------------------ stats

async function renderStats() {
  const fl = (S.flights || []).filter((f) => f.startLat != null), done = fl.filter((f) => f.end);
  const secs = fl.reduce((s, f) => s + ((f.end || now()) - f.start), 0);
  const dist = done.reduce((s, f) => s + km(f.startLat, f.startLon, f.endLat, f.endLon), 0);
  const longest = done.reduce((m, f) => (f.end - f.start > (m ? m.end - m.start : 0) ? f : m), null);
  $("bigstats").innerHTML = `
    <div class="big"><b>${fl.length}</b><span>${esc(t("st.flights"))}</span>${fl.length ? `<em>${esc(t("st.avg", { d: U.plain(fmtDur(secs / fl.length)) }))}</em>` : ""}</div>
    <div class="big"><b>${nf(1).format(secs / 3600)}</b><span>${esc(t("st.hours"))}</span></div>
    <div class="big"><b><small style="margin:0 .1em 0 0">≈</small>${U.dist(dist)}</b><span>${esc(t("st.dist"))}</span>${dist > 4000 ? `<em>${esc(t("st.earth", { n: nf(1).format(dist / 40075) }))}</em>` : ""}</div>
    <div class="big"><b>${longest ? fmtDur(longest.end - longest.start) : "–"}</b><span>${esc(t("st.longest"))}</span>${longest ? `<em>${esc((longest.startPlace || "").split(",")[0])} → ${esc((longest.endPlace || "").split(",")[0])}</em>` : ""}</div>`;
  const days = Array.from({ length: 30 }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - 29 + i); return d; });
  const per = days.map((d) => { const a = d.getTime() / 1000, b = a + 86400; return fl.reduce((s, f) => s + Math.max(0, Math.min(b, f.end || now()) - Math.max(a, f.start)), 0) / 3600; });
  const maxH = Math.max(...per, 1);
  $("heat").innerHTML = days.map((d, i) => `<div ${per[i] ? `data-h style="--a:${(0.25 + (0.75 * per[i]) / maxH).toFixed(2)}"` : ""} class="${i === 29 ? "today" : ""}" title="${esc(d.toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short" }))}: ${per[i] ? nf(1).format(per[i]) + " h" : "–"}"></div>`).join("");
  const cc = new Map(), count = new Map();
  for (const f of fl) {
    for (const [la, lo, fb] of [[f.startLat, f.startLon, f.startPlace], [f.endLat, f.endLon, f.endPlace]]) {
      if (la == null) continue;
      const g = await place(la, lo);
      if (g?.cc) cc.set(g.cc, g.country);
      else if (fb && fb.includes(",")) { const land = fb.split(",").pop().trim(); cc.set(land, land); }
      else if (fb && km(la, lo, 52.2, 5.4) < 200) cc.set("NL", t("ac.nl"));
    }
    if (f.end) { const n = cityName(await place(f.endLat, f.endLon), f.endPlace); count.set(n, (count.get(n) || 0) + 1); }
  }
  $("countries").innerHTML = cc.size ? [...cc].map(([c, n]) => `<span>${c.length === 2 ? flag(c) + " " : ""}${esc(n)}</span>`).join("") : `<span>–</span>`;
  const top = [...count].sort((a, b) => b[1] - a[1]).slice(0, 5), mx = top[0]?.[1] || 1;
  $("topDest").innerHTML = top.map(([n, c]) => `<li style="--w:${Math.round((c / mx) * 100)}%"><span>${esc(n)}</span><b>${c}×</b></li>`).join("") || "<li><span>–</span></li>";
}

// ------------------------------------------------------------------ season

function renderSeason() {
  const d = S.f1;
  if (!d || (!d.laatste && !d.volgende)) { $("next").innerHTML = `<p>${esc(t("se.none"))}</p>`; $("last").hidden = true; return; }
  const n = d.volgende;
  $("next").innerHTML = n ? `<span class="l">${esc(t("se.next"))} · ${esc(t("se.round", { n: n.ronde ?? "–" }))}</span>
    <h4>${esc(n.naam)}</h4><p>${esc(n.circuit || "")}${n.plaats ? ` · ${esc(n.plaats)}` : ""}</p>
    <p>${esc(fmtDate(raceTime(n), { weekday: "long", day: "numeric", month: "long" }))} · ${esc(fmtTime(raceTime(n)))}</p>
    <div class="count"><div><b id="cD">–</b><span>${esc(t("se.days"))}</span></div><div><b id="cH">–</b><span>${esc(t("se.hours"))}</span></div><div><b id="cM">–</b><span>${esc(t("se.min"))}</span></div><div><b id="cS">–</b><span>${esc(t("se.sec"))}</span></div></div>
    <p class="jetdist" id="jetdist" hidden></p>` : `<p>${esc(t("se.none"))}</p>`;
  const l = d.laatste;
  if (l) {
    const rows = [...(l.top3 || [])].map((x, i) => ({ ...x, positie: x.positie ?? i + 1 }));
    if (l.max && !rows.some((x) => /Verstappen/.test(x.naam || ""))) rows.push({ ...l.max, naam: l.max.naam || "Max Verstappen" });
    $("last").hidden = false;
    $("last").innerHTML = `<span class="l">${esc(t("se.last"))} · ${esc(t("se.round", { n: l.ronde ?? "–" }))}</span><h4>${esc(l.naam)}</h4>
      <p>${esc(l.circuit || "")} · ${esc(fmtDate(raceTime(l), { weekday: "long", day: "numeric", month: "long" }))}</p>
      <ol class="podium">${rows.map((x) => `<li class="${/Verstappen/.test(x.naam || "") ? "max" : ""}"><b>P${esc(x.positie ?? "–")}</b>${esc(x.naam)}<span>${esc(x.team || "")}${x.punten ? ` · ${esc(t("se.points", { n: x.punten }))}` : ""}</span></li>`).join("")}</ol>`;
  } else $("last").hidden = true;
  $("calendar").innerHTML = (d.kalender || []).map((r, i) => {
    const rt = raceTime(r), done = rt < now() - 3 * 3600, isNext = n && r.naam === n.naam && r.datum === n.datum;
    const spot = (S.flights || []).some((f) => (f.end && circuitAt(f.endLat, f.endLon, f.end)?.naam === r.naam) || circuitAt(f.startLat, f.startLon, f.start)?.naam === r.naam);
    return `<li><button data-i="${i}" class="${done ? "done" : ""}${isNext ? " nx" : ""}"><span class="rd">R${esc(r.ronde ?? i + 1)}</span>
      <span><b>${esc(r.naam)}</b><small>${esc(r.plaats || r.circuit || "")}</small>${spot ? `<span class="spot">✈️ ${esc(t("se.spot"))}</span>` : ""}</span>
      <span class="dt">${esc(fmtDate(rt, { weekday: undefined, day: "numeric", month: "short" }))}</span></button></li>`;
  }).join("");
  $("calendar").querySelectorAll("button[data-i]").forEach((b) => (b.onclick = () => {
    const r = d.kalender[Number(b.dataset.i)];
    if (map && r) { setFollow(false); map.setRegionAnimated(new mk.CoordinateRegion(new mk.Coordinate(r.lat, r.lon), new mk.CoordinateSpan(0.4, 0.6)), true); if (mobile()) sheet("min"); }
  }));
  gpStrip();
  jetDist();
}
function jetDist() {
  const n = S.f1?.volgende, nk = n && S.f1.kalender?.find((r) => r.naam === n.naam && r.datum === n.datum), p = jetNow();
  const txt = nk && p ? (km(p.lat, p.lon, nk.lat, nk.lon) < 80 ? t("se.jetthere") : t("se.jetdist", { d: U.dist(km(p.lat, p.lon, nk.lat, nk.lon), true) })) : "";
  const el = $("jetdist"); if (el) { el.textContent = txt ? `✈️ ${txt}` : ""; el.hidden = !txt; }
  const g = $("gpDist"); if (g) g.textContent = txt;
}
function countdown() {
  const rt = raceTime(S.f1?.volgende);
  if (!rt) return;
  const s = Math.max(0, rt - now());
  const D = Math.floor(s / 86400), H = Math.floor((s % 86400) / 3600), M = Math.floor((s % 3600) / 60), X = Math.floor(s % 60);
  if ($("cD")) { $("cD").textContent = D; $("cH").textContent = String(H).padStart(2, "0"); $("cM").textContent = String(M).padStart(2, "0"); $("cS").textContent = String(X).padStart(2, "0"); }
  const cd = $("gpCd"); if (cd) cd.textContent = `${D}d ${String(H).padStart(2, "0")}:${String(M).padStart(2, "0")}:${String(X).padStart(2, "0")}`;
}

// ------------------------------------------------------------------ live viewers (anonymous id per tab, nothing else is sent)

const VIEW_ID = (() => { try { let v = sessionStorage.getItem("mv3.vid"); if (!v) { v = crypto.randomUUID(); sessionStorage.setItem("mv3.vid", v); } return v; } catch { return crypto.randomUUID(); } })();
async function viewers() {
  if (document.hidden) return;
  try {
    const r = await get("/v1/kijkers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ site: "mv3", id: VIEW_ID }) });
    if (typeof r.nu !== "number") return;
    const el = $("viewers");
    el.hidden = false;
    el.title = t("viewers.title");
    $("vCount").textContent = nf().format(r.nu);
    el.querySelector("span").textContent = t(r.nu === 1 ? "viewers.one" : "viewers");
  } catch {}
}

// ------------------------------------------------------------------ tabs, sheet, chrome

function setTab(name, keepHash) {
  tab = name;
  document.querySelectorAll(".tabs [data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === name)));
  document.querySelectorAll(".pane").forEach((p) => (p.hidden = p.id !== `pane-${name}`));
  if (name !== "vlucht") {
    stop(); clearFlightLayer();
    if (!keepHash) history.replaceState(null, "", name === "live" ? location.pathname : `#${name}`);
    liveDraw();
  } else if (!openId && S.flights?.length) openFlight(S.flights[0].id, false);
  else if (openId && thFlight && map && !flightLayer.overlays.length) flightOnMap(thFlight, thPts);
  if (mobile() && $("app").classList.contains("sheet-min")) sheet("half");
}
function sheet(state) {
  const app = $("app");
  app.classList.toggle("sheet-full", state === "full");
  app.classList.toggle("sheet-min", state === "min");
}
function toast(msg) { const el = $("toast"); el.textContent = msg; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), 2200); }
function chrome() {
  document.querySelectorAll(".tabs [data-tab]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));
  let y0 = null, h0 = 0, dragged = false;
  const grip = $("grip");
  grip.addEventListener("pointerdown", (e) => { y0 = e.clientY; h0 = $("panel").getBoundingClientRect().height; dragged = false; });
  addEventListener("pointerup", (e) => {
    if (y0 == null) return;
    const dy = e.clientY - y0; y0 = null;
    if (Math.abs(dy) < 30) return;
    dragged = true;
    const h = h0 - dy;
    sheet(h > innerHeight * 0.66 ? "full" : h < innerHeight * 0.3 ? "min" : "half");
  });
  grip.addEventListener("click", () => { if (dragged) return; const a = $("app"); sheet(a.classList.contains("sheet-min") ? "half" : a.classList.contains("sheet-full") ? "min" : "full"); });
  $("setBtn").addEventListener("click", () => { const s = $("settings"); s.hidden = !s.hidden; $("setBtn").setAttribute("aria-expanded", String(!s.hidden)); });
  document.addEventListener("click", (e) => { if (!e.target.closest("#settings, #setBtn")) { $("settings").hidden = true; $("setBtn").setAttribute("aria-expanded", "false"); } });
  const sel = { setTheme: "theme", setDist: "dist", setSpeed: "speed", setAlt: "alt", setTime: "time", setClock: "clock" };
  const sync = () => { for (const [id, k] of Object.entries(sel)) $(id).value = settings[k]; $("setFollow").checked = settings.follow; $("setCircuits").checked = settings.circuits; $("btnFollow").setAttribute("aria-pressed", String(settings.follow)); };
  sync();
  for (const [id, k] of Object.entries(sel)) $(id).addEventListener("change", (e) => { settings[k] = e.target.value; saveSettings(); if (k === "theme") applyTheme(); else rerender(); });
  $("setFollow").addEventListener("change", (e) => setFollow(e.target.checked));
  $("setCircuits").addEventListener("change", (e) => { settings.circuits = e.target.checked; saveSettings(); drawCircuits(); });
  $("setReset").addEventListener("click", () => { Object.assign(settings, DEFAULTS); saveSettings(); sync(); applyTheme(); rerender(); drawCircuits(); });
  $("themeBtn").addEventListener("click", () => { settings.theme = themeNow() === "dark" ? "light" : "dark"; saveSettings(); $("setTheme").value = settings.theme; applyTheme(); });
  $("langBtn").addEventListener("click", () => { setLang(lang === "nl" ? "en" : "nl"); location.reload(); });
  $("shareBtn").addEventListener("click", async () => {
    const url = tab === "vlucht" && openId ? `${location.origin}/#vlucht=${openId}` : `${location.origin}/`;
    if (navigator.share) { try { await navigator.share({ title: "MV3", text: t("share.live"), url }); } catch {} return; }
    try { await navigator.clipboard.writeText(url); toast(t("share.copied")); } catch { prompt(t("share.copy"), url); }
  });
  $("btnFollow").addEventListener("click", () => setFollow(!settings.follow));
  $("btnFit").addEventListener("click", () => { setFollow(false); fitRoute(true); });
  $("btnNorth").addEventListener("click", () => { if (!map) return; if (map.setRotationAnimated) map.setRotationAnimated(0, true); else map.rotation = 0; });
  $("btnStyle").addEventListener("click", () => { if (!map) return; styleIdx = (styleIdx + 1) % 3; map.mapType = [mk.Map.MapTypes.MutedStandard, mk.Map.MapTypes.Hybrid, mk.Map.MapTypes.Satellite][styleIdx]; });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { poll(false); viewers(); } });
}
function rerender() {
  lastPlaceKey = "";
  live(); renderLog(); renderStats(); renderSeason();
  if (openId && tab === "vlucht") openFlight(openId, false);
}

// ------------------------------------------------------------------ loop

async function poll(first = false) {
  const [lv, fl] = await Promise.all([get("/v1/live").catch(() => null), get(`/v1/flights?days=30&hex=${HEX}`).catch(() => null)]);
  if (lv) {
    const a = (lv.aircraft || []).find((x) => x.hex === HEX) || null;
    if (a && (!S.jet || a.seen !== S.jet.seen)) S.fixAt = now();
    // Above the ocean there are no ADS-B receivers: the server then calls the jet "not airborne" because it is no
    // longer seen. A last known speed above 80 kt means it is still flying, just out of coverage.
    if (a && !a.airborne && a.stale && a.gs > 80 && a.seen && now() - a.seen < 13 * 3600) { a.airborne = true; a.oor = true; }
    S.jet = a;
  }
  const prev = `${S.flights?.length}|${S.flights?.[0]?.end}`;
  if (fl) S.flights = fl.flights || [];
  const cur = currentFlight();
  if (cur) { try { S.track = ((await get(`/v1/flights/${cur.id}/track`)).points || []).filter((p) => p.lat != null); } catch {} } else S.track = [];
  const changed = prev !== `${S.flights?.length}|${S.flights?.[0]?.end}`;
  live();
  liveDraw();
  if (first || changed || cur) renderLog();
  if (first || changed) renderStats();
  jetDist();
}
function tick() {
  const a = S.jet;
  $("ago").textContent = a?.seen ? ago(a.seen) : "";
  $("tSince").innerHTML = a?.since ? clock(now() - a.since) : "–";
  if (a?.airborne) { liveDraw(); const p = jetNow(); if (p) $("tPos").textContent = latlon(p.lat, p.lon); }
  countdown();
}

async function start() {
  applyStatic();
  applyTheme();
  chrome();
  const m = location.hash.match(/vlucht=(\d+)/), h = location.hash.replace("#", "");
  if (m) { openId = Number(m[1]); tab = "vlucht"; }
  initMap();
  S.f1 = await get("/v1/f1").catch(() => null);
  await poll(true);
  renderSeason();
  drawCircuits();
  if (m) { setTab("vlucht", true); openFlight(openId, false); }
  else if (["log", "cijfers", "seizoen", "info"].includes(h)) setTab(h, true);
  else setTab("live", true);
  viewers();
  setInterval(tick, 1000);
  setInterval(() => poll(false), (CFG.pollSeconds || 20) * 1000);
  setInterval(viewers, 30000);
  setInterval(async () => { S.f1 = await get("/v1/f1").catch(() => S.f1); renderSeason(); drawCircuits(); }, 30 * 60 * 1000);
}
start();

// PWA: install as an app; works offline with the last known data.
if ("serviceWorker" in navigator && location.protocol === "https:") addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
