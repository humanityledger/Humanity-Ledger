/**
 * Point 6 edge cases: legacy handshake secrets are purged, the proving-memory
 * warning targets the devices that cannot hold a proof.
 */
import { describe, it, expect } from 'vitest';
import { purgeLegacyHandshakeSecrets } from '@/lib/scan/sessionHandshake';
import { provingMemoryAtRisk } from '@/lib/aztec/wallet/device';

function memStorage(init: Record<string, string>) {
  const m = new Map(Object.entries(init));
  return {
    get length() { return m.size; },
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => void m.delete(k),
    has: (k: string) => m.has(k),
  };
}

describe('purgeLegacyHandshakeSecrets', () => {
  it('removes the unused seed and vault, and nothing else', () => {
    const s = memStorage({ 'ledger_chat_seed_0xabc': 's', system_vault_v1: 'v', ledger_xmtp_db_key_0xabc: 'k', system_session_v2: 'x' });
    expect(purgeLegacyHandshakeSecrets(s)).toBe(2);
    expect(s.has('ledger_chat_seed_0xabc')).toBe(false);
    expect(s.has('system_vault_v1')).toBe(false);
    expect(s.has('ledger_xmtp_db_key_0xabc')).toBe(true);
    expect(s.has('system_session_v2')).toBe(true);
  });
  it('never throws without storage or when storage throws', () => {
    expect(purgeLegacyHandshakeSecrets(undefined)).toBe(0);
    expect(purgeLegacyHandshakeSecrets({ get length(): number { throw new Error('blocked'); }, key: () => null, removeItem: () => {} })).toBe(0);
  });
});

describe('provingMemoryAtRisk (R-16)', () => {
  it('warns on iPhone, iPad (including iPadOS desktop mode) and low-memory Android', () => {
    expect(provingMemoryAtRisk({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' })).toBe(true);
    expect(provingMemoryAtRisk({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)' })).toBe(true);
    expect(provingMemoryAtRisk({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 5 })).toBe(true);
    expect(provingMemoryAtRisk({ userAgent: 'Mozilla/5.0 (Linux; Android 14)', deviceMemory: 4 })).toBe(true);
  });
  it('does not warn on a Mac, or Android with more memory, or when unknown', () => {
    expect(provingMemoryAtRisk({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 0 })).toBe(false);
    expect(provingMemoryAtRisk({ userAgent: 'Mozilla/5.0 (Linux; Android 14)', deviceMemory: 8 })).toBe(false);
    expect(provingMemoryAtRisk({})).toBe(false);
  });
});
