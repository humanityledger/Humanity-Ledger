/**
 * Retired 29 October 2026.
 *
 * This module minted 500 QD to every newly created account from a server hot
 * key (PRIVATE_KEY) whenever a token contract was configured. Humanity Ledger
 * has no token (QD was retired on 23 October 2026), and an automatic mint per
 * new wallet let anyone drain the key's gas by creating wallets. The function
 * is kept as a no-op so stale imports fail safe.
 */
export async function airdropWelcomeQDs(_walletAddress: string): Promise<void> {
  return;
}
