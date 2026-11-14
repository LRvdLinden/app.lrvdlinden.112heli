// Home: live radar, ticker, counters, animated routes.
import { initChrome, fetchLive, soort, drawing, esc, countUp, placeText, alt, TYPES, reveal } from "./core.js";

initChrome();

// Gallery of everything that flies.
const gallery = document.getElementById("gallery");
gallery.innerHTML = TYPES.map((t, i) => `
  <a class="type reveal" style="--c:${(soortColor(t.soort))};--d:${(i % 6) * 0.05}s" href="/toestellen/#soorten">
    <img src="/assets/img/${t.img}.webp" alt="${esc(t.titel)}" loading="lazy">
    <b>${esc(t.titel)}</b><small>${esc(t.sub)}</small>
  </a>`).join("");
function soortColor(s) { return soort({ soort: s }).kleur; }
reveal(gallery);

// Radar: Netherlands mapped onto the circle.
const BOX = { s: 50.7, n: 53.7, w: 3.1, e: 7.3 };
const radar = document.getElementById("radarBlips");
function place(a) {
  const x = (a.lon - BOX.w) / (BOX.e - BOX.w), y = 1 - (a.lat - BOX.s) / (BOX.n - BOX.s);
  return { left: `${10 + x * 80}%`, top: `${10 + y * 80}%` };
}

const ticker = document.getElementById("tickerMove");
async function refresh() {
  let data;
  try { data = await fetchLive(); } catch { return; }
  const list = data.aircraft || [];
  const air = list.filter((a) => a.airborne && a.lat != null);

  radar.innerHTML = air.map((a) => {
    const p = place(a);
    return `<a class="blip" href="/toestel/?hex=${a.hex}" style="left:${p.left};top:${p.top};--c:${soort(a).kleur}" title="${esc(a.naam)}"><i></i><span>${esc(a.naam)}</span></a>`;
  }).join("");

  const n = air.length;
  document.querySelectorAll("[data-inair]").forEach((el) => (el.textContent = n === 1 ? "1 toestel nu in de lucht" : `${n} toestellen nu in de lucht`));
  countUp(document.getElementById("sAir"), n);
  countUp(document.getElementById("sKnown"), list.length);
  countUp(document.getElementById("sHeli"), air.filter((a) => ["trauma", "politie"].includes(a.soort) || /heli|aw189|chinook|apache|cougar|nh90/.test(a.icoon || "")).length);
  countUp(document.getElementById("sInc"), (data.incidents || []).length);

  const items = (air.length ? air : list.slice(0, 8)).map((a) =>
    `<a class="ticker-item" href="/toestel/?hex=${a.hex}"><img src="${drawing(a)}" alt=""><b>${esc(a.naam)}</b><span class="muted">${esc(a.airborne ? [placeText(a), alt(a.alt)].filter(Boolean).join(" · ") : "niet in de lucht")}</span></a>`);
  if (!items.length) items.push(`<span class="ticker-item muted">Nu even niets in de lucht. Kijk op de live kaart wanneer ze opstijgen.</span>`);
  ticker.innerHTML = items.join("") + items.join(""); // twice for a seamless loop
  ticker.style.setProperty("--dur", `${Math.max(25, items.length * 9)}s`);

  const weer = document.getElementById("weer");
  if (data.weer) { weer.hidden = false; weer.textContent = `Weinig helikopterinzet verwacht: ${data.weer.reden}`; } else weer.hidden = true;
}
refresh();
setInterval(refresh, 15000);
