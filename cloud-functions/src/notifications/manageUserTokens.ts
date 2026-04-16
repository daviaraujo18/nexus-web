import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

if (!admin.apps.length) {
  admin.initializeApp();
}

type SaveTokenPayload = {
  token?: string;
  deviceInfo?: {
    fingerprint?: string;
    userAgent?: string;
    language?: string;
    platform?: string;
    [key: string]: unknown;
  };
};

type RemoveTokenPayload = {
  token?: string;
};

export const saveUserFCMToken = functions
  .region('southamerica-east1')
  .https.onCall(
    async (
      data: SaveTokenPayload,
      context: functions.https.CallableContext
    ) => {
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
        const fingerprint =
          typeof deviceInfo?.fingerprint === 'string'
            ? deviceInfo.fingerprint
            : 'unknown-device';

        // 1) Se o mesmo token já existir para esse usuário, só atualiza
        const sameTokenSnap = await db
          .collection('userFCMTokens')
          .where('userId', '==', uid)
          .where('token', '==', token)
          .limit(1)
          .get();

        if (!sameTokenSnap.empty) {
          const sameTokenDoc = sameTokenSnap.docs[0];

          await sameTokenDoc.ref.update({
            active: true,
            updatedAt: now,
            deviceInfo: deviceInfo ?? {},
          });

          return {
            success: true,
            tokenId: sameTokenDoc.id,
            message: 'Token FCM já existia e foi reativado/atualizado',
          };
        }

        // 2) Desativa tokens antigos do MESMO dispositivo
        const sameDeviceSnap = await db
          .collection('userFCMTokens')
          .where('userId', '==', uid)
          .where('deviceInfo.fingerprint', '==', fingerprint)
          .where('active', '==', true)
          .get();

        for (const docSnap of sameDeviceSnap.docs) {
          await docSnap.ref.update({
            active: false,
            replacedAt: now,
            lastErrorCode: 'rotated-token',
            lastErrorMessage: 'Token substituído por um token mais recente do mesmo dispositivo.',
          });
        }

        // 3) Salva o novo token
        const newDocRef = await db.collection('userFCMTokens').add({
          userId: uid,
          token,
          active: true,
          deviceInfo: deviceInfo ?? {},
          createdAt: now,
          updatedAt: now,
        });

        return {
          success: true,
          tokenId: newDocRef.id,
          message: 'Token FCM salvo com sucesso',
        };
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
    }
  );

export const removeUserFCMToken = functions
  .region('southamerica-east1')
  .https.onCall(
    async (
      data: RemoveTokenPayload,
      context: functions.https.CallableContext
    ) => {
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
          .get();

        for (const docSnap of existing.docs) {
          await docSnap.ref.update({
            active: false,
            updatedAt: now,
            invalidatedAt: now,
            lastErrorCode: 'manual-remove',
            lastErrorMessage: 'Token removido manualmente pelo cliente.',
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
    }
  );