// @ts-nocheck
"use client";

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2, ChevronDown, QrCode, ExternalLink, AlertCircle } from 'lucide-react';
import { useSendTransaction, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { parseEther, parseUnits } from 'viem';
import { toast } from 'sonner';
import { OfflineCryptoShare } from './OfflineCryptoShare';

// ERC-20 ABI for transfer
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

// Token config
const TOKENS = {
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    address: null as `0x${string}` | null,
    icon: 'Ξ',
    usdRate: 2500,
    color: '#627EEA',
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`,
    icon: '$',
    usdRate: 1,
    color: '#2775CA',
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' as `0x${string}`,
    icon: '$',
    usdRate: 1,
    color: '#26A17B',
  },
} as const;

type TokenKey = keyof typeof TOKENS;

interface NativeCryptoSendProps {
  recipientAddress: string;
  onClose: () => void;
  onSent: (txHash: string, amount: string, token: string) => void;
}

function shortenAddr(addr: string) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function NativeCryptoSend({ recipientAddress, onClose, onSent }: NativeCryptoSendProps) {
  const { address: myAddress } = useAccount();
  const [selectedToken, setSelectedToken] = useState<TokenKey>('ETH');
  const [amount, setAmount] = useState('');
  const [showTokenMenu, setShowTokenMenu] = useState(false);
  const [showOfflineShare, setShowOfflineShare] = useState(false);
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | undefined>(undefined);

  const token = TOKENS[selectedToken];
  const usdEstimate = amount && !isNaN(Number(amount))
    ? `~$${(Number(amount) * token.usdRate).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
    : null;

  // ETH send
  const {
    sendTransaction,
    isPending: isEthPending,
    data: ethTxHash,
  } = useSendTransaction();

  // ERC-20 send
  const {
    writeContract,
    isPending: isErc20Pending,
    data: erc20TxHash,
  } = useWriteContract();

  const activeTxHash = pendingTxHash || ethTxHash || erc20TxHash;
  const isSending = isEthPending || isErc20Pending;

  // Wait for receipt
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: activeTxHash,
    query: { enabled: !!activeTxHash },
  });

  React.useEffect(() => {
    if (isConfirmed && activeTxHash) {
      toast.success('Transaction confirmed!', {
        description: `${amount} ${selectedToken} sent`,
        action: {
          label: 'View on Etherscan',
          onClick: () => window.open(`https://etherscan.io/tx/${activeTxHash}`, '_blank'),
        },
      });
      onSent(activeTxHash, amount, selectedToken);
    }
  }, [isConfirmed, activeTxHash]);

  const handleSend = useCallback(async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (!recipientAddress?.startsWith('0x') || recipientAddress.length !== 42) {
      toast.error('Invalid recipient address');
      return;
    }

    try {
      if (selectedToken === 'ETH') {
        sendTransaction(
          {
            to: recipientAddress as `0x${string}`,
            value: parseEther(amount),
          },
          {
            onError: (err: any) => {
              const msg = err?.message || '';
              if (msg.toLowerCase().includes('reject') || msg.toLowerCase().includes('denied') || err?.code === 4001) {
                toast.error('Transaction rejected by wallet');
              } else {
                toast.error(`Failed: ${msg.slice(0, 80)}`);
              }
            },
            onSuccess: (hash) => {
              setPendingTxHash(hash);
            },
          }
        );
      } else {
        const tokenConfig = TOKENS[selectedToken];
        if (!tokenConfig.address) return;

        writeContract(
          {
            address: tokenConfig.address,
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [
              recipientAddress as `0x${string}`,
              parseUnits(amount, tokenConfig.decimals),
            ],
          },
          {
            onError: (err: any) => {
              const msg = err?.message || '';
              if (msg.toLowerCase().includes('reject') || msg.toLowerCase().includes('denied') || err?.code === 4001) {
                toast.error('Transaction rejected by wallet');
              } else {
                toast.error(`Failed: ${msg.slice(0, 80)}`);
              }
            },
            onSuccess: (hash) => {
              setPendingTxHash(hash);
            },
          }
        );
      }
    } catch (err: any) {
      toast.error(err?.message?.slice(0, 100) || 'Transaction failed');
    }
  }, [amount, selectedToken, recipientAddress, sendTransaction, writeContract]);

  const isLoading = isSending || isConfirming;

  if (showOfflineShare) {
    return (
      <OfflineCryptoShare
        myAddress={myAddress || '0x0000000000000000000000000000000000000000'}
        amount={amount || '0'}
        token={selectedToken === 'ETH' ? 'ETH' : 'USDC'}
        onClose={() => setShowOfflineShare(false)}
      />
    );
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 38, mass: 0.9 }}
        className="fixed bottom-0 left-0 right-0 z-[201] bg-white rounded-t-[28px] shadow-2xl overflow-hidden"
        style={{ maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-black/10 rounded-full mx-auto mt-3 mb-2" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-4 pt-1 border-b border-black/[0.06]">
          <div>
            <h2 className="text-[18px] font-bold text-gray-900">Send Crypto</h2>
            <p className="text-[12px] text-gray-500 font-mono mt-0.5">
              To: {shortenAddr(recipientAddress)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X size={16} className="text-gray-600" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* Token Selector */}
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">Token</label>
            <div className="relative">
              <button
                onClick={() => setShowTokenMenu((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: token.color }}
                  >
                    {token.icon}
                  </div>
                  <div className="text-left">
                    <p className="text-[15px] font-semibold text-gray-900">{token.symbol}</p>
                    <p className="text-[11px] text-gray-400">{token.name}</p>
                  </div>
                </div>
                <ChevronDown size={18} className={`text-gray-400 transition-transform ${showTokenMenu ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {showTokenMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl z-10 overflow-hidden"
                  >
                    {(Object.keys(TOKENS) as TokenKey[]).map((key) => {
                      const t = TOKENS[key];
                      return (
                        <button
                          key={key}
                          onClick={() => { setSelectedToken(key); setShowTokenMenu(false); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${selectedToken === key ? 'bg-[#25D366]/5' : ''}`}
                        >
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                            style={{ backgroundColor: t.color }}
                          >
                            {t.icon}
                          </div>
                          <div className="text-left">
                            <p className="text-[14px] font-semibold text-gray-900">{t.symbol}</p>
                            <p className="text-[11px] text-gray-400">{t.name}</p>
                          </div>
                          {selectedToken === key && (
                            <div className="ml-auto w-5 h-5 rounded-full bg-[#25D366] flex items-center justify-center">
                              <div className="w-2 h-2 rounded-full bg-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">Amount</label>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-[22px] font-bold text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#25D366]/40 focus:border-[#25D366] pr-16"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-gray-400">
                {selectedToken}
              </span>
            </div>
            {usdEstimate && (
              <p className="text-[12px] text-gray-400 mt-1.5 ml-1">{usdEstimate} USD</p>
            )}
          </div>

          {/* Recipient */}
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-2xl border border-gray-200">
            <div className="w-8 h-8 rounded-full bg-[#25D366]/10 flex items-center justify-center">
              <Send size={14} className="text-[#25D366]" />
            </div>
            <div>
              <p className="text-[11px] text-gray-400 font-medium">Recipient</p>
              <p className="text-[13px] font-mono text-gray-700">{shortenAddr(recipientAddress)}</p>
            </div>
          </div>

          {/* Status indicators */}
          {isConfirming && activeTxHash && (
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 rounded-2xl border border-amber-200">
              <Loader2 size={16} className="text-amber-500 animate-spin" />
              <div>
                <p className="text-[13px] font-semibold text-amber-700">Confirming on-chain...</p>
                <a
                  href={`https://etherscan.io/tx/${activeTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-amber-500 flex items-center gap-1 hover:underline"
                >
                  View on Etherscan <ExternalLink size={10} />
                </a>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-1">
            {/* Offline QR Share */}
            <button
              onClick={() => setShowOfflineShare(true)}
              className="flex-1 py-3.5 bg-gray-100 text-gray-700 rounded-2xl font-semibold text-[14px] flex items-center justify-center gap-2 hover:bg-gray-200 active:scale-[0.98] transition-all"
            >
              <QrCode size={16} />
              Offline QR
            </button>

            {/* Send Button */}
            <button
              onClick={handleSend}
              disabled={isLoading || !amount || Number(amount) <= 0}
              className="flex-2 flex-grow py-3.5 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg"
              style={{
                background: isLoading ? '#aaa' : 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                boxShadow: isLoading ? 'none' : '0 4px 20px rgba(37, 211, 102, 0.35)',
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {isConfirming ? 'Confirming...' : 'Sending...'}
                </>
              ) : (
                <>
                  <Send size={16} />
                  Send {selectedToken}
                </>
              )}
            </button>
          </div>

          {/* Disclaimer */}
          <div className="flex items-start gap-2 px-1">
            <AlertCircle size={12} className="text-gray-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Transactions are irreversible. Verify the recipient address before sending. Gas fees apply.
            </p>
          </div>
        </div>
      </motion.div>
    </>
  );
}
