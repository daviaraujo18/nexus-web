// lib/services/ProgressService.ts

import {
  doc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  increment,
  arrayUnion,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  runTransaction
} from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import {
  ActivityProgress,
  ProgressStatus,
  ActivityType
} from '@/types/schedule';
import { ScheduleInstanceService } from './ScheduleInstanceService';
import { AuditService } from '@/lib/auth/AuditService';
import { DateUtils } from '@/lib/utils/dateUtils';

interface CompletionData {
  timeSpent?: number; // em minutos
  submission?: any;
  emotionalState?: {
    before?: number;
    after?: number;
  };
  notes?: string;
  attachments?: string[];
}


// * Serviço central responsável por gerenciar o ciclo de vida do progresso das atividades do aluno.
// *
// * Responsabilidades:
// * - Controlar estados da atividade (pending → in_progress → completed / skipped)
// * - Persistir execução (executionData)
// * - Calcular pontuação e tempo gasto
// * - Atualizar métricas derivadas (snapshot semanal, stats do aluno, cache de instância)
// *
// * ⚠️ IMPORTANTE:
// * Este serviço escreve em múltiplas coleções (activityProgress, students, weeklySnapshots),
// * portanto qualquer alteração aqui impacta:
// * - dashboards
// * - analytics
// * - ranking de bem-estar
// * - progressão do aluno
export class ProgressService {
  private static readonly COLLECTIONS = {
    PROGRESS: 'activityProgress',
    STUDENTS: 'students'
  };

  // * Inicia uma atividade marcando como "in_progress".
  // *
  // * Fluxo:
  // * 1. Busca o progresso atual
  // * 2. Valida que ainda está "pending"
  // * 3. Atualiza Firestore
  // * 4. Retorna versão atualizada (otimista)
  // *
  // * Regra de negócio:
  // * - Uma atividade NÃO pode ser iniciada duas vezes
  // *
  // * ⚠️ Risco:
  // * - Não usa transação → se duas chamadas simultâneas ocorrerem,
  // * pode haver corrida de estado (race condition leve)
  static async startActivity(
    progressId: string,
    studentId: string
  ): Promise<ActivityProgress> { // ← Mudar retorno para ActivityProgress
    try {
      console.log('🚀 Iniciando atividade:', { progressId, studentId });

      // 1. Buscar e validar progresso
      const progress = await this.getActivityProgress(progressId, studentId);

      console.log('📋 Progresso encontrado:', {
        id: progress.id,
        currentStatus: progress.status,
        scheduledDate: progress.scheduledDate
      });

      // 2. Validar se pode iniciar
      if (progress.status !== 'pending') {
        throw new Error(`Atividade já está ${progress.status}`);
      }

      // 3. Atualizar status
      const now = new Date();
      const progressRef = doc(firestore, this.COLLECTIONS.PROGRESS, progressId);

      await updateDoc(progressRef, {
        status: 'in_progress',
        startedAt: Timestamp.fromDate(now),
        updatedAt: serverTimestamp()
      });

      console.log(`✅ Atividade ${progressId} iniciada com sucesso`);

      // 4. Retornar progresso atualizado
      return {
        ...progress,
        status: 'in_progress',
        startedAt: now,
        updatedAt: now
      };

    } catch (error: any) {
      console.error('❌ Erro ao iniciar atividade:', error);
      throw error;
    }
  }

