self.addEventListener('push', function(event) {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); } catch { data = { title: 'Ledger Chat', body: event.data.text() }; }
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Ledger Chat', {
      body: data.body || 'New message',
      icon: data.icon || '/icon.png',
      badge: data.badge || '/icon.png',
      tag: 'ledger-chat-msg',
      renotify: true,
      data: { url: data.url || '/terminal' }
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url.includes('/terminal') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow('/terminal');
    })
  );
});
