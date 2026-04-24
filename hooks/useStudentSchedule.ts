'use client';

import { useState, useEffect, useCallback } from 'react';
import { ScheduleInstanceService } from '@/lib/services/ScheduleInstanceService';
import { ProgressService } from '@/lib/services/ProgressService';
import { ScheduleInstance, ActivityProgress } from '@/types/schedule';
import { useAuth } from '@/context/AuthContext';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { firestore } from '@/firebase/config';

export function useStudentSchedule() {
  const { user } = useAuth();
  const [instances, setInstances] = useState<ScheduleInstance[]>([]);
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
  };
}