// lib/services/RepetitionService.ts
// ⚠️ DEPRECATED: Use WeeklyResetService instead.
// Mantido temporariamente para referência, mas todas as chamadas foram redirecionadas
// para WeeklyResetService, que possui rollback atômico, dry-run, e tratamento robusto
// de concorrência.
import {
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
  orderBy,
  limit,
  doc,
  updateDoc,
  runTransaction
} from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import {
  ScheduleInstance,
  PerformanceSnapshot,
  ScheduleTemplate
} from '@/types/schedule';
import { ScheduleInstanceService } from './ScheduleInstanceService';
import { ScheduleService } from './ScheduleService';
import { ReportService } from './ReportService';
import { DateUtils } from '@/lib/utils/dateUtils';
import { AuditService } from '@/lib/auth/AuditService';

export class RepetitionService {
  private static readonly COLLECTIONS = {
    INSTANCES: 'scheduleInstances',
    SNAPSHOTS: 'performanceSnapshots',
    TEMPLATES: 'weeklySchedules'
  };

  /**
   * Processa reset semanal para TODOS os cronogramas ativos
   * Deve ser executado via Cloud Function às 00:01 de segunda-feira
   */
  static async processWeeklyReset(): Promise<{
    processedInstances: number;
    generatedSnapshots: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let processedInstances = 0;
    let generatedSnapshots = 0;

    try {
      console.log('🔁 Iniciando processo de reset semanal...');

      // 1. Buscar TODAS as instâncias ativas que precisam de reset
      const instancesToReset = await this.findInstancesForReset();
      console.log(`📊 Encontradas ${instancesToReset.length} instâncias para reset`);

      // 2. Processar em batches para evitar timeouts
      const batchSize = 25;
      for (let i = 0; i < instancesToReset.length; i += batchSize) {
        const batch = instancesToReset.slice(i, i + batchSize);

        try {
          const batchResults = await Promise.allSettled(
            batch.map(instance => this.processInstanceReset(instance))
          );

          // Contar resultados
          batchResults.forEach(result => {
            if (result.status === 'fulfilled') {
              processedInstances++;
              if (result.value.snapshotGenerated) {
                generatedSnapshots++;
              }
            } else {
              errors.push(result.reason.message || 'Erro desconhecido');
            }
          });

          console.log(`✅ Batch ${Math.floor(i / batchSize) + 1} processado`);

        } catch (batchError: any) {
          errors.push(`Erro no batch ${Math.floor(i / batchSize) + 1}: ${batchError.message}`);
        }
      }

      console.log(`🎉 Reset semanal concluído: ${processedInstances} instâncias processadas, ${generatedSnapshots} snapshots gerados`);

      // 3. Log de auditoria
      // COMENTADO
      // await AuditService.logEvent('system', 'WEEKLY_RESET_PROCESSED', {
      //   timestamp: new Date(),
      //   processedInstances,
      //   generatedSnapshots,
      //   errorCount: errors.length
      // });

      return {
        processedInstances,
        generatedSnapshots,
        errors
      };

    } catch (error: any) {
      console.error('❌ Erro crítico no reset semanal:', error);
      throw error;
    }
  }

