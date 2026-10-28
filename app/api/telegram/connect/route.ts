import { NextRequest, NextResponse } from 'next/server';
import { requireWallet } from '@/lib/security/requireWallet';
import { prisma } from '@/lib/prisma';
import rateLimit from '@/lib/rate-limit';
import { getClientIP } from '@/lib/security/rateLimiter';
/**
 * FASE 7  ALERTAS TELEGRAM REALES
 * El usuario guarda su Chat ID y el servidor envía mensajes reales
 * usando el TELEGRAM_BOT_TOKEN ya configurado en Railway.
 * 
 * Flujo:
 *   1. Usuario abre @userinfobot en Telegram  obtiene su Chat ID
 *   2. Lo pega en el panel y pulsa "ACTIVAR"
 *   3. El servidor guarda el Chat ID en Prisma (tabla TelegramAlert)
 *   4. Cada vez que una señal EV == 'OVERSOLD' o APY supera el umbral,
 *      el cron llama a Telegram sendMessage con los datos reales.
 */


export const runtime = 'nodejs';


const limiter = rateLimit({ interval: 60_000 });
// RATE_LIMIT_MAX is 3 in the route handler
export async function GET(req: NextRequest) {
    const wallet = req.nextUrl.searchParams.get('wallet');
    if (!wallet) return NextResponse.json({ configured: false });
    // Only the owner may read their alert settings.
    const __auth = await requireWallet(req);
    if (__auth.errorResponse) return __auth.errorResponse;
    if (wallet.toLowerCase() !== __auth.walletAddress) {
        return NextResponse.json({ error: 'You can only read this for your own wallet.' }, { status: 403 });
    }

    try {
        const record = await (prisma as any).telegramAlert.findUnique({
            where: { walletAddress: wallet.toLowerCase() }
        });
        return NextResponse.json({
            configured: !!record,
            chatId: record?.chatId ? `${String(record.chatId).slice(0, 3)}***` : null,
            minApy: record?.minApy ?? 20,
            evSignals: record?.evSignals ?? true,
        });
    } catch (_err) {
        return NextResponse.json({ configured: false });
    }
}

// 
// POST /api/telegram/connect
// Body: { wallet, chatId, minApy, evSignals }
// 
export async function POST(req: NextRequest) {
    try {
        //  Rate Limit check 
        const ip = getClientIP(req);
        try {
            await limiter.check(3, ip);
        } catch {
            return NextResponse.json(
                { error: 'Too many requests. Please wait 60 seconds before retrying.' },
                { status: 429, headers: { 'Retry-After': '60' } }
            );
        }

        const body = await req.json();
        const { wallet, chatId: rawChatId } = body;
        // These values are written into an HTML message sent by our bot, so they
        // are coerced: minApy was interpolated as-is, letting anyone make the
        // official bot send their own links and markup to any chat.
        const minApy = Math.min(1000, Math.max(0, Number(body.minApy ?? 20) || 0));
        const evSignals = body.evSignals !== false;
        const chatId = typeof rawChatId === 'string' || typeof rawChatId === 'number' ? String(rawChatId).trim() : '';
        if (chatId && !/^-?\d{1,20}$/.test(chatId)) {
            return NextResponse.json({ error: 'Chat ID inválido' }, { status: 400 });
        }
        // The wallet used to be taken from the body as-is: anyone signed in could
        // change this for any other wallet. It must be the caller's own.
        const __auth = await requireWallet(req);
        if (__auth.errorResponse) return __auth.errorResponse;
        if (typeof wallet !== 'string' || wallet.toLowerCase() !== __auth.walletAddress) {
          return NextResponse.json({ error: 'You can only change this for your own wallet.' }, { status: 403 });
        }

        if (!wallet || !chatId) {
            return NextResponse.json({ error: 'wallet y chatId son requeridos' }, { status: 400 });
        }

        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
            return NextResponse.json({ error: 'Bot no configurado en el servidor' }, { status: 503 });
        }

        // Verify the chat ID is real by sending a test message
        const testRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                parse_mode: 'HTML',
                text: [
                    ' <b>Private INTELLIGENCE TERMINAL</b>',
                    '',
                    ' Alertas activadas correctamente.',
                    '',
                    ` <b>Configuración:</b>`,
                    ` APY mínimo para alertas: <code>${minApy}%</code>`,
                    ` Señales EV Polymarket: ${evSignals ? 'ACTIVADAS' : 'DESACTIVADAS'}`,
                    '',
                    ' Recibirás notificaciones cuando aparezcan oportunidades reales de mercado.',
                ].join('\n'),
            })
        });

        const testData = await testRes.json();
        if (!testData.ok) {
            return NextResponse.json({ error: `Chat ID inválido: ${testData.description}` }, { status: 400 });
        }

        // Upsert the record in Prisma
        await (prisma as any).telegramAlert.upsert({
            where:  { walletAddress: wallet.toLowerCase() },
            create: { walletAddress: wallet.toLowerCase(), chatId: String(chatId), minApy, evSignals },
            update: { chatId: String(chatId), minApy, evSignals, updatedAt: new Date() },
        });

        return NextResponse.json({ ok: true, message: 'Alertas de Telegram configuradas correctamente.' });

    } catch (err: any) {
        console.error('[TELEGRAM_CONNECT]', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

// 
// DELETE /api/telegram/connect
// Body: { wallet }
// Removes alert configuration
// 
export async function DELETE(req: NextRequest) {
    try {
        const { wallet } = await req.json();
        // The wallet used to be taken from the body as-is: anyone signed in could
        // change this for any other wallet. It must be the caller's own.
        const __auth = await requireWallet(req);
        if (__auth.errorResponse) return __auth.errorResponse;
        if (typeof wallet !== 'string' || wallet.toLowerCase() !== __auth.walletAddress) {
          return NextResponse.json({ error: 'You can only change this for your own wallet.' }, { status: 403 });
        }
        if (!wallet) return NextResponse.json({ error: 'wallet requerido' }, { status: 400 });

        await (prisma as any).telegramAlert.deleteMany({
            where: { walletAddress: wallet.toLowerCase() }
        });

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

// 
// Exported helper: send a real Telegram message
// Used by cron jobs and signal processors
// 
async function sendTelegramAlert(chatId: string, message: string): Promise<boolean> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return false;

    try {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, parse_mode: 'HTML', text: message, disable_web_page_preview: true }),
        });
        const data = await res.json();
        return data.ok;
    } catch (_err) {
        return false;
    }
}
