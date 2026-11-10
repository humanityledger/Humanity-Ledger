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
