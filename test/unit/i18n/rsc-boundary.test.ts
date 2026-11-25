/**
 * 25 November 2026: every /docs page showed "Something went wrong". DocsLayout, a server component,
 * imported SiteFooter, which called useT() (a client hook) without 'use client'. Next refuses that at
 * render time, so the whole page failed.
 *
 * This walks the import graph from every server page and layout under app/ and fails if a file
 * reached without crossing a 'use client' boundary calls a client hook.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const EXTS = ['.tsx', '.ts', '.jsx', '.js'];
const HOOK = /\b(useT|useState|useEffect|useRef|useMemo|useCallback|useContext|useReducer|useLayoutEffect|useRouter|usePathname|useSearchParams)\s*\(/;
const IMPORT = /(?:^|\n)\s*(?:import|export)\s+(?!type\b)(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/g;
const ENTRY = /^(page|layout|template|not-found|loading|error|default)\.(tsx|ts|jsx|js)$/;

const cache = new Map<string, string>();
const read = (p: string) => {
  if (!cache.has(p)) cache.set(p, fs.readFileSync(p, 'utf8'));
  return cache.get(p)!;
};
const isClient = (src: string) => /^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*['"]use client['"]/.test(src);
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

function resolve(spec: string, from: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = spec.slice(2);
  else if (spec.startsWith('.')) base = path.normalize(path.join(path.dirname(from), spec));
  else return null;
  for (const c of [base, ...EXTS.map((e) => base + e), ...EXTS.map((e) => path.join(base, 'index' + e))]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

function entries(dir: string, out: string[] = []): string[] {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) entries(p, out);
    else if (ENTRY.test(d.name)) out.push(p);
  }
  return out;
}

describe('server pages never reach a client hook outside a client boundary', () => {
  it('no server tree calls useT or another hook in a file without "use client"', () => {
    const bad: string[] = [];
    for (const entry of entries('app')) {
      if (isClient(read(entry))) continue;
      const seen = new Set<string>();
      const stack: [string, string[]][] = [[entry, [entry]]];
      while (stack.length) {
        const [p, trail] = stack.pop()!;
        if (seen.has(p)) continue;
        seen.add(p);
        const src = read(p);
        if (p !== entry && isClient(src)) continue;
        const hook = strip(src).match(HOOK);
        if (hook && !src.includes('server-only')) bad.push(`${p} calls ${hook[1]}() via ${trail.slice(-3).join(' -> ')}`);
        for (const m of src.matchAll(IMPORT)) {
          const r = resolve(m[1], p);
          if (r) stack.push([r, [...trail, r]]);
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });
});
