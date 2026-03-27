'use client';

import React, { useState } from 'react';
import TodayActivities from './TodayActivities';
import { useStudentSchedule } from '@/hooks/useStudentSchedule';
import {
  FaCalendarDay,
  FaTrophy,
  FaFire,
  FaChartLine,
  FaCheckCircle,
  FaCrown,
  FaCalendar,
  FaBook,
  FaBell,
  FaArrowRight,
  FaLightbulb,
  FaClock
} from 'react-icons/fa';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

interface StudentDashboardProps {
  showHeader?: boolean;
}

export default function StudentDashboard({ showHeader = true }: StudentDashboardProps) {
  const { user } = useAuth();
  const student = user?.role === 'student' ? user : null;
  const profile = student?.profile ?? {
    totalPoints: 0,
    streak: 0,
    level: 1,
  };

  const {
    todayActivities,
    instances,
    loading,
    error,
    refresh,
    totalTodayActivities
  } = useStudentSchedule();

  const [todaysDate] = useState(new Date());

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const completedToday = todayActivities.filter(a => a.status === 'completed').length;
  const pendingToday = todayActivities.filter(a => a.status === 'pending').length;
  const completionRate = totalTodayActivities > 0
    ? Math.round((completedToday / totalTodayActivities) * 100)
    : 0;

  const getMotivationalMessage = () => {
    const messages = [
      "Cada pequeno passo conta! 💪",
      "Você está mais próximo do que imagina! ✨",
      "A consistência é a chave do sucesso! 🔑",
      "Hoje é um ótimo dia para aprender! 📚",
      "Seu progresso é inspirador! 🌟"
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <div className="text-center">
          <div className="relative inline-block mb-4">
            <div className="w-16 h-16 border-4 border-purple-200 rounded-full"></div>
            <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
          </div>
          <p className="mt-4 text-slate-600 font-medium text-sm md:text-base">
            Preparando seu dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-lg md:text-xl font-semibold text-slate-800 mb-2">
            Erro ao carregar
          </h2>
          <p className="text-slate-600 mb-6 text-sm md:text-base">{error}</p>
          <button
            onClick={refresh}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all duration-200 font-medium text-sm md:text-base"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {showHeader && (
        <div className="bg-gradient-to-r from-indigo-500 to-violet-500 rounded-xl md:rounded-2xl p-4 md:p-6 mb-4 md:mb-6 text-white shadow-xl shadow-indigo-200">
          <div className="mb-6 md:mb-8">
            <div className="mb-4">
              <h1 className="text-xl md:text-2xl lg:text-3xl font-bold mb-2 flex items-center gap-2">
                {getGreeting()}, {student?.name?.split(' ')[0] || 'Estudante'}!
                <span className="text-yellow-300 animate-bounce hidden sm:inline-block">
                  <FaCrown />
                </span>
              </h1>
              <p className="text-indigo-100 text-sm md:text-base">
                {getMotivationalMessage()}
              </p>
            </div>

            <div className="flex items-center gap-2 text-indigo-100 text-xs md:text-sm">
              <FaCalendarDay className="w-3 h-3 md:w-4 md:h-4" />
              <span className="font-medium">{formatDate(todaysDate)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
            <div className="bg-white/20 backdrop-blur-sm rounded-lg md:rounded-xl p-3 md:p-4 border border-white/30 shadow-lg">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 rounded-lg md:rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <FaTrophy className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-lg md:text-xl lg:text-2xl font-bold truncate">
                    {profile.totalPoints ?? 0}
                  </div>
                  <div className="text-xs md:text-sm text-white/90 truncate">
                    Pontos Totais
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/20 backdrop-blur-sm rounded-lg md:rounded-xl p-3 md:p-4 border border-white/30 shadow-lg">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 rounded-lg md:rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <FaFire className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-lg md:text-xl lg:text-2xl font-bold truncate">
                    {profile.streak ?? 0}
                  </div>
                  <div className="text-xs md:text-sm text-white/90 truncate">
                    Dias Seguidos
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/20 backdrop-blur-sm rounded-lg md:rounded-xl p-3 md:p-4 border border-white/30 shadow-lg">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 rounded-lg md:rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <FaChartLine className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-lg md:text-xl lg:text-2xl font-bold truncate">
                    Nível {profile.level ?? 1}
                  </div>
                  <div className="text-xs md:text-sm text-white/90 truncate">
                    Seu Nível
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/20 backdrop-blur-sm rounded-lg md:rounded-xl p-3 md:p-4 border border-white/30 shadow-lg">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 rounded-lg md:rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <FaCheckCircle className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-lg md:text-xl lg:text-2xl font-bold truncate">
                    {completionRate}%
                  </div>
                  <div className="text-xs md:text-sm text-white/90 truncate">
                    Hoje
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          <div className="bg-white rounded-xl md:rounded-2xl shadow-lg p-4 md:p-6">
            <div className="flex flex-row sm:flex-row sm:items-center justify-between gap-2 mb-4 md:mb-6">
              <h2 className="text-lg md:text-xl font-bold text-slate-800 flex items-center gap-2">
                <FaCalendarDay className="w-4 h-4 md:w-5 md:h-5" />
                <span className="whitespace-nowrap">Atividades de Hoje</span>
              </h2>
              <div className="flex items-center justify-between sm:justify-end gap-4">
                <span className="bg-indigo-600 text-white px-3 py-1 rounded-full text-xs md:text-sm font-bold">
                  {completedToday}/{totalTodayActivities}
                </span>
              </div>
            </div>

            {totalTodayActivities === 0 ? (
              <div className="text-center py-8 md:py-12 border-2 border-dashed border-slate-200 rounded-xl">
                <FaLightbulb className="w-10 h-10 md:w-12 md:h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg md:text-xl font-bold text-slate-700 mb-2">
                  Dia de descanso! 🎉
                </h3>
                <p className="text-slate-500 mb-6 px-2 md:px-0 text-sm md:text-base max-w-md mx-auto">
                  Você não tem atividades programadas para hoje. Aproveite para revisar conteúdos ou explorar novos aprendizados!
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center px-2">
                  <Link
                    href="/student/programs"
                    className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-3 md:px-6 md:py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors text-sm md:text-base"
                  >
                    <FaBook className="w-3 h-3 md:w-4 md:h-4" />
                    Explorar Programas
                  </Link>
                  <Link
                    href="/student/schedules"
                    className="inline-flex items-center justify-center gap-2 bg-white text-indigo-600 border border-indigo-200 px-4 py-3 md:px-6 md:py-3 rounded-lg font-semibold hover:bg-indigo-50 transition-colors text-sm md:text-base"
                  >
                    <FaCalendar className="w-3 h-3 md:w-4 md:h-4" />
                    Ver Cronogramas
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-slate-50 rounded-xl p-4 md:p-5 mb-4 md:mb-6 border border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 md:mb-4">
                    <div>
                      <div className="text-slate-600 font-medium text-sm md:text-base mb-1">
                        Progresso do Dia
                      </div>
                      <div className="text-2xl md:text-3xl font-bold text-slate-800">
                        {completionRate}%
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <FaClock className="w-3 h-3 md:w-4 md:h-4" />
                      <span className="font-medium">
                        {todayActivities.reduce(
                          (total, a) => total + a.activitySnapshot.metadata.estimatedDuration,
                          0
                        )}{' '}
                        min total
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 md:h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                </div>

                <div>
                  <TodayActivities
                    activities={todayActivities}
                    onActivityUpdate={refresh}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4 md:space-y-6">
          <div className="bg-white rounded-xl md:rounded-2xl shadow-lg p-4 md:p-6">
            <div className="flex justify-between items-center mb-3 md:mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm md:text-base">
                <FaCalendar className="w-3 h-3 md:w-4 md:h-4" />
                <span className="whitespace-nowrap">Meus Cronogramas</span>
              </h3>
              <Link href="/student/schedules" className="text-indigo-600 hover:text-indigo-700">
                <FaArrowRight className="w-3 h-3 md:w-3.5 md:h-3.5" />
              </Link>
            </div>

            {instances.length === 0 ? (
              <div className="text-center py-6 md:py-8 text-slate-400">
                <FaCalendar className="w-6 h-6 md:w-8 md:h-8 mx-auto mb-2" />
                <p className="text-xs md:text-sm">Nenhum cronograma</p>
              </div>
            ) : (
              <div className="space-y-2 md:space-y-3">
                {instances.slice(0, 3).map(instance => (
                  <Link
                    key={instance.id}
                    href={`/student/schedules/${instance.id}`}
                    className="flex items-center gap-2 md:gap-3 p-3 md:p-4 bg-slate-50 rounded-lg md:rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                  >
                    <div
                      className="w-2 h-2 md:w-3 md:h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: '#8b5cf6' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-800 truncate text-sm">
                        Cronograma {instance.scheduleTemplateId?.slice(0, 8) || 'Ativo'}
                      </div>
                      <div className="flex items-center gap-2 md:gap-3 mt-1">
                        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${instance.progressCache?.completionPercentage || 0}%`,
                              backgroundColor: '#8b5cf6'
                            }}
                          />
                        </div>
                        <span className="text-xs md:text-sm font-semibold text-slate-600 min-w-6 md:min-w-10">
                          {(instance.progressCache?.completionPercentage &&
                            Math.round(instance.progressCache?.completionPercentage)) || 0}
                          %
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="bg-amber-50 rounded-xl md:rounded-2xl p-4 md:p-6 border border-amber-200">
            <div className="flex items-center gap-2 mb-3">
              <FaBell className="w-4 h-4 md:w-5 md:h-5 text-amber-600" />
              <h4 className="font-bold text-amber-800 text-sm md:text-base">
                Lembretes
              </h4>
            </div>
            <div className="space-y-2">
              {pendingToday > 0 && (
                <div className="text-amber-700 text-xs md:text-sm bg-white/50 p-2 md:p-3 rounded-lg">
                  Você tem {pendingToday} atividades pendentes para hoje
                </div>
              )}
              {(profile.streak ?? 0) > 0 && (
                <div className="text-amber-700 text-xs md:text-sm bg-white/50 p-2 md:p-3 rounded-lg">
                  Sequência de {profile.streak} dias! Continue assim! 🔥
                </div>
              )}
              {instances.length > 0 && (
                <div className="text-amber-700 text-xs md:text-sm bg-white/50 p-2 md:p-3 rounded-lg">
                  {instances.length} cronograma(s) em andamento
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}