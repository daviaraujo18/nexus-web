import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';

if (!admin.apps.length) {
  admin.initializeApp();
}

export const sendPushNotification = onRequest(
  { region: 'southamerica-east1', cors: true },
  async (req, res) => {
    console.log('🔥 sendPushNotification executada');

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Método não permitido' });
      return;
    }

    console.log('📦 BODY:', req.body);

    res.status(200).json({
      success: true,
      message: 'Função HTTP executada!'
    });
  }
);
