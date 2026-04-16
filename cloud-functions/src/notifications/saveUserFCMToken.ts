import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

if (!admin.apps.length) {
  admin.initializeApp();
}

export const saveUserFCMToken = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    try {
      console.log('🔥 saveUserFCMToken payload:', data);

      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Usuário não autenticado.'
        );
      }

      const userId = context.auth.uid;
      const token = typeof data?.token === 'string' ? data.token : null;

      if (!token) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Token é obrigatório.'
        );
      }

      const deviceInfo =
        data?.deviceInfo && typeof data.deviceInfo === 'object'
          ? data.deviceInfo
          : {};

      const db = admin.firestore();

      const existingSnap = await db
        .collection('userFCMTokens')
        .where('token', '==', token)
        .limit(1)
        .get();

      if (!existingSnap.empty) {
        const doc = existingSnap.docs[0];

        await doc.ref.update({
          userId,
          active: true,
          updatedAt: admin.firestore.Timestamp.now(),
          deviceInfo,
        });

        console.log('♻️ Token atualizado:', doc.id);

        return { updated: true, docId: doc.id };
      }

      const newDoc = await db.collection('userFCMTokens').add({
        userId,
        token,
        active: true,
        deviceInfo,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });

      console.log('🆕 Token criado:', newDoc.id);

      return { created: true, docId: newDoc.id };
    } catch (error) {
      console.error('❌ ERRO saveUserFCMToken:', error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        'internal',
        'Erro ao salvar token.'
      );
    }
  });