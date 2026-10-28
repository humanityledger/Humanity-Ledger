// lib/wallet/NotificationEngine.ts
// Push Notification and Background Sync Controller

class NotificationEngine {
  private registration: ServiceWorkerRegistration | null = null;
  private isSupported: boolean;

  constructor() {
    this.isSupported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
  }

  async init(): Promise<void> {
    if (!this.isSupported) {
      console.warn('[NotificationEngine] Push notifications not supported.');
      return;
    }

    try {
      // One worker for the whole app; a second script on the same scope
      // replaced the first (see public/sw.js).
      this.registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('[NotificationEngine] Service Worker registered successfully.');
      
      // Request background sync for outbox if supported
      if ('sync' in this.registration) {
        navigator.serviceWorker.ready.then(reg => {
          // Type assertion for experimental SyncManager
          (reg as any).sync.register('sync-messages').catch(console.error);
        });
      }
    } catch (err) {
      console.error('[NotificationEngine] SW Registration failed:', err);
    }
  }

  async requestPermission(): Promise<boolean> {
    if (!this.isSupported) return false;
    
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    
    return permission === 'granted';
  }

  /**
   * Generates a local notification if the app is hidden,
   * simulating an incoming message without relying on Apple/Google servers.
   */
  async notifyLocal(title: string, body: string, peerAddress: string, hideContent = false): Promise<void> {
    if (!this.isSupported || Notification.permission !== 'granted') return;

    // Only notify if document is hidden (user is not looking at the app)
    if (document.visibilityState === 'visible') return;

    if (this.registration) {
      const options = {
        body: hideContent ? 'New secure message.' : body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge.png',
        tag: peerAddress,
        data: { url: '/chat', peerAddress }
      };
      
      await this.registration.showNotification(hideContent ? 'New Message' : title, options);
    } else {
      // Fallback
      new Notification(hideContent ? 'New Message' : title, {
        body: hideContent ? 'New secure message.' : body,
      });
    }
  }

  /**
   * Registers for server-side Web Push (for future decentralized relay integration)
   */
  async subscribeToWebPush(vapidPublicKey: string): Promise<PushSubscription | null> {
    if (!this.isSupported || !this.registration) return null;

    const permission = await this.requestPermission();
    if (!permission) return null;

    try {
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
      });
      return subscription;
    } catch (e) {
      console.error('[NotificationEngine] Failed to subscribe to Web Push:', e);
      return null;
    }
  }

  // Utility to convert VAPID key
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}

export const notificationEngine = new NotificationEngine();
