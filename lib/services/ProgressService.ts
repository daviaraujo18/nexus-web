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
import { calculateLevel, calculateStreak } from '@/lib/utils/levelUtils';

interface CompletionData {
  timeSpent?: number; // em minutos
  estimatedDuration?: number; // em minutos
  submission?: any;
  emotionalState?: {
    before?: number;
    after?: number;
  };
  notes?: string;
  attachments?: string[];
}

interface TxExtractedData {
  instanceId: string | undefined;
  weekNumber: number;
  startedAtMs: number | null;
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

const DEBUG = process.env.NEXT_PUBLIC_ENABLE_DEBUG === 'true';

function debugLog(...args: any[]) {
  if (DEBUG) console.log(...args);
}
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
  ): Promise<ActivityProgress> {
    try {
      const now = new Date();
      const progressRef = doc(firestore, this.COLLECTIONS.PROGRESS, progressId);
      let rawData: any;

      await runTransaction(firestore, async (tx) => {
        const snap = await tx.get(progressRef);
        if (!snap.exists()) throw new Error('Atividade não encontrada');
        rawData = snap.data();
        if (rawData.studentId !== studentId) throw new Error('Sem permissão para acessar esta atividade');
        if (rawData.status !== 'pending') throw new Error(`Atividade já está ${rawData.status}`);
        tx.update(progressRef, {
          status: 'in_progress',
          startedAt: Timestamp.fromDate(now),
          updatedAt: serverTimestamp()
        });
      });

      return {
        id: progressId,
        ...rawData,
        scheduledDate: rawData.scheduledDate?.toDate?.(),
        startedAt: now,
        completedAt: rawData.completedAt?.toDate?.(),
        status: 'in_progress',
        updatedAt: now
      } as ActivityProgress;

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
  // * Efeitos colaterais:
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
      const progressRef = doc(firestore, this.COLLECTIONS.PROGRESS, progressId);

      const timeSpentFromForm = completionData.timeSpent;
      const now = new Date();

      // Validacao de entrada
      if (timeSpentFromForm !== undefined) {
        if (typeof timeSpentFromForm !== 'number' || isNaN(timeSpentFromForm) || timeSpentFromForm < 0 || timeSpentFromForm > 1440) {
          throw new Error(`timeSpent invalido: ${timeSpentFromForm}. Deve ser um numero entre 0 e 1440 minutos.`);
        }
      }
      if (completionData.emotionalState) {
        if (completionData.emotionalState.before !== undefined) {
          if (typeof completionData.emotionalState.before !== 'number' || completionData.emotionalState.before < 1 || completionData.emotionalState.before > 5) {
            throw new Error(`emotionalState.before invalido: ${completionData.emotionalState.before}. Deve ser 1-5.`);
          }
        }
        if (completionData.emotionalState.after !== undefined) {
          if (typeof completionData.emotionalState.after !== 'number' || completionData.emotionalState.after < 1 || completionData.emotionalState.after > 5) {
            throw new Error(`emotionalState.after invalido: ${completionData.emotionalState.after}. Deve ser 1-5.`);
          }
        }
      }
      if (completionData.submission !== undefined && completionData.submission !== null) {
        if (typeof completionData.submission !== 'object') {
          throw new Error('submission invalido: deve ser um objeto');
        }
        try {
          JSON.stringify(completionData.submission);
        } catch {
          throw new Error('submission invalido: contem referencia circular');
        }
      }

      // Calcular timeSpent e scoring primeiro — operações puramente locais, sem I/O
      const timeSpentValue = timeSpentFromForm !== undefined
        ? timeSpentFromForm
        : 30;

      const scoring = await this.calculateScoring(progressId, { ...completionData, timeSpent: timeSpentValue });

      // Construir executionData (pular Promises que o Firestore não aceita)
      const executionDataEntries = Object.entries({ ...completionData, timeSpent: timeSpentValue })
        .filter(([, v]) => !(v instanceof Promise));

      // Transaction: valida ownership + status, atualiza status + scoring + executionData atômicamente
      const txData: TxExtractedData = await runTransaction(firestore, async (tx) => {
        const snap = await tx.get(progressRef);
        if (!snap.exists()) throw new Error('Atividade não encontrada');
        const d = snap.data();
        if (d.studentId !== studentId) throw new Error('Sem permissão para acessar esta atividade');
        if (d.status !== 'in_progress') {
          throw new Error(`Atividade já foi processada (status: ${d.status})`);
        }

        const extractedInstanceId = d.scheduleInstanceId;
        const extractedWeekNumber = (typeof d.weekNumber === 'number' && d.weekNumber > 0)
          ? d.weekNumber
          : (() => {
              const derived = DateUtils.getWeekNumber(d.scheduledDate?.toDate?.() ?? new Date());
              console.warn(
                `⚠️ [weekNumber] progressId=${progressId} weekNumber=${d.weekNumber} inválido — derivando ${derived} da scheduledDate`,
              );
              return derived;
            })();
        const extractedStartedAt = d.startedAt
          ? (d.startedAt?.toDate?.() ?? new Date(d.startedAt))
          : null;

        const updateFields: Record<string, unknown> = {
          status: 'completed',
          completedAt: Timestamp.fromDate(now),
          scoring: {
            pointsEarned: scoring.pointsEarned,
            bonusPoints: scoring.bonusPoints,
            penaltyPoints: scoring.penaltyPoints || 0
          },
          updatedAt: serverTimestamp()
        };
        for (const [key, value] of executionDataEntries) {
          updateFields[`executionData.${key}`] = value;
        }
        tx.update(progressRef, updateFields);

        return {
          instanceId: extractedInstanceId,
          weekNumber: extractedWeekNumber,
          startedAtMs: extractedStartedAt instanceof Date ? extractedStartedAt.getTime() : null
        } as TxExtractedData;
      });

      // Passo 1: recalcular progressCache da instância (com métricas reais de consistência/adesão)
      // Executa ANTES do snapshot para que a transaction do updateWeeklySnapshot leia dados frescos
      if (txData.instanceId) {
        try {
          await ScheduleInstanceService.updateProgressCache(txData.instanceId, txData.weekNumber);
        } catch (err) {
          console.warn('⚠️ Erro ao recalcular progressCache (não crítico):', err);
        }
      }

      // Passo 2: atualizar snapshot e stats do aluno
      const sideEffectResults = await Promise.allSettled([
        this.updateWeeklySnapshot(
          studentId,
          txData.weekNumber,
          scoring.totalPoints,
          timeSpentValue,
          txData.instanceId
        ),
        this.updateStudentStats(studentId, scoring.totalPoints),
      ]);
      const sideEffectLabels = ['snapshot', 'stats'];
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
      const progressRef = doc(firestore, this.COLLECTIONS.PROGRESS, progressId);
      await runTransaction(firestore, async (tx) => {
        const snap = await tx.get(progressRef);
        if (!snap.exists()) throw new Error('Atividade não encontrada');
        const d = snap.data();
        if (d.studentId !== studentId) throw new Error('Sem permissão para acessar esta atividade');
        if (d.status === 'completed' || d.status === 'skipped') {
          throw new Error(`Não é possível pular atividade com status '${d.status}'`);
        }
        tx.update(progressRef, {
          status: 'skipped',
          'executionData.skippedReason': reason || 'Skipped by student',
          'executionData.skippedAt': serverTimestamp(),
          updatedAt: serverTimestamp()
        });
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
    studentId: string,
    draftData: any
  ): Promise<void> {
    try {
      const progressRef = doc(firestore, this.COLLECTIONS.PROGRESS, progressId);
      await runTransaction(firestore, async (tx) => {
        const snap = await tx.get(progressRef);
        if (!snap.exists()) throw new Error('Atividade não encontrada');
        const d = snap.data();
        if (d.studentId !== studentId) throw new Error('Sem permissão');
        if (d.status === 'completed' || d.status === 'skipped') {
          throw new Error(`Não é possível salvar rascunho de atividade com status '${d.status}'`);
        }
        tx.update(progressRef, {
          'executionData.draft': draftData,
          updatedAt: serverTimestamp()
        });
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
    // TODO: implementar validação real de respostas contra activitySnapshot.quizConfig
    // Ao implementar: buscar quizConfig do activitySnapshot, calcular score real,
    // registrar tentativa com arrayUnion e chamar completeActivity se passou.
    throw new Error('submitQuizAnswers não implementado. Implemente validação real antes de habilitar.');
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
      if (completionData.timeSpent !== undefined) {
        const estimatedTime = completionData.estimatedDuration || 30;
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
      throw error;
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
    debugLog('[updateStudentStats] Iniciando atualização:', { studentId, points });

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
      const newLevel = calculateLevel(newTotalPoints);

      const lastActivityRaw = profile.lastActivityAt;
      const lastActivityAt: Date | undefined =
        lastActivityRaw?.toDate?.() instanceof Date
          ? lastActivityRaw.toDate()
          : lastActivityRaw instanceof Date
          ? lastActivityRaw
          : undefined;

      const today = new Date();
      const isSameLocalDay = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
      const alreadyActiveToday = lastActivityAt != null && isSameLocalDay(lastActivityAt, today);

      const updatePayload: Record<string, unknown> = {
        'profile.totalPoints': newTotalPoints,
        'profile.level': newLevel,
        'profile.lastActivityAt': Timestamp.fromDate(today),
        updatedAt: serverTimestamp(),
      };

      if (!alreadyActiveToday) {
        const currentStreak: number = profile.streak ?? 0;
        updatePayload['profile.streak'] = currentStreak + 1;
      }

      debugLog('[updateStudentStats] Gravando:', { newTotalPoints, newLevel, streakIncrement: !alreadyActiveToday });

      transaction.update(studentRef, updatePayload);
    });

    debugLog('[updateStudentStats] ✅ Concluído com sucesso');
  }

  /**
   * Atualiza progressCache da instância de forma INCREMENTAL (evita rescan completo).
   * Lê o cache atual, incrementa counters e salva.
   */
  private static async incrementProgressCache(instanceId: string, pointsEarned: number): Promise<void> {
    try {
      const instanceRef = doc(firestore, 'scheduleInstances', instanceId);
      await runTransaction(firestore, async (transaction) => {
        const snap = await transaction.get(instanceRef);
        if (!snap.exists()) return;
        const cache = snap.data()?.progressCache ?? {};
        const newCompleted = (cache.completedActivities ?? 0) + 1;
        const total = cache.totalActivities ?? 0;
        transaction.update(instanceRef, {
          'progressCache.completedActivities': increment(1),
          'progressCache.totalPointsEarned': increment(pointsEarned),
          'progressCache.completionPercentage': total > 0 ? Math.round((newCompleted / total) * 100) : 0,
          'progressCache.lastUpdatedAt': serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });
    } catch (error) {
      console.warn(`⚠️ Erro ao incrementar progressCache para ${instanceId}:`, error);
    }
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
      const snapshotId = scheduleInstanceId
        ? `${studentId}_${scheduleInstanceId}_week_${weekNumber}`
        : `${studentId}_week_${weekNumber}`;
      const snapshotRef = doc(firestore, 'weeklySnapshots', snapshotId);

      // Transaction: lê instância e snapshot atomicamente — datas e totalActivities nunca usam valor stale
      await runTransaction(firestore, async (tx) => {
        const [snapDoc, instDoc] = await Promise.all([
          tx.get(snapshotRef),
          scheduleInstanceId ? tx.get(doc(firestore, 'scheduleInstances', scheduleInstanceId)) : Promise.resolve(null)
        ]);
        const instData = instDoc?.data() ?? null;
        const cacheTotal = instData?.progressCache?.totalActivities;
        const totalActivities: number = typeof cacheTotal === 'number' && cacheTotal > 0 ? cacheTotal : 0;

        // Derivar datas da instância dentro da transaction para evitar staleness após weekly reset
        let startOfWeek: Date;
        let endOfWeek: Date;
        if (instData) {
          startOfWeek = instData.currentWeekStartDate?.toDate?.() ?? (() => {
            const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d;
          })();
          endOfWeek = instData.currentWeekEndDate?.toDate?.() ?? (() => {
            const d = new Date(startOfWeek); d.setDate(d.getDate() + 6); return d;
          })();
        } else {
          startOfWeek = new Date();
          startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
          endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
        }

        if (snapDoc.exists()) {
          const data = snapDoc.data();
          // Usar totalActivities do snapshot persistido se disponível; senão do cache da instância.
          // Se ambos forem 0 (updateProgressCache ainda não rodou), não calcular rate — deixar 0
          // para ser corrigido quando updateProgressCache rodar após a geração de atividades.
          const totalForRate = (data.metrics?.totalActivities > 0)
            ? data.metrics.totalActivities
            : (totalActivities > 0 ? totalActivities : 0);
          const newCompleted = (data.metrics?.completedActivities || 0) + 1;
          const newRate = totalForRate > 0 ? Math.round((newCompleted / totalForRate) * 100) : 0;

          // Métricas de engajamento: ler do progressCache da instância (recalculado pelo
          // updateProgressCache que executa antes desta função) ou manter valor existente
          const cacheConsistency = instData?.progressCache?.consistencyScore;
          const cacheAdherence = instData?.progressCache?.adherenceScore;
          const consistencyScore = typeof cacheConsistency === 'number'
            ? cacheConsistency
            : (data.metrics?.consistencyScore ?? Math.round((1 / 7) * 100));
          const adherenceScore = typeof cacheAdherence === 'number'
            ? cacheAdherence
            : (data.metrics?.adherenceScore ?? 100);

          tx.update(snapshotRef, {
            'metrics.completedActivities': increment(1),
            'metrics.totalPointsEarned': increment(pointsEarned),
            'metrics.totalTimeSpent': increment(timeSpent),
            'metrics.completionRate': newRate,
            'metrics.consistencyScore': consistencyScore,
            'metrics.adherenceScore': adherenceScore,
            updatedAt: serverTimestamp()
          });
        } else {
          // Se totalActivities ainda não está disponível (reset recente sem updateProgressCache),
          // salvar 0 para evitar completionRate falso de 100%. Será corrigido por updateProgressCache.
          const safeTotal = totalActivities > 0 ? totalActivities : 0;
          const initialRate = safeTotal > 0 ? Math.round((1 / safeTotal) * 100) : 0;
          tx.set(snapshotRef, {
            studentId,
            weekNumber,
            ...(scheduleInstanceId && { scheduleInstanceId }),
            scheduleName: instData?.scheduleName || '',
            weekStartDate: Timestamp.fromDate(startOfWeek),
            weekEndDate: Timestamp.fromDate(endOfWeek),
            isActive: true,
            metrics: {
              completedActivities: 1,
              totalPointsEarned: pointsEarned,
              totalTimeSpent: timeSpent,
              totalActivities: safeTotal,
              completionRate: initialRate,
              streakAtEndOfWeek: 1,
              adherenceScore: 100,
              consistencyScore: Math.round((1 / 7) * 100),
            },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      });

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
          ...(data.activitySnapshot ?? {}),
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
          ...(data.activitySnapshot ?? {}),
          createdAt: data.activitySnapshot?.createdAt?.toDate(),
          updatedAt: data.activitySnapshot?.updatedAt?.toDate()
        }
      } as ActivityProgress;

      return { canAccess: true, activity };

    } catch (error) {
      console.error('Erro ao validar acesso:', error);
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
      debugLog('🔍 [getActivitiesByWeekAndDay] Buscando atividades:', {
        studentId,
        scheduleInstanceId,
        weekNumber,
        dayOfWeek
      });

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
            ...(data.activitySnapshot ?? {}),
            createdAt: data.activitySnapshot?.createdAt?.toDate(),
            updatedAt: data.activitySnapshot?.updatedAt?.toDate()
          }
        } as ActivityProgress;

        activities.push(activity);
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

    debugLog(`[recalculate] studentId=${studentId} dryRun=${dryRun}`);

    // 1. Buscar TODOS os activityProgress do aluno (sem filtro de isActive)
    const q = query(
      collection(firestore, this.COLLECTIONS.PROGRESS),
      where('studentId', '==', studentId)
    );
    const snap = await getDocs(q);
    debugLog(`[recalculate] Documentos encontrados: ${snap.size}`);

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

    const level = calculateLevel(totalPoints);

    // Calcular streak: dias consecutivos com ao menos uma atividade completada, contando de hoje para trás
    const completedDates: Date[] = [];
    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
    snap.forEach((d) => {
      const data = d.data();
      if (data.status !== 'completed' || !data.completedAt) return;
      try {
        const date = data.completedAt.toDate?.() ?? new Date(data.completedAt);
        if (isNaN(date.getTime()) || date.getTime() < oneYearAgo) return;
        completedDates.push(date);
      } catch {
        // skip
      }
    });
    const streak = calculateStreak(completedDates);

    debugLog(`[recalculate] totalActivityProgress : ${snap.size}`);
    debugLog(`[recalculate] totalCompletedActivities: ${totalCompletedActivities}`);
    debugLog(`[recalculate] totalPoints             : ${totalPoints}`);
    debugLog(`[recalculate] level                   : ${level}`);

    if (!dryRun) {
      const studentRef = doc(firestore, this.COLLECTIONS.STUDENTS, studentId);
      // Usar transaction para não sobrescrever pontos de atividades completadas
      // concorrentemente durante a leitura do histórico
      await runTransaction(firestore, async (tx) => {
        const snap = await tx.get(studentRef);
        if (!snap.exists()) return;
        const storedPoints = snap.data()?.profile?.totalPoints ?? 0;
        const storedCompleted = snap.data()?.profile?.totalCompletedActivities ?? 0;
        // Preservar o maior valor (não perder pontos escritos concorrentemente)
        const safePoints = Math.max(totalPoints, storedPoints);
        const safeCompleted = Math.max(totalCompletedActivities, storedCompleted);
        tx.update(studentRef, {
          'profile.totalPoints': safePoints,
          'profile.level': calculateLevel(safePoints),
          'profile.totalCompletedActivities': safeCompleted,
          'profile.streak': streak,
          'profile.lastMetricsRecalculatedAt': serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      debugLog('[recalculate] ✅ Escrito no Firestore com sucesso');
    } else {
      debugLog('[recalculate] ⚠️  dryRun=true — nada foi escrito no Firestore');
    }

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