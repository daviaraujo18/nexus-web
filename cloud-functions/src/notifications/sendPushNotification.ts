import { defineSecret } from 'firebase-functions/params';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const ONESIGNAL_REST_API_KEY = defineSecret('ONESIGNAL_REST_API_KEY');

if (!admin.apps.length) {
  admin.initializeApp();
}

const APP_TIMEZONE = 'America/Sao_Paulo';

const ALLOWED_NOTIFICATION_TYPES = [
  'activity_reminder',
  'therapeutic_reminder',
  'educational_reminder',
  'achievement',
  'schedule_update',
  'message',
] as const;

type NotificationType = (typeof ALLOWED_NOTIFICATION_TYPES)[number];
type NormalizedNotificationType = NotificationType | 'generic_notification';

type TokenDoc = {
  docId: string;
  token: string;
  updatedAtMillis: number;
};

type RawPayload = {
  userId?: unknown;
  title?: unknown;
  body?: unknown;
  notification?: {
    title?: unknown;
    body?: unknown;
  };
  data?: Record<string, unknown>;
};

type PushFailure = {
  success?: boolean;
  errorCode?: string | null;
  errorMessage?: string | null;
  token?: string | null;
  docId?: string | null;
};

type NotificationPreferencesPayload = {
  enabled?: unknown;
  channels?: {
    push?: unknown;
    in_app?: unknown;
    email?: unknown;
  };
  allowedHours?: {
    start?: unknown;
    end?: unknown;
  };
  allowedDays?: unknown;
  types?: {
    activity_reminder?: unknown;
    therapeutic_reminder?: unknown;
    educational_reminder?: unknown;
    achievement?: unknown;
    schedule_update?: unknown;
    message?: unknown;
  };
  therapeuticSettings?: {
    avoidEveningNotifications?: unknown;
    weekendReducedFrequency?: unknown;
    maxDailyNotifications?: unknown;
  };
};

type NormalizedNotificationPreferences = {
  enabled: boolean;
  channels: {
    push: boolean;
    in_app: boolean;
    email: boolean;
  };
  allowedHours: {
    start: string;
    end: string;
  };
  allowedDays: number[];
  types: {
    activity_reminder: boolean;
    therapeutic_reminder: boolean;
    educational_reminder: boolean;
    achievement: boolean;
    schedule_update: boolean;
    message: boolean;
  };
  therapeuticSettings: {
    avoidEveningNotifications: boolean;
    weekendReducedFrequency: boolean;
    maxDailyNotifications: number;
  };
};

function toStringMap(data: Record<string, unknown>): Record<string, string> {
  return Object.entries(data).reduce<Record<string, string>>((acc, [key, value]) => {
    if (value === undefined || value === null) {
      return acc;
    }

    acc[key] = typeof value === 'string' ? value : JSON.stringify(value);
    return acc;
  }, {});
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asNonEmptyString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asAllowedDays(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [1, 2, 3, 4, 5];
  }

  const unique = new Set<number>();

  for (const item of value) {
    if (Number.isInteger(item) && item >= 0 && item <= 6) {
      unique.add(item);
    }
  }

  return unique.size > 0 ? Array.from(unique).sort((a, b) => a - b) : [1, 2, 3, 4, 5];
}

function asMaxDailyNotifications(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 4;
  }

  const rounded = Math.round(value);
  return Math.min(Math.max(rounded, 1), 20);
}

function normalizeStoredPreferences(
  raw: NotificationPreferencesPayload | null | undefined,
): NormalizedNotificationPreferences {
  const data = raw ?? {};

  return {
    enabled: asBoolean(data.enabled, true),
    channels: {
      push: asBoolean(data.channels?.push, false),
      in_app: asBoolean(data.channels?.in_app, true),
      email: asBoolean(data.channels?.email, false),
    },
    allowedHours: {
      start: asNonEmptyString(data.allowedHours?.start, '08:00'),
      end: asNonEmptyString(data.allowedHours?.end, '20:00'),
    },
    allowedDays: asAllowedDays(data.allowedDays),
    types: {
      activity_reminder: asBoolean(data.types?.activity_reminder, true),
      therapeutic_reminder: asBoolean(data.types?.therapeutic_reminder, true),
      educational_reminder: asBoolean(data.types?.educational_reminder, true),
      achievement: asBoolean(data.types?.achievement, true),
      schedule_update: asBoolean(data.types?.schedule_update, true),
      message: asBoolean(data.types?.message, true),
    },
    therapeuticSettings: {
      avoidEveningNotifications: asBoolean(
        data.therapeuticSettings?.avoidEveningNotifications,
        false,
      ),
      weekendReducedFrequency: asBoolean(
        data.therapeuticSettings?.weekendReducedFrequency,
        false,
      ),
      maxDailyNotifications: asMaxDailyNotifications(
        data.therapeuticSettings?.maxDailyNotifications,
      ),
    },
  };
}

