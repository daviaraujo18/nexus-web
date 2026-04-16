import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

if (!admin.apps.length) {
  admin.initializeApp();
}

type StoredNotificationPreferences = {
  enabled?: boolean;
  channels?: {
    push?: boolean;
    in_app?: boolean;
    email?: boolean;
  };
  allowedHours?: {
    start?: string;
    end?: string;
  };
  allowedDays?: number[];
  types?: {
    activity_reminder?: boolean;
    therapeutic_reminder?: boolean;
    educational_reminder?: boolean;
    achievement?: boolean;
    schedule_update?: boolean;
    message?: boolean;
  };
  therapeuticSettings?: {
    avoidEveningNotifications?: boolean;
    weekendReducedFrequency?: boolean;
    maxDailyNotifications?: number;
  };
};

function normalizePreferences(
  raw: StoredNotificationPreferences | undefined | null,
): StoredNotificationPreferences {
  const data = raw ?? {};

  return {
    enabled: typeof data.enabled === 'boolean' ? data.enabled : true,
    channels: {
      push: typeof data.channels?.push === 'boolean' ? data.channels.push : false,
      in_app: typeof data.channels?.in_app === 'boolean' ? data.channels.in_app : true,
      email: typeof data.channels?.email === 'boolean' ? data.channels.email : false,
    },
    allowedHours: {
      start:
        typeof data.allowedHours?.start === 'string'
          ? data.allowedHours.start
          : '08:00',
      end:
        typeof data.allowedHours?.end === 'string'
          ? data.allowedHours.end
          : '20:00',
    },
    allowedDays: Array.isArray(data.allowedDays)
      ? data.allowedDays
      : [1, 2, 3, 4, 5],
    types: {
      activity_reminder: data.types?.activity_reminder ?? true,
      therapeutic_reminder: data.types?.therapeutic_reminder ?? true,
      educational_reminder: data.types?.educational_reminder ?? true,
      achievement: data.types?.achievement ?? true,
      schedule_update: data.types?.schedule_update ?? true,
      message: data.types?.message ?? true,
    },
    therapeuticSettings: {
      avoidEveningNotifications:
        data.therapeuticSettings?.avoidEveningNotifications ?? false,
      weekendReducedFrequency:
        data.therapeuticSettings?.weekendReducedFrequency ?? false,
      maxDailyNotifications:
        data.therapeuticSettings?.maxDailyNotifications ?? 4,
    },
  };
}

export const getUserNotificationPreferences = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    try {
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Usuário não autenticado.',
        );
      }

      const userId =
        typeof data?.userId === 'string'
          ? data.userId.trim()
          : '';

      if (!userId) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'userId é obrigatório.',
        );
      }

      const db = admin.firestore();
      const doc = await db
        .collection('userNotificationPreferences')
        .doc(userId)
        .get();

      if (!doc.exists) {
        return null;
      }

      const normalized = normalizePreferences(
        doc.data() as StoredNotificationPreferences,
      );

      return normalized;
      
    } catch (error) {
      console.error('❌ ERRO getUserNotificationPreferences:', error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        'internal',
        'Erro ao buscar preferências.',
      );
    }
  });