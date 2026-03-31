import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

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
        typeof data.allowedHours?.start === 'string' && data.allowedHours.start.trim().length > 0
          ? data.allowedHours.start
          : '08:00',
      end:
        typeof data.allowedHours?.end === 'string' && data.allowedHours.end.trim().length > 0
          ? data.allowedHours.end
          : '20:00',
    },
    allowedDays: Array.isArray(data.allowedDays)
      ? data.allowedDays.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6)
      : [1, 2, 3, 4, 5],
    types: {
      activity_reminder:
        typeof data.types?.activity_reminder === 'boolean'
          ? data.types.activity_reminder
          : true,
      therapeutic_reminder:
        typeof data.types?.therapeutic_reminder === 'boolean'
          ? data.types.therapeutic_reminder
          : true,
      educational_reminder:
        typeof data.types?.educational_reminder === 'boolean'
          ? data.types.educational_reminder
          : true,
      achievement:
        typeof data.types?.achievement === 'boolean' ? data.types.achievement : true,
      schedule_update:
        typeof data.types?.schedule_update === 'boolean'
          ? data.types.schedule_update
          : true,
      message: typeof data.types?.message === 'boolean' ? data.types.message : true,
    },
    therapeuticSettings: {
      avoidEveningNotifications:
        typeof data.therapeuticSettings?.avoidEveningNotifications === 'boolean'
          ? data.therapeuticSettings.avoidEveningNotifications
          : false,
      weekendReducedFrequency:
        typeof data.therapeuticSettings?.weekendReducedFrequency === 'boolean'
          ? data.therapeuticSettings.weekendReducedFrequency
          : false,
      maxDailyNotifications:
        typeof data.therapeuticSettings?.maxDailyNotifications === 'number' &&
        Number.isFinite(data.therapeuticSettings.maxDailyNotifications)
          ? data.therapeuticSettings.maxDailyNotifications
          : 4,
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

      const requestedUserId =
        typeof data?.userId === 'string' && data.userId.trim().length > 0
          ? data.userId.trim()
          : null;

      const authUserId = context.auth.uid;

      if (!requestedUserId) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'userId é obrigatório.',
        );
      }

      if (requestedUserId !== authUserId) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Você não pode consultar preferências de outro usuário.',
        );
      }

      const db = admin.firestore();
      const docRef = db.collection('userNotificationPreferences').doc(authUserId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        return {
          preferences: null,
        };
      }

      const normalized = normalizePreferences(
        docSnap.data() as StoredNotificationPreferences,
      );

      return {
        preferences: normalized,
      };
    } catch (error) {
      console.error('❌ ERRO getUserNotificationPreferences:', error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        'internal',
        'Erro ao buscar preferências de notificação.',
      );
    }
  });