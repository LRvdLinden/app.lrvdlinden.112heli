// Downloads of 112Heli from App Store Connect (daily sales reports), for beheer (LRbeheer and the web beheer).
// Same approach and parsing as the central LRbeheer function (Bekendr, Pairr, Noodpakket).
// Secrets (from LRvdLinden/app.lrvdlinden.secrets): ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8, ASC_VENDOR_NUMBER.
import { es256, pem } from "./apple.js";

const now = () => Math.floor(Date.now() / 1000);

export const ascConfigured = (env) => Boolean(env.ASC_KEY_ID && env.ASC_ISSUER_ID && pem(ascP8(env)).includes("PRIVATE KEY") && env.ASC_VENDOR_NUMBER);
/** The .p8 of the App Store Connect key; the APNs key when both are the same key. */
const ascP8 = (env) => env.ASC_KEY_P8 || (env.ASC_KEY_ID && env.ASC_KEY_ID === env.APN_KEY_ID ? env.APN_P8_CERT : "");

/** Product Type Identifier → kind (apps: iPhone 1/3/7, universal 1F/3F/7F, iPad 1T/3T/7T, Mac F1/F3/F7). */
export function salesKind(type) {
  const t = String(type || "").trim().toUpperCase();
  if (["1", "1F", "1T", "F1", "1E", "1EP", "1EU"].includes(t)) return "download";
  if (["3", "3F", "3T", "F3"].includes(t)) return "redownload";
  if (["7", "7F", "7T", "F7"].includes(t)) return "update";
  return null;
}

/** Device column → device as shown in beheer. */
export function salesDevice(device, type) {
  const d = String(device || "").trim().toLowerCase();
  if (d === "iphone" || d === "ipod touch" || d === "ipod") return "iPhone";
  if (d === "ipad") return "iPad";
  if (d === "desktop" || d === "mac" || String(type || "").trim().toUpperCase().startsWith("F")) return "Mac";
  if (d === "apple tv") return "Apple TV";
  return d ? String(device).trim() : "Overig";
}

/** Sales report (SALES/SUMMARY, tab separated) → rows of 112Heli, summed per device and kind. */
export function parseSalesReport(tsv, match = {}) {
  const lines = String(tsv).split(/\r?\n/).filter((l) => l.trim());
  const head = (lines[0] || "").split("\t").map((h) => h.trim().toLowerCase());
  const col = (n) => head.indexOf(n);
  const iType = col("product type identifier"), iUnits = col("units"), iDevice = col("device"), iParent = col("parent identifier");
  const iApple = col("apple identifier"), iTitle = col("title"), iSku = col("sku");
  if (iType < 0 || iUnits < 0) return [];
  const sku = (match.sku || "app.lrvdlinden.112HELI").toLowerCase(), title = (match.title || "112Heli").toLowerCase();
  const ok = (c) => {
    if (match.appleId) return (c[iApple] || "").trim() === match.appleId;
    if (iSku >= 0 && (c[iSku] || "").trim().toLowerCase() === sku) return true;
    const t = (c[iTitle] || "").trim().toLowerCase();
    return t === title || t.startsWith(title + ":") || t.startsWith(title + " -") || t.startsWith(title + " –");
  };
  const sum = new Map();
  for (const line of lines.slice(1)) {
    const c = line.split("\t");
    if (iParent >= 0 && (c[iParent] || "").trim()) continue; // in-app purchases
    if (!ok(c)) continue;
    const kind = salesKind(c[iType]);
    const units = Number((c[iUnits] || "").trim());
    if (!kind || !Number.isFinite(units) || units === 0) continue;
    const device = salesDevice(iDevice >= 0 ? c[iDevice] : "", c[iType]);
    const k = `${device}|${kind}`;
    const r = sum.get(k) || { device, kind, units: 0 };
    r.units += units;
    sum.set(k, r);
  }
  return [...sum.values()];
}

/** Days (YYYY-MM-DD, newest first) whose report is still to be fetched. */
export function daysToFetch(today, have, back = 30, max = 8) {
  const out = [];
  const t = Date.parse(`${today}T00:00:00Z`);
  for (let i = 1; i <= back && out.length < max; i++) {
    const d = new Date(t - i * 86400_000).toISOString().slice(0, 10);
    if (!have.includes(d)) out.push(d);
  }
  return out;
}

const amsterdamDay = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" });

