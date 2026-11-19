'use client';
/**
 * The part of the screen the user can see: the layout viewport minus an open keyboard
 * (visualViewport), and the safe-area insets of notched phones. Updates on resize, rotation and
 * keyboard changes.
 */
import { useEffect, useState } from 'react';
import type { Viewport } from '@/lib/activities/geometry';

function readInsets(): Viewport['insets'] {
  if (typeof document === 'undefined') return { top: 0, right: 0, bottom: 0, left: 0 };
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const insets = { top: parseFloat(cs.paddingTop) || 0, right: parseFloat(cs.paddingRight) || 0, bottom: parseFloat(cs.paddingBottom) || 0, left: parseFloat(cs.paddingLeft) || 0 };
  probe.remove();
  return insets;
}

function read(insets: Viewport['insets']): Viewport {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  return {
    width: vv?.width ?? window.innerWidth,
    height: vv?.height ?? window.innerHeight,
    offsetTop: vv?.offsetTop ?? 0,
    insets,
  };
}

export function useViewport(): Viewport | null {
  const [vp, setVp] = useState<Viewport | null>(null);
  useEffect(() => {
    let insets = readInsets();
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setVp(read(insets)));
    };
    const onRotate = () => { insets = readInsets(); update(); };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', onRotate);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', onRotate);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, []);
  return vp;
}
