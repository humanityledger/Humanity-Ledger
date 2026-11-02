'use client';

/**
 * Aztec sequencer operations dashboard.
 *
 * Everything on this screen is read live from the Aztec node JSON-RPC and
 * the Aztec contracts on Ethereum through /api/aztec/sequencer/overview.
 * When a value cannot be read the card says so; it never shows a stand-in.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatUnits } from 'viem';
import {
  AlertTriangle, CheckCircle2, Copy, ExternalLink, Info, RefreshCw, Server, ShieldCheck, Wallet, XCircle,
} from 'lucide-react';
import type {
  AttesterState, L2BlockSummary, OperatorAlert, Reading, RollupState, SequencerOverview,
} from '@/lib/aztec/sequencer/types';
import { AZTEC_NETWORKS, SEQUENCER_REQUIREMENTS } from '@/lib/aztec/sequencer/networks';

const REFRESH_MS = 15_000;

const CONTRACT_LABELS: Record<string, string> = {
  registry: 'Registry', rollup: 'Rollup', inbox: 'L1 → L2 inbox', outbox: 'L2 → L1 outbox', feeJuice: 'Fee Juice',
  feeJuicePortal: 'Fee Juice portal', stakingAsset: 'Staking asset', gse: 'GSE (staking escrow)', stakingRegistry: 'Staking registry',
  coinIssuer: 'Coin issuer', rewardDistributor: 'Reward distributor', governanceProposer: 'Governance proposer', governance: 'Governance',
  slasher: 'Slasher', tallySlashingProposer: 'Tally slashing proposer', honkVerifier: 'Honk verifier',
};

// ── helpers ────────────────────────────────────────────────────────────────

const short = (a?: string | null, n = 6) => (a && a.length > 2 * n + 2 ? `${a.slice(0, n + 2)}…${a.slice(-n)}` : a ?? '');
const fmtInt = (n: number | null | undefined) => (n === null || n === undefined || Number.isNaN(n) ? '—' : n.toLocaleString('en-US'));

function fmtToken(raw: string | undefined, decimals = 18, max = 2): string {
  if (!raw) return '—';
  try {
    const v = Number(formatUnits(BigInt(raw), decimals));
    return v.toLocaleString('en-US', { maximumFractionDigits: max });
  } catch {
    return '—';
  }
}

function ago(tsSeconds: number, now: number): string {
  const s = Math.max(0, Math.round(now / 1000 - tsSeconds));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function CopyBtn({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy"
      onClick={() => { navigator.clipboard?.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1200); }).catch(() => {}); }}
      className="inline-flex items-center justify-center w-6 h-6 rounded-md text-[#727a88] hover:text-[#15171c] hover:bg-black/5"
    >
      {done ? <CheckCircle2 size={13} /> : <Copy size={13} />}
    </button>
  );
}

function Card({ title, subtitle, children, right }: { title: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-[#e4e7ec] p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[15px] font-semibold text-[#15171c]">{title}</h2>
          {subtitle && <p className="text-[12.5px] text-[#727a88] mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function Unavailable({ r }: { r: { ok: false; error: string } }) {
  return (
    <p className="text-[13px] text-[#b42318] bg-[#fef3f2] rounded-xl px-3 py-2">
      Not available right now: {r.error}
    </p>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl bg-[#f7f8fa] px-3.5 py-3 min-w-0">
      <p className="text-[12px] text-[#727a88]">{label}</p>
      <p className="text-[18px] font-semibold text-[#15171c] tabular-nums truncate">{value}</p>
      {hint && <p className="text-[11.5px] text-[#8a909c] mt-0.5 truncate">{hint}</p>}
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  VALIDATING: 'bg-[#ecfdf3] text-[#067647]',
  EXITING: 'bg-[#fffaeb] text-[#b54708]',
  ZOMBIE: 'bg-[#fef3f2] text-[#b42318]',
  NONE: 'bg-[#fef3f2] text-[#b42318]',
  UNKNOWN: 'bg-[#f2f4f7] text-[#475467]',
  READY: 'bg-[#ecfdf3] text-[#067647]',
  SYNCING: 'bg-[#fffaeb] text-[#b54708]',
  STANDBY: 'bg-[#fffaeb] text-[#b54708]',
  DOWN: 'bg-[#fef3f2] text-[#b42318]',
  NOT_CONFIGURED: 'bg-[#f2f4f7] text-[#475467]',
};

function Badge({ value }: { value: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11.5px] font-semibold ${STATUS_STYLE[value] ?? STATUS_STYLE.UNKNOWN}`}>{value.replace('_', ' ')}</span>;
}

// ── sections ───────────────────────────────────────────────────────────────

function Alerts({ alerts }: { alerts: OperatorAlert[] }) {
  if (!alerts.length) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-[#ecfdf3] text-[#067647] px-4 py-3 text-[13.5px] font-medium">
        <CheckCircle2 size={16} /> No open issues.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {alerts.map((a, i) => {
        const Icon = a.level === 'critical' ? XCircle : a.level === 'warning' ? AlertTriangle : Info;
        const cls = a.level === 'critical' ? 'bg-[#fef3f2] text-[#b42318]' : a.level === 'warning' ? 'bg-[#fffaeb] text-[#b54708]' : 'bg-[#f2f4f7] text-[#344054]';
        return (
          <div key={`${a.code}-${i}`} className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 text-[13.5px] leading-snug ${cls}`}>
            <Icon size={16} className="mt-[1px] shrink-0" />
            <span>{a.message}</span>
          </div>
        );
      })}
    </div>
  );
}

function SlotClock({ rollup, now }: { rollup: RollupState; now: number }) {
  // Slot n starts at genesisTime + n * slotDuration (Aztec L1 time model).
  const slotStart = rollup.genesisTime + rollup.currentSlot * rollup.slotDurationSeconds;
  const elapsed = Math.min(rollup.slotDurationSeconds, Math.max(0, now / 1000 - slotStart));
  const pct = rollup.slotDurationSeconds ? (elapsed / rollup.slotDurationSeconds) * 100 : 0;
  const slotInEpoch = rollup.epochDurationSlots ? rollup.currentSlot % rollup.epochDurationSlots : 0;
  return (
    <div className="rounded-xl bg-[#f7f8fa] px-3.5 py-3">
      <div className="flex items-baseline justify-between">
        <p className="text-[12px] text-[#727a88]">Epoch {fmtInt(rollup.currentEpoch)} · slot {slotInEpoch + 1} of {rollup.epochDurationSlots}</p>
        <p className="text-[12px] text-[#727a88] tabular-nums">{Math.round(elapsed)}s / {rollup.slotDurationSeconds}s</p>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-[#e4e7ec] overflow-hidden">
        <div className="h-full bg-[#15171c] transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11.5px] text-[#8a909c] mt-1.5">Proposer now: <span className="font-mono">{short(rollup.currentProposer)}</span></p>
    </div>
  );
}

function SlotHistory({ history }: { history: { slot: number; status: string }[] }) {
  if (!history.length) return <span className="text-[12px] text-[#8a909c]">No duties in the node&apos;s window</span>;
  const color = (s: string) =>
    s.includes('missed') ? 'bg-[#f04438]' : s.includes('mined') || s.includes('proposed') ? 'bg-[#15171c]' : 'bg-[#32d583]';
  return (
    <div className="flex flex-wrap gap-[3px] max-w-[260px]" aria-label="Recent slot duties">
      {history.slice(-48).map(h => (
        <span key={h.slot} title={`slot ${h.slot}: ${h.status}`} className={`w-2 h-2 rounded-[2px] ${color(h.status)}`} />
      ))}
    </div>
  );
}

function AttesterRow({ a, decimals, symbol }: { a: AttesterState; decimals: number; symbol: string }) {
  const s = a.stats.ok ? a.stats.value.validator : null;
  const rate = (m?: { count: number; total: number }) => (m && m.total ? `${((1 - m.count / m.total) * 100).toFixed(1)}%` : '—');
  return (
    <div className="grid grid-cols-1 md:grid-cols-[1.3fr_0.8fr_1fr_1.4fr] gap-3 items-start py-3 border-t border-[#f2f4f7] first:border-t-0">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[13px] text-[#15171c] truncate">{short(a.address, 8)}</span>
          <CopyBtn value={a.address} />
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1">
          <Badge value={a.status} />
          {a.inCurrentCommittee && <span className="px-2 py-0.5 rounded-full text-[11.5px] font-semibold bg-[#eff8ff] text-[#175cd3]">In committee</span>}
          {a.isCurrentProposer && <span className="px-2 py-0.5 rounded-full text-[11.5px] font-semibold bg-[#15171c] text-white">Proposing now</span>}
        </div>
      </div>
      <div>
        <p className="text-[12px] text-[#727a88]">Stake</p>
        <p className="text-[14px] font-semibold tabular-nums">{fmtToken(a.effectiveBalance, decimals, 0)} {symbol}</p>
      </div>
      <div>
        <p className="text-[12px] text-[#727a88]">Attestations · proposals</p>
        <p className="text-[14px] font-semibold tabular-nums">{rate(s?.missedAttestations)} · {rate(s?.missedProposals)}</p>
        <p className="text-[11.5px] text-[#8a909c]">
          {s?.lastAttestation ? `last attested slot ${fmtInt(s.lastAttestation.slot)}` : a.stats.ok ? 'no attestation yet' : 'stats unavailable'}
        </p>
      </div>
      <div>{s ? <SlotHistory history={s.history} /> : <span className="text-[12px] text-[#8a909c]">{a.stats.ok ? '' : a.stats.error}</span>}</div>
    </div>
  );
}

function BlocksTable({ blocks, now }: { blocks: L2BlockSummary[]; now: number }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-[13px] min-w-[560px]">
        <thead>
          <tr className="text-left text-[12px] text-[#727a88]">
            <th className="font-medium px-1 py-1.5">Block</th>
            <th className="font-medium px-1 py-1.5">Checkpoint</th>
            <th className="font-medium px-1 py-1.5">Slot</th>
            <th className="font-medium px-1 py-1.5">Time</th>
            <th className="font-medium px-1 py-1.5">Proposer (coinbase)</th>
            <th className="font-medium px-1 py-1.5 text-right">Mana used</th>
          </tr>
        </thead>
        <tbody>
          {blocks.map(b => (
            <tr key={b.number} className="border-t border-[#f2f4f7]">
              <td className="px-1 py-2 font-semibold tabular-nums">{fmtInt(b.number)}</td>
              <td className="px-1 py-2 tabular-nums">{fmtInt(b.checkpointNumber)}</td>
              <td className="px-1 py-2 tabular-nums">{fmtInt(b.slot)}</td>
              <td className="px-1 py-2 text-[#475467]">{b.timestamp ? ago(b.timestamp, now) : '—'}</td>
              <td className="px-1 py-2 font-mono text-[12px]">{short(b.coinbase)}</td>
              <td className="px-1 py-2 text-right tabular-nums">{fmtInt(Number(b.totalManaUsed))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── main ───────────────────────────────────────────────────────────────────

export function AztecSequencerDashboard({ initialData = null }: { initialData?: SequencerOverview | null } = {}) {
  // The page reads the first overview on the server, so it paints at once;
  // the client then refreshes it every 15 s.
  const [data, setData] = useState<SequencerOverview | null>(initialData);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const busy = useRef(false);

  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      const res = await fetch('/api/aztec/sequencer/overview', { credentials: 'include', cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || `HTTP ${res.status}`);
      setData(json.data as SequencerOverview);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialData) load();
    const t = setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
    const onVis = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const net = data ? AZTEC_NETWORKS[data.network.id] : null;
  const rollup: Reading<RollupState> | null = data?.rollup ?? null;
  const decimals = rollup?.ok ? rollup.value.stakingAsset.decimals : 18;
  const symbol = rollup?.ok ? rollup.value.stakingAsset.symbol : 'AZTEC';
  const updated = useMemo(() => (data ? Math.round((now - data.generatedAt) / 1000) : null), [data, now]);

  if (!data) {
    return (
      <div className="bg-white rounded-2xl border border-[#e4e7ec] p-8 text-center">
        {error ? (
          <>
            <p className="text-[15px] font-semibold text-[#15171c]">Could not load the sequencer overview</p>
            <p className="text-[13px] text-[#727a88] mt-1">{error}</p>
            <button type="button" onClick={load} className="mt-4 px-4 h-10 rounded-xl bg-[#15171c] text-white text-[14px] font-medium">Try again</button>
          </>
        ) : (
          <p className="text-[14px] text-[#727a88]">Reading the Aztec network and Ethereum…</p>
        )}
      </div>
    );
  }

  const tips = data.reference.tips;
  const info = data.reference.info;
  const own = data.ownNode;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12.5px] text-[#727a88]">Aztec sequencer</p>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[#15171c]">{data.network.label}</h1>
          <p className="text-[12.5px] text-[#727a88] mt-0.5">
            Node {data.network.expectedNodeVersion} · rollup version {data.network.rollupVersion} · L1 chain {data.network.l1ChainId}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-[#8a909c] tabular-nums">{error ? `Refresh failed: ${error}` : updated !== null ? `Updated ${updated}s ago` : ''}</span>
          <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[#f2f4f7] hover:bg-[#e4e7ec] text-[13px] font-medium text-[#15171c] disabled:opacity-60">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      <Alerts alerts={data.alerts} />

      {/* Network */}
      <Card title="Network" subtitle={`From ${info.ok ? `an Aztec ${info.value.nodeVersion} node` : 'the reference node'} and the Rollup contract on ${net?.l1ChainName ?? 'L1'}`}>
        {tips.ok ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <Stat label="Proposed block" value={fmtInt(tips.value.proposed.number)} />
            <Stat label="Checkpointed" value={fmtInt(tips.value.checkpointed.block.number)} hint={`checkpoint ${fmtInt(tips.value.checkpointed.checkpoint.number)}`} />
            <Stat label="Proven" value={fmtInt(tips.value.proven.block.number)} hint={`checkpoint ${fmtInt(tips.value.proven.checkpoint.number)}`} />
            <Stat label="Finalized" value={fmtInt(tips.value.finalized.block.number)} />
          </div>
        ) : <Unavailable r={tips} />}
        <div className="h-2.5" />
        {rollup?.ok ? (
          <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-2.5">
            <SlotClock rollup={rollup.value} now={now} />
            <Stat label="Active sequencers" value={fmtInt(rollup.value.activeAttesterCount)} hint={`${fmtInt(rollup.value.entryQueueLength)} waiting in the entry queue`} />
            <Stat label="Committee" value={`${rollup.value.committee.length} / ${rollup.value.targetCommitteeSize}`} hint="attesters this epoch" />
            <Stat label="Pending txs" value={data.reference.pendingTxCount.ok ? fmtInt(data.reference.pendingTxCount.value) : '—'} hint="in the reference node's pool" />
          </div>
        ) : rollup && !rollup.ok ? <Unavailable r={rollup} /> : null}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Own node */}
        <Card title="Your node" subtitle="The sequencer this deployment runs" right={<Badge value={own.mode} />}>
          {own.mode === 'NOT_CONFIGURED' ? (
            <p className="text-[13.5px] text-[#475467] leading-relaxed">
              No node connected. Run the kit in <span className="font-mono text-[12.5px]">docker/aztec-sequencer</span>, then set
              <span className="font-mono text-[12.5px]"> AZTEC_NODE_URL</span> on this server to its private API address (port {SEQUENCER_REQUIREMENTS.ports.nodeApi}).
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <Stat label="Version" value={own.info?.nodeVersion ?? '—'} hint={own.info ? `rollup ${own.info.rollupVersion}` : undefined} />
              <Stat label="Behind the network" value={own.lagBlocks === null ? '—' : `${own.lagBlocks} blocks`} />
              <Stat label="World state" value={own.worldState ? (own.worldState.treesAreSynched ? 'Synced' : 'Syncing') : '—'} hint={own.worldState ? `at block ${fmtInt(own.worldState.latestBlockNumber)}` : undefined} />
              <Stat label="Pending txs" value={fmtInt(own.pendingTxCount)} />
            </div>
          )}
        </Card>

        {/* Publishers & rewards */}
        <Card title="Gas and rewards" subtitle={`Publishers pay L1 gas. Keep each above ${SEQUENCER_REQUIREMENTS.publisherAlertEth} ETH.`}>
          {data.publishers.ok ? (
            data.publishers.value.length ? (
              <div className="flex flex-col gap-2">
                {data.publishers.value.map(p => (
                  <div key={p.address} className="flex items-center justify-between rounded-xl bg-[#f7f8fa] px-3.5 py-2.5">
                    <span className="flex items-center gap-1.5 font-mono text-[12.5px]"><Wallet size={14} className="text-[#727a88]" />{short(p.address, 8)}<CopyBtn value={p.address} /></span>
                    <span className={`text-[14px] font-semibold tabular-nums ${p.low ? 'text-[#b42318]' : 'text-[#15171c]'}`}>{p.balanceEth.toLocaleString('en-US', { maximumFractionDigits: 4 })} ETH</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-[13.5px] text-[#475467]">No publishers configured (AZTEC_PUBLISHER_ADDRESSES, or the attesters by default).</p>
          ) : <Unavailable r={data.publishers} />}
          <div className="h-2.5" />
          {data.rewards.ok ? (
            data.rewards.value ? (
              <Stat label="Claimable sequencer rewards" value={`${fmtToken(data.rewards.value.claimable, decimals, 4)} ${symbol}`} hint={`coinbase ${short(data.rewards.value.coinbase)} · claim with claimSequencerRewards`} />
            ) : null
          ) : <Unavailable r={data.rewards} />}
        </Card>
      </div>

      {/* Attesters */}
      <Card
        title="Your sequencers"
        subtitle={rollup?.ok ? `Each needs ${fmtToken(rollup.value.activationThreshold, decimals, 0)} ${symbol} staked; ejected below ${fmtToken(rollup.value.ejectionThreshold, decimals, 0)}. Exits take ${Math.round(rollup.value.exitDelaySeconds / 3600)} h.` : undefined}
        right={net ? <a href={net.stakingDashboard} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 whitespace-nowrap text-[13px] font-medium text-[#15171c] hover:underline">Staking dashboard <ExternalLink size={13} /></a> : null}
      >
        {data.attesters.ok ? (
          data.attesters.value.length ? (
            <div>{data.attesters.value.map(a => <AttesterRow key={a.address} a={a} decimals={decimals} symbol={symbol} />)}</div>
          ) : (
            <p className="text-[13.5px] text-[#475467] leading-relaxed">
              No sequencer addresses configured. Generate keys with <span className="font-mono text-[12.5px]">aztec validator-keys new --staker-output</span>,
              stake through the staking dashboard, then list the attester addresses in <span className="font-mono text-[12.5px]">AZTEC_ATTESTER_ADDRESSES</span>.
            </p>
          )
        ) : <Unavailable r={data.attesters} />}
      </Card>

      {/* Blocks */}
      <Card title="Latest blocks" subtitle="Straight from aztec_getBlock">
        {data.reference.recentBlocks.ok ? <BlocksTable blocks={data.reference.recentBlocks.value} now={now} /> : <Unavailable r={data.reference.recentBlocks} />}
      </Card>

      {/* Requirements + contracts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="What a sequencer needs" subtitle="From the Aztec v6 operator docs">
          <ul className="flex flex-col gap-2 text-[13.5px] text-[#344054]">
            <li className="flex gap-2"><ShieldCheck size={16} className="shrink-0 text-[#727a88] mt-[1px]" />{SEQUENCER_REQUIREMENTS.stakeAztec.toLocaleString('en-US')} {symbol} staked per sequencer (yours, or delegated through the Staking Registry).</li>
            <li className="flex gap-2"><Server size={16} className="shrink-0 text-[#727a88] mt-[1px]" />{SEQUENCER_REQUIREMENTS.hardware.cores}, {SEQUENCER_REQUIREMENTS.hardware.ramGb} GB RAM, {SEQUENCER_REQUIREMENTS.hardware.diskTb} TB {SEQUENCER_REQUIREMENTS.hardware.diskType}, {SEQUENCER_REQUIREMENTS.hardware.bandwidthMbps} Mbps.</li>
            {SEQUENCER_REQUIREMENTS.l1Requirements.map(r => <li key={r} className="flex gap-2"><CheckCircle2 size={16} className="shrink-0 text-[#727a88] mt-[1px]" />{r}.</li>)}
            <li className="flex gap-2"><CheckCircle2 size={16} className="shrink-0 text-[#727a88] mt-[1px]" />TCP and UDP {SEQUENCER_REQUIREMENTS.ports.p2p} open; admin port {SEQUENCER_REQUIREMENTS.ports.adminApi} never exposed.</li>
            <li className="flex gap-2"><Wallet size={16} className="shrink-0 text-[#727a88] mt-[1px]" />About {SEQUENCER_REQUIREMENTS.publisherTopUpEth} ETH per attester to start, ~{SEQUENCER_REQUIREMENTS.publisherYearlyEth} ETH a year after.</li>
          </ul>
        </Card>
        <Card title="Contracts" subtitle={`${net?.l1ChainName ?? 'L1'} addresses this build checks against`}>
          <div className="flex flex-col">
            {Object.entries(data.network.l1).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-2 py-1.5 border-t border-[#f2f4f7] first:border-t-0">
                <span className="text-[12.5px] text-[#475467]">{CONTRACT_LABELS[k] ?? k}</span>
                <span className="flex items-center gap-1 font-mono text-[12px] text-[#15171c]">{short(v, 6)}<CopyBtn value={v} /></span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default AztecSequencerDashboard;
