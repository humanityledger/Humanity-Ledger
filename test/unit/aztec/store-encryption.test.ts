import { describe, expect, it } from 'vitest';
import { deriveStoreEncryptionKey, WALLET_TYPED_DATA, WALLET_TYPED_DATA_ALPHA } from '@/lib/aztec/wallet/keys';
import { assertEncryptedStoreKey, EncryptedStoreError, openEncryptedWalletStores } from '@/lib/aztec/wallet/store';

const DUMMY_SIG_TESTNET =
  '0x4355c47d63924e8a72e509b66023a0d6ff482937358075b97d5502cb6f87d0c8652426f97141f201fe2479886494833228f452e4ec8736a78c088947094150d71c';
const DUMMY_SIG_ALPHA =
  '0x5a55c47d63924e8a72e509b66023a0d6ff482937358075b97d5502cb6f87d0c8652426f97141f201fe2479886494833228f452e4ec8736a78c088947094150d71b';

describe('Aztec Encrypted Store Fortification (OPFS SQLite & Key Derivation)', () => {
  it('derives a 32-byte encryption key deterministically from an EIP-712 signature', async () => {
    const key1 = await deriveStoreEncryptionKey(DUMMY_SIG_TESTNET);
    const key2 = await deriveStoreEncryptionKey(DUMMY_SIG_TESTNET);

    expect(key1).toBeInstanceOf(Uint8Array);
    expect(key1.byteLength).toBe(32);
    expect(key1).toEqual(key2);
    expect(() => assertEncryptedStoreKey(key1)).not.toThrow();
  });

  it('enforces network domain separation for store encryption keys', async () => {
    const keyTestnet = await deriveStoreEncryptionKey(DUMMY_SIG_TESTNET);
    const keyAlpha = await deriveStoreEncryptionKey(DUMMY_SIG_ALPHA);

    expect(keyTestnet).not.toEqual(keyAlpha);
  });

  it('assertEncryptedStoreKey rejects invalid, short, or zero keys', () => {
    expect(() => assertEncryptedStoreKey(null)).toThrow(EncryptedStoreError);
    expect(() => assertEncryptedStoreKey(undefined)).toThrow(EncryptedStoreError);
    expect(() => assertEncryptedStoreKey(new Uint8Array(16))).toThrow(EncryptedStoreError);
    expect(() => assertEncryptedStoreKey(new Uint8Array(32))).toThrow(EncryptedStoreError); // all zeros
  });

  it('openEncryptedWalletStores rejects missing or empty signature', async () => {
    await expect(openEncryptedWalletStores('')).rejects.toThrow(EncryptedStoreError);
    await expect(openEncryptedWalletStores(null as any)).rejects.toThrow(EncryptedStoreError);
  });

  it('fails closed without OPFS + Worker: no stand-in store that claims encryption', async () => {
    await expect(
      openEncryptedWalletStores(DUMMY_SIG_TESTNET, { pxeName: 'test_pxe', walletName: 'test_wallet' }),
    ).rejects.toThrow(/encrypted private wallet/);
  });
});
