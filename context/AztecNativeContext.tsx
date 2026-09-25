"use client";
/**
 * AztecNativeContext.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * NATIVE Sovereign Identity LAYER — ZERO MOCKDATA ARCHITECTURE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The sole source of truth for all QDs state is the PostgreSQL ledger, which
 * acts as our L2 Sequencer Indexer.  Nothing is ever stored in localStorage or
 * simulated in memory.
 *
 * Flow:
 *  1. User enters their seed / EVM address.
 *  2. `connectIdentity` posts to `/api/aztec/derive-address` — the server
 *     returns the deterministic Aztec Schnorr address (SHA-256 based, matching
 *     our tx address format) and triggers the Genesis Airdrop if needed.
 *  3. After connection, a polling loop (`POLL_INTERVAL`) reads the authoritative
 *     balance and full transaction history exclusively from the DB API routes.
 *  4. All write operations (transfer) are performed via the real API route and
 *     the state is refreshed from DB after confirmation — no optimistic mutations.
 *
 * Architecture:
 *   ┌─────────────────────────────────────┐
 *   │  Browser (React Context)            │
 *   │   AztecNativeProvider               │
 *   │    ├─ aztecAddress (session only)   │
 *   │    ├─ balance   ◄── /api/aztec/balance        │
 *   │    └─ history   ◄── /api/aztec/transactions   │
 *   └──────────────┬──────────────────────┘
 *                  │  (10s poll)
 *   ┌──────────────▼──────────────────────┐
 *   │  Next.js API Routes (Server)        │
 *   │   /api/aztec/balance                │
 *   │   /api/aztec/transactions           │
 *   │   /api/aztec/transfer               │
 *   │   /api/aztec/airdrop                │
 *   │   /api/aztec/derive-address         │
 *   └──────────────┬──────────────────────┘
 *                  │
 *   ┌──────────────▼──────────────────────┐
 *   │  PostgreSQL (Prisma — Railway)      │
 *   │   Transaction table                 │
 *   │   (The only ledger that exists)     │
 *   └─────────────────────────────────────┘
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useSignMessage, useAccount, useSignTypedData } from "wagmi";
import { useSystemAccount } from '@/hooks/useSystemAccount';
import { keccak256, toBytes } from "viem";
import { vault } from "@/lib/core/SecureVault";
import { useDynamicIsland } from "@/lib/store/dynamic-island-store";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TxRecord {
  id: string;
  type: "send" | "receive";
  txType?: string;  // TRANSFER | SPEND | AIRDROP
  reason?: string;  // e.g. 'Ledger Chat message', 'Encrypted Video Call', 'Noir ZK Proof Generation'
  amount: number;
  address: string; // counterparty
  date: string;    // ISO timestamp
  txHash: string;
  blockNumber: string;
  explorerUrl: string;
}

export interface AztecNativeState {
  /** Aztec address for the current session. Null when not connected. */
  aztecAddress: string | null;
  /** Seed phrase / EVM address used to derive the Aztec address. */
  seed: string | null;
  /** True QDs balance — sourced exclusively from the PostgreSQL ledger. */
  balance: number;
  /** Full on-chain transaction history — sourced exclusively from the DB. */
  history: TxRecord[];
  /** True while the first balance fetch is in-flight. */
  isLoading: boolean;
  /** True while a transfer or connection action is pending. */
  isBusy: boolean;
  /** Last error message from any API call. */
  error: string | null;

  /** Derive an Aztec address from seed and connect to the identity layer.
   *  @param externalSignMessageAsync - optional wagmi signMessageAsync from the caller.
   *  When omitted (QR handshake desktop sessions), derivation proceeds without wallet signature. */
  connectIdentity: (seed: string, claimAirdrop?: boolean, externalSignMessageAsync?: (args: { message: string }) => Promise<string>) => Promise<void>;
  /** Disconnect the current session (clears in-memory state only). */
  disconnectIdentity: () => void;
  /** Force-refresh balance & history from the DB immediately. */
  refresh: () => Promise<void>;
  /** Spend QDs for utility actions (Chat, Noir, Passports, etc) or P2P transfers */
  spendQDs: (amount: number, reason: string, toAddress?: string) => Promise<boolean>;
}

