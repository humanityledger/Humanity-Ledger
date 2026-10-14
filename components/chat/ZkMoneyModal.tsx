'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, X, Check, ExternalLink, Zap, EyeOff, Sparkles, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  formatZkTag,
  resolveZkTag,
  getShieldedBalances,
  executeShieldedPayment,
  encodeZkPaymentPayload,
  ZkPaymentResult,
  ZkShieldedBalance
} from '@/lib/zk/zkMoney';

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
  const [selectedToken, setSelectedToken] = useState<'DAI' | 'USDC' | 'ETH'>('DAI');
  const [recipientTag, setRecipientTag] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [balances, setBalances] = useState<ZkShieldedBalance>({
    dai: '2,500.00',
    usdc: '1,000.00',
    eth: '0.450',
    lastUpdated: Date.now()
  });
  const [loading, setLoading] = useState(false);
  const [proofStep, setProofStep] = useState<string>('');
  const [completedTx, setCompletedTx] = useState<ZkPaymentResult | null>(null);

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
      setProofStep('');
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

  const handleSend = async () => {
    const numAmount = parseFloat(amount.replace(/,/g, ''));
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
      const result = await executeShieldedPayment(
        {
          senderAddress: myAddress,
          recipientTag,
          recipientAddress,
          amount,
          token: selectedToken,
          memo: memo.trim() || undefined
        },
        step => setProofStep(step)
      );

      setCompletedTx(result);
      const payload = encodeZkPaymentPayload(result);
      toast.success(`Shielded ${amount} ${selectedToken} transfer complete!`);
      onSuccess(payload, result);
    } catch (err: any) {
      toast.error('Shielded transfer failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-md bg-white rounded-[24px] shadow-2xl overflow-hidden border border-black/[0.08]"
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 bg-gradient-to-br from-[#1C1C1E] to-[#2C2C2E] text-white">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white"
          >
            <X size={16} />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#8B5CF6] to-[#10B981] flex items-center justify-center shadow-md">
              <Shield size={18} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-[17px] font-bold text-white tracking-tight">zk.money</h3>
                <span className="text-[10px] font-black uppercase tracking-wider bg-[#10B981]/20 text-[#34D399] px-2 py-0.5 rounded-full border border-[#10B981]/30">
                  Aztec Rollup
                </span>
              </div>
              <p className="text-[12px] text-white/70">Private Stablecoin Payments</p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between p-2.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
            <div className="flex items-center gap-2">
              <Lock size={13} className="text-[#34D399]" />
              <span className="text-[12px] text-white/80 font-medium">Shielded Balance</span>
            </div>
            <span className="text-[14px] font-bold font-mono text-white">
              {currentBalance} {selectedToken}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {completedTx ? (
            /* Success State */
            <div className="py-4 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#10B981]/15 text-[#10B981] mx-auto flex items-center justify-center">
                <Check size={32} />
              </div>
              <div>
                <h4 className="text-[18px] font-bold text-[#1C1C1E]">Private Transfer Sent</h4>
                <p className="text-[13px] text-[#8E8E93] mt-1">
                  {completedTx.amount} {completedTx.token} transferred to{' '}
                  <span className="font-mono font-semibold text-[#1C1C1E]">
                    {completedTx.recipientTag}
                  </span>
                </p>
              </div>

              <div className="p-3 bg-[#F2F2F7] rounded-xl text-left space-y-1.5 text-[12px] font-mono">
                <div className="flex justify-between text-[#8E8E93]">
                  <span>Status:</span>
                  <span className="text-[#10B981] font-bold">Shielded Note Created</span>
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

              {/* Recipient Tag */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8E8E93] mb-1.5">
                  Recipient zk.money Tag
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={recipientTag}
                    onChange={e => setRecipientTag(e.target.value)}
                    placeholder="zk:username or 0x..."
                    className="w-full bg-[#F2F2F7] rounded-xl px-4 py-2.5 text-[14px] font-mono text-[#1C1C1E] outline-none focus:ring-2 focus:ring-[#10B981] transition-all"
                  />
                  <div className="absolute right-3 top-2.5">
                    <Shield size={16} className="text-[#10B981]" />
                  </div>
                </div>
                <p className="text-[11px] text-[#8E8E93] mt-1">
                  Resolved via Humanity Ledger sovereign identity mapping
                </p>
              </div>

              {/* Amount */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#8E8E93]">
                    Amount
                  </label>
                  <button
                    type="button"
                    onClick={() => setAmount(currentBalance.replace(/,/g, ''))}
                    className="text-[11px] font-bold text-[#10B981] hover:underline"
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
                    className="w-full bg-[#F2F2F7] rounded-xl px-4 py-2.5 text-[16px] font-bold text-[#1C1C1E] outline-none focus:ring-2 focus:ring-[#10B981] transition-all"
                  />
                  <span className="absolute right-4 top-2.5 text-[14px] font-bold text-[#8E8E93]">
                    {selectedToken}
                  </span>
                </div>
              </div>

              {/* Memo */}
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
                  className="w-full bg-[#F2F2F7] rounded-xl px-4 py-2 text-[13px] text-[#1C1C1E] outline-none focus:ring-2 focus:ring-[#10B981] transition-all"
                />
              </div>

              {/* Privacy Guarantee Box */}
              <div className="p-3.5 bg-[#F9F9FB] border border-black/[0.06] rounded-xl space-y-1.5">
                <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#1C1C1E]">
                  <EyeOff size={13} className="text-[#8B5CF6]" />
                  <span>Aztec Zero-Knowledge Privacy Guarantee</span>
                </div>
                <p className="text-[11px] text-[#8E8E93] leading-relaxed">
                  Your identity, transfer value, and note remain confidential. No public Ethereum address or transaction amounts are exposed on-chain.
                </p>
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
                    <span>{proofStep || 'Generating UltraPlonk Proof...'}</span>
                  </>
                ) : (
                  <>
                    <Zap size={16} className="text-[#34D399]" />
                    <span>Send Shielded {selectedToken}</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};
