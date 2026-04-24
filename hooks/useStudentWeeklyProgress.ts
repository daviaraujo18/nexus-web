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

<<<<<<< HEAD
  return { data, loading, error: null, refresh: () => {} };
=======
    // Último snapshot
    const latest = snapshots[0];

    // 🔥 FIX: Proteção contra estrutura de dados inesperada do banco
    const latestMetrics = latest.metrics || {};
    
    // Calcular totais de todos os snapshots
    const totalPoints = snapshots.reduce((sum, s) => sum + s.metrics.totalPointsEarned, 0);
    const totalTimeSpent = snapshots.reduce((sum, s) => sum + s.metrics.totalTimeSpent, 0);
    const totalCompleted = snapshots.reduce((sum, s) => sum + s.metrics.completedActivities, 0);
    const totalActivities = snapshots.reduce((sum, s) => sum + s.metrics.totalActivities, 0);

    // Calcular nível baseado em pontos (exemplo: cada 100 pontos = 1 nível)
    const level = Math.max(1, Math.floor(totalPoints / 100) + 1);

    return {
      streak: latest.metrics.streakAtEndOfWeek,
      totalPoints,
      level,
      completionRate: latest.metrics.completionRate,
      totalActivities,
      completedActivities: totalCompleted,
      timeSpent: totalTimeSpent
    };
  };

  // Determinar tendência
  const determineTrend = (snapshots: WeeklySnapshot[]): 'improving' | 'stable' | 'declining' => {
    if (snapshots.length < 2) return 'stable';
    
    const first = snapshots[snapshots.length - 1];
    const last = snapshots[0];
    
    const change = last.metrics.completionRate - first.metrics.completionRate;
    
    if (change > 5) return 'improving';
    if (change < -5) return 'declining';
    return 'stable';
  };

  // Extrair insights dos snapshots
  const extractInsights = (snapshots: WeeklySnapshot[]) => {
    const defaultInsights = {
      strengths: [],
      challenges: [],
      recommendations: []
    };

    if (snapshots.length === 0) return defaultInsights;

    const latest = snapshots[0];
    
    // Gerar insights baseados nos dados
    const strengths: string[] = [];
    const challenges: string[] = [];
    const recommendations: string[] = [];

    // Força: alta taxa de conclusão
    if (latest.metrics.completionRate > 80) {
      strengths.push('Alta taxa de conclusão de atividades');
    } else if (latest.metrics.completionRate > 60) {
      strengths.push('Boa consistência nas atividades');
    }

    // Força: streak longo
    if (latest.metrics.streakAtEndOfWeek > 7) {
      strengths.push(`Sequência de ${latest.metrics.streakAtEndOfWeek} dias de atividades`);
    }

    // Desafio: baixa consistência
    if (latest.metrics.consistencyScore < 50) {
      challenges.push('Baixa consistência na realização das atividades');
      recommendations.push('Tente manter uma rotina diária de atividades');
    }

    // Desafio: baixa adesão
    if (latest.metrics.adherenceScore < 60) {
      challenges.push('Dificuldade em seguir o cronograma proposto');
      recommendations.push('Revise seu cronograma e ajuste os horários das atividades');
    }

    // Recomendações baseadas em padrões
    if (latest.metrics.completionRate < 40) {
      recommendations.push('Comece com atividades mais curtas para ganhar momentum');
    }

    if (latest.metrics.streakAtEndOfWeek === 0 && snapshots.length > 1) {
      recommendations.push('Que tal começar uma nova sequência hoje?');
    }

    return {
      strengths: strengths.slice(0, 3),
      challenges: challenges.slice(0, 2),
      recommendations: recommendations.slice(0, 3)
    };
  };

  useEffect(() => {
    loadProgressData();
  }, [loadProgressData]);

  return {
    data,
    loading,
    error,
    refresh: loadProgressData
  };
>>>>>>> fcbeaae (lógica calendário civil estabelecida)
}