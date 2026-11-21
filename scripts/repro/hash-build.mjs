#!/usr/bin/env node
/**
 * scripts/repro/hash-build.mjs — a manifest of a Next.js build, to compare two builds of the same
 * commit (docs/ops/reproducible-builds.md).
 *
 *   node scripts/repro/hash-build.mjs [.next] > build-a.txt
 *   (build again from a clean checkout)
 *   node scripts/repro/hash-build.mjs [.next] > build-b.txt
 *   diff build-a.txt build-b.txt
 *
 * One line per file: SHA-256, size, path relative to the build directory, sorted by path. The
 * build id is replaced by BUILD_ID in paths and contents, since Next.js picks a random one unless
 * the build sets it; caches and traces, which hold timestamps and absolute paths, are left out.
 * No dependency: node:fs and node:crypto only.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.argv[2] || '.next';
if (!existsSync(root)) {
  console.error(`No build at ${root}. Run "npm run build" first.`);
  process.exit(2);
}
const buildId = existsSync(join(root, 'BUILD_ID')) ? readFileSync(join(root, 'BUILD_ID'), 'utf8').trim() : '';
const SKIP = [/^cache\//, /^trace$/, /\.nft\.json$/, /^BUILD_ID$/, /^server\/.*\.js\.map$/];

function* walk(dir) {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else yield p;
  }
}

const lines = [];
for (const file of walk(root)) {
  let rel = relative(root, file).split(sep).join('/');
  if (SKIP.some((re) => re.test(rel))) continue;
  let bytes = readFileSync(file);
  if (buildId) {
    rel = rel.split(buildId).join('BUILD_ID');
    const text = bytes.toString('latin1');
    if (text.includes(buildId)) bytes = Buffer.from(text.split(buildId).join('BUILD_ID'), 'latin1');
  }
  lines.push(`${createHash('sha256').update(bytes).digest('hex')}  ${String(bytes.length).padStart(9)}  ${rel}`);
}
lines.sort((a, b) => a.slice(77).localeCompare(b.slice(77)));
process.stdout.write(lines.join('\n') + '\n');
console.error(`${lines.length} files hashed${buildId ? `, build id ${buildId} normalised` : ''}.`);
