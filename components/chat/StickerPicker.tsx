'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── THE APEX PREDATOR 4K STICKER COLLECTION ──────────────────────────────
// 30 Ultra-HD, 3D-styled animated stickers divided into 6 animal groups.
// Designed for maximum immersion with advanced CSS layer filtering and keyframes.

export type StickerGroup = 'leones' | 'lobos' | 'toros' | 'osos' | 'ballenas' | 'aguilas';

export type PremiumSticker = {
  id: string;
  code: string;
  label: string;
  base: string;     // Main animal emoji
  prop: string;     // Secondary emoji (prop/effect)
  group: StickerGroup;
  aura: string;     // CSS gradient/color for the glow effect
  animation: string; // Custom keyframe animation
};

export const PREMIUM_STICKERS: PremiumSticker[] = [
  // 🦁 LEONES (Lions)
  { id: 'lion-king',   code: '[PREMIUM:lion-king]',   label: 'Rey',      base: '🦁', prop: '👑', group: 'leones', aura: 'radial-gradient(circle, rgba(255,215,0,0.6) 0%, rgba(255,215,0,0) 70%)', animation: 'stk-float-slow' },
  { id: 'lion-fire',   code: '[PREMIUM:lion-fire]',   label: 'Fuego',    base: '🦁', prop: '🔥', group: 'leones', aura: 'radial-gradient(circle, rgba(255,69,0,0.6) 0%, rgba(255,69,0,0) 70%)',  animation: 'stk-pulse-glow' },
  { id: 'lion-wealth', code: '[PREMIUM:lion-wealth]', label: 'Riqueza',  base: '🦁', prop: '💎', group: 'leones', aura: 'radial-gradient(circle, rgba(0,255,255,0.6) 0%, rgba(0,255,255,0) 70%)', animation: 'stk-bounce-spin' },
  { id: 'lion-roar',   code: '[PREMIUM:lion-roar]',   label: 'Rugido',   base: '🦁', prop: '⚡', group: 'leones', aura: 'radial-gradient(circle, rgba(255,255,0,0.5) 0%, rgba(255,255,0,0) 70%)', animation: 'stk-shake-hard' },
  { id: 'lion-zen',    code: '[PREMIUM:lion-zen]',    label: 'Sabio',    base: '🦁', prop: '🧘', group: 'leones', aura: 'radial-gradient(circle, rgba(144,238,144,0.5) 0%, rgba(144,238,144,0) 70%)', animation: 'stk-levitate' },

  // 🐺 LOBOS (Wolves)
  { id: 'wolf-moon',   code: '[PREMIUM:wolf-moon]',   label: 'Luna',     base: '🐺', prop: '🌙', group: 'lobos',  aura: 'radial-gradient(circle, rgba(200,200,255,0.6) 0%, rgba(200,200,255,0) 70%)', animation: 'stk-float-slow' },
  { id: 'wolf-pack',   code: '[PREMIUM:wolf-pack]',   label: 'Manada',   base: '🐺', prop: '🤝', group: 'lobos',  aura: 'radial-gradient(circle, rgba(100,149,237,0.6) 0%, rgba(100,149,237,0) 70%)', animation: 'stk-pulse-glow' },
  { id: 'wolf-hunt',   code: '[PREMIUM:wolf-hunt]',   label: 'Caza',     base: '🐺', prop: '🎯', group: 'lobos',  aura: 'radial-gradient(circle, rgba(220,20,60,0.6) 0%, rgba(220,20,60,0) 70%)',   animation: 'stk-dash-forward' },
  { id: 'wolf-alpha',  code: '[PREMIUM:wolf-alpha]',  label: 'Alfa',     base: '🐺', prop: '🥇', group: 'lobos',  aura: 'radial-gradient(circle, rgba(255,215,0,0.6) 0%, rgba(255,215,0,0) 70%)',   animation: 'stk-bounce-up' },
  { id: 'wolf-ghost',  code: '[PREMIUM:wolf-ghost]',  label: 'Sigilo',   base: '🐺', prop: '🌫️', group: 'lobos',  aura: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 70%)', animation: 'stk-fade-in-out' },

  // 🐂 TOROS (Bulls)
  { id: 'bull-charge', code: '[PREMIUM:bull-charge]', label: 'Carga',    base: '🐂', prop: '💨', group: 'toros',  aura: 'radial-gradient(circle, rgba(255,140,0,0.6) 0%, rgba(255,140,0,0) 70%)',   animation: 'stk-charge-hit' },
  { id: 'bull-profit', code: '[PREMIUM:bull-profit]', label: 'Ganancia', base: '🐂', prop: '💰', group: 'toros',  aura: 'radial-gradient(circle, rgba(50,205,50,0.6) 0%, rgba(50,205,50,0) 70%)',   animation: 'stk-bounce-spin' },
  { id: 'bull-green',  code: '[PREMIUM:bull-green]',  label: 'Alcista',  base: '🐂', prop: '📈', group: 'toros',  aura: 'radial-gradient(circle, rgba(0,255,0,0.5) 0%, rgba(0,255,0,0) 70%)',     animation: 'stk-fly-up' },
  { id: 'bull-smash',  code: '[PREMIUM:bull-smash]',  label: 'Impacto',  base: '🐂', prop: '💥', group: 'toros',  aura: 'radial-gradient(circle, rgba(255,0,0,0.6) 0%, rgba(255,0,0,0) 70%)',     animation: 'stk-shake-hard' },
  { id: 'bull-armor',  code: '[PREMIUM:bull-armor]',  label: 'Blindado', base: '🐂', prop: '🛡️', group: 'toros',  aura: 'radial-gradient(circle, rgba(192,192,192,0.6) 0%, rgba(192,192,192,0) 70%)', animation: 'stk-pulse-heavy' },

  // 🐻 OSOS (Bears)
  { id: 'bear-market', code: '[PREMIUM:bear-market]', label: 'Bajista',  base: '🐻', prop: '📉', group: 'osos',   aura: 'radial-gradient(circle, rgba(139,0,0,0.6) 0%, rgba(139,0,0,0) 70%)',     animation: 'stk-smash-down' },
  { id: 'bear-sleep',  code: '[PREMIUM:bear-sleep]',  label: 'Hiberna',  base: '🐻', prop: '💤', group: 'osos',   aura: 'radial-gradient(circle, rgba(135,206,235,0.6) 0%, rgba(135,206,235,0) 70%)', animation: 'stk-float-slow' },
  { id: 'bear-angry',  code: '[PREMIUM:bear-angry]',  label: 'Feroz',    base: '🐻', prop: '💢', group: 'osos',   aura: 'radial-gradient(circle, rgba(255,69,0,0.6) 0%, rgba(255,69,0,0) 70%)',   animation: 'stk-shake-hard' },
  { id: 'bear-trap',   code: '[PREMIUM:bear-trap]',   label: 'Trampa',   base: '🐻', prop: '🕸️', group: 'osos',   aura: 'radial-gradient(circle, rgba(128,0,128,0.6) 0%, rgba(128,0,128,0) 70%)',   animation: 'stk-pulse-glow' },
  { id: 'bear-blood',  code: '[PREMIUM:bear-blood]',  label: 'Zarpazo',  base: '🐻', prop: '🩸', group: 'osos',   aura: 'radial-gradient(circle, rgba(255,0,0,0.7) 0%, rgba(255,0,0,0) 70%)',     animation: 'stk-slash' },

  // 🐋 BALLENAS (Whales)
  { id: 'whale-splash',code: '[PREMIUM:whale-splash]',label: 'Marea',    base: '🐋', prop: '🌊', group: 'ballenas',aura: 'radial-gradient(circle, rgba(0,191,255,0.6) 0%, rgba(0,191,255,0) 70%)',  animation: 'stk-wave-big' },
  { id: 'whale-deep',  code: '[PREMIUM:whale-deep]',  label: 'Abismo',   base: '🐋', prop: '🌌', group: 'ballenas',aura: 'radial-gradient(circle, rgba(0,0,139,0.7) 0%, rgba(0,0,139,0) 70%)',    animation: 'stk-float-slow' },
  { id: 'whale-bag',   code: '[PREMIUM:whale-bag]',   label: 'Volumen',  base: '🐋', prop: '💼', group: 'ballenas',aura: 'radial-gradient(circle, rgba(218,165,32,0.6) 0%, rgba(218,165,32,0) 70%)',  animation: 'stk-bounce-up' },
  { id: 'whale-move',  code: '[PREMIUM:whale-move]',  label: 'Impacto',  base: '🐋', prop: '📊', group: 'ballenas',aura: 'radial-gradient(circle, rgba(72,209,204,0.6) 0%, rgba(72,209,204,0) 70%)',  animation: 'stk-pulse-glow' },
  { id: 'whale-crown', code: '[PREMIUM:whale-crown]', label: 'Gigante',  base: '🐋', prop: '👑', group: 'ballenas',aura: 'radial-gradient(circle, rgba(255,215,0,0.6) 0%, rgba(255,215,0,0) 70%)',  animation: 'stk-levitate' },

  // 🦅 ÁGUILAS (Eagles)
  { id: 'eagle-vision',code: '[PREMIUM:eagle-vision]',label: 'Visión',   base: '🦅', prop: '👁️', group: 'aguilas', aura: 'radial-gradient(circle, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 70%)', animation: 'stk-pulse-heavy' },
  { id: 'eagle-strike',code: '[PREMIUM:eagle-strike]',label: 'Ataque',   base: '🦅', prop: '⚡', group: 'aguilas', aura: 'radial-gradient(circle, rgba(255,255,0,0.6) 0%, rgba(255,255,0,0) 70%)',   animation: 'stk-dive-bomb' },
  { id: 'eagle-fly',   code: '[PREMIUM:eagle-fly]',   label: 'Vuelo',    base: '🦅', prop: '☁️', group: 'aguilas', aura: 'radial-gradient(circle, rgba(135,206,235,0.6) 0%, rgba(135,206,235,0) 70%)', animation: 'stk-fly-across' },
  { id: 'eagle-target',code: '[PREMIUM:eagle-target]',label: 'Precisión',base: '🦅', prop: '🎯', group: 'aguilas', aura: 'radial-gradient(circle, rgba(255,0,0,0.5) 0%, rgba(255,0,0,0) 70%)',     animation: 'stk-focus' },
  { id: 'eagle-apex',  code: '[PREMIUM:eagle-apex]',  label: 'Cima',     base: '🦅', prop: '🥇', group: 'aguilas', aura: 'radial-gradient(circle, rgba(255,215,0,0.6) 0%, rgba(255,215,0,0) 70%)',  animation: 'stk-float-slow' },
];

