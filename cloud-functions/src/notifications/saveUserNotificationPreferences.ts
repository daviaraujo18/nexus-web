import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

if (!admin.apps.length) {
  admin.initializeApp();
}

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

function asNonEmptyString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asAllowedDays(value: unknown): number[] {
  if (!Array.isArray(value)) return [1, 2, 3, 4, 5];

  const unique = new Set<number>();

  for (const item of value) {
    if (Number.isInteger(item) && item >= 0 && item <= 6) {
      unique.add(item);
    }
  }

  return unique.size > 0 ? Array.from(unique) : [1, 2, 3, 4, 5];
}

function asMaxDailyNotifications(value: unknown): number {
  if (typeof value !== 'number') return 4;
  return Math.min(Math.max(Math.round(value), 1), 20);
}

function normalizePreferences(
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

export const saveUserNotificationPreferences = functions
  .region('southamerica-east1')
  .https.onCall(async (data) => {
    try {
      const userId =
        typeof data?.userId === 'string'
          ? data.userId
          : null;

      const rawPreferences =
        data?.preferences && typeof data.preferences === 'object'
          ? data.preferences
          : null;

      if (!userId) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'userId obrigatório',
        );
      }

      if (!rawPreferences) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'preferences obrigatório',
        );
      }

      const normalized = normalizePreferences(rawPreferences);
      const now = admin.firestore.Timestamp.now();

      const db = admin.firestore();
      const ref = db.collection('userNotificationPreferences').doc(userId);

      await ref.set(
        {
          userId,
          ...normalized,
          updatedAt: now,
        },
        { merge: true },
      );

      return { success: true };
    } catch (error) {
      console.error('❌ ERRO saveUserNotificationPreferences:', error);

      throw new functions.https.HttpsError(
        'internal',
        'Erro ao salvar preferências.',
      );
    }
  });