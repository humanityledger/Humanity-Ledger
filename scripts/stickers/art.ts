/**
 * scripts/stickers/art.ts — the character rig behind Ledger Chat's sticker packs.
 *
 * Three original characters (Nubi the cloud, Sol the sun, Lumi the jelly drop, Spike the cactus),
 * drawn with volume: a lit gradient body, a rim of reflected light, a specular highlight, contact
 * shadow, glossy eyes, and a die-cut white edge with a soft drop shadow, like a printed vinyl
 * sticker. Faces, arms and props are parts the stickers combine, so every sticker in a pack shares
 * proportions, line weight and light direction (top left).
 *
 * Each sticker is one self-contained SVG with a little idle motion (bob, blink, twinkle) in CSS,
 * which browsers run inside <img>; it stops under prefers-reduced-motion. No fonts are loaded: the
 * caption uses rounded system fonts with a white outline.
 */

export type Eyes =
  | 'open' | 'happy' | 'closed' | 'wink' | 'heart' | 'star' | 'tears' | 'angry' | 'sleepy'
  | 'lidded' | 'roll' | 'wide' | 'dizzy' | 'x' | 'shades';
export type Mouth = 'smile' | 'grin' | 'laugh' | 'o' | 'smirk' | 'frown' | 'kiss' | 'cat' | 'wavy' | 'flat' | 'tongue' | 'tiny';
export type Brows = 'angry' | 'sad' | 'up' | 'sassy';
export type Arms = 'none' | 'wave' | 'up' | 'hug' | 'hold' | 'hip' | 'hand' | 'cheeks' | 'point';

export interface Face {
  eyes: Eyes;
  mouth: Mouth;
  brows?: Brows;
  blush?: boolean;
  sweat?: boolean;
}

/* ── Palette ─────────────────────────────────────────────────────────── */

const INK = '#2a2433';
const BLUSH = '#ff8fab';

/* ── Small helpers ───────────────────────────────────────────────────── */

const f = (n: number) => Number(n.toFixed(2));
// An animated part never carries its own transform attribute: a CSS animation's `transform`
// would replace it and the part would jump to the origin. The class goes on an inner group.
const g = (x: number, y: number, s = 1, r = 0, inner = '', cls = '') =>
  `<g transform="translate(${f(x)} ${f(y)})${r ? ` rotate(${r})` : ''}${s !== 1 ? ` scale(${s})` : ''}">${cls ? `<g class="${cls}">${inner}</g>` : inner}</g>`;

export const heartPath = (s = 1) =>
  `M0 ${f(9 * s)} C${f(-4 * s)} ${f(2 * s)} ${f(-22 * s)} ${f(-4 * s)} ${f(-22 * s)} ${f(-16 * s)} C${f(-22 * s)} ${f(-28 * s)} ${f(-6 * s)} ${f(-32 * s)} 0 ${f(-20 * s)} C${f(6 * s)} ${f(-32 * s)} ${f(22 * s)} ${f(-28 * s)} ${f(22 * s)} ${f(-16 * s)} C${f(22 * s)} ${f(-4 * s)} ${f(4 * s)} ${f(2 * s)} 0 ${f(9 * s)}Z`;

const star5 = (ro: number, ri: number) => {
  const p: string[] = [];
  for (let k = 0; k < 10; k++) {
    const a = (-90 + k * 36) * (Math.PI / 180);
    const r = k % 2 === 0 ? ro : ri;
    p.push(`${f(r * Math.cos(a))} ${f(r * Math.sin(a))}`);
  }
  return `M${p.join(' L')}Z`;
};
const sparkle4 = (r: number) =>
  `M0 ${-r} C${f(r * 0.12)} ${f(-r * 0.3)} ${f(r * 0.3)} ${f(-r * 0.12)} ${r} 0 C${f(r * 0.3)} ${f(r * 0.12)} ${f(r * 0.12)} ${f(r * 0.3)} 0 ${r} C${f(-r * 0.12)} ${f(r * 0.3)} ${f(-r * 0.3)} ${f(r * 0.12)} ${-r} 0 C${f(-r * 0.3)} ${f(-r * 0.12)} ${f(-r * 0.12)} ${f(-r * 0.3)} 0 ${-r}Z`;

/* ── Face parts (drawn around 0,0, eyes ±gap) ────────────────────────── */

