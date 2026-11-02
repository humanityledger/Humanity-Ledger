import { NextRequest, NextResponse } from 'next/server';
import { sendSupportEmail } from '@/lib/email';
import { getVerifiedCaller } from '@/lib/security/verifiedCaller';
import { checkRateLimit, getClientIP } from '@/lib/security/rateLimiter';

/**
 * POST /api/support — forwards the support form to the team inbox.
 *
 * Every field is typed and bounded (a non-string `section` used to crash the
 * handler), callers are rate limited so the inbox and the email quota cannot
 * be flooded, and the email provider's own error text is no longer returned
 * (it described our configuration). lib/email.ts escapes the fields.
 */
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function POST(req: NextRequest) {
    const caller = await getVerifiedCaller(req);
    const rl = await checkRateLimit(caller ?? getClientIP(req), { max: 5, windowSec: 3600, prefix: 'rl:support' });
    if (!rl.allowed) {
        return NextResponse.json({ error: 'Too many messages. Please try again later.' }, { status: 429 });
    }

    try {
        const body = await req.json().catch(() => ({}));
        const message = str(body?.message, 5000);
        const name = str(body?.name, 100);
        const email = str(body?.email, 254);
        const section = str(body?.section, 40) || str(body?.category, 40) || 'general';

        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        await sendSupportEmail(message, section, email || undefined, name || undefined);
        return NextResponse.json({ success: true, message: 'Message forwarded successfully' });
    } catch (error: any) {
        console.error('[API] Support route error:', error?.message);
        return NextResponse.json({ error: 'Your message could not be sent. Please try again later.' }, { status: 500 });
    }
}
