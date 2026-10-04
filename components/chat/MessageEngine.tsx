'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  Pin, Trash2, Copy, Reply, Forward, Timer,
  CheckCheck, Check, ShieldCheck, Flame,
  FileText, Download, Image as ImageIcon, Video, Music, Paperclip,
  AlertTriangle, TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSystemFormatter } from '@/hooks/useSystemFormatter';
import { useSettingsStore } from '@/lib/store/useSettingsStore';
import { useWalletStore } from '@/lib/store/wallet-store';
import { useLedgerSettings } from '@/components/terminal/LedgerChatSettings';

import type { ChatSettings } from '@/components/chat/AdvancedSettingsModal';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Reaction { emoji: string; count: number; reacted: boolean }

export interface RenderableMessage {
  id: string;
  senderAddress: string;
  content: string;           // decrypted text or [VOICE] / [FILE:name]
  sentAt: number;            // unix ms
  isMine: boolean;
  isPinned: boolean;
  isDestructing: boolean;
  destructsAt?: number;      // unix ms
  readAt?: number;           // unix ms (undefined = not read)
  reactions: Reaction[];
  replyToId?: string;
  attestationScore?: number; // 0–100 ledger score
}

export interface MessageEngineProps {
  messages: RenderableMessage[];
  onReact:  (messageId: string, emoji: string) => void;
  onPin:    (messageId: string) => void;
  onDelete: (messageId: string) => void;
  onReply:  (messageId: string) => void;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  /** @deprecated Pass settings via useSettingsStore instead. Kept for backward compat. */
  settings?: ChatSettings;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '🔥', '👀', '🐋', '⚡'];

// ── Bubble style resolver ─────────────────────────────────────────────────────

function getBubbleStyles(
  isMine: boolean,
  bubbleStyle: string,
  accentColor: string,
  isDestructing: boolean,
): React.CSSProperties & { className: string } {
  const base = 'relative group px-4 py-3 rounded-2xl cursor-default select-text transition-all border';
  const opacity = isDestructing ? ' opacity-60' : '';

  switch (bubbleStyle) {
    // ── Glassmorphism ──
    case 'glass':
      return {
        className: `${base} backdrop-blur-xl${opacity}`,
        background: isMine
          ? `${accentColor}cc`
          : 'rgba(255,255,255,0.12)',
        border: isMine
          ? `1px solid ${accentColor}66`
          : '1px solid rgba(255,255,255,0.18)',
        color: '#fff',
        boxShadow: isMine
          ? `0 8px 32px ${accentColor}44, inset 0 1px 0 rgba(255,255,255,0.2)`
          : '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.15)',
      };

    // ── Brutalist ──
    case 'brutalist':
      return {
        className: `${base} rounded-none${opacity}`,
        background: isMine ? accentColor : '#f0f0f0',
        border: '2px solid #000',
        color: isMine ? '#fff' : '#000',
        boxShadow: '3px 3px 0px #000',
      };

    // ── Cyberpunk (Neon glow) ──
    case 'cyberpunk':
      return {
        className: `${base} backdrop-blur-sm${opacity}`,
        background: isMine ? 'rgba(0,0,0,0.9)' : 'rgba(5,0,20,0.85)',
        border: isMine ? `1px solid ${accentColor}` : '1px solid #0ff3',
        color: isMine ? accentColor : '#0ff',
        boxShadow: isMine
          ? `0 0 8px ${accentColor}88, 0 0 24px ${accentColor}22, inset 0 0 8px ${accentColor}11`
          : '0 0 8px #0ff8, 0 0 24px #0ff2, inset 0 0 8px #0ff1',
        borderRadius: '4px',
      };

    // ── Minimal ──
    case 'minimal':
      return {
        className: `${base}${opacity}`,
        background: 'transparent',
        border: isMine ? `1px solid ${accentColor}` : '1px solid rgba(0,0,0,0.15)',
        color: isMine ? accentColor : 'inherit',
        boxShadow: 'none',
      };

    // ── Default ──
    default:
      return {
        className: `${base} backdrop-blur-md${opacity}`,
        background: isMine ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.8)',
        border: isMine ? '1px solid rgba(0,0,0,0.2)' : '1px solid rgba(0,0,0,0.1)',
        color: isMine ? '#fff' : '#000',
        boxShadow: isMine
          ? '0 4px 24px rgba(0,0,0,0.12)'
          : '0 4px 24px rgba(0,0,0,0.04)',
        borderRadius: isMine ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
      };
  }
}

