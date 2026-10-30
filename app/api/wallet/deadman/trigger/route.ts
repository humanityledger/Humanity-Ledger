import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
    return NextResponse.json({
        error: '410 Gone: Server-side custodial dead man switch execution is decommissioned. Dead man switch inheritance is non-custodial and operates on-chain via LedgerDeadmanSwitch.sol on Polygon.',
    }, { status: 410 });
}

export async function GET() {
    return NextResponse.json({
        error: '410 Gone: Server-side custodial dead man switch execution is decommissioned. Dead man switch inheritance is non-custodial and operates on-chain via LedgerDeadmanSwitch.sol on Polygon.',
    }, { status: 410 });
}
