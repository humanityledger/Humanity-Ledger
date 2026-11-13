/** Community → DM handoff: only a well-formed EVM peer and a known action open a value modal. */
import { describe, it, expect } from 'vitest';
import { parseValueHandoff } from '@/lib/chat/value-handoff';

describe('parseValueHandoff', () => {
  const peer = '0x' + 'ab'.repeat(20);
  it('accepts pay and agreement for an EVM address', () => {
    expect(parseValueHandoff({ peer, action: 'pay' })).toEqual({ peer, action: 'pay' });
    expect(parseValueHandoff({ peer, action: 'agreement' })?.action).toBe('agreement');
  });
  it('rejects anything else (fail-closed)', () => {
    expect(parseValueHandoff({ peer, action: 'escrow' })).toBeNull();
    expect(parseValueHandoff({ peer: '0x123', action: 'pay' })).toBeNull();
    expect(parseValueHandoff({ peer: 'aztec:' + peer, action: 'pay' })).toBeNull();
    expect(parseValueHandoff(null)).toBeNull();
    expect(parseValueHandoff({ peer, action: 'pay', amount: '1' } as any)).toEqual({ peer, action: 'pay' });
  });
});
