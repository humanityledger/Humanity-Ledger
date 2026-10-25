import type { DocPage } from "../types";

export const overview: DocPage = {
  slug: "overview",
  href: "/docs/overview",
  label: "Overview",
  title: "Humanity Ledger documentation",
  summary: "What Humanity Ledger is, what Ledger Chat does today, and where to read more.",
  keywords: ["intro", "introduction", "start", "what is", "about", "humanity ledger", "ledger chat", "begin"],
  updated: "2026-10-21",
  blocks: [
    {
      t: "p",
      text: "Humanity Ledger builds private communication tools that you sign in to with a wallet you already hold, instead of a phone number or a password. **Ledger Chat** is our first application: a messenger for direct conversations, communities, calls and payments.",
    },
    {
      t: "p",
      text: "This documentation describes how the product works today, including the parts that are not finished. Where something is still in development, the page says so.",
    },
    { t: "h2", text: "Start here" },
    {
      t: "cards",
      items: [
        { title: "Quick start", text: "Sign in, set a PIN and start your first conversation.", href: "/docs/quickstart", icon: "rocket" },
        { title: "Messaging", text: "What is encrypted, what is not, and how to tell the difference.", href: "/docs/ledger-chat", icon: "message" },
        { title: "Architecture", text: "The parts of the system and what each one can see.", href: "/docs/architecture", icon: "server" },
        { title: "Developer hub", text: "Run the code locally and find your way around the repository.", href: "/developers", icon: "code" },
      ],
    },
    { t: "h2", text: "What works today" },
    {
      t: "p",
      text: "Ledger Chat is in early access. The table below is the honest state of each feature as of the date at the bottom of this page.",
    },
    {
      t: "status",
      items: [
        { label: "Sign in with a wallet", state: "available", text: "Any Ethereum wallet that can sign a message, using the Sign in with Ethereum standard." },
        { label: "Sign in with email", state: "available", text: "A one time code sent to your inbox. Useful before you have a wallet." },
        { label: "Direct messages", state: "available", text: "Encrypted on your device and delivered through the XMTP network." },
        { label: "Fallback delivery", state: "partial", text: "When XMTP delivery fails, a message can travel through our server in readable form. The chat labels these messages." },
        { label: "Communities", state: "available", text: "Channels, roles, posts and invite links. Community posts are not yet encrypted end to end." },
        { label: "Voice and video calls", state: "available", text: "Direct browser to browser calls, encrypted by WebRTC." },
        { label: "Payments in chat", state: "available", text: "Send tokens from your own wallet to the person you are talking to." },
        { label: "Private payments on Aztec", state: "partial", text: "Shield, send, receive by QR code and unshield work on the Aztec test network, with test tokens that have no value. No bridge from Ethereum and no independent audit yet." },
        { label: "Attachments", state: "partial", text: "Files are uploaded to our storage provider and are not yet encrypted end to end." },
        { label: "Windows app", state: "partial", text: "An unsigned preview build. The web app is the supported client." },
        { label: "iPhone and Android apps", state: "development", text: "Not yet submitted to the App Store or Google Play." },
      ],
    },
    { t: "h2", text: "How the documentation is organised" },
    {
      t: "defs",
      items: [
        { term: "Getting started", text: "Accounts, sign in and the PIN that protects Ledger Chat on your devices." },
        { term: "Ledger Chat", text: "Each feature of the messenger, what it does and what it reveals." },
        { term: "Protocol", text: "The architecture, the encryption in use and the whitepaper." },
        { term: "Security", text: "Our security model, the findings that are still open and how to report a new one." },
        { term: "Company and legal", text: "Who we are, how to reach us, and the terms and policies that apply." },
      ],
    },
    {
      t: "hint",
      tone: "info",
      title: "Found a mistake?",
      text: "Every page can be corrected on GitHub. Use the link at the bottom of the page, or [open an issue](https://github.com/humanityledger/Humanity-Ledger/issues).",
    },
  ],
};

