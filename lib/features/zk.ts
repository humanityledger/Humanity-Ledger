/**
 * H-034 / I-029 — ZK Feature flags
 * Controls which ZK features are available based on NEXT_PUBLIC_ZK_MODE.
 *
 * NEXT_PUBLIC_ZK_MODE values:
 *   undefined / 'disabled' — ZK features completely hidden (production default)
 *   'testnet'              — ZK features enabled on Aztec testnet only
 *   'mainnet'              — ZK features enabled on mainnet (requires audit + legal sign-off)
 */
export const ZK_MODE = process.env.NEXT_PUBLIC_ZK_MODE as 'disabled' | 'testnet' | 'mainnet' | undefined;

export const isZkEnabled = ZK_MODE === 'testnet' || ZK_MODE === 'mainnet';
export const isZkTestnet = ZK_MODE === 'testnet';
export const isZkMainnet = ZK_MODE === 'mainnet';

/**
 * Local simulations (lib/zk/zkMoney, zkStreaming, zkCommunityPayments) create notes, hashes and
 * balances that never reach a network. They run only with NEXT_PUBLIC_ZK_MODE=demo, never in a
 * production build and never on a build configured for Aztec Alpha (real funds), whatever the
 * mode says. process.env is read directly so Next.js inlines the values in client bundles.
 */
export function isLocalSimulationAllowed(): boolean {
  return (
    process.env.NEXT_PUBLIC_ZK_MODE === 'demo' &&
    process.env.NEXT_PUBLIC_AZTEC_NETWORK !== 'alpha' &&
    process.env.NODE_ENV !== 'production'
  );
}

export function assertLocalSimulationAllowed(feature: string): void {
  if (!isLocalSimulationAllowed()) {
    throw new Error(`${feature} is not available: it has no deployed contract, and local simulations never run in production or on Aztec Alpha.`);
  }
}

/**
 * Throws if ZK transfers are not enabled.
 * Call this at the start of any ZK-related API handler.
 */
export function assertZkEnabled(): void {
  if (!isZkEnabled) {
    throw new Error(
      'ZK transfers are disabled. Set NEXT_PUBLIC_ZK_MODE=testnet to enable. ' +
      'Mainnet requires external contract audit (H-037) and legal sign-off (N-008).'
    );
  }
}

/**
 * H-038 — Amount limits
 * Mainnet is blocked behind flag + audit. Testnet has a max transfer limit.
 */
export const AZTEC_MAX_TRANSFER_TESTNET = 100; // Max 100 tokens on testnet

export function assertTransferLimit(amount: number): void {
  assertZkEnabled();
  if (isZkTestnet && amount > AZTEC_MAX_TRANSFER_TESTNET) {
    throw new Error(
      `Transfer amount ${amount} exceeds testnet limit of ${AZTEC_MAX_TRANSFER_TESTNET}. ` +
      'Mainnet transfers require external contract audit.'
    );
  }
  if (isZkMainnet) {
    // TODO[H-038]: Mainnet enabled — ensure audit H-037 is complete
    console.warn('[ZK] Mainnet transfer initiated — ensure H-037 audit is complete.');
  }
}
