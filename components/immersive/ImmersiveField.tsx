"use client";

import React, { useEffect, useRef } from "react";
import s from "./Immersive.module.css";

type Variant = "page" | "app" | "quiet";

export interface ImmersiveFieldProps {
  /** page: landing, /connect, docs. app: behind Ledger Chat. quiet: barely there. */
  variant?: Variant;
  /** Fixed to the viewport (default) or absolutely positioned inside the parent. */
  position?: "fixed" | "absolute";
  className?: string;
}

const SETTINGS: Record<Variant, { spacing: number; base: number; lens: number; radius: number }> = {
  page: { spacing: 22, base: 0.18, lens: 0.55, radius: 220 },
  app: { spacing: 22, base: 0.16, lens: 0.50, radius: 200 },
  quiet: { spacing: 24, base: 0.09, lens: 0.30, radius: 180 },
};

export function ImmersiveField({ variant = "page", position = "fixed", className = "" }: ImmersiveFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    const isMobile =
      typeof navigator !== "undefined" &&
      (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 980);

    // On mobile/touch/reduced-motion devices: hide canvas completely to ensure 120fps native hardware-accelerated scroll
    if (isMobile || coarse || reduce) {
      canvas.style.display = "none";
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cfg = SETTINGS[variant];
    let w = 0;
    let h = 0;
    let dpr = 1;
    let cachedRect = { left: 0, top: 0, width: 0, height: 0 };

    // Offscreen canvas for pre-rendered static dot lattice (1 draw call instead of thousands)
    const offscreen = document.createElement("canvas");
    const offCtx = offscreen.getContext("2d");

    const target = { x: -9999, y: -9999, on: false };
    const lens = { x: -9999, y: -9999, k: 0 };
    let raf = 0;
    let idleFrames = 0;

    const preRenderBaseLattice = () => {
      if (!offCtx) return;
      offscreen.width = Math.round(w * dpr);
      offscreen.height = Math.round(h * dpr);
      offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      offCtx.clearRect(0, 0, w, h);

      const sp = cfg.spacing;
      const cols = Math.ceil(w / sp) + 1;
      const rows = Math.ceil(h / sp) + 1;
      const ox = (w - (cols - 1) * sp) / 2;

      for (let j = 0; j < rows; j++) {
        const y = j * sp + sp / 2;
        const fadeY = 1 - y / (h * 1.25);
        for (let i = 0; i < cols; i++) {
          const x = ox + i * sp;
          const fade = Math.max(0, fadeY - (x / w) * 0.45);
          const a = cfg.base * fade * 0.8;
          if (a < 0.012) continue;
          offCtx.fillStyle = `rgba(21, 23, 28, ${Math.min(a, 0.45).toFixed(3)})`;
          offCtx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
        }
      }
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      cachedRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      w = Math.max(1, root.clientWidth);
      h = Math.max(1, root.clientHeight);
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      preRenderBaseLattice();
      draw();
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      // Fast 1-operation blit of pre-rendered background dots
      ctx.drawImage(offscreen, 0, 0, w, h);

      // Only calculate glowing lens dots in the immediate circle around the cursor
      if (lens.k > 0.005) {
        const sp = cfg.spacing;
        const rad = cfg.radius;
        const r2 = rad * rad;

        const startCol = Math.max(0, Math.floor((lens.x - rad) / sp));
        const endCol = Math.min(Math.ceil(w / sp), Math.ceil((lens.x + rad) / sp));
        const startRow = Math.max(0, Math.floor((lens.y - rad) / sp));
        const endRow = Math.min(Math.ceil(h / sp), Math.ceil((lens.y + rad) / sp));

        const ox = (w - (Math.ceil(w / sp)) * sp) / 2;

        for (let j = startRow; j <= endRow; j++) {
          const y = j * sp + sp / 2;
          for (let i = startCol; i <= endCol; i++) {
            const x = ox + i * sp;
            const dx = x - lens.x;
            const dy = y - lens.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < r2) {
              let lensMix = (1 - d2 / r2) * lens.k;
              lensMix *= lensMix;
              const a = cfg.lens * lensMix;
              const size = 1.5 + 2.0 * lensMix;
              const rr = Math.round(21 + (39 - 21) * lensMix);
              const gg = Math.round(23 + (84 - 23) * lensMix);
              const bb = Math.round(28 + (214 - 28) * lensMix);
              ctx.fillStyle = `rgba(${rr},${gg},${bb},${Math.min(a, 0.85).toFixed(3)})`;
              const half = size / 2;
              ctx.fillRect(x - half, y - half, size, size);
            }
          }
        }
      }
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const tk = target.on ? 1 : 0;
      lens.k += (tk - lens.k) * 0.14;
      if (target.on) {
        lens.x += (target.x - lens.x) * 0.22;
        lens.y += (target.y - lens.y) * 0.22;
      }
      draw();

      // If cursor left or is idle and lens faded, stop animation loop to drop CPU to 0%
      if (!target.on && lens.k < 0.005) {
        idleFrames++;
        if (idleFrames > 30) stop();
      } else {
        idleFrames = 0;
      }
    };

    const start = () => {
      if (raf || document.hidden) return;
      raf = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const onMove = (e: PointerEvent) => {
      // Use cached rect coordinates — zero synchronous layout reflows!
      target.x = e.clientX - cachedRect.left;
      target.y = e.clientY - cachedRect.top;
      if (!target.on) {
        target.on = true;
        if (lens.k < 0.01) {
          lens.x = target.x;
          lens.y = target.y;
        }
      }
      start();
    };

    const onLeave = () => {
      target.on = false;
    };

    const onVisibility = () => (document.hidden ? stop() : start());

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(root);

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    document.addEventListener("visibilitychange", onVisibility);

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
