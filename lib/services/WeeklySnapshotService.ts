import {
  collection,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
  writeBatch,
  DocumentData
} from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import {
  WeeklySnapshot,
  ScheduleInstance,
  ActivityProgress,
  ActivityType,
  GenerateSnapshotDTO
} from '@/types/schedule';
import { ScheduleInstanceService } from './ScheduleInstanceService';
import { DateUtils } from '@/lib/utils/dateUtils';
import { ActivityData, calculateWeeklyMetrics as computeMetrics } from '@/lib/utils/weeklyMetrics';

export class WeeklySnapshotService {
  private static readonly COLLECTIONS = {
    SNAPSHOTS: 'weeklySnapshots', // Nome mais claro
    PROGRESS: 'activityProgress',
    INSTANCES: 'scheduleInstances'
  };

  /**
   * Gera snapshot da semana que terminou
   * Método PRINCIPAL do Sprint 1
   */
  static async generateSnapshot(
    dto: GenerateSnapshotDTO
  ): Promise<{ snapshotId: string; metrics: any; error?: string }> {
    try {
      console.log(`📊 [SNAPSHOT] Gerando para instância ${dto.scheduleInstanceId}, semana ${dto.weekNumber}`);

      // 1. Verificar se snapshot já existe
      const existingSnapshot = await this.getSnapshotByWeek(
        dto.scheduleInstanceId,
        dto.weekNumber
      );

      if (existingSnapshot && !dto.forceRegenerate) {
        console.log(`📊 [SNAPSHOT] Já existe para semana ${dto.weekNumber}, retornando existente`);
        return {
          snapshotId: existingSnapshot.id,
          metrics: existingSnapshot.metrics
        };
      }

      // 2. Buscar progresso da semana
      const progress = await ScheduleInstanceService.getWeekProgress(
        dto.scheduleInstanceId,
        dto.weekNumber
      );

      if (progress.length === 0) {
        throw new Error(`Nenhuma atividade encontrada para semana ${dto.weekNumber}`);
      }

      // 3. Buscar instância para metadados
      const instance = await ScheduleInstanceService.getScheduleInstanceById(
        dto.scheduleInstanceId
      );

      // 4. Calcular métricas
      const metrics = this.calculateWeeklyMetrics(progress);
      const dailyBreakdown = this.calculateDailyBreakdown(progress);
      const activityTypeBreakdown = this.calculateActivityTypeBreakdown(progress);

      // 5. Criar ID único
      const snapshotId = this.generateSnapshotId(
        instance.studentId,
        dto.scheduleInstanceId,
        dto.weekNumber
      );

      // 6. Montar snapshot
      const snapshotData: Omit<WeeklySnapshot, 'id'> = {
        scheduleInstanceId: dto.scheduleInstanceId,
        studentId: instance.studentId,
        weekNumber: dto.weekNumber,
        weekStartDate: dto.weekNumber === instance.currentWeekNumber
          ? instance.currentWeekStartDate
          : DateUtils.addWeeks(instance.currentWeekStartDate, dto.weekNumber - instance.currentWeekNumber),
        weekEndDate: dto.weekNumber === instance.currentWeekNumber
          ? instance.currentWeekEndDate
          : DateUtils.addWeeks(instance.currentWeekEndDate, dto.weekNumber - instance.currentWeekNumber),
        metrics,
        dailyBreakdown,
        activityTypeBreakdown,
        metadata: {
          scheduleTemplateName: instance.scheduleName || 'Cronograma',
          scheduleTemplateId: instance.scheduleTemplateId,
          professionalId: instance.professionalId,
          generatedBy: 'system',
          dataSource: 'calculated'
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      };

      // 7. Salvar no Firestore
      const snapshotPayload = {
        ...snapshotData,
        weekStartDate: Timestamp.fromDate(snapshotData.weekStartDate),
        weekEndDate: Timestamp.fromDate(snapshotData.weekEndDate),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await setDoc(
        doc(firestore, this.COLLECTIONS.SNAPSHOTS, snapshotId),
        snapshotPayload,
        dto.forceRegenerate ? {} : { merge: true }
      );

      console.log(`✅ [SNAPSHOT] Gerado com sucesso: ${snapshotId}`);
      console.log(`📈 Métricas: ${metrics.completionRate}% completado, ${metrics.totalPointsEarned} pontos`);

      return {
        snapshotId,
        metrics
      };

    } catch (error: any) {
      console.error(`❌ [SNAPSHOT] Erro ao gerar:`, error);
      return {
        snapshotId: '',
        metrics: {},
        error: `Falha ao gerar snapshot: ${error.message}`
      };
    }
  }

  /**
   * Calcula métricas básicas da semana usando shared utils
   */
  private static calculateWeeklyMetrics(progress: ActivityProgress[]) {
    const adapted: ActivityData[] = progress.map(p => ({
      status: p.status,
      dayOfWeek: p.dayOfWeek,
      scoring: p.scoring,
      executionData: p.executionData,
      scheduledDate: p.scheduledDate,
      completedAt: p.completedAt,
    }));
    return computeMetrics(adapted);
  }

  /**
   * Calcula breakdown por dia
   */
  private static calculateDailyBreakdown(progress: ActivityProgress[]) {
    const breakdown: Record<number, {
      total: number;
      completed: number;
      skipped: number;
      pointsEarned: number;
      timeSpent: number;
    }> = {};

    // Inicializar todos os dias (0-6)
    for (let i = 0; i < 7; i++) {
      breakdown[i] = {
        total: 0,
        completed: 0,
        skipped: 0,
        pointsEarned: 0,
        timeSpent: 0
      };
    }

    // Preencher com dados reais
    progress.forEach(item => {
      const day = item.dayOfWeek;
      breakdown[day].total++;

      if (item.status === 'completed') {
        breakdown[day].completed++;
        breakdown[day].pointsEarned += item.scoring?.pointsEarned || 0;
        breakdown[day].timeSpent += item.executionData?.timeSpent || 0;
      } else if (item.status === 'skipped') {
        breakdown[day].skipped++;
      }
    });

    return breakdown;
  }

  /**
   * Calcula breakdown por tipo de atividade
   */
  private static calculateActivityTypeBreakdown(progress: ActivityProgress[]) {
    const breakdown: Record<ActivityType, {
      total: number;
      completed: number;
      averagePoints: number;
      averageTime: number;
    }> = {} as any;

    // Inicializar contadores
    const tempData: Record<string, {
      total: number;
      completed: number;
      totalPoints: number;
      totalTime: number;
    }> = {};

    progress.forEach(item => {
      const type = item.activitySnapshot?.type || 'unknown';

      if (!tempData[type]) {
        tempData[type] = {
          total: 0,
          completed: 0,
          totalPoints: 0,
          totalTime: 0
        };
      }

      tempData[type].total++;

      if (item.status === 'completed') {
        tempData[type].completed++;
        tempData[type].totalPoints += item.scoring?.pointsEarned || 0;
        tempData[type].totalTime += item.executionData?.timeSpent || 0;
      }
    });

    // Calcular médias
    Object.entries(tempData).forEach(([type, data]) => {
      breakdown[type as ActivityType] = {
        total: data.total,
        completed: data.completed,
        averagePoints: data.completed > 0 ? data.totalPoints / data.completed : 0,
        averageTime: data.completed > 0 ? data.totalTime / data.completed : 0
      };
    });

    return breakdown;
  }

  /**
   * Busca snapshots de um aluno
   */
  static async getStudentSnapshots(
    studentId: string,
    options: {
      limit?: number;
      scheduleInstanceId?: string;
    } = {}
  ): Promise<WeeklySnapshot[]> {
    try {
      let q = query(
        collection(firestore, this.COLLECTIONS.SNAPSHOTS),
        where('studentId', '==', studentId),
        where('isActive', '==', true)
      );

      if (options.scheduleInstanceId) {
        q = query(q, where('scheduleInstanceId', '==', options.scheduleInstanceId));
      }

      q = query(q, where('weekNumber', '>', 0)); // Semanas válidas apenas

      const snapshot = await getDocs(q);
      const snapshots: WeeklySnapshot[] = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        snapshots.push({
          id: doc.id,
          ...data,
          weekStartDate: data.weekStartDate?.toDate(),
          weekEndDate: data.weekEndDate?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate()
        } as WeeklySnapshot);
      });

      // Ordenar por semana (mais recente primeiro)
      snapshots.sort((a, b) => b.weekNumber - a.weekNumber);

      // Aplicar limite
      if (options.limit) {
        return snapshots.slice(0, options.limit);
      }

      return snapshots;

    } catch (error: any) {
      console.error('Erro ao buscar snapshots:', error);
      return [];
    }
  }

