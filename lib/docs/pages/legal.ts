import type { DocPage } from "../types";

const CONTACT = "[humanityledger@icloud.com](mailto:humanityledger@icloud.com)";

export const terms: DocPage = {
  slug: "terms",
  href: "/docs/terms",
  label: "Terms of Service",
  summary: "The agreement between you and Humanity Ledger S.L. when you use our websites and Ledger Chat.",
  keywords: ["terms", "tos", "agreement", "legal", "conditions", "rules", "acceptable use", "liability", "age"],
  updated: "2026-10-21",
  blocks: [
    {
      t: "p",
      text: "These terms apply to the Humanity Ledger websites and to Ledger Chat, which together we call the service. The service is provided by **Humanity Ledger S.L.** By using it you agree to these terms. If you do not agree, please do not use the service.",
    },
    { t: "h2", text: "1. Who can use the service" },
    {
      t: "p",
      text: "You must be at least 16 years old, and old enough under the law where you live to agree to these terms. If you use the service for an organisation, you confirm that you can bind it to these terms.",
    },
    { t: "h2", text: "2. Your account and your keys" },
    {
      t: "ul",
      items: [
        "Your account is the wallet address you sign in with, or the email address you verify. You are responsible for keeping access to it secure.",
        "We do not hold your private keys or your recovery phrase and cannot recover them. If you lose them, you may lose access to your account and to anything it controls.",
        "You are responsible for the transactions you approve in your wallet. We cannot reverse them.",
      ],
    },
    { t: "h2", text: "3. Early access" },
    {
      t: "p",
      text: "Ledger Chat is in early access. Features may change, be limited or be withdrawn, and the service may be unavailable at times. Some features are experimental and are labelled as such in the app and in the [documentation](/docs/overview). Our contracts have not been independently audited.",
    },
    { t: "h2", text: "4. Acceptable use" },
    {
      t: "p",
      text: "You agree not to use the service to:",
    },
    {
      t: "ul",
      items: [
        "break the law, or help anyone else do so;",
        "harass, threaten or exploit anyone, or share sexual content involving minors;",
        "send spam, malware or phishing, or impersonate another person or organisation;",
        "interfere with the service, test its security outside our [disclosure guidelines](/docs/bug-bounty), or access data that is not yours.",
      ],
    },
    {
      t: "p",
      text: "We can remove content from communities and suspend access to the parts of the service we operate if you break these rules. We cannot read or remove direct messages that are encrypted end to end.",
    },
    { t: "h2", text: "5. Payments" },
    {
      t: "p",
      text: "Payments are sent from your own wallet directly on a public blockchain or on Aztec. We are not a party to them, we do not hold funds, and we are not a bank, a payment institution, an exchange or a broker. Nothing in the service is financial, investment, legal or tax advice. If a feature needs identity verification, it will tell you before you begin and name the provider that carries it out.",
    },
    { t: "h2", text: "6. Your content" },
    {
      t: "p",
      text: "You keep ownership of what you send and post. You give us the limited permission needed to store and deliver it to the people you send it to, and to display community content to the members of that community.",
    },
    { t: "h2", text: "7. Open source software" },
    {
      t: "p",
      text: "Parts of the service are published in our [GitHub repository](https://github.com/humanityledger/Humanity-Ledger) under the licence stated there. That licence, not these terms, governs your use of the source code.",
    },
    { t: "h2", text: "8. Disclaimers and liability" },
    {
      t: "p",
      text: "The service is provided as it is and as available. To the extent the law allows, we do not give warranties that it will be uninterrupted, error free or secure, and we are not liable for indirect or consequential losses, or for losses caused by blockchain networks, wallets or other services we do not control. Nothing in these terms limits liability that cannot be limited by law, including under consumer protection rules that apply to you.",
    },
    { t: "h2", text: "9. Changes and ending" },
    {
      t: "p",
      text: "We may update these terms. If a change is significant we will tell you in the app or on this page before it takes effect. You can stop using the service at any time. We may suspend or end access if you seriously or repeatedly break these terms.",
    },
    { t: "h2", text: "10. Law and contact" },
    {
      t: "p",
      text: `These terms are governed by the laws of Spain, without affecting any mandatory rights you have under the law of the country where you live. Questions about these terms can be sent to ${CONTACT}.`,
    },
  ],
};

