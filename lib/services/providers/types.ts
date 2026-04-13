/**
 * Provider-agnostic interfaces for push notification delivery
 * Abstracts FCM and OneSignal behind a common contract
 */

export type NotificationPermission = 'granted' | 'denied' | 'default';

export interface NormalizedNotification {
  title: string;
  body: string;
  url: string;
  type: string | null;
  entityId: string | null;
  tag: string;
  icon?: string;
  badge?: string;
}

export interface ProviderStatus {
  available: boolean;
  enabled: boolean;
  subscriptionExists: boolean;
  permission: NotificationPermission;
}

/**
 * PushProvider interface
 * All push notification providers must implement this contract
 */
export interface PushProvider {
  name: 'fcm' | 'onesignal';

  /**
   * Initialize provider with configuration
   * Throws if provider cannot be initialized
   */
  initialize(): Promise<void>;

  /**
   * Check if provider is supported in current browser/environment
   */
  isSupported(): Promise<boolean>;

  /**
   * Request user permission for notifications
   */
  requestPermission(): Promise<NotificationPermission>;

  /**
   * Get current subscription ID (FCM token, OneSignal subscription ID, etc.)
   * Returns null if no subscription exists
   */
  getSubscriptionId(): Promise<string | null>;

  /**
   * Register a user with the provider
   * Usually called on login to associate device with user
   */
  registerUser(userId: string): Promise<boolean>;

  /**
   * Unregister a user with the provider
   * Usually called on logout
   */
  unregisterUser(): Promise<boolean>;

  /**
   * Setup foreground message listener
   * Returns unsubscribe function
   */
  onForegroundMessage(
    handler: (notification: NormalizedNotification) => void
  ): () => void;

  /**
   * Get current provider status
   */
  getStatus(): Promise<ProviderStatus>;

  /**
   * Cleanup resources (listeners, etc.)
   */
  cleanup(): Promise<void>;
}
