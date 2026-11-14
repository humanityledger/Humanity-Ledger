/**
 * lib/chat/wallpapers.ts — the conversation wallpapers.
 *
 * Every wallpaper is drawn here, from code: colours, gradients and small SVG tiles turned into
 * data: URLs (allowed by the CSP's img-src). Nothing is fetched, and a stored value is only ever an
 * id from this list: a setting or a localStorage entry can never inject its own CSS into the page.
 * Older builds stored the CSS itself; resolveWallpaper() maps those exact strings back to an id.
 *
 * `tone` says whether the wallpaper is dark. On a dark wallpaper the time and ticks under a message
 * are drawn light (app/ledger-chat-settings.css, [data-wallpaper-tone="dark"]), so they stay legible
 * whatever colour theme is picked.
 */

import type { CSSProperties } from 'react';

export type WallpaperGroup = 'Soft' | 'Gradients' | 'Mesh' | 'Patterns' | 'Doodles' | 'Scenes';
export const WALLPAPER_GROUPS: readonly WallpaperGroup[] = ['Soft', 'Gradients', 'Mesh', 'Patterns', 'Doodles', 'Scenes'];

export interface Wallpaper {
  id: string;
  label: string;
  group: WallpaperGroup;
  tone: 'light' | 'dark';
  /** The CSS that draws it on the conversation canvas. */
  style: CSSProperties;
}

