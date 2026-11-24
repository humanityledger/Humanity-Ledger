import { describe, expect, it } from 'vitest';
import { mlsGroupOf, reconcileMembers, serverMembers } from '@/lib/communities/mls-membership';

const A = '0x' + 'a'.repeat(40);
const B = '0x' + 'b'.repeat(40);
const C = '0x' + 'c'.repeat(40);

describe('communities on MLS', () => {
  it('uses a group only when the community is flagged and a channel has one', () => {
    expect(mlsGroupOf({ communityMls: false, channels: [{ xmtpGroupId: 'g1' }] })).toBeNull();
    expect(mlsGroupOf({ communityMls: true, channels: [{ xmtpGroupId: null }] })).toBeNull();
    expect(mlsGroupOf({ communityMls: true, channels: [{ xmtpGroupId: null }, { xmtpGroupId: 'g2' }] })).toBe('g2');
  });
  it('server members include the owner and drop junk', () => {
    expect(serverMembers({ ownerAddress: A.toUpperCase().replace('0X', '0x'), members: [{ walletAddress: B }, { walletAddress: 'nope' }] }).sort()).toEqual([A, B].sort());
  });
  it('reconciles the group to the server and never removes yourself', () => {
    expect(reconcileMembers([A, B], [A, C], A)).toEqual({ add: [B], remove: [C] });
    expect(reconcileMembers([B], [A, B], A)).toEqual({ add: [], remove: [] });
  });
});
