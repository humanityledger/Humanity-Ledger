/**
 * lib/communities/analytics.ts
 *
 * Pure helpers for the community analytics route and panel. No I/O.
 */

export interface GrowthPoint {
  /** YYYY-MM in UTC. Sorts chronologically as a string. */
  key: string;
  /** Short display label, e.g. "Nov 2026". */
  label: string;
  /** Members who joined in this month. */
  joined: number;
  /** Members at the end of this month (cumulative). */
  total: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-');
  return `${MONTHS[Number(month) - 1]} ${year}`;
}

/**
 * Member growth by calendar month and year (UTC). Every month between the first and the last
 * join is present, including months with no joins, so a bar chart never hides a gap.
 * Invalid dates are ignored. No members means an empty series: nothing is invented.
 */
export function memberGrowthByMonth(joinedAt: ReadonlyArray<string | Date | null | undefined>): GrowthPoint[] {
  const counts = new Map<string, number>();
  for (const value of joinedAt) {
    if (value === null || value === undefined) continue;
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) continue;
    const k = monthKey(d);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  if (counts.size === 0) return [];

  const keys = [...counts.keys()].sort();
  const [firstYear, firstMonth] = keys[0].split('-').map(Number);
  const [lastYear, lastMonth] = keys[keys.length - 1].split('-').map(Number);

  const out: GrowthPoint[] = [];
  let total = 0;
  let y = firstYear;
  let m = firstMonth;
  while (y < lastYear || (y === lastYear && m <= lastMonth)) {
    const k = `${y}-${String(m).padStart(2, '0')}`;
    const joined = counts.get(k) ?? 0;
    total += joined;
    out.push({ key: k, label: monthLabel(k), joined, total });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/** "1,234" for a known count, an em dash for a count the server could not read. */
export function formatCount(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US');
}
