import type { Block, DocPage } from "../types";
import { LEGAL_ENTITY, LEGAL_EMAIL_LINK, PROVIDER_LINE } from "@/lib/constants/legalEntity";

/**
 * Legal pages.
 *
 * Rules for this file, on top of CLAUDE.md:
 *   - The provider is named only through lib/constants/legalEntity.ts. No
 *     company exists yet, so nothing here may say "S.L." or "Foundation".
 *   - Every statement about data must match what the code does today. When a
 *     route, cookie or provider changes, the matching row here changes in the
 *     same commit.
 *   - These texts were drafted carefully but have not been reviewed by a
 *     lawyer. That review is tracked in the backlog (block N) and must happen
 *     before public launch.
 */

const REVIEWED = "2026-10-23";
const CONTACT = LEGAL_EMAIL_LINK;

/* -------------------------------------------------------------------------- */
/* Legal notice                                                               */
/* -------------------------------------------------------------------------- */

const identityRows: string[][] = [
  ["Provider", `${LEGAL_ENTITY.name}, a private individual. No company has been incorporated.`],
  ["Trading name", LEGAL_ENTITY.tradingName],
  ...(LEGAL_ENTITY.taxId ? [["Tax identification number (NIF)", LEGAL_ENTITY.taxId]] : []),
  ...(LEGAL_ENTITY.postalAddress ? [["Postal address", LEGAL_ENTITY.postalAddress]] : []),
  ["Country", LEGAL_ENTITY.country],
  ["Email", CONTACT],
  ["Website", `[humanidfi.com](${LEGAL_ENTITY.website})`],
];

export const legalNotice: DocPage = {
  slug: "legal-notice",
  href: "/docs/legal-notice",
  label: "Legal notice",
  summary: "Who provides Humanity Ledger and Ledger Chat, and how to reach them.",
  keywords: ["legal notice", "aviso legal", "imprint", "impressum", "provider", "owner", "lssi", "company", "nif", "who runs"],
  updated: REVIEWED,
  blocks: [
    {
      t: "p",
      text: "This notice identifies the provider of the Humanity Ledger websites and of Ledger Chat, as required by Spanish Law 34/2002 on information society services and electronic commerce (LSSI-CE).",
    },
    { t: "h2", text: "Provider" },
    { t: "table", head: ["Item", "Details"], strongFirst: true, rows: identityRows },
    {
      t: "hint",
      tone: "info",
      title: "No company yet",
      text: `Humanity Ledger is the trading name of a project run by ${LEGAL_ENTITY.name} as a private individual. It is not a company, a foundation or a financial institution. If a company is incorporated, this page will name it, with its registry details, before it takes over the service.`,
    },
    { t: "h2", text: "Not affiliated" },
    {
      t: "p",
      text: "Humanity Ledger is not affiliated with Humanity Protocol, with Ledger SAS or its hardware wallets, with Aztec Labs or with XMTP. Those names belong to their owners and appear on our websites only to describe software we use or to avoid confusion.",
    },
    { t: "h2", text: "Other legal pages" },
    {
      t: "ul",
      items: [
        "[Terms of Service](/docs/terms): the agreement for using the service.",
        "[Privacy Policy](/docs/privacy): what personal data we process and your rights.",
        "[Cookie Policy](/docs/cookies): the cookies and browser storage we use.",
        "[Content and copyright](/docs/content-policy): how to report illegal content or an infringement, and the licence of our code.",
        "[Risk disclosure](/docs/disclaimer): what can go wrong when software touches blockchains.",
      ],
    },
  ],
};

/* -------------------------------------------------------------------------- */
/* Terms of Service                                                           */
/* -------------------------------------------------------------------------- */

