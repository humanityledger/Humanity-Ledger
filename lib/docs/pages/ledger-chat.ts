import type { DocPage } from "../types";

export const messaging: DocPage = {
  slug: "ledger-chat",
  href: "/docs/ledger-chat",
  label: "Messaging",
  title: "Messaging in Ledger Chat",
  summary: "How direct messages are encrypted, where your history is kept, and how to recognise a message that was not.",
  keywords: ["chat", "messages", "dm", "direct message", "encryption", "e2ee", "end to end", "xmtp", "mls", "history", "fallback", "readable"],
  updated: "2026-11-17",
  blocks: [
    {
      t: "p",
      text: "Direct messages in Ledger Chat are encrypted on your device before they are sent, and can only be decrypted on the devices of the people in the conversation. Encryption and delivery are handled by [XMTP](https://xmtp.org), an open messaging network built for wallet addresses.",
    },
    { t: "h2", text: "How a message is protected" },
    {
      t: "p",
      text: "XMTP uses **Messaging Layer Security** (MLS), the IETF standard published as [RFC 9420](https://www.rfc-editor.org/rfc/rfc9420). Each device has its own keys, created in your browser the first time you allow secure messaging. Keys are rotated as the conversation continues, so a key taken from a device later does not unlock earlier messages.",
    },
    {
      t: "ul",
      items: [
        "The text of a message, your replies and your reactions travel encrypted.",
        "XMTP nodes store the encrypted data so a recipient who is offline can receive it later. At the time of writing, XMTP keeps it without a time limit.",
        "Neither XMTP nor Humanity Ledger holds the keys needed to read it.",
      ],
    },
    { t: "h2", text: "Messages that travel through our server" },
    {
      t: "p",
      text: "Sometimes XMTP delivery fails, for example when the other person has not yet set up secure messaging on any device. Rather than lose the message, the app can send it through our own server instead. **A message sent this way is stored on our server in a form we can read.**",
    },
    {
      t: "p",
      text: "These messages are marked in the conversation with a label that reads **Not end to end encrypted**. Messages without the label went through XMTP.",
    },
    {
      t: "hint",
      tone: "warning",
      title: "We are closing this gap",
      text: "Our server now refuses to log the content of these messages and can be set to reject unencrypted messages entirely. That setting stays off until every client can encrypt fallback messages, so that nobody's messages are silently dropped. Progress is tracked on the [audits page](/docs/audits).",
    },
    { t: "h2", text: "Where your history is kept" },
    {
      t: "p",
      text: "Your conversation history is stored in your browser on each device. If you clear your browser data, or use a private window, the history on that device is removed. It can be downloaded again from XMTP only for as long as the network keeps it and only on a device that holds valid keys.",
    },
    { t: "h3", text: "One signature to sign in" },
    {
      t: "p",
      text: "The local history is encrypted with its own key. Since 17 November 2026 that key is kept on your device, wrapped by a browser key that no script can read or export, so signing in takes one signature instead of two or three on every visit. A device that used the old method asks for that signature one last time. Where the browser cannot keep the key (a private window, some older browsers), Ledger Chat asks for the signature on each visit, as before.",
    },
    {
      t: "hint",
      tone: "info",
      title: "The trade off",
      text: "Like a desktop messenger, the local copy is now protected by your browser profile. Someone who can use your unlocked browser profile on this device can read it. A copy of the profile's files alone cannot, because the key never leaves the browser.",
    },
    { t: "h2", text: "Attachments" },
    {
      t: "p",
      text: "Images, files and voice notes are uploaded to our storage provider, and the conversation carries a link to them. **The file itself is not encrypted yet**, and anyone who obtains the link can open it. Until attachments are encrypted on your device before upload, avoid sending files you would not want a stranger to see.",
    },
    { t: "h2", text: "What else our server knows" },
    {
      t: "table",
      head: ["Information", "Who can see it"],
      strongFirst: true,
      rows: [
        ["Message content sent through XMTP", "Only the people in the conversation."],
        ["Message content sent through the fallback", "The people in the conversation and our server."],
        ["Your contacts and contact requests", "Our server, so that they follow you to new devices."],
        ["Whether you are online", "Our server, for a short time, so others can see that you are available."],
        ["Who you talk to and when, for XMTP messages", "XMTP nodes can see that encrypted data was sent to a conversation and when. They cannot read it."],
      ],
    },
    { t: "h2", text: "Features" },
    {
      t: "ul",
      items: [
        "Replies, reactions, voice notes, images, polls and GIFs.",
        "Emoji, stickers and GIFs in one panel. Switch between them with the tabs or by swiping with a finger or a trackpad.",
        "Voice notes play on Safari. When the browser cannot play one directly, Ledger Chat decodes it itself; if that also fails, it says so and offers the file.",
        "Read receipts, which you can turn off in settings.",
        "Clear chat empties a conversation on this device. The chat list shows nothing from before the clear.",
        "Saved messages for anything you want to keep.",
        "Message search across the history stored on your device.",
      ],
    },
  ],
};

