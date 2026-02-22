// hooks/useStudentWeeklyProgress.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import { WeeklySnapshot } from '@/types/schedule';

interface StudentWeeklyData {
  // Métricas atuais
  currentMetrics: {
    streak: number;
    totalPoints: number;
    level: number;
    completionRate: number;
    totalActivities: number;
    completedActivities: number;
    timeSpent: number;
  };
  
  // Snapshots semanais
  weeklySnapshots: WeeklySnapshot[];
  
  // Tendência
  performanceTrend: 'improving' | 'stable' | 'declining';
  
  // Insights
  insights: {
    strengths: string[];
    challenges: string[];
    recommendations: string[];
  };
  
  // Metadados
  lastUpdated: Date;
}

export function useStudentWeeklyProgress() {
  const { user } = useAuth();
  const [data, setData] = useState<StudentWeeklyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProgressData = useCallback(async () => {
    if (!user || user.role !== 'student') {
      setData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Buscando weeklySnapshots para o aluno:', user.id);

      // Buscar snapshots do aluno
      const snapshotsRef = collection(firestore, 'weeklySnapshots');
      const q = query(
        snapshotsRef,
        where('studentId', '==', user.id),
        orderBy('weekNumber', 'desc'),
        limit(8) // Últimas 8 semanas
      );

      const querySnapshot = await getDocs(q);
      
      console.log('📊 Snapshots encontrados:', querySnapshot.size);

      const snapshots: WeeklySnapshot[] = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          weekStartDate: data.weekStartDate?.toDate(),
          weekEndDate: data.weekEndDate?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate()
        } as WeeklySnapshot;
      });

      // Calcular métricas atuais baseadas nos snapshots
      const currentMetrics = calculateCurrentMetrics(snapshots);
      
      // Determinar tendência
      const performanceTrend = determineTrend(snapshots);
      
      // Extrair insights
      const insights = extractInsights(snapshots);

      setData({
        currentMetrics,
        weeklySnapshots: snapshots,
        performanceTrend,
        insights,
        lastUpdated: new Date()
      });

    } catch (err: any) {
      console.error('❌ Erro ao carregar weeklySnapshots:', err);
      setError(err.message || 'Erro ao carregar dados de progresso');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Calcular métricas atuais a partir dos snapshots
  const calculateCurrentMetrics = (snapshots: WeeklySnapshot[]) => {
    if (snapshots.length === 0) {
      return {
        streak: 0,
        totalPoints: 0,
        level: 1,
        completionRate: 0,
        totalActivities: 0,
        completedActivities: 0,
        timeSpent: 0
      };
    }

    // Último snapshot
    const latest = snapshots[0];
    
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
}