  /**
   * Processa reset para uma instância específica
   */
  private static async processInstanceReset(
    instance: ScheduleInstance
  ): Promise<{
    instanceId: string;
    snapshotGenerated: boolean;
    newWeekNumber: number;
  }> {
    try {
      console.log(`🔄 Processando reset para instância: ${instance.id}`);

      // 1. Gerar snapshot da semana que terminou
      let snapshotGenerated = false;
      if (instance.currentWeekNumber > 0) {
        await ReportService.generateWeeklySnapshot(instance.id, instance.currentWeekNumber);
        snapshotGenerated = true;
      }

      // 2. Verificar se cronograma deve continuar
      const schedule = await ScheduleService.getScheduleTemplate(instance.scheduleTemplateId);
      const shouldContinue = this.shouldScheduleContinue(instance, schedule);

      if (!shouldContinue) {
        // Completar cronograma
        await ScheduleInstanceService.completeSchedule(instance.id);
        return {
          instanceId: instance.id,
          snapshotGenerated,
          newWeekNumber: instance.currentWeekNumber
        };
      }

      // 3. Salvar estado anterior para rollback
      const oldCompleted = instance.progressCache?.completedActivities || 0;
      const oldTotal = instance.progressCache?.totalActivities || 0;

      // 4. Calcular nova semana
      const newWeekNumber = instance.currentWeekNumber + 1;
      const newWeekStartDate = DateUtils.addWeeks(instance.currentWeekStartDate, 1);
      newWeekStartDate.setHours(0, 0, 0, 0);
      const newWeekEndDate = DateUtils.addWeeks(instance.currentWeekEndDate, 1);
      newWeekEndDate.setHours(23, 59, 59, 999);

      // 5. Atualizar instância com TRANSACTION (atomicidade + detecção de concorrência)
      const instanceId = instance.id;
      const oldWeekNumber = instance.currentWeekNumber;
      const instanceRef = doc(firestore, this.COLLECTIONS.INSTANCES, instanceId);

      await runTransaction(firestore, async (transaction) => {
        const snap = await transaction.get(instanceRef);
        if (!snap.exists()) throw new Error(`Instância ${instanceId} não encontrada`);
        const currentWeek = snap.data().currentWeekNumber;
        if (currentWeek !== oldWeekNumber) {
          throw new Error(`__ALREADY_RESET__:${currentWeek}`);
        }

        transaction.update(instanceRef, {
          currentWeekNumber: newWeekNumber,
          currentWeekStartDate: Timestamp.fromDate(newWeekStartDate),
          currentWeekEndDate: Timestamp.fromDate(newWeekEndDate),
          'progressCache.completedActivities': 0,
          'progressCache.completionPercentage': 0,
          'progressCache.totalPointsEarned': 0,
          'progressCache.totalActivities': 0,
          'progressCache.streakDays': instance.progressCache?.streakDays || 0,
          'progressCache.lastUpdatedAt': serverTimestamp(),
          activitiesReady: false,
          updatedAt: serverTimestamp()
        });
      });

      console.log(`✅ Instância ${instanceId} atualizada: semana ${oldWeekNumber} → ${newWeekNumber}`);

      // 6. Gerar atividades da nova semana (APÓS transaction — activitiesReady=false protege o aluno)
      let generatedActivities = false;
      try {
        if (schedule?.repeatRules?.resetOnRepeat) {
          await ScheduleInstanceService.generateWeekActivities(instanceId, newWeekNumber);
        }
        await ScheduleInstanceService.updateProgressCache(instanceId, newWeekNumber);
        await updateDoc(instanceRef, {
          activitiesReady: true,
          updatedAt: serverTimestamp()
        });
        generatedActivities = true;
      } catch (activityError: any) {
        console.warn(`⚠️ Falha ao gerar atividades — activitiesReady=false persiste:`, activityError.message);
        // Rollback: restaurar instância ao estado anterior
        try {
          const oldCompletionPct = oldTotal > 0 ? Math.round((oldCompleted / oldTotal) * 100) : 0;
          await runTransaction(firestore, async (transaction) => {
            const rollbackRef = doc(firestore, this.COLLECTIONS.INSTANCES, instanceId);
            transaction.update(rollbackRef, {
              currentWeekNumber: oldWeekNumber,
              currentWeekStartDate: Timestamp.fromDate(instance.currentWeekStartDate),
              currentWeekEndDate: Timestamp.fromDate(instance.currentWeekEndDate),
              'progressCache.completedActivities': oldCompleted,
              'progressCache.totalActivities': oldTotal,
              'progressCache.completionPercentage': oldCompletionPct,
              'progressCache.totalPointsEarned': instance.progressCache?.totalPointsEarned || 0,
              activitiesReady: true,
              updatedAt: serverTimestamp()
            });
          });
          console.warn(`↩️ Rollback concluído: instância ${instanceId} restaurada para semana ${oldWeekNumber}`);
        } catch (rollbackError: any) {
          console.error(`❌ Falha no rollback — instância ${instanceId} em estado inconsistente:`, rollbackError.message);
        }
        throw activityError;
      }

      console.log(`✅ Instância ${instanceId} resetada para semana ${newWeekNumber} (${generatedActivities ? 'atividades geradas' : 'sem repetição'})`);

      return {
        instanceId,
        snapshotGenerated,
        newWeekNumber
      };

    } catch (error: any) {
      // Concorrência detectada — outra execução já avançou a semana
      if (typeof (error as any)?.message === 'string' && (error as any).message.startsWith('__ALREADY_RESET__')) {
        console.log(`⏭️ Instância ${instance.id} já foi resetada por execução paralela`);
        return {
          instanceId: instance.id,
          snapshotGenerated: false,
          newWeekNumber: instance.currentWeekNumber + 1
        };
      }
      console.error(`❌ Erro ao processar instância ${instance.id}:`, error);
      throw new Error(`Falha no reset da instância ${instance.id}: ${error.message}`);
    }
  }