export const routing: DocPage = {
  slug: "p2p-routing",
  href: "/docs/p2p-routing",
  label: "How messages travel",
  summary: "The path a message takes from your device to someone else's, and what each part of the path can see.",
  keywords: ["routing", "relay", "delivery", "offline", "fallback", "network", "path", "server", "metadata", "p2p"],
  updated: "2026-11-17",
  blocks: [
    {
      t: "p",
      text: "A message can reach the other person by one of two paths. The normal path goes through the XMTP network. The fallback path goes through Humanity Ledger's own server and is only used when the normal path fails.",
    },
    { t: "figure", kind: "message-path", caption: "The normal path keeps the message encrypted from your device to theirs. The fallback path does not." },
    { t: "h2", text: "The normal path" },
    {
      t: "steps",
      items: [
        { title: "Your device encrypts the message", text: "Using the MLS keys for the conversation. Nothing readable leaves your browser." },
        { title: "XMTP nodes store and forward it", text: "Your browser sends the encrypted message to the XMTP network directly. Our server is not involved." },
        { title: "Their device decrypts it", text: "When the recipient opens Ledger Chat, their device downloads the message and decrypts it with its own keys." },
      ],
    },
    { t: "h2", text: "The fallback path" },
    {
      t: "p",
      text: "If the normal path fails, the app sends the message to our server, which keeps it until the recipient's device collects it. While it waits, a copy is held in our cache for up to seven days and another in our database. These copies are readable by us.",
    },
    {
      t: "p",
      text: "A message that took the fallback path is labelled **Not end to end encrypted** in the conversation, on both sides. See [Messaging](/docs/ledger-chat) for what we are doing to remove this path.",
    },
    { t: "h2", text: "What an observer on your network sees" },
    {
      t: "p",
      text: "All traffic between your browser, our server and XMTP is encrypted with TLS. Someone watching your network, such as a public WiFi operator, can see that you are connecting to Ledger Chat and to XMTP, and roughly how much data you send. They cannot see the content or who you are writing to.",
    },
  ],
};

export const communities: DocPage = {
  slug: "communities",
  href: "/docs/communities",
  label: "Communities",
  summary: "Groups with channels, roles and invite links, and how their privacy differs from direct messages.",
  keywords: ["community", "group", "channel", "server", "roles", "admin", "moderator", "invite", "posts", "members", "paid channel"],
  updated: "2026-11-17",
  blocks: [
    {
      t: "p",
      text: "A community is a group with its own channels, members and rules. Use it for a project, a club, a customer base or anything else where more than a handful of people need to talk.",
    },
    { t: "h2", text: "What you can do" },
    {
      t: "ul",
      items: [
        "Create channels for different topics, including announcement channels where only some members can post.",
        "Give members a role: owner, administrator, moderator or member. Each role has its own permissions.",
        "Invite people with links that you can revoke at any time. Invite links are signed by our server, so they cannot be forged.",
        "Post updates, run polls and share voice notes. Group calls are not available.",
        "Report a post to the moderators.",
      ],
    },
    { t: "h2", text: "Privacy in communities" },
    {
      t: "hint",
      tone: "warning",
      title: "Community posts are not encrypted end to end yet",
      text: "Posts and channel messages in communities are stored on our server and can be read by us. Do not share anything in a community that you would not want a server operator to see. Use a direct message instead.",
    },
    {
      t: "p",
      text: "Our server also stores the list of members, their roles and the channels they belong to. This is what lets a community work the same way on every device.",
    },
    {
      t: "p",
      text: "When community posts become encrypted end to end, this page will say so and the change will be listed in the [changelog](/changelog).",
    },
  ],
};

