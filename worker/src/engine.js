// Ingest: fetch ADS-B, keep state per aircraft, detect takeoff/landing and grote inzet, send pushes.
import { classify, isAirborne, altitude, distanceKm, findClusters, wantsTakeoff, withinRadius, plekVan, bovenPlaats, isHeli, safeJSON, SOORT_LABEL } from "./fleet.js";
import { fetchAAlertsAircraft } from "./aalerts-fallback.js";
import { sendPush, isDeadToken, apnsConfigured } from "./apple.js";

/**
 * Where it landed (A-Alerts "landingsplek benoemen"): "terug op de basis", "geland bij <ziekenhuis>" or "geland bij <plaats>".
 * Returns { place, text }.
 */
export function landingSpot(lat, lon) {
  const p = plekVan(lat, lon);
  if (p?.soort === "basis") return { place: p.naam, text: `is terug op de basis (${p.naam})` };
  if (p?.soort === "ziekenhuis") return { place: p.naam, text: `is geland bij ${p.naam}` };
  const boven = bovenPlaats(lat, lon);
  return boven ? { place: boven, text: `is geland bij ${boven}` } : { place: null, text: "is geland op locatie" };
}

// Same circle as A-Alerts: the whole of the Netherlands.
const POINT = { lat: 52.2, lon: 5.4, nm: 160 };
const now = () => Math.floor(Date.now() / 1000);
let detourUntil = 0;

/**
 * Main source: A-Alerts (api.a-alerts.nl only; never the old A-Alerts Worker), so 112Heli shows exactly the helicopters and
 * defence/coastguard aircraft that A-Alerts shows. When A-Alerts does not answer, adsb.lol directly; when that refuses
 * Cloudflare's shared addresses (HTTP 429), via the A-Alerts verkeer service (VERKEER_URL / VERKEER_TOKEN, own
 * address), and for 10 minutes straight there.
 */
export async function fetchADSB(env) {
  const direct = () => fetch(env.ADSB_URL || `https://api.adsb.lol/v2/point/${POINT.lat}/${POINT.lon}/${POINT.nm}`, {
    headers: { accept: "application/json", "user-agent": "112Heli/1.0 (+https://lrvdlinden.app)" },
    signal: AbortSignal.timeout(8_000),
  });
  const service = Boolean(env.VERKEER_URL && env.VERKEER_TOKEN);
  const viaService = () => fetch(`${String(env.VERKEER_URL).replace(/\/+$/, "")}/adsb?lat=${POINT.lat}&lon=${POINT.lon}&nm=${POINT.nm}`, {
    headers: { authorization: `Bearer ${env.VERKEER_TOKEN}` }, signal: AbortSignal.timeout(12_000),
  });
  let list = null, source = "a-alerts", aalertsError = null;
  try { list = await fetchAAlertsAircraft(env); }
  catch (e) { aalertsError = e.message; console.warn("[a-alerts]", e.message); }
  if (!list) {
    let res = null;
    if (!(service && Date.now() < detourUntil)) {
      res = await direct().catch(() => null);
      if (!res?.ok && service) detourUntil = Date.now() + 10 * 60_000;
    }
    if (!res?.ok && service) res = await viaService().catch(() => null);
    const errors = [aalertsError, `adsb.lol HTTP ${res?.status ?? "geen antwoord"}`];
    if (res?.ok) {
      const body = await res.json().catch(() => null);
      if (Array.isArray(body?.ac)) { list = body.ac; source = "adsb.lol"; }
      else errors.push("adsb.lol ongeldige data");
    }
    // adsb.lol now asks for a key (HTTP 401) and has a daily limit: then the free, keyless networks.
    for (const [name, url] of OPEN_PUNT) {
      if (list) break;
      const r = await fetch(url, { headers: { accept: "application/json", "user-agent": "112Heli/1.0 (+https://lrvdlinden.app)" }, signal: AbortSignal.timeout(8_000) }).catch(() => null);
      const body = r?.ok ? await r.json().catch(() => null) : null;
      const ac = body?.ac ?? body?.aircraft;
      if (Array.isArray(ac)) { list = ac; source = name; }
      else errors.push(`${name} HTTP ${r?.status ?? "geen antwoord"}`);
    }
    if (!list) throw new Error(errors.filter(Boolean).join("; "));
  }
  // Not in A-Alerts (it follows Dutch aircraft only): the Belgian SAR NH90 RN-01, asked by airframe.
  if (source === "a-alerts") {
    for (const hex of BUITENLAND) {
      const best = await freshestOf(hexUrls(hex));
      if (best) list.push(best);
    }
  }
  // Followed worldwide (not only above the Netherlands): Max Verstappen's jet (MV3). Only for these aircraft a second
  // source, airplanes.live, is asked as well: its receivers differ, so at the edge of coverage (Ireland, Azores,
  // Newfoundland) the jet is seen a little longer. The freshest position wins.
  for (const hex of WERELDWIJD) {
    if (list.some((a) => String(a.hex).toLowerCase() === hex)) continue;
    const best = await freshestOf(hexUrls(hex));
    if (best) list.push(best);
  }
  // The government aircraft PH-GOV all over the world too, looked up by registration (A-Alerts only sees it near home).
  for (const reg of WERELDWIJD_REG) {
    if (list.some((a) => String(a.r || "").toUpperCase() === reg)) continue;
    const best = await freshestOf(regUrls(reg));
    if (best) list.push(best);
  }
  list._source = source;
  return list;
}

