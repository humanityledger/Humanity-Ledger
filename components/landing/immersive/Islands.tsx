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
  // Fetch the live phone's code while the hand film plays, so the phone that replaces the film is
  // ready by the time the visitor scrolls there, even on a slow mobile network.
  useEffect(() => {
    const load = () => { void loadPhone(); };
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(load, { timeout: 1500 });
    else window.setTimeout(load, 600);
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/** Mounts its children once they come within two screens of the viewport (hydration only, never an animation). */
export function WhenNear({ children, fallback = null, fill = true }: { children: React.ReactNode; fallback?: React.ReactNode; fill?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') return setNear(true);
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        setNear(true);
        io.disconnect();
      }
    }, { rootMargin: '200% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={fill ? s.fill : undefined}>{near ? children : fallback}</div>;
}

type Mode = 'poster' | 'play' | 'scrub';
function pickMode(): Mode {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'poster';
  // Scroll-scrubbing on desktops with a fine pointer. On phones and tablets the film plays (loops
  // while its scene is on screen): seeking a video on every frame of a finger flick stalls iOS
  // Safari and shows blank frames; the scene itself still moves with the scroll.
  const c = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  const touch = window.matchMedia('(pointer: coarse)').matches;
  if (touch || c?.saveData || (c?.effectiveType && c.effectiveType !== '4g')) return 'play';
  return 'scrub';
}

/**
 * A decorative video tied to its scene. Desktop on a good connection: the all-intra file, its
 * currentTime eased toward the scene's progress with one seek in flight. Phones, Save-Data and
 * slow links: the playback file, looping while the scene is on screen. Reduced motion: the poster.
 * Once created, the video stays mounted, so scrolling back up never re-buffers or flashes.
 */
export function SceneVideo({ play, scrub, poster, a = 0, b = 1, priority = false, label }: {
  play: string; scrub: string; poster: string; a?: number; b?: number; priority?: boolean; label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<Mode>('poster');
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMode(pickMode()), []);

  // Mount the video the first time its scene comes near.
  useEffect(() => {
    if (!box.current || mode === 'poster' || mounted) return;
    return onScene(box.current, (_p, near) => {
      if (near) setMounted(true);
    });
  }, [mode, mounted]);

  useEffect(() => {
    const v = vid.current;
    if (!box.current || !v || mode === 'poster' || !mounted) return;
    // iOS autoplays only a video that is muted as an attribute, not just as a property.
    v.muted = true;
    v.defaultMuted = true;
    v.setAttribute('muted', '');
    // iOS loads only metadata until a video has played once: prime it, then seek freely.
    if (mode === 'scrub') v.play().then(() => v.pause()).catch(() => undefined);
    let progress = 0;
    let target = 0;
    let cur = Number.NaN;
    let inflight = false;
    let raf = 0;
    let last = 0;
    let isNear = false;
    const kick = () => {
      if (!raf && isNear && mode === 'scrub') raf = requestAnimationFrame(step);
    };
    const settle = () => {
      inflight = false;
      kick();
    };
    const step = (t: number) => {
      raf = 0;
      if (!isNear) return;
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
    const retarget = () => {
      target = videoTime(progress, v.duration, a, b);
      kick();
    };
    const off = onScene(box.current, (p, n) => {
      progress = p;
      if (n !== isNear) {
        isNear = n;
        if (mode === 'play') (n ? v.play().catch(() => undefined) : v.pause());
      }
      if (mode === 'scrub') retarget();
    });
    v.addEventListener('seeked', settle);
    v.addEventListener('loadedmetadata', retarget);
    return () => {
      off();
      if (raf) cancelAnimationFrame(raf);
      v.removeEventListener('seeked', settle);
      v.removeEventListener('loadedmetadata', retarget);
    };
  }, [mode, mounted, a, b]);

  const show = mode !== 'poster' && mounted;
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
          disableRemotePlayback
          tabIndex={-1}
        />
      )}
      <span className={s.srOnly}>{label}</span>
    </div>
  );
}

/** Truncated in the middle, like 0x1eb2bb76…40a5. */
const shortHash = (h: string) => `${h.slice(0, 10)}…${h.slice(-4)}`;

