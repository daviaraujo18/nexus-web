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
  getDoc,
  collectionGroup // 🔥 IMPORT INJETADO PARA BUSCA NUCLEAR
} from 'firebase/firestore';
import { 
  AnalyticsFilters,
  ComparativeAnalysis,
  StudentAnalyticsSummary,
  DateRange,
  Insight 
} from '@/types/analytics';
import { WeeklySnapshot } from '@/types/schedule';
import { GAD7Assessment } from '@/types/GAD7';
import { SnapshotAggregator } from './SnapshotAggregator';
import { subWeeks } from 'date-fns';
import { firestore } from '@/firebase/config';
import { UserRole } from '@/types/auth';

/**
 * Serviço responsável por montar dados analíticos do Nexus.
 *
 * Responsabilidades:
 * - Gerar analytics individuais por aluno
 * - Gerar rankings comparativos entre alunos
 * - Consolidar dados vindos de múltiplas fontes do Firestore
 * - Cruzar progresso, snapshots semanais, atividades concluídas e GAD-7
 *
 * ⚠️ IMPORTANTE:
 * Este serviço não é apenas leitura simples.
 * Ele faz agregações, fallbacks e normalizações para alimentar dashboards.
 *
 * Qualquer alteração aqui pode impactar:
 * - dashboard do profissional
 * - ranking de bem-estar
 * - métricas individuais do aluno
 * - relatórios de progresso
 */
export class AnalyticsService {
  private snapshotAggregator: SnapshotAggregator;
  private userRole: UserRole;

  constructor(userRole: UserRole = 'psychologist') {
    this.snapshotAggregator = new SnapshotAggregator();
    this.userRole = userRole;
  }

  // ============================================
  // 1. DASHBOARD INDIVIDUAL (ALUNO ESPECÍFICO)
  // ============================================

