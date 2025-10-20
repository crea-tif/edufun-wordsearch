/* sw.js — EDUFUN WordSearch (v6, propre et robuste)
   - Precache minimal (évite 404)
   - Runtime caching: HTML (network-first), fonts (SWR), images (cache-first)
   - Ignore les schémas non-http(s) (chrome-extension:// etc.)
   - Versionne les caches; clean des anciens
*/
const CACHE_VERSION = 'v6';
const CORE_CACHE  = `core-${CACHE_VERSION}`;
const FONT_CACHE  = `font-${CACHE_VERSION}`;
const IMG_CACHE   = `img-${CACHE_VERSION}`;
const OTHER_CACHE = `other-${CACHE_VERSION}`;

// ⚠️ Garde seulement des chemins qui existent vraiment
const CORE = [
  './',
  './index.html',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './fonts/NotoKufiArabic-Regular.woff2',
  './fonts/NotoKufiArabic-Bold.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CORE_CACHE);
    // addAll échoue si un seul 404 => on boucle pour être tolérant
    for (const url of CORE) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res && res.ok) await cache.put(url, res.clone());
      } catch (e) {
        // on ignore les ratés pour ne pas casser l'installation
        // console.warn('Precache skip:', url, e);
      }
    }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => ![CORE_CACHE, FONT_CACHE, IMG_CACHE, OTHER_CACHE].includes(k))
        .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

function isHTMLRequest(request) {
  return request.mode === 'navigate' ||
         (request.headers.get('accept') || '').includes('text/html');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignore tout ce qui n'est pas http/https (ex.: chrome-extension://)
  let url;
  try { url = new URL(request.url); } catch { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // HTML → Network-first + fallback cache
  if (isHTMLRequest(request)) {
    event.respondWith((async () => {
      try {
        const res = await fetch(request, { cache: 'no-store' });
        const cache = await caches.open(CORE_CACHE);
        cache.put(request, res.clone());
        return res;
      } catch {
        const cache = await caches.open(CORE_CACHE);
        return (await cache.match(request)) || cache.match('./index.html');
      }
    })());
    return;
  }

  // Fonts → Stale-While-Revalidate
  if (request.destination === 'font') {
    event.respondWith((async () => {
      const cache = await caches.open(FONT_CACHE);
      const cached = await cache.match(request);
      const fetching = fetch(request).then(res => {
        if (res && res.ok) cache.put(request, res.clone());
        return res;
      }).catch(() => null);
      return cached || fetching || new Response('', { status: 504 });
    })());
    return;
  }

  // Images / icônes → Cache-first
  if (request.destination === 'image' || request.destination === 'icon') {
    event.respondWith((async () => {
      const cache = await caches.open(IMG_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const res = await fetch(request);
        if (res && res.ok) cache.put(request, res.clone());
        return res;
      } catch {
        return cached || new Response('', { status: 504 });
      }
    })());
    return;
  }

  // Autres GET du même origin → Cache-first
  if (request.method === 'GET' && url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(OTHER_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const res = await fetch(request, { cache: 'no-store' });
        if (res && res.ok) cache.put(request, res.clone());
        return res;
      } catch {
        return cached || new Response('', { status: 504 });
      }
    })());
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
