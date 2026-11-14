// What 112Heli follows: everything that flies in A-Alerts. The recognition itself is A-Alerts code, copied unchanged
// into ./aalerts/ (from LRvdLinden/p2000-apeldoorn, branch a-alerts):
//  - helicopters: Lifeliner 1–4 and police (Zulu), by callsign, registration, airframe or operator (aalerts/heli.js)
//  - defence (Dutch only), coastguard, Marechaussee and PH-GOV, by airframe and type (aalerts/lucht.js)
// This file adds the pure helpers 112Heli needs on top (no I/O, unit tested).
import { identify } from "./aalerts/heli.js";
import { luchtSoort } from "./aalerts/lucht.js";
import { plaatsBij } from "./aalerts/plaats.js";
import locaties from "./aalerts/locaties.js";

/** The Netherlands plus a margin (same box as A-Alerts uses for its defence layer). */
const NL = { zuid: 50.7, noord: 53.7, west: 3.1, oost: 7.3 };
export const inNL = (lat, lon) => lat >= NL.zuid && lat <= NL.noord && lon >= NL.west && lon <= NL.oost;

/** The groups a user can switch on and off (pushmeldingen) – same names as the A-Alerts "soort". */
export const SOORTEN = ["trauma", "politie", "kustwacht", "defensie", "kmar", "regering", "bijzonder"];

/** Just for fun: Max Verstappen's Dassault Falcon 8X, by airframe address and registration. */
const BIJZONDER = { "4867e6": { naam: "Max Verstappen", icoon: "verstappen", type: "FA8X" } };
const BIJZONDER_REG = { "PH-UTL": "4867e6" };
/** Switched on by default, like in A-Alerts ("Lifeliners en politiehelikopters staan standaard aan"). */
export const STANDAARD_SOORTEN = ["trauma", "politie"];

const HELI_ICONEN = new Set(["heli", "kustwacht_aw189", "kustwacht_heli", "apache", "chinook", "cougar", "nh90"]);
export const isHeli = (a) => a.soort === "trauma" || a.soort === "politie" || HELI_ICONEN.has(a.icoon);

/**
 * One adsb.lol record → { hex, key, naam, soort, icoon, basis, reg, callsign, type, herkenning } or null.
 * learnedHeli: hex → A-Alerts heli object; learnedLucht: hex → { soort, icoon, naam }.
 */
export function classify(ac, learnedHeli = new Map(), learnedLucht = new Map()) {
  const hex = String(ac.hex || "").trim().toLowerCase();
  if (!hex || hex.startsWith("~")) return null; // "~" = TIS-B track without a real airframe address
  const base = { hex, reg: ac.r ? String(ac.r).trim().toUpperCase() : null, callsign: String(ac.flight || "").trim().toUpperCase() || null, type: ac.t || null };

  const special = BIJZONDER[hex] || BIJZONDER[BIJZONDER_REG[base.reg] || ""];
  if (special) return { ...base, type: base.type || special.type, key: hex, naam: special.naam, soort: "bijzonder", icoon: special.icoon, basis: null, herkenning: "registratie" };

  const h = identify(ac, learnedHeli);
  if (h) return { ...base, key: h.id, naam: h.naam, soort: h.soort, icoon: null, basis: h.basis || null, herkenning: h.herkenning };

  if (typeof ac.lat === "number" && typeof ac.lon === "number" && !inNL(ac.lat, ac.lon)) return null;
  const l = luchtSoort(ac, learnedLucht);
  if (l) return { ...base, key: hex, naam: l.naam, soort: l.soort, icoon: l.icoon, basis: null, herkenning: null };
  return null;
}

/** Altitude in feet, or null. "ground" counts as 0. */
export const altitude = (ac) => (ac.alt_baro === "ground" ? 0 : Number.isFinite(ac.alt_baro) ? ac.alt_baro : Number.isFinite(ac.alt_geom) ? ac.alt_geom : null);

/** In the air? Helicopters hover, so speed alone is not enough. */
export function isAirborne(ac) {
  if (ac.alt_baro === "ground") return false;
  const alt = altitude(ac);
  const gs = Number(ac.gs) || 0;
  if (alt == null) return gs > 30;
  return alt > 300 || gs > 25;
}

/** Great-circle distance in km. */
export function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** The hospital or base within 3 km (same rule as A-Alerts): { naam, soort: "ziekenhuis" | "basis" } or null. */
export function plekVan(lat, lon) {
  if (lat == null || lon == null) return null;
  let best = null;
  for (const [soort, lijst] of [["ziekenhuis", locaties.ziekenhuizen || []], ["basis", locaties.bases || []]]) {
    for (const l of lijst) {
      const d = distanceKm(lat, lon, l.lat, l.lon);
      if (d < 3 && (!best || d < best.d)) best = { naam: l.naam, soort, d };
    }
  }
  return best ? { naam: best.naam, soort: best.soort } : null;
}

/** "Boven Teuge, Voorst": the nearest Dutch place, or null above sea or abroad. */
export const bovenPlaats = (lat, lon) => (lat == null || lon == null ? null : plaatsBij(lat, lon)?.tekst || null);

/**
 * Grote inzet (A-Alerts rule): two or more helicopters within 1.5 km of each other, on the ground or low and slow,
 * at a spot that is neither a hospital nor a base. Input: [{ hex, naam, soort, icoon, lat, lon, alt, gs, airborne }].
 * Returns [{ hexes, lat, lon, plaats }].
 */
export function findClusters(list) {
  const terPlekke = (a) => a.lat != null && (!a.airborne || ((a.gs ?? 99) < 35 && a.alt != null && a.alt < 1500));
  const kand = (list || []).filter((a) => isHeli(a) && terPlekke(a) && !plekVan(a.lat, a.lon));
  const uit = [], gehad = new Set();
  for (const a of kand) {
    if (gehad.has(a.hex)) continue;
    const groep = kand.filter((b) => b.hex === a.hex || (!gehad.has(b.hex) && distanceKm(a.lat, a.lon, b.lat, b.lon) <= 1.5));
    if (groep.length < 2) continue;
    groep.forEach((g) => gehad.add(g.hex));
    const lat = groep.reduce((s, g) => s + g.lat, 0) / groep.length, lon = groep.reduce((s, g) => s + g.lon, 0) / groep.length;
    uit.push({ hexes: groep.map((g) => g.hex).sort(), lat, lon, plaats: plaatsBij(lat, lon)?.tekst || null });
  }
  return uit;
}

/** Should a device get a takeoff push for this aircraft at this place? */
export function wantsTakeoff(device, aircraft, lat, lon) {
  if (!device.enabled) return false;
  const favorites = safeJSON(device.favorites, []);
  if (device.fav_alerts && favorites.includes(aircraft.hex)) return true;
  if (!device.takeoff) return false;
  const soorten = safeJSON(device.soorten, STANDAARD_SOORTEN);
  if (!soorten.includes(aircraft.soort)) return false;
  return withinRadius(device, lat, lon);
}

export function withinRadius(device, lat, lon) {
  const radius = Number(device.radius_km) || 0;
  if (!radius || device.lat == null || device.lon == null) return true; // 0 = heel Nederland
  return distanceKm(device.lat, device.lon, lat, lon) <= radius;
}

export function safeJSON(s, fallback) {
  try { const v = JSON.parse(s); return v ?? fallback; } catch { return fallback; }
}

export const SOORT_LABEL = {
  trauma: "Traumahelikopter", politie: "Politiehelikopter", kustwacht: "Kustwacht",
  defensie: "Defensie", kmar: "Koninklijke Marechaussee", regering: "Regering", bijzonder: "Privéjet",
};
