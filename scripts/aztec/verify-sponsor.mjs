#!/usr/bin/env node
/**
 * scripts/aztec/verify-sponsor.mjs — checks a deployed LedgerSponsor on Aztec Alpha (R4, docs/SPONSOR.md).
 *
 *   node --conditions=browser --import ./scripts/aztec/register.mjs scripts/aztec/verify-sponsor.mjs \
 *     [--app https://ledgerchat.org] [--node <Aztec node URL>]
 *
 * or, from the phone: GitHub, Actions, "Aztec verify sponsor", Run workflow.
 *
 * Read-only and secret-free: it reads the app's public GET /api/aztec/sponsor, the Aztec node, the
 * committed artifact and deployments/aztec-mainnet.json, and signs nothing. Exit 1 on any FAIL.
 *
 *   server   the app has sponsorship on, a 32-byte sponsor address and a signer public key
 *   network  the node is Alpha (L1 chain 1, rollup version 2070860440): vouchers name these
 *   deployed the node has a contract instance at the configured address
 *   code     its class is the LedgerSponsor compiled in this repository
 *   key+cap  the address follows from (this class, the server's public key, the 40 AZTEC cap, the
 *            instance's salt, no deployer): the server's vouchers will verify, and the cap is 40 AZTEC
 *   funded   the sponsor holds Fee Juice (WARN below one transaction at the cap, FAIL at zero)
 *   limits   per-wallet and daily limits above zero (WARN otherwise: sponsorship is in effect off)
 *   record   deployments/aztec-mainnet.json -> sponsoredFpc names the same address (WARN while null)
 *
 * What it cannot check (no voucher is signed here): a voucher used twice is refused, and a
 * transaction above the cap is refused. docs/SPONSOR.md has those two as manual checks.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** = SPONSOR_MAX_FEE in lib/aztec/wallet/ledger-sponsor.ts (test/unit/aztec/verify-sponsor.test.ts keeps them equal). */
export const SPONSOR_MAX_FEE = 40n * 10n ** 18n;
/** = AZTEC_NETWORKS.mainnet in lib/aztec/sequencer/networks.ts (same test). */
export const ALPHA = { l1ChainId: 1, rollupVersion: 2070860440, publicNodeRpc: 'https://aztec-mainnet.drpc.org' };
export const ARTIFACT = 'contracts/aztec/sponsor/target/ledger_sponsor-LedgerSponsor.json';

const HEX32 = /^0x[0-9a-fA-F]{64}$/;
const low = (v) => String(v ?? '').toLowerCase();
const isErr = (v) => !!v && typeof v === 'object' && 'error' in v;
const aztec = (wei) => `${(Number(wei / 10n ** 14n) / 10_000).toLocaleString('en-US', { maximumFractionDigits: 4 })} AZTEC`;

/**
 * Pure verdicts from gathered facts. Every fact is either its value or { error }.
 *   server:   { address, enabled, signer, limits }
 *   nodeInfo: { l1ChainId, rollupVersion }
 *   deployed: boolean
 *   classId:  { actual, expected }
 *   address:  { expected }            address computed from the class, key, cap and salt
 *   balance:  bigint                  Fee Juice, base units
 *   record:   string | null           deployments/aztec-mainnet.json -> sponsoredFpc address
 */
