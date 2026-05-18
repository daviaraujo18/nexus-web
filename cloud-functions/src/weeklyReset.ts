import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { ActivityData, calculateWeeklyMetrics as computeMetrics } from './shared/weeklyMetrics';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

export async function runWeeklyReset(): Promise<{
  processedInstances: number;
  errors: string[];
  generatedSnapshots: number;
}> {
  const errors: string[] = [];
  let processedInstances = 0;
  let generatedSnapshots = 0;
  const now = new Date();
  const PAGE_SIZE = 100;

  // Busca paginada para evitar full-scan de milhões de documentos
  const instancesToReset: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  let lastDoc: FirebaseFirestore.DocumentSnapshot | null = null;
  let hasMore = true;

  while (hasMore) {
    let query = db
      .collection('scheduleInstances')
      .where('status', 'in', ['active', 'paused'])
      .where('isActive', '==', true)
      .orderBy('currentWeekEndDate')
      .where('currentWeekEndDate', '<', now)
      .limit(PAGE_SIZE);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      hasMore = false;
      break;
    }

    snapshot.docs.forEach(doc => instancesToReset.push(doc));
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    hasMore = snapshot.docs.length === PAGE_SIZE;
  }

  console.log(`📊 ${instancesToReset.length} instâncias precisam de reset`);

  const CONCURRENCY = 5;

  async function resetInstance(instanceDoc: FirebaseFirestore.QueryDocumentSnapshot): Promise<void> {
    const data = instanceDoc.data();
    const currentWeekNumber: number = data.currentWeekNumber || 1;
    const currentWeekStartDate: Date = data.currentWeekStartDate?.toDate() || now;
    const currentWeekEndDate: Date = data.currentWeekEndDate?.toDate() || now;

    const newWeekNumber = currentWeekNumber + 1;
    const newWeekStart = new Date(currentWeekStartDate);
    newWeekStart.setDate(newWeekStart.getDate() + 7);
    const newWeekEnd = new Date(currentWeekEndDate);
    newWeekEnd.setDate(newWeekEnd.getDate() + 7);

    // Cada instância pertence a 1 aluno (studentId direto no documento)
    const studentId: string | undefined = data.studentId;
    if (studentId) {
      const snapshotId = `${studentId}_${instanceDoc.id}_week_${currentWeekNumber}`;

      // Calcular métricas usando shared utils
      const weekActivitiesSnap = await db
        .collection('activityProgress')
        .where('scheduleInstanceId', '==', instanceDoc.id)
        .where('weekNumber', '==', currentWeekNumber)
        .get();

      const weekActivities: ActivityData[] = weekActivitiesSnap.docs.map(d => {
        const a = d.data();
        return {
          status: a.status,
          dayOfWeek: a.dayOfWeek,
          scoring: a.scoring,
          executionData: a.executionData,
          scheduledDate: a.scheduledDate?.toDate(),
          completedAt: a.completedAt?.toDate(),
        };
      });

      const metrics = computeMetrics(weekActivities);

      // Resolver scheduleName: se a instância não tiver, buscar do template
      let scheduleName = data.scheduleName;
      if (!scheduleName && data.scheduleTemplateId) {
        try {
          const templateDoc = await db.collection('weeklySchedules').doc(data.scheduleTemplateId).get();
          scheduleName = templateDoc.data()?.name || '';
        } catch (e) {
          console.warn(`⚠️ Erro ao buscar scheduleName do template ${data.scheduleTemplateId}:`, e);
          scheduleName = '';
        }
      }

      // Snapshot e avanço de semana dentro da mesma transaction:
      // se a transaction falhar → snapshot não fica órfão; se snapshot falhar → semana não avança.
      const snapshotData = {
        scheduleInstanceId: instanceDoc.id,
        studentId,
        weekNumber: currentWeekNumber,
        scheduleName: scheduleName || '',
        weekStartDate: Timestamp.fromDate(currentWeekStartDate),
        weekEndDate: Timestamp.fromDate(currentWeekEndDate),
        isActive: true,
        metrics,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      try {
        await db.runTransaction(async (transaction) => {
          const instanceRef = db.collection('scheduleInstances').doc(instanceDoc.id);
          const instanceSnap = await transaction.get(instanceRef);
          if (!instanceSnap.exists) return;

          // Idempotência: se a semana já foi avançada por execução concorrente, abortar silenciosamente
          const liveWeekNumber: number = instanceSnap.data()?.currentWeekNumber ?? 1;
          if (liveWeekNumber !== currentWeekNumber) {
            console.warn(`⚠️ [IDEMPOTÊNCIA] ${instanceDoc.id}: semana esperada=${currentWeekNumber}, atual=${liveWeekNumber} — reset já executado, pulando.`);
            return;
          }

          const snapshotRef = db.collection('weeklySnapshots').doc(snapshotId);
          transaction.set(snapshotRef, snapshotData);

          transaction.update(instanceRef, {
            currentWeekNumber: newWeekNumber,
            currentWeekStartDate: Timestamp.fromDate(newWeekStart),
            currentWeekEndDate: Timestamp.fromDate(newWeekEnd),
            'progressCache.completedActivities': 0,
            'progressCache.completionPercentage': 0,
            'progressCache.totalPointsEarned': 0,
            'progressCache.lastUpdatedAt': FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        });

        generatedSnapshots++;
        console.log(`📸 Snapshot ${snapshotId}: ${metrics.completedActivities}/${metrics.totalActivities} concluídas, consistência=${metrics.consistencyScore}%, adesão=${metrics.adherenceScore}%`);
      } catch (txErr: any) {
        errors.push(`${instanceDoc.id}: Falha na transaction de reset (semana ${currentWeekNumber}): ${txErr.message}`);
        console.error(`❌ Erro na transaction de reset para ${instanceDoc.id}:`, txErr);
        return; // não avança para geração de atividades se o reset falhou
      }
    }

    // Gerar atividades da nova semana e atualizar progressCache
    try {
      await generateNewWeekActivities(instanceDoc, newWeekNumber, newWeekStart);
    } catch (genErr: any) {
      errors.push(`${instanceDoc.id}: Falha ao gerar atividades da semana ${newWeekNumber}: ${genErr.message}`);
      console.error(`❌ Erro ao gerar atividades para ${instanceDoc.id}:`, genErr);
    }

    processedInstances++;
    console.log(`✅ ${instanceDoc.id}: semana ${currentWeekNumber} → ${newWeekNumber}`);
  }

  async function generateNewWeekActivities(
    instanceDoc: FirebaseFirestore.QueryDocumentSnapshot,
    weekNo: number,
    weekStartDate: Date
  ): Promise<void> {
    const data = instanceDoc.data();
    const templateId = data.scheduleTemplateId;
    if (!templateId) return;

    const activitiesSnap = await db
      .collection('scheduleActivities')
      .where('scheduleTemplateId', '==', templateId)
      .get();

    if (activitiesSnap.empty) {
      console.warn(`⚠️ Nenhuma atividade encontrada no template ${templateId}`);
      await db.collection('scheduleInstances').doc(instanceDoc.id).update({
        activitiesReady: true,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    const existingSnap = await db
      .collection('activityProgress')
      .where('scheduleInstanceId', '==', instanceDoc.id)
      .where('weekNumber', '==', weekNo)
      .get();
    const existingIds = new Set(existingSnap.docs.map(d => d.id));

    const BATCH_LIMIT = 499;
    let currentBatch = db.batch();
    let batchOpCount = 0;
    let added = 0;
    let skipped = 0;

    const commitIfNeeded = async () => {
      if (batchOpCount >= BATCH_LIMIT) {
        await currentBatch.commit();
        currentBatch = db.batch();
        batchOpCount = 0;
      }
    };

    for (const actDoc of activitiesSnap.docs) {
      const act = actDoc.data();
      const scheduleDay = ((act.dayOfWeek ?? 0) + 6) % 7;
      const activityDate = new Date(
        weekStartDate.getFullYear(),
        weekStartDate.getMonth(),
        weekStartDate.getDate() + scheduleDay,
        12, 0, 0, 0
      );

      const progressId = `${instanceDoc.id}_w${weekNo}_${actDoc.id}`;
      if (existingIds.has(progressId)) {
        skipped++;
        continue;
      }

      const convertedDayOfWeek = ((act.dayOfWeek ?? 0) + 6) % 7;
      const docRef = db.collection('activityProgress').doc(progressId);

      await commitIfNeeded();
      currentBatch.set(docRef, {
        scheduleInstanceId: instanceDoc.id,
        activityId: actDoc.id,
        studentId: data.studentId,
        weekNumber: weekNo,
        dayOfWeek: convertedDayOfWeek,
        activitySnapshot: {
          id: actDoc.id,
          title: act.title || '',
          type: act.type || 'quick',
          description: act.description || '',
          dayOfWeek: act.dayOfWeek ?? 0,
          metadata: act.metadata ?? {},
          scoring: act.scoring ?? { pointsOnCompletion: 10 },
          isActive: act.isActive !== false,
        },
        status: 'pending',
        scheduledDate: Timestamp.fromDate(activityDate),
        scoring: { pointsEarned: 0, bonusPoints: 0, penaltyPoints: 0 },
        isActive: true,
        isDeleted: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      batchOpCount++;
      added++;
    }

    if (added > 0) {
      await currentBatch.commit();
    }

    // Atualizar progressCache
    const allProgress = await db
      .collection('activityProgress')
      .where('scheduleInstanceId', '==', instanceDoc.id)
      .where('weekNumber', '==', weekNo)
      .get();
    const total = allProgress.size;
    const completed = allProgress.docs.filter(
      d => d.data().status === 'completed'
    ).length;
    const points = allProgress.docs.reduce(
      (sum, d) => sum + (d.data().scoring?.pointsEarned || 0),
      0
    );

    await db.collection('scheduleInstances').doc(instanceDoc.id).update({
      'progressCache.totalActivities': total,
      'progressCache.completedActivities': completed,
      'progressCache.completionPercentage': total > 0 ? Math.round((completed / total) * 100) : 0,
      'progressCache.totalPointsEarned': points,
      'progressCache.lastUpdatedAt': FieldValue.serverTimestamp(),
      activitiesReady: true,
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`📝 [GENERATE] ${added} atividades geradas, ${skipped} ignoradas para semana ${weekNo}`);
  }

  // Processa instâncias em lote com concorrência controlada
  for (let i = 0; i < instancesToReset.length; i += CONCURRENCY) {
    const batch = instancesToReset.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(inst => resetInstance(inst).catch(err => {
        errors.push(`${inst.id}: ${err.message}`);
        console.error(`❌ Erro ao resetar ${inst.id}:`, err);
      }))
    );
    results.forEach(r => {
      if (r.status === 'rejected') {
        const err = r.reason;
        const instanceId = err?.message?.split(':')[0] || 'unknown';
        if (!errors.some(e => e.startsWith(instanceId))) {
          errors.push(`${instanceId}: ${err.message}`);
        }
      }
    });
  }

  return { processedInstances, errors, generatedSnapshots };
}

async function sendAdminNotification(result: {
  processedInstances: number;
  errors: string[];
  generatedSnapshots: number;
}) {
  try {
    const adminsSnapshot = await db
      .collection('professionals')
      .where('profile.canApproveRegistrations', '==', true)
      .get();

    const batch = db.batch();
    const notificationsRef = db.collection('notifications');

    adminsSnapshot.docs.forEach(adminDoc => {
      const newNotificationRef = notificationsRef.doc();
      batch.set(newNotificationRef, {
        userId: adminDoc.id,
        title: 'Reset Semanal Concluído',
        body: `${result.processedInstances} cronogramas processados, ${result.generatedSnapshots} snapshots gerados`,
        type: 'system_notification',
        data: {
          processedInstances: result.processedInstances,
          generatedSnapshots: result.generatedSnapshots,
          errorCount: result.errors.length,
        },
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();
  } catch (error) {
    console.error('Erro ao enviar notificação:', error);
  }
}

export const processWeeklyReset = onSchedule(
  { schedule: '1 0 * * 1', timeZone: 'America/Sao_Paulo', region: 'southamerica-east1', timeoutSeconds: 540 },
  async () => {
    try {
      console.log('🚀 Iniciando processWeeklyReset');
      const result = await runWeeklyReset();
      console.log('✅ Reset concluído:', result);

      await sendAdminNotification(result);

      await db.collection('systemLogs').add({
        function: 'processWeeklyReset',
        status: 'success',
        ...result,
        timestamp: FieldValue.serverTimestamp(),
      });
    } catch (error: any) {
      console.error('❌ Erro na Cloud Function:', error);
      await db.collection('systemErrors').add({
        function: 'processWeeklyReset',
        error: error.message,
        stack: error.stack,
        timestamp: FieldValue.serverTimestamp(),
      });
      throw error;
    }
  }
);

// Único endpoint HTTP para disparo manual do reset semanal por administradores.
// forceWeeklyReset foi removido — era duplicata idêntica a triggerWeeklyReset.
export const triggerWeeklyReset = onRequest(
  { region: 'southamerica-east1', timeoutSeconds: 540 },
  async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Não autorizado' });
      return;
    }
    const token = authHeader.split('Bearer ')[1];
    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(token);
    } catch {
      res.status(401).json({ error: 'Token inválido' });
      return;
    }
    const adminDoc = await db.collection('professionals').doc(decoded.uid).get();
    if (!adminDoc.exists || !adminDoc.data()?.profile?.canApproveRegistrations) {
      res.status(403).json({ error: 'Acesso negado. Apenas administradores podem executar esta operação.' });
      return;
    }
    try {
      console.log('🚀 Iniciando triggerWeeklyReset (onRequest)');
      const result = await runWeeklyReset();
      console.log('✅ triggerWeeklyReset concluído:', result);
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('Erro no reset manual:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

export const cleanupOldData = onSchedule(
  { schedule: '0 3 * * *', timeZone: 'America/Sao_Paulo', region: 'southamerica-east1' },
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

      const deletePromises = oldSnapshots.docs.map(doc => doc.ref.delete());
      await Promise.all(deletePromises);

      console.log(`🧹 Removidos ${deletePromises.length} snapshots antigos`);
    } catch (error) {
      console.error('Erro na limpeza de dados:', error);
    }
  }
);

export const backfillSnapshots = onRequest(
  { region: 'southamerica-east1', timeoutSeconds: 540 },
  async (_req, res) => {
    try {
      console.log('🚀 Iniciando backfillSnapshots — recalculando métricas de todos os snapshots');

      const snapshotsSnap = await db.collection('weeklySnapshots').get();
      console.log(`📊 ${snapshotsSnap.size} snapshots encontrados`);

      let recalculated = 0;
      let errors = 0;

      for (const snapDoc of snapshotsSnap.docs) {
        const data = snapDoc.data();
        const instanceId = data.scheduleInstanceId;
        const weekNumber = data.weekNumber;

        if (!instanceId || !weekNumber) {
          errors++;
          console.warn(`⚠️ Snapshot ${snapDoc.id} sem instanceId ou weekNumber`);
          continue;
        }

        try {
          const instSnap = await db.collection('scheduleInstances').doc(instanceId).get();
          const instData = instSnap.exists ? instSnap.data()! : null;

          let scheduleName = instData?.scheduleName || '';
          if (!scheduleName && instData?.scheduleTemplateId) {
            const templateSnap = await db.collection('weeklySchedules').doc(instData.scheduleTemplateId).get();
            scheduleName = templateSnap.data()?.name || '';
          }

          const weekSnap = await db
            .collection('activityProgress')
            .where('scheduleInstanceId', '==', instanceId)
            .where('weekNumber', '==', weekNumber)
            .get();

          const weekActivities: ActivityData[] = weekSnap.docs.map(d => {
            const a = d.data();
            return {
              status: a.status,
              dayOfWeek: a.dayOfWeek,
              scoring: a.scoring,
              executionData: a.executionData,
              scheduledDate: a.scheduledDate?.toDate?.() ?? null,
              completedAt: a.completedAt?.toDate?.() ?? null,
            };
          });

          const metrics = computeMetrics(weekActivities);

          if (weekActivities.length === 0) {
            await snapDoc.ref.update({
              scheduleName: scheduleName || '',
              updatedAt: FieldValue.serverTimestamp(),
            });
            recalculated++;
            continue;
          }

          await snapDoc.ref.set({
            scheduleName: scheduleName || '',
            metrics,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });

          recalculated++;
          console.log(`✅ ${snapDoc.id}: ${metrics.completedActivities}/${metrics.totalActivities} concluídas, consistência=${metrics.consistencyScore}%, adesão=${metrics.adherenceScore}%`);
        } catch (err: any) {
          errors++;
          console.error(`⚠️ Erro em ${snapDoc.id}:`, err.message);
        }
      }

      console.log(`🎉 Concluído: ${recalculated} recalculados, ${errors} erros`);

      res.json({
        success: true,
        snapshotsRecalculados: recalculated,
        erros: errors,
      });
    } catch (error: any) {
      console.error('❌ Erro no backfillSnapshots:', error);
      res.status(500).json({ error: error.message });
    }
  }
);
