// lib/notifications/services/NotificationEventService.ts
import { OneSignalGateway } from '../gateways/OneSignalGateway';
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

    await OneSignalGateway.send({
      userId: input.userId,
      title: input.title,
      body: input.body,
      type: input.type,
      route: input.route,
      data: input.data,
    });

    return { sent: true as const };
  }
}