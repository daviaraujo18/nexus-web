// components/analytics/StudentReports.tsx
//
// COMPONENTE LEGADO — NÃO UTILIZADO EM PRODUÇÃO
//
// Este componente era responsável por exibir o relatório individual de um aluno
// dentro da mesma página do dashboard analítico, antes da migração para rota dedicada.
//
// A funcionalidade foi migrada para:
//   - Rota: `app/professional/analytics/student/[id]/page.tsx`
//   - Hook: `useStudentAnalytics`
//
// A nova implementação separou a visão de turma (dashboard) da visão individual
// (rota `/student/[id]`), permitindo deep-link direto para o perfil de um aluno
// e melhor separação de responsabilidades.
//
// Mantido para referência histórica. Não deve ser importado por novas rotas.
//
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FaUser,
  FaChartBar,
  FaCalendarWeek,
  FaClock,
  FaStar,
  FaDownload,
  FaPrint,
  FaShare,
  FaLightbulb,
  FaExclamationCircle,
  FaSchool,
  FaGraduationCap,
  FaFire,
  FaSpinner,
  FaCalendarAlt,
  FaCheckCircle,
  FaRegClock,
  FaUserGraduate,
  FaBrain,
  FaHeart,
  FaBook,
  FaChartLine,
  FaTrophy,
  FaCalendarDay,
  FaUsers,
  FaArrowLeft,
  FaEye,
  FaEyeSlash
} from "react-icons/fa";
import { useAuth } from '@/context/AuthContext';
import { SimpleReportService } from '@/lib/services/SimpleReportService';
import { StudentService } from '@/lib/services/StudentService';
import { Student, Professional } from '@/types/auth';
import { StudentReport, WeeklyReportData } from '@/types/schedule';
import { FaArrowRightArrowLeft, FaArrowTrendDown, FaArrowTrendUp } from 'react-icons/fa6';

interface StudentReportsProps {
  studentId?: string;
  showHeader?: boolean;
  onBack?: () => void;
}

// Tipos auxiliares
interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'indigo';
  trend?: number;
}

interface DayPerformance {
  dayName: string;
  shortName: string;
  completed: number;
  total: number;
  completionRate: number;
}

