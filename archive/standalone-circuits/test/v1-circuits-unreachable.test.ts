/**
 * ZK-01 to ZK-07 are soundness issues of the standalone v1 circuits (circuits/escrow, identity,
 * streams; docs/AZTEC_FOUNDATION_DOSSIER.md). They stay closed for users only as long as no page,
 * API route, hook or payment path can reach those circuits or their prover. Value on Aztec moves
 * through the aztec-nr contracts and the standard Token (lib/aztec/wallet, lib/aztec/agreements).
 *
 * This fails when any application code imports the v1 prover, its inputs or worker, the v1
 * verifier, or a v1 circuit artifact. lib/security/integrity.ts may read the pinned VK hashes
 * (lib/zk/vk-pins.ts) to report them; it does not prove or verify.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const V1_MODULES = /(?:from\s+|import\(\s*)['"][^'"]*(?:zk\/(?:prover|prover-client|browser-prover|inputs|prover\.worker)['"/.]|aztec\/verifier['"/.]|circuits\/(?:escrow|identity|streams)\/)/;
// The v1 modules themselves and the integrity report of the pinned hashes.
const ALLOWED = new Set(['lib/zk/prover.ts', 'lib/zk/prover-client.ts', 'lib/zk/browser-prover.ts', 'lib/zk/inputs.ts', 'lib/zk/prover.worker.ts', 'lib/zk/vk-pins.ts', 'lib/aztec/verifier.ts']);

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.(ts|tsx|mts|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

describe('v1 standalone circuits are unreachable from the product (ZK-01 to ZK-07)', () => {
  it('no page, component, hook, API route or library outside lib/zk imports them', () => {
    const hits: string[] = [];
    for (const dir of ['app', 'components', 'hooks', 'context', 'lib']) {
      let list: string[] = [];
      try { list = files(join(root, dir)); } catch { continue; }
      for (const f of list) {
        const rel = relative(root, f).replace(/\\/g, '/');
        if (ALLOWED.has(rel)) continue;
        if (V1_MODULES.test(readFileSync(f, 'utf8'))) hits.push(rel);
      }
    }
    expect(hits).toEqual([]);
  });

  it('the integrity report reads pinned hashes only', () => {
    const src = readFileSync(join(root, 'lib/security/integrity.ts'), 'utf8');
    expect(src).not.toMatch(/generateProof|verifyProof|UltraHonkBackend|Noir\(/);
  });
});
