/**
 * Sign-out removes the Aztec wallet stores (PXE keys, contract secrets, notes)
 * and reports what could not be removed, without throwing.
 */
import { describe, it, expect } from 'vitest';
import { isWalletStoreName, wipeLocalAztecStores, type KvStoreAdmin } from '@/lib/aztec/wallet/wipe';

function admin(names: string[], locked: string[] = []): KvStoreAdmin & { left: string[] } {
  const left = [...names];
  return {
    left,
    listStores: async () => [...left],
    deleteStore: async (n) => {
      if (locked.includes(n)) throw new Error('already in use');
      left.splice(left.indexOf(n), 1);
    },
  };
}

describe('wipeLocalAztecStores', () => {
  it('deletes PXE and wallet stores of every network, and nothing else', async () => {
    const a = admin(['pxe_data_1_0xabc_7', 'wallet_data_1_0xabc', 'pxe_data_11155111_0xdef_7', 'other_app_store']);
    const r = await wipeLocalAztecStores(a);
    expect(r.deleted.length).toBe(3);
    expect(r.failed).toEqual([]);
    expect(a.left).toEqual(['other_app_store']);
  });

  it('reports a store it could not delete (open in another tab) and keeps going', async () => {
    const a = admin(['pxe_data_a', 'wallet_data_b'], ['pxe_data_a']);
    const r = await wipeLocalAztecStores(a);
    expect(r).toEqual({ deleted: ['wallet_data_b'], failed: ['pxe_data_a'] });
  });

  it('never throws when the stores cannot be listed', async () => {
    const r = await wipeLocalAztecStores({ listStores: async () => { throw new Error('no OPFS'); }, deleteStore: async () => {} });
    expect(r.deleted).toEqual([]);
    expect(r.failed.length).toBe(1);
  });

  it('matches only wallet store names', () => {
    expect(isWalletStoreName('pxe_data')).toBe(true);
    expect(isWalletStoreName('wallet_data_x')).toBe(true);
    expect(isWalletStoreName('xmtp_db')).toBe(false);
    expect(isWalletStoreName(undefined)).toBe(false);
  });
});

describe('countLocalAztecStores', () => {
  it('counts only wallet stores and fails to null, never throws', async () => {
    const { countLocalAztecStores } = await import('@/lib/aztec/wallet/wipe');
    expect(await countLocalAztecStores({ listStores: async () => ['pxe_data_1', 'wallet_data_x', 'chat_db'], deleteStore: async () => {} })).toBe(2);
    expect(await countLocalAztecStores({ listStores: async () => { throw new Error('opfs'); }, deleteStore: async () => {} })).toBeNull();
  });
});

describe('per-account encrypted store names and legacy cleanup', () => {
  const rollup = '0x' + 'ab'.repeat(20);
  it('names differ by account, network and rollup and never contain the address', async () => {
    const { walletStoreNames } = await import('@/lib/aztec/wallet/wipe');
    const a = await walletStoreNames('testnet', rollup, '0x' + '11'.repeat(20));
    const b = await walletStoreNames('testnet', rollup, '0x' + '22'.repeat(20));
    const c = await walletStoreNames('mainnet', rollup, '0x' + '11'.repeat(20));
    const d = await walletStoreNames('testnet', '0x' + 'cd'.repeat(20), '0x' + '11'.repeat(20));
    expect(new Set([a.pxeName, b.pxeName, c.pxeName, d.pxeName]).size).toBe(4);
    expect(a.pxeName.includes('1111')).toBe(false);
    expect(a.pxeName.startsWith('pxe_testnet_abababab_')).toBe(true);
    expect(a.walletName.startsWith('wallet_')).toBe(true);
  });
  it('refuses to name stores without a rollup address (fail-closed)', async () => {
    const { walletStoreNames } = await import('@/lib/aztec/wallet/wipe');
    await expect(walletStoreNames('testnet', '', '0x' + '11'.repeat(20))).rejects.toThrow('rollup');
  });
  it('legacy cleanup removes only plaintext and shared-name stores', async () => {
    const { wipeLegacyPlainStores, walletStoreNames } = await import('@/lib/aztec/wallet/wipe');
    const cur = await walletStoreNames('testnet', rollup, '0x' + '11'.repeat(20));
    const deleted: string[] = [];
    const names = ['pxe_data', 'wallet_data_x', 'pxe_testnet', 'wallet_alpha', cur.pxeName, cur.walletName, 'chat_db'];
    const n = await wipeLegacyPlainStores({ listStores: async () => names, deleteStore: async (x) => { deleted.push(x); } });
    expect(n).toBe(4);
    expect(deleted.includes(cur.pxeName)).toBe(false);
    expect(deleted.includes('chat_db')).toBe(false);
  });
});
