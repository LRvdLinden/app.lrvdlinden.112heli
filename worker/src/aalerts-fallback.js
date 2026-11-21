// 112Heli's main aircraft source: the live, already processed A-Alerts aircraft feed (helicopters and defence/coastguard).
// First api.a-alerts.nl (A-Alerts' own engine with its own adsb.lol key, independent of Cloudflare), then the A-Alerts
// Worker. Both projects are maintained together. No token is exposed to clients or logs.
// A-Alerts keeps the original ADS-B last-seen timestamp, so stale positions are rejected here.
const BIJZONDER_PATH = "/v1/lucht?bijzonder=1";
const ROOTS = ["https://api.a-alerts.nl", "https://p2000-apeldoorn-api.lrvdlinden.workers.dev"];
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
  const roots = (env.AALERTS_HELI_URL ? [env.AALERTS_HELI_URL] : ROOTS).map((r) => String(r).replace(/\/+$/, ""));
  const one = async (root, path) => {
    const res = await fetch(root + path, {
      headers: { accept: "application/json", "user-agent": "112Heli/1.0 (+https://112heli.lrvdlinden.app)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`${root}${path} HTTP ${res.status}`);
    const body = await res.json();
    if (body.fout || body.verouderd) throw new Error(`${root}${path} upstream unavailable`);
    const records = path.startsWith("/v1/lucht") ? body.toestellen : body.helikopters;
    if (!Array.isArray(records)) throw new Error(`${root}${path} invalid response`);
    return records;
  };
  // Per list: the first address that answers properly wins.
  // "/v1/lucht?bijzonder=1": Max (PH-UTL, soort bijzonder) and PH-GOV (regering) all over the world. Only api.a-alerts.nl
  // has it (Max must never be on the A-Alerts map), so it is not asked at the A-Alerts Worker.
  const results = await Promise.all(["/v1/helikopters", "/v1/lucht", BIJZONDER_PATH].map(async (path) => {
    const errors = [];
    for (const root of path === BIJZONDER_PATH && !env.AALERTS_HELI_URL ? roots.slice(0, 1) : roots) {
      try { return { ok: true, path, root, records: await one(root, path) }; }
      catch (error) { errors.push(String(error.message || error)); }
    }
    return { ok: false, path, error: errors.join("; "), records: [] };
  }));
  // The helicopters are the core: without them this source counts as failed (the caller then asks adsb.lol).
  if (!results[0].ok) {
    throw new Error("A-Alerts unavailable: " + results.map(x => x.error).filter(Boolean).join("; "));
  }
  const byHex = new Map();
  for (const source of results) {
    for (const item of source.records) {
      const a = fromAAlerts(item, at);
      if (a && (!byHex.has(a.hex) || a.seen_pos < byHex.get(a.hex).seen_pos)) byHex.set(a.hex, a);
    }
  }
  // A feed can legitimately have zero aircraft in the air.
  const list = [...byHex.values()];
  list._root = results[0].root;
  list._luchtOk = results[1].ok;
  return list;
}