export const terms: DocPage = {
  slug: "terms",
  href: "/docs/terms",
  label: "Terms of Service",
  summary: `The agreement between you and ${LEGAL_ENTITY.name}, who provides Humanity Ledger and Ledger Chat.`,
  keywords: ["terms", "tos", "agreement", "legal", "conditions", "rules", "acceptable use", "liability", "age", "sanctions", "termination"],
  updated: REVIEWED,
  blocks: [
    {
      t: "p",
      text: `These terms apply to the Humanity Ledger websites and to Ledger Chat, which together we call the service. The service is provided by **${PROVIDER_LINE}** ("we", "us"). The provider's details are in the [legal notice](/docs/legal-notice). By using the service you agree to these terms. If you do not agree, please do not use it.`,
    },
    { t: "h2", text: "1. What the service is" },
    {
      t: "p",
      text: "Ledger Chat is a messenger in which a wallet address is your account. It offers direct messages, communities, voice and video calls, payments that you sign in your own wallet, and an experimental private payments wallet on the Aztec test network. The [documentation](/docs/overview) describes each feature, including the ones that are not finished.",
    },
    {
      t: "p",
      text: "The service is free. We do not charge for accounts, messages or payments, and we do not add a fee to any transaction. Networks charge their own fees, which your wallet shows you before you approve.",
    },
    { t: "h2", text: "2. Who can use the service" },
    {
      t: "ul",
      items: [
        "You must be at least 16 years old and able to enter into this agreement under the law where you live.",
        "You must not be located in, or ordinarily resident in, a country or region subject to comprehensive sanctions by the European Union or the United Nations, and you must not be named on a sanctions list of either.",
        "If you use the service for an organisation, you confirm that you can bind it to these terms.",
      ],
    },
    { t: "h2", text: "3. Your account and your keys" },
    {
      t: "ul",
      items: [
        "Your account is the wallet address you sign in with, or the email address you verify. You are responsible for keeping access to it secure.",
        "We never hold your private keys or your recovery phrase and cannot recover them. If you lose them, you may lose access to your account and to anything it controls.",
        "The keys of your private payments wallet are created in your browser from a signature by your own wallet. We never receive them.",
        "You are responsible for every transaction you approve. We cannot cancel or reverse it.",
      ],
    },
    { t: "h2", text: "4. Early access" },
    {
      t: "p",
      text: "Ledger Chat is in early access. Features may change, be limited or be withdrawn, and the service may be unavailable at times. Our contracts have not been reviewed by an independent auditor. Known problems are listed on the [audits page](/docs/audits). Please read the [risk disclosure](/docs/disclaimer) before you use the service with anything of value.",
    },
    { t: "h2", text: "5. Private payments on the Aztec test network" },
    {
      t: "p",
      text: "The private payments wallet (shield, unshield, send and receive) runs on the **Aztec test network**, not on a network with real value. The tokens it shows are test tokens: they have no monetary value, cannot be exchanged for money or for other assets through us, and may be reset if the test network is reset. Do not buy, sell or accept test tokens as payment.",
    },
    { t: "h2", text: "6. Acceptable use" },
    { t: "p", text: "You agree not to use the service to:" },
    {
      t: "ul",
      items: [
        "break the law, or help anyone else do so, including laws on sanctions, money laundering, terrorist financing and fraud;",
        "harass, threaten, exploit or incite violence against anyone;",
        "share any sexual content involving minors, or any content that sexualises minors;",
        "share content that infringes someone else's intellectual property, privacy or image rights;",
        "send spam, malware or phishing, or impersonate another person or organisation, including us;",
        "interfere with the service, test its security outside our [disclosure guidelines](/docs/bug-bounty), or access data that is not yours.",
      ],
    },
    { t: "h2", text: "7. Content and moderation" },
    {
      t: "p",
      text: "You keep ownership of what you send and post. You give us the limited, non exclusive permission needed to store it, deliver it to the people you send it to, and show community content to the members of that community. This permission ends when the content is deleted, except for copies we must keep by law.",
    },
    {
      t: "p",
      text: "Anyone can report content they believe is illegal or breaks these terms, as explained in [Content and copyright](/docs/content-policy). We can remove community content and suspend access to the parts of the service we operate. When we do, we tell the person affected and give our reasons, unless the law prevents it. We cannot read, and therefore cannot moderate, direct messages that are encrypted end to end.",
    },
    { t: "h2", text: "8. Payments" },
    {
      t: "p",
      text: "Payments are sent from your own wallet directly on a public blockchain or on Aztec. We are not a party to them and we never hold funds for you. We are not a bank, a payment institution, an electronic money institution, a crypto asset service provider, an exchange or a broker, and we do not offer custody, exchange or transfer services for crypto assets on your behalf. Nothing in the service is financial, investment, legal or tax advice. You are responsible for any tax that applies to your transactions.",
    },
    { t: "h2", text: "9. Our software and our name" },
    {
      t: "p",
      text: "The source code of the service is published in our [GitHub repository](https://github.com/humanityledger/Humanity-Ledger) so that anyone can read what it does. It is **source available, not open source**: it is licensed under the proprietary licence in the repository's `LICENSE` file, which allows reading it but not copying, redistributing or running it as a competing service. The names Humanity Ledger and Ledger Chat, and our logos, may not be used for another product. Software by others that we use keeps its own licence.",
    },
    { t: "h2", text: "10. Services we do not control" },
    {
      t: "p",
      text: "The service depends on wallets, blockchains, the XMTP network, the Aztec network and other providers listed in the [Privacy Policy](/docs/privacy). We are not responsible for how they work, for their availability, or for losses caused by them.",
    },
    { t: "h2", text: "11. Disclaimers and liability" },
    {
      t: "p",
      text: "The service is provided free of charge, as it is and as available. To the extent the law allows, we do not promise that it will be uninterrupted, error free or secure, and we are not liable for indirect or consequential losses, for lost profits, or for losses caused by networks, wallets or services we do not control.",
    },
    {
      t: "p",
      text: "Nothing in these terms limits or excludes liability for death or personal injury caused by negligence, for fraud or wilful misconduct, or any other liability that cannot be limited by law, and nothing affects the rights you have as a consumer under the law of the country where you live.",
    },
    { t: "h2", text: "12. Suspension and ending" },
    {
      t: "p",
      text: "You can stop using the service at any time and ask us to delete your account as explained in the [Privacy Policy](/docs/privacy). We may suspend or end your access if you seriously or repeatedly break these terms, if the law requires it, or if we stop providing the service. Where possible we will warn you first and give you time to save your data.",
    },
    { t: "h2", text: "13. Changes to these terms" },
    {
      t: "p",
      text: "We may update these terms, for example when the service changes or the law requires it. We will tell you about significant changes in the app or on this page at least fifteen days before they take effect, unless a change is needed sooner for legal or security reasons. If you keep using the service after that date, the new terms apply.",
    },
    { t: "h2", text: "14. Law and disputes" },
    {
      t: "p",
      text: "These terms are governed by the laws of Spain. If you are a consumer, you also keep the protection of the mandatory rules of the country where you live, and you can bring a claim in the courts of that country. We would rather solve a problem directly, so please write to us first.",
    },
    { t: "h2", text: "15. Contact" },
    { t: "p", text: `Questions about these terms can be sent to ${CONTACT}.` },
  ],
};

