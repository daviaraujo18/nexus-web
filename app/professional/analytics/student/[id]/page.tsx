'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FaArrowLeft,
  FaUserGraduate,
  FaSchool,
  FaCalendarAlt,
  FaChartLine,
  FaHeart,
  FaFire,
  FaTrophy,
  FaCheckCircle,
  FaExclamationTriangle,
  FaClock,
  FaBrain,
  FaStar,
  FaMedal,
  FaRocket,
  FaGraduationCap,
  FaDownload,
  FaPrint,
  FaShare,
  FaBell,
  FaArrowRight,
  FaChevronDown,
  FaChevronUp,
  FaSmile,
  FaFrown,
  FaMeh,
  FaAngry,
  FaSyncAlt,
  FaTasks
} from 'react-icons/fa';
import { useStudentAnalytics } from '@/hooks/useStudentAnalytics';
import { useAuth } from '@/context/AuthContext';
import { getGradeLabel, getSchoolLabel } from '@/lib/utils/constants';

import { collection, query, where, getDocs } from 'firebase/firestore';
import { firestore } from '@/firebase/config';

/**
 * Página de analytics individual do aluno.
 *
 * Responsabilidades:
 * - Consolidar dados de múltiplas fontes (Firestore + hooks)
 * - Exibir métricas de desempenho, engajamento e saúde mental
 * - Permitir navegação entre abas (overview, history, gad7, insights)
 *
 * Fontes de dados:
 * - useStudentAnalytics (dados agregados)
 * - activityProgress (dados reais de execução)
 * - scheduleInstances (adesão ao cronograma)
 *
 * ⚠️ IMPORTANTE:
 * Este componente mistura:
 * - dados calculados (hook)
 * - dados brutos (Firestore)
 *
 * ⚠️ Impacto:
 * - decisões do profissional
 * - leitura de desempenho do aluno
 * - identificação de risco
 */