  /**
   * Busca dados reais diretamente do Firestore para corrigir possíveis divergências
   * entre snapshots antigos, caches parciais e o estado atual do aluno.
   */
  async getStudentAnalytics(studentId: string, _userId: string, weeks: number = 12): Promise<StudentAnalyticsSummary> {
    console.group(`🔍 [SERVICE] Auditoria Individual: ${studentId}`);
    try {
      const [snapshots, allGad7, studentData] = await Promise.all([
        this.fetchStudentSnapshots(studentId, weeks),
        this.fetchStudentGAD7(studentId, 52), // Busca 1 ano para evitar card vazio
        this.fetchStudentData(studentId)
      ]);

      // ============================================
      // 🔥 ATAQUE AOS DADOS REAIS DO FIREBASE (NAM5)
      // ============================================
      let dbAdherence = 0;
      let dbStreak = 0;
      let dbTotalTime = 0;
      let dbTotalActivities = 0;
      const completedActivitiesList: any[] = [];

      /**
       * Lê as instâncias de cronograma do aluno para recuperar métricas consolidadas.
       *
       * Motivo:
       * `progressCache` representa o estado mais próximo da execução real do cronograma.
       *
       * Uso:
       * - maior adesão encontrada
       * - maior streak registrado
       *
       * ⚠️ Risco:
       * Se houver instâncias antigas duplicadas, o maior valor pode mascarar inconsistências.
       */
      try {
        const qInstances = query(collectionGroup(firestore, 'scheduleInstances'), where('studentId', '==', studentId));
        const snapInstances = await getDocs(qInstances);
        snapInstances.forEach(d => {
          const cache = d.data().progressCache || {};
          if (cache.completionPercentage > dbAdherence) dbAdherence = cache.completionPercentage;
          if (cache.streakDays > dbStreak) dbStreak = cache.streakDays; // 🔥 Puxa o Streak real (ex: 5)
        });
      } catch (e) { console.warn("Erro ao buscar Instâncias:", e); }

      /**
       * Busca atividades concluídas para reconstruir dados reais de execução.
       *
       * Esses dados alimentam:
       * - tempo total investido
       * - lista de atividades enviadas
       * - aba de dados enviados na UI
       *
       * ⚠️ Observação:
       * O tempo usado vem de `metadata.estimatedDuration`.
       * Isso representa tempo estimado, não necessariamente tempo real gasto.
       */
      try {
        const activityCollections = ['activityProgress'];
        for (const col of activityCollections) {
          const qAct = query(collectionGroup(firestore, col), where('studentId', '==', studentId), where('status', '==', 'completed'));
          const snapAct = await getDocs(qAct);
          
          snapAct.forEach(d => {
            const data = d.data();
            const snapshot = data.activitySnapshot || {};
            const meta = snapshot.metadata || data.metadata || {};
            const duration = Number(meta.estimatedDuration || 15); // 🔥 Puxa os 60min da Luta
            
            dbTotalTime += duration;
            dbTotalActivities += 1;

            completedActivitiesList.push({
              id: d.id,
              name: snapshot.title || data.title || 'Atividade Concluída',
              subject: meta.subject || snapshot.type || 'Geral',
              description: snapshot.description || data.description || 'Registrada no histórico.',
              completedAt: data.updatedAt?.toDate?.() || data.createdAt?.toDate?.() || new Date(),
              duration
            });
          });
        }
        completedActivitiesList.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
      } catch (e) { console.warn("Erro ao buscar Atividades:", e); }

      console.log(`🎯 [DB-PULL] Tempo: ${dbTotalTime}min | Ativ: ${dbTotalActivities} | Adesão: ${dbAdherence}% | Streak: ${dbStreak}`);

      /**
       * Converte atividades concluídas em objetos do tipo Insight.
       *
       * Decisão de compatibilidade:
       * A UI já renderiza a lista de `insights`, então reaproveitamos esse contrato
       * para exibir atividades concluídas sem alterar o JSX da página.
       *
       * ⚠️ Importante:
       * Apesar do tipo ser `Insight`, aqui ele representa dados de atividade enviada.
       */
      const activityInsights: Insight[] = completedActivitiesList.map((act, i) => ({
        id: `act-${act.id || i}`,
        type: 'success',
        title: act.name,
        description: `${act.description} (Módulo: ${act.subject}) | Concluída em: ${act.completedAt.toLocaleDateString('pt-BR')}`,
        metric: 'Tempo investido',
        value: act.duration,
        createdAt: act.completedAt
      }));

      // Ajusta o Profile
      studentData.streak = dbStreak > 0 ? dbStreak : studentData.streak;

      /**
       * Injeta métricas reais do banco na semana mais recente.
       *
       * Motivo:
       * Alguns snapshots podem conter dados antigos, incompletos ou inflados.
       * Para evitar duplicidade, os valores antigos de tempo/atividades/streak
       * são zerados antes da injeção dos dados reais.
       *
       * ⚠️ Risco:
       * Essa estratégia concentra os dados na semana mais recente.
       * Para histórico fiel por semana, o ideal seria distribuir por completedAt.
       */
      const weeklyHistory = this.generateWeeklyHistory(snapshots, allGad7);

      // 🔥 INJEÇÃO PARA A INTERFACE FAZER O REDUCE CORRETO
      if (weeklyHistory.length > 0) {
        // Limpa os tempos fantasmas para não duplicar
        weeklyHistory.forEach(w => { w.timeSpent = 0; w.activitiesCompleted = 0; w.streakAtEnd = 0; });
        // Injeta os valores reais do banco na semana mais recente
        weeklyHistory[0].timeSpent = dbTotalTime;
        weeklyHistory[0].activitiesCompleted = dbTotalActivities;
        weeklyHistory[0].streakAtEnd = dbStreak; // Para o Maior Streak renderizar certo
      } else {
        // Fallback caso não haja snapshots
        weeklyHistory.push({
          weekNumber: 1, timeSpent: dbTotalTime, activitiesCompleted: dbTotalActivities, streakAtEnd: dbStreak,
          completionRate: 0, consistencyScore: 0, adherenceScore: dbAdherence, pointsEarned: 0, dailyBreakdown: {}
        } as any);
      }

      /**
       * Calcula as métricas atuais exibidas no dashboard individual.
       *
       * Estratégia:
       * - usa dados do snapshot quando existem;
       * - calcula adesão a partir de atividades quando necessário;
       * - usa perfil do aluno como fonte canônica para pontos, nível e streak;
       * - usa GAD-7 mais recente quando disponível.
       *
       * ⚠️ Risco:
       * Como há múltiplos formatos históricos de snapshot, este método possui fallbacks.
       * Alterações devem preservar compatibilidade com dados antigos.
       */
      const lastActive = snapshots.find((s: any) => (s.metrics?.completionRate || 0) > 0) || snapshots[0] || {};
      const currentMetrics = this.calculateCurrentMetrics(lastActive, allGad7, studentData, dbTotalTime);

      // 🔥 SOBRESCREVE A ADESÃO E STREAK COM O VALOR DO CACHE DO BANCO
      currentMetrics.adherenceScore = dbAdherence > 0 ? dbAdherence : currentMetrics.adherenceScore;
      currentMetrics.streak = dbStreak > 0 ? dbStreak : currentMetrics.streak;

      console.groupEnd();
      
      return {
        studentId,
        studentName: studentData.name,
        studentGrade: studentData.grade,
        studentSchool: studentData.school,
        studentTotalPoints: studentData.totalPoints,
        profileImage: studentData.profileImage,
        currentMetrics,
        weeklyHistory,
        trends: { completionRate: 'stable', gad7Score: 'stable', consistency: 'stable', confidence: 'medium' },
        comparisons: { vsClassAverage: 0, vsPreviousWeek: 0, percentile: 50 },
        // 🔥 INJETA AS ATIVIDADES NO LUGAR DOS INSIGHTS PARA A UI RENDERIZAR
        insights: activityInsights.length > 0 ? activityInsights : [],
        riskLevel: currentMetrics.completionRate < 30 ? 'high' : 'low',
        riskFactors: []
      } as any;

    } catch (error) {
      console.error('❌ [SERVICE-ERROR]:', error);
      console.groupEnd();
      throw error;
    }
  }

