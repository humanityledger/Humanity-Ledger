"use client";
/**
 * NativeCryptoSendModal
 * ─────────────────────
 * Public payments on Ethereum mainnet from the user's own wallet (ETH, USDC,
 * USDT, DAI). Every token here is an Ethereum mainnet contract, so:
 *
 *  - the wallet must be on chain 1; otherwise the modal asks to switch and
 *    sends nothing (on another chain "ETH" would be that chain's coin and the
 *    token addresses would point at unrelated contracts);
 *  - ETH sends keep balance >= amount + 1.25 x estimated gas, and token sends
 *    need enough ETH for 1.25 x their gas (lib/payments/rails.ts);
 *  - one submission at a time (a ref lock, not just a disabled button);
 *  - the chat is told only after the transaction is MINED and succeeded, so
 *    a reverted or dropped transfer is never announced as paid.
 *
 * No USD estimate is shown: there is no price feed here, and a fixed rate
 * (the old "rate: 2500" for ETH) is an invented number.
 *
 * Used directly from the chat and as the public rail for invoices
 * (ZkInvoiceModal), which pre-fills the amount and token.
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { X, Lock, AlertTriangle, Copy, Check, Send, QrCode, ChevronDown } from 'lucide-react';
import { useSendTransaction, useWriteContract, useAccount, useChainId, useSwitchChain, usePublicClient, useBalance, useReadContract } from 'wagmi';
import { isAddress, encodeFunctionData, formatUnits, type Address } from 'viem';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { checkEvmSend, parseAmount } from '@/lib/payments/rails';

const MAINNET = 1;

// ── Token config ──────────────────────────────────────────────────────────────
const TOKENS = [
  {
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    address: null as Address | null, // native
    iconColor: '#627EEA',
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
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address | null,
    iconColor: '#2775CA',
    icon: (
      <div className="w-5 h-5 rounded-full bg-[#2775CA] flex items-center justify-center">
        <span className="text-white text-[12px] font-semibold">$</span>
      </div>
    ),
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' as Address | null,
    iconColor: '#26A17B',
    icon: (
      <div className="w-5 h-5 rounded-full bg-[#26A17B] flex items-center justify-center">
        <span className="text-white text-[12px] font-semibold">₮</span>
      </div>
    ),
  },
  {
    symbol: 'DAI',
    name: 'Dai',
    decimals: 18,
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F' as Address | null,
    iconColor: '#F5AC37',
    icon: (
      <div className="w-5 h-5 rounded-full bg-[#F5AC37] flex items-center justify-center">
        <span className="text-white text-[11px] font-semibold">D</span>
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
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'a', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

// ── Props ─────────────────────────────────────────────────────────────────────
interface NativeCryptoSendModalProps {
  isOpen: boolean;
  recipientAddress: string;
  onClose: () => void;
  onSent: (txHash: string, amount: string, token: string) => void;
  /** Settings → Payments → Default payment token (ETH, USDC, USDT or DAI). */
  defaultToken?: string;
  /** Pre-filled amount (decimal string), e.g. an invoice total. */
  presetAmount?: string;
  /** When set, the amount and token cannot be edited (invoice settlement). */
  lockAmount?: boolean;
  title?: string;
}

