/**
 * lib/chat/sticker-scenes.ts — the full-chat moment a sticker plays (≈4.6 s), like the screen
 * effects of iMessage: the sticker leaves its bubble, takes the stage in 3D, and the whole
 * conversation reacts — paint that splats on the glass and drips down, a rain of hearts, a lipstick
 * kiss stamped on the screen, fireworks over a dimmed chat, a quake with cracks…
 *
 * Plain DOM, one <canvas> for particles and the Web Animations API: no framework, no assets beyond
 * the sticker's own image, nothing fetched. The layer never takes pointer events, cleans up after
 * itself, and shows only a short, still pop when the person prefers reduced motion.
 */

import type { StickerScene } from '@/lib/chat/stickers';

export const SCENE_MS = 4600;

export interface SceneOptions {
  /** The overlay to draw in: covers the conversation, overflow hidden, pointer-events none. */
  host: HTMLElement;
  /** What shakes for the shake and boom scenes (the conversation). */
  shakeTarget?: HTMLElement | null;
  src: string;
  label?: string;
  scene?: StickerScene;
  tint?: string;
  /** The sticker's bubble on screen, where the moment starts and ends. */
  from?: DOMRect | null;
  reducedMotion?: boolean;
}

export interface ScenePlayback {
  done: Promise<void>;
  cancel(): void;
}

/* ── Utilities ───────────────────────────────────────────────────────── */

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];
const TAU = Math.PI * 2;
let uid = 0; // unique gradient ids across the SVGs a scene adds

function el<K extends keyof HTMLElementTagNameMap>(tag: K, style: Partial<CSSStyleDeclaration> = {}, parent?: HTMLElement): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  Object.assign(e.style, style);
  parent?.appendChild(e);
  return e;
}

function svgEl(markup: string, style: Partial<CSSStyleDeclaration>, parent: HTMLElement): HTMLElement {
  const wrap = el('div', { position: 'absolute', ...style }, parent);
  wrap.innerHTML = markup; // markup is built here from numbers and validated colours only
  return wrap;
}

/** A #rrggbb colour, or the fallback: tints come from our own catalogue, but stay strict. */
function hex(c: string | undefined, fallback: string): string {
  return c && /^#[0-9a-f]{6}$/i.test(c) ? c : fallback;
}

