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

export function useStudentWeeklyProgress() {
  const { user } = useAuth();
  const [data, setData] = useState<ProgressData | null>(null);
  const [weeklyActivities, setWeeklyActivities] = useState<ActivityProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 🔥 1. CÁLCULO REATIVO DE TEMPO (COM LOGS DE PENTE FINO)
  const timeInvestedCalculated = useMemo(() => {
    console.group('⏱️ [CÁLCULO-TEMPO] Iniciando triagem de atividades');
    
    const completed = weeklyActivities.filter(a => {
      const isDone = a.status === 'completed';
      if (!isDone) console.log(`⏭️ [IGNORADO] Atividade "${a.activitySnapshot?.title}" está como: ${a.status}`);
      return isDone;
    });

    console.log(`✅ [FILTRO] ${completed.length} atividades concluídas encontradas para soma.`);

    const total = completed.reduce((acc, curr) => {
      // 1. Tenta o tempo real investido
      const realTime = Number(curr.executionData?.timeSpent);
      // 2. Fallback para duração estimada se o real for inválido
      const estimatedTime = Number(curr.activitySnapshot?.metadata?.estimatedDuration);
      
      let timeToAdd = 0;
      let fonte = 'NENHUMA';

      if (!isNaN(realTime) && realTime > 0) {
        timeToAdd = realTime;
        fonte = 'executionData.timeSpent';
      } else if (!isNaN(estimatedTime) && estimatedTime > 0) {
        timeToAdd = estimatedTime;
        fonte = 'metadata.estimatedDuration (Fallback)';
      }

      console.log(`📌 [SOMA] +${timeToAdd}min | Fonte: ${fonte} | Atividade: ${curr.activitySnapshot?.title}`);
      return acc + timeToAdd;
    }, 0);

    console.log(`🏁 [RESULTADO FINAL] Soma total acumulada: ${total} minutos.`);
    console.groupEnd();
    return total;
  }, [weeklyActivities]);

  const loadProgressData = useCallback(async () => {
    if (!user?.id || user.role !== 'student') return;

    console.group(`📊 [PROGRESS-HOOK] Sincronizando Métricas Reais`);
    try {
      setLoading(true);

      // 1. BUSCAR PERFIL (RPG)
      console.log('🔍 [PASSO 1] Lendo perfil do aluno para XP e Streak...');
      const studentRef = doc(firestore, 'students', user.id);
      const studentSnap = await getDoc(studentRef);
      const studentProfile = studentSnap.data()?.profile || {};
      const totalPoints = studentProfile.totalPoints || 0;
      const streak = studentProfile.streak || 0;
      const level = Math.floor(totalPoints / 200) + 1;

      // 2. BUSCAR HISTÓRICO
      console.log('🔍 [PASSO 2] Buscando WeeklySnapshots...');
      const snapshotsQuery = query(collection(firestore, 'weeklySnapshots'), where('studentId', '==', user.id));
      const snapshotsSnap = await getDocs(snapshotsQuery);
      let snapshots = snapshotsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        weekStartDate: doc.data().weekStartDate?.toDate(),
        weekEndDate: doc.data().weekEndDate?.toDate(),
      } as WeeklySnapshot)).sort((a, b) => b.weekNumber - a.weekNumber);

      // 3. BUSCAR ATIVIDADES ATUAIS
      console.log('🔍 [PASSO 3] Chamando Service para buscar atividades da semana...');
      const currentActivities = await ScheduleInstanceService.getWeekActivities(user.id);
      console.log(`📦 [DADOS] Recebidas ${currentActivities.length} atividades brutas do Service.`);
      setWeeklyActivities(currentActivities);

      // 4. CALCULAR TENDÊNCIA
      let trend: 'improving' | 'declining' | 'stable' = 'stable';
      if (snapshots.length >= 2) {
        const latestRate = snapshots[0].metrics.completionRate || 0;
        const previousRate = snapshots[1].metrics.completionRate || 0;
        if (latestRate > previousRate + 5) trend = 'improving';
        else if (latestRate < previousRate - 5) trend = 'declining';
      }

      // 5. ATUALIZAR INTERFACE
      const completedCount = currentActivities.filter(a => a.status === 'completed').length;
      const totalCount = currentActivities.length;

      console.log('✨ [HOOK] Preparando objeto final de DATA para a UI...');
      setData({
        performanceTrend: trend,
        currentMetrics: {
          streak,
          totalPoints,
          level,
          completedActivities: completedCount,
          totalActivities: totalCount,
          completionRate: totalCount > 0 ? (completedCount / totalCount) * 100 : 0,
          timeSpent: timeInvestedCalculated // 👈 Plugado no cálculo reativo com logs
        },
        weeklySnapshots: snapshots
      });

      setError(null);
    } catch (err: any) {
      console.error('❌ [PROGRESS-HOOK] Erro Fatal:', err);
      setError('Erro ao sincronizar progresso.');
    } finally {
      setLoading(false);
      console.groupEnd();
    }
  }, [user?.id, timeInvestedCalculated]);

  useEffect(() => {
    loadProgressData();
  }, [loadProgressData]);

  const stats = useMemo(() => {
    const total = weeklyActivities.length;
    const completed = weeklyActivities.filter(a => a.status === 'completed').length;
    return {
      total,
      completed,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0,
      pending: total - completed
    };
  }, [weeklyActivities]);

  return { data, weeklyActivities, stats, loading, error, refresh: loadProgressData };
}