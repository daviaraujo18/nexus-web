// types/notification.ts - NOVO ARQUIVO
export type NotificationType = 
  | 'activity_reminder' 
  | 'schedule_update' 
  | 'achievement' 
  | 'message' 
  | 'system'
  | 'therapeutic_reminder'
  | 'educational_reminder';

export type NotificationChannel = 'push' | 'in_app' | 'email' | 'sms';
export type NotificationStatus = 'scheduled' | 'sent' | 'delivered' | 'read' | 'failed' | 'cancelled';

export interface Notification {
  id: string;
  userId: string; // Destinatário
  title: string;
  body: string;
  type: NotificationType;
  
  // Dados específicos
  data?: {
    activityId?: string;
    scheduleInstanceId?: string;
    scheduleTemplateId?: string;
    route?: string; // Ex: '/student/activity/123'
    deepLink?: string;
    priority?: 'high' | 'normal' | 'low';
    [key: string]: any;
  };
  
  // Controle de entrega
  channels: NotificationChannel[];
  scheduledFor: Date;
  sentAt?: Date;
  expiresAt: Date;
  
  // Status e tracking
  status: NotificationStatus;
  deliveryAttempts: number;
  lastAttemptAt?: Date;
  
  // Metadados
  metadata: {
    triggeredBy: 'system' | 'professional' | 'automated' | 'user';
    campaignId?: string;
    templateId?: string;
    therapeuticContext?: string;
    [key: string]: any;
  };
  
  // Resposta do usuário
  userInteraction?: {
    interactedAt?: Date;
    action?: 'dismissed' | 'clicked' | 'snoozed' | 'ignored';
    emotionalState?: number; // 1-5
    feedback?: string;
  };
  
  // Timestamps padrão
  createdAt: Date;
  updatedAt: Date;
}

export interface UserNotificationPreferences {
  userId: string;
  enabled: boolean;
  
  // Canais preferidos
  channels: {
    push: boolean;
    in_app: boolean;
    email: boolean;
    sms: boolean;
  };
  
  // Horários permitidos
  allowedHours: {
    start: string; // "08:00"
    end: string;   // "21:00"
  };
  
  // Dias da semana permitidos (0-6, Domingo-Sábado)
  allowedDays: number[];
  
  // Preferências por tipo
  types: Record<NotificationType, boolean>;
  
  // Configurações específicas para saúde mental
  therapeuticSettings?: {
    avoidEveningNotifications?: boolean; // Evitar notificações à noite
    weekendReducedFrequency?: boolean; // Reduzir frequência no fim de semana
    emotionalStateConsideration?: boolean; // Considerar estado emocional
    maxDailyNotifications?: number; // Máximo de notificações por dia
  };
  
  updatedAt: Date;
}

export interface NotificationAnalytics {
  notificationId: string;
  userId: string;
  
  // Métricas de entrega
  delivery: {
    attemptedAt: Date;
    deliveredAt?: Date;
    failedAt?: Date;
    failureReason?: string;
    retryCount: number;
  };
  
  // Métricas de engajamento
  engagement?: {
    viewedAt?: Date;
    clickedAt?: Date;
    timeToView?: number; // segundos
    timeToClick?: number; // segundos
    dismissedAt?: Date;
  };
  
  // Contexto do dispositivo
  deviceContext?: {
    platform: string;
    browser: string;
    online: boolean;
    batteryLevel?: number;
  };
  
  createdAt: Date;
}

export interface CreateNotificationDTO {
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  data?: Notification['data'];
  channels?: NotificationChannel[];
  scheduledFor?: Date;
  priority?: 'high' | 'normal' | 'low';
}

export interface SendTestNotificationDTO {
  userId: string;
  title: string;
  body: string;
  channel: NotificationChannel;
}

// Tipos para resposta de APIs
export interface NotificationResponse {
  success: boolean;
  notificationId?: string;
  error?: string;
  details?: any;
}