export default function StudentAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const studentId = params.id as string;

  const [expandedWeeks, setExpandedWeeks] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'gad7' | 'insights'>('overview');

  const [dbAdherence, setDbAdherence] = useState<number>(0);
  const [isFetching, setIsFetching] = useState(false);

  const {
    data: student,
    loading,
    error,
    loadStudentData,
    getPriorityInsights,
    getWeeklyTrend,
    getGAD7History,
    isAtRisk
  } = useStudentAnalytics(studentId);

  // Busca adesão real de scheduleInstances (top-level collection, sem collectionGroup)
  useEffect(() => {
    const fetchAdherence = async () => {
      if (!studentId) return;
      setIsFetching(true);
      try {
        const qInstances = query(
          collection(firestore, 'scheduleInstances'),
          where('studentId', '==', studentId)
        );
        const snapInstances = await getDocs(qInstances);
        if (!snapInstances.empty) {
          const percentages = snapInstances.docs.map(d => d.data().progressCache?.completionPercentage || 0);
          setDbAdherence(Math.max(...percentages));
        }
      } catch (err) {
        console.error('Erro ao buscar adesão:', err);
      } finally {
        setIsFetching(false);
      }
    };

    fetchAdherence();
  }, [studentId]);

  useEffect(() => {
    if (studentId) {
      loadStudentData(52); // Mesma janela que /student/progress (52 semanas)
    }
  }, [studentId, loadStudentData]);

  // Usa completedActivities do hook (mesmo dado que /student/progress: activityProgress where status=completed)
  const completedActivities = useMemo(() => student?.completedActivities ?? [], [student]);

  const totalRealTime = useMemo(() => {
    return completedActivities.reduce((acc, act) => acc + (act.duration || 0), 0);
  }, [completedActivities]);

  const avgTimePerActivity = useMemo(() => {
    return completedActivities.length > 0 ? Math.round(totalRealTime / completedActivities.length) : 0;
  }, [completedActivities, totalRealTime]);

  const toggleWeek = (weekNumber: number) => {
    setExpandedWeeks(prev =>
      prev.includes(weekNumber)
        ? prev.filter(w => w !== weekNumber)
        : [...prev, weekNumber]
    );
  };

  /**
   * Normaliza datas vindas do Firestore.
   *
   * Suporta:
   * - Timestamp (Firestore)
   * - Date
   * - string
   *
   * ⚠️ Evita erro comum:
   * date.toLocaleDateString is not a function
   */
  const formatDate = (date: any) => {
    if (!date) return '—';
    let d: Date;
    if (typeof date.toDate === 'function') d = date.toDate();
    else if (date instanceof Date) d = date;
    else d = new Date(date);

    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatPercentage = (value: number) => `${Math.round(value)}%`;
  const formatNumber = (value: number) => (value || 0).toLocaleString('pt-BR');
  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
  };

  // Cores e ícones baseados em valores
  const getCompletionColor = (rate: number) => {
    if (rate >= 80) return 'text-emerald-600 bg-emerald-50';
    if (rate >= 60) return 'text-indigo-600 bg-indigo-50';
    if (rate >= 40) return 'text-amber-600 bg-amber-50';
    if (rate >= 20) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  const getGAD7Color = (score?: number) => {
    if (!score && score !== 0) return 'text-slate-400 bg-slate-50';
    if (score <= 4) return 'text-emerald-600 bg-emerald-50';
    if (score <= 9) return 'text-amber-600 bg-amber-50';
    if (score <= 14) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  const getGAD7Icon = (score?: number) => {
    if (!score && score !== 0) return <FaMeh />;
    if (score <= 4) return <FaSmile className="text-emerald-600" />;
    if (score <= 9) return <FaMeh className="text-amber-600" />;
    if (score <= 14) return <FaFrown className="text-orange-600" />;
    return <FaAngry className="text-red-600" />;
  };

  const getTrendIcon = (trend?: string) => {
    switch (trend) {
      case 'improving': return <FaRocket className="text-emerald-500" />;
      case 'declining': return <FaExclamationTriangle className="text-amber-500" />;
      default: return <FaChartLine className="text-slate-400" />;
    }
  };

  const getSeverityLabel = (severity?: string) => {
    const labels = {
      minimal: 'Mínimo',
      mild: 'Leve',
      moderate: 'Moderado',
      severe: 'Severo'
    };
    return severity ? labels[severity as keyof typeof labels] : '—';
  };

  /**
   * Estado de carregamento inicial.
   *
   * Bloqueia renderização até dados essenciais carregarem.
   */
  if (loading && !student) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white flex items-center justify-center p-4">
        <div className="text-center">
          <div className="relative inline-block mb-6">
            <div className="w-20 h-20 border-4 border-indigo-200 rounded-full"></div>
            <div className="w-20 h-20 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
          </div>
          <h3 className="text-xl font-semibold text-slate-800 mb-2">Carregando relatório</h3>
          <p className="text-slate-600">Buscando dados do aluno...</p>
        </div>
      </div>
    );
  }

  /**
   * Estado de erro com fallback.
   *
   * Permite:
   * - retry
   * - navegação de volta
   */
  if (error || !student) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <div className="w-20 h-20 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <FaExclamationTriangle className="w-10 h-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">Ops! Algo deu errado</h2>
          <p className="text-slate-600 mb-6">{error || 'Não foi possível carregar os dados do aluno'}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => loadStudentData()}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all font-medium"
            >
              Tentar novamente
            </button>
            <button
              onClick={() => router.back()}
              className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-all font-medium"
            >
              Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 🔥 DEFINIÇÃO DAS VARIÁVEIS SEGURAS
  const priorityInsights = student ? getPriorityInsights() : [];
  const weeklyTrend = student ? getWeeklyTrend() : null;
  const gad7History = student ? getGAD7History() : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header com Navegação */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-white shadow-sm border border-slate-200 flex items-center justify-center group-hover:border-indigo-300 group-hover:text-indigo-600 transition-all">
                  <FaArrowLeft className="w-4 h-4" />
                </div>
                <span className="hidden sm:inline">Voltar para Analytics</span>
              </button>

              <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

              <div className="hidden sm:flex items-center gap-2 text-sm">
                <FaUserGraduate className="w-4 h-4 text-indigo-600" />
                <span className="text-slate-600">Relatório Individual</span>
              </div>
            </div>
          </div>

          {/* Banner do Aluno */}

          {/*
           * Banner principal do aluno.
           *
           * Exibe:
           * - nome
           * - escola
           * - série
           * - status de risco
           *
           * ⚠️ isAtRisk impacta visual diretamente
           */} 
          <div className={`relative overflow-hidden rounded-2xl ${isAtRisk
              ? 'bg-gradient-to-r from-amber-600 to-orange-600'
              : 'bg-gradient-to-r from-indigo-600 to-purple-600'
            } text-white shadow-xl`}>
            {/* Elementos decorativos */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-16 -mb-16"></div>

            <div className="relative p-6 md:p-8">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  <div className="w-24 h-24 md:w-28 md:h-28 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border-2 border-white/30 shadow-xl">
                    <span className="text-4xl md:text-5xl font-bold">
                      {student?.studentName?.charAt(0) || 'A'}
                    </span>
                  </div>
                </div>

                {/* Informações Principais */}
                <div className="flex-1">
                  <h1 className="text-2xl md:text-3xl font-bold mb-3 flex items-center gap-3">
                    {student?.studentName}
                    {isAtRisk && (
                      <span className="px-3 py-1 bg-red-500/20 backdrop-blur-sm rounded-full text-sm font-normal flex items-center gap-2">
                        <FaExclamationTriangle className="w-4 h-4" />
                        Atenção necessária
                      </span>
                    )}
                  </h1>

                  <div className="flex flex-wrap gap-4 text-indigo-100">
                    <span className="flex items-center gap-2">
                      <FaGraduationCap className="w-4 h-4" />
                      {getGradeLabel(student?.studentGrade)}
                    </span>

                    <span className="flex items-center gap-2">
                      <FaSchool className="w-4 h-4" />
                      {getSchoolLabel(student?.studentSchool)}
                    </span>

                    <span className="flex items-center gap-2">
                      <FaCalendarAlt className="w-4 h-4" />
                      Última atividade: {formatDate(student?.currentMetrics?.lastActivityDate)}
                    </span>
                  </div>
                </div>

                {/* Status Rápido */}
                <div className="flex-shrink-0 bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 text-center">
                  <div className="text-3xl font-bold mb-1">{student?.currentMetrics?.level || 1}</div>
                  <div className="text-sm text-indigo-100">Nível Atual</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs de Navegação */}

        {/*
         * Controle de navegação entre abas.
         *
         * Tabs:
         * - overview
         * - history
         * - gad7
         * - insights
         */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-1.5 mb-6">
          <div className="flex flex-wrap">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 py-3 px-4 font-medium rounded-lg text-center transition-all ${activeTab === 'overview'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-50'
                }`}
            >
              <div className="flex items-center justify-center gap-2">
                <FaChartLine className="w-4 h-4" />
                <span className="hidden sm:inline">Visão Geral</span>
                <span className="sm:hidden">Geral</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-3 px-4 font-medium rounded-lg text-center transition-all ${activeTab === 'history'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-50'
                }`}
            >
              <div className="flex items-center justify-center gap-2">
                <FaCalendarAlt className="w-4 h-4" />
                <span className="hidden sm:inline">Histórico</span>
                <span className="sm:hidden">Histórico</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('gad7')}
              className={`flex-1 py-3 px-4 font-medium rounded-lg text-center transition-all ${activeTab === 'gad7'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-50'
                }`}
            >
              <div className="flex items-center justify-center gap-2">
                <FaHeart className="w-4 h-4" />
                <span className="hidden sm:inline">Saúde Mental</span>
                <span className="sm:hidden">GAD-7</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('insights')}
              className={`flex-1 py-3 px-4 font-medium rounded-lg text-center transition-all ${activeTab === 'insights'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-50'
                }`}
            >
              <div className="flex items-center justify-center gap-2">
                <FaTasks className="w-4 h-4" />
                <span className="hidden sm:inline">Dados do Aluno</span>
                <span className="sm:hidden">Dados</span>
              </div>
            </button>
          </div>
        </div>

        {/* TAB: VISÃO GERAL */}

        {/*
         * Visão geral do desempenho do aluno.
         *
         * Dados:
         * - completionRate
         * - streak
         * - pontos
         * - GAD-7
         *
         * ⚠️ Mistura dados reais e agregados
         */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Cards de Métricas */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <FaChartLine className="w-5 h-5 text-indigo-600" />
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${getCompletionColor(student?.currentMetrics?.completionRate || 0)}`}>
                    {weeklyTrend?.isImproving ? 'Melhorando' : 'Estável'}
                  </span>
                </div>
                <div className="text-2xl font-bold text-slate-800 mb-1">
                  {(student?.currentMetrics?.completionRate || 0).toFixed(1)}%
                </div>
                <div className="text-sm text-slate-500">Taxa de Conclusão</div>
                <div className="mt-3 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full"
                    style={{ width: `${student?.currentMetrics?.completionRate || 0}%` }}
                  />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                    <FaFire className="w-5 h-5 text-amber-600" />
                  </div>
                  <span className="text-xs font-medium px-2 py-1 bg-amber-50 text-amber-600 rounded-full">
                    Sequência
                  </span>
                </div>
                <div className="text-2xl font-bold text-slate-800 mb-1">
                  {student?.currentMetrics?.streak || 0} <span className="text-sm font-normal text-slate-400">dias</span>
                </div>
                <div className="text-sm text-slate-500">Streak Atual</div>
                {(student?.currentMetrics?.streak || 0) > 0 && (
                  <div className="mt-3 text-xs text-amber-600 flex items-center gap-1">
                    <FaFire className="w-3 h-3" />
                    <span>Continue assim! 🔥</span>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <FaTrophy className="w-5 h-5 text-emerald-600" />
                  </div>
                  <span className="text-xs font-medium px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full">
                    Nível {student?.currentMetrics?.level || 1}
                  </span>
                </div>
                <div className="text-2xl font-bold text-slate-800 mb-1">
                  {formatNumber(student?.currentMetrics?.totalPoints || 0)}
                </div>
                <div className="text-sm text-slate-500">Pontos Totais</div>
                <div className="mt-3 text-xs text-slate-500">
                  Média de {student?.weeklyHistory?.[0]?.pointsEarned || 0} pts/semana
                </div>
              </div>

              <div className={`rounded-xl shadow-sm border p-5 hover:shadow-md transition-shadow ${getGAD7Color(student?.currentMetrics?.gad7Score).replace('text-', 'border-').replace('bg-', '')
                }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getGAD7Color(student?.currentMetrics?.gad7Score).replace('text-', 'bg-').replace('50', '100')
                    }`}>
                    {getGAD7Icon(student?.currentMetrics?.gad7Score)}
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${getGAD7Color(student?.currentMetrics?.gad7Score)}`}>
                    {getSeverityLabel(student?.currentMetrics?.gad7Severity)}
                  </span>
                </div>
                <div className="text-2xl font-bold text-slate-800 mb-1">
                  {student?.currentMetrics?.gad7Score || '—'}
                </div>
                <div className="text-sm text-slate-500">GAD-7</div>
                {student?.currentMetrics?.gad7Score && (
                  <div className="mt-3 text-xs text-slate-500">
                    Última avaliação: {formatDate(gad7History[0]?.date)}
                  </div>
                )}
              </div>
            </div>

            {/* Fatores de Risco e Insights Prioritários */}
            {((student?.riskFactors?.length || 0) > 0 || (priorityInsights?.length || 0) > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Fatores de Risco */}
                {(student?.riskFactors?.length || 0) > 0 && (
                  <div className="bg-amber-50 rounded-xl border border-amber-200 p-6">
                    <h3 className="font-semibold text-amber-800 mb-4 flex items-center gap-2 text-lg">
                      <FaExclamationTriangle className="w-5 h-5" />
                      Fatores de Atenção
                    </h3>
                    <div className="space-y-3">
                      {student.riskFactors.map((factor, index) => (
                        <div key={index} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-amber-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-amber-700">!</span>
                          </div>
                          <span className="text-amber-700">{factor}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Insights Prioritários */}
                {(priorityInsights?.length || 0) > 0 && (
                  <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-6">
                    <h3 className="font-semibold text-indigo-800 mb-4 flex items-center gap-2 text-lg">
                      <FaBrain className="w-5 h-5" />
                      Insights Personalizados
                    </h3>
                    <div className="space-y-3">
                      {priorityInsights.map((insight, index) => (
                        <div key={index} className="flex items-start gap-3">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${insight.type === 'risk' ? 'bg-red-200' :
                              insight.type === 'warning' ? 'bg-amber-200' :
                                insight.type === 'success' ? 'bg-emerald-200' :
                                  'bg-indigo-200'
                            }`}>
                            {insight.type === 'risk' && <FaExclamationTriangle className="w-3 h-3 text-red-700" />}
                            {insight.type === 'warning' && <FaExclamationTriangle className="w-3 h-3 text-amber-700" />}
                            {insight.type === 'success' && <FaCheckCircle className="w-3 h-3 text-emerald-700" />}
                            {insight.type === 'info' && <FaBrain className="w-3 h-3 text-indigo-700" />}
                          </div>
                          <div>
                            <span className="font-medium text-indigo-900">{insight.title}</span>
                            <p className="text-sm text-indigo-700 mt-1">{insight.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Gráfico de Progresso Simplificado */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-800 mb-6 flex items-center gap-2 text-lg">
                <FaChartLine className="w-5 h-5 text-indigo-600" />
                Evolução nas Últimas 8 Semanas
              </h3>

              <div className="space-y-4">
                {student?.weeklyHistory?.slice(0, 8).map((week, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <div className="w-16 text-sm font-medium text-slate-600">
                      Semana {week.weekNumber}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${week.completionRate >= 80 ? 'bg-emerald-500' :
                                week.completionRate >= 60 ? 'bg-indigo-500' :
                                  week.completionRate >= 40 ? 'bg-amber-500' :
                                    week.completionRate >= 20 ? 'bg-orange-500' :
                                      'bg-red-500'
                              }`}
                            style={{ width: `${week.completionRate}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-slate-700 min-w-[4rem]">
                          {week.completionRate.toFixed(0)}%
                        </span>
                      </div>
                      {week.gad7 && (
                        <div className="flex items-center gap-2 mt-1">
                          <FaHeart className={`w-3 h-3 ${week.gad7.score <= 4 ? 'text-emerald-500' :
                              week.gad7.score <= 9 ? 'text-amber-500' :
                                week.gad7.score <= 14 ? 'text-orange-500' :
                                  'text-red-500'
                            }`} />
                          <span className="text-xs text-slate-500">
                            GAD-7: {week.gad7.score} • {getSeverityLabel(week.gad7.severity)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Estatísticas Detalhadas - PLUGANDO VARIÁVEIS NA INTERFACE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h4 className="font-medium text-slate-700 mb-4 flex items-center gap-2">
                  <FaClock className="w-4 h-4 text-indigo-600" />
                  Engajamento
                </h4>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600">Consistência</span>
                      <span className="font-medium text-slate-800">
                        {(student?.currentMetrics?.consistencyScore || 0).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full"
                        style={{ width: `${student?.currentMetrics?.consistencyScore || 0}%` }}
                      />
                    </div>
                  </div>

                  {/* ADESÃO AO CRONOGRAMA */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600">Adesão ao cronograma</span>
                      <span className="font-medium text-slate-800">
                        {(dbAdherence > 0 ? dbAdherence : (student?.currentMetrics?.adherenceScore || 0)).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full"
                        style={{ width: `${dbAdherence > 0 ? dbAdherence : (student?.currentMetrics?.adherenceScore || 0)}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    {/* TEMPO TOTAL INVESTIDO */}
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Tempo total investido</span>
                      <span className="font-medium text-slate-800">
                        {formatTime(totalRealTime > 0 ? totalRealTime : (student?.weeklyHistory?.reduce((sum, w) => sum + (w.timeSpent || 0), 0) || 0))}
                      </span>
                    </div>
                    {/* MÉDIA POR ATIVIDADE */}
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-slate-600">Média por atividade</span>
                      <span className="font-medium text-slate-800">
                        {avgTimePerActivity > 0 ? avgTimePerActivity : Math.round((student?.weeklyHistory?.reduce((sum, w) => sum + (w.timeSpent || 0), 0) || 0) / (student?.weeklyHistory?.reduce((sum, w) => sum + (w.activitiesCompleted || 0), 0) || 1))} min
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h4 className="font-medium text-slate-700 mb-4 flex items-center gap-2">
                  <FaStar className="w-4 h-4 text-yellow-500" />
                  Conquistas
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <FaMedal className="w-8 h-8 text-yellow-500" />
                    <div>
                      <div className="font-medium text-slate-800">Pontuação Total</div>
                      <div className="text-sm text-slate-500">{formatNumber(student?.currentMetrics?.totalPoints || 0)} pontos</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <FaFire className="w-8 h-8 text-orange-500" />
                    <div>
                      <div className="font-medium text-slate-800">Maior Streak</div>
                      <div className="text-sm text-slate-500">
                        {Math.max(...(student?.weeklyHistory?.map(w => w.streakAtEnd) || [0]))} dias
                      </div>
                    </div>
                  </div>

                  {/* TOTAL DE ATIVIDADES */}
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <FaCheckCircle className="w-8 h-8 text-emerald-500" />
                    <div>
                      <div className="font-medium text-slate-800">Total de Atividades</div>
                      <div className="text-sm text-slate-500">
                        {completedActivities.length > 0 ? completedActivities.length : (student?.weeklyHistory?.reduce((sum, w) => sum + (w.activitiesCompleted || 0), 0) || 0)} concluídas
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: HISTÓRICO DETALHADO */}

        {/*
         * Histórico detalhado por semana.
         *
         * Mostra:
         * - completionRate
         * - pontos
         * - GAD-7
         * - breakdown diário
         */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200">
                <h3 className="font-semibold text-slate-800 text-lg flex items-center gap-2">
                  <FaCalendarAlt className="w-5 h-5 text-indigo-600" />
                  Histórico Semanal Completo
                </h3>
              </div>

              <div className="divide-y divide-slate-200">
                {student?.weeklyHistory?.map((week, index) => (
                  <div key={index} className="p-4 hover:bg-slate-50 transition-colors">
                    {/* Cabeçalho da Semana */}
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => toggleWeek(week.weekNumber)}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${week.completionRate >= 70 ? 'bg-emerald-100' :
                            week.completionRate >= 50 ? 'bg-indigo-100' :
                              week.completionRate >= 30 ? 'bg-amber-100' :
                                'bg-red-100'
                          }`}>
                          <span className="font-bold text-slate-700">{week.weekNumber}</span>
                        </div>
                        <div>
                          <div className="font-medium text-slate-800">
                            {formatDate(week.weekStartDate)} - {formatDate(week.weekEndDate)}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm">
                            <span className="text-slate-500">{(week.completionRate || 0).toFixed(1)}% concluído</span>
                            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                            <span className="text-slate-500">{week.pointsEarned} pontos</span>
                            {week.gad7 && (
                              <>
                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                <span className={`flex items-center gap-1 ${week.gad7.score <= 4 ? 'text-emerald-600' :
                                    week.gad7.score <= 9 ? 'text-amber-600' :
                                      week.gad7.score <= 14 ? 'text-orange-600' :
                                        'text-red-600'
                                  }`}>
                                  <FaHeart className="w-3 h-3" />
                                  GAD-7: {week.gad7.score}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {week.isImprovement && (
                          <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                            ↑ Melhora
                          </span>
                        )}
                        {week.isDecline && (
                          <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full">
                            ↓ Queda
                          </span>
                        )}
                        {expandedWeeks.includes(week.weekNumber) ? (
                          <FaChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <FaChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {/* Detalhes Expandidos */}
                    {expandedWeeks.includes(week.weekNumber) && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Breakdown por dia */}
                          <div>
                            <h5 className="text-sm font-medium text-slate-700 mb-3">Desempenho por dia</h5>
                            <div className="space-y-2">
                              {Object.entries(week.dailyBreakdown || {}).map(([day, data]: [string, any]) => {
                                const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                                return (
                                  <div key={day} className="flex items-center gap-2">
                                    <span className="w-8 text-xs font-medium text-slate-500">{days[parseInt(day)]}</span>
                                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-indigo-600 rounded-full"
                                        style={{ width: `${data.total > 0 ? (data.completed / data.total) * 100 : 0}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-slate-600 min-w-[4rem]">
                                      {data.completed}/{data.total} ativ.
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Métricas detalhadas */}
                          <div>
                            <h5 className="text-sm font-medium text-slate-700 mb-3">Métricas</h5>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-slate-600">Consistência</span>
                                <span className="font-medium text-slate-800">{(week.consistencyScore || 0).toFixed(1)}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600">Adesão</span>
                                <span className="font-medium text-slate-800">{(week.adherenceScore || 0).toFixed(1)}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600">Tempo investido</span>
                                <span className="font-medium text-slate-800">{formatTime(week.timeSpent || 0)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600">Streak no fim da semana</span>
                                <span className="font-medium text-slate-800">{week.streakAtEnd || 0} dias</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB: SAÚDE MENTAL (GAD-7) */}

        {/*
         * Visualização de saúde mental (GAD-7).
         *
         * Mostra:
         * - histórico de avaliações
         * - tendência
         * - severidade
         */}
        {activeTab === 'gad7' && (
          <div className="space-y-6">
            {/* Cards de resumo GAD-7 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="text-sm text-slate-500 mb-1">Última avaliação</div>
                <div className="text-2xl font-bold text-slate-800 mb-2">
                  {student?.currentMetrics?.gad7Score || '—'}
                </div>
                {student?.currentMetrics?.gad7Severity && (
                  <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getGAD7Color(student?.currentMetrics?.gad7Score)
                    }`}>
                    {getSeverityLabel(student?.currentMetrics?.gad7Severity)}
                  </div>
                )}
                <div className="text-xs text-slate-400 mt-3">
                  {gad7History[0] ? formatDate(gad7History[0].date) : '—'}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="text-sm text-slate-500 mb-1">Média histórica</div>
                <div className="text-2xl font-bold text-slate-800 mb-2">
                  {gad7History.length > 0
                    ? (gad7History.reduce((sum, g) => sum + g.score, 0) / gad7History.length).toFixed(1)
                    : '—'
                  }
                </div>
                <div className="text-xs text-slate-500">
                  {gad7History.length} avaliações no total
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="text-sm text-slate-500 mb-1">Tendência</div>
                <div className="flex items-center gap-2 mb-2">
                  {getTrendIcon(student?.trends?.gad7Score)}
                  <span className="text-lg font-semibold text-slate-800">
                    {student?.trends?.gad7Score === 'improving' ? 'Melhorando' :
                      student?.trends?.gad7Score === 'declining' ? 'Aumentando' :
                        'Estável'}
                  </span>
                </div>
                <div className="text-xs text-slate-500">
                  Confiança: {student?.trends?.confidence || 'N/A'}
                </div>
              </div>
            </div>

            {/* Histórico GAD-7 */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200">
                <h3 className="font-semibold text-slate-800 text-lg flex items-center gap-2">
                  <FaHeart className="w-5 h-5 text-rose-500" />
                  Histórico de Avaliações GAD-7
                </h3>
              </div>

              <div className="p-6">
                {gad7History.length === 0 ? (
                  <div className="text-center py-8">
                    <FaHeart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">Nenhuma avaliação GAD-7 encontrada</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {gad7History.map((assessment, index) => (
                      <div key={index} className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${assessment.score <= 4 ? 'bg-emerald-100' :
                            assessment.score <= 9 ? 'bg-amber-100' :
                              assessment.score <= 14 ? 'bg-orange-100' :
                                'bg-red-100'
                          }`}>
                          <span className="text-xl font-bold text-slate-700">{assessment.score}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-medium text-slate-800">Semana {assessment.weekNumber}</span>
                              <span className="text-sm text-slate-500 ml-3">{formatDate(assessment.date)}</span>
                            </div>
                            <span className={`text-sm font-medium px-3 py-1 rounded-full ${assessment.score <= 4 ? 'bg-emerald-100 text-emerald-700' :
                                assessment.score <= 9 ? 'bg-amber-100 text-amber-700' :
                                  assessment.score <= 14 ? 'bg-orange-100 text-orange-700' :
                                    'bg-red-100 text-red-700'
                              }`}>
                              {getSeverityLabel(assessment.severity)}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center gap-4 text-sm text-slate-500">
                            <span>Questionário completo</span>
                            {index > 0 && (
                              <>
                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                <span className={assessment.score < gad7History[index - 1].score ? 'text-emerald-600' : 'text-red-600'}>
                                  {assessment.score < gad7History[index - 1].score ? '↓ Melhorou' : '↑ Aumentou'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Interpretação GAD-7 */}
            <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-6">
              <h4 className="font-semibold text-indigo-800 mb-3 flex items-center gap-2">
                <FaBrain className="w-5 h-5" />
                Como interpretar o GAD-7
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                <div className="bg-white/50 p-3 rounded-lg">
                  <span className="font-medium text-emerald-700">0-4: Mínimo</span>
                  <p className="text-indigo-600 text-xs mt-1">Sintomas mínimos de ansiedade</p>
                </div>
                <div className="bg-white/50 p-3 rounded-lg">
                  <span className="font-medium text-amber-700">5-9: Leve</span>
                  <p className="text-indigo-600 text-xs mt-1">Sintomas leves, monitorar</p>
                </div>
                <div className="bg-white/50 p-3 rounded-lg">
                  <span className="font-medium text-orange-700">10-14: Moderado</span>
                  <p className="text-indigo-600 text-xs mt-1">Intervenção recomendada</p>
                </div>
                <div className="bg-white/50 p-3 rounded-lg">
                  <span className="font-medium text-red-700">15-21: Severo</span>
                  <p className="text-indigo-600 text-xs mt-1">Atenção imediata necessária</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: DADOS DO ALUNO */}

        {/*
         * Lista de atividades concluídas com dados reais.
         *
         * Origem:
         * - activityProgress
         *
         * Inclui:
         * - anexos
         * - descrição
         * - metadata (subject, grade)
         */}
        {activeTab === 'insights' && (
          <div className="space-y-4">
            {/* Header com contador */}
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <FaTasks className="w-4 h-4 text-indigo-600" />
                Atividades Concluídas
                {completedActivities.length > 0 && (
                  <span className="ml-1 text-xs font-medium bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                    {completedActivities.length}
                  </span>
                )}
              </h3>
              {isFetching && (
                <span className="text-xs text-slate-400">Carregando...</span>
              )}
            </div>

            {completedActivities.length === 0 && !isFetching ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <FaCheckCircle className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">Nenhuma atividade concluída ainda</p>
                <p className="text-slate-400 text-sm mt-1">As atividades aparecerão aqui conforme o aluno as completa</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                {completedActivities.map((act, index) => (
                  <div key={act.id || index} className="p-5 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start gap-4">
                      {/* Ícone */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        act.activityType === 'file' ? 'bg-blue-100' :
                        act.activityType === 'physical_activity' ? 'bg-emerald-100' :
                        'bg-indigo-100'
                      }`}>
                        {act.activityType === 'file'
                          ? <FaDownload className="w-4 h-4 text-blue-600" />
                          : act.activityType === 'physical_activity'
                            ? <FaTasks className="w-4 h-4 text-emerald-600" />
                            : <FaCheckCircle className="w-4 h-4 text-indigo-600" />
                        }
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0">
                        {/* Nome + badge */}
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="font-semibold text-slate-800 leading-snug">{act.name}</h4>
                          <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                            Concluída
                          </span>
                        </div>

                        {/* Descrição */}
                        {act.description && (
                          <p className="text-sm text-slate-600 mb-3 leading-relaxed">{act.description}</p>
                        )}

                        {/* Badges de contexto */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                            <FaSchool className="w-3 h-3" />
                            {getSchoolLabel(student?.studentSchool)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                            <FaGraduationCap className="w-3 h-3" />
                            {getGradeLabel(student?.studentGrade)}
                          </span>
                          {act.subject && (
                            <span className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full">
                              {act.subject}
                            </span>
                          )}
                          <span className="text-xs text-slate-400 ml-auto">
                            {formatDate(act.completedAt)}
                          </span>
                        </div>

                        {/* Documentos enviados */}
                        {act.activityType === 'file' && act.attachments?.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(act.attachments as string[]).map((url: string, i: number) => (
                              <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors border border-blue-100"
                              >
                                <FaDownload className="w-3 h-3" />
                                {act.attachments.length > 1 ? `Documento ${i + 1}` : 'Baixar documento'}
                              </a>
                            ))}
                          </div>
                        )}

                        {/* Indicação sem anexo para atividade de arquivo */}
                        {act.activityType === 'file' && (!act.attachments || act.attachments.length === 0) && (
                          <p className="mt-2 text-xs text-slate-400 italic">Nenhum arquivo enviado</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Rodapé com Ações */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-between items-center pt-6 border-t border-slate-200">
          <div className="text-sm text-slate-400">
            Última atualização: {new Date().toLocaleString('pt-BR')}
          </div>
        </div>
      </div>
    </div>
  );
}