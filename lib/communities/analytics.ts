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

/* ── V2 (27 Nov 2026): activity helpers. Pure, UTC, nothing invented. ─────────────────────────── */

type When = string | number | Date | null | undefined;
const DAY = 86_400_000;

function toTime(v: When): number | null {
  if (v === null || v === undefined) return null;
  const t = v instanceof Date ? v.getTime() : typeof v === 'number' ? v : new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

function dayKey(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

export interface DayCount { key: string; label: string; count: number }

/** Items per UTC day for the last `days` days, oldest first, today last; every day present. */
export function activityByDay(timestamps: ReadonlyArray<When>, days = 14, now: number = Date.now()): DayCount[] {
  const n = Math.max(1, Math.floor(days));
  const today = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate());
  const out: DayCount[] = [];
  const index = new Map<string, number>();
  for (let i = n - 1; i >= 0; i--) {
    const d = today - i * DAY;
    const key = dayKey(d);
    index.set(key, out.length);
    out.push({ key, label: `${MONTHS[new Date(d).getUTCMonth()]} ${new Date(d).getUTCDate()}`, count: 0 });
  }
  for (const v of timestamps) {
    const t = toTime(v);
    if (t === null) continue;
    const i = index.get(dayKey(t));
    if (i !== undefined) out[i].count++;
  }
  return out;
}

/** Distinct authors (lower-cased) with at least one item in the last `days` days. */
export function activeUniqueAddresses(items: ReadonlyArray<{ authorAddress?: string | null; createdAt?: When }>, days = 7, now: number = Date.now()): number {
  const since = now - days * DAY;
  const seen = new Set<string>();
  for (const it of items) {
    const a = String(it?.authorAddress ?? '').toLowerCase();
    const t = toTime(it?.createdAt);
    if (a && t !== null && t >= since && t <= now + DAY) seen.add(a);
  }
  return seen.size;
}

export interface Contributor { address: string; label: string; count: number }

/** The `limit` authors with most items, most first (ties: address order, so the list is stable). */
export function topContributors(items: ReadonlyArray<{ authorAddress?: string | null; authorName?: string | null }>, limit = 5): Contributor[] {
  const by = new Map<string, Contributor>();
  for (const it of items) {
    const a = String(it?.authorAddress ?? '').toLowerCase();
    if (!a) continue;
    const c = by.get(a) ?? { address: a, label: '', count: 0 };
    c.count++;
    if (!c.label && it?.authorName) c.label = String(it.authorName);
    by.set(a, c);
  }
  return [...by.values()]
    .map((c) => ({ ...c, label: c.label || (c.address.length > 14 ? `${c.address.slice(0, 6)}…${c.address.slice(-4)}` : c.address) }))
    .sort((x, y) => y.count - x.count || (x.address < y.address ? -1 : 1))
    .slice(0, Math.max(0, limit));
}

/** 7 × 24 counts: [UTC weekday, 0 = Sunday][UTC hour]. */
export function hourlyActivityMatrix(timestamps: ReadonlyArray<When>): number[][] {
  const m = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  for (const v of timestamps) {
    const t = toTime(v);
    if (t === null) continue;
    const d = new Date(t);
    m[d.getUTCDay()][d.getUTCHours()]++;
  }
  return m;
}

/**
 * Member growth of the latest month: members who joined in it, as a percentage of the members at
 * the end of the month before. Null when there is no earlier month or it ended with nobody.
 */
export function periodGrowthPct(growth: ReadonlyArray<GrowthPoint>): number | null {
  if (growth.length < 2) return null;
  const last = growth[growth.length - 1];
  const prev = growth[growth.length - 2];
  if (!prev.total) return null;
  return Math.round((last.joined / prev.total) * 1000) / 10;
}

/**
 * One insight. `title` and `detail` are English templates with {placeholders} (the i18n keys);
 * `vars` fills them. Kept apart so the screen can translate the sentence and the numbers stay exact.
 */
export interface OperationalInsight {
  id: string;
  tone: 'neutral' | 'positive' | 'attention';
  title: string;
  detail: string;
  vars: Record<string, string | number>;
}

export interface InsightInput {
  totalMembers: number | null;
  active7d: number | null;
  growthPct: number | null;
  daily: ReadonlyArray<DayCount> | null;
  channels: ReadonlyArray<{ name: string; count: number | null }>;
  pendingRequests?: number | null;
  activeProposals?: number | null;
}

/** Fills an insight template, for tests and for places without translation. */
export function fillInsight(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/**
 * Plain facts worth acting on, each computed from the input and nothing else. No input, no insight:
 * an unknown figure never produces a sentence.
 */
export function generateOperationalInsights(input: InsightInput): OperationalInsight[] {
  const out: OperationalInsight[] = [];
  const { totalMembers, active7d, growthPct, daily, channels } = input;
  if (typeof totalMembers === 'number' && totalMembers > 0 && typeof active7d === 'number') {
    const pct = Math.round((active7d / totalMembers) * 100);
    out.push({
      id: 'engagement', tone: pct >= 30 ? 'positive' : pct < 10 ? 'attention' : 'neutral',
      title: '{pct}% of members posted in the last 7 days', detail: '{active} of {total} members wrote at least once.',
      vars: { pct, active: active7d, total: totalMembers },
    });
  }
  if (typeof growthPct === 'number') {
    out.push(growthPct > 0
      ? { id: 'growth', tone: 'positive', title: 'Members grew {pct}% in the latest month', detail: 'Joins in the latest calendar month, against members at the end of the month before.', vars: { pct: growthPct } }
      : { id: 'growth', tone: 'neutral', title: 'No new members in the latest month', detail: 'Joins in the latest calendar month, against members at the end of the month before.', vars: {} });
  }
  if (daily && daily.length >= 14) {
    const last7 = daily.slice(-7).reduce((n, d) => n + d.count, 0);
    const prev7 = daily.slice(-14, -7).reduce((n, d) => n + d.count, 0);
    if (last7 || prev7) {
      out.push(last7 >= prev7
        ? { id: 'trend', tone: 'positive', title: 'Activity is steady or up: {last} this week, {prev} the week before', detail: 'Messages per 7-day window, from the source shown above.', vars: { last: last7, prev: prev7 } }
        : { id: 'trend', tone: 'attention', title: 'Activity is down: {last} this week, {prev} the week before', detail: 'Messages per 7-day window, from the source shown above.', vars: { last: last7, prev: prev7 } });
    }
  }
  const quiet = channels.filter((c) => c.count === 0).map((c) => `#${c.name}`);
  if (quiet.length) {
    out.push({ id: 'quiet-channels', tone: 'attention', title: quiet.length === 1 ? '1 channel has no messages' : '{count} channels have no messages', detail: '{names}', vars: { count: quiet.length, names: quiet.slice(0, 6).join(', ') } });
  }
  if (typeof input.pendingRequests === 'number' && input.pendingRequests > 0) {
    out.push({ id: 'requests', tone: 'attention', title: input.pendingRequests === 1 ? '1 request to join is waiting' : '{count} requests to join are waiting', detail: 'Answer them in Manage → Members.', vars: { count: input.pendingRequests } });
  }
  if (typeof input.activeProposals === 'number' && input.activeProposals > 0) {
    out.push({ id: 'proposals', tone: 'neutral', title: input.activeProposals === 1 ? '1 proposal is open for votes' : '{count} proposals are open for votes', detail: 'See them in Manage → Governance.', vars: { count: input.activeProposals } });
  }
  return out;
}

/* V1 names, kept so either spelling works. */

/** Items per UTC day ("YYYY-MM-DD" → count) for the last `days` days. */
export function postsByDay(posts: ReadonlyArray<{ createdAt?: When }>, days = 14, now: number = Date.now()): Record<string, number> {
  return Object.fromEntries(activityByDay(posts.map((p) => p?.createdAt), days, now).map((d) => [d.key, d.count]));
}

/** Authors (lower-cased) active in the last `days` days. */
export function activeAddresses(posts: ReadonlyArray<{ authorAddress?: string | null; createdAt?: When }>, days = 7, now: number = Date.now()): Set<string> {
  const since = now - days * DAY;
  return new Set(posts.filter((p) => { const t = toTime(p?.createdAt); return t !== null && t >= since; }).map((p) => String(p?.authorAddress ?? '').toLowerCase()).filter(Boolean));
}

/** periodGrowthPct, with 0 instead of null for callers that need a number. */
export function growthRate(memberHistory: ReadonlyArray<GrowthPoint>): number {
  return periodGrowthPct(memberHistory) ?? 0;
}

/** CSV with a header row; every field quoted, so names with commas or quotes stay intact. */
export function toCsv(rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>): string {
  return rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
}
