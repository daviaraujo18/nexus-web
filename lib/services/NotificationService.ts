import { getToken, deleteToken } from 'firebase/messaging';
import { httpsCallable } from 'firebase/functions';
import { functions, getMessagingInstance } from '@/firebase/config';

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

type PushResponse = {
  success: boolean;
  sent: number;
  failed: number;
  failures?: PushFailure[];
};

export class NotificationService {
  static async requestNotificationPermission(): Promise<NotificationPermission> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }

    return Notification.requestPermission();
  }

  static async getCurrentFCMToken(): Promise<string | null> {
    try {
      const messaging = await getMessagingInstance();

      if (!messaging) {
        console.warn('⚠️ Firebase Messaging não disponível');
        return null;
      }

      if (!('serviceWorker' in navigator)) {
        console.warn('⚠️ Service Worker não suportado');
        return null;
      }

      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      if (!vapidKey) {
        console.error('❌ NEXT_PUBLIC_FIREBASE_VAPID_KEY não configurada');
        return null;
      }

      const registration = await navigator.serviceWorker.ready;

      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: registration,
      });

      return token ?? null;
    } catch (error) {
      console.error('❌ Erro ao obter token FCM atual:', error);
      return null;
    }
  }

  static getDeviceFingerprint(): string {
    if (typeof window === 'undefined') return 'server';

    return [
      navigator.userAgent ?? 'unknown-ua',
      navigator.language ?? 'unknown-lang',
      navigator.platform ?? 'unknown-platform',
    ].join(' | ');
  }

  static async requestFCMToken(userId: string): Promise<string | null> {
    try {
      if (!userId) {
        console.warn('⚠️ userId não informado para requestFCMToken');
        return null;
      }

      const token = await this.getCurrentFCMToken();

      if (!token) {
        console.warn('⚠️ Token FCM não gerado');
        return null;
      }

      console.log('🔥 TOKEN FCM:', token);

      const saveToken = httpsCallable(functions, 'saveUserFCMToken');
      const saveResult: any = await saveToken({
        token,
        deviceInfo: {
          fingerprint: this.getDeviceFingerprint(),
          userAgent: navigator.userAgent,
          language: navigator.language,
          platform: navigator.platform,
        },
      });

      console.log('✅ Token salvo no backend:', saveResult?.data);
      return token;
    } catch (error) {
      console.error('❌ Erro ao gerar/salvar token FCM:', error);
      return null;
    }
  }

  static async removeCurrentFCMToken(): Promise<boolean> {
    try {
      const messaging = await getMessagingInstance();

      if (!messaging) {
        console.warn('⚠️ Messaging indisponível para remover token');
        return false;
      }

      const currentToken = await this.getCurrentFCMToken();

      if (currentToken) {
        try {
          const removeTokenFn = httpsCallable(functions, 'removeUserFCMToken');
          await removeTokenFn({ token: currentToken });
        } catch (backendError) {
          console.warn('⚠️ Falha ao desativar token no backend:', backendError);
        }
      }

      const removed = await deleteToken(messaging);
      console.log('🗑️ deleteToken result:', removed);
      return true;
    } catch (error) {
      console.error('❌ Erro ao remover token local:', error);
      return false;
    }
  }

  static async resetFCMToken(userId: string): Promise<string | null> {
    try {
      console.log('🔄 Resetando token FCM...');
      await this.removeCurrentFCMToken();
      await new Promise((resolve) => setTimeout(resolve, 800));
      return await this.requestFCMToken(userId);
    } catch (error) {
      console.error('❌ Erro ao resetar token FCM:', error);
      return null;
    }
  }

  static async sendFCMPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>
  ): Promise<PushResponse> {
    try {
      if (!userId) {
        return {
          success: false,
          sent: 0,
          failed: 1,
          failures: [
            {
              errorCode: 'client/missing-user-id',
              errorMessage: 'userId não informado',
            },
          ],
        };
      }

      const fn = httpsCallable(functions, 'sendPushNotification');

      const result: any = await fn({
        userId,
        title,
        body,
        data: data ?? {},
      });

      console.log('📤 Push response:', result?.data);

      return {
        success: result?.data?.success === true,
        sent: result?.data?.sent ?? 0,
        failed: result?.data?.failed ?? 0,
        failures: result?.data?.failures ?? [],
      };
    } catch (error: any) {
      console.error('❌ Erro ao enviar push:', error);

      return {
        success: false,
        sent: 0,
        failed: 1,
        failures: [
          {
            errorCode: error?.code ?? 'client/unknown',
            errorMessage: error?.message ?? 'Erro desconhecido ao enviar push',
          },
        ],
      };
    }
  }

  static async checkFCMAvailability(): Promise<FCMStatus> {
    try {
      const messaging = await getMessagingInstance();

      if (!messaging) {
        return { available: false, tokenExists: false };
      }

      const token = await this.getCurrentFCMToken();

      return {
        available: true,
        tokenExists: !!token,
      };
    } catch (error) {
      console.warn('⚠️ Erro ao verificar FCM:', error);
      return { available: false, tokenExists: false };
    }
  }

  static async checkNotificationSupport(): Promise<NotificationSupportStatus> {
    return {
      supported: typeof window !== 'undefined' && 'Notification' in window,
      permission:
        typeof window !== 'undefined' && 'Notification' in window
          ? Notification.permission
          : 'denied',
      serviceWorker:
        typeof window !== 'undefined' && 'serviceWorker' in navigator,
    };
  }
}