/** An SVG document as a CSS url(): the characters CSS and data URLs care about are escaped. */
export function svgUrl(svg: string): string {
  const body = svg
    .replace(/\s{2,}/g, ' ')
    .replace(/"/g, "'")
    .replace(/%/g, '%25')
    .replace(/#/g, '%23')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E')
    .replace(/\n/g, '');
  return `url("data:image/svg+xml,${body}")`;
}

const tile = (w: number, h: number, inner: string) =>
  svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`);

const scene = (inner: string, defs = '') =>
  svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice"><defs>${defs}</defs>${inner}</svg>`);

const solid = (c: string): CSSProperties => ({ backgroundColor: c });
const lin = (deg: number, ...stops: string[]): CSSProperties => ({ backgroundColor: stops[0], backgroundImage: `linear-gradient(${deg}deg, ${stops.join(', ')})` });
const mesh = (base: string, ...blobs: [string, string, string][]): CSSProperties => ({
  backgroundColor: base,
  backgroundImage: blobs.map(([pos, color, size]) => `radial-gradient(${size} at ${pos}, ${color} 0%, transparent 70%)`).join(', '),
});
const pattern = (base: string, image: string, size: string, extra?: string): CSSProperties => ({
  backgroundColor: base,
  backgroundImage: extra ? `${image}, ${extra}` : image,
  backgroundSize: extra ? `${size}, cover` : size,
});
const cover = (image: string, base: string): CSSProperties => ({
  backgroundColor: base,
  backgroundImage: image,
  backgroundSize: 'cover',
  backgroundPosition: 'center bottom',
  backgroundRepeat: 'no-repeat',
});

/* ── Doodles: one original line-art tile, recoloured per wallpaper ───────── */

function doodleTile(stroke: string, opacity: number): string {
  const s = `fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"`;
  return tile(
    220,
    220,
    // chat bubble, heart, lock, coin, paper plane, star, coffee, moon, music note, spark, envelope, cloud
    `<g ${s}>
      <path d="M18 22h34a8 8 0 0 1 8 8v14a8 8 0 0 1-8 8H34l-9 8v-8h-7a8 8 0 0 1-8-8V30a8 8 0 0 1 8-8z"/><path d="M24 36h22M24 43h14"/>
      <path d="M112 30c-5-6-15-3-15 5 0 8 15 16 15 16s15-8 15-16c0-8-10-11-15-5z"/>
      <rect x="168" y="30" width="26" height="22" rx="5"/><path d="M173 30v-6a8 8 0 0 1 16 0v6"/><circle cx="181" cy="41" r="2.5"/>
      <circle cx="40" cy="108" r="14"/><path d="M40 100v16M35 104h7a3 3 0 0 1 0 6h-4a3 3 0 0 0 0 6h7"/>
      <path d="M92 116l40-18-14 36-8-12z"/><path d="M110 122l22-24"/>
      <path d="M181 92l4.5 9.2 10.1 1.5-7.3 7.1 1.7 10.1-9-4.8-9 4.8 1.7-10.1-7.3-7.1 10.1-1.5z"/>
      <path d="M22 168h28v14a12 12 0 0 1-12 12h-4a12 12 0 0 1-12-12z"/><path d="M50 172h4a6 6 0 0 1 0 12h-5"/><path d="M30 158c0-4 4-4 4-8M38 158c0-4 4-4 4-8"/>
      <path d="M124 160a16 16 0 1 0 14 22 13 13 0 0 1-14-22z"/>
      <path d="M176 190v-26l18-4v24"/><circle cx="171" cy="190" r="5"/><circle cx="189" cy="184" r="5"/>
      <path d="M86 70v10M81 75h10M200 140v8M196 144h8M60 140l4 4M64 140l-4 4"/>
      <rect x="148" y="122" width="0" height="0"/>
    </g>`,
  );
}

/* ── Patterns ─────────────────────────────────────────────────────────── */

const dots = (c: string, o: number) => tile(22, 22, `<circle cx="11" cy="11" r="1.4" fill="${c}" opacity="${o}"/>`);
const grid = (c: string, o: number) => tile(28, 28, `<path d="M28 0H0V28" fill="none" stroke="${c}" stroke-opacity="${o}" stroke-width="1"/>`);
const diagonal = (c: string, o: number) => tile(16, 16, `<path d="M-4 4l8-8M0 16L16 0M12 20l8-8" stroke="${c}" stroke-opacity="${o}" stroke-width="1.2"/>`);
const waves = (c: string, o: number) =>
  tile(120, 40, `<path d="M0 20c20-14 40-14 60 0s40 14 60 0" fill="none" stroke="${c}" stroke-opacity="${o}" stroke-width="1.4"/><path d="M0 40c20-14 40-14 60 0s40 14 60 0" fill="none" stroke="${c}" stroke-opacity="${o * 0.6}" stroke-width="1.2"/>`);
const hexagons = (c: string, o: number) =>
  tile(56, 98, `<path d="M28 66L0 50V18L28 2l28 16v32zM28 66v32M0 82l28 16 28-16" fill="none" stroke="${c}" stroke-opacity="${o}" stroke-width="1"/>`);
const chevrons = (c: string, o: number) => tile(40, 24, `<path d="M0 18l20-12 20 12" fill="none" stroke="${c}" stroke-opacity="${o}" stroke-width="1.6"/>`);
const plus = (c: string, o: number) => tile(36, 36, `<path d="M18 13v10M13 18h10" stroke="${c}" stroke-opacity="${o}" stroke-width="1.5" stroke-linecap="round"/>`);
const circuit = (c: string, o: number) =>
  tile(
    90,
    90,
    `<g fill="none" stroke="${c}" stroke-opacity="${o}" stroke-width="1.2"><path d="M0 20h30l10 10v20h30l20 20M45 0v15l10 10h35M20 90V60l10-10M70 90V75h20"/></g><g fill="${c}" fill-opacity="${o * 1.6}"><circle cx="30" cy="20" r="2.5"/><circle cx="70" cy="50" r="2.5"/><circle cx="55" cy="25" r="2.5"/><circle cx="30" cy="50" r="2.5"/><circle cx="70" cy="75" r="2.5"/></g>`,
  );
const topo = (c: string, o: number) =>
  tile(
    200,
    200,
    `<g fill="none" stroke="${c}" stroke-opacity="${o}" stroke-width="1.1"><path d="M-10 40c30-20 60 10 90-5s50-30 80-10 40 20 50 10"/><path d="M-10 70c30-20 70 15 100 0s40-25 70-10 40 25 50 15"/><path d="M-10 105c40-15 60 20 100 5s50-20 70-5 30 15 50 5"/><path d="M-10 140c25-10 55 20 95 5s55-25 80-10 25 10 45 5"/><path d="M-10 175c35-15 65 15 100 2s45-20 75-8 25 12 45 6"/><ellipse cx="150" cy="60" rx="16" ry="9"/><ellipse cx="150" cy="60" rx="7" ry="4"/><ellipse cx="50" cy="155" rx="14" ry="7"/></g>`,
  );
const terrazzo = (colors: string[]) =>
  tile(
    160,
    160,
    `<g>${[
      [20, 24, 7, 0], [70, 14, 4, 1], [128, 30, 9, 2], [40, 78, 5, 3], [96, 70, 8, 0], [146, 96, 4, 1],
      [18, 130, 6, 2], [70, 128, 4, 3], [118, 140, 7, 0], [150, 150, 3, 2], [58, 46, 3, 1], [100, 112, 3, 3],
    ]
      .map(([x, y, r, k], i) => `<path transform="translate(${x} ${y}) rotate(${i * 37})" d="M-${r} 0 L0 -${r * 0.8} L${r} -${r * 0.2} L${r * 0.4} ${r} Z" fill="${colors[k % colors.length]}"/>`)
      .join('')}</g>`,
  );
const confetti = (colors: string[]) =>
  tile(
    140,
    140,
    [
      [16, 20, 0, 20], [60, 12, 1, -30], [110, 26, 2, 50], [36, 64, 3, 70], [86, 56, 0, -10], [124, 84, 1, 35],
      [20, 108, 2, -45], [66, 112, 3, 15], [104, 126, 0, 80], [48, 36, 2, 0], [96, 96, 1, -60],
    ]
      .map(([x, y, k, a], i) =>
        i % 3 === 0
          ? `<circle cx="${x}" cy="${y}" r="2.6" fill="${colors[k]}"/>`
          : `<rect x="${x - 4}" y="${y - 1.6}" width="8" height="3.2" rx="1.6" fill="${colors[k]}" transform="rotate(${a} ${x} ${y})"/>`,
      )
      .join(''),
  );
const stars = (o: number) =>
  tile(
    180,
    180,
    [
      [12, 20, 1.2], [60, 8, 0.8], [96, 40, 1.6], [150, 18, 1], [30, 70, 0.9], [120, 80, 1.3], [170, 110, 0.8],
      [70, 120, 1.4], [20, 150, 1], [110, 160, 0.9], [160, 170, 1.5], [50, 100, 0.7],
    ]
      .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${o * (0.5 + r / 3)}"/>`)
      .join('') + `<path d="M96 36v8M92 40h8" stroke="#fff" stroke-opacity="${o}" stroke-width="0.8"/>`,
  );

/* ── Scenes: full-bleed illustrations ─────────────────────────────────── */

const mountainsDawn = scene(
  `<rect width="400" height="800" fill="url(#sky)"/><circle cx="270" cy="470" r="70" fill="#ffd6a5" opacity=".9"/>
   <path d="M0 560 L90 450 L160 520 L250 400 L330 500 L400 440 V800 H0Z" fill="#c9b6e4" opacity=".75"/>
   <path d="M0 620 L70 540 L150 610 L230 520 L320 610 L400 560 V800 H0Z" fill="#9f8cc9" opacity=".8"/>
   <path d="M0 690 L110 610 L200 680 L300 620 L400 680 V800 H0Z" fill="#6f5fa3"/>
   <path d="M0 750 L120 700 L260 745 L400 715 V800 H0Z" fill="#4d4180"/>`,
  `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6e7ff"/><stop offset=".55" stop-color="#ffe4d6"/><stop offset="1" stop-color="#ffd1b8"/></linearGradient>`,
);
const dunes = scene(
  `<rect width="400" height="800" fill="url(#sky)"/><circle cx="110" cy="300" r="46" fill="#fff4d6"/>
   <path d="M0 520 C120 460 220 560 400 480 V800 H0Z" fill="#f2c48d"/>
   <path d="M0 600 C140 540 260 640 400 570 V800 H0Z" fill="#e7a86a"/>
   <path d="M0 690 C110 640 280 720 400 660 V800 H0Z" fill="#d48a4e"/>
   <path d="M0 760 C160 720 260 780 400 740 V800 H0Z" fill="#bf7340"/>`,
  `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde6c8"/><stop offset="1" stop-color="#f9cfa0"/></linearGradient>`,
);
const oceanWaves = scene(
  `<rect width="400" height="800" fill="url(#sky)"/>
   <path d="M0 470 C60 450 100 490 160 470 S260 450 320 470 S380 490 400 480 V800 H0Z" fill="#7cc4e4"/>
   <path d="M0 540 C70 515 120 565 190 540 S300 515 360 540 S400 555 400 550 V800 H0Z" fill="#4fa6d0"/>
   <path d="M0 620 C80 590 130 650 210 620 S320 590 400 620 V800 H0Z" fill="#2f86b8"/>
   <path d="M0 700 C90 670 150 730 230 700 S340 670 400 700 V800 H0Z" fill="#1d6597"/>
   <path d="M40 470 c10-6 20-6 30 0M230 540 c10-6 22-6 32 0M120 620 c12-6 24-6 36 0" stroke="#fff" stroke-opacity=".55" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6f6ff"/><stop offset="1" stop-color="#bfe6f7"/></linearGradient>`,
);
const cityNight = scene(
  `<rect width="400" height="800" fill="url(#sky)"/><circle cx="300" cy="170" r="34" fill="#fff6d8" opacity=".95"/><circle cx="314" cy="160" r="30" fill="#1b1f4a"/>
   ${[[20, 60], [80, 140], [140, 40], [200, 110], [240, 220], [60, 260], [360, 260], [180, 300], [330, 60]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.4" fill="#fff" opacity=".8"/>`).join('')}
   <path d="M0 800V560h40v-50h30v80h20V470h50v120h25v-60h35v-90h45v150h20v-70h40v-40h30v110h30v-80h35V800Z" fill="#232857"/>
   <path d="M0 800V630h30v-30h40v60h35v-50h40v90h30v-120h45v140h35v-60h40v40h45v-70h40V800Z" fill="#151938"/>
   ${[[50, 520], [62, 540], [110, 490], [118, 520], [222, 470], [236, 500], [300, 560], [345, 510], [150, 610], [262, 640], [330, 650], [80, 660]].map(([x, y]) => `<rect x="${x}" y="${y}" width="6" height="8" rx="1" fill="#ffd27a" opacity=".85"/>`).join('')}`,
  `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e1033"/><stop offset=".7" stop-color="#2a2f6b"/><stop offset="1" stop-color="#43327a"/></linearGradient>`,
);
const auroraLake = scene(
  `<rect width="400" height="800" fill="url(#sky)"/>
   <path d="M-20 260 C80 180 160 330 250 240 S380 200 420 260 L420 340 C330 300 250 380 160 320 S40 330 -20 360Z" fill="url(#au)" opacity=".75"/>
   <path d="M-20 360 C100 300 200 420 300 340 S420 330 420 360 L420 400 C320 380 220 450 100 400 S0 420 -20 430Z" fill="url(#au2)" opacity=".5"/>
   <path d="M0 560 L60 500 L110 540 L170 470 L240 545 L300 500 L350 530 L400 490 V800 H0Z" fill="#0c1a2a"/>
   <rect y="590" width="400" height="210" fill="#0d2236"/>
   <path d="M0 600 L60 650 L110 620 L170 680 L240 615 L300 650 L350 630 L400 660 V600Z" fill="#0c1a2a" opacity=".9"/>
   <path d="M60 700h80M200 730h120M120 760h60" stroke="#5be3b7" stroke-opacity=".25" stroke-width="2" stroke-linecap="round"/>`,
  `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050b1c"/><stop offset="1" stop-color="#10284a"/></linearGradient>
   <linearGradient id="au" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2af5b4"/><stop offset=".5" stop-color="#3ee0e8"/><stop offset="1" stop-color="#9a6bff"/></linearGradient>
   <linearGradient id="au2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7c5cff"/><stop offset="1" stop-color="#2af5b4"/></linearGradient>`,
);
const blossom = scene(
  `<rect width="400" height="800" fill="url(#sky)"/>
   <path d="M420 120 C340 150 300 200 250 230 M300 180 C290 230 270 260 230 290 M330 160 C360 210 380 230 420 240" stroke="#6b4a4a" stroke-width="6" fill="none" stroke-linecap="round"/>
   ${[[250, 230], [230, 290], [300, 180], [330, 160], [380, 228], [270, 205], [360, 140], [400, 125], [245, 262]].map(([x, y], i) => `<g transform="translate(${x} ${y}) rotate(${i * 23})">${[0, 72, 144, 216, 288].map(a => `<ellipse rx="7" ry="11" cy="-9" fill="${i % 2 ? '#ffc4d6' : '#ffd8e4'}" transform="rotate(${a})"/>`).join('')}<circle r="3" fill="#f58aa8"/></g>`).join('')}
   ${[[90, 380, 20], [150, 470, -30], [60, 560, 40], [210, 600, 10], [120, 690, -20], [300, 520, 60], [330, 680, 0], [40, 260, 30]].map(([x, y, a]) => `<ellipse cx="${x}" cy="${y}" rx="6" ry="9" fill="#ffc4d6" opacity=".8" transform="rotate(${a} ${x} ${y})"/>`).join('')}
   <path d="M0 740 C120 720 260 760 400 730 V800 H0Z" fill="#f6d5df"/>`,
  `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff5f8"/><stop offset="1" stop-color="#ffe6ee"/></linearGradient>`,
);
const starryHills = scene(
  `<rect width="400" height="800" fill="url(#sky)"/>
   ${Array.from({ length: 46 }, (_, i) => [(i * 89) % 400, (i * 53) % 520, 0.6 + ((i * 7) % 10) / 10]).map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${0.35 + r / 3}"/>`).join('')}
   <path d="M40 160 q60 40 140 10" stroke="#fff" stroke-opacity=".5" stroke-width="1.5" fill="none" stroke-linecap="round"/>
   <path d="M0 600 C100 540 180 620 280 570 S380 560 400 580 V800 H0Z" fill="#1c2b5a"/>
   <path d="M0 680 C120 630 220 700 320 660 S400 660 400 670 V800 H0Z" fill="#111c40"/>
   <path d="M290 572 l6 -22 l6 22z M310 568 l5 -18 l5 18z" fill="#0b132e"/>`,
  `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#060a24"/><stop offset=".7" stop-color="#1b2a66"/><stop offset="1" stop-color="#3a3e8f"/></linearGradient>`,
);
const paperFolds = scene(
  `<rect width="400" height="800" fill="#f3efe8"/>
   <path d="M0 0 L400 0 L400 260 L0 140Z" fill="#fbf8f3"/><path d="M0 140 L400 260 L400 520 L0 430Z" fill="#efe9df"/>
   <path d="M0 430 L400 520 L400 800 L0 800Z" fill="#f7f3ec"/><path d="M0 140 L400 260" stroke="#e2d9ca" stroke-width="1.2"/><path d="M0 430 L400 520" stroke="#e2d9ca" stroke-width="1.2"/>`,
);

