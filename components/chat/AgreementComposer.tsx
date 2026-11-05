'use client';

/**
 * "Private agreement" from the chat's attach menu: share your Aztec address
 * with the person in this conversation, or open an escrow or a payment
 * stream to them on the Aztec test network.
 *
 * Opening an agreement needs the peer's Aztec address, pinned from their own
 * announcement in this DM (lib/aztec/peer-binding.ts); it is never typed by
 * hand here, so an invitation can only go to the address this person gave.
 * The invitation (which carries the agreement's secrets) is handed to the
 * chat to post in this DM only.
 */

import React, { useEffect, useState } from 'react';
import { X, KeyRound, Lock, Waves, LoaderCircle } from 'lucide-react';
import { announcementFor, localStoragePeerBindingStore, peerAztecAddress } from '@/lib/aztec/peer-binding';
import { getPrivateWallet, humanError, type WalletSnapshot } from '@/lib/aztec/wallet/client';
import { AZTEC_WALLET_CONFIG } from '@/lib/aztec/wallet/config';

const DURATIONS = {
  escrow: [
    { label: '1 hour', s: 3600 },
    { label: '1 day', s: 86400 },
    { label: '1 week', s: 604800 },
  ],
  stream: [
    { label: '1 hour', s: 3600 },
    { label: '1 day', s: 86400 },
    { label: '30 days', s: 2592000 },
  ],
};

export interface AgreementComposerProps {
  /** XMTP inbox of the other person in this DM. */
  dmPeerInboxId: string;
  peerName: string;
  onClose: () => void;
  /** Posts a message in this DM (an invitation or an announcement). */
  onSend: (message: string) => Promise<void> | void;
  /** Opens the private wallet when it is closed. */
  onOpenWallet?: () => void;
}

