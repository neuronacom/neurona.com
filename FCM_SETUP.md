# Firebase Cloud Messaging (FCM) Push Notifications Setup

## Overview
This application supports push notifications for:
- New crypto news from CryptoPanic
- Price changes for top cryptocurrencies (BTC, ETH, TON, SOL, BNB) 
- Important crypto events

## Setup Instructions

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing one
3. Enable Firebase Cloud Messaging (FCM)

### 2. Generate Service Account Key
1. Go to Project Settings > Service Accounts
2. Click "Generate new private key"
3. Save the JSON file securely

### 3. Get Web Push Certificates
1. Go to Project Settings > Cloud Messaging
2. In "Web Push certificates", click "Generate key pair"
3. Copy the key pair (this is your VAPID key)

### 4. Configure Client-Side Firebase
Edit `public/index.html` and replace the Firebase config:

```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

Also update `public/sw.js` with the same configuration.

### 5. Configure Server-Side Firebase
Set environment variables:

```bash
# Convert service account JSON to single line and set as environment variable
export FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"your-project-id",...}'

# Set VAPID key
export VAPID_KEY="your-vapid-key-from-step-3"
```

### 6. For Heroku Deployment
```bash
heroku config:set FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"your-project-id",...}'
heroku config:set VAPID_KEY="your-vapid-key"
```

## Features

### News Monitoring
- Checks for new crypto news every 5 minutes
- Sends notifications when fresh news is available
- Filters news to last 24 hours

### Price Monitoring  
- Monitors BTC, ETH, TON, SOL, BNB prices every 2 minutes
- Sends notifications for significant price changes (>5%)
- Uses Binance API for real-time price data

### User Notifications
- Automatic permission request when notifications are enabled
- Foreground and background message handling
- Notification click handling to open app

## API Endpoints

### `POST /api/fcm-token`
Register FCM token for push notifications
```json
{
  "token": "fcm-token-string"
}
```

### `GET /api/vapid-key`
Get VAPID key for FCM token generation
```json
{
  "vapidKey": "your-vapid-key"
}
```

### `POST /api/send-notification`
Send test notification (for debugging)
```json
{
  "title": "Test Title",
  "body": "Test message",
  "data": {}
}
```

## Testing

1. Enable notifications in the app settings
2. Check browser console for FCM token registration
3. Use `/api/send-notification` endpoint to test push delivery
4. Monitor server logs for price/news monitoring activity

## Security Notes

- Never commit Firebase service account keys to version control
- Use environment variables for all sensitive configuration
- Rotate VAPID keys periodically
- Monitor FCM token usage and clean up invalid tokens

## Troubleshooting

### Firebase not initialized
- Check `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable
- Verify JSON format is valid
- Ensure project ID matches Firebase project

### No notifications received
- Check notification permissions in browser
- Verify FCM token registration in server logs
- Test with `/api/send-notification` endpoint
- Check service worker registration

### Price monitoring not working
- Verify Binance API connectivity
- Check server logs for price monitoring errors
- Ensure price change threshold is appropriate (currently 5%)