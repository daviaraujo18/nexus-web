import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

if (!admin.apps.length) {
  admin.initializeApp();
}

type TokenDoc = {
  docId: string;
  token: string;
  updatedAtMillis: number;
};

export const sendPushNotification = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    try {
      console.log('🔥 sendPushNotification payload:', JSON.stringify(data));

      const payload = data ?? {};

      const userId =
        typeof payload.userId === 'string' ? payload.userId : null;

      const title =
        typeof payload.title === 'string'
          ? payload.title
          : typeof payload?.notification?.title === 'string'
            ? payload.notification.title
            : null;

      const body =
        typeof payload.body === 'string'
          ? payload.body
          : typeof payload?.notification?.body === 'string'
            ? payload.notification.body
            : null;

      const extraData =
        payload?.data && typeof payload.data === 'object'
          ? payload.data
          : {};

      if (!userId) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'userId é obrigatório.'
        );
      }

      if (!title || !body) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'title e body são obrigatórios.'
        );
      }

      const db = admin.firestore();

      const tokensSnap = await db
        .collection('userFCMTokens')
        .where('userId', '==', userId)
        .where('active', '==', true)
        .get();

      console.log('🔥 DOCS DE TOKEN:', tokensSnap.size);

      if (tokensSnap.empty) {
        throw new functions.https.HttpsError(
          'not-found',
          'Nenhum token FCM ativo encontrado para o usuário.'
        );
      }

      const rawTokenDocs: TokenDoc[] = tokensSnap.docs
        .map((docSnap) => {
          const data = docSnap.data();
          const token = data?.token;
          const updatedAt = data?.updatedAt;
          const createdAt = data?.createdAt;

          const updatedAtMillis =
            updatedAt && typeof updatedAt.toMillis === 'function'
              ? updatedAt.toMillis()
              : createdAt && typeof createdAt.toMillis === 'function'
                ? createdAt.toMillis()
                : 0;

          return {
            docId: docSnap.id,
            token,
            updatedAtMillis,
          };
        })
        .filter((item): item is TokenDoc => typeof item.token === 'string' && item.token.length > 0);

      if (rawTokenDocs.length === 0) {
        throw new functions.https.HttpsError(
          'not-found',
          'Nenhum token FCM válido encontrado.'
        );
      }

      rawTokenDocs.sort((a, b) => b.updatedAtMillis - a.updatedAtMillis);

      const uniqueTokenDocs: TokenDoc[] = [];
      const duplicateDocIdsToDisable: string[] = [];
      const seenTokens = new Set<string>();

      for (const item of rawTokenDocs) {
        if (seenTokens.has(item.token)) {
          duplicateDocIdsToDisable.push(item.docId);
          continue;
        }

        seenTokens.add(item.token);
        uniqueTokenDocs.push(item);
      }

      if (duplicateDocIdsToDisable.length > 0) {
        await Promise.all(
          duplicateDocIdsToDisable.map((docId) =>
            db.collection('userFCMTokens').doc(docId).update({
              active: false,
              invalidatedAt: admin.firestore.Timestamp.now(),
              lastErrorCode: 'duplicate-token-doc',
              lastErrorMessage: 'Documento duplicado do mesmo token foi desativado.',
            })
          )
        );
      }

      const tokens = uniqueTokenDocs.map((item) => item.token);

      const message: admin.messaging.MulticastMessage = {
        tokens,
        notification: {
          title,
          body,
        },
        data: Object.entries(extraData).reduce<Record<string, string>>(
          (acc, [key, value]) => {
            acc[key] =
              typeof value === 'string' ? value : JSON.stringify(value);
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

      const failures = response.responses
        .map((r, index) => ({
          success: r.success,
          errorCode: r.error?.code ?? null,
          errorMessage: r.error?.message ?? null,
          token: tokens[index] ?? null,
          docId: uniqueTokenDocs[index]?.docId ?? null,
        }))
        .filter((item) => !item.success);

      console.log('🔥 RESULTADO FCM:', {
        successCount: response.successCount,
        failureCount: response.failureCount,
        failures,
      });

      for (const failure of failures) {
        if (
          failure.docId &&
          (
            failure.errorCode === 'messaging/registration-token-not-registered' ||
            failure.errorCode === 'messaging/invalid-registration-token'
          )
        ) {
          await db.collection('userFCMTokens').doc(failure.docId).update({
            active: false,
            invalidatedAt: admin.firestore.Timestamp.now(),
            lastErrorCode: failure.errorCode,
            lastErrorMessage: failure.errorMessage,
          });
        }
      }

      return {
        success: true,
        sent: response.successCount,
        failed: response.failureCount,
        failures,
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