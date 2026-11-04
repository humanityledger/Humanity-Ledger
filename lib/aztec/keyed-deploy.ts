/**
 * lib/aztec/keyed-deploy.ts
 *
 * Keyed deployment of the Humanity Ledger Aztec contracts that hold private
 * token balances (PrivateEscrow, PaymentStream). Master prompt task A.3.
 *
 * Why: claim/refund/withdraw spend token notes owned by the contract itself.
 * A PXE can only find and nullify those notes if it holds the contract's
 * secret key, so the contract must be deployed with public keys derived from
 * a secret, and the parties must register the contract with that secret (as
 * the aztec-standards Escrow does). A contract deployed without keys can
 * receive tokens but nobody can ever move them.
 *
 * Custody: the secret is shared with the parties of the escrow/stream, not
 * stored by Humanity Ledger. Anyone holding it can read the contract's notes
 * (privacy), but cannot spend them outside the contract's own rules: notes are
 * only nullified through the contract's functions.
 *
 * Verified by test/unit/aztec/keyed-deploy.test.ts (deterministic addresses,
 * keys bound to the instance). Not run against a live network yet.
 */
import { Fr } from '@aztec-labs/aztec.js/fields';
import { AztecAddress } from '@aztec-labs/aztec.js/addresses';
import { deriveKeys } from '@aztec-labs/aztec.js/keys';
import { getContractInstanceFromInstantiationParams } from '@aztec-labs/aztec.js/contracts';
import { loadContractArtifact } from '@aztec-labs/aztec.js/abi';

export type KeyedContract = 'escrow' | 'streams';

/** Compiled artifact path of each keyed contract (written by `aztec compile`). */
export const KEYED_ARTIFACT_PATHS: Readonly<Record<KeyedContract, string>> = Object.freeze({
  escrow: 'contracts/aztec/escrow/target/private_escrow-PrivateEscrow.json',
  streams: 'contracts/aztec/streams/target/payment_stream-PaymentStream.json',
});

/** Loads a compiled aztec-nr artifact (the raw `aztec compile` JSON). */
export function loadKeyedArtifact(json: unknown) {
  return loadContractArtifact(json as Parameters<typeof loadContractArtifact>[0]);
}

export interface KeyedInstanceParams {
  /** Contract secret key: shared with the parties, never with the server. */
  secretKey: Fr;
  salt: Fr;
  /** Token the contract custodies (constructor argument). */
  token: AztecAddress;
  /** Deployer address, or AztecAddress.ZERO for a universal deployment. */
  deployer?: AztecAddress;
}

/**
 * Derives the contract's public keys from `secretKey` and computes the
 * instance (and so the address) the deployment will produce. The address
 * commits to the public keys, so parties can check that the contract they are
 * paying into is the keyed one before depositing.
 */
export async function computeKeyedInstance(artifact: ReturnType<typeof loadKeyedArtifact>, p: KeyedInstanceParams) {
  const { publicKeys } = await deriveKeys(p.secretKey);
  const instance = await getContractInstanceFromInstantiationParams(artifact, {
    constructorArgs: [p.token],
    salt: p.salt,
    publicKeys,
    deployer: p.deployer ?? AztecAddress.ZERO,
  });
  return { instance, publicKeys };
}
