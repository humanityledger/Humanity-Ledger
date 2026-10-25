'use client';
import React, { useId, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageCircle, Lock, Wallet, Sparkles, ImageOff } from 'lucide-react';

/*
 * Ledger stickers.
 *
 * Twenty four original vector stickers in four sets. Each one is a deep,
 * layered plate (gradient, glass sheen, soft inner edge) with a drawn glyph and
 * a short caption, and a quiet looping motion. Nothing here uses emoji or
 * third party artwork. Motion respects prefers-reduced-motion.
 *
 * Message format is unchanged: "[PREMIUM:<id>]". Codes from the retired animal
 * set still arrive from old conversations and render as a muted placeholder.
 */

export type StickerGroup = 'replies' | 'private' | 'money' | 'moments';

export type PremiumSticker = {
  id: string;
  code: string;
  label: string;
  group: StickerGroup;
  /** Dark and light ends of the plate gradient. */
  d: string;
  l: string;
  glyph: () => React.ReactNode;
};

const W = '#ffffff';
const FILL = 'rgba(255,255,255,0.16)';
const S = { stroke: W, strokeWidth: 4.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

const star4 = (cx: number, cy: number, r: number) =>
  `M${cx} ${cy - r} C${cx + r * 0.08} ${cy - r * 0.35} ${cx + r * 0.35} ${cy - r * 0.08} ${cx + r} ${cy} C${cx + r * 0.35} ${cy + r * 0.08} ${cx + r * 0.08} ${cy + r * 0.35} ${cx} ${cy + r} C${cx - r * 0.08} ${cy + r * 0.35} ${cx - r * 0.35} ${cy + r * 0.08} ${cx - r} ${cy} C${cx - r * 0.35} ${cy - r * 0.08} ${cx - r * 0.08} ${cy - r * 0.35} ${cx} ${cy - r}Z`;

const star5 = (cx: number, cy: number, ro: number, ri: number) => {
  const pts: string[] = [];
  for (let k = 0; k < 10; k++) {
    const a = (-90 + k * 36) * (Math.PI / 180);
    const r = k % 2 === 0 ? ro : ri;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join(' L')}Z`;
};

export const PREMIUM_STICKERS: PremiumSticker[] = [
  // Replies
  {
    id: 'agreed', code: '[PREMIUM:agreed]', label: 'Agreed', group: 'replies', d: '#0f5c46', l: '#1f8a68',
    glyph: () => (
      <g className="a-breathe">
        <circle cx="64" cy="54" r="29" {...S} fill={FILL} />
        <path className="a-draw" pathLength={1} d="M50 55 L60 65 L79 44" {...S} strokeWidth={6} />
      </g>
    ),
  },
  {
    id: 'thanks', code: '[PREMIUM:thanks]', label: 'Thank you', group: 'replies', d: '#2b2f7a', l: '#4a52c4',
    glyph: () => (
      <g className="a-float">
        <rect x="40" y="50" width="48" height="32" rx="6" {...S} fill={FILL} />
        <rect x="35" y="39" width="58" height="13" rx="5" {...S} fill={FILL} />
        <path d="M64 39 V82" {...S} />
        <path d="M64 39 C54 22 40 30 50 39Z" {...S} strokeWidth={4} />
        <path d="M64 39 C74 22 88 30 78 39Z" {...S} strokeWidth={4} />
      </g>
    ),
  },
  {
    id: 'noted', code: '[PREMIUM:noted]', label: 'Noted', group: 'replies', d: '#1d2638', l: '#3a4660',
    glyph: () => (
      <g className="a-breathe">
        <path d="M46 24 H72 L88 40 V80 H46Z" {...S} fill={FILL} />
        <path d="M72 24 V40 H88" {...S} strokeWidth={3.5} />
        <path className="a-draw" pathLength={1} d="M54 54 H80" {...S} strokeWidth={3.5} />
        <path className="a-draw d2" pathLength={1} d="M54 64 H80" {...S} strokeWidth={3.5} />
        <path className="a-draw d3" pathLength={1} d="M54 74 H68" {...S} strokeWidth={3.5} />
      </g>
    ),
  },
  {
    id: 'on-it', code: '[PREMIUM:on-it]', label: 'On it', group: 'replies', d: '#0b4f5c', l: '#1b8398',
    glyph: () => (
      <g>
        <circle cx="64" cy="55" r="28" {...S} fill={FILL} />
        <path d="M57 21 H71" {...S} strokeWidth={4} />
        <path d="M64 27 V31" {...S} strokeWidth={3.5} />
        <g className="a-spin" style={{ transformOrigin: '64px 55px' }}>
          <path d="M64 55 V37" {...S} strokeWidth={4} />
        </g>
        <path d="M64 55 L75 61" {...S} strokeWidth={4} />
        <circle cx="64" cy="55" r="3" fill={W} />
      </g>
    ),
  },
  {
    id: 'apologies', code: '[PREMIUM:apologies]', label: 'Apologies', group: 'replies', d: '#3b4a1e', l: '#6b8236',
    glyph: () => (
      <g className="a-float">
        <path d="M36 80 C52 72 70 58 86 38" {...S} strokeWidth={4} />
        <ellipse cx="45" cy="64" rx="4.5" ry="10" transform="rotate(-8 45 64)" fill={FILL} stroke={W} strokeWidth="3" />
        <ellipse cx="57" cy="76" rx="10" ry="4.5" transform="rotate(8 57 76)" fill={FILL} stroke={W} strokeWidth="3" />
        <ellipse cx="62" cy="50" rx="4.5" ry="10" transform="rotate(-8 62 50)" fill={FILL} stroke={W} strokeWidth="3" />
        <ellipse cx="73" cy="64" rx="10" ry="4.5" transform="rotate(8 73 64)" fill={FILL} stroke={W} strokeWidth="3" />
        <ellipse cx="79" cy="36" rx="4.5" ry="10" transform="rotate(-8 79 36)" fill={FILL} stroke={W} strokeWidth="3" />
        <ellipse cx="90" cy="33" rx="10" ry="4.5" transform="rotate(-50 90 33)" fill={W} fillOpacity="0.85" stroke={W} strokeWidth="2" />
      </g>
    ),
  },
  {
    id: 'hello', code: '[PREMIUM:hello]', label: 'Hello', group: 'replies', d: '#1f3a5f', l: '#3b6ea5',
    glyph: () => (
      <g className="a-breathe">
        <path d="M40 28 H88 A8 8 0 0 1 96 36 V60 A8 8 0 0 1 88 68 H66 L52 80 V68 H40 A8 8 0 0 1 32 60 V36 A8 8 0 0 1 40 28Z" {...S} fill={FILL} />
        <circle className="a-dot" cx="50" cy="48" r="3.8" fill={W} />
        <circle className="a-dot d2" cx="64" cy="48" r="3.8" fill={W} />
        <circle className="a-dot d3" cx="78" cy="48" r="3.8" fill={W} />
      </g>
    ),
  },

  // Private
  {
    id: 'sealed', code: '[PREMIUM:sealed]', label: 'Sealed', group: 'private', d: '#10141f', l: '#2c3550',
    glyph: () => (
      <g className="a-float">
        <rect x="32" y="32" width="60" height="42" rx="7" {...S} fill={FILL} />
        <path d="M35 37 L62 58 L89 37" {...S} strokeWidth={4} />
        <circle cx="88" cy="72" r="15" fill="#10141f" stroke={W} strokeWidth="3.5" />
        <rect x="81" y="72" width="14" height="10" rx="2.5" fill={W} />
        <path d="M84 72 V69 A4 4 0 0 1 92 69 V72" stroke={W} strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
    ),
  },
  {
    id: 'verified', code: '[PREMIUM:verified]', label: 'Verified', group: 'private', d: '#0b4a3a', l: '#17896b',
    glyph: () => (
      <g className="a-breathe">
        <path d="M64 22 L91 32 V54 C91 71 79 80 64 87 C49 80 37 71 37 54 V32Z" {...S} fill={FILL} />
        <path className="a-draw" pathLength={1} d="M51 55 L61 65 L78 45" {...S} strokeWidth={6} />
      </g>
    ),
  },
  {
    id: 'keys', code: '[PREMIUM:keys]', label: 'Your keys', group: 'private', d: '#6a4a10', l: '#b98a2a',
    glyph: () => (
      <g className="a-float">
        <g transform="translate(0 -6) rotate(-24 64 54)">
          <circle cx="45" cy="54" r="15" {...S} fill={FILL} />
          <circle cx="45" cy="54" r="4.5" fill={W} />
          <path d="M60 54 H96" {...S} />
          <path d="M82 54 V66" {...S} />
          <path d="M92 54 V63" {...S} />
        </g>
      </g>
    ),
  },
  {
    id: 'proof', code: '[PREMIUM:proof]', label: 'Proof', group: 'private', d: '#3a2373', l: '#6d4fc9',
    glyph: () => (
      <g>
        <path className="a-ring" d="M64 24 L89 38 V68 L64 82 L39 68 V38Z" {...S} fill={FILL} />
        <path d="M64 40 L76 47 V61 L64 68 L52 61 V47Z" fill={W} fillOpacity="0.92" />
        <circle cx="64" cy="54" r="4" fill="#3a2373" />
      </g>
    ),
  },
  {
    id: 'vanishing', code: '[PREMIUM:vanishing]', label: 'Vanishing', group: 'private', d: '#2a3342', l: '#5d6b84',
    glyph: () => (
      <g>
        <path d="M46 24 H82 M46 84 H82" {...S} strokeWidth={4.5} />
        <path d="M50 24 V34 C50 46 64 50 64 54 C64 58 50 62 50 74 V84 M78 24 V34 C78 46 64 50 64 54 C64 58 78 62 78 74 V84" {...S} strokeWidth={4} />
        <path d="M55 33 H73 C71 40 66 45 64 47 C62 45 57 40 55 33Z" fill={W} fillOpacity="0.8" />
        <path className="a-dash" d="M64 51 V70" stroke={W} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="2 5" fill="none" />
        <path d="M55 83 C57 75 60 71 64 71 C68 71 71 75 73 83Z" fill={W} fillOpacity="0.8" />
      </g>
    ),
  },
  {
    id: 'anonymous', code: '[PREMIUM:anonymous]', label: 'Anonymous', group: 'private', d: '#1b1d22', l: '#454a55',
    glyph: () => (
      <g className="a-dashrun">
        <circle cx="64" cy="42" r="14" stroke={W} strokeWidth="4" strokeDasharray="5 6" strokeLinecap="round" fill={FILL} />
        <path d="M37 86 C37 68 49 61 64 61 C79 61 91 68 91 86" stroke={W} strokeWidth="4" strokeDasharray="5 6" strokeLinecap="round" fill={FILL} />
      </g>
    ),
  },

  // Money
  {
    id: 'sent', code: '[PREMIUM:sent]', label: 'Sent', group: 'money', d: '#15397a', l: '#2f6fd6',
    glyph: () => (
      <g>
        <path className="a-trail" d="M24 66 H40 M30 76 H46" stroke={W} strokeOpacity="0.55" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <g className="a-fly">
          <path d="M30 50 L98 24 L78 84 L58 64Z" {...S} fill={FILL} />
          <path d="M58 64 L98 24" {...S} strokeWidth={3.5} />
        </g>
      </g>
    ),
  },
  {
    id: 'received', code: '[PREMIUM:received]', label: 'Received', group: 'money', d: '#0e5a3a', l: '#25a06b',
    glyph: () => (
      <g>
        <path d="M36 62 V76 A4 4 0 0 0 40 80 H88 A4 4 0 0 0 92 76 V62" {...S} />
        <g className="a-drop">
          <path d="M64 24 V60" {...S} />
          <path d="M48 46 L64 62 L80 46" {...S} />
        </g>
      </g>
    ),
  },
  {
    id: 'settled', code: '[PREMIUM:settled]', label: 'Settled', group: 'money', d: '#5c4510', l: '#a8801f',
    glyph: () => (
      <g>
        <g className="a-breathe">
          {[70, 58, 46].map(y => (
            <g key={y}>
              <path d={`M38 ${y} v8 a26 9 0 0 0 52 0 v-8`} {...S} strokeWidth={3.5} fill={FILL} />
              <ellipse cx="64" cy={y} rx="26" ry="9" {...S} strokeWidth={3.5} fill={FILL} />
            </g>
          ))}
        </g>
        <circle cx="91" cy="30" r="12" fill="#5c4510" stroke={W} strokeWidth="3" />
        <path d="M85 30 L90 35 L98 25" stroke={W} strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    ),
  },
  {
    id: 'invoice', code: '[PREMIUM:invoice]', label: 'Invoice', group: 'money', d: '#173f4a', l: '#2f7f94',
    glyph: () => (
      <g className="a-float">
        <rect x="42" y="24" width="44" height="60" rx="6" {...S} fill={FILL} />
        <path d="M50 38 H78 M50 48 H78 M50 58 H64" {...S} strokeWidth={3.5} />
        <rect x="50" y="68" width="28" height="7" rx="3.5" fill={W} />
      </g>
    ),
  },
  {
    id: 'escrow', code: '[PREMIUM:escrow]', label: 'Escrow', group: 'money', d: '#5e1a35', l: '#a3375e',
    glyph: () => (
      <g>
        <circle cx="64" cy="54" r="29" {...S} fill={FILL} />
        <circle cx="64" cy="54" r="9" {...S} strokeWidth={4} />
        <g className="a-spin slow" style={{ transformOrigin: '64px 54px' }}>
          <path d="M64 45 V30 M64 63 V78 M56 49.5 L43 42 M72 58.5 L85 66 M56 58.5 L43 66 M72 49.5 L85 42" stroke={W} strokeWidth="3.5" strokeLinecap="round" fill="none" />
        </g>
      </g>
    ),
  },
  {
    id: 'split', code: '[PREMIUM:split]', label: 'Split', group: 'money', d: '#2a2f6e', l: '#5560c9',
    glyph: () => (
      <g>
        <path className="a-flow" d="M32 54 H52 C66 54 66 34 80 34 H92 M52 54 C66 54 66 74 80 74 H92" {...S} strokeWidth={4} />
        <path d="M86 28 L93 34 L86 40 M86 68 L93 74 L86 80" {...S} strokeWidth={4} />
        <circle cx="52" cy="54" r="6" fill={W} />
      </g>
    ),
  },

  // Moments
  {
    id: 'congrats', code: '[PREMIUM:congrats]', label: 'Congrats', group: 'moments', d: '#6b4a0c', l: '#c4932a',
    glyph: () => (
      <g>
        <path className="a-breathe" d={star5(64, 55, 29, 12.5)} {...S} strokeWidth={4} fill={FILL} />
        <g className="a-twinkle" stroke={W} strokeWidth="3.5" strokeLinecap="round">
          <path d="M30 28 L36 34 M98 28 L92 34 M24 56 H32 M96 56 H104" />
        </g>
      </g>
    ),
  },
  {
    id: 'cheers', code: '[PREMIUM:cheers]', label: 'Cheers', group: 'moments', d: '#561830', l: '#9c3a5c',
    glyph: () => (
      <g>
        <g className="a-clink-l" style={{ transformOrigin: '50px 74px' }}>
          <g transform="translate(50 54) rotate(-14)">
            <path d="M-13 -22 H13 L9 20 H-9Z" {...S} strokeWidth={4} fill={FILL} />
            <path d="M-11 -6 H11" stroke={W} strokeWidth="3" strokeLinecap="round" />
          </g>
        </g>
        <g className="a-clink-r" style={{ transformOrigin: '78px 74px' }}>
          <g transform="translate(78 54) rotate(14)">
            <path d="M-13 -22 H13 L9 20 H-9Z" {...S} strokeWidth={4} fill={FILL} />
            <path d="M-11 -6 H11" stroke={W} strokeWidth="3" strokeLinecap="round" />
          </g>
        </g>
        <path className="a-twinkle" d={star4(64, 26, 7)} fill={W} />
      </g>
    ),
  },
  {
    id: 'morning', code: '[PREMIUM:morning]', label: 'Good morning', group: 'moments', d: '#8a4a10', l: '#e28a2c',
    glyph: () => (
      <g>
        <path className="a-breathe" d="M44 72 A20 20 0 0 1 84 72Z" {...S} fill={FILL} />
        <path d="M30 72 H98 M42 82 H86" {...S} strokeWidth={4} />
        <g className="a-twinkle" stroke={W} strokeWidth="4" strokeLinecap="round">
          <path d="M64 30 V37 M38 40 L43 45 M90 40 L85 45 M28 58 H35 M93 58 H100" />
        </g>
      </g>
    ),
  },
  {
    id: 'night', code: '[PREMIUM:night]', label: 'Good night', group: 'moments', d: '#0f1740', l: '#3a4690',
    glyph: () => (
      <g>
        <path className="a-float" d="M74 28 A28 28 0 1 0 92 64 A23 23 0 0 1 74 28Z" {...S} fill={FILL} />
        <path className="a-twinkle" d={star4(92, 36, 6)} fill={W} />
        <path className="a-twinkle d2" d={star4(100, 52, 4)} fill={W} />
        <path className="a-twinkle d3" d={star4(40, 30, 4.5)} fill={W} />
      </g>
    ),
  },
  {
    id: 'well-done', code: '[PREMIUM:well-done]', label: 'Well done', group: 'moments', d: '#5a1f6b', l: '#a04cc0',
    glyph: () => (
      <g>
        <path className="a-breathe" d="M64 22 C66 40 72 46 91 54 C72 62 66 68 64 86 C62 68 56 62 37 54 C56 46 62 40 64 22Z" {...S} strokeWidth={4} fill={FILL} />
        <path className="a-twinkle" d={star4(94, 28, 8)} fill={W} />
        <path className="a-twinkle d2" d={star4(34, 80, 6)} fill={W} />
      </g>
    ),
  },
  {
    id: 'welcome', code: '[PREMIUM:welcome]', label: 'Welcome', group: 'moments', d: '#0b4f4a', l: '#1fa092',
    glyph: () => (
      <g>
        <path d="M42 84 V50 A22 22 0 0 1 86 50 V84Z" {...S} fill={FILL} />
        <path className="a-glow" d="M52 84 V52 A12 12 0 0 1 76 52 V84Z" fill={W} fillOpacity="0.88" />
        <path d="M34 84 H94" {...S} strokeWidth={4} />
      </g>
    ),
  },
];

const STICKER_BY_CODE = new Map(PREMIUM_STICKERS.map(s => [s.code, s]));

const STICKER_CSS = `
.stk { display:block; overflow:visible; filter: drop-shadow(0 10px 14px rgba(21,23,28,0.22)) drop-shadow(0 2px 3px rgba(21,23,28,0.14)); }
.stk .a-breathe, .stk .a-float, .stk .a-glow, .stk .a-ring, .stk .a-drop, .stk .a-fly, .stk .a-twinkle, .stk .a-dot { transform-box: fill-box; transform-origin: center; }
.stk .a-draw { stroke-dasharray: 1; stroke-dashoffset: 0; }
.stk .sheen { opacity: 0; }

.stk[data-live="true"] .a-breathe { animation: stk-breathe 3.2s ease-in-out infinite; }
.stk[data-live="true"] .a-float { animation: stk-float 3.6s ease-in-out infinite; }
.stk[data-live="true"] .a-spin { animation: stk-spin 6s linear infinite; }
.stk[data-live="true"] .a-spin.slow { animation-duration: 14s; }
.stk[data-live="true"] .a-draw { animation: stk-draw 3.4s ease-in-out infinite; }
.stk[data-live="true"] .a-draw.d2 { animation-delay: .25s; }
.stk[data-live="true"] .a-draw.d3 { animation-delay: .5s; }
.stk[data-live="true"] .a-dot { animation: stk-dot 1.6s ease-in-out infinite; }
.stk[data-live="true"] .a-dot.d2 { animation-delay: .18s; }
.stk[data-live="true"] .a-dot.d3 { animation-delay: .36s; }
.stk[data-live="true"] .a-ring { animation: stk-ring 2.6s ease-in-out infinite; }
.stk[data-live="true"] .a-dash { animation: stk-dash 1.4s linear infinite; }
.stk[data-live="true"] .a-dashrun circle, .stk[data-live="true"] .a-dashrun path { animation: stk-dash 5s linear infinite; }
.stk[data-live="true"] .a-flow { animation: stk-trail 2.4s ease-in-out infinite; }
.stk[data-live="true"] .a-fly { animation: stk-fly 3s ease-in-out infinite; }
.stk[data-live="true"] .a-trail { animation: stk-trail 3s ease-in-out infinite; }
.stk[data-live="true"] .a-drop { animation: stk-drop 2.4s ease-in-out infinite; }
.stk[data-live="true"] .a-twinkle { animation: stk-twinkle 2.8s ease-in-out infinite; }
.stk[data-live="true"] .a-twinkle.d2 { animation-delay: .6s; }
.stk[data-live="true"] .a-twinkle.d3 { animation-delay: 1.2s; }
.stk[data-live="true"] .a-glow { animation: stk-glow 3s ease-in-out infinite; }
.stk[data-live="true"] .a-clink-l { animation: stk-clink-l 2.6s ease-in-out infinite; }
.stk[data-live="true"] .a-clink-r { animation: stk-clink-r 2.6s ease-in-out infinite; }
.stk[data-live="true"] .sheen { animation: stk-sheen 5s ease-in-out infinite; }

@keyframes stk-breathe { 0%,100% { transform: scale(1) } 50% { transform: scale(1.045) } }
@keyframes stk-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
@keyframes stk-spin { to { transform: rotate(360deg) } }
@keyframes stk-draw { 0% { stroke-dashoffset: 1 } 35%,85% { stroke-dashoffset: 0 } 100% { stroke-dashoffset: 0 } }
@keyframes stk-dot { 0%,60%,100% { transform: translateY(0); opacity: .75 } 30% { transform: translateY(-4px); opacity: 1 } }
@keyframes stk-ring { 0%,100% { transform: scale(1); opacity: 1 } 50% { transform: scale(1.06); opacity: .8 } }
@keyframes stk-dash { to { stroke-dashoffset: -22 } }
@keyframes stk-fly { 0%,100% { transform: translate(0,0) } 50% { transform: translate(3px,-3px) } }
@keyframes stk-trail { 0%,100% { opacity: .3 } 50% { opacity: .9 } }
@keyframes stk-drop { 0%,100% { transform: translateY(-3px) } 50% { transform: translateY(3px) } }
@keyframes stk-twinkle { 0%,100% { opacity: .55; transform: scale(.9) } 50% { opacity: 1; transform: scale(1.1) } }
@keyframes stk-glow { 0%,100% { fill-opacity: .72 } 50% { fill-opacity: .95 } }
@keyframes stk-clink-l { 0%,100% { transform: rotate(-4deg) } 50% { transform: rotate(5deg) } }
@keyframes stk-clink-r { 0%,100% { transform: rotate(4deg) } 50% { transform: rotate(-5deg) } }
@keyframes stk-sheen { 0%,55% { transform: translateX(-130px); opacity: 0 } 65% { opacity: .5 } 90%,100% { transform: translateX(130px); opacity: 0 } }

@media (prefers-reduced-motion: reduce) {
  .stk[data-live="true"] *, .stk * { animation: none !important; }
}

.stk-scroll::-webkit-scrollbar { width: 6px; }
.stk-scroll::-webkit-scrollbar-thumb { background: rgba(21,23,28,0.14); border-radius: 10px; }
`;

function StickerArt({ sticker, size, live }: { sticker: PremiumSticker; size: number; live: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const grad = `g${uid}`;
  const clip = `c${uid}`;
  const gloss = `s${uid}`;
  return (
    <svg
      className="stk"
      data-live={live ? 'true' : 'false'}
      width={size}
      height={size}
      viewBox="0 0 128 128"
      role="img"
      aria-label={`${sticker.label} sticker`}
    >
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={sticker.l} />
          <stop offset="1" stopColor={sticker.d} />
        </linearGradient>
        <linearGradient id={gloss} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.26" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={clip}>
          <rect x="6" y="6" width="116" height="116" rx="34" />
        </clipPath>
      </defs>
      <rect x="6" y="6" width="116" height="116" rx="34" fill={`url(#${grad})`} />
      <g clipPath={`url(#${clip})`}>
        <rect x="6" y="6" width="116" height="58" fill={`url(#${gloss})`} />
        <rect className="sheen" x="-20" y="-10" width="26" height="150" fill="#fff" transform="rotate(20 64 64)" />
      </g>
      <rect x="6.75" y="6.75" width="114.5" height="114.5" rx="33.25" fill="none" stroke="#fff" strokeOpacity="0.22" strokeWidth="1.5" />
      {sticker.glyph()}
      <text x="64" y="107" textAnchor="middle" fontSize="12.5" fontWeight="600" fill="#fff" fillOpacity="0.95" style={{ letterSpacing: '0.01em', fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif' }}>
        {sticker.label}
      </text>
    </svg>
  );
}

/** A burst of small shapes that fly out once when a sticker arrives. */
function Burst({ color, size }: { color: string; size: number }) {
  const parts = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2 + (i % 2) * 0.2;
    const r = size * (0.62 + (i % 3) * 0.1);
    return { x: Math.cos(a) * r, y: Math.sin(a) * r, s: 4 + (i % 3) * 2, round: i % 2 === 0 };
  });
  return (
    <span className="absolute inset-0 pointer-events-none flex items-center justify-center" aria-hidden="true">
      {parts.map((p, i) => (
        <motion.span
          key={i}
          initial={{ x: 0, y: 0, opacity: 0.95, scale: 0.4 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 1, rotate: i * 40 }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.05 }}
          style={{ position: 'absolute', width: p.s, height: p.s, background: color, borderRadius: p.round ? '50%' : 2 }}
        />
      ))}
      <motion.span
        initial={{ scale: 0.6, opacity: 0.5 }}
        animate={{ scale: 1.7, opacity: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        style={{ position: 'absolute', width: size, height: size, borderRadius: '30%', border: `2px solid ${color}` }}
      />
    </span>
  );
}

/** A sticker inside a chat bubble. New ones pop in with a burst; old codes show a quiet placeholder. */
export function RenderPremiumSticker({ code, size = '96px', fresh = false }: { code: string; size?: string; fresh?: boolean }) {
  const sticker = STICKER_BY_CODE.get(code.trim());
  if (!sticker) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#f2f4f7] text-[13.5px] text-[#727a88]">
        <ImageOff size={15} strokeWidth={1.8} aria-hidden="true" />
        Retired sticker
      </div>
    );
  }
  const px = (parseInt(size, 10) || 96) + 24;
  return (
    <div className="relative inline-flex p-1">
      <style>{STICKER_CSS}</style>
      {fresh && <Burst color={sticker.l} size={px} />}
      <motion.div
        initial={fresh ? { scale: 0.2, rotate: -10, opacity: 0 } : false}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 14, mass: 0.8 }}
      >
        <StickerArt sticker={sticker} size={px} live />
      </motion.div>
    </div>
  );
}

