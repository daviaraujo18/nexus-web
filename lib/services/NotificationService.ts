import { getToken, deleteToken, onMessage, type MessagePayload } from 'firebase/messaging';
import { httpsCallable } from 'firebase/functions';
import { functions, getMessagingInstance } from '@/firebase/config';
import { ProviderManager } from '@/lib/services/providers/ProviderManager';

type FCMStatus = {
  available: boolean;
  tokenExists: boolean;
};

type NotificationSupportStatus = {
  supported: boolean;
  permission: NotificationPermission;
  serviceWorker: boolean;
};

type PushFailure = {
  success?: boolean;
  errorCode?: string | null;
  errorMessage?: string | null;
  token?: string | null;
  docId?: string | null;
};

export type PushResponse = {
  success: boolean;
  sent: number;
  failed: number;
  failures?: PushFailure[];
  skipped?: boolean;
  skippedCount?: number;
  reason?: string | null;
};

export type UserNotificationPreferences = {
  enabled: boolean;
  permission: NotificationPermission;
  supported: boolean;
  tokenExists: boolean;
};

export type FullUserNotificationPreferences = {
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
  therapeuticSettings?: {
    avoidEveningNotifications: boolean;
    weekendReducedFrequency: boolean;
    maxDailyNotifications: number;
  };
};

export type NormalizedNotification = {
  title: string;
  body: string;
  url: string;
  type: string | null;
  entityId: string | null;
  tag: string;
  icon?: string;
  badge?: string;
};

type SendPushPayload = {
  userId: string;
  notification: {
    title: string;
    body: string;
  };
  data?: Record<string, unknown>;
};

type TypedNotificationInput = {
  userId: string;
  title: string;
  body: string;
  type: string;
  route?: string;
  url?: string;
  clickAction?: string;
  tag?: string;
  entityId?: string;
};

type GetUserNotificationPreferencesResponse =
  | Partial<FullUserNotificationPreferences>
  | null;

type SaveUserNotificationPreferencesPayload = {
  userId: string;
  preferences: FullUserNotificationPreferences;
};

type GetUserNotificationPreferencesPayload = {
  userId: string;
};

const isBrowser = typeof window !== 'undefined';
const isDev = process.env.NODE_ENV !== 'production';

function debugLog(...args: unknown[]) {
  if (isDev) {
    console.log('[NotificationService]', ...args);
  }
}

function errorLog(...args: unknown[]) {
  console.error('[NotificationService]', ...args);
}

function normalizeForegroundPayload(payload: MessagePayload): NormalizedNotification {
  const notification = payload.notification || {};
  const data = payload.data || {};

  return {
    title: notification.title || data.title || 'Nova notificação',
    body: notification.body || data.body || 'Você recebeu uma nova atualização.',
    url: data.clickAction || data.url || data.route || '/student/notifications',
    type: data.type || null,
    entityId: data.entityId || null,
    tag: data.tag || data.type || 'nexus-notification',
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/badge-72x72.png',
  };
}

function getDefaultFullPreferences(
  devicePrefs?: Partial<UserNotificationPreferences>,
): FullUserNotificationPreferences {
  const pushEnabled =
    !!devicePrefs?.supported &&
    devicePrefs?.permission === 'granted' &&
    !!devicePrefs?.tokenExists;

  return {
    enabled: !!devicePrefs?.enabled,
    channels: {
      push: pushEnabled,
      in_app: true,
      email: false,
    },
    allowedHours: {
      start: '08:00',
      end: '20:00',
    },
    allowedDays: [1, 2, 3, 4, 5],
    types: {
      activity_reminder: true,
      therapeutic_reminder: true,
      educational_reminder: true,
      achievement: true,
      schedule_update: true,
      message: true,
    },
    therapeuticSettings: {
      avoidEveningNotifications: false,
      weekendReducedFrequency: false,
      maxDailyNotifications: 4,
    },
  };
}

