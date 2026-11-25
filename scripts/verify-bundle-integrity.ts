/**
 * scripts/verify-bundle-integrity.ts — anyone can check what GET /api/security/integrity says.
 *
 * Hashes every aztec-nr artifact on disk and compares it with the manifest the app publishes
 * (lib/security/integrity.ts → lib/aztec/artifact-pins.ts), and checks that the retired standalone
 * circuits are not in the product tree. Run with: npx tsx scripts/verify-bundle-integrity.ts
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { getIntegrityManifest } from '../lib/security/integrity';

const manifest = getIntegrityManifest();
let failures = 0;

for (const pin of manifest.contracts) {
  if (!existsSync(pin.artifact)) {
    console.error(`[FAIL] ${pin.contract}: ${pin.artifact} is missing`);
    failures++;
    continue;
  }
  const actual = createHash('sha256').update(readFileSync(pin.artifact)).digest('hex');
  if (actual === pin.sha256) console.log(`[PASS] ${pin.contract}  ${actual}`);
  else {
    console.error(`[FAIL] ${pin.contract}: expected ${pin.sha256}, found ${actual}`);
    failures++;
  }
}

for (const r of manifest.retired) {
  if (existsSync('circuits')) {
    console.error('[FAIL] circuits/ is back in the product tree; it was retired to ' + r.path);
    failures++;
  } else console.log(`[PASS] retired: ${r.name} (${r.path})`);
}

if (failures > 0) {
  console.error(`[FATAL] ${failures} integrity check(s) failed.`);
  process.exit(1);
}
console.log(`[SUCCESS] ${manifest.contracts.length} aztec-nr artifacts match the published manifest.`);
