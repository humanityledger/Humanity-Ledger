import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { ethers } from "ethers";
import { prisma } from "@/lib/prisma";

/**
 * Relayer API for Gasless Proposal Execution
 */

const GOVERNANCE_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_GOVERNANCE_CONTRACT_ADDRESS!;
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY!;
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";

const GOVERNANCE_ABI = [
    "function executeProposalWithSignature(address executor, bytes32 proposalId, uint256 nonce, uint256 deadline, bytes signature) external",
    "event ProposalExecuted(bytes32 indexed proposalId, address indexed executor)"
];

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.userId) {
            return NextResponse.json({ error: "Unauthorized: Authentication required." }, { status: 401 });
        }
        const body = await req.json();
        const { executor, proposalId, nonce, deadline, signature } = body;

        if (!executor || !proposalId || !signature) {
            return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
        }

        // Strict input validation -- prevent injection and type confusion attacks
        if (typeof executor !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(executor)) {
            return NextResponse.json({ error: "Invalid executor address format" }, { status: 400 });
        }
        if (typeof proposalId !== "string" || !/^0x[a-fA-F0-9]{1,64}$/.test(proposalId)) {
            return NextResponse.json({ error: "Invalid proposalId format" }, { status: 400 });
        }
        if (typeof signature !== "string" || !/^0x[a-fA-F0-9]{130,}$/.test(signature)) {
            return NextResponse.json({ error: "Invalid signature format" }, { status: 400 });
        }
        // Numeric bounds on nonce and deadline
        const safeNonce = nonce != null ? BigInt(String(nonce)) : 0n;
        const safeDeadline = deadline != null ? BigInt(String(deadline)) : 0n;
        if (safeDeadline > 0n && safeDeadline < BigInt(Math.floor(Date.now() / 1000))) {
            return NextResponse.json({ error: "Deadline has passed" }, { status: 400 });
        }

        console.log("[Relayer] Executing proposal for validated executor");

        // Setup provider & signer
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);
        const governanceContract = new ethers.Contract(GOVERNANCE_CONTRACT_ADDRESS, GOVERNANCE_ABI, relayerWallet);

        // Check relayer balance
        const balance = await provider.getBalance(relayerWallet.address);
        if (balance < ethers.parseEther("0.001")) {
            return NextResponse.json({ error: "Relayer out of funds" }, { status: 503 });
        }

        // Simulate transaction to prevent gas exhaustion from bad signatures
        try {
            await governanceContract.executeProposalWithSignature.staticCall(
                executor,
                proposalId,
                safeNonce,
                safeDeadline,
                signature
            );
        } catch (simError: any) {
            console.error("[Relayer] Simulation failed. Invalid signature or state:", simError);
            return NextResponse.json({ error: "Simulation failed. Signature or parameters are invalid." }, { status: 400 });
        }

        // Execute transaction
        const tx = await governanceContract.executeProposalWithSignature(
            executor,
            proposalId,
            safeNonce,
            safeDeadline,
            signature,
            { gasLimit: 500_000 }
        );

        console.log(`[Relayer] Execution tx sent: ${tx.hash}`);

        // Wait for confirmation
        const receipt = await tx.wait();

        // Update database
        // @ts-ignore - proposalId is unique but typescript definition might lag in CI
        await (prisma.marketProposal as any).update({
            where: { proposalId },
            data: {
                status: "EXECUTED",
                executedAt: new Date(),
                executionTxHash: tx.hash,
            },
        });

        return NextResponse.json({
            success: true,
            txHash: tx.hash,
            blockNumber: receipt.blockNumber,
        });

    } catch (error: any) {
        console.error("[Relayer] Execution error:", error);
        const safeErr = "Execution failed. Please try again.";
        return NextResponse.json({ error: safeErr }, { status: 500 });
    }
}

