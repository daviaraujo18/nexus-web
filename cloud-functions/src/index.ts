import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

if (!admin.apps.length) {
  admin.initializeApp();
}

export { saveUserFCMToken } from './notifications/saveUserFCMToken';
export { removeUserFCMToken } from './notifications/removeUserFCMToken';
export { sendPushNotification } from './notifications/sendPushNotification';
export { getUserNotificationPreferences } from './notifications/getUserNotificationPreferences';
export { saveUserNotificationPreferences } from './notifications/saveUserNotificationPreferences';

export const healthCheck = functions
  .region('southamerica-east1')
  .https.onRequest((req, res) => {
    res.set('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, firebase-instance-id-token'
    );

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });