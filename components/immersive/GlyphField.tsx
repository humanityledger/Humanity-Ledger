"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * A quiet field of typeset characters (I, T, 7, Z) behind the page, in the manner of aztec.network:
 * empty at rest, characters appear under the cursor. With `logo`, the Aztec wordmark (the original
 * artwork, public/aztec-wordmark.png) is set in fine characters, small and centred below the
 * element marked data-glyph-anchor (the chat card), and links to aztec.network.
 *
 * Cost: the resting picture is drawn once offscreen; while the pointer moves only the cells around
 * it are redrawn, and the loop stops when it rests. Off on touch screens, narrow screens and with
 * reduced motion.
 */
const CELL = 14;
const FONT = (px: number) => `600 ${px}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
const RAMP = ["·", ":", "I", "T", "7", "Z"];
const RADIUS = 200;
const INK = "21,23,28";

interface LogoBox { x: number; y: number; w: number; h: number }

export function GlyphField({ logo = false }: { logo?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState<LogoBox | null>(null);

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

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = 0, h = 0;
    const base = document.createElement("canvas");
    const bctx = base.getContext("2d")!;
    const pointer = { x: -1e4, y: -1e4 };
    const lens = { x: -1e4, y: -1e4, k: 0 };
    let raf = 0, idle = 0, on = false;
    // Logo cells: fine grid sampled from the wordmark.
    let L: { x0: number; y0: number; cell: number; cols: number; rows: number; mask: Float32Array } | null = null;
    const img = new Image();
    let imgReady = false;

    const pick = (v: number) => RAMP[Math.max(0, Math.min(RAMP.length - 1, Math.round(v * (RAMP.length - 1))))];
    // Stable pseudo-random per cell, so the field does not flicker.
    const hash = (c: number, r: number) => { const x = Math.sin(c * 127.1 + r * 311.7) * 43758.5453; return x - Math.floor(x); };

    function layoutLogo() {
      L = null;
      setBox(null);
      if (!logo || !imgReady) return;
      const anchor = document.querySelector("[data-glyph-anchor]") as HTMLElement | null;
      if (!anchor) return;
      const r = anchor.getBoundingClientRect();
      const space = h - r.bottom;
      if (space < 34) return;
      const lh = Math.max(16, Math.min(40, space * 0.42));
      const lw = lh * (img.naturalWidth / img.naturalHeight);
      const cell = Math.max(3, lh / 15);
      const cols = Math.ceil(lw / cell), rows = Math.ceil(lh / cell);
      const m = document.createElement("canvas");
      m.width = cols; m.height = rows;
      const mc = m.getContext("2d")!;
      mc.drawImage(img, 0, 0, cols, rows);
      const d = mc.getImageData(0, 0, cols, rows).data;
      const mask = new Float32Array(cols * rows);
      for (let i = 0; i < cols * rows; i++) mask[i] = d[i * 4 + 3] / 255;
      const x0 = r.left + r.width / 2 - (cols * cell) / 2;
      const y0 = r.bottom + space / 2 - (rows * cell) / 2;
      L = { x0, y0, cell, cols, rows, mask };
      setBox({ x: x0, y: y0, w: cols * cell, h: rows * cell });
    }

    function drawBase() {
      base.width = Math.round(w * dpr); base.height = Math.round(h * dpr);
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bctx.clearRect(0, 0, w, h);
      if (!L) return;
      bctx.font = FONT(L.cell * 0.95);
      bctx.textAlign = "center";
      bctx.textBaseline = "middle";
      for (let r = 0; r < L.rows; r++) for (let c = 0; c < L.cols; c++) {
        const m = L.mask[r * L.cols + c];
        if (m < 0.25) continue;
        bctx.fillStyle = `rgba(${INK},${0.32 + 0.4 * m})`;
        bctx.fillText(pick(0.45 + 0.55 * m * (0.7 + 0.3 * hash(c, r))), L.x0 + c * L.cell + L.cell / 2, L.y0 + r * L.cell + L.cell / 2);
      }
    }

    function paint() {
      ctx!.clearRect(0, 0, w, h);
      ctx!.drawImage(base, 0, 0, w, h);
      if (lens.k < 0.01) return;
      ctx!.font = FONT(10);
      ctx!.textAlign = "center";
      ctx!.textBaseline = "middle";
      const c0 = Math.max(0, Math.floor((lens.x - RADIUS) / CELL)), c1 = Math.ceil((lens.x + RADIUS) / CELL);
      const r0 = Math.max(0, Math.floor((lens.y - RADIUS) / CELL)), r1 = Math.ceil((lens.y + RADIUS) / CELL);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const x = c * CELL + CELL / 2, y = r * CELL + CELL / 2;
        if (L && x > L.x0 - 6 && x < L.x0 + L.cols * L.cell + 6 && y > L.y0 - 6 && y < L.y0 + L.rows * L.cell + 6) continue;
        const d = Math.hypot(x - lens.x, y - lens.y);
        if (d > RADIUS) continue;
        const f = (1 - d / RADIUS) ** 1.6 * lens.k;
        const n = hash(c, r);
        if (n > 0.35 + f) continue; // sparse at the edge, dense at the centre
        ctx!.fillStyle = `rgba(${INK},${0.05 + f * 0.3})`;
        ctx!.fillText(pick(f * 0.9 + n * 0.25), x, y);
      }
    }

    function resize() {
      w = window.innerWidth; h = window.innerHeight;
      canvas!.width = Math.round(w * dpr); canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      layoutLogo();
      drawBase();
      paint();
    }

    function tick() {
      lens.x += (pointer.x - lens.x) * 0.2;
      lens.y += (pointer.y - lens.y) * 0.2;
      lens.k += ((on ? 1 : 0) - lens.k) * 0.12;
      paint();
      const moving = Math.abs(pointer.x - lens.x) + Math.abs(pointer.y - lens.y) > 0.5 || Math.abs((on ? 1 : 0) - lens.k) > 0.01;
      idle = moving ? 0 : idle + 1;
      raf = idle > 8 ? 0 : requestAnimationFrame(tick);
    }
    const wake = () => { if (!raf && !document.hidden) raf = requestAnimationFrame(tick); };
    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX; pointer.y = e.clientY;
      if (!on) { lens.x = pointer.x; lens.y = pointer.y; }
      on = true; wake();
    };
    const onLeave = () => { on = false; wake(); };

    img.onload = () => { imgReady = true; resize(); };
    if (logo) img.src = "/aztec-wordmark.png";
    resize();
    // The anchor (chat card) can settle after first paint; lay the logo out again when it moves.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => { layoutLogo(); drawBase(); paint(); }) : null;
    const anchorEl = document.querySelector("[data-glyph-anchor]");
    if (ro && anchorEl) ro.observe(anchorEl);
    let t: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => { if (t) clearTimeout(t); t = setTimeout(resize, 120); };
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      if (t) clearTimeout(t);
      ro?.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
    };
  }, [logo]);

  return (
    <>
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 h-full w-full" style={{ zIndex: 0 }} />
      {box && (
        <a
          href="https://aztec.network"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Built on Aztec"
          title="Built on Aztec"
          className="fixed z-[2] rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-black/40"
          style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
        />
      )}
    </>
  );
}
