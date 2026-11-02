import { vi } from 'vitest';
import { generateEphemeralKeyPair, encryptLayer, decryptLayer } from '../../lib/onion/OnionCrypto';

describe('Multiplatform Chat (Onion Routing) Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully encrypt and decrypt a message for cross-platform delivery', async () => {
    // 1. Generate keys for the recipient (Platform B)
    const { publicKey, _privateKey } = await generateEphemeralKeyPair();

    // 2. Sender (Platform A) encrypts a message
    const originalMessage = 'Hello from Platform A to Platform B!';
    const encodedPayload = new TextEncoder().encode(originalMessage);
    const layer = await encryptLayer(encodedPayload, publicKey);
    
    expect(layer).toHaveProperty('ephPub');
    expect(layer).toHaveProperty('iv');
    expect(layer).toHaveProperty('ciphertext');

    // 3. Recipient (Platform B) decrypts the message
    const decryptedBytes = await decryptLayer(layer, _privateKey);
    const decryptedMessage = new TextDecoder().decode(decryptedBytes);

    // 4. Verification
    expect(decryptedMessage).toBe(originalMessage);
  });

  it('should perfectly validate MAC to prevent tampering during transmission', async () => {
    const { publicKey, _privateKey } = await generateEphemeralKeyPair();
    const originalMessage = 'Secret multiplatform transmission';
    const encodedPayload = new TextEncoder().encode(originalMessage);
    const layer = await encryptLayer(encodedPayload, publicKey);

    // Simulate Hacker tampering with the ciphertext in transit
    const tamperedLayer = {
      ...layer,
      ciphertext: layer.ciphertext.substring(0, layer.ciphertext.length - 1) + 'a' // mutate 1 byte
    };

    // Decryption should fail due to MAC validation (which is built into GCM ciphertext)
    await expect(decryptLayer(tamperedLayer, _privateKey)).rejects.toThrow();
  });
});
