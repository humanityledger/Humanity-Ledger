'use client';
/**
 * G8 HumanGate on /connect. The board is the Ledger Chat avatar mosaic itself:
 * 10 × 10 squares (components/chat/WalletGlyph.tsx), its pattern and ink drawn
 * from this challenge's seed, so every check looks like a new avatar. A light
 * glides over the squares along the server's seeded path; the person keeps a
 * pointer or finger on it for about 1.5 s while a proof of work runs in a
 * worker. The server replays the path and decides (lib/g8/humanGate.ts).
 * Keyboard and screen-reader alternative: four timed pulses.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CircleCheck, Keyboard, MousePointer2, RefreshCw } from 'lucide-react';
import { useT } from '@/lib/i18n/client';
import { walletCells } from '@/components/chat/WalletGlyph';
import {
  HG_HALO, HG_HOLD_MS, HG_MIN_SAMPLES, HG_SIDE, HG_SUSTAIN_MS, RHYTHM_PULSE_MS,
  cellAt, evalTargetAt, pathParams, rhythmPulses, type HumanGateMode, type PathParams, type Sample,
} from '@/lib/g8/humanGateMath';
import { fetchChallenge, solvePow, submitAttempt, type Challenge } from '@/lib/g8/humanGateClient';
import s from './HumanGateCard.module.css';

const BOARD = 220;
const PAD = 14;
const GREEN = [21, 128, 61] as const; // #15803d
type Phase = 'loading' | 'ready' | 'tracking' | 'checking' | 'passed' | 'failed' | 'unavailable';

function inkFromSeed(seed: string): [number, number, number] {
  // hsl(h 38% 30%), as walletInk() does for avatars
  const h = (parseInt(seed.slice(0, 6), 16) % 360) / 360, sat = 0.38, l = 0.3;
  const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat, p = 2 * l - q;
  const f = (t: number) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
}
const mix = (a: readonly number[], b: readonly number[], k: number) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function HumanGateCard({ onPassed }: { onPassed: () => void }) {
  const t = useT();
  const [mode, setMode] = useState<HumanGateMode>(() => (prefersReducedMotion() ? 'accessible-rhythm' : 'orbit'));
  const [phase, setPhase] = useState<Phase>('loading');
  const [progress, setProgress] = useState(0);
  const [hits, setHits] = useState(0);
  const [lit, setLit] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const run = useRef<{
    ch: Challenge; params: PathParams; cells: boolean[]; ink: [number, number, number];
    pow: Promise<string>; abort: AbortController; t0: number; samples: Sample[]; untrusted: number; coalesced: number;
    pointer: { x: number; y: number } | null; prog: number; segStart: number | null; lastTs: number; raf: number;
    presses: number[]; pulses: number[]; started: boolean; done: boolean; success: number;
  } | null>(null);

  const finish = useCallback(async () => {
    const r = run.current;
    if (!r || r.done) return;
    r.done = true;
    setPhase('checking');
    try {
      const powNonce = await r.pow;
      const from = Math.max(0, (r.segStart ?? 0) - 20);
      const ok = await submitAttempt({
        challenge: r.ch, powNonce, trustedRatio: r.untrusted ? 0 : 1, coalescedCount: r.coalesced,
        ...(r.ch.mode === 'orbit' ? { samples: r.samples.slice(from).slice(-1800) } : { presses: r.presses }),
      });
      if (!ok) { setPhase('failed'); return; }
      r.success = performance.now();
      setPhase('passed');
      setTimeout(onPassed, prefersReducedMotion() ? 250 : 900);
    } catch { setPhase('failed'); }
  }, [onPassed]);

  const start = useCallback(async (m: HumanGateMode) => {
    run.current?.abort.abort();
    if (run.current) cancelAnimationFrame(run.current.raf);
    run.current = null;
    setPhase('loading'); setProgress(0); setHits(0); setLit(false);
    try {
      const ch = await fetchChallenge(m);
      const abort = new AbortController();
      const pow = solvePow(ch.seedHex, ch.difficulty, abort.signal);
      pow.catch(() => {});
      run.current = {
        ch, params: pathParams(ch.seedHex), cells: walletCells('0x' + ch.seedHex.slice(0, 40)), ink: inkFromSeed(ch.seedHex.slice(40)),
        pow, abort, t0: performance.now(), samples: [], untrusted: 0, coalesced: 0, pointer: null, prog: 0, segStart: null,
        lastTs: performance.now(), raf: 0, presses: [], pulses: rhythmPulses(ch.seedHex), started: m === 'orbit', done: false, success: 0,
      };
      setPhase(m === 'orbit' ? 'tracking' : 'ready');
    } catch { setPhase('unavailable'); }
  }, []);

  useEffect(() => { void start(mode); return () => { run.current?.abort.abort(); if (run.current) cancelAnimationFrame(run.current.raf); }; }, [mode, start]);

  /* ── drawing loop ─────────────────────────────────────────────────────── */
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = BOARD * dpr; cv.height = BOARD * dpr;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const grid = BOARD - PAD * 2, cell = grid / HG_SIDE, gap = 2.4, reduced = prefersReducedMotion();
    let raf = 0, lastProgress = -1;
    const rrect = (x: number, y: number, w: number, h: number, rad: number) => {
      ctx.beginPath();
      if (typeof (ctx as any).roundRect === 'function') (ctx as any).roundRect(x, y, w, h, rad); else ctx.rect(x, y, w, h);
    };

    const frame = () => {
      const r = run.current;
      const now = performance.now();
      ctx.clearRect(0, 0, BOARD, BOARD);
      const ink = r?.ink ?? [60, 64, 72];
      const cells = r?.cells ?? Array(100).fill(false);
      let target: { x: number; y: number } | null = null;
      if (r && r.ch.mode === 'orbit' && phase === 'tracking') target = evalTargetAt(r.params, now - r.t0);
      if (r && r.ch.mode === 'orbit' && (phase === 'checking' || phase === 'failed')) target = evalTargetAt(r.params, now - r.t0);

      // progress bookkeeping (tracking only)
      if (r && target && phase === 'tracking') {
        const dt = Math.min(64, now - r.lastTs);
        const p = r.pointer;
        let on = false;
        if (p) for (let L = 0; L <= 400 && !on; L += 80) { const q = evalTargetAt(r.params, now - r.t0 - L); on = Math.hypot(p.x - q.x, p.y - q.y) <= HG_HALO * 1.1; }
        if (on) { if (r.segStart === null) r.segStart = r.samples.length; r.prog = Math.min(HG_HOLD_MS, r.prog + dt); }
        else { r.prog = Math.max(0, r.prog - dt * 1.4); if (r.prog === 0) r.segStart = null; }
        const seg = r.segStart !== null ? r.samples.slice(r.segStart) : [];
        if (r.prog >= HG_HOLD_MS && seg.length >= HG_MIN_SAMPLES && seg[seg.length - 1].tMs - seg[0].tMs >= HG_SUSTAIN_MS + 40) void finish();
        const pr = Math.round((r.prog / HG_HOLD_MS) * 50) / 50;
        if (pr !== lastProgress) { lastProgress = pr; setProgress(pr); }
      }
      if (r) r.lastTs = now;

      const k = phase === 'passed' ? 1 : (r?.prog ?? 0) / HG_HOLD_MS;
      const center = { x: 0.5, y: 0.5 };
      for (let i = 0; i < 100; i++) {
        const cx = (i % HG_SIDE + 0.5) / HG_SIDE, cy = (Math.floor(i / HG_SIDE) + 0.5) / HG_SIDE;
        let alpha = cells[i] ? 0.17 : 0.075;
        let color: readonly number[] = ink;
        if (target) {
          const d = Math.hypot(cx - target.x, cy - target.y);
          const glow = Math.exp(-((d / 0.085) ** 2));
          alpha = Math.min(1, alpha + glow * 0.88);
          if (cellAt(target.x, target.y) === i) alpha = 1;
          if (glow > 0.05) color = mix(ink, GREEN, k * 0.9);
        }
        if (r?.ch.mode === 'accessible-rhythm' && lit) alpha = Math.max(alpha, cells[i] ? 0.95 : 0.45);
        if (phase === 'passed' && r) {
          const wave = reduced ? 1 : Math.min(1, Math.max(0, ((now - r.success) - Math.hypot(cx - center.x, cy - center.y) * 700) / 220));
          color = mix(color, GREEN, wave); alpha = alpha + (Math.max(alpha, cells[i] ? 1 : 0.32) - alpha) * wave;
        }
        ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${alpha.toFixed(3)})`;
        const x = PAD + (i % HG_SIDE) * cell + gap / 2, y = PAD + Math.floor(i / HG_SIDE) * cell + gap / 2;
        rrect(x, y, cell - gap, cell - gap, 3.2); ctx.fill();
      }
      // pointer marker
      if (r?.pointer && phase === 'tracking') {
        ctx.strokeStyle = 'rgba(21,23,28,.55)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(PAD + r.pointer.x * grid, PAD + r.pointer.y * grid, 9, 0, Math.PI * 2); ctx.stroke();
      }
      // progress along the board's edge
      if (k > 0) {
        const c = mix(ink, GREEN, k);
        ctx.strokeStyle = `rgb(${c[0]},${c[1]},${c[2]})`; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        const per = (BOARD - 5) * 4;
        ctx.setLineDash([per * Math.min(1, k), per]);
        rrect(2.5, 2.5, BOARD - 5, BOARD - 5, 22); ctx.stroke(); ctx.setLineDash([]);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase, lit, finish]);

  /* ── pointer input (orbit) ─────────────────────────────────────────────── */
  const onPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = run.current;
    if (!r || r.ch.mode !== 'orbit' || phase !== 'tracking') return;
    if (e.type === 'pointerdown') { try { e.currentTarget.setPointerCapture(e.pointerId); } catch {} }
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = BOARD / rect.width, grid = BOARD - PAD * 2;
    const native = e.nativeEvent as PointerEvent;
    const list = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : [];
    const events = list.length ? list : [native];
    if (list.length > 1) r.coalesced += list.length - 1;
    if (!e.isTrusted || !native.isTrusted) r.untrusted++;
    for (const ev of events) {
      const x = ((ev.clientX - rect.left) * scale - PAD) / grid, y = ((ev.clientY - rect.top) * scale - PAD) / grid;
      const tMs = Math.round((ev.timeStamp - r.t0) * 10) / 10;
      const last = r.samples[r.samples.length - 1];
      if (last && tMs <= last.tMs) continue;
      r.samples.push({ tMs, x, y });
      if (r.samples.length > 4000) { r.samples.splice(0, 1000); if (r.segStart !== null) r.segStart = Math.max(0, r.segStart - 1000); }
      r.pointer = { x, y };
    }
  };
  const onLeave = () => { if (run.current) run.current.pointer = null; };

  /* ── keyboard / screen reader (accessible-rhythm) ──────────────────────── */
  const beep = useRef<AudioContext | null>(null);
  const startRhythm = () => {
    const r = run.current;
    if (!r || r.ch.mode !== 'accessible-rhythm' || r.started) return;
    r.started = true; r.t0 = performance.now();
    try { beep.current = beep.current ?? new AudioContext(); } catch {}
    setPhase('tracking');
    const tick = () => {
      const q = run.current;
      if (!q || q.done) return;
      const el = performance.now() - q.t0;
      const on = q.pulses.some(p => el >= p && el < p + RHYTHM_PULSE_MS);
      setLit(prev => {
        if (on && !prev && beep.current) { try { const o = beep.current.createOscillator(), g = beep.current.createGain(); o.frequency.value = 660; g.gain.value = 0.06; o.connect(g).connect(beep.current.destination); o.start(); o.stop(beep.current.currentTime + 0.12); } catch {} }
        return on;
      });
      if (el > q.pulses[3] + 1700) { void finish(); return; }
      q.raf = requestAnimationFrame(tick);
    };
    r.raf = requestAnimationFrame(tick);
  };
  const press = (e: React.PointerEvent | React.KeyboardEvent) => {
    const r = run.current;
    if (!r || r.ch.mode !== 'accessible-rhythm') return;
    if ('key' in e) { if (e.key !== ' ' && e.key !== 'Enter') return; e.preventDefault(); if (e.repeat) return; }
    if (!r.started) { startRhythm(); return; }
    if (r.done) return;
    if (!e.isTrusted) r.untrusted++;
    r.presses.push(Math.round(e.timeStamp - r.t0));
    setHits(h => Math.min(4, h + 1));
    if (r.presses.length >= 6) void finish();
  };

  const status =
    phase === 'loading' ? t('Preparing your check…') :
    phase === 'unavailable' ? t('The check could not start. Check your connection and try again.') :
    phase === 'checking' ? t('Checking…') :
    phase === 'passed' ? t('Human presence verified') :
    phase === 'failed' ? t('We could not confirm it. Try a new pulse.') :
    mode === 'orbit' ? t('Keep your pointer or finger on the lit square') :
    phase === 'ready' ? t('Press Space or the button to begin. Then press it each time the board lights up and you hear a tone.') :
    lit ? t('Now') : t('Pulse {n} of 4', { n: Math.min(4, hits + 1) });

  return (
    <div className={s.card} data-phase={phase}>
      <p className={s.kicker}>{t('Human presence check')}</p>
      <h1 className={s.title}>{phase === 'passed' ? t('Thanks, you are in') : t('Show you are here')}</h1>
      <p className={s.subtitle}>{t('A quick check that keeps bots out of Ledger Chat. It runs on this page and our server only — no third parties, no tracking.')}</p>

      <div className={s.boardWrap}>
        <canvas
          ref={canvasRef}
          className={s.board}
          width={BOARD}
          height={BOARD}
          role="img"
          aria-label={mode === 'orbit' ? t('A 10 by 10 board of squares with one moving light') : t('A 10 by 10 board of squares that lights up four times')}
          onPointerDown={onPointer}
          onPointerMove={onPointer}
          onPointerLeave={onLeave}
          onPointerCancel={onLeave}
        />
        {phase === 'passed' && <span className={s.check} aria-hidden="true"><CircleCheck size={44} strokeWidth={1.6} /></span>}
      </div>

      <p className={s.status} role="status" aria-live="polite">{status}</p>
      {mode === 'orbit' && phase === 'tracking' && (
        <div className={s.meter} aria-hidden="true"><span style={{ width: `${Math.round(progress * 100)}%` }} /></div>
      )}

      {mode === 'accessible-rhythm' && (phase === 'ready' || phase === 'tracking') && (
        <button type="button" className={`${s.pulseBtn} ${lit ? s.pulseOn : ''}`} onPointerDown={press} onKeyDown={press} autoFocus>
          {phase === 'ready' ? t('Begin') : lit ? t('Press now') : t('Press when it lights up')}
          <span className={s.dots} aria-hidden="true">{[0, 1, 2, 3].map(i => <i key={i} className={i < hits ? s.dotOn : ''} />)}</span>
        </button>
      )}

      {(phase === 'failed' || phase === 'unavailable') && (
        <button type="button" className={s.primary} onClick={() => void start(mode)}>
          <RefreshCw size={16} strokeWidth={1.9} aria-hidden="true" /> {t('Try a new pulse')}
        </button>
      )}

      {phase !== 'passed' && phase !== 'checking' && (
        <button type="button" className={s.switch} onClick={() => setMode(m => (m === 'orbit' ? 'accessible-rhythm' : 'orbit'))}>
          {mode === 'orbit'
            ? <><Keyboard size={15} strokeWidth={1.9} aria-hidden="true" /> {t('Accessible keyboard check')}</>
            : <><MousePointer2 size={15} strokeWidth={1.9} aria-hidden="true" /> {t('Use the moving square instead')}</>}
        </button>
      )}
    </div>
  );
}
