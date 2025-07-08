self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('fetch', function(event) {});

// Handle push notifications
self.addEventListener('push', function(event) {
  console.log('Push notification received:', event);
  
  if (!event.data) {
    return;
  }
  
  const data = event.data.json();
  const options = {
    body: data.body || 'Новое уведомление от NEURONA',
    icon: 'https://i.ibb.co/XfKRzvcy/27.png',
    badge: 'https://i.ibb.co/XfKRzvcy/27.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: data.primaryKey || 'neurona',
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
});

// Handle notification clicks
self.addEventListener('notificationclick', function(event) {
  console.log('Notification clicked:', event);
  
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  // Default action or 'explore' action
  const urlToOpen = event.notification.data.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Check if there's already a window/tab open with the target URL
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If no window/tab is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
