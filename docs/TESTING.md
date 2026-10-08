# End-to-End Testing Guide

## Overview
This guide covers testing all gasless functionality before production deployment.

---

## Prerequisites

- [ ] All contracts deployed to Base Sepolia
- [ ] Railway configured with environment variables
- [ ] Relayer wallet funded with 0.1 ETH
- [ ] Test wallet with AUTH tokens

---

## Test Suite

### Test 1: Gasless Zap (Happy Path)

**Objective:** Verify user can zap AUTH to outcome shares without gas

**Steps:**
1. Connect wallet to application
2. Navigate to Zap interface
3. Enter amount: `1 AUTH`
4. Select outcome: `Yes`
5. Click "Zap (Free - No Gas)"
6. Sign message in wallet (no gas prompt)
7. Wait for confirmation

**Expected Results:**
-  Signature prompt appears (no gas)
-  Transaction submitted by relayer
-  User receives outcome shares
-  Transaction appears on Basescan
-  Database updated with transaction

**Verification:**
```bash
# Check Basescan
https://sepolia.basescan.org/tx/TX_HASH

# Check Database
psql $DATABASE_URL -c "SELECT * FROM \"ProposalVote\" WHERE \"transactionHash\" = 'TX_HASH';"
```

---

### Test 2: Gasless Vote

**Objective:** Verify user can vote on proposal without gas

**Steps:**
1. Navigate to active proposal
2. Click "Vote Yes" or "Vote No"
3. Sign message in wallet
4. Wait for confirmation

**Expected Results:**
-  Vote recorded on-chain
-  Vote count updated in UI
-  Transaction status: CONFIRMED

---

### Test 3: Gasless Proposal Creation

**Objective:** Verify user can create proposal without gas

**Steps:**
1. Navigate to "Create Proposal"
2. Fill in:
   - Market ID
   - Title
   - Description
   - Stake: `10 USDC`
3. Click "Create Proposal (Free)"
4. Sign message
5. Wait for confirmation

**Expected Results:**
-  Proposal created on-chain
-  Proposal appears in database
-  Proposal visible in UI

---

### Test 4: Slippage Protection

**Objective:** Verify zap fails if slippage too high

**Steps:**
1. Enter zap amount: `100 AUTH`
2. Manually set `minUSDC` very high in code
3. Execute zap

**Expected Results:**
-  Transaction reverts with "SlippageTooHigh"
-  User funds safe (not lost)

---

### Test 5: Signature Replay Attack

**Objective:** Verify nonce prevents replay attacks

**Steps:**
1. Execute a zap
2. Capture the signature
3. Try to submit same signature again

**Expected Results:**
-  Second submission fails with "InvalidNonce"

---

### Test 6: Expired Signature

**Objective:** Verify deadline enforcement

**Steps:**
1. Sign a zap message
2. Wait 6 minutes (deadline is 5 minutes)
3. Submit signature

**Expected Results:**
-  Transaction fails with "SignatureExpired"

---

### Test 7: Relayer Balance Monitoring

**Objective:** Verify system handles low relayer balance

**Steps:**
1. Drain relayer wallet to < 0.001 ETH
2. Try to execute zap

**Expected Results:**
-  API returns 503 error
-  User sees "Relayer out of funds" message

---

### Test 8: Concurrent Transactions

**Objective:** Verify nonce management with concurrent requests

**Steps:**
1. Open two browser tabs
2. Execute zap in both simultaneously

**Expected Results:**
-  Both transactions succeed
-  Nonces increment correctly (0, 1)
-  No nonce collision

---

### Test 9: Database Sync

**Objective:** Verify watcher updates transaction status

**Steps:**
1. Execute a zap
2. Check database immediately (should be PENDING)
3. Wait 30 seconds
4. Check database again (should be CONFIRMED)

**Expected Results:**
-  Initial status: PENDING
-  Final status: CONFIRMED
-  Block number populated

---

### Test 10: Error Handling

**Objective:** Verify graceful error handling

**Steps:**
1. Try zap with insufficient AUTH balance
2. Try vote on non-existent proposal
3. Try execute proposal before timelock

**Expected Results:**
-  Clear error messages
-  No crashes
-  User can retry

---

## Performance Benchmarks

### Target Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| Signature Time | < 2s | ___ |
| Relayer Response | < 5s | ___ |
| Confirmation Time | < 30s | ___ |
| Gas Cost (Relayer) | < $0.10 | ___ |

---

## Monitoring Checklist

- [ ] Set up Sentry for error tracking
- [ ] Configure relayer balance alerts
- [ ] Monitor gas prices
- [ ] Track transaction success rate
- [ ] Set up uptime monitoring

---

## Production Readiness Checklist

- [ ] All tests passing
- [ ] Error handling verified
- [ ] Security audit complete
- [ ] Documentation updated
- [ ] Monitoring configured
- [ ] Backup relayer wallet ready
- [ ] Rate limiting enabled
- [ ] Circuit breaker tested

---

## Rollback Plan

If issues arise in production:

1. **Pause Contracts**
   ```solidity
   // Call as owner
   zapContract.togglePause();
   governanceContract.togglePause();
   ```

2. **Switch to Backup Relayer**
   - Update `RELAYER_PRIVATE_KEY` in Railway
   - Redeploy

3. **Revert Deployment**
   - Railway  Deployments  Rollback to previous

---

## Support Contacts

- **Smart Contract Issues:** [GitHub Issues]
- **Relayer Issues:** Check Railway logs
- **Database Issues:** Check Prisma logs

---

**Last Updated:** January 26, 2026
