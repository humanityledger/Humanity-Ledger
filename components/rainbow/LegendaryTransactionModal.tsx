"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "./GlassCard";
import { X, Send, Repeat, Globe, ArrowRight, Loader2, ChevronDown, Shield, Zap, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useWalletClient, usePublicClient } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useSystemAccount as useAccount } from '@/hooks/useSystemAccount';
import { encodeFunctionData, parseUnits } from "viem";
import { TokenSelector } from "@/components/wallet/TokenSelector";
import { InstitutionalErrorBoundary } from "@/components/ui/InstitutionalErrorBoundary";

import { useEliteSwap } from "@/hooks/useEliteSwap";
import { useGaslessSwap } from "@/hooks/useGaslessSwap";
import { safeToFixed, safeToLocaleString } from '@/lib/utils/number-format';

const safeParseUnits = (val: string, decimals: number) => {
    try {
        let cleanVal = val.toLowerCase();
        if (cleanVal.includes('e')) {
            const [base, expStr] = cleanVal.split('e');
            const [lead, trail = ''] = base.split('.');
            const exp = parseInt(expStr);
            if (exp > 0) {
                if (trail.length > exp) {
                    cleanVal = lead + trail.slice(0, exp) + '.' + trail.slice(exp);
                } else {
                    cleanVal = lead + trail + '0'.repeat(exp - trail.length);
                }
            } else {
                return 0n;
            }
        }
        return parseUnits(cleanVal || "0", decimals);
    } catch {
        return 0n;
    }
};

//  Design Tokens (Ivory Model) 
const BG     = "#FFFFFF";
const INK    = "#050505";
const MUTED  = "rgba(5,5,5,0.45)";
const BORDER = "rgba(5,5,5,0.08)";
const CARD   = "#FFFFFF";

interface LegendaryTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  balances: any[];
  initialMode?: "send" | "swap" | "bridge" | "buy";
  initialSubMode?: string;
  forceToken?: string;
}

const CHAINS = [
    { id: 1,     name: "Ethereum",     color: "#627EEA" },
    { id: 137,   name: "Polygon",      color: "#8247E5" },
    { id: 8453,  name: "Base",         color: "#0052FF" },
    { id: 42161, name: "Arbitrum",     color: "#12AAFF" },
    { id: 10,    name: "Optimism",     color: "#FF0420" },
    { id: 480,   name: "World Chain",  color: "#000000" },
    { id: 84532, name: "Base Sepolia", color: "#0052FF" },
];

