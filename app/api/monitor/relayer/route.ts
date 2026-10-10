import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

/**
 * Relayer Monitoring API
 * 
 * Provides health check and metrics for relayer
 */

const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY!;
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const MIN_BALANCE_ETH = "0.01"; // Alert threshold

export async function GET(req: NextRequest) {
    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);

        // Get balance
        const balance = await provider.getBalance(relayerWallet.address);
        const balanceEth = ethers.formatEther(balance);

        // Get gas price
        const feeData = await provider.getFeeData();
        const gasPriceGwei = feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, "gwei") : "0";

        // Calculate estimated transactions remaining
        const avgGasPerTx = 300000; // Conservative estimate
        const gasPrice = feeData.gasPrice || 0n;
        const costPerTx = avgGasPerTx * Number(gasPrice);
        const txsRemaining = costPerTx > 0 ? Math.floor(Number(balance) / costPerTx) : 0;

        // Health status
        const isHealthy = parseFloat(balanceEth) > parseFloat(MIN_BALANCE_ETH);

        return NextResponse.json({
            status: isHealthy ? "healthy" : "warning",
            relayer: {
                address: relayerWallet.address,
                balance: balanceEth,
                balanceWei: balance.toString(),
            },
            network: {
                chainId: 84532,
                gasPrice: gasPriceGwei,
                gasPriceWei: gasPrice.toString(),
            },
            metrics: {
                estimatedTxsRemaining: txsRemaining,
                minBalanceThreshold: MIN_BALANCE_ETH,
                needsRefill: !isHealthy,
            },
            timestamp: new Date().toISOString(),
        });

    } catch (error: any) {
        console.error("[Monitor] Error:", error);
        return NextResponse.json(
            {
                status: "error",
                error: 'Internal Server Error',
                timestamp: new Date().toISOString(),
            },
            { status: 500 }
        );
    }
}

