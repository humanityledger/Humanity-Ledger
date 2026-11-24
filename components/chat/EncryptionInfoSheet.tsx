'use client';

import React, { useEffect, useState } from 'react';
import { Lock, X, Copy, ShieldAlert, Phone, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

import { inboxDevicesFor, safetyDigits } from '@/lib/chat/safety-glyphs';

/**
 * The safety number covers both XMTP inboxes and every device registered on them
 * (lib/chat/safety-glyphs.ts), the same digest as the glyphs in the chat details. It changes when
 * either person adds or removes a device, which is exactly when it should be compared again.
 * Without a signed-in XMTP client there is nothing to derive it from, and the sheet says so instead
 * of showing a number that would not detect a changed device.
 */
export function EncryptionInfoSheet({
  open,
  onClose,
  peerName,
  myAddress,
  peerAddress,
  serverCount,
  client,
}: {
  open: boolean;
  onClose: () => void;
  peerName: string;
  myAddress: string;
  peerAddress: string;
  serverCount: number;
  /** The signed-in XMTP client; the safety number needs it to read both inboxes' devices. */
  client?: any;
}) {
  const [code, setCode] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    if (!open || !myAddress || !peerAddress) return;
    let live = true;
    setCode('');
    setUnavailable(false);
    (async () => {
      try {
        const devices = client ? await inboxDevicesFor(client, peerAddress) : null;
        if (!live) return;
        if (!devices) { setUnavailable(true); return; }
        const digits = await safetyDigits(devices[0], devices[1]);
        if (live) setCode(digits);
      } catch {
        if (live) setUnavailable(true);
      }
    })();
    return () => { live = false; };
  }, [open, myAddress, peerAddress, client]);

  if (!open) return null;
  const rows: [React.ReactNode, string, string][] = [
    [<MessageSquare key="m" size={16} />, 'Messages', 'XMTP with MLS (RFC 9420). Cipher suite MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519. Only you and ' + peerName + ' hold the keys.'],
    [<Phone key="p" size={16} />, 'Calls', 'WebRTC with DTLS SRTP, encrypted between your devices. With IP masking on, media goes through a relay but stays encrypted.'],
  ];
  return (
    <div className="fixed inset-0 z-[250002] bg-black/40 flex items-end sm:items-center justify-center" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Encryption details" className="w-full max-w-md bg-white rounded-t-[24px] sm:rounded-[24px] px-6 pt-5 pb-6 max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[19px] font-semibold text-[#15171c] flex items-center gap-2"><Lock size={18} /> Encryption</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-[#f2f4f7] flex items-center justify-center"><X size={16} className="text-[#727a88]" /></button>
        </div>
        <p className="text-[14px] text-[#4a505c] leading-relaxed mb-4">Messages in this chat are end to end encrypted. Nobody outside it, including Humanity Ledger, can read them.</p>
        {rows.map(([icon, t, d]) => (
          <div key={t} className="flex gap-3 py-3 border-t border-[#eceef2]">
            <span className="text-[#727a88] mt-0.5">{icon}</span>
            <div><p className="text-[14px] font-semibold text-[#15171c]">{t}</p><p className="text-[13px] text-[#4a505c] leading-relaxed">{d}</p></div>
          </div>
        ))}
        <div className="py-3 border-t border-[#eceef2]">
          <p className="text-[14px] font-semibold text-[#15171c]">Safety number</p>
          <p className="text-[13px] text-[#4a505c] leading-relaxed mb-2">Derived from both inboxes and every device on them. Compare it with {peerName} in person or on a call. If it matches, nobody has added a device to either side. It changes whenever one of you adds or removes a device.</p>
          <p className="font-mono text-[15px] tracking-wide text-[#15171c] bg-[#f2f4f7] rounded-xl p-3 break-words leading-7" data-testid="safety-number">{code || (unavailable ? 'Not available until both devices are online on XMTP.' : '...')}</p>
          {code && (
            <button type="button" onClick={() => { navigator.clipboard?.writeText(code); toast.success('Safety number copied'); }} className="mt-2 text-[13px] font-semibold text-[#15171c] inline-flex items-center gap-1.5"><Copy size={14} /> Copy</button>
          )}
        </div>
        <div className="flex gap-3 py-3 border-t border-[#eceef2]">
          <ShieldAlert size={16} className="text-[#727a88] mt-0.5 shrink-0" />
          <div>
            <p className="text-[14px] font-semibold text-[#15171c]">Server fallback</p>
            <p className="text-[13px] text-[#4a505c] leading-relaxed">
              If the network cannot deliver a message over XMTP, it can go through our server instead. Those messages are not end to end encrypted and carry a mark in the chat.
              {serverCount > 0 ? ` ${serverCount} message${serverCount === 1 ? '' : 's'} in this chat went that way.` : ' None in this chat so far.'}
            </p>
          </div>
        </div>
        <p className="text-[12px] text-[#727a88] leading-relaxed pt-2">Your account is your wallet. Metadata such as when you are online may be visible to the network.</p>
      </div>
    </div>
  );
}
