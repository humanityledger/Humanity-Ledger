import React, { useState, useEffect } from 'react';
import { Send } from 'lucide-react';
import { toast } from 'sonner';

export function CommunityChatView({ communityId, myAddress }: { communityId: string, myAddress: string }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/chat/community-posts?communityId=${communityId}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        // Filter out rich posts, only keep plain chat messages (those with no title)
        const chatMsgs = data.posts.filter((p: any) => !p.title && !p.contentJson);
        setMessages(chatMsgs.reverse());
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchMessages();
    const int = setInterval(fetchMessages, 3000);
    return () => clearInterval(int);
  }, [communityId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const txt = input.trim();
    setInput('');
    try {
      const res = await fetch('/api/chat/community-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-web3-address': myAddress },
        body: JSON.stringify({ communityId, content: txt, plainText: txt }),
      });
      if (res.ok) {
        fetchMessages();
      } else {
        toast.error('Failed to send');
      }
    } catch (e) {
      toast.error('Error sending message');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F2F2F7] relative pb-[env(safe-area-inset-bottom,20px)] overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m: any) => {
          const isMe = m.authorAddress === myAddress.toLowerCase();
          return (
            <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <span className="text-[10px] text-black/40 font-mono mb-1 px-1">
                {m.authorAddress.slice(0, 6)}...{m.authorAddress.slice(-4)}
              </span>
              <div className={`px-4 py-2.5 rounded-2xl max-w-[80%] ${isMe ? 'bg-[#007AFF] text-white rounded-br-sm' : 'bg-white border border-black/5 text-black rounded-bl-sm'} shadow-sm`}>
                {m.content}
              </div>
            </div>
          );
        })}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full opacity-50 space-y-3">
            <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center">
              <Send size={24} className="text-black/40 ml-1" />
            </div>
            <p className="text-[15px] font-bold">No chat history</p>
            <p className="text-[13px]">Send a message to start the conversation.</p>
          </div>
        )}
      </div>
      <div className="p-3 bg-white border-t border-black/5 shrink-0">
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Message community..."
            className="flex-1 bg-[#F2F2F7] border border-black/5 rounded-full px-5 py-2.5 outline-none text-[15px]"
          />
          <button type="submit" disabled={!input.trim()} className="w-10 h-10 bg-[#007AFF] text-white rounded-full flex items-center justify-center disabled:opacity-50">
            <Send size={16} className="-ml-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