// ── Font family resolver ──────────────────────────────────────────────────────

const FONT_MAP: Record<string, string> = {
  'inter':       '"Inter", sans-serif',
  'space-mono':  '"Space Mono", monospace',
  'fira-code':   '"Fira Code", monospace',
  'satoshi':     '"Satoshi", sans-serif',
};

// ── Content enrichment: $TICKER and 0x scanner ───────────────────────────────

function EnrichedText({
  content,
  isMine,
  tickerWidgets,
  contractScanner,
  fontSize,
  fontFamily,
}: {
  content: string;
  isMine: boolean;
  tickerWidgets: boolean;
  contractScanner: boolean;
  fontSize: number;
  fontFamily: string;
}) {
  // Split on $TICKER and 0x... patterns simultaneously
  const parts = useMemo(() => {
    const result: Array<{ type: 'text' | 'ticker' | 'contract'; value: string }> = [];
    const regex = /(\$[A-Z]{1,10}|0x[a-fA-F0-9]{40}(?:[a-fA-F0-9]*)?)/g;
    let last = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      if (match.index > last) {
        result.push({ type: 'text', value: content.slice(last, match.index) });
      }
      if (match[0].startsWith('$') && tickerWidgets) {
        result.push({ type: 'ticker', value: match[0] });
      } else if (match[0].startsWith('0x') && contractScanner) {
        result.push({ type: 'contract', value: match[0] });
      } else {
        result.push({ type: 'text', value: match[0] });
      }
      last = regex.lastIndex;
    }
    if (last < content.length) {
      result.push({ type: 'text', value: content.slice(last) });
    }
    return result;
  }, [content, tickerWidgets, contractScanner]);

  return (
    <p className="leading-relaxed break-words whitespace-pre-wrap" style={{ fontSize, fontFamily }}>
      {parts.map((part, i) => {
        if (part.type === 'ticker') {
          return <TickerWidget key={i} ticker={part.value} isMine={isMine} />;
        }
        if (part.type === 'contract') {
          return <ContractBadge key={i} address={part.value} isMine={isMine} />;
        }
        return <span key={i}>{part.value}</span>;
      })}
    </p>
  );
}

function TickerWidget({ ticker, isMine }: { ticker: string; isMine: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md text-[11px] font-mono font-bold cursor-pointer transition-all hover:opacity-80 active:scale-95"
      style={{
        background: isMine ? 'rgba(255,255,255,0.15)' : 'rgba(99,102,241,0.12)',
        color: isMine ? '#fff' : '#6366f1',
        border: isMine ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(99,102,241,0.3)',
      }}
      title={`Click to view ${ticker} price`}
      onClick={(e) => {
        e.stopPropagation();
        const sym = ticker.slice(1).toLowerCase();
        window.open(`https://coinmarketcap.com/currencies/${sym}/`, '_blank', 'noopener');
      }}
    >
      <TrendingUp size={9} />
      {ticker}
    </span>
  );
}

function ContractBadge({ address, isMine }: { address: string; isMine: boolean }) {
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md text-[11px] font-mono font-bold cursor-pointer transition-all hover:opacity-80 active:scale-95"
      style={{
        background: isMine ? 'rgba(255,255,255,0.12)' : 'rgba(16,185,129,0.1)',
        color: isMine ? '#10b981' : '#059669',
        border: isMine ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(16,185,129,0.3)',
      }}
      title={`View ${address} on Etherscan`}
      onClick={(e) => {
        e.stopPropagation();
        window.open(`https://etherscan.io/address/${address}`, '_blank', 'noopener');
      }}
    >
      <ShieldCheck size={9} />
      {short}
    </span>
  );
}

// ── Watermark overlay ─────────────────────────────────────────────────────────

