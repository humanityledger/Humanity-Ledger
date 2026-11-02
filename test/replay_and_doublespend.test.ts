import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';

/**
 * Replay Attack and Double-Spend Hardening Test Suite
 * 
 * Verifies resilience of the ZK privacy protocol against transaction replays,
 * nullifier reuse, cross-session/cross-chain contamination, stale verification keys,
 * note partial-spend replay, concurrent race conditions, escrow release duplication,
 * payment stream rate replay, and stale epoch identity assertions.
 */

// ============================================================================
// SIMULATED PROTOCOL SUBSYSTEMS & MODELS (Self-Contained Inline Mocks)
// ============================================================================

/**
 * RD-01: Nullifier Store
 * Maintains the set of spent nullifiers in Aztec-style private state trees.
 */
class NullifierStore {
  private spentNullifiers = new Set<string>();

  public spend(nullifier: string): void {
    if (this.spentNullifiers.has(nullifier)) {
      throw new Error('NULLIFIER_ALREADY_SPENT');
    }
    this.spentNullifiers.add(nullifier);
  }

  public isSpent(nullifier: string): boolean {
    return this.spentNullifiers.has(nullifier);
  }

  public count(): number {
    return this.spentNullifiers.size;
  }
}

/**
 * RD-02: Session-Scoped Transaction Processor
 * Verifies nonce domains and domain-separated cryptographic signatures per session.
 */
interface SessionTransaction {
  sessionId: string;
  nonce: number;
  payload: string;
  signature: string;
}

class SessionTxProcessor {
  private sessionNonces = new Map<string, number>();
  private readonly secretKey = 'session_domain_secret_key';

  public registerSession(sessionId: string): void {
    this.sessionNonces.set(sessionId, 0);
  }

  public signTransaction(sessionId: string, nonce: number, payload: string): string {
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(`SESSION_DOMAIN:${sessionId}:${nonce}:${payload}`)
      .digest('hex');
  }

  public processTransaction(targetSessionId: string, tx: SessionTransaction): { success: boolean; txHash: string } {
    if (tx.sessionId !== targetSessionId) {
      throw new Error(`TRANSACTION_SESSION_MISMATCH: tx session ${tx.sessionId} cannot be executed in session ${targetSessionId}`);
    }

    const expectedNonce = this.sessionNonces.get(targetSessionId);
    if (expectedNonce === undefined) {
      throw new Error(`SESSION_NOT_FOUND: ${targetSessionId}`);
    }

    if (tx.nonce !== expectedNonce) {
      throw new Error(`INVALID_NONCE: expected ${expectedNonce}, received ${tx.nonce}`);
    }

    const expectedSig = this.signTransaction(tx.sessionId, tx.nonce, tx.payload);
    if (tx.signature !== expectedSig) {
      throw new Error('INVALID_SESSION_SIGNATURE: domain signature mismatch');
    }

    // Advance session nonce domain
    this.sessionNonces.set(targetSessionId, expectedNonce + 1);

    const txHash = crypto.createHash('sha256').update(`${targetSessionId}:${tx.nonce}:${tx.signature}`).digest('hex');
    return { success: true, txHash };
  }
}

/**
 * RD-03: Verification Key (VK) Registry and Proof Verifier
 * Enforces circuit VK integrity and blocks proof submissions using superseded/rotated VKs.
 */
interface ZKCircuitProof {
  circuitId: string;
  vkHash: string;
  proofData: string;
  publicInputs: string[];
}

class VKVerifierRegistry {
  private activeVKs = new Map<string, string>(); // circuitId -> vkHash
  private deprecatedVKs = new Set<string>();

  public registerCircuitVK(circuitId: string, vkHash: string): void {
    this.activeVKs.set(circuitId, vkHash);
  }

  public rotateCircuitVK(circuitId: string, newVkHash: string): void {
    const oldVk = this.activeVKs.get(circuitId);
    if (oldVk) {
      this.deprecatedVKs.add(oldVk);
    }
    this.activeVKs.set(circuitId, newVkHash);
  }

