'use client';

/**
 * components/chat/ChatLottie.tsx — the four chat animations, each in one place.
 *
 *   NEW_CONVERSATION  public/lottie/new-conversation.json   an empty conversation, until its first message
 *   PEER_TYPING       public/lottie/peer-typing.json        while the other person is writing
 *   SEND_CONFIRMATION public/lottie/send-confirmation.json  once, when a message is sent
 *   WELCOME           public/lottie/welcome-notification.json  the Ledger Chat home, no chat open
 *
 * The JSON is fetched once per page and shared (it is not in the JS bundle). With
 * "reduce motion" on, an animation plays once and stops instead of looping, and the
 * send confirmation does not play at all.
 */

import React, { useEffect, useState } from 'react';
import { LottiePlayer } from '@/components/ui/LottiePlayer';

export const LOTTIE = {
  NEW_CONVERSATION: '/lottie/new-conversation.json',
  PEER_TYPING: '/lottie/peer-typing.json',
  SEND_CONFIRMATION: '/lottie/send-confirmation.json',
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

/** The empty conversation: shown only while the conversation has no message. */
export function NewConversationLottie() {
  return <ChatLottie src={LOTTIE.NEW_CONVERSATION} width={168} height={168} label="A new conversation" />;
}

/** The other person is writing. Sized to sit inside a message bubble. */
export function PeerTypingLottie({ size = 'bubble' }: { size?: 'bubble' | 'inline' }) {
  // The animation is 128 × 68 and draws its own light grey bubble.
  const w = size === 'bubble' ? 72 : 30;
  return <ChatLottie src={LOTTIE.PEER_TYPING} width={w} height={Math.round((w * 68) / 128)} />;
}

/**
 * Plays the send confirmation once for each change of `burst` (> 0), then removes itself.
 * Not shown with reduce motion. It never takes clicks.
 */
export function SendConfirmationBurst({ burst, className }: { burst: number; className?: string }) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (burst > 0 && !reduced) setShown(burst);
  }, [burst, reduced]);
  if (!shown || shown !== burst) return null;
  return (
    <div className={`pointer-events-none ${className ?? ''}`} aria-hidden="true">
      <ChatLottie key={shown} src={LOTTIE.SEND_CONFIRMATION} width={72} height={72} loop={false} onComplete={() => setShown(0)} />
    </div>
  );
}

/** The Ledger Chat home, when no conversation is open. */
export function WelcomeLottie() {
  return <ChatLottie src={LOTTIE.WELCOME} width={176} height={176} label="Ledger Chat" />;
}
