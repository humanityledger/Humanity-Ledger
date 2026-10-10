import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const session = await getSession();
        if (!session || !session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { guardians, threshold } = await req.json();

        const email = session.email;

        if (!email) return NextResponse.json({ error: 'Session email not found' }, { status: 400 });
        if (!guardians || !Array.isArray(guardians) || guardians.length === 0) {
            return NextResponse.json({ error: 'Guardians array is required' }, { status: 400 });
        }

        // SocialRecovery schema: unique key = `userEmail`, fields = `threshold`, `delayHours`, `active`
        // (no userId, no totalGuardians, no status field)
        const recovery = await prisma.socialRecovery.upsert({
            where: { userEmail: email },
            update: {
                threshold: parseInt(threshold),
                active: true
            },
            create: {
                userEmail: email,
                threshold: parseInt(threshold),
                active: true
            }
        });

        // Guardian schema: `userEmail`, `guardianAddress`, `threshold`, `isActive`
        // unique: [userEmail, guardianAddress]
        // No recoveryId, no status, no email field
        for (const guardianAddress of guardians) {
            await prisma.guardian.upsert({
                where: {
                    userEmail_guardianAddress: {
                        userEmail: email,
                        guardianAddress
                    }
                },
                update: { isActive: true },
                create: {
                    userEmail: email,
                    guardianAddress,
                    threshold: parseInt(threshold),
                    isActive: true
                }
            });
        }

        return NextResponse.json({ success: true, recovery });

    } catch (error: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
