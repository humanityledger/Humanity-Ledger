/**
 * lib/communities/join-requests.ts — people waiting for approval to join a community.
 *
 * Used when a community turns on "Approve new members before they join" (requireApproval). A join
 * link then records a request instead of a membership; an owner or admin approves (POST members)
 * or declines it. Requests are not members: they read nothing and are never added to the
 * encrypted group. Kept in Redis for 30 days (no schema change); without Redis the in-memory
 * store of this server is used.
 */
import { safeRedisGet, safeRedisSet } from '@/lib/redis';

export interface JoinRequest { address: string; at: number }

const TTL_SEC = 30 * 24 * 3600;
const MAX = 500;
const key = (communityId: string) => `community:join-requests:${communityId}`;
const ADDR = /^0x[0-9a-f]{40}$/;

export async function listJoinRequests(communityId: string): Promise<JoinRequest[]> {
  const raw = await safeRedisGet(key(communityId));
  if (!raw || raw === 'TIMEOUT') return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((r) => r && ADDR.test(r.address) && typeof r.at === 'number') : [];
  } catch { return []; }
}

async function save(communityId: string, list: JoinRequest[]): Promise<void> {
  await safeRedisSet(key(communityId), JSON.stringify(list.slice(-MAX)), 'EX', TTL_SEC);
}

/** Records a request. Returns false when the list is full. */
export async function addJoinRequest(communityId: string, address: string): Promise<boolean> {
  const a = address.toLowerCase();
  if (!ADDR.test(a)) return false;
  const list = await listJoinRequests(communityId);
  if (list.some((r) => r.address === a)) return true;
  if (list.length >= MAX) return false;
  await save(communityId, [...list, { address: a, at: Date.now() }]);
  return true;
}

export async function removeJoinRequest(communityId: string, address: string): Promise<boolean> {
  const a = address.toLowerCase();
  const list = await listJoinRequests(communityId);
  const next = list.filter((r) => r.address !== a);
  if (next.length === list.length) return false;
  await save(communityId, next);
  return true;
}
