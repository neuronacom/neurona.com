// neurona-chat.js - Push notifications functionality

let pushSubscription = null;
let isNotificationSupported = false;

// Check if push notifications are supported
if ('serviceWorker' in navigator && 'PushManager' in window) {
  isNotificationSupported = true;
}

// Show notification popup
function showNotificationPopup(text) {
  const popup = document.getElementById('notifPopup');
  const popupText = document.getElementById('notifPopupText');
  
  if (popup && popupText) {
    popupText.textContent = text;
    popup.classList.add('show');
    
    // Hide after 3 seconds
    setTimeout(() => {
      popup.classList.remove('show');
    }, 3000);
  }
}

// Request push notification permission and subscribe
async function requestNotificationPermission() {
  if (!isNotificationSupported) {
    console.log('Push notifications are not supported');
    return false;
  }

  try {
    // Request permission
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;
      
      // Subscribe to push notifications
      const vapidKey = await getVapidPublicKey();
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(vapidKey)
      });
      
      pushSubscription = subscription;
      
      // Send subscription to server
      await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subscription: subscription,
          timestamp: Date.now()
        })
      });
      
      return true;
    } else {
      console.log('Permission denied for notifications');
      return false;
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
}

// Unsubscribe from push notifications
async function unsubscribeFromNotifications() {
  if (pushSubscription) {
    try {
      await pushSubscription.unsubscribe();
      
      // Notify server about unsubscription
      await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          endpoint: pushSubscription.endpoint
        })
      });
      
      pushSubscription = null;
      return true;
    } catch (error) {
      console.error('Error unsubscribing from notifications:', error);
      return false;
    }
  }
  return true;
}

// Convert VAPID key
function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Get VAPID public key from server
async function getVapidPublicKey() {
  try {
    const response = await fetch('/api/vapid-public-key');
    const data = await response.json();
    return data.publicKey;
  } catch (error) {
    console.error('Error fetching VAPID public key:', error);
    // Fallback key
    return 'BF7iT1U1U4mSjDrmFDXfEYO54D3HSgMEfsJJuQIxEywOK9kZf7WmXNuN4WYK4_LpBUfqT5HO78Ljxla7tWgyZWI';
  }
}

// Initialize push notifications when settings are saved
async function initializePushNotifications(enabled) {
  if (!isNotificationSupported) {
    return;
  }

  if (enabled) {
    // Request permission and subscribe
    const success = await requestNotificationPermission();
    if (success) {
      showNotificationPopup('Уведомления успешно включены!');
    } else {
      // If permission failed, update the setting back to false
      settingsBuffer.notif = false;
      setNotif(false);
      showNotificationPopup('Ошибка включения уведомлений');
    }
  } else {
    // Unsubscribe from notifications
    await unsubscribeFromNotifications();
  }
}

// Export functions for global use
window.initializePushNotifications = initializePushNotifications;
window.showNotificationPopup = showNotificationPopup;