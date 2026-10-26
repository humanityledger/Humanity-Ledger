"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, useAnimation, PanInfo, AnimatePresence } from 'framer-motion';
import {
  Forward, MapPin, Clock, Phone, PhoneMissed, Video, Check, CheckCheck, Lock, LockOpen, ExternalLink,
  Heart, Waves, FileText, BarChart3, Wallet, Bot, Download, MessagesSquare, Users, Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { parseZkPaymentPayload, parseEscrowPayload, ZkPaymentResult, ZkEscrowState } from '@/lib/zk/zkMoney';
import { parseTipPayload, ZkTip } from '@/lib/zk/zkCommunityPayments';
import { parseStreamPayload, calculateStreamProgress, ZkPaymentStream } from '@/lib/zk/zkStreaming';
import { parseInvoicePayload, ZkInvoice } from '@/lib/zk/zkInvoice';
import { ZkEscrowCard } from '@/components/zk/ZkEscrowCard';
import { CustomAudioPlayer } from './CustomAudioPlayer';
import { StickerPicker, PREMIUM_STICKERS, RenderPremiumSticker } from './StickerPicker';
import { useLinkPreview, extractFirstUrl, LinkPreviewCard } from './LedgerLinkPreview';

/*
 * One message in a conversation.
 *
 * Text you send sits in a dark bubble on the right, text you receive in a
 * white bubble on the left. Everything richer than text (polls, payments,
 * calls, places, files) is a white card on either side, so it reads the same
 * no matter who sent it. Colours follow app/ledger-tokens.css.
 */

const INK = '#15171c';

const CARD = 'rounded-2xl bg-white border border-[#e6e8ec] shadow-[0_1px_2px_rgba(16,24,40,0.04)]';

const shortAddress = (value: unknown) => {
  const v = String(value || '');
  return v.length > 12 ? `${v.slice(0, 6)}…${v.slice(-4)}` : v;
};

/** A small row that names what kind of card this is: an icon and a few words. */
function CardLabel({ icon, children, aside }: { icon: React.ReactNode; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-[13px] text-[#727a88]">
        <span className="w-6 h-6 rounded-full bg-[#eff1f4] text-[#15171c] flex items-center justify-center" aria-hidden="true">{icon}</span>
        {children}
      </span>
      {aside}
    </div>
  );
}

/**
 * Private payments, tips and streams on Aztec only run in demo mode today
 * (lib/zk: executeShieldedPayment refuses unless NEXT_PUBLIC_ZK_MODE=demo,
 * and streams are kept in this browser). No funds move, so the card says so.
 */
function DemoNote() {
  return (
    <p className="mt-3 flex items-start gap-2 text-[13px] leading-snug text-[#7a5a12] bg-[#fdf6e3] border border-[#f3e3b5] rounded-xl px-3 py-2">
      <Info size={14} strokeWidth={2} className="mt-[1px] shrink-0" aria-hidden="true" />
      Demo only. No funds were moved.
    </p>
  );
}

const BubbleLinkPreview = React.memo(({ url }: { url: string; isMe: boolean }) => {
  const { preview } = useLinkPreview(url);
  if (!preview) return null;
  return (
    <div className="mt-2">
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

// A spring that only translates. Nested scale transforms blur text on iOS Safari.
const SPRING = { type: 'spring', stiffness: 420, damping: 36, mass: 0.9 } as const;

export { StickerPicker, PREMIUM_STICKERS as STICKERS, RenderPremiumSticker } from './StickerPicker';

// ─── Poll ──────────────────────────────────────────────────────────────────
const PollBubble = React.memo(({ content, msg, onVotePoll, clientInboxId }: {
  content: string; msg: any; isMe: boolean;
  onVotePoll?: (pollId: string, idx: number) => void;
  clientInboxId?: string;
}) => {
  // Format: __POLL__<pollId>__::<question>__::<opt1|opt2|...>
  // The poll id lives in the payload, not msg.id, because msg.id changes when
  // the network confirms an optimistic message.
  const parts = content.replace('__POLL__', '').split('__::');
  const pollId = parts[0] || msg.id;
  const question = parts[1] || 'Poll';
  const options = (parts[2] || '').split('|').filter(Boolean);
  const votes: Record<string, number> = msg.pollVotes || {};
  const totalVotes = Object.keys(votes).length;
  const myVote = clientInboxId ? (votes[clientInboxId] ?? -1) : -1;

  if (options.length === 0) return null;

  return (
    <div className={`${CARD} w-[280px] max-w-full p-4`}>
      <CardLabel icon={<BarChart3 size={13} strokeWidth={2} />}>Poll</CardLabel>
      <p className="text-[15.5px] font-semibold leading-snug text-[#15171c] mt-2.5 mb-3">{question}</p>
      <div className="flex flex-col gap-2" role="group" aria-label={question}>
        {options.map((opt, i) => {
          const count = Object.values(votes).filter(v => v === i).length;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const selected = myVote === i;
          return (
            <button
              type="button"
              key={i}
              onClick={() => onVotePoll?.(pollId, i)}
              aria-pressed={selected}
              className={`relative w-full text-left rounded-xl px-3 py-2.5 overflow-hidden transition-colors active:scale-[0.99] border ${
                selected ? 'border-[#15171c] bg-white' : 'border-[#e6e8ec] bg-white hover:border-[#c9ced6]'
              }`}
            >
              {totalVotes > 0 && (
                <span
                  aria-hidden="true"
                  className={`absolute inset-y-0 left-0 transition-[width] duration-700 ${selected ? 'bg-[#e9ebef]' : 'bg-[#f2f4f7]'}`}
                  style={{ width: `${pct}%` }}
                />
              )}
              <span className="relative flex items-center justify-between gap-2">
                <span className="text-[14.5px] text-[#15171c] flex items-center gap-2 min-w-0">
                  {selected && <Check size={14} strokeWidth={2.4} className="shrink-0" aria-hidden="true" />}
                  <span className="truncate">{opt}</span>
                </span>
                {totalVotes > 0 && <span className="text-[13px] tabular-nums text-[#727a88] shrink-0">{pct}%</span>}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[13px] text-[#727a88] mt-3 tabular-nums">
        {totalVotes === 0 ? 'No votes yet' : `${totalVotes} ${totalVotes === 1 ? 'vote' : 'votes'}`}
      </p>
    </div>
  );
});
PollBubble.displayName = 'PollBubble';

// ─── Payment sent from a wallet ──────────────────────────────────────────────
const PaymentBubble = React.memo(({ content, isMe }: { content: string; isMe: boolean }) => {
  const raw = content.replace('__PAYMENT__::', '').replace('__PAYMENT__', '');
  let amount = '', token = '', recipient = '';
  try {
    const parsed = JSON.parse(raw);
    amount = String(parsed.amount ?? '');
    token = String(parsed.token || '');
    recipient = parsed.to ? shortAddress(parsed.to) : '';
  } catch {
    amount = raw;
  }
  return (
    <div className={`${CARD} min-w-[220px] max-w-[300px] p-4`}>
      <CardLabel icon={<Wallet size={13} strokeWidth={2} />}>{isMe ? 'You sent a payment' : 'Payment received'}</CardLabel>
      <p className="text-[24px] font-semibold tracking-[-0.02em] tabular-nums text-[#15171c] mt-2.5">
        {amount || '0'} {token && <span className="text-[15px] font-medium text-[#727a88]">{token}</span>}
      </p>
      {recipient && <p className="text-[13px] text-[#727a88] mt-1 tabular-nums">To {recipient}</p>}
    </div>
  );
});
PaymentBubble.displayName = 'PaymentBubble';

// ─── Tip ───────────────────────────────────────────────────────────────────
const TipBubble = React.memo(({ content, isMe }: { content: string; isMe: boolean }) => {
  const raw = content.replace('__TIP__::', '');
  let amount = '', token = '', recipient = '', txHash = '';
  try {
    const parsed = JSON.parse(raw);
    amount = String(parsed.amount ?? '');
    token = String(parsed.token || '');
    txHash = String(parsed.txHash || '');
    recipient = parsed.to ? shortAddress(parsed.to) : '';
  } catch {
    amount = raw;
  }
  return (
    <div className={`${CARD} min-w-[220px] max-w-[300px] p-4`}>
      <CardLabel icon={<Heart size={13} strokeWidth={2} />}>{isMe ? 'You sent a tip' : 'Tip received'}</CardLabel>
      <p className="text-[24px] font-semibold tracking-[-0.02em] tabular-nums text-[#15171c] mt-2.5">
        {amount || '0'} {token && <span className="text-[15px] font-medium text-[#727a88]">{token}</span>}
      </p>
      {recipient && <p className="text-[13px] text-[#727a88] mt-1 tabular-nums">To {recipient}</p>}
      {/^0x[0-9a-fA-F]{64}$/.test(txHash) && (
        <a
          href={`https://etherscan.io/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-[#15171c] underline underline-offset-4 decoration-[#c9ced6] hover:decoration-[#15171c]"
        >
          View transaction <ExternalLink size={12} strokeWidth={2} aria-hidden="true" />
        </a>
      )}
    </div>
  );
});
TipBubble.displayName = 'TipBubble';

// ─── Private payment (Aztec, experimental) ───────────────────────────────────
const ZkPaymentBubble = React.memo(({ content }: { content: string; isMe: boolean }) => {
  const result: ZkPaymentResult | null = parseZkPaymentPayload(content);
  // A chat message only announces a payment. Balances are never credited from it.
  if (!result) return null;
  return (
    <div className={`${CARD} min-w-[240px] max-w-[320px] p-4`}>
      <CardLabel icon={<Lock size={12} strokeWidth={2.2} />}>Private payment</CardLabel>
      <p className="text-[24px] font-semibold tracking-[-0.02em] tabular-nums text-[#15171c] mt-2.5">
        {result.amount} <span className="text-[15px] font-medium text-[#727a88]">{result.token}</span>
      </p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
        <dt className="text-[#727a88]">From</dt>
        <dd className="text-[#15171c] truncate text-right tabular-nums">{result.senderTag}</dd>
        <dt className="text-[#727a88]">To</dt>
        <dd className="text-[#15171c] truncate text-right tabular-nums">{result.recipientTag}</dd>
      </dl>
      {result.memo && (
        <p className="mt-3 bg-[#f7f8fa] border border-[#eceef2] px-3 py-2 rounded-xl text-[14px] text-[#4a505c]">{result.memo}</p>
      )}
      <DemoNote />
    </div>
  );
});
ZkPaymentBubble.displayName = 'ZkPaymentBubble';

// ─── Escrow ──────────────────────────────────────────────────────────────────
const ZkEscrowBubble = React.memo(({ content, isMe }: { content: string; isMe: boolean }) => {
  const escrow: ZkEscrowState | null = parseEscrowPayload(content);
  if (!escrow) return null;
  return (
    <div className="min-w-[260px] max-w-[340px]">
      <ZkEscrowCard escrow={escrow} currentUserTag={isMe ? escrow.senderTag : escrow.recipientTag} />
    </div>
  );
});
ZkEscrowBubble.displayName = 'ZkEscrowBubble';

// ─── Private tip ─────────────────────────────────────────────────────────────
const ZkTipBubble = React.memo(({ content }: { content: string; isMe: boolean }) => {
  const tip: ZkTip | null = parseTipPayload(content);
  if (!tip) return null;
  return (
    <div className={`${CARD} min-w-[220px] max-w-[300px] p-4`}>
      <CardLabel icon={<Heart size={13} strokeWidth={2} />}>Private tip</CardLabel>
      <p className="text-[24px] font-semibold tracking-[-0.02em] tabular-nums text-[#15171c] mt-2.5">
        {tip.amount} <span className="text-[15px] font-medium text-[#727a88]">{tip.token}</span>
      </p>
      <p className="text-[13px] text-[#727a88] mt-1 truncate">From {tip.senderTag} to {tip.recipientTag}</p>
      {tip.message && (
        <p className="mt-3 bg-[#f7f8fa] border border-[#eceef2] px-3 py-2 rounded-xl text-[14px] text-[#4a505c]">{tip.message}</p>
      )}
      <DemoNote />
    </div>
  );
});
ZkTipBubble.displayName = 'ZkTipBubble';

// ─── Payment stream ──────────────────────────────────────────────────────────
const STREAM_STATUS: Record<string, string> = { active: 'Active', paused: 'Paused', completed: 'Finished', cancelled: 'Cancelled', canceled: 'Cancelled' };

const ZkStreamBubble = React.memo(({ content }: { content: string; isMe: boolean }) => {
  const stream: ZkPaymentStream | null = parseStreamPayload(content);
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!stream || stream.status !== 'active') return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [stream?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!stream) return null;
  const progress = calculateStreamProgress(stream);
  const status = STREAM_STATUS[String(stream.status)] || String(stream.status);
  return (
    <div className={`${CARD} min-w-[260px] max-w-[320px] p-4`}>
      <CardLabel
        icon={<Waves size={13} strokeWidth={2} />}
        aside={
          <span className="inline-flex items-center gap-1.5 text-[12px] text-[#4a505c]">
            <span className={`w-1.5 h-1.5 rounded-full ${stream.status === 'active' ? 'bg-[#1f9d55]' : 'bg-[#a3a9b4]'}`} aria-hidden="true" />
            {status}
          </span>
        }
      >
        Payment stream
      </CardLabel>
      <p className="text-[24px] font-semibold tracking-[-0.02em] tabular-nums text-[#15171c] mt-2.5">
        {stream.depositAmount} <span className="text-[15px] font-medium text-[#727a88]">{stream.token}</span>
      </p>
      <p className="text-[13px] text-[#727a88] mt-1 truncate">From {stream.senderTag} to {stream.recipientTag}</p>
      <div className="mt-3">
        <div className="flex justify-between text-[13px] text-[#4a505c] tabular-nums">
          <span>{progress.formattedStreamed} {stream.token} paid</span>
          <span>{progress.percentCompleted.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-[#eff1f4] rounded-full h-1.5 overflow-hidden mt-1.5" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.percentCompleted)}>
          <div className="bg-[#15171c] h-full transition-[width] duration-1000" style={{ width: `${progress.percentCompleted}%` }} />
        </div>
        <p className="text-[13px] text-[#727a88] mt-1.5">
          {progress.timeRemainingSeconds > 0 ? `About ${Math.ceil(progress.timeRemainingSeconds / 3600)} h left` : 'Fully paid'}
        </p>
      </div>
      {stream.memo && (
        <p className="mt-3 bg-[#f7f8fa] border border-[#eceef2] px-3 py-2 rounded-xl text-[14px] text-[#4a505c]">{stream.memo}</p>
      )}
      <DemoNote />
    </div>
  );
});
ZkStreamBubble.displayName = 'ZkStreamBubble';

// ─── Invoice ─────────────────────────────────────────────────────────────────
const ZkInvoiceBubble = React.memo(({ content }: { content: string; isMe: boolean }) => {
  const invoice: ZkInvoice | null = parseInvoicePayload(content);
  if (!invoice) return null;
  const overdue = invoice.status === 'unpaid' && invoice.dueDate < Date.now();
  const state = invoice.status === 'paid' ? 'Paid' : overdue ? 'Overdue' : 'Unpaid';
  const dot = invoice.status === 'paid' ? 'bg-[#1f9d55]' : overdue ? 'bg-[#e5484d]' : 'bg-[#a3a9b4]';
  return (
    <div className={`${CARD} min-w-[260px] max-w-[320px] p-4`}>
      <CardLabel
        icon={<FileText size={13} strokeWidth={2} />}
        aside={<span className="inline-flex items-center gap-1.5 text-[12px] text-[#4a505c]"><span className={`w-1.5 h-1.5 rounded-full ${dot}`} aria-hidden="true" />{state}</span>}
      >
        Invoice {invoice.invoiceNumber}
      </CardLabel>
      <p className="text-[15.5px] font-semibold text-[#15171c] mt-2.5 truncate">{invoice.title}</p>
      <p className="text-[13px] text-[#727a88] mt-0.5 truncate">From {invoice.senderTag} to {invoice.recipientTag}</p>
      <div className="mt-3 space-y-1">
        {invoice.items.slice(0, 3).map((it, i) => (
          <div key={i} className="flex justify-between gap-3 text-[14px] text-[#4a505c]">
            <span className="truncate">{it.description}</span>
            <span className="tabular-nums text-[#15171c]">{it.total.toFixed(2)}</span>
          </div>
        ))}
        {invoice.items.length > 3 && <p className="text-[13px] text-[#727a88]">and {invoice.items.length - 3} more</p>}
      </div>
      <div className="border-t border-[#eceef2] mt-3 pt-3 flex items-baseline justify-between">
        <span className="text-[13px] text-[#727a88]">Total</span>
        <span className="text-[18px] font-semibold tabular-nums text-[#15171c]">{invoice.totalAmount} <span className="text-[13px] font-medium text-[#727a88]">{invoice.token}</span></span>
      </div>
      <p className="text-[13px] text-[#727a88] flex items-center gap-1.5 mt-2">
        <Clock size={12} strokeWidth={2} aria-hidden="true" /> Due {new Date(invoice.dueDate).toLocaleDateString()}
      </p>
    </div>
  );
});
ZkInvoiceBubble.displayName = 'ZkInvoiceBubble';

// ─── Location ────────────────────────────────────────────────────────────────
const LocationBubble = React.memo(({ coords, isLive }: { coords: string; isMe: boolean; isLive: boolean }) => {
  const [lat, lon] = coords.split(',').map(Number);
  if (isNaN(lat) || isNaN(lon)) return null;
  // OpenStreetMap: no API key, no Google tracking.
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.01},${lat - 0.01},${lon + 0.01},${lat + 0.01}&layer=mapnik&marker=${lat},${lon}`;
  const openUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;
  return (
    <div className={`${CARD} overflow-hidden w-[280px] max-w-full`}>
      <div className="relative w-full h-[160px] bg-[#eef1f4]">
        <iframe
          src={mapUrl}
          width="100%"
          height="160"
          style={{ border: 'none', display: 'block' }}
          title="Map"
          loading="lazy"
          sandbox="allow-scripts allow-same-origin"
        />
        {isLive && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-full shadow-sm pointer-events-none text-[12px] font-medium text-[#15171c]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#e5484d] animate-pulse" aria-hidden="true" /> Live
          </span>
        )}
      </div>
      <a
        href={openUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        className="flex items-center gap-3 px-3.5 py-3 hover:bg-[#f7f8fa] transition-colors"
      >
        <MapPin size={16} strokeWidth={1.9} className="text-[#15171c] shrink-0" aria-hidden="true" />
        <span className="flex flex-col flex-1 min-w-0">
          <span className="text-[14.5px] font-medium text-[#15171c]">{isLive ? 'Live location' : 'Location'}</span>
          <span className="text-[13px] text-[#727a88] tabular-nums">{lat.toFixed(4)}, {lon.toFixed(4)}</span>
        </span>
        <ExternalLink size={14} strokeWidth={1.9} className="text-[#a3a9b4]" aria-hidden="true" />
      </a>
    </div>
  );
});
LocationBubble.displayName = 'LocationBubble';

// ─── Calls ───────────────────────────────────────────────────────────────────
function CallRow({ icon, title, text, tone = 'neutral' }: { icon: React.ReactNode; title: string; text: string; tone?: 'neutral' | 'missed' }) {
  return (
    <div className={`${CARD} flex items-center gap-3 px-3.5 py-3 min-w-[200px]`}>
      <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${tone === 'missed' ? 'bg-[#fdecec] text-[#d93036]' : 'bg-[#eff1f4] text-[#15171c]'}`} aria-hidden="true">
        {icon}
      </span>
      <span className="flex flex-col">
        <span className="text-[14.5px] font-medium text-[#15171c]">{title}</span>
        <span className={`text-[13px] ${tone === 'missed' ? 'text-[#d93036]' : 'text-[#727a88]'}`}>{text}</span>
      </span>
    </div>
  );
}

const CallOfferBubble = React.memo(({ content }: { content: string; isMe: boolean }) => {
  const isVideo = content.includes(':video');
  return (
    <CallRow
      icon={isVideo ? <Video size={16} strokeWidth={1.9} /> : <Phone size={16} strokeWidth={1.9} />}
      title={isVideo ? 'Video call' : 'Voice call'}
      text="Ended"
    />
  );
});
CallOfferBubble.displayName = 'CallOfferBubble';

const MissedCallBubble = React.memo(({ isMe }: { content: string; isMe: boolean }) => (
  <CallRow
    icon={<PhoneMissed size={16} strokeWidth={1.9} />}
    title={isMe ? 'Outgoing call' : 'Missed call'}
    text={isMe ? 'No answer' : 'You missed this call'}
    tone={isMe ? 'neutral' : 'missed'}
  />
));
MissedCallBubble.displayName = 'MissedCallBubble';

// Group calls are not built yet: nothing in Ledger Chat creates or joins a
// room, so an old invite must not offer a button that leads nowhere.
const GroupCallBubble = React.memo(({ isMe }: { content: string; isMe: boolean; onJoinGroupCall?: (roomId: string, pwd: string) => void }) => (
  <div className={`${CARD} flex items-center gap-3 p-3.5 min-w-[240px] max-w-[300px]`}>
    <span className="w-9 h-9 rounded-full bg-[#eff1f4] text-[#4a505c] flex items-center justify-center shrink-0" aria-hidden="true">
      <Users size={16} strokeWidth={1.9} />
    </span>
    <span className="flex flex-col min-w-0">
      <span className="text-[14.5px] font-medium text-[#15171c]">Group call invite</span>
      <span className="text-[13px] text-[#727a88]">
        {isMe ? 'Group calls are not available yet.' : 'Group calls are not available yet. Ask them to call you directly.'}
      </span>
    </span>
  </div>
));
GroupCallBubble.displayName = 'GroupCallBubble';

// ─── Sticker ─────────────────────────────────────────────────────────────────
// A plain div with a CSS animation: no nested Framer Motion scale (iOS blur bug).
const StickerBubble = React.memo(({ content }: { content: string }) => (
  <div
    className="text-[64px] leading-none select-none cursor-default opacity-0 animate-[stickerPop_0.4s_cubic-bezier(0.34,1.56,0.64,1)_forwards]"
    style={{ filter: 'drop-shadow(0 4px 12px rgba(16,24,40,0.15))' }}
  >
    {content.replace('__STICKER__', '')}
  </div>
));
StickerBubble.displayName = 'StickerBubble';

// ─── Quick reactions ─────────────────────────────────────────────────────────
const TAPBACKS = ['❤️', '👍', '👎', '😂', '😮', '🙏'];

const TapbackPicker = React.memo(({ isMe, onReact, onClose }: {
  isMe: boolean; onReact: (e: string) => void; onClose: () => void;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 6 }}
    transition={{ type: 'spring', stiffness: 420, damping: 30 }}
    role="menu"
    aria-label="React to this message"
    className="absolute z-50 flex items-center gap-0.5 p-1.5 bg-white rounded-full border border-[#e6e8ec] shadow-[0_16px_40px_-12px_rgba(16,24,40,0.28)]"
    style={{ bottom: 'calc(100% + 10px)', ...(isMe ? { right: 0 } : { left: 0 }) }}
    onClick={e => e.stopPropagation()}
  >
    {TAPBACKS.map(t => (
      <button
        type="button"
        role="menuitem"
        key={t}
        aria-label={`React with ${t}`}
        onClick={() => { onReact(t); onClose(); }}
        className="w-10 h-10 flex items-center justify-center text-[22px] rounded-full hover:bg-[#f2f4f7] hover:scale-110 active:scale-95 transition-transform duration-150"
      >
        {t}
      </button>
    ))}
  </motion.div>
));
TapbackPicker.displayName = 'TapbackPicker';

// ─── Message ─────────────────────────────────────────────────────────────────
export const MessageBubble = React.memo(({
  msg, isMe, showDate, dateStr, fontFamily, fontSizePx, bubbleStyle = 'default',
  clientInboxId, onReply, onReact, onContextMenu, onOpenLightbox,
  formatMessagePreview, onVotePoll, onJoinGroupCall,
}: MessageProps) => {
  const controls = useAnimation();
  const [showTapback, setShowTapback] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sentTime = typeof msg.sentAtNs === 'number' ? new Date(msg.sentAtNs) : (msg.sent || msg.sentAt || new Date());
  const isBurning = !!msg.burnAtNs;
  const secondsLeft = isBurning ? Math.max(0, Math.ceil((msg.burnAtNs - Date.now()) / 1000)) : null;

  /** Format remaining burn time as a compact human-readable string (e.g. "24h", "1h 30m", "5m", "30s"). */
  const formatBurnRemaining = (secs: number): string => {
    if (secs <= 0) return '0s';
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (d >= 1) return h > 0 ? `${d}d ${h}h` : `${d}d`;
    if (h >= 1) return m > 0 ? `${h}h ${m}m` : `${h}h`;
    if (m >= 1) return s > 0 ? `${m}m ${s}s` : `${m}m`;
    return `${s}s`;
  };

  // ── What kind of message is this ──
  let content = typeof msg.content === 'string' ? msg.content : (msg.fallback || 'Message could not be shown');

  let forwardFrom: string | null = null;
  if (content.startsWith('__FORWARD__')) {
    const p = content.split('__::');
    if (p.length >= 2) { forwardFrom = p[0].replace('__FORWARD__', ''); content = p.slice(1).join('__::'); }
  }
  let forwarded = !!forwardFrom;
  if (content.startsWith('[Forwarded] ')) { forwarded = true; content = content.slice('[Forwarded] '.length); }

  let replyMsg: { id: string; content: string } | null = null;
  if (content.startsWith('__REPLY__')) {
    const p = content.split('__::');
    if (p.length >= 2) {
      const metadata = p[0].replace('__REPLY__', '');
      let replyToId = metadata;
      let replyText = 'Message';
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
  if (content.startsWith('__THREAD__')) {
    const p = content.split('__::');
    if (p.length >= 2) {
      content = p.slice(1).join('__::');
      isThread = true;
    }
  }

  let isUrgent = false;
  if (content.startsWith('__URGENT__::')) {
    isUrgent = true;
    content = content.slice('__URGENT__::'.length);
  }

  const isCodeBlock = typeof content === 'string' && content.startsWith('```') && content.endsWith('```') && content.length > 6;
  const codeContent = isCodeBlock ? content.slice(3, -3).replace(/^[a-zA-Z0-9_-]+\n/, '').trim() : null;

  const isCallOffer  = content.startsWith('__CALL_OFFER__:') || content === '__CALL_HANGUP__';
  const isGroupCall  = content.startsWith('__CALL_GROUP_CREATED__:');
  const isMissedCall = content.startsWith('__CALL_MISSED__:') || content === '__CALL_DECLINE__';
  const isPoll       = content.startsWith('__POLL__');
  const isPayment    = content.startsWith('__PAYMENT__');
  const isTip        = content.startsWith('__TIP__');
  const isZkPayment  = content.startsWith('__ZK_MONEY_PAYMENT__:');
  const isZkEscrow   = content.startsWith('__ZK_ESCROW__:');
  const isZkTip      = content.startsWith('__ZK_TIP__:');
  const isZkStream   = content.startsWith('__ZK_STREAM__:');
  const isZkInvoice  = content.startsWith('__ZK_INVOICE__:');
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

  let mediaObj: any = null;
  if (isMedia) {
    try { mediaObj = JSON.parse(content.slice('__MEDIA__:'.length)); } catch {}
  }

  const attachmentMatch = (!isAudio && !isGif && !isMedia) ? content.match(/^\[ATTACHMENT:([^\]]*)\](.*?)\|(.*)$/is) : null;
  const attachment = attachmentMatch ? { mime: attachmentMatch[1] || 'application/octet-stream', url: attachmentMatch[2], name: attachmentMatch[3] } : null;

  // ── Gestures ──
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
    onReact(msg.id, '❤️');
    if (navigator.vibrate) navigator.vibrate([10, 10, 10]);
  };

  const jumpToReply = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!replyMsg?.id) return;
    const el = document.getElementById(`msg-${replyMsg.id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ring-2', 'ring-[#15171c]/15', 'rounded-2xl', 'transition-all', 'duration-300');
    setTimeout(() => el.classList.remove('ring-2', 'ring-[#15171c]/15', 'rounded-2xl', 'transition-all', 'duration-300'), 1500);
  };

  const [mediaUrl, setMediaUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!showTapback) return;
    const handler = () => setShowTapback(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showTapback]);

  useEffect(() => {
    if (mediaObj && !mediaUrl) {
      import('@/lib/chat/media').then(m => {
        m.EncryptedMediaEngine.fetchAndDecrypt(mediaObj.cid, mediaObj.k, mediaObj.iv, mediaObj.mime)
          .then((url: string) => setMediaUrl(url))
          .catch((err: unknown) => console.error('[MessageBubble] Decrypt error:', err));
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

  if (isSystemMsg) return null;

  const density = typeof window !== 'undefined' ? ((window as any).__ledger_bubble_style || bubbleStyle || 'default') : (bubbleStyle || 'default');
  const padding = density === 'compact' ? 'px-3 py-1.5' : density === 'wide' ? 'px-4 py-3' : 'px-3.5 py-2';
  const textBubble = isMe
    ? `msg-bubble-sent bg-[#15171c] text-white rounded-[20px] rounded-br-[6px]`
    : `msg-bubble-recv bg-white text-[#15171c] border border-[#e6e8ec] rounded-[20px] rounded-bl-[6px]`;

  const readReceipts = typeof window === 'undefined' || (window as any).__ledger_read_receipts !== false;

  const saveToVault = async (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    if (!attachment) return;
    try {
      const fileId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const newFile = { id: fileId, name: attachment.name, type: attachment.mime, size: Math.round(attachment.url.length * 0.75), createdAt: Date.now(), encrypted: true };
      const { vault } = await import('@/lib/core/SecureVault');
      const stored = await vault.getItem('ledger_vault_files');
      const files = stored ? JSON.parse(stored) : [];
      files.push(newFile);
      await vault.setItem('ledger_vault_files', JSON.stringify(files));
      await vault.setItem(`ledger_vault_data_${fileId}`, attachment.url);
      toast.success('Saved to your vault');
    } catch {
      toast.error('Could not save to your vault');
    }
  };

  const fileExt = attachment ? (attachment.name.split('.').pop()?.toLowerCase() || '') : '';
  const isVideoFile = attachment ? (attachment.mime.startsWith('video/') || ['mp4', 'mov', 'webm', 'ogg'].includes(fileExt)) : false;
  const isImageFile = attachment ? (attachment.mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt)) : false;

  return (
    <React.Fragment>
      {showDate && (
        <div className="flex justify-center my-4" role="separator" aria-label={dateStr}>
          <span className="px-3 py-1 bg-white border border-[#e6e8ec] rounded-full text-[12.5px] font-medium text-[#727a88]">{dateStr}</span>
        </div>
      )}

      <AnimatePresence>
        {showTapback && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            onClick={() => setShowTapback(false)}
          />
        )}
      </AnimatePresence>

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
          className={`flex flex-col relative ${isMe ? 'items-end' : 'items-start'} max-w-[82vw] md:max-w-[65%] min-w-0`}
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
          {forwarded && (
            <span className="flex items-center gap-1.5 text-[12.5px] text-[#727a88] mb-1 px-1.5">
              <Forward size={12} strokeWidth={2} aria-hidden="true" />
              {forwardFrom ? `Forwarded from ${shortAddress(forwardFrom)}` : 'Forwarded'}
            </span>
          )}
          {isThread && (
            <span className={`flex items-center gap-1.5 mb-1 px-1.5 text-[12.5px] text-[#727a88] ${isMe ? 'justify-end' : 'justify-start'}`}>
              <MessagesSquare size={12} strokeWidth={2} aria-hidden="true" /> Reply in thread
            </span>
          )}

          <div className="relative">
            <AnimatePresence>
              {showTapback && (
                <TapbackPicker isMe={isMe} onReact={(e) => onReact(msg.id, e)} onClose={() => setShowTapback(false)} />
              )}
            </AnimatePresence>

            {isSticker ? (
              <StickerBubble content={content} />
            ) : isPoll ? (
              <PollBubble content={content} msg={msg} isMe={isMe} onVotePoll={onVotePoll} clientInboxId={clientInboxId} />
            ) : isZkPayment ? (
              <ZkPaymentBubble content={content} isMe={isMe} />
            ) : isZkEscrow ? (
              <ZkEscrowBubble content={content} isMe={isMe} />
            ) : isZkTip ? (
              <ZkTipBubble content={content} isMe={isMe} />
            ) : isZkStream ? (
              <ZkStreamBubble content={content} isMe={isMe} />
            ) : isZkInvoice ? (
              <ZkInvoiceBubble content={content} isMe={isMe} />
            ) : isPayment ? (
              <PaymentBubble content={content} isMe={isMe} />
            ) : isTip ? (
              <TipBubble content={content} isMe={isMe} />
            ) : isCallOffer ? (
              <CallOfferBubble content={content} isMe={isMe} />
            ) : isGroupCall ? (
              <GroupCallBubble content={content} isMe={isMe} onJoinGroupCall={onJoinGroupCall} />
            ) : isMissedCall ? (
              <MissedCallBubble content={content} isMe={isMe} />
            ) : isGif && gifUrl ? (
              <button
                type="button"
                onClick={() => onOpenLightbox(gifUrl)}
                aria-label="Open GIF"
                className={`block rounded-2xl overflow-hidden border border-[#e6e8ec] ${isMe ? 'rounded-br-[6px]' : 'rounded-bl-[6px]'} active:scale-[0.99] transition-transform`}
              >
                <img src={gifUrl} alt="" className="max-w-[240px] max-h-[220px] object-cover block" loading="lazy" />
              </button>
            ) : isPremium ? (
              <RenderPremiumSticker
                code={content.replace('__STICKER__', '')}
                size="96px"
                fresh={(() => {
                  const raw: any = typeof msg.sentAtNs === 'number' ? (msg.sentAtNs > 1e15 ? msg.sentAtNs / 1e6 : msg.sentAtNs) : (msg.sent || msg.sentAt || Date.now());
                  const t = new Date(raw).getTime();
                  return Number.isFinite(t) && Math.abs(Date.now() - t) < 8000;
                })()}
              />
            ) : isAudio && audioSrc ? (
              <div className={`${CARD} px-3 py-2 ${isMe ? 'rounded-br-[6px]' : 'rounded-bl-[6px]'}`}>
                <CustomAudioPlayer src={audioSrc} isMe={isMe} />
              </div>
            ) : isLocation && locationCoords ? (
              <LocationBubble coords={locationCoords} isMe={isMe} isLive={content.startsWith('[LIVELOCATION]')} />
            ) : isMedia ? (
              mediaUrl ? (
                (mediaObj?.mime || '').startsWith('video/') ? (
                  <video src={mediaUrl} controls playsInline preload="metadata" className="max-w-[260px] max-h-[260px] rounded-2xl border border-[#e6e8ec] bg-[#15171c] block" />
                ) : (
                  <button type="button" onClick={() => onOpenLightbox(mediaUrl)} aria-label="Open photo" className="block rounded-2xl overflow-hidden border border-[#e6e8ec]">
                    <img src={mediaUrl} alt="" className="max-w-[260px] max-h-[300px] object-cover block" />
                  </button>
                )
              ) : (
                <div className={`${CARD} w-[220px] h-[160px] flex items-center justify-center text-[13px] text-[#727a88]`}>Loading photo</div>
              )
            ) : attachment ? (
              <div className={`relative group ${isImageFile || isVideoFile ? `rounded-2xl overflow-hidden border border-[#e6e8ec] bg-white ${isMe ? 'rounded-br-[6px]' : 'rounded-bl-[6px]'}` : ''}`}>
                {(isImageFile || isVideoFile) && (
                  <button
                    type="button"
                    onClick={saveToVault}
                    className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-white/95 rounded-full text-[#15171c] shadow-sm opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity z-10"
                    aria-label="Save to vault"
                    title="Save to vault"
                  >
                    <Lock size={14} strokeWidth={2} />
                  </button>
                )}
                {isVideoFile ? (
                  <video src={attachment.url} controls playsInline preload="metadata" className="max-w-[260px] max-h-[240px] block bg-[#15171c]" />
                ) : isImageFile ? (
                  <button type="button" onClick={() => onOpenLightbox(attachment.url)} aria-label={`Open ${attachment.name}`} className="block">
                    <img src={attachment.url} alt={attachment.name} className="max-w-[260px] max-h-[300px] object-cover block" />
                  </button>
                ) : (
                  <a
                    href={attachment.url}
                    download={attachment.name}
                    onClick={e => e.stopPropagation()}
                    className={`${CARD} flex items-center gap-3 px-3.5 py-3 min-w-[220px] max-w-[300px] hover:border-[#c9ced6] transition-colors`}
                  >
                    <span className="w-10 h-10 rounded-xl bg-[#eff1f4] text-[#15171c] flex items-center justify-center shrink-0" aria-hidden="true">
                      <FileText size={18} strokeWidth={1.8} />
                    </span>
                    <span className="flex flex-col min-w-0 flex-1">
                      <span className="text-[14.5px] font-medium text-[#15171c] truncate">{attachment.name}</span>
                      <span className="text-[13px] text-[#727a88]">{fileExt ? fileExt.toUpperCase() : 'File'}</span>
                    </span>
                    <Download size={16} strokeWidth={1.9} className="text-[#4a505c] shrink-0" aria-hidden="true" />
                  </a>
                )}
              </div>
            ) : msg.senderInboxId === '__bot__' ? (
              <div className={`${CARD} p-3.5 max-w-[340px]`}>
                <CardLabel icon={<Bot size={13} strokeWidth={2} />}>Ledger assistant</CardLabel>
                <div className="text-[15px] text-[#15171c] whitespace-pre-wrap mt-2 leading-relaxed">
                  {content.replace(/^🤖 /, '').split('\n').map((line: string, i: number) => (
                    <p key={i} className={line.startsWith('**') ? 'font-semibold' : ''}>
                      {line.replace(/\*\*/g, '')}
                    </p>
                  ))}
                </div>
              </div>
            ) : (
              <div className={`relative ${textBubble} ${padding} ${isUrgent ? 'ring-2 ring-rose-500 shadow-md' : ''}`}>
                {isUrgent && (
                  <div className={`flex items-center gap-1.5 mb-1.5 font-mono text-[10px] font-bold uppercase tracking-wider ${isMe ? 'text-rose-300' : 'text-rose-600'}`}>
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <span>[URGENT] High Priority</span>
                  </div>
                )}
                {replyMsg && (
                  <button
                    type="button"
                    onClick={jumpToReply}
                    className={`flex items-stretch gap-2 mb-1.5 -mx-1 px-2 py-1.5 rounded-xl text-left max-w-[260px] transition-colors ${
                      isMe ? 'bg-white/10 hover:bg-white/15' : 'bg-[#f2f4f7] hover:bg-[#eceef2]'
                    }`}
                  >
                    <span className={`w-[3px] rounded-full shrink-0 ${isMe ? 'bg-white/60' : 'bg-[#15171c]'}`} aria-hidden="true" />
                    <span className="flex flex-col min-w-0">
                      <span className={`text-[12.5px] font-medium ${isMe ? 'text-white/85' : 'text-[#15171c]'}`}>Reply</span>
                      <span className={`text-[13px] truncate ${isMe ? 'text-white/70' : 'text-[#727a88]'}`}>{formatMessagePreview(replyMsg.content)}</span>
                    </span>
                  </button>
                )}
                {isCodeBlock ? (
                  <div className="relative group my-1">
                    <pre className="font-mono text-[12.5px] bg-[#0c0d0e] text-[#4ade80] p-3 rounded-xl overflow-x-auto leading-relaxed border border-white/10 select-text">
                      <code>{codeContent}</code>
                    </pre>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(codeContent || ''); toast.success('Code copied to clipboard'); }}
                      className="absolute top-2 right-2 px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 text-white text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Copy
                    </button>
                  </div>
                ) : (
                  <p
                    className="whitespace-pre-wrap break-words leading-[1.45] select-text"
                    style={{ fontSize: `${fontSizePx}px`, fontFamily, WebkitUserSelect: 'text', userSelect: 'text' } as React.CSSProperties}
                  >
                    {isBurned
                      ? <span className={`italic ${isMe ? 'text-white/60' : 'text-[#a3a9b4]'}`}>This message was deleted</span>
                      : content}
                    {msg.edited && !isBurned && (
                      <span className={`text-[12px] ml-1.5 ${isMe ? 'text-white/55' : 'text-[#a3a9b4]'}`}>edited</span>
                    )}
                  </p>
                )}
                {(() => {
                  const firstUrl = extractFirstUrl(content);
                  if (!firstUrl || isBurned || isCodeBlock) return null;
                  return <BubbleLinkPreview url={firstUrl} isMe={isMe} />;
                })()}
              </div>
            )}

            {msg.reactions && Object.keys(msg.reactions).length > 0 && (
              <div className={`flex flex-wrap gap-1 -mt-1.5 relative z-10 ${isMe ? 'justify-end pr-2' : 'justify-start pl-2'}`}>
                {Object.entries(msg.reactions).map(([emoji, users]: [string, any]) => {
                  const mine = Array.isArray(users) && users.includes(clientInboxId || '');
                  return (
                    <button
                      type="button"
                      key={emoji}
                      onClick={() => onReact(msg.id, emoji)}
                      aria-pressed={mine}
                      aria-label={`${emoji} ${Array.isArray(users) ? users.length : ''}`}
                      className={`text-[13px] h-6 px-1.5 rounded-full flex items-center gap-1 border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.06)] transition-transform active:scale-95 ${
                        mine ? 'border-[#15171c]' : 'border-[#e6e8ec]'
                      }`}
                    >
                      <span>{emoji}</span>
                      {Array.isArray(users) && users.length > 1 && <span className="text-[12px] tabular-nums text-[#4a505c]">{users.length}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Time and delivery */}
          <div className={`flex items-center gap-1.5 mt-1 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
            {msg.viaServer && (
              <span className="inline-flex items-center gap-1 text-[12px] text-[#9a6a12]" title="This message went through our server because an encrypted connection was not available. Our server could read it.">
                <LockOpen size={11} strokeWidth={2} aria-hidden="true" /> Not end to end encrypted
              </span>
            )}
            {isBurning && secondsLeft !== null && (
              <span
                className={`text-[12px] tabular-nums font-medium ${secondsLeft < 60 ? 'text-[#d93036]' : secondsLeft < 3600 ? 'text-[#e07b1b]' : 'text-[#727a88]'}`}
                title={`This message disappears in ${formatBurnRemaining(secondsLeft)}`}
                aria-label={`Disappears in ${formatBurnRemaining(secondsLeft)}`}
              >
                🔥 {formatBurnRemaining(secondsLeft)}
              </span>
            )}
            <span className="text-[12px] tabular-nums text-[#a3a9b4]">
              {new Date(sentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {isMe && !msg.failed && (
              <span
                className={msg.status === 'read' && readReceipts ? 'text-[#15171c]' : 'text-[#a3a9b4]'}
                aria-label={msg.status === 'scheduled' ? 'Scheduled' : msg.status === 'read' && readReceipts ? 'Read' : msg.status === 'delivered' ? 'Delivered' : 'Sent'}
              >
                {msg.status === 'scheduled'
                  ? <Clock size={12} strokeWidth={2} />
                  : (msg.status === 'read' || msg.status === 'delivered') && readReceipts
                    ? <CheckCheck size={14} strokeWidth={2} />
                    : <Check size={14} strokeWidth={2} />}
              </span>
            )}
            {isMe && msg.failed && (
              <span className="text-[12px] font-medium text-[#d93036]">Not sent</span>
            )}
          </div>
        </motion.div>
      </motion.div>
    </React.Fragment>
  );
});
MessageBubble.displayName = 'MessageBubble';