/* ── The list ─────────────────────────────────────────────────────────── */

const DOODLE_COLORS: [string, string, string, number, 'light' | 'dark'][] = [
  ['doodle', 'Doodles', '#f4f1ea', 0, 'light'],
  ['doodle-mint', 'Doodles mint', '#e3f4ec', 1, 'light'],
  ['doodle-rose', 'Doodles rose', '#fbe9ee', 2, 'light'],
  ['doodle-sky', 'Doodles sky', '#e6f0fb', 3, 'light'],
  ['doodle-night', 'Doodles night', '#111827', 4, 'dark'],
  ['doodle-plum', 'Doodles plum', '#24132e', 5, 'dark'],
];
const DOODLE_INK = ['#8a7f6a', '#3f8a69', '#c06a83', '#5b82b8', '#c7d2fe', '#e9b8f5'];

export const WALLPAPERS: readonly Wallpaper[] = [
  // Soft
  { id: 'default', label: 'Theme', group: 'Soft', tone: 'light', style: {} },
  { id: 'pure_white', label: 'White', group: 'Soft', tone: 'light', style: solid('#ffffff') },
  { id: 'linen', label: 'Linen', group: 'Soft', tone: 'light', style: lin(180, '#faf7f2', '#f2ece2') },
  { id: 'mist', label: 'Mist', group: 'Soft', tone: 'light', style: lin(180, '#f4f7fb', '#e6ecf4') },
  { id: 'blush-soft', label: 'Blush', group: 'Soft', tone: 'light', style: lin(180, '#fff6f7', '#fde8ec') },
  { id: 'butter', label: 'Butter', group: 'Soft', tone: 'light', style: lin(180, '#fffbeb', '#fdf1c7') },
  { id: 'pistachio', label: 'Pistachio', group: 'Soft', tone: 'light', style: lin(180, '#f4fbf2', '#e2f2dc') },
  { id: 'ice', label: 'Ice', group: 'Soft', tone: 'light', style: lin(180, '#f2fbfd', '#dcf0f6') },
  { id: 'lilac', label: 'Lilac', group: 'Soft', tone: 'light', style: lin(180, '#f8f5ff', '#ebe3fb') },
  { id: 'amoled', label: 'Black', group: 'Soft', tone: 'dark', style: solid('#000000') },
  { id: 'slate', label: 'Slate', group: 'Soft', tone: 'dark', style: solid('#0f172a') },

  // Gradients
  { id: 'dawn', label: 'Dawn', group: 'Gradients', tone: 'light', style: lin(165, '#fde2e4', '#e2ece9', '#cddafd') },
  { id: 'peach-sky', label: 'Peach sky', group: 'Gradients', tone: 'light', style: lin(165, '#fff0e1', '#ffc8a8', '#ff9a8b') },
  { id: 'lagoon-grad', label: 'Lagoon', group: 'Gradients', tone: 'light', style: lin(160, '#d4fc79', '#96e6a1') },
  { id: 'citrus', label: 'Citrus', group: 'Gradients', tone: 'light', style: lin(160, '#fff1b8', '#ffd6a5', '#ffadad') },
  { id: 'berry', label: 'Berry', group: 'Gradients', tone: 'light', style: lin(160, '#fbc2eb', '#a6c1ee') },
  { id: 'rose', label: 'Rose garden', group: 'Gradients', tone: 'light', style: lin(160, '#ffecd2', '#fcb69f') },
  { id: 'lavender', label: 'Lavender', group: 'Gradients', tone: 'light', style: lin(160, '#e9d5ff', '#c4b5fd', '#a78bfa') },
  { id: 'sunset', label: 'Sunset', group: 'Gradients', tone: 'light', style: lin(160, '#ff6b6b', '#feca57', '#ff9f43') },
  { id: 'forest', label: 'Forest', group: 'Gradients', tone: 'dark', style: lin(160, '#134e5e', '#71b280') },
  { id: 'ocean', label: 'Ocean blue', group: 'Gradients', tone: 'dark', style: lin(160, '#0f2027', '#203a43', '#2c5364') },
  { id: 'aurora', label: 'Aurora', group: 'Gradients', tone: 'dark', style: lin(160, '#1a1a2e', '#16213e', '#0f3460', '#533483') },
  { id: 'twilight', label: 'Twilight', group: 'Gradients', tone: 'dark', style: lin(170, '#0b1026', '#2b1b4f', '#7a2e5c') },
  { id: 'deep-space', label: 'Deep space', group: 'Gradients', tone: 'dark', style: lin(180, '#000000', '#0b1230', '#1d1145') },

  // Mesh
  { id: 'iridescent', label: 'Iridescent', group: 'Mesh', tone: 'light', style: mesh('#f5f3ff', ['10% 10%', '#c7d2fe', '60% 50%'], ['90% 20%', '#fbcfe8', '55% 45%'], ['20% 90%', '#a7f3d0', '60% 50%'], ['85% 85%', '#fde68a', '55% 45%']) },
  { id: 'opal', label: 'Opal', group: 'Mesh', tone: 'light', style: mesh('#f0f9ff', ['0% 0%', '#e0f2fe', '70% 60%'], ['100% 30%', '#ede9fe', '60% 50%'], ['30% 100%', '#fce7f3', '70% 50%']) },
  { id: 'candy', label: 'Candy', group: 'Mesh', tone: 'light', style: mesh('#fff1f5', ['15% 20%', '#ffc6d9', '55% 45%'], ['85% 15%', '#c9e4ff', '55% 45%'], ['50% 95%', '#fff3b0', '70% 50%']) },
  { id: 'tropic', label: 'Tropic', group: 'Mesh', tone: 'light', style: mesh('#ecfdf5', ['10% 15%', '#99f6e4', '60% 50%'], ['90% 30%', '#fef08a', '55% 45%'], ['40% 95%', '#fdba74', '65% 50%']) },
  { id: 'pearl', label: 'Pearl', group: 'Mesh', tone: 'light', style: mesh('#fafaf9', ['20% 20%', '#f5f5f4', '50% 40%'], ['80% 70%', '#e7e5e4', '60% 50%'], ['10% 90%', '#fef3c7', '50% 40%']) },
  { id: 'sorbet', label: 'Sorbet', group: 'Mesh', tone: 'light', style: mesh('#fff7ed', ['0% 50%', '#fecdd3', '60% 60%'], ['100% 0%', '#fed7aa', '60% 50%'], ['70% 100%', '#e9d5ff', '60% 50%']) },
  { id: 'nebula', label: 'Nebula', group: 'Mesh', tone: 'dark', style: mesh('#0b0820', ['15% 20%', '#5b21b6', '55% 45%'], ['85% 35%', '#be185d', '50% 40%'], ['40% 90%', '#1d4ed8', '60% 50%']) },
  { id: 'velvet', label: 'Velvet', group: 'Mesh', tone: 'dark', style: mesh('#12060f', ['20% 10%', '#7f1d1d', '55% 45%'], ['90% 70%', '#581c87', '55% 45%'], ['10% 95%', '#9a3412', '50% 40%']) },
  { id: 'abyss', label: 'Abyss', group: 'Mesh', tone: 'dark', style: mesh('#03111a', ['10% 10%', '#0e7490', '50% 40%'], ['90% 50%', '#1e3a8a', '55% 45%'], ['40% 100%', '#065f46', '60% 50%']) },

  // Patterns
  { id: 'dots', label: 'Dot grid', group: 'Patterns', tone: 'light', style: pattern('#f7f8fa', dots('#15171c', 0.18), '22px 22px') },
  { id: 'circuit', label: 'Grid', group: 'Patterns', tone: 'light', style: pattern('#f7f8fa', grid('#15171c', 0.06), '28px 28px') },
  { id: 'diagonal', label: 'Pinstripe', group: 'Patterns', tone: 'light', style: pattern('#f6f5f2', diagonal('#15171c', 0.07), '16px 16px') },
  { id: 'waves', label: 'Waves', group: 'Patterns', tone: 'light', style: pattern('#eef6fb', waves('#0369a1', 0.16), '120px 40px') },
  { id: 'topography', label: 'Topography', group: 'Patterns', tone: 'light', style: pattern('#f3f1ea', topo('#6b5e45', 0.22), '200px 200px') },
  { id: 'hexagons', label: 'Honeycomb', group: 'Patterns', tone: 'light', style: pattern('#fdf8ec', hexagons('#b45309', 0.13), '56px 98px') },
  { id: 'chevrons', label: 'Chevrons', group: 'Patterns', tone: 'light', style: pattern('#f5f3fe', chevrons('#6d28d9', 0.12), '40px 24px') },
  { id: 'plus', label: 'Plus', group: 'Patterns', tone: 'light', style: pattern('#f1f7f3', plus('#15803d', 0.2), '36px 36px') },
  { id: 'terrazzo', label: 'Terrazzo', group: 'Patterns', tone: 'light', style: pattern('#f7f3ee', terrazzo(['#e9a487', '#9cc5b3', '#f3cf7a', '#b9b3d9']), '160px 160px') },
  { id: 'confetti', label: 'Confetti', group: 'Patterns', tone: 'light', style: pattern('#fffdf8', confetti(['#ff7a8a', '#7cc4ff', '#ffd166', '#8fe3b0']), '140px 140px') },
  { id: 'blueprint', label: 'Blueprint', group: 'Patterns', tone: 'dark', style: pattern('#0f2c57', grid('#9cc3ff', 0.16), '28px 28px') },
  { id: 'circuit-dark', label: 'Circuit', group: 'Patterns', tone: 'dark', style: pattern('#07140f', circuit('#34d399', 0.22), '90px 90px') },
  { id: 'stars', label: 'Stars', group: 'Patterns', tone: 'dark', style: pattern('#0b1026', stars(0.9), '180px 180px', 'linear-gradient(180deg, #0b1026, #1b1446)') },

  // Doodles
  ...DOODLE_COLORS.map(([id, label, base, i, tone]): Wallpaper => ({
    id,
    label,
    group: 'Doodles',
    tone,
    style: pattern(base, doodleTile(DOODLE_INK[i], tone === 'dark' ? 0.28 : 0.32), '220px 220px'),
  })),

  // Scenes
  { id: 'scene-dawn-peaks', label: 'Dawn peaks', group: 'Scenes', tone: 'light', style: cover(mountainsDawn, '#ffe4d6') },
  { id: 'scene-dunes', label: 'Dunes', group: 'Scenes', tone: 'light', style: cover(dunes, '#f9cfa0') },
  { id: 'scene-waves', label: 'Sea', group: 'Scenes', tone: 'light', style: cover(oceanWaves, '#bfe6f7') },
  { id: 'scene-blossom', label: 'Blossom', group: 'Scenes', tone: 'light', style: cover(blossom, '#ffe6ee') },
  { id: 'scene-paper', label: 'Folded paper', group: 'Scenes', tone: 'light', style: cover(paperFolds, '#f3efe8') },
  { id: 'scene-city', label: 'City night', group: 'Scenes', tone: 'dark', style: cover(cityNight, '#2a2f6b') },
  { id: 'scene-aurora', label: 'Aurora lake', group: 'Scenes', tone: 'dark', style: cover(auroraLake, '#0d2236') },
  { id: 'scene-stars', label: 'Starry hills', group: 'Scenes', tone: 'dark', style: cover(starryHills, '#1b2a66') },
];

