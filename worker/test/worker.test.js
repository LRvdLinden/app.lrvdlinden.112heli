import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { classify, isAirborne, findClusters, wantsTakeoff, distanceKm, plekVan, bovenPlaats } from "../src/fleet.js";
import { ingest, activityState } from "../src/engine.js";
import worker from "../src/index.js";

// ---- Minimal D1 stand-in on node:sqlite (prepare/bind/first/all/run/batch).
function d1() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => { const r = db.prepare(sql).run(...args); return { meta: { last_row_id: Number(r.lastInsertRowid), changes: r.changes } }; },
  });
  return { prepare: (sql) => stmt(sql), batch: async (list) => Promise.all(list.map((s) => s.run())), raw: db };
}

test("classify: A-Alerts recognition", () => {
  assert.equal(classify({ hex: "484A1B", r: "PH-LLN", flight: "LIFELN4 ", lat: 53, lon: 6.5 }).naam, "Lifeliner 4");
  assert.equal(classify({ hex: "484A1B", flight: "LIFELN4" }).basis, "Groningen");
  const z = classify({ hex: "484AC0", r: "PH-PXZ", flight: "ZXP26" });
  assert.equal(z.naam, "Zulu 26");
  assert.equal(z.soort, "politie");
  assert.equal(z.icoon, null);
  const k = classify({ hex: "484000", r: "PH-SAR", lat: 52.9, lon: 4.7 });
  assert.equal(k.soort, "kustwacht");
  assert.equal(k.icoon, "kustwacht_aw189");
  const c = classify({ hex: "480a01", r: "D-890", t: "H47", dbFlags: 1, lat: 51.5, lon: 4.9 });
  assert.equal(c.soort, "defensie");
  assert.equal(c.icoon, "chinook");
  assert.equal(classify({ hex: "3c0001", t: "H47", dbFlags: 1, lat: 51.5, lon: 4.9 }), null); // foreign military
  assert.equal(classify({ hex: "484369", r: "PH-BQB", flight: "KLM701", lat: 52, lon: 4 }), null);
  assert.equal(classify({ hex: "484c00", r: "PH-GOV", lat: 52.3, lon: 4.8 }).icoon, "phgov");
  const max = classify({ hex: "4867E6", r: "PH-UTL", t: "FA8X", lat: 43.7, lon: 7.4 });
  assert.equal(max.naam, "Max Verstappen");
  assert.equal(max.soort, "bijzonder");
  assert.equal(max.icoon, "verstappen");
});

test("classify: learned airframe under another callsign", () => {
  const heli = new Map([["484a1b", { id: "lifeliner3", naam: "Lifeliner 3", soort: "trauma", basis: "Volkel", callsigns: [] }]]);
  const r = classify({ hex: "484A1B", flight: "ANWB12" }, heli);
  assert.equal(r.naam, "Lifeliner 3");
  assert.equal(r.herkenning, "toestel");
});

test("isAirborne", () => {
  assert.equal(isAirborne({ alt_baro: "ground", gs: 0 }), false);
  assert.equal(isAirborne({ alt_baro: 1200, gs: 110 }), true);
  assert.equal(isAirborne({ alt_baro: 150, gs: 5 }), false);
  assert.equal(isAirborne({ alt_baro: 150, gs: 60 }), true);
  assert.equal(isAirborne({ gs: 80 }), true);
});

test("places: hospital/base and place above", () => {
  assert.ok(Math.abs(distanceKm(52.37, 4.89, 51.92, 4.48) - 57) < 3);
  assert.equal(plekVan(52.3343, 4.8597)?.soort !== undefined, true);
  assert.equal(plekVan(52.6, 5.2), null);
  assert.ok(bovenPlaats(52.2112, 5.9699)?.includes("Apeldoorn"));
});

test("findClusters: helicopters at one spot, not at a hospital or base", () => {
  const h = (hex, lat, lon) => ({ hex, lat, lon, soort: "trauma", icoon: null, alt: 0, gs: 0, airborne: false });
  const c = findClusters([h("a", 52.6, 5.2), h("b", 52.605, 5.205), h("c", 53.0, 6.0)]);
  assert.equal(c.length, 1);
  assert.deepEqual(c[0].hexes, ["a", "b"]);
  assert.equal(findClusters([h("a", 52.3343, 4.8597), h("b", 52.335, 4.86)]).length, 0);
  const jet = { hex: "j", lat: 52.6, lon: 5.2, soort: "defensie", icoon: "f35", alt: 0, gs: 0, airborne: false };
  assert.equal(findClusters([h("a", 52.6, 5.2), jet]).length, 0);
});

