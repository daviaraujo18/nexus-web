// components/schedule/ScheduleBuilder.tsx
'use client';

import React, { useEffect, useState } from 'react';
import {
  CreateScheduleDTO,
  CreateActivityDTO
} from '@/types/schedule';
import { useScheduleForm } from '@/hooks/useScheduleForm';
import { useAuth } from '@/context/AuthContext';
import WeekScheduleGrid from './WeekScheduleGrid';
import ScheduleHeaderPanel from './ScheduleHeaderPanel';
import ScheduleConfirmation from './ScheduleConfirmation';
import QuickActivityModal from './QuickActivityModal';
import {
  FaEye,
  FaListOl,
  FaCalendarCheck
} from 'react-icons/fa';

interface ScheduleBuilderProps {
  onSuccess?: (scheduleId: string) => void;
  onCancel?: () => void;
  initialData?: Partial<CreateScheduleDTO>;
  isEditing?: boolean;
  scheduleId?: string;
}

type ViewMode = 'schedule' | 'list' | 'preview';

const DEBUG = process.env.NEXT_PUBLIC_ENABLE_DEBUG === 'true';
const debugLog = (...args: unknown[]) => { if (DEBUG) console.log(...args); };
const debugGroup = (label: string) => { if (DEBUG) console.group(label); };
const debugGroupEnd = () => { if (DEBUG) console.groupEnd(); };

