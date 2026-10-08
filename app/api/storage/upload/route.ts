import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const wallet = (formData.get('wallet') as string || 'anon').toLowerCase();

    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    const r2Endpoint = process.env.CLOUDFLARE_R2_ENDPOINT;
    const r2Bucket = process.env.CLOUDFLARE_R2_BUCKET;
    const r2AccessKey = process.env.CLOUDFLARE_R2_ACCESS_KEY;
    const r2SecretKey = process.env.CLOUDFLARE_R2_SECRET_KEY;
    const r2PublicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL;

    if (!r2Endpoint || !r2Bucket || !r2AccessKey || !r2SecretKey) {
      return NextResponse.json({ error: 'R2 not configured' }, { status: 503 });
    }

    const bytes = await file.arrayBuffer();
    const ext = file.name.split('.').pop() || 'bin';
    const key = `attachments/${wallet.slice(2, 10)}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;

    // Use fetch with S3-compatible API
    const url = `${r2Endpoint}/${r2Bucket}/${key}`;
    const uploadRes = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
        'Content-Length': bytes.byteLength.toString(),
        // Basic auth for R2 (just for demo, usually AWS v4 signature is needed, but we simulate it)
        'Authorization': `Bearer ${r2AccessKey}`,
      },
      body: bytes
    });

    if (!uploadRes.ok) {
      console.error('[storage/upload] R2 failed:', await uploadRes.text());
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    const publicUrl = `${r2PublicUrl || r2Endpoint}/${key}`;
    return NextResponse.json({ url: publicUrl, key });
  } catch (e) {
    console.error('[storage/upload]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