export const quickstart: DocPage = {
  slug: "quickstart",
  href: "/docs/quickstart",
  label: "Quick start",
  summary: "Go from nothing to your first private conversation in a few minutes.",
  keywords: ["getting started", "setup", "first steps", "how to", "begin", "tutorial", "install", "download"],
  updated: "2026-10-21",
  blocks: [
    {
      t: "p",
      text: "Ledger Chat runs in your browser. You do not need to install anything to start, and sending messages is free.",
    },
    { t: "h2", text: "Before you begin" },
    {
      t: "ul",
      items: [
        "A recent version of Chrome, Edge, Firefox, Brave or Safari.",
        "An Ethereum wallet such as MetaMask, Rainbow or Coinbase Wallet. If you do not have one yet, you can sign in with email and add a wallet later.",
        "About five minutes.",
      ],
    },
    { t: "h2", text: "Set up your account" },
    {
      t: "steps",
      items: [
        {
          title: "Open Ledger Chat",
          text: "Go to [Ledger Chat](/chat). If you are not signed in, you are taken to the sign in page.",
        },
        {
          title: "Connect your wallet",
          text: "Choose your wallet from the list. Your wallet asks you to connect, then to sign a short message. Signing is free and writes nothing to the blockchain. It only proves that the address is yours.",
        },
        {
          title: "Create a PIN",
          text: "Choose a six digit PIN. Ledger Chat asks for it when you open the app on a device, so someone who picks up your unlocked computer cannot read your conversations. See [Your PIN](/docs/pin).",
        },
        {
          title: "Allow secure messaging",
          text: "The first time, your wallet asks for one more signature. It creates the keys that encrypt your messages. They are generated in your browser and stay on your device.",
        },
        {
          title: "Start a conversation",
          text: "Search for someone by wallet address or name, or scan their code. Your first message sets up an encrypted conversation between your two devices.",
        },
      ],
    },
    { t: "h2", text: "Next steps" },
    {
      t: "ul",
      items: [
        "Read [Messaging](/docs/ledger-chat) to see what is encrypted and how fallback messages are labelled.",
        "Join or create a [community](/docs/communities).",
        "Link a second device from **Settings**, then **Linked devices**. See [Linked devices](/docs/devices).",
      ],
    },
    {
      t: "hint",
      tone: "warning",
      title: "Keep your wallet safe",
      text: "Your wallet is your account. We cannot reset it, and we will never ask for your recovery phrase. Anyone who asks for it is trying to take your account.",
    },
  ],
};