test("wantsTakeoff: soort, radius, favorites", () => {
  const ac = { hex: "484a1b", soort: "trauma" };
  const base = { enabled: 1, takeoff: 1, fav_alerts: 1, soorten: '["trauma"]', favorites: "[]", lat: 52.21, lon: 5.97, radius_km: 30 };
  assert.equal(wantsTakeoff(base, ac, 52.25, 6.0), true);
  assert.equal(wantsTakeoff(base, ac, 53.2, 6.6), false);
  assert.equal(wantsTakeoff({ ...base, radius_km: 0 }, ac, 53.2, 6.6), true);
  assert.equal(wantsTakeoff({ ...base, soorten: '["politie"]' }, ac, 52.25, 6.0), false);
  assert.equal(wantsTakeoff({ ...base, takeoff: 0, favorites: '["484a1b"]' }, ac, 53.2, 6.6), true);
});

test("ingest: takeoff, positions, landing and API", async () => {
  const DB = d1();
  const env = { DB };
  const rec = (alt, gs, lat = 52.3, lon = 5.5) => [{ hex: "484A1B", r: "PH-LLN", flight: "LIFELN4", t: "EC35", lat, lon, alt_baro: alt, gs, track: 90, seen_pos: 1 },
    { hex: "484369", r: "PH-BQB", flight: "KLM701", lat: 52, lon: 4, alt_baro: 30000, gs: 450 }];

  let r = await ingest(env, rec("ground", 0));
  assert.equal(r.matched, 1);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM aircraft").get().n, 1);

  r = await ingest(env, rec(800, 100, 52.31, 5.52));
  assert.deepEqual(r.events, ["takeoff:Lifeliner 4"]);
  const f = DB.raw.prepare("SELECT * FROM flights").get();
  assert.ok(f && f.end_ts == null);
  assert.equal(DB.raw.prepare("SELECT COUNT(*) n FROM positions").get().n, 1);

  r = await ingest(env, rec("ground", 0, 52.4, 5.6));
  assert.deepEqual(r.events, ["landing:Lifeliner 4"]);
  assert.ok(DB.raw.prepare("SELECT end_ts FROM flights").get().end_ts != null);

  const res = await worker.fetch(new Request("https://x/v1/live"), env);
  const body = await res.json();
  assert.equal(body.aircraft.length, 1);
  assert.equal(body.aircraft[0].naam, "Lifeliner 4");
  assert.equal(body.aircraft[0].soort, "trauma");
  assert.equal(body.aircraft[0].airborne, false);

  const fl = await (await worker.fetch(new Request("https://x/v1/flights?days=1"), env)).json();
  assert.equal(fl.flights.length, 1);
  assert.equal(fl.flights[0].reg, "PH-LLN");
});

test("ingest: aircraft first seen high in the air gives no takeoff push event", async () => {
  const env = { DB: d1() };
  const r = await ingest(env, [{ hex: "484AC0", r: "PH-PXZ", flight: "ZXP26", lat: 52.1, lon: 5.1, alt_baro: 2500, gs: 120, seen_pos: 0 }]);
  assert.deepEqual(r.events, []);
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) n FROM flights").get().n, 1);
});

test("grote inzet is detected once", async () => {
  const env = { DB: d1() };
  const two = (alt) => [
    { hex: "000001", flight: "LIFELN4", lat: 52.6, lon: 5.2, alt_baro: alt, gs: 0, seen_pos: 0 },
    { hex: "000002", flight: "LIFELN3", lat: 52.604, lon: 5.204, alt_baro: alt, gs: 0, seen_pos: 0 },
  ];
  await ingest(env, two("ground"));
  const r = await ingest(env, two("ground"));
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) n FROM incidents").get().n, 1);
  assert.ok(!r.events.some((e) => e.startsWith("incident")));
  const inc = await (await worker.fetch(new Request("https://x/v1/incidents"), env)).json();
  assert.deepEqual(inc.incidents[0].hexes, ["000001", "000002"]);
});

