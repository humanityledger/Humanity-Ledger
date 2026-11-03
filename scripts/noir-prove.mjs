#!/usr/bin/env node
/**
 * scripts/noir-prove.mjs
 *
 * Command-line interface for Aztec Barretenberg UltraHonk proof generation and verification.
 * Usage:
 *   node scripts/noir-prove.mjs escrow path/to/inputs.json
 *   node scripts/noir-prove.mjs identity path/to/inputs.json
 *   node scripts/noir-prove.mjs streams path/to/inputs.json
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend, Barretenberg } from '@aztec/bb.js';

const [,, circuitName, inputsPath] = process.argv;

if (!circuitName || !['escrow', 'identity', 'streams'].includes(circuitName)) {
  console.error('Usage: node scripts/noir-prove.mjs <escrow|identity|streams> [inputs.json]');
  process.exit(1);
}

const circuitPath = resolve(process.cwd(), `circuits/${circuitName}/target/zk_${circuitName}.json`);
const circuit = JSON.parse(readFileSync(circuitPath, 'utf8'));

let inputs = {};
if (inputsPath) {
  inputs = JSON.parse(readFileSync(resolve(process.cwd(), inputsPath), 'utf8'));
} else {
  // Use canonical test inputs
  if (circuitName === 'escrow') {
    inputs = {
      sender_secret: "12345",
      recipient_pubkey: "67890",
      amount: "1000",
      salt: "999",
      escrow_commitment: "0x1d73346def6ef00fe9c6e6165cbdebcd739d1b43ea7f025529c040d4843080a5",
      nullifier: "0x1485a879df7717201348b608c7af55d2c6a630ff8ae6f05181d80d6f315b8f2a",
      deadline: "1800000000",
      current_timestamp: "1750000000"
    };
  } else if (circuitName === 'identity') {
    inputs = {
      identity_secret: "12345",
      jurisdiction_code: 840,
      merkle_leaf_sibling: "67890",
      is_left: true,
      expected_merkle_root: "0x2a65b513ce830604250f5cb08ce7a88129aad8d03e1bb2742b625b22020cbd94",
      scope: "42",
      scoped_nullifier: "0x1a8fc5ddd747d00a29190989f1034e8687f254fb13286c425e8c72ba0233ab95"
    };
  } else if (circuitName === 'streams') {
    inputs = {
      sender_secret: "12345",
      recipient_pubkey: "67890",
      total_allocation: "10000",
      rate_per_second: "10",
      start_time: "1000",
      withdrawn_amount: "200",
      claim_amount: "300",
      salt: "999",
      stream_commitment: "0x1dd07dd799d46a7e7fd63ba40116b21fb43535c17177d811bda7f771aaece6d9",
      current_time: "1060",
      stream_nullifier: "0x13f5958db040e7cd4d94916477e781197eab5361b87b8894c4670b0865ad97cc"
    };
  }
}

console.log(`[PROVER CLI] Proving circuit: ${circuitName}`);
console.log(`[PROVER CLI] Proving system: UltraHonk (curve BN254)`);

const api = await Barretenberg.new();
const noir = new Noir(circuit);
const backend = new UltraHonkBackend(circuit.bytecode, api);

console.log('[PROVER CLI] 1. Solving witness via ACVM...');
const t0 = Date.now();
const { witness } = await noir.execute(inputs);
console.log(`[PROVER CLI] Witness solved (${witness.length} bytes, ${Date.now() - t0}ms)`);

console.log('[PROVER CLI] 2. Generating UltraHonk proof...');
const t1 = Date.now();
const proof = await backend.generateProof(witness);
console.log(`[PROVER CLI] Proof generated (${proof.proof.length} bytes, ${Date.now() - t1}ms)`);

console.log('[PROVER CLI] 3. Verifying proof...');
const isValid = await backend.verifyProof(proof);
console.log(`[PROVER CLI] Verification: ${isValid ? 'VALID' : 'INVALID'}`);

const vkBytes = await backend.getVerificationKey();
const vkHash = '0x' + createHash('sha256').update(Buffer.from(vkBytes)).digest('hex');
console.log(`[PROVER CLI] VK SHA256: ${vkHash}`);

await api.destroy();

if (!isValid) {
  console.error('[PROVER CLI] Proof verification failed!');
  process.exit(1);
}

console.log('[PROVER CLI] SUCCESS.');
process.exit(0);