export const privacy: DocPage = {
  slug: "privacy",
  href: "/docs/privacy",
  label: "Privacy Policy",
  summary: "What personal data we process, why, where it is stored, how long we keep it and how to exercise your rights.",
  keywords: ["privacy", "data", "gdpr", "rgpd", "retention", "personal data", "delete", "erasure", "access", "tracking", "controller"],
  updated: "2026-10-21",
  blocks: [
    {
      t: "p",
      text: `This policy explains how **Humanity Ledger S.L.** processes personal data when you use our websites and Ledger Chat. We are the controller of that data. You can reach us at ${CONTACT}.`,
    },
    {
      t: "hint",
      tone: "info",
      title: "The short version",
      text: "We cannot read direct messages delivered through XMTP. We can read some other things, listed below, and we say exactly which. We do not sell data, we do not show advertising, and we do not use third party analytics or advertising trackers.",
    },
    { t: "h2", text: "1. Data we process" },
    {
      t: "table",
      head: ["Data", "Why", "Kept for"],
      strongFirst: true,
      rows: [
        ["Wallet address", "It is your account identifier.", "Until you ask us to delete your account."],
        ["Email address, if you sign in with email", "To send you sign in codes and, if you ask, account messages.", "Until you ask us to delete your account."],
        ["Display name and profile picture, if you set them", "So that people you talk to can recognise you.", "Until you change or remove them."],
        ["Contacts and contact requests", "So that your contacts follow you to new devices.", "Until you remove them or delete your account."],
        ["Community memberships, roles, posts and channel messages", "To run communities.", "Until they are deleted by you or a moderator, or the community is deleted."],
        ["Messages sent through the fallback path", "To deliver a message when XMTP delivery fails.", "Up to seven days in our cache, and in our database until deleted."],
        ["Attachments", "So the recipient can download them.", "Until deleted."],
        ["Hash of your PIN", "To check the PIN you enter.", "Until you remove the PIN or delete your account."],
        ["Online status", "So that contacts can see when you are available.", "A few minutes after you go offline."],
        ["IP address and request details", "To keep the service secure and to limit abuse, for example by rate limiting.", "Short term counters expire within minutes. Hosting logs are kept by our provider for a limited period."],
      ],
    },
    {
      t: "p",
      text: "Direct messages delivered through XMTP are encrypted on your device. We never receive the keys to read them, so we do not process their content.",
    },
    { t: "h2", text: "2. Legal bases" },
    {
      t: "ul",
      items: [
        "**Contract.** Most processing is needed to provide the service you asked for.",
        "**Legitimate interests.** Security, abuse prevention and keeping the service working.",
        "**Consent.** Optional features such as push notifications. You can withdraw consent in your settings at any time.",
        "**Legal obligation.** Where a law requires us to keep or disclose data.",
      ],
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
        ["Hosting, database and cache providers", "Running our servers, PostgreSQL database and Redis cache."],
        ["XMTP network", "Delivering encrypted direct messages."],
        ["Resend", "Sending sign in codes by email."],
        ["Cloudflare", "Bot protection on email sign in, and storage of attachments."],
        ["Reown", "Connecting wallets through WalletConnect."],
        ["PeerJS, Google and OpenRelay", "Setting up and relaying voice and video calls."],
        ["Blockchain RPC providers", "Reading balances and broadcasting the transactions you approve."],
      ],
    },
    {
      t: "p",
      text: "Some providers are outside the European Economic Area. Where that is the case, transfers rely on an adequacy decision or on the European Commission's standard contractual clauses.",
    },
    { t: "h2", text: "4. Public blockchains" },
    {
      t: "p",
      text: "Payments you send on Ethereum and similar networks are public and permanent. Neither we nor anyone else can delete them. Think carefully before linking your wallet address to your real name.",
    },
    { t: "h2", text: "5. Your rights" },
    {
      t: "p",
      text: `Under the GDPR you can ask us for access to your data, to correct it, to delete it, to receive it in a portable format, to restrict its processing or to stop processing based on legitimate interests. Write to ${CONTACT} from the email address or by signing a message with the wallet linked to your account, so that we can confirm the request is yours. We answer within one month.`,
    },
    {
      t: "p",
      text: "You also have the right to complain to a data protection authority. In Spain this is the [Agencia Española de Protección de Datos](https://www.aepd.es).",
    },
    { t: "h2", text: "6. Children" },
    {
      t: "p",
      text: "The service is not intended for anyone under 16. If you believe a child has given us personal data, contact us and we will delete it.",
    },
    { t: "h2", text: "7. Changes" },
    {
      t: "p",
      text: "When this policy changes, we update the date at the bottom of this page. If the change is significant, we also tell you in the app.",
    },
  ],
};

