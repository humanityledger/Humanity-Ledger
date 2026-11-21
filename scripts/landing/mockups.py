#!/usr/bin/env python3
"""
scripts/landing/mockups.py: the photo mockups of the landing page.

From each photograph of a hand holding an iPhone (scripts/landing/mockups-src/) this writes, to
public/landing/mockups/:
  <name>.webp       the photo, cropped, with the original screen painted white
  <name>-mask.png   where the app may be drawn: the display, minus the fingers in front of it
and to lib/landing/mockups.ts the matrix3d that maps a 300 x 652.2 screen box (an iPhone 16 Pro
display, 402 x 874 pt) onto the display of the photo. Each photo is also written mirrored (-l).

How the display was measured (`--fit`): from points known to be inside the display, the script
walks outwards along the normal of each edge and finds, with sub-pixel interpolation, where the
light (or dark) display meets the black border. A robust line fit per edge (Huber, outliers
dropped) gives four lines; their intersections are the corners of the display without its
rounded corners. Residuals were under 0.4 px on every straight edge. The corner radius, measured
along the diagonal of each clean corner, is 62.8 pt on all three photos.

Fingers in front of the display are found by colour (skin hue, some saturation) inside and just
around the display, and are left out of the mask, so they stay in front of the app.

Requirements: python3, numpy, opencv-python. Run from the repository root:
  python3 scripts/landing/mockups.py          # writes the assets and lib/landing/mockups.ts
  python3 scripts/landing/mockups.py --fit    # measures the corners again from the values below;
                                              # check the result before copying it into PHOTOS
"""
import json, os, sys
import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'scripts/landing/mockups-src')
OUT = os.path.join(ROOT, 'public/landing/mockups')
TS = os.path.join(ROOT, 'lib/landing/mockups.ts')

RADIUS_PT = 62.8
SW, SH = 402, 874               # iPhone 16 Pro display, points
BW, BH = 300.0, 300.0 * SH / SW  # the screen box the app is laid out in, CSS px

PHOTOS = {
    # name: (file, crop x0 y0 x1 y1, measured display corners tl tr br bl, how to fit, hands over display)
    'hand-front': ('hand-front.jpg', (640, 140, 1740, 1560),
                   {'tl': [913.19, 244.08], 'tr': [1458.64, 240.53], 'br': [1465.31, 1419.59], 'bl': [924.15, 1423.64]},
                   'gray', True),
    'hand-tilt': ('hand-tilt.webp', (360, 20, 1320, 1258),
                  {'tl': [795.45, 106.16], 'tr': [1158.06, 234.96], 'br': [879.92, 1018.36], 'bl': [519.45, 892.14]},
                  'gray', True),
    'hand-wall': ('hand-wall.webp', (110, 160, 690, 960),
                  {'tl': [275.36, 238.49], 'tr': [504.71, 238.51], 'br': [500.34, 736.97], 'bl': [272.87, 733.56]},
                  'value', False),
}


# ── Measuring the display ────────────────────────────────────────────────────

def _walk(g, p, d, n=70):
    vals = np.array([cv2.getRectSubPix(g, (1, 1), (float(q[0]), float(q[1])))[0, 0] for q in (p + d * i for i in range(n))])
    inside, out = np.median(vals[:6]), vals.min()
    mid = (inside + out) / 2
    for i in range(n - 1):
        a, b = vals[i], vals[i + 1]
        if a >= mid > b:
            return p + d * (i + (a - mid) / (a - b))
    return None


def _fitline(pts):
    pts = np.array(pts, np.float32)
    for _ in range(3):
        vx, vy, x0, y0 = cv2.fitLine(pts, cv2.DIST_HUBER, 0, 0.01, 0.01).flatten()
        r = (pts - np.array([x0, y0])) @ np.array([-vy, vx])
        keep = np.abs(r) < max(0.6, 2.5 * np.std(r))
        pts = pts[keep]
    return np.array([x0, y0]), np.array([vx, vy]), float(np.std(r))


def fit_corners(g, rough, inset=28):
    """Refines rough corners (tl, tr, br, bl) of the display; returns corners and residuals."""
    g = g.astype(np.float32)
    c = np.array([rough[k] for k in ('tl', 'tr', 'br', 'bl')], float)
    cen = c.mean(0)
    lines, res = [], []
    for i in range(4):
        a, b = c[i], c[(i + 1) % 4]
        d = (b - a) / np.linalg.norm(b - a)
        n = np.array([d[1], -d[0]])
        if np.dot(cen - a, n) < 0:
            n = -n
        pts = []
        for t in np.linspace(0.05, 0.95, 200):
            # the top edge: only beside the Dynamic Island; the others: away from the corners
            if i == 0 and not (0.08 < t < 0.3 or 0.72 < t < 0.92):
                continue
            if i != 0 and (t < 0.15 or t > 0.85):
                continue
            q = _walk(g, a + (b - a) * t + n * (9 if i == 0 else inset), -n)
            if q is not None:
                pts.append(q)
        p0, v, r = _fitline(pts)
        lines.append((p0, v))
        res.append(round(r, 3))

    def inter(l1, l2):
        t = np.linalg.solve(np.array([l1[1], -l2[1]]).T, l2[0] - l1[0])
        return l1[0] + l1[1] * t[0]

    out = [inter(lines[i - 1], lines[i]) for i in range(4)]
    return {k: [round(float(out[i][0]), 2), round(float(out[i][1]), 2)] for i, k in enumerate(('tl', 'tr', 'br', 'bl'))}, res


# ── Masks and assets ─────────────────────────────────────────────────────────

