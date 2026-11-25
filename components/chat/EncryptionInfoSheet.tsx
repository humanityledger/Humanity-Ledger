'use client';

import React, { useEffect, useState } from 'react';
import { Lock, X, Copy, ShieldAlert, Phone, MessageSquare, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { inboxDevicesFor, safetyDigits } from '@/lib/chat/safety-glyphs';
import { clearVerified, markVerified, verifyState, VERIFIED_EVENT, type VerifyState } from '@/lib/chat/verified-contacts';
import { useT } from '@/lib/i18n/client';

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
  const tr = useT();
  const [code, setCode] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [vstate, setVstate] = useState<VerifyState>('unverified');
  useEffect(() => {
    const read = () => setVstate(verifyState(peerAddress, code || null));
    read();
    window.addEventListener(VERIFIED_EVENT, read);
    return () => window.removeEventListener(VERIFIED_EVENT, read);
  }, [peerAddress, code]);
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
      <div role="dialog" aria-modal="true" aria-label={tr("Encryption details")} className="w-full max-w-md bg-white rounded-t-[24px] sm:rounded-[24px] px-6 pt-5 pb-6 max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[19px] font-semibold text-[#15171c] flex items-center gap-2"><Lock size={18} />{" "}{tr("Verify encryption")}</h3>
          <button type="button" onClick={onClose} aria-label={tr("Close")} className="w-8 h-8 rounded-full bg-[#f2f4f7] flex items-center justify-center"><X size={16} className="text-[#727a88]" /></button>
        </div>
        <p className="text-[14px] text-[#4a505c] leading-relaxed mb-4">{tr("Messages in this chat are end to end encrypted. Nobody outside it, including Humanity Ledger, can read them.")}</p>
        {rows.map(([icon, t, d]) => (
          <div key={t} className="flex gap-3 py-3 border-t border-[#eceef2]">
            <span className="text-[#727a88] mt-0.5">{icon}</span>
            <div><p className="text-[14px] font-semibold text-[#15171c]">{t}</p><p className="text-[13px] text-[#4a505c] leading-relaxed">{d}</p></div>
          </div>
        ))}
        <div className="py-3 border-t border-[#eceef2]">
          <p className="text-[14px] font-semibold text-[#15171c]">{tr("Safety number")}</p>
          <p className="text-[13px] text-[#4a505c] leading-relaxed mb-2">{tr("Derived from both inboxes and every device on them. Compare it with {peerName} in person or on a call. If it matches, nobody has added a device to either side. It changes whenever one of you adds or removes a device.", { peerName })}</p>
          <p className="font-mono text-[15px] tracking-wide text-[#15171c] bg-[#f2f4f7] rounded-xl p-3 break-words leading-7" data-testid="safety-number">{code || (unavailable ? tr("Not available until both devices are online on XMTP.") : '...')}</p>
          {code && (
            <button type="button" onClick={() => { navigator.clipboard?.writeText(code); toast.success(tr("Safety number copied")); }} className="mt-2 text-[13px] font-semibold text-[#15171c] inline-flex items-center gap-1.5"><Copy size={14} />{" "}{tr("Copy")}</button>
          )}
          {vstate === 'changed' && (
            <p role="alert" className="mt-3 rounded-xl border border-[#f3c9c4] bg-[#fdf3f2] px-3 py-2.5 text-[13px] leading-snug text-[#b42318]" data-testid="verify-changed">{tr("The safety number changed since you verified {peerName}. A device was added or removed on one side. Compare it again before you trust this chat.", { peerName })}</p>
          )}
          {code && (
            <div className="mt-3 flex items-center gap-2" data-testid="verify-actions">
              {vstate === 'verified' ? (
                <>
                  <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#e8f6f0] px-3 text-[13px] font-semibold text-[#0a7a55]"><ShieldCheck size={15} />{" "}{tr("Verified")}</span>
                  <button type="button" onClick={() => { clearVerified(peerAddress); toast.success(tr("Verification removed")); }} className="h-9 px-3 rounded-full text-[13px] font-semibold text-[#5b606b] hover:bg-[#f2f4f7]">{tr("Remove")}</button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => { markVerified(peerAddress, code); toast.success(tr("{peerName} verified on this device", { peerName })); }}
                  className="h-10 px-4 rounded-[12px] bg-[#15171c] text-white text-[14px] font-semibold inline-flex items-center gap-2 hover:bg-[#2b2f38]"
                >
                  <ShieldCheck size={16} /> {vstate === 'changed' ? tr("It matches again: mark verified") : tr("It matches: mark as verified")}
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-3 py-3 border-t border-[#eceef2]">
          <ShieldAlert size={16} className="text-[#727a88] mt-0.5 shrink-0" />
          <div>
            <p className="text-[14px] font-semibold text-[#15171c]">{tr("Server fallback")}</p>
            <p className="text-[13px] text-[#4a505c] leading-relaxed">{tr("If the network cannot deliver a message over XMTP, it can go through our server instead. Those messages are not end to end encrypted and carry a mark in the chat.{value}", { value: serverCount > 0 ? tr(" {serverCount} message{value} in this chat went that way.", { serverCount, value: serverCount === 1 ? '' : 's' }) : tr(" None in this chat so far.") })}
            </p>
          </div>
        </div>
        <p className="text-[12px] text-[#727a88] leading-relaxed pt-2">{tr("Your account is your wallet. Metadata such as when you are online may be visible to the network.")}</p>
      </div>
    </div>
  );
}
