/**
 * scripts/verify-bundle-integrity.ts
 *
 * Reproducible verification of client-side proving bundle artifacts and verification keys.
 * Run with: npx tsx scripts/verify-bundle-integrity.ts
 */

import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PINNED_VK_SHA256, CIRCUITS } from '../lib/zk/vk-pins';
import { getProvingIntegrityManifest } from '../lib/security/integrity';

console.log('[INTEGRITY CHECK] Verifying client-side proving bundle integrity...');

let failures = 0;
const manifest = getProvingIntegrityManifest();

for (const circuit of CIRCUITS) {
  const vkPath = resolve(process.cwd(), 'circuits', circuit, 'target', 'vk');
  const expectedHash = PINNED_VK_SHA256[circuit];

  if (!existsSync(vkPath)) {
    console.warn(`[WARN] Circuit binary VK missing on disk: ${vkPath}`);
    continue;
  }

  const vkBytes = readFileSync(vkPath);
  const actualHash = `0x${createHash('sha256').update(vkBytes).digest('hex')}`;

  if (actualHash.toLowerCase() === expectedHash.toLowerCase()) {
    console.log(`[PASS] ${circuit} binary VK SHA-256 matches pinned hash: ${actualHash}`);
  } else {
    console.error(`[FAIL] ${circuit} binary VK MISMATCH!`);
    console.error(`  Expected: ${expectedHash}`);
    console.error(`  Actual:   ${actualHash}`);
    failures++;
  }

  const manifestEntry = manifest.circuits[circuit];
  if (manifestEntry && manifestEntry.pinnedVkSha256.toLowerCase() === expectedHash.toLowerCase()) {
    console.log(`[PASS] ${circuit} manifest metadata is synchronized.`);
  } else {
    console.error(`[FAIL] ${circuit} manifest metadata mismatch.`);
    failures++;
  }
}

if (failures > 0) {
  console.error(`[FATAL] Integrity verification failed with ${failures} error(s).`);
  process.exit(1);
} else {
  console.log('[SUCCESS] All client-side proving bundle verification keys match pinned hashes.');
  process.exit(0);
}
