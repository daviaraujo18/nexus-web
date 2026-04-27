// components/schedule/AssignmentInterface.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AssignScheduleDTO } from '@/types/schedule';
import { Student } from '@/types/auth';
import { useScheduleAssignment } from '@/hooks/useScheduleAssignment';
import {
  FaUser, FaCheck, FaExclamationTriangle, FaUsers, FaCalendarAlt,
  FaSearch, FaEye, FaEyeSlash, FaSchool, FaGraduationCap, FaGlobe,
  FaShieldAlt, FaUserTie, FaClock, FaChartBar
} from 'react-icons/fa';
import { TbFilter } from 'react-icons/tb';
import { useAuth } from '@/context/AuthContext';

interface StudentWithStatus extends Student {
  hasActiveInstance?: boolean;
  canReceiveSchedule: boolean;
  isAssignedToMe: boolean;
}

interface AssignmentInterfaceProps {
  scheduleId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function AssignmentInterface({ scheduleId, onSuccess, onCancel }: AssignmentInterfaceProps) {
  const { schedule, assigning, loadScheduleData, loadStudents, assignSchedule, students, userRole } = useScheduleAssignment();
  const { user } = useAuth();
  const isCoordinator = userRole === 'coordinator';

  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [partialResult, setPartialResult] = useState<{ ok: number; failed: Array<{ studentId: string; error: string }> } | null>(null);

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ search: '', grade: 'all', school: 'all' });
  const [grades, setGrades] = useState<string[]>(['all']);
  const [schools, setSchools] = useState<string[]>(['all']);

  // 🔥 LÓGICA AUTOMÁTICA: O estado de atribuição espelha o cronograma pai sem inputs extras
  const [assignmentData, setAssignmentData] = useState<AssignScheduleDTO>({
    studentIds: [],
    startDate: new Date(),
    endDate: new Date(),
    allowMultiple: true,
    customizations: {}
  });

  // 🤖 AUTO-SYNC: Sincroniza as datas silenciosamente quando o cronograma carrega
  useEffect(() => {
    if (schedule) {
      console.group('📅 [AUTO-SYNC ATRIBUIÇÃO]');
      console.log('📄 Cronograma:', schedule.name);
      console.log('🕒 Aplicando Início:', schedule.startDate ? new Date(schedule.startDate).toLocaleDateString() : 'N/A');
      console.log('🕒 Aplicando Fim:', schedule.endDate ? new Date(schedule.endDate).toLocaleDateString() : 'N/A');

      setAssignmentData(prev => ({
        ...prev,
        startDate: schedule.startDate ? new Date(schedule.startDate) : new Date(),
        endDate: schedule.endDate ? new Date(schedule.endDate) : new Date()
      }));
      console.groupEnd();
    }
  }, [schedule]);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        // Carrega cronograma primeiro para que loadStudents possa verificar instâncias ativas
        await loadScheduleData(scheduleId);
        await loadStudents();
      } catch (err: any) {
        console.error('❌ Erro ao inicializar Assignment:', err);
        setError('Falha ao carregar dados do cronograma.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [scheduleId]);

  useEffect(() => {
    if (students.length > 0) {
      const uniqueGrades = ['all', ...new Set(students.map(s => s.profile.grade).filter(Boolean))];
      const uniqueSchools = ['all', ...new Set(students.map(s => s.profile.school).filter(Boolean))];
      setGrades(uniqueGrades);
      setSchools(uniqueSchools);
    }
  }, [students]);

  const filteredStudents = useMemo((): StudentWithStatus[] => {
    const withStatus: StudentWithStatus[] = students.map(student => ({
      ...student,
      hasActiveInstance: (student as any).hasActiveInstance,
      canReceiveSchedule: !(student as any).hasActiveInstance,
      isAssignedToMe: isCoordinator || student.profile.assignedProfessionals?.includes(user?.id || '') || false,
    }));

    let filtered = withStatus;

    if (filters.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.profile.school?.toLowerCase().includes(q)
      );
    }
    if (filters.grade !== 'all') filtered = filtered.filter(s => s.profile.grade === filters.grade);
    if (filters.school !== 'all') filtered = filtered.filter(s => s.profile.school === filters.school);

    return filtered;
  }, [students, filters, isCoordinator, user?.id]);

  const handleStudentSelect = (studentId: string) => {
    setSelectedStudents(prev =>
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  const handleSelectAllAvailable = () => {
    const available = filteredStudents
      .filter(s => s.canReceiveSchedule && (isCoordinator || s.isAssignedToMe))
      .map(s => s.id);
    setSelectedStudents(available);
  };

  const handleDeselectAll = () => setSelectedStudents([]);

  const handleSubmit = async () => {
    if (selectedStudents.length === 0) {
      setError('Selecione pelo menos um aluno');
      return;
    }

    console.group('🚀 [SUBMIT ATRIBUIÇÃO]');
    console.log('📊 Alunos:', selectedStudents.length);
    console.log('📅 Início:', assignmentData.startDate.toLocaleDateString());
    console.log('📅 Fim:', assignmentData.endDate?.toLocaleDateString());

    try {
      setError(null);
      setPartialResult(null);
      const finalPayload: AssignScheduleDTO = {
        ...assignmentData,
        studentIds: selectedStudents
      };

      const result = await assignSchedule(scheduleId, finalPayload);
      console.log('✅ Resultado:', result);

      if (result.failed.length > 0) {
        setPartialResult({ ok: result.successful.length, failed: result.failed });
        if (result.successful.length > 0 && onSuccess) onSuccess();
      } else {
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      console.error('❌ Erro no Submit:', err);
      setError(err.message || 'Erro ao atribuir cronograma');
    } finally {
      console.groupEnd();
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="relative">
        <div className="w-20 h-20 border-4 border-indigo-100 rounded-full" />
        <div className="absolute top-0 left-0 w-20 h-20 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
      <p className="mt-4 text-gray-600 font-medium">Carregando alunos e vigências...</p>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Card de Informações do Cronograma */}
      <div className="bg-gradient-to-r from-white to-gray-50 rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-3 rounded-xl ${isCoordinator ? 'bg-gradient-to-r from-purple-100 to-pink-100' : 'bg-gradient-to-r from-indigo-100 to-blue-100'}`}>
                  {isCoordinator
                    ? <FaGlobe className="w-6 h-6 text-purple-600" />
                    : <FaUsers className="w-6 h-6 text-indigo-600" />
                  }
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {schedule ? schedule.name : 'Carregando cronograma...'}
                  </h2>
                  <p className="text-gray-600 mt-1">
                    {schedule?.description || 'Preparando informações do cronograma'}
                  </p>
                </div>
              </div>

              {schedule && (
                <div className="flex flex-wrap gap-4 mt-4">
                  <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full">
                    <FaCalendarAlt className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">{schedule.metadata?.totalActivities} atividades</span>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full">
                    <FaClock className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">{schedule.metadata?.estimatedWeeklyHours}h semanais</span>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full">
                    <FaChartBar className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">
                      {schedule.category === 'therapeutic' ? 'Terapêutico' :
                        schedule.category === 'educational' ? 'Educacional' : 'Misto'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-shrink-0 text-center">
              {isCoordinator ? (
                <>
                  <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full font-medium">
                    <FaShieldAlt className="w-4 h-4" />
                    Modo Coordenador
                  </span>
                  <p className="text-sm text-gray-500 mt-2">Acesso completo à plataforma</p>
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-full font-medium">
                    <FaUserTie className="w-4 h-4" />
                    Modo Profissional
                  </span>
                  <p className="text-sm text-gray-500 mt-2">Alunos atribuídos a você</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Painel de Filtros e Busca */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <TbFilter className="w-5 h-5 text-indigo-600" />
                Filtros e Busca
              </h3>
              <p className="text-gray-600 text-sm mt-1">Encontre alunos específicos usando filtros avançados</p>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
            >
              {showFilters ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
              <span className="text-sm font-medium">{showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}</span>
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FaSearch className="inline mr-2" />Buscar Alunos
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={filters.search}
                    onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Nome, email ou escola..."
                  />
                  <FaSearch className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FaGraduationCap className="inline mr-2" />Série/Ano
                </label>
                <select
                  value={filters.grade}
                  onChange={e => setFilters(prev => ({ ...prev, grade: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {grades.map(grade => (
                    <option key={grade} value={grade}>{grade === 'all' ? 'Todas as séries' : `Série ${grade}`}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FaSchool className="inline mr-2" />Escola
                </label>
                <select
                  value={filters.school}
                  onChange={e => setFilters(prev => ({ ...prev, school: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {schools.map(school => (
                    <option key={school} value={school}>{school === 'all' ? 'Todas as escolas' : school}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={handleSelectAllAvailable}
                disabled={filteredStudents.length === 0}
                className="px-5 py-3 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity font-medium flex items-center gap-2"
              >
                <FaCheck className="w-4 h-4" />
                Selecionar Todos Disponíveis
              </button>
              <button
                onClick={handleDeselectAll}
                className="px-5 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
              >
                Limpar Seleção
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lista de Alunos */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Alunos Disponíveis</h3>
          <p className="text-gray-600 text-sm mt-1">
            {selectedStudents.length > 0
              ? `${selectedStudents.length} aluno(s) selecionado(s)`
              : 'Selecione os alunos que receberão o cronograma'}
          </p>
        </div>

        <div className="p-6">
          {filteredStudents.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-6">
                <FaUser className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">Nenhum aluno encontrado</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                {filters.search || filters.grade !== 'all' || filters.school !== 'all'
                  ? 'Tente ajustar os filtros para encontrar mais alunos.'
                  : isCoordinator
                    ? 'Nenhum aluno cadastrado no sistema. Adicione alunos primeiro.'
                    : 'Nenhum aluno atribuído a você. Solicite atribuições ao coordenador.'}
              </p>
              {(filters.search || filters.grade !== 'all' || filters.school !== 'all') && (
                <button
                  onClick={() => setFilters({ search: '', grade: 'all', school: 'all' })}
                  className="mt-4 px-4 py-2 text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Limpar todos os filtros
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStudents.map(student => {
                const isSelected = selectedStudents.includes(student.id);
                const canBeSelected = isCoordinator || student.isAssignedToMe;

                return (
                  <div
                    key={student.id}
                    onClick={() => canBeSelected && handleStudentSelect(student.id)}
                    className={`group relative bg-gradient-to-br from-white to-gray-50 border rounded-2xl p-4 transition-all duration-300 hover:shadow-lg ${
                      isSelected
                        ? 'border-indigo-300 bg-indigo-50 ring-2 ring-indigo-100'
                        : 'border-gray-200'
                    } ${canBeSelected ? 'cursor-pointer hover:border-indigo-200' : 'opacity-70'}`}
                  >
                    <div className="absolute top-4 right-4 z-10">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          if (!canBeSelected) {
                            setError('Você só pode selecionar alunos sob sua responsabilidade');
                            return;
                          }
                          handleStudentSelect(student.id);
                        }}
                        disabled={!canBeSelected}
                        className={`h-5 w-5 rounded border-gray-300 focus:ring-2 focus:ring-indigo-500 ${
                          isSelected ? 'text-indigo-600 border-indigo-600' : ''
                        } ${!canBeSelected ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                      />
                    </div>

                    <div className="flex items-start gap-4 mb-4">
                      <div className={`flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center ${
                        student.isAssignedToMe ? 'bg-gradient-to-br from-indigo-100 to-blue-100' : 'bg-gray-100'
                      }`}>
                        <FaUser className={`w-7 h-7 ${student.isAssignedToMe ? 'text-indigo-600' : 'text-gray-600'}`} />
                      </div>

                      <div className="flex-1 min-w-0 pr-8">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-gray-900 truncate">{student.name}</h4>
                          {student.hasActiveInstance && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full flex-shrink-0">
                              <FaExclamationTriangle className="w-3 h-3" />
                              Ativo
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-gray-600 truncate mb-2">{student.email}</p>

                        <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                          {student.profile.school && (
                            <span className="flex items-center gap-1">
                              <FaSchool className="w-3 h-3" />
                              {student.profile.school}
                            </span>
                          )}
                          {student.profile.grade && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <FaGraduationCap className="w-3 h-3" />
                                {student.profile.grade}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {!isCoordinator && !student.isAssignedToMe && (
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-xs text-amber-800 flex items-start gap-2">
                          <FaExclamationTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span>
                            Este aluno não está sob sua responsabilidade.{' '}
                            <span className="font-medium">Apenas coordenadores podem atribuir.</span>
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer Ações */}
      <div className="flex flex-col sm:flex-row items-center justify-between bg-white border border-gray-200 p-6 rounded-2xl shadow-xl gap-4">
        <div className="flex items-center gap-2 text-gray-600">
          <FaUsers className="text-gray-400" />
          <span className="font-bold text-gray-900">{selectedStudents.length}</span> alunos selecionados
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={assigning}
              className="flex-1 sm:flex-none px-6 py-3 text-gray-600 font-bold hover:bg-gray-50 rounded-xl transition-colors"
            >
              Cancelar
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={assigning || selectedStudents.length === 0}
            className="flex-1 sm:flex-none bg-indigo-600 text-white px-10 py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-3 shadow-lg shadow-indigo-100"
          >
            {assigning ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Atribuindo...</span>
              </>
            ) : (
              'Confirmar Atribuição'
            )}
          </button>
        </div>
      </div>

      {partialResult && partialResult.failed.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-800 font-bold">
            <FaExclamationTriangle className="flex-shrink-0" />
            <span>
              {partialResult.ok > 0
                ? `${partialResult.ok} atribuído(s) com sucesso, mas ${partialResult.failed.length} falhou:`
                : `Falha ao atribuir ${partialResult.failed.length} aluno(s):`}
            </span>
          </div>
          <ul className="text-sm text-amber-700 space-y-1 pl-6 list-disc">
            {partialResult.failed.map(f => {
              const student = students.find(s => s.id === f.studentId);
              return <li key={f.studentId}>{student?.name || f.studentId}: {f.error}</li>;
            })}
          </ul>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 text-red-600 font-bold text-sm bg-red-50 p-4 rounded-xl border border-red-100 animate-in fade-in slide-in-from-top-2">
          <FaExclamationTriangle className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
