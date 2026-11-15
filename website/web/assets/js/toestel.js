// Eén toestel: status en cijfers, tabbladen Live / Laatste vlucht / Logboek, per vlucht de route op Apple Kaarten,
// vluchtdetails, een vluchtprofiel (hoogte en snelheid) en delen. Voor Max Verstappen ook de F1-circuits en de GP.
import { initChrome, fetchLive, fetchTrack, fetchFlights, soort, drawing, esc, placeText, alt, speed, heading, age, ageOf, isOld,
  STATUS, statusOf, dateTime, time, loadMapKit, NL_REGION, markerElement, API } from "./core.js";
import { laadF1, kalender, circuitBij, isMax } from "./f1.js";

initChrome();
const params = new URLSearchParams(location.search);
const hex = (params.get("hex") || "").toLowerCase();
const root = document.getElementById("toestel");
const nf = new Intl.NumberFormat("nl-NL");

let a = null;                 // live aircraft
let list = null;              // flights of 30 days, newest first
let tab = params.get("vlucht") ? "vlucht" : "live";
let gekozen = Number(params.get("vlucht")) || null;   // flight id shown in the "vlucht" tab
let mk = null, map = null, ann = null, overlays = [], hoverAnn = null, circuitAnns = [];
let profiel = [];             // points of the shown flight (for the chart and the hover marker)

// ------------------------------------------------------------------ shell (built once)

function shell() {
  root.innerHTML = `
    <div id="hero"></div>
    <div class="stats" id="stats"></div>
    <div class="ac-tabs" role="tablist">
      <button class="chip" role="tab" data-tab="live">Live</button>
      <button class="chip" role="tab" data-tab="laatste">Laatste vlucht</button>
      <button class="chip" role="tab" data-tab="log">Logboek</button>
    </div>
    <div class="minimap" id="minimap"></div>
    <div id="panel"></div>
    ${isMax(hex) ? '<div id="f1"></div>' : ""}`;
  root.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => kies(b.dataset.tab)));
}

function hero() {
  const el = document.getElementById("hero");
  if (!a) {
    el.innerHTML = `<h1>${esc(list?.[0]?.naam || "Toestel")}</h1><p class="lead">Dit toestel is nu niet in beeld.</p>`;
    document.getElementById("stats").innerHTML = "";
    return;
  }
  document.title = `${a.naam} – live | 112Heli`;
  const west = a.airborne && a.track > 180 && a.track < 360;
  const key = `${drawing(a)}|${west ? "w" : "o"}`;
  const art = el.querySelector(".ac-art");
  const vs = verticaal();
  el.innerHTML = `
    <div class="ac-hero">
      <div>
        <span class="eyebrow" style="color:${soort(a).kleur}">${esc(soort(a).naam)}</span>
        <h1>${esc(a.naam)}</h1>
        <p class="lead">${esc([a.reg, a.type, a.callsign && `roepnaam ${a.callsign}`].filter(Boolean).join(" · "))}</p>
        <span class="pill">${a.airborne ? '<span class="dot"></span>' : ""}${STATUS[statusOf(a)]}${placeText(a) ? ` · ${esc(placeText(a))}` : ""}</span>
        <span class="pill" style="margin-left:6px;${isOld(a) ? "color:#fdba74" : ""}">positie ${age(ageOf(a))} oud</span>
      </div>
      <div class="ac-art" data-key="${esc(key)}"><img src="${drawing(a)}" alt="${esc(a.naam)}" style="${west ? "transform:scaleX(-1)" : ""}"></div>
    </div>`;
  // keep the floating drawing when nothing changed (no jump every 15 s)
  const fresh = el.querySelector(".ac-art");
  if (art && art.dataset.key === key) fresh.replaceWith(art);
  document.getElementById("stats").innerHTML = `
    <div class="stat"><b>${a.airborne ? alt(a.alt) : "–"}</b><span>Hoogte</span></div>
    <div class="stat"><b>${a.airborne ? speed(a.gs) : "–"}</b><span>Snelheid</span></div>
    <div class="stat"><b>${a.airborne && vs != null ? `${vs > 0 ? "↑" : vs < 0 ? "↓" : ""} ${nf.format(Math.abs(vs))}` : "–"}</b><span>Stijgen / dalen (m/min)</span></div>
    <div class="stat"><b>${a.airborne ? heading(a.track) : "–"}</b><span>Koers</span></div>`;
}