  /**
   * Busca snapshot específico
   */
  private static async getSnapshotByWeek(
    scheduleInstanceId: string,
    weekNumber: number
  ): Promise<WeeklySnapshot | null> {
    try {
      const q = query(
        collection(firestore, this.COLLECTIONS.SNAPSHOTS),
        where('scheduleInstanceId', '==', scheduleInstanceId),
        where('weekNumber', '==', weekNumber),
        where('isActive', '==', true)
      );
      // Nota: a query usa scheduleInstanceId+weekNumber (sem studentId)
      // porque GenerateSnapshotDTO não carrega studentId.
      // O ID do documento inclui studentId, mas a query busca por campos.

      const snapshot = await getDocs(q);

      if (snapshot.empty) return null;

      const doc = snapshot.docs[0];
      const data = doc.data();

      return {
        id: doc.id,
        ...data,
        weekStartDate: data.weekStartDate?.toDate(),
        weekEndDate: data.weekEndDate?.toDate(),
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate()
      } as WeeklySnapshot;

    } catch (error) {
      console.error('Erro ao buscar snapshot:', error);
      return null;
    }
  }

  /**
   * Gera ID único para snapshot
   */
  private static generateSnapshotId(
    studentId: string,
    scheduleInstanceId: string,
    weekNumber: number
  ): string {
    return `${studentId}_${scheduleInstanceId}_week_${weekNumber}`;
  }
}