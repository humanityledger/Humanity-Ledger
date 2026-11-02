'use client';

/**
 * ZkMoneyModal: "Private payment" from inside a conversation.
 *
 * It used to run a simulated payment and post a message that looked like a
 * receipt. It now opens the real private wallet on its Send sheet. When the
 * payment is confirmed on the Aztec test network, it posts a plain message
 * with the transaction hash and the sender's Aztec address, so the recipient
 * can find the payment in their own wallet. The amount is not included in the
 * message: it stays visible only to the two people involved, even if the
 * message itself travels through the readable fallback path.
 */

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ZkWalletPanel } from '@/components/zk/ZkWalletPanel';
import { getPrivateWallet } from '@/lib/aztec/wallet/client';
import type { TokenKey } from '@/lib/aztec/wallet/config';

interface ZkMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  myAddress: string;
  recipientAddress?: string;
  recipientName?: string;
  communityName?: string;
  /** Receives the chat message to post once the payment is confirmed. */
  onSuccess: (message: string, result: { txHash: string; token: TokenKey }) => void;
}

export const ZkMoneyModal: React.FC<ZkMoneyModalProps> = ({ isOpen, onClose, myAddress, onSuccess }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[600] flex items-stretch justify-end bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div className="h-full w-full max-w-[420px]" onClick={(e) => e.stopPropagation()}>
            <ZkWalletPanel
              address={myAddress}
              onClose={onClose}
              initialSheet="send"
              onPaymentSent={({ txHash, token }) => {
                const mine = getPrivateWallet().state.aztecAddress;
                const message =
                  `I sent you a private payment in ${token} test tokens on the Aztec test network. ` +
                  `Only you and I can see the amount. Transaction: ${txHash}.` +
                  (mine ? ` If it does not show in your private wallet, add my Aztec address under Receive: ${mine}` : '');
                onSuccess(message, { txHash, token });
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ZkMoneyModal;
