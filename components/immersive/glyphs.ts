/**
 * components/immersive/glyphs.ts
 *
 * The typeset characters behind the landing, /connect and Ledger Chat, in the manner of
 * aztec.network: a density ramp from a dot to a full letter, drawn in a light display serif.
 *
 * aztec.network sets its field in ABC Arizona Serif, a commercial typeface that we have no licence
 * for. The field here uses Instrument Serif (SIL Open Font License), which the site already loads
 * through next/font as --font-display: the same kind of high-contrast serif, ours to use.
 * The densest steps of the ramp are the letters of AZTEC, the network Ledger Chat settles on.
 *
 * Everything is drawn once into an atlas (every character at every opacity step), so a frame is
 * a handful of drawImage copies and never a fillText.
 */

export const RAMP = [".", ":", "/", "I", "T", "7", "Z", "E", "C", "A"] as const;
/** Opacity steps per character in the atlas. */
export const STEPS = 8;
/** One cell of the field, in CSS pixels. */
export const CELL_W = 11;
export const CELL_H = 15;
export const FONT_PX = 14;

/** The family the page loaded for --font-display, with serif fallbacks. */
export function displayFamily(): string {
  if (typeof document === "undefined") return "Georgia, serif";
  const v = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim();
  return v ? `${v}, Georgia, serif` : "Georgia, serif";
}

/** Waits (at most `ms`) for the display serif, so the atlas is never drawn in the fallback. */
export async function fontReady(ms = 1500): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.load) return;
  const load = document.fonts.load(`400 ${FONT_PX}px ${displayFamily()}`).then(() => undefined, () => undefined);
  await Promise.race([load, new Promise<void>((r) => setTimeout(r, ms))]);
}

export interface Atlas {
  canvas: HTMLCanvasElement;
  /** Device pixels per CSS pixel the atlas was drawn at. */
  scale: number;
}

/**
 * Every character of the ramp at STEPS opacities, one row per step:
 * column = character, row = opacity from faint to `maxAlpha`.
 */
export function buildAtlas(rgb: string, maxAlpha: number, scale: number): Atlas {
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(CELL_W * RAMP.length * scale);
  canvas.height = Math.ceil(CELL_H * STEPS * scale);
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.scale(scale, scale);
    ctx.fillStyle = `rgb(${rgb})`;
    ctx.font = `400 ${FONT_PX}px ${displayFamily()}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let step = 0; step < STEPS; step++) {
      ctx.globalAlpha = 0.04 + ((step + 0.5) / STEPS) * (maxAlpha - 0.04);
      RAMP.forEach((ch, i) => ctx.fillText(ch, CELL_W * i + CELL_W / 2, CELL_H * step + CELL_H / 2 + 1));
    }
  }
  return { canvas, scale };
}

/** Copies one cell of the atlas. `level` 0..1 picks the character, `alpha` 0..1 the opacity step. */
export function drawCell(ctx: CanvasRenderingContext2D, atlas: Atlas, level: number, alpha: number, x: number, y: number) {
  const c = Math.max(0, Math.min(RAMP.length - 1, Math.round(level * (RAMP.length - 1))));
  const r = Math.max(0, Math.min(STEPS - 1, Math.floor(alpha * STEPS)));
  const s = atlas.scale;
  ctx.drawImage(atlas.canvas, c * CELL_W * s, r * CELL_H * s, CELL_W * s, CELL_H * s, x, y, CELL_W, CELL_H);
}

/** Stable value in [0, 1) per cell, so the field never flickers. */
export function hash(c: number, r: number): number {
  const x = Math.sin(c * 127.1 + r * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Smooth value noise in [0, 1], for clusters rather than salt and pepper. */
export function noise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/**
 * A seamless tile of the field at rest: soft clusters of characters, denser at their centres.
 * Used as a CSS background behind sections, so it scrolls with the page at no cost per frame.
 */
export function buildTile(atlas: Atlas, cols = 72, rows = 44): HTMLCanvasElement {
  const s = atlas.scale;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(cols * CELL_W * s);
  canvas.height = Math.round(rows * CELL_H * s);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.scale(s, s);
  // Noise sampled on a torus-like grid (period = cols, rows) so the tile repeats without seams.
  const period = (v: number, p: number) => ((v % p) + p) % p;
  const field = (c: number, r: number) => {
    const fx = c / 9, fy = r / 7;
    const px = cols / 9, py = rows / 7;
    // Blend the four wrapped copies of the noise: seamless at the tile's edges.
    const wx = c / cols, wy = r / rows;
    const n00 = noise(fx, fy), n10 = noise(fx - px, fy), n01 = noise(fx, fy - py), n11 = noise(fx - px, fy - py);
    return (n00 * (1 - wx) + n10 * wx) * (1 - wy) + (n01 * (1 - wx) + n11 * wx) * wy;
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = field(period(c, cols), period(r, rows));
      const d = (v - 0.46) / 0.54; // only the top of the noise becomes characters
      if (d <= 0) continue;
      const jitter = hash(c + 17, r + 5);
      if (jitter > 0.35 + d) continue;
      drawCell(ctx, atlas, Math.min(1, d * 1.1 + jitter * 0.15), Math.min(1, 0.25 + d * 0.9), c * CELL_W, r * CELL_H);
    }
  }
  return canvas;
}
