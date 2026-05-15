import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

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

      // Calcular métricas reais a partir dos activityProgress da semana
      const weekActivitiesSnap = await db
        .collection('activityProgress')
        .where('scheduleInstanceId', '==', instanceDoc.id)
        .where('weekNumber', '==', currentWeekNumber)
        .get();

      const weekActivities = weekActivitiesSnap.docs.map(d => {
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

      const totalActivities = weekActivities.length;
      const completedActivities = weekActivities.filter(a => a.status === 'completed').length;
      const skippedActivities = weekActivities.filter(a => a.status === 'skipped').length;
      const totalPoints = weekActivities
        .filter(a => a.status === 'completed')
        .reduce((sum, a) => sum + (a.scoring?.pointsEarned || 0), 0);
      const completionRate = totalActivities > 0
        ? Math.round((completedActivities / totalActivities) * 100)
        : 0;
      const totalTimeSpent = weekActivities
        .filter(a => a.status === 'completed' && a.executionData?.timeSpent)
        .reduce((sum, a) => sum + (a.executionData?.timeSpent || 0), 0);

      // Consistência: dias únicos (0-6) com ao menos 1 atividade completada
      const uniqueDays = new Set(
        weekActivities.filter(a => a.status === 'completed').map(a => a.dayOfWeek)
      ).size;
      const consistencyScore = totalActivities > 0
        ? Math.round((uniqueDays / 7) * 100)
        : 0;

      // Adesão: atividades completadas no mesmo dia do agendamento
      const onTimeActivities = weekActivities.filter(a => {
        if (a.status !== 'completed' || !a.completedAt || !a.scheduledDate) return false;
        return a.completedAt.getFullYear() === a.scheduledDate.getFullYear()
          && a.completedAt.getMonth() === a.scheduledDate.getMonth()
          && a.completedAt.getDate() === a.scheduledDate.getDate();
      }).length;
      const adherenceScore = completedActivities > 0
        ? Math.round((onTimeActivities / completedActivities) * 100)
        : 0;

      // Streak: dias consecutivos com atividade até o fim da semana
      const completedDates = [
        ...new Set(
          weekActivities
            .filter(a => a.status === 'completed' && a.completedAt)
            .map(a => a.completedAt!.toISOString().split('T')[0])
        ),
      ].sort().reverse();
      let streakAtEndOfWeek = 0;
      if (completedDates.length > 0) {
        streakAtEndOfWeek = 1;
        for (let i = 1; i < completedDates.length; i++) {
          const prev = new Date(completedDates[i - 1]);
          const curr = new Date(completedDates[i]);
          const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000);
          if (diff === 1) streakAtEndOfWeek++;
          else break;
        }
      }

      const avgPoints = completedActivities > 0
        ? Math.round(totalPoints / completedActivities)
        : 0;
      const avgTime = completedActivities > 0
        ? Math.round(totalTimeSpent / completedActivities)
        : 0;

      // Resolver scheduleName: se a instância não tiver, buscar do template
      let scheduleName = data.scheduleName;
      if (!scheduleName && data.scheduleTemplateId) {
        try {
          const templateDoc = await db.collection('weeklySchedules').doc(data.scheduleTemplateId).get();
          scheduleName = templateDoc.data()?.name || '';
        } catch {
          scheduleName = '';
        }
      }

      try {
        await db.collection('weeklySnapshots').doc(snapshotId).set({
          scheduleInstanceId: instanceDoc.id,
          studentId,
          weekNumber: currentWeekNumber,
          scheduleName: scheduleName || '',
          weekStartDate: Timestamp.fromDate(currentWeekStartDate),
          weekEndDate: Timestamp.fromDate(currentWeekEndDate),
          isActive: true,
          metrics: {
            totalActivities,
            completedActivities,
            skippedActivities,
            completionRate,
            totalPointsEarned: totalPoints,
            averagePointsPerActivity: avgPoints,
            totalTimeSpent,
            averageTimePerActivity: avgTime,
            consistencyScore,
            adherenceScore,
            streakAtEndOfWeek,
          },
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        generatedSnapshots++;
        console.log(`📸 Snapshot ${snapshotId}: ${completedActivities}/${totalActivities} concluídas, consistência=${consistencyScore}%, adesão=${adherenceScore}%`);
      } catch (snapshotErr: any) {
        console.error(`⚠️ Erro ao gerar snapshot para ${studentId}:`, snapshotErr.message);
      }
    }

    await db.runTransaction(async (transaction) => {
      const instanceRef = db.collection('scheduleInstances').doc(instanceDoc.id);
      const instanceSnap = await transaction.get(instanceRef);
      if (!instanceSnap.exists) return;

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

    const batch = db.batch();
    let added = 0;
    let skipped = 0;

    activitiesSnap.docs.forEach(actDoc => {
      const act = actDoc.data();
      const activityDate = new Date(weekStartDate);
      const scheduleDay = ((act.dayOfWeek ?? 0) + 6) % 7;
      activityDate.setDate(weekStartDate.getDate() + scheduleDay);
      activityDate.setHours(12, 0, 0, 0);

      const progressId = `${instanceDoc.id}_w${weekNo}_${actDoc.id}`;
      if (existingIds.has(progressId)) {
        skipped++;
        return;
      }

      const convertedDayOfWeek = ((act.dayOfWeek ?? 0) + 6) % 7;

      const docRef = db.collection('activityProgress').doc(progressId);
      batch.set(docRef, {
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
      added++;
    });

    if (added > 0) {
      await batch.commit();
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

export const forceWeeklyReset = onRequest(
  { region: 'southamerica-east1', timeoutSeconds: 540 },
  async (req, res) => {
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
  }
);

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
    console.log('🚀 Iniciando triggerWeeklyReset (onRequest)');
    const result = await runWeeklyReset();
    console.log('✅ triggerWeeklyReset concluído:', result);
    res.json({ success: true, ...result });
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
          // 1. Buscar instância para scheduleName + templateId
          const instSnap = await db.collection('scheduleInstances').doc(instanceId).get();
          const instData = instSnap.exists ? instSnap.data()! : null;

          // 2. Resolver scheduleName
          let scheduleName = instData?.scheduleName || '';
          if (!scheduleName && instData?.scheduleTemplateId) {
            const templateSnap = await db.collection('weeklySchedules').doc(instData.scheduleTemplateId).get();
            scheduleName = templateSnap.data()?.name || '';
          }

          // 3. Buscar activityProgress da semana
          const weekSnap = await db
            .collection('activityProgress')
            .where('scheduleInstanceId', '==', instanceId)
            .where('weekNumber', '==', weekNumber)
            .get();

          const weekActivities = weekSnap.docs.map(d => {
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

          // 4. Calcular métricas
          const total = weekActivities.length;
          if (total === 0) {
            await snapDoc.ref.update({
              scheduleName: scheduleName || '',
              updatedAt: FieldValue.serverTimestamp(),
            });
            recalculated++;
            continue;
          }

          const completed = weekActivities.filter(a => a.status === 'completed').length;
          const skipped = weekActivities.filter(a => a.status === 'skipped').length;
          const totalPoints = weekActivities
            .filter(a => a.status === 'completed')
            .reduce((sum, a) => sum + (a.scoring?.pointsEarned || 0), 0);
          const completionRate = Math.round((completed / total) * 100);
          const totalTimeSpent = weekActivities
            .filter(a => a.status === 'completed' && a.executionData?.timeSpent)
            .reduce((sum, a) => sum + (a.executionData?.timeSpent || 0), 0);

          // Consistência
          const uniqueDays = new Set(
            weekActivities.filter(a => a.status === 'completed').map(a => a.dayOfWeek)
          ).size;
          const consistencyScore = Math.round((uniqueDays / 7) * 100);

          // Adesão
          const onTime = weekActivities.filter(a => {
            if (a.status !== 'completed' || !a.completedAt || !a.scheduledDate) return false;
            return a.completedAt.getFullYear() === a.scheduledDate.getFullYear()
              && a.completedAt.getMonth() === a.scheduledDate.getMonth()
              && a.completedAt.getDate() === a.scheduledDate.getDate();
          }).length;
          const adherenceScore = completed > 0 ? Math.round((onTime / completed) * 100) : 0;

          // Streak
          const completedDates = [
            ...new Set(
              weekActivities
                .filter(a => a.status === 'completed' && a.completedAt)
                .map(a => a.completedAt!.toISOString().split('T')[0])
            ),
          ].sort().reverse();
          let streak = 0;
          if (completedDates.length > 0) {
            streak = 1;
            for (let i = 1; i < completedDates.length; i++) {
              const diff = Math.round(
                (new Date(completedDates[i - 1]).getTime() - new Date(completedDates[i]).getTime()) / 86400000
              );
              if (diff === 1) streak++;
              else break;
            }
          }

          // 5. Atualizar snapshot
          await snapDoc.ref.set({
            scheduleName: scheduleName || '',
            metrics: {
              totalActivities: total,
              completedActivities: completed,
              skippedActivities: skipped,
              completionRate,
              totalPointsEarned: totalPoints,
              averagePointsPerActivity: completed > 0 ? Math.round(totalPoints / completed) : 0,
              totalTimeSpent,
              averageTimePerActivity: completed > 0 ? Math.round(totalTimeSpent / completed) : 0,
              consistencyScore,
              adherenceScore,
              streakAtEndOfWeek: streak,
            },
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });

          recalculated++;
          console.log(`✅ ${snapDoc.id}: ${completed}/${total} concluídas, consistência=${consistencyScore}%, adesão=${adherenceScore}%`);
        } catch (err: any) {
          errors++;
          console.error(`⚠️ Erro em ${snapDoc.id}:`, err.message);
        }
      }

      console.log(`🎉 Concluído: ${recalculated} recalculados, ${errors} erros`);

      const resetResult = await runWeeklyReset();

      res.json({
        success: true,
        snapshotsRecalculados: recalculated,
        erros: errors,
        resetSemanal: resetResult,
      });
    } catch (error: any) {
      console.error('❌ Erro no backfillSnapshots:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