  private async fetchStudentData(studentId: string): Promise<any> {
    const docSnap = await getDoc(doc(firestore, 'students', studentId));
    if (docSnap.exists()) {
      const d = docSnap.data();
      const p = d.profile || {};
      const xp = Number(p.totalPoints) || Number(d.totalPoints) || 0;
      
      return {
        name: d.name || p.name || 'Aluno',
        grade: p.grade || d.grade || 'Não informado',
        school: p.school || d.school || 'Não informado',
        totalPoints: xp,
        streak: Number(p.streak) || Number(d.streak) || 0,
        level: Math.floor(xp / 200) + 1,
        profileImage: d.profileImage
      };
    }
    throw new Error('Aluno não encontrado');
  }

  private calculateCurrentMetrics(lastValidSnap: any, assessments: GAD7Assessment[], profile: any, totalTimeSpent: number): any {
    const m = lastValidSnap?.metrics || {};
    const s = lastValidSnap || {};
    const items = Array.isArray(s.activities) ? s.activities : (Array.isArray(s.tasks) ? s.tasks : []);

    let adherence = Number(m.adherenceScore || s.adherenceScore || m.adherenceRate || s.adherenceRate || 0);
    if (adherence === 0 && items.length > 0) {
      const comp = Number(m.completedActivities || s.completedActivities || items.filter((i:any) => i.status === 'completed' || i.completed).length);
      const tot = Number(m.totalActivities || s.totalActivities || items.length);
      if (tot > 0) adherence = (comp / tot) * 100;
    }

    return {
      completionRate: Number(m.completionRate || s.completionRate || 0),
      consistencyScore: Number(m.consistencyScore || s.consistencyScore || 0),
      adherenceScore: adherence,
      totalPoints: profile.totalPoints,
      streak: profile.streak,
      level: profile.level,
      gad7Score: assessments[0]?.totalScore || null,
      gad7Severity: assessments[0]?.severity || null,
      lastActivityDate: s.weekEndDate?.toDate?.() || new Date(),
      totalTimeSpent: totalTimeSpent 
    };
  }

