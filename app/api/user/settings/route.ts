import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateSecureRequest } from '@/lib/security/premium-security';

// Map exact DB columns (for strongly typed schema fields)
const STORE_TO_DB: Record<string, string> = {
    theme:                  'theme',
    language:               'language',
    currency:               'currency',
    timeFormat:             'timeFormat',
    dateFormat:             'dateFormat',
    addressFormat:          'addressFormat',
    density:                'layoutDensity',
    defaultTimeframe:       'defaultTimeframe',
    displayUnit:            'displayUnit',
    showBalances:           'showBalances',
    soundEffects:           'soundEffects',
    hardwareAcceleration:   'hardwareAcceleration',
    customRpcUrl:           'customRpcUrl',
    testnetMode:            'testnetMode',
    gasPreset:              'gasPreset',
    maxSlippage:            'maxSlippage',
    mevProtection:          'mevProtection',
    emailAlerts:            'emailAlerts',
    telegramAlerts:         'telegramAlerts',
    audioAlerts:            'soundEffects',
    ledgerAlertThreshold:   'ledgerAlertThreshold',
    email:                  'email',
    inactivityLockMinutes:  'inactivityLockMinutes',
    autoDisconnectTimer:    'autoDisconnectTimer',
    stealthMode:            'stealthMode',
    requireSignForExports:  'requireSignForExports',
    allowAnalytics:         'allowAnalytics',
    chatName:               'chatName',
    chatBio:                'chatBio',
    qrLabel:                'qrLabel',
    hiddenAssets:           'hiddenAssets',
};

const DB_TO_STORE: Record<string, string> = {
    layoutDensity: 'density',
};

const SAFE_COLUMNS = ['theme', 'currency', 'language', 'showBalances', 'stealthMode', 'allowAnalytics', 'soundEffects', 'testnetMode', 'hardwareAcceleration'];

// Helper to convert DB user record back to settings object
function mapDbToStore(data: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    
    // First, map direct columns
    for (const [dbKey, val] of Object.entries(data)) {
        if (dbKey === 'extendedSettings' || dbKey === 'id' || dbKey === 'walletAddress' || dbKey === 'createdAt' || dbKey === 'updatedAt' || dbKey === 'enclavePinHash' || dbKey === 'enclaveOtpHash' || dbKey === 'enclaveOtpExpiresAt' || dbKey === 'otpLastSentAt' || dbKey === 'enclaveClearanceToken' || dbKey === 'enclaveClearanceTs') continue;
        
        const storeKey = DB_TO_STORE[dbKey] ?? dbKey;
        if (val !== null && val !== undefined) {
            out[storeKey] = val;
        }
    }
    
    // Alias support
    if ('soundEffects' in out) {
        out['audioAlerts'] = out['soundEffects'];
    }

    // Merge extendedSettings (JSON) back into the root level
    if (data.extendedSettings) {
        try {
            const ext = typeof data.extendedSettings === 'string' ? JSON.parse(data.extendedSettings) : data.extendedSettings;
            for (const [extKey, extVal] of Object.entries(ext)) {
                out[extKey] = extVal;
            }
        } catch (e) {
            console.error('Failed to parse extendedSettings', e);
        }
    }

    return out;
}

export async function GET(req: any) {
    try {
        const validation = await validateSecureRequest(req);
        if (!validation.valid || !validation.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const address = validation.userId;

        let user: any = null;

        try {
            // Full schema retrieval (including extendedSettings)
            user = await (prisma as any).user.findUnique({
                where: { walletAddress: address },
            });
        } catch {
            // Fallback for minimal unmigrated schema
            user = await prisma.user.findUnique({
                where: { walletAddress: address },
                select: {
                    theme: true, currency: true, language: true,
                    showBalances: true, stealthMode: true,
                    allowAnalytics: true, soundEffects: true,
                    testnetMode: true, hardwareAcceleration: true,
                },
            });
        }

        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        
        return NextResponse.json({ settings: mapDbToStore(user) });
    } catch (e: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

async function handleUpdate(req: any) {
    try {
        const validation = await validateSecureRequest(req);
        if (!validation.valid || !validation.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const address = validation.userId;

        const body = await req.json();

        // Separate standard columns from extended settings (like uiConfig, executionConfig, etc.)
        const updateData: Record<string, any> = {};
        const extData: Record<string, any> = {};
        
        for (const [storeKey, val] of Object.entries(body)) {
            if (storeKey === 'syncHash') continue;
            
            const dbKey = STORE_TO_DB[storeKey];
            if (dbKey) {
                if (!(dbKey in updateData)) {
                    updateData[dbKey] = val;
                }
            } else {
                extData[storeKey] = val;
            }
        }

        let updatedUser: any = null;
        
        try {
            // First fetch existing extendedSettings to merge
            const current = await (prisma as any).user.findUnique({
                where: { walletAddress: address },
                select: { extendedSettings: true }
            });
            
            let currentExt = {};
            if (current?.extendedSettings) {
                currentExt = typeof current.extendedSettings === 'string' 
                    ? JSON.parse(current.extendedSettings) 
                    : current.extendedSettings;
            }
            
            // Merge with new extended settings
            const mergedExt = { ...currentExt, ...extData };
            
            if (Object.keys(mergedExt).length > 0) {
                updateData.extendedSettings = mergedExt;
            }

            updatedUser = await (prisma as any).user.update({
                where: { walletAddress: address },
                data: updateData,
            });
        } catch (err) {
            // Extended columns not yet migrated  write only safe columns
            const safeData: Record<string, any> = {};
            for (const k of Object.keys(updateData)) {
                if (SAFE_COLUMNS.includes(k)) safeData[k] = updateData[k];
            }
            if (Object.keys(safeData).length > 0) {
                updatedUser = await prisma.user.update({
                    where: { walletAddress: address },
                    data: safeData,
                });
            }
        }

        // Non-blocking audit log
        if (updatedUser) {
            try {
                await prisma.auditLog.create({
                    data: {
                        userId: updatedUser.id,
                        action: 'SETTINGS_UPDATED',
                        resource: 'User',
                        metadata: updateData,
                        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
                    }
                });
            } catch { /* audit log non-critical */ }
        }

        return NextResponse.json({ success: true, settings: mapDbToStore(updatedUser || updateData) });
    } catch (e: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(req: any) {
    return handleUpdate(req);
}

export async function PUT(req: any) {
    return handleUpdate(req);
}