export const cookies: DocPage = {
  slug: "cookies",
  href: "/docs/cookies",
  label: "Cookie Policy",
  summary: "The cookies and browser storage Ledger Chat uses, and what each one is for.",
  keywords: ["cookies", "storage", "local storage", "indexeddb", "session", "tracking", "consent"],
  updated: "2026-10-21",
  blocks: [
    {
      t: "p",
      text: "We only use cookies and browser storage that the service needs in order to work. We do not use advertising or analytics cookies, so there is nothing to opt out of.",
    },
    { t: "h2", text: "Cookies" },
    {
      t: "table",
      head: ["Name", "Purpose", "Duration"],
      strongFirst: true,
      rows: [
        ["`hl_session`", "Keeps you signed in. Scripts on the page cannot read it.", "Seven days"],
        ["`human_session`", "The same session under an older name, kept while older parts of the app are updated.", "Seven days"],
        ["`siwe-nonce`", "Holds the one time value used while you sign in with your wallet.", "A few minutes"],
      ],
    },
    { t: "h2", text: "Browser storage" },
    {
      t: "table",
      head: ["What", "Purpose"],
      strongFirst: true,
      rows: [
        ["Message keys and history", "Created by XMTP in your browser so you can read your conversations. Never sent to us."],
        ["Settings", "Your preferences, such as notification and privacy settings."],
        ["Wallet connection", "Remembers which wallet you connected, so you are not asked every time."],
      ],
    },
    {
      t: "p",
      text: "You can delete all of this from your browser settings. Deleting browser storage signs you out and removes the conversation history kept on that device.",
    },
  ],
};

export const disclaimer: DocPage = {
  slug: "disclaimer",
  href: "/docs/disclaimer",
  label: "Risk disclosure",
  summary: "The risks of using early access software that interacts with blockchains, in plain words.",
  keywords: ["risk", "disclaimer", "warning", "loss", "funds", "liability", "alpha", "beta", "experimental"],
  updated: "2026-10-21",
  blocks: [
    {
      t: "p",
      text: "Please read this before you use Ledger Chat to send or hold anything of value.",
    },
    { t: "h2", text: "Early access software" },
    {
      t: "p",
      text: "Ledger Chat is in early access. It has bugs we know about, listed on the [audits page](/docs/audits), and certainly some we do not. Our contracts have not been independently audited.",
    },
    { t: "h2", text: "Blockchain transactions are final" },
    {
      t: "p",
      text: "A payment you approve cannot be reversed by us or by anyone else. If you send funds to the wrong address, they are almost certainly lost.",
    },
    { t: "h2", text: "Networks we do not control" },
    {
      t: "p",
      text: "Payments depend on Ethereum, its layer 2 networks and Aztec, and messages depend on XMTP. Any of them can be slow, unavailable or affected by vulnerabilities of their own. Aztec is in alpha, and a critical vulnerability was reported in its Alpha V5 release in August 2026.",
    },
    { t: "h2", text: "Your keys" },
    {
      t: "p",
      text: "If you lose your recovery phrase, or someone else obtains it, you can lose your account and your funds. We cannot help recover either.",
    },
    { t: "h2", text: "No advice" },
    {
      t: "p",
      text: "Nothing on our websites or in Ledger Chat is financial, investment, legal or tax advice. Digital assets can lose value quickly.",
    },
    {
      t: "hint",
      tone: "warning",
      text: "Only use amounts you can afford to lose.",
    },
  ],
};