  /**
   * Gera histórico semanal normalizado a partir de snapshots e GAD-7.
   *
   * Responsabilidades:
   * - converter formatos antigos e novos de snapshot para um modelo comum;
   * - calcular tempo, atividades e adesão com fallback;
   * - anexar GAD-7 correspondente à semana;
   * - deduplicar semanas repetidas.
   *
   * ⚠️ Importante:
   * Quando há múltiplos snapshots para a mesma semana, os dados são mesclados.
   */
  private generateWeeklyHistory(snaps: any[], gad: any[]): any[] {
    const gad7Map = new Map(gad.map(a => [a.weekNumber, a]));

    // Map each snapshot to a raw entry first
    const rawEntries = snaps.map((s, index) => {
      const m = s.metrics || {};
      const items = Array.isArray(s.activities) ? s.activities : (Array.isArray(s.tasks) ? s.tasks : []);

      let time = Number(m.totalTimeSpent || m.timeSpent || m.duration || s.totalTimeSpent || s.timeSpent || s.duration || 0);
      if (time === 0 && items.length > 0) {
        time = items.reduce((sum: number, i: any) => sum + Number(i.timeSpent || i.duration || i.time || 0), 0);
      }

      let actComp = Number(m.completedActivities || m.activitiesCompleted || s.completedActivities || s.activitiesCompleted || 0);
      let actTot = Number(m.totalActivities || s.totalActivities || 0);
      if (actComp === 0 && items.length > 0) {
        actComp = items.filter((i:any) => i.status === 'completed' || i.completed || i.isCompleted).length;
        actTot = actTot || items.length;
      }

      let adherence = Number(m.adherenceScore || s.adherenceScore || m.adherenceRate || s.adherenceRate || 0);
      if (adherence === 0 && actTot > 0) adherence = (actComp / actTot) * 100;

      const weekNum = s.weekNumber || (snaps.length - index);
      return {
        weekNumber: weekNum,
        weekStartDate: s.weekStartDate?.toDate?.() || new Date(s.weekStartDate),
        weekEndDate: s.weekEndDate?.toDate?.() || new Date(s.weekEndDate),
        completionRate: Number(m.completionRate || s.completionRate || 0) || (actTot > 0 ? (actComp/actTot)*100 : 0),
        consistencyScore: Number(m.consistencyScore || s.consistencyScore || 0),
        adherenceScore: adherence,
        pointsEarned: Number(m.totalPointsEarned || s.pointsEarned || s.totalPointsEarned || 0),
        timeSpent: time,
        activitiesCompleted: actComp,
        activitiesTotal: actTot,
        streakAtEnd: Number(m.streakAtEndOfWeek || s.streak || 0),
        activityBreakdown: s.activityTypeBreakdown || s.activityBreakdown || {},
        dailyBreakdown: s.dailyBreakdown || {},
        gad7: gad7Map.get(weekNum) ? { score: gad7Map.get(weekNum)!.totalScore, severity: gad7Map.get(weekNum)!.severity } : undefined
      };
    });
    
    /**
     * Consolida múltiplos snapshots da mesma semana para evitar duplicidade visual
     * e somas incorretas no histórico do aluno.
     */
    const weekMap = new Map<number, any>();
    for (const entry of rawEntries) {
      const wn = entry.weekNumber;
      if (!weekMap.has(wn)) {
        weekMap.set(wn, { ...entry });
      } else {
        const existing = weekMap.get(wn)!;
        const mergedComp = existing.activitiesCompleted + entry.activitiesCompleted;
        const mergedTot = existing.activitiesTotal + entry.activitiesTotal;
        weekMap.set(wn, {
          ...existing,
          activitiesCompleted: mergedComp,
          activitiesTotal: mergedTot,
          completionRate: mergedTot > 0 ? (mergedComp / mergedTot) * 100 : Math.max(existing.completionRate, entry.completionRate),
          pointsEarned: existing.pointsEarned + entry.pointsEarned,
          timeSpent: existing.timeSpent + entry.timeSpent,
          consistencyScore: Math.max(existing.consistencyScore, entry.consistencyScore),
          adherenceScore: Math.max(existing.adherenceScore, entry.adherenceScore),
          streakAtEnd: Math.max(existing.streakAtEnd, entry.streakAtEnd),
          gad7: existing.gad7 || entry.gad7
        });
      }
    }

    // Return sorted descending by weekNumber (most recent first)
    return Array.from(weekMap.values()).sort((a, b) => b.weekNumber - a.weekNumber);
  }

