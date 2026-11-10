'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Plus,
  Trash2,
  Shield,
  CheckCircle,
  X,
  CreditCard,
  QrCode,
  DollarSign,
  Calendar,
  Lock
} from 'lucide-react';
import {
  createShieldedInvoice,
  markInvoicePaid,
  ZkInvoice,
  CreateInvoiceParams
} from '@/lib/zk/zkInvoice';
import { getPrivateWallet, humanError } from '@/lib/aztec/wallet/client';
import { AZTEC_WALLET_CONFIG, networkLabel, type TokenKey } from '@/lib/aztec/wallet/config';
import { localStoragePeerBindingStore, sdkBindingCrypto, verifiedPeerBinding } from '@/lib/aztec/peer-binding';
import { AlphaRiskAck, NO_ACK, acked } from '@/components/chat/AlphaRiskAck';
import { ProvingStatus } from '@/components/chat/ProvingStatus';
import { checkPrivateRail, invoicePayee } from '@/lib/payments/rails';
import { NativeCryptoSendModal } from '@/components/chat/NativeCryptoSendModal';
import { toast } from 'sonner';

/**
 * Settling an invoice. The payee is always the invoice's ISSUER
 * (senderAddress). Two rails, both real:
 *  - private: Aztec private transfer to the issuer's Aztec address, which must
 *    have been shared in this DM (peer-binding.ts) and, on Alpha, verified;
 *  - public: an Ethereum mainnet transfer to the issuer's Ethereum address
 *    (NativeCryptoSendModal, recorded only once mined).
 * When the private rail is unavailable or fails (a failed Aztec transaction
 * moves nothing), the public rail stays one tap away. No simulated payment
 * and no invented transaction hash: an invoice is marked paid only with a
 * real receipt.
 */

interface ZkInvoiceModalProps {
  userAddress: string;
  userTag?: string;
  recipientTag?: string;
  recipientAddress?: string;
  existingInvoice?: ZkInvoice;
  /** XMTP inbox ID of the DM peer (the issuer when paying), to find their pinned Aztec address. */
  peerInboxId?: string;
  /** Our own XMTP inbox, for the G7 proof check. */
  selfInboxId?: string;
  onClose: () => void;
  onInvoiceCreated?: (invoice: ZkInvoice) => void;
  onInvoicePaid?: (invoice: ZkInvoice) => void;
}

