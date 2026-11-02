import { AztecDocPage } from '@/components/landing/AztecDocPage';

export default function ProtocolPage() {
  return (
    <AztecDocPage
      eyebrow="Protocol — Architecture Overview"
      title="The Humanity Ledger Protocol"
      subtitle="A privacy-first communication platform built for a world where your wallet is your identity. Send messages, make crypto payments, and join communities without ever sharing personal data."
      sections={[
        {
          id: 'overview',
          title: 'What is Humanity Ledger?',
          paragraphs: [
            'Humanity Ledger is a next-generation messaging platform that uses your Ethereum wallet as your identity. There is no phone number, no email address, and no account registration. You connect your wallet, sign a message to prove ownership, and you are in. That is the entire setup process.',
            'The platform is composed of three core products: Ledger Chat, the private messaging client for one-on-one and group conversations; Communities, a structured space for DAOs, teams, and public groups to collaborate; and Native Crypto Payments, which lets users send real assets directly inside a conversation with no intermediary and no platform fee.',
            'Ledger Chat runs on centralized infrastructure managed by Humanity Ledger. This is a deliberate architectural decision. A fully decentralized model would require every user to pay a blockchain fee for every single action, including sending a message. Instead, we handle the routing and storage infrastructure at zero cost to users, while keeping the financial settlement layer entirely non-custodial.',
          ],
          callout: {
            title: 'Why Not Fully Decentralized?',
            body: 'Fully decentralizing every message would force users to pay a gas fee each time they send a text. That model does not work for a consumer product. We keep messaging free and instant by running our own infrastructure, while crypto payments settle directly on the blockchain without us ever touching the funds.',
          },
        },
        {
          id: 'architecture',
          title: 'Platform Architecture',
          paragraphs: [
            'The platform is architected to separate two concerns cleanly: communication, which must be free and fast; and financial settlement, which must be trustless and non-custodial.',
          ],
          bullets: [
            'Messaging Layer — XMTP: Messages are routed through the XMTP protocol, an open messaging standard for web3. Conversations are encrypted end to end using keys derived from the user wallet. Humanity Ledger relays the encrypted packets but cannot read them.',
            'Storage Layer — IndexedDB: Message history is stored locally on the user device, not on our servers. If a user clears their browser or uninstalls the app, the history is gone. This is intentional.',
            'Payment Layer — Wagmi and Viem: When a user sends crypto inside a chat, the transaction is constructed client-side using the Wagmi library and submitted directly to the blockchain. Humanity Ledger is never in the payment path.',
            'Identity Layer — Ethereum Wallet: Your wallet address is your username. There are no passwords, no recovery emails, and no centralized identity database.',
          ],
        },
        {
          id: 'communities',
          title: 'Communities',
          paragraphs: [
            'Communities are group spaces inside Ledger Chat. They support public and private modes, multiple channels, role-based access (admin and member), and real-time chat powered by the same encrypted messaging engine used for direct conversations.',
            'Creating a community takes about thirty seconds. You give it a name, a description, and choose whether it is public or invite-only. Public communities appear in the discovery directory at humanidfi.com/communities, where anyone can find them and join without needing a direct link.',
            'Communities are designed for teams, DAOs, crypto projects, and any group that wants a private, ad-free space to coordinate. There are no analytics trackers, no advertiser profiles, and no data sold to third parties.',
          ],
        },
        {
          id: 'payments',
          title: 'Native Crypto Payments',
          paragraphs: [
            'Any user can send ETH, USDC, or other supported tokens directly inside a conversation. The payment modal appears when you tap the wallet icon, allows you to select the asset and amount, and submits the transaction through your connected wallet.',
            'Once confirmed, a payment receipt appears inside the chat thread. Both parties can see the amount, the asset, and a link to verify the transaction on a block explorer. The receipt is permanent and cannot be altered.',
            'Humanity Ledger does not charge a platform fee on crypto payments. The only cost is the standard network gas fee paid to the blockchain. We are not involved in the transaction in any way.',
          ],
          callout: {
            title: 'No Custodial Risk',
            body: 'We never hold, proxy, or touch your funds. Payments go from your wallet to the recipient wallet directly on the blockchain. There is no Humanity Ledger account balance, no withdrawal process, and no counterparty risk from using our platform.',
          },
        },
        {
          id: 'roadmap',
          title: 'What is Coming',
          paragraphs: [
            'The platform is in active development with a public launch target of January 1, 2027.',
          ],
          bullets: [
            'Q4 2026 — Beta: Desktop apps for Windows and macOS published. Communities with full channel management. Native crypto payments for ETH and USDC live.',
            'Q1 2027 — Launch: Public launch with full wallet support including MetaMask, Coinbase Wallet, Rainbow, and WalletConnect. iOS and Android native apps released.',
            'Q2 2027 — Expansion: Token gated communities allowing groups to restrict membership to holders of specific NFTs or tokens. Group crypto payments and payment requests.',
            'Q3 2027 — Developer API: A public REST API for third-party applications to build on top of the Ledger Chat messaging and identity layer.',
          ],
        },
      ]}
    />
  );
}
