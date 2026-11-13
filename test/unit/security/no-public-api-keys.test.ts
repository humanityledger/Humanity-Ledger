import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

/**
 * F-07: secret provider keys are read only on the server, through lib/server/provider-keys.ts.
 * The NEXT_PUBLIC_ names must not come back, and no client component may reach the helper.
 */
const ROOT = process.cwd();
const RETIRED = /NEXT_PUBLIC_(PIMLICO_API_KEY|ALCHEMY_API_KEY|ALCHEMY_ID|COINGECKO_KEY|1INCH_API_KEY|NEWS_API_KEY)\b/;

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    if (['node_modules', '.next', '.git', 'archive'].includes(n)) continue;
    const f = join(dir, n);
    if (statSync(f).isDirectory()) walk(f, out);
    else if (/\.(tsx?|jsx?|mjs)$/.test(n)) out.push(f);
  }
  return out;
}

const files = ['app', 'lib', 'components', 'hooks', 'context', 'config'].flatMap((d) => walk(join(ROOT, d)));
const code = (src: string) => src.replace(/\/\*[^]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\/\/.*$/gm, '');

function resolve(from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? join(ROOT, spec.slice(2)) : spec.startsWith('.') ? join(dirname(from), spec) : null;
  if (!base) return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

describe('provider API keys stay on the server (F-07)', () => {
  it('no source reads a secret provider key under NEXT_PUBLIC_', () => {
    const offenders = files.filter((f) => RETIRED.test(code(readFileSync(f, 'utf8'))));
    expect(offenders).toEqual([]);
  });

  it('the helper is server-only and reads the unprefixed names at run time', () => {
    const helper = readFileSync('lib/server/provider-keys.ts', 'utf8');
    expect(helper).toMatch(/^import 'server-only';$/m);
    expect(helper).toMatch(/process\.env\[name\]/);
  });

  it('no client component reaches lib/server/provider-keys.ts, directly or through imports', () => {
    const helper = join(ROOT, 'lib/server/provider-keys.ts');
    const deps = new Map<string, string[]>();
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      const out: string[] = [];
      for (const m of src.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        const r = resolve(f, m[1] || m[2]);
        if (r) out.push(r);
      }
      deps.set(f, out);
    }
    const clientRoots = files.filter((f) => /^\s*['"]use client['"]/.test(readFileSync(f, 'utf8')));
    const seen = new Set<string>(clientRoots);
    const stack = [...clientRoots];
    while (stack.length) {
      const f = stack.pop()!;
      for (const d of deps.get(f) ?? []) if (!seen.has(d)) { seen.add(d); stack.push(d); }
    }
    expect(seen.has(helper)).toBe(false);
  });

  it('.env.example declares the server names and none of the retired public ones', () => {
    const env = readFileSync('.env.example', 'utf8');
    for (const n of ['ALCHEMY_API_KEY', 'PIMLICO_API_KEY', 'COINGECKO_KEY', 'ONEINCH_API_KEY', 'NEWS_API_KEY']) {
      expect(env).toMatch(new RegExp(`# SERVER ONLY — never use NEXT_PUBLIC_ prefix\\.[^\\n]*\\n# Read in: [^\\n]+\\n${n}=\\n`));
    }
    expect(RETIRED.test(env)).toBe(false);
  });
});
