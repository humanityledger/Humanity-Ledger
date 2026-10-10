"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, useAnimation, PanInfo, AnimatePresence } from 'framer-motion';
import { FastForward, MapPin, Clock, PhoneOff, PhoneMissed, Video, Check, CheckCheck, Pencil, Lock, ExternalLink } from 'lucide-react';
import { CustomAudioPlayer } from './CustomAudioPlayer';
import { StickerPicker, PREMIUM_STICKERS, RenderPremiumSticker } from './StickerPicker';
import { useLinkPreview, extractFirstUrl, LinkPreviewCard } from './LedgerLinkPreview';

const BubbleLinkPreview = React.memo(({ url, isMe }: { url: string; isMe: boolean }) => {
  const { preview } = useLinkPreview(url);
  if (!preview) return null;
  return (
    <div className={`mt-2 ${isMe ? 'opacity-90' : 'opacity-100'}`}>
      <LinkPreviewCard preview={preview} compact={true} />
    </div>
  );
});
BubbleLinkPreview.displayName = 'BubbleLinkPreview';

export interface MessageProps {
  msg: any;
  isMe: boolean;
  showDate: boolean;
  dateStr: string;
  isSecretChat: boolean;
  fontFamily: string;
  fontSizePx: number;
  bubbleStyle?: string;
  clientInboxId: string | undefined;
  onReply: (msg: any) => void;
  onReact: (msgId: string, emoji: string) => void;
  onContextMenu: (e: any, id: string, content: string) => void;
  onOpenLightbox: (url: string) => void;
  formatMessagePreview: (c: string) => string;
  onThreadReply?: (msg: any) => void;
  onVotePoll?: (pollId: string, optionIndex: number) => void;
  onEditMsg?: (id: string, currentContent: string) => void;
  onJoinGroupCall?: (roomId: string, password: string) => void;
}

// iOS-safe spring â€” no conflicting scale, pure translate
const SPRING = { type: 'spring', stiffness: 420, damping: 36, mass: 0.9 } as const;
// Sticker list
// Re-export StickerPicker and stickers from dedicated file
export { StickerPicker, PREMIUM_STICKERS as STICKERS, RenderPremiumSticker } from './StickerPicker';

