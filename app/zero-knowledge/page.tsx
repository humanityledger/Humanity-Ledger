import { AztecDocPage } from '@/components/landing/AztecDocPage';

export default function ZeroKnowledgePage() {
  return (
    <AztecDocPage
      eyebrow="Cryptography · Zero-Knowledge Systems"
      title="Zero-Knowledge Architecture"
      subtitle="A comprehensive technical exposition of the zero-knowledge proof systems, cryptographic primitives, and formal verification frameworks that underpin the Humanity Ledger protocol. This document is intended for cryptographers, security researchers, and protocol engineers."
      sections={[
        {
          id: 'zk-foundations',
          title: 'Foundations of Zero-Knowledge Proofs',
          paragraphs: [
            'A zero-knowledge proof is a cryptographic protocol by which a prover can convince a verifier that a statement is true without revealing any information beyond the truth of that statement. Formally, a ZK proof system must satisfy three properties: completeness (if the statement is true, an honest prover can always convince an honest verifier), soundness (if the statement is false, a computationally bounded cheating prover cannot convince an honest verifier except with negligible probability), and zero-knowledge (the verifier learns nothing beyond the validity of the statement).',
            'Humanity Ledger employs zk-SNARKs (Zero-Knowledge Succinct Non-Interactive Arguments of Knowledge). The "succinct" property means that the proof size and verification time are both sublinear in the computation size, making on-chain verification economically viable. The "non-interactive" property means no back-and-forth communication is required between prover and verifier after an initial trusted setup.',
          ],
        },
        {
          id: 'ultraplonk',
          title: 'UltraPlonk Proof System',
          paragraphs: [
            'The Humanity Ledger protocol uses the UltraPlonk arithmetisation scheme, developed by Aztec Network. UltraPlonk is a universal and updatable zk-SNARK that eliminates the need for a per-circuit trusted setup ceremony. Instead, it relies on a universal structured reference string (SRS) that can be reused across all circuits in the protocol.',
            'UltraPlonk achieves superior performance characteristics compared to Groth16 (the proof system used by legacy centralised protocols). The proof size is constant regardless of the circuit size. Verification on-chain is O(1) in gas cost. The system supports custom gates (lookup tables, range checks, elliptic curve operations) via the PLOOKUP protocol, enabling dramatic efficiency improvements for cryptographic primitives that would otherwise be prohibitively expensive in a vanilla R1CS arithmetisation.',
          ],
          bullets: [
            'Proof Size: ~2KB (constant, independent of circuit size).',
            'Verification Gas: approximately 300,000 gas on Ethereum (constant).',
            'Prover Time: 0.5 to 3 seconds client-side on a modern device (WASM/GPU-accelerated).',
            'Trusted Setup: Universal (Aztec Ignition ceremony — no per-circuit ceremony required).',
            'Recursion: Native support for recursive proof aggregation via Barretenberg\'s native recursion.',
          ],
        },
        {
          id: 'noir-dsl',
          title: 'Noir Domain-Specific Language',
          paragraphs: [
            'All Humanity Ledger circuits are written in Noir, the domain-specific language for zero-knowledge proofs developed by Aztec Network. Noir is a Rust-inspired language that compiles to an intermediate representation called ACIR (Abstract Circuit Intermediate Representation), which is then compiled to the backend-specific format by the Barretenberg prover.',
            'Noir provides strong static typing, a familiar syntax for systems engineers, and a comprehensive standard library (dep::std) containing primitives for ECDSA verification, Poseidon hashing, Merkle proof verification, and elliptic curve arithmetic. The language enforces a strict separation between public and private inputs, making it structurally impossible to accidentally leak private witness data.',
          ],
          callout: {
            title: 'Noir: Merkle Proof Verification Circuit',
            body: [
              'use dep::std::merkle::compute_merkle_root;',
              '',
              'fn verify_identity_membership(',
              '    leaf_commitment: Field,',
              '    path_elements: [Field; 20],',
              '    path_indices: [Field; 20],',
              '    expected_root: pub Field',
              ') {',
              '    let computed_root = compute_merkle_root(',
              '        leaf_commitment,',
              '        path_indices,',
              '        path_elements',
              '    );',
              '    assert(computed_root == expected_root);',
              '}',
            ].join('\n'),
          },
        },
        {
          id: 'poseidon',
          title: 'Poseidon Hash Function',
          paragraphs: [
            'All hash operations within Humanity Ledger circuits use the Poseidon hash function rather than SHA-256 or Keccak-256. Poseidon is an arithmetic-friendly hash function designed specifically for use inside zero-knowledge proof circuits. Its round function operates natively over a prime field (BN254 in our case), meaning there are no expensive bit decomposition operations required to compute a hash inside a circuit.',
            'The practical consequence is dramatic: hashing two 256-bit field elements with Poseidon costs approximately 300 circuit gates in UltraPlonk, compared to approximately 25,000 gates for SHA-256. This efficiency difference is what makes the Humanity Ledger identity tree (with 20-level Merkle proofs) feasible to verify in sub-second proving times on consumer hardware.',
          ],
          bullets: [
            'Field: BN254 (alt-BN128), prime order 21888242871839275222246405745257275088548364400416034343698204186575808495617.',
            'Round Function: S-box x^5 (for BN254, ensures maximum distance separability).',
            'Number of Rounds: 8 full rounds + 57 partial rounds (128-bit security level).',
            'Circuit Cost: approximately 300 gates per 2-element hash vs 25,000 gates for SHA-256.',
          ],
        },
        {
          id: 'zk-identity',
          title: 'Zero-Knowledge Identity Protocol',
          paragraphs: [
            'The Humanity Ledger ZK Identity protocol is a three-phase system. In the registration phase, the user\'s device Secure Enclave generates an ECDSA P-256 keypair. The public key coordinates (x, y) are hashed using Poseidon to produce a leaf commitment. This commitment is inserted into the global identity Merkle tree maintained by the ZKIdentityRegistry contract on Aztec.',
            'In the proof generation phase, when the user wishes to prove their humanity, they retrieve the current Merkle root from the registry contract and generate a Merkle membership proof locally. They then use the Barretenberg prover inside the PXE to generate a zk-SNARK that proves: (1) they possess a Secure Enclave private key whose public key hashes to a leaf in the current identity tree, and (2) they have authorised this specific context (identified by a context hash) by signing a message with that private key.',
            'In the verification phase, the verifier (which could be a smart contract, a third-party application, or the Humanity Ledger protocol itself) receives the zk-SNARK proof and the public inputs (Merkle root, context hash, nullifier). It verifies the proof using the protocol verification key. If the proof is valid, the user is mathematically certified as a unique human who has not used the same identity in this specific context before (enforced by the nullifier).',
          ],
        },
        {
          id: 'post-quantum',
          title: 'Post-Quantum Cryptography Considerations',
          paragraphs: [
            'The current Humanity Ledger cryptographic stack uses elliptic curve primitives (ECDSA P-256, BN254, X25519) that are vulnerable to Shor\'s algorithm on a sufficiently powerful quantum computer. We are actively monitoring the development of cryptographically relevant quantum computers and the NIST Post-Quantum Cryptography standardisation programme.',
            'The NIST PQC standards published in 2024 include ML-KEM (based on CRYSTALS-Kyber, for key encapsulation) and ML-DSA (based on CRYSTALS-Dilithium, for digital signatures). The Humanity Ledger protocol is designed to be crypto-agile: the signature scheme used for the Secure Enclave binding is abstracted into a circuit constraint that can be swapped without changing the upper layers of the protocol.',
            'Our roadmap includes a migration to lattice-based signature schemes for the hardware enclave binding by Q4 2027, contingent on browser-side WebAuthn implementations adding support for ML-DSA authenticators. The Poseidon hash function and the UltraPlonk proof system are quantum-resistant (based on collision resistance of arithmetic hash functions over large prime fields).',
          ],
          callout: {
            title: 'Quantum Security Status',
            body: 'VULNERABLE to quantum: ECDSA P-256 (Shor\'s), X25519 DH (Shor\'s), BN254 pairings (Shor\'s)\nQUANTUM-RESISTANT: Poseidon hash (Grover\'s has negligible effect), UltraPlonk soundness (relies on DLP hardness in pairing groups — will need migration)\nRoadmap: ML-KEM + ML-DSA integration by Q4 2027',
          },
        },
      ]}
    />
  );
}
