// components/schedules/ScheduleWeekView.tsx
'use client';

import React from 'react';
import {
  FaCalendarDay,
  FaClock,
  FaTrophy,
  FaBookOpen,
  FaVideo,
  FaQuestionCircle,
  FaFileAlt,
  FaBolt,
} from 'react-icons/fa';
import ActivityExecutor from '@/components/activities/ActivityExecutor';
import { ActivityProgress } from '@/types/schedule';
import { FaListCheck } from 'react-icons/fa6';

// Dias da semana em português
const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const FULL_DAYS_OF_WEEK = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

interface ScheduleWeekViewProps {
  selectedDay: number;
  selectedWeek: number;
  weekActivities: ActivityProgress[];
  expandedActivity: string | null;
  onDaySelect: (dayIndex: number) => void;
  onActivityExpand: (activityId: string) => void;
  onActivityUpdate: () => void;
}

export default function ScheduleWeekView({
  selectedDay,
  selectedWeek,
  weekActivities,
  expandedActivity,
  onDaySelect,
  onActivityExpand,
  onActivityUpdate
}: ScheduleWeekViewProps) {
  const currentDate = new Date();

  // Calcular datas da semana selecionada (semana começa na Segunda)
  const getWeekDates = (weekOffset: number) => {
    const now = new Date();
    const currentDay = now.getDay(); // 0=Dom, 1=Seg, ...

    // Calcular a Segunda-feira da semana atual
    const daysToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + daysToMonday + weekOffset * 7);
    monday.setHours(0, 0, 0, 0);

    // weekDates indexado por getDay(): 1=Seg, 2=Ter, ..., 6=Sáb, 0=Dom (fim da semana)
    const weekDates: Date[] = new Array(7);
    for (let i = 1; i <= 6; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + (i - 1));
      weekDates[i] = date;
    }
    // Domingo = Segunda + 6 dias (fim da semana)
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    weekDates[0] = sunday;

    return weekDates;
  };

  const weekDates = getWeekDates(selectedWeek);
  const isCurrentWeek = selectedWeek === 0;

  // Formatar data
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short'
    });
  };

  // Obter ícone para tipo de atividade
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'quick': return <FaBolt className="w-4 h-4" />;
      case 'text': return <FaBookOpen className="w-4 h-4" />;
      case 'quiz': return <FaQuestionCircle className="w-4 h-4" />;
      case 'video': return <FaVideo className="w-4 h-4" />;
      case 'checklist': return <FaListCheck className="w-4 h-4" />;
      case 'file': return <FaFileAlt className="w-4 h-4" />;
      default: return <FaListCheck className="w-4 h-4" />;
    }
  };

  // Obter cor para tipo de atividade
  const getActivityColor = (type: string) => {
    switch (type) {
      case 'quick': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'text': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'quiz': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'video': return 'bg-red-50 text-red-700 border-red-200';
      case 'checklist': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'file': return 'bg-gray-50 text-gray-700 border-gray-200';
      default: return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    }
  };

  // Obter status da atividade
  const getActivityStatus = (activity: ActivityProgress) => {
    switch (activity.status) {
      case 'pending': return { label: 'Pendente', color: 'bg-amber-100 text-amber-800' };
      case 'in_progress': return { label: 'Em Progresso', color: 'bg-blue-100 text-blue-800' };
      case 'completed': return { label: 'Concluída', color: 'bg-emerald-100 text-emerald-800' };
      case 'skipped': return { label: 'Pulada', color: 'bg-gray-100 text-gray-800' };
      default: return { label: 'Pendente', color: 'bg-amber-100 text-amber-800' };
    }
  };

  // Filtrar atividades para o dia selecionado
  const dayActivities = weekActivities.filter(activity => {
    // Filtra atividades do dia selecionado
    // Além disso, se tiver weekNumber no progresso, pode verificar também
    return activity.dayOfWeek === selectedDay;
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Cabeçalho da Semana */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Visualização Semanal</h3>
        </div>
      </div>

      {/* Tabs dos Dias da Semana */}
      <div className="border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {WEEK_ORDER.map((dayIndex) => {
            const day = DAYS_OF_WEEK[dayIndex];
            const date = weekDates[dayIndex];

            const isToday =
              date.getDate() === currentDate.getDate() &&
              date.getMonth() === currentDate.getMonth() &&
              date.getFullYear() === currentDate.getFullYear();

            const isSelected = selectedDay === dayIndex;

            return (
              <button
                key={dayIndex}
                onClick={() => onDaySelect(dayIndex)}
                className={`flex flex-col items-center p-4 min-w-[100px] transition-all duration-200 ${isSelected
                    ? 'bg-gradient-to-br from-blue-50 to-cyan-50 border-b-2 border-blue-500'
                    : 'hover:bg-gray-50'
                  }`}
              >
                <div
                  className={`text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-gray-600'
                    }`}
                >
                  {day}
                </div>

                <div
                  className={`text-lg font-bold mt-1 ${isToday
                      ? 'text-blue-600'
                      : isSelected
                        ? 'text-blue-800'
                        : 'text-gray-700'
                    }`}
                >
                  {date.getDate()}
                </div>

                {isToday && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-1"></div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Atividades do Dia Selecionado */}
      <div className="p-6">
        <h4 className="font-bold text-gray-900 text-lg mb-6">
          Atividades para {FULL_DAYS_OF_WEEK[selectedDay]}
        </h4>

        {dayActivities.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl mb-6">
              <FaCalendarDay className="w-10 h-10 text-gray-400" />
            </div>
            <h5 className="text-lg font-semibold text-gray-800 mb-2">
              Nenhuma atividade programada
            </h5>
            <p className="text-gray-500 max-w-md mx-auto">
              Não há atividades programadas para este dia. Aproveite para descansar ou revisar conteúdos anteriores.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {dayActivities.map(activity => {
              const status = getActivityStatus(activity);
              const isExpanded = expandedActivity === activity.id;

              return (
                <div key={activity.id} className="border border-gray-200 rounded-2xl overflow-hidden hover:shadow-sm transition-shadow duration-300">
                  <div
                    className="p-5 cursor-pointer bg-gradient-to-r from-white to-gray-50 hover:from-gray-50 transition-all duration-200"
                    onClick={() => onActivityExpand(isExpanded ? '' : activity.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-xl ${getActivityColor(activity.activitySnapshot.type)}`}>
                          {getActivityIcon(activity.activitySnapshot.type)}
                        </div>
                        <div>
                          <h5 className="font-bold text-gray-900 mb-1">{activity.activitySnapshot.title}</h5>
                          <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                            {activity.activitySnapshot.description || activity.activitySnapshot.instructions}
                          </p>
                          <div className="flex items-center gap-3 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <FaClock className="w-3 h-3" />
                              <span>{activity.activitySnapshot.metadata.estimatedDuration} min</span>
                            </div>
                            {activity.activitySnapshot.scoring.pointsOnCompletion > 0 && (
                              <div className="flex items-center gap-1">
                                <FaTrophy className="w-3 h-3 text-amber-500" />
                                <span>{activity.activitySnapshot.scoring.pointsOnCompletion} pontos</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-3">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${status.color}`}>
                          {status.label}
                        </span>
                        <button className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                          {isExpanded ? 'Recolher' : 'Expandir'}
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isExpanded ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Executor de Atividade Expandido */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 p-5">
                      <ActivityExecutor
                        progress={activity}
                        onStatusChange={onActivityUpdate}
                        onCompletion={onActivityUpdate}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}