import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function runWeeklyReset(): Promise<{ processedInstances: number; errors: string[] }> {
  const errors: string[] = [];
  let processedInstances = 0;
  const now = new Date();

  const snapshot = await db
    .collection('scheduleInstances')
    .where('status', 'in', ['active', 'paused'])
    .where('isActive', '==', true)
    .get();

  const instancesToReset = snapshot.docs.filter(doc => {
    const weekEnd = doc.data().currentWeekEndDate?.toDate();
    return weekEnd && weekEnd < now;
  });

  console.log(`📊 ${instancesToReset.length}/${snapshot.size} instâncias precisam de reset`);

  for (const instanceDoc of instancesToReset) {
    try {
      const data = instanceDoc.data();
      const currentWeekNumber: number = data.currentWeekNumber || 1;
      const currentWeekStartDate: Date = data.currentWeekStartDate?.toDate() || now;
      const currentWeekEndDate: Date = data.currentWeekEndDate?.toDate() || now;

      const newWeekNumber = currentWeekNumber + 1;
      const newWeekStart = new Date(currentWeekStartDate);
      newWeekStart.setDate(newWeekStart.getDate() + 7);
      const newWeekEnd = new Date(currentWeekEndDate);
      newWeekEnd.setDate(newWeekEnd.getDate() + 7);

      await db.runTransaction(async (transaction) => {
        const instanceRef = db.collection('scheduleInstances').doc(instanceDoc.id);
        const instanceSnap = await transaction.get(instanceRef);
        if (!instanceSnap.exists) return;

        transaction.update(instanceRef, {
          currentWeekNumber: newWeekNumber,
          currentWeekStartDate: admin.firestore.Timestamp.fromDate(newWeekStart),
          currentWeekEndDate: admin.firestore.Timestamp.fromDate(newWeekEnd),
          'progressCache.completedActivities': 0,
          'progressCache.completionPercentage': 0,
          'progressCache.totalPointsEarned': 0,
          'progressCache.lastUpdatedAt': admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      processedInstances++;
      console.log(`✅ ${instanceDoc.id}: semana ${currentWeekNumber} → ${newWeekNumber}`);
    } catch (err: any) {
      errors.push(`${instanceDoc.id}: ${err.message}`);
      console.error(`❌ Erro ao resetar ${instanceDoc.id}:`, err);
    }
  }

  return { processedInstances, errors };
}

export const processWeeklyReset = onSchedule(
  { schedule: '1 0 * * 1', timeZone: 'America/Sao_Paulo' },
  async () => {
    try {
      console.log('🚀 Iniciando processWeeklyReset');
      const result = await runWeeklyReset();
      console.log('✅ Reset concluído:', result);
      await db.collection('systemLogs').add({
        function: 'processWeeklyReset',
        status: 'success',
        ...result,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (error: any) {
      console.error('❌ Erro na Cloud Function:', error);
      await db.collection('systemErrors').add({
        function: 'processWeeklyReset',
        error: error.message,
        stack: error.stack,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      throw error;
    }
  }
);

export const forceWeeklyReset = onRequest(async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Não autorizado' });
      return;
    }
    const token = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    const adminDoc = await db.collection('professionals').doc(decoded.uid).get();
    if (!adminDoc.exists || !adminDoc.data()?.profile?.canApproveRegistrations) {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }
    const result = await runWeeklyReset();
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Erro no reset forçado:', error);
    res.status(500).json({ error: error.message });
  }
});

export const cleanupOldData = onSchedule(
  { schedule: '0 3 * * *', timeZone: 'America/Sao_Paulo' },
  async () => {
    try {
      console.log('🧹 Iniciando limpeza de dados antigos');
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const oldSnapshots = await db
        .collection('performanceSnapshots')
        .where('createdAt', '<', oneYearAgo)
        .where('isActive', '==', false)
        .limit(100)
        .get();
      const batch = db.batch();
      oldSnapshots.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      console.log(`🧹 Removidos ${oldSnapshots.size} snapshots antigos`);
    } catch (error) {
      console.error('Erro na limpeza de dados:', error);
    }
  }
);
