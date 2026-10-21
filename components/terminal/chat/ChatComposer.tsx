'use client';
import React, { useState } from 'react';

export function ChatComposer({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState('');
  return (
    <div className="p-3 border-t border-neutral-200 bg-white flex gap-2">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type an encrypted message..."
        className="flex-1 px-4 py-2 text-sm border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-black"
        onKeyDown={(e) => { if (e.key === 'Enter' && text.trim()) { onSend(text.trim()); setText(''); } }}
      />
      <button
        onClick={() => { if (text.trim()) { onSend(text.trim()); setText(''); } }}
        className="px-4 py-2 bg-black text-white text-sm font-semibold rounded-xl hover:bg-neutral-800"
      >
        Send
      </button>
    </div>
  );
}
