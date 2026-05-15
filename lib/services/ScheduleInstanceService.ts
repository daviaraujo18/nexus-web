// lib/services/ScheduleInstanceService.ts
import { 
  collection, doc, getDoc, getDocs, query, where, Timestamp, setDoc, 
  serverTimestamp, writeBatch, updateDoc, deleteDoc, runTransaction
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
        const isUTCMidnight = endDate.getUTCHours() === 0 && endDate.getUTCMinutes() === 0;
        const year = isUTCMidnight ? endDate.getUTCFullYear() : endDate.getFullYear();
        const month = isUTCMidnight ? endDate.getUTCMonth() : endDate.getMonth();
        const date = isUTCMidnight ? endDate.getUTCDate() : endDate.getDate();
        const normalizedEndDate = new Date(year, month, date, 0, 0, 0, 0);

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

      const parseDateLocal = (s: string | Date): Date => {
        if (typeof s === 'string') {
          const [y, m, d] = s.split('-').map(Number);
          return new Date(y, m - 1, d);
        }
        return new Date(s);
      };

      for (const studentId of assignData.studentIds) {
        try {
          const dateFromForm = assignData.startDate ? parseDateLocal(assignData.startDate) : null;
          const dateFromTemplate = schedule.startDate ? parseDateLocal(schedule.startDate) : null;
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          let startDate: Date;
          if (dateFromForm && dateFromForm >= today) {
            startDate = dateFromForm;
          } else if (dateFromTemplate && dateFromTemplate >= today) {
            startDate = dateFromTemplate;
          } else {
            startDate = today;
          }
          
          startDate.setHours(0, 0, 0, 0);
          const uniqueSuffix = doc(collection(firestore, this.COLLECTIONS.INSTANCES)).id;
          const instanceId = `${scheduleTemplateId}_${studentId.substring(0, 8)}_${Date.now()}_${uniqueSuffix}`;
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

          const guardId = `${scheduleTemplateId}_${studentId}`;
          const guardRef = doc(firestore, 'instanceGuards', guardId);

          await runTransaction(firestore, async (tx) => {
            const guardSnap = await tx.get(guardRef);
            if (guardSnap.exists()) {
              const s = guardSnap.data().status;
              if (s === 'active' || s === 'paused') {
                throw new Error('Aluno já possui uma instância ativa deste cronograma.');
              }
            }
            tx.set(guardRef, {
              instanceId,
              scheduleTemplateId,
              studentId,
              status: 'active',
              createdAt: serverTimestamp()
            });
            tx.set(doc(firestore, this.COLLECTIONS.INSTANCES, instanceId), {
              ...instanceData,
              activitiesReady: false
            });
          });
          console.log(`✅ [SUCESSO] Instância criada: ${instanceId}`);

          try {
            await this.generateWeekActivities(instanceId, 1, weekStart);
            await this.updateProgressCache(instanceId, 1);
            await updateDoc(doc(firestore, this.COLLECTIONS.INSTANCES, instanceId), {
              activitiesReady: true,
              updatedAt: serverTimestamp()
            });
            successful.push({ studentId, instanceId });
          } catch (genError: any) {
            await deleteDoc(doc(firestore, this.COLLECTIONS.INSTANCES, instanceId));
            const actSnap = await getDocs(query(
              collection(firestore, this.COLLECTIONS.PROGRESS),
              where('scheduleInstanceId', '==', instanceId)
            ));
            if (actSnap.size > 0) {
              const cleanupBatch = writeBatch(firestore);
              actSnap.docs.forEach(d => cleanupBatch.delete(d.ref));
              await cleanupBatch.commit();
            }
            const guardRef = doc(firestore, 'instanceGuards', `${scheduleTemplateId}_${studentId}`);
            await deleteDoc(guardRef).catch(e => console.warn('⚠️ Falha ao limpar guard:', e));
            throw new Error(`Falha ao gerar atividades: ${genError.message}. Instância removida.`);
          }
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
  static async generateWeekActivities(instanceId: string, weekNo: number, providedWeekStartDate?: Date) {
    console.log(`⚙️ [GENERATE] Gerando atividades para instância ${instanceId} (Semana ${weekNo})`);
    const snap = await getDoc(doc(firestore, this.COLLECTIONS.INSTANCES, instanceId));
    const inst = snap.data();
    if (!inst) {
      throw new Error(`Instância ${instanceId} não encontrada.`);
    }

    const { visible, data: templateData, reason } = await this.getVisibleTemplateForStudent(inst.scheduleTemplateId);
    if (!visible) {
      throw new Error(`Template ${inst.scheduleTemplateId} não visível (${reason}) — geração cancelada.`);
    }

    const templateEndDate: Date | null = (() => {
      const ed = this.toDateSafe(templateData?.endDate);
      if (!ed) return null;
      const isUTCMidnight = ed.getUTCHours() === 0 && ed.getUTCMinutes() === 0;
      const year = isUTCMidnight ? ed.getUTCFullYear() : ed.getFullYear();
      const month = isUTCMidnight ? ed.getUTCMonth() : ed.getMonth();
      const date = isUTCMidnight ? ed.getUTCDate() : ed.getDate();
      return new Date(year, month, date, 23, 59, 59, 999);
    })();

    const activities = await ActivityService.listScheduleActivities(inst.scheduleTemplateId);
    let weekStartDate: Date;
    if (providedWeekStartDate) {
      weekStartDate = providedWeekStartDate;
    } else if (inst.currentWeekStartDate) {
      weekStartDate = typeof (inst.currentWeekStartDate as any).toDate === 'function'
        ? (inst.currentWeekStartDate as any).toDate()
        : new Date(inst.currentWeekStartDate as any);
    } else {
      weekStartDate = DateUtils.getWeekStartDate(new Date());
    }

    const existingSnap = await getDocs(query(
      collection(firestore, this.COLLECTIONS.PROGRESS),
      where('scheduleInstanceId', '==', instanceId),
      where('weekNumber', '==', weekNo)
    ));
    const existingIds = new Set(existingSnap.docs.map(d => d.id));

    const instanceStartDate: Date | null = (() => {
      const sd = this.toDateSafe(inst.startedAt);
      if (!sd) return null;
      const isUTCMidnight = sd.getUTCHours() === 0 && sd.getUTCMinutes() === 0;
      const year = isUTCMidnight ? sd.getUTCFullYear() : sd.getFullYear();
      const month = isUTCMidnight ? sd.getUTCMonth() : sd.getMonth();
      const date = isUTCMidnight ? sd.getUTCDate() : sd.getDate();
      return new Date(year, month, date, 0, 0, 0, 0);
    })();

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

      if (weekNo === 1 && instanceStartDate && activityDate < instanceStartDate) {
        console.log(`⏩ [GENERATE] "${act.title}" antes do início da instância (${activityDate.toLocaleDateString()}) — ignorada.`);
        skipped++;
        continue;
      }

      const progressId = `${instanceId}_w${weekNo}_${act.id}`;
      if (existingIds.has(progressId)) {
        skipped++;
        continue;
      }
      // Converte dayOfWeek de Conv A (0=Dom) para Conv B (0=Seg)
      // para manter consistência com todo o código do aluno que espera 0=Seg
      const convertedDayOfWeek = (act.dayOfWeek + 6) % 7;
      batch.set(doc(firestore, this.COLLECTIONS.PROGRESS, progressId), {
        scheduleInstanceId: instanceId,
        activityId: act.id,
        studentId: inst.studentId,
        weekNumber: weekNo,
        dayOfWeek: convertedDayOfWeek,
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
      createdAt: d.createdAt?.toDate(),
      updatedAt: d.updatedAt?.toDate(),
      startedAt: d.startedAt?.toDate(),
      completedAt: d.completedAt?.toDate(),
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
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        scheduledDate: data.scheduledDate?.toDate(),
        dueDate: data.dueDate?.toDate(),
        startedAt: data.startedAt?.toDate(),
        completedAt: data.completedAt?.toDate(),
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
        activitySnapshot: {
          ...(data.activitySnapshot ?? {}),
          createdAt: data.activitySnapshot?.createdAt?.toDate(),
          updatedAt: data.activitySnapshot?.updatedAt?.toDate()
        }
      } as ActivityProgress;
    });
  }

  static async updateProgressCache(instanceId: string, weekNumber?: number): Promise<void> {
    let resolvedWeek = weekNumber;
    if (resolvedWeek === undefined) {
      const instSnap = await getDoc(doc(firestore, this.COLLECTIONS.INSTANCES, instanceId));
      if (!instSnap.exists()) return;
      resolvedWeek = instSnap.data().currentWeekNumber ?? 1;
    }
    const progress = await this.getWeekProgress(instanceId, resolvedWeek!);
    const total = progress.length;
    const completed = progress.filter(p => p.status === 'completed').length;
    const skipped = progress.filter(p => p.status === 'skipped').length;
    const points = progress.reduce((sum, p) => sum + (p.scoring?.pointsEarned || 0), 0);
    const timeSpent = progress
      .filter(p => p.status === 'completed' && p.executionData?.timeSpent)
      .reduce((sum, p) => sum + (p.executionData!.timeSpent || 0), 0);

    // Consistência: dias únicos com atividades completadas
    const uniqueDays = new Set(
      progress.filter(p => p.status === 'completed').map(p => p.dayOfWeek)
    ).size;
    const consistencyScore = total > 0 ? Math.round((uniqueDays / 7) * 100) : 0;

    // Adesão: completou no dia agendado
    const onTimeActivities = progress.filter(p => {
      if (p.status !== 'completed' || !p.completedAt || !p.scheduledDate) return false;
      return p.completedAt.getFullYear() === p.scheduledDate.getFullYear()
        && p.completedAt.getMonth() === p.scheduledDate.getMonth()
        && p.completedAt.getDate() === p.scheduledDate.getDate();
    }).length;
    const adherenceScore = completed > 0 ? Math.round((onTimeActivities / completed) * 100) : 0;

    await updateDoc(doc(firestore, this.COLLECTIONS.INSTANCES, instanceId), {
      'progressCache.totalActivities': total,
      'progressCache.completedActivities': completed,
      'progressCache.skippedActivities': skipped,
      'progressCache.completionPercentage': total > 0 ? Math.round((completed / total) * 100) : 0,
      'progressCache.totalPointsEarned': points,
      'progressCache.totalTimeSpent': timeSpent,
      'progressCache.consistencyScore': consistencyScore,
      'progressCache.adherenceScore': adherenceScore,
      'progressCache.lastUpdatedAt': serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  static async completeSchedule(instanceId: string): Promise<void> {
    const snap = await getDoc(doc(firestore, this.COLLECTIONS.INSTANCES, instanceId));
    const inst = snap.data();
    await runTransaction(firestore, async (tx) => {
      tx.update(doc(firestore, this.COLLECTIONS.INSTANCES, instanceId), {
        status: 'completed',
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      if (inst) {
        const guardId = `${inst.scheduleTemplateId}_${inst.studentId}`;
        tx.delete(doc(firestore, 'instanceGuards', guardId));
      }
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
          if (inst.activitiesReady !== true) {
            console.log(`⏳ [BLOQUEIO] Instância com activitiesReady=false ignorada: ${inst.id.substring(0, 12)}...`);
            return null;
          }

          const { visible, reason } = await this.getVisibleTemplateForStudent(inst.scheduleTemplateId);

          if (!visible) {
            console.log(`🗑️ [BLOQUEIO] Instância ignorada (${reason}): ${inst.id.substring(0, 12)}... template=${inst.scheduleTemplateId}`);
            return null;
          }

          return {
            ...inst,
            createdAt: inst.createdAt?.toDate(),
            updatedAt: inst.updatedAt?.toDate(),
            startedAt: inst.startedAt?.toDate(),
            completedAt: inst.completedAt?.toDate(),
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
      const validInstanceIds = new Set(active.map(i => i.id));

      if (validInstanceIds.size === 0) {
        console.log('ℹ️ [SERVICE] Nenhuma instância ativa — retornando grade vazia.');
        return [];
      }

      // Mapa instanceId → currentWeekNumber para filtro prioritário por número de semana
      const instanceWeekNumbers = new Map<string, number>();
      active.forEach(i => {
        if (i.currentWeekNumber !== undefined) {
          instanceWeekNumbers.set(i.id, i.currentWeekNumber);
        }
      });

      const now = new Date();
      const start = DateUtils.getWeekStartDate(now);
      const end = DateUtils.getWeekEndDate(now);

      console.log(`🌐 [SERVICE] Janela Civil: ${start.toLocaleDateString()} a ${end.toLocaleDateString()}`);

      // Coleta weekNumbers únicos para restringir a query ao Firestore e evitar full-scan do histórico
      const weekNums = Array.from(new Set(
        active.map(i => i.currentWeekNumber).filter((n): n is number => n !== undefined)
      ));

      if (weekNums.length === 0) {
        console.warn('[getWeekActivities] Nenhuma instância ativa possui currentWeekNumber definido — retornando grade vazia para evitar full-scan do histórico.');
        return [];
      }

      // Filtrar por scheduleInstanceId para evitar ler atividades de instâncias inválidas
      // Firestore `in` suporta até 30 itens — limitar para evitar erro
      const instanceIdArr = Array.from(validInstanceIds).slice(0, 30);
      if (instanceIdArr.length < validInstanceIds.size) {
        console.warn(`[getWeekActivities] ${validInstanceIds.size} instâncias ativas, mas o filtro suporta no máximo 30. ${validInstanceIds.size - 30} serão ignoradas.`);
      }

      const baseQuery = query(
        collection(firestore, this.COLLECTIONS.PROGRESS),
        where('studentId', '==', studentId),
        where('scheduleInstanceId', 'in', instanceIdArr),
        where('isActive', '==', true),
        where('isDeleted', '==', false)
      );

      // Slice to 30 to respect Firestore `in` limit
      if (weekNums.length > 30) {
        console.warn(`[getWeekActivities] ${weekNums.length} weekNumbers distintos, limitando a 30 para o filtro Firestore.`);
      }
      const safeWeekNums = weekNums.slice(0, 30);

      // safeWeekNums.length === 1 → equality filter (mais eficiente, sem índice composto)
      // safeWeekNums.length > 1 → `in` filter (suporta até 30 valores; evita full-scan do histórico)
      const q = safeWeekNums.length === 1
        ? query(baseQuery, where('weekNumber', '==', safeWeekNums[0]))
        : query(baseQuery, where('weekNumber', 'in', safeWeekNums));

      const snap = await getDocs(q);
      const activities: ActivityProgress[] = [];

      snap.forEach(dDoc => {
        const data = dDoc.data();
        const scheduledDate = data.scheduledDate?.toDate();

        if (!scheduledDate) return;

        const isLegit = validInstanceIds.has(data.scheduleInstanceId);

        // Preferência por weekNumber; fallback para range de datas (dados legados sem weekNumber)
        let isWithinRange = false;
        const instanceWeekNumber = instanceWeekNumbers.get(data.scheduleInstanceId);
        if (data.weekNumber !== undefined && instanceWeekNumber !== undefined) {
          isWithinRange = data.weekNumber === instanceWeekNumber;
        } else {
          const isUTCMidnight = scheduledDate.getUTCHours() === 0 && scheduledDate.getUTCMinutes() === 0;
          const intendedYear = isUTCMidnight ? scheduledDate.getUTCFullYear() : scheduledDate.getFullYear();
          const intendedMonth = isUTCMidnight ? scheduledDate.getUTCMonth() : scheduledDate.getMonth();
          const intendedDate = isUTCMidnight ? scheduledDate.getUTCDate() : scheduledDate.getDate();
          const safeScheduledDate = new Date(intendedYear, intendedMonth, intendedDate, 12, 0, 0);
          isWithinRange = safeScheduledDate >= start && safeScheduledDate <= end;
        }

        if (isWithinRange) {
          activities.push({ id: dDoc.id, ...data, scheduledDate } as ActivityProgress);
        } else if (!isWithinRange) {
          console.log(`⏭️ [BLOQUEIO DATA] Fora da semana: [${data.activitySnapshot?.title || 'Sem título'}] | Data: ${scheduledDate.toLocaleDateString('pt-BR')}`);
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