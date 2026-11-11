/**
 * The PXE store and the wallet store each live in their own OPFS pool directory.
 *
 * @aztec-labs/kv-store 6.0.0 takes an origin-wide Web Lock on a store's pool
 * directory while the store is open. Before 11 November 2026 both stores were
 * opened in the default pool ".aztec-kv", so the second open always failed with
 * `SQLite-OPFS pool ".aztec-kv" is already in use by another store instance`
 * and the private wallet could never open.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const opened: Array<{ name: string; pool: string | undefined }> = [];
const held = new Set<string>();

vi.mock('@aztec-labs/foundation/log', () => ({
  createLogger: () => ({ createChild: () => ({}) }),
}));

vi.mock('@aztec-labs/kv-store/sqlite-opfs', () => ({
  storePoolDirectory: (name: string) => `.aztec-kv-${name}`,
  AztecSQLiteOPFSStore: {
    // Same rule as the SDK: one open store per pool directory (default ".aztec-kv").
    open: async (_log: unknown, name: string, _ephemeral: boolean, poolDirectory?: string) => {
      const pool = poolDirectory ?? '.aztec-kv';
      if (held.has(pool)) throw new Error(`SQLite-OPFS pool "${pool}" is already in use by another store instance`);
      held.add(pool);
      opened.push({ name, pool: poolDirectory });
      return { close: async () => { held.delete(pool); } };
    },
  },
}));

const SIG = '0x' + '4355c47d63924e8a72e509b66023a0d6ff482937358075b97d5502cb6f87d0c8'.repeat(2) + '1c';

afterEach(() => {
  opened.length = 0;
  held.clear();
  vi.unstubAllGlobals();
});

describe('openEncryptedWalletStores: one pool per store', () => {
  it('opens the PXE and wallet stores in their own pool directories, so both open', async () => {
    vi.stubGlobal('navigator', { storage: { getDirectory: async () => ({}) } });
    vi.stubGlobal('Worker', class {});
    const { openEncryptedWalletStores } = await import('@/lib/aztec/wallet/store');
    const r = await openEncryptedWalletStores(SIG, { pxeName: 'pxe_alpha_e37a2663_abc', walletName: 'wallet_alpha_e37a2663_abc' });
    expect(r.isEncrypted).toBe(true);
    expect(opened).toEqual([
      { name: 'pxe_alpha_e37a2663_abc', pool: '.aztec-kv-pxe_alpha_e37a2663_abc' },
      { name: 'wallet_alpha_e37a2663_abc', pool: '.aztec-kv-wallet_alpha_e37a2663_abc' },
    ]);
  });

  it('falls back to the kv-store naming when storePoolDirectory is not exported', async () => {
    const { storePoolDirectoryFor } = await import('@/lib/aztec/wallet/store');
    expect(storePoolDirectoryFor({}, 'pxe_x')).toBe('.aztec-kv-pxe_x');
    expect(storePoolDirectoryFor({ storePoolDirectory: (n) => `custom-${n}` }, 'pxe_x')).toBe('custom-pxe_x');
  });
});

describe('legacy shared pool', () => {
  it('sign-out wipe removes the legacy ".aztec-kv" pool as well as the per-store pools', async () => {
    const { wipeLocalAztecStores } = await import('@/lib/aztec/wallet/wipe');
    const removedPools: string[] = [];
    const deletedStores: string[] = [];
    const r = await wipeLocalAztecStores({
      listStores: async () => ['pxe_alpha_x', 'wallet_alpha_x'],
      deleteStore: async (n) => { deletedStores.push(n); },
      deletePoolDirectory: async (p) => { removedPools.push(p); },
    });
    expect(removedPools).toEqual(['.aztec-kv']);
    expect(deletedStores).toEqual(['pxe_alpha_x', 'wallet_alpha_x']);
    expect(r.failed).toEqual([]);
  });

  it('a legacy pool open in another tab is reported, never thrown', async () => {
    const { wipeLocalAztecStores } = await import('@/lib/aztec/wallet/wipe');
    const r = await wipeLocalAztecStores({
      listStores: async () => [],
      deleteStore: async () => {},
      deletePoolDirectory: async () => { throw new Error('busy'); },
    });
    expect(r.failed).toEqual(['.aztec-kv']);
  });
});

describe('humanError: wallet open in another tab', () => {
  it('names the other tab instead of a storage failure', async () => {
    const { humanError } = await import('@/lib/aztec/wallet/client');
    const msg = humanError(new Error('[ENCRYPTED STORE ERROR] Failed to open encrypted stores: SQLite-OPFS pool ".aztec-kv-pxe_x" is already in use by another store instance'));
    expect(msg).toMatch(/already open in another Ledger Chat tab/);
  });
});
