/**
 * Provider Manager
 * Routes provider selection and initialization with feature flag support
 * Implements failover and dual-mode operation
 */

import { FCMProvider } from './FCMProvider';
import { OneSignalProvider } from './OneSignalProvider';
import type {
  PushProvider,
  ProviderStatus,
  NormalizedNotification,
  NotificationPermission,
} from './types';

type ProviderMode = 'fcm' | 'onesignal' | 'dual';

interface ProviderConfig {
  mode: ProviderMode;
  // Note: In dual mode, OneSignal is always preferred (no config option needed)
}

/**
 * ProviderManager: Manages provider selection and initialization
 * Supports feature flags for safe A/B testing and gradual rollout
 *
 * USAGE PATTERN (Do NOT access ProviderManager directly from components/context):
 *   AuthContext/Components
 *       ↓
 *   NotificationService (exposes public methods)
 *       ↓
 *   ProviderManager (internal routing)
 *       ↓
 *   FCMProvider or OneSignalProvider (active provider)
 *
 * NotificationService should expose public methods like:
 *   - NotificationService.registerUser(userId)
 *   - NotificationService.requestPermission()
 *   - NotificationService.getSubscriptionId()
 *   etc.
 *
 * These internally delegate to this ProviderManager.
 */
export class ProviderManager {
  private mode: ProviderMode;
  private fcm: FCMProvider;
  private oneSignal: OneSignalProvider;
  private activeProvider: PushProvider | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(config: ProviderConfig = { mode: 'fcm' }) {
    this.mode = config.mode;
    this.fcm = new FCMProvider();
    this.oneSignal = new OneSignalProvider();

    this.log(`Initialized with mode: ${this.mode}`);
  }

  async initialize(): Promise<void> {
    // Prevent multiple initialization attempts
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doInitialize().catch((error) => {
      this.log('Initialization failed, clearing promise for retry');
      this.initPromise = null;
      throw error;
    });

    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    this.log(`Starting initialization in mode: ${this.mode}`);

    if (this.mode === 'fcm') {
      await this.initFCM();
    } else if (this.mode === 'onesignal') {
      await this.initOneSignal();
    } else if (this.mode === 'dual') {
      await this.initDual();
    }

    if (!this.activeProvider) {
      throw new Error(
        `[ProviderManager] No notification provider initialized (mode: ${this.mode})`
      );
    }

    this.log(`Initialization complete, active provider: ${this.activeProvider.name}`);
  }

  private async initFCM(): Promise<void> {
    try {
      await this.fcm.initialize();
      this.activeProvider = this.fcm;
      this.log('FCM initialized successfully');
    } catch (error) {
      this.errorLog('FCM initialization failed:', error);
      throw error;
    }
  }

  private async initOneSignal(): Promise<void> {
    try {
      await this.oneSignal.initialize();
      this.activeProvider = this.oneSignal;
      this.log('OneSignal initialized successfully');
    } catch (error) {
      this.errorLog('OneSignal initialization failed:', error);
      throw error;
    }
  }

  private async initDual(): Promise<void> {
    // In dual mode: Initialize both providers
    // OneSignal is preferred for all operations (fallback to FCM if OneSignal fails)
    // This provides graceful degradation: if OneSignal is unavailable, FCM ensures notifications work

    const fcmPromise = this.fcm
      .initialize()
      .then(() => {
        this.log('FCM initialized in dual mode (fallback)');
        return true;
      })
      .catch((error) => {
        this.log('FCM initialization failed in dual mode (non-critical):', error);
        return false;
      });

    const oneSignalPromise = this.oneSignal
      .initialize()
      .then(() => {
        this.log('OneSignal initialized in dual mode (primary)');
        return true;
      })
      .catch((error) => {
        this.errorLog('OneSignal initialization failed in dual mode:', error);
        return false;
      });

    const [fcmSuccess, oneSignalSuccess] = await Promise.all([fcmPromise, oneSignalPromise]);

    if (!fcmSuccess && !oneSignalSuccess) {
      throw new Error('[ProviderManager] Both FCM and OneSignal initialization failed in dual mode');
    }

    // In dual mode, OneSignal is primary. FCM is fallback.
    // Always use OneSignal for operations if available.
    if (oneSignalSuccess) {
      this.activeProvider = this.oneSignal;
      this.log('Dual mode: OneSignal set as primary provider (FCM fallback available)');
    } else if (fcmSuccess) {
      this.activeProvider = this.fcm;
      this.log('Dual mode: FCM set as provider (OneSignal unavailable)');
    }
  }

  async isSupported(): Promise<boolean> {
    await this.ensureInitialized();
    return this.activeProvider!.isSupported();
  }

  async requestPermission(): Promise<NotificationPermission> {
    await this.ensureInitialized();
    return this.activeProvider!.requestPermission();
  }

  async getSubscriptionId(): Promise<string | null> {
    await this.ensureInitialized();
    return this.activeProvider!.getSubscriptionId();
  }

  async registerUser(userId: string): Promise<boolean> {
    await this.ensureInitialized();
    return this.activeProvider!.registerUser(userId);
  }

  async unregisterUser(): Promise<boolean> {
    await this.ensureInitialized();
    return this.activeProvider!.unregisterUser();
  }
  async setupForegroundMessage(
    handler: (notification: NormalizedNotification) => void
  ): Promise<() => void> {
    await this.ensureInitialized();

    if (!this.activeProvider) {
      this.errorLog('Provider not available for foreground message listener');
      return () => {};
    }

    return this.activeProvider.onForegroundMessage(handler);
  }
  onForegroundMessage(
    handler: (notification: NormalizedNotification) => void
  ): () => void {
    // legacy synchronous version
    if (!this.activeProvider) {
      this.errorLog('Provider not initialized when setting up foreground message listener');
      return () => {};
    }

    return this.activeProvider.onForegroundMessage(handler);
  }

  async getStatus(): Promise<ProviderStatus> {
    await this.ensureInitialized();
    return this.activeProvider!.getStatus();
  }

  async cleanup(): Promise<void> {
    this.log('Cleaning up provider manager');
    if (this.activeProvider) {
      await this.activeProvider.cleanup();
    }
  }

  getActiveProviderName(): string {
    return this.activeProvider?.name ?? 'none';
  }

  /**
   * Create ProviderManager from environment configuration
   */
  static fromConfig(): ProviderManager {
    const modeEnv = process.env.NEXT_PUBLIC_NOTIFICATION_PROVIDER ?? 'fcm';
    const mode = (modeEnv as ProviderMode) || 'fcm';

    if (!['fcm', 'onesignal', 'dual'].includes(mode)) {
      console.warn(
        `[ProviderManager] Invalid NEXT_PUBLIC_NOTIFICATION_PROVIDER: ${mode}, defaulting to 'fcm'`
      );
      return new ProviderManager({ mode: 'fcm' });
    }

    return new ProviderManager({ mode });
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.activeProvider) {
      await this.initialize();
    }
  }

  private log(...args: unknown[]): void {
    console.log('[ProviderManager]', ...args);
  }

  private errorLog(...args: unknown[]): void {
    console.error('[ProviderManager]', ...args);
  }
}
