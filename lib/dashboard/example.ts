/**
 * lib/dashboard/example.ts — a made-up account for /dashboard?example=1: what the dashboard looks
 * like with history, for people deciding whether to open their own wallet, and for screenshots.
 * Deterministic, labelled "Example data" on every screen, and never mixed with a real wallet.
 */
import type { Activity } from '@/lib/aztec/wallet/history';

const KINDS: Activity['kind'][] = ['receive', 'send', 'send', 'receive', 'shield', 'send', 'receive', 'unshield'];
const PEOPLE = Array.from({ length: 18 }, (_, i) => '0x' + ((i + 7) * 0x9e3779b1).toString(16).padStart(8, '0').repeat(8).slice(0, 64));

/** A small deterministic generator, so every visit draws the same example. */
function rng(seed: number) {
  let x = seed >>> 0;
  return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

export function exampleActivity(now: number, count = 1400): Activity[] {
  const r = rng(42);
  const out: Activity[] = [];
  for (let i = 0; i < count; i++) {
    const kind = KINDS[Math.floor(r() * KINDS.length)];
    const at = now - Math.floor(Math.pow(r(), 1.6) * 120 * 86_400_000);
    const st = r();
    const token = r() < 0.75 ? 'CUSDC' : 'ETH';
    const units = Math.floor((r() * 240 + 1) * 1e6); // 1 to 241 cUSDC (6 decimals)
    out.push({
      id: `example-${i}`,
      kind,
      token,
      amount: token === 'CUSDC' ? String(units) : String(BigInt(units) * 1_000_000_000n), // 0.001 to 0.241 ETH
      counterparty: kind === 'send' || kind === 'receive' ? PEOPLE[Math.floor(Math.pow(r(), 2) * PEOPLE.length)] : undefined,
      txHash: '0x' + Math.floor(r() * 2 ** 52).toString(16).padStart(14, '0').repeat(5).slice(0, 64),
      blockNumber: 29_000 + Math.floor(r() * 9000),
      status: i < 2 ? 'proving' : st < 0.03 ? 'failed' : 'settled',
      error: st < 0.03 ? 'The network rejected the transaction.' : undefined,
      createdAt: i < 2 ? now - 4 * 60_000 : at,
    });
  }
  return out;
}

export const EXAMPLE_TOKENS = [
  { key: 'CUSDC' as const, symbol: 'cUSDC', decimals: 6, privateUnits: 1_284_500_000n, publicUnits: 0n },
  { key: 'ETH' as const, symbol: 'ETH', decimals: 18, privateUnits: 420_000_000_000_000_000n, publicUnits: 15_000_000_000_000_000n },
];

export const EXAMPLE_PEOPLE = PEOPLE;

/* Everything the example shows that is not activity, kept here so the normal path holds no made-up value
 * (test/unit/dashboard/real-data.test.ts). Reached only through lib/dashboard/sources.ts when the URL
 * says ?example=1. */

/** The made-up Ledger Chat account of the example. */
export const EXAMPLE_ACCOUNT = '0x0000000000000000000000000000000000e4a3c1';

const EXAMPLE_NAMES = ['Amara', 'Jonas', 'Lucía', 'Mei', 'Oskar', 'Priya', 'Tomás', 'Yuki', 'Nadia', 'Felix', 'Inés', 'Ravi'];

/** The wallet state the example draws: ready, with the balances and activity above. */
export function exampleWalletState(now: number) {
  return {
    phase: 'ready' as const,
    busy: false,
    aztecAddress: '0x' + 'e4a3c1'.repeat(10) + '0000',
    balances: EXAMPLE_TOKENS,
    activity: exampleActivity(now),
    feeJuice: { balance: 4_200_000_000_000_000_000n, minForTx: 1_000_000_000_000_000_000n, claims: [], plan: 'balance' as const },
  };
}

export function exampleBindings() {
  return PEOPLE.slice(0, 11).map((a, i) => ({ inboxId: `example-${i}`, aztecAddress: a }));
}

export function exampleContacts() {
  return PEOPLE.map((a, i) => ({ address: a, name: EXAMPLE_NAMES[i % EXAMPLE_NAMES.length] }));
}