function getNotificationType(value: unknown): NormalizedNotificationType {
  const rawType = getString(value);

  if (!rawType) {
    return 'generic_notification';
  }

  return (ALLOWED_NOTIFICATION_TYPES as readonly string[]).includes(rawType)
    ? (rawType as NotificationType)
    : 'generic_notification';
}

function parseHourToMinutes(value?: string): number | null {
  if (!value) return null;

  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return hour * 60 + minute;
}

function getCurrentTimeContext() {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date());
  const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const weekday = weekdayMap[partMap.weekday ?? ''] ?? 0;
  const hour = Number(partMap.hour ?? '0');
  const minute = Number(partMap.minute ?? '0');
  const currentMinutes = hour * 60 + minute;

  return { weekday, currentMinutes };
}

function isWithinAllowedDays(days: number[]): boolean {
  const { weekday } = getCurrentTimeContext();
  return days.includes(weekday);
}

function isWithinAllowedHours(
  allowedHours: { start: string; end: string },
): boolean {
  const startMinutes = parseHourToMinutes(allowedHours.start);
  const endMinutes = parseHourToMinutes(allowedHours.end);

  if (startMinutes === null || endMinutes === null) {
    return true;
  }

  const { currentMinutes } = getCurrentTimeContext();

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

//function isTypeEnabled(
//  preferences: NormalizedNotificationPreferences,
//  notificationType: NormalizedNotificationType,
//): boolean {
//  if (notificationType === 'generic_notification') {
//    return true;
//  }
//
//  return preferences.types[notificationType];
//}

async function loadNormalizedPreferences(
  db: admin.firestore.Firestore,
  userId: string,
): Promise<NormalizedNotificationPreferences> {
  const docSnap = await db.collection('userNotificationPreferences').doc(userId).get();

  if (!docSnap.exists) {
    return normalizeStoredPreferences(null);
  }

  return normalizeStoredPreferences(docSnap.data() as NotificationPreferencesPayload);
}

function getSkipResponse(reason: string) {
  return {
    success: false,
    sent: 0,
    failed: 0,
    failures: [] as PushFailure[],
    skipped: true,
    skippedCount: 1,
    reason,
  };
}

export const sendPushNotification = onCall(
  {
    region: 'southamerica-east1',
    secrets: [ONESIGNAL_REST_API_KEY],
  },
  async (request) => {
    try {
      if (!request.auth) {
        throw new HttpsError(
          'unauthenticated',
          'Usuário não autenticado.'
        );
      }

      const payload = (request.data ?? {}) as RawPayload;

      const rawExtraData =
        payload.data && typeof payload.data === 'object'
          ? payload.data
          : {};

      const userId = getString(payload.userId);

      const title =
        getString(payload.title) ??
        getString(payload.notification?.title) ??
        getString(rawExtraData.title);

      const body =
        getString(payload.body) ??
        getString(payload.notification?.body) ??
        getString(rawExtraData.body);

      if (!userId) {
        throw new HttpsError('invalid-argument', 'userId é obrigatório.');
      }

      if (!title || !body) {
        throw new HttpsError('invalid-argument', 'title e body são obrigatórios.');
      }

      const stringData = toStringMap(rawExtraData);

      const response = await fetch('https://api.onesignal.com/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${ONESIGNAL_REST_API_KEY.value()}`,
        },
        body: JSON.stringify({
          app_id: '7e1def32-df38-4f70-868f-1a46f4f6ba94',
          include_aliases: {
            external_id: [userId],
          },
          target_channel: 'push',
          headings: {
            pt: title,
            en: title,
          },
          contents: {
            pt: body,
            en: body,
          },
          data: stringData,
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        console.error('OneSignal error:', json);
        throw new HttpsError('internal', 'Falha ao enviar push.');
      }

      return {
        success: true,
        sent: 1,
        failed: 0,
        failures: [],
        skipped: false,
        skippedCount: 0,
        reason: null,
        provider: 'onesignal',
      };
    } catch (error) {
      console.error('❌ ERRO FINAL sendPushNotification:', error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError('internal', 'Falha ao enviar push.');
    }
  }
);