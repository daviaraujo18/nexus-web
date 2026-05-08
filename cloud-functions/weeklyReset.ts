// cloud-functions/weeklyReset.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { RepetitionService } from '../lib/services/RepetitionService';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Cloud Function que roda toda segunda-feira às 00:01
 */
export const processWeeklyReset = onSchedule(
  {
    schedule: '1 0 * * 1',
    timeZone: 'America/Sao_Paulo'
  },
  async () => {
    try {
      console.log('🚀 Iniciando Cloud Function: processWeeklyReset');

      const result = await RepetitionService.processWeeklyReset();

      console.log('✅ Cloud Function concluída com sucesso:', result);

      await sendAdminNotification(result);
    } catch (error: any) {
      console.error('❌ Erro na Cloud Function:', error);

      await admin.firestore().collection('systemErrors').add({
        function: 'processWeeklyReset',
        error: error.message,
        stack: error.stack,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      throw error;
    }
  }
);

/**
 * Endpoint HTTP para forçar reset (para testes/debug)
 */
export const forceWeeklyReset = onRequest(async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Não autorizado' });
      return;
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);

    const isAdmin = await checkIfAdmin(decodedToken.uid);
    if (!isAdmin) {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }

    const result = await RepetitionService.processWeeklyReset();

    res.json({
      success: true,
      message: 'Reset forçado executado com sucesso',
      result
    });
  } catch (error: any) {
    console.error('Erro no reset forçado:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Cloud Function para limpeza de dados antigos
 */
export const cleanupOldData = onSchedule(
  {
    schedule: '0 3 * * *',
    timeZone: 'America/Sao_Paulo'
  },
  async () => {
    try {
      console.log('🧹 Iniciando limpeza de dados antigos');

      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const snapshotsRef = admin.firestore().collection('performanceSnapshots');
      const oldSnapshots = await snapshotsRef
        .where('createdAt', '<', oneYearAgo)
        .where('isActive', '==', false)
        .limit(100)
        .get();

      const deletePromises = oldSnapshots.docs.map(doc => doc.ref.delete());
      await Promise.all(deletePromises);

      console.log(`🧹 Limpos ${deletePromises.length} snapshots antigos`);
    } catch (error) {
      console.error('Erro na limpeza de dados:', error);
    }
  }
);

// Funções auxiliares
async function sendAdminNotification(result: any) {
  try {
    // Buscar todos os admins
    const adminsSnapshot = await admin.firestore()
      .collection('professionals')
      .where('profile.canApproveRegistrations', '==', true)
      .get();
    
    const notifications = adminsSnapshot.docs.map(doc => {
      const adminData = doc.data();
      return {
        userId: doc.id,
        title: 'Reset Semanal Concluído',
        body: `${result.processedInstances} cronogramas processados, ${result.generatedSnapshots} relatórios gerados`,
        type: 'system_notification',
        data: {
          processedInstances: result.processedInstances,
          generatedSnapshots: result.generatedSnapshots,
          errorCount: result.errors.length
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };
    });
    
    // Salvar notificações no Firestore
    const batch = admin.firestore().batch();
    const notificationsRef = admin.firestore().collection('notifications');
    
    notifications.forEach(notification => {
      const newNotificationRef = notificationsRef.doc();
      batch.set(newNotificationRef, notification);
    });
    
    await batch.commit();
    
  } catch (error) {
    console.error('Erro ao enviar notificação:', error);
  }
}

async function checkIfAdmin(userId: string): Promise<boolean> {
  try {
    const userDoc = await admin.firestore()
      .collection('professionals')
      .doc(userId)
      .get();
    
    if (!userDoc.exists) return false;
    
    const userData = userDoc.data();
    return userData?.profile?.canApproveRegistrations === true;
  } catch {
    return false;
  }
}