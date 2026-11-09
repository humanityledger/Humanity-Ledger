'use client';

/**
 * Offers "Add to Home Screen" once, after the visitor has signed in.
 *  - Chromium (Android, desktop): uses the beforeinstallprompt event.
 *  - iOS Safari has no install API, so it gets a short hint: Share, then
 *    Add to Home Screen.
 * Hidden when the app already runs standalone, and for 14 days after a dismissal.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Share, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pwa_install_dismissed';
const DISMISS_MS = 14 * 24 * 60 * 60 * 1000;

function hasSession(): boolean {
  try {
    return document.cookie.includes('system_handshake=') || Boolean(localStorage.getItem('system_session_v2'));
  } catch {
    return false;
  }
}

function recentlyDismissed(): boolean {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return t > 0 && Date.now() - t < DISMISS_MS;
  } catch {
    return false;
  }
}

export function PWAInstallBanner() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone || recentlyDismissed()) return;

    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    setIsIOS(ios);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      if (hasSession()) setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    if (ios && hasSession()) timer = setTimeout(() => setVisible(true), 3000);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const install = useCallback(async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice.catch(() => null);
    setInstallEvent(null);
    setVisible(false);
  }, [installEvent]);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Install Ledger Chat"
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 'max(16px, env(safe-area-inset-bottom))',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        borderRadius: 16,
        background: '#111318',
        color: '#fff',
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="" width={40} height={40} style={{ borderRadius: 10, flex: 'none' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>Install Ledger Chat</div>
        <div style={{ fontSize: 12.5, opacity: 0.8, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {isIOS ? (
            <>
              Tap <Share size={13} aria-label="Share" /> then <strong>Add to Home Screen</strong>
            </>
          ) : (
            'Open it from your home screen, like any app'
          )}
        </div>
      </div>
      {!isIOS && installEvent && (
        <button
          type="button"
          onClick={install}
          style={{ minHeight: 40, padding: '0 14px', border: 0, borderRadius: 10, background: '#fff', color: '#111318', fontWeight: 600, fontSize: 14 }}
        >
          Install
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        style={{ minWidth: 40, minHeight: 40, border: 0, background: 'none', color: 'rgba(255,255,255,0.7)', display: 'grid', placeItems: 'center' }}
      >
        <X size={18} />
      </button>
    </div>
  );
}
