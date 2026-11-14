// 112Heli beheer: login, overview, aircraft, reports and own pushmeldingen.
// Used by LRbeheer (environment 112Heli) and the web beheer on 112heli.lrvdlinden.app/beheer.
// Login with the shared beheer login (BEHEER_USER / BEHEER_PASSWORD) gives a signed token of 30 days.
import { sendPush, isDeadToken, apnsConfigured, mapkitConfigured } from "./apple.js";
import { SOORTEN } from "./fleet.js";

export const SOORT_NAMEN = {
  trauma: "Lifeliner", politie: "Politie", kustwacht: "Kustwacht", defensie: "Defensie",
  kmar: "Marechaussee", regering: "Regering", bijzonder: "Bijzonder",
};
const isSoort = (s) => SOORTEN.includes(s);

const enc = new TextEncoder();
const now = () => Math.floor(Date.now() / 1000);
const b64url = (buf) => {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
};
const fromB64url = (s) => atob(s.replace(/-/g, "+").replace(/_/g, "/"));
const TZ = "Europe/Amsterdam";
export const dayKey = (ts) => new Date(ts * 1000).toLocaleDateString("en-CA", { timeZone: TZ });

export class BeheerError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export const beheerConfigured = (env) => Boolean(env.BEHEER_USER && env.BEHEER_PASSWORD && String(env.BEHEER_PASSWORD).length >= 6);

async function hmacKey(env) {
  // Signed with the password: changing BEHEER_PASSWORD logs everyone out.
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(`112heli-beheer|${env.BEHEER_USER}|${env.BEHEER_PASSWORD}`));
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function same(a, b) {
  const [x, y] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(String(a))), crypto.subtle.digest("SHA-256", enc.encode(String(b)))]);
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < u.length; i++) diff |= u[i] ^ v[i];
  return diff === 0;
}

async function checkPassword(env, user, password) {
  const userOk = String(user || "").toLowerCase() === String(env.BEHEER_USER).toLowerCase();
  return (await same(password || "", env.BEHEER_PASSWORD)) && userOk;
}

export async function login(env, request, body) {
  if (!beheerConfigured(env)) throw new BeheerError(503, "Beheer is nog niet ingesteld (BEHEER_USER / BEHEER_PASSWORD)");
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const key = `login_fail:${ip}`;
  const fail = await env.DB.prepare("SELECT value, at FROM kv WHERE key = ?").bind(key).first();
  const recent = fail && now() - fail.at < 15 * 60 ? Number(fail.value) : 0;
  if (recent >= 8) throw new BeheerError(429, "Te veel pogingen. Probeer het over een kwartier opnieuw.");
  if (!(await checkPassword(env, body.user, body.password))) {
    await env.DB.prepare("INSERT OR REPLACE INTO kv (key, value, at) VALUES (?, ?, ?)").bind(key, String(recent + 1), now()).run();
    throw new BeheerError(401, "Gebruikersnaam of wachtwoord klopt niet");
  }
  await env.DB.prepare("DELETE FROM kv WHERE key = ?").bind(key).run();
  const exp = Date.now() + 30 * 86_400_000;
  const payload = b64url(enc.encode(JSON.stringify({ u: env.BEHEER_USER, exp })));
  const sig = b64url(await crypto.subtle.sign("HMAC", await hmacKey(env), enc.encode(payload)));
  return { token: `${payload}.${sig}`, user: env.BEHEER_USER, expires: new Date(exp).toISOString() };
}

/** Bearer token from login, or Basic auth with the beheer login (older clients). */
export async function requireAdmin(env, request) {
  if (!beheerConfigured(env)) throw new BeheerError(503, "Beheer is nog niet ingesteld");
  const auth = request.headers.get("authorization") || "";
  if (auth.startsWith("Basic ")) {
    let u = "", p = "";
    try { [u, ...p] = atob(auth.slice(6)).split(":"); p = p.join(":"); } catch { /* fall through */ }
    if (await checkPassword(env, u, p)) return { u };
    throw new BeheerError(401, "Niet ingelogd");
  }
  const [payload, sig] = (auth.startsWith("Bearer ") ? auth.slice(7) : "").split(".");
  if (!payload || !sig) throw new BeheerError(401, "Niet ingelogd");
  let ok = false, data = null;
  try {
    const sigBytes = Uint8Array.from(fromB64url(sig), (c) => c.charCodeAt(0));
    ok = await crypto.subtle.verify("HMAC", await hmacKey(env), sigBytes, enc.encode(payload));
    data = JSON.parse(fromB64url(payload));
  } catch { ok = false; }
  if (!ok) throw new BeheerError(401, "Sessie ongeldig");
  if (!data?.exp || data.exp < Date.now()) throw new BeheerError(401, "Sessie verlopen");
  return data;
}

// ------------------------------------------------------------------ overview

const count = async (env, sql, ...args) => (await env.DB.prepare(sql).bind(...args).first())?.n ?? 0;

