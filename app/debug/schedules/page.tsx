// pages/debug/schedules.tsx
'use client'
import { useState, useEffect } from 'react';
import {
  collection,
  query,
  getDocs,
  where,
  orderBy,
  doc,
  getDoc,
  DocumentData,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { ActivityProgress, ScheduleInstance, ScheduleTemplate, User, WeeklySnapshot } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { firestore } from '@/firebase/config';

interface ExpandedSections {
  templates: boolean;
  instances: Record<string, boolean>;
  activities: Record<string, boolean>;
  snapshots: Record<string, boolean>;
}

interface TemplateWithData extends ScheduleTemplate {
  id: string;
  instances: (ScheduleInstance & {
    id: string;
    activities: (ActivityProgress & { id: string })[];
    snapshots: (WeeklySnapshot & { id: string })[];
  })[];
}

export default function DebugSchedulesPage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateWithData[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<ExpandedSections>({
    templates: true,
    instances: {},
    activities: {},
    snapshots: {}
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProfessional, setFilterProfessional] = useState<string>('');
  const [professionals, setProfessionals] = useState<Record<string, string>>({});

  // Carregar dados — apenas para profissionais e admins
  useEffect(() => {
    if (!user) return;
    if (user.role !== 'professional' && user.role !== 'admin') return;
    loadAllData();
  }, [user]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Buscar todos os templates
      const templatesQuery = query(
        collection(firestore, 'weeklySchedules'),
        orderBy('createdAt', 'desc')
      );
      const templatesSnapshot = await getDocs(templatesQuery);

      const templatesData: TemplateWithData[] = [];
      const professionalIdsToFetch = new Set<string>();

      // 2. Para cada template, buscar instâncias relacionadas
      for (const templateDoc of templatesSnapshot.docs) {
        const template = {
          id: templateDoc.id,
          ...templateDoc.data(),
          createdAt: templateDoc.data().createdAt?.toDate(),
          updatedAt: templateDoc.data().updatedAt?.toDate(),
          startDate: templateDoc.data().startDate?.toDate(),
          endDate: templateDoc.data().endDate?.toDate()
        } as ScheduleTemplate;

        // Buscar instâncias deste template
        const instancesQuery = query(
          collection(firestore, 'scheduleInstances'),
          where('scheduleTemplateId', '==', templateDoc.id)
        );
        const instancesSnapshot = await getDocs(instancesQuery);

        const instances = [];

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

          // Buscar activityProgress desta instância
          const activitiesQuery = query(
            collection(firestore, 'activityProgress'),
            where('scheduleInstanceId', '==', instanceDoc.id)
          );
          const activitiesSnapshot = await getDocs(activitiesQuery);

          const activities = activitiesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
            updatedAt: doc.data().updatedAt?.toDate(),
            scheduledDate: doc.data().scheduledDate?.toDate(),
            startedAt: doc.data().startedAt?.toDate(),
            completedAt: doc.data().completedAt?.toDate(),
            dueDate: doc.data().dueDate?.toDate()
          })) as (ActivityProgress & { id: string })[];

          // Buscar weeklySnapshots desta instância
          const snapshotsQuery = query(
            collection(firestore, 'weeklySnapshots'),
            where('scheduleInstanceId', '==', instanceDoc.id),
            orderBy('weekNumber', 'desc')
          );
          const snapshotsSnapshot = await getDocs(snapshotsQuery);

          const snapshots = snapshotsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
            updatedAt: doc.data().updatedAt?.toDate(),
            weekStartDate: doc.data().weekStartDate?.toDate(),
            weekEndDate: doc.data().weekEndDate?.toDate()
          })) as (WeeklySnapshot & { id: string })[];

          instances.push({
            ...instance,
            activities,
            snapshots
          });

          if (instance.professionalId) {
            professionalIdsToFetch.add(instance.professionalId);
          }
        }

        templatesData.push({
          ...template,
          instances
        });
      }

      setTemplates(templatesData);

      // Buscar nomes dos profissionais
      const professionalIds = Array.from(professionalIdsToFetch);
      if (professionalIds.length > 0) {
        const professionalNames: Record<string, string> = {};

        for (const id of professionalIds) {
          try {
            const profDoc = await getDoc(doc(firestore, 'professionals', id));
            if (profDoc.exists()) {
              const profData = profDoc.data() as User;
              professionalNames[id] = profData.name;
            } else {
              professionalNames[id] = 'Profissional não encontrado';
            }
          } catch (err) {
            professionalNames[id] = 'Erro ao carregar';
          }
        }

        setProfessionals(professionalNames);
      }

    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const toggleTemplate = () => {
    setExpandedSections(prev => ({
      ...prev,
      templates: !prev.templates
    }));
  };

  const toggleInstance = (instanceId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      instances: {
        ...prev.instances,
        [instanceId]: !prev.instances[instanceId]
      }
    }));
  };

  const toggleActivities = (instanceId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      activities: {
        ...prev.activities,
        [instanceId]: !prev.activities[instanceId]
      }
    }));
  };

  const toggleSnapshots = (instanceId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      snapshots: {
        ...prev.snapshots,
        [instanceId]: !prev.snapshots[instanceId]
      }
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-gray-100 text-gray-800';
      case 'in_progress': return 'bg-purple-100 text-purple-800';
      case 'skipped': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '—';

    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false // Garante o formato 24h
    }).format(date);
  };

  const filteredTemplates = templates.filter(template => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (!template.name.toLowerCase().includes(term) && !template.id?.toLowerCase().includes(term)) {
        return false;
      }
    }
    if (filterProfessional) {
      const term = filterProfessional.toLowerCase();
      const hasMatch = template.instances.some(i => {
        const name = professionals[i.professionalId] ?? '';
        return (i.professionalId?.toLowerCase().includes(term) ?? false) || name.toLowerCase().includes(term);
      });
      if (!hasMatch) return false;
    }
    return true;
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-lg text-gray-700">Verificando acesso...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user || (user.role !== 'professional' && user.role !== 'admin')) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-800 mb-2">Acesso restrito</h2>
            <p className="text-red-600">Esta página é exclusiva para profissionais e administradores.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-lg text-gray-700">Carregando dados...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-800 mb-2">Erro ao carregar dados</h2>
            <p className="text-red-600">{error}</p>
            <button
              onClick={loadAllData}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-gray-700">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            🐛 Debug: Cronogramas
          </h1>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Total Templates</div>
              <div className="text-2xl font-bold">{templates.length}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Total Instâncias</div>
              <div className="text-2xl font-bold">
                {templates.reduce((acc, t) => acc + t.instances.length, 0)}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Total Atividades</div>
              <div className="text-2xl font-bold">
                {templates.reduce((acc, t) =>
                  acc + t.instances.reduce((acc2, i) => acc2 + i.activities.length, 0), 0
                )}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Total Snapshots</div>
              <div className="text-2xl font-bold">
                {templates.reduce((acc, t) =>
                  acc + t.instances.reduce((acc2, i) => acc2 + i.snapshots.length, 0), 0
                )}
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Buscar por nome ou ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="text"
                placeholder="Filtrar por profissional..."
                value={filterProfessional}
                onChange={(e) => setFilterProfessional(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={loadAllData}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                🔄 Recarregar
              </button>
            </div>
          </div>
        </div>

        {/* Lista de Templates */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Header do Template */}
          <div
            className="bg-gray-50 px-6 py-4 border-b cursor-pointer hover:bg-gray-100 transition-colors flex items-center justify-between"
            onClick={toggleTemplate}
          >
            <div className="flex items-center space-x-2">
              <span className="text-xl">{expandedSections.templates ? '▼' : '▶'}</span>
              <h2 className="text-lg font-semibold text-gray-900">
                Templates Semanais ({filteredTemplates.length})
              </h2>
            </div>
          </div>

          {/* Conteúdo dos Templates */}
          {expandedSections.templates && (
            <div className="divide-y divide-gray-200">
              {filteredTemplates.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  Nenhum template encontrado
                </div>
              ) : (
                filteredTemplates.map((template) => (
                  <div key={template.id} className="p-6 hover:bg-gray-50">
                    {/* Template Header */}
                    <div className="mb-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">
                            {template.name}
                          </h3>
                          <p className="text-sm text-gray-600">
                            ID: <code className="bg-gray-100 px-1 py-0.5 rounded">{template.id}</code>
                          </p>
                        </div>
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                          {template.category}
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Período:</span>
                          <p>{formatDate(template.startDate)} - {formatDate(template.endDate)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Atividades:</span>
                          <p>{template.metadata?.totalActivities || 0}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Instâncias:</span>
                          <p>{template.instances.length}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Criado em:</span>
                          <p>{formatDate(template.createdAt)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Instâncias do Template */}
                    {template.instances.length > 0 && (
                      <div className="ml-4 mt-4 border-l-2 border-gray-200 pl-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">
                          Instâncias ({template.instances.length})
                        </h4>

                        <div className="space-y-3">
                          {template.instances.map((instance) => (
                            <div key={instance.id} className="bg-gray-50 rounded-lg p-4">
                              {/* Instance Header */}
                              <div
                                className="flex items-center justify-between cursor-pointer"
                                onClick={() => toggleInstance(instance.id)}
                              >
                                <div className="flex items-center space-x-3">
                                  <span className="text-sm">
                                    {expandedSections.instances[instance.id] ? '▼' : '▶'}
                                  </span>
                                  <div>
                                    <div className="flex items-center space-x-2">
                                      <code className="text-xs bg-gray-200 px-1 py-0.5 rounded">
                                        {instance.id.slice(0, 16)}...
                                      </code>
                                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusColor(instance.status)}`}>
                                        {instance.status}
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-600 mt-1">
                                      Semana {instance.currentWeekNumber} |
                                      Aluno: {instance.studentId.slice(0, 8)}... |
                                      Prof: {professionals[instance.professionalId] || instance.professionalId?.slice(0, 8) || '—'}...
                                    </div>
                                  </div>
                                </div>
                                <div className="text-xs text-gray-500">
                                  {formatDate(instance.currentWeekStartDate)} - {formatDate(instance.currentWeekEndDate)}
                                </div>
                              </div>

                              {/* Instance Details */}
                              {expandedSections.instances[instance.id] && (
                                <div className="mt-4 ml-4 space-y-4">
                                  {/* Progress Cache */}
                                  {instance.progressCache && (
                                    <div className="bg-white rounded p-3 text-sm">
                                      <div className="font-medium mb-2">📊 Progress Cache</div>
                                      <div className="grid grid-cols-4 gap-2 text-xs">
                                        <div>Completadas: {instance.progressCache.completedActivities}/{instance.progressCache.totalActivities}</div>
                                        <div>Progresso: {instance.progressCache.completionPercentage?.toFixed(1)}%</div>
                                        <div>Pontos: {instance.progressCache.totalPointsEarned}</div>
                                        <div>Streak: {instance.progressCache?.streakDays ?? 0} dias</div>
                                        <div className="col-span-4 text-gray-500">
                                          Última atualização: {formatDate(instance.progressCache.lastUpdatedAt)}
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Activities Section */}
                                  <div className="border rounded-lg overflow-hidden">
                                    <div
                                      className="bg-gray-100 px-4 py-2 flex items-center justify-between cursor-pointer"
                                      onClick={() => toggleActivities(instance.id)}
                                    >
                                      <span className="font-medium">
                                        Atividades ({instance.activities.length})
                                      </span>
                                      <span>{expandedSections.activities[instance.id] ? '▼' : '▶'}</span>
                                    </div>

                                    {expandedSections.activities[instance.id] && (
                                      <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
                                        {instance.activities.map((activity) => (
                                          <div key={activity.id} className="bg-white border rounded p-3 text-sm">
                                            <div className="flex items-start justify-between mb-2">
                                              <div>
                                                <span className="font-medium">
                                                  {activity.activitySnapshot?.title || 'Atividade sem título'}
                                                </span>
                                                <code className="ml-2 text-xs bg-gray-100 px-1 py-0.5 rounded">
                                                  {activity.id.slice(0, 12)}...
                                                </code>
                                              </div>
                                              <span className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusColor(activity.status)}`}>
                                                {activity.status}
                                              </span>
                                            </div>
                                            <div className="grid grid-cols-4 gap-2 text-xs text-gray-600">
                                              <div>Semana {activity.weekNumber}</div>
                                              <div>Dia {activity.dayOfWeek}</div>
                                              <div>Pontos: {activity.scoring?.pointsEarned || 0}</div>
                                              <div>Tempo: {activity.executionData?.timeSpent || 0}min</div>
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                              Agendado: {formatDate(activity.scheduledDate)}
                                              {activity.completedAt && ` | Concluído: ${formatDate(activity.completedAt)}`}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Snapshots Section */}
                                  <div className="border rounded-lg overflow-hidden">
                                    <div
                                      className="bg-gray-100 px-4 py-2 flex items-center justify-between cursor-pointer"
                                      onClick={() => toggleSnapshots(instance.id)}
                                    >
                                      <span className="font-medium">
                                        Snapshots Semanais ({instance.snapshots.length})
                                      </span>
                                      <span>{expandedSections.snapshots[instance.id] ? '▼' : '▶'}</span>
                                    </div>

                                    {expandedSections.snapshots[instance.id] && (
                                      <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                                        {instance.snapshots.map((snapshot) => (
                                          <div key={snapshot.id} className="bg-white border rounded p-3">
                                            <div className="flex items-start justify-between mb-2">
                                              <div>
                                                <span className="font-medium">Semana {snapshot.weekNumber}</span>
                                                <code className="ml-2 text-xs bg-gray-100 px-1 py-0.5 rounded">
                                                  {snapshot.id.slice(0, 12)}...
                                                </code>
                                              </div>
                                              <span className="text-xs text-gray-500">
                                                {formatDate(snapshot.weekStartDate)} - {formatDate(snapshot.weekEndDate)}
                                              </span>
                                            </div>

                                            {/* Métricas do Snapshot */}
                                            <div className="grid grid-cols-4 gap-2 text-xs mb-3">
                                              <div className="bg-green-50 p-2 rounded">
                                                <div className="text-green-800 font-medium">Conclusão</div>
                                                <div>{snapshot.metrics?.completedActivities || 0}/{snapshot.metrics?.totalActivities || 0}</div>
                                                <div className="text-green-600">{snapshot.metrics?.completionRate?.toFixed(1)}%</div>
                                              </div>
                                              <div className="bg-blue-50 p-2 rounded">
                                                <div className="text-blue-800 font-medium">Pontos</div>
                                                <div>{snapshot.metrics?.totalPointsEarned || 0}</div>
                                                <div className="text-blue-600">Média: {snapshot.metrics?.averagePointsPerActivity?.toFixed(1) || 0}</div>
                                              </div>
                                              <div className="bg-purple-50 p-2 rounded">
                                                <div className="text-purple-800 font-medium">Tempo</div>
                                                <div>{snapshot.metrics?.totalTimeSpent || 0}min</div>
                                                <div className="text-purple-600">Média: {snapshot.metrics?.averageTimePerActivity?.toFixed(0) || 0}min</div>
                                              </div>
                                              <div className="bg-orange-50 p-2 rounded">
                                                <div className="text-orange-800 font-medium">Consistência</div>
                                                <div>{snapshot.metrics?.consistencyScore?.toFixed(0) || 0}%</div>
                                                <div className="text-orange-600">Streak: {snapshot.metrics?.streakAtEndOfWeek || 0}</div>
                                              </div>
                                            </div>

                                            {/* Daily Breakdown */}
                                            {snapshot.dailyBreakdown && (
                                              <div className="mt-2">
                                                <div className="text-xs font-medium mb-1">📅 Por dia:</div>
                                                <div className="flex space-x-1">
                                                  {Object.entries(snapshot.dailyBreakdown).map(([day, data]: [string, any]) => (
                                                    <div key={day} className="flex-1 bg-gray-50 p-1 rounded text-center">
                                                      <div className="text-[10px] text-gray-500">Dia {day}</div>
                                                      <div className="text-xs font-medium">{data.completed || 0}/{data.total || 0}</div>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            )}

                                            <div className="text-[10px] text-gray-400 mt-2">
                                              Gerado: {formatDate(snapshot.createdAt)}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}