export function evaluate(f) {
  const out = [];
  const add = (id, status, detail) => out.push({ id, status, detail });
  const s = f.server;
  const configured = !isErr(s) && HEX32.test(String(s?.address ?? '')) ? low(s.address) : '';

  if (isErr(s)) add('server', 'FAIL', `GET /api/aztec/sponsor: ${s.error}`);
  else if (!configured) add('server', 'FAIL', 'NEXT_PUBLIC_AZTEC_SPONSOR is not a 32-byte Aztec address');
  else if (!s.signer?.xHi) add('server', 'FAIL', 'the server has no sponsor key (set AZTEC_SPONSOR_SIGNER_KEY; on Alpha it is required)');
  else if (!s.enabled) add('server', 'FAIL', 'the server reports sponsorship off');
  else add('server', 'PASS', `sponsor ${configured}`);

  const n = f.nodeInfo;
  if (isErr(n)) add('network', 'FAIL', `node: ${n.error}`);
  else if (Number(n.l1ChainId) !== ALPHA.l1ChainId || Number(n.rollupVersion) !== ALPHA.rollupVersion) {
    add('network', 'FAIL', `node is L1 chain ${n.l1ChainId}, rollup ${n.rollupVersion}; vouchers name chain ${ALPHA.l1ChainId}, rollup ${ALPHA.rollupVersion}`);
  } else add('network', 'PASS', `L1 chain ${n.l1ChainId}, rollup ${n.rollupVersion}`);

  if (isErr(f.deployed)) add('deployed', 'FAIL', f.deployed.error);
  else if (!f.deployed) add('deployed', 'FAIL', configured ? `no contract at ${configured}` : 'no address to look up');
  else add('deployed', 'PASS', 'contract instance found');

  const c = f.classId;
  if (isErr(c)) add('code', 'FAIL', c.error);
  else if (!c?.actual || low(c.actual) !== low(c.expected)) add('code', 'FAIL', `class ${c?.actual ?? 'unknown'} is not this repository's LedgerSponsor (${c?.expected})`);
  else add('code', 'PASS', `class ${low(c.actual)}`);

  const a = f.address;
  if (isErr(a)) add('key+cap', 'FAIL', a.error);
  else if (!configured || low(a?.expected) !== configured) {
    add('key+cap', 'FAIL', 'the address does not follow from the server key and the 40 AZTEC cap: deployed with another key or cap, so every voucher from this server would fail');
  } else add('key+cap', 'PASS', 'deployed with the server key and the 40 AZTEC cap');

  const b = f.balance;
  if (isErr(b)) add('funded', 'FAIL', `Fee Juice balance: ${b.error}`);
  else if (typeof b !== 'bigint' || b <= 0n) add('funded', 'FAIL', 'no Fee Juice: no sponsored transaction can be paid');
  else if (b < SPONSOR_MAX_FEE) add('funded', 'WARN', `${aztec(b)}: below one transaction at the cap (${aztec(SPONSOR_MAX_FEE)}); top it up`);
  else add('funded', 'PASS', aztec(b));

  if (!isErr(s) && s?.limits) {
    const { perWallet, perDay } = s.limits;
    if (!(perWallet > 0) || !(perDay > 0)) add('limits', 'WARN', `per wallet ${perWallet}, per day ${perDay}: sponsorship is in effect off`);
    else add('limits', 'PASS', `per wallet ${perWallet} (for life), per day ${perDay}`);
  }

  if (f.record === null || f.record === undefined) add('record', 'WARN', 'deployments/aztec-mainnet.json -> sponsoredFpc is null: record address, tx hash, block and the Fee Juice slot (scripts/aztec/fee-juice-slot.mjs)');
  else if (configured && low(f.record) !== configured) add('record', 'FAIL', `recorded ${low(f.record)}, configured ${configured}`);
  else add('record', 'PASS', 'recorded in deployments/aztec-mainnet.json');

  return out;
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const safe = async (fn) => {
  try { return await fn(); } catch (e) { return { error: String(e?.message ?? e).slice(0, 200) }; }
};

async function gather(app, nodeUrl) {
  const [{ createAztecNodeClient }, { AztecAddress }, { Fr }, { loadContractArtifact }, { getContractInstanceFromInstantiationParams }, { getFeeJuiceBalance }, { getContractClassFromArtifact }] =
    await Promise.all([
      import('@aztec-labs/aztec.js/node'),
      import('@aztec-labs/aztec.js/addresses'),
      import('@aztec-labs/aztec.js/fields'),
      import('@aztec-labs/aztec.js/abi'),
      import('@aztec-labs/aztec.js/contracts'),
      import('@aztec-labs/aztec.js/utils'),
      import('@aztec-labs/stdlib/contract'),
    ]);
  const f = {};
  f.server = await safe(async () => {
    const r = await fetch(`${app.replace(/\/$/, '')}/api/aztec/sponsor`, { headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
  const node = createAztecNodeClient(nodeUrl);
  f.nodeInfo = await safe(() => node.getNodeInfo());
  const configured = !isErr(f.server) && HEX32.test(String(f.server?.address ?? '')) ? f.server.address : null;
  const artifact = await safe(async () => loadContractArtifact(JSON.parse(fs.readFileSync(ARTIFACT, 'utf8'))));
  const instance = configured ? await safe(() => node.getContract(AztecAddress.fromStringUnsafe(configured))) : null;
  f.deployed = isErr(instance) ? instance : !!instance;
  f.classId = isErr(artifact)
    ? { error: `artifact: ${artifact.error}` }
    : await safe(async () => ({ actual: instance && !isErr(instance) ? instance.currentContractClassId.toString() : null, expected: (await getContractClassFromArtifact(artifact)).id.toString() }));
  f.address = isErr(artifact) || !instance || isErr(instance) || isErr(f.server) || !f.server?.signer
    ? { error: 'needs the artifact, the instance and the server key' }
    : await safe(async () => {
        const k = f.server.signer;
        const args = [Fr.fromString(k.xHi), Fr.fromString(k.xLo), Fr.fromString(k.yHi), Fr.fromString(k.yLo), SPONSOR_MAX_FEE];
        const e = await getContractInstanceFromInstantiationParams(artifact, { constructorArgs: args, salt: instance.salt, deployer: AztecAddress.ZERO });
        return { expected: e.address.toString() };
      });
  f.balance = configured ? await safe(() => getFeeJuiceBalance(AztecAddress.fromStringUnsafe(configured), node)) : { error: 'no address' };
  f.record = await safe(async () => {
    const rec = JSON.parse(fs.readFileSync('deployments/aztec-mainnet.json', 'utf8')).sponsoredFpc;
    return typeof rec === 'string' ? rec : rec?.address ?? null;
  });
  if (isErr(f.record)) f.record = null;
  return f;
}

async function main() {
  const app = arg('app', 'https://ledgerchat.org');
  const nodeUrl = arg('node', ALPHA.publicNodeRpc);
  console.log(`LedgerSponsor check: app ${app}, node ${nodeUrl}\n`);
  const checks = evaluate(await gather(app, nodeUrl));
  for (const c of checks) console.log(`${c.status.padEnd(4)}  ${c.id.padEnd(8)}  ${c.detail}`);
  const failed = checks.filter((c) => c.status === 'FAIL').length;
  console.log(`\n${failed ? `${failed} FAIL` : 'No FAIL'}. Manual, after the first sponsored transaction: docs/SPONSOR.md, "Checks after deployment".`);
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
