import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWallet } from '@/lib/security/requireWallet';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { resolveCommunityAccess, appSummary, MAX_DRAFTS_PER_MEMBER } from '@/lib/community-apps/access';
import {
  generateApp, GenerationFailedError, GenerationUnavailableError,
} from '@/lib/community-apps/generate';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_REQUEST = 2000;

/**
 * POST { request, appId?, runtimeError? }
 *
 * Without appId: writes a new app from the description and stores it as the
 * caller's draft. With appId: revises one of the caller's own apps in place
 * and bumps its version; its data is kept.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWallet(req);
  if (auth.errorResponse) return auth.errorResponse;
  const { id } = await params;
  const access = await resolveCommunityAccess(id, auth.walletAddress);
  if (!access || !access.canView) return NextResponse.json({ error: 'Community not found' }, { status: 404 });
  if (!access.isMember) return NextResponse.json({ error: 'Join the community to create apps.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const request = typeof body.request === 'string' ? body.request.trim() : '';
  if (request.length < 8) return NextResponse.json({ error: 'Describe the app in a sentence or more.' }, { status: 400 });
  if (request.length > MAX_REQUEST) return NextResponse.json({ error: `Keep the description under ${MAX_REQUEST} characters.` }, { status: 400 });

  let existing: any = null;
  if (typeof body.appId === 'string' && body.appId) {
    existing = await (prisma as any).communityApp.findFirst({ where: { id: body.appId, communityId: id } });
    if (!existing || existing.creatorAddress.toLowerCase() !== access.caller) {
      return NextResponse.json({ error: 'Only the person who made this app can change it.' }, { status: 403 });
    }
  } else {
    const drafts = await (prisma as any).communityApp.count({
      where: { communityId: id, creatorAddress: access.caller, status: 'draft' },
    });
    if (drafts >= MAX_DRAFTS_PER_MEMBER) {
      return NextResponse.json({ error: `You have ${drafts} drafts here. Publish or delete one first.` }, { status: 409 });
    }
  }

  const rl = await checkRateLimit(access.caller, { max: 15, windowSec: 3600, prefix: 'community-app-gen' });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'You have written 15 apps in the last hour. Try again later.' }, { status: 429 });
  }

  try {
    const result = await generateApp({
      request,
      communityName: access.community.name,
      current: existing ? { title: existing.title, html: existing.html } : undefined,
      runtimeError: typeof body.runtimeError === 'string' ? body.runtimeError : undefined,
    });

    const app = existing
      ? await (prisma as any).communityApp.update({
          where: { id: existing.id },
          data: {
            html: result.html,
            summary: result.summary || existing.summary,
            prompt: `${existing.prompt}\n\n${request}`.trim().slice(-8000),
            version: { increment: 1 },
            source: 'model',
          },
        })
      : await (prisma as any).communityApp.create({
          data: {
            communityId: id,
            creatorAddress: access.caller,
            title: result.title,
            summary: result.summary,
            prompt: request,
            html: result.html,
            source: 'model',
            status: 'draft',
          },
        });

    return NextResponse.json({ app: appSummary(app, access) }, { status: existing ? 200 : 201 });
  } catch (e: any) {
    if (e instanceof GenerationUnavailableError) {
      return NextResponse.json({ error: e.message, code: 'NOT_CONFIGURED' }, { status: 503 });
    }
    if (e instanceof GenerationFailedError) {
      return NextResponse.json({ error: e.message, problems: e.problems }, { status: 502 });
    }
    console.error('[community apps generate]', e);
    return NextResponse.json({ error: 'The app could not be written. Try again.' }, { status: 500 });
  }
}
