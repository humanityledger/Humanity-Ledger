/**
 * I-001: CI check that fails if Math.random() is used in security/cryptographic contexts.
 * Disallows Math.random() in lib/security, lib/crypto, app/api/auth, etc.
 */
import fs from 'fs';
import path from 'path';

console.log('🔍 Checking for insecure Math.random() in security-critical paths...');

const CRITICAL_DIRS = [
  path.join(process.cwd(), 'lib', 'security'),
  path.join(process.cwd(), 'lib', 'session.ts'),
  path.join(process.cwd(), 'lib', 'jwt.ts'),
  path.join(process.cwd(), 'app', 'api', 'auth'),
];

let violations = 0;

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('Math.random()')) {
      // Allowed only in UI animation / non-security rate limit cleanup with explicit exemption comment
      if (!line.includes('// exempt:') && !line.includes('// allowed-ui')) {
        console.error(`❌ Insecure Math.random() in ${filePath}:${idx + 1}`);
        console.error(`   ${line.trim()}`);
        violations++;
      }
    }
  });
}

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  const stat = fs.statSync(dir);
  if (!stat.isDirectory()) {
    checkFile(dir);
    return;
  }
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      scanDir(full);
    } else if (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js')) {
      checkFile(full);
    }
  }
}

for (const p of CRITICAL_DIRS) {
  scanDir(p);
}

if (violations > 0) {
  console.error(`💥 Failed with ${violations} violations.`);
  process.exit(1);
} else {
  console.log('✅ PASS: Zero insecure Math.random() found in security paths.');
}
