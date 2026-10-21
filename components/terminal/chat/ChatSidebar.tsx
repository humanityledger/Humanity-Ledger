'use client';
import React from 'react';

export function ChatSidebar({ conversations = [] }: { conversations: any[] }) {
  return (
    <aside className="w-80 border-r border-neutral-200 bg-neutral-50 h-full flex flex-col">
      <div className="p-4 border-b border-neutral-200 font-bold text-sm">Conversations</div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-6 text-xs text-neutral-400 text-center">No active chats</div>
        ) : null}
      </div>
    </aside>
  );
}
