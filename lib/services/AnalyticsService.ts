// services/AnalyticsService.ts
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  Timestamp,
  DocumentData,
  QuerySnapshot,
  doc,
  getDoc
} from 'firebase/firestore';
import {
  AnalyticsFilters,
  ComparativeAnalysis,
  StudentAnalyticsSummary,
  StudentWeeklyMetrics,
  CorrelationAnalysis,
  AggregatedMetrics,
  DateRange,
  DistributionData,
  StudentRankingItem,
  Insight,
  AnalyticsTrend
} from '@/types/analytics';
import { WeeklySnapshot } from '@/types/schedule';
import { GAD7Assessment, GAD7Severity } from '@/types/GAD7';
import { SnapshotAggregator } from './SnapshotAggregator';
import { GAD7CorrelationService } from './GAD7CorrelationService';
import { subWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { firestore } from '@/firebase/config';
import { UserRole } from '@/types/auth';

export class AnalyticsService {
  private snapshotAggregator: SnapshotAggregator;
  private correlationService: GAD7CorrelationService;
  private userRole: UserRole;

  constructor(userRole: UserRole = 'psychologist') {
    this.snapshotAggregator = new SnapshotAggregator();
    this.correlationService = new GAD7CorrelationService();
    this.userRole = userRole;
  }

  // ============================================
  // MÉTODOS PRINCIPAIS
  // ============================================

  async getComparativeAnalysis(
    userId: string,
    filters: AnalyticsFilters
  ): Promise<ComparativeAnalysis> {
    try {
      // 1. Determinar período
      const dateRange = this.getDateRangeFromFilters(filters);

      // 2. Buscar todos os students que o usuário tem acesso
      const accessibleStudentIds = await this.getAccessibleStudentIds(userId);

      // 3. Se não tem alunos acessíveis, retorna dados vazios
      if (accessibleStudentIds.length === 0) {
        return this.getEmptyComparativeAnalysis(dateRange);
      }

      // 4. Buscar snapshots do período (agora com accessibleStudentIds)
      const snapshots = await this.fetchSnapshots(userId, dateRange, filters, accessibleStudentIds);

      // 5. Buscar avaliações GAD7 do período
      const gad7Assessments = await this.fetchGAD7Assessments(userId, dateRange, filters, accessibleStudentIds);

      // 6. Agregar métricas
      const metrics = await this.snapshotAggregator.aggregateMetrics(snapshots, gad7Assessments);

      // 7. Gerar rankings
      const studentRankings = await this.generateRankings(snapshots, gad7Assessments, filters, accessibleStudentIds);

      // 8. Calcular distribuições
      const distributions = await this.calculateDistributions(snapshots, gad7Assessments);

      // 9. Gerar heatmap da turma
      const classHeatmap = await this.generateClassHeatmap(snapshots);

      // 10. Gerar insights
      const classInsights = await this.generateClassInsights(metrics, studentRankings);

      // 11. Comparar com período anterior (se aplicável)
      let comparison;
      if (filters.period !== 'custom' || filters.customRange) {
        const previousPeriod = this.getPreviousPeriod(dateRange);
        const previousSnapshots = await this.fetchSnapshots(userId, previousPeriod, filters, accessibleStudentIds);
        const previousMetrics = await this.snapshotAggregator.aggregateMetrics(previousSnapshots, []);
        comparison = this.calculateComparison(metrics, previousMetrics);
      }

      return {
        period: dateRange,
        previousPeriod: comparison ? this.getPreviousPeriod(dateRange) : undefined,
        summary: {
          totalStudents: accessibleStudentIds.length,
          activeStudents: this.getActiveStudentCount(snapshots),
          studentsWithGAD7: this.getStudentsWithGAD7Count(gad7Assessments),
          metrics
        },
        studentRankings,
        comparison,
        classInsights,
        distributions,
        classHeatmap
      };
    } catch (error) {
      console.error('Error in getComparativeAnalysis:', error);
      throw error;
    }
  }

  async getStudentAnalytics(
    studentId: string,
    userId: string,
    weeks: number = 8
  ): Promise<StudentAnalyticsSummary> {
    try {
      // 1. Verificar se o usuário tem acesso a este aluno
      const hasAccess = await this.checkStudentAccess(userId, studentId);
      if (!hasAccess) {
        throw new Error('Acesso negado a este aluno');
      }

      // 2. Buscar snapshots do aluno
      const snapshots = await this.fetchStudentSnapshots(studentId, userId, weeks);

      // 3. Buscar avaliações GAD7
      const gad7Assessments = await this.fetchStudentGAD7(studentId, weeks);

      // 4. Buscar dados do aluno
      const studentData = await this.fetchStudentData(studentId);

      // 5. Calcular métricas atuais
      const currentMetrics = this.calculateCurrentMetrics(snapshots, gad7Assessments);

      // 6. Gerar histórico semanal
      const weeklyHistory = this.generateWeeklyHistory(snapshots, gad7Assessments);

      // 7. Calcular tendências
      const trends = this.calculateTrends(weeklyHistory);

      // 8. Calcular comparações
      const comparisons = await this.calculateComparisons(studentId, snapshots, userId);

      // 9. Gerar insights
      const insights = this.generateStudentInsights(
        studentId,
        currentMetrics,
        weeklyHistory,
        trends,
        comparisons
      );

      // 10. Avaliar risco
      const riskLevel = this.assessRiskLevel(currentMetrics, trends, weeklyHistory);
      const riskFactors = this.identifyRiskFactors(currentMetrics, trends, weeklyHistory);

      return {
        studentId,
        studentName: studentData.name,
        studentGrade: studentData.grade || 'Não informado',
        studentSchool: studentData.school || 'Não informado',
        profileImage: studentData.profileImage,
        currentMetrics,
        trends,
        weeklyHistory,
        comparisons,
        insights,
        riskLevel,
        riskFactors
      };
    } catch (error) {
      console.error('Error in getStudentAnalytics:', error);
      throw error;
    }
  }

  async getCorrelationAnalysis(
    userId: string,
    filters: AnalyticsFilters
  ): Promise<CorrelationAnalysis> {
    try {
      const dateRange = this.getDateRangeFromFilters(filters);
      const accessibleStudentIds = await this.getAccessibleStudentIds(userId);

      // Buscar todos os dados necessários
      const snapshots = await this.fetchSnapshots(userId, dateRange, filters, accessibleStudentIds);
      const assessments = await this.fetchGAD7Assessments(userId, dateRange, filters, accessibleStudentIds);

      // Calcular correlações
      return this.correlationService.analyzeCorrelations(snapshots, assessments);
    } catch (error) {
      console.error('Error in getCorrelationAnalysis:', error);
      throw error;
    }
  }

  // ============================================
  // MÉTODOS DE CONTROLE DE ACESSO
  // ============================================

  private async getAccessibleStudentIds(userId: string): Promise<string[]> {
    try {
      // Se for coordenador, buscar TODOS os alunos (usando o ID do documento)
      if (this.userRole === 'coordinator') {
        const studentsRef = collection(firestore, 'students');
        const studentsQuery = query(studentsRef, where('isActive', '==', true));
        const studentsSnapshot = await getDocs(studentsQuery);

        // ✅ Importante: usar doc.id, não o campo 'id'
        const studentIds = studentsSnapshot.docs.map(doc => doc.id);
        console.log(`👑 Coordenador: acesso a ${studentIds.length} alunos`,
          studentIds.slice(0, 3)); // mostra os primeiros 3
        return studentIds;
      }
      // Se for psicólogo/monitor, buscar apenas alunos atribuídos
      else {
        const studentsRef = collection(firestore, 'students');
        const studentsQuery = query(
          studentsRef,
          where('assignedProfessionals', 'array-contains', userId),
          where('isActive', '==', true)
        );
        const studentsSnapshot = await getDocs(studentsQuery);

        // ✅ Usar doc.id também aqui
        const studentIds = studentsSnapshot.docs.map(doc => doc.id);
        console.log(`👤 Profissional: acesso a ${studentIds.length} alunos`);
        return studentIds;
      }
    } catch (error) {
      console.error('Error getting accessible student IDs:', error);
      return [];
    }
  }

  private async checkStudentAccess(userId: string, studentId: string): Promise<boolean> {
    try {
      // Coordenador tem acesso a todos
      if (this.userRole === 'coordinator') {
        return true;
      }

      // Verificar se o aluno está atribuído a este profissional
      const studentRef = collection(firestore, 'students');
      const studentQuery = query(
        studentRef,
        where('id', '==', studentId),
        where('assignedProfessionals', 'array-contains', userId),
        limit(1)
      );

      const studentSnapshot = await getDocs(studentQuery);
      return !studentSnapshot.empty;
    } catch (error) {
      console.error('Error checking student access:', error);
      return false;
    }
  }

  // ============================================
  // MÉTODOS DE BUSCA NO FIRESTORE (ATUALIZADOS)
  // ============================================

  private async fetchSnapshots(
    userId: string,
    dateRange: DateRange,
    filters: AnalyticsFilters,
    accessibleStudentIds: string[]
  ): Promise<WeeklySnapshot[]> {
    try {
      console.log('🔍 Fetching snapshots:', {
        userId,
        userRole: this.userRole,
        dateRange: {
          startDate: dateRange.startDate.toISOString(),
          endDate: dateRange.endDate.toISOString()
        },
        accessibleStudents: accessibleStudentIds.length
      });

      if (accessibleStudentIds.length === 0) {
        console.log('⚠️ No accessible students');
        return [];
      }

      const snapshotsRef = collection(firestore, 'weeklySnapshots');

      // Query principal - buscar por studentIds (mais eficiente que por professionalId)
      let q = query(
        snapshotsRef,
        where('studentId', 'in', accessibleStudentIds.slice(0, 10)), // Firestore limit de 10 por in
        where('weekStartDate', '>=', Timestamp.fromDate(dateRange.startDate)),
        where('weekEndDate', '<=', Timestamp.fromDate(dateRange.endDate)),
        orderBy('weekStartDate', 'desc')
      );

      // Se tiver mais de 10 alunos, precisamos fazer múltiplas queries
      if (accessibleStudentIds.length > 10) {
        const snapshots: WeeklySnapshot[] = [];

        // Dividir em chunks de 10
        for (let i = 0; i < accessibleStudentIds.length; i += 10) {
          const chunk = accessibleStudentIds.slice(i, i + 10);
          const chunkQuery = query(
            snapshotsRef,
            where('studentId', 'in', chunk),
            where('weekStartDate', '>=', Timestamp.fromDate(dateRange.startDate)),
            where('weekEndDate', '<=', Timestamp.fromDate(dateRange.endDate)),
            orderBy('weekStartDate', 'desc')
          );

          const chunkSnapshot = await getDocs(chunkQuery);
          snapshots.push(...this.mapSnapshots(chunkSnapshot));
        }

        console.log('📊 Total snapshots found:', snapshots.length);
        return snapshots;
      }

      const snapshot = await getDocs(q);
      console.log('📊 Snapshots found:', snapshot.size);

      return this.mapSnapshots(snapshot);
    } catch (error) {
      console.error('❌ Error fetching snapshots:', error);
      return [];
    }
  }

  private async fetchGAD7Assessments(
    userId: string,
    dateRange: DateRange,
    filters: AnalyticsFilters,
    accessibleStudentIds: string[]
  ): Promise<GAD7Assessment[]> {
    try {
      if (accessibleStudentIds.length === 0) return [];

      const assessmentsRef = collection(firestore, 'gad7Assessments');

      // Se for coordenador, buscar por studentIds
      if (this.userRole === 'coordinator') {
        let q = query(
          assessmentsRef,
          where('studentId', 'in', accessibleStudentIds.slice(0, 10)),
          where('completedAt', '>=', Timestamp.fromDate(dateRange.startDate)),
          where('completedAt', '<=', Timestamp.fromDate(dateRange.endDate)),
          orderBy('completedAt', 'desc')
        );

        if (accessibleStudentIds.length > 10) {
          const assessments: GAD7Assessment[] = [];

          for (let i = 0; i < accessibleStudentIds.length; i += 10) {
            const chunk = accessibleStudentIds.slice(i, i + 10);
            const chunkQuery = query(
              assessmentsRef,
              where('studentId', 'in', chunk),
              where('completedAt', '>=', Timestamp.fromDate(dateRange.startDate)),
              where('completedAt', '<=', Timestamp.fromDate(dateRange.endDate)),
              orderBy('completedAt', 'desc')
            );

            const chunkSnapshot = await getDocs(chunkQuery);
            assessments.push(...chunkSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as GAD7Assessment[]);
          }

          return assessments;
        }

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as GAD7Assessment[];
      }
      // Se for profissional, buscar por professionalId
      else {
        let q = query(
          assessmentsRef,
          where('professionalId', '==', userId),
          where('completedAt', '>=', Timestamp.fromDate(dateRange.startDate)),
          where('completedAt', '<=', Timestamp.fromDate(dateRange.endDate)),
          orderBy('completedAt', 'desc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as GAD7Assessment[];
      }
    } catch (error) {
      console.error('❌ Error fetching GAD7 assessments:', error);
      return [];
    }
  }

  private async fetchStudentSnapshots(
    studentId: string,
    professionalId: string,
    weeks: number
  ): Promise<WeeklySnapshot[]> {
    try {
      const snapshotsRef = collection(firestore, 'weeklySnapshots');
      const endDate = new Date();
      const startDate = subWeeks(endDate, weeks);

      // Para coordenador, não filtrar por professionalId
      let q;
      if (this.userRole === 'coordinator') {
        q = query(
          snapshotsRef,
          where('studentId', '==', studentId),
          where('weekStartDate', '>=', Timestamp.fromDate(startDate)),
          orderBy('weekStartDate', 'desc'),
          limit(weeks)
        );
      } else {
        q = query(
          snapshotsRef,
          where('studentId', '==', studentId),
          where('professionalId', '==', professionalId),
          where('weekStartDate', '>=', Timestamp.fromDate(startDate)),
          orderBy('weekStartDate', 'desc'),
          limit(weeks)
        );
      }

      const snapshot = await getDocs(q);
      return this.mapSnapshots(snapshot);
    } catch (error) {
      console.error('Error fetching student snapshots:', error);
      return [];
    }
  }

  private async fetchStudentData(studentId: string): Promise<any> {
    try {
      console.log('🔍 Fetching student data for ID:', studentId);

      const studentRef = collection(firestore, 'students');

      // ✅ CORRETO: Buscar pelo ID do documento (__name__)
      const docRef = doc(firestore, 'students', studentId);
      const docSnap = await getDoc(docRef);

      console.log('📄 Document lookup by ID:', {
        exists: docSnap.exists(),
        id: docRef.id
      });

      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log('✅ Student found:', {
          name: data.profile.grade,
          grade: data.grade,
          school: data.profile.school
        });

        return {
          name: data.name || 'Aluno',
          grade: data.profile.grade || 'Não informado',
          school: data.profile.school || 'Não informado',
          profileImage: data.profileImage
        };
      }

      // Fallback: tentar buscar por campo 'id' (caso algum documento use)
      console.log('⚠️ Not found by document ID, trying by id field...');
      const idQuery = query(
        studentRef,
        where('id', '==', studentId),
        limit(1)
      );
      const idSnapshot = await getDocs(idQuery);

      if (!idSnapshot.empty) {
        const data = idSnapshot.docs[0].data();
        console.log('✅ Student found by id field');
        return {
          name: data.name || 'Aluno',
          grade: data.grade || 'Não informado',
          school: data.school || 'Não informado',
          profileImage: data.profileImage
        };
      }

      // Se não encontrar de nenhuma forma
      console.error('❌ Student not found with any method:', studentId);

      // Log da amostra para debug
      const sampleQuery = query(studentRef, limit(3));
      const sampleSnap = await getDocs(sampleQuery);
      console.log('📚 Sample students in DB:', sampleSnap.docs.map(d => ({
        id: d.id,
        name: d.data().name,
        hasIdField: 'id' in d.data()
      })));

      throw new Error(`Student not found with ID: ${studentId}`);
    } catch (error) {
      console.error('❌ Error fetching student data:', error);
      throw error;
    }
  }

  private async fetchStudentGAD7(
    studentId: string,
    weeks: number
  ): Promise<GAD7Assessment[]> {
    try {
      const assessmentsRef = collection(firestore, 'gad7Assessments');
      const endDate = new Date();
      const startDate = subWeeks(endDate, weeks);

      const q = query(
        assessmentsRef,
        where('studentId', '==', studentId),
        where('completedAt', '>=', Timestamp.fromDate(startDate)),
        orderBy('completedAt', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as GAD7Assessment[];
    } catch (error) {
      console.error('Error fetching student GAD7:', error);
      return [];
    }
  }

  // ============================================
  // MÉTODOS DE PROCESSAMENTO (ATUALIZADOS)
  // ============================================

  private async generateRankings(
    snapshots: WeeklySnapshot[],
    assessments: GAD7Assessment[],
    filters: AnalyticsFilters,
    accessibleStudentIds: string[]
  ): Promise<ComparativeAnalysis['studentRankings']> {
    // Agrupar por aluno
    const studentMap = new Map<string, {
      snapshots: WeeklySnapshot[];
      assessments: GAD7Assessment[];
    }>();

    snapshots.forEach(snapshot => {
      if (!studentMap.has(snapshot.studentId)) {
        studentMap.set(snapshot.studentId, { snapshots: [], assessments: [] });
      }
      studentMap.get(snapshot.studentId)!.snapshots.push(snapshot);
    });

    assessments.forEach(assessment => {
      if (!studentMap.has(assessment.studentId)) {
        studentMap.set(assessment.studentId, { snapshots: [], assessments: [] });
      }
      studentMap.get(assessment.studentId)!.assessments.push(assessment);
    });

    // Buscar nomes dos alunos
    const studentNames = await this.getStudentNames(accessibleStudentIds);

    // Calcular métricas por aluno
    const studentMetrics = Array.from(studentMap.entries()).map(([studentId, data]) => {
      const latestSnapshot = data.snapshots[0];
      const avgCompletion = data.snapshots.length > 0
        ? data.snapshots.reduce((sum, s) => sum + s.metrics.completionRate, 0) / data.snapshots.length
        : 0;

      // Calcular melhoria
      const firstSnapshot = data.snapshots[data.snapshots.length - 1];
      const improvement = firstSnapshot && latestSnapshot
        ? latestSnapshot.metrics.completionRate - firstSnapshot.metrics.completionRate
        : 0;

      // Calcular melhoria no GAD7
      const gad7Improvement = this.calculateGAD7Improvement(data.assessments);

      // Determinar se está em risco
      const isAtRisk = this.isStudentAtRisk(data.snapshots, data.assessments);

      return {
        studentId,
        studentName: studentNames[studentId] || `Aluno ${studentId.slice(0, 4)}`,
        studentGrade: '1º Ano', // Buscar do banco quando disponível
        avgCompletion,
        latestCompletion: latestSnapshot?.metrics.completionRate || 0,
        improvement,
        gad7Improvement,
        isAtRisk,
        latestGAD7: data.assessments[0]?.totalScore
      };
    });

    // Ordenar rankings
    return {
      byEngagement: studentMetrics
        .sort((a, b) => b.avgCompletion - a.avgCompletion)
        .slice(0, 10)
        .map((item, index) => ({
          studentId: item.studentId,
          studentName: item.studentName,
          studentGrade: item.studentGrade,
          value: item.avgCompletion,
          trend: this.determineTrend(item.improvement),
          percentile: 100 - (index * 10),
          isAtRisk: item.isAtRisk
        })),
      byImprovement: studentMetrics
        .sort((a, b) => b.improvement - a.improvement)
        .slice(0, 10)
        .map((item, index) => ({
          studentId: item.studentId,
          studentName: item.studentName,
          studentGrade: item.studentGrade,
          value: item.improvement,
          trend: this.determineTrend(item.improvement),
          percentile: 100 - (index * 10),
          isAtRisk: item.isAtRisk
        })),
      byGAD7Improvement: studentMetrics
        .filter(m => m.gad7Improvement !== 0)
        .sort((a, b) => b.gad7Improvement - a.gad7Improvement)
        .slice(0, 10)
        .map((item, index) => ({
          studentId: item.studentId,
          studentName: item.studentName,
          studentGrade: item.studentGrade,
          value: item.gad7Improvement,
          trend: this.determineTrend(item.gad7Improvement),
          percentile: 100 - (index * 10),
          isAtRisk: item.isAtRisk
        })),
      atRisk: studentMetrics
        .filter(m => m.isAtRisk)
        .map(item => ({
          studentId: item.studentId,
          studentName: item.studentName,
          studentGrade: item.studentGrade,
          value: item.latestCompletion,
          trend: 'declining',
          percentile: 0,
          isAtRisk: true
        }))
    };
  }

  private async getStudentNames(studentIds: string[]): Promise<Record<string, string>> {
    const names: Record<string, string> = {};

    if (studentIds.length === 0) return names;

    try {
      // Buscar cada documento individualmente (mais confiável que 'in' query)
      for (const studentId of studentIds) {
        const docRef = doc(firestore, 'students', studentId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          names[studentId] = docSnap.data().name || 'Aluno';
        }
      }

      console.log(`📚 Found names for ${Object.keys(names).length} students`);
    } catch (error) {
      console.error('Error fetching student names:', error);
    }

    return names;
  }

  private async calculateComparisons(
    studentId: string,
    snapshots: WeeklySnapshot[],
    userId: string
  ): Promise<StudentAnalyticsSummary['comparisons']> {
    // Buscar média da turma (todos alunos acessíveis)
    const accessibleStudentIds = await this.getAccessibleStudentIds(userId);
    const allSnapshots = await this.fetchSnapshots(
      userId,
      {
        startDate: subWeeks(new Date(), 8),
        endDate: new Date(),
        label: 'Últimas 4 semanas'
      },
      {
        period: 'month',
      },
      accessibleStudentIds
    );

    const classAverage = allSnapshots.length > 0
      ? allSnapshots.reduce((sum, s) => sum + s.metrics.completionRate, 0) / allSnapshots.length
      : 65; // fallback

    const latestSnapshot = snapshots[0];
    const previousSnapshot = snapshots[1];

    const vsPreviousWeek = previousSnapshot && latestSnapshot
      ? ((latestSnapshot.metrics.completionRate - previousSnapshot.metrics.completionRate)
        / previousSnapshot.metrics.completionRate) * 100
      : 0;

    const vsClassAverage = latestSnapshot
      ? ((latestSnapshot.metrics.completionRate - classAverage) / classAverage) * 100
      : 0;

    // Percentil aproximado
    const percentile = latestSnapshot
      ? Math.min(100, Math.max(0, 50 + vsClassAverage / 2))
      : 50;

    return {
      vsClassAverage,
      vsPreviousWeek,
      percentile
    };
  }

  private getEmptyComparativeAnalysis(dateRange: DateRange): ComparativeAnalysis {
    return {
      period: dateRange,
      summary: {
        totalStudents: 0,
        activeStudents: 0,
        studentsWithGAD7: 0,
        metrics: {
          averageCompletionRate: 0,
          averageConsistencyScore: 0,
          averageAdherenceScore: 0,
          averageTimePerActivity: 0,
          totalActivitiesCompleted: 0,
          totalTimeSpent: 0,
          totalPointsEarned: 0,
          averagePointsPerStudent: 0,
          pointsDistribution: {
            min: 0,
            max: 0,
            median: 0,
            average: 0
          },
          averageGAD7Score: 0,
          gad7Distribution: {
            minimal: 0,
            mild: 0,
            moderate: 0,
            severe: 0
          },
          studentsWithGAD7: 0,
          gad7Trend: 'stable',
          averageStreak: 0,
          maxStreak: 0,
          studentsWithActiveStreak: 0
        }
      },
      studentRankings: {
        byEngagement: [],
        byImprovement: [],
        byGAD7Improvement: [],
        atRisk: []
      },
      classInsights: [],
      distributions: {
        completionRate: { bins: [], counts: [], average: 0, median: 0, stdDev: 0 },
        gad7Score: { bins: [], counts: [], average: 0, median: 0, stdDev: 0 },
        consistencyScore: { bins: [], counts: [], average: 0, median: 0, stdDev: 0 }
      },
      classHeatmap: {}
    };
  }

  // ============================================
  // MÉTODOS DE PROCESSAMENTO
  // ============================================

  private async calculateDistributions(
    snapshots: WeeklySnapshot[],
    assessments: GAD7Assessment[]
  ): Promise<ComparativeAnalysis['distributions']> {
    // Distribuição de completion rate
    const completionRates = snapshots.map(s => s.metrics.completionRate);

    // Distribuição de GAD7
    const gad7Scores = assessments.map(a => a.totalScore);

    // Distribuição de consistency
    const consistencyScores = snapshots.map(s => s.metrics.consistencyScore);

    return {
      completionRate: this.createDistribution(completionRates, 10),
      gad7Score: this.createDistribution(gad7Scores, 5),
      consistencyScore: this.createDistribution(consistencyScores, 10)
    };
  }

  private async generateClassHeatmap(
    snapshots: WeeklySnapshot[]
  ): Promise<ComparativeAnalysis['classHeatmap']> {
    const heatmap: Record<number, {
      totalCompletion: number;
      count: number;
      totalGAD7: number;
      gad7Count: number;
      totalActivities: number;
    }> = {
      0: { totalCompletion: 0, count: 0, totalGAD7: 0, gad7Count: 0, totalActivities: 0 },
      1: { totalCompletion: 0, count: 0, totalGAD7: 0, gad7Count: 0, totalActivities: 0 },
      2: { totalCompletion: 0, count: 0, totalGAD7: 0, gad7Count: 0, totalActivities: 0 },
      3: { totalCompletion: 0, count: 0, totalGAD7: 0, gad7Count: 0, totalActivities: 0 },
      4: { totalCompletion: 0, count: 0, totalGAD7: 0, gad7Count: 0, totalActivities: 0 },
      5: { totalCompletion: 0, count: 0, totalGAD7: 0, gad7Count: 0, totalActivities: 0 },
      6: { totalCompletion: 0, count: 0, totalGAD7: 0, gad7Count: 0, totalActivities: 0 }
    };

    snapshots.forEach(snapshot => {
      if (snapshot.dailyBreakdown) {
        Object.entries(snapshot.dailyBreakdown).forEach(([day, data]) => {
          const dayNum = parseInt(day);
          if (heatmap[dayNum] && data.total > 0) {
            // Calcular completion rate do dia
            const dayCompletion = (data.completed / data.total) * 100;

            // Só adicionar se for um número válido
            if (!isNaN(dayCompletion) && isFinite(dayCompletion)) {
              heatmap[dayNum].totalCompletion += dayCompletion;
              heatmap[dayNum].count++;
            }

            heatmap[dayNum].totalActivities += data.total;
          }
        });
      }
    });

    return Object.entries(heatmap).reduce((acc, [day, data]) => {
      const dayNum = parseInt(day);

      // Calcular média apenas se houver dados
      let averageCompletion = 0;
      if (data.count > 0) {
        averageCompletion = data.totalCompletion / data.count;
        // Garantir que é um número válido
        averageCompletion = !isNaN(averageCompletion) && isFinite(averageCompletion) ? averageCompletion : 0;
      }

      acc[dayNum] = {
        averageCompletion: Math.round(averageCompletion * 10) / 10, // Arredondar para 1 casa decimal
        averageGAD7: data.gad7Count > 0 ? data.totalGAD7 / data.gad7Count : undefined,
        totalActivities: data.totalActivities
      };

      return acc;
    }, {} as ComparativeAnalysis['classHeatmap']);
  }

  private async generateClassInsights(
    metrics: AggregatedMetrics,
    rankings: ComparativeAnalysis['studentRankings']
  ): Promise<Insight[]> {
    const insights: Insight[] = [];

    // Insight de engajamento baixo
    if (metrics.averageCompletionRate < 50) {
      insights.push({
        id: `low-engagement-${Date.now()}`,
        type: 'warning',
        title: 'Engajamento crítico',
        description: `Média de conclusão de ${metrics.averageCompletionRate.toFixed(1)}% está abaixo do esperado.`,
        metric: 'completionRate',
        value: metrics.averageCompletionRate,
        threshold: 50,
        trend: 'declining',
        action: {
          label: 'Ver alunos em risco',
          href: '/professional/analytics?filter=at_risk'
        },
        createdAt: new Date()
      });
    }

    // Insight de GAD7 elevado
    if (metrics.averageGAD7Score > 10) {
      insights.push({
        id: `high-gad7-${Date.now()}`,
        type: 'risk',
        title: 'Atenção: níveis de ansiedade elevados',
        description: `Média GAD-7 de ${metrics.averageGAD7Score.toFixed(1)} indica ansiedade moderada na turma.`,
        metric: 'gad7Score',
        value: metrics.averageGAD7Score,
        threshold: 10,
        trend: 'stable',
        action: {
          label: 'Revisar avaliações',
          href: '/professional/analytics?tab=gad7'
        },
        createdAt: new Date()
      });
    }

    // Insight de alunos em risco
    if (rankings.atRisk.length > 0) {
      insights.push({
        id: `students-at-risk-${Date.now()}`,
        type: 'warning',
        title: `${rankings.atRisk.length} aluno(s) em risco`,
        description: rankings.atRisk.length === 1
          ? `${rankings.atRisk[0].studentName} apresenta sinais de alerta.`
          : `${rankings.atRisk.length} alunos precisam de atenção especial esta semana.`,
        metric: 'atRisk',
        value: rankings.atRisk.length,
        trend: 'declining',
        action: {
          label: 'Ver lista de risco',
          href: '/professional/analytics?filter=at_risk'
        },
        createdAt: new Date()
      });
    }

    // Insight de melhoria
    if (metrics.gad7Trend === 'improving') {
      insights.push({
        id: `gad7-improving-${Date.now()}`,
        type: 'success',
        title: 'Progresso na saúde mental',
        description: 'Os níveis de ansiedade estão melhorando em comparação ao período anterior.',
        metric: 'gad7Trend',
        trend: 'improving',
        action: {
          label: 'Ver evolução',
          href: '/professional/analytics?tab=trends'
        },
        createdAt: new Date()
      });
    }

    return insights;
  }

  private calculateCurrentMetrics(
    snapshots: WeeklySnapshot[],
    assessments: GAD7Assessment[]
  ): StudentAnalyticsSummary['currentMetrics'] {
    const latestSnapshot = snapshots[0];
    const latestGAD7 = assessments[0];

    return {
      completionRate: latestSnapshot?.metrics.completionRate || 0,
      consistencyScore: latestSnapshot?.metrics.consistencyScore || 0,
      adherenceScore: latestSnapshot?.metrics.adherenceScore || 0,
      totalPoints: latestSnapshot?.metrics.totalPointsEarned || 0,
      streak: latestSnapshot?.metrics.streakAtEndOfWeek || 0,
      level: 1, // Buscar do perfil do aluno
      gad7Score: latestGAD7?.totalScore,
      gad7Severity: latestGAD7?.severity,
      lastActivityDate: latestSnapshot?.weekEndDate
    };
  }

  private generateWeeklyHistory(
    snapshots: WeeklySnapshot[],
    assessments: GAD7Assessment[]
  ): StudentWeeklyMetrics[] {
    const assessmentMap = new Map(
      assessments.map(a => [a.weekNumber, a])
    );

    return snapshots.map(snapshot => {
      const gad7 = assessmentMap.get(snapshot.weekNumber);

      // Calcular se foi melhora/piora
      const previousSnapshot = snapshots.find(
        s => s.weekNumber === snapshot.weekNumber - 1
      );

      const isImprovement = previousSnapshot
        ? snapshot.metrics.completionRate > previousSnapshot.metrics.completionRate
        : false;

      const isDecline = previousSnapshot
        ? snapshot.metrics.completionRate < previousSnapshot.metrics.completionRate
        : false;

      // Mapear activityBreakdown para o formato correto
      const activityBreakdown: StudentWeeklyMetrics['activityBreakdown'] = {} as any;

      Object.entries(snapshot.activityTypeBreakdown || {}).forEach(([type, data]) => {
        activityBreakdown[type as keyof typeof activityBreakdown] = {
          completed: data.completed || 0,
          total: data.total || 0,
          averageTime: data.averageTime || 0,
          pointsEarned: data.averagePoints || 0
        };
      });

      return {
        weekNumber: snapshot.weekNumber,
        weekStartDate: snapshot.weekStartDate,
        weekEndDate: snapshot.weekEndDate,
        completionRate: snapshot.metrics.completionRate,
        consistencyScore: snapshot.metrics.consistencyScore,
        adherenceScore: snapshot.metrics.adherenceScore,
        pointsEarned: snapshot.metrics.totalPointsEarned,
        timeSpent: snapshot.metrics.totalTimeSpent,
        activitiesCompleted: snapshot.metrics.completedActivities,
        streakAtEnd: snapshot.metrics.streakAtEndOfWeek,
        activityBreakdown,
        dailyBreakdown: snapshot.dailyBreakdown || {},
        gad7: gad7 ? {
          score: gad7.totalScore,
          severity: gad7.severity,
          responses: gad7.responses,
          completedAt: gad7.completedAt
        } : undefined,
        isImprovement,
        isDecline
      };
    });
  }

  private calculateTrends(
    weeklyHistory: StudentWeeklyMetrics[]
  ): StudentAnalyticsSummary['trends'] {
    if (weeklyHistory.length < 2) {
      return {
        completionRate: 'insufficient_data',
        gad7Score: 'insufficient_data',
        consistency: 'insufficient_data',
        confidence: 'low'
      };
    }

    const firstWeek = weeklyHistory[weeklyHistory.length - 1];
    const lastWeek = weeklyHistory[0];

    // Tendência de completion rate
    const completionChange = lastWeek.completionRate - firstWeek.completionRate;
    const completionTrend = this.determineTrend(completionChange);

    // Tendência de GAD7 (invertido: diminuir é melhor)
    const gad7First = weeklyHistory.find(w => w.gad7)?.gad7?.score || 0;
    const gad7Last = weeklyHistory[0]?.gad7?.score || 0;
    const gad7Change = gad7First - gad7Last; // Positivo = melhora
    const gad7Trend = this.determineTrend(gad7Change);

    // Tendência de consistency
    const consistencyChange = lastWeek.consistencyScore - firstWeek.consistencyScore;
    const consistencyTrend = this.determineTrend(consistencyChange);

    // Confiança baseada na quantidade de dados
    const confidence = weeklyHistory.length >= 6 ? 'high'
      : weeklyHistory.length >= 4 ? 'medium'
        : 'low';

    return {
      completionRate: completionTrend,
      gad7Score: gad7Trend,
      consistency: consistencyTrend,
      confidence
    };
  }

  private generateStudentInsights(
    studentId: string,
    currentMetrics: StudentAnalyticsSummary['currentMetrics'],
    weeklyHistory: StudentWeeklyMetrics[],
    trends: StudentAnalyticsSummary['trends'],
    comparisons: StudentAnalyticsSummary['comparisons']
  ): Insight[] {
    const insights: Insight[] = [];

    // Insight de baixo engajamento
    if (currentMetrics.completionRate < 40) {
      insights.push({
        id: `student-low-engagement-${Date.now()}`,
        type: 'warning',
        title: 'Baixo engajamento',
        description: `Completou apenas ${currentMetrics.completionRate.toFixed(1)}% das atividades esta semana.`,
        metric: 'completionRate',
        value: currentMetrics.completionRate,
        threshold: 40,
        trend: trends.completionRate,
        action: {
          label: 'Ver cronograma',
          href: `/professional/students/${studentId}`
        },
        createdAt: new Date()
      });
    }

    // Insight de GAD7 elevado
    if (currentMetrics.gad7Score && currentMetrics.gad7Score > 10) {
      insights.push({
        id: `student-high-gad7-${Date.now()}`,
        type: 'risk',
        title: 'Nível de ansiedade elevado',
        description: `GAD-7 de ${currentMetrics.gad7Score} indica ansiedade moderada a severa.`,
        metric: 'gad7Score',
        value: currentMetrics.gad7Score,
        threshold: 10,
        trend: trends.gad7Score,
        action: {
          label: 'Ver avaliação completa',
          href: `/professional/students/${studentId}?tab=gad7`
        },
        createdAt: new Date()
      });
    }

    // Insight de melhora significativa
    if (comparisons.vsPreviousWeek > 20) {
      insights.push({
        id: `student-improvement-${Date.now()}`,
        type: 'success',
        title: 'Melhora significativa!',
        description: `Aumento de ${comparisons.vsPreviousWeek.toFixed(1)}% no engajamento em relação à semana passada.`,
        metric: 'improvement',
        value: comparisons.vsPreviousWeek,
        trend: 'improving',
        action: {
          label: 'Ver evolução',
          href: `/professional/students/${studentId}?tab=progress`
        },
        createdAt: new Date()
      });
    }

    // Insight de streak
    if (currentMetrics.streak >= 7) {
      insights.push({
        id: `student-streak-${Date.now()}`,
        type: 'success',
        title: '🔥 Streak impressionante!',
        description: `${currentMetrics.streak} dias consecutivos de atividades.`,
        metric: 'streak',
        value: currentMetrics.streak,
        trend: 'improving',
        action: {
          label: 'Parabenizar',
          href: `/professional/students/${studentId}`,
          onClick: () => { } // Implementar ação
        },
        createdAt: new Date()
      });
    }

    return insights;
  }

  private assessRiskLevel(
    currentMetrics: StudentAnalyticsSummary['currentMetrics'],
    trends: StudentAnalyticsSummary['trends'],
    weeklyHistory: StudentWeeklyMetrics[]
  ): 'low' | 'medium' | 'high' | 'critical' {
    let riskScore = 0;

    // Baixo engajamento
    if (currentMetrics.completionRate < 30) riskScore += 3;
    else if (currentMetrics.completionRate < 50) riskScore += 2;
    else if (currentMetrics.completionRate < 70) riskScore += 1;

    // GAD7 elevado
    if (currentMetrics.gad7Score) {
      if (currentMetrics.gad7Score >= 15) riskScore += 3;
      else if (currentMetrics.gad7Score >= 10) riskScore += 2;
      else if (currentMetrics.gad7Score >= 5) riskScore += 1;
    }

    // Tendência negativa
    if (trends.completionRate === 'declining') riskScore += 2;
    if (trends.gad7Score === 'declining') riskScore += 2; // GAD7 aumentando

    // Queda recente
    if (weeklyHistory.length >= 2) {
      const latest = weeklyHistory[0];
      const previous = weeklyHistory[1];
      if (latest.completionRate < previous.completionRate * 0.7) {
        riskScore += 2;
      }
    }

    // Classificar risco
    if (riskScore >= 8) return 'critical';
    if (riskScore >= 5) return 'high';
    if (riskScore >= 3) return 'medium';
    return 'low';
  }

  private identifyRiskFactors(
    currentMetrics: StudentAnalyticsSummary['currentMetrics'],
    trends: StudentAnalyticsSummary['trends'],
    weeklyHistory: StudentWeeklyMetrics[]
  ): string[] {
    const factors: string[] = [];

    if (currentMetrics.completionRate < 30) {
      factors.push('Engajamento crítico');
    }

    if (currentMetrics.gad7Score && currentMetrics.gad7Score >= 15) {
      factors.push('Ansiedade severa');
    } else if (currentMetrics.gad7Score && currentMetrics.gad7Score >= 10) {
      factors.push('Ansiedade moderada');
    }

    if (trends.completionRate === 'declining') {
      factors.push('Queda consistente no engajamento');
    }

    if (trends.gad7Score === 'declining') {
      factors.push('Aumento nos níveis de ansiedade');
    }

    if (weeklyHistory[0]?.streakAtEnd === 0 && weeklyHistory[1]?.streakAtEnd > 0) {
      factors.push('Streak quebrado recentemente');
    }

    if (currentMetrics.lastActivityDate) {
      const daysSinceLastActivity = Math.floor(
        (Date.now() - currentMetrics.lastActivityDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceLastActivity > 7) {
        factors.push(`Inativo há ${daysSinceLastActivity} dias`);
      }
    }

    return factors;
  }

  // ============================================
  // MÉTODOS UTILITÁRIOS
  // ============================================

  private getDateRangeFromFilters(filters: AnalyticsFilters): DateRange {
    const now = new Date();

    switch (filters.period) {
      case 'week':
        return {
          startDate: startOfWeek(now, { weekStartsOn: 0 }),
          endDate: endOfWeek(now, { weekStartsOn: 0 }),
          label: 'Esta semana'
        };
      case 'month':
        return {
          startDate: subWeeks(now, 4),
          endDate: now,
          label: 'Últimas 4 semanas'
        };
      case 'quarter':
        return {
          startDate: subWeeks(now, 12),
          endDate: now,
          label: 'Últimas 12 semanas'
        };
      case 'custom':
        if (filters.customRange) return filters.customRange;
        // fallback
        return {
          startDate: subWeeks(now, 4),
          endDate: now,
          label: 'Período personalizado'
        };
      default:
        return {
          startDate: subWeeks(now, 4),
          endDate: now,
          label: 'Últimas 4 semanas'
        };
    }
  }

  private getPreviousPeriod(dateRange: DateRange): DateRange {
    const duration = dateRange.endDate.getTime() - dateRange.startDate.getTime();
    return {
      startDate: new Date(dateRange.startDate.getTime() - duration),
      endDate: new Date(dateRange.endDate.getTime() - duration),
      label: 'Período anterior'
    };
  }

  private calculateComparison(
    current: AggregatedMetrics,
    previous: AggregatedMetrics
  ): ComparativeAnalysis['comparison'] {
    return {
      completionRateChange: previous.averageCompletionRate > 0
        ? ((current.averageCompletionRate - previous.averageCompletionRate) / previous.averageCompletionRate) * 100
        : 0,
      gad7ScoreChange: previous.averageGAD7Score > 0
        ? ((current.averageGAD7Score - previous.averageGAD7Score) / previous.averageGAD7Score) * 100
        : 0,
      consistencyChange: previous.averageConsistencyScore > 0
        ? ((current.averageConsistencyScore - previous.averageConsistencyScore) / previous.averageConsistencyScore) * 100
        : 0,
      engagementChange: previous.averageCompletionRate > 0
        ? ((current.averageCompletionRate - previous.averageCompletionRate) / previous.averageCompletionRate) * 100
        : 0,
      isImproving: current.averageCompletionRate > previous.averageCompletionRate
    };
  }

  private mapSnapshots(snapshot: QuerySnapshot<DocumentData>): WeeklySnapshot[] {
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        scheduleInstanceId: data.scheduleInstanceId || '',
        studentId: data.studentId || '',
        professionalId: data.professionalId || '',
        weekNumber: data.weekNumber || 0,
        weekStartDate: data.weekStartDate?.toDate() || new Date(),
        weekEndDate: data.weekEndDate?.toDate() || new Date(),
        metrics: data.metrics || {
          totalActivities: 0,
          completedActivities: 0,
          skippedActivities: 0,
          completionRate: 0,
          totalPointsEarned: 0,
          averagePointsPerActivity: 0,
          totalTimeSpent: 0,
          averageTimePerActivity: 0,
          consistencyScore: 0,
          adherenceScore: 0,
          streakAtEndOfWeek: 0
        },
        dailyBreakdown: data.dailyBreakdown || {},
        activityTypeBreakdown: data.activityTypeBreakdown || {},
        metadata: data.metadata || {
          scheduleTemplateName: '',
          scheduleTemplateId: '',
          professionalId: '',
          generatedBy: 'system',
          dataSource: 'calculated'
        },
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        isActive: data.isActive !== undefined ? data.isActive : true
      } as WeeklySnapshot;
    });
  }

  private createDistribution(values: number[], binCount: number): DistributionData {
    if (values.length === 0) {
      return {
        bins: [],
        counts: [],
        average: 0,
        median: 0,
        stdDev: 0
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const binSize = (max - min) / binCount || 1;

    const bins = Array.from({ length: binCount }, (_, i) => min + i * binSize);
    const counts = new Array(binCount).fill(0);

    sorted.forEach(value => {
      const binIndex = Math.min(
        Math.floor((value - min) / binSize),
        binCount - 1
      );
      counts[binIndex]++;
    });

    const average = values.reduce((sum, v) => sum + v, 0) / values.length;
    const median = sorted[Math.floor(sorted.length / 2)];

    const variance = values.reduce((sum, v) => sum + Math.pow(v - average, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return { bins, counts, average, median, stdDev };
  }

  private determineTrend(change: number): AnalyticsTrend {
    if (Math.abs(change) < 5) return 'stable';
    return change > 0 ? 'improving' : 'declining';
  }

  private getUniqueStudentCount(snapshots: WeeklySnapshot[]): number {
    return new Set(snapshots.map(s => s.studentId)).size;
  }

  private getActiveStudentCount(snapshots: WeeklySnapshot[]): number {
    const latestByStudent = new Map<string, WeeklySnapshot>();
    snapshots.forEach(snapshot => {
      const existing = latestByStudent.get(snapshot.studentId);
      if (!existing || snapshot.weekEndDate > existing.weekEndDate) {
        latestByStudent.set(snapshot.studentId, snapshot);
      }
    });

    return Array.from(latestByStudent.values()).filter(
      s => s.metrics.completedActivities > 0
    ).length;
  }

  private getStudentsWithGAD7Count(assessments: GAD7Assessment[]): number {
    return new Set(assessments.map(a => a.studentId)).size;
  }

  private calculateGAD7Improvement(assessments: GAD7Assessment[]): number {
    if (assessments.length < 2) return 0;

    const first = assessments[assessments.length - 1];
    const last = assessments[0];
    return first.totalScore - last.totalScore; // Positivo = melhora
  }

  private isStudentAtRisk(
    snapshots: WeeklySnapshot[],
    assessments: GAD7Assessment[]
  ): boolean {
    if (snapshots.length === 0) return false;

    const latestSnapshot = snapshots[0];
    const latestAssessment = assessments[0];

    // Critérios de risco
    const lowEngagement = latestSnapshot.metrics.completionRate < 30;
    const decliningTrend = snapshots.length >= 3 &&
      snapshots[0].metrics.completionRate < snapshots[1].metrics.completionRate &&
      snapshots[1].metrics.completionRate < snapshots[2].metrics.completionRate;
    const highGAD7 = latestAssessment?.totalScore >= 15;
    const increasingGAD7 = assessments.length >= 2 &&
      assessments[0].totalScore > assessments[1].totalScore;

    return lowEngagement || decliningTrend || highGAD7 || increasingGAD7;
  }
}