/**
 * lib/aztec/zkpassport.ts
 *
 * The shape Ledger Chat expects from an external identity proof (ZKPassport, Obsidion or any
 * Noir-based credential) before it could ever mark a member as verified. Interface only: no
 * verifier contract is configured, nothing here calls the network, and nothing sets
 * User.isZkVerified. The only verified flag shown in communities is the one Ledger Chat's own
 * server sets (lib/communities/identity.ts).
 *
 * A future verifier must: check the proof against a pinned verification key, bind it to the
 * member's wallet (G7 peer binding, lib/aztec/peer-binding.ts) so a proof cannot be replayed for
 * someone else, and store only the outcome and a nullifier, never document data.
 */

export type CredentialKind = 'zkpassport' | 'obsidion' | 'other';

export interface CredentialProof {
  kind: CredentialKind;
  /** The proof bytes as produced by the issuer's prover. */
  proof: Uint8Array;
  /** Public inputs, as hex field elements. */
  publicInputs: string[];
  /** Wallet the proof claims to belong to (lower-case 0x…). */
  wallet: string;
  /** Community the proof is presented to, so it is scoped and cannot be reused elsewhere. */
  communityId: string;
}

export type VerificationResult =
  | { status: 'verified'; nullifier: string }
  | { status: 'rejected'; reason: string }
  | { status: 'unavailable'; reason: string };

export interface CredentialVerifier {
  readonly kind: CredentialKind;
  verify(p: CredentialProof): Promise<VerificationResult>;
}

/** The verifier address, when an operator configures one. Unset today. */
export const ZKPASSPORT_VERIFIER_ADDRESS: string | null = process.env.NEXT_PUBLIC_ZKPASSPORT_ADDRESS?.trim() || null;

/**
 * Verifies a ZKPassport proof for a community. Without a configured, reviewed verifier the answer
 * is always "unavailable": a proof is never accepted on trust.
 */
export async function verifyZKPassport(proof: Uint8Array, communityId: string, wallet = ''): Promise<VerificationResult> {
  if (!proof?.length || !communityId) return { status: 'rejected', reason: 'A proof and a community are required.' };
  if (!ZKPASSPORT_VERIFIER_ADDRESS) return { status: 'unavailable', reason: 'No ZKPassport verifier is configured on this server.' };
  void wallet;
  return { status: 'unavailable', reason: 'ZKPassport verification is not wired to a reviewed verifier yet.' };
}
