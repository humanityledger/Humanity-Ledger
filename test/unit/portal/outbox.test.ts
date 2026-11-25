/**
 * Withdrawals finish in the wallet (lib/portal/outbox.ts): the Outbox leaf must be the one Aztec's
 * Outbox hashes (Hash.sha256ToField(L2ToL1Msg), l1-contracts v6), or HLPortal.withdraw reverts.
 */
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { l2ToL1Leaf, outboxLeafId, recordWithdrawal } from '@/lib/portal/outbox';
import { withdrawContent } from '@/lib/portal/receivers';

const hex = (b: Buffer) => '0x' + b.toString('hex');
const field = (data: Buffer) => { const d = createHash('sha256').update(data).digest(); return hex(Buffer.concat([Buffer.alloc(1), d.subarray(0, 31)])); };
const pad = (h: string, n = 32) => Buffer.from(h.replace(/^0x/, '').padStart(n * 2, '0'), 'hex');

describe('Outbox leaf', () => {
  const l2Token = '0x' + '0a'.repeat(32);
  const portal = '0x' + 'bb'.repeat(20);
  const content = '0x00' + '11'.repeat(31);

  it('is sha256ToField(encodePacked(sender, version, portal (20 bytes), chainId, content))', async () => {
    const packed = Buffer.concat([pad(l2Token), pad((7n).toString(16)), Buffer.from('bb'.repeat(20), 'hex'), pad((11155111).toString(16)), pad(content)]);
    expect(packed.length).toBe(148);
    expect(await l2ToL1Leaf({ l2Token, rollupVersion: 7n, portal, chainId: 11155111, content })).toBe(field(packed));
  });

  it('changes with every field', async () => {
    const base = { l2Token, rollupVersion: 7n, portal, chainId: 1, content };
    const a = await l2ToL1Leaf(base);
    expect(await l2ToL1Leaf({ ...base, rollupVersion: 8n })).not.toBe(a);
    expect(await l2ToL1Leaf({ ...base, chainId: 11155111 })).not.toBe(a);
    expect(await l2ToL1Leaf({ ...base, portal: '0x' + 'cc'.repeat(20) })).not.toBe(a);
  });

  it('leaf id = 2^pathLength + leafIndex (stdlib getL2ToL1MessageLeafId)', () => {
    expect(outboxLeafId({ leafIndex: 5n, path: ['0x1', '0x2', '0x3'] })).toBe(13n);
  });

  it('a recorded withdrawal never binds a caller (anyone may pay step 2)', async () => {
    const r = await recordWithdrawal({ txHash: '0x' + '01'.repeat(32), symbol: 'USDC', l1Token: '0x' + 'aa'.repeat(20), l2Token, recipient: '0x' + 'dd'.repeat(20), amount: 5n, unwrap: false, portal, chainId: 1, rollupVersion: 3n });
    const content2 = await withdrawContent('0x' + 'dd'.repeat(20), 5n);
    expect(r.leaf).toBe(await l2ToL1Leaf({ l2Token, rollupVersion: 3n, portal, chainId: 1, content: content2 }));
    expect(r.amount).toBe('5');
  });
});

describe('wallet wiring', () => {
  it('reads the Outbox roots as the fixed 32-slot array of IOutbox v6', () => {
    expect(fs.readFileSync('lib/portal/l1.ts', 'utf8')).toMatch(/type: 'bytes32\[32\]'/);
  });
  it('the withdraw form is on only because step 2 is sent from the wallet', () => {
    const card = fs.readFileSync('components/zk/wallet/ReceiversCard.tsx', 'utf8');
    expect(card).toMatch(/WITHDRAW_COMPLETES_IN_WALLET = true/);
    expect(card).toMatch(/executeWithdrawal\(/);
    expect(card).toMatch(/portalOutboxProof\(/);
    // The rollup version is read before anything is burned.
    expect(card.indexOf('portalMessaging(publicClient')).toBeLessThan(card.indexOf('portalWithdraw(asset.l2'));
  });
});