// ─── 4K CSS RENDERING & ADVANCED KEYFRAMES ──────────────────────────────────
const STICKER_CSS = `
/* 4K 3D Base Styling */
.stk-4k-base {
  position: relative;
  display: inline-block;
  font-size: 80px;
  line-height: 1;
  filter: drop-shadow(0 20px 25px rgba(0,0,0,0.35)) drop-shadow(0 4px 6px rgba(0,0,0,0.2));
  transform-style: preserve-3d;
  will-change: transform;
}
.stk-4k-base::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 50%);
  border-radius: 50%;
  pointer-events: none;
  mix-blend-mode: overlay;
}
.stk-prop {
  position: absolute;
  font-size: 38px;
  bottom: -5px;
  right: -10px;
  filter: drop-shadow(0 8px 10px rgba(0,0,0,0.4));
  transform: translateZ(20px);
  z-index: 10;
  animation: prop-float 3s ease-in-out infinite;
}

/* Animations */
@keyframes prop-float { 0%,100%{transform:translateZ(20px) translateY(0)} 50%{transform:translateZ(20px) translateY(-5px)} }
@keyframes stk-float-slow  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
@keyframes stk-pulse-glow  { 0%,100%{transform:scale(1); filter:brightness(1)} 50%{transform:scale(1.08); filter:brightness(1.3)} }
@keyframes stk-bounce-spin { 0%,100%{transform:translateY(0) rotate(0)} 40%{transform:translateY(-15px) rotate(-10deg)} 70%{transform:translateY(-5px) rotate(10deg)} }
@keyframes stk-shake-hard  { 0%,100%{transform:rotate(0)} 15%{transform:rotate(-15deg) scale(1.1)} 30%{transform:rotate(15deg) scale(1.1)} 45%{transform:rotate(-15deg) scale(1.1)} 60%{transform:rotate(15deg) scale(1.1)} }
@keyframes stk-levitate    { 0%,100%{transform:translateY(0) rotateX(0)} 50%{transform:translateY(-15px) rotateX(15deg)} }
@keyframes stk-dash-forward{ 0%,100%{transform:translateX(0) scale(1)} 20%{transform:translateX(-10px) scale(0.9)} 60%{transform:translateX(20px) scale(1.1)} }
@keyframes stk-bounce-up   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-20px) scale(1.1)} }
@keyframes stk-fade-in-out { 0%,100%{opacity:1; filter:blur(0)} 50%{opacity:0.4; filter:blur(2px); transform:translateX(10px)} }
@keyframes stk-charge-hit  { 0%,100%{transform:translateX(0)} 30%{transform:translateX(-15px) rotate(-10deg)} 70%{transform:translateX(20px) rotate(10deg) scale(1.1)} }
@keyframes stk-fly-up      { 0%,100%{transform:translateY(0) rotate(0)} 50%{transform:translateY(-25px) rotate(-15deg) scale(1.1)} }
@keyframes stk-pulse-heavy { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15) translateY(-5px)} }
@keyframes stk-smash-down  { 0%,100%{transform:translateY(0)} 30%{transform:translateY(-15px)} 70%{transform:translateY(15px) scale(1.1)} }
@keyframes stk-slash       { 0%,100%{transform:rotate(0) scale(1)} 40%{transform:rotate(30deg) scale(1.2)} }
@keyframes stk-wave-big    { 0%,100%{transform:translateY(0) rotate(0)} 50%{transform:translateY(-15px) rotate(15deg)} }
@keyframes stk-dive-bomb   { 0%,100%{transform:translateY(0) scale(1)} 40%{transform:translateY(-20px) scale(0.9)} 80%{transform:translateY(15px) scale(1.2)} }
@keyframes stk-fly-across  { 0%,100%{transform:translateX(0)} 50%{transform:translateX(15px) translateY(-10px)} }
@keyframes stk-focus       { 0%,100%{transform:scale(1)} 50%{transform:scale(1.2)} }

.stk-float-slow  { animation: stk-float-slow  3s ease-in-out infinite; }
.stk-pulse-glow  { animation: stk-pulse-glow  2s ease-in-out infinite; }
.stk-bounce-spin { animation: stk-bounce-spin 2s ease-in-out infinite; }
.stk-shake-hard  { animation: stk-shake-hard  1s ease-in-out infinite; }
.stk-levitate    { animation: stk-levitate    4s ease-in-out infinite; }
.stk-dash-forward{ animation: stk-dash-forward 1.5s ease-in-out infinite; }
.stk-bounce-up   { animation: stk-bounce-up   1.5s ease-in-out infinite; }
.stk-fade-in-out { animation: stk-fade-in-out 3s ease-in-out infinite; }
.stk-charge-hit  { animation: stk-charge-hit  1.2s ease-in-out infinite; }
.stk-fly-up      { animation: stk-fly-up      1.8s ease-in-out infinite; }
.stk-pulse-heavy { animation: stk-pulse-heavy 1.5s ease-in-out infinite; }
.stk-smash-down  { animation: stk-smash-down  1.2s ease-in-out infinite; }
.stk-slash       { animation: stk-slash       1s ease-in-out infinite; }
.stk-wave-big    { animation: stk-wave-big    2.5s ease-in-out infinite; }
.stk-dive-bomb   { animation: stk-dive-bomb   1.5s ease-in-out infinite; }
.stk-fly-across  { animation: stk-fly-across  2.5s ease-in-out infinite; }
.stk-focus       { animation: stk-focus       1.8s ease-in-out infinite; }

/* Custom Scrollbar for Sticker Picker */
.premium-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.premium-scrollbar::-webkit-scrollbar-track {
  background: rgba(0,0,0,0.02);
}
.premium-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(0,0,0,0.15);
  border-radius: 10px;
}
`;