function shade(c: string, amt: number): string {
  const n = parseInt(c.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  const r = ch((n >> 16) & 255), g = ch((n >> 8) & 255), b = ch(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Smooth closed path through points (Catmull-Rom → Bézier). */
function blobPath(pts: [number, number][]): string {
  const n = pts.length;
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + 'Z';
}

/* ── Particles ───────────────────────────────────────────────────────── */

type Shape = 'heart' | 'confetti' | 'circle' | 'spark' | 'drop' | 'coin' | 'bill' | 'flame' | 'bubble' | 'star' | 'streak' | 'blob' | 'z';

interface P {
  x: number; y: number; vx: number; vy: number;
  size: number; rot: number; vr: number; flip: number; vf: number;
  life: number; age: number; color: string; shape: Shape;
  z: number; gravity: number; drag: number; wobble: number; born: number;
  bounce?: number; trail?: boolean; alpha?: number;
}

function heartPath2D(s: number): Path2D {
  const p = new Path2D();
  p.moveTo(0, s * 0.35);
  p.bezierCurveTo(-s * 0.15, s * 0.1, -s, -s * 0.05, -s, -s * 0.5);
  p.bezierCurveTo(-s, -s * 1.0, -s * 0.3, -s * 1.1, 0, -s * 0.65);
  p.bezierCurveTo(s * 0.3, -s * 1.1, s, -s * 1.0, s, -s * 0.5);
  p.bezierCurveTo(s, -s * 0.05, s * 0.15, s * 0.1, 0, s * 0.35);
  return p;
}
function sparkPath2D(r: number): Path2D {
  const p = new Path2D();
  p.moveTo(0, -r);
  p.quadraticCurveTo(r * 0.14, -r * 0.14, r, 0);
  p.quadraticCurveTo(r * 0.14, r * 0.14, 0, r);
  p.quadraticCurveTo(-r * 0.14, r * 0.14, -r, 0);
  p.quadraticCurveTo(-r * 0.14, -r * 0.14, 0, -r);
  return p;
}
function starPath2D(ro: number): Path2D {
  const p = new Path2D();
  for (let k = 0; k < 10; k++) {
    const a = (-90 + k * 36) * (Math.PI / 180), r = k % 2 ? ro * 0.45 : ro;
    if (k === 0) p.moveTo(r * Math.cos(a), r * Math.sin(a)); else p.lineTo(r * Math.cos(a), r * Math.sin(a));
  }
  p.closePath();
  return p;
}

function drawParticle(ctx: CanvasRenderingContext2D, p: P, fade: number) {
  const lifeT = p.age / p.life;
  const a = Math.min(1, (1 - lifeT) * 3) * Math.min(1, p.age / 120) * fade * (p.alpha ?? 1);
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  const fl = Math.cos(p.flip);
  const s = p.size * p.z;
  switch (p.shape) {
    case 'heart': {
      ctx.scale(fl, 1);
      const g = ctx.createLinearGradient(-s, -s, s, s);
      g.addColorStop(0, shade(p.color, 0.35)); g.addColorStop(1, shade(p.color, -0.15));
      ctx.fillStyle = g;
      ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 8 * p.z; ctx.shadowOffsetY = 4 * p.z;
      ctx.fill(heartPath2D(s));
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.ellipse(-s * 0.45, -s * 0.6, s * 0.22, s * 0.12, -0.6, 0, TAU); ctx.fill();
      break;
    }
    case 'confetti':
      ctx.scale(1, fl);
      ctx.fillStyle = p.color;
      ctx.fillRect(-s * 0.5, -s * 0.22, s, s * 0.44);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(-s * 0.5, -s * 0.22, s, s * 0.12);
      break;
    case 'circle':
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(0, 0, s * 0.5, 0, TAU); ctx.fill();
      break;
    case 'spark':
      ctx.scale(0.6 + 0.4 * Math.abs(fl), 0.6 + 0.4 * Math.abs(fl));
      ctx.shadowColor = p.color; ctx.shadowBlur = 14;
      ctx.fillStyle = p.color;
      ctx.fill(sparkPath2D(s));
      ctx.fillStyle = '#fff';
      ctx.fill(sparkPath2D(s * 0.45));
      break;
    case 'star':
      ctx.scale(fl, 1);
      ctx.shadowColor = p.color; ctx.shadowBlur = 10;
      ctx.fillStyle = p.color;
      ctx.fill(starPath2D(s));
      break;
    case 'drop': {
      const g = ctx.createLinearGradient(0, -s, 0, s);
      g.addColorStop(0, shade(p.color, 0.5)); g.addColorStop(1, p.color);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.bezierCurveTo(s * 0.4, -s * 0.3, s * 0.6, 0, s * 0.6, s * 0.3);
      ctx.arc(0, s * 0.3, s * 0.6, 0, Math.PI);
      ctx.bezierCurveTo(-s * 0.6, 0, -s * 0.4, -s * 0.3, 0, -s);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath(); ctx.ellipse(-s * 0.2, s * 0.25, s * 0.12, s * 0.2, 0, 0, TAU); ctx.fill();
      break;
    }
    case 'streak':
      ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(1.4, 2.6 * p.z); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-p.vx * 0.06, -p.vy * 0.06); ctx.stroke();
      break;
    case 'coin': {
      ctx.scale(fl, 1);
      const g = ctx.createRadialGradient(-s * 0.3, -s * 0.3, s * 0.1, 0, 0, s);
      g.addColorStop(0, '#fff3b0'); g.addColorStop(0.5, '#ffcf3f'); g.addColorStop(1, '#d99a0b');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#b77a0d'; ctx.lineWidth = s * 0.12;
      ctx.beginPath(); ctx.arc(0, 0, s * 0.68, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#b77a0d'; ctx.font = `900 ${s * 1.05}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, s * 0.06);
      break;
    }
    case 'bill': {
      ctx.scale(1, 0.35 + 0.65 * Math.abs(fl));
      ctx.fillStyle = '#86d989'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = s * 0.08;
      ctx.beginPath(); ctx.roundRect(-s, -s * 0.5, s * 2, s, s * 0.12); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#3f9a45'; ctx.lineWidth = s * 0.06; ctx.strokeRect(-s * 0.82, -s * 0.34, s * 1.64, s * 0.68);
      ctx.fillStyle = '#3f9a45'; ctx.beginPath(); ctx.arc(0, 0, s * 0.24, 0, TAU); ctx.fill();
      break;
    }
    case 'flame': {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s);
      g.addColorStop(0, 'rgba(255,240,180,0.95)'); g.addColorStop(0.35, p.color); g.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill();
      break;
    }
    case 'bubble': {
      const g = ctx.createRadialGradient(-s * 0.3, -s * 0.35, s * 0.05, 0, 0, s);
      g.addColorStop(0, 'rgba(255,255,255,0.65)'); g.addColorStop(0.6, 'rgba(255,255,255,0.05)'); g.addColorStop(0.92, 'rgba(160,220,255,0.35)'); g.addColorStop(1, 'rgba(255,170,240,0.6)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.stroke();
      break;
    }
    case 'blob': {
      const wob = 1 + Math.sin(p.age / 70) * 0.06 * (p.wobble || 1);
      ctx.scale(wob, 2 - wob);
      const g = ctx.createRadialGradient(-s * 0.35, -s * 0.35, s * 0.1, 0, 0, s);
      g.addColorStop(0, shade(p.color, 0.6)); g.addColorStop(0.55, p.color); g.addColorStop(1, shade(p.color, -0.3));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.ellipse(-s * 0.38, -s * 0.42, s * 0.24, s * 0.14, -0.7, 0, TAU); ctx.fill();
      break;
    }
    case 'z':
      ctx.fillStyle = p.color; ctx.font = `900 ${s}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = s * 0.14; ctx.strokeText('Z', 0, 0);
      ctx.fillText('Z', 0, 0);
      break;
  }
  ctx.restore();
}

/* ── The player ──────────────────────────────────────────────────────── */

export function playStickerScene(o: SceneOptions): ScenePlayback {
  const host = o.host;
  const W = Math.max(1, host.clientWidth);
  const H = Math.max(1, host.clientHeight);
  const hostRect = host.getBoundingClientRect();
  const root = el('div', { position: 'absolute', inset: '0', overflow: 'hidden', pointerEvents: 'none', perspective: '900px', contain: 'strict' }, host);
  root.setAttribute('aria-hidden', 'true');
  const anims: Animation[] = [];
  const ps: P[] = [];
  const timers: number[] = [];
  let raf = 0;
  let finished = false;
  let resolveDone: () => void = () => {};
  const done = new Promise<void>(r => { resolveDone = r; });
  const animate = (e: Element, k: Keyframe[], opts: KeyframeAnimationOptions) => {
    const a = e.animate(k, opts);
    anims.push(a);
    return a;
  };
  const later = (ms: number, fn: () => void) => { timers.push(window.setTimeout(fn, ms)); };

  const cleanup = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    timers.forEach(t => clearTimeout(t));
    anims.forEach(a => { try { a.cancel(); } catch { /* gone */ } });
    window.removeEventListener('pagehide', cleanup);
    ps.length = 0;
    root.remove();
    resolveDone();
  };

  // Where the sticker starts: its bubble, or the bottom of the chat.
  const heroSize = Math.round(Math.min(W * 0.62, H * 0.42, 340));
  const cx = W / 2, cy = H * 0.44;
  const fx = o.from ? o.from.left + o.from.width / 2 - hostRect.left : cx;
  const fy = o.from ? o.from.top + o.from.height / 2 - hostRect.top : H - 80;
  const fs = o.from ? Math.max(0.2, o.from.width / heroSize) : 0.3;

  const hero = el('img', {
    position: 'absolute', left: `${cx - heroSize / 2}px`, top: `${cy - heroSize / 2}px`, width: `${heroSize}px`, height: `${heroSize}px`,
    filter: 'drop-shadow(0 22px 30px rgba(16,24,40,0.35))', willChange: 'transform, opacity', backfaceVisibility: 'visible',
  }, root) as HTMLImageElement;
  hero.src = o.src;
  hero.alt = '';
  hero.decoding = 'async';
  const at = (x: number, y: number) => `translate(${(x - cx).toFixed(1)}px, ${(y - cy).toFixed(1)}px)`;

  if (o.reducedMotion) {
    animate(hero, [
      { transform: `${at(cx, cy)} scale(0.7)`, opacity: 0 },
      { transform: `${at(cx, cy)} scale(1)`, opacity: 1, offset: 0.2 },
      { transform: `${at(cx, cy)} scale(1)`, opacity: 1, offset: 0.8 },
      { transform: `${at(cx, cy)} scale(0.9)`, opacity: 0 },
    ], { duration: 1600, easing: 'ease-out', fill: 'forwards' });
    later(1650, cleanup);
    return { done, cancel: cleanup };
  }

  const T = SCENE_MS;
  const tint = hex(o.tint, '#ff5c8a');
  const scene = o.scene ?? 'sparkle';

  /* Hero motion: enter (spin from the bubble), live, leave (back into the bubble). */
  const enter = { transform: `${at(fx, fy)} scale(${fs}) rotateY(0deg)`, opacity: 1 };
  const exit = { transform: `${at(fx, fy)} scale(${fs}) rotateY(0deg)`, opacity: 0 };
  const idle = (o2: number, dy: number, r: number, s = 1) => ({ transform: `${at(cx, cy + dy)} scale(${s}) rotate(${r}deg)`, opacity: 1, offset: o2 });
  const standard: Keyframe[] = [
    { ...enter, offset: 0, easing: 'cubic-bezier(.2,.9,.25,1)' },
    { transform: `${at(cx, cy - 20)} scale(1.12) rotateY(360deg)`, opacity: 1, offset: 0.13 },
    { transform: `${at(cx, cy)} scale(0.94) rotateY(360deg)`, opacity: 1, offset: 0.18 },
    { transform: `${at(cx, cy)} scale(1.02) rotateY(360deg)`, opacity: 1, offset: 0.23 },
    idle(0.36, -12, -3), idle(0.5, 4, 3), idle(0.64, -10, -2), idle(0.78, 2, 2),
    { transform: `${at(cx, cy - 10)} scale(1.06)`, opacity: 1, offset: 0.86, easing: 'cubic-bezier(.6,0,.8,.4)' },
    { ...exit, offset: 1 },
  ];
  let heroFrames: Keyframe[] = standard;

  /* Canvas */
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const canvas = el('canvas', { position: 'absolute', inset: '0', width: `${W}px`, height: `${H}px`, willChange: 'contents', transform: 'translateZ(0)' }, root) as HTMLCanvasElement;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext('2d');
  root.insertBefore(canvas, hero);
  type Spawner = (t: number, dt: number) => void;
  const spawners: Spawner[] = [];
  const add = (p: Partial<P> & Pick<P, 'x' | 'y' | 'shape' | 'color'>) =>
    ps.push({ vx: 0, vy: 0, size: 18, rot: 0, vr: 0, flip: 0, vf: 0, life: 3000, age: 0, z: 1, gravity: 0, drag: 0, wobble: 0, born: 0, ...p });
  const every = (from: number, to: number, per: number, fn: () => void) => {
    let acc = 0;
    spawners.push((t, dt) => { if (t < from || t > to) return; acc += dt * per / 1000; while (acc >= 1) { acc -= 1; fn(); } });
  };

  /* Overlay helpers */
  const wash = (bg: string, peak: number, inAt = 0.08, outAt = 0.86) => {
    const d = el('div', { position: 'absolute', inset: '0', background: bg, opacity: '0' }, root);
    root.insertBefore(d, canvas);
    animate(d, [{ opacity: 0 }, { opacity: peak, offset: inAt }, { opacity: peak, offset: outAt }, { opacity: 0 }], { duration: T, fill: 'forwards', easing: 'ease-in-out' });
    return d;
  };
  // A short buzz on impacts, where the device supports it (Android; iOS browsers do not).
  const buzz = (at0: number, pattern: number[]) => later(at0, () => { try { navigator.vibrate?.(pattern); } catch { /* not allowed */ } });
  const shake = (at0: number, ms: number, amp: number) => {
    buzz(at0, [ms > 500 ? 60 : 30, 40, 30]);
    const target = o.shakeTarget;
    if (!target) return;
    later(at0, () => {
      const k: Keyframe[] = [];
      const n = Math.round(ms / 40);
      for (let i = 0; i <= n; i++) {
        const fall = 1 - i / n;
        k.push({ transform: i === n ? 'translate(0,0)' : `translate(${rand(-amp, amp) * fall}px, ${rand(-amp, amp) * fall}px) rotate(${rand(-0.6, 0.6) * fall}deg)` });
      }
      animate(target, k, { duration: ms, easing: 'linear' });
    });
  };

  switch (scene) {
    case 'hearts': {
      const colors = [tint, shade(tint, 0.25), '#ff8fab', '#ff4f7b', '#ffc2d6'];
      wash(`radial-gradient(120% 80% at 50% 110%, ${tint}55, transparent 60%)`, 1);
      every(150, T * 0.72, 16, () => add({
        shape: 'heart', color: pick(colors), x: rand(0, W), y: H + 30, vx: rand(-20, 20), vy: rand(-170, -260),
        size: rand(10, 22), z: rand(0.6, 1.6), vf: rand(2, 5), life: rand(2600, 3800), wobble: rand(20, 50), born: rand(0, 6),
      }));
      // a heart burst behind the hero when it lands
      later(T * 0.15, () => { for (let i = 0; i < 22; i++) { const a = rand(0, TAU), v = rand(220, 520); add({ shape: 'heart', color: pick(colors), x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 2.2, size: rand(8, 16), z: rand(0.8, 1.3), life: rand(1400, 2200), vf: rand(3, 6) }); } });
      break;
    }

    case 'kiss': {
      const marks: [number, number, number][] = [];
      for (let i = 0; i < 6; i++) marks.push([rand(W * 0.1, W * 0.9), rand(H * 0.1, H * 0.85), rand(-28, 28)]);
      const lips = (c: string, id = `lk${++uid}`) => `<svg viewBox="0 0 120 80" width="100%" height="100%"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(c, 0.15)}"/><stop offset="1" stop-color="${shade(c, -0.2)}"/></linearGradient></defs>
        <path d="M8 38 C22 14 44 12 60 28 C76 12 98 14 112 38 C96 44 80 47 60 45 C40 47 24 44 8 38Z" fill="url(#${id})"/>
        <path d="M8 41 C28 45 44 49 60 49 C76 49 92 45 112 41 C98 66 78 74 60 74 C42 74 22 66 8 41Z" fill="url(#${id})"/>
        <path d="M20 34 q10 -6 20 -4 M80 30 q12 0 20 6 M24 52 q16 10 36 12 M64 64 q18 -2 32 -12" stroke="#fff" stroke-opacity=".28" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`;
      heroFrames = [
        { ...enter, offset: 0, easing: 'cubic-bezier(.2,.9,.25,1)' },
        { transform: `${at(cx, cy)} scale(1.05) rotateY(360deg)`, opacity: 1, offset: 0.14 },
      ];
      marks.forEach(([x, y, r], i) => {
        const t0 = 0.2 + i * 0.1;
        heroFrames.push({ transform: `${at(cx + (x - cx) * 0.25, cy + (y - cy) * 0.25)} scale(1.35) rotate(${r / 2}deg)`, opacity: 1, offset: t0 + 0.035 });
        heroFrames.push({ transform: `${at(cx, cy)} scale(1) rotate(0deg)`, opacity: 1, offset: t0 + 0.08 });
        later(T * (t0 + 0.035), () => {
          const size = rand(90, 130);
          const m = svgEl(lips(tint), { left: `${x - size / 2}px`, top: `${y - size / 3}px`, width: `${size}px`, height: `${size * 0.67}px`, transform: `rotate(${r}deg)`, filter: 'drop-shadow(0 2px 2px rgba(0,0,0,.12))', mixBlendMode: 'multiply' }, root);
          root.insertBefore(m, hero);
          animate(m, [{ transform: `rotate(${r}deg) scale(1.6)`, opacity: 0 }, { transform: `rotate(${r}deg) scale(0.92)`, opacity: 0.95, offset: 0.06 }, { transform: `rotate(${r}deg) scale(1)`, opacity: 0.9, offset: 0.12 }, { transform: `rotate(${r}deg) scale(1)`, opacity: 0.85, offset: 0.8 }, { transform: `rotate(${r}deg) scale(1)`, opacity: 0 }], { duration: T * (1 - t0), fill: 'forwards' });
          for (let k = 0; k < 6; k++) { const a = rand(0, TAU); add({ shape: 'heart', color: pick([tint, '#ff8fab']), x, y, vx: Math.cos(a) * rand(80, 200), vy: Math.sin(a) * rand(80, 200) - 60, drag: 2.5, size: rand(5, 9), life: 900 }); }
        });
      });
      heroFrames.push({ transform: `${at(cx, cy)} scale(1.04)`, opacity: 1, offset: 0.86 }, { ...exit, offset: 1 });
      break;
    }

    case 'hug': {
      const glow = el('div', { position: 'absolute', inset: '0', boxShadow: `inset 0 0 0 0 ${tint}00`, opacity: '0' }, root);
      root.insertBefore(glow, canvas);
      animate(glow, [
        { boxShadow: `inset 0 0 0px 0px ${tint}00`, opacity: 0 },
        { boxShadow: `inset 0 0 120px 40px ${tint}aa`, opacity: 1, offset: 0.2 },
        { boxShadow: `inset 0 0 60px 10px ${tint}66`, opacity: 1, offset: 0.35 },
        { boxShadow: `inset 0 0 140px 50px ${tint}bb`, opacity: 1, offset: 0.5 },
        { boxShadow: `inset 0 0 70px 14px ${tint}66`, opacity: 1, offset: 0.65 },
        { boxShadow: `inset 0 0 0px 0px ${tint}00`, opacity: 0 },
      ], { duration: T, fill: 'forwards', easing: 'ease-in-out' });
      heroFrames = standard.map(k => ({ ...k }));
      heroFrames.splice(4, 4, idle(0.34, 0, 0, 1.0), { transform: `${at(cx, cy)} scale(1.18, 0.9)`, opacity: 1, offset: 0.42 }, idle(0.5, -6, 0), { transform: `${at(cx, cy)} scale(1.18, 0.9)`, opacity: 1, offset: 0.58 }, idle(0.68, -8, 0));
      every(300, T * 0.7, 9, () => {
        const side = Math.floor(rand(0, 4));
        const x = side === 0 ? 0 : side === 1 ? W : rand(0, W), y = side === 2 ? 0 : side === 3 ? H : rand(0, H);
        add({ shape: 'heart', color: pick([tint, '#ffc2d6', '#ff8fab']), x, y, vx: (cx - x) * 0.45, vy: (cy - y) * 0.45, drag: 0.6, size: rand(8, 15), z: rand(0.7, 1.3), life: 2000, vf: 3 });
      });
      break;
    }

    case 'sunrise': {
      wash('linear-gradient(180deg, rgba(255,214,140,0.0), rgba(255,170,90,0.35) 70%, rgba(255,120,80,0.45))', 1);
      const rays = el('div', { position: 'absolute', left: `${cx - H}px`, top: `${cy - H}px`, width: `${H * 2}px`, height: `${H * 2}px`, borderRadius: '50%', background: 'repeating-conic-gradient(from 0deg, rgba(255,226,140,0.42) 0deg 9deg, rgba(255,226,140,0) 9deg 22deg)', maskImage: 'radial-gradient(circle, #000 0%, #000 22%, transparent 62%)', WebkitMaskImage: 'radial-gradient(circle, #000 0%, #000 22%, transparent 62%)', opacity: '0' } as Partial<CSSStyleDeclaration>, root);
      root.insertBefore(rays, canvas);
      animate(rays, [{ opacity: 0, transform: 'rotate(0deg) scale(.6)' }, { opacity: 1, transform: 'rotate(40deg) scale(1)', offset: 0.2 }, { opacity: 1, transform: 'rotate(120deg) scale(1.05)', offset: 0.85 }, { opacity: 0, transform: 'rotate(140deg) scale(1.1)' }], { duration: T, fill: 'forwards' });
      const sun = el('div', { position: 'absolute', left: `${cx - 160}px`, top: `${H}px`, width: '320px', height: '320px', borderRadius: '50%', background: 'radial-gradient(circle, #fff4c2 0%, #ffd24a 40%, rgba(255,154,31,0) 70%)' }, root);
      root.insertBefore(sun, canvas);
      animate(sun, [{ transform: 'translateY(0)', opacity: 0.2 }, { transform: `translateY(${-H * 0.62}px)`, opacity: 0.9, offset: 0.35 }, { transform: `translateY(${-H * 0.62}px)`, opacity: 0.9, offset: 0.85 }, { transform: `translateY(${-H * 0.66}px)`, opacity: 0 }], { duration: T, fill: 'forwards', easing: 'cubic-bezier(.2,.8,.3,1)' });
      every(300, T * 0.8, 22, () => add({ shape: 'spark', color: pick(['#ffe066', '#fff3bf', '#ffc078']), x: rand(0, W), y: rand(0, H * 0.9), size: rand(5, 11), life: rand(900, 1600), vf: rand(4, 8), vy: -10 }));
      break;
    }

    case 'night': {
      wash('linear-gradient(180deg, #050a24 0%, #1b2560 70%, #33307a 100%)', 0.82);
      const moon = svgEl(`<svg viewBox="0 0 100 100" width="100%" height="100%"><defs><radialGradient id="mg" cx="40%" cy="35%"><stop offset="0" stop-color="#fffbe6"/><stop offset="1" stop-color="#ffe08a"/></radialGradient></defs><circle cx="50" cy="50" r="40" fill="url(#mg)"/><circle cx="66" cy="40" r="34" fill="#0d1440" opacity=".96"/></svg>`,
        { right: `${W * 0.1}px`, top: '-140px', width: '120px', height: '120px', filter: 'drop-shadow(0 0 24px rgba(255,230,140,.6))' }, root);
      root.insertBefore(moon, canvas);
      animate(moon, [{ transform: 'translateY(0)', opacity: 0 }, { transform: 'translateY(190px)', opacity: 1, offset: 0.25 }, { transform: 'translateY(200px)', opacity: 1, offset: 0.85 }, { transform: 'translateY(210px)', opacity: 0 }], { duration: T, fill: 'forwards', easing: 'cubic-bezier(.2,.8,.3,1)' });
      for (let i = 0; i < 70; i++) add({ shape: i % 7 === 0 ? 'spark' : 'circle', color: pick(['#ffffff', '#fff3bf', '#c5d0ff']), x: rand(0, W), y: rand(0, H * 0.8), size: i % 7 === 0 ? rand(4, 7) : rand(1.5, 3.2), life: T * 0.92, vf: rand(1, 3), born: rand(0, 1), alpha: rand(0.5, 1) });
      every(900, T * 0.75, 2.2, () => add({ shape: 'z', color: '#9aa5ff', x: cx + rand(40, 90), y: cy - 40, vx: rand(10, 30), vy: -50, size: rand(22, 34), life: 1900, rot: rand(-0.3, 0.2) }));
      heroFrames = standard.map(k => ({ ...k }));
      heroFrames.splice(4, 4, idle(0.4, 6, -6, 0.98), idle(0.6, 10, -8, 0.96), idle(0.78, 6, -6, 0.98));
      break;
    }

    case 'rain': {
      wash('linear-gradient(180deg, rgba(30,45,90,0.5), rgba(70,100,160,0.35))', 1);
      every(0, T * 0.82, 110, () => add({ shape: 'streak', color: pick(['rgba(200,225,255,0.95)', 'rgba(150,190,245,0.9)']), x: rand(-40, W), y: -20, vx: 60, vy: rand(700, 1000), z: rand(0.6, 1.4), life: 1600, bounce: H - rand(10, 60) }));
      every(400, T * 0.7, 3, () => add({ shape: 'drop', color: '#6cc6ff', x: cx + rand(-60, 60), y: cy + 10, vy: 120, gravity: 900, size: rand(8, 13), life: 1200 }));
      heroFrames = standard.map(k => ({ ...k }));
      heroFrames.splice(4, 4, idle(0.36, 6, -2, 0.97), idle(0.5, 8, 2, 0.95), idle(0.64, 6, -2, 0.97), idle(0.78, 8, 1, 0.96));
      break;
    }

    case 'shake': {
      const v = el('div', { position: 'absolute', inset: '0', background: `radial-gradient(120% 90% at 50% 50%, transparent 45%, ${tint}88 100%)`, opacity: '0' }, root);
      root.insertBefore(v, canvas);
      animate(v, [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0.5, offset: 0.32 }, { opacity: 1, offset: 0.45 }, { opacity: 0.6, offset: 0.7 }, { opacity: 0 }], { duration: T, fill: 'forwards' });
      shake(T * 0.18, 650, 14);
      shake(T * 0.44, 520, 10);
      heroFrames = standard.map(k => ({ ...k }));
      heroFrames.splice(4, 4, { transform: `${at(cx, cy)} scale(1.1) rotate(-6deg)`, opacity: 1, offset: 0.3 }, { transform: `${at(cx, cy)} scale(1.12) rotate(6deg)`, opacity: 1, offset: 0.36 }, { transform: `${at(cx, cy)} scale(1.1) rotate(-5deg)`, opacity: 1, offset: 0.5 }, { transform: `${at(cx, cy)} scale(1.08) rotate(4deg)`, opacity: 1, offset: 0.56 }, idle(0.7, 0, 0, 1.04));
      every(T * 0.2, T * 0.7, 10, () => add({ shape: 'circle', color: 'rgba(255,255,255,0.9)', x: cx + pick([-1, 1]) * rand(heroSize * 0.3, heroSize * 0.45), y: cy - heroSize * 0.3, vx: rand(-40, 40), vy: rand(-120, -60), size: rand(18, 34), drag: 0.6, life: 1100 }));
      break;
    }

    case 'confetti': {
      const colors = ['#ff5c8a', '#4fc3f7', '#ffd23f', '#7ed37f', '#a78bfa', '#ff9a3c', '#ffffff'];
      const burst = (x: number, dir: number, t0: number) => later(t0, () => {
        for (let i = 0; i < 70; i++) {
          const a = (-90 + dir * rand(6, 32)) * Math.PI / 180, v = rand(H * 1.6, H * 2.5);
          add({ shape: i % 5 === 0 ? 'circle' : 'confetti', color: pick(colors), x, y: H + 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v, gravity: 900, drag: 1.5, size: rand(9, 15), z: rand(0.7, 1.3), rot: rand(0, TAU), vr: rand(-8, 8), vf: rand(6, 14), life: rand(2600, 3400), wobble: rand(30, 60) });
        }
      });
      burst(0, 1, T * 0.12); burst(W, -1, T * 0.12); burst(W * 0.5, pick([-1, 1]) * 0.3, T * 0.3);
      break;
    }

    case 'fireworks': {
      wash('linear-gradient(180deg, #050816, #121a3a)', 0.84);
      const colors = ['#ff5c8a', '#ffd23f', '#4fc3f7', '#7ed37f', '#c084fc', '#ff9a3c'];
      const rocket = (t0: number) => later(t0, () => {
        const x = rand(W * 0.15, W * 0.85), y = rand(H * 0.12, H * 0.42), c = pick(colors);
        const dur = 650;
        add({ shape: 'circle', color: '#fff7d6', x, y: H, vy: -(H - y) / (dur / 1000), size: 5, life: dur, trail: true });
        later(dur, () => {
          const n = 90;
          const reach = Math.min(W, H) * rand(0.55, 0.8);
          for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU + rand(-0.04, 0.04), v = reach * (i % 2 ? 1 : rand(0.55, 0.85));
            add({ shape: i % 3 === 0 ? 'spark' : 'circle', color: i % 4 === 0 ? '#ffffff' : c, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, gravity: 150, drag: 1.5, size: i % 3 === 0 ? 7 : 4.6, life: rand(1300, 1900), trail: true, vf: 6 });
          }
          const flash = el('div', { position: 'absolute', left: `${x - 120}px`, top: `${y - 120}px`, width: '240px', height: '240px', borderRadius: '50%', background: `radial-gradient(circle, ${c}66, transparent 65%)` }, root);
          root.insertBefore(flash, canvas);
          animate(flash, [{ opacity: 1, transform: 'scale(.4)' }, { opacity: 0, transform: 'scale(1.4)' }], { duration: 900, fill: 'forwards' });
        });
      });
      [0.12, 0.24, 0.34, 0.46, 0.55, 0.64].forEach(t0 => rocket(T * t0));
      break;
    }

    case 'sparkle':
    case 'cool': {
      const colors = scene === 'cool' ? ['#ffffff', '#e0f2ff', '#c7d2fe'] : [tint === '#ff5c8a' ? '#ffd23f' : tint, '#ffffff', '#fff3bf', shade(tint, 0.4)];
      every(200, T * 0.8, 46, () => { const a = rand(0, TAU), r = rand(heroSize * 0.4, Math.max(W, H) * 0.55); add({ shape: pick(['spark', 'spark', 'star'] as const), color: pick(colors), x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, size: rand(9, 20), life: rand(700, 1400), vf: rand(4, 9), vy: -12 }); });
      const sweep = el('div', { position: 'absolute', top: '-20%', left: '-60%', width: '50%', height: '140%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)', transform: 'rotate(18deg)', mixBlendMode: 'soft-light' }, root);
      animate(sweep, [{ transform: 'translateX(0) rotate(18deg)' }, { transform: `translateX(${W * 2.6}px) rotate(18deg)` }], { duration: 1300, delay: T * 0.2, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
      if (scene === 'cool') {
        wash('linear-gradient(180deg, rgba(10,14,30,0.25), rgba(10,14,30,0.15))', 1);
        heroFrames = standard.map(k => ({ ...k }));
        heroFrames.splice(4, 4, idle(0.36, -6, -8, 1.06), idle(0.52, -6, -8, 1.06), idle(0.7, -4, -6, 1.04));
      }
      break;
    }

    case 'splat':
    case 'melt': {
      const goo = (cx0: number, cy0: number, r: number, color: string, drips: number, delay: number, life: number) => {
        const gid = `gg${++uid}`;
        // A paint splat: a soft, lumpy body with a few thin splatter arms that end in round drops.
        const n = 26;
        const pts: [number, number][] = [];
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU;
          const rr = r * (0.86 + 0.14 * Math.sin(a * 3 + r) + rand(-0.06, 0.06));
          pts.push([100 + Math.cos(a) * rr, 100 + Math.sin(a) * rr]);
        }
        const arms = Array.from({ length: 5 + Math.floor(rand(0, 3)) }, () => {
          const a = rand(0, TAU), len = r * rand(1.25, 1.9), w0 = r * rand(0.16, 0.26), w1 = r * rand(0.06, 0.1);
          const ux = Math.cos(a), uy = Math.sin(a), px = -uy, py = ux;
          const x0 = 100 + ux * r * 0.6, y0 = 100 + uy * r * 0.6, x1 = 100 + ux * len, y1 = 100 + uy * len;
          const d = `M${(x0 + px * w0).toFixed(1)} ${(y0 + py * w0).toFixed(1)} L${(x1 + px * w1).toFixed(1)} ${(y1 + py * w1).toFixed(1)} L${(x1 - px * w1).toFixed(1)} ${(y1 - py * w1).toFixed(1)} L${(x0 - px * w0).toFixed(1)} ${(y0 - py * w0).toFixed(1)}Z`;
          return `<path d="${d}" fill="url(#${gid})"/><circle cx="${(x1 + ux * w1).toFixed(1)}" cy="${(y1 + uy * w1).toFixed(1)}" r="${(w1 * 1.9).toFixed(1)}" fill="url(#${gid})"/>`;
        }).join('');
        const droplets = Array.from({ length: 6 }, () => { const a = rand(0, TAU), d = r * rand(1.35, 1.75); return `<circle cx="${(100 + Math.cos(a) * d).toFixed(1)}" cy="${(100 + Math.sin(a) * d).toFixed(1)}" r="${rand(3, 8).toFixed(1)}" fill="url(#${gid})"/>`; }).join('');
        const dripEls = Array.from({ length: drips }, (_, i) => {
          const x = 100 + rand(-r * 0.7, r * 0.7), w = rand(8, 15), len = rand(70, 220);
          return `<g class="d" style="transform-origin:${x.toFixed(1)}px 100px"><path d="M${(x - w / 2).toFixed(1)} 100 V${(100 + len).toFixed(1)} a${(w / 2).toFixed(1)} ${(w / 2).toFixed(1)} 0 0 0 ${w.toFixed(1)} 0 V100Z" fill="url(#${gid})"/><circle cx="${x.toFixed(1)}" cy="${(100 + len + w * 0.2).toFixed(1)}" r="${(w * 0.75).toFixed(1)}" fill="url(#${gid})"/></g>`.replace('class="d"', `class="d${i}"`);
        }).join('');
        const svg = `<svg viewBox="0 0 200 420" width="100%" height="100%" style="overflow:visible"><defs><radialGradient id="${gid}" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="${shade(color, 0.55)}"/><stop offset=".5" stop-color="${color}"/><stop offset="1" stop-color="${shade(color, -0.3)}"/></radialGradient></defs>
          ${dripEls}${arms}<path d="${blobPath(pts)}" fill="url(#${gid})"/>${droplets}
          <ellipse cx="${(100 - r * 0.35).toFixed(1)}" cy="${(100 - r * 0.4).toFixed(1)}" rx="${(r * 0.32).toFixed(1)}" ry="${(r * 0.16).toFixed(1)}" fill="#fff" opacity=".6" transform="rotate(-30 ${(100 - r * 0.35).toFixed(1)} ${(100 - r * 0.4).toFixed(1)})"/>
          <circle cx="${(100 + r * 0.3).toFixed(1)}" cy="${(100 - r * 0.5).toFixed(1)}" r="${(r * 0.07).toFixed(1)}" fill="#fff" opacity=".7"/></svg>`;
        const size = 200 * (r / 60) * 0.6 + 60;
        const box = svgEl(svg, { left: `${cx0 - size / 2}px`, top: `${cy0 - size / 2}px`, width: `${size}px`, height: `${size * 2.1}px`, filter: 'drop-shadow(0 6px 8px rgba(0,0,0,.22))', opacity: '0' }, root);
        root.insertBefore(box, hero);
        later(delay, () => {
          animate(box, [{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1.12, .9)', opacity: 1, offset: 0.05 }, { transform: 'scale(.96, 1.04)', opacity: 1, offset: 0.1 }, { transform: 'scale(1)', opacity: 1, offset: 0.15 }, { transform: 'scale(1) translateY(14px)', opacity: 1, offset: 0.82 }, { transform: 'scale(1) translateY(22px)', opacity: 0 }], { duration: life, fill: 'forwards', easing: 'ease-out' });
          box.querySelectorAll<SVGGElement>('g[class^="d"]').forEach((d, i) => {
            animate(d, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(0.15)', offset: 0.12 }, { transform: 'scaleY(1)' }], { duration: life * rand(0.7, 0.95), delay: i * 60, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' });
          });
        });
      };

      if (scene === 'splat') {
        // The sticker is thrown at the glass; on impact it bursts into paint.
        const impact = 0.2;
        heroFrames = [
          { ...enter, offset: 0, easing: 'cubic-bezier(.5,0,.9,.4)' },
          { transform: `${at(cx, cy)} scale(2.6) rotate(-12deg)`, opacity: 1, offset: impact },
          { transform: `${at(cx, cy)} scale(3.1, 2.2) rotate(-12deg)`, opacity: 0, offset: impact + 0.03 },
          { transform: `${at(cx, cy)} scale(0.6)`, opacity: 0, offset: 0.8 },
          { transform: `${at(cx, cy)} scale(1)`, opacity: 1, offset: 0.88, easing: 'cubic-bezier(.2,.9,.25,1)' },
          { ...exit, offset: 1 },
        ];
        later(T * impact, () => {
          const flash = el('div', { position: 'absolute', inset: '0', background: `radial-gradient(circle at ${cx}px ${cy}px, ${tint}66, transparent 55%)` }, root);
          animate(flash, [{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' });
          for (let i = 0; i < 40; i++) { const a = rand(0, TAU), v = rand(400, 1100); add({ shape: 'blob', color: tint, x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, gravity: 1400, drag: 1.6, size: rand(4, 11), life: rand(700, 1200) }); }
        });
        shake(T * impact, 380, 9);
        const spots: [number, number, number][] = [[cx, cy, 64], [W * 0.18, H * 0.22, 40], [W * 0.82, H * 0.3, 46], [W * 0.25, H * 0.68, 36], [W * 0.78, H * 0.72, 42], [W * 0.55, H * 0.12, 28], [W * 0.1, H * 0.48, 26]];
        spots.forEach(([x, y, r], i) => goo(x, y, r, i % 2 ? shade(tint, -0.08) : tint, i === 0 ? 5 : 2 + Math.floor(rand(0, 3)), T * impact + i * 45, T * (1 - impact) - i * 45));
      } else {
        // Melt: the top of the chat melts down in paint, the sticker slumps.
        const band = `<svg viewBox="0 0 400 260" preserveAspectRatio="none" width="100%" height="100%"><defs><linearGradient id="mb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(tint, 0.2)}"/><stop offset="1" stop-color="${tint}"/></linearGradient></defs>
          <path d="M0 0 H400 V60 ${Array.from({ length: 10 }, (_, i) => { const x = 400 - i * 40; const len = rand(70, 200); return `C${x - 4} 60 ${x - 8} ${len} ${x - 20} ${len} C${x - 32} ${len} ${x - 36} 60 ${x - 40} 60`; }).join(' ')} Z" fill="url(#mb)"/>
          <path d="M10 20 H390" stroke="#fff" stroke-opacity=".35" stroke-width="6" stroke-linecap="round"/></svg>`;
        const top = svgEl(band, { left: '0', top: '0', width: '100%', height: `${H * 0.55}px`, transformOrigin: 'top center', filter: 'drop-shadow(0 8px 10px rgba(0,0,0,.18))' }, root);
        root.insertBefore(top, hero);
        animate(top, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(.35)', offset: 0.2 }, { transform: 'scaleY(1)', offset: 0.8 }, { transform: 'scaleY(1.05)', opacity: 0 }], { duration: T, fill: 'forwards', easing: 'cubic-bezier(.5,0,.6,1)' });
        heroFrames = standard.map(k => ({ ...k }));
        heroFrames.splice(4, 4, idle(0.36, 10, 0, 1), { transform: `${at(cx, cy + 40)} scale(1.15, .8)`, opacity: 1, offset: 0.55 }, { transform: `${at(cx, cy + 70)} scale(1.3, .62)`, opacity: 1, offset: 0.75 });
        goo(cx, cy + heroSize * 0.42, 70, tint, 3, T * 0.5, T * 0.5);
      }
      break;
    }

    case 'boom': {
      heroFrames = [
        { transform: `${at(cx, -heroSize)} scale(1.1) rotate(-14deg)`, opacity: 1, offset: 0, easing: 'cubic-bezier(.55,0,1,.45)' },
        { transform: `${at(cx, cy)} scale(1.25, .78) rotate(0deg)`, opacity: 1, offset: 0.16 },
        { transform: `${at(cx, cy - 30)} scale(.92, 1.1)`, opacity: 1, offset: 0.22 },
        { transform: `${at(cx, cy)} scale(1.04)`, opacity: 1, offset: 0.28 },
        idle(0.5, -8, -2), idle(0.7, 0, 2),
        { transform: `${at(cx, cy - 10)} scale(1.06)`, opacity: 1, offset: 0.86 },
        { ...exit, offset: 1 },
      ];
      later(T * 0.16, () => {
        const ring = el('div', { position: 'absolute', left: `${cx - 60}px`, top: `${cy - 60}px`, width: '120px', height: '120px', borderRadius: '50%', border: `10px solid ${hex(o.tint, '#ffd23f')}`, boxShadow: '0 0 30px rgba(255,255,255,.8)' }, root);
        root.insertBefore(ring, hero);
        animate(ring, [{ transform: 'scale(.3)', opacity: 1 }, { transform: `scale(${Math.max(W, H) / 60})`, opacity: 0, borderWidth: '2px' }], { duration: 900, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
        const flash = el('div', { position: 'absolute', inset: '0', background: '#fff' }, root);
        animate(flash, [{ opacity: 0.85 }, { opacity: 0 }], { duration: 380, fill: 'forwards' });
        const cracks = Array.from({ length: 9 }, (_, i) => {
          const a = (i / 9) * TAU + rand(-0.2, 0.2);
          let x = cx, y = cy + heroSize * 0.25;
          let d = `M${x.toFixed(0)} ${y.toFixed(0)}`;
          const len = Math.max(W, H) * rand(0.25, 0.55), steps = 6;
          for (let k = 0; k < steps; k++) { x += Math.cos(a + rand(-0.5, 0.5)) * len / steps; y += Math.sin(a + rand(-0.5, 0.5)) * len / steps; d += ` L${x.toFixed(0)} ${y.toFixed(0)}`; }
          return `<path d="${d}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" class="c"/>`;
        }).join('');
        const glass = svgEl(`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><g fill="none" stroke="rgba(255,255,255,.95)" stroke-width="2.4" stroke-linejoin="round" style="filter:drop-shadow(0 0 1px rgba(0,0,0,.6))">${cracks}</g></svg>`, { left: '0', top: '0', width: `${W}px`, height: `${H}px` }, root);
        root.insertBefore(glass, hero);
        glass.querySelectorAll('path').forEach(p => animate(p, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 420, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }));
        animate(glass, [{ opacity: 1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: T * 0.82, fill: 'forwards' });
        for (let i = 0; i < 46; i++) { const a = rand(0, TAU), v = rand(300, 900); add({ shape: pick(['circle', 'spark', 'confetti'] as const), color: pick(['#ffd23f', '#ffffff', '#ff9a3c', hex(o.tint, '#ffd23f')]), x: cx, y: cy + heroSize * 0.3, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 200, gravity: 1200, drag: 1.2, size: rand(4, 10), life: rand(800, 1400), vr: rand(-10, 10), vf: 8 }); }
      });
      shake(T * 0.16, 700, 16);
      break;
    }

    case 'money': {
      every(100, T * 0.75, 26, () => {
        const bill = Math.random() < 0.4;
        add({ shape: bill ? 'bill' : 'coin', color: '#ffcf3f', x: rand(0, W), y: -40, vx: rand(-40, 40), vy: rand(160, 320), gravity: bill ? 60 : 420, drag: bill ? 0.6 : 0.2, size: bill ? rand(18, 26) : rand(11, 17), z: rand(0.7, 1.3), rot: rand(-0.6, 0.6), vr: bill ? rand(-2, 2) : 0, vf: bill ? rand(3, 6) : rand(6, 12), life: 3200, wobble: bill ? rand(40, 90) : 0 });
      });
      wash('radial-gradient(120% 90% at 50% 100%, rgba(255,207,63,.35), transparent 60%)', 1);
      break;
    }

    case 'fire': {
      wash('linear-gradient(0deg, rgba(255,90,0,.45), rgba(255,140,0,.12) 45%, transparent 70%)', 1);
      every(0, T * 0.85, 75, () => add({ shape: 'flame', color: pick(['rgba(255,120,0,0.55)', 'rgba(255,70,20,0.5)', 'rgba(255,190,60,0.55)']), x: rand(-20, W + 20), y: H + 20, vx: rand(-20, 20), vy: rand(-240, -400), size: rand(18, 40), drag: 0.4, life: rand(800, 1300), wobble: rand(20, 60) }));
      every(300, T * 0.8, 20, () => add({ shape: 'circle', color: '#ffd27a', x: rand(0, W), y: H, vx: rand(-30, 30), vy: rand(-200, -380), size: rand(2, 4), life: rand(1400, 2200), wobble: 60 }));
      break;
    }

    case 'dash': {
      heroFrames = [
        { transform: `${at(-heroSize, cy + 40)} scale(.8) skewX(-12deg)`, opacity: 1, offset: 0, easing: 'cubic-bezier(.3,0,.2,1)' },
        { transform: `${at(W + heroSize, cy + 40)} scale(.8) skewX(-18deg)`, opacity: 1, offset: 0.24 },
        { transform: `${at(W + heroSize, cy - 30)} scale(-.8, .8) skewX(18deg)`, opacity: 1, offset: 0.3, easing: 'cubic-bezier(.3,0,.2,1)' },
        { transform: `${at(-heroSize, cy - 30)} scale(-.8, .8) skewX(18deg)`, opacity: 1, offset: 0.54 },
        { transform: `${at(cx, cy)} scale(1.1)`, opacity: 1, offset: 0.66, easing: 'cubic-bezier(.2,.9,.25,1)' },
        idle(0.78, -6, 0),
        { transform: `${at(cx, cy - 8)} scale(1.04)`, opacity: 1, offset: 0.86 },
        { ...exit, offset: 1 },
      ];
      const puff = (t0: number, y: number, dir: number) => every(T * t0, T * (t0 + 0.24), 26, () => add({ shape: 'circle', color: 'rgba(220,226,238,0.95)', x: 0, y: y + rand(-10, 30), vx: -dir * rand(30, 80), vy: rand(-40, -10), size: rand(16, 36), drag: 1, life: 900, born: 1 }));
      puff(0, cy + 40 + heroSize * 0.35, 1);
      puff(0.3, cy - 30 + heroSize * 0.35, -1);
      // dust follows the hero: place each puff where the hero is at that moment
      const pathX = (t: number) => t < 0.24 ? -heroSize + (W + 2 * heroSize) * (t / 0.24) : t < 0.3 ? W + heroSize : t < 0.54 ? W + heroSize - (W + 2 * heroSize) * ((t - 0.3) / 0.24) : cx;
      spawners.push((t) => { for (const p of ps) if (p.born === 1 && p.age === 0) { p.x = pathX(t / T); p.born = 2; } });
      break;
    }

    case 'bubbles': {
      every(100, T * 0.75, 18, () => add({ shape: 'bubble', color: '#ffffff', x: rand(0, W), y: H + 40, vx: rand(-20, 20), vy: rand(-90, -180), size: rand(14, 40), z: rand(0.7, 1.3), life: rand(2400, 3600), wobble: rand(30, 70) }));
      break;
    }

    case 'jelly': {
      every(100, T * 0.6, 16, () => add({ shape: 'blob', color: pick([tint, shade(tint, 0.2), '#ff8fab', '#7dd3fc', '#ffd23f']), x: rand(20, W - 20), y: -30, vx: rand(-60, 60), vy: rand(60, 200), gravity: 1300, size: rand(12, 24), life: 3200, bounce: H - rand(10, 40), wobble: 2 }));
      heroFrames = standard.map(k => ({ ...k }));
      heroFrames.splice(4, 4, { transform: `${at(cx, cy + 10)} scale(1.15, .85)`, opacity: 1, offset: 0.32 }, idle(0.4, -40, -6, 1), { transform: `${at(cx, cy + 10)} scale(1.15, .85)`, opacity: 1, offset: 0.5 }, idle(0.58, -40, 6, 1), { transform: `${at(cx, cy + 10)} scale(1.12, .88)`, opacity: 1, offset: 0.68 }, idle(0.78, -10, 0, 1));
      break;
    }
  }

  animate(hero, heroFrames, { duration: T, fill: 'forwards' });
  animate(root, [{ opacity: 1 }, { opacity: 1, offset: 0.9 }, { opacity: 0 }], { duration: T, fill: 'forwards' });

  /* Particle loop */
  const t0 = performance.now();
  let last = t0;
  const step = (now: number) => {
    if (finished) return;
    const t = now - t0;
    const dt = Math.min(48, now - last);
    last = now;
    for (const s of spawners) s(t, dt);
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const fade = t > T * 0.88 ? Math.max(0, 1 - (t - T * 0.88) / (T * 0.12)) : 1;
      const sec = dt / 1000;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.age += dt;
        if (p.age >= p.life) { ps.splice(i, 1); continue; }
        p.vy += p.gravity * sec;
        if (p.drag) { const k = Math.max(0, 1 - p.drag * sec); p.vx *= k; p.vy *= k; }
        p.x += (p.vx + (p.wobble ? Math.sin(p.age / 260 + p.size) * p.wobble : 0)) * sec;
        p.y += p.vy * sec;
        p.rot += p.vr * sec;
        p.flip += p.vf * sec;
        if (p.bounce !== undefined && p.y > p.bounce) {
          if (p.shape === 'streak') {
            add({ shape: 'circle', color: 'rgba(190,220,255,0.7)', x: p.x, y: p.bounce, vx: rand(-60, 60), vy: rand(-140, -60), gravity: 600, size: 2.4, life: 300 });
            ps.splice(i, 1);
            continue;
          }
          p.y = p.bounce;
          p.vy = -Math.abs(p.vy) * 0.45;
          p.vx *= 0.8;
          p.wobble = 3;
        }
        if (p.trail && ctx) { ctx.globalAlpha = 0.25 * fade; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x - p.vx * 0.02, p.y - p.vy * 0.02, p.size * 0.6, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
        drawParticle(ctx, p, fade);
      }
    }
    if (t >= T) { cleanup(); return; }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  later(T + 400, cleanup); // in case frames stop (tab hidden)
  window.addEventListener('pagehide', cleanup);

  return { done, cancel: cleanup };
}
