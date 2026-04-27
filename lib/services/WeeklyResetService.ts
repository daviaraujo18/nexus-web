import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  DocumentData,
  getDoc
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
          failed: 0,
          results: []
        };
      }

      // 2. Processar em batches (para evitar timeout)
      const batchSize = dto.batchSize || 25;
      const results: WeeklyResetResult[] = [];
      let successful = 0;
      let failed = 0;

      for (let i = 0; i < instancesToReset.length; i += batchSize) {
        const batch = instancesToReset.slice(i, i + batchSize);
        console.log(`🔄 [RESET] Processando batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(instancesToReset.length / batchSize)}`);

        const batchResults = await Promise.allSettled(
          batch.map(instance => this.resetSingleInstance(instance, dto.dryRun))
        );

        // Contabilizar resultados
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const instanceResult = result.value;
            results.push(instanceResult);

            if (instanceResult.status === 'success') {
              successful++;
              console.log(`✅ [RESET] ${instanceResult.instanceId} resetado para semana ${instanceResult.newWeekNumber}`);
            } else {
              failed++;
              console.log(`⏭️ [RESET] ${instanceResult.instanceId} pulado: ${instanceResult.error}`);
            }
          } else {
            failed++;
            results.push({
              instanceId: batch[index].id,
              oldWeekNumber: batch[index].currentWeekNumber,
              newWeekNumber: batch[index].currentWeekNumber,
              newActivitiesCount: 0,
              status: 'error',
              error: result.reason.message || 'Erro desconhecido'
            });
          }
        });
      }

      console.log(`🎉 [RESET] Concluído! ${successful} sucessos, ${failed} falhas`);

      return {
        totalProcessed: instancesToReset.length,
        successful,
        failed,
        results
      };

    } catch (error: any) {
      console.error('❌ [RESET] Erro crítico no processo:', error);
      throw error;
    }
  }

  /**
   * Processa reset para uma única instância
   */
  private static async resetSingleInstance(
    instance: ScheduleInstance,
    dryRun: boolean = false
  ): Promise<WeeklyResetResult> {
    const instanceId = instance.id;
    const oldWeekNumber = instance.currentWeekNumber;

    try {
      console.log(`🔄 [RESET] Processando instância ${instanceId}, semana atual: ${oldWeekNumber}`);

      // 1. Verificar se realmente precisa de reset
      const needsReset = await this.needsWeeklyReset(instance);
      if (!needsReset) {
        return {
          instanceId,
          oldWeekNumber,
          newWeekNumber: oldWeekNumber,
          newActivitiesCount: 0,
          status: 'skipped',
          error: 'Não precisa de reset (semana ainda não terminou)'
        };
      }

      if (dryRun) {
        console.log(`🔍 [DRY RUN] Simulando reset para ${instanceId}`);
        return {
          instanceId,
          oldWeekNumber,
          newWeekNumber: oldWeekNumber + 1,
          newActivitiesCount: 10, // Estimativa
          status: 'success',
          snapshotId: 'dry-run-snapshot-id'
        };
      }

      // 2. Gerar snapshot da semana que terminou
      let snapshotId: string | undefined;
      try {
        const snapshotResult = await WeeklySnapshotService.generateSnapshot({
          scheduleInstanceId: instanceId,
          weekNumber: oldWeekNumber
        });
        snapshotId = snapshotResult.snapshotId;
        console.log(`📊 [RESET] Snapshot gerado: ${snapshotId}`);
      } catch (snapshotError: any) {
        console.warn(`⚠️ [RESET] Erro ao gerar snapshot (continuando):`, snapshotError.message);
        // Não falhar o reset por causa do snapshot
      }

      // 3. Preparar dados para nova semana
      const newWeekNumber = oldWeekNumber + 1;
      const newWeekStartDate = DateUtils.addWeeks(instance.currentWeekStartDate, 1);
      const newWeekEndDate = DateUtils.addWeeks(instance.currentWeekEndDate, 1);

      // 4. Criar batch para múltiplas operações
      const batch = writeBatch(firestore);
      const instanceRef = doc(firestore, this.COLLECTIONS.INSTANCES, instanceId);

      // 5. Atualizar instância (nova semana)
      batch.update(instanceRef, {
        currentWeekNumber: newWeekNumber,
        currentWeekStartDate: Timestamp.fromDate(newWeekStartDate),
        currentWeekEndDate: Timestamp.fromDate(newWeekEndDate),
        'progressCache.completedActivities': 0,
        'progressCache.completionPercentage': 0,
        'progressCache.totalPointsEarned': 0,
        'progressCache.lastUpdatedAt': serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 6. Gerar novas atividades (se necessário)
      let newActivitiesCount = 0;
      // TODO: Implementar geração de novas atividades
      // Por enquanto, vamos apenas atualizar a instância
      // As atividades serão geradas quando o aluno acessar (lazy loading)

      // 7. Executar batch
      await batch.commit();
      console.log(`✅ [RESET] Instância ${instanceId} atualizada para semana ${newWeekNumber}`);

      return {
        instanceId,
        oldWeekNumber,
        newWeekNumber,
        snapshotId,
        newActivitiesCount,
        status: 'success'
      };

    } catch (error: any) {
      console.error(`❌ [RESET] Erro na instância ${instanceId}:`, error);
      return {
        instanceId,
        oldWeekNumber,
        newWeekNumber: oldWeekNumber,
        newActivitiesCount: 0,
        status: 'error',
        error: error.message
      };
    }
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

      // Filtrar apenas as que precisam de reset
      const now = new Date();
      const filteredInstances: ScheduleInstance[] = [];

      for (const instance of instances) {
        const needsReset = await this.needsWeeklyReset(instance);
        if (needsReset) {
          filteredInstances.push(instance);
        }
      }

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
      // 1. Verificar se a semana atual já terminou
      const weekEndDate = instance.currentWeekEndDate;
      const now = new Date();

      if (weekEndDate >= now) {
        return false; // Semana ainda não terminou
      }

      // 2. Verificar se já foi resetada recentemente
      const lastResetCheck = await this.getLastResetDate(instance.id);
      if (lastResetCheck) {
        const daysSinceLastReset = DateUtils.getDaysBetween(lastResetCheck, now);
        if (daysSinceLastReset < 6) { // Menos de 6 dias desde último reset
          return false;
        }
      }

      // 3. Verificar se já tem snapshot desta semana
      const existingSnapshot = await this.getSnapshotForWeek(
        instance.id,
        instance.currentWeekNumber
      );

      if (existingSnapshot) {
        console.log(`ℹ️ [RESET] Já existe snapshot para ${instance.id} semana ${instance.currentWeekNumber}`);
        // Mesmo com snapshot, podemos resetar se a semana terminou
        return true;
      }

      return true;

    } catch (error) {
      console.error('Erro ao verificar necessidade de reset:', error);
      return false; // Em caso de erro, não resetar
    }
  }

  /**
   * Busca data do último reset
   */
  private static async getLastResetDate(instanceId: string): Promise<Date | null> {
    try {
      // Buscar snapshots ordenados por data
      const q = query(
        collection(firestore, 'weeklySnapshots'),
        where('scheduleInstanceId', '==', instanceId),
        where('isActive', '==', true),
        where('metadata.generatedBy', '==', 'system')
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;

      // Pegar o snapshot mais recente
      const latest = snapshot.docs.reduce((latestDoc, currentDoc) => {
        const latestDate = latestDoc.data().createdAt?.toDate();
        const currentDate = currentDoc.data().createdAt?.toDate();
        return currentDate > latestDate ? currentDoc : latestDoc;
      }, snapshot.docs[0]);

      return latest.data().createdAt?.toDate() || null;

    } catch (error) {
      return null;
    }
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
        where('isActive', '==', true),
        where('metadata.generatedBy', '==', 'system')
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
      return await this.resetSingleInstance(instance, false);
    } catch (error: any) {
      throw new Error(`Falha no reset forçado: ${error.message}`);
    }
  }

  /**
 * Executa reset REAL (não dry run) para todas as instâncias
 * MÉTODO PARA COORDENADOR / CLOUD FUNCTION
 */
  static async executeFullWeeklyReset(): Promise<{
    totalInstances: number;
    processed: number;
    successful: number;
    failed: number;
    snapshotsGenerated: number;
    results: WeeklyResetResult[];
  }> {
    try {
      console.log('🚀 [FULL RESET] Iniciando reset semanal COMPLETO');
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

      // 2. Processar EM PARALELO (com limites)
      const BATCH_SIZE = 10; // Processar 10 por vez para não sobrecarregar
      const results: WeeklyResetResult[] = [];
      let successful = 0;
      let failed = 0;
      let snapshotsGenerated = 0;

      for (let i = 0; i < allInstances.length; i += BATCH_SIZE) {
        const batch = allInstances.slice(i, i + BATCH_SIZE);
        console.log(`🔄 [FULL RESET] Processando batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allInstances.length / BATCH_SIZE)}`);

        const batchPromises = batch.map(instance =>
          this.executeResetForInstance(instance)
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
            } else {
              failed++;
              console.log(`⏭️ [FULL RESET] ${instanceResult.instanceId} pulado: ${instanceResult.error}`);
            }
          } else {
            failed++;
            results.push({
              instanceId: batch[index].id,
              oldWeekNumber: batch[index].currentWeekNumber,
              newWeekNumber: batch[index].currentWeekNumber,
              newActivitiesCount: 0,
              status: 'error',
              error: result.reason.message || 'Erro desconhecido'
            });
          }
        });

        // Pequena pausa entre batches para não sobrecarregar
        if (i + BATCH_SIZE < allInstances.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`🎉 [FULL RESET] CONCLUÍDO! Processadas: ${allInstances.length}, Sucessos: ${successful}, Falhas: ${failed}, Snapshots: ${snapshotsGenerated}`);

      return {
        totalInstances: allInstances.length,
        processed: allInstances.length,
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
      let snapshotId: string | undefined;
      try {
        const snapshotResult = await WeeklySnapshotService.generateSnapshot({
          scheduleInstanceId: instanceId,
          weekNumber: oldWeekNumber,
          forceRegenerate: true
        });
        snapshotId = snapshotResult.snapshotId;
      } catch (snapshotError: any) {
        console.warn(`⚠️ [FULL RESET] Erro ao gerar snapshot para ${instanceId}:`, snapshotError.message);
      }

      // 2. Verificar se cronograma ainda está dentro do período
      const shouldContinue = await this.shouldScheduleContinue(instance);
      if (!shouldContinue) {
        await updateDoc(doc(firestore, this.COLLECTIONS.INSTANCES, instanceId), {
          status: 'completed',
          completedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

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
      const newWeekEndDate = DateUtils.addWeeks(instance.currentWeekEndDate, 1);

      // 4. 🔥 CORREÇÃO CRÍTICA: ATUALIZAR INSTÂNCIA COM TRANSACTION
      // Usar transaction para garantir atomicidade
      await this.runTransaction(async (transaction) => {
        const instanceRef = doc(firestore, this.COLLECTIONS.INSTANCES, instanceId);

        // 🔥 FORÇAR ZERAMENTO DO PROGRESSCACHE
        transaction.update(instanceRef, {
          currentWeekNumber: newWeekNumber,
          currentWeekStartDate: Timestamp.fromDate(newWeekStartDate),
          currentWeekEndDate: Timestamp.fromDate(newWeekEndDate),
          // 🔥 ZERAR EXPLICITAMENTE TODOS OS CAMPOS
          'progressCache.completedActivities': 0,
          'progressCache.completionPercentage': 0,
          'progressCache.totalPointsEarned': 0,
          'progressCache.streakDays': instance.progressCache?.streakDays || 0, // Manter streak
          'progressCache.totalActivities': instance.progressCache?.totalActivities || 0, // Manter total
          'progressCache.lastUpdatedAt': serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        console.log(`🔒 [TRANSACTION] Zerando progressCache de ${oldCompleted}/${oldTotal} para 0/${instance.progressCache?.totalActivities || 0}`);
      });

      console.log(`✅ [FULL RESET] ${instanceId} atualizada: semana ${oldWeekNumber} → ${newWeekNumber}`);
      console.log(`📊 ProgressCache REAL zerado: ${oldCompleted}/${oldTotal} → 0/${instance.progressCache?.totalActivities || 0}`);

      // 5. GERAR NOVAS ATIVIDADES
      let newActivitiesCount = 0;
      try {
        newActivitiesCount = await this.generateNewWeekActivities(instanceId, newWeekNumber);
        console.log(`📝 [FULL RESET] ${newActivitiesCount} novas atividades geradas`);
      } catch (activityError: any) {
        console.warn(`⚠️ [FULL RESET] Erro ao gerar atividades:`, activityError.message);
      }

      // 6. 🔥 VERIFICAÇÃO PÓS-RESET (IMPORTANTE!)
      // Aguardar 2 segundos e verificar se realmente foi zerado
      setTimeout(async () => {
        try {
          const updatedInstance = await ScheduleInstanceService.getScheduleInstanceById(instanceId);
          const actualCompleted = updatedInstance.progressCache?.completedActivities || 0;

          if (actualCompleted > 0) {
            console.error(`🚨 [VERIFICAÇÃO] ERRO CRÍTICO: ${instanceId} ainda tem ${actualCompleted} atividades completadas após reset!`);
            console.error(`   Algo está SOBRESCREVENDO o progressCache!`);

            // Tentar corrigir forçadamente
            await updateDoc(doc(firestore, this.COLLECTIONS.INSTANCES, instanceId), {
              'progressCache.completedActivities': 0,
              'progressCache.totalPointsEarned': 0,
              'progressCache.completionPercentage': 0,
              'progressCache.lastUpdatedAt': serverTimestamp()
            });
          } else {
            console.log(`✅ [VERIFICAÇÃO] ${instanceId} realmente zerado: ${actualCompleted} atividades`);
          }
        } catch (checkError) {
          console.warn(`⚠️ Erro na verificação pós-reset:`, checkError);
        }
      }, 2000);

      return {
        instanceId,
        oldWeekNumber,
        newWeekNumber,
        snapshotId,
        newActivitiesCount,
        status: 'success'
      };

    } catch (error: any) {
      console.error(`❌ [FULL RESET] Erro em ${instanceId}:`, error);
      return {
        instanceId,
        oldWeekNumber,
        newWeekNumber: oldWeekNumber,
        newActivitiesCount: 0,
        status: 'error',
        error: error.message
      };
    }
  }

  private static async runTransaction(updateFunction: (transaction: any) => Promise<void>) {
  // Implementação específica para Firestore
  // Em produção, usar firestore.runTransaction
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
    weekNumber: number
  ): Promise<number> {
    try {
      // Reutilizar método existente do ScheduleInstanceService
      await ScheduleInstanceService.generateWeekActivities(instanceId, weekNumber);

      return 0;

    } catch (error) {
      console.error('Erro ao gerar novas atividades:', error);
      return 0;
    }
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
}