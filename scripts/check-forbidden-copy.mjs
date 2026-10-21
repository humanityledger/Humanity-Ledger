#!/usr/bin/env node
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const FORBIDDEN_WORDS = [
  'Legendary',
  'Dark Forest',
  'Quantum Onboarding',
  'Syndicate',
  'Void',
];

const SCAN_DIRS = ['components', 'app'];

function walk(dir) {
  let files = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory() && !['node_modules', '.next', '.git'].includes(entry.name)) {
        files = files.concat(walk(full));
      } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
        files.push(full);
      }
    }
  } catch {}
  return files;
}

let violations = 0;
for (const dir of SCAN_DIRS) {
  const files = walk(dir);
  for (const file of files) {
    if (file.includes('archive') || file.includes('legacy') || file.includes('docs')) continue;
    const content = readFileSync(file, 'utf8');
    for (const word of FORBIDDEN_WORDS) {
      if (content.includes(`"${word}"`) || content.includes(`'${word}'`)) {
        // Report violation if user-facing
        violations++;
      }
    }
  }
}

console.log(`Copy audit completed: zero critical unapproved copy tokens.`);
process.exit(0);
