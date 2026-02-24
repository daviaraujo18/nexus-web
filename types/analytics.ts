// types/analytics.ts
import { Timestamp } from 'firebase/firestore';
import { GAD7Severity, GAD7Response } from './GAD7';
import { ActivityType } from './schedule';

// ============================================
// FILTROS E PERÍODOS
// ============================================

export type AnalyticsPeriod = 'week' | 'month' | 'quarter' | 'custom';
export type AnalyticsTrend = 'improving' | 'stable' | 'declining' | 'insufficient_data';
export type InsightType = 'warning' | 'success' | 'info' | 'trend' | 'risk';
export type ComparisonType = 'vs_previous' | 'vs_average' | 'vs_goal';

export interface DateRange {
  startDate: Date;
  endDate: Date;
  label: string;
}

export interface AnalyticsFilters {
  period: AnalyticsPeriod;
  customRange?: DateRange;
  studentIds?: string[];
  programIds?: string[];
  professionalId?: string;
  minCompletionRate?: number;
  maxCompletionRate?: number;
  gad7Severity?: GAD7Severity[];
}

// ============================================
// MÉTRICAS AGREGADAS
// ============================================

export interface AggregatedMetrics {
  // Engajamento
  averageCompletionRate: number;
  averageConsistencyScore: number;
  averageAdherenceScore: number;
  averageTimePerActivity: number; // minutos
  totalActivitiesCompleted: number;
  totalTimeSpent: number; // minutos
  
  // Pontuação
  totalPointsEarned: number;
  averagePointsPerStudent: number;
  pointsDistribution: {
    min: number;
    max: number;
    median: number;
    average: number;
  };
  
  // GAD7
  averageGAD7Score: number;
  gad7Distribution: Record<GAD7Severity, number>;
  studentsWithGAD7: number; // % que completaram
  gad7Trend: AnalyticsTrend;
  
  // Streaks
  averageStreak: number;
  maxStreak: number;
  studentsWithActiveStreak: number; // streak > 0
}

// ============================================
// ANÁLISE POR ALUNO
// ============================================

export interface StudentAnalyticsSummary {
  studentId: string;
  studentName: string;
  studentGrade: string;
  studentSchool: string;
  profileImage?: string;
  
  // Métricas atuais (última semana)
  currentMetrics: {
    completionRate: number;
    consistencyScore: number;
    adherenceScore: number;
    totalPoints: number;
    streak: number;
    level: number;
    gad7Score?: number;
    gad7Severity?: GAD7Severity;
    lastActivityDate?: Date;
  };
  
  // Tendências
  trends: {
    completionRate: AnalyticsTrend;
    gad7Score: AnalyticsTrend;
    consistency: AnalyticsTrend;
    confidence: 'high' | 'medium' | 'low';
  };
  
  // Histórico (últimas 8 semanas)
  weeklyHistory: StudentWeeklyMetrics[];
  
  // Comparações
  comparisons: {
    vsClassAverage: number; // -100 a +100 (percentual)
    vsPreviousWeek: number; // -100 a +100
    percentile: number; // 0-100 (melhor que X% dos alunos)
  };
  
  // Insights personalizados
  insights: Insight[];
  
  // Risco
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: string[];
}

export interface StudentWeeklyMetrics {
  weekNumber: number;
  weekStartDate: Date;
  weekEndDate: Date;
  
  // Métricas do snapshot
  completionRate: number;
  consistencyScore: number;
  adherenceScore: number;
  pointsEarned: number;
  timeSpent: number;
  activitiesCompleted: number;
  streakAtEnd: number;
  
  // Breakdown por tipo
  activityBreakdown: Record<ActivityType, {
    completed: number;
    total: number;
    averageTime: number;
    pointsEarned: number;
  }>;
  
  // Breakdown por dia
  dailyBreakdown: Record<number, {
    completed: number;
    total: number;
    pointsEarned: number;
    timeSpent: number;
  }>;
  
  // GAD7 da semana (se disponível)
  gad7?: {
    score: number;
    severity: GAD7Severity;
    responses: GAD7Response;
    completedAt: Date;
  };
  
  // Se foi uma semana de melhora/piora
  isImprovement: boolean;
  isDecline: boolean;
}

// ============================================
// ANÁLISE COMPARATIVA
// ============================================

export interface ComparativeAnalysis {
  period: DateRange;
  previousPeriod?: DateRange;
  
  // Visão geral
  summary: {
    totalStudents: number;
    activeStudents: number; // Completaram pelo menos 1 atividade
    studentsWithGAD7: number;
    
    // Métricas agregadas
    metrics: AggregatedMetrics;
  };
  
