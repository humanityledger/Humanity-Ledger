import { NextResponse } from 'next/server';
import { mevAgent } from '@/lib/services/execution/hft-mev-agent';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const anomalies = mevAgent.getLatestAnomalies();
        
        return NextResponse.json({
            success: true,
            anomalies
        });
    } catch (e) {
        return NextResponse.json({ success: false, error: 'MEV_ENGINE_FAULT' }, { status: 500 });
    }
}
