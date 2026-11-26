/**
 * G8 · ZKP-SP constants (docs/protocol/G8_ZKPSP_SPEC.md §2–§4). These values
 * are part of the protocol: the Noir circuit (circuits/g8_admission) uses the
 * same numbers. Changing one breaks every existing tag and block.
 */
export const G8_VERSION = 'hl/zksp/v1';
export const G8_BLOCK_TAG = 'hl/zkblock/v1';
export const G8_INVITE_VERSION = 'hl-invite-v1';

export const DOM_SEP = {
  HUMAN_ID: 471829301,
  LEAF: 471829302,
  NODE: 471829303,
  SCOPE: 471829304,
  NULLIFIER: 471829305,
  SANCTIONS: 471829306,
} as const;

export const TREE_DEPTH = 32;
export const ROOT_GRACE_SECONDS = 3600;
export const SANCTION_SLOTS = 16;
/** Fixed floor (ISO-3166-1 numeric): KP, IR, SY, CU. */
export const SANCTION_FLOOR = [408, 364, 760, 192] as const;

/** Proof freshness and challenge lifetime. */
export const MAX_CLOCK_SKEW_SECONDS = 120;
export const NONCE_TTL_SECONDS = 300;

/** Attribute bits inside a leaf (`attrs`). */
export const ATTR = {
  ADULT: 1 << 0,
  VERIFIED_ENTITY: 1 << 1,
  HARDWARE_ANCHORED: 1 << 2,
  UNIQUE_HUMAN: 1 << 3,
} as const;

/** Admission levels a recipient can require. */
export enum G8Level {
  /** Level 0: a single-use invite signed by the recipient. */
  Invite = 0,
  /** Level 1: a device-bound hardware credential (not proof of a unique human). */
  Hardware = 1,
  /** Level 2: Zero-Passport anchors — bounded ZK vouches + in-browser zkTLS/DKIM proof of a long-lived account (no documents). */
  UniqueHuman = 2,
}

/** BN254 scalar field modulus r. */
export const FR_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
