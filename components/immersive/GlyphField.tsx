"use client";

import React, { useEffect, useRef } from "react";

/**
 * The page behind Ledger Chat on desktop: a quiet field of typeset characters (I, T, 7, Z: the
 * strokes of the letters of AZTEC) that draws a very large "AZTEC" at rest, barely visible, and
 * lights up under the cursor. Ink on white, like the rest of the app.
 *
 * Cost: the resting field is drawn once to an offscreen canvas; while the pointer moves, only the
 * cells around it are redrawn, and the loop stops a few frames after it rests. Off on touch
 * screens, small screens and with reduced motion (the parent hides it below md as well).
 */
const CELL = 13;
const FONT = '600 11px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
const RAMP = [" ", "·", ":", "I", "T", "7", "Z"];
const RADIUS = 190;
const INK = "21,23,28";

export function GlyphField({ word = "AZTEC" }: { word?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    if (reduce || coarse || window.innerWidth < 980) {
      canvas.style.display = "none";
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0, h = 0, cols = 0, rows = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let mask = new Float32Array(0);
    const base = document.createElement("canvas");
    const bctx = base.getContext("2d")!;
    const pointer = { x: -1e4, y: -1e4 };
    const lens = { x: -1e4, y: -1e4, k: 0 };
    let raf = 0, idle = 0, on = false;

    const glyph = (v: number) => RAMP[Math.max(0, Math.min(RAMP.length - 1, Math.round(v * (RAMP.length - 1))))];

    function buildMask() {
      // The word, set very large across the page; sampled once per cell.
      const m = document.createElement("canvas");
      m.width = cols; m.height = rows;
      const mc = m.getContext("2d")!;
      mc.fillStyle = "#000";
      mc.fillRect(0, 0, cols, rows);
      mc.fillStyle = "#fff";
      mc.textAlign = "center";
      mc.textBaseline = "middle";
      let size = rows * 0.92;
      mc.font = `700 ${size}px Georgia, "Times New Roman", serif`;
      const tw = mc.measureText(word).width;
      if (tw > cols * 1.02) { size *= (cols * 1.02) / tw; mc.font = `700 ${size}px Georgia, "Times New Roman", serif`; }
      mc.fillText(word, cols / 2, rows * 0.54);
      const d = mc.getImageData(0, 0, cols, rows).data;
      mask = new Float32Array(cols * rows);
      for (let i = 0; i < cols * rows; i++) mask[i] = d[i * 4] / 255;
    }

    function drawBase() {
      base.width = Math.round(w * dpr); base.height = Math.round(h * dpr);
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bctx.clearRect(0, 0, w, h);
      bctx.font = FONT;
      bctx.textAlign = "center";
      bctx.textBaseline = "middle";
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const m = mask[r * cols + c];
          if (m < 0.08) continue;
          bctx.fillStyle = `rgba(${INK},${0.045 + 0.05 * m})`;
          bctx.fillText(glyph(0.35 + 0.4 * m), c * CELL + CELL / 2, r * CELL + CELL / 2);
        }
      }
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas!.width = Math.round(w * dpr); canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(w / CELL); rows = Math.ceil(h / CELL);
      buildMask();
      drawBase();
      paint();
    }

    function paint() {
      ctx!.clearRect(0, 0, w, h);
      ctx!.drawImage(base, 0, 0, w, h);
      if (lens.k < 0.01) return;
      const c0 = Math.max(0, Math.floor((lens.x - RADIUS) / CELL)), c1 = Math.min(cols - 1, Math.ceil((lens.x + RADIUS) / CELL));
      const r0 = Math.max(0, Math.floor((lens.y - RADIUS) / CELL)), r1 = Math.min(rows - 1, Math.ceil((lens.y + RADIUS) / CELL));
      ctx!.font = FONT;
      ctx!.textAlign = "center";
      ctx!.textBaseline = "middle";
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const x = c * CELL + CELL / 2, y = r * CELL + CELL / 2;
          const d = Math.hypot(x - lens.x, y - lens.y);
          if (d > RADIUS) continue;
          const f = (1 - d / RADIUS) ** 2 * lens.k;
          const m = mask[r * cols + c];
          const v = Math.min(1, 0.25 + f * 0.75 + m * 0.25);
          // Cover the resting glyph, then set the lit one.
          ctx!.clearRect(x - CELL / 2, y - CELL / 2, CELL, CELL);
          ctx!.fillStyle = `rgba(${INK},${Math.min(0.42, 0.06 + f * 0.36 + m * 0.08)})`;
          ctx!.fillText(glyph(v), x, y);
        }
      }
    }

    function tick() {
      lens.x += (pointer.x - lens.x) * 0.22;
      lens.y += (pointer.y - lens.y) * 0.22;
      lens.k += ((on ? 1 : 0) - lens.k) * 0.12;
      paint();
      const moving = Math.abs(pointer.x - lens.x) + Math.abs(pointer.y - lens.y) > 0.5 || Math.abs((on ? 1 : 0) - lens.k) > 0.01;
      idle = moving ? 0 : idle + 1;
      raf = idle > 8 ? 0 : requestAnimationFrame(tick);
    }
    const wake = () => { if (!raf && !document.hidden) raf = requestAnimationFrame(tick); };
    const onMove = (e: PointerEvent) => {
      const rect = canvas!.getBoundingClientRect();
      pointer.x = e.clientX - rect.left; pointer.y = e.clientY - rect.top;
      if (!on) { lens.x = pointer.x; lens.y = pointer.y; }
      on = true; wake();
    };
    const onLeave = () => { on = false; wake(); };

    resize();
    let t: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => { if (t) clearTimeout(t); t = setTimeout(resize, 150); };
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    if (document.fonts?.ready) document.fonts.ready.then(() => { drawBase(); paint(); }).catch(() => {});
    return () => {
      cancelAnimationFrame(raf);
      if (t) clearTimeout(t);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
    };
  }, [word]);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 h-full w-full" style={{ zIndex: 0 }} />;
}