export function ZkInvoiceModal({
  userAddress,
  userTag,
  recipientTag: initialRecipientTag = '',
  recipientAddress: initialRecipientAddress = '',
  existingInvoice,
  peerInboxId,
  selfInboxId,
  onClose,
  onInvoiceCreated,
  onInvoicePaid,
}: ZkInvoiceModalProps) {
  const [payeeAztec, setPayeeAztec] = useState<{ address?: string; verified: boolean }>({ verified: false });
  const [showPublicRail, setShowPublicRail] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const payingRef = useRef(false);
  const [ack, setAck] = useState(NO_ACK); // per payment, never persisted

  useEffect(() => {
    if (!peerInboxId || !existingInvoice) return;
    // Display only; sendDirectPrivatePayment re-verifies G7 itself before sending.
    sdkBindingCrypto()
      .then((c) => verifiedPeerBinding(localStoragePeerBindingStore(), peerInboxId, selfInboxId ?? '', c))
      .then(setPayeeAztec)
      .catch(() => setPayeeAztec({ verified: false }));
    setAck(NO_ACK);
  }, [peerInboxId, selfInboxId, existingInvoice]);

  const payee = existingInvoice ? invoicePayee(existingInvoice, userAddress) : null;
  const tokenKey = (existingInvoice?.token?.toUpperCase() || 'USDC') as TokenKey;
  const [walletState, setWalletState] = useState(() => (typeof window === 'undefined' ? null : getPrivateWallet().state));
  useEffect(() => getPrivateWallet().subscribe(setWalletState), []);
  const privateRail = checkPrivateRail({
    walletPhase: walletState?.phase ?? 'idle',
    payeeAztec: payeeAztec.address,
    payeeVerified: payeeAztec.verified,
    selfAztec: walletState?.aztecAddress,
    tokenConfigured: AZTEC_WALLET_CONFIG.tokens.some((t) => t.key === tokenKey),
    feePlan: walletState?.feeJuice?.plan,
    network: AZTEC_WALLET_CONFIG.network,
  });
  // If viewing/paying existing invoice
  const [isPaying, setIsPaying] = useState(false);
  const [proofStep, setProofStep] = useState('');
  const [provingSince, setProvingSince] = useState(0);

  // Form State for creating a new invoice - Clean initial state (no mock data)
  const [title, setTitle] = useState('');
  const [recipientTag, setRecipientTag] = useState(initialRecipientTag || '');
  const [token, setToken] = useState<'DAI' | 'USDC' | 'ETH'>('USDC');
  const [taxRate, setTaxRate] = useState(0);
  const [dueDateDays, setDueDateDays] = useState(14);
  const [notes, setNotes] = useState('');

  const [items, setItems] = useState<Array<{ description: string; quantity: number; unitPrice: number }>>([
    { description: '', quantity: 1, unitPrice: 0 },
  ]);

  const handleAddItem = () => {
    setItems([...items, { description: '', quantity: 1, unitPrice: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, field: string, val: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: val };
    setItems(updated);
  };

  const subtotal = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
  const tax = subtotal * ((Number(taxRate) || 0) / 100);
  const total = subtotal + tax;

  const isFormValid =
    title.trim().length > 0 &&
    recipientTag.trim().length > 0 &&
    items.length > 0 &&
    items.every(it => it.description.trim().length > 0 && (Number(it.quantity) || 0) > 0 && (Number(it.unitPrice) || 0) > 0);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    const invoice = createShieldedInvoice({
      title,
      senderTag: userTag || `zk:${userAddress.slice(2, 8)}`,
      senderAddress: userAddress,
      recipientTag: recipientTag.startsWith('zk:') ? recipientTag : `zk:${recipientTag}`,
      recipientAddress: initialRecipientAddress || (recipientTag.startsWith('0x') ? recipientTag : ''),
      token,
      items,
      taxRate,
      dueDateDays,
      notes,
    });

    if (onInvoiceCreated) onInvoiceCreated(invoice);
    onClose();
  };

  const settle = (txHash: string, rail: 'aztec' | 'ethereum') => {
    if (!existingInvoice) return;
    markInvoicePaid(existingInvoice.id, txHash, '');
    onInvoicePaid?.({ ...existingInvoice, status: 'paid', settlementTxHash: txHash, settledAt: Date.now() });
    toast.success(rail === 'aztec' ? `Invoice paid privately on ${networkLabel()}` : 'Invoice paid on Ethereum');
    onClose();
  };

  const handlePayInvoice = async () => {
    if (!existingInvoice || payingRef.current || !privateRail.ok || !payeeAztec.address || !peerInboxId) return;
    if (AZTEC_WALLET_CONFIG.network === 'mainnet' && !acked(ack)) return;
    payingRef.current = true;
    setIsPaying(true);
    setPayError(null);
    try {
      setProofStep('Making the proof on this device');
      setProvingSince(Date.now());
      // Same checks as a chat payment: pinned payee, fresh G7, acknowledgement and cap on Alpha.
      const { sendDirectPrivatePayment } = await import('@/lib/payments/direct-private');
      const { txHash } = await sendDirectPrivatePayment({ token: tokenKey, amount: String(existingInvoice.totalAmount), dmPeerInboxId: peerInboxId, selfInboxId: selfInboxId ?? '', ack });
      setProofStep('Payment included on Aztec');
      settle(txHash, 'aztec');
    } catch (err: any) {
      // A failed Aztec transaction changes nothing: no funds left the wallet.
      console.error('[Invoice] private payment failed:', err?.message || err);
      setPayError(`${humanError(err)} Nothing was sent. You can try again or pay on Ethereum.`);
    } finally {
      payingRef.current = false;
      setIsPaying(false);
      setAck(NO_ACK);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl p-6 w-full max-w-xl shadow-2xl border border-black/[0.08] max-h-[90vh] overflow-y-auto space-y-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/[0.06] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#15171c]/10 flex items-center justify-center text-[#15171c]">
              <FileText size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-gray-900 leading-tight">
                {existingInvoice ? existingInvoice.invoiceNumber : 'Create Shielded Freelance Invoice'}
              </h2>
              <p className="text-[12.5px] text-gray-500">
                {existingInvoice ? 'Review & settle privately on Aztec' : 'Confidential settlement without on-chain trail'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 text-gray-400 hover:text-gray-700"
          >
            <X size={18} />
          </button>
        </div>

        {existingInvoice ? (
          // ─── Pay / View Existing Invoice ──────────────────────────────
          <div className="space-y-4">
            <div className="bg-[#f7f8fa] border border-black/[0.06] rounded-2xl p-4 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-[15px] font-semibold text-gray-900">{existingInvoice.title}</h3>
                  <p className="text-[12px] text-gray-500">From: {existingInvoice.senderTag}</p>
                </div>
                <span
                  className={`text-[12px] font-semibold px-2.5 py-0.5 rounded-full ${
                    existingInvoice.status === 'paid'
                      ? 'bg-[#15171c]/20 text-[#15171c]'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {existingInvoice.status}
                </span>
              </div>
              <p className="text-[12px] text-gray-600 italic">"{existingInvoice.notes}"</p>
            </div>

            {/* Line items table */}
            <div className="border border-black/[0.06] rounded-2xl overflow-hidden">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-[#f2f4f7] text-gray-500 font-semibold border-b border-black/[0.06]">
                  <tr>
                    <th className="p-3">Description</th>
                    <th className="p-3 text-center">Qty</th>
                    <th className="p-3 text-right">Unit Price</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04]">
                  {existingInvoice.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="p-3 font-medium text-gray-800">{it.description}</td>
                      <td className="p-3 text-center text-gray-600">{it.quantity}</td>
                      <td className="p-3 text-right text-gray-600 tabular-nums">${it.unitPrice.toFixed(2)}</td>
                      <td className="p-3 text-right font-semibold text-gray-900 tabular-nums">${it.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className="bg-[#f7f8fa] rounded-2xl p-4 flex justify-between items-center">
              <div className="text-[12px] text-gray-500">
                Due Date: <span className="font-semibold text-gray-800">{new Date(existingInvoice.dueDate).toLocaleDateString()}</span>
              </div>
              <div className="text-right">
                <span className="text-[12.5px] text-gray-400 font-medium block">Total Amount</span>
                <span className="text-[20px] font-semibold text-[#15171c] tabular-nums">
                  {existingInvoice.totalAmount} {existingInvoice.token}
                </span>
              </div>
            </div>

            {isPaying && <ProvingStatus label={proofStep || 'Preparing'} startedAt={provingSince || Date.now()} />}

            {existingInvoice.status === 'unpaid' && payee && !payee.ok && (
              <p className="text-[13px] text-gray-600">{payee.reason}</p>
            )}

            {existingInvoice.status === 'unpaid' && payee?.ok && (
              <div className="space-y-2">
                {AZTEC_WALLET_CONFIG.network === 'mainnet' && privateRail.ok && <AlphaRiskAck kind="payment" value={ack} onChange={setAck} disabled={isPaying} />}
                <button
                  onClick={handlePayInvoice}
                  disabled={isPaying || !privateRail.ok || (AZTEC_WALLET_CONFIG.network === 'mainnet' && !acked(ack))}
                  className="w-full min-h-[44px] py-3.5 bg-[#15171c] text-white text-[14px] font-semibold rounded-2xl hover:bg-[#000000] transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-40"
                >
                  <Shield size={16} /> Pay privately on {networkLabel()} ({existingInvoice.totalAmount} {existingInvoice.token})
                </button>
                {!privateRail.ok && <p className="text-[12.5px] text-gray-500">{privateRail.reason}</p>}
                {AZTEC_WALLET_CONFIG.network === 'testnet' && privateRail.ok && (
                  <p className="text-[12.5px] text-gray-500">The private rail uses Aztec test network tokens, which have no value.</p>
                )}
                {payError && <p role="alert" className="text-[13px] text-[#d93036]">{payError}</p>}

                <button
                  onClick={() => setShowPublicRail(true)}
                  disabled={isPaying}
                  className="w-full min-h-[44px] py-3 bg-[#f2f4f7] text-[#15171c] text-[14px] font-semibold rounded-2xl hover:bg-[#e4e7ec] transition flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <CreditCard size={16} /> Pay publicly on Ethereum ({existingInvoice.totalAmount} {existingInvoice.token})
                </button>
                <p className="text-[12px] text-gray-500 leading-relaxed">
                  Ethereum pays the issuer&apos;s address {payee.payee!.slice(0, 8)}…{payee.payee!.slice(-6)} with real {existingInvoice.token}. Anyone can see the amount and both addresses.
                </p>
              </div>
            )}

            {showPublicRail && payee?.ok && (
              <NativeCryptoSendModal
                isOpen
                title={`Pay ${existingInvoice.invoiceNumber}`}
                recipientAddress={payee.payee!}
                defaultToken={existingInvoice.token}
                presetAmount={String(existingInvoice.totalAmount)}
                lockAmount
                onClose={() => setShowPublicRail(false)}
                onSent={(txHash) => {
                  setShowPublicRail(false);
                  settle(txHash, 'ethereum');
                }}
              />
            )}
          </div>
        ) : (
          // ─── Create New Invoice ───────────────────────────────────────
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-[12.5px] font-semibold text-gray-500">Invoice Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Protocol Security Audit Milestone 1"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full mt-1 bg-[#f2f4f7] border border-black/[0.06] rounded-xl px-3 py-2 text-[13px] font-semibold text-gray-900 outline-none focus:border-[#15171c]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[12.5px] font-semibold text-gray-500">Client / Recipient Address or Tag</label>
                <input
                  type="text"
                  required
                  value={recipientTag}
                  onChange={e => setRecipientTag(e.target.value)}
                  placeholder="0x... or zk:handle"
                  className="w-full mt-1 bg-[#f2f4f7] border border-black/[0.06] rounded-xl px-3 py-2 text-[13px] tabular-nums outline-none focus:border-[#15171c]"
                />
              </div>
              <div>
                <label className="text-[12.5px] font-semibold text-gray-500">Payment Currency</label>
                <select
                  value={token}
                  onChange={e => setToken(e.target.value as any)}
                  className="w-full mt-1 bg-[#f2f4f7] border border-black/[0.06] rounded-xl px-3 py-2 text-[13px] font-semibold outline-none"
                >
                  <option value="USDC">USDC</option>
                  <option value="ETH">ETH</option>
                  <option value="DAI">DAI</option>
                </select>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[12.5px] font-semibold text-gray-500">Itemized Deliverables</label>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-[12.5px] font-semibold text-[#15171c] hover:underline flex items-center gap-1"
                >
                  <Plus size={12} /> Add Item
                </button>
              </div>

              {items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="text"
                    required
                    placeholder="Deliverable description or milestone"
                    value={item.description}
                    onChange={e => handleUpdateItem(idx, 'description', e.target.value)}
                    className="flex-3 bg-[#f2f4f7] border border-black/[0.06] rounded-xl px-3 py-2 text-[12px] outline-none focus:border-[#15171c]"
                  />
                  <input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={item.quantity || ''}
                    onChange={e => handleUpdateItem(idx, 'quantity', Math.max(1, parseInt(e.target.value, 10) || 0))}
                    className="w-16 bg-[#f2f4f7] border border-black/[0.06] rounded-xl px-2 py-2 text-[12px] text-center outline-none"
                  />
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Price"
                    value={item.unitPrice || ''}
                    onChange={e => handleUpdateItem(idx, 'unitPrice', Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-24 bg-[#f2f4f7] border border-black/[0.06] rounded-xl px-2 py-2 text-[12px] tabular-nums outline-none"
                  />
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-2 text-gray-400 hover:text-[#d93036] transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Total calculation */}
            <div className="bg-[#f7f8fa] border border-black/[0.06] rounded-2xl p-4 flex justify-between items-center">
              <div className="text-[12px] text-gray-500">
                Settlement Rail: <span className="font-semibold text-gray-800">Private Aztec Alpha L2 or Public Ethereum L1</span>
              </div>
              <div className="text-right">
                <span className="text-[12.5px] text-gray-400 font-semibold">Total Due</span>
                <span className="text-[20px] tabular-nums font-semibold text-gray-900 block">
                  {total.toFixed(2)} {token}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={!isFormValid}
              className={`w-full py-3.5 text-white text-[14px] font-semibold rounded-2xl transition flex items-center justify-center gap-2 shadow-sm ${
                isFormValid
                  ? 'bg-[#15171c] hover:bg-[#000000] cursor-pointer'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
              }`}
            >
              <FileText size={16} /> Generate & Send Shielded Invoice
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
