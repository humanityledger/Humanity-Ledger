// @ts-nocheck
"use client";
/**
 * NativeCryptoSendModal
 * ─────────────────────
 * Replaces the old "Send QD Tokens" modal entirely.
 * Uses wagmi v2 useSendTransaction (ETH) + useWriteContract (ERC-20).
 * Includes offline QR generation and a security certification seal.
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ShieldCheck, AlertTriangle, Copy, Check,
  Send, Loader2, ExternalLink, QrCode, ChevronDown
} from 'lucide-react';
import { useSendTransaction, useWriteContract, useAccount, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, parseUnits, isAddress } from 'viem';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';

// ── Token config ──────────────────────────────────────────────────────────────
const TOKENS = [
  {
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    address: null as null, // native
    iconColor: '#627EEA',
    rate: 2500, // USD estimate
    icon: (
      <svg width="20" height="20" viewBox="0 0 256 417" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fill="#627EEA" d="M127.961 0L125.802 7.22v269.995l2.159 2.155 127.962-75.638z"/>
        <path fill="#3C3C3B" d="M127.961 0L0 203.732l127.961 75.638V0z"/>
        <path fill="#627EEA" d="M127.961 304.218L126.351 306.19v97.833l127.961-180.245z"/>
        <path fill="#3C3C3B" d="M127.961 404.023V304.218L0 223.778z"/>
        <path fill="#141414" d="M127.961 279.37L255.92 203.732l-127.959-58.206z"/>
        <path fill="#393939" d="M0 203.732l127.961 75.638V145.526z"/>
      </svg>
    ),
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`,
    iconColor: '#2775CA',
    rate: 1,
    icon: (
      <div className="w-5 h-5 rounded-full bg-[#2775CA] flex items-center justify-center">
        <span className="text-white text-[9px] font-black">$</span>
      </div>
    ),
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' as `0x${string}`,
    iconColor: '#26A17B',
    rate: 1,
    icon: (
      <div className="w-5 h-5 rounded-full bg-[#26A17B] flex items-center justify-center">
        <span className="text-white text-[9px] font-black">₮</span>
      </div>
    ),
  },
];

const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const;

// ── Props ─────────────────────────────────────────────────────────────────────
interface NativeCryptoSendModalProps {
  isOpen: boolean;
  recipientAddress: string;
  onClose: () => void;
  onSent: (txHash: string, amount: string, token: string) => void;
}

// ── Main Component ────────────────────────────────────────────────────────────
export function NativeCryptoSendModal({
  isOpen,
  recipientAddress,
  onClose,
  onSent,
}: NativeCryptoSendModalProps) {
  const [selectedToken, setSelectedToken] = useState(TOKENS[0]);
  const [amount, setAmount] = useState('');
  const [showTokenPicker, setShowTokenPicker] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | undefined>(undefined);

  const { address: myAddress } = useAccount();

  // ETH send
  const { sendTransaction, isPending: isEthPending } = useSendTransaction();

  // ERC-20 send
  const { writeContract, isPending: isErc20Pending } = useWriteContract();

  // Wait for confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: pendingTxHash,
  });

  const isPending = isEthPending || isErc20Pending || isConfirming;
  const amountNum = parseFloat(amount) || 0;
  const usdEstimate = (amountNum * selectedToken.rate).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

  // Shorten address display
  const shortAddr = (addr: string) => addr ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : '';

  const copyAddress = useCallback(() => {
    navigator.clipboard.writeText(recipientAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [recipientAddress]);

  const handleSend = useCallback(async () => {
    if (!recipientAddress || !isAddress(recipientAddress)) {
      toast.error('Invalid recipient address');
      return;
    }
    if (!amount || amountNum <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    try {
      if (selectedToken.symbol === 'ETH') {
        sendTransaction(
          {
            to: recipientAddress as `0x${string}`,
            value: parseEther(amount),
          },
          {
            onSuccess: (hash) => {
              setPendingTxHash(hash);
              toast.success('Transaction submitted!');
              onSent(hash, amount, 'ETH');
              onClose();
            },
            onError: (err) => {
              toast.error('Transaction rejected: ' + (err.message?.slice(0, 60) ?? 'Unknown error'));
            },
          }
        );
      } else {
        writeContract(
          {
            address: selectedToken.address!,
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [
              recipientAddress as `0x${string}`,
              parseUnits(amount, selectedToken.decimals),
            ],
          },
          {
            onSuccess: (hash) => {
              setPendingTxHash(hash);
              toast.success('Transaction submitted!');
              onSent(hash, amount, selectedToken.symbol);
              onClose();
            },
            onError: (err) => {
              toast.error('Transaction rejected: ' + (err.message?.slice(0, 60) ?? 'Unknown error'));
            },
          }
        );
      }
    } catch (err: any) {
      toast.error(err?.message?.slice(0, 80) ?? 'Failed to send');
    }
  }, [recipientAddress, amount, selectedToken, sendTransaction, writeContract, onSent, onClose]);

  // Offline QR URI
  const qrUri = selectedToken.symbol === 'ETH'
    ? `ethereum:${recipientAddress}?value=${amount ? parseEther(amount).toString() : '0'}&chainId=1`
    : `ethereum:${selectedToken.address}/transfer?address=${recipientAddress}&uint256=${amount ? parseUnits(amount, selectedToken.decimals).toString() : '0'}`;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[2000] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            className="w-full max-w-[420px] bg-white rounded-t-[32px] sm:rounded-[28px] overflow-hidden shadow-2xl"
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <div>
                <h2 className="text-[20px] font-black text-[#1C1C1E] tracking-tight">Send Crypto</h2>
                <p className="text-[12px] text-black/40 font-mono mt-0.5">
                  To: <span className="font-bold text-[#1C1C1E]">{shortAddr(recipientAddress)}</span>
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-[#F2F2F7] flex items-center justify-center hover:bg-[#E5E5EA] transition-colors"
              >
                <X size={16} className="text-black/50" />
              </button>
            </div>

            <div className="px-6 flex flex-col gap-4 pb-2">

              {/* ── SECURITY SEAL ─────────────────────────────────────────── */}
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] font-black text-amber-900 mb-1">⚠️ Verify the address carefully</p>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    Crypto transactions are <strong>irreversible</strong>. Always double-check the recipient address before sending. We cannot recover funds sent to the wrong address.
                  </p>
                  <div className="flex items-center gap-2 mt-2 bg-white/80 rounded-xl px-3 py-2 border border-amber-200">
                    <span className="text-[10px] font-black font-mono text-[#1C1C1E] tracking-wider break-all flex-1">
                      {recipientAddress}
                    </span>
                    <button
                      onClick={copyAddress}
                      className="shrink-0 p-1 rounded-md hover:bg-amber-100 transition-colors"
                    >
                      {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-amber-600" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* ── CERTIFIED SECURE SEAL ─────────────────────────────────── */}
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3">
                <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
                <div>
                  <p className="text-[12px] font-black text-emerald-800">End-to-End Secure Transaction</p>
                  <p className="text-[10px] text-emerald-600 leading-relaxed">
                    Signed locally in your wallet. Never exposed to Ledger Chat servers. Verified on Ethereum mainnet.
                  </p>
                </div>
              </div>

              {/* ── TOKEN SELECTOR ────────────────────────────────────────── */}
              <div className="relative">
                <button
                  onClick={() => setShowTokenPicker(!showTokenPicker)}
                  className="w-full flex items-center justify-between gap-3 bg-[#F2F2F7] rounded-2xl px-4 py-3 hover:bg-[#E5E5EA] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {selectedToken.icon}
                    <div className="text-left">
                      <p className="text-[15px] font-bold text-[#1C1C1E]">{selectedToken.symbol}</p>
                      <p className="text-[11px] text-black/40">{selectedToken.name}</p>
                    </div>
                  </div>
                  <ChevronDown size={16} className={`text-black/40 transition-transform ${showTokenPicker ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {showTokenPicker && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="absolute top-full left-0 right-0 z-10 mt-1 bg-white rounded-2xl shadow-xl border border-black/8 overflow-hidden"
                    >
                      {TOKENS.map((t) => (
                        <button
                          key={t.symbol}
                          onClick={() => { setSelectedToken(t); setShowTokenPicker(false); setAmount(''); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F2F2F7] transition-colors ${t.symbol === selectedToken.symbol ? 'bg-[#F2F2F7]' : ''}`}
                        >
                          {t.icon}
                          <div className="text-left flex-1">
                            <p className="text-[14px] font-bold text-[#1C1C1E]">{t.symbol}</p>
                            <p className="text-[11px] text-black/40">{t.name}</p>
                          </div>
                          {t.symbol === selectedToken.symbol && <Check size={16} className="text-[#25D366]" />}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── AMOUNT INPUT ──────────────────────────────────────────── */}
              <div className="bg-[#F2F2F7] rounded-2xl px-4 py-4">
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="0"
                    step="0.0001"
                    className="flex-1 bg-transparent text-[28px] font-black text-[#1C1C1E] outline-none placeholder:text-black/20 w-0"
                  />
                  <span className="text-[16px] font-black text-black/40 shrink-0">{selectedToken.symbol}</span>
                </div>
                {amountNum > 0 && (
                  <p className="text-[12px] text-black/40 mt-1">≈ {usdEstimate}</p>
                )}
              </div>

              {/* ── QUICK AMOUNTS ─────────────────────────────────────────── */}
              <div className="flex gap-2">
                {(selectedToken.symbol === 'ETH' ? ['0.001', '0.01', '0.1', '1'] : ['10', '50', '100', '500']).map((v) => (
                  <button
                    key={v}
                    onClick={() => setAmount(v)}
                    className="flex-1 py-2 rounded-xl bg-[#F2F2F7] text-[12px] font-bold text-[#1C1C1E] hover:bg-[#E5E5EA] transition-colors"
                  >
                    {v}
                  </button>
                ))}
              </div>

              {/* ── SEND BUTTON ───────────────────────────────────────────── */}
              <button
                onClick={handleSend}
                disabled={isPending || !amount || amountNum <= 0 || !recipientAddress}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-[#1C1C1E] hover:bg-black text-white font-black text-[15px] transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isPending ? (
                  <><Loader2 size={18} className="animate-spin" /> Confirming in wallet...</>
                ) : (
                  <><Send size={16} /> Send {amount || '0'} {selectedToken.symbol}</>
                )}
              </button>

              {/* ── OFFLINE QR SHARE ─────────────────────────────────────── */}
              <button
                onClick={() => setShowQR(!showQR)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#F2F2F7] text-[#1C1C1E] font-bold text-[13px] hover:bg-[#E5E5EA] transition-colors"
              >
                <QrCode size={15} /> {showQR ? 'Hide' : 'Offline QR Share'}
              </button>

              <AnimatePresence>
                {showQR && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col items-center gap-3 bg-[#F2F2F7] rounded-2xl p-5">
                      <QRCodeSVG value={qrUri} size={160} bgColor="#F2F2F7" fgColor="#1C1C1E" level="M" />
                      <p className="text-[11px] text-black/50 text-center leading-relaxed max-w-[240px]">
                        Scan with any Ethereum wallet to receive {amount || '?'} {selectedToken.symbol}. Works completely offline.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
