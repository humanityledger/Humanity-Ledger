/**
 * lib/aztec/wallet/node-choice.ts — the person may run or choose their own Aztec node (R5).
 *
 * Why it matters: the node a wallet talks to sees the wallet's IP address and which note tags it
 * asks about. The public node is the default; a node you run yourself keeps that to you.
 *
 * What does not change: the wallet checks every node the same way (lib/aztec/fees.ts identifyNode):
 * another L1, rollup or rollup address is refused before any key is used. A chosen node is never
 * replaced silently by this site's relay: with a chosen node there is no relay fallback, so this
 * site never sees that wallet's node traffic.
 *
 * Stored in this browser only (localStorage). Takes effect the next time the wallet opens.
 */

export const NODE_CHOICE_KEY = 'hl.aztec.node_url';

/** Why `raw` cannot be used as a node URL, or null when it can. */
export function nodeUrlProblem(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return 'That is not a valid URL.';
  }
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]';
  if (u.protocol !== 'https:' && !(local && u.protocol === 'http:')) return 'Use https (http only for a node on this computer).';
  if (u.username || u.password) return 'Do not put credentials in the URL.';
  if (u.search || u.hash) return 'Remove the query and the fragment.';
  return null;
}

export function normalizeNodeUrl(raw: string): string {
  const u = new URL(raw.trim());
  return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
}

export function chosenNodeUrl(storage: Pick<Storage, 'getItem'> | undefined = typeof window === 'undefined' ? undefined : window.localStorage): string | null {
  try {
    const v = storage?.getItem(NODE_CHOICE_KEY);
    return v && !nodeUrlProblem(v) ? v : null;
  } catch {
    return null;
  }
}

/** Saves a node URL, or clears the choice with null. Throws with the reason for a bad URL. */
export function setChosenNodeUrl(raw: string | null, storage: Pick<Storage, 'setItem' | 'removeItem'> = window.localStorage): string | null {
  if (raw === null || !raw.trim()) {
    storage.removeItem(NODE_CHOICE_KEY);
    return null;
  }
  const problem = nodeUrlProblem(raw);
  if (problem) throw new Error(problem);
  const url = normalizeNodeUrl(raw);
  storage.setItem(NODE_CHOICE_KEY, url);
  return url;
}

/** The node the wallet should use, and whether this site's relay may stand in for it. */
export function walletNodeRoute(defaultUrl: string, chosen: string | null = chosenNodeUrl()): { url: string; relay: boolean; chosen: boolean } {
  return chosen ? { url: chosen, relay: false, chosen: true } : { url: defaultUrl, relay: true, chosen: false };
}
