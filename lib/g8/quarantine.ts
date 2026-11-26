/**
 * G8 privacy shield (spec §7), client side. With the shield on, a first
 * message or call from someone you never talked to, never admitted and who
 * did not redeem your invite waits in Requests: it is stored, but it does not
 * ring or notify until you accept it. Existing contacts are never
 * affected. With the shield off nothing changes (default).
 *
 * Storage prefix `hl.g8.*` is new (spec §0: existing prefixes are untouched).
 */
import { decideAdmission, type Admission } from '@/lib/g8/admission';

export const QUARANTINE_EVENT = 'hl:g8-quarantine';
const MAX = 500;
const key = (owner: string, kind: 'q' | 'ok') => `hl.g8.${kind === 'q' ? 'quarantine' : 'accepted'}.${owner.toLowerCase()}`;
const admitted = new Set<string>();

function store(): Storage | undefined {
  try { return typeof window !== 'undefined' ? window.localStorage : undefined; } catch { return undefined; }
}
function read(owner: string, kind: 'q' | 'ok', s = store()): string[] {
  try { const v = JSON.parse(s?.getItem(key(owner, kind)) || '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []; } catch { return []; }
}
function write(owner: string, kind: 'q' | 'ok', list: string[], s = store()) {
  try { s?.setItem(key(owner, kind), JSON.stringify([...new Set(list)].slice(-MAX))); } catch {}
  try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(QUARANTINE_EVENT)); } catch {}
}

/** Wallets that redeemed my invites (GET /api/g8/invite) are admitted. */
export function setAdmittedPeers(list: ReadonlyArray<string>): void { admitted.clear(); for (const p of list) admitted.add(p.toLowerCase()); }

export interface ColdFacts { owner: string; peer: string; shieldOn: boolean; known: boolean; blocked: boolean }

/** One answer for every incoming path (message stream, background stream, call offer). */
export function coldContactDecision(f: ColdFacts, s = store()): Admission {
  const p = f.peer.toLowerCase();
  const allowed = f.known || admitted.has(p) || read(f.owner, 'ok', s).includes(p);
  return decideAdmission({ consent: allowed ? 'allowed' : 'unknown', blocked: f.blocked, presented: f.shieldOn ? undefined : 0, requiredLevel: 0 });
}

export function isQuarantined(owner: string, peer: string, s = store()): boolean { return read(owner, 'q', s).includes(peer.toLowerCase()); }
export function listQuarantined(owner: string, s = store()): string[] { return read(owner, 'q', s); }
export function quarantinePeer(owner: string, peer: string, s = store()): void {
  const p = peer.toLowerCase();
  if (!isQuarantined(owner, p, s)) write(owner, 'q', [...read(owner, 'q', s), p], s);
}
/** Accept: the peer becomes a normal contact; later messages ring and notify. */
export function acceptRequest(owner: string, peer: string, s = store()): void {
  const p = peer.toLowerCase();
  write(owner, 'q', read(owner, 'q', s).filter(x => x !== p), s);
  write(owner, 'ok', [...read(owner, 'ok', s), p], s);
}
/** Dismiss: removed from Requests without accepting (Block stays a separate action). */
export function dismissRequest(owner: string, peer: string, s = store()): void {
  const p = peer.toLowerCase();
  write(owner, 'q', read(owner, 'q', s).filter(x => x !== p), s);
}
