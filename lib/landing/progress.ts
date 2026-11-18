/**
 * Pure progress functions for the landing's scroll scenes. Every effect is a function of a
 * scene's progress p in [0, 1], so scrolling back up shows exactly the same frames in reverse.
 */
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : Number.isFinite(x) ? x : 0);

/** Progress of a pinned scene: 0 when its top reaches the top of the viewport, 1 when its bottom reaches the bottom. */
export function sceneProgress(scrollY: number, top: number, height: number, viewport: number): number {
  const run = height - viewport;
  if (run <= 0) return scrollY >= top ? 1 : 0;
  return clamp01((scrollY - top) / run);
}

/** The part of p between a and b, rescaled to [0, 1]. */
export const segment = (p: number, a: number, b: number) => (b <= a ? (p >= b ? 1 : 0) : clamp01((p - a) / (b - a)));

/** Close to cubic-bezier(0.22, 1, 0.36, 1): fast out, soft landing, no overshoot. */
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 4);

/** How many characters of a line are typed at p, between a and b. */
export const typedCount = (p: number, length: number, a = 0, b = 1) => Math.round(segment(p, a, b) * length);

/** Video time for a scene progress, held a little before the end so the last frame is decodable. */
export const videoTime = (p: number, duration: number, a = 0, b = 1) =>
  Number.isFinite(duration) && duration > 0 ? segment(p, a, b) * Math.max(0, duration - 0.05) : 0;

/** One step of a frame-rate independent lerp toward target. */
export function approach(current: number, target: number, dtMs: number, halfLifeMs = 60): number {
  if (!Number.isFinite(current)) return target;
  const k = 1 - Math.pow(0.5, Math.max(0, dtMs) / halfLifeMs);
  const next = current + (target - current) * k;
  return Math.abs(target - next) < 1e-3 ? target : next;
}

/** Which record points are lit at p (block numbers between the first and last). */
export function litBlocks(p: number, blocks: number[]): boolean[] {
  if (blocks.length === 0) return [];
  const lo = Math.min(...blocks);
  const hi = Math.max(...blocks);
  const at = lo + clamp01(p) * (hi - lo);
  return blocks.map((b) => b <= at + 1e-9);
}
