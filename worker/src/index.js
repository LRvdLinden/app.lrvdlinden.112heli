// 112Heli API – Cloudflare Worker.
//  cron (every minute): ADS-B ingest a few times per run, pushes, Live Activity updates, cleanup
//  GET  /health
//  GET  /v1/live                        all followed aircraft with their latest state + active grote inzetten
//  GET  /v1/mapkit-token                MapKit JS token for the website (origin-bound)
//  GET  /v1/aircraft/:hex/track?minutes=60
//  GET  /v1/aircraft/:hex/spoor?scope=vlucht|kort|lang   trail (A-Alerts format): punten, plaatsen, vlucht
//  GET  /v1/aircraft/:hex/vluchten      last flights (A-Alerts format)
//  GET  /v1/flights?days=30[&hex=]      flights (newest first)
//  GET  /v1/flights/:id/track
//  GET  /v1/incidents?days=30
//  POST /v1/devices                     register a device for pushmeldingen (+ choices)
//  DELETE /v1/devices/:token
//  POST /v1/activities                  Live Activity push token for one aircraft
//  DELETE /v1/activities/:token
//  POST /v1/reports                     "dit toestel ontbreekt of klopt niet"
//  beheer (LRbeheer + 112heli.lrvdlinden.app/beheer), login with BEHEER_USER / BEHEER_PASSWORD:
//  POST /v1/beheer/login                { user, password } → { token, expires } (30 days; Bearer token)
//  GET  /v1/beheer/ping                 { configured }
//  GET  /v1/beheer/overview             status, counters, platforms, versions, per soort, per day (14 days)
//  GET  /v1/beheer/aircraft             all known aircraft with last seen and flights
//  GET  /v1/beheer/reports              reports from the app; POST /:id { status }; DELETE /:id
//  GET  /v1/beheer/push                 sent messages; GET /v1/beheer/push/bereik?soorten=; POST { titel, tekst, soorten, doel, token }
import { fetchADSB, ingest, cleanup } from "./engine.js";
import { refreshWeer, currentWeer } from "./weer.js";
import { apnsConfigured, mapkitToken, mapkitConfigured } from "./apple.js";
import { SOORTEN, STANDAARD_SOORTEN, plekVan, bovenPlaats } from "./fleet.js";
import * as beheer from "./beheer.js";
import { plaatsenUit } from "./aalerts/plaats.js";
import { distanceKm } from "./fleet.js";
const now = () => Math.floor(Date.now() / 1000);

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
};
const json = (data, status = 200, maxAge = 0) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": maxAge ? `public, max-age=${maxAge}` : "no-store", ...CORS },
  });
const bad = (msg, status = 400) => json({ error: msg }, status);
const clampInt = (v, min, max, dflt) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt; };
const isToken = (s) => typeof s === "string" && /^[0-9a-fA-F]{32,200}$/.test(s);

function aircraftJSON(r, t) {
  const seen = r.seen_at ?? null;
  const airborne = Boolean(r.airborne) && seen != null && t - seen <= 120;
  return {
    hex: r.hex, key: r.akey, reg: r.reg, callsign: r.callsign, soort: r.soort, icoon: r.icoon, type: r.type, naam: r.naam, basis: r.basis,
    lat: r.lat, lon: r.lon, alt: r.alt, gs: r.gs, track: r.track, airborne,
    seen, since: r.airborne ? r.airborne_since : r.landed_at, stale: seen == null || t - seen > 120,
    // A-Alerts "status per toestel": lucht, basis, grond or uit_beeld (not seen for 3 minutes).
    status: seen == null || t - seen > 180 ? "uit_beeld" : airborne ? "lucht" : plekVan(r.lat, r.lon)?.soort === "basis" ? "basis" : "grond",
    // "Boven Teuge, Voorst" in the air; the hospital or base on the ground (A-Alerts data).
    boven: airborne ? bovenPlaats(r.lat, r.lon) : null,
    plek: !airborne ? plekVan(r.lat, r.lon)?.naam || null : null,
  };
}

