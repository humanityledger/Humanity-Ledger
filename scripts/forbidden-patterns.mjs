#!/usr/bin/env node
/**
 * scripts/forbidden-patterns.mjs — I-030
 * 
 * Scans codebase files for forbidden security anti-patterns without relying on external grep.
 * Exits with code 1 if any forbidden pattern is detected.
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
let violations = 0;

function walk(dir, fileList = []) {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file === 'node_modules' || file === '.next' || file === '.git' || file === 'cache' || file === 'coverage') continue;
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath, fileList);
      } else if (/\.(ts|tsx|js|mjs)$/.test(file)) {
        fileList.push(fullPath);
      }
    }
  } catch {}
  return fileList;
}

function checkPattern({ id, regex, targetDir, description, allowedFilter }) {
  const allFiles = walk(path.join(ROOT, targetDir));
  const found = [];

  for (const file of allFiles) {
    const relPath = path.relative(ROOT, file).replace(/\\/g, '/');
    if (relPath.includes('test/') || relPath.includes('.test.') || relPath.includes('.spec.')) continue;
    if (relPath.includes('scripts/forbidden-patterns') || relPath.includes('/archive/')) continue;

    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      if (regex.test(line)) {
        if (allowedFilter && allowedFilter(line, relPath)) return;
        found.push({ file: relPath, line: idx + 1, text: line.trim() });
      }
    });
  }

  if (found.length > 0) {
    console.error(`\n❌ [${id}] ${description}`);
    found.forEach(f => console.error(`   ${f.file}:${f.line} -> ${f.text}`));
    violations++;
  }
}

console.log('🔍 Scanning for forbidden security patterns across codebase...\n');

// A-008: x-web3-address in app/api
checkPattern({
  id: 'A-008',
  regex: /x-web3-address/,
  targetDir: 'app/api',
  description: 'x-web3-address client header used in API routes. Use requireWallet().',
  allowedFilter: (line) => line.trim().startsWith('//') || line.includes('headers.delete'),
});

// A-010: Hardcoded enclave secret
checkPattern({
  id: 'A-010',
  regex: /humanity-ledger-enclave/,
  targetDir: 'app',
  description: 'Hardcoded enclave secret default. Use ENCLAVE_PIN_PEPPER / ENCLAVE_PIN_SECRET.',
});

// A-017: accept-data-loss in scripts/railway-pre-deploy.js
checkPattern({
  id: 'A-017',
  regex: /accept-data-loss/,
  targetDir: 'scripts',
  description: 'accept-data-loss in deploy scripts risks production data wipe.',
  allowedFilter: (line) => line.trim().startsWith('//') || line.includes('REMOVED for safety'),
});

// B-037: Hardcoded secret defaults
checkPattern({
  id: 'B-037',
  regex: /["'](?:default_jwt_secret|change-in-prod|hardcoded_secret)["']/,
  targetDir: 'app',
  description: 'Hardcoded secret values. Require secrets at runtime from environment.',
});

console.log('');
if (violations === 0) {
  console.log('✅ PASS: Zero forbidden security patterns found in codebase.');
  process.exit(0);
} else {
  console.error(`\n🚫 FAIL: Found ${violations} forbidden pattern violation(s).`);
  process.exit(1);
}