/** A hash shortened for reading, copied in full on click, linked to the explorer when one is configured. */
export function CopyHash({ hash, label, href }: { hash: string; label: string; href?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(hash).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }).catch(() => undefined);
  };
  return (
    <div className={s.hash}>
      <span className={s.hashLabel}>{label}</span>
      <code title={hash}>{shortHash(hash)}</code>
      <button type="button" onClick={copy} aria-label={`Copy the full ${label.toLowerCase()}`} data-copied={copied || undefined}>
        {copied ? 'Copied' : 'Copy'}
      </button>
      <span className={s.srOnly} role="status">{copied ? `${label} copied` : ''}</span>
      {href && <a href={href} target="_blank" rel="noopener noreferrer">Explorer</a>}
    </div>
  );
}

/** The real branded QR of the app, pointing at the site. */
export function SiteQr() {
  return <BrandedQr value="https://ledgerchat.org" title="Ledger Chat QR code for ledgerchat.org" className={s.qr} />;
}

const loadPhone = () => import('@/components/landing/v2/PhoneShowcase');
const LivePhoneLazy = dynamic(() => loadPhone().then((m) => m.LivePhone), {
  ssr: false,
  loading: () => <div className={s.phoneHold} />,
});
/** The LivePhone of /connect, hydrated when its scene comes near. */
export function ScenePhone({ id, screen, fill = 0.86 }: { id: string; screen?: string; fill?: number }) {
  return (
    <WhenNear fallback={<div className={s.phoneHold} />}>
      <LivePhoneLazy id={id} screen={screen} fill={fill} bare settled />
    </WhenNear>
  );
}

const GlobeLazy = dynamic(() => import('@/components/landing/v2/LiveGlobe').then((m) => m.LiveGlobe), {
  ssr: false,
  loading: () => <p className={s.muted}>Live numbers loading.</p>,
});
export function SceneGlobe() {
  return (
    <WhenNear fill={false} fallback={<p className={s.muted}>Live numbers unavailable without JavaScript.</p>}>
      <GlobeLazy headless />
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

/**
 * /?debug=scroll: what the scroll engine sees, on screen only (nothing is sent anywhere). The
 * element that scrolls, scrollTop, the viewport heights (innerHeight, visualViewport, svh, lvh),
 * --p and --in of the scenes in view, and frames longer than 50 ms. For diagnosing phones.
 */
export function ScrollDebug() {
  const [on, setOn] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('debug') !== 'scroll') return;
    setOn(true);
    const probe = (unit: string) => {
      const d = document.createElement('div');
      d.style.cssText = `position:fixed;top:0;left:0;width:1px;height:100${unit};visibility:hidden;pointer-events:none`;
      document.body.appendChild(d);
      const h = d.getBoundingClientRect().height;
      d.remove();
      return Math.round(h);
    };
    let raf = 0;
    let last = 0;
    let long = 0;
    const tick = (t: number) => {
      if (last && t - last > 50) long++;
      last = t;
      const main = document.querySelector('main');
      const doc = document.scrollingElement as HTMLElement | null;
      const scroller = main && main.scrollHeight > main.clientHeight + 1 && getComputedStyle(main).overflowY !== 'visible' ? main : doc;
      const scenes = Array.from(document.querySelectorAll<HTMLElement>('[data-scene]'))
        .filter((s) => { const r = s.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; })
        .map((s) => `${(s.getAttribute('aria-label') || '?').slice(0, 14)} p=${s.style.getPropertyValue('--p') || '-'} in=${s.style.getPropertyValue('--in') || '-'}`);
      setLines([
        `scroller ${scroller?.tagName ?? '?'} top ${Math.round(scroller?.scrollTop ?? 0)}`,
        `inner ${innerHeight} vv ${Math.round(window.visualViewport?.height ?? 0)} svh ${probe('svh')} lvh ${probe('lvh')}`,
        `frames >50ms: ${long}`,
        ...scenes,
      ]);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  if (!on) return null;
  return (
    <pre aria-hidden="true" style={{ position: 'fixed', zIndex: 100, left: 8, bottom: 8, margin: 0, padding: 8, maxWidth: 'calc(100vw - 16px)', font: '11px/1.4 ui-monospace, monospace', color: '#15171C', background: 'rgba(247,248,250,0.92)', border: '1px solid #E4E7EC', borderRadius: 12, pointerEvents: 'none', whiteSpace: 'pre-wrap' }}>
      {lines.join('\n')}
    </pre>
  );
}