/** Climb or descent in m/min from the last two points of the live trail. */
let liveTrail = [];
function verticaal() {
  const p = liveTrail.filter((q) => q.alt != null);
  if (p.length < 2) return null;
  const x = p[p.length - 2], y = p[p.length - 1], dt = (y.ts - x.ts) / 60;
  if (dt <= 0 || dt > 5) return null;
  return Math.round(((y.alt - x.alt) * 0.3048) / dt / 10) * 10;
}

// ------------------------------------------------------------------ tabs

function kies(t, id = null) {
  if (t === "laatste") { tab = "vlucht"; gekozen = list?.[0]?.id || null; }
  else if (t === "vlucht") { tab = "vlucht"; gekozen = id; }
  else { tab = t; gekozen = null; }
  const u = new URL(location.href);
  if (tab === "vlucht" && gekozen) u.searchParams.set("vlucht", gekozen); else u.searchParams.delete("vlucht");
  history.replaceState(null, "", u);
  toon();
  if (t !== "live") document.getElementById("minimap").scrollIntoView({ behavior: "smooth", block: "start" });
}

function tabsActief() {
  const actief = tab === "vlucht" && gekozen === list?.[0]?.id ? "laatste" : tab === "vlucht" ? null : tab;
  root.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tab === actief)));
}

async function toon() {
  tabsActief();
  const panel = document.getElementById("panel");
  if (tab === "log") { document.getElementById("minimap").hidden = true; logboek(panel); return; }
  document.getElementById("minimap").hidden = false;
  if (tab === "live") {
    const lopend = list?.[0] && !list[0].end && a?.airborne ? list[0] : null;
    panel.innerHTML = lopend ? `<div id="vlucht"></div>` : `<p class="muted" style="margin-top:18px">${a?.airborne ? "In de lucht." : "Niet in de lucht. Kies Laatste vlucht of het Logboek om eerdere vluchten te bekijken."}</p>`;
    await kaartLive();
    if (lopend) await vluchtPaneel(lopend, false);
    return;
  }
  const f = list?.find((x) => x.id === gekozen);
  if (!f) { panel.innerHTML = `<p class="muted" style="margin-top:18px">Deze vlucht is niet (meer) gevonden. Vluchten blijven 30 dagen bewaard.</p>`; return; }
  panel.innerHTML = `<div id="vlucht"></div>`;
  await vluchtPaneel(f, true);
}

// ------------------------------------------------------------------ map

async function kaart() {
  if (!mk) mk = await loadMapKit();
  const el = document.getElementById("minimap");
  if (!mk || !el) { if (el) el.innerHTML = `<div class="empty" style="margin:20px">De kaart kon niet worden geladen.</div>`; return null; }
  if (!map) {
    map = new mk.Map(el, { mapType: mk.Map.MapTypes.MutedStandard, region: NL_REGION(mk), showsPointsOfInterest: false,
      colorScheme: matchMedia("(prefers-color-scheme: light)").matches ? mk.Map.ColorSchemes.Light : mk.Map.ColorSchemes.Dark });
    if (isMax(hex)) circuitsOpKaart();
  }
  return map;
}

function wis() {
  if (!map) return;
  const anns = overlays.filter((o) => o._ann).flatMap((o) => o._ann);
  if (anns.length) map.removeAnnotations(anns);
  const lines = overlays.filter((o) => !o._ann);
  if (lines.length) map.removeOverlays(lines);
  overlays = [];
  if (hoverAnn) { map.removeAnnotation(hoverAnn); hoverAnn = null; }
}

function circuitsOpKaart() {
  circuitAnns = kalender().map((c) => new mk.Annotation(new mk.Coordinate(c.lat, c.lon), () => {
    const d = document.createElement("div");
    d.className = "f1-pin"; d.title = `${c.naam} · ${c.circuit}`; d.textContent = "🏁";
    return d;
  }, { calloutEnabled: false, title: c.naam }));
  map.addAnnotations(circuitAnns);
}

async function kaartLive() {
  if (!(await kaart())) return;
  wis();
  if (ann) { map.removeAnnotation(ann); ann = null; }
  if (!a || a.lat == null) return;
  ann = new mk.Annotation(new mk.Coordinate(a.lat, a.lon), () => markerElement(a, true), { calloutEnabled: false });
  map.addAnnotation(ann);
  const coords = liveTrail.map((p) => new mk.Coordinate(p.lat, p.lon)).concat([new mk.Coordinate(a.lat, a.lon)]);
  if (coords.length > 1) {
    const line = new mk.PolylineOverlay(coords, { style: new mk.Style({ strokeColor: soort(a).kleur, lineWidth: 3, lineDash: [8, 6] }) });
    overlays.push(line); map.addOverlay(line);
  }
  if (!kaartLive.gecentreerd) {
    kaartLive.gecentreerd = true;
    map.setRegionAnimated(new mk.CoordinateRegion(new mk.Coordinate(a.lat, a.lon), new mk.CoordinateSpan(0.6, 0.6)), false);
  }
}

