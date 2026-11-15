// MV3 service worker: de site werkt als app en opent ook zonder verbinding (dan met de laatst bekende gegevens).
const VERSION = "mv3-v5";
const SHELL = [
  "/", "/index.html", "/404.html", "/offline.html", "/site.webmanifest", "/favicon.svg", "/favicon.png",
  "/assets/css/mv3.css?v=5", "/assets/js/config.js?v=1", "/assets/js/app.js?v=5", "/assets/js/i18n.js?v=5", "/assets/js/airports.js?v=5",
  "/assets/img/jet-side.webp", "/assets/img/112heli.png", "/assets/img/icon-192.png",
  "/assets/fonts/Inter-Regular.woff2", "/assets/fonts/Inter-Medium.woff2", "/assets/fonts/Inter-SemiBold.woff2",
  "/assets/fonts/InterDisplay-Bold.woff2", "/assets/fonts/InterDisplay-Black.woff2",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Live data: always from the network, the last answer as fallback.
  if (url.pathname.startsWith("/v1/kijkers")) return; // live counter: never cached
  if (url.pathname.startsWith("/v1/") && !url.pathname.startsWith("/v1/mapkit-token")) {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION + "-data").then((c) => c.put(req, copy)); return res; })
      .catch(() => caches.match(req)));
    return;
  }
  if (url.origin !== location.origin) return; // MapKit and the rest: straight to the network
  // Pages: network first, then the cached page, then the offline page.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("/index.html").then((r) => r || caches.match("/offline.html"))));
    return;
  }
  // Files: cache first, refreshed in the background.
  e.respondWith(caches.match(req).then((hit) => {
    const net = fetch(req).then((res) => { if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone())); return res; }).catch(() => hit);
    return hit || net;
  }));
});
