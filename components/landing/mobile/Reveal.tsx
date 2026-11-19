'use client';
/**
 * The phone landing's only scroll-related code, run once at load (budget: under 1 KB).
 *
 *  - Reveal: sections below the fold at load get `pending` (opacity 0, 12 px down). One
 *    IntersectionObserver adds `in` the first time each one nears the screen (240 ms, transform and
 *    opacity only), then the classes are removed and the observer stops watching it. Nothing runs
 *    per scroll frame; without JavaScript, or with reduced motion, everything is simply visible.
 *  - Loops: a muted inline loop plays only while on screen, never with Save-Data or reduced motion,
 *    and never seeks with the scroll.
 *  - /?debug=scroll loads a frame meter (a separate chunk, only then).
 */
import { useEffect } from 'react';

export function Reveal() {
  useEffect(() => {
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lite = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    if (!still && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => {
        for (const e of es) {
          if (!e.isIntersecting) continue;
          const t = e.target as HTMLElement;
          io.unobserve(t);
          t.classList.add('in');
          setTimeout(() => t.classList.remove('pending', 'in'), 300);
        }
      }, { rootMargin: '0px 0px -8% 0px' });
      for (const el of document.querySelectorAll<HTMLElement>('[data-reveal]')) {
        if (el.getBoundingClientRect().top > innerHeight) { el.classList.add('pending'); io.observe(el); }
      }
    }
    if (!still && !lite) {
      const vo = new IntersectionObserver((es) => {
        for (const e of es) {
          const v = e.target as HTMLVideoElement;
          if (e.isIntersecting) v.play().catch(() => undefined); else v.pause();
        }
      }, { threshold: 0.25 });
      for (const v of document.querySelectorAll<HTMLVideoElement>('video[data-loop]')) {
        v.addEventListener('playing', () => v.classList.add('on'), { once: true });
        vo.observe(v);
      }
    }
    if (location.search.includes('debug=scroll')) import('./ScrollDebug').then((m) => m.mount());
  }, []);
  return null;
}