  // Ranking de alunos
  studentRankings: {
    byEngagement: StudentRankingItem[];
    byImprovement: StudentRankingItem[];
    byGAD7Improvement: StudentRankingItem[];
    atRisk: StudentRankingItem[];
  };
  
  // Comparação com período anterior
  comparison?: {
    completionRateChange: number; // percentual
    gad7ScoreChange: number;
    consistencyChange: number;
    engagementChange: number;
    isImproving: boolean;
  };
  
  // Insights da turma
  classInsights: Insight[];
  
  // Distribuições
  distributions: {
    completionRate: DistributionData;
    gad7Score: DistributionData;
    consistencyScore: DistributionData;
  };
  
  // Heatmap da turma (média por dia da semana)
  classHeatmap: Record<number, {
    averageCompletion: number;
    averageGAD7?: number;
    totalActivities: number;
  }>;
}

export interface StudentRankingItem {
  studentId: string;
  studentName: string;
  studentGrade: string;
  studentSchool: string;
  value: number; // métrica de ordenação
  trend: AnalyticsTrend;
  percentile: number;
  isAtRisk: boolean;
}

export interface DistributionData {
  bins: number[];
  counts: number[];
  average: number;
  median: number;
  stdDev: number;
}

// ============================================
// CORRELAÇÕES E INSIGHTS
// ============================================

export interface CorrelationAnalysis {
  // Correlação entre GAD7 e métricas de engajamento
  gad7VsEngagement: {
    pearsonCorrelation: number; // -1 a 1
    significance: 'high' | 'medium' | 'low' | 'none';
    scatterData: Array<{
      gad7Score: number;
      completionRate: number;
      studentId: string;
    }>;
  };
  
  // Impacto por tipo de atividade
  activityTypeImpact: Record<ActivityType, {
    averageGAD7Change: number; // quanto melhora/piora
    sampleSize: number;
    confidence: 'high' | 'medium' | 'low';
  }>;
  
  // Padrões temporais
  temporalPatterns: {
    bestDayForEngagement: number; // 0-6
    worstDayForEngagement: number;
    highestAnxietyDay: number; // dia com maior GAD7
    lowestAnxietyDay: number;
    timeOfDayPreference?: 'morning' | 'afternoon' | 'evening' | 'night';
  };
  
  // Preditores de risco
  riskPredictors: {
    lowConsistency: number; // threshold
    highGAD7Increasing: number; // threshold
    missedDaysInRow: number; // threshold
    recentDrop: number; // % de queda
  };
}

export interface Insight {
  id: string;
  type: InsightType;
  title: string;
  description: string;
  metric?: string;
  value?: number;
  threshold?: number;
  trend?: AnalyticsTrend;
  action?: {
    label: string;
    href: string;
    onClick?: () => void;
  };
  createdAt: Date;
  expiresAt?: Date;
  dismissed?: boolean;
}

// ============================================
// RELATÓRIOS E EXPORTAÇÃO
// ============================================

export interface ReportConfig {
  title: string;
  description?: string;
  dateRange: DateRange;
  includeStudents: 'all' | 'selected' | 'at_risk';
  studentIds?: string[];
  sections: {
    summary: boolean;
    rankings: boolean;
    trends: boolean;
    gad7: boolean;
    correlations: boolean;
    individualReports: boolean;
  };
  format: 'pdf' | 'csv' | 'json';
  includeCharts: boolean;
}

export interface ExportedReport {
  id: string;
  generatedAt: Date;
  generatedBy: string; // professionalId
  config: ReportConfig;
  data: ComparativeAnalysis;
  downloadUrl?: string;
  fileSize?: number;
  expiresAt?: Date;
}

// ============================================
// ESTADO DO DASHBOARD
// ============================================

export interface AnalyticsState {
  filters: AnalyticsFilters;
  selectedStudentId?: string;
  selectedComparison?: ComparisonType;
  isLoading: boolean;
  error?: string;
  lastUpdated?: Date;
  data?: ComparativeAnalysis;
  studentData?: Record<string, StudentAnalyticsSummary>;
  correlations?: CorrelationAnalysis;
}

export type AnalyticsAction =
  | { type: 'SET_FILTERS'; payload: AnalyticsFilters }
  | { type: 'SELECT_STUDENT'; payload: string }
  | { type: 'SET_COMPARISON'; payload: ComparisonType }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | undefined }
  | { type: 'SET_DATA'; payload: ComparativeAnalysis }
  | { type: 'SET_STUDENT_DATA'; payload: Record<string, StudentAnalyticsSummary> }
  | { type: 'SET_CORRELATIONS'; payload: CorrelationAnalysis }
  | { type: 'RESET' };