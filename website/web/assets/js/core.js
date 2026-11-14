// Gedeeld door alle pagina's: API, soorten en tekeningen (zelfde als de app), opmaak, animaties, Apple Kaarten.
const CFG = Object.assign({ api: "https://112heli-api.112heli.workers.dev", appStoreURL: "", version: "1.0.0" }, window.HELI_CONFIG || {});
export const API = CFG.api.replace(/\/+$/, "");
export const config = CFG;

// ------------------------------------------------------------------ data

async function get(path) {
  const res = await fetch(API + path, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
export const fetchLive = () => get("/v1/live");
export const fetchTrack = (hex, minutes = 60) => get(`/v1/aircraft/${hex}/track?minutes=${minutes}`).then((r) => r.points || []);
export const fetchFlights = (days = 30, hex = "") => get(`/v1/flights?days=${days}${hex ? `&hex=${hex}` : ""}`).then((r) => r.flights || []);

// ------------------------------------------------------------------ soorten, tekeningen

export const SOORT = {
  trauma: { naam: "Traumahelikopter", kort: "Lifeliners", kleur: "#9333ea" },
  politie: { naam: "Politiehelikopter", kort: "Politie (Zulu)", kleur: "#3f74d8" },
  kustwacht: { naam: "Kustwacht", kort: "Kustwacht", kleur: "#0891b2" },
  defensie: { naam: "Defensie", kort: "Defensie", kleur: "#7d9148" },
  kmar: { naam: "Koninklijke Marechaussee", kort: "Marechaussee", kleur: "#7d9148" },
  regering: { naam: "Regering", kort: "Regering", kleur: "#7d9148" },
  bijzonder: { naam: "Privéjet", kort: "Max Verstappen", kleur: "#ff6600" },
};
export const soort = (a) => SOORT[a?.soort] || SOORT.defensie;

/** All kinds with their own drawing (same list as the app and A-Alerts). */
export const TYPES = [
  { id: "trauma", titel: "Lifeliner", sub: "Traumahelikopter · EC135/H135", img: "heli_lifeliner_ec135", soort: "trauma",
    tekst: "Brengt de arts en verpleegkundige van het Mobiel Medisch Team snel naar een ernstig ongeval. Bases in Amsterdam, Rotterdam, Volkel en Groningen." },
  { id: "politie", titel: "Zulu", sub: "Politiehelikopter · EC135", img: "heli_politie_ec135", soort: "politie",
    tekst: "De helikopter van de Luchtvaartpolitie: zoekt vermiste personen en verdachten, vaak met een warmtebeeldcamera." },
  { id: "politie_aw139", titel: "Zulu", sub: "Politiehelikopter · AW139", img: "heli_politie_aw139", soort: "politie",
    tekst: "De grotere politiehelikopter, voor meer mensen en materiaal, zoals een arrestatieteam." },
  { id: "kustwacht_aw189", titel: "Kustwacht helikopter", sub: "AW189 · SAR", img: "lucht_kustwacht_aw189", soort: "kustwacht",
    tekst: "Opsporing en redding op zee en langs de kust, vanaf Den Helder en Midden-Zeeland." },
  { id: "kustwacht_dash8", titel: "Kustwacht vliegtuig", sub: "Dash 8", img: "lucht_kustwacht_dash8", soort: "kustwacht",
    tekst: "Patrouilleert boven de Noordzee: scheepvaart, vervuiling en mensen in nood." },
  { id: "chinook", titel: "Chinook", sub: "Transporthelikopter · CH-47", img: "lucht_chinook", soort: "defensie",
    tekst: "De grote helikopter met twee rotors, voor militairen, zwaar materieel en blussen met een bak." },
  { id: "apache", titel: "Apache", sub: "Gevechtshelikopter · AH-64", img: "lucht_apache", soort: "defensie",
    tekst: "Smalle gevechtshelikopter, vaak laag en in tweetallen bij oefeningen." },
  { id: "cougar", titel: "Cougar", sub: "Transporthelikopter · AS532", img: "lucht_cougar", soort: "defensie",
    tekst: "Middelgrote transporthelikopter voor militairen en gewonden, ook bij branden en rampen." },
  { id: "nh90", titel: "NH90", sub: "Maritieme helikopter", img: "lucht_nh90", soort: "defensie",
    tekst: "De grijze helikopter van de marine, voor opsporing, redding en transport." },
  { id: "heli", titel: "Overige helikopter", sub: "Defensie", img: "lucht_heli", soort: "defensie",
    tekst: "Andere Nederlandse militaire helikopters." },
  { id: "f35", titel: "Straaljager", sub: "F-35", img: "lucht_f35", soort: "defensie",
    tekst: "Het jachtvliegtuig van de luchtmacht: hoog en snel, je hoort hem eerder dan je hem ziet." },
  { id: "hercules", titel: "Transport", sub: "C-130 Hercules", img: "lucht_hercules", soort: "defensie",
    tekst: "Viermotorig transportvliegtuig voor vracht, militairen en hulpgoederen." },
  { id: "les", titel: "Lesvliegtuig", sub: "Pilatus PC-7", img: "lucht_les", soort: "defensie",
    tekst: "Hierin leren nieuwe vliegers van de luchtmacht vliegen." },
  { id: "vliegtuig", titel: "Overig vliegtuig", sub: "Defensie", img: "lucht_vliegtuig", soort: "defensie",
    tekst: "Andere Nederlandse militaire vliegtuigen." },
  { id: "kmar", titel: "Koninklijke Marechaussee", sub: "Patrouillevliegtuig", img: "lucht_kmar", soort: "kmar",
    tekst: "Klein tweemotorig vliegtuig met camera's, voor toezicht vanuit de lucht." },
  { id: "phgov", titel: "Regeringsvliegtuig", sub: "PH-GOV · Boeing 737", img: "lucht_phgov", soort: "regering",
    tekst: "Het vliegtuig van de Nederlandse regering en het Koninklijk Huis." },
  { id: "verstappen", titel: "Max Verstappen", sub: "PH-UTL · Falcon 8X", img: "lucht_verstappen", soort: "bijzonder",
    tekst: "Voor de lol: de privéjet van de wereldkampioen. Vliegt hij boven Nederland, dan zie je hem." },
];

const AW139 = new Set(["zulu24", "zulu25", "zulu26"]);
export function drawing(a) {
  if (a.icoon) return `/assets/img/lucht_${a.icoon}.webp`;
  if (a.soort === "trauma") return "/assets/img/heli_lifeliner_ec135.webp";
  if ((a.type || "").toUpperCase() === "A139" || AW139.has(a.key)) return "/assets/img/heli_politie_aw139.webp";
  return "/assets/img/heli_politie_ec135.webp";
}

export const STATUS = { lucht: "In de lucht", basis: "Op de basis", grond: "Op de grond", uit_beeld: "Uit beeld" };
export const statusOf = (a) => a.status || (a.airborne ? "lucht" : "grond");
export const placeText = (a) => (a.airborne ? (a.boven ? `Boven ${a.boven}` : "") : a.plek || "");

// ------------------------------------------------------------------ formatting

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const nf = new Intl.NumberFormat("nl-NL");
export const alt = (ft) => (ft == null ? "–" : `${nf.format(Math.round(ft * 0.3048 / 10) * 10)} m`);
export const speed = (kt) => (kt == null ? "–" : `${nf.format(Math.round(kt * 1.852))} km/u`);
export function heading(d) {
  if (d == null) return "–";
  const n = ["N", "NO", "O", "ZO", "Z", "ZW", "W", "NW"][Math.floor(((d % 360) + 382.5) / 45) % 8];
  return `${Math.round(d)}° ${n}`;
}
export function age(seconds) {
  if (seconds == null) return "–";
  if (seconds < 90) return `${Math.round(seconds)} s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} uur`;
  return `${Math.round(seconds / 86400)} d`;
}
export const ageOf = (a) => (a.seen ? Date.now() / 1000 - a.seen : null);
export const isOld = (a) => (ageOf(a) ?? 1e9) > 60;
export const time = (epoch) => new Date(epoch * 1000).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
export const dateTime = (epoch) => new Date(epoch * 1000).toLocaleString("nl-NL", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function thumb(a, imgSrc) {
  return `<span class="thumb" style="--c:${soort(a).kleur}"><img src="${imgSrc || drawing(a)}" alt="" loading="lazy" ${a.airborne && (a.track ?? 0) > 180 && (a.track ?? 0) < 360 ? 'style="transform:scaleX(-1)"' : ""}></span>`;
}

// ------------------------------------------------------------------ page chrome and animations

export const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

export function initChrome() {
  const nav = document.querySelector(".nav");
  if (nav) {
    const onScroll = () => nav.classList.toggle("is-solid", scrollY > 20 || nav.dataset.solid === "1");
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
  document.querySelectorAll("[data-version]").forEach((el) => (el.textContent = CFG.version));
  document.querySelectorAll("[data-appstore]").forEach((a) => {
    if (CFG.appStoreURL) { a.href = CFG.appStoreURL; a.querySelector("span") && (a.querySelector("span").textContent = "Download in de App Store"); }
    else a.addEventListener("click", (e) => { e.preventDefault(); a.querySelector("span") && (a.querySelector("span").textContent = "Binnenkort in de App Store"); });
  });
  reveal();
}

/** Elements with .reveal fade/slide in when they scroll into view. */
export function reveal(root = document) {
  const els = root.querySelectorAll(".reveal:not(.is-in)");
  if (!("IntersectionObserver" in window) || reducedMotion) { els.forEach((e) => e.classList.add("is-in")); return; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
  }, { rootMargin: "0px 0px -8% 0px" });
  els.forEach((e) => io.observe(e));
}

/** Counts a number up to its value. */
export function countUp(el, to) {
  if (!el) return;
  const from = Number(el.dataset.v || 0);
  el.dataset.v = to;
  if (reducedMotion || from === to) { el.textContent = nf.format(to); return; }
  const t0 = performance.now(), dur = 1100;
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = nf.format(Math.round(from + (to - from) * e));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ------------------------------------------------------------------ Apple Kaarten (MapKit JS)

let mapkitReady = null;
/** Loads MapKit JS once; the token comes from the 112Heli server (only valid on this website). */
export function loadMapKit() {
  if (mapkitReady) return mapkitReady;
  mapkitReady = new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.core.js";
    s.crossOrigin = "anonymous";
    s.dataset.libraries = "map,annotations,overlays";
    s.dataset.callback = "__mkLoaded";
    window.__mkLoaded = () => {
      const mk = window.mapkit;
      let inited = false;
      mk.init({
        language: "nl",
        authorizationCallback: async (done) => {
          try {
            const r = await fetch(`${API}/v1/mapkit-token`, { signal: AbortSignal.timeout(8000) });
            const { token } = await r.json();
            done(token);
            if (!inited) { inited = true; resolve(mk); }
          } catch { resolve(null); }
        },
      });
      mk.addEventListener("error", () => resolve(null));
      setTimeout(() => resolve(mk), 4000);
    };
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
  return mapkitReady;
}

export const NL_REGION = (mk) => new mk.CoordinateRegion(new mk.Coordinate(52.2, 5.4), new mk.CoordinateSpan(3.3, 3.6));

/** DOM element for an aircraft marker, like A-Alerts: the drawing (mirrored when flying west), the name, and
 *  "positie 40 s oud" when the position is older than a minute. */
export function markerElement(a, selected) {
  const el = document.createElement("div");
  const west = a.airborne && a.track > 180 && a.track < 360;
  el.className = `mk-marker${selected ? " sel" : ""}${isOld(a) ? " old" : ""}`;
  el.style.setProperty("--c", soort(a).kleur);
  el.innerHTML = `<img class="draw" src="${drawing(a)}" alt="" style="${west ? "transform:scaleX(-1)" : ""}"><span class="lbl">${esc(a.naam)}${isOld(a) ? `<span class="age">positie ${age(ageOf(a))} oud</span>` : ""}</span>`;
  return el;
}
