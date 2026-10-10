import { getSession } from '@/lib/session';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function PUT(req: Request, { params }: { params: Promise<{ address: string }> }) {
    const session = await getSession();
    if (!session?.userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized: Authentication required.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    try {
        const { address } = await params;
        const cookieStore = await cookies();
        const sessionToken = cookieStore.get('human_session')?.value;
        if (!sessionToken) {
            return NextResponse.json({ error: 'Unauthorized: missing secure session' }, { status: 401 });
        }

        let sessionAddress = '';
        try {
            const { verifyJWT } = await import('@/lib/jwt');
            const payload = await verifyJWT(sessionToken);
            sessionAddress = (payload.sub || payload.address) as string;
        } catch (e) {
            return NextResponse.json({ error: 'Unauthorized: invalid secure session' }, { status: 401 });
        }

        if (!sessionAddress || sessionAddress.toLowerCase() !== address.toLowerCase()) {
            return NextResponse.json({ error: 'Unauthorized: session mismatch' }, { status: 401 });
        }

        const body = await req.json();
        const { displayName, avatarUrl, bio } = body;

        // Ensure user exists and select only ID to prevent schema crash on missing remote columns
        const user = await prisma.user.findUnique({ 
            where: { walletAddress: sessionAddress },
            select: { id: true }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        try {
            const updatedUser = await (prisma as any).user.update({
                where: { id: user.id },
                data: {
                    displayName: displayName !== undefined ? displayName : undefined,
                    avatarUrl: avatarUrl !== undefined ? avatarUrl : undefined,
                    bio: bio !== undefined ? bio : undefined
                },
                select: {
                    id: true,
                    walletAddress: true,
                    displayName: true,
                    avatarUrl: true,
                    bio: true
                }
            });
            return NextResponse.json({ success: true, user: updatedUser });
        } catch (updateError: any) {
            console.warn('[API] Full profile update failed, attempting minimal fallback:', updateError.message);
            // Fallback for missing avatarUrl or bio columns
            const fallbackUser = await prisma.user.update({
                where: { id: user.id },
                data: {
                    displayName: displayName !== undefined ? displayName : undefined
                },
                select: {
                    id: true,
                    walletAddress: true,
                    displayName: true
                }
            });
            return NextResponse.json({ success: true, user: fallbackUser, warning: 'Partial save due to schema version' });
        }
    } catch (e: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
