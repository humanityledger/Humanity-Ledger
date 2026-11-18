#!/usr/bin/env node
/**
 * Fails unless the portal and the receivers have 100% line and branch coverage in lcov.info
 * (forge coverage --report lcov). Branches that no input can reach are listed in UNREACHABLE by
 * the source text of their line, with the reason; the review report repeats them (§7).
 */
import { readFileSync, appendFileSync } from 'node:fs';

const FILES = ['contracts/portal/HLPortal.sol', 'contracts/portal/HLReceiver.sol', 'contracts/portal/AztecMessaging.sol'];
const UNREACHABLE = [
  {
    file: 'contracts/portal/HLPortal.sol',
    text: 'if (bound != bytes32(0) && bound != p.asset.l2Token) revert AssetAlreadyBound();',
    reason: 'executeAsset re-check: queueAsset already refuses a different Aztec token for a bound asset, and only executeAsset of the same token (one pending entry per token) can bind it in between.',
  },
];

const lcov = readFileSync(process.argv[2] || 'lcov.info', 'utf8');
let failed = false;
const rows = [];
for (const rec of lcov.split('end_of_record')) {
  const sf = /SF:(.*)/.exec(rec)?.[1]?.trim();
  if (!sf) continue;
  const file = FILES.find(f => sf.endsWith(f));
  if (!file) continue;
  const src = readFileSync(file, 'utf8').split('\n');
  const missedLines = [...rec.matchAll(/^DA:(\d+),(\d+)/gm)].filter(m => m[2] === '0').map(m => Number(m[1]));
  const missedBranches = [...rec.matchAll(/^BRDA:(\d+),[^,]+,[^,]+,(-|0)$/gm)].map(m => Number(m[1]));
  const excused = (line) => UNREACHABLE.some(u => u.file === file && src[line - 1]?.includes(u.text));
  const badLines = [...new Set(missedLines.filter(l => !excused(l)))];
  const badBranches = [...new Set(missedBranches.filter(l => !excused(l)))];
  const lf = Number(/LF:(\d+)/.exec(rec)?.[1] ?? 0), lh = Number(/LH:(\d+)/.exec(rec)?.[1] ?? 0);
  const brf = Number(/BRF:(\d+)/.exec(rec)?.[1] ?? 0), brh = Number(/BRH:(\d+)/.exec(rec)?.[1] ?? 0);
  rows.push({ file, lines: `${lh}/${lf}`, branches: `${brh}/${brf}`, missedLines: badLines, missedBranches: badBranches });
  if (badLines.length || badBranches.length) failed = true;
}
for (const f of FILES) if (!rows.find(r => r.file === f)) { rows.push({ file: f, lines: 'absent', branches: 'absent' }); failed = true; }
for (const r of rows) {
  console.log(`${r.file}: lines ${r.lines}, branches ${r.branches}`);
  for (const l of r.missedLines ?? []) console.log(`  uncovered line ${l}`);
  for (const l of r.missedBranches ?? []) console.log(`  uncovered branch at line ${l}`);
}
for (const u of UNREACHABLE) console.log(`excused: ${u.file}: ${u.text}\n  ${u.reason}`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n### Coverage (portal, receivers)\n${rows.map(r => `- ${r.file}: lines ${r.lines}, branches ${r.branches}`).join('\n')}\n`);
process.exit(failed ? 1 : 0);
