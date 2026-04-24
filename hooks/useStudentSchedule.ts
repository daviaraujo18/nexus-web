'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ScheduleInstanceService } from '@/lib/services/ScheduleInstanceService';
import { ActivityProgress, ScheduleInstance } from '@/types/schedule';
import { useAuth } from '@/context/AuthContext';
<<<<<<< HEAD
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { firestore } from '@/firebase/config';
=======
>>>>>>> fcbeaae (lógica calendário civil estabelecida)

export function useStudentSchedule() {
  const { user } = useAuth();
  const [instances, setInstances] = useState<ScheduleInstance[]>([]);
<<<<<<< HEAD
  const [todayActivities, setTodayActivities] = useState<ActivityProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. CARREGAR INSTÂNCIAS ATIVAS
  useEffect(() => {
    if (!user || user.role !== 'student') return;

    const fetchInstances = async () => {
      try {
        const active = await ScheduleInstanceService.getStudentActiveInstances(user.id);
        setInstances(active);
      } catch (err) {
        console.error("❌ Erro ao buscar instâncias:", err);
      }
    };

    fetchInstances();
  }, [user]);

  // 2. LISTENER EM TEMPO REAL (SEM DEPENDÊNCIA DE ÍNDICE COMPOSTO)
  useEffect(() => {
    if (!user || user.role !== 'student') {
      setLoading(false);
      return;
    }

    setLoading(true);
    console.log('📡 [FIREBASE] Conectando ao banco de PRODUÇÃO...');

    // Query simplificada para evitar erro de "Failed Precondition" (falta de índice)
    const q = query(
      collection(firestore, 'activityProgress'),
      where('studentId', '==', user.id),
      where('isActive', '==', true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log('📊 [DEBUG] Documentos brutos no Firestore:', snapshot.size);
      
      const allProgress: ActivityProgress[] = [];
      const now = new Date();
      
      // Ajuste técnico: Se for antes das 4h da manhã, ainda consideramos "hoje" como o dia anterior
      // Isso evita que o fuso horário UTC do Firebase pule o dia prematuramente
      const offset = now.getHours() < 4 ? 1 : 0;
      const adjustDate = new Date(now.getTime() - (offset * 24 * 60 * 60 * 1000));
      const todayStr = adjustDate.toISOString().split('T')[0]; 

      snapshot.forEach((doc) => {
        const data = doc.data();
        const scheduledDate = data.scheduledDate?.toDate();
        const scheduledDateStr = scheduledDate?.toISOString().split('T')[0];

        // Filtro de data no lado do cliente (mais seguro e rápido)
        if (scheduledDateStr === todayStr) {
          allProgress.push({
            id: doc.id,
            ...data,
            scheduledDate,
            startedAt: data.startedAt?.toDate(),
            completedAt: data.completedAt?.toDate(),
          } as ActivityProgress);
        }
      });

      // Ordenação manual por data de criação/atualização
      allProgress.sort((a, b) => {
        const dateA = a.updatedAt?.seconds || 0;
        const dateB = b.updatedAt?.seconds || 0;
        return dateB - dateA;
      });

      setTodayActivities(allProgress);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error("❌ [FIREBASE ERROR]:", err.message);
      setError("Erro ao sincronizar dados em tempo real.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // 3. AÇÕES (START / COMPLETE)
  const startActivity = useCallback(async (id: string) => {
    if (!user?.id) return;
    await ProgressService.startActivity(id, user.id);
    // O onSnapshot cuidará do refresh da UI automaticamente
  }, [user?.id]);

  const completeActivity = useCallback(async (id: string, data?: any) => {
    if (!user?.id) return;
    await ProgressService.completeActivity(id, user.id, data);
  }, [user?.id]);

  return {
    instances,
    todayActivities,
    loading,
    error,
    refresh: () => {}, // Agora é real-time, não precisa de refresh manual
    startActivity,
    completeActivity,
    totalTodayActivities: todayActivities.length
=======
  const [weekActivities, setWeekActivities] = useState<ActivityProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.id) {
      console.log('⚠️ [HOOK] Abortando loadData: Usuário não autenticado.');
      return;
    }
    
    console.log(`🚀 [HOOK] Iniciando carregamento para: ${user.id} às ${new Date().toLocaleTimeString()}`);
    
    try {
      setLoading(true);
      
      // Busca instâncias com auditoria interna
      const activeInstances = await ScheduleInstanceService.getStudentActiveInstances(user.id);
      
      // Busca atividades agregadas da semana
      const activities = await ScheduleInstanceService.getWeekActivities(user.id);

      console.log('✨ [HOOK] Carga finalizada com sucesso:', {
        instanciasAtivas: activeInstances.length,
        totalAtividadesSemana: activities.length
      });

      setInstances(activeInstances);
      setWeekActivities(activities);
      setError(null);
    } catch (err: any) {
      console.error('❌ [HOOK] Erro fatal na carga de dados:', err);
      setError(err.message || 'Erro ao carregar cronograma');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtro para Hoje (usado no Sidebar e Dashboard)
  const todayActivities = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('pt-BR');
    const filtered = weekActivities.filter(a => 
      a.scheduledDate?.toLocaleDateString('pt-BR') === todayStr
    );
    console.log(`📅 [MEMO] Calculando todayActivities para ${todayStr}: ${filtered.length} encontradas.`);
    return filtered;
  }, [weekActivities]);

  // 🔥 FIX: Adicionando campo totalTodayActivities exigido pelo StudentSidebar
  const totalTodayActivities = useMemo(() => todayActivities.length, [todayActivities]);

  return { 
    instances, 
    todayActivities, 
    weekActivities, 
    totalTodayActivities, // Retorno garantido para o Sidebar
    loading, 
    error,
    refresh: loadData 
>>>>>>> fcbeaae (lógica calendário civil estabelecida)
  };
}