/**
 * J-032: License Compatibility Checker
 * Scans dependencies to ensure no AGPL or incompatible GPL licenses
 * violate the MIT licensing model of Humanity Ledger.
 */
import fs from 'fs';
import path from 'path';

const FORBIDDEN_LICENSES = ['AGPL', 'GPL-3.0', 'GPL-2.0', 'SSPL'];
const ALLOWED_LICENSES = ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'CC0-1.0', 'Unlicense'];

console.log('🔍 Checking dependency licenses for MIT compatibility...');

const pkgPath = path.join(process.cwd(), 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const allDeps = {
  ...pkg.dependencies,
};

let violations = 0;
let checked = 0;

for (const dep of Object.keys(allDeps)) {
  try {
    const depPkgPath = path.join(process.cwd(), 'node_modules', dep, 'package.json');
    if (!fs.existsSync(depPkgPath)) continue;

    const depPkg = JSON.parse(fs.readFileSync(depPkgPath, 'utf8'));
    const license = typeof depPkg.license === 'string'
      ? depPkg.license
      : (depPkg.license?.type || depPkg.licenses?.[0]?.type || 'UNKNOWN');

    checked++;

    for (const forbidden of FORBIDDEN_LICENSES) {
      if (license.toUpperCase().includes(forbidden)) {
        console.error(`❌ INCOMPATIBLE LICENSE: ${dep} has license ${license}`);
        violations++;
      }
    }
  } catch {
    // Skip unresolvable package
  }
}

console.log(`✅ Checked ${checked} dependencies.`);
if (violations > 0) {
  console.error(`💥 Found ${violations} incompatible licenses.`);
  process.exit(1);
} else {
  console.log('🎉 All scanned dependencies are compatible with MIT.');
}
