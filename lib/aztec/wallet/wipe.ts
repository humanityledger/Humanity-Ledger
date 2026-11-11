/**
 * Removes this browser's Aztec wallet stores on sign-out.
 *
 * The embedded wallet keeps its PXE (`pxe_data…`: account secret keys,
 * registered contracts with their secrets, notes, registered senders) and its
 * account list (`wallet_data_…`) in SQLite on OPFS, one store per network,
 * and they outlive a sign-out. On a shared device the next person could read
 * them. listStores / deleteStore are the kv-store utilities for this
 * (@aztec-labs/kv-store/sqlite-opfs, since 5.0.1); call only after the wallet
 * is stopped, since an open store cannot be deleted.
 *
 * What a fresh store costs on the next sign-in: account keys are re-derived
 * from the wallet signature and notes resync from the chain; agreement
 * contracts are re-registered from their invitations in the chat; payments
 * from a sender are found again only once that sender's address is added
 * again (Receive, or sharing addresses in the DM). Nothing on chain is lost.
 */
export interface KvStoreAdmin {
  listStores(): Promise<string[]>;
  deleteStore(name: string): Promise<void>;
  /** Removes one whole OPFS pool directory (kv-store deletePoolDirectory); used for the legacy shared pool. */
  deletePoolDirectory?(poolDirectory: string): Promise<void>;
}

/**
 * The shared default pool of @aztec-labs/kv-store. Builds before 11 November 2026 opened the PXE store
 * there (the wallet store then failed with SqlitePoolBusyError, see store.ts); listStores does not see it,
 * so it is removed as a whole. Nothing else in the app uses this pool.
 */
export const LEGACY_SHARED_POOL = '.aztec-kv';

/** Best effort, never throws: removes the legacy shared pool if it exists and is not open in another tab. */
async function deleteLegacySharedPool(admin: KvStoreAdmin): Promise<'deleted' | 'absent' | 'failed'> {
  if (typeof admin.deletePoolDirectory !== 'function') return 'absent';
  try {
    const root = await globalThis.navigator?.storage?.getDirectory?.();
    if (root) {
      try {
        await root.getDirectoryHandle(LEGACY_SHARED_POOL);
      } catch {
        return 'absent';
      }
    }
    await admin.deletePoolDirectory(LEGACY_SHARED_POOL);
    return 'deleted';
  } catch {
    return 'failed';
  }
}

async function loadAdmin(): Promise<KvStoreAdmin | null> {
  const m: any = await import('@aztec-labs/kv-store/sqlite-opfs');
  if (typeof m.listStores !== 'function' || typeof m.deleteStore !== 'function') return null;
  return { listStores: m.listStores, deleteStore: m.deleteStore, deletePoolDirectory: typeof m.deletePoolDirectory === 'function' ? m.deletePoolDirectory : undefined };
}

export const isWalletStoreName = (n: unknown): n is string =>
  typeof n === 'string' &&
  (n.startsWith('pxe_data') || n.startsWith('wallet_data') || n.startsWith('pxe_') || n.startsWith('wallet_'));

/** Deletes every Aztec wallet store; never throws. `failed` lists what is left on the device. */
export async function wipeLocalAztecStores(kv?: KvStoreAdmin): Promise<{ deleted: string[]; failed: string[] }> {
  const deleted: string[] = [];
  const failed: string[] = [];
  let admin = kv;
  try {
    if (!admin) {
      const loaded = await loadAdmin();
      if (!loaded) return { deleted, failed: ['(kv-store utilities unavailable)'] };
      admin = loaded;
    }
    const legacy = await deleteLegacySharedPool(admin);
    if (legacy === 'deleted') deleted.push(LEGACY_SHARED_POOL);
    else if (legacy === 'failed') failed.push(LEGACY_SHARED_POOL);
    const names = (await admin.listStores()).filter(isWalletStoreName);
    for (const n of names) {
      try {
        await admin.deleteStore(n);
        deleted.push(n);
      } catch {
        failed.push(n); // e.g. still open in another tab
      }
    }
  } catch {
    failed.push('(stores could not be listed)');
  }
  return { deleted, failed };
}

/** How many Aztec wallet stores this browser holds; null when that cannot be read (never throws, never returns names). */
export async function countLocalAztecStores(kv?: KvStoreAdmin): Promise<number | null> {
  try {
    let admin = kv;
    if (!admin) {
      const m: any = await import('@aztec-labs/kv-store/sqlite-opfs');
      if (typeof m.listStores !== 'function') return null;
      admin = { listStores: m.listStores, deleteStore: m.deleteStore };
    }
    return (await admin.listStores()).filter(isWalletStoreName).length;
  } catch {
    return null;
  }
}

/** Store names for one network + rollup + account; the account appears only as a hash. Throws without a rollup (fail-closed). */
export async function walletStoreNames(
  network: 'testnet' | 'mainnet',
  rollupAddress: string,
  evmAddress: string,
  subtle: Pick<SubtleCrypto, 'digest'> = globalThis.crypto.subtle,
): Promise<{ pxeName: string; walletName: string }> {
  const rollup = rollupAddress.toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(rollup)) throw new Error('The Aztec node did not report its rollup address.');
  const d = new Uint8Array(await subtle.digest('SHA-256', new TextEncoder().encode(`hl/aztec-store/v1:${evmAddress.toLowerCase()}`)));
  const acct = Array.from(d.slice(0, 6), (b) => b.toString(16).padStart(2, '0')).join('');
  const tag = `${network === 'mainnet' ? 'alpha' : 'testnet'}_${rollup.slice(2, 10)}_${acct}`;
  return { pxeName: `pxe_${tag}`, walletName: `wallet_${tag}` };
}

/** Names written by builds before per-account encrypted stores: plaintext pxe_data…/wallet_data…, and the shared per-network names. */
export const isLegacyStoreName = (n: unknown): n is string =>
  typeof n === 'string' &&
  (n.startsWith('pxe_data') || n.startsWith('wallet_data') || ['pxe_testnet', 'wallet_testnet', 'pxe_alpha', 'wallet_alpha'].includes(n));

/** Best effort, never throws: removes legacy stores only (a store open in another tab stays). */
export async function wipeLegacyPlainStores(kv?: KvStoreAdmin): Promise<number> {
  try {
    let admin = kv;
    if (!admin) {
      const loaded = await loadAdmin();
      if (!loaded) return 0;
      admin = loaded;
    }
    let n = (await deleteLegacySharedPool(admin)) === 'deleted' ? 1 : 0;
    for (const name of (await admin.listStores()).filter(isLegacyStoreName)) {
      try { await admin.deleteStore(name); n++; } catch { /* open elsewhere */ }
    }
    return n;
  } catch {
    return 0;
  }
}