export const DEFAULT_WALLPAPER_ID = 'default';

const BY_ID = new Map(WALLPAPERS.map(w => [w.id, w]));

/** CSS that older builds stored instead of an id (Settings saved the background itself). */
const LEGACY_CSS: Record<string, string> = {
  '#f7f8fa': 'default',
  '#ffffff': 'pure_white',
  '#000000': 'amoled',
  '#0f172a': 'slate',
  'linear-gradient(160deg, #0f2027 0%, #203a43 50%, #2c5364 100%)': 'ocean',
  'linear-gradient(160deg, #ff6b6b 0%, #feca57 50%, #ff9f43 100%)': 'sunset',
  'linear-gradient(160deg, #134e5e 0%, #71b280 100%)': 'forest',
  'linear-gradient(160deg, #1a1a2e 0%, #16213e 40%, #0f3460 70%, #533483 100%)': 'aurora',
  'linear-gradient(160deg, #ffecd2 0%, #fcb69f 100%)': 'rose',
  'linear-gradient(160deg, #e9d5ff 0%, #c4b5fd 50%, #a78bfa 100%)': 'lavender',
  // Old setting ids
  minimal: 'pure_white',
  holographic: 'lavender',
  matrix: 'circuit-dark',
  gradient: 'mist',
};

/** The wallpaper for a stored value: an id, or CSS an older build stored. Anything else: null. */
export function resolveWallpaper(value: unknown): Wallpaper | null {
  if (typeof value !== 'string' || !value) return null;
  const v = value.trim();
  return BY_ID.get(v) ?? BY_ID.get(LEGACY_CSS[v] ?? '') ?? null;
}

export function isWallpaperId(v: unknown): v is string {
  return typeof v === 'string' && BY_ID.has(v);
}

/**
 * The canvas style: the wallpaper's, or the colour theme's canvas colour for "Theme" / none.
 * Always the same five longhand properties, so React never mixes `background` with its longhands
 * when the person switches between a colour, a gradient and a pattern.
 */
export function canvasCss(wallpaper: Wallpaper | null, canvasColor: string): CSSProperties {
  const st = wallpaper && wallpaper.id !== DEFAULT_WALLPAPER_ID ? wallpaper.style : { backgroundColor: canvasColor };
  return {
    backgroundColor: st.backgroundColor ?? canvasColor,
    backgroundImage: st.backgroundImage ?? 'none',
    backgroundSize: st.backgroundSize ?? 'auto',
    backgroundPosition: st.backgroundPosition ?? '0% 0%',
    backgroundRepeat: st.backgroundRepeat ?? 'repeat',
  };
}