export function AgreementComposer({ dmPeerInboxId, peerName, onClose, onSend, onOpenWallet }: AgreementComposerProps) {
  const [wallet, setWallet] = useState<WalletSnapshot>(() => getPrivateWallet().state);
  useEffect(() => getPrivateWallet().subscribe(setWallet), []);
  const [peer, setPeer] = useState<string | undefined>();
  useEffect(() => {
    peerAztecAddress(localStoragePeerBindingStore(), dmPeerInboxId).then(setPeer).catch(() => setPeer(undefined));
  }, [dmPeerInboxId]);

  const [kind, setKind] = useState<'escrow' | 'stream'>('escrow');
  const [token, setToken] = useState(AZTEC_WALLET_CONFIG.tokens[0]?.address ?? '');
  const [amount, setAmount] = useState('');
  const [duration, setDuration] = useState(DURATIONS.escrow[1].s);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ready = wallet.phase === 'ready';

  const share = async () => {
    setError(null);
    if (!wallet.aztecAddress) return;
    await onSend(announcementFor(wallet.aztecAddress));
    onClose();
  };

  const open = async () => {
    setError(null);
    if (!peer) return;
    setStep('Preparing');
    try {
      const { openChatAgreement } = await import('@/lib/aztec/chat-agreements');
      const { raw } = await openChatAgreement({ kind, peerAztecAddress: peer, tokenAddress: token, amount, durationSeconds: duration, onStep: setStep });
      setStep('Posting the invitation in this chat');
      await onSend(raw);
      onClose();
    } catch (e) {
      setError(humanError(e));
    } finally {
      setStep(null);
    }
  };

  const field = 'w-full h-10 rounded-xl border border-[#e4e7ec] px-3 text-[14px] text-[#15171c] bg-white focus:outline-none focus:ring-2 focus:ring-[#15171c]/15';
  const seg = (on: boolean) => `flex-1 h-9 rounded-full text-[13.5px] font-semibold flex items-center justify-center gap-1.5 ${on ? 'bg-[#15171c] text-white' : 'bg-[#eff1f4] text-[#15171c]'}`;

  return (
    <div className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={() => !step && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Private agreement"
        className="w-full sm:max-w-[420px] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-black/10 p-5 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-semibold text-[#15171c]">Private agreement with {peerName}</h2>
          <button type="button" aria-label="Close" disabled={!!step} onClick={onClose} className="w-8 h-8 rounded-full hover:bg-[#eff1f4] flex items-center justify-center">
            <X size={16} />
          </button>
        </div>
        <p className="text-[13px] text-[#727a88] mt-1 leading-snug">
          An escrow or a payment stream in its own contract on the Aztec test network. Amounts and parties stay private. Test tokens only, no value. The contracts have no external audit.
        </p>

        {!ready ? (
          <div className="mt-4">
            <p className="text-[14px] text-[#4a505c]">Open your private wallet first.</p>
            {onOpenWallet && (
              <button type="button" className="mt-3 h-10 px-4 rounded-full bg-[#15171c] text-white text-[14px] font-semibold" onClick={onOpenWallet}>
                Open private wallet
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="mt-4 rounded-2xl border border-[#eceef2] p-3.5">
              <p className="flex items-center gap-2 text-[13.5px] font-semibold text-[#15171c]">
                <KeyRound size={14} /> Aztec addresses
              </p>
              <p className="text-[13px] text-[#727a88] mt-1 leading-snug">
                {peer ? `${peerName}'s address is saved for this chat: ${peer.slice(0, 10)}…${peer.slice(-4)}.` : `${peerName} has not shared an Aztec address in this chat yet. Share yours and ask them to share theirs.`}
              </p>
              <button type="button" className="mt-2.5 h-9 px-3.5 rounded-full bg-[#eff1f4] text-[13.5px] font-semibold text-[#15171c]" disabled={!!step} onClick={share}>
                Share my Aztec address
              </button>
            </div>

            {peer && (
              <div className="mt-4 space-y-3">
                <div className="flex gap-2">
                  <button type="button" className={seg(kind === 'escrow')} onClick={() => { setKind('escrow'); setDuration(DURATIONS.escrow[1].s); }}>
                    <Lock size={14} /> Escrow
                  </button>
                  <button type="button" className={seg(kind === 'stream')} onClick={() => { setKind('stream'); setDuration(DURATIONS.stream[1].s); }}>
                    <Waves size={14} /> Stream
                  </button>
                </div>
                <p className="text-[12.5px] text-[#727a88] leading-snug">
                  {kind === 'escrow'
                    ? `${peerName} can claim the amount until the deadline; after it, you can take it back.`
                    : `The amount is paid out second by second over the duration; ${peerName} withdraws what has accrued, and you can cancel at any time.`}
                </p>
                <label className="block text-[13px] text-[#4a505c]">
                  Token
                  <select className={`${field} mt-1`} value={token} onChange={(e) => setToken(e.target.value)}>
                    {AZTEC_WALLET_CONFIG.tokens.map((t) => (
                      <option key={t.address} value={t.address}>{t.symbol} (test)</option>
                    ))}
                  </select>
                </label>
                <label className="block text-[13px] text-[#4a505c]">
                  Amount
                  <input className={`${field} mt-1`} inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value.replace(',', '.'))} />
                </label>
                <label className="block text-[13px] text-[#4a505c]">
                  {kind === 'escrow' ? 'Time to claim' : 'Duration'}
                  <select className={`${field} mt-1`} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                    {DURATIONS[kind].map((d) => (
                      <option key={d.s} value={d.s}>{d.label}</option>
                    ))}
                  </select>
                </label>
                <p className="text-[12.5px] text-[#727a88] leading-snug">
                  The amount comes from your private balance. Proving runs on this device and can take a few minutes.
                </p>
                <button type="button" className="w-full h-11 rounded-full bg-[#15171c] text-white text-[14.5px] font-semibold disabled:opacity-50" disabled={!!step || !amount || !token} onClick={open}>
                  {kind === 'escrow' ? 'Open escrow' : 'Open stream'}
                </button>
              </div>
            )}
          </>
        )}

        {step && (
          <p className="mt-4 flex items-center gap-2 text-[13.5px] text-[#4a505c]" role="status">
            <LoaderCircle size={14} className="animate-spin" /> {step}
          </p>
        )}
        {error && <p className="mt-4 text-[13px] text-[#7a2e12] bg-[#fdf0eb] border border-[#f5d3c4] rounded-xl px-3 py-2">{error}</p>}
      </div>
    </div>
  );
}

export default AgreementComposer;
