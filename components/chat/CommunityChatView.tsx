'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Send, Plus, MapPin, CircleDollarSign, Smile, BarChart2 } from 'lucide-react';
import { toast } from 'sonner';
import { MessageBubble } from './MessageBubble';
import { NativeCryptoSendModal } from './NativeCryptoSendModal';
import { AnimatePresence, motion } from 'framer-motion';

export function CommunityChatView({ communityId, myAddress }: { communityId: string; myAddress: string }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const seenAddresses = useRef<Set<string>>(new Set());
  const [systemEvents, setSystemEvents] = useState<{ id: string; text: string }[]>([]);
  const [showAppDrawer, setShowAppDrawer] = useState(false);
  const [showWalletTransfer, setShowWalletTransfer] = useState(false);
  const [cryptoRecipient, setCryptoRecipient] = useState('');
  const [showRecipientInput, setShowRecipientInput] = useState(false);

  const fetchMessages = async () => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (myAddress) headers['x-web3-address'] = myAddress;
      const res = await fetch(`/api/chat/communities/posts?communityId=${communityId}&limit=50`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      const chatMsgs = (data.posts || []).filter((p: any) => !p.title && !p.contentJson);
      const ordered = [...chatMsgs].reverse();
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

  const executeSend = async (txt: string) => {
    if (!myAddress || myAddress.trim() === '') {
      toast.error('Wallet not connected');
      return;
    }
    setSending(true);
    const optimistic = { id: `opt-${Date.now()}`, authorAddress: myAddress.toLowerCase(), content: txt, createdAt: new Date().toISOString() };
    setMessages(prev => [...prev, optimistic]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    try {
      const res = await fetch('/api/chat/communities/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-web3-address': myAddress },
        body: JSON.stringify({ communityId, authorAddress: myAddress.toLowerCase(), content: txt, plainText: txt }),
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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const txt = input.trim();
    setInput('');
    await executeSend(txt);
  };

  const sendLocation = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
    toast.info('Fetching location...');
    navigator.geolocation.getCurrentPosition(
      (pos) => executeSend(`[LOCATION]${pos.coords.latitude},${pos.coords.longitude}`),
      () => toast.error('Location permission denied')
    );
  };

  const allEvents = [...systemEvents];

  return (
    <div className="flex flex-col h-full bg-[#F2F2F7] overflow-hidden relative">
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
              <MessageBubble
                msg={m}
                isMe={isMe}
                showDate={false}
                dateStr=""
                isSecretChat={false}
                fontFamily="Inter, sans-serif"
                fontSizePx={15}
                clientInboxId={myAddress}
                onReply={() => {}}
                onReact={() => {}}
                onContextMenu={() => {}}
                onOpenLightbox={() => {}}
                formatMessagePreview={(c) => c}
              />
            </div>
          );
        })}
        {allEvents.map(ev => (
          <div key={ev.id} className="flex justify-center my-2">
            <span className="text-[11px] text-black/40 bg-black/5 rounded-full px-3 py-1">{ev.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* ── RECIPIENT INPUT (shown before crypto send) ── */}
      <AnimatePresence>
        {showRecipientInput && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end"
            onClick={e => { if (e.target === e.currentTarget) setShowRecipientInput(false); }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="w-full bg-white rounded-t-3xl p-6 flex flex-col gap-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-[17px] font-semibold text-[#1C1C1E]">Send Crypto</h3>
                <button onClick={() => setShowRecipientInput(false)} className="text-black/40 hover:text-black">✕</button>
              </div>
              <p className="text-[13px] text-black/50">Enter the recipient's Ethereum wallet address (0x...)</p>
              <input
                value={cryptoRecipient}
                onChange={e => setCryptoRecipient(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-3 rounded-xl border border-black/10 text-[15px] font-mono outline-none focus:border-[#25D366]"
                spellCheck={false}
                autoComplete="off"
              />
              <button
                disabled={!/^0x[0-9a-fA-F]{40}$/.test(cryptoRecipient.trim())}
                onClick={() => { setShowRecipientInput(false); setShowWalletTransfer(true); }}
                className="w-full py-3.5 bg-[#25D366] disabled:bg-[#25D366]/40 text-white font-bold rounded-xl transition-colors"
              >
                Continue →
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-3 bg-white border-t border-black/5 shrink-0 pb-[env(safe-area-inset-bottom,12px)] relative">
        {/* APP DRAWER */}
        <AnimatePresence>
          {showAppDrawer && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-3"
            >
              <div className="grid grid-cols-4 gap-4 px-2 py-4">
                <button onClick={() => { setShowAppDrawer(false); sendLocation(); }} className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-[#25D366] text-white flex items-center justify-center shadow-sm"><MapPin size={22} /></div>
                  <span className="text-[11px] font-semibold text-[#1C1C1E]">Location</span>
                </button>
                <button onClick={() => { setShowAppDrawer(false); setCryptoRecipient(''); setShowRecipientInput(true); }} className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-[#128C7E] text-white flex items-center justify-center shadow-sm"><CircleDollarSign size={22} /></div>
                  <span className="text-[11px] font-semibold text-[#1C1C1E]">Send Crypto</span>
                </button>
                <button onClick={() => { setShowAppDrawer(false); executeSend('[STICKER]:fire'); }} className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-sm"><Smile size={22} /></div>
                  <span className="text-[11px] font-semibold text-[#1C1C1E]">Sticker</span>
                </button>
                <button onClick={() => { setShowAppDrawer(false); toast.info('Polls coming soon'); }} className="flex flex-col items-center gap-2 opacity-50">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500 text-white flex items-center justify-center shadow-sm"><BarChart2 size={22} /></div>
                  <span className="text-[11px] font-semibold text-[#1C1C1E]">Poll</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSend} className="flex gap-2 items-center">
          <button
            type="button"
            onClick={() => setShowAppDrawer(v => !v)}
            className="w-9 h-9 rounded-full bg-[#F2F2F7] flex items-center justify-center hover:bg-[#E5E5EA] transition-colors shrink-0 text-[#25D366]"
          >
            <Plus size={20} />
          </button>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Message community..."
            disabled={sending}
            className="flex-1 bg-[#F2F2F7] border border-black/5 rounded-full px-5 py-2 outline-none text-[15px] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="w-9 h-9 bg-[#25D366] text-white rounded-full flex items-center justify-center disabled:opacity-40 transition-opacity shrink-0"
          >
            <Send size={16} className="-ml-0.5" />
          </button>
        </form>
      </div>

      {/* Crypto Transfer Modal — uses the real recipient address the user typed */}
      {showWalletTransfer && (
        <NativeCryptoSendModal
          isOpen={showWalletTransfer}
          recipientAddress={cryptoRecipient}
          onClose={() => setShowWalletTransfer(false)}
          onSent={(txHash, amount, token) => {
            const payload = JSON.stringify({ amount, token, txHash, to: cryptoRecipient });
            executeSend(`__PAYMENT__::${payload}`);
            setShowWalletTransfer(false);
          }}
        />
      )}
    </div>
  );
}
