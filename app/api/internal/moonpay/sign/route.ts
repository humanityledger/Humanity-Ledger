import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    const secretKey = process.env.MOONPAY_SECRET_KEY;
    
    if (!secretKey) return NextResponse.json({ signedUrl: url });
    
    const urlObj = new URL(url);
    const signature = crypto.createHmac('sha256', secretKey)
      .update(urlObj.search)
      .digest('base64');
      
    urlObj.searchParams.set('signature', signature);
    
    return NextResponse.json({ signedUrl: urlObj.toString() });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
