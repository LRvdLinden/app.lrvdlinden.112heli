// Teksten in het Nederlands en Engels. Statische teksten via data-i18n, de rest via t().
const NL = {
  "tab.live": "Live", "tab.flight": "Vlucht", "tab.log": "Logboek", "tab.stats": "Cijfers", "tab.season": "Seizoen", "tab.info": "Info",
  "viewers": "kijken nu mee", "viewers.one": "kijkt nu mee", "viewers.title": "Aantal mensen dat MV3 nu open heeft",
  "set.dist": "Afstand", "set.speed": "Snelheid", "set.alt": "Hoogte", "set.clock": "Klok", "set.reset": "Standaardinstellingen",
  "ac.reg": "Registratie", "ac.type": "Type", "ac.country": "Land", "ac.nl": "Nederland",
  "fl.pick": "Kies een vlucht in het logboek.", "log.sum": "{n} vluchten · {h} in de lucht",
  "dest.likely": "Waarschijnlijk naar", "dest.eta": "aankomst ±", "dest.est": "Schatting uit koers en daling", "dest.gp": "Raceweek: {gp}",
  "se.calendar": "Kalender", "ov.q6": "Hoe weet MV3 de bestemming?",
  "ov.a6": "Een vliegtuig zendt zijn bestemming niet uit. MV3 schat die uit de koers, de daling en de snelheid, en noemt dan het vliegveld dat recht vooruit ligt. Het blijft een schatting; na de landing zie je de echte aankomstplaats.",
  "share.live": "PH-UTL live op MV3", "share.flight": "Deel deze vlucht",
  skip: "Naar de vluchten",
  "nav.live": "Live", "nav.flights": "Vluchten", "nav.stats": "Cijfers", "nav.season": "Seizoen", "nav.about": "Over",
  "set.title": "Instellingen", "set.units": "Eenheden", "set.metric": "Metrisch (m, km/u, km)", "set.aviation": "Luchtvaart (ft, kt, nm)",
  "set.imperial": "Imperiaal (ft, mph, mi)", "set.time": "Tijd", "set.local": "Mijn tijd", "set.follow": "Kaart volgt de jet", "set.circuits": "Circuits op de kaart",
  "set.theme": "Weergave", "set.auto": "Automatisch (zoals je apparaat)", "set.light": "Licht", "set.dark": "Donker",
  "state.loading": "Laden…", "state.air": "In de lucht", "state.ground": "Aan de grond", "state.away": "Uit beeld", "state.oor": "Buiten bereik",
  "oor.note": "geen ontvangst boven zee sinds {t}, positie geschat langs de route", "est": "geschat", "ac.alt": "De Falcon 8X PH-UTL in zwart en oranje bij zonsondergang",
  "hero.sub": "De Falcon 8X van Max Verstappen, live.",
  "t.alt": "Hoogte", "t.gs": "Snelheid", "t.hdg": "Koers", "t.vs": "Stijgen / dalen", "t.since": "In de lucht", "t.since.ground": "Aan de grond",
  "t.dist": "Gevlogen", "t.lastseen": "Laatst gezien",
  "tk.next": "Volgende GP",
  "fl.eyebrow": "Logboek · 30 dagen", "fl.title": "Logboek",
  "fl.lead": "Kies een vlucht en speel hem af: de jet vliegt de route opnieuw, met hoogte en snelheid in de grafiek.",
  "fl.none": "Geen vluchten in de afgelopen 30 dagen.", "fl.error": "De vluchten konden niet worden opgehaald.", "fl.live": "Nu in de lucht",
  "share.copy": "Kopieer link", "share.copied": "Link gekopieerd", "th.close": "Sluiten",
  "st.eyebrow": "De afgelopen 30 dagen", "st.title": "De afgelopen 30 dagen", "st.days": "Vliegdagen", "st.daysNote": "Elk vakje is een dag; hoe feller, hoe langer in de lucht.",
  "st.countries": "Landen", "st.top": "Vaakste bestemmingen",
  "st.flights": "vluchten", "st.hours": "uur in de lucht", "st.dist": "gevlogen", "st.longest": "langste vlucht",
  "st.earth": "{n}× rond de aarde", "st.avg": "gemiddeld {d} per vlucht",
  "se.eyebrow": "Formule 1", "se.title": "Het seizoen",
  "se.lead": "Waar de jet naartoe gaat, gaat de kalender ook. Bij elke GP zie je of de jet er in de raceweek is geland.",
  "se.next": "Volgende Grand Prix", "se.last": "Laatste Grand Prix", "se.days": "dagen", "se.hours": "uur", "se.min": "min", "se.sec": "sec",
  "se.jetdist": "De jet staat nu {d} van het circuit.", "se.jetthere": "De jet is al in de buurt van het circuit.",
  "se.round": "Ronde {n}", "se.spot": "Jet gespot in de raceweek", "se.none": "De F1-gegevens zijn nu niet beschikbaar.", "se.points": "{n} punten",
  "th.dep": "Vertrek", "th.arr": "Aankomst", "th.now": "Laatste positie", "th.dur": "Duur", "th.dist": "Afstand", "th.maxalt": "Max. hoogte",
  "th.avg": "Gem. snelheid", "th.maxgs": "max. {v}", "th.route": "gevlogen route", "th.ongoing": "onderweg", "th.flight": "Vlucht",
  "th.legendAlt": "Hoogte", "th.legendGs": "Snelheid", "th.few": "Te weinig punten voor deze vlucht.",
  "th.landedAt": "Geland bij {c} · {gp}", "th.departedAt": "Vertrokken bij {c} · {gp}", "th.home": "Thuis in Monaco",
  "unknown": "Onbekend", "ago.s": "{n} s geleden", "ago.m": "{n} min geleden", "ago.h": "{n} uur geleden", "ago.d": "{n} dagen geleden",
  "above": "Boven {p}", "at": "Bij {p}", "over.sea": "Boven zee", "map.error": "De kaart kon niet worden geladen.",
  "ov.eyebrow": "Over MV3", "ov.title": "Hoe het werkt",
  "ov.q1": "Waar komen de gegevens vandaan?", "ov.a1": "Elk vliegtuig zendt zijn positie, hoogte en snelheid uit via ADS-B. Vrijwilligers over de hele wereld vangen die signalen op en delen ze via adsb.lol. MV3 haalt de positie van PH-UTL elke minuut op.",
  "ov.q2": "Hoe actueel is het?", "ov.a2": "Meestal loopt de positie minder dan een minuut achter. Tussen twee metingen schuift de jet op de kaart vloeiend verder op basis van koers en snelheid.",
  "ov.q3": "Waarom zie ik soms een landing midden in zee?", "ov.a3": "Boven zee en dun bevolkte gebieden zijn er weinig ontvangers. Valt het signaal lang weg, dan kan een vlucht in twee delen worden geknipt. Een start die hoog in de lucht begint, telt MV3 niet als echte start.",
  "ov.q4": "Is dit officieel?", "ov.a4": "Nee. MV3 is een fanproject en is niet verbonden aan Max Verstappen, Red Bull Racing of de Formule 1. Er staan alleen openbare ADS-B-gegevens op, en we tonen plaatsen op het niveau van een stad of vliegveld.",
  "ov.q5": "Meer hulpdiensten en toestellen?", "ov.a5": "MV3 draait op dezelfde server als 112Heli, de app voor alles wat vliegt voor de Nederlandse hulpdiensten.",
  "foot.made": "Een fanproject, niet verbonden aan Max Verstappen, Red Bull Racing of de Formule 1.", "foot.by": "Website gemaakt door",
  "foot.promo": "Lifeliners, politie en Kustwacht live",
  "foot.more": "Meer apps van de ontwikkelaar", "foot.moreSub": "Apps voor iPhone, iPad, Apple TV en Homey", "foot.go": "Bekijk",
  "foot.credits": "Posities: adsb.lol (ODbL) · Kaart: Apple Kaarten · F1-gegevens: Jolpica-F1 · Plaatsnamen: Apple",
};

