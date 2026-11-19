/**
 * scripts/aztec/rehearse-hlc-redeploy-testnet.mts
 *
 * Rehearses docs/alpha/HLC_REDEPLOY_RUNBOOK.md end to end on the Aztec TEST network, with a
 * throwaway account paid by the sponsored FPC, so it needs no secret and moves nothing of value:
 *   1. deploy a fresh account (the stand-in for Stefan's admin account);
 *   2. deploy the standard Token with HLC_TOKEN_META, universal deployment, as the operator card
 *      does on Alpha (lib/aztec/wallet/client.ts deployHlcTestToken);
 *   3. read it back from the node only: block, class, deployer, and name, symbol and decimals from
 *      public storage with the slots of the Token artifact (lib/aztec/token-meta.ts), the same read
 *      the mainnet preflight makes;
 *   4. fail unless every value is what the runbook expects.
 * Writes hlc-rehearsal-receipt.json and the step summary; the agent records the hash and block in
 * deployments/aztec-testnet.json in a PR.
 *
 *   node --conditions=browser --import tsx --import ./scripts/aztec/register.mjs scripts/aztec/rehearse-hlc-redeploy-testnet.mts
 */
import fs from 'node:fs';
import { createAztecNodeClient, waitForTx } from '@aztec-labs/aztec.js/node';
import { Fr, Fq } from '@aztec-labs/aztec.js/fields';
import { AztecAddress } from '@aztec-labs/aztec.js/addresses';
import { Contract, DeployMethod, getContractInstanceFromInstantiationParams, NO_WAIT } from '@aztec-labs/aztec.js/contracts';
import { SponsoredFeePaymentMethod } from '@aztec-labs/aztec.js/fee';
import { NO_FROM } from '@aztec-labs/aztec.js/account';
import { SponsoredFPCContract } from '@aztec-labs/noir-contracts.js/SponsoredFPC';
import { TokenContract } from '@aztec-labs/noir-contracts.js/Token';
import { openTmpStore } from '@aztec-labs/kv-store/deprecated/indexeddb';
import { EmbeddedWallet } from '@aztec-labs/wallets/embedded';
import { readTokenMeta } from '../../lib/aztec/token-meta.ts';
import { HLC_TOKEN_META } from '../../lib/payments/assets.ts';

const registry = JSON.parse(fs.readFileSync('deployments/aztec-testnet.json', 'utf8'));
const NODE_URL = process.env.AZTEC_NODE_URL || registry.network.nodeUrl;
const RPC = { maxBatchSize: 3 };
const t0 = Date.now();
const log = (...a: unknown[]) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const receipt: Record<string, unknown> = { network: NODE_URL, startedAt: new Date().toISOString(), meta: HLC_TOKEN_META, checks: [] as unknown[] };
const checks = receipt.checks as Array<{ check: string; ok: boolean; detail?: string }>;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
  checks.push({ check: label, ok, detail: detail || undefined });
};

const node = createAztecNodeClient(NODE_URL, RPC);
const info: any = await node.getNodeInfo();
if (Number(info.l1ChainId) === 1) throw new Error('Refusing to run: this node settles on Ethereum mainnet. Test network only.');
log('Aztec node', info.nodeVersion, 'on L1 chain', info.l1ChainId);

const fpc = await getContractInstanceFromInstantiationParams(SponsoredFPCContract.artifact, { salt: new Fr(0) });
const fee = { paymentMethod: new SponsoredFeePaymentMethod(fpc.address) };
const wallet: any = await EmbeddedWallet.create(NODE_URL, {
  ephemeral: true,
  nodeClientOptions: RPC,
  pxe: { store: await openTmpStore(true) },
  walletDb: { store: await openTmpStore(true) },
});
await wallet.registerContract(fpc, SponsoredFPCContract.artifact);

// 1. The stand-in admin account.
const acct = await wallet.createSchnorrAccount(Fr.random(), Fr.random(), Fq.random(), 'admin');
const sentAcct = await (await acct.getDeployMethod()).send({ from: NO_FROM, fee, wait: NO_WAIT });
const rAcct: any = await waitForTx(node, sentAcct.txHash, { timeout: 900, interval: 2 });
const admin = acct.address as AztecAddress;
receipt.account = { address: admin.toString(), txHash: sentAcct.txHash.toString(), block: Number(rAcct.blockNumber) };
log('admin account', admin.toString(), 'block', Number(rAcct.blockNumber));

// 2. The token, as the operator card deploys it: universal deployment with HLC_TOKEN_META.
const artifact = TokenContract.artifact;
const args = [admin, HLC_TOKEN_META.name, HLC_TOKEN_META.symbol, HLC_TOKEN_META.decimals];
const salt = Fr.random();
const expected = await getContractInstanceFromInstantiationParams(artifact, { constructorArgs: args, salt, deployer: AztecAddress.ZERO });
const deployment = (DeployMethod as any).create(
  wallet,
  { artifact, args, postDeployCtor: (instance: any, w: any) => (Contract as any).at(instance.address, artifact, w) },
  { salt, universalDeploy: true },
);
const sent = await deployment.send({ from: admin, fee, wait: NO_WAIT });
const r: any = await waitForTx(node, sent.txHash, { timeout: 900, interval: 2 });
const block = Number(r.blockNumber);
receipt.token = { address: expected.address.toString(), txHash: sent.txHash.toString(), block };
log('HLC Test Token deployed at', expected.address.toString(), 'tx', sent.txHash.toString(), 'block', block);

// 3. Read back from the node only.
const instance: any = await node.getContract(expected.address);
check('the instance exists at the expected address', !!instance);
const { getContractClassFromArtifact } = await import('@aztec-labs/stdlib/contract');
const trusted = (await getContractClassFromArtifact(artifact as any)).id.toString();
const classId = instance?.currentContractClassId?.toString?.() ?? '';
check('the class is the standard Token class', classId === trusted, classId);
const deployer = instance?.deployer?.toString?.() ?? '';
check('universal deployment (deployer zero)', /^0x0+$/.test(deployer), deployer);
const meta = await readTokenMeta(artifact, async (slot) => BigInt((await node.getPublicStorageAt('latest', expected.address, new Fr(slot))).toString()));
receipt.read = { ...meta, classId, deployer };
check(`on-chain name is "${HLC_TOKEN_META.name}"`, meta.name === HLC_TOKEN_META.name, meta.name);
check(`on-chain symbol is "${HLC_TOKEN_META.symbol}"`, meta.symbol === HLC_TOKEN_META.symbol, meta.symbol);
check(`decimals are ${HLC_TOKEN_META.decimals}`, meta.decimals === HLC_TOKEN_META.decimals, String(meta.decimals));
check('the deploy transaction is mined', block > 0, String(block));

// 4. Report.
receipt.finishedAt = new Date().toISOString();
fs.writeFileSync('hlc-rehearsal-receipt.json', JSON.stringify(receipt, null, 2) + '\n');
const failed = checks.filter((c) => !c.ok);
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
    '## HLC Test Token redeploy rehearsal (Aztec test network)',
    '',
    `Token ${expected.address.toString()} · deploy tx ${sent.txHash.toString()} · block ${block}`,
    '',
    ...checks.map((c) => `- ${c.ok ? 'PASS' : 'FAIL'} ${c.check}${c.detail ? ` (${c.detail})` : ''}`),
    '',
  ].join('\n'));
}
await wallet.stop?.();
if (failed.length) {
  console.error(`FAIL: ${failed.length} check(s)`);
  process.exit(1);
}
console.log('PASS: the runbook works on the test network');
process.exit(0);