function WatermarkOverlay({ peerAddress }: { peerAddress: string }) {
  const label = `${peerAddress.slice(0, 10)}…${peerAddress.slice(-6)}`;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
      style={{ zIndex: 10 }}
    >
      {Array.from({ length: 8 }).map((_idx, i) => (
        <div
          key={i}
          className="absolute font-mono text-[8px] font-bold whitespace-nowrap"
          style={{
            color: 'rgba(0,0,0,0.06)',
            top: `${(i * 14) % 100}%`,
            left: `${(i * 23) % 80}%`,
            transform: 'rotate(-30deg)',
            letterSpacing: '0.05em',
          }}
        >
          {label}
        </div>
      ))}
    </div>
  );
}

// ── Main MessageEngine ────────────────────────────────────────────────────────

export default function MessageEngine({
  messages, onReact, onPin, onDelete, onReply, bottomRef, settings,
}: MessageEngineProps) {
  const [menuState, setMenuState] = useState<{ id: string; content: string; x: number; y: number } | null>(null);
  const { formatDate } = useSystemFormatter();

  const { address } = useWalletStore();
  const { settings: ledgerSettings } = useLedgerSettings(address || '');

  // Read settings directly from PXE store (source of truth)
  const chatBackground   = ledgerSettings?.chat_background || 'default';
  const chatBgCustomUrl  = ledgerSettings?.chat_background_custom_url || '';
  const bubbleStyle      = ledgerSettings?.bubble_style || 'default';
  const accentColor      = ledgerSettings?.accent_color || '#6366f1';
  const chatFont         = ledgerSettings?.chat_font || 'inter';
  const textSize         = ledgerSettings?.text_size || 2;
  const watermarkEnabled = ledgerSettings?.watermark_enabled || false;
  const stealthMode      = ledgerSettings?.privacy_last_seen === 'nobody';
  const showReadReceipts = ledgerSettings?.privacy_read_receipts || true;
  const burnOnRead       = ledgerSettings?.burn_on_read || false;
  const burnSeconds      = 10; // Fixed for now unless we want to map it
  const tickerWidgets    = ledgerSettings?.ticker_widgets || false;
  const contractScanner  = ledgerSettings?.contract_scanner || false;
  const showAttestation  = ledgerSettings?.show_attestation_badge || true;

  const openMenu = useCallback((e: React.MouseEvent | React.TouchEvent, id: string, content: string) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuState({ id, content, x: rect.left, y: rect.top });
  }, []);

  const closeMenu = () => setMenuState(null);

  // Chat background style
  const bgStyle = useMemo((): React.CSSProperties => {
    switch (chatBackground) {
      case 'amoled':
        return { background: '#000000' };
      case 'holographic':
        return { background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e, #0d0d2b, #1a0533)' };
      case 'matrix':
        return { background: 'linear-gradient(180deg, #000 0%, #001400 100%)' };
      case 'gradient':
        return { background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 80%, #1a1a2e 100%)' };
      case 'custom':
        return chatBgCustomUrl
          ? { backgroundImage: `url(${chatBgCustomUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : {};
      default:
        return {};
    }
  }, [chatBackground, chatBgCustomUrl]);

  const fontSize    = textSize * 2 + 6; // 1→8px … 7→20px
  const fontFamily  = FONT_MAP[chatFont] ?? FONT_MAP['inter'];

  return (
    <div
      className="flex-1 overflow-y-auto overscroll-y-contain touch-pan-y px-6 py-4 space-y-1 relative"
      onClick={closeMenu}
      style={bgStyle}
    >
      {/* Matrix rain dots for matrix background */}
      {chatBackground === 'matrix' && <MatrixRain />}

      <AnimatePresence initial={false}>
        {(() => {
          let lastDate = '';
          return messages
            .filter(msg => msg.content !== '[XMTP_SYNC_LOG]')
            .map((msg) => {
              const dateStr = formatDate(msg.sentAt);
              const showDate = dateStr !== lastDate;
              lastDate = dateStr;
              const replyToMsg = msg.replyToId ? messages.find(m => m.id === msg.replyToId) : undefined;
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 15, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                >
                  {showDate && (
                    <div className="flex justify-center my-6">
                      <div className="bg-black/[0.03] border border-black/[0.06] px-4 py-1.5 rounded-full shadow-sm">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/50">{dateStr}</span>
                      </div>
                    </div>
                  )}
                  <MessageBubble
                    msg={msg}
                    replyToMsg={replyToMsg}
                    onContextMenu={(e) => openMenu(e, msg.id, msg.content)}
                    onReact={onReact}
                    // Quantum props
                    bubbleStyle={bubbleStyle}
                    accentColor={accentColor}
                    fontSize={fontSize}
                    fontFamily={fontFamily}
                    stealthMode={stealthMode}
                    watermarkEnabled={watermarkEnabled}
                    showReadReceipts={showReadReceipts}
                    burnOnRead={burnOnRead}
                    burnSeconds={burnSeconds}
                    tickerWidgets={tickerWidgets}
                    contractScanner={contractScanner}
                    showAttestation={showAttestation}
                  />
                </motion.div>
              );
            });
        })()}
      </AnimatePresence>
      <div ref={bottomRef} className="h-4" />

      {/* Floating Context Menu */}
      {menuState && (
        <ContextMenu
          messageId={menuState.id}
          content={menuState.content}
          x={menuState.x}
          y={menuState.y}
          onReact={(emoji) => { onReact(menuState.id, emoji); closeMenu(); }}
          onPin={() => { onPin(menuState.id); closeMenu(); }}
          onDelete={() => { onDelete(menuState.id); closeMenu(); }}
          onReply={() => { onReply(menuState.id); closeMenu(); }}
          onClose={closeMenu}
        />
      )}
    </div>
  );
}

// ── MessageBubble ─────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  msg: RenderableMessage;
  replyToMsg?: RenderableMessage;
  onContextMenu: (e: React.MouseEvent) => void;
  onReact: (id: string, emoji: string) => void;
  // Quantum UX props
  bubbleStyle: string;
  accentColor: string;
  fontSize: number;
  fontFamily: string;
  stealthMode: boolean;
  watermarkEnabled: boolean;
  showReadReceipts: boolean;
  burnOnRead: boolean;
  burnSeconds: number;
  tickerWidgets: boolean;
  contractScanner: boolean;
  showAttestation: boolean;
}

function MessageBubble({
  msg, replyToMsg, onContextMenu, onReact,
  bubbleStyle, accentColor, fontSize, fontFamily,
  stealthMode, watermarkEnabled, showReadReceipts,
  burnOnRead, burnSeconds, tickerWidgets, contractScanner, showAttestation,
}: MessageBubbleProps) {
  const { formatTime } = useSystemFormatter();
  const now = Date.now();

  // ── Burn-on-Read countdown ─────────────────────────────────────────────────
  const [burnCountdown, setBurnCountdown] = useState<number | null>(null);
  const burnStartedRef = useRef(false);

  useEffect(() => {
    // When the message is "mine" = sent, and burn-on-read is on for received messages.
    // Trigger: message has a readAt timestamp AND burnOnRead is enabled.
    if (!burnOnRead || !msg.readAt || msg.isMine) return;
    if (burnStartedRef.current) return;
    burnStartedRef.current = true;

    const expiresAt = msg.readAt + burnSeconds * 1000;
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      setBurnCountdown(remaining);
      if (remaining === 0) clearInterval(interval);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 500);
    return () => clearInterval(interval);
  }, [burnOnRead, burnSeconds, msg.readAt, msg.isMine]);

  // ── Destruct timer (explicit destructsAt field) ────────────────────────────
  const secondsLeft = msg.destructsAt
    ? Math.max(0, Math.round((msg.destructsAt - now) / 1000))
    : null;

  // ── Attachment/Location parsers ────────────────────────────────────────────
  const match = typeof msg.content === 'string'
    ? msg.content.match(/^\[ATTACHMENT:([^\]]*)\](.*?)\|(.*)$/is)
    : null;
  const attachment = match
    ? { mime: match[1] || 'application/octet-stream', url: match[2], name: match[3] }
    : null;

  const locMatch = typeof msg.content === 'string'
    ? msg.content.match(/^\[LOCATION\]([^|]*)(?:\|(\d+))?$/)
    : null;
  const isLocation  = !!locMatch;
  const durationMs  = locMatch?.[2] ? parseInt(locMatch[2], 10) : 0;
  const expiryTs    = durationMs > 0 ? msg.sentAt + durationMs : 0;

  // ── Bubble styles ──────────────────────────────────────────────────────────
  const { className: bubbleClassName, ...bubbleInlineStyle } = getBubbleStyles(
    msg.isMine,
    bubbleStyle,
    accentColor,
    msg.isDestructing || (burnCountdown !== null && burnCountdown === 0),
  );

  const textColor = bubbleInlineStyle.color as string | undefined;

  return (
    <div className={`flex flex-col max-w-[75%] ${msg.isMine ? 'self-end items-end ml-auto' : 'self-start items-start'}`}>

      {/* Pin indicator */}
      {msg.isPinned && (
        <div className="flex items-center gap-1 text-[9px] font-mono text-black/30 mb-1 px-1">
          <Pin size={9} /> Pinned
        </div>
      )}

      {/* Bubble */}
      <div
        onContextMenu={onContextMenu}
        data-bubble-mine={msg.isMine ? '' : undefined}
        data-bubble-peer={!msg.isMine ? '' : undefined}
        className={bubbleClassName}
        style={{ ...bubbleInlineStyle, position: 'relative' }}
      >
        {/* Watermark overlay */}
        {watermarkEnabled && !msg.isMine && (
          <WatermarkOverlay peerAddress={msg.senderAddress} />
        )}

        {/* Reply Quote preview */}
        {replyToMsg && (
          <div className={`mb-2 pl-2 border-l-2 text-[11px] font-mono leading-snug rounded p-1.5 flex flex-col gap-0.5 max-w-[280px] ${
            msg.isMine
              ? 'border-white/30 text-white/75 bg-white/10'
              : 'border-black/20 text-black/60 bg-black/[0.03]'
          }`}>
            <span className="font-bold text-[9px] uppercase tracking-wider opacity-60">
              {replyToMsg.isMine ? 'You' : 'Peer'}
            </span>
            <span className="truncate block">
              {replyToMsg.content.includes('[ATTACHMENT:') ? '📎 Attachment' : replyToMsg.content}
            </span>
          </div>
        )}

        {/* Attestation badge */}
        {showAttestation && msg.attestationScore && msg.attestationScore >= 95 && (
          <div className="flex items-center gap-1 text-[9px] font-mono mb-2" style={{ color: 'rgba(16,185,129,0.9)' }}>
            <ShieldCheck size={10} /> ZK-VERIFIED · {msg.attestationScore}
          </div>
        )}

        {/* Message content */}
        {attachment ? (
          <AttachmentRenderer attachment={attachment} isMine={msg.isMine} />
        ) : isLocation && locMatch ? (
          <LocationBubble coords={locMatch[1]} expiryTimestamp={expiryTs} isMine={msg.isMine} />
        ) : stealthMode ? (
          <p className="leading-relaxed break-words font-mono" style={{ fontSize, fontFamily, color: textColor }}>
            {'●'.repeat(Math.min(msg.content.length, 24))}
          </p>
        ) : (
          <EnrichedText
            content={msg.content}
            isMine={msg.isMine}
            tickerWidgets={tickerWidgets}
            contractScanner={contractScanner}
            fontSize={fontSize}
            fontFamily={fontFamily}
          />
        )}

        {/* Explicit destruct countdown */}
        {secondsLeft !== null && (
          <div className="flex items-center gap-1 mt-2 text-[9px] font-mono text-red-400">
            <Flame size={10} /> {secondsLeft}s
          </div>
        )}

        {/* Burn-on-read countdown (received messages) */}
        {burnCountdown !== null && burnCountdown > 0 && (
          <motion.div
            className="flex items-center gap-1 mt-2 text-[9px] font-mono"
            style={{ color: burnCountdown <= 3 ? '#f87171' : '#fb923c' }}
            animate={{ opacity: burnCountdown <= 3 ? [1, 0.4, 1] : 1 }}
            transition={{ repeat: burnCountdown <= 3 ? Infinity : 0, duration: 0.5 }}
          >
            <Flame size={10} /> BURNS IN {burnCountdown}s
          </motion.div>
        )}
      </div>

      {/* Reactions row */}
      {msg.reactions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1 px-1">
          {msg.reactions.map(r => (
            <button
              key={r.emoji}
              onClick={() => onReact(msg.id, r.emoji)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border transition-all ${
                r.reacted
                  ? 'bg-black/8 border-black/20 text-black'
                  : 'bg-black/[0.02] border-black/8 text-black/50 hover:border-black/20'
              }`}
            >
              {r.emoji} <span className="font-mono text-[10px]">{r.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Timestamp + read receipt */}
      <div data-chat-meta className="flex items-center gap-1.5 mt-1 px-1 text-[9px] font-mono text-black/30">
        {!stealthMode && formatTime(msg.sentAt)}
        {msg.isMine && showReadReceipts && (
          (msg.readAt || (now - msg.sentAt > 2500))
            ? <CheckCheck size={13} className="text-blue-500" />
            : <Check size={13} className="text-black/30" />
        )}
      </div>
    </div>
  );
}

// ── Matrix Rain (lightweight CSS-only) ───────────────────────────────────────

function MatrixRain() {
  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      aria-hidden="true"
      style={{ zIndex: 0 }}
    >
      {Array.from({ length: 18 }).map((_idx, i) => (
        <div
          key={i}
          className="absolute top-0 text-[10px] font-mono select-none"
          style={{
            left: `${(i * 5.5) % 100}%`,
            color: '#00ff4133',
            animation: `matrixDrop ${2 + (i % 4) * 0.7}s linear ${(i * 0.3) % 2}s infinite`,
            whiteSpace: 'nowrap',
            fontSize: 10,
          }}
        >
          {['0', '1', '₿', 'Ξ', '∞', '⊕'].join('\n')}
        </div>
      ))}
      <style>{`
        @keyframes matrixDrop {
          0%   { transform: translateY(-100%); opacity: 0.6; }
          100% { transform: translateY(120vh);  opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── AttachmentRenderer ────────────────────────────────────────────────────────

function AttachmentRenderer({ attachment, isMine }: { attachment: { mime: string; url: string; name: string }; isMine: boolean }) {
  const { mime, url, name } = attachment;
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const isImg = mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
  const isVid = mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'mkv'].includes(ext);
  const isAud = mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a'].includes(ext);

  if (isImg) {
    return (
      <div className="mt-1 relative group cursor-pointer overflow-hidden rounded-xl border border-white/10 shadow-sm">
        <a href={url} target="_blank" rel="noopener noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={name} className="max-w-[240px] md:max-w-[320px] max-h-[300px] object-cover transition-transform duration-300 group-hover:scale-105" />
        </a>
      </div>
    );
  }
  if (isVid) {
    return (
      <div className="mt-1 relative w-full max-w-[260px] md:max-w-[320px] overflow-hidden rounded-xl border border-white/10 shadow-sm bg-black">
        <video src={url} controls controlsList="nodownload" playsInline className="w-full max-h-[300px] object-contain" />
      </div>
    );
  }
  if (isAud) {
    return (
      <div className={`mt-1 flex items-center p-2 rounded-xl shadow-sm border ${isMine ? 'bg-white/10 border-white/20' : 'bg-black/5 border-black/10'}`}>
        <audio src={url} controls className="h-10 w-[200px] md:w-[260px]" />
      </div>
    );
  }
  return (
    <a
      href={url}
      download={name}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 p-3 mt-1 rounded-xl border transition-all hover:opacity-80 ${
        isMine ? 'bg-white/10 border-white/20' : 'bg-black/5 border-black/10'
      }`}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isMine ? 'bg-white/20' : 'bg-black/10'}`}>
        <FileText size={18} className={isMine ? 'text-white' : 'text-black'} />
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <p className="font-mono text-[12px] font-bold truncate" title={name}>{name}</p>
        <p className={`font-mono text-[9px] uppercase mt-0.5 ${isMine ? 'text-white/60' : 'text-black/50'}`}>
          {mime.split('/')[1]?.toUpperCase() || 'DOCUMENT'}
        </p>
      </div>
      <Download size={16} className={isMine ? 'text-white/70' : 'text-black/50'} />
    </a>
  );
}

// ── ContextMenu ───────────────────────────────────────────────────────────────

function ContextMenu({
  messageId, content, x, y, onReact, onPin, onDelete, onReply, onClose,
}: {
  messageId: string;
  content: string;
  x: number; y: number;
  onReact: (emoji: string) => void;
  onPin: () => void;
  onDelete: () => void;
  onReply: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed z-[300] bg-white border border-black/8 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] p-3 w-[260px] flex flex-col gap-1"
      style={{ top: Math.min(y, window.innerHeight - 280), left: Math.min(x, window.innerWidth - 280) }}
      onClick={e => e.stopPropagation()}
    >
      <div className="flex gap-1 flex-wrap pb-3 border-b border-black/6 mb-1">
        {QUICK_REACTIONS.map(e => (
          <button
            key={e}
            onClick={() => onReact(e)}
            className="w-9 h-9 rounded-xl text-[18px] hover:bg-black/5 flex items-center justify-center transition-colors"
          >
            {e}
          </button>
        ))}
      </div>

      {[
        { icon: Reply,   label: 'Reply',       action: onReply },
        { icon: Pin,     label: 'Pin Message', action: onPin   },
        { icon: Copy,    label: 'Copy Text',   action: () => {
          try {
            navigator.clipboard.writeText(content);
            toast.success('Message text copied to clipboard.');
          } catch {
            toast.error('Failed to copy message text.');
          }
          onClose();
        } },
        { icon: Forward, label: 'Forward',     action: () => {
          toast.info('Forwarding is disabled for secure end to end encrypted ZK messages.');
          onClose();
        } },
        { icon: Trash2,  label: 'Delete',      action: onDelete, danger: true },
      ].map(({ icon: Icon, label, action, danger }) => (
        <button
          key={label}
          onClick={action}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[12px] font-mono transition-all ${
            danger ? 'text-red-500 hover:bg-red-50' : 'text-black/60 hover:bg-black/[0.04] hover:text-black'
          }`}
        >
          <Icon size={15} />{label}
        </button>
      ))}
    </div>
  );
}