/* -------------------------------------------------------------------------- */
/* Privacy Policy                                                             */
/* -------------------------------------------------------------------------- */

export const privacy: DocPage = {
  slug: "privacy",
  href: "/docs/privacy",
  label: "Privacy Policy",
  summary: "What personal data we process, why, where it is stored, how long we keep it and how to exercise your rights.",
  keywords: ["privacy", "data", "gdpr", "rgpd", "lopdgdd", "retention", "personal data", "delete", "erasure", "access", "tracking", "controller", "transfers"],
  updated: REVIEWED,
  blocks: [
    {
      t: "p",
      text: `This policy explains how personal data is processed when you use the Humanity Ledger websites and Ledger Chat. The controller of that data is **${LEGAL_ENTITY.name}**, who provides the service as a private individual under the name Humanity Ledger. You can reach the controller at ${CONTACT}. Full details are in the [legal notice](/docs/legal-notice).`,
    },
    {
      t: "hint",
      tone: "info",
      title: "The short version",
      text: "We cannot read direct messages delivered through XMTP, and we never receive the keys of your wallet or of your private payments wallet. We can read some other things, listed below, and we say exactly which. We do not sell data, we do not show advertising, and we do not use analytics or advertising trackers.",
    },
    { t: "h2", text: "1. Data we process" },
    {
      t: "table",
      head: ["Data", "Why", "Kept for"],
      strongFirst: true,
      rows: [
        ["Wallet address", "It is your account identifier.", "Until you ask us to delete your account."],
        ["Email address, if you sign in with email", "To send you sign in codes and, if you ask, messages about your account.", "Until you ask us to delete your account."],
        ["Sign in codes", "To check the code you type. Stored only as a hash.", "Until used or expired, within minutes."],
        ["Session data", "To keep you signed in. Held in cookies described in the [Cookie Policy](/docs/cookies).", "Seven days, or thirty days for the email refresh token."],
        ["Display name and profile picture, if you set them", "So that people you talk to can recognise you.", "Until you change or remove them."],
        ["Contacts and contact requests", "So that your contacts follow you to new devices.", "Until you remove them or delete your account."],
        ["Community memberships, roles, posts and channel messages", "To run communities.", "Until deleted by you or a moderator, or until the community is deleted."],
        ["Messages sent through the fallback path", "To deliver a message when XMTP delivery fails. These are readable by us and labelled in the chat.", "Up to seven days in our cache, and in our database until deleted."],
        ["Attachments", "So the recipient can download them. Not yet encrypted.", "Until deleted."],
        ["Hash of your PIN", "To check the PIN you enter.", "Until you remove the PIN or delete your account."],
        ["Online status", "So that contacts can see when you are available.", "A few minutes after you go offline."],
        ["Device linking codes", "To link a second device by QR code.", "Four minutes, in server memory."],
        ["IP address and request details", "To keep the service secure and to limit abuse, for example by rate limiting.", "Rate limit counters expire within minutes. Our hosting provider keeps request logs for a limited period."],
      ],
    },
    {
      t: "p",
      text: "**What we do not receive.** The content of direct messages delivered through XMTP, which is encrypted on your device. Your wallet's private key or recovery phrase. The keys of your private payments wallet, which are created in your browser. Your Aztec address, your private balances, your transactions and the content of your private notes: the private wallet runs in your browser and talks to the Aztec test network directly, without our server. If you send a private payment from a conversation, the chat message that announces it is handled like any other message.",
    },
    { t: "h2", text: "2. Legal bases" },
    {
      t: "ul",
      items: [
        "**Contract** (article 6.1.b GDPR). Most processing is needed to provide the service you asked for.",
        "**Legitimate interests** (article 6.1.f). Security, abuse prevention and keeping the service working. You can object at any time.",
        "**Consent** (article 6.1.a). Optional features such as push notifications. You can withdraw consent in your settings at any time.",
        "**Legal obligation** (article 6.1.c). Where a law requires us to keep or disclose data.",
      ],
    },
    {
      t: "p",
      text: "We do not make decisions about you based solely on automated processing that have legal or similarly significant effects, and we do not build advertising profiles.",
    },
    { t: "h2", text: "3. Service providers" },
    {
      t: "p",
      text: "We use a small number of providers to run the service. They process data only on our instructions or, for open networks, as part of the network's normal operation.",
    },
    {
      t: "table",
      head: ["Provider", "Purpose"],
      strongFirst: true,
      rows: [
        ["Hosting, database and cache providers", "Running our servers, our PostgreSQL database and our Redis cache."],
        ["XMTP network", "Delivering encrypted direct messages."],
        ["Resend", "Sending sign in codes by email."],
        ["Cloudflare", "Bot protection on email sign in, and storage of attachments."],
        ["Reown", "Connecting wallets through WalletConnect."],
        ["PeerJS, Google and OpenRelay", "Setting up and relaying voice and video calls. Call content is encrypted between browsers."],
        ["Blockchain RPC providers", "Reading balances and broadcasting the transactions you approve."],
        ["Aztec test network nodes", "Receiving the private payment transactions your browser has already proven. They see that a transaction exists, not its amount or its parties."],
      ],
    },
    {
      t: "p",
      text: "Some providers are outside the European Economic Area. Where that is the case, transfers rely on an adequacy decision of the European Commission or on its standard contractual clauses.",
    },
    { t: "h2", text: "4. Public blockchains" },
    {
      t: "p",
      text: "Payments you send on Ethereum and similar networks are public and permanent. Neither we nor anyone else can delete them. Moving funds into or out of a private Aztec balance is also public. Think carefully before linking a wallet address to your real name.",
    },
    { t: "h2", text: "5. Requests from authorities" },
    {
      t: "p",
      text: "We disclose personal data to public authorities only when Spanish or European law requires it, in response to a request that is valid in form and scope. We can only hand over what we hold, as listed in section 1. We cannot hand over the content of direct messages delivered through XMTP or private payment details, because we do not have them.",
    },
    { t: "h2", text: "6. Security" },
    {
      t: "p",
      text: "Connections are encrypted with TLS. Sessions are held in cookies that scripts cannot read, PINs are stored as Argon2id hashes, and access to production systems is limited to the provider. The measures in place, and the weaknesses we know about, are described openly in the [security model](/docs/security-model) and on the [audits page](/docs/audits). If a breach puts your rights at risk, we will tell the supervisory authority and, where required, you.",
    },
    { t: "h2", text: "7. Your rights" },
    {
      t: "p",
      text: `Under the GDPR and Spanish Organic Law 3/2018 you can ask for access to your data, to correct it, to delete it, to receive it in a portable format, to restrict its processing and to object to processing based on legitimate interests. Write to ${CONTACT} from the email address linked to your account, or include a message signed with the wallet linked to your account, so that we can confirm the request is yours. We answer within one month.`,
    },
    {
      t: "p",
      text: `You also have the right to complain to a data protection authority. In Spain this is the [${LEGAL_ENTITY.supervisoryAuthority.name}](${LEGAL_ENTITY.supervisoryAuthority.url}).`,
    },
    { t: "h2", text: "8. Deleting your account" },
    {
      t: "p",
      text: "When you ask us to delete your account, we delete your profile, contacts, PIN hash and the fallback messages we hold for you. Posts you made in communities are deleted or anonymised. We cannot delete what lives outside our systems: messages on the XMTP network, history stored on your own devices, and transactions on public blockchains.",
    },
    { t: "h2", text: "9. Children" },
    {
      t: "p",
      text: "The service is not intended for anyone under 16. If you believe a child has given us personal data, contact us and we will delete it.",
    },
    { t: "h2", text: "10. Changes" },
    {
      t: "p",
      text: "When this policy changes, we update the date on this page. If the change is significant, we also tell you in the app before it takes effect.",
    },
  ],
};

