import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey, logApiRequest } from '@/lib/api-guard';
import { createHash, randomBytes } from 'crypto';
import { checkWebhookUrl, parseIpWhitelist } from '@/lib/security/webhookTarget';

export const dynamic = 'force-dynamic';

/**
 * @api {post} /api/v1/user/keys/update Update API settings (HMAC/IP)
 * Private endpoint for key owners to configure security.
 */
export async function POST(req: NextRequest) {
  const endpoint = '/api/v1/user/keys/update';
  
  // Uses the key itself to authenticate or session (here we use the key)
  const auth = await validateApiKey(req);
  if (!auth.valid || !auth.subscription) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode || 401 });
  }

  try {
    const { subscription } = auth;
    const body = await req.json();
    const { webhookUrl, ipWhitelist, generateHmacSecret } = body;

    const updateData: any = { updatedAt: new Date() };

    if (webhookUrl !== undefined) {
      if (typeof webhookUrl !== 'string') {
        return NextResponse.json({ error: 'webhookUrl must be a string.' }, { status: 400 });
      }
      if (webhookUrl !== '') {
        const target = await checkWebhookUrl(webhookUrl);
        if (!target.ok) return NextResponse.json({ error: target.reason }, { status: 400 });
      }
      updateData.webhookUrl = webhookUrl;
    }

    if (ipWhitelist !== undefined) {
      const list = parseIpWhitelist(ipWhitelist);
      if (!list.ok) return NextResponse.json({ error: list.reason }, { status: 400 });
      updateData.ipWhitelist = list.value;
    }

    if (generateHmacSecret) {
      if (String(subscription.tier ?? '').toLowerCase() !== 'elite') {
        return NextResponse.json({ error: 'HMAC Signing is an Elite exclusive.' }, { status: 403 });
      }
      updateData.hmacSecret = randomBytes(32).toString('hex');
    }

    const updated = await (prisma as any).apiSubscription.update({
      where: { id: subscription.id },
      data: updateData,
    });

    await logApiRequest(req, subscription.id, endpoint, 200);

    return NextResponse.json({
      success: true,
      message: 'Elite settings updated.',
      settings: {
        webhookUrl: updated.webhookUrl,
        ipWhitelist: updated.ipWhitelist,
        hmac_secret: generateHmacSecret ? updated.hmacSecret : '********'
      }
    });

  } catch (error: any) {
    console.error('[SETTINGS API] Error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}

