'use client';
import { useEffect, useState, useCallback } from 'react';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export interface PushState {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission;
  isLoading: boolean;
}

export function usePushNotifications(walletAddress?: string) {
  const [state, setState] = useState<PushState>({
    isSupported: false,
    isSubscribed: false,
    permission: 'default',
    isLoading: false
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    if (!supported) return;
    setState(s => ({ ...s, isSupported: true, permission: Notification.permission }));
    checkSubscription();
  }, [walletAddress]);

  const checkSubscription = async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription();
      setState(s => ({ ...s, isSubscribed: !!sub }));
    } catch {}
  };

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!walletAddress) return false;
    setState(s => ({ ...s, isLoading: true }));
    try {
      const permission = await Notification.requestPermission();
      setState(s => ({ ...s, permission }));
      if (permission !== 'granted') { setState(s => ({ ...s, isLoading: false })); return false; }

      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        console.warn('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set');
        setState(s => ({ ...s, isLoading: false }));
        return false;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      });

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON(), walletAddress })
      });

      setState(s => ({ ...s, isSubscribed: true, isLoading: false }));
      return true;
    } catch (e) {
      console.error('[push] subscribe failed:', e);
      setState(s => ({ ...s, isLoading: false }));
      return false;
    }
  }, [walletAddress]);

  const unsubscribe = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      setState(s => ({ ...s, isSubscribed: false }));
    } catch {}
  }, []);

  // Send push when tab is hidden and a new message arrives
  const notifyIfHidden = useCallback((senderAddress: string, content: string) => {
    if (!document.hidden || !walletAddress || senderAddress.toLowerCase() === walletAddress.toLowerCase()) return;
    fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toAddress: walletAddress,
        title: 'Ledger Chat',
        body: content.replace(/__[A-Z_]+__[^:]*::?/, '').slice(0, 100),
        url: '/chat'
      })
    }).catch(() => {});
  }, [walletAddress]);

  return { ...state, subscribe, unsubscribe, notifyIfHidden };
}
