'use client';

import React, { useEffect, useState } from 'react';
import { BellOff, Bell, Phone, Video, Wallet } from 'lucide-react';
import { PeerAvatar, shortAddr } from './ui/kit';
import { GLYPH_COUNT, safetyGlyphs, type InboxDevices } from '@/lib/chat/safety-glyphs';
import { ContactInfoSections } from './ContactInfoPanel';
import { ChatCredit } from './ChatCredit';

/**
 * ChatDetailsPanel — the details column beside a conversation on wide screens.
 *
 * The person, four actions, the safety glyphs both people can compare, and under them the whole
 * contact info (About, Media and files, Personalization, Privacy, Actions), the same sections the
 * Contact info sheet shows on narrow screens. The credit closes the column at the bottom right of
 * /chat. Everything is read from this device: the messages already loaded, and the two XMTP inbox
 * states for the glyphs (lib/chat/safety-glyphs.ts).
 */

const glyphCache = new Map<string, string[]>();

export function ChatDetailsPanel({
  peerAddress,
  peerName,
  peerInboxId,
  client,
  messages,
  myAddress,
  isMuted,
  onCall,
  onPay,
  onToggleMute,
  onBlock,
  onClearChat,
}: {
  peerAddress: string;
  peerName: string;
  peerInboxId?: string | null;
  client: any;
  messages: any[];
  myAddress: string;
  isMuted: boolean;
  onCall: (type: 'audio' | 'video') => void;
  onPay: () => void;
  onToggleMute: () => void;
  onBlock: () => void;
  onClearChat?: () => void;
}) {
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

  const ic = { size: 19, strokeWidth: 1.75, 'aria-hidden': true } as const;
  const actions = [
    { label: 'Call', icon: <Phone {...ic} />, onClick: () => onCall('audio') },
    { label: 'Video', icon: <Video {...ic} />, onClick: () => onCall('video') },
    { label: 'Pay', icon: <Wallet {...ic} />, onClick: onPay },
    { label: isMuted ? 'Unmute' : 'Mute', icon: isMuted ? <Bell {...ic} /> : <BellOff {...ic} />, onClick: onToggleMute, pressed: isMuted },
  ];

  return (
    <aside
      id="chat-details-column"
      tabIndex={-1}
      aria-label={`About ${peerName}`}
      className="hidden min-[1400px]:flex w-[340px] shrink-0 flex-col gap-5 border-l border-black/[0.08] bg-white px-[22px] pt-7 pb-6 overflow-y-auto outline-none"
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
            aria-pressed={'pressed' in a ? a.pressed : undefined}
            className="h-[68px] rounded-2xl border border-[#e4e7ec] bg-white text-[#15171c] flex flex-col items-center justify-center gap-2 hover:bg-[#f7f8fa] transition-colors"
          >
            {a.icon}
            <span className="text-[12px] font-semibold leading-none">{a.label}</span>
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
          <p className="h-[78px] flex items-center justify-center rounded-xl bg-white/70 text-[12.5px] text-[#5b606b]" role="status">
            Reading both devices
          </p>
        ) : (
          <p className="text-[12.5px] leading-relaxed text-[#5b606b]">
            Shown once {peerName} has written in this chat from Ledger Chat.
          </p>
        )}
        <p className="text-[12px] leading-relaxed text-[#4a4f59]">
          Compare it with {peerName}&rsquo;s screen. It changes if a device is added to either account.
        </p>
      </section>

      <ContactInfoSections
        variant="column"
        peerAddress={peerAddress}
        displayName={peerName}
        myAddress={myAddress}
        messages={messages}
        isMuted={isMuted}
        onToggleMute={onToggleMute}
        onBlock={onBlock}
        onClearChat={onClearChat}
      />

      <div className="flex-1 min-h-6" />
      <ChatCredit align="end" className="pt-4 border-t border-[#eef0f3]" />
    </aside>
  );
}

export default ChatDetailsPanel;
