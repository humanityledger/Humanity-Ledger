/**
 * Real Aztec private transfer using TokenContract.
 * Requires: NEXT_PUBLIC_ZK_MODE=testnet, connected Aztec wallet + PXE.
 *
 * This replaces all mock transfer implementations.
 */

export interface TransferParams {
  /** Aztec wallet instance (from connectAztecWallet) */
  wallet: any;
  /** Recipient Aztec address (string) */
  to: string;
  /** Amount in token base units (bigint) */
  amount: bigint;
  /** Deployed TokenContract address */
  tokenAddress: string;
}

export interface TransferResult {
  txHash: string;
  status: 'pending' | 'mined' | 'failed';
}

export async function privateTransfer(params: TransferParams): Promise<TransferResult> {
  const zkMode = process.env.NEXT_PUBLIC_ZK_MODE;
  if (zkMode !== 'testnet') {
    throw Object.assign(
      new Error('Private transfers require NEXT_PUBLIC_ZK_MODE=testnet'),
      { status: 503 }
    );
  }

  try {
    const { TokenContract, AztecAddress } = (await import('@aztec/aztec.js')) as any;

    const token = await TokenContract.at(
      AztecAddress.fromString(params.tokenAddress),
      params.wallet
    );

    const toAddress = AztecAddress.fromString(params.to);
    const tx = await token.methods.transfer(toAddress, params.amount).send();
    const receipt = await tx.wait();

    return {
      txHash: receipt.txHash.toString(),
      status: receipt.status === 'success' ? 'mined' : 'failed',
    };
  } catch (err: any) {
    if (err.message?.includes('Cannot find module')) {
      throw new Error(
        'Aztec packages not installed. Install @aztec/aztec.js with a pinned stable version.'
      );
    }
    throw err;
  }
}

/**
 * Get real private balance from PXE (no localStorage).
 * Replace all localStorage.getItem('ledger_zk_balance_*') calls with this.
 */
export async function getPrivateBalance(wallet: any, tokenAddress: string): Promise<bigint> {
  const zkMode = process.env.NEXT_PUBLIC_ZK_MODE;
  if (zkMode !== 'testnet') return 0n;

  try {
    const { TokenContract, AztecAddress } = (await import('@aztec/aztec.js')) as any;
    const token = await TokenContract.at(
      AztecAddress.fromString(tokenAddress),
      wallet
    );
    return await token.methods.balance_of_private(wallet.getAddress()).simulate();
  } catch {
    return 0n;
  }
}