// ─── Rendered 4K Sticker Component (for use inside Chat Bubbles) ────────────
export function RenderPremiumSticker({ code, size = '80px' }: { code: string; size?: string }) {
  const sticker = PREMIUM_STICKERS.find(s => s.code === code);
  if (!sticker) return <span className="text-red-500">Sticker Not Found</span>;

  return (
    <div className="relative inline-flex items-center justify-center p-4">
      <style>{STICKER_CSS}</style>
      <div 
        className="absolute inset-0 rounded-full blur-2xl opacity-60 pointer-events-none" 
        style={{ background: sticker.aura }}
      />
      <div 
        className={`stk-4k-base ${sticker.animation}`}
        style={{ fontSize: size }}
      >
        {sticker.base}
        <span className="stk-prop" style={{ fontSize: `calc(${size} * 0.45)` }}>{sticker.prop}</span>
      </div>
    </div>
  );
}

// ─── Sticker Tile for the Picker ────────────────────────────────────────────
function StickerTile({ sticker, onSend }: { sticker: PremiumSticker; onSend: (code: string) => void }) {
  const [hover, setHover] = useState(false);

  return (
    <button
      type="button"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onSend(sticker.code)}
      title={sticker.label}
      className="relative flex flex-col items-center justify-center p-3 rounded-[20px] hover:bg-black/[0.04] active:scale-90 transition-all duration-200 group select-none overflow-hidden h-[120px]"
    >
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none blur-xl"
        style={{ background: sticker.aura }}
      />
      
      <div className={`relative z-10 transition-transform duration-300 ${hover ? sticker.animation : 'scale-90'}`}>
        <span className="stk-4k-base" style={{ fontSize: '56px' }}>
          {sticker.base}
          <span className="stk-prop" style={{ fontSize: '26px' }}>{sticker.prop}</span>
        </span>
      </div>

      <span className="absolute bottom-2 text-[10px] font-bold text-black/40 tracking-wide uppercase opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0">
        {sticker.label}
      </span>
    </button>
  );
}

