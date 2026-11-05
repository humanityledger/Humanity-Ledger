/**
 * lib/aztec/token-check.ts
 *
 * PrivateEscrow and PaymentStream move tokens by calling
 *   transfer_in_private((Field),(Field),u128,Field)
 * through a raw function selector (contracts/aztec/*\/src/main.nr). A token
 * whose contract has no function with exactly that signature would make
 * every deposit fail, or worse, call something else with the same selector.
 * Before a token is accepted for agreements, the client checks that:
 *
 *   - the token's instance on the node runs a class it trusts, computed from
 *     an artifact it holds (for example the standard Token of
 *     @aztec-labs/noir-contracts.js);
 *   - that artifact has a private function `transfer_in_private` whose ABI
 *     signature is exactly the one the contracts call.
 */
export const TRANSFER_IN_PRIVATE_SIGNATURE = 'transfer_in_private((Field),(Field),u128,Field)';

type Artifact = { name: string; functions: Array<{ name: string; parameters: any[]; functionType?: string }> };

/** ABI signature of `fnName` in a loaded artifact, as Aztec computes selectors from it. */
export async function functionSignature(artifact: Artifact, fnName: string): Promise<string | undefined> {
  const fn = artifact.functions.find((f) => f.name === fnName);
  if (!fn) return undefined;
  const { decodeFunctionSignature } = await import('@aztec-labs/stdlib/abi');
  return decodeFunctionSignature(fn.name, fn.parameters);
}

/** True when the artifact exposes the private transfer our contracts call, with the same signature. */
export async function exposesTransferInPrivate(artifact: Artifact): Promise<boolean> {
  const fn = artifact.functions.find((f) => f.name === 'transfer_in_private');
  if (!fn || (fn.functionType !== undefined && String(fn.functionType).toLowerCase() !== 'private')) return false;
  return (await functionSignature(artifact, 'transfer_in_private')) === TRANSFER_IN_PRIVATE_SIGNATURE;
}

export type TokenCheck = { ok: true; artifact: string; classId: string } | { ok: false; reason: string };

/**
 * Checks a token instance on the node against the artifacts the client
 * trusts. `node` needs only getContract (aztec.js AztecNode).
 */
export async function checkTokenInstance(
  node: { getContract(addr: any): Promise<{ currentContractClassId: { toString(): string } } | undefined> },
  tokenAddress: string,
  trusted: Artifact[],
): Promise<TokenCheck> {
  const { AztecAddress } = await import('@aztec-labs/aztec.js/addresses');
  const { getContractClassFromArtifact } = await import('@aztec-labs/stdlib/contract');
  const instance = await node.getContract(AztecAddress.fromStringUnsafe(tokenAddress));
  if (!instance) return { ok: false, reason: 'no contract at the token address' };
  const classId = instance.currentContractClassId.toString();
  for (const a of trusted) {
    const cls = await getContractClassFromArtifact(a as any);
    if (cls.id.toString() !== classId) continue;
    if (!(await exposesTransferInPrivate(a))) return { ok: false, reason: `${a.name} has no ${TRANSFER_IN_PRIVATE_SIGNATURE}` };
    return { ok: true, artifact: a.name, classId };
  }
  return { ok: false, reason: 'token class is not one this client trusts' };
}