// â”€â”€â”€ Poll Bubble â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PollBubble = React.memo(({ content, msg, isMe, onVotePoll, clientInboxId }: {
  content: string; msg: any; isMe: boolean;
  onVotePoll?: (pollId: string, idx: number) => void;
  clientInboxId?: string;
}) => {
  // Format: __POLL__<pollId>__::<question>__::<opt1|opt2|...>
  const withoutPrefix = content.replace('__POLL__', '');
  const parts = withoutPrefix.split('__::');
  // [CRITICAL FIX] Poll ID is the deterministic ID in parts[0], NOT msg.id.
  // msg.id changes from optimisticâ†’real when XMTP confirms. parts[0] is stable.
  const pollId = parts[0] || msg.id;
  const question = parts[1] || 'Poll';
  const options = (parts[2] || '').split('|').filter(Boolean);
  const votes: Record<string, number> = msg.pollVotes || {};
  const totalVotes = Object.keys(votes).length;
  const myVote = clientInboxId ? (votes[clientInboxId] ?? -1) : -1;

  if (options.length === 0) return null;

  return (
    <div className={`rounded-[18px] overflow-hidden shadow-md min-w-[220px] max-w-[280px] border ${
      isMe ? 'bg-[#25D366] border-transparent' : 'bg-white border-black/8'
    }`}>
      <div className="px-4 pt-3 pb-3">
        <div className={`flex items-center gap-1.5 mb-2 ${isMe ? 'text-white/70' : 'text-black/40'}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-widest">Poll</span>
        </div>
        <p className={`text-[14px] font-semibold leading-tight mb-3 ${isMe ? 'text-white' : 'text-[#1c1c1e]'}`}>{question}</p>
        <div className="flex flex-col gap-2">
          {options.map((opt, i) => {
            const count = Object.values(votes).filter(v => v === i).length;
            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            const isSelected = myVote === i;
            return (
              <button
                key={i}
                onClick={() => onVotePoll?.(pollId, i)}
                className={`relative w-full text-left rounded-xl px-3 py-2 overflow-hidden transition-all duration-200 active:scale-[0.98] ${
                  isMe
                    ? isSelected ? 'bg-white/30' : 'bg-white/15 hover:bg-white/25'
                    : isSelected ? 'bg-[#25D366]/12 border border-[#25D366]/25' : 'bg-[#f2f2f7] hover:bg-[#e8e8ed]'
                }`}
              >
                {totalVotes > 0 && (
                  <div
                    className={`absolute inset-y-0 left-0 rounded-xl transition-all duration-700 ${isMe ? 'bg-white/15' : 'bg-[#25D366]/8'}`}
                    style={{ width: `${pct}%` }}
                  />
                )}
                <div className="relative flex items-center justify-between gap-2">
                  <span className={`text-[13px] font-medium ${isMe ? 'text-white' : 'text-[#1c1c1e]'}`}>{opt}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {isSelected && <Check size={10} className={isMe ? 'text-white' : 'text-[#25D366]'} />}
                    {totalVotes > 0 && <span className={`text-[11px] font-mono font-bold ${isMe ? 'text-white/70' : 'text-black/40'}`}>{pct}%</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <p className={`text-[10px] mt-2.5 font-mono ${isMe ? 'text-white/40' : 'text-black/30'}`}>{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</p>
      </div>
    </div>
  );
});
PollBubble.displayName = 'PollBubble';

// â”€â”€â”€ Payment Bubble â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PaymentBubble = React.memo(({ content, isMe }: { content: string; isMe: boolean }) => {
  const raw = content.replace('__PAYMENT__::', '');
  let amount = '?', recipient = '', token = 'QDs', txHash = '';
  try {
    const parsed = JSON.parse(raw);
    amount = parsed.amount ?? parsed; token = parsed.token || 'QDs'; txHash = parsed.txHash || '';
    recipient = parsed.to ? `${String(parsed.to).slice(0, 6)}...${String(parsed.to).slice(-4)}` : '';
  } catch { amount = raw; }
  return (
    <div className={`rounded-[18px] min-w-[180px] overflow-hidden shadow-md border ${isMe ? 'bg-[#30d158] border-transparent' : 'bg-white border-black/8'}`}>
      <div className="px-4 py-3 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center ${isMe ? 'bg-white/25' : 'bg-[#30d158]/15'}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isMe ? 'white' : '#30d158'} strokeWidth="2.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
          </div>
          <span className={`text-[11px] font-bold uppercase tracking-widest ${isMe ? 'text-white/80' : 'text-[#30d158]'}`}>Crypto Transfer</span>
        </div>
        <p className={`text-[22px] font-black tracking-tight ${isMe ? 'text-white' : 'text-[#1c1c1e]'}`}>{amount} <span className="text-[14px] font-semibold opacity-70">{token}</span></p>
        {recipient && <p className={`text-[11px] font-mono ${isMe ? 'text-white/60' : 'text-black/40'}`}>â†’ {recipient}</p>}
      </div>
    </div>
  );
});
PaymentBubble.displayName = 'PaymentBubble';

// ─── Location Bubble ─────────────────────────────────────────────────────────
const LocationBubble = React.memo(({ coords, isMe, isLive }: { coords: string; isMe: boolean; isLive: boolean }) => {
  const [lat, lon] = coords.split(',').map(Number);
  if (isNaN(lat) || isNaN(lon)) return null;

  // OpenStreetMap embed — no API key needed
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.01},${lat - 0.01},${lon + 0.01},${lat + 0.01}&layer=mapnik&marker=${lat},${lon}`;
  const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lon}`;

  return (
    <div className={`rounded-[18px] overflow-hidden shadow-md border min-w-[240px] max-w-[280px] ${isMe ? 'border-transparent' : 'border-black/8'}`}>
      {/* Map embed */}
      <div className="relative w-full h-[160px] bg-[#e8f4f8]">
        <iframe
          src={mapUrl}
          width="100%"
          height="160"
          style={{ border: 'none', display: 'block' }}
          title="Location"
          loading="lazy"
          sandbox="allow-scripts allow-same-origin"
        />
        {/* Live indicator overlay */}
        {isLive && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-white/95 backdrop-blur-sm px-2 py-1 rounded-full shadow-sm pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse block" />
            <span className="text-[10px] font-black uppercase tracking-wider text-red-500">Live</span>
          </div>
        )}
      </div>
      {/* Footer link */}
      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-2 px-3 py-2.5 ${isMe ? 'bg-[#25D366] text-white' : 'bg-white text-[#1c1c1e]'}`}
      >
        <MapPin size={14} className={isMe ? 'text-white/80' : 'text-red-500'} />
        <div className="flex flex-col flex-1">
          <span className="text-[12px] font-semibold">{isLive ? 'Live Location' : 'Shared Location'}</span>
          <span className="text-[10px] font-mono opacity-60">{lat.toFixed(4)}, {lon.toFixed(4)}</span>
        </div>
        <ExternalLink size={12} className="opacity-50" />
      </a>
    </div>
  );
});
LocationBubble.displayName = 'LocationBubble';

