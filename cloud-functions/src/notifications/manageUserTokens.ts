import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

export const saveUserFCMToken = onCall(
  { region: 'southamerica-east1' },
  async (request) => {
    try {
      if (!request.auth) {
        throw new Error('Usuário não autenticado');
      }

      const { token, deviceInfo } = request.data as { token: string; deviceInfo?: any };
      const userId = request.auth.uid;

      if (!token) {
        throw new Error('Token FCM é obrigatório');
      }

      console.log(`💾 Salvando token FCM para usuário ${userId}`);

      const tokenHash = await generateTokenHash(token);
      const tokenId = `${userId}_${tokenHash.substring(0, 16)}`;

      const tokenData = {
        tokenId,
        userId,
        token,
        deviceInfo: deviceInfo || {
          platform: 'unknown',
          userAgent: 'unknown',
          timestamp: FieldValue.serverTimestamp()
        },
        isActive: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        lastUsedAt: FieldValue.serverTimestamp()
      };

      await db.collection('userFCMTokens')
        .doc(tokenId)
        .set(tokenData, { merge: true });

      console.log(`✅ Token FCM salvo para usuário ${userId} (ID: ${tokenId})`);

      await updateUserNotificationPreferences(userId);

      return {
        success: true,
        tokenId,
        message: 'Token FCM salvo com sucesso'
      };

    } catch (error: any) {
      console.error('❌ Erro ao salvar token FCM:', error);
      throw new Error(error.message || 'Erro ao salvar token FCM');
    }
  }
);

export const removeUserFCMToken = onCall(
  { region: 'southamerica-east1' },
  async (request) => {
    try {
      if (!request.auth) {
        throw new Error('Usuário não autenticado');
      }

      const { token } = request.data as { token: string };
      const userId = request.auth.uid;

      if (!token) {
        throw new Error('Token FCM é obrigatório');
      }

      console.log(`🗑️ Removendo token FCM para usuário ${userId}`);

      const tokensSnapshot = await db.collection('userFCMTokens')
        .where('userId', '==', userId)
        .where('token', '==', token)
        .get();

      if (tokensSnapshot.empty) {
        return {
          success: true,
          message: 'Token não encontrado ou já removido'
        };
      }

      const batch = db.batch();
      tokensSnapshot.forEach(doc => {
        batch.update(doc.ref, {
          isActive: false,
          deactivatedAt: FieldValue.serverTimestamp(),
          deactivationReason: 'user_request'
        });
      });

      await batch.commit();

      console.log(`✅ Token FCM removido para usuário ${userId}`);

      return {
        success: true,
        message: 'Token FCM removido com sucesso'
      };

    } catch (error: any) {
      console.error('❌ Erro ao remover token FCM:', error);
      throw new Error(error.message || 'Erro ao remover token FCM');
    }
  }
);

export const cleanupOldTokens = onSchedule(
  { schedule: 'every 24 hours', timeZone: 'America/Sao_Paulo' },
  async () => {
    try {
      console.log('🧹 Iniciando limpeza de tokens FCM antigos...');

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const oldTokensSnapshot = await db.collection('userFCMTokens')
        .where('isActive', '==', false)
        .where('deactivatedAt', '<', thirtyDaysAgo)
        .limit(1000)
        .get();

      console.log(`📊 Tokens antigos encontrados: ${oldTokensSnapshot.size}`);

      const batch = db.batch();
      oldTokensSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      console.log(`✅ ${oldTokensSnapshot.size} tokens antigos removidos`);
    } catch (error) {
      console.error('❌ Erro na limpeza de tokens:', error);
      throw error;
    }
  }
);

async function generateTokenHash(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function updateUserNotificationPreferences(userId: string): Promise<void> {
  try {
    const prefsRef = db.collection('notificationPreferences').doc(userId);
    const prefsDoc = await prefsRef.get();

    if (prefsDoc.exists) {
      await prefsRef.update({
        'channels.push': true,
        updatedAt: FieldValue.serverTimestamp()
      });
    } else {
      await prefsRef.set({
        userId,
        enabled: true,
        channels: {
          push: true,
          in_app: true,
          email: false,
          sms: false
        },
        allowedHours: {
          start: "08:00",
          end: "21:00"
        },
        allowedDays: [1, 2, 3, 4, 5],
        types: {
          activity_reminder: true,
          schedule_update: true,
          achievement: true,
          message: true,
          system: false,
          therapeutic_reminder: true,
          educational_reminder: true
        },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    }

    console.log(`✅ Preferências atualizadas para usuário ${userId}`);
  } catch (error) {
    console.error('❌ Erro ao atualizar preferências:', error);
  }
}
