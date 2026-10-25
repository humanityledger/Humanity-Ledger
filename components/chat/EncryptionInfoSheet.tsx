'use client';

import React, { useEffect, useState } from 'react';
import { Lock, X, Copy, ShieldAlert, Phone, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

/** A 60 digit safety number, the same for both people, from the two wallet addresses. */
async function safetyNumber(a: string, b: string): Promise<string> {
  const [x, y] = [a.toLowerCase(), b.toLowerCase()].sort();
  const bytes = new TextEncoder().encode(`ledger-chat-safety:${x}:${y}`);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const digits: string[] = [];
  for (let i = 0; i < 12; i++) {
    const n = ((hash[i * 2] << 8) | hash[i * 2 + 1]) * 1 + (hash[(i + 12) % 32] << 16);
    digits.push(String(n % 100000).padStart(5, '0'));
  }
  return digits.join(' ');
}

export function EncryptionInfoSheet({
  open,
  onClose,
  peerName,
  myAddress,
  peerAddress,
  serverCount,
}: {
  open: boolean;
  onClose: () => void;
  peerName: string;
  myAddress: string;
  peerAddress: string;
  serverCount: number;
}) {
  const [code, setCode] = useState('');
  useEffect(() => {
    if (!open || !myAddress || !peerAddress) return;
    let live = true;
    safetyNumber(myAddress, peerAddress).then(c => live && setCode(c)).catch(() => live && setCode(''));
    return () => { live = false; };
  }, [open, myAddress, peerAddress]);

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
          <p className="text-[13px] text-[#4a505c] leading-relaxed mb-2">Derived from both wallet addresses. Compare it with {peerName} in person or on a call. If it matches, you are talking to the right person.</p>
          <p className="font-mono text-[15px] tracking-wide text-[#15171c] bg-[#f2f4f7] rounded-xl p-3 break-words leading-7">{code || '...'}</p>
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
