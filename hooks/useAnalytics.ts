// hooks/useAnalytics.ts
import { useState, useEffect, useCallback, useReducer } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  AnalyticsFilters,
  AnalyticsState,
  AnalyticsAction,
  ComparativeAnalysis,
  CorrelationAnalysis,
  DateRange,
  Insight
} from '@/types/analytics';
import { AnalyticsService } from '@/lib/services/AnalyticsService';

const initialState: AnalyticsState = {
  filters: {
    period: 'month',
    studentIds: []
  },
  isLoading: false,
  lastUpdated: undefined,
  data: undefined,
  correlations: undefined,
  studentData: {}
};

function analyticsReducer(state: AnalyticsState, action: AnalyticsAction): AnalyticsState {
  switch (action.type) {
    case 'SET_FILTERS':
      return { ...state, filters: action.payload };
    case 'SELECT_STUDENT':
      return { ...state, selectedStudentId: action.payload };
    case 'SET_COMPARISON':
      return { ...state, selectedComparison: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_DATA':
      return { ...state, data: action.payload, lastUpdated: new Date() };
    case 'SET_CORRELATIONS':
      return { ...state, correlations: action.payload };
    case 'SET_STUDENT_DATA':
      return { ...state, studentData: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

export function useAnalytics() {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(analyticsReducer, initialState);

  // Passar o role do usuário para o serviço
  const analyticsService = new AnalyticsService(user?.role);

  const loadData = useCallback(async (filters?: AnalyticsFilters) => {
    if (!user?.id) return;

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: undefined });

    try {
      const currentFilters = filters || state.filters;

      console.log('📊 Loading analytics for user:', {
        userId: user.id,
        role: user.role,
        filters: currentFilters
      });

      // Carregar análise comparativa
      const data = await analyticsService.getComparativeAnalysis(
        user.id,
        currentFilters
      );

      console.log('📊 Analytics data loaded:', {
        totalStudents: data.summary.totalStudents,
        activeStudents: data.summary.activeStudents,
        snapshotsCount: data.studentRankings.byEngagement.length
      });

      dispatch({ type: 'SET_DATA', payload: data });

      // Carregar correlações se houver dados suficientes
      if (data.summary.studentsWithGAD7 > 5) {
        const correlations = await analyticsService.getCorrelationAnalysis(
          user.id,
          currentFilters
        );
        dispatch({ type: 'SET_CORRELATIONS', payload: correlations });
      }

      dispatch({ type: 'SET_FILTERS', payload: currentFilters });
    } catch (error) {
      console.error('Error loading analytics:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Erro ao carregar dados'
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [user?.id, user?.role, state.filters]);

  const refresh = useCallback(() => {
    loadData(state.filters);
  }, [loadData, state.filters]);

  const setPeriod = useCallback((period: AnalyticsFilters['period'], customRange?: DateRange) => {
    const newFilters = {
      ...state.filters,
      period,
      customRange
    };
    dispatch({ type: 'SET_FILTERS', payload: newFilters });
    loadData(newFilters);
  }, [state.filters, loadData]);

  const setStudentFilter = useCallback((studentIds: string[]) => {
    const newFilters = { ...state.filters, studentIds };
    dispatch({ type: 'SET_FILTERS', payload: newFilters });
    loadData(newFilters);
  }, [state.filters, loadData]);

  const getInsights = useCallback((): Insight[] => {
    const insights: Insight[] = [...(state.data?.classInsights || [])];

    // Adicionar insights baseados em correlações
    if (state.correlations) {
      const { gad7VsEngagement } = state.correlations;

      if (gad7VsEngagement.significance === 'high') {
        insights.push({
          id: 'correlation-insight',
          type: 'info',
          title: 'Correlação forte detectada',
          description: gad7VsEngagement.pearsonCorrelation < 0
            ? 'Maior ansiedade está associada a menor engajamento'
            : 'Maior engajamento está associado a menor ansiedade',
          metric: 'correlation',
          value: gad7VsEngagement.pearsonCorrelation,
          createdAt: new Date()
        });
      }
    }

    return insights.sort((a, b) => {
      const priority = { risk: 0, warning: 1, info: 2, success: 3, trend: 4 };
      return (priority[a.type] || 5) - (priority[b.type] || 5);
    });
  }, [state.data, state.correlations]);

  // Carregar dados iniciais
  useEffect(() => {
    if (user?.id && !state.data && !state.isLoading) {
      loadData();
    }
  }, [user?.id]);

  return {
    ...state,
    loadData,
    refresh,
    setPeriod,
    setStudentFilter,
    getInsights,
    hasData: !!state.data,
    isEmpty: state.data?.summary.totalStudents === 0
  };
}