// ── LocationBubble ────────────────────────────────────────────────────────────

function LocationBubble({
  coords, expiryTimestamp, isMine,
}: { coords: string; expiryTimestamp: number; isMine: boolean }) {
  const [timeText, setTimeText] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (expiryTimestamp === 0) { setTimeText('Permanent Location'); setIsExpired(false); return; }

    const update = () => {
      const diff = expiryTimestamp - Date.now();
      if (diff <= 0) { setTimeText('Location Expired'); setIsExpired(true); return; }
      const s = Math.floor(diff / 1000);
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
      setTimeText(h > 0 ? `Expires in ${h}h ${m}m` : m > 0 ? `Expires in ${m}m ${sec}s` : `Expires in ${sec}s`);
      setIsExpired(false);
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [expiryTimestamp]);

  if (isExpired) {
    return (
      <div className={`mt-1 p-3 rounded-xl border ${isMine ? 'bg-white/5 border-white/10 opacity-50' : 'bg-black/[0.02] border-black/5 opacity-50'}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-black/10 text-xl">📍</div>
          <div>
            <p className={`font-mono text-[12px] font-bold ${isMine ? 'text-white/60' : 'text-black/60'}`}>Location Expired</p>
            <p className={`font-mono text-[9px] uppercase mt-0.5 ${isMine ? 'text-white/40' : 'text-black/40'}`}>{timeText}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`mt-1 relative group cursor-pointer overflow-hidden rounded-xl shadow-sm border ${isMine ? 'border-white/10' : 'border-black/5'}`}>
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coords)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`block p-3 transition-colors ${isMine ? 'bg-white/10 hover:bg-white/20' : 'bg-black/5 hover:bg-black/10'}`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-xl ${isMine ? 'bg-white/20' : 'bg-black/10'}`}>📍</div>
          <div>
            <p className={`font-mono text-[12px] font-bold ${isMine ? 'text-white' : 'text-black'}`}>Exact Location</p>
            <p className={`font-mono text-[9px] uppercase mt-0.5 tracking-wider ${isMine ? 'text-white/60' : 'text-black/50'}`}>{timeText}</p>
          </div>
        </div>
      </a>
    </div>
  );
}
