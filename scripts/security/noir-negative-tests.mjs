#!/usr/bin/env node
/**
 * Internal security review, Phase 0 step 3: every assert message in an aztec-nr contract has at
 * least one negative TXE test (#[test(should_fail_with = "...")]) in the crate's src/test.nr.
 *
 * Asserts that no input can reach (defensive repeats, re-checks of what an earlier assert or the
 * note getter already guarantees) are listed in UNREACHABLE with the reason; each reason is
 * re-checked by hand in docs/audit/INTERNAL_SECURITY_REVIEW_2026-11-18.md §6.
 * Exit 1 lists the messages that have no negative test. No dependencies, no network.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'contracts/aztec';
const UNREACHABLE = {
  'PrivateEscrow: not the depositor':
    'refund pops notes from refunds.at(msg_sender); deposit inserts each refund note with sender = its owner.',
  'PaymentStream: only the sender can cancel':
    'cancel pops notes from sender_copies.at(msg_sender); create_stream inserts each copy with sender = its owner.',
  // Closed alpha, wave 1 (OD-7, 18 November 2026): FEE_BPS and the minimum fee are 0, so every
  // quote is fee 0 and these refusals cannot happen. The formula keeps them for the baseline.
  'PrivateEscrow: fee exceeds tx cap': 'alpha class: FEE_BPS = 0 and MIN_FEE = 0 (OD-7), the fee is always 0.',
  'PrivateEscrow: fee exceeds share': 'alpha class: FEE_BPS = 0 and MIN_FEE = 0 (OD-7), the fee is always 0.',
  'PaymentStream: fee exceeds tx cap': 'alpha class: FEE_BPS = 0 and STREAM_MIN_FEE = 0 (OD-7), the fee is always 0.',
  'PaymentStream: fee exceeds share': 'alpha class: FEE_BPS = 0 and STREAM_MIN_FEE = 0 (OD-7), the fee is always 0.',
};
// Asserts repeated in a second function where the first one already refused the same input
// with the same constants (deposit refuses an amount whose claim fee would fail).
const REPEATS_OK = new Set();

const ASSERT_RE = /\bassert(?:_eq)?\s*\(([\s\S]*?),\s*"([^"]+)"\s*\)\s*;/g;
const FAIL_RE = /should_fail_with\s*=\s*"([^"]+)"/g;

let missing = 0;
const report = [];
for (const crate of readdirSync(ROOT).sort()) {
  const main = join(ROOT, crate, 'src/main.nr');
  if (!existsSync(main)) continue;
  const src = readFileSync(main, 'utf8');
  const testPath = join(ROOT, crate, 'src/test.nr');
  const tests = existsSync(testPath) ? readFileSync(testPath, 'utf8') : '';
  const expected = [...tests.matchAll(FAIL_RE)].map(m => m[1]);
  const counts = new Map();
  for (const m of src.matchAll(ASSERT_RE)) counts.set(m[2], (counts.get(m[2]) ?? 0) + 1);
  for (const [msg, n] of counts) {
    const hits = expected.filter(e => msg.includes(e)).length;
    let status;
    // One negative test per occurrence, except a repeat that an earlier assert already decides.
    // A fee refusal is excused only while the class really has a zero fee.
    const feeExcuse = /fee exceeds/.test(msg) && !src.includes('global FEE_BPS: u128 = 0;');
    if (UNREACHABLE[msg] && !feeExcuse) status = 'unreachable';
    else if (hits === 0 || (hits < n && !REPEATS_OK.has(msg))) status = 'MISSING';
    else status = hits < n ? 'ok(repeat)' : 'ok';
    if (status === 'MISSING') missing++;
    report.push({ crate, assert: msg, occurrences: n, negativeTests: hits, status, reason: UNREACHABLE[msg] });
  }
}
for (const r of report) console.log(`${r.status.padEnd(11)} ${r.crate.padEnd(13)} x${r.occurrences} tests=${r.negativeTests}  ${r.assert}${r.reason ? `  (${r.reason})` : ''}`);
console.log(`\n${report.length} assert messages, ${missing} without a negative test.`);
process.exit(missing ? 1 : 0);
