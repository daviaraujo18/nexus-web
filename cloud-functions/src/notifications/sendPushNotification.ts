import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

if (!admin.apps.length) {
  admin.initializeApp();
}

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
  types?: Partial<Record<NotificationType, boolean>>;
  therapeuticSettings?: {
    avoidEveningNotifications?: boolean;
    weekendReducedFrequency?: boolean;
    maxDailyNotifications?: number;
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

function getNotificationType(value: unknown): NormalizedNotificationType {
  const rawType = getString(value);

  if (!rawType) {
    return 'generic_notification';
  }

  return (ALLOWED_NOTIFICATION_TYPES as readonly string[]).includes(rawType)
    ? (rawType as NotificationType)
    : 'generic_notification';
}

function isWithinAllowedDays(days?: number[]): boolean {
  if (!Array.isArray(days) || days.length === 0) {
    return true;
  }

  const today = new Date().getDay();
  return days.includes(today);
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

function isWithinAllowedHours(
  allowedHours?: { start?: string; end?: string },
): boolean {
  const startMinutes = parseHourToMinutes(allowedHours?.start);
  const endMinutes = parseHourToMinutes(allowedHours?.end);

  if (startMinutes === null || endMinutes === null) {
    return true;
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  // janela atravessando meia-noite
  return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
}

function isTypeEnabled(
  preferences: StoredNotificationPreferences | null,
  notificationType: NormalizedNotificationType,
): boolean {
  if (notificationType === 'generic_notification') {
    return true;
  }

  return preferences?.types?.[notificationType] ?? true;
}

async function getUserPreferences(
  db: admin.firestore.Firestore,
  userId: string,
): Promise<StoredNotificationPreferences | null> {
  const docSnap = await db.collection('userNotificationPreferences').doc(userId).get();

  if (!docSnap.exists) {
    return null;
  }

  return docSnap.data() as StoredNotificationPreferences;
}

function getSkipResponse(reason: string) {
  return {
    success: false,
    sent: 0,
    failed: 0,
    failures: [] as PushFailure[],
    skipped: true,
    reason,
  };
}

export const sendPushNotification = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    try {
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Usuário não autenticado.',
        );
      }

      const payload = (data ?? {}) as RawPayload;

      const userId = getString(payload.userId);
      const title =
        getString(payload.title) ??
        getString(payload.notification?.title);

      const body =
        getString(payload.body) ??
        getString(payload.notification?.body);

      const rawExtraData =
        payload.data && typeof payload.data === 'object'
          ? payload.data
          : {};

      if (!userId) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'userId é obrigatório.',
        );
      }

      if (!title || !body) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'title e body são obrigatórios.',
        );
      }

      const db = admin.firestore();

      const notificationType = getNotificationType(rawExtraData.type);
      const preferences = await getUserPreferences(db, userId);

      if (preferences?.enabled === false) {
        return getSkipResponse('notifications-disabled');
      }

      if (preferences?.channels?.push === false) {
        return getSkipResponse('push-channel-disabled');
      }

      if (!isTypeEnabled(preferences, notificationType)) {
        return getSkipResponse('notification-type-disabled');
      }

      if (!isWithinAllowedDays(preferences?.allowedDays)) {
        return getSkipResponse('outside-allowed-days');
      }

      if (!isWithinAllowedHours(preferences?.allowedHours)) {
        return getSkipResponse('outside-allowed-hours');
      }

      const tokensSnap = await db
        .collection('userFCMTokens')
        .where('userId', '==', userId)
        .where('active', '==', true)
        .get();

      if (tokensSnap.empty) {
        throw new functions.https.HttpsError(
          'not-found',
          'Nenhum token FCM ativo encontrado para o usuário.',
        );
      }

      const rawTokenDocs: TokenDoc[] = tokensSnap.docs
        .map((docSnap) => {
          const docData = docSnap.data();
          const token = docData?.token;
          const updatedAt = docData?.updatedAt;
          const createdAt = docData?.createdAt;

          const updatedAtMillis =
            updatedAt && typeof updatedAt.toMillis === 'function'
              ? updatedAt.toMillis()
              : createdAt && typeof createdAt.toMillis === 'function'
                ? createdAt.toMillis()
                : 0;

          return {
            docId: docSnap.id,
            token,
            updatedAtMillis,
          };
        })
        .filter(
          (item): item is TokenDoc =>
            typeof item.token === 'string' && item.token.length > 0,
        );

      if (rawTokenDocs.length === 0) {
        throw new functions.https.HttpsError(
          'not-found',
          'Nenhum token FCM válido encontrado.',
        );
      }

      rawTokenDocs.sort((a, b) => b.updatedAtMillis - a.updatedAtMillis);

      const uniqueTokenDocs: TokenDoc[] = [];
      const duplicateDocIdsToDisable: string[] = [];
      const seenTokens = new Set<string>();

      for (const item of rawTokenDocs) {
        if (seenTokens.has(item.token)) {
          duplicateDocIdsToDisable.push(item.docId);
          continue;
        }

        seenTokens.add(item.token);
        uniqueTokenDocs.push(item);
      }

      if (duplicateDocIdsToDisable.length > 0) {
        await Promise.all(
          duplicateDocIdsToDisable.map((docId) =>
            db.collection('userFCMTokens').doc(docId).update({
              active: false,
              invalidatedAt: admin.firestore.Timestamp.now(),
              lastErrorCode: 'duplicate-token-doc',
              lastErrorMessage:
                'Documento duplicado do mesmo token foi desativado.',
            }),
          ),
        );
      }

      const tokens = uniqueTokenDocs.map((item) => item.token);

      const route =
        getString(rawExtraData.route) ??
        getString(rawExtraData.url) ??
        getString(rawExtraData.clickAction) ??
        '/student/notifications';

      const normalizedExtraData: Record<string, unknown> = {
        ...rawExtraData,
        route,
        url: getString(rawExtraData.url) ?? route,
        clickAction: getString(rawExtraData.clickAction) ?? route,
        type: notificationType,
        tag: getString(rawExtraData.tag) ?? 'nexus-notification',
        icon: getString(rawExtraData.icon) ?? '/icons/icon-192x192.png',
        badge: getString(rawExtraData.badge) ?? '/icons/badge-72x72.png',
        sentAt: getString(rawExtraData.sentAt) ?? new Date().toISOString(),
      };

      const stringData = toStringMap(normalizedExtraData);

      const message: admin.messaging.MulticastMessage = {
        tokens,
        notification: {
          title,
          body,
        },
        data: stringData,
        webpush: {
          notification: {
            title,
            body,
            icon: stringData.icon,
            badge: stringData.badge,
            tag: stringData.tag,
            data: {
              url: stringData.url,
              clickAction: stringData.clickAction,
              route: stringData.route,
              type: stringData.type,
              entityId: stringData.entityId ?? '',
              tag: stringData.tag,
              sentAt: stringData.sentAt,
            },
          },
          fcmOptions: {
            link: route,
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      const failures: PushFailure[] = response.responses
        .map((result, index) => ({
          success: result.success,
          errorCode: result.error?.code ?? null,
          errorMessage: result.error?.message ?? null,
          token: tokens[index] ?? null,
          docId: uniqueTokenDocs[index]?.docId ?? null,
        }))
        .filter((item) => !item.success);

      for (const failure of failures) {
        if (
          failure.docId &&
          (
            failure.errorCode === 'messaging/registration-token-not-registered' ||
            failure.errorCode === 'messaging/invalid-registration-token'
          )
        ) {
          await db.collection('userFCMTokens').doc(failure.docId).update({
            active: false,
            invalidatedAt: admin.firestore.Timestamp.now(),
            lastErrorCode: failure.errorCode,
            lastErrorMessage: failure.errorMessage,
          });
        }
      }

      return {
        success: response.failureCount === 0,
        sent: response.successCount,
        failed: response.failureCount,
        failures,
        skipped: false,
        reason: null,
      };
    } catch (error) {
      console.error('❌ ERRO FINAL sendPushNotification:', error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        'internal',
        'Falha ao enviar push.',
      );
    }
  });