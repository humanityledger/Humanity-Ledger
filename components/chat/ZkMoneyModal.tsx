'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Lock, X, Check, ExternalLink, Zap, EyeOff, Sparkles,
  ChevronRight, Users, Clock, FileText, CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import {
  formatZkTag,
  resolveZkTag,
  getShieldedBalances,
  executeShieldedPayment,
  encodeZkPaymentPayload,
  encodeEscrowPayload,
  createEscrow,
  formatUSDValue,
  estimateTransferFee,
  ZkPaymentResult,
  ZkShieldedBalance,
  SupportedToken,
  AZTEC_EXPLORER
} from '@/lib/zk/zkMoney';
import { ZkRecipientPicker } from '@/components/zk/ZkRecipientPicker';

interface ZkMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  myAddress: string;
  recipientAddress?: string;
  recipientName?: string;
  communityName?: string;
  onSuccess: (paymentPayload: string, result: ZkPaymentResult) => void;
}

export const ZkMoneyModal: React.FC<ZkMoneyModalProps> = ({
  isOpen,
  onClose,
  myAddress,
  recipientAddress,
  recipientName,
  communityName,
  onSuccess
}) => {
  const [selectedToken, setSelectedToken] = useState<SupportedToken>('DAI');
  const [transferMode, setTransferMode] = useState<'instant' | 'escrow'>('instant');
  const [recipientTag, setRecipientTag] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [escrowConditions, setEscrowConditions] = useState('');
  const [balances, setBalances] = useState<ZkShieldedBalance>(() => 
    myAddress ? getShieldedBalances(myAddress) : {
      dai: '0.00',
      usdc: '0.00',
      eth: '0.000',
      lastUpdated: Date.now()
    }
  );
  const [loading, setLoading] = useState(false);
  const [proofStep, setProofStep] = useState<string>('');
  const [completedTx, setCompletedTx] = useState<ZkPaymentResult | null>(null);
  const [showRecipientPicker, setShowRecipientPicker] = useState(false);

  // Initialize recipient and balance
  useEffect(() => {
    if (isOpen) {
      const initialTag = recipientAddress
        ? resolveZkTag(recipientAddress)
        : recipientName
        ? formatZkTag(recipientName)
        : '';
      setRecipientTag(initialTag);
      setCompletedTx(null);
      setAmount('');
      setMemo('');
      setEscrowConditions('');
      setProofStep('');
      setTransferMode('instant');
      if (myAddress) {
        setBalances(getShieldedBalances(myAddress));
      }
    }
  }, [isOpen, recipientAddress, recipientName, myAddress]);

  if (!isOpen) return null;

  const currentBalance =
    selectedToken === 'DAI'
      ? balances.dai
      : selectedToken === 'USDC'
      ? balances.usdc
      : balances.eth;

  const numAmount = parseFloat(amount.replace(/,/g, '')) || 0;
  const usdValue = numAmount > 0 ? formatUSDValue(amount, selectedToken) : null;
  const fee = estimateTransferFee(selectedToken);

  const handleSend = async () => {
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      toast.error('Please enter a valid transfer amount');
      return;
    }
    const maxBalance = parseFloat(currentBalance.replace(/,/g, ''));
    if (numAmount > maxBalance) {
      toast.error(`Insufficient shielded ${selectedToken} balance`);
      return;
    }
    if (!recipientTag.trim()) {
      toast.error('Please provide a recipient zk.money tag');
      return;
    }

    try {
      setLoading(true);

      if (transferMode === 'escrow') {
        setProofStep('Generating UltraPlonk Escrow Condition Note...');
        await new Promise(r => setTimeout(r, 600));

        const escrow = createEscrow({
          senderTag: myAddress,
          recipientTag,
          amount,
          token: selectedToken,
          conditions: escrowConditions.trim() || 'Milestone verification upon delivery',
          milestones: [
            { description: 'Initial Milestone Acceptance', amount: (numAmount * 0.5).toFixed(2) },
            { description: 'Final Completion Verification', amount: (numAmount * 0.5).toFixed(2) }
          ]
        });

        const escrowTxHash = escrow.txHash || `0x_escrow_${Date.now()}`;
        const escrowPaymentResult: ZkPaymentResult = {
          txHash: escrowTxHash,
          status: 'shielded',
          timestamp: escrow.createdAt || Date.now(),
          token: selectedToken,
          amount,
          recipientTag,
          senderTag: resolveZkTag(myAddress),
          aztecExplorerUrl: `${AZTEC_EXPLORER}/tx-effect/${escrowTxHash.replace('0x', '')}`,
          nullifierHash: escrow.noteId || `0x_nullifier_${Date.now()}`,
          memo: `Escrow: ${escrow.conditions}`
        };

        setCompletedTx(escrowPaymentResult);
        const payload = encodeEscrowPayload(escrow);
        toast.success(`Shielded Escrow (${amount} ${selectedToken}) initiated on Aztec!`);
        onSuccess(payload, escrowPaymentResult);
      } else {
        const result = await executeShieldedPayment(
          {
            senderAddress: myAddress,
            recipientTag,
            recipientAddress,
            amount,
            token: selectedToken,
            memo: memo.trim() || undefined
          },
          (step, _pct) => setProofStep(step)
        );

        setCompletedTx(result);
        const payload = encodeZkPaymentPayload(result);
        toast.success(`Shielded ${amount} ${selectedToken} transfer complete!`);
        onSuccess(payload, result);
      }
    } catch (err: any) {
      toast.error('Shielded transfer failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-md bg-white rounded-[28px] shadow-2xl overflow-hidden border border-black/[0.08]"
          style={{ maxHeight: '90vh', overflowY: 'auto' }}
        >
          {/* Header */}
          <div className="relative px-6 pt-6 pb-4 bg-white border-b border-black/[0.06] text-[#1C1C1E]">
            <button
              type="button"
              onClick={onClose}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-colors text-gray-500 hover:text-black"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-2xl bg-[#1C1C1E] flex items-center justify-center shadow-sm">
                <Lock size={18} className="text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-[17px] font-bold text-gray-900 tracking-tight">zk.money</h3>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-black/5 text-[#1C1C1E] px-2 py-0.5 rounded-full border border-black/10">
                    Aztec Rollup
                  </span>
                </div>
                <p className="text-[12px] text-gray-500 font-medium">Private Stablecoin Payments</p>
              </div>
            </div>

            {/* Mode switch */}
            <div className="mt-3 grid grid-cols-2 p-1 bg-[#F2F2F7] rounded-xl">
              <button
                type="button"
                onClick={() => setTransferMode('instant')}
                className={`py-1.5 text-[12px] font-bold rounded-lg transition-all ${
                  transferMode === 'instant' ? 'bg-[#1C1C1E] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Instant Transfer
              </button>
              <button
                type="button"
                onClick={() => setTransferMode('escrow')}
                className={`py-1.5 text-[12px] font-bold rounded-lg transition-all ${
                  transferMode === 'escrow' ? 'bg-[#1C1C1E] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Shielded Escrow
              </button>
            </div>

            <div className="mt-2.5 flex items-center justify-between p-2.5 rounded-xl bg-[#FAFAFA] border border-black/[0.06]">
              <div className="flex items-center gap-2">
                <Lock size={13} className="text-gray-600" />
                <span className="text-[12px] text-gray-600 font-medium">Shielded Balance</span>
              </div>
              <span className="text-[14px] font-bold font-mono text-gray-900">
                {currentBalance} {selectedToken}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {completedTx ? (
              /* Success State */
              <div className="py-4 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-black/5 text-[#1C1C1E] mx-auto flex items-center justify-center">
                  <Check size={32} />
                </div>
                <div>
                  <h4 className="text-[18px] font-bold text-[#1C1C1E]">
                    {transferMode === 'escrow' ? 'Shielded Escrow Locked' : 'Private Transfer Sent'}
                  </h4>
                  <p className="text-[13px] text-[#8E8E93] mt-1">
                    {completedTx.amount} {completedTx.token} {transferMode === 'escrow' ? 'committed in private escrow to ' : 'transferred to '}
                    <span className="font-mono font-semibold text-[#1C1C1E]">
                      {completedTx.recipientTag}
                    </span>
                  </p>
                </div>

                <div className="p-3 bg-[#F2F2F7] rounded-xl text-left space-y-1.5 text-[12px] font-mono">
                  <div className="flex justify-between text-[#8E8E93]">
                    <span>Status:</span>
                    <span className="text-[#1C1C1E] font-bold">Shielded Note Created</span>
                  </div>
                  <div className="flex justify-between text-[#8E8E93]">
                    <span>Tx Hash:</span>
                    <span className="text-[#1C1C1E]">
                      {completedTx.txHash.slice(0, 10)}...{completedTx.txHash.slice(-8)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <a
                    href={completedTx.aztecExplorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-3 bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1C1C1E] font-semibold text-[13px] rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ExternalLink size={14} /> View AztecScan
                  </a>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-3 bg-[#1C1C1E] text-white font-bold text-[13px] rounded-xl hover:bg-black transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* Input Form */
              <>
                {/* Token Selector */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8E8E93] mb-1.5">
                    Select Private Asset
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['DAI', 'USDC', 'ETH'] as const).map(t => (
                      <button
                        type="button"
                        key={t}
                        onClick={() => setSelectedToken(t)}
                        className={`py-2 px-3 rounded-xl text-[13px] font-bold transition-all border ${
                          selectedToken === t
                            ? 'bg-[#1C1C1E] text-white border-[#1C1C1E] shadow-sm'
                            : 'bg-[#F2F2F7] text-[#1C1C1E] border-transparent hover:bg-[#E5E5EA]'
                        }`}
                      >
                        {t === 'DAI' ? 'zkDAI' : t === 'USDC' ? 'zkUSDC' : 'zkETH'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recipient Tag with Picker trigger */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#8E8E93]">
                      Recipient zk.money Tag
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowRecipientPicker(true)}
                      className="text-[11px] font-bold text-[#1C1C1E] hover:underline flex items-center gap-1"
                    >
                      <Users size={12} /> Address Book
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={recipientTag}
                      onChange={e => setRecipientTag(e.target.value)}
                      placeholder="zk:username or 0x..."
                      className="w-full bg-[#F2F2F7] rounded-xl px-4 py-2.5 text-[14px] font-mono text-[#1C1C1E] outline-none focus:ring-2 focus:ring-[#1C1C1E] transition-all"
                    />
                    <div className="absolute right-3 top-2.5">
                      <Lock size={16} className="text-gray-400" />
                    </div>
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-[#8E8E93]">
                        Amount
                      </label>
                      {usdValue && (
                        <span className="text-[11px] text-gray-500 font-medium">{usdValue}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setAmount(currentBalance.replace(/,/g, ''))}
                      className="text-[11px] font-bold text-[#1C1C1E] hover:underline"
                    >
                      Use Max ({currentBalance})
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[#F2F2F7] rounded-xl px-4 py-2.5 text-[16px] font-bold text-[#1C1C1E] outline-none focus:ring-2 focus:ring-[#1C1C1E] transition-all"
                    />
                    <span className="absolute right-4 top-2.5 text-[14px] font-bold text-[#8E8E93]">
                      {selectedToken}
                    </span>
                  </div>
                </div>

                {/* Mode specific fields */}
                {transferMode === 'escrow' ? (
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8E8E93] mb-1.5">
                      Escrow Milestone Conditions
                    </label>
                    <textarea
                      value={escrowConditions}
                      onChange={e => setEscrowConditions(e.target.value)}
                      placeholder="Specify release milestones (e.g. Design delivery, Code review)..."
                      rows={2}
                      className="w-full bg-[#F2F2F7] rounded-xl px-4 py-2 text-[13px] text-[#1C1C1E] outline-none focus:ring-2 focus:ring-[#1C1C1E] transition-all resize-none"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8E8E93] mb-1.5">
                      Confidential Memo (Optional)
                    </label>
                    <input
                      type="text"
                      value={memo}
                      onChange={e => setMemo(e.target.value)}
                      placeholder="Private settlement note..."
                      maxLength={60}
                      className="w-full bg-[#F2F2F7] rounded-xl px-4 py-2 text-[13px] text-[#1C1C1E] outline-none focus:ring-2 focus:ring-[#1C1C1E] transition-all"
                    />
                  </div>
                )}

                {/* Fee & Privacy Row */}
                <div className="flex items-center justify-between text-[11px] text-gray-500 bg-gray-50 p-2.5 rounded-xl border border-black/[0.04]">
                  <span className="flex items-center gap-1">
                    <Lock size={12} className="text-gray-600" />
                    Zero public leakage
                  </span>
                  <span>Aztec Sequencer Fee: <strong>{fee.totalUSD}</strong></span>
                </div>

                {/* Action Button */}
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSend}
                  className={`w-full py-3.5 rounded-xl font-bold text-[15px] flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98 ${
                    loading
                      ? 'bg-black/50 text-white cursor-wait'
                      : 'bg-[#1C1C1E] hover:bg-black text-white'
                  }`}
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span className="truncate max-w-[280px]">{proofStep || 'Generating UltraPlonk Proof...'}</span>
                    </>
                  ) : (
                    <>
                      <Zap size={16} className="text-white" />
                      <span>
                        {transferMode === 'escrow' ? `Lock ${selectedToken} in Escrow` : `Send Shielded ${selectedToken}`}
                      </span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>

      {/* Recipient Picker sub-modal */}
      <AnimatePresence>
        {showRecipientPicker && (
          <ZkRecipientPicker
            senderAddress={myAddress}
            onSelect={(handle) => {
              setRecipientTag(handle);
              setShowRecipientPicker(false);
            }}
            onClose={() => setShowRecipientPicker(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
};
