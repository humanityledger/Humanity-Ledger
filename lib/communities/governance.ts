/**
 * lib/communities/governance.ts
 *
 * Pure rules for community proposals, shared by the proposals API and the Governance screen so
 * both count the same way. Votes are stored per member (ProposalVote, one per member and proposal);
 * the tallies here are always recomputed from those rows, never from a counter alone.
 */

export type VoteChoice = 'FOR' | 'AGAINST' | 'ABSTAIN';
export type CreatorRole = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';
export type EffectiveStatus = 'ACTIVE' | 'PASSED' | 'REJECTED' | 'NO_QUORUM';

/** Voting windows a proposal may have, in days. */
export const PROPOSAL_DURATIONS = [3, 7, 14, 30] as const;
export const DEFAULT_DURATION_DAYS = 7;
export const MAX_QUORUM = 500;

export function isVoteChoice(v: unknown): v is VoteChoice {
  return v === 'FOR' || v === 'AGAINST' || v === 'ABSTAIN';
}

export function isPrivilegedRole(r: CreatorRole | null | undefined): boolean {
  return r === 'OWNER' || r === 'ADMIN' || r === 'MODERATOR';
}

/** A duration the API accepts, else the default. */
export function durationDays(v: unknown): number {
  const n = Number(v);
  return (PROPOSAL_DURATIONS as readonly number[]).includes(n) ? n : DEFAULT_DURATION_DAYS;
}

/**
 * Votes needed for a decision to count. A quarter of the members, at least 2, but never more than
 * the community has (a community of one can still decide). An explicit value is kept within 1..500.
 */
export function quorumFor(membersCount: number, requested?: unknown): number {
  const members = Math.max(1, Math.floor(Number(membersCount) || 1));
  const r = Math.floor(Number(requested));
  if (Number.isFinite(r) && r >= 1) return Math.min(r, MAX_QUORUM);
  return Math.min(members, Math.max(2, Math.ceil(members * 0.25)));
}

export interface Tally { for: number; against: number; abstain: number; total: number }

export function tally(votes: ReadonlyArray<{ vote?: string | null }>): Tally {
  const t: Tally = { for: 0, against: 0, abstain: 0, total: 0 };
  for (const v of votes) {
    const c = String(v?.vote ?? '').toUpperCase();
    if (c === 'FOR') t.for++;
    else if (c === 'AGAINST') t.against++;
    else if (c === 'ABSTAIN') t.abstain++;
    else continue;
    t.total++;
  }
  return t;
}

/** Whole-number percentages that add up to 100 when there are votes (largest remainder). */
export function percentages(t: Tally): { for: number; against: number; abstain: number } {
  if (!t.total) return { for: 0, against: 0, abstain: 0 };
  const raw = [t.for, t.against, t.abstain].map((n) => (n * 100) / t.total);
  const floor = raw.map(Math.floor);
  let left = 100 - floor.reduce((a, b) => a + b, 0);
  const order = raw.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) { if (left <= 0) break; floor[i]++; left--; }
  return { for: floor[0], against: floor[1], abstain: floor[2] };
}

/**
 * Where a proposal stands. Open until its end date; then it passed if it reached its quorum and
 * more members voted for than against, was rejected if it reached quorum otherwise, and had no
 * quorum if too few voted. Abstentions count toward quorum, not toward the result.
 */
export function effectiveStatus(p: { votingEndsAt: string | number | Date; votingThreshold?: number | null }, t: Tally, now: number = Date.now()): EffectiveStatus {
  const ends = new Date(p.votingEndsAt).getTime();
  if (Number.isFinite(ends) && now < ends) return 'ACTIVE';
  const quorum = Math.max(1, Number(p.votingThreshold) || 1);
  if (t.total < quorum) return 'NO_QUORUM';
  return t.for > t.against ? 'PASSED' : 'REJECTED';
}

/** Role of `address` in a community: owner by ownerAddress, else the member row's role. */
export function roleIn(address: string, ownerAddress: string | null | undefined, roles: ReadonlyMap<string, string>): CreatorRole {
  const a = String(address || '').toLowerCase();
  if (a && a === String(ownerAddress || '').toLowerCase()) return 'OWNER';
  const r = roles.get(a);
  return r === 'ADMIN' || r === 'MODERATOR' ? r : 'MEMBER';
}

/**
 * A proposal as Markdown for a forum post (for example forum.aztec.network). Facts only: what was
 * proposed, the counts, and that the vote happened in a Ledger Chat community. Nothing is posted:
 * the person copies it.
 */
export function forumDraft(p: { title: string; description: string; createdAt?: string | Date; votingEndsAt?: string | Date }, t: Tally, communityName: string, status: EffectiveStatus): string {
  const pc = percentages(t);
  const day = (d?: string | Date) => (d ? new Date(d).toISOString().slice(0, 10) : '');
  const state = status === 'ACTIVE' ? 'Voting open' : status === 'PASSED' ? 'Passed' : status === 'REJECTED' ? 'Rejected' : 'Closed without quorum';
  return [
    `# ${p.title.trim()}`,
    '',
    `Community: **${communityName.trim()}** (Ledger Chat)`,
    `Status: ${state}${p.votingEndsAt ? ` · voting ${status === 'ACTIVE' ? 'ends' : 'ended'} ${day(p.votingEndsAt)}` : ''}`,
    '',
    '## Proposal',
    '',
    p.description.trim(),
    '',
    '## Votes so far',
    '',
    `| For | Against | Abstain | Total |`,
    `|---|---|---|---|`,
    `| ${t.for} (${pc.for}%) | ${t.against} (${pc.against}%) | ${t.abstain} (${pc.abstain}%) | ${t.total} |`,
    '',
    '_One member, one vote. Votes are recorded by the community on Ledger Chat\'s server; this post is a copy for discussion._',
  ].join('\n');
}
