// Toestellen: live status per toestel en alle soorten met uitleg.
import { initChrome, fetchLive, soort, drawing, esc, placeText, alt, age, ageOf, isOld, STATUS, statusOf, TYPES, reveal, filter } from "./core.js";

initChrome();

const types = document.getElementById("types");
types.innerHTML = TYPES.map((t, i) => `
  <article class="type reveal" id="${t.id}" style="--c:${soort({ soort: t.soort }).kleur};--d:${(i % 4) * 0.06}s">
    <img src="/assets/img/${t.img}.webp" alt="${esc(t.titel)}" loading="lazy">
    <b>${esc(t.titel)}</b><small>${esc(t.sub)}</small>
    <p class="muted" style="font-size:.88rem;margin:10px 0 0">${esc(t.tekst)}</p>
  </article>`).join("");
reveal(types);

const live = document.getElementById("live");
const chips = document.getElementById("filter");
let laatste = null;
if (chips) {
  chips.innerHTML = filter.chips();
  chips.addEventListener("click", (e) => { if (filter.klik(e.target.closest(".chip"))) refresh(laatste); });
}
async function refresh(cached) {
  let d = cached;
  try { if (!d) d = laatste = await fetchLive(); } catch { live.innerHTML = `<div class="empty">Geen verbinding met de server.</div>`; return; }
  const groups = { lucht: [], basis: [], grond: [], uit_beeld: [] };
  for (const a of (d.aircraft || []).filter(filter.toont)) (groups[statusOf(a)] || groups.grond).push(a);
  document.querySelectorAll("[data-inair]").forEach((el) => (el.textContent = `${groups.lucht.length} in de lucht`));
  live.innerHTML = Object.entries(groups).filter(([, l]) => l.length).map(([k, l]) => `
    <div class="status-group"><h2>${STATUS[k]} <span class="pill">${l.length}</span></h2>
      <div class="cards">${l.map((a) => `
        <a class="ac${isOld(a) ? " old" : ""}" href="/toestel/?hex=${a.hex}">
          <span class="thumb" style="--c:${soort(a).kleur}"><img src="${drawing(a)}" alt=""></span>
          <span class="t"><b>${esc(a.naam)}</b><small>${esc(placeText(a) || soort(a).naam)}</small></span>
          <span class="r">${a.airborne ? alt(a.alt) : `${age(ageOf(a))} geleden`}</span>
        </a>`).join("")}</div></div>`).join("") || `<div class="empty">Nog geen toestellen gezien in de afgelopen twee weken.</div>`;
}
refresh();
setInterval(refresh, 15000);
