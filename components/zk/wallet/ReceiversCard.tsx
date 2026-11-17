'use client';

/**
 * components/zk/wallet/ReceiversCard.tsx — receiver addresses and the portal, in the private wallet.
 *
 *   Receive from Ethereum   receiver addresses (lib/portal/receivers.ts): an Ethereum address per
 *                           payer or purpose, with its QR; what arrives there becomes a private
 *                           deposit, claimed here after a random delay.
 *   Withdraw to Ethereum    burns a private balance and sends the withdrawal message; it is PUBLIC
 *                           and linked to this account until private fees exist (docs/PORTAL.md §3).
 *
 * Without a deployed portal for this build (the default today) the card says so and offers nothing.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { usePublicClient } from 'wagmi';
import { getPrivateWallet, humanError } from '@/lib/aztec/wallet/client';
import { PORTAL_CONFIG, type PortalAsset } from '@/lib/portal/config';
import { claimPlan, type PendingDeposit } from '@/lib/portal/receivers';
import { findDeposits } from '@/lib/portal/l1';
import { parseUnits, formatUnits } from '@/lib/aztec/wallet/amounts';
import { Card, CardHead, CopyKV, Notice, SecondaryButton, TextButton } from './WalletUI';

const INK = '#15171c';
const INK_3 = '#5b606b';
const COUNT_KEY = (evm: string) => `hl.portal.receivers.${evm.toLowerCase()}`;
const SEEN_KEY = (evm: string) => `hl.portal.seen.${evm.toLowerCase()}`;
const CLAIMED_KEY = (evm: string) => `hl.portal.claimed.${evm.toLowerCase()}`;
/** A claim waits 10 min to 6 h after the deposit is first seen (docs/RECEIVER_ADDRESSES.md §5). */
const MIN_DELAY = 600;
const MAX_DELAY = 6 * 3600;

function readJson<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* kept for this session only */
  }
}

/** A per-deposit random fraction, drawn once and remembered, so a reload does not redraw it. */
function delayFraction(evm: string, key: string): number {
  const all = readJson<Record<string, number>>(`hl.portal.delay.${evm.toLowerCase()}`, {});
  if (typeof all[key] !== 'number') {
    all[key] = crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
    writeJson(`hl.portal.delay.${evm.toLowerCase()}`, all);
  }
  return all[key];
}

type Receiver = { index: number; secretHash: string; rescueSigner: string; address: string | null };

export function ReceiversCard({ address, ready }: { address: string; ready: boolean }) {
  if (!PORTAL_CONFIG) {
    return (
      <Card label="Receive from Ethereum">
        <CardHead title="Receive from Ethereum" sub="Receiver addresses and withdrawals" />
        <div className="px-5 pb-5">
          <p className="text-[14px] leading-relaxed" style={{ color: INK_3 }}>
            Not available yet. The portal contracts are written and tested but not deployed on any network: they hold user funds and have no external audit.
          </p>
        </div>
      </Card>
    );
  }
  return <PortalCard address={address} ready={ready} />;
}

