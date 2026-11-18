#!/usr/bin/env node
/**
 * Mutation testing for the aztec-nr contracts (internal security review, Phase 0 step 3).
 *
 *   node scripts/security/noir-mutate.mjs --crate contracts/aztec/streams [--max 30] [--seed 1]
 *
 * Makes one small change at a time to src/main.nr (a comparison flipped, + into -, an assert
 * removed, true into false), runs `aztec test` INSIDE the crate folder, and restores the file.
 * A mutant is "killed" when the tests fail, "survived" when they pass (a gap in the tests), and
 * "invalid" when it does not compile. Prints one line per mutant and a JSON summary; with
 * --min-score S exits 1 when killed / (killed + survived) is below S.
 *
 * Meant for CI (the Aztec toolchain is installed there). It only edits the crate's own source and
 * always restores it, even on Ctrl-C.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true']);
  return acc;
}, []));
const crate = args.crate;
if (!crate) { console.error('usage: --crate contracts/aztec/<name>'); process.exit(2); }
const max = Number(args.max ?? 30);
const minScore = args['min-score'] ? Number(args['min-score']) : null;
const file = join(crate, 'src/main.nr');
const original = readFileSync(file, 'utf8');
const restore = () => writeFileSync(file, original);
process.on('SIGINT', () => { restore(); process.exit(130); });

const OPS = [
  [' >= ', ' > '], [' > ', ' >= '], [' <= ', ' < '], [' < ', ' <= '],
  [' == ', ' != '], [' != ', ' == '], [' + ', ' - '], [' - ', ' + '], [' * ', ' / '],
  ['true', 'false'], ['false', 'true'],
];
const lines = original.split('\n');
const mutants = [];
lines.forEach((line, i) => {
  const code = line.replace(/\/\/.*$/, '');
  const t = code.trim();
  if (!t || t.startsWith('use ') || t.startsWith('global ') || t.startsWith('#[') || t.startsWith('pub struct') || t.startsWith('struct')) return;
  if (/^assert\s*\(/.test(t) && t.endsWith(';')) mutants.push({ line: i, kind: 'drop assert', text: line.replace(t, '// mutant: assert removed') });
  for (const [from, to] of OPS) {
    let at = code.indexOf(from);
    while (at >= 0) {
      mutants.push({ line: i, kind: `${from.trim()} -> ${to.trim()}`, text: line.slice(0, at) + to + line.slice(at + from.length) });
      at = code.indexOf(from, at + from.length);
    }
  }
});

// Deterministic sample (mulberry32) so a run can be repeated.
let seed = Number(args.seed ?? 1) >>> 0;
const rnd = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
for (let i = mutants.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [mutants[i], mutants[j]] = [mutants[j], mutants[i]]; }
const chosen = mutants.slice(0, max);

const result = { crate, candidates: mutants.length, run: chosen.length, killed: 0, survived: 0, invalid: 0, survivors: [] };
try {
  for (const m of chosen) {
    const copy = lines.slice();
    copy[m.line] = m.text;
    writeFileSync(file, copy.join('\n'));
    let status;
    try {
      execFileSync('aztec', ['test'], { cwd: crate, stdio: 'pipe', timeout: 20 * 60 * 1000 });
      status = 'survived';
    } catch (e) {
      const out = String(e.stdout ?? '') + String(e.stderr ?? '');
      status = /error\[|Compilation failed|aborting due to/i.test(out) && !/test .* failed|FAILED/i.test(out) ? 'invalid' : 'killed';
    }
    result[status]++;
    if (status === 'survived') result.survivors.push({ line: m.line + 1, kind: m.kind, code: lines[m.line].trim() });
    console.log(`${status.padEnd(8)} ${file}:${m.line + 1}  ${m.kind}`);
  }
} finally {
  restore();
}
const scored = result.killed + result.survived;
result.score = scored ? result.killed / scored : null;
console.log(JSON.stringify(result, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n### Noir mutation: ${crate}\nkilled ${result.killed}, survived ${result.survived}, invalid ${result.invalid} (of ${result.candidates} candidates)\n`);
}
if (minScore !== null && result.score !== null && result.score < minScore) process.exit(1);
