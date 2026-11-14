// Eén toestel: status, cijfers, route op Apple Kaarten en vluchten van de afgelopen 30 dagen.
import { initChrome, fetchLive, fetchTrack, fetchFlights, soort, drawing, esc, placeText, alt, speed, heading, age, ageOf, isOld,
  STATUS, statusOf, dateTime, time, loadMapKit, NL_REGION, markerElement } from "./core.js";

initChrome();
const hex = (new URLSearchParams(location.search).get("hex") || "").toLowerCase();
const root = document.getElementById("toestel");
let mk = null, map = null, ann = null, line = null, a = null;

function render() {
  if (!a) {
    root.innerHTML = `<h1>Toestel niet gevonden</h1><p class="lead">Dit toestel is de afgelopen twee weken niet gezien.</p><a class="btn btn-primary" href="/toestellen/">Alle toestellen</a>`;
    return;
  }
  document.title = `${a.naam} – live | 112Heli`;
  const west = a.airborne && a.track > 180 && a.track < 360;
  root.innerHTML = `
    <div class="ac-hero">
      <div>
        <span class="eyebrow" style="color:${soort(a).kleur}">${esc(soort(a).naam)}</span>
        <h1>${esc(a.naam)}</h1>
        <p class="lead">${esc([a.reg, a.type, a.callsign && `roepnaam ${a.callsign}`].filter(Boolean).join(" · "))}</p>
        <span class="pill">${a.airborne ? '<span class="dot"></span>' : ""}${STATUS[statusOf(a)]}${placeText(a) ? ` · ${esc(placeText(a))}` : ""}</span>
      </div>
      <img src="${drawing(a)}" alt="${esc(a.naam)}" style="${west ? "transform:scaleX(-1)" : ""}">
    </div>
    <div class="stats">
      <div class="stat"><b>${a.airborne ? alt(a.alt) : "–"}</b><span>Hoogte</span></div>
      <div class="stat"><b>${a.airborne ? speed(a.gs) : "–"}</b><span>Snelheid</span></div>
      <div class="stat"><b>${a.airborne ? heading(a.track) : "–"}</b><span>Koers</span></div>
      <div class="stat"><b style="color:${isOld(a) ? "#fdba74" : "inherit"}">${age(ageOf(a))}</b><span>Leeftijd positie</span></div>
    </div>
    <div class="minimap" id="minimap"></div>
    <h2 style="margin-top:50px;font-size:1.6rem">Vluchten (30 dagen)</h2>
    <div id="flights" class="muted">Laden…</div>`;
}

async function drawMap() {
  if (!a || a.lat == null) return;
  if (!mk) mk = await loadMapKit();
  const el = document.getElementById("minimap");
  if (!mk || !el) { if (el) el.innerHTML = `<div class="empty" style="margin:20px">De kaart kon niet worden geladen.</div>`; return; }
  if (!map || map.element !== el) {
    map = new mk.Map(el, { region: NL_REGION(mk), showsPointsOfInterest: false,
      colorScheme: matchMedia("(prefers-color-scheme: light)").matches ? mk.Map.ColorSchemes.Light : mk.Map.ColorSchemes.Dark });
    map.setRegionAnimated(new mk.CoordinateRegion(new mk.Coordinate(a.lat, a.lon), new mk.CoordinateSpan(0.6, 0.6)), false);
  }
  if (ann) map.removeAnnotation(ann);
  ann = new mk.Annotation(new mk.Coordinate(a.lat, a.lon), () => markerElement(a, true), { calloutEnabled: false });
  map.addAnnotation(ann);
  const pts = await fetchTrack(a.hex, 360).catch(() => []);
  if (line) map.removeOverlay(line);
  const coords = pts.map((p) => new mk.Coordinate(p.lat, p.lon)).concat([new mk.Coordinate(a.lat, a.lon)]);
  if (coords.length > 1) {
    line = new mk.PolylineOverlay(coords, { style: new mk.Style({ strokeColor: soort(a).kleur, lineWidth: 3, lineDash: [8, 6] }) });
    map.addOverlay(line);
  }
}

async function flights() {
  const el = document.getElementById("flights");
  if (!el) return;
  const list = await fetchFlights(30, hex).catch(() => null);
  if (!list) { el.textContent = "De vluchten konden niet worden opgehaald."; return; }
  if (!list.length) { el.textContent = "Nog geen vluchten in de afgelopen 30 dagen."; return; }
  el.innerHTML = `<table class="flights"><thead><tr><th>Vertrek</th><th>Van</th><th>Naar</th><th>Duur</th></tr></thead><tbody>${list.slice(0, 40).map((f) => `
    <tr><td>${dateTime(f.start)}</td><td>${esc(f.startPlace || "–")}</td><td>${f.end ? esc(f.endPlace || "op locatie") : '<span class="dot" style="display:inline-block"></span> nu in de lucht'}</td>
    <td>${f.end ? `${Math.max(1, Math.round((f.end - f.start) / 60))} min` : `sinds ${time(f.start)}`}</td></tr>`).join("")}</tbody></table>`;
}

async function refresh(first = false) {
  try {
    const d = await fetchLive();
    a = (d.aircraft || []).find((x) => x.hex === hex) || null;
    if (first || !document.getElementById("minimap")) { render(); flights(); } else {
      // update numbers without rebuilding the map
      const keep = document.getElementById("minimap");
      render(); const mm = document.getElementById("minimap"); mm.replaceWith(keep); flights();
    }
    drawMap();
  } catch {
    if (first) root.innerHTML = `<h1>Geen verbinding</h1><p class="lead">De gegevens konden niet worden opgehaald. Probeer het zo opnieuw.</p>`;
  }
}
refresh(true);
setInterval(refresh, 15000);
