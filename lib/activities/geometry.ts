/**
 * Where the floating call window sits: one of four corners, inside the visible part of the screen
 * (above the keyboard on phones, inside the safe areas, below the island). Pure functions, tested
 * in test/unit/activities/geometry.test.ts.
 */

export type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export const CORNERS: readonly Corner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

export interface Box { width: number; height: number }

/** The visible area: the layout viewport minus the keyboard, plus safe-area insets. */
export interface Viewport {
  width: number;
  height: number;
  /** visualViewport.offsetTop: how far the page scrolled under an open keyboard. */
  offsetTop: number;
  insets: { top: number; right: number; bottom: number; left: number };
}

/** 16 px from the edges; 72 px from the top so the window never covers the island. */
export const EDGE = 16;
export const ISLAND_CLEARANCE = 72;

/** Top-left point of the window when it sits in `corner`. */
export function cornerPoint(corner: Corner, box: Box, vp: Viewport): { x: number; y: number } {
  const left = vp.insets.left + EDGE;
  const right = vp.width - vp.insets.right - EDGE - box.width;
  const top = vp.offsetTop + vp.insets.top + ISLAND_CLEARANCE;
  const bottom = vp.offsetTop + vp.height - vp.insets.bottom - EDGE - box.height;
  const x = corner.endsWith('left') ? left : Math.max(left, right);
  const y = corner.startsWith('top') ? top : Math.max(top, bottom);
  return { x, y };
}

/** The corner whose quadrant holds the window's centre after a drag, with the throw's velocity. */
export function nearestCorner(center: { x: number; y: number }, velocity: { x: number; y: number }, vp: Viewport): Corner {
  // A throw counts for 0.12 s of travel, like iOS picture in picture.
  const px = center.x + velocity.x * 0.12;
  const py = center.y + velocity.y * 0.12;
  const h = px < vp.width / 2 ? 'left' : 'right';
  const v = py < vp.offsetTop + vp.height / 2 ? 'top' : 'bottom';
  return `${v}-${h}` as Corner;
}

/** Arrow keys move between corners: Left and Right change the side, Up and Down the edge. */
export function cornerByKey(corner: Corner, key: string): Corner | null {
  const [v, h] = corner.split('-') as ['top' | 'bottom', 'left' | 'right'];
  switch (key) {
    case 'ArrowLeft': return h === 'left' ? null : `${v}-left`;
    case 'ArrowRight': return h === 'right' ? null : `${v}-right`;
    case 'ArrowUp': return v === 'top' ? null : `top-${h}`;
    case 'ArrowDown': return v === 'bottom' ? null : `bottom-${h}`;
    default: return null;
  }
}

export const CORNER_LABEL: Record<Corner, string> = {
  'top-left': 'top left',
  'top-right': 'top right',
  'bottom-left': 'bottom left',
  'bottom-right': 'bottom right',
};

/** Window sizes. Video follows the screen's orientation; a voice call is a slim card. */
export type WindowSize = 'small' | 'large';
export function windowBox(kind: 'video' | 'voice', size: WindowSize, vp: Pick<Viewport, 'width' | 'height'>): Box {
  if (kind === 'voice') return { width: Math.min(320, vp.width - 2 * EDGE), height: 64 };
  const portrait = vp.width < 640;
  if (portrait) return size === 'large' ? { width: 144, height: 256 } : { width: 108, height: 192 };
  return size === 'large' ? { width: 384, height: 216 } : { width: 272, height: 153 };
}
