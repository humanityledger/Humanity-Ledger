import { countLabel, shortAddress, communityInviteUrl } from '@/lib/ui/format';

describe('countLabel', () => {
  it('uses the singular only for exactly one', () => {
    expect(countLabel(1, 'member', 'members')).toBe('1 member');
    expect(countLabel(0, 'member', 'members')).toBe('0 members');
    expect(countLabel(2, 'member', 'members')).toBe('2 members');
    expect(countLabel(1200, 'member', 'members')).toBe('1,200 members');
  });
  it('treats bad input as zero', () => {
    expect(countLabel(NaN, 'member', 'members')).toBe('0 members');
    expect(countLabel(-3, 'member', 'members')).toBe('0 members');
  });
});

describe('shortAddress', () => {
  it('shows six characters, an ellipsis and the last four of an address', () => {
    expect(shortAddress('0x2551aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabda9')).toBe('0x2551…bda9');
  });
  it('leaves short values and empty input alone', () => {
    expect(shortAddress('alice')).toBe('alice');
    expect(shortAddress(undefined)).toBe('');
  });
});

describe('communityInviteUrl', () => {
  it('builds the link on the given origin', () => {
    expect(communityInviteUrl('AB12CD34EF', 'https://example.org')).toBe('https://example.org/join/AB12CD34EF');
  });
  it('returns null when there is no usable code', () => {
    expect(communityInviteUrl('', 'https://example.org')).toBeNull();
    expect(communityInviteUrl(undefined, 'https://example.org')).toBeNull();
    expect(communityInviteUrl('../../admin', 'https://example.org')).toBeNull();
  });
});
