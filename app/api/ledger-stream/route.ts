/**
 * GET /api/ledger-stream
 *
 * Server-Sent Events (SSE) endpoint that delivers real-time ledger
 * alert events from the Redis queue to any subscribed browser client.
 *
 * Architecture:
 *   EVM/BTC/SOL Worker  prisma.ledgerActivity  Redis List (ledger:alert:queue)
 *    THIS ENDPOINT poll/BLPOP  SSE stream  React Context  UI
 *
 * Why SSE over WebSocket?
 *  - SSE works through HTTP/2 multiplexing on Railway without extra infra
 *  - Automatic browser reconnect on failure (EventSource API)
 *  - Unidirectional (server  client) is exactly what we need
 */

import { NextRequest } from 'next/server';
import { safeJsonParse } from '@/lib/utils/json';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Concurrency Cap: Prevent Node.js EMFILE exhaustion
let activePodConnections = 0;
const MAX_CONCURRENT_SSE = 200;

// Redis import is conditional  the worker sets the queue, this endpoint reads it.
// If Redis is not available (local dev without Docker), we fall back to long-polling
// against Prisma directly.

async function getRedisClient() {
    try {
        const { redisClient } = await import('@/lib/redis/client');
        // Check if mock
        if ((redisClient as any).__isMock) return null;
        return redisClient;
    } catch {
        return null;
    }
}

async function getPrismaClient() {
    const { prisma } = await import('@/lib/prisma');
    return prisma;
}

export async function GET(req: NextRequest) {
    if (activePodConnections >= MAX_CONCURRENT_SSE) {
        console.warn(`[SSE:Throttle] Max concurrent streams (${activePodConnections}) reached. Rejecting connection with Backoff.`);
        return new Response(JSON.stringify({ error: 'System at capacity. Please reconnect later.' }), {
            status: 503,
            headers: {
                'Content-Type': 'application/json',
                'Retry-After': '30', // Instruct client EventSource to backoff
            }
        });
    }

    activePodConnections++;

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const send = (event: string, data: unknown) => {
                const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
                try {
                    controller.enqueue(encoder.encode(payload));
                } catch {
                    // Client disconnected  stream will be cleaned up by finally block
                }
            };

            // Initial heartbeat
            send('connected', { status: 'system', timestamp: new Date().toISOString() });

            const prisma = await getPrismaClient();

            // [CATCH-UP] Initial data blast for Total System Visibility
            try {
                const history = await prisma.ledgerActivity.findMany({
                    orderBy: { timestamp: 'desc' },
                    take: 15,
                });
                // Send in reverse (oldest first) so they appear in correct order in UI
                history.reverse().forEach(row => {
                    send('ledger', {
                        hash: row.transactionHash,
                        from: row.fromAddress,
                        to: row.toAddress,
                        asset: row.token,
                        amount: row.amount,
                        usdValue: row.usdValue,
                        chain: row.chain,
                        type: row.type,
                        timestamp: row.timestamp?.toISOString(),
                        isHistorical: true
                    });
                });
            } catch (err) {
                console.error('[SSE:CATCHUP_ERROR]', err);
            }

            let lastId: string | undefined;
            let redisStreamId = '$';
            let running = true;
            let isCleanedUp = false;

            //  [COSMIC BRIDGE] Redis Mesh Listener 
            // We create a dedicated subscriber to the System Auth Bus
            const { redisClient: subClient } = await import('@/lib/redis/client');
            const podSub = (subClient as any).duplicate();
            await podSub.connect().catch(() => {});

            const cleanup = async () => {
                if (isCleanedUp) return;
                isCleanedUp = true;
                running = false;
                activePodConnections--;
                try { 
                    await podSub.unsubscribe('system_mesh_auth_bus').catch(() => {});
                    await podSub.quit().catch(() => {});
                } catch {}
                try { controller.close(); } catch {}
            };

            req.signal.addEventListener('abort', cleanup);

            // Listen for Auth Events (QR Handshake Success)
            podSub.subscribe('system_mesh_auth_bus', (message: string) => {
                try {
                    const event = JSON.parse(message);
                    // Standard: The QR token (sent as session param) matches the socket/stream expectation
                    // We broadcast to all listeners, clients decide if it's their token.
                    send('auth-complete', event);
                } catch {}
            });

            const redis = await getRedisClient();

            while (running) {
                try {

                    //  Primary path: Redis Streams 
                    if (redis) {
                        // XREAD bloqueante por 15s. No elimina el dato de la cola.
                        const result = await (redis as any).xread('BLOCK', 15000, 'STREAMS', 'ledger:alert:stream', redisStreamId);
                        
                        if (result) {
                            // result structure: [ [ 'ledger:alert:stream', [ [ msgId, ['payload', jsonString] ] ] ] ]
                            const streamData = result[0];
                            const messages = streamData[1];
                            
                            for (const message of messages) {
                                redisStreamId = message[0]; // Actualizamos puntero
                                const fieldValues = message[1];
                                
                                // Parseamos el index 1 que asume ['payload', '{"hash":...}']
                                const jsonPayload = fieldValues[1];
                                if (jsonPayload) {
                                    const alert = safeJsonParse(jsonPayload, null, 'LEDGER_XREAD_STREAM');
                                    if (alert) send('ledger', alert);
                                }
                            }
                        } else {
                            // Timeout  send heartbeat
                            send('heartbeat', { ts: Date.now() });
                        }
                    } else {
                        //  Fallback path: Prisma polling 
                        const where = lastId ? { id: { gt: lastId } } : {};
                        const rows = await prisma.ledgerActivity.findMany({
                            where,
                            orderBy: { timestamp: 'asc' },
                            take: 10,
                        });

                        for (const row of rows) {
                            send('ledger', {
                                hash: row.transactionHash,
                                from: row.fromAddress,
                                to: row.toAddress,
                                asset: row.token,
                                amount: row.amount,
                                usdValue: row.usdValue,
                                chain: row.chain,
                                type: row.type,
                                timestamp: row.timestamp?.toISOString(),
                            });
                            lastId = row.id;
                        }

                        if (rows.length === 0) {
                            send('heartbeat', { ts: Date.now() });
                        }

                        // Poll every 5 seconds in fallback mode
                        await new Promise(r => setTimeout(r, 5000));
                    }
                } catch (err: any) {
                    if (!running) break;
                    // Send error event (non-fatal  client will stay connected)
                    send('error', { message: 'Internal error' });
                    await new Promise(r => setTimeout(r, 3000));
                }
            }

            // Ensure cleanup happens if loop exits gracefully or crashes outside try-catch
            cleanup();
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // Disable Nginx buffering (Railway)
            'Access-Control-Allow-Origin': '*',
        },
    });
}
