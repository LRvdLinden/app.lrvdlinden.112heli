// 112Heli web-beheer: status, toestellen, meldingen van gebruikers en eigen pushberichten.
// Zelfde functies en inlog als LRbeheer → 112Heli. De sessie (30 dagen) staat alleen in deze browser.
import { API, initChrome } from "./core.js";

const KEY = "112heli.beheer";
const SOORTEN = { trauma: "Lifeliner", politie: "Politie", kustwacht: "Kustwacht", defensie: "Defensie", kmar: "Marechaussee", regering: "Regering", bijzonder: "Bijzonder" };
const PLATFORM = { ios: "iPhone", ipados: "iPad", macos: "Mac", tvos: "Apple TV" };
const root = document.getElementById("beheer");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => Number(n || 0).toLocaleString("nl-NL");
const when = (ts) => (ts ? new Date(ts * 1000).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "–");
const ago = (ts) => {
  if (!ts) return "nooit";
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (s < 90) return `${s} s geleden`;
  if (s < 5400) return `${Math.round(s / 60)} min geleden`;
  if (s < 172800) return `${Math.round(s / 3600)} uur geleden`;
  return `${Math.round(s / 86400)} dagen geleden`;
};

let session = null;
try { session = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { session = null; }
if (session && Date.parse(session.expires) < Date.now()) session = null;
let tab = "overzicht";
let cache = {};

async function api(path, init = {}) {
  const res = await fetch(API + path, {
    ...init,
    headers: { "content-type": "application/json", ...(session ? { authorization: "Bearer " + session.token } : {}), ...(init.headers || {}) },
    signal: AbortSignal.timeout(20000),
  });
  let data = {};
  try { data = await res.json(); } catch { data = {}; }
  if (res.status === 401 && session) { signOut(); throw new Error("Je sessie is verlopen. Log opnieuw in."); }
  if (!res.ok) throw new Error(data.error || `De server gaf HTTP ${res.status}`);
  return data;
}

function signOut() {
  session = null;
  cache = {};
  try { localStorage.removeItem(KEY); } catch {}
  render();
}

// ------------------------------------------------------------------ inloggen

function loginView(error = "") {
  root.innerHTML = `<div class="bh-login">
    <img src="/assets/img/app-icon.png" alt="" width="84" height="84">
    <h1>112Heli beheer</h1>
    <p class="muted">Log in met de gedeelde beheer-inlog.</p>
    <form class="bh-form" id="login">
      <label for="u">Gebruikersnaam</label><input class="bh-in" id="u" autocomplete="username" autocapitalize="none" required>
      <label for="p">Wachtwoord</label><input class="bh-in" id="p" type="password" autocomplete="current-password" required>
      <div class="bh-err" role="alert">${esc(error)}</div>
      <button class="bh-btn primary" type="submit">Inloggen</button>
      <p class="bh-note">Je sessie blijft 30 dagen geldig, alleen in deze browser. Ook in de app LRbeheer.</p>
    </form></div>`;
  document.getElementById("login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    try {
      const r = await api("/v1/beheer/login", { method: "POST", body: JSON.stringify({ user: document.getElementById("u").value.trim(), password: document.getElementById("p").value }) });
      session = { token: r.token, expires: r.expires, user: r.user };
      try { localStorage.setItem(KEY, JSON.stringify(session)); } catch {}
      render();
    } catch (err) {
      loginView(err.message);
    }
  });
  document.getElementById("u").focus();
}

// ------------------------------------------------------------------ shell

function shell() {
  const open = cache.overview?.tellers?.openMeldingen || 0;
  const tabs = [["overzicht", "Overzicht"], ["toestellen", "Toestellen"], ["meldingen", "Meldingen"], ["pushlog", "Pushlog"], ["push", "Pushbericht"]];
  root.innerHTML = `<div class="bh-top"><h1>112Heli beheer</h1><span class="sp"></span>
      <button class="bh-btn" id="ref">Vernieuwen</button><button class="bh-btn" id="out">Uitloggen</button></div>
    <div class="bh-tabs" role="tablist">${tabs.map(([id, t]) => `<button class="bh-tab" role="tab" data-tab="${id}" aria-selected="${tab === id}">${t}${id === "meldingen" && open ? `<span class="n">${open}</span>` : ""}</button>`).join("")}</div>
    <div id="pane"><div class="empty">Laden…</div></div>`;
  root.querySelectorAll(".bh-tab").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; shell(); load(); }));
  document.getElementById("out").addEventListener("click", signOut);
  document.getElementById("ref").addEventListener("click", () => { cache = {}; load(); });
}

