// sw.js — scope = racine si enregistré via "./sw.js"
const CACHE = "edufun-v2";  // <— incrémente quand tu modifies les assets
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  // Fonts
  "./fonts/NotoKufiArabic-Regular.woff2",
  "./fonts/NotoKufiArabic-Bold.woff2",
  // Icons
  "./assets/icons/edufun-logo-192.png",
  "./assets/icons/edufun-logo-512.png",
  // Offline page
  "./offline.html"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;

  // 1) Fallback OFFLINE pour les navigations (URL tapées/clicks internes)
  if (req.mode === "navigate") {
    e.respondWith(
      (async () => {
        try {
          // Essaye réseau d'abord (meilleures mises à jour)
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (err) {
          // Réseau KO → essaye cache → sinon offline.html
          const cached = await caches.match(req);
          return cached || caches.match("./offline.html");
        }
      })()
    );
    return;
  }

  // 2) Cache-first pour les assets statiques (icônes, fonts, images…)
  if (
    req.method === "GET" &&
    (req.destination === "image" || req.destination === "style" ||
     req.destination === "script" || req.destination === "font" ||
     req.destination === "manifest" || req.destination === "document")
  ) {
    e.respondWith(
      caches.match(req).then(r => r || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }))
    );
  }
});
