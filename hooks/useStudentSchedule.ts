// hooks/useStudentSchedule.ts
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ScheduleInstanceService } from '@/lib/services/ScheduleInstanceService';
import { ProgressService } from '@/lib/services/ProgressService';
import { ActivityProgress, ScheduleInstance } from '@/types/schedule';
import { useAuth } from '@/context/AuthContext';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { firestore } from '@/firebase/config';

export function useStudentSchedule() {
  const { user } = useAuth();
  const [instances, setInstances] = useState<ScheduleInstance[]>([]);
  const [instancesLoaded, setInstancesLoaded] = useState(false); // 🟢 A Verdadeira Luz Verde
  const [weekActivities, setWeekActivities] = useState<ActivityProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * 1. CARREGAR INSTÂNCIAS (Roda apenas 1 vez, na montagem do componente)
   */
  const fetchInstances = useCallback(async () => {
    if (!user?.id || user.role !== 'student') return;
    
    console.group('🔍 [HOOK] Auditoria Inicial de Instâncias');
    console.log(`⏳ Buscando instâncias ativas para: ${user.id}`);
    
    try {
      const active = await ScheduleInstanceService.getStudentActiveInstances(user.id);
      console.log(`📡 Instâncias legítimas baixadas do banco: ${active.length}`);
      setInstances(active); // Guarda no state oficial
    } catch (err) {
      console.error("❌ Falha ao buscar instâncias:", err);
      setError("Erro ao carregar instâncias ativas.");
    } finally {
      setInstancesLoaded(true); // Acende a luz verde APÓS os dados estarem no state
      console.groupEnd();
    }
  }, [user?.id, user?.role]);

  // Disparo Inicial
  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  /**
   * 2. LISTENER REAL-TIME COM TRAVA BLINDADA E JANELA AMPLIADA
   */
  useEffect(() => {
    // 🛑 A TRAVA: Se não tem usuário OU se as instâncias ainda não carregaram, MORRE AQUI.
    if (!user?.id || user.role !== 'student' || !instancesLoaded) {
      console.log('⏳ [REAL-TIME] Aguardando luz verde das instâncias...');
      return;
    }

    console.group('📡 [REAL-TIME] Iniciando Conexão com Firebase');
    
    // 🔥 CORREÇÃO: Usar a janela exata da semana ativa de cada instância
    const instanceWindows = new Map();
    instances.forEach(i => {
      let start: any = i.currentWeekStartDate;
      let end: any = i.currentWeekEndDate;
      if (start && typeof start.toDate === 'function') start = start.toDate();
      else if (!(start instanceof Date)) start = new Date(start);
      
      if (end && typeof end.toDate === 'function') end = end.toDate();
      else if (!(end instanceof Date)) end = new Date(end);
      
      if (start instanceof Date && !isNaN(start.getTime()) && end instanceof Date && !isNaN(end.getTime())) {
        const s = new Date(start);
        s.setHours(0, 0, 0, 0); // Exatamente meia-noite local
        const e = new Date(end);
        e.setHours(23, 59, 59, 999); // Exatamente fim do dia local
        instanceWindows.set(i.id, { start: s, end: e, weekNumber: i.currentWeekNumber });
      }
    });
    
    const validInstanceIds = new Set(instances.map(i => i.id));
    const hasActiveInstances = validInstanceIds.size > 0;
    console.log(`🛡️ [REAL-TIME] Validando atividades contra ${validInstanceIds.size} instâncias ativas.`);

    if (!hasActiveInstances) {
      console.log('ℹ️ [REAL-TIME] Sem instâncias ativas — weekActivities será vazio.');
      setWeekActivities([]);
      setError(null);
      setLoading(false);
      return;
    }

    const q = query(
      collection(firestore, 'activityProgress'),
      where('studentId', '==', user.id),
      where('isActive', '==', true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.group('📊 [SNAPSHOT EVENT] Dados do Firebase!');
      console.log(`📦 Lidos ${snapshot.size} documentos brutos.`);

      const filteredActivities: ActivityProgress[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const scheduledDate = data.scheduledDate?.toDate();

        if (!scheduledDate) return;

        const isLegit = hasActiveInstances && validInstanceIds.has(data.scheduleInstanceId);
        let isWithinWindow = false;
        
        if (isLegit) {
          const window = instanceWindows.get(data.scheduleInstanceId);
          if (window) {
            if (data.weekNumber !== undefined && window.weekNumber !== undefined) {
              isWithinWindow = data.weekNumber === window.weekNumber;
            } else {
              // Neutraliza problemas de fuso horário movendo a data alvo para o meio-dia (12:00) local
              // antes de verificar se pertence à semana exata, sem precisar alargar as bordas.
              const isUTCMidnight = scheduledDate.getUTCHours() === 0 && scheduledDate.getUTCMinutes() === 0;
              const intendedYear = isUTCMidnight ? scheduledDate.getUTCFullYear() : scheduledDate.getFullYear();
              const intendedMonth = isUTCMidnight ? scheduledDate.getUTCMonth() : scheduledDate.getMonth();
              const intendedDate = isUTCMidnight ? scheduledDate.getUTCDate() : scheduledDate.getDate();
              
              const safeActivityDate = new Date(intendedYear, intendedMonth, intendedDate, 12, 0, 0);
              isWithinWindow = safeActivityDate >= window.start && safeActivityDate <= window.end;
            }
          } else {
            isWithinWindow = true; // Fallback se não houver datas configuradas na instância
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
        } else {
          if (!isLegit) {
            console.log(`🚫 [ÓRFÃO] Barrado: "${data.activitySnapshot?.title || doc.id}" | instanceId=${data.scheduleInstanceId}`);
          } else {
            console.log(`📅 [FORA JANELA] Barrado: "${data.activitySnapshot?.title || doc.id}" | scheduledDate=${scheduledDate?.toISOString()} | weekNumber=${data.weekNumber} | status=${data.status}`);
          }
        }
      });

      filteredActivities.sort((a, b) => (a.scheduledDate?.getTime() || 0) - (b.scheduledDate?.getTime() || 0));

      // --- DIAGNÓSTICO COMPLETION RATE ---
      const byStatus = filteredActivities.reduce<Record<string, number>>((acc, a) => {
        acc[a.status] = (acc[a.status] || 0) + 1;
        return acc;
      }, {});
      console.log('[COMPLETION_RATE_DIAG] weekActivities por status:', byStatus);
      console.log('[COMPLETION_RATE_DIAG] IDs + status + scheduledDate:');
      filteredActivities.forEach(a => {
        console.log(`  id=${a.id} | status=${a.status} | dayOfWeek=${(a as any).dayOfWeek} | scheduledDate=${a.scheduledDate?.toISOString()}`);
      });
      // ------------------------------------

      console.log(`✨ [SUCESSO] ${filteredActivities.length} atividades limpas e prontas para a tela.`);
      setWeekActivities(filteredActivities);
      setLoading(false);
      setError(null);
      console.groupEnd();
    }, (err) => {
      console.error("❌ [FIREBASE ERROR]:", err.message);
      setError("Erro de sincronização.");
      setLoading(false);
    });

    console.groupEnd();
    
    return () => unsubscribe();
  }, [user?.id, user?.role, instancesLoaded, instances]); 

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