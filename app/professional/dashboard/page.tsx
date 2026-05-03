// app/professional/dashboard/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  FaCalendarPlus, 
  FaUsers, 
  FaChartLine, 
  FaClock,
  FaArrowRight,
  FaExclamationTriangle,
  FaCalendarCheck,
  FaCalendarAlt,
  FaUserPlus,
  FaFileAlt,
  FaTrophy,
  FaFire,
  FaCheckCircle,
  FaChevronRight,
  FaBell,
  FaStar,
  FaChartBar,
  FaUserFriends,
  FaLightbulb,
  FaBullhorn,
  FaHistory,
  FaSync,
  FaSearch
} from 'react-icons/fa';
import { FiTrendingUp, FiActivity, FiTarget, FiZap } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { useSchedules } from '@/hooks/useSchedules';
import { ScheduleInstanceService } from '@/lib/services/ScheduleInstanceService';
import { StudentService } from '@/lib/services/StudentService';
import { collectionGroup, collection, query, where, getDocs } from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import SubjectBarChart, { computeSubjectStats, SubjectStat } from '@/components/charts/SubjectBarChart';
import { GRADE_OPTIONS, getGradeLabel } from '@/lib/utils/constants';

/**
 * Dashboard operacional do profissional.
 *
 * Responsabilidades:
 * - Exibir visão geral rápida (stats básicas)
 * - Mostrar cronogramas recentes
 * - Exibir alertas acionáveis
 * - Fornecer atalhos para ações principais
 *
 * Fontes de dados:
 * - Firestore (students, activityProgress)
 * - ScheduleInstanceService
 * - hooks locais (useSchedules)
 *
 * ⚠️ IMPORTANTE:
 * Diferente do AnalyticsPage, este dashboard usa:
 * - dados semi-brutos
 * - agregações locais simples
 *
 * ⚠️ Impacto:
 * - produtividade do profissional
 * - tomada de decisão rápida
 */
