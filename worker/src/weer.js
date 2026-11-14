// "Weinig helikopterinzet verwacht": KNMI codes that usually keep helicopters on the ground. Same rule as A-Alerts
// (worker/src/vliegend.js → weerBeperking); the warnings are read from the public A-Alerts API (read only).

const WEER = [
  [/mist|zicht/i, "dichte mist"],
  [/onweer/i, "onweer"],
  [/wind|storm/i, "harde wind"],
  [/ijzel|sneeuw|glad/i, "sneeuw of ijzel"],
];
const RANG = { yellow: 1, orange: 2, red: 3 };

/** A KNMI code that is in force now and usually limits flying: { reden, niveau } or null. */
export function weerBeperking(waarschuwingen, now = Date.now()) {
  let best = null;
  for (const w of waarschuwingen || []) {
    if (w.bron !== "knmi" || !RANG[w.niveau] || w.status === "beeindigd") continue;
    if (Date.parse(w.start) > now || (w.einde && Date.parse(w.einde) < now)) continue;
    const r = WEER.find(([re]) => re.test(`${w.soort || ""} ${w.titel || ""}`));
    if (r && (!best || RANG[w.niveau] > RANG[best.niveau])) best = { reden: r[1], niveau: w.niveau };
  }
  return best;
}

const AALERTS_API = "https://p2000-apeldoorn-api.lrvdlinden.workers.dev";

/** Refreshes the weather limit at most every 10 minutes and keeps it in kv ("weer"). */
export async function refreshWeer(env, now = Date.now()) {
  const row = await env.DB.prepare("SELECT value, at FROM kv WHERE key = 'weer'").first();
  if (row && now - row.at * 1000 < 600_000) return;
  try {
    const res = await fetch(`${env.AALERTS_API || AALERTS_API}/v1/waarschuwingen?days=2`, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    const list = Array.isArray(body) ? body : body.waarschuwingen || body.items || [];
    const w = weerBeperking(list, now);
    await env.DB.prepare("INSERT OR REPLACE INTO kv (key, value, at) VALUES ('weer', ?, ?)").bind(JSON.stringify(w), Math.floor(now / 1000)).run();
  } catch (e) {
    console.warn("[weer]", e.message);
  }
}

export async function currentWeer(env) {
  const row = await env.DB.prepare("SELECT value FROM kv WHERE key = 'weer'").first();
  try { return row ? JSON.parse(row.value) : null; } catch { return null; }
}
