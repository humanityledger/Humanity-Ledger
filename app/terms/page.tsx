"use client";

import React from 'react';
import { DocsShell, DocH1, DocH2, DocP, DocCallout, DocOrderedList } from '@/components/docs/DocsShell';

export default function TermsPage() {
    return (
        <DocsShell currentSlug="terms">
            <DocH1>Terms of Service</DocH1>
            
            <DocP>
                The definitive legal agreement establishing the parameters of interaction between users and the Humanity Ledger infrastructure, with planned Aztec Network integration.
            </DocP>

            <DocCallout type="note" title="EFFECTIVE DATE">
                July 26, 2026
            </DocCallout>

            <DocH2>01. Protocol Interaction</DocH2>
            <DocP>
                This document constitutes the legal agreement governing your use of the Humanity Ledger interface. By generating zero knowledge proofs, deploying Noir contracts, or engaging with our decentralised sequencing architecture, you agree to these terms.
            </DocP>
            <DocP>
                The platform is a non custodial, decentralised privacy infrastructure. Access to the protocol is facilitated through open source cryptography. We do not custody, wrap, escrow, or otherwise manage your cryptographic assets or private viewing keys.
            </DocP>
            <DocP>
                Consequently, we are mathematically incapable of reversing, pausing, or altering transactions once they have been signed by your wallet and finalized by the decentralised sequencer network on Ethereum Layer 1.
            </DocP>

            <DocH2>02. Limitation of Liability</DocH2>
            <DocP>
                The protocol provides privacy preserving infrastructure using experimental zero knowledge cryptography. While the code is heavily audited, the use of decentralised finance protocols inherently carries significant risk.
            </DocP>
            <DocCallout type="warning" title="CRYPTOGRAPHIC RISK">
                Interaction with zero knowledge smart contracts implies an acknowledgment of cryptographic risk. We expressly disclaim all liability for capital loss resulting from protocol exploits, network congestion, incorrect proof generation, or loss of private decryption keys.
            </DocCallout>

            <DocH2>03. Usage Restrictions</DocH2>
            <DocP>
                The protocol is designed to provide financial privacy for legitimate users. We strictly prohibit the use of our infrastructure for money laundering, terrorism financing, or any activity that violates applicable international sanctions.
            </DocP>
            <DocP>
                While we cannot access your private state, we reserve the right to block IP addresses or client side identifiers that engage in denial of service attacks against our RPC infrastructure or attempt to exploit the platform's front-end interfaces.
            </DocP>

            <DocH2>04. Token Classification & No Investment Advice</DocH2>
            <DocP>
                Quantum Data points (QDs) are strictly testnet tokens designed exclusively to facilitate interaction with our privacy infrastructure. QDs do not constitute electronic money, securities, derivatives, or any form of regulated financial instrument.
            </DocP>
            <DocP>
                We are not a regulated financial institution. Nothing on this platform constitutes financial, investment, or legal advice. You are solely responsible for your own financial decisions and interactions.
            </DocP>

        </DocsShell>
    );
}
