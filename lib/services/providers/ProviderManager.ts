/**
 * Provider Manager
 * Routes provider selection and initialization with feature flag support
 * Implements failover and dual-mode operation
 */

import { OneSignalProvider } from './OneSignalProvider';
import type {
  PushProvider,
  ProviderStatus,
  NormalizedNotification,
  NotificationPermission,
} from './types';

interface ProviderConfig {}

/**
 * ProviderManager: Manages provider selection and initialization
 * Uses OneSignal as the only supported push provider.
 *
 * USAGE PATTERN (Do NOT access ProviderManager directly from components/context):
 *   AuthContext/Components
 *       ↓
 *   NotificationService (exposes public methods)
 *       ↓
 *   ProviderManager (internal routing)
 *       ↓
 *   OneSignalProvider (active provider)
 *
 * NotificationService should expose public methods like:
 *   - NotificationService.registerUser(userId)
 *   - NotificationService.requestPermission()
 *   - NotificationService.getSubscriptionId()
 *   etc.
 */
export class ProviderManager {
  private oneSignal: OneSignalProvider;
  private activeProvider: PushProvider | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(config: ProviderConfig = {}) {
    this.oneSignal = new OneSignalProvider();

    this.log('Initialized in OneSignal-only mode');
  }

  async initialize(): Promise<void> {
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
    this.log('Starting OneSignal initialization');

    await this.initOneSignal();

    if (!this.activeProvider) {
      throw new Error('[ProviderManager] No notification provider initialized (onesignal)');
    }

    this.log(`Initialization complete, active provider: ${this.activeProvider.name}`);
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
    const modeEnv = process.env.NEXT_PUBLIC_NOTIFICATION_PROVIDER ?? 'onesignal';
    if (modeEnv !== 'onesignal') {
      console.warn(
        `[ProviderManager] Invalid or unsupported NEXT_PUBLIC_NOTIFICATION_PROVIDER: ${modeEnv}, defaulting to 'onesignal'`
      );
    }
    return new ProviderManager();
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
