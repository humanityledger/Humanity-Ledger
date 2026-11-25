/**
 * lib/communities/recreate.ts — the client side of re-creating a legacy community on MLS, and of a
 * member following it (lib/communities/legacy.ts). The SDK call is injected, so this is tested
 * without a browser.
 */

export interface RecreateInput {
  community: { id: string; name: string; description?: string | null; isPrivate?: boolean | null };
  headers: Record<string, string>;
  fetchImpl: typeof fetch;
  /** Creates the first channel's XMTP group with the creator only and returns its id. */
  createGroup: (name: string) => Promise<string>;
}

export type RecreateResult =
  | { ok: true; id: string; linked: boolean }
  | { ok: false; error: string; code?: string };

const NOT_REACHED = 'This device could not reach the server. Check your connection and try again.';

export async function recreateOnMls({ community, headers, fetchImpl, createGroup }: RecreateInput): Promise<RecreateResult> {
  let xmtpGroupId: string;
  try {
    xmtpGroupId = await createGroup(community.name);
  } catch {
    return { ok: false, error: 'Encrypted messaging is not ready on this device yet. Wait a moment and try again.', code: 'MLS_REQUIRED' };
  }
  try {
    const res = await fetchImpl('/api/chat/communities', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({
        name: community.name,
        description: community.description ?? '',
        isPrivate: community.isPrivate !== false,
        mls: true,
        xmtpGroupId,
        recreateOf: community.id,
      }),
    });
    const d = await res.json().catch(() => ({}));
    const id = d?.community?.id;
    if (res.ok && typeof id === 'string') return { ok: true, id, linked: d?.linked !== false };
    return { ok: false, error: typeof d?.error === 'string' ? d.error : 'The community was not re-created. Try again.', code: d?.code };
  } catch {
    return { ok: false, error: NOT_REACHED };
  }
}

export type FollowResult = { ok: true; id: string } | { ok: false; error: string; code?: string };

/** A member of a legacy community joins the community it was re-created as. */
export async function followSuccessor(fromCommunityId: string, headers: Record<string, string>, fetchImpl: typeof fetch): Promise<FollowResult> {
  try {
    const res = await fetchImpl('/api/chat/communities/join', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ fromCommunityId }),
    });
    const d = await res.json().catch(() => ({}));
    const id = d?.community?.id;
    if (res.ok && typeof id === 'string') return { ok: true, id };
    return { ok: false, error: typeof d?.error === 'string' ? d.error : 'You could not join the new community. Try again.', code: d?.code };
  } catch {
    return { ok: false, error: NOT_REACHED };
  }
}
