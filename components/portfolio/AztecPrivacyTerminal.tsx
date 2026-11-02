"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { ethers } from 'ethers';
import {
  Hexagon, Lock, Unlock, Shield, EyeOff, ArrowDown, RefreshCw,
  Key, Activity, Layers, AlertTriangle, Check, ExternalLink, Copy
} from 'lucide-react';
import { useWalletStore } from '@/lib/store/wallet-store';
import {
  depositEthToAztecL1,
  readAztecPendingDeposit,
  signAztecAccountRegistration,
  buildAztecPrivateTransferPayload,
  deriveAztecViewingKey,
  AZTEC_CONTRACTS,
  AZTEC_ASSET_IDS,
} from '@/lib/aztec-zk-engine';

// ─── Types ───────────────────────────────────────────────────────────────────

type AztecStep = 
  | 'OVERVIEW'      // Dashboard showing L1 balance vs L2 shielded balance
  | 'DEPOSIT'       // Shield ETH from L1 → Aztec L2
  | 'REGISTER'      // Register viewing key with Aztec network
  | 'TRANSFER'      // Private transfer within Aztec L2
  | 'PENDING';      // Pending deposit status

interface TerminalLog {
  timestamp: string;
  level: 'INFO' | 'SUCCESS' | 'ERROR' | 'ZK';
  message: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AztecPrivacyTerminal({ onBack }: { onBack: () => void }) {
  const address = useWalletStore(s => s.address);
  const privateKey = useWalletStore(s => s.privateKey);
  const balance = useWalletStore(s => s.balance);
  const activeNetwork = useWalletStore(s => s.activeNetwork);
  const [step, setStep] = useState<AztecStep>('OVERVIEW');
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<TerminalLog[]>([]);
  const [pendingDeposit, setPendingDeposit] = useState<bigint>(0n);
  const [viewingKey, setViewingKey] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const logsRef = useRef<HTMLDivElement>(null);

  // ─── Logging ─────────────────────────────────────────────────────────────
  const log = useCallback((message: string, level: TerminalLog['level'] = 'INFO') => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    setLogs(prev => [...prev.slice(-100), { timestamp, level, message }]);
    setTimeout(() => {
      if (logsRef.current) {
        logsRef.current.scrollTop = logsRef.current.scrollHeight;
      }
    }, 50);
  }, []);

  // ─── Load initial state ───────────────────────────────────────────────────
  useEffect(() => {
    if (!privateKey || !address) return;

    // Derive viewing key immediately from private key
    try {
      const { viewingKeyPublic } = deriveAztecViewingKey(privateKey);
      setViewingKey(viewingKeyPublic);
    } catch (e) {
      console.error("Could not derive viewing key:", e);
    }
  }, [privateKey, address]);

  // Poll pending deposit balance
  const refreshPendingDeposit = useCallback(async () => {
    if (!address || !privateKey) return;
    try {
      const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
      const pending = await readAztecPendingDeposit(provider, address);
      setPendingDeposit(pending);
    } catch (e) {
      console.warn("Could not read pending deposit:", e);
    }
  }, [address, privateKey]);

