// lib/notifications/services/NotificationEventService.ts
import { NotificationService } from '@/lib/services/NotificationService';
import { NotificationPreferenceService, type NotificationKind } from './NotificationPreferenceService';

type DispatchInput = {
  userId: string;
  type: NotificationKind;
  title: string;
  body: string;
  route: string;
  data?: Record<string, string>;
};

export class NotificationEventService {
  static async dispatch(input: DispatchInput) {
    const allowed = await NotificationPreferenceService.canSend({
      userId: input.userId,
      type: input.type,
    });

    if (!allowed) {
      return { sent: false, reason: 'preferences_blocked' as const };
    }

    await NotificationService.sendTypedNotification({
      userId: input.userId,
      title: input.title,
      body: input.body,
      type: input.type,
      route: input.route,
    });

    return { sent: true as const };
  }
}