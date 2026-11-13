import type { DocPage, GalleryItem } from "../types";

/**
 * The plain-language guide to Ledger Chat, for anyone, with the iPhone
 * mockups from the landing page and the desktop screens from the brand kit.
 * Every sentence describes what the app does today.
 */

const phone = (name: string, alt: string, caption: string): GalleryItem => ({
  src: `/brand/ledger-chat/iphone/ledger-chat-iphone-${name}.webp`,
  download: `/brand/ledger-chat/iphone/ledger-chat-iphone-${name}.png`,
  width: 828,
  height: 1038,
  alt,
  caption,
});

const desktop = (name: string, alt: string, caption: string): GalleryItem => ({
  src: `/landing/desktop/${name}-2880.webp`,
  download: `/brand/ledger-chat/ledger-chat-${name}.png`,
  width: 2880,
  height: 1800,
  alt,
  caption,
});

export const guide: DocPage = {
  slug: "guide",
  href: "/docs/guide",
  label: "How Ledger Chat works",
  title: "How Ledger Chat works",
  summary: "A plain guide to everything you can do in Ledger Chat: messages, voice notes, calls, scheduled calls and messages, payments, communities and settings.",
  keywords: [
    "guide",
    "how to",
    "help",
    "tutorial",
    "voice note",
    "voice message",
    "video call",
    "schedule",
    "meeting",
    "calendar",
    "settings",
    "iphone",
    "beginner",
  ],
  updated: "2026-11-12",
  blocks: [
    {
      t: "p",
      text: "Ledger Chat is a messenger where your wallet is your account. There is no phone number, no email and no password. Messages, calls and payments happen in the same conversation, and what you write is encrypted on your device before it leaves.",
    },
    {
      t: "gallery",
      columns: 2,
      items: [
        phone("messages", "Ledger Chat on iPhone: a conversation with encrypted messages", "A conversation on iPhone."),
        phone("payments", "Ledger Chat on iPhone: a private invoice paid inside the chat", "Paying a private invoice inside the chat."),
      ],
    },

    { t: "h2", text: "Getting started", id: "start" },
    {
      t: "steps",
      items: [
        { title: "Open Ledger Chat", text: "Go to [ledgerchat.org/chat](/chat) in Safari, Chrome, Edge or Firefox, on your phone or your computer. There is nothing to install." },
        { title: "Connect a wallet", text: "Choose the wallet you already use. Ledger Chat asks it to sign a short message to prove the address is yours. Signing is free and is not a transaction." },
        { title: "Allow secure messaging", text: "The first time, your browser creates the encryption keys for your messages. They stay on this device." },
        { title: "Choose a name", text: "Pick the name people will see. You can add a photo and a short bio later in Settings." },
      ],
    },
    {
      t: "hint",
      tone: "info",
      text: "On a computer you can link Ledger Chat to your phone instead of connecting a wallet there: open **Scan a code** on your phone and point it at the code on the computer. See [Devices](/docs/devices).",
    },

    { t: "h2", text: "Chats and messages", id: "chats" },
    {
      t: "ul",
      items: [
        "**Start a chat** with **New chat**: type a name, an @username or a wallet address. You can also scan someone's code in person.",
        "**Write** in the field at the bottom and press send. On a computer, Enter sends and Shift and Enter starts a new line; you can change this in Settings.",
        "**Reply** to a message by swiping it to the left on a phone, or from its menu (right click or long press). **React** with a double tap for a heart, or choose another reaction from the menu.",
        "**Edit or delete** your own messages from their menu: **Delete for me** hides it on your devices, **Delete for everyone** removes it for both of you.",
        "**Pin** an important message to the top of the chat, and **save** messages to find them later in **Saved messages**.",
        "**Search** a conversation from the menu in its header, or press Ctrl and K (Cmd and K on a Mac).",
        "**Photos, videos and files** go through the **+** button. They are encrypted on your device first; files can be up to 20 MB.",
      ],
    },
    { t: "h3", text: "Voice messages" },
    {
      t: "steps",
      items: [
        { title: "Record", text: "With the message field empty, tap the microphone. The first time, your browser asks for permission to use it." },
        { title: "Send or cancel", text: "Tap the arrow to send, or **Cancel** to throw it away. If you open another chat while recording, the recording is discarded, so it never reaches the wrong person." },
        { title: "Listen", text: "Tap play on a voice message to hear it. It plays on every browser, including Safari on older iPhones." },
      ],
    },
    { t: "h3", text: "Receiving messages" },
    {
      t: "ul",
      items: [
        "New messages appear straight away while Ledger Chat is open, and the chat list shows how many you have not read.",
        "Turn on notifications in **Settings, Notifications** to be told when Ledger Chat is in the background. You can hide the message text in them.",
        "Read receipts and the typing indicator can be turned off in **Settings, Privacy**.",
        "If you were offline, messages wait on the network and arrive when you come back.",
      ],
    },
    { t: "h3", text: "Disappearing and secret chats" },
    {
      t: "p",
      text: "Set a timer for a chat and new messages delete themselves after it. **Secret chat** goes further while it is on: each message you send disappears 15 seconds after it is sent.",
    },

    { t: "h2", text: "Voice and video calls", id: "calls" },
    {
      t: "gallery",
      columns: 2,
      items: [
        phone("voice-call", "Ledger Chat on iPhone: an encrypted voice call", "A voice call."),
        phone("video-call", "Ledger Chat on iPhone: a video call", "A video call."),
      ],
    },
    {
      t: "ul",
      items: [
        "**Call** from the phone or camera button at the top of a chat, or from the **Calls** tab.",
        "**Answer or decline** from the screen that appears when someone calls you. Your browser asks for the microphone, and the camera for video, the first time.",
        "**During a call** you can mute, turn the camera off, switch to the speaker, share your screen on a computer, and keep using the app while the call stays in a bar at the top.",
        "Calls are encrypted end to end between the two browsers. Turn on **WebRTC IP masking** in **Settings, Security** if you do not want the other person to see your network address. See [Calls](/docs/calls) for how a call connects.",
      ],
    },

    { t: "h2", text: "Scheduling", id: "scheduling" },
    { t: "h3", text: "Schedule a call" },
    {
      t: "steps",
      items: [
        { title: "Choose the time", text: "In a chat, tap **+** and then **Schedule a call**, or type **/meet**. From the Calls tab, use **Schedule a call** and pick the person." },
        { title: "Send the invitation", text: "Give it a name, a date, a time, a length and choose voice or video. It is sent as an encrypted message in the chat." },
        { title: "Add it to your calendar", text: "Both of you see a card with the time in your own time zone and a calendar button that downloads the event, with a reminder ten minutes before." },
        { title: "Join", text: "From ten minutes before the start, the card shows **Join**. If Ledger Chat is open when the call starts, it also reminds you with a Join button. Upcoming calls are listed at the top of the Calls tab." },
      ],
    },
    { t: "h3", text: "Schedule a message" },
    {
      t: "p",
      text: "Tap **+** and **Schedule a message**, or type **/schedule**. Choose when, then write the message and send it as usual. It waits in the chat with a clock, and a line above the message field lets you cancel it.",
    },
    {
      t: "hint",
      tone: "info",
      title: "Sent from your device",
      text: "Your messages are encrypted on your device, so no server can send them for you. A scheduled message is sent by the device where you scheduled it. If Ledger Chat is closed at that time, it goes the next time you open it there.",
    },

    { t: "h2", text: "Payments", id: "payments" },
    {
      t: "gallery",
      columns: 2,
      items: [
        phone("private-wallet", "Ledger Chat on iPhone: the private wallet with balance, fees and activity", "The private wallet."),
        phone("payments", "Ledger Chat on iPhone: a private invoice in a conversation", "A private invoice, paid in the chat."),
      ],
    },
    {
      t: "ul",
      items: [
        "**Payment** sends ETH, USDC or USDT from your own wallet. Your wallet shows the transaction and nothing happens until you approve it there.",
        "**Private payment** sends from your private wallet on Aztec. The amount and the person you paid are not published. Proofs are made on your device.",
        "**Private invoice** asks someone for a private payment, and **Private agreement** sets up an escrow or a payment over time.",
        "Open the **Private wallet** from the menu of a chat to see your balance, fees and activity, receive money or add funds.",
      ],
    },
    {
      t: "hint",
      tone: "warning",
      text: "Private payments run on Aztec Alpha, and our payment contracts have not been independently audited yet. Only use amounts you are comfortable losing. See [Private payments](/docs/payments).",
    },

    { t: "h2", text: "Communities and updates", id: "communities" },
    {
      t: "gallery",
      columns: 2,
      items: [
        phone("communities", "Ledger Chat on iPhone: a community with channels and pinned posts", "A community."),
        phone("themes", "Ledger Chat on iPhone: choosing a theme for a chat", "Choosing how a chat looks."),
      ],
    },
    {
      t: "ul",
      items: [
        "**Communities** have channels, roles, announcements, polls, voice rooms and invite links you can switch off at any time. Everyone accepts the community guidelines when they join. Community posts are stored on our server; see [Communities](/docs/communities).",
        "**Updates** are short statuses that disappear after 24 hours, shown to people who saved you as a contact.",
      ],
    },

    { t: "h2", text: "Make it yours", id: "appearance" },
    {
      t: "p",
      text: "Choose a theme, a wallpaper and a bubble style for all chats in **Settings, Chat appearance**, or for one chat from its menu. **Ledger Studio**, from the sparkle button, builds a page or a small app from a description, without leaving Ledger Chat.",
    },
    {
      t: "gallery",
      columns: 2,
      items: [phone("studio", "Ledger Studio on iPhone", "Ledger Studio.")],
    },

    { t: "h2", text: "Settings", id: "settings" },
    {
      t: "table",
      head: ["Section", "What you can change"],
      strongFirst: true,
      rows: [
        ["Profile and devices", "Your name, photo and bio, your wallet address, and the computers linked to your phone."],
        ["Notifications", "Sounds, vibration, alerts, do not disturb, and whether notifications show the message text."],
        ["Chat appearance", "Theme, wallpaper, typography, text size and bubble style."],
        ["Privacy", "Who sees your last seen, read receipts, the typing indicator, blocked people, and screen protection."],
        ["Security", "Sessions, how your chats are protected, and WebRTC IP masking, which hides your IP address in calls."],
        ["Calls", "Camera, microphone, noise suppression and data saver."],
        ["Storage and data", "Media kept on this device, and clearing it."],
        ["Payments", "Payments in chats on or off, and the token you send by default."],
      ],
    },

    { t: "h2", text: "On a computer", id: "desktop" },
    {
      t: "p",
      text: "On a large screen Ledger Chat shows your chats, the conversation and its details side by side. These are the screens of the redesign we are building.",
    },
    {
      t: "gallery",
      columns: 2,
      items: [
        desktop("chats", "Ledger Chat on desktop: chat list, conversation and contact panel", "Chats."),
        desktop("calls", "Ledger Chat on desktop: call history and a video call", "Calls."),
        desktop("updates", "Ledger Chat on desktop: status updates and posts", "Updates."),
        desktop("communities", "Ledger Chat on desktop: a community with channels and members", "Communities."),
      ],
    },

    { t: "h2", text: "Your privacy, in plain words", id: "privacy" },
    {
      t: "ul",
      items: [
        "Direct messages, voice notes, photos and files are encrypted on your device. Only the people in the conversation can read them.",
        "Calls are encrypted between the two browsers.",
        "Your keys stay on your devices. We cannot read your direct messages and cannot recover them for you.",
        "Some things are on our server so the app can work: your public profile, communities and their posts, and a backup delivery path that is marked in the chat when it is used. The [security model](/docs/security-model) lists all of it.",
      ],
    },

    { t: "h2", text: "If something does not work", id: "help" },
    {
      t: "ul",
      items: [
        "Messages do not appear right after you sign in: Ledger Chat is still syncing. Give it a few seconds; the conversation shows a loader meanwhile.",
        "A call does not connect: check that the browser may use the microphone and camera, and that both of you are online. Some company networks block direct calls.",
        "Something else: tell us at [Report a vulnerability](/docs/bug-bounty) for security issues, or through [Contact](/docs/contact) for anything else.",
      ],
    },
  ],
};
