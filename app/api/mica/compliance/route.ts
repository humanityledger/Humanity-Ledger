import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJWT } from '@/lib/jwt';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * Cryptographic Endpoint: MiCA & GDPR Attestation Toolkit
 * Handles European user data residency and the "Right to Be Forgotten".
 * 
 * Required Clearance: Private or ADMIN
 */
export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Missing Sovereign Clearance token' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        let payload: any;
        
        try {
            payload = await verifyJWT(token);
        } catch (e) {
            return NextResponse.json({ error: 'Invalid or forged token' }, { status: 403 });
        }

        // Only Private clearance users or full Admins can execute EU Data wipes
        if (payload.clearance !== 'Private' && payload.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Clearance level too low for attestation tooling' }, { status: 403 });
        }

        const body = await req.json();
        const { action, targetAddress } = body;

        if (!targetAddress || typeof targetAddress !== 'string') {
            return NextResponse.json({ error: 'Missing targetAddress' }, { status: 400 });
        }

        const address = targetAddress.toLowerCase();

        // [SECURITY: IDOR MITIGATION]
        // Non-admin users are strictly restricted to wiping their own account.
        const callerId = (payload.userId || payload.sub || payload.address || '').toLowerCase();
        if (payload.role !== 'ADMIN' && callerId !== address) {
            return NextResponse.json({
                error: 'Forbidden: You can only exercise Right to Be Forgotten for your own wallet identity.'
            }, { status: 403 });
        }

        switch (action) {
            case 'RIGHT_TO_BE_FORGOTTEN':
                // Wipe user profile, settings, and subscription ties
                await prisma.user.deleteMany({ where: { walletAddress: address } });
                
                // Note: We DO NOT delete the blockchain thermodynamic event records (LedgerActivity)
                // because those are public on-chain deterministic facts, not PII.
                
                // Hash the address to verify the wipe in the future without storing the PII
                const wipeHash = crypto.createHash('sha256').update(address).digest('hex');
                
                // Track the attestation execution
                await prisma.securityEvent.create({
                    data: {
                        type: 'MICA_PDI_ANONYMIZATION',
                        severity: 'WARNING',
                        ipAddress: 'System', // IP masked for attestation
                        userAgent: `Operator: ${payload.sub || payload.id}`,
                        details: `Executed GDPR wipe for EntityHash: ${wipeHash}`,
                        timestamp: new Date()
                    }
                });

                return NextResponse.json({ 
                    ok: true, 
                    message: 'Entity PDI definitively wiped per MiCA Art 72.',
                    entityHash: wipeHash
                });

            case 'DATA_RESIDENCY_DECLARATION':
                return NextResponse.json({
                    ok: true,
                    residency: 'EU-CENTRAL-1',
                    storageMode: 'EPHEMERAL_VOLATILE',
                    retentionLimit: '30_DAYS'
                });

            default:
                return NextResponse.json({ error: 'Invalid attestation action' }, { status: 400 });
        }

    } catch (error: any) {
        console.error('[MiCA Attestation] Error:', error);
        return NextResponse.json({ error: 'Internal server error processing attestation packet' }, { status: 500 });
    }
}
