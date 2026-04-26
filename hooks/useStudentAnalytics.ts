// hooks/useStudentAnalytics.ts
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { StudentAnalyticsSummary, Insight } from '@/types/analytics';
import { AnalyticsService } from '@/lib/services/AnalyticsService';

/**
 * HOOK: useStudentAnalytics
 * Responsável por gerenciar o estado dos dados de analytics de um aluno específico.
 * Inclui logs agressivos para depuração de troca de contexto (ID do aluno).
 */
export function useStudentAnalytics(studentId: string) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [data, setData] = useState<StudentAnalyticsSummary | null>(null);

  // Instancia o serviço com base no papel do usuário
  const analyticsService = new AnalyticsService(user?.role);

  /**
   * Função principal de carga de dados
   */
  const loadStudentData = useCallback(async (weeks: number = 12) => {
    // Verificações de segurança com logs preventivos
    if (!user?.id) {
      console.warn('⚠️ [HOOK-ANALYTICS] Carga abortada: Usuário logado não identificado.');
      return;
    }
    if (!studentId) {
      console.warn('⚠️ [HOOK-ANALYTICS] Carga abortada: ID do aluno não fornecido.');
      return;
    }

    console.group(`📊 [HOOK-FETCH] Iniciando busca para Aluno: ${studentId}`);
    console.log('👤 Profissional solicitante:', user.id);
    console.log('⏳ Janela de histórico solicitada:', weeks, 'semanas');
    
    setLoading(true);
    setError(undefined);

    try {
      console.log('📡 Chamando AnalyticsService.getStudentAnalytics...');
      const studentData = await analyticsService.getStudentAnalytics(
        studentId,
        user.id,
        weeks
      );

      // Log crítico para verificar sincronização de XP e Nível (Matar erro do Nível 1 com 400 pontos)
      console.log('✅ [HOOK-SUCESSO] Dados recebidos do Service:', {
        aluno: studentData.studentName,
        xpReal: studentData.studentTotalPoints,
        nivelCalculado: studentData.currentMetrics?.level,
        conclusao: `${studentData.currentMetrics?.completionRate}%`,
        gad7Score: studentData.currentMetrics?.gad7Score ?? 'Sem avaliação'
      });

      setData(studentData);
    } catch (err: any) {
      console.error('❌ [HOOK-ERROR] Falha crítica no fetch:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados do aluno');
    } finally {
      setLoading(false);
      console.groupEnd();
    }
  }, [user?.id, user?.role, studentId]);

  /**
   * 🔥 REATIVIDADE E LIMPEZA:
   * Este efeito limpa o estado anterior e recarrega tudo se o ID na URL mudar.
   * Evita "dados fantasmas" de um aluno aparecendo no perfil de outro.
   */
  useEffect(() => {
    console.group(`🚀 [HOOK-WATCHER] Mudança de Contexto -> Aluno ID: ${studentId}`);
    
    if (studentId) {
      console.log('🧹 Resetando estado local (setData: null)');
      setData(null); 
      console.log('🔄 Disparando nova carga de dados...');
      loadStudentData();
    } else {
      console.log('⏭️ Aguardando ID de aluno válido...');
    }
    
    console.groupEnd();
  }, [studentId, loadStudentData]);

  /**
   * MÉTODOS DE APOIO (HELPERS)
   * Garantidos no retorno para evitar erro "is not a function" na UI.
   */
  const getPriorityInsights = useCallback((): Insight[] => {
    if (!data?.insights) {
      return [];
    }
    const filtered = data.insights.filter(i => i.type === 'risk' || i.type === 'warning');
    console.log(`💡 [INSIGHTS] Triagem: ${filtered.length} alertas encontrados.`);
    return filtered;
  }, [data]);

  const getWeeklyTrend = useCallback(() => {
    if (!data || !data.weeklyHistory || data.weeklyHistory.length < 2) {
      console.log('📈 [TREND] Dados insuficientes no histórico para calcular tendência.');
      return null;
    }
    const latest = data.weeklyHistory[0];
    const previous = data.weeklyHistory[1];

    const trend = {
      completionChange: (latest.completionRate || 0) - (previous.completionRate || 0),
      consistencyChange: (latest.consistencyScore || 0) - (previous.consistencyScore || 0),
      gad7Change: latest.gad7 ? (latest.gad7.score - (previous.gad7?.score || 0)) : 0,
      isImproving: latest.completionRate > previous.completionRate
    };

    console.log('📈 [TREND] Tendência Semanal processada:', trend);
    return trend;
  }, [data]);

  const getGAD7History = useCallback(() => {
    if (!data?.weeklyHistory) return [];
    
    const history = data.weeklyHistory
      .filter(week => week.gad7)
      .map(week => ({
        weekNumber: week.weekNumber,
        date: week.weekEndDate,
        score: week.gad7!.score,
        severity: week.gad7!.severity
      }));
      
    console.log(`🧠 [GAD7-MAP] Extraídas ${history.length} avaliações históricas.`);
    return history;
  }, [data]);

  const getActivityBreakdown = useCallback(() => {
    if (!data || !data.weeklyHistory || data.weeklyHistory.length === 0) return {};
    
    const breakdown = data.weeklyHistory[0].activityBreakdown;
    console.log('📑 [BREAKDOWN] Mapeamento de tipos de atividade da última semana ativo.');
    return breakdown;
  }, [data]);

  // Retorno completo para a página [id]/page.tsx
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