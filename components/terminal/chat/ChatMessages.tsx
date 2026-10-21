'use client';
import React from 'react';

export function ChatMessages({ messages }: { messages: any[] }) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.map((m, i) => (
        <div key={m.id || i} className={`flex ${m.isOutgoing ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${m.isOutgoing ? 'bg-black text-white' : 'bg-neutral-100 text-black'}`}>
            {m.content}
          </div>
        </div>
      ))}
    </div>
  );
}