  // * Conclui uma atividade e dispara toda a cascata de efeitos do sistema.
  // *
  // * Ordem de execução:
  // * 1. Valida status atual
  // * 2. Calcula pontuação
  // * 3. Calcula tempo gasto
  // * 4. Atualiza documento principal (activityProgress)
  // * 5. Atualiza snapshot semanal
  // * 6. Atualiza cache da instância
  // * 7. Atualiza estatísticas do aluno
  // *
  // * Side effects:
  // * - Escrita em múltiplas coleções
  // * - Atualização indireta de dashboards e analytics
  // *
  // * ⚠️ DECISÃO IMPORTANTE:
  // * A escrita principal (updateDoc do progress) acontece ANTES dos efeitos secundários.
  // * Isso garante que a atividade nunca fique "não concluída" por falha em sistemas auxiliares.
  // *
  // * ⚠️ Risco:
  // * - Falhas em snapshot/cache/stats não são rollbackadas
  // * - Pode haver inconsistência temporária entre coleções
  static async completeActivity(
    progressId: string,
    studentId: string,
    completionData: CompletionData = {}
  ): Promise<{
    pointsEarned: number;
    bonusPoints: number;
    totalPoints: number;
  }> {
    try {
      console.log('✅ Iniciando completeActivity:', { progressId, studentId });

      // 1. Buscar progresso atual para validar
      const progress = await this.getActivityProgress(progressId, studentId);

      if (progress.status !== 'in_progress') {
        throw new Error(`Atividade não está em progresso (status: ${progress.status})`);
      }

      // 2. Calcular pontuação PRIMEIRO
      const scoring = await this.calculateScoring(progressId, completionData);

      console.log('📊 Pontuação calculada:', scoring);

      // * Determina o tempo gasto na atividade.
      // *
      // * Prioridade:
      // * 1. Usa valor enviado pelo front (mais confiável)
      // * 2. Se não existir, calcula com base em startedAt
      // * 3. Se falhar, usa fallback (30 minutos)
      // *
      // * ⚠️ Risco:
      // * - Diferença baseada no clock do cliente → pode gerar inconsistência leve
      let timeSpentValue = completionData.timeSpent;

      // Se não veio no completionData, calcular
      if (!timeSpentValue && progress.startedAt) {
        const startedAt = progress.startedAt;
        const now = new Date();
        const diffMs = now.getTime() - startedAt.getTime();
        timeSpentValue = Math.floor(diffMs / (1000 * 60)); // minutos
      }

      // Valor padrão se ainda não tiver
      timeSpentValue = timeSpentValue || 30;

      console.log('⏱️ Tempo gasto:', timeSpentValue, 'minutos');

      const now = new Date();
      const progressRef = doc(firestore, this.COLLECTIONS.PROGRESS, progressId);

      // 4. Preparar dados para atualização
      const updateData: any = {
        status: 'completed',
        completedAt: Timestamp.fromDate(now),
        scoring: {
          pointsEarned: scoring.pointsEarned,
          bonusPoints: scoring.bonusPoints,
          penaltyPoints: scoring.penaltyPoints || 0
        },
        updatedAt: serverTimestamp()
      };

      // 5. Adicionar executionData APENAS com dados válidos
      const executionDataUpdate: any = {
        timeSpent: timeSpentValue, // ← NÚMERO, não Promise!
        ...completionData
      };

      // * Limpeza defensiva do executionData antes de persistir.
      // *
      // * Motivo:
      // * Firestore NÃO aceita Promise como valor.
      // *
      // * ⚠️ Risco:
      // * - Se não fizer isso, o updateDoc pode falhar silenciosamente
      // * - Pode quebrar o fluxo de submissão da atividade
      // * - Pode gerar dados inconsistentes no banco
      Object.keys(executionDataUpdate).forEach(key => {
        if (executionDataUpdate[key] instanceof Promise) {
          console.warn('⚠️ Removendo Promise do executionData:', key);
          delete executionDataUpdate[key];
        }
      });

      updateData.executionData = executionDataUpdate;

      // 6. Atualizar no Firestore
      await updateDoc(progressRef, updateData);

      console.log(`✅ Atividade ${progressId} completada com sucesso`);

      // 🔥 FIX: ATUALIZAR WEEKLY SNAPSHOT
      const instanceId = progress.scheduleInstanceId;
      const sideEffectResults = await Promise.allSettled([
        this.updateWeeklySnapshot(
          studentId,
          progress.weekNumber || 1,
          scoring.totalPoints,
          timeSpentValue,
          instanceId
        ),
        instanceId
          ? ScheduleInstanceService.updateProgressCache(instanceId, progress.weekNumber || 1)
          : Promise.resolve(),
        this.updateStudentStats(studentId, scoring.totalPoints),
      ]);
      const sideEffectLabels = ['snapshot', 'cache', 'stats'];
      sideEffectResults.forEach((r, i) => {
        if (r.status === 'rejected') {
          console.warn(`⚠️ Erro ao atualizar ${sideEffectLabels[i]} (não crítico):`, r.reason);
        }
      });

      return scoring;

    } catch (error: any) {
      console.error('❌ Erro ao completar atividade:', error);
      throw error;
    }
  }