const ageOf = (a) => Number(a.seen_pos ?? a.seen ?? 999);

/** Asks each source (one after another, adsb.lol first) and returns the record with the freshest position. */
export async function freshestOf(urls) {
  let best = null;
  for (const url of urls) {
    if (best && ageOf(best) <= 30) break;
    const r = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "112Heli/1.0 (+https://lrvdlinden.app)" }, signal: AbortSignal.timeout(6_000),
    }).catch(() => null);
    if (!r?.ok) continue;
    const b = await r.json().catch(() => null);
    for (const a of b?.ac || b?.aircraft || []) if (a.lat != null && (!best || ageOf(a) < ageOf(best))) best = a;
  }
  return best;
}

/** Keyless open networks, same circle (both allow at most 250 NM). */
const OPEN_PUNT = [
  ["airplanes.live", `https://api.airplanes.live/v2/point/${POINT.lat}/${POINT.lon}/${POINT.nm}`],
  ["adsb.fi", `https://opendata.adsb.fi/api/v2/lat/${POINT.lat}/lon/${POINT.lon}/dist/${POINT.nm}`],
];
/** One airframe at every network; the freshest position wins. */
const hexUrls = (hex) => [`https://api.adsb.lol/v2/hex/${hex}`, `https://api.airplanes.live/v2/hex/${hex}`, `https://opendata.adsb.fi/api/v2/hex/${hex}`];

/** Foreign aircraft 112Heli shows that A-Alerts does not have (by airframe): Belgian SAR NH90 RN-01. */
export const BUITENLAND = ["44f6a0"];

/** Aircraft followed all over the world (hex), not just within the circle around the Netherlands. */
export const WERELDWIJD = ["4867e6"];
/** Aircraft followed all over the world by registration: the Dutch government aircraft. */
export const WERELDWIJD_REG = ["PH-GOV"];
const regUrls = (reg) => [`https://api.adsb.lol/v2/reg/${reg}`, `https://api.airplanes.live/v2/reg/${reg}`, `https://opendata.adsb.fi/api/v2/registration/${reg}`];

/** Airframes recognised for sure before, so they are still known under another callsign (A-Alerts "learned"). */
async function learned(env) {
  const heli = new Map(), lucht = new Map();
  const rows = (await env.DB.prepare("SELECT * FROM aircraft WHERE learn = 1").all()).results || [];
  for (const r of rows) {
    if (r.icoon) lucht.set(r.hex, { soort: r.soort, icoon: r.icoon, naam: r.naam });
    else heli.set(r.hex, { id: r.akey, naam: r.naam, soort: r.soort, basis: r.basis, callsigns: [] });
  }
  return { heli, lucht };
}

/**
 * Speed (kn) and track (°). Some records (e.g. a Dash 8 of the Coastguard) come without them: then they are worked out from
 * the previous position (at most 3 minutes old), or the last known values are kept.
 */