async function live(env) {
  const t = now();
  const rows = await env.DB.prepare(
    `SELECT a.*, s.lat, s.lon, s.alt, s.gs, s.track, s.airborne, s.seen_at, s.airborne_since, s.landed_at
     FROM aircraft a LEFT JOIN state s ON s.hex = a.hex WHERE s.seen_at > ? ORDER BY a.soort, a.naam`
  ).bind(t - 14 * 86400).all();
  const incidents = await env.DB.prepare("SELECT * FROM incidents WHERE end_ts IS NULL ORDER BY start_ts DESC").all();
  return {
    updated: t,
    aircraft: (rows.results || []).map((r) => aircraftJSON(r, t)),
    incidents: (incidents.results || []).map(incidentJSON),
    weer: await currentWeer(env),
  };
}

const incidentJSON = (i) => ({ id: i.id, start: i.start_ts, last: i.last_ts, end: i.end_ts, lat: i.lat, lon: i.lon, place: i.place, hexes: JSON.parse(i.hexes || "[]") });
const pointJSON = (p) => ({ ts: p.ts, lat: p.lat, lon: p.lon, alt: p.alt, gs: p.gs, track: p.track });

async function saveDevice(env, body) {
  if (!isToken(body.token)) return bad("token ontbreekt of is ongeldig");
  const t = now();
  const soorten = Array.isArray(body.soorten) ? body.soorten.filter((d) => SOORTEN.includes(d)) : STANDAARD_SOORTEN;
  const favorites = Array.isArray(body.favorites) ? body.favorites.filter((h) => /^[0-9a-f]{6}$/i.test(h)).map((h) => h.toLowerCase()).slice(0, 50) : [];
  const zones = (Array.isArray(body.zones) ? body.zones : []).slice(0, 5).map((z) => ({
    naam: String(z?.naam || "").slice(0, 40), lat: Math.round(Number(z?.lat) * 1000) / 1000, lon: Math.round(Number(z?.lon) * 1000) / 1000,
    km: Math.min(Math.max(Number(z?.km) || 3, 1), 25),
  })).filter((z) => Number.isFinite(z.lat) && Number.isFinite(z.lon) && Math.abs(z.lat) <= 90 && Math.abs(z.lon) <= 180);
  const num = (v) => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Number(v) : null);
  const lat = num(body.lat), lon = num(body.lon);
  await env.DB.prepare(
    `INSERT INTO devices (token, platform, environment, app_version, enabled, takeoff, incidents, fav_alerts, soorten, favorites, zones, callsign, lat, lon, radius_km, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(token) DO UPDATE SET platform = excluded.platform, environment = excluded.environment, app_version = excluded.app_version,
       enabled = excluded.enabled, takeoff = excluded.takeoff, incidents = excluded.incidents, fav_alerts = excluded.fav_alerts,
       soorten = excluded.soorten, favorites = excluded.favorites, zones = excluded.zones, callsign = excluded.callsign, lat = excluded.lat, lon = excluded.lon,
       radius_km = excluded.radius_km, updated_at = excluded.updated_at`
  ).bind(
    body.token, String(body.platform || "ios").slice(0, 16), body.environment === "sandbox" ? "sandbox" : "production",
    String(body.appVersion || "").slice(0, 32), body.enabled === false ? 0 : 1, body.takeoff === false ? 0 : 1,
    body.incidents === false ? 0 : 1, body.favAlerts === false ? 0 : 1, JSON.stringify(soorten), JSON.stringify(favorites), JSON.stringify(zones), body.callsign === false ? 0 : 1,
    lat != null && Math.abs(lat) <= 90 ? Math.round(lat * 100) / 100 : null, // ~1 km precision is enough
    lon != null && Math.abs(lon) <= 180 ? Math.round(lon * 100) / 100 : null,
    clampInt(body.radiusKm, 0, 500, 50), t, t
  ).run();
  return json({ ok: true });
}

