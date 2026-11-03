#!/usr/bin/env node
/**
 * scripts/zk/v2-vks.mjs
 *
 * Derives the UltraHonk verification key of each experimental v2 circuit
 * (circuits/<c>_v2/target/zk_<c>_v2.json, produced by `nargo compile`) with
 * @aztec/bb.js, writes it next to the ACIR as `target/vk` and prints its
 * SHA-256. The v2 VKs are reported, not pinned: they become pins only when a
 * v2 circuit replaces its v1 (docs/zk/V2_CIRCUITS.md).
 *
 * Exit code 1 if an artifact is missing or Barretenberg fails.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const CIRCUITS = ['escrow_v2', 'identity_v2', 'streams_v2'];
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
}

await api.destroy();
process.exit(failed ? 1 : 0);