function normalizePreferences(
  preferences: Partial<FullUserNotificationPreferences> | null | undefined,
  devicePrefs?: Partial<UserNotificationPreferences>,
): FullUserNotificationPreferences {
  const defaults = getDefaultFullPreferences(devicePrefs);

  return {
    enabled: preferences?.enabled ?? defaults.enabled,
    channels: {
      push: preferences?.channels?.push ?? defaults.channels.push,
      in_app: preferences?.channels?.in_app ?? defaults.channels.in_app,
      email: preferences?.channels?.email ?? defaults.channels.email,
    },
    allowedHours: {
      start: preferences?.allowedHours?.start ?? defaults.allowedHours.start,
      end: preferences?.allowedHours?.end ?? defaults.allowedHours.end,
    },
    allowedDays: Array.isArray(preferences?.allowedDays)
      ? preferences.allowedDays.filter(
          (day): day is number => Number.isInteger(day) && day >= 0 && day <= 6,
        )
      : defaults.allowedDays,
    types: {
      activity_reminder:
        preferences?.types?.activity_reminder ?? defaults.types.activity_reminder,
      therapeutic_reminder:
        preferences?.types?.therapeutic_reminder ?? defaults.types.therapeutic_reminder,
      educational_reminder:
        preferences?.types?.educational_reminder ?? defaults.types.educational_reminder,
      achievement: preferences?.types?.achievement ?? defaults.types.achievement,
      schedule_update: preferences?.types?.schedule_update ?? defaults.types.schedule_update,
      message: preferences?.types?.message ?? defaults.types.message,
    },
    therapeuticSettings: {
      avoidEveningNotifications:
        preferences?.therapeuticSettings?.avoidEveningNotifications ??
        defaults.therapeuticSettings!.avoidEveningNotifications,
      weekendReducedFrequency:
        preferences?.therapeuticSettings?.weekendReducedFrequency ??
        defaults.therapeuticSettings!.weekendReducedFrequency,
      maxDailyNotifications:
        preferences?.therapeuticSettings?.maxDailyNotifications ??
        defaults.therapeuticSettings!.maxDailyNotifications,
    },
  };
}

export class NotificationService {
  private static provider = ProviderManager.fromConfig();
  private static serviceWorkerRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null =
    null;
  static async initializeProvider(): Promise<void> {
    try {
      await this.provider.initialize();
    } catch (error) {
      errorLog('Provider initialization failed:', error);
    }
  }

  static async registerUser(userId: string): Promise<boolean> {
    try {
      await this.initializeProvider();
      return await this.provider.registerUser(userId);
    } catch (error) {
      errorLog('Provider registerUser failed:', error);
      return false;
    }
  }
  static async isSupported(): Promise<boolean> {
    if (!isBrowser) return false;

    const hasNotification = 'Notification' in window;
    const hasServiceWorker = 'serviceWorker' in navigator;

    if (!hasNotification || !hasServiceWorker) {
      return false;
    }

    try {
      const messaging = await getMessagingInstance();
      return Boolean(messaging);
    } catch (error) {
      errorLog('Erro ao verificar suporte do Messaging:', error);
      return false;
    }
  }

  static async getSupportStatus(): Promise<NotificationSupportStatus> {
    const supported = await this.isSupported();

    return {
      supported,
      permission: supported ? Notification.permission : 'denied',
      serviceWorker: isBrowser && 'serviceWorker' in navigator,
    };
  }