function PortalCard({ address, ready }: { address: string; ready: boolean }) {
  const cfg = PORTAL_CONFIG!;
  const evm = address.toLowerCase();
  const publicClient = usePublicClient({ chainId: cfg.l1ChainId });
  const [count, setCount] = useState<number>(() => Math.max(1, readJson<number>(COUNT_KEY(evm), 1)));
  const [receivers, setReceivers] = useState<Receiver[]>([]);
  const [shown, setShown] = useState<number | null>(null);
  const [deposits, setDeposits] = useState<PendingDeposit[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready) return;
    getPrivateWallet()
      .portalReceivers(count)
      .then(setReceivers)
      .catch((e) => toast.error(humanError(e)));
  }, [ready, count]);

  const assetOf = useCallback((l1: string) => cfg.assets.find((a) => a.l1 === l1.toLowerCase()), [cfg]);

  const check = async () => {
    if (!publicClient || !receivers.length) return;
    setBusy(true);
    try {
      const found = await findDeposits({ getLogs: (a: any) => (publicClient as any).getLogs(a) } as any, cfg, receivers.map((r) => r.secretHash));
      // The claim delay counts from when this wallet first saw the deposit, not from its block.
      const seen = readJson<Record<string, number>>(SEEN_KEY(evm), {});
      const now = Math.floor(Date.now() / 1000);
      for (const d of found) seen[`${d.token}:${d.index}`] ??= now;
      writeJson(SEEN_KEY(evm), seen);
      setDeposits(found.map((d) => ({ ...d, at: seen[`${d.token}:${d.index}`] })));
      if (!found.length) toast('No deposits to your receiver addresses yet.');
    } catch (e) {
      toast.error(humanError(e));
    } finally {
      setBusy(false);
    }
  };

  const plan = useMemo(
    () =>
      claimPlan(deposits, receivers, Math.floor(Date.now() / 1000), {
        minDelaySec: MIN_DELAY,
        maxDelaySec: MAX_DELAY,
        rand: (k) => delayFraction(evm, k),
        claimed: new Set(readJson<string[]>(CLAIMED_KEY(evm), [])),
      }),
    [deposits, receivers, evm],
  );

  const claim = async (d: PendingDeposit) => {
    const a = assetOf(d.token);
    if (!a) return toast.error('This asset is not supported here.');
    setBusy(true);
    try {
      await getPrivateWallet().claimPortalDeposit({ l2Token: a.l2, amount: d.amount, index: d.index, secretHash: d.secretHash }, count);
      writeJson(CLAIMED_KEY(evm), [...readJson<string[]>(CLAIMED_KEY(evm), []), `${d.token}:${d.index}`]);
      setDeposits((ds) => ds.filter((x) => !(x.token === d.token && x.index === d.index)));
      toast.success(`${formatUnits(d.amount, a.decimals, 6)} ${a.symbol} added to your private balance`);
    } catch (e) {
      toast.error(humanError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card label="Receive from Ethereum">
      <CardHead title="Receive from Ethereum" sub="Each address forwards what it receives into your private balance." />
      <div className="px-5 pb-5 space-y-4">
        {receivers.map((r) => (
          <div key={r.index} className="rounded-2xl border border-[#e4e7ec] p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[14px] font-semibold" style={{ color: INK }}>Address {r.index + 1}</span>
              <TextButton onClick={() => setShown(shown === r.index ? null : r.index)}>{shown === r.index ? 'Hide QR' : 'Show QR'}</TextButton>
            </div>
            {r.address && <CopyKV k="Ethereum address" v={r.address} />}
            {shown === r.index && r.address && (
              <div className="mt-3 flex justify-center">
                <QRCodeSVG value={`ethereum:${r.address}@${cfg.l1ChainId}`} size={184} level="M" includeMargin={false} fgColor={INK} bgColor="#ffffff" />
              </div>
            )}
          </div>
        ))}
        <p className="text-[13px] leading-relaxed" style={{ color: INK_3 }}>
          Send {cfg.assets.map((a) => a.symbol).join(', ')} on {cfg.l1ChainId === 1 ? 'Ethereum' : 'Sepolia'} to an address above. Anyone can then move it into the portal (Forward);
          it reaches your private balance when you claim it here. Nothing on Ethereum names your Aztec account. Give a different address to each payer: payments to one
          address are visibly grouped.
        </p>
        <SecondaryButton
          disabled={!ready || count >= 64}
          onClick={() => {
            const n = count + 1;
            setCount(n);
            writeJson(COUNT_KEY(evm), n);
          }}
        >
          New receiver address
        </SecondaryButton>

        <div className="pt-2 border-t border-[#e4e7ec]">
          <div className="flex items-center justify-between pt-3">
            <span className="text-[14px] font-semibold" style={{ color: INK }}>Deposits</span>
            <TextButton onClick={() => void check()} disabled={busy || !ready}>Check</TextButton>
          </div>
          {plan.ready.map((d) => {
            const a = assetOf(d.token);
            return (
              <div key={`${d.token}:${d.index}`} className="flex items-center justify-between gap-3 py-2">
                <span className="text-[14px]" style={{ color: INK }}>{a ? `${formatUnits(d.amount, a.decimals, 6)} ${a.symbol}` : 'Unknown asset'}</span>
                <TextButton onClick={() => void claim(d)} disabled={busy}>Claim</TextButton>
              </div>
            );
          })}
          {plan.waiting.length > 0 && (
            <p className="text-[13px] mt-1" style={{ color: INK_3 }}>
              {plan.waiting.length} deposit{plan.waiting.length === 1 ? '' : 's'} can be claimed after a short random wait, so the claim does not follow the payment at a predictable moment.
            </p>
          )}
        </div>

        <WithdrawForm assets={cfg.assets} ready={ready} />
      </div>
    </Card>
  );
}

function WithdrawForm({ assets, ready }: { assets: PortalAsset[]; ready: boolean }) {
  const [asset, setAsset] = useState<PortalAsset>(assets[0]);
  const [amount, setAmount] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const valid = /^0x[0-9a-fA-F]{40}$/.test(to) && /^\d+(\.\d+)?$/.test(amount) && Number(amount) > 0;

  const submit = async () => {
    setBusy(true);
    try {
      const { txHash } = await getPrivateWallet().portalWithdraw(asset.l2, to, parseUnits(amount, asset.decimals));
      toast.success(`Withdrawal started (${txHash.slice(0, 10)}…). It can be paid on Ethereum once Aztec proves its epoch.`);
      setAmount('');
    } catch (e) {
      toast.error(humanError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pt-2 border-t border-[#e4e7ec] space-y-3">
      <p className="pt-3 text-[14px] font-semibold" style={{ color: INK }}>Withdraw to Ethereum</p>
      <div className="flex gap-2" role="radiogroup" aria-label="Asset">
        {assets.map((a) => (
          <button
            key={a.symbol}
            type="button"
            role="radio"
            aria-checked={a.symbol === asset.symbol}
            onClick={() => setAsset(a)}
            className={`h-10 px-4 rounded-full text-[14px] font-medium border ${a.symbol === asset.symbol ? 'bg-[#15171c] text-white border-[#15171c]' : 'bg-white text-[#15171c] border-[#e4e7ec]'}`}
          >
            {a.symbol}
          </button>
        ))}
      </div>
      <input value={amount} onChange={(e) => setAmount(e.target.value.trim())} inputMode="decimal" placeholder="Amount" aria-label="Amount" className="w-full h-12 px-4 rounded-2xl border border-[#e4e7ec] text-[16px]" />
      <input value={to} onChange={(e) => setTo(e.target.value.trim())} placeholder="Ethereum address (0x…)" aria-label="Ethereum address" className="w-full h-12 px-4 rounded-2xl border border-[#e4e7ec] font-mono text-[14px]" />
      <Notice tone="warn">
        A withdrawal is public on Aztec: the Ethereum address and the amount are visible, in the same transaction as the network fee your account pays. Until private fees
        exist, anyone can see that this account withdrew to that address.
      </Notice>
      <label className="flex items-start gap-2 text-[13px]" style={{ color: INK }}>
        <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} className="mt-0.5" />
        I understand this withdrawal links my account to that Ethereum address.
      </label>
      <SecondaryButton disabled={!ready || !valid || !understood || busy} onClick={() => void submit()}>
        {busy ? 'Proving on this device' : 'Withdraw'}
      </SecondaryButton>
    </div>
  );
}