function eye(kind: Eyes, side: -1 | 1, gap: number, size: number): string {
  const x = side * gap;
  const s = size;
  switch (kind) {
    case 'happy':
      return `<path d="M${f(x - 14 * s)} ${f(4 * s)} Q${x} ${f(-14 * s)} ${f(x + 14 * s)} ${f(4 * s)}" fill="none" stroke="${INK}" stroke-width="${f(7 * s)}" stroke-linecap="round"/>`;
    case 'closed':
      return `<path d="M${f(x - 14 * s)} ${f(-2 * s)} Q${x} ${f(12 * s)} ${f(x + 14 * s)} ${f(-2 * s)}" fill="none" stroke="${INK}" stroke-width="${f(7 * s)}" stroke-linecap="round"/>`;
    case 'wink':
      return side === 1 ? eye('happy', side, gap, size) : eye('open', side, gap, size);
    case 'heart':
      return g(x, 0, s * 0.95, side * -8, `<path d="${heartPath(1)}" transform="translate(0 6)" fill="#ff3f6c"/><ellipse cx="-9" cy="-14" rx="5" ry="3.4" fill="#fff" opacity=".85" transform="rotate(-30 -9 -14)"/>`, 'pulse');
    case 'star':
      return g(x, 0, s, 0, `<path d="${star5(19, 8.5)}" fill="#ffc83d" stroke="#e29a10" stroke-width="2" stroke-linejoin="round"/><circle cx="-5" cy="-6" r="3.2" fill="#fff" opacity=".9"/>`, 'twinkle');
    case 'tears':
      return (
        eye('open', side, gap, size) +
        `<path class="tear" d="M${f(x - 4 * s)} ${f(14 * s)} q${f(-6 * s)} ${f(26 * s)} ${f(2 * s)} ${f(60 * s)}" fill="none" stroke="#6cc6ff" stroke-width="${f(9 * s)}" stroke-linecap="round" opacity=".9"/>`
      );
    case 'angry':
      return `<ellipse cx="${x}" cy="${f(3 * s)}" rx="${f(11 * s)}" ry="${f(12 * s)}" fill="${INK}"/><circle cx="${f(x - 3 * s)}" cy="${f(-1 * s)}" r="${f(3.6 * s)}" fill="#fff"/>`;
    case 'sleepy':
      return `<path d="M${f(x - 14 * s)} ${f(2 * s)} Q${x} ${f(10 * s)} ${f(x + 14 * s)} ${f(2 * s)}" fill="none" stroke="${INK}" stroke-width="${f(6 * s)}" stroke-linecap="round"/>`;
    case 'lidded':
      return `<path d="M${f(x - 13 * s)} ${f(-1 * s)} H${f(x + 13 * s)} A${f(13 * s)} ${f(13 * s)} 0 0 1 ${f(x - 13 * s)} ${f(-1 * s)}Z" fill="${INK}"/><path d="M${f(x - 16 * s)} ${f(-2 * s)} H${f(x + 16 * s)}" stroke="${INK}" stroke-width="${f(5 * s)}" stroke-linecap="round"/><circle cx="${f(x - 4 * s)}" cy="${f(5 * s)}" r="${f(3 * s)}" fill="#fff"/>`;
    case 'roll':
      return `<ellipse cx="${x}" cy="0" rx="${f(15 * s)}" ry="${f(17 * s)}" fill="#fff" stroke="${INK}" stroke-width="${f(4 * s)}"/><ellipse cx="${f(x + side * 3 * s)}" cy="${f(-9 * s)}" rx="${f(6.5 * s)}" ry="${f(6 * s)}" fill="${INK}"/>`;
    case 'wide':
      return `<ellipse cx="${x}" cy="0" rx="${f(15 * s)}" ry="${f(20 * s)}" fill="${INK}"/><circle cx="${f(x - 5 * s)}" cy="${f(-7 * s)}" r="${f(6.5 * s)}" fill="#fff"/><circle cx="${f(x + 5 * s)}" cy="${f(7 * s)}" r="${f(3 * s)}" fill="#fff"/><circle cx="${f(x + 6 * s)}" cy="${f(-9 * s)}" r="${f(1.8 * s)}" fill="#fff"/>`;
    case 'dizzy':
      return `<path d="M${x} 0 m${f(-2 * s)} 0 a${f(2 * s)} ${f(2 * s)} 0 1 1 ${f(4 * s)} 0 a${f(5 * s)} ${f(5 * s)} 0 1 1 ${f(-9 * s)} 0 a${f(8 * s)} ${f(8 * s)} 0 1 1 ${f(15 * s)} 0 a${f(11 * s)} ${f(11 * s)} 0 1 1 ${f(-21 * s)} 0" fill="none" stroke="${INK}" stroke-width="${f(4 * s)}" stroke-linecap="round"/>`;
    case 'x':
      return `<path d="M${f(x - 11 * s)} ${f(-11 * s)} L${f(x + 11 * s)} ${f(11 * s)} M${f(x + 11 * s)} ${f(-11 * s)} L${f(x - 11 * s)} ${f(11 * s)}" stroke="${INK}" stroke-width="${f(7 * s)}" stroke-linecap="round"/>`;
    case 'shades':
      return '';
    case 'open':
    default:
      return `<g class="blink"><ellipse cx="${x}" cy="0" rx="${f(12 * s)}" ry="${f(16 * s)}" fill="${INK}"/><circle cx="${f(x - 4 * s)}" cy="${f(-6 * s)}" r="${f(5.2 * s)}" fill="#fff"/><circle cx="${f(x + 4.5 * s)}" cy="${f(6 * s)}" r="${f(2.2 * s)}" fill="#fff"/></g>`;
  }
}

function brows(kind: Brows | undefined, gap: number, s: number): string {
  if (!kind) return '';
  const y = -30 * s;
  const w = 13 * s;
  const sw = f(6 * s);
  const seg = (x1: number, y1: number, x2: number, y2: number) =>
    `<path d="M${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)}" stroke="${INK}" stroke-width="${sw}" stroke-linecap="round"/>`;
  const t = 7 * s;
  switch (kind) {
    case 'angry': // inner ends low
      return seg(-gap - w, y - t, -gap + w, y + t) + seg(gap - w, y + t, gap + w, y - t);
    case 'sad': // inner ends high
      return seg(-gap - w, y + t, -gap + w, y - t) + seg(gap - w, y - t, gap + w, y + t);
    case 'up':
      return `<path d="M${f(-gap - w)} ${f(y - 2 * s)} Q${-gap} ${f(y - 12 * s)} ${f(-gap + w)} ${f(y - 2 * s)}" fill="none" stroke="${INK}" stroke-width="${sw}" stroke-linecap="round"/><path d="M${f(gap - w)} ${f(y - 2 * s)} Q${gap} ${f(y - 12 * s)} ${f(gap + w)} ${f(y - 2 * s)}" fill="none" stroke="${INK}" stroke-width="${sw}" stroke-linecap="round"/>`;
    case 'sassy':
      return `<path d="M${f(-gap - w)} ${f(y)} L${f(-gap + w)} ${f(y + 3 * s)}" stroke="${INK}" stroke-width="${sw}" stroke-linecap="round"/><path d="M${f(gap - w)} ${f(y - 2 * s)} Q${gap} ${f(y - 14 * s)} ${f(gap + w)} ${f(y - 6 * s)}" fill="none" stroke="${INK}" stroke-width="${sw}" stroke-linecap="round"/>`;
  }
}