// â”€â”€â”€ Call Offer Bubble â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CallOfferBubble = React.memo(({ content, isMe }: { content: string; isMe: boolean }) => {
  const isVideo = content.includes(':video');
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-[18px] min-w-[160px] shadow border ${isMe ? 'bg-[#25D366] border-transparent' : 'bg-white border-black/8'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isMe ? 'bg-white/20' : 'bg-[#ff3b30]/10'}`}>
        <PhoneOff size={16} className={isMe ? 'text-white' : 'text-[#ff3b30]'} />
      </div>
      <div className="flex flex-col">
        <span className={`text-[13px] font-semibold ${isMe ? 'text-white' : 'text-[#1c1c1e]'}`}>{isVideo ? 'Video Call' : 'Voice Call'}</span>
        <span className={`text-[11px] ${isMe ? 'text-white/50' : 'text-black/30'}`}>Ended</span>
      </div>
    </div>
  );
});

const GroupCallBubble = React.memo(({ content, isMe, onJoinGroupCall }: { content: string; isMe: boolean; onJoinGroupCall?: (roomId: string, pwd: string) => void }) => {
  const parts = content.split('::');
  const roomId = parts[1] || '';
  const pwd = parts[2] || '';
  const isPrivate = pwd.length > 0;
  return (
    <div className={`flex flex-col gap-2 px-4 py-3 rounded-[18px] min-w-[220px] shadow border ${isMe ? 'bg-[#25D366] border-transparent' : 'bg-white border-black/8'}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isMe ? 'bg-white/20' : 'bg-[#25D366]/10'}`}>
          <Video size={20} className={isMe ? 'text-white' : 'text-[#25D366]'} />
        </div>
        <div className="flex flex-col">
          <span className={`text-[13px] font-semibold ${isMe ? 'text-white' : 'text-[#1c1c1e]'}`}>
            {isPrivate ? 'ðŸ”’ Private Group Call' : 'Group Call Started'}
          </span>
          <span className={`text-[11px] font-mono tracking-widest ${isMe ? 'text-white/80' : 'text-black/50'}`}>{roomId}</span>
        </div>
      </div>
      {/* Password display â€” shown to both creator and recipient so they can join */}
      {isPrivate && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${isMe ? 'bg-white/15' : 'bg-black/5'}`}>
          <span className="text-[10px]">ðŸ”‘</span>
          <div className="flex flex-col">
            <span className={`text-[9px] uppercase tracking-widest font-bold ${isMe ? 'text-white/50' : 'text-black/30'}`}>Password</span>
            <span className={`text-[13px] font-mono font-bold tracking-wider ${isMe ? 'text-white' : 'text-[#1c1c1e]'}`}>{pwd}</span>
          </div>
        </div>
      )}
      <button
        onClick={() => onJoinGroupCall ? onJoinGroupCall(roomId, pwd) : (window.location.href = `/chat?joinRoom=${roomId}&pwd=${encodeURIComponent(pwd)}`)}
        className={`mt-1 w-full flex items-center justify-center py-2 rounded-xl font-bold text-xs hover:bg-[#30b551] active:scale-95 transition-all ${isMe ? "bg-white text-[#25D366]" : "bg-[#25D366] text-white"}`}
      >
        {isMe ? 'Manage Call' : 'Join Call'}
      </button>
    </div>
  );
});