export const calls: DocPage = {
  slug: "calls",
  href: "/docs/calls",
  label: "Voice and video calls",
  summary: "How calls connect, how they are encrypted, and what they reveal about your network.",
  keywords: ["call", "voice", "video", "webrtc", "ip address", "turn", "stun", "relay", "group call", "microphone", "camera", "picture in picture", "pip"],
  updated: "2026-11-17",
  blocks: [
    {
      t: "p",
      text: "Calls in Ledger Chat connect your browser directly to the other person's browser using WebRTC, the technology built into every modern browser for real time audio and video.",
    },
    { t: "h2", text: "Encryption" },
    {
      t: "p",
      text: "WebRTC always encrypts audio and video with **DTLS-SRTP**. The keys are negotiated between the two browsers, so a server that helps set up the call or relays its traffic cannot decode it.",
    },
    { t: "h2", text: "How a call connects" },
    {
      t: "steps",
      items: [
        { title: "Ringing", text: "The ring, the answer, a decline and a hang up travel as encrypted XMTP messages, so a call reaches the other person wherever they are in the app, without the conversation open." },
        { title: "Signalling", text: "The two browsers exchange connection details through a PeerJS signalling server. It sees an identifier for each side and when the call is set up, not the audio or video." },
        { title: "Finding a route", text: "Each browser asks a STUN server, operated by Google, for its public network address so the two can try to connect directly." },
        { title: "Direct or relayed", text: "If a direct connection is not possible, for example on a mobile network or behind a strict company network, the call needs a relay (a TURN server). Ledger Chat uses its own relay service when it is switched on; the public relay it used before no longer works and was removed. The relay passes encrypted packets and cannot decode them. Until the relay is switched on, calls between two networks that both block direct connections may not connect." },
      ],
    },
    { t: "h2", text: "During a call" },
    {
      t: "ul",
      items: [
        "Answering takes one tap and opens the caller's conversation. A ring never changes the conversation you have open.",
        "On a computer the call is a card; on a phone it fills the screen.",
        "Hanging up or declining ends the call on both sides in every state, also while it is still connecting or reconnecting.",
        "Screen sharing is offered where the browser can capture a screen. Phone browsers that cannot say so and point to a computer.",
        "Picture in picture keeps both faces: the other person fills the floating window and your own camera is a small mirrored inset in its corner. On Chrome and Edge on a computer the floating window also has Mute, Camera and End. On Safari and Chrome on Android the two videos are combined into one before they leave the page. Where a browser offers neither, the button is not shown. Audio stays with the call and never moves into the floating window.",
        "Call settings let you choose the audio output where the browser allows it.",
      ],
    },
    { t: "h2", text: "Your IP address" },
    {
      t: "p",
      text: "In a direct call the other person's browser learns your IP address, which can reveal your approximate location. To avoid this, turn on **Hide my IP address in calls** in settings. Every call is then relayed, which hides your address from the other side at the cost of slightly higher latency.",
    },
    { t: "h2", text: "Group calls" },
    {
      t: "p",
      text: "Calls are one to one. Group calls are not available: the server routes for them answer 410.",
    },
    {
      t: "hint",
      tone: "info",
      text: "Your browser asks for permission before Ledger Chat can use your microphone or camera. You can withdraw it at any time from the address bar.",
    },
  ],
};

