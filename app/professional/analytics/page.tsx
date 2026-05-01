// app/professional/analytics/page.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FaChartLine,
  FaUsers,
  FaHeart,
  FaExclamationTriangle,
  FaSyncAlt,
  FaCalendarAlt,
  FaFilter,
  FaTrophy,
  FaFire,
  FaCheckCircle,
  FaArrowRight,
  FaUserGraduate,
  FaSchool,
  FaArrowLeft,
  FaSearch,
  FaStar,
  FaClock,
  FaGraduationCap
} from 'react-icons/fa';
import { useAnalytics } from '@/hooks/useAnalytics';
import { PeriodSelector } from '@/components/analytics/common/PeriodSelector';
import { StudentSelector } from '@/components/analytics/common/StudentSelector';
import { getGradeLabel, getSchoolLabel } from '@/lib/utils/constants';

/**
 * Dashboard analítico do profissional.
 *
 * Responsabilidades:
 * - Exibir métricas agregadas da turma
 * - Mostrar rankings (engajamento, bem-estar)
 * - Permitir navegação para relatórios individuais
 * - Aplicar filtros (período, alunos, escola, série)
 *
 * Fonte principal:
 * - useAnalytics (dados agregados do sistema)
 *
 * ⚠️ IMPORTANTE:
 * Este componente NÃO usa dados brutos diretamente.
 * Ele depende de dados já processados pelo AnalyticsService.
 *
 * ⚠️ Impacto:
 * - visão macro do profissional
 * - tomada de decisão estratégica
 */
