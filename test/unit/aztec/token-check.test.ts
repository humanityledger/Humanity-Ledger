/**
 * The raw selector our contracts call must match the token they will meet:
 * the standard Token of @aztec-labs/noir-contracts.js 6.0.0 (the testnet
 * tokens) and the test-only token used by the TXE tests. Also checks the
 * signature string is the one compiled into the escrow and stream sources.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadContractArtifact } from '@aztec-labs/aztec.js/abi';
import { exposesTransferInPrivate, functionSignature, checkTokenInstance, TRANSFER_IN_PRIVATE_SIGNATURE } from '@/lib/aztec/token-check';

const root = path.resolve(__dirname, '../../..');
const load = (p: string) => loadContractArtifact(JSON.parse(fs.readFileSync(path.join(root, p), 'utf8')));

describe('token transfer signature', () => {
  it('is the signature compiled into PrivateEscrow and PaymentStream', () => {
    for (const p of ['contracts/aztec/escrow/src/main.nr', 'contracts/aztec/streams/src/main.nr']) {
      expect(fs.readFileSync(path.join(root, p), 'utf8')).toContain(`"${TRANSFER_IN_PRIVATE_SIGNATURE}"`);
    }
  });

  it('matches the standard Token of noir-contracts.js', async () => {
    const { TokenContractArtifact } = (await import('@aztec-labs/noir-contracts.js/Token')) as any;
    expect(await functionSignature(TokenContractArtifact, 'transfer_in_private')).toBe(TRANSFER_IN_PRIVATE_SIGNATURE);
    expect(await exposesTransferInPrivate(TokenContractArtifact)).toBe(true);
  });

  it('matches the test token used by the TXE tests', async () => {
    expect(await exposesTransferInPrivate(load('contracts/aztec/test_token/target/test_token-TestToken.json') as any)).toBe(true);
  });

  it('is absent from a contract that is not a token', async () => {
    expect(await exposesTransferInPrivate(load('contracts/aztec/escrow/target/private_escrow-PrivateEscrow.json') as any)).toBe(false);
  });
});

describe('checkTokenInstance', () => {
  it('accepts an instance of a trusted token class and refuses others', async () => {
    const { TokenContractArtifact } = (await import('@aztec-labs/noir-contracts.js/Token')) as any;
    const { getContractClassFromArtifact } = await import('@aztec-labs/stdlib/contract');
    const tokenClass = (await getContractClassFromArtifact(TokenContractArtifact)).id;
    const escrow = load('contracts/aztec/escrow/target/private_escrow-PrivateEscrow.json') as any;
    const escrowClass = (await getContractClassFromArtifact(escrow)).id;
    const addr = '0x' + '01'.repeat(32);
    const nodeWith = (cls: any) => ({ getContract: async () => (cls ? { currentContractClassId: cls } : undefined) });

    expect(await checkTokenInstance(nodeWith(tokenClass), addr, [TokenContractArtifact])).toMatchObject({ ok: true });
    expect(await checkTokenInstance(nodeWith(escrowClass), addr, [TokenContractArtifact])).toEqual({ ok: false, reason: 'token class is not one this client trusts' });
    expect(await checkTokenInstance(nodeWith(escrowClass), addr, [escrow])).toMatchObject({ ok: false });
    expect(await checkTokenInstance(nodeWith(undefined), addr, [TokenContractArtifact])).toEqual({ ok: false, reason: 'no contract at the token address' });
  });
});
