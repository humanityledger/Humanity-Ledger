'use client';

/**
 * LiveGlobe — the landing page's live map: a lit 3D globe with the real numbers of Ledger Chat.
 *
 * Every figure comes from GET /api/stats/live (lib/stats/live.ts), refreshed every 15 s while the
 * map is on screen: accounts that signed in, @usernames reserved, and visits (one per page load;
 * until 19/11/2026 each browser once a day), placed by time zone. Nothing is seeded or estimated; a region lights up only where
 * someone came from. Drag to turn the globe; it turns by itself otherwise (not with reduced motion).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { LiveStats, LiveRegion } from '@/lib/stats/live';
import { networkLabel } from '@/lib/aztec/wallet/config';
import { isScrolling } from '@/lib/landing/scrollActivity';
import { useVisitBeacon } from '@/lib/stats/useVisitBeacon';
import s from './LiveGlobe.module.css';

const POLL_MS = 15_000;
const TILT = (18 * Math.PI) / 180;
const RAD = Math.PI / 180;

function useCountUp(target: number | null, ms = 900) {
  const [value, setValue] = useState(target ?? 0);
  const from = useRef(target ?? 0);
  useEffect(() => {
    if (target == null) return;
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setValue(Math.round(a + (target - a) * e));
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

const fmt = (n: number) => n.toLocaleString('en-US');
const place = (tz: string) => (tz.split('/').pop() || tz).replace(/_/g, ' ');
const since = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** `headless`: inside a page that gives the section its own id and title (the landing's Live chapter). */
export function LiveGlobe({ headless = false }: { headless?: boolean } = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(Date.now());
  const regionsRef = useRef<LiveRegion[]>([]);
  const flashRef = useRef<Map<string, number>>(new Map());
  const landRef = useRef<Float32Array | null>(null);
  const visibleRef = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/stats/live', { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const next: LiveStats = await res.json();
      // Regions whose count went up since the last refresh flash for a few seconds.
      const before = new Map(regionsRef.current.map((r) => [r.tz, r.visitors]));
      const t = performance.now();
      for (const r of next.regions) if (before.size && r.visitors > (before.get(r.tz) ?? 0)) flashRef.current.set(r.tz, t);
      regionsRef.current = next.regions;
      setStats(next);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useVisitBeacon(load);

  useEffect(() => {
    load();
    const id = setInterval(() => { if (visibleRef.current && document.visibilityState === 'visible') load(); }, POLL_MS);
    const clock = setInterval(() => setNow(Date.now()), 1_000);
    return () => { clearInterval(id); clearInterval(clock); };
  }, [load]);

  // Land dots, once.
  useEffect(() => {
    fetch('/globe/land-dots.json')
      .then((r) => r.json())
      .then((pts: Array<[number, number]>) => {
        const a = new Float32Array(pts.length * 3);
        pts.forEach(([lat, lon], i) => {
          const p = lat * RAD, l = lon * RAD;
          a[i * 3] = Math.cos(p) * Math.sin(l);
          a[i * 3 + 1] = Math.sin(p);
          a[i * 3 + 2] = Math.cos(p) * Math.cos(l);
        });
        landRef.current = a;
      })
      .catch(() => {});
  }, []);

  // The globe.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let spin = -10 * RAD; // start over Europe and Africa
    let dragging = false;
    let lastX = 0;
    let velocity = reduced ? 0 : 0.0016;
    let raf = 0;
    let size = 0;
    let dpr = 1;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      size = wrap.clientWidth;
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const io = new IntersectionObserver(([e]) => { visibleRef.current = e.isIntersecting; }, { threshold: 0.05 });
    io.observe(wrap);

    // World point (x, y, z) to screen, after turning by `spin` and tilting by TILT.
    const cosT = Math.cos(TILT), sinT = Math.sin(TILT);
    const project = (x: number, y: number, z: number, cosS: number, sinS: number, R: number, c: number) => {
      const x1 = x * cosS + z * sinS;
      const z1 = -x * sinS + z * cosS;
      const y2 = y * cosT - z1 * sinT;
      const z2 = y * sinT + z1 * cosT;
      return [c + x1 * R, c - y2 * R, z2] as const;
    };

    let lastDraw = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (!visibleRef.current) return;
      // Canvas 2D: nothing drawn while the visitor scrolls, and at most 60 frames a second.
      if (isScrolling() || t - lastDraw < 16) return;
      lastDraw = t;
      if (!dragging) spin += velocity;
      const W = canvas.width;
      const c = W / 2;
      const R = W * 0.4;
      const cosS = Math.cos(spin), sinS = Math.sin(spin);
      ctx.clearRect(0, 0, W, W);

      // Atmosphere.
      const atm = ctx.createRadialGradient(c, c, R * 0.92, c, c, R * 1.22);
      atm.addColorStop(0, 'rgba(124,77,255,0.28)');
      atm.addColorStop(0.45, 'rgba(124,77,255,0.10)');
      atm.addColorStop(1, 'rgba(124,77,255,0)');
      ctx.fillStyle = atm;
      ctx.beginPath(); ctx.arc(c, c, R * 1.22, 0, Math.PI * 2); ctx.fill();

      // Sphere, lit from the upper left.
      const body = ctx.createRadialGradient(c - R * 0.4, c - R * 0.45, R * 0.05, c, c, R);
      body.addColorStop(0, '#FFFFFF');
      body.addColorStop(0.55, '#F3F0FF');
      body.addColorStop(1, '#DCD3FA');
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(82,0,255,0.28)';
      ctx.lineWidth = 1.2 * dpr;
      ctx.stroke();

      // Graticule.
      ctx.strokeStyle = 'rgba(82,0,255,0.08)';
      ctx.lineWidth = 1 * dpr;
      for (let lon = -180; lon < 180; lon += 30) {
        ctx.beginPath();
        let on = false;
        for (let lat = -90; lat <= 90; lat += 3) {
          const p = lat * RAD, l = lon * RAD;
          const [sx, sy, sz] = project(Math.cos(p) * Math.sin(l), Math.sin(p), Math.cos(p) * Math.cos(l), cosS, sinS, R, c);
          if (sz > 0) { if (on) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy); on = true; } else on = false;
        }
        ctx.stroke();
      }
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath();
        let on = false;
        for (let lon = -180; lon <= 180; lon += 3) {
          const p = lat * RAD, l = lon * RAD;
          const [sx, sy, sz] = project(Math.cos(p) * Math.sin(l), Math.sin(p), Math.cos(p) * Math.cos(l), cosS, sinS, R, c);
          if (sz > 0) { if (on) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy); on = true; } else on = false;
        }
        ctx.stroke();
      }

      // Land.
      const land = landRef.current;
      if (land) {
        const dot = Math.max(0.9, W / 520);
        for (let i = 0; i < land.length; i += 3) {
          const [sx, sy, sz] = project(land[i], land[i + 1], land[i + 2], cosS, sinS, R, c);
          if (sz <= 0.02) continue;
          ctx.fillStyle = `rgba(82,0,255,${(0.18 + 0.62 * sz).toFixed(3)})`;
          ctx.beginPath(); ctx.arc(sx, sy, dot * (0.55 + 0.6 * sz), 0, Math.PI * 2); ctx.fill();
        }
      }

      // Where people came from: real visitor counts, lit.
      const regions = regionsRef.current;
      const top = regions.length ? regions[0].visitors : 1;
      for (const r of regions) {
        const p = r.lat * RAD, l = r.lon * RAD;
        const [sx, sy, sz] = project(Math.cos(p) * Math.sin(l), Math.sin(p), Math.cos(p) * Math.cos(l), cosS, sinS, R, c);
        if (sz <= 0) continue;
        const weight = Math.log2(1 + r.visitors) / Math.log2(1 + top);
        const flashAt = flashRef.current.get(r.tz);
        const flash = flashAt ? Math.max(0, 1 - (t - flashAt) / 4000) : 0;
        if (flashAt && flash === 0) flashRef.current.delete(r.tz);
        const pulse = reduced ? 0 : 0.12 * Math.sin(t / 700 + r.lat);
        const glowR = R * (0.07 + 0.13 * weight) * (1 + pulse + flash * 1.2) * (0.55 + 0.45 * sz);
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
        g.addColorStop(0, `rgba(82,0,255,${Math.min(0.85, 0.6 * sz + 0.3 * flash).toFixed(3)})`);
        g.addColorStop(0.25, `rgba(110,60,255,${(0.32 * sz).toFixed(3)})`);
        g.addColorStop(0.6, `rgba(150,120,255,${(0.12 * sz).toFixed(3)})`);
        g.addColorStop(1, 'rgba(124,77,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(sx, sy, glowR, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(sx, sy, Math.max(2.2 * dpr, glowR * 0.1), 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#5200FF';
        ctx.lineWidth = 1.4 * dpr;
        ctx.stroke();
      }
    };
    raf = requestAnimationFrame(draw);

    const down = (e: PointerEvent) => { dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      spin += (dx / Math.max(size, 1)) * Math.PI;
    };
    const up = () => { dragging = false; };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
    };
  }, []);

  const accounts = useCountUp(stats?.accounts ?? null);
  const usernames = useCountUp(stats?.usernames ?? null);
  const visitors = useCountUp(stats?.visitors ?? null);
  const ago = stats ? Math.max(0, Math.round((now - stats.updatedAt) / 1000)) : null;
  const topRegions = (stats?.regions ?? []).slice(0, 5);

  return (
    <Wrap headless={headless}>
      <div className={s.head}>
        <p className={s.eyebrow} role="status">
          <span className={`${s.live} ${error ? s.liveOff : ''}`} aria-hidden="true" />
          {error ? 'Live numbers unavailable, retrying' : `Live${ago != null ? ` · updated ${ago < 5 ? 'just now' : `${ago} s ago`}` : ''}`}
        </p>
        {!headless && (
          <h2 id="live-title" className={s.h2}>
            People on Ledger Chat. <em>Right now.</em>
          </h2>
        )}
      </div>

      <div className={s.grid}>
        <div ref={wrapRef} className={s.globe}>
          <canvas ref={canvasRef} role="img" aria-label={`Globe lit where visits came from${topRegions.length ? `: ${topRegions.map((r) => place(r.tz)).join(', ')}` : ''}`} />
        </div>

        <div className={s.numbers}>
          <dl className={s.stats}>
            <div>
              <dt>Accounts</dt>
              <dd data-testid="live-accounts">{stats ? fmt(accounts) : '–'}</dd>
              <p>Wallets that have signed in.</p>
            </div>
            <div>
              <dt>@usernames</dt>
              <dd data-testid="live-usernames">{stats ? fmt(usernames) : '–'}</dd>
              <p>Reserved, each one unique.</p>
            </div>
            <div>
              <dt>Visits</dt>
              <dd data-testid="live-visitors">{stats ? fmt(visitors) : '–'}</dd>
              <p>{stats ? `${fmt(stats.visitorsToday)} today · since ${since(stats.countedSince)}` : 'One per page load.'}</p>
            </div>
            {stats?.clones && (
              <div>
                <dt>Repository clones</dt>
                <dd>{fmt(stats.clones.count)}</dd>
                <p>{fmt(stats.clones.uniques)} unique, last {stats.clones.days} days (GitHub).</p>
              </div>
            )}
            {stats && (
              <div>
                <dt>{networkLabel()} block</dt>
                <dd data-testid="live-aztec-block">{stats.aztecBlock != null ? fmt(stats.aztecBlock) : '–'}</dd>
                <p>{stats.aztecBlock != null ? 'Read from the node every 10 s.' : 'Aztec block unavailable'}</p>
              </div>
            )}
          </dl>

          {topRegions.length > 0 && (
            <ol className={s.regions} aria-label="Where visits came from">
              {topRegions.map((r) => (
                <li key={r.tz}>
                  <span>{place(r.tz)}</span>
                  <b>{fmt(r.visitors)}</b>
                </li>
              ))}
            </ol>
          )}

          <p className={s.note}>
            Counted from our database, not estimated. A visit is a page load, placed by the time zone the browser reports. Nothing is stored in your browser and no IP address is kept beyond a one-minute rate limit. Until 19 Nov 2026 a browser counted once a day. Visits are counted from {stats ? since(stats.countedSince) : '18 Nov 2026'}.
          </p>
        </div>
      </div>
    </Wrap>
  );
}

function Wrap({ headless, children }: { headless: boolean; children: React.ReactNode }) {
  return headless
    ? <div className={`${s.section} ${s.headless}`}>{children}</div>
    : <section id="live" className={s.section} aria-labelledby="live-title">{children}</section>;
}

export default LiveGlobe;
