// components/student/TodayActivities.tsx - VERSÃO RESPONSIVA
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ActivityProgress, ActivityType } from '@/types/schedule';
import {
  FaCalendarCheck,
  FaBookOpen,
  FaVideo,
  FaFileAlt,
  FaQuestionCircle,
  FaCheck,
  FaHourglassHalf,
  FaLightbulb,
  FaStar,
  FaClock,
  FaPlay,
  FaExternalLinkAlt,
  FaTasks
} from 'react-icons/fa';
import { FiZap } from 'react-icons/fi';
import { FaListCheck } from 'react-icons/fa6';

interface TodayActivitiesProps {
  activities: ActivityProgress[];
  loading?: boolean;
  onActivityUpdate?: () => void;
}

export default function TodayActivities({
  activities,
  loading = false,
  onActivityUpdate
}: TodayActivitiesProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');
  const [sortBy, setSortBy] = useState<'time' | 'priority' | 'type'>('time');
  const [processingActivity, setProcessingActivity] = useState<string | null>(null);

  // Aplicar filtros
  const filteredActivities = activities.filter(activity => {
    if (filter === 'all') return true;
    return activity.status === filter;
  });

  // Aplicar ordenação
  const sortedActivities = [...filteredActivities].sort((a, b) => {
    switch (sortBy) {
      case 'time':
        return (a.activitySnapshot?.metadata?.estimatedDuration ?? 0) - (b.activitySnapshot?.metadata?.estimatedDuration ?? 0);
      case 'priority':
        const priorityA = a.activitySnapshot?.scoring?.isRequired ? 1 : 0;
        const priorityB = b.activitySnapshot?.scoring?.isRequired ? 1 : 0;
        return priorityB - priorityA;
      case 'type':
        return (a.activitySnapshot?.type ?? '').localeCompare(b.activitySnapshot?.type ?? '');
      default:
        return 0;
    }
  });

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'quick': return <FiZap className="w-3 h-3 md:w-4 md:h-4" />;
      case 'text': return <FaBookOpen className="w-3 h-3 md:w-4 md:h-4" />;
      case 'quiz': return <FaQuestionCircle className="w-3 h-3 md:w-4 md:h-4" />;
      case 'video': return <FaVideo className="w-3 h-3 md:w-4 md:h-4" />;
      case 'checklist': return <FaListCheck className="w-3 h-3 md:w-4 md:h-4" />;
      case 'file': return <FaFileAlt className="w-3 h-3 md:w-4 md:h-4" />;
      default: return <FaTasks className="w-3 h-3 md:w-4 md:h-4" />;
    }
  };

  const getActivityIconStyle = (type: ActivityType, completed: boolean) => {
    if (completed) return 'bg-emerald-100 text-emerald-600';
    
    switch (type) {
      case 'quick': return 'bg-amber-100 text-amber-600';
      case 'text': return 'bg-blue-100 text-blue-600';
      case 'quiz': return 'bg-purple-100 text-purple-600';
      case 'video': return 'bg-red-100 text-red-600';
      case 'checklist': return 'bg-emerald-100 text-emerald-600';
      case 'file': return 'bg-gray-100 text-gray-600';
      default: return 'bg-indigo-100 text-indigo-600';
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          color: 'text-amber-700 bg-amber-50',
          icon: <FaClock className="w-2 h-2 md:w-3 md:h-3" />,
          label: 'Pendente'
        };
      case 'in_progress':
        return {
          color: 'text-blue-700 bg-blue-50',
          icon: <FaHourglassHalf className="w-2 h-2 md:w-3 md:h-3" />,
          label: 'Em Progresso'
        };
      case 'completed':
        return {
          color: 'text-emerald-700 bg-emerald-50',
          icon: <FaCheck className="w-2 h-2 md:w-3 md:h-3" />,
          label: 'Concluída'
        };
      case 'skipped':
        return {
          color: 'text-gray-700 bg-gray-50',
          icon: <FaClock className="w-2 h-2 md:w-3 md:h-3" />,
          label: 'Pulada'
        };
      default:
        return {
          color: 'text-gray-700 bg-gray-50',
          icon: <FaClock className="w-2 h-2 md:w-3 md:h-3" />,
          label: 'Pendente'
        };
    }
  };

  const handleActivityClick = async (activity: ActivityProgress, e: React.MouseEvent) => {
    if (activity.status === 'pending') {
      setProcessingActivity(activity.id);
      try {
        router.push(`/student/activity/${activity.id}`);
      } finally {
        setProcessingActivity(null);
      }
    }
  };

  const handleOpenInPage = (activityId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/student/activity/${activityId}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="relative inline-block mb-4">
            <div className="w-12 h-12 border-3 border-indigo-200 rounded-full"></div>
            <div className="w-12 h-12 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
          </div>
          <p className="mt-4 text-slate-600 font-medium text-sm md:text-base">Carregando atividades...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Filtros e ordenação para mobile/desktop 
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl md:rounded-2xl border border-slate-200 p-4 md:p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-slate-500 text-xs md:text-sm">Status:</span>
            </div>
            <div className="flex flex-wrap gap-1 md:gap-2">
              {[
                { value: 'all', label: 'Todas' },
                { value: 'pending', label: 'Pendentes' },
                { value: 'in_progress', label: 'Em Progresso' },
                { value: 'completed', label: 'Concluídas' }
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setFilter(value as any)}
                  className={`px-2 md:px-3 py-1.5 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-medium transition-all duration-200 ${
                    filter === value
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-slate-500 text-xs md:text-sm">Ordenar por:</span>
            </div>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-3 md:px-4 py-2 md:py-3 bg-white border border-slate-300 rounded-lg md:rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-xs md:text-sm"
              >
                <option value="time">Duração (curtas primeiro)</option>
                <option value="priority">Prioridade (obrigatórias primeiro)</option>
                <option value="type">Tipo de atividade</option>
              </select>
              <div className="absolute right-2 md:right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 md:w-5 md:h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>*/}

      {/* Lista de Atividades */}
      <div className="space-y-3 md:space-y-4">
        {sortedActivities.length === 0 ? (
          <div className="text-center py-8 md:py-12 bg-gradient-to-br from-white to-slate-50 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm">
            <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl md:rounded-2xl mb-4 md:mb-6">
              <FaCalendarCheck className="w-8 h-8 md:w-10 md:h-10 text-slate-400" />
            </div>
            <h3 className="text-base md:text-lg font-semibold text-slate-800 mb-2 px-2">
              {filter === 'all' ? 'Nenhuma atividade para hoje' : 'Nenhuma atividade encontrada'}
            </h3>
            <p className="text-slate-600 mb-4 md:mb-6 px-4 text-sm md:text-base max-w-md mx-auto">
              {filter === 'all'
                ? 'Excelente! Você completou todas as atividades programadas para hoje.'
                : 'Tente ajustar os filtros para encontrar outras atividades.'}
            </p>
            <div className="inline-flex items-center gap-2 text-xs md:text-sm text-indigo-600 font-medium">
              <FaLightbulb className="w-3 h-3 md:w-4 md:h-4" />
              <span>Use este tempo para revisar seus aprendizados!</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {sortedActivities.map(activity => {
              const statusConfig = getStatusConfig(activity.status);
              const isCompleted = activity.status === 'completed';
              const isInProgress = activity.status === 'in_progress';
              const isPending = activity.status === 'pending';

              return (
                <div
                  key={activity.id}
                  className={`
                    border rounded-lg md:rounded-xl p-3 md:p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5
                    ${isCompleted ? 'bg-emerald-50 border-emerald-200' :
                      isInProgress ? 'bg-blue-50 border-blue-200' :
                      'bg-white border-slate-200'}
                    ${isPending ? 'hover:border-indigo-300' : ''}
                  `}
                >
                  {/* HEADER */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex gap-2 md:gap-3 flex-1 min-w-0">
                      {/* ICON */}
                      <div
                        className={`
                          w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center flex-shrink-0
                          ${getActivityIconStyle((activity.activitySnapshot?.type || 'quick') as ActivityType, isCompleted)}
                        `}
                      >
                        {getActivityIcon(activity.activitySnapshot?.type || 'quick')}
                      </div>

                      {/* INFO */}
                      <div className="flex flex-col gap-1 flex-1 min-w-0">
                        <div className="flex items-center gap-1 md:gap-2">
                          <span className="text-xs md:text-sm font-semibold text-slate-900 line-clamp-2 md:line-clamp-1">
                            {activity.activitySnapshot?.title || 'Atividade'}
                          </span>

                          {activity.activitySnapshot?.scoring?.isRequired && (
                            <span
                              title="Atividade obrigatória"
                              className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 hidden md:block"
                            />
                          )}
                        </div>

                        {/* STATUS BADGE */}
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] md:text-xs font-semibold px-1.5 md:px-2 py-0.5 rounded-md ${statusConfig.color}`}
                          >
                            {statusConfig.label}
                          </span>
                          
                          {activity.activitySnapshot.scoring.isRequired && (
                            <span
                              title="Atividade obrigatória"
                              className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 md:hidden"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* METADATA */}
                  <div className="flex flex-wrap gap-2 md:gap-3 text-slate-500 text-[10px] md:text-xs mt-2 md:mt-3">
                    <div className="flex items-center gap-1">
                      <FaClock className="w-2.5 h-2.5 md:w-3 md:h-3" />
                      {activity.activitySnapshot?.metadata?.estimatedDuration ?? 0}min
                    </div>

                    <div className="flex items-center gap-1">
                      <FaStar className="w-2.5 h-2.5 md:w-3 md:h-3" />
                      {activity.activitySnapshot?.scoring?.pointsOnCompletion ?? 0}pts
                    </div>

                    {activity.activitySnapshot?.metadata?.difficulty && (
                      <div className={`flex items-center gap-1 px-1 py-0.5 rounded text-[9px] md:text-[10px] font-medium ${
                        activity.activitySnapshot.metadata.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' :
                        activity.activitySnapshot.metadata.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {activity.activitySnapshot.metadata.difficulty === 'easy' ? 'Fácil' :
                         activity.activitySnapshot.metadata.difficulty === 'medium' ? 'Médio' : 'Difícil'}
                      </div>
                    )}
                  </div>

                  {/* FOOTER */}
                  <div className="border-t border-slate-100 pt-2 md:pt-3 mt-2 md:mt-3">
                    <div className="flex gap-2">
                      {/* MAIN ACTION BUTTON */}
                      {isPending ? (
                        <button
                          onClick={(e) => handleActivityClick(activity, e)}
                          disabled={processingActivity === activity.id}
                          className={`
                            flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700
                            text-white font-semibold text-xs
                            px-3 py-2 rounded-lg
                            flex items-center justify-center gap-1.5
                            transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                          `}
                        >
                          <FaPlay className="w-2.5 h-2.5 md:w-3 md:h-3" />
                          {processingActivity === activity.id ? 'Abrindo...' : 'Iniciar'}
                        </button>
                      ) : (
                        <button
                          onClick={(e) => handleOpenInPage(activity.id, e)}
                          className="
                            flex-1 bg-indigo-500 hover:bg-indigo-600
                            text-white font-semibold text-xs
                            px-3 py-2 rounded-lg
                            flex items-center justify-center gap-1.5
                            transition-colors duration-200
                          "
                        >
                          <FaExternalLinkAlt className="w-2.5 h-2.5 md:w-3 md:h-3" />
                          Abrir
                        </button>
                      )}
                    </div>

                    {/* COMPLETION STATUS */}
                    {isCompleted && (
                      <div className="flex items-center gap-1.5 text-[10px] md:text-xs font-semibold text-emerald-600 mt-2">
                        <FaCheck className="w-2.5 h-2.5 md:w-3 md:h-3" />
                        Concluída • {activity.scoring.pointsEarned} pontos
                      </div>
                    )}

                    {/* IN PROGRESS STATUS */}
                    {isInProgress && activity.startedAt && (
                      <div className="flex items-center gap-1.5 text-[10px] md:text-xs font-semibold text-blue-600 mt-2">
                        <FaHourglassHalf className="w-2.5 h-2.5 md:w-3 md:h-3" />
                        Em andamento
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}