import { ethers } from 'ethers';

// -----------------------------------------------------------------------------
// STRICT ON-CHAIN TRANSACTION MANAGER
// WARNING: Handles Mempool Nonces, EIP-1559 Overwrites, and EIP-712 Signatures.
// -----------------------------------------------------------------------------

export class TransactionManager {
  private wallet: ethers.Wallet;
  private provider: ethers.Provider;
  
  // Extradimensional Quantum Nonce Tracker (Mutex / Local Cache)
  // Prevents 'Nonce too low' EVM reverts when rapid-firing transactions before the Mempool updates.
  private static localNonceCache: Map<string, { nonce: number, timestamp: number }> = new Map();
  private static nonceMutex: Map<string, Promise<void>> = new Map();

  constructor(wallet: ethers.Wallet) {
    if (!wallet.provider) throw new Error("Wallet must be connected to a Provider.");
    this.wallet = wallet;
    this.provider = wallet.provider;
  }

  /**
   * Safe Nonce Acquisition Engine.
   * Compares the network's pending nonce with our local optimistic nonce.
   */
  async getSafeNextNonce(): Promise<number> {
    const address = this.wallet.address.toLowerCase();
    
    // Asynchronous Mutex to prevent TOCTOU race conditions
    while (TransactionManager.nonceMutex.get(address)) {
      await TransactionManager.nonceMutex.get(address);
    }
    
    let releaseMutex: () => void;
    const mutexPromise = new Promise<void>(resolve => { releaseMutex = resolve; });
    TransactionManager.nonceMutex.set(address, mutexPromise);
    
    try {
    const networkPending = await this.provider.getTransactionCount(this.wallet.address, "pending");
    
    const local = TransactionManager.localNonceCache.get(address);
    const now = Date.now();

    // If local cache exists and is newer than 30 seconds, and local is >= network, use local
    if (local && (now - local.timestamp < 30000) && local.nonce >= networkPending) {
      const nextNonce = local.nonce + 1;
      TransactionManager.localNonceCache.set(address, { nonce: nextNonce, timestamp: now });
      return nextNonce;
    }

    // Otherwise, trust the network and seed the cache
    TransactionManager.localNonceCache.set(address, { nonce: networkPending, timestamp: now });
    return networkPending;
    } finally {
      TransactionManager.nonceMutex.delete(address);
      releaseMutex!();
    }
  }

  /**
   * Fetches the current nonce directly from the execution client.
   * Compares "pending" vs "latest" to detect stuck transactions.
   */
  async getNonceStatus(): Promise<{ latest: number, pending: number }> {
    const latest = await this.provider.getTransactionCount(this.wallet.address, "latest");
    const pending = await this.provider.getTransactionCount(this.wallet.address, "pending");
    return { latest, pending };
  }

  /**
   * Accelerates a pending transaction by re-broadcasting it with the exact same nonce
   * but a 10% to 50% higher maxFeePerGas and maxPriorityFeePerGas.
   */
  async speedUpTransaction(pendingTxHash: string): Promise<ethers.TransactionReceipt | null> {
    const tx = await this.provider.getTransaction(pendingTxHash);
    if (!tx || tx.blockNumber !== null) {
      throw new Error("Transaction is either already mined or dropped from mempool.");
    }

    console.log(`[TX-MANAGER] Accelerating Nonce ${tx.nonce}...`);

    const newPriorityFee = (tx.maxPriorityFeePerGas || 1000000000n) * 150n / 100n; // +50%
    const newMaxFee = (tx.maxFeePerGas || (newPriorityFee * 2n)) * 150n / 100n;

    const accelerationRequest: ethers.TransactionRequest = {
      to: tx.to,
      value: tx.value,
      data: tx.data,
      nonce: tx.nonce,
      gasLimit: tx.gasLimit,
      type: 2,
      maxPriorityFeePerGas: newPriorityFee,
      maxFeePerGas: newMaxFee,
      chainId: tx.chainId
    };

    const newTx = await this.wallet.sendTransaction(accelerationRequest);
    console.log(`[TX-MANAGER] Broadcasted Acceleration Hash: ${newTx.hash}`);
    return await newTx.wait(1);
  }

  /**
   * Cancels a pending transaction by broadcasting a 0-value transaction to self
   * with the exact same nonce and a higher gas fee.
   */
  async cancelTransaction(nonceToCancel: number): Promise<ethers.TransactionReceipt | null> {
    console.log(`[TX-MANAGER] Compiling Cancellation Payload for Nonce ${nonceToCancel}...`);
    
    const feeData = await this.provider.getFeeData();
    const aggressivePriority = (feeData.maxPriorityFeePerGas || 2000000000n) * 2n; // 2x priority
    const aggressiveMax = (feeData.maxFeePerGas || aggressivePriority * 2n) * 2n;

    const cancelRequest: ethers.TransactionRequest = {
      to: this.wallet.address, // Send to self
      value: 0n,
      data: "0x",
      nonce: nonceToCancel,
      gasLimit: 21000n,
      type: 2,
      maxPriorityFeePerGas: aggressivePriority,
      maxFeePerGas: aggressiveMax,
      chainId: (await this.provider.getNetwork()).chainId
    };

    const newTx = await this.wallet.sendTransaction(cancelRequest);
    console.log(`[TX-MANAGER] Broadcasted Cancellation Hash: ${newTx.hash}`);
    return await newTx.wait(1);
  }

  /**
   * Constructs and signs an EIP-712 Typed Data payload.
   * Heavily used by Aztec Network and Permitted ERC20s (EIP-2612).
   */
  async signAztecTypedData(domain: any, types: any, value: any): Promise<string> {
    console.log(`[TX-MANAGER] Cryptographically Signing EIP-712 ZK Payload...`);
    const signature = await this.wallet.signTypedData(domain, types, value);
    return signature;
  }
}