  /**
   * Encontra instâncias que precisam de reset
   */
  private static async findInstancesForReset(): Promise<ScheduleInstance[]> {
    try {
      const now = new Date();

      const q = query(
        collection(firestore, this.COLLECTIONS.INSTANCES),
        where('status', 'in', ['active', 'paused']),
        where('isActive', '==', true),
        orderBy('updatedAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const instances: ScheduleInstance[] = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        instances.push({
          id: doc.id,
          ...data,
          currentWeekStartDate: data.currentWeekStartDate?.toDate(),
          currentWeekEndDate: data.currentWeekEndDate?.toDate(),
          startedAt: data.startedAt?.toDate(),
          completedAt: data.completedAt?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate()
        } as ScheduleInstance);
      });

      // Filtrar apenas instâncias cuja semana atual terminou
      return instances.filter(instance => {
        const weekEndDate = instance.currentWeekEndDate;
        return weekEndDate < now;
      });

    } catch (error: any) {
      console.error('Erro ao buscar instâncias para reset:', error);
      throw error;
    }
  }

  /**
   * Verifica se cronograma deve continuar baseado nas regras
   */
  private static shouldScheduleContinue(
    instance: ScheduleInstance,
    schedule: ScheduleTemplate
  ): boolean {
    // 1. Verificar se alcançou número máximo de repetições

    // 2. Verificar se tem data de término
    if (schedule.endDate) {
      const nextWeekStart = DateUtils.addWeeks(instance.currentWeekStartDate, 1);
      if (nextWeekStart > schedule.endDate) {
        return false;
      }
    }

    // 3. Verificar se ainda está ativo
    return instance.status === 'active';
  }

  /**
   * Força reset para uma instância específica (para testes/debug)
   */
  static async forceResetForInstance(instanceId: string): Promise<void> {
    try {
      const instance = await ScheduleInstanceService.getScheduleInstanceById(instanceId);


      if (!instance) {
        throw new Error('Instância não encontrada');
      }

      await this.processInstanceReset(instance);

      console.log(`✅ Reset forçado realizado para ${instanceId}`);

    } catch (error: any) {
      console.error('Erro no reset forçado:', error);
      throw error;
    }
  }

  /**
   * Verifica status do sistema de reset
   */
  static async getResetStatus(): Promise<{
    lastReset: Date | null;
    nextReset: Date;
    instancesPendingReset: number;
    systemStatus: 'healthy' | 'warning' | 'error';
  }> {
    try {
      // Buscar último reset do log de auditoria
      const q = query(
        collection(firestore, 'auditLogs'),
        where('eventType', '==', 'WEEKLY_RESET_PROCESSED'),
        orderBy('timestamp', 'desc'),
        limit(1)
      );

      const snapshot = await getDocs(q);
      let lastReset: Date | null = null;

      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        lastReset = data.timestamp?.toDate() || null;
      }

      // Calcular próximo reset (próxima segunda-feira às 00:01)
      const now = new Date();
      const nextMonday = new Date(now);
      const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
      nextMonday.setDate(now.getDate() + daysUntilMonday);
      nextMonday.setHours(0, 1, 0, 0);

      // Contar instâncias pendentes de reset
      const instances = await this.findInstancesForReset();

      // Determinar status do sistema
      let systemStatus: 'healthy' | 'warning' | 'error' = 'healthy';
      if (lastReset) {
        const daysSinceLastReset = DateUtils.getDaysBetween(lastReset, now);
        if (daysSinceLastReset > 8) {
          systemStatus = 'error';
        } else if (daysSinceLastReset > 6) {
          systemStatus = 'warning';
        }
      }

      return {
        lastReset,
        nextReset: nextMonday,
        instancesPendingReset: instances.length,
        systemStatus
      };

    } catch (error) {
      console.error('Erro ao verificar status do reset:', error);
      return {
        lastReset: null,
        nextReset: new Date(),
        instancesPendingReset: 0,
        systemStatus: 'error'
      };
    }
  }
}