const MissedCallBubble = React.memo(({ content, isMe }: { content: string; isMe: boolean }) => {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-[18px] min-w-[160px] shadow border ${isMe ? 'bg-[#25D366] border-transparent' : 'bg-white border-black/8'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isMe ? 'bg-white/20' : 'bg-[#ff3b30]/10'}`}>
        <PhoneMissed size={16} className={isMe ? 'text-white' : 'text-[#ff3b30]'} />
      </div>
      <div className="flex flex-col">
        <span className={`text-[13px] font-semibold ${isMe ? 'text-white' : 'text-[#1c1c1e]'}`}>{isMe ? 'Canceled Call' : 'Missed Call'}</span>
        <span className={`text-[11px] ${isMe ? 'text-white/50' : 'text-[#ff3b30]/80'}`}>Tap to call back</span>
      </div>
    </div>
  );
});

CallOfferBubble.displayName = 'CallOfferBubble';

// â”€â”€â”€ Sticker Bubble â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// [FIX] No nested Framer Motion scale inside the parent motion.div.
// iOS Safari has a GPU compositing bug where nested scale transforms
// produce blur/jank. We use a plain div with CSS animation here.
const StickerBubble = React.memo(({ content }: { content: string }) => {
  const sticker = content.replace('__STICKER__', '');
  return (
    <div
      className="text-[64px] leading-none select-none cursor-default opacity-0 animate-[stickerPop_0.4s_cubic-bezier(0.34,1.56,0.64,1)_forwards]"
      style={{ filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.18))' }}
    >
      {sticker}
    </div>
  );
});
StickerBubble.displayName = 'StickerBubble';

// â”€â”€â”€ Context Menu â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const IMessageContextMenu = React.memo(({
  isMe, content, onClose, onReply, onThreadReply, onEdit, onCopy, onRevoke, msgId
}: {
  isMe: boolean; content: string; msgId: string;
  onClose: () => void; onReply: () => void; onThreadReply?: () => void; onEdit: () => void;
  onCopy: () => void; onRevoke: () => void;
}) => {
  const actions = [
    { label: 'Reply', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>, fn: onReply },
    ...(onThreadReply ? [{ label: 'Reply in Thread', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, fn: onThreadReply }] : []),
    ...(isMe ? [{ label: 'Edit', icon: <Pencil size={16} />, fn: onEdit }] : []),
    { label: 'Copy', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>, fn: onCopy },
    ...(isMe ? [{ label: 'Unsend', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>, fn: onRevoke }] : []),
  ];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.88, y: 6 }}
      transition={SPRING}
      className="absolute z-50 w-52 bg-[#1c1c1e]/95 backdrop-blur-2xl rounded-[16px] shadow-2xl overflow-hidden border border-white/10"
      style={{ bottom: '100%', ...(isMe ? { right: 0 } : { left: 0 }), marginBottom: 8 }}
      onClick={e => e.stopPropagation()}
    >
      {actions.map((a, i) => (
        <React.Fragment key={a.label}>
          <button
            onClick={() => { a.fn(); onClose(); }}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/10 transition-colors text-white"
          >
            <span className="text-[15px] font-normal">{a.label}</span>
            <span className="text-white/50">{a.icon}</span>
          </button>
          {i < actions.length - 1 && <div className="h-[0.5px] bg-white/10" />}
        </React.Fragment>
      ))}
    </motion.div>
  );
});
IMessageContextMenu.displayName = 'IMessageContextMenu';

const TAPBACKS = ['❤️', '👍', '👎', '😂', '‼️', '❓'];

// â”€â”€â”€ Tapback Picker â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TapbackPicker = React.memo(({ isMe, onReact, onClose }: {
  isMe: boolean; onReact: (e: string) => void; onClose: () => void;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 15, scale: 0.9 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 10, scale: 0.95 }}
    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    className="absolute z-50 flex items-center gap-2 px-3 py-2 bg-white/70 backdrop-blur-3xl rounded-[32px] shadow-[0_16px_40px_rgba(0,0,0,0.15)] border border-white/80"
    style={{ bottom: 'calc(100% + 12px)', ...(isMe ? { right: 0 } : { left: 0 }) }}
    onClick={e => e.stopPropagation()}
  >
    {TAPBACKS.map((t, i) => (
      <button
        key={t}
        onClick={() => { onReact(t); onClose(); }}
        className="w-11 h-11 flex items-center justify-center text-[26px] hover:scale-[1.35] hover:-translate-y-2 hover:bg-white/40 hover:shadow-sm rounded-full transition-all duration-300 active:scale-90 relative group"
      >
        <span className="relative z-10">{t}</span>
        <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity blur-[8px] z-0" />
      </button>
    ))}
  </motion.div>
));
TapbackPicker.displayName = 'TapbackPicker';

// â”€â”€â”€ Main MessageBubble â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const MessageBubble = React.memo(({
  msg, isMe, showDate, dateStr, isSecretChat, fontFamily, fontSizePx, bubbleStyle = 'default',
  clientInboxId, onReply, onReact, onContextMenu, onOpenLightbox,
  formatMessagePreview, onThreadReply, onVotePoll, onEditMsg, onJoinGroupCall,
}: MessageProps) => {
  const controls = useAnimation();
  const [showTapback, setShowTapback] = useState(false);
  const [showCtxMenu, setShowCtxMenu] = useState(false);

  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sentTime = typeof msg.sentAtNs === 'number' ? new Date(msg.sentAtNs) : (msg.sent || msg.sentAt || new Date());
  const isBurning = !!msg.burnAtNs;
  const secondsLeft = isBurning ? Math.max(0, Math.ceil((msg.burnAtNs - Date.now()) / 1000)) : null;

  // â”€â”€ Content parsing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let content = typeof msg.content === 'string' ? msg.content : (msg.fallback || 'Encrypted Data');

  let forwardFrom: string | null = null;
  if (content.startsWith('__FORWARD__')) {
    const p = content.split('__::');
    if (p.length >= 2) { forwardFrom = p[0].replace('__FORWARD__', ''); content = p.slice(1).join('__::'); }
  }

  let replyMsg: { id: string; content: string } | null = null;
  if (content.startsWith('__REPLY__')) {
    const p = content.split('__::');
    if (p.length >= 2) {
      const metadata = p[0].replace('__REPLY__', '');
      let replyToId = metadata;
      let replyText = 'Replied Message';
      if (metadata.includes('__SNIPPET__')) {
        const parts = metadata.split('__SNIPPET__');
        replyToId = parts[0];
        replyText = parts[1];
      }
      content = p.slice(1).join('__::');
      replyMsg = { id: replyToId, content: replyText };
    }
  }

  let isThread = false;
  let threadParentId: string | null = null;
  if (content.startsWith('__THREAD__')) {
    const p = content.split('__::');
    if (p.length >= 2) {
      threadParentId = p[0].replace('__THREAD__', '');
      content = p.slice(1).join('__::');
      isThread = true;
    }
  }

  const isCallOffer  = content.startsWith('__CALL_OFFER__:') || content === '__CALL_HANGUP__';
  const isGroupCall  = content.startsWith('__CALL_GROUP_CREATED__:');
  const isMissedCall = content.startsWith('__CALL_MISSED__:') || content === '__CALL_DECLINE__';
  const isPoll       = content.startsWith('__POLL__');
  const isPayment    = content.startsWith('__PAYMENT__');
  const isPremium    = content.startsWith('[PREMIUM:') || content.startsWith('__STICKER__[PREMIUM:');
  const isSticker    = content.startsWith('__STICKER__') && !isPremium;
  const isAudio      = content.startsWith('__AUDIO__');
  const isMedia      = content.startsWith('__MEDIA__:');
  const isGif        = content.startsWith('[GIF]');
  const isLocation   = content.startsWith('[LOCATION]') || content.startsWith('[LIVELOCATION]');
  const isSystemMsg  = content.startsWith('__PIN__') || content.startsWith('__REVOKE__') || content.startsWith('__READ__') || content.startsWith('__VOTE__') || content.startsWith('__EDIT__') || content.startsWith('__UNPIN__');
  const audioSrc     = isAudio ? content.slice('__AUDIO__'.length) : null;
  const gifUrl       = isGif ? content.slice('[GIF]'.length) : null;
  const locationCoords = isLocation
    ? (content.startsWith('[LIVELOCATION]') ? content.slice('[LIVELOCATION]'.length) : content.slice('[LOCATION]'.length))
    : null;
  
  let mediaObj = null;
  if (isMedia) {
    try { mediaObj = JSON.parse(content.slice('__MEDIA__:'.length)); } catch {}
  }
  
  const attachmentMatch = (!isAudio && !isGif && !isMedia) ? content.match(/^\[ATTACHMENT:([^\]]*)\](.*?)\|(.*)$/is) : null;
  const attachment   = attachmentMatch ? { mime: attachmentMatch[1] || 'application/octet-stream', url: attachmentMatch[2], name: attachmentMatch[3] } : null;

  if (isSystemMsg) return null;

  // â”€â”€ Gesture handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x < -50) {
      onReply(msg);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
    }
    controls.start({ x: 0, transition: { type: 'spring', stiffness: 400, damping: 30 } });
  };

  const handleLongPressStart = () => {
    pressTimer.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(12);
      setShowTapback(true);
    }, 480);
  };

  const handleLongPressEnd = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const handleDoubleTap = () => {
    onReact(msg.id, 'â¤ï¸');
    if (navigator.vibrate) navigator.vibrate([10, 10, 10]);
  };

  const handleCopy = () => { navigator.clipboard?.writeText(content).catch(() => {}); };
  const handleRevoke = () => { onContextMenu({ type: 'revoke' }, msg.id, content); };
  const handleEdit = () => { onEditMsg?.(msg.id, content); };

  const jumpToReply = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (replyMsg?.id) {
      const el = document.getElementById(`msg-${replyMsg.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-[#25D366]/30', 'transition-all', 'duration-300');
        setTimeout(() => el.classList.remove('ring-2', 'ring-[#25D366]/30', 'transition-all', 'duration-300'), 1500);
      }
    }
  };

  const [mediaUrl, setMediaUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!showTapback && !showCtxMenu) return;
    const handler = () => { setShowTapback(false); setShowCtxMenu(false); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showTapback, showCtxMenu]);

  useEffect(() => {
    if (mediaObj && !mediaUrl) {
      import('@/lib/chat/media').then(m => {
        m.EncryptedMediaEngine.fetchAndDecrypt(mediaObj.cid, mediaObj.k, mediaObj.iv, mediaObj.mime)
          .then(url => setMediaUrl(url))
          .catch(err => console.error('[MessageBubble] Decrypt error:', err));
      });
    }
  }, [mediaObj, mediaUrl]);

  const [isBurned, setIsBurned] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__ledger_burn_on_read && !isMe) {
      const seconds = (window as any).__ledger_burn_on_read_seconds || 10;
      const t = setTimeout(() => setIsBurned(true), seconds * 1000);
      return () => clearTimeout(t);
    }
  }, [isMe]);

  let bubbleStyle = 'default';
  if (typeof window !== 'undefined') bubbleStyle = (window as any).__ledger_bubble_style || 'default';
  let bubbleClasses = isMe ? 'msg-bubble-sent rounded-[20px] rounded-br-[5px]' : 'msg-bubble-recv rounded-[20px] rounded-bl-[5px]';
  if (bubbleStyle === 'brutalist') bubbleClasses = 'rounded-none border-2 border-black/80';
  else if (bubbleStyle === 'minimal') bubbleClasses = 'rounded-none border-l-4 border-[#007AFF] bg-transparent';
  else if (bubbleStyle === 'glass') bubbleClasses = 'backdrop-blur-md bg-white/40 border border-white/30 shadow-lg rounded-[20px]';

  return (
    <React.Fragment>
      {showDate && (
        <div className="flex justify-center my-4">
          <span className="px-3 py-1 bg-black/6 rounded-full text-[11px] font-semibold text-black/40 uppercase tracking-widest">{dateStr}</span>
        </div>
      )}

      <AnimatePresence>
        {(showTapback || showCtxMenu) && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            onClick={() => { setShowTapback(false); setShowCtxMenu(false); }}
          />
        )}
      </AnimatePresence>

      {/* 
        [iOS FIX] Removed scale from initial/animate.
        Nested scale transforms cause GPU compositing artifacts on iOS Safari:
        blurry text, choppy animations, and layout recalculation storms.
        Using translateY + opacity only is perfectly smooth on all platforms.
      */}
      <motion.div
        id={`msg-${msg.id}`}
        initial={{ opacity: 0, y: isMe ? 8 : -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING}
        className={`flex flex-col relative w-full ${isMe ? 'items-end' : 'items-start'}`}
        style={{ marginBottom: 2 }}
      >
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={{ left: 0.2, right: 0 }}
          onDragEnd={handleDragEnd}
          animate={controls}
          className={`flex flex-col relative ${isMe ? 'items-end' : 'items-start'} max-w-[80vw] md:max-w-[65%] min-w-0`}
          style={{ touchAction: 'pan-y', WebkitUserSelect: 'none' } as React.CSSProperties}
          onDoubleClick={handleDoubleTap}
          onTouchStart={handleLongPressStart}
          onTouchEnd={handleLongPressEnd}
          onMouseDown={handleLongPressStart}
          onMouseUp={handleLongPressEnd}
          onMouseLeave={handleLongPressEnd}
          onContextMenu={(e) => {
            e.preventDefault();
            setShowTapback(false);
            onContextMenu(e, msg.id, content);
          }}
        >
          {forwardFrom && (
            <div className="flex items-center gap-1.5 text-[10px] font-bold font-mono mb-1 text-black/40 px-2">
              <FastForward size={10} /> Forwarded from {forwardFrom.substring(0, 8)}...
            </div>
          )}
          {isThread && (
            <div className={`flex items-center gap-1.5 mb-1.5 opacity-70 px-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className="w-0.5 h-4 bg-[#25D366] rounded-full" />
              <span className="text-[11px] font-semibold text-[#25D366]">Thread reply</span>
            </div>
          )}

          <div className="relative">
            <AnimatePresence>
              {showTapback && (
                <TapbackPicker isMe={isMe} onReact={(e) => onReact(msg.id, e)} onClose={() => setShowTapback(false)} />
              )}
            </AnimatePresence>

            {/* â”€â”€â”€ Content Renderer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {isSticker ? (
              <StickerBubble content={content} />
            ) : isPoll ? (
              <PollBubble content={content} msg={msg} isMe={isMe} onVotePoll={onVotePoll} clientInboxId={clientInboxId} />
            ) : isPayment ? (
              <PaymentBubble content={content} isMe={isMe} />
            ) : isCallOffer ? (
              <CallOfferBubble content={content} isMe={isMe} />
            ) : isGroupCall ? (
              <GroupCallBubble content={content} isMe={isMe} onJoinGroupCall={onJoinGroupCall} />
            ) : isMissedCall ? (
              <MissedCallBubble content={content} isMe={isMe} />
            ) : isGif && gifUrl ? (
              <button
                onClick={() => onOpenLightbox(gifUrl)}
                className={`rounded-[18px] overflow-hidden shadow-lg border ${isMe ? 'border-transparent rounded-br-[4px]' : 'border-black/8 rounded-bl-[4px]'} active:scale-[0.97] transition-transform duration-100`}
              >
                <img src={gifUrl} alt="GIF" className="max-w-[220px] max-h-[200px] object-cover" loading="lazy" />
              </button>
            ) : isPremium ? (
              <RenderPremiumSticker code={content.replace('__STICKER__', '')} size="96px" />
            ) : isAudio && audioSrc ? (
              <div className={`px-3 py-2 rounded-[18px] shadow border ${isMe ? 'bg-[#25D366] border-transparent rounded-br-[4px]' : 'bg-white border-black/8 rounded-bl-[4px]'}`}>
                <CustomAudioPlayer src={audioSrc} isMe={isMe} />
              </div>
            ) : isLocation && locationCoords ? (
              <LocationBubble coords={locationCoords} isMe={isMe} isLive={content.startsWith('[LIVELOCATION]')} />
            ) : attachment ? (
              <div className={`rounded-[18px] overflow-hidden border shadow relative group ${isMe ? 'bg-[#25D366] border-transparent rounded-br-[4px]' : 'bg-white border-black/8 rounded-bl-[4px]'}`}>
                
                {/* Vault Save Button */}
                <button 
                  onClick={async (e) => {
                    e.stopPropagation(); e.preventDefault();
                    try {
                      const fileId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
                      const newFile = { id: fileId, name: attachment.name, type: attachment.mime, size: Math.round(attachment.url.length * 0.75), createdAt: Date.now(), encrypted: true };
                      const { vault } = await import('@/lib/core/SecureVault');
                      const stored = await vault.getItem('ledger_vault_files');
                      const files = stored ? JSON.parse(stored) : [];
                      files.push(newFile);
                      await vault.setItem('ledger_vault_files', JSON.stringify(files));
                      await vault.setItem(`ledger_vault_data_${fileId}`, attachment.url);
                      alert('Saved securely to Ledger Vault!');
                    } catch (err) { alert('Failed to save to vault.'); }
                  }}
                  className="absolute top-2 right-2 bg-black/60 backdrop-blur-md p-1.5 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  title="Save to Secure Vault"
                >
                  <Lock size={14} />
                </button>

                {attachment.mime.startsWith('video/') || ['mp4','mov','webm','ogg'].includes(attachment.name.split('.').pop()?.toLowerCase() || '') ? (
                  <video
                    src={attachment.url}
                    controls
                    playsInline
                    preload="metadata"
                    className="max-w-[240px] max-h-[200px] rounded-[14px]"
                    style={{ display: 'block' }}
                  />
                ) : attachment.mime.startsWith('image/') || ['jpg','jpeg','png','gif','webp'].includes(attachment.name.split('.').pop()?.toLowerCase() || '') ? (
                  <button onClick={() => onOpenLightbox(attachment.url)} className="block">
                    <img src={attachment.url} alt={attachment.name} className="max-w-[220px] max-h-[280px] object-cover" />
                  </button>
                ) : attachment.mime.startsWith('video/') ? (
                  <video src={attachment.url} controls className="max-w-[240px] max-h-[200px] bg-black" playsInline />
                ) : (
                  <div className={`flex items-center justify-between px-4 py-3 ${isMe ? 'text-white' : 'text-[#1c1c1e]'}`}>
                    <a href={attachment.url} download={attachment.name} className="flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <span className="text-[12px] font-mono underline break-all">{attachment.name}</span>
                    </a>
                  </div>
                )}
              </div>
            ) : (
              // â”€â”€ Standard Text Bubble â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
              msg.senderInboxId === '__bot__' ? (
                <div className="bg-[#F2F2F7] rounded-2xl p-3 border-l-4 border-[#25D366]">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[10px] font-bold text-[#25D366] uppercase tracking-wider">Ledger Bot</span>
                  </div>
                  <div className="text-[14px] text-[#1C1C1E] whitespace-pre-wrap">
                    {content.replace(/^🤖 /, '').split('\n').map((line, i) => (
                      <p key={i} className={line.startsWith('**') ? 'font-bold text-[#25D366]' : ''}>
                        {line.replace(/\*\*/g, '')}
                      </p>
                    ))}
                  </div>
                </div>
              ) : (
              <div className="relative">
                {replyMsg && (
                  <button
                    onClick={jumpToReply}
                    className={`flex items-start gap-1.5 mb-1 px-3 py-1.5 rounded-[12px] border max-w-[200px] text-left transition-opacity hover:opacity-70 ${
                      isMe ? 'bg-white/10 border-white/10' : 'bg-black/5 border-black/8'
                    }`}
                  >
                    <div className={`w-0.5 self-stretch rounded-full ${isMe ? 'bg-white/60' : 'bg-[#25D366]'}`} />
                    <div className="flex flex-col min-w-0">
                      <p className={`text-[10px] font-bold mb-0.5 ${isMe ? 'text-white/70' : 'text-[#25D366]'}`}>Replying to</p>
                      <p className={`text-[11px] truncate ${isMe ? 'text-white/60' : 'text-black/50'}`}>{formatMessagePreview(replyMsg.content)}</p>
                    </div>
                  </button>
                )}
                <div
                  className={`relative shadow-sm border ${
                    bubbleStyle === 'compact' ? 'px-3 py-1.5' :
                    bubbleStyle === 'wide' ? 'px-5 py-3 w-full' : 'px-4 py-2.5'
                  } ${
                    bubbleStyle === 'wide'
                      ? (isMe ? 'rounded-[16px] bg-[#25D366] border-[#25D366]' : 'rounded-[16px] bg-white border-black/5')
                      : bubbleStyle === 'brutalist'
                      ? (isMe ? 'rounded-none border-2 border-black/80 bg-[#25D366]' : 'rounded-none border-2 border-black/80 bg-white')
                      : bubbleStyle === 'minimal'
                      ? (isMe ? 'rounded-none border-l-4 border-[#007AFF] bg-transparent' : 'rounded-none border-l-4 border-black/30 bg-transparent')
                      : bubbleStyle === 'glass'
                      ? (isMe ? 'backdrop-blur-md bg-[#25D366]/40 border border-[#25D366]/30 shadow-lg' : 'backdrop-blur-md bg-white/40 border border-white/30 shadow-lg')
                      : (isMe ? 'msg-bubble-sent rounded-[20px] rounded-br-[5px] bg-[#25D366] border-[#25D366]' : 'msg-bubble-recv rounded-[20px] rounded-bl-[5px] bg-white border-black/5')
                  }`}
                >
                  <p
                    className={`whitespace-pre-wrap break-words leading-relaxed select-text ${
                      isMe ? 'text-white' : 'text-[#1c1c1e]'
                    }`}
                    style={{ fontSize: `${fontSizePx}px`, fontFamily, WebkitUserSelect: 'text', userSelect: 'text' } as React.CSSProperties}
                  >
                    {isBurned ? <span className="text-[11px] italic text-black/30">Message deleted</span> : content}
                    {msg.edited && !isBurned && (
                      <span className={`text-[9px] ml-1.5 italic ${isMe ? 'text-white/40' : 'text-black/30'}`}>edited</span>
                    )}
                  </p>
                  {(() => {
                    const firstUrl = extractFirstUrl(content);
                    if (!firstUrl) return null;
                    return <BubbleLinkPreview url={firstUrl} isMe={isMe} />;
                  })()}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {Object.entries(msg.reactions).map(([emoji, users]: [string, any]) => (
                        <button
                          key={emoji}
                          onClick={() => onReact(msg.id, emoji)}
                          className={`text-[13px] px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm border transition-all active:scale-95 ${
                            users.includes(clientInboxId || '')
                              ? 'bg-[#25D366] border-[#25D366] text-white'
                              : 'bg-white border-black/10 text-[#1c1c1e]'
                          }`}
                        >
                          <span>{emoji}</span>
                          {users.length > 1 && <span className="text-[10px] font-bold">{users.length}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              )
            )}
          </div>

          {/* â”€â”€â”€ Timestamp + Status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className={`flex items-center gap-1 mt-0.5 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
            {isBurning && <span className="text-[9px] font-mono font-bold text-[#ff3b30]">{secondsLeft}s</span>}
            <span className="text-[11px] text-black/30">
              {new Date(sentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {isMe && !msg.failed && (
              <span className={msg.status === 'read' && (window as any).__ledger_read_receipts !== false ? 'text-[#25D366]' : 'text-black/25'}>
                {msg.status === 'scheduled'
                  ? <Clock size={10} className="text-orange-400 inline" />
                  : (msg.status === 'read' || msg.status === 'delivered') && (window as any).__ledger_read_receipts !== false
                    ? <CheckCheck size={12} />
                    : <Check size={12} />}
              </span>
            )}
            {isMe && msg.failed && (
              <span className="text-[#ff3b30] flex items-center gap-1">
                 <span className="text-[10px] font-bold">Failed</span>
              </span>
            )}
          </div>
        </motion.div>
      </motion.div>
    </React.Fragment>
  );
});
MessageBubble.displayName = 'MessageBubble';


