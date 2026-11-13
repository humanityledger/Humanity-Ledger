/**
 * lib/protocol/metrics.ts
 *
 * Pure part of the protocol dashboard (/protocol, GET /api/protocol/metrics): turns raw readings
 * into the list of metrics shown and exported. No I/O here; lib/protocol/read.ts does the reading.
 *
 * Rules:
 *  - A figure is shown only when it was read from its source in this snapshot. A failed read is
 *    "unavailable", never 0 and never the last good value.
 *  - What does not exist is "not-deployed" (no contract, nothing to read).
 *  - What the protocol cannot see by design (private notes) is "not-measurable".
 *  - Token amounts stay bigint until formatted with formatUnits.
 */
import { formatUnits } from '@/lib/aztec/wallet/amounts';

export type MetricStatus = 'live' | 'mismatch' | 'unavailable' | 'not-deployed' | 'not-measurable';

export interface Metric {
  id: string;
  group: 'network' | 'value' | 'token' | 'onboarding';
  label: string;
  status: MetricStatus;
  /** Display value. Absent when there is nothing to show. */
  value?: string;
  /** Exact machine value (decimal string for integers, 0x-hex for fields), for the report. */
  raw?: string;
  detail: string;
  source: string;
}

export const STATUS_LABEL: Record<MetricStatus, string> = {
  live: 'Live',
  mismatch: 'Mismatch',
  unavailable: 'Not read',
  'not-deployed': 'Not deployed',
  'not-measurable': 'Private by design',
};

// ─── Parsing helpers ─────────────────────────────────────────────────────────

const FIELD_MODULUS = 0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;

/** A BN254 field element from a JSON-RPC answer ("0x…" hex). undefined when malformed or out of range. */
export function parseField(v: unknown): bigint | undefined {
  if (typeof v !== 'string' || !/^0x[0-9a-fA-F]{1,64}$/.test(v)) return undefined;
  const n = BigInt(v);
  return n < FIELD_MODULUS ? n : undefined;
}

/** A non-negative safe integer from a JSON-RPC answer (number or decimal/hex string). */
export function parseSafeInt(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isSafeInteger(v) && v >= 0 ? v : undefined;
  if (typeof v === 'string' && /^(0x[0-9a-fA-F]+|\d+)$/.test(v)) {
    const n = BigInt(v);
    return n <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(n) : undefined;
  }
  return undefined;
}

export const fieldHex = (n: bigint): string => `0x${n.toString(16).padStart(64, '0')}`;

/**
 * Storage slot of `field` in a Noir contract artifact. Accepts the raw nargo output (the
 * STORAGE_LAYOUT_<Contract> global, as in contracts/aztec/<name>/target/*.json) and the parsed
 * form ({ storageLayout: { field: { slot } } }). undefined when the field is not there.
 */
export function storageSlot(artifact: unknown, contractName: string, field: string): bigint | undefined {
  const a = artifact as any;
  const parsed = a?.storageLayout?.[field]?.slot;
  if (parsed !== undefined) {
    const s = typeof parsed === 'string' ? parsed : parsed?.toString?.();
    const n = typeof s === 'string' && /^(0x)?[0-9a-fA-F]+$/.test(s) ? BigInt(s.startsWith('0x') ? s : `0x${s}`) : undefined;
    return n !== undefined && n > 0n ? n : undefined;
  }
  const globals = a?.outputs?.globals?.storage;
  if (!Array.isArray(globals)) return undefined;
  const layout = globals.find((g: any) => g?.name === `STORAGE_LAYOUT_${contractName}`);
  const fields = layout?.value?.fields?.find((f: any) => f?.name === 'fields')?.value?.fields;
  if (!Array.isArray(fields)) return undefined;
  const entry = fields.find((f: any) => f?.name === field);
  const slot = entry?.value?.fields?.find((f: any) => f?.name === 'slot')?.value;
  if (slot?.kind !== 'integer' || typeof slot.value !== 'string' || !/^[0-9a-fA-F]+$/.test(slot.value)) return undefined;
  const n = BigInt(`0x${slot.value}`);
  return n > 0n ? n : undefined;
}

