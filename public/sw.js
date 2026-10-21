// Service Worker: App Shell caching only. Never cache /api or cryptographic keys.
const CACHE_NAME = 'hl-v1';
const ASSETS = ['/', '/favicon.ico', '/manifest.json', '/worldmap.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('/api/')) return;
  e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request)));
});
