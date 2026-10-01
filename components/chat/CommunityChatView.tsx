'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { toast } from 'sonner';

export function CommunityChatView({ communityId, myAddress }: { communityId: string; myAddress: string }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const seenAddresses = useRef<Set<string>>(new Set());
  const [systemEvents, setSystemEvents] = useState<{ id: string; text: string }[]>([]);

  const fetchMessages = async () => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (myAddress) headers['x-web3-address'] = myAddress;
      const res = await fetch(`/api/chat/community-posts?communityId=${communityId}&limit=50`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      const chatMsgs = (data.posts || []).filter((p: any) => !p.title && !p.contentJson);
      const ordered = [...chatMsgs].reverse();
      // Detect new members
      ordered.forEach((m: any) => {
        const addr = (m.authorAddress || '').toLowerCase();
        if (addr && !seenAddresses.current.has(addr)) {
          seenAddresses.current.add(addr);
          if (seenAddresses.current.size > 1) {
            setSystemEvents(prev => [...prev, { id: `join-${addr}`, text: `${addr.slice(0, 6)}...${addr.slice(-4)} joined` }]);
          }
        }
      });
      setMessages(ordered);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (e) {
      console.error('[CommunityChatView] fetch error', e);
    }
  };

  useEffect(() => {
    if (!communityId) return;
    fetchMessages();
    const int = setInterval(fetchMessages, 3000);
    return () => clearInterval(int);
  }, [communityId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    if (!myAddress || myAddress.trim() === '') {
      toast.error('Wallet not connected');
      return;
    }
    const txt = input.trim();
    setInput('');
    setSending(true);
    // Optimistic insert
    const optimistic = { id: `opt-${Date.now()}`, authorAddress: myAddress.toLowerCase(), content: txt, createdAt: new Date().toISOString() };
    setMessages(prev => [...prev, optimistic]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    try {
      const res = await fetch('/api/chat/community-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-web3-address': myAddress },
        body: JSON.stringify({ communityId, content: txt, plainText: txt }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to send message');
        setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      } else {
        fetchMessages();
      }
    } catch (e) {
      toast.error('Network error. Please try again.');
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  };

  const allEvents = [...systemEvents];

  return (
    <div className="flex flex-col h-full bg-[#F2F2F7] overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[200px] opacity-50 space-y-2">
            <div className="w-14 h-14 rounded-full bg-black/5 flex items-center justify-center">
              <Send size={22} className="text-black/40 ml-1" />
            </div>
            <p className="text-[14px] font-bold">No messages yet</p>
            <p className="text-[12px] text-black/50">Send a message to start the conversation.</p>
          </div>
        )}
        {messages.map((m: any) => {
          if (m.content && m.content.startsWith('__SYSTEM__')) {
            const evText = m.content.replace('__SYSTEM__', '');
            return (
              <div key={m.id} className="flex justify-center my-2">
                <span className="text-[11px] text-black/40 bg-black/5 rounded-full px-3 py-1">{evText}</span>
              </div>
            );
          }
          const isMe = (m.authorAddress || '').toLowerCase() === (myAddress || '').toLowerCase();
          return (
            <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              {!isMe && (
                <span className="text-[10px] text-black/40 font-mono mb-1 px-1">
                  {(m.authorAddress || '').slice(0, 6)}...{(m.authorAddress || '').slice(-4)}
                </span>
              )}
              <div className={`px-4 py-2.5 rounded-2xl max-w-[80%] text-[15px] leading-snug ${
                isMe
                  ? 'bg-[#007AFF] text-white rounded-br-sm'
                  : 'bg-white border border-black/5 text-black rounded-bl-sm'
              } shadow-sm`}>
                {m.content}
              </div>
            </div>
          );
        })}
        {allEvents.map(ev => (
          <div key={ev.id} className="flex justify-center">
            <span className="text-[11px] text-black/40 bg-black/5 rounded-full px-3 py-1">{ev.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="p-3 bg-white border-t border-black/5 shrink-0 pb-[env(safe-area-inset-bottom,12px)]">
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Message community..."
            disabled={sending}
            className="flex-1 bg-[#F2F2F7] border border-black/5 rounded-full px-5 py-2.5 outline-none text-[15px] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="w-10 h-10 bg-[#007AFF] text-white rounded-full flex items-center justify-center disabled:opacity-40 transition-opacity shrink-0"
          >
            <Send size={16} className="-ml-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