// ─── Premium Sticker Picker UI ──────────────────────────────────────────────
const TABS: { id: StickerGroup; label: string; icon: string }[] = [
  { id: 'leones',   label: 'Leones',   icon: '🦁' },
  { id: 'lobos',    label: 'Lobos',    icon: '🐺' },
  { id: 'toros',    label: 'Toros',    icon: '🐂' },
  { id: 'osos',     label: 'Osos',     icon: '🐻' },
  { id: 'ballenas', label: 'Ballenas', icon: '🐋' },
  { id: 'aguilas',  label: 'Águilas',  icon: '🦅' },
];

export const StickerPicker = React.memo(({ onSend, onClose }: {
  onSend: (code: string) => void;
  onClose: () => void;
}) => {
  const [activeGroup, setActiveGroup] = useState<StickerGroup>('leones');
  const visible = PREMIUM_STICKERS.filter(s => s.group === activeGroup);

  return (
    <>
      <style>{STICKER_CSS}</style>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 350, damping: 28 }}
        className="absolute bottom-full mb-3 left-0 right-0 bg-[#F8F9FA]/95 backdrop-blur-3xl border border-white/40 rounded-[28px] shadow-[0_32px_80px_rgba(0,0,0,0.15)] overflow-hidden z-[400] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* PRO Banner */}
        <div className="bg-gradient-to-r from-[#111] to-[#333] px-5 py-3.5 flex items-center justify-between text-white shadow-md relative overflow-hidden">
          <div className="absolute right-[-30px] top-[-30px] w-32 h-32 bg-gradient-to-br from-[rgba(255,215,0,0.3)] to-transparent rounded-full blur-2xl pointer-events-none" />
          <div className="flex flex-col z-10">
            <span className="text-[15px] font-black tracking-tight flex items-center gap-2 text-[#FFD700]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              APEX PREDATOR PACK
            </span>
            <span className="text-[11px] text-white/70 font-semibold tracking-wide uppercase mt-0.5">4K Ultra-HD Immersive Stickers</span>
          </div>
          <button 
            onClick={onClose}
            className="z-10 w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Categories */}
        <div className="flex items-center gap-1 px-3 pt-3 border-b border-black/[0.04] bg-white">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveGroup(tab.id)}
              className={`flex-1 flex flex-col items-center gap-1.5 pb-3 transition-all relative ${
                activeGroup === tab.id ? 'opacity-100' : 'opacity-40 hover:opacity-70'
              }`}
            >
              <span className="text-[20px] drop-shadow-sm">{tab.icon}</span>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${activeGroup === tab.id ? 'text-black' : 'text-black'}`}>
                {tab.label}
              </span>
              {activeGroup === tab.id && (
                <motion.div
                  layoutId="active-sticker-tab"
                  className="absolute bottom-0 left-2 right-2 h-[3px] bg-gradient-to-r from-[#FFD700] to-[#FFA500] rounded-t-full"
                />
              )}
            </button>
          ))}
        </div>

        {/* Sticker Grid */}
        <div className="grid grid-cols-3 gap-2 p-4 max-h-[280px] overflow-y-auto premium-scrollbar bg-gradient-to-b from-white to-[#F8F9FA]">
          <AnimatePresence mode="wait">
            {visible.map((sticker, i) => (
              <motion.div
                key={sticker.id}
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: -10 }}
                transition={{ delay: i * 0.04, type: 'spring', stiffness: 400, damping: 25 }}
              >
                <StickerTile sticker={sticker} onSend={(code) => { onSend(code); onClose(); }} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
});
StickerPicker.displayName = 'StickerPicker';
