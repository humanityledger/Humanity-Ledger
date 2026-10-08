import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const rpcUrl = process.env.GETBLOCK_BTC_RPC;
        if (!rpcUrl) throw new Error("Missing BTC RPC");

        const body = JSON.stringify({
            jsonrpc: "1.0",
            id: "curltest",
            method: "getblockchaininfo",
            params: []
        });

        const res = await fetch(rpcUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
            },
            body: body
        });

        const data = await res.json();
        const result = data.result;

        return NextResponse.json({
            blocks: result?.blocks || 0,
            difficulty: result?.difficulty || 0,
            bestBlockHash: result?.bestblockhash || "0000000000000000000000000000000000000000000000000000000000000000",
            mempoolSize: 0 
        });
    } catch (e: any) {
        console.error("BTC Proxy Error", e);
        // Fallback to avoid frontend crash
        return NextResponse.json({ 
            blocks: 0, 
            difficulty: 0, 
            bestBlockHash: "SYNC_PENDING", 
            error: 'Internal Server Error' 
        });
    }
}


