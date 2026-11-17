#!/usr/bin/env node
/**
 * scripts/lottie/build-send-confirmation.mjs
 *
 * Writes the two send confirmations, drawn for the send button itself (not stock files):
 *
 *   public/lottie/send-confirmation.json        phones: the round button's arrow
 *   public/lottie/send-confirmation-plane.json  wide screens: the square button's paper plane
 *
 * Both are 96 x 96 at 60 fps, 0.9 s, transparent, white strokes with round caps and joins, so the
 * button's own background shows behind them. The glyph starts exactly where the button draws its
 * icon (lucide ArrowUp / Send at the button's size and stroke), so the first frame is the button:
 *
 *   0.00-0.08 s  the glyph settles back a little (anticipation)
 *   0.08-0.28 s  it leaves the button, accelerating (up, or up and right for the plane)
 *   0.23-0.50 s  a tick draws itself, scaling in with a slight overshoot; a thin ring spreads out
 *   0.50-0.73 s  the tick holds
 *   0.73-0.87 s  the tick fades; the component fades the button background back to the field
 *
 * Run: node scripts/lottie/build-send-confirmation.mjs
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FR = 60;
const OP = 54; // 0.9 s
const C = 48; // centre of the 96 x 96 composition
const WHITE = [1, 1, 1, 1];

/** CSS cubic-bezier(x1, y1, x2, y2) as a Lottie keyframe pair (o on the start key, i on the end key). */
const ease = (x1, y1, x2, y2, dims) => ({
  o: { x: Array(dims).fill(x1), y: Array(dims).fill(y1) },
  i: { x: Array(dims).fill(x2), y: Array(dims).fill(y2) },
});
const EASE_OUT = [0.33, 0, 0.2, 1];
const EASE_IN = [0.55, 0, 0.85, 0.35];
const EASE_STD = [0.4, 0, 0.2, 1];
const BACK_OUT = [0.34, 1.4, 0.64, 1];

/** Animated property from [t, value, easing-to-next] steps. */
function anim(steps) {
  const dims = Array.isArray(steps[0][1]) ? steps[0][1].length : 1;
  const k = steps.map(([t, v, e], idx) => {
    const key = { t, s: Array.isArray(v) ? v : [v] };
    if (idx < steps.length - 1) Object.assign(key, ease(...(e ?? EASE_STD), dims));
    return key;
  });
  return { a: 1, k };
}
const still = (v) => ({ a: 0, k: v });

const path = (points, closed = false) => ({
  ty: 'sh',
  ks: still({ c: closed, v: points, i: points.map(() => [0, 0]), o: points.map(() => [0, 0]) }),
});
const stroke = (w, opacity = still(100), width = still(w)) => ({ ty: 'st', c: still(WHITE), o: opacity, w: width, lc: 2, lj: 2, ml: 4 });
const groupTr = () => ({
  ty: 'tr',
  p: still([0, 0]),
  a: still([0, 0]),
  s: still([100, 100]),
  r: still(0),
  o: still(100),
  sk: still(0),
  sa: still(0),
});
const group = (nm, items) => ({ ty: 'gr', nm, it: [...items, groupTr()] });

function layer(ind, nm, ks, shapes) {
  return {
    ddd: 0,
    ind,
    ty: 4,
    nm,
    sr: 1,
    ks: { o: ks.o ?? still(100), r: still(0), p: ks.p ?? still([C, C, 0]), a: still([C, C, 0]), s: ks.s ?? still([100, 100, 100]) },
    ao: 0,
    shapes,
    ip: 0,
    op: OP,
    st: 0,
    bm: 0,
  };
}

/** lucide (24 x 24) coordinates to the composition, for an icon of `px` pixels in a `button` pixel button. */
function mapper(px, button, nudge = [0, 0]) {
  const unit = (px / 24) * (96 / button);
  return ([x, y]) => [+(C + (x - 12) * unit + nudge[0]).toFixed(3), +(C + (y - 12) * unit + nudge[1]).toFixed(3)];
}

