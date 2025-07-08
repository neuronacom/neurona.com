self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('fetch', function(event) {});

// Push notification support
self.addEventListener('push', function(event) {
  if (event.data) {
    const options = {
      body: event.data.text(),
      icon: 'https://i.ibb.co/XfKRzvcy/27.png',
      badge: 'https://i.ibb.co/XfKRzvcy/27.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: 1
      },
      actions: [
        {action: 'explore', title: 'Открыть NEURONA',
        icon: 'https://i.ibb.co/XfKRzvcy/27.png'},
        {action: 'close', title: 'Закрыть',
        icon: 'https://i.ibb.co/XfKRzvcy/27.png'}
      ]
    };
    event.waitUntil(
      self.registration.showNotification('NEURONA 1.0', options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  // Default action or 'explore' action - open the app
  event.waitUntil(
    clients.openWindow('/')
  );
});
