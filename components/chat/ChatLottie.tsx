'use client';

/**
 * components/chat/ChatLottie.tsx — the four chat animations, each in one place.
 *
 *   NEW_CONVERSATION  public/lottie/new-conversation-chit-chatting.json   an empty conversation, until its first message
 *   PEER_TYPING       public/lottie/peer-typing.json        while the other person is writing
 *   SEND_CONFIRMATION public/lottie/send-confirmation.json  once, when a message is sent (phones: arrow)
 *   SEND_CONFIRMATION_WIDE public/lottie/send-confirmation-plane.json  the same on wide screens (paper plane)
 *                     Both are drawn for the button by scripts/lottie/build-send-confirmation.mjs.
 *   WELCOME           public/lottie/welcome-notification.json  the Ledger Chat home, no chat open
 *
 * The JSON is fetched once per page and shared (it is not in the JS bundle). With
 * "reduce motion" on, an animation plays once and stops instead of looping, and the
 * send confirmation does not play at all.
 */

import React, { useEffect, useState } from 'react';
import { LottiePlayer } from '@/components/ui/LottiePlayer';

export const LOTTIE = {
  // A new file name, not the old one: the cat that used to live at new-conversation.json stays in
  // browser and CDN caches for up to a week (Cache-Control in next.config.js, fetch force-cache).
  NEW_CONVERSATION: '/lottie/new-conversation-chit-chatting.json',
  PEER_TYPING: '/lottie/peer-typing.json',
  SEND_CONFIRMATION: '/lottie/send-confirmation.json',
  SEND_CONFIRMATION_WIDE: '/lottie/send-confirmation-plane.json',
  WELCOME: '/lottie/welcome-notification.json',
} as const;

const cache = new Map<string, Promise<unknown>>();

/** One fetch per animation per page; a failed fetch is forgotten so the next mount retries. */
export function loadLottie(src: string): Promise<unknown> {
  let p = cache.get(src);
  if (!p) {
    p = fetch(src, { cache: 'force-cache' }).then((r) => {
      if (!r.ok) throw new Error(`lottie ${r.status}`);
      return r.json();
    });
    p.catch(() => cache.delete(src));
    cache.set(src, p);
  }
  return p;
}

/**
 * Fetches both send confirmations and the player ahead of the first send, so the first message
 * plays at once instead of after a download.
 */
export function preloadSendConfirmation(): void {
  if (typeof window === 'undefined') return;
  loadLottie(LOTTIE.SEND_CONFIRMATION).catch(() => {});
  loadLottie(LOTTIE.SEND_CONFIRMATION_WIDE).catch(() => {});
  import('lottie-web').catch(() => {});
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const q = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(q.matches);
    on();
    q.addEventListener?.('change', on);
    return () => q.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

export interface ChatLottieProps {
  src: string;
  width: number;
  height: number;
  loop?: boolean;
  label?: string;
  className?: string;
  onComplete?: () => void;
}

export function ChatLottie({ src, width, height, loop = true, label, className, onComplete }: ChatLottieProps) {
  const [data, setData] = useState<unknown>(null);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    let alive = true;
    loadLottie(src).then((d) => alive && setData(d), () => alive && onComplete?.());
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);
  // Reserve the space while loading, so nothing moves when it appears.
  if (!data) return <div className={className} style={{ width, height }} aria-hidden="true" />;
  return (
    <LottiePlayer
      animationData={data}
      width={width}
      height={height}
      loop={loop && !reduced}
      className={className}
      label={label}
      onComplete={onComplete}
    />
  );
}

/**
 * The empty conversation (two chat bubbles taking turns, 2.6 s loop): shown while the
 * conversation has no message, including right after Clear chat. The file is 350 x 230.
 */
export function NewConversationLottie() {
  return <ChatLottie src={LOTTIE.NEW_CONVERSATION} width={210} height={138} label="A new conversation" />;
}

/** The other person is writing. Sized to sit inside a message bubble. */
export function PeerTypingLottie({ size = 'bubble' }: { size?: 'bubble' | 'inline' }) {
  // The animation is 128 × 68 and draws its own light grey bubble.
  const w = size === 'bubble' ? 72 : 30;
  return <ChatLottie src={LOTTIE.PEER_TYPING} width={w} height={Math.round((w * 68) / 128)} />;
}

/**
 * The send confirmation, played once in the send button's own place and shape, with the button's
 * own colour behind it: the button's icon leaves (the arrow upwards on phones, the paper plane up
 * and to the right on wide screens), a tick draws itself, then the slot fades back to what is
 * there after the send. 0.9 s, vector, drawn for this button (scripts/lottie/build-send-confirmation.mjs).
 * Not shown with reduce motion. It never takes clicks.
 */
export function SendConfirmationBurst({ burst, size = 40, wide = false, className }: { burst: number; size?: number; wide?: boolean; className?: string }) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!(burst > 0) || reduced) return;
    setShown(burst);
    // Removed when the animation ends; this is only the fallback if it never starts.
    const t = setTimeout(() => setShown((s) => (s === burst ? 0 : s)), 1100);
    return () => clearTimeout(t);
  }, [burst, reduced]);
  if (!shown || shown !== burst) return null;
  return (
    <div
      className={`hl-send-burst pointer-events-none overflow-hidden ${wide ? 'rounded-2xl bg-[#2456e6]' : 'rounded-full bg-[#15171c]'} ${className ?? ''}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <ChatLottie key={shown} src={wide ? LOTTIE.SEND_CONFIRMATION_WIDE : LOTTIE.SEND_CONFIRMATION} width={size} height={size} loop={false} onComplete={() => setShown(0)} />
    </div>
  );
}

/** The Ledger Chat home, when no conversation is open. */
export function WelcomeLottie() {
  return <ChatLottie src={LOTTIE.WELCOME} width={176} height={176} label="Ledger Chat" />;
}