  public verifyProof(proof: ZKCircuitProof): boolean {
    const currentActiveVK = this.activeVKs.get(proof.circuitId);
    if (!currentActiveVK) {
      throw new Error(`UNKNOWN_CIRCUIT: circuit "${proof.circuitId}" not registered`);
    }

    if (proof.vkHash !== currentActiveVK) {
      if (this.deprecatedVKs.has(proof.vkHash)) {
        throw new Error(`PROOF_VK_ROTATED_REJECTED: proof generated under rotated VK "${proof.vkHash}", active is "${currentActiveVK}"`);
      }
      throw new Error(`INVALID_VK_HASH: proof VK "${proof.vkHash}" does not match active VK "${currentActiveVK}"`);
    }

    // Proof verification passes under active VK
    return true;
  }
}

/**
 * RD-04: Timed Transaction Validator
 * Rejects transactions with a timestamp older than 300 seconds (TTL window).
 */
const MAX_TX_LIFETIME_SECONDS = 300;

interface TimedTx {
  txId: string;
  timestamp: number; // Unix timestamp in seconds
  payload: Record<string, unknown>;
}

class TimedTxValidator {
  public validateTimestamp(tx: TimedTx, currentBlockTimestamp: number): { valid: boolean; ageSeconds: number } {
    const ageSeconds = currentBlockTimestamp - tx.timestamp;

    if (ageSeconds > MAX_TX_LIFETIME_SECONDS) {
      throw new Error(`TRANSACTION_EXPIRED: transaction age ${ageSeconds}s exceeds maximum allowed lifespan of ${MAX_TX_LIFETIME_SECONDS}s`);
    }

    if (ageSeconds < -15) {
      throw new Error(`TRANSACTION_FUTURE_TIMESTAMP: transaction timestamp is ${Math.abs(ageSeconds)}s in the future`);
    }

    return { valid: true, ageSeconds };
  }
}

/**
 * RD-05: Cross-Chain Domain Replay Guard
 * Rejects transactions executed on chain IDs other than the one bound in the signature domain.
 */
interface CrossChainTx {
  chainId: number;
  nonce: number;
  sender: string;
  data: string;
  signature: string;
}

class CrossChainEngine {
  constructor(public readonly chainId: number) {}

  public static signTx(chainId: number, nonce: number, sender: string, data: string, secretKey: string): string {
    return crypto
      .createHmac('sha256', secretKey)
      .update(`EIP155_DOMAIN:chainId=${chainId}:nonce=${nonce}:sender=${sender}:data=${data}`)
      .digest('hex');
  }

  public executeTransaction(tx: CrossChainTx, secretKey: string): { success: boolean; chainId: number } {
    if (tx.chainId !== this.chainId) {
      throw new Error(`CROSS_CHAIN_REPLAY_REJECTED: tx chainId ${tx.chainId} does not match engine chainId ${this.chainId}`);
    }

    const expectedSig = CrossChainEngine.signTx(tx.chainId, tx.nonce, tx.sender, tx.data, secretKey);
    if (tx.signature !== expectedSig) {
      throw new Error('INVALID_CHAIN_SIGNATURE: signature does not match target chain domain');
    }

    return { success: true, chainId: this.chainId };
  }
}

/**
 * RD-06: UTXO Private Note Spending Engine
 * Spends a note completely, produces change notes if partial, and rejects reusing the parent note.
 */
interface PrivateNote {
  noteId: string;
  nullifier: string;
  value: number;
  owner: string;
  isSpent: boolean;
}

class NoteLedger {
  private notes = new Map<string, PrivateNote>();
  private spentNullifiers = new Set<string>();

  public createNote(noteId: string, value: number, owner: string): PrivateNote {
    const nullifier = crypto.createHash('sha256').update(`nullifier:${noteId}:${owner}`).digest('hex');
    const note: PrivateNote = { noteId, nullifier, value, owner, isSpent: false };
    this.notes.set(noteId, note);
    return note;
  }

  public getNote(noteId: string): PrivateNote | undefined {
    return this.notes.get(noteId);
  }

