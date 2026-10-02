import os
import re

# Patch wallet/create
with open('app/api/wallet/create/route.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Completely rewrite the route to be non-custodial
non_custodial_create = """import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { ethers } from 'ethers';

/**
 * SOVEREIGN WALLET REGISTRATION
 * Next.js API only registers the public address. Private keys are NEVER generated
 * or stored on the server. The client generates and retains the keys.
 */
export async function POST(req: Request) {
    try {
        const session = await getSession();
        if (!session || !session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        
        const { publicAddress } = await req.json();
        if (!publicAddress) return NextResponse.json({ error: 'Missing public address' }, { status: 400 });

        // Register the public address to the user identity (no private keys!)
        await prisma.authUser.update({
            where: { email: session.email },
            data: { name: publicAddress } // Store public address in a non-sensitive field for now
        });

        return NextResponse.json({ address: publicAddress, created: true, message: 'Sovereign public address registered.' });
    } catch (e) {
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
"""
with open('app/api/wallet/create/route.ts', 'w', encoding='utf-8') as f:
    f.write(non_custodial_create)

# Patch timelock
non_custodial_timelock = """import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    return NextResponse.json({ error: '410 Gone: Server-side transaction signing is decommissioned. All transactions must be signed locally via WebCrypto/Enclave on the client.' }, { status: 410 });
}
"""
with open('app/api/wallet/timelock/create/route.ts', 'w', encoding='utf-8') as f:
    f.write(non_custodial_timelock)

print("Wallet endpoints made strictly non-custodial.")
