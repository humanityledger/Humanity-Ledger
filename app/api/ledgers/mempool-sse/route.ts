import { NextRequest } from 'next/server';
import { createPublicClient, webSocket } from 'viem';
import { mainnet } from 'viem/chains';
import { getEthWsClient, ethHttpClient } from '@/lib/blockchain/rpcClient';

// L1 Cache Global para evitar llamadas RPC duplicadas si hay N usuarios conectados
const mempoolCache = new Map<string, any>();
const CACHE_TTL = 10000; // 10 segundos

/**
 * 0-Conf Mempool Sniffer (Server-Sent Events)
 * -------------------------------------------
 * Connect vía WebSocket al registry de GetBlock compartiendo la misma conexión global.
 * Filtra transacciones pendientes y aplica caché para evitar Multi-User RPC Exhaustion.
 */
export async function GET(req: NextRequest) {
    const encoder = new TextEncoder();
    
    // Usamos el cliente global (Singleton) para no abrir 1 WebSocket por usuario
    const client = getEthWsClient();

    const stream = new ReadableStream({
        async start(controller) {
            const sendEvent = (data: any) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            sendEvent({ type: 'MEMPOOL_CONNECTED', status: 'Scanning 0-conf grid...' });

            const unwatch = client.watchPendingTransactions({
                onTransactions: async (hashes) => {
                    const sample = hashes.slice(0, 5);

                    for (const hash of sample) {
                        try {
                            // Deduplicación Global: Si 100 usuarios escuchan, solo 1 hace la llamada RPC
                            let tx = mempoolCache.get(hash);
                            
                            if (!tx) {
                                // Usamos el HTTP Client para peticiones estáticas, el WS es solo para streaming
                                tx = await ethHttpClient.getTransaction({ hash });
                                mempoolCache.set(hash, tx);
                                setTimeout(() => mempoolCache.delete(hash), CACHE_TTL);
                            }

                            // Solo ballenas: > 50 ETH en el mempool
                            if (tx.value && tx.value > 50000000000000000000n) {
                                sendEvent({
                                    type: 'PENDING_LEDGER',
                                    hash: tx.hash,
                                    from: tx.from,
                                    to: tx.to,
                                    valueEth: Number(tx.value) / 1e18,
                                    timestamp: Date.now(),
                                });
                            }
                        } catch (e) {
                            // Ignorar silently
                        }
                    }
                },
                onError: (error) => {
                    sendEvent({ type: 'MEMPOOL_ERROR', message: error.message });
                }
            });

            req.signal.addEventListener('abort', () => {
                unwatch();
                controller.close();
            });
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
        },
    });
}