  public spendNote(
    noteId: string,
    spendAmount: number,
    changeNoteId: string,
  ): { spentNote: PrivateNote; changeNote?: PrivateNote } {
    const note = this.notes.get(noteId);
    if (!note) {
      throw new Error('NOTE_NOT_FOUND');
    }

    if (note.isSpent || this.spentNullifiers.has(note.nullifier)) {
      throw new Error('NOTE_ALREADY_SPENT: note nullifier has already been consumed on-chain');
    }

    if (spendAmount <= 0) {
      throw new Error('INVALID_SPEND_AMOUNT');
    }

    if (spendAmount > note.value) {
      throw new Error(`INSUFFICIENT_NOTE_BALANCE: note value ${note.value} < spend amount ${spendAmount}`);
    }

    // Consume original note completely
    note.isSpent = true;
    this.spentNullifiers.add(note.nullifier);

    // Create change note if partial spend
    let changeNote: PrivateNote | undefined;
    const change = note.value - spendAmount;
    if (change > 0) {
      changeNote = this.createNote(changeNoteId, change, note.owner);
    }

    return { spentNote: note, changeNote };
  }
}

/**
 * RD-07: Concurrent Double-Spend Race Processor
 * Uses a mutex-like reservation Set to guarantee mutual exclusion under parallel execution.
 */
class ConcurrentSpendManager {
  private committedNullifiers = new Set<string>();
  private pendingLocks = new Set<string>(); // Mutex-like Set for in-flight transactions

  public async processSpend(noteId: string, nullifier: string, amount: number): Promise<{ success: boolean; txId: string }> {
    // Atomic check-and-lock reservation
    if (this.committedNullifiers.has(nullifier) || this.pendingLocks.has(nullifier)) {
      throw new Error('CONCURRENT_DOUBLE_SPEND_REJECTED: nullifier already locked or committed');
    }

    this.pendingLocks.add(nullifier);

    try {
      // Simulate asynchronous execution, proof validation latency, and state commitment
      await new Promise((resolve) => setTimeout(resolve, 25));

      // Re-verify before commit
      if (this.committedNullifiers.has(nullifier)) {
        throw new Error('CONCURRENT_DOUBLE_SPEND_REJECTED: nullifier committed during flight');
      }

      this.committedNullifiers.add(nullifier);
      const txId = crypto.createHash('sha256').update(`${noteId}:${nullifier}:${Date.now()}:${Math.random()}`).digest('hex');
      return { success: true, txId };
    } finally {
      // Release in-flight reservation lock
      this.pendingLocks.delete(nullifier);
    }
  }

  public getCommittedCount(): number {
    return this.committedNullifiers.size;
  }
}

/**
 * RD-08: Escrow Release Proof Verifier
 * Prevents replay of escrow release proofs.
 */
interface EscrowState {
  escrowId: string;
  amount: bigint;
  status: 'FUNDED' | 'RELEASED' | 'REFUNDED';
  releaseNullifier?: string;
}

class EscrowManager {
  private escrows = new Map<string, EscrowState>();
  private usedReleaseNullifiers = new Set<string>();

  public createEscrow(escrowId: string, amount: bigint): void {
    this.escrows.set(escrowId, { escrowId, amount, status: 'FUNDED' });
  }

  public getEscrow(escrowId: string): EscrowState | undefined {
    return this.escrows.get(escrowId);
  }

  public releaseEscrow(escrowId: string, proof: { releaseNullifier: string; zkProofBytes: string }): void {
    const escrow = this.escrows.get(escrowId);
    if (!escrow) {
      throw new Error(`ESCROW_NOT_FOUND: ${escrowId}`);
    }

    if (escrow.status === 'RELEASED') {
      throw new Error('ESCROW_ALREADY_RELEASED: escrow has already been unlocked and disbursed');
    }

    if (this.usedReleaseNullifiers.has(proof.releaseNullifier)) {
      throw new Error('ESCROW_PROOF_REPLAY_DETECTED: release nullifier already consumed');
    }

    // Mark nullifier as spent and change escrow status
    this.usedReleaseNullifiers.add(proof.releaseNullifier);
    escrow.status = 'RELEASED';
    escrow.releaseNullifier = proof.releaseNullifier;
  }
}

