"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { TokenRow } from "./TokenRow";
import { ActionCluster } from "./ActionCluster";
import {
  History,
  Wallet,
  RefreshCw,
  ChevronDown,
  CheckCircle2,
  Sun,
  Moon,
  Menu,
  Zap,
  Plus,
  X
} from "lucide-react";
import { useAppKitAccount } from "@reown/appkit/react";
import { useChainId, useSwitchChain } from "wagmi";
import { useSystemAccount } from "@/hooks/useSystemAccount";
import { useSystemSignOut } from "@/hooks/useSystemSignOut";
import { useState, useEffect, useCallback } from "react";
import { LegendaryTransactionModal } from "./LegendaryTransactionModal";
import { LegendaryActivityFeed } from "./LegendaryActivityFeed";
import { DepositModal } from "./DepositModal";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { useSmartWebSockets } from "@/hooks/useSmartWebSockets";
import { useSystemConnect } from "@/hooks/useSystemConnect";
import { OptimisticExecutionIndicator } from "./OptimisticExecutionIndicator";
import { safeToFixed, safeToLocaleString } from "@/lib/utils/number-format";
import { GenerateWalletWizard } from "../wallet/GenerateWalletWizard";

/**
 * PortfolioView  Cryptographic TERMINAL v5
 *
 * PERFORMANCE CONTRACT (IPAD / IOS ZERO-LAG):
 * - ZERO blur() CSS filters on animated elements
 * - ZERO animate-pulse on background divs
 * - ZERO backdrop-filter on scrolling content
 * - All decorative backgrounds use translateZ(0) GPU layers
 * - Framer Motion animations ONLY on opacity + transform (no layout triggers)
 * - backgroundAttachment: scroll (never fixed) on all pattern divs
 *
 * DESIGN CONTRACT (matches target screenshot precisely):
 * - Dark header with ledger logo + "Humanity Ledger NETWORK / TERMINAL"
 * - Giant centered NET WORTH value
 * - Glowing green dot 24H change pill
 * - 4 circular action buttons (Send/Blue, Receive/Green, Swap/Purple, Buy/Pink)
 * - "BLOCKCHAIN LEDGER" section separator
 * - Italic "ELITE ASSETS" heading
 * - "NO LIQUIDITY DETECTED" empty state with wallet icon
 * - RainbowKit connect button in header
 * - Full chain selector integrated in header
 */

// appkit-button is a native web component from @reown/appkit
// Its JSX type is declared globally by the package itself




interface PortfolioViewProps {
  totalValue: number;
  balances: any[];
  prices: Record<string, number>;
  change24hValue: number;
  change24hPercent: number;
}

// Chain name  display color map
const CHAIN_COLORS: Record<string, string> = {
  "Ethereum":      "#627EEA",
  "Base":          "#0052FF",
  "Arbitrum One":  "#12AAFF",
  "OP Mainnet":    "#FF0420",
  "Polygon":       "#8247E5",
  "BNB Smart Chain": "#F0B90B",
  "Avalanche":     "#E84142",
  "zkSync Era":    "#4E529A",
  "Linea":         "#61DFFF",
  "Scroll":        "#EEB878",
  "Celo":          "#35D07F",
  "Mantle":        "#EBEBEB",
  "Fantom":        "#1969FF",
  "Blast":         "#FCEF4B",
  "Gnosis":        "#04795B",
  "Moonbeam":      "#E1147B",
};

// --- Inline skeleton components ---
const SkeletonRow = () => (
  <div className="p-4 mb-2 flex items-center justify-between rounded-2xl bg-white/[0.04] border border-white/[0.06]">
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 bg-white/10 rounded-full" />
      <div>
        <div className="h-3 w-20 bg-white/10 rounded mb-2" />
        <div className="h-2 w-14 bg-white/10 rounded" />
      </div>
    </div>
    <div className="h-4 w-16 bg-white/10 rounded" />
  </div>
);

