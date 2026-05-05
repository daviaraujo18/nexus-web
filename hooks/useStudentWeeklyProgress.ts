// hooks/useStudentWeeklyProgress.ts
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ScheduleInstanceService } from '@/lib/services/ScheduleInstanceService';
import { ActivityProgress, WeeklySnapshot } from '@/types/schedule';
import { useAuth } from '@/context/AuthContext';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { firestore } from '@/firebase/config';

export interface ProgressData {
  performanceTrend: 'improving' | 'declining' | 'stable';
  currentMetrics: {
    streak: number;
    totalPoints: number;
    level: number;
    completedActivities: number;
    totalActivities: number;
    completionRate: number;
    timeSpent: number;
  };
  weeklySnapshots: WeeklySnapshot[];
}

/**
 * Hook responsável por consolidar o progresso semanal do aluno.
 *
 * Responsabilidades:
 * - Buscar métricas reais do perfil (XP, streak, nível)
 * - Carregar snapshots semanais históricos
 * - Buscar atividades da semana atual
 * - Calcular métricas derivadas (completionRate, tempo, trend)
 *
 * Fontes de dados:
 * - students (perfil)
 * - weeklySnapshots (histórico)
 * - ScheduleInstanceService (atividades atuais)
 *
 * ⚠️ IMPORTANTE:
 * Este hook mistura:
 * - dados persistidos (Firestore)
 * - dados calculados em tempo real
 *
 * ⚠️ Impacto:
 * - dashboard do aluno
 * - progresso semanal
 * - analytics
 */
