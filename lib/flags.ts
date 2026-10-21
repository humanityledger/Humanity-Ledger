/**
 * lib/flags.ts — I-029: Feature flags for non-core modules
 *
 * ALL non-core features are OFF in production by default.
 * Enable them explicitly via environment variables.
 *
 * Core features (always on):
 *   - Chat (XMTP DMs)
 *   - Communities (public server-side, private XMTP)
 *   - Identity (SIWE, email + wallet)
 *
 * Non-core features (require explicit env var):
 *   - ZK payments (Aztec)
 *   - Terminal / Omni-Matrix
 *   - Academy
 *   - Governance
 *   - Studio (product passport)
 *
 * I-028: Core = chat, communities, calls, private payments (when ZK_MODE=testnet)
 */
export const FLAGS = {
  /** ZK transfers enabled (testnet or mainnet) — H-034 */
  ZK_PAYMENTS: ['testnet', 'mainnet'].includes(process.env.NEXT_PUBLIC_ZK_MODE || ''),

  /** ZK transfers on mainnet — H-038: blocked until audit + legal review */
  ZK_MAINNET:  process.env.NEXT_PUBLIC_ZK_MODE === 'mainnet',

  /** LiveKit-based group calls */
  CALLS_LIVEKIT: process.env.NEXT_PUBLIC_ENABLE_LIVEKIT === 'true',

  /** Terminal / Omni-Matrix UI */
  TERMINAL: process.env.NEXT_PUBLIC_ENABLE_TERMINAL === 'true',

  /** Academy module */
  ACADEMY: process.env.NEXT_PUBLIC_ENABLE_ACADEMY === 'true',

  /** On-chain governance */
  GOVERNANCE: process.env.NEXT_PUBLIC_ENABLE_GOVERNANCE === 'true',

  /** Product passport / Studio */
  STUDIO: process.env.NEXT_PUBLIC_ENABLE_STUDIO === 'true',

  /** ZK community treasury (requires multisig contract audit) */
  ZK_TREASURY: process.env.NEXT_PUBLIC_FEATURE_ZK_TREASURY === 'true',

  /** ZK compliance modal */
  ZK_COMPLIANCE: process.env.NEXT_PUBLIC_FEATURE_ZK_COMPLIANCE === 'true',

  /** ZK MPC ceremony (no real ceremony exists yet) */
  ZK_MPC_CEREMONY: process.env.NEXT_PUBLIC_FEATURE_ZK_MPC === 'true',

  /** Privacy score (no real scoring model) */
  ZK_PRIVACY_SCORE: process.env.NEXT_PUBLIC_FEATURE_ZK_PRIVACY_SCORE === 'true',
} as const;

/** Returns true if any ZK feature is enabled */
export const isZkEnabled = FLAGS.ZK_PAYMENTS;

/** Returns the ZK mode string */
export const ZK_MODE = process.env.NEXT_PUBLIC_ZK_MODE as 'disabled' | 'testnet' | 'mainnet' | undefined;