export function speedAndTrack(ac, prev, t) {
  let gs = Number.isFinite(ac.gs) ? ac.gs : null;
  let track = Number.isFinite(ac.track) ? ac.track : Number.isFinite(ac.true_heading) ? ac.true_heading : null;
  if ((gs == null || track == null) && prev?.lat != null && prev?.seen_at && t - prev.seen_at > 0 && t - prev.seen_at <= 180) {
    const km = distanceKm(prev.lat, prev.lon, ac.lat, ac.lon);
    if (km > 0.05) {
      if (gs == null) gs = Math.round((km / ((t - prev.seen_at) / 3600)) / 1.852);
      if (track == null) {
        const rad = Math.PI / 180, dLon = (ac.lon - prev.lon) * rad;
        const y = Math.sin(dLon) * Math.cos(ac.lat * rad);
        const x = Math.cos(prev.lat * rad) * Math.sin(ac.lat * rad) - Math.sin(prev.lat * rad) * Math.cos(ac.lat * rad) * Math.cos(dLon);
        track = Math.round(((Math.atan2(y, x) / rad) + 360) % 360);
      }
    }
  }
  return { gs: gs ?? prev?.gs ?? null, track: track ?? prev?.track ?? null };
}

/** One ingest pass. Returns a small summary for logging. */
export async function ingest(env, records) {
  const t = now();
  const seen = [];
  const events = [];
  const known = await learned(env);

  for (const ac of records) {
    const info = classify(ac, known.heli, known.lucht);
    if (!info || !info.hex || ac.lat == null || ac.lon == null) continue;
    // Ignore stale positions (older than 60 s at the source).
    if (Number(ac.seen_pos ?? ac.seen ?? 0) > 60) continue;
    seen.push(info.hex);

    // Callsign change of a known aircraft: often the start of a call-out (A-Alerts "roepnaam gewijzigd").
    const before = await env.DB.prepare("SELECT callsign FROM aircraft WHERE hex = ?").bind(info.hex).first();
    if (before?.callsign && info.callsign && before.callsign !== info.callsign) {
      events.push({ type: "callsign", aircraft: info, oud: before.callsign, nieuw: info.callsign });
    }

    // Learn like A-Alerts: helicopters known by callsign/registration, and all non-defence aircraft.
    const learn = info.icoon ? (info.soort !== "defensie" ? 1 : 0) : (["callsign", "registratie"].includes(info.herkenning) ? 1 : 0);
    await env.DB.prepare(
      `INSERT INTO aircraft (hex, akey, reg, callsign, soort, icoon, type, naam, basis, learn, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(hex) DO UPDATE SET akey = excluded.akey, reg = COALESCE(excluded.reg, reg), callsign = COALESCE(excluded.callsign, callsign),
         soort = excluded.soort, icoon = excluded.icoon, type = COALESCE(excluded.type, type), naam = excluded.naam,
         basis = COALESCE(excluded.basis, basis), learn = MAX(learn, excluded.learn), updated_at = excluded.updated_at`
    ).bind(info.hex, info.key, info.reg, info.callsign, info.soort, info.icoon, info.type, info.naam, info.basis, learn, t).run();

    const prev = await env.DB.prepare("SELECT * FROM state WHERE hex = ?").bind(info.hex).first();
    const airborne = isAirborne(ac);
    const alt = altitude(ac);
    const s = {
      lat: ac.lat, lon: ac.lon, alt, ...speedAndTrack(ac, prev, t),
      airborne: airborne ? 1 : 0, seen_at: t,
      airborne_since: prev?.airborne_since ?? null, landed_at: prev?.landed_at ?? null,
      flight_id: prev?.flight_id ?? null, pos_at: prev?.pos_at ?? null,
    };

    const wasAirborne = Boolean(prev?.airborne);
    if (airborne && !wasAirborne) {
      // A short hop (lands and goes again within 2 minutes) continues the same flight.
      const bounce = prev?.landed_at && t - prev.landed_at < 120 && prev.flight_id;
      if (bounce) {
        await env.DB.prepare("UPDATE flights SET end_ts = NULL WHERE id = ?").bind(prev.flight_id).run();
      } else {
        const place = plekVan(ac.lat, ac.lon)?.naam || bovenPlaats(ac.lat, ac.lon);
        const r = await env.DB.prepare(
          "INSERT INTO flights (hex, start_ts, start_lat, start_lon, start_place, max_alt) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(info.hex, t, ac.lat, ac.lon, place, alt).run();
        s.flight_id = r.meta?.last_row_id ?? null;
        s.airborne_since = t;
        // First seen high in the air (coverage gap, or the worker just started): new flight, but no "opgestegen" push.
        const appeared = (!prev || t - prev.seen_at > 600) && alt != null && alt > 1500;
        if (!appeared) events.push({ type: "takeoff", aircraft: info, lat: ac.lat, lon: ac.lon, place });
      }
    } else if (!airborne && wasAirborne) {
      s.landed_at = t;
      const spot = landingSpot(ac.lat, ac.lon);
      if (prev.flight_id) {
        await env.DB.prepare("UPDATE flights SET end_ts = ?, end_lat = ?, end_lon = ?, end_place = ? WHERE id = ?")
          .bind(t, ac.lat, ac.lon, spot.place, prev.flight_id).run();
      }
      events.push({ type: "landing", aircraft: info, lat: ac.lat, lon: ac.lon, ...spot });
    }

    if (airborne && (!prev?.pos_at || t - prev.pos_at >= 20)) {
      await env.DB.prepare("INSERT INTO positions (hex, ts, lat, lon, alt, gs, track, flight_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(info.hex, t, ac.lat, ac.lon, alt, s.gs, s.track, s.flight_id).run();
      if (s.flight_id && alt != null) {
        await env.DB.prepare("UPDATE flights SET max_alt = MAX(COALESCE(max_alt, 0), ?) WHERE id = ?").bind(alt, s.flight_id).run();
      }
      s.pos_at = t;
    }

    // Save the state when something changed, at least once a minute (keeps D1 writes low).
    const moved = !prev || prev.lat == null || distanceKm(prev.lat, prev.lon, ac.lat, ac.lon) > 0.05;
    if (!prev || moved || airborne !== wasAirborne || t - prev.seen_at >= 60) {
      await env.DB.prepare(
        `INSERT OR REPLACE INTO state (hex, lat, lon, alt, gs, track, airborne, seen_at, airborne_since, landed_at, flight_id, pos_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(info.hex, s.lat, s.lon, s.alt, s.gs, s.track, s.airborne, s.seen_at, s.airborne_since, s.landed_at, s.flight_id, s.pos_at).run();
    }
  }

  // Lost signal for 10 minutes while airborne: close the flight.
  const lost = await env.DB.prepare("SELECT hex, flight_id, lat, lon FROM state WHERE airborne = 1 AND seen_at < ?").bind(t - 600).all();
  for (const l of lost.results || []) {
    await env.DB.prepare("UPDATE state SET airborne = 0, landed_at = seen_at WHERE hex = ?").bind(l.hex).run();
    if (l.flight_id) {
      await env.DB.prepare("UPDATE flights SET end_ts = (SELECT seen_at FROM state WHERE hex = ?), end_lat = ?, end_lon = ? WHERE id = ? AND end_ts IS NULL")
        .bind(l.hex, l.lat, l.lon, l.flight_id).run();
    }
  }

  await detectIncidents(env, t, events);
  await notify(env, events);
  await zonePushes(env, t, seen);
  await updateActivities(env, t);
  return { matched: seen.length, events: events.map((e) => `${e.type}:${e.aircraft?.naam || e.place || ""}`) };
}

// ------------------------------------------------------------------ grote inzet

async function detectIncidents(env, t, events) {
  const rows = (await env.DB.prepare(
    `SELECT s.hex, s.lat, s.lon, s.alt, s.gs, s.airborne, a.soort, a.icoon, a.naam FROM state s JOIN aircraft a ON a.hex = s.hex
     WHERE s.seen_at > ?`
  ).bind(t - 300).all()).results || [];
  const clusters = findClusters(rows.map((r) => ({ ...r, airborne: Boolean(r.airborne) })));
  const active = (await env.DB.prepare("SELECT * FROM incidents WHERE end_ts IS NULL").all()).results || [];

  for (const c of clusters) {
    const match = active.find((i) => distanceKm(i.lat, i.lon, c.lat, c.lon) <= 2);
    if (match) {
      const hexes = [...new Set([...JSON.parse(match.hexes || "[]"), ...c.hexes])].sort();
      await env.DB.prepare("UPDATE incidents SET last_ts = ?, hexes = ? WHERE id = ?").bind(t, JSON.stringify(hexes), match.id).run();
      continue;
    }
    await env.DB.prepare("INSERT INTO incidents (start_ts, last_ts, lat, lon, place, hexes) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(t, t, c.lat, c.lon, c.plaats, JSON.stringify(c.hexes)).run();
    const namen = rows.filter((r) => c.hexes.includes(r.hex)).map((r) => r.naam);
    events.push({ type: "incident", lat: c.lat, lon: c.lon, place: c.plaats, count: c.hexes.length, hexes: c.hexes, namen });
  }
  // An incident ends 30 minutes after the last time it was seen.
  await env.DB.prepare("UPDATE incidents SET end_ts = last_ts WHERE end_ts IS NULL AND last_ts < ?").bind(t - 1800).run();
}

// ------------------------------------------------------------------ pushmeldingen

/** Own helicopter sound for helicopter pushes (heli.wav in the app, same sound as A-Alerts). */
const soundFor = (a) => (a && isHeli(a) ? "heli.wav" : "default");

async function notify(env, events) {
  const wanted = events.filter((e) => ["takeoff", "landing", "callsign", "incident"].includes(e.type));
  if (!wanted.length || !apnsConfigured(env)) return;
  const devices = (await env.DB.prepare("SELECT * FROM devices WHERE enabled = 1").all()).results || [];

  for (const e of wanted) {
    for (const d of devices) {
      const favs = JSON.parse(d.favorites || "[]");
      const followsAircraft = d.fav_alerts && e.aircraft && favs.includes(e.aircraft.hex);
      let payload;
      if (e.type === "takeoff") {
        if (!wantsTakeoff(d, e.aircraft, e.lat, e.lon)) continue;
        const where = e.place ? ` bij ${e.place}` : "";
        const reg = e.aircraft.reg && !e.aircraft.naam.includes(e.aircraft.reg) ? ` (${e.aircraft.reg})` : "";
        payload = {
          aps: { alert: { title: `${e.aircraft.naam} is opgestegen`, body: `${SOORT_LABEL[e.aircraft.soort] || "Toestel"}${reg} vertrok${where}.` },
            sound: soundFor(e.aircraft), "thread-id": e.aircraft.soort },
          hex: e.aircraft.hex, kind: "takeoff",
        };
      } else if (e.type === "landing") {
        if (!followsAircraft) continue;
        payload = {
          aps: { alert: { title: `${e.aircraft.naam} ${e.text}`, body: SOORT_LABEL[e.aircraft.soort] || "Toestel" }, sound: soundFor(e.aircraft), "thread-id": e.aircraft.soort },
          hex: e.aircraft.hex, kind: "landing",
        };
      } else if (e.type === "callsign") {
        if (!followsAircraft || !d.callsign) continue;
        payload = {
          aps: { alert: { title: `${e.aircraft.naam} vliegt nu als ${e.nieuw}`, body: `Was ${e.oud}. Vaak het begin van een inzet.` }, sound: soundFor(e.aircraft), "thread-id": e.aircraft.soort },
          hex: e.aircraft.hex, kind: "callsign",
        };
      } else {
        const follows = d.fav_alerts && e.hexes.some((h) => favs.includes(h));
        if (!follows && (!d.incidents || !withinRadius(d, e.lat, e.lon))) continue;
        payload = {
          aps: { alert: { title: `${e.count} helikopters op één plek${e.place ? ` in ${e.place}` : ""}`, body: `${e.namen.join(", ")}. Mogelijk een groot incident.` },
            sound: "heli.wav", "thread-id": "incident" },
          kind: "incident", lat: e.lat, lon: e.lon,
        };
      }
      await deliver(env, d, payload);
    }
  }
}

async function deliver(env, d, payload) {
  const r = await sendPush(env, d, payload);
  if (isDeadToken(r)) await env.DB.prepare("DELETE FROM devices WHERE token = ?").bind(d.token).run();
  else if (!r.ok) console.error("[push]", r.status, r.reason);
}

/** Own zone: a push when an aircraft of a chosen kind flies above a user's place, whatever aircraft it is (once per hour). */
export function zonesHit(device, aircraft) {
  const zones = safeJSON(device.zones, []);
  const soorten = safeJSON(device.soorten, ["trauma", "politie"]);
  if (!aircraft.airborne || !soorten.includes(aircraft.soort)) return [];
  return zones.filter((z) => z && Number.isFinite(z.lat) && Number.isFinite(z.lon) &&
    distanceKm(z.lat, z.lon, aircraft.lat, aircraft.lon) <= Math.min(Math.max(Number(z.km) || 3, 1), 25));
}

async function zonePushes(env, t, hexes) {
  if (!hexes.length || !apnsConfigured(env)) return;
  const devices = (await env.DB.prepare("SELECT * FROM devices WHERE enabled = 1 AND zones != '[]'").all()).results || [];
  if (!devices.length) return;
  const marks = hexes.map(() => "?").join(",");
  const rows = (await env.DB.prepare(
    `SELECT s.hex, s.lat, s.lon, s.airborne, a.naam, a.soort, a.icoon FROM state s JOIN aircraft a ON a.hex = s.hex WHERE s.hex IN (${marks})`
  ).bind(...hexes).all()).results || [];
  for (const d of devices) {
    for (const r of rows) {
      const a = { ...r, airborne: Boolean(r.airborne) };
      for (const z of zonesHit(d, a)) {
        const key = String(z.naam || `${z.lat},${z.lon}`).slice(0, 60);
        const hit = await env.DB.prepare("SELECT at FROM zone_hits WHERE token = ? AND hex = ? AND zone = ?").bind(d.token, a.hex, key).first();
        if (hit && t - hit.at < 3600) continue;
        await env.DB.prepare("INSERT OR REPLACE INTO zone_hits (token, hex, zone, at) VALUES (?, ?, ?, ?)").bind(d.token, a.hex, key, t).run();
        await deliver(env, d, {
          aps: { alert: { title: `${a.naam} vliegt boven ${z.naam || "jouw zone"}`, body: SOORT_LABEL[a.soort] || "Toestel" }, sound: soundFor(a), "thread-id": "zone" },
          hex: a.hex, kind: "zone",
        });
      }
    }
  }
}

// ------------------------------------------------------------------ Live Activities

export function activityState(a, s, t) {
  const stale = !s || t - s.seen_at > 120;
  const status = !s ? "Geen signaal" : stale ? (s.airborne ? "Geen signaal" : "Aan de grond") : s.airborne ? "In de lucht" : "Aan de grond";
  return {
    naam: a.naam || "Toestel", soort: a.soort || "trauma", icoon: a.icoon || "", reg: a.reg || "",
    status, airborne: Boolean(s?.airborne) && !stale,
    altitudeFt: s?.alt ?? 0, speedKt: Math.round(s?.gs ?? 0), heading: Math.round(s?.track ?? 0),
    lat: s?.lat ?? 0, lon: s?.lon ?? 0, updated: s?.seen_at ?? t,
  };
}

async function updateActivities(env, t) {
  if (!apnsConfigured(env)) return;
  const rows = (await env.DB.prepare(
    `SELECT v.token, v.hex, v.environment, v.created_at, v.last_sent, a.naam, a.soort, a.icoon, a.reg,
            s.lat, s.lon, s.alt, s.gs, s.track, s.airborne, s.seen_at, s.landed_at
     FROM activities v LEFT JOIN aircraft a ON a.hex = v.hex LEFT JOIN state s ON s.hex = v.hex`
  ).all()).results || [];

  for (const r of rows) {
    const s = r.seen_at != null ? r : null;
    const landedLong = s && !s.airborne && s.landed_at && t - s.landed_at > 600;
    const tooOld = t - r.created_at > 8 * 3600;
    const end = landedLong || tooOld;
    if (!end && t - r.last_sent < 25) continue;
    if (!end && s && s.seen_at < r.last_sent) continue; // nothing new

    const aps = { timestamp: t, event: end ? "end" : "update", "content-state": activityState(r, s, t) };
    if (end) aps["dismissal-date"] = t + 15 * 60;
    const res = await sendPush(env, { token: r.token, environment: r.environment }, { aps },
      { kind: "liveactivity", priority: end ? 10 : 5, expiresIn: 300 });
    if (end || isDeadToken(res)) await env.DB.prepare("DELETE FROM activities WHERE token = ?").bind(r.token).run();
    else await env.DB.prepare("UPDATE activities SET last_sent = ? WHERE token = ?").bind(t, r.token).run();
  }
}

// ------------------------------------------------------------------ housekeeping

export async function cleanup(env) {
  const t = now();
  const row = await env.DB.prepare("SELECT at FROM kv WHERE key = 'cleanup'").first();
  if (row && t - row.at < 3600) return;
  const keep = t - Number(env.RETENTION_DAYS || 30) * 86400;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM positions WHERE ts < ?").bind(keep),
    env.DB.prepare("DELETE FROM flights WHERE start_ts < ?").bind(keep),
    env.DB.prepare("DELETE FROM incidents WHERE start_ts < ?").bind(keep),
    env.DB.prepare("DELETE FROM zone_hits WHERE at < ?").bind(t - 86400),
    env.DB.prepare("DELETE FROM push_log WHERE at < ?").bind(t - 7 * 86400),
    env.DB.prepare("INSERT OR REPLACE INTO kv (key, value, at) VALUES ('cleanup', '', ?)").bind(t),
  ]);
}
