'use client';
/**
 * The landing's one scroll loop. Native scroll, never hijacked: a passive listener only asks for
 * a frame; the frame reads scrollY once and writes one CSS variable (--p, the scene's progress)
 * per scene that changed, plus --page on the page root for the progress bar. Layout is measured
 * on load and in a ResizeObserver, never in the loop. No React state per frame.
 *
 * Why a loop and not `animation-timeline` driving --p: animating a custom property from a scroll
 * timeline is recomputed on the main thread too, and the loop gives one behaviour in every
 * browser (Safari and Firefox included). The cost is a handful of setProperty calls per frame.
 */
import { sceneProgress } from '@/lib/landing/progress';

type Listener = (p: number, near: boolean) => void;
interface Scene { el: HTMLElement; top: number; height: number; p: number; near: boolean }

const scenes: Scene[] = [];
const listeners = new Map<HTMLElement, Set<Listener>>();
let root: HTMLElement | null = null;
let vh = 0;
let docRun = 1;
let frame = 0;
let lastPage = -1;

function measure() {
  vh = window.innerHeight;
  const y = window.scrollY;
  for (const s of scenes) {
    const r = s.el.getBoundingClientRect();
    s.top = r.top + y;
    s.height = r.height;
  }
  docRun = Math.max(1, document.documentElement.scrollHeight - vh);
  request();
}

function tick() {
  frame = 0;
  const y = window.scrollY;
  for (const s of scenes) {
    const p = sceneProgress(y, s.top, s.height, vh);
    const near = y + vh * 1.5 > s.top && y < s.top + s.height + vh * 0.5;
    if (Math.abs(p - s.p) > 1e-4) {
      s.p = p;
      s.el.style.setProperty('--p', p.toFixed(4));
    }
    if (near !== s.near) {
      s.near = near;
      s.el.toggleAttribute('data-near', near);
    }
    const subs = listeners.get(s.el);
    if (subs) for (const f of subs) f(s.p, s.near);
  }
  const page = Math.min(1, Math.max(0, y / docRun));
  if (root && Math.abs(page - lastPage) > 1e-4) {
    lastPage = page;
    root.style.setProperty('--page', page.toFixed(4));
  }
}

function request() {
  if (!frame) frame = requestAnimationFrame(tick);
}

/** Starts the loop for every [data-scene] under el. Returns the cleanup. */
export function startScenes(el: HTMLElement): () => void {
  root = el;
  scenes.length = 0;
  el.querySelectorAll<HTMLElement>('[data-scene]').forEach((s) => scenes.push({ el: s, top: 0, height: 0, p: -1, near: false }));
  el.setAttribute('data-scenes', String(scenes.length));
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    for (const s of scenes) s.el.style.setProperty('--p', '1');
    return () => undefined;
  }
  const ro = new ResizeObserver(measure);
  ro.observe(el);
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  document.fonts?.ready.then(measure).catch(() => undefined);
  measure();
  return () => {
    ro.disconnect();
    window.removeEventListener('scroll', request);
    window.removeEventListener('resize', measure);
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    scenes.length = 0;
    root = null;
  };
}

/** Calls f with the progress of the scene that contains el, every frame it is computed. */
export function onScene(el: HTMLElement, f: Listener): () => void {
  const scene = el.closest<HTMLElement>('[data-scene]');
  if (!scene) return () => undefined;
  let set = listeners.get(scene);
  if (!set) listeners.set(scene, (set = new Set()));
  set.add(f);
  const s = scenes.find((x) => x.el === scene);
  if (s) f(Math.max(0, s.p), s.near);
  request();
  return () => set!.delete(f);
}
