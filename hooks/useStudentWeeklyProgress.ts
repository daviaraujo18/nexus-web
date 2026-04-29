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

  const calculateTimeSpent = useCallback((activities: ActivityProgress[]): number => {
    const completed = activities.filter(activity => activity.status === 'completed');

    return completed.reduce((total, activity) => {
      const realTime = Number(activity.executionData?.timeSpent);
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

  const loadProgressData = useCallback(async () => {
    if (!user?.id || user.role !== 'student') return;

    console.group('📊 [PROGRESS-HOOK] Sincronizando Métricas Reais');

    try {
      setLoading(true);

      console.log('🔍 [PASSO 1] Lendo perfil do aluno para XP e Streak...');
      const studentRef = doc(firestore, 'students', user.id);
      const studentSnap = await getDoc(studentRef);
      const studentProfile = studentSnap.data()?.profile || {};

      const totalPoints = Number(studentProfile.totalPoints ?? 0);
      const streak = Number(studentProfile.streak ?? 0);
      const level = Number(studentProfile.level ?? Math.floor(totalPoints / 200) + 1);

      console.log('🔍 [PASSO 2] Buscando WeeklySnapshots...');
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
            weekStartDate: snapshotData.weekStartDate?.toDate(),
            weekEndDate: snapshotData.weekEndDate?.toDate(),
          } as WeeklySnapshot;
        })
        .sort((a, b) => b.weekNumber - a.weekNumber);

      console.log('🔍 [PASSO 3] Chamando Service para buscar atividades da semana...');
      const currentActivities = await ScheduleInstanceService.getWeekActivities(user.id);
      console.log(`📦 [DADOS] Recebidas ${currentActivities.length} atividades brutas do Service.`);

      setWeeklyActivities(currentActivities);

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
      const completionRate =
        totalActivities > 0
          ? Math.round((completedCount / totalActivities) * 100)
          : 0;

      const timeSpent = calculateTimeSpent(currentActivities);

      console.log(
        `[WEEKLY_PROGRESS_DIAG] completedCount=${completedCount} totalActivities=${totalActivities} rate=${completionRate}% timeSpent=${timeSpent}min`
      );

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
    } catch (err: unknown) {
      console.error('❌ [PROGRESS-HOOK] Erro Fatal:', err);
      setError('Erro ao sincronizar progresso.');
    } finally {
      setLoading(false);
      console.groupEnd();
    }
  }, [user?.id, user?.role, calculateTimeSpent]);

  useEffect(() => {
    loadProgressData();
  }, [loadProgressData]);

  const stats = useMemo(() => {
    const total = weeklyActivities.length;
    const completed = weeklyActivities.filter(activity => activity.status === 'completed').length;

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