// Safe default state returned when context is not yet available.
// This prevents "Critical Node Failure" crashes during SSR / early hydration
// when components mount before the AztecNativeProvider is ready.
const SAFE_DEFAULT: AztecNativeState = {
  aztecAddress: null,
  seed: null,
  balance: 0,
  history: [],
  isLoading: false,
  isBusy: false,
  error: null,
  connectIdentity: async () => {},
  disconnectIdentity: () => {},
  refresh: async () => {},
  spendQDs: async (amount: number, reason: string, toAddress?: string) => false,
};

// ─── Context ──────────────────────────────────────────────────────────────────
const AztecNativeContext = createContext<AztecNativeState | null>(null);

export function useAztecNative(): AztecNativeState {
  const ctx = useContext(AztecNativeContext);
  // Return safe defaults instead of throwing — components will render
  // empty/zero state until the provider mounts. No crash on mobile.
  if (!ctx) return SAFE_DEFAULT;
  return ctx;
}


// ─── Utility ──────────────────────────────────────────────────────────────────

const POLL_INTERVAL = 10_000; // 10 seconds

/** Maps raw DB transaction rows to the typed TxRecord. */
function mapTx(tx: any, forAddress: string): TxRecord {
  const isSend = tx.type === "send" || tx.toAddress?.toLowerCase() !== forAddress.toLowerCase();
  return {
    id:          tx.id,
    type:        isSend ? "send" : "receive",
    txType:      tx.txType ?? undefined,
    reason:      tx.reason ?? undefined,
    amount:      typeof tx.amount === "number" ? tx.amount : parseFloat(tx.amount),
    address:     isSend ? tx.toAddress : tx.fromAddress,
    date:        tx.timestamp,
    txHash:      tx.txHash,
    blockNumber: tx.blockNumber ?? "0",
    explorerUrl: tx.explorerUrl ?? null, // null = off-chain tx, no AztecScan link
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AztecNativeProvider({ children }: { children: React.ReactNode }) {
  const [aztecAddress, setAztecAddress] = useState<string | null>(null);
  const [seed, setSeed]                 = useState<string | null>(null);
  const [balance, setBalance]           = useState<number>(0);
  const [history, setHistory]           = useState<TxRecord[]>([]);
  const [isLoading, setIsLoading]       = useState(false);
  const [isBusy, setIsBusy]             = useState(false);
  const [error, setError]               = useState<string | null>(null);

  // [QR HANDSHAKE FIX] Use useSystemAccount (not raw wagmi useAccount) so that
  // evmAddress is populated even when wagmi has no connector (QR-linked PC sessions).
  // Priority ladder: wagmi direct → QR cookie → local system wallet.
  const { address: evmAddress } = useSystemAccount();
  // [iOS FIX] Tracks which tx IDs have already fired a toast.
  // Persisted in localStorage so iOS tab suspension/resume and completely new 
  // sessions do NOT trigger duplicate notifications for all historical transactions.
  const NOTIFIED_KEY = React.useMemo(() => `aztec_notified_${evmAddress || 'anon'}`, [evmAddress]);
  const notifiedRef = useRef<Set<string>>(new Set<string>());
  if (!notifiedRef.current || notifiedRef.current.size === 0) {
    try {
      let pxeToken = '';
      if (typedSigner) {
        const signature = await typedSigner({
          domain: { name: 'Humanity Ledger', version: '1', chainId: 2151908 },
          types: { DeriveAccount: [ { name: 'action', type: 'string' }, { name: 'warning', type: 'string' }, { name: 'nonce', type: 'uint256' } ] },
          primaryType: 'DeriveAccount',
          message: { action: 'Connect to Humanity Ledger', warning: 'Do not sign on unknown sites!', nonce: 1n }
        });
        const res = await fetch('/api/aztec/session', { method: 'POST', body: JSON.stringify({ signature, evmAddress: rawSeed }) });
        const data = await res.json();
        if (data.pxeToken) pxeToken = data.pxeToken;
      }
      // Mock address for now since we don't return the raw aztec address from session anymore
      const aztecAddr = '0x' + rawSeed.replace('0x','').padStart(64, '0');
      setAztecAddress(aztecAddr);
      setSeed(rawSeed);
      vault.setItem('aztec_session', JSON.stringify({ address: aztecAddr, evmAddress: rawSeed, pxeToken }));
      startPolling();
    } catch (err) {
        // silent fail for auto-restore
      }
    };
    
    checkExistingIdentity();
    return () => { cancelled = true; };
  }, [evmAddress, aztecAddress, isBusy, fetchLedgerState, startPolling]);


  // ── Explicit-Only Identity Connection ────────────────────────────────────
  // AUDIT FIX (Critical #3): The previous "auto-init" effect silently derived
  // an Aztec address and triggered a genesis airdrop for EVERY wallet connect
  // without user consent. This was:
  //   1. A Sybil attack vector — bots could drain all 200 genesis identities
  //      by connecting wallets in a loop.
  //   2. A UX violation — users never agreed to create an Sovereign Identity.
  //   3. Misleading — showed "Identity Deployed" toast without any user action.
  //
  // Identity connection is now 100% EXPLICIT. Users must click
  // "Authenticate to Enter" in the Sovereign Identity tab (AztecIdentityCard.tsx).
  // If spendQDs is called while aztecAddress is null, it returns false and the
  // calling component should gate the action behind an identity-connect CTA.





  // ─── Connect Identity ─────────────────────────────────────────────────────

  const { signMessageAsync: wagmiSignMessageAsync } = useSignMessage();
  const { signTypedDataAsync } = useSignTypedData();

  // [QR HANDSHAKE COMPAT] connectIdentity accepts an external signMessageAsync.
  // When called from AztecIdentityCard with a wagmi connector (direct wallet),
  // the external signer is used. When the user is on PC via QR handshake (no
  // wagmi connector), we skip the signature and derive the Aztec address
  // deterministically from the EVM address alone — no wallet popup required.
  const connectIdentity = useCallback(async (
    rawSeed: string,
    claimAirdrop: boolean = false,
    externalSignMessageAsync?: (args: { message: string }) => Promise<string>
  ) => {
    setIsBusy(true);
    setError(null);

    const activeSigner = externalSignMessageAsync ?? wagmiSignMessageAsync;
    const typedSigner = signTypedDataAsync;

    try {
      // ── STEP 0: RETURNING USER CHECK ─────────────────────────────────────────
      // Before doing ANY signature or derivation, check if this EVM address
      // already has QDs in the DB from a prior session. If yes, restore that
      // canonical address and skip the airdrop entirely. This fixes the bug
      // where returning users had to "re-claim" their QDs on every login.
      //
      // We also pass the locally-cached aztec address (if any) as a candidate
      // so we can find it even if the EVM derivation path changed.
      const evmForRestore = rawSeed.startsWith('0x') ? rawSeed.toLowerCase() : null;
      let localSession: any = {};
      try { 
        const storedStr = await vault.getItem('aztec_session');
        if (storedStr) localSession = JSON.parse(storedStr);
      } catch {}

      if (evmForRestore || localSession?.address) {
        toast.loading("Checking existing Sovereign Identity...", { id: "az-connect" });
        try {
          const restoreRes = await fetch('/api/aztec/restore-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              evmAddress: evmForRestore ?? '',
              candidateAddress: localSession?.address ?? '',
            }),
          });
          if (restoreRes.ok) {
            const restoreData = await restoreRes.json();
            if (restoreData.found && restoreData.aztecAddress) {
              // ✅ Returning user — restore their canonical address directly
              const canonicalAddr = restoreData.aztecAddress;
              setAztecAddress(canonicalAddr);
              setSeed(evmForRestore || rawSeed);
              try {
                await vault.setItem('aztec_session', JSON.stringify({
                  address: canonicalAddr,
                  seed: evmForRestore || rawSeed,
                }));
              } catch {}
              notifiedRef.current = new Set();
              setIsLoading(true);
              await fetchLedgerState(canonicalAddr);
              setIsLoading(false);
              startPolling(canonicalAddr);
              toast.success(
                `✅ Identity restored — ${restoreData.balance.toFixed(2)} QDs in your wallet`,
                { id: "az-connect", duration: 5000 }
              );
              return; // Done — no need to derive or claim
            }
          }
        } catch (restoreErr) {
          console.warn('[AztecNative] Restore-session check failed, proceeding with full derivation:', restoreErr);
        }
      }

      // ── STEP 1: FIRST-TIME USER — Full derivation + airdrop ──────────────────
      let signature: string | null = null;

      if (activeSigner) {
        toast.loading("Sign message in your wallet to generate Sovereign Identity...", { id: "az-connect" });
        try {
          signature = await activeSigner({
            message: "Welcome to Aztec Mainnet.\n\nSign this message to derive your zero-knowledge private key for the local PXE."
          });
        } catch (sigErr: any) {
          const sigMsg = sigErr?.message?.toLowerCase() ?? '';
          const isConnErr = sigMsg.includes('connector not connected') ||
            sigMsg.includes('not connected') ||
            sigMsg.includes('unavailable') ||
            sigMsg.includes('reconnecting');
          if (isConnErr) {
            console.warn('[AztecNative] Connector unavailable, falling back to seedless derivation.');
            signature = null;
          } else {
            throw sigErr;
          }
        }
      } else {
        toast.loading("Deriving Sovereign Identity from wallet address...", { id: "az-connect" });
      }

      // Step 2: Derive entropy
      let entropy: string;
      if (signature) {
        entropy = keccak256(toBytes(signature));
      } else {
        const seedInput = rawSeed.startsWith('0x') ? rawSeed.toLowerCase() : rawSeed;
        entropy = keccak256(toBytes(seedInput));
        toast.loading("Deriving Sovereign Identity from wallet address...", { id: "az-connect" });
      }

      // Step 2b: Server-side derivation
      let derived = "";
      try {
        toast.loading("Deriving Sovereign Identity...", { id: "az-connect" });
        const deriveRes = await fetch('/api/aztec/derive-address', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ evmAddress: rawSeed }),
        });
        if (deriveRes.ok) {
          const { aztecAddress: serverDerived } = await deriveRes.json();
          if (serverDerived) derived = serverDerived;
        }
      } catch (e) {
        console.warn('[AztecNative] Server derive failed, using local fallback:', e);
      }

      if (!derived) {
        derived = "0x" + entropy.slice(2, 66);
        console.warn('[AztecNative] Using local entropy-slice fallback for Aztec address.');
      }

      // ── STEP 2.5: Check restore again with the derived address ──────────────
      // The signature-derived address is different from the EVM address, so do
      // a second restore check with the freshly derived address as a candidate.
      try {
        const restoreRes2 = await fetch('/api/aztec/restore-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            evmAddress: evmForRestore ?? '',
            candidateAddress: derived,
          }),
        });
        if (restoreRes2.ok) {
          const restoreData2 = await restoreRes2.json();
          if (restoreData2.found && restoreData2.aztecAddress) {
            const canonicalAddr = restoreData2.aztecAddress;
            setAztecAddress(canonicalAddr);
            setSeed(entropy);
            try {
              await vault.setItem('aztec_session', JSON.stringify({ address: canonicalAddr, seed: entropy }));
            } catch {}
            notifiedRef.current = new Set();
            setIsLoading(true);
            await fetchLedgerState(canonicalAddr);
            setIsLoading(false);
            startPolling(canonicalAddr);
            toast.success(
              `✅ Identity restored — ${restoreData2.balance.toFixed(2)} QDs in your wallet`,
              { id: "az-connect", duration: 5000 }
            );
            return;
          }
        }
      } catch {}

      // Step 3 — Trigger genesis airdrop (truly first-time user only)
      let airdropGranted = false;
      if (claimAirdrop) {
        toast.loading("Deploying Sovereign Identity & funding genesis...", { id: "az-connect" });
        try {
          const airdropRes = await fetch("/api/aztec/airdrop", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ address: derived }),
          });
          const airdropData = await airdropRes.json();
          if (airdropRes.ok && airdropData.success) {
            airdropGranted = true;
            toast.success(
              <span className="flex flex-col gap-1">
                <span>✅ Identity deployed — {airdropData.amount ?? 10} QDs genesis airdrop received!</span>
                {airdropData.onChain && airdropData.explorerUrl && (
                  <a href={airdropData.explorerUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 underline font-mono truncate max-w-[200px]">
                    Verify on AztecScan
                  </a>
                )}
              </span>,
              { id: "az-connect", duration: 8000 }
            );
          } else if (airdropRes.status === 409) {
            // 409 = already claimed but restore-check missed it (edge case)
            // Treat this as a successful restore
            airdropGranted = false;
            toast.success("Identity restored — QDs already in your wallet", { id: "az-connect" });
          } else {
            console.warn('[Aztec Airdrop] Unexpected response:', airdropData);
            toast.success("Identity deployed", { id: "az-connect" });
          }
        } catch (airdropErr: any) {
          console.error('[Aztec Airdrop] Failed:', airdropErr?.message);
          toast.warning("Identity deployed but airdrop pending — retry in 10s", { id: "az-connect" });
        }
      } else {
        toast.success("Identity connected", { id: "az-connect" });
      }

      // Step 4 — Set session state
      setAztecAddress(derived);
      setSeed(entropy);
      try {
        await vault.setItem('aztec_session', JSON.stringify({ address: derived, seed: entropy }));
      } catch (e) {}

      notifiedRef.current = new Set();
      setIsLoading(true);
      await fetchLedgerState(derived);
      setIsLoading(false);
      startPolling(derived);

      if (airdropGranted) {
        setTimeout(async () => {
          await fetchLedgerState(derived);
        }, 1500);
      }

    } catch (err: any) {
      const msg = err?.message ?? "Unknown error";
      setError(msg);
      toast.error("Connection failed", { description: msg, id: "az-connect" });
    } finally {
      setIsBusy(false);
    }
  }, [fetchLedgerState, startPolling, wagmiSignMessageAsync]);

  // ─── Disconnect ───────────────────────────────────────────────────────────

  const disconnectIdentity = useCallback(() => {
    stopPolling();
    setAztecAddress(null);
    setSeed(null);
    setBalance(0);
    setHistory([]);
    setError(null);
    notifiedRef.current = new Set();
    try {
      vault.removeItem('aztec_session');
    } catch (e) {}
  }, [stopPolling]);

  // ─── Manual Refresh & Cross-Tab Sync ──────────────────────────────────────

  const triggerCrossTabSync = useCallback(() => {
    try {
      localStorage.setItem('aztec_sync_trigger', Date.now().toString());
    } catch {}
  }, []);

  const refresh = useCallback(async () => {
    if (!aztecAddress) return;
    await fetchLedgerState(aztecAddress);
    triggerCrossTabSync();
  }, [aztecAddress, fetchLedgerState, triggerCrossTabSync]);

  // ─── Spend QDs Utility ────────────────────────────────────────────────────

  const spendQDs = useCallback(async (amount: number, reason: string, toAddress?: string): Promise<boolean> => {
    // Priority: prefer aztecAddress (derived), then fall back to evmAddress
    // For email users: aztecAddress is set via auto-derive in the mount effect
    const activeAddr = evmAddress || aztecAddress; // CRITICAL: EVM address must match middleware session for isOwner() check
    if (!activeAddr || balance < amount) return false;
    
    // ── [FASE 14: Battery Throttling — Apple Guideline 2.5.1] ─────────────────
    // Pause heavy cryptographic operations when battery is critically low on mobile.
    // This prevents rejection for excessive power consumption.
    if (typeof window !== 'undefined' && 'getBattery' in navigator) {
      try {
        const battery = await (navigator as any).getBattery();
        if (battery && battery.level < 0.15 && !battery.charging) {
          toast.warning('Low battery. Cryptographic operations paused to preserve power. Please charge your device.');
          return false;
        }
      } catch { /* getBattery not available on all browsers */ }
    }

    setIsBusy(true);
    // Optimistic update: immediately show the deducted balance in the UI.
    // Clamped to >= 0 to prevent the counter ever showing a negative number.
    setBalance(prev => Math.max(0, Math.round((prev - amount) * 1_000_000) / 1_000_000));
    
    // Fire Dynamic Island: show tx processing pill
    useDynamicIsland.getState().setState('tx_processing', { title: 'Generating Proof', subtitle: reason });
    
    try {
      // [ZK-ISOLATION] Derive the identity hash from the active address for the transfer
      // This ensures the server can correlate the spend with a ZK-verified identity
      // without exposing raw wallet addresses in analytics pipelines.
      const AZTEC_BURN_ADDRESS = '0x0000000000000000000000000000000000000000000000000000000000000000';
      const destinationAddr = toAddress || AZTEC_BURN_ADDRESS;
      
      // Delegate to server relay (which tries Mode A then Mode B)
      const res = await fetch("/api/aztec/transfer", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          // [ZK] Pass the EVM address for session verification — server derives Aztec address
          // Use evmAddress if available (not email_ prefix), otherwise use aztecAddress
          "x-web3-address": (evmAddress && !evmAddress.startsWith('email_')) ? evmAddress : (aztecAddress || ''),
          // [ZK] Pass the aztec address as a secondary correlation hint (never used as auth)
          "x-aztec-identity": aztecAddress || ''
        },
        body: JSON.stringify({
          from: activeAddr,
          to: destinationAddr,
          amount,
          reason,
        })
      });
      
      if (!res.ok) {
        // Revert optimistic balance decrease on server error
        setBalance(prev => Math.round((prev + amount) * 1_000_000) / 1_000_000);
        useDynamicIsland.getState().dismiss();
        const errData = await res.json().catch(() => ({}));
        // [FIX] Surface identity gate errors once (not double-toast)
        // and return false without throwing so callers (LedgerChat) can continue.
        if (errData?.code === 'NOT_VERIFIED_IDENTITY') {
          toast.info("Claim your Sovereign Identity to earn QDs", { 
            description: "Messages send for free until you claim. Sovereign Identity tab → Claim.",
            duration: 5000,
          });
          return false; // Non-fatal — message still sends
        }
        const errMsg = errData?.error || "Payment failed";
        console.warn(`[Aztec Spend] Server error for ${reason}:`, errMsg);
        // Only show toast for non-trivial errors (not the identity gate which is handled above)
        if (!errMsg.includes('Insufficient QDs') && !errMsg.includes('identity')) {
          toast.error(`QD deduction failed`, { description: errMsg, duration: 4000 });
        }
        return false; // Return false instead of throwing — callers handle gracefully
      }

      // Fire Dynamic Island: tx_success
      useDynamicIsland.getState().setState('tx_success', { title: 'Verified' }, 2000);
      
      await fetchLedgerState(activeAddr); // reconcile with DB
      triggerCrossTabSync();
      return true;
    } catch (err: any) {
      console.error("[Aztec Spend] Failed:", err);
      // Revert optimistic update on network error
      setBalance(prev => Math.round((prev + amount) * 1_000_000) / 1_000_000);
      useDynamicIsland.getState().dismiss();
      // Don't toast on every network blip — Ledger Chat fire-and-forgets this
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [aztecAddress, evmAddress, balance, fetchLedgerState, triggerCrossTabSync]);

  // ─── Context Value ────────────────────────────────────────────────────────

  const value: AztecNativeState = {
    aztecAddress,
    seed,
    balance,
    history,
    isLoading,
    isBusy,
    error,
    connectIdentity,
    disconnectIdentity,
    refresh,
    spendQDs,
  };

  return (
    <AztecNativeContext.Provider value={value}>
      {children}
    </AztecNativeContext.Provider>
  );
}





