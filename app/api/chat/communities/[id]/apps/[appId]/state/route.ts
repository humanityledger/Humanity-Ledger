import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireWallet } from '@/lib/security/requireWallet';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { resolveCommunityAccess, appVisibleTo, memberIdentity } from '@/lib/community-apps/access';

export const dynamic = 'force-dynamic';

const KEY = /^[A-Za-z0-9_.:-]{1,80}$/;
const MAX_VALUE_BYTES = 8192;
const MAX_ENTRIES = 5000;

type Ctx = { params: Promise<{ id: string; appId: string }> };

async function load(req: NextRequest, ctx: Ctx) {
  const auth = await requireWallet(req);
  if (auth.errorResponse) return { error: auth.errorResponse };
  const { id, appId } = await ctx.params;
  const access = await resolveCommunityAccess(id, auth.walletAddress);
  if (!access || !access.canView) return { error: NextResponse.json({ error: 'Community not found' }, { status: 404 }) };
  const app = await (prisma as any).communityApp.findFirst({
    where: { id: appId, communityId: id },
    select: { id: true, title: true, status: true, version: true, creatorAddress: true },
  });
  if (!app || !appVisibleTo(app, access)) return { error: NextResponse.json({ error: 'App not found' }, { status: 404 }) };
  return { access, app };
}

/**
 * GET ?since=<ISO>  entries changed at or after `since` (all of them without
 * it), plus the caller's context. Member entries carry the member's app
 * identity, never the address. Deleted entries come back with value null.
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const r = await load(req, ctx);
  if ('error' in r) return r.error;
  const { access, app } = r;
  const communityId = access.community.id;

  const sinceRaw = req.nextUrl.searchParams.get('since');
  const since = sinceRaw && !Number.isNaN(Date.parse(sinceRaw)) ? new Date(sinceRaw) : null;

  const rows = await (prisma as any).communityAppEntry.findMany({
    where: { appId: app.id, ...(since ? { updatedAt: { gte: since } } : {}) },
    orderBy: { updatedAt: 'asc' },
    take: MAX_ENTRIES,
    select: { scope: true, key: true, value: true, updatedBy: true, updatedAt: true },
  });

  const entries = rows.map((e: any) => {
    const shared = e.scope === 'shared';
    const owner = shared ? e.updatedBy : e.scope;
    return {
      scope: shared ? 'shared' : 'member',
      key: e.key,
      value: e.value ?? null,
      at: e.updatedAt.toISOString(),
      by: memberIdentity(communityId, e.updatedBy),
      member: shared ? undefined : memberIdentity(communityId, owner),
      me: !shared && owner === access.caller,
    };
  });

  const cursor = rows.length ? rows[rows.length - 1].updatedAt.toISOString() : sinceRaw;
  const me = memberIdentity(communityId, access.caller);

  return NextResponse.json(
    {
      context: {
        me: { ...me, isAdmin: access.isAdmin, isCreator: app.creatorAddress.toLowerCase() === access.caller, isMember: access.isMember },
        community: { name: access.community.name },
        app: { id: app.id, title: app.title, version: app.version },
        preview: app.status !== 'published',
      },
      entries,
      cursor,
      full: !since,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

/** { scope: 'shared' | 'mine', key, value }  value null deletes. Members only. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const r = await load(req, ctx);
  if ('error' in r) return r.error;
  const { access, app } = r;
  if (!access.isMember) return NextResponse.json({ error: 'Join the community to use its apps.' }, { status: 403 });

  const rl = await checkRateLimit(access.caller, { max: 240, windowSec: 60, prefix: 'community-app-write' });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many changes in a minute. Wait a moment.' }, { status: 429 });

  const body = await req.json().catch(() => null);
  if (!body || (body.scope !== 'shared' && body.scope !== 'mine')) {
    return NextResponse.json({ error: 'scope must be shared or mine.' }, { status: 400 });
  }
  if (typeof body.key !== 'string' || !KEY.test(body.key)) {
    return NextResponse.json({ error: 'Keys are 1-80 characters: letters, digits, _ . : -' }, { status: 400 });
  }
  const value = body.value === undefined ? null : body.value;
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > MAX_VALUE_BYTES) {
    return NextResponse.json({ error: 'A value can be at most 8 KB.' }, { status: 413 });
  }

  const scope = body.scope === 'shared' ? 'shared' : access.caller;
  const where = { appId_scope_key: { appId: app.id, scope, key: body.key } };

  const exists = await (prisma as any).communityAppEntry.findUnique({ where, select: { id: true } });
  if (!exists) {
    if (value === null) return NextResponse.json({ ok: true });
    const count = await (prisma as any).communityAppEntry.count({ where: { appId: app.id } });
    if (count >= MAX_ENTRIES) return NextResponse.json({ error: 'This app has reached its storage limit.' }, { status: 409 });
  }

  const stored = value === null ? Prisma.DbNull : value;
  const row = await (prisma as any).communityAppEntry.upsert({
    where,
    create: { appId: app.id, scope, key: body.key, value: stored, updatedBy: access.caller },
    update: { value: stored, updatedBy: access.caller },
    select: { updatedAt: true },
  });
  return NextResponse.json({ ok: true, at: row.updatedAt.toISOString() });
}
