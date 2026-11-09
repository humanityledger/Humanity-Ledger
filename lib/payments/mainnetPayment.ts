/**
 * lib/payments/mainnetPayment.ts
 *
 * Non-custodial direct payment execution on Ethereum Mainnet.
 * All functions execute directly from the user's connected wallet.
 */

import { parseUnits, formatUnits, erc20Abi, type Address, isAddress } from "viem";
import type { Config } from "wagmi";
import {
  sendTransaction,
  writeContract,
  waitForTransactionReceipt,
  readContract,
  getBalance,
} from "@wagmi/core";
import { PAYMENTS_CONFIG, type SupportedMainnetToken } from "@/config/payments";

export interface PaymentResult {
  txHash: `0x${string}`;
  explorerUrl: string;
  token: SupportedMainnetToken;
  amount: string;
  recipient: Address;
}

/**
 * Retrieves the on-chain mainnet balance for a token or native ETH.
 */
export async function getMainnetBalance(
  token: SupportedMainnetToken,
  userAddress: Address,
  config: Config
): Promise<{ raw: bigint; formatted: string }> {
  if (!isAddress(userAddress)) {
    throw new Error(`Invalid Ethereum address: ${userAddress}`);
  }

  const tokenInfo = PAYMENTS_CONFIG.tokens[token];

  if (token === "ETH" || !tokenInfo.address) {
    const result = await getBalance(config, { address: userAddress });
    return {
      raw: result.value,
      formatted: formatUnits(result.value, 18),
    };
  }

  const rawBalance = (await readContract(config, {
    address: tokenInfo.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [userAddress],
  } as any)) as bigint;

  return {
    raw: rawBalance,
    formatted: formatUnits(rawBalance, tokenInfo.decimals),
  };
}

/**
 * Executes a direct mainnet payment from the user's connected wallet.
 * Governed by the safety feature flag (PAYMENTS_CONFIG.mainnetEnabled).
 */
export async function sendMainnetPayment({
  token,
  to,
  amount,
  config,
}: {
  token: SupportedMainnetToken;
  to: string;
  amount: string;
  config: Config;
}): Promise<PaymentResult> {
  if (!PAYMENTS_CONFIG.mainnetEnabled) {
    throw new Error(
      "Mainnet payments are protected under audit review. Set NEXT_PUBLIC_MAINNET_PAYMENTS_ENABLED='true' to enable."
    );
  }

  if (!isAddress(to)) {
    throw new Error(`Invalid destination address: "${to}". Must be a valid 0x address.`);
  }

  const cleanAmount = amount.trim();
  const numAmount = parseFloat(cleanAmount);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new Error(`Invalid payment amount: "${amount}". Must be a positive number.`);
  }

  const tokenInfo = PAYMENTS_CONFIG.tokens[token];
  const targetAddress = to as Address;

  let txHash: `0x${string}`;

  if (token === "ETH" || !tokenInfo.address) {
    txHash = await sendTransaction(config, {
      to: targetAddress,
      value: parseUnits(cleanAmount, 18),
    });
  } else {
    txHash = (await writeContract(config, {
      address: tokenInfo.address,
      abi: erc20Abi,
      functionName: "transfer",
      args: [targetAddress, parseUnits(cleanAmount, tokenInfo.decimals)],
    } as any)) as `0x${string}`;
  }

  // Wait for 1 confirmation on mainnet before resolving
  await waitForTransactionReceipt(config, {
    hash: txHash,
    confirmations: 1,
  });

  return {
    txHash,
    explorerUrl: `https://etherscan.io/tx/${txHash}`,
    token,
    amount: cleanAmount,
    recipient: targetAddress,
  };
}
