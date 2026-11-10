'use client';

/**
 * ZkMoneyModal: "Private payment" from inside a conversation (R-11).
 *
 * In a DM the payee is the peer's pinned Aztec address, never typed, and the
 * payment goes through sendDirectPrivatePayment (lib/payments/direct-private.ts):
 * on Aztec Alpha it needs a G7 proof that verifies now, the risk
 * acknowledgement and a per-token cap. The posted message carries the
 * transaction hash, not the amount. Outside a DM (communities) the typed-address
 * wallet sheet is offered on the test network only; on Alpha it is refused.
 */

import React, { useEffect, useRef, useState } from 'react';
import { singleFlight } from '@/lib/aztec/single-flight';
import { AnimatePresence, motion } from 'framer-motion';
import { ZkWalletPanel } from '@/components/zk/ZkWalletPanel';
import { getPrivateWallet, humanError, type WalletSnapshot } from '@/lib/aztec/wallet/client';
import { AZTEC_WALLET_CONFIG, networkLabel, type TokenKey } from '@/lib/aztec/wallet/config';
import { directPaymentMessage } from '@/lib/payments/direct-private';
import { AlphaRiskAck, NO_ACK, acked } from './AlphaRiskAck';
import { ProvingMemoryNote } from './ProvingMemoryNote';
import { ProvingStatus } from './ProvingStatus';
import { useAddressFingerprint } from './useAddressFingerprint';

const ALPHA = AZTEC_WALLET_CONFIG.network === 'mainnet';

interface ZkMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  myAddress: string;
  recipientAddress?: string;
  recipientName?: string;
  communityName?: string;
  /** XMTP inbox of the DM peer; without it there is no pinned payee. */
  dmPeerInboxId?: string;
  /** Our own XMTP inbox, for the G7 proof check. */
  selfInboxId?: string;
  /** Receives the chat message to post once the payment is confirmed. */
  onSuccess: (message: string, result: { txHash: string; token: TokenKey }) => void;
}

