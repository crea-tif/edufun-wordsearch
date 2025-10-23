// sw.js — EDUFUN (PWA)
const CACHE = "edufun-v3";

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

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(
      ASSETS.map(async (url) => {
        try {
          const res = await fetch(url, { cache: "no-cache" });
          if (res && res.ok) await cache.put(url, res.clone());
        } catch {}
      })
    );
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
  const dest = req.destination || "";
  const url = req.url || "";

  // 👇 Ignore anything that isn't http(s) (e.g., chrome-extension://)
  if (!/^https?:\/\//i.test(url)) return;

  // Pages / navigations -> network first, fallback offline
  if (req.mode === "navigate" || dest === "document") {
    e.respondWith((async () => {
      try { return await fetch(req); }
      catch {
        return (await caches.match("./offline.html")) ||
          new Response("Vous êtes hors-ligne.", {
            status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
      }
    })());
    return;
  }

  // Static assets -> cache first
  if (["image","style","script","font","manifest"].includes(dest)) {
    e.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && res.ok) (await caches.open(CACHE)).put(req, res.clone()).catch(()=>{});
        return res;
      } catch {
        return new Response("", { status: 504 });
      }
    })());
    return;
  }

  // Other requests -> network, fallback cache / offline for HTML-ish
  e.respondWith((async () => {
    try { return await fetch(req); }
    catch {
      const cached = await caches.match(req);
      if (cached) return cached;
      if (req.headers.get("accept")?.includes("text/html")) {
        const offline = await caches.match("./offline.html");
        if (offline) return offline;
      }
      return new Response("", { status: 504 });
    }
  })());
});
