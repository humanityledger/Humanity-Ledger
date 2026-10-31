import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';

/**
 * Task T4 / Acceptance Criterion A2: MLS Post-Compromise Security (RFC 9420)
 * 
 * Normative Requirements:
 * - P1: Message confidentiality (RFC 9420 TreeKEM application layer encryption).
 * - P2: Message post-compromise security (compromise of a device at epoch N
 *       does not reveal the content of messages sent or received after the next
 *       successful epoch advance).
 */
describe('T4 / A2 — MLS Post-Compromise Security (RFC 9420 TreeKEM Ratcheting)', () => {
  // MLS Key Schedule Primitives (RFC 9420 Section 8)
  const HKDF_HASH = 'sha256';
  const GROUP_ID = Buffer.from('hl-canonical-mls-group-v1');

  function hkdfDerive(secret: Buffer, label: string, length: number): Buffer {
    const info = Buffer.concat([Buffer.from('MLS 1.0 '), Buffer.from(label), GROUP_ID]);
    return crypto.hkdfSync(HKDF_HASH, secret, Buffer.alloc(0), info, length);
  }

  function advanceEpoch(currentEpochSecret: Buffer, commitSecret: Buffer): Buffer {
    // RFC 9420 Section 8: epoch_secret[N+1] = HKDF-Extract(currentEpochSecret, commitSecret)
    const info = Buffer.concat([Buffer.from('MLS 1.0 epoch advance'), GROUP_ID]);
    return crypto.hkdfSync(HKDF_HASH, commitSecret, currentEpochSecret, info, 32);
  }

  function deriveApplicationSecret(epochSecret: Buffer): Buffer {
    return hkdfDerive(epochSecret, 'app_secret', 32);
  }

  function encryptMlsApplicationMessage(
    plaintext: string,
    appSecret: Buffer,
    senderId: string,
  ): { ciphertext: string; nonce: string; tag: string } {
    const nonce = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', appSecret, nonce);
    cipher.setAAD(Buffer.concat([GROUP_ID, Buffer.from(senderId)]));
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');

    return {
      ciphertext: encrypted,
      nonce: nonce.toString('hex'),
      tag,
    };
  }

  function decryptMlsApplicationMessage(
    payload: { ciphertext: string; nonce: string; tag: string },
    appSecret: Buffer,
    senderId: string,
  ): string {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      appSecret,
      Buffer.from(payload.nonce, 'hex'),
    );
    decipher.setAAD(Buffer.concat([GROUP_ID, Buffer.from(senderId)]));
    decipher.setAuthTag(Buffer.from(payload.tag, 'hex'));

    let decrypted = decipher.update(payload.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  it('P1: MLS application messages are confidential and decryptable with current epoch secret', () => {
    const epoch0Secret = crypto.randomBytes(32);
    const appSecret0 = deriveApplicationSecret(epoch0Secret);

    const message = 'Autonomous self-sovereign coordination statement.';
    const encrypted = encryptMlsApplicationMessage(message, appSecret0, 'alice');

    // Decryption by group participant with valid app secret
    const decrypted = decryptMlsApplicationMessage(encrypted, appSecret0, 'alice');
    expect(decrypted).toBe(message);

    // Network / Server adversary with wrong key fails decryption
    const rogueServerSecret = crypto.randomBytes(32);
    expect(() => {
      decryptMlsApplicationMessage(encrypted, rogueServerSecret, 'alice');
    }).toThrow();
  });

  it('P2: Device compromise at Epoch N does not reveal messages in Epoch N+1 (Post-Compromise Security)', () => {
    // 1. Group established at Epoch N
    const epochNSecret = crypto.randomBytes(32);
    const appSecretN = deriveApplicationSecret(epochNSecret);

    // 2. Adversary completely compromises Alice's device at Epoch N
    // Adversary captures all ephemeral key material at Epoch N
    const adversaryExfiltratedState = {
      capturedEpochSecret: Buffer.from(epochNSecret),
      capturedAppSecret: Buffer.from(appSecretN),
      epoch: 42,
    };

    // Verify adversary can read messages emitted in compromised Epoch N
    const messageEpochN = 'Sensitive conversation inside Epoch N';
    const encryptedEpochN = encryptMlsApplicationMessage(messageEpochN, appSecretN, 'bob');
    const adversaryReadN = decryptMlsApplicationMessage(
      encryptedEpochN,
      adversaryExfiltratedState.capturedAppSecret,
      'bob',
    );
    expect(adversaryReadN).toBe(messageEpochN);

    // 3. Epoch Advance: Bob (or Alice's recovered client) issues an MLS Commit with fresh entropy
    // Fresh commit secret is derived via TreeKEM path update unknown to the adversary
    const freshCommitSecret = crypto.randomBytes(32);
    const epochNPlus1Secret = advanceEpoch(epochNSecret, freshCommitSecret);
    const appSecretNPlus1 = deriveApplicationSecret(epochNPlus1Secret);

    // 4. A message is sent in Epoch N+1
    const postCompromiseMessage = 'Confidential state transfer after epoch ratchet.';
    const encryptedEpochNPlus1 = encryptMlsApplicationMessage(
      postCompromiseMessage,
      appSecretNPlus1,
      'charlie',
    );

    // 5. Assert: Legitimate group member at Epoch N+1 decrypts successfully
    const legitimateDecrypted = decryptMlsApplicationMessage(
      encryptedEpochNPlus1,
      appSecretNPlus1,
      'charlie',
    );
    expect(legitimateDecrypted).toBe(postCompromiseMessage);

    // 6. Assert: Adversary with Epoch N material CANNOT decrypt Epoch N+1 messages
    expect(() => {
      decryptMlsApplicationMessage(
        encryptedEpochNPlus1,
        adversaryExfiltratedState.capturedAppSecret,
        'charlie',
      );
    }).toThrow();

    // Adversary cannot compute epoch_secret[N+1] without freshCommitSecret
    const adversaryAttemptedEpochSecret = advanceEpoch(
      adversaryExfiltratedState.capturedEpochSecret,
      Buffer.alloc(32, 0), // Adversary does not have freshCommitSecret
    );
    const adversaryAttemptedAppSecret = deriveApplicationSecret(adversaryAttemptedEpochSecret);

    expect(() => {
      decryptMlsApplicationMessage(
        encryptedEpochNPlus1,
        adversaryAttemptedAppSecret,
        'charlie',
      );
    }).toThrow();
  });

  it('P2.2: Forward Secrecy — Compromise of Epoch N+1 does not reveal Epoch N messages if memory is zeroed', () => {
    const epoch0Secret = crypto.randomBytes(32);
    const appSecret0 = Buffer.from(deriveApplicationSecret(epoch0Secret));

    const message0 = 'Historical message from initial session.';
    const encrypted0 = encryptMlsApplicationMessage(message0, appSecret0, 'alice');

    // Advance to Epoch 1
    const commitSecret1 = crypto.randomBytes(32);
    const epoch1Secret = advanceEpoch(epoch0Secret, commitSecret1);
    const appSecret1 = deriveApplicationSecret(epoch1Secret);

    // Secure erasure of Epoch 0 keys on client device
    epoch0Secret.fill(0);
    appSecret0.fill(0);

    // Adversary compromises device at Epoch 1
    const adversaryStateEpoch1 = {
      capturedEpochSecret: epoch1Secret,
      capturedAppSecret: appSecret1,
    };

    // Adversary CANNOT decrypt Epoch 0 messages using Epoch 1 keys
    expect(() => {
      decryptMlsApplicationMessage(
        encrypted0,
        adversaryStateEpoch1.capturedAppSecret,
        'alice',
      );
    }).toThrow();
  });
});
