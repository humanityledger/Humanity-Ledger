'use client';
/**
 * The landing's one scroll loop. Native scroll, never hijacked: a passive listener only asks for
 * a frame; the frame reads scrollTop once and writes, per scene that changed, two registered
 * CSS numbers. Layout is measured on load and in a ResizeObserver, never in the loop. No React
 * state per frame.
 *
 *  --p   the scene's own progress, 0..1, while its picture is fully on screen;
 *  --in  0..1 while the scene fades in over the one before it.
 *
 * Consecutive pinned scenes overlap by one screen plus a fade (the CSS gives each scene after
 * the first a negative top margin). The next scene pins while the previous one is still pinned
 * and fades in over it, so scrolling never shows a half-scrolled, empty or cut-off frame, with
 * the wheel or the finger. Scrolling up runs the same frames backwards.
 *
 * The loop also marks the page as scrolled (the navigation's border) and the section in view
 * (the navigation's current link), from positions measured once.
 */
import { clamp01 } from '@/lib/landing/progress';

type Listener = (p: number, near: boolean) => void;
interface Scene { el: HTMLElement; top: number; height: number; fadeIn: number; fadeOut: number; p: number; i: number; near: boolean }
interface Spy { id: string; top: number }

const scenes: Scene[] = [];
const spies: Spy[] = [];
const listeners = new Map<HTMLElement, Set<Listener>>();
let root: HTMLElement | null = null;
let links: HTMLAnchorElement[] = [];
/** The element that scrolls the page: the window on "/" (ClientLayout leaves the landing unbounded); a nested scroller is followed if a layout adds one. */
let scroller: HTMLElement | null = null;
const scrollTop = () => (scroller ? scroller.scrollTop : window.scrollY);
let vh = 0;
let frame = 0;
let scrolled: boolean | null = null;
let active: string | null = null;

function findScroller(el: HTMLElement): HTMLElement | null {
  for (let n = el.parentElement; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if (oy === 'auto' || oy === 'scroll') return n;
  }
  return null;
}

/** Pure: the two numbers of a scene at scroll position y. Exported for the unit test. */
export function sceneState(y: number, s: { top: number; height: number; fadeIn: number; fadeOut: number }, viewport: number) {
  const start = s.top + s.fadeIn;
  const end = s.top + s.height - viewport - s.fadeOut;
  const p = end <= start ? (y >= start ? 1 : 0) : clamp01((y - start) / (end - start));
  const inn = s.fadeIn > 0 ? clamp01((y - s.top) / s.fadeIn) : 1;
  return { p, in: inn };
}

function measure() {
  if (!root) return;
  vh = scroller ? scroller.clientHeight : window.innerHeight;
  const y = scrollTop();
  const origin = scroller ? scroller.getBoundingClientRect().top : 0;
  for (let k = 0; k < scenes.length; k++) {
    const s = scenes[k];
    const r = s.el.getBoundingClientRect();
    s.top = r.top - origin + y;
    s.height = r.height;
    // The overlap with the scene before is in its negative top margin: one screen plus the fade.
    const mt = parseFloat(getComputedStyle(s.el).marginTop) || 0;
    s.fadeIn = mt < 0 ? Math.max(0, -mt - vh) : 0;
  }
  for (let k = 0; k < scenes.length; k++) scenes[k].fadeOut = scenes[k + 1]?.fadeIn ?? 0;
  for (const sp of spies) {
    const el = document.getElementById(sp.id);
    sp.top = el ? el.getBoundingClientRect().top - origin + y : Infinity;
    // A scene's own content starts after its fade-in.
    const sc = scenes.find((x) => x.el === el);
    if (sc) sp.top += sc.fadeIn;
  }
  request();
}

