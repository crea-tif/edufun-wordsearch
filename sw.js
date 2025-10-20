// sw.js — PWA EDUFUN
const CACHE_VERSION = 'v1.0.0';
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

self.addEventListener('install', (event) => {
  // On active directement la nouvelle version
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Nettoyage des anciens caches
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k !== RUNTIME_CACHE)
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // On ne gère que les requêtes GET
  if (req.method !== 'GET') return;

  // Politique Network-first pour documents HTML (meilleure mise à jour)
  if (req.destination === 'document' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        // Mettre à jour le cache en arrière-plan
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(req, { ignoreSearch: true });
        if (cached) return cached;
        // secours : essayer l'index
        return cache.match('./');
      }
    })());
    return;
  }

  // Cache-first pour le reste (CSS, JS, images, polices…)
  event.respondWith((async () => {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      // on ne met en cache que les réponses valides
      if (fresh && fresh.status === 200 && fresh.type !== 'opaque') {
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (e) {
      // offline sans cache => laisse échouer
      return new Response('', { status: 504, statusText: 'offline' });
    }
  })());
});
