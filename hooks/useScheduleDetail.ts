// hooks/useScheduleDetail.ts
import { useState, useEffect, useCallback } from 'react';
import { 
  ScheduleTemplate, 
  ScheduleInstance, 
  ScheduleActivity,
  ActivityProgress 
} from '@/types/schedule';
import { ScheduleService } from '@/lib/services/ScheduleService';
import { ScheduleInstanceService } from '@/lib/services/ScheduleInstanceService';
import { ActivityService } from '@/lib/services/ActivityService';

interface UseScheduleDetailProps {
  scheduleId?: string;
  instanceId?: string;
  includeActivities?: boolean;
  includeProgress?: boolean;
}

interface UseScheduleDetailReturn {
  schedule: ScheduleTemplate | null;
  instance: ScheduleInstance | null;
  activities: ScheduleActivity[];
  progress: ActivityProgress[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useScheduleDetail({
  scheduleId,
  instanceId,
  includeActivities = true,
  includeProgress = true
}: UseScheduleDetailProps): UseScheduleDetailReturn {
  const [schedule, setSchedule] = useState<ScheduleTemplate | null>(null);
  const [instance, setInstance] = useState<ScheduleInstance | null>(null);
  const [activities, setActivities] = useState<ScheduleActivity[]>([]);
  const [progress, setProgress] = useState<ActivityProgress[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadSchedule = useCallback(async () => {
    if (!scheduleId && !instanceId) {
      setError('ID do cronograma não fornecido');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let instanceData: ScheduleInstance | null = null;

      if (instanceId) {
        // Carregar via instância
        instanceData = await ScheduleInstanceService.getScheduleInstanceById(instanceId);
        setInstance(instanceData);

        if (instanceData?.scheduleTemplateId) {
          const scheduleData = await ScheduleService.getScheduleTemplate(
            instanceData.scheduleTemplateId, 
            false // Não incluir atividades aqui, vamos carregar separadamente se necessário
          );
          setSchedule(scheduleData);

          if (includeActivities) {
            const activitiesData = await ActivityService.listScheduleActivities(instanceData.scheduleTemplateId);
            setActivities(activitiesData);
          }
        }
      } else if (scheduleId) {
        // Carregar apenas o template
        const scheduleData = await ScheduleService.getScheduleTemplate(scheduleId, false);
        setSchedule(scheduleData);

        if (includeActivities) {
          const activitiesData = await ActivityService.listScheduleActivities(scheduleId);
          setActivities(activitiesData);
        }
      }

      if (includeProgress && instanceId && instanceData) {
        try {
          const weekNumber = instanceData.currentWeekNumber ?? 1;
          const progressData = await ScheduleInstanceService.getWeekProgress(instanceId, weekNumber);
          setProgress(progressData);
        } catch (progressError) {
          console.warn('Erro ao carregar progresso:', progressError);
          setProgress([]);
        }
      }

    } catch (err: any) {
      console.error('Erro ao carregar cronograma:', err);
      setError(err.message || 'Erro ao carregar cronograma');
    } finally {
      setLoading(false);
    }
  }, [scheduleId, instanceId, includeActivities, includeProgress]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  return {
    schedule,
    instance,
    activities,
    progress,
    loading,
    error,
    refresh: loadSchedule
  };
}