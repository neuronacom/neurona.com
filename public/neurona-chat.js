// neurona-chat.js - Push notifications functionality

let pushSubscription = null;
let isNotificationSupported = false;
let notificationPermissionGranted = false;

// Check if push notifications are supported
if ('serviceWorker' in navigator && 'PushManager' in window) {
  isNotificationSupported = true;
  
  // Check current permission status
  if (Notification.permission === 'granted') {
    notificationPermissionGranted = true;
  }
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

// Check if user already has existing subscription
async function checkExistingSubscription() {
  if (!isNotificationSupported) {
    return false;
  }
  
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      pushSubscription = subscription;
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error checking existing subscription:', error);
    return false;
  }
}

// Request push notification permission and subscribe
async function requestNotificationPermission() {
  if (!isNotificationSupported) {
    console.log('Push notifications are not supported');
    showNotificationPopup('Уведомления не поддерживаются');
    return false;
  }

  try {
    // Check for existing subscription first
    const hasExisting = await checkExistingSubscription();
    if (hasExisting) {
      console.log('User already has an active subscription');
      return true;
    }

    // Request permission
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      notificationPermissionGranted = true;
      
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
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subscription: subscription,
          timestamp: Date.now()
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to register subscription on server');
      }
      
      console.log('Successfully subscribed to push notifications');
      return true;
    } else if (permission === 'denied') {
      console.log('Permission denied for notifications');
      showNotificationPopup('Разрешение на уведомления отклонено');
      return false;
    } else {
      console.log('Permission not granted for notifications');
      showNotificationPopup('Разрешение на уведомления не предоставлено');
      return false;
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    showNotificationPopup('Ошибка при запросе разрешения');
    return false;
  }
}

// Unsubscribe from push notifications
async function unsubscribeFromNotifications() {
  if (pushSubscription) {
    try {
      await pushSubscription.unsubscribe();
      
      // Notify server about unsubscription
      const response = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          endpoint: pushSubscription.endpoint
        })
      });
      
      if (!response.ok) {
        console.warn('Failed to notify server about unsubscription');
      }
      
      pushSubscription = null;
      notificationPermissionGranted = false;
      console.log('Successfully unsubscribed from push notifications');
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
    if (enabled) {
      showNotificationPopup('Уведомления не поддерживаются');
    }
    return;
  }

  if (enabled) {
    // Request permission and subscribe
    const success = await requestNotificationPermission();
    if (success) {
      showNotificationPopup('Уведомления успешно включены!');
    } else {
      // If permission failed, update the setting back to false
      if (typeof settingsBuffer !== 'undefined') {
        settingsBuffer.notif = false;
        if (typeof setNotif === 'function') {
          setNotif(false);
        }
      }
    }
  } else {
    // Unsubscribe from notifications
    const success = await unsubscribeFromNotifications();
    if (success) {
      showNotificationPopup('Уведомления отключены');
    }
  }
}

// Initialize on page load if notifications are already enabled
document.addEventListener('DOMContentLoaded', async function() {
  // Check if notifications are already enabled in localStorage
  const notifEnabled = localStorage.getItem('neurona_notif') === 'on';
  
  if (notifEnabled && isNotificationSupported) {
    // Check if we have permission and subscription
    const hasExisting = await checkExistingSubscription();
    
    if (Notification.permission === 'granted' && hasExisting) {
      notificationPermissionGranted = true;
      console.log('Notifications already enabled and subscription active');
    } else if (Notification.permission === 'granted' && !hasExisting) {
      // Re-subscribe if permission is granted but no subscription exists
      console.log('Re-subscribing to notifications...');
      await requestNotificationPermission();
    }
  }
});

// Export functions for global use
window.initializePushNotifications = initializePushNotifications;
window.showNotificationPopup = showNotificationPopup;
window.checkExistingSubscription = checkExistingSubscription;