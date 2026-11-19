'use client';
/**
 * DotWorld: the world as black dots on white, generated from Natural Earth 1:50m land (public
 * domain) into public/globe/flat-land.json (one degree, 15,351 points). Drawn on a canvas at the
 * box size × devicePixelRatio (up to 3, at most 8,192 px wide), so it stays sharp on a phone and on
 * an 8K screen. The full map is painted once; under the cursor (or a finger) only the dots near it
 * are redrawn: they grow, move slightly apart and turn violet, easing in and out. Places where
 * people are on Ledger Chat right now (GET /api/stats/live, by time zone, no IP stored) are
 * violet, steady, never pulsing.
 */
import React, { useEffect, useRef, useState } from 'react';
import s from './Immersive.module.css';

interface Land { step: number; latMax: number; lonMin: number; cols: number; rows: number[][] }
interface Dot { x: number; y: number; live: boolean }

const INK = [21, 23, 28];
const VIOLET = [82, 0, 255];
const mix = (t: number) => `rgb(${INK.map((c, i) => Math.round(c + (VIOLET[i] - c) * t)).join(',')})`;

export function DotWorld() {
  const box = useRef<HTMLDivElement>(null);
  const cvs = useRef<HTMLCanvasElement>(null);
  const [land, setLand] = useState<Land | null>(null);
  const [live, setLive] = useState<Array<{ lat: number; lon: number }>>([]);

  // Load the land mask (6 KB) and the live places once, on mount.
  useEffect(() => {
    const load = () => {
      fetch('/globe/flat-land.json')
        .then((r) => r.json())
        .then((d: Land) => { if (Array.isArray(d?.rows) && d.cols > 0) setLand(d); })
        .catch(() => undefined);
      fetch('/api/stats/live', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((d) => {
        const regions = Array.isArray(d?.regions) ? d.regions : [];
        setLive(regions.filter((x: { visitors?: number }) => (x.visitors ?? 0) > 0).map((x: { lat: number; lon: number }) => ({ lat: x.lat, lon: x.lon })));
      }).catch(() => undefined);
    };
    load();
  }, []);

  useEffect(() => {
    const el = box.current;
    const canvas = cvs.current;
    if (!el || !canvas || !land) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, dpr = 1, pitch = 1, rBase = 1, R = 100;
    let dots: Dot[] = [];
    let buckets = new Map<number, number[]>();
    const CELL = 40;
    const key = (cx: number, cy: number) => cx * 4096 + cy;

    const build = () => {
      W = el.clientWidth;
      H = el.clientHeight;
      if (!W || !H) return;
      dpr = Math.min(window.devicePixelRatio || 1, 3, 8192 / W);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      // One dot every ≥ 4.5 CSS px: every degree on a wide screen, every 2nd to 4th on a phone.
      const f = Math.max(1, Math.ceil(4.5 / (W / land.cols)));
      const cols = Math.floor(land.cols / f), rows = Math.floor(land.rows.length / f);
      const px = W / cols, py = H / rows;
      pitch = Math.min(px, py);
      rBase = pitch * 0.34;
      R = Math.max(70, Math.min(160, W * 0.07));
      const liveCells = new Set(live.map((p) => {
        const r = Math.round((land.latMax - p.lat) / land.step / f), c = Math.round((p.lon - land.lonMin) / land.step / f);
        return r * 10000 + c;
      }));
      dots = [];
      land.rows.forEach((runs, ri) => {
        if (ri % f) return;
        for (let k = 0; k < runs.length; k += 2) {
          for (let c = runs[k]; c < runs[k] + runs[k + 1]; c++) {
            if (c % f) continue;
            const r = ri / f, cc = c / f;
            dots.push({ x: (cc + 0.5) * px, y: (r + 0.5) * py, live: liveCells.has(r * 10000 + cc) });
          }
        }
      });
      buckets = new Map();
      dots.forEach((d, i) => {
        const k = key(Math.floor(d.x / CELL), Math.floor(d.y / CELL));
        const b = buckets.get(k);
        if (b) b.push(i); else buckets.set(k, [i]);
      });
      canvas.dataset.dots = String(dots.length);
      paint(0, 0, W, H, null, 0);
    };

    // Repaints one rectangle (CSS px): background, then every dot whose centre is in it.
    const paint = (x0: number, y0: number, x1: number, y1: number, at: { x: number; y: number } | null, k: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, y0, x1 - x0, y1 - y0);
      ctx.clip();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      const m = rBase * 3 + 8;
      for (let cx = Math.floor((x0 - m) / CELL); cx <= Math.floor((x1 + m) / CELL); cx++) {
        for (let cy = Math.floor((y0 - m) / CELL); cy <= Math.floor((y1 + m) / CELL); cy++) {
          const b = buckets.get(key(cx, cy));
          if (!b) continue;
          for (const i of b) {
            const d = dots[i];
            let x = d.x, y = d.y, rr = rBase, t = 0;
            if (at && k > 0) {
              const dx = d.x - at.x, dy = d.y - at.y, dist = Math.hypot(dx, dy);
              if (dist < R) {
                const u = 1 - dist / R;
                t = u * u * (3 - 2 * u) * k;
                rr = rBase * (1 + 0.85 * t);
                if (!reduced && dist > 0.001) { x += (dx / dist) * 7 * t; y += (dy / dist) * 7 * t; }
              }
            }
            ctx.fillStyle = d.live ? mix(1) : t > 0.01 ? mix(t) : '#15171c';
            ctx.beginPath();
            ctx.arc(x, y, d.live ? Math.max(rr, rBase * 1.35) : rr, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.restore();
    };

    // Pointer effect, eased: the hot spot follows the pointer and fades in and out.
    let target: { x: number; y: number } | null = null;
    let cur: { x: number; y: number } | null = null;
    let k = 0, raf = 0, last = 0;
    let prevBox: [number, number, number, number] | null = null;
    const tick = (t: number) => {
      raf = 0;
      const dt = last ? Math.min(64, t - last) : 16;
      last = t;
      const a = 1 - Math.pow(0.5, dt / 45);
      const goal = target ? 1 : 0;
      k += (goal - k) * a;
      if (Math.abs(goal - k) < 0.01) k = goal;
      if (target) cur = cur ? { x: cur.x + (target.x - cur.x) * a, y: cur.y + (target.y - cur.y) * a } : { ...target };
      if (cur) {
        const pad = R + rBase * 3 + 10;
        const bx: [number, number, number, number] = [cur.x - pad, cur.y - pad, cur.x + pad, cur.y + pad];
        const u = prevBox ? [Math.min(bx[0], prevBox[0]), Math.min(bx[1], prevBox[1]), Math.max(bx[2], prevBox[2]), Math.max(bx[3], prevBox[3])] : bx;
        paint(Math.max(0, u[0]), Math.max(0, u[1]), Math.min(W, u[2]), Math.min(H, u[3]), cur, k);
        prevBox = bx;
      }
      const moving = target && cur && Math.hypot(target.x - cur.x, target.y - cur.y) > 0.3;
      if (moving || k !== goal) raf = requestAnimationFrame(tick);
      else { last = 0; if (k === 0) { cur = null; prevBox = null; } }
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
    let releaseTimer = 0;
    const at = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      target = { x: e.clientX - r.left, y: e.clientY - r.top };
      window.clearTimeout(releaseTimer);
      if (e.pointerType !== 'mouse') releaseTimer = window.setTimeout(() => { target = null; kick(); }, 900);
      kick();
    };
    const leave = () => { target = null; kick(); };
    canvas.addEventListener('pointermove', at, { passive: true });
    canvas.addEventListener('pointerdown', at, { passive: true });
    canvas.addEventListener('pointerleave', leave, { passive: true });
    const ro = new ResizeObserver(() => build());
    ro.observe(el);
    build();
    return () => {
      ro.disconnect();
      canvas.removeEventListener('pointermove', at);
      canvas.removeEventListener('pointerdown', at);
      canvas.removeEventListener('pointerleave', leave);
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(releaseTimer);
    };
  }, [land, live]);

  return (
    <div ref={box} className={s.dotWorld}>
      <canvas ref={cvs} role="img" aria-label="Map of the world drawn in dots. Violet dots: places where people are on Ledger Chat right now." />
    </div>
  );
}
