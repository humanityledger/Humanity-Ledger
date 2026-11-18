'use client';

/**
 * components/zk/wallet/ReceiversCard.tsx — Ethereum, in the private wallet: receiver addresses,
 * deposits and withdrawals through the portal.
 *
 *   Receive    receiver addresses (lib/portal/receivers.ts): an Ethereum address per payer or
 *              purpose, with its QR; what arrives there becomes a private deposit.
 *   Deposits   deposits to this account's receivers, each claimable after a random delay so the
 *              claim does not follow the payment at a predictable moment.
 *   Withdraw   burns a private balance and sends the withdrawal message. It is PUBLIC and linked to
 *              this account until private fees exist (docs/PORTAL.md §3), so it goes through a
 *              review step that says so, and an address of one's own receivers is refused.
 *
 * Without a deployed portal for this build (the default today) the card says where the portal
 * stands and offers nothing that moves money.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BrandedQr } from '@/components/chat/profile/BrandedQr';
import { usePublicClient } from 'wagmi';
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Circle, Clock, Plus } from 'lucide-react';
import { getPrivateWallet, humanError } from '@/lib/aztec/wallet/client';
import { PORTAL_CONFIG, type PortalAsset } from '@/lib/portal/config';
import { claimPlan, type PendingDeposit } from '@/lib/portal/receivers';
import { findDeposits } from '@/lib/portal/l1';
import { withdrawProblem } from '@/lib/portal/withdraw';
import { parseUnits, formatUnits } from '@/lib/aztec/wallet/amounts';
import { AddressBox, Card, CardHead, FOCUS, INK, INK_2, INK_3, KV, Notice, OK, Pill, PrimaryButton, Segmented, TextButton, shortHex } from './WalletUI';

const COUNT_KEY = (evm: string) => `hl.portal.receivers.${evm.toLowerCase()}`;
const SEEN_KEY = (evm: string) => `hl.portal.seen.${evm.toLowerCase()}`;
const CLAIMED_KEY = (evm: string) => `hl.portal.claimed.${evm.toLowerCase()}`;
/** A claim waits 10 min to 6 h after the deposit is first seen (docs/RECEIVER_ADDRESSES.md §5). */
const MIN_DELAY = 600;
const MAX_DELAY = 6 * 3600;
const MAX_RECEIVERS = 64;
/**
 * A withdrawal has two halves: the burn on Aztec (here) and the payout on Ethereum, which needs
 * the Outbox membership proof of the epoch. Until the wallet fetches that proof and sends the
 * payout itself, starting a withdrawal would burn funds that only a script can finish, so the form
 * stays off. Turn on together with the payout step (docs/PORTAL.md §3).
 */
const WITHDRAW_COMPLETES_IN_WALLET = false;

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

function waitText(sec: number): string {
  if (sec <= 60) return 'in a minute';
  const m = Math.ceil(sec / 60);
  if (m < 60) return `in ${m} min`;
  const h = Math.floor(m / 60);
  return `in ${h} h${m % 60 ? ` ${m % 60} min` : ''}`;
}

type Receiver = { index: number; secretHash: string; rescueSigner: string; address: string | null };
type Tab = 'receive' | 'deposits' | 'withdraw';

export function ReceiversCard({ address, ready }: { address: string; ready: boolean }) {
  if (!PORTAL_CONFIG) return <PortalNotDeployed />;
  return <PortalCard address={address} ready={ready} />;
}