/**
 * RD-09: Stream Rate Proof Replay Guard
 * Prevents double-claiming or replaying interval rate proofs on payment streams.
 */
interface StreamRateProof {
  streamId: string;
  intervalNonce: number;
  rateProofNullifier: string;
  claimAmount: bigint;
  zkProof: string;
}

class StreamRateManager {
  private streamLastInterval = new Map<string, number>();
  private usedRateNullifiers = new Set<string>();

  public registerStream(streamId: string): void {
    this.streamLastInterval.set(streamId, -1);
  }

  public claimIntervalPayout(proof: StreamRateProof): { success: boolean; claimedInterval: number } {
    if (this.usedRateNullifiers.has(proof.rateProofNullifier)) {
      throw new Error('STREAM_RATE_REPLAY_REJECTED: rate proof nullifier already consumed');
    }

    const lastSettled = this.streamLastInterval.get(proof.streamId);
    if (lastSettled === undefined) {
      throw new Error(`STREAM_NOT_FOUND: ${proof.streamId}`);
    }

    if (proof.intervalNonce <= lastSettled) {
      throw new Error(`STREAM_RATE_STALE_NONCE: intervalNonce ${proof.intervalNonce} <= lastSettled ${lastSettled}`);
    }

    this.usedRateNullifiers.add(proof.rateProofNullifier);
    this.streamLastInterval.set(proof.streamId, proof.intervalNonce);

    return { success: true, claimedInterval: proof.intervalNonce };
  }
}

/**
 * RD-10: Identity Assertion Epoch Bound Engine
 * Prevents reusing identity proofs across epoch boundaries or multiple times in the same epoch.
 */
interface IdentityAssertionProof {
  actionId: string;
  epoch: number;
  epochNullifier: string;
  identityCommitment: string;
  zkProof: string;
}

class IdentityAssertionEngine {
  private currentEpoch = 1;
  private epochNullifiers = new Map<number, Set<string>>();

  public advanceEpoch(): void {
    this.currentEpoch += 1;
  }

  public getCurrentEpoch(): number {
    return this.currentEpoch;
  }

  public assertIdentity(proof: IdentityAssertionProof): { verified: boolean; epoch: number } {
    // 1. Epoch check: Proof must strictly match the current active epoch
    if (proof.epoch !== this.currentEpoch) {
      throw new Error(`IDENTITY_PROOF_EPOCH_MISMATCH: proof epoch ${proof.epoch} does not match active epoch ${this.currentEpoch}`);
    }

    // 2. Intra-epoch replay check
    let nullifierSet = this.epochNullifiers.get(this.currentEpoch);
    if (!nullifierSet) {
      nullifierSet = new Set<string>();
      this.epochNullifiers.set(this.currentEpoch, nullifierSet);
    }

    if (nullifierSet.has(proof.epochNullifier)) {
      throw new Error('IDENTITY_ASSERTION_ALREADY_USED_IN_EPOCH: nullifier already consumed for this epoch');
    }

    nullifierSet.add(proof.epochNullifier);
    return { verified: true, epoch: this.currentEpoch };
  }
}

// ============================================================================
// TEST SUITE: Replay Attack and Double-Spend Hardening
// ============================================================================

