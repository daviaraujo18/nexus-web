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

  /**
   * 🚀 [LOG TOTAL] Atribuição com TRAVA DE SEGURANÇA TEMPORAL
   */
  static async assignScheduleToStudents(
    professionalId: string,
    scheduleTemplateId: string,
    assignData: AssignScheduleDTO
  ): Promise<{ successful: any[]; failed: any[] }> {
    console.group(`🚀 [ATRIBUIÇÃO CRÍTICA] Iniciando para Template: ${scheduleTemplateId}`);
    console.log('📦 Payload BRUTO recebido:', JSON.stringify(assignData, null, 2));
    
    try {
      const schedule = await ScheduleService.getScheduleTemplate(scheduleTemplateId);
      console.log('📄 Dados Mestre do Template:', {
        nome: schedule.name,
        templateStartDate: schedule.startDate?.toLocaleDateString('pt-BR')
      });

      const successful = [];
      const failed = [];

      for (const studentId of assignData.studentIds) {
        console.group(`👤 Processando Aluno: ${studentId}`);
        try {
          const dateFromForm = assignData.startDate ? new Date(assignData.startDate) : null;
          const dateFromTemplate = schedule.startDate ? new Date(schedule.startDate) : null;
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          console.log('🕒 Auditoria de Datas:', {
            vindaDoFormulario: dateFromForm?.toLocaleDateString('pt-BR') || 'NULO',
            vindaDoTemplate: dateFromTemplate?.toLocaleDateString('pt-BR') || 'NULO',
            hoje: today.toLocaleDateString('pt-BR')
          });

          // 🔥 TRAVA DE SEGURANÇA NUCLEAR:
          // Se o formulário mandou HOJE (24/04), mas o template diz que é dia 30/04,
          // o Service agora FORÇA o uso do dia 30/04.
          let startDate: Date;
          
          if (dateFromTemplate && dateFromTemplate > today) {
            console.warn(`⚠️ [TRAVA ATIVADA] O template é futuro (${dateFromTemplate.toLocaleDateString()}). Ignorando erro do formulário.`);
            startDate = dateFromTemplate;
          } else {
            startDate = dateFromForm || dateFromTemplate || today;
          }
          
          startDate.setHours(0, 0, 0, 0);
          console.log(`🎯 DATA FINAL QUE SERÁ GRAVADA: ${startDate.toLocaleDateString('pt-BR')}`);

          const instanceId = `${scheduleTemplateId}_${studentId.substring(0, 8)}_${Date.now()}`;
          
          // Recalcula as janelas com a data CORRIGIDA (dia 30)
          const weekStart = DateUtils.getWeekStartDate(startDate);
          const weekEnd = DateUtils.getWeekEndDate(startDate);
          
          console.log('📏 Janela de Cronograma Calculada:', {
            weekStart: weekStart.toLocaleDateString('pt-BR'),
            weekEnd: weekEnd.toLocaleDateString('pt-BR')
          });

          const instanceData = {
            scheduleTemplateId,
            studentId,
            professionalId,
            currentWeekNumber: 1,
            currentWeekStartDate: weekStart,
            currentWeekEndDate: weekEnd,
            status: 'active',
            startedAt: startDate,
            isActive: true,
            isDeleted: false,
          };

          console.log(`💾 Persistindo Instância [${instanceId}] no Firestore...`);
          await setDoc(doc(firestore, this.COLLECTIONS.INSTANCES, instanceId), {
            ...instanceData,
            currentWeekStartDate: Timestamp.fromDate(weekStart),
            currentWeekEndDate: Timestamp.fromDate(weekEnd),
            startedAt: Timestamp.fromDate(startDate),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });

          console.log('✅ Instância salva. Gerando atividades para a semana futura...');
          await this.generateWeekActivities(instanceId, 1);
          
          successful.push({ studentId, instanceId });
          console.log('🎊 Atribuição concluída sem erros de data.');
        } catch (err: any) {
          console.error(`❌ FALHA no aluno ${studentId}:`, err);
          failed.push({ studentId, error: err.message });
        }
        console.groupEnd();
      }
      console.groupEnd();
      return { successful, failed };
    } catch (error: any) {
      console.error('❌ ERRO FATAL NA ATRIBUIÇÃO:', error);
      console.groupEnd();
      throw error;
    }
  }

  /**
   * 🛠️ [LOG TOTAL] Gera atividades baseadas na data da INSTÂNCIA
   */
  static async generateWeekActivities(instanceId: string, weekNo: number) {
    console.group(`🛠️ [GERAÇÃO] Instância: ${instanceId}`);
    try {
      const snap = await getDoc(doc(firestore, this.COLLECTIONS.INSTANCES, instanceId));
      const inst = snap.data();
      if (!inst) {
        console.error('❌ Abortando: Instância não encontrada!');
        console.groupEnd();
        return;
      }

      const activities = await ActivityService.listScheduleActivities(inst.scheduleTemplateId);
      const weekStartDate = inst.currentWeekStartDate.toDate();
      
      console.log(`📅 Calculando datas baseadas em (WeekStart): ${weekStartDate.toLocaleDateString('pt-BR')}`);

      const batch = writeBatch(firestore);
      for (const act of activities) {
        const activityDate = DateUtils.calculateActivityDate(weekStartDate, act.dayOfWeek);
        
        console.log(`   🔹 Atividade: [${act.title}] | Dia:${act.dayOfWeek} -> DATA CALCULADA: ${activityDate.toLocaleDateString('pt-BR')}`);

        const progressId = `${instanceId}_w${weekNo}_${act.id}`;
        batch.set(doc(firestore, this.COLLECTIONS.PROGRESS, progressId), {
          scheduleInstanceId: instanceId,
          activityId: act.id,
          studentId: inst.studentId,
          weekNumber: weekNo,
          dayOfWeek: act.dayOfWeek,
          activitySnapshot: act,
          status: 'pending',
          scheduledDate: Timestamp.fromDate(activityDate),
          isActive: true,
          isDeleted: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      await batch.commit();
      console.log('✅ Batch de atividades gravado com sucesso.');
    } catch (err) {
      console.error('❌ ERRO NA GERAÇÃO:', err);
    } finally {
      console.groupEnd();
    }
  }

  /**
   * 🔍 [LOG TOTAL] Auditoria e Filtros (Getters)
   */
  static async getStudentActiveInstances(studentId: string): Promise<ScheduleInstance[]> {
    console.group(`🔍 [AUDITORIA] Buscando para Aluno: ${studentId}`);
    try {
      const q = query(collection(firestore, this.COLLECTIONS.INSTANCES), where('studentId', '==', studentId), where('isActive', '==', true), where('status', '==', 'active'));
      const snap = await getDocs(q);
      const validInstances: ScheduleInstance[] = [];
      for (const instDoc of snap.docs) {
        const inst = { id: instDoc.id, ...instDoc.data() } as any;
        const templateSnap = await getDoc(doc(firestore, this.COLLECTIONS.TEMPLATES, inst.scheduleTemplateId));
        if (!templateSnap.exists() || templateSnap.data()?.isDeleted) continue;
        validInstances.push({ ...inst, startedAt: inst.startedAt?.toDate(), currentWeekStartDate: inst.currentWeekStartDate?.toDate(), currentWeekEndDate: inst.currentWeekEndDate?.toDate() } as ScheduleInstance);
      }
      console.log(`📊 TOTAL LEGÍTIMO: ${validInstances.length}`);
      console.groupEnd();
      return validInstances;
    } catch { console.groupEnd(); return []; }
  }

  static async getWeekActivities(studentId: string): Promise<ActivityProgress[]> {
    console.group(`📅 [FILTRO SEMANAL] Aluno: ${studentId}`);
    try {
      const active = await this.getStudentActiveInstances(studentId);
      if (active.length === 0) { console.groupEnd(); return []; }
      const activeIds = active.map(i => i.id);
      const now = new Date();
      const start = DateUtils.getWeekStartDate(now);
      const end = DateUtils.getWeekEndDate(now);
      start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999);
      console.log(`🌐 Exibindo apenas entre: ${start.toLocaleDateString()} e ${end.toLocaleDateString()}`);
      const q = query(collection(firestore, this.COLLECTIONS.PROGRESS), where('scheduleInstanceId', 'in', activeIds.slice(0, 30)), where('isActive', '==', true));
      const snap = await getDocs(q);
      const activities: ActivityProgress[] = [];
      snap.forEach(dDoc => {
        const data = dDoc.data();
        const scheduledDate = data.scheduledDate?.toDate();
        const isWithinRange = scheduledDate >= start && scheduledDate <= end;
        if (isWithinRange && !data.isDeleted) {
          activities.push({ id: dDoc.id, ...data, scheduledDate } as ActivityProgress);
        } else {
          console.log(`      ⏭️ IGNORADA: [${data.activitySnapshot?.title}] Data: ${scheduledDate?.toLocaleDateString('pt-BR')} (Fora da Semana)`);
        }
      });
      console.log(`🎯 TOTAL NA TELA: ${activities.length}`);
      console.groupEnd();
      return activities;
    } catch { console.groupEnd(); return []; }
  }
}