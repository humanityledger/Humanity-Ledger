"use client";

import React, { useEffect, useRef, useState } from "react";
import { buildAtlas, buildTile, CELL_H, CELL_W, drawCell, fontReady, hash, type Atlas } from "./glyphs";

/**
 * The typeset field behind the page, in the manner of aztec.network (components/immersive/glyphs.ts):
 * light serif characters, from a dot to the letters of AZTEC, densest under the cursor.
 *
 *   - Under the cursor (desktop, fine pointer): a lens of characters anchored to the page, so they
 *     flow through it while you scroll, up or down, and swell briefly with the scroll's speed.
 *   - At rest (`ambient`, every device): one tile of soft clusters is drawn once and handed to CSS
 *     as --hl-glyph-tile; sections that carry it scroll it with the page, with no work per frame.
 *
 * With `logo`, the official Aztec wordmark is placed small and centred below the element marked
 * data-glyph-anchor (the chat card), linking to aztec.network. It is the SVG Aztec supplies on
 * aztec.network/brand (public/brand/aztec), shown as supplied: ink on this light surface, never
 * narrower than 60px, with clear space that the cursor field keeps out of. Aztec's brand rules ask
 * for the marks to stay unchanged, so the wordmark is never redrawn in characters.
 *
 * Cost: the lens redraws only the cells inside its radius, from a pre-drawn atlas, and its loop
 * stops when the pointer and the page rest. Off on touch screens, narrow screens and with reduced
 * motion (the ambient tile stays: it is a still image).
 */
const RADIUS = 190;
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

export function GlyphField({ logo = false, ambient = false }: { logo?: boolean; ambient?: boolean }) {
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

  // At rest: one tile of the field for CSS (--hl-glyph-tile), drawn once the serif has loaded.
  useEffect(() => {
    if (!ambient) return;
    let url = "";
    let cancelled = false;
    const root = document.documentElement;
    fontReady().then(() => {
      if (cancelled) return;
      const scale = Math.min(2, window.devicePixelRatio || 1);
      const tile = buildTile(buildAtlas(INK, 0.38, scale));
      tile.toBlob((blob) => {
        if (!blob || cancelled) return;
        url = URL.createObjectURL(blob);
        root.style.setProperty("--hl-glyph-tile", `url("${url}")`);
        root.style.setProperty("--hl-glyph-w", `${tile.width / scale}px`);
        root.style.setProperty("--hl-glyph-h", `${tile.height / scale}px`);
        root.dataset.glyphs = "ready";
      }, "image/png");
    });
    return () => {
      cancelled = true;
      root.style.removeProperty("--hl-glyph-tile");
      delete root.dataset.glyphs;
      if (url) URL.revokeObjectURL(url);
    };
  }, [ambient]);

  // Under the cursor: the lens.
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

    // 1.5 is as sharp as the eye resolves 14px glyphs behind text, at half the pixels of 2x.
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    let atlas: Atlas | null = null;
    let w = 0, h = 0;
    const pointer = { x: -1e4, y: -1e4 };
    const lens = { x: -1e4, y: -1e4, k: 0, swell: 0 };
    // The scroll position is read in the scroll event, never inside the frame: reading it there,
    // after other scenes have written their styles, would force a layout.
    let scrollY = window.scrollY;
    let raf = 0, idle = 0, on = false, lastScroll = scrollY;
    // What the last frame drew, so only that box is cleared (never the whole screen).
    let dirty: { x: number; y: number; w: number; h: number } | null = null;

    function paint() {
      if (dirty) ctx!.clearRect(dirty.x, dirty.y, dirty.w, dirty.h);
      dirty = null;
      if (!atlas || lens.k < 0.01) return;
      const radius = RADIUS * (1 + lens.swell * 0.2);
      // Cells are anchored to the page: scrolling moves them through the lens.
      const sy = scrollY;
      const off = sy % CELL_H;
      const row0 = Math.floor(sy / CELL_H);
      const b = boxRef.current;
      const pad = b ? b.h * 0.75 : 0;
      const c0 = Math.max(0, Math.floor((lens.x - radius) / CELL_W)), c1 = Math.ceil((lens.x + radius) / CELL_W);
      const r0 = Math.max(-1, Math.floor((lens.y - radius + off) / CELL_H)), r1 = Math.ceil((lens.y + radius + off) / CELL_H);
      for (let r = r0; r <= r1; r++) {
        const y = r * CELL_H - off;
        for (let c = c0; c <= c1; c++) {
          const x = c * CELL_W;
          const cx = x + CELL_W / 2, cy = y + CELL_H / 2;
          if (b && cx > b.x - pad && cx < b.x + b.w + pad && cy > b.y - pad && cy < b.y + b.h + pad) continue;
          const d = Math.hypot(cx - lens.x, cy - lens.y);
          if (d > radius) continue;
          const f = (1 - d / radius) ** 1.4 * lens.k;
          const n = hash(c, r + row0);
          if (n > 0.3 + f) continue; // sparse at the edge, dense at the centre
          drawCell(ctx!, atlas, f * 0.95 + n * 0.12, 0.12 + f * 0.88, x, y);
        }
      }
      dirty = { x: c0 * CELL_W - 1, y: r0 * CELL_H - off - 1, w: (c1 - c0 + 1) * CELL_W + 2, h: (r1 - r0 + 1) * CELL_H + 2 };
    }

    function resize() {
      w = window.innerWidth; h = window.innerHeight;
      canvas!.width = Math.round(w * dpr); canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      dirty = null; // resizing cleared the canvas
      paint();
    }

    function tick() {
      lens.x += (pointer.x - lens.x) * 0.22;
      lens.y += (pointer.y - lens.y) * 0.22;
      lens.k += ((on ? 1 : 0) - lens.k) * 0.14;
      // Scroll speed swells the lens for a moment, in either direction.
      const sy = scrollY;
      const v = Math.abs(sy - lastScroll);
      lastScroll = sy;
      lens.swell += (Math.min(1, v / 36) - lens.swell) * (v > 0 ? 0.3 : 0.08);
      paint();
      const moving = v > 0 || Math.abs(pointer.x - lens.x) + Math.abs(pointer.y - lens.y) > 0.5 ||
        Math.abs((on ? 1 : 0) - lens.k) > 0.01 || lens.swell > 0.01;
      idle = moving ? 0 : idle + 1;
      raf = idle > 8 ? 0 : requestAnimationFrame(tick);
    }
    const wake = () => { if (!raf && !document.hidden) { idle = 0; raf = requestAnimationFrame(tick); } };
    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX; pointer.y = e.clientY;
      if (!on) { lens.x = pointer.x; lens.y = pointer.y; }
      on = true; wake();
    };
    const onLeave = () => { on = false; wake(); };
    const onScroll = () => { scrollY = window.scrollY; if (on) wake(); };

    let cancelled = false;
    fontReady().then(() => {
      if (cancelled) return;
      atlas = buildAtlas(INK, 0.34, dpr);
      wake();
    });

    resize();
    let t: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => { if (t) clearTimeout(t); t = setTimeout(resize, 120); };
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (t) clearTimeout(t);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
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
