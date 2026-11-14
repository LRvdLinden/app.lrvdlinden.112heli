// Apple services from the Worker, using WebCrypto (ES256) and fetch:
//  - APNs pushmeldingen (alert) and Live Activity updates (liveactivity)
// Same approach and secrets as the A-Alerts worker (APN_KEY_ID / APN_TEAM_ID / APN_P8_CERT).

const enc = new TextEncoder();
const b64url = (data) => {
  const bytes = typeof data === "string" ? enc.encode(data) : new Uint8Array(data);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
};

/** GitHub/Cloudflare secrets may store the .p8 with literal "\n". */
export const pem = (v) => String(v || "").replace(/\\n/g, "\n").trim();
export const hasKey = (keyId, teamId, p8) => Boolean(keyId && teamId && pem(p8).includes("PRIVATE KEY"));

const keyCache = new Map();
async function importKey(p8) {
  const text = pem(p8);
  if (keyCache.has(text)) return keyCache.get(text);
  const body = text.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  keyCache.set(text, key);
  return key;
}

/** ES256 JWT. WebCrypto already returns the raw r||s signature that JWT needs. */
export async function es256(header, claims, p8) {
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, await importKey(p8), enc.encode(data));
  return `${data}.${b64url(sig)}`;
}

// ------------------------------------------------------------------ APNs

/** Provider token, reused for 50 minutes (Apple refuses tokens that change more often than every 20 minutes). */
async function apnsToken(env) {
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare("SELECT value, at FROM kv WHERE key = 'apns_jwt'").first();
  if (row && now - row.at < 50 * 60) return row.value;
  const token = await es256({ alg: "ES256", kid: env.APN_KEY_ID }, { iss: env.APN_TEAM_ID, iat: now }, env.APN_P8_CERT);
  await env.DB.prepare("INSERT OR REPLACE INTO kv (key, value, at) VALUES ('apns_jwt', ?, ?)").bind(token, now).run();
  return token;
}

export const apnsConfigured = (env) => hasKey(env.APN_KEY_ID, env.APN_TEAM_ID, env.APN_P8_CERT);
export const TOPIC = (env) => env.APN_TOPIC || "app.lrvdlinden.112HELI";

/**
 * Sends one push. kind "alert" for normal notifications, "liveactivity" for Live Activity updates.
 * Resolves to { ok, status, reason }.
 */
export async function sendPush(env, device, payload, { kind = "alert", priority = 10, collapseId, expiresIn = 3600 } = {}) {
  if (!apnsConfigured(env)) return { ok: false, status: 0, reason: "APNs not configured" };
  const host = device.environment === "sandbox" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";
  const topic = kind === "liveactivity" ? `${TOPIC(env)}.push-type.liveactivity` : TOPIC(env);
  try {
    const res = await fetch(`${host}/3/device/${device.token}`, {
      method: "POST",
      headers: {
        authorization: `bearer ${await apnsToken(env)}`,
        "apns-topic": topic,
        "apns-push-type": kind,
        "apns-priority": String(priority),
        "apns-expiration": String(Math.floor(Date.now() / 1000) + expiresIn),
        ...(collapseId ? { "apns-collapse-id": collapseId.slice(0, 64) } : {}),
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    let reason = null;
    if (!res.ok) { try { reason = (await res.json()).reason; } catch {} }
    const r = { ok: res.status === 200, status: res.status, reason };
    if (kind === "alert") await logPush(env, device, payload, r);
    return r;
  } catch (e) {
    const r = { ok: false, status: 0, reason: String(e.message || e).slice(0, 200) };
    if (kind === "alert") await logPush(env, device, payload, r);
    return r;
  }
}

/** Remembers a sent pushmelding with Apple's answer (shown in beheer). Never stops a push when logging fails. */
async function logPush(env, device, payload, r) {
  try {
    const alert = payload?.aps?.alert;
    const titel = typeof alert === "string" ? alert : alert?.title || alert?.body || null;
    await env.DB.prepare("INSERT INTO push_log (at, kind, titel, hex, token_end, environment, status, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(Math.floor(Date.now() / 1000), String(payload?.kind || payload?.type || "melding").slice(0, 16), titel ? String(titel).slice(0, 120) : null,
        payload?.hex || null, String(device.token || "").slice(-6), device.environment || null, r.status, r.reason).run();
  } catch (e) {
    console.error("[pushlog]", e.message);
  }
}

export const isDeadToken = (r) => r.status === 410 || ["BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic"].includes(r.reason);

// ------------------------------------------------------------------ MapKit JS (website live map)

export const mapkitConfigured = (env) => hasKey(env.WEB_MAPKIT_JS_KEY_ID, env.WEB_MAPKIT_JS_TEAM_ID || env.APN_TEAM_ID, env.WEB_MAPKIT_JS_P8);

const DEFAULT_ORIGINS = "https://112heli.lrvdlinden.app,https://www.112heli.lrvdlinden.app";

/** Short-lived MapKit JS token, only for our own website (origin-bound). Null when not configured or a foreign origin. */
export async function mapkitToken(env, origin) {
  if (!mapkitConfigured(env)) return null;
  const origins = String(env.SITE_ORIGINS || DEFAULT_ORIGINS).split(",").map((s) => s.trim()).filter(Boolean);
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || "");
  if (origin && !origins.includes(origin) && !local) return null;
  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: env.WEB_MAPKIT_JS_TEAM_ID || env.APN_TEAM_ID, iat: now, exp: now + 30 * 60 };
  if (origin && !local) claims.origin = origin;
  return es256({ alg: "ES256", kid: env.WEB_MAPKIT_JS_KEY_ID, typ: "JWT" }, claims, env.WEB_MAPKIT_JS_P8);
}