export default function ProfessionalDashboardPage() {
  const { user } = useAuth();

  /**
   * Hook para carregar cronogramas ativos do profissional.
   *
   * Configuração:
   * - apenas ativos
   * - limite de 5 (dashboard)
   *
   * ⚠️ Otimizado para exibição rápida
   */
  const { schedules, loading: schedulesLoading, refresh: refreshSchedules } = useSchedules({ 
    activeOnly: true,
    limit: 5 
  });
  
  /**
   * Estado consolidado de métricas rápidas do dashboard.
   *
   * Inclui:
   * - alunos totais
   * - alunos ativos
   * - cronogramas ativos
   * - taxa de conclusão
   *
   * ⚠️ Esses dados são calculados localmente
   */
  const [stats, setStats] = useState({
    totalStudents: 0,
    activeStudents: 0,
    activeSchedules: 0,
    pendingAssignments: 0,
    completionRate: 0,
    avgEngagement: 0
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [topStudents, setTopStudents] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [chartGrade, setChartGrade] = useState<string>('');
  const [chartStudentId, setChartStudentId] = useState<string>('');
  const [chartData, setChartData] = useState<SubjectStat[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  useEffect(() => {

    /**
     * Carrega todos os dados do dashboard.
     *
     * Fluxo:
     * 1. Busca alunos atribuídos
     * 2. Busca instâncias de cronograma
     * 3. Calcula métricas agregadas
     * 4. Monta ranking básico
     *
     * ⚠️ IMPORTANTE:
     * - mistura múltiplas queries
     * - faz agregação no cliente
     *
     * ⚠️ Risco:
     * - pode escalar mal com muitos alunos
     */
    const loadDashboardData = async () => {
      if (!user) return;
      
      try {
        setLoadingStats(true);
        
        /**
         * Busca alunos atribuídos ao profissional.
         *
         * Filtros:
         * - assignedProfessionals contém user.id
         * - isActive = true
         *
         * ⚠️ Fonte primária de dados do dashboard
         */
        const studentsSnap = await getDocs(
          query(
            collection(firestore, 'students'),
            where('profile.assignedProfessionals', 'array-contains', user.id),
            where('isActive', '==', true)
          )
        );
        const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        setAllStudents(students);
        
        // Contar instâncias ativas e calcular engajamento
        let activeInstances = 0;
        let totalCompletion = 0;
        let totalInstances = 0;
        const studentEngagement: any[] = [];
        
        /**
         * Calcula engajamento por aluno.
         *
         * Estratégia:
         * - limita para 10 alunos (performance)
         * - usa apenas a instância mais recente
         *
         * ⚠️ Trade-off:
         * precisão vs performance
         */
        for (const student of students.slice(0, 10)) {
          const instances = await ScheduleInstanceService.getStudentActiveInstances(
            student.id,
            { includeProgress: true, limit: 1 }
          );
          activeInstances += instances.length;
          
          if (instances.length > 0) {
            const instance = instances[0];
            if (instance.progressCache) {
              totalCompletion += instance.progressCache.completionPercentage;
              totalInstances++;
              studentEngagement.push({
                id: student.id,
                name: student.name,
                engagement: instance.progressCache.completionPercentage,
                streak: instance.progressCache.streakDays || 0
              });
            }
          }
        }
        
        /**
         * Ordena alunos por engajamento.
         *
         * Critério:
         * - completionPercentage
         *
         * ⚠️ Limitado ao top 3 para dashboard
         */
        const sortedStudents = studentEngagement
          .sort((a, b) => b.engagement - a.engagement)
          .slice(0, 3);
        
        setTopStudents(sortedStudents);
        
        const avgCompletion = totalInstances > 0 ? totalCompletion / totalInstances : 0;
        const avgEngagement = students.length > 0 
          ? (sortedStudents.reduce((sum, s) => sum + s.engagement, 0) / sortedStudents.length) 
          : 0;
        
          /**
           * Consolida métricas do dashboard.
           *
           * Inclui:
           * - taxa média de conclusão
           * - engajamento médio
           * - alunos ativos
           *
           * ⚠️ Algumas métricas são heurísticas (ex: atividade recente)
           */
        setStats({
          totalStudents: students.length,
          activeStudents: students.filter(s => {

            /**
             * Considera aluno ativo se teve atividade nos últimos 7 dias
             */
            const lastActivity = s.lastLoginAt || s.updatedAt;
            const daysSinceLastActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
            return daysSinceLastActivity < 7;
          }).length,
          activeSchedules: activeInstances,
          pendingAssignments: schedules.filter(s => !s.isActive).length,
          completionRate: Math.round(avgCompletion),
          avgEngagement: Math.round(avgEngagement)
        });
        
        // Simular atividades recentes (em produção, busque dados reais)
        setRecentActivities([
          { id: 1, type: 'assignment', title: 'Novo aluno atribuído', time: '10 min atrás', user: 'João Silva' },
          { id: 2, type: 'completion', title: 'Cronograma concluído', time: '2 horas atrás', user: 'Maria Santos' },
          { id: 3, type: 'progress', title: 'Progresso significativo', time: '1 dia atrás', user: 'Pedro Oliveira' },
          { id: 4, type: 'alert', title: 'Aluno necessita atenção', time: '2 dias atrás', user: 'Ana Costa' },
        ]);
        
      } catch (error) {
        console.error('Erro ao carregar dados do dashboard:', error);
      } finally {
        setLoadingStats(false);
      }
    };
    
    loadDashboardData();
  }, [user, schedules]);

  useEffect(() => {
    if (!chartStudentId) { setChartData([]); return; }
    const load = async () => {
      setChartLoading(true);
      try {

        /** 
         * Busca atividades concluídas para gerar gráfico por matéria.
         *
         * Fonte:
         * - collectionGroup(activityProgress)
         *
         * ⚠️ Pode ser pesado dependendo do volume
         */
        const q = query(
          collectionGroup(firestore, 'activityProgress'),
          where('studentId', '==', chartStudentId),
          where('status', '==', 'completed')
        );
        const snap = await getDocs(q);
        const docs = snap.docs.map(d => ({ status: 'completed', activitySnapshot: d.data().activitySnapshot }));
        setChartData(computeSubjectStats(docs));
      } catch { setChartData([]); }
      finally { setChartLoading(false); }
    };
    load();
  }, [chartStudentId]);

  /**
   * Atualiza dados do dashboard manualmente.
   *
   * ⚠️ Atualmente usa delay artificial (setTimeout)
   */
  const refreshData = () => {
    setLoadingStats(true);
    refreshSchedules();
    setTimeout(() => setLoadingStats(false), 1000);
  };

  const getEngagementColor = (rate: number) => {
    if (rate >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-100';
    if (rate >= 60) return 'text-amber-600 bg-amber-50 border-amber-100';
    return 'text-red-600 bg-red-50 border-red-100';
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'assignment': return <FaUserPlus className="w-4 h-4" />;
      case 'completion': return <FaCheckCircle className="w-4 h-4" />;
      case 'progress': return <FiTrendingUp className="w-4 h-4" />;
      case 'alert': return <FaExclamationTriangle className="w-4 h-4" />;
      default: return <FaBell className="w-4 h-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'assignment': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'completion': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'progress': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'alert': return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="p-4 md:p-6 min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30">
      {/* Header do Dashboard */}

      {/*
       * Header principal do dashboard.
       *
       * Exibe:
       * - saudação
       * - nome do profissional
       * - ações principais
      */} 
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
              <FaChartBar className="w-7 h-7 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-1">Dashboard Profissional</h1>
              <p className="text-gray-600">Bem-vindo(a), <span className="font-medium text-blue-700">{user?.name}</span></p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Link
              href="/professional/schedules/new"
              className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg transition-all duration-200 flex items-center gap-3"
            >
              <FaCalendarPlus className="w-4 h-4" />
              <span>Novo Cronograma</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Coluna Principal (2/3) */}
        <div className="lg:col-span-2 space-y-8">

          {/*
           * Lista cronogramas recentes do profissional.
           *
           * Limite:
           * - até 5 itens
           *
           * ⚠️ foco em acesso rápido
          */}
          {/* Cronogramas Recentes */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                    <FaCalendarAlt className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Cronogramas Recentes</h2>
                    <p className="text-sm text-gray-600">Seus cronogramas mais recentes</p>
                  </div>
                </div>
                <Link
                  href="/professional/schedules"
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                >
                  Ver todos
                  <FaChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
            
            {schedulesLoading ? (
              <div className="p-8 text-center">
                <div className="relative inline-block">
                  <div className="w-12 h-12 border-3 border-indigo-200 rounded-full"></div>
                  <div className="w-12 h-12 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                </div>
                <p className="mt-4 text-gray-600 font-medium">Carregando cronogramas...</p>
              </div>
            ) : schedules.length === 0 ? (
              <div className="p-8 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl mb-4">
                  <FaCalendarPlus className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  Nenhum cronograma criado
                </h3>
                <p className="text-gray-500 mb-6">
                  Comece criando seu primeiro cronograma personalizado
                </p>
                <Link
                  href="/professional/schedules/new"
                  className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transition-all duration-200"
                >
                  <FaCalendarPlus />
                  Criar Primeiro Cronograma
                </Link>
              </div>
            ) : (
              <div className="p-6">
                <div className="space-y-4">
                  {schedules.slice(0, 5).map(schedule => {
                    const categoryColor = schedule.category === 'therapeutic' ? 'bg-blue-100 text-blue-800' :
                                         schedule.category === 'educational' ? 'bg-emerald-100 text-emerald-800' :
                                         'bg-purple-100 text-purple-800';
                    
                    const categoryLabel = schedule.category === 'therapeutic' ? 'Terapêutico' :
                                         schedule.category === 'educational' ? 'Educacional' : 'Misto';
                    
                    return (
                      <div key={schedule.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-200 hover:shadow-sm transition-all duration-300">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            schedule.category === 'therapeutic' ? 'bg-gradient-to-br from-blue-50 to-blue-100' :
                            schedule.category === 'educational' ? 'bg-gradient-to-br from-emerald-50 to-emerald-100' :
                            'bg-gradient-to-br from-purple-50 to-purple-100'
                          }`}>
                            <FaCalendarAlt className={`w-5 h-5 ${
                              schedule.category === 'therapeutic' ? 'text-blue-600' :
                              schedule.category === 'educational' ? 'text-emerald-600' :
                              'text-purple-600'
                            }`} />
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-900">{schedule.name}</h4>
                            <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                              <div className="flex items-center gap-1">
                                <FaChartLine className="w-3 h-3" />
                                <span>{schedule.metadata.totalActivities || 0} atividades</span>
                              </div>
                              <span>•</span>
                              <div className="flex items-center gap-1">
                                <FaClock className="w-3 h-3" />
                                <span>{schedule.metadata.estimatedWeeklyHours}h/semana</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 text-xs font-medium rounded-full ${categoryColor}`}>
                            {categoryLabel}
                          </span>
                          
                          <Link
                            href={`/professional/schedules/${schedule.id}`}
                            className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition-colors"
                            title="Ver detalhes"
                          >
                            <FaArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          
          {/*
           * Gráfico de atividades concluídas por matéria.
           *
           * Filtros:
           * - série
           * - aluno
           *
           * ⚠️ Dados baseados em activityProgress
          */} 
          {/* Atividades por Matéria */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center">
                    <FaChartBar className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Atividades por Matéria</h2>
                    <p className="text-sm text-gray-600">Concluídas por disciplina</p>
                  </div>
                </div>
                {/* Dropdowns série + aluno */}
                <div className="flex gap-3 flex-wrap">
                  {/* Dropdown Série */}
                  <select
                    className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-violet-400 outline-none flex-1 min-w-[140px]"
                    value={chartGrade}
                    onChange={e => { setChartGrade(e.target.value); setChartStudentId(''); }}
                  >
                    <option value="">Todas as séries</option>
                    {GRADE_OPTIONS.filter(g =>
                      allStudents.some(s => s.profile?.grade === g.value)
                    ).map(g => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </select>
                  {/* Dropdown Aluno — filtra pela série selecionada */}
                  <select
                    className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-violet-400 outline-none flex-1 min-w-[160px]"
                    value={chartStudentId}
                    onChange={e => setChartStudentId(e.target.value)}
                  >
                    <option value="">Selecionar aluno</option>
                    {allStudents
                      .filter(s => !chartGrade || s.profile?.grade === chartGrade)
                      .map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="p-6">
              {!chartStudentId ? (
                <div className="text-center py-6 text-gray-400 text-sm">
                  {allStudents.length === 0
                    ? 'Nenhum aluno atribuído'
                    : 'Selecione um aluno para ver o gráfico'}
                </div>
              ) : chartLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <SubjectBarChart data={chartData} />
              )}
            </div>
          </div>
        </div>

        {/* Coluna Lateral (1/3) */}
        <div className="space-y-8">

          {/*
           * Atalhos para ações principais do sistema.
           *
           * Objetivo:
           * - reduzir fricção do usuário
           * - aumentar produtividade
          */}
          {/* Ações Rápidas */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center">
                <FiZap className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Ações Rápidas</h2>
                <p className="text-sm text-gray-600">Acesso rápido às principais funções</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <Link
                href="/professional/schedules/new"
                className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 rounded-xl border border-blue-200 hover:border-blue-300 hover:shadow-sm transition-all duration-200 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                    <FaCalendarPlus className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="font-medium">Criar Cronograma</span>
                </div>
                <FaChevronRight className="w-4 h-4 text-blue-400 group-hover:text-blue-600" />
              </Link>
              
              <Link
                href="/professional/students/assign"
                className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 rounded-xl border border-emerald-200 hover:border-emerald-300 hover:shadow-sm transition-all duration-200 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center">
                    <FaUserPlus className="w-4 h-4 text-emerald-600" />
                  </div>
                  <span className="font-medium">Atribuir Alunos</span>
                </div>
                <FaChevronRight className="w-4 h-4 text-emerald-400 group-hover:text-emerald-600" />
              </Link>
              
              <Link
                href="/professional/analytics"
                className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-700 rounded-xl border border-purple-200 hover:border-purple-300 hover:shadow-sm transition-all duration-200 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
                    <FaChartLine className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="font-medium">Ver Analytics</span>
                </div>
                <FaChevronRight className="w-4 h-4 text-purple-400 group-hover:text-purple-600" />
              </Link>
              
              <Link
                href="/professional/students"
                className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 rounded-xl border border-amber-200 hover:border-amber-300 hover:shadow-sm transition-all duration-200 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center">
                    <FaUserFriends className="w-4 h-4 text-amber-600" />
                  </div>
                  <span className="font-medium">Gerenciar Alunos</span>
                </div>
                <FaChevronRight className="w-4 h-4 text-amber-400 group-hover:text-amber-600" />
              </Link>
            </div>
          </div>
          
         {/*}
           * Sistema de alertas baseado em métricas.
           *
           * Exemplos:
           * - cronogramas pendentes
           * - baixo engajamento
           * - baixa taxa de conclusão
           *
           * ⚠️ Atua como sistema de decisão rápida
          */} 
          {/* Alertas e Notificações */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                <FaBell className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Alertas</h2>
                <p className="text-sm text-gray-600">Requerem sua atenção</p>
              </div>
            </div>
            
            <div className="space-y-3">
              {stats.pendingAssignments > 0 && (
                <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center mt-0.5">
                      <FaExclamationTriangle className="w-3 h-3 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium text-amber-800">
                        {stats.pendingAssignments} cronograma(s) para atribuir
                      </p>
                      <p className="text-sm text-amber-700 mt-1">
                        Atribua cronogramas pendentes aos alunos
                      </p>
                      <Link
                        href="/professional/schedules"
                        className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-800 mt-2"
                      >
                        Resolver agora
                        <FaArrowRight className="w-2 h-2" />
                      </Link>
                    </div>
                  </div>
                </div>
              )}
              
              {stats.activeStudents < stats.totalStudents / 2 && stats.totalStudents > 0 && (
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center mt-0.5">
                      <FaBullhorn className="w-3 h-3 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-blue-800">
                        Engajamento abaixo da média
                      </p>
                      <p className="text-sm text-blue-700 mt-1">
                        Apenas {stats.activeStudents} de {stats.totalStudents} alunos ativos
                      </p>
                      <Link
                        href="/professional/analytics"
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 mt-2"
                      >
                        Ver análise
                        <FaArrowRight className="w-2 h-2" />
                      </Link>
                    </div>
                  </div>
                </div>
              )}
              
              {stats.completionRate < 60 && stats.completionRate > 0 && (
                <div className="p-4 bg-gradient-to-r from-red-50 to-pink-50 rounded-xl border border-red-200">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 flex items-center justify-center mt-0.5">
                      <FaLightbulb className="w-3 h-3 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium text-red-800">
                        Taxa de conclusão baixa
                      </p>
                      <p className="text-sm text-red-700 mt-1">
                        {stats.completionRate}% de conclusão geral
                      </p>
                      <Link
                        href="/professional/analytics?tab=performance"
                        className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-800 mt-2"
                      >
                        Investigar
                        <FaArrowRight className="w-2 h-2" />
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/*
           * Lista de eventos recentes do sistema.
           *
           * ⚠️ Atualmente mockado (simulação)
           *
           * Em produção:
           * deve vir de logs reais
          */} 
          {/* Atividade Recente */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                <FaHistory className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Atividade Recente</h2>
                <p className="text-sm text-gray-600">Últimas atualizações</p>
              </div>
            </div>
            
            <div className="space-y-4">
              {recentActivities.map(activity => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${getActivityColor(activity.type)}`}>
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm">{activity.title}</div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="text-xs text-gray-500">{activity.user}</div>
                      <div className="text-xs text-gray-400">{activity.time}</div>
                    </div>
                  </div>
                </div>
              ))}
              
              <button className="w-full text-center text-sm text-indigo-600 hover:text-indigo-800 font-medium pt-2">
                Ver atividade completa
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}