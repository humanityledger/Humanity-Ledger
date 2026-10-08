import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
    try {
        const session = await getSession();
        if (!session || !session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const email = session.email;

        // SocialRecovery unique key is `userEmail`, NO relation from AuthUser to SocialRecovery
        const recovery = await prisma.socialRecovery.findUnique({
            where: { userEmail: email }
        });

        if (!recovery) {
            return NextResponse.json({ guardians: [], threshold: 2 });
        }

        // Guardian: unique by [userEmail, guardianAddress], query by userEmail
        const guardians = await prisma.guardian.findMany({
            where: { userEmail: email }
        });

        return NextResponse.json({
            guardians: guardians.map((g) => g.guardianAddress),
            threshold: recovery.threshold,
            active: recovery.active
        });

    } catch (error: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
