// F1 for the page of Max Verstappen: the season calendar (with circuit positions) from /v1/f1 (Jolpica-F1),
// and "landed at a circuit" when a flight starts or ends near a circuit in its race week.
import { API } from "./core.js";

export const MAX_HEX = "4867e6";
export const isMax = (hex) => hex === MAX_HEX;

const MONACO = { lat: 43.7347, lon: 7.4206 };
let data = null;

/** Loads /v1/f1 once: { laatste, volgende, kalender: [{ naam, circuit, plaats, datum, lat, lon }] }. */
export async function laadF1() {
  if (data) return data;
  try { data = await (await fetch(`${API}/v1/f1`, { signal: AbortSignal.timeout(10000) })).json(); } catch { data = { kalender: [] }; }
  data.kalender ||= [];
  return data;
}
export const kalender = () => data?.kalender || [];

function km(aLat, aLon, bLat, bLon) {
  const r = Math.PI / 180;
  const h = Math.sin(((bLat - aLat) * r) / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(((bLon - aLon) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/**
 * The Grand Prix a place belongs to: within 80 km of a circuit and within 6 days of that race.
 * Near Monaco (Nice airport included) outside a race week: "thuis in Monaco".
 */
export function circuitBij(lat, lon, ts) {
  if (lat == null || lon == null) return null;
  for (const r of kalender()) {
    const dagen = Math.abs(ts - Date.parse(`${r.datum}T14:00:00Z`) / 1000) / 86400;
    if (dagen <= 6 && km(lat, lon, r.lat, r.lon) <= 80) return { naam: r.circuit, gp: r.naam, thuis: false };
  }
  if (km(lat, lon, MONACO.lat, MONACO.lon) <= 35) return { naam: "thuis in Monaco", gp: "Monaco", thuis: true };
  return null;
}