/* -------------------------------------------------------------------------- */
/* Cookie Policy                                                              */
/* -------------------------------------------------------------------------- */

export const cookies: DocPage = {
  slug: "cookies",
  href: "/docs/cookies",
  label: "Cookie Policy",
  summary: "Every cookie and kind of browser storage Ledger Chat uses, and what each one is for.",
  keywords: ["cookies", "storage", "local storage", "indexeddb", "session", "tracking", "consent", "banner"],
  updated: REVIEWED,
  blocks: [
    {
      t: "p",
      text: "We only use cookies and browser storage that the service needs in order to work, such as keeping you signed in. These are exempt from consent under article 22.2 of the Spanish LSSI-CE and the ePrivacy Directive. We do not use advertising or analytics cookies, so there is nothing to accept or reject.",
    },
    { t: "h2", text: "Cookies" },
    {
      t: "table",
      head: ["Name", "Purpose", "Duration"],
      strongFirst: true,
      rows: [
        ["`hl_session`", "Keeps you signed in. Scripts on the page cannot read it.", "Seven days"],
        ["`hl_refresh`", "Renews your session when you signed in with email. Scripts cannot read it.", "Thirty days"],
        ["`human_session`, `ledger_session`", "The same session under older names, kept while older parts of the app are updated. Scripts cannot read them.", "Seven days"],
        ["`siwe-nonce`", "Holds the one time value used while you sign in with your wallet.", "Ten minutes"],
        ["`qr_init_session`", "Identifies a device that is being linked by QR code.", "Up to five minutes"],
      ],
    },
    { t: "h2", text: "Browser storage" },
    {
      t: "table",
      head: ["What", "Purpose"],
      strongFirst: true,
      rows: [
        ["Message keys and history", "Created by XMTP in your browser so that you can read your conversations. Never sent to us."],
        ["Private payments wallet", "The Aztec account, notes and transaction history created by the wallet in your browser. Never sent to us."],
        ["Settings", "Your preferences, such as notification and privacy settings."],
        ["Wallet connection", "Remembers which wallet you connected, so you are not asked every time."],
      ],
    },
    {
      t: "p",
      text: "You can delete all of this from your browser settings. Deleting browser storage signs you out and removes the conversation history and the private payments wallet data kept on that device. Your private balance is not lost: it can be recovered on any device by signing in with the same wallet, because the wallet's keys are derived from your wallet's signature.",
    },
  ],
};

