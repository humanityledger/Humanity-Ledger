/**
 * lib/communities/member-names.ts
 *
 * The Ledger Chat name of each wallet, for community posts and member lists, so people in a group
 * can tell who wrote what. A name is the one the person chose (User.chatName, unless it is still
 * the default "Ledger User"), else their profile display name. Wallets with neither get no entry:
 * the screen shows the shortened wallet instead.
 *
 * These are the same names /api/chat/users/search already returns to any signed-in person, so a
 * community member learns nothing new about another member from them.
 */

import { prisma } from '@/lib/prisma';

const DEFAULT_NAME = 'Ledger User';
const MAX_NAME = 40;
const ADDRESS = /^0x[0-9a-f]{40}$/;

/** A name fit to show: trimmed, one line, at most 40 characters, never the default name. */
export function cleanName(chatName?: string | null, displayName?: string | null): string | null {
  for (const raw of [chatName, displayName]) {
    const s = (raw ?? '').replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim();
    if (s && s !== DEFAULT_NAME) return s.length > MAX_NAME ? `${s.slice(0, MAX_NAME - 1)}…` : s;
  }
  return null;
}

/** lowercase wallet -> name, for the wallets that have one. Never throws: no names is a valid answer. */
export async function memberNames(addresses: Array<string | null | undefined>): Promise<Map<string, string>> {
  const wanted = Array.from(new Set(addresses.map((a) => String(a ?? '').toLowerCase()).filter((a) => ADDRESS.test(a)))).slice(0, 500);
  const out = new Map<string, string>();
  if (!wanted.length) return out;
  let users: Array<{ walletAddress: string; chatName?: string | null; displayName?: string | null }> = [];
  try {
    users = await (prisma as any).user.findMany({
      where: { walletAddress: { in: wanted } },
      select: { walletAddress: true, chatName: true, displayName: true },
    });
  } catch {
    return out;
  }
  for (const u of users) {
    const name = cleanName(u.chatName, u.displayName);
    if (name) out.set(String(u.walletAddress).toLowerCase(), name);
  }
  return out;
}