test("devices: validation and save", async () => {
  const env = { DB: d1() };
  const bad = await worker.fetch(new Request("https://x/v1/devices", { method: "POST", body: JSON.stringify({ token: "nope" }) }), env);
  assert.equal(bad.status, 400);
  const token = "a".repeat(64);
  const ok = await worker.fetch(new Request("https://x/v1/devices", { method: "POST",
    body: JSON.stringify({ token, environment: "sandbox", soorten: ["politie", "x"], favorites: ["484A1B"], lat: 52.2112, lon: 5.9699, radiusKm: 999 }) }), env);
  assert.equal(ok.status, 200);
  const d = env.DB.raw.prepare("SELECT * FROM devices").get();
  assert.equal(d.soorten, '["politie"]');
  assert.equal(d.favorites, '["484a1b"]');
  assert.equal(d.radius_km, 500);
  assert.equal(d.lat, 52.21);
});

test("activityState for Live Activities", () => {
  const t = 1_000_000;
  const s = activityState({ naam: "Lifeliner 2", soort: "trauma", reg: "PH-DOC" }, { airborne: 1, seen_at: t - 10, alt: 1000, gs: 120.4, track: 45, lat: 52, lon: 5 }, t);
  assert.equal(s.status, "In de lucht");
  assert.equal(s.speedKt, 120);
  assert.equal(activityState({ naam: "X" }, null, t).status, "Geen signaal");
});

import { landingSpot, zonesHit } from "../src/engine.js";
import { weerBeperking } from "../src/weer.js";

test("landingSpot: base, hospital or place", () => {
  assert.match(landingSpot(51.9569, 4.4372).text, /terug op de basis/);
  assert.equal(landingSpot(52.6, 5.2).text.startsWith("is geland"), true);
});

test("zonesHit: own zone, any aircraft of a chosen kind", () => {
  const d = { zones: JSON.stringify([{ naam: "Apeldoorn", lat: 52.21, lon: 5.97, km: 5 }]), soorten: '["trauma","politie"]' };
  assert.equal(zonesHit(d, { soort: "trauma", airborne: true, lat: 52.22, lon: 5.98 }).length, 1);
  assert.equal(zonesHit(d, { soort: "trauma", airborne: true, lat: 52.5, lon: 5.98 }).length, 0);
  assert.equal(zonesHit(d, { soort: "defensie", airborne: true, lat: 52.22, lon: 5.98 }).length, 0);
  assert.equal(zonesHit(d, { soort: "politie", airborne: false, lat: 52.22, lon: 5.98 }).length, 0);
});

test("weerBeperking: KNMI fog in force", () => {
  const now = Date.parse("2026-11-14T10:00:00Z");
  const w = [{ bron: "knmi", niveau: "yellow", soort: "Dichte mist", titel: "Code geel", start: "2026-11-14T06:00:00Z", einde: "2026-11-14T12:00:00Z", status: "actief" }];
  assert.deepEqual(weerBeperking(w, now), { reden: "dichte mist", niveau: "yellow" });
  assert.equal(weerBeperking([{ ...w[0], einde: "2026-11-14T09:00:00Z" }], now), null);
});

test("reports and beheer", async () => {
  const env = { DB: d1(), BEHEER_USER: "leon", BEHEER_PASSWORD: "geheim" };
  const ok = await worker.fetch(new Request("https://x/v1/reports", { method: "POST", body: JSON.stringify({ hex: "484a1b", naam: "Lifeliner 4", tekst: "Staat op de verkeerde plek" }) }), env);
  assert.equal(ok.status, 200);
  const no = await worker.fetch(new Request("https://x/v1/beheer/reports"), env);
  assert.equal(no.status, 401);
  const yes = await worker.fetch(new Request("https://x/v1/beheer/reports", { headers: { authorization: "Basic " + btoa("leon:geheim") } }), env);
  const body = await yes.json();
  assert.equal(body.reports[0].naam, "Lifeliner 4");
});

