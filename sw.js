const CACHE = 'berlin2026-v7';
const PRECACHE = [
  './',
  './index.html',
  './nase-fotky.html',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Supabase API (REST + Realtime + Auth) — network-only, no cache
  // EXCEPT storage thumbnails which are immutable
  if (url.hostname.endsWith('.supabase.co')) {
    if (url.pathname.startsWith('/storage/v1/object/public/')) {
      // Storage objects — cache-first (immutable URLs)
      e.respondWith(
        caches.match(e.request).then(cached => cached || fetch(e.request).then(r => {
          if (r.ok) {
            const copy = r.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy));
          }
          return r;
        }))
      );
      return;
    }
    // Everything else on supabase.co → network-only
    return; // browser default fetch, no SW intercept
  }

  // Cache-first for static + map tiles + images + Wikipedia thumbs
  if (url.hostname.includes('basemaps.cartocdn.com')
   || url.hostname.includes('picsum.photos')
   || url.hostname.includes('unpkg.com')
   || url.hostname.includes('esm.sh')
   || url.hostname.includes('cdn.jsdelivr.net')
   || url.hostname.includes('upload.wikimedia.org')
   || url.hostname.includes('api.qrserver.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(r => {
        if (r.ok) {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return r;
      }).catch(() => cached))
    );
    return;
  }

  // Network-first for live data APIs
  if (url.hostname.includes('frankfurter.app')
   || url.hostname.includes('open-meteo.com')
   || url.hostname.includes('wikipedia.org')) {
    e.respondWith(
      fetch(e.request).then(r => {
        if (r.ok) {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Same-origin: cache-first with offline fallback
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(r => {
        if (r.ok) {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return r;
      }).catch(() => caches.match('./index.html')))
    );
  }
});
