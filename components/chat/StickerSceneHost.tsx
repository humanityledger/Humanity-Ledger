'use client';

/**
 * The layer where sticker moments play (lib/chat/sticker-scenes.ts). It covers the whole window
 * (frame-breaking, see the note on the returned element), never takes pointer events, and the
 * offered packs play the short moment (IMMERSIVE_SCENE_MS) so a sticker never holds the screen.
 *
 * A sticker bubble asks for its moment with requestStickerScene(): when it arrives fresh (once per
 * message, also for the sender) and whenever someone taps it. Moments play one at a time; a burst
 * of stickers queues at most three. The engine is loaded on first use, so the chat bundle does not
 * carry it. "Sticker effects" (Settings → Chat appearance) turns the automatic moments off on this
 * device; a tap still plays one. Reduced motion gets a short, still pop.
 */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { stickerRef } from '@/lib/chat/stickers';

export const STICKER_SCENE_EVENT = 'ledger:sticker-scene';
const PREF_KEY = 'ledger_sticker_effects';
const PLAYED_KEY = 'ledger_sticker_scenes_played';

interface SceneDetail {
  content: string;
  rect: { left: number; top: number; width: number; height: number } | null;
  auto: boolean;
}

/** Whether moments play by themselves on this device (default on). */
export function stickerEffectsEnabled(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setStickerEffectsEnabled(on: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
  } catch {
    /* storage unavailable */
  }
}

const played = new Set<string>();
/** True the first time a message asks to play by itself, on this device and session. */
export function claimAutoPlay(messageKey: string): boolean {
  if (!messageKey) return false;
  if (played.size === 0) {
    try {
      for (const k of JSON.parse(sessionStorage.getItem(PLAYED_KEY) || '[]') as string[]) played.add(k);
    } catch {
      /* ignore */
    }
  }
  if (played.has(messageKey)) return false;
  played.add(messageKey);
  try {
    sessionStorage.setItem(PLAYED_KEY, JSON.stringify(Array.from(played).slice(-200)));
  } catch {
    /* ignore */
  }
  return true;
}

/** Ask the open conversation to play a sticker's moment, starting from `from` (its bubble). */
export function requestStickerScene(content: string, from?: Element | null, auto = false): void {
  if (typeof window === 'undefined' || !stickerRef(content)?.sticker.scene) return;
  if (auto && !stickerEffectsEnabled()) return;
  const r = from?.getBoundingClientRect();
  const detail: SceneDetail = { content, rect: r ? { left: r.left, top: r.top, width: r.width, height: r.height } : null, auto };
  window.dispatchEvent(new CustomEvent<SceneDetail>(STICKER_SCENE_EVENT, { detail }));
}

export function StickerSceneHost() {
  const ref = useRef<HTMLDivElement>(null);
  // Stays in the conversation: what shakes for the shake and boom scenes.
  const anchor = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const queue: SceneDetail[] = [];
    let playing: { cancel(): void } | null = null;
    let alive = true;

    const next = async () => {
      if (playing || !alive) return;
      const d = queue.shift();
      const host = ref.current;
      if (!d || !host) return;
      const s = stickerRef(d.content);
      if (!s?.sticker.scene) return next();
      const { playStickerScene } = await import('@/lib/chat/sticker-scenes');
      // Decode the picture before the moment starts, so its first frame is already sharp.
      try { const pre = new Image(); pre.src = s.src; await pre.decode(); } catch { /* plays anyway */ }
      if (!alive) return;
      const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const from = d.rect ? new DOMRect(d.rect.left, d.rect.top, d.rect.width, d.rect.height) : null;
      const pb = playStickerScene({
        host,
        shakeTarget: anchor.current?.parentElement ?? null,
        src: s.src,
        label: s.sticker.label,
        scene: s.sticker.scene,
        tint: s.sticker.tint,
        from,
        reducedMotion,
        durationMs: s.pack.sceneMs,
        maxHeroPx: s.pack.px,
      });
      playing = pb;
      await pb.done;
      playing = null;
      void next();
    };

    const onScene = (e: Event) => {
      const d = (e as CustomEvent<SceneDetail>).detail;
      if (!d || typeof d.content !== 'string') return;
      if (!d.auto) {
        // A tap replaces whatever is playing: the person asked for this one now.
        queue.length = 0;
        playing?.cancel();
      } else if (queue.length >= 3) {
        return;
      }
      queue.push(d);
      void next();
    };
    // Leaving the conversation (or the tab) stops a moment mid-way.
    const onHide = () => { if (document.visibilityState === 'hidden') { queue.length = 0; playing?.cancel(); } };

    window.addEventListener(STICKER_SCENE_EVENT, onScene);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      alive = false;
      window.removeEventListener(STICKER_SCENE_EVENT, onScene);
      document.removeEventListener('visibilitychange', onHide);
      queue.length = 0;
      playing?.cancel();
    };
  }, []);

  // Frame-breaking: the layer covers the whole window, not just the conversation, so a moment can
  // pass over the chat list, the composer and the header. It never takes a pointer event: every tap,
  // scroll and keystroke goes through to the app while it plays.
  // Portalled to <body> so no transformed or filtered ancestor can clip it back into the chat.
  return (
    <>
      <div ref={anchor} className="hidden" aria-hidden="true" />
      {mounted && createPortal(
        <div ref={ref} className="fixed inset-0 z-[300000] pointer-events-none overflow-hidden" aria-hidden="true" data-testid="sticker-stage" />,
        document.body,
      )}
    </>
  );
}
