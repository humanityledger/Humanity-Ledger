/**
 * test/zk/browser-prover.test.ts — task R-16.
 *
 * The Web Worker prover must not depend on Node built-ins, must refuse an
 * artifact whose VK is not pinned, and must produce proofs the pinned
 * verifier accepts. Runs the real Barretenberg in Node (Web Crypto is global
 * in Node >= 19), with the same witness as test/zk/pinned-verifier.test.ts.
 */
import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  proveInBrowser,
  verifyInBrowser,
  destroyBrowserProver,
  sha256Hex,
  BROWSER_ARTIFACTS,
} from '../../lib/zk/browser-prover';
import { verifyProof } from '../../lib/zk/prover';

const root = path.resolve(__dirname, '../..');
const BROWSER_FILES = [
  'lib/zk/browser-prover.ts',
  'lib/zk/prover.worker.ts',
  'lib/zk/prover-client.ts',
  'lib/zk/inputs.ts',
  'lib/zk/vk-pins.ts',
];

const witness = {
  sender_secret: '12345',
  recipient_pubkey: '67890',
  total_allocation: '10000',
  rate_per_second: '10',
  start_time: '1000',
  withdrawn_amount: '200',
  claim_amount: '300',
  salt: '999',
  stream_commitment: '0x1dd07dd799d46a7e7fd63ba40116b21fb43535c17177d811bda7f771aaece6d9',
  current_time: '1060',
  stream_nullifier: '0x13f5958db040e7cd4d94916477e781197eab5361b87b8894c4670b0865ad97cc',
};

describe('browser (Web Worker) prover', () => {
  afterAll(async () => {
    await destroyBrowserProver();
  });

  it('imports no Node built-ins', () => {
    for (const f of BROWSER_FILES) {
      const src = fs.readFileSync(path.join(root, f), 'utf8');
      expect(src, f).not.toMatch(/from\s+['"](node:|fs['"]|path['"]|crypto['"])/);
      expect(src, f).not.toMatch(/require\(/);
      expect(src, f).not.toMatch(/\bBuffer\./);
    }
  });

  it('hashes with Web Crypto exactly like node:crypto', async () => {
    const bytes = new TextEncoder().encode('humanity ledger');
    const { createHash } = await import('node:crypto');
    expect(await sha256Hex(bytes)).toBe('0x' + createHash('sha256').update(bytes).digest('hex'));
  });

  it('proves streams; the proof passes both verifiers and fails with a swapped artifact', async () => {
    const proof = await proveInBrowser('streams', witness);
    expect(proof.vkHash).toBe('0xa79000bf70441f02ce5ec092f15771e93dfc3d990977a33de9991795bc374346');
    expect(await verifyInBrowser('streams', proof)).toBe(true);
    expect(await verifyProof('streams', proof)).toBe(true);
    expect(await verifyInBrowser('streams', proof, BROWSER_ARTIFACTS.identity)).toBe(false);
  }, 240000);

  it('rejects malformed proofs without throwing and refuses number inputs', async () => {
    expect(await verifyInBrowser('escrow', { proof: new Uint8Array(32), publicInputs: [] })).toBe(false);
    await expect(proveInBrowser('streams', { ...witness, salt: 999 as unknown as string })).rejects.toThrow(
      'must be a string or bigint',
    );
  }, 120000);
});
