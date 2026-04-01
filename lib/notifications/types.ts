export const NOTIFICATION_TYPES = [
  'activity_reminder',
  'therapeutic_reminder',
  'educational_reminder',
  'achievement',
  'schedule_update',
  'message',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  activity_reminder: 'Lembrete de Atividade',
  therapeutic_reminder: 'Lembrete Terapêutico',
  educational_reminder: 'Lembrete Educacional',
  achievement: 'Conquista',
  schedule_update: 'Atualização de Agenda',
  message: 'Mensagem',
};