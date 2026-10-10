"use client";

/**
 * useSettingsEffect — The Settings Enforcement Engine
 *
 * This hook is the single source of truth for APPLYING settings to the UI.
 * It subscribes to the pxeEngine and enforces every setting as a real side effect.
 * Mount it once in the root chat component.
 */

import { useEffect, useRef } from 'react';
import { LedgerProtocolSettings } from '@/lib/wallet/SettingsEnginePXE';

const SOUND_CACHE: Record<string, HTMLAudioElement> = {};

function getAudio(src: string): HTMLAudioElement {
  if (!SOUND_CACHE[src]) {
    SOUND_CACHE[src] = new Audio(src);
  }
  return SOUND_CACHE[src];
}

export function useSettingsEffect(
  settings: LedgerProtocolSettings | null,
  containerRef?: React.RefObject<HTMLDivElement>
) {
  const prevSettings = useRef<LedgerProtocolSettings | null>(null);

  useEffect(() => {
    if (!settings) return;
    const s = settings as any;
    (window as any).__ledger_burn_on_read = s.burn_on_read;
    (window as any).__ledger_burn_on_read_seconds = s.burn_on_read_seconds || 10;
    (window as any).__ledger_bubble_style = s.bubble_style || 'default';
    (window as any).__ledger_notification_sound = s.notification_sound;
    (window as any).__ledger_tone_translator = s.tone_translator;
    (window as any).__ledger_ghost_reply = s.ghost_auto_reply;
    (window as any).__ledger_ghost_reply_text = s.ghost_auto_reply_text || 'I am unavailable right now.';
    (window as any).__ledger_mechanical_keyboard = s.mechanical_keyboard;
  }, [settings]);

  useEffect(() => {
    if (!settings?.mechanical_keyboard) return;
    const handleKeyDown = () => {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'square'; osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.03);
      } catch {}
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [settings?.mechanical_keyboard]);

  useEffect(() => {
    if (!settings) return;
    const prev = prevSettings.current;

    // ─────────────────────────────────────────────────────────────
    // CHAT BACKGROUND
    // ─────────────────────────────────────────────────────────────
    if (!prev || prev.chat_background !== settings.chat_background) {
      const backgrounds: Record<string, string> = {
        default:      '#FFFFFF',
        amoled:       '#000000',
        holographic:  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        matrix:       '#0a1a0a',
        gradient:     'linear-gradient(180deg, #f8f8f8 0%, #e8e8f0 100%)',
      };
      const bg = backgrounds[settings.chat_background] || '#FFFFFF';
      document.documentElement.style.setProperty('--ledger-chat-bg', bg);
    }

    // ─────────────────────────────────────────────────────────────
    // FONT SIZE
    // ─────────────────────────────────────────────────────────────
    if (!prev || prev.font_size !== settings.font_size) {
      const sizes: Record<string, string> = {
        small:   '13px',
        medium:  '15px',
        large:   '17px',
        xl:      '19px',
      };
      document.documentElement.style.setProperty(
        '--ledger-chat-font-size',
        sizes[settings.font_size] || '15px'
      );
    }

    // ─────────────────────────────────────────────────────────────
    // FONT FAMILY
    // ─────────────────────────────────────────────────────────────
    if (!prev || prev.font_family !== settings.font_family) {
      const fonts: Record<string, string> = {
        system:   '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        mono:     '"SF Mono", "Fira Code", "Cascadia Code", monospace',
        serif:    'Georgia, "Times New Roman", serif',
        humanist: '"Inter", "Nunito", sans-serif',
      };
      document.documentElement.style.setProperty(
        '--ledger-chat-font-family',
        fonts[settings.font_family] || fonts.system
      );
    }

    // ─────────────────────────────────────────────────────────────
    // UI DENSITY
    // ─────────────────────────────────────────────────────────────
    if (!prev || prev.ui_density !== settings.ui_density) {
      const densityMap: Record<string, string> = {
        relaxed: '20px',
        compact:  '10px',
        dense:    '6px',
      };
      document.documentElement.style.setProperty(
        '--ledger-message-padding',
        densityMap[settings.ui_density] || '14px'
      );
    }

    // ─────────────────────────────────────────────────────────────
    // LANGUAGE — set html lang attribute
    // ─────────────────────────────────────────────────────────────
    if (!prev || prev.language !== settings.language) {
      document.documentElement.lang = settings.language || 'en';
    }

    // ─────────────────────────────────────────────────────────────
    // NOTIFICATION SOUND — play toggle-on sound on change
    // ─────────────────────────────────────────────────────────────
    if (prev && prev.notification_sound !== settings.notification_sound) {
      if (settings.notification_sound) {
        const audio = getAudio('/sounds/toggle_on.mp3');
        audio.volume = 0.3;
        audio.play().catch(() => {});
      }
    }

    // ─────────────────────────────────────────────────────────────
    // WATERMARK — set CSS variable for overlay visibility
    // ─────────────────────────────────────────────────────────────
    if (!prev || prev.watermark_enabled !== settings.watermark_enabled) {
      document.documentElement.style.setProperty(
        '--ledger-watermark-opacity',
        settings.watermark_enabled ? '0.04' : '0'
      );
    }

    // ─────────────────────────────────────────────────────────────
    // WEBRTC IP MASKING — store in window for WebRTC layer to read
    // ─────────────────────────────────────────────────────────────
    if (!prev || prev.webrtc_ip_masking !== settings.webrtc_ip_masking) {
      (window as any).__ledger_webrtc_ip_masking = settings.webrtc_ip_masking;
      localStorage.setItem('ledger_webrtc_ip_masking', String(settings.webrtc_ip_masking));
    }

    // ─────────────────────────────────────────────────────────────
    // MEV PROTECTION — store for transaction layer
    // ─────────────────────────────────────────────────────────────
    if (!prev || prev.mev_protection !== settings.mev_protection) {
      localStorage.setItem('ledger_mev_protection', String(settings.mev_protection));
      (window as any).__ledger_mev_protection = settings.mev_protection;
    }

    // ─────────────────────────────────────────────────────────────
    // CUSTOM RPC URL — store for chain interactions
    // ─────────────────────────────────────────────────────────────
    if (!prev || prev.custom_rpc_url !== settings.custom_rpc_url) {
      if (settings.custom_rpc_url) {
        localStorage.setItem('ledger_custom_rpc', settings.custom_rpc_url);
      } else {
        localStorage.removeItem('ledger_custom_rpc');
      }
    }

    // ─────────────────────────────────────────────────────────────
    // AUTO-DELETE TIMER — store for message pruning logic
    // ─────────────────────────────────────────────────────────────
    if (!prev || prev.auto_delete_timer !== settings.auto_delete_timer) {
      localStorage.setItem('ledger_auto_delete', settings.auto_delete_timer || 'off');
    }

    // ─────────────────────────────────────────────────────────────
    // BURN ON READ — set global flag
    // ─────────────────────────────────────────────────────────────
    if (!prev || prev.burn_on_read !== settings.burn_on_read) {
      localStorage.setItem('ledger_burn_on_read', String(settings.burn_on_read));
      localStorage.setItem('ledger_burn_seconds', String(settings.burn_on_read_seconds || 10));
    }

    // ─────────────────────────────────────────────────────────────
    // ONION HOPS — store for P2P routing layer
    // ─────────────────────────────────────────────────────────────
    if (!prev || prev.onion_hops !== settings.onion_hops) {
      localStorage.setItem('ledger_onion_hops', String(settings.onion_hops));
    }

    // ─────────────────────────────────────────────────────────────
    // PRIVACY — last seen, profile photo, bio
    // ─────────────────────────────────────────────────────────────
    if (!prev || prev.privacy_last_seen !== settings.privacy_last_seen) {
      localStorage.setItem('ledger_privacy_last_seen', settings.privacy_last_seen);
    }

    // ─────────────────────────────────────────────────────────────
    // READ RECEIPTS — store for message engine
    // ─────────────────────────────────────────────────────────────
    if (!prev || prev.show_read_receipts !== settings.show_read_receipts) {
      localStorage.setItem('ledger_show_read_receipts', String(settings.show_read_receipts));
      (window as any).__ledger_read_receipts = settings.show_read_receipts;
    }

    // ─────────────────────────────────────────────────────────────
    // HAPTICS INTENSITY — store for mobile vibration
    // ─────────────────────────────────────────────────────────────
    if (!prev || prev.haptics_intensity !== settings.haptics_intensity) {
      localStorage.setItem('ledger_haptics', String(settings.haptics_intensity));
    }

    // ─────────────────────────────────────────────────────────────
    // PERSIST to server silently on ANY change
    // ─────────────────────────────────────────────────────────────
    if (prev) {
      // Find keys that changed
      const changedKeys = Object.keys(settings).filter(
        (k) => (settings as any)[k] !== (prev as any)[k]
      ) as (keyof LedgerProtocolSettings)[];

      changedKeys.forEach((key) => {
        fetch('/api/user/settings/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ key, value: settings[key] }),
        }).catch(() => {});
      });
    }

    prevSettings.current = settings;
  }, [settings]);
}

/**
 * Helper to apply settings sound when incoming message arrives.
 */
export function playMessageSound(settings: LedgerProtocolSettings | null) {
  if (!settings?.notification_sound) return;
  const audio = getAudio('/sounds/message_received.mp3');
  audio.volume = 0.5;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

/**
 * Helper to apply mechanical keyboard sound on keydown.
 */
export function playKeyboardClick(settings: LedgerProtocolSettings | null) {
  if (!settings?.mechanical_keyboard) return;
  const audio = getAudio('/sounds/keyboard_click.mp3');
  audio.volume = 0.2;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

/**
 * Returns the CSS style object for the chat background from settings.
 */
export function getChatBgStyle(settings: LedgerProtocolSettings | null): React.CSSProperties {
  const backgrounds: Record<string, React.CSSProperties> = {
    default:     { background: '#FFFFFF' },
    amoled:      { background: '#000000' },
    holographic: { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
    matrix:      { background: '#0a1a0a' },
    gradient:    { background: 'linear-gradient(180deg, #f8f8f8 0%, #e8e8f0 100%)' },
  };
  return backgrounds[settings?.chat_background || 'default'] || { background: '#FFFFFF' };
}
