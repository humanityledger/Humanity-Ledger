import { getSession } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { prisma } from "@/lib/prisma";
import { getRealTimePrice } from "@/lib/priceHelper";

/**
 * Relayer API for Gasless Zap
 * 
 * Receives signed zap intent from user, executes on-chain
 * Relayer pays gas, user pays nothing
 */

const ZAP_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ZAP_GASLESS_CONTRACT_ADDRESS!;
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY!;
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";

// ZapContractGasless ABI (minimal)
const ZAP_ABI = [
    "function executeZapWithSignature(address user, uint256 wldAmount, uint256 minUSDC, bytes32 conditionId, uint256 outcomeIndex, uint256 minSharesOut, uint256 deadline, bytes signature) external returns (uint256)",
    "event ZapExecuted(address indexed user, uint256 wldAmount, uint256 usdcReceived, bytes32 indexed conditionId, uint256 outcomeIndex, uint256 sharesReceived, uint256 protocolFee)",
    "event GaslessZapExecuted(address indexed user, address indexed relayer, uint256 nonce)"
];

export async function POST(req: NextRequest) {
    try {
        // Auth guard
        const session = await getSession();
        if (!session?.userId) {
            return NextResponse.json({ error: "Unauthorized: Authentication required." }, { status: 401 });
        }

        // ====================================================================
        // PARSE REQUEST
        // ====================================================================

        const body = await req.json();
        const {
            user,
            wldAmount,
            minUSDC,
            conditionId,
            outcomeIndex,
            minSharesOut,
            nonce,
            deadline,
            signature
        } = body;

        // Validation
        if (!user || !wldAmount || !conditionId || outcomeIndex === undefined || !signature) {
            return NextResponse.json(
                { error: "Missing required parameters" },
                { status: 400 }
            );
        }

        console.log(`[Relayer] Processing gasless zap for user: ${user}`);
        console.log(`[Relayer] Amount: ${ethers.formatEther(wldAmount)} AUTH`);

        // ====================================================================
        // SETUP PROVIDER & SIGNER
        // ====================================================================

        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);
        const zapContract = new ethers.Contract(ZAP_CONTRACT_ADDRESS, ZAP_ABI, relayerWallet);

        console.log(`[Relayer] Relayer address: ${relayerWallet.address}`);

        // Check relayer balance
        const balance = await provider.getBalance(relayerWallet.address);
        console.log(`[Relayer] Balance: ${ethers.formatEther(balance)} ETH`);

        if (balance < ethers.parseEther("0.001")) {
            console.error("[Relayer] Insufficient balance!");
            return NextResponse.json(
                { error: "Relayer out of funds. Please contact support." },
                { status: 503 }
            );
        }

        // ====================================================================
        // EXECUTE TRANSACTION
        // ====================================================================

        console.log("[Relayer] Simulating zap on-chain to prevent gas exhaustion...");

        try {
            await zapContract.executeZapWithSignature.staticCall(
                user,
                wldAmount,
                minUSDC || 0,
                conditionId,
                outcomeIndex,
                minSharesOut || 0,
                deadline,
                signature
            );
        } catch (simError: any) {
            console.error("[Relayer] Simulation failed. Invalid signature or state:", simError);
            return NextResponse.json(
                { error: "Simulation failed. Signature or parameters are invalid." },
                { status: 400 }
            );
        }

        console.log("[Relayer] Executing zap on-chain...");

        const tx = await zapContract.executeZapWithSignature(
            user,
            wldAmount,
            minUSDC || 0,
            conditionId,
            outcomeIndex,
            minSharesOut || 0,
            deadline,
            signature,
            {
                gasLimit: 500000, // Conservative gas limit
            }
        );

        console.log(`[Relayer] Transaction sent: ${tx.hash}`);

        // ====================================================================
        // SAVE TO DATABASE (PENDING)
        // ====================================================================

        // Fetch real-time Oracle pricing for true sovereign telemtry (Zero-Mock)
        const realWldPrice = await getRealTimePrice("AUTH") || 2.5;

        await prisma.blockchainTransaction.create({
            data: {
                txHash: tx.hash,
                userId: session.userId, // IDOR fix: use verified session, NOT client-supplied user field
                blockNumber: 0,
                status: "PENDING",
                type: "GASLESS_ZAP",
                fromChain: "BASE_SEPOLIA",
                fromToken: "AUTH",
                fromAmount: wldAmount.toString(),
                metadata: {
                    wldPriceUSD: realWldPrice,
                    usdcReceived: 0,
                    dexUsed: "uniswap",
                    marketId: conditionId,
                    outcomeIndex: Number(outcomeIndex),
                    gasPaidBy: "relayer"
                }
            }
        });

        // ====================================================================
        // WAIT FOR CONFIRMATION
        // ====================================================================

        console.log("[Relayer] Waiting for confirmation...");
        const receipt = await tx.wait();

        console.log(`[Relayer] Transaction confirmed in block ${receipt.blockNumber}`);

        // ====================================================================
        // UPDATE DATABASE (CONFIRMED)
        // ====================================================================

        await prisma.blockchainTransaction.update({
            where: { txHash: tx.hash },
            data: {
                status: "COMPLETED",
                blockNumber: receipt.blockNumber,
            },
        });

        // ====================================================================
        // PARSE EVENTS
        // ====================================================================

        let sharesReceived = "0";
        for (const log of receipt.logs) {
            try {
                const parsed = zapContract.interface.parseLog({
                    topics: log.topics as string[],
                    data: log.data,
                });
                if (parsed && parsed.name === "ZapExecuted") {
                    sharesReceived = parsed.args.sharesReceived.toString();
                    console.log(`[Relayer] Shares received: ${ethers.formatEther(sharesReceived)}`);
                }
            } catch (e) {
                // Not a ZapExecuted event, skip
            }
        }

        // ====================================================================
        // RETURN SUCCESS
        // ====================================================================

        return NextResponse.json({
            success: true,
            txHash: tx.hash,
            blockNumber: receipt.blockNumber,
            sharesReceived,
            gasUsed: receipt.gasUsed.toString(),
        });

    } catch (error: any) {
        console.error("[Relayer] Error:", error);

        // Check if it's a revert
        if (error.message?.includes("revert")) {
            return NextResponse.json(
                { error: `Transaction reverted: ${error.message}` },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'Internal Server Error' || "Relayer execution failed" },
            { status: 500 }
        );
    }
}

/**
 * GET endpoint to fetch nonce for a user
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const address = searchParams.get("address");

        if (!address) {
            return NextResponse.json({ error: "Address required" }, { status: 400 });
        }

        // Setup provider
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const zapContract = new ethers.Contract(
            ZAP_CONTRACT_ADDRESS,
            ["function getNonce(address user) external view returns (uint256)"],
            provider
        );

        const nonce = await zapContract.getNonce(address);

        return NextResponse.json({ nonce: nonce.toString() });

    } catch (error: any) {
        console.error("[Relayer] Nonce fetch error:", error);
        return NextResponse.json(
            { error: 'Internal Server Error' || "Failed to fetch nonce" },
            { status: 500 }
        );
    }
}

