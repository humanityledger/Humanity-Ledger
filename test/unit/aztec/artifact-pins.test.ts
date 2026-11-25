/**
 * Path A, and the retirement of the standalone circuits (25 November 2026).
 *
 * 1. Every committed aztec-nr artifact is pinned, and each pin is the SHA-256 of the file: the
 *    integrity manifest (GET /api/security/integrity) cannot describe an artifact other than the
 *    one in the repository.
 * 2. The standalone Noir circuits with ZK-01 to ZK-07, their prover, worker, verifier and VK
 *    registry live only in archive/standalone-circuits: nothing in the product tree, the build or
 *    the CI reaches them.
 */
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { AZTEC_ARTIFACT_PINS } from '@/lib/aztec/artifact-pins';
import { getIntegrityManifest } from '@/lib/security/integrity';

const root = process.cwd();

function files(dir: string, re: RegExp, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'archive') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) files(p, re, out);
    else if (re.test(name)) out.push(p);
  }
  return out;
}

describe('aztec-nr artifact pins', () => {
  it('every committed artifact is pinned with the SHA-256 of the file', () => {
    const onDisk = readdirSync('contracts/aztec')
      .flatMap((c) => {
        const d = join('contracts/aztec', c, 'target');
        return existsSync(d) ? readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => `${d}/${f}`.replace(/\\/g, '/')) : [];
      })
      .sort();
    expect(AZTEC_ARTIFACT_PINS.map((p) => p.artifact).sort()).toEqual(onDisk);
    for (const p of AZTEC_ARTIFACT_PINS) {
      expect(createHash('sha256').update(readFileSync(p.artifact)).digest('hex'), p.artifact).toBe(p.sha256);
    }
  });

  it('the artifacts the product imports are all pinned', () => {
    const imported = new Set<string>();
    for (const f of [...files('lib', /\.(ts|tsx)$/), ...files('components', /\.tsx?$/), ...files('app', /\.tsx?$/)]) {
      for (const m of readFileSync(f, 'utf8').matchAll(/contracts\/aztec\/[a-z_]+\/target\/[A-Za-z0-9_.-]+\.json/g)) imported.add(m[0]);
    }
    const pinned = new Set(AZTEC_ARTIFACT_PINS.map((p) => p.artifact));
    expect([...imported].filter((a) => !pinned.has(a))).toEqual([]);
    expect(imported.size).toBeGreaterThan(0);
  });

  it('the published manifest is Path A: contracts with pins, the standalone circuits retired', () => {
    const m = getIntegrityManifest();
    expect(m.spec).toBe('hl-integrity-v2');
    expect(m.contracts).toBe(AZTEC_ARTIFACT_PINS);
    expect(JSON.stringify(m)).not.toMatch(/pinnedVkSha256|circuits\/(escrow|identity|streams)\//);
    expect(m.retired[0].path).toBe('archive/standalone-circuits');
    expect(m.policy.externalAudit).toMatch(/No external audit report yet/);
  });
});

describe('the standalone circuits are retired (ZK-01 to ZK-07)', () => {
  it('there is no circuits/ directory in the product tree', () => {
    expect(existsSync(join(root, 'circuits'))).toBe(false);
    expect(existsSync(join(root, 'archive/standalone-circuits/circuits/escrow/src/main.nr'))).toBe(true);
    expect(existsSync(join(root, 'archive/standalone-circuits/README.md'))).toBe(true);
  });

  it('no product code, script or test imports the archive or the retired modules', () => {
    const retired = /(?:from\s+|import\(\s*|require\(\s*)['"][^'"]*(?:archive\/|zk\/(?:prover|prover-client|browser-prover|inputs|prover\.worker|vk-pins)['"/.]|aztec\/verifier['"/.])/;
    const hits: string[] = [];
    for (const dir of ['app', 'components', 'hooks', 'context', 'lib', 'scripts', 'test']) {
      if (!existsSync(join(root, dir))) continue;
      for (const f of files(join(root, dir), /\.(ts|tsx|mts|mjs|js|cjs)$/)) {
        if (retired.test(readFileSync(f, 'utf8'))) hits.push(relative(root, f));
      }
    }
    expect(hits).toEqual([]);
  });

  it('the build and the CI leave the archive out', () => {
    const ts = JSON.parse(readFileSync('tsconfig.json', 'utf8'));
    expect(ts.exclude).toContain('archive');
    for (const wf of readdirSync('.github/workflows')) {
      const src = readFileSync(join('.github/workflows', wf), 'utf8');
      expect(src, wf).not.toMatch(/(?<![\w/])circuits\/|check-artifacts|test\/circuits|test\/zk\b|vk_hash_mismatch|aztec_vk_integrity/);
    }
    expect(readFileSync('package.json', 'utf8')).not.toMatch(/test\/circuits|check-artifacts|ZKVerificationKeyRegistry|aztec_vk_integrity/);
  });
});