/** Where the portal stands, step by step, while no build has it deployed. */
function PortalNotDeployed() {
  const steps: Array<{ done: boolean; label: string; detail: string }> = [
    { done: true, label: 'Contracts written', detail: 'HLPortal and receiver addresses on Ethereum, PortalToken on Aztec.' },
    { done: true, label: 'Tested on every change', detail: 'Hardhat on Ethereum and the Aztec test environment, in CI.' },
    { done: false, label: 'External audit', detail: 'Required before the portal holds anyone’s funds.' },
    { done: false, label: 'Deployed', detail: 'On Sepolia first, then Ethereum with low caps.' },
  ];
  return (
    <Card label="Ethereum">
      <CardHead title="Ethereum" sub="Receive from any Ethereum wallet into your private balance, and withdraw back." action={<Pill>Not live yet</Pill>} />
      <ol className="px-5 pb-4 pt-1" aria-label="Portal status">
        {steps.map((s) => (
          <li key={s.label} className="flex gap-3 py-2.5">
            {s.done ? (
              <CheckCircle2 size={18} strokeWidth={2} className="mt-[1px] shrink-0" style={{ color: OK }} aria-hidden="true" />
            ) : (
              <Circle size={18} strokeWidth={2} className="mt-[1px] shrink-0" style={{ color: '#98a2b3' }} aria-hidden="true" />
            )}
            <span className="min-w-0">
              <span className="block text-[14.5px] font-semibold" style={{ color: s.done ? INK : INK_2 }}>
                <span className="sr-only">{s.done ? 'Done: ' : 'Not yet: '}</span>
                {s.label}
              </span>
              <span className="block text-[13px] leading-snug" style={{ color: INK_3 }}>{s.detail}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="px-5 pb-5 text-[13px] leading-relaxed" style={{ color: INK_3 }}>
        Nothing here moves money until the portal is deployed for this network. Until then, Fee Juice from Ethereum is the way in.
      </p>
    </Card>
  );
}

function PortalCard({ address, ready }: { address: string; ready: boolean }) {
  const cfg = PORTAL_CONFIG!;
  const evm = address.toLowerCase();
  const l1Name = cfg.l1ChainId === 1 ? 'Ethereum' : 'Sepolia';
  const publicClient = usePublicClient({ chainId: cfg.l1ChainId });
  const [tab, setTab] = useState<Tab>('receive');
  const [count, setCount] = useState<number>(() => Math.min(MAX_RECEIVERS, Math.max(1, readJson<number>(COUNT_KEY(evm), 1))));
  const [receivers, setReceivers] = useState<Receiver[]>([]);
  const [selected, setSelected] = useState(0);
  const [deposits, setDeposits] = useState<PendingDeposit[]>([]);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    if (!ready) return;
    let live = true;
    getPrivateWallet()
      .portalReceivers(count)
      .then((r) => live && setReceivers(r))
      .catch((e) => toast.error(humanError(e)));
    return () => {
      live = false;
    };
  }, [ready, count]);

  // Waiting deposits count down without a rescan.
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30_000);
    return () => clearInterval(t);
  }, []);

  const assetOf = useCallback((l1: string) => cfg.assets.find((a) => a.l1 === l1.toLowerCase()), [cfg]);

  const check = async () => {
    if (!publicClient || !receivers.length) return;
    setBusy('check');
    try {
      const found = await findDeposits(
        { getLogs: (a: any) => (publicClient as any).getLogs(a), getBlockNumber: () => publicClient.getBlockNumber() } as any,
        cfg,
        receivers.map((r) => r.secretHash),
      );
      // The claim delay counts from when this wallet first saw the deposit, not from its block.
      const seen = readJson<Record<string, number>>(SEEN_KEY(evm), {});
      const t = Math.floor(Date.now() / 1000);
      for (const d of found) seen[`${d.token}:${d.index}`] ??= t;
      writeJson(SEEN_KEY(evm), seen);
      setDeposits(found.map((d) => ({ ...d, at: seen[`${d.token}:${d.index}`] })));
      setCheckedAt(Date.now());
      setNow(t);
    } catch (e) {
      toast.error(humanError(e));
    } finally {
      setBusy(null);
    }
  };

  const plan = useMemo(
    () =>
      claimPlan(deposits, receivers, now, {
        minDelaySec: MIN_DELAY,
        maxDelaySec: MAX_DELAY,
        rand: (k) => delayFraction(evm, k),
        claimed: new Set(readJson<string[]>(CLAIMED_KEY(evm), [])),
      }),
    [deposits, receivers, evm, now],
  );

  const claim = async (d: PendingDeposit) => {
    const a = assetOf(d.token);
    if (!a) return toast.error('This asset is not supported here.');
    const key = `${d.token}:${d.index}`;
    setBusy(key);
    try {
      await getPrivateWallet().claimPortalDeposit({ l2Token: a.l2, amount: d.amount, index: d.index, secretHash: d.secretHash }, count);
      writeJson(CLAIMED_KEY(evm), [...readJson<string[]>(CLAIMED_KEY(evm), []), key]);
      setDeposits((ds) => ds.filter((x) => !(x.token === d.token && x.index === d.index)));
      toast.success(`${formatUnits(d.amount, a.decimals, 6)} ${a.symbol} added to your private balance`);
    } catch (e) {
      toast.error(humanError(e));
    } finally {
      setBusy(null);
    }
  };

  const pending = plan.ready.length + plan.waiting.length;
  const current = receivers.find((r) => r.index === selected) ?? receivers[0];
  const ownAddresses = useMemo(() => new Set(receivers.map((r) => r.address?.toLowerCase()).filter(Boolean) as string[]), [receivers]);

  return (
    <Card label="Ethereum">
      <CardHead
        title="Ethereum"
        sub={`Receive ${cfg.assets.map((a) => a.symbol).join(', ')} from any ${l1Name} wallet into your private balance.`}
        action={<Pill tone="ok">{l1Name}</Pill>}
      />
      <div className="px-5 pt-2 pb-5">
        <Segmented<Tab>
          label="Ethereum portal"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'receive', label: 'Receive' },
            { value: 'deposits', label: 'Deposits', badge: pending || undefined },
            { value: 'withdraw', label: 'Withdraw' },
          ]}
        />

        {tab === 'receive' && (
          <div className="mt-4 space-y-3" role="tabpanel" aria-label="Receive">
            {!ready || !current ? (
              <div className="h-[260px] rounded-2xl bg-[#f7f8fa] animate-pulse motion-reduce:animate-none" aria-busy="true" />
            ) : (
              <>
                {receivers.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1" role="radiogroup" aria-label="Receiver address">
                    {receivers.map((r) => (
                      <button
                        key={r.index}
                        type="button"
                        role="radio"
                        aria-checked={r.index === current.index}
                        onClick={() => setSelected(r.index)}
                        className={`h-9 px-3.5 rounded-full text-[13.5px] font-semibold border whitespace-nowrap ${FOCUS} ${
                          r.index === current.index ? 'bg-[#15171c] text-white border-[#15171c]' : 'bg-white text-[#15171c] border-[#e4e7ec] hover:bg-[#f7f8fa]'
                        }`}
                      >
                        Address {r.index + 1}
                      </button>
                    ))}
                  </div>
                )}
                {current.address && (
                  <>
                    <div className="rounded-2xl border border-[#e4e7ec] bg-white p-5 flex flex-col items-center">
                      <BrandedQr value={`ethereum:${current.address}@${cfg.l1ChainId}`} title={`QR code for ${l1Name} address`} style={{ width: 196 }} />
                      <span className="mt-3 text-[12.5px] font-medium" style={{ color: INK_3 }}>
                        {l1Name} · {cfg.assets.map((a) => a.symbol).join(' · ')}
                      </span>
                    </div>
                    <AddressBox label={`Address ${current.index + 1}`} value={current.address} />
                  </>
                )}
                <ul className="space-y-1.5 text-[13px] leading-snug" style={{ color: INK_2 }}>
                  <li>Give a different address to each payer. Payments to one address are visibly grouped on {l1Name}.</li>
                  <li>Nothing on {l1Name} names your Aztec account. The money becomes private when you claim it under Deposits.</li>
                  <li>Send only {cfg.assets.map((a) => a.symbol).join(', ')} on {l1Name}. Anything else sent here is not credited.</li>
                </ul>
                <button
                  type="button"
                  disabled={count >= MAX_RECEIVERS}
                  onClick={() => {
                    const n = count + 1;
                    setCount(n);
                    setSelected(n - 1);
                    writeJson(COUNT_KEY(evm), n);
                  }}
                  className={`w-full min-h-[48px] rounded-2xl border border-dashed border-[#d0d5dd] text-[14.5px] font-semibold inline-flex items-center justify-center gap-2 hover:bg-[#f7f8fa] disabled:opacity-40 ${FOCUS}`}
                  style={{ color: INK }}
                >
                  <Plus size={16} strokeWidth={2.2} aria-hidden="true" />
                  {count >= MAX_RECEIVERS ? `At most ${MAX_RECEIVERS} addresses` : 'New receiver address'}
                </button>
              </>
            )}
          </div>
        )}

        {tab === 'deposits' && (
          <div className="mt-4" role="tabpanel" aria-label="Deposits">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px]" style={{ color: INK_3 }} role="status" aria-live="polite">
                {busy === 'check' ? `Reading ${l1Name}…` : checkedAt ? `Checked at ${new Date(checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not checked yet'}
              </span>
              <TextButton onClick={() => void check()} disabled={!!busy || !ready || !receivers.length}>
                Check {l1Name}
              </TextButton>
            </div>
            {pending === 0 ? (
              <div className="mt-3 rounded-2xl border border-dashed border-[#d0d5dd] px-4 py-6 text-center">
                <ArrowDownLeft size={20} strokeWidth={2} className="mx-auto" style={{ color: INK_3 }} aria-hidden="true" />
                <p className="mt-2 text-[14px]" style={{ color: INK_2 }}>{checkedAt ? 'No deposits to your receiver addresses yet.' : `Check ${l1Name} for deposits to your receiver addresses.`}</p>
              </div>
            ) : (
              <ul className="mt-2" aria-label="Deposits to your receiver addresses">
                {plan.ready.map((d) => {
                  const a = assetOf(d.token);
                  const key = `${d.token}:${d.index}`;
                  return (
                    <li key={key} className="flex items-center gap-3 py-3 border-t border-[#eef0f3] first:border-t-0">
                      <span className="flex-1 min-w-0">
                        <span className="block text-[15px] font-semibold tabular-nums" style={{ color: INK }}>
                          {a ? `${formatUnits(d.amount, a.decimals, 6)} ${a.symbol}` : 'Unknown asset'}
                        </span>
                        <span className="block text-[12.5px]" style={{ color: INK_3 }}>To address {d.receiverIndex + 1} · ready</span>
                      </span>
                      <PrimaryButtonSmall onClick={() => void claim(d)} disabled={!!busy} busy={busy === key}>Claim</PrimaryButtonSmall>
                    </li>
                  );
                })}
                {plan.waiting.map((d) => {
                  const a = assetOf(d.token);
                  return (
                    <li key={`${d.token}:${d.index}`} className="flex items-center gap-3 py-3 border-t border-[#eef0f3] first:border-t-0">
                      <span className="flex-1 min-w-0">
                        <span className="block text-[15px] font-semibold tabular-nums" style={{ color: INK }}>
                          {a ? `${formatUnits(d.amount, a.decimals, 6)} ${a.symbol}` : 'Unknown asset'}
                        </span>
                        <span className="block text-[12.5px]" style={{ color: INK_3 }}>Waiting a random delay before it can be claimed</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold tabular-nums" style={{ color: INK_2 }}>
                        <Clock size={14} strokeWidth={2} aria-hidden="true" />
                        {waitText(d.readyAt - now)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: INK_3 }}>
              Each claim waits 10 minutes to 6 hours after the deposit is seen, chosen at random, so the moment you claim does not reveal which deposit was yours.
            </p>
          </div>
        )}

        {tab === 'withdraw' && !WITHDRAW_COMPLETES_IN_WALLET && (
          <div className="mt-4 space-y-3" role="tabpanel" aria-label="Withdraw">
            <Notice>
              Withdrawals open once the wallet also sends the final step on {l1Name} for you. Until then nothing is burned here that the wallet cannot finish.
            </Notice>
            <ol className="space-y-2 text-[13.5px] leading-snug" style={{ color: INK_2 }}>
              <li className="flex gap-2"><span className="font-semibold tabular-nums" style={{ color: INK }}>1</span>On Aztec, your private balance is burned and a withdrawal message is sent.</li>
              <li className="flex gap-2"><span className="font-semibold tabular-nums" style={{ color: INK }}>2</span>Aztec proves the epoch that holds it on {l1Name}.</li>
              <li className="flex gap-2"><span className="font-semibold tabular-nums" style={{ color: INK }}>3</span>One {l1Name} transaction pays the address you chose.</li>
            </ol>
          </div>
        )}
        {tab === 'withdraw' && WITHDRAW_COMPLETES_IN_WALLET && <WithdrawForm assets={cfg.assets} ready={ready} l1Name={l1Name} ownAddresses={ownAddresses} />}
      </div>
    </Card>
  );
}

function PrimaryButtonSmall({ children, onClick, disabled, busy }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; busy?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy || undefined}
      className={`min-h-[40px] px-4 rounded-full text-[14px] font-semibold bg-[#15171c] text-white hover:bg-[#262932] disabled:bg-[#e4e7ec] disabled:text-[#5b606b] ${FOCUS}`}
    >
      {busy ? 'Proving…' : children}
    </button>
  );
}

function WithdrawForm({ assets, ready, l1Name, ownAddresses }: { assets: PortalAsset[]; ready: boolean; l1Name: string; ownAddresses: Set<string> }) {
  const [asset, setAsset] = useState<PortalAsset>(assets[0]);
  const [amount, setAmount] = useState('');
  const [to, setTo] = useState('');
  const [step, setStep] = useState<'form' | 'review'>('form');
  const [busy, setBusy] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [touched, setTouched] = useState(false);
  const problem = withdrawProblem({ to, amount, decimals: asset.decimals, own: ownAddresses });

  const submit = async () => {
    setBusy(true);
    try {
      const { txHash } = await getPrivateWallet().portalWithdraw(asset.l2, to, parseUnits(amount, asset.decimals));
      toast.success(`Withdrawal started (${txHash.slice(0, 10)}…). It can be paid on ${l1Name} once Aztec proves its epoch.`);
      setAmount('');
      setTo('');
      setUnderstood(false);
      setStep('form');
    } catch (e) {
      toast.error(humanError(e));
    } finally {
      setBusy(false);
    }
  };

  if (step === 'review') {
    return (
      <div className="mt-4 space-y-3" role="tabpanel" aria-label="Review withdrawal">
        <div className="rounded-2xl border border-[#e4e7ec] px-4">
          <KV k="You withdraw" v={`${amount} ${asset.symbol}`} />
          <KV k="To" v={<span className="font-mono text-[13.5px]">{shortHex(to)}</span>} />
          <KV k="Arrives on" v={l1Name} hint="After Aztec proves the epoch, then one Ethereum transaction" />
          <KV k="Visible on Aztec" v="Address and amount" />
        </div>
        <Notice tone="warn">
          A withdrawal is public: the {l1Name} address and the amount are attached to this transaction, together with the network fee your account pays. Anyone can see that this
          account withdrew to that address.
        </Notice>
        <label className="flex items-start gap-3 rounded-2xl border border-[#e4e7ec] px-4 py-3 cursor-pointer">
          <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} className="mt-0.5 w-5 h-5 accent-[#15171c]" />
          <span className="text-[14px] leading-snug" style={{ color: INK }}>I understand this withdrawal publicly links my account to this {l1Name} address.</span>
        </label>
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <button
            type="button"
            onClick={() => setStep('form')}
            disabled={busy}
            className={`min-h-[52px] px-5 rounded-2xl text-[16px] font-semibold border border-[#e4e7ec] bg-white hover:bg-[#f2f4f7] disabled:opacity-40 ${FOCUS}`}
            style={{ color: INK }}
          >
            Back
          </button>
          <PrimaryButton onClick={() => void submit()} disabled={!ready || !understood || !!problem} busy={busy}>
            {busy ? 'Proving on this device' : `Withdraw ${amount} ${asset.symbol}`}
          </PrimaryButton>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3" role="tabpanel" aria-label="Withdraw">
      <div className="flex gap-2" role="radiogroup" aria-label="Asset">
        {assets.map((a) => (
          <button
            key={a.symbol}
            type="button"
            role="radio"
            aria-checked={a.symbol === asset.symbol}
            onClick={() => setAsset(a)}
            className={`h-10 px-4 rounded-full text-[14px] font-semibold border ${FOCUS} ${
              a.symbol === asset.symbol ? 'bg-[#15171c] text-white border-[#15171c]' : 'bg-white text-[#15171c] border-[#e4e7ec] hover:bg-[#f7f8fa]'
            }`}
          >
            {a.symbol}
          </button>
        ))}
      </div>
      <label className="block">
        <span className="block text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: INK_3 }}>Amount</span>
        <span className="mt-1.5 flex items-center h-14 px-4 rounded-2xl border-2 border-[#e4e7ec] focus-within:border-[#15171c]">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(',', '.').trim())}
            onBlur={() => setTouched(true)}
            inputMode="decimal"
            placeholder="0"
            className="flex-1 min-w-0 bg-transparent text-[22px] font-semibold tabular-nums focus:outline-none"
            style={{ color: INK }}
          />
          <span className="text-[15px] font-semibold" style={{ color: INK_3 }}>{asset.symbol}</span>
        </span>
      </label>
      <label className="block">
        <span className="block text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: INK_3 }}>{l1Name} address</span>
        <input
          value={to}
          onChange={(e) => setTo(e.target.value.trim())}
          onBlur={() => setTouched(true)}
          placeholder="0x…"
          autoComplete="off"
          spellCheck={false}
          className="mt-1.5 w-full h-12 px-4 rounded-2xl border-2 border-[#e4e7ec] focus:border-[#15171c] focus:outline-none font-mono text-[14px]"
          style={{ color: INK }}
        />
      </label>
      {touched && problem && (
        <p className="text-[13px]" style={{ color: '#b42318' }} role="alert">{problem}</p>
      )}
      <PrimaryButton onClick={() => (problem ? setTouched(true) : setStep('review'))} disabled={!ready}>
        <ArrowUpRight size={18} strokeWidth={2.2} aria-hidden="true" />
        Review withdrawal
      </PrimaryButton>
      <p className="text-[12.5px] leading-relaxed" style={{ color: INK_3 }}>
        Withdrawals stay available while new payments are paused. The portal itself can pause withdrawals for at most 3 days, and then not again for 4 days.
      </p>
    </div>
  );
}