export function useStudentWeeklyProgress() {
  const { user } = useAuth();
  const [data, setData] = useState<ProgressData | null>(null);
  const [weeklyActivities, setWeeklyActivities] = useState<ActivityProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Calcula tempo total gasto nas atividades.
   *
   * Prioridade:
   * 1. Usa tempo real (executionData.timeSpent)
   * 2. Fallback para tempo estimado (metadata.estimatedDuration)
   *
   * ⚠️ Importante:
   * - garante consistência mesmo sem dados reais
   */
  const calculateTimeSpent = useCallback((activities: ActivityProgress[]): number => {
    const completed = activities.filter(activity => activity.status === 'completed');

    return completed.reduce((total, activity) => {
      /**
       * Tempo real registrado durante execução da atividade
       */
      const realTime = Number(activity.executionData?.timeSpent);

      /**
       * Tempo estimado definido no cronograma
       */
      const estimatedTime = Number(activity.activitySnapshot?.metadata?.estimatedDuration);

      if (Number.isFinite(realTime) && realTime > 0) {
        return total + realTime;
      }

      if (Number.isFinite(estimatedTime) && estimatedTime > 0) {
        return total + estimatedTime;
      }

      return total;
    }, 0);
  }, []);

  /**
   * Carrega e consolida todos os dados de progresso do aluno.
   *
   * Fluxo:
   * 1. Lê perfil (XP, streak, nível)
   * 2. Busca snapshots históricos
   * 3. Busca atividades da semana atual
   * 4. Calcula métricas (completion, tempo)
   * 5. Define tendência (trend)
   *
   * ⚠️ IMPORTANTE:
   * Esse método é o ponto central de sincronização do progresso
   */
  const loadProgressData = useCallback(async () => {
    if (!user?.id || user.role !== 'student') return;

    console.group('📊 [PROGRESS-HOOK] Sincronizando Métricas Reais');

    try {
      setLoading(true);

      console.log('🔍 [PASSO 1] Lendo perfil do aluno para XP e Streak...');

      /**
       * Busca dados permanentes do aluno.
       *
       * Inclui:
       * - totalPoints
       * - streak
       * - level
       */
      const studentRef = doc(firestore, 'students', user.id);
      const studentSnap = await getDoc(studentRef);
      const studentProfile = studentSnap.data()?.profile || {};

      const totalPoints = Number(studentProfile.totalPoints ?? 0);
      const streak = Number(studentProfile.streak ?? 0);
      const level = Number(studentProfile.level ?? Math.floor(totalPoints / 200) + 1);

      console.log('🔍 [PASSO 2] Buscando WeeklySnapshots...');

      /** 
       * Busca histórico semanal do aluno.
       *
       * Fonte:
       * - weeklySnapshots collection
       *
       * ⚠️ Pode conter dados antigos ou inconsistentes
       */
      const snapshotsQuery = query(
        collection(firestore, 'weeklySnapshots'),
        where('studentId', '==', user.id)
      );

      const snapshotsSnap = await getDocs(snapshotsQuery);
      const snapshots = snapshotsSnap.docs
        .map(snapshotDoc => {
          const snapshotData = snapshotDoc.data();

          return {
            id: snapshotDoc.id,
            ...snapshotData,
            /**
             * Converte Timestamp do Firestore para Date
             */
            weekStartDate: snapshotData.weekStartDate?.toDate(),
            weekEndDate: snapshotData.weekEndDate?.toDate(),
          } as WeeklySnapshot;
        })
        .sort((a, b) => b.weekNumber - a.weekNumber);

      console.log('🔍 [PASSO 3] Chamando Service para buscar atividades da semana...');
      /**
       * Busca atividades da semana atual.
       *
       * Fonte:
       * - ScheduleInstanceService
       *
       * ⚠️ Dados mais próximos da execução real
       */
      const currentActivities = await ScheduleInstanceService.getWeekActivities(user.id);
      console.log(`📦 [DADOS] Recebidas ${currentActivities.length} atividades brutas do Service.`);

      setWeeklyActivities(currentActivities);
      
      /**
       * Agrupa atividades por status (completed, pending, etc.)
       */
      const byStatusWP = currentActivities.reduce<Record<string, number>>((acc, activity) => {
        acc[activity.status] = (acc[activity.status] || 0) + 1;
        return acc;
      }, {});

      console.log('[WEEKLY_PROGRESS_DIAG] currentActivities por status:', byStatusWP);

      const completedActivities = currentActivities.filter(
        activity => activity.status === 'completed'
      );

      const totalActivities = currentActivities.length;
      const completedCount = completedActivities.length;

      /**
       * Calcula taxa de conclusão da semana.
       *
       * Fórmula:
       * completed / total * 100
       */
      const completionRate =
        totalActivities > 0
          ? Math.round((completedCount / totalActivities) * 100)
          : 0;

      /**
       * Tempo total gasto (real ou estimado)
       */    
      const timeSpent = calculateTimeSpent(currentActivities);

      console.log(
        `[WEEKLY_PROGRESS_DIAG] completedCount=${completedCount} totalActivities=${totalActivities} rate=${completionRate}% timeSpent=${timeSpent}min`
      );
      
      /**
       * Calcula tendência de desempenho do aluno.
       *
       * Base:
       * - compara completionRate das últimas semanas
       *
       * Regras:
       * - +5% → improving
       * - -5% → declining
       * - resto → stable
       */
      let trend: 'improving' | 'declining' | 'stable' = 'stable';

      if (snapshots.length >= 2) {
        const latestRate = snapshots[0].metrics.completionRate || 0;
        const previousRate = snapshots[1].metrics.completionRate || 0;

        if (latestRate > previousRate + 5) {
          trend = 'improving';
        } else if (latestRate < previousRate - 5) {
          trend = 'declining';
        }
      }

      console.log('✨ [HOOK] Preparando objeto final de DATA para a UI...');
      
      /**
       * Monta objeto final consumido pela UI.
       *
       * Inclui:
       * - métricas atuais
       * - tendência
       * - histórico semanal
       */
      setData({
        performanceTrend: trend,
        currentMetrics: {
          streak,
          totalPoints,
          level,
          completedActivities: completedCount,
          totalActivities,
          completionRate,
          timeSpent,
        },
        weeklySnapshots: snapshots,
      });

      setError(null);

      /**
       * Tratamento de erro global do hook.
       *
       * ⚠️ Qualquer falha aqui impacta toda a UI do aluno
       */
    } catch (err: unknown) {
      console.error('❌ [PROGRESS-HOOK] Erro Fatal:', err);
      setError('Erro ao sincronizar progresso.');
    } finally {
      setLoading(false);
      console.groupEnd();
    }
  }, [user?.id, user?.role, calculateTimeSpent]);
  
  /**
   * Executa carregamento automático ao montar o hook
   */
  useEffect(() => {
    loadProgressData();
  }, [loadProgressData]);

  /**
   * Estatísticas rápidas da semana.
   *
   * Inclui:
   * - total de atividades
   * - concluídas
   * - pendentes
   * - percentual
   *
   * ⚠️ Derivado de weeklyActivities
   */
  const stats = useMemo(() => {
    const total = weeklyActivities.length;
    const completed = weeklyActivities.filter(activity => activity.status === 'completed').length;
    
    /**
     * API pública do hook.
     *
     * Fornece:
     * - data → métricas completas
     * - weeklyActivities → atividades atuais
     * - stats → resumo rápido
     * - loading / error
     * - refresh → recarregar dados
     */
    return {
      total,
      completed,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0,
      pending: total - completed,
    };
  }, [weeklyActivities]);

  return {
    data,
    weeklyActivities,
    stats,
    loading,
    error,
    refresh: loadProgressData,
  };
}