// components/schedule/WeekScheduleGrid.tsx - VERSÃO CORRIGIDA
'use client';

import React, { useState } from 'react';
import { CreateScheduleDTO, CreateActivityDTO } from '@/types/schedule';
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaCopy,
  FaClock,
  FaStar,
  FaExclamationCircle,
  FaCheckCircle
} from 'react-icons/fa';
import QuickAddInput from './QuickAddInput';

interface WeekScheduleGridProps {
  formData: CreateScheduleDTO;
  daysOfWeek: Array<{ id: number; label: string; full: string }>;
  onAddActivity: (day: number) => void;
  onEditActivity: (day: number, activity: CreateActivityDTO, index: number) => void;
  onRemoveActivity: (day: number, index: number) => void;
  onDuplicateActivity: (day: number, activity: CreateActivityDTO) => void;
  updateField: (field: keyof CreateScheduleDTO, value: any) => void;
}

export default function WeekScheduleGrid({
  formData,
  daysOfWeek,
  onAddActivity,
  onEditActivity,
  onRemoveActivity,
  onDuplicateActivity,
  updateField
}: WeekScheduleGridProps) {

  const getActivityIcon = (type: string) => {
    const icons: Record<string, string> = {
      'quick': '⚡',
      'text': '📝',
      'quiz': '❓',
      'video': '🎬',
      'checklist': '✅',
      'file': '📎'
    };
    return icons[type] || '🎯';
  };

  const getActivityColor = (type: string) => {
    const colors: Record<string, string> = {
      'quick': 'bg-blue-100 text-blue-800 border-blue-200',
      'text': 'bg-purple-100 text-purple-800 border-purple-200',
      'quiz': 'bg-amber-100 text-amber-800 border-amber-200',
      'video': 'bg-red-100 text-red-800 border-red-200',
      'checklist': 'bg-green-100 text-green-800 border-green-200',
      'file': 'bg-indigo-100 text-indigo-800 border-indigo-200'
    };
    return colors[type] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  // ✅ CORREÇÃO: Usar filtro correto e mapeamento de índices
  const getActivitiesByDay = (day: number) => {
    return formData.activities
      .filter(activity => activity.dayOfWeek === day)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  };

  const getDayStats = (day: number) => {
    const activities = getActivitiesByDay(day);
    const totalTime = activities.reduce((sum, act) =>
      sum + (act.metadata.estimatedDuration || 0), 0
    );
    const totalPoints = activities.reduce((sum, act) =>
      sum + (act.scoring.pointsOnCompletion || 0), 0
    );
    const requiredCount = activities.filter(act => act.scoring.isRequired).length;

    return {
      totalTime,
      totalPoints,
      count: activities.length,
      requiredCount
    };
  };

  const [quickAddingDay, setQuickAddingDay] = useState<number | null>(null);

  // ✅ CORREÇÃO: Adição com orderIndex correto
  const handleAddQuickActivity = (title: string, day: number) => {
    const activitiesForDay = getActivitiesByDay(day);
    const nextOrderIndex = activitiesForDay.length;

    const defaultQuickActivity: CreateActivityDTO = {
      dayOfWeek: day,
      orderIndex: nextOrderIndex,
      type: 'quick',
      title: title,
      description: title,
      instructions: `Complete a atividade: ${title}`,
      config: {
        requiresConfirmation: true,
        autoComplete: true
      },
      scoring: {
        isRequired: true,
        pointsOnCompletion: 10,
        bonusPoints: 0
      },
      metadata: {
        estimatedDuration: 60,
        difficulty: 'easy',
        therapeuticFocus: [],
        educationalFocus: []
      },
    };

    // Adiciona ao final do array de atividades
    const newActivities = [...formData.activities, defaultQuickActivity];
    updateField('activities', newActivities);
    setQuickAddingDay(null);
  };

  // ✅ CORREÇÃO: Função para encontrar índice global
  const findGlobalActivityIndex = (day: number, localIndex: number): number => {
    const activitiesForDay = getActivitiesByDay(day);
    if (localIndex >= activitiesForDay.length) return -1;

    const targetActivity = activitiesForDay[localIndex];
    return formData.activities.findIndex(
      activity =>
        activity.dayOfWeek === targetActivity.dayOfWeek &&
        activity.orderIndex === targetActivity.orderIndex &&
        activity.title === targetActivity.title // Verificação extra para segurança
    );
  };

  return (
    <div className="space-y-6">
      {/* Grid de Dias - Layout Horizontal Expandido */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {([...daysOfWeek.slice(1), daysOfWeek[0]]).map((day) => {
          const activities = getActivitiesByDay(day.id);
          const stats = getDayStats(day.id);
          const hasActivities = activities.length > 0;

          return (
            <div
              key={day.id}
              className={`bg-white rounded-xl shadow-sm border ${hasActivities
                ? 'border-gray-300 hover:border-indigo-300'
                : 'border-gray-200 hover:border-gray-300'
                } transition-all duration-200`}
            >
              {/* Cabeçalho do Dia */}
              <div className={`p-5 rounded-t-xl ${hasActivities
                ? 'bg-gradient-to-r from-gray-50 to-white'
                : 'bg-gray-50'
                }`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white border-2 border-indigo-200 rounded-xl flex items-center justify-center shadow-sm">
                        <span className="text-lg font-bold text-indigo-600">{day.label}</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-800">{day.full}</h3>
                        <p className="text-sm text-gray-500">
                          {stats.count} atividade{stats.count !== 1 ? 's' : ''}
                          {stats.requiredCount > 0 && ` • ${stats.requiredCount} obrigatória${stats.requiredCount !== 1 ? 's' : ''}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Estatísticas do Dia */}
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-4">
                      {stats.totalTime > 0 && (
                        <div className="flex items-center gap-1 text-sm">
                          <FaClock className="w-3 h-3 text-gray-400" />
                          <span className="font-semibold text-gray-700">
                            {stats.totalTime}min
                          </span>
                        </div>
                      )}
                      {stats.totalPoints > 0 && (
                        <div className="flex items-center gap-1 text-sm">
                          <FaStar className="w-3 h-3 text-amber-400" />
                          <span className="font-semibold text-gray-700">
                            {stats.totalPoints}pts
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onAddActivity(day.id)}
                  className={`w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-3 ${hasActivities
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700 shadow-md'
                    : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 hover:from-gray-200 hover:to-gray-300 border border-gray-300'
                    }`}
                >
                  <FaPlus className="w-4 h-4" />
                  {hasActivities ? 'Adicionar Outra Atividade' : 'Adicionar Primeira Atividade'}
                </button>

                {/* ÁREA DE ADIÇÃO RÁPIDA - NOVO */}
                <div className="mt-3">
                  {quickAddingDay === day.id ? (
                    <QuickAddInput
                      day={day.id}
                      dayLabel={day.full}
                      onAddQuickActivity={handleAddQuickActivity}
                      isAdding={true}
                      onToggle={() => setQuickAddingDay(null)}
                    />
                  ) : (
                    <div className="flex gap-2">
                      <QuickAddInput
                        day={day.id}
                        dayLabel={day.full}
                        onAddQuickActivity={handleAddQuickActivity}
                        isAdding={false}
                        onToggle={() => setQuickAddingDay(day.id)}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Lista de Atividades */}
              <div className="p-4 max-h-[400px] overflow-y-auto">
                {hasActivities ? (
                  <div className="space-y-3">
                    {activities.map((activity, localIndex) => {
                      // ✅ CORREÇÃO: Encontrar índice global correto
                      const globalIndex = findGlobalActivityIndex(day.id, localIndex);

                      return (
                        <div
                          key={`${day.id}-${localIndex}-${activity.orderIndex}`}
                          className="group bg-white border border-gray-200 rounded-lg p-4 hover:border-indigo-200 hover:shadow-sm transition-all"
                        >
                          <div className="flex items-start gap-3">
                            {/* Ícone do Tipo */}
                            <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${getActivityColor(activity.type)} text-lg`}>
                              {getActivityIcon(activity.type)}
                            </div>

                            {/* Conteúdo da Atividade */}
                            <div className="flex-1 min-w-0">
                              {/* CABEÇALHO COM TÍTULO E BOTÕES DISCRETOS */}
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <h4 className="font-semibold text-gray-800 text-sm mb-1">
                                        {activity.title}
                                      </h4>
                                      <div className="flex items-center gap-3">
                                        <span className={`text-xs px-2 py-1 rounded-full ${getActivityColor(activity.type)}`}>
                                          {activity.type === 'quick' && 'Rápida'}
                                          {activity.type === 'text' && 'Texto'}
                                          {activity.type === 'quiz' && 'Quiz'}
                                          {activity.type === 'video' && 'Vídeo'}
                                          {activity.type === 'checklist' && 'Checklist'}
                                          {activity.type === 'file' && 'Arquivo'}
                                        </span>

                                        {activity.scoring.isRequired && (
                                          <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full flex items-center gap-1">
                                            <FaExclamationCircle className="w-3 h-3" />
                                            Obrigatória
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* BOTÕES DISCRETOS - Usando índices corrigidos */}
                                    <div className="flex gap-1 ml-2">
                                      {/* Botão Editar (Discreto) */}
                                      <button
                                        type="button"
                                        onClick={() => globalIndex !== -1 && onEditActivity(day.id, activity, globalIndex)}
                                        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Editar atividade"
                                        disabled={globalIndex === -1}
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                      </button>

                                      {/* Botão Apagar (Discreto) */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (globalIndex !== -1 && window.confirm('Tem certeza que deseja remover esta atividade?')) {
                                            onRemoveActivity(day.id, globalIndex);
                                          }
                                        }}
                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Remover atividade"
                                        disabled={globalIndex === -1}
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* DESCRIÇÃO */}
                              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                                {activity.description || activity.instructions}
                              </p>

                              {/* METADADOS */}
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <div className="flex items-center gap-1">
                                  <FaClock className="w-3 h-3" />
                                  <span>{activity.metadata.estimatedDuration} min</span>
                                </div>

                                <div className="flex items-center gap-1">
                                  <FaStar className="w-3 h-3" />
                                  <span>{activity.scoring.pointsOnCompletion} pontos</span>
                                </div>

                                <div className={`text-xs px-2 py-1 rounded-full ${activity.metadata.difficulty === 'easy'
                                  ? 'bg-green-100 text-green-800'
                                  : activity.metadata.difficulty === 'medium'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                                  }`}>
                                  {activity.metadata.difficulty === 'easy' && 'Fácil'}
                                  {activity.metadata.difficulty === 'medium' && 'Médio'}
                                  {activity.metadata.difficulty === 'hard' && 'Difícil'}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                      <FaPlus className="w-6 h-6 text-gray-400" />
                    </div>
                    <h4 className="font-medium text-gray-600 mb-2">
                      Nenhuma atividade ainda
                    </h4>
                    <p className="text-gray-500 text-sm mb-4">
                      Clique no botão acima para começar
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}