import { NextRequest, NextResponse } from 'next/server';
import { RELAY_MAX_BODY_BYTES, relayResponseHeaders, relayUpstreams, validateRelayBody } from '@/lib/aztec/node-relay';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/aztec/node — relays one JSON-RPC request (or a small batch) from the private wallet to
 * the pinned Aztec node, when the browser cannot reach that node directly (lib/aztec/wallet/node-fetch.ts).
 * Signed-in sessions only (middleware). Rules and limits: lib/aztec/node-relay.ts.
 * Set AZTEC_NODE_RELAY=off to turn it off.
 */
const UPSTREAM_TIMEOUT_MS = 30_000;

/** Errors in JSON-RPC shape, so the wallet's client reports the message itself. */
function fail(status: number, message: string, headers?: Record<string, string>) {
  return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32000, message } }, { status, headers });
}
const MAX_RESPONSE_BYTES = 32 * 1024 * 1024;

async function readLimited(req: NextRequest, limit: number): Promise<string | null> {
  const reader = req.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
}

export async function POST(req: NextRequest) {
  if (process.env.AZTEC_NODE_RELAY === 'off') {
    return fail(404, 'The node relay is turned off on this server.');
  }
  const type = req.headers.get('content-type') || '';
  if (!/^application\/json\b/i.test(type)) {
    return fail(415, 'Content-Type must be application/json.');
  }
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > RELAY_MAX_BODY_BYTES) return fail(413, 'Request too large.');

  const raw = await readLimited(req, RELAY_MAX_BODY_BYTES);
  if (raw === null) return fail(413, 'Request too large.');
  const check = validateRelayBody(raw);
  if (!check.ok) return fail(400, `Relay refused the request: ${check.error}`);

  const upstreams = relayUpstreams();
  if (!upstreams.length) return fail(503, 'No Aztec node is configured.');

  let lastStatus = 502;
  for (const upstream of upstreams) {
    try {
      const res = await fetch(upstream, {
        method: 'POST',
        // Only what JSON-RPC needs: no cookies, authorization or client headers go upstream.
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: raw,
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      // Rate limited or down: try the next upstream, if there is one.
      if (res.status === 429 || res.status >= 500) {
        lastStatus = res.status;
        await res.body?.cancel().catch(() => {});
        continue;
      }
      const length = Number(res.headers.get('content-length') || 0);
      if (length > MAX_RESPONSE_BYTES) {
        await res.body?.cancel().catch(() => {});
        return fail(502, 'Node response too large.');
      }
      const body = await res.arrayBuffer();
      if (body.byteLength > MAX_RESPONSE_BYTES) return fail(502, 'Node response too large.');
      return new NextResponse(body, { status: res.status, headers: relayResponseHeaders(res.headers) });
    } catch {
      lastStatus = 502;
    }
  }
  return fail(lastStatus === 429 ? 503 : 502, 'The Aztec node could not be reached. Try again in a minute.', { 'retry-after': '10' });
}
