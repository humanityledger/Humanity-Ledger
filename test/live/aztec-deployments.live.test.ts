/**
 * Checks deployments/aztec-testnet.json against the live Aztec testnet node.
 * Read-only, no keys. Skipped unless AZTEC_VERIFY_DEPLOYMENTS=1, so ordinary
 * test runs never touch the network; the workflow
 * .github/workflows/aztec-deployments.yml runs it daily and on changes.
 *
 * For every recorded contract it asks the node for the instance and checks:
 *   - the instance exists at the recorded address;
 *   - its current class ID is the recorded one (which the offline test
 *     test/unit/aztec/deployments-registry.test.ts ties to the artifact);
 *   - the class itself is published on the node;
 *   - it carries public keys exactly when the record says it is keyed.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const LIVE = process.env.AZTEC_VERIFY_DEPLOYMENTS === '1';
const root = path.resolve(__dirname, '../..');
const registry = JSON.parse(fs.readFileSync(path.join(root, 'deployments/aztec-testnet.json'), 'utf8'));
const NODE_URL = process.env.AZTEC_NODE_URL || registry.network.nodeUrl;

describe.skipIf(!LIVE)(`Aztec testnet deployments (${NODE_URL})`, () => {
  const report: string[] = [];

  it('the node is the network the record names', async () => {
    const { createAztecNodeClient } = await import('@aztec-labs/aztec.js/node');
    const node = createAztecNodeClient(NODE_URL, { maxBatchSize: 3 });
    const info = await node.getNodeInfo();
    report.push(`node ${info.nodeVersion}, L1 chain ${info.l1ChainId}, rollup ${info.rollupVersion}`);
    expect(info.l1ChainId).toBe(registry.network.l1ChainId);
    expect(Number(info.rollupVersion)).toBe(registry.network.rollupVersion);
  }, 60_000);

  for (const e of registry.contracts as Array<{ name: string; address: string; classId: string; keyed: boolean }>) {
    it(`${e.name} at ${e.address.slice(0, 10)}…`, async () => {
      const { createAztecNodeClient } = await import('@aztec-labs/aztec.js/node');
      const { AztecAddress } = await import('@aztec-labs/aztec.js/addresses');
      const { Fr } = await import('@aztec-labs/aztec.js/fields');
      const node = createAztecNodeClient(NODE_URL, { maxBatchSize: 3 });

      const instance = await node.getContract(AztecAddress.fromStringUnsafe(e.address));
      expect(instance, `${e.name}: no instance at ${e.address}`).toBeTruthy();
      const classId = instance!.currentContractClassId.toString();
      const keyed = !instance!.publicKeys.isEmpty();
      const cls = await node.getContractClass(Fr.fromString(e.classId));
      report.push(`${e.name}: instance found; class ${classId === e.classId ? 'matches' : `DIFFERS (${classId})`}; class published: ${cls ? 'yes' : 'no'}; public keys: ${keyed ? 'yes' : 'no'}`);
      console.log(report.at(-1));

      expect(classId).toBe(e.classId);
      expect(cls, `${e.name}: class ${e.classId} not published`).toBeTruthy();
      expect(keyed, `${e.name}: record says keyed=${e.keyed}, node says ${keyed}`).toBe(e.keyed);
    }, 120_000);
  }

  it('writes a summary', () => {
    const out = process.env.GITHUB_STEP_SUMMARY;
    if (out) fs.appendFileSync(out, `### Aztec testnet deployments\n\n${report.map((l) => `- ${l}`).join('\n')}\n`);
    expect(report.length).toBeGreaterThan(0);
  });
});
