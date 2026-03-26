import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import cors from 'cors';

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/* =========================
   TYPES
========================= */

interface SendPushNotificationBody {
  userId?: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  type?: string;
}

/* =========================
   FUNCTION
========================= */

export const sendPushNotification = functions
  .region('southamerica-east1')
  .https.onRequest((req, res) => {
    const corsHandler = cors({ origin: true });

    return corsHandler(req, res, async () => {
      try {
        // Permitir apenas POST
        if (req.method !== 'POST') {
          res.status(405).json({
            success: false,
            error: 'Método não permitido'
          });
          return;
        }

        const {
          userId,
          title,
          body,
          data = {},
          type = 'custom'
        } = (req.body || {}) as SendPushNotificationBody;

        // Validar payload mínimo
        if (!userId || !title || !body) {
          res.status(400).json({
            success: false,
            error: 'Parâmetros obrigatórios ausentes: userId, title, body'
          });
          return;
        }

        console.log('📥 Payload recebido:', { userId, title, type });

        // Buscar tokens ativos do usuário
        const tokensSnapshot = await db
          .collection('userFCMTokens')
          .where('userId', '==', userId)
          .where('isActive', '==', true)
          .get();

        if (tokensSnapshot.empty) {
          res.status(404).json({
            success: false,
            error: 'Nenhum token ativo encontrado para o usuário'
          });
          return;
        }

        const tokenDocs = tokensSnapshot.docs.filter(doc => !!doc.data().token);
        const tokens = tokenDocs.map(doc => String(doc.data().token));

        if (tokens.length === 0) {
          res.status(404).json({
            success: false,
            error: 'Nenhum token válido encontrado para o usuário'
          });
          return;
        }

        console.log('✅ Tokens encontrados:', tokens.length);

        // Converter data para string, como o FCM exige
        const stringifiedData = Object.entries(data).reduce<Record<string, string>>(
          (acc, [key, value]) => {
            acc[key] = String(value);
            return acc;
          },
          {}
        );

        const message: admin.messaging.MulticastMessage = {
          tokens,
          notification: {
            title,
            body
          },
          data: {
            ...stringifiedData,
            type: String(type)
          },
          webpush: {
            notification: {
              title,
              body,
              icon: '/icons/icon-192x192.png',
              badge: '/icons/badge-72x72.png'
            }
          }
        };

        console.log('📤 Enviando push via FCM...');

        const response = await admin.messaging().sendEachForMulticast(message);

        console.log('📊 Resultado do envio:', {
          successCount: response.successCount,
          failureCount: response.failureCount
        });

        // Limpar tokens inválidos
        await cleanupInvalidTokens(tokenDocs, response.responses);

        // Salvar histórico da notificação
        await db.collection('notifications').add({
          userId,
          title,
          body,
          type,
          channels: ['push'],
          status: response.successCount > 0 ? 'sent' : 'failed',
          data,
          successCount: response.successCount,
          failureCount: response.failureCount,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log('✅ Histórico salvo em notifications');

        res.status(200).json({
          success: response.successCount > 0,
          successCount: response.successCount,
          failureCount: response.failureCount,
          message: 'Notificação processada com sucesso'
        });
      } catch (error: any) {
        console.error('❌ Erro ao enviar push notification:', error);

        res.status(500).json({
          success: false,
          error: error.message || 'Erro interno ao enviar notificação'
        });
      }
    });
  });

/* =========================
   HELPERS
========================= */

async function cleanupInvalidTokens(
  tokenDocs: FirebaseFirestore.QueryDocumentSnapshot[],
  responses: admin.messaging.SendResponse[]
): Promise<void> {
  const batch = db.batch();
  let hasUpdates = false;

  for (let index = 0; index < responses.length; index += 1) {
    const response = responses[index];

    if (!response.success) {
      const errorCode = response.error?.code || '';

      // Tokens inválidos/expirados
      if (
        errorCode.includes('registration-token-not-registered') ||
        errorCode.includes('invalid-registration-token')
      ) {
        batch.update(tokenDocs[index].ref, {
          isActive: false,
          deactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
          deactivationReason: errorCode,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        hasUpdates = true;
      }
    }
  }

  if (hasUpdates) {
    await batch.commit();
  }
}