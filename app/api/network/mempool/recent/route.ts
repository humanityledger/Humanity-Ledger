import { NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
export const dynamic = 'force-dynamic';

/**
 * Smart Mempool Proxy
 *
 * Fetches unconfirmed transactions from Blockchain.info (which includes values)
 * and maps them to the MempoolTx interface for the BTC Mempool dashboard.
 *
 * We use Blockchain.info because mempool.space's /api/mempool/recent does NOT
 * include transaction values, which are required for ledger-size detection.
 */
export async function GET() {
    try {
        const res = await fetch('https://blockchain.info/unconfirmed-transactions?format=json', {
            next: { revalidate: 5 } // Cache for 5 seconds
        });

        if (!res.ok) {
            throw new Error(`Blockchain.info error: ${res.statusText}`);
        }

        const data = await res.json();

        // Map to MempoolTx interface
        const mappedTxs = (data.txs || []).map((tx: any) => {
            // Calculate total value from all outputs (in satoshis)
            const totalValue = (tx.out || []).reduce((sum: number, out: any) => sum + (out.value || 0), 0);

            return {
                txid: tx.hash,
                fee: tx.fee || 0,
                vsize: tx.size || 0,
                weight: tx.weight || 0,
                value: totalValue,
                time: tx.time || Math.floor(Date.now() / 1000),
                vin: (tx.inputs || []).map((input: any) => ({
                    prevout: {
                        scriptpubkey_address: input.prev_out?.addr,
                        value: input.prev_out?.value
                    }
                })),
                vout: (tx.out || []).map((out: any) => ({
                    scriptpubkey_address: out.addr,
                    value: out.value
                }))
            };
        });

        //  [Private PERSISTENCE] Save mega-ledger BTC movements to DB 
        // Threshold: 50 BTC+ (5,000,000,000 satoshis)  only true giants are indexed.
        // FIRE AND FORGET: DB write never blocks the response.
        const giantLedgers = mappedTxs.filter((tx: any) => tx.value >= 5_000_000_000);

        if (giantLedgers.length > 0) {
            (async () => {
                for (const ledger of giantLedgers) {
                    try {
                        const btcAmount = ledger.value / 1e8;
                        const usdEstimate = Math.round(btcAmount * 60000);

                        await prisma.ledgerActivity.upsert({
                            where: { transactionHash: ledger.txid },
                            update: {}, // preserve existing record  write-once semantics
                            create: {
                                walletAddress: ledger.vin?.[0]?.prevout?.scriptpubkey_address || 'Unknown',
                                type: 'BTC Transfer',
                                token: 'BTC',
                                amount: String(btcAmount),          // schema: String
                                usdValue: String(usdEstimate),      // schema: String
                                fromAddress: ledger.vin?.[0]?.prevout?.scriptpubkey_address || 'Unknown',
                                toAddress: ledger.vout?.[0]?.scriptpubkey_address || 'Multiple',
                                transactionHash: ledger.txid,
                                blockNumber: BigInt(0),
                                chain: 'BITCOIN',
                                confirmed: false,
                                metadata: {
                                    satPerVbyte: ledger.vsize > 0 ? (ledger.fee / ledger.vsize).toFixed(1) : '0',
                                    method: 'BTC Transfer',
                                    confirmations: 0
                                },
                                timestamp: new Date(ledger.time * 1000),
                            }
                        });
                    } catch {
                        // Silent fail  background persistence never blocks the API response
                    }
                }
            })();
        }

        return NextResponse.json(mappedTxs);
    } catch (err: any) {
        console.error('[Mempool API Error]', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 502 });
    }
}
