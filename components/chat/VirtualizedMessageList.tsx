import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';

interface VirtualizedMessageListProps {
  messages: any[];
  activePeer: string;
  myAddress: string;
  clientInboxId?: string;
  renderMessage: (msg: any, isMe: boolean) => React.ReactNode;
  onLoadMore: () => void;
  isLoadingMore: boolean;
}

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
  const senderLower = (msg.senderInboxId ?? '').toLowerCase();
  const isMe =
    (clientInboxIdLower && senderLower === clientInboxIdLower) ||
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
MemoizedMessageRow.displayName = 'MemoizedMessageRow';

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
  
  const myAddressLower = useMemo(() => myAddress.toLowerCase(), [myAddress]);
  const clientInboxIdLower = useMemo(() => (clientInboxId ?? '').toLowerCase(), [clientInboxId]);

  const startReached = useCallback(() => {
    if (!isLoadingMore) onLoadMore();
  }, [isLoadingMore, onLoadMore]);

  // Scroll to bottom when new messages arrive or peer changes
  useEffect(() => {
    if (messages.length > 0) {
      // Small delay to let DOM settle before scrolling
      const t = setTimeout(() => {
        virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, behavior: 'smooth' });
      }, 80);
      return () => clearTimeout(t);
    }
  }, [messages.length, activePeer]);

  return (
    // CRITICAL: parent must have explicit height so Virtuoso can scroll.
    // Using `style={{ height: '100%', overflow: 'hidden' }}` so flex parent drives the height.
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <Virtuoso
        ref={virtuosoRef}
        data={messages}
        initialTopMostItemIndex={messages.length > 0 ? messages.length - 1 : 0}
        startReached={startReached}
        alignToBottom={true}
        followOutput="smooth"
        style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        itemContent={(_index, msg) => (
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