export default function AnalyticsPage() {
  const router = useRouter();

  /**
   * Controle de navegação interna da página.
   *
   * Views:
   * - dashboard → visão geral
   * - student-list → seleção de alunos
   */
  const [view, setView] = useState<'dashboard' | 'student-list'>('dashboard');

  /**
   * Hook principal de analytics.
   *
   * Fornece:
   * - métricas agregadas
   * - rankings de alunos
   * - distribuição GAD-7
   * - heatmap da turma
   *
   * ⚠️ Tudo aqui já vem processado do backend/serviço
   */
  const {
    data: dashboardData,
    isLoading: dashboardLoading,
    error: dashboardError,
    filters,
    setPeriod,
    setStudentFilter,
    refresh: refreshDashboard,
    getInsights
  } = useAnalytics();

  const insights = getInsights();
  const metrics = dashboardData?.summary.metrics;

  // Formatação
  const formatPercentage = (value: number) => `${Math.round(value)}%`;
  const formatNumber = (value: number) => value.toLocaleString('pt-BR');

  /**
   * Redireciona para o relatório individual do aluno.
   *
   * Fluxo:
   * Dashboard → StudentAnalyticsPage
   *
   * ⚠️ Ponto de integração entre visão macro e micro
   */
  const handleSelectStudent = (studentId: string) => {
    router.push(`/professional/analytics/student/${studentId}`);
  };

  /**
   * Filtros locais para ranking de alunos.
   *
   * Permite:
   * - filtrar por escola
   * - filtrar por série
   *
   * ⚠️ Atua apenas na UI (não refaz query)
   */
  const [rankingFilters, setRankingFilters] = useState({
    school: 'all',
    grade: 'all'
  });

  /**
   * Extrai lista única de escolas dos alunos.
   *
   * Usado para popular filtro de seleção.
   */
  const getUniqueSchools = () => {
    if (!dashboardData?.studentRankings.byEngagement) return [];
    const schools = dashboardData.studentRankings.byEngagement
      .map(s => s.studentSchool)
      .filter((school, index, self) => school && self.indexOf(school) === index)
      .sort();
    return schools;
  };

  /**
   * Extrai lista única de séries dos alunos.
   *
   * Inclui ordenação numérica (1º, 2º, etc).
   */
  const getUniqueGrades = () => {
    if (!dashboardData?.studentRankings.byEngagement) return [];
    const grades = dashboardData.studentRankings.byEngagement
      .map(s => s.studentGrade)
      .filter((grade, index, self) => grade && self.indexOf(grade) === index)
      .sort((a, b) => {
        // Ordenar séries numericamente (1º Ano, 2º Ano, etc)
        const numA = parseInt(a);
        const numB = parseInt(b);
        return numA - numB;
      });
    return grades;
  };

  /**
   * Filtra alunos com base nos filtros ativos.
   *
   * Fonte:
   * - prioriza ranking de bem-estar (byWellness)
   * - fallback: ranking por pontos
   *
   * ⚠️ Não faz nova query → apenas filtra em memória
   */
  const getFilteredStudents = () => {
    const source = dashboardData?.studentRankings.byWellness ?? dashboardData?.studentRankings.byPoints ?? [];
    return source.filter(student => {
      if (rankingFilters.school !== 'all' && student.studentSchool !== rankingFilters.school) return false;
      if (rankingFilters.grade !== 'all' && student.studentGrade !== rankingFilters.grade) return false;
      return true;
    });
  };

  // Obter listas únicas
  const uniqueSchools = getUniqueSchools();
  const uniqueGrades = getUniqueGrades();
  const filteredStudents = getFilteredStudents();
  const topFilteredStudents = filteredStudents;

  /**
   * Calcula média GAD-7 dos alunos filtrados.
   *
   * ⚠️ Ignora alunos sem score
   */
  const studentsWithGAD7 = filteredStudents.filter(s => s.gad7Score != null);
  const filteredAverage = studentsWithGAD7.length > 0
    ? (studentsWithGAD7.reduce((acc, s) => acc + (s.gad7Score ?? 0), 0) / studentsWithGAD7.length).toFixed(1)
    : '–';

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Calcular alunos da página atual
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  /**
   * Estado de carregamento do dashboard.
   *
   * Bloqueia renderização até dados principais carregarem.
   */
  if (dashboardLoading && !dashboardData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <div className="text-center">
          <div className="relative inline-block mb-4">
            <div className="w-16 h-16 border-4 border-indigo-200 rounded-full"></div>
            <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
          </div>
          <p className="mt-4 text-slate-600 font-medium">
            Carregando dashboard...
          </p>
        </div>
      </div>
    );
  }

  /**
   * Estado de erro global do dashboard.
   *
   * Permite:
   * - retry manual
   * - recuperação de falha
   */
  if (dashboardError) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FaExclamationTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Erro ao carregar</h2>
          <p className="text-slate-600 mb-6">{dashboardError}</p>
          <button
            onClick={refreshDashboard}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all duration-200 font-medium"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header com Navegação */}

        /**
         * Header da página de analytics.
         *
         * Inclui:
         * - navegação
         * - título dinâmico
         * - tabs
         */
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link
                href="/professional/dashboard"
                className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors"
              >
                <FaArrowLeft className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>

              {view === 'student-list' && (
                <>
                  <span className="text-slate-300">/</span>
                  <span className="text-indigo-600 font-medium">Lista de Alunos</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-500">
              <FaChartLine className="w-4 h-4" />
              <span>Análise de Desempenho</span>
            </div>
          </div>

          {/* Título Principal */}
          <div className="mb-4">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
              {view === 'dashboard' ? 'Dashboard Analítico' : 'Relatórios Individuais'}
            </h1>
            <p className="text-slate-600 mt-1">
              {view === 'dashboard'
                ? 'Acompanhe o engajamento e saúde mental dos alunos'
                : 'Selecione um aluno para ver o relatório completo'}
            </p>
          </div>

          {/* Tabs de Navegação */}
          <div className="bg-white rounded-xl shadow-sm p-1.5 mb-6 border border-slate-200">
            <div className="flex">
              <button
                onClick={() => setView('dashboard')}
                className={`flex-1 py-3 px-4 font-medium rounded-lg text-center transition-all ${view === 'dashboard'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-50'
                  }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <FaChartLine className="w-4 h-4" />
                  <span>Dashboard Geral</span>
                </div>
              </button>

              <button
                onClick={() => setView('student-list')}
                className={`flex-1 py-3 px-4 font-medium rounded-lg text-center transition-all ${view === 'student-list'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-50'
                  }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <FaUserGraduate className="w-4 h-4" />
                  <span>Relatórios Individuais</span>
                </div>
              </button>
            </div>
          </div>

          {/* Filtros - Dashboard 
          {view === 'dashboard' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <FaFilter className="w-4 h-4 text-indigo-600" />
                <h3 className="font-medium text-slate-700">Filtros</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    <FaCalendarAlt className="inline mr-2 w-3 h-3" />
                    Período
                  </label>
                  <PeriodSelector value={filters.period} onChange={setPeriod} />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    <FaUsers className="inline mr-2 w-3 h-3" />
                    Alunos
                  </label>
                  <StudentSelector
                    selectedIds={filters.studentIds || []}
                    onChange={setStudentFilter}
                  />
                </div>
              </div>
            </div>
          )}*/}
        </div>

        {/* Conteúdo Principal */}
        <div className="mb-8">
          {/* DASHBOARD GERAL */}

          /**
           * Visão geral do desempenho da turma.
           *
           * Exibe:
           * - métricas globais
           * - rankings
           * - distribuição GAD-7
           * - heatmap semanal
           *
           * ⚠️ Representa o estado consolidado do sistema
           */
          {view === 'dashboard' && dashboardData && (
            <div className="space-y-6">
              {/* Alertas e Insights
              {insights.length > 0 && (
                <div className="space-y-3">
                  {insights.slice(0, 2).map(insight => (
                    <div
                      key={insight.id}
                      className={`rounded-xl p-4 border-l-4 ${
                        insight.type === 'risk' ? 'bg-red-50 border-red-500' :
                        insight.type === 'warning' ? 'bg-amber-50 border-amber-500' :
                        insight.type === 'success' ? 'bg-emerald-50 border-emerald-500' :
                        'bg-blue-50 border-blue-500'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          {insight.type === 'risk' && <FaExclamationTriangle className="w-5 h-5 text-red-600 mt-0.5" />}
                          {insight.type === 'warning' && <FaExclamationTriangle className="w-5 h-5 text-amber-600 mt-0.5" />}
                          {insight.type === 'success' && <FaCheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" />}

                          <div>
                            <h4 className="font-semibold text-slate-800">{insight.title}</h4>
                            <p className="text-sm text-slate-600 mt-1">{insight.description}</p>
                          </div>
                        </div>

                        {insight.action && insight.action.href === '/professional/analytics?filter=at_risk' && (
                          <button
                            onClick={() => setView('student-list')}
                            className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 whitespace-nowrap"
                          >
                            <span>{insight.action.label}</span>
                            <FaArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )} */}

              {/* Cards de Métricas */}

              /**
               * Cards de métricas principais.
               *
               * Inclui:
               * - total de alunos
               * - taxa média de conclusão
               * - streak médio
               * - média GAD-7
               */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <FaUsers className="w-5 h-5 text-indigo-600" />
                    </div>
                    <span className="text-xs font-medium text-slate-400">Total</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-800 mb-1">
                    {dashboardData.summary.totalStudents}
                  </div>
                  <div className="text-sm text-slate-500">
                    Ativos: <span className="font-medium text-slate-700">{dashboardData.summary.activeStudents}</span>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <FaCheckCircle className="w-5 h-5 text-emerald-600" />
                    </div>
                    <span className="text-xs font-medium text-slate-400">Média</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-800 mb-1">
                    {formatPercentage(metrics?.averageCompletionRate || 0)}
                  </div>
                  <div className="text-sm text-slate-500">
                    Taxa de conclusão
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                      <FaFire className="w-5 h-5 text-amber-600" />
                    </div>
                    <span className="text-xs font-medium text-slate-400">Média</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-800 mb-1">
                    {(metrics?.averageStreak || 0).toFixed(1)}
                  </div>
                  <div className="text-sm text-slate-500">
                    Dias consecutivos
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${(metrics?.averageGAD7Score || 0) > 10 ? 'bg-red-100' :
                      (metrics?.averageGAD7Score || 0) > 5 ? 'bg-amber-100' : 'bg-emerald-100'
                      }`}>
                      <FaHeart className={`w-5 h-5 ${(metrics?.averageGAD7Score || 0) > 10 ? 'text-red-600' :
                        (metrics?.averageGAD7Score || 0) > 5 ? 'text-amber-600' : 'text-emerald-600'
                        }`} />
                    </div>
                    <span className="text-xs font-medium text-slate-400">Média</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-800 mb-1">
                    {(metrics?.averageGAD7Score || 0).toFixed(1)}
                  </div>
                  <div className="text-sm text-slate-500">
                    Escala GAD-7
                  </div>
                </div>
              </div>

              {/* Grid Principal */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Coluna Esquerda - Rankings */}
                <div className="lg:col-span-1 space-y-6">
                  {/* Top Alunos */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-200">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                          <FaTrophy className="w-4 h-4 text-yellow-500" />
                          <span>Top Engajamento</span>
                        </h3>
                        <button
                          onClick={() => setView('student-list')}
                          className="text-indigo-600 hover:text-indigo-700"
                        >
                          <FaArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-100">

                      /**
                       * Ranking de alunos por engajamento.
                       *
                       * Base:
                       * - taxa de conclusão
                       *
                       * ⚠️ Limita exibição para top 5
                       */
                      {dashboardData.studentRankings.byEngagement.slice(0, 5).map((student, index) => (
                        <button
                          key={student.studentId}
                          onClick={() => handleSelectStudent(student.studentId)}
                          className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors text-left"
                        >
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${index === 0 ? 'bg-yellow-100 text-yellow-700' :
                            index === 1 ? 'bg-slate-200 text-slate-700' :
                              index === 2 ? 'bg-amber-100 text-amber-700' :
                                'bg-slate-100 text-slate-600'
                            }`}>
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-800 truncate">
                              {student.studentName}
                            </div>
                            <div className="text-xs text-slate-500">
                              {student.value.toFixed(1)}% conclusão
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Distribuição GAD-7 */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                    <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <FaHeart className="w-4 h-4 text-rose-500" />
                      <span>Distribuição GAD-7</span>
                    </h3>

                    {metrics && (
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-600">Mínimo</span>
                            /**
                             * Distribuição da saúde mental da turma.
                             *
                             * Categorias:
                             * - minimal
                             * - mild
                             * - moderate
                             * - severe
                             */
                            <span className="font-medium text-slate-700">{metrics.gad7Distribution.minimal.toFixed(1)}%</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${metrics.gad7Distribution.minimal}%` }} />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-600">Leve</span>
                            <span className="font-medium text-slate-700">{metrics.gad7Distribution.mild.toFixed(1)}%</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${metrics.gad7Distribution.mild}%` }} />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-600">Moderado</span>
                            <span className="font-medium text-slate-700">{metrics.gad7Distribution.moderate.toFixed(1)}%</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-orange-500 rounded-full" style={{ width: `${metrics.gad7Distribution.moderate}%` }} />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-600">Severo</span>
                            <span className="font-medium text-slate-700">{metrics.gad7Distribution.severe.toFixed(1)}%</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-red-500 rounded-full" style={{ width: `${metrics.gad7Distribution.severe}%` }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Coluna Direita - Detalhes */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Alunos em Risco 
                  {dashboardData.studentRankings.atRisk.length > 0 && (
                    <div className="bg-amber-50 rounded-xl shadow-sm border border-amber-200 overflow-hidden">
                      <div className="p-4 border-b border-amber-200">
                        <div className="flex items-center gap-2">
                          <FaExclamationTriangle className="w-5 h-5 text-amber-600" />
                          <h3 className="font-semibold text-amber-800">Alunos que precisam de atenção</h3>
                        </div>
                      </div>

                      <div className="divide-y divide-amber-200">
                        {dashboardData.studentRankings.atRisk.slice(0, 3).map(student => (
                          <button
                            key={student.studentId}
                            onClick={() => handleSelectStudent(student.studentId)}
                            className="w-full flex items-center justify-between p-4 hover:bg-amber-100/50 transition-colors text-left"
                          >
                            <div>
                              <div className="font-medium text-amber-900">{student.studentName}</div>
                              <div className="text-sm text-amber-700">{student.studentGrade}</div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-amber-700">
                                {student.value.toFixed(1)}% conclusão
                              </span>
                              <FaArrowRight className="w-4 h-4 text-amber-600" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}*/}

                  {/* Estatísticas Detalhadas */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                      <h4 className="text-sm font-medium text-slate-500 mb-3 flex items-center gap-2">
                        <FaChartLine className="w-4 h-4 text-indigo-500" />
                        Engajamento
                      </h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">Consistência média</span>
                          <span className="font-semibold text-slate-800">
                            {formatPercentage(metrics?.averageConsistencyScore || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">Adesão ao cronograma</span>
                          <span className="font-semibold text-slate-800">
                            {formatPercentage(metrics?.averageAdherenceScore || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">Tempo médio/atividade</span>
                          <span className="font-semibold text-slate-800">
                            {Math.round(metrics?.averageTimePerActivity || 0)} min
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                      <h4 className="text-sm font-medium text-slate-500 mb-3 flex items-center gap-2">
                        <FaStar className="w-4 h-4 text-yellow-500" />
                        Progresso
                      </h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">Atividades concluídas</span>
                          <span className="font-semibold text-slate-800">
                            {formatNumber(metrics?.totalActivitiesCompleted || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">Pontos totais</span>
                          <span className="font-semibold text-slate-800">
                            {formatNumber(metrics?.totalPointsEarned || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">Streak máximo</span>
                          <span className="font-semibold text-slate-800">
                            {metrics?.maxStreak || 0} dias
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Heatmap Simplificado */}

                  /**
                   * Heatmap de desempenho por dia da semana.
                   *
                   * Mostra:
                   * - média de conclusão por dia
                   *
                   * ⚠️ Baseado em dados agregados
                   */
                  {dashboardData.classHeatmap && Object.keys(dashboardData.classHeatmap).length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                      <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <FaCalendarAlt className="w-4 h-4 text-indigo-500" />
                        <span>Média de conclusão por dia da semana</span>
                      </h4>

                      <div className="grid grid-cols-7 gap-2">
                        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, index) => {
                          const dayData = dashboardData.classHeatmap[index] || { averageCompletion: 0, totalActivities: 0 };
                          const completion = !isNaN(dayData.averageCompletion) ? dayData.averageCompletion : 0;
                          const roundedCompletion = Math.round(completion);

                          return (
                            <div key={day} className="text-center">
                              <div className="text-xs font-medium text-slate-500 mb-2">{day}</div>
                              <div className={`p-2 rounded-lg ${completion >= 70 ? 'bg-emerald-100 text-emerald-700' :
                                completion >= 50 ? 'bg-indigo-100 text-indigo-700' :
                                  completion >= 30 ? 'bg-amber-100 text-amber-700' :
                                    completion > 0 ? 'bg-rose-100 text-rose-700' :
                                      'bg-slate-100 text-slate-400'
                                }`}>
                                <div className="text-sm font-bold">
                                  {completion > 0 ? `${roundedCompletion}%` : '—'}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Rodapé informativo */}
                      <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
                        {Object.values(dashboardData.classHeatmap).some(d => !isNaN(d.averageCompletion) && d.averageCompletion > 0) ? (
                          <div className="flex justify-between items-center">
                            <span>Baseado em {
                              Object.values(dashboardData.classHeatmap).reduce((sum, d) => sum + (d.totalActivities || 0), 0)
                            } atividades</span>
                            <span className="text-indigo-600">Média da turma</span>
                          </div>
                        ) : (
                          <span className="text-center block">Calculando médias... (dados insuficientes)</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* RANKING DE PONTUAÇÃO COM FILTROS */}

                  /**
                   * Ranking baseado em bem-estar (GAD-7).
                   *
                   * Ordena alunos considerando:
                   * - saúde mental
                   * - engajamento
                   *
                   * ⚠️ Pode ser usado para identificar alunos em risco
                   */
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mt-6">
                    {/* Header - Adaptado para mobile */}
                    <div className="flex flex-col gap-3 mb-4">
                      <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                        <FaHeart className="w-5 h-5 text-rose-500 flex-shrink-0" />
                        <span className="truncate">Ranking de Bem-Estar</span>
                      </h4>

                      {/* Filtros - Agora com scroll horizontal no mobile */}
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {/* Filtro de Escola */}
                        <select
                          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-500 flex-shrink-0 max-w-[140px] sm:max-w-none"
                          value={rankingFilters.school}
                          onChange={(e) => setRankingFilters(prev => ({ ...prev, school: e.target.value }))}
                        >
                          <option value="all">Todas escolas</option>
                          {uniqueSchools.map(school => (
                            <option key={school} value={school} className="truncate">
                              {getSchoolLabel(school)}
                            </option>
                          ))}
                        </select>

                        {/* Filtro de Série */}
                        <select
                          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-500 flex-shrink-0 max-w-[120px] sm:max-w-none"
                          value={rankingFilters.grade}
                          onChange={(e) => setRankingFilters(prev => ({ ...prev, grade: e.target.value }))}
                        >
                          <option value="all">Todas séries</option>
                          {uniqueGrades.map(grade => (
                            <option key={grade} value={grade}>
                              {getGradeLabel(grade)}
                            </option>
                          ))}
                        </select>

                        {/* Botão limpar filtros (versão mobile com ícone) */}
                        {(rankingFilters.school !== 'all' || rankingFilters.grade !== 'all') && (
                          <button
                            onClick={() => setRankingFilters({ school: 'all', grade: 'all' })}
                            className="flex-shrink-0 px-3 py-1.5 text-sm bg-indigo-50 text-indigo-600 rounded-lg font-medium hover:bg-indigo-100 transition-colors whitespace-nowrap"
                          >
                            <span className="hidden sm:inline">Limpar filtros</span>
                            <span className="sm:hidden">Limpar</span>
                          </button>
                        )}

                        {/* Indicador de atualização - escondido no mobile muito pequeno */}
                        <span className="hidden xs:inline-flex text-xs text-slate-400 flex-shrink-0 ml-auto">
                          {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {/* Lista Vertical do Ranking - Adaptada para mobile */}
                    <div className="space-y-2">
                      {topFilteredStudents.length > 0 ? (
                        paginatedStudents.map((student, index) => {
                          const globalIndex = (currentPage - 1) * itemsPerPage + index;

                          // Cores para o pódio
                          const podiumColors = [
                            'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200',
                            'bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200',
                            'bg-gradient-to-r from-amber-50 to-amber-100 border-amber-200',
                          ];

                          const isPodium = index < 3;

                          return (
                            <button
                              key={student.studentId}
                              onClick={() => handleSelectStudent(student.studentId)}
                              className={`group w-full text-left p-3 rounded-xl transition-all duration-200 border hover:shadow-md ${isPodium
                                ? podiumColors[index] + ' hover:border-opacity-50'
                                : 'bg-white border-slate-200 hover:border-rose-300 hover:bg-rose-50/20'
                                }`}
                            >
                              <div className="flex items-start gap-3">
                                {/* Posição */}
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold flex-shrink-0 text-sm mt-0.5 ${
                                  index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-white' :
                                  index === 1 ? 'bg-gradient-to-br from-slate-400 to-slate-500 text-white' :
                                  index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white' :
                                  'bg-slate-100 text-slate-600'
                                }`}>
                                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${globalIndex + 1}`}
                                </div>

                                {/* Dados principais */}
                                <div className="flex-1 min-w-0">
                                  {/* Nome */}
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold text-slate-800 truncate group-hover:text-rose-700 transition-colors text-sm">
                                      {student.studentName}
                                    </span>
                                    {student.isAtRisk && (
                                      <FaExclamationTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" title="Aluno em risco" />
                                    )}
                                  </div>

                                  {/* Série + Escola */}
                                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 mb-2">
                                    <span className="flex items-center gap-1">
                                      <FaGraduationCap className="w-3 h-3 text-slate-400" />
                                      {getGradeLabel(student.studentGrade) || '—'}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <FaSchool className="w-3 h-3 text-slate-400" />
                                      <span className="truncate max-w-[140px]">{getSchoolLabel(student.studentSchool) || '—'}</span>
                                    </span>
                                  </div>

                                  {/* GAD-7 + Atividades */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {student.gad7Score != null ? (
                                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                                        student.gad7Severity === 'minimal' ? 'bg-emerald-100 text-emerald-700' :
                                        student.gad7Severity === 'mild' ? 'bg-amber-100 text-amber-700' :
                                        student.gad7Severity === 'moderate' ? 'bg-orange-100 text-orange-700' :
                                        'bg-red-100 text-red-700'
                                      }`}>
                                        <FaHeart className="w-2.5 h-2.5" />
                                        GAD-7: {student.gad7Score}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-300 italic">sem GAD-7</span>
                                    )}
                                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                                      <FaCheckCircle className="w-2.5 h-2.5" />
                                      {student.completedActivities ?? 0} atividades
                                    </span>
                                  </div>
                                </div>

                                {/* Seta */}
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity self-center">
                                  <FaArrowRight className="w-3.5 h-3.5 text-rose-400" />
                                </div>
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        // Mensagem quando não há alunos
                        <div className="text-center py-6 sm:py-8 bg-slate-50 rounded-xl">
                          <FaUserGraduate className="w-8 h-8 sm:w-12 sm:h-12 text-slate-300 mx-auto mb-2 sm:mb-3" />
                          <p className="text-sm sm:text-base text-slate-600 px-4">
                            Nenhum aluno encontrado com os filtros selecionados
                          </p>
                          <button
                            onClick={() => setRankingFilters({ school: 'all', grade: 'all' })}
                            className="mt-2 sm:mt-3 text-xs sm:text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                          >
                            Limpar filtros
                          </button>
                        </div>
                      )}

                      {/* Paginação - Adaptada para mobile 
                      {filteredStudents.length > itemsPerPage && (
                        <div className="flex items-center justify-center gap-1 sm:gap-2 mt-4">
                          <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border rounded-lg disabled:opacity-50 text-gray-600 hover:bg-slate-50 transition-colors"
                          >
                            <span className="hidden xs:inline">Anterior</span>
                            <span className="xs:hidden">←</span>
                          </button>

                          <span className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-600">
                            <span className="hidden xs:inline">Página </span>
                            {currentPage} de {Math.ceil(filteredStudents.length / itemsPerPage)}
                          </span>

                          <button
                            onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredStudents.length / itemsPerPage), p + 1))}
                            disabled={currentPage === Math.ceil(filteredStudents.length / itemsPerPage)}
                            className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border rounded-lg disabled:opacity-50 text-gray-600 hover:bg-slate-50 transition-colors"
                          >
                            <span className="hidden xs:inline">Próxima</span>
                            <span className="xs:hidden">→</span>
                          </button>
                        </div>
                      )}*/}
                    </div>

                    {/* Rodapé com estatísticas - Adaptado para mobile 
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 text-xs">
                        <span className="text-slate-500 flex items-center gap-1">
                          <span>🏆</span>
                          <span className="truncate">
                            Total: <span className="font-medium text-slate-700">{filteredStudents.length} alunos</span>
                            {filteredStudents.length !== dashboardData?.studentRankings.byEngagement.length && (
                              <span className="text-slate-400 ml-1 hidden sm:inline">
                                (filtrados de {dashboardData?.studentRankings.byEngagement.length})
                              </span>
                            )}
                          </span>
                        </span>

                        <span className="text-slate-500 flex items-center gap-1">
                          <span>⭐</span>
                          <span className="truncate">
                            Média GAD-7: <span className="font-medium text-slate-700">{filteredAverage}</span>
                          </span>
                        </span>
                      </div>

                      {filteredStudents.length !== dashboardData?.studentRankings.byEngagement.length && (
                        <p className="xs:hidden text-[10px] text-slate-400 mt-1 text-center">
                          Filtrados de {dashboardData?.studentRankings.byEngagement.length} alunos totais
                        </p>
                      )}
                    </div>*/}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* LISTA DE ALUNOS PARA RELATÓRIOS INDIVIDUAIS */}

          /**
           * Lista de alunos para seleção manual.
           *
           * Permite:
           * - acesso direto ao relatório individual
           */
          {view === 'student-list' && dashboardData && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <FaSearch className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Selecione um aluno</h3>
                  <p className="text-sm text-slate-500">
                    Clique em um aluno para visualizar o relatório completo com histórico e análises detalhadas
                  </p>
                </div>
              </div>

              {/* Lista de Alunos */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dashboardData?.studentRankings.byEngagement.map(student => (
                  <button
                    key={student.studentId}
                    onClick={() => handleSelectStudent(student.studentId)}
                    className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl hover:bg-indigo-50 transition-colors text-left border border-slate-200 hover:border-indigo-300 group"
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                      {student.studentName.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-slate-800 group-hover:text-indigo-700">
                        {student.studentName}
                      </div>
                      <div className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                        <FaGraduationCap className="w-3 h-3" />
                        <span>{getGradeLabel(student.studentGrade)}</span>
                      </div>
                    </div>
                    <FaArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                  </button>
                ))}
              </div>

              {/* Mensagem se não houver alunos */}
              {(!dashboardData?.studentRankings.byEngagement || dashboardData.studentRankings.byEngagement.length === 0) && (
                <div className="text-center py-12">
                  <FaUserGraduate className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">Nenhum aluno encontrado</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé Informativo */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <FaChartLine className="w-5 h-5 text-indigo-600" />
            Como usar este dashboard
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="font-medium text-slate-700 mb-2">📊 Monitoramento Contínuo</div>
              <p className="text-sm text-slate-600">
                Acompanhe o engajamento e desempenho dos alunos em tempo real
              </p>
            </div>
            <div>
              <div className="font-medium text-slate-700 mb-2">🔍 Identificação de Padrões</div>
              <p className="text-sm text-slate-600">
                Detecte tendências e padrões de comportamento para intervenções proativas
              </p>
            </div>
            <div>
              <div className="font-medium text-slate-700 mb-2">🎯 Tomada de Decisão</div>
              <p className="text-sm text-slate-600">
                Use dados concretos para ajustar estratégias e personalizar abordagens
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}