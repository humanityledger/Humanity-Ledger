import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Uhrp } from '@/lib/vault/uhrp';

// Secure Garbage Collector API: Pushes stale data to the Local System Vault
// and instantly purges it from Railway's cloud DB to save space.
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { payload_type } = body;

        const vaultUrl = process.env.Private_VAULT_URL;
        const vaultSecret = process.env.Private_VAULT_SECRET;

        if (!vaultSecret) {
            console.error('[VaultSync] Private_VAULT_SECRET env var not set — blocking request');
            return NextResponse.json({ error: 'Vault not configured' }, { status: 500 });
        }

        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${vaultSecret}`) {
            return NextResponse.json({ error: 'Unauthorized Vault Access' }, { status: 401 });
        }

        if (!vaultUrl) {
            return NextResponse.json({ error: 'Private_VAULT_URL not configured.' }, { status: 500 });
        }

        let dataToArchive: any[] = [];
        let archivedIds: string[] = [];

        // Determine what to archive based on payload_type
        if (payload_type === 'security_events') {
            // Fetch security events older than 7 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 7);
            
            dataToArchive = await prisma.securityEvent.findMany({
                where: { timestamp: { lt: thirtyDaysAgo } },
                take: 1000 // Batch limit to prevent memory spikes
            });
            archivedIds = dataToArchive.map(event => event.id);

        } else if (payload_type === 'intel_items') {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            dataToArchive = await prisma.intelItem.findMany({
                where: { createdAt: { lt: thirtyDaysAgo } },
                take: 1000
            });
            archivedIds = dataToArchive.map(item => item.id);
        } else if (payload_type === 'custom_payload') {
            // Generic data pipeline from the request body itself
            dataToArchive = body.data || [];
            // No auto-delete for custom pipelines
        } else {
            return NextResponse.json({ error: 'Invalid or missing payload_type' }, { status: 400 });
        }

        if (!dataToArchive || dataToArchive.length === 0) {
            return NextResponse.json({ message: 'No records to archive at this time.' });
        }

        // 1. Generate UHRP Content-Addressable Hash
        const uhrp_hash = Uhrp.generateHash(dataToArchive);

        // 2. Send Data to Local System Vault via Cloudflare Tunnel
        const response = await fetch(`${vaultUrl}/vault/ingest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${vaultSecret}`,
                'bypass-tunnel-reminder': 'true'
            },
            body: JSON.stringify({
                source: 'Railway-Production',
                payload_type,
                uhrp_hash,
                data: dataToArchive
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Vault Sync Failed:', errorText);
            return NextResponse.json({ error: 'Failed to push payload to the System Vault.' }, { status: 502 });
        }

        const vaultResult = await response.json();

        // 2. Perform Garbage Collection (Purge from Cloud DB)
        // ONLY if Vault confirmed receipt with 200 OK.
        let deleteResult = { count: 0 };
        if (archivedIds.length > 0) {
            if (payload_type === 'security_events') {
                deleteResult = await prisma.securityEvent.deleteMany({
                    where: { id: { in: archivedIds } }
                });
            } else if (payload_type === 'intel_items') {
                deleteResult = await prisma.intelItem.deleteMany({
                    where: { id: { in: archivedIds } }
                });
            }
        }

        return NextResponse.json({
            success: true,
            vault_response: vaultResult,
            garbage_collected: deleteResult.count,
            message: `Successfully teleported ${dataToArchive.length} records to local cold storage.`
        });

    } catch (error: any) {
        console.error('GC API Error:', error);
        return NextResponse.json({ error: 'Internal GC Error', details: error.message }, { status: 500 });
    }
}