function mouth(kind: Mouth, s: number): string {
  const sw = f(6 * s);
  const st = `fill="none" stroke="${INK}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"`;
  switch (kind) {
    case 'smile':
      return `<path d="M${f(-15 * s)} 0 Q0 ${f(15 * s)} ${f(15 * s)} 0" ${st}/>`;
    case 'tiny':
      return `<path d="M${f(-8 * s)} 0 Q0 ${f(8 * s)} ${f(8 * s)} 0" ${st}/>`;
    case 'grin':
      return `<path d="M${f(-20 * s)} ${f(-3 * s)} Q0 ${f(28 * s)} ${f(20 * s)} ${f(-3 * s)}Z" fill="#4a1d2f" stroke="${INK}" stroke-width="${f(4 * s)}" stroke-linejoin="round"/><path d="M${f(-10 * s)} ${f(10 * s)} Q0 ${f(2 * s)} ${f(10 * s)} ${f(10 * s)} Q0 ${f(17 * s)} ${f(-10 * s)} ${f(10 * s)}Z" fill="#ff7d96"/>`;
    case 'laugh':
      return `<path d="M${f(-27 * s)} ${f(-6 * s)} Q0 ${f(40 * s)} ${f(27 * s)} ${f(-6 * s)}Z" fill="#4a1d2f" stroke="${INK}" stroke-width="${f(4 * s)}" stroke-linejoin="round"/><path d="M${f(-14 * s)} ${f(14 * s)} Q0 ${f(3 * s)} ${f(14 * s)} ${f(14 * s)} Q0 ${f(25 * s)} ${f(-14 * s)} ${f(14 * s)}Z" fill="#ff7d96"/><path d="M${f(-20 * s)} ${f(-4 * s)} H${f(20 * s)}" stroke="#fff" stroke-width="${f(5 * s)}" stroke-linecap="round"/>`;
    case 'o':
      return `<ellipse cx="0" cy="${f(4 * s)}" rx="${f(9 * s)}" ry="${f(12 * s)}" fill="#4a1d2f" stroke="${INK}" stroke-width="${f(4 * s)}"/>`;
    case 'smirk':
      return `<path d="M${f(-14 * s)} ${f(4 * s)} Q${f(4 * s)} ${f(10 * s)} ${f(16 * s)} ${f(-6 * s)}" ${st}/>`;
    case 'frown':
      return `<path d="M${f(-14 * s)} ${f(8 * s)} Q0 ${f(-6 * s)} ${f(14 * s)} ${f(8 * s)}" ${st}/>`;
    case 'kiss':
      return `<path d="M${f(-3 * s)} ${f(-10 * s)} Q${f(10 * s)} ${f(-8 * s)} ${f(2 * s)} 0 Q${f(11 * s)} ${f(8 * s)} ${f(-3 * s)} ${f(10 * s)}" ${st}/>`;
    case 'cat':
      return `<path d="M${f(-14 * s)} 0 Q${f(-7 * s)} ${f(9 * s)} 0 0 Q${f(7 * s)} ${f(9 * s)} ${f(14 * s)} 0" ${st}/>`;
    case 'wavy':
      return `<path d="M${f(-18 * s)} ${f(2 * s)} q${f(4.5 * s)} ${f(-6 * s)} ${f(9 * s)} 0 t${f(9 * s)} 0 t${f(9 * s)} 0 t${f(9 * s)} 0" ${st}/>`;
    case 'flat':
      return `<path d="M${f(-12 * s)} ${f(3 * s)} H${f(12 * s)}" ${st}/>`;
    case 'tongue':
      return `<path d="M${f(-16 * s)} 0 Q0 ${f(14 * s)} ${f(16 * s)} 0" ${st}/><path d="M${f(2 * s)} ${f(6 * s)} q${f(12 * s)} ${f(2 * s)} ${f(10 * s)} ${f(14 * s)} q${f(-2 * s)} ${f(9 * s)} ${f(-10 * s)} ${f(6 * s)} q${f(-6 * s)} ${f(-4 * s)} 0 ${f(-20 * s)}Z" fill="#ff7d96" stroke="${INK}" stroke-width="${f(3.5 * s)}" stroke-linejoin="round"/>`;
  }
}

