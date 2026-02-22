// hooks/useStudentAnalytics.ts
import { useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { StudentAnalyticsSummary, Insight } from '@/types/analytics';
import { AnalyticsService } from '@/lib/services/AnalyticsService';

export function useStudentAnalytics(studentId: string) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [data, setData] = useState<StudentAnalyticsSummary | null>(null);

  const analyticsService = new AnalyticsService(user?.role);

  const loadStudentData = useCallback(async (weeks: number = 8) => {
    if (!user?.id || !studentId) return;

    setLoading(true);
    setError(undefined);

    try {
      console.log('📊 Loading student analytics:', {
        studentId,
        userId: user.id,
        role: user.role
      });

      const studentData = await analyticsService.getStudentAnalytics(
        studentId,
        user.id,
        weeks
      );

      setData(studentData);
    } catch (err) {
      console.error('Error loading student analytics:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados do aluno');
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.role, studentId]);

  const getPriorityInsights = useCallback((): Insight[] => {
    if (!data) return [];

    return data.insights.filter(insight =>
      insight.type === 'risk' || insight.type === 'warning'
    );
  }, [data]);

  const getWeeklyTrend = useCallback(() => {
    if (!data || data.weeklyHistory.length < 2) return null;

    const latest = data.weeklyHistory[0];
    const previous = data.weeklyHistory[1];

    return {
      completionChange: latest.completionRate - previous.completionRate,
      consistencyChange: latest.consistencyScore - previous.consistencyScore,
      gad7Change: latest.gad7 ? latest.gad7.score - (previous.gad7?.score || 0) : 0,
      isImproving: latest.completionRate > previous.completionRate
    };
  }, [data]);

  const getGAD7History = useCallback(() => {
    if (!data) return [];

    return data.weeklyHistory
      .filter(week => week.gad7)
      .map(week => ({
        weekNumber: week.weekNumber,
        date: week.weekEndDate,
        score: week.gad7!.score,
        severity: week.gad7!.severity
      }));
  }, [data]);

  const getActivityBreakdown = useCallback(() => {
    if (!data || data.weeklyHistory.length === 0) return {};

    const latest = data.weeklyHistory[0];
    return latest.activityBreakdown;
  }, [data]);

  return {
    loading,
    error,
    data,
    loadStudentData,
    getPriorityInsights,
    getWeeklyTrend,
    getGAD7History,
    getActivityBreakdown,
    hasData: !!data,
    isAtRisk: data?.riskLevel === 'high' || data?.riskLevel === 'critical'
  };
}