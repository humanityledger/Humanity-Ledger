import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWallet } from '@/lib/security/requireWallet';
import {
  resolveCommunityAccess, appSummary, appVisibleTo, MAX_PUBLISHED_APPS,
} from '@/lib/community-apps/access';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string; appId: string }> };

async function load(req: NextRequest, ctx: Ctx) {
  const auth = await requireWallet(req);
  if (auth.errorResponse) return { error: auth.errorResponse };
  const { id, appId } = await ctx.params;
  const access = await resolveCommunityAccess(id, auth.walletAddress);
  if (!access || !access.canView) return { error: NextResponse.json({ error: 'Community not found' }, { status: 404 }) };
  const app = await (prisma as any).communityApp.findFirst({ where: { id: appId, communityId: id } });
  if (!app || !appVisibleTo(app, access)) return { error: NextResponse.json({ error: 'App not found' }, { status: 404 }) };
  return { access, app };
}

/** The app with its source, for "View code". */
export async function GET(req: NextRequest, ctx: Ctx) {
  const r = await load(req, ctx);
  if ('error' in r) return r.error;
  return NextResponse.json(
    { app: { ...appSummary(r.app, r.access), html: r.app.html, prompt: r.app.creatorAddress.toLowerCase() === r.access.caller ? r.app.prompt : undefined } },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

/** { action: 'publish' | 'unpublish' } or { title }. Creator only. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const r = await load(req, ctx);
  if ('error' in r) return r.error;
  const { access, app } = r;
  if (app.creatorAddress.toLowerCase() !== access.caller) {
    return NextResponse.json({ error: 'Only the person who made this app can change it.' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (body.action === 'publish') {
    if (!access.isMember) return NextResponse.json({ error: 'Join the community to publish apps.' }, { status: 403 });
    const published = await (prisma as any).communityApp.count({ where: { communityId: access.community.id, status: 'published' } });
    if (published >= MAX_PUBLISHED_APPS) {
      return NextResponse.json({ error: `This community already has ${published} apps. Remove one first.` }, { status: 409 });
    }
    data.status = 'published';
  } else if (body.action === 'unpublish') {
    data.status = 'draft';
  }
  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim().slice(0, 60);
  if (!Object.keys(data).length) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });

  const updated = await (prisma as any).communityApp.update({ where: { id: app.id }, data });
  return NextResponse.json({ app: appSummary(updated, access) });
}

/** Removes the app and all of its data. Creator, owner, admins, moderators. */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const r = await load(req, ctx);
  if ('error' in r) return r.error;
  const { access, app } = r;
  if (app.creatorAddress.toLowerCase() !== access.caller && !access.isAdmin) {
    return NextResponse.json({ error: 'Only the person who made this app or an admin can remove it.' }, { status: 403 });
  }
  await (prisma as any).communityApp.delete({ where: { id: app.id } });
  return NextResponse.json({ ok: true });
}
