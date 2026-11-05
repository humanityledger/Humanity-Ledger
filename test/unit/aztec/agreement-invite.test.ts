/**
 * verifyAgreementInvite must accept only an invitation whose address and class
 * follow from the shared secret, from the conversation peer, to the receiver,
 * for an accepted token and a current class. Uses the committed artifacts and
 * the real key derivation; no network.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Fr } from '@aztec-labs/aztec.js/fields';
import { AztecAddress } from '@aztec-labs/aztec.js/addresses';
import { KEYED_ARTIFACT_PATHS, computeKeyedInstance, loadKeyedArtifact } from '@/lib/aztec/keyed-deploy';
import { verifyAgreementInvite, currentClassIds, MAX_INVITE_BYTES, type VerifyOptions } from '@/lib/aztec/agreement-invite';

const root = path.resolve(__dirname, '../../..');
const load = (p: string) => loadKeyedArtifact(JSON.parse(fs.readFileSync(path.join(root, p), 'utf8')));
const artifacts = { escrow: load(KEYED_ARTIFACT_PATHS.escrow), streams: load(KEYED_ARTIFACT_PATHS.streams) };

const hex = (n: number) => '0x' + n.toString(16).padStart(64, '0');
const token = hex(0x70c);
const sender = hex(0xa11ce);
const recipient = hex(0xb0b);

let opts: VerifyOptions;
let valid: Record<string, unknown>;

beforeAll(async () => {
  const secret = new Fr(0x5ec2e7n);
  const salt = new Fr(0x5a17n);
  const { instance } = await computeKeyedInstance(artifacts.escrow, { secretKey: secret, salt, token: AztecAddress.fromString(token) });
  const s = await computeKeyedInstance(artifacts.streams, { secretKey: secret, salt, token: AztecAddress.fromString(token) });
  opts = {
    artifacts,
    allowedClassIds: { escrow: [instance.currentContractClassId.toString()], streams: [s.instance.currentContractClassId.toString()] },
    allowedTokens: [token],
    me: recipient,
    peer: sender,
  };
  valid = {
    type: 'hl.escrow_invite',
    version: 1,
    instanceAddress: instance.address.toString(),
    classId: instance.currentContractClassId.toString(),
    salt: salt.toString(),
    contractSecret: secret.toString(),
    token,
    tokenSymbol: 'zkUSDC',
    sender,
    recipient,
    escrowId: hex(7),
    claimSecret: hex(9),
    amount: '25000000',
    deadline: 1_900_000_000,
  };
});

const verify = (inv: Record<string, unknown>, o: Partial<VerifyOptions> = {}) =>
  verifyAgreementInvite(JSON.stringify(inv), { ...opts, ...o });

describe('verifyAgreementInvite', () => {
  it('accepts an invitation whose address follows from the shared secret', async () => {
    expect(await verify(valid)).toMatchObject({ ok: true });
  });

  it('rejects an address that does not follow from the secret (look-alike contract)', async () => {
    expect(await verify({ ...valid, instanceAddress: hex(0xdead) })).toEqual({ ok: false, reason: 'address does not match the shared secret' });
  });

  it('rejects a secret other than the one the address was derived from (unclaimable funds)', async () => {
    expect(await verify({ ...valid, contractSecret: hex(0x1234) })).toEqual({ ok: false, reason: 'address does not match the shared secret' });
  });

  it('rejects a class the record does not mark as current', async () => {
    expect(await verify({ ...valid, classId: hex(0xc1a55) })).toEqual({ ok: false, reason: 'contract class not recognised' });
  });

  it('rejects a recognised class that the artifact does not produce', async () => {
    const r = await verify(valid, { allowedClassIds: { escrow: [valid.classId as string, hex(1)], streams: [] } });
    expect(r.ok).toBe(true);
    const wrong = await verify({ ...valid, classId: hex(1) }, { allowedClassIds: { escrow: [hex(1)], streams: [] } });
    expect(wrong).toEqual({ ok: false, reason: 'artifact does not produce the claimed class' });
  });

  it('rejects a token the receiver does not accept', async () => {
    expect(await verify(valid, { allowedTokens: [hex(0x999)] })).toEqual({ ok: false, reason: 'token not accepted' });
  });

  it('rejects an invitation addressed to someone else or sent by someone else', async () => {
    expect(await verify(valid, { me: hex(0xcafe) })).toEqual({ ok: false, reason: 'invitation is not addressed to you' });
    expect(await verify(valid, { peer: hex(0xcafe) })).toEqual({ ok: false, reason: 'invitation does not come from this conversation' });
  });

  it('rejects malformed fields, unknown fields, oversized and non-JSON input', async () => {
    expect((await verify({ ...valid, amount: '-1' })).ok).toBe(false);
    expect((await verify({ ...valid, amount: (1n << 128n).toString() })).ok).toBe(false);
    expect((await verify({ ...valid, deadline: 1.5 })).ok).toBe(false);
    expect((await verify({ ...valid, claimSecret: '0x12' })).ok).toBe(false);
    expect((await verify({ ...valid, extra: 'x' })).ok).toBe(false);
    expect((await verify({ ...valid, version: 2 })).ok).toBe(false);
    expect(await verifyAgreementInvite('not json', opts)).toEqual({ ok: false, reason: 'invitation is not JSON' });
    expect(await verifyAgreementInvite('x'.repeat(MAX_INVITE_BYTES + 1), opts)).toEqual({ ok: false, reason: 'invitation too large' });
  });

  it('reads the current class IDs from the deployment record', () => {
    const record = JSON.parse(fs.readFileSync(path.join(root, 'deployments/aztec-testnet.json'), 'utf8'));
    const ids = currentClassIds(record);
    expect(ids.escrow.length + ids.streams.length).toBeGreaterThan(0);
    for (const id of [...ids.escrow, ...ids.streams]) expect(id).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
