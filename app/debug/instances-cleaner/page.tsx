// pages/debug/instances-cleaner.tsx
'use client'

import { useState, useEffect } from 'react';
import {
  collection,
  query,
  getDocs,
  where,
  doc,
  writeBatch,
  Timestamp,
  orderBy,
  getDoc,
} from 'firebase/firestore';
import { ScheduleInstance, ScheduleTemplate, ActivityProgress } from '../../../types/schedule';
import { format, isBefore, isAfter, differenceInDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/context/AuthContext';
import { firestore } from '@/firebase/config';
import { useRouter } from 'next/navigation';

interface InstanceWithDetails extends ScheduleInstance {
  id: string;
  template?: ScheduleTemplate & { id: string };
  activitiesCount: number;
  pastActivitiesCount: number;
  futureActivitiesCount: number;
  pendingActivitiesCount: number;
  completedActivitiesCount: number;
  isExpired: boolean;
  daysSinceEnd: number;
  oldestActivityDate?: Date;
  newestActivityDate?: Date;
}

interface ActivityToDelete {
  id: string;
  weekNumber: number;
  dayOfWeek: number;
  title: string;
  scheduledDate: Date;
  status: string;
}

interface CleanupResult {
  instanceId: string;
  instanceName: string;
  totalDeleted: number;
  errors: number;
  details: ActivityToDelete[];
}

interface MassCleanupProgress {
  total: number;
  current: number;
  currentInstance: string;
  deleted: number;
  errors: number;
  instancesProcessed: number;
  results: Array<{
    instanceId: string;
    instanceName: string;
    deleted: number;
    errors: number;
    status: 'pending' | 'processing' | 'completed' | 'error';
    message?: string;
    activitiesCount?: number;
  }>;
}

// Interfaces para finalização de instâncias expiradas
interface ExpiredInstance {
  id: string;
  name: string;
  studentId: string;
  endDate: Date;
  daysSinceEnd: number;
  currentStatus: string;
  activitiesCount: number;
}

interface ExpiredInstancesResult {
  total: number;
  updated: number;
  errors: number;
  skipped: number;
  details: Array<{
    instanceId: string;
    instanceName: string;
    studentId: string;
    oldStatus: string;
    newStatus: string;
    daysSinceEnd: number;
    activitiesCount: number;
    message?: string;
  }>;
}

export default function DebugInstancesCleanerPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState<string | null>(null);
  const [instances, setInstances] = useState<InstanceWithDetails[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<InstanceWithDetails | null>(null);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'expired' | 'completed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Estados para limpeza em massa
  const [massCleaning, setMassCleaning] = useState(false);
  const [massProgress, setMassProgress] = useState<MassCleanupProgress | null>(null);
  const [showMassConfirmDialog, setShowMassConfirmDialog] = useState(false);

  // Estados para finalização de instâncias expiradas
  const [completingExpired, setCompletingExpired] = useState(false);
  const [expiredResult, setExpiredResult] = useState<ExpiredInstancesResult | null>(null);
  const [showExpiredConfirmDialog, setShowExpiredConfirmDialog] = useState(false);

  useEffect(() => {
    loadInstances();
  }, [user]);

  const loadInstances = async () => {
    try {
      setLoading(true);

      const instancesQuery = query(
        collection(firestore, 'scheduleInstances'),
        orderBy('startedAt', 'desc')
      );

      const instancesSnapshot = await getDocs(instancesQuery);
      const instancesData: InstanceWithDetails[] = [];

      for (const instanceDoc of instancesSnapshot.docs) {
        const instance = {
          id: instanceDoc.id,
          ...instanceDoc.data(),
          createdAt: instanceDoc.data().createdAt?.toDate(),
          updatedAt: instanceDoc.data().updatedAt?.toDate(),
          startedAt: instanceDoc.data().startedAt?.toDate(),
          completedAt: instanceDoc.data().completedAt?.toDate(),
          currentWeekStartDate: instanceDoc.data().currentWeekStartDate?.toDate(),
          currentWeekEndDate: instanceDoc.data().currentWeekEndDate?.toDate()
        } as ScheduleInstance;

        let template: (ScheduleTemplate & { id: string }) | undefined;
        if (instance.scheduleTemplateId) {
          const templateDoc = await getDoc(doc(firestore, 'weeklySchedules', instance.scheduleTemplateId));
          if (templateDoc.exists()) {
            const templateData = templateDoc.data();
            template = {
              id: templateDoc.id,
              ...templateData,
              createdAt: templateData.createdAt?.toDate(),
              updatedAt: templateData.updatedAt?.toDate(),
              startDate: templateData.startDate?.toDate(),
              endDate: templateData.endDate?.toDate()
            } as ScheduleTemplate & { id: string };
          }
        }

        // Buscar atividades desta instância
        const activitiesQuery = query(
          collection(firestore, 'activityProgress'),
          where('scheduleInstanceId', '==', instanceDoc.id)
        );
        const activitiesSnapshot = await getDocs(activitiesQuery);

        const now = new Date();
        const todayStart = startOfDay(now);

        let pastActivities = 0;
        let futureActivities = 0;
        let pendingActivities = 0;
        let completedActivities = 0;
        let inProgressActivities = 0;
        let oldestDate: Date | undefined;
        let newestDate: Date | undefined;

        activitiesSnapshot.docs.forEach(doc => {
          const activity = doc.data();
          const scheduledDate = activity.scheduledDate?.toDate();

          // Classificação por status
          if (activity.status === 'pending') {
            pendingActivities++;
          } else if (activity.status === 'in_progress') {
            inProgressActivities++;
          } else if (activity.status === 'completed') {
            completedActivities++;
          }

          // Classificação por data (usando HOJE como referência)
          if (scheduledDate) {
            const isPast = isBefore(scheduledDate, todayStart);

            if (isPast) {
              pastActivities++;
              if (!oldestDate || isBefore(scheduledDate, oldestDate)) {
                oldestDate = scheduledDate;
              }
            } else {
              futureActivities++;
              if (!newestDate || isAfter(scheduledDate, newestDate)) {
                newestDate = scheduledDate;
              }
            }
          }
        });

        const templateEndDate = template?.endDate || instance.currentWeekEndDate || instance.startedAt;
        const isExpired = templateEndDate ? isAfter(now, templateEndDate) : false;
        const daysSinceEnd = templateEndDate ? differenceInDays(now, templateEndDate) : 0;

        console.log(`📊 Instância ${instance.id.slice(0, 8)}:`, {
          templateName: template?.name,
          templateEndDate: template?.endDate ? format(template.endDate, 'dd/MM/yyyy') : 'sem data',
          hoje: format(now, 'dd/MM/yyyy'),
          pastActivities,
          futureActivities,
          total: activitiesSnapshot.size,
          detalhes: {
            pendentes: pendingActivities,
            emProgresso: inProgressActivities,
            concluidas: completedActivities
          }
        });

        instancesData.push({
          ...instance,
          template,
          activitiesCount: activitiesSnapshot.size,
          pastActivitiesCount: pastActivities,
          futureActivitiesCount: futureActivities,
          pendingActivitiesCount: pendingActivities + inProgressActivities,
          completedActivitiesCount: completedActivities,
          isExpired,
          daysSinceEnd,
          oldestActivityDate: oldestDate,
          newestActivityDate: newestDate
        });
      }

      setInstances(instancesData);

    } catch (error) {
      console.error('Erro ao carregar instâncias:', error);
    } finally {
      setLoading(false);
    }
  };

  const previewCleanup = async (instanceId: string) => {
    try {
      setCleaning(instanceId);

      const instance = instances.find(i => i.id === instanceId);
      if (!instance) return;

      // Buscar TODAS as atividades desta instância
      const allActivitiesQuery = query(
        collection(firestore, 'activityProgress'),
        where('scheduleInstanceId', '==', instanceId)
      );
      const allActivitiesSnapshot = await getDocs(allActivitiesQuery);

      const now = new Date();
      const todayStart = startOfDay(now);

      console.log('📊 Todas as atividades da instância:', allActivitiesSnapshot.docs.map(doc => {
        const data = doc.data();
        const scheduledDate = data.scheduledDate?.toDate();
        return {
          id: doc.id,
          weekNumber: data.weekNumber,
          scheduledDate: scheduledDate ? format(scheduledDate, 'dd/MM/yyyy') : 'sem data',
          status: data.status,
          isPast: scheduledDate ? isBefore(scheduledDate, todayStart) : false
        };
      }));

      // Filtrar atividades que devem ser deletadas:
      // TODAS as atividades com data anterior a HOJE, independente do status
      const activitiesToDelete: ActivityToDelete[] = [];

      allActivitiesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const scheduledDate = data.scheduledDate?.toDate();

        if (!scheduledDate) return;

        const isPast = isBefore(scheduledDate, todayStart);

        if (isPast) {
          activitiesToDelete.push({
            id: doc.id,
            weekNumber: data.weekNumber || 0,
            dayOfWeek: data.dayOfWeek || 0,
            title: data.activitySnapshot?.title || 'Atividade sem título',
            scheduledDate: scheduledDate,
            status: data.status
          });
        } else {
          console.log('⚠️ Atividade futura (não será deletada):', {
            id: doc.id,
            scheduledDate: format(scheduledDate, 'dd/MM/yyyy'),
            status: data.status
          });
        }
      });

      activitiesToDelete.sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());

      console.log('🎯 Atividades a serem deletadas:', activitiesToDelete.map(a => ({
        id: a.id,
        weekNumber: a.weekNumber,
        scheduledDate: format(a.scheduledDate, 'dd/MM/yyyy'),
        status: a.status
      })));

      if (activitiesToDelete.length !== instance.pastActivitiesCount) {
        console.warn('⚠️ Discrepância detectada:', {
          esperado: instance.pastActivitiesCount,
          encontrado: activitiesToDelete.length,
          diferenca: instance.pastActivitiesCount - activitiesToDelete.length,
          detalhes: {
            totalAtividades: allActivitiesSnapshot.size,
            atividadesPassadas: activitiesToDelete.length,
            atividadesFuturas: allActivitiesSnapshot.size - activitiesToDelete.length
          }
        });
      }

      setSelectedInstance(instance);
      setCleanupResult({
        instanceId: instance.id,
        instanceName: instance.template?.name || 'Instância sem template',
        totalDeleted: activitiesToDelete.length,
        errors: 0,
        details: activitiesToDelete
      });

      setShowConfirmDialog(true);

    } catch (error) {
      console.error('Erro ao pré-visualizar limpeza:', error);
      alert('Erro ao pré-visualizar limpeza: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    } finally {
      setCleaning(null);
    }
  };

  const executeCleanup = async () => {
    if (!selectedInstance || !cleanupResult) return;

    try {
      setCleaning(selectedInstance.id);

      const batches: any[] = [];
      let currentBatch = writeBatch(firestore);
      let operationCount = 0;
      let deletedCount = 0;
      const errors: string[] = [];

      for (const activity of cleanupResult.details) {
        try {
          const activityRef = doc(firestore, 'activityProgress', activity.id);
          currentBatch.delete(activityRef);
          operationCount++;
          deletedCount++;

          if (operationCount >= 500) {
            batches.push(currentBatch.commit());
            currentBatch = writeBatch(firestore);
            operationCount = 0;
          }
        } catch (error) {
          errors.push(`Erro ao preparar deleção da atividade ${activity.id}: ${error}`);
        }
      }

      if (operationCount > 0) {
        batches.push(currentBatch.commit());
      }

      if (batches.length > 0) {
        await Promise.all(batches);
      }

      await loadInstances();
      setShowConfirmDialog(false);

      const message = `✅ Limpeza concluída!\n${deletedCount} atividades deletadas\n${errors.length} erros`;
      alert(message);

    } catch (error) {
      console.error('Erro ao executar limpeza:', error);
      alert('Erro ao executar limpeza: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    } finally {
      setCleaning(null);
    }
  };

  // Função para pré-visualizar limpeza em massa
  const previewMassCleanup = () => {
    const instancesWithActivities = filteredInstances.filter(i => i.pastActivitiesCount > 0);
    const totalActivities = instancesWithActivities.reduce((acc, i) => acc + i.pastActivitiesCount, 0);

    setMassProgress({
      total: filteredInstances.length,
      current: 0,
      currentInstance: '',
      deleted: 0,
      errors: 0,
      instancesProcessed: 0,
      results: filteredInstances.map(instance => ({
        instanceId: instance.id,
        instanceName: instance.template?.name || 'Instância sem template',
        deleted: 0,
        errors: 0,
        status: 'pending' as const,
        activitiesCount: instance.pastActivitiesCount
      }))
    });

    setShowMassConfirmDialog(true);
  };

  // Função para limpeza em massa
  const runMassCleanup = async () => {
    try {
      setMassCleaning(true);

      let totalDeleted = 0;
      let totalErrors = 0;
      let processedInstances = 0;

      for (let i = 0; i < filteredInstances.length; i++) {
        const instance = filteredInstances[i];

        setMassProgress(prev => prev ? {
          ...prev,
          current: i + 1,
          currentInstance: instance.template?.name || instance.id,
          results: prev.results.map(r =>
            r.instanceId === instance.id
              ? { ...r, status: 'processing' as const }
              : r
          )
        } : null);

        if (instance.pastActivitiesCount === 0) {
          setMassProgress(prev => prev ? {
            ...prev,
            instancesProcessed: ++processedInstances,
            results: prev.results.map(r =>
              r.instanceId === instance.id
                ? {
                  ...r,
                  status: 'completed' as const,
                  deleted: 0,
                  message: 'Sem atividades para limpar'
                }
                : r
            )
          } : null);
          continue;
        }

        try {
          const now = new Date();
          const todayStart = startOfDay(now);

          // Buscar TODAS as atividades da instância
          const allActivitiesQuery = query(
            collection(firestore, 'activityProgress'),
            where('scheduleInstanceId', '==', instance.id)
          );

          const allActivitiesSnapshot = await getDocs(allActivitiesQuery);

          // Filtrar atividades que devem ser deletadas (data anterior a HOJE)
          const activitiesToDelete = allActivitiesSnapshot.docs.filter(doc => {
            const data = doc.data();
            const scheduledDate = data.scheduledDate?.toDate();
            if (!scheduledDate) return false;
            return isBefore(scheduledDate, todayStart);
          });

          if (activitiesToDelete.length === 0) {
            setMassProgress(prev => prev ? {
              ...prev,
              instancesProcessed: ++processedInstances,
              results: prev.results.map(r =>
                r.instanceId === instance.id
                  ? {
                    ...r,
                    status: 'completed' as const,
                    deleted: 0,
                    message: 'Nenhuma atividade passada encontrada'
                  }
                  : r
              )
            } : null);
            continue;
          }

          const batches: any[] = [];
          let currentBatch = writeBatch(firestore);
          let operationCount = 0;
          let instanceDeleted = 0;

          for (const activityDoc of activitiesToDelete) {
            currentBatch.delete(doc(firestore, 'activityProgress', activityDoc.id));
            operationCount++;
            instanceDeleted++;

            if (operationCount >= 500) {
              batches.push(currentBatch.commit());
              currentBatch = writeBatch(firestore);
              operationCount = 0;
            }
          }

          if (operationCount > 0) {
            batches.push(currentBatch.commit());
          }

          await Promise.all(batches);

          totalDeleted += instanceDeleted;
          processedInstances++;

          setMassProgress(prev => prev ? {
            ...prev,
            deleted: totalDeleted,
            instancesProcessed: processedInstances,
            results: prev.results.map(r =>
              r.instanceId === instance.id
                ? {
                  ...r,
                  status: 'completed' as const,
                  deleted: instanceDeleted,
                  message: `${instanceDeleted} atividades deletadas`
                }
                : r
            )
          } : null);

        } catch (error) {
          console.error(`Erro ao processar instância ${instance.id}:`, error);
          totalErrors++;

          setMassProgress(prev => prev ? {
            ...prev,
            errors: totalErrors,
            instancesProcessed: ++processedInstances,
            results: prev.results.map(r =>
              r.instanceId === instance.id
                ? {
                  ...r,
                  status: 'error' as const,
                  message: error instanceof Error ? error.message : 'Erro desconhecido'
                }
                : r
            )
          } : null);
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      await loadInstances();
      setShowMassConfirmDialog(false);

      alert(`✅ Limpeza em massa concluída!\n\n` +
        `Total de instâncias: ${filteredInstances.length}\n` +
        `Instâncias processadas: ${processedInstances}\n` +
        `Atividades deletadas: ${totalDeleted}\n` +
        `Erros: ${totalErrors}`);

    } catch (error) {
      console.error('Erro na limpeza em massa:', error);
      alert('Erro na limpeza em massa: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    } finally {
      setMassCleaning(false);
      setMassProgress(null);
    }
  };

  // Função para verificar instâncias expiradas
  const checkExpiredInstances = () => {
    const now = new Date();
    const expiredInstances = instances.filter(instance => {
      return instance.isExpired && instance.status !== 'completed';
    });

    const result: ExpiredInstancesResult = {
      total: expiredInstances.length,
      updated: 0,
      errors: 0,
      skipped: 0,
      details: expiredInstances.map(instance => {
        const endDate = instance.template?.endDate || instance.currentWeekEndDate || instance.startedAt;
        const daysSinceEnd = endDate ? differenceInDays(now, endDate) : 0;
        
        return {
          instanceId: instance.id,
          instanceName: instance.template?.name || 'Instância sem template',
          studentId: instance.studentId,
          oldStatus: instance.status,
          newStatus: 'completed',
          daysSinceEnd,
          activitiesCount: instance.activitiesCount,
          message: daysSinceEnd > 0 ? `Expirada há ${daysSinceEnd} dias` : 'Expirada hoje'
        };
      })
    };

    setExpiredResult(result);
    setShowExpiredConfirmDialog(true);
  };

  // Função para finalizar instâncias expiradas
  const completeExpiredInstances = async () => {
    if (!expiredResult) return;

    try {
      setCompletingExpired(true);

      const batches: any[] = [];
      let currentBatch = writeBatch(firestore);
      let operationCount = 0;
      let updatedCount = 0;
      let errorCount = 0;

      for (const instance of expiredResult.details) {
        try {
          const instanceRef = doc(firestore, 'scheduleInstances', instance.instanceId);
          
          currentBatch.update(instanceRef, {
            status: 'completed',
            completedAt: Timestamp.now(),
            updatedAt: Timestamp.now()
          });
          
          operationCount++;
          updatedCount++;

          if (operationCount >= 500) {
            batches.push(currentBatch.commit());
            currentBatch = writeBatch(firestore);
            operationCount = 0;
          }

        } catch (error) {
          console.error(`Erro ao finalizar instância ${instance.instanceId}:`, error);
          errorCount++;
        }
      }

      if (operationCount > 0) {
        batches.push(currentBatch.commit());
      }

      if (batches.length > 0) {
        await Promise.all(batches);
      }

      setExpiredResult(prev => prev ? {
        ...prev,
        updated: updatedCount,
        errors: errorCount
      } : null);

      await loadInstances();
      setShowExpiredConfirmDialog(false);

      alert(`✅ Instâncias finalizadas!\n\n` +
        `Total encontradas: ${expiredResult.total}\n` +
        `Finalizadas: ${updatedCount}\n` +
        `Erros: ${errorCount}`);

    } catch (error) {
      console.error('Erro ao finalizar instâncias:', error);
      alert('Erro ao finalizar instâncias: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    } finally {
      setCompletingExpired(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredInstances = instances.filter(instance => {
    if (filter !== 'all' && instance.status !== filter) {
      return false;
    }

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        instance.id?.toLowerCase().includes(searchLower) ||
        instance.template?.name?.toLowerCase().includes(searchLower) ||
        instance.studentId?.toLowerCase().includes(searchLower)
      );
    }

    return true;
  });

  const stats = {
    total: instances.length,
    active: instances.filter(i => i.status === 'active').length,
    expired: instances.filter(i => i.isExpired).length,
    expiredNotCompleted: instances.filter(i => i.isExpired && i.status !== 'completed').length,
    withPastActivities: instances.filter(i => i.pastActivitiesCount > 0).length,
    totalPastActivities: instances.reduce((acc, i) => acc + i.pastActivitiesCount, 0)
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-lg text-gray-700">Carregando instâncias...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-gray-800">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900">
              🧹 Limpeza de ActivityProgress
            </h1>
            <div className="space-x-2">
              <button
                onClick={() => router.push('/debug/schedules')}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                ← Templates
              </button>
              <button
                onClick={() => router.push('/debug/schedules-scanner')}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                ← Scanner
              </button>
              
              {/* BOTÃO DE FINALIZAR INSTÂNCIAS EXPIRADAS */}
              <button
                onClick={checkExpiredInstances}
                disabled={completingExpired}
                className={`
                  px-4 py-2 rounded-lg font-medium text-sm
                  flex items-center space-x-2 whitespace-nowrap
                  ${completingExpired
                    ? 'bg-gray-400 text-white cursor-wait'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                  }
                `}
              >
                {completingExpired ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Finalizando...</span>
                  </>
                ) : (
                  <>
                    <span>🏁</span>
                    <span>Finalizar Instâncias Expiradas</span>
                    <span className="ml-1 bg-white bg-opacity-20 px-2 py-0.5 rounded-full text-xs">
                      {stats.expiredNotCompleted}
                    </span>
                  </>
                )}
              </button>

              {/* BOTÃO DE LIMPEZA EM MASSA */}
              <button
                onClick={previewMassCleanup}
                disabled={massCleaning || filteredInstances.filter(i => i.pastActivitiesCount > 0).length === 0}
                className={`
                  px-4 py-2 rounded-lg font-medium text-sm
                  flex items-center space-x-2 whitespace-nowrap
                  ${filteredInstances.filter(i => i.pastActivitiesCount > 0).length === 0
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : massCleaning
                      ? 'bg-gray-400 text-white cursor-wait'
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }
                `}
              >
                {massCleaning ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Limpando...</span>
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>Limpeza em Massa</span>
                    <span className="ml-1 bg-white bg-opacity-20 px-2 py-0.5 rounded-full text-gray-800 text-xs">
                      {filteredInstances.filter(i => i.pastActivitiesCount > 0).length}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Total Instâncias</div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </div>
            <div className="bg-green-50 rounded-lg shadow p-4">
              <div className="text-sm text-green-600">Ativas</div>
              <div className="text-2xl font-bold text-green-700">{stats.active}</div>
            </div>
            <div className="bg-red-50 rounded-lg shadow p-4">
              <div className="text-sm text-red-600">Expiradas</div>
              <div className="text-2xl font-bold text-red-700">{stats.expired}</div>
            </div>
            <div className="bg-orange-50 rounded-lg shadow p-4">
              <div className="text-sm text-orange-600">Expiradas não finalizadas</div>
              <div className="text-2xl font-bold text-orange-700">{stats.expiredNotCompleted}</div>
            </div>
            <div className="bg-yellow-50 rounded-lg shadow p-4">
              <div className="text-sm text-yellow-600">Atividades Passadas</div>
              <div className="text-2xl font-bold text-yellow-700">{stats.totalPastActivities}</div>
              <div className="text-xs text-yellow-600">em {stats.withPastActivities} instância(s)</div>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Buscar por ID, template ou aluno..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todos os status</option>
                <option value="active">Ativas</option>
                <option value="paused">Pausadas</option>
                <option value="completed">Concluídas</option>
                <option value="overdue">Atrasadas</option>
              </select>
              <button
                onClick={loadInstances}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                🔄 Recarregar
              </button>
            </div>
          </div>
        </div>

        {/* Lista de Instâncias */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">
              Instâncias ({filteredInstances.length})
            </h2>
          </div>

          <div className="divide-y divide-gray-200">
            {filteredInstances.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                Nenhuma instância encontrada
              </div>
            ) : (
              filteredInstances.map((instance) => (
                <div key={instance.id} className="p-6 hover:bg-gray-50">
                  {/* Header da Instância */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-medium text-gray-900">
                          {instance.template?.name || 'Template não encontrado'}
                        </h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(instance.status)}`}>
                          {instance.status}
                        </span>
                        {instance.isExpired && (
                          <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                            ⚠️ Expirada
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">ID:</span>
                          <code className="ml-1 text-xs bg-gray-100 px-1 py-0.5 rounded">
                            {instance.id.slice(0, 12)}...
                          </code>
                        </div>
                        <div>
                          <span className="text-gray-500">Aluno:</span>
                          <code className="ml-1 text-xs bg-gray-100 px-1 py-0.5 rounded">
                            {instance.studentId?.slice(0, 12)}...
                          </code>
                        </div>
                        <div>
                          <span className="text-gray-500">Semana atual:</span>
                          <span className="ml-1 font-medium">{instance.currentWeekNumber}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Início:</span>
                          <span className="ml-1">{instance.startedAt ? format(instance.startedAt, 'dd/MM/yyyy') : '-'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Botão de Limpeza Individual */}
                    <button
                      onClick={() => previewCleanup(instance.id)}
                      disabled={cleaning === instance.id || instance.pastActivitiesCount === 0}
                      className={`
                        ml-4 px-4 py-2 rounded-lg font-medium text-sm
                        flex items-center space-x-2 whitespace-nowrap
                        ${instance.pastActivitiesCount === 0
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : cleaning === instance.id
                            ? 'bg-gray-400 text-white cursor-wait'
                            : 'bg-red-600 text-white hover:bg-red-700'
                        }
                      `}
                    >
                      {cleaning === instance.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Processando...</span>
                        </>
                      ) : (
                        <>
                          <span>🧹</span>
                          <span>Limpar {instance.pastActivitiesCount} atividades</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Informações do Template */}
                  {instance.template && (
                    <div className="mt-3 bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-600 mb-2">
                        Template: {instance.template.name} |
                        Término: {format(instance.template.endDate, 'dd/MM/yyyy')}
                        {instance.isExpired && (
                          <span className="ml-2 text-red-600">
                            (expirado há {instance.daysSinceEnd} dias)
                          </span>
                        )}
                      </div>

                      {/* Cards de Atividades */}
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mt-2">
                        <div className="bg-white p-2 rounded text-center">
                          <div className="text-xs text-gray-500">Total</div>
                          <div className="text-lg font-bold">{instance.activitiesCount}</div>
                        </div>
                        <div className="bg-red-50 p-2 rounded text-center">
                          <div className="text-xs text-red-600">Passadas</div>
                          <div className="text-lg font-bold text-red-700">{instance.pastActivitiesCount}</div>
                        </div>
                        <div className="bg-green-50 p-2 rounded text-center">
                          <div className="text-xs text-green-600">Futuras</div>
                          <div className="text-lg font-bold text-green-700">{instance.futureActivitiesCount}</div>
                        </div>
                        <div className="bg-yellow-50 p-2 rounded text-center">
                          <div className="text-xs text-yellow-600">Pendentes</div>
                          <div className="text-lg font-bold text-yellow-700">{instance.pendingActivitiesCount}</div>
                        </div>
                        <div className="bg-blue-50 p-2 rounded text-center">
                          <div className="text-xs text-blue-600">Concluídas</div>
                          <div className="text-lg font-bold text-blue-700">{instance.completedActivitiesCount}</div>
                        </div>
                      </div>

                      {/* Datas extremas */}
                      {(instance.oldestActivityDate || instance.newestActivityDate) && (
                        <div className="mt-2 text-xs text-gray-500">
                          {instance.oldestActivityDate && (
                            <span>Mais antiga: {format(instance.oldestActivityDate, 'dd/MM/yyyy')}</span>
                          )}
                          {instance.newestActivityDate && instance.oldestActivityDate && (
                            <span className="mx-2">|</span>
                          )}
                          {instance.newestActivityDate && (
                            <span>Mais recente: {format(instance.newestActivityDate, 'dd/MM/yyyy')}</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Modal de Confirmação Individual */}
        {showConfirmDialog && selectedInstance && cleanupResult && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">
                  Confirmar Limpeza Individual
                </h3>
              </div>

              <div className="p-6 overflow-y-auto">
                <p className="mb-4">
                  Você está prestes a deletar <strong>{cleanupResult.totalDeleted}</strong> atividades da instância:
                </p>

                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <p><strong>Instância:</strong> {selectedInstance.id}</p>
                  <p><strong>Template:</strong> {selectedInstance.template?.name}</p>
                  <p><strong>Data de término:</strong> {format(selectedInstance.template?.endDate || new Date(), 'dd/MM/yyyy')}</p>
                </div>

                <p className="text-sm text-red-600 mb-4">
                  ⚠️ Esta ação é irreversível! As atividades serão permanentemente removidas.
                </p>

                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 font-medium text-sm">
                    Atividades a serem deletadas ({cleanupResult.details.length})
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {cleanupResult.details.map((activity, index) => (
                      <div key={index} className="p-3 border-b last:border-b-0 hover:bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-medium">{activity.title}</span>
                            <code className="ml-2 text-xs bg-gray-100 px-1 py-0.5 rounded">
                              {activity.id.slice(0, 8)}...
                            </code>
                          </div>
                          <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                            Semana {activity.weekNumber}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Agendado: {format(activity.scheduledDate, 'dd/MM/yyyy')} |
                          Status: {activity.status} |
                          Dia: {activity.dayOfWeek}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-4 border-t flex justify-end space-x-3">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900"
                  disabled={cleaning !== null}
                >
                  Cancelar
                </button>
                <button
                  onClick={executeCleanup}
                  disabled={cleaning !== null}
                  className={`
                    px-6 py-2 rounded-lg font-medium text-white
                    ${cleaning
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-red-600 hover:bg-red-700'
                    }
                  `}
                >
                  {cleaning ? 'Deletando...' : '✅ Confirmar Deleção'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Confirmação para Limpeza em Massa */}
        {showMassConfirmDialog && massProgress && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">
                  {massCleaning ? '🔄 Limpeza em Andamento' : '⚡ Confirmar Limpeza em Massa'}
                </h3>
              </div>

              <div className="p-6 overflow-y-auto">
                {!massCleaning ? (
                  <>
                    <p className="mb-4">
                      Você está prestes a executar limpeza em <strong>{massProgress.total}</strong> instâncias:
                    </p>

                    <div className="bg-gray-50 p-4 rounded-lg mb-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-sm text-gray-600">Instâncias com atividades:</span>
                          <p className="text-xl font-bold text-purple-700">
                            {massProgress.results.filter(r => r.activitiesCount && r.activitiesCount > 0).length}
                          </p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-600">Total de atividades:</span>
                          <p className="text-xl font-bold text-red-700">
                            {massProgress.results.reduce((acc, r) => acc + (r.activitiesCount || 0), 0)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-red-600 mb-4">
                      ⚠️ Esta ação é irreversível! Todas as atividades passadas serão permanentemente removidas.
                    </p>

                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-100 px-4 py-2 font-medium text-sm flex justify-between">
                        <span>Instâncias a serem processadas</span>
                        <span>Atividades</span>
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {massProgress.results
                          .filter(r => r.activitiesCount && r.activitiesCount > 0)
                          .map((result, index) => (
                            <div key={index} className="p-3 border-b last:border-b-0 hover:bg-gray-50">
                              <div className="flex items-start justify-between">
                                <div>
                                  <span className="font-medium">{result.instanceName}</span>
                                  <code className="ml-2 text-xs bg-gray-100 px-1 py-0.5 rounded">
                                    {result.instanceId.slice(0, 8)}...
                                  </code>
                                </div>
                                <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">
                                  {result.activitiesCount} atividades
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Progresso Geral</span>
                        <span>{massProgress.current} / {massProgress.total} instâncias</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-purple-600 h-2.5 rounded-full transition-all duration-300"
                          style={{ width: `${(massProgress.current / massProgress.total) * 100}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-green-50 p-3 rounded-lg">
                        <div className="text-xs text-green-600">Atividades Deletadas</div>
                        <div className="text-xl font-bold text-green-700">{massProgress.deleted}</div>
                      </div>
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="text-xs text-blue-600">Instâncias Processadas</div>
                        <div className="text-xl font-bold text-blue-700">{massProgress.instancesProcessed}</div>
                      </div>
                      <div className="bg-red-50 p-3 rounded-lg">
                        <div className="text-xs text-red-600">Erros</div>
                        <div className="text-xl font-bold text-red-700">{massProgress.errors}</div>
                      </div>
                    </div>

                    <div className="bg-purple-50 p-3 rounded-lg">
                      <div className="text-xs text-purple-600">Processando agora</div>
                      <div className="font-medium">{massProgress.currentInstance}</div>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-100 px-4 py-2 font-medium text-sm">
                        Log em Tempo Real
                      </div>
                      <div className="max-h-40 overflow-y-auto p-2 space-y-1">
                        {massProgress.results
                          .filter(r => r.status !== 'pending')
                          .slice(-5)
                          .map((result, idx) => (
                            <div key={idx} className="text-xs border-b pb-1">
                              <span className={`
                                inline-block w-2 h-2 rounded-full mr-1
                                ${result.status === 'completed' ? 'bg-green-500' : ''}
                                ${result.status === 'processing' ? 'bg-yellow-500 animate-pulse' : ''}
                                ${result.status === 'error' ? 'bg-red-500' : ''}
                              `}></span>
                              <span className="font-medium">{result.instanceName}</span>
                              <span className="text-gray-500 ml-1">
                                {result.status === 'completed' && `✓ ${result.deleted} atividades`}
                                {result.status === 'processing' && '🔄 processando...'}
                                {result.status === 'error' && `❌ ${result.message}`}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 px-6 py-4 border-t flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowMassConfirmDialog(false);
                    if (!massCleaning) {
                      setMassProgress(null);
                    }
                  }}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900"
                  disabled={massCleaning}
                >
                  {massCleaning ? 'Processando...' : 'Cancelar'}
                </button>
                {!massCleaning && (
                  <button
                    onClick={runMassCleanup}
                    className="px-6 py-2 rounded-lg font-medium text-white bg-purple-600 hover:bg-purple-700"
                  >
                    ✅ Iniciar Limpeza em Massa
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal de Confirmação para Finalizar Instâncias Expiradas */}
        {showExpiredConfirmDialog && expiredResult && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">
                  {completingExpired ? '🔄 Finalizando Instâncias' : '🏁 Confirmar Finalização de Instâncias Expiradas'}
                </h3>
              </div>

              <div className="p-6 overflow-y-auto">
                {!completingExpired ? (
                  <>
                    <p className="mb-4">
                      Foram encontradas <strong>{expiredResult.total}</strong> instâncias expiradas que ainda não foram finalizadas:
                    </p>

                    <div className="bg-gray-50 p-4 rounded-lg mb-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <span className="text-sm text-gray-600">Total encontradas:</span>
                          <p className="text-xl font-bold text-blue-700">{expiredResult.total}</p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-600">Com atividades:</span>
                          <p className="text-xl font-bold text-purple-700">
                            {expiredResult.details.filter(i => i.activitiesCount > 0).length}
                          </p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-600">Média de dias expirado:</span>
                          <p className="text-xl font-bold text-red-700">
                            {Math.round(expiredResult.details.reduce((acc, i) => acc + i.daysSinceEnd, 0) / expiredResult.details.length)} dias
                          </p>
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-yellow-600 mb-4">
                      ⚠️ Esta ação irá alterar o status das instâncias para <strong>"completed"</strong>.
                      As atividades destas instâncias NÃO serão afetadas (use a limpeza em massa separadamente).
                    </p>

                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-100 px-4 py-2 font-medium text-sm grid grid-cols-12 gap-2">
                        <span className="col-span-4">Instância</span>
                        <span className="col-span-2">Status Atual</span>
                        <span className="col-span-2">Dias Expirado</span>
                        <span className="col-span-2">Atividades</span>
                        <span className="col-span-2">Novo Status</span>
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {expiredResult.details.map((item, index) => (
                          <div key={index} className="p-3 border-b last:border-b-0 hover:bg-gray-50 grid grid-cols-12 gap-2 text-sm">
                            <div className="col-span-4">
                              <span className="font-medium">{item.instanceName}</span>
                              <code className="ml-1 text-xs bg-gray-100 px-1 py-0.5 rounded">
                                {item.instanceId.slice(0, 6)}...
                              </code>
                            </div>
                            <div className="col-span-2">
                              <span className={`px-2 py-1 text-xs rounded ${getStatusColor(item.oldStatus)}`}>
                                {item.oldStatus}
                              </span>
                            </div>
                            <div className="col-span-2">
                              <span className={item.daysSinceEnd > 30 ? 'text-red-600 font-bold' : ''}>
                                {item.daysSinceEnd} dias
                              </span>
                            </div>
                            <div className="col-span-2">
                              <span className="bg-gray-100 px-2 py-1 rounded">
                                {item.activitiesCount}
                              </span>
                            </div>
                            <div className="col-span-2">
                              <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                                completed
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Progresso:</span>
                        <span>{expiredResult.updated} / {expiredResult.total} instâncias</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                          style={{ width: `${(expiredResult.updated / expiredResult.total) * 100}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-green-50 p-3 rounded-lg">
                        <div className="text-xs text-green-600">Finalizadas</div>
                        <div className="text-xl font-bold text-green-700">{expiredResult.updated}</div>
                      </div>
                      <div className="bg-red-50 p-3 rounded-lg">
                        <div className="text-xs text-red-600">Erros</div>
                        <div className="text-xl font-bold text-red-700">{expiredResult.errors}</div>
                      </div>
                    </div>

                    <p className="text-center text-gray-600">
                      {completingExpired ? 'Finalizando instâncias...' : 'Processo concluído!'}
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 px-6 py-4 border-t flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowExpiredConfirmDialog(false);
                    if (!completingExpired) {
                      setExpiredResult(null);
                    }
                  }}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900"
                  disabled={completingExpired}
                >
                  {completingExpired ? 'Processando...' : 'Cancelar'}
                </button>
                {!completingExpired && (
                  <button
                    onClick={completeExpiredInstances}
                    className="px-6 py-2 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    ✅ Finalizar Instâncias
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}