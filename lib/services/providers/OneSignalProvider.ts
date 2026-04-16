/**
 * OneSignal Provider Adapter
 * Wraps OneSignal SDK behind PushProvider interface
 */

import OneSignal from 'react-onesignal';
import { functions } from '@/firebase/config';
import type {
  PushProvider,
  ProviderStatus,
  NormalizedNotification,
  NotificationPermission,
} from './types';

const isBrowser = typeof window !== 'undefined';

function debugLog(...args: unknown[]) {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[OneSignalProvider]', ...args);
  }
}

function errorLog(...args: unknown[]) {
  console.error('[OneSignalProvider]', ...args);
}

/**
 * OneSignalProvider: OneSignal SDK implementation
 */
export class OneSignalProvider implements PushProvider {
  name = 'onesignal' as const;
  private messageUnsubscribe: (() => void) | null = null;
  private initialized = false;
  private initializingPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (!isBrowser) {
      errorLog('Not in browser environment');
      throw new Error('OneSignal requires browser environment');
    }

    if (this.initialized) {
      debugLog('OneSignal already initialized, skipping');
      return;
    }

    if (this.initializingPromise) {
      debugLog('OneSignal initialization already in progress, awaiting existing promise');
      return this.initializingPromise;
    }

    this.initializingPromise = (async () => {
      try {
        debugLog('Initializing OneSignal provider');

        const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
        if (!appId) {
          throw new Error('NEXT_PUBLIC_ONESIGNAL_APP_ID not configured');
        }

        await OneSignal.init({
          appId,
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerPath: '/OneSignalSDKWorker.js',
          serviceWorkerUpdaterPath: '/OneSignalSDKUpdaterWorker.js',
        });

        this.initialized = true;
        this.initializingPromise = null;
        debugLog('OneSignal provider initialized successfully');
      } catch (error) {
        this.initializingPromise = null;
        errorLog('Failed to initialize OneSignal provider:', error);
        throw error;
      }
    })();

    return this.initializingPromise;
  }

  async isSupported(): Promise<boolean> {
    if (!isBrowser) return false;

    try {
      // OneSignal supports most modern browsers with service workers
      return 'serviceWorker' in navigator;
    } catch {
      return false;
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!isBrowser) return 'denied';

    try {
      debugLog('Requesting OneSignal notification permission');
      await OneSignal.Notifications.requestPermission();

      const permission = OneSignal.Notifications.permission ?? false;
      debugLog('OneSignal permission status:', permission);

      // OneSignal returns boolean; convert to standard NotificationPermission
      return permission === true ? 'granted' : 'denied';
    } catch (error) {
      errorLog('Error requesting OneSignal permission:', error);
      return 'denied';
    }
  }

  async getSubscriptionId(): Promise<string | null> {
    try {
      const subscriptionId = OneSignal.User.PushSubscription.id;

      if (!subscriptionId) {
        debugLog('No OneSignal subscription ID available');
        return null;
      }

      debugLog('OneSignal subscription ID obtained:', subscriptionId);
      return subscriptionId;
    } catch (error) {
      errorLog('Error getting OneSignal subscription ID:', error);
      return null;
    }
  }

  async registerUser(userId: string): Promise<boolean> {
    try {
      debugLog(`Registering user with OneSignal: ${userId}`);

      // OneSignal uses external_id for user mapping
      await this.initialize();
      await OneSignal.login(String(userId));
      
      debugLog(`User ${userId} registered with OneSignal successfully`);
      return true;
    } catch (error) {
      errorLog(`Error registering user ${userId} with OneSignal:`, error);
      return false;
    }
  }

  async unregisterUser(): Promise<boolean> {
    try {
      debugLog('Unregistering user from OneSignal');
      await OneSignal.logout();
      debugLog('User unregistered from OneSignal successfully');
      return true;
    } catch (error) {
      errorLog('Error unregistering user from OneSignal:', error);
      return false;
    }
  }
 
  onForegroundMessage(
    handler: (notification: NormalizedNotification) => void
  ): () => void {
    debugLog('Setting up OneSignal foreground message listener');

    if (this.messageUnsubscribe) {
    this.messageUnsubscribe();
    this.messageUnsubscribe = null;
    }
    const listener = (event: any) => {
      debugLog('OneSignal foreground message received:', event);
      const normalized = this.normalizePayload(event.notification);
      handler(normalized);
    };

    OneSignal.Notifications.addEventListener('foregroundWillDisplay', listener);

    this.messageUnsubscribe = () => {
      if (typeof OneSignal.Notifications.removeEventListener === 'function') {
        OneSignal.Notifications.removeEventListener(
          'foregroundWillDisplay',
          listener
        );
      }
    };
  
    return () => {
      if (this.messageUnsubscribe) {
        this.messageUnsubscribe();
        this.messageUnsubscribe = null;
      }
    };
  }
  async getStatus(): Promise<ProviderStatus> {
    try {
      const supported = await this.isSupported();
      const subscriptionId = await this.getSubscriptionId();
      const permission = OneSignal.Notifications.permission ?? false;

      return {
        available: supported,
        enabled: permission === true,
        subscriptionExists: !!subscriptionId,
        permission: permission === true ? 'granted' : 'denied',
      };
    } catch (error) {
      errorLog('Error getting OneSignal status:', error);
      return {
        available: false,
        enabled: false,
        subscriptionExists: false,
        permission: 'denied',
      };
    }
  }

  async cleanup(): Promise<void> {
    try {
      debugLog('Cleaning up OneSignal provider');
      if (this.messageUnsubscribe) {
        this.messageUnsubscribe();
        this.messageUnsubscribe = null;
      }
    } catch (error) {
      errorLog('Error cleaning up OneSignal provider:', error);
    }
  }

  private normalizePayload(raw: any): NormalizedNotification {
    const notification = raw || {};
    const data = notification.data || {};

    return {
      title: notification.title || 'Nova notificação',
      body: notification.body || 'Você recebeu uma nova atualização.',
      url: (notification.url || data.url || '/student/notifications') as string,
      type: (data.type as string) || null,
      entityId: (data.entityId as string) || null,
      tag: (data.tag || 'nexus-notification') as string,
      icon: (notification.icon as string) || '/icons/icon-192x192.png',
      badge: (notification.badge as string) || '/icons/badge-72x72.png',
    };
  }
}
