/**
 * FCM Provider Adapter
 * Wraps Firebase Cloud Messaging behind PushProvider interface
 * Extracts logic from existing NotificationService
 */

import { getToken, deleteToken, onMessage, type MessagePayload } from 'firebase/messaging';
import { httpsCallable } from 'firebase/functions';
import { functions, getMessagingInstance } from '@/firebase/config';
import type {
  PushProvider,
  ProviderStatus,
  NormalizedNotification,
  NotificationPermission,
} from './types';

const isBrowser = typeof window !== 'undefined';

function debugLog(...args: unknown[]) {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[FCMProvider]', ...args);
  }
}

function errorLog(...args: unknown[]) {
  console.error('[FCMProvider]', ...args);
}

/**
 * FCMProvider: Firebase Cloud Messaging implementation
 */
export class FCMProvider implements PushProvider {
  name = 'fcm' as const;
  private unsubscribe: (() => void) | null = null;
  private swRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

  async initialize(): Promise<void> {
    debugLog('Initializing FCM provider');
    try {
      const messaging = await getMessagingInstance();
      if (!messaging) {
        throw new Error('Firebase Messaging not available');
      }
      debugLog('FCM provider initialized successfully');
    } catch (error) {
      errorLog('Failed to initialize FCM provider:', error);
      throw error;
    }
  }

  async isSupported(): Promise<boolean> {
    if (!isBrowser) return false;

    const hasNotification = 'Notification' in window;
    const hasServiceWorker = 'serviceWorker' in navigator;

    if (!hasNotification || !hasServiceWorker) {
      return false;
    }

    try {
      const messaging = await getMessagingInstance();
      return Boolean(messaging);
    } catch {
      return false;
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!isBrowser) return 'denied';

    try {
      if (typeof Notification === 'undefined') {
        return 'denied';
      }

      const permission = await Notification.requestPermission();
      debugLog('Permission requested:', permission);
      return permission as NotificationPermission;
    } catch (error) {
      errorLog('Error requesting permission:', error);
      return 'denied';
    }
  }

  async getSubscriptionId(): Promise<string | null> {
    const supported = await this.isSupported();
    if (!supported) return null;

    if (!isBrowser || Notification.permission !== 'granted') {
      debugLog('Notification permission not granted');
      return null;
    }

    try {
      const registration = await this.registerServiceWorker();
      if (!registration) {
        errorLog('Service Worker not available');
        return null;
      }

      const messaging = await getMessagingInstance();
      if (!messaging) {
        errorLog('Firebase Messaging not available');
        return null;
      }

      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      if (!vapidKey) {
        errorLog('NEXT_PUBLIC_FIREBASE_VAPID_KEY not configured');
        return null;
      }

      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: registration,
      });

      if (!token) {
        debugLog('No FCM token returned');
        return null;
      }

      debugLog('FCM token obtained successfully');
      return token;
    } catch (error) {
      errorLog('Error getting FCM token:', error);
      return null;
    }
  }

  async registerUser(userId: string): Promise<boolean> {
    try {
      debugLog(`Registering user: ${userId}`);

      const token = await this.getSubscriptionId();
      if (!token) {
        errorLog('No FCM token available for registration');
        return false;
      }

      const saveUserFCMToken = httpsCallable(functions, 'saveUserFCMToken');
      await saveUserFCMToken({ token });

      debugLog(`User ${userId} registered successfully`);
      return true;
    } catch (error) {
      errorLog(`Error registering user ${userId}:`, error);
      return false;
    }
  }

  async unregisterUser(): Promise<boolean> {
    try {
      debugLog('Unregistering user');

      const messaging = await getMessagingInstance();
      if (!messaging) {
        errorLog('Firebase Messaging not available');
        return false;
      }

      const deleted = await deleteToken(messaging);
      debugLog('User unregistered successfully:', deleted);
      return deleted;
    } catch (error) {
      errorLog('Error unregistering user:', error);
      return false;
    }
  }

  onForegroundMessage(
    handler: (notification: NormalizedNotification) => void
  ): () => void {
    debugLog('Setting up foreground message listener');

    const setup = async () => {
      try {
        const messaging = await getMessagingInstance();
        if (!messaging) {
          errorLog('Firebase Messaging not available for foreground listener');
          return;
        }

        this.unsubscribe = onMessage(messaging, (payload) => {
          debugLog('Foreground message received:', payload);
          const normalized = this.normalizePayload(payload);
          handler(normalized);
        });
      } catch (error) {
        errorLog('Error setting up foreground listener:', error);
      }
    };

    void setup();

    return () => {
      if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }
    };
  }

  async getStatus(): Promise<ProviderStatus> {
    const supported = await this.isSupported();
    const subscriptionId = await this.getSubscriptionId();

    return {
      available: supported,
      enabled: isBrowser ? Notification.permission === 'granted' : false,
      subscriptionExists: !!subscriptionId,
      permission: isBrowser ? (Notification.permission as NotificationPermission) : 'denied',
    };
  }

  async cleanup(): Promise<void> {
    debugLog('Cleaning up FCM provider');
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  private async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!isBrowser || !('serviceWorker' in navigator)) {
      return null;
    }

    if (!this.swRegistrationPromise) {
      this.swRegistrationPromise = navigator.serviceWorker
        .register('/firebase-messaging-sw.js')
        .then((registration) => {
          debugLog('Service Worker registered:', registration.scope);
          return registration;
        })
        .catch((error) => {
          errorLog('Error registering Service Worker:', error);
          this.swRegistrationPromise = null;
          return null;
        });
    }

    return this.swRegistrationPromise;
  }

  private normalizePayload(raw: MessagePayload): NormalizedNotification {
    const notification = raw.notification || {};
    const data = raw.data || {};

    return {
      title: notification.title || data.title || 'Nova notificação',
      body: notification.body || data.body || 'Você recebeu uma nova atualização.',
      url: (data.clickAction || data.url || data.route || '/student/notifications') as string,
      type: (data.type as string) || null,
      entityId: (data.entityId as string) || null,
      tag: (data.tag || data.type || 'nexus-notification') as string,
      icon: (data.icon as string) || '/icons/icon-192x192.png',
      badge: (data.badge as string) || '/icons/badge-72x72.png',
    };
  }
}
