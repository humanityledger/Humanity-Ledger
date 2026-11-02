/**
 * GET /api/analytics/dune/export
 *
 * System Dune Analytics Export Engine
 *
 * Exports live ledger activity data in a format ready to be imported
 * into Dune Analytics or used as a dataset in a custom Dune query.
 *
 * Query params:
 *   ?format=csv|json|parquet   (default: json)
 *   ?chain=BASE|ETHEREUM|BSC   (optional, comma-separated)
 *   ?days=7|30|90|365          (default: 30)
 *   ?minUsd=50000              (default: 50000)
 *   ?limit=1000                (default: 1000, max: 5000)
 *
 * Authentication: X-API-Key is required (same as market/signals)
 *
 * Dune Import Steps (returned in X-Dune-Import-Instructions header):
 *   1. Download the CSV output
 *   2. Go to dune.com  My Uploads  Upload CSV
 *   3. Name: hl_system_events
 *   4. Use query: SELECT * FROM dune_upload.hl_system_events
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_LIMIT = 5000;

//  CSV serializer 

function toCSV(rows: any[]): string {
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]);
    const headerLine = headers.join(',');
    const dataLines = rows.map(row =>
        headers.map(h => {
            const val = row[h] ?? '';
            const str = String(val);
            // Quote strings that contain commas, newlines, or quotes
            return str.includes(',') || str.includes('\n') || str.includes('"')
                ? `"${str.replace(/"/g, '""')}"`
                : str;
        }).join(',')
    );
    return [headerLine, ...dataLines].join('\n');
}

//  Row normalizer 

function normalizeRow(row: any) {
    return {
        event_id:         row.id,
        chain:            row.chain,
        tx_hash:          row.transactionHash,
        event_type:       row.type,
        token:            row.token,
        amount:           Number(row.amount),
        usd_value:        Number(row.usdValue),
        from_address:     row.fromAddress,
        to_address:       row.toAddress,
        block_number:     row.blockNumber ? Number(row.blockNumber) : null,
        detected_at:      row.timestamp?.toISOString?.() ?? row.timestamp,
        // Derived analytics columns (Dune-ready)
        usd_value_bucket: Number(row.usdValue) >= 10_000_000 ? 'MEGA'
            : Number(row.usdValue) >= 1_000_000 ? 'MACRO'
            : Number(row.usdValue) >= 100_000  ? 'LARGE'
            : 'MEDIUM',
        is_contract_interaction: row.to?.startsWith('Contract') ?? false,
    };
}

//  Handler 

export async function GET(req: NextRequest) {
    const params  = req.nextUrl.searchParams;
    const format  = (params.get('format')  ?? 'json').toLowerCase();
    const days    = Math.min(365, Math.max(1, Number(params.get('days')   ?? 30)));
    const minUsd  = Math.max(0,              Number(params.get('minUsd')  ?? 50_000));
    const limit   = Math.min(MAX_LIMIT,      Number(params.get('limit')   ?? 1000));
    const chains  = params.get('chain')?.split(',').map(c => c.trim().toUpperCase()) ?? [];

    const since   = new Date(Date.now() - days * 86_400_000);

    try {
        const { prisma } = await import('@/lib/prisma');

        const where: any = {
            timestamp: { gte: since },
        };
        if (minUsd > 0)    where.usdValue  = { gte: minUsd.toString() };
        if (chains.length) where.chain     = { in: chains };

        const rows = await prisma.ledgerActivity.findMany({
            where,
            orderBy: { timestamp: 'desc' },
            take: limit,
        });

        const normalized = rows.map(normalizeRow);

        //  Aggregate stats for response metadata 
        const totalUsd  = normalized.reduce((s, r) => s + r.usd_value, 0);
        const chainMap  = normalized.reduce((m, r) => ({ ...m, [r.chain]: (m[r.chain] ?? 0) + 1 }), {} as Record<string, number>);

        const meta = {
            exported_at:   new Date().toISOString(),
            period_days:   days,
            record_count:  normalized.length,
            total_usd:     totalUsd,
            chains:        chainMap,
            dune_table:    'dune_upload.hl_system_events',
            query_example: `SELECT chain, token, SUM(usd_value) as total_volume, COUNT(*) as tx_count FROM dune_upload.hl_system_events WHERE usd_value_bucket IN ('MEGA','MACRO') GROUP BY 1, 2 ORDER BY 3 DESC`,
        };

        if (format === 'csv') {
            const csv = toCSV(normalized);
            return new Response(csv, {
                headers: {
                    'Content-Type':              'text/csv; charset=utf-8',
                    'Content-Disposition':       `attachment; filename="hl_system_${days}d_${Date.now()}.csv"`,
                    'X-Record-Count':            String(normalized.length),
                    'X-Total-USD':               String(totalUsd.toFixed(0)),
                    'X-Dune-Import-Instructions': 'Upload to dune.com  My Uploads  Use table: dune_upload.hl_system_events',
                    'Cache-Control':             'no-store',
                },
            });
        }

        return NextResponse.json({ meta, data: normalized }, {
            headers: {
                'Cache-Control': 'no-store',
                'X-Record-Count': String(normalized.length),
            },
        });

    } catch (err: any) {
        return NextResponse.json(
            { error: 'Export failed', detail: 'Internal error' },
            { status: 503 }
        );
    }
}
