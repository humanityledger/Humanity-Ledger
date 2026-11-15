import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// aztec-nr 6.0.0 asserts at the end of every #[external("private")] function that the phase did not
// change, unless the function carries #[allow_phase_change]. A function that calls end_setup() without
// it fails in every real transaction, while TXE tests (which run in the revertible phase and stop at the
// fee-payer election) cannot see it. Found on Alpha, 15 Nov 2026 (a fee-paying contract, since removed).

function nrFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'target' ? [] : nrFiles(p);
    return e.name.endsWith('.nr') && e.name !== 'test.nr' ? [p] : [];
  });
}

/** Each function: its attributes (the lines just above `fn`) and its body up to the next function. */
function functions(src: string) {
  const out: { name: string; attrs: string; body: string }[] = [];
  const re = /((?:[ \t]*(?:#\[[^\n]*\]|\/\/\/[^\n]*)\n)*)[ \t]*(?:pub\s+)?(?:unconstrained\s+)?fn\s+(\w+)/g;
  const hits = [...src.matchAll(re)];
  hits.forEach((m, i) => {
    const start = m.index! + m[0].length;
    const end = i + 1 < hits.length ? hits[i + 1].index! : src.length;
    out.push({ name: m[2], attrs: m[1], body: src.slice(start, end) });
  });
  return out;
}

describe('aztec-nr phase changes', () => {
  const files = nrFiles('contracts/aztec');

  it('every private function that ends the setup phase allows the phase change', () => {
    const offenders: string[] = [];
    for (const f of files) {
      for (const fn of functions(fs.readFileSync(f, 'utf8'))) {
        if (!/\.end_setup\(\)/.test(fn.body)) continue;
        if (!/#\[allow_phase_change\]/.test(fn.attrs) || !/#\[external\("private"\)\]/.test(fn.attrs)) offenders.push(`${f}: ${fn.name}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
