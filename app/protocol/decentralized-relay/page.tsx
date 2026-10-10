import { AztecDocPage } from '@/components/landing/AztecDocPage';

export default function MessageRelayPage() {
  return (
    <AztecDocPage
      eyebrow="Protocol — Message Relay"
      title="How Messages Travel"
      subtitle="Every message you send in Ledger Chat is encrypted on your device before it leaves. Our infrastructure moves the encrypted data from one person to another without ever being able to read it."
      sections={[
        {
          id: 'xmtp',
          title: 'The XMTP Standard',
          paragraphs: [
            'Ledger Chat is built on XMTP, an open messaging protocol designed specifically for Ethereum wallets. When two people connect on Ledger Chat, their clients perform a cryptographic handshake using their wallet keys to establish a shared secret. All messages are then encrypted with that secret before transmission.',
            'This means that even Humanity Ledger cannot read your messages. Our servers see only an encrypted binary blob. We forward it to the recipient and delete it once delivered.',
            'XMTP is an open standard. This means that in the future, other apps built on XMTP will be able to send and receive messages with Ledger Chat users, in the same way that any email client can receive email from any other.',
          ],
        },
        {
          id: 'flow',
          title: 'What Happens When You Send a Message',
          paragraphs: [
            'Every message goes through the following steps, entirely within your device, before it reaches our network.',
          ],
          bullets: [
            'Step 1 — You type and send: The message text exists only in your browser or app at this point.',
            'Step 2 — Client-side encryption: Your device encrypts the message using the shared key established with the recipient during the initial handshake. The plaintext is gone.',
            'Step 3 — Transmission: The encrypted packet is sent to the XMTP relay network, which Humanity Ledger operates. We forward it to the recipient.',
            'Step 4 — Recipient decryption: The recipient device receives the encrypted packet and decrypts it locally using their private key. The message appears in their chat.',
            'Step 5 — Local storage: The decrypted message is stored in the IndexedDB database on each user device, not on our servers.',
          ],
        },
        {
          id: 'offline',
          title: 'Messages Sent When the Recipient is Offline',
          paragraphs: [
            'If the recipient is not online when you send a message, the encrypted packet is stored temporarily on the XMTP store nodes. When the recipient comes online, their client fetches and decrypts the queued messages.',
            'Message retention on store nodes is limited. This is intentional. Ledger Chat is not meant to be a permanent archive of your communications. The authoritative copy lives on your device.',
          ],
        },
        {
          id: 'groups',
          title: 'Group and Community Messaging',
          paragraphs: [
            'Communities and group chats use the same encryption model extended to multiple recipients. Each message is encrypted so that every member of the group can decrypt it using their own keys, without requiring a single shared group password that could be exposed.',
            'The community backend handles membership lists, roles, channels, and permissions. These administrative records are stored in our database. The message content itself remains encrypted and unreadable to us.',
          ],
        },
        {
          id: 'webrtc',
          title: 'Voice and Video Calls',
          paragraphs: [
            'Voice and video calls use WebRTC, a direct peer to peer connection standard built into every modern browser. When you start a call, our infrastructure handles the initial signaling to help your two devices find each other. Once the connection is established, the audio and video stream goes directly between your device and the other person.',
            'We do not route, store, or process your call media. The call is direct. The only role our servers play is the initial connection setup, which takes a fraction of a second.',
          ],
        },
      ]}
    />
  );
}
