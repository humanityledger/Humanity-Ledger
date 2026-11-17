/**
 * lib/portal/receivers.ts — the client half of receiver addresses and portal messages.
 * Vectors are shared with test/portal/HLPortal.test.ts (Solidity) and
 * contracts/aztec/portal_token/src/test.nr (Noir).
 */
import { describe, it, expect } from 'vitest';
import { createHash, hkdfSync } from 'node:crypto';
import {
  claimPlan,
  cloneInitCode,
  derivePortalMaster,
  deriveReceiver,
  FR_MODULUS,
  mintToPrivateContent,
  predictReceiver,
  receiverSalt,
  SECP256K1_N,
  withdrawContent,
  type ReceiverCrypto,
} from '@/lib/portal/receivers';

/* Keccak-256 (Ethereum), small and slow, for tests only. */
const RC = [
  0x1n, 0x8082n, 0x800000000000808an, 0x8000000080008000n, 0x808bn, 0x80000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x8an, 0x88n, 0x80008009n, 0x8000000an, 0x8000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x800an, 0x800000008000000an, 0x8000000080008081n, 0x8000000000008080n, 0x80000001n,
  0x8000000080008008n,
];
const ROT = [[0, 36, 3, 41, 18], [1, 44, 10, 45, 2], [62, 6, 43, 15, 61], [28, 55, 25, 21, 56], [27, 20, 39, 8, 14]];
const M = (1n << 64n) - 1n;
const rot = (x: bigint, n: number) => (n === 0 ? x : ((x << BigInt(n)) | (x >> BigInt(64 - n))) & M);
function keccak256(data: Uint8Array): string {
  const rate = 136;
  const p = [...data, 0x01];
  while (p.length % rate) p.push(0);
  p[p.length - 1] |= 0x80;
  let A: bigint[][] = Array.from({ length: 5 }, () => Array(5).fill(0n));
  for (let off = 0; off < p.length; off += rate) {
    for (let j = 0; j < rate / 8; j++) {
      let v = 0n;
      for (let k = 7; k >= 0; k--) v = (v << 8n) | BigInt(p[off + 8 * j + k]);
      A[j % 5][Math.floor(j / 5)] ^= v;
    }
    for (const rc of RC) {
      const C = A.map((col) => col.reduce((a, b) => a ^ b));
      const D = C.map((_, x) => C[(x + 4) % 5] ^ rot(C[(x + 1) % 5], 1));
      A = A.map((col, x) => col.map((v) => v ^ D[x]));
      const B: bigint[][] = Array.from({ length: 5 }, () => Array(5).fill(0n));
      for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) B[y][(2 * x + 3 * y) % 5] = rot(A[x][y], ROT[x][y]);
      A = B.map((col, x) => col.map((v, y) => v ^ (~B[(x + 1) % 5][y] & M & B[(x + 2) % 5][y])));
      A[0][0] ^= rc;
    }
  }
  let out = '';
  for (let j = 0; j < 4; j++) {
    let v = A[j % 5][Math.floor(j / 5)];
    for (let k = 0; k < 8; k++) {
      out += (v & 0xffn).toString(16).padStart(2, '0');
      v >>= 8n;
    }
  }
  return '0x' + out;
}

const enc = new TextEncoder();
const crypto: ReceiverCrypto = {
  // Stand-ins: poseidon2 and secp256k1 come from aztec.js and viem in the app.
  async secretHash(secret) {
    return '0x' + (BigInt('0x' + createHash('sha256').update(secret.toString(16)).digest('hex')) % FR_MODULUS).toString(16);
  },
  addressOf(k) {
    return '0x' + createHash('sha256').update('addr' + k.toString(16)).digest('hex').slice(0, 40);
  },
  keccak256,
};
const ROOT = '0x' + 'ab'.repeat(65);

