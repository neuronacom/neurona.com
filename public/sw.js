self.addEventListener('push', function(event) {
  let data = {};
  if (event.data) data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'NEURONA', {
      body: data.body || '',
      icon: '/27.png',
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  }
});
