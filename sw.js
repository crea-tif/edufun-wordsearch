/* SW — merged PWA */
const CACHE_VERSION='v8.0.0';
const CORE_CACHE=`edufun-core-${CACHE_VERSION}`;
const CORE_ASSETS=[
  './index.html','./manifest.webmanifest',
  './assets/css/noto-ar.css','./assets/css/app.css',
  './assets/js/app.js',
  './assets/icons/icon-192.png','./assets/icons/icon-512.png'
];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CORE_CACHE).then(c=>c.addAll(CORE_ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('edufun-core-')&&k!==CORE_CACHE).map(k=>caches.delete(k))))
  .then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const req=e.request, url=new URL(req.url);
  if(url.origin!==self.location.origin) return;
  if(req.destination==='font'||url.pathname.includes('/assets/fonts/')){
    e.respondWith(caches.open('edufun-fonts').then(cache=>cache.match(req).then(r=>r||fetch(req).then(n=>{if(n.ok) cache.put(req,n.clone()); return n;}))));
    return;
  }
  e.respondWith((async()=>{
    const cache=await caches.open(CORE_CACHE);
    const cached=await cache.match(req);
    const network=fetch(req).then(r=>{ if(r&&r.ok) cache.put(req,r.clone()); return r; }).catch(()=>cached);
    return cached||network;
  })());
});
