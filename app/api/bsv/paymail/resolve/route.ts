import { NextResponse } from 'next/server';

/**
 * Private IDENTITY - PAYMAIL RESOLUTION ENGINE
 * -----------------------------------------------
 * Translates human-readable handles into Bitcoin SV addresses and PKI metadata.
 * 
 * FIX Bug 14: Removed ALL Math.random() fake address/PKI generation.
 * Previously, fallback responses contained invented Bitcoin addresses and
 * cryptographic public keys  these could cause users to verify signatures
 * against non-existent keys, resulting in fund loss.
 * Now: unresolvable handles return a clear 404 error instead of fabricated data.
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const handle = searchParams.get('handle');

        if (!handle || !handle.includes('@')) {
            return NextResponse.json({ error: 'Invalid Paymail Handle substrate.' }, { status: 400 });
        }

        const [user, domain] = handle.split('@');
        console.log(` [Identity] Resolving Paymail Identity: ${handle}...`);

        //  Step 1: Fetch the BSVALIAS capability document 
        const wellKnownUrl = `https://${domain}/.well-known/bsvalias`;
        let resolveEndpoint: string | null = null;

        try {
            const configRes = await fetch(wellKnownUrl, {
                signal: AbortSignal.timeout(5000),
            });
            if (configRes.ok) {
                const config = await configRes.json();
                resolveEndpoint = config?.capabilities?.['759684b1']
                    || config?.addressResolution
                    || null;
            }
        } catch {
            // Domain doesn't support Paymail or is offline
        }

        //  Step 2: Attempt live address resolution 
        if (resolveEndpoint) {
            try {
                const resolveUrl = resolveEndpoint.replace('{alias}', user).replace('{domain.tld}', domain);
                const resolveRes = await fetch(resolveUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ senderHandle: 'inquiry@ledgerchat.org', dt: new Date().toISOString(), amount: 0 }),
                    signal: AbortSignal.timeout(5000),
                });
                if (resolveRes.ok) {
                    const resolved = await resolveRes.json();
                    return NextResponse.json({
                        handle,
                        address:    resolved.output || resolved.address,
                        human_id:   user.toUpperCase(),
                        status:     'VERIFIED_LIVE',
                        protocol:   'BSV-ALIAS/P2PKH',
                        source:     'live',
                    });
                }
            } catch {
                // Resolution endpoint failed
            }
        }

        //  Step 3: Honest failure  no data is better than fake data 
        // FIX: Previously returned Math.random() fake address + fake PKI key here.
        // We now return 404 so the caller knows the identity is unresolvable.
        return NextResponse.json({
            error: 'Paymail handle could not be resolved.',
            handle,
            hint: `The domain '${domain}' does not expose a BSVALIAS capability document or the address endpoint is offline.`,
        }, { status: 404 });

    } catch (error: any) {
        console.error('[Identity] Resolution Error:', error);
        return NextResponse.json({ error: 'Internal Identity Failure' }, { status: 500 });
    }
}