export async function overview(env) {
  const t = now();
  const last = await env.DB.prepare("SELECT value, at FROM kv WHERE key = 'last_ingest'").first();
  let lastResult = null;
  try { lastResult = last?.value ? JSON.parse(last.value) : null; } catch { lastResult = null; }
  const weer = await env.DB.prepare("SELECT value, at FROM kv WHERE key = 'weer'").first();
  const since14 = t - 14 * 86400;

  const [toestellen, inLucht, gezien24, apparaten, apparatenAan, metZones, liveActivities, vluchtenVandaag, vluchten7, inzetten7, openMeldingen, actieveInzetten] = await Promise.all([
    count(env, "SELECT COUNT(*) AS n FROM aircraft"),
    count(env, "SELECT COUNT(*) AS n FROM state WHERE airborne = 1 AND seen_at > ?", t - 120),
    count(env, "SELECT COUNT(*) AS n FROM state WHERE seen_at > ?", t - 86400),
    count(env, "SELECT COUNT(*) AS n FROM devices"),
    count(env, "SELECT COUNT(*) AS n FROM devices WHERE enabled = 1"),
    count(env, "SELECT COUNT(*) AS n FROM devices WHERE zones != '[]'"),
    count(env, "SELECT COUNT(*) AS n FROM activities"),
    count(env, "SELECT COUNT(*) AS n FROM flights WHERE start_ts > ?", startOfToday(t)),
    count(env, "SELECT COUNT(*) AS n FROM flights WHERE start_ts > ?", t - 7 * 86400),
    count(env, "SELECT COUNT(*) AS n FROM incidents WHERE start_ts > ?", t - 7 * 86400),
    count(env, "SELECT COUNT(*) AS n FROM reports WHERE status = 'nieuw'"),
    count(env, "SELECT COUNT(*) AS n FROM incidents WHERE end_ts IS NULL"),
  ]);

  const platforms = (await env.DB.prepare("SELECT platform, COUNT(*) AS n FROM devices GROUP BY platform ORDER BY n DESC").all()).results || [];
  const versies = (await env.DB.prepare("SELECT COALESCE(app_version, '?') AS versie, COUNT(*) AS n FROM devices GROUP BY versie ORDER BY n DESC LIMIT 6").all()).results || [];

  // Per day (14 days): flights, new devices, grote inzetten.
  const dagen = new Map();
  for (let i = 13; i >= 0; i--) dagen.set(dayKey(t - i * 86400), { dag: dayKey(t - i * 86400), vluchten: 0, apparaten: 0, inzetten: 0 });
  for (const [sql, field] of [
    ["SELECT start_ts AS ts FROM flights WHERE start_ts > ?", "vluchten"],
    ["SELECT created_at AS ts FROM devices WHERE created_at > ?", "apparaten"],
    ["SELECT start_ts AS ts FROM incidents WHERE start_ts > ?", "inzetten"],
  ]) {
    for (const r of (await env.DB.prepare(sql).bind(since14).all()).results || []) {
      const d = dagen.get(dayKey(r.ts));
      if (d) d[field]++;
    }
  }

  // Flights per soort (7 days).
  const perSoort = (await env.DB.prepare(`SELECT a.soort, COUNT(*) AS n FROM flights f JOIN aircraft a ON a.hex = f.hex
      WHERE f.start_ts > ? GROUP BY a.soort ORDER BY n DESC`).bind(t - 7 * 86400).all()).results || [];

  return {
    status: {
      lastIngest: last?.at ?? null,
      lastResult,
      ingestOk: Boolean(last?.at && t - last.at < 300 && !lastResult?.error),
      apns: apnsConfigured(env),
      mapkit: mapkitConfigured(env),
      weer: weer?.at ?? null,
    },
    tellers: { toestellen, inLucht, gezien24, apparaten, apparatenAan, metZones, liveActivities, vluchtenVandaag, vluchten7, inzetten7, openMeldingen, actieveInzetten },
    platforms,
    versies,
    perSoort: perSoort.map((r) => ({ soort: r.soort, naam: SOORT_NAMEN[r.soort] || r.soort, n: r.n })),
    dagen: [...dagen.values()],
  };
}

function startOfToday(t) {
  // Midnight in Amsterdam (good enough: the offset of "now").
  const d = new Date(t * 1000);
  const local = new Date(d.toLocaleString("en-US", { timeZone: TZ }));
  const offset = local.getTime() - d.getTime();
  const midnight = new Date(local); midnight.setHours(0, 0, 0, 0);
  return Math.floor((midnight.getTime() - offset) / 1000);
}

// ------------------------------------------------------------------ aircraft

