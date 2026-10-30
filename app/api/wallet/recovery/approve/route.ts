import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
    return NextResponse.json({
        error: '410 Gone: Centralized server-side recovery approval is decommissioned. Social recovery is handled non-custodially on-chain via HumanityTimeLockVault.sol.',
    }, { status: 410 });
}

export async function GET() {
    return NextResponse.json({
        error: '410 Gone: Centralized server-side recovery approval is decommissioned. Social recovery is handled non-custodially on-chain via HumanityTimeLockVault.sol.',
    }, { status: 410 });
}
