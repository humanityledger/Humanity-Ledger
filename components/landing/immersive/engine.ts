'use client';
/**
 * The landing's one scroll loop. Native scroll, never hijacked: a passive listener only asks for
 * a frame; the frame reads scrollY once and writes one CSS variable (--p, the scene's progress)
 * per scene that changed. Layout is measured
 * on load and in a ResizeObserver, never in the loop. No React state per frame, and no page-wide
 * variable: --p is a registered, non-inherited number, so only the elements that read it restyle.
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
/** The element that scrolls the page: on "/" the layout scrolls inside <main>, elsewhere the window. */
let scroller: HTMLElement | null = null;
const scrollTop = () => (scroller ? scroller.scrollTop : window.scrollY);

function findScroller(el: HTMLElement): HTMLElement | null {
  for (let n = el.parentElement; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if (oy === 'auto' || oy === 'scroll') return n;
  }
  return null;
}
let vh = 0;
let frame = 0;

function measure() {
  vh = scroller ? scroller.clientHeight : window.innerHeight;
  const y = scrollTop();
  const origin = scroller ? scroller.getBoundingClientRect().top : 0;
  for (const s of scenes) {
    const r = s.el.getBoundingClientRect();
    s.top = r.top - origin + y;
    s.height = r.height;
  }
  request();
}

function tick() {
  frame = 0;
  const y = scrollTop();
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
}

function request() {
  if (!frame) frame = requestAnimationFrame(tick);
}

/** Starts the loop for every [data-scene] under el. Returns the cleanup. */
export function startScenes(el: HTMLElement): () => void {
  scenes.length = 0;
  el.querySelectorAll<HTMLElement>('[data-scene]').forEach((s) => scenes.push({ el: s, top: 0, height: 0, p: -1, near: false }));
  el.setAttribute('data-scenes', String(scenes.length));
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    for (const s of scenes) s.el.style.setProperty('--p', '1');
    return () => undefined;
  }
  scroller = findScroller(el);
  const target: HTMLElement | Window = scroller ?? window;
  const ro = new ResizeObserver(measure);
  ro.observe(el);
  if (scroller) ro.observe(scroller);
  target.addEventListener('scroll', request, { passive: true });
  target.addEventListener('scrollend', request, { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  document.fonts?.ready.then(measure).catch(() => undefined);
  measure();
  return () => {
    ro.disconnect();
    target.removeEventListener('scroll', request);
    target.removeEventListener('scrollend', request);
    window.removeEventListener('resize', measure);
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    scenes.length = 0;
    scroller = null;
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
