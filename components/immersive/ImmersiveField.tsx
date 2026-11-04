"use client";

import React, { useEffect, useRef } from "react";
import s from "./Immersive.module.css";

/**
 * ImmersiveField — the living background of the public pages and the app.
 *
 * Three layers, back to front:
 *   1. a paper gradient (cool at the top, warm at the bottom);
 *   2. an aurora of soft blue light that drifts slowly and leans toward the
 *      cursor (CSS, driven by --ax / --ay);
 *   3. a lattice of fine dots, drawn on a canvas, that swells and darkens
 *      around the cursor like a lens, and breathes with a slow noise field.
 *      The dots echo the dotted world map of the Humanity Ledger mark.
 *
 * It also lights cards: any element with `data-glow` gets --gx / --gy set
 * to the pointer position inside it, which Immersive.module.css turns into a
 * soft spotlight and a brighter rim (see `.glow`).
 *
 * Costs: one canvas, one rAF loop at ~30 fps that stops when the tab is
 * hidden, when nothing moves, and entirely under prefers-reduced-motion
 * (then a single static frame is drawn). Touch screens get the static field
 * plus the CSS drift. pointer-events: none, aria-hidden.
 */

type Variant = "page" | "app" | "quiet";

export interface ImmersiveFieldProps {
  /** page: landing, /connect, docs. app: behind Ledger Chat (fainter). quiet: barely there. */
  variant?: Variant;
  /** Fixed to the viewport (default) or absolutely positioned inside the parent. */
  position?: "fixed" | "absolute";
  className?: string;
}

const SETTINGS: Record<Variant, { spacing: number; base: number; lens: number; radius: number }> = {
  page: { spacing: 15, base: 0.22, lens: 0.6, radius: 260 },
  app: { spacing: 16, base: 0.14, lens: 0.45, radius: 220 },
  quiet: { spacing: 17, base: 0.1, lens: 0.35, radius: 220 },
};

// Cheap smooth value noise, enough for a slow "breathing" of the lattice.
function hash(x: number, y: number) {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return h - Math.floor(h);
}
function noise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function ImmersiveField({ variant = "page", position = "fixed", className = "" }: ImmersiveFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cfg = SETTINGS[variant];
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    const animate = !reduce && !coarse;

    let w = 0;
    let h = 0;
    let dpr = 1;
    // Pointer in field coordinates; eased toward the target for a lens that lags gently.
    const target = { x: -9999, y: -9999, on: false };
    const lens = { x: -9999, y: -9999, k: 0 };
    let t = 0;
    let raf = 0;
    let last = 0;
    let idleFrames = 0;

    // Sizes in the element's own CSS pixels. The landing, /connect and /chat
    // are zoomed on desktop (html.hl-zoom-67), where getBoundingClientRect and
    // pointer coordinates are in zoomed pixels; `toLocal` converts.
    const resize = () => {
      w = Math.max(1, root.clientWidth);
      h = Math.max(1, root.clientHeight);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const sp = cfg.spacing;
      const r2 = cfg.radius * cfg.radius;
      const cols = Math.ceil(w / sp) + 1;
      const rows = Math.ceil(h / sp) + 1;
      const ox = (w - (cols - 1) * sp) / 2;
      for (let j = 0; j < rows; j++) {
        const y = j * sp + sp / 2;
        // Denser and darker toward the top-left, fading out to the bottom-right.
        const fadeY = 1 - y / (h * 1.25);
        for (let i = 0; i < cols; i++) {
          const x = ox + i * sp;
          const fade = Math.max(0, fadeY - (x / w) * 0.45);
          const n = noise(i * 0.09 + t * 0.12, j * 0.09 - t * 0.08);
          let a = cfg.base * fade * (0.35 + n * 0.9);
          let size = 1 + n * 0.6;
          let lensMix = 0;
          if (lens.k > 0.001) {
            const dx = x - lens.x;
            const dy = y - lens.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < r2) {
              lensMix = (1 - d2 / r2) * lens.k;
              lensMix *= lensMix;
              a += cfg.lens * lensMix;
              size += 1.6 * lensMix;
            }
          }
          if (a < 0.012) continue;
          // Ink far from the cursor, Humanity Ledger blue inside the lens.
          const rr = Math.round(21 + (39 - 21) * lensMix);
          const gg = Math.round(23 + (84 - 23) * lensMix);
          const bb = Math.round(28 + (214 - 28) * lensMix);
          ctx.fillStyle = `rgba(${rr},${gg},${bb},${Math.min(a, 0.7).toFixed(3)})`;
          const half = size / 2;
          ctx.fillRect(x - half, y - half, size, size);
        }
      }
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 33) return; // ~30 fps
      last = now;
      t += 0.033;
      const tk = target.on ? 1 : 0;
      lens.k += (tk - lens.k) * 0.08;
      if (target.on) {
        lens.x += (target.x - lens.x) * 0.16;
        lens.y += (target.y - lens.y) * 0.16;
      }
      root.style.setProperty("--ax", `${((lens.x / w) * 100).toFixed(2)}%`);
      root.style.setProperty("--ay", `${((lens.y / h) * 100).toFixed(2)}%`);
      root.style.setProperty("--ak", lens.k.toFixed(3));
      draw();
      // Stop spending frames when the cursor has left and the lens has faded;
      // the slow drift is then carried by CSS alone.
      if (!target.on && lens.k < 0.002) {
        idleFrames++;
        if (idleFrames > 60) stop();
      } else idleFrames = 0;
    };

    const start = () => {
      if (!animate || raf || document.hidden) return;
      last = 0;
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const onMove = (e: PointerEvent) => {
      const r = root.getBoundingClientRect();
      const kx = r.width > 0 ? w / r.width : 1;
      const ky = r.height > 0 ? h / r.height : 1;
      target.x = (e.clientX - r.left) * kx;
      target.y = (e.clientY - r.top) * ky;
      if (!target.on) {
        target.on = true;
        if (lens.k < 0.01) {
          lens.x = target.x;
          lens.y = target.y;
        }
      }
      start();

      // Card spotlight: the nearest [data-glow] under the pointer.
      const el = (e.target as Element | null)?.closest?.("[data-glow]") as HTMLElement | null;
      if (el) {
        const b = el.getBoundingClientRect();
        const ex = b.width > 0 ? el.offsetWidth / b.width : 1;
        const ey = b.height > 0 ? el.offsetHeight / b.height : 1;
        el.style.setProperty("--gx", `${(e.clientX - b.left) * ex}px`);
        el.style.setProperty("--gy", `${(e.clientY - b.top) * ey}px`);
      }
    };
    const onLeave = () => {
      target.on = false;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(root);
    if (animate) {
      window.addEventListener("pointermove", onMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", onLeave);
      window.addEventListener("blur", onLeave);
      document.addEventListener("visibilitychange", onVisibility);
    }
    return () => {
      stop();
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [variant]);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className={`${s.field} ${s[`field_${variant}`]} ${position === "absolute" ? s.fieldAbsolute : ""} ${className}`}
    >
      <div className={s.aurora} />
      <canvas ref={canvasRef} className={s.lattice} />
      <div className={s.grain} />
    </div>
  );
}

export default ImmersiveField;