const EN = {
  "tab.live": "Live", "tab.flight": "Flight", "tab.log": "Logbook", "tab.stats": "Numbers", "tab.season": "Season", "tab.info": "Info",
  "viewers": "watching now", "viewers.one": "watching now", "viewers.title": "People who have MV3 open right now",
  "set.dist": "Distance", "set.speed": "Speed", "set.alt": "Altitude", "set.clock": "Clock", "set.reset": "Reset to defaults",
  "ac.reg": "Registration", "ac.type": "Type", "ac.country": "Country", "ac.nl": "Netherlands",
  "fl.pick": "Pick a flight in the logbook.", "log.sum": "{n} flights · {h} in the air",
  "dest.likely": "Probably heading to", "dest.eta": "arrival ±", "dest.est": "Estimate from heading and descent", "dest.gp": "Race week: {gp}",
  "se.calendar": "Calendar", "ov.q6": "How does MV3 know the destination?",
  "ov.a6": "Aircraft don't broadcast their destination. MV3 estimates it from heading, descent and speed, and names the airport straight ahead. It remains an estimate; after landing you see the real arrival place.",
  "share.live": "PH-UTL live on MV3", "share.flight": "Share this flight",
  skip: "Skip to the flights",
  "nav.live": "Live", "nav.flights": "Flights", "nav.stats": "Numbers", "nav.season": "Season", "nav.about": "About",
  "set.title": "Settings", "set.units": "Units", "set.metric": "Metric (m, km/h, km)", "set.aviation": "Aviation (ft, kt, nm)",
  "set.imperial": "Imperial (ft, mph, mi)", "set.time": "Time", "set.local": "My time", "set.follow": "Map follows the jet", "set.circuits": "Circuits on the map",
  "set.theme": "Appearance", "set.auto": "Automatic (like your device)", "set.light": "Light", "set.dark": "Dark",
  "state.loading": "Loading…", "state.air": "Airborne", "state.ground": "On the ground", "state.away": "Out of range", "state.oor": "Out of coverage",
  "oor.note": "no reception over the ocean since {t}, position estimated along the route", "est": "estimated", "ac.alt": "The Falcon 8X PH-UTL in black and orange at sunset",
  "hero.sub": "Max Verstappen's Falcon 8X, live.",
  "t.alt": "Altitude", "t.gs": "Speed", "t.hdg": "Heading", "t.vs": "Climb / descent", "t.since": "Airborne", "t.since.ground": "On the ground",
  "t.dist": "Flown", "t.lastseen": "Last seen",
  "tk.next": "Next GP",
  "fl.eyebrow": "Logbook · 30 days", "fl.title": "Logbook",
  "fl.lead": "Pick a flight and play it back: the jet flies the route again, with altitude and speed in the chart.",
  "fl.none": "No flights in the last 30 days.", "fl.error": "The flights could not be loaded.", "fl.live": "Airborne now",
  "share.copy": "Copy link", "share.copied": "Link copied", "th.close": "Close",
  "st.eyebrow": "The last 30 days", "st.title": "The last 30 days", "st.days": "Flying days", "st.daysNote": "Each square is a day; the brighter, the longer in the air.",
  "st.countries": "Countries", "st.top": "Top destinations",
  "st.flights": "flights", "st.hours": "hours in the air", "st.dist": "flown", "st.longest": "longest flight",
  "st.earth": "{n}× around the Earth", "st.avg": "{d} per flight on average",
  "se.eyebrow": "Formula 1", "se.title": "The season",
  "se.lead": "Where the jet goes, the calendar goes. Every GP shows whether the jet landed nearby in race week.",
  "se.next": "Next Grand Prix", "se.last": "Last Grand Prix", "se.days": "days", "se.hours": "hrs", "se.min": "min", "se.sec": "sec",
  "se.jetdist": "The jet is now {d} from the circuit.", "se.jetthere": "The jet is already near the circuit.",
  "se.round": "Round {n}", "se.spot": "Jet spotted in race week", "se.none": "F1 data is not available right now.", "se.points": "{n} points",
  "th.dep": "Departure", "th.arr": "Arrival", "th.now": "Last position", "th.dur": "Duration", "th.dist": "Distance", "th.maxalt": "Max. altitude",
  "th.avg": "Avg. speed", "th.maxgs": "max. {v}", "th.route": "route flown", "th.ongoing": "en route", "th.flight": "Flight",
  "th.legendAlt": "Altitude", "th.legendGs": "Speed", "th.few": "Not enough points for this flight.",
  "th.landedAt": "Landed near {c} · {gp}", "th.departedAt": "Departed near {c} · {gp}", "th.home": "Home in Monaco",
  "unknown": "Unknown", "ago.s": "{n} s ago", "ago.m": "{n} min ago", "ago.h": "{n} h ago", "ago.d": "{n} days ago",
  "above": "Over {p}", "at": "At {p}", "over.sea": "Over the sea", "map.error": "The map could not be loaded.",
  "ov.eyebrow": "About MV3", "ov.title": "How it works",
  "ov.q1": "Where does the data come from?", "ov.a1": "Every aircraft broadcasts its position, altitude and speed via ADS-B. Volunteers around the world receive those signals and share them through adsb.lol. MV3 fetches the position of PH-UTL every minute.",
  "ov.q2": "How up to date is it?", "ov.a2": "The position is usually less than a minute behind. Between two fixes the jet glides on smoothly based on its heading and speed.",
  "ov.q3": "Why do I sometimes see a landing in the middle of the sea?", "ov.a3": "There are few receivers over the sea and remote areas. When the signal drops for a long time, a flight can be cut in two. A takeoff that starts high in the air is not counted as a real takeoff.",
  "ov.q4": "Is this official?", "ov.a4": "No. MV3 is a fan project and is not affiliated with Max Verstappen, Red Bull Racing or Formula 1. It only shows public ADS-B data, and places at the level of a city or airport.",
  "ov.q5": "More emergency aircraft?", "ov.a5": "MV3 runs on the same server as 112Heli, the app for everything that flies for the Dutch emergency services.",
  "foot.made": "A fan project, not affiliated with Max Verstappen, Red Bull Racing or Formula 1.", "foot.by": "Website made by",
  "foot.promo": "Dutch air ambulances, police and Coastguard live",
  "foot.more": "More apps by the developer", "foot.moreSub": "Apps for iPhone, iPad, Apple TV and Homey", "foot.go": "View",
  "foot.credits": "Positions: adsb.lol (ODbL) · Map: Apple Maps · F1 data: Jolpica-F1 · Place names: Apple",
};

const STORE = "mv3.lang";
function stored() { try { return localStorage.getItem(STORE); } catch { return null; } }
export let lang = stored() || ((navigator.language || "nl").toLowerCase().startsWith("nl") ? "nl" : "en");
export const locale = () => (lang === "nl" ? "nl-NL" : "en-GB");

export function t(key, vars = {}) {
  const s = (lang === "nl" ? NL : EN)[key] ?? NL[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ""));
}

export function applyStatic() {
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-alt]").forEach((el) => { el.alt = t(el.dataset.i18nAlt); });
  const lb = document.getElementById("langLabel");
  if (lb) lb.textContent = lang === "nl" ? "EN" : "NL";
}

export function setLang(l) {
  lang = l;
  try { localStorage.setItem(STORE, l); } catch {}
  applyStatic();
}
