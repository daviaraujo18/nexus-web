// hooks/useComparativeAnalytics.ts
import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ComparativeAnalysis, DateRange } from '@/types/analytics';
import { AnalyticsService } from '@/lib/services/AnalyticsService';

export function useComparativeAnalytics() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [comparison, setComparison] = useState<{
    current: ComparativeAnalysis | null;
    previous: ComparativeAnalysis | null;
  }>({ current: null, previous: null });

  const analyticsService = useMemo(() => new AnalyticsService(user?.role), [user?.role]);

  const comparePeriods = useCallback(async (
    currentRange: DateRange,
    previousRange: DateRange
  ) => {
    if (!user?.id) return;

    setLoading(true);
    setError(undefined);

    try {
      const [current, previous] = await Promise.all([
        analyticsService.getComparativeAnalysis(user.id, {
          period: 'custom',
          customRange: currentRange
        }),
        analyticsService.getComparativeAnalysis(user.id, {
          period: 'custom',
          customRange: previousRange
        })
      ]);

      setComparison({ current, previous });
    } catch (err) {
      console.error('Error comparing periods:', err);
      setError(err instanceof Error ? err.message : 'Erro ao comparar períodos');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const getComparisonMetrics = useCallback(() => {
    if (!comparison.current || !comparison.previous) return null;

    const current = comparison.current.summary.metrics;
    const previous = comparison.previous.summary.metrics;

    return {
      completionRate: {
        current: current.averageCompletionRate,
        previous: previous.averageCompletionRate,
        change: ((current.averageCompletionRate - previous.averageCompletionRate) / previous.averageCompletionRate) * 100
      },
      gad7Score: {
        current: current.averageGAD7Score,
        previous: previous.averageGAD7Score,
        change: ((current.averageGAD7Score - previous.averageGAD7Score) / previous.averageGAD7Score) * 100
      },
      consistency: {
        current: current.averageConsistencyScore,
        previous: previous.averageConsistencyScore,
        change: ((current.averageConsistencyScore - previous.averageConsistencyScore) / previous.averageConsistencyScore) * 100
      },
      engagement: {
        current: current.averageCompletionRate,
        previous: previous.averageCompletionRate,
        change: ((current.averageCompletionRate - previous.averageCompletionRate) / previous.averageCompletionRate) * 100
      }
    };
  }, [comparison]);

  const getTopImprovers = useCallback(() => {
    if (!comparison.current || !comparison.previous) return [];

    // Calcular quais alunos mais melhoraram
    const currentStudents = new Map(
      comparison.current.studentRankings.byEngagement.map(s => [s.studentId, s.value])
    );
    
    const previousStudents = new Map(
      comparison.previous.studentRankings.byEngagement.map(s => [s.studentId, s.value])
    );

    const improvements = Array.from(currentStudents.entries())
      .map(([studentId, currentValue]) => {
        const previousValue = previousStudents.get(studentId) || 0;
        return {
          studentId,
          studentName: comparison.current!.studentRankings.byEngagement.find(s => s.studentId === studentId)?.studentName || '',
          improvement: currentValue - previousValue,
          currentValue,
          previousValue
        };
      })
      .sort((a, b) => b.improvement - a.improvement)
      .slice(0, 5);

    return improvements;
  }, [comparison]);

  return {
    loading,
    error,
    comparison,
    comparePeriods,
    getComparisonMetrics,
    getTopImprovers,
    hasComparison: !!comparison.current && !!comparison.previous
  };
}