/** A face centred on 0,0. `gap` is half the distance between the eyes. */
export function face(fc: Face, gap = 40, s = 1): string {
  const cheeks = fc.blush
    ? `<ellipse cx="${-gap - 22 * s}" cy="${f(22 * s)}" rx="${f(16 * s)}" ry="${f(10 * s)}" fill="${BLUSH}" opacity=".75" filter="url(#soft)"/><ellipse cx="${gap + 22 * s}" cy="${f(22 * s)}" rx="${f(16 * s)}" ry="${f(10 * s)}" fill="${BLUSH}" opacity=".75" filter="url(#soft)"/>`
    : '';
  const shades =
    fc.eyes === 'shades'
      ? `<g class="shine-host"><path d="M${-gap - 30 * s} ${-14 * s} H${gap + 30 * s} L${gap + 26 * s} ${8 * s} Q${gap + 22 * s} ${22 * s} ${gap + 4 * s} ${20 * s} Q${10 * s} ${18 * s} ${6 * s} ${2 * s} H${-6 * s} Q${-10 * s} ${18 * s} ${-gap - 4 * s} ${20 * s} Q${-gap - 22 * s} ${22 * s} ${-gap - 26 * s} ${8 * s}Z" fill="#141018"/><path d="M${-gap - 18 * s} ${-8 * s} l${14 * s} 0 l${-10 * s} ${18 * s}Z M${gap - 2 * s} ${-8 * s} l${14 * s} 0 l${-10 * s} ${18 * s}Z" fill="#fff" opacity=".28"/></g>`
      : '';
  const sweat = fc.sweat
    ? `<path d="M${gap + 34 * s} ${-36 * s} q${10 * s} ${16 * s} 0 ${24 * s} q${-10 * s} ${-8 * s} 0 ${-24 * s}Z" fill="#8fd3ff" stroke="#fff" stroke-width="${3 * s}"/>`
    : '';
  return (
    cheeks +
    brows(fc.brows, gap, s) +
    eye(fc.eyes, -1, gap, s) +
    eye(fc.eyes, 1, gap, s) +
    shades +
    g(0, 30 * s, 1, 0, mouth(fc.mouth, s)) +
    sweat
  );
}

/* ── Characters ──────────────────────────────────────────────────────── */

export interface Character {
  defs: string;
  /** Body, drawn at 0,0 (centre of mass). */
  body: string;
  /** Where the face sits, and its scale and eye gap. */
  faceAt: [number, number];
  faceScale: number;
  eyeGap: number;
  /** Arm colour gradient id and arm anchor points (left, right) and arm length. */
  arm: { fill: string; left: [number, number]; right: [number, number]; len: number; w: number };
}

export function nubi(tint: [string, string, string] = ['#ffffff', '#e8ecff', '#b9c4f2']): Character {
  const path =
    'M-118 74 C-176 74 -184 -2 -128 -14 C-134 -82 -60 -108 -24 -66 C-4 -124 84 -118 88 -56 C134 -84 186 -32 152 14 C194 30 178 88 124 82 C62 104 -58 104 -118 74Z';
  return {
    defs: `<radialGradient id="nubiG" cx="36%" cy="22%" r="85%"><stop offset="0" stop-color="${tint[0]}"/><stop offset=".55" stop-color="${tint[1]}"/><stop offset="1" stop-color="${tint[2]}"/></radialGradient>
      <linearGradient id="nubiRim" x1="0" y1="0" x2="0" y2="1"><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".9"/></linearGradient>`,
    body: `<path d="${path}" fill="url(#nubiG)"/><path d="${path}" fill="none" stroke="url(#nubiRim)" stroke-width="6" transform="translate(0 -3) scale(.97)"/>
      <ellipse cx="-70" cy="-58" rx="34" ry="16" fill="#fff" opacity=".9" transform="rotate(-24 -70 -58)"/><ellipse cx="-30" cy="-84" rx="10" ry="6" fill="#fff" opacity=".8"/>`,
    faceAt: [0, 4],
    faceScale: 1,
    eyeGap: 42,
    arm: { fill: 'url(#nubiG)', left: [-120, 40], right: [120, 40], len: 44, w: 30 },
  };
}

export function sol(): Character {
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = i * 30;
    return `<path d="M-15 -98 Q0 -146 15 -98Z" fill="url(#solRay)" transform="rotate(${a})" stroke="#ff9d1a" stroke-width="2" stroke-linejoin="round"/>`;
  }).join('');
  return {
    defs: `<radialGradient id="solG" cx="36%" cy="28%" r="80%"><stop offset="0" stop-color="#fff6c2"/><stop offset=".45" stop-color="#ffd24a"/><stop offset="1" stop-color="#ff9a1f"/></radialGradient>
      <linearGradient id="solRay" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffb52e"/><stop offset="1" stop-color="#ffd86b"/></linearGradient>`,
    body: `<g class="spin-slow">${rays}</g><circle r="100" fill="url(#solG)"/><circle r="97" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="5" stroke-dasharray="120 500" stroke-dashoffset="-330"/>
      <ellipse cx="-44" cy="-56" rx="30" ry="15" fill="#fff" opacity=".75" transform="rotate(-35 -44 -56)"/><circle cx="-12" cy="-80" r="6" fill="#fff" opacity=".7"/>`,
    faceAt: [0, 0],
    faceScale: 1,
    eyeGap: 38,
    arm: { fill: 'url(#solG)', left: [-96, 30], right: [96, 30], len: 40, w: 28 },
  };
}

export function lumi(c: [string, string, string] = ['#d6fff0', '#4fe0b5', '#11a07a']): Character {
  const path = 'M0 -132 C34 -84 112 -24 112 46 C112 112 60 142 0 142 C-60 142 -112 112 -112 46 C-112 -24 -34 -84 0 -132Z';
  return {
    defs: `<radialGradient id="lumiG" cx="38%" cy="30%" r="80%"><stop offset="0" stop-color="${c[0]}"/><stop offset=".5" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[2]}"/></radialGradient>
      <radialGradient id="lumiCore" cx="55%" cy="70%" r="55%"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`,
    body: `<path d="${path}" fill="url(#lumiG)"/><path d="${path}" fill="url(#lumiCore)"/>
      <path d="${path}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="5" transform="scale(.94) translate(0 4)"/>
      <path d="M-74 72 Q-60 118 -6 126" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="8" stroke-linecap="round"/>
      <ellipse cx="-44" cy="-40" rx="24" ry="38" fill="#fff" opacity=".85" transform="rotate(32 -44 -40)"/><circle cx="-14" cy="-88" r="8" fill="#fff" opacity=".9"/><circle cx="62" cy="10" r="5" fill="#fff" opacity=".7"/>`,
    faceAt: [0, 44],
    faceScale: 1,
    eyeGap: 38,
    arm: { fill: 'url(#lumiG)', left: [-104, 70], right: [104, 70], len: 38, w: 26 },
  };
}

