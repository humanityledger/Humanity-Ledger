/* Ledger Chat Service Worker — P1-B Push Notifications */
/* eslint-disable no-restricted-globals */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', function(event) {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); }
  catch { data = { title: 'Ledger Chat', body: event.data.text() }; }

  const options = {
    body: data.body || 'New message',
    icon: data.icon || '/icon.png',
    badge: '/icon.png',
    tag: data.tag || 'ledger-msg',
    renotify: true,
    requireInteraction: false,
    silent: false,
    data: { url: data.url || '/chat', sender: data.sender || '' },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Ledger Chat', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/chat';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url.includes('/chat') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// Background sync — notify main thread to re-sync
self.addEventListener('sync', function(event) {
  if (event.tag === 'sync-messages') {
    event.waitUntil(
      clients.matchAll().then(all => {
        all.forEach(c => c.postMessage({ type: 'SYNC_REQUESTED' }));
      })
    );
  }
});
