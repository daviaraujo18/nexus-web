// hooks/useSchedules.ts
'use client';

import { useState, useCallback, useEffect } from 'react';
import { ScheduleService } from '@/lib/services/ScheduleService';
import { ScheduleCategory, ScheduleTemplate } from '@/types/schedule';
import { useAuth } from '@/context/AuthContext';

export function useSchedules(options: {
  category?: ScheduleCategory;
  activeOnly?: boolean;
  limit?: number;
} = {}) {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<ScheduleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSchedules = useCallback(async () => {
    if (!user || user.role === 'student') {
      setSchedules([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await ScheduleService.listProfessionalSchedules(
        user.id,
        { ...options, role: user.role }
      );
      setSchedules(data);
      setError(null);
    } catch (err: any) {
      console.error('Erro ao carregar cronogramas:', err);
      setError(err.message || 'Erro ao carregar cronogramas');
    } finally {
      setLoading(false);
    }
  }, [user, options.category, options.activeOnly, options.limit]);

  const createSchedule = useCallback(async (data: any) => {
    if (!user) throw new Error('Usuário não autenticado');
    
    try {
      const result = await ScheduleService.createScheduleTemplate(user.id, data);
      await loadSchedules(); // Recarregar lista
      return result;
    } catch (err: any) {
      throw err;
    }
  }, [user, loadSchedules]);

  const updateSchedule = useCallback(async (scheduleId: string, updates: any) => {
    if (!user) throw new Error('Usuário não autenticado');
    
    try {
      const newScheduleId = await ScheduleService.updateScheduleTemplate(
        scheduleId,
        user.id,
        updates
      );
      await loadSchedules();
      return newScheduleId;
    } catch (err: any) {
      throw err;
    }
  }, [user, loadSchedules]);

  const archiveSchedule = useCallback(async (scheduleId: string) => {
    if (!user) throw new Error('Usuário não autenticado');
    
    try {
      await ScheduleService.archiveSchedule(scheduleId, user.id, user.role);
      await loadSchedules();
      return true;
    } catch (err: any) {
      throw err;
    }
  }, [user, loadSchedules]);

  const deleteSchedule = useCallback(async (scheduleId: string) => {
    if (!user) throw new Error('Usuário não autenticado');
    
    try {
      // Chama o método no Service (que vamos criar a seguir)
      await ScheduleService.deleteSchedule(scheduleId, user.id);
      await loadSchedules(); // Recarrega a lista para remover o item da tela
      return true;
    } catch (err: any) {
      throw err;
    }
  }, [user, loadSchedules]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  return {
    schedules,
    loading,
    error,
    refresh: loadSchedules,
    createSchedule,
    updateSchedule,
    archiveSchedule,
    deleteSchedule, // <-- ADICIONADO AQUI
    hasSchedules: schedules.length > 0
  };
}