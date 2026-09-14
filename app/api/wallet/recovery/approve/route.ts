import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/wallet/recovery/approve
 * 
 * This route is used by Guardians to approve a recovery request.
 * In a real scenario, this would be hit via a link in an email.
 */
export async function POST(req: Request) {
    try {
        const { recoveryId, email, signature } = await req.json();

        if (!recoveryId || !email) {
            return NextResponse.json({ error: 'Missing recoveryId or email' }, { status: 400 });
        }

        // Validate recoveryId is UUID format to prevent path injection
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!UUID_REGEX.test(recoveryId)) {
            return NextResponse.json({ error: 'Invalid recovery ID format' }, { status: 400 });
        }

        // Validate email format
        const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!EMAIL_REGEX.test(email)) {
            return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
        }

        // 1. Find the guardian
        const guardian = await (prisma as any).guardian.findUnique({
            where: {
                recoveryId_email: {
                    recoveryId,
                    email
                }
            }
        });

        if (!guardian) {
            return NextResponse.json({ error: 'Guardian not found' }, { status: 404 });
        }

        // 2. Mark as approved
        await (prisma as any).guardian.update({
            where: { id: guardian.id },
            data: {
                hasApproved: true,
                approvedAt: new Date(),
                status: 'VERIFIED'
            }
        });

        // 3. Check if threshold is reached
        const recovery = await (prisma as any).socialRecovery.findUnique({
            where: { id: recoveryId },
            include: { guardians: true }
        });

        if (recovery) {
            const approvedCount = recovery.guardians.filter((g: any) => g.hasApproved).length;
            
            if (approvedCount >= recovery.threshold) {
                await (prisma as any).socialRecovery.update({
                    where: { id: recoveryId },
                    data: { status: 'RECOVERED' }
                });
                
                return NextResponse.json({ 
                    success: true, 
                    message: 'Threshold met! Recovery successful.',
                    thresholdMet: true
                });
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: 'Approval recorded.',
            thresholdMet: false
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

