// app/professional/schedules/page.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSchedules } from '@/hooks/useSchedules';
import {
  FaPlus,
  FaCalendarAlt,
  FaEdit,
  FaUsers,
  FaChartLine,
  FaArchive,
  FaFilter,
  FaSearch,
  FaClock,
  FaListOl,
  FaTags,
  FaCalendarCheck,
  FaSort,
  FaSync,
  FaEye,
  FaTrash,
  FaCopy,
  FaShare,
  FaChevronRight,
  FaCalendar,
  FaFileAlt,
  FaCheckCircle,
  FaRegCalendarAlt,
  FaFire,
  FaStar,
  FaChartBar,
  FaUserFriends
} from 'react-icons/fa';
import { FiActivity, FiTarget, FiZap, FiTrendingUp } from 'react-icons/fi';

export default function SchedulesPage() {
  // 1. Estados declarados primeiro
  const [filter, setFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'activities'>('date');

  // 2. Hook chamado DEPOIS dos estados existirem
  const { schedules, loading, error, archiveSchedule, refresh, deleteSchedule } = useSchedules({
    activeOnly: filter === 'active',
    limit: 50
  });

  // Aplicar filtros e ordenação
  const filteredSchedules = schedules
    .filter(schedule => {
      // Filtro por status
      if (filter === 'active' && !schedule.isActive) return false;
      if (filter === 'archived' && schedule.isActive) return false;

      // Filtro por categoria
      if (categoryFilter !== 'all' && schedule.category !== categoryFilter) return false;

      // Filtro por busca
      if (search && !schedule.name.toLowerCase().includes(search.toLowerCase()) &&
        !schedule.description?.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'name':
          return a.name.localeCompare(b.name);
        case 'activities':
          return (b.metadata.totalActivities || 0) - (a.metadata.totalActivities || 0);
        default:
          return 0;
      }
    });

  const handleArchive = async (scheduleId: string, scheduleName: string) => {
    if (window.confirm(`Tem certeza que deseja arquivar o cronograma "${scheduleName}"?`)) {
      try {
        await archiveSchedule(scheduleId);
        alert('Cronograma arquivado com sucesso!');
      } catch (err: any) {
        alert(`Erro ao arquivar: ${err.message}`);
      }
    }
  };

  // NOVA FUNÇÃO: Tratamento rigoroso para exclusão
  const handleDelete = async (schedule: any) => {
    // Verificação de Vínculos (ajuste a propriedade conforme necessário)
    const hasLinkedStudents = schedule.assignedStudentsCount > 0 || (schedule.studentIds && schedule.studentIds.length > 0);

    if (hasLinkedStudents) {
      const confirmed = window.confirm(
        `ATENÇÃO: O cronograma "${schedule.name}" possui alunos vinculados.\n\n` +
        `Ao excluir, os alunos perderão o acesso a este cronograma, mas os dados de atividades e submissões NÃO serão perdidos.\n\n` +
        `Tem certeza absoluta que deseja excluir este cronograma?`
      );
      if (!confirmed) return;
    } else {
      const confirmed = window.confirm(`Tem certeza que deseja excluir o cronograma "${schedule.name}"?`);
      if (!confirmed) return;
    }

    try {
      if (deleteSchedule) {
        await deleteSchedule(schedule.id);
        alert('Cronograma excluído com sucesso.');
        refresh(); // Atualiza a lista após exclusão
      }
    } catch (err: any) {
      alert(`Erro ao excluir: ${err.message}`);
    }
  };

  // Calcular estatísticas
  const getScheduleStats = () => {
    const total = schedules.length;
    const active = schedules.filter(s => s.isActive).length;
    const categories = [...new Set(schedules.map(s => s.category))].length;
    const totalActivities = schedules.reduce((sum, s) => sum + (s.metadata.totalActivities || 0), 0);
    const totalWeeklyHours = schedules.reduce((sum, s) => sum + (s.metadata.estimatedWeeklyHours || 0), 0);

    return {
      total,
      active,
      categories,
      totalActivities,
      totalWeeklyHours,
      archived: total - active
    };
  };

  const stats = getScheduleStats();

  // Obter cor da categoria
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'therapeutic': return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'educational': return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'mixed': return 'text-purple-700 bg-purple-50 border-purple-200';
      default: return 'text-gray-700 bg-gray-50 border-gray-200';
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
      case 'therapeutic': return <FaChartLine className="w-4 h-4" />;
      case 'educational': return <FaFileAlt className="w-4 h-4" />;
      default: return <FaCalendarCheck className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="relative inline-block">
            <div className="w-16 h-16 border-4 border-blue-200 rounded-full"></div>
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
          </div>
          <p className="mt-4 text-gray-600 font-medium">Carregando cronogramas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Erro ao carregar</h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={refresh}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all duration-200 font-medium"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                <FaCalendarAlt className="w-7 h-7 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-1">Meus Cronogramas</h1>
                <p className="text-gray-600">Gerencie e organize seus programas terapêuticos e educacionais</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/professional/schedules/new"
                className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg transition-all duration-200 flex items-center gap-3"
              >
                <FaPlus className="w-4 h-4" />
                <span>Novo Cronograma</span>
              </Link>
            </div>
          </div>

          {/* Cards de Estatísticas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl border border-blue-200 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                  <div className="text-sm text-gray-500">Total</div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                  <FaCalendarAlt className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-white to-amber-50 rounded-2xl border border-amber-200 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-gray-900">{stats.categories}</div>
                  <div className="text-sm text-gray-500">Categorias</div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center">
                  <FaTags className="w-5 h-5 text-amber-600" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-white to-purple-50 rounded-2xl border border-purple-200 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-gray-900">{stats.totalActivities}</div>
                  <div className="text-sm text-gray-500">Atividades</div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
                  <FaListOl className="w-5 h-5 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-white to-indigo-50 rounded-2xl border border-indigo-200 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-gray-900">{Math.round(stats.totalWeeklyHours)}h</div>
                  <div className="text-sm text-gray-500">Horas/sem</div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center">
                  <FaClock className="w-5 h-5 text-indigo-600" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros e Busca */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
            {/* Busca */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FaSearch className="w-4 h-4 text-gray-500" />
                <label className="text-sm font-medium text-gray-700">Buscar</label>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-700 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Buscar cronogramas..."
                />
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>

            {/* Filtro de Status */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FaFilter className="w-4 h-4 text-gray-500" />
                <label className="text-sm font-medium text-gray-700">Status</label>
              </div>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Todos os status</option>
                <option value="active">Somente ativos</option>
                <option value="archived">Somente arquivados</option>
              </select>
            </div>

            {/* Filtro de Categoria */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FaTags className="w-4 h-4 text-gray-500" />
                <label className="text-sm font-medium text-gray-700">Categoria</label>
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Todas as categorias</option>
                <option value="therapeutic">Terapêutico</option>
                <option value="educational">Educacional</option>
                <option value="mixed">Misto</option>
              </select>
            </div>

            {/* Ordenação */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FaSort className="w-4 h-4 text-gray-500" />
                <label className="text-sm font-medium text-gray-700">Ordenar por</label>
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="date">Data de criação</option>
                <option value="name">Nome</option>
                <option value="activities">Nº de atividades</option>
              </select>
            </div>
          </div>

          {/* Status dos Filtros */}
          <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
            {search && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 text-sm rounded-full border border-blue-200">
                <span>Busca: "{search}"</span>
                <button onClick={() => setSearch('')} className="text-blue-500 hover:text-blue-700">
                  &times;
                </button>
              </div>
            )}

            {filter !== 'all' && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-sm rounded-full border border-emerald-200">
                <span>Status: {filter === 'active' ? 'Ativos' : 'Arquivados'}</span>
                <button onClick={() => setFilter('all')} className="text-emerald-500 hover:text-emerald-700">
                  &times;
                </button>
              </div>
            )}

            {categoryFilter !== 'all' && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-700 text-sm rounded-full border border-purple-200">
                <span>Categoria: {getCategoryLabel(categoryFilter)}</span>
                <button onClick={() => setCategoryFilter('all')} className="text-purple-500 hover:text-purple-700">
                  &times;
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Lista de Cronogramas */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Header da Tabela */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Cronogramas ({filteredSchedules.length})</h2>
              <div className="text-sm text-gray-500">
                Mostrando {filteredSchedules.length} de {schedules.length}
              </div>
            </div>
          </div>

          {filteredSchedules.length === 0 ? (
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl mb-6">
                <FaCalendarAlt className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                {search || filter !== 'all' || categoryFilter !== 'all'
                  ? 'Nenhum cronograma encontrado'
                  : 'Nenhum cronograma criado'}
              </h3>
              <p className="text-gray-500 max-w-md mx-auto mb-6">
                {search || filter !== 'all' || categoryFilter !== 'all'
                  ? 'Tente ajustar seus filtros de busca'
                  : 'Comece criando seu primeiro cronograma personalizado'}
              </p>
              <Link
                href="/professional/schedules/new"
                className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg transition-all duration-200"
              >
                <FaPlus />
                Criar Primeiro Cronograma
              </Link>
            </div>
          ) : (
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredSchedules.map((schedule) => (
                  <div key={schedule.id} className="border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow duration-300">
                    {/* Cabeçalho do Cronograma */}
                    <div className="p-6 bg-gradient-to-r from-gray-50 to-white">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-4">
                          <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${schedule.category === 'therapeutic' ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
                              schedule.category === 'educational' ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' :
                                'bg-gradient-to-br from-purple-500 to-purple-600'
                            }`}>
                            {getCategoryIcon(schedule.category)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-bold text-gray-900 text-lg truncate">
                                {schedule.name}
                              </h3>
                              <span className={`px-3 py-1 text-xs font-medium rounded-full ${getCategoryColor(schedule.category)}`}>
                                {getCategoryLabel(schedule.category)}
                              </span>
                            </div>

                            {schedule.description && (
                              <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                                {schedule.description}
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                              <div className="flex items-center gap-2">
                                <FaClock className="w-3.5 h-3.5 text-gray-400" />
                                <span>Criado em {new Date(schedule.createdAt).toLocaleDateString('pt-BR')}</span>
                              </div>

                              <div className="flex items-center gap-1">
                                <FaListOl className="w-3 h-3 text-gray-400" />
                                <span>{schedule.metadata.totalActivities || 0} atividades</span>
                              </div>

                              <div className="flex items-center gap-1">
                                <FaRegCalendarAlt className="w-3 h-3 text-gray-400" />
                                <span>{new Date(schedule.endDate).toLocaleDateString('pt-BR')}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Status e Metadados */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {!schedule.isActive ? (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-full">
                              <FaArchive className="w-3 h-3" />
                              <span>Arquivado</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 text-sm rounded-full">
                              <FaCheckCircle className="w-3 h-3" />
                              <span>Ativo</span>
                            </div>
                          )}

                          <div className="text-sm text-gray-500">
                            {schedule.metadata.estimatedWeeklyHours}h/semana
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Tags do cronograma */}
                          {schedule.metadata.tags && schedule.metadata.tags.slice(0, 2).map((tag: string, index: number) => (
                            <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Ações do Cronograma */}
                    <div className="bg-gray-50 p-4 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/professional/schedules/${schedule.id}`}
                            className="px-4 py-2 bg-white text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-2 text-sm font-medium"
                            title="Ver detalhes"
                          >
                            <FaEye className="w-3.5 h-3.5" />
                            <span>Ver</span>
                          </Link>

                          <Link
                            href={`/professional/schedules/${schedule.id}/assign`}
                            className={`px-4 py-2 bg-white border rounded-lg transition-colors flex items-center gap-2 text-sm font-medium ${new Date() > new Date(schedule.endDate)
                                ? 'text-gray-400 border-gray-200 cursor-not-allowed pointer-events-none opacity-50'
                                : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                              }`}
                            title={new Date() > new Date(schedule.endDate) ? 'Cronograma expirado' : 'Atribuir a alunos'}
                            aria-disabled={new Date() > new Date(schedule.endDate)}
                            {...(new Date() > new Date(schedule.endDate) && {
                              onClick: (e) => e.preventDefault(),
                              tabIndex: -1
                            })}
                          >
                            <FaUserFriends className="w-3.5 h-3.5" />
                            <span>Atribuir</span>
                          </Link>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleArchive(schedule.id, schedule.name)}
                            className="p-2 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors"
                            title={schedule.isActive ? 'Arquivar' : 'Restaurar'}
                          >
                            <FaArchive className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDelete(schedule)}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir Cronograma"
                          >
                            <FaTrash className="w-4 h-4" />
                          </button>

                          <button disabled
                            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Duplicar"
                          >
                            <FaCopy className="w-4 h-4" />
                          </button>

                          <button disabled
                            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Compartilhar"
                          >
                            <FaShare className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Paginação e Footer */}
          {filteredSchedules.length > 0 && (
            <div className="border-t border-gray-200 p-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-gray-500">
                  Mostrando {Math.min(filteredSchedules.length, 10)} de {filteredSchedules.length} cronogramas
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                    disabled
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    <span>Anterior</span>
                  </button>

                  <div className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium">
                    1
                  </div>

                  <button
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                    disabled
                  >
                    <span>Próxima</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Botão de Ação Flutuante para Mobile */}
        <div className="lg:hidden fixed bottom-6 right-6 z-10">
          <Link
            href="/professional/schedules/new"
            className="w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 flex items-center justify-center"
          >
            <FaPlus className="w-6 h-6" />
          </Link>
        </div>

        {/* Footer da Página */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-500">
            <div>
              Nexus Platform • Cronogramas • v2.1
            </div>
            <div className="flex items-center gap-4">
              <button className="text-gray-600 hover:text-blue-600 transition-colors">
                Exportar
              </button>
              <button className="text-gray-600 hover:text-blue-600 transition-colors">
                Relatórios
              </button>
              <Link href="/professional/settings" className="text-gray-600 hover:text-blue-600 transition-colors">
                Configurações
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}