import type { DocPage } from "../types";

/**
 * The sources behind the landing's chapter "Zero-knowledge, in plain words" (landing brief of
 * 21 November 2026). The landing carries one line per milestone; this page names the primary
 * source of each. The existing page /docs/zero-knowledge is left as it is (lib/docs/pages/protocol.ts
 * is not edited), and links here are added from the landing.
 */
export const zkHistory: DocPage = {
  slug: "zero-knowledge-history",
  href: "/docs/zero-knowledge-history",
  label: "Zero-knowledge, a short history",
  title: "Zero-knowledge proofs: a short history, with sources",
  summary: "How proving something without revealing it went from a 1985 paper to private payments proved on your own device, with the primary source of each step.",
  keywords: ["zero knowledge", "zk", "proof", "history", "goldwasser", "micali", "snark", "plonk", "groth16", "zcash", "aztec", "noir"],
  updated: "2026-11-21",
  blocks: [
    {
      t: "p",
      text: "A zero-knowledge proof lets one party convince another that a statement is true without revealing anything beyond the fact that it is true. Ledger Chat uses this idea for private payments: your device proves a payment follows the rules, and the network checks the proof without learning the amount or the recipient.",
    },
    { t: "h2", text: "In plain words" },
    {
      t: "steps",
      items: [
        { title: "Two balls", text: "A friend cannot tell red from green. You hand them two balls, one of each colour." },
        { title: "Swap, or not", text: "Behind their back they swap the balls, or leave them, and ask you which. You answer right every time." },
        { title: "Convinced", text: "After twenty rounds the chance that you guessed every time is one in 1,048,576. Your friend is convinced the balls differ, and still does not know which one is red." },
      ],
    },
    {
      t: "hint",
      tone: "info",
      title: "What a proof hides, and what it does not",
      text: "A proof hides what it is designed to hide, and nothing more. On Aztec a private payment hides the amount and the recipient; the account that pays the network fee is public. Ledger Chat never describes payments as anonymous.",
    },
    { t: "h2", text: "Timeline" },
    {
      t: "table",
      head: ["Year", "Milestone", "Primary source"],
      strongFirst: true,
      rows: [
        ["1985", "Shafi Goldwasser, Silvio Micali and Charles Rackoff define zero-knowledge proofs.", "\"The Knowledge Complexity of Interactive Proof-Systems\", STOC 1985. [doi:10.1145/22145.22178](https://doi.org/10.1145/22145.22178)"],
        ["1986", "Amos Fiat and Adi Shamir show how to make such proofs non-interactive.", "\"How to Prove Yourself: Practical Solutions to Identification and Signature Problems\", CRYPTO '86. [doi:10.1007/3-540-47721-7_12](https://doi.org/10.1007/3-540-47721-7_12)"],
        ["1989", "Jean-Jacques Quisquater, Louis Guillou and their families explain zero knowledge with the story of a cave.", "\"How to Explain Zero-Knowledge Protocols to Your Children\", CRYPTO '89. [doi:10.1007/0-387-34805-0_60](https://doi.org/10.1007/0-387-34805-0_60)"],
        ["2012", "Goldwasser and Micali receive the ACM A.M. Turing Award, in part for this work.", "[ACM A.M. Turing Award](https://amturing.acm.org/)"],
        ["2013", "Pinocchio makes general-purpose verifiable computation close to practical.", "Parno, Howell, Gentry, Raykova, \"Pinocchio: Nearly Practical Verifiable Computation\", IEEE S&P 2013. [ePrint 2013/279](https://eprint.iacr.org/2013/279)"],
        ["2016", "Zcash launches on 28 October with zk-SNARKs for private payments. Jens Groth publishes a compact proof system, Groth16.", "[Zcash Sprout launch](https://electriccoin.co/blog/zcash-sprout-launch/); Groth, \"On the Size of Pairing-based Non-interactive Arguments\", EUROCRYPT 2016. [ePrint 2016/260](https://eprint.iacr.org/2016/260)"],
        ["2019", "Ariel Gabizon, Zachary Williamson and Oana Ciobotaru publish PLONK. Williamson co-founded Aztec.", "[ePrint 2019/953](https://eprint.iacr.org/2019/953)"],
        ["Today", "Aztec Network runs private transactions proved on the user's own device, with contracts written in Noir.", "[Aztec documentation](https://docs.aztec.network)"],
      ],
    },
    { t: "h2", text: "How Ledger Chat uses it" },
    {
      t: "ul",
      items: [
        "The Aztec PXE runs in your browser and builds the proof on your device. Private keys and private inputs never leave it.",
        "Balances are private notes. Spending one publishes a nullifier, so the network can refuse a double spend without learning which note was spent.",
        "Before value moves, Ledger Chat checks a proof that the person in the conversation controls the Aztec address you are paying. See [Payments](/docs/payments).",
        "Each account pays its own network fee in Fee Juice, publicly. Read the limits in [Security model](/docs/security-model).",
      ],
    },
  ],
};
