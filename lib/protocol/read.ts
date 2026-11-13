/**
 * lib/protocol/read.ts — server only.
 *
 * Reads one snapshot for the protocol dashboard: the pinned Aztec Alpha node, the deployment
 * record, the recorded HLC token's public storage and the sponsor counter. Every read has a
 * timeout and fails closed: a failed read becomes an error in the snapshot, which the dashboard
 * shows as "Not read". Nothing falls back to a default figure.
 *
 * Snapshots are cached for 60 s and concurrent requests share one read (single flight), so the
 * public endpoint costs the node at most a few calls a minute however many people open it.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import mainnetRecord from '../../deployments/aztec-mainnet.json';
import { AZTEC_NETWORKS } from '@/lib/aztec/sequencer/networks';
import { identifyNode } from '@/lib/aztec/fees';
import { authorizedMainnetRecord } from '@/lib/aztec/agreement-policy';
import { relayUpstreams } from '@/lib/aztec/node-relay';
import {
  buildMetrics,
  canonicalJson,
  fieldHex,
  HOW_TO_VERIFY,
  parseField,
  parseSafeInt,
  storageSlot,
  type ProtocolReportBody,
  type RecordedSponsor,
  type RecordedToken,
  type Snapshot,
} from './metrics';

const RPC_TIMEOUT_MS = 8_000;
const CACHE_MS = 60_000;
const PINS = AZTEC_NETWORKS.mainnet;
const HEX32 = /^0x[0-9a-f]{64}$/i;

class RpcError extends Error {}

async function jsonRpc(url: string, method: string, params: unknown[]): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
    });
  } catch (e) {
    throw new RpcError(e instanceof Error && e.name === 'TimeoutError' ? `${method} timed out` : `${method} unreachable`);
  }
  if (!res.ok) throw new RpcError(`${method} answered HTTP ${res.status}`);
  const body: any = await res.json().catch(() => null);
  if (!body || typeof body !== 'object') throw new RpcError(`${method} answered no JSON`);
  if (body.error) throw new RpcError(`${method} error: ${String(body.error?.message ?? 'unknown').slice(0, 120)}`);
  if (!('result' in body)) throw new RpcError(`${method} answered no result`);
  return body.result;
}

/** The node for Alpha: the operator's configured upstream when the build runs on Alpha, else the pinned public node. */
function nodeUrl(): string {
  if (process.env.NEXT_PUBLIC_AZTEC_NETWORK === 'alpha') {
    const [first] = relayUpstreams(process.env);
    if (first) return first;
  }
  return PINS.publicNodeRpc;
}

function recordedTokens(raw: any): RecordedToken[] {
  if (!Array.isArray(raw?.tokens)) return [];
  return raw.tokens
    .filter(
      (t: any) =>
        t &&
        t.status === 'active' &&
        typeof t.symbol === 'string' &&
        Number.isInteger(t.decimals) &&
        t.decimals >= 0 &&
        t.decimals <= 36 &&
        HEX32.test(String(t.address)) &&
        HEX32.test(String(t.deployTx)) &&
        Number.isInteger(t.deployBlock) &&
        t.deployBlock > 0,
    )
    .map((t: any) => ({
      symbol: t.symbol,
      name: typeof t.name === 'string' ? t.name : undefined,
      decimals: t.decimals,
      address: String(t.address).toLowerCase(),
      deployTx: String(t.deployTx).toLowerCase(),
      deployBlock: t.deployBlock,
    }));
}

/** deployments/aztec-mainnet.json → sponsoredFpc: null, an address (legacy), or the full record. */
export function recordedSponsor(v: unknown): RecordedSponsor | null {
  if (typeof v === 'string') return HEX32.test(v) ? { address: v.toLowerCase(), feeJuiceContract: null, feeJuiceBalanceSlot: null } : null;
  const o = v as { address?: unknown; feeJuiceContract?: unknown; feeJuiceBalanceSlot?: unknown } | null;
  if (!o || typeof o !== 'object' || typeof o.address !== 'string' || !HEX32.test(o.address)) return null;
  const hexOrNull = (x: unknown) => (typeof x === 'string' && HEX32.test(x) ? x.toLowerCase() : null);
  return { address: o.address.toLowerCase(), feeJuiceContract: hexOrNull(o.feeJuiceContract), feeJuiceBalanceSlot: hexOrNull(o.feeJuiceBalanceSlot) };
}

