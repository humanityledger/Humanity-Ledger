import { AztecDocPage } from '@/components/landing/AztecDocPage';

export default function GovernancePage() {
  return (
    <AztecDocPage
      eyebrow="Network · Governance"
      title="Decentralized Protocol Governance"
      subtitle="Humanity Ledger is governed by its community of verified, biologically unique participants. We employ a privacy-preserving quadratic voting system built on Zero-Knowledge proofs to ensure that protocol evolution is directed by the collective will of humanity, rather than capital concentration."
      sections={[
        {
          id: 'one-human-one-vote',
          title: 'Sybil-Resistant Democratic Participation',
          paragraphs: [
            'Traditional blockchain governance is plutocratic: 1 token equals 1 vote. This inevitably leads to protocol capture by whales, venture capital firms, and early adopters. Humanity Ledger introduces a radical paradigm shift: 1 verified human equals 1 foundational vote.',
            'Because every participant in the Humanity Ledger network must undergo the ZK Identity hardware-rooted authentication process, we possess absolute cryptographic certainty that each wallet represents a unique biological entity. We leverage this Sybil resistance to implement a fair, democratic governance model.',
          ],
        },
        {
          id: 'quadratic-voting',
          title: 'Zero-Knowledge Quadratic Voting',
          paragraphs: [
            'While the foundational vote ensures equality, we also recognize the need to gauge the intensity of preference on complex protocol upgrades. Humanity Ledger implements a Zero-Knowledge Quadratic Voting (zk-QV) system.',
            'Users can allocate Quantum Dots (QDs) to express stronger preferences, but the cost of additional votes scales quadratically (e.g., 1 vote costs 1 QD, 2 votes cost 4 QDs, 3 votes cost 9 QDs). Crucially, because all voting is conducted within the Aztec L2 shielded pool, the votes are tallied homomorphically.',
            'The network can compute the final tally of a proposal without ever revealing which individual voted for what, or how many QDs they spent. This prevents voter intimidation, bribery, and the bandwagon effect, ensuring pristine democratic signaling.',
          ],
        },
        {
          id: 'upgradeability',
          title: 'Protocol Upgradeability',
          paragraphs: [
            'The governance system has direct cryptographic authority over the protocol parameters and smart contract upgrades. When a proposal reaches the required quorum and threshold, a time-lock is initiated.',
            'Upon expiration of the time-lock, the decentralized execution contract autonomously implements the changes (e.g., updating the verification keys for a new Noir circuit, modifying the QD issuance rate, or altering relay fee structures). Human intervention is cryptographically impossible once the vote is finalized.',
          ],
        },
      ]}
    />
  );
}
