import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
// Requires: npm install react-virtuoso
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';

interface VirtualizedMessageListProps {
  messages: any[];
  activePeer: string;
  myAddress: string;
  renderMessage: (msg: any, isMe: boolean) => React.ReactNode;
  onLoadMore: () => void;
  isLoadingMore: boolean;
}

// Memoized individual row component to prevent reconciliation lag on 50k messages
const MemoizedMessageRow = React.memo(({ 
  msg, 
  myAddressLower, 
  renderMessage 
}: { 
  msg: any; 
  myAddressLower: string; 
  renderMessage: (msg: any, isMe: boolean) => React.ReactNode;
}) => {
  const isMe = msg.senderInboxId?.toLowerCase() === myAddressLower || 
               msg.senderAddress?.toLowerCase() === myAddressLower;
  
  return (
    <div className="w-full pb-3">
      {renderMessage(msg, isMe)}
    </div>
  );
}, (prev, next) => prev.msg.id === next.msg.id && prev.msg.status === next.msg.status);

export const VirtualizedMessageList: React.FC<VirtualizedMessageListProps> = ({
  messages,
  activePeer,
  myAddress,
  renderMessage,
  onLoadMore,
  isLoadingMore
}) => {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  
  // Cache the lowercase string to avoid doing it 50,000 times inside the render loop
  const myAddressLower = useMemo(() => myAddress.toLowerCase(), [myAddress]);

  // Handle infinite scroll up
  const startReached = useCallback(() => {
    if (!isLoadingMore) {
      onLoadMore();
    }
  }, [isLoadingMore, onLoadMore]);

  return (
    <div className="flex-1 w-full h-full bg-[#FDFDFD]">
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
