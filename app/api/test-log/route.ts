import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
    if (!req.headers.get('x-verified-session-address')) return NextResponse.json({error: 'Unauthorized'}, {status: 401});
    const body = await req.json();
    const logPath = path.join(process.cwd(), 'xmtp-test.log');
    fs.appendFileSync(logPath, body.msg + '\n');
    console.log('[TEST]', body.msg);
    return NextResponse.json({ ok: true });
}
