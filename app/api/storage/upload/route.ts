import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { requireWallet } from '@/lib/security/requireWallet';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX_BYTES = 20 * 1024 * 1024;

// Only inert file types. No svg, html or scripts, so nothing uploaded here can
// run in the browser of whoever opens the link.
const ALLOWED: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/wav': 'wav',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

export async function POST(req: NextRequest) {
  // The uploader is the signed in wallet. Nothing from the form is trusted.
  const auth = await requireWallet(req);
  if (auth.errorResponse) return auth.errorResponse;
  const wallet = auth.walletAddress;

  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) return NextResponse.json({ error: 'No file' }, { status: 400 });
    if (file.size === 0) return NextResponse.json({ error: 'Empty file' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File is too large (20 MB maximum)' }, { status: 413 });

    const mime = (file.type || '').split(';')[0].trim().toLowerCase();
    const ext = ALLOWED[mime];
    if (!ext) return NextResponse.json({ error: 'This file type is not allowed' }, { status: 415 });

    const accountId = process.env.R2_ACCOUNT_ID;
    const r2Bucket = process.env.R2_BUCKET_NAME;
    const r2AccessKey = process.env.R2_ACCESS_KEY_ID;
    const r2SecretKey = process.env.R2_SECRET_ACCESS_KEY;
    const r2PublicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

    if (!accountId || !r2Bucket || !r2AccessKey || !r2SecretKey || !r2PublicUrl) {
      return NextResponse.json({ error: 'File storage is not configured' }, { status: 503 });
    }

    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: r2AccessKey,
        secretAccessKey: r2SecretKey,
      },
    });

    const bytes = await file.arrayBuffer();
    const key = `attachments/${wallet.slice(2, 10)}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;

    await s3.send(new PutObjectCommand({
      Bucket: r2Bucket,
      Key: key,
      Body: Buffer.from(bytes),
      ContentType: mime,
      CacheControl: 'private, max-age=31536000, immutable',
    }));

    return NextResponse.json({ url: `${r2PublicUrl}/${key}`, key });
  } catch (e) {
    console.error('[storage/upload]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
