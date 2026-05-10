// hooks/useScheduleAssignment.ts - ATUALIZADO
'use client';

import { useState, useCallback } from 'react';
import { ScheduleInstanceService } from '@/lib/services/ScheduleInstanceService';
import { StudentService } from '@/lib/services/StudentService';
import { ScheduleService } from '@/lib/services/ScheduleService';
import { 
  AssignScheduleDTO, 
  ScheduleTemplate,
  ScheduleActivity 
} from '@/types/schedule';
import { Student, Professional } from '@/types/auth';
import { useAuth } from '@/context/AuthContext';
import { ActivityService } from '@/lib/services/ActivityService';

export function useScheduleAssignment() {
  const { user } = useAuth();
  const [assigning, setAssigning] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [schedule, setSchedule] = useState<ScheduleTemplate | null>(null);
  const [activities, setActivities] = useState<ScheduleActivity[]>([]);
  const [result, setResult] = useState<{
    successful: Array<{ studentId: string; instanceId: string }>;
    failed: Array<{ studentId: string; error: string }>;
  } | null>(null);

  /**
   * Carrega alunos baseado no role do profissional
   */
  const loadStudents = useCallback(async (filters?: {
    search?: string;
    grade?: string;
    school?: string;
  }, overrideScheduleId?: string) => {
    if (!user || user.role === 'student') {
      throw new Error('Apenas profissionais podem acessar esta função');
    }

    setLoadingStudents(true);
    try {
      const studentsData = await StudentService.getStudentsByProfessionalOrAll(
        user.id,
        user.role,
        {
          activeOnly: true,
          filters: {
            grade: filters?.grade,
            school: filters?.school
          }
        }
      );

      // Verificar quais alunos já têm cronograma ativo
      const effectiveScheduleId = overrideScheduleId ?? schedule?.id;
      const studentsWithStatus = await Promise.all(
        studentsData.map(async (student) => {
          let hasActiveInstance = false;
          if (effectiveScheduleId) {
            hasActiveInstance = await StudentService.hasActiveSchedule(
              student.id,
              effectiveScheduleId
            );
          }
          
          return {
            ...student,
            hasActiveInstance,
            canReceiveSchedule: !hasActiveInstance // Por padrão, não permitir múltiplos
          };
        })
      );
      
      setStudents(studentsWithStatus);
      return studentsWithStatus;
    } catch (error: any) {
      console.error('Erro ao carregar alunos:', error);
      throw error;
    } finally {
      setLoadingStudents(false);
    }
  }, [user]);

  /**
   * Carrega dados do cronograma
   */
  const loadScheduleData = useCallback(async (scheduleId: string) => {
    try {
      const scheduleData = await ScheduleService.getScheduleTemplate(scheduleId, true);
      setSchedule(scheduleData);
      
      const resolvedActivities = (scheduleData as any).activities
        ?? await ActivityService.listScheduleActivities(scheduleId);
      setActivities(resolvedActivities);

      return { schedule: scheduleData, activities: resolvedActivities };
    } catch (error: any) {
      console.error('Erro ao carregar dados do cronograma:', error);
      throw error;
    }
  }, []);

  /**
   * Atribui cronograma a alunos
   */
  const assignSchedule = useCallback(async (
    scheduleTemplateId: string,
    assignData: AssignScheduleDTO
  ) => {
    if (!user || user.role === 'student') {
      throw new Error('Apenas profissionais podem atribuir cronogramas');
    }

    // Verificar permissões para atribuir a alunos não atribuídos
    if (user.role !== 'coordinator') {
      // Para não-coordenadores, verificar se todos os alunos estão atribuídos a ele
      const allAssigned = await Promise.all(
        assignData.studentIds.map(async (studentId) => {
          const student = students.find(s => s.id === studentId)
            ?? await StudentService.getStudentById(studentId, user.id).catch(() => null);
          return student?.profile?.assignedProfessionals?.includes(user.id) ?? false;
        })
      );

      if (!allAssigned.every(Boolean)) {
        throw new Error('Você só pode atribuir cronogramas a alunos que estão sob sua responsabilidade');
      }
    }

    setAssigning(true);
    try {
      const assignmentResult = await ScheduleInstanceService.assignScheduleToStudents(
        user.id,
        scheduleTemplateId,
        assignData
      );
      
      setResult(assignmentResult);
      return assignmentResult;
    } catch (error: any) {
      console.error('Erro ao atribuir cronograma:', error);
      throw error;
    } finally {
      setAssigning(false);
    }
  }, [user, students]);

  const clearResult = useCallback(() => {
    setResult(null);
  }, []);

  const refreshStudents = useCallback(() => {
    return loadStudents(undefined, schedule?.id);
  }, [loadStudents, schedule?.id]);

  return {
    // Estados
    assigning,
    loadingStudents,
    students,
    schedule,
    activities,
    result,

    // Ações
    loadStudents,
    loadScheduleData,
    assignSchedule,
    clearResult,
    refreshStudents,
    
    // Utilitários
    hasResult: result !== null,
    totalStudents: students.length,
    selectedSchedule: schedule,
    userRole: user?.role
  };
}