import { ethers } from 'ethers';
import { ChainId, blockchainService } from './BlockchainService';

/**
 * TxBuilder
 * Elite-grade transaction construction engine.
 * Handles EIP-1559 gas estimation with precision and safety buffers.
 */
export class TxBuilder {
  /**
   * Constructs an EIP-1559 transaction.
   */
  public async buildTransaction(
    chainId: ChainId,
    from: string,
    to: string,
    value: string,
    data: string = '0x'
  ): Promise<ethers.TransactionRequest> {
    const provider = blockchainService.getProvider(chainId);
    const feeData = await provider.getFeeData();

    // Elite safety buffer: 10%
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas 
      ? (feeData.maxPriorityFeePerGas * BigInt(110)) / BigInt(100)
      : undefined;

    const maxFeePerGas = feeData.maxFeePerGas
      ? (feeData.maxFeePerGas * BigInt(110)) / BigInt(100)
      : undefined;

    const tx: ethers.TransactionRequest = {
      from,
      to,
      value: ethers.parseEther(value),
      data,
      chainId,
      type: 2, // EIP-1559
      maxPriorityFeePerGas,
      maxFeePerGas,
    };

    // Precision gas estimation
    let gasLimit: bigint;
    try {
      gasLimit = await provider.estimateGas(tx);
    } catch (err: any) {
      console.error("[TxBuilder] Gas estimation reverted:", err);
      // Fallback buffer or custom throw for insufficient funds
      throw new Error(err.message.includes("insufficient funds") ? "INSUFFICIENT_FUNDS" : "CONTRACT_REVERT");
    }
    // Add 10% buffer to gas limit for complex contract interactions
    tx.gasLimit = (gasLimit * BigInt(110)) / BigInt(100);

    return tx;
  }

  /**
   * Builds a transaction for a token transfer.
   */
  public async buildTokenTransfer(
    chainId: ChainId,
    from: string,
    tokenAddress: string,
    recipient: string,
    amount: string,
    decimals: number
  ): Promise<ethers.TransactionRequest> {
    const erc20Interface = new ethers.Interface([
      'function transfer(address to, uint256 amount) returns (bool)'
    ]);
    
    const data = erc20Interface.encodeFunctionData('transfer', [
      recipient,
      ethers.parseUnits(amount, decimals)
    ]);

    return this.buildTransaction(chainId, from, tokenAddress, '0', data);
  }
}

export const txBuilder = new TxBuilder();


