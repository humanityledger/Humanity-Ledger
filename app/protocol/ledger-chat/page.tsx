import { AztecDocPage } from '@/components/landing/AztecDocPage';

export default function LedgerChatPage() {
  return (
    <AztecDocPage
      eyebrow="Protocol, Ledger Chat"
      title="How Ledger Chat protects your messages"
      subtitle="Ledger Chat is a private messenger where your wallet is your account. This page says exactly what is protected, how, and what is not."
      sections={[
        {
          id: 'architecture',
          title: 'Accounts and transport',
          paragraphs: [
            'Your account is your Ethereum wallet. You sign in by signing a message with it, so there is no phone number and no password to leak.',
            'Direct messages travel over XMTP, a decentralized messaging network. Each device that signs in gets its own XMTP installation, which is why using another device means signing in with the same wallet there.',
          ],
        },
        {
          id: 'encryption',
          title: 'Message encryption',
          paragraphs: [
            'XMTP encrypts direct messages with MLS, Messaging Layer Security (RFC 9420), using the cipher suite MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519. MLS gives forward secrecy and post compromise security. Only the people in the conversation hold the keys.',
            'Every chat shows an encryption notice. Tap it to see the protocol and a safety number that both people can compare to confirm they are talking to the right person.',
          ],
          bullets: [
            'Message content is end to end encrypted when it goes over XMTP.',
            'If XMTP cannot deliver a message, it can go through our server instead. Those messages are not end to end encrypted and are marked in the chat.',
            'Metadata is not hidden. The network can see that an account is active and when.',
          ],
          diagram: {
            caption: 'Figure 1: How a direct message travels',
            chart: `graph TD
    A[Alice's device] -->|1. Encrypt with MLS| C[XMTP network]
    C -->|2. Deliver ciphertext| D[Bob's device]
    D -->|3. Decrypt with MLS keys| E[Bob reads the message]

    style A fill:#ffffff,stroke:#000000,stroke-width:2px
    style D fill:#ffffff,stroke:#000000,stroke-width:2px
    style C fill:#f0f0f0,stroke:#666666,stroke-dasharray: 5 5`,
          },
        },
        {
          id: 'zk-transfers',
          title: 'Private payments are a demo',
          paragraphs: [
            'Shielded payments in the chat use a demo of the Aztec zero knowledge flow. Balances are simulated on your device and no real funds move. Every payment message in the chat says so.',
            'We are building towards real private transfers on Aztec. Until that works end to end, we label it as a demo and do not describe it as live.',
          ],
        },
        {
          id: 'webrtc',
          title: 'Voice and video calls',
          paragraphs: [
            'Calls use WebRTC. Media is encrypted between the two devices with DTLS SRTP. A signaling server helps the two devices find each other, and it never sees the audio or video.',
            'With IP masking on, media goes through a relay server so the other person does not see your IP address. The media stays encrypted on that path.',
          ],
          diagram: {
            caption: 'Figure 2: How a call connects',
            chart: `sequenceDiagram
    participant A as Caller
    participant S as Signaling server
    participant B as Receiver

    A->>S: Offer (connection details only)
    S->>B: Offer
    B->>S: Answer
    S->>A: Answer
    A<-->>B: Audio and video, encrypted with DTLS SRTP
    Note over A,B: The signaling server never carries media`,
          },
        },
        {
          id: 'limits',
          title: 'What is not covered yet',
          paragraphs: [
            'Community posts are stored on our server and are not end to end encrypted. Group and voice room calls are not available yet.',
          ],
        },
      ]}
    />
  );
}