async function load() {
  const pane = document.getElementById("pane");
  try {
    if (!cache.overview) { cache.overview = await api("/v1/beheer/overview"); shell(); }
    const p = document.getElementById("pane");
    if (tab === "overzicht") p.innerHTML = overviewView(cache.overview);
    if (tab === "toestellen") { cache.aircraft ||= await api("/v1/beheer/aircraft"); aircraftView(p, cache.aircraft.toestellen); }
    if (tab === "meldingen") { cache.reports ||= await api("/v1/beheer/reports"); reportsView(p, cache.reports.reports); }
    if (tab === "pushlog") { cache.pushlog ||= await api("/v1/beheer/pushlog"); pushLogView(p, cache.pushlog); }
    if (tab === "push") { cache.push ||= await api("/v1/beheer/push"); pushView(p, cache.push.berichten); }
  } catch (e) {
    if (!session) return loginView(e.message);
    (document.getElementById("pane") || pane).innerHTML = `<div class="empty nok">${esc(e.message)}</div>`;
  }
}

// ------------------------------------------------------------------ overzicht

function overviewView(o) {
  const t = o.tellers, s = o.status;
  const tile = (k, v, sub = "") => `<div class="bh-card bh-tile"><div class="k">${k}</div><div class="v">${fmt(v)}</div><div class="s">${sub}</div></div>`;
  const max = Math.max(1, ...o.dagen.map((d) => d.vluchten));
  const flag = (ok, yes = "Ingesteld", no = "Niet ingesteld") => `<span class="${ok ? "ok" : "nok"}">${ok ? yes : no}</span>`;
  return `<div class="bh-grid">
      ${tile("Nu in de lucht", t.inLucht, `${fmt(t.gezien24)} gezien in 24 uur`)}
      ${tile("Vluchten vandaag", t.vluchtenVandaag, `${fmt(t.vluchten7)} in 7 dagen`)}
      ${tile("Grote inzetten", t.inzetten7, t.actieveInzetten ? `<span class="warn">${t.actieveInzetten} nu actief</span>` : "7 dagen")}
      ${tile("Apparaten", t.apparaten, `${fmt(t.apparatenAan)} met meldingen aan`)}
      ${tile("Eigen zones", t.metZones, "apparaten met een zone")}
      ${tile("Live Activities", t.liveActivities, "nu gevolgd")}
      ${tile("Toestellen", t.toestellen, "bekend bij 112Heli")}
      ${tile("Open meldingen", t.openMeldingen, "van gebruikers")}
      ${tile("Downloads", o.downloads?.downloads ?? 0, o.downloads?.configured ? "eerste downloads, App Store" : "App Store Connect niet gekoppeld")}
    </div>
    <div class="bh-two">
      <div class="bh-card"><h2>Vluchten per dag</h2>
        <div class="bh-bars">${o.dagen.map((d) => `<div class="bh-bar" title="${d.dag}: ${d.vluchten} vluchten, ${d.apparaten} nieuwe apparaten"><span>${d.vluchten || ""}</span><i style="height:${(d.vluchten / max) * 100}%"></i><span>${d.dag.slice(8)}</span></div>`).join("")}</div>
        <p class="bh-note">Laatste 14 dagen. Nieuwe apparaten deze periode: ${fmt(o.dagen.reduce((a, d) => a + d.apparaten, 0))}.</p></div>
      <div class="bh-card"><h2>Server</h2><div class="bh-status">
        <div><span>Ophalen posities</span><span class="${s.ingestOk ? "ok" : "nok"}">${s.ingestOk ? "Goed" : "Storing"} · ${ago(s.lastIngest)}</span></div>
        ${s.lastResult?.error ? `<div><span>Laatste fout</span><span class="nok">${esc(s.lastResult.error)}</span></div>` : ""}
        <div><span>Pushmeldingen (APNs)</span>${flag(s.apns)}</div>
        <div><span>Apple Kaarten (website)</span>${flag(s.mapkit)}</div>
        <div><span>Weerbeperking</span><span>${ago(s.weer)}</span></div>
      </div></div>
      ${downloadsCard(o.downloads)}
      <div class="bh-card"><h2>Vluchten per soort (7 dagen)</h2>${o.perSoort.length ? o.perSoort.map((r) => `<div class="bh-row"><span>${esc(r.naam)}</span><b>${fmt(r.n)}</b></div>`).join("") : '<p class="bh-note">Nog geen vluchten.</p>'}</div>
      <div class="bh-card"><h2>Apparaten</h2>
        ${o.platforms.map((r) => `<div class="bh-row"><span>${esc(PLATFORM[r.platform] || r.platform)}</span><b>${fmt(r.n)}</b></div>`).join("") || '<p class="bh-note">Nog geen apparaten met meldingen.</p>'}
        ${o.versies.length ? `<h2 style="margin-top:16px">Versies</h2>${o.versies.map((r) => `<div class="bh-row"><span>${esc(r.versie)}</span><b>${fmt(r.n)}</b></div>`).join("")}` : ""}
      </div>
    </div>`;
}

