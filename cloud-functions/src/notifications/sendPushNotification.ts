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

type RawPayload = {
  userId?: unknown;
  title?: unknown;
  body?: unknown;
  notification?: {
    title?: unknown;
    body?: unknown;
  };
  data?: Record<string, unknown>;
};

function toStringMap(data: Record<string, unknown>): Record<string, string> {
  return Object.entries(data).reduce<Record<string, string>>((acc, [key, value]) => {
    if (value === undefined || value === null) {
      return acc;
    }

    acc[key] = typeof value === 'string' ? value : JSON.stringify(value);
    return acc;
  }, {});
}

export const sendPushNotification = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    try {
      console.log('🔥 sendPushNotification payload:', JSON.stringify(data));

      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Usuário não autenticado.'
        );
      }

      const payload = (data ?? {}) as RawPayload;

      const userId =
        typeof payload.userId === 'string' ? payload.userId : null;

      const title =
        typeof payload.title === 'string'
          ? payload.title
          : typeof payload.notification?.title === 'string'
            ? payload.notification.title
            : null;

      const body =
        typeof payload.body === 'string'
          ? payload.body
          : typeof payload.notification?.body === 'string'
            ? payload.notification.body
            : null;

      const rawExtraData =
        payload.data && typeof payload.data === 'object'
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
          const docData = docSnap.data();
          const token = docData?.token;
          const updatedAt = docData?.updatedAt;
          const createdAt = docData?.createdAt;

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
        .filter(
          (item): item is TokenDoc =>
            typeof item.token === 'string' && item.token.length > 0
        );

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
        console.log('🧹 Desativando duplicados:', duplicateDocIdsToDisable);

        await Promise.all(
          duplicateDocIdsToDisable.map((docId) =>
            db.collection('userFCMTokens').doc(docId).update({
              active: false,
              invalidatedAt: admin.firestore.Timestamp.now(),
              lastErrorCode: 'duplicate-token-doc',
              lastErrorMessage:
                'Documento duplicado do mesmo token foi desativado.',
            })
          )
        );
      }

      const tokens = uniqueTokenDocs.map((item) => item.token);

      console.log('🔥 TOKENS VÁLIDOS PARA ENVIO:', tokens.length);

      const route =
        typeof rawExtraData.route === 'string'
          ? rawExtraData.route
          : typeof rawExtraData.url === 'string'
            ? rawExtraData.url
            : typeof rawExtraData.clickAction === 'string'
              ? rawExtraData.clickAction
              : '/student/notifications';

      const normalizedExtraData: Record<string, unknown> = {
        ...rawExtraData,
        route,
        url:
          typeof rawExtraData.url === 'string'
            ? rawExtraData.url
            : route,
        clickAction:
          typeof rawExtraData.clickAction === 'string'
            ? rawExtraData.clickAction
            : route,
        type:
          typeof rawExtraData.type === 'string'
            ? rawExtraData.type
            : 'general',
        tag:
          typeof rawExtraData.tag === 'string'
            ? rawExtraData.tag
            : 'nexus-notification',
      };

      const stringData = toStringMap(normalizedExtraData);

      const message: admin.messaging.MulticastMessage = {
        tokens,
        notification: {
          title,
          body,
        },
        data: stringData,
        webpush: {
          notification: {
            title,
            body,
            icon:
              typeof rawExtraData.icon === 'string'
                ? rawExtraData.icon
                : '/icons/icon-192x192.png',
            badge:
              typeof rawExtraData.badge === 'string'
                ? rawExtraData.badge
                : '/icons/badge-72x72.png',
            tag:
              typeof normalizedExtraData.tag === 'string'
                ? normalizedExtraData.tag
                : 'nexus-notification',
            data: {
              url: stringData.url,
              clickAction: stringData.clickAction,
              type: stringData.type,
              entityId: stringData.entityId ?? '',
              sentAt: stringData.sentAt ?? new Date().toISOString(),
            },
          },
          fcmOptions: {
            link: route,
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      const failures = response.responses
        .map((result, index) => ({
          success: result.success,
          errorCode: result.error?.code ?? null,
          errorMessage: result.error?.message ?? null,
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
        success: response.failureCount === 0,
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