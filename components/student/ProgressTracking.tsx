// components/student/ProgressTracking.tsx
'use client';

import React, { useState } from 'react';
import {
  FaChartLine,
  FaTrophy,
  FaFire,
  FaStar,
  FaMedal,
  FaCalendarAlt,
  FaClock,
  FaCheckCircle,
  FaRegChartBar,
  FaArrowUp,
  FaArrowDown,
  FaChartPie,
  FaMinus,
  FaBullseye,
  FaLightbulb,
  FaAward,
  FaCrown,
  FaGem,
  FaRocket,
  FaSeedling,
  FaMountain,
  FaChevronRight,
  FaHistory,
  FaCheck,
  FaCalendarWeek,
  FaTasks,
  FaBrain,
  FaHeart,
  FaSmile,
  FaFrown,
  FaMeh
} from 'react-icons/fa';
import { FiTarget, FiBarChart2, FiActivity, FiZap } from 'react-icons/fi';
import { FaArrowTrendDown, FaArrowTrendUp } from 'react-icons/fa6';
import { useStudentWeeklyProgress } from '@/hooks/useStudentWeeklyProgress';
import { AchievementUtils } from '@/lib/utils/achievementUtils';
import { WeeklySnapshot } from '@/types/schedule';

interface WeeklyProgress {
  weekNumber: number;
  weekStartDate: Date;
  weekEndDate: Date;
  completionRate: number;
  consistencyScore: number;
  adherenceScore: number;
  points: number;
  timeSpent: number;
  streakAtEnd: number;
  totalActivities: number;
  completedActivities: number;
  trend: 'up' | 'down' | 'stable';
  isImprovement: boolean;
  isDecline: boolean;
}

