// sw.js — EDUFUN
const CACHE = "edufun-v3";

const ASSETS = [
  "./",
  "./index.html",
  "./offline.html",
  "./manifest.webmanifest",
  "./sw.js",

  // Icônes
  "./assets/icons/edufun-logo-192.png",
  "./assets/icons/edufun-logo-512.png",

  // Polices locales
  "./fonts/NotoKufiArabic-Regular.woff2",
  "./fonts/NotoKufiArabic-Bold.woff2",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS))
  );
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

  // Documents/Images/CSS/JS/Fonts/Manifest → cache-first
  const isAsset =
    req.method === "GET" &&
    ["document", "image", "style", "script", "font", "manifest"].includes(req.destination || "");

  if (isAsset) {
    e.respondWith(
      caches.match(req).then((res) => res || fetch(req).then((net) => {
        // mise à jour du cache en arrière-plan
        const copy = net.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return net;
      }).catch(() => {
        // Fallback navigation → offline.html
        if (req.mode === "navigate") {
          return caches.match("./offline.html");
        }
        return caches.match(req);
      }))
    );
    return;
  }

  // Toute autre requête : tentative réseau, puis fallback navigation
  e.respondWith(
    fetch(req).catch(() => {
      if (req.mode === "navigate") return caches.match("./offline.html");
      return caches.match(req);
    })
  );
});