function NetworkSelectorDropdown({ chain, setChain, label, disabled = false }: { chain: any; setChain: any; label: string; disabled?: boolean }) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false); };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    return (
        <div className="flex-1 relative" ref={ref}>
            <label className="text-[9px] font-black uppercase tracking-widest mb-1.5 block" style={{ color: MUTED }}>{label}</label>
            <button 
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`w-full border rounded-xl p-3 flex items-center justify-between hover:bg-black/[0.02] ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                style={{ borderColor: BORDER, background: CARD }}
            >
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: chain.color }} />
                    <span className="font-bold text-xs" style={{ color: INK }}>{chain.name}</span>
                </div>
                {!disabled && <ChevronDown size={14} style={{ color: MUTED }} />}
            </button>
            <AnimatePresence>
                {isOpen && !disabled && (
                    <motion.div 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute top-full left-0 mt-2 w-[220px] bg-white border border-black/10 rounded-2xl shadow-xl overflow-hidden z-[120] p-1 text-[#050505]"
                    >
                        {CHAINS.map((c) => (
                            <button
                                key={c.id}
                                onClick={() => { setChain(c); setIsOpen(false); }}
                                className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-black/5 flex items-center gap-3 transition-colors"
                            >
                                <div className="w-3 h-3 rounded-full shadow-sm" style={{ background: c.color }} />
                                <span className="font-bold text-xs">{c.name}</span>
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export function LegendaryTransactionModal({ 
    isOpen, 
    onClose, 
    balances, 
    initialMode = "send",
    initialSubMode = "standard",
    forceToken
}: LegendaryTransactionModalProps) {
  const [mode, setMode] = useState<"send" | "swap" | "bridge" | "buy">(initialMode);
  const [subMode, setSubMode] = useState<string>(initialSubMode === 'standard' && initialMode === 'buy' ? 'EUR' : initialSubMode);
  
  // Chain State
  const { address, chain } = useAccount();
  const [sourceChain, setSourceChain] = useState(CHAINS.find(c => c.id === chain?.id) || CHAINS[0]);
  const [targetChain, setTargetChain] = useState(CHAINS[2]); // Default Base

  // Asset State
  const [fromAssetSymbol, setFromAssetSymbol] = useState(balances[0]?.symbol || "ETH");
  const [fromAsset, setFromAsset] = useState<any>(balances[0] || null); 
  const [toAssetSymbol, setToAssetSymbol] = useState("USDC");
  const [toAsset, setToAsset] = useState<any>(null); 
  
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { executeSwap, resolveTokenAddress, status: orchestratorStatus } = useEliteSwap();
  const queryClient = useQueryClient();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  useEffect(() => {
    if (isOpen) {
        setMode(initialMode);
        setSubMode(initialSubMode);
        if (forceToken) {
            setFromAssetSymbol(forceToken);
            setFromAsset(balances.find(b => b.symbol === forceToken) || balances[0]);
        }
    }
  }, [isOpen, initialMode, initialSubMode, forceToken, balances]);

  useEffect(() => {
      const asset = balances.find(b => b.symbol === fromAssetSymbol);
      if (asset) {
          const targetChainId = asset.chainId;
          const chainObj = CHAINS.find(c => c.id === targetChainId);
          if (chainObj) setSourceChain(chainObj);
      }
  }, [fromAssetSymbol, balances]);

  useEffect(() => {
     if (balances.length > 0 && !fromAsset) {
         setFromAsset(balances.find(b => b.symbol === fromAssetSymbol) || balances[0]);
     }
  }, [balances, fromAsset, fromAssetSymbol]);

  // Quote Fetcher  uses Li.Fi (1inch API key is invalid)
  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0 || !isOpen || (mode !== 'swap' && mode !== 'bridge' && mode !== 'buy')) {
        setQuote(null);
        setErrorMsg(null);
        return;
    }

    const activeFromAsset = fromAsset || balances.find(b => b.symbol === fromAssetSymbol && b.chainId === sourceChain.id);
    const fetchQuote = async () => {
        try {
            setErrorMsg(null);
            
            let amountInUnits;
            try {
                amountInUnits = safeParseUnits(amount, activeFromAsset?.decimals || 18);
            } catch (err) {
                return; // Ignore invalid amounts like "."
            }
            const amountInWei = amountInUnits.toString();

            if (mode === 'buy') {
                // For buy mode, fetch live ETH/BTC/AUTH price in EUR via CoinGecko
                const coinMap: Record<string, string> = { 'ETH': 'ethereum', 'USDC': 'usd-coin', 'AUTH': 'identity-wld', 'BTC': 'bitcoin' };
                const coinId = coinMap[toAssetSymbol.toUpperCase()] || 'ethereum';
                const currency = (['USD','EUR','GBP'].includes(subMode.toUpperCase()) ? subMode : 'EUR').toLowerCase();
                try {
                    const priceRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=${currency}`);
                    const priceData = await priceRes.json();
                    const price = priceData?.[coinId]?.[currency] || 0;
                    setQuote({ price, currency });
                } catch {
                    setQuote({ price: 0, currency: subMode.toLowerCase() });
                }
                return;
            }

            // Resolve token addresses for swap/bridge
            let fromTokenAddress: string;
            let toTokenAddress: string;
            try {
                fromTokenAddress = activeFromAsset?.address || resolveTokenAddress(fromAssetSymbol, sourceChain.id);
                toTokenAddress = (toAsset?.address && toAsset.address !== '') 
                    ? toAsset.address 
                    : resolveTokenAddress(toAssetSymbol, mode === 'swap' ? sourceChain.id : targetChain.id);
            } catch (resolveErr: any) {
                setErrorMsg(`Token not found: ${resolveErr.message}`);
                return;
            }

            const walletAddr = address || '0x0000000000000000000000000000000000000001';

            // Use Li.Fi quote API directly (no API key required)
            const res = await fetch('/api/wallet/quote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromChain: sourceChain.id,
                    toChain: mode === 'swap' ? sourceChain.id : targetChain.id,
                    fromToken: fromTokenAddress,
                    toToken: toTokenAddress,
                    fromAmount: amountInWei,
                    fromAddress: walletAddr,
                })
            });
            if (res.ok) {
                const data = await res.json();
                setQuote(data);
            } else {
                const err = await res.json().catch(() => ({}));
                setErrorMsg(err.error || 'Unable to get route. Check token pair and amount.');
            }
        } catch (e: any) {
            console.error('Quote fetch failed', e);
            setErrorMsg('Network error fetching route.');
        }
    };

    const timer = setTimeout(fetchQuote, 600);
    return () => clearTimeout(timer);
  }, [amount, fromAssetSymbol, toAssetSymbol, toAsset, sourceChain, targetChain, mode, subMode, isOpen, address, balances]);

  const handleExecute = async () => {
      // --- 🔴 MiCA REGULATORY LOCK (EU Compliance) ---
      // Disable public EVM transactions (Send, Swap, Bridge, Buy) until VASP / MiCA license is acquired.
      // Note: Aztec Mainnet QDS transactions are routed via ZK Stealth UI, this blocks public EVM.
      toast.error("Regulatory Lock (MiCA)", { 
          description: "This action is disabled pending EU MiCA non-custodial authorization. Only ZK-native Testnet transfers are currently permitted." 
      });
      return;

      if (mode === 'buy') {
          try {
              const asset = toAssetSymbol.toUpperCase();
              const fiatCurrency = ['USD', 'EUR', 'GBP'].includes(subMode) ? subMode : 'EUR';
              const network = asset === 'ETH' ? 'ethereum' : asset === 'USDC' ? 'ethereum' : 'optimism';
              
              const transakParams = new URLSearchParams({
                  apiKey: 'aab77eec-6406-4e4a-a97b-8073a4f4c82d', // Transak public staging key
                  environment: 'PRODUCTION',
                  defaultCryptoCurrency: asset,
                  defaultFiatCurrency: fiatCurrency,
                  defaultFiatAmount: amount,
                  walletAddress: address || '',
                  network,
                  themeColor: '000000',
                  hideMenu: 'true',
              });
              const transakUrl = `https://global.transak.com?${transakParams.toString()}`;
              toast.success("Opening Transak Gateway", { description: `Buying ${asset} via Transak — Supports cards, bank transfer & more.` });
              window.open(transakUrl, '_blank', 'width=450,height=700');
          } catch(e: any) {
              toast.error("Gateway Error", { description: e.message });
          } finally {
              setLoading(false);
          }
          return;
      }

      if (!address || !walletClient) {
          toast.error("Wallet Not Connected");
          return;
      }

      setLoading(true);
      try {
          if (mode === 'send') {
              let finalRecipient = recipient;

              if (subMode === 'ens') {
                  toast.loading("Resolving ENS Name...", { id: 'ens-resolve' });
                  try {
                      const { mainnetClient } = await import('@/lib/blockchain/rpc-engine');
                      //@ts-ignore
                      const resolvedAddress = await mainnetClient.getEnsAddress({ name: recipient });
                      if (!resolvedAddress) throw new Error("Could not resolve ENS name");
                      finalRecipient = resolvedAddress as string;
                      toast.success("ENS Resolved", { id: 'ens-resolve', description: `Target: ${(resolvedAddress as string).slice(0, 10)}...` });
                  } catch (e: any) {
                      toast.error("ENS Resolution Failed", { id: 'ens-resolve', description: e.message });
                      setLoading(false);
                      return;
                  }
              }

              if (!finalRecipient || finalRecipient.length < 40) {
                  toast.error("Invalid Recipient", { description: "Please enter a valid address" });
                  setLoading(false);
                  return;
              }

              const activeFromAsset = fromAsset || balances.find(b => b.symbol === fromAssetSymbol && b.chainId === sourceChain.id);
              if (!activeFromAsset) {
                  toast.error("Asset Not Found", { description: `Cannot find ${fromAssetSymbol} on ${sourceChain.name}` });
                  setLoading(false);
                  return;
              }

              const decimals = activeFromAsset?.decimals || 18;
              toast.info("Preparing Transaction", { description: "Please confirm in your wallet..." });

              let hash: string;
              const isNative = activeFromAsset.address === '0x0000000000000000000000000000000000000000' || 
                               activeFromAsset.address === 'native' ||
                               fromAssetSymbol === 'ETH' || 
                               fromAssetSymbol === 'POL' ||
                               fromAssetSymbol === 'MATIC';

              const amountInUnits = safeParseUnits(amount, decimals);

              if (isNative) {
                  hash = await walletClient!.sendTransaction({
                      to: finalRecipient as `0x${string}`,
                      value: amountInUnits,
                      chain: sourceChain as any
                  });
              } else {
                  const data = encodeFunctionData({
                      abi: [{
                          name: 'transfer',
                          type: 'function',
                          stateMutability: 'nonpayable',
                          inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
                          outputs: [{ type: 'bool' }]
                      }],
                      functionName: 'transfer',
                      args: [finalRecipient as `0x${string}`, amountInUnits]
                  });

                  hash = await walletClient!.sendTransaction({
                      to: activeFromAsset.address as `0x${string}`,
                      data,
                      chain: sourceChain as any
                  });
              }

              await fetch('/api/transactions', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      hash,
                      userId: address,
                      type: 'SEND',
                      fromChain: sourceChain.id,
                      toChain: sourceChain.id,
                      fromToken: activeFromAsset.address,
                      toToken: activeFromAsset.address,
                      fromAmount: amountInUnits.toString(),
                      metadata: { recipient: finalRecipient, symbol: fromAssetSymbol }
                  })
              });

              toast.success("Transfer Initiated", { description: `Broadcast successful. Hash: ${hash.slice(0, 10)}...` });
              // Invalidate both portfolio and history so UI reflects the send immediately
              queryClient.invalidateQueries({ queryKey: ['portfolio-assets'] });
              queryClient.invalidateQueries({ queryKey: ['enriched-history'] });
              onClose();

          } else if (mode === 'swap' || mode === 'bridge') {
              if (subMode === 'limit') {
                  const { ONEINCH_LIMIT_ORDER_V3_TYPE, get1inchOrderDomain } = await import('@/lib/blockchain/eip712');
                  toast.loading("Generating Secure Limit Intent...", { id: 'limit-order' });
                  try {
                      const order = {
                          salt: BigInt(Date.now()),
                          makerAsset: (fromAsset?.address || '0x...') as `0x${string}`,
                          takerAsset: (toAsset?.address || '0x...') as `0x${string}`,
                          maker: address as `0x${string}`,
                          receiver: address as `0x${string}`,
                          allowedSender: '0x0000000000000000000000000000000000000000' as `0x${string}`,
                          makingAmount: safeParseUnits(amount, fromAsset?.decimals || 18),
                          takingAmount: parseUnits("0", 18), 
                          offsets: BigInt(0),
                          interactions: '0x' as `0x${string}`,
                      };
                      //@ts-ignore
                      await walletClient.signTypedData({
                          account: address as `0x${string}`,
                          domain: get1inchOrderDomain(sourceChain.id),
                          types: ONEINCH_LIMIT_ORDER_V3_TYPE,
                          primaryType: 'Order',
                          message: order,
                      });
                      toast.success("Limit Order Signed", { id: 'limit-order', description: "Order broadcasted." });
                      onClose();
                  } catch (e: any) {
                      toast.error("Signature Refused", { id: 'limit-order', description: e.message });
                  }
                  return;
              }

              const activeFromAsset = fromAsset || balances.find(b => b.symbol === fromAssetSymbol && b.chainId === sourceChain.id);
              const amountInUnits = safeParseUnits(amount, activeFromAsset?.decimals || 18);

              const hash = await executeSwap({
                  fromChain: sourceChain.id,
                  toChain: mode === 'swap' ? sourceChain.id : targetChain.id,
                  fromToken: activeFromAsset?.address || fromAssetSymbol,
                  toToken: toAsset?.address || toAssetSymbol,
                  fromAmount: amountInUnits.toString(),
                  slippage: 0.005
              });

              if (hash) {
                  toast.success(`Execution Initiated`, { description: "Atomic swap broadcasted." });
                  queryClient.invalidateQueries({ queryKey: ['portfolio-assets'] });
                  queryClient.invalidateQueries({ queryKey: ['enriched-history'] });
                  onClose();
              }
          }
      } catch (e: any) {
          console.error("Execution Failed:", e);
          toast.error("Execution Failed", { description: e.message });
      } finally {
          setLoading(false);
      }
  };

  const inputClass = `w-full bg-white border border-black/10 rounded-xl p-4 text-[#050505] font-mono text-sm outline-none focus:border-black/30 transition-all placeholder:text-black/30`;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#FFFFFF]/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ scale: 0.98, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.98, opacity: 0, y: 15 }}
            className="relative w-full max-w-lg"
          >
            <InstitutionalErrorBoundary moduleName="Wallet">
              <div className="p-0 border rounded-3xl shadow-2xl" style={{ borderColor: BORDER, background: BG }}>
                
                <div className="p-6 border-b rounded-t-3xl" style={{ borderColor: BORDER, background: CARD }}>
                  <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                          <div className="w-10 h-10 border rounded-xl flex items-center justify-center" style={{ borderColor: BORDER, background: BG }}>
                              <Shield size={16} style={{ color: MUTED }} />
                          </div>
                          <h2 className="text-xl font-black tracking-tighter uppercase" style={{ color: INK }}>Wallet</h2>
                      </div>
                      <button onClick={onClose} className="p-2 transition-colors rounded-full hover:bg-black/5" style={{ color: MUTED }}>
                          <X size={20} />
                      </button>
                  </div>

                  <div className="flex p-1.5 rounded-xl border mb-4" style={{ borderColor: BORDER, background: BG }}>
                      {(["send", "swap", "bridge", "buy"] as const).map((t) => (
                          <button
                              key={t}
                              onClick={() => {
                                  setMode(t);
                                  setSubMode(t === 'buy' ? 'EUR' : 'standard');
                                  setQuote(null);
                                  setErrorMsg(null);
                              }}
                              className={`flex-1 py-2.5 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all ${mode === t ? 'bg-white text-[#FFFFFF] shadow-md' : 'text-black/40 hover:text-black/80'}`}
                          >
                              {t}
                          </button>
                      ))}
                  </div>

                  <div className="flex gap-4 px-1">
                      {mode === 'send' && (["standard", "private", "ens"] as const).map(s => (
                          <button key={s} onClick={() => setSubMode(s)} className={`text-[9px] font-black uppercase tracking-widest transition-colors ${subMode === s ? 'text-[#050505] underline underline-offset-4' : 'text-black/30 hover:text-[#050505]'}`}>
                              {s === 'private' && <Shield size={8} className="inline mr-1" />}
                              {s}
                          </button>
                      ))}
                      {mode === 'swap' && (["aggregator", "limit"] as const).map(s => (
                          <button key={s} onClick={() => setSubMode(s)} className={`text-[9px] font-black uppercase tracking-widest transition-colors ${subMode === s ? 'text-[#050505] underline underline-offset-4' : 'text-black/30 hover:text-[#050505]'}`}>{s}</button>
                      ))}
                  </div>
                </div>

              <div className="p-8 space-y-6" style={{ background: BG }}>
                
                {/*  BUY CRYPTO MODE  */}
                {mode === 'buy' ? (
                      <div className="space-y-4">
                        {/* Amount input */}
                        <div className="border rounded-2xl p-6" style={{ borderColor: BORDER, background: CARD }}>
                           <div className="flex justify-between items-end mb-4">
                               <div className="flex-1">
                                   <label className="text-[10px] font-black uppercase tracking-widest block mb-1" style={{ color: MUTED }}>Spend ({subMode})</label>
                                   <input 
                                       type="number" 
                                       placeholder="100"
                                       value={amount}
                                       onChange={(e) => setAmount(e.target.value)}
                                       className="w-full bg-transparent border-none outline-none text-4xl font-black tracking-tighter"
                                       style={{ color: INK }}
                                   />
                               </div>
                               <div className="flex rounded-lg border p-1 gap-1" style={{ borderColor: BORDER, background: BG }}>
                                   {['EUR', 'USD', 'GBP'].map(c => (
                                       <button 
                                           key={c}
                                           onClick={() => setSubMode(c)}
                                           className={`px-3 py-1.5 rounded text-[10px] font-black transition-all ${subMode === c ? 'bg-white text-[#FFFFFF]' : 'text-black/40 hover:text-[#050505]'}`}
                                       >
                                           {c}
                                       </button>
                                   ))}
                               </div>
                           </div>
                        </div>

                        {/* Receive selector */}
                        <div className="border rounded-2xl p-6" style={{ borderColor: BORDER, background: CARD }}>
                            <div className="flex justify-between items-end">
                                <div className="flex-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest block mb-1" style={{ color: MUTED }}>Receive Asset</label>
                                    <select 
                                        className="bg-transparent font-black outline-none border-none text-2xl"
                                        style={{ color: INK }}
                                        value={toAssetSymbol}
                                        onChange={(e) => setToAssetSymbol(e.target.value)}
                                    >
                                        <option value="ETH">ETH</option>
                                        <option value="USDC">USDC</option>
                                        <option value="BTC">BTC</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Main CTA - Transak */}
                        <button 
                            onClick={handleExecute}
                            disabled={!amount || loading}
                            className="w-full p-4 rounded-xl font-black text-xs uppercase tracking-[0.25em] active:scale-[0.99] transition-all flex items-center justify-center gap-3 disabled:opacity-40"
                            style={{ background: INK, color: '#FFF' }}
                        >
                            {loading ? <Loader2 className="animate-spin" size={16} /> : <CreditCard size={16} />}
                            {loading ? 'Opening Gateway...' : `Buy ${toAssetSymbol} with Card or Bank`}
                        </button>

                        {/* Powered by badge */}
                        <div className="flex items-center justify-center gap-2 pt-1">
                            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: MUTED }}>Powered by</span>
                            <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: INK }}>Transak</span>
                            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: MUTED }}>· EU & Worldwide</span>
                        </div>
                      </div>
                ) : (
                    <div className="space-y-6">
                        {/*  BRIDGE CHAIN SELECTION  */}
                        {mode === 'bridge' && (
                            <div className="flex items-center gap-4 relative z-20">
                                <NetworkSelectorDropdown chain={sourceChain} setChain={setSourceChain} label="Source" disabled />
                                <div className="mt-5 px-1"><ArrowRight size={14} style={{ color: MUTED }} /></div>
                                <NetworkSelectorDropdown chain={targetChain} setChain={setTargetChain} label="Destination" />
                            </div>
                        )}

                        {/*  FROM INPUT  */}
                        <div className="border rounded-2xl p-6 relative" style={{ borderColor: BORDER, background: CARD }}>
                            <div className="flex justify-between items-end mb-4">
                                <div className="flex-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest block mb-1" style={{ color: MUTED }}>{mode === 'send' ? 'Amount' : 'Selling'}</label>
                                    <input 
                                        type="number" 
                                        placeholder="0.00"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full bg-transparent border-none outline-none text-4xl font-black tracking-tighter placeholder-black/10"
                                        style={{ color: INK }}
                                    />
                                </div>
                                <div className="relative border rounded-xl" style={{ borderColor: BORDER, background: BG }}>
                                    <TokenSelector 
                                        chainId={sourceChain.id}
                                        address={address}
                                        selectedToken={balances.find(b => b.symbol === fromAssetSymbol) || { symbol: fromAssetSymbol, name: fromAssetSymbol, address: '', decimals: 18, logoURI: null }}
                                        onSelect={(t) => {
                                            setFromAssetSymbol(t.symbol);
                                            setFromAsset(t);
                                        }}
                                        className="min-w-[120px]"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-between text-[10px] font-black tracking-tight uppercase">
                                <span style={{ color: MUTED }}>Approx ${safeToLocaleString((isNaN(parseFloat(amount)) ? 0 : parseFloat(amount)) * (balances.find(b => b.symbol === fromAssetSymbol)?.usdPrice || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                <button 
                                    onClick={() => {
                                        const asset = balances.find(b => b.symbol === fromAssetSymbol);
                                        if (asset) {
                                            // Use balanceNumeric (a JS number) for clean parseUnits input
                                            const numericMax = asset.balanceNumeric ?? parseFloat(asset.balanceFormatted || '0');
                                            setAmount(numericMax.toString());
                                        }
                                    }}
                                    className="hover:text-black cursor-pointer"
                                    style={{ color: MUTED }}
                                >
                                    Balance: MAX
                                </button>
                            </div>
                        </div>

                        {mode !== 'send' && (
                            <div className="relative h-1">
                                <div className="absolute left-1/2 -top-4 -translate-x-1/2 z-10 w-8 h-8 border rounded-full flex items-center justify-center cursor-pointer hover:bg-black/5" style={{ borderColor: BORDER, background: CARD, color: MUTED }}>
                                    <Repeat size={12} />
                                </div>
                            </div>
                        )}

                        {mode === 'send' ? (
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest block mb-2 px-1" style={{ color: MUTED }}>Recipient</label>
                                <input 
                                    type="text" 
                                    placeholder="0x..."
                                    value={recipient}
                                    onChange={(e) => setRecipient(e.target.value)}
                                    className={inputClass}
                                />
                            </div>
                        ) : (
                            <div className="border rounded-2xl p-6" style={{ borderColor: BORDER, background: CARD }}>
                                <div className="flex justify-between items-end">
                                    <div className="flex-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest block mb-1" style={{ color: MUTED }}>Receiving (Est.)</label>
                                        <div className="text-4xl font-black tracking-tighter" style={{ color: MUTED }}>
                                            {quote?.estimate?.toAmount
                                                ? isFinite(Number(quote.estimate.toAmount) / (10 ** (quote.estimate?.toToken?.decimals ?? 6)))
                                                    ? (Number(quote.estimate.toAmount) / (10 ** (quote.estimate?.toToken?.decimals ?? 6))).toFixed(4)
                                                    : '0.0000'
                                                : quote?.action?.toAmount
                                                    ? isFinite(Number(quote.action.toAmount) / (10 ** (toAsset?.decimals ?? 6)))
                                                        ? (Number(quote.action.toAmount) / (10 ** (toAsset?.decimals ?? 6))).toFixed(4)
                                                        : '0.0000'
                                                    : '0.0000'}
                                        </div>
                                    </div>
                                    <div className="border rounded-xl flex items-center gap-3 cursor-pointer" style={{ borderColor: BORDER, background: BG }}>
                                        <TokenSelector 
                                            chainId={mode === 'swap' ? sourceChain.id : targetChain.id}
                                            address={address}
                                            selectedToken={toAsset || { symbol: toAssetSymbol, name: toAssetSymbol, address: '', decimals: 18 }}
                                            onSelect={(t) => {
                                                setToAsset(t);
                                                setToAssetSymbol(t.symbol);
                                            }}
                                            className="min-w-[120px]"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {errorMsg && (
                            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 text-center font-bold">
                                {errorMsg}
                            </div>
                        )}

                        {quote && mode !== 'send' && (
                            <div className="space-y-2.5 rounded-xl p-4 border" style={{ borderColor: BORDER, background: CARD }}>
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest" style={{ color: MUTED }}>
                                    <span>Route Execution</span>
                                    <span>Li.Fi Aggregation <Zap size={10} className="inline ml-1 text-black" /></span>
                                </div>
                            </div>
                        )}

                        <button 
                            onClick={handleExecute}
                            disabled={loading || !amount || (mode !== 'send' && !quote)}
                            className="w-full p-4 rounded-xl font-black text-xs uppercase tracking-[0.25em] active:scale-[0.99] transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed"
                            style={{ background: INK, color: '#FFF' }}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin" size={16} />
                                    {orchestratorStatus === 'quoting' ? 'Quoting...' : 
                                     orchestratorStatus === 'approving' ? 'Approving...' : 
                                     orchestratorStatus === 'signing' ? 'Awaiting Signature...' : 
                                     orchestratorStatus === 'broadcasting' ? 'Broadcasting...' : 
                                     'Processing...'}
                                </>
                            ) : (
                                <>
                                    Initiate {mode}
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </button>

                    </div>
                )}
              </div>
              </div>
            </InstitutionalErrorBoundary>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