export default function ProgressTracking() {
  const { data, loading, error, refresh } = useStudentWeeklyProgress();
  
  const [activeTab, setActiveTab] = useState<'overview' | 'achievements' | 'stats'>('overview');
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  const getTrend = (improvement?: number): 'up' | 'down' | 'stable' => {
    if (improvement === undefined) return 'stable';
    if (improvement > 0.5) return 'up';
    if (improvement < -0.5) return 'down';
    return 'stable';
  };

  // Converter snapshots para formato do weeklyProgress
  const getWeeklyProgress = (): WeeklyProgress[] => {
    if (!data?.weeklySnapshots?.length) return [];

    return data.weeklySnapshots.map((snapshot: WeeklySnapshot) => {
      const previousSnapshot = data.weeklySnapshots.find(
        (s: WeeklySnapshot) => s.weekNumber === snapshot.weekNumber - 1
      );
      
      const improvement = previousSnapshot 
        ? snapshot.metrics.completionRate - previousSnapshot.metrics.completionRate
        : 0;
      
      const trend = getTrend(improvement);
      
      return {
        weekNumber: snapshot.weekNumber,
        weekStartDate: snapshot.weekStartDate,
        weekEndDate: snapshot.weekEndDate,
        completionRate: snapshot.metrics.completionRate,
        consistencyScore: snapshot.metrics.consistencyScore,
        adherenceScore: snapshot.metrics.adherenceScore,
        points: snapshot.metrics.totalPointsEarned,
        timeSpent: snapshot.metrics.totalTimeSpent,
        streakAtEnd: snapshot.metrics.streakAtEndOfWeek,
        totalActivities: snapshot.metrics.totalActivities,
        completedActivities: snapshot.metrics.completedActivities,
        trend,
        isImprovement: improvement > 5,
        isDecline: improvement < -5
      };
    }).sort((a: WeeklyProgress, b: WeeklyProgress) => b.weekNumber - a.weekNumber);
  };

  const getLevelProgress = (level: number) => {
    if (!data?.currentMetrics?.totalPoints) return 0;

    const baseXP = 100;
    const xpForLevel = baseXP * Math.pow(1.5, level - 1);
    const previousLevelXP = level > 1 ? baseXP * Math.pow(1.5, level - 2) : 0;
    const xpForThisLevel = xpForLevel - previousLevelXP;
    const xpInThisLevel = data.currentMetrics.totalPoints - previousLevelXP;

    return Math.min(100, Math.max(0, (xpInThisLevel / xpForThisLevel) * 100));
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return <FaArrowTrendUp className="w-4 h-4 text-emerald-500" />;
      case 'down': return <FaArrowTrendDown className="w-4 h-4 text-red-500" />;
      default: return <FaMinus className="w-4 h-4 text-gray-400" />;
    }
  };

  const getTrendColor = (trend: 'improving' | 'declining' | 'stable') => {
    switch (trend) {
      case 'improving': return 'text-emerald-600 bg-emerald-50 border-emerald-100';
      case 'declining': return 'text-red-600 bg-red-50 border-red-100';
      default: return 'text-gray-600 bg-gray-50 border-gray-100';
    }
  };

  const getCompletionColor = (rate: number) => {
    if (rate >= 80) return 'bg-emerald-500';
    if (rate >= 60) return 'bg-indigo-500';
    if (rate >= 40) return 'bg-amber-500';
    if (rate >= 20) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getCompletionBgColor = (rate: number) => {
    if (rate >= 80) return 'bg-emerald-50 border-emerald-200';
    if (rate >= 60) return 'bg-indigo-50 border-indigo-200';
    if (rate >= 40) return 'bg-amber-50 border-amber-200';
    if (rate >= 20) return 'bg-orange-50 border-orange-200';
    return 'bg-red-50 border-red-200';
  };

  const getCompletionTextColor = (rate: number) => {
    if (rate >= 80) return 'text-emerald-700';
    if (rate >= 60) return 'text-indigo-700';
    if (rate >= 40) return 'text-amber-700';
    if (rate >= 20) return 'text-orange-700';
    return 'text-red-700';
  };

  const getWeeklyAverage = (): number => {
    if (!data?.weeklySnapshots?.length) return 0;
    const sum = data.weeklySnapshots.reduce((total: number, snapshot: WeeklySnapshot) => {
      return total + snapshot.metrics.completionRate;
    }, 0);
    return Math.round(sum / data.weeklySnapshots.length);
  };

  const getBestWeek = (): WeeklyProgress | null => {
    const weekly = getWeeklyProgress();
    if (weekly.length === 0) return null;
    return weekly.reduce((best: WeeklyProgress, current: WeeklyProgress) => 
      current.completionRate > best.completionRate ? current : best
    );
  };

  const formatDate = (date?: Date) => {
    if (!date) return '';
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit'
    });
  };

  const formatFullDate = (date?: Date) => {
    if (!date) return '';
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
  };

  const getWeekStatus = (week: WeeklyProgress) => {
    if (week.completionRate >= 80) return { label: 'Excelente', icon: '🌟', color: 'text-emerald-600' };
    if (week.completionRate >= 60) return { label: 'Bom', icon: '👍', color: 'text-indigo-600' };
    if (week.completionRate >= 40) return { label: 'Regular', icon: '👌', color: 'text-amber-600' };
    if (week.completionRate >= 20) return { label: 'Precisa melhorar', icon: '⚠️', color: 'text-orange-600' };
    return { label: 'Atenção', icon: '🔴', color: 'text-red-600' };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <div className="relative inline-block">
            <div className="w-16 h-16 border-3 border-purple-200 rounded-full"></div>
            <div className="w-16 h-16 border-3 border-purple-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
          </div>
          <p className="mt-4 text-gray-600 font-medium">Analisando seu progresso...</p>
          <p className="text-sm text-gray-500 mt-1">Isso pode levar alguns segundos</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200 p-8 shadow-sm">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-red-50 to-red-100 rounded-2xl mb-6">
            <FaChartLine className="w-10 h-10 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Erro ao carregar progresso
          </h3>
          <p className="text-gray-600 max-w-md mx-auto mb-6">
            {error || 'Não foi possível carregar seus dados de progresso.'}
          </p>
          <button
            onClick={refresh}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg transition-all duration-200"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const { currentMetrics } = data;
  const weeklyProgress = getWeeklyProgress();
  const bestWeek = getBestWeek();
  const weeklyAverage = getWeeklyAverage();
  const levelProgress = getLevelProgress(currentMetrics.level);
  const achievements = AchievementUtils.calculateAchievements(
    '', // studentId não é mais usado
    [], // instances não são mais usadas
    data.weeklySnapshots,
    {
      streak: currentMetrics.streak,
      totalPoints: currentMetrics.totalPoints,
      completedActivities: currentMetrics.completedActivities,
      completionRate: currentMetrics.completionRate
    }
  );

  const unlockedAchievements = achievements.filter(a => a.unlocked).length;

  return (
    <div className="space-y-6">
      {/* Header Moderno */}
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
              <FaChartLine className="w-7 h-7 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl lg:text-2xl font-bold text-gray-900 mb-1">Meu Progresso</h2>
              <p className="text-gray-600">Acompanhe sua evolução e conquistas</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <div className="text-sm text-gray-500 mb-1">Última atualização</div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <div className="text-sm font-medium text-gray-900">
                {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Modernas */}
        <div className="flex flex-col sm:flex-row gap-2 bg-gray-100 p-2 rounded-xl">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-3 ${
              activeTab === 'overview' 
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm' 
                : 'text-gray-600 hover:bg-white'
            }`}
          >
            <FiActivity className="w-4 h-4" />
            <span>Visão Geral</span>
          </button>
          
          <button
            onClick={() => setActiveTab('achievements')}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-3 ${
              activeTab === 'achievements' 
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm' 
                : 'text-gray-600 hover:bg-white'
            }`}
          >
            <FaTrophy className="w-4 h-4" />
            <span>Conquistas {unlockedAchievements > 0 && `(${unlockedAchievements})`}</span>
          </button>
          
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-3 ${
              activeTab === 'stats' 
                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-sm' 
                : 'text-gray-600 hover:bg-white'
            }`}
          >
            <FiBarChart2 className="w-4 h-4" />
            <span>Estatísticas</span>
          </button>
        </div>
      </div>

      {/* Conteúdo baseado na tab ativa */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Cards de Métricas Principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Streak Card */}
            <div className="bg-gradient-to-br from-white to-amber-50 rounded-2xl border border-amber-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center">
                  <FaFire className="w-6 h-6 text-amber-600" />
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium text-amber-600 uppercase tracking-wider">Sequência</div>
                  <div className="text-2xl font-bold text-gray-900">{currentMetrics.streak}</div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex gap-1">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div
                      key={i}
                      className={`flex-1 h-2 rounded-full ${
                        i < Math.min(currentMetrics.streak, 7)
                          ? 'bg-gradient-to-r from-amber-400 to-orange-400'
                          : 'bg-amber-100'
                      }`}
                    />
                  ))}
                </div>
                <div className="text-xs text-amber-600">
                  {currentMetrics.streak >= 7 
                    ? '🔥 Semana perfeita!' 
                    : `${7 - currentMetrics.streak} dias para a semana completa`}
                </div>
              </div>
            </div>

            {/* Points Card */}
            <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl border border-blue-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                  <FaStar className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium text-blue-600 uppercase tracking-wider">Pontos</div>
                  <div className="text-2xl font-bold text-gray-900">{currentMetrics.totalPoints}</div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="text-sm text-blue-700">Próximo nível: {currentMetrics.level + 1}</div>
                <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-700"
                    style={{ width: `${levelProgress}%` }}
                  />
                </div>
                <div className="text-xs text-blue-600">
                  {levelProgress.toFixed(1)}% completo
                </div>
              </div>
            </div>

            {/* Level Card */}
            <div className="bg-gradient-to-br from-white to-purple-50 rounded-2xl border border-purple-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
                  <FaCrown className="w-6 h-6 text-purple-600" />
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium text-purple-600 uppercase tracking-wider">Nível</div>
                  <div className="text-2xl font-bold text-gray-900">{currentMetrics.level}</div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="text-sm text-purple-700">Continue evoluindo!</div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-600">Experiência</span>
                  <span className="font-medium text-purple-900">{levelProgress.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* Completion Card */}
            <div className="bg-gradient-to-br from-white to-emerald-50 rounded-2xl border border-emerald-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center">
                  <FaCheckCircle className="w-6 h-6 text-emerald-600" />
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Conclusão</div>
                  <div className="text-2xl font-bold text-gray-900">{currentMetrics.completionRate.toFixed(1)}%</div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="text-sm text-emerald-700">
                  {currentMetrics.completedActivities}/{currentMetrics.totalActivities} atividades
                </div>
                <div className="h-2 bg-emerald-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-green-500 rounded-full"
                    style={{ width: `${currentMetrics.completionRate}%` }}
                  />
                </div>
                <div className="text-xs text-emerald-600">
                  Média semanal: {weeklyAverage}%
                </div>
              </div>
            </div>
          </div>

          {/* Histórico Semanal Detalhado - UI/UX Melhorada */}
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center">
                  <FaCalendarWeek className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Histórico Semanal</h3>
                  <p className="text-sm text-gray-600">{weeklyProgress.length} semanas analisadas</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="text-sm text-gray-500">Tendência:</div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getTrendColor(data.performanceTrend)}`}>
                  {data.performanceTrend === 'improving' ? 'Melhorando' :
                    data.performanceTrend === 'declining' ? 'Precisa de atenção' : 'Estável'}
                </div>
              </div>
            </div>

            {weeklyProgress.length > 0 ? (
              <div className="space-y-4">
                {weeklyProgress.map((week: WeeklyProgress, index: number) => {
                  const status = getWeekStatus(week);
                  const isSelected = selectedWeek === week.weekNumber;
                  
                  return (
                    <div
                      key={index}
                      className={`bg-white rounded-xl border-2 transition-all duration-300 overflow-hidden ${
                        isSelected 
                          ? 'border-indigo-400 shadow-lg' 
                          : 'border-gray-200 hover:border-indigo-200 hover:shadow-md'
                      }`}
                    >
                      {/* Cabeçalho da Semana - Melhorado */}
                      <div 
                        className="p-5 cursor-pointer"
                        onClick={() => setSelectedWeek(isSelected ? null : week.weekNumber)}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="flex items-start gap-4">
                            {/* Ícone da Semana */}
                            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${getCompletionBgColor(week.completionRate)}`}>
                              <span className={`text-xl font-bold ${getCompletionTextColor(week.completionRate)}`}>
                                {week.weekNumber}
                              </span>
                            </div>

                            {/* Informações da Semana */}
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-3 mb-2">
                                <span className="font-semibold text-gray-900">
                                  Semana {week.weekNumber}
                                </span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCompletionBgColor(week.completionRate)} ${getCompletionTextColor(week.completionRate)}`}>
                                  {status.icon} {status.label}
                                </span>
                                {week.isImprovement && (
                                  <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium flex items-center gap-1">
                                    <FaArrowUp className="w-3 h-3" />
                                    Melhor que anterior
                                  </span>
                                )}
                                {week.isDecline && (
                                  <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium flex items-center gap-1">
                                    <FaArrowDown className="w-3 h-3" />
                                    Pior que anterior
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                                <span className="flex items-center gap-1">
                                  <FaCalendarAlt className="w-3 h-3" />
                                  {formatFullDate(week.weekStartDate)} - {formatFullDate(week.weekEndDate)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <FaTasks className="w-3 h-3" />
                                  {week.completedActivities}/{week.totalActivities} atividades
                                </span>
                                <span className="flex items-center gap-1">
                                  <FaClock className="w-3 h-3" />
                                  {formatTime(week.timeSpent)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <FaStar className="w-3 h-3 text-yellow-500" />
                                  {week.points} pontos
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Barra de Progresso */}
                          <div className="lg:w-48">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${getCompletionColor(week.completionRate)}`}
                                  style={{ width: `${week.completionRate}%` }}
                                />
                              </div>
                              <span className={`font-bold ${getCompletionTextColor(week.completionRate)}`}>
                                {week.completionRate.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Detalhes Expandidos - Melhorados */}
                      {isSelected && (
                        <div className="p-5 bg-gradient-to-br from-gray-50 to-white border-t border-gray-200">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Engajamento */}
                            <div className="bg-white rounded-xl p-4 border border-gray-200">
                              <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <FiActivity className="w-4 h-4 text-indigo-500" />
                                Engajamento
                              </h5>
                              <div className="space-y-3">
                                <div>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-600">Consistência</span>
                                    <span className="font-semibold text-gray-900">{week.consistencyScore.toFixed(1)}%</span>
                                  </div>
                                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-indigo-500 rounded-full"
                                      style={{ width: `${week.consistencyScore}%` }}
                                    />
                                  </div>
                                </div>
                                <div>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-600">Adesão</span>
                                    <span className="font-semibold text-gray-900">{week.adherenceScore.toFixed(1)}%</span>
                                  </div>
                                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-emerald-500 rounded-full"
                                      style={{ width: `${week.adherenceScore}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Desempenho */}
                            <div className="bg-white rounded-xl p-4 border border-gray-200">
                              <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <FaChartLine className="w-4 h-4 text-emerald-500" />
                                Desempenho
                              </h5>
                              <div className="space-y-3">
                                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                  <span className="text-sm text-gray-600">Pontos ganhos</span>
                                  <span className="font-bold text-gray-900">{week.points}</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                  <span className="text-sm text-gray-600">Tempo investido</span>
                                  <span className="font-bold text-gray-900">{formatTime(week.timeSpent)}</span>
                                </div>
                                <div className="flex justify-between items-center py-2">
                                  <span className="text-sm text-gray-600">Streak final</span>
                                  <span className="font-bold text-gray-900">{week.streakAtEnd} dias</span>
                                </div>
                              </div>
                            </div>

                            {/* Insights da Semana */}
                            <div className="bg-white rounded-xl p-4 border border-gray-200">
                              <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <FaBrain className="w-4 h-4 text-purple-500" />
                                Insights
                              </h5>
                              <div className="space-y-2 text-sm">
                                {week.completionRate >= 80 ? (
                                  <p className="text-emerald-700">✨ Semana excelente! Continue assim!</p>
                                ) : week.completionRate >= 60 ? (
                                  <p className="text-indigo-700">📈 Bom progresso! Pode melhorar ainda mais.</p>
                                ) : week.completionRate >= 40 ? (
                                  <p className="text-amber-700">💪 Você consegue! Tente manter uma rotina.</p>
                                ) : (
                                  <p className="text-red-700">🎯 Hora de focar! Estabeleça metas menores.</p>
                                )}
                                
                                {week.streakAtEnd > 0 && (
                                  <p className="text-gray-600">🔥 Streak de {week.streakAtEnd} dias!</p>
                                )}
                                
                                {week.isImprovement && (
                                  <p className="text-emerald-600">📊 Melhor que a semana anterior!</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl mb-4">
                  <FaChartPie className="w-10 h-10 text-gray-400" />
                </div>
                <h4 className="text-lg font-semibold text-gray-800 mb-2">Nenhum dado ainda</h4>
                <p className="text-gray-600 max-w-md mx-auto">
                  Complete suas primeiras atividades para começar a acompanhar seu progresso semanal!
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'achievements' && (
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
              <FaTrophy className="w-7 h-7 text-amber-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">Minhas Conquistas</h3>
              <p className="text-gray-600">
                {unlockedAchievements} de {achievements.length} conquistas desbloqueadas
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {achievements.map((achievement) => (
              <div
                key={achievement.id}
                className={`rounded-xl border p-5 transition-all duration-300 ${
                  achievement.unlocked
                    ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200 hover:shadow-md'
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Ícone */}
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl ${
                    achievement.unlocked
                      ? 'bg-gradient-to-br from-amber-200 to-yellow-200'
                      : 'bg-gray-100'
                  }`}>
                    {achievement.icon}
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className={`font-bold text-lg ${
                        achievement.unlocked ? 'text-gray-900' : 'text-gray-600'
                      }`}>
                        {achievement.title}
                      </h4>
                      {achievement.unlocked && (
                        <span className="text-emerald-600">
                          <FaCheckCircle className="w-5 h-5" />
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-gray-600 mb-3">
                      {achievement.description}
                    </p>

                    {/* Barra de Progresso */}
                    {achievement.progress !== undefined && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Progresso</span>
                          <span className={`font-medium ${
                            achievement.unlocked ? 'text-emerald-600' : 'text-gray-700'
                          }`}>
                            {Math.min(100, Math.round(achievement.progress))}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              achievement.unlocked
                                ? 'bg-gradient-to-r from-amber-400 to-orange-400'
                                : 'bg-gradient-to-r from-indigo-400 to-purple-400'
                            }`}
                            style={{ width: `${Math.min(100, achievement.progress)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Próximos Passos */}
          {!achievements.every(a => a.unlocked) && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FaBullseye className="w-5 h-5 text-indigo-600" />
                Próximas conquistas
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {achievements.filter(a => !a.unlocked).slice(0, 3).map((achievement) => (
                  <div key={achievement.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center text-xl">
                      {achievement.icon}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-700 text-sm">{achievement.title}</div>
                      <div className="text-xs text-gray-500">{achievement.progress?.toFixed(0)}% completo</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center">
              <FiBarChart2 className="w-7 h-7 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">Estatísticas Detalhadas</h3>
              <p className="text-gray-600">Análise completa do seu desempenho</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  <FaClock className="w-6 h-6 text-gray-600" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">Tempo Investido</h4>
                  <p className="text-sm text-gray-600">Dedicação total</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="text-sm text-gray-500 mb-1">Total acumulado</div>
                  <div className="text-3xl font-bold text-gray-900">
                    {formatTime(currentMetrics.timeSpent)}
                  </div>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="text-sm text-gray-500 mb-1">Média por atividade</div>
                  <div className="text-3xl font-bold text-gray-900">
                    {currentMetrics.completedActivities > 0
                      ? Math.round(currentMetrics.timeSpent / currentMetrics.completedActivities)
                      : 0} min
                  </div>
                </div>
                
                {bestWeek && (
                  <div className="p-4 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-200">
                    <div className="text-sm text-indigo-600 mb-1">Melhor semana</div>
                    <div className="font-bold text-indigo-900 text-lg">Semana {bestWeek.weekNumber}</div>
                    <div className="text-xs text-indigo-500 mt-1">
                      {bestWeek.completionRate.toFixed(1)}% de conclusão • {bestWeek.points} pontos
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center">
                  <FaCheckCircle className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">Atividades</h4>
                  <p className="text-sm text-gray-600">Desempenho geral</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                  <div className="text-sm text-emerald-600 mb-1">Taxa de sucesso</div>
                  <div className="text-3xl font-bold text-emerald-900">{currentMetrics.completionRate.toFixed(1)}%</div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="text-sm text-gray-500 mb-1">Totais</div>
                    <div className="text-2xl font-bold text-gray-900">{currentMetrics.totalActivities}</div>
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="text-sm text-gray-500 mb-1">Concluídas</div>
                    <div className="text-2xl font-bold text-gray-900">{currentMetrics.completedActivities}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                  <FaChartLine className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">Análise de Tendência</h4>
                  <p className="text-sm text-gray-600">Sua evolução</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 bg-white rounded-xl border border-gray-200">
                  <div className="text-sm text-gray-500 mb-1">Direção</div>
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      data.performanceTrend === 'improving' ? 'bg-emerald-100' :
                      data.performanceTrend === 'declining' ? 'bg-red-100' : 'bg-gray-100'
                    }`}>
                      {data.performanceTrend === 'improving' ? <FaArrowTrendUp className="w-4 h-4 text-emerald-600" /> :
                       data.performanceTrend === 'declining' ? <FaArrowTrendDown className="w-4 h-4 text-red-600" /> :
                       <FaMinus className="w-4 h-4 text-gray-600" />}
                    </div>
                    <span className="font-medium text-gray-900">
                      {data.performanceTrend === 'improving' ? 'Melhorando' :
                       data.performanceTrend === 'declining' ? 'Atenção' : 'Estável'}
                    </span>
                  </div>
                </div>
                
                <div className="p-4 bg-white rounded-xl border border-gray-200">
                  <div className="text-sm text-gray-500 mb-1">Média semanal</div>
                  <div className="text-xl font-bold text-gray-900">{weeklyAverage}%</div>
                </div>

                <div className="p-4 bg-white rounded-xl border border-gray-200">
                  <div className="text-sm text-gray-500 mb-1">Consistência</div>
                  <div className="text-xl font-bold text-gray-900">
                    {weeklyProgress.length > 0 
                      ? (weeklyProgress.reduce((sum, week) => sum + week.consistencyScore, 0) / weeklyProgress.length).toFixed(1)
                      : '0'}%
                  </div>
                </div>

                <div className="p-4 bg-white rounded-xl border border-gray-200">
                  <div className="text-sm text-gray-500 mb-1">Total semanas</div>
                  <div className="text-xl font-bold text-gray-900">{weeklyProgress.length}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}