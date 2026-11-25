/**
 * lib/dashboard/model.ts — everything the dashboard computes, from data already on this device.
 *
 * Pure functions, no I/O: the input is the private wallet's own record (lib/aztec/wallet/history.ts,
 * rebuilt from the notes the PXE decrypts), the verified peer bindings and contacts kept in this
 * browser, and the time. The output is plain data the interface draws. It runs in a Web Worker
 * (model.worker.ts) so thousands of events never block the page; the same code runs on the main
 * thread when a worker cannot start. Nothing here can send anything: test/unit/dashboard/privacy.test.ts
 * fails if a network API appears in lib/dashboard or components/dashboard.
 *
 * Provenance, shown next to every value:
 *   local   held only on this device (activity record, contacts, settings)
 *   proof   produced on this device by the PXE (notes decrypted, proofs built)
 *   public  readable by anyone on Aztec or Ethereum (transaction hash, block, fee payer)
 */
import type { Activity, ActivityKind, ActivityStatus } from '@/lib/aztec/wallet/history';

export type Provenance = 'local' | 'proof' | 'public';

export interface TokenMeta {
  key: string;
  symbol: string;
  decimals: number;
}

export interface DashInputs {
  activity: Activity[];
  tokens: TokenMeta[];
  /** Peer inbox id → Aztec address, from verified address proofs (lib/aztec/peer-binding.ts). */
  bindings: { inboxId: string; aztecAddress: string }[];
  /** Names the person gave on this device (lib/wallet/localAddressBook.ts). */
  contacts: { address: string; name: string }[];
  now: number;
}

export interface DashEvent {
  id: string;
  kind: ActivityKind;
  status: ActivityStatus;
  token?: string;
  symbol?: string;
  decimals?: number;
  /** Base units. */
  amount?: bigint;
  /** +1 money in, -1 money out, 0 neither. */
  direction: 1 | -1 | 0;
  counterparty?: string;
  counterpartyLabel?: string;
  verified: boolean;
  txHash?: string;
  block?: number;
  error?: string;
  at: number;
  provenance: Provenance[];
}

export interface TokenTotals {
  token: string;
  symbol: string;
  decimals: number;
  sent: bigint;
  received: bigint;
  shielded: bigint;
  unshielded: bigint;
  count: number;
}

export interface Counterparty {
  address: string;
  label?: string;
  verified: boolean;
  count: number;
  first: number;
  last: number;
  perToken: Record<string, { sent: bigint; received: bigint }>;
}

export interface DayBucket {
  /** Start of the day, local time (ms). */
  day: number;
  in: number;
  out: number;
  other: number;
  failed: number;
}

export interface DashModel {
  events: DashEvent[];
  totals: TokenTotals[];
  byKind: Record<string, number>;
  byStatus: Record<string, number>;
  counterparties: Counterparty[];
  /** The last `days` days, oldest first. */
  days: DayBucket[];
  first?: number;
  last?: number;
  activeDays: number;
  inFlight: number;
  failedRecent: number;
  /** Proving or pending for more than ten minutes. */
  stuck: number;
  computedInMs: number;
}

export const DAYS = 90;
const DAY = 86_400_000;
const STUCK_MS = 10 * 60_000;

const INBOUND: ReadonlySet<ActivityKind> = new Set(['receive', 'faucet', 'issue']);
const OUTBOUND: ReadonlySet<ActivityKind> = new Set(['send']);

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function units(a: Activity): bigint | undefined {
  return a.amount && /^\d+$/.test(a.amount) ? BigInt(a.amount) : undefined;
}

function provenanceOf(a: Activity): Provenance[] {
  const p: Provenance[] = ['local'];
  // A receive is found by decrypting a note in the PXE; a send was proven by this device.
  if (a.kind === 'receive' || a.kind === 'send' || a.kind === 'shield' || a.kind === 'unshield') p.push('proof');
  if (a.txHash) p.push('public');
  return p;
}