function readRecord(): Snapshot['record'] {
  const raw: any = mainnetRecord;
  const authorized = authorizedMainnetRecord(raw, { l1ChainId: PINS.l1ChainId, rollupVersion: PINS.rollupVersion });
  if (!authorized) return undefined;
  const sponsor = recordedSponsor(raw?.sponsoredFpc);
  return {
    contracts: (authorized.contracts as ReadonlyArray<{ name: string }>).map((c) => c.name),
    tokens: recordedTokens(raw),
    audit: authorized.audit !== null,
    sponsoredFpc: sponsor,
  };
}

/**
 * Storage slots of the standard Token contract, from the artifact the client itself trusts
 * (@aztec-labs/noir-contracts.js, pinned in package.json). Read from disk, not assumed.
 */
let tokenSlots: { totalSupply: bigint; admin: bigint } | { error: string } | undefined;
function readTokenSlots(): { totalSupply: bigint; admin: bigint } | { error: string } {
  if (tokenSlots) return tokenSlots;
  try {
    const dir = join(process.cwd(), 'node_modules', '@aztec-labs', 'noir-contracts.js', 'artifacts');
    const file = readdirSync(dir).find((f) => /^token_contract-Token\.json$/i.test(f));
    if (!file) return (tokenSlots = { error: 'Token artifact not found on the server' });
    const artifact = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    const totalSupply = storageSlot(artifact, 'Token', 'total_supply');
    const admin = storageSlot(artifact, 'Token', 'admin');
    if (totalSupply === undefined || admin === undefined) return (tokenSlots = { error: 'storage layout not found in the Token artifact' });
    return (tokenSlots = { totalSupply, admin });
  } catch {
    return (tokenSlots = { error: 'Token artifact could not be read on the server' });
  }
}

async function readPublicField(url: string, block: number, contract: string, slot: bigint): Promise<bigint | { error: string }> {
  try {
    const v = parseField(await jsonRpc(url, 'node_getPublicStorageAt', [block, contract, fieldHex(slot)]));
    return v === undefined ? { error: 'the node answered a malformed value' } : v;
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'read failed' };
  }
}

async function readSponsorRequests24h(): Promise<number | null> {
  try {
    const { getRedisClient } = await import('@/lib/redis');
    const redis: any = await getRedisClient();
    const since = Date.now() - 86_400_000;
    const n = await Promise.race([
      redis.zcount('aztec-sponsor-day:all', since, '+inf'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3_000)),
    ]);
    const count = parseSafeInt(n);
    return count === undefined ? null : count;
  } catch {
    return null;
  }
}

