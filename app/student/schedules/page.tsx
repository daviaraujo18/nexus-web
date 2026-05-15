// app/student/schedules/page.tsx
'use client';

import React, { useState, useMemo } from 'react';
import {
  FaSearch,
  FaExclamationCircle,
  FaCalendarDay,
  FaClock,
  FaArrowLeft
} from 'react-icons/fa';
import { FiGrid, FiList } from 'react-icons/fi';
import { FaCalendarAlt } from 'react-icons/fa';
import { useStudentSchedule } from '@/hooks/useStudentSchedule';
import Link from 'next/link';
import TodayActivities from '@/components/student/TodayActivities';
import ScheduleWeekView from '@/components/schedules/ScheduleWeekView';

export default function MySchedulesPage() {
  const {
    instances,
    weekActivities = [],
    loading,
    error,
    instancesTruncated,
    refresh
  } = useStudentSchedule();

  // Estados para visualização
  const [activeView, setActiveView] = useState<'today' | 'week' | 'list'>('today');
  // Schedule dayOfWeek: 0=Seg...6=Dom. Converter de JS getDay() (0=Dom).
  const [selectedDay, setSelectedDay] = useState<number>((new Date().getDay() + 6) % 7);
  const [selectedWeek, setSelectedWeek] = useState<number>(0);
  
  // Estado para controlar qual cronograma está em foco
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Filtra atividades do dia atual
  const todayActivities = useMemo(() => {
    const todayDayOfWeek = (new Date().getDay() + 6) % 7;
    return (weekActivities || []).filter(a => a.dayOfWeek === todayDayOfWeek);
  }, [weekActivities]);

  // 🔥 FIX: Lógica Multi-Cronograma Blindada
  const filteredWeekActivities = useMemo(() => {
    const safeActivities = weekActivities || [];

    if (selectedInstanceId) {
      return safeActivities.filter(activity => activity.scheduleInstanceId === selectedInstanceId);
    }
    
    return safeActivities;
  }, [weekActivities, selectedInstanceId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <div className="relative inline-block">
            <div className="w-16 h-16 border-4 border-purple-200 rounded-full"></div>
            <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
          </div>
          <p className="mt-4 text-gray-600 font-medium">Carregando sua agenda...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <FaExclamationCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Erro ao carregar</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button onClick={refresh} className="bg-purple-600 text-white px-6 py-2 rounded-xl font-medium hover:bg-purple-700 transition-colors">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 min-h-screen bg-gray-50/50">
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">Meus Cronogramas</h1>
        <p className="text-gray-600">Acompanhe suas atividades de todos os programas ativos</p>
      </div>

      {instancesTruncated && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <FaExclamationCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">Limite de cronogramas visíveis</p>
            <p className="text-sm text-amber-700 mt-1">
              Você possui mais de 30 cronogramas ativos. Apenas os 30 mais recentes estão sendo exibidos.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-2 bg-gray-100 p-1.5 rounded-xl">
            <button
              onClick={() => setActiveView('today')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${activeView === 'today' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <FaCalendarDay className="w-4 h-4" />
              <span>Hoje</span>
            </button>
            <button
              onClick={() => setActiveView('week')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${activeView === 'week' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <FiGrid className="w-4 h-4" />
              <span>Semana</span>
            </button>
            <button
              onClick={() => setActiveView('list')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${activeView === 'list' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <FiList className="w-4 h-4" />
              <span>Programas</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Filtrar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none w-full sm:w-48"
              />
            </div>
            {selectedInstanceId && (
              <button 
                onClick={() => setSelectedInstanceId(null)}
                className="text-sm text-purple-600 font-medium hover:underline"
              >
                <FaArrowLeft className="w-3 h-3 inline mr-1" />
                Voltar
              </button>
            )}
          </div>
        </div>

        {activeView === 'today' && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <FaCalendarAlt className="w-3 h-3" />
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            <span className="flex items-center gap-1">
              <FaClock className="w-3 h-3" />
              {todayActivities.length} atividade{todayActivities.length !== 1 ? 's' : ''} hoje
            </span>
          </div>
        )}
      </div>

      <div>
        {activeView === 'today' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-6">Atividades de Hoje</h2>
            <TodayActivities
              activities={todayActivities}
              loading={loading}
              onActivityUpdate={refresh}
            />
          </div>
        )}

        {activeView === 'week' && (
          <ScheduleWeekView
            selectedDay={selectedDay}
            selectedWeek={selectedWeek}
            weekActivities={filteredWeekActivities}
            expandedActivity={expandedActivity}
            onDaySelect={setSelectedDay}
            onActivityExpand={setExpandedActivity}
            onActivityUpdate={refresh}
          />
        )}

        {activeView === 'list' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="font-bold mb-4">Programas Ativos</h3>
            <div className="space-y-4">
              {instances
                .filter(inst => {
                  if (!searchTerm) return true;
                  const term = searchTerm.toLowerCase();
                  return inst.id.toLowerCase().includes(term) || (inst.scheduleName || '').toLowerCase().includes(term);
                })
                .map(inst => (
                <div key={inst.id} className="p-4 border rounded-xl flex justify-between items-center">
                  <div>
                    <div className="font-bold">{inst.scheduleName || 'Cronograma'}</div>
                    <div className="text-xs text-gray-500">ID: {inst.id}</div>
                  </div>
                  <Link href={`/student/schedules/${inst.id}`} className="text-purple-600 text-sm font-medium">Ver Detalhes</Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}