import React from 'react';
import { Metadata } from 'next';
import DocLayout from '@/components/layout/DocLayout';

export const metadata: Metadata = {
  title: 'Vision & Manifesto | Humanity Ledger',
  description: 'The foundational vision of Humanity Ledger — building a privacy-native, self-sovereign digital society through applied cryptography and zero-knowledge proofs.',
};

export default function VisionPage() {
  return (
    <DocLayout
      title="Vision & Manifesto"
      category="Company"
      description="The foundational philosophy behind Humanity Ledger: securing human rights, informational sovereignty, and financial privacy through applied cryptography."
      lastUpdated="October 19, 2026"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 font-serif leading-relaxed text-slate-800">

        <div className="text-xl text-slate-500 mb-16 leading-relaxed italic border-l-4 border-slate-300 pl-6 py-2">
          "Privacy is not secrecy. A private matter is something one doesn&apos;t want the whole world to know, but a secret matter is something one doesn&apos;t want anybody to know. Privacy is the power to selectively reveal oneself to the world."
          <br />— Eric Hughes, <em>A Cypherpunk&apos;s Manifesto</em> (1993)
        </div>

        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 text-slate-900 font-sans uppercase tracking-widest border-b border-slate-200 pb-3">I. The Problem We Were Born to Solve</h2>
          <p className="mb-6">
            Humanity Ledger was not built to solve a technical problem. It was built to solve a human one. In 2024, the creator of this project looked at the state of the internet and reached a single, unavoidable conclusion: the digital infrastructure that governs billions of lives was built without privacy as a foundational property. Not as an oversight — as a deliberate choice.
          </p>
          <p className="mb-6">
            Every major platform — social, financial, governmental — was engineered to be maximally transparent to those at the top of the hierarchy. Your location, your purchases, your social connections, your political views, your medical history: all of it flows upward, aggregated, monetized, and ultimately weaponized against your autonomy.
          </p>
          <p className="mb-6">
            The blockchain revolution promised to change this. Decentralization was meant to eliminate the trusted third party — the institution that knew everything about you and could betray you at will. But the first generation of blockchains made things worse, not better. Ethereum, Bitcoin, and their successors created a global, permanent, immutable ledger of every financial act you ever performed. Your wallet address became a window into your life, open to anyone with an internet connection and five minutes to spare.
          </p>
          <p className="mb-6">
            This is the problem Humanity Ledger exists to solve. Not a product problem. A civilizational one.
          </p>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 text-slate-900 font-sans uppercase tracking-widest border-b border-slate-200 pb-3">II. The Vision: A Self-Sovereign Digital Society</h2>
          <p className="mb-6">
            The creator&apos;s vision is simple to state and extraordinarily difficult to build: a world where the default state of digital interaction is privacy. Where you can transact, communicate, prove facts about yourself, and participate in digital economies without surrendering control of your data to any intermediary. Where identity is something you hold, not something that is assigned to you.
          </p>
          <p className="mb-6">This vision rests on three pillars:</p>
          <div className="mb-6 pl-6 border-l-4 border-slate-200 space-y-5">
            <div>
              <p className="font-bold text-slate-900">1. Identity as a Right, Not a Service.</p>
              <p className="mt-1">Your digital identity should belong to you. Not to Google, not to a bank, not to a government database. On Humanity Ledger, your identity is a cryptographic artifact stored in your control, attested by a global network, and readable by no one without your explicit permission.</p>
            </div>
            <div>
              <p className="font-bold text-slate-900">2. Financial Privacy as Infrastructure.</p>
              <p className="mt-1">Privacy in financial transactions should not be a premium feature available only to the wealthy or the technically sophisticated. It should be the baseline. Humanity Ledger is built on the Aztec Network, which uses zero-knowledge proofs to make private transactions the default state rather than an opt-in feature for the paranoid.</p>
            </div>
            <div>
              <p className="font-bold text-slate-900">3. Communication Without Surveillance.</p>
              <p className="mt-1">Human beings have a right to private communication. The messaging layer of Humanity Ledger is built on end-to-end encryption designed so that no server, no administrator, and no adversary can read the messages you send to another person.</p>
            </div>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 text-slate-900 font-sans uppercase tracking-widest border-b border-slate-200 pb-3">III. The Zero-Knowledge Foundation</h2>
          <p className="mb-6">
            Humanity Ledger is built on zero-knowledge cryptography. Specifically, on Aztec&apos;s implementation of recursive zk-SNARKs: mathematical constructions that allow a prover to demonstrate the truth of a statement to a verifier without revealing any information beyond the fact that the statement is true.
          </p>
          <p className="mb-6">This is not an abstraction. It is a concrete, deployable technology that makes the following scenarios real today:</p>
          <ul className="list-none space-y-3 mb-6 pl-4">
            <li className="flex items-start gap-3"><span className="text-slate-400 mt-1 shrink-0">→</span><span>A person can prove they are over 18 without revealing their date of birth.</span></li>
            <li className="flex items-start gap-3"><span className="text-slate-400 mt-1 shrink-0">→</span><span>A citizen can prove they hold a valid passport from a recognized nation without revealing which nation or their name.</span></li>
            <li className="flex items-start gap-3"><span className="text-slate-400 mt-1 shrink-0">→</span><span>A sender can transfer value to a recipient and prove the transaction is valid without revealing the amount, sender, or recipient to any third party.</span></li>
            <li className="flex items-start gap-3"><span className="text-slate-400 mt-1 shrink-0">→</span><span>A university can verify that a student passed an exam without that verification being tied to their identity on a public record.</span></li>
          </ul>
          <p className="mb-6">
            The Turing Shield — our academic integrity verification system — is perhaps the most immediate application of this vision. A professor should be able to verify the authenticity of academic work with a high degree of confidence. A researcher should be able to run forensic analysis on documents and receive results they can trust without question. The integrity of that analysis must be beyond reproach because the consequences of an error are borne by real human beings.
          </p>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 text-slate-900 font-sans uppercase tracking-widest border-b border-slate-200 pb-3">IV. The Ecosystem: Every Tool Serving One Purpose</h2>
          <p className="mb-6">
            Every application within the Humanity Ledger ecosystem was built with a single question in mind: does this tool give more power to the user, or does it extract power from them?
          </p>
          <p className="mb-6">
            The Portfolio is a non-custodial, self-hosted asset manager. The user&apos;s keys never leave their device. No server holds the ability to move their funds.
          </p>
          <p className="mb-6">
            The messaging application is built without a central server that stores messages. Messages are relayed through a decentralized network and encrypted end to end. The relay nodes cannot read what they carry.
          </p>
          <p className="mb-6">
            The identity passport is issued once, stored locally, and verified cryptographically. There is no "Humanity Ledger accounts database" that an attacker could breach to extract your personal information.
          </p>
          <p className="mb-6">
            The QD token is the internal unit of account for the ecosystem. It powers governance, rewards genuine participation, and enables peer-to-peer micropayments. It is designed as digital infrastructure for a community, not as a speculative instrument.
          </p>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 text-slate-900 font-sans uppercase tracking-widest border-b border-slate-200 pb-3">V. The Long Game</h2>
          <p className="mb-6">
            The creator of Humanity Ledger is aware that this vision is not achievable in a product launch, a funding round, or a single year of engineering. It is a multi-decade project. The infrastructure for a self-sovereign digital society requires not just code, but trust — and trust is built slowly, through consistent action, transparent governance, and relentless focus on the user&apos;s interest over the platform&apos;s interest.
          </p>
          <p className="mb-6">
            This is why Humanity Ledger is open source. Every line of code that handles your keys, your identity, or your messages is publicly auditable. The community that uses this system is also the community that governs it. There are no hidden stakeholders with special access. There is no backdoor that will be sold to a government or a corporation.
          </p>
          <p className="mb-6">
            The roadmap ahead includes post-quantum cryptographic upgrades, deeper integration with the Aztec mainnet as it matures, formal verification of critical cryptographic components, and expansion of the identity ecosystem to support a broader range of attestation authorities. But every step on that roadmap is subordinate to the same question: does this serve the user&apos;s sovereignty, or does it erode it?
          </p>
        </section>

        <section className="mb-8 border-t border-slate-200 pt-12">
          <h2 className="text-2xl font-bold mb-6 text-slate-900 font-sans uppercase tracking-widest">VI. A Declaration</h2>
          <p className="mb-6">
            Humanity Ledger is a declaration that the privacy of individuals is not negotiable. That the digital infrastructure of the future should be built on the premise of informed consent, cryptographic guarantees, and the absolute sovereignty of the person over their own data.
          </p>
          <p className="mb-6">
            The code is written. The proofs are verified. The system works. The only thing that remains is the will to use it.
          </p>
          <p className="mb-6 font-bold text-slate-900 text-lg">
            Privacy is a human right. Humanity Ledger is the infrastructure to guarantee it.
          </p>

          <div className="mt-12 text-center font-sans text-slate-400 pb-4">
            <div className="w-12 h-12 mx-auto bg-slate-900 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
              </svg>
            </div>
            <p className="tracking-widest uppercase text-xs font-mono">Humanity Ledger Foundation</p>
            <p className="text-xs mt-1 font-mono">Building the Privacy-Native Society</p>
          </div>
        </section>

      </div>
    </DocLayout>
  );
}