describe('portal client', () => {
  it('keccak256 matches known vectors (sanity of the test helper)', () => {
    expect(keccak256(new Uint8Array())).toBe('0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
    expect(keccak256(enc.encode('transfer(address,uint256)')).slice(0, 10)).toBe('0xa9059cbb');
    expect(keccak256(enc.encode('mint_to_private(uint256)')).slice(0, 10)).toBe('0x8b3af5e8');
    expect(keccak256(enc.encode('withdraw(address,uint256,address)')).slice(0, 10)).toBe('0x69328dec');
  });

  it('message contents match the vectors pinned in Solidity and Noir', async () => {
    expect(await mintToPrivateContent(25000000n)).toBe('0x00e90eec23412b6f89fb744d00d81c1153b7be8eed3b116fc650df4da1b2b8c3');
    expect(await withdrawContent('0x000000000000000000000000000000000000beef', 4000n)).toBe(
      '0x0082b27f9b81bbea08119e9875dab341b46c3899d243dd4871fcd53f4c70dc74',
    );
  });

  it('predicts the CREATE2 address of a receiver clone', () => {
    const sh = '0x' + (0x123456789).toString(16);
    const rs = '0x1111111111111111111111111111111111111111';
    expect(receiverSalt(sh, rs, crypto)).toBe('0xda4e67942130b13ea246609923b0511b8a9b0cc910ada2ca3a45d12861a815b1');
    const addr = predictReceiver('0x5FbDB2315678afecb367f032d93F642f64180aa3', '0xa16e02e87b7454126e5e10d957a927a7f5b5d2be', sh, rs, crypto);
    expect(addr).toBe('0xb2a35d3e7c81cd72b9ab03bc879a6fe11d1894c3');
    expect(cloneInitCode('0xa16e02e87b7454126e5e10d957a927a7f5b5d2be').length).toBe(55);
  });

  it('derives receivers with HKDF exactly as documented (and as the Hardhat suite restates it)', async () => {
    const master = await derivePortalMaster(ROOT);
    const expectMaster = Buffer.from(hkdfSync('sha256', Buffer.from(ROOT.slice(2), 'hex'), 'humanity-ledger/portal', 'hl/portal/v1/master', 64));
    expect(master).toBe('0x' + expectMaster.toString('hex'));
    const r = await deriveReceiver(master, 3, crypto);
    const seed = Buffer.from(hkdfSync('sha256', expectMaster, 'humanity-ledger/portal', 'hl/portal/v1/receiver/3', 96));
    expect(r.secret).toBe(BigInt('0x' + seed.subarray(0, 48).toString('hex')) % FR_MODULUS);
    expect(r.rescueKey).toBe(BigInt('0x' + seed.subarray(48, 96).toString('hex')) % SECP256K1_N);
    // The two keys come from disjoint halves of the seed: knowing one reveals no bit of the other.
    const { secret: _s, ...rest } = r;
    expect(JSON.stringify(rest, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).not.toContain(r.secret.toString());
    expect(r.secretHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('receivers of one account share nothing; other accounts give other receivers', async () => {
    const master = await derivePortalMaster(ROOT);
    const all = await Promise.all([0, 1, 2].map((i) => deriveReceiver(master, i, crypto)));
    const hashes = new Set(all.map((r) => r.secretHash));
    const signers = new Set(all.map((r) => r.rescueSigner));
    expect(hashes.size).toBe(3);
    expect(signers.size).toBe(3);
    const other = await deriveReceiver(await derivePortalMaster('0x' + 'cd'.repeat(65)), 0, crypto);
    expect(hashes.has(other.secretHash)).toBe(false);
  });

  it('refuses bad input', async () => {
    const fails = async (p: Promise<unknown>) => {
      let threw = false;
      try {
        await p;
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    };
    await fails(derivePortalMaster('0x1234'));
    const master = await derivePortalMaster(ROOT);
    await fails(deriveReceiver(master, -1, crypto));
    await fails(deriveReceiver(master, 64, crypto));
    await fails(withdrawContent('0x1234', 1n));
  });

  it('plans claims by secret hash, after a random delay, never twice', async () => {
    const master = await derivePortalMaster(ROOT);
    const r0 = await deriveReceiver(master, 0, crypto);
    const deposits = [
      { index: 10n, amount: 5n, token: '0xD', secretHash: r0.secretHash, at: 1000 },
      { index: 11n, amount: 5n, token: '0xD', secretHash: r0.secretHash, at: 1000 },
      { index: 12n, amount: 5n, token: '0xD', secretHash: '0x' + '9'.repeat(64), at: 1000 }, // someone else's
    ];
    const rand = (k: string) => (k.endsWith(':10') ? 0 : 1);
    const plan = claimPlan(deposits, [r0], 1000 + 600, { minDelaySec: 600, maxDelaySec: 3600, rand, claimed: new Set() });
    expect(plan.ready.map((d) => d.index)).toEqual([10n]);
    expect(plan.waiting.map((d) => [d.index, d.readyAt])).toEqual([[11n, 4600]]);
    const again = claimPlan(deposits, [r0], 99999, { minDelaySec: 600, maxDelaySec: 3600, rand, claimed: new Set(['0xd:10']) });
    expect(again.ready.map((d) => d.index)).toEqual([11n]);
  });
});
