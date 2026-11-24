/**
 * lib/privacy/disclosure.ts — what each action keeps private and what it reveals.
 *
 * One map, read by every screen that moves value (the send review, shield and unshield, the
 * payment and request cards in a conversation). Screens never write their own privacy sentences,
 * so they cannot drift apart or promise more than the protocol gives.
 *
 * The facts, for Aztec v6 as this app uses it:
 *  - A private transfer publishes only note hashes, nullifiers and encrypted logs. The amount and
 *    the recipient are not readable on the network.
 *  - Every transaction names a fee payer in its public data. On Aztec Alpha there is no sponsored
 *    fee contract (lib/aztec/fees.ts), so the account pays its own Fee Juice and is the fee payer:
 *    the network can see that this account sent a transaction and what fee it paid, and can link
 *    the account's transactions to each other. On the test network the sponsored fee contract is
 *    the fee payer instead.
 *  - Moving tokens between a public and a private balance (shield, unshield) reveals the amount
 *    and the account doing it.
 *  - A payment message or request in a conversation travels end to end encrypted over XMTP (MLS);
 *    only the people in the conversation can read it.
 *
 * A private fee contract (FPC) would remove the fee-payer link on Alpha. Until one is integrated
 * and reviewed, the sentences below say so instead of hiding it.
 */

/** Who pays the transaction fee, which decides what the fee reveals. */
export type FeeMode = 'own-fee-juice' | 'sponsored';

export type DisclosureAction = 'send' | 'receive' | 'shield' | 'unshield' | 'request';

export interface Disclosure {
  /** What nobody outside the conversation can read. */
  private: readonly string[];
  /** What anyone watching the network can see. */
  public: readonly string[];
  /** One sentence for compact places (a chat card, a footer). */
  summary: string;
}

/** The fee mode the wallet uses on a network: Alpha (mainnet) has no sponsored fees. */
export function feeModeFor(network: string): FeeMode {
  return network === 'mainnet' ? 'own-fee-juice' : 'sponsored';
}

const FEE_PUBLIC: Record<FeeMode, string> = {
  'own-fee-juice': 'That your account sent a transaction, and the fee it paid in Fee Juice. Transactions paid this way can be linked to your account.',
  sponsored: 'That a transaction happened. The fee is paid by the network’s sponsored fee contract, not by your account.',
};

const FEE_SUMMARY: Record<FeeMode, string> = {
  'own-fee-juice': 'The amount and the recipient stay private. The network sees that your account paid a fee.',
  sponsored: 'The amount, you and the recipient stay private. The network sees that a transaction happened.',
};

export function disclosureFor(action: DisclosureAction, fee: FeeMode): Disclosure {
  switch (action) {
    case 'send':
      return {
        private: fee === 'own-fee-juice' ? ['The amount', 'The recipient', 'The message in this conversation'] : ['The amount', 'The recipient', 'That you sent it', 'The message in this conversation'],
        public: [FEE_PUBLIC[fee]],
        summary: FEE_SUMMARY[fee],
      };
    case 'receive':
      return {
        private: ['The amount', 'Who paid you', 'The message in this conversation'],
        public: ['Nothing on your side: receiving does not send a transaction from your account.'],
        summary: 'Receiving sends nothing from your account. The amount and the sender stay private.',
      };
    case 'shield':
      return {
        private: ['What you do with the tokens afterwards'],
        public: ['The amount you move into your private balance', 'Your account', FEE_PUBLIC[fee]],
        summary: 'Shielding is visible: the network sees the amount and your account.',
      };
    case 'unshield':
      return {
        private: ['Which private payments the tokens came from'],
        public: ['The amount you move to your public balance', 'Your account', FEE_PUBLIC[fee]],
        summary: 'Unshielding is visible: the network sees the amount and your account.',
      };
    case 'request':
      return {
        private: ['The amount asked', 'The note'],
        public: ['Nothing until it is paid. Then the payment reveals only what a private payment reveals.'],
        summary: 'A request is an encrypted message. Nothing reaches the network until it is paid.',
      };
  }
}