function StickerTile({ sticker, onSend }: { sticker: PremiumSticker; onSend: (code: string) => void }) {
  const [live, setLive] = useState(false);
  return (
    <button
      type="button"
      onMouseEnter={() => setLive(true)}
      onMouseLeave={() => setLive(false)}
      onFocus={() => setLive(true)}
      onBlur={() => setLive(false)}
      onClick={() => onSend(sticker.code)}
      aria-label={`Send ${sticker.label} sticker`}
      className="flex items-center justify-center p-1.5 rounded-2xl hover:bg-[#f2f4f7] active:scale-95 transition-all duration-150 select-none"
    >
      <StickerArt sticker={sticker} size={84} live={live} />
    </button>
  );
}

const TABS: { id: StickerGroup; label: string; Icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }[] = [
  { id: 'replies', label: 'Replies', Icon: MessageCircle },
  { id: 'private', label: 'Private', Icon: Lock },
  { id: 'money', label: 'Money', Icon: Wallet },
  { id: 'moments', label: 'Moments', Icon: Sparkles },
];

export const StickerPicker = React.memo(({ onSend, onClose }: {
  onSend: (code: string) => void;
  onClose: () => void;
}) => {
  const [activeGroup, setActiveGroup] = useState<StickerGroup>('replies');
  const visible = PREMIUM_STICKERS.filter(s => s.group === activeGroup);

  return (
    <>
      <style>{STICKER_CSS}</style>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        className="absolute bottom-full mb-3 left-0 right-0 bg-white rounded-t-2xl shadow-[0_8px_32px_rgba(0,0,0,0.10)] overflow-hidden z-[400] flex flex-col"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="Stickers"
      >
        <div className="px-4 py-3 flex items-center justify-between border-b border-[#eceef2]">
          <span className="text-[15px] font-semibold text-[#15171c]">Stickers</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close stickers"
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#eff1f4] text-[#4a505c] hover:text-[#15171c] transition-colors"
          >
            <X size={16} strokeWidth={1.9} />
          </button>
        </div>

        <div className="flex px-2 border-b border-[#eceef2] bg-white" role="tablist">
          {TABS.map(({ id, label, Icon }) => {
            const active = activeGroup === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveGroup(id)}
                className={`relative flex-1 min-w-0 flex flex-col items-center gap-1 py-2.5 text-[12px] font-medium transition-colors ${
                  active ? 'text-[#15171c]' : 'text-[#727a88] hover:text-[#15171c]'
                }`}
              >
                <Icon size={17} strokeWidth={active ? 2.1 : 1.8} />
                {label}
                {active && (
                  <motion.span layoutId="sticker-tab" className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-[#15171c]" />
                )}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-1 p-3 max-h-[300px] overflow-y-auto stk-scroll bg-white justify-items-center">
          <AnimatePresence mode="wait">
            {visible.map((sticker, i) => (
              <motion.div
                key={sticker.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: i * 0.03, type: 'spring', stiffness: 420, damping: 28 }}
              >
                <StickerTile sticker={sticker} onSend={code => { onSend(code); onClose(); }} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
});
StickerPicker.displayName = 'StickerPicker';
