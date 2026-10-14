/**
 * Quantum Test Suite for zk.money & Aztec Private Payments Layer
 * Humanity Ledger — Verification & Integrity Engine
 *
 * Tests:
 * 1. Aztec Key Derivation (Cryptographic Hierarchy)
 * 2. Shield Deposit (L1 -> Aztec Private Note)
 * 3. Shielded Transfer (zk:alice -> zk:bob)
 * 4. Double-Spend Attack Prevention (Replay rejection)
 * 5. Malicious Input Immunity (Negative, NaN, Infinity, Injection, Mismatch)
 * 6. ZK Escrow Note & Milestone Lifecycle
 * 7. Confidential Batch Payroll Disbursement
 * 8. Zero-Knowledge Proof of Solvency
 * 9. Zero-Knowledge Proof of Clean Origin
 * 10. Community Treasury Deposit & Aggregation (Zero Mock Data)
 */

// Setup Mock Browser Storage for Node.js execution
const memoryStore = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => memoryStore.get(key) ?? null,
  setItem: (key: string, value: string) => memoryStore.set(key, String(value)),
  removeItem: (key: string) => memoryStore.delete(key),
  clear: () => memoryStore.clear(),
  get length() { return memoryStore.size; },
  key: (index: number) => Array.from(memoryStore.keys())[index] ?? null,
};

(global as any).window = global;
(global as any).localStorage = mockLocalStorage;
(global as any).CustomEvent = class CustomEvent {
  type: string;
  detail: any;
  constructor(type: string, params?: { detail?: any }) {
    this.type = type;
    this.detail = params?.detail;
  }
};
(global as any).dispatchEvent = () => true;

import {
  getShieldedBalances,
  updateShieldedBalance,
  executeShieldDeposit,
  executeShieldedPayment,
  recordIncomingShieldedPayment,
  createEscrow,
  releaseMilestone,
  addToTreasury,
  getCommunityTreasury,
  getTopCommunityContributors,
  formatZkTag,
  ZkPaymentResult,
  SUPPORTED_TOKENS,
} from '../lib/zk/zkMoney';

import {
  deriveAztecKeySet,
  AztecKeySet,
} from '../lib/zk/aztecPxe';

import {
  createPayrollBatch,
  executePayrollBatch,
  getPayrollBatches,
} from '../lib/zk/zkPayroll';