def display_mask(shape, quad, ss=4):
    """The rounded display, anti-aliased, in photo pixels (0..1)."""
    H = cv2.getPerspectiveTransform(np.float32([[0, 0], [SW, 0], [SW, SH], [0, SH]]),
                                    np.float32([quad['tl'], quad['tr'], quad['br'], quad['bl']]))
    S = np.zeros((SH * ss, SW * ss), np.uint8)
    r = int(RADIUS_PT * ss)
    cv2.rectangle(S, (r, 0), (SW * ss - r, SH * ss), 255, -1)
    cv2.rectangle(S, (0, r), (SW * ss, SH * ss - r), 255, -1)
    for cx, cy in [(r, r), (SW * ss - r, r), (SW * ss - r, SH * ss - r), (r, SH * ss - r)]:
        cv2.circle(S, (cx, cy), r, 255, -1, lineType=cv2.LINE_AA)
    m = cv2.warpPerspective(S, H @ np.diag([1 / ss, 1 / ss, 1]), (shape[1], shape[0]), flags=cv2.INTER_LINEAR)
    return m.astype(np.float32) / 255


def hand_mask(im, region, erode):
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    h, s, v = (hsv[..., i].astype(int) for i in range(3))
    skin = ((h <= 25) | (h >= 172)) & (s >= 13) & (v >= 60)
    dist = cv2.distanceTransform((region > 0.5).astype(np.uint8), cv2.DIST_L2, 5)
    cand = (skin & (region > 0.01) & (dist < 44)).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(cand)
    keep = np.zeros_like(cand)
    for i in range(1, n):
        if st[i][4] > 150:
            keep[lab == i] = 1
    keep = cv2.morphologyEx(keep, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    if erode:  # on a dark display the finger's edge pixels are half dark: let the app cover them
        keep = cv2.erode(keep, np.ones((3, 3), np.uint8))
    return cv2.GaussianBlur(keep.astype(np.float32), (0, 0), 0.7)


def matrix3d(quad):
    H = cv2.getPerspectiveTransform(np.float32([[0, 0], [BW, 0], [BW, BH], [0, BH]]),
                                    np.float32([quad['tl'], quad['tr'], quad['br'], quad['bl']]))
    H = H / H[2, 2]
    v = [H[0, 0], H[1, 0], 0, H[2, 0], H[0, 1], H[1, 1], 0, H[2, 1], 0, 0, 1, 0, H[0, 2], H[1, 2], 0, H[2, 2]]
    return 'matrix3d(' + ','.join(f'{x:.9g}' for x in v) + ')'


def build(fit=False):
    os.makedirs(OUT, exist_ok=True)
    data = {}
    for name, (file, crop, quad, channel, hands) in PHOTOS.items():
        im = cv2.imread(os.path.join(SRC, file))
        if fit:
            g = im.mean(2) if channel == 'gray' else cv2.cvtColor(im, cv2.COLOR_BGR2HSV)[..., 2]
            quad, res = fit_corners(g, quad, inset=14 if name == 'hand-wall' else 28)
            print(name, 'corners', quad, 'residuals px (top, right, bottom, left)', res)
            print('  check the overlay before keeping these: a finger on an edge raises its residual')
        dm = display_mask(im.shape, quad)
        grown = np.maximum(dm, cv2.GaussianBlur(cv2.dilate(dm, np.ones((2, 2), np.uint8)), (0, 0), 0.5))
        hm = hand_mask(im, grown, erode=(name == 'hand-tilt')) if hands else np.zeros_like(dm)
        alpha = np.clip(grown * (1 - hm), 0, 1)
        clean = im.astype(np.float32) * (1 - alpha[..., None]) + 255 * alpha[..., None]
        x0, y0, x1, y1 = crop
        W, H = x1 - x0, y1 - y0
        for mirror in (False, True):
            base, mask = clean[y0:y1, x0:x1].copy(), alpha[y0:y1, x0:x1].copy()
            q = {k: [quad[k][0] - x0, quad[k][1] - y0] for k in quad}
            if mirror:
                base, mask = base[:, ::-1], mask[:, ::-1]
                q = {'tl': [W - q['tr'][0], q['tr'][1]], 'tr': [W - q['tl'][0], q['tl'][1]],
                     'br': [W - q['bl'][0], q['bl'][1]], 'bl': [W - q['br'][0], q['br'][1]]}
            out = name + ('-l' if mirror else '')
            cv2.imwrite(f'{OUT}/{out}.webp', np.clip(base, 0, 255).astype(np.uint8), [cv2.IMWRITE_WEBP_QUALITY, 84])
            rgba = np.zeros((H, W, 4), np.uint8)
            rgba[..., :3] = 255
            rgba[..., 3] = np.clip(mask * 255 + 0.5, 0, 255).astype(np.uint8)
            ys, xs = np.nonzero(rgba[..., 3])
            bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
            cv2.imwrite(f'{OUT}/{out}-mask.png', rgba[by0:by1, bx0:bx1], [cv2.IMWRITE_PNG_COMPRESSION, 9])
            data[out] = dict(width=W, height=H, maskBox=[int(bx0), int(by0), int(bx1 - bx0), int(by1 - by0)], matrix=matrix3d(q))
    write_ts(data)


def write_ts(data):
    src = open(TS).read()
    head = src[:src.index('export const MOCKUPS')]
    lines = ['export const MOCKUPS: Record<MockupId, Mockup> = {']
    for k, v in data.items():
        lines.append(f"  '{k}': {{ src: '/landing/mockups/{k}.webp', mask: '/landing/mockups/{k}-mask.png', width: {v['width']}, height: {v['height']}, "
                     f"maskBox: [{', '.join(map(str, v['maskBox']))}], matrix: '{v['matrix']}' }},")
    lines.append('};')
    open(TS, 'w').write(head + '\n'.join(lines) + '\n')
    print('wrote', TS)


if __name__ == '__main__':
    build(fit='--fit' in sys.argv)
