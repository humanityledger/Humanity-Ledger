import { describe, expect, it } from 'vitest';
import { cornerByKey, cornerPoint, EDGE, ISLAND_CLEARANCE, nearestCorner, windowBox, type Viewport } from '@/lib/activities/geometry';

const desktop: Viewport = { width: 1440, height: 900, offsetTop: 0, insets: { top: 0, right: 0, bottom: 0, left: 0 } };
const phone: Viewport = { width: 390, height: 844, offsetTop: 0, insets: { top: 47, right: 0, bottom: 34, left: 0 } };

describe('floating call window geometry', () => {
  it('rests 16 px from the edges and below the island', () => {
    const box = windowBox('video', 'small', desktop);
    expect(cornerPoint('top-left', box, desktop)).toEqual({ x: EDGE, y: ISLAND_CLEARANCE });
    expect(cornerPoint('bottom-right', box, desktop)).toEqual({ x: 1440 - EDGE - box.width, y: 900 - EDGE - box.height });
  });

  it('stays inside the safe areas on a phone', () => {
    const box = windowBox('video', 'small', phone);
    const p = cornerPoint('bottom-right', box, phone);
    expect(p.y + box.height).toBe(844 - 34 - EDGE);
    expect(cornerPoint('top-left', box, phone).y).toBe(47 + ISLAND_CLEARANCE);
  });

  it('moves above the virtual keyboard', () => {
    // Keyboard open: 300 px of visible height left, page scrolled 120 px under it.
    const kb: Viewport = { ...phone, height: 300, offsetTop: 120, insets: { ...phone.insets, bottom: 0 } };
    const box = windowBox('voice', 'small', kb);
    const p = cornerPoint('bottom-left', box, kb);
    expect(p.y + box.height).toBe(120 + 300 - EDGE);
    // Too little room: the window never goes above its top position.
    const tiny: Viewport = { ...kb, height: 100 };
    expect(cornerPoint('bottom-left', box, tiny).y).toBe(cornerPoint('top-left', box, tiny).y);
  });

  it('a throw carries the window to the corner it was thrown at', () => {
    expect(nearestCorner({ x: 300, y: 300 }, { x: 0, y: 0 }, desktop)).toBe('top-left');
    expect(nearestCorner({ x: 300, y: 300 }, { x: 5000, y: 2000 }, desktop)).toBe('bottom-right');
    expect(nearestCorner({ x: 1000, y: 700 }, { x: -6000, y: 0 }, desktop)).toBe('bottom-left');
  });

  it('arrow keys move between corners and stop at the edges', () => {
    expect(cornerByKey('bottom-right', 'ArrowLeft')).toBe('bottom-left');
    expect(cornerByKey('bottom-right', 'ArrowUp')).toBe('top-right');
    expect(cornerByKey('bottom-right', 'ArrowRight')).toBeNull();
    expect(cornerByKey('top-left', 'Enter')).toBeNull();
  });

  it('video follows the screen orientation; voice is a slim card that fits a phone', () => {
    expect(windowBox('video', 'small', phone)).toEqual({ width: 108, height: 192 });
    expect(windowBox('video', 'large', desktop)).toEqual({ width: 384, height: 216 });
    expect(windowBox('voice', 'small', { width: 320, height: 600 }).width).toBe(320 - 2 * EDGE);
  });
});
