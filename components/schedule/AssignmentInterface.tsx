// components/schedule/AssignmentInterface.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { AssignScheduleDTO } from '@/types/schedule';
import { Student } from '@/types/auth';
import { useScheduleAssignment } from '@/hooks/useScheduleAssignment';
import { FaUser, FaCheck, FaExclamationTriangle, FaUsers, FaCalendarAlt } from 'react-icons/fa';
import { useAuth } from '@/context/AuthContext';
import { StudentService } from '@/lib/services/StudentService';

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

  // 🔥 LÓGICA AUTOMÁTICA: O estado de atribuição espelha o cronograma pai sem inputs extras
  const [assignmentData, setAssignmentData] = useState<AssignScheduleDTO>({
    studentIds: [],
    startDate: new Date(),
    endDate: new Date(),
    allowMultiple: true,
    customizations: {}
  });

  // Sincroniza as datas silenciosamente quando o cronograma carrega
  useEffect(() => {
    if (schedule) {
      console.log('🤖 [AUTO-SYNC] Aplicando datas do cronograma pai à atribuição:', {
        inicio: schedule.startDate?.toLocaleDateString(),
        fim: schedule.endDate?.toLocaleDateString()
      });
      setAssignmentData(prev => ({
        ...prev,
        startDate: schedule.startDate ? new Date(schedule.startDate) : new Date(),
        endDate: schedule.endDate ? new Date(schedule.endDate) : new Date()
      }));
    }
  }, [schedule]);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        await Promise.all([loadScheduleData(scheduleId), loadStudents()]);
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

    console.group('🚀 [SUBMIT AUTOMÁTICO]');
    console.log('📅 Usando vigência do cronograma:', assignmentData.startDate.toLocaleDateString(), 'até', assignmentData.endDate?.toLocaleDateString());
    
    try {
      setError(null);
      await assignSchedule(scheduleId, {
        ...assignmentData,
        studentIds: selectedStudents
      });
      console.log('✅ Atribuição concluída');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('❌ Erro:', err);
      setError(err.message || 'Erro ao atribuir');
    } finally {
      console.groupEnd();
    }
  };

  if (loading) return <div className="p-10 text-center">Carregando...</div>;

  return (
    <div className="space-y-6">
      {/* Resumo do Cronograma (Estilo Simples) */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{schedule?.name}</h2>
            <div className="flex gap-4 mt-1 text-sm text-gray-500 font-medium">
              <span className="flex items-center gap-1">
                <FaCalendarAlt className="text-indigo-500" />
                Vigência: {assignmentData.startDate.toLocaleDateString()} — {assignmentData.endDate?.toLocaleDateString()}
              </span>
            </div>
          </div>
          <div className="text-right">
             <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full uppercase">Datas Automáticas</span>
          </div>
        </div>
      </div>

      {/* Grid de Alunos (Visual original limpo) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {students.map(student => (
          <div 
            key={student.id}
            onClick={() => {
                const newSelection = selectedStudents.includes(student.id)
                    ? selectedStudents.filter(id => id !== student.id)
                    : [...selectedStudents, student.id];
                setSelectedStudents(newSelection);
            }}
            className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
              selectedStudents.includes(student.id) 
                ? 'border-indigo-600 bg-indigo-50/50' 
                : 'bg-white border-gray-100 hover:border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <FaUser className="text-gray-400" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">{student.name}</div>
                    <div className="text-xs text-gray-500">{student.profile.grade}</div>
                  </div>
               </div>
               <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                 selectedStudents.includes(student.id) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-200'
               }`}>
                 {selectedStudents.includes(student.id) && <FaCheck className="text-white text-[10px]" />}
               </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer Original */}
      <div className="flex items-center justify-between bg-white border border-gray-200 p-6 rounded-xl shadow-lg">
        <div className="text-gray-600">
           <span className="font-bold text-gray-900">{selectedStudents.length}</span> alunos selecionados
        </div>
        <div className="flex gap-3">
          {onCancel && (
            <button onClick={onCancel} className="px-6 py-2 text-gray-600 font-medium">Cancelar</button>
          )}
          <button
            onClick={handleSubmit}
            disabled={assigning || selectedStudents.length === 0}
            className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {assigning ? 'Atribuindo...' : 'Confirmar Atribuição'}
          </button>
        </div>
      </div>

      {error && <div className="text-red-600 font-bold text-sm bg-red-50 p-3 rounded-lg border border-red-100">{error}</div>}
    </div>
  );
}