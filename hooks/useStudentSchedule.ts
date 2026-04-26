'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ScheduleInstanceService } from '@/lib/services/ScheduleInstanceService';
import { ProgressService } from '@/lib/services/ProgressService';
import { ActivityProgress, ScheduleInstance } from '@/types/schedule';
import { useAuth } from '@/context/AuthContext';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import { DateUtils } from '@/lib/utils/dateUtils';

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
   * 2. LISTENER REAL-TIME COM TRAVA BLINDADA
   */
  useEffect(() => {
    // 🛑 A TRAVA: Se não tem usuário OU se as instâncias ainda não carregaram, MORRE AQUI.
    if (!user?.id || user.role !== 'student' || !instancesLoaded) {
      console.log('⏳ [REAL-TIME] Aguardando luz verde das instâncias...');
      return;
    }

    console.group('📡 [REAL-TIME] Iniciando Conexão com Firebase');
    
    const now = new Date();
    const startOfWeek = DateUtils.getWeekStartDate(now);
    const endOfWeek = DateUtils.getWeekEndDate(now);
    
    const validInstanceIds = new Set(instances.map(i => i.id));
    console.log(`🛡️ O Firebase vai validar as atividades contra ${validInstanceIds.size} instâncias mães.`);

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

        const isLegit = validInstanceIds.has(data.scheduleInstanceId);
        const isWithinWeek = scheduledDate >= startOfWeek && scheduledDate <= endOfWeek;

        if (isLegit && isWithinWeek) {
          filteredActivities.push({
            id: doc.id,
            ...data,
            scheduledDate,
            startedAt: data.startedAt?.toDate(),
            completedAt: data.completedAt?.toDate(),
          } as ActivityProgress);
        } else {
          // Log reduzido para não floodar o console
          if (!isLegit) console.log(`🚫 [ÓRFÃO] Barrado (Sem instância mãe): ${data.activitySnapshot?.title || doc.id}`);
        }
      });

      filteredActivities.sort((a, b) => (a.scheduledDate?.getTime() || 0) - (b.scheduledDate?.getTime() || 0));

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
    
    // 👇 O PULO DO GATO: O useEffect agora depende do state 'instances'. 
    // Quando ele muda (ao terminar o fetch), o React injeta a lista certa no Firebase.
  }, [user?.id, user?.role, instancesLoaded, instances]); 

  /**
   * 3. FILTRO PARA HOJE
   */
  const todayActivities = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('pt-BR');
    return weekActivities.filter(a => a.scheduledDate?.toLocaleDateString('pt-BR') === todayStr);
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