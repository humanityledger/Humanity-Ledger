'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BellOff, Bell, Phone, Video, Wallet, Info } from 'lucide-react';
import { PeerAvatar, shortAddr } from './ui/kit';
import { isAgreementMessage } from '@/lib/aztec/agreement-message';
import { parseAttachmentMessage } from '@/lib/chat/remote-attachment';
import { GLYPH_COUNT, safetyGlyphs, type InboxDevices } from '@/lib/chat/safety-glyphs';

/**
 * ChatDetailsPanel — the details column beside a conversation on wide screens.
 *
 * The person, four actions, the safety glyphs both people can compare, what
 * has been shared in the chat and the chat's disappearing timer. Everything is
 * read from this device: the messages already loaded, and the two XMTP inbox
 * states for the glyphs (lib/chat/safety-glyphs.ts).
 */

const glyphCache = new Map<string, string[]>();

function inner(content: string): string {
  return content.startsWith('__') && content.includes('__::') ? content.split('__::').pop() || '' : content;
}

const PAYMENT_PREFIXES = ['__PAYMENT__', '__ZK_MONEY_PAYMENT__', '__ZK_INVOICE__', '__ZK_TIP__', '__TIP__', '__ZK_STREAM__'];

export function ChatDetailsPanel({
  peerAddress,
  peerName,
  peerInboxId,
  client,
  messages,
  isMuted,
  disappearing,
  onCall,
  onPay,
  onToggleMute,
  onMore,
}: {
  peerAddress: string;
  peerName: string;
  peerInboxId?: string | null;
  client: any;
  messages: { content?: unknown }[];
  isMuted: boolean;
  /** Human label of the chat's disappearing timer, or null when off. */
  disappearing: string | null;
  onCall: (type: 'audio' | 'video') => void;
  onPay: () => void;
  onToggleMute: () => void;
  onMore: () => void;
}) {
  const shared = useMemo(() => {
    let payments = 0;
    let files = 0;
    let links = 0;
    for (const m of messages) {
      if (typeof m.content !== 'string') continue;
      const c = inner(m.content);
      if (PAYMENT_PREFIXES.some((p) => c.startsWith(p)) || isAgreementMessage(c)) payments++;
      else if (parseAttachmentMessage(c) || c.startsWith('[ATTACHMENT') || c.startsWith('__MEDIA__')) files++;
      else if (/https?:\/\/\S+/i.test(c) && !c.startsWith('__')) links++;
    }
    return { payments, files, links };
  }, [messages]);

  const selfInboxId: string | undefined = client?.inboxId;
  const [glyphs, setGlyphs] = useState<string[] | null>(null);
  const [glyphState, setGlyphState] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  useEffect(() => {
    setGlyphs(null);
    if (!client || !selfInboxId) {
      setGlyphState('unavailable');
      return;
    }
    setGlyphState('loading');
    let live = true;
    let cached: string[] | undefined;
    (async () => {
      try {
        // The peer's inbox is looked up from this chat's own address, never taken
        // from shared state that may still hold the previous chat's inbox.
        let peerId: string | undefined;
        try {
          peerId = (await client.findInboxIdByIdentifier({ identifier: peerAddress.toLowerCase(), identifierKind: 'Ethereum' })) || undefined;
        } catch { /* fall back to the inbox seen in this chat's messages */ }
        if (!peerId) peerId = peerInboxId || undefined;
        if (!live) return;
        if (!peerId) { setGlyphState('unavailable'); return; }
        const key = [selfInboxId, peerId].sort().join('|');
        cached = glyphCache.get(key);
        if (cached) { setGlyphs(cached); setGlyphState('ready'); }
        const states: any[] = await client.preferences.inboxStateFromInboxIds([selfInboxId, peerId], true);
        if (!states.some((st) => String(st.inboxId) === peerId)) throw new Error('peer inbox missing');
        const devices: InboxDevices[] = states.map((s) => ({
          inboxId: String(s.inboxId),
          installationIds: (s.installations || []).map((i: any) => String(i.id)),
        }));
        if (devices.length !== 2 || devices.some((d) => !d.installationIds.length)) throw new Error('incomplete');
        const g = await safetyGlyphs(devices[0], devices[1]);
        glyphCache.set(key, g);
        if (live) {
          setGlyphs(g);
          setGlyphState('ready');
        }
      } catch {
        if (live && !cached) setGlyphState('unavailable');
      }
    })();
    return () => {
      live = false;
    };
  }, [client, selfInboxId, peerAddress, peerInboxId]);

  const actions = [
    { label: 'Call', dot: '#12a150', icon: <Phone size={15} strokeWidth={1.9} aria-hidden="true" />, onClick: () => onCall('audio') },
    { label: 'Video', dot: '#2456e6', icon: <Video size={15} strokeWidth={1.9} aria-hidden="true" />, onClick: () => onCall('video') },
    { label: 'Pay', dot: '#15171c', icon: <Wallet size={15} strokeWidth={1.9} aria-hidden="true" />, onClick: onPay },
    {
      label: isMuted ? 'Unmute' : 'Mute',
      dot: '#c9ccd2',
      icon: isMuted ? <Bell size={15} strokeWidth={1.9} aria-hidden="true" /> : <BellOff size={15} strokeWidth={1.9} aria-hidden="true" />,
      onClick: onToggleMute,
    },
  ];

  return (
    <aside
      aria-label={`About ${peerName}`}
      className="hidden min-[1400px]:flex w-[320px] shrink-0 flex-col gap-5 border-l border-black/[0.08] bg-white px-[22px] pt-7 pb-6 overflow-y-auto"
    >
      <div className="flex flex-col items-center gap-2.5 text-center">
        <PeerAvatar address={peerAddress} name={peerName} size={88} />
        <div className="min-w-0 max-w-full">
          <h3 className="text-[19px] font-bold tracking-[-0.02em] text-[#15171c] truncate">{peerName}</h3>
          <p className="mt-1 text-[13px] text-[#5b606b] font-mono tabular-nums">{shortAddr(peerAddress)}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={a.onClick}
            className="h-16 rounded-2xl border border-[#e6e8ec] bg-white text-[#15171c] text-[12px] font-semibold flex flex-col items-center justify-center gap-1.5 hover:bg-[#f7f8fa] transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: a.dot }} aria-hidden="true" />
              {a.icon}
            </span>
            {a.label}
          </button>
        ))}
      </div>

      <section aria-label="Safety glyphs" className="rounded-[20px] bg-[#f4f5f7] p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h4 className="text-[13px] font-semibold text-[#15171c]">Safety glyphs</h4>
          {glyphState === 'ready' && <span className="text-[12px] font-medium text-[#5b606b]">Compare</span>}
        </div>
        {glyphState === 'ready' && glyphs ? (
          <div
            role="img"
            aria-label="Safety pattern for this chat"
            className="grid grid-cols-12 gap-[2px] font-mono text-[14px] leading-[18px] text-center text-[#15171c]"
          >
            {glyphs.slice(0, GLYPH_COUNT).map((g, i) => (
              <span key={i} style={{ opacity: 0.35 + (['·', ':', 'I', 'T', '7', 'Z'].indexOf(g) * 0.13) }}>
                {g}
              </span>
            ))}
          </div>
        ) : glyphState === 'loading' ? (
          <div className="h-[78px] rounded-xl bg-white/60 animate-pulse" aria-hidden="true" />
        ) : (
          <p className="text-[12.5px] leading-relaxed text-[#5b606b]">
            Shown once {peerName} has written in this chat from Ledger Chat.
          </p>
        )}
        <p className="text-[12px] leading-relaxed text-[#4a4f59]">
          Compare it with {peerName}&rsquo;s screen. It changes if a device is added to either account.
        </p>
      </section>

      <section aria-label="Shared in this chat" className="flex flex-col">
        <h4 className="mb-1.5 text-[13px] font-semibold text-[#15171c]">Shared in this chat</h4>
        {[
          ['Payments', shared.payments],
          ['Photos and files', shared.files],
          ['Links', shared.links],
        ].map(([label, n]) => (
          <div key={label as string} className="flex items-center justify-between py-3 border-b border-[#eef0f3] text-[14px] text-[#15171c]">
            <span>{label}</span>
            <span className="text-[#5b606b] tabular-nums">{n as number}</span>
          </div>
        ))}
      </section>

      <div className="flex-1" />
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] leading-relaxed text-[#5b606b]">Disappearing messages: {disappearing ?? 'off'}</p>
        <button
          type="button"
          onClick={onMore}
          className="h-8 px-3 rounded-full text-[12.5px] font-medium text-[#15171c] hover:bg-[#f2f4f7] flex items-center gap-1.5 shrink-0"
        >
          <Info size={14} strokeWidth={1.9} aria-hidden="true" /> More
        </button>
      </div>
    </aside>
  );
}

export default ChatDetailsPanel;