  private async fetchStudentSnapshots(sid: string, weeks: number): Promise<any[]> {
    const q = query(collection(firestore, 'weeklySnapshots'), where('studentId', '==', sid), orderBy('weekStartDate', 'desc'), limit(weeks));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  private async fetchStudentGAD7(sid: string, _weeks: number): Promise<any[]> {
    const q = query(collection(firestore, 'gad7Assessments'), where('studentId', '==', sid), orderBy('completedAt', 'desc'), limit(5));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  // ============================================
  // 2. DASHBOARD GERAL (COMPARATIVO / RANKING)
  // ============================================

  /**
   * Gera análise comparativa global para o dashboard profissional.
   *
   * Fluxo:
   * 1. Define o período analisado
   * 2. Busca alunos acessíveis conforme o papel do usuário
   * 3. Busca snapshots e avaliações GAD-7
   * 4. Agrega métricas gerais
   * 5. Gera rankings comparativos
   *
   * Regra de acesso:
   * Coordenador vê todos os alunos ativos.
   * Psicólogo/terapeuta vê apenas alunos atribuídos.
   */
  async getComparativeAnalysis(userId: string, _filters: AnalyticsFilters): Promise<ComparativeAnalysis> {
    console.group('📊 [SERVICE] getComparativeAnalysis (Global)');
    try {
      const dateRange = { startDate: subWeeks(new Date(), 4), endDate: new Date(), label: 'Últimas 4 semanas' };
      const studentIds = await this.getAccessibleStudentIds(userId);

      if (studentIds.length === 0) {
        console.groupEnd();
        return this.getEmptyComparativeAnalysis(dateRange);
      }

      const [snapshots, assessments] = await Promise.all([
        this.fetchSnapshots(dateRange, studentIds),
        this.fetchGAD7Global(dateRange, studentIds)
      ]);

      const metrics = await this.snapshotAggregator.aggregateMetrics(snapshots, assessments);
      const studentRankings = await this.generateRankings(snapshots, studentIds);

      console.groupEnd();
      return {
        period: dateRange,
        summary: { totalStudents: studentIds.length, activeStudents: new Set(snapshots.map(s => s.studentId)).size, studentsWithGAD7: new Set(assessments.map(a => a.studentId)).size, metrics },
        studentRankings, classInsights: [],
        distributions: { completionRate: { bins: [], counts: [], average: metrics.averageCompletionRate, median: 0, stdDev: 0 }, gad7Score: { bins: [], counts: [], average: metrics.averageGAD7Score, median: 0, stdDev: 0 }, consistencyScore: { bins: [], counts: [], average: metrics.averageConsistencyScore, median: 0, stdDev: 0 } },
        classHeatmap: {}
      };
    } catch (error) {
      console.error('❌ [SERVICE-ERROR-GLOBAL]:', error);
      console.groupEnd();
      throw error;
    }
  }

  /**
   * Busca snapshots semanais em lotes de até 10 alunos.
   *
   * Motivo:
   * Firestore limita consultas com operador `in`.
   * Por isso, a lista de alunos é quebrada em batches.
   */
  private async fetchSnapshots(range: any, ids: string[]): Promise<WeeklySnapshot[]> {
    const snapshots: WeeklySnapshot[] = [];
    const ref = collection(firestore, 'weeklySnapshots');
    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10);
      const q = query(ref, where('studentId', 'in', batch), where('weekStartDate', '>=', Timestamp.fromDate(range.startDate)), orderBy('weekStartDate', 'desc'));
      const snap = await getDocs(q);
      snapshots.push(...this.mapSnapshots(snap));
    }
    return snapshots;
  }

