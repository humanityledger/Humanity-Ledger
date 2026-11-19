import type { DocPage } from "../types";

/**
 * The changelog is written from the repository history, in plain language.
 * Each entry describes the effect on someone using the product, not the
 * internal change. Superlatives from commit messages are left out.
 */

export type ChangeKind = "new" | "improved" | "fixed" | "security";

export interface ChangeEntry {
  kind: ChangeKind;
  text: string;
}

export interface Release {
  id: string;
  title: string;
  date?: string;
  note?: string;
  changes: ChangeEntry[];
}

export const RELEASES: Release[] = [
  {
    id: "unreleased",
    title: "Not yet released",
    note: "In the repository, waiting for the next deployment.",
    changes: [
      { kind: "security", text: "HLC is a test token with no monetary value, used only to test private payments in the closed alpha. It is never sold or offered, and the wallet says so next to every HLC balance. Real payments are planned in cUSDC, issued by human.tech, and stay off until a legal review and other conditions are met." },
      { kind: "security", text: "The closed alpha admits a tester only after they accept the signed terms in three separate boxes, and after the operator's sanctions and age checks. Only the results of the checks are kept, and they are deleted 6 months after the alpha ends." },
      { kind: "improved", text: "Aztec Network is named in text, with a link, until Aztec's brand rules for this use are in writing." },
      { kind: "fixed", text: "Landing: scrolling with the mouse or the finger no longer shows half-scrolled or empty frames. Each scene now fades in over the one before it, and on phones the words and the picture each have their own part of the screen." },
      { kind: "improved", text: "Landing: one design for the whole page, with a number and a label on every part, a sources line under each, a menu on phones, and the current section marked in the bar." },
      { kind: "fixed", text: "Appearance: Theme, Wallpaper and Bubbles each have their own space in the bar, with the number of options beside each name. The same fix keeps every tab bar in the app laid out as designed." },
      { kind: "improved", text: "Stickers: one pack, Spike the cactus. Stickers sent from earlier packs still show in your chats." },
      { kind: "improved", text: "Ledger Chat on a computer is wider, and the space around it follows the window, so zooming in or out keeps it whole." },
      { kind: "fixed", text: "Communities: the owner can always change every setting, and admins can reset the invite link so an old link stops working." },
      { kind: "fixed", text: "Your profile photo no longer appears on your contacts. Each contact shows their own photo, or their initials." },
      { kind: "fixed", text: "Settings on phones: tapping Account, Messages, Privacy and security or any other section opens it full screen in Safari and Chrome." },
      { kind: "improved", text: "Change your @username from Profile with one tap: the Change button sits next to it." },
      { kind: "fixed", text: "The Emojis, Stickers and GIF tabs each take a third of the bar and the switch follows the one you pick. Emojis your device cannot draw are no longer shown as empty boxes." },
      { kind: "new", text: "A live map on the home page: a lit globe with the real number of accounts, @usernames reserved and visitors, refreshed every 15 seconds. Visitors are counted once a day per browser and placed by time zone; no IP address is stored. Counting started on 18 November 2026." },
      { kind: "fixed", text: "Creating a group no longer shows \"synced 1 messages, 0 failed…\" as an error. That text means the network confirmed the group late; the group exists and opens." },
      { kind: "improved", text: "A cleaner start screen: only New chat and New group." },
      { kind: "improved", text: "Lighter on the network for every open window: the online status check, the contact list backup, the search for new conversations and the typing signal now do work only when something changed, so the app stays fast as more people use it." },
      { kind: "fixed", text: "Messages reach the other person again. Since the morning of 18 November, one stuck send could hold every later message, typing signal and read receipt of that conversation until the page was reloaded. A stuck send now waits at most 15 seconds before the next one goes out, and nothing is sent twice." },
      { kind: "new", text: "Usernames. Choose a @username in Settings → Profile. Each one is unique in the world: a name someone else holds cannot be saved, in any capitalisation, and the app offers free endings like name.01. Only letters a to z, numbers and \"_\" are allowed, so no look-alike letters can imitate another person's name." },
      { kind: "new", text: "Your QR code and link. Settings → QR code or link shows a code on a card you can recolour and save as an image, and a link you can copy. They open a chat with you without showing your wallet address, and Reset makes every old code and link stop working." },
      { kind: "improved", text: "A new QR code design: round dots, rounded corner eyes and the Humanity Ledger globe in the centre. It uses the strongest error correction (up to 30 % of the code can be covered and it still scans) and is the same in the app, in the saved image, on the sign-in screen and in the wallet's receive codes." },
      { kind: "fixed", text: "Usernames could not be saved and the QR code screen stayed empty: the update that adds usernames had not finished setting up the database. Deploys now wait for, or clear, a stuck database lock before starting, and the screen says when usernames are unavailable, with Try again, instead of showing nothing." },
      { kind: "new", text: "Find people by username. Type an exact @username, paste a Ledger Chat link or scan a code to open a chat. Usernames match exactly: nobody can list them by typing the first letters." },
      { kind: "improved", text: "Settings in two panes on computers and tablets, with your profile card at the top, as in Signal Desktop." },
      { kind: "fixed", text: "Answering a video call while another chat, the chat list or Communities was open now shows both faces straight away. The call screen used to stay hidden until the caller's chat was opened." },
      { kind: "fixed", text: "An empty conversation shows the Chit Chatting animation. Some browsers kept showing the previous one from their cache." },
      { kind: "new", text: "Passkeys for the private wallet: open it with Face ID, Touch ID, Windows Hello or a security key instead of your Ethereum wallet. A passkey opens the same account, and Ledger Chat keeps only an encrypted copy of the account key that the passkey alone can open. A passkey can spend like your wallet, and the wallet says so before you add one." },
      { kind: "new", text: "A Security section in the private wallet lists what protects your account right now (keys made on your device, the ways to open it, address checks bound to the network, whether new payments are allowed) and what does not yet (the public fee payer, no external audit). Passkeys are managed there." },
      { kind: "new", text: "Ethereum in the private wallet: receiver addresses, deposits and withdrawals through a portal to Aztec. The contracts are written and tested but deployed nowhere, so the wallet shows their status step by step and moves no money through them." },
      { kind: "security", text: "The proof that an Aztec address belongs to the person in a conversation now names the network. On Aztec Alpha a proof without a network is refused, so an address announced on the test network can never receive a payment of real value." },
      { kind: "security", text: "A passkey can only open your own account: what it unlocks must be your wallet's own signature for this network before any key is derived. Records on your device are never replaced by the backup." },
      { kind: "security", text: "The Ethereum portal turns itself off unless the release pairs Aztec Alpha with Ethereum and every token is the official contract with its real decimals. Before proving, the wallet checks that the Aztec token is linked to this portal." },
      { kind: "security", text: "Claiming a deposit and withdrawing to Ethereum stay available while new payments are paused, so a pause never traps your money. The withdraw form stays off until the wallet can also finish the payout on Ethereum itself." },
      { kind: "improved", text: "Signing in takes one signature. The key of your local message history is kept on your device under a browser key that no script can read, instead of being rebuilt from a second signature on every visit." },
      { kind: "fixed", text: "A call rings wherever you are in the app, without its conversation open, and answering opens the caller's conversation. Hanging up or declining ends the call on both sides in every state, also while connecting." },
      { kind: "improved", text: "New incoming, outgoing and voice call screens: a card on a computer, full screen on a phone, one tap to answer. Screen sharing is offered only where the browser can capture a screen." },
      { kind: "improved", text: "Emoji, stickers and GIFs share one panel that you can swipe through with a finger or a trackpad without the browser going back." },
      { kind: "fixed", text: "Voice notes play on Safari. When the browser cannot play one, Ledger Chat decodes it itself, and otherwise says so and offers the file." },
      { kind: "fixed", text: "After Clear chat, the chat list no longer shows the last message from before the clear." },
      { kind: "fixed", text: "Signing in from Safari and Chrome on a phone opens the wallet app you choose (MetaMask, Coinbase Wallet, Rainbow, Trust Wallet, OKX) with its own WalletConnect link, from your tap or from a plain Open button. Every other wallet in the WalletConnect directory stays under Other wallets." },
      { kind: "fixed", text: "Inside a wallet's own browser, one Continue button signs you in with the wallet already in the page, and the signature request is sent once. A request sent again while the first was still open in the wallet left sign in waiting forever." },
      { kind: "fixed", text: "Video calls show both cameras as soon as the video arrives. A call could stay in Connecting with the voice playing and both videos hidden." },
      { kind: "fixed", text: "A call started from the Calls tab or from a scheduled call rings the person you chose. The call offer used to go to the chat that was open before." },
      { kind: "improved", text: "Screen sharing is in every call. Phone browsers that cannot share a screen say so and point to a computer. Call settings let you choose the audio output where the browser allows it." },
      { kind: "improved", text: "Contact info (About, Media and files, Personalization, Privacy, Actions) is part of the details column beside a chat on wide screens, under the safety glyphs." },
      { kind: "security", text: "Communities: nothing is reported as created unless the database stored it; single use invites are claimed once across every server; an invite stops working when its author is no longer an admin; join attempts are limited." },
      { kind: "security", text: "Deployments stop instead of starting on a database whose migrations failed, and a failed migration is resolved only when the database proves its state." },
      { kind: "improved", text: "Ledger Chat no longer asks for a PIN when you open it or when you create an account: connect your wallet, sign, and you are in. The PIN never encrypted anything; it was a lock in front of the screen. A PIN you already set is kept on the server and ignored until the screen returns." },
      { kind: "security", text: "An exits only switch: when we turn it on, the app refuses new private payments, shielding and agreements, and still lets you claim, refund, cancel and withdraw what is already open. It stops our interface only; the Aztec contracts cannot be paused, and it is not a rollback." },
      { kind: "security", text: "Dozens of old server routes from the removed terminal, forum, market, network and wallet products that nothing called now answer 410 before any code runs." },
      { kind: "security", text: "Server routes for group calls, community invite tokens, token gates and some sign in helpers, which no screen uses, now answer 410. The sign in and chat flows are unchanged." },
      { kind: "fixed", text: "A page that tried to load a market stream from a route that no longer exists was removed." },
      { kind: "fixed", text: "The legal pages no longer say the Aztec mainnet runs an older version than the test network; both run 6.0.0 since 3 November 2026. The wallet still refuses the mainnet." },
      { kind: "new", text: "Private agreements in conversations: open an escrow or a payment stream to the person you are talking to, on the Aztec test network. The recipient verifies the invitation against the contract before accepting, and both of you can claim, refund, withdraw or cancel from the conversation." },
      { kind: "new", text: "Share your Aztec address in a conversation. Ledger Chat saves the other person's address the first time and warns if a different one appears." },
      { kind: "fixed", text: "The private wallet in the web app is built against the Aztec 6.0.0 libraries the networks run, instead of an older preview build of them." },
      { kind: "security", text: "The private wallet refuses an Aztec node on a different network or rollup version, and never offers sponsored fees where none exist." },
      { kind: "security", text: "Agreement invitations, which carry secrets, never appear as text in previews, notifications, replies or copies, and are never queued in plain storage while offline." },
      { kind: "fixed", text: "Signing in at /connect works with wallets on any network the wallet list offers (BNB Chain, Linea, Avalanche, zkSync, World Chain and others), which were refused as unsupported." },
      { kind: "fixed", text: "Signing in works on both ledgerchat.org and www.ledgerchat.org, and no longer fails when the server's cache missed the moment you asked to sign in." },
      { kind: "fixed", text: "Smart contract wallets (Safe, Coinbase Smart Wallet and similar) can sign in." },
      { kind: "improved", text: "When signing in fails, the page says why instead of always saying the signature was declined." },
      { kind: "improved", text: "The message menu adds quick reactions, private and regular payments, message details and keyboard navigation. Deleting for everyone is now described as a request, because other apps can keep a copy." },
      { kind: "improved", text: "Pinch to zoom works on every page." },
      { kind: "improved", text: "A new look for the home page, sign in, documentation and Ledger Chat: a living background that responds to your cursor, a frosted navigation bar with menus, editorial headings and a fuller footer with our X, GitHub and LinkedIn." },
      { kind: "security", text: "Screens that showed simulated cryptography were removed or say what is missing: the solvency check, the setup ceremony, the age proof and payment streams, which ran only in your browser and moved no money." },
      { kind: "new", text: "A legal notice, and a content and copyright page explaining how to report illegal content and how our code is licensed." },
      { kind: "improved", text: "Terms, Privacy Policy, Cookie Policy and risk disclosure rewritten to match the code: who provides the service, every cookie we set, and what the private payments wallet can and cannot do." },
      { kind: "improved", text: "Older pages that described a token, open source licensing or guarantees the product does not offer now lead to the matching documentation page." },
      { kind: "security", text: "Every route that sold, credited, airdropped or transferred Quantum Dots (QD) now refuses all requests. Humanity Ledger has no token, and the in app screen that took ETH for QD has been removed." },
      { kind: "new", text: "A redesigned home page, sign in page and documentation site, with search across every page." },
      { kind: "new", text: "Documentation rewritten to describe the product as it works today, including the findings that are still open." },
      { kind: "security", text: "Signing in now follows EIP-4361 throughout, with a nonce issued and checked by the server." },
      { kind: "security", text: "Requests that change data are refused unless they come from our own website." },
      { kind: "security", text: "Session tokens are only accepted with the expected signing algorithm." },
      { kind: "security", text: "The private balance endpoint now answers only for the account that is signed in." },
      { kind: "security", text: "The server no longer records the content of fallback messages in its logs, and can be set to refuse them." },
      { kind: "fixed", text: "Checking a PIN failed for every account after it was set. It now works." },
      { kind: "fixed", text: "Signing in no longer fails when the cache is unavailable." },
    ],
  },
  {
    id: "2026-10-21",
    title: "21 October 2026",
    date: "2026-10-21",
    changes: [
      { kind: "improved", text: "Online status is kept in the cache with an expiry instead of being written to the database, which removes a database write every time someone comes online." },
    ],
  },
  {
    id: "2026-10-19",
    title: "19 October 2026",
    date: "2026-10-19",
    changes: [
      { kind: "new", text: "Group calls inside communities." },
      { kind: "improved", text: "One light theme across the whole app. Dark mode has been removed." },
      { kind: "improved", text: "Aztec libraries upgraded to the V6 release." },
      { kind: "fixed", text: "Signing in with a six digit PIN." },
      { kind: "fixed", text: "Calls that did not end when you pressed hang up." },
      { kind: "security", text: "A set of fixes to how every route identifies the person making a request." },
    ],
  },
  {
    id: "2026-10-15",
    title: "15 October 2026",
    date: "2026-10-15",
    changes: [
      { kind: "improved", text: "Redesigned screens for private payments." },
      { kind: "improved", text: "Deposits into a private balance are sent from your own wallet." },
    ],
  },
  {
    id: "2026-10-14",
    title: "14 October 2026",
    date: "2026-10-14",
    changes: [
      { kind: "new", text: "Experimental streaming payments and invoices inside a conversation." },
      { kind: "fixed", text: "Linking a device with a QR code." },
      { kind: "fixed", text: "New community posts appear immediately for the person who wrote them." },
      { kind: "security", text: "Rich text in community posts is cleaned before it is shown, to prevent script injection." },
      { kind: "security", text: "A device link code can no longer be used twice." },
      { kind: "security", text: "Stronger checks against spending the same private note twice." },
    ],
  },
  {
    id: "2026-10-13",
    title: "13 October 2026",
    date: "2026-10-13",
    changes: [
      { kind: "new", text: "A redesigned PIN setup that explains each step." },
      { kind: "fixed", text: "Messages written while you were offline are delivered when you reconnect." },
      { kind: "fixed", text: "The PIN lockout shown in the app now matches the five minutes enforced by the server." },
      { kind: "fixed", text: "The Windows download now serves the real installer." },
    ],
  },
  {
    id: "2026-10-12",
    title: "12 October 2026",
    date: "2026-10-12",
    changes: [
      { kind: "new", text: "Community access by token, proposals, tips for creators and saved messages." },
      { kind: "security", text: "Community invite links are signed, so they cannot be forged." },
      { kind: "security", text: "Removed an administrative shortcut that should not have existed." },
      { kind: "security", text: "Stories can no longer be used to make our server fetch arbitrary addresses." },
    ],
  },
  {
    id: "2026-10-10",
    title: "10 October 2026",
    date: "2026-10-10",
    changes: [
      { kind: "new", text: "Communities rebuilt, with channels, posts, polls, voice notes and settings." },
      { kind: "new", text: "Analytics for community owners." },
      { kind: "new", text: "Notification settings, including do not disturb." },
      { kind: "improved", text: "Redesigned call screens." },
    ],
  },
  {
    id: "2026-10-09",
    title: "9 October 2026",
    date: "2026-10-09",
    changes: [
      { kind: "fixed", text: "Some XMTP messages were sent but never shown to the recipient." },
      { kind: "fixed", text: "Duplicate conversations with the same person." },
      { kind: "security", text: "Fixed database query injection in four endpoints." },
      { kind: "security", text: "Removed a file search from an animation endpoint that could expose server files." },
      { kind: "security", text: "Privacy settings can only be changed by the account they belong to." },
    ],
  },
  {
    id: "2026-10-08",
    title: "8 October 2026",
    date: "2026-10-08",
    changes: [
      { kind: "new", text: "Push notifications, message threads and syncing between your devices." },
      { kind: "security", text: "Third party API keys moved behind our own server so they are no longer sent to browsers." },
      { kind: "improved", text: "The repository was cleaned up, and its description now says beta rather than production." },
    ],
  },
];

export const changelog: DocPage = {
  slug: "changelog",
  href: "/docs/changelog",
  label: "Changelog",
  summary: "What changed in Ledger Chat, newest first, written from the repository history.",
  keywords: ["changelog", "releases", "updates", "versions", "history", "what's new", "release notes"],
  updated: "2026-11-17",
  blocks: [],
};