test("mapkit token: 503 without keys", async () => {
  const res = await worker.fetch(new Request("https://x/v1/mapkit-token", { headers: { origin: "https://112heli.lrvdlinden.app" } }), { DB: d1() });
  assert.equal(res.status, 503);
});

test("beheer: login, token, overview, aircraft, reports and push", async () => {
  const env = { DB: d1(), BEHEER_USER: "leon", BEHEER_PASSWORD: "geheim1" };
  const call = (path, init = {}, token) => worker.fetch(new Request("https://x" + path, { ...init, headers: { ...(token ? { authorization: "Bearer " + token } : {}), ...(init.headers || {}) } }), env);
  assert.equal((await call("/v1/beheer/overview")).status, 401);
  assert.equal((await call("/v1/beheer/login", { method: "POST", body: JSON.stringify({ user: "leon", password: "fout" }) })).status, 401);
  const login = await (await call("/v1/beheer/login", { method: "POST", body: JSON.stringify({ user: "Leon", password: "geheim1" }) })).json();
  assert.ok(login.token.includes("."));
  assert.equal((await call("/v1/beheer/overview", {}, login.token + "x")).status, 401);
  const o = await (await call("/v1/beheer/overview", {}, login.token)).json();
  assert.equal(o.dagen.length, 14);
  assert.equal(o.tellers.apparaten, 0);
  assert.equal(o.status.apns, false);
  const a = await (await call("/v1/beheer/aircraft", {}, login.token)).json();
  assert.ok(Array.isArray(a.toestellen));
  await call("/v1/reports", { method: "POST", body: JSON.stringify({ hex: "484a1b", tekst: "Klopt niet" }) });
  const rep = await (await call("/v1/beheer/reports", {}, login.token)).json();
  const id = rep.reports[0].id;
  assert.equal((await (await call(`/v1/beheer/reports/${id}`, { method: "POST", body: JSON.stringify({ status: "opgelost" }) }, login.token)).json()).status, "opgelost");
  assert.equal((await call(`/v1/beheer/reports/${id}`, { method: "DELETE" }, login.token)).status, 200);
  assert.equal((await (await call("/v1/beheer/overview", {}, login.token)).json()).tellers.openMeldingen, 0);
  // Push without APNs keys: 503, and the reach is counted per soort.
  assert.equal((await call("/v1/beheer/push", { method: "POST", body: JSON.stringify({ tekst: "Test" }) }, login.token)).status, 503);
  assert.equal((await (await call("/v1/beheer/push/bereik?soorten=trauma", {}, login.token)).json()).bereik, 0);
  assert.deepEqual((await (await call("/v1/beheer/push", {}, login.token)).json()).berichten, []);
});

test("spoor and vluchten in the A-Alerts format", async () => {
  const env = { DB: d1() };
  const t = Math.floor(Date.now() / 1000);
  await env.DB.prepare("INSERT INTO flights (id, hex, start_ts, max_alt) VALUES (1, 'abc123', ?, 900)").bind(t - 900).run();
  await env.DB.prepare("INSERT INTO state (hex, airborne, seen_at, flight_id) VALUES ('abc123', 1, ?, 1)").bind(t).run();
  for (let i = 0; i < 10; i++) {
    await env.DB.prepare("INSERT INTO positions (hex, ts, lat, lon, alt, flight_id) VALUES ('abc123', ?, ?, 6.0, 800, 1)").bind(t - 900 + i * 90, 52.2 + i * 0.01).run();
  }
  const s = await (await worker.fetch(new Request("https://x/v1/aircraft/abc123/spoor?scope=vlucht"), env)).json();
  assert.equal(s.punten.length, 10);
  assert.equal(s.vlucht.onderweg, true);
  assert.ok(s.vlucht.afstand_km > 9 && s.vlucht.afstand_km < 11);
  assert.ok(Array.isArray(s.plaatsen) && s.plaatsen.length >= 1);
  const k = await (await worker.fetch(new Request("https://x/v1/aircraft/abc123/spoor?scope=kort"), env)).json();
  assert.equal(k.punten.length, 10);
  const v = await (await worker.fetch(new Request("https://x/v1/aircraft/abc123/vluchten"), env)).json();
  assert.equal(v.vluchten[0].duur_min, 15);
});
