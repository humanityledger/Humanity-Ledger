#!/usr/bin/env node
/**
 * scripts/zk/check-artifacts.mjs — master prompt task R-02.
 *
 * For each standalone circuit (escrow, identity, streams), checks that three
 * things agree:
 *   1. the SHA-256 pinned in lib/aztec/verifier.ts (PINNED_VK_SHA256),
 *   2. `vkSha256` in circuits/<c>/target/<c>.vk.json,
 *   3. the SHA-256 of the binary VK circuits/<c>/target/vk,
 * and, unless --fast is given, that Barretenberg (@aztec/bb.js) derives exactly
 * those VK bytes from the committed ACIR in circuits/<c>/target/zk_<c>.json.
 *
 * Usage:
 *   node scripts/zk/check-artifacts.mjs           # full check (needs WASM, ~seconds per circuit)
 *   node scripts/zk/check-artifacts.mjs --fast    # hashes only
 *
 * Exit code 0 when everything matches, 1 otherwise.
 */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const CIRCUITS = ['escrow', 'identity', 'streams'];
const root = process.cwd();
const fast = process.argv.includes('--fast');

const sha = (bytes) => '0x' + createHash('sha256').update(bytes).digest('hex');

function readPins() {
  const src = readFileSync(resolve(root, 'lib/aztec/verifier.ts'), 'utf8');
  const block = src.slice(src.indexOf('PINNED_VK_SHA256'));
  const pins = {};
  for (const c of CIRCUITS) {
    const m = block.match(new RegExp(`${c}:\\s*'(0x[0-9a-f]{64})'`));
    if (!m) throw new Error(`No pinned hash for "${c}" in lib/aztec/verifier.ts`);
    pins[c] = m[1];
  }
  return pins;
}

let failures = 0;
const fail = (msg) => {
  failures++;
  console.error(`FAIL  ${msg}`);
};

const pins = readPins();
let api = null;

for (const c of CIRCUITS) {
  const dir = resolve(root, 'circuits', c, 'target');
  const vkBytes = readFileSync(resolve(dir, 'vk'));
  const meta = JSON.parse(readFileSync(resolve(dir, `${c}.vk.json`), 'utf8'));
  const onDisk = sha(vkBytes);
  const before = failures;

  if (onDisk !== pins[c]) fail(`${c}: target/vk hashes to ${onDisk}, pinned is ${pins[c]}`);
  if (meta.vkSha256 !== pins[c]) fail(`${c}: ${c}.vk.json declares ${meta.vkSha256}, pinned is ${pins[c]}`);
  if (meta.vkBytes !== vkBytes.length) fail(`${c}: ${c}.vk.json declares ${meta.vkBytes} bytes, target/vk has ${vkBytes.length}`);

  if (!fast) {
    const artifact = JSON.parse(readFileSync(resolve(dir, `zk_${c}.json`), 'utf8'));
    const { Barretenberg, UltraHonkBackend } = await import('@aztec/bb.js');
    api ??= await Barretenberg.new();
    const backend = new UltraHonkBackend(artifact.bytecode, api);
    const derived = Buffer.from(await backend.getVerificationKey());
    if (!derived.equals(vkBytes)) {
      fail(`${c}: Barretenberg derives a different VK from target/zk_${c}.json (${sha(derived)})`);
    }
  }

  if (failures === before) console.log(`ok    ${c}  ${pins[c]}${fast ? '' : '  (VK re-derived from ACIR)'}`);
}

if (api) await api.destroy();

if (failures > 0) {
  console.error(`\n${failures} artifact check(s) failed.`);
  process.exit(1);
}
console.log('\nAll circuit artifacts match their pinned verification keys.');
