// app/student/schedules/page.tsx
'use client';

import React, { useState, useMemo } from 'react';
import {
  FaSearch,
  FaExclamationCircle
} from 'react-icons/fa';
import { FiGrid, FiList } from 'react-icons/fi';
import { useStudentSchedule } from '@/hooks/useStudentSchedule';
import Link from 'next/link';

import ScheduleWeekView from '@/components/schedules/ScheduleWeekView';

export default function MySchedulesPage() {
  const {
    instances,
    weekActivities = [], // Default para evitar erros de undefined
    loading,
    error,
    refresh
  } = useStudentSchedule();

  // Estados para visualização
  const [activeView, setActiveView] = useState<'calendar' | 'week' | 'list'>('week');
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());
  const [selectedWeek, setSelectedWeek] = useState<number>(0);
  
  // Estado para controlar qual cronograma está em foco
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // 🔥 FIX: Lógica Multi-Cronograma Blindada
  const filteredWeekActivities = useMemo(() => {
    const safeActivities = weekActivities || [];

    // Se o usuário clicou em um cronograma específico na barra lateral, filtra por ele
    if (selectedInstanceId) {
      console.log(`🎯 [Página] Exibindo apenas o cronograma: ${selectedInstanceId}`);
      return safeActivities.filter(activity => activity.scheduleInstanceId === selectedInstanceId);
    }
    
    // 🌟 AGENDA INTEGRADA: Se nada estiver selecionado, mostra TUDO de todos os cronogramas ativos
    // Isso resolve o problema de cronogramas que parecem "sumir"
    console.log(`📚 [Página] Exibindo agenda integrada de todas as instâncias.`);
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

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-2 bg-gray-100 p-1.5 rounded-xl">
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
              <span>Lista</span>
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
                Ver Agenda Completa
              </button>
            )}
          </div>
        </div>
      </div>

      <div>
        {activeView === 'week' ? (
          <ScheduleWeekView
            selectedDay={selectedDay}
            selectedWeek={selectedWeek}
            weekActivities={filteredWeekActivities}
            expandedActivity={expandedActivity}
            onDaySelect={setSelectedDay}
            onActivityExpand={setExpandedActivity}
            onActivityUpdate={refresh}
          />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="font-bold mb-4">Programas Ativos</h3>
            <div className="space-y-4">
              {instances.map(inst => (
                <div key={inst.id} className="p-4 border rounded-xl flex justify-between items-center">
                  <div>
                    <div className="font-bold">Programa de Desenvolvimento</div>
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