export function spike(): Character {
  const spines = [
    [-46, -70], [44, -84], [-50, 0], [52, -20], [-40, 60], [46, 50], [-8, -112], [10, 20], [-14, -40], [20, 84],
  ]
    .map(([x, y]) => `<path d="M${x} ${y} l-7 -6 M${x} ${y} l7 -6 M${x} ${y} v-9" stroke="#fffbe6" stroke-width="3" stroke-linecap="round"/>`)
    .join('');
  return {
    defs: `<linearGradient id="spikeG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9be15d"/><stop offset=".55" stop-color="#4caf50"/><stop offset="1" stop-color="#2e7d32"/></linearGradient>
      <linearGradient id="potG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f08a5d"/><stop offset=".6" stop-color="#d2603a"/><stop offset="1" stop-color="#a8462a"/></linearGradient>`,
    body: `<path d="M-74 104 H74 L60 176 Q58 186 46 186 H-46 Q-58 186 -60 176Z" fill="url(#potG)"/><rect x="-84" y="92" width="168" height="30" rx="12" fill="#e9774c"/><rect x="-84" y="92" width="168" height="10" rx="5" fill="#fff" opacity=".22"/>
      <rect x="-70" y="-138" width="140" height="244" rx="70" fill="url(#spikeG)"/>
      <path d="M-30 -126 V96 M0 -136 V104 M30 -126 V96" stroke="#256b2a" stroke-opacity=".28" stroke-width="5" stroke-linecap="round"/>
      <rect x="-56" y="-118" width="26" height="150" rx="13" fill="#fff" opacity=".28"/>${spines}
      ${g(18, -142, 1, 0, `${[0, 72, 144, 216, 288].map(a => `<ellipse rx="11" ry="17" cy="-14" fill="#ff6fa8" transform="rotate(${a})"/>`).join('')}<circle r="9" fill="#ffd23f"/>`)}`,
    faceAt: [0, -22],
    faceScale: 0.95,
    eyeGap: 30,
    arm: { fill: 'url(#spikeG)', left: [-66, 0], right: [66, 0], len: 52, w: 32 },
  };
}

/** One arm: a rounded capsule from the shoulder, at `angle` degrees (0 = straight out). */
function arm(c: Character, side: -1 | 1, angle: number, cls = '', bend = 0): string {
  const [ax, ay] = side < 0 ? c.arm.left : c.arm.right;
  const L = c.arm.len;
  const W = c.arm.w;
  const inner = `<rect x="${-W / 2}" y="${-W / 2}" width="${L + W / 2}" height="${W}" rx="${W / 2}" fill="${c.arm.fill}"/>${
    bend ? `<rect x="${L - W / 2}" y="${-W / 2}" width="${W * 1.1}" height="${W}" rx="${W / 2}" fill="${c.arm.fill}" transform="rotate(${bend} ${L - W / 2} 0)"/>` : ''
  }<ellipse cx="${L * 0.45}" cy="${-W * 0.22}" rx="${L * 0.3}" ry="${W * 0.14}" fill="#fff" opacity=".35"/>`;
  const rot = side < 0 ? 180 - angle : angle;
  return `<g transform="translate(${ax} ${ay}) rotate(${rot})"><g transform="${side < 0 ? 'scale(1 -1)' : ''}">${inner}</g></g>`;
}

export function arms(c: Character, pose: Arms): string {
  switch (pose) {
    case 'wave':
      return arm(c, -1, 20) + `<g class="wave" style="transform-origin:${c.arm.right[0]}px ${c.arm.right[1]}px">${arm(c, 1, -55)}</g>`;
    case 'up':
      return arm(c, -1, -55) + arm(c, 1, -55);
    case 'hug':
      return arm(c, -1, 150, '', 0) + arm(c, 1, 150, '', 0);
    case 'hold':
      return arm(c, -1, 125) + arm(c, 1, 125);
    case 'hip':
      return arm(c, -1, 40, '', 70) + arm(c, 1, -20);
    case 'hand':
      return arm(c, -1, 20) + arm(c, 1, -10);
    case 'cheeks':
      return arm(c, -1, 140) + arm(c, 1, 140);
    case 'point':
      return arm(c, -1, 30) + arm(c, 1, -15);
    case 'none':
    default:
      return arm(c, -1, 25) + arm(c, 1, 25);
  }
}

export function character(c: Character, fc: Face, pose: Arms = 'none', front = ''): string {
  const behind = pose === 'hug' || pose === 'hold' || pose === 'cheeks' ? '' : arms(c, pose);
  const ahead = pose === 'hug' || pose === 'hold' || pose === 'cheeks' ? arms(c, pose) : '';
  return `${behind}${c.body}${g(c.faceAt[0], c.faceAt[1], 1, 0, face(fc, c.eyeGap, c.faceScale))}${ahead}${front}`;
}

/* ── Props (sticker coordinates, 512 × 512) ──────────────────────────── */

