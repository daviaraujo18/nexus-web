// app/professional/schedules/[id]/edit/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ScheduleBuilder from '@/components/schedule/ScheduleBuilder';
import { ScheduleService } from '@/lib/services/ScheduleService';
import {
  CreateScheduleDTO,
  CreateActivityDTO,
  ScheduleActivity
} from '@/types/schedule';
import { FaArrowLeft, FaCalendarAlt, FaSpinner, FaExclamationTriangle } from 'react-icons/fa';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

// Função auxiliar para converter ScheduleActivity para CreateActivityDTO
const convertActivityToDTO = (activity: ScheduleActivity): CreateActivityDTO => {
  return {
    dayOfWeek: activity.dayOfWeek,
    orderIndex: activity.orderIndex,
    type: activity.type,
    title: activity.title,
    description: activity.description,
    instructions: activity.instructions,
    config: activity.config,
    scoring: activity.scoring,
    metadata: {
      estimatedDuration: activity.metadata.estimatedDuration,
      difficulty: activity.metadata.difficulty,
      therapeuticFocus: activity.metadata.therapeuticFocus || [],
      educationalFocus: activity.metadata.educationalFocus || []
    },
  };
};

export default function EditSchedulePage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<Partial<CreateScheduleDTO> | null>(null);
  const [scheduleName, setScheduleName] = useState('');

  const scheduleId = params.id as string;

  const sanitizeInitialData = (data: any): Partial<CreateScheduleDTO> => {
    if (!data) return {};

    const sanitized = { ...data };

    // Converter strings para Date se necessário
    if (sanitized.startDate && typeof sanitized.startDate === 'string') {
      sanitized.startDate = new Date(sanitized.startDate);
    }

    if (sanitized.endDate && typeof sanitized.endDate === 'string') {
      sanitized.endDate = new Date(sanitized.endDate);
    }

    // Garantir que atividades tenham os campos necessários
    if (sanitized.activities && Array.isArray(sanitized.activities)) {
      sanitized.activities = sanitized.activities.map((activity: any) => ({
        ...activity,
        // Garantir que config existe
        config: activity.config || {},
        // Garantir que metadata tenha campos obrigatórios
        metadata: {
          estimatedDuration: activity.metadata?.estimatedDuration || 60,
          difficulty: activity.metadata?.difficulty || 'medium',
          therapeuticFocus: activity.metadata?.therapeuticFocus || [],
          educationalFocus: activity.metadata?.educationalFocus || [],
          ...activity.metadata
        }
      }));
    }

    return sanitized;
  };

  useEffect(() => {
    if (!scheduleId || !user) {
      setError('ID do cronograma ou usuário não encontrado');
      setLoading(false);
      return;
    }

    const loadSchedule = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('🔄 Carregando cronograma para edição:', scheduleId);

        // Buscar o cronograma COM atividades
        const schedule = await ScheduleService.getScheduleTemplate(scheduleId, true);

        console.log('📋 Schedule carregado:', {
          id: scheduleId,
          name: schedule.name,
          hasActivities: 'activities' in schedule,
          activitiesCount: 'activities' in schedule ? (schedule.activities as any)?.length : 0,
          scheduleData: schedule
        });

        // Verificar se o usuário tem permissão para editar
        if (schedule.professionalId !== user.id) {
          throw new Error('Você não tem permissão para editar este cronograma');
        }

        // Converter ScheduleTemplate para CreateScheduleDTO
        const scheduleData: Partial<CreateScheduleDTO> = {
          name: schedule.name,
          description: schedule.description || '',
          category: schedule.category,
          startDate: schedule.startDate,
          endDate: schedule.endDate,
          activeDays: schedule.activeDays,
          repeatRules: {
            resetOnRepeat: schedule.repeatRules.resetOnRepeat,
          },
          activities: schedule.activities?.map(convertActivityToDTO) || [],
        };

        setInitialData(sanitizeInitialData(scheduleData));

        // Converter atividades se existirem
        if ('activities' in schedule && schedule.activities && Array.isArray(schedule.activities)) {
          const activities = schedule.activities.map(convertActivityToDTO);
          scheduleData.activities = activities;
          console.log('✅ Atividades convertidas:', activities.length);
        } else {
          scheduleData.activities = [];
          console.log('⚠️ Nenhuma atividade encontrada ou formato inválido');
        }

        console.log('📊 Dados iniciais preparados:', {
          name: scheduleData.name,
          category: scheduleData.category,
          startDate: scheduleData.startDate?.toISOString(),
          endDate: scheduleData.endDate?.toISOString(),
          activeDays: scheduleData.activeDays,
          activitiesCount: scheduleData.activities?.length
        });

        setInitialData(scheduleData);
        setScheduleName(schedule.name);
      } catch (err: any) {
        console.error('❌ Erro ao carregar cronograma:', err);
        setError(err.message || 'Erro ao carregar cronograma. Tente novamente.');
      } finally {
        setLoading(false);
      }
    };

    loadSchedule();
  }, [scheduleId, user]);

  const handleSuccess = (newScheduleId: string) => {
    console.log('✅ Cronograma atualizado com nova versão:', newScheduleId);

    // Mostrar mensagem e redirecionar
    alert(`Cronograma atualizado com sucesso! Nova versão: ${newScheduleId}`);
    router.push('/professional/schedules');
  };

  const handleCancel = () => {
    if (window.confirm('Tem certeza que deseja cancelar? As alterações serão perdidas.')) {
      router.push(`/professional/schedules/${scheduleId}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-lg mb-4">
            <FaSpinner className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Carregando cronograma...</h2>
          <p className="text-gray-600">Preparando dados para edição</p>
          <p className="text-sm text-gray-500 mt-2">ID: {scheduleId}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <FaExclamationTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-3">Erro ao carregar</h2>
            <p className="text-gray-600 mb-2">{error}</p>
            <p className="text-sm text-gray-500 mb-6">ID do cronograma: {scheduleId}</p>
            <div className="flex gap-4">
              <button
                onClick={() => router.push('/professional/schedules')}
                className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50"
              >
                Voltar para Lista
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700"
              >
                Tentar Novamente
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Link
                href={`/professional/schedules/${scheduleId}`}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
              >
                <FaArrowLeft />
                Voltar
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900">Editar Cronograma</h1>
                  <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium">
                    Edição
                  </span>
                </div>
                <p className="text-gray-600">
                  Editando: <span className="font-medium text-gray-800">{scheduleName}</span>
                  <span className="ml-4 text-sm text-gray-500">ID: {scheduleId}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-500">
              <FaCalendarAlt />
              <span>Modo de Edição</span>
            </div>
          </div>

          {/* Status do Carregamento */}
          {initialData && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 font-bold">✓</span>
                </div>
                <div>
                  <p className="text-green-800 font-medium">
                    Cronograma carregado com sucesso
                  </p>
                  <p className="text-green-700 text-sm">
                    {initialData.activities?.length || 0} atividades prontas para edição
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Aviso de Versão */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <FaExclamationTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800 mb-2">Atenção: Nova versão será criada</h3>
                <p className="text-amber-700">
                  Ao salvar as alterações, será criada uma nova versão deste cronograma.
                  Cronogramas já atribuídos a alunos continuarão com a versão anterior.
                  Novas atribuições usarão esta nova versão.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Schedule Builder */}
        {initialData ? (
          <div className="mb-8">
            {/* Debug Info */}
            <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-bold">i</span>
                </div>
                <span className="font-medium text-blue-800">Dados carregados para edição</span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Nome:</span>
                  <span className="ml-2 font-medium">{initialData.name}</span>
                </div>
                <div>
                  <span className="text-gray-600">Atividades:</span>
                  <span className="ml-2 font-medium">{initialData.activities?.length || 0}</span>
                </div>
                <div>
                  <span className="text-gray-600">Dias ativos:</span>
                  <span className="ml-2 font-medium">{initialData.activeDays?.length || 0}</span>
                </div>
              </div>
            </div>

            {/* ✅ GARANTIR que initialData seja passado corretamente */}
            <ScheduleBuilder
              key={`schedule-builder-${scheduleId}`} // ✅ Força remontagem quando scheduleId muda
              onSuccess={handleSuccess}
              onCancel={handleCancel}
              initialData={initialData}
              isEditing={true}
              scheduleId={scheduleId}
            />
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mb-4">
              <span className="text-2xl">⏳</span>
            </div>
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">
              Preparando dados para edição
            </h3>
            <p className="text-yellow-700">
              Os dados do cronograma estão sendo carregados...
            </p>
          </div>
        )}

        {/* Notas Importantes */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="font-semibold text-gray-800 mb-4">📋 Notas importantes sobre a edição</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="font-medium text-blue-800 mb-1">Dados Carregados</div>
              <p className="text-sm text-blue-700">
                {initialData?.activities?.length || 0} atividades carregadas para edição
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="font-medium text-green-800 mb-1">Versões Separadas</div>
              <p className="text-sm text-green-700">
                Cada edição cria uma nova versão. Isso preserva o histórico.
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="font-medium text-purple-800 mb-1">Sem Interrupção</div>
              <p className="text-sm text-purple-700">
                Alunos em andamento não são afetados pela nova versão.
              </p>
            </div>
            <div className="p-4 bg-amber-50 rounded-lg">
              <div className="font-medium text-amber-800 mb-1">Novas Atribuições</div>
              <p className="text-sm text-amber-700">
                Novos alunos usarão automaticamente a versão atualizada.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}