// --- Chain Selector Component (fully accessible) ---
function ChainSelector() {
  const chainId = useChainId();
  const { chains, switchChain, isPending } = useSwitchChain();
  const { isConnected, address } = useSystemAccount();
  const [isOpen, setIsOpen] = useState(false);

  const current = chains.find((c) => c.id === chainId);
  const color = current ? (CHAIN_COLORS[current.name] ?? "#888") : "#888";

  const handleSwitch = (id: number) => {
    switchChain({ chainId: id });
    setIsOpen(false);
  };

  if (!isConnected) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-white/10 bg-white/5 hover:bg-white/10 transition-all"
        style={{ color }}
      >
        <div className="w-2 h-2 rounded-full" style={{ background: color }} />
        <span className="hidden sm:inline">{current?.name ?? "Network"}</span>
        <ChevronDown
          size={12}
          className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-full mt-2 z-50 w-56 rounded-2xl border border-white/10 overflow-hidden shadow-2xl"
              style={{ background: "rgba(13,15,18,0.97)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}
            >
              <div className="px-3 py-2 text-[9px] uppercase font-black text-white/30 tracking-[0.2em]">
                Select Network
              </div>
              <div className="max-h-72 overflow-y-auto">
                {chains.map((chain) => {
                  const c = CHAIN_COLORS[chain.name] ?? "#888";
                  const active = chain.id === chainId;
                  return (
                    <button
                      key={chain.id}
                      disabled={isPending}
                      onClick={() => handleSwitch(chain.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors ${
                        active
                          ? "bg-white/8 text-white"
                          : "text-white/50 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: c }} />
                        <span className="text-xs font-bold">{chain.name}</span>
                      </span>
                      {active && <CheckCircle2 size={13} style={{ color: c }} />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Rainbow Perfect Account Switcher ---

function RainbowAccountSwitcher({ userAddress }: { userAddress: string | undefined }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const { activateSystemVault } = useSystemConnect();
  
  const handleGenerateWallet = async (privateKey: string, address: string) => {
      setShowWizard(false);
      await activateSystemVault(privateKey, address);
  };

  return (
    <div className="relative z-[60]">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-2 py-1.5 rounded-[20px] hover:bg-white/5 transition-colors border border-transparent hover:border-white/5"
      >
         <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#25D366] to-purple-600 shadow-inner flex items-center justify-center border border-white/20">
            <span className="text-[14px] font-black tracking-tight text-white shadow-sm font-mono uppercase">
                {userAddress ? userAddress.slice(2, 4) : '?'}
            </span>
         </div>
         <div className="flex flex-col items-start leading-none gap-1">
             <span className="text-white font-black text-sm tracking-tight hover:text-purple-400 transition-colors">Main Wallet</span>
             <span className="text-white/40 text-[10px] font-mono font-bold tracking-widest">{userAddress ? `${userAddress.slice(0,6)}...${userAddress.slice(-4)}` : 'Not Connected'}</span>
         </div>
         <ChevronDown size={14} className={`text-white/40 ml-2 transition-transform duration-300 ${isOpen ? 'rotate-180':''}`} />
      </button>

      <AnimatePresence>
         {isOpen && (
             <>
                 <motion.div 
                     initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                     className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} 
                 />
                 <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 mt-3 w-72 bg-[#161A1E] border border-white/10 rounded-3xl shadow-2xl p-2 z-50 overflow-hidden"
                 >
                     <div className="text-[9px] font-black text-white/30 uppercase tracking-[0.25em] px-4 py-3 border-b border-white/5 mb-2">
                         Your Profiles Array
                     </div>
                     <button className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/10 text-left mb-1 hover:bg-white/10 transition-colors group">
                         <div className="flex items-center gap-4">
                             <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#25D366] to-purple-600 flex items-center justify-center shadow-lg"><Wallet size={16} className="text-white"/></div>
                             <div>
                                 <div className="text-sm font-black text-white tracking-tight">Main Wallet</div>
                                 <div className="text-[10px] text-white/40 font-mono tracking-widest">{userAddress?.slice(0,6)}...{userAddress?.slice(-4)}</div>
                             </div>
                         </div>
                         <CheckCircle2 size={18} className="text-emerald-400 shadow-emerald-500/20 drop-shadow-md"/>
                     </button>
                     
                     <div className="h-px bg-white/[0.04] my-2" />
                     
                     <button onClick={() => { setIsOpen(false); setShowWizard(true); }} className="w-full flex items-center gap-4 p-3.5 rounded-2xl hover:bg-white/5 transition-colors text-left group">
                         <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center border border-white/10 text-white/60 group-hover:text-white group-hover:border-purple-500/30 transition-all"><Plus size={18}/></div>
                         <div>
                             <div className="text-sm font-black text-white tracking-tight">Generate New Identity</div>
                             <div className="flex items-center gap-1.5 mt-1.5">
                                 <div className="flex gap-1">
                                    <span className="text-white/40 text-[9px] font-bold uppercase tracking-widest">System Onboarding Flow</span>
                                    <kbd className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-white/5 text-white/40 border border-white/10">Alt</kbd>
                                    <span className="text-white/20 text-[9px] font-bold">+</span>
                                    <kbd className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-white/5 text-purple-400 border border-purple-500/30">W</kbd>
                                 </div>
                             </div>
                         </div>
                     </button>
                 </motion.div>
             </>
         )}
      </AnimatePresence>
      {showWizard && <GenerateWalletWizard onCancel={() => setShowWizard(false)} onComplete={handleGenerateWallet} />}
    </div>
  );
}

// --- Rainbow Wallet Connection Steps ---

function RainbowOnboarding() {
  const [step, setStep] = useState<"choosing" | "importing">("choosing");
  const [showWizard, setShowWizard] = useState(false);
  const { activateSystemVault } = useSystemConnect();

  const handleGenerateWallet = async (privateKey: string, address: string) => {
      setShowWizard(false);
      await activateSystemVault(privateKey, address);
  };

  if (step === "importing") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-8 text-center">
        <div className="scale-90 origin-center">
            {/* @ts-expect-error appkit web component */}
            <appkit-button />
        </div>
        <p className="text-white/30 text-xs hover:text-white/70 transition-colors cursor-pointer" onClick={() => setStep("choosing")}>
           Go Back
        </p>
      </div>
    );
  }

  // "choosing"  main landing
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 px-6 text-center">
      {/* Icon */}
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#25D366]/20 to-purple-500/20" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Wallet size={36} className="text-white/80" />
        </div>
      </div>

      <div className="space-y-2 max-w-xs">
        <h2 className="text-2xl font-black text-white tracking-tight">
          Get Started
        </h2>
        <p className="text-white/40 text-sm leading-relaxed">
          Create a brand new wallet or import an existing one to access your assets on-chain.
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        {/* Create new */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowWizard(true)}
          className="w-full py-4 rounded-2xl font-black text-sm text-white tracking-wide"
          style={{
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            boxShadow: "0 4px 24px rgba(99,102,241,0.35)",
          }}
        >
           Create System Identity
        </motion.button>

        {/* I already have one */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setStep("importing")}
          className="w-full py-4 rounded-2xl font-black text-sm text-white/70 tracking-wide border border-white/10 bg-white/5 hover:bg-white/10 transition-all"
        >
          I already have a wallet
        </motion.button>
      </div>

      <p className="text-white/20 text-[10px] tracking-widest uppercase">
        Non-custodial · On-chain · System
      </p>

      {showWizard && <GenerateWalletWizard onCancel={() => setShowWizard(false)} onComplete={handleGenerateWallet} />}
    </div>
  );
}

//  Main Component 
export default function PortfolioView({
  totalValue,
  balances,
  prices,
  change24hValue,
  change24hPercent,
}: PortfolioViewProps) {
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferMode, setTransferMode] = useState<"send" | "swap" | "bridge" | "buy">("send");
  const [transferSubMode, setTransferSubMode] = useState<string>("standard");
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);
  const [history, setHistory] = useState<any[]>([]);
  /* useState removed */
  const [isDark, setIsDark] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const { address: userAddress, isConnected } = useSystemAccount();
  const { nuclearDisconnect } = useSystemSignOut();
  const { mutate } = useSWRConfig();
  const { lastTx, connected: wsConnected } = useSmartWebSockets(userAddress || undefined);

  // Theme toggle
  useEffect(() => {
    const html = document.documentElement;
    const check = () => setIsDark(html.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(html, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const toggleTheme = () => {
    const html = document.documentElement;
    html.classList.toggle("dark");
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Fetch History using React Query so it automatically syncs when invalidateQueries is called
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['enriched-history', userAddress],
    queryFn: async () => {
      if (!userAddress) return { history: [] };
      const res = await fetch(`/api/wallet/history/deep?address=${userAddress}`);
      return res.json();
    },
    enabled: !!userAddress,
    refetchInterval: 30000
  });

  useEffect(() => {
    if (historyData?.history) {
      setHistory(
        historyData.history.map((tx: any) => ({
          ...tx,
          value: parseFloat(tx.value),
          timestamp: new Date(tx.timestamp),
        }))
      );
    }
  }, [historyData]);

  const handleAction = (action: string, mode?: string) => {
    if (action === "Send" || action === "Buy" || action === "Swap" || action === "Bridge" || action === "Sell") {
      const m =
        action === "Sell" ? "swap" :
        action === "Swap" ? "swap" :
        action === "Buy" ? "buy" :
        mode === "bridge" ? "bridge" : "send";
      setTransferMode(m as any);
      setTransferSubMode(mode || "standard");
      setIsTransferOpen(true);
    } else if (action === "Receive") {
      setIsDepositOpen(true);
    }
  };

  const formatValue = (val: any) => {
    const num = typeof val === "string" ? parseFloat(val) : Number(val);
    if (isNaN(num)) return "$0.00";
    return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatAmount = (val: any) => {
    const num = typeof val === "string" ? parseFloat(val) : Number(val);
    if (isNaN(num)) return "0";
    return num.toLocaleString("en-US", { maximumFractionDigits: 6 });
  };

  const handleManualRefresh = async () => {
    const now = Date.now();
    if (now - lastRefreshTime < 5000) {
      toast.error("Too fast!", { description: "Wait 5 seconds between refreshes" });
      return;
    }
    setIsRefreshing(true);
    setLastRefreshTime(now);
    try {
      await mutate("portfolio-assets", undefined, { revalidate: true });
      toast.success("Portfolio refreshed ");
    } catch {
      toast.error("Refresh failed");
    } finally {
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      if (!userAddress) return;
      await fetch("/api/wallet/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: userAddress }),
      });
      await mutate("portfolio-assets", undefined, { revalidate: true });
      toast.success("Wallet synchronized");
    } catch {
      toast.error("Sync failed");
    } finally {
      setIsSyncing(false);
    }
  };

  //  Render 
  return (
    <div
      className="relative min-h-screen text-black font-sans selection:bg-black/10"
      style={{ background: "#fdfcf9" }}
    >
      {/* Sovereign Grid Pattern - Client Only to fix SSR Glitch */}
      {mounted && (
        <div className="absolute inset-0 pointer-events-none opacity-[0.05]"
            style={{ backgroundImage: 'repeating-linear-gradient(0deg,#000 0,#000 1px,transparent 1px,transparent 60px),repeating-linear-gradient(90deg,#000 0,#000 1px,transparent 1px,transparent 60px)' }} />
      )}
      {/* 
          HEADER  Matches screenshot exactly
          Ledger logo · Brand · Dark on left, tools on right
           */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-5 py-4"
        style={{
          background: "rgba(11,14,17,0.92)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        {/* Left: Interactive Account Profile (Rainbow Style) */}
        <div className="flex items-center gap-3">
          <RainbowAccountSwitcher userAddress={userAddress} />
        </div>

        {/* Right: Chain selector + Tools */}
        <div className="flex items-center gap-2">
          <ChainSelector />
           <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Sovereign Node</span>
                <div className="flex items-center gap-2">
                    <div className="w-1.2 h-1.2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest">{userAddress?.slice(0, 6)}...{userAddress?.slice(-4)}</span>
                </div>
            </div>
            <button
                onClick={() => nuclearDisconnect()}
                className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-red-500/20 group transition-all border border-white/10"
            >
                <X size={14} className="text-white/40 group-hover:text-red-400" />
            </button>
          </div>
          
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-white/50 hover:text-white"
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <div className="scale-90 origin-right">
            {/* @ts-expect-error appkit web component */}
            <appkit-button />
          </div>
        </div>
      </header>

      {/* 
          MODALS
           */}
      <LegendaryTransactionModal
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        balances={balances}
        initialMode={transferMode}
        initialSubMode={transferSubMode}
      />
      <DepositModal
        isOpen={isDepositOpen}
        onClose={() => setIsDepositOpen(false)}
        address={userAddress || ""}
      />

      {/* 
          FLOATING REFRESH  Top right, minimal
           */}
      <button
        onClick={handleManualRefresh}
        disabled={isRefreshing}
        className="fixed bottom-24 right-5 z-50 p-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all disabled:opacity-40"
        title="Refresh portfolio (Cmd+R)"
      >
        <RefreshCw
          size={18}
          className={`text-white/50 ${isRefreshing ? "animate-spin text-purple-400" : ""}`}
        />
        {/* Active dot */}
        <div
          className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-[#0B0E11] ${
            wsConnected ? "bg-green-500" : "bg-gray-600"
          }`}
        />
      </button>

      {/* 
          MAIN CONTENT
           */}
      <main className="relative z-10 max-w-[2560px] mx-auto min-h-screen flex flex-col pt-8 px-4 pb-32 text-left items-start">

        {/* NOT CONNECTED  Rainbow Wallet Onboarding */}
        {!isConnected ? (
          <RainbowOnboarding />
        ) : (
          <>
            {/*  Hero Balance  */}
            <div className="text-center space-y-4 mb-12 relative z-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-black/[0.03] border border-black/5 rounded-full"
            >
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-black text-black/40 uppercase tracking-[0.2em]">Net Worth // Non-Custodial Real-Time</span>
            </motion.div>
            
            <h1 className="text-8xl md:text-9xl font-black tracking-tighter text-black flex items-center justify-center gap-4">
              <span className="opacity-20 text-4xl md:text-6xl">$</span>
              {totalValue || "0.00"}
            </h1>
            
            <div className="flex items-center justify-center gap-3">
               <div className="px-5 py-2 bg-green-500 text-white rounded-full text-[11px] font-black uppercase tracking-widest shadow-xl shadow-green-500/20">
                 +{change24hValue || "0.00"} 24h
               </div>
               <div className="px-5 py-2 bg-black/[0.03] border border-black/5 text-black/40 rounded-full text-[11px] font-black uppercase tracking-widest">
                 {change24hPercent || "0.00"}% Yield
               </div>
            </div>
          </div>

            {/*  Action Cluster (Send / Receive / Swap / Buy)  */}
            <ActionCluster onAction={handleAction} />

            {/*  BLOCKCHAIN LEDGER divider  */}
            <div className="flex items-center gap-4 px-4 my-8">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <span className="text-[9px] font-black text-white/25 tracking-[0.45em] uppercase whitespace-nowrap">
                Blockchain Ledger
              </span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>

            {/*  Assets + Activity Grid  */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">

              {/* Assets Column */}
              <div>
                <div className="flex items-center justify-between mb-6 px-1">
                  <h2 className="font-black text-xl tracking-tighter uppercase italic text-white/90">
                    Elite Assets
                  </h2>
                  <button
                    onClick={handleManualRefresh}
                    disabled={isRefreshing}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-40"
                  >
                    <RefreshCw
                      size={14}
                      className={`text-white/40 ${isRefreshing ? "animate-spin text-purple-400" : ""}`}
                    />
                  </button>
                </div>

                <div className="space-y-1 max-h-[520px] lg:max-h-[720px] overflow-y-auto pr-1 custom-scrollbar">
                  {isRefreshing && balances.length === 0 ? (
                    <>
                      <SkeletonRow />
                      <SkeletonRow />
                      <SkeletonRow />
                    </>
                  ) : balances.length === 0 ? (
                    /* Empty state  matches screenshot */
                    <div className="py-20 text-center rounded-3xl border border-white/[0.07] bg-white/[0.02]">
                      <Wallet size={40} className="mx-auto mb-4 text-white/10" />
                      <p className="text-white/20 font-black uppercase tracking-widest text-[10px]">
                        No Liquidity Detected
                      </p>
                    </div>
                  ) : (
                    balances.slice((currentPage - 1) * 8, currentPage * 8).map((bal: any, i: number) => (
                      <motion.div
                        key={`${bal.symbol}-${bal.chainId}-${i}`}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04, duration: 0.25 }}
                      >
                        <TokenRow
                          symbol={bal.symbol}
                          name={bal.name}
                          balance={formatAmount(bal.balanceFormatted || bal.balance)}
                          value={formatValue(bal.value)}
                          change24h={bal.change24h}
                          chainId={bal.chainId}
                          icon={bal.logo}
                        />
                      </motion.div>
                    ))
                  )}
                </div>
                
                {/* PORTFOLIO PAGINATION */}
                {balances.length > 8 && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded border border-white/10 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-xs font-black uppercase text-white/50 hover:text-white"
                    >
                      Prev
                    </button>
                    <div className="flex gap-1">
                      {Array.from({ length: Math.ceil(balances.length / 8) }).map((_idx, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentPage(idx + 1)}
                          className={`w-6 h-6 flex items-center justify-center rounded text-[10px] font-mono font-black transition-colors ${currentPage === idx + 1 ? 'bg-purple-500 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'}`}
                        >
                          {idx + 1}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(Math.ceil(balances.length / 8), p + 1))}
                      disabled={currentPage === Math.ceil(balances.length / 8)}
                      className="px-3 py-1.5 rounded border border-white/10 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-xs font-black uppercase text-white/50 hover:text-white"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>

              {/* Activity Column */}
              <div>
                <div className="flex items-center justify-between mb-6 px-1">
                  <h2 className="font-black text-xl tracking-tighter uppercase italic text-white/90">
                    Recent Activity
                  </h2>
                  <button
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-40"
                  >
                    <History
                      size={14}
                      className={`${isSyncing ? "animate-spin text-purple-400" : "text-white/40"}`}
                    />
                  </button>
                </div>
                {historyLoading && history.length === 0 ? (
                  <div className="space-y-3">
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                  </div>
                ) : (
                  <LegendaryActivityFeed history={history} />
                )}
              </div>

            </div>
          </>
        )}
      </main>

      <OptimisticExecutionIndicator userId={userAddress || ""} />

      {/* CSS keyframe for the create spinner (no JS animation loop) */}
      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

