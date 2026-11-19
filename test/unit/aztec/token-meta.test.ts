import fs from 'node:fs';
import { decodeCompressedString, encodeCompressedString, readTokenMeta, tokenMetaSlots } from '@/lib/aztec/token-meta';
import { HLC_TOKEN_META } from '@/lib/payments/assets';

const artifact = { storageLayout: { name: { slot: '0x05' }, symbol: { slot: '0x07' }, decimals: { slot: '0x09' } } };

describe('HLC Test Token metadata (package 1)', () => {
  it('compressed strings round-trip, NUL padding removed, at most 31 bytes', () => {
    for (const t of ['HLC Test Token', 'HLC', 'Humanity Ledger Corp.', 'x'.repeat(31)]) expect(decodeCompressedString(encodeCompressedString(t))).toBe(t);
    expect(() => encodeCompressedString('x'.repeat(32))).toThrow();
    expect(() => decodeCompressedString(1n << 248n)).toThrow();
  });

  it('reads name, symbol and decimals from the slots of the artifact, never from assumed slots', async () => {
    expect(tokenMetaSlots(artifact)).toEqual({ name: 5n, symbol: 7n, decimals: 9n });
    expect(() => tokenMetaSlots({ storageLayout: { name: { slot: '0x05' } } })).toThrow(/storage slot/);
    const store: Record<string, bigint> = { '5': encodeCompressedString('HLC Test Token'), '7': encodeCompressedString('HLC'), '9': 6n };
    expect(await readTokenMeta(artifact, async (s) => store[s.toString()])).toEqual({ name: 'HLC Test Token', symbol: 'HLC', decimals: 6 });
    await expect(readTokenMeta(artifact, async (s) => (s === 9n ? 300n : 0n))).rejects.toThrow(/u8/);
  });

  it('the neutral name has no company form and fits the Token constructor', () => {
    expect(HLC_TOKEN_META).toEqual({ name: 'HLC Test Token', symbol: 'HLC', decimals: 6 });
    expect(HLC_TOKEN_META.name).not.toMatch(/\b(corp|corporation|inc|ltd|s\.?l\.?|s\.?a\.?|gmbh)\b/i);
    expect(new TextEncoder().encode(HLC_TOKEN_META.name).length).toBeLessThanOrEqual(31);
  });

  it('the record: an HLC with another name is marked renamePending until the new instance replaces it', () => {
    const record = JSON.parse(fs.readFileSync('deployments/aztec-mainnet.json', 'utf8'));
    for (const t of record.tokens) {
      if (t.symbol === 'HLC' && t.name !== HLC_TOKEN_META.name) expect(t.renamePending, t.address).toBe(true);
      if (!t.renamePending) expect(t.name).toBe(HLC_TOKEN_META.name);
    }
  });

  it('the operator tools take the name from HLC_TOKEN_META, and the preflight checks it on the node', () => {
    const panel = fs.readFileSync('components/zk/ZkWalletPanel.tsx', 'utf8');
    expect(panel).not.toMatch(/Humanity Ledger Corp/);
    expect(panel).toMatch(/deployHlcTestToken\(HLC_TOKEN_META/);
    expect(panel).toMatch(/\.\.\.HLC_TOKEN_META, mint:/);
    const preflight = fs.readFileSync('test/live/aztec-mainnet-preflight.live.test.ts', 'utf8');
    expect(preflight).toMatch(/readTokenMeta\(TokenContractArtifact/);
    expect(preflight).toMatch(/toBe\(HLC_TOKEN_META\.name\)/);
  });
});