  static async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!isBrowser || !('serviceWorker' in navigator)) {
      return null;
    }

    if (!this.serviceWorkerRegistrationPromise) {
      this.serviceWorkerRegistrationPromise = navigator.serviceWorker
        .register('/firebase-messaging-sw.js')
        .then((registration) => {
          debugLog('Service Worker registrado:', registration.scope);
          return registration;
        })
        .catch((error) => {
          errorLog('Erro ao registrar Service Worker:', error);
          this.serviceWorkerRegistrationPromise = null;
          return null;
        });
    }

    return this.serviceWorkerRegistrationPromise;
  }

  static async requestNotificationPermission(): Promise<NotificationPermission> {
    const supported = await this.isSupported();

    if (!supported) {
      return 'denied';
    }

    try {
      await this.initializeProvider();

      // try provider first
      const permission = await this.provider.requestPermission();

      if (permission) {
        return permission;
      }
    } catch (error) {
      errorLog('Provider permission failed, fallback to browser:', error);
    }

    // fallback browser
    try {
      const permission = await Notification.requestPermission();
      debugLog('Permissão de notificação:', permission);
      return permission;
    } catch (error) {
      errorLog('Erro ao solicitar permissão:', error);
      return 'denied';
    }
  }

  static async getFCMToken(): Promise<string | null> {
    const supported = await this.isSupported();
    if (!supported) return null;

    if (Notification.permission !== 'granted') {
      debugLog('Permissão não concedida para obter token.');
      return null;
    }

    try {
      const registration = await this.registerServiceWorker();
      if (!registration) {
        errorLog('Service Worker não disponível para obter token.');
        return null;
      }

      const messaging = await getMessagingInstance();
      if (!messaging) {
        errorLog('Firebase Messaging não disponível.');
        return null;
      }

      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      if (!vapidKey) {
        errorLog('NEXT_PUBLIC_FIREBASE_VAPID_KEY não configurada.');
        return null;
      }

      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: registration,
      });

      if (!token) {
        debugLog('Nenhum token FCM retornado.');
        return null;
      }

      debugLog('Token FCM obtido com sucesso.');
      return token;
    } catch (error) {
      errorLog('Erro ao obter token FCM:', error);
      return null;
    }
  }

  static async saveFCMToken(token: string): Promise<boolean> {
    try {
      const saveUserFCMToken = httpsCallable(functions, 'saveUserFCMToken');
      await saveUserFCMToken({ token });
      debugLog('Token FCM salvo com sucesso.');
      return true;
    } catch (error) {
      errorLog('Erro ao salvar token FCM:', error);
      return false;
    }
  }

  static async enableNotifications(): Promise<{
    success: boolean;
    permission: NotificationPermission;
    token: string | null;
  }> {
    const permission = await this.requestNotificationPermission();

    if (permission !== 'granted') {
      return {
        success: false,
        permission,
        token: null,
      };
    }

    const token = await this.getFCMToken();

    if (!token) {
      return {
        success: false,
        permission,
        token: null,
      };
    }

    const saved = await this.saveFCMToken(token);

    return {
      success: saved,
      permission,
      token: saved ? token : null,
    };
  }

  static async removeFCMToken(): Promise<boolean> {
    try {
      const messaging = await getMessagingInstance();
      if (!messaging) {
        return false;
      }

      const deleted = await deleteToken(messaging);
      debugLog('Token removido do cliente:', deleted);
      return deleted;
    } catch (error) {
      errorLog('Erro ao remover token:', error);
      return false;
    }
  }

  static async resetFCMToken(_userId?: string): Promise<string | null> {
    await this.removeFCMToken();

    const result = await this.enableNotifications();
    return result.success ? result.token : null;
  }

  static async getFCMStatus(): Promise<FCMStatus> {
    const supportStatus = await this.getSupportStatus();
    const token = await this.getFCMToken();

    return {
      available: supportStatus.supported,
      tokenExists: !!token,
    };
  }

  static async setupForegroundMessageListener(
    onNotification: (notification: NormalizedNotification, rawPayload: MessagePayload) => void,
  ): Promise<(() => void) | null> {
    if (!isBrowser) return null;

    try {
      // initialize provider
      await this.initializeProvider();

      // try provider first
      const unsubscribe = await this.provider.setupForegroundMessage(
        (notification) => {
          debugLog('Mensagem recebida via provider:', notification);
          onNotification(notification, null as unknown as MessagePayload);
        },
      );

      return unsubscribe;
    } catch (error) {
      errorLog('Provider foreground failed, fallback to FCM:', error);
    }

    // fallback FCM
    try {
      const messaging = await getMessagingInstance();

      if (!messaging) {
        errorLog('Messaging indisponível no foreground listener.');
        return null;
      }

      const unsubscribe = onMessage(messaging, (payload) => {
        debugLog('Mensagem recebida em foreground (fallback FCM):', payload);

        const normalized = normalizeForegroundPayload(payload);
        onNotification(normalized, payload);
      });

      return unsubscribe;
    } catch (error) {
      errorLog('Erro ao configurar foreground listener:', error);
      return null;
    }
  }

  static async setupForegroundNotifications(
    onNotification: (notification: NormalizedNotification, rawPayload: MessagePayload) => void,
  ): Promise<(() => void) | null> {
    return this.setupForegroundMessageListener(onNotification);
  }

  static async checkFCMAvailability(): Promise<FCMStatus> {
    return this.getFCMStatus();
  }

  static async getCurrentFCMToken(): Promise<string | null> {
    return this.getFCMToken();
  }

  static async getUserPreferences(_userId: string): Promise<UserNotificationPreferences> {
    const supportStatus = await this.getSupportStatus();
    const fcmStatus = await this.getFCMStatus();

    return {
      enabled: supportStatus.permission === 'granted' && fcmStatus.tokenExists,
      permission: supportStatus.permission,
      supported: supportStatus.supported,
      tokenExists: fcmStatus.tokenExists,
    };
  }

  static async loadPreferences(userId: string): Promise<FullUserNotificationPreferences> {
    if (!userId) {
      throw new Error('loadPreferences chamado sem userId');
    }

    try {
      const devicePrefs = await this.getUserPreferences(userId);

      const getUserNotificationPreferences = httpsCallable<
        GetUserNotificationPreferencesPayload,
        GetUserNotificationPreferencesResponse
      >(functions, 'getUserNotificationPreferences');

      const response = await getUserNotificationPreferences({ userId });
      const persisted = response.data ?? null;

      return normalizePreferences(persisted, devicePrefs);
    } catch (error) {
      errorLog('Erro ao carregar preferências do backend. Aplicando fallback local:', error);

      const devicePrefs = await this.getUserPreferences(userId);
      return getDefaultFullPreferences(devicePrefs);
    }
  }

  static async updatePreferences(
    userId: string,
    preferences: FullUserNotificationPreferences,
  ): Promise<void> {
    const normalized = normalizePreferences(preferences);

    const saveUserNotificationPreferences = httpsCallable<
      SaveUserNotificationPreferencesPayload,
      { success: boolean }
    >(functions, 'saveUserNotificationPreferences');

    await saveUserNotificationPreferences({
      userId,
      preferences: normalized,
    });

    debugLog('Preferências persistidas com sucesso.');
  }

  static async sendTypedNotification(input: TypedNotificationInput): Promise<PushResponse> {
    try {
      const sendPushNotification = httpsCallable<SendPushPayload, PushResponse>(
        functions,
        'sendPushNotification',
      );

      const payload: SendPushPayload = {
        userId: input.userId,
        notification: {
          title: input.title,
          body: input.body,
        },
        data: {
          type: input.type,
          route: input.route ?? '/student/notifications',
          url: input.url ?? input.route ?? '/student/notifications',
          clickAction: input.clickAction ?? input.route ?? '/student/notifications',
          tag: input.tag ?? `${input.type}-${Date.now()}`,
          entityId: input.entityId ?? '',
          sentAt: new Date().toISOString(),
        },
      };

      const response = await sendPushNotification(payload);
      return response.data;
    } catch (error) {
      errorLog('Erro ao enviar notificação tipada:', error);

      return {
        success: false,
        sent: 0,
        failed: 1,
        skipped: false,
        skippedCount: 0,
        reason: 'typed-send-failure',
      };
    }
  }
}