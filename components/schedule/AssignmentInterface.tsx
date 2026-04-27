// components/schedule/AssignmentInterface.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { AssignScheduleDTO } from '@/types/schedule';
import { Student } from '@/types/auth';
import { useScheduleAssignment } from '@/hooks/useScheduleAssignment';
import { FaUser, FaCheck, FaExclamationTriangle, FaUsers, FaCalendarAlt, FaCheckCircle } from 'react-icons/fa';
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
        // Só chama onSuccess se pelo menos um aluno foi atribuído com sucesso
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

  if (loading) return <div className="p-10 text-center text-gray-500 font-medium">Carregando alunos e vigências...</div>;

  return (
    <div className="space-y-6">
      {/* Cabeçalho de Info - Estilo original e limpo */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 rounded-lg">
              <FaCalendarAlt className="text-indigo-600 w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{schedule?.name}</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Vigência automática: <span className="font-bold text-gray-700">{assignmentData.startDate.toLocaleDateString()}</span> até <span className="font-bold text-gray-700">{assignmentData.endDate?.toLocaleDateString()}</span>
              </p>
            </div>
          </div>
          <div className="hidden md:block">
             <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full uppercase tracking-tighter">Sincronizado</span>
          </div>
        </div>
      </div>

      {/* Grid de Alunos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {students.map(student => {
          const isSelected = selectedStudents.includes(student.id);
          return (
            <div 
              key={student.id}
              onClick={() => {
                  const newSelection = isSelected
                      ? selectedStudents.filter(id => id !== student.id)
                      : [...selectedStudents, student.id];
                  setSelectedStudents(newSelection);
              }}
              className={`p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                isSelected 
                  ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' 
                  : 'bg-white border-gray-100 hover:border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isSelected ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                      <FaUser className={isSelected ? 'text-indigo-600' : 'text-gray-400'} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-gray-900 truncate">{student.name}</div>
                      <div className="text-xs text-gray-500">{student.profile.grade || 'Série não inf.'}</div>
                    </div>
                 </div>
                 <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                   isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-200'
                 }`}>
                   {isSelected && <FaCheck className="text-white text-[10px]" />}
                 </div>
              </div>
            </div>
          );
        })}
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
              return (
                <li key={f.studentId}>
                  {student?.name || f.studentId}: {f.error}
                </li>
              );
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