import { AztecDocPage } from '@/components/landing/AztecDocPage';

export default function WhitepaperPage() {
  return (
    <AztecDocPage
      eyebrow="Cryptography — Technical Whitepaper"
      title="The Humanity Ledger Platform Paper"
      subtitle="A technical description of the Humanity Ledger platform architecture, security model, privacy guarantees, and design decisions. Published October 2026."
      sections={[
        {
          id: 'abstract',
          title: '1. Abstract',
          paragraphs: [
            'Humanity Ledger is a privacy-first messaging platform that uses Ethereum wallet addresses as user identities. The platform provides end-to-end encrypted direct messages, group community spaces, real-time voice and video calls, and native crypto payments, without requiring users to register a phone number, email address, or any personally identifying information.',
            'This document describes the technical architecture of the platform, the cryptographic protocols used to protect user communications, the design decisions behind the payment system, and the operational security model.',
          ],
        },
        {
          id: 'identity',
          title: '2. Wallet-Based Identity',
          paragraphs: [
            'Identity in Ledger Chat is established through Ethereum wallet ownership. The Sign-In With Ethereum standard (EIP-4361) is used to authenticate users. The user signs a time-stamped challenge message with their wallet private key. The server verifies the signature against the claimed address. No password is stored.',
            'This model provides strong authentication without a centralized identity database. The user is pseudonymous by default. The platform knows only their wallet address. Whether that address is linked to real-world identity depends entirely on how the user has used that address elsewhere.',
          ],
          bullets: [
            'Standard: EIP-4361 (Sign-In With Ethereum).',
            'Verification: ECDSA signature verification on the server.',
            'Session management: HttpOnly server-side session cookie with 30-day expiry.',
            'Google OAuth alternative: For users who prefer not to use a wallet, we derive a deterministic Ethereum-style address from the Google identity token.',
          ],
        },
        {
          id: 'encryption',
          title: '3. End to End Encryption',
          paragraphs: [
            'Message encryption in Ledger Chat is provided by the XMTP v3 protocol. XMTP implements the Double Ratchet Algorithm over an X3DH key agreement. This is the same cryptographic foundation used by Signal, the gold standard for encrypted messaging.',
            'The key agreement process uses the user wallet as the root of trust. On first use, XMTP generates a set of identity keys and signed prekeys from the wallet signature. These are registered with the XMTP network. When two users initiate a conversation, their clients exchange prekeys and derive a shared session secret using X3DH. The Double Ratchet then ensures that each message uses a fresh key, providing forward secrecy.',
          ],
          bullets: [
            'Key agreement: X3DH (Extended Triple Diffie-Hellman).',
            'Session encryption: Double Ratchet Algorithm.',
            'Root of trust: Ethereum wallet signature.',
            'Forward secrecy: Compromise of one message key cannot expose past or future messages.',
            'Group encryption: XMTP v3 MLS (Messaging Layer Security) for multi-party groups.',
            'Server visibility: Humanity Ledger infrastructure routes encrypted packets and cannot read message content.',
          ],
        },
        {
          id: 'payments',
          title: '4. Native Crypto Payment Architecture',
          paragraphs: [
            'The payment system is designed around a fundamental principle: Humanity Ledger should never be in the financial flow. When a user sends crypto to another user, the transaction is constructed in the user browser, signed in the user wallet, and broadcast directly to the Ethereum network. The platform observes the result and relays a receipt to the chat, but does not participate in or route the transaction.',
            'Payment transactions are standard Ethereum operations. ETH transfers use the native Ethereum send mechanism. ERC-20 transfers call the standard transfer function on the token contract. No custom smart contracts, no platform escrow, no fee taken.',
            'The payment receipt injected into the chat is a JSON payload transmitted over XMTP. It contains the transaction hash, the amount, the token symbol, and the recipient address. Both parties store this locally. The receipt is a record, not a financial instrument.',
          ],
          bullets: [
            'Library: Wagmi v2 with Viem for transaction construction.',
            'ETH: useSendTransaction hook, direct to recipient address.',
            'ERC-20: useWriteContract hook calling the transfer function on the token contract.',
            'Confirmation: useWaitForTransactionReceipt hook to surface confirmation status.',
            'Receipt format: __PAYMENT__::{amount, token, txHash, to} transmitted via XMTP.',
            'Offline mode: EIP-681 compliant QR code generated locally for hardware wallet or offline signing.',
          ],
        },
        {
          id: 'communities',
          title: '5. Community Architecture',
          paragraphs: [
            'Communities are structured group spaces managed through a centralized backend. The community metadata, including names, descriptions, channel lists, member rosters, and permissions, is stored in a PostgreSQL database. This is a deliberate design choice that allows for fast queries, strong consistency, and administrative control by community managers.',
            'Community chat channels use the XMTP v3 MLS group protocol for end-to-end encrypted group messaging. The Humanity Ledger backend manages group membership state and ensures consistency between the database-level membership and the XMTP group membership.',
            'The decision to use a centralized backend for community metadata rather than storing everything on a blockchain is driven by usability and cost. Blockchain writes are slow, expensive, and irreversible. Community management actions like adding a member, renaming a channel, or adjusting permissions happen instantly and for free on our centralized backend.',
          ],
        },
        {
          id: 'data-model',
          title: '6. What Data We Store',
          paragraphs: [
            'Transparency about what data is stored and where is a core commitment of this platform.',
          ],
          bullets: [
            'Wallet address: Stored as the primary user identifier.',
            'Community metadata: Community name, description, privacy setting, channel list, member list, roles.',
            'Message timestamps and sender addresses: Stored for ordering and display purposes. Message content is not stored on our servers.',
            'Session data: Encrypted session cookie valid for 30 days.',
            'Payment data: Not stored. Payment receipts are transmitted via XMTP and stored on user devices only.',
            'Profile data: Optional display name and avatar set by the user.',
          ],
          callout: {
            title: 'Message Content',
            body: 'We do not store message content on our servers. Messages are end-to-end encrypted and stored in the IndexedDB database on each user device. If you clear your browser data or uninstall the app, your message history is gone.',
          },
        },
      ]}
    />
  );
}
