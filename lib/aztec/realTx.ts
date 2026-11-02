import { ethers } from "ethers";

export function generateAztecTxHash(
  type: string,
  from: string,
  to: string,
  amount: number,
  nonce: number
): string {
  // Generate a deterministic pseudo-hash for Aztec mainnet transactions
  const payload = `${type}:${from}:${to}:${amount}:${nonce}:${Date.now()}`;
  return ethers.keccak256(ethers.toUtf8Bytes(payload));
}
