'use client';
/**
 * A light tap where the device has a motor (Android browsers, installed PWAs). iOS Safari and
 * desktops have no Vibration API: these do nothing there. Never more than a short pattern, and
 * never with "reduce motion".
 */
export const HAPTIC = {
  /** An incoming call: two soft knocks, once (the ringtone does the rest). */
  ring: [0, 38, 90, 38],
  /** Something failed. */
  error: [24],
  /** A swipe that removed something. */
  tick: [8],
} as const;

export function buzz(pattern: readonly number[]) {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  try { navigator.vibrate([...pattern]); } catch { /* blocked until the user has interacted */ }
}
