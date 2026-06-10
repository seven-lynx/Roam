// Service worker for push notifications
// Registered by the NotificationBell component when user enables push.

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const { title, body, icon, badge, data } = payload;

    event.waitUntil(
      self.registration.showNotification(title || 'Roam', {
        body: body || '',
        icon: icon || '/icon-512.png',
        badge: badge || '/icon-512.png',
        data: data || {},
        requireInteraction: false,
        tag: 'roam-notification',
      })
    );
  } catch {
    // If payload isn't valid JSON, show a fallback
    event.waitUntil(
      self.registration.showNotification('Roam', {
        body: event.data.text(),
        icon: '/icon-512.png',
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url
    ? new URL(event.notification.data.url)
    : new URL('/', self.location.origin);

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.focus();
          return client.navigate(urlToOpen.pathname + urlToOpen.search);
        }
      }
      // Otherwise open a new window
      return clients.openWindow(urlToOpen.href);
    })
  );
});