function routeOpKaart(f, pts) {
  wis();
  if (ann) { map.removeAnnotation(ann); ann = null; kaartLive.gecentreerd = false; }
  if (pts.length < 2) return;
  const kleur = soort(f).kleur;
  const coords = pts.map((p) => new mk.Coordinate(p.lat, p.lon));
  const line = new mk.PolylineOverlay(coords, { style: new mk.Style({ strokeColor: kleur, lineWidth: 4, lineCap: "round", lineJoin: "round" }) });
  overlays = [line];
  map.addOverlays(overlays);
  // start and end as small markers
  const mark = (p, label, cls) => new mk.Annotation(new mk.Coordinate(p.lat, p.lon), () => {
    const d = document.createElement("div"); d.className = `route-pin ${cls}`; d.textContent = label; return d;
  }, { calloutEnabled: false });
  const s = mark(pts[0], "Vertrek", "is-start"), e = mark(pts[pts.length - 1], f.end ? "Aankomst" : "Nu", "is-end");
  map.addAnnotations([s, e]);
  overlays.push({ _ann: [s, e] });
  map.showItems([line], { animate: true, padding: new mk.Padding(50, 50, 50, 50) });
}

// ------------------------------------------------------------------ one flight

const km = (x) => `${nf.format(Math.round(x))} km`;
function afstand(pts) {
  let d = 0;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], q = pts[i], r = Math.PI / 180;
    const h = Math.sin(((q.lat - p.lat) * r) / 2) ** 2 + Math.cos(p.lat * r) * Math.cos(q.lat * r) * Math.sin(((q.lon - p.lon) * r) / 2) ** 2;
    d += 2 * 6371 * Math.asin(Math.sqrt(h));
  }
  return d;
}
const duur = (s) => { const m = Math.max(1, Math.round(s / 60)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} u ${String(m % 60).padStart(2, "0")}`; };

async function vluchtPaneel(f, metKaart) {
  const el = document.getElementById("vlucht");
  if (!el) return;
  if (!el.innerHTML) el.innerHTML = `<p class="muted" style="margin-top:18px">Vlucht laden…</p>`;
  let pts = [];
  try { pts = (await (await fetch(`${API}/v1/flights/${f.id}/track`, { signal: AbortSignal.timeout(12000) })).json()).points || []; } catch {}
  pts = pts.filter((p) => p.lat != null && p.lon != null);
  profiel = pts;
  if (metKaart && (await kaart())) routeOpKaart(f, pts);

  const eind = f.end || (pts.length ? pts[pts.length - 1].ts : f.start);
  const dist = afstand(pts);
  const maxAlt = Math.max(0, ...pts.map((p) => p.alt || 0), f.maxAlt || 0);
  const maxGs = Math.max(0, ...pts.map((p) => p.gs || 0));
  const gem = eind > f.start ? (dist / ((eind - f.start) / 3600)) : 0;
  const cVan = isMax(hex) ? circuitBij(f.startLat, f.startLon, f.start) : null;
  const cNaar = isMax(hex) && f.end ? circuitBij(f.endLat, f.endLon, f.end) : null;
  const deelUrl = `${location.origin}/toestel/?hex=${hex}&vlucht=${f.id}`;
  const deelTekst = `${f.naam}: ${f.startPlace || "vertrek"} → ${f.end ? f.endPlace || "aankomst" : "nu in de lucht"} (${dateTime(f.start)})`;

  el.innerHTML = `
    <div class="flight-head">
      <div>
        <span class="eyebrow">${f.end ? "Vlucht" : '<span class="dot"></span> Nu in de lucht'} · ${dateTime(f.start)}</span>
        <h2 class="flight-route">${esc(f.startPlace || "Onbekend")} <span>→</span> ${f.end ? esc(f.endPlace || "op locatie") : "…"}</h2>
        ${f1Tag(cVan, cNaar)}
      </div>
      <div class="share">
        <button class="chip" id="kopieer">Kopieer link</button>
        <a class="chip" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(`${deelTekst} ${deelUrl}`)}">WhatsApp</a>
        <a class="chip" target="_blank" rel="noopener" href="https://x.com/intent/post?text=${encodeURIComponent(deelTekst)}&url=${encodeURIComponent(deelUrl)}">X</a>
      </div>
    </div>
    <div class="fd-grid">
      <div><span>Vertrek</span><b>${time(f.start)}</b><small>${esc(f.startPlace || "–")}</small></div>
      <div><span>${f.end ? "Aankomst" : "Laatste positie"}</span><b>${time(eind)}</b><small>${esc(f.end ? f.endPlace || "op locatie" : "onderweg")}</small></div>
      <div><span>Duur</span><b>${duur(eind - f.start)}</b><small>${f.end ? "van start tot landing" : "tot nu"}</small></div>
      <div><span>Afstand</span><b>${pts.length > 1 ? km(dist) : "–"}</b><small>gevlogen route</small></div>
      <div><span>Max. hoogte</span><b>${maxAlt ? alt(maxAlt) : "–"}</b><small>${maxGs ? `max. ${speed(maxGs)}` : ""}</small></div>
      <div><span>Gem. snelheid</span><b>${gem ? `${nf.format(Math.round(gem))} km/u` : "–"}</b><small>over de route</small></div>
    </div>
    <h3 style="margin:34px 0 4px">Vluchtprofiel</h3>
    <p class="muted" style="margin:0 0 10px;font-size:.9rem">Hoogte <i class="lg lg-alt"></i> en snelheid <i class="lg lg-gs"></i>. Beweeg over de grafiek om het punt op de kaart te zien.</p>
    <div class="profile" id="profile">${grafiek(pts)}</div>`;
  el.querySelector("#kopieer").addEventListener("click", async (e) => {
    try { await navigator.clipboard.writeText(deelUrl); e.target.textContent = "Gekopieerd ✓"; } catch { prompt("Kopieer deze link", deelUrl); }
    setTimeout(() => (e.target.textContent = "Kopieer link"), 2000);
  });
  hoverProfiel(el.querySelector("#profile"), f);
}

function f1Tag(van, naar) {
  if (!van && !naar) return "";
  const t = naar
    ? (naar.thuis ? "🏠 Geland, thuis in Monaco" : `🏁 Geland bij ${esc(naar.naam)} · ${esc(naar.gp)}`)
    : (van.thuis ? "🏠 Vertrokken uit Monaco" : `🏁 Vertrokken bij ${esc(van.naam)} · ${esc(van.gp)}`);
  return `<p class="f1-tag">${t}</p>`;
}

// ------------------------------------------------------------------ flight profile (SVG)

const W = 1000, H = 260, PL = 56, PR = 60, PT = 30, PB = 34;
function grafiek(pts) {
  const p = pts.filter((q) => q.ts != null);
  if (p.length < 2) return `<p class="muted" style="padding:20px">Te weinig punten voor een vluchtprofiel.</p>`;
  const t0 = p[0].ts, t1 = p[p.length - 1].ts || t0 + 1;
  const mAlt = Math.max(100, ...p.map((q) => (q.alt || 0) * 0.3048));
  const mGs = Math.max(50, ...p.map((q) => (q.gs || 0) * 1.852));
  const yA = niceMax(mAlt), yG = niceMax(mGs);
  const x = (t) => PL + ((t - t0) / (t1 - t0)) * (W - PL - PR);
  const ya = (v) => PT + (1 - v / yA) * (H - PT - PB);
  const yg = (v) => PT + (1 - v / yG) * (H - PT - PB);
  const area = `M${x(t0)},${ya(0)} ` + p.map((q) => `L${x(q.ts).toFixed(1)},${ya((q.alt || 0) * 0.3048).toFixed(1)}`).join(" ") + ` L${x(t1)},${ya(0)} Z`;
  const gsLine = p.filter((q) => q.gs != null).map((q, i) => `${i ? "L" : "M"}${x(q.ts).toFixed(1)},${yg(q.gs * 1.852).toFixed(1)}`).join(" ");
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const yy = PT + (1 - f) * (H - PT - PB);
    return `<line x1="${PL}" x2="${W - PR}" y1="${yy}" y2="${yy}" class="g"/>
      <text x="${PL - 8}" y="${yy + 4}" class="ax ax-l">${nf.format(Math.round(yA * f))}</text>
      <text x="${W - PR + 8}" y="${yy + 4}" class="ax ax-r">${nf.format(Math.round(yG * f))}</text>`;
  }).join("");
  const ticks = 5, xt = Array.from({ length: ticks + 1 }, (_, i) => t0 + ((t1 - t0) * i) / ticks)
    .map((t) => `<text x="${x(t)}" y="${H - 10}" class="ax" text-anchor="middle">${time(t)}</text>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Vluchtprofiel met hoogte en snelheid">
    <defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4c6bff" stop-opacity=".55"/><stop offset="1" stop-color="#4c6bff" stop-opacity=".04"/></linearGradient></defs>
    ${grid}
    <text x="${PL - 8}" y="${PT - 14}" class="ax ax-l unit">m</text><text x="${W - PR + 8}" y="${PT - 14}" class="ax ax-r unit">km/u</text>
    <path d="${area}" fill="url(#ga)" stroke="#6f88ff" stroke-width="2"/>
    <path d="${gsLine}" fill="none" stroke="#e11d48" stroke-width="2.2" stroke-linejoin="round"/>
    ${xt}
    <line id="cross" x1="0" x2="0" y1="${PT}" y2="${H - PB}" class="cross" style="display:none"/>
  </svg><div class="tip" id="tip" hidden></div>`;
}
function niceMax(v) {
  const e = 10 ** Math.floor(Math.log10(v)), n = v / e;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * e;
}

function hoverProfiel(box, f) {
  const svg = box.querySelector("svg"), tip = box.querySelector("#tip"), cross = box.querySelector("#cross");
  const p = profiel.filter((q) => q.ts != null);
  if (!svg || p.length < 2) return;
  const t0 = p[0].ts, t1 = p[p.length - 1].ts;
  const move = (clientX) => {
    const r = svg.getBoundingClientRect();
    const fx = ((clientX - r.left) / r.width) * W;
    const t = t0 + ((fx - PL) / (W - PL - PR)) * (t1 - t0);
    let best = p[0];
    for (const q of p) if (Math.abs(q.ts - t) < Math.abs(best.ts - t)) best = q;
    const bx = PL + ((best.ts - t0) / (t1 - t0)) * (W - PL - PR);
    cross.setAttribute("x1", bx); cross.setAttribute("x2", bx); cross.style.display = "";
    tip.hidden = false;
    tip.innerHTML = `<b>${time(best.ts)}</b>${alt(best.alt)} · ${speed(best.gs)}${best.track != null ? ` · ${heading(best.track)}` : ""}`;
    const px = (bx / W) * r.width;
    tip.style.left = `${Math.min(Math.max(px, 70), r.width - 70)}px`;
    if (mk && map) {
      const c = new mk.Coordinate(best.lat, best.lon);
      if (!hoverAnn) {
        hoverAnn = new mk.Annotation(c, () => { const d = document.createElement("div"); d.className = "hover-pin"; d.style.setProperty("--c", soort(f).kleur); return d; }, { calloutEnabled: false });
        map.addAnnotation(hoverAnn);
      } else hoverAnn.coordinate = c;
    }
  };
  const leave = () => { cross.style.display = "none"; tip.hidden = true; if (hoverAnn && map) { map.removeAnnotation(hoverAnn); hoverAnn = null; } };
  box.addEventListener("pointermove", (e) => move(e.clientX));
  box.addEventListener("pointerdown", (e) => move(e.clientX));
  box.addEventListener("pointerleave", leave);
}

// ------------------------------------------------------------------ log

function logboek(panel) {
  if (!list) { panel.innerHTML = `<p class="muted">De vluchten konden niet worden opgehaald.</p>`; return; }
  if (!list.length) { panel.innerHTML = `<p class="muted" style="margin-top:18px">Nog geen vluchten in de afgelopen 30 dagen.</p>`; return; }
  const totaal = list.filter((f) => f.end).reduce((s, f) => s + (f.end - f.start), 0);
  panel.innerHTML = `
    <p class="muted" style="margin-top:18px">${list.length} vluchten in 30 dagen · ${duur(totaal)} in de lucht. Klik op een vlucht voor de route en het vluchtprofiel.</p>
    <table class="flights clickable"><thead><tr><th>Vertrek</th><th>Van</th><th>Naar</th><th>Duur</th></tr></thead><tbody>${list.slice(0, 60).map((f) => {
      const c = isMax(hex) ? circuitBij(f.endLat, f.endLon, f.end || f.start) || circuitBij(f.startLat, f.startLon, f.start) : null;
      return `<tr data-id="${f.id}" tabindex="0"><td>${dateTime(f.start)}</td><td>${esc(f.startPlace || "–")}</td>
        <td>${f.end ? esc(f.endPlace || "op locatie") : '<span class="dot" style="display:inline-block"></span> nu in de lucht'}${c ? ` <span class="f1-mini" title="${esc(c.thuis ? c.naam : c.gp)}">${c.thuis ? "🏠" : "🏁"}</span>` : ""}</td>
        <td>${f.end ? duur(f.end - f.start) : `sinds ${time(f.start)}`}</td></tr>`;
    }).join("")}</tbody></table>`;
  panel.querySelectorAll("tr[data-id]").forEach((tr) => {
    const go = () => kies("vlucht", Number(tr.dataset.id));
    tr.addEventListener("click", go);
    tr.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  });
}

// ------------------------------------------------------------------ F1 (Max only)

async function f1() {
  const el = document.getElementById("f1");
  if (!el) return;
  const d = await laadF1();
  const l = d?.laatste, n = d?.volgende;
  const datum = (s) => (s ? new Date(`${s}T12:00:00`).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "long" }) : "");
  el.innerHTML = `
    <h2 style="margin-top:56px;font-size:1.6rem">Formule 1</h2>
    <div class="f1-grid">
      ${l ? `<div class="f1-card">
        <span class="eyebrow">Laatste GP · ronde ${l.ronde ?? "–"}</span>
        <h3>${esc(l.naam)}</h3><p class="muted">${esc(l.circuit || "")}${l.plaats ? ` · ${esc(l.plaats)}` : ""} · ${datum(l.datum)}</p>
        ${l.max ? `<p class="f1-max">Max: <b>${l.max.positie ? `P${l.max.positie}` : esc(l.max.status)}</b>${l.max.punten ? ` · ${l.max.punten} punten` : ""}</p>` : ""}
        <ol class="f1-podium">${(l.top3 || []).map((x) => `<li><b>${esc(x.naam)}</b> <span class="muted">${esc(x.team || "")}</span></li>`).join("")}</ol>
      </div>` : ""}
      ${n ? `<div class="f1-card">
        <span class="eyebrow">Volgende GP · ronde ${n.ronde ?? "–"}</span>
        <h3>${esc(n.naam)}</h3><p class="muted">${esc(n.circuit || "")}${n.plaats ? ` · ${esc(n.plaats)}` : ""}</p>
        <p class="f1-max">${datum(n.datum)}${n.tijd ? ` · ${new Date(`${n.datum}T${n.tijd}`).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}` : ""}</p>
        <p class="muted" style="font-size:.9rem">Volg op de kaart hierboven wanneer de jet richting het circuit vliegt. De 🏁 op de kaart zijn de circuits van dit seizoen.</p>
      </div>` : ""}
      ${!l && !n ? `<p class="muted">De F1-gegevens zijn nu niet beschikbaar.</p>` : ""}
    </div>
    <p class="muted" style="font-size:.8rem;margin-top:10px">F1-uitslagen: Jolpica-F1. 112Heli is niet verbonden aan de Formule 1 of aan Max Verstappen.</p>`;
}

// ------------------------------------------------------------------ data loop

async function refresh(first = false) {
  try {
    const [d, fl] = await Promise.all([fetchLive(), fetchFlights(30, hex).catch(() => null)]);
    a = (d.aircraft || []).find((x) => x.hex === hex) || null;
    if (fl) list = fl;
    liveTrail = a ? await fetchTrack(a.hex, 360).catch(() => []) : [];
    if (first) {
      if (!a && !list?.length) {
        root.innerHTML = `<h1>Toestel niet gevonden</h1><p class="lead">Dit toestel is de afgelopen twee weken niet gezien.</p><a class="btn btn-primary" href="/toestellen/">Alle toestellen</a>`;
        return;
      }
      if (isMax(hex)) await laadF1();
      shell(); hero(); await toon(); f1();
      return;
    }
    hero();
    // live tab follows the aircraft; an open flight that is still going gets its new points
    if (tab === "live") await toon();
    else if (tab === "vlucht" && list?.find((x) => x.id === gekozen && !x.end)) await toon();
    else tabsActief();
  } catch {
    if (first) root.innerHTML = `<h1>Geen verbinding</h1><p class="lead">De gegevens konden niet worden opgehaald. Probeer het zo opnieuw.</p>`;
  }
}
refresh(true);
setInterval(refresh, 15000);
