import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';

vi.mock('@xmtp/browser-sdk', () => ({
  Client: { canMessage: async () => new Map() },
}));

import { publishStateLine, reportPublishState } from '@/lib/xmtp/client';

describe('why a publish waits on its intent', () => {
  it('names the epoch and the fork flags, with no ids', () => {
    expect(publishStateLine({ epoch: 7n, maybeForked: true, isCommitLogForked: false })).toBe('epoch=7 maybeForked=true commitLogForked=false');
    expect(publishStateLine({})).toBe('epoch=? maybeForked=false commitLogForked=false');
    const line = publishStateLine({ epoch: 3, maybeForked: true, forkDetails: 'group ' + 'ab'.repeat(16) + ' diverged' });
    expect(line).not.toMatch(/[0-9a-f]{16,}/i);
    expect(line).toMatch(/details=group … diverged/);
  });

  it('reads debugInfo() when the SDK has it, and never throws', async () => {
    expect(await reportPublishState({ debugInfo: async () => ({ epoch: 2n, maybeForked: false }) })).toBe('epoch=2 maybeForked=false commitLogForked=false');
    expect(await reportPublishState({})).toBeNull();
    expect(await reportPublishState({ debugInfo: async () => { throw new Error('x'); } })).toBeNull();
    expect(await reportPublishState(null)).toBeNull();
  });

  it('runs once per stuck conversation and is accepted by the delivery log', () => {
    const src = fs.readFileSync('lib/xmtp/client.ts', 'utf8');
    expect(src).toMatch(/if \(attempt === 2\) void reportPublishState\(entry\.dm\);/);
    expect(fs.readFileSync('app/api/chat/delivery-report/route.ts', 'utf8')).toMatch(/'publish_debug'/);
  });
});
