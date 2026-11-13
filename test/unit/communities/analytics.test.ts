import { memberGrowthByMonth, formatCount } from '@/lib/communities/analytics';

describe('memberGrowthByMonth', () => {
  it('keeps the same month of different years apart', () => {
    const points = memberGrowthByMonth(['2025-11-03T10:00:00Z', '2026-11-05T10:00:00Z']);
    expect(points[0]).toMatchObject({ key: '2025-11', label: 'Nov 2025', joined: 1, total: 1 });
    expect(points[points.length - 1]).toMatchObject({ key: '2026-11', label: 'Nov 2026', joined: 1, total: 2 });
    // Every month in between is present, so the chart shows the gap instead of hiding it.
    expect(points).toHaveLength(13);
    expect(points.slice(1, -1).every((p) => p.joined === 0 && p.total === 1)).toBe(true);
  });

  it('is cumulative and chronological whatever the input order', () => {
    const points = memberGrowthByMonth(['2026-03-01T00:00:00Z', '2026-01-15T00:00:00Z', '2026-01-20T00:00:00Z']);
    expect(points.map((p) => [p.key, p.joined, p.total])).toEqual([
      ['2026-01', 2, 2],
      ['2026-02', 0, 2],
      ['2026-03', 1, 3],
    ]);
  });

  it('crosses a year boundary', () => {
    const points = memberGrowthByMonth([new Date('2025-12-31T23:59:59Z'), new Date('2026-01-01T00:00:00Z')]);
    expect(points.map((p) => p.key)).toEqual(['2025-12', '2026-01']);
  });

  it('invents nothing: no members or only invalid dates give an empty series', () => {
    expect(memberGrowthByMonth([])).toEqual([]);
    expect(memberGrowthByMonth([null, undefined, 'not a date'])).toEqual([]);
  });
});

describe('formatCount', () => {
  it('shows a dash for a count the server could not read, never 0', () => {
    expect(formatCount(null)).toBe('—');
    expect(formatCount(undefined)).toBe('—');
    expect(formatCount(0)).toBe('0');
    expect(formatCount(1234)).toBe('1,234');
  });
});