  private async fetchGAD7Global(range: any, ids: string[]): Promise<GAD7Assessment[]> {
    const results: GAD7Assessment[] = [];
    const ref = collection(firestore, 'gad7Assessments');
    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10);
      const q = query(ref, where('studentId', 'in', batch), where('completedAt', '>=', Timestamp.fromDate(range.startDate)), orderBy('completedAt', 'desc'));
      const snap = await getDocs(q);
      results.push(...snap.docs.map(d => ({ id: d.id, ...d.data() } as GAD7Assessment)));
    }
    return results;
  }

  private mapSnapshots(snap: QuerySnapshot<DocumentData>): WeeklySnapshot[] {
    return snap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id, ...d,
        weekStartDate: d.weekStartDate?.toDate() || new Date(),
        weekEndDate: d.weekEndDate?.toDate() || new Date(),
        metrics: d.metrics || { completionRate: 0, consistencyScore: 0, adherenceScore: 0, totalPointsEarned: 0, totalTimeSpent: 0, completedActivities: 0, totalActivities: 0 },
        dailyBreakdown: d.dailyBreakdown || {}, activityTypeBreakdown: d.activityTypeBreakdown || {}
      } as WeeklySnapshot;
    });
  }

  private async countCompletedActivities(studentId: string): Promise<number> {
    try {
      const q = query(
        collectionGroup(firestore, 'activityProgress'),
        where('studentId', '==', studentId),
        where('status', '==', 'completed')
      );
      const snap = await getDocs(q);
      return snap.size;
    } catch {
      return 0;
    }
  }
  /**
   * Gera rankings do dashboard comparativo.
   *
   * Usa múltiplas fontes:
   * - snapshots semanais para engajamento;
   * - perfil do aluno para pontos;
   * - GAD-7 para bem-estar;
   * - activityProgress para total de atividades concluídas.
   *
   * ⚠️ Atenção:
   * O ranking de bem-estar considera principalmente GAD-7.
   * Quanto menor o GAD-7, melhor a posição.
   */
  private async generateRankings(snapshots: WeeklySnapshot[], studentIds: string[]): Promise<ComparativeAnalysis['studentRankings']> {
    const items: any[] = [];
    const studentMap = new Map<string, WeeklySnapshot[]>();
    snapshots.forEach(s => { if (!studentMap.has(s.studentId)) studentMap.set(s.studentId, []); studentMap.get(s.studentId)!.push(s); });

    await Promise.all(studentIds.map(async (id) => {
      try {
        const [profile, gad7List, completedCount] = await Promise.all([
          this.fetchStudentData(id),
          this.fetchStudentGAD7(id, 4),
          this.countCompletedActivities(id)
        ]);
        const snaps = studentMap.get(id) || [];
        const avg = snaps.length > 0 ? snaps.reduce((acc, s) => acc + (s.metrics?.completionRate || 0), 0) / snaps.length : 0;
        const latestGAD7 = gad7List[0] || null;
        const gad7Score: number | null = latestGAD7?.totalScore ?? null;
        
        /**
         * Calcula um score auxiliar de bem-estar combinando GAD-7 invertido e volume de atividades.
         * Quanto menor o GAD-7 e maior o engajamento, maior o wellnessScore.
         */
        const gadNorm = gad7Score != null ? (21 - gad7Score) / 21 : 0; // 0..1 (maior = melhor)
        const actNorm = Math.min(completedCount / 100, 1);              // 0..1 cap em 100
        const wellnessScore = gadNorm * 0.6 + actNorm * 0.4;           // peso 60/40

        items.push({
          studentId: id,
          studentName: profile.name,
          studentGrade: profile.grade,
          studentSchool: profile.school,
          studentTotalPoints: profile.totalPoints,
          value: avg,
          trend: 'stable',
          isAtRisk: avg < 30,
          gad7Score,
          gad7Severity: latestGAD7?.severity ?? null,
          completedActivities: completedCount,
          wellnessScore
        });
      } catch (e) {}
    }));

    // byWellness: menor GAD-7 primeiro; alunos sem GAD-7 ou com GAD-7 = 0 são excluídos
    const byWellness = items
      .filter(i => i.gad7Score != null && i.gad7Score > 0)
      .sort((a, b) => (a.gad7Score ?? Infinity) - (b.gad7Score ?? Infinity));
    return { byEngagement: [...items].sort((a, b) => b.value - a.value), byPoints: [...items].sort((a, b) => b.studentTotalPoints - a.studentTotalPoints), byImprovement: items, byGAD7Improvement: [], byWellness, atRisk: items.filter(i => i.isAtRisk) };
  }
  
  /**
   * Retorna os alunos que o usuário atual pode visualizar.
   *
   * Regra:
   * - coordinator: todos os alunos ativos
   * - demais profissionais: apenas alunos atribuídos ao userId
   */
  private async getAccessibleStudentIds(userId: string): Promise<string[]> {
    const ref = collection(firestore, 'students');
    const q = (this.userRole === 'coordinator') ? query(ref, where('isActive', '==', true)) : query(ref, where('profile.assignedProfessionals', 'array-contains', userId), where('isActive', '==', true));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.id);
  }

  async getCorrelationAnalysis(_userId: string, _filters: AnalyticsFilters): Promise<null> {
    return null;
  }

  private getEmptyComparativeAnalysis(r: DateRange): ComparativeAnalysis {
    return { period: r, summary: { totalStudents: 0, activeStudents: 0, studentsWithGAD7: 0, metrics: {} as any }, studentRankings: { byEngagement: [], byPoints: [], byImprovement: [], byGAD7Improvement: [], byWellness: [], atRisk: [] }, classInsights: [], distributions: {} as any, classHeatmap: {} };
  }
}