/* -------------------------------------------------------------------------- */
/* Content and copyright                                                      */
/* -------------------------------------------------------------------------- */

export const contentPolicy: DocPage = {
  slug: "content-policy",
  href: "/docs/content-policy",
  label: "Content and copyright",
  summary: "How to report illegal content or an infringement of your rights, and the licence that covers our own code.",
  keywords: ["report", "illegal content", "dsa", "digital services act", "copyright", "dmca", "takedown", "infringement", "licence", "license", "trademark", "notice and action"],
  updated: REVIEWED,
  blocks: [
    {
      t: "p",
      text: "This page explains how to tell us about content on the service that you believe is illegal or infringes your rights, what we do with your report, and how our own software is licensed.",
    },
    { t: "h2", text: "What we can and cannot act on" },
    {
      t: "table",
      head: ["Content", "Can we act on it?"],
      strongFirst: true,
      rows: [
        ["Community posts, channel messages and community names", "Yes. They are stored on our server."],
        ["Profiles: names and pictures", "Yes."],
        ["Attachments", "Yes, if you give us the link."],
        ["Messages sent through the fallback path", "Yes, if a participant reports them."],
        ["Direct messages delivered through XMTP", "No. They are encrypted end to end and we cannot read them. We can suspend the account that sent them from the parts of the service we operate."],
        ["Transactions on a blockchain", "No. Nobody can remove them."],
      ],
    },
    { t: "h2", text: "Reporting illegal content" },
    {
      t: "p",
      text: `Write to ${CONTACT}. Inside a community you can also report a post to its moderators from the app. Our email address is also our single point of contact under articles 11 and 12 of the EU Digital Services Act, for users and for authorities. We answer in English or Spanish. Please include:`,
    },
    {
      t: "ol",
      items: [
        "the exact location of the content, such as a link to the post or the community name and the date;",
        "why you believe it is illegal, with the law concerned if you know it;",
        "your name and email address, unless you are reporting child sexual abuse material, which you can report anonymously;",
        "a statement that you believe in good faith that the report is accurate and complete.",
      ],
    },
    {
      t: "p",
      text: "We acknowledge every report, review it without undue delay and tell you what we decided. If we remove content or restrict an account, we tell the person affected and give our reasons. Either of you can ask us to review the decision by replying to our message. Reports of child sexual abuse material are passed to the competent authorities.",
    },
    { t: "h2", text: "Copyright and trademark claims" },
    {
      t: "p",
      text: `If you believe content on the service infringes your copyright or your trademark, send the details above to ${CONTACT}, together with a description of your work or mark and a statement that you are its owner or are authorised to act for the owner. We handle these claims under the same process.`,
    },
    { t: "h2", text: "Our own software and names" },
    {
      t: "p",
      text: `The Humanity Ledger source code is published on [GitHub](https://github.com/humanityledger/Humanity-Ledger) so that anyone can check what it does. It is **source available, not open source**. Copyright belongs to ${LEGAL_ENTITY.name}, and the licence in the repository's \`LICENSE\` file allows you to read the code but not to copy, redistribute or run it as a competing service. The names Humanity Ledger and Ledger Chat, and our logos, may not be used for another product. Libraries written by others keep their own licences.`,
    },
    {
      t: "p",
      text: `If you find a copy of Humanity Ledger presented as ours, or one that asks people for their recovery phrase, please tell us at ${CONTACT}. It is not us, and it may be trying to steal from the people who use it.`,
    },
  ],
};

