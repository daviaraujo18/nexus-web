'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useScheduleDetail } from '@/hooks/useScheduleDetail';
import { useAuth } from '@/context/AuthContext';
import { 
  FaArrowLeft,
  FaPlay,
  FaCheckCircle,
  FaClock,
  FaCalendarAlt,
  FaListOl,
  FaTrophy,
  FaChartLine,
  FaStar,
  FaFire,
  FaExclamationTriangle,
  FaQuestionCircle,
  FaCalendarCheck,
  FaFileAlt,
  FaVideo,
  FaCheckSquare,
  FaFileUpload,
  FaEdit,
  FaShare,
  FaHeart,
  FaSmile,
  FaFrown,
  FaMeh,
  FaRegCalendar,
  FaHistory,
  FaSync,
  FaPrint,
  FaDownload,
  FaExternalLinkAlt
} from 'react-icons/fa';
import { 
  FiActivity, 
  FiTarget, 
  FiZap, 
  FiTrendingUp,
  FiCalendar,
  FiClock,
  FiBarChart2,
  FiCheckCircle,
  FiPlayCircle
} from 'react-icons/fi';

export default function StudentScheduleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const instanceId = params.id as string;

  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'progress' | 'history'>('today');
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number>((new Date().getDay() + 6) % 7);
  const [showEmotionalModal, setShowEmotionalModal] = useState(false);

  const {
    schedule,
    instance,
    activities,
    progress,
    loading,
    error,
    refresh
  } = useScheduleDetail({
    instanceId,
    includeActivities: true,
    includeProgress: true
  });

  // Obter ícone do tipo de atividade
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'quick': return <FiZap className="w-5 h-5" />;
      case 'text': return <FaFileAlt className="w-5 h-5" />;
      case 'quiz': return <FaQuestionCircle className="w-5 h-5" />;
      case 'video': return <FaVideo className="w-5 h-5" />;
      case 'checklist': return <FaCheckSquare className="w-5 h-5" />;
      case 'file': return <FaFileUpload className="w-5 h-5" />;
      default: return <FiActivity className="w-5 h-5" />;
    }
  };

  // Obter cor do status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-100 text-emerald-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-gray-100 text-gray-800';
      case 'skipped': return 'bg-amber-100 text-amber-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Obter label do status
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Concluído';
      case 'in_progress': return 'Em andamento';
      case 'pending': return 'Pendente';
      case 'skipped': return 'Pulado';
      default: return 'Pendente';
    }
  };

  const getActivitiesByDay = (day: number) => {
    // activities vêm do template (Conv A: 0=Dom), day é Conv B (0=Seg).
    // Converter day para Conv A: (day + 1) % 7
    return activities.filter(activity => activity.dayOfWeek === (day + 1) % 7);
  };

  // Encontrar progresso de uma atividade
  const getActivityProgress = (activityId: string) => {
    return progress.find(p => p.activityId === activityId);
  };

  // Calcular progresso geral
  const calculateProgress = () => {
    if (!progress.length || !activities.length) return { completed: 0, total: 0, percentage: 0 };

    const completed = progress.filter(p => p.status === 'completed').length;
    const total = activities.length;
    const percentage = Math.round((completed / total) * 100);

    return { completed, total, percentage };
  };

  // Calcular pontos ganhos
  const calculatePoints = () => {
    return progress.reduce((total, p) => {
      if (p.status === 'completed') {
        return total + (p.scoring.pointsEarned || 0);
      }
      return total;
    }, 0);
  };

  // Obter atividades de hoje
  const getTodayActivities = () => {
    const today = (new Date().getDay() + 6) % 7;
    return getActivitiesByDay(today);
  };

  const progressData = calculateProgress();
  const totalPoints = calculatePoints();
  const todayActivities = getTodayActivities();

  // Nome dos dias da semana (convenção do sistema: 0=Segunda, 6=Domingo)
  const daysOfWeek = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  const scheduleToJS = (d: number) => (d + 1) % 7;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="relative inline-block">
            <div className="w-16 h-16 border-4 border-purple-200 rounded-full"></div>
            <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
          </div>
          <p className="mt-4 text-gray-600 font-medium">Carregando cronograma...</p>
        </div>
      </div>
    );
  }

  if (error || !schedule || !instance) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50/30 flex items-center justify-center p-4">
        <div className="max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FaExclamationTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            {error ? 'Erro ao carregar' : 'Cronograma não encontrado'}
          </h2>
          <p className="text-gray-600 mb-6">
            {error || 'O cronograma solicitado não existe ou você não tem permissão para acessá-lo.'}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.back()}
              className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
            >
              Voltar
            </button>
            <Link
              href="/student/schedules"
              className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all duration-200 font-medium"
            >
              Ver todos os cronogramas
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Formatar datas
  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  // Calcular tempo estimado total
  const totalEstimatedTime = activities.reduce((total, activity) => 
    total + (activity.metadata.estimatedDuration || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50/30">
      {/* Header Superior */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/student/schedules"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FaArrowLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{schedule.name}</h1>
                <div className="flex items-center gap-3 mt-1">
                  <span className="px-3 py-1 text-sm font-medium rounded-full bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-800">
                    Semana {instance.currentWeekNumber}
                  </span>
                  <span className="text-sm text-gray-500">
                    {formatDate(instance.currentWeekStartDate)} - {formatDate(instance.currentWeekEndDate)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm text-gray-500">Progresso</div>
                <div className="text-lg font-bold text-gray-900">{progressData.percentage}%</div>
              </div>
              
              <div className="w-16 h-16 relative">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="url(#gradient)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${progressData.percentage * 2.83} 283`}
                    transform="rotate(-90 50 50)"
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Cartão de Resumo */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-8 overflow-hidden">
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Progresso Geral */}
              <div className="lg:col-span-2">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Seu Progresso</h2>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-4 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                        <FiCheckCircle className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-gray-900">{progressData.completed}</div>
                        <div className="text-sm text-gray-500">Concluídas</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-4 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                        <FaClock className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-gray-900">{progressData.total}</div>
                        <div className="text-sm text-gray-500">Total</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-emerald-50 to-green-50 p-4 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                        <FaTrophy className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-gray-900">{totalPoints}</div>
                        <div className="text-sm text-gray-500">Pontos</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-4 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                        <FaFire className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-gray-900">
                          {Math.round(totalEstimatedTime / 60)}
                        </div>
                        <div className="text-sm text-gray-500">Horas total</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Barra de Progresso Detalhada */}
                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Progresso geral</span>
                    <span>{progressData.percentage}%</span>
                  </div>
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${progressData.percentage}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Informações Rápidas */}
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Informações</h2>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                      <FaCalendarAlt className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Início</div>
                      <div className="font-medium text-gray-900">
                        {formatDate(instance.startedAt)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                      <FaRegCalendar className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Dias ativos</div>
                      <div className="font-medium text-gray-900">
                        {schedule.activeDays.length} dias/semana
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                      <FaChartLine className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Status</div>
                      <div className={`px-3 py-1 text-xs font-medium rounded-full inline-block ${
                        instance.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                        instance.status === 'paused' ? 'bg-amber-100 text-amber-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {instance.status === 'active' ? 'Ativo' :
                         instance.status === 'paused' ? 'Pausado' : 'Concluído'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navegação por Tabs */}
        <div className="mb-6">
          <div className="flex border-b border-gray-200 overflow-x-auto">
            <button
              onClick={() => setActiveTab('today')}
              className={`flex-shrink-0 px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'today'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <FiCalendar className="w-4 h-4" />
                <span>Hoje ({todayActivities.length})</span>
              </div>
            </button>
            
            <button
              onClick={() => setActiveTab('week')}
              className={`flex-shrink-0 px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'week'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <FiClock className="w-4 h-4" />
                <span>Esta Semana</span>
              </div>
            </button>
            
            <button
              onClick={() => setActiveTab('progress')}
              className={`flex-shrink-0 px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'progress'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <FiTrendingUp className="w-4 h-4" />
                <span>Meu Progresso</span>
              </div>
            </button>
            
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-shrink-0 px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'history'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <FaHistory className="w-4 h-4" />
                <span>Histórico</span>
              </div>
            </button>
          </div>
        </div>

        {/* Conteúdo da Tab Ativa */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          {activeTab === 'today' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Atividades de Hoje</h2>
                  <p className="text-gray-600 mt-1">{formatDate(new Date())}</p>
                </div>
                <div className="text-sm text-gray-500">
                  {todayActivities.length} atividades programadas
                </div>
              </div>

              {todayActivities.length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl mb-6">
                    <FaCalendarCheck className="w-10 h-10 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    Nenhuma atividade para hoje!
                  </h3>
                  <p className="text-gray-500 max-w-md mx-auto mb-6">
                    Hoje é um dia de descanso neste cronograma. Aproveite para revisar atividades anteriores ou descansar.
                  </p>
                  <button
                    onClick={() => setActiveTab('week')}
                    className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all duration-200 font-medium"
                  >
                    Ver atividades da semana
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {todayActivities.map((activity) => {
                    const activityProgress = getActivityProgress(activity.id);
                    const status = activityProgress?.status || 'pending';
                    
                    return (
                      <div
                        key={activity.id}
                        className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-sm transition-shadow duration-200"
                      >
                        <div className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-start gap-4">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                status === 'completed' ? 'bg-gradient-to-br from-emerald-100 to-emerald-200' :
                                status === 'in_progress' ? 'bg-gradient-to-br from-blue-100 to-blue-200' :
                                'bg-gradient-to-br from-gray-100 to-gray-200'
                              }`}>
                                <div className={status === 'completed' ? 'text-emerald-600' :
                                               status === 'in_progress' ? 'text-blue-600' :
                                               'text-gray-600'}>
                                  {getActivityIcon(activity.type)}
                                </div>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="font-bold text-gray-900">{activity.title}</h3>
                                  <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(status)}`}>
                                    {getStatusLabel(status)}
                                  </span>
                                </div>
                                
                                {activity.description && (
                                  <p className="text-gray-600 mb-4">
                                    {activity.description}
                                  </p>
                                )}
                                
                                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                                  <div className="flex items-center gap-2">
                                    <FaClock className="w-3.5 h-3.5" />
                                    <span>{activity.metadata.estimatedDuration} minutos</span>
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    <FaStar className="w-3.5 h-3.5" />
                                    <span>{activity.scoring.pointsOnCompletion} pontos</span>
                                  </div>
                                  
                                  {activity.scoring.isRequired && (
                                    <div className="flex items-center gap-2">
                                      <FaExclamationTriangle className="w-3.5 h-3.5" />
                                      <span>Obrigatória</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex flex-col items-end gap-2">
                              <button
                                onClick={() => router.push(`/student/activity/${activity.id}?instance=${instanceId}`)}
                                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all duration-200 font-medium flex items-center gap-2"
                              >
                                {status === 'completed' ? (
                                  <>
                                    <FaCheckCircle className="w-4 h-4" />
                                    <span>Revisar</span>
                                  </>
                                ) : status === 'in_progress' ? (
                                  <>
                                    <FaPlay className="w-4 h-4" />
                                    <span>Continuar</span>
                                  </>
                                ) : (
                                  <>
                                    <FaPlay className="w-4 h-4" />
                                    <span>Começar</span>
                                  </>
                                )}
                              </button>
                              
                              <div className="text-xs text-gray-500">
                                Ordem: {activity.orderIndex + 1}
                              </div>
                            </div>
                          </div>
                          
                          {/* Dificuldade e Pontuação */}
                          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                            <div className="flex items-center gap-4">
                              <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                                activity.metadata.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-800' :
                                activity.metadata.difficulty === 'medium' ? 'bg-amber-100 text-amber-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {activity.metadata.difficulty === 'easy' ? 'Fácil' :
                                 activity.metadata.difficulty === 'medium' ? 'Médio' : 'Difícil'}
                              </span>
                              
                              {activityProgress?.scoring?.pointsEarned && (
                                <span className="px-3 py-1 text-xs font-medium rounded-full bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800">
                                  {activityProgress.scoring.pointsEarned} pontos ganhos
                                </span>
                              )}
                            </div>
                            
                            {activityProgress?.completedAt && (
                              <div className="text-sm text-gray-500">
                                Concluído em {new Date(activityProgress.completedAt).toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'week' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Atividades da Semana</h2>
                <div className="text-sm text-gray-500">
                  Semana {instance.currentWeekNumber}
                </div>
              </div>

              {/* Navegação por Dias */}
              <div className="mb-8">
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {daysOfWeek.map((day, index) => {
                    const dayActivities = getActivitiesByDay(index);
                    const isActiveDay = schedule.activeDays.includes(scheduleToJS(index));
                    const isSelected = selectedDay === index;
                    
                    return (
                      <button
                        key={day}
                        onClick={() => setSelectedDay(index)}
                        className={`flex-shrink-0 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                          isSelected
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                            : isActiveDay
                            ? 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                        disabled={!isActiveDay}
                      >
                        <div className="text-center">
                          <div className="text-sm">{day.substring(0, 3)}</div>
                          <div className="text-lg font-bold mt-1">{dayActivities.length}</div>
                          <div className="text-xs mt-1">atividades</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Atividades do Dia Selecionado */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Atividades de {daysOfWeek[selectedDay]}
                </h3>
                
                {getActivitiesByDay(selectedDay).length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-xl">
                    <FaCalendarCheck className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">
                      Nenhuma atividade programada para {daysOfWeek[selectedDay].toLowerCase()}.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {getActivitiesByDay(selectedDay)
                      .sort((a, b) => a.orderIndex - b.orderIndex)
                      .map((activity) => {
                        const activityProgress = getActivityProgress(activity.id);
                        const status = activityProgress?.status || 'pending';
                        
                        return (
                          <div
                            key={activity.id}
                            className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                  status === 'completed' ? 'bg-emerald-100' :
                                  status === 'in_progress' ? 'bg-blue-100' :
                                  'bg-gray-100'
                                }`}>
                                  {getActivityIcon(activity.type)}
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900">{activity.title}</div>
                                  <div className="text-sm text-gray-500">
                                    {activity.metadata.estimatedDuration} min • {activity.scoring.pointsOnCompletion} pts
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-3">
                                <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(status)}`}>
                                  {getStatusLabel(status)}
                                </span>
                                
                                <button
                                  onClick={() => router.push(`/student/activity/${activity.id}?instance=${instanceId}`)}
                                  className="px-3 py-1.5 text-sm bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:shadow-md transition-all duration-200"
                                >
                                  {status === 'completed' ? 'Revisar' : 'Acessar'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'progress' && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-6">Meu Progresso Detalhado</h2>
              
              {/* Estatísticas de Progresso */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-white flex items-center justify-center">
                      <FiTrendingUp className="w-7 h-7 text-purple-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{progressData.percentage}%</div>
                      <div className="text-sm text-gray-500">Taxa de conclusão</div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-white flex items-center justify-center">
                      <FaFire className="w-7 h-7 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">
                        {instance.progressCache?.streakDays || 0}
                      </div>
                      <div className="text-sm text-gray-500">Dias de sequência</div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-white flex items-center justify-center">
                      <FaTrophy className="w-7 h-7 text-emerald-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{totalPoints}</div>
                      <div className="text-sm text-gray-500">Pontos totais</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progresso por Tipo de Atividade */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Progresso por Tipo de Atividade</h3>
                <div className="bg-gray-50 rounded-xl p-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {['quick', 'text', 'quiz', 'video', 'checklist', 'file'].map((type) => {
                      const typeActivities = activities.filter(a => a.type === type);
                      const typeProgress = progress.filter(p => 
                        typeActivities.some(a => a.id === p.activityId)
                      );
                      const completed = typeProgress.filter(p => p.status === 'completed').length;
                      const total = typeActivities.length;
                      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
                      
                      return (
                        <div key={type} className="text-center">
                          <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-white flex items-center justify-center">
                            {getActivityIcon(type)}
                          </div>
                          <div className="text-sm font-medium text-gray-700 capitalize">{type}</div>
                          <div className="text-lg font-bold text-gray-900 mt-1">
                            {completed}/{total}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">{percentage}%</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Últimas Atividades Concluídas */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Últimas Atividades Concluídas</h3>
                {progress.filter(p => p.status === 'completed').length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-xl">
                    <FaCheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">
                      Nenhuma atividade concluída ainda. Comece pelas atividades de hoje!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {progress
                      .filter(p => p.status === 'completed')
                      .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
                      .slice(0, 5)
                      .map((p) => {
                        const activity = activities.find(a => a.id === p.activityId);
                        if (!activity) return null;
                        
                        return (
                          <div
                            key={p.id}
                            className="flex items-center justify-between p-4 bg-emerald-50 rounded-xl border border-emerald-100"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                                {getActivityIcon(activity.type)}
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">{activity.title}</div>
                                <div className="text-sm text-gray-500">
                                  Concluído em {new Date(p.completedAt!).toLocaleDateString('pt-BR')}
                                </div>
                              </div>
                            </div>
                            
                            <div className="text-right">
                              <div className="font-bold text-emerald-600">
                                +{p.scoring.pointsEarned || 0} pontos
                              </div>
                              <div className="text-sm text-gray-500">
                                {activity.metadata.estimatedDuration} min
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-6">Histórico do Cronograma</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Informações do Cronograma */}
                <div className="bg-gray-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Informações do Programa</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Nome do Cronograma</div>
                      <div className="font-medium text-gray-900">{schedule.name}</div>
                    </div>
                    
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Descrição</div>
                      <div className="text-gray-600">{schedule.description || 'Sem descrição'}</div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-500 mb-1">Data de início</div>
                        <div className="font-medium text-gray-900">
                          {formatDate(instance.startedAt)}
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-sm text-gray-500 mb-1">Semana atual</div>
                        <div className="font-medium text-gray-900">
                          Semana {instance.currentWeekNumber}
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Dias ativos por semana</div>
                      <div className="flex gap-2">
                        {daysOfWeek.map((day, index) => (
                          <span
                            key={day}
                            className={`px-3 py-1 text-xs rounded-full ${
                              schedule.activeDays.includes(scheduleToJS(index))
                                ? 'bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-800'
                                : 'bg-gray-200 text-gray-500'
                            }`}
                          >
                            {day.substring(0, 3)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Metas e Conquistas */}
                <div className="space-y-6">
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-amber-800 mb-4">Suas Conquistas</h3>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                            <FaTrophy className="w-5 h-5 text-amber-600" />
                          </div>
                          <div>
                            <div className="font-medium text-amber-800">Primeira Atividade</div>
                            <div className="text-sm text-amber-600">Complete sua primeira atividade</div>
                          </div>
                        </div>
                        <FaCheckCircle className="w-6 h-6 text-emerald-500" />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                            <FaFire className="w-5 h-5 text-amber-600" />
                          </div>
                          <div>
                            <div className="font-medium text-amber-800">3 Dias Seguidos</div>
                            <div className="text-sm text-amber-600">Complete atividades por 3 dias consecutivos</div>
                          </div>
                        </div>
                        <div className="text-gray-400">0/3</div>
                      </div>
                    </div>
                  </div>

                  {/* Próximos Passos */}
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-blue-800 mb-4">Próximos Passos</h3>
                    
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                          <span className="text-blue-600 font-bold">1</span>
                        </div>
                        <div>
                          <div className="font-medium text-blue-800">Complete as atividades de hoje</div>
                          <div className="text-sm text-blue-600">
                            {todayActivities.length} atividades pendentes
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                          <span className="text-blue-600 font-bold">2</span>
                        </div>
                        <div>
                          <div className="font-medium text-blue-800">Alcance 50% de progresso</div>
                          <div className="text-sm text-blue-600">
                            {progressData.percentage}% concluído
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Botões de Ação Footer */}
        <div className="mt-8 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Última atualização: {formatDate(instance.updatedAt)}
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={refresh}
              className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium flex items-center gap-2"
            >
              <FaSync className="w-4 h-4" />
              <span>Atualizar</span>
            </button>
            
            <button className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium flex items-center gap-2">
              <FaDownload className="w-4 h-4" />
              <span>Exportar Progresso</span>
            </button>
            
            <button
              onClick={() => setShowEmotionalModal(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all duration-200 font-medium flex items-center gap-2"
            >
              <FaSmile className="w-4 h-4" />
              <span>Registrar Estado Emocional</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}