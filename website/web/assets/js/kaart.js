// Live kaart met Apple Kaarten: alle toestellen, filter per soort, route van het gekozen toestel.
import { initChrome, fetchLive, fetchTrack, soort, SOORT, drawing, esc, placeText, alt, speed, heading, age, ageOf, isOld, STATUS, statusOf,
  loadMapKit, NL_REGION, markerElement } from "./core.js";

initChrome();

const listEl = document.getElementById("list");
const detailEl = document.getElementById("detail");
const chipsEl = document.getElementById("chips");
const bannersEl = document.getElementById("banners");
const params = new URLSearchParams(location.search);

let aircraft = [], incidents = [], weer = null;
let selected = params.get("hex");
const shown = new Set(JSON.parse(localStorage.getItem?.("heli.lagen") || "null") || ["trauma", "politie", "kustwacht", "kmar", "regering", "bijzonder", "defensie"]);

let alleenLucht = false;
try { alleenLucht = localStorage.getItem("heli.alleenLucht") === "1"; } catch {}
const isOnline = (a) => a.airborne && statusOf(a) !== "uit_beeld";

chipsEl.innerHTML = `<button class="chip" data-offline="1" aria-pressed="${alleenLucht}" style="--c:#e11d48"><i></i>Offline verbergen</button>` +
  Object.entries(SOORT).map(([k, s]) =>
  `<button class="chip" data-k="${k}" aria-pressed="${shown.has(k)}" style="--c:${s.kleur}"><i></i>${esc(s.kort)}</button>`).join("");
chipsEl.addEventListener("click", (e) => {
  const b = e.target.closest(".chip"); if (!b) return;
  if (b.dataset.offline) {
    alleenLucht = !alleenLucht;
    b.setAttribute("aria-pressed", alleenLucht);
    try { localStorage.setItem("heli.alleenLucht", alleenLucht ? "1" : "0"); } catch {}
    return render();
  }
  const k = b.dataset.k;
  shown.has(k) ? shown.delete(k) : shown.add(k);
  b.setAttribute("aria-pressed", shown.has(k));
  try { localStorage.setItem("heli.lagen", JSON.stringify([...shown])); } catch {}
  render();
});

let mk = null, map = null, track = null;
const annotations = new Map();

async function initMap() {
  mk = await loadMapKit();
  const el = document.getElementById("map");
  if (!mk) { el.innerHTML = `<div class="empty" style="margin:20px">De kaart kon niet worden geladen. De lijst hiernaast werkt wel.</div>`; return; }
  map = new mk.Map(el, {
    region: NL_REGION(mk), showsPointsOfInterest: false, showsCompass: mk.FeatureVisibility.Adaptive,
    colorScheme: matchMedia("(prefers-color-scheme: light)").matches ? mk.Map.ColorSchemes.Light : mk.Map.ColorSchemes.Dark,
  });
  render();
}

function visible() { return aircraft.filter((a) => a.lat != null && shown.has(a.soort) && (!alleenLucht || isOnline(a))); }

function render() {
  const vis = visible();
  // markers
  if (map) {
    const keep = new Set();
    for (const a of vis) {
      keep.add(a.hex);
      const coord = new mk.Coordinate(a.lat, a.lon);
      const old = annotations.get(a.hex);
      if (old) map.removeAnnotation(old);
      const ann = new mk.Annotation(coord, () => markerElement(a, a.hex === selected), { anchorOffset: new DOMPoint(0, 0), calloutEnabled: false, title: a.naam });
      ann.addEventListener("select", () => select(a.hex));
      map.addAnnotation(ann);
      annotations.set(a.hex, ann);
    }
    for (const [hex, ann] of annotations) if (!keep.has(hex)) { map.removeAnnotation(ann); annotations.delete(hex); }
  }

  // banners
  bannersEl.innerHTML = (weer ? `<div class="banner weer">☁︎ Weinig helikopterinzet verwacht: ${esc(weer.reden)}</div>` : "") +
    incidents.map((i) => `<div class="banner incident" data-lat="${i.lat}" data-lon="${i.lon}">⚠︎ ${i.hexes.length} helikopters op één plek${i.place ? ` in ${esc(i.place)}` : ""}</div>`).join("");

  // list
  const groups = { lucht: [], basis: [], grond: [], uit_beeld: [] };
  for (const a of aircraft.filter((x) => shown.has(x.soort) && (!alleenLucht || isOnline(x)))) (groups[statusOf(a)] || groups.grond).push(a);
  listEl.innerHTML = Object.entries(groups).filter(([, l]) => l.length).map(([k, l]) => `
    <div class="status-group"><h2>${STATUS[k]} <span class="pill">${l.length}</span></h2>
    ${l.map((a) => `
      <a class="ac${isOld(a) ? " old" : ""}" href="?hex=${a.hex}" data-hex="${a.hex}" style="margin-top:8px">
        <span class="thumb" style="--c:${soort(a).kleur}"><img src="${drawing(a)}" alt=""></span>
        <span class="t"><b>${esc(a.naam)}</b><small>${esc(placeText(a) || soort(a).naam)}</small></span>
        <span class="r">${a.airborne ? alt(a.alt) : `${age(ageOf(a))} geleden`}</span>
      </a>`).join("")}</div>`).join("") || `<div class="empty">Nog geen toestellen gezien.</div>`;

  showDetail();
}