  useEffect(() => {
    refreshPendingDeposit();
  }, [refreshPendingDeposit]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="w-full flex flex-col min-h-[100dvh] bg-white font-mono"
    >
      {/* ─── Top Bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 md:px-10 py-5 border-b border-black/10">
        <div className="flex items-center gap-3">
          <Hexagon size={18} className="text-black" strokeWidth={1.5} />
          <div>
            <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-black leading-none">
              Aztec Privacy Terminal
            </h2>
            <p className="text-[9px] text-black/40 uppercase tracking-widest mt-0.5">
              Zero Knowledge L2 · On-Chain Only
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeNetwork.toUpperCase() === 'ETHEREUM' ? (
            <span className="text-[8px] font-bold uppercase tracking-widest text-emerald-600 border border-emerald-200 bg-emerald-50 px-2 py-1">
              MAINNET
            </span>
          ) : (
            <span className="text-[8px] font-bold uppercase tracking-widest text-amber-600 border border-amber-200 bg-amber-50 px-2 py-1">
              {activeNetwork.toUpperCase()} - L1 SHIELD ON MAINNET ONLY
            </span>
          )}
          <button onClick={onBack} className="text-[9px] uppercase tracking-widest font-bold text-black/40 hover:text-black border border-black/10 px-3 py-1.5 hover:border-black transition-all">
            CLOSE
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* ─── Left Panel: Navigation ─────────────────────────────────────── */}
        <div className="w-full lg:w-60 border-b lg:border-b-0 lg:border-r border-black/10 p-4 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible">
          {([
            ['OVERVIEW',  'Dashboard',     Activity],
            ['DEPOSIT',   'Shield ETH',    ArrowDown],
            ['REGISTER',  'Register Key',  Key],
            ['TRANSFER',  'Private Send',  EyeOff],
            ['PENDING',   'Pending Queue', Layers],
          ] as const).map(([s, label, Icon]) => (
            <button
              key={s}
              onClick={() => setStep(s)}
              className={`flex items-center gap-2.5 px-3 py-2.5 text-[9px] font-bold uppercase tracking-widest whitespace-nowrap transition-all ${
                step === s
                  ? 'bg-black text-white'
                  : 'text-black/40 hover:text-black hover:bg-black/5'
              }`}
            >
              <Icon size={11} />
              {label}
            </button>
          ))}
        </div>

        {/* ─── Right Panel: Content ────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="p-6 md:p-10"
            >
              {step === 'OVERVIEW' && <OverviewPanel address={address} balance={balance} pendingDeposit={pendingDeposit} viewingKey={viewingKey} onDeposit={() => setStep('DEPOSIT')} />}
              {step === 'DEPOSIT' && <DepositPanel log={log} privateKey={privateKey} onSuccess={(hash: string, depositedAmountStr: string) => { 
                setLastTx(hash); 
                try { setPendingDeposit(prev => prev + ethers.parseEther(depositedAmountStr || '0')); } catch(e){}
                refreshPendingDeposit(); 
                setStep('PENDING'); 
              }} />}
              {step === 'REGISTER' && <RegisterPanel log={log} privateKey={privateKey} />}
              {step === 'TRANSFER' && <PrivateTransferPanel log={log} privateKey={privateKey} />}
              {step === 'PENDING' && <PendingPanel pendingDeposit={pendingDeposit} lastTx={lastTx} onRefresh={refreshPendingDeposit} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>


    </motion.div>
  );
}

// ─── Sub-panels ───────────────────────────────────────────────────────────────

function OverviewPanel({ address, balance, pendingDeposit, viewingKey, onDeposit }: any) {
  const [copied, setCopied] = useState(false);
  const copyKey = () => {
    if (!viewingKey) return;
    navigator.clipboard.writeText(viewingKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-black/40 mb-1">L1 Transparent Balance</h3>
        <p className="text-4xl font-light text-black">{balance || '0.0'} <span className="text-sm text-black/30">ETH</span></p>
      </div>

      <div className="border border-black/10 p-6 bg-black/[0.02]">
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-black/40 mb-4 flex items-center gap-2">
          <Hexagon size={10} /> Aztec L2 Shielded State
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[9px] text-black/40 uppercase tracking-widest mb-1">Pending Deposit (L1)</div>
            <div className="text-xl font-light">{ethers.formatEther(pendingDeposit)} <span className="text-xs text-black/30">ETH</span></div>
          </div>
          <div>
            <div className="text-[9px] text-black/40 uppercase tracking-widest mb-1">Contract</div>
            <div className="text-[10px] font-mono text-black/60 break-all">{AZTEC_CONTRACTS.ROLLUP_PROCESSOR.slice(0,10)}...</div>
          </div>
        </div>
      </div>

      {viewingKey && (
        <div className="border border-black/10 p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[9px] font-black uppercase tracking-widest text-black/40">Your Aztec Viewing Key</h4>
            <button onClick={copyKey} className="text-[9px] font-bold uppercase tracking-widest text-black/40 hover:text-black flex items-center gap-1">
              {copied ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
              {copied ? 'COPIED' : 'COPY'}
            </button>
          </div>
          <div className="font-mono text-[10px] text-black/60 break-all bg-black/[0.02] p-3 border border-black/5">
            {viewingKey}
          </div>
          <p className="text-[8px] text-black/30 mt-2 uppercase tracking-widest">
            Share this key with recipients to allow them to send you private notes.
          </p>
        </div>
      )}

      <button onClick={onDeposit} className="w-full py-5 bg-black text-white text-[10px] font-black uppercase tracking-[0.25em] hover:bg-black/80 transition-all flex items-center justify-center gap-3">
        <Shield size={14} /> Shield ETH into Aztec L2
      </button>
    </div>
  );
}

function DepositPanel({ log, privateKey, onSuccess }: any) {
  const [amount, setAmount] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const execute = async () => {
    if (isBusy) return;
    if (!amount || parseFloat(amount) <= 0) return toast.error("Enter an amount greater than 0");
    if (!privateKey) return toast.error("Wallet not connected", { description: "Please create or import a wallet first." });
    setIsBusy(true);
    try {
      log("Connecting to Ethereum mainnet via public RPC...", 'INFO');
      const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
      const wallet = new ethers.Wallet(privateKey, provider);
      if (!wallet) throw new Error("Could not construct wallet from private key.");

      log("Deriving Aztec viewing key from private key...", 'ZK');
      const { viewingKeyPublic } = deriveAztecViewingKey(wallet.privateKey);
      log(`Viewing Key: ${viewingKeyPublic.slice(0, 18)}...`, 'ZK');

      log("Computing Pedersen note commitment...", 'ZK');
      const valueWei = ethers.parseEther(amount);

      log(`Broadcasting L1 deposit to Aztec Rollup Processor...`, 'INFO');
      log(`Contract: ${AZTEC_CONTRACTS.ROLLUP_PROCESSOR}`, 'INFO');
      log(`Value: ${amount} ETH`, 'INFO');

      const result = await depositEthToAztecL1(wallet, valueWei);

      log(`Tx confirmed: ${result.txHash}`, 'SUCCESS');
      log(`Proof hash: ${result.proofHash.slice(0, 18)}...`, 'ZK');
      log(`Note commitment: ${result.noteCommitment.slice(0, 18)}...`, 'ZK');
      log("Funds are now pending in the Aztec L2 sequencer queue.", 'SUCCESS');

      toast.success("Deposit confirmed on L1");
      onSuccess(result.txHash, amount);
    } catch (err: any) {
      log(`ERROR: ${err.message}`, 'ERROR');
      toast.error("Deposit failed", { description: err.message?.slice(0, 80) });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h3 className="text-xl font-light text-black mb-1">Shield ETH</h3>
        <p className="text-[11px] text-black/40 leading-relaxed max-w-sm">
          Deposits ETH into the Aztec Rollup Processor on L1. The sequencer will create an encrypted note on L2 visible only with your viewing key.
        </p>
      </div>

      <div className="border border-black/10 focus-within:border-black transition-colors relative">
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full bg-transparent p-6 text-3xl font-light outline-none pr-20"
        />
        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-sm font-bold text-black/30">ETH</span>
      </div>

      <div className="border border-black/5 bg-black/[0.015] p-4 space-y-2 text-[9px] font-mono uppercase tracking-widest">
        <div className="flex justify-between text-black/50">
          <span>L1 Rollup Processor</span>
          <span className="text-black/70">{AZTEC_CONTRACTS.ROLLUP_PROCESSOR.slice(0, 8)}...</span>
        </div>
        <div className="flex justify-between text-black/50">
          <span>Asset ID</span>
          <span className="text-black/70">0 (ETH)</span>
        </div>
        <div className="flex justify-between text-black/50">
          <span>ZK Mechanism</span>
          <span className="text-black/70">UltraHonk (Aztec v6)</span>
        </div>
        <div className="flex justify-between text-black/50">
          <span>Privacy Level</span>
          <span className="text-emerald-600 font-black">MAXIMUM</span>
        </div>
      </div>

      <button
        onClick={execute}
        disabled={isBusy || !amount}
        className="w-full py-5 bg-black text-white text-[10px] font-black uppercase tracking-[0.25em] hover:bg-black/80 disabled:opacity-30 transition-all flex items-center justify-center gap-3"
      >
        {isBusy ? <RefreshCw size={14} className="animate-spin" /> : <Lock size={14} />}
        {isBusy ? 'BROADCASTING TO L1...' : 'EXECUTE SHIELD'}
      </button>
    </div>
  );
}

function RegisterPanel({ log, privateKey }: any) {
  const [isBusy, setIsBusy] = useState(false);
  const [result, setResult] = useState<{ signature: string; viewingKey: string } | null>(null);

  const execute = async () => {
    if (!privateKey) return toast.error("Wallet not connected", { description: "Please create or import a wallet first." });
    setIsBusy(true);
    try {
      log("Initiating EIP-712 Aztec account registration...", 'INFO');
      const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
      const wallet = new ethers.Wallet(privateKey, provider);
      if (!wallet) throw new Error("Could not construct wallet from private key.");

      log(`Signing registration payload for ${wallet.address.slice(0, 8)}...`, 'ZK');
      const reg = await signAztecAccountRegistration(wallet);
      log(`Signature: ${reg.signature.slice(0, 18)}...`, 'SUCCESS');
      log(`Viewing Key registered: ${reg.viewingKey.slice(0, 18)}...`, 'ZK');
      log("Registration payload ready for Aztec sequencer submission.", 'SUCCESS');

      setResult({ signature: reg.signature, viewingKey: reg.viewingKey });
      toast.success("Account registration signed");
    } catch (err: any) {
      log(`ERROR: ${err.message}`, 'ERROR');
      toast.error("Registration failed");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h3 className="text-xl font-light text-black mb-1">Register Viewing Key</h3>
        <p className="text-[11px] text-black/40 leading-relaxed max-w-sm">
          Signs an EIP-712 payload that registers your Aztec viewing key with the network. This allows the sequencer to encrypt notes that only you can decrypt.
        </p>
      </div>

      {result && (
        <div className="border border-emerald-200 bg-emerald-50 p-5 space-y-3">
          <div className="flex items-center gap-2 text-emerald-700 text-[10px] font-black uppercase tracking-widest">
            <Check size={12} /> Registration Signed
          </div>
          <div>
            <div className="text-[9px] text-black/40 mb-1">Viewing Key</div>
            <div className="font-mono text-[10px] break-all">{result.viewingKey}</div>
          </div>
          <div>
            <div className="text-[9px] text-black/40 mb-1">EIP-712 Signature</div>
            <div className="font-mono text-[10px] break-all text-black/60">{result.signature.slice(0, 40)}...</div>
          </div>
        </div>
      )}

      <button
        onClick={execute}
        disabled={isBusy}
        className="w-full py-5 bg-black text-white text-[10px] font-black uppercase tracking-[0.25em] hover:bg-black/80 disabled:opacity-30 transition-all flex items-center justify-center gap-3"
      >
        {isBusy ? <RefreshCw size={14} className="animate-spin" /> : <Key size={14} />}
        {isBusy ? 'SIGNING EIP-712...' : 'SIGN & REGISTER'}
      </button>
    </div>
  );
}

function PrivateTransferPanel({ log, privateKey }: any) {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [payload, setPayload] = useState<any>(null);

  const build = () => {
    if (!recipient || !amount || !privateKey) {
      return toast.error("Fill in all fields and ensure wallet is unlocked.");
    }
    try {
      log("Building Aztec private transfer payload...", 'ZK');
      const valueWei = ethers.parseEther(amount);
      const p = buildAztecPrivateTransferPayload(privateKey, recipient, AZTEC_ASSET_IDS.ETH, valueWei);
      setPayload(p);
      log(`Note commitment: ${p.noteCommitment.slice(0, 18)}...`, 'ZK');
      log(`Nullifier: ${p.nullifier.slice(0, 18)}...`, 'ZK');
      log(`Proof inputs hash: ${p.proofInputsHash.slice(0, 18)}...`, 'ZK');
      log("Payload ready — submit to Aztec PXE to generate PLONK proof.", 'SUCCESS');
      toast.success("Private transfer payload constructed");
    } catch (e: any) {
      log(`ERROR: ${e.message}`, 'ERROR');
      toast.error("Build failed", { description: e.message?.slice(0, 60) });
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h3 className="text-xl font-light text-black mb-1">Private Transfer</h3>
        <p className="text-[11px] text-black/40 leading-relaxed max-w-sm">
          Constructs the cryptographic inputs for an Aztec L2 private transfer. The payload (note commitment + nullifier) is submitted to the PXE to generate a full PLONK proof.
        </p>
      </div>

      <div className="space-y-3">
        <div className="border border-black/10 focus-within:border-black transition-colors">
          <input
            type="text"
            value={recipient}
            onChange={e => setRecipient(e.target.value)}
            placeholder="Recipient Aztec Viewing Key (0x...)"
            className="w-full bg-transparent p-4 text-sm outline-none font-mono placeholder:text-black/20"
          />
        </div>
        <div className="border border-black/10 focus-within:border-black transition-colors relative">
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-transparent p-5 text-2xl font-light outline-none pr-20"
          />
          <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-bold text-black/30">ETH</span>
        </div>
      </div>

      {payload && (
        <div className="border border-black/10 p-5 space-y-3 text-[9px] font-mono">
          <div className="text-black/40 uppercase tracking-widest mb-2">Payload Output</div>
          {[
            ['Note Commitment', payload.noteCommitment],
            ['Nullifier', payload.nullifier],
            ['Proof Inputs Hash', payload.proofInputsHash],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="text-black/40 mb-0.5">{k}</div>
              <div className="text-black/70 break-all">{v}</div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={build}
        className="w-full py-5 bg-black text-white text-[10px] font-black uppercase tracking-[0.25em] hover:bg-black/80 transition-all flex items-center justify-center gap-3"
      >
        <EyeOff size={14} /> BUILD ZK PAYLOAD
      </button>
    </div>
  );
}

function PendingPanel({ pendingDeposit, lastTx, onRefresh }: any) {
  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h3 className="text-xl font-light text-black mb-1">Pending Queue</h3>
        <p className="text-[11px] text-black/40 leading-relaxed max-w-sm">
          Deposits confirmed on L1 waiting to be processed by the Aztec sequencer into shielded L2 notes.
        </p>
      </div>

      <div className="border border-black/10 p-8 flex flex-col items-center gap-4">
        <Hexagon size={36} strokeWidth={0.8} className="text-black/20" />
        <div className="text-center">
          <div className="text-[9px] text-black/40 uppercase tracking-widest mb-1">Pending L1 Balance</div>
          <div className="text-3xl font-light">{ethers.formatEther(pendingDeposit)} <span className="text-sm text-black/30">ETH</span></div>
        </div>
        {lastTx && (
          <a
            href={`https://etherscan.io/tx/${lastTx}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-black/40 hover:text-black transition-colors"
          >
            <ExternalLink size={10} /> View on Etherscan (L1)
          </a>
        )}
      </div>

      <button
        onClick={onRefresh}
        className="w-full py-4 border border-black/10 text-[9px] font-black uppercase tracking-[0.25em] hover:border-black hover:bg-black hover:text-white transition-all flex items-center justify-center gap-2"
      >
        <RefreshCw size={12} /> REFRESH FROM CHAIN
      </button>
    </div>
  );
}
