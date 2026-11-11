'use client';

/**
 * Pay a contact's network fees on Aztec Alpha (Fee Juice), from your own Ethereum wallet.
 *
 * On Alpha every transaction pays its fee in Fee Juice, which only exists by bridging the
 * AZTEC token from Ethereum. Most people have none, so they cannot create their private
 * account or receive-and-spend a payment. A contact who has AZTEC opens the link the new
 * user shared (PrivateWallet.feeRequestLink) and deposits AZTEC for them through the pinned
 * FeeJuicePortal. The link holds the recipient's Aztec address and the hash of a claim
 * secret derived from the recipient's own wallet signature, nothing secret: only the
 * recipient can claim the deposit, on any device.
 *
 * Public on Ethereum: the sponsor's address, the recipient's Aztec address and the amount.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, Fuel, Loader2 } from 'lucide-react';
import { useAccount, useChainId, usePublicClient, useReadContract, useSwitchChain, useWalletClient } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { formatUnits, parseUnits } from 'viem';
import { AZTEC_WALLET_CONFIG, networkLabel } from '@/lib/aztec/wallet/config';
import { SPONSOR_SECRET_INDEX, humanError } from '@/lib/aztec/wallet/client';
import { bridgeFeeJuice, ERC20_ABI, l1ClientsFromViem, pinnedFeeJuice, type BridgeStep } from '@/lib/aztec/fee-juice';

const MAINNET = 1;
const HEX32 = /^0x[0-9a-fA-F]{64}$/;
const STEP_TEXT: Record<BridgeStep, string> = {
  checking: 'Checking…',
  approving: 'Approve the amount in your wallet…',
  'approval-confirming': 'Waiting for the approval on Ethereum…',
  depositing: 'Confirm the deposit in your wallet…',
  'deposit-confirming': 'Waiting for the deposit on Ethereum…',
  deposited: 'Deposited',
};

export function FeeSponsor() {
  const params = useMemo(() => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search)), []);
  const to = params?.get('to') ?? '';
  const secretHash = params?.get('h') ?? '';
  const valid = HEX32.test(to) && HEX32.test(secretHash);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { open } = useAppKit();
  const publicClient = usePublicClient({ chainId: MAINNET });
  const { data: walletClient } = useWalletClient({ chainId: MAINNET });
  const pin = pinnedFeeJuice('mainnet');
  const { data: held } = useReadContract({ address: pin.token as `0x${string}`, abi: ERC20_ABI, functionName: 'balanceOf', args: address ? [address] : undefined, chainId: MAINNET, query: { enabled: !!address } });

  const [amount, setAmount] = useState('10');
  const [ack, setAck] = useState(false);
  const [step, setStep] = useState<BridgeStep | null>(null);
  const [tx, setTx] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const units = useMemo(() => {
    if (!/^\d+(\.\d+)?$/.test(amount.trim())) return null;
    try { const u = parseUnits(amount.trim(), 18); return u > 0n ? u : null; } catch { return null; }
  }, [amount]);

  const pay = useCallback(async () => {
    if (busyRef.current || !units || !ack || !publicClient || !walletClient) return;
    busyRef.current = true;
    setError(null);
    try {
      if (chainId !== MAINNET) await switchChainAsync({ chainId: MAINNET });
      await bridgeFeeJuice(l1ClientsFromViem(publicClient, walletClient), { network: 'mainnet', recipient: to, amount: units, secretHash, secretIndex: SPONSOR_SECRET_INDEX }, (s, h) => {
        setStep(s);
        if (h) setTx(h);
      });
    } catch (e) {
      setError(humanError(e));
      setStep(null);
    } finally {
      busyRef.current = false;
    }
  }, [units, ack, publicClient, walletClient, chainId, switchChainAsync, to, secretHash]);

  const card = 'w-full max-w-md bg-white rounded-3xl border border-black/[0.06] shadow-sm p-6';
  if (AZTEC_WALLET_CONFIG.network !== 'mainnet') {
    return <div className={card}><p className="text-[14px] text-[#475467]">Network fees are only needed on Aztec Alpha. This build uses the test network, where fees are sponsored.</p></div>;
  }
  if (!valid) {
    return <div className={card}><p className="text-[14px] text-[#475467]">This link is not complete. Ask your contact to copy it again from their private wallet.</p></div>;
  }
  const done = step === 'deposited';
  const busy = step !== null && !done;
  return (
    <div className={card}>
      <span className="w-11 h-11 rounded-2xl bg-[#f2f4f7] flex items-center justify-center"><Fuel size={20} /></span>
      <h1 className="mt-3 text-[19px] font-semibold text-[#15171c]">Pay a contact's network fees</h1>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#475467]">
        Your AZTEC becomes Fee Juice for this {networkLabel()} account, so it can be created and pay its own transactions. Only its owner can use it. Fee Juice cannot be sent back.
      </p>
      <div className="mt-4 rounded-2xl bg-[#f7f8fa] px-4 py-3">
        <p className="text-[12px] text-[#727a88]">For the Aztec account</p>
        <p className="font-mono text-[12px] break-all text-[#15171c]">{to}</p>
      </div>

      {done ? (
        <div className="mt-5 flex gap-2 rounded-2xl bg-[#e9f7ef] px-4 py-3 text-[13.5px] text-[#0f6b45]">
          <CheckCircle2 size={17} className="shrink-0 mt-0.5" />
          <span>Done. The Fee Juice reaches Aztec in a few minutes; your contact's account sets itself up when they open their private wallet.</span>
        </div>
      ) : (
        <>
          <label className="mt-5 block text-[13px] font-medium text-[#15171c]" htmlFor="fee-amount">Amount of AZTEC</label>
          <input id="fee-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={busy}
            className="mt-1.5 w-full h-11 px-3 rounded-xl border border-[#e4e7ec] text-[15px] outline-none focus:border-[#98a2b3]" />
          {typeof held === 'bigint' && <p className="mt-1 text-[12px] text-[#727a88]">Your Ethereum wallet holds {formatUnits(held, 18)} AZTEC.</p>}
          <label className="mt-4 flex gap-2.5 text-[12.5px] leading-relaxed text-[#475467]">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} disabled={busy} className="mt-0.5" />
            <span>I understand this is public on Ethereum: my address, this Aztec account and the amount. It costs Ethereum gas for an approval and a deposit (about 310,000 gas).</span>
          </label>
          {error && <p className="mt-3 flex gap-2 text-[13px] text-[#b42318]"><AlertTriangle size={15} className="shrink-0 mt-0.5" />{error}</p>}
          {!isConnected ? (
            <button type="button" onClick={() => open()} className="mt-5 w-full h-12 rounded-2xl bg-[#15171c] text-white text-[14.5px] font-semibold">Connect your Ethereum wallet</button>
          ) : (
            <button type="button" onClick={pay} disabled={!units || !ack || busy || (typeof held === 'bigint' && !!units && units > held)}
              className="mt-5 w-full h-12 rounded-2xl bg-[#15171c] text-white text-[14.5px] font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
              {busy && <Loader2 size={16} className="animate-spin" />}
              {busy ? STEP_TEXT[step!] : `Pay ${amount || '0'} AZTEC of fees`}
            </button>
          )}
        </>
      )}
      {tx && (
        <a href={`https://etherscan.io/tx/${tx}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[12.5px] text-[#1a4fb8]">
          View on Etherscan <ExternalLink size={12} />
        </a>
      )}
    </div>
  );
}

/**
 * In the private wallet, while the account waits for Fee Juice: share a link so a contact pays
 * the network fees, and look for the deposit once they have.
 */
