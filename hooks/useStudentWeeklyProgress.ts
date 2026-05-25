// hooks/useStudentWeeklyProgress.ts
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ScheduleInstanceService } from '@/lib/services/ScheduleInstanceService';
import { ActivityProgress, WeeklySnapshot } from '@/types/schedule';
import { useAuth } from '@/context/AuthContext';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
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

export interface MonthOption {
  label: string;
  value: string;
  year: number;
  month: number;
}

function snapshotOverlapsMonth(s: WeeklySnapshot, year: number, month: number): boolean {
  if (!s.weekStartDate || !s.weekEndDate) return false;
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
  const monthEndWithMargin = new Date(monthEnd);
  monthEndWithMargin.setDate(monthEndWithMargin.getDate() + 6);
  return s.weekStartDate <= monthEndWithMargin && s.weekEndDate >= monthStart;
}

function computeTrend(snapshots: WeeklySnapshot[]): 'improving' | 'declining' | 'stable' {
  if (snapshots.length < 2) return 'stable';
  const latestRate = snapshots[0].metrics.completionRate || 0;
  const previousRate = snapshots[1].metrics.completionRate || 0;
  if (latestRate > previousRate + 5) return 'improving';
  if (latestRate < previousRate - 5) return 'declining';
  return 'stable';
}

export function useStudentWeeklyProgress() {
  const { user } = useAuth();
  const [allSnapshots, setAllSnapshots] = useState<WeeklySnapshot[]>([]);
  const [weeklyActivities, setWeeklyActivities] = useState<ActivityProgress[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<ProgressData['currentMetrics'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const calculateTimeSpent = useCallback((activities: ActivityProgress[]): number => {
    const completed = activities.filter(activity => activity.status === 'completed');
    return completed.reduce((total, activity) => {
      const realTime = Number(activity.executionData?.timeSpent);
      const estimatedTime = Number(activity.activitySnapshot?.metadata?.estimatedDuration);
      if (Number.isFinite(realTime) && realTime > 0) return total + realTime;
      if (Number.isFinite(estimatedTime) && estimatedTime > 0) return total + estimatedTime;
      return total;
    }, 0);
  }, []);

  const loadProgressData = useCallback(async () => {
    if (!user?.id || user.role !== 'student') return;
    console.group('📊 [PROGRESS-HOOK] Sincronizando Métricas Reais');
    try {
      setLoading(true);
      const studentRef = doc(firestore, 'students', user.id);
      const studentSnap = await getDoc(studentRef);
      const studentProfile = studentSnap.data()?.profile || {};

      const totalPoints = Number(studentProfile.totalPoints ?? 0);
      const streak = Number(studentProfile.streak ?? 0);
      const level = Number(studentProfile.level ?? Math.floor(totalPoints / 200) + 1);

      const snapshotsQuery = query(
        collection(firestore, 'weeklySnapshots'),
        where('studentId', '==', user.id),
        orderBy('weekNumber', 'desc'),
        limit(52)
      );
      const snapshotsSnap = await getDocs(snapshotsQuery);
      const snapshots: WeeklySnapshot[] = snapshotsSnap.docs
        .map(snapshotDoc => {
          const snapshotData = snapshotDoc.data();
          return {
            id: snapshotDoc.id,
            ...snapshotData,
            weekStartDate: snapshotData.weekStartDate?.toDate(),
            weekEndDate: snapshotData.weekEndDate?.toDate(),
          } as WeeklySnapshot;
        });

      setAllSnapshots(snapshots);

      const currentActivities = await ScheduleInstanceService.getWeekActivities(user.id);
      setWeeklyActivities(currentActivities);

      const completedCount = currentActivities.filter(a => a.status === 'completed').length;
      const totalActivities = currentActivities.length;
      const completionRate = totalActivities > 0 ? Math.round((completedCount / totalActivities) * 100) : 0;
      const timeSpent = calculateTimeSpent(currentActivities);

      setCurrentMetrics({ streak, totalPoints, level, completedActivities: completedCount, totalActivities, completionRate, timeSpent });
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

  const filteredSnapshots = useMemo(() =>
    allSnapshots.filter(s => snapshotOverlapsMonth(s, selectedDate.getFullYear(), selectedDate.getMonth())),
    [allSnapshots, selectedDate]
  );

  const filteredData = useMemo((): ProgressData | null => {
    if (!currentMetrics) return null;
    return {
      performanceTrend: computeTrend(filteredSnapshots),
      currentMetrics,
      weeklySnapshots: filteredSnapshots,
    };
  }, [currentMetrics, filteredSnapshots]);

  const availableMonths = useMemo((): MonthOption[] => {
    const seen = new Set<string>();
    const months: MonthOption[] = [];
    for (const s of allSnapshots) {
      if (!s.weekStartDate) continue;
      const y = s.weekStartDate.getFullYear();
      const m = s.weekStartDate.getMonth();
      const key = `${y}-${String(m).padStart(2, '0')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      months.push({
        label: new Date(y, m).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
        value: key,
        year: y,
        month: m,
      });
    }
    return months.sort((a, b) => b.year - a.year || b.month - a.month);
  }, [allSnapshots]);

  const stats = useMemo(() => {
    const total = weeklyActivities.length;
    const completed = weeklyActivities.filter(activity => activity.status === 'completed').length;
    return { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0, pending: total - completed };
  }, [weeklyActivities]);

  return {
    data: filteredData,
    weeklyActivities,
    stats,
    loading,
    error,
    refresh: loadProgressData,
    selectedDate,
    setSelectedDate,
    availableMonths,
  };
}