function build({ name, glyph, glyphStroke, exit, tick, tickStroke }) {
  const glyphLayer = layer(
    3,
    'glyph',
    {
      p: anim([
        [0, [C, C, 0], EASE_OUT],
        [5, [C + exit.settle[0], C + exit.settle[1], 0], EASE_IN],
        [17, [C + exit.to[0], C + exit.to[1], 0]],
      ]),
      s: anim([
        [0, [100, 100, 100], EASE_OUT],
        [5, [93, 93, 100], EASE_STD],
        [12, [100, 100, 100]],
      ]),
      o: anim([
        [0, 100],
        [11, 100, EASE_IN],
        [17, 0],
      ]),
    },
    [group('glyph', [...glyph.map((pts) => path(pts)), stroke(glyphStroke)])],
  );

  const tickLayer = layer(
    2,
    'tick',
    {
      s: anim([
        [14, [72, 72, 100], BACK_OUT],
        [30, [100, 100, 100]],
      ]),
      o: anim([
        [0, 0],
        [14, 0, EASE_OUT],
        [18, 100],
        [44, 100, EASE_STD],
        [52, 0],
      ]),
    },
    [
      group('tick', [
        path(tick),
        { ty: 'tm', s: still(0), e: anim([[0, 0], [14, 0, [0.3, 0, 0.15, 1]], [30, 100]]), o: still(0), m: 1 },
        stroke(tickStroke),
      ]),
    ],
  );

  const ringLayer = layer(1, 'ring', {}, [
    group('ring', [
      { ty: 'el', d: 1, p: still([C, C]), s: anim([[0, [44, 44]], [13, [44, 44], EASE_OUT], [34, [104, 104]]]) },
      stroke(
        2,
        anim([[0, 0], [13, 0, EASE_OUT], [16, 28, EASE_OUT], [34, 0]]),
        anim([[0, 2.5], [13, 2.5, EASE_OUT], [34, 1]]),
      ),
    ]),
  ]);

  return { v: '5.7.4', fr: FR, ip: 0, op: OP, w: 96, h: 96, nm: name, ddd: 0, assets: [], layers: [glyphLayer, tickLayer, ringLayer], markers: [] };
}

// Phones: lucide ArrowUp, 20 px, stroke 2.2, in a 40 px round button.
const arrow = mapper(20, 40);
const phone = build({
  name: 'Send confirmation (arrow)',
  glyph: [
    [arrow([5, 12]), arrow([12, 5]), arrow([19, 12])],
    [arrow([12, 19]), arrow([12, 5])],
  ],
  glyphStroke: +(2.2 * (20 / 24) * (96 / 40)).toFixed(2),
  exit: { settle: [0, 3], to: [0, -78] },
  tick: [[35, 49.5], [44.5, 59], [62, 39.5]],
  tickStroke: 4.6,
});

// Wide screens: lucide Send, 19 px, stroke 1.9, in a 48 px square button, nudged (-1 px, +1 px) as drawn.
const plane = mapper(19, 48, [-2, 2]);
const wide = build({
  name: 'Send confirmation (paper plane)',
  glyph: [
    [plane([15.0, 21.5]), plane([21.7, 2.3]), plane([2.5, 8.95]), plane([10.8, 13.2]), plane([15.0, 21.5])],
    [plane([21.85, 2.15]), plane([10.91, 13.09])],
  ],
  glyphStroke: +(1.9 * (19 / 24) * (96 / 48)).toFixed(2),
  exit: { settle: [-2, 2], to: [70, -70] },
  tick: [[36.5, 49], [44.5, 57], [60, 40.5]],
  tickStroke: 3.6,
});

const out = join(process.cwd(), 'public/lottie');
writeFileSync(join(out, 'send-confirmation.json'), JSON.stringify(phone));
writeFileSync(join(out, 'send-confirmation-plane.json'), JSON.stringify(wide));
console.log('wrote public/lottie/send-confirmation.json and send-confirmation-plane.json');
