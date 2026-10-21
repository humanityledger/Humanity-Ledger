'use client';
import React from 'react';

export function VirtualizedMessageList({ messages, renderItem }: { messages: any[]; renderItem: (m: any) => React.ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto space-y-2 p-4" role="log" aria-live="polite">
      {messages.map((m, idx) => (
        <div key={m.id || idx}>{renderItem(m)}</div>
      ))}
    </div>
  );
}