describe('Replay Attack and Double-Spend Hardening', () => {

  // --------------------------------------------------------------------------
  // RD-01: Nullifier Replay
  // --------------------------------------------------------------------------
  it('RD-01: Nullifier replay — simulate a nullifier store; verify that submitting the same nullifier twice throws NULLIFIER_ALREADY_SPENT', () => {
    const store = new NullifierStore();
    const testNullifier = '0x' + crypto.randomBytes(32).toString('hex');

    expect(store.isSpent(testNullifier)).toBe(false);

    // First spend: succeeds and marks nullifier as spent
    expect(() => store.spend(testNullifier)).not.toThrow();
    expect(store.isSpent(testNullifier)).toBe(true);
    expect(store.count()).toBe(1);

    // Adversarial replay: attempting to submit the same nullifier a second time
    expect(() => store.spend(testNullifier)).toThrow('NULLIFIER_ALREADY_SPENT');
    expect(store.count()).toBe(1);
  });

  // --------------------------------------------------------------------------
  // RD-02: Transaction Replay Across Sessions
  // --------------------------------------------------------------------------
  it('RD-02: Transaction replay across sessions — verify that a transaction signed in session A cannot be replayed in session B (different nonce domain)', () => {
    const processor = new SessionTxProcessor();
    const sessionA = 'sess_user_alpha_101';
    const sessionB = 'sess_user_beta_202';

    processor.registerSession(sessionA);
    processor.registerSession(sessionB);

    // Sign a valid transaction specifically bound to session A (nonce = 0)
    const payload = JSON.stringify({ action: 'TRANSFER', recipient: '0xBob', amount: 100 });
    const sigA = processor.signTransaction(sessionA, 0, payload);
    const txA: SessionTransaction = {
      sessionId: sessionA,
      nonce: 0,
      payload,
      signature: sigA,
    };

    // Legitimate execution in session A succeeds
    const resultA = processor.processTransaction(sessionA, txA);
    expect(resultA.success).toBe(true);

    // Attack 1: Replay exact txA directly into session B
    expect(() => processor.processTransaction(sessionB, txA)).toThrow(/TRANSACTION_SESSION_MISMATCH/);

    // Attack 2: Adversary modifies tx.sessionId to sessionB while keeping signature generated under session A
    const tamperedTx: SessionTransaction = {
      ...txA,
      sessionId: sessionB,
      nonce: 0,
    };
    expect(() => processor.processTransaction(sessionB, tamperedTx)).toThrow(/INVALID_SESSION_SIGNATURE/);
  });

  // --------------------------------------------------------------------------
  // RD-03: Proof Replay After VK Rotation
  // --------------------------------------------------------------------------
  it('RD-03: Proof replay after VK rotation — verify that a proof generated under VK_v1 is rejected after VK has been updated to VK_v2', () => {
    const registry = new VKVerifierRegistry();
    const circuitId = 'escrow_circuit';
    const vk_v1 = '0x1111111111111111111111111111111111111111111111111111111111111111';
    const vk_v2 = '0x2222222222222222222222222222222222222222222222222222222222222222';

    // Register initial circuit VK_v1
    registry.registerCircuitVK(circuitId, vk_v1);

    // Proof generated under VK_v1
    const proofV1: ZKCircuitProof = {
      circuitId,
      vkHash: vk_v1,
      proofData: '0xdeadbeef_proof_v1',
      publicInputs: ['0x100', '0x200'],
    };

    // Before rotation: proof verifies successfully
    expect(registry.verifyProof(proofV1)).toBe(true);

    // Security upgrade: Rotate VK to VK_v2 (e.g., bugfix or constraint hardening)
    registry.rotateCircuitVK(circuitId, vk_v2);

    // Adversarial replay: Attempt to submit old proofV1 after VK rotation
    expect(() => registry.verifyProof(proofV1)).toThrow(/PROOF_VK_ROTATED_REJECTED/);

    // A fresh proof generated under VK_v2 is accepted
    const proofV2: ZKCircuitProof = {
      circuitId,
      vkHash: vk_v2,
      proofData: '0xfeedface_proof_v2',
      publicInputs: ['0x100', '0x200'],
    };
    expect(registry.verifyProof(proofV2)).toBe(true);
  });

  // --------------------------------------------------------------------------
  // RD-04: Timestamp Expiry
  // --------------------------------------------------------------------------
  it('RD-04: Timestamp expiry — verify that a transaction with a timestamp older than 300 seconds is rejected', () => {
    const validator = new TimedTxValidator();
    const currentBlockTimestamp = 1700001000;

    // Transaction 1: Fresh transaction (50 seconds old) -> Valid
    const freshTx: TimedTx = {
      txId: 'tx_fresh_001',
      timestamp: currentBlockTimestamp - 50,
      payload: { to: '0xAlice', amount: 50 },
    };
    expect(validator.validateTimestamp(freshTx, currentBlockTimestamp).valid).toBe(true);

    // Transaction 2: Right at boundary (300 seconds old) -> Valid
    const boundaryTx: TimedTx = {
      txId: 'tx_boundary_002',
      timestamp: currentBlockTimestamp - 300,
      payload: { to: '0xAlice', amount: 50 },
    };
    expect(validator.validateTimestamp(boundaryTx, currentBlockTimestamp).valid).toBe(true);

    // Transaction 3: Stale transaction (301 seconds old) -> Expired and rejected
    const expiredTx301: TimedTx = {
      txId: 'tx_stale_003',
      timestamp: currentBlockTimestamp - 301,
      payload: { to: '0xAlice', amount: 50 },
    };
    expect(() => validator.validateTimestamp(expiredTx301, currentBlockTimestamp)).toThrow('TRANSACTION_EXPIRED');

    // Transaction 4: Severely stale transaction (600 seconds old) -> Expired and rejected
    const staleTx600: TimedTx = {
      txId: 'tx_stale_004',
      timestamp: currentBlockTimestamp - 600,
      payload: { to: '0xAlice', amount: 50 },
    };
    expect(() => validator.validateTimestamp(staleTx600, currentBlockTimestamp)).toThrow('TRANSACTION_EXPIRED');
  });

  // --------------------------------------------------------------------------
  // RD-05: Cross-Chain Replay
  // --------------------------------------------------------------------------
  it('RD-05: Cross-chain replay — verify that a transaction signed for chainId 1 (mainnet) is rejected on chainId 31337 (testnet)', () => {
    const mainnetChainId = 1;
    const testnetChainId = 31337;
    const secretKey = 'shared_secret_signer_key';
    const sender = '0x71C83606a297cdBE2F9aE9b422F0f531F3b1fB9E';
    const data = 'DEPOSIT_ESCROW:1000';

    const testnetEngine = new CrossChainEngine(testnetChainId);
    const mainnetEngine = new CrossChainEngine(mainnetChainId);

    // Legitimate signature created for Mainnet (chainId = 1)
    const mainnetSig = CrossChainEngine.signTx(mainnetChainId, 0, sender, data, secretKey);
    const mainnetTx: CrossChainTx = {
      chainId: mainnetChainId,
      nonce: 0,
      sender,
      data,
      signature: mainnetSig,
    };

    // Valid on mainnet
    expect(mainnetEngine.executeTransaction(mainnetTx, secretKey).success).toBe(true);

    // Adversarial replay: Submit the mainnet transaction unmodified to testnet engine
    expect(() => testnetEngine.executeTransaction(mainnetTx, secretKey)).toThrow(/CROSS_CHAIN_REPLAY_REJECTED/);

    // Adversarial replay 2: Attacker changes chainId field to 31337 without knowledge of private key
    const forgedChainTx: CrossChainTx = {
      ...mainnetTx,
      chainId: testnetChainId,
    };
    expect(() => testnetEngine.executeTransaction(forgedChainTx, secretKey)).toThrow('INVALID_CHAIN_SIGNATURE');
  });

  // --------------------------------------------------------------------------
  // RD-06: Partial Spend Replay
  // --------------------------------------------------------------------------
  it('RD-06: Partial spend replay — verify that spending 50 from a note of 100 marks the note as spent, and a second spend of 50 from the same note is rejected', () => {
    const ledger = new NoteLedger();
    const owner = '0xPrivateUser42';

    // User holds an unspent note of 100 units
    const originalNote = ledger.createNote('note_orig_100', 100, owner);
    expect(originalNote.isSpent).toBe(false);

    // Spend 50 from the 100 note
    const spendResult1 = ledger.spendNote('note_orig_100', 50, 'note_change_50');
    expect(spendResult1.spentNote.isSpent).toBe(true);
    expect(spendResult1.changeNote).toBeDefined();
    expect(spendResult1.changeNote?.value).toBe(50);
    expect(spendResult1.changeNote?.isSpent).toBe(false);

    // Attack: Attempt to spend another 50 from the original note (double-spending original note instead of change note)
    expect(() => ledger.spendNote('note_orig_100', 50, 'note_attack_change')).toThrow(
      'NOTE_ALREADY_SPENT: note nullifier has already been consumed on-chain',
    );

    // Verifying that spending the legitimate change note succeeds
    const spendResult2 = ledger.spendNote('note_change_50', 50, 'note_change_zero');
    expect(spendResult2.spentNote.isSpent).toBe(true);
    expect(spendResult2.changeNote).toBeUndefined(); // Zero change produced
  });

  // --------------------------------------------------------------------------
  // RD-07: Concurrent Double-Spend Race
  // --------------------------------------------------------------------------
  it('RD-07: Concurrent double-spend race — simulate two concurrent spend attempts on the same note; verify that exactly one succeeds and one fails (using a mutex-like Set)', async () => {
    const manager = new ConcurrentSpendManager();
    const noteId = 'note_utxo_target_777';
    const sharedNullifier = '0x' + crypto.createHash('sha256').update(noteId).digest('hex');

    // Launch two concurrent spend requests with the exact same note and nullifier
    const spendPromise1 = manager.processSpend(noteId, sharedNullifier, 75);
    const spendPromise2 = manager.processSpend(noteId, sharedNullifier, 75);

    const results = await Promise.allSettled([spendPromise1, spendPromise2]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Invariant: Exactly one request must succeed, and exactly one must fail
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    // Verify rejection error reason
    const failureReason = (rejected[0] as PromiseRejectedResult).reason;
    expect(failureReason.message).toContain('CONCURRENT_DOUBLE_SPEND_REJECTED');

    // Verify exactly one nullifier is committed
    expect(manager.getCommittedCount()).toBe(1);
  });

  // --------------------------------------------------------------------------
  // RD-08: Escrow Release Replay
  // --------------------------------------------------------------------------
  it('RD-08: Escrow release replay — verify that an escrow release proof cannot be used twice', () => {
    const escrowManager = new EscrowManager();
    const escrowId = 'escrow_contract_0x99';
    escrowManager.createEscrow(escrowId, 5000n);

    const releaseProof = {
      releaseNullifier: '0x' + crypto.randomBytes(32).toString('hex'),
      zkProofBytes: '0x1234escrowzkproof',
    };

    // First release: Escrow is successfully unlocked and disbursed
    expect(() => escrowManager.releaseEscrow(escrowId, releaseProof)).not.toThrow();
    const escrowState = escrowManager.getEscrow(escrowId);
    expect(escrowState?.status).toBe('RELEASED');
    expect(escrowState?.releaseNullifier).toBe(releaseProof.releaseNullifier);

    // Adversarial replay: Attempt to call releaseEscrow with the same proof again
    expect(() => escrowManager.releaseEscrow(escrowId, releaseProof)).toThrow(
      'ESCROW_ALREADY_RELEASED: escrow has already been unlocked and disbursed',
    );

    // Secondary attack: Attempt to use the consumed release proof on a different newly created escrow
    const secondEscrowId = 'escrow_contract_0x100';
    escrowManager.createEscrow(secondEscrowId, 2500n);
    expect(() => escrowManager.releaseEscrow(secondEscrowId, releaseProof)).toThrow(
      'ESCROW_PROOF_REPLAY_DETECTED: release nullifier already consumed',
    );
  });

  // --------------------------------------------------------------------------
  // RD-09: Stream Rate Replay
  // --------------------------------------------------------------------------
  it('RD-09: Stream rate replay — verify that submitting the same rate proof twice is rejected', () => {
    const streamManager = new StreamRateManager();
    const streamId = 'stream_live_payout_888';
    streamManager.registerStream(streamId);

    const rateProofNullifier = '0x' + crypto.randomBytes(32).toString('hex');
    const intervalProof: StreamRateProof = {
      streamId,
      intervalNonce: 0,
      rateProofNullifier,
      claimAmount: 100n,
      zkProof: '0xstreamzkproof_interval_0',
    };

    // First claim: Successfully claims interval 0
    const claim1 = streamManager.claimIntervalPayout(intervalProof);
    expect(claim1.success).toBe(true);
    expect(claim1.claimedInterval).toBe(0);

    // Adversarial replay: Submit the exact same rate proof a second time
    expect(() => streamManager.claimIntervalPayout(intervalProof)).toThrow(
      'STREAM_RATE_REPLAY_REJECTED: rate proof nullifier already consumed',
    );

    // Attack with new nullifier but stale intervalNonce (intervalNonce 0 <= lastSettled 0)
    const staleIntervalProof: StreamRateProof = {
      ...intervalProof,
      intervalNonce: 0,
      rateProofNullifier: '0x' + crypto.randomBytes(32).toString('hex'), // fresh nullifier
    };
    expect(() => streamManager.claimIntervalPayout(staleIntervalProof)).toThrow(/STREAM_RATE_STALE_NONCE/);

    // Legitimate subsequent interval (intervalNonce 1) succeeds
    const nextIntervalProof: StreamRateProof = {
      streamId,
      intervalNonce: 1,
      rateProofNullifier: '0x' + crypto.randomBytes(32).toString('hex'),
      claimAmount: 100n,
      zkProof: '0xstreamzkproof_interval_1',
    };
    const claim2 = streamManager.claimIntervalPayout(nextIntervalProof);
    expect(claim2.success).toBe(true);
    expect(claim2.claimedInterval).toBe(1);
  });

  // --------------------------------------------------------------------------
  // RD-10: Identity Assertion Replay
  // --------------------------------------------------------------------------
  it('RD-10: Identity assertion replay — verify that an identity proof cannot be replayed after the epoch advances', () => {
    const identityEngine = new IdentityAssertionEngine();
    expect(identityEngine.getCurrentEpoch()).toBe(1);

    const epoch1Nullifier = '0x' + crypto.randomBytes(32).toString('hex');
    const proofEpoch1: IdentityAssertionProof = {
      actionId: 'POLARIS_GOVERNANCE_VOTE',
      epoch: 1,
      epochNullifier: epoch1Nullifier,
      identityCommitment: '0xiden_commitment_001',
      zkProof: '0xidentity_zk_proof_epoch_1',
    };

    // First assertion in Epoch 1 succeeds
    const result1 = identityEngine.assertIdentity(proofEpoch1);
    expect(result1.verified).toBe(true);
    expect(result1.epoch).toBe(1);

    // Replay attack within the same epoch: Attempting to assert twice in Epoch 1 fails
    expect(() => identityEngine.assertIdentity(proofEpoch1)).toThrow(
      'IDENTITY_ASSERTION_ALREADY_USED_IN_EPOCH: nullifier already consumed for this epoch',
    );

    // Epoch advances (e.g. governance round closes or next day begins)
    identityEngine.advanceEpoch();
    expect(identityEngine.getCurrentEpoch()).toBe(2);

    // Adversarial replay across epoch boundary: Attempting to reuse the Epoch 1 proof in Epoch 2
    expect(() => identityEngine.assertIdentity(proofEpoch1)).toThrow(/IDENTITY_PROOF_EPOCH_MISMATCH/);

    // A fresh proof generated for Epoch 2 succeeds
    const epoch2Nullifier = '0x' + crypto.randomBytes(32).toString('hex');
    const proofEpoch2: IdentityAssertionProof = {
      actionId: 'POLARIS_GOVERNANCE_VOTE',
      epoch: 2,
      epochNullifier: epoch2Nullifier,
      identityCommitment: '0xiden_commitment_001',
      zkProof: '0xidentity_zk_proof_epoch_2',
    };
    const result2 = identityEngine.assertIdentity(proofEpoch2);
    expect(result2.verified).toBe(true);
    expect(result2.epoch).toBe(2);
  });
});