export async function aircraftList(env) {
  const t = now();
  const rows = (await env.DB.prepare(`SELECT a.*, s.seen_at, s.airborne, s.lat, s.lon, s.alt,
      (SELECT COUNT(*) FROM flights f WHERE f.hex = a.hex AND f.start_ts > ?) AS vluchten30,
      (SELECT MAX(start_ts) FROM flights f WHERE f.hex = a.hex) AS laatsteVlucht
      FROM aircraft a LEFT JOIN state s ON s.hex = a.hex ORDER BY s.seen_at DESC NULLS LAST`).bind(t - 30 * 86400).all()).results || [];
  return {
    toestellen: rows.map((r) => ({
      hex: r.hex, key: r.akey, reg: r.reg, callsign: r.callsign, soort: r.soort, soortNaam: SOORT_NAMEN[r.soort] || r.soort,
      icoon: r.icoon, type: r.type, naam: r.naam, basis: r.basis,
      seen: r.seen_at ?? null, inLucht: Boolean(r.airborne) && r.seen_at != null && t - r.seen_at <= 120,
      alt: r.alt ?? null, vluchten30: r.vluchten30 || 0, laatsteVlucht: r.laatsteVlucht ?? null,
    })),
  };
}

// ------------------------------------------------------------------ reports

export async function reports(env) {
  const rows = (await env.DB.prepare("SELECT * FROM reports ORDER BY created_at DESC LIMIT 200").all()).results || [];
  return { reports: rows };
}

export async function setReportStatus(env, id, body) {
  const status = ["nieuw", "bekeken", "opgelost"].includes(body?.status) ? body.status : "bekeken";
  await env.DB.prepare("UPDATE reports SET status = ? WHERE id = ?").bind(status, id).run();
  return { ok: true, status };
}

export async function deleteReport(env, id) {
  await env.DB.prepare("DELETE FROM reports WHERE id = ?").bind(id).run();
  return { ok: true };
}

// ------------------------------------------------------------------ own pushmeldingen

const PUSH_DOELEN = new Set(["alle", "test"]);

/** Who would receive a message: all devices with meldingen on, optionally only those that follow certain soorten. */
async function targets(env, soorten) {
  const rows = (await env.DB.prepare("SELECT token, environment, soorten FROM devices WHERE enabled = 1").all()).results || [];
  if (!soorten?.length) return rows;
  return rows.filter((r) => {
    let mine = [];
    try { mine = JSON.parse(r.soorten || "[]"); } catch { mine = []; }
    return soorten.some((s) => mine.includes(s));
  });
}

export async function pushPreview(env, url) {
  const soorten = (url.searchParams.get("soorten") || "").split(",").filter(isSoort);
  return { bereik: (await targets(env, soorten)).length };
}

/**
 * Sends an own pushmelding. body { titel, tekst, soorten?: [...], doel: "alle" | "test", token? (test: one device) }.
 * Test goes to the given device token only (for example the iPhone of the beheerder).
 */
export async function broadcast(env, body) {
  const titel = String(body?.titel || "").trim().slice(0, 80);
  const tekst = String(body?.tekst || "").trim().slice(0, 300);
  if (!tekst) throw new BeheerError(400, "Tekst ontbreekt");
  if (!apnsConfigured(env)) throw new BeheerError(503, "APNs is niet ingesteld op de server");
  const doel = PUSH_DOELEN.has(body?.doel) ? body.doel : "alle";
  const soorten = Array.isArray(body?.soorten) ? body.soorten.filter(isSoort) : [];

  let devices;
  if (doel === "test") {
    const token = String(body?.token || "");
    if (!/^[0-9a-fA-F]{32,200}$/.test(token)) throw new BeheerError(400, "Geef het pushadres van het testtoestel");
    const row = await env.DB.prepare("SELECT token, environment FROM devices WHERE token = ?").bind(token).first();
    devices = [row || { token, environment: body?.environment === "sandbox" ? "sandbox" : "production" }];
  } else {
    devices = await targets(env, soorten);
  }

  const payload = { aps: { alert: titel ? { title: titel, body: tekst } : { body: tekst }, sound: "heli.wav" }, type: "bericht" };
  let ok = 0, fout = 0;
  for (let i = 0; i < devices.length; i += 50) {
    const res = await Promise.all(devices.slice(i, i + 50).map((d) => sendPush(env, d, payload, { collapseId: "bericht" })));
    for (const [j, r] of res.entries()) {
      if (r.ok) ok++;
      else {
        fout++;
        if (isDeadToken(r)) {
          await env.DB.prepare("DELETE FROM devices WHERE token = ?").bind(devices[i + j].token).run();
        }
      }
    }
  }
  if (doel !== "test") {
    await env.DB.prepare("INSERT INTO broadcasts (created_at, titel, tekst, soorten, bereik, ok, fout) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(now(), titel || null, tekst, JSON.stringify(soorten), devices.length, ok, fout).run();
  }
  return { ok: true, doel, bereik: devices.length, verstuurd: ok, mislukt: fout };
}

export async function broadcastHistory(env) {
  const rows = (await env.DB.prepare("SELECT * FROM broadcasts ORDER BY created_at DESC LIMIT 50").all()).results || [];
  return { berichten: rows.map((r) => ({ ...r, soorten: JSON.parse(r.soorten || "[]") })) };
}
