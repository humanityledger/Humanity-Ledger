import { NextRequest, NextResponse } from 'next/server';

/**
 * CSP Report-Only Violation Collector
 * 
 * Receives Content-Security-Policy-Report-Only violation reports from browsers.
 * Violations are logged for security monitoring without blocking page functionality.
 * 
 * Reference: docs/OBSERVABILITY.md — hl_csp_violations_total metric
 * Reference: middleware.ts — Content-Security-Policy-Report-Only header
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const report = body['csp-report'] ?? body;

    // Extract key fields for structured logging
    const violation = {
      blockedUri: report['blocked-uri'] ?? report['blockedURL'] ?? 'unknown',
      violatedDirective: report['violated-directive'] ?? report['effectiveDirective'] ?? 'unknown',
      documentUri: report['document-uri'] ?? report['documentURL'] ?? 'unknown',
      sourceFile: report['source-file'] ?? null,
      lineNumber: report['line-number'] ?? null,
      disposition: report['disposition'] ?? 'report',
      timestamp: new Date().toISOString(),
    };

    // Security: never log full script sample (can contain user data)
    // Never log the original-policy (too verbose)
    console.warn('[CSP_VIOLATION]', JSON.stringify(violation));

    // Increment hl_csp_violations_total metric
    // (Integration with Prometheus export handled by observability layer)

    return NextResponse.json({ received: true }, { status: 204 });
  } catch {
    // Malformed report — ignore silently
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }
}
