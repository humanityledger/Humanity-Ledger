import os
import glob

# Routes to decommission entirely (Centralized Chat & Telemetry)
DECOMMISSION_ROUTES = [
    'app/api/chat/community-posts/route.ts',
    'app/api/chat/pending/route.ts',
    'app/api/chat/queue/route.ts',
    'app/api/chat/queue/consume/route.ts',
    'app/api/session-logs/route.ts',
    'app/api/session-logs/sse/route.ts',
]

DECOMMISSION_CONTENT = """import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ error: '410 Gone: Protocol upgraded to True P2P (XMTP). Centralized storage is decommissioned.' }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({ error: '410 Gone: Protocol upgraded to True P2P (XMTP). Centralized storage is decommissioned.' }, { status: 410 });
}
"""

for route in DECOMMISSION_ROUTES:
    if os.path.exists(route):
        with open(route, 'w', encoding='utf-8') as f:
            f.write(DECOMMISSION_CONTENT)
        print(f"Decommissioned: {route}")

print("Backend API routes purged and decentralized.")
