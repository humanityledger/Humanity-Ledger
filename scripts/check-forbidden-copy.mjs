#!/usr/bin/env node
/**
 * scripts/check-forbidden-copy.mjs — master prompt task R-01.
 *
 * Fails (exit 1) when user-facing copy or public documentation makes a claim
 * the code does not support. Until 3 Nov 2026 this script counted matches and
 * always exited 0, so it checked nothing.
 *
 * Two groups:
 * - CLAIMS: phrases that state something false about the project (audits,
 *   production circuits, own MLS, quantum resistance, "100% real"). Searched,
 *   case-insensitive, in components/, app/, lib/ (TS/TSX), README.md and docs/
 *   (Markdown), except docs/zk/ (the plan quotes these claims to correct them),
 *   docs/inventory/ and archived folders. Comment lines in code are skipped:
 *   they are not user-facing.
 * - BRAND_WORDS: retired product words, searched as quoted strings in
 *   components/ and app/.
 *
 * Add an exception only with a comment that explains why the text is true.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const CLAIMS = [
  /production noir circuits?/i,
  /three production (noir )?circuits/i,
  /quantum[- ]aware/i,
  /audit(ed)? verified/i,
  /audited circuits/i,
  /audited on aztec/i,
  /contratos (l1 )?(propios )?auditados/i,
  /closes? (the )?proving gap/i,
  /closing gap vs nyx/i,
  /superiority over nyx|superioridad (frente a|sobre) nyx/i,
  /100% real\b/i,
  /mls rfc 9420 completo|complete (rfc 9420 )?mls implementation/i,
  /cierra(da)? la brecha al 100/i,
];

const BRAND_WORDS = ['Legendary', 'Dark Forest', 'Quantum Onboarding', 'Syndicate', 'Void'];

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '_to_delete', 'archive', 'legacy', 'inventory']);
const root = process.cwd();

function walk(dir, exts, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full, exts, files);
    } else if (exts.some((e) => entry.name.endsWith(e))) {
      files.push(full);
    }
  }
  return files;
}

const findings = [];

function isCommentLine(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('{/*');
}

function scanClaims(file) {
  const rel = relative(root, file).replace(/\\/g, '/');
  if (rel.startsWith('docs/zk/')) return;
  const isCode = /\.(ts|tsx)$/.test(file);
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    // In code, comments are not user-facing; JSX comments ({/* */}) neither.
    if (isCode && isCommentLine(line)) return;
    for (const re of CLAIMS) {
      if (re.test(line)) findings.push(`${rel}:${i + 1}  claim ${re}  ${line.trim().slice(0, 120)}`);
    }
  });
}

const codeFiles = ['components', 'app', 'lib'].flatMap((d) => walk(join(root, d), ['.ts', '.tsx']));
const docFiles = [join(root, 'README.md'), ...walk(join(root, 'docs'), ['.md'])].filter(existsSync);
for (const f of [...codeFiles, ...docFiles]) scanClaims(f);

for (const f of ['components', 'app'].flatMap((d) => walk(join(root, d), ['.ts', '.tsx']))) {
  const content = readFileSync(f, 'utf8')
    .split('\n')
    .filter((line) => !isCommentLine(line))
    .join('\n');
  for (const word of BRAND_WORDS) {
    if (content.includes(`"${word}"`) || content.includes(`'${word}'`)) {
      findings.push(`${relative(root, f).replace(/\\/g, '/')}  retired word "${word}"`);
    }
  }
}

if (findings.length > 0) {
  console.error(`Copy audit failed: ${findings.length} finding(s).\n`);
  for (const f of findings) console.error(`  ${f}`);
  process.exit(1);
}
console.log('Copy audit passed: no unsupported claims or retired words found.');
