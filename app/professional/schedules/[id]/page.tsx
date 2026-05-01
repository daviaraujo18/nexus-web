// app/professional/schedules/[id]/page.tsx
'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useScheduleDetail } from '@/hooks/useScheduleDetail';
import { useAuth } from '@/context/AuthContext';
import { 
  FaArrowLeft,
  FaEdit,
  FaUsers,
  FaChartLine,
  FaCalendarAlt,
  FaClock,
  FaListOl,
  FaTags,
  FaCalendarCheck,
  FaCopy,
  FaShare,
  FaTrash,
  FaArchive,
  FaEye,
  FaFileAlt,
  FaCheckCircle,
  FaExclamationTriangle,
  FaCalendar,
  FaFire,
  FaStar,
  FaChartBar,
  FaUserFriends,
  FaHistory,
  FaCog,
  FaPrint,
  FaDownload,
  FaExternalLinkAlt,
  FaQuestionCircle,
  FaPlus,
  FaSync,
  FaUpload,
  FaPaperclip
} from 'react-icons/fa';
import { 
  FiActivity, 
  FiTarget, 
  FiZap, 
  FiTrendingUp,
  FiBarChart2,
  FiCalendar,
  FiUsers,
  FiClock,
  FiSettings
} from 'react-icons/fi';

/**
 * Página de visualização detalhada de um cronograma.
 *
 * Responsabilidades:
 * - Exibir informações completas do cronograma
 * - Listar atividades associadas
 * - Permitir ações (editar, duplicar, atribuir)
 * - Exibir dados estruturais e técnicos
 *
 * Fonte de dados:
 * - useScheduleDetail (cronograma + atividades)
 *
 * ⚠️ IMPORTANTE:
 * Este componente NÃO executa alterações diretas.
 * Ele atua como hub de navegação e visualização.
 *
 * ⚠️ Impacto:
 * - gestão de cronogramas
 * - organização de atividades
 */
