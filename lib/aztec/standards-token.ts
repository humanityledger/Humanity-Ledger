/**
 * lib/aztec/standards-token.ts
 *
 * The AIP-20 Token of aztec-standards 6.0.0 (npm @aztec-foundation/aztec-standards@6.0.0,
 * target/token_contract-Token.json), the contract Clean USDC (cUSDC) runs on Aztec Alpha.
 *
 * The artifact in lib/aztec/artifacts/aztec-standards-token-6.0.0.json is that file with the
 * debugging data removed (file_map emptied, each function's debug_symbols set to ""): bytecode and
 * ABI are untouched, so the contract class computed from it is the class deployed on Alpha. The
 * wallet trusts it only through checkTokenInstance, which compares that class with the instance on
 * the node; test/unit/aztec/token-dialect.test.ts pins the class id below.
 *
 * Loaded on demand (about 2 MB), only on Aztec Alpha, never on the server.
 */

/** Contract class of cUSDC on Aztec Alpha (node_getContract, 23 Nov 2026), and of this artifact. */
export const STANDARDS_TOKEN_CLASS_ID = '0x2ff0939914ff64bd3f7979926dbe8cf3332bc2fee55928bf3cc9ca802568ea9f';

/** sha256 of the published file before trimming (npm @aztec-foundation/aztec-standards@6.0.0). */
export const STANDARDS_TOKEN_SOURCE_SHA256 = 'f18cccf8dd26bd50417d09ec2dbd94f69e536ddf99bdec231d8ef10815f343e0';

let cached: Promise<any> | null = null;

/** The loaded aztec-standards Token artifact (aztec.js ContractArtifact), loaded once per page. */
export function loadStandardsTokenArtifact(): Promise<any> {
  if (!cached) {
    cached = Promise.all([import('./artifacts/aztec-standards-token-6.0.0.json'), import('@aztec-labs/aztec.js/abi')])
      .then(([json, abi]) => (abi as any).loadContractArtifact((json as any).default ?? json))
      .catch((err) => {
        cached = null;
        throw err;
      });
  }
  return cached;
}
