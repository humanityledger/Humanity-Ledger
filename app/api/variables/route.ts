import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encryptValue, decryptValue } from '@/lib/crypto';

export async function GET(req: Request) {
  try {
    // [SECURITY] A-026: Accept ONLY the header set by the session middleware.
    // The previous code fell back to searchParams.get('wallet') and then the
    // self-comparison guard on line 9 only fired if the header was also present,
    // so a caller with no session cookie could pass their own wallet via query
    // string and read that wallet's variables (IDOR).
    const wallet = req.headers.get('x-verified-session-address');

    if (!wallet) return NextResponse.json([], { status: 401 });

    const variables = await (prisma as any).variable.findMany({
      where: { userId: wallet },
      orderBy: { updatedAt: 'desc' }
    });

    // Decrypt all values before returning to the client
    const decrypted = await Promise.all(
      variables.map(async (v: any) => ({
        ...v,
        value: await decryptValue(v.value)
      }))
    );

    return NextResponse.json(decrypted);
  } catch (error) {
    console.error('[VARIABLES_GET]', error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { key, value, description } = body;
    const wallet = req.headers.get('x-verified-session-address');

    if (!key || !value || !wallet) {
      return new NextResponse("Key, Value, and Wallet identity are required", { status: 400 });
    }

    try {
        await prisma.user.upsert({
            where: { walletAddress: wallet },
            update: { lastActive: new Date() },
            create: { walletAddress: wallet, tier: 'GHOST' }
        });
    } catch(e) {}

    // Encrypt the value before persisting to PostgreSQL
    const encryptedValue = await encryptValue(value);

    const variable = await (prisma as any).variable.upsert({
      where: { userId_key: { userId: wallet, key } },
      update: { value: encryptedValue, description },
      create: { userId: wallet, key, value: encryptedValue, description }
    });

    // Return the decrypted version to the UI (don't expose ciphertext)
    return NextResponse.json({ ...variable, value });
  } catch (error) {
    console.error('[VARIABLES_POST]', error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
