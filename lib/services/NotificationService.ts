import { httpsCallable } from 'firebase/functions';
import { functions } from '@/firebase/config';
import { ProviderManager } from '@/lib/services/providers/ProviderManager';

type MessagePayload = any;

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

    return hasNotification && hasServiceWorker;
  }

  static async getSupportStatus(): Promise<NotificationSupportStatus> {
    const supported = await this.isSupported();

    return {
      supported,
      permission: supported ? Notification.permission : 'denied',
      serviceWorker: isBrowser && 'serviceWorker' in navigator,
    };
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
    debugLog('getFCMToken is deprecated after removing FCM.');
    return null;
  }

  static async saveFCMToken(token: string): Promise<boolean> {
    debugLog('saveFCMToken is deprecated after removing FCM.');
    return false;
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

    return {
      success: permission === 'granted',
      permission,
      token: null,
    };
  }

  static async removeFCMToken(): Promise<boolean> {
    debugLog('removeFCMToken is deprecated after removing FCM.');
    return false;
  }

  static async resetFCMToken(_userId?: string): Promise<string | null> {
    await this.removeFCMToken();

    const result = await this.enableNotifications();
    return result.token;
  }

  static async getFCMStatus(): Promise<FCMStatus> {
    const supportStatus = await this.getSupportStatus();

    return {
      available: supportStatus.supported,
      tokenExists: false,
    };
  }

  static async setupForegroundMessageListener(
    onNotification: (notification: NormalizedNotification, rawPayload: MessagePayload) => void,
  ): Promise<(() => void) | null> {
    if (!isBrowser) return null;

    try {
      await this.initializeProvider();

      const unsubscribe = await this.provider.setupForegroundMessage((notification) => {
        debugLog('Mensagem recebida via provider:', notification);
        onNotification(notification, null as MessagePayload);
      });

      return unsubscribe;
    } catch (error) {
      errorLog('Provider foreground failed:', error);
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
    await this.initializeProvider();
    const providerStatus = await this.provider.getStatus();

    return {
      enabled: supportStatus.permission === 'granted' && providerStatus.subscriptionExists,
      permission: supportStatus.permission,
      supported: supportStatus.supported,
      tokenExists: providerStatus.subscriptionExists,
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