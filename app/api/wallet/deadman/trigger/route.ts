import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/wallet/deadman/trigger
 * 
 * SYSTEM ROUTE: Should be called by a cron job (e.g. Vercel Cron or GitHub Actions)
 * This route checks for expired Dead Man's Switches and initiates the fund recovery process.
 */
export async function POST(req: Request) {
    try {
        // [SECURITY] Mandatory Cron Secret Check
        const authHeader = req.headers.get('authorization');
        if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const now = new Date();
        
        // 1. Find all active switches that have expired
        // Formula: lastPing + (inactivityPeriod * 30 days) < now
        const activeSwitches = await prisma.deadMansSwitch.findMany({
            where: {
                active: true
            }
        });

        const expiredSwitches = activeSwitches.filter(sw => {
            const expiryDate = new Date(sw.lastPing);
            expiryDate.setMonth(expiryDate.getMonth() + sw.inactivityPeriod);
            return expiryDate < now;
        });

        const results = [];

        for (const sw of expiredSwitches) {
            try {
                // 2. Mark as EXPIRED/EXECUTING
                // Setting active to false is equivalent to 'TRIGGERED'/'EXECUTING' in this schema
                await prisma.deadMansSwitch.update({
                    where: { id: sw.id },
                    data: { active: false }
                });

                // 3. Logic to execute the transfer via GetBlock RPC
                // We halt the process here while Awaiting GetBlock integration. 
                // We strictly forbid writing fake 'EXECUTED' statuses or synthetic execution hashes.

                results.push({
                    userAddress: sw.userAddress,
                    beneficiary: sw.beneficiary,
                    status: 'PENDING_GETBLOCK_EXECUTION',
                    txHash: null
                });

            } catch (err: any) {
                results.push({
                    userAddress: sw.userAddress,
                    status: 'FAILED',
                    error: err.message
                });
            }
        }

        return NextResponse.json({
            processed: activeSwitches.length,
            expired: expiredSwitches.length,
            details: results
        });

    } catch (error: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