async function route(request, env) {
  const url = new URL(request.url);
  const p = url.pathname.replace(/\/+$/, "") || "/";
  const m = request.method;
  if (m === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  if (p === "/" || p === "/health") {
    const last = await env.DB.prepare("SELECT value, at FROM kv WHERE key = 'last_ingest'").first();
    return json({ ok: true, app: "112Heli", lastIngest: last?.at ?? null, lastResult: last?.value ?? null, apns: apnsConfigured(env), mapkit: mapkitConfigured(env), verkeer: Boolean(env.VERKEER_URL && env.VERKEER_TOKEN) });
  }
  if (p === "/v1/live" && m === "GET") return json(await live(env), 200, 5);
  if (p === "/v1/mapkit-token" && m === "GET") {
    const token = await mapkitToken(env, request.headers.get("origin"));
    return token ? json({ token }) : bad("geen kaarttoken", 503);
  }

  let r;
  if ((r = p.match(/^\/v1\/aircraft\/([0-9a-f]{6})\/track$/i)) && m === "GET") {
    const minutes = clampInt(url.searchParams.get("minutes"), 5, 1440, 60);
    const rows = await env.DB.prepare("SELECT * FROM positions WHERE hex = ? AND ts > ? ORDER BY ts").bind(r[1].toLowerCase(), now() - minutes * 60).all();
    return json({ hex: r[1].toLowerCase(), points: (rows.results || []).map(pointJSON) }, 200, 10);
  }
  if ((r = p.match(/^\/v1\/aircraft\/([0-9a-f]{6})\/spoor$/i)) && m === "GET") {
    return json(await spoor(env, r[1].toLowerCase(), url.searchParams.get("scope") || "vlucht"), 200, 10);
  }
  if ((r = p.match(/^\/v1\/aircraft\/([0-9a-f]{6})\/vluchten$/i)) && m === "GET") {
    return json(await vluchten(env, r[1].toLowerCase()), 200, 20);
  }
  if (p === "/v1/flights" && m === "GET") {
    const days = clampInt(url.searchParams.get("days"), 1, 30, 30);
    const hex = (url.searchParams.get("hex") || "").toLowerCase();
    const sql = `SELECT f.*, a.naam, a.reg, a.soort, a.icoon, a.type, a.callsign FROM flights f JOIN aircraft a ON a.hex = f.hex
                 WHERE f.start_ts > ? ${/^[0-9a-f]{6}$/.test(hex) ? "AND f.hex = ?" : ""} ORDER BY f.start_ts DESC LIMIT 500`;
    const stmt = env.DB.prepare(sql);
    const rows = /^[0-9a-f]{6}$/.test(hex) ? await stmt.bind(now() - days * 86400, hex).all() : await stmt.bind(now() - days * 86400).all();
    return json({
      flights: (rows.results || []).map((f) => ({
        id: f.id, hex: f.hex, naam: f.naam, reg: f.reg, soort: f.soort, icoon: f.icoon, type: f.type, callsign: f.callsign,
        start: f.start_ts, end: f.end_ts, startLat: f.start_lat, startLon: f.start_lon, startPlace: f.start_place,
        endLat: f.end_lat, endLon: f.end_lon, endPlace: f.end_place, maxAlt: f.max_alt,
      })),
    }, 200, 30);
  }
  if ((r = p.match(/^\/v1\/flights\/(\d+)\/track$/)) && m === "GET") {
    const rows = await env.DB.prepare("SELECT * FROM positions WHERE flight_id = ? ORDER BY ts").bind(Number(r[1])).all();
    return json({ id: Number(r[1]), points: (rows.results || []).map(pointJSON) }, 200, 30);
  }
  if (p === "/v1/incidents" && m === "GET") {
    const days = clampInt(url.searchParams.get("days"), 1, 30, 30);
    const rows = await env.DB.prepare("SELECT * FROM incidents WHERE start_ts > ? ORDER BY start_ts DESC LIMIT 200").bind(now() - days * 86400).all();
    return json({ incidents: (rows.results || []).map(incidentJSON) }, 200, 30);
  }
  if (p === "/v1/devices" && m === "POST") {
    let body; try { body = await request.json(); } catch { return bad("ongeldige JSON"); }
    return saveDevice(env, body);
  }
  if ((r = p.match(/^\/v1\/devices\/([0-9a-fA-F]+)$/)) && m === "DELETE") {
    await env.DB.prepare("DELETE FROM devices WHERE token = ?").bind(r[1]).run();
    return json({ ok: true });
  }
  if (p === "/v1/activities" && m === "POST") {
    let body; try { body = await request.json(); } catch { return bad("ongeldige JSON"); }
    if (!isToken(body.token) || !/^[0-9a-f]{6}$/i.test(body.hex || "")) return bad("token of hex ongeldig");
    await env.DB.prepare("INSERT OR REPLACE INTO activities (token, hex, environment, created_at, last_sent) VALUES (?, ?, ?, ?, 0)")
      .bind(body.token, body.hex.toLowerCase(), body.environment === "sandbox" ? "sandbox" : "production", now()).run();
    return json({ ok: true });
  }
  if ((r = p.match(/^\/v1\/activities\/([0-9a-fA-F]+)$/)) && m === "DELETE") {
    await env.DB.prepare("DELETE FROM activities WHERE token = ?").bind(r[1]).run();
    return json({ ok: true });
  }
  if (p === "/v1/reports" && m === "POST") {
    let body; try { body = await request.json(); } catch { return bad("ongeldige JSON"); }
    const tekst = String(body.tekst || "").trim().slice(0, 1000);
    if (tekst.length < 3) return bad("tekst ontbreekt");
    const s = (v, n) => (v == null ? null : String(v).slice(0, n));
    await env.DB.prepare("INSERT INTO reports (created_at, hex, naam, reg, soort, tekst, platform, app_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(now(), s(body.hex, 8), s(body.naam, 60), s(body.reg, 16), s(body.soort, 16), tekst, s(body.platform, 16), s(body.appVersion, 32)).run();
    return json({ ok: true });
  }
  if (p.startsWith("/v1/beheer/")) {
    try { return await routeBeheer(request, env, url, p, m); } catch (e) {
      if (e instanceof beheer.BeheerError) return bad(e.message, e.status);
      throw e;
    }
  }
  return bad("niet gevonden", 404);
}

// ------------------------------------------------------------------ trail and flights in the A-Alerts format

const iso = (ts) => new Date(ts * 1000).toISOString();
const routeKm = (pts) => pts.reduce((sum, q, i) => (i ? sum + distanceKm(pts[i - 1].lat, pts[i - 1].lon, q.lat, q.lon) : 0), 0);

function vluchtJSON(f, pts, t) {
  const einde = f.end_ts ?? null;
  return {
    start: iso(f.start_ts), einde: einde ? iso(einde) : null, onderweg: einde == null,
    duur_min: Math.max(0, Math.round(((einde ?? t) - f.start_ts) / 60)),
    afstand_km: Math.round(routeKm(pts) * 10) / 10, max_hoogte_ft: f.max_alt ?? 0,
  };
}

/** Trail of one aircraft: the current (or last) flight, the last 30 minutes or the last 2 hours. */
async function spoor(env, hex, scope) {
  const t = now();
  const state = await env.DB.prepare("SELECT flight_id, airborne FROM state WHERE hex = ?").bind(hex).first();
  const flight = state?.flight_id
    ? await env.DB.prepare("SELECT * FROM flights WHERE id = ?").bind(state.flight_id).first()
    : await env.DB.prepare("SELECT * FROM flights WHERE hex = ? ORDER BY start_ts DESC LIMIT 1").bind(hex).first();
  const flightPts = flight ? (await env.DB.prepare("SELECT ts, lat, lon, alt FROM positions WHERE flight_id = ? ORDER BY ts").bind(flight.id).all()).results || [] : [];
  let pts = flightPts;
  if (scope === "kort" || scope === "lang") {
    pts = (await env.DB.prepare("SELECT ts, lat, lon, alt FROM positions WHERE hex = ? AND ts > ? ORDER BY ts").bind(hex, t - (scope === "kort" ? 1800 : 7200)).all()).results || [];
  }
  return {
    punten: pts.map((q) => ({ t: iso(q.ts), lat: q.lat, lon: q.lon, hoogte_ft: q.alt, grond: false })),
    plaatsen: plaatsenUit(flightPts.map((q) => ({ at: q.ts * 1000, lat: q.lat, lon: q.lon, grond: false }))),
    vlucht: flight ? vluchtJSON(flight, flightPts, t) : null,
  };
}

/** Last 10 flights of one aircraft, with duration and distance. */
async function vluchten(env, hex) {
  const t = now();
  const rows = (await env.DB.prepare("SELECT * FROM flights WHERE hex = ? ORDER BY start_ts DESC LIMIT 10").bind(hex).all()).results || [];
  const out = [];
  for (const f of rows) {
    const pts = (await env.DB.prepare("SELECT lat, lon FROM positions WHERE flight_id = ? ORDER BY ts").bind(f.id).all()).results || [];
    out.push(vluchtJSON(f, pts, t));
  }
  return { vluchten: out };
}

async function routeBeheer(request, env, url, p, m) {
  const body = async () => { try { return await request.json(); } catch { return {}; } };
  if (p === "/v1/beheer/login" && m === "POST") return json(await beheer.login(env, request, await body()));
  if (p === "/v1/beheer/ping" && m === "GET") return json({ configured: beheer.beheerConfigured(env) });
  const admin = await beheer.requireAdmin(env, request);
  let r;
  if (p === "/v1/beheer/me" && m === "GET") return json({ user: admin.u, expires: admin.exp ? new Date(admin.exp).toISOString() : null });
  if (p === "/v1/beheer/overview" && m === "GET") return json(await beheer.overview(env));
  if (p === "/v1/beheer/aircraft" && m === "GET") return json(await beheer.aircraftList(env));
  if (p === "/v1/beheer/reports" && m === "GET") return json(await beheer.reports(env));
  if ((r = p.match(/^\/v1\/beheer\/reports\/(\d+)$/))) {
    if (m === "POST") return json(await beheer.setReportStatus(env, Number(r[1]), await body()));
    if (m === "DELETE") return json(await beheer.deleteReport(env, Number(r[1])));
  }
  if (p === "/v1/beheer/push" && m === "GET") return json(await beheer.broadcastHistory(env));
  if (p === "/v1/beheer/push/bereik" && m === "GET") return json(await beheer.pushPreview(env, url));
  if (p === "/v1/beheer/push" && m === "POST") return json(await beheer.broadcast(env, await body()));
  return bad("niet gevonden", 404);
}

async function runIngest(env) {
  const polls = clampInt(env.POLLS_PER_RUN, 1, 6, 4);
  const results = [];
  for (let i = 0; i < polls; i++) {
    const started = Date.now();
    try {
      results.push(await ingest(env, await fetchADSB(env)));
    } catch (e) {
      console.error("[ingest]", e.message);
      results.push({ error: e.message });
    }
    // Write the result after every poll, so /health shows it even if the run is cut short.
    await env.DB.prepare("INSERT OR REPLACE INTO kv (key, value, at) VALUES ('last_ingest', ?, ?)").bind(JSON.stringify(results.at(-1)), now()).run();
    if (i < polls - 1) await new Promise((res) => setTimeout(res, Math.max(0, 15_000 - (Date.now() - started))));
  }
  await env.DB.prepare("INSERT OR REPLACE INTO kv (key, value, at) VALUES ('last_ingest', ?, ?)").bind(JSON.stringify(results.at(-1)), now()).run();
  await refreshWeer(env);
  await cleanup(env);
}

export default {
  async fetch(request, env) {
    try { return await route(request, env); } catch (e) { console.error("[api]", e); return bad("serverfout", 500); }
  },
  // Awaited (not waitUntil): waitUntil stops 30 s after the event, and a run with 4 polls takes about 50 s.
  async scheduled(_event, env) {
    await runIngest(env);
  },
};
