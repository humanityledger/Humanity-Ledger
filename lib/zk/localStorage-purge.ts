/**
 * I-017: Purge localStorage of legacy simulated ZK financial keys.
 * Financial balances, streams, and notes must come from the blockchain / PXE,
 * never from client localStorage.
 */

const LEGACY_ZK_KEYS = [
  'ledger_zk_balance',
  'ledger_zk_notes',
  'ledger_zk_streams',
  'zk_money_vault',
  'ledger_zk_history',
];

export function purgeZkLocalStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    for (const key of LEGACY_ZK_KEYS) {
      localStorage.removeItem(key);
    }

    // Also remove any arbitrary keys matching the prefix
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('ledger_zk_') || k.startsWith('zk_vault_'))) {
        keysToRemove.push(k);
      }
    }

    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
  } catch (err) {
    // LocalStorage access may be restricted by browser privacy settings
  }
}
