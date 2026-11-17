/**
 * test/communities/r17-acceptance.test.ts
 *
 * R-17 Acceptance Test Skeleton
 * ─────────────────────────────
 * Status: AC-01 and AC-02 call the real post route with a mocked database.
 * AC-03 stays skipped (manual, two accounts). A full pg_dump is still manual.
 *
 * Purpose:
 *   This file documents HOW the R-17 acceptance criteria (docs/communities/R17_ACCEPTANCE.md)
 *   will be verified once the implementation exists. The tests are written as executable
 *   specifications so that the first implementation pass can remove the .skip and make them pass.
 *
 * What this file does NOT do:
 *   - It does not implement the MLS migration logic.
 *   - It does not call XMTP APIs.
 *   - It does not connect to a real database.
 *   - It does not modify any production code path.
 *
 * References:
 *   - docs/communities/MLS_MIGRATION.md (design, written by Claude Opus — do not modify)
 *   - docs/communities/R17_ACCEPTANCE.md (acceptance checklist)
 *   - prisma/schema.prisma (communityMls and xmtpGroupId fields)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { isPersistableXmtpGroupId } from '@/lib/xmtp/groupId';

const { db, WALLET } = vi.hoisted(() => ({
  WALLET: '0x1111111111111111111111111111111111111111',
  db: {
    communityPost: { findMany: vi.fn(), create: vi.fn() },
    community: { findUnique: vi.fn(), update: vi.fn() },
    communityMember: { findFirst: vi.fn(), create: vi.fn() },
    communityChannel: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('@/lib/security/requireWallet', () => ({
  requireWallet: vi.fn(async () => ({ walletAddress: WALLET })),
}));
vi.mock('@/lib/prisma', () => ({ prisma: db }));
vi.mock('@/lib/communities/in-memory-communities', () => ({
  getInMemoryCommunityBySlugOrId: () => null,
}));

import { POST } from '@/app/api/chat/communities/[id]/posts/route';

const SECRET = 'This is a test post that must NOT appear in the database';

function post(communityId: string, content: string) {
  return POST(
    new NextRequest(`http://localhost/api/chat/communities/${communityId}/posts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content, title: 't' }),
    }),
    { params: Promise.resolve({ id: communityId }) },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AC-01: No post content in DB when communityMls = true
// ─────────────────────────────────────────────────────────────────────────────

describe('AC-01: no post content in DB when communityMls=true', () => {
  /**
   * HOW THIS WILL BE VERIFIED (spec):
   *
   * 1. Create a community with communityMls = true in the test database.
   * 2. Attempt to create a post via the API (or directly via the service layer).
   * 3. Query ALL tables that could contain post content:
   *    - CommunityPost.content
   *    - CommunityPost.contentHtml
   *    - Any other field that could contain the post text
   * 4. Assert that none of these fields contain the posted text.
   *
   * The implementation must ensure that when communityMls = true,
   * the POST /api/chat/communities/[id]/posts endpoint either:
   *   (a) Returns 410 without writing anything to the DB (preferred), OR
   *   (b) Routes the message to XMTP via lib/xmtp/groups.ts sendGroupMessage()
   *       without persisting the content in PostgreSQL.
   */

  beforeEach(() => {
    vi.clearAllMocks();
    db.community.findUnique.mockResolvedValue({
      id: 'test-community-id',
      communityMls: true,
      isPrivate: true,
      ownerAddress: WALLET,
      channels: [{ id: 'test-channel-id', xmtpGroupId: 'xmtp-group-id-123' }],
    });
    db.communityPost.create.mockResolvedValue({});
    db.communityPost.findMany.mockResolvedValue([]);
  });

  it('should not persist post content in CommunityPost when communityMls=true', async () => {
    const res = await post('test-community-id', SECRET);
    expect(res.status).toBe(410);
    expect(db.communityPost.create).not.toHaveBeenCalled();
    expect(JSON.stringify(db.communityPost.create.mock.calls)).not.toContain(SECRET);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });

  it('should not persist post content in any other table', async () => {
    // WHEN R-17 IS IMPLEMENTED:
    // Run a raw SQL query across all tables to ensure the content string
    // does not appear anywhere in the database.
    // See: https://www.postgresql.org/docs/current/functions-string.html
    //
    // Example (pseudocode):
    // const result = await rawQuery(`
    //   SELECT table_name, column_name
    //   FROM information_schema.columns
    //   WHERE table_schema = 'public'
    //   AND data_type IN ('text', 'character varying', 'json', 'jsonb')
    //   -- then search each for the posted content
    // `);
    // expect(result).toHaveLength(0);

    const res = await post('test-community-id', SECRET);
    expect(res.status).toBe(410);
    expect(db.communityMember.create).not.toHaveBeenCalled();
    expect(db.community.update).not.toHaveBeenCalled();
    expect(db.communityChannel.update).not.toHaveBeenCalled();
    expect(JSON.stringify(db.communityMember.create.mock.calls)).not.toContain(SECRET);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-02: POST /posts returns 410 for MLS community
// ─────────────────────────────────────────────────────────────────────────────

describe('AC-02: POST /posts returns 410 for MLS community', () => {
  /**
   * HOW THIS WILL BE VERIFIED (spec):
   *
   * 1. Set up a community with communityMls = true.
   * 2. Call POST /api/chat/communities/[communityId]/posts with valid auth
   *    and a valid post body.
   * 3. Assert the HTTP response status is exactly 410.
   * 4. Assert the response body contains a message indicating MLS migration.
   *
   * Pattern to follow: test/auth/siwe-routes.test.ts — imports real route
   * handlers and calls them directly with mocked DB and session.
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 410 when communityMls=true', async () => {
    db.community.findUnique.mockResolvedValue({ id: 'test-community-id', communityMls: true, ownerAddress: WALLET });
    const response = await post('test-community-id', SECRET);
    expect(response.status).toBe(410);
    expect((await response.json()).code).toBe('COMMUNITY_MLS');
    expect(db.communityPost.create).not.toHaveBeenCalled();
  });

  it('should return 200 when communityMls=false (control case)', async () => {
    db.community.findUnique.mockResolvedValue({
      id: 'test-community-id',
      communityMls: false,
      isPrivate: true,
      ownerAddress: WALLET,
    });
    db.communityMember.findFirst.mockResolvedValue({ role: 'MEMBER', walletAddress: WALLET.toLowerCase() });
    db.communityPost.create.mockResolvedValue({ id: 'p1', content: 'hello' });
    const response = await post('test-community-id', 'hello');
    expect(response.status).not.toBe(410);
    expect(response.status).toBe(200);
    expect(db.communityPost.create).toHaveBeenCalled();
  });
});

describe('xmtpGroupId is accepted only as a group id token', () => {
  it('rejects empty and unsafe values and accepts a token from createSecureGroup', () => {
    expect(isPersistableXmtpGroupId('')).toBe(false);
    expect(isPersistableXmtpGroupId('short')).toBe(false);
    expect(isPersistableXmtpGroupId('has space!!')).toBe(false);
    expect(isPersistableXmtpGroupId('xmtp-group-id-123')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-03: Expelled member does not receive new messages
// ─────────────────────────────────────────────────────────────────────────────

describe.skip('AC-03: expelled member does not receive new messages (manual verification)', () => {
  /**
   * HOW THIS WILL BE VERIFIED (spec):
   *
   * This acceptance criterion requires a MANUAL test with two real accounts
   * and two real browsers/devices. It cannot be fully automated because:
   *   - XMTP MLS epoch changes require real cryptographic operations.
   *   - Note delivery depends on the XMTP network, not our server.
   *
   * The manual procedure is documented in docs/communities/R17_ACCEPTANCE.md § AC-03.
   *
   * This automated test verifies only the SERVER-SIDE behavior:
   * that removeGroupMember is called when a member is expelled,
   * and that the server does not attempt to deliver the message via its own storage.
   *
   * The XMTP MLS guarantee (that the expelled member does not receive the
   * new epoch key) is provided by XMTP (OpenMLS) and is DELEGATED, as per
   * docs/TRACEABILITY_MATRIX.md CLM-MSG-02.
   */

  it('should call removeGroupMember when a member is expelled', async () => {
    // WHEN R-17 IS IMPLEMENTED:
    // 1. Mock lib/xmtp/groups.ts removeGroupMember.
    // 2. Call the expulsion API endpoint.
    // 3. Assert removeGroupMember was called with the correct inboxId.

    // const removeGroupMember = vi.fn().mockResolvedValue(undefined);
    // vi.mock('@/lib/xmtp/groups', () => ({ removeGroupMember }));
    //
    // await callExpulsionEndpoint(communityId, memberAddress);
    // expect(removeGroupMember).toHaveBeenCalledWith(expect.any(Object), xmtpGroupId, memberInboxId);

    expect(true).toBe(true); // REMOVE THIS LINE when implementing
  });

  it('should not store new messages for an expelled member via server storage', async () => {
    // WHEN R-17 IS IMPLEMENTED:
    // After expulsion, sending a message should not create a CommunityPost
    // record for the expelled member's community.

    expect(true).toBe(true); // REMOVE THIS LINE when implementing
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Schema integrity (can run now — no skip)
// ─────────────────────────────────────────────────────────────────────────────

describe('Schema: communityMls and xmtpGroupId fields exist in Prisma schema', () => {
  /**
   * This test verifies that the Prisma schema changes from the preparatory
   * phase (15 November 2026) are correctly in place. It does not require
   * a database connection — it only reads the schema file.
   */

  it('prisma/schema.prisma contains communityMls field on Community model', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf-8');
    expect(schema).toContain('communityMls');
    expect(schema).toContain('Boolean  @default(false)');
  });

  it('prisma/schema.prisma contains xmtpGroupId field on CommunityChannel model', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf-8');
    expect(schema).toContain('xmtpGroupId');
    expect(schema).toContain('String?');
  });
});

describe('guard: communityMls stays off until the R-17 checklist is met', () => {
  const { readFileSync, readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
  const { join } = require('node:path') as typeof import('node:path');

  // A Prisma `select: { communityMls: true }` reads the column. It is not a write.
  // A line that also assigns the flag, including next to a select, is a write.
  function turnsFlagOn(source: string): boolean {
    return source.split('\n').some((line) => {
      const withoutCompare = line
        .replace(/communityMls\s*!==\s*true/g, '')
        .replace(/communityMls\s*===\s*true/g, '')
        .replace(/communityMls\s*!=\s*true/g, '')
        .replace(/communityMls\s*==\s*true/g, '');
      const assigns = /communityMls\s*=\s*true/.test(withoutCompare) || /communityMls\s*:\s*true/.test(withoutCompare);
      if (!assigns) return false;
      const selectRead = /select\s*:/.test(line) && !/\bdata\s*:/.test(line) && !/communityMls\s*=\s*true/.test(withoutCompare);
      return !selectRead;
    });
  }

  function filesUnder(dir: string, ext: RegExp, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next') continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) filesUnder(p, ext, out);
      else if (ext.test(name)) out.push(p);
    }
    return out;
  }

  it('does not write communityMls true in application code, schema, or migrations', () => {
    const hits: string[] = [];
    for (const root of ['app', 'components', 'lib']) {
      for (const file of filesUnder(join(process.cwd(), root), /\.(ts|tsx)$/)) {
        if (turnsFlagOn(readFileSync(file, 'utf8'))) hits.push(file);
      }
    }
    expect(hits).toEqual([]);

    // Channels are added from Manage (the old settings panel is deleted). It has no XMTP client.
    const panel = readFileSync(join(process.cwd(), 'components/communities/CommunityManage.tsx'), 'utf8');
    expect(panel).not.toContain('createSecureGroup(');
    expect(turnsFlagOn(panel)).toBe(false);

    const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
    expect(schema).toContain('communityMls Boolean  @default(false)');
    expect(schema).not.toMatch(/communityMls Boolean\s+@default\(true\)/);

    const sqlHits: string[] = [];
    for (const file of filesUnder(join(process.cwd(), 'prisma/migrations'), /\.sql$/)) {
      const sql = readFileSync(file, 'utf8');
      const writesTrue = /communityMls[\s\S]{0,80}default\s+true/i.test(sql)
        || /"communityMls"\s*=\s*true/i.test(sql)
        || /communityMls\s*=\s*true/i.test(sql);
      if (writesTrue) sqlHits.push(file);
    }
    expect(sqlHits).toEqual([]);
  });
});
