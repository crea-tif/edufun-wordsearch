// sw.js — scope = racine si tu l’enregistres via "./sw.js"
const CACHE = "edufun-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./actifs/icons/edufun-logo-192.png",
  "./actifs/icons/edufun-logo-512.png"
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
  // Cache-first pour assets statiques
  if (req.method === "GET" && (req.destination === "document" || req.destination === "image" || req.destination === "style" || req.destination === "script" || req.destination === "manifest")) {
    e.respondWith(
      caches.match(req).then(r => r || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }))
    );
  }
});
