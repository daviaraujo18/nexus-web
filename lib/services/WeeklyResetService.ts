import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  serverTimestamp,
  Timestamp,
  DocumentData,
  getDoc,
  runTransaction,
  limit,
  orderBy
} from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import {
  ScheduleInstance,
  WeeklyResetResult,
  ProcessWeeklyResetDTO
} from '@/types/schedule';
import { ScheduleInstanceService } from './ScheduleInstanceService';
import { WeeklySnapshotService } from './WeeklySnapshotService';
import { DateUtils } from '@/lib/utils/dateUtils';

export class WeeklyResetService {
  private static readonly COLLECTIONS = {
    INSTANCES: 'scheduleInstances',
    PROGRESS: 'activityProgress'
  };

  /**
   * Processa reset semanal para TODAS as instâncias ativas
   * Método PRINCIPAL para Cloud Function
   */
  static async processWeeklyReset(
    dto: ProcessWeeklyResetDTO = {}
  ): Promise<{
    totalProcessed: number;
    successful: number;
    skipped: number;
    failed: number;
    results: WeeklyResetResult[];
  }> {
    try {
      console.log('🚀 [RESET] Iniciando processo de reset semanal');

      // 1. Buscar instâncias ativas que precisam de reset
      const instancesToReset = await this.findInstancesForReset();
      console.log(`📊 [RESET] Encontradas ${instancesToReset.length} instâncias para processar`);

      if (instancesToReset.length === 0) {
        console.log('✅ [RESET] Nenhuma instância precisa de reset');
        return {
          totalProcessed: 0,
          successful: 0,
          skipped: 0,
          failed: 0,
          results: []
        };
      }

      // 2. Processar em batches (para evitar timeout)
      const batchSize = dto.batchSize || 25;
      const results: WeeklyResetResult[] = [];
      let successful = 0;
      let skipped = 0;
      let failed = 0;

      for (let i = 0; i < instancesToReset.length; i += batchSize) {
        const batch = instancesToReset.slice(i, i + batchSize);
        console.log(`🔄 [RESET] Processando batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(instancesToReset.length / batchSize)}`);

        const batchResults = await Promise.allSettled(
          batch.map(instance => dto.dryRun
            ? this.resetSingleInstance(instance)
            : this.executeResetForInstance(instance))
        );

        // Contabilizar resultados
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const instanceResult = result.value;
            results.push(instanceResult);

            if (instanceResult.status === 'success') {
              successful++;
              console.log(`✅ [RESET] ${instanceResult.instanceId} resetado para semana ${instanceResult.newWeekNumber}`);
            } else if (instanceResult.status === 'skipped') {
              skipped++;
              console.log(`⏭️ [RESET] ${instanceResult.instanceId} pulado: ${instanceResult.error}`);
            } else {
              failed++;
              console.log(`❌ [RESET] ${instanceResult.instanceId} erro: ${instanceResult.error}`);
            }
          } else {
            failed++;
            results.push({
              instanceId: batch[index].id,
              oldWeekNumber: batch[index].currentWeekNumber,
              newWeekNumber: batch[index].currentWeekNumber,
              newActivitiesCount: 0,
              status: 'error',
              error: (result.reason as any)?.message || 'Erro desconhecido'
            });
          }
        });
      }

      console.log(`🎉 [RESET] Concluído! ${successful} sucessos, ${skipped} ignorados, ${failed} falhas`);

      return {
        totalProcessed: instancesToReset.length,
        successful,
        skipped,
        failed,
        results
      };

    } catch (error: any) {
      console.error('❌ [RESET] Erro crítico no processo:', error);
      throw error;
    }
  }

  /**
   * Dry-run para uma única instância (apenas simula o reset)
   */
  private static async resetSingleInstance(
    instance: ScheduleInstance,
  ): Promise<WeeklyResetResult> {
    const instanceId = instance.id;
    const oldWeekNumber = instance.currentWeekNumber;

    console.log(`🔍 [DRY RUN] Simulando reset para ${instanceId}, semana ${oldWeekNumber}`);
    return {
      instanceId,
      oldWeekNumber,
      newWeekNumber: oldWeekNumber + 1,
      newActivitiesCount: 10, // Estimativa
      status: 'success',
      snapshotId: 'dry-run-snapshot-id'
    };
  }

  /**
   * Busca instâncias que precisam de reset
   */
  private static async findInstancesForReset(): Promise<ScheduleInstance[]> {
    try {
      // Buscar todas as instâncias ativas
      const q = query(
        collection(firestore, this.COLLECTIONS.INSTANCES),
        where('status', 'in', ['active', 'paused']),
        where('isActive', '==', true)
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

      // Filtrar apenas as que precisam de reset (em paralelo)
      const needsResetResults = await Promise.allSettled(
        instances.map(instance => this.needsWeeklyReset(instance))
      );
      const filteredInstances = instances.filter((_, i) => {
        const r = needsResetResults[i];
        return r.status === 'fulfilled' && r.value === true;
      });

      console.log(`📊 [RESET] ${filteredInstances.length}/${instances.length} instâncias precisam de reset`);
      return filteredInstances;

    } catch (error: any) {
      console.error('Erro ao buscar instâncias:', error);
      throw error;
    }
  }

  /**
   * Verifica se uma instância precisa de reset
   */
  private static async needsWeeklyReset(instance: ScheduleInstance): Promise<boolean> {
    try {
      if (instance.isActive === false) {
        return false;
      }

      // Recovery: se activitiesReady=false, houve reset parcial — permite re-processamento
      if ((instance as ScheduleInstance & { activitiesReady?: boolean }).activitiesReady === false) {
        console.log(`⚠️ [RESET] ${instance.id} tem activitiesReady=false — forçando recovery`);
        return true;
      }

      // Comparar a semana da instância com a semana atual pelo início da semana ISO.
      // Evita depender de snapshots (que podem ser criados ao longo da semana por updateWeeklySnapshot)
      // para detectar quando o último reset ocorreu.
      const thisWeekStart = DateUtils.getWeekStartDate(new Date());
      thisWeekStart.setHours(0, 0, 0, 0);

      let instanceWeekStart: Date = instance.currentWeekStartDate;
      if (instanceWeekStart && typeof (instanceWeekStart as any).toDate === 'function') {
        instanceWeekStart = (instanceWeekStart as any).toDate();
      }

      if (!instanceWeekStart) {
        return false;
      }

      const needsReset = instanceWeekStart < thisWeekStart;
      if (!needsReset) {
        return false;
      }

      return true;

    } catch (error) {
      console.error('Erro ao verificar necessidade de reset:', error);
      return false; // Em caso de erro, não resetar
    }
  }

  /**
   * Busca conteúdo do snapshot existente para a semana (para rollback)
   */
  private static async getSnapshotContent(
    instanceId: string,
    weekNumber: number
  ): Promise<DocumentData | null> {
    const q = query(
      collection(firestore, 'weeklySnapshots'),
      where('scheduleInstanceId', '==', instanceId),
      where('weekNumber', '==', weekNumber),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return snapshot.docs[0].data();
  }

  /**
   * Verifica se já existe snapshot para a semana
   */
  private static async getSnapshotForWeek(
    instanceId: string,
    weekNumber: number
  ): Promise<boolean> {
    try {
      const q = query(
        collection(firestore, 'weeklySnapshots'),
        where('scheduleInstanceId', '==', instanceId),
        where('weekNumber', '==', weekNumber),
        limit(1)
      );

      const snapshot = await getDocs(q);
      return !snapshot.empty;

    } catch (error) {
      return false;
    }
  }

  /**
   * Força reset para uma instância específica (para testes)
   */
  static async forceResetForInstance(
    instanceId: string
  ): Promise<WeeklyResetResult> {
    try {
      const instance = await ScheduleInstanceService.getScheduleInstanceById(instanceId);
      return await this.executeResetForInstance(instance);
    } catch (error: any) {
      throw new Error(`Falha no reset forçado: ${error.message}`);
    }
  }

  /**
 * Executa reset REAL (não dry run) para todas as instâncias
 * MÉTODO PARA COORDENADOR / CLOUD FUNCTION
 */
  static async executeFullWeeklyReset(dryRun: boolean = false): Promise<{
    totalInstances: number;
    processed: number;
    successful: number;
    failed: number;
    snapshotsGenerated: number;
    results: WeeklyResetResult[];
  }> {
    try {
      console.log(`🚀 [FULL RESET] Iniciando reset semanal COMPLETO${dryRun ? ' (DRY RUN)' : ''}`);
      console.log(`📅 Data atual: ${new Date().toLocaleDateString('pt-BR')}`);

      // 1. Buscar TODAS as instâncias
      const allInstances = await this.getAllActiveInstances();
      console.log(`📊 [FULL RESET] Total de instâncias ativas: ${allInstances.length}`);

      allInstances.forEach((instance, index) => {
        console.log(`   ${index + 1}. ${instance.id}`);
        console.log(`      Semana: ${instance.currentWeekNumber}`);
        console.log(`      Início: ${instance.currentWeekStartDate.toLocaleDateString('pt-BR')}`);
        console.log(`      Fim: ${instance.currentWeekEndDate.toLocaleDateString('pt-BR')}`);
        console.log(`      Status: ${instance.status}`);
        console.log(`      Progresso: ${instance.progressCache?.completedActivities || 0}/${instance.progressCache?.totalActivities || 0}`);
      });

      if (allInstances.length === 0) {
        console.log('ℹ️ [FULL RESET] Nenhuma instância ativa encontrada');
        return {
          totalInstances: 0,
          processed: 0,
          successful: 0,
          failed: 0,
          snapshotsGenerated: 0,
          results: []
        };
      }

      // 2. Filtrar apenas instâncias que realmente precisam de reset
      const needsResetResults = await Promise.allSettled(
        allInstances.map(instance => this.needsWeeklyReset(instance))
      );
      const instancesToReset = allInstances.filter((_, i) => {
        const r = needsResetResults[i];
        return r.status === 'fulfilled' && r.value === true;
      });
      console.log(`📊 [FULL RESET] Instâncias elegíveis para reset: ${instancesToReset.length}/${allInstances.length}`);

      if (instancesToReset.length === 0) {
        console.log('ℹ️ [FULL RESET] Nenhuma instância precisa de reset agora');
        return { totalInstances: allInstances.length, processed: 0, successful: 0, failed: 0, snapshotsGenerated: 0, results: [] };
      }

      // 3. Processar EM PARALELO (com limites)
      const BATCH_SIZE = 10; // Processar 10 por vez para não sobrecarregar
      const results: WeeklyResetResult[] = [];
      let successful = 0;
      let skipped = 0;
      let failed = 0;
      let snapshotsGenerated = 0;

      for (let i = 0; i < instancesToReset.length; i += BATCH_SIZE) {
        const batch = instancesToReset.slice(i, i + BATCH_SIZE);
        console.log(`🔄 [FULL RESET] Processando batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(instancesToReset.length / BATCH_SIZE)}`);

        const batchPromises = batch.map(instance =>
          dryRun
            ? this.resetSingleInstance(instance)
            : this.executeResetForInstance(instance)
        );

        const batchResults = await Promise.allSettled(batchPromises);

        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const instanceResult = result.value;
            results.push(instanceResult);

            if (instanceResult.status === 'success') {
              successful++;
              if (instanceResult.snapshotId) snapshotsGenerated++;
              console.log(`✅ [FULL RESET] ${instanceResult.instanceId} → Semana ${instanceResult.newWeekNumber}`);
            } else if (instanceResult.status === 'skipped') {
              skipped++;
              console.log(`⏭️ [FULL RESET] ${instanceResult.instanceId} pulado: ${instanceResult.error}`);
            } else {
              failed++;
              console.log(`❌ [FULL RESET] ${instanceResult.instanceId} erro: ${instanceResult.error}`);
            }
          } else {
            failed++;
            results.push({
              instanceId: batch[index].id,
              oldWeekNumber: batch[index].currentWeekNumber,
              newWeekNumber: batch[index].currentWeekNumber,
              newActivitiesCount: 0,
              status: 'error',
              error: (result.reason as any)?.message || 'Erro desconhecido'
            });
          }
        });

        // Pequena pausa entre batches para não sobrecarregar
        if (i + BATCH_SIZE < instancesToReset.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`🎉 [FULL RESET] CONCLUÍDO! Processadas: ${instancesToReset.length}, Sucessos: ${successful}, Falhas: ${failed}, Snapshots: ${snapshotsGenerated}`);

      return {
        totalInstances: allInstances.length,
        processed: instancesToReset.length,
        successful,
        failed,
        snapshotsGenerated,
        results
      };

    } catch (error: any) {
      console.error('❌ [FULL RESET] Erro crítico:', error);
      throw error;
    }
  }

  /**
   * Método auxiliar: Busca TODAS as instâncias ativas
   */
  private static async getAllActiveInstances(): Promise<ScheduleInstance[]> {
    const q = query(
      collection(firestore, this.COLLECTIONS.INSTANCES),
      where('status', 'in', ['active', 'paused']),
      where('isActive', '==', true)
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

    return instances;
  }

  /**
   * Método auxiliar: Executa reset completo para uma instância
   */
  private static async executeResetForInstance(
    instance: ScheduleInstance
  ): Promise<WeeklyResetResult> {
    const instanceId = instance.id;
    const oldWeekNumber = instance.currentWeekNumber;

    try {
      console.log(`🔄 [FULL RESET] Processando ${instanceId}, semana ${oldWeekNumber}`);

      // 🔥 CORREÇÃO: SALVAR VALORES ANTIGOS PARA LOG
      const oldCompleted = instance.progressCache?.completedActivities || 0;
      const oldTotal = instance.progressCache?.totalActivities || 0;

      // 1. Sempre gerar snapshot
      // Salvar snapshot existente ANTES de regenerar — para restauração no rollback
      let existingSnapshotData: DocumentData | null = null;
      let snapshotReadError = false;
      try {
        existingSnapshotData = await this.getSnapshotContent(instanceId, oldWeekNumber);
      } catch (e) {
        snapshotReadError = true;
        console.warn(`⚠️ [FULL RESET] Erro ao ler snapshot existente para ${instanceId}:`, e);
      }
      const snapshotExistedBefore = !snapshotReadError && existingSnapshotData !== null;
      let snapshotCreatedHere = false;
      let snapshotId: string | undefined;
      try {
        const snapshotResult = await WeeklySnapshotService.generateSnapshot({
          scheduleInstanceId: instanceId,
          weekNumber: oldWeekNumber,
          forceRegenerate: true
        });
        snapshotId = snapshotResult.snapshotId;
        if (!snapshotExistedBefore) {
          snapshotCreatedHere = true;
        }
      } catch (snapshotError: any) {
        console.warn(`⚠️ [FULL RESET] Erro ao gerar snapshot para ${instanceId}:`, snapshotError.message);
      }

      // 2. Verificar se cronograma ainda está dentro do período
      const shouldContinue = await this.shouldScheduleContinue(instance);
      if (!shouldContinue) {
        await ScheduleInstanceService.completeSchedule(instanceId);

        return {
          instanceId,
          oldWeekNumber,
          newWeekNumber: oldWeekNumber,
          snapshotId,
          newActivitiesCount: 0,
          status: 'success',
          error: 'Cronograma finalizado (fora do período)'
        };
      }

      // 3. Calcular nova semana
      const newWeekNumber = oldWeekNumber + 1;
      const newWeekStartDate = DateUtils.addWeeks(instance.currentWeekStartDate, 1);
      newWeekStartDate.setHours(0, 0, 0, 0);
      const newWeekEndDate = DateUtils.addWeeks(instance.currentWeekEndDate, 1);
      newWeekEndDate.setHours(23, 59, 59, 999);

      // 4. 🔥 CORREÇÃO CRÍTICA: ATUALIZAR INSTÂNCIA COM TRANSACTION
      // Usar transaction para garantir atomicidade
      await runTransaction(firestore, async (transaction) => {
        const instanceRef = doc(firestore, this.COLLECTIONS.INSTANCES, instanceId);
        const snap = await transaction.get(instanceRef);
        if (!snap.exists()) throw new Error(`Instância ${instanceId} não encontrada`);
        const currentData = snap.data();
        const currentWeek = currentData.currentWeekNumber;
        if (currentWeek !== oldWeekNumber) {
          // Outra instância já avançou a semana — sair silenciosamente sem erro
          // (não lançar exceção para não ativar o rollback e não deixar activitiesReady=false)
          const alreadyAdvanced = new Error(`__ALREADY_RESET__:${currentWeek}`);
          throw alreadyAdvanced;
        }

        // 🔥 FORÇAR ZERAMENTO DO PROGRESSCACHE (totalActivities será atualizado após geração)
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

        console.log(`🔒 [TRANSACTION] Zerando progressCache de ${oldCompleted}/${oldTotal} para 0/0 (total será calculado após geração)`);
      });

      console.log(`✅ [FULL RESET] ${instanceId} atualizada: semana ${oldWeekNumber} → ${newWeekNumber}`);

      // 5. GERAR NOVAS ATIVIDADES
      // activitiesReady=false foi escrito na transaction; só vira true após geração bem-sucedida.
      // Se o processo morrer aqui, activitiesReady permanece false — detectável por monitoramento/recovery.
      let newActivitiesCount = 0;
      try {
        newActivitiesCount = await this.generateNewWeekActivities(instanceId, newWeekNumber, newWeekStartDate);
        console.log(`📝 [FULL RESET] ${newActivitiesCount} novas atividades geradas`);
        await ScheduleInstanceService.updateProgressCache(instanceId, newWeekNumber);
        await updateDoc(doc(firestore, this.COLLECTIONS.INSTANCES, instanceId), {
          activitiesReady: true,
          updatedAt: serverTimestamp()
        });
      } catch (activityError: any) {
        console.warn(`⚠️ [FULL RESET] Erro ao gerar atividades — activitiesReady=false persiste para recovery:`, activityError.message);
        // Rollback ATÔMICO: instância + snapshot em uma única transaction
        try {
          const oldCompletionPct = oldTotal > 0 ? Math.round((oldCompleted / oldTotal) * 100) : 0;
          const rollbackData: Record<string, unknown> = {
            currentWeekNumber: oldWeekNumber,
            'progressCache.completedActivities': oldCompleted,
            'progressCache.totalActivities': oldTotal,
            'progressCache.completionPercentage': oldCompletionPct,
            'progressCache.totalPointsEarned': instance.progressCache?.totalPointsEarned || 0,
            activitiesReady: true,
            updatedAt: serverTimestamp()
          };
          rollbackData.currentWeekStartDate = instance.currentWeekStartDate
            ? Timestamp.fromDate(instance.currentWeekStartDate)
            : null;
          rollbackData.currentWeekEndDate = instance.currentWeekEndDate
            ? Timestamp.fromDate(instance.currentWeekEndDate)
            : null;

          await runTransaction(firestore, async (transaction) => {
            const instanceRef = doc(firestore, this.COLLECTIONS.INSTANCES, instanceId);
            transaction.update(instanceRef, rollbackData);

            if (!snapshotReadError && snapshotId) {
              const snapRef = doc(firestore, 'weeklySnapshots', snapshotId);
              if (existingSnapshotData) {
                transaction.set(snapRef, existingSnapshotData);
              } else if (snapshotCreatedHere) {
                transaction.delete(snapRef);
              }
            }
          });

          console.warn(`↩️ [FULL RESET] Rollback atômico concluído: instância ${instanceId} semana ${oldWeekNumber}, snapshot restaurado.`);
          return {
            instanceId,
            oldWeekNumber,
            newWeekNumber: oldWeekNumber,
            snapshotId,
            newActivitiesCount: 0,
            status: 'error',
            error: 'Rollback executado após falha na geração de atividades'
          };
        } catch (rollbackError: any) {
          console.error(`❌ [FULL RESET] Falha no rollback — instância ${instanceId} em estado inconsistente:`, rollbackError.message);
          return {
            instanceId,
            oldWeekNumber,
            newWeekNumber,
            snapshotId,
            newActivitiesCount: 0,
            status: 'error',
            error: `Falha na geração + rollback: ${rollbackError.message}`
          };
        }
      }

      return {
        instanceId,
        oldWeekNumber,
        newWeekNumber,
        snapshotId,
        newActivitiesCount,
        status: 'success'
      };

    } catch (error: any) {
      // Reset concorrente detectado: outra execução paralela já avançou a semana.
      // Tratar como skipped (não como erro) para não incrementar contadores de falha.
      if (typeof (error as any)?.message === 'string' && (error as any).message.startsWith('__ALREADY_RESET__')) {
        const advancedWeek = parseInt(error.message.split(':')[1], 10) || oldWeekNumber + 1;
        console.log(`⏭️ [FULL RESET] ${instanceId} já foi resetado por execução paralela — semana atual: ${advancedWeek}`);
        return {
          instanceId,
          oldWeekNumber,
          newWeekNumber: advancedWeek,
          newActivitiesCount: 0,
          status: 'skipped',
          error: 'Reset já executado por execução paralela'
        };
      }

      console.error(`❌ [FULL RESET] Erro em ${instanceId}:`, error);
      return {
        instanceId,
        oldWeekNumber,
        newWeekNumber: oldWeekNumber,
        newActivitiesCount: 0,
        status: 'error',
        error: String(error?.message ?? error)
      };
    }
  }

  /**
   * Verifica se cronograma deve continuar (baseado em endDate)
   */
  private static async shouldScheduleContinue(instance: ScheduleInstance): Promise<boolean> {
    try {
      // Buscar template para ver endDate
      const scheduleTemplate = await this.getScheduleTemplate(instance.scheduleTemplateId);

      if (!scheduleTemplate.endDate) {
        return true; // Sem data de fim, continua indefinidamente
      }

      // CORREÇÃO: Usar a data de INÍCIO da PRÓXIMA semana
      const nextWeekStart = DateUtils.addWeeks(instance.currentWeekStartDate, 1);

      // IMPORTANTE: Comparar apenas datas (ignorar horas)
      const nextWeekStartDateOnly = new Date(nextWeekStart.getFullYear(), nextWeekStart.getMonth(), nextWeekStart.getDate());
      const templateEndDateOnly = new Date(scheduleTemplate.endDate.getFullYear(), scheduleTemplate.endDate.getMonth(), scheduleTemplate.endDate.getDate());

      console.log(`📅 [CONTINUE CHECK] Instância ${instance.id}:`);
      console.log(`   - Próxima semana: ${nextWeekStartDateOnly.toLocaleDateString()}`);
      console.log(`   - Template endDate: ${templateEndDateOnly.toLocaleDateString()}`);
      console.log(`   - Deve continuar? ${nextWeekStartDateOnly <= templateEndDateOnly}`);

      return nextWeekStartDateOnly <= templateEndDateOnly;

    } catch (error) {
      console.warn('Erro ao verificar continuidade do cronograma:', error);
      return true; // Em caso de erro, assume que continua
    }
  }

  /**
   * Gera novas atividades para a nova semana
   */
  private static async generateNewWeekActivities(
    instanceId: string,
    weekNumber: number,
    weekStartDate?: Date
  ): Promise<number> {
    await ScheduleInstanceService.generateWeekActivities(instanceId, weekNumber, weekStartDate);
    const weekProgress = await ScheduleInstanceService.getWeekProgress(instanceId, weekNumber);
    if (weekProgress.length === 0) {
      console.warn(`⚠️ Nenhuma atividade gerada para instância ${instanceId} semana ${weekNumber} — verifique visibilidade do template`);
    }
    return weekProgress.length;
  }

  /**
   * Busca template do cronograma
   */
  private static async getScheduleTemplate(templateId: string): Promise<any> {
    // Implementação simplificada
    const templateDoc = await getDoc(doc(firestore, 'weeklySchedules', templateId));
    if (!templateDoc.exists()) {
      throw new Error('Template não encontrado');
    }

    const data = templateDoc.data();
    return {
      ...data,
      startDate: data.startDate?.toDate(),
      endDate: data.endDate?.toDate()
    };
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
      const now = new Date();
      const nextMonday = new Date(now);
      const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
      nextMonday.setDate(now.getDate() + daysUntilMonday);
      nextMonday.setHours(0, 1, 0, 0);
      const instances = await this.findInstancesForReset();
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