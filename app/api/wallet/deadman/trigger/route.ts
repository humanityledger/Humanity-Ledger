import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// The server never executes a dead man switch. LedgerDeadmanSwitch.sol is not deployed on any
// network (no address is recorded) and is out of the deploy script (operator decision B-3c,
// 18 November 2026). This text used to say it operated on Polygon, which no record supports.
const GONE =
    '410 Gone: server-side dead man switch execution is decommissioned. Ledger Chat runs no dead man switch today: the LedgerDeadmanSwitch contract is not deployed on any network.';

export async function POST() {
    return NextResponse.json({
        error: GONE,
    }, { status: 410 });
}

export async function GET() {
    return NextResponse.json({
        error: GONE,
    }, { status: 410 });
}
