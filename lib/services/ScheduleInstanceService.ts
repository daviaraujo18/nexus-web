// lib/services/ScheduleInstanceService.ts
import { 
  collection, doc, getDoc, getDocs, query, where, Timestamp, setDoc, 
  serverTimestamp, writeBatch, updateDoc 
} from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import { ScheduleInstance, ActivityProgress, AssignScheduleDTO } from '@/types/schedule';
import { DateUtils } from '@/lib/utils/dateUtils';
import { ScheduleService } from './ScheduleService';
import { ActivityService } from './ActivityService';

export class ScheduleInstanceService {
  private static readonly COLLECTIONS = {
    TEMPLATES: 'weeklySchedules',
    INSTANCES: 'scheduleInstances',
    PROGRESS: 'activityProgress'
  };

  private static toDateSafe(value: any): Date | null {
    if (!value) return null;

    if (value instanceof Date) {
      return new Date(value);
    }

    if (typeof value.toDate === 'function') {
      return value.toDate();
    }

    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  private static async getVisibleTemplateForStudent(
    templateId: string
  ): Promise<{ visible: boolean; data: any | null; reason?: string }> {
    const snap = await getDoc(doc(firestore, this.COLLECTIONS.TEMPLATES, templateId));

    if (!snap.exists()) {
      return { visible: false, data: null, reason: 'template-not-found' };
    }

    const t = snap.data();

    if (t.isDeleted === true) {
      return { visible: false, data: t, reason: 'isDeleted' };
    }
    if (t.isActive === false) {
      return { visible: false, data: t, reason: 'isActive-false' };
    }
    if (['archived', 'deleted', 'inactive'].includes(t.status)) {
      return { visible: false, data: t, reason: `status-${t.status}` };
    }

    if (t.endDate) {
      const endDate = this.toDateSafe(t.endDate);
      if (endDate) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const normalizedEndDate = new Date(endDate);
        normalizedEndDate.setHours(0, 0, 0, 0);

        if (normalizedEndDate < todayStart) {
          return { visible: false, data: t, reason: 'endDate-expired' };
        }
      }
    }

    return { visible: true, data: t };
  }

  /**
   * 🚀 [ATRIBUIÇÃO] Mantida a trava de segurança que estabelecemos
   */
  static async assignScheduleToStudents(
    professionalId: string,
    scheduleTemplateId: string,
    assignData: AssignScheduleDTO
  ): Promise<{ successful: any[]; failed: any[] }> {
    console.group(`🚀 [SERVICE] Atribuindo Template: ${scheduleTemplateId}`);
    try {
      const schedule = await ScheduleService.getScheduleTemplate(scheduleTemplateId);
      const successful = [];
      const failed = [];

      for (const studentId of assignData.studentIds) {
        try {
          const dateFromForm = assignData.startDate ? new Date(assignData.startDate) : null;
          const dateFromTemplate = schedule.startDate ? new Date(schedule.startDate) : null;
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          let startDate: Date;
          if (dateFromForm && dateFromForm >= today) {
            startDate = dateFromForm;
          } else if (dateFromTemplate && dateFromTemplate > today) {
            startDate = dateFromTemplate;
          } else {
            startDate = today;
          }
          
          startDate.setHours(0, 0, 0, 0);
          const instanceId = `${scheduleTemplateId}_${studentId.substring(0, 8)}_${Date.now()}`;
          const weekStart = DateUtils.getWeekStartDate(startDate);
          const weekEnd = DateUtils.getWeekEndDate(startDate);

          const instanceData = {
            scheduleTemplateId,
            scheduleName: schedule.name,
            studentId,
            professionalId,
            currentWeekNumber: 1,
            currentWeekStartDate: Timestamp.fromDate(weekStart),
            currentWeekEndDate: Timestamp.fromDate(weekEnd),
            status: 'active',
            startedAt: Timestamp.fromDate(startDate),
            isActive: true,
            isDeleted: false,
            progressCache: {
              completedActivities: 0,
              totalActivities: 0,
              completionPercentage: 0,
              streakDays: 0,
              totalPointsEarned: 0,
              lastUpdatedAt: serverTimestamp()
            },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };

          const existingSnap = await getDocs(query(
            collection(firestore, this.COLLECTIONS.INSTANCES),
            where('studentId', '==', studentId),
            where('scheduleTemplateId', '==', scheduleTemplateId),
            where('status', 'in', ['active', 'paused'])
          ));
          if (!existingSnap.empty) {
            failed.push({ studentId, error: 'Aluno já possui uma instância ativa deste cronograma.' });
            continue;
          }

          await setDoc(doc(firestore, this.COLLECTIONS.INSTANCES, instanceId), instanceData);
          console.log(`✅ [SUCESSO] Instância criada: ${instanceId}`);
          
          await this.generateWeekActivities(instanceId, 1);
          successful.push({ studentId, instanceId });
        } catch (err: any) {
          console.error(`❌ [ERRO] Falha no aluno ${studentId}:`, err);
          failed.push({ studentId, error: err.message });
        }
      }
      return { successful, failed };
    } finally { console.groupEnd(); }
  }