function downloadsCard(d) {
  if (!d) return "";
  const kleuren = { iPhone: "#4c6bff", iPad: "#2ed3a3", Mac: "#a08cff", appleTV: "#f2a15e", overig: "#8a97a6" };
  const tot = (x) => x.iPhone + x.iPad + x.Mac + x.appleTV + x.overig;
  const max = Math.max(1, ...d.dagen.map(tot));
  const bars = d.dagen.map((x) => `<div class="bh-bar" title="${x.dag}: ${tot(x)} downloads"><span>${tot(x) || ""}</span>
    <div style="width:100%;height:${(tot(x) / max) * 100}%;display:flex;flex-direction:column-reverse;border-radius:6px 6px 2px 2px;overflow:hidden">
    ${Object.keys(kleuren).map((k) => (x[k] ? `<i style="height:${(x[k] / tot(x)) * 100}%;background:${kleuren[k]};border-radius:0;min-height:0"></i>` : "")).join("")}</div>
    <span>${x.dag.slice(8)}</span></div>`).join("");
  return `<div class="bh-card"><h2>Downloads</h2>
    ${d.configured ? "" : '<p class="bh-note warn">App Store Connect is nog niet gekoppeld: start <b>112Heli push</b> in app.lrvdlinden.secrets.</p>'}
    <div class="bh-bars">${bars}</div>
    <p class="bh-note">${Object.entries({ iPhone: "iPhone", iPad: "iPad", Mac: "Mac", appleTV: "Apple TV" }).map(([k, n]) => `<span style="color:${kleuren[k]}">■</span> ${n}`).join(" &nbsp; ")}</p>
    ${Object.entries(d.perApparaat || {}).map(([k, v]) => `<div class="bh-row"><span>${esc(k)}</span><b>${fmt(v)}</b></div>`).join("")}
    <div class="bh-row"><span>Opnieuw gedownload</span><b>${fmt(d.opnieuw)}</b></div>
    <div class="bh-row"><span>Updates</span><b>${fmt(d.updates)}</b></div>
    <p class="bh-note">30 dagen, uit de dagelijkse verkoopoverzichten van App Store Connect (een dag later binnen).${d.laatsteDag ? ` Laatste dag: ${esc(d.laatsteDag)}.` : ""}</p></div>`;
}

// ------------------------------------------------------------------ toestellen

