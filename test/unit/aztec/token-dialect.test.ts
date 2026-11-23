/**
 * The private wallet speaks two token ABIs (lib/aztec/token-dialect.ts). These tests pin:
 *   - the trimmed aztec-standards Token artifact computes the class cUSDC runs on Aztec Alpha;
 *   - each artifact is recognised as its own dialect, and a contract that is not a token as none;
 *   - the wallet's send, shield and unshield build the right call for each dialect;
 *   - checkTokenInstance accepts cUSDC for the wallet, but still refuses it for agreements
 *     (no transfer_in_private), so escrows and streams stay closed to it;
 *   - the wallet binds each token to the artifact the check matched.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadContractArtifact } from '@aztec-labs/aztec.js/abi';
import { DIALECT_SIGNATURES, TOKEN_CALLS, dialectFromSignatures, emitsPrivateTransferEvents, tokenDialect } from '@/lib/aztec/token-dialect';
import { STANDARDS_TOKEN_CLASS_ID, loadStandardsTokenArtifact } from '@/lib/aztec/standards-token';
import { checkTokenInstance } from '@/lib/aztec/token-check';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
const load = (p: string) => loadContractArtifact(JSON.parse(read(p)));
const ADDR = '0x' + '01'.repeat(32);
const nodeWith = (cls: any) => ({ getContract: async () => (cls ? { currentContractClassId: cls } : undefined) });

describe('aztec-standards Token artifact (cUSDC)', () => {
  it('computes the contract class cUSDC runs on Aztec Alpha', async () => {
    const { getContractClassFromArtifact } = await import('@aztec-labs/stdlib/contract');
    const artifact = await loadStandardsTokenArtifact();
    expect((await getContractClassFromArtifact(artifact)).id.toString()).toBe(STANDARDS_TOKEN_CLASS_ID);
  });

  it('carries no debugging data (trimmed, bytecode untouched)', () => {
    const raw = JSON.parse(read('lib/aztec/artifacts/aztec-standards-token-6.0.0.json'));
    expect(raw.name).toBe('Token');
    expect(raw.file_map).toEqual({});
    expect(raw.functions.every((f: any) => f.debug_symbols === '' && typeof f.bytecode === 'string' && f.bytecode.length > 0)).toBe(true);
  });
});

describe('token dialects', () => {
  it('recognises each artifact as its own dialect, and a non-token as none', async () => {
    const { TokenContractArtifact } = (await import('@aztec-labs/noir-contracts.js/Token')) as any;
    expect(await tokenDialect(TokenContractArtifact)).toBe('noir-contracts');
    expect(await tokenDialect(await loadStandardsTokenArtifact())).toBe('aztec-standards');
    expect(await tokenDialect(load('contracts/aztec/escrow/target/private_escrow-PrivateEscrow.json') as any)).toBeNull();
  });

  it('needs every signature exactly, not just the names', () => {
    const full = Object.fromEntries(Object.values(DIALECT_SIGNATURES['aztec-standards']).map((s) => [s.slice(0, s.indexOf('(')), s]));
    expect(dialectFromSignatures(full)).toBe('aztec-standards');
    expect(dialectFromSignatures({ ...full, transfer_private_to_private: 'transfer_private_to_private((Field),u128)' })).toBeNull();
    const { shield: _drop, ...rest } = DIALECT_SIGNATURES['aztec-standards'];
    expect(dialectFromSignatures(Object.fromEntries(Object.values(rest).map((s) => [s.slice(0, s.indexOf('(')), s])))).toBeNull();
  });

  it('builds the right call for each dialect, with nonce 0 and the wallet as sender', () => {
    const calls: any[] = [];
    const c = { methods: new Proxy({}, { get: (_t, name) => (...args: any[]) => { calls.push([name, ...args]); return name; } }) } as any;
    const me = 'ME';
    const to = 'TO';
    TOKEN_CALLS['aztec-standards'].send(c, me, to, 5n);
    TOKEN_CALLS['aztec-standards'].shield(c, me, 6n);
    TOKEN_CALLS['aztec-standards'].unshield(c, me, to, 7n);
    TOKEN_CALLS['noir-contracts'].send(c, me, to, 8n);
    TOKEN_CALLS['noir-contracts'].shield(c, me, 9n);
    TOKEN_CALLS['noir-contracts'].unshield(c, me, to, 10n);
    expect(calls).toEqual([
      ['transfer_private_to_private', me, to, 5n, 0],
      ['transfer_public_to_private', me, me, 6n, 0],
      ['transfer_private_to_public', me, to, 7n, 0],
      ['transfer', to, 8n],
      ['transfer_to_private', me, 9n],
      ['transfer_to_public', me, to, 10n, 0],
    ]);
  });

  it('lists private Transfer events only for the reference Token', () => {
    expect(emitsPrivateTransferEvents('noir-contracts')).toBe(true);
    expect(emitsPrivateTransferEvents('aztec-standards')).toBe(false);
  });
});

describe('checkTokenInstance with the cUSDC class', () => {
  it('accepts cUSDC for the wallet and says which artifact matched', async () => {
    const { TokenContractArtifact } = (await import('@aztec-labs/noir-contracts.js/Token')) as any;
    const standards = await loadStandardsTokenArtifact();
    const node = nodeWith(STANDARDS_TOKEN_CLASS_ID);
    expect(await checkTokenInstance(node, ADDR, [TokenContractArtifact, standards], { purpose: 'wallet' })).toMatchObject({
      ok: true,
      index: 1,
      dialect: 'aztec-standards',
      classId: STANDARDS_TOKEN_CLASS_ID,
    });
  });

  it('still refuses cUSDC for agreements: it has no transfer_in_private', async () => {
    const standards = await loadStandardsTokenArtifact();
    const r = await checkTokenInstance(nodeWith(STANDARDS_TOKEN_CLASS_ID), ADDR, [standards]);
    expect(r.ok).toBe(false);
    expect((r as any).reason).toMatch(/transfer_in_private/);
  });

  it('refuses a class the client does not hold, for the wallet too', async () => {
    const standards = await loadStandardsTokenArtifact();
    expect(await checkTokenInstance(nodeWith('0x' + '02'.repeat(32)), ADDR, [standards], { purpose: 'wallet' })).toEqual({
      ok: false,
      reason: 'token class is not one this client trusts',
    });
  });
});

describe('private wallet wiring', () => {
  const client = read('lib/aztec/wallet/client.ts');

  it('trusts the aztec-standards Token next to the reference Token, for the wallet purpose', () => {
    expect(client).toMatch(/loadStandardsTokenArtifact\(\)/);
    expect(client).toMatch(/checkTokenInstance\(this\.node, t\.address, trusted, \{ purpose: 'wallet' \}\)/);
    expect(client).toMatch(/artifact = trusted\[c\.index\]/);
    expect(client).toMatch(/registerContract\(instance, artifact\)/);
  });

  it('sends, shields and unshields through the token dialect', () => {
    expect(client).toMatch(/TOKEN_CALLS\[this\.dialectOf\(key\)\]\.send\(c, this\.me, target, units\)/);
    expect(client).toMatch(/TOKEN_CALLS\[this\.dialectOf\(key\)\]\.shield\(c, this\.me, units\)/);
    expect(client).toMatch(/TOKEN_CALLS\[this\.dialectOf\(key\)\]\.unshield\(c, this\.me, target, units\)/);
    expect(client).not.toMatch(/c\.methods\.transfer\(target, units\)/);
  });
});
