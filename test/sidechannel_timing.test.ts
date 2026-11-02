import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';

/**
 * Humanity Ledger — Side-Channel & Timing Attack Hardening Test Suite
 *
 * Verifies defensive cryptographic hardening against timing side-channel attacks,
 * padding oracles, cache profiling, rate-limiting bypasses, and memory address leaks:
 *
 * TC-01: Constant-time equality comparison
 * TC-02: No early exit on MAC verification
 * TC-03: Timing oracle mitigation via bounded execution window
 * TC-04: No secret or key material leaked in error messages
 * TC-05: Key material scrubbed from stack traces (hex strings > 32 chars)
 * TC-06: Padding oracle resistance (indistinguishable decryption errors)
 * TC-07: Brute-force rate limiting with permanent lock after 5 failures
 * TC-08: Cache timing mitigation (timingSafeEqual vs naive ===)
 * TC-09: Memory address leak prevention (scrubbing values > 2^32)
 * TC-10: Random jitter delay injection (1-100ms) against statistical fingerprinting
 */
describe('Side-Channel Timing Attack Hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // TC-01: Constant-time equality
  // =========================================================================
  it('TC-01: Constant-time equality — verify that a constant-time comparison function takes the same number of steps regardless of where strings differ', () => {
    /**
     * Instrumented constant-time comparison.
     * Evaluates every single byte without early termination using bitwise OR accumulator.
     */
    function constantTimeCompareInstrumented(a: string, b: string): { equal: boolean; steps: number } {
      let steps = 0;
      const maxLen = Math.max(a.length, b.length);
      let diff = a.length ^ b.length;

      for (let i = 0; i < maxLen; i++) {
        steps++;
        const codeA = i < a.length ? a.charCodeAt(i) : 0;
        const codeB = i < b.length ? b.charCodeAt(i) : 0;
        diff |= codeA ^ codeB;
      }

      return { equal: diff === 0, steps };
    }

    /**
     * Vulnerable naive equality comparison for demonstration/contrast.
     * Bails out on first differing character.
     */
    function naiveCompareInstrumented(a: string, b: string): { equal: boolean; steps: number } {
      let steps = 0;
      if (a.length !== b.length) return { equal: false, steps: 0 };

      for (let i = 0; i < a.length; i++) {
        steps++;
        if (a[i] !== b[i]) {
          return { equal: false, steps };
        }
      }
      return { equal: true, steps };
    }

    // 64-character (32-byte hex) canonical secret
    const secret = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';
    expect(secret.length).toBe(64);

    // Candidates differing at distinct positions
    const diffAtFirst = '0' + secret.slice(1); // Mismatch at index 0
    const diffAtQuarter = secret.slice(0, 16) + 'X' + secret.slice(17); // Mismatch at index 16
    const diffAtMid = secret.slice(0, 32) + '0' + secret.slice(33); // Mismatch at index 32
    const diffAtLast = secret.slice(0, 63) + 'F'; // Mismatch at index 63
    const exactMatch = `${secret}`; // Identical match

    // 1. Demonstrate vulnerable naive comparison leaks position via execution steps
    const naiveFirst = naiveCompareInstrumented(secret, diffAtFirst);
    const naiveQuarter = naiveCompareInstrumented(secret, diffAtQuarter);
    const naiveMid = naiveCompareInstrumented(secret, diffAtMid);
    const naiveLast = naiveCompareInstrumented(secret, diffAtLast);
    const naiveMatch = naiveCompareInstrumented(secret, exactMatch);

    expect(naiveFirst.steps).toBe(1);
    expect(naiveQuarter.steps).toBe(17);
    expect(naiveMid.steps).toBe(33);
    expect(naiveLast.steps).toBe(64);
    expect(naiveMatch.steps).toBe(64);

    // 2. Constant-time comparison MUST execute the exact same number of steps (64) in all cases
    const ctFirst = constantTimeCompareInstrumented(secret, diffAtFirst);
    const ctQuarter = constantTimeCompareInstrumented(secret, diffAtQuarter);
    const ctMid = constantTimeCompareInstrumented(secret, diffAtMid);
    const ctLast = constantTimeCompareInstrumented(secret, diffAtLast);
    const ctMatch = constantTimeCompareInstrumented(secret, exactMatch);

    // Invariant: step counts must be strictly uniform regardless of difference offset
    expect(ctFirst.steps).toBe(64);
    expect(ctQuarter.steps).toBe(64);
    expect(ctMid.steps).toBe(64);
    expect(ctLast.steps).toBe(64);
    expect(ctMatch.steps).toBe(64);

    expect(ctFirst.steps).toBe(ctQuarter.steps);
    expect(ctQuarter.steps).toBe(ctMid.steps);
    expect(ctMid.steps).toBe(ctLast.steps);
    expect(ctLast.steps).toBe(ctMatch.steps);

    // Verify boolean correctness
    expect(ctFirst.equal).toBe(false);
    expect(ctQuarter.equal).toBe(false);
    expect(ctMid.equal).toBe(false);
    expect(ctLast.equal).toBe(false);
    expect(ctMatch.equal).toBe(true);
  });

  // =========================================================================
  // TC-02: No early exit on MAC verification
  // =========================================================================
  it('TC-02: No early exit on MAC verification — verify that a MAC verifier does not short-circuit (simulate that full comparison always runs)', () => {
    interface MacVerificationTelemetry {
      valid: boolean;
      bytesExamined: number;
      indicesExamined: number[];
    }

    /**
     * Hardened constant-time MAC verification.
     * Evaluates all bytes without early exit even when early bytes differ.
     */
    function verifyMacConstantTime(
      receivedMac: Uint8Array,
      expectedMac: Uint8Array,
      onByteCheck?: (index: number) => void
    ): MacVerificationTelemetry {
      const indicesExamined: number[] = [];
      const len = Math.max(receivedMac.length, expectedMac.length);
      let diff = receivedMac.length ^ expectedMac.length;

      for (let i = 0; i < len; i++) {
        if (onByteCheck) onByteCheck(i);
        indicesExamined.push(i);

        const byteA = i < receivedMac.length ? receivedMac[i] : 0;
        const byteB = i < expectedMac.length ? expectedMac[i] : 0;
        diff |= byteA ^ byteB;
      }

      return {
        valid: diff === 0,
        bytesExamined: indicesExamined.length,
        indicesExamined,
      };
    }

    // 32-byte cryptographic MAC
    const expectedMac = new Uint8Array(32);
    for (let i = 0; i < 32; i++) expectedMac[i] = (i * 7 + 13) % 256;

    // MAC with corruption at index 0 (very first byte)
    const badMacFirst = new Uint8Array(expectedMac);
    badMacFirst[0] ^= 0xff;

    // MAC with corruption in the middle (index 15)
    const badMacMid = new Uint8Array(expectedMac);
    badMacMid[15] ^= 0xff;

    // MAC with corruption at the last byte (index 31)
    const badMacLast = new Uint8Array(expectedMac);
    badMacLast[31] ^= 0xff;

    // Identical MAC
    const validMac = new Uint8Array(expectedMac);

    const spyFirst = vi.fn();
    const resultFirst = verifyMacConstantTime(badMacFirst, expectedMac, spyFirst);
    expect(resultFirst.valid).toBe(false);
    expect(spyFirst).toHaveBeenCalledTimes(32);
    expect(resultFirst.bytesExamined).toBe(32);

    const spyMid = vi.fn();
    const resultMid = verifyMacConstantTime(badMacMid, expectedMac, spyMid);
    expect(resultMid.valid).toBe(false);
    expect(spyMid).toHaveBeenCalledTimes(32);
    expect(resultMid.bytesExamined).toBe(32);

    const spyLast = vi.fn();
    const resultLast = verifyMacConstantTime(badMacLast, expectedMac, spyLast);
    expect(resultLast.valid).toBe(false);
    expect(spyLast).toHaveBeenCalledTimes(32);
    expect(resultLast.bytesExamined).toBe(32);

    const spyValid = vi.fn();
    const resultValid = verifyMacConstantTime(validMac, expectedMac, spyValid);
    expect(resultValid.valid).toBe(true);
    expect(spyValid).toHaveBeenCalledTimes(32);
    expect(resultValid.bytesExamined).toBe(32);

    // Invariant: All verification runs inspect all 32 bytes from 0 to 31
    const expectedIndices = Array.from({ length: 32 }, (_, i) => i);
    expect(resultFirst.indicesExamined).toEqual(expectedIndices);
    expect(resultMid.indicesExamined).toEqual(expectedIndices);
    expect(resultLast.indicesExamined).toEqual(expectedIndices);
    expect(resultValid.indicesExamined).toEqual(expectedIndices);
  });

  // =========================================================================
  // TC-03: Timing oracle mitigation
  // =========================================================================
  it('TC-03: Timing oracle mitigation — verify that an authentication function returns in a bounded time window even for invalid inputs (use mocked timers)', async () => {
    vi.useFakeTimers();

    interface UserAccount {
      username: string;
      passwordHash: string;
    }

    class HardenedAuthService {
      public static readonly BOUNDED_WINDOW_MS = 250;
      private accounts = new Map<string, UserAccount>();

      constructor(seedAccounts: UserAccount[]) {
        for (const acc of seedAccounts) {
          this.accounts.set(acc.username, acc);
        }
      }

      async authenticate(username: string, passwordAttempt: string): Promise<boolean> {
        const start = Date.now();
        const account = this.accounts.get(username);

        // Mitigation: If user does not exist, compare against a constant dummy hash
        // so computational path is identical
        const targetHash = account?.passwordHash ?? '0'.repeat(64);
        const attemptHash = crypto.createHash('sha256').update(passwordAttempt).digest('hex');

        // Timing-safe comparison of hashes
        const bufTarget = Buffer.from(targetHash, 'utf-8');
        const bufAttempt = Buffer.from(attemptHash, 'utf-8');
        const hashesMatch = crypto.timingSafeEqual(bufTarget, bufAttempt);
        const isAuthenticated = account !== undefined && hashesMatch;

        // Bounded time window: clamp total execution time to BOUNDED_WINDOW_MS
        const elapsed = Date.now() - start;
        const delayRemaining = Math.max(0, HardenedAuthService.BOUNDED_WINDOW_MS - elapsed);

        await new Promise((resolve) => setTimeout(resolve, delayRemaining));
        return isAuthenticated;
      }
    }

    const aliceHash = crypto.createHash('sha256').update('alice_secret_pass_2026').digest('hex');
    const authService = new HardenedAuthService([
      { username: 'alice', passwordHash: aliceHash },
    ]);

    // Scenario A: Non-existent user (Timing oracle would normally return in < 5ms)
    let nonExistentResolved = false;
    const nonExistentPromise = authService.authenticate('unknown_user', 'any_password').then((res) => {
      nonExistentResolved = true;
      return res;
    });

    // Advance 249ms: must NOT resolve yet
    await vi.advanceTimersByTimeAsync(249);
    expect(nonExistentResolved).toBe(false);

    // Advance 1ms (total 250ms): must resolve now
    await vi.advanceTimersByTimeAsync(1);
    expect(nonExistentResolved).toBe(true);
    const nonExistentResult = await nonExistentPromise;
    expect(nonExistentResult).toBe(false);

    // Scenario B: Existing user with wrong password
    let badPasswordResolved = false;
    const badPasswordPromise = authService.authenticate('alice', 'wrong_password').then((res) => {
      badPasswordResolved = true;
      return res;
    });

    await vi.advanceTimersByTimeAsync(249);
    expect(badPasswordResolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(badPasswordResolved).toBe(true);
    const badPasswordResult = await badPasswordPromise;
    expect(badPasswordResult).toBe(false);

    // Scenario C: Existing user with valid password
    let validResolved = false;
    const validPromise = authService.authenticate('alice', 'alice_secret_pass_2026').then((res) => {
      validResolved = true;
      return res;
    });

    await vi.advanceTimersByTimeAsync(249);
    expect(validResolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(validResolved).toBe(true);
    const validResult = await validPromise;
    expect(validResult).toBe(true);
  });

  // =========================================================================
  // TC-04: No secret in error message
  // =========================================================================
  it('TC-04: No secret in error message — verify that when verification fails, the error message does not contain the actual secret or key material', () => {
    class AuthenticationError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'AuthenticationError';
      }
    }

    class HardenedTokenVerifier {
      verifyApiKey(providedToken: string, masterSecretKey: string): boolean {
        const bufProvided = Buffer.from(providedToken, 'utf-8');
        const bufMaster = Buffer.from(masterSecretKey, 'utf-8');

        let isValid = false;
        if (bufProvided.length === bufMaster.length) {
          isValid = crypto.timingSafeEqual(bufProvided, bufMaster);
        } else {
          // Dummy comparison to prevent timing leak
          crypto.timingSafeEqual(bufMaster, bufMaster);
          isValid = false;
        }

        if (!isValid) {
          // Security Invariant: Never interpolate secret keys, fragments, or lengths into error
          throw new AuthenticationError('Authentication failed: Invalid credentials provided');
        }

        return true;
      }
    }

    const masterSecretKey = 'aztec_sk_live_9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b';
    const attackerGuess = 'aztec_sk_live_0000000000000000000000000000000000000000';

    const verifier = new HardenedTokenVerifier();

    let caughtError: Error | null = null;
    try {
      verifier.verifyApiKey(attackerGuess, masterSecretKey);
    } catch (err) {
      caughtError = err as Error;
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError).toBeInstanceOf(AuthenticationError);

    // Invariant: Error message MUST NOT contain secret key or secret key components
    expect(caughtError!.message).not.toContain(masterSecretKey);
    expect(caughtError!.message).not.toContain(masterSecretKey.slice(14)); // Hex body
    expect(caughtError!.message).not.toContain(masterSecretKey.slice(0, 20)); // Prefix
    expect(JSON.stringify(caughtError)).not.toContain(masterSecretKey);
    expect(caughtError!.toString()).not.toContain(masterSecretKey);

    // Error must be uniform generic failure
    expect(caughtError!.message).toBe('Authentication failed: Invalid credentials provided');
  });

  // =========================================================================
  // TC-05: Key material not in stack trace
  // =========================================================================
  it('TC-05: Key material not in stack trace — verify that a caught exception from crypto operations does not contain hex strings > 32 chars (which could be keys)', () => {
    /**
     * Sanitizer for exceptions originating in cryptographic subroutines.
     * Scrubs any hex sequences > 32 characters (e.g. 256-bit / 64-hex-char keys).
     */
    function sanitizeCryptoException(err: Error): Error {
      // Matches hex strings of 33 or more characters (candidate private keys / seeds)
      const hexKeyPattern = /\b[0-9a-fA-F]{33,}\b/g;

      if (err.message) {
        err.message = err.message.replace(hexKeyPattern, '[REDACTED_CRYPTO_KEY]');
      }
      if (err.stack) {
        err.stack = err.stack.replace(hexKeyPattern, '[REDACTED_CRYPTO_KEY]');
      }
      return err;
    }

    // 64-character (32-byte) private signing key
    const privateSigningKeyHex = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    // Simulate an uncaught internal driver exception that leaked the key into message and stack
    const leakedError = new Error(`Barretenberg proof failure using key ${privateSigningKeyHex}`);
    leakedError.stack = `Error: Barretenberg proof failure using key ${privateSigningKeyHex}
    at AztecProver.execute (/app/lib/aztec/prover.ts:42:15)
    at Object.signWithKey (/app/lib/crypto/sign.ts:88:22)
    with Context: key=${privateSigningKeyHex}`;

    // Verify key was present before sanitization
    expect(leakedError.message).toContain(privateSigningKeyHex);
    expect(leakedError.stack).toContain(privateSigningKeyHex);

    // Apply sanitization
    const sanitizedError = sanitizeCryptoException(leakedError);

    // Invariant: No hex string > 32 characters in message or stack trace
    const longHexRegex = /\b[0-9a-fA-F]{33,}\b/;
    expect(longHexRegex.test(sanitizedError.message)).toBe(false);
    expect(longHexRegex.test(sanitizedError.stack ?? '')).toBe(false);

    expect(sanitizedError.message).not.toContain(privateSigningKeyHex);
    expect(sanitizedError.stack).not.toContain(privateSigningKeyHex);

    // Redaction marker must be present
    expect(sanitizedError.message).toContain('[REDACTED_CRYPTO_KEY]');
    expect(sanitizedError.stack).toContain('[REDACTED_CRYPTO_KEY]');
  });

  // =========================================================================
  // TC-06: Padding oracle resistance
  // =========================================================================
  it('TC-06: Padding oracle resistance — verify that decryption failure messages are identical regardless of where padding fails', () => {
    class DecryptionError extends Error {
      constructor() {
        // Uniform error description: never indicate whether padding, MAC, or block alignment failed
        super('DecryptionError: Cryptographic integrity check failed');
        this.name = 'DecryptionError';
      }
    }

    class HardenedAesDecryptor {
      public static readonly BLOCK_SIZE = 16;

      decrypt(ciphertext: Uint8Array, expectedMac: Uint8Array, key: Uint8Array): Uint8Array {
        let isError = false;

        // Check 1: Ciphertext length must be multiple of block size
        if (ciphertext.length === 0 || ciphertext.length % HardenedAesDecryptor.BLOCK_SIZE !== 0) {
          isError = true;
        }

        // Check 2: MAC integrity verification
        const computedMac = crypto.createHmac('sha256', key).update(ciphertext).digest();
        const macMatches =
          expectedMac.length === computedMac.length &&
          crypto.timingSafeEqual(Buffer.from(expectedMac), computedMac);
        if (!macMatches) {
          isError = true;
        }

        // Check 3: PKCS#7 padding validation
        if (ciphertext.length >= HardenedAesDecryptor.BLOCK_SIZE) {
          const padLen = ciphertext[ciphertext.length - 1];
          if (padLen === 0 || padLen > HardenedAesDecryptor.BLOCK_SIZE) {
            isError = true;
          } else {
            for (let i = ciphertext.length - padLen; i < ciphertext.length; i++) {
              if (ciphertext[i] !== padLen) {
                isError = true;
              }
            }
          }
        }

        if (isError) {
          // Invariant: Return identical exception regardless of which check failed
          throw new DecryptionError();
        }

        const padLen = ciphertext[ciphertext.length - 1];
        return ciphertext.slice(0, ciphertext.length - padLen);
      }
    }

    const decryptor = new HardenedAesDecryptor();
    const key = crypto.randomBytes(32);

    // Vector 1: Ciphertext length not aligned (15 bytes instead of 16)
    const malformedLengthCiphertext = new Uint8Array(15);
    const validMac1 = crypto.createHmac('sha256', key).update(malformedLengthCiphertext).digest();

    // Vector 2: Invalid pad byte length (0x00 or 0x11 > 16)
    const badPadLengthCiphertext = new Uint8Array(16);
    badPadLengthCiphertext[15] = 0x11; // 17 > 16
    const validMac2 = crypto.createHmac('sha256', key).update(badPadLengthCiphertext).digest();

    // Vector 3: Corrupted multi-byte padding sequence (expected 0x03, 0x03, 0x03 but got 0x03, 0xAA, 0x03)
    const badPadSequenceCiphertext = new Uint8Array(16);
    badPadSequenceCiphertext[13] = 0x03;
    badPadSequenceCiphertext[14] = 0xaa; // Corrupted byte in padding
    badPadSequenceCiphertext[15] = 0x03;
    const validMac3 = crypto.createHmac('sha256', key).update(badPadSequenceCiphertext).digest();

    // Vector 4: Invalid MAC tag (integrity check failure)
    const validPaddedCiphertext = new Uint8Array(16);
    validPaddedCiphertext.fill(0x10); // 16 bytes of 0x10 padding
    const corruptedMac = crypto.randomBytes(32);

    const runDecryption = (ct: Uint8Array, mac: Uint8Array): Error => {
      try {
        decryptor.decrypt(ct, mac, key);
        throw new Error('Should not succeed');
      } catch (e) {
        return e as Error;
      }
    };

    const err1 = runDecryption(malformedLengthCiphertext, validMac1);
    const err2 = runDecryption(badPadLengthCiphertext, validMac2);
    const err3 = runDecryption(badPadSequenceCiphertext, validMac3);
    const err4 = runDecryption(validPaddedCiphertext, corruptedMac);

    // Invariant: All errors MUST be strictly indistinguishable to prevent padding oracle
    expect(err1.name).toBe('DecryptionError');
    expect(err2.name).toBe('DecryptionError');
    expect(err3.name).toBe('DecryptionError');
    expect(err4.name).toBe('DecryptionError');

    expect(err1.message).toBe(err2.message);
    expect(err2.message).toBe(err3.message);
    expect(err3.message).toBe(err4.message);

    expect(err1.message).toBe('DecryptionError: Cryptographic integrity check failed');
    expect(err1.message).not.toContain('padding');
    expect(err1.message).not.toContain('mac');
    expect(err1.message).not.toContain('length');
  });

  // =========================================================================
  // TC-07: Brute force rate limiting
  // =========================================================================
  it('TC-07: Brute force rate limiting — verify that a PIN verification function locks after 5 failed attempts', () => {
    interface PinAttemptResult {
      success: boolean;
      locked: boolean;
      attemptsRemaining: number;
      message: string;
    }

    class HardenedPinVerifier {
      private failedAttempts = 0;
      private readonly maxAllowedFailures = 5;
      private locked = false;
      private readonly canonicalPin: string;

      constructor(correctPin: string) {
        this.canonicalPin = correctPin;
      }

      verifyPin(candidatePin: string): PinAttemptResult {
        // If already locked, unconditionally reject without inspecting PIN
        if (this.locked) {
          return {
            success: false,
            locked: true,
            attemptsRemaining: 0,
            message: 'Device locked: Maximum PIN attempts exceeded. Manual recovery required.',
          };
        }

        // Constant-time PIN comparison
        const bufCandidate = Buffer.from(candidatePin, 'utf-8');
        const bufCanonical = Buffer.from(this.canonicalPin, 'utf-8');

        let isMatch = false;
        if (bufCandidate.length === bufCanonical.length) {
          isMatch = crypto.timingSafeEqual(bufCandidate, bufCanonical);
        } else {
          crypto.timingSafeEqual(bufCanonical, bufCanonical);
          isMatch = false;
        }

        if (isMatch) {
          this.failedAttempts = 0;
          return {
            success: true,
            locked: false,
            attemptsRemaining: this.maxAllowedFailures,
            message: 'PIN verified',
          };
        }

        this.failedAttempts++;
        if (this.failedAttempts >= this.maxAllowedFailures) {
          this.locked = true;
          return {
            success: false,
            locked: true,
            attemptsRemaining: 0,
            message: 'Device locked: Maximum PIN attempts exceeded. Manual recovery required.',
          };
        }

        return {
          success: false,
          locked: false,
          attemptsRemaining: this.maxAllowedFailures - this.failedAttempts,
          message: 'Incorrect PIN',
        };
      }

      isAccountLocked(): boolean {
        return this.locked;
      }
    }

    const TARGET_PIN = '941208';
    const verifier = new HardenedPinVerifier(TARGET_PIN);

    // Attempt 1: Failed
    const r1 = verifier.verifyPin('000000');
    expect(r1.success).toBe(false);
    expect(r1.locked).toBe(false);
    expect(r1.attemptsRemaining).toBe(4);

    // Attempt 2: Failed
    const r2 = verifier.verifyPin('111111');
    expect(r2.success).toBe(false);
    expect(r2.locked).toBe(false);
    expect(r2.attemptsRemaining).toBe(3);

    // Attempt 3: Failed
    const r3 = verifier.verifyPin('222222');
    expect(r3.success).toBe(false);
    expect(r3.locked).toBe(false);
    expect(r3.attemptsRemaining).toBe(2);

    // Attempt 4: Failed
    const r4 = verifier.verifyPin('333333');
    expect(r4.success).toBe(false);
    expect(r4.locked).toBe(false);
    expect(r4.attemptsRemaining).toBe(1);

    // Attempt 5: 5th failure -> Locks immediately
    const r5 = verifier.verifyPin('444444');
    expect(r5.success).toBe(false);
    expect(r5.locked).toBe(true);
    expect(r5.attemptsRemaining).toBe(0);
    expect(verifier.isAccountLocked()).toBe(true);

    // Attempt 6: Valid PIN supplied after lock -> MUST BE REJECTED!
    const r6 = verifier.verifyPin(TARGET_PIN);
    expect(r6.success).toBe(false);
    expect(r6.locked).toBe(true);
    expect(r6.attemptsRemaining).toBe(0);
    expect(r6.message).toContain('Device locked');

    // Attempt 7: Further attempts remain locked
    const r7 = verifier.verifyPin('999999');
    expect(r7.success).toBe(false);
    expect(r7.locked).toBe(true);
  });

  // =========================================================================
  // TC-08: Cache timing via string comparison
  // =========================================================================
  it('TC-08: Cache timing via string comparison — verify that comparison of two keys uses constant-time algorithm, not built-in ===', () => {
    /**
     * Hardened key comparator.
     * Guarantees invocation of crypto.timingSafeEqual rather than V8 native string comparison ===.
     */
    function secureKeyCompare(keyA: string, keyB: string): boolean {
      const bufA = Buffer.from(keyA, 'utf-8');
      const bufB = Buffer.from(keyB, 'utf-8');

      if (bufA.length !== bufB.length) {
        // Equalize cache/timing profile on length mismatch
        crypto.timingSafeEqual(bufA, bufA);
        return false;
      }

      return crypto.timingSafeEqual(bufA, bufB);
    }

    const timingSafeSpy = vi.spyOn(crypto, 'timingSafeEqual');

    const key1 = 'f89a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a';
    const key2 = '0000000000000000000000000000000000000000000000000000000000000000';
    const key1Clone = `${key1}`;
    const shortKey = 'short_key';

    // 1. Equal-length different keys: timingSafeEqual must be called
    timingSafeSpy.mockClear();
    const diffResult = secureKeyCompare(key1, key2);
    expect(diffResult).toBe(false);
    expect(timingSafeSpy).toHaveBeenCalledTimes(1);

    // 2. Identical keys: timingSafeEqual must be called
    timingSafeSpy.mockClear();
    const matchResult = secureKeyCompare(key1, key1Clone);
    expect(matchResult).toBe(true);
    expect(timingSafeSpy).toHaveBeenCalledTimes(1);

    // 3. Different length keys: timingSafeEqual must still be invoked (dummy run) to neutralize length oracle
    timingSafeSpy.mockClear();
    const lengthMismatchResult = secureKeyCompare(key1, shortKey);
    expect(lengthMismatchResult).toBe(false);
    expect(timingSafeSpy).toHaveBeenCalledTimes(1);

    // 4. Contrast: Verify that standard JavaScript === does NOT invoke timingSafeEqual
    timingSafeSpy.mockClear();
    const naiveComparison = key1 === key2;
    expect(naiveComparison).toBe(false);
    expect(timingSafeSpy).not.toHaveBeenCalled();
  });

  // =========================================================================
  // TC-09: Memory address leak prevention
  // =========================================================================
  it('TC-09: Memory address leak prevention — verify that serialization of a private object does not include any pointer-like numeric values > 2^32', () => {
    const MAX_SAFE_32BIT_VALUE = 4294967295; // 2^32 - 1

    /**
     * Hardened serializer for sensitive private objects (notes, witness buffers, state).
     * Prevents leaking host/process memory addresses (which break ASLR).
     */
    function serializePrivateObjectSecurely(data: Record<string, unknown>): string {
      const pointerKeyRegex = /(pointer|ptr|memAddress|heapRef|nativeHandle|rawAddress|v8Address)/i;

      function sanitizeValue(keyName: string, value: unknown): unknown {
        if (value === null || value === undefined) return value;

        const isPointerField = pointerKeyRegex.test(keyName);

        // Check 64-bit memory addresses or pointer-like numeric values
        if (typeof value === 'number') {
          // Numbers > 2^32 or fields explicitly tagged as pointers/memory handles
          if (value > MAX_SAFE_32BIT_VALUE || isPointerField) {
            return undefined; // Redact leaked native pointer
          }
          return value;
        }

        if (typeof value === 'bigint') {
          if (value > BigInt(MAX_SAFE_32BIT_VALUE) && isPointerField) {
            return undefined;
          }
          return value.toString();
        }

        if (typeof value === 'string') {
          // Check for hex-formatted 64-bit pointers (e.g., 0x7fff...)
          if (isPointerField && /^0x[0-9a-fA-F]{9,16}$/.test(value)) {
            return undefined;
          }
          return value;
        }

        if (Array.isArray(value)) {
          return value
            .map((item) => sanitizeValue('', item))
            .filter((item) => item !== undefined);
        }

        if (typeof value === 'object') {
          const sanitized: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(value)) {
            const result = sanitizeValue(k, v);
            if (result !== undefined) {
              sanitized[k] = result;
            }
          }
          return sanitized;
        }

        return value;
      }

      return JSON.stringify(sanitizeValue('', data));
    }

    // Leaked 64-bit pointer addresses (e.g. 0x7ffee1234560 = 140732683478368 > 2^32)
    const rawNativeHeapAddress = 140732683478368;
    const v8Address = 8589934592; // 2^33
    const hexPointerString = '0x7fff5fbff820';

    const sensitiveObject = {
      sessionId: 'sess_prod_7711',
      tokenAmount: 250000,
      timestamp: 1700000000, // Valid 32-bit timestamp (< 2^32)
      nativeHandle: rawNativeHeapAddress, // LEAK: 64-bit memory pointer
      rawAddress: hexPointerString, // LEAK: 64-bit hex pointer
      nestedContext: {
        v8Address: v8Address, // LEAK: nested pointer
        verifiedStatus: true,
        nonce: 1024,
      },
    };

    const serializedJson = serializePrivateObjectSecurely(sensitiveObject);
    const parsedBack = JSON.parse(serializedJson);

    // Invariant 1: Leaked pointer values are purged from serialization
    expect(serializedJson).not.toContain(String(rawNativeHeapAddress));
    expect(serializedJson).not.toContain(String(v8Address));
    expect(serializedJson).not.toContain(hexPointerString);
    expect(parsedBack.nativeHandle).toBeUndefined();
    expect(parsedBack.rawAddress).toBeUndefined();
    expect(parsedBack.nestedContext.v8Address).toBeUndefined();

    // Invariant 2: Legitimate business fields are preserved intact
    expect(parsedBack.sessionId).toBe('sess_prod_7711');
    expect(parsedBack.tokenAmount).toBe(250000);
    expect(parsedBack.timestamp).toBe(1700000000);
    expect(parsedBack.nestedContext.verifiedStatus).toBe(true);
    expect(parsedBack.nestedContext.nonce).toBe(1024);

    // Invariant 3: No numeric value in serialized payload exceeds 2^32
    function verifyAllNumbersWithin32Bits(obj: unknown): void {
      if (typeof obj === 'number') {
        expect(obj).toBeLessThanOrEqual(MAX_SAFE_32BIT_VALUE);
      } else if (typeof obj === 'object' && obj !== null) {
        for (const val of Object.values(obj)) {
          verifyAllNumbersWithin32Bits(val);
        }
      }
    }
    verifyAllNumbersWithin32Bits(parsedBack);
  });

  // =========================================================================
  // TC-10: Random delay injection
  // =========================================================================
  it('TC-10: Random delay injection — verify that a hardened endpoint adds random delay (1-100ms) to prevent timing fingerprinting', async () => {
    interface EndpointResponse<T> {
      status: number;
      data: T;
      appliedDelayMs: number;
    }

    class HardenedEndpoint {
      private delayGenerator: () => number;

      constructor(customDelayGenerator?: () => number) {
        // Generates CSPRNG random delay in range [1, 100] milliseconds
        this.delayGenerator =
          customDelayGenerator ??
          (() => {
            const buf = crypto.randomBytes(1);
            return 1 + (buf[0] % 100);
          });
      }

      async handle<T>(requestFn: () => Promise<T>): Promise<EndpointResponse<T>> {
        const delayMs = this.delayGenerator();
        const data = await requestFn();
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return {
          status: 200,
          data,
          appliedDelayMs: delayMs,
        };
      }
    }

    // Part A: Verify randomness and bounds [1, 100] across 50 simulated requests
    const defaultEndpoint = new HardenedEndpoint();
    const observedDelays: number[] = [];

    for (let i = 0; i < 50; i++) {
      // Direct inspection of generator values
      const delay = (defaultEndpoint as unknown as { delayGenerator: () => number }).delayGenerator();
      expect(delay).toBeGreaterThanOrEqual(1);
      expect(delay).toBeLessThanOrEqual(100);
      expect(Number.isInteger(delay)).toBe(true);
      observedDelays.push(delay);
    }

    // Invariant: Delays must exhibit non-zero variance (not a static fixed delay)
    const distinctDelayCount = new Set(observedDelays).size;
    expect(distinctDelayCount).toBeGreaterThan(15);

    // Part B: Verify actual time delay application using Vitest fake timers
    vi.useFakeTimers();

    // Deterministic delay for timer progression assertion (e.g. exactly 65ms)
    const injectedDelay = 65;
    const mockedEndpoint = new HardenedEndpoint(() => injectedDelay);

    let completed = false;
    const requestPromise = mockedEndpoint
      .handle(async () => ({ success: true, balance: 100 }))
      .then((res) => {
        completed = true;
        return res;
      });

    // Advance 64ms: Must not have finished yet
    await vi.advanceTimersByTimeAsync(64);
    expect(completed).toBe(false);

    // Advance 1ms (reaching exactly 65ms): Must finish now
    await vi.advanceTimersByTimeAsync(1);
    expect(completed).toBe(true);

    const result = await requestPromise;
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ success: true, balance: 100 });
    expect(result.appliedDelayMs).toBe(65);
  });
});
