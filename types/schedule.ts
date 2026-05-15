// types/schedule.ts
export type ScheduleCategory = 'therapeutic' | 'educational' | 'mixed';
export type ActivityType = 'quick' | 'text' | 'quiz' | 'video' | 'checklist' | 'file' | 'app' | 'physical_activity';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type ScheduleStatus = 'draft' | 'active' | 'archived';
export type InstanceStatus = 'active' | 'paused' | 'completed' | 'overdue';
export type ProgressStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface BaseModel {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

// Configurações específicas por tipo de atividade
export interface QuickActivityConfig {
  requiresConfirmation?: boolean;
  autoComplete?: boolean;
}

export interface AppActivityConfig {
  requiresConfirmation?: boolean;
  autoComplete?: boolean;
}

export interface TextActivityConfig {
  minWords?: number;
  maxWords?: number;
  format?: 'plain' | 'markdown';
}

export interface QuizActivityConfig {
  questions: Array<{
    id: string;
    question: string;
    type: 'multiple_choice' | 'true_false' | 'short_answer';
    options?: string[];
    correctAnswer: string | string[];
    points: number;
  }>;
  passingScore: number;
  maxAttempts?: number;
}

export interface VideoActivityConfig {
  url: string;
  provider: 'youtube' | 'vimeo' | 'custom';
  requireWatchPercentage?: number; // 0-100
}

export interface ChecklistActivityConfig {
  items: Array<{
    id: string;
    label: string;
    required: boolean;
  }>;
}

export interface FileActivityConfig {
  allowedTypes: string[];
  maxSizeMB: number;
  maxFiles?: number;
}

export type ActivityConfig =
  | QuickActivityConfig
  | TextActivityConfig
  | QuizActivityConfig
  | VideoActivityConfig
  | ChecklistActivityConfig
  | FileActivityConfig
  | AppActivityConfig; 

// MODELOS PRINCIPAIS
export interface ScheduleTemplate extends BaseModel {
  professionalId: string;
  name: string;
  description?: string;
  category: ScheduleCategory;

  // Configurações de tempo
  startDate: Date;
  endDate: Date;
  activeDays: number[]; // 0-6 (Domingo-Sábado)

  // Regras de repetição
  repeatRules: {
    type: 'weekly';
    resetOnRepeat: boolean;
  };

  // Metadados
  metadata: {
    version: number;
    estimatedWeeklyHours: number;
    totalActivities: number;
    tags: string[];
  };
}

export interface ScheduleActivity extends BaseModel {
  scheduleTemplateId: string;
  dayOfWeek: number; // 0-6
  orderIndex: number;

  // Tipo e conteúdo
  type: ActivityType;
  title: string;
  description?: string;
  instructions: string;

  // Configuração específica
  config: ActivityConfig;

  // Pontuação e obrigatoriedade
  scoring: {
    isRequired: boolean;
    pointsOnCompletion: number;
    bonusPoints?: number;
    penaltyPoints?: number;
  };

  // Metadados
  metadata: {
    estimatedDuration: number; // minutos
    difficulty: DifficultyLevel;
    therapeuticFocus?: string[];
    educationalFocus?: string[];
    gradeLevel?: string | null;
    subject?: string | null;
  };

  // Recursos
  resources?: {
    links?: Array<{
      url: string;
      title: string;
      type: 'video' | 'article' | 'tool';
    }>;
    attachments?: Array<{
      name: string;
      url: string;
      type: string;
      size: number;
    }>;
  };
}

export interface ScheduleInstance extends BaseModel {
  scheduleTemplateId: string;
  scheduleName?: string;
  studentId: string;
  professionalId: string;

  // Período atual
  currentWeekNumber: number;
  currentWeekStartDate: Date;
  currentWeekEndDate: Date;

  // Estado
  status: InstanceStatus;
  startedAt?: Date;
  completedAt?: Date;

  // Personalizações
  customizations?: {
    excludedActivities?: string[];
    adjustedDeadlines?: Record<string, Date>;
    customInstructions?: Record<string, string>;
  };

  // Cache de progresso (atualizado periodicamente)
  progressCache?: {
    completedActivities: number;
    totalActivities: number;
    completionPercentage: number;
    totalPointsEarned: number;
    streakDays: number;
    lastUpdatedAt: Date;
  };
}

export interface ActivityProgress extends BaseModel {
  scheduleInstanceId: string;
  activityId: string;
  studentId: string;
  weekNumber: number;
  dayOfWeek: number;

  // Snapshot da atividade no momento da execução
  activitySnapshot: ScheduleActivity;

  // Status
  status: ProgressStatus;
  scheduledDate: Date;
  startedAt?: Date;
  completedAt?: Date;
  dueDate?: Date;

  // Dados de execução
  executionData?: {
    timeSpent?: number; // minutos
    submission?: any;
    emotionalState?: {
      before?: number; // 1-5
      after?: number;
    };
    notes?: string;
    attachments?: string[]; // URLs
  };

  // Pontuação
  scoring: {
    pointsEarned: number;
    bonusPoints?: number;
    penaltyPoints?: number;
    feedback?: string;
    evaluatedBy?: string;
    evaluatedAt?: Date;
  };

  // Para quizzes
  attempts?: Array<{
    attemptNumber: number;
    startedAt: Date;
    completedAt: Date;
    score: number;
    answers: Record<string, any>;
  }>;
}

export interface PerformanceSnapshot extends BaseModel {
  scheduleInstanceId: string;
  studentId: string;
  weekNumber: number;
  weekStartDate: Date;
  weekEndDate: Date;
  totalActivities?: number;
  completedActivities?: number;
  skippedActivities?: number;


  // Métricas de engajamento
  engagement: {
    completionRate: number; // 0-100
    averageTimePerActivity: number; // minutos
    consistencyScore: number; // 0-100
    adherenceToSchedule: number; // 0-100
    emotionalEngagement?: number; // 0-100
  };

  // Métricas de desempenho
  performance: {
    totalPointsEarned: number;
    averageScorePerActivity: number;
    bestPerformingDay?: number; // 0-6
    worstPerformingDay?: number;
    improvementFromPreviousWeek?: number;
  };

  // Análise por tipo de atividade
  activityTypeAnalysis: Record<string, {
    completed: number;
    averageScore: number;
    averageTime: number;
  }>;

  // Insights automáticos
  insights: {
    strengths: string[];
    challenges: string[];
    recommendations: string[];
    riskFactors?: string[];
  };

  // Dados brutos agregados
  aggregatedData: {
    activitiesByDay: Record<number, { completed: number; total: number }>;
    timeDistribution: {
      morning: number; // 6-12
      afternoon: number; // 12-18
      evening: number; // 18-24
      night: number; // 0-6
    };
    emotionalTrend?: number[]; // Pontuações ao longo da semana
  };
}

// DTOs para criação/atualização
export interface CreateScheduleDTO {
  name: string;
  description?: string;
  category: ScheduleCategory;
  startDate: Date;
  endDate: Date;
  activeDays: number[];
  repeatRules: {
    resetOnRepeat: boolean;
  };
  activities: CreateActivityDTO[];
}

export interface CreateActivityDTO {
  dayOfWeek: number;
  orderIndex: number;
  type: ActivityType;
  title: string;
  description?: string;
  instructions: string;
  config: ActivityConfig;
  scoring: {
    isRequired: boolean;
    pointsOnCompletion: number;
    bonusPoints?: number;
  };
  metadata: {
    estimatedDuration: number;
    difficulty: DifficultyLevel;
    therapeuticFocus?: string[];
    educationalFocus?: string[];
    gradeLevel?: string | null;
    subject?: string | null;
  };
}

export interface AssignScheduleDTO {
  studentIds: string[];
  startDate: Date;
  endDate?: Date;
  allowMultiple?: boolean;
  customizations?: Record<string, {
    excludedActivities?: string[];
    adjustedDeadlines?: Record<string, Date>;
  }>;
}

// Tipos para relatórios simplificados mas precisos
export interface WeeklyReportData {
  weekNumber: number;
  weekStartDate: Date;
  weekEndDate: Date;

  summary: {
    totalActivities: number;
    completedActivities: number;
    skippedActivities: number;
    completionRate: number;
    totalPoints: number;
    averageScore: number;
    consistencyScore: number;
    averageTimePerActivity: number;
    adherenceScore: number; // % de atividades no dia correto
  };

  dayBreakdown: Record<number, {
    total: number;
    completed: number;
    skipped: number;
    averageScore: number;
    averageTime: number;
  }>;

  activityTypeBreakdown: Record<ActivityType, {
    total: number;
    completed: number;
    averageScore: number;
    averageTime: number;
  }>;

  insights: {
    strengths: string[];
    challenges: string[];
    recommendations: string[];
    generatedAt: Date;
    dataSource: 'calculated' | 'cached';
  };
}

export interface StudentReport {
  studentId: string;
  studentName: string;
  school: string;
  grade: string;

  // Métricas sincronizadas com o que aluno vê
  overall: {
    totalPoints: number; // Mesmo que profile.totalPoints
    currentLevel: number; // Mesmo que profile.level
    streak: number; // Mesmo que profile.streak
    totalActivitiesCompleted: number;
    averageCompletionRate: number;
    totalTimeSpent: number; // minutos
    lastActivityDate?: Date;
  };

  // Histórico (máximo 8 semanas)
  weeklyReports: WeeklyReportData[];

  // Tendência baseada em dados reais
  trend: 'improving' | 'stable' | 'declining';
  trendConfidence: 'high' | 'medium' | 'low';

  // Metadados de geração
  generatedAt: Date;
  dataFreshness: 'realtime' | 'cached' | 'stale';
  calculationMethod: 'full' | 'incremental' | 'cached';
}

export interface ComparativeReport {
  period: 'week' | 'month' | 'quarter';
  startDate: Date;
  endDate: Date;

  students: Array<{
    studentId: string;
    studentName: string;
    school: string;
    grade: string;
    completionRate: number;
    averageScore: number;
    consistency: number;
    totalPoints: number;
    streak: number;
    trend: 'improving' | 'stable' | 'declining';
    lastActivity?: Date;
  }>;

  groupAverages: {
    averageCompletionRate: number;
    averageScore: number;
    averageConsistency: number;
    averageStreak: number;
  };

  generatedAt: Date;
  studentCount: number;
}

export interface WeeklySnapshot extends BaseModel {
  scheduleInstanceId: string;
  studentId: string;
  weekNumber: number;
  weekStartDate: Date;
  weekEndDate: Date;

  // Métricas básicas
  metrics: {
    totalActivities: number;
    completedActivities: number;
    skippedActivities: number;
    completionRate: number; // 0-100
    totalPointsEarned: number;
    averagePointsPerActivity: number;
    totalTimeSpent: number; // minutos
    averageTimePerActivity: number; // minutos
    consistencyScore: number; // 0-100 (dias com atividades)
    adherenceScore: number; // 0-100 (no dia correto)
    streakAtEndOfWeek: number;
  };

  // Análise por dia
  dailyBreakdown: Record<number, {
    total: number;
    completed: number;
    skipped: number;
    pointsEarned: number;
    timeSpent: number;
  }>;

  // Análise por tipo
  activityTypeBreakdown: Record<ActivityType, {
    total: number;
    completed: number;
    averagePoints: number;
    averageTime: number;
  }>;

  // Metadados
  metadata: {
    scheduleTemplateName: string;
    scheduleTemplateId: string;
    professionalId: string;
    generatedBy: 'system' | 'manual';
    dataSource: 'calculated' | 'cached';
    scheduleName?: string;
  };
}

// Tipo para resultado do reset
export interface WeeklyResetResult {
  instanceId: string;
  oldWeekNumber: number;
  newWeekNumber: number;
  snapshotId?: string;
  newActivitiesCount: number;
  status: 'success' | 'skipped' | 'error';
  error?: string;
}

// Interface para DTO de geração de snapshot
export interface GenerateSnapshotDTO {
  scheduleInstanceId: string;
  weekNumber: number;
  forceRegenerate?: boolean;
}

// Interface para DTO de reset semanal
export interface ProcessWeeklyResetDTO {
  batchSize?: number;
  forceAll?: boolean;
  dryRun?: boolean;
}