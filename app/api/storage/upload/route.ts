import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const wallet = (formData.get('wallet') as string || 'anon').toLowerCase();

    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    const accountId = process.env.R2_ACCOUNT_ID;
    const r2Bucket = process.env.R2_BUCKET_NAME;
    const r2AccessKey = process.env.R2_ACCESS_KEY_ID;
    const r2SecretKey = process.env.R2_SECRET_ACCESS_KEY;
    const r2PublicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

    if (!accountId || !r2Bucket || !r2AccessKey || !r2SecretKey) {
      return NextResponse.json({ error: 'R2 not configured' }, { status: 503 });
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
    const ext = file.name.split('.').pop() || 'bin';
    const key = `attachments/${wallet.slice(2, 10)}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;

    await s3.send(new PutObjectCommand({
      Bucket: r2Bucket,
      Key: key,
      Body: Buffer.from(bytes),
      ContentType: file.type,
    }));

    const publicUrl = `${r2PublicUrl}/${key}`;
    return NextResponse.json({ url: publicUrl, key });
  } catch (e) {
    console.error('[storage/upload]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
