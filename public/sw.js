self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { self.clients.claim(); });
self.addEventListener('fetch', function(event) {});

// Push notification handling
self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: 'https://i.ibb.co/XfKRzvcy/27.png',
      badge: 'https://i.ibb.co/XfKRzvcy/27.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: data.primaryKey || '1',
        url: data.url || '/'
      },
      actions: [
        {
          action: 'explore',
          title: 'Открыть',
          icon: 'https://i.ibb.co/XfKRzvcy/27.png'
        },
        {
          action: 'close',
          title: 'Закрыть'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'NEURONA', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url || '/')
    );
  } else if (event.action === 'close') {
    // Just close the notification
    return;
  } else {
    // Default click behavior
    event.waitUntil(
      clients.openWindow(event.notification.data.url || '/')
    );
  }
});
