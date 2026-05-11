// hooks/useStudentSchedule.ts
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ScheduleInstanceService } from '@/lib/services/ScheduleInstanceService';
import { ProgressService } from '@/lib/services/ProgressService';
import { ActivityProgress, ScheduleInstance } from '@/types/schedule';
import { useAuth } from '@/context/AuthContext';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { firestore } from '@/firebase/config';

export function useStudentSchedule() {
  const { user } = useAuth();
  const [instances, setInstances] = useState<ScheduleInstance[]>([]);
  const instancesRef = useRef<ScheduleInstance[]>([]);
  const [instancesLoaded, setInstancesLoaded] = useState(false);
  const instancesLoadedRef = useRef(false);
  const effectIdRef = useRef(0);
  const [weekActivities, setWeekActivities] = useState<ActivityProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * 1. CARREGAR INSTÂNCIAS — reativo via onSnapshot em scheduleInstances.
   *    Quando uma instância muda (delete/archive seta isActive=false),
   *    re-valida contra o template (endDate, isDeleted etc.) e atualiza o state.
   */
  useEffect(() => {
    if (!user?.id || user.role !== 'student') return;

    // Reset completo ao trocar de usuário — evita exibir dados do ciclo anterior
    setInstances([]);
    setInstancesLoaded(false);
    instancesLoadedRef.current = false;
    setWeekActivities([]);
    setLoading(true);
    setError(null);

    const myEffectId = ++effectIdRef.current;
    const userId = user.id;

    // Variáveis de closure locais a esta invocação do effect — completamente isoladas
    // de qualquer invocação anterior (resolve race condition na troca de usuário)
    let cancelled = false;
    let validating = false;
    let pending = false;

    const validate = async () => {
      if (cancelled) return;
      if (validating) {
        pending = true;
        return;
      }
      validating = true;
      try {
        const active = await ScheduleInstanceService.getStudentActiveInstances(userId);
        if (cancelled) return;
        setInstances(active);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        console.error('❌ Falha ao re-validar instâncias:', err);
        setError('Erro ao carregar instâncias ativas.');
        setWeekActivities([]);
        setLoading(false);
      } finally {
        validating = false;
        // Só sinaliza "loaded" se esta invocação ainda é a ativa E não foi cancelada —
        // impede que validate() de componente desmontado contamine o ref para a próxima montagem
        if (!cancelled && myEffectId === effectIdRef.current) {
          instancesLoadedRef.current = true;
          setInstancesLoaded(true);
        }
        if (cancelled) return;
        if (pending) {
          pending = false;
          validate();
        }
      }
    };

    const q = query(
      collection(firestore, 'scheduleInstances'),
      where('studentId', '==', userId),
      where('isActive', '==', true),
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(q, validate, (err) => {
      if (cancelled) return;
      console.error('❌ [INSTANCES SNAPSHOT] Erro:', err.message);
      setError('Erro de sincronização.');
      setWeekActivities([]);
      setLoading(false);
      instancesLoadedRef.current = true;
      setInstancesLoaded(true);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user?.id, user?.role]);

  const fetchInstances = useCallback(async () => {
    if (!user?.id || user.role !== 'student') return;
    const capturedId = user.id;
    try {
      const active = await ScheduleInstanceService.getStudentActiveInstances(capturedId);
      if (user?.id !== capturedId) return;
      setInstances(active);
    } catch (err) {
      console.error('❌ Falha ao buscar instâncias:', err);
    }
  }, [user?.id, user?.role]);

  // Mantém instancesRef sempre atualizado sem recriar o listener de atividades
  useEffect(() => {
    instancesRef.current = instances;
  }, [instances]);

  /**
   * 2. LISTENER REAL-TIME — abre uma vez por usuário, lê instancesRef no callback
   *    para filtrar sem precisar fechar/reabrir a conexão quando instâncias mudam.
   */
  useEffect(() => {
    if (!user?.id || user.role !== 'student' || !instancesLoadedRef.current) return;

    const q = query(
      collection(firestore, 'activityProgress'),
      where('studentId', '==', user.id),
      where('isActive', '==', true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Lê sempre o snapshot mais recente das instâncias (ref atualizado sem recriar listener)
      const currentInstances = instancesRef.current;
      const validInstanceIds = new Set(currentInstances.map(i => i.id));
      const hasActiveInstances = validInstanceIds.size > 0;

      if (!hasActiveInstances) {
        setWeekActivities([]);
        setError(null);
        setLoading(false);
        return;
      }

      const instanceWindows = new Map<string, { start: Date; end: Date; weekNumber: number }>();
      currentInstances.forEach(i => {
        let start: any = i.currentWeekStartDate;
        let end: any = i.currentWeekEndDate;
        if (start && typeof start.toDate === 'function') start = start.toDate();
        else if (!(start instanceof Date)) start = start ? new Date(start) : null;
        if (end && typeof end.toDate === 'function') end = end.toDate();
        else if (!(end instanceof Date)) end = end ? new Date(end) : null;
        if (start instanceof Date && !isNaN(start.getTime()) && end instanceof Date && !isNaN(end.getTime())) {
          const s = new Date(start); s.setHours(0, 0, 0, 0);
          const e = new Date(end); e.setHours(23, 59, 59, 999);
          instanceWindows.set(i.id, { start: s, end: e, weekNumber: i.currentWeekNumber });
        }
      });

      const filteredActivities: ActivityProgress[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const scheduledDate = data.scheduledDate?.toDate();
        if (!scheduledDate) return;

        const isLegit = validInstanceIds.has(data.scheduleInstanceId);
        let isWithinWindow = false;

        if (isLegit) {
          const window = instanceWindows.get(data.scheduleInstanceId);
          if (window) {
            if (data.weekNumber !== undefined && window.weekNumber !== undefined) {
              isWithinWindow = data.weekNumber === window.weekNumber;
            } else {
              const isUTCMidnight = scheduledDate.getUTCHours() === 0 && scheduledDate.getUTCMinutes() === 0;
              const intendedYear = isUTCMidnight ? scheduledDate.getUTCFullYear() : scheduledDate.getFullYear();
              const intendedMonth = isUTCMidnight ? scheduledDate.getUTCMonth() : scheduledDate.getMonth();
              const intendedDate = isUTCMidnight ? scheduledDate.getUTCDate() : scheduledDate.getDate();
              const safeActivityDate = new Date(intendedYear, intendedMonth, intendedDate, 12, 0, 0);
              isWithinWindow = safeActivityDate >= window.start && safeActivityDate <= window.end;
            }
          }
        }

        if (isLegit && isWithinWindow) {
          filteredActivities.push({
            id: doc.id,
            ...data,
            scheduledDate,
            startedAt: data.startedAt?.toDate(),
            completedAt: data.completedAt?.toDate(),
          } as ActivityProgress);
        }
      });

      filteredActivities.sort((a, b) => (a.scheduledDate?.getTime() || 0) - (b.scheduledDate?.getTime() || 0));
      setWeekActivities(filteredActivities);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error("❌ [FIREBASE ERROR]:", err.message);
      setError("Erro de sincronização.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.id, user?.role, instancesLoaded]);

  /**
   * 3. FILTRO PARA HOJE BLINDADO (MATEMÁTICA PURA)
   */
  const todayActivities = useMemo(() => {
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    // JS getDay(): 0=Dom, 1=Seg ... Schedule dayOfWeek: 0=Seg, 1=Ter ...
    // Conversão: (jsDay + 6) % 7
    const scheduleDayOfWeek = (now.getDay() + 6) % 7;

    return weekActivities.filter(a => {
      if (a.dayOfWeek !== undefined) {
        return a.dayOfWeek === scheduleDayOfWeek;
      }

      if (!a.scheduledDate) return false;
      
      let d = a.scheduledDate;
      if (typeof (d as any).toDate === 'function') d = (d as any).toDate();
      else if (!(d instanceof Date)) d = new Date(d);

      if (isNaN(d.getTime())) return false;

      // Detecta se a data foi salva como UTC Midnight (00:00:00Z)
      const isUTCMidnight = d.getUTCHours() === 0 && d.getUTCMinutes() === 0;
      
      let dateStr = '';
      if (isUTCMidnight) {
        dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      } else {
        dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
      
      return dateStr === localToday;
    });
  }, [weekActivities]);

  const totalTodayActivities = useMemo(() => todayActivities.length, [todayActivities]);

  /**
   * 4. AÇÕES
   */
  const startActivity = useCallback(async (id: string) => {
    if (!user?.id) return;
    try { await ProgressService.startActivity(id, user.id); } 
    catch (err) { console.error("❌ Erro ao startar:", err); }
  }, [user?.id]);

  const completeActivity = useCallback(async (id: string, data?: any) => {
    if (!user?.id) return;
    try { await ProgressService.completeActivity(id, user.id, data); } 
    catch (err) { console.error("❌ Erro ao completar:", err); }
  }, [user?.id]);

  return {
    instances,
    weekActivities,
    todayActivities,
    totalTodayActivities,
    loading,
    error,
    refresh: fetchInstances,
    startActivity,
    completeActivity
  };
}