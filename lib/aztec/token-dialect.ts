/**
 * lib/aztec/token-dialect.ts
 *
 * The private wallet talks to two token contracts whose ABIs differ:
 *
 *   - 'noir-contracts': the reference Token of @aztec-labs/noir-contracts.js
 *     (testnet tokens, the HLC test token). Private send is
 *     `transfer(to, amount)`; shield is `transfer_to_private(to, amount)`;
 *     unshield is `transfer_to_public(from, to, amount, nonce)`.
 *   - 'aztec-standards': the AIP-20 Token of aztec-standards 6.0.0, which
 *     Clean USDC (cUSDC) runs on Aztec Alpha (class
 *     0x2ff0939914ff64bd3f7979926dbe8cf3332bc2fee55928bf3cc9ca802568ea9f).
 *     Private send is `transfer_private_to_private(from, to, amount, nonce)`;
 *     shield is `transfer_public_to_private`; unshield is
 *     `transfer_private_to_public`.
 *
 * Both read balances with `balance_of_private(owner)` and
 * `balance_of_public(owner)`. A dialect is recognised only when every
 * function the wallet calls exists with exactly the ABI signature below, so a
 * contract that merely reuses a name is never called.
 *
 * Escrows and streams are not affected: they call `transfer_in_private`
 * (lib/aztec/token-check.ts), which the aztec-standards Token does not have,
 * so cUSDC stays out of agreements (lib/aztec/agreement-policy.ts).
 */

export type TokenDialect = 'noir-contracts' | 'aztec-standards';

export const DIALECT_SIGNATURES: Record<TokenDialect, { send: string; shield: string; unshield: string; balance: string }> = {
  'noir-contracts': {
    send: 'transfer((Field),u128)',
    shield: 'transfer_to_private((Field),u128)',
    unshield: 'transfer_to_public((Field),(Field),u128,Field)',
    balance: 'balance_of_private((Field))',
  },
  'aztec-standards': {
    send: 'transfer_private_to_private((Field),(Field),u128,Field)',
    shield: 'transfer_public_to_private((Field),(Field),u128,Field)',
    unshield: 'transfer_private_to_public((Field),(Field),u128,Field)',
    balance: 'balance_of_private((Field))',
  },
};

const fnName = (signature: string) => signature.slice(0, signature.indexOf('('));

/** The dialect whose every signature is in `signatures` (function name to ABI signature), or null. */
export function dialectFromSignatures(signatures: Record<string, string | undefined>): TokenDialect | null {
  for (const d of Object.keys(DIALECT_SIGNATURES) as TokenDialect[]) {
    const needed = Object.values(DIALECT_SIGNATURES[d]);
    if (needed.every((sig) => signatures[fnName(sig)] === sig)) return d;
  }
  return null;
}

type Artifact = { functions: Array<{ name: string; parameters: any[] }> };

/** The wallet dialect of a loaded artifact, from its ABI signatures; null when it is neither. */
export async function tokenDialect(artifact: Artifact): Promise<TokenDialect | null> {
  const { decodeFunctionSignature } = await import('@aztec-labs/stdlib/abi');
  const wanted = new Set(Object.values(DIALECT_SIGNATURES).flatMap((s) => Object.values(s).map(fnName)));
  const signatures: Record<string, string> = {};
  for (const f of artifact.functions) {
    if (wanted.has(f.name)) signatures[f.name] = decodeFunctionSignature(f.name, f.parameters);
  }
  return dialectFromSignatures(signatures);
}

type Contract = { methods: Record<string, (...args: any[]) => any> };

/**
 * The interactions the wallet sends, per dialect. `me` is the wallet's own address; the nonce is 0
 * because the wallet always spends its own notes (no authwit), which aztec-standards requires.
 */
export const TOKEN_CALLS: Record<
  TokenDialect,
  {
    send(c: Contract, me: unknown, to: unknown, units: bigint): any;
    shield(c: Contract, me: unknown, units: bigint): any;
    unshield(c: Contract, me: unknown, to: unknown, units: bigint): any;
  }
> = {
  'noir-contracts': {
    send: (c, _me, to, units) => c.methods.transfer(to, units),
    shield: (c, me, units) => c.methods.transfer_to_private(me, units),
    unshield: (c, me, to, units) => c.methods.transfer_to_public(me, to, units, 0),
  },
  'aztec-standards': {
    send: (c, me, to, units) => c.methods.transfer_private_to_private(me, to, units, 0),
    shield: (c, me, units) => c.methods.transfer_public_to_private(me, me, units, 0),
    unshield: (c, me, to, units) => c.methods.transfer_private_to_public(me, to, units, 0),
  },
};

/**
 * Whether a private send emits a private Transfer event the wallet can list as activity. The
 * aztec-standards Token delivers the recipient's note but emits no private event for a
 * private-to-private transfer, so incoming cUSDC shows in the balance, not in the event list.
 */
export function emitsPrivateTransferEvents(dialect: TokenDialect): boolean {
  return dialect === 'noir-contracts';
}