export function computeModel(input: DashInputs): DashModel {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const tokens = new Map(input.tokens.map((t) => [t.key, t]));
  const verified = new Set(input.bindings.map((b) => b.aztecAddress.toLowerCase()));
  const names = new Map(input.contacts.map((c) => [c.address.toLowerCase(), c.name]));

  const seen = new Set<string>();
  const events: DashEvent[] = [];
  for (const a of input.activity) {
    if (!a || typeof a.id !== 'string' || seen.has(a.id)) continue;
    seen.add(a.id);
    const meta = a.token ? tokens.get(a.token) : undefined;
    const cp = a.counterparty?.toLowerCase();
    events.push({
      id: a.id,
      kind: a.kind,
      status: a.status,
      token: a.token,
      symbol: meta?.symbol,
      decimals: meta?.decimals,
      amount: units(a),
      direction: INBOUND.has(a.kind) ? 1 : OUTBOUND.has(a.kind) ? -1 : 0,
      counterparty: a.counterparty,
      counterpartyLabel: cp ? names.get(cp) : undefined,
      verified: !!cp && verified.has(cp),
      txHash: a.txHash,
      block: a.blockNumber,
      error: a.error,
      at: Number.isFinite(a.createdAt) ? a.createdAt : 0,
      provenance: provenanceOf(a),
    });
  }
  events.sort((x, y) => y.at - x.at || (y.block ?? 0) - (x.block ?? 0));

  const totals = new Map<string, TokenTotals>();
  const byKind: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const cps = new Map<string, Counterparty>();
  const today = startOfDay(input.now);
  const from = today - (DAYS - 1) * DAY;
  const days: DayBucket[] = Array.from({ length: DAYS }, (_, i) => ({ day: from + i * DAY, in: 0, out: 0, other: 0, failed: 0 }));
  const activeDays = new Set<number>();
  let inFlight = 0;
  let failedRecent = 0;
  let stuck = 0;

  for (const e of events) {
    byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
    byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
    if (e.status === 'proving' || e.status === 'pending') {
      inFlight++;
      if (input.now - e.at > STUCK_MS) stuck++;
    }
    if (e.status === 'failed' && input.now - e.at < 7 * DAY) failedRecent++;

    const d = startOfDay(e.at);
    activeDays.add(d);
    const idx = Math.round((d - from) / DAY);
    if (idx >= 0 && idx < DAYS) {
      const b = days[idx];
      if (e.status === 'failed') b.failed++;
      else if (e.direction === 1) b.in++;
      else if (e.direction === -1) b.out++;
      else b.other++;
    }

    if (e.status !== 'settled' || !e.token || e.amount === undefined) continue;
    const meta = tokens.get(e.token);
    if (!meta) continue;
    const t = totals.get(e.token) ?? { token: e.token, symbol: meta.symbol, decimals: meta.decimals, sent: 0n, received: 0n, shielded: 0n, unshielded: 0n, count: 0 };
    if (e.kind === 'send') t.sent += e.amount;
    else if (e.direction === 1) t.received += e.amount;
    else if (e.kind === 'shield') t.shielded += e.amount;
    else if (e.kind === 'unshield') t.unshielded += e.amount;
    t.count++;
    totals.set(e.token, t);

    if (e.counterparty && (e.kind === 'send' || e.kind === 'receive')) {
      const key = e.counterparty.toLowerCase();
      const c = cps.get(key) ?? { address: e.counterparty, label: e.counterpartyLabel, verified: e.verified, count: 0, first: e.at, last: e.at, perToken: {} };
      c.count++;
      c.first = Math.min(c.first, e.at);
      c.last = Math.max(c.last, e.at);
      const pt = (c.perToken[e.token] ??= { sent: 0n, received: 0n });
      if (e.kind === 'send') pt.sent += e.amount;
      else pt.received += e.amount;
      cps.set(key, c);
    }
  }

  // Verified peers with no payment yet still appear: they are people you can pay safely.
  for (const b of input.bindings) {
    const key = b.aztecAddress.toLowerCase();
    if (!cps.has(key)) cps.set(key, { address: b.aztecAddress, label: names.get(key), verified: true, count: 0, first: 0, last: 0, perToken: {} });
  }

  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return {
    events,
    totals: [...totals.values()].sort((a, b) => b.count - a.count),
    byKind,
    byStatus,
    counterparties: [...cps.values()].sort((a, b) => b.count - a.count || b.last - a.last),
    days,
    first: events.length ? events[events.length - 1].at : undefined,
    last: events.length ? events[0].at : undefined,
    activeDays: activeDays.size,
    inFlight,
    failedRecent,
    stuck,
    computedInMs: Math.round((t1 - t0) * 10) / 10,
  };
}

