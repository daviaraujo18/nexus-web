// hooks/useStudentWeeklyProgress.ts
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { firestore } from '@/firebase/config';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { ActivityProgress } from '@/types/schedule';
import { DateUtils } from '@/lib/utils/dateUtils'; // <--- Importação Nomeada

export function useStudentWeeklyProgress() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || user.role !== 'student') {
      setLoading(false);
      return;
    }

    const start = DateUtils.getWeekStartDate();
    const end = DateUtils.getWeekEndDate();

    setLoading(true);

    const q = query(
      collection(firestore, 'activityProgress'),
      where('studentId', '==', user.id),
      where('isActive', '==', true),
      where('scheduledDate', '>=', Timestamp.fromDate(start)),
      where('scheduledDate', '<=', Timestamp.fromDate(end))
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const weekActs = snapshot.docs.map(doc => doc.data() as ActivityProgress);
      const done = weekActs.filter(a => a.status === 'completed');

      setData({
        currentMetrics: {
          streak: user.profile?.streak || 0,
          totalPoints: user.profile?.totalPoints || 0,
          level: user.profile?.level || 1,
          completionRate: weekActs.length > 0 ? (done.length / weekActs.length) * 100 : 0,
          totalActivities: weekActs.length,
          completedActivities: done.length,
          timeSpent: done.reduce((acc, curr) => acc + (curr.activitySnapshot?.metadata?.estimatedDuration || 0), 0)
        },
        weeklySnapshots: [], 
        performanceTrend: 'stable',
        weekRange: DateUtils.formatWeekRange(start, end)
      });
      setLoading(false);
    }, (err) => {
      console.error("Erro no filtro semanal:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.id, user?.role]);

  return { data, loading, error: null, refresh: () => {} };
}