async function salesDay(env, day, jwt) {
  const q = new URLSearchParams({
    "filter[frequency]": "DAILY", "filter[reportDate]": day, "filter[reportSubType]": "SUMMARY",
    "filter[reportType]": "SALES", "filter[vendorNumber]": env.ASC_VENDOR_NUMBER, "filter[version]": "1_1",
  });
  const r = await fetch(`https://api.appstoreconnect.apple.com/v1/salesReports?${q}`, {
    headers: { authorization: `Bearer ${jwt}`, accept: "application/a-gzip" }, signal: AbortSignal.timeout(30_000),
  });
  if (r.status === 404) return null; // no report (yet): no sales that day
  if (!r.ok || !r.body) throw new Error(`App Store Connect HTTP ${r.status}`);
  return await new Response(r.body.pipeThrough(new DecompressionStream("gzip"))).text();
}

/** Hourly: fetch the missing days (at most 8 per run) into the downloads table. */
export async function syncDownloads(env) {
  if (!ascConfigured(env)) return { skipped: true };
  const last = await env.DB.prepare("SELECT at FROM kv WHERE key = 'asc_sync'").first();
  if (last && now() - last.at < 3600) return { skipped: "recent" };
  await env.DB.prepare("INSERT OR REPLACE INTO kv (key, value, at) VALUES ('asc_sync', '', ?)").bind(now()).run();
  const row = await env.DB.prepare("SELECT value FROM kv WHERE key = 'asc_days'").first();
  let have = [];
  try { have = JSON.parse(row?.value || "[]"); } catch { have = []; }
  const today = amsterdamDay();
  const todo = daysToFetch(today, have);
  if (!todo.length) return { done: 0 };
  const t = now();
  const jwt = await es256({ alg: "ES256", kid: env.ASC_KEY_ID, typ: "JWT" },
    { iss: env.ASC_ISSUER_ID, iat: t, exp: t + 15 * 60, aud: "appstoreconnect-v1" }, ascP8(env));
  const match = { appleId: env.ASC_APPLE_ID || undefined, sku: env.ASC_SKU || undefined };
  const done = new Set(have);
  let fetched = 0;
  for (const day of todo) {
    const tsv = await salesDay(env, day, jwt);
    const age = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86400_000;
    if (tsv === null) { if (age >= 3) done.add(day); continue; }
    const rows = parseSalesReport(tsv, match);
    await env.DB.prepare("DELETE FROM downloads WHERE day = ?").bind(day).run();
    for (const r of rows) {
      await env.DB.prepare("INSERT INTO downloads (day, device, kind, units) VALUES (?, ?, ?, ?)").bind(day, r.device, r.kind, r.units).run();
    }
    if (age >= 2) done.add(day); // the last day can still change; keep fetching it for two days
    fetched++;
  }
  const keep = [...done].filter((d) => Date.parse(`${d}T00:00:00Z`) > Date.parse(`${today}T00:00:00Z`) - 40 * 86400_000);
  await env.DB.prepare("INSERT OR REPLACE INTO kv (key, value, at) VALUES ('asc_days', ?, ?)").bind(JSON.stringify(keep), now()).run();
  return { fetched };
}

/** For beheer: totals and downloads per day (30 days) per device. */
export async function downloadsSummary(env) {
  const configured = ascConfigured(env);
  const rows = (await env.DB.prepare("SELECT day, device, kind, units FROM downloads").all()).results || [];
  const today = amsterdamDay();
  const totals = { download: 0, redownload: 0, update: 0 };
  const perApparaat = {};
  const perDag = new Map();
  const t0 = Date.parse(`${today}T00:00:00Z`);
  for (let i = 29; i >= 0; i--) {
    const d = new Date(t0 - i * 86400_000).toISOString().slice(0, 10);
    perDag.set(d, { dag: d, iPhone: 0, iPad: 0, Mac: 0, appleTV: 0, overig: 0 });
  }
  let laatsteDag = null;
  for (const r of rows) {
    if (r.kind in totals) totals[r.kind] += r.units;
    if (!laatsteDag || r.day > laatsteDag) laatsteDag = r.day;
    if (r.kind !== "download") continue;
    perApparaat[r.device] = (perApparaat[r.device] || 0) + r.units;
    const p = perDag.get(r.day);
    if (!p) continue;
    if (r.device === "iPhone" || r.device === "iPad" || r.device === "Mac") p[r.device] += r.units;
    else if (r.device === "Apple TV") p.appleTV += r.units;
    else p.overig += r.units;
  }
  const sync = await env.DB.prepare("SELECT at FROM kv WHERE key = 'asc_sync'").first();
  return {
    configured, downloads: totals.download, opnieuw: totals.redownload, updates: totals.update,
    perApparaat, laatsteDag, bijgewerkt: sync?.at ?? null, dagen: [...perDag.values()],
  };
}