/* ------------------------------------------------------------------ filters */

export type Direction = 'all' | 'in' | 'out' | 'other';

export interface EventFilter {
  direction: Direction;
  status: 'all' | ActivityStatus;
  token: 'all' | string;
  /** Lower-case text matched against the counterparty, its name, the hash and the kind. */
  q: string;
  /** Days back from now; 0 = all time. */
  since: number;
}

export const NO_FILTER: EventFilter = { direction: 'all', status: 'all', token: 'all', q: '', since: 0 };

export function filterEvents(events: readonly DashEvent[], f: EventFilter, now: number): DashEvent[] {
  const q = f.q.trim().toLowerCase();
  const after = f.since > 0 ? now - f.since * DAY : -Infinity;
  return events.filter((e) => {
    if (e.at < after) return false;
    if (f.status !== 'all' && e.status !== f.status) return false;
    if (f.token !== 'all' && e.token !== f.token) return false;
    if (f.direction === 'in' && e.direction !== 1) return false;
    if (f.direction === 'out' && e.direction !== -1) return false;
    if (f.direction === 'other' && e.direction !== 0) return false;
    if (q) {
      const hay = `${e.counterparty ?? ''} ${e.counterpartyLabel ?? ''} ${e.txHash ?? ''} ${e.kind} ${e.symbol ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/* ------------------------------------------------------------------- alerts */

export type AlertLevel = 'action' | 'warn' | 'info';

export interface DashAlert {
  id: string;
  level: AlertLevel;
  /** English text; the interface translates it. */
  text: string;
  vars?: Record<string, string | number>;
}

export interface AlertInputs {
  phase: string;
  feeJuice?: { balance: bigint; minForTx: bigint; claims: { ready: boolean }[] };
  /** Aztec Alpha needs Fee Juice; the test network uses sponsored fees. */
  needsFeeJuice: boolean;
  receiveOnly: boolean;
  model: Pick<DashModel, 'stuck' | 'failedRecent' | 'inFlight'>;
}

export function computeAlerts(a: AlertInputs): DashAlert[] {
  const out: DashAlert[] = [];
  const fj = a.feeJuice;
  if (a.needsFeeJuice && (a.phase === 'needs-fee-juice' || (fj && fj.minForTx > 0n && fj.balance < fj.minForTx))) {
    out.push({ id: 'fee-juice', level: 'action', text: 'No Fee Juice for the next transaction. Payments wait until this account has Fee Juice.' });
  }
  const ready = fj?.claims.filter((c) => c.ready).length ?? 0;
  if (ready > 0) out.push({ id: 'claims', level: 'action', text: '{count} Fee Juice deposit can be claimed now.', vars: { count: ready } });
  if (a.model.stuck > 0) out.push({ id: 'stuck', level: 'warn', text: '{count} transaction has been on its way for more than ten minutes.', vars: { count: a.model.stuck } });
  if (a.model.failedRecent > 0) out.push({ id: 'failed', level: 'warn', text: '{count} transaction failed in the last seven days.', vars: { count: a.model.failedRecent } });
  if (a.receiveOnly) out.push({ id: 'receive-only', level: 'info', text: 'This device is set to receive only.' });
  out.push({ id: 'unaudited', level: 'info', text: 'The contracts have had an internal review, not an external audit yet.' });
  return out;
}

/* ------------------------------------------------------------------- inputs */

/**
 * The peers whose Aztec address was proven (lib/aztec/peer-binding.ts stores `verified:<inbox>` next
 * to the pinned address once the proof of control checks out). Unverified pins are left out.
 */
export function readBindings(storage: Pick<Storage, 'length' | 'key' | 'getItem'> | undefined, prefix = 'hl.aztec_peer.'): DashInputs['bindings'] {
  const out: DashInputs['bindings'] = [];
  if (!storage) return out;
  const marker = prefix + 'verified:';
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (!k || !k.startsWith(marker)) continue;
    const addr = (storage.getItem(k) ?? '').trim();
    if (/^0x[0-9a-fA-F]{1,64}$/.test(addr)) out.push({ inboxId: k.slice(marker.length), aztecAddress: addr });
  }
  return out;
}
