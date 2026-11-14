/**
 * scripts/stickers/build.ts — writes public/stickers/<pack>/<id>.svg for the drawn packs.
 *
 *   npx tsx scripts/stickers/build.ts
 *
 * The catalogue (ids, labels, scenes) is lib/chat/stickers.ts; this file says how each sticker is
 * drawn with the rig in scripts/stickers/art.ts. A sticker in the catalogue without a drawing here
 * fails the build, and test/unit/chat/stickers.test.ts fails if a file is missing.
 */

import fs from 'node:fs';
import path from 'node:path';
import { STICKER_PACKS } from '../../lib/chat/stickers';
import { character, lumi, nubi, place, prop, sol, spike, stickerSvg, type Arms, type Character, type Face, type StickerSpec } from './art';

type Draw = () => StickerSpec;

/** Characters fill the sticker: scales below are relative to a 1.3× base. */
const K = 1.3;
const one = (c: Character, fc: Face, pose: Arms, opts: { x?: number; y?: number; s?: number; r?: number; front?: string; cls?: string } = {}) =>
  place(opts.x ?? 256, opts.y ?? 226, (opts.s ?? 0.95) * K, character(c, fc, pose, opts.front ?? ''), opts.r ?? 0, opts.cls ?? '');

const NUBI = nubi();
const SOL = sol();