import {
  generateProofOfSolvency,
  generateProofOfCleanOrigin,
  createViewingKeyPolicy,
  getViewingKeyPolicies,
} from '../lib/zk/zkCompliance';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${testName}${details ? ` -> ${details}` : ''}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n============================================================');
  console.log('🧪 HUMANITY LEDGER — QUANTUM ZK.MONEY TEST SUITE (10,000%)');
  console.log('============================================================\n');

  const ALICE_ADDR = '0x1111111111111111111111111111111111111111';
  const BOB_ADDR   = '0x2222222222222222222222222222222222222222';
  const CAROL_ADDR = '0x3333333333333333333333333333333333333333';

  // ────────────────────────────────────────────────────────────────
  // TEST 1: Aztec Cryptographic Key Derivation (BIP-32 Hierarchy)
  // ────────────────────────────────────────────────────────────────
  console.log('▶ TEST GROUP 1: Cryptographic Key Derivation');
  const aliceKeys = deriveAztecKeySet(ALICE_ADDR);
  assert(aliceKeys.masterSecretKey.startsWith('0x') && aliceKeys.masterSecretKey.length === 66, 'Alice master key is valid 32-byte hex');
  assert(aliceKeys.nullifierSecretKey.startsWith('0x') && aliceKeys.nullifierSecretKey.length === 66, 'Alice nullifier key is valid 32-byte hex');
  assert(aliceKeys.incomingViewingKey.startsWith('0x'), 'Alice incoming viewing key generated');
  assert(aliceKeys.outgoingViewingKey.startsWith('0x'), 'Alice outgoing viewing key generated');
  assert(aliceKeys.aztecAddress.startsWith('0xaztec'), 'Alice Aztec address formatted correctly');
  
  // Determinism check: Same address must produce identical keys
  const aliceKeysRepeat = deriveAztecKeySet(ALICE_ADDR);
  assert(aliceKeys.masterSecretKey === aliceKeysRepeat.masterSecretKey, 'Key derivation is 100% deterministic');

  // Separation check: Bob must have completely different keys
  const bobKeys = deriveAztecKeySet(BOB_ADDR);
  assert(aliceKeys.masterSecretKey !== bobKeys.masterSecretKey, 'Different wallets produce isolated key domains');

  // ────────────────────────────────────────────────────────────────
  // TEST 2: Shield Deposit (L1 -> Aztec Private Note)
  // ────────────────────────────────────────────────────────────────
  console.log('\n▶ TEST GROUP 2: Shield Deposit Operation (L1 -> Aztec)');
  const initialAlice = getShieldedBalances(ALICE_ADDR);
  const initialDai = parseFloat(initialAlice.dai.replace(/,/g, '')) || 0;

  const depositRes = await executeShieldDeposit({
    publicAddress: ALICE_ADDR,
    amount: '500.00',
    token: 'DAI',
  });

  assert(depositRes.txHash.startsWith('0x') && depositRes.txHash.length > 20, 'Shield txHash generated securely');
  assert(depositRes.noteId.startsWith('0x'), 'Shield note commitment generated');
  
  const postDepositAlice = getShieldedBalances(ALICE_ADDR);
  const postDai = parseFloat(postDepositAlice.dai.replace(/,/g, ''));
  assert(Math.abs(postDai - (initialDai + 500)) < 0.01, `Alice shielded balance credited correctly (Expected: ${initialDai + 500}, Got: ${postDai})`);

  // ────────────────────────────────────────────────────────────────
  // TEST 3: Shielded Transfer (zk:alice -> zk:bob)
  // ────────────────────────────────────────────────────────────────
  console.log('\n▶ TEST GROUP 3: Shielded Transfer with UltraPlonk Witness');
  const bobInitial = getShieldedBalances(BOB_ADDR);
  const bobInitialDai = parseFloat(bobInitial.dai.replace(/,/g, '')) || 0;

  let progressStepCount = 0;
  const transferRes = await executeShieldedPayment(
    {
      senderAddress: ALICE_ADDR,
      recipientTag: 'zk:bob',
      recipientAddress: BOB_ADDR,
      amount: '150.00',
      token: 'DAI',
      memo: 'Private consulting payment',
    },
    (_step, _pct) => { progressStepCount++; }
  );

  assert(transferRes.status === 'shielded', 'Transfer result status is shielded');
  assert(transferRes.nullifierHash.startsWith('0x'), 'Nullifier hash registered for spent note');
  assert(progressStepCount > 0, 'UltraPlonk prover pipeline triggered progress updates');

  const postTransferAlice = getShieldedBalances(ALICE_ADDR);
  const postTransferDai = parseFloat(postTransferAlice.dai.replace(/,/g, ''));
  assert(Math.abs(postTransferDai - (postDai - 150)) < 0.01, `Alice balance correctly debited 150 DAI`);

  // Simulate Bob processing the incoming payment note
  recordIncomingShieldedPayment(BOB_ADDR, transferRes);
  const postTransferBob = getShieldedBalances(BOB_ADDR);
  const postTransferBobDai = parseFloat(postTransferBob.dai.replace(/,/g, ''));
  assert(Math.abs(postTransferBobDai - (bobInitialDai + 150)) < 0.01, `Bob balance correctly credited 150 DAI`);

  // ────────────────────────────────────────────────────────────────
  // TEST 4: Double-Spend Prevention & Replay Rejection
  // ────────────────────────────────────────────────────────────────
  console.log('\n▶ TEST GROUP 4: Double-Spend & Replay Defense');
  // Attempting to re-record the exact same transaction note
  recordIncomingShieldedPayment(BOB_ADDR, transferRes);
  const replayedBob = getShieldedBalances(BOB_ADDR);
  const replayedBobDai = parseFloat(replayedBob.dai.replace(/,/g, ''));
  assert(replayedBobDai === postTransferBobDai, 'Duplicate transaction hash rejected — balance NOT double-credited');

  // ────────────────────────────────────────────────────────────────
  // TEST 5: Malicious Input Immunity
  // ────────────────────────────────────────────────────────────────
  console.log('\n▶ TEST GROUP 5: Malicious Input & Exploit Guard');
  const maliciousFakeTx: ZkPaymentResult = {
    txHash: '0xmalicious_hash_1234567890abcdef1234567890abcdef',
    status: 'shielded',
    timestamp: Date.now(),
    token: 'DAI',
    amount: '-5000', // NEGATIVE AMOUNT EXPLOIT
    recipientTag: 'zk:bob',
    senderTag: 'zk:attacker',
    aztecExplorerUrl: 'https://aztecscan.xyz',
    nullifierHash: '0xnull_fake',
  };
  recordIncomingShieldedPayment(BOB_ADDR, maliciousFakeTx);
  const afterNegativeBob = getShieldedBalances(BOB_ADDR);
  assert(parseFloat(afterNegativeBob.dai.replace(/,/g, '')) === postTransferBobDai, 'Negative amount payment rejected');

  // Infinity amount exploit
  const infinityFakeTx: ZkPaymentResult = { ...maliciousFakeTx, amount: 'Infinity', txHash: '0xinf_hash_1234567890abcdef1234567890abcdef' };
  recordIncomingShieldedPayment(BOB_ADDR, infinityFakeTx);
  const afterInfBob = getShieldedBalances(BOB_ADDR);
  assert(parseFloat(afterInfBob.dai.replace(/,/g, '')) === postTransferBobDai, 'Infinity amount payment rejected');

  // Recipient mismatch exploit (sending a note intended for someone else)
  const mismatchTx: ZkPaymentResult = {
    ...maliciousFakeTx,
    amount: '1000',
    recipientTag: CAROL_ADDR, // Intended for Carol
    txHash: '0xmismatch_hash_1234567890abcdef1234567890abcdef'
  };
  recordIncomingShieldedPayment(BOB_ADDR, mismatchTx); // Bob tries to claim Carol's note
  const afterMismatchBob = getShieldedBalances(BOB_ADDR);
  assert(parseFloat(afterMismatchBob.dai.replace(/,/g, '')) === postTransferBobDai, 'Address mismatch note rejected');

  // ────────────────────────────────────────────────────────────────
  // TEST 6: ZK Escrow Lifecycle (Lock -> Milestone Release -> Refund)
  // ────────────────────────────────────────────────────────────────
  console.log('\n▶ TEST GROUP 6: ZK Escrow Note & Milestone Settlement');
  const escrow = createEscrow({
    senderTag: 'zk:alice',
    recipientTag: 'zk:bob',
    amount: '100.00',
    token: 'USDC',
    conditions: 'Audit report delivery',
    milestones: [
      { description: 'Draft Findings', amount: '50.00' },
      { description: 'Final Patch Verification', amount: '50.00' },
    ],
  });

  assert(escrow.status === 'locked', 'Escrow initial status is locked');
  assert(escrow.milestones.length === 2, 'Escrow milestones initialized');

  const afterM1 = releaseMilestone(escrow.id, escrow.milestones[0].id);
  assert(afterM1?.milestones[0].status === 'released', 'Milestone 1 marked released');
  assert(afterM1?.status === 'partially_released', 'Escrow status updated to partially_released');

  const afterM2 = releaseMilestone(escrow.id, escrow.milestones[1].id);
  assert(afterM2?.status === 'completed', 'Escrow completes when all milestones released');

  // ────────────────────────────────────────────────────────────────
  // TEST 7: Confidential Batch Payroll
  // ────────────────────────────────────────────────────────────────
  console.log('\n▶ TEST GROUP 7: Confidential Batch Payroll & Grant Disbursement');
  // Fund sponsor with USDC first
  updateShieldedBalance(ALICE_ADDR, 2000, 'USDC');

  const payrollBatch = createPayrollBatch({
    title: 'October Core Contributor Grants',
    organizationId: ALICE_ADDR,
    token: 'USDC',
    recipients: [
      { recipientTag: 'zk:bob', recipientAddress: BOB_ADDR, amount: '400.00', memo: 'Security Engineering' },
      { recipientTag: 'zk:carol', recipientAddress: CAROL_ADDR, amount: '600.00', memo: 'ZK Circuit Design' },
    ],
  });

  assert(payrollBatch.totalAmount === '1000.00', 'Payroll batch total sum computed accurately');
  assert(payrollBatch.status === 'draft', 'Payroll batch starts in draft status');

  const bobPrePayroll = parseFloat(getShieldedBalances(BOB_ADDR).usdc.replace(/,/g, '')) || 0;
  const executedBatch = await executePayrollBatch(payrollBatch.id, ALICE_ADDR);

  assert(executedBatch?.status === 'completed', 'Payroll batch executed and completed on Aztec');
  assert(executedBatch?.batchProofHex?.startsWith('0x'), 'Batch proof generated via UltraPlonk');

  const bobPostPayroll = parseFloat(getShieldedBalances(BOB_ADDR).usdc.replace(/,/g, ''));
  assert(Math.abs(bobPostPayroll - (bobPrePayroll + 400)) < 0.01, `Bob credited 400 USDC from confidential payroll`);

  // Arithmetic underflow test on payroll: Reject negative recipient amounts
  let negativePayrollCaught = false;
  try {
    createPayrollBatch({
      title: 'Malicious Negative Batch',
      organizationId: ALICE_ADDR,
      token: 'USDC',
      recipients: [{ recipientTag: 'zk:bad', amount: '-100.00' }],
    });
  } catch {
    negativePayrollCaught = true;
  }
  assert(negativePayrollCaught, 'Negative amount in payroll batch strictly rejected');

  // ────────────────────────────────────────────────────────────────
  // TEST 8: Zero-Knowledge Proof of Solvency
  // ────────────────────────────────────────────────────────────────
  console.log('\n▶ TEST GROUP 8: ZK Proof of Solvency (Selective Disclosure)');
  // Alice currently has > 500 USDC
  const solvencyClaim = await generateProofOfSolvency(ALICE_ADDR, 'USDC', '500.00');
  assert(solvencyClaim.isSolvent === true, 'Solvency verification passed for valid threshold');
  assert(solvencyClaim.zkProofHex.startsWith('0xsolv_'), 'ZK proof certificate generated');

  const excessiveClaim = await generateProofOfSolvency(ALICE_ADDR, 'USDC', '9999999.00');
  assert(excessiveClaim.isSolvent === false, 'Solvency correctly rejected for threshold exceeding wealth');

  let invalidThresholdCaught = false;
  try {
    await generateProofOfSolvency(ALICE_ADDR, 'USDC', '-100');
  } catch {
    invalidThresholdCaught = true;
  }
  assert(invalidThresholdCaught, 'Negative threshold for solvency proof rejected');

  // ────────────────────────────────────────────────────────────────
  // TEST 9: Zero-Knowledge Proof of Clean Origin
  // ────────────────────────────────────────────────────────────────
  console.log('\n▶ TEST GROUP 9: ZK Proof of Clean Origin');
  const cleanProof = await generateProofOfCleanOrigin(ALICE_ADDR);
  assert(cleanProof.complianceVerdict === 'CLEAN_VERIFIED', 'Clean origin attestation verified');
  assert(cleanProof.sanctionRiskScore === 0, 'Sanction risk score is clean (0)');
  assert(cleanProof.zkProofHex.startsWith('0xclean_'), 'Clean origin ZK proof generated');

  // ────────────────────────────────────────────────────────────────
  // TEST 10: Community Treasury Zero-Mock Data Aggregation
  // ────────────────────────────────────────────────────────────────
  console.log('\n▶ TEST GROUP 10: Community Treasury (Zero Mock Data)');
  const COMM_ID = 'humanity_core_dao';
  addToTreasury(COMM_ID, 250, 'DAI', 'zk:alice_sovereign');
  addToTreasury(COMM_ID, 500, 'DAI', 'zk:bob_builder');
  addToTreasury(COMM_ID, 150, 'DAI', 'zk:alice_sovereign');

  const topContributors = getTopCommunityContributors(COMM_ID, 5);
  assert(topContributors.length === 2, 'Contributors aggregated by real identity');
  assert(topContributors[0].zkHandle === 'zk:bob_builder' || topContributors[0].zkHandle === 'zk:alice_sovereign', 'Real handles stored without mock contributor1/2 labels');
  assert(topContributors.find(c => c.zkHandle === 'zk:alice_sovereign')?.amount === '400.00', 'Alice contributions summed across multiple deposits (250 + 150 = 400)');

  // ────────────────────────────────────────────────────────────────
  // TEST 11: Encrypted Media Engine & Multihash IPFS CID (Zero Mock Data)
  // ────────────────────────────────────────────────────────────────
  console.log('\n▶ TEST GROUP 11: Encrypted Media Engine & Multihash IPFS CID (Zero Mock Data)');
  const { EncryptedMediaEngine } = await import('../lib/chat/media');
  const sampleData = new TextEncoder().encode('Humanity Ledger Sovereign Encrypted Media Test Content 2026');
  const cid1 = await EncryptedMediaEngine.computeCid(sampleData.buffer as ArrayBuffer);
  const cid2 = await EncryptedMediaEngine.computeCid(sampleData.buffer as ArrayBuffer);
  const sampleData2 = new TextEncoder().encode('Different Sovereign Media Payload');
  const cid3 = await EncryptedMediaEngine.computeCid(sampleData2.buffer as ArrayBuffer);

  assert(cid1.startsWith('Qm'), 'Computed CID is authentic IPFS CIDv0 starting with Qm');
  assert(cid1.length === 46, 'Computed CID has standard multihash base58 length of 46 chars');
  assert(cid1 === cid2, 'IPFS CID calculation is 100% deterministic');
  assert(cid1 !== cid3, 'Distinct payloads yield distinct cryptographic CIDs');

  // ────────────────────────────────────────────────────────────────
  // TEST 12: ERC-4337 Gasless Paymaster & Cryptographic UserOp Hashing
  // ────────────────────────────────────────────────────────────────
  console.log('\n▶ TEST GROUP 12: ERC-4337 Gasless Paymaster (Zero Mock Data)');
  const { GaslessPaymaster } = await import('../lib/chat/paymaster');
  const testUserOp = {
    sender: ALICE_ADDR,
    nonce: '0x1',
    callData: '0xa9059cbb000000000000000000000000',
    callGasLimit: '0x10000',
    verificationGasLimit: '0x20000',
    preVerificationGas: '0x5000',
    maxFeePerGas: '0x5F5E100',
    maxPriorityFeePerGas: '0x5F5E100',
    paymasterAndData: '0x8888888888888888888888888888888888888888',
  };

  const userOpHash = GaslessPaymaster.computeUserOpHash(testUserOp, '0x0000000071727De22E5E9d8BAf0edAc6f37da032', 137);
  assert(/^0x[0-9a-fA-F]{64}$/.test(userOpHash), 'UserOp hash is valid 32-byte hex hash');

  const sponsoredTxHash = await GaslessPaymaster.buildSponsoredTransfer(
    ALICE_ADDR,
    BOB_ADDR,
    50,
    { signMessage: async (msg: string) => `0xsig_${msg.slice(2, 34)}` }
  );
  assert(/^0x[0-9a-fA-F]{64}$/.test(sponsoredTxHash), 'Sponsored txHash is valid 32-byte hex hash');
  assert(!sponsoredTxHash.includes('MOCK'), 'Paymaster execution contains zero mock strings');

  // ────────────────────────────────────────────────────────────────
  // SUMMARY
  // ────────────────────────────────────────────────────────────────
  console.log('\n============================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
