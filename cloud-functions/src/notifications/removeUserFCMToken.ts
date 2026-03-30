import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

if (!admin.apps.length) {
  admin.initializeApp();
}

export const removeUserFCMToken = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    try {
      console.log('🔥 removeUserFCMToken payload:', data);

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

      const db = admin.firestore();

      const tokensSnap = await db
        .collection('userFCMTokens')
        .where('userId', '==', userId)
        .where('token', '==', token)
        .get();

      if (tokensSnap.empty) {
        console.log('⚠️ Nenhum token encontrado para desativar.');
        return {
          success: true,
          updated: 0,
          message: 'Nenhum token correspondente encontrado.',
        };
      }

      const now = admin.firestore.Timestamp.now();

      const updates = tokensSnap.docs.map((docSnap) =>
        docSnap.ref.update({
          active: false,
          invalidatedAt: now,
          updatedAt: now,
          lastErrorCode: 'manual-remove',
          lastErrorMessage: 'Token removido manualmente pelo cliente.',
        })
      );

      await Promise.all(updates);

      console.log('🗑️ Tokens desativados:', tokensSnap.size);

      return {
        success: true,
        updated: tokensSnap.size,
      };
    } catch (error) {
      console.error('❌ ERRO removeUserFCMToken:', error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        'internal',
        'Erro ao remover token.'
      );
    }
  });