#!/usr/bin/env node
/**
 * Runs the Foundry portal suites against every Gambit mutant (internal security review, Phase 0).
 *   gambit mutate --json gambit.json && node scripts/security/gambit-run.mjs --min-score 0.9
 * A mutant is killed when `forge test` fails with it in place. Prints the survivors (each one is a
 * gap in the tests or an equivalent mutant, triaged in the review report) and exits 1 below the
 * threshold. Restores every original file, also on Ctrl-C.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

const minScore = Number(process.argv[process.argv.indexOf('--min-score') + 1] || 0.9);
const configs = JSON.parse(readFileSync('gambit.json', 'utf8'));
const originals = new Map();
const restoreAll = () => { for (const [p, c] of originals) writeFileSync(p, c); };
process.on('SIGINT', () => { restoreAll(); process.exit(130); });

const MATCH = 'test/foundry/{HLPortal,HLReceiver,PortalInvariants,Differential}.t.sol';
const env = { ...process.env, FOUNDRY_PROFILE: 'mutation' };
const summary = [];
let killed = 0, survived = 0;
try {
  for (const c of configs) {
    const results = join(c.outdir, 'gambit_results.json');
    if (!existsSync(results)) { console.error(`missing ${results}: run gambit mutate first`); process.exit(2); }
    const target = c.filename;
    if (!originals.has(target)) originals.set(target, readFileSync(target, 'utf8'));
    const mutants = JSON.parse(readFileSync(results, 'utf8'));
    let k = 0, s = 0;
    for (const m of mutants) {
      const file = join(c.outdir, m.name);
      writeFileSync(target, readFileSync(file, 'utf8'));
      let dead;
      try {
        execFileSync('forge', ['test', '--match-path', MATCH, '-q'], { env, stdio: 'pipe', timeout: 15 * 60 * 1000 });
        dead = false;
      } catch { dead = true; }
      writeFileSync(target, originals.get(target));
      if (dead) k++; else { s++; console.log(`SURVIVED ${target} #${m.id} ${m.description ?? ''}\n${m.diff ?? ''}`); }
    }
    killed += k; survived += s;
    summary.push({ file: target, mutants: mutants.length, killed: k, survived: s, score: mutants.length ? k / mutants.length : 1 });
  }
} finally { restoreAll(); }
const score = killed + survived ? killed / (killed + survived) : 1;
console.log(JSON.stringify({ summary, killed, survived, score }, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n### Gambit\n| file | mutants | killed | score |\n|---|---|---|---|\n${summary.map(x => `| ${x.file} | ${x.mutants} | ${x.killed} | ${(x.score * 100).toFixed(1)}% |`).join('\n')}\n\nTotal ${(score * 100).toFixed(1)}% (threshold ${minScore * 100}%)\n`);
}
process.exit(score >= minScore ? 0 : 1);