// ── Main Component ────────────────────────────────────────────────────────────
export function NativeCryptoSendModal({
  isOpen,
  recipientAddress,
  onClose,
  onSent,
  defaultToken,
  presetAmount,
  lockAmount = false,
  title = 'Send Crypto',
}: NativeCryptoSendModalProps) {
  const [selectedToken, setSelectedToken] = useState(() => TOKENS.find(t => t.symbol === defaultToken) ?? TOKENS[0]);
  const [amount, setAmount] = useState(presetAmount ?? '');
  const [showTokenPicker, setShowTokenPicker] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);

  const { address: myAddress, isConnected } = useAccount();
  const walletChainId = useChainId();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: MAINNET });
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();
  const { data: ethBal, refetch: refetchEth } = useBalance({ address: myAddress, chainId: MAINNET, query: { enabled: !!myAddress } });
  const { data: tokenBal, refetch: refetchToken } = useReadContract({
    address: selectedToken.address ?? undefined,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: myAddress ? [myAddress] : undefined,
    chainId: MAINNET,
    query: { enabled: !!myAddress && !!selectedToken.address },
  });

  // Idempotency: a ref, so two taps in the same frame cannot both pass.
  const submittingRef = useRef(false);
  const [phase, setPhase] = useState<'idle' | 'checking' | 'signing' | 'confirming'>('idle');
  const [problem, setProblem] = useState<string | null>(null);

  const isPending = phase !== 'idle';
  const units = useMemo(() => parseAmount(amount, selectedToken.decimals), [amount, selectedToken.decimals]);
  const wrongChain = isConnected && walletChainId !== MAINNET;
  const heldText = selectedToken.address
    ? (typeof tokenBal === 'bigint' ? formatUnits(tokenBal, selectedToken.decimals) : '…')
    : (ethBal ? formatUnits(ethBal.value, 18) : '…');

  // Shorten address display
  const shortAddr = (addr: string) => addr ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : '';

  const copyAddress = useCallback(() => {
    navigator.clipboard?.writeText(recipientAddress).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [recipientAddress]);

  const handleSend = useCallback(async () => {
    if (submittingRef.current) return;
    setProblem(null);
    if (!recipientAddress || !isAddress(recipientAddress)) {
      setProblem('Invalid recipient address');
      return;
    }
    if (!units || units <= 0n) {
      setProblem('Enter a valid amount');
      return;
    }
    if (!publicClient || !myAddress) {
      setProblem('Connect your wallet first');
      return;
    }
    submittingRef.current = true;
    try {
      setPhase('checking');
      const to = recipientAddress as Address;
      const isNative = !selectedToken.address;
      const data = isNative ? undefined : encodeFunctionData({ abi: ERC20_ABI, functionName: 'transfer', args: [to, units] });
      const [gasLimit, fees, ethBalance, tokenBalance] = await Promise.all([
        publicClient.estimateGas({ account: myAddress, to: isNative ? to : selectedToken.address!, value: isNative ? units : 0n, data }),
        publicClient.estimateFeesPerGas(),
        publicClient.getBalance({ address: myAddress }),
        isNative ? Promise.resolve(undefined) : publicClient.readContract({ address: selectedToken.address!, abi: ERC20_ABI, functionName: 'balanceOf', args: [myAddress] }),
      ]);
      const check = checkEvmSend({
        kind: isNative ? 'native' : 'erc20',
        amount: units,
        ethBalance,
        tokenBalance: tokenBalance as bigint | undefined,
        gasLimit,
        maxFeePerGas: fees.maxFeePerGas,
        walletChainId,
        targetChainId: MAINNET,
        recipient: to,
        sender: myAddress,
      });
      if (!check.ok) {
        setProblem(check.reason);
        return;
      }

      setPhase('signing');
      const hash = isNative
        ? await sendTransactionAsync({ to, value: units, chainId: MAINNET })
        : await writeContractAsync({ address: selectedToken.address!, abi: ERC20_ABI, functionName: 'transfer', args: [to, units], chainId: MAINNET });

      setPhase('confirming');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') {
        setProblem('The transfer reverted on Ethereum. No funds were moved.');
        return;
      }
      toast.success('Payment confirmed on Ethereum');
      refetchEth();
      refetchToken();
      onSent(hash, amount.trim(), selectedToken.symbol);
      onClose();
    } catch (err: unknown) {
      const e = err as { shortMessage?: string; message?: string };
      const msg = String(e?.shortMessage || e?.message || '');
      setProblem(/user (rejected|denied)|rejected the request/i.test(msg) ? 'You cancelled in your wallet. Nothing was sent.' : msg.slice(0, 160) || 'Failed to send');
    } finally {
      submittingRef.current = false;
      setPhase('idle');
    }
  }, [recipientAddress, units, amount, selectedToken, publicClient, myAddress, walletChainId, sendTransactionAsync, writeContractAsync, onSent, onClose, refetchEth, refetchToken]);

  // Offline QR URI
  // EIP-681. Built from the parsed amount, so a half-typed value never throws during render.
  const qrUnits = (units ?? 0n).toString();
  const qrUri = selectedToken.symbol === 'ETH'
    ? `ethereum:${recipientAddress}@1?value=${qrUnits}`
    : `ethereum:${selectedToken.address}@1/transfer?address=${recipientAddress}&uint256=${qrUnits}`;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black/50 flex items-end sm:items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="send-title"
    >
      <div
        className="w-full max-w-[420px] bg-white rounded-t-[28px] sm:rounded-[24px] overflow-hidden border border-[#E4E7EC]"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <h2 id="send-title" className="text-[20px] font-semibold text-[#15171C] tracking-tight">{title}</h2>
            <p className="text-[12px] text-[#475467] tabular-nums mt-0.5">
              To: <span className="font-semibold text-[#15171C]">{shortAddr(recipientAddress)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 rounded-full bg-[#F7F8FA] flex items-center justify-center hover:bg-[#EFF1F4] transition-colors duration-150 ease-out"
          >
            <X size={16} strokeWidth={1.75} className="text-[#475467]" />
          </button>
        </div>

        <div className="px-6 flex flex-col gap-4 pb-2">
          {/* Recipient check */}
          <div className="flex items-start gap-3 bg-[#F7F8FA] border border-[#E4E7EC] rounded-2xl p-4">
            <AlertTriangle size={18} strokeWidth={1.75} className="text-[#15171C] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#15171C] mb-1">Check the address</p>
              <p className="text-[12.5px] text-[#475467] leading-relaxed">
                Ethereum transfers cannot be reversed. Funds sent to a wrong address cannot be recovered.
              </p>
              <div className="flex items-center gap-2 mt-2 bg-white rounded-xl pl-3 border border-[#E4E7EC]">
                <span className="text-[12px] font-semibold tabular-nums text-[#15171C] break-all flex-1">{recipientAddress}</span>
                <button
                  type="button"
                  onClick={copyAddress}
                  aria-label="Copy address"
                  className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center hover:bg-[#F7F8FA] transition-colors duration-150 ease-out"
                >
                  {copied ? <Check size={14} strokeWidth={1.75} className="text-[#166534]" /> : <Copy size={14} strokeWidth={1.75} className="text-[#475467]" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-[#F7F8FA] border border-[#E4E7EC] rounded-2xl px-4 py-3">
            <Lock size={16} strokeWidth={1.75} className="text-[#15171C] shrink-0" />
            <div>
              <p className="text-[12px] font-semibold text-[#15171C]">Public payment on Ethereum mainnet</p>
              <p className="text-[12px] text-[#475467] leading-relaxed">
                Signed in your own wallet. Anyone can see the amount, your address and the recipient on Ethereum.
              </p>
            </div>
          </div>

          {/* Token */}
          <div className="relative">
            <button
              type="button"
              onClick={() => !lockAmount && setShowTokenPicker(!showTokenPicker)}
              disabled={lockAmount}
              aria-expanded={showTokenPicker}
              className="w-full min-h-[44px] flex items-center justify-between gap-3 bg-[#F7F8FA] border border-[#E4E7EC] rounded-2xl px-4 py-3 hover:bg-[#EFF1F4] transition-colors duration-150 ease-out"
            >
              <div className="flex items-center gap-3">
                {selectedToken.icon}
                <div className="text-left">
                  <p className="text-[15px] font-semibold text-[#15171C]">{selectedToken.symbol}</p>
                  <p className="text-[12.5px] text-[#475467]">{selectedToken.name}</p>
                </div>
              </div>
              <ChevronDown size={16} strokeWidth={1.75} className={`text-[#475467] ${showTokenPicker ? 'rotate-180' : ''}`} />
            </button>
            {showTokenPicker && (
              <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white rounded-2xl shadow-sm border border-[#E4E7EC] overflow-hidden">
                {TOKENS.map((t) => (
                  <button
                    key={t.symbol}
                    type="button"
                    onClick={() => { setSelectedToken(t); setShowTokenPicker(false); setAmount(''); }}
                    className={`w-full min-h-[44px] flex items-center gap-3 px-4 py-3 hover:bg-[#F7F8FA] transition-colors duration-150 ease-out ${t.symbol === selectedToken.symbol ? 'bg-[#F7F8FA]' : ''}`}
                  >
                    {t.icon}
                    <div className="text-left flex-1">
                      <p className="text-[14px] font-semibold text-[#15171C]">{t.symbol}</p>
                      <p className="text-[12.5px] text-[#475467]">{t.name}</p>
                    </div>
                    {t.symbol === selectedToken.symbol && <Check size={16} strokeWidth={1.75} className="text-[#15171C]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Amount */}
          <div className="bg-[#F7F8FA] border border-[#E4E7EC] rounded-2xl px-4 py-4">
            <div className="flex items-center gap-3">
              <input
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                aria-label={`Amount in ${selectedToken.symbol}`}
                value={amount}
                readOnly={lockAmount}
                onChange={(e) => setAmount(e.target.value.replace(',', '.'))}
                className="flex-1 bg-transparent text-[28px] font-semibold tabular-nums text-[#15171C] outline-none placeholder:text-black/20 w-0"
              />
              <span className="text-[16px] font-semibold text-[#475467] shrink-0">{selectedToken.symbol}</span>
            </div>
            <p className="text-[12px] text-[#475467] mt-1 tabular-nums">
              You hold {heldText} {selectedToken.symbol} on Ethereum
            </p>
          </div>

          {!lockAmount && (
            <div className="flex gap-2">
              {(selectedToken.symbol === 'ETH' ? ['0.001', '0.01', '0.1', '1'] : ['10', '50', '100', '500']).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmount(v)}
                  className="flex-1 min-h-[44px] rounded-xl bg-[#F7F8FA] border border-[#E4E7EC] text-[12px] font-semibold tabular-nums text-[#15171C] hover:bg-[#EFF1F4] transition-colors duration-150 ease-out"
                >
                  {v}
                </button>
              ))}
            </div>
          )}

          {problem && (
            <p role="alert" className="text-[13px] text-[#B42318] bg-[#FFF4F4] border border-[#FFD6D6] rounded-xl px-3 py-2 flex items-start gap-2">
              <AlertTriangle size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" /> {problem}
            </p>
          )}

          {wrongChain ? (
            <button
              type="button"
              onClick={() => switchChainAsync({ chainId: MAINNET }).catch(() => setProblem('Your wallet did not switch networks.'))}
              disabled={isSwitching}
              className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-2xl bg-[#15171C] text-white font-semibold text-[15px] disabled:opacity-40"
            >
              {isSwitching ? 'Switching…' : 'Switch wallet to Ethereum mainnet'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={isPending || !units || units <= 0n || !recipientAddress || !isConnected}
              className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-2xl bg-[#15171C] text-white font-semibold text-[15px] transition-colors duration-150 ease-out disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPending ? (
                phase === 'checking' ? 'Checking balance and gas…' : phase === 'signing' ? 'Confirm in your wallet…' : 'Waiting for Ethereum…'
              ) : (
                <><Send size={16} strokeWidth={1.75} /> Send {amount || '0'} {selectedToken.symbol}</>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowQR(!showQR)}
            aria-expanded={showQR}
            className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-2xl bg-[#F7F8FA] border border-[#E4E7EC] text-[#15171C] font-semibold text-[13px] hover:bg-[#EFF1F4] transition-colors duration-150 ease-out"
          >
            <QrCode size={15} strokeWidth={1.75} /> {showQR ? 'Hide QR code' : 'Pay from another wallet (QR)'}
          </button>

          {showQR && (
            <div className="flex flex-col items-center gap-3 bg-[#F7F8FA] border border-[#E4E7EC] rounded-2xl p-5">
              <QRCodeSVG value={qrUri} size={160} bgColor="#F7F8FA" fgColor="#15171C" level="M" />
              <p className="text-[12.5px] text-[#475467] text-center leading-relaxed max-w-[260px]">
                Scan with another Ethereum wallet to pay {amount || '?'} {selectedToken.symbol} on Ethereum mainnet to this address.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
