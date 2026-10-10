import React from 'react';
import { DownpageLayout } from '@/components/ui/DownpageLayout';

export const metadata = { title: 'Security Audits | Humanity Ledger' };

export default function SecurityAuditsPage() {
  return (
    <DownpageLayout
      pageTitle="Security Audits"
      subtitle="Comprehensive security reports, formal verifications, and penetration testing for the Humanity Ledger protocol."
      indexTitle="SECURITY"
      sections={[
        {
          title: "Audit Methodology",
          paragraphs: [
            "Humanity Ledger employs a defense-in-depth strategy, subjecting our smart contracts, zero-knowledge circuits, and peer-to-peer networking infrastructure to continuous security reviews.",
            "Our audit process includes automated static analysis, formal verification of critical invariants, and manual peer review by industry-leading cryptography and security firms."
          ]
        },
        {
          title: "Zero-Knowledge Circuit Verification",
          paragraphs: [
            "The zk-SNARK circuits used for identity verification and message encryption have undergone extensive review to ensure completeness, soundness, and zero-knowledge properties.",
            "We have formally verified the absence of underconstrained variables that could lead to forged proofs or identity spoofing."
          ]
        },
        {
          title: "Peer-to-Peer Network Security",
          paragraphs: [
            "The decentralized relay network is designed to be resilient against Sybil attacks, eclipse attacks, and metadata correlation.",
            "Our WebRTC signaling layer incorporates end-to-end encryption for all handshake data, ensuring that relay nodes cannot inspect or modify connection parameters."
          ]
        },
        {
          title: "Bug Bounty Program",
          paragraphs: [
            "We maintain an active bug bounty program on Immunefi, offering significant rewards for the responsible disclosure of vulnerabilities in our protocol.",
            "If you discover a security issue, please reach out securely to security@humanityledger.com."
          ]
        }
      ]}
    />
  );
}
