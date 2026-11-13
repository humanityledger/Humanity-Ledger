import { NextRequest, NextResponse } from 'next/server';
import { currentReport } from '@/lib/protocol/read';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/protocol/metrics — public, read-only aggregate metrics of the protocol on Aztec Alpha.
 * GET /api/protocol/metrics?download=1 — the same report as a file, with its SHA-256 digest.
 *
 * Every figure is read from its source in the snapshot (lib/protocol/read.ts) or reported as not
 * read, not deployed or not measurable. No personal data: nothing here is per account.
 */
export async function GET(req: NextRequest) {
  try {
    const report = await currentReport();
    const download = req.nextUrl.searchParams.get('download') === '1';
    const headers: Record<string, string> = {
      'cache-control': 'public, max-age=30, stale-while-revalidate=30',
      'x-content-type-options': 'nosniff',
    };
    if (download) {
      const day = report.generatedAt.slice(0, 10);
      const block = report.anchorBlock ?? 'no-block';
      headers['content-disposition'] = `attachment; filename="ledger-protocol-report-${day}-block-${block}.json"`;
      return new NextResponse(JSON.stringify(report, null, 2), {
        status: 200,
        headers: { ...headers, 'content-type': 'application/json; charset=utf-8' },
      });
    }
    return NextResponse.json(report, { headers });
  } catch (error) {
    console.error('[protocol/metrics]', error);
    // Fail closed: no partial or cached-as-current figures on an unexpected error.
    return NextResponse.json({ error: 'METRICS_UNAVAILABLE', message: 'Protocol metrics could not be read.' }, { status: 503 });
  }
}