const short = (hex: string) => (hex.length > 14 ? `${hex.slice(0, 8)}…${hex.slice(-6)}` : hex);

// ─── Snapshot → metrics ──────────────────────────────────────────────────────

export interface RecordedToken {
  symbol: string;
  name?: string;
  decimals: number;
  address: string;
  deployTx: string;
  deployBlock: number;
}

export interface Snapshot {
  /** Host of the node that was read, for the "source" lines. */
  nodeHost: string;
  node:
    | { ok: true; blockNumber: number; nodeVersion: string; l1ChainId: number; rollupVersion: number; drift: string[] }
    | { ok: false; error: string };
  /** deployments/aztec-mainnet.json, reduced to what it authorises. undefined: the record is invalid. */
  record?: {
    /** Contract names with a deployment transaction, block and current class. */
    contracts: string[];
    tokens: RecordedToken[];
    audit: boolean;
    sponsoredFpc: string | null;
  };
  /** Public storage reads of the recorded token, at node.blockNumber. */
  token?: {
    totalSupply: bigint | { error: string };
    admin: bigint | { error: string };
  };
  sponsor: {
    /** NEXT_PUBLIC_AZTEC_SPONSOR, if set. */
    configuredAddress: string | null;
    /** Voucher requests that reached the daily limit check in the last 24 h. null: not read. */
    requests24h: number | null;
  };
  pins: { l1ChainId: number; rollup: string; feeJuicePortal: string; nodeVersion: string; rollupVersion: number };
}

const RECORD = 'deployments/aztec-mainnet.json';

