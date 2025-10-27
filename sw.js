// sw.js — EDU'FUN PWA (offline robuste)
const CACHE = "edufun-v5";

// Chemin racine (utile sur GitHub Pages : /edufun-wordsearch/)
const SCOPE = new URL(self.registration.scope);
const BASE = SCOPE.pathname.replace(/\/$/, ""); // ex. "/edufun-wordsearch"

const A = (p) => new URL(BASE + "/" + p.replace(/^\/+/, ""), SCOPE).toString();

const ASSETS = [
  A(""),                     // "/edufun-wordsearch/"
  A("index.html"),
  A("offline.html"),
  A("manifest.webmanifest"),
  A("assets/icons/edufun-logo-192.png"),
  A("assets/icons/edufun-logo-512.png"),
  A("fonts/NotoKufiArabic-Regular.woff2"),
  A("fonts/NotoKufiArabic-Bold.woff2"),
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(ASSETS.map(async (url) => {
      try {
        const res = await fetch(url, { cache: "no-cache" });
        if (res && res.ok) await cache.put(url, res.clone());
      } catch {/* ignore */}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;

  // On ne gère que GET http(s)
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (!/^https?:$/.test(url.protocol)) return;

  // 1) Navigations (pages)
  if (req.mode === "navigate" || req.destination === "document") {
    e.respondWith((async () => {
      // Réseau d'abord
      try {
        const res = await fetch(req);
        // met à jour le cache de la page d’accueil si c’est elle
        if (url.pathname === BASE + "/" || url.pathname === BASE + "/index.html") {
          (await caches.open(CACHE)).put(A("index.html"), res.clone()).catch(()=>{});
        }
        return res;
      } catch {
        // puis index.html en cache si dispo, sinon page offline
        const cache = await caches.open(CACHE);
        const cachedHome = await cache.match(A("index.html"));
        if (cachedHome) return cachedHome;
        const offline = await cache.match(A("offline.html"));
        return offline || new Response("Hors-ligne", { status: 503 });
      }
    })());
    return;
  }

  // 2) Static / runtime assets (JS/CSS/images/fonts/CDN) — cache d'abord
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    if (cached) return cached;

    try {
      const res = await fetch(req);
      // Met en cache même les réponses opaques (CDN)
      if (res && (res.ok || res.type === "opaque")) {
        cache.put(req, res.clone()).catch(()=>{});
      }
      return res;
    } catch {
      // Dernier recours : rien / 504
      return new Response("", { status: 504 });
    }
  })());
});