export async function readSnapshot(): Promise<Snapshot> {
  const url = nodeUrl();
  let nodeHost = 'unknown';
  try {
    nodeHost = new URL(url).host;
  } catch {
    /* host stays unknown */
  }

  const record = readRecord();
  const sponsorAddress = (process.env.NEXT_PUBLIC_AZTEC_SPONSOR || '').trim() || null;

  const [nodeResult, requests24h] = await Promise.all([
    (async (): Promise<Snapshot['node']> => {
      try {
        const [blockRaw, info]: [unknown, any] = await Promise.all([
          jsonRpc(url, 'node_getBlockNumber', []),
          jsonRpc(url, 'node_getNodeInfo', []),
        ]);
        const blockNumber = parseSafeInt(blockRaw);
        const l1ChainId = parseSafeInt(info?.l1ChainId);
        const rollupVersion = parseSafeInt(info?.rollupVersion);
        if (blockNumber === undefined || l1ChainId === undefined || rollupVersion === undefined || typeof info?.nodeVersion !== 'string') {
          return { ok: false, error: 'the node answered an unexpected shape' };
        }
        const identity = identifyNode(info);
        const drift =
          identity.network !== 'mainnet'
            ? [`L1 chain ${l1ChainId} is not Ethereum mainnet`]
            : identity.drift.map((d) => `${d.field} ${d.actual} (expected ${d.expected})`);
        const portal = info?.l1ContractAddresses?.feeJuicePortalAddress;
        if (typeof portal === 'string' && portal.toLowerCase() !== PINS.l1.feeJuicePortal.toLowerCase()) {
          drift.push(`feeJuicePortal ${portal} (expected ${PINS.l1.feeJuicePortal})`);
        }
        return { ok: true, blockNumber, nodeVersion: info.nodeVersion, l1ChainId, rollupVersion, drift };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'read failed' };
      }
    })(),
    sponsorAddress ? readSponsorRequests24h() : Promise.resolve(null),
  ]);

  // Token storage only from a node that matches the pins, at the block just read.
  let token: Snapshot['token'];
  const hlc = record?.tokens.find((t) => t.symbol === 'HLC');
  if (hlc) {
    if (!nodeResult.ok) {
      token = { totalSupply: { error: 'the node did not answer' }, admin: { error: 'the node did not answer' } };
    } else if (nodeResult.drift.length) {
      token = { totalSupply: { error: 'the node differs from the pins' }, admin: { error: 'the node differs from the pins' } };
    } else {
      const slots = readTokenSlots();
      if ('error' in slots) {
        token = { totalSupply: { error: slots.error }, admin: { error: slots.error } };
      } else {
        const [totalSupply, admin] = await Promise.all([
          readPublicField(url, nodeResult.blockNumber, hlc.address, slots.totalSupply),
          readPublicField(url, nodeResult.blockNumber, hlc.address, slots.admin),
        ]);
        // total_supply is a u128: anything wider is not a supply and is refused.
        token = {
          totalSupply: typeof totalSupply === 'bigint' && totalSupply >= 2n ** 128n ? { error: 'value wider than u128' } : totalSupply,
          admin,
        };
      }
    }
  }

  // Sponsor Fee Juice (P-12): only with the slot and contract recorded at deployment, from a node
  // that matches the pins, at the block just read. No slot is computed on the server.
  let sponsorBalance: Snapshot['sponsor']['balance'];
  const sp = record?.sponsoredFpc;
  if (sp) {
    if (!sp.feeJuiceContract || !sp.feeJuiceBalanceSlot) {
      sponsorBalance = { error: 'the Fee Juice balance slot is not recorded (scripts/aztec/fee-juice-slot.mjs)' };
    } else if (!nodeResult.ok) {
      sponsorBalance = { error: 'the node did not answer' };
    } else if (nodeResult.drift.length) {
      sponsorBalance = { error: 'the node differs from the pins' };
    } else {
      const v = await readPublicField(url, nodeResult.blockNumber, sp.feeJuiceContract, BigInt(sp.feeJuiceBalanceSlot));
      sponsorBalance = typeof v === 'bigint' && v >= 2n ** 128n ? { error: 'value wider than u128' } : v;
    }
  }

  return {
    nodeHost,
    node: nodeResult,
    record,
    token,
    sponsor: { balance: sponsorBalance, configuredAddress: sponsorAddress, requests24h },
    pins: {
      l1ChainId: PINS.l1ChainId,
      rollup: PINS.l1.rollup,
      feeJuicePortal: PINS.l1.feeJuicePortal,
      nodeVersion: PINS.nodeVersion,
      rollupVersion: PINS.rollupVersion,
    },
  };
}

export interface ProtocolReport extends ProtocolReportBody {
  digestAlgorithm: 'sha256';
  digest: string;
}

export function buildReport(snapshot: Snapshot, now: Date = new Date()): ProtocolReport {
  const body: ProtocolReportBody = {
    schema: 'hl-protocol-metrics/v1',
    generatedAt: now.toISOString(),
    network: { name: PINS.label, l1ChainId: PINS.l1ChainId, rollupVersion: PINS.rollupVersion },
    anchorBlock: snapshot.node.ok ? snapshot.node.blockNumber : null,
    metrics: buildMetrics(snapshot),
    howToVerify: HOW_TO_VERIFY,
  };
  const digest = createHash('sha256').update(canonicalJson(body)).digest('hex');
  return { ...body, digestAlgorithm: 'sha256', digest };
}

let cache: { at: number; report: ProtocolReport } | undefined;
let inFlight: Promise<ProtocolReport> | undefined;

/** The current report: cached for 60 s, one read at a time. */
export function currentReport(): Promise<ProtocolReport> {
  if (cache && Date.now() - cache.at < CACHE_MS) return Promise.resolve(cache.report);
  if (inFlight) return inFlight;
  inFlight = readSnapshot()
    .then((snapshot) => {
      const report = buildReport(snapshot);
      cache = { at: Date.now(), report };
      return report;
    })
    .finally(() => {
      inFlight = undefined;
    });
  return inFlight;
}