export default function StudentReports({
  studentId,
  showHeader = true,
  onBack
}: StudentReportsProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [report, setReport] = useState<StudentReport | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'weekly' | 'insights' | 'patterns'>('overview');
  const [showEmotionalData, setShowEmotionalData] = useState(false);

  // Determinar ID do aluno
  const targetStudentId = studentId || (user?.role === 'student' ? user.id : null);

  // Carregar dados
  const loadData = useCallback(async () => {
    if (!targetStudentId) {
      setLoading(false);
      setError(null);
      setStudent(null);
      setReport(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 1. Buscar dados básicos do aluno
      const studentData = await loadStudentBasicData(targetStudentId);
      setStudent(studentData);

      // 2. Gerar relatório completo
      const studentReport = await SimpleReportService.generateStudentReport(targetStudentId);
      setReport(studentReport);

      // 3. Se for o próprio aluno, logar visualização
      if (user?.role === 'student' && user.id === targetStudentId) {
        // Log de auto-visualização
        console.log(`Aluno ${studentData.name} visualizou próprio relatório`);
      }

    } catch (err: any) {
      console.error('Erro ao carregar relatórios:', err);
      setError(err.message || 'Erro ao carregar dados do aluno');
    } finally {
      setLoading(false);
    }
  }, [targetStudentId, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
  if (report) {
    console.log("Estado 'report' atualizado:", report);
  }
}, [report]);

console.log(report)

  // Função para carregar dados básicos do aluno
  const loadStudentBasicData = async (id: string): Promise<Student> => {
    try {
      // Usando método existente do StudentService
      const studentData = await StudentService.getStudentById(id, user?.id || '');
      
      return {
        id,
        email: studentData.email,
        name: studentData.name,
        role: 'student',
        profileComplete: studentData.profileComplete || true,
        isActive: studentData.isActive !== false,
        createdAt: studentData.createdAt,
        updatedAt: studentData.updatedAt,
        lastLoginAt: studentData.lastLoginAt,
        profile: {
          cpf: studentData.profile?.cpf || '',
          birthday: studentData.profile?.birthday || new Date(),
          phone: studentData.profile?.phone || '',
          school: studentData.profile?.school || 'Não informada',
          grade: studentData.profile?.grade || 'Não informada',
          parentName: studentData.profile?.parentName,
          parentEmail: studentData.profile?.parentEmail,
          parentPhone: studentData.profile?.parentPhone,
          medicalInfo: studentData.profile?.medicalInfo,
          address: studentData.profile?.address,
          assignedProfessionals: studentData.profile?.assignedProfessionals || [],
          assignedPrograms: studentData.profile?.assignedPrograms || [],
          streak: studentData.profile?.streak || 0,
          totalPoints: studentData.profile?.totalPoints || 0,
          level: studentData.profile?.level || 1,
          achievements: studentData.profile?.achievements || []
        }
      };
    } catch (error) {
      console.error('Erro ao carregar dados básicos do aluno:', error);
      // Fallback minimalista
      return {
        id,
        email: '',
        name: 'Aluno',
        role: 'student',
        profileComplete: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        profile: {
          cpf: '',
          birthday: new Date(),
          school: 'Não informada',
          grade: 'Não informada',
          assignedProfessionals: [],
          assignedPrograms: [],
          streak: 0,
          totalPoints: 0,
          level: 1,
          achievements: []
        }
      };
    }
  };

  // Se não tem aluno selecionado (apenas para profissionais)
  if (!targetStudentId && user?.role !== 'student') {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
          <FaUserGraduate className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700">
          Selecione um aluno
        </h3>
        <p className="text-gray-500">
          Escolha um aluno na lista para visualizar o relatório individual
        </p>
      </div>
    );
  }

  // Funções auxiliares
  const getTrendColor = (trend: 'improving' | 'stable' | 'declining') => {
    switch (trend) {
      case 'improving': return 'text-green-600';
      case 'declining': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getTrendIcon = (trend: 'improving' | 'stable' | 'declining') => {
    switch (trend) {
      case 'improving': return <FaArrowTrendUp className="text-green-500" />;
      case 'declining': return <FaArrowTrendDown className="text-red-500" />;
      default: return <FaArrowRightArrowLeft className="text-gray-400" />;
    }
  };

  const getTrendBadge = (trend: 'improving' | 'stable' | 'declining', confidence: 'high' | 'medium' | 'low') => {
    const baseColors = {
      improving: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
      stable: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
      declining: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' }
    }[trend];

    const confidenceText = {
      high: 'Alta confiança',
      medium: 'Confiança média',
      low: 'Baixa confiança'
    }[confidence];

    return (
      <span className={`px-3 py-1 text-xs rounded-full border ${baseColors.bg} ${baseColors.text} ${baseColors.border}`}>
        {trend === 'improving' ? ' Melhorando' :
          trend === 'declining' ? ' Decaindo' : ' Estável'} • {confidenceText}
      </span>
    );
  };

  const formatDateRange = (start: Date, end: Date) => {
    return `${start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} - ${end.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`;
  };

  const formatTime = (minutes: number) => {
    if (!minutes || minutes === 0) return '0 min';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h${mins}min` : `${hours}h`;
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getMetricColorClass = (value: number, type: 'percentage' | 'score' | 'time' = 'percentage') => {
    if (type === 'percentage' || type === 'score') {
      if (value >= 80) return 'text-green-600';
      if (value >= 60) return 'text-yellow-600';
      return 'text-red-600';
    }
    return 'text-blue-600';
  };

  // Calcular desempenho por dia da semana (adaptado para dados reais)
  const calculateDayPerformance = (): DayPerformance[] => {
    if (!report || report.weeklyReports.length === 0) {
      return [];
    }

    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const shortNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    
    // Agregar dados de todas as semanas
    const dayStats = Array(7).fill(null).map(() => ({ completed: 0, total: 0 }));

    report.weeklyReports.forEach(week => {
      Object.entries(week.dayBreakdown).forEach(([dayStr, data]) => {
        const day = parseInt(dayStr);
        if (day >= 0 && day < 7) {
          dayStats[day].completed += data.completed || 0;
          dayStats[day].total += data.total || 0;
        }
      });
    });

    return dayStats.map((stats, index) => ({
      dayName: dayNames[index],
      shortName: shortNames[index],
      completed: stats.completed,
      total: stats.total,
      completionRate: stats.total > 0 ? (stats.completed / stats.total) * 100 : 0
    }));
  };

  // Calcular tipos de atividade mais comuns
  const getActivityTypeAnalysis = () => {
    if (!report || report.weeklyReports.length === 0) return [];

    const typeStats: Record<string, { completed: number; total: number; totalScore: number; totalTime: number }> = {};

    report.weeklyReports.forEach(week => {
      Object.entries(week.activityTypeBreakdown).forEach(([type, data]: [string, any]) => {
        if (!typeStats[type]) {
          typeStats[type] = { completed: 0, total: 0, totalScore: 0, totalTime: 0 };
        }
        typeStats[type].completed += data.completed || 0;
        typeStats[type].total += data.total || 0;
        typeStats[type].totalScore += (data.averageScore || 0) * (data.completed || 0);
        typeStats[type].totalTime += (data.averageTime || 0) * (data.completed || 0);
      });
    });

    return Object.entries(typeStats)
      .map(([type, stats]) => ({
        type: type.charAt(0).toUpperCase() + type.slice(1),
        completed: stats.completed,
        total: stats.total,
        completionRate: stats.total > 0 ? (stats.completed / stats.total) * 100 : 0,
        averageScore: stats.completed > 0 ? stats.totalScore / stats.completed : 0,
        averageTime: stats.completed > 0 ? stats.totalTime / stats.completed : 0
      }))
      .sort((a, b) => b.completed - a.completed)
      .slice(0, 5);
  };

  // Exportar relatório
  const exportReport = () => {
    if (!report || !student) return;

    const data = {
      aluno: {
        nome: student.name,
        escola: student.profile.school,
        serie: student.profile.grade,
        pontos: student.profile.totalPoints,
        nivel: student.profile.level,
        streak: student.profile.streak
      },
      relatorio: report,
      geradoEm: new Date().toISOString(),
      periodo: selectedWeek === 'all' ? 'Todas as semanas' : `Semana ${selectedWeek}`
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${student.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  // Imprimir relatório
  const printReport = () => {
    window.print();
  };

  // Compartilhar relatório (simulado)
  const shareReport = () => {
    if (!report || !student) return;
    
    const shareData = {
      title: `Relatório de ${student.name}`,
      text: `Confira o relatório de desempenho de ${student.name} na Nexus Platform.`,
      url: window.location.href
    };

    if (navigator.share) {
      navigator.share(shareData).catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copiado para a área de transferência!');
    }
  };

  // Componente de Card de Métrica
  const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle, icon, color, trend }) => {
    const colorClasses = {
      blue: 'from-blue-50 to-blue-100 border-blue-200 text-blue-700',
      green: 'from-green-50 to-green-100 border-green-200 text-green-700',
      orange: 'from-orange-50 to-orange-100 border-orange-200 text-orange-700',
      purple: 'from-purple-50 to-purple-100 border-purple-200 text-purple-700',
      red: 'from-red-50 to-red-100 border-red-200 text-red-700',
      indigo: 'from-indigo-50 to-indigo-100 border-indigo-200 text-indigo-700'
    }[color];

    return (
      <div className={`bg-gradient-to-br ${colorClasses} border rounded-xl p-5`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg">
              {icon}
            </div>
            <div>
              <div className="text-sm font-medium">{title}</div>
              <div className="text-2xl font-bold mt-1">{value}</div>
            </div>
          </div>
          {trend !== undefined && (
            <div className={`text-sm ${trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-600'}`}>
              {trend > 0 ? '↗' : trend < 0 ? '↘' : '→'}
            </div>
          )}
        </div>
        <div className="text-sm opacity-80">{subtitle}</div>
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[400px]">
        <FaSpinner className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <p className="text-gray-600">Gerando relatório personalizado...</p>
        <p className="text-sm text-gray-500 mt-2">
          Analisando {report?.weeklyReports.length || 0} semanas de dados
        </p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <FaExclamationCircle className="text-red-500 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-red-800">Erro ao carregar relatório</h3>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button
            onClick={loadData}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Tentar novamente
          </button>
          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Voltar
            </button>
          )}
        </div>
      </div>
    );
  }

  // No data state
  if (!report || !student) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
          <FaUser className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">
          Dados insuficientes
        </h3>
        <p className="text-gray-500 mb-6">
          O aluno ainda não possui atividades concluídas para gerar um relatório
        </p>
        {onBack && (
          <button
            onClick={onBack}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Voltar para lista
          </button>
        )}
      </div>
    );
  }

  const dayPerformance = calculateDayPerformance();
  const activityTypes = getActivityTypeAnalysis();
  const latestWeek = report.weeklyReports[0];
  const bestDay = dayPerformance.length > 0 
    ? dayPerformance.reduce((best, current) => 
        current.completionRate > best.completionRate ? current : best
      )
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      {showHeader && (
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="flex items-start md:items-center gap-4">
              {onBack && (
                <button
                  onClick={onBack}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mt-1"
                >
                  <FaArrowLeft />
                  Voltar
                </button>
              )}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <FaUserGraduate className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-800">
                      {student.name}
                    </h1>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <FaSchool className="text-gray-400" />
                        {student.profile.school}
                      </span>
                      <span className="flex items-center gap-1">
                        <FaGraduationCap className="text-gray-400" />
                        {student.profile.grade}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-gray-600">
                  Relatório individual de desempenho terapêutico-educacional
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={exportReport}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100"
              >
                <FaDownload />
                Exportar
              </button>
              <button
                onClick={printReport}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                <FaPrint />
                Imprimir
              </button>
              {user?.role !== 'student' && (
                <button
                  onClick={shareReport}
                  className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100"
                >
                  <FaShare />
                  Compartilhar
                </button>
              )}
            </div>
          </div>

          {/* Status do Relatório */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500 mb-1">Status dos Dados</div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  report.dataFreshness === 'realtime' ? 'bg-green-500' :
                  report.dataFreshness === 'cached' ? 'bg-blue-500' : 'bg-gray-500'
                }`} />
                <span className="font-medium">
                  {report.dataFreshness === 'realtime' ? 'Dados em tempo real' :
                   report.dataFreshness === 'cached' ? 'Cache (atualizado)' : 'Dados antigos'}
                </span>
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500 mb-1">Tendência Geral</div>
              <div className="flex items-center gap-2">
                {getTrendIcon(report.trend)}
                {getTrendBadge(report.trend, report.trendConfidence)}
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500 mb-1">Período Analisado</div>
              <div className="font-medium">
                {report.weeklyReports.length} semana{report.weeklyReports.length !== 1 ? 's' : ''}
                {latestWeek && (
                  <span className="text-gray-500 text-sm ml-2">
                    (última: {formatDateRange(latestWeek.weekStartDate, latestWeek.weekEndDate)})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow">
        <div className="border-b">
          <div className="flex overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-6 py-4 font-medium whitespace-nowrap ${activeTab === 'overview' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <FaChartBar />
              Visão Geral
            </button>
            <button
              onClick={() => setActiveTab('weekly')}
              className={`flex items-center gap-2 px-6 py-4 font-medium whitespace-nowrap ${activeTab === 'weekly' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <FaCalendarWeek />
              Análise Semanal
            </button>
            <button
              onClick={() => setActiveTab('patterns')}
              className={`flex items-center gap-2 px-6 py-4 font-medium whitespace-nowrap ${activeTab === 'patterns' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <FaChartLine />
              Padrões
            </button>
            <button
              onClick={() => setActiveTab('insights')}
              className={`flex items-center gap-2 px-6 py-4 font-medium whitespace-nowrap ${activeTab === 'insights' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <FaLightbulb />
              Insights
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Visão Geral */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Cards de Métricas Principais */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Pontuação Total"
                  value={report.overall.totalPoints}
                  subtitle="Conquistados nas atividades"
                  icon={<FaStar className="w-5 h-5 text-yellow-600" />}
                  color="orange"
                />
                <MetricCard
                  title="Sequência Atual"
                  value={`${report.overall.streak} dias`}
                  subtitle="Dias seguidos de atividades"
                  icon={<FaFire className="w-5 h-5 text-red-600" />}
                  color="red"
                />
                <MetricCard
                  title="Atividades Concluídas"
                  value={report.overall.totalActivitiesCompleted}
                  subtitle={`${report.overall.averageCompletionRate.toFixed(1)}% de conclusão`}
                  icon={<FaCheckCircle className="w-5 h-5 text-green-600" />}
                  color="green"
                />
                <MetricCard
                  title="Tempo Dedicado"
                  value={formatTime(report.overall.totalTimeSpent)}
                  subtitle="Total investido nas atividades"
                  icon={<FaRegClock className="w-5 h-5 text-blue-600" />}
                  color="blue"
                />
              </div>

              {/* Performance por Dia da Semana */}
              <div className="bg-white border rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-2">Desempenho por Dia da Semana</h3>
                    <p className="text-sm text-gray-600">
                      Distribuição das atividades concluídas ao longo da semana
                    </p>
                  </div>
                  {bestDay && (
                    <div className="text-sm text-gray-500">
                      Melhor dia: <span className="font-medium text-green-600">{bestDay.dayName}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {dayPerformance.map((day, index) => (
                    <div key={day.shortName} className="text-center">
                      <div className="text-sm font-medium text-gray-700 mb-1">{day.shortName}</div>
                      <div className="h-32 bg-gray-50 rounded-lg overflow-hidden relative border">
                        {day.completionRate > 0 && (
                          <div
                            className={`absolute bottom-0 left-0 right-0 ${day.completionRate >= 80 ? 'bg-green-500' :
                              day.completionRate >= 60 ? 'bg-yellow-500' :
                              day.completionRate >= 40 ? 'bg-orange-500' : 'bg-red-500'
                            }`}
                            style={{ height: `${Math.min(day.completionRate, 100)}%` }}
                          />
                        )}
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                          <div className="text-lg font-bold text-gray-800">
                            {day.completed}
                          </div>
                          <div className="text-xs text-gray-500">
                            de {day.total}
                          </div>
                        </div>
                      </div>
                      <div className={`text-xs font-medium mt-1 ${getMetricColorClass(day.completionRate)}`}>
                        {day.completionRate.toFixed(0)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resumo das Últimas Semanas */}
              {report.weeklyReports.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-6">
                  <h3 className="font-semibold text-gray-800 mb-4">Evolução Recente</h3>
                  <div className="space-y-3">
                    {report.weeklyReports.slice(0, 4).map((week) => (
                      <div key={week.weekNumber} className="flex items-center justify-between p-4 bg-white rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-indigo-100 rounded-lg">
                            <FaCalendarAlt className="text-indigo-600" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-800">
                              Semana {week.weekNumber}
                            </div>
                            <div className="text-sm text-gray-500">
                              {formatDateRange(week.weekStartDate, week.weekEndDate)}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <div className={`text-lg font-bold ${getMetricColorClass(week.summary.completionRate)}`}>
                              {formatPercentage(week.summary.completionRate)}
                            </div>
                            <div className="text-sm text-gray-500">
                              {week.summary.completedActivities}/{week.summary.totalActivities} atividades
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium text-gray-800">
                              {week.summary.totalPoints} pts
                            </div>
                            <div className="text-sm text-gray-500">
                              {formatTime(week.summary.averageTimePerActivity)}/atividade
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Análise Semanal */}
          {activeTab === 'weekly' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="font-semibold text-gray-800">Análise Detalhada por Semana</h3>
                  <p className="text-sm text-gray-600">
                    Selecione uma semana para análise detalhada
                  </p>
                </div>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                  className="px-4 py-2 border border-gray-300 rounded-lg bg-white"
                >
                  <option value="all">Todas as semanas</option>
                  {report.weeklyReports.map(week => (
                    <option key={week.weekNumber} value={week.weekNumber}>
                      Semana {week.weekNumber} ({formatDateRange(week.weekStartDate, week.weekEndDate)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-4">
                {(selectedWeek === 'all' ? report.weeklyReports : report.weeklyReports.filter(w => w.weekNumber === selectedWeek)).map(week => (
                  <div key={week.weekNumber} className="border rounded-xl overflow-hidden">
                    {/* Cabeçalho da Semana */}
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-4 border-b">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                          <h4 className="font-bold text-gray-800 text-lg">
                            Semana {week.weekNumber}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {formatDateRange(week.weekStartDate, week.weekEndDate)}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className={`text-2xl font-bold ${getMetricColorClass(week.summary.completionRate)}`}>
                              {formatPercentage(week.summary.completionRate)}
                            </div>
                            <div className="text-sm text-gray-600">
                              Taxa de conclusão
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Conteúdo da Semana */}
                    <div className="p-6">
                      {/* Métricas Principais da Semana */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="p-4 bg-green-50 rounded-lg">
                          <div className="flex items-center gap-3 mb-3">
                            <FaChartLine className="text-green-600" />
                            <div>
                              <div className="text-sm text-green-700">Engajamento</div>
                              <div className="text-xl font-bold text-green-800">
                                {formatPercentage(week.summary.consistencyScore)}
                              </div>
                            </div>
                          </div>
                          <div className="text-sm text-green-600">
                            Pontos conquistados: <span className="font-bold">{week.summary.totalPoints}</span>
                          </div>
                        </div>

                        <div className="p-4 bg-blue-50 rounded-lg">
                          <div className="flex items-center gap-3 mb-3">
                            <FaClock className="text-blue-600" />
                            <div>
                              <div className="text-sm text-blue-700">Tempo Médio</div>
                              <div className="text-xl font-bold text-blue-800">
                                {formatTime(week.summary.averageTimePerActivity)}
                              </div>
                            </div>
                          </div>
                          <div className="text-sm text-blue-600">
                            por atividade • {formatPercentage(week.summary.adherenceScore)} aderência
                          </div>
                        </div>

                        <div className="p-4 bg-purple-50 rounded-lg">
                          <div className="flex items-center gap-3 mb-3">
                            <FaBrain className="text-purple-600" />
                            <div>
                              <div className="text-sm text-purple-700">Desempenho</div>
                              <div className="text-xl font-bold text-purple-800">
                                {week.summary.averageScore.toFixed(1)}
                              </div>
                            </div>
                          </div>
                          <div className="text-sm text-purple-600">
                            Média por atividade
                          </div>
                        </div>
                      </div>

                      {/* Tipos de Atividade */}
                      {activityTypes.length > 0 && (
                        <div className="mb-6">
                          <h5 className="font-medium text-gray-700 mb-4">Desempenho por Tipo de Atividade</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {activityTypes.map((type) => (
                              <div key={type.type} className="p-4 bg-white border rounded-lg">
                                <div className="flex items-center justify-between mb-3">
                                  <span className="font-medium text-gray-800">{type.type}</span>
                                  <span className={`text-sm font-bold ${getMetricColorClass(type.completionRate)}`}>
                                    {formatPercentage(type.completionRate)}
                                  </span>
                                </div>
                                <div className="space-y-2 text-sm text-gray-600">
                                  <div className="flex justify-between">
                                    <span>Concluídas:</span>
                                    <span className="font-medium">{type.completed}/{type.total}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Pontuação média:</span>
                                    <span className="font-medium">{type.averageScore.toFixed(1)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Tempo médio:</span>
                                    <span className="font-medium">{formatTime(type.averageTime)}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Insights da Semana */}
                      <div className="space-y-4">
                        <h5 className="font-medium text-gray-700">Análise e Insights</h5>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {week.insights.strengths.length > 0 && (
                            <div className="p-4 bg-green-50 rounded-lg">
                              <div className="flex items-center gap-3 mb-3">
                                <FaArrowTrendUp className="text-green-600" />
                                <span className="font-medium text-green-800">Pontos Fortes</span>
                              </div>
                              <ul className="space-y-2">
                                {week.insights.strengths.map((strength, i) => (
                                  <li key={i} className="text-sm text-green-700 flex items-start gap-2">
                                    <span className="mt-1">•</span>
                                    <span>{strength}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {week.insights.challenges.length > 0 && (
                            <div className="p-4 bg-yellow-50 rounded-lg">
                              <div className="flex items-center gap-3 mb-3">
                                <FaExclamationCircle className="text-yellow-600" />
                                <span className="font-medium text-yellow-800">Áreas para Melhoria</span>
                              </div>
                              <ul className="space-y-2">
                                {week.insights.challenges.map((challenge, i) => (
                                  <li key={i} className="text-sm text-yellow-700 flex items-start gap-2">
                                    <span className="mt-1">•</span>
                                    <span>{challenge}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Padrões */}
          {activeTab === 'patterns' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <FaChartLine className="w-6 h-6 text-indigo-600" />
                  <h3 className="font-semibold text-indigo-800">Análise de Padrões</h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Tendência Geral */}
                  <div className="p-4 bg-white rounded-lg">
                    <h4 className="font-medium text-gray-800 mb-3">Tendência Geral</h4>
                    <div className="flex items-center gap-3">
                      {getTrendIcon(report.trend)}
                      <div>
                        <div className="font-medium text-gray-800">
                          {report.trend === 'improving' ? 'Melhoria contínua' :
                           report.trend === 'declining' ? 'Queda no desempenho' : 'Estabilidade'}
                        </div>
                        <div className="text-sm text-gray-600">
                          {report.trendConfidence === 'high' ? 'Alta confiança nesta análise' :
                           report.trendConfidence === 'medium' ? 'Confiança moderada' : 'Análise preliminar'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Consistência */}
                  <div className="p-4 bg-white rounded-lg">
                    <h4 className="font-medium text-gray-800 mb-3">Consistência</h4>
                    <div className="flex items-center gap-3">
                      <FaFire className={`w-5 h-5 ${report.overall.streak >= 5 ? 'text-orange-600' : 'text-gray-400'}`} />
                      <div>
                        <div className="font-medium text-gray-800">
                          {report.overall.streak} dias seguidos
                        </div>
                        <div className="text-sm text-gray-600">
                          {report.overall.streak >= 5 ? 'Excelente consistência!' :
                           report.overall.streak >= 3 ? 'Boa rotina' : 'Estabelecendo rotina'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Análise de Dados */}
                <div className="mt-6 space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-800 mb-2">Resumo de Dados</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-white rounded-lg">
                        <div className="text-lg font-bold text-gray-800">{report.weeklyReports.length}</div>
                        <div className="text-sm text-gray-600">Semanas</div>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg">
                        <div className="text-lg font-bold text-gray-800">{report.overall.totalActivitiesCompleted}</div>
                        <div className="text-sm text-gray-600">Atividades</div>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg">
                        <div className="text-lg font-bold text-gray-800">{formatTime(report.overall.totalTimeSpent)}</div>
                        <div className="text-sm text-gray-600">Tempo total</div>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg">
                        <div className="text-lg font-bold text-gray-800">{report.overall.averageCompletionRate.toFixed(1)}%</div>
                        <div className="text-sm text-gray-600">Conclusão média</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Melhores Dias e Tipos */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Melhores Dias */}
                <div className="bg-white border rounded-xl p-6">
                  <h4 className="font-medium text-gray-800 mb-4">Dias de Maior Produtividade</h4>
                  <div className="space-y-3">
                    {dayPerformance
                      .filter(day => day.total > 0)
                      .sort((a, b) => b.completionRate - a.completionRate)
                      .slice(0, 3)
                      .map((day, index) => (
                        <div key={day.shortName} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              index === 0 ? 'bg-yellow-100 text-yellow-700' :
                              index === 1 ? 'bg-gray-100 text-gray-700' :
                              'bg-orange-100 text-orange-700'
                            }`}>
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-medium text-gray-800">{day.dayName}</div>
                              <div className="text-sm text-gray-500">
                                {day.completed}/{day.total} atividades
                              </div>
                            </div>
                          </div>
                          <div className={`font-bold ${getMetricColorClass(day.completionRate)}`}>
                            {formatPercentage(day.completionRate)}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Tipos Preferidos */}
                <div className="bg-white border rounded-xl p-6">
                  <h4 className="font-medium text-gray-800 mb-4">Tipos de Atividade Preferidos</h4>
                  <div className="space-y-3">
                    {activityTypes
                      .sort((a, b) => b.completed - a.completed)
                      .slice(0, 3)
                      .map((type, index) => (
                        <div key={type.type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              index === 0 ? 'bg-green-100 text-green-700' :
                              index === 1 ? 'bg-blue-100 text-blue-700' :
                              'bg-purple-100 text-purple-700'
                            }`}>
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-medium text-gray-800">{type.type}</div>
                              <div className="text-sm text-gray-500">
                                {type.completed} concluídas
                              </div>
                            </div>
                          </div>
                          <div className={`font-bold ${getMetricColorClass(type.completionRate)}`}>
                            {formatPercentage(type.completionRate)}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Insights */}
          {activeTab === 'insights' && (
            <div className="space-y-6">
              {/* Insights Gerais */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <FaLightbulb className="w-6 h-6 text-indigo-600" />
                  <div>
                    <h3 className="font-semibold text-indigo-800">Insights Personalizados</h3>
                    <p className="text-sm text-indigo-600">
                      Baseado em {report.weeklyReports.length} semanas de dados
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Pontos Fortes */}
                  <div className="p-4 bg-white rounded-lg">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <FaArrowTrendUp className="w-4 h-4 text-green-600" />
                      </div>
                      <h4 className="font-medium text-green-800">Pontos Fortes</h4>
                    </div>
                    <div className="space-y-2">
                      {report.overall.streak >= 3 && (
                        <div className="text-sm text-green-700">
                          • Excelente consistência de uso ({report.overall.streak} dias seguidos)
                        </div>
                      )}
                      {report.overall.averageCompletionRate >= 70 && (
                        <div className="text-sm text-green-700">
                          • Alta taxa de conclusão ({report.overall.averageCompletionRate.toFixed(1)}%)
                        </div>
                      )}
                      {report.trend === 'improving' && report.trendConfidence === 'high' && (
                        <div className="text-sm text-green-700">
                          • Tendência positiva de melhoria contínua
                        </div>
                      )}
                      {bestDay && bestDay.completionRate >= 80 && (
                        <div className="text-sm text-green-700">
                          • Excelente desempenho nas {bestDay.dayName}s ({bestDay.completionRate.toFixed(0)}%)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Oportunidades */}
                  <div className="p-4 bg-white rounded-lg">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-yellow-100 rounded-lg">
                        <FaExclamationCircle className="w-4 h-4 text-yellow-600" />
                      </div>
                      <h4 className="font-medium text-yellow-800">Oportunidades</h4>
                    </div>
                    <div className="space-y-2">
                      {report.overall.averageCompletionRate <= 50 && (
                        <div className="text-sm text-yellow-700">
                          • Baixa taxa de conclusão geral
                        </div>
                      )}
                      {dayPerformance.some(day => day.completionRate <= 30 && day.total > 0) && (
                        <div className="text-sm text-yellow-700">
                          • Dias específicos com baixo engajamento
                        </div>
                      )}
                      {report.trend === 'declining' && (
                        <div className="text-sm text-yellow-700">
                          • Tendência de queda no desempenho
                        </div>
                      )}
                      {activityTypes.some(type => type.completionRate <= 40) && (
                        <div className="text-sm text-yellow-700">
                          • Alguns tipos de atividade com baixa aceitação
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Recomendações */}
              <div className="bg-white border rounded-xl p-6">
                <h3 className="font-semibold text-gray-800 mb-6">Recomendações Personalizadas</h3>

                <div className="space-y-4">
                  {latestWeek?.insights.recommendations && latestWeek.insights.recommendations.length > 0 ? (
                    latestWeek.insights.recommendations.map((recommendation, index) => (
                      <div key={index} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-indigo-600">{index + 1}</span>
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="text-gray-800">{recommendation}</p>
                          <div className="mt-3 flex gap-3">
                            {user?.role !== 'student' && (
                              <button className="px-3 py-1 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
                                Aplicar sugestão
                              </button>
                            )}
                            <button className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800">
                              Mais detalhes
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                        <FaLightbulb className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500 mb-4">
                        Continue usando a plataforma para gerar recomendações personalizadas
                      </p>
                      {user?.role !== 'student' && (
                        <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                          Gerar recomendações
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Botão de Ação */}
              {user?.role !== 'student' && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="font-semibold text-green-800 mb-2">Próximos Passos</h3>
                      <p className="text-green-700">
                        Baseado nesta análise, você pode tomar ações proativas para apoiar {student.name}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                        Agendar reunião
                      </button>
                      <button className="px-4 py-2 bg-white text-green-700 border border-green-300 rounded-lg hover:bg-green-50">
                        Ajustar cronograma
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}