export const identity: DocPage = {
  slug: "identity",
  href: "/docs/identity",
  label: "Accounts and sign in",
  summary: "How a wallet becomes your account, how sessions work, and what happens if you lose access.",
  keywords: ["wallet", "login", "log in", "sign in", "account", "recovery", "lost", "seed phrase", "siwe", "metamask", "email", "session", "did", "identity"],
  updated: "2026-10-21",
  blocks: [
    {
      t: "p",
      text: "Your Humanity Ledger account is your wallet address. There is no username and no password. To sign in, you prove that you control the address by signing a message with your wallet.",
    },
    { t: "h2", text: "Signing in with a wallet" },
    {
      t: "p",
      text: "We use **Sign in with Ethereum**, the standard defined in [EIP-4361](https://eips.ethereum.org/EIPS/eip-4361). It works with any wallet that can sign a plain text message.",
    },
    {
      t: "steps",
      items: [
        { title: "Your browser asks for a nonce", text: "Our server returns a random value that can be used once. It is stored in a short lived cookie." },
        { title: "Your wallet shows the message", text: "The message names this website, your address, the nonce and the time. Read it before you sign: a message for another site should never be signed here." },
        { title: "You sign", text: "Your wallet signs the message with your private key. The key never leaves the wallet." },
        { title: "Our server checks the signature", text: "The server recovers the address from the signature, checks that the nonce and the domain match, and starts a session." },
      ],
    },
    {
      t: "hint",
      tone: "info",
      text: "Signing in costs nothing and sends no transaction. If your wallet asks you to approve a transaction or pay a fee at this step, stop: that is not our sign in.",
    },
    { t: "h2", text: "Signing in with email" },
    {
      t: "p",
      text: "If you do not have a wallet yet, you can sign in with an email address. We send a one time code to that address. Some features, such as payments, need a wallet, and the app asks you to link one when you reach them.",
    },
    {
      t: "p",
      text: "To limit abuse, a code can be requested a few times every ten minutes per address and per network, and the form is protected by a bot check from Cloudflare.",
    },
    { t: "h2", text: "Sessions" },
    {
      t: "ul",
      items: [
        "A session is stored in a cookie that scripts on the page cannot read.",
        "It lasts seven days, or until you sign out.",
        "Our servers never take your identity from anything the browser sends except that cookie. A header or a parameter claiming to be your address is discarded.",
      ],
    },
    { t: "h2", text: "If you lose your wallet" },
    {
      t: "p",
      text: "Nobody, including us, can recover a wallet for you. If you lose your recovery phrase you lose the account. Conversations stored on a device you still have can be read there, but you cannot sign in again with the lost address.",
    },
    {
      t: "hint",
      tone: "danger",
      title: "We will never ask for your recovery phrase",
      text: "Not by email, not in a chat, not on a call. Anyone asking for it is attempting to steal your account.",
    },
  ],
};

export const pin: DocPage = {
  slug: "pin",
  href: "/docs/pin",
  label: "Your PIN",
  summary: "What the six digit PIN protects, how it is stored, and what to do if you forget it.",
  keywords: ["pin", "enclave", "lock", "passcode", "code", "locked out", "forgot pin", "reset pin", "attempts"],
  updated: "2026-10-21",
  blocks: [
    {
      t: "p",
      text: "Ledger Chat asks for a six digit PIN when you open it. The PIN stops someone who picks up a device where you are signed in, such as a shared or unattended computer, from opening your conversations in the app.",
    },
    { t: "h2", text: "What the PIN does and does not do" },
    {
      t: "table",
      head: ["The PIN", "Details"],
      strongFirst: true,
      rows: [
        ["Unlocks Ledger Chat", "You enter it when you open Ledger Chat on a device, before any conversation is shown."],
        ["Does not encrypt messages", "Message encryption comes from the XMTP keys on your device. The PIN is a lock in front of the app, not a key to your messages."],
        ["Does not replace your wallet", "Your wallet is still your account. The PIN cannot be used to sign in on a new device."],
        ["Is not a substitute for locking your device", "Someone with technical skill and access to your unlocked computer can read data the browser has stored, with or without the PIN. Lock your device when you leave it."],
      ],
    },
    { t: "h2", text: "How the PIN is stored" },
    {
      t: "p",
      text: "Your PIN is never stored as you typed it. Our server stores the result of **Argon2id**, a password hashing function designed to be slow to guess, computed from your PIN, a salt unique to your account and a secret held only by the server.",
    },
    {
      t: "p",
      text: "After **eight wrong attempts within five minutes**, the PIN is locked for the rest of that window. The app tells you how many attempts remain and when you can try again.",
    },
    { t: "h2", text: "Changing or removing your PIN" },
    {
      t: "p",
      text: "Open **Settings** in Ledger Chat and choose the PIN option. You need your current PIN to change it or to remove it.",
    },
    { t: "h2", text: "If you forget your PIN" },
    {
      t: "p",
      text: "Wait for the lock to expire and try again carefully. A recovery flow that confirms your identity by email is being built; until it is available, contact us at [humanityledger@icloud.com](mailto:humanityledger@icloud.com) from the address linked to your account.",
    },
    {
      t: "hint",
      tone: "info",
      text: "Choose a PIN that is not your birthday, not a repeated digit and not one you use for a bank card.",
    },
  ],
};
