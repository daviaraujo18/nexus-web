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

  const analyticsService = useMemo(() => new AnalyticsService(user?.role ?? 'psychologist'), [user?.role]);

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

    const pctChange = (cur: number, prev: number) =>
      prev === 0 ? (cur === 0 ? 0 : 100) : ((cur - prev) / prev) * 100;

    return {
      completionRate: {
        current: current.averageCompletionRate,
        previous: previous.averageCompletionRate,
        change: pctChange(current.averageCompletionRate, previous.averageCompletionRate)
      },
      gad7Score: {
        current: current.averageGAD7Score,
        previous: previous.averageGAD7Score,
        change: pctChange(current.averageGAD7Score, previous.averageGAD7Score)
      },
      consistency: {
        current: current.averageConsistencyScore,
        previous: previous.averageConsistencyScore,
        change: pctChange(current.averageConsistencyScore, previous.averageConsistencyScore)
      },
      engagement: {
        current: current.averageAdherenceScore,
        previous: previous.averageAdherenceScore,
        change: pctChange(current.averageAdherenceScore, previous.averageAdherenceScore)
      }
    };
  }, [comparison]);

  const getTopImprovers = useCallback(() => {
    const currentEngagement = comparison.current?.studentRankings?.byEngagement;
    const previousEngagement = comparison.previous?.studentRankings?.byEngagement;
    if (!currentEngagement || !previousEngagement) return [];

    const currentStudents = new Map(currentEngagement.map(s => [s.studentId, s.value]));
    const previousStudents = new Map(previousEngagement.map(s => [s.studentId, s.value]));

    return Array.from(currentStudents.entries())
      .map(([studentId, currentValue]) => {
        const previousValue = previousStudents.get(studentId) || 0;
        return {
          studentId,
          studentName: currentEngagement.find(s => s.studentId === studentId)?.studentName || '',
          improvement: currentValue - previousValue,
          currentValue,
          previousValue
        };
      })
      .sort((a, b) => b.improvement - a.improvement)
      .slice(0, 5);
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