export const ZkMoneyModal: React.FC<ZkMoneyModalProps> = ({ isOpen, onClose, myAddress, recipientName, dmPeerInboxId, selfInboxId, onSuccess }) => {
  const [wallet, setWallet] = useState<WalletSnapshot | null>(() => (typeof window === 'undefined' ? null : getPrivateWallet().state));
  useEffect(() => getPrivateWallet().subscribe(setWallet), []);
  const ready = wallet?.phase === 'ready';
  const posted = (txHash: string, token: TokenKey) =>
    onSuccess(directPaymentMessage({ token, txHash, senderAztec: getPrivateWallet().state.aztecAddress }), { txHash, token });

  let body: React.ReactNode;
  if (dmPeerInboxId && ready) {
    body = <DirectPaymentForm dmPeerInboxId={dmPeerInboxId} selfInboxId={selfInboxId ?? ''} peerName={recipientName} onClose={onClose} onPaid={posted} />;
  } else if (dmPeerInboxId || !ALPHA) {
    // Wallet not open yet (DM: only to open it, no typed-address payment posted), or a test-network community.
    body = <ZkWalletPanel address={myAddress} onClose={onClose} initialSheet={dmPeerInboxId ? null : 'send'} onPaymentSent={dmPeerInboxId ? undefined : ({ txHash, token }) => posted(txHash, token)} />;
  } else {
    body = (
      <div className="h-full bg-white p-5 pt-[max(1.25rem,env(safe-area-inset-top))] text-[14px] text-[#4a505c]">
        On {networkLabel()}, private payments from a chat go only to a verified address, in a direct conversation.
        <button type="button" className="mt-4 block h-10 px-4 rounded-full bg-[#15171c] text-white font-semibold" onClick={onClose}>Close</button>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[600] flex items-stretch justify-end bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div className="h-full w-full max-w-[420px]" onClick={(e) => e.stopPropagation()}>
            {body}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

function DirectPaymentForm({ dmPeerInboxId, selfInboxId, peerName, onClose, onPaid }: { dmPeerInboxId: string; selfInboxId: string; peerName?: string; onClose: () => void; onPaid: (txHash: string, token: TokenKey) => void }) {
  const [payee, setPayee] = useState<{ address?: string; verified: boolean } | null>(null);
  const [token, setToken] = useState<TokenKey>(AZTEC_WALLET_CONFIG.tokens[0]?.key ?? 'USDC');
  const [amount, setAmount] = useState('');
  const [ack, setAck] = useState(NO_ACK);
  const [confirmedFingerprint, setConfirmedFingerprint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const fingerprint = useAddressFingerprint(payee?.address);

  useEffect(() => {
    setAck(NO_ACK); // per payment and per chat, never persisted
    setConfirmedFingerprint(false);
    setPayee(null);
    let live = true;
    import('@/lib/aztec/peer-binding')
      .then(async (pb) => pb.verifiedPeerBinding(pb.localStoragePeerBindingStore(), dmPeerInboxId, selfInboxId, await pb.sdkBindingCrypto()))
      .then((b) => live && setPayee(b))
      .catch(() => live && setPayee({ verified: false }));
    return () => {
      live = false;
    };
  }, [dmPeerInboxId, selfInboxId]);

  // G7 on every network; the fingerprint check is an extra out-of-band confirmation, never a substitute.
  const blocked = !payee?.address || !payee.verified || !fingerprint || !confirmedFingerprint || (ALPHA && !acked(ack));
  const once = useRef(singleFlight()).current; // 4.19: a double tap never pays twice
  const send = () => once(async () => {
    if (busy || blocked) return;
    setBusy(true);
    setError(null);
    setStartedAt(Date.now());
    try {
      const { sendDirectPrivatePayment } = await import('@/lib/payments/direct-private');
      const { txHash } = await sendDirectPrivatePayment({ token, amount, dmPeerInboxId, selfInboxId, ack });
      onPaid(txHash, token);
      onClose();
    } catch (e) {
      setError(`${humanError(e)} Nothing was sent unless your wallet activity shows the transaction.`);
    } finally {
      setBusy(false);
      setAck(NO_ACK);
    }
  });

  const field = 'w-full h-11 rounded-xl border border-[#e4e7ec] px-3 text-[16px] text-[#15171c] bg-white';
  const who = peerName || 'This person';

  return (
    <div className="h-full overflow-y-auto overscroll-contain bg-white p-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4" role="dialog" aria-label="Private payment">
      <h2 className="text-[17px] font-semibold text-[#15171c]">Private payment</h2>
      <p className="text-[13px] text-[#727a88] leading-snug">
        {payee === null
          ? 'Checking the saved address…'
          : !payee.address
            ? `${who} has not shared an Aztec address in this chat yet.`
            : `To ${who}:`}
      </p>

      {payee?.address && (
        <div className="rounded-xl border border-[#e4e7ec] bg-[#f9fafb] p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#4a505c]">Recipient Aztec Address</span>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${payee.verified ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
              {payee.verified ? '✓ Verified (G7)' : 'Not verified: payment blocked'}
            </span>
          </div>
          <div className="flex items-center justify-between font-mono text-[11px] text-[#15171c] bg-white border border-[#e4e7ec] rounded-lg px-2.5 py-1.5">
            <span className="truncate mr-2">{payee.address.slice(0, 14)}…{payee.address.slice(-10)}</span>
            {fingerprint && (
              <span className="font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-800 flex-shrink-0" title="Address fingerprint (SHA-256)">
                FP: {fingerprint}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#727a88] leading-tight">
            Verification confirms control of the signing key. For large amounts, always confirm this fingerprint directly with {who}.
          </p>
          <label className="flex items-start gap-2 pt-1 cursor-pointer select-none">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-gray-300 text-black focus:ring-black"
              checked={confirmedFingerprint}
              onChange={(e) => setConfirmedFingerprint(e.target.checked)}
              disabled={busy}
            />
            <span className="text-[11.5px] text-[#4a505c]">
              I confirm the recipient fingerprint ({fingerprint}) matches {who}
            </span>
          </label>
        </div>
      )}

      <label className="block text-[13px] text-[#4a505c]">
        Token
        <select className={`${field} mt-1`} value={token} disabled={busy} onChange={(e) => setToken(e.target.value as TokenKey)}>
          {AZTEC_WALLET_CONFIG.tokens.map((t) => (
            <option key={t.key} value={t.key}>{ALPHA ? t.symbol : `${t.symbol} (test)`}</option>
          ))}
        </select>
      </label>
      <label className="block text-[13px] text-[#4a505c]">
        Amount
        <input className={`${field} mt-1`} inputMode="decimal" autoComplete="off" placeholder="0.00" value={amount} disabled={busy} onChange={(e) => setAmount(e.target.value.replace(',', '.'))} />
      </label>
      <ProvingMemoryNote />
      {ALPHA && <AlphaRiskAck kind="payment" value={ack} onChange={setAck} disabled={busy} />}
      {busy && <ProvingStatus label="Checking the address, then proving the payment on this device" startedAt={startedAt || Date.now()} />}
      <button type="button" className="w-full min-h-[44px] rounded-full bg-[#15171c] text-white text-[14.5px] font-semibold disabled:opacity-50" disabled={busy || blocked || !amount} onClick={send}>
        {busy ? 'Proving on this device…' : 'Send privately'}
      </button>
      {error && <p className="text-[13px] text-[#7a2e12] bg-[#fdf0eb] border border-[#f5d3c4] rounded-xl px-3 py-2" role="alert">{error}</p>}
      <button type="button" className="w-full min-h-[44px] text-[13.5px] text-[#4a505c]" disabled={busy} onClick={onClose}>Cancel</button>
    </div>
  );
}

export default ZkMoneyModal;