  /**
   * 🛠️ [GERAÇÃO ATIVIDADES]
   */
  static async generateWeekActivities(instanceId: string, weekNo: number) {
    console.log(`⚙️ [GENERATE] Gerando atividades para instância ${instanceId} (Semana ${weekNo})`);
    const snap = await getDoc(doc(firestore, this.COLLECTIONS.INSTANCES, instanceId));
    const inst = snap.data();
    if (!inst) {
      console.warn(`⚠️ [GENERATE] Instância ${instanceId} não encontrada.`);
      return;
    }

    const { visible, data: templateData, reason } = await this.getVisibleTemplateForStudent(inst.scheduleTemplateId);
    if (!visible) {
      console.warn(`⚠️ [GENERATE] Template ${inst.scheduleTemplateId} não visível (${reason}) — geração cancelada.`);
      return;
    }

    const templateEndDate: Date | null = (() => {
      const ed = this.toDateSafe(templateData?.endDate);
      if (!ed) return null;
      const isUTCMidnight = ed.getUTCHours() === 0 && ed.getUTCMinutes() === 0;
      const year = isUTCMidnight ? ed.getUTCFullYear() : ed.getFullYear();
      const month = isUTCMidnight ? ed.getUTCMonth() : ed.getMonth();
      const date = isUTCMidnight ? ed.getUTCDate() : ed.getDate();
      return new Date(Date.UTC(year, month, date, 23, 59, 59, 999));
    })();

    const activities = await ActivityService.listScheduleActivities(inst.scheduleTemplateId);
    const weekStartDate = inst.currentWeekStartDate.toDate();

    const existingSnap = await getDocs(query(
      collection(firestore, this.COLLECTIONS.PROGRESS),
      where('scheduleInstanceId', '==', instanceId),
      where('weekNumber', '==', weekNo)
    ));
    const existingIds = new Set(existingSnap.docs.map(d => d.id));

    const batch = writeBatch(firestore);
    let skipped = 0;
    let added = 0;

    for (const act of activities) {
      const activityDate = DateUtils.calculateActivityDate(weekStartDate, act.dayOfWeek);

      if (templateEndDate && activityDate > templateEndDate) {
        console.log(`📅 [GENERATE] "${act.title}" após endDate (${activityDate.toLocaleDateString()}) — ignorada.`);
        skipped++;
        continue;
      }

      const progressId = `${instanceId}_w${weekNo}_${act.id}`;
      if (existingIds.has(progressId)) {
        skipped++;
        continue;
      }
      batch.set(doc(firestore, this.COLLECTIONS.PROGRESS, progressId), {
        scheduleInstanceId: instanceId,
        activityId: act.id,
        studentId: inst.studentId,
        weekNumber: weekNo,
        dayOfWeek: act.dayOfWeek,
        activitySnapshot: act,
        status: 'pending',
        scheduledDate: Timestamp.fromDate(activityDate),
        scoring: { pointsEarned: 0, bonusPoints: 0, penaltyPoints: 0 },
        isActive: true,
        isDeleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      added++;
    }

    if (added > 0) {
      await batch.commit();
    }
    console.log(`✨ [GENERATE] ${added} atividades geradas, ${skipped} ignoradas (endDate ou já existentes).`);
  }

  static async getScheduleInstanceById(instanceId: string): Promise<ScheduleInstance> {
    const snap = await getDoc(doc(firestore, this.COLLECTIONS.INSTANCES, instanceId));
    if (!snap.exists()) throw new Error(`Instância ${instanceId} não encontrada`);
    const d = snap.data();
    return {
      id: snap.id,
      ...d,
      startedAt: d.startedAt?.toDate(),
      currentWeekStartDate: d.currentWeekStartDate?.toDate(),
      currentWeekEndDate: d.currentWeekEndDate?.toDate()
    } as ScheduleInstance;
  }

  static async getWeekProgress(instanceId: string, weekNumber: number): Promise<ActivityProgress[]> {
    const q = query(
      collection(firestore, this.COLLECTIONS.PROGRESS),
      where('scheduleInstanceId', '==', instanceId),
      where('weekNumber', '==', weekNumber),
      where('isActive', '==', true)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      scheduledDate: d.data().scheduledDate?.toDate()
    })) as ActivityProgress[];
  }

<<<<<<< HEAD
  static async updateProgressCache(instanceId: string, weekNumber: number): Promise<void> {
    const progress = await this.getWeekProgress(instanceId, weekNumber);
=======
  static async updateProgressCache(instanceId: string, weekNumber?: number): Promise<void> {
    let resolvedWeek = weekNumber;
    if (resolvedWeek === undefined) {
      const instSnap = await getDoc(doc(firestore, this.COLLECTIONS.INSTANCES, instanceId));
      if (!instSnap.exists()) return;
      resolvedWeek = instSnap.data().currentWeekNumber ?? 1;
    }
    const progress = await this.getWeekProgress(instanceId, resolvedWeek);
>>>>>>> 98fd75d (fixes)
    const total = progress.length;
    const completed = progress.filter(p => p.status === 'completed').length;
    const points = progress.reduce((sum, p) => sum + (p.scoring?.pointsEarned || 0), 0);
    await updateDoc(doc(firestore, this.COLLECTIONS.INSTANCES, instanceId), {
      'progressCache.totalActivities': total,
      'progressCache.completedActivities': completed,
      'progressCache.completionPercentage': total > 0 ? Math.round((completed / total) * 100) : 0,
      'progressCache.totalPointsEarned': points,
      'progressCache.lastUpdatedAt': serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  static async completeSchedule(instanceId: string): Promise<void> {
    await updateDoc(doc(firestore, this.COLLECTIONS.INSTANCES, instanceId), {
      status: 'completed',
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  /**
   * 🔍 [AUDITORIA] Getters filtrando instâncias órfãs (AGORA OTIMIZADO EM PARALELO)
   */
  static async getStudentActiveInstances(studentId: string, _options?: { includeProgress?: boolean; limit?: number }): Promise<ScheduleInstance[]> {
    console.group(`🔍 [SERVICE] Auditoria de Instâncias - Aluno: ${studentId}`);
    try {
      const q = query(
        collection(firestore, this.COLLECTIONS.INSTANCES), 
        where('studentId', '==', studentId), 
        where('isActive', '==', true), 
        where('status', '==', 'active')
      );
      
      console.log(`⏳ [SERVICE] Buscando documentos brutos na collection...`);
      const snap = await getDocs(q);
      console.log(`📦 [SERVICE] ${snap.size} instâncias brutas encontradas. Validando integridade...`);
      
      const validationPromises = snap.docs.map(async (instDoc) => {
        const inst = { id: instDoc.id, ...instDoc.data() } as any;

        try {
          const { visible, reason } = await this.getVisibleTemplateForStudent(inst.scheduleTemplateId);

          if (!visible) {
            console.log(`🗑️ [BLOQUEIO] Instância ignorada (${reason}): ${inst.id.substring(0, 12)}... template=${inst.scheduleTemplateId}`);
            return null;
          }

          return {
            ...inst,
            startedAt: inst.startedAt?.toDate(),
            currentWeekStartDate: inst.currentWeekStartDate?.toDate(),
            currentWeekEndDate: inst.currentWeekEndDate?.toDate()
          } as ScheduleInstance;
        } catch (error) {
          console.error(`❌ Erro ao validar template da instância ${inst.id}:`, error);
          return null;
        }
      });

      // Aguarda todas as validações terminarem na velocidade da luz
      const results = await Promise.all(validationPromises);
      
      // Filtra os nulos (as órfãs que descartamos)
      const validInstances = results.filter((inst): inst is ScheduleInstance => inst !== null);
      
      console.log(`✅ [RESULTADO] ${validInstances.length} instâncias legítimas de fato aprovadas.`);
      return validInstances;
    } catch (err) {
      console.error("❌ [ERRO CRÍTICO] Erro ao auditar instâncias:", err);
      return [];
    } finally { 
      console.groupEnd(); 
    }
  }

  /**
   * 📅 [FILTRO SEMANAL] Pente fino para não mostrar lixo na tela
   */
  static async getWeekActivities(studentId: string): Promise<ActivityProgress[]> {
    console.group(`📅 [SERVICE] Buscando Grade Semanal - Aluno: ${studentId}`);
    try {
      // Primeiro, pegamos apenas as instâncias que sobreviveram à auditoria de órfãos
      const active = await this.getStudentActiveInstances(studentId);
      const activeIds = active.map(i => i.id);

      if (activeIds.length === 0) {
        console.log('ℹ️ [SERVICE] Nenhuma instância ativa — retornando grade vazia.');
        return [];
      }

      const now = new Date();
      const start = DateUtils.getWeekStartDate(now);
      const end = DateUtils.getWeekEndDate(now);

      console.log(`🌐 [SERVICE] Janela Civil: ${start.toLocaleDateString()} a ${end.toLocaleDateString()}`);

      const q = query(
        collection(firestore, this.COLLECTIONS.PROGRESS),
        where('studentId', '==', studentId),
        where('isActive', '==', true)
      );

      const snap = await getDocs(q);
      const activities: ActivityProgress[] = [];

      snap.forEach(dDoc => {
        const data = dDoc.data();
        const scheduledDate = data.scheduledDate?.toDate();

        if (!scheduledDate) return;

        const isLegit = activeIds.includes(data.scheduleInstanceId);
        // VERIFICAÇÃO 2: A tarefa está dentro da semana civil atual?
        const isWithinRange = scheduledDate >= start && scheduledDate <= end;

        if (isLegit && isWithinRange && !data.isDeleted) {
          activities.push({ id: dDoc.id, ...data, scheduledDate } as ActivityProgress);
        } else {
          // Log para sabermos por que a tarefa sumiu (ou por que não sumiu)
          if (!isLegit) {
            console.log(`🚫 [BLOQUEIO ÓRFÃO] Tarefa bloqueada: [${data.activitySnapshot?.title || 'Sem título'}] | Instância: ${data.scheduleInstanceId.substring(0,8)}...`);
          } else if (!isWithinRange) {
            console.log(`⏭️ [BLOQUEIO DATA] Fora da semana: [${data.activitySnapshot?.title || 'Sem título'}] | Data: ${scheduledDate.toLocaleDateString('pt-BR')}`);
          }
        }
      });

      console.log(`🎯 [SERVICE] TOTAL FINAL NA GRADE: ${activities.length} atividades limpas.`);
      return activities;
    } catch (err) {
      console.error("❌ [ERRO CRÍTICO] Erro fatal no filtro semanal:", err);
      return [];
    } finally { 
      console.groupEnd(); 
    }
  }
}