import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Railway passes a service variable to a Dockerfile build only when the Dockerfile declares it with
// ARG. A NEXT_PUBLIC_* value the code reads must therefore be declared, or it is never inlined and
// the bundle silently falls back to the code default.
const root = process.cwd();
const dockerfile = readFileSync(path.join(root, 'Dockerfile'), 'utf8');
const declared = new Set([...dockerfile.matchAll(/^(?:ARG|ENV)\s+([A-Z0-9_]+)/gm)].map((m) => m[1]));

/**
 * Read by the code but deliberately not passed to the build. Each needs a reason: either the value
 * must never reach a production bundle, or it could carry a provider key (docs/PENDING_STEFAN.md,
 * P-04), or only code being retired reads it (docs/plan/status-and-phases.md, B11).
 */
const NOT_PASSED: Record<string, string> = {
  NEXT_PUBLIC_E2E_HARNESS: 'test harness, never on in production',
  NEXT_PUBLIC_TURN_CREDENTIAL: 'static TURN secret; TURN credentials come from /api/calls/ice',
  NEXT_PUBLIC_TURN_USERNAME: 'static TURN secret; TURN credentials come from /api/calls/ice',
  NEXT_PUBLIC_ALCHEMY_RPC_URL: 'may carry a provider key (P-04)',
  NEXT_PUBLIC_ALCHEMY_POLY_RPC_URL: 'may carry a provider key (P-04)',
  NEXT_PUBLIC_ETH_RPC_URL: 'may carry a provider key (P-04)',
  NEXT_PUBLIC_OPTIMISM_RPC: 'may carry a provider key (P-04)',
  NEXT_PUBLIC_BITCOIN_RPC_URL: 'may carry a provider key (P-04)',
  NEXT_PUBLIC_STATUS_NOTICE: 'old landing trees only',
  NEXT_PUBLIC_IDENTITY_SIWE_STUDIO_ENABLED: 'Ledger Studio is locked',
  NEXT_PUBLIC_AIRDROP_CONTRACT_ADDRESS: 'retired code',
  NEXT_PUBLIC_AUTH_ACTION: 'retired code',
  NEXT_PUBLIC_AUTH_APP_ID: 'retired code',
  NEXT_PUBLIC_CHAIN_ID: 'retired code',
  NEXT_PUBLIC_GOVERNANCE_CONTRACT_ADDRESS: 'retired code',
  NEXT_PUBLIC_LEDGER_CONTRACT_ADDRESS: 'retired code',
  NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS: 'retired code',
  NEXT_PUBLIC_ZAP_GASLESS_CONTRACT_ADDRESS: 'retired code',
};

function readNames(): string[] {
  const out = execSync(
    "grep -rhoE 'process\\.env\\.NEXT_PUBLIC_[A-Z0-9_]+' --include=*.ts --include=*.tsx --include=*.js --include=*.mjs app components lib hooks context middleware.ts next.config.js || true",
    { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 },
  );
  return [...new Set(out.split('\n').filter(Boolean).map((l) => l.replace('process.env.', '')))].sort();
}

describe('Dockerfile build arguments', () => {
  it.each([
    'NEXT_PUBLIC_LEDGER_RELAY',
    'NEXT_PUBLIC_LEDGER_RELAYS',
    'NEXT_PUBLIC_LEDGER_RELAY_PIN',
    'NEXT_PUBLIC_PEERJS_HOST',
    'NEXT_PUBLIC_PEERJS_PORT',
    'NEXT_PUBLIC_PEERJS_PATH',
    'NEXT_PUBLIC_PEERJS_KEY',
    'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
    'NEXT_PUBLIC_XMTP_ENV',
  ])('declares %s', (name) => {
    expect(declared.has(name)).toBe(true);
  });

  it('declares every NEXT_PUBLIC variable the code reads, except the listed ones', () => {
    const names = readNames();
    expect(names.length).toBeGreaterThan(20);
    const missing = names.filter((n) => !declared.has(n) && !(n in NOT_PASSED));
    expect(missing).toEqual([]);
  });

  it('never passes a listed name to the build', () => {
    for (const name of Object.keys(NOT_PASSED)) expect(declared.has(name)).toBe(false);
  });
});
