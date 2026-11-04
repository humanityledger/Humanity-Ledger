/**
 * scripts/testnet-health-check.ts — master prompt task R-15.
 *
 * Checks that the Aztec test network the private wallet uses is reachable and
 * still the network the app was configured for. Read-only, no keys.
 *
 *   npm run aztec:health            # node from NEXT_PUBLIC_AZTEC_NODE_URL or the public testnet RPC
 *   AZTEC_NODE_URL=... npm run aztec:health
 *
 * The canonical values (L1 chain, rollup address and version, node version)
 * live in lib/aztec/sequencer/networks.ts; this script does not duplicate them.
 * Exit code 0 when every check passes, 1 otherwise, 2 when the node cannot be
 * reached at all.
 */
import { AZTEC_NETWORKS, checkNetworkDrift } from '../lib/aztec/sequencer/networks';
import { aztecRpc } from '../lib/aztec/sequencer/rpc';

const net = AZTEC_NETWORKS.testnet;
const url = process.env.AZTEC_NODE_URL || process.env.NEXT_PUBLIC_AZTEC_NODE_URL || net.publicNodeRpc;

interface NodeInfo {
  nodeVersion?: string;
  l1ChainId?: number;
  rollupVersion?: number;
  l1ContractAddresses?: { rollupAddress?: string };
}
interface ChainTips {
  proposed?: { number?: number };
}

let failures = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
};

async function main() {
  console.log(`${net.label}: ${url}\n`);
  let info: NodeInfo;
  try {
    info = await aztecRpc<NodeInfo>(url, 'aztec_getNodeInfo', [], 10_000);
  } catch (err) {
    console.log(`FAIL  node reachable  (${err instanceof Error ? err.message : String(err)})`);
    process.exit(2);
  }
  check('node reachable', true);
  check('settles on Sepolia', Number(info.l1ChainId) === net.l1ChainId, `l1ChainId ${info.l1ChainId}`);

  const drift = checkNetworkDrift(net, {
    rollupVersion: info.rollupVersion === undefined ? undefined : Number(info.rollupVersion),
    l1ChainId: info.l1ChainId === undefined ? undefined : Number(info.l1ChainId),
    nodeVersion: info.nodeVersion,
    l1ContractAddresses: info.l1ContractAddresses,
  });
  check(
    'matches lib/aztec/sequencer/networks.ts',
    drift.length === 0,
    drift.map((d) => `${d.field}: expected ${d.expected}, got ${d.actual}`).join('; '),
  );

  try {
    const first = await aztecRpc<ChainTips>(url, 'aztec_getChainTips', [], 10_000);
    const n = Number(first.proposed?.number ?? 0);
    check('chain has proposed blocks', n > 0, `proposed block ${n}`);
  } catch (err) {
    check('chain tips readable', false, err instanceof Error ? err.message : String(err));
  }

  console.log(failures === 0 ? '\nHEALTHY' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