  /**
   * Pula uma atividade
   */
  static async skipActivity(
    progressId: string,
    studentId: string,
    reason?: string
  ): Promise<void> {
    try {
      await updateDoc(doc(firestore, this.COLLECTIONS.PROGRESS, progressId), {
        status: 'skipped',
        'executionData.skippedReason': reason || 'Skipped by student',
        'executionData.skippedAt': serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // COMENTADO
      // await AuditService.logEvent(studentId, 'ACTIVITY_SKIPPED', {
      //   progressId,
      //   reason
      // });

    } catch (error: any) {
      console.error('Erro ao pular atividade:', error);
      throw error;
    }
  }

  /**
   * Salva rascunho/progresso parcial
   */
  static async saveDraft(
    progressId: string,
    draftData: any
  ): Promise<void> {
    try {
      await updateDoc(doc(firestore, this.COLLECTIONS.PROGRESS, progressId), {
        executionData: {
          ...draftData,
          lastSavedAt: new Date()
        },
        updatedAt: serverTimestamp()
      });

    } catch (error: any) {
      console.error('Erro ao salvar rascunho:', error);
      throw error;
    }
  }

  /**
   * Submete resposta de quiz
   */
  static async submitQuizAnswers(
    progressId: string,
    studentId: string,
    answers: Record<string, any>,
    attemptNumber: number = 1
  ): Promise<{
    score: number;
    totalQuestions: number;
    correctAnswers: number;
    passed: boolean;
  }> {
    try {
      // Buscar atividade para validar respostas
      const progressRef = doc(firestore, this.COLLECTIONS.PROGRESS, progressId);

      // Em produção, isso buscaria a atividade e validaria as respostas
      // Por enquanto, simular pontuação
      const score = Math.floor(Math.random() * 100); // Simulação
      const totalQuestions = Object.keys(answers).length;
      const correctAnswers = Math.floor(totalQuestions * (score / 100));

      const quizConfig = {} as any; // Seria buscado do activitySnapshot
      const passingScore = quizConfig.passingScore || 70;
      const passed = score >= passingScore;

      // Registrar tentativa
      await updateDoc(progressRef, {
        'executionData.attempts': arrayUnion({
          attemptNumber,
          startedAt: new Date(),
          completedAt: new Date(),
          score,
          answers
        }),
        updatedAt: serverTimestamp()
      });

      // Se passou, completar atividade
      if (passed) {
        await this.completeActivity(progressId, studentId, {
          submission: { answers, score }
        });
      }

      return {
        score,
        totalQuestions,
        correctAnswers,
        passed
      };

    } catch (error: any) {
      console.error('Erro ao submeter quiz:', error);
      throw error;
    }
  }

  // * Calcula a pontuação da atividade.
  // *
  // * Estrutura atual:
  // * - Pontos base fixos
  // * - Bônus por tempo
  // * - Bônus emocional
  // *
  // * ⚠️ IMPORTANTE:
  // * Hoje é uma lógica simplificada.
  // * Em produção ideal:
  // * - deve vir do activitySnapshot
  // * - deve ser configurável por tipo de atividade
  // *
  // * Impacto:
  // * - afeta nível do aluno
  // * - afeta ranking
  // * - afeta analytics
  private static async calculateScoring(
    progressId: string,
    completionData: CompletionData
  ): Promise<{
    pointsEarned: number;
    bonusPoints: number;
    penaltyPoints: number;
    totalPoints: number;
  }> {
    try {
      // Em produção, buscaria a atividade e aplicaria regras de pontuação
      // Por enquanto, lógica básica
      const basePoints = 10; // Seria do activitySnapshot
      let bonusPoints = 0;
      let penaltyPoints = 0;

      // Bônus por completar antes do prazo
      if (completionData.timeSpent) {
        // Se completou em menos tempo que o estimado
        const estimatedTime = 30; // Seria do activitySnapshot
        if (completionData.timeSpent < estimatedTime) {
          bonusPoints += 2;
        }
      }

      // Bônus por estado emocional positivo
      if (completionData.emotionalState?.after) {
        if (completionData.emotionalState.after >= 4) { // Escala 1-5
          bonusPoints += 1;
        }
      }

      const totalPoints = basePoints + bonusPoints - penaltyPoints;

      return {
        pointsEarned: basePoints,
        bonusPoints,
        penaltyPoints,
        totalPoints
      };

    } catch (error) {
      console.error('Erro ao calcular pontuação:', error);
      return {
        pointsEarned: 10,
        bonusPoints: 0,
        penaltyPoints: 0,
        totalPoints: 10
      };
    }
  }

  private static async calculateTimeSpent(progressId: string): Promise<number> {
    try {
      const progressRef = doc(firestore, this.COLLECTIONS.PROGRESS, progressId);
      const progressDoc = await getDoc(progressRef);

      if (!progressDoc.exists()) {
        console.warn('Progresso não encontrado para calcular tempo:', progressId);
        return 0;
      }

      const data = progressDoc.data();
      const startedAt = data.startedAt?.toDate();

      if (!startedAt) {
        console.warn('Atividade não tem startedAt:', progressId);
        return 0;
      }

      // Calcular diferença em minutos
      const now = new Date();
      const diffInMs = now.getTime() - startedAt.getTime();
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

      // Garantir valor mínimo e máximo razoável
      return Math.max(1, Math.min(diffInMinutes, 240)); // 1-240 minutos

    } catch (error) {
      console.error('Erro ao calcular tempo gasto:', error);
      return 0;
    }
  }

  // * Atualiza métricas permanentes do aluno.
  // *
  // * Atualiza:
  // * - totalPoints (incremental)
  // * - level (derivado)
  // * - streak (condicional)
  // * - lastActivityAt
  // *
  // * Regra de streak:
  // * - Só incrementa se ainda não houve atividade hoje
  // *
  // * ⚠️ Risco técnico:
  // * - level é calculado fora de transação
  // * - em caso de concorrência, pode ficar inconsistente momentaneamente
  // *
  // * Melhor abordagem futura:
  // * - usar transaction()
  private static async updateStudentStats(studentId: string, points: number): Promise<void> {
    console.log('[updateStudentStats] Iniciando atualização:', { studentId, points });

    const studentRef = doc(firestore, this.COLLECTIONS.STUDENTS, studentId);
    const safePoints = Number(points) || 0;

    await runTransaction(firestore, async (transaction) => {
      const snap = await transaction.get(studentRef);
      if (!snap.exists()) {
        throw new Error(`[updateStudentStats] Documento students/${studentId} não encontrado`);
      }

      const profile = snap.data()?.profile ?? {};
      const currentPoints: number = profile.totalPoints ?? 0;
      const newTotalPoints = currentPoints + safePoints;
      const newLevel = Math.floor(newTotalPoints / 200) + 1;

      const lastActivityRaw = profile.lastActivityAt;
      const lastActivityAt: Date | undefined =
        lastActivityRaw?.toDate?.() instanceof Date
          ? lastActivityRaw.toDate()
          : lastActivityRaw instanceof Date
          ? lastActivityRaw
          : undefined;

      const today = new Date();
      const alreadyActiveToday =
        lastActivityAt != null &&
        lastActivityAt.getFullYear() === today.getFullYear() &&
        lastActivityAt.getMonth() === today.getMonth() &&
        lastActivityAt.getDate() === today.getDate();

      // serverTimestamp() é sentinel processado pós-commit — não pode ser relido dentro desta transação
      const updatePayload: Record<string, unknown> = {
        'profile.totalPoints': newTotalPoints,
        'profile.level': newLevel,
        'profile.lastActivityAt': serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (!alreadyActiveToday) {
        const currentStreak: number = profile.streak ?? 0;
        updatePayload['profile.streak'] = currentStreak + 1;
      }

      console.log('[updateStudentStats] Gravando:', { newTotalPoints, newLevel, streakIncrement: !alreadyActiveToday });

      transaction.update(studentRef, updatePayload);
    });

    console.log('[updateStudentStats] ✅ Concluído com sucesso');
  }

  /**
  * Atualiza ou cria snapshot semanal do aluno.
  *
  * Estratégia:
  * - ID determinístico (studentId + weekNumber)
  * - Evita duplicidade de documentos
  *
  * Dois cenários:
  * 1. Snapshot existe → incrementa métricas
  * 2. Snapshot não existe → cria documento base
  *
  * ⚠️ Riscos:
  * - totalActivities é fixo (5) → pode não refletir realidade
  * - completionRate depende desse valor
  * - múltiplas atualizações podem gerar race condition leve
  */
  private static async updateWeeklySnapshot(
    studentId: string,
    weekNumber: number,
    pointsEarned: number,
    timeSpent: number,
    scheduleInstanceId?: string
  ): Promise<void> {
    try {
      // Busca o total real de atividades da semana quando instanceId está disponível
      let realTotalActivities = 0;
      if (scheduleInstanceId) {
        const countQ = query(
          collection(firestore, 'activityProgress'),
          where('scheduleInstanceId', '==', scheduleInstanceId),
          where('weekNumber', '==', weekNumber),
          where('isActive', '==', true)
        );
        const countSnap = await getDocs(countQ);
        realTotalActivities = countSnap.size;
      }

      const snapshotId = `${studentId}_week_${weekNumber}`;
      const snapshotRef = doc(firestore, 'weeklySnapshots', snapshotId);
      const snapDoc = await getDoc(snapshotRef);

      if (snapDoc.exists()) {
        const data = snapDoc.data();
        const totalForRate = realTotalActivities > 0
          ? realTotalActivities
          : (data.metrics?.totalActivities || 1);
        const newCompleted = (data.metrics?.completedActivities || 0) + 1;
        const newRate = Math.round((newCompleted / totalForRate) * 100);

        await updateDoc(snapshotRef, {
          'metrics.completedActivities': increment(1),
          'metrics.totalPointsEarned': increment(pointsEarned),
          'metrics.totalTimeSpent': increment(timeSpent),
          'metrics.completionRate': newRate,
          ...(realTotalActivities > 0 && { 'metrics.totalActivities': realTotalActivities }),
          updatedAt: serverTimestamp()
        });
      } else {
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Segunda-feira
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6); // Domingo

        const totalForSnapshot = realTotalActivities > 0 ? realTotalActivities : 1;

        await setDoc(snapshotRef, {
          studentId,
          weekNumber,
          weekStartDate: Timestamp.fromDate(startOfWeek),
          weekEndDate: Timestamp.fromDate(endOfWeek),
          metrics: {
            completedActivities: 1,
            totalPointsEarned: pointsEarned,
            totalTimeSpent: timeSpent,
            totalActivities: totalForSnapshot,
            completionRate: Math.round((1 / totalForSnapshot) * 100),
            streakAtEndOfWeek: 1,
            adherenceScore: 100,
            consistencyScore: 100
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      console.log(`✅ WeeklySnapshot atualizado para a semana ${weekNumber} (total=${realTotalActivities})`);
    } catch (error) {
      console.error('Erro detalhado no updateWeeklySnapshot:', error);
      throw error;
    }
  }

  // * Busca e normaliza dados de progresso.
  static async getActivityProgress(
    progressId: string,
    studentId: string
  ): Promise<ActivityProgress> {
    try {
      const progressRef = doc(firestore, this.COLLECTIONS.PROGRESS, progressId);
      const progressDoc = await getDoc(progressRef);

      if (!progressDoc.exists()) {
        throw new Error('Atividade não encontrada');
      }

      const data = progressDoc.data();

      if (data.studentId !== studentId) {
        throw new Error('Sem permissão para acessar esta atividade');
      }

      return {
        id: progressDoc.id,
        ...data,
        scheduledDate: data.scheduledDate?.toDate(),
        startedAt: data.startedAt?.toDate(),
        completedAt: data.completedAt?.toDate(),
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
        activitySnapshot: {
          ...data.activitySnapshot,
          createdAt: data.activitySnapshot?.createdAt?.toDate(),
          updatedAt: data.activitySnapshot?.updatedAt?.toDate()
        }
      } as ActivityProgress;

    } catch (error: any) {
      console.error('Erro ao buscar progresso:', error);
      throw error;
    }
  }

  /**
   * Valida se atividade pode ser iniciada/completada
   */
  static async validateActivityAccess(
    progressId: string,
    studentId: string
  ): Promise<{
    canAccess: boolean;
    reason?: string;
    activity?: ActivityProgress;
  }> {
    try {
      const progressRef = doc(firestore, this.COLLECTIONS.PROGRESS, progressId);
      const progressDoc = await getDoc(progressRef);

      if (!progressDoc.exists()) {
        return { canAccess: false, reason: 'Atividade não encontrada' };
      }

      const data = progressDoc.data();

      if (data.studentId !== studentId) {
        return { canAccess: false, reason: 'Sem permissão para acessar esta atividade' };
      }

      if (data.isActive === false || data.isDeleted === true) {
        return { canAccess: false, reason: 'Atividade inativa ou removida' };
      }

      const activity: ActivityProgress = {
        id: progressDoc.id,
        ...data,
        scheduledDate: data.scheduledDate?.toDate(),
        startedAt: data.startedAt?.toDate(),
        completedAt: data.completedAt?.toDate(),
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
        activitySnapshot: {
          ...data.activitySnapshot,
          createdAt: data.activitySnapshot?.createdAt?.toDate(),
          updatedAt: data.activitySnapshot?.updatedAt?.toDate()
        }
      } as ActivityProgress;

      return { canAccess: true, activity };

    } catch (error) {
      return { canAccess: false, reason: 'Erro ao validar acesso' };
    }
  }

  /**
 * Busca atividades por semana e dia da semana
 */
  static async getActivitiesByWeekAndDay(
    studentId: string,
    scheduleInstanceId: string,
    weekNumber: number,
    dayOfWeek: number
  ): Promise<ActivityProgress[]> {
    try {
      console.log('🔍 [getActivitiesByWeekAndDay] Buscando atividades:', {
        studentId,
        scheduleInstanceId,
        weekNumber,
        dayOfWeek
      });

      // Importar funções do Firestore necessárias
      const { collection, query, where, getDocs } = await import('firebase/firestore');

      // Criar query para buscar atividades específicas
      const q = query(
        collection(firestore, this.COLLECTIONS.PROGRESS),
        where('studentId', '==', studentId),
        where('scheduleInstanceId', '==', scheduleInstanceId),
        where('weekNumber', '==', weekNumber),
        where('dayOfWeek', '==', dayOfWeek),
        where('isActive', '==', true)
      );

      const snapshot = await getDocs(q);
      const activities: ActivityProgress[] = [];

      snapshot.forEach(doc => {
        const data = doc.data();

        // Converter timestamps do Firestore para Date
        const activity: ActivityProgress = {
          id: doc.id,
          ...data,
          scheduledDate: data.scheduledDate?.toDate(),
          startedAt: data.startedAt?.toDate(),
          completedAt: data.completedAt?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          activitySnapshot: {
            ...data.activitySnapshot,
            createdAt: data.activitySnapshot?.createdAt?.toDate(),
            updatedAt: data.activitySnapshot?.updatedAt?.toDate()
          }
        } as ActivityProgress;

        activities.push(activity);
      });

      console.log(`✅ [getActivitiesByWeekAndDay] Encontradas ${activities.length} atividades`);

      // Log detalhado para debug
      activities.forEach((activity, index) => {
        console.log(`  ${index + 1}. ${activity.activitySnapshot?.title || 'Sem título'} (${activity.status})`);
      });

      return activities;

    } catch (error: any) {
      console.error('❌ [getActivitiesByWeekAndDay] Erro:', error);
      throw new Error(`Erro ao buscar atividades: ${error.message}`);
    }
  }

  // * Recalcula métricas do aluno com base no histórico completo.
  // *
  // * Uso:
  // * - correção de dados
  // * - auditoria
  // * - migração de lógica
  // *
  // * Estratégia:
  // * - percorre TODOS os activityProgress
  // * - recalcula pontos e atividades concluídas
  // *
  // * Prioridade de pontuação:
  // * 1. scoring.pointsEarned
  // * 2. snapshot.pointsOnCompletion
  // * 3. fallback = 0
  // *
  // * ⚠️ Risco:
  // * - operação pesada (scan completo)
  // * - não deve ser usada em tempo real
  // *
  // * Segurança:
  // * - dryRun evita escrita
  static async recalculateStudentPermanentMetrics(
    studentId: string,
    options: { dryRun?: boolean } = {}
  ): Promise<{
    studentId: string;
    totalActivityProgress: number;
    totalCompletedActivities: number;
    totalPoints: number;
    level: number;
    dryRun: boolean;
  }> {
    const { dryRun = false } = options;

    console.group(`[recalculate] studentId=${studentId} dryRun=${dryRun}`);

    // 1. Buscar TODOS os activityProgress do aluno (sem filtro de isActive)
    const q = query(
      collection(firestore, this.COLLECTIONS.PROGRESS),
      where('studentId', '==', studentId)
    );
    const snap = await getDocs(q);
    console.log(`[recalculate] Documentos encontrados: ${snap.size}`);

    let totalPoints = 0;
    let totalCompletedActivities = 0;
    const examples: string[] = [];

    snap.forEach((d) => {
      const data = d.data();
      const isCompleted = data.status === 'completed';

      // Calcular pontos desta atividade
      const earnedFromScoring = Number(data.scoring?.pointsEarned ?? 0);
      const earnedFromSnapshot = Number(
        data.activitySnapshot?.scoring?.pointsOnCompletion ?? 0
      );

      let points = 0;
      if (earnedFromScoring > 0) {
        points = earnedFromScoring;
      } else if (isCompleted && earnedFromSnapshot > 0) {
        points = earnedFromSnapshot;
      } else if (isCompleted) {
        points = 0; // completada sem pontuação registrada
      }

      if (isCompleted) {
        totalCompletedActivities += 1;
        totalPoints += points;
      }

      if (examples.length < 5) {
        examples.push(
          `  [${data.status}] "${data.activitySnapshot?.title ?? d.id}" → scoring.pointsEarned=${earnedFromScoring} | snapshot.pointsOnCompletion=${earnedFromSnapshot} → usado=${points}`
        );
      }
    });

    const level = Math.floor(totalPoints / 200) + 1;

    console.log(`[recalculate] totalActivityProgress : ${snap.size}`);
    console.log(`[recalculate] totalCompletedActivities: ${totalCompletedActivities}`);
    console.log(`[recalculate] totalPoints             : ${totalPoints}`);
    console.log(`[recalculate] level                   : ${level}`);
    console.log('[recalculate] Exemplos (primeiros 5):');
    examples.forEach((e) => console.log(e));

    if (!dryRun) {
      const studentRef = doc(firestore, this.COLLECTIONS.STUDENTS, studentId);
      await updateDoc(studentRef, {
        'profile.totalPoints': totalPoints,
        'profile.level': level,
        'profile.totalCompletedActivities': totalCompletedActivities,
        'profile.lastMetricsRecalculatedAt': serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log('[recalculate] ✅ Escrito no Firestore com sucesso');
    } else {
      console.log('[recalculate] ⚠️  dryRun=true — nada foi escrito no Firestore');
    }

    console.groupEnd();

    return {
      studentId,
      totalActivityProgress: snap.size,
      totalCompletedActivities,
      totalPoints,
      level,
      dryRun,
    };
  }
}