import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
// Requires: npm install react-virtuoso
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';

interface VirtualizedMessageListProps {
  messages: any[];
  activePeer: string;
  myAddress: string;
  /** The XMTP inboxId of the current user (a hash string, NOT an ETH address) */
  clientInboxId?: string;
  renderMessage: (msg: any, isMe: boolean) => React.ReactNode;
  onLoadMore: () => void;
  isLoadingMore: boolean;
}

// Memoized individual row component to prevent reconciliation lag on 50k messages
const MemoizedMessageRow = React.memo(({ 
  msg, 
  myAddressLower,
  clientInboxIdLower,
  renderMessage 
}: { 
  msg: any; 
  myAddressLower: string;
  clientInboxIdLower: string;
  renderMessage: (msg: any, isMe: boolean) => React.ReactNode;
}) => {
  // [CRITICAL FIX] senderInboxId is an XMTP hash, NOT an ETH address.
  // We MUST compare senderInboxId against the XMTP clientInboxId (also a hash).
  // The ETH address comparison is a fallback for optimistic messages only,
  // which have senderInboxId set to the ETH address.
  const senderLower = (msg.senderInboxId ?? '').toLowerCase();
  const isMe =
    // Primary: XMTP inboxId match (real messages from network)
    (clientInboxIdLower && senderLower === clientInboxIdLower) ||
    // Fallback: ETH address match (optimistic messages we created locally)
    senderLower === myAddressLower ||
    msg.senderAddress?.toLowerCase() === myAddressLower;
  
  return (
    <div className="w-full pb-1">
      {renderMessage(msg, isMe)}
    </div>
  );
}, (prev, next) => 
  prev.msg.id === next.msg.id && 
  prev.msg.status === next.msg.status &&
  prev.msg.reactions === next.msg.reactions
);

export const VirtualizedMessageList: React.FC<VirtualizedMessageListProps> = ({
  messages,
  activePeer,
  myAddress,
  clientInboxId,
  renderMessage,
  onLoadMore,
  isLoadingMore
}) => {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  
  // Cache the lowercase strings to avoid recomputing on every render
  const myAddressLower = useMemo(() => myAddress.toLowerCase(), [myAddress]);
  const clientInboxIdLower = useMemo(() => (clientInboxId ?? '').toLowerCase(), [clientInboxId]);

  // Handle infinite scroll up
  const startReached = useCallback(() => {
    if (!isLoadingMore) {
      onLoadMore();
    }
  }, [isLoadingMore, onLoadMore]);

  return (
    <div className="flex-1 w-full h-full">
      <Virtuoso
        ref={virtuosoRef}
        data={messages}
        initialTopMostItemIndex={messages.length > 0 ? messages.length - 1 : 0}
        startReached={startReached}
        alignToBottom={true}
        followOutput={"smooth"}
        itemContent={(index, msg) => (
          <MemoizedMessageRow 
            key={msg.id}
            msg={msg} 
            myAddressLower={myAddressLower}
            clientInboxIdLower={clientInboxIdLower}
            renderMessage={renderMessage} 
          />
        )}
        components={{
          Header: () => isLoadingMore ? (
            <div className="h-10 w-full flex items-center justify-center">
              <div className="text-xs text-black/40 animate-pulse">Loading older messages...</div>
            </div>
          ) : null
        }}
      />
    </div>
  );
};
