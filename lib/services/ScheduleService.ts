// lib/services/ScheduleService.ts
import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import {
  ScheduleTemplate,
  ScheduleActivity,
  CreateScheduleDTO,
  CreateActivityDTO,
  ScheduleCategory
} from '@/types/schedule';
import { ValidationUtils } from '@/lib/utils/validationUtils';

export class ScheduleService {
  private static readonly COLLECTIONS = {
    TEMPLATES: 'weeklySchedules',
    ACTIVITIES: 'scheduleActivities',
    INSTANCES: 'scheduleInstances',
    PROGRESS: 'activityProgress'
  };

  /**
   * Cria um novo template de cronograma
   */
  static async createScheduleTemplate(
    professionalId: string,
    data: CreateScheduleDTO
  ): Promise<{
    scheduleId: string;
    activityIds: string[];
    metadata: any;
  }> {
    try {
      const validation = ValidationUtils.validateScheduleData(data);
      if (!validation.isValid) {
        throw new Error(`Dados inválidos: ${validation.errors.join(', ')}`);
      }

      const sanitizedData = ValidationUtils.sanitizeScheduleData(data);
      const metrics = this.calculateScheduleMetrics(sanitizedData.activities);
      const scheduleId = this.generateScheduleId(professionalId, sanitizedData.name);

      const scheduleData: Omit<ScheduleTemplate, 'id'> = {
        professionalId,
        name: sanitizedData.name,
        description: sanitizedData.description,
        category: sanitizedData.category,
        startDate: sanitizedData.startDate,
        endDate: sanitizedData.endDate,
        activeDays: sanitizedData.activeDays,
        repeatRules: {
          type: 'weekly',
          resetOnRepeat: sanitizedData.repeatRules.resetOnRepeat,
        },
        metadata: {
          version: 1,
          estimatedWeeklyHours: metrics.estimatedWeeklyHours,
          totalActivities: metrics.totalActivities,
          tags: metrics.tags,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      };

      await setDoc(doc(firestore, this.COLLECTIONS.TEMPLATES, scheduleId), {
        ...scheduleData,
        startDate: Timestamp.fromDate(sanitizedData.startDate),
        endDate: sanitizedData.endDate ? Timestamp.fromDate(sanitizedData.endDate) : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      const activityIds = await this.createActivities(scheduleId, sanitizedData.activities);
      return { scheduleId, activityIds, metadata: metrics };

    } catch (error: any) {
      throw new Error(`Falha ao criar cronograma: ${error.message}`);
    }
  }

  /**
   * 🔥 FUNÇÃO INJETADA PARA CORRIGIR O ERRO "is not a function" NO FORM DE EDIÇÃO
   */
  static async updateScheduleTemplate(
    scheduleId: string,
    data: CreateScheduleDTO
  ): Promise<void> {
    console.group(`🔥 [SERVICE] Atualizando Cronograma: ${scheduleId}`);
    try {
      const validation = ValidationUtils.validateScheduleData(data);
      if (!validation.isValid) {
        throw new Error(`Dados inválidos: ${validation.errors.join(', ')}`);
      }

      const sanitizedData = ValidationUtils.sanitizeScheduleData(data);
      const metrics = this.calculateScheduleMetrics(sanitizedData.activities);

      const templateRef = doc(firestore, this.COLLECTIONS.TEMPLATES, scheduleId);
      const batch = writeBatch(firestore);

      // 1. Atualizar o Documento Principal (Template)
      console.log(`📝 Preparando payload do template...`);
      batch.update(templateRef, {
        name: sanitizedData.name,
        description: sanitizedData.description,
        category: sanitizedData.category,
        startDate: Timestamp.fromDate(sanitizedData.startDate),
        endDate: sanitizedData.endDate ? Timestamp.fromDate(sanitizedData.endDate) : null,
        activeDays: sanitizedData.activeDays,
        'repeatRules.resetOnRepeat': sanitizedData.repeatRules.resetOnRepeat,
        'metadata.estimatedWeeklyHours': metrics.estimatedWeeklyHours,
        'metadata.totalActivities': metrics.totalActivities,
        'metadata.tags': metrics.tags,
        updatedAt: serverTimestamp()
      });

      // 2. Limpar atividades antigas
      console.log(`🧹 Buscando atividades antigas para limpeza...`);
      const oldActivitiesQuery = query(
        collection(firestore, this.COLLECTIONS.ACTIVITIES),
        where('scheduleTemplateId', '==', scheduleId)
      );
      const oldActivitiesSnap = await getDocs(oldActivitiesQuery);
      
      oldActivitiesSnap.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      console.log(`🗑️ ${oldActivitiesSnap.docs.length} atividades antigas removidas do lote.`);

      // 3. Inserir as atividades novas/editadas
      console.log(`➕ Adicionando ${sanitizedData.activities.length} atividades novas ao lote...`);
      sanitizedData.activities.forEach((a, i) => {
        const actId = `${scheduleId}_act_${i}_${Date.now()}`; // Adiciona timestamp pra garantir ID único
        const actRef = doc(firestore, this.COLLECTIONS.ACTIVITIES, actId);
        batch.set(actRef, {
          scheduleTemplateId: scheduleId,
          ...a,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          isActive: true
        });
      });

      // 4. Executa a transação no banco
      console.log(`🚀 Disparando transação no banco...`);
      await batch.commit();

      console.log(`✅ Cronograma ${scheduleId} atualizado com sucesso!`);
      console.groupEnd();
    } catch (error: any) {
      console.error('❌ Erro na atualização do cronograma:', error);
      console.groupEnd();
      throw new Error(`Falha ao atualizar cronograma: ${error.message}`);
    }
  }

  /**
   * EXCLUSÃO SEGURA (Preserva dados enviados pelos alunos)
   */
  static async deleteSchedule(scheduleId: string, professionalId: string): Promise<void> {
    try {
      console.log(`🛡️ Iniciando desativação segura do cronograma: ${scheduleId}`);
      const batch = writeBatch(firestore);

      // 1. Marcar Template como deletado (mas mantém o documento)
      const templateRef = doc(firestore, this.COLLECTIONS.TEMPLATES, scheduleId);
      batch.update(templateRef, {
        status: 'deleted',
        isActive: false,
        isDeleted: true,
        deletedAt: serverTimestamp()
      });

      // 2. Buscar instâncias para desativar visualização
      const instancesQuery = query(
        collection(firestore, this.COLLECTIONS.INSTANCES),
        where('scheduleTemplateId', '==', scheduleId)
      );
      const instancesSnap = await getDocs(instancesQuery);
      
      for (const instanceDoc of instancesSnap.docs) {
        batch.update(instanceDoc.ref, {
          isActive: false,
          status: 'archived', // Mudamos para arquivado para indicar que os dados existem
          updatedAt: serverTimestamp()
        });

        // 3. Tratar as atividades de progresso (Filhos)
        const progressQuery = query(
          collection(firestore, this.COLLECTIONS.PROGRESS),
          where('scheduleInstanceId', '==', instanceDoc.id)
        );
        const progressSnap = await getDocs(progressQuery);
        
        progressSnap.forEach(pDoc => {
          const pData = pDoc.data();
          
          // ⚠️ A REGRA DE OURO:
          // Se a atividade já foi completada ou tem dados de execução, não deletamos nem mudamos status crítico.
          // Apenas "escondemos" do cronograma semanal.
          if (pData.status === 'completed' || pData.executionData) {
             batch.update(pDoc.ref, {
                isActive: false, // Tira do cronograma ativo
                hiddenFromSchedule: true, // Flag para relatórios saberem que foi de um cronograma removido
                updatedAt: serverTimestamp()
             });
          } else {
             // Se era uma atividade pendente sem nenhum dado, podemos marcar como cancelada
             batch.update(pDoc.ref, {
                isActive: false,
                status: 'cancelled',
                updatedAt: serverTimestamp()
             });
          }
        });
      }

      await batch.commit();
      console.log(`✅ Cronograma desativado. Dados de evolução preservados.`);

    } catch (error: any) {
      console.error('❌ Erro na desativação segura:', error);
      throw error;
    }
  }

  static async getScheduleTemplate(scheduleId: string, includeActivities = false): Promise<ScheduleTemplate & { activities?: ScheduleActivity[] }> {
    const docRef = doc(firestore, this.COLLECTIONS.TEMPLATES, scheduleId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('Não encontrado');
    const data = snap.data();
    const schedule = { id: snap.id, ...data, startDate: data.startDate?.toDate(), endDate: data.endDate?.toDate(), createdAt: data.createdAt?.toDate(), updatedAt: data.updatedAt?.toDate() } as ScheduleTemplate;
    if (includeActivities) {
      const activities = await this.getScheduleActivities(scheduleId);
      return { ...schedule, activities };
    }
    return schedule;
  }

  static async listProfessionalSchedules(professionalId: string, options: { category?: ScheduleCategory; activeOnly?: boolean; limit?: number; } = {}): Promise<ScheduleTemplate[]> {
    let q = query(collection(firestore, this.COLLECTIONS.TEMPLATES), where('professionalId', '==', professionalId));
    const snap = await getDocs(q);
    const schedules: ScheduleTemplate[] = [];
    snap.forEach(doc => {
      const d = doc.data();
      if (d.isDeleted) return;
      schedules.push({ id: doc.id, ...d, startDate: d.startDate?.toDate(), endDate: d.endDate?.toDate(), createdAt: d.createdAt?.toDate(), updatedAt: d.updatedAt?.toDate() } as ScheduleTemplate);
    });
    schedules.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return options.limit ? schedules.slice(0, options.limit) : schedules;
  }

  private static async createActivities(scheduleId: string, activities: CreateActivityDTO[]): Promise<string[]> {
    const batch = writeBatch(firestore);
    const ids: string[] = [];
    activities.forEach((a, i) => {
      const id = `${scheduleId}_act_${i}`;
      const ref = doc(firestore, this.COLLECTIONS.ACTIVITIES, id);
      batch.set(ref, { scheduleTemplateId: scheduleId, ...a, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), isActive: true });
      ids.push(id);
    });
    await batch.commit();
    return ids;
  }

  private static async getScheduleActivities(scheduleId: string): Promise<ScheduleActivity[]> {
    const q = query(collection(firestore, this.COLLECTIONS.ACTIVITIES), where('scheduleTemplateId', '==', scheduleId), where('isActive', '==', true));
    const snap = await getDocs(q);
    const acts: ScheduleActivity[] = [];
    snap.forEach(d => acts.push({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate(), updatedAt: d.data().updatedAt?.toDate() } as ScheduleActivity));
    return acts.sort((a, b) => a.dayOfWeek === b.dayOfWeek ? a.orderIndex - b.orderIndex : a.dayOfWeek - b.dayOfWeek);
  }

  private static calculateScheduleMetrics(activities: CreateActivityDTO[]) {
    const total = activities.length;
    const hours = activities.reduce((t, a) => t + (a.metadata.estimatedDuration || 30), 0) / 60;
    const tags = Array.from(new Set(activities.flatMap(a => [...(a.metadata.therapeuticFocus || []), ...(a.metadata.educationalFocus || [])]))).filter(Boolean);
    return { totalActivities: total, estimatedWeeklyHours: parseFloat(hours.toFixed(1)), tags };
  }

  private static generateScheduleId(profId: string, name: string): string {
    return `${profId.substring(0, 8)}_${name.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 20)}_${Date.now()}`;
  }
}