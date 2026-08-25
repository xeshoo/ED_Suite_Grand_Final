const CACHE_NAME = 'ed-suite-v9';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './shared/docx-lite.js',
  './shared/clinical-calc.js',
  './shared/autosave.js',
  './modules/ecg/index.html',
  './modules/icu/index.html',
  './modules/airway/index.html',
 './modules/consult/index.html',
  './modules/diabetes/index.html'
  // NOTE: once you vendor JSZip locally (see docx-lite.js), add
  // './shared/jszip.min.js' here too. Don't add it before the file
  // actually exists in /shared/ — cache.addAll() below is atomic,
  // so ANY missing asset in this list fails the entire SW install
  // and every module loses offline caching, not just the missing one.
];

// Install: cache all assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for local assets, network-first for external resources
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const isExternal = url.origin !== self.location.origin;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (!response || response.status !== 200) return response;
        // Cache external resources (fonts, CDN libs) for offline use
        if (isExternal && (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com') || url.hostname.includes('cdnjs.cloudflare.com'))) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      });
    }).catch(() => {
      // For navigation requests, serve the cached hub page
      if (e.request.mode === 'navigate') return caches.match('./index.html');
      return caches.match(e.request);
    })
  );
});
