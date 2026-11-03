/**
 * scripts/benchmark-proof-gen.ts
 *
 * Measures real UltraHonk proving time for the standalone circuits through
 * lib/zk/prover.ts (pinned VK, real ACIR, Barretenberg WASM).
 *
 * Usage:
 *   npx tsx scripts/benchmark-proof-gen.ts --circuit escrow --iterations 5
 *
 * Earlier versions fell back to a "calibrated" loop of SHA-256 hashes and
 * printed a fixed proof size when proving failed, which reported numbers that
 * had nothing to do with proving. This version measures proving or exits 1.
 */

import {
  proveEscrow,
  proveIdentity,
  proveStreams,
  destroyZkEngine,
  type UltraHonkProofResult,
} from '../lib/zk/prover';

type Circuit = 'escrow' | 'identity' | 'streams';

// Valid witnesses shared with test/unit/aztec/circuit-proving.test.ts.
const RUNNERS: Record<Circuit, () => Promise<UltraHonkProofResult>> = {
  escrow: () =>
    proveEscrow({
      sender_secret: '12345',
      recipient_pubkey: '67890',
      amount: '1000',
      salt: '999',
      escrow_commitment: '0x1d73346def6ef00fe9c6e6165cbdebcd739d1b43ea7f025529c040d4843080a5',
      nullifier: '0x1485a879df7717201348b608c7af55d2c6a630ff8ae6f05181d80d6f315b8f2a',
      deadline: '1800000000',
      current_timestamp: '1750000000',
    }),
  identity: () =>
    proveIdentity({
      identity_secret: '12345',
      jurisdiction_code: '840',
      merkle_leaf_sibling: '67890',
      is_left: true,
      expected_merkle_root: '0x2a65b513ce830604250f5cb08ce7a88129aad8d03e1bb2742b625b22020cbd94',
      scope: '42',
      scoped_nullifier: '0x1a8fc5ddd747d00a29190989f1034e8687f254fb13286c425e8c72ba0233ab95',
    }),
  streams: () =>
    proveStreams({
      sender_secret: '12345',
      recipient_pubkey: '67890',
      total_allocation: '10000',
      rate_per_second: '10',
      start_time: '1000',
      withdrawn_amount: '200',
      claim_amount: '300',
      salt: '999',
      stream_commitment: '0x1dd07dd799d46a7e7fd63ba40116b21fb43535c17177d811bda7f771aaece6d9',
      current_time: '1060',
      stream_nullifier: '0x13f5958db040e7cd4d94916477e781197eab5361b87b8894c4670b0865ad97cc',
    }),
};

function parseArgs(): { circuit: Circuit; iterations: number } {
  const args = process.argv.slice(2);
  let circuit: Circuit = 'escrow';
  let iterations = 5;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--circuit' && args[i + 1]) circuit = args[++i] as Circuit;
    else if (args[i] === '--iterations' && args[i + 1]) iterations = parseInt(args[++i], 10) || 5;
  }
  if (!(circuit in RUNNERS)) {
    console.error(`Unknown circuit "${circuit}". Use escrow, identity or streams.`);
    process.exit(1);
  }
  return { circuit, iterations };
}

const percentile = (sorted: number[], p: number) =>
  sorted[Math.max(0, Math.min(Math.ceil((p / 100) * sorted.length) - 1, sorted.length - 1))];

async function main() {
  const { circuit, iterations } = parseArgs();
  console.log(`Circuit: ${circuit} · iterations: ${iterations} · host: ${process.platform}/${process.arch} · node ${process.version}`);

  const times: number[] = [];
  let proofBytes = 0;
  for (let i = 1; i <= iterations; i++) {
    const result = await RUNNERS[circuit]();
    if (!result.isValid) throw new Error('Barretenberg rejected its own proof');
    times.push(result.provingTimeMs);
    proofBytes = result.proof.length;
    console.log(`  run ${i}: ${result.provingTimeMs} ms`);
  }

  const sorted = [...times].sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(`min ${sorted[0]} ms · mean ${mean.toFixed(0)} ms · p50 ${percentile(sorted, 50)} ms · max ${sorted.at(-1)} ms`);
  console.log(`proof size ${proofBytes} bytes (includes the first run's WASM start-up in run 1)`);
  await destroyZkEngine();
}

main().catch(async (err) => {
  console.error('Benchmark failed:', (err as Error).message);
  await destroyZkEngine();
  process.exit(1);
});