export const prop = {
  heart: (x: number, y: number, s = 1, r = 0, color = '#ff4f7b', cls = 'pulse') =>
    g(x, y, s, r, `<path d="${heartPath(1.6)}" fill="${color}" stroke="#fff" stroke-width="5" stroke-linejoin="round"/><ellipse cx="-16" cy="-30" rx="8" ry="5" fill="#fff" opacity=".75" transform="rotate(-30 -16 -30)"/>`, cls),
  sparkle: (x: number, y: number, s = 1, color = '#ffd23f', cls = 'twinkle') =>
    g(x, y, s, 0, `<path d="${sparkle4(32)}" fill="${color}" stroke="#fff" stroke-width="4"/>`, cls),
  star: (x: number, y: number, s = 1, color = '#ffd23f') => g(x, y, s, 0, `<path d="${star5(26, 11)}" fill="${color}" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>`, 'twinkle'),
  zzz: (x: number, y: number) =>
    `<g class="zz" font-family="Avenir Next Rounded, Arial Rounded MT Bold, Nunito, system-ui, sans-serif" font-weight="900" fill="#7c83ff" stroke="#fff" stroke-width="6" paint-order="stroke"><text x="${x}" y="${y}" font-size="54">Z</text><text x="${x + 40}" y="${y - 36}" font-size="40">z</text><text x="${x + 70}" y="${y - 66}" font-size="30">z</text></g>`,
  moon: (x: number, y: number) =>
    g(x, y, 1, -20, `<path d="M20 -40 A44 44 0 1 0 20 40 A34 34 0 1 1 20 -40Z" fill="#ffe28a" stroke="#fff" stroke-width="5"/><circle cx="-6" cy="-6" r="6" fill="#f4c64f"/><circle cx="4" cy="18" r="4" fill="#f4c64f"/>`),
  coffee: (x: number, y: number) =>
    g(x, y, 1, 0, `<path d="M-34 -24 H34 L28 34 Q26 46 14 46 H-14 Q-26 46 -28 34Z" fill="#fff" stroke="#e8e2da" stroke-width="3"/><path d="M34 -10 q24 0 22 18 q-2 16 -26 16" fill="none" stroke="#fff" stroke-width="9"/><ellipse cx="0" cy="-24" rx="34" ry="8" fill="#8b5a3c"/><path d="M-12 -40 q-8 -14 2 -26 M8 -42 q-8 -14 2 -26" class="steam" fill="none" stroke="#c9b8a8" stroke-width="5" stroke-linecap="round"/><path d="M-10 6 q10 -10 20 0 q-10 14 -20 0" fill="#ff7aa2"/>`),
  crown: (x: number, y: number, s = 1, r = 0) =>
    g(x, y, s, r, `<path d="M-50 20 L-56 -30 L-26 -4 L0 -44 L26 -4 L56 -30 L50 20Z" fill="#ffcf3f" stroke="#e09b14" stroke-width="4" stroke-linejoin="round"/><rect x="-50" y="16" width="100" height="16" rx="6" fill="#f2b51c"/><circle cx="0" cy="-12" r="7" fill="#ff5c8a"/><circle cx="-30" cy="6" r="5" fill="#4fc3f7"/><circle cx="30" cy="6" r="5" fill="#4fc3f7"/><path d="M-40 -18 l10 12" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".7"/>`, 'twinkle-slow'),
  coin: (x: number, y: number, s = 1) =>
    g(x, y, s, 0, `<circle r="26" fill="#ffcf3f" stroke="#e09b14" stroke-width="4"/><circle r="18" fill="none" stroke="#f2b51c" stroke-width="3"/><path d="M0 -12 v24 M-7 -6 h10 a5 5 0 0 1 0 10 h-7 a5 5 0 0 0 0 10 h10" fill="none" stroke="#b77a0d" stroke-width="3.5" stroke-linecap="round"/><ellipse cx="-9" cy="-12" rx="6" ry="3.5" fill="#fff" opacity=".7" transform="rotate(-30 -9 -12)"/>`, 'flip'),
  bill: (x: number, y: number, r = 0) =>
    g(x, y, 1, r, `<rect x="-46" y="-24" width="92" height="48" rx="7" fill="#7ed37f" stroke="#fff" stroke-width="4"/><rect x="-38" y="-16" width="76" height="32" rx="4" fill="none" stroke="#3f9a45" stroke-width="2.5"/><circle r="11" fill="#3f9a45"/><path d="M0 -6 v12" stroke="#c8f0c8" stroke-width="3"/>`),
  mic: (x: number, y: number, r = 0) =>
    g(x, y, 1, r, `<rect x="-9" y="-6" width="18" height="70" rx="9" fill="#3a3f4b"/><rect x="-6" y="-2" width="5" height="56" rx="2.5" fill="#fff" opacity=".25"/><circle cy="-26" r="28" fill="#bfc6d4" stroke="#fff" stroke-width="5"/><path d="M-20 -34 h40 M-24 -22 h48 M-20 -10 h40" stroke="#8a93a6" stroke-width="3"/><ellipse cx="-10" cy="-38" rx="8" ry="5" fill="#fff" opacity=".7"/>`),
  flame: (x: number, y: number, s = 1) =>
    g(x, y, s, 0, `<path d="M0 -70 C30 -36 46 -14 40 14 C34 44 12 56 0 56 C-14 56 -38 44 -40 16 C-42 -6 -26 -18 -20 -40 C-10 -26 -6 -20 0 -70Z" fill="#ff7a1a" stroke="#fff" stroke-width="5" stroke-linejoin="round"/><path d="M0 -20 C14 -2 22 10 18 26 C14 42 6 46 0 46 C-8 46 -20 40 -20 24 C-20 12 -10 4 -6 -8 C-2 0 0 0 0 -20Z" fill="#ffd23f"/>`, 'flicker'),
  drops: (x: number, y: number, color: string) =>
    [[-60, -20, 1, -30], [70, -40, 0.8, 30], [-90, 50, 0.6, -60], [96, 40, 0.7, 50], [0, -90, 0.7, 0]]
      .map(([dx, dy, s, r]) => g(x + dx, y + dy, s, r, `<path d="M0 -26 C10 -10 16 0 16 10 A16 16 0 0 1 -16 10 C-16 0 -10 -10 0 -26Z" fill="${color}" stroke="#fff" stroke-width="4"/><circle cx="-5" cy="6" r="4" fill="#fff" opacity=".7"/>`, 'pop'))
      .join(''),
  dots: (x: number, y: number) =>
    g(x, y, 1, 0, `<path d="M-40 -26 H40 A18 18 0 0 1 58 -8 V8 A18 18 0 0 1 40 26 H-6 L-24 40 V26 H-40 A18 18 0 0 1 -58 8 V-8 A18 18 0 0 1 -40 -26Z" fill="#fff" stroke="#e3e6ef" stroke-width="3"/><circle class="dot" cx="-20" r="7" fill="#9aa3b5"/><circle class="dot d2" cx="0" r="7" fill="#9aa3b5"/><circle class="dot d3" cx="20" r="7" fill="#9aa3b5"/>`),
  question: (x: number, y: number, s = 1, r = 0) =>
    `<g class="bob-fast"><text x="${x}" y="${y}" transform="rotate(${r} ${x} ${y})" font-size="${70 * s}" font-family="Avenir Next Rounded, Arial Rounded MT Bold, Nunito, system-ui, sans-serif" font-weight="900" fill="#7dd3fc" stroke="#fff" stroke-width="8" paint-order="stroke">?</text></g>`,
  speed: (x: number, y: number) =>
    `<g stroke="#c9d3e6" stroke-width="9" stroke-linecap="round" class="speed"><path d="M${x} ${y} h-70"/><path d="M${x + 10} ${y + 34} h-90"/><path d="M${x} ${y + 68} h-60"/></g>`,
  hand: (x: number, y: number, color = 'url(#spikeG)') =>
    g(x, y, 1, 0, `<rect x="-34" y="-40" width="68" height="80" rx="30" fill="${color}" stroke="#fff" stroke-width="5"/>${[-24, -8, 8, 24].map((dx, i) => `<rect x="${dx - 7}" y="${-76 + (i === 0 || i === 3 ? 12 : 0)}" width="14" height="46" rx="7" fill="${color}" stroke="#fff" stroke-width="4"/>`).join('')}<rect x="28" y="-20" width="34" height="14" rx="7" fill="${color}" stroke="#fff" stroke-width="4" transform="rotate(-30 28 -20)"/>`, 'push'),
  blast: (x: number, y: number) =>
    g(x, y, 1, 0, `<path d="M0 -70 L18 -36 L56 -52 L40 -16 L78 0 L40 16 L56 52 L18 36 L0 70 L-18 36 L-56 52 L-40 16 L-78 0 L-40 -16 L-56 -52 L-18 -36Z" fill="#ffcf3f" stroke="#fff" stroke-width="6" stroke-linejoin="round"/><path d="M0 -40 L10 -18 L32 -28 L22 -8 L44 0 L22 8 L32 28 L10 18 L0 40 L-10 18 L-32 28 L-22 8 L-44 0 L-22 -8 L-32 -28 L-10 -18Z" fill="#ff7a3c"/>`, 'pop'),
  partyHat: (x: number, y: number, r = 0) =>
    g(x, y, 1, r, `<path d="M0 -70 L34 10 H-34Z" fill="#7c5cff" stroke="#fff" stroke-width="5" stroke-linejoin="round"/><path d="M-14 -24 L14 -10 M-22 -2 L22 10 M-6 -48 L10 -40" stroke="#ffd23f" stroke-width="7" stroke-linecap="round"/><circle cy="-74" r="10" fill="#ff5c8a" stroke="#fff" stroke-width="4"/>`),
  confetti: (cx: number, cy: number) =>
    [[-130, -120, '#ff5c8a', 20], [120, -140, '#4fc3f7', -30], [-150, 10, '#ffd23f', 60], [150, -20, '#7ed37f', -50], [-100, -180, '#a78bfa', 10], [90, -190, '#ff9a3c', 70]]
      .map(([dx, dy, c, r], i) => `<g class="twinkle"><rect x="${cx + (dx as number)}" y="${cy + (dy as number)}" width="${i % 2 ? 22 : 14}" height="${i % 2 ? 10 : 14}" rx="${i % 2 ? 5 : 7}" fill="${c}" stroke="#fff" stroke-width="3" transform="rotate(${r} ${cx + (dx as number)} ${cy + (dy as number)})"/></g>`)
      .join(''),
  flower: (x: number, y: number, s = 1) =>
    g(x, y, s, 0, `${[0, 72, 144, 216, 288].map(a => `<ellipse rx="14" ry="22" cy="-18" fill="#ff8fb1" stroke="#fff" stroke-width="3" transform="rotate(${a})"/>`).join('')}<circle r="12" fill="#ffd23f"/>`, 'sway'),
  steam: (x: number, y: number) =>
    `<g class="steam" fill="#fff" stroke="#e6e9f2" stroke-width="3"><circle cx="${x}" cy="${y}" r="20"/><circle cx="${x + 22}" cy="${y - 10}" r="16"/><circle cx="${x + 40}" cy="${y + 2}" r="13"/></g>`,
  puddle: (x: number, y: number, color: string) =>
    `<ellipse cx="${x}" cy="${y}" rx="150" ry="26" fill="${color}" opacity=".9"/><ellipse cx="${x - 50}" cy="${y - 6}" rx="40" ry="7" fill="#fff" opacity=".45"/>${[[-90, 0], [70, 2], [10, 6]].map(([dx, dy]) => `<circle class="drip" cx="${x + dx}" cy="${y + dy}" r="9" fill="${color}"/>`).join('')}`,
  explosion: (x: number, y: number) =>
    g(x, y, 1, 0, `${[[-50, 0, 34], [-14, -26, 42], [30, -10, 38], [56, 14, 26], [-30, 22, 28], [12, 20, 30]].map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#efe9ff" stroke="#fff" stroke-width="5"/>`).join('')}<circle cx="-20" cy="-30" r="10" fill="#fff"/>`, 'pop'),
};

/* ── The sticker document ───────────────────────────────────────────── */

const CSS = `
.bob{animation:bob 2.6s ease-in-out infinite;transform-box:view-box;transform-origin:256px 400px}
.bob-fast{animation:bob 1.4s ease-in-out infinite}
.blink{animation:blink 4.2s infinite;transform-box:fill-box;transform-origin:center}
.wave{animation:wave 1.1s ease-in-out infinite}
.pulse{animation:pulse 1.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.twinkle{animation:twinkle 1.6s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.twinkle-slow{animation:twinkle 3s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.spin-slow{animation:spin 24s linear infinite;transform-box:fill-box;transform-origin:center}
.tear{animation:tear 1.2s ease-in infinite}
.zz{animation:zz 2.4s ease-in-out infinite}
.steam{animation:steam 2s ease-in-out infinite}
.flicker{animation:flicker .5s ease-in-out infinite alternate;transform-box:fill-box;transform-origin:50% 100%}
.flip{animation:flip 1.6s linear infinite;transform-box:fill-box;transform-origin:center}
.pop{animation:popin 1.8s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.push{animation:push 1s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.shake{animation:shake .32s linear infinite}
.sway{animation:sway 2.4s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 100%}
.speed{animation:speed .6s linear infinite}
.drip{animation:drip 1.6s ease-in infinite}
.dot{animation:dot 1.2s ease-in-out infinite}.d2{animation-delay:.15s}.d3{animation-delay:.3s}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}
@keyframes wave{0%,100%{transform:rotate(0)}50%{transform:rotate(-22deg)}}
@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.14)}}
@keyframes twinkle{0%,100%{transform:scale(.86) rotate(0);opacity:.85}50%{transform:scale(1.1) rotate(12deg);opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes tear{0%{stroke-dasharray:0 200;opacity:0}20%{opacity:.95}100%{stroke-dasharray:90 200;opacity:.2}}
@keyframes zz{0%,100%{transform:translateY(0);opacity:.75}50%{transform:translateY(-12px);opacity:1}}
@keyframes steam{0%,100%{transform:translateY(0);opacity:.55}50%{transform:translateY(-8px);opacity:1}}
@keyframes flicker{to{transform:scaleY(1.08) skewX(-3deg)}}
@keyframes flip{0%{transform:scaleX(1)}50%{transform:scaleX(.15)}100%{transform:scaleX(1)}}
@keyframes popin{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
@keyframes push{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
@keyframes sway{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}
@keyframes speed{0%{transform:translateX(18px);opacity:0}30%{opacity:1}100%{transform:translateX(-18px);opacity:0}}
@keyframes drip{0%{transform:translateY(0);opacity:1}100%{transform:translateY(22px);opacity:0}}
@keyframes dot{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
`;

export interface StickerSpec {
  /** Extra <defs>. */
  defs: string;
  /** Artwork in 512 × 512 coordinates, above the shadow and inside the die-cut. */
  art: string;
  /** Artwork behind the cut (glows); optional. */
  back?: string;
  caption?: string;
  captionColor?: string;
  /** Wrap the art in a jitter (angry), not a bob. */
  motion?: 'bob' | 'shake' | 'none';
}

export function stickerSvg(spec: StickerSpec): string {
  const caption = spec.caption
    ? `<text x="256" y="476" text-anchor="middle" font-family="Avenir Next Rounded, Arial Rounded MT Bold, Nunito, Inter, system-ui, -apple-system, Segoe UI, sans-serif" font-weight="900" font-size="${spec.caption.length > 12 ? 44 : 56}" letter-spacing="0.5" fill="${spec.captionColor ?? INK}" stroke="#fff" stroke-width="16" stroke-linejoin="round" paint-order="stroke">${escapeXml(spec.caption)}</text>`
    : '';
  const motion = spec.motion ?? 'bob';
  const wrap = motion === 'none' ? spec.art : `<g class="${motion}">${spec.art}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<defs>
<filter id="cut" x="-15%" y="-15%" width="130%" height="135%" color-interpolation-filters="sRGB">
<feMorphology in="SourceAlpha" operator="dilate" radius="10" result="d"/>
<feFlood flood-color="#ffffff"/><feComposite in2="d" operator="in" result="edge"/>
<feGaussianBlur in="d" stdDeviation="7" result="b"/><feOffset in="b" dy="9" result="o"/>
<feFlood flood-color="#1c1835" flood-opacity=".24"/><feComposite in2="o" operator="in" result="shadow"/>
<feMerge><feMergeNode in="shadow"/><feMergeNode in="edge"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>
${spec.defs}
</defs>
<style>${CSS}</style>
${spec.back ?? ''}
<g filter="url(#cut)">${wrap}${caption}</g>
</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** A character placed in the sticker: centre (x, y) and scale. */
export function place(x: number, y: number, s: number, inner: string, r = 0, cls = ''): string {
  return g(x, y, s, r, inner, cls);
}
