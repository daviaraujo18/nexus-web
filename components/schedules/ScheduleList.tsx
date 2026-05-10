// components/schedules/ScheduleList.tsx
'use client';

import React, { useState } from 'react';
import { 
  FaCalendarWeek, 
  FaClock, 
  FaArrowRight, 
  FaPlay,
  FaPause,
  FaCheckCircle
} from 'react-icons/fa';
import { ScheduleInstance } from '@/types/schedule';
import Link from 'next/link';

interface ScheduleListProps {
  schedules: ScheduleInstance[];
  expandedSchedule: string | null;
  onScheduleExpand: (scheduleId: string) => void;
  searchTerm?: string;
  filterStatus?: 'all' | 'active' | 'paused' | 'completed';
}

export default function ScheduleList({
  schedules,
  expandedSchedule,
  onScheduleExpand,
  searchTerm = '',
  filterStatus = 'all'
}: ScheduleListProps) {
  // Filtrar cronogramas
  const filteredSchedules = schedules.filter(schedule => {
    if (filterStatus !== 'all' && schedule.status !== filterStatus) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchId = schedule.id.toLowerCase().includes(term);
      const matchName = (schedule.scheduleName || '').toLowerCase().includes(term);
      if (!matchId && !matchName) return false;
    }
    return true;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <FaPlay className="w-3 h-3 text-emerald-500" />;
      case 'paused': return <FaPause className="w-3 h-3 text-amber-500" />;
      case 'completed': return <FaCheckCircle className="w-3 h-3 text-gray-500" />;
      default: return <FaPlay className="w-3 h-3 text-gray-500" />;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center">
            <FaCalendarWeek className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Meus Cronogramas</h3>
            <p className="text-sm text-gray-600">
              {filteredSchedules.length} cronograma{filteredSchedules.length !== 1 ? 's' : ''} encontrado{filteredSchedules.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {filteredSchedules.length === 0 ? (
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl mb-4">
            <FaCalendarWeek className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500">
            Nenhum cronograma encontrado
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSchedules.map(schedule => {
            const isExpanded = expandedSchedule === schedule.id;
            
            return (
              <div key={schedule.id} className="border border-gray-200 rounded-xl overflow-hidden">
                {/* Cabeçalho do Cronograma */}
                <div 
                  className="p-4 cursor-pointer bg-gradient-to-r from-gray-50 to-white hover:from-gray-100 transition-all duration-200"
                  onClick={() => onScheduleExpand(schedule.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(schedule.status)}
                      <div>
                        <h4 className="font-medium text-gray-900">{schedule.scheduleName || 'Cronograma'}</h4>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <FaClock className="w-3 h-3" />
                          <span>Semana {schedule.currentWeekNumber}</span>
                          <span>•</span>
                          <span>Iniciado em {schedule.startedAt?.toLocaleDateString('pt-BR') ?? '—'}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        schedule.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                        schedule.status === 'paused' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {schedule.status === 'active' ? 'Ativo' :
                         schedule.status === 'paused' ? 'Pausado' : 'Concluído'}
                      </span>
                      <svg 
                        className={`w-4 h-4 text-gray-400 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                {/* Conteúdo Expandido */}
                {isExpanded && schedule.progressCache && (
                  <div className="border-t border-gray-200 p-4 bg-gray-50">
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="text-center p-3 bg-white rounded-lg">
                        <div className="text-lg font-bold text-gray-900 mb-1">
                          {schedule.progressCache.completedActivities}
                        </div>
                        <div className="text-xs text-gray-600">Concluídas</div>
                      </div>
                      
                      <div className="text-center p-3 bg-white rounded-lg">
                        <div className="text-lg font-bold text-gray-900 mb-1">
                          {schedule.progressCache.totalActivities}
                        </div>
                        <div className="text-xs text-gray-600">Totais</div>
                      </div>
                      
                      <div className="text-center p-3 bg-white rounded-lg">
                        <div className="text-lg font-bold text-gray-900 mb-1">
                          {Math.round(schedule.progressCache.completionPercentage)}%
                        </div>
                        <div className="text-xs text-gray-600">Progresso</div>
                      </div>
                      
                      <div className="text-center p-3 bg-white rounded-lg">
                        <div className="text-lg font-bold text-gray-900 mb-1">
                          {schedule.progressCache?.streakDays ?? 0}
                        </div>
                        <div className="text-xs text-gray-600">Dias seguidos</div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <Link
                        href={`/student/schedules/${schedule.id}`}
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Ver detalhes completos
                        <FaArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}