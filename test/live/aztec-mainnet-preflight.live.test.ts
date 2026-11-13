/**
 * Read-only preflight against Aztec Alpha (mainnet). No keys, no
 * transactions, nothing that costs or moves value. Skipped unless
 * AZTEC_MAINNET_PREFLIGHT=1; the workflow .github/workflows/aztec-mainnet-preflight.yml
 * runs it weekly and on changes.
 *
 * It answers the questions a mainnet deployment depends on:
 *   - is the node the Alpha network this build is pinned to (L1 chain 1,
 *     rollup version, node version 6.0.0, rollup address)?
 *   - is there no sponsored fee payer at the testnet's canonical address, so
 *     the client must pay in Fee Juice (lib/aztec/fees.ts)?
 *   - are the classes of our committed artifacts already published there
 *     (reported, not required: today they are not)?
 *   - does every instance in deployments/aztec-mainnet.json exist, with the
 *     recorded class and keys?
 *   - is every token in deployments/aztec-mainnet.json deployed by its recorded
 *     transaction (in which block), and does it pass checkTokenInstance?
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { AZTEC_NETWORKS } from '@/lib/aztec/sequencer/networks';
import { identifyNode, SPONSORED_FPC } from '@/lib/aztec/fees';

const LIVE = process.env.AZTEC_MAINNET_PREFLIGHT === '1';
const root = path.resolve(__dirname, '../..');
const record = JSON.parse(fs.readFileSync(path.join(root, 'deployments/aztec-mainnet.json'), 'utf8'));
const NODE_URL = process.env.AZTEC_MAINNET_NODE_URL || AZTEC_NETWORKS.mainnet.publicNodeRpc;
const ARTIFACTS = {
  PrivateEscrow: 'contracts/aztec/escrow/target/private_escrow-PrivateEscrow.json',
  PaymentStream: 'contracts/aztec/streams/target/payment_stream-PaymentStream.json',
  IdentityCredential: 'contracts/aztec/identity/target/identity_credential-IdentityCredential.json',
};

async function node() {
  const { createAztecNodeClient } = await import('@aztec-labs/aztec.js/node');
  return createAztecNodeClient(NODE_URL, { maxBatchSize: 3 });
}

describe.skipIf(!LIVE)(`Aztec Alpha mainnet preflight (${NODE_URL})`, () => {
  const report: string[] = [];

  it('the node is the pinned Alpha network', async () => {
    const info: any = await (await node()).getNodeInfo();
    const id = identifyNode(info);
    report.push(`node ${info.nodeVersion}, L1 chain ${info.l1ChainId}, rollup version ${info.rollupVersion}; drift: ${id.drift.length ? JSON.stringify(id.drift) : 'none'}`);
    expect(id.network).toBe('mainnet');
    expect(id.drift).toEqual([]);
  }, 60_000);

  it('has no sponsored fee payer at the testnet address', async () => {
    const { AztecAddress } = await import('@aztec-labs/aztec.js/addresses');
    const fpc = await (await node()).getContract(AztecAddress.fromStringUnsafe(SPONSORED_FPC.testnet!));
    report.push(`sponsored fee payer ${SPONSORED_FPC.testnet!.slice(0, 10)}…: ${fpc ? 'PRESENT' : 'absent'} (fees in Fee Juice)`);
    expect(fpc).toBeFalsy();
  }, 60_000);

  for (const [name, p] of Object.entries(ARTIFACTS)) {
    it(`${name}: reports whether the committed class is published`, async () => {
      const { loadContractArtifact } = await import('@aztec-labs/aztec.js/abi');
      const { getContractClassFromArtifact } = await import('@aztec-labs/stdlib/contract');
      const artifact = loadContractArtifact(JSON.parse(fs.readFileSync(path.join(root, p), 'utf8')));
      const cls = await getContractClassFromArtifact(artifact);
      const published = await (await node()).getContractClass(cls.id);
      report.push(`${name}: class ${cls.id.toString()} ${published ? 'published' : 'not published'} on Alpha`);
      expect(cls.id.toString()).toMatch(/^0x[0-9a-f]{64}$/);
    }, 120_000);
  }

  for (const e of record.contracts as Array<{ name: string; address: string; classId: string; keyed: boolean }>) {
    it(`${e.name} at ${e.address.slice(0, 10)}…`, async () => {
      const { AztecAddress } = await import('@aztec-labs/aztec.js/addresses');
      const { PublicKeys } = await import('@aztec-labs/stdlib/keys');
      const instance = await (await node()).getContract(AztecAddress.fromStringUnsafe(e.address));
      expect(instance, `${e.name}: no instance`).toBeTruthy();
      expect(instance!.currentContractClassId.toString()).toBe(e.classId);
      expect(!instance!.publicKeys.equals(PublicKeys.default())).toBe(e.keyed);
      report.push(`${e.name}: instance found, class matches, keys ${e.keyed ? 'present' : 'absent'}`);
    }, 120_000);
  }

  // Private tokens in the record (the wallet lists only these on Alpha). For each:
  // the deploy transaction is mined and in which block, the instance exists, and
  // it passes the same checkTokenInstance the wallet runs when it opens. The block
  // and class ID are printed so a pending entry (deployBlock 0) can be completed.
  for (const t of (record.tokens ?? []) as Array<{ symbol: string; address: string; classId: string | null; deployTx: string; deployBlock: number }>) {
    it(`token ${t.symbol} at ${t.address.slice(0, 10)}…: deploy transaction, instance and checkTokenInstance`, async () => {
      const n: any = await node();
      const { AztecAddress } = await import('@aztec-labs/aztec.js/addresses');
      const { TxHash } = await import('@aztec-labs/stdlib/tx');
      const { checkTokenInstance } = await import('@/lib/aztec/token-check');
      const { TokenContractArtifact } = (await import('@aztec-labs/noir-contracts.js/Token')) as any;

      // 1. The deploy transaction and its block.
      const hash = TxHash.fromString(t.deployTx);
      const receipt: any = await n.getTxReceipt(hash);
      const effect: any = await n.getTxEffect(hash).catch(() => undefined);
      const block = Number(receipt?.blockNumber ?? effect?.l2BlockNumber ?? 0);
      report.push(`${t.symbol}: deployTx ${t.deployTx} status ${receipt?.status ?? 'unknown'}, block ${block || 'not found'} (recorded ${t.deployBlock || 'pending'})`);
      expect(block, `${t.symbol}: deploy transaction not found or not mined`).toBeGreaterThan(0);
      if (t.deployBlock > 0) expect(block, `${t.symbol}: recorded deployBlock`).toBe(t.deployBlock);

      // 2. The instance, its class and its deployer.
      const instance: any = await n.getContract(AztecAddress.fromStringUnsafe(t.address));
      expect(instance, `${t.symbol}: no instance at ${t.address}`).toBeTruthy();
      const classId = instance.currentContractClassId.toString();
      report.push(`${t.symbol}: instance class ${classId}, deployer ${instance.deployer?.toString?.() ?? 'unknown'}`);

      // 3. The wallet's own check, against the artifact the wallet trusts.
      const check = await checkTokenInstance(n, t.address, [TokenContractArtifact]);
      report.push(`${t.symbol}: checkTokenInstance ${check.ok ? `ok (${check.artifact})` : `REFUSED: ${check.reason}`}`);
      expect(check, `${t.symbol}: checkTokenInstance`).toMatchObject({ ok: true });
      if (t.classId) expect(classId, `${t.symbol}: recorded classId`).toBe(t.classId);
    }, 180_000);
  }

  it('writes a summary', () => {
    console.log(report.join('\n'));
    const out = process.env.GITHUB_STEP_SUMMARY;
    if (out) fs.appendFileSync(out, `### Aztec Alpha mainnet preflight (read-only)\n\n${report.map((l) => `- ${l}`).join('\n')}\n`);
    expect(report.length).toBeGreaterThan(0);
  });
});
