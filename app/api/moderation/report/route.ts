import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedCaller } from '@/lib/security/verifiedCaller';
import { checkRateLimit } from '@/lib/security/rateLimiter';

/**
 * POST /api/moderation/report
 * ───────────────────────────────────────────────────────────────
 * Receives abuse reports from Ledger Chat.
 *
 * - Escalates a message once 3 DIFFERENT people have reported it. Before,
 *   the count included repeat reports, so one account could escalate any
 *   message on its own by reporting it three times.
 * - One report per person and message; reports are rate limited.
 * - Notifies the admin webhook (MODERATION_WEBHOOK_URL) when it escalates.
 */
const ESCALATE_AT = 3;
const HASH_RE = /^[A-Za-z0-9:_\-./+=]{8,200}$/;
const REASON_MAX = 200;

export async function POST(req: NextRequest) {
  try {
    const reporterAddress = await getVerifiedCaller(req);
    if (!reporterAddress) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = await checkRateLimit(reporterAddress, { max: 20, windowSec: 3600, prefix: 'rl:mod-report' });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many reports. Try again later.' }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const { messageHash, timestamp, reason, reportedAddress } = body ?? {};

    if (typeof messageHash !== 'string' || !HASH_RE.test(messageHash)) {
      return NextResponse.json({ error: 'Missing or invalid message hash' }, { status: 400 });
    }
    const when = typeof timestamp === 'number' || typeof timestamp === 'string' ? new Date(timestamp) : new Date();
    const safeWhen = Number.isNaN(when.getTime()) ? new Date() : when;
    const safeReason = typeof reason === 'string' ? reason.slice(0, REASON_MAX) : 'Not specified';
    const safeReported = typeof reportedAddress === 'string' && /^0x[0-9a-fA-F]{40,64}$/.test(reportedAddress) ? reportedAddress.toLowerCase() : 'unknown';

    // One report per person per message.
    const already = await prisma.moderationReport.findFirst({
      where: { messageHash, reporterAddress },
      select: { id: true },
    });
    if (!already) {
      await prisma.moderationReport.create({
        data: { reporterAddress, messageHash, timestamp: safeWhen, status: 'PENDING' },
      });
    }

    const reporters = await prisma.moderationReport.findMany({
      where: { messageHash },
      select: { reporterAddress: true, status: true },
      distinct: ['reporterAddress'],
      take: 50,
    });
    const reportCount = reporters.length;
    const wasEscalated = reporters.some(r => r.status === 'ESCALATED');

    let autoAction: string | null = null;
    if (reportCount >= ESCALATE_AT) {
      autoAction = 'ESCALATED';
      if (!wasEscalated) {
        await prisma.moderationReport.updateMany({ where: { messageHash }, data: { status: 'ESCALATED' } });
        const webhookUrl = process.env.MODERATION_WEBHOOK_URL;
        if (webhookUrl) {
          try {
            await fetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event: 'MESSAGE_ESCALATED',
                messageHash,
                reportCount,
                reportedAddress: safeReported,
                reason: safeReason,
                timestamp: new Date().toISOString(),
              }),
              signal: AbortSignal.timeout(5_000),
            });
          } catch (webhookErr) {
            console.warn('[Moderation] Webhook notify failed:', webhookErr);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Report submitted. Our moderation team will review it.',
      autoAction,
      reportCount,
    });
  } catch (error) {
    console.error('[Moderation Report Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
