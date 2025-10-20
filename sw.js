/* sw.js — EDUFUN WordSearch (complet, versionné)
   - Offline des pages & CSS
   - Cache polices (stale-while-revalidate)
   - Icônes/images (cache-first)
   - Network-first pour HTML (avec fallback)
   - Ignore chrome-extension://
   - clientsClaim + skipWaiting
   => Incrémente CACHE_VERSION à chaque déploiement important
*/
const CACHE_VERSION = 'v5';
const CORE_CACHE = `core-${CACHE_VERSION}`;
const FONT_CACHE = `font-${CACHE_VERSION}`;
const IMG_CACHE  = `img-${CACHE_VERSION}`;
const OTHER_CACHE= `other-${CACHE_VERSION}`;

const ORIGIN = self.location.origin;

// Ressources cœur à pré-cacher (ajuste si tu renomme/ajoutes des fichiers)
const CORE = [
  './',                     // GitHub Pages: redirige vers index
  './index.html',
  './assets/css/app.css',
  './assets/css/noto-ar.css',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/fonts/NotoKufiArabic-Regular.woff2',
  './assets/fonts/NotoKufiArabic-Bold.woff2',
  // Ajoute ici d’autres assets critiques si besoin
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CORE_CACHE).then((cache) => cache.addAll(CORE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Supprime les anciens caches
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => ![CORE_CACHE, FONT_CACHE, IMG_CACHE, OTHER_CACHE].includes(k))
        .map(k => caches.delete(k))
    );
    // Prend le contrôle immédiatement
    await self.clients.claim();
  })());
});

// Petit utilitaire: détermine si la requête est une navigation HTML
function isHTMLRequest(request) {
  return request.mode === 'navigate' ||
         (request.headers.get('accept') || '').includes('text/html');
}

// Runtime caching
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignore les schémas non supportés (ex.: chrome-extension://)
  try {
    const url = new URL(request.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  } catch { return; }

  // HTML → Network-first (avec fallback cache)
  if (isHTMLRequest(request)) {
    event.respondWith((async () => {
      try {
        const res = await fetch(request, { cache: 'no-store' });
        // Cache la réponse fraîche pour offline
        const cache = await caches.open(CORE_CACHE);
        cache.put(request, res.clone());
        return res;
      } catch {
        // Fallback: cache → index.html
        const cache = await caches.open(CORE_CACHE);
        const cached = await cache.match(request);
        return cached || cache.match('./index.html');
      }
    })());
    return;
  }

  // Polices → Stale-While-Revalidate
  if (request.destination === 'font') {
    event.respondWith((async () => {
      const cache = await caches.open(FONT_CACHE);
      const cached = await cache.match(request);
      const fetchPromise = fetch(request).then((res) => {
        // 200 seulement
        if (res && res.status === 200) cache.put(request, res.clone());
        return res;
      }).catch(() => null);
      return cached || fetchPromise || new Response('', { status: 504 });
    })());
    return;
  }

  // Images & icônes → Cache-first
  if (request.destination === 'image' || request.destination === 'icon') {
    event.respondWith((async () => {
      const cache = await caches.open(IMG_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const res = await fetch(request);
        if (res && res.status === 200) cache.put(request, res.clone());
        return res;
      } catch {
        return cached || new Response('', { status: 504 });
      }
    })());
    return;
  }

  // Autres GET même origine → Cache-first puis réseau
  if (request.method === 'GET' && request.url.startsWith(ORIGIN)) {
    event.respondWith((async () => {
      const cache = await caches.open(OTHER_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const res = await fetch(request, { cache: 'no-store' });
        if (res && res.status === 200) cache.put(request, res.clone());
        return res;
      } catch {
        return cached || new Response('', { status: 504 });
      }
    })());
  }
});

// Permettre l’update immédiat depuis la page
self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg && msg.type === 'SKIP_WAITING') self.skipWaiting();
});
