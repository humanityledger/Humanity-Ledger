"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * A quiet field of typeset characters (I, T, 7, Z) behind the page, in the manner of aztec.network:
 * empty at rest, characters appear under the cursor.
 *
 * With `logo`, the official Aztec wordmark is placed small and centred below the element marked
 * data-glyph-anchor (the chat card), linking to aztec.network. It is the SVG Aztec supplies on
 * aztec.network/brand (public/brand/aztec), shown as supplied: ink on this light surface, never
 * narrower than 60px, with clear space that the cursor field keeps out of. Aztec's brand rules ask
 * for the marks to stay unchanged, so the wordmark is never redrawn in characters.
 *
 * Cost: while the pointer moves only the cells around it are redrawn, and the loop stops when it
 * rests. The field is off on touch screens, narrow screens and with reduced motion; the wordmark is
 * not, because it is a link and not an animation.
 */
const CELL = 14;
const FONT = (px: number) => `600 ${px}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
const RAMP = ["·", ":", "I", "T", "7", "Z"];
const RADIUS = 200;
const INK = "21,23,28";
/** Official wordmark, aztec.network/brand: 619.137 by 142.58. */
const WORDMARK = "/brand/aztec/aztec-wordmark-ink.svg";
const WORDMARK_RATIO = 619.137 / 142.58;
/** Aztec's minimum on screen. */
const MIN_WIDTH = 60;

interface LogoBox { x: number; y: number; w: number; h: number }

/** Where the wordmark goes: centred in the space below the anchor, or nowhere if it does not fit. */
function logoBox(): LogoBox | null {
  const anchor = document.querySelector("[data-glyph-anchor]") as HTMLElement | null;
  if (!anchor) return null;
  const r = anchor.getBoundingClientRect();
  const space = window.innerHeight - r.bottom;
  const h = Math.max(16, Math.min(32, space * 0.36));
  const w = h * WORDMARK_RATIO;
  // Clear space of half the mark's height above and below, inside the gap.
  if (w < MIN_WIDTH || space < h * 2) return null;
  return { x: r.left + r.width / 2 - w / 2, y: r.bottom + space / 2 - h / 2, w, h };
}

export function GlyphField({ logo = false }: { logo?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState<LogoBox | null>(null);
  const boxRef = useRef<LogoBox | null>(null);

  // The wordmark: placed on load, on resize and whenever the chat card changes size.
  useEffect(() => {
    if (!logo) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const place = () => {
      const b = logoBox();
      boxRef.current = b;
      setBox((prev) =>
        prev && b && Math.abs(prev.x - b.x) < 0.5 && Math.abs(prev.y - b.y) < 0.5 && Math.abs(prev.w - b.w) < 0.5 ? prev : b,
      );
    };
    place();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(place) : null;
    const anchorEl = document.querySelector("[data-glyph-anchor]");
    if (ro && anchorEl) ro.observe(anchorEl);
    const onResize = () => { if (t) clearTimeout(t); t = setTimeout(place, 120); };
    window.addEventListener("resize", onResize);
    return () => {
      if (t) clearTimeout(t);
      ro?.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [logo]);

  // The field.
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
    const pointer = { x: -1e4, y: -1e4 };
    const lens = { x: -1e4, y: -1e4, k: 0 };
    let raf = 0, idle = 0, on = false;

    const pick = (v: number) => RAMP[Math.max(0, Math.min(RAMP.length - 1, Math.round(v * (RAMP.length - 1))))];
    // Stable pseudo-random per cell, so the field does not flicker.
    const hash = (c: number, r: number) => { const x = Math.sin(c * 127.1 + r * 311.7) * 43758.5453; return x - Math.floor(x); };

    function paint() {
      ctx!.clearRect(0, 0, w, h);
      if (lens.k < 0.01) return;
      ctx!.font = FONT(10);
      ctx!.textAlign = "center";
      ctx!.textBaseline = "middle";
      // Keep the field out of the wordmark's clear space.
      const b = boxRef.current;
      const pad = b ? b.h * 0.75 : 0;
      const c0 = Math.max(0, Math.floor((lens.x - RADIUS) / CELL)), c1 = Math.ceil((lens.x + RADIUS) / CELL);
      const r0 = Math.max(0, Math.floor((lens.y - RADIUS) / CELL)), r1 = Math.ceil((lens.y + RADIUS) / CELL);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const x = c * CELL + CELL / 2, y = r * CELL + CELL / 2;
        if (b && x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) continue;
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

    resize();
    let t: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => { if (t) clearTimeout(t); t = setTimeout(resize, 120); };
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      if (t) clearTimeout(t);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 h-full w-full" style={{ zIndex: 0 }} />
      {box && (
        <a
          href="https://aztec.network"
          target="_blank"
          rel="noopener noreferrer"
          title="Private payments on Aztec Network"
          className="fixed z-[2] block rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black/40"
          style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
        >
          <img src={WORDMARK} alt="Built on Aztec" width={Math.round(box.w)} height={Math.round(box.h)} draggable={false} style={{ display: "block", width: "100%", height: "100%" }} />
        </a>
      )}
    </>
  );
}