/* -------------------------------------------------------------------------- */
/* Risk disclosure                                                            */
/* -------------------------------------------------------------------------- */

const riskBlocks: Block[] = [
  { t: "p", text: "Please read this before you use Ledger Chat to send or hold anything of value." },
  { t: "h2", text: "Early access software" },
  {
    t: "p",
    text: "Ledger Chat is in early access. It has bugs we know about, listed on the [audits page](/docs/audits), and certainly some we do not. Our contracts have not been reviewed by an independent auditor.",
  },
  { t: "h2", text: "Blockchain transactions are final" },
  {
    t: "p",
    text: "A payment you approve cannot be reversed by us or by anyone else. If you send funds to the wrong address, they are almost certainly lost.",
  },
  { t: "h2", text: "Private payments run on a test network" },
  {
    t: "p",
    text: "The private payments wallet uses the Aztec **test network**. Its tokens have no value and may disappear if the network is reset. The Aztec mainnet runs a different version (5.2.0 at the time of writing) that our wallet does not support, and Aztec itself describes its mainnet as alpha, where bugs, including critical ones, are expected. We will not connect the wallet to a network with real value until our contracts have been audited.",
  },
  { t: "h2", text: "Networks we do not control" },
  {
    t: "p",
    text: "Payments depend on Ethereum and on Aztec, and messages depend on XMTP. Any of them can be slow, unavailable or affected by vulnerabilities of their own. In August 2026 Aztec's contributors reported a critical vulnerability in the proving system of Alpha V5.",
  },
  { t: "h2", text: "Your keys" },
  {
    t: "p",
    text: "If you lose your recovery phrase, or someone else obtains it, you can lose your account and your funds. Anyone with your wallet can also open your private payments wallet, because its keys are derived from your wallet's signature. We cannot help recover either.",
  },
  { t: "h2", text: "No advice, no financial services" },
  {
    t: "p",
    text: "Nothing on our websites or in Ledger Chat is financial, investment, legal or tax advice. We do not hold, exchange or transfer crypto assets for anyone. Digital assets can lose value quickly.",
  },
  { t: "hint", tone: "warning", text: "Only use amounts you can afford to lose." },
];

export const disclaimer: DocPage = {
  slug: "disclaimer",
  href: "/docs/disclaimer",
  label: "Risk disclosure",
  summary: "The risks of using early access software that interacts with blockchains, in plain words.",
  keywords: ["risk", "disclaimer", "warning", "loss", "funds", "liability", "alpha", "beta", "experimental", "testnet"],
  updated: REVIEWED,
  blocks: riskBlocks,
};
