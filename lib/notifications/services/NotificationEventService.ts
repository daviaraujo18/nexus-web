// lib/notifications/services/NotificationEventService.ts
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/firebase/config';
import { NotificationPreferenceService, type NotificationKind } from './NotificationPreferenceService';

type DispatchInput = {
  userId: string;
  type: NotificationKind;
  title: string;
  body: string;
  route: string;
  data?: Record<string, string>;
};

type SendPushPayload = {
  userId: string;
  notification: {
    title: string;
    body: string;
  };
  data?: {
    type?: string;
    route?: string;
    url?: string;
    clickAction?: string;
    tag?: string;
    entityId?: string;
    sentAt?: string;
    [key: string]: string | undefined;
  };
};

type PushResponse = {
  success: boolean;
  sent: number;
  failed: number;
  skipped?: boolean;
  skippedCount?: number;
  reason?: string | null;
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

    // Envia via Firebase Function (backend) - nunca diretamente
    const sendPushNotification = httpsCallable<SendPushPayload, PushResponse>(
      functions,
      'sendPushNotification'
    );

    await sendPushNotification({
      userId: input.userId,
      notification: {
        title: input.title,
        body: input.body,
      },
      data: {
        type: input.type,
        route: input.route,
        url: input.route,
        clickAction: input.route,
        tag: input.type,
        sentAt: new Date().toISOString(),
        ...input.data,
      },
    });

    return { sent: true as const };
  }
}