import { AztecDocPage } from '@/components/landing/AztecDocPage';

export default function ZKIdentityPage() {
  return (
    <AztecDocPage
      eyebrow="Protocol · ZK Identity"
      title="Hardware-Rooted Zero-Knowledge Identity"
      subtitle="The foundational Sybil resistance mechanism of Humanity Ledger. ZK Identity binds cryptographic primitives directly to the biometric secure enclaves of user hardware, producing mathematical proof of unique personhood without compromising privacy."
      sections={[
        {
          id: 'hardware-binding',
          title: 'Secure Enclave Cryptography',
          paragraphs: [
            'Traditional decentralized identity systems rely on centralized KYC providers or vulnerable social graph attestations. Humanity Ledger shifts the root of trust to the physical hardware. Utilizing the WebAuthn API, the protocol instructs the device\'s Secure Enclave (e.g., Apple Secure Enclave, Android StrongBox) to generate an ECDSA P-256 keypair.',
            'Crucially, the private key is physically fused into the silicon and can never be extracted by the operating system, the browser, or the Humanity Ledger protocol itself. Operations using this key require biometric authorization (FaceID, TouchID), effectively binding the cryptographic identity to a unique biological entity.',
          ],
        },
        {
          id: 'zk-proofs',
          title: 'Anonymous Attestations via zk-SNARKs',
          paragraphs: [
            'While the Secure Enclave provides Sybil resistance, broadcasting the public key would severely compromise user privacy by creating a globally traceable identifier. Humanity Ledger solves this through zero-knowledge proofs.',
            'Instead of signing a transaction directly with the enclave key, the user compiles a zk-SNARK (using the Barretenberg prover). The proof mathematically asserts: "I possess a private key within my enclave that corresponds to a public key currently registered in the Humanity Ledger Merkle tree, and I have authorized this specific state transition." The proof reveals neither the public key nor the identity of the user.',
          ],
          bullets: [
            'Zero-Knowledge Succinct Non-Interactive Arguments of Knowledge (zk-SNARKs).',
            'Noir DSL for circuit constraints.',
            'Barretenberg backend for sub-second client-side proving.',
          ],
        },
        {
          id: 'nullifiers',
          title: 'Deterministic Nullifiers',
          paragraphs: [
            'To prevent double-spending and replay attacks in an anonymous system, the protocol relies on deterministic nullifiers. A nullifier is a one-way cryptographic hash derived from the user\'s private enclave key and a specific context (such as a unique asset ID or a protocol epoch).',
            'When a state transition occurs, the nullifier is published to the Aztec L2 public state. The verifier smart contract ensures the nullifier has not been seen before. Because the nullifier is deterministic, any attempt to use the same private key for the same context will produce an identical nullifier and be rejected, enforcing strict limits without revealing the actor.',
          ],
        },
        {
          id: 'recovery',
          title: 'Social & Multi-Sig Recovery',
          paragraphs: [
            'Recognizing that hardware can be lost or destroyed, ZK Identity implements a mathematically sound recovery mechanism. Users can shard a master recovery seed using Shamir\'s Secret Sharing scheme across a network of trusted peers (Guardians).',
            'If a device is lost, the user initiates a recovery protocol via their Guardians. The Guardians submit zero-knowledge proofs authorizing the rotation of the public key registered in the Merkle tree, seamlessly transferring the identity to the new hardware enclave without exposing the underlying recovery seed.',
          ],
        },
      ]}
    />
  );
}
