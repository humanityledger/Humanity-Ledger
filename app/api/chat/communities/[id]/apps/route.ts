import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWallet } from '@/lib/security/requireWallet';
import {
  resolveCommunityAccess, appSummary, MAX_DRAFTS_PER_MEMBER,
} from '@/lib/community-apps/access';
import { APP_TEMPLATES, findTemplate } from '@/lib/community-apps/templates';
import { generationConfigured } from '@/lib/community-apps/generate';

export const dynamic = 'force-dynamic';

/**
 * GET  the community's published apps, the caller's drafts, the built-in
 *      templates and whether apps can be written from a description here.
 * POST { templateId } adds a built-in app as a draft of the caller's.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWallet(req);
  if (auth.errorResponse) return auth.errorResponse;
  const { id } = await params;
  const access = await resolveCommunityAccess(id, auth.walletAddress);
  if (!access || !access.canView) return NextResponse.json({ error: 'Community not found' }, { status: 404 });

  const apps = await (prisma as any).communityApp.findMany({
    where: {
      communityId: id,
      OR: [{ status: 'published' }, { status: 'draft', creatorAddress: access.caller }],
    },
    orderBy: [{ status: 'desc' }, { updatedAt: 'desc' }],
    select: {
      id: true, title: true, summary: true, status: true, version: true, source: true, templateId: true,
      creatorAddress: true, createdAt: true, updatedAt: true,
    },
    take: 100,
  });

  return NextResponse.json(
    {
      apps: apps.map((a: any) => appSummary(a, access)),
      templates: APP_TEMPLATES.map(t => ({ id: t.id, title: t.title, summary: t.summary })),
      canCreate: access.isMember,
      canGenerate: access.isMember && generationConfigured(),
      generationConfigured: generationConfigured(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWallet(req);
  if (auth.errorResponse) return auth.errorResponse;
  const { id } = await params;
  const access = await resolveCommunityAccess(id, auth.walletAddress);
  if (!access || !access.canView) return NextResponse.json({ error: 'Community not found' }, { status: 404 });
  if (!access.isMember) return NextResponse.json({ error: 'Join the community to add apps.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const template = typeof body.templateId === 'string' ? findTemplate(body.templateId) : undefined;
  if (!template) return NextResponse.json({ error: 'Unknown template.' }, { status: 400 });
  const lang = body.lang === 'es' ? 'es' : 'en';

  const drafts = await (prisma as any).communityApp.count({
    where: { communityId: id, creatorAddress: access.caller, status: 'draft' },
  });
  if (drafts >= MAX_DRAFTS_PER_MEMBER) {
    return NextResponse.json({ error: `You have ${drafts} drafts here. Publish or delete one first.` }, { status: 409 });
  }

  const app = await (prisma as any).communityApp.create({
    data: {
      communityId: id,
      creatorAddress: access.caller,
      title: template.title[lang],
      summary: template.summary[lang],
      html: template.html,
      source: 'template',
      templateId: template.id,
      status: 'draft',
    },
  });
  return NextResponse.json({ app: appSummary(app, access) }, { status: 201 });
}