function aircraftView(p, list) {
  p.innerHTML = `<input class="bh-in bh-search" id="q" type="search" placeholder="Zoek op naam, registratie, roepnaam of hex">
    <div class="bh-card"><table class="bh-table"><thead><tr><th>Toestel</th><th>Soort</th><th class="hide-s">Registratie</th><th>Laatst gezien</th><th class="hide-s">Vluchten 30 d</th></tr></thead><tbody id="rows"></tbody></table></div>
    <p class="bh-note">${fmt(list.length)} toestellen. Gegevens komen automatisch uit de herkenning van A-Alerts; corrigeren doe je daar.</p>`;
  const rows = document.getElementById("rows");
  const draw = (q = "") => {
    const f = q.toLowerCase();
    rows.innerHTML = list.filter((a) => !f || [a.naam, a.reg, a.callsign, a.hex, a.type, a.key].some((v) => String(v || "").toLowerCase().includes(f)))
      .map((a) => `<tr><td><a href="/toestel/?hex=${esc(a.hex)}" target="_blank" rel="noopener"><b>${esc(a.naam || a.callsign || a.hex)}</b></a> ${a.inLucht ? '<span class="bh-tag lucht">in de lucht</span>' : ""}<br><span class="bh-note">${esc([a.type, a.callsign, a.hex].filter(Boolean).join(" · "))}</span></td>
        <td>${esc(a.soortNaam)}</td><td class="hide-s">${esc(a.reg || "–")}</td><td>${ago(a.seen)}</td><td class="hide-s">${fmt(a.vluchten30)}</td></tr>`).join("")
      || '<tr><td colspan="5" class="bh-note">Niets gevonden.</td></tr>';
  };
  draw();
  document.getElementById("q").addEventListener("input", (e) => draw(e.target.value));
}

// ------------------------------------------------------------------ meldingen

function reportsView(p, list) {
  if (!list.length) { p.innerHTML = '<div class="empty">Nog geen meldingen van gebruikers.</div>'; return; }
  p.innerHTML = `<div class="bh-card"><table class="bh-table"><thead><tr><th>Melding</th><th class="hide-s">Toestel</th><th>Status</th><th></th></tr></thead><tbody>
    ${list.map((r) => `<tr><td>${esc(r.tekst)}<br><span class="bh-note">${when(r.created_at)}${r.platform ? " · " + esc(PLATFORM[r.platform] || r.platform) : ""}${r.app_version ? " " + esc(r.app_version) : ""}</span></td>
      <td class="hide-s">${esc(r.naam || "Toestel ontbreekt")}<br><span class="bh-note">${esc([r.reg, r.hex, SOORTEN[r.soort]].filter(Boolean).join(" · "))}</span></td>
      <td><span class="bh-tag ${esc(r.status)}">${esc(r.status)}</span></td>
      <td><div class="bh-actions">
        ${r.status !== "opgelost" ? `<button class="bh-btn" data-id="${r.id}" data-s="opgelost">Opgelost</button>` : `<button class="bh-btn" data-id="${r.id}" data-s="nieuw">Heropenen</button>`}
        ${r.status === "nieuw" ? `<button class="bh-btn" data-id="${r.id}" data-s="bekeken">Bekeken</button>` : ""}
        <button class="bh-btn danger" data-id="${r.id}" data-del="1">Verwijderen</button></div></td></tr>`).join("")}
    </tbody></table></div>`;
  p.querySelectorAll("button[data-id]").forEach((b) => b.addEventListener("click", async () => {
    if (b.dataset.del && !confirm("Deze melding verwijderen?")) return;
    b.disabled = true;
    try {
      await api(`/v1/beheer/reports/${b.dataset.id}`, b.dataset.del ? { method: "DELETE" } : { method: "POST", body: JSON.stringify({ status: b.dataset.s }) });
      cache.reports = null; cache.overview = null;
      await load();
    } catch (e) { alertBox(e.message); }
  }));
}

// ------------------------------------------------------------------ pushlog

const PUSH_SOORT = { takeoff: "Opstijgen", landing: "Landing", callsign: "Roepnaam", incident: "Grote inzet", zone: "Zone", bericht: "Pushbericht", test: "Testmelding" };

