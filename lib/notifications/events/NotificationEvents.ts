// lib/notifications/events/NotificationEvents.ts
import { NotificationEventService } from '../services/NotificationEventService';

export class NotificationEvents {
  static async onMessageCreated(params: { userId: string }) {
    return NotificationEventService.dispatch({
      userId: params.userId,
      type: 'message',
      title: 'Nova mensagem',
      body: 'Você recebeu uma nova mensagem da equipe.',
      route: '/student/notifications',
    });
  }

  static async onScheduleUpdated(params: { userId: string }) {
    return NotificationEventService.dispatch({
      userId: params.userId,
      type: 'schedule_update',
      title: 'Atualização de agenda',
      body: 'Sua agenda recebeu uma atualização importante.',
      route: '/student/schedules',
    });
  }

  static async onAchievementUnlocked(params: { userId: string }) {
    return NotificationEventService.dispatch({
      userId: params.userId,
      type: 'achievement',
      title: 'Conquista desbloqueada',
      body: 'Parabéns! Você desbloqueou uma nova conquista.',
      route: '/student/progress',
    });
  }
}