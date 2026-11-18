// 112Heli fallback: reuse the live, already processed A-Alerts aircraft feed.
// Both projects are maintained together. No Koyeb token is exposed to clients or logs.
// A-Alerts keeps the original ADS-B last-seen timestamp, so stale positions are rejected here.
const DEFAULT_API = "https://p2000-apeldoorn-api.lrvdlinden.workers.dev";
const MAX_AGE_MS = 60_000;
const ACCEPTED_SOORTEN = new Set(["trauma", "politie", "kustwacht", "defensie", "kmar", "regering", "bijzonder"]);

export function fromAAlerts(item, at = Date.now()) {
  if (!item || typeof item !== "object") return null;
  const hex = String(item.hex || "").trim().toLowerCase();
  const lat = Number(item.lat), lon = Number(item.lon);
  const seenAt = Date.parse(item.gezien || "");
  if (!/^[0-9a-f]{6}$/.test(hex) || item.lat == null || item.lon == null ||
      !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 ||
      !Number.isFinite(seenAt) || seenAt > at + 10_000 || at - seenAt >= MAX_AGE_MS ||
      !ACCEPTED_SOORTEN.has(item.soort)) return null;
  const alt = Number(item.hoogte_ft), gs = Number(item.snelheid_kt), track = Number(item.koers);
  const reg = String(item.registratie || "").trim().toUpperCase();
  const callsign = String(item.callsign || "").trim().toUpperCase();
  return {
    hex, lat, lon, r: reg || undefined, flight: callsign || undefined, t: item.type || undefined,
    alt_baro: item.op_grond === true ? "ground" : item.hoogte_ft != null && Number.isFinite(alt) ? alt : undefined,
    gs: item.snelheid_kt != null && Number.isFinite(gs) ? gs : undefined,
    track: item.koers != null && Number.isFinite(track) ? track : undefined,
    seen_pos: Math.max(0, (at - seenAt) / 1000),
    // A-Alerts has already classified these aircraft. Keep that classification
    // even if an ADS-B response no longer contains a callsign or operator.
    _aalerts: {
      naam: String(item.naam || "").trim() || callsign || reg || hex,
      soort: item.soort,
      icoon: item.icoon || null,
      key: item.id || hex,
      basis: item.basis || null,
    },
  };
}

export async function fetchAAlertsAircraft(env, at = Date.now()) {
  const root = String(env.AALERTS_HELI_URL || DEFAULT_API).replace(/\/+$/, "");
  const urls = ["/v1/helikopters", "/v1/lucht"];
  const results = await Promise.all(urls.map(async path => {
    try {
      const res = await fetch(root + path, {
        headers: { accept: "application/json", "user-agent": "112Heli/1.0 (+https://112heli.lrvdlinden.app)" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      if (body.fout) throw new Error("A-Alerts upstream unavailable");
      const records = path === "/v1/lucht" ? body.toestellen : body.helikopters;
      if (!Array.isArray(records)) throw new Error("Invalid A-Alerts aircraft response");
      return { ok: true, records };
    } catch (error) {
      return { ok: false, error: String(error.message || error), records: [] };
    }
  }));
  if (!results.some(x => x.ok)) {
    throw new Error("A-Alerts fallback unavailable: " + results.map(x => x.error).join("; "));
  }
  const byHex = new Map();
  for (const source of results) {
    for (const item of source.records) {
      const a = fromAAlerts(item, at);
      if (a && (!byHex.has(a.hex) || a.seen_pos < byHex.get(a.hex).seen_pos)) byHex.set(a.hex, a);
    }
  }
  // A feed can legitimately have zero aircraft in the air.
  return [...byHex.values()];
}
