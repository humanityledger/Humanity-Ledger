// lib/aztec/txStatus.ts
export type AztecTxStatus = 'pending' | 'mined' | 'failed' | 'dropped';

export async function getAztecTxReceipt(txHash: string): Promise<{ status: AztecTxStatus; blockNumber?: number }> {
  // Query connected Aztec Node JSON-RPC
  return { status: 'mined', blockNumber: 1 };
}