export function buildMetrics(s: Snapshot): Metric[] {
  const out: Metric[] = [];
  const nodeSource = `Aztec node ${s.nodeHost} (JSON-RPC)`;

  // ── Network ──
  if (s.node.ok) {
    out.push({
      id: 'aztec-node',
      group: 'network',
      label: 'Aztec Alpha node',
      status: s.node.drift.length ? 'mismatch' : 'live',
      value: `Block ${s.node.blockNumber.toLocaleString('en-US')}`,
      raw: String(s.node.blockNumber),
      detail: s.node.drift.length
        ? `The node differs from the pins compiled into the client: ${s.node.drift.join('; ')}. The wallet refuses to move value through it.`
        : `Node ${s.node.nodeVersion}, rollup version ${s.node.rollupVersion}, settling on L1 chain ${s.node.l1ChainId}. Matches the client's pins.`,
      source: nodeSource,
    });
  } else {
    out.push({
      id: 'aztec-node',
      group: 'network',
      label: 'Aztec Alpha node',
      status: 'unavailable',
      value: 'Node not responding',
      detail: `The node did not answer (${s.node.error}). Every figure that depends on it is shown as not read.`,
      source: nodeSource,
    });
  }

  out.push({
    id: 'l1-pins',
    group: 'network',
    label: 'Ethereum mainnet (L1)',
    status: s.node.ok ? (s.node.drift.length ? 'mismatch' : 'live') : 'unavailable',
    value: `Chain ${s.pins.l1ChainId}`,
    raw: String(s.pins.l1ChainId),
    detail: `Rollup ${s.pins.rollup}, Fee Juice portal ${s.pins.feeJuicePortal}. ${
      s.node.ok ? 'Chain ID and rollup address compared with what the node reports.' : 'Not compared: the node did not answer.'
    } Humanity Ledger has no contract of its own on L1.`,
    source: `Client pins (lib/aztec/sequencer/networks.ts) and ${nodeSource}`,
  });

  if (!s.record) {
    out.push({
      id: 'contracts',
      group: 'network',
      label: 'Contracts recorded on Aztec Alpha',
      status: 'unavailable',
      detail: `${RECORD} does not name the pinned Alpha network, so it authorises nothing.`,
      source: RECORD,
    });
  } else {
    const names = [...s.record.contracts, ...s.record.tokens.map((t) => `${t.symbol} token`)];
    out.push({
      id: 'contracts',
      group: 'network',
      label: 'Contracts recorded on Aztec Alpha',
      status: 'live',
      value: String(names.length),
      raw: String(names.length),
      detail: names.length
        ? `${names.join(', ')}. Each entry carries its deployment transaction and block.${
            s.record.contracts.length === 0 ? ' No escrow, stream or treasury contract is deployed.' : ''
          }`
        : 'No contract of ours is recorded.',
      source: RECORD,
    });
    out.push({
      id: 'audit',
      group: 'network',
      label: 'External security audit',
      status: s.record.audit ? 'live' : 'not-deployed',
      value: s.record.audit ? 'Recorded' : 'None (Alpha)',
      detail: s.record.audit
        ? 'An audit report is recorded for the deployed contracts.'
        : 'No external audit is recorded. The client asks every user to acknowledge this before an agreement.',
      source: RECORD,
    });
  }

  // ── Value moved through the protocol ──
  const escrowDeployed = !!s.record?.contracts.some((n) => /escrow/i.test(n));
  out.push({
    id: 'escrows',
    group: 'value',
    label: 'Escrow agreements',
    status: escrowDeployed ? 'not-measurable' : 'not-deployed',
    value: escrowDeployed ? undefined : '0',
    raw: escrowDeployed ? undefined : '0',
    detail: escrowDeployed
      ? 'Escrow positions are private notes: neither the server nor an observer can count open or completed agreements.'
      : 'No escrow contract is deployed on Aztec Alpha, so the client refuses every agreement there. None has been opened or completed.',
    source: RECORD,
  });
  out.push({
    id: 'shielded-volume',
    group: 'value',
    label: 'Total shielded volume',
    status: 'not-measurable',
    detail:
      'Amounts, senders and recipients of private transfers are hidden by design. The protocol publishes no aggregate yet, so there is no figure to show.',
    source: 'Aztec private state (by design)',
  });
  out.push({
    id: 'protocol-fees',
    group: 'value',
    label: 'Protocol fees collected',
    status: 'not-deployed',
    detail:
      'Phase 0 pending: no fee mechanism is deployed. The escrow and stream contracts take no fee, so there is no protocol revenue in ETH or USDC to report.',
    source: 'contracts/aztec/escrow, contracts/aztec/streams (source)',
  });

  // ── HLC ──
  const hlc = s.record?.tokens.find((t) => t.symbol === 'HLC');
  if (!hlc) {
    out.push({
      id: 'hlc-supply',
      group: 'token',
      label: 'HLC total supply',
      status: 'not-deployed',
      detail: `No HLC token is recorded in ${RECORD}.`,
      source: RECORD,
    });
  } else {
    const at = s.node.ok ? ` at L2 block ${s.node.blockNumber.toLocaleString('en-US')}` : '';
    const supply = s.token?.totalSupply;
    if (typeof supply === 'bigint') {
      out.push({
        id: 'hlc-supply',
        group: 'token',
        label: 'HLC total supply',
        status: 'live',
        value: `${formatUnits(supply, hlc.decimals, hlc.decimals)} HLC`,
        raw: supply.toString(),
        detail: `Public total_supply of ${short(hlc.address)}${at}, ${hlc.decimals} decimals. Deployed in L2 block ${hlc.deployBlock.toLocaleString('en-US')}.`,
        source: `${nodeSource}, public storage`,
      });
    } else {
      out.push({
        id: 'hlc-supply',
        group: 'token',
        label: 'HLC total supply',
        status: 'unavailable',
        detail: `Not read${supply ? `: ${supply.error}` : ''}. No figure is shown rather than one that may be wrong.`,
        source: `${nodeSource}, public storage`,
      });
    }
    const admin = s.token?.admin;
    if (typeof admin === 'bigint') {
      const renounced = admin === 0n;
      out.push({
        id: 'hlc-admin',
        group: 'token',
        label: 'HLC minting authority',
        status: 'live',
        value: renounced ? 'Zero address' : short(fieldHex(admin)),
        raw: fieldHex(admin),
        detail: renounced
          ? 'The admin is the zero address: nobody can grant new minting rights. Minters already granted are not read here.'
          : 'This admin can grant minting rights, so the supply is not fixed. It becomes fixed when every minter is revoked and the admin is set to an address nobody controls.',
        source: `${nodeSource}, public storage`,
      });
    } else {
      out.push({
        id: 'hlc-admin',
        group: 'token',
        label: 'HLC minting authority',
        status: 'unavailable',
        detail: `Not read${admin ? `: ${admin.error}` : ''}.`,
        source: `${nodeSource}, public storage`,
      });
    }
  }

  // ── Onboarding sponsorship ──
  const sponsorRecorded = s.record?.sponsoredFpc ?? null;
  if (!sponsorRecorded) {
    out.push({
      id: 'sponsor-pool',
      group: 'onboarding',
      label: 'Gas sponsorship pool (Fee Juice)',
      status: 'not-deployed',
      detail: s.sponsor.configuredAddress
        ? `An address is configured on the server (${short(s.sponsor.configuredAddress)}) but no sponsor deployment is recorded in ${RECORD}. Aztec Alpha has no canonical Sponsored FPC.`
        : 'No sponsor contract is deployed on Aztec Alpha, and Alpha has no canonical Sponsored FPC. New accounts pay their own Fee Juice.',
      source: RECORD,
    });
  } else {
    out.push({
      id: 'sponsor-pool',
      group: 'onboarding',
      label: 'Gas sponsorship pool (Fee Juice)',
      status: 'unavailable',
      detail: `Sponsor ${short(sponsorRecorded)} is recorded; its Fee Juice balance is not read by this dashboard yet.`,
      source: RECORD,
    });
  }
  if (!s.sponsor.configuredAddress) {
    out.push({
      id: 'sponsor-requests',
      group: 'onboarding',
      label: 'Sponsored transaction requests, 24 h',
      status: 'not-deployed',
      value: '0',
      raw: '0',
      detail: 'Sponsorship is off on this server, so no voucher can be issued.',
      source: 'Server configuration (NEXT_PUBLIC_AZTEC_SPONSOR)',
    });
  } else {
    out.push({
      id: 'sponsor-requests',
      group: 'onboarding',
      label: 'Sponsored transaction requests, 24 h',
      status: s.sponsor.requests24h === null ? 'unavailable' : 'live',
      value: s.sponsor.requests24h === null ? undefined : s.sponsor.requests24h.toLocaleString('en-US'),
      raw: s.sponsor.requests24h === null ? undefined : String(s.sponsor.requests24h),
      detail:
        s.sponsor.requests24h === null
          ? 'The counter could not be read.'
          : 'Requests for a new voucher that reached the daily limit check. A request is not a sponsored transaction: the proof may never be sent.',
      source: 'Server rate counter (aztec-sponsor-day)',
    });
  }

  return out;
}

// ─── Report ──────────────────────────────────────────────────────────────────

/** JSON with object keys sorted at every level, so the same content always hashes the same. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(v: unknown): unknown {
  if (typeof v === 'bigint') return v.toString();
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return Object.keys(o)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        if (o[k] !== undefined) acc[k] = sortKeys(o[k]);
        return acc;
      }, {});
  }
  return v;
}

export interface ProtocolReportBody {
  schema: 'hl-protocol-metrics/v1';
  generatedAt: string;
  network: { name: string; l1ChainId: number; rollupVersion: number };
  /** L2 block the node reported for this snapshot; null when the node did not answer. */
  anchorBlock: number | null;
  metrics: Metric[];
  howToVerify: string;
}

export const HOW_TO_VERIFY =
  'Every live figure names its source. Node figures can be re-read with node_getBlockNumber, node_getNodeInfo and ' +
  'node_getPublicStorageAt at anchorBlock; deployment entries can be checked against their transaction hashes. ' +
  'digest is the SHA-256 of the canonical JSON (keys sorted, no whitespace) of this object without the digest field.';
