import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { findReadableDuplicate } from '@/lib/xmtp/dm-health';

const SELF = 'a'.repeat(64), PEER = 'b'.repeat(64), OTHER = 'c'.repeat(64);
const dm = (id: string, peer: string, members: string[], createdAtNs: bigint) => ({
  id, createdAtNs,
  peerInboxId: async () => peer,
  members: async () => members.map((inboxId) => ({ inboxId })),
});

describe('healing a DM the other person cannot read', () => {
  it('picks, among all duplicates, the newest DM with this person that includes them', async () => {
    const broken = dm('broken', PEER, [SELF], 30n);           // ours, stuck at epoch 0
    const theirs = dm('theirs', PEER, [SELF, PEER], 20n);     // the one they created
    const older = dm('older', PEER, [SELF, PEER], 10n);
    const someoneElse = dm('else', OTHER, [SELF, OTHER], 40n);
    let asked: unknown = null;
    const conversations = { listDms: async (o?: Record<string, unknown>) => { asked = o; return [broken, someoneElse, older, theirs]; } };
    const found = await findReadableDuplicate(conversations, PEER, SELF, 'broken');
    expect(found?.id).toBe('theirs');
    expect(asked).toEqual({ includeDuplicateDms: true });
  });

  it('returns nothing when no duplicate includes the other person (never the broken one)', async () => {
    const conversations = { listDms: async () => [dm('broken', PEER, [SELF], 30n), dm('broken2', PEER, [SELF], 31n)] };
    expect(await findReadableDuplicate(conversations, PEER, SELF, 'broken')).toBeNull();
    expect(await findReadableDuplicate({ listDms: async () => { throw new Error('x'); } }, PEER, SELF)).toBeNull();
    expect(await findReadableDuplicate(conversations, '', SELF)).toBeNull();
  });

  it('the send path switches to that DM before writing the message', () => {
    const src = readFileSync(path.resolve(__dirname, '../../../lib/xmtp/client.ts'), 'utf8');
    const heal = src.slice(src.indexOf('async function ensureSendableDm'), src.indexOf('export async function getRegisteredAddress'));
    expect(heal).toMatch(/syncAll\(\[0, 1\]\)/);
    expect(heal).toMatch(/findReadableDuplicate\(client\.conversations as any, peerInbox, selfInbox, next\?\.id\)/);
    expect(heal).toMatch(/dm_unhealed/);
  });
});
