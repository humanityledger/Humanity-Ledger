// Self-unregister immediately on localhost/127.0.0.1 to avoid chunk poisoning in dev
if (typeof self !== 'undefined' && (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1')) {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => self.registration.unregister())
    );
  });
}

// public/sw.js — the one service worker for Humanity Ledger (scope "/").
//
// Before: two different workers (sw.js and ledger-sw.js) were registered on
// the same scope, so whichever registered last replaced the other. The push
// worker also pre-cached four files that do not exist, so its install always
// failed and push notifications could never show. And the cache-first fetch
// handler served an old "/" after every deploy, pointing at chunks that no
// longer existed (the ChunkLoadError the page has a recovery script for).
//
// Now: one worker; pages are network-first (fresh HTML after a deploy,
// cached shell only when offline); hashed build assets are cache-first; the
// API and anything that is not a same-origin GET is never touched.

const VERSION = 'hl-2026-10-27';
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;
const SHELL = ['/', '/manifest.json', '/favicon.ico', '/icon-192.png', '/icon-512.png'];
const ICON = '/icon-192.png';
const BADGE = '/favicon-32x32.png';

self.addEventListener('install', (event) => {
  // One missing file must never fail the install, so add them one by one.
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      Promise.all(SHELL.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => {}))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/_next/webpack-hmr') || url.pathname.includes('hot-update')) return;

  // Hashed, immutable build output: cache-first.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone()).catch(() => {});
        return res;
      }),
    );
    return;
  }

  // Pages: always ask the network first; fall back to the cached shell offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match(req)) || (await caches.match('/')) || Response.error()),
    );
  }
  // Everything else goes straight to the network (browser cache rules apply).
});

// ── Push notifications ──────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { body: event.data.text() }; }

  // Privacy-first: a payload can ask for the content to stay hidden.
  const title = data.hideContent ? 'New message' : data.title || 'Ledger Chat';
  const body = data.hideContent ? 'You have a new encrypted message.' : data.body || 'Open Ledger Chat to read it.';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: ICON,
      badge: BADGE,
      vibrate: [200, 100, 200],
      data: { url: data.url || '/chat', peerAddress: data.peerAddress },
      tag: data.peerAddress || 'ledger-notification',
      renotify: true,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = new URL(data.url || '/chat', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NAVIGATE_CHAT', peerAddress: data.peerAddress });
          return client.focus();
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
    }),
  );
});

// ── Background sync: ask an open tab to flush the offline outbox ─────────────
self.addEventListener('sync', (event) => {
  if (event.tag !== 'sync-messages') return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      clients.forEach((client) => client.postMessage({ type: 'FLUSH_OUTBOX' }));
    }),
  );
});
