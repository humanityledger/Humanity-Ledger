#!/usr/bin/env node
/**
 * scripts/zk/v2-vks.mjs
 *
 * Derives the UltraHonk verification key of each experimental v2 circuit
 * (circuits/<c>_v2/target/zk_<c>_v2.json, produced by `nargo compile`) with
 * @aztec/bb.js, writes it next to the ACIR as `target/vk` and prints its
 * SHA-256, and fails if it differs from the hash pinned below (first derived
 * in CI run 41713400769). Changing a v2 circuit means updating its pin here
 * and in docs/zk/V2_CIRCUITS.md in the same commit.
 *
 * Exit code 1 if an artifact is missing or Barretenberg fails.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const PINNED = {
  escrow_v2: '0xb020ec025e2429fd10b56112ffd8b78463931bf479704e8e4dfb51468a7edbf4',
  identity_v2: '0xa8a7a2ba4473803bdcb6c8bd160d95c3fde523510e766952e5563dfd52e96e06',
  streams_v2: '0x58197c394c2db92bf31e5cd3709d2109707362be7cf7bc248785f1afcb043694',
};
const CIRCUITS = Object.keys(PINNED);
const root = process.cwd();

const { Barretenberg, UltraHonkBackend } = await import('@aztec/bb.js');
const api = await Barretenberg.new();
let failed = false;

for (const c of CIRCUITS) {
  const artifactPath = resolve(root, 'circuits', c, 'target', `zk_${c}.json`);
  if (!existsSync(artifactPath)) {
    console.error(`FAIL  ${c}: ${artifactPath} not found (run nargo compile)`);
    failed = true;
    continue;
  }
  const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
  const backend = new UltraHonkBackend(artifact.bytecode, api);
  const vk = Buffer.from(await backend.getVerificationKey());
  writeFileSync(resolve(root, 'circuits', c, 'target', 'vk'), vk);
  const sha = '0x' + createHash('sha256').update(vk).digest('hex');
  const header = [0, 1, 2].map((i) => BigInt('0x' + vk.subarray(i * 32, i * 32 + 32).toString('hex')).toString());
  console.log(`${c}  vk ${vk.length} bytes  sha256 ${sha}  header [${header.join(', ')}]`);
  if (sha !== PINNED[c]) {
    console.error(`FAIL  ${c}: VK changed (pinned ${PINNED[c]})`);
    failed = true;
  }
}

await api.destroy();
process.exit(failed ? 1 : 0);