export const payments: DocPage = {
  slug: "payments",
  href: "/docs/payments",
  label: "Payments in chat",
  summary: "Send tokens to the person you are talking to, from your own wallet, without leaving the conversation.",
  keywords: ["pay", "payment", "send money", "transfer", "usdc", "usdt", "eth", "tokens", "wallet", "fees", "receipt", "qr"],
  updated: "2026-11-17",
  blocks: [
    {
      t: "p",
      text: "You can send ETH, USDC or USDT to the person you are chatting with. The payment is a normal transaction from your own wallet: Ledger Chat prepares it, your wallet shows it to you, and nothing happens until you approve it there.",
    },
    { t: "h2", text: "Sending a payment" },
    {
      t: "steps",
      items: [
        { title: "Open the conversation", text: "Tap the payment button next to the message box and choose the token and amount." },
        { title: "Check it in your wallet", text: "Your wallet shows the recipient, the amount, the network and the network fee. Make sure they match what you intended." },
        { title: "Approve", text: "Your wallet signs and broadcasts the transaction. When it is confirmed, a receipt appears in the conversation for both of you." },
      ],
    },
    { t: "h2", text: "Things to know" },
    {
      t: "ul",
      items: [
        "We never hold your funds and cannot reverse a payment. Check the recipient before you approve.",
        "We do not add a fee. You pay the network fee, which your wallet shows before you approve.",
        "Payments on Ethereum and its layer 2 networks are public. Anyone can see the sender, the recipient and the amount on a block explorer.",
        "You can also show a payment request as a QR code that any Ethereum wallet can scan.",
      ],
    },
    { t: "h2", text: "Private payments" },
    {
      t: "p",
      text: "The private wallet sends payments on Aztec that hide the amount, the sender and the recipient. It runs on Aztec Alpha with a cap per payment and has no external audit. See [Private payments on Aztec](/docs/zero-knowledge) for how it works.",
    },
    {
      t: "table",
      head: ["Section", "What it shows"],
      strongFirst: true,
      rows: [
        ["Overview", "Your private and public balances, Send, Receive, Shield and Unshield, Fee Juice, and Ethereum."],
        ["Activity", "Every payment with its real stage, from making the proof on your device to settled in a block."],
        ["Security", "What protects the account right now and what does not yet: keys made on your device, the ways to open it, address checks bound to the network, whether new payments are allowed, the public fee payer and the audit status. Passkeys are managed here."],
        ["Protocol", "The contracts and network the wallet uses."],
      ],
    },
    { t: "h3", text: "Passkeys" },
    {
      t: "p",
      text: "You can open the private wallet with Face ID, Touch ID, Windows Hello or a security key instead of your Ethereum wallet. The passkey unlocks the same account: same address, same balance. Ledger Chat keeps only an encrypted copy of the account key that the passkey alone can open.",
    },
    {
      t: "hint",
      tone: "warning",
      title: "A passkey can spend",
      text: "Whoever holds an enrolled passkey can open the wallet and spend, exactly like whoever holds your Ethereum wallet. Add passkeys only on devices you control, and remove any you no longer control. If you lose both your Ethereum wallet and every passkey, nobody can open the account, Ledger Chat included.",
    },
    { t: "h3", text: "Checking who you pay" },
    {
      t: "p",
      text: "Before a private payment, Ledger Chat checks that the Aztec address belongs to the person in the conversation, with a proof signed by their account. Since 17 November 2026 that proof names the network, so a test network address can never receive a payment of real value.",
    },
    { t: "h3", text: "Receiving from Ethereum" },
    {
      t: "p",
      text: "Receiver addresses are written and tested but not live. They are ordinary Ethereum addresses you give to a payer; what arrives there becomes part of your private balance, and nothing on Ethereum names your Aztec account. The wallet shows their status and moves no money through them until the contracts are audited and deployed.",
    },
  ],
};

export const devices: DocPage = {
  slug: "devices",
  href: "/docs/devices",
  label: "Linked devices",
  summary: "Use Ledger Chat on more than one device, and what to expect from the desktop and mobile apps.",
  keywords: ["device", "link", "qr", "second device", "phone", "desktop", "windows", "mac", "linux", "ios", "android", "app", "download", "install"],
  updated: "2026-11-17",
  blocks: [
    {
      t: "p",
      text: "You can use Ledger Chat on your phone and your computer at the same time. Each device has its own encryption keys, and you can link a new one by scanning a code.",
    },
    { t: "h2", text: "Linking a device" },
    {
      t: "steps",
      items: [
        { title: "On the computer", text: "Open the [sign in page](/connect) and choose **Use your phone**. A code appears on the screen." },
        { title: "On your phone", text: "Make sure you are signed in to Ledger Chat, open the sign in page and tap **Link another device**." },
        { title: "Scan and compare", text: "Point the camera at the code. Check that the number on your phone matches the one on the computer, then confirm. The code expires after four minutes and can be used only once." },
      ],
    },
    {
      t: "p",
      text: "Messages sent before a device was linked may not appear on it, because each device can only decrypt messages sent after its keys existed.",
    },
    { t: "h2", text: "Apps" },
    {
      t: "table",
      head: ["Platform", "Status"],
      strongFirst: true,
      rows: [
        ["Web", "Available in any modern browser. This is the supported client."],
        ["Windows", "Preview build. It is not yet code signed, so Windows shows a warning when you open it."],
        ["macOS and Linux", "Not available yet. Use the web app."],
        ["iPhone and Android", "In development. Not yet in the App Store or Google Play."],
      ],
    },
    {
      t: "hint",
      tone: "warning",
      text: "Only download Ledger Chat from this website or from our [GitHub releases](https://github.com/humanityledger/Humanity-Ledger/releases). We do not distribute it anywhere else.",
    },
  ],
};