export default function ScheduleBuilder({
  onSuccess,
  onCancel,
  initialData,
  isEditing = false,
  scheduleId
}: ScheduleBuilderProps) {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('schedule');
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [editingActivity, setEditingActivity] = useState<{
    day: number;
    activity: CreateActivityDTO;
    index: number;
  } | null>(null);

  const [effectiveInitialData, setEffectiveInitialData] = useState<Partial<CreateScheduleDTO> | undefined>(initialData);

  // 🛰️ TELEMETRIA: Sincronização de Dados Iniciais
  useEffect(() => {
    debugGroup('🔄 [BUILDER] Sync InitialData');
    if (initialData && Object.keys(initialData).length > 0) {
      debugLog('📥 Recebido:', initialData.name);
      setEffectiveInitialData(initialData);
    }
    debugGroupEnd();
  }, [initialData]);

  const {
    formData,
    errors,
    submitting,
    updateField,
    addActivity,
    updateActivity,
    removeActivity,
    submitForm,
    updateExistingSchedule
  } = useScheduleForm(effectiveInitialData);

  // 🔥 CÁLCULOS DE ESTATÍSTICAS (O que causou o erro anterior)
  const totalActivities = formData.activities.length;
  const totalDuration = formData.activities.reduce((sum, act) => sum + (act.metadata?.estimatedDuration || 0), 0);
  const totalPoints = formData.activities.reduce((sum, act) => sum + (act.scoring?.pointsOnCompletion || 0), 0);

  const daysOfWeek = [
    { id: 0, label: 'Dom', full: 'Domingo', enabled: formData.activeDays.includes(0) },
    { id: 1, label: 'Seg', full: 'Segunda-feira', enabled: formData.activeDays.includes(1) },
    { id: 2, label: 'Ter', full: 'Terça-feira', enabled: formData.activeDays.includes(2) },
    { id: 3, label: 'Qua', full: 'Quarta-feira', enabled: formData.activeDays.includes(3) },
    { id: 4, label: 'Qui', full: 'Quinta-feira', enabled: formData.activeDays.includes(4) },
    { id: 5, label: 'Sex', full: 'Sexta-feira', enabled: formData.activeDays.includes(5) },
    { id: 6, label: 'Sáb', full: 'Sábado', enabled: formData.activeDays.includes(6) }
  ];

  const handleAddActivity = (day: number) => {
    debugLog(`➕ [BUILDER] Novo item para dia: ${day}`);
    setSelectedDay(day);
    setEditingActivity(null);
    setShowActivityModal(true);
  };

  const handleEditActivity = (day: number, activity: CreateActivityDTO, index: number) => {
    debugLog(`📝 [BUILDER] Editando item no índice: ${index}`);
    setSelectedDay(day);
    setEditingActivity({ day, activity, index });
    setShowActivityModal(true);
  };

  const handleSaveActivity = (activityData: CreateActivityDTO, repeatDays: number[]) => {
    debugGroup('💾 [BUILDER] Save Activity');
    if (selectedDay === null) return;

    repeatDays.forEach(day => {
      if (editingActivity && day === selectedDay) {
        updateActivity(editingActivity.index, { ...activityData, dayOfWeek: day });
      } else {
        const activitiesForDay = formData.activities.filter(a => a.dayOfWeek === day);
        addActivity({ ...activityData, dayOfWeek: day, orderIndex: activitiesForDay.length });
      }
    });

    setShowActivityModal(false);
    setSelectedDay(null);
    setEditingActivity(null);
    debugGroupEnd();
  };

  const handleRemoveActivity = (day: number, index: number) => {
    debugLog(`🗑️ [BUILDER] Removendo item: ${index}`);
    removeActivity(index);
  };

  // 🚀 [AUDITORIA TOTAL] SUBMIT
  const handleSubmit = async () => {
    debugGroup('🚀 [SUBMIT] Processando Gravação');
    
    if (!user) {
      console.error('❌ Erro: user_not_found');
      alert('Usuário não autenticado');
      debugGroupEnd();
      return;
    }

    // 🕵️ Rastreio Crítico de Datas
    debugLog('📅 DATA INÍCIO NO FORM:', formData.startDate?.toLocaleDateString('pt-BR'));
    debugLog('📦 PAYLOAD COMPLETO:', formData);

    try {
      let result: string;
      if (isEditing && scheduleId) {
        debugLog('🔄 Executando UPDATE...');
        result = await updateExistingSchedule(scheduleId, user.id);
      } else {
        debugLog('🆕 Executando CREATE...');
        const creationResult = await submitForm(user.id);
        result = creationResult.scheduleId;
      }
      debugLog('✅ SUCESSO. ID:', result);
      if (onSuccess) onSuccess(result);
    } catch (err: any) {
      console.error('❌ ERRO NO SUBMIT:', err);
      alert(err.message || 'Erro ao salvar');
    } finally {
      debugGroupEnd();
    }
  };

  // Monitor de Mudanças de Campo
  useEffect(() => {
    debugLog('📊 [BUILDER STATE] Mudança detectada:', {
      name: formData.name,
      startDate: formData.startDate?.toLocaleDateString('pt-BR'),
      activitiesCount: formData.activities.length
    });
  }, [formData.name, formData.startDate, formData.activities.length]);

  return (
    <div className="space-y-8">
      <ScheduleHeaderPanel
        formData={formData}
        errors={errors}
        updateField={updateField}
        totalActivities={totalActivities}
        totalDuration={totalDuration}
        totalPoints={totalPoints}
        activeDaysCount={formData.activeDays.length}
      />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium text-gray-700">Visualização:</div>
            <div className="inline-flex rounded-lg bg-gray-100 p-1">
              {[
                { mode: 'schedule', icon: FaCalendarCheck, label: 'Semanal' },
                { mode: 'list', icon: FaListOl, label: 'Lista' },
                { mode: 'preview', icon: FaEye, label: 'Prévia' }
              ].map((btn) => (
                <button
                  key={btn.mode}
                  type="button"
                  onClick={() => setViewMode(btn.mode as ViewMode)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    viewMode === btn.mode ? 'bg-white text-indigo-600 shadow' : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <btn.icon className="w-4 h-4" />
                    <span>{btn.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-[500px]">
        {viewMode === 'schedule' && (
          <WeekScheduleGrid
            formData={formData}
            daysOfWeek={daysOfWeek.filter(d => d.enabled)}
            onAddActivity={handleAddActivity}
            onEditActivity={handleEditActivity}
            onRemoveActivity={handleRemoveActivity}
            onDuplicateActivity={(day, act) => addActivity({ ...act, dayOfWeek: day, title: `${act.title} (Cópia)` })}
            updateField={updateField}
          />
        )}
        {viewMode === 'list' && (
          <div className="bg-white p-6 rounded-2xl border border-gray-200">
            <p className="text-gray-500">Módulo de lista em desenvolvimento...</p>
          </div>
        )}
      </div>

      <ScheduleConfirmation
        onCancel={onCancel}
        onSubmit={handleSubmit}
        isSubmitting={submitting}
        isEditing={isEditing}
        formData={formData}
      />

      {showActivityModal && selectedDay !== null && (
        <QuickActivityModal
          isOpen={showActivityModal}
          onClose={() => {
            setShowActivityModal(false);
            setEditingActivity(null);
          }}
          onSave={handleSaveActivity}
          initialDay={selectedDay}
          isEditing={!!editingActivity}
          initialData={editingActivity?.activity}
          availableDays={daysOfWeek.filter(d => d.enabled).map(d => d.id)}
          formData={formData}
        />
      )}
    </div>
  );
}