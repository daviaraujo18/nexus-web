import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

if (!admin.apps.length) {
  admin.initializeApp();
}

export const healthCheck = functions
  .region('southamerica-east1')
  .https.onRequest((req, res) => {
    res.set('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, firebase-instance-id-token');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

export const saveUserFCMToken = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    try {
      console.log('🔥 saveUserFCMToken payload:', JSON.stringify(data));

      const uid = context.auth?.uid;
      const { token, deviceInfo } = data ?? {};

      if (!uid) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Usuário não autenticado.'
        );
      }

      if (!token || typeof token !== 'string') {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'token é obrigatório.'
        );
      }

      const db = admin.firestore();
      const now = admin.firestore.Timestamp.now();

      const existing = await db
        .collection('userFCMTokens')
        .where('userId', '==', uid)
        .where('token', '==', token)
        .limit(1)
        .get();

      if (!existing.empty) {
        await existing.docs[0].ref.update({
          active: true,
          updatedAt: now,
          deviceInfo: deviceInfo ?? {},
        });
      } else {
        await db.collection('userFCMTokens').add({
          userId: uid,
          token,
          active: true,
          deviceInfo: deviceInfo ?? {},
          createdAt: now,
          updatedAt: now,
        });
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Erro em saveUserFCMToken:', error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        'internal',
        'Falha ao salvar token.'
      );
    }
  });

export const removeUserFCMToken = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    try {
      console.log('🔥 removeUserFCMToken payload:', JSON.stringify(data));

      const uid = context.auth?.uid;
      const { token } = data ?? {};

      if (!uid) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Usuário não autenticado.'
        );
      }

      if (!token || typeof token !== 'string') {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'token é obrigatório.'
        );
      }

      const db = admin.firestore();
      const now = admin.firestore.Timestamp.now();

      const existing = await db
        .collection('userFCMTokens')
        .where('userId', '==', uid)
        .where('token', '==', token)
        .limit(1)
        .get();

      if (!existing.empty) {
        await existing.docs[0].ref.update({
          active: false,
          updatedAt: now,
        });
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Erro em removeUserFCMToken:', error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        'internal',
        'Falha ao remover token.'
      );
    }
  });

export const sendPushNotification = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    try {
      console.log('🔥 sendPushNotification payload:', JSON.stringify(data));

      const payload = data ?? {};

      const userId =
        typeof payload.userId === 'string' ? payload.userId : null;

      const title =
        typeof payload?.notification?.title === 'string'
          ? payload.notification.title
          : typeof payload?.title === 'string'
            ? payload.title
            : null;

      const body =
        typeof payload?.notification?.body === 'string'
          ? payload.notification.body
          : typeof payload?.body === 'string'
            ? payload.body
            : null;

      const extraData =
        payload?.data && typeof payload.data === 'object' ? payload.data : {};

      if (!userId) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'userId é obrigatório.'
        );
      }

      if (!title || !body) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'title/body são obrigatórios.'
        );
      }

      const db = admin.firestore();

      const tokensSnap = await db
        .collection('userFCMTokens')
        .where('userId', '==', userId)
        .where('active', '==', true)
        .get();

      if (tokensSnap.empty) {
        throw new functions.https.HttpsError(
          'not-found',
          'Nenhum token FCM ativo encontrado para o usuário.'
        );
      }

      const tokens = tokensSnap.docs
        .map((doc) => doc.data()?.token)
        .filter((token): token is string => typeof token === 'string' && token.length > 0);

      if (tokens.length === 0) {
        throw new functions.https.HttpsError(
          'not-found',
          'Nenhum token FCM válido encontrado.'
        );
      }

      const message: admin.messaging.MulticastMessage = {
        tokens,
        notification: {
          title,
          body,
        },
        data: Object.entries(extraData).reduce<Record<string, string>>(
          (acc, [key, value]) => {
            acc[key] = typeof value === 'string' ? value : JSON.stringify(value);
            return acc;
          },
          {}
        ),
        webpush: {
          notification: {
            title,
            body,
            icon: '/icons/icon-192x192.png',
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      return {
        success: true,
        sent: response.successCount,
        failed: response.failureCount,
      };
    } catch (error) {
      console.error('❌ ERRO FINAL sendPushNotification:', error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        'internal',
        'Falha ao enviar push.'
      );
    }
  });