function tick() {
  frame = 0;
  const y = scrollTop();
  for (const s of scenes) {
    const st = sceneState(y, s, vh);
    const near = y + vh * 1.5 > s.top && y < s.top + s.height + vh * 0.5;
    if (Math.abs(st.p - s.p) > 1e-4) {
      s.p = st.p;
      s.el.style.setProperty('--p', st.p.toFixed(4));
    }
    if (Math.abs(st.in - s.i) > 1e-4) {
      s.i = st.in;
      s.el.style.setProperty('--in', st.in.toFixed(4));
    }
    if (near !== s.near) {
      s.near = near;
      s.el.toggleAttribute('data-near', near);
    }
    const subs = listeners.get(s.el);
    if (subs) for (const f of subs) f(s.p, s.near);
  }
  if (root) {
    const sc = y > 8;
    if (sc !== scrolled) {
      scrolled = sc;
      root.toggleAttribute('data-scrolled', sc);
    }
    let cur: string | null = null;
    for (const sp of spies) if (y + vh * 0.5 >= sp.top) cur = sp.id;
    if (cur !== active) {
      active = cur;
      for (const a of links) {
        if (a.hash === `#${cur}`) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      }
    }
  }
}

function request() {
  if (!frame) frame = requestAnimationFrame(tick);
}

/** When a scroll ends (a jump with Home or End included), write the final state right away. */
function settle() {
  if (frame) cancelAnimationFrame(frame);
  tick();
}

/** Starts the loop for every [data-scene] under el. Returns the cleanup. */
export function startScenes(el: HTMLElement): () => void {
  root = el;
  scenes.length = 0;
  spies.length = 0;
  el.querySelectorAll<HTMLElement>('[data-scene]').forEach((s) => scenes.push({ el: s, top: 0, height: 0, fadeIn: 0, fadeOut: 0, p: -1, i: -1, near: false }));
  links = Array.from(el.querySelectorAll<HTMLAnchorElement>('[data-spy-nav] a[href^="#"]'));
  for (const a of links) {
    const id = a.hash.slice(1);
    if (id && !spies.some((x) => x.id === id)) spies.push({ id, top: Infinity });
  }
  el.setAttribute('data-scenes', String(scenes.length));

  // The phone menu closes when one of its links is followed.
  const onClick = (e: MouseEvent) => {
    const a = (e.target as Element | null)?.closest?.('a');
    const menu = a?.closest('details');
    if (menu) menu.removeAttribute('open');
  };
  el.addEventListener('click', onClick);

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    for (const s of scenes) {
      s.el.style.setProperty('--p', '1');
      s.el.style.setProperty('--in', '1');
    }
    return () => {
      el.removeEventListener('click', onClick);
      root = null;
    };
  }
  scroller = findScroller(el);
  const ro = new ResizeObserver(measure);
  ro.observe(el);
  if (scroller) ro.observe(scroller);
  // Which element scrolls the page depends on the layout and the device (on phones the document
  // may scroll instead of <main>). Listen in the capture phase, where every scroll arrives, and
  // follow the element that actually moved.
  const onScroll = (e: Event) => {
    const t = e.target;
    const sc = t instanceof HTMLElement && t !== document.documentElement && t !== document.body ? t : null;
    if (sc !== scroller && (sc === null || sc.contains(el))) {
      scroller = sc;
      measure();
    }
    request();
  };
  const onEnd = () => settle();
  window.addEventListener('scroll', onScroll, { passive: true, capture: true });
  window.addEventListener('scrollend', onEnd, { passive: true, capture: true });
  window.addEventListener('resize', measure, { passive: true });
  document.fonts?.ready.then(measure).catch(() => undefined);
  measure();
  return () => {
    ro.disconnect();
    el.removeEventListener('click', onClick);
    window.removeEventListener('scroll', onScroll, { capture: true });
    window.removeEventListener('scrollend', onEnd, { capture: true });
    window.removeEventListener('resize', measure);
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    scenes.length = 0;
    spies.length = 0;
    links = [];
    scroller = null;
    root = null;
    scrolled = null;
    active = null;
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
