// sw.js — EDUFUN (PWA)
// Scope = racine si enregistré via "./sw.js"

const CACHE = "edufun-v3";

// ✅ Liste des fichiers *utiles* au premier lancement.
// (Si l'un manque/404, on l'ignore pour ne pas casser l’installation)
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./offline.html",
  "./assets/icons/edufun-logo-192.png",
  "./assets/icons/edufun-logo-512.png",
  "./fonts/NotoKufiArabic-Regular.woff2",
  "./fonts/NotoKufiArabic-Bold.woff2",
];

// -------- INSTALL: on met en cache ce qui répond OK (tolérant aux 404) --------
self.addEventListener("install", (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.allSettled(
        ASSETS.map(async (url) => {
          try {
            const res = await fetch(url, { cache: "no-cache" });
            if (res && res.ok) {
              await cache.put(url, res.clone());
            }
          } catch {
            // ignore: si un fichier ne répond pas, on n’échoue pas l’install
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

// -------- ACTIVATE: on nettoie les anciens caches --------
self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// -------- FETCH: cache-first pour assets, fallback offline pour documents --------
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const dest = req.destination || "";

  // Pages / navigations -> fallback vers offline.html si réseau indisponible
  if (req.mode === "navigate" || dest === "document") {
    e.respondWith(
      (async () => {
        try {
          // Réseau d'abord (permet d’avoir la dernière version des pages)
          return await fetch(req);
        } catch {
          // Hors-ligne -> page dédiée
          const offline = await caches.match("./offline.html");
          return (
            offline ||
            new Response("Vous êtes hors-ligne.", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
        }
      })()
    );
    return;
  }

  // Assets (images, styles, scripts, polices, manifest) -> cache-first
  if (
    dest === "image" ||
    dest === "style" ||
    dest === "script" ||
    dest === "font" ||
    dest === "manifest"
  ) {
    e.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;

        try {
          const res = await fetch(req);
          // On ne met en cache que les réponses OK
          if (res && res.ok) {
            const cache = await caches.open(CACHE);
            cache.put(req, res.clone()).catch(() => {});
          }
          return res;
        } catch {
          // Pas de réseau et pas en cache -> rien à faire pour un asset
          return new Response("", { status: 504 });
        }
      })()
    );
    return;
  }

  // Autres (XHR, etc.) -> réseau puis (optionnel) cache si OK
  e.respondWith(
    (async () => {
      try {
        const res = await fetch(req);
        return res;
      } catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        // En dernier recours, si c’était une navigation “déguisée”, fallback offline
        if (req.headers.get("accept")?.includes("text/html")) {
          const offline = await caches.match("./offline.html");
          if (offline) return offline;
        }
        return new Response("", { status: 504 });
      }
    })()
  );
});
