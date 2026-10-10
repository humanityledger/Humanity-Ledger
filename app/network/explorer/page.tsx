import { AztecDocPage } from '@/components/landing/AztecDocPage';

export default function NetworkExplorerPage() {
  return (
    <AztecDocPage
      eyebrow="Network — Block Explorer"
      title="Transaction Verification"
      subtitle="When a crypto payment is made inside Ledger Chat, it settles on the public blockchain. Anyone can verify the transaction independently using standard block explorers. This page explains what that means and how to do it."
      sections={[
        {
          id: 'how-payments-settle',
          title: 'How Crypto Payments Settle',
          paragraphs: [
            'Crypto payments made inside Ledger Chat are standard on-chain transactions. When you send ETH or USDC to another user, the transaction is signed by your wallet and broadcast directly to the Ethereum network. Humanity Ledger is not involved in the settlement.',
            'Because the payment settles on a public blockchain, it can be independently verified by anyone with the transaction hash. This hash appears in the payment receipt inside the chat window immediately after the transaction is confirmed.',
          ],
        },
        {
          id: 'verification',
          title: 'How to Verify a Transaction',
          paragraphs: [
            'To verify that a payment actually went through and landed in the correct wallet, follow these steps.',
          ],
          bullets: [
            'Locate the payment receipt in the chat. It shows the amount, the token, and a link to the transaction.',
            'Click the link or copy the transaction hash and open etherscan.io.',
            'The transaction page on Etherscan will show the sender address, the recipient address, the amount transferred, the timestamp, and the confirmation count.',
            'If the status shows as Success and the recipient address matches the person you intended to pay, the transaction is complete and irreversible.',
          ],
        },
        {
          id: 'what-is-visible',
          title: 'What is Publicly Visible',
          paragraphs: [
            'Ethereum is a public blockchain. The following information is visible to anyone when a transaction is made.',
          ],
          bullets: [
            'Sender wallet address: The address that signed and sent the transaction.',
            'Recipient wallet address: The address that received the funds.',
            'Amount: The exact value transferred.',
            'Timestamp: The block number and time the transaction was included.',
            'Gas fee: The network fee paid by the sender to the Ethereum validators.',
          ],
          callout: {
            title: 'Your Privacy on the Blockchain',
            body: 'Because Ethereum is public, wallet addresses and transaction amounts are visible on-chain. Your name and personal data are not linked to your wallet address by Humanity Ledger. However, if you have connected your wallet to other services that have identified it, that information may exist elsewhere.',
          },
        },
        {
          id: 'supported',
          title: 'Supported Networks and Tokens',
          paragraphs: [
            'Ledger Chat currently supports payments on the Ethereum mainnet. The following tokens are available inside the payment modal.',
          ],
          bullets: [
            'ETH — Native Ethereum, usable immediately from any Ethereum wallet.',
            'USDC — USD Coin, a regulated stablecoin issued by Circle, pegged to the US dollar.',
            'USDT — Tether, a widely used stablecoin.',
            'Additional EVM-compatible networks and tokens are planned for 2027.',
          ],
        },
      ]}
    />
  );
}
