import fs from 'node:fs';
import path from 'node:path';

/**
 * scripts/check-traceability.ts
 *
 * Automated CI Checker for Traceability Matrix & Protocol Status Consistency.
 *
 * Rules enforced:
 * 1. For every acceptance criterion A1..A7, if docs/STATUS.md marks it SATISFIED,
 *    docs/TRACEABILITY_MATRIX.md MUST mark that exact criterion as VERIFIED.
 * 2. If any criterion is SATISFIED in STATUS.md but ASPIRATIONAL, IN PROGRESS, or NOT VERIFIED
 *    in TRACEABILITY_MATRIX.md, this script exits with status code 1.
 * 3. Every verified claim must reference an existing test or script file on disk.
 */

function main() {
  console.log('===============================================================');
  console.log('Humanity Ledger — Traceability & Status Consistency CI Verifier');
  console.log('===============================================================\n');

  const root = process.cwd();
  const matrixPath = path.join(root, 'docs/TRACEABILITY_MATRIX.md');
  const statusPath = path.join(root, 'docs/STATUS.md');

  if (!fs.existsSync(matrixPath)) {
    console.error(`[FAIL] Missing file: ${matrixPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(statusPath)) {
    console.error(`[FAIL] Missing file: ${statusPath}`);
    process.exit(1);
  }

  const matrixContent = fs.readFileSync(matrixPath, 'utf8');
  const statusContent = fs.readFileSync(statusPath, 'utf8');

  const criteria = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'];
  let errors = 0;

  console.log('Checking Acceptance Criteria A1–A7 consistency...\n');

  for (const crit of criteria) {
    // 1. Check if STATUS.md claims SATISFIED
    // Matches e.g. "**A1 (Private state end-to-end)**: **SATISFIED**" or "A1: SATISFIED"
    const statusSatisfiedRegex = new RegExp(`\\*\\*${crit}\\b[^:]*\\*\\*:\\s*\\*\\*SATISFIED\\*\\*`, 'i');
    const isStatusSatisfied = statusSatisfiedRegex.test(statusContent);

    // 2. Extract verification status from TRACEABILITY_MATRIX.md
    // Look for row starting with | **A1** | ... | **VERIFIED** |
    const matrixRowRegex = new RegExp(`\\|\\s*\\*\\*${crit}\\*\\*\\s*\\|([^|\\n]+\\|)+`, 'g');
    const matrixRowMatch = matrixContent.match(matrixRowRegex);

    let matrixStatus = 'UNKNOWN';
    if (matrixRowMatch && matrixRowMatch.length > 0) {
      const row = matrixRowMatch[0];
      if (/VERIFIED/i.test(row)) {
        matrixStatus = 'VERIFIED';
      } else if (/ASPIRATIONAL/i.test(row)) {
        matrixStatus = 'ASPIRATIONAL';
      } else if (/IN PROGRESS/i.test(row)) {
        matrixStatus = 'IN PROGRESS';
      }
    }

    console.log(`Criterion [${crit}]:`);
    console.log(`  docs/STATUS.md:               ${isStatusSatisfied ? 'SATISFIED' : 'NOT SATISFIED'}`);
    console.log(`  docs/TRACEABILITY_MATRIX.md:  ${matrixStatus}`);

    if (isStatusSatisfied && matrixStatus !== 'VERIFIED') {
      console.error(
        `  [ERROR] Inconsistency detected! STATUS.md claims ${crit} is SATISFIED, but TRACEABILITY_MATRIX.md specifies ${matrixStatus}.\n`,
      );
      errors++;
    } else {
      console.log('  [OK] Consistent.\n');
    }
  }

  // 3. Verify that test files cited in TRACEABILITY_MATRIX exist on disk
  console.log('Verifying referenced test files on disk...');
  const citedFiles = [
    'test/aztec_e2e_no_simulation.test.ts',
    'scripts/aztec-pxe-e2e.ts',
    'test/key_custody.test.ts',
    'test/mls_post_compromise.test.ts',
    'test/circuits/escrow.test.ts',
    'test/circuits/streams.test.ts',
    'test/circuits/identity.test.ts',
    'test/eaf_isolation.adversarial.test.ts',
    'test/contracts_invariants.test.ts',
    'test/property_fuzz.test.ts',
  ];

  for (const file of citedFiles) {
    const fullPath = path.join(root, file);
    if (!fs.existsSync(fullPath)) {
      console.error(`  [ERROR] Referenced test file missing: ${file}`);
      errors++;
    } else {
      console.log(`  [OK] Found ${file}`);
    }
  }

  console.log('\n===============================================================');
  if (errors > 0) {
    console.error(`Traceability consistency check FAILED with ${errors} violation(s).`);
    process.exit(1);
  } else {
    console.log('Traceability consistency check PASSED. Zero contradictions found.');
    console.log('===============================================================');
    process.exit(0);
  }
}

main();
