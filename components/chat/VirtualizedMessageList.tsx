'use client';
import React, { useEffect, useRef, useMemo, useCallback } from 'react';

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
    (typeof msg.isMe === 'boolean' ? msg.isMe : false) ||
    (typeof msg.fromPeer === 'boolean' ? !msg.fromPeer : false) ||
    (clientInboxIdLower && !!senderLower && senderLower === clientInboxIdLower) ||
    (!!senderLower && senderLower === myAddressLower) ||
    (!!msg.senderAddress && msg.senderAddress.toLowerCase() === myAddressLower);
  
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  
  const myAddressLower = useMemo(() => myAddress.toLowerCase(), [myAddress]);
  const clientInboxIdLower = useMemo(() => (clientInboxId ?? '').toLowerCase(), [clientInboxId]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    if (scrollRef.current.scrollTop < 60 && !isLoadingMore) {
      onLoadMore();
    }
  }, [isLoadingMore, onLoadMore]);

  // Scroll to bottom when messages update or peer changes
  useEffect(() => {
    if (messages.length > 0) {
      const t = setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
      return () => clearTimeout(t);
    }
  }, [messages.length, activePeer]);

  return (
    <div 
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto overscroll-contain flex flex-col p-4 space-y-2"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {isLoadingMore && (
        <div className="h-10 w-full flex items-center justify-center shrink-0">
          <div className="text-xs text-black/40 animate-pulse font-medium">Loading previous messages...</div>
        </div>
      )}
      {messages.map((msg: any) => (
        <MemoizedMessageRow 
          key={msg.id}
          msg={msg} 
          myAddressLower={myAddressLower}
          clientInboxIdLower={clientInboxIdLower}
          renderMessage={renderMessage} 
        />
      ))}
      <div ref={bottomRef} className="h-1 shrink-0" />
    </div>
  );
};
