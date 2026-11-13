import { readFileSync } from 'node:fs';
import {
  checkName,
  dbKeyMessage,
  deriveDbKey,
  legacyKeyName,
  resolveDbKey,
  wrappedKeyName,
  type KeyStore,
} from '@/lib/xmtp/db-key';

const ADDRESS = '0x1111111111111111111111111111111111111111';
/** A 65-byte signature (r ‖ s ‖ v), as a deterministic EOA wallet returns. */
const SIG_A = '0x' + 'ab'.repeat(32) + 'cd'.repeat(32) + '1b';
const SIG_B = '0x' + '12'.repeat(32) + '34'.repeat(32) + '1c';
const signWith = (sig: string) => async (_m: string) => sig;

function memoryStore(init: Record<string, string> = {}): KeyStore & { data: Map<string, string>; writes: number } {
  const data = new Map(Object.entries(init));
  const s = {
    data,
    writes: 0,
    get: (k: string) => data.get(k) ?? null,
    set: (k: string, v: string) => {
      s.writes++;
      data.set(k, v);
    },
    remove: (k: string) => {
      s.writes++;
      data.delete(k);
    },
  };
  return s;
}

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

describe('XMTP local database key (F-01)', () => {
  it('derives the same 32-byte key from the same signature, a different one from another', async () => {
    const a1 = await deriveDbKey(ADDRESS, signWith(SIG_A));
    const a2 = await deriveDbKey(ADDRESS, signWith(SIG_A));
    const b = await deriveDbKey(ADDRESS, signWith(SIG_B));
    expect(a1).toHaveLength(32);
    expect(hex(a1)).toBe(hex(a2));
    expect(hex(a1)).not.toBe(hex(b));
  });

  it('asks the wallet to sign a message that names the account, the purpose and the risk', async () => {
    let seen = '';
    await deriveDbKey(ADDRESS, async (m) => {
      seen = m;
      return SIG_A;
    });
    expect(seen).toBe(dbKeyMessage(ADDRESS));
    expect(seen).toMatch(new RegExp(`Account: ${ADDRESS}`));
    expect(seen).toMatch(/never sent to any server/);
    expect(seen).toMatch(/Only sign it on ledgerchat\.org/);
  });

  it('fails closed: no key when the signature is refused, malformed or not a 65-byte ECDSA signature', async () => {
    await expect(deriveDbKey(ADDRESS, async () => { throw new Error('User rejected the request.'); })).rejects.toThrow(/User rejected/);
    await expect(deriveDbKey(ADDRESS, signWith('0xzz'))).rejects.toThrow();
    await expect(deriveDbKey(ADDRESS, signWith('0x' + 'ab'.repeat(200)))).rejects.toThrow(/65-byte/);
  });

  it('the derivation writes nothing to localStorage', async () => {
    const calls: string[] = [];
    const ls = {
      getItem: () => null,
      setItem: (k: string) => calls.push(`set:${k}`),
      removeItem: (k: string) => calls.push(`remove:${k}`),
    };
    const g = globalThis as unknown as { localStorage?: unknown };
    const saved = g.localStorage;
    g.localStorage = ls;
    try {
      await deriveDbKey(ADDRESS, signWith(SIG_A));
    } finally {
      g.localStorage = saved;
    }
    expect(calls).toEqual([]);
  });

  it('a new device stores only a public check value, never the key', async () => {
    const store = memoryStore();
    const { key, migrated } = await resolveDbKey(ADDRESS, signWith(SIG_A), store);
    expect(migrated).toBe(false);
    expect([...store.data.keys()]).toEqual([checkName(ADDRESS)]);
    for (const v of store.data.values()) expect(v).not.toContain(hex(key));
    expect(hex(key)).toBe(hex(await deriveDbKey(ADDRESS, signWith(SIG_A))));
  });

  it('migrates the plaintext legacy key without losing the database: same key, now encrypted', async () => {
    const legacy = 'f0'.repeat(32);
    const store = memoryStore({ [legacyKeyName(ADDRESS)]: legacy });
    const first = await resolveDbKey(ADDRESS, signWith(SIG_A), store);
    expect(first.migrated).toBe(true);
    expect(hex(first.key)).toBe(legacy);
    expect(store.data.has(legacyKeyName(ADDRESS))).toBe(false);
    expect(store.data.get(wrappedKeyName(ADDRESS))).not.toContain(legacy);

    const again = await resolveDbKey(ADDRESS, signWith(SIG_A), store);
    expect(again.migrated).toBe(false);
    expect(hex(again.key)).toBe(legacy);
  });

  it('refuses a different signature instead of opening or creating another database', async () => {
    const store = memoryStore();
    await resolveDbKey(ADDRESS, signWith(SIG_A), store);
    await expect(resolveDbKey(ADDRESS, signWith(SIG_B), store)).rejects.toThrow(/differs/);

    const migratedStore = memoryStore({ [legacyKeyName(ADDRESS)]: 'aa'.repeat(32) });
    await resolveDbKey(ADDRESS, signWith(SIG_A), migratedStore);
    await expect(resolveDbKey(ADDRESS, signWith(SIG_B), migratedStore)).rejects.toThrow(/differs/);
  });

  it('a tampered ciphertext is refused', async () => {
    const store = memoryStore({ [legacyKeyName(ADDRESS)]: 'aa'.repeat(32) });
    await resolveDbKey(ADDRESS, signWith(SIG_A), store);
    const w = store.data.get(wrappedKeyName(ADDRESS))!;
    store.data.set(wrappedKeyName(ADDRESS), (w[0] === 'A' ? 'B' : 'A') + w.slice(1));
    await expect(resolveDbKey(ADDRESS, signWith(SIG_A), store)).rejects.toThrow(/could not be decrypted/);
  });

  it('the XMTP client no longer generates or stores a plaintext key', () => {
    const client = readFileSync('lib/xmtp/client.ts', 'utf8');
    expect(client).not.toMatch(/localStorage\.setItem\(storageKey, dbKeyHex\)/);
    expect(client).not.toMatch(/crypto\.getRandomValues\(keyBytes\)/);
    expect(client).toMatch(/resolveDbKey\(address/);
  });
});