function showDetail() {
  const a = aircraft.find((x) => x.hex === selected);
  if (!a) { detailEl.hidden = true; return; }
  detailEl.hidden = false;
  detailEl.innerHTML = `
    <img class="draw" src="${drawing(a)}" alt="" ${a.airborne && a.track > 180 ? 'style="transform:scaleX(-1)"' : ""}>
    <h3 style="margin:10px 0 2px">${esc(a.naam)}</h3>
    <div class="muted" style="font-size:.9rem">${esc([soort(a).naam, a.reg, a.type].filter(Boolean).join(" · "))}</div>
    <div class="figures">
      <div><small>Status</small><b>${STATUS[statusOf(a)]}</b></div>
      <div><small>Positie</small><b style="color:${isOld(a) ? "#fdba74" : "inherit"}">${age(ageOf(a))} oud</b></div>
      <div><small>Hoogte</small><b>${a.airborne ? alt(a.alt) : "–"}</b></div>
      <div><small>Snelheid</small><b>${a.airborne ? speed(a.gs) : "–"}</b></div>
      <div><small>Koers</small><b>${a.airborne ? heading(a.track) : "–"}</b></div>
      <div><small>Waar</small><b>${esc(placeText(a) || "–")}</b></div>
    </div>
    <a class="btn btn-ghost" style="width:100%;justify-content:center" href="/toestel/?hex=${a.hex}">Meer over dit toestel →</a>`;
}

async function select(hex, fly = false) {
  selected = hex;
  history.replaceState(null, "", hex ? `?hex=${hex}` : location.pathname);
  render();
  const a = aircraft.find((x) => x.hex === hex);
  if (map && a && fly) map.setRegionAnimated(new mk.CoordinateRegion(new mk.Coordinate(a.lat, a.lon), new mk.CoordinateSpan(0.5, 0.5)));
  await drawTrack();
}

async function drawTrack() {
  if (!map) return;
  if (track) { map.removeOverlay(track); track = null; }
  const a = aircraft.find((x) => x.hex === selected);
  if (!a) return;
  const pts = await fetchTrack(a.hex, 60).catch(() => []);
  const coords = pts.map((p) => new mk.Coordinate(p.lat, p.lon));
  if (a.lat != null) coords.push(new mk.Coordinate(a.lat, a.lon));
  if (coords.length < 2) return;
  track = new mk.PolylineOverlay(coords, { style: new mk.Style({ strokeColor: soort(a).kleur, lineWidth: 3, lineDash: [8, 6], lineCap: "round" }) });
  map.addOverlay(track);
}

listEl.addEventListener("click", (e) => {
  const el = e.target.closest("[data-hex]"); if (!el) return;
  e.preventDefault(); select(el.dataset.hex, true);
});
bannersEl.addEventListener("click", (e) => {
  const b = e.target.closest(".incident"); if (!b || !map) return;
  map.setRegionAnimated(new mk.CoordinateRegion(new mk.Coordinate(+b.dataset.lat, +b.dataset.lon), new mk.CoordinateSpan(0.12, 0.12)));
});

async function refresh() {
  try {
    const d = await fetchLive();
    aircraft = d.aircraft || []; incidents = d.incidents || []; weer = d.weer || null;
    render();
    if (selected) drawTrack();
  } catch {
    listEl.innerHTML = `<div class="empty">Geen verbinding met de server. We proberen het zo opnieuw.</div>`;
  }
}

await refresh();
initMap().then(() => { if (selected) select(selected, true); });
setInterval(refresh, 10000);