function pushLogView(p, d) {
  const rows = d.meldingen || [];
  p.innerHTML = `<div class="bh-card"><h2>Pushmeldingen</h2>
      <p class="bh-note">Elke melding die naar Apple ging, met het antwoord van Apple. Laatste 24 uur: <span class="ok">${fmt(d.ok24u)} aangenomen</span> · <span class="${d.fout24u ? "nok" : ""}">${fmt(d.fout24u)} geweigerd</span>. We bewaren 7 dagen.</p>
    </div>
    ${rows.length ? `<div class="bh-card"><table class="bh-table"><thead><tr><th>Melding</th><th class="hide-s">Soort</th><th class="hide-s">Toestel</th><th>Apple</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td>${esc(r.titel || "–")}<br><span class="bh-note">${when(r.at)}</span></td>
        <td class="hide-s">${esc(PUSH_SOORT[r.kind] || r.kind || "–")}</td>
        <td class="hide-s">…${esc(r.token_end)}<br><span class="bh-note">${esc(r.environment === "sandbox" ? "Xcode (sandbox)" : "TestFlight / App Store")}</span></td>
        <td>${r.ok ? '<span class="ok">Aangenomen</span>' : `<span class="nok">${esc(r.reason || (r.status ? "Status " + r.status : "Geen antwoord"))}</span>`}</td></tr>`).join("")}
    </tbody></table></div>` : '<div class="empty">Nog geen pushmeldingen verstuurd sinds de pushlog bestaat.</div>'}`;
}

// ------------------------------------------------------------------ pushbericht

function pushView(p, history) {
  p.innerHTML = `<div class="bh-two">
    <div class="bh-card"><h2>Nieuw pushbericht</h2>
      <form class="bh-form" id="push">
        <label for="t">Titel (optioneel)</label><input class="bh-in" id="t" maxlength="80">
        <label for="x">Tekst</label><textarea class="bh-area" id="x" maxlength="300" required></textarea>
        <label>Alleen naar apparaten die deze soorten volgen (niets aangevinkt = iedereen)</label>
        <div>${Object.entries(SOORTEN).map(([k, v]) => `<label class="bh-check"><input type="checkbox" name="s" value="${k}"> ${v}</label>`).join("")}</div>
        <p class="bh-note" id="bereik">Bereik: …</p>
        <div class="bh-err" id="perr" role="alert"></div>
        <button class="bh-btn primary" type="submit">Versturen</button>
        <p class="bh-note">Gaat naar iPhone, iPad en Mac met meldingen aan, met het eigen 112Heli-geluid.</p>
      </form></div>
    <div class="bh-card"><h2>Verstuurd</h2>${history.length ? history.map((b) => `<div class="bh-row"><span>${b.titel ? `<b>${esc(b.titel)}</b><br>` : ""}${esc(b.tekst)}<br><span class="bh-note">${when(b.created_at)}${b.soorten.length ? " · " + b.soorten.map((s) => SOORTEN[s] || s).join(", ") : " · iedereen"}</span></span><span class="bh-note" style="white-space:nowrap">${fmt(b.ok)} / ${fmt(b.bereik)}</span></div>`).join("") : '<p class="bh-note">Nog geen berichten verstuurd.</p>'}</div>
  </div>`;
  const form = document.getElementById("push");
  const chosen = () => [...form.querySelectorAll('input[name="s"]:checked')].map((i) => i.value);
  const reach = async () => {
    try { const r = await api(`/v1/beheer/push/bereik?soorten=${chosen().join(",")}`); document.getElementById("bereik").textContent = `Bereik: ${fmt(r.bereik)} apparaten`; }
    catch { document.getElementById("bereik").textContent = "Bereik: onbekend"; }
  };
  form.querySelectorAll('input[name="s"]').forEach((i) => i.addEventListener("change", reach));
  reach();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const tekst = document.getElementById("x").value.trim();
    if (!tekst) return;
    if (!confirm("Dit pushbericht nu versturen?")) return;
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      const r = await api("/v1/beheer/push", { method: "POST", body: JSON.stringify({ titel: document.getElementById("t").value.trim(), tekst, soorten: chosen(), doel: "alle" }) });
      cache.push = null;
      await load();
      alertBox(`Verstuurd naar ${fmt(r.verstuurd)} van ${fmt(r.bereik)} apparaten.`);
    } catch (err) {
      document.getElementById("perr").textContent = err.message;
      btn.disabled = false;
    }
  });
}

function alertBox(msg) {
  const d = document.createElement("div");
  d.className = "banner";
  d.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99;background:var(--navy3)";
  d.textContent = msg;
  document.body.append(d);
  setTimeout(() => d.remove(), 4000);
}

function render() {
  if (!session) return loginView();
  shell();
  load();
}

initChrome();
render();
