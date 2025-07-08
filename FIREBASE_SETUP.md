# Firebase Configuration for Push Notifications

To enable push notifications in production, set the following environment variables:

```bash
# Firebase service account key (JSON string)
FIREBASE_SERVICE_ACCOUNT_KEY='{
  "type": "service_account",
  "project_id": "neurona-push",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-...@neurona-push.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-...%40neurona-push.iam.gserviceaccount.com"
}'

# Firebase project ID
FIREBASE_PROJECT_ID=neurona-push
```

## FCM Web Configuration

The client-side Firebase configuration is already set up in the HTML file. In production, you should:

1. Create a Firebase project
2. Enable Firebase Cloud Messaging
3. Generate a service account key
4. Update the web app configuration with your actual values
5. Set the environment variables on Heroku

## Testing Push Notifications

Once configured, the system will automatically send notifications for:
- New crypto news (throttled to every 30 minutes)
- Significant Bitcoin price changes > 5% (throttled to every 30 minutes)
- You can also manually trigger notifications using the `/api/send-notification` endpoint

## Notification Features

- Uses the app icon (https://i.ibb.co/XfKRzvcy/27.png)
- Supports click actions to open the app
- Handles registration token management
- Automatic cleanup of invalid tokens