export function FeeRequestBox() {
  const publicClient = usePublicClient({ chainId: MAINNET });
  const [link, setLink] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const share = useCallback(async () => {
    setNote(null);
    try {
      const { getPrivateWallet } = await import('@/lib/aztec/wallet/client');
      const l = await getPrivateWallet().feeRequestLink();
      setLink(l);
      const text = 'Can you cover my Ledger Chat network fees? Open this link and pay a few AZTEC from your Ethereum wallet:';
      if (navigator.share) await navigator.share({ title: 'Ledger Chat network fees', text, url: l }).catch(() => {});
      else { await navigator.clipboard?.writeText(l); setNote('Link copied. Send it to a contact in a chat.'); }
    } catch (e) {
      setNote(humanError(e));
    }
  }, []);

  const check = useCallback(async () => {
    if (!publicClient || checking) return;
    setChecking(true);
    setNote(null);
    try {
      const { getPrivateWallet } = await import('@/lib/aztec/wallet/client');
      const n = await getPrivateWallet().recoverFeeJuiceClaims({ getLogs: (a: any) => (publicClient as any).getLogs(a) });
      setNote(n ? 'Fee Juice found. Your account is created as soon as it reaches Aztec (a few minutes).' : 'Nothing has arrived yet. Deposits show up a minute or two after the contact pays.');
    } catch (e) {
      setNote(humanError(e));
    } finally {
      setChecking(false);
    }
  }, [publicClient, checking]);

  return (
    <div className="mx-5 mb-5 rounded-2xl border border-black/[0.06] p-4">
      <p className="text-[13.5px] font-semibold text-[#15171c]">No AZTEC? Ask a contact</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-black/55">Share a link: a contact pays a few AZTEC of fees for your account from their Ethereum wallet. Only you can use them.</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={share} className="flex-1 h-10 rounded-xl bg-[#15171c] text-white text-[13px] font-medium">Share fee link</button>
        <button type="button" onClick={check} disabled={checking} className="flex-1 h-10 rounded-xl border border-[#e4e7ec] text-[13px] flex items-center justify-center gap-1.5">
          {checking && <Loader2 size={14} className="animate-spin" />} Check for fees
        </button>
      </div>
      {link && <p className="mt-2 font-mono text-[11px] break-all text-black/45">{link}</p>}
      {note && <p className="mt-2 text-[12.5px] text-[#475467]">{note}</p>}
    </div>
  );
}
