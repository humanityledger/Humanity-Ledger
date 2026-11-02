import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const rpcUrl = process.env.GETBLOCK_BASE_RPC;
        if (!rpcUrl) throw new Error("Missing Base RPC");

        const client = createPublicClient({
            chain: base,
            transport: http(rpcUrl)
        });

        const blockNumber = await client.getBlockNumber();

        return NextResponse.json({
            block: blockNumber.toString(),
            status: "online"
        });
    } catch (e: any) {
        console.error("Base Proxy Error", e);
        // Fallback to avoid crash
        return NextResponse.json({ 
            block: "0", 
            status: "offline", 
            error: 'Internal Server Error' 
        });
    }
}


