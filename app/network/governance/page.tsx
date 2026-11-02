import { AztecDocPage } from '@/components/landing/AztecDocPage';

export default function GovernancePage() {
  return (
    <AztecDocPage
      eyebrow="Network — Governance"
      title="How Humanity Ledger Evolves"
      subtitle="We are building a product that serves its users. This page explains how decisions are made today, how we plan to open that process to the community over time, and what you can do to have a voice."
      sections={[
        {
          id: 'current',
          title: 'How Decisions Are Made Today',
          paragraphs: [
            'Humanity Ledger is currently in the early stages of development, targeting a public launch on January 1, 2027. At this stage, product and protocol decisions are made by the founding team based on user feedback, technical requirements, and legal compliance obligations.',
            'This is an honest acknowledgment. We are not a fully community-governed organization yet. We are a small team building a product and working toward a future where the community has meaningful input into how the platform evolves.',
          ],
          callout: {
            title: 'Transparent by Design',
            body: 'We believe that being honest about how decisions are made now is more important than making grand claims about governance models that do not yet exist. Our roadmap toward community participation is published below.',
          },
        },
        {
          id: 'feedback',
          title: 'How to Have a Voice Right Now',
          paragraphs: [
            'While formal governance mechanisms are in development, there are real ways to influence the direction of the platform today.',
          ],
          bullets: [
            'Community Forum — Post suggestions, report issues, and discuss the future of the platform publicly in the Ledger Chat community forum.',
            'Bug Reports — Security vulnerabilities and bugs can be reported confidentially to security@humanityledger.com. We review and prioritize every report.',
            'Feature Requests — Open a public discussion in the forum. Features with strong community support move up the roadmap.',
            'Direct Feedback — For sensitive matters, contact the team at humanityledger@icloud.com.',
          ],
        },
        {
          id: 'communities',
          title: 'Community Governance Inside the Platform',
          paragraphs: [
            'Community administrators on Ledger Chat have full governance authority over their own spaces. They can create and delete channels, set member permissions, adjust privacy settings, invite or remove members, and control who can join.',
            'This means that a DAO or project using Ledger Chat as its communication layer can self-govern completely. The platform does not interfere in community-level decisions.',
          ],
        },
        {
          id: 'roadmap',
          title: 'Governance Roadmap',
          paragraphs: [
            'We intend to progressively open platform governance to the community as the product matures.',
          ],
          bullets: [
            '2027 — Public changelog and RFC process: All major product decisions will be documented and published before implementation. Community members can comment on proposed changes.',
            '2027 — Community Advisory Council: A group of active users nominated by the community to participate in product planning discussions before decisions are finalized.',
            '2028 — Formal governance model: A defined process for community proposals and binding input on platform features and policies. Details will be designed collaboratively with early users.',
          ],
        },
      ]}
    />
  );
}