const DRAW: Record<string, Record<string, Draw>> = {
  'nubi-sol': {
    gm: () => ({
      defs: SOL.defs,
      art: one(SOL, { eyes: 'happy', mouth: 'grin', blush: true }, 'wave', { y: 214, s: 0.92 }) + prop.sparkle(84, 110, 1.1) + prop.sparkle(424, 330, 0.8, '#fff3b0') + prop.sparkle(430, 92, 0.7),
      caption: 'Good morning',
      captionColor: '#f08c00',
    }),
    'love-you': () => ({
      defs: NUBI.defs + SOL.defs,
      art:
        one(SOL, { eyes: 'happy', mouth: 'smile', blush: true }, 'none', { x: 340, y: 262, s: 0.6 }) +
        one(NUBI, { eyes: 'heart', mouth: 'grin', blush: true }, 'wave', { x: 182, y: 272, s: 0.62 }) +
        prop.heart(262, 108, 1.25, -6) + prop.heart(120, 126, 0.55, -20, '#ff8fab') + prop.heart(410, 120, 0.5, 18, '#ff8fab'),
      caption: 'Love you',
      captionColor: '#f03e6e',
    }),
    'miss-you': () => ({
      defs: NUBI.defs,
      art: one(NUBI, { eyes: 'open', brows: 'sad', mouth: 'tiny', blush: true }, 'hold', { y: 236, s: 0.9, front: prop.heart(0, 70, 0.9, 0, '#b197fc') }) + prop.heart(420, 110, 0.5, 16, '#d0bfff') + prop.heart(96, 150, 0.42, -18, '#d0bfff'),
      caption: 'Miss you',
      captionColor: '#7950f2',
    }),
    hug: () => ({
      defs: NUBI.defs + SOL.defs,
      art:
        one(SOL, { eyes: 'closed', mouth: 'smile', blush: true }, 'none', { x: 316, y: 214, s: 0.62 }) +
        one(NUBI, { eyes: 'closed', mouth: 'smile', blush: true }, 'hug', { x: 214, y: 268, s: 0.68 }) +
        prop.heart(110, 110, 0.6, -18) + prop.heart(420, 96, 0.5, 14, '#ff8fab'),
      caption: 'Hug',
      captionColor: '#f06595',
    }),
    kiss: () => ({
      defs: NUBI.defs,
      art: one(NUBI, { eyes: 'wink', mouth: 'kiss', blush: true }, 'wave', { y: 240, s: 0.9 }) + prop.heart(392, 150, 0.8, 18, '#ff3f6c') + prop.heart(440, 84, 0.5, 30, '#ff8fab'),
      caption: 'Mwah',
      captionColor: '#e8335e',
    }),
    'on-my-way': () => ({
      defs: SOL.defs,
      art: prop.speed(170, 170) + one(SOL, { eyes: 'open', brows: 'up', mouth: 'grin' }, 'point', { x: 292, y: 222, s: 0.84, r: 8 }),
      caption: 'On my way',
      captionColor: '#f08c00',
    }),
    coffee: () => ({
      defs: NUBI.defs,
      art: one(NUBI, { eyes: 'happy', mouth: 'smile', blush: true }, 'hold', { y: 228, s: 0.9, front: prop.coffee(0, 74) }) + prop.sparkle(424, 104, 0.7, '#ffe8cc'),
      caption: 'Coffee?',
      captionColor: '#8b5a3c',
    }),
    sorry: () => ({
      defs: nubi(['#f4f7ff', '#d3dcf7', '#9fb0e0']).defs,
      art: one(nubi(['#f4f7ff', '#d3dcf7', '#9fb0e0']), { eyes: 'tears', brows: 'sad', mouth: 'wavy', blush: true }, 'cheeks', { y: 222, s: 0.92 }),
      caption: 'Sorry…',
      captionColor: '#4c6ef5',
    }),
    proud: () => ({
      defs: SOL.defs,
      art: prop.confetti(256, 300) + one(SOL, { eyes: 'star', mouth: 'laugh' }, 'up', { y: 236, s: 0.84 }) + prop.partyHat(300, 92, 18),
      caption: 'So proud',
      captionColor: '#f08c00',
    }),
    hmph: () => ({
      defs: SOL.defs,
      art: one(SOL, { eyes: 'angry', brows: 'angry', mouth: 'frown', blush: true }, 'hip', { y: 228, s: 0.9 }) + prop.steam(70, 120) + prop.steam(392, 104),
      caption: 'Hmph!',
      captionColor: '#e03131',
      motion: 'shake',
    }),
    together: () => ({
      defs: NUBI.defs + SOL.defs,
      art:
        one(NUBI, { eyes: 'happy', mouth: 'smile', blush: true }, 'none', { x: 176, y: 262, s: 0.6 }) +
        one(SOL, { eyes: 'happy', mouth: 'smile', blush: true }, 'none', { x: 350, y: 254, s: 0.6 }) +
        prop.heart(262, 128, 0.9) + prop.sparkle(112, 120, 0.8) + prop.sparkle(420, 120, 0.7, '#b197fc'),
      caption: 'Together',
      captionColor: '#7048e8',
    }),
    gn: () => ({
      defs: NUBI.defs,
      art: one(NUBI, { eyes: 'closed', mouth: 'tiny', blush: true }, 'none', { y: 262, s: 0.86 }) + prop.moon(112, 106) + prop.zzz(330, 150) + prop.star(436, 220, 0.55, '#ffe28a'),
      caption: 'Good night',
      captionColor: '#5c5fef',
    }),
    'come-here': () => ({
      defs: NUBI.defs,
      art: one(NUBI, { eyes: 'happy', mouth: 'grin', blush: true }, 'up', { y: 246, s: 0.84 }) + prop.heart(96, 120, 0.7, -16) + prop.heart(420, 112, 0.62, 16, '#ff8fab') + prop.heart(256, 74, 0.5, 0, '#ffc2d6'),
      caption: 'Come here',
      captionColor: '#f06595',
    }),
    'forehead-kiss': () => ({
      defs: NUBI.defs + SOL.defs,
      art:
        one(NUBI, { eyes: 'closed', mouth: 'smile', blush: true }, 'none', { x: 196, y: 290, s: 0.6 }) +
        one(SOL, { eyes: 'closed', mouth: 'kiss', blush: true }, 'none', { x: 330, y: 176, s: 0.56, r: -16 }) +
        prop.heart(250, 176, 0.5, -10) + prop.sparkle(96, 150, 0.6, '#ffd8e4'),
      caption: 'Forehead kiss',
      captionColor: '#e64980',
    }),
    'cheek-kiss': () => ({
      defs: NUBI.defs + SOL.defs,
      art:
        one(SOL, { eyes: 'closed', mouth: 'kiss', blush: true }, 'none', { x: 342, y: 236, s: 0.56, r: -12 }) +
        one(NUBI, { eyes: 'wink', mouth: 'grin', blush: true }, 'none', { x: 190, y: 262, s: 0.62 }) +
        prop.heart(286, 150, 0.62, 12) + prop.heart(420, 96, 0.4, 20, '#ff8fab'),
      caption: 'Smooch',
      captionColor: '#e8335e',
    }),
    cozy: () => ({
      defs: NUBI.defs + SOL.defs,
      art:
        one(SOL, { eyes: 'closed', mouth: 'smile', blush: true }, 'none', { x: 330, y: 230, s: 0.62 }) +
        one(NUBI, { eyes: 'closed', mouth: 'tiny', blush: true }, 'hug', { x: 208, y: 270, s: 0.62, r: 8 }) +
        prop.heart(256, 96, 0.6, 0, '#b197fc') + prop.heart(120, 120, 0.4, -18, '#d0bfff') + prop.heart(418, 110, 0.4, 18, '#d0bfff'),
      caption: 'Cozy',
      captionColor: '#7048e8',
    }),
    please: () => ({
      defs: NUBI.defs,
      art: one(NUBI, { eyes: 'wide', brows: 'sad', mouth: 'tiny', blush: true }, 'hold', { y: 236, s: 0.9, front: prop.heart(0, 66, 0.7, 0, '#ff8fab') }) + prop.sparkle(424, 110, 0.6, '#d0e7ff'),
      caption: 'Please?',
      captionColor: '#4c6ef5',
    }),
    'not-talking': () => ({
      defs: SOL.defs,
      art: one(SOL, { eyes: 'closed', brows: 'angry', mouth: 'frown', blush: true }, 'hug', { y: 230, s: 0.9 }) + prop.steam(66, 116) + prop.steam(396, 100),
      caption: 'Not talking',
      captionColor: '#e03131',
      motion: 'shake',
    }),
  },

  lumi: (() => {
    const L = lumi();
    const variant = (c: [string, string, string]) => lumi(c);
    const BLUE = variant(['#e7f5ff', '#74b9ff', '#2f6fd6']);
    const PINK = variant(['#fff0f6', '#ff8cc0', '#d6336c']);
    const RED = variant(['#fff0f0', '#ff7070', '#c92a2a']);
    const SKY = variant(['#e6f6ff', '#7dd3fc', '#2b8ac6']);
    const ORANGE = variant(['#fff4e0', '#ffa94d', '#e8590c']);
    const GOLD = variant(['#fffbe0', '#ffd43b', '#f08c00']);
    const PURPLE = variant(['#f3e8ff', '#b197fc', '#7048e8']);
    return {
      lol: () => ({ defs: L.defs, art: one(L, { eyes: 'closed', mouth: 'laugh', blush: true }, 'up', { y: 220, s: 0.92, r: -8 }) + prop.drops(256, 200, '#5ee0b8'), caption: 'LOL', captionColor: '#0ca678' }),
      splash: () => ({ defs: L.defs, art: one(L, { eyes: 'wide', mouth: 'grin' }, 'up', { y: 220, s: 0.92 }) + prop.drops(256, 180, '#3fd6a5'), caption: 'Splash!', captionColor: '#0ca678' }),
      wow: () => ({ defs: L.defs, art: one(L, { eyes: 'wide', brows: 'up', mouth: 'o' }, 'none', { y: 222, s: 0.92 }) + prop.sparkle(96, 112, 1) + prop.sparkle(416, 96, 0.8) + prop.sparkle(430, 300, 0.6, '#9ff3d8'), caption: 'WOW', captionColor: '#f08c00' }),
      cry: () => ({ defs: BLUE.defs, art: one(BLUE, { eyes: 'tears', brows: 'sad', mouth: 'frown' }, 'cheeks', { y: 222, s: 0.92 }), caption: 'Crying', captionColor: '#1c7ed6' }),
      party: () => ({ defs: PINK.defs, art: prop.confetti(256, 300) + one(PINK, { eyes: 'happy', mouth: 'grin', blush: true }, 'up', { y: 236, s: 0.88 }) + prop.partyHat(268, 96, 12), caption: 'Party!', captionColor: '#d6336c' }),
      yes: () => ({ defs: L.defs, art: one(L, { eyes: 'happy', mouth: 'grin', blush: true }, 'up', { y: 222, s: 0.92 }) + prop.sparkle(90, 120, 0.9) + prop.sparkle(422, 120, 0.9, '#9ff3d8'), caption: 'Yes!', captionColor: '#0ca678' }),
      nope: () => ({ defs: RED.defs, art: one(RED, { eyes: 'angry', brows: 'angry', mouth: 'frown' }, 'hand', { y: 222, s: 0.92 }) + prop.steam(80, 110), caption: 'Nope', captionColor: '#c92a2a', motion: 'shake' }),
      hmm: () => ({ defs: SKY.defs, art: one(SKY, { eyes: 'open', brows: 'sassy', mouth: 'flat' }, 'none', { y: 226, s: 0.92 }) + prop.question(380, 140, 1, 12) + prop.question(420, 90, 0.6, 20), caption: 'Hmm…', captionColor: '#1971c2' }),
      shy: () => ({ defs: PINK.defs, art: one(PINK, { eyes: 'closed', mouth: 'tiny', blush: true }, 'cheeks', { y: 226, s: 0.92 }) + prop.heart(410, 110, 0.5, 18, '#ffc2d6'), caption: 'Shy', captionColor: '#d6336c' }),
      melt: () => ({ defs: ORANGE.defs, art: prop.puddle(256, 380, '#ffa94d') + place(256, 262, 0.92 * K, `<g transform="scale(1.08 .82)">${character(ORANGE, { eyes: 'sleepy', mouth: 'wavy', sweat: true }, 'none')}</g>`) + prop.sparkle(420, 110, 0.7, '#ffd8a8'), caption: 'Melting', captionColor: '#e8590c' }),
      starstruck: () => ({ defs: GOLD.defs, art: one(GOLD, { eyes: 'star', mouth: 'grin', blush: true }, 'up', { y: 226, s: 0.92 }) + prop.sparkle(84, 110, 1) + prop.sparkle(430, 96, 0.8, '#fff3bf') + prop.star(424, 300, 0.6), caption: 'Star-struck', captionColor: '#e67700' }),
      'mind-blown': () => ({ defs: PURPLE.defs, art: one(PURPLE, { eyes: 'wide', mouth: 'o' }, 'up', { y: 246, s: 0.86 }) + prop.explosion(256, 84) + prop.sparkle(90, 160, 0.7, '#d0bfff'), caption: 'Mind blown', captionColor: '#7048e8' }),
    } as Record<string, Draw>;
  })(),

  spike: (() => {
    const S = spike();
    const at = (fc: Face, pose: Arms, front = '', o: { y?: number; s?: number; r?: number } = {}) =>
      one(S, fc, pose, { y: o.y ?? 204, s: o.s ?? 0.76, r: o.r ?? 0, front });
    return {
      whatever: () => ({ defs: S.defs, art: at({ eyes: 'roll', mouth: 'flat' }, 'hip'), caption: 'Whatever', captionColor: '#2b8a3e' }),
      slay: () => ({ defs: S.defs, art: prop.flame(96, 250, 1) + prop.flame(420, 230, 0.8) + at({ eyes: 'shades', mouth: 'smirk' }, 'hip') + prop.sparkle(420, 90, 0.7, '#ffd8a8'), caption: 'Slay', captionColor: '#f03e3e' }),
      boss: () => ({ defs: S.defs, art: prop.bill(96, 160, -18) + prop.bill(420, 250, 14) + at({ eyes: 'shades', mouth: 'smirk' }, 'hip') + prop.coin(410, 116, 0.9), caption: 'Boss', captionColor: '#2b8a3e' }),
      bye: () => ({ defs: S.defs, art: prop.speed(170, 180) + at({ eyes: 'lidded', mouth: 'smirk', brows: 'sassy' }, 'wave', '', { r: 6 }), caption: 'Bye', captionColor: '#2b8a3e' }),
      'talk-to-hand': () => ({ defs: S.defs, art: at({ eyes: 'closed', brows: 'sassy', mouth: 'flat' }, 'none', '', { y: 204 }) + prop.hand(392, 220), caption: 'Talk to the hand', captionColor: '#e03131' }),
      'eye-roll': () => ({ defs: S.defs, art: at({ eyes: 'roll', brows: 'up', mouth: 'wavy' }, 'none'), caption: 'Eye roll', captionColor: '#2b8a3e' }),
      'mic-drop': () => ({ defs: S.defs, art: at({ eyes: 'shades', mouth: 'smirk' }, 'point', '', { y: 200 }) + prop.mic(410, 300, 150) + `<path d="M372 372 l-18 10 M412 378 v18 M448 372 l18 10" stroke="#ffd23f" stroke-width="7" stroke-linecap="round"/>`, caption: 'Mic drop', captionColor: '#e67700' }),
      rich: () => ({ defs: S.defs, art: at({ eyes: 'star', mouth: 'grin' }, 'up') + prop.coin(88, 130, 1) + prop.coin(424, 110, 0.8) + prop.bill(96, 300, -20) + prop.bill(420, 290, 16), caption: 'Rich', captionColor: '#2b8a3e' }),
      'on-fire': () => ({ defs: S.defs, art: prop.flame(90, 250, 1.1) + prop.flame(426, 250, 1.1) + at({ eyes: 'wide', brows: 'angry', mouth: 'grin' }, 'up') + prop.flame(256, 64, 0.6), caption: 'On fire', captionColor: '#f03e3e' }),
      sassy: () => ({ defs: S.defs, art: at({ eyes: 'lidded', brows: 'sassy', mouth: 'smirk', blush: true }, 'hip') + prop.sparkle(424, 110, 0.9, '#ff9ecb') + prop.sparkle(92, 170, 0.6, '#ffc2de'), caption: 'Sassy', captionColor: '#d6336c' }),
      deal: () => ({ defs: S.defs, art: prop.confetti(256, 300) + at({ eyes: 'happy', mouth: 'grin', blush: true }, 'point'), caption: 'Deal', captionColor: '#2b8a3e' }),
      queen: () => ({ defs: S.defs, art: at({ eyes: 'lidded', brows: 'sassy', mouth: 'smirk', blush: true }, 'hip', '', { y: 220, s: 0.72 }) + prop.crown(272, 64, 0.85, 8) + prop.sparkle(96, 120, 0.9, '#ffe066') + prop.sparkle(430, 170, 0.7, '#ffe066'), caption: 'Queen', captionColor: '#e09b14' }),
    } as Record<string, Draw>;
  })(),
};

function main() {
  const root = path.resolve(__dirname, '../..');
  let n = 0;
  for (const pack of STICKER_PACKS) {
    const draws = DRAW[pack.id];
    if (!draws) continue; // drawn by hand (the Ledger pack)
    const dir = path.join(root, 'public/stickers', pack.id);
    fs.mkdirSync(dir, { recursive: true });
    for (const s of pack.stickers) {
      const draw = draws[s.id];
      if (!draw) throw new Error(`No drawing for ${pack.id}/${s.id}`);
      fs.writeFileSync(path.join(dir, `${s.id}.svg`), stickerSvg(draw()).replace(/\n\s*/g, '\n'));
      n++;
    }
  }
  console.log(`Wrote ${n} stickers.`);
}

main();
