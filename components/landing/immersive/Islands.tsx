'use client';
/**
 * The landing's client islands. Everything else on the page is a Server Component.
 */
import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { onScene, startScenes } from './engine';
import { approach, videoTime } from '@/lib/landing/progress';
import { BrandedQr } from '@/components/chat/profile/BrandedQr';
import s from './Immersive.module.css';

/** The page root: starts the one scroll loop for every scene inside it. */
export function ScrollRoot({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => (ref.current ? startScenes(ref.current) : undefined), []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/** Mounts its children only once the scene that contains it comes near the screen. */
export function WhenNear({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setNear(true);
    let done = false;
    const off = onScene(ref.current, (_p, n) => {
      if (n && !done) {
        done = true;
        setNear(true);
      }
    });
    return off;
  }, []);
  return <div ref={ref} className={s.fill}>{near ? children : fallback}</div>;
}

type Mode = 'poster' | 'play' | 'scrub';
function pickMode(): Mode {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'poster';
  const c = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  const coarse = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900;
  if (coarse || c?.saveData || (c?.effectiveType && c.effectiveType !== '4g')) return 'play';
  return 'scrub';
}

/**
 * A decorative video tied to its scene. Desktop on a good connection: the all-intra file, its
 * currentTime eased toward the scene's progress with one seek in flight. Phones, Save-Data and
 * slow links: the playback file, looping while the scene is on screen. Reduced motion: the poster.
 */
export function SceneVideo({ play, scrub, poster, a = 0, b = 1, priority = false, label }: {
  play: string; scrub: string; poster: string; a?: number; b?: number; priority?: boolean; label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<Mode>('poster');
  const [near, setNear] = useState(false);

  useEffect(() => setMode(pickMode()), []);

  useEffect(() => {
    if (!box.current || mode === 'poster') return;
    let target = 0;
    let cur = Number.NaN;
    let inflight = false;
    let raf = 0;
    let last = 0;
    let isNear = false;
    const settle = () => {
      inflight = false;
      if (!raf && isNear) raf = requestAnimationFrame(step);
    };
    const step = (t: number) => {
      raf = 0;
      const v = vid.current;
      if (!v || !isNear || mode !== 'scrub') return;
      const dt = last ? t - last : 16;
      last = t;
      cur = approach(cur, target, dt, 45);
      if (!inflight && v.readyState >= 1 && Math.abs(v.currentTime - cur) > 0.02) {
        inflight = true;
        v.currentTime = cur;
        const rvfc = (v as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }).requestVideoFrameCallback;
        if (rvfc) rvfc.call(v, settle);
      }
      if (cur !== target || inflight) raf = requestAnimationFrame(step);
      else last = 0;
    };
    const onSeeked = () => settle();
    const off = onScene(box.current, (p, n) => {
      if (n !== isNear) {
        isNear = n;
        setNear(n);
        const v = vid.current;
        if (v && mode === 'play') (n ? v.play().catch(() => undefined) : v.pause());
      }
      const v = vid.current;
      if (mode === 'scrub' && v) {
        target = videoTime(p, v.duration, a, b);
        if (!raf && isNear) raf = requestAnimationFrame(step);
      }
    });
    const v = vid.current;
    v?.addEventListener('seeked', onSeeked);
    return () => {
      off();
      if (raf) cancelAnimationFrame(raf);
      v?.removeEventListener('seeked', onSeeked);
    };
  }, [mode, a, b, near]);

  const show = mode !== 'poster' && near;
  return (
    <div ref={box} className={s.video} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={poster} alt="" width={1920} height={1080} decoding="async" fetchPriority={priority ? 'high' : 'auto'} loading={priority ? 'eager' : 'lazy'} />
      {show && (
        <video
          ref={vid}
          key={mode}
          src={mode === 'scrub' ? scrub : play}
          poster={poster}
          muted
          playsInline
          loop={mode === 'play'}
          autoPlay={mode === 'play'}
          preload={mode === 'scrub' ? 'auto' : 'metadata'}
          disablePictureInPicture
          tabIndex={-1}
        />
      )}
      <span className={s.srOnly}>{label}</span>
    </div>
  );
}

/** A full hash in monospace that copies on click; links to the explorer when one is configured. */
export function CopyHash({ hash, href }: { hash: string; href?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(hash).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }).catch(() => undefined);
  };
  return (
    <span className={s.hash}>
      {href ? <a href={href} target="_blank" rel="noopener noreferrer">{hash}</a> : <code>{hash}</code>}
      <button type="button" onClick={copy} aria-label="Copy hash">{copied ? 'Copied' : 'Copy'}</button>
    </span>
  );
}

/** The real branded QR of the app, pointing at the site. */
export function SiteQr() {
  return <BrandedQr value="https://ledgerchat.org" title="Ledger Chat QR code for ledgerchat.org" className={s.qr} />;
}

const LivePhoneLazy = dynamic(() => import('@/components/landing/v2/PhoneShowcase').then((m) => m.LivePhone), {
  ssr: false,
  loading: () => <div className={s.phoneHold} />,
});
/** The LivePhone of /connect, hydrated when its scene comes near. */
export function ScenePhone({ id, screen, fill = 0.86 }: { id: string; screen?: string; fill?: number }) {
  return (
    <WhenNear fallback={<div className={s.phoneHold} />}>
      <LivePhoneLazy id={id} screen={screen} fill={fill} />
    </WhenNear>
  );
}

const GlobeLazy = dynamic(() => import('@/components/landing/v2/LiveGlobe').then((m) => m.LiveGlobe), {
  ssr: false,
  loading: () => <p className={s.muted}>Live numbers loading.</p>,
});
export function SceneGlobe() {
  return (
    <WhenNear fallback={<p className={s.muted}>Live numbers unavailable without JavaScript.</p>}>
      <GlobeLazy />
    </WhenNear>
  );
}

/** Bridges a Google OAuth session cookie once (kept from ClientRootRouter). */
export function SessionHeal() {
  useEffect(() => {
    try {
      if (document.cookie.split('; ').some((c) => c.startsWith('system_handshake=0x') || c.startsWith('system_handshake=email_'))) return;
    } catch {
      return;
    }
    fetch('/api/auth/session-heal', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.healed) window.dispatchEvent(new Event('storage'));
      })
      .catch(() => undefined);
  }, []);
  return null;
}
