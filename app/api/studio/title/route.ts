import { NextRequest, NextResponse } from 'next/server';
import { createStudioClient } from '@/lib/studio/client';
import { z } from 'zod';
import { requireWallet } from '@/lib/security/requireWallet';
import { estimateCostUsd, TITLE_MODEL } from '@/lib/studio/models';
import { cleanTitle, TITLE_PROMPT } from '@/lib/studio/prompt';
import { readUsage, recordUsage } from '@/lib/studio/metering';
import { checkRateLimit, getClientIP } from '@/lib/security/rateLimiter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ text: z.string().min(1).max(4_000) });

/** POST /api/studio/title — a short title for a new conversation (Haiku, metered). */
export async function POST(req: NextRequest) {
  const auth = await requireWallet(req);
  if (auth.errorResponse) return auth.errorResponse;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'NOT_CONFIGURED' }, { status: 503 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });

  const rl = await checkRateLimit(getClientIP(req), { max: 120, windowSec: 3600, prefix: 'rl:studio-title' });
  if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });

  const usage = await readUsage(auth.walletAddress);
  if (!usage.meteringAvailable) return NextResponse.json({ error: 'METERING_UNAVAILABLE' }, { status: 503 });
  if (usage.remainingTodayUsd <= 0 || usage.remainingMonthUsd <= 0 || usage.freeCapacityReached) {
    return NextResponse.json({ error: 'LIMIT_REACHED' }, { status: 429 });
  }

  try {
    const client = createStudioClient(apiKey, { maxRetries: 1, timeout: 20_000 });
    const msg = await client.messages.create({
      model: TITLE_MODEL,
      max_tokens: 30,
      system: TITLE_PROMPT,
      messages: [{ role: 'user', content: parsed.data.text }],
    });
    await recordUsage(auth.walletAddress, estimateCostUsd(TITLE_MODEL, msg.usage as any), (msg.usage.input_tokens ?? 0) + (msg.usage.output_tokens ?? 0), 0, usage.plan.id);
    const title = cleanTitle(msg.content.map(b => (b.type === 'text' ? b.text : '')).join(''));
    return NextResponse.json({ title: title || null });
  } catch {
    return NextResponse.json({ title: null });
  }
}
