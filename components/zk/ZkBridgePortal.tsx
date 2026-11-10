'use client';

/**
 * ZkBridgePortal — Fee Juice station (gate G2).
 *
 * On Aztec Alpha (NEXT_PUBLIC_AZTEC_NETWORK=alpha, enabled in config.ts) this
 * is where a person moves AZTEC from their own Ethereum wallet into Fee Juice
 * for their private account, through the pinned FeeJuicePortal on Ethereum
 * mainnet (lib/aztec/fee-juice.ts). Each deposit is shown through its whole
 * life: approval, deposit on Ethereum, arriving on Aztec, ready, and consumed
 * by the next Aztec transaction (FeeJuicePaymentMethodWithClaim). Nothing is
 * bridged anywhere else and nothing comes back: the bridge is one way, by
 * protocol design.
 *
 * On the test network fees are sponsored, so there is nothing to bridge and
 * the component says so.
 *
 * Replaces a demo bridge that sent real ETH / USDC / DAI with a plain
 * transfer to the retired Aztec Connect contract (funds sent there are not
 * recoverable), and whose production branch crashed on an unimported icon.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, ExternalLink, Fuel, Loader2, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { useAccount, useBalance, useChainId, usePublicClient, useReadContract, useSwitchChain, useWalletClient } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { toast } from 'sonner';

import { AZTEC_WALLET_CONFIG, networkLabel } from '@/lib/aztec/wallet/config';
import { useAztecWallet } from '@/lib/aztec/wallet/useAztecWallet';
import { getPrivateWallet, humanError } from '@/lib/aztec/wallet/client';
import { ERC20_ABI, l1ClientsFromViem, pinnedFeeJuice, type BridgeStep, type FeeJuiceClaim } from '@/lib/aztec/fee-juice';

interface ZkBridgePortalProps {
  userAddress: string;
  onClose?: () => void;
  className?: string;
}

const MAINNET_CHAIN_ID = 1;

const STEP_LABEL: Record<BridgeStep, string> = {
  checking: 'Checking your AZTEC and ETH balances',
  approving: 'Approve the exact amount in your wallet',
  'approval-confirming': 'Waiting for the approval on Ethereum',
  depositing: 'Confirm the deposit in your wallet',
  'deposit-confirming': 'Depositing on Ethereum. Waiting for the block',
  deposited: 'Deposited on Ethereum',
};

const shortHash = (h?: string) => (h ? `${h.slice(0, 10)}…${h.slice(-6)}` : '');

export function ZkBridgePortal({ userAddress, onClose, className = '' }: ZkBridgePortalProps) {
  const alpha = AZTEC_WALLET_CONFIG.network === 'mainnet';
  return (
    <div className={`bg-white rounded-3xl border border-[#E4E7EC] shadow-sm overflow-hidden flex flex-col ${className}`}>
      <div className="px-5 py-4 flex items-center justify-between border-b border-[#E4E7EC] bg-[#F7F8FA]">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-2xl bg-[#5200FF]/10 text-[#5200FF] flex items-center justify-center" aria-hidden="true">
            <Fuel size={18} strokeWidth={2.2} />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-[#15171C] leading-tight">Network fees</h2>
            <p className="text-[12px] text-[#667085]">{networkLabel()}</p>
          </div>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close" className="w-11 h-11 -mr-2 rounded-full flex items-center justify-center text-[#667085] hover:bg-black/5">
            <X size={18} />
          </button>
        )}
      </div>
      {alpha ? (
        <FeeJuiceStation userAddress={userAddress} />
      ) : (
        <div className="p-5 text-[14px] leading-relaxed text-[#475467]">
          On the Aztec test network every transaction is paid by the network&apos;s sponsor, so there is nothing to top up.
          On Aztec Alpha you pay fees in Fee Juice, which you add here from your Ethereum wallet.
        </div>
      )}
    </div>
  );
}

function FeeJuiceStation({ userAddress }: { userAddress: string }) {
  const { state, open, walletConnected, sameAccount } = useAztecWallet(userAddress);
  const { address: evm, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync, isPending: switching } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: MAINNET_CHAIN_ID });
  const { data: walletClient } = useWalletClient({ chainId: MAINNET_CHAIN_ID });
  const pin = pinnedFeeJuice('mainnet');
  const evmAddr = evm as `0x${string}` | undefined;

  const { data: eth } = useBalance({ address: evmAddr, chainId: MAINNET_CHAIN_ID, query: { enabled: !!evmAddr } });
  const { data: aztecUnits, refetch: refetchAztec } = useReadContract({
    address: pin.token as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: evmAddr ? [evmAddr] : undefined,
    chainId: MAINNET_CHAIN_ID,
    query: { enabled: !!evmAddr },
  });
  const { data: decimalsRaw } = useReadContract({
    address: pin.token as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'decimals',
    chainId: MAINNET_CHAIN_ID,
  });
  const decimals = decimalsRaw === undefined ? undefined : Number(decimalsRaw);

  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<BridgeStep | null>(null);
  const [l1Tx, setL1Tx] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  // Explicit per-deposit consent to what becomes public; never persisted.
  const [ackPublic, setAckPublic] = useState(false);
  // Idempotency: one deposit at a time, whatever the number of taps.
  const submitting = useRef(false);

  const fj = state.feeJuice;
  const ready = state.phase === 'ready' || state.phase === 'needs-fee-juice';

  useEffect(() => {
    if (ready && state.aztecAddress) {
      getPrivateWallet().refreshFeeJuice().catch(() => {});
    }
  }, [ready, state.aztecAddress]);

  const units = useMemo(() => {
    if (decimals === undefined || !/^\d+(\.\d+)?$/.test(amount.trim())) return null;
    try {
      const u = parseUnits(amount.trim(), decimals);
      return u > 0n ? u : null;
    } catch {
      return null;
    }
  }, [amount, decimals]);

  const held = typeof aztecUnits === 'bigint' ? aztecUnits : 0n;
  const tooMuch = units !== null && units > held;
  const wrongChain = isConnected && chainId !== MAINNET_CHAIN_ID;
  const busy = step !== null && step !== 'deposited';

  const bridge = useCallback(async () => {
    if (submitting.current || !units || !walletClient || !publicClient || !ackPublic) return;
    submitting.current = true;
    setError(null);
    setL1Tx(undefined);
    try {
      const l1 = l1ClientsFromViem(publicClient, walletClient);
      await getPrivateWallet().bridgeFeeJuice(l1, units, (s, hash) => {
        setStep(s);
        if (hash) setL1Tx(hash);
      });
      setAmount('');
      setAckPublic(false);
      refetchAztec();
      toast.success('Deposited on Ethereum. Your Fee Juice arrives on Aztec in a few minutes.');
    } catch (err) {
      setError(humanError(err));
      setStep(null);
    } finally {
      submitting.current = false;
    }
  }, [units, walletClient, publicClient, refetchAztec, ackPublic]);

  const recover = useCallback(async () => {
    if (!publicClient || recovering) return;
    setRecovering(true);
    try {
      const n = await getPrivateWallet().recoverFeeJuiceClaims({ getLogs: (a) => publicClient.getLogs(a) });
      toast.success(n ? `Found ${n} deposit${n === 1 ? '' : 's'} on Ethereum.` : 'No deposits to this account were found on Ethereum.');
    } catch (err) {
      toast.error(humanError(err));
    } finally {
      setRecovering(false);
    }
  }, [publicClient, recovering]);

  if (!state.aztecAddress) {
    return (
      <div className="p-5 space-y-3">
        <p className="text-[14px] text-[#475467] leading-relaxed">Open your private wallet first. Fee Juice is added to that account.</p>
        <button
          type="button"
          disabled={!walletConnected || !sameAccount || state.phase === 'signing' || state.phase === 'starting'}
          onClick={() => open().catch((e) => toast.error(humanError(e)))}
          className="w-full min-h-[44px] rounded-2xl bg-[#15171C] text-white text-[14px] font-semibold disabled:opacity-40"
        >
          {state.phase === 'signing' || state.phase === 'starting' ? state.step ?? 'Opening…' : 'Open private wallet'}
        </button>
        {state.error && <p className="text-[13px] text-[#FF3B30]">{state.error}</p>}
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4">
      {state.phase === 'needs-fee-juice' && (
        <div className="rounded-2xl bg-[#F1EBFF] text-[#3B00B8] px-4 py-3 text-[13.5px] leading-relaxed">{state.step}</div>
      )}

      <dl className="grid grid-cols-2 gap-3">
        <Stat label="Fee Juice on Aztec" value={fj ? `${formatUnits(fj.balance, 18)}` : '…'} />
        <Stat label="AZTEC on Ethereum" value={decimals === undefined ? '…' : formatUnits(held, decimals)} />
        <Stat label="ETH for Ethereum gas" value={eth ? Number(eth.formatted).toFixed(5) : '…'} />
        <Stat label="Next fee paid by" value={fj ? planLabel(fj.plan) : '…'} />
      </dl>

      <div>
        <label htmlFor="fj-amount" className="block text-[12px] font-medium text-[#667085] mb-1.5">AZTEC to add as Fee Juice</label>
        <div className="flex gap-2">
          <input
            id="fj-amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(',', '.'))}
            disabled={busy}
            className="flex-1 min-h-[44px] rounded-2xl bg-[#F7F8FA] border border-[#E4E7EC] px-4 text-[16px] font-mono tabular-nums text-[#15171C] outline-none focus:border-[#5200FF]"
          />
        </div>
        {tooMuch && <p className="mt-1.5 text-[13px] text-[#FF3B30]">That is more AZTEC than your Ethereum wallet holds.</p>}
      </div>

      {!isConnected ? (
        <p className="text-[13.5px] text-[#475467]">Connect the Ethereum wallet that holds your AZTEC.</p>
      ) : wrongChain ? (
        <button
          type="button"
          disabled={switching}
          onClick={() => switchChainAsync({ chainId: MAINNET_CHAIN_ID }).catch((e) => toast.error(humanError(e)))}
          className="w-full min-h-[44px] rounded-2xl bg-[#15171C] text-white text-[14px] font-semibold disabled:opacity-40"
        >
          {switching ? 'Switching…' : 'Switch your wallet to Ethereum mainnet'}
        </button>
      ) : (
        <>
        <label className="flex items-start gap-2 text-[12.5px] leading-snug text-[#475467]">
          <input type="checkbox" className="mt-0.5" checked={ackPublic} disabled={busy} onChange={(e) => setAckPublic(e.target.checked)} />
          <span>I understand this deposit is public on Ethereum, links my Ethereum and Aztec addresses, and that my Aztec account pays each fee publicly, so my transactions can be linked. Fee Juice cannot be sent back.</span>
        </label>
        <button
          type="button"
          disabled={!units || tooMuch || busy || !walletClient || !ackPublic}
          onClick={bridge}
          className="w-full min-h-[44px] rounded-2xl bg-[#15171C] text-white text-[14px] font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
          {busy ? STEP_LABEL[step!] : 'Add Fee Juice'}
        </button>
        </>
      )}

      {step && (
        <p className="text-[13px] text-[#475467] flex items-center gap-2" role="status">
          {step === 'deposited' ? <CheckCircle2 size={14} className="text-[#10B981]" /> : <Clock size={14} />}
          {STEP_LABEL[step]}
          {l1Tx && (
            <a href={`https://etherscan.io/tx/${l1Tx}`} target="_blank" rel="noopener noreferrer" className="font-mono text-[12px] underline inline-flex items-center gap-1">
              {shortHash(l1Tx)} <ExternalLink size={11} />
            </a>
          )}
        </p>
      )}
      {error && (
        <p className="text-[13px] text-[#FF3B30] flex items-start gap-2" role="alert">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {fj && fj.claims.length > 0 && (
        <div>
          <h3 className="text-[12px] font-medium text-[#667085] mb-2">Deposits on their way</h3>
          <ul className="space-y-2">
            {fj.claims.map(({ claim, ready: isReady }) => (
              <ClaimRow key={claim.messageHash} claim={claim} ready={isReady} />
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => getPrivateWallet().refreshFeeJuice().catch(() => {})}
          className="min-h-[44px] px-3 text-[13px] font-medium text-[#15171C] inline-flex items-center gap-1.5"
        >
          <RefreshCw size={14} /> Refresh
        </button>
        {AZTEC_WALLET_CONFIG.l1FromBlock > 0n && (
          <button type="button" onClick={recover} disabled={recovering} className="min-h-[44px] px-3 text-[13px] font-medium text-[#15171C] disabled:opacity-40">
            {recovering ? 'Searching Ethereum…' : 'Find deposits made on another device'}
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-[#E4E7EC] px-4 py-3 text-[12.5px] leading-relaxed text-[#475467] space-y-1.5">
        <p className="flex items-start gap-2">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#10B981]" />
          <span>
            <strong className="text-[#15171C]">What stays private:</strong> the amounts, senders and recipients of your private payments, and your private balances.
          </span>
        </p>
        <p>
          <strong className="text-[#15171C]">What is public:</strong> the deposit on Ethereum (your Ethereum address, the amount and your Aztec address), and the fact that your Aztec account pays each network fee. Someone watching can link your Aztec transactions to each other and to this deposit.
        </p>
        <p>
          The bridge is one way: Fee Juice can only pay Aztec fees and cannot be sent back to Ethereum. Add only what you expect to spend on fees.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#F7F8FA] border border-[#E4E7EC] px-3.5 py-2.5">
      <dt className="text-[11.5px] text-[#667085]">{label}</dt>
      <dd className="text-[15px] font-semibold text-[#15171C] font-mono tabular-nums truncate">{value}</dd>
    </div>
  );
}

function planLabel(plan: string): string {
  if (plan === 'claim') return 'Arrived deposit';
  if (plan === 'balance') return 'Your Fee Juice';
  if (plan === 'wait-claim') return 'Waiting for deposit';
  return 'Add Fee Juice';
}

function ClaimRow({ claim, ready }: { claim: FeeJuiceClaim; ready: boolean }) {
  return (
    <li className="rounded-2xl border border-[#E4E7EC] px-3.5 py-2.5 flex items-center justify-between gap-3">
      <span className="flex flex-col min-w-0">
        <span className="text-[14px] font-semibold text-[#15171C] font-mono tabular-nums">{formatUnits(BigInt(claim.claimAmount), 18)} AZTEC</span>
        {claim.l1TxHash && (
          <a href={`https://etherscan.io/tx/${claim.l1TxHash}`} target="_blank" rel="noopener noreferrer" className="text-[12px] font-mono text-[#667085] underline truncate">
            {shortHash(claim.l1TxHash)}
          </a>
        )}
      </span>
      <span className={`shrink-0 text-[12px] font-semibold px-2.5 py-1 rounded-full ${ready ? 'bg-[#ECFDF3] text-[#027A48]' : 'bg-[#F2F4F7] text-[#475467]'}`}>
        {ready ? 'Ready, used by your next transaction' : 'Arriving on Aztec'}
      </span>
    </li>
  );
}
