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
    out.push({
      id: `example-${i}`,
      kind,
      token: r() < 0.75 ? 'CUSDC' : 'ETH',
      amount: String(Math.floor((r() * 240 + 1) * 1e6)), // 6 decimals for cUSDC; read as 18 for ETH, so ETH stays small
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