export default function ScheduleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const scheduleId = params.id as string;

  const [activeTab, setActiveTab] = useState<'overview' | 'activities' | 'progress' | 'analytics' | 'settings'>('overview');
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);

  // 🔥 Estado para armazenar o feedback visual dos arquivos anexados
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, string>>({});

  /**
   * Hook responsável por carregar:
   * - dados do cronograma
   * - lista de atividades
   *
   * Configuração:
   * - includeActivities = true
   * - includeProgress = false (otimização)
   */
  const {
    schedule,
    activities,
    loading,
    error,
    refresh
  } = useScheduleDetail({
    scheduleId,
    includeActivities: true,
    includeProgress: false
  });

  // Obter cor da categoria
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'therapeutic': return 'bg-gradient-to-r from-blue-500 to-blue-600';
      case 'educational': return 'bg-gradient-to-r from-emerald-500 to-emerald-600';
      case 'mixed': return 'bg-gradient-to-r from-purple-500 to-purple-600';
      default: return 'bg-gradient-to-r from-gray-500 to-gray-600';
    }
  };

  // Obter label da categoria
  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'therapeutic': return 'Terapêutico';
      case 'educational': return 'Educacional';
      default: return 'Misto';
    }
  };

  // Obter ícone da categoria
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'therapeutic': return <FaChartLine className="w-5 h-5" />;
      case 'educational': return <FaFileAlt className="w-5 h-5" />;
      default: return <FaCalendarCheck className="w-5 h-5" />;
    }
  };

  // Obter label do status
  const getStatusLabel = (isActive: boolean) => {
    return isActive ? 'Ativo' : 'Arquivado';
  };

  // Obter cor do status
  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800';
  };

  /**
   * Calcula estatísticas derivadas do cronograma.
   *
   * Inclui:
   * - total de atividades
   * - carga semanal
   * - dias ativos
   * - distribuição por dia
   * - tipos de atividades
   *
   * ⚠️ Processamento feito no client
   */
  const getStats = () => {
    if (!schedule) return null;

    const totalActivities = schedule.metadata.totalActivities || 0;
    const weeklyHours = schedule.metadata.estimatedWeeklyHours || 0;
    const activeDays = schedule.activeDays.length;
    
    /**
     * Agrupa atividades por dia da semana (0-6)
     */
    const activitiesByDay = activities.reduce((acc, activity) => {
      const day = activity.dayOfWeek;
      if (!acc[day]) acc[day] = 0;
      acc[day]++;
      return acc;
    }, {} as Record<number, number>);

    /**
     * Conta quantidade de atividades por tipo (ex: quiz, upload, etc.)
     */
    const activityTypes = activities.reduce((acc, activity) => {
      const type = activity.type;
      if (!acc[type]) acc[type] = 0;
      acc[type]++;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalActivities,
      weeklyHours,
      activeDays,
      activitiesByDay,
      activityTypes
    };
  };

  /**
   * Gerencia upload local de arquivos (feedback visual).
   *
   * ⚠️ IMPORTANTE:
   * - NÃO salva no backend
   * - apenas atualiza UI (estado local)
   *
   * Uso:
   * - mostrar nome do arquivo anexado
   */
  const handleFileUpload = (activityId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFiles(prev => ({
        ...prev,
        [activityId]: file.name
      }));
    }
  };

  const stats = getStats();

  /**
   * Estado de carregamento do cronograma.
   *
   * Bloqueia renderização até dados disponíveis
   */
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="relative inline-block">
            <div className="w-16 h-16 border-4 border-blue-200 rounded-full"></div>
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
          </div>
          <p className="mt-4 text-gray-600 font-medium">Carregando cronograma...</p>
        </div>
      </div>
    );
  }

  /**
   * Estado de erro ou cronograma inexistente.
   *
   * Permite:
   * - voltar
   * - acessar lista de cronogramas
   */
  if (error || !schedule) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 flex items-center justify-center p-4">
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
              href="/professional/schedules"
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all duration-200 font-medium"
            >
              Ver todos os cronogramas
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Formatar datas
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  // Nome dos dias da semana
  const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30">
      {/* Header Superior */}

      /**
       * Header principal do cronograma.
       *
       * Exibe:
       * - nome
       * - status (ativo/arquivado)
       * - categoria
       *
       * Inclui ações:
       * - atribuir
       * - duplicar
       * - editar
       */
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/professional/schedules"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FaArrowLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{schedule.name}</h1>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(schedule.isActive)}`}>
                    {getStatusLabel(schedule.isActive)}
                  </span>
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getCategoryColor(schedule.category)} text-white`}>
                    {getCategoryLabel(schedule.category)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(`/professional/schedules/${schedule.id}/assign`)}
                className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:shadow-lg transition-all duration-200 font-medium flex items-center gap-2"
              >
                <FaUsers className="w-4 h-4" />
                <span>Atribuir</span>
              </button>
              
              <button
                onClick={() => router.push(`/professional/schedules/new?copy=${schedule.id}`)}
                className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium flex items-center gap-2"
              >
                <FaCopy className="w-4 h-4" />
                <span>Duplicar</span>
              </button>
              
              <button
                onClick={() => router.push(`/professional/schedules/${scheduleId}/edit`)}
                className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium flex items-center gap-2"
              >
                <FaEdit className="w-4 h-4" />
                <span>Editar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="max-w-7xl mx-auto px-4 py-8">

        /**
         * Resumo geral do cronograma.
         *
         * Inclui:
         * - descrição
         * - período
         * - carga horária
         * - total de atividades
         */
        {/* Cartão de Resumo */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-8 overflow-hidden">
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Informações Principais */}
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Informações do Cronograma</h2>
                
                {schedule.description && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Descrição</h3>
                    <p className="text-gray-600 bg-gray-50 p-4 rounded-xl">
                      {schedule.description}
                    </p>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                      <FaCalendarAlt className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Período</div>
                      <div className="font-medium text-gray-900">
                        {formatDate(schedule.startDate)} - {formatDate(schedule.endDate)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                      <FaClock className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Carga Horária Semanal</div>
                      <div className="font-medium text-gray-900">
                        {schedule.metadata.estimatedWeeklyHours || 0} horas
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                      <FaListOl className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Total de Atividades</div>
                      <div className="font-medium text-gray-900">
                        {schedule.metadata.totalActivities || 0} atividades
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Estatísticas e Tags */}
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Estatísticas</h2>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-50 p-4 rounded-xl">
                    <div className="text-sm text-gray-500 mb-1">Dias Ativos</div>
                    <div className="text-2xl font-bold text-gray-900">{schedule.activeDays.length}</div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-xl">
                    <div className="text-sm text-gray-500 mb-1">Versão</div>
                    <div className="text-2xl font-bold text-gray-900">v{schedule.metadata.version}</div>
                  </div>
                </div>

                {/* Dias da Semana Ativos */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Dias Ativos na Semana</h3>
                  <div className="flex gap-2">

                    /**
                     * Representa visualmente os dias ativos do cronograma
                     */
                    {daysOfWeek.map((day, index) => (
                      <div
                        key={day}
                        className={`flex-1 text-center py-2.5 rounded-lg ${
                          schedule.activeDays.includes(index)
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {day}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                {schedule.metadata.tags && schedule.metadata.tags.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {schedule.metadata.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        /**
         * Controle de navegação interna.
         *
         * Tabs:
         * - overview
         * - activities
         * - progress
         * - analytics
         * - settings
         */
        {/* Navegação por Tabs */}
        <div className="mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <FaEye className="w-4 h-4" />
                <span>Visão Geral</span>
              </div>
            </button>
            
            <button
              onClick={() => setActiveTab('activities')}
              className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'activities'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <FiActivity className="w-4 h-4" />
                <span>Atividades ({activities.length})</span>
              </div>
            </button>
            
            <button
              onClick={() => setActiveTab('progress')}
              className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'progress'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <FiTrendingUp className="w-4 h-4" />
                <span>Progresso dos Alunos</span>
              </div>
            </button>
            
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'analytics'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <FiBarChart2 className="w-4 h-4" />
                <span>Análises</span>
              </div>
            </button>
            
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'settings'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <FiSettings className="w-4 h-4" />
                <span>Configurações</span>
              </div>
            </button>
          </div>
        </div>

        {/* Conteúdo da Tab Ativa */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">

          /**
           * Visão geral do cronograma.
           *
           * Inclui:
           * - distribuição de atividades
           * - tipos de atividades
           * - dados técnicos
           */
          {activeTab === 'overview' && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-6">Visão Geral do Cronograma</h2>
              
              {/* Distribuição de Atividades por Dia */}
              {stats && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Distribuição de Atividades por Dia</h3>
                  <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
                    {daysOfWeek.map((day, index) => {

                      /**
                       * Mostra quantidade de atividades por dia da semana
                       */
                      const activityCount = stats.activitiesByDay[index] || 0;
                      return (
                        <div key={day} className="text-center">
                          <div className={`text-sm mb-1 ${
                            schedule.activeDays.includes(index) ? 'text-gray-700' : 'text-gray-400'
                          }`}>
                            {day}
                          </div>
                          <div className={`text-2xl font-bold ${
                            schedule.activeDays.includes(index) 
                              ? 'text-blue-600' 
                              : 'text-gray-300'
                          }`}>
                            {activityCount}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            atividades
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tipos de Atividades */}
              {stats && stats.activityTypes && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Tipos de Atividades</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    /**
                     * Exibe contagem de atividades por tipo (ex: quiz, upload, etc.)
                     */
                    {Object.entries(stats.activityTypes).map(([type, count]) => (
                      <div key={type} className="bg-gray-50 p-4 rounded-xl">
                        <div className="text-sm text-gray-500 mb-1 capitalize">{type}</div>
                        <div className="text-xl font-bold text-gray-900">{count}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              /**
               * Informações internas do cronograma.
               *
               * Inclui:
               * - ID
               * - data de criação
               * - configurações
               */
              {/* Dados Técnicos */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Dados Técnicos</h3>
                <div className="bg-gray-50 rounded-xl p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Identificação</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">ID do Cronograma:</span>
                          <code className="text-sm bg-gray-100 px-2 py-1 rounded text-gray-800">
                            {schedule.id.substring(0, 8)}...
                          </code>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Criado por:</span>
                          <span className="font-medium">Você</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Data de criação:</span>
                          <span>{formatDate(schedule.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Configurações</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Regra de repetição:</span>
                          <span>Semanal</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Reset na repetição:</span>
                          <span className={schedule.repeatRules.resetOnRepeat ? 'text-emerald-600' : 'text-gray-600'}>
                            {schedule.repeatRules.resetOnRepeat ? 'Sim' : 'Não'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Status:</span>
                          <span className={schedule.isActive ? 'text-emerald-600' : 'text-gray-600'}>
                            {schedule.isActive ? 'Ativo' : 'Arquivado'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          /**
           * Lista completa de atividades do cronograma.
           *
           * Inclui:
           * - ordenação por dia + ordem
           * - metadados (duração, pontos, dificuldade)
           *
           * ⚠️ Núcleo estrutural do cronograma
           */
          {activeTab === 'activities' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Atividades do Cronograma</h2>
                <div className="text-sm text-gray-500">
                  {activities.length} atividades encontradas
                </div>
              </div>

              {activities.length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl mb-6">
                    <FiActivity className="w-10 h-10 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    Nenhuma atividade encontrada
                  </h3>
                  <p className="text-gray-500 max-w-md mx-auto mb-6">
                    Este cronograma não possui atividades cadastradas.
                  </p>
                  <button onClick={() => router.push(`/professional/schedules/${schedule.id}/edit`)} className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all duration-200 font-medium flex items-center gap-2 mx-auto">
                    <FaPlus className="w-4 h-4" />
                    <span>Adicionar Primeira Atividade</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {activities
                    
                    /**
                     * Ordena atividades por dia da semana e ordem interna
                     */
                    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.orderIndex - b.orderIndex)
                    .map((activity) => (
                      <div
                        key={activity.id}
                        className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-sm transition-shadow duration-200"
                      >
                        <div className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-start gap-4">
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                                <FiActivity className="w-6 h-6 text-blue-600" />
                              </div>
                              <div>
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="font-bold text-gray-900">{activity.title}</h3>
                                  <span className="px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                                    {activity.type}
                                  </span>
                                </div>
                                
                                {activity.description && (
                                  <p className="text-gray-600 mb-4">
                                    {activity.description}
                                  </p>
                                )}
                                
                                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                                  <div className="flex items-center gap-2">
                                    <FaCalendarAlt className="w-3.5 h-3.5" />
                                    <span>{daysOfWeek[activity.dayOfWeek]}</span>
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    <FaClock className="w-3.5 h-3.5" />
                                    <span>{activity.metadata.estimatedDuration} minutos</span>
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    <FaStar className="w-3.5 h-3.5" />
                                    <span>{activity.scoring.pointsOnCompletion} pontos</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => router.push(`/professional/schedules/${schedule.id}/edit`)}
                                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                                title="Editar atividade"
                              >
                                <FaEdit className="w-4 h-4" />
                              </button>
                              <button
                                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                                title="Visualizar atividade"
                              >
                                <FaEye className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          
                          {/* Dificuldade e Instruções */}
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
                              
                              {activity.scoring.isRequired && (
                                <span className="px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                  Obrigatória
                                </span>
                              )}
                            </div>
                            
                            <div className="text-sm text-gray-500">
                              Ordem: {activity.orderIndex + 1}
                            </div>
                          </div>
                          
                          /**
                           * Seção de upload de arquivos da atividade.
                           *
                           * Condição:
                           * - tipo inclui "upload"
                           * - ou configuração exige arquivo
                           *
                           * ⚠️ IMPORTANTE:
                           * - atualmente apenas feedback visual
                           * - não persiste no backend
                           *
                           * ⚠️ Futuro:
                           * integrar com Firebase Storage
                           */
                          {/*  NOVA SEÇÃO: ENVIO DE ARQUIVOS (Renderiza se o tipo for upload ou se exigir arquivo na config) */}
                          {(activity.type?.toLowerCase().includes('upload') || (activity.config as any)?.requiresFileUpload || (activity.metadata as any)?.requiresFileUpload) && (
                            <div className="mt-4 pt-4 border-t border-gray-100">
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-blue-50/50 p-4 rounded-xl border border-blue-100 gap-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                                    <FaUpload className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-900">Material da Atividade</h4>
                                    {uploadedFiles[activity.id] ? (
                                      <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                                        <FaCheckCircle className="w-3 h-3" /> {uploadedFiles[activity.id]}
                                      </p>
                                    ) : (
                                      <p className="text-xs text-gray-500">Anexe o arquivo necessário para esta atividade.</p>
                                    )}
                                  </div>
                                </div>
                                <label className="cursor-pointer shrink-0 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium flex items-center gap-2 shadow-sm w-full sm:w-auto justify-center">
                                  <FaPaperclip className="w-4 h-4" />
                                  <span>{uploadedFiles[activity.id] ? 'Trocar Arquivo' : 'Anexar Arquivo'}</span>
                                  <input 
                                    type="file" 
                                    className="hidden" 
                                    onChange={(e) => handleFileUpload(activity.id, e)} 
                                  />
                                </label>
                              </div>
                            </div>
                          )}

                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          /**
           * Área de visualização do progresso dos alunos neste cronograma.
           *
           * Objetivo:
           * - Mostrar desempenho dos alunos atribuídos
           * - Exibir evolução (completion, streak, etc.)
           *
           * ⚠️ Estado atual:
           * - Ainda é um placeholder (não implementado)
           *
           * ⚠️ Futuro:
           * - Integrar com ScheduleInstanceService
           * - Exibir métricas reais por aluno
           */
          {activeTab === 'progress' && (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl mb-6">
                <FiTrendingUp className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Progresso dos Alunos
              </h3>
              <p className="text-gray-500 max-w-md mx-auto mb-6">
                Visualize o progresso dos alunos atribuídos a este cronograma.
              </p>
              <Link
                href={`/professional/schedules/${schedule.id}/assign`}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:shadow-lg transition-all duration-200 font-medium inline-flex items-center gap-2"
              >
                <FaUsers className="w-4 h-4" />
                <span>Atribuir a Alunos</span>
              </Link>
            </div>
          )}

          /**
           * Aba de análises do cronograma.
           *
           * Função:
           * - Redirecionar o usuário para o dashboard analítico completo
           * - Centralizar análise em uma página dedicada (AnalyticsPage)
           *
           * ⚠️ IMPORTANTE:
           * Este componente NÃO processa analytics diretamente.
           * Ele apenas atua como gateway para a página de analytics global.
           *
           * ⚠️ Decisão de arquitetura:
           * - evita duplicação de lógica
           * - mantém analytics centralizado em um único fluxo
           */
          {activeTab === 'analytics' && (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl mb-6">
                <FiBarChart2 className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Análises do Cronograma
              </h3>
              <p className="text-gray-500 max-w-md mx-auto mb-6">
                Visualize análises detalhadas sobre o desempenho deste cronograma.
              </p>
              <button
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all duration-200 font-medium inline-flex items-center gap-2 cursor-pointer"
                onClick={() => router.push(`/professional/analytics?schedule=${schedule.id}`)}
              >
                <FaChartBar className="w-4 h-4" />
                <span>Acessar Dashboard de Análises</span>
              </button>
            </div>
          )}

          /**
           * Configurações administrativas do cronograma.
           *
           * Inclui:
           * - dados editáveis (visual)
           * - ações administrativas
           */
          {activeTab === 'settings' && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-6">Configurações do Cronograma</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Configurações Gerais */}
                <div className="bg-gray-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Configurações Gerais</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nome do Cronograma
                      </label>
                      <input
                        type="text"
                        defaultValue={schedule.name}
                        disabled
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-700 focus:outline-none"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Descrição
                      </label>
                      <textarea
                        defaultValue={schedule.description || ''}
                        rows={4}
                        disabled
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-700 focus:outline-none"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Categoria
                      </label>
                      <select
                        defaultValue={schedule.category}
                        disabled
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-700 focus:outline-none"
                      >
                        <option value="therapeutic">Terapêutico</option>
                        <option value="educational">Educacional</option>
                        <option value="mixed">Misto</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Ações Administrativas */}
                <div className="space-y-6">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-amber-800 mb-4">Status do Cronograma</h3>
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-amber-700">Status atual:</span>
                        <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(schedule.isActive)}`}>
                          {getStatusLabel(schedule.isActive)}
                        </span>
                      </div>
                      
                      <div className="space-y-3">
                        <button
                          onClick={() => router.push(`/professional/schedules/new?copy=${schedule.id}`)}
                          className="w-full px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium text-left cursor-pointer"
                        >
                          <div className="flex items-center justify-between">
                            <span>Duplicar Cronograma</span>
                            <FaCopy className="w-4 h-4 text-gray-400" />
                          </div>
                        </button>
                        
                        <button
                          className="w-full px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium text-left"
                        >
                          <div className="flex items-center justify-between">
                            <span>Exportar Cronograma</span>
                            <FaDownload className="w-4 h-4 text-gray-400" />
                          </div>
                        </button>
                        
                        <button
                          className="w-full px-4 py-3 bg-amber-100 border border-amber-300 text-amber-800 rounded-xl hover:bg-amber-200 transition-colors font-medium text-left"
                        >
                          <div className="flex items-center justify-between">
                            <span>{schedule.isActive ? 'Arquivar Cronograma' : 'Restaurar Cronograma'}</span>
                            <FaArchive className="w-4 h-4" />
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>

                  /**
                   * Ações irreversíveis.
                   *
                   * Inclui:
                   * - exclusão permanente
                   *
                   * ⚠️ Deve ter confirmação no backend
                   */
                  {/* Zona de Perigo */}
                  <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-red-800 mb-4">Zona de Perigo</h3>
                    <p className="text-red-700 text-sm mb-4">
                      Ações nesta seção são irreversíveis. Proceda com cautela.
                    </p>
                    <button
                      className="w-full px-4 py-3 bg-white border border-red-300 text-red-700 rounded-xl hover:bg-red-50 transition-colors font-medium flex items-center justify-between"
                    >
                      <span>Excluir Cronograma Permanentemente</span>
                      <FaTrash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        /**
         * Ações finais do cronograma.
         *
         * Inclui:
         * - refresh
         * - imprimir
         * - atribuir
         */
        {/* Botões de Ação Footer */}
        <div className="mt-8 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Última atualização: {formatDate(schedule.updatedAt)}
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={refresh}
              className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium flex items-center gap-2 cursor-pointer"
            >
              <FaSync className="w-4 h-4" />
              <span>Atualizar</span>
            </button>
            
            <button className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium flex items-center gap-2">
              <FaPrint className="w-4 h-4" />
              <span>Imprimir</span>
            </button>
            
            <Link
              href={`/professional/schedules/${schedule.id}/assign`}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:shadow-lg transition-all duration-200 font-medium flex items-center gap-2"
            >
              <FaUsers className="w-4 h-4" />
              <span>Atribuir a Alunos</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}