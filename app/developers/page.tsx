import { AztecDocPage } from '@/components/landing/AztecDocPage';

export default function DevelopersPage() {
  return (
    <AztecDocPage
      eyebrow="Developers and Protocol Engineering"
      title="Developer Documentation"
      subtitle="Technical reference for integrating with the Humanity Ledger platform. Learn how to authenticate users with their wallets, send messages via the XMTP layer, and build on top of our community and identity infrastructure."
      sections={[
        {
          id: 'authentication',
          title: '1. Wallet Authentication',
          paragraphs: [
            'Ledger Chat uses Ethereum wallet signatures for authentication. There is no password database, no OAuth, and no email verification. A user proves their identity by signing a challenge message with their private key.',
            'We support two authentication paths. The first is direct wallet connection using WalletConnect-compatible wallets including MetaMask, Coinbase Wallet, Rainbow, and Rabby. The second is Google OAuth for users who prefer not to use a wallet, which creates a deterministic Ethereum address from their email identity.',
          ],
          bullets: [
            'Sign-In With Ethereum (SIWE): Standard EIP-4361 message signing. Compatible with any EVM wallet.',
            'Session cookie: After verification, a server-side session is issued. The session cookie is HttpOnly and Secure.',
            'No API keys: All API endpoints use the session cookie. There are no bearer tokens.',
            'Session duration: Sessions are valid for 30 days unless explicitly revoked.',
          ],
        },
        {
          id: 'messaging',
          title: '2. XMTP Messaging Integration',
          paragraphs: [
            'Direct messages in Ledger Chat use the XMTP v3 client library. To initialize a conversation, you need the user wallet signer and a target address.',
            'XMTP handles key exchange automatically. On first use, the client generates an identity key bundle and registers it with the XMTP network. Subsequent conversations derive session keys using X3DH and maintain forward secrecy through the Double Ratchet protocol.',
          ],
          bullets: [
            'Client library: @xmtp/xmtp-js version 12 or later.',
            'Key storage: Encrypted and stored in the browser IndexedDB.',
            'Message types: Text, media attachments, GIFs, voice notes, location, and the custom payment receipt type.',
            'Group messaging: XMTP v3 MLS groups for community channels.',
          ],
          callout: {
            title: 'XMTP Documentation',
            body: 'The full XMTP client documentation is available at xmtp.org/docs. The Ledger Chat implementation layers additional message types on top of the base XMTP protocol.',
            href: 'https://xmtp.org/docs',
            hrefLabel: 'XMTP Docs',
          },
        },
        {
          id: 'payments',
          title: '3. Native Crypto Payment Integration',
          paragraphs: [
            'The payment system in Ledger Chat uses Wagmi v2 for wallet interaction and Viem for transaction construction. Payments are standard ERC-20 transfers or native ETH sends, not custom smart contracts.',
            'When a payment is made, the platform encodes the transaction hash and metadata into a message payload using the format __PAYMENT__::{json} and sends it through the XMTP channel. The receiving client renders this payload as a payment receipt bubble.',
          ],
          bullets: [
            'Supported assets: ETH, USDC, USDT, and any ERC-20 token.',
            'Library: Wagmi v2 with useSendTransaction and useWriteContract hooks.',
            'Receipt format: JSON payload with amount, token symbol, txHash, and recipient address.',
            'No platform fee: We do not take any percentage of payments. Gas fee only.',
          ],
        },
        {
          id: 'communities-api',
          title: '4. Communities API',
          paragraphs: [
            'Communities are managed through a REST API. All endpoints require an active session.',
          ],
          bullets: [
            'GET /api/chat/communities — List communities the authenticated user belongs to.',
            'POST /api/chat/communities — Create a new community. Body: name, description, isPublic.',
            'PATCH /api/chat/communities — Update community settings, channels, or permissions.',
            'GET /api/communities — List all public communities. Accepts query parameters: q (search), page, limit.',
            'GET /api/communities/:slug — Get a single public community by slug.',
            'POST /api/communities/:slug/join — Join a public community.',
          ],
        },
        {
          id: 'desktop',
          title: '5. Desktop Application',
          paragraphs: [
            'The Ledger Chat desktop application is built with Electron, wrapping the Next.js web application in a native shell. The entry point is electron/main.js. The build configuration is in electron/build-config.json.',
            'To build the desktop app locally, run the build-desktop.js script after the Next.js build is complete. The output directory is configurable in build-config.json.',
          ],
          bullets: [
            'Framework: Electron with the Next.js application as the renderer process.',
            'Installer: NSIS on Windows, DMG on macOS.',
            'App ID: com.humanityledger.ledgerchat',
            'Deep link support: ledgerchat:// protocol handler for wallet connection redirects.',
          ],
        },
        {
          id: 'environment',
          title: '6. Environment Variables',
          paragraphs: [
            'The following environment variables are required to run the platform.',
          ],
          bullets: [
            'DATABASE_URL — PostgreSQL connection string. Managed by Railway in production.',
            'NEXTAUTH_SECRET — Random secret for NextAuth session encryption.',
            'NEXTAUTH_URL — Public URL of the application.',
            'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID — Your WalletConnect project ID from cloud.walletconnect.com.',
            'NEXT_PUBLIC_ALCHEMY_API_KEY — Alchemy API key for Ethereum RPC access.',
          ],
        },
      ]}
    />
  );
}
