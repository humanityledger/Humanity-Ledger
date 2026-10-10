'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, Plus, MapPin, CircleDollarSign, Smile, BarChart2, Paperclip, Mic,
  Hash, Lock, CheckCircle, AlertCircle, ChevronDown, Image as ImgIcon,
  Trash2, Reply, Heart, MoreHorizontal, Volume2, Play, Pause, X
} from 'lucide-react';
import { toast } from 'sonner';
import { NativeCryptoSendModal } from './NativeCryptoSendModal';
import { AnimatePresence, motion } from 'framer-motion';
import DOMPurify from 'dompurify';

// ─── Polyfill: safely sanitise HTML or return plain text ─────────────────────
function safeHtml(raw: string): string {
  if (typeof window === 'undefined') return raw;
  return DOMPurify.sanitize(raw, { ALLOWED_TAGS: ['b','i','u','s','em','strong','a','p','br','ul','ol','li','blockquote','code','pre','h1','h2','h3','img','mark'], ALLOWED_ATTR: ['href','src','alt','class'] });
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  authorAddress: string;
  content: string;
  contentHtml?: string;
  createdAt: string;
  channelId?: string;
  isOptimistic?: boolean;
}

interface CommunityChatViewProps {
  communityId: string;
  channelId?: string | null;
  myAddress: string;
  communityName?: string;
}

// ─── VOICE NOTE RECORDER ─────────────────────────────────────────────────────
function VoiceRecorder({ onSend, onCancel }: { onSend: (b64: string) => void; onCancel: () => void }) {
  const [seconds, setSeconds] = useState(0);
  const [recording, setRecording] = useState(false);
  const [chunks, setChunks] = useState<Blob[]>([]);
  const mrRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    let stream: MediaStream;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mr = new MediaRecorder(stream);
        mrRef.current = mr;
        const c: Blob[] = [];
        mr.ondataavailable = e => { if (e.data.size > 0) c.push(e.data); setChunks([...c]); };
        mr.start(200);
        setRecording(true);
      } catch { toast.error('Microphone access denied'); onCancel(); }
    })();
    return () => { mrRef.current?.stop(); stream?.getTracks().forEach(t => t.stop()); };
  }, []);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  const finish = () => {
    mrRef.current?.stop();
    setTimeout(() => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onload = () => { onSend(`__AUDIO__${reader.result}`); };
      reader.readAsDataURL(blob);
    }, 300);
  };

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2,'0')}:${(s % 60).toString().padStart(2,'0')}`;

  return (
    <div className="flex-1 flex items-center gap-3 px-2">
      <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
      <span className="text-[13px] font-mono font-bold text-[#1C1C1E]">{fmt(seconds)}</span>
      <div className="flex-1 h-1.5 bg-red-100 rounded-full overflow-hidden">
        <div className="h-full bg-red-500 animate-pulse" style={{ width: `${Math.min(100, seconds * 2)}%` }} />
      </div>
      <button onClick={onCancel} className="p-2 rounded-full hover:bg-black/5 text-black/40">
        <X size={18} />
      </button>
      <button onClick={finish} className="w-9 h-9 bg-[#25D366] text-white rounded-full flex items-center justify-center shadow-md hover:bg-[#128C7E] transition-colors">
        <Send size={15} className="-ml-0.5" />
      </button>
    </div>
  );
}

// ─── AUDIO PLAYER ─────────────────────────────────────────────────────────────
function AudioPlayer({ src }: { src: string }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); }
  };

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2,'0')}:${Math.floor(s % 60).toString().padStart(2,'0')}`;

  return (
    <div className="flex items-center gap-3 min-w-[200px]">
      <audio ref={audioRef} src={src} onTimeUpdate={e => setProgress((e.currentTarget.currentTime / e.currentTarget.duration) * 100)} onLoadedMetadata={e => setDuration(e.currentTarget.duration)} onEnded={() => setPlaying(false)} className="hidden" />
      <button onClick={toggle} className="w-9 h-9 rounded-full bg-[#25D366]/15 text-[#25D366] flex items-center justify-center shrink-0 hover:bg-[#25D366]/25 transition-colors">
        {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
      </button>
      <div className="flex-1">
        <div className="h-1 bg-black/10 rounded-full overflow-hidden">
          <div className="h-full bg-[#25D366] rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-[10px] text-black/40 mt-1 font-mono">{fmt((progress / 100) * duration)} / {fmt(duration)}</p>
      </div>
    </div>
  );
}

// ─── MESSAGE RENDERER ─────────────────────────────────────────────────────────
function MessageContent({ content }: { content: string }) {
  // Payment bubble
  if (content.startsWith('__PAYMENT__::')) {
    try {
      const d = JSON.parse(content.replace('__PAYMENT__::', ''));
      return (
        <div className="flex items-center gap-3 bg-[#25D366]/10 border border-[#25D366]/20 rounded-2xl px-4 py-3 min-w-[220px]">
          <div className="w-10 h-10 rounded-full bg-[#25D366]/20 flex items-center justify-center shrink-0">
            <CircleDollarSign size={20} className="text-[#25D366]" />
          </div>
          <div>
            <p className="text-[13px] font-black text-[#1C1C1E]">{d.amount} {d.token}</p>
            <a href={`https://etherscan.io/tx/${d.txHash}`} target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#25D366] font-medium hover:underline">View on Etherscan ↗</a>
          </div>
          <CheckCircle size={18} className="text-[#25D366] ml-auto shrink-0" />
        </div>
      );
    } catch { return <span className="text-[13px]">{content}</span>; }
  }

  // Audio voice note
  if (content.startsWith('__AUDIO__')) {
    const src = content.replace('__AUDIO__', '');
    return <AudioPlayer src={src} />;
  }

  // Location
  if (content.startsWith('[LOCATION]')) {
    const [lat, lon] = content.replace('[LOCATION]', '').split(',');
    return (
      <a href={`https://maps.google.com/?q=${lat},${lon}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[13px] text-[#25D366] font-medium hover:underline">
        <MapPin size={14} /> Location shared ↗
      </a>
    );
  }

  // Media (image/video)
  if (content.startsWith('__MEDIA__')) {
    const rest = content.replace('__MEDIA__', '');
    const sep = rest.indexOf('__::');
    if (sep !== -1) {
      const mime = rest.substring(0, sep);
      const data = rest.substring(sep + 4);
      if (mime.startsWith('image/')) return <img src={data} alt="attachment" className="max-w-[260px] rounded-2xl border border-black/5" />;
      if (mime.startsWith('video/')) return <video src={data} controls className="max-w-[260px] rounded-2xl" />;
    }
  }

  // Poll
  if (content.startsWith('__POLL__')) {
    const parts = content.split('__::');
    const question = parts[1] || '';
    const options = (parts[2] || '').split('|').filter(Boolean);
    return (
      <div className="min-w-[200px]">
        <p className="text-[14px] font-bold text-[#1C1C1E] mb-2">{question}</p>
        <div className="space-y-1.5">
          {options.map((o, i) => (
            <button key={i} className="w-full text-left text-[13px] font-medium px-3 py-2 rounded-xl bg-black/5 hover:bg-[#25D366]/10 hover:text-[#25D366] transition-colors">{o}</button>
          ))}
        </div>
      </div>
    );
  }

  // Sticker
  if (content.startsWith('[STICKER]:')) {
    const name = content.replace('[STICKER]:', '');
    const stickers: Record<string, string> = { fire: '🔥', heart: '❤️', clap: '👏',100: '💯', rocket: '🚀', wave: '👋', thumbsup: '👍' };
    return <span className="text-5xl">{stickers[name] || '🎭'}</span>;
  }

  // Rich HTML content (from posts editor)
  if (content.includes('<') && content.includes('>') && content.length > 20) {
    return <div className="prose prose-sm max-w-none text-[14px] leading-relaxed" dangerouslySetInnerHTML={{ __html: safeHtml(content) }} />;
  }

  // Plain text
  return <span className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">{content}</span>;
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
export function CommunityChatView({ communityId, channelId, myAddress, communityName }: CommunityChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showAppDrawer, setShowAppDrawer] = useState(false);
  const [showCryptoModal, setShowCryptoModal] = useState(false);
  const [cryptoRecipient, setCryptoRecipient] = useState('');
  const [showRecipientSheet, setShowRecipientSheet] = useState(false);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [contextMenu, setContextMenu] = useState<{ msg: Message; x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const optimisticIds = useRef<Set<string>>(new Set());

  // ─── FETCH MESSAGES ──────────────────────────────────────────────────────
  const fetchMessages = useCallback(async (silent = true) => {
    if (!communityId) return;
    try {
      const url = `/api/chat/communities/posts?communityId=${communityId}${channelId ? `&channelId=${channelId}` : ''}&limit=100`;
      const res = await fetch(url, {
        headers: { 'x-web3-address': myAddress, 'Content-Type': 'application/json' }
      });
      if (!res.ok) return;
      const data = await res.json();
      const raw: Message[] = (data.posts || []);

      // Filter to only channel messages (no title = chat message)
      const chatMsgs = raw.filter(p => !p.title);
      const filtered = channelId
        ? chatMsgs.filter(m => m.channelId === channelId || !m.channelId)
        : chatMsgs;
      const ordered = [...filtered].reverse();

      setMessages(prev => {
        // Remove optimistic messages that are now confirmed
        const confirmedIds = new Set(ordered.map(m => m.id));
        const kept = prev.filter(m => m.isOptimistic && !confirmedIds.has(m.id));
        const merged = [...ordered, ...kept];
        // Scroll to bottom only if we got new messages
        const hadNew = ordered.length > prev.filter(m => !m.isOptimistic).length;
        if (hadNew) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
        return merged;
      });
    } catch (e) {
      console.error('[CommunityChatView] fetchMessages error', e);
    }
  }, [communityId, channelId, myAddress]);

  useEffect(() => {
    fetchMessages(false);
    pollIntervalRef.current = setInterval(() => fetchMessages(true), 2500);
    return () => clearInterval(pollIntervalRef.current);
  }, [fetchMessages]);

  // ─── SEND MESSAGE ────────────────────────────────────────────────────────
  const executeSend = useCallback(async (text: string) => {
    if (!text.trim() || !myAddress) return;
    setSending(true);

    const optId = `opt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    optimisticIds.current.add(optId);
    const optimistic: Message = {
      id: optId,
      authorAddress: myAddress.toLowerCase(),
      content: text,
      createdAt: new Date().toISOString(),
      channelId: channelId || undefined,
      isOptimistic: true
    };

    setMessages(prev => [...prev, optimistic]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    setReplyTo(null);

    try {
      const res = await fetch('/api/chat/communities/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-web3-address': myAddress,
          'x-verified-session-address': myAddress,
        },
        body: JSON.stringify({
          communityId,
          channelId: channelId || undefined,
          authorAddress: myAddress.toLowerCase(),
          content: text,
          contentHtml: text,
          plainText: text,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to send message. Check you are a member.');
        setMessages(prev => prev.filter(m => m.id !== optId));
        optimisticIds.current.delete(optId);
      } else {
        // Refresh immediately to get real ID
        await fetchMessages(true);
        setMessages(prev => prev.filter(m => m.id !== optId));
        optimisticIds.current.delete(optId);
      }
    } catch {
      toast.error('Network error. Try again.');
      setMessages(prev => prev.filter(m => m.id !== optId));
      optimisticIds.current.delete(optId);
    } finally {
      setSending(false);
    }
  }, [communityId, channelId, myAddress, fetchMessages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const txt = input.trim();
    if (!txt) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await executeSend(txt);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e as any);
    }
  };

  const autoGrow = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  // ─── FILE UPLOAD ─────────────────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error('File exceeds 20 MB limit'); return; }
    const reader = new FileReader();
    reader.onload = () => executeSend(`__MEDIA__${file.type}__::${reader.result}`);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ─── LOCATION ────────────────────────────────────────────────────────────
  const sendLocation = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
    toast.info('Getting location...');
    navigator.geolocation.getCurrentPosition(
      pos => executeSend(`[LOCATION]${pos.coords.latitude},${pos.coords.longitude}`),
      () => toast.error('Location permission denied')
    );
  };

  const addr = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;
  const isMe = (m: Message) => m.authorAddress?.toLowerCase() === myAddress?.toLowerCase();

  const AVATAR_COLORS = ['#25D366','#007AFF','#FF9500','#FF3B30','#AF52DE','#FF2D55','#34C759'];
  const avatarColor = (a: string) => AVATAR_COLORS[(parseInt(a.slice(2, 4), 16) || 0) % AVATAR_COLORS.length];

  return (
    <div className="flex flex-col h-full bg-[#F2F2F7] overflow-hidden">
      {/* ── CHANNEL HEADER ── */}
      {(channelId || communityName) && (
        <div className="px-4 py-2.5 bg-white/90 border-b border-black/5 flex items-center gap-2 shrink-0">
          <Hash size={15} className="text-black/30" />
          <span className="text-[13px] font-bold text-[#1C1C1E]/70">
            {communityName || 'Channel'}
          </span>
        </div>
      )}

      {/* ── MESSAGE LIST ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5 pb-2" onClick={() => setContextMenu(null)}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center opacity-40 py-16">
            <div className="w-14 h-14 rounded-full bg-[#25D366]/10 flex items-center justify-center mb-3">
              <Send size={20} className="text-[#25D366]" />
            </div>
            <p className="text-[15px] font-bold text-[#1C1C1E]">No messages yet</p>
            <p className="text-[13px] text-black/50 mt-1">Start the conversation</p>
          </div>
        )}

        {messages.map(msg => {
          const me = isMe(msg);
          const isSystem = msg.content.startsWith('__SYSTEM__');
          if (isSystem) return (
            <div key={msg.id} className="flex justify-center py-1">
              <span className="text-[11px] text-black/40 bg-black/[0.04] rounded-full px-3 py-1">
                {msg.content.replace('__SYSTEM__', '')}
              </span>
            </div>
          );

          return (
            <div
              key={msg.id}
              className={`flex gap-2 items-end group ${me ? 'flex-row-reverse' : ''}`}
              onContextMenu={e => { e.preventDefault(); setContextMenu({ msg, x: e.clientX, y: e.clientY }); }}
            >
              {/* Avatar */}
              {!me && (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-black shrink-0 mb-0.5"
                  style={{ background: avatarColor(msg.authorAddress || '0x00') }}
                >
                  {(msg.authorAddress || '??').slice(2, 4).toUpperCase()}
                </div>
              )}

              {/* Bubble */}
              <div className={`flex flex-col max-w-[75%] ${me ? 'items-end' : 'items-start'}`}>
                {!me && (
                  <p className="text-[10px] font-mono text-black/30 mb-0.5 px-1">
                    {addr(msg.authorAddress)}
                  </p>
                )}
                <div
                  className={`relative rounded-2xl px-3.5 py-2.5 shadow-sm ${me
                    ? `bg-[#25D366] text-white ${msg.isOptimistic ? 'opacity-70' : ''}`
                    : 'bg-white text-[#1C1C1E] border border-black/[0.06]'
                  }`}
                >
                  {replyTo?.id === msg.id && (
                    <div className="text-[10px] opacity-60 mb-1 border-l-2 border-current pl-2">
                      {addr(replyTo.authorAddress)}: {replyTo.content.slice(0, 40)}...
                    </div>
                  )}
                  <MessageContent content={msg.content} />
                  <div className={`flex items-center gap-1.5 mt-1 ${me ? 'justify-end' : 'justify-start'}`}>
                    <span className={`text-[10px] ${me ? 'text-white/60' : 'text-black/30'}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {me && msg.isOptimistic && <div className="w-2.5 h-2.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                  </div>
                </div>
              </div>

              {/* Quick Actions (visible on hover) */}
              <div className={`hidden group-hover:flex items-center gap-0.5 mb-1 ${me ? 'mr-1' : 'ml-1'}`}>
                <button onClick={() => setReplyTo(msg)} className="p-1.5 rounded-lg hover:bg-black/5 text-black/30 hover:text-black/60 transition-colors">
                  <Reply size={13} />
                </button>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* ── CONTEXT MENU ── */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            style={{ position: 'fixed', top: contextMenu.y, left: Math.min(contextMenu.x, window.innerWidth - 180), zIndex: 9999 }}
            className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-black/8 py-1.5 w-44 overflow-hidden"
          >
            {[
              { label: 'Reply', icon: Reply, fn: () => { setReplyTo(contextMenu.msg); setContextMenu(null); } },
              { label: 'Copy text', icon: CheckCircle, fn: () => { navigator.clipboard.writeText(contextMenu.msg.content); toast.success('Copied!'); setContextMenu(null); } },
            ].map(({ label, icon: Icon, fn }) => (
              <button key={label} onClick={fn} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-black/5 text-left transition-colors">
                <Icon size={15} className="text-black/40" />
                <span className="text-[13px] font-medium text-[#1C1C1E]">{label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── REPLY PREVIEW BAR ── */}
      <AnimatePresence>
        {replyTo && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="px-4 py-2 bg-[#25D366]/5 border-t border-[#25D366]/15 flex items-center gap-3 shrink-0"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-[#25D366]">Replying to {addr(replyTo.authorAddress)}</p>
              <p className="text-[12px] text-black/50 truncate">{replyTo.content.slice(0, 60)}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="p-1.5 text-black/30 hover:text-black/60 rounded-lg hover:bg-black/5">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── INPUT AREA ── */}
      <div className="px-3 py-2.5 bg-white border-t border-black/5 shrink-0 pb-[env(safe-area-inset-bottom,10px)]">
        {/* App Drawer */}
        <AnimatePresence>
          {showAppDrawer && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-2">
              <div className="grid grid-cols-5 gap-3 py-3 px-2">
                {[
                  { icon: MapPin, label: 'Location', color: 'bg-[#25D366]', action: () => { setShowAppDrawer(false); sendLocation(); } },
                  { icon: CircleDollarSign, label: 'Crypto', color: 'bg-[#007AFF]', action: () => { setShowAppDrawer(false); setCryptoRecipient(''); setShowRecipientSheet(true); } },
                  { icon: ImgIcon, label: 'Photo', color: 'bg-[#FF9500]', action: () => { setShowAppDrawer(false); fileInputRef.current?.click(); } },
                  { icon: Smile, label: 'Sticker', color: 'bg-orange-500', action: () => { setShowAppDrawer(false); executeSend('[STICKER]:fire'); } },
                  { icon: BarChart2, label: 'Poll', color: 'bg-purple-500', action: () => { setShowAppDrawer(false); setShowPollCreator(true); } },
                ].map(({ icon: Icon, label, color, action }) => (
                  <button key={label} onClick={action} className="flex flex-col items-center gap-1.5">
                    <div className={`w-12 h-12 ${color} text-white rounded-2xl flex items-center justify-center shadow-sm`}><Icon size={22} /></div>
                    <span className="text-[10px] font-semibold text-[#1C1C1E]">{label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSend} className="flex items-end gap-2">
          <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept="image/*,video/*,application/pdf" />

          <button
            type="button"
            onClick={() => setShowAppDrawer(v => !v)}
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${showAppDrawer ? 'bg-[#25D366] text-white' : 'bg-[#F2F2F7] text-[#25D366] hover:bg-[#E5E5EA]'}`}
          >
            <Plus size={20} />
          </button>

          {recordingVoice ? (
            <div className="flex-1 flex items-center bg-[#F2F2F7] rounded-3xl min-h-[44px] px-3">
              <VoiceRecorder onSend={async b64 => { setRecordingVoice(false); await executeSend(b64); }} onCancel={() => setRecordingVoice(false)} />
            </div>
          ) : (
            <div className="flex-1 flex items-end bg-[#F2F2F7] rounded-3xl px-3.5 py-2.5 gap-2 min-h-[44px]">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={autoGrow}
                onKeyDown={handleKeyDown}
                placeholder="Message..."
                disabled={sending}
                rows={1}
                className="flex-1 bg-transparent outline-none text-[14px] text-[#1C1C1E] placeholder:text-black/30 resize-none leading-relaxed max-h-[120px] overflow-y-auto disabled:opacity-50"
                style={{ height: 'auto' }}
              />
              {!input.trim() ? (
                <button type="button" onClick={() => setRecordingVoice(true)} className="text-black/30 hover:text-[#25D366] transition-colors shrink-0">
                  <Mic size={20} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={sending}
                  className="w-8 h-8 bg-[#25D366] text-white rounded-full flex items-center justify-center disabled:opacity-40 hover:bg-[#128C7E] transition-colors shrink-0"
                >
                  <Send size={15} className="-ml-0.5" />
                </button>
              )}
            </div>
          )}
        </form>
      </div>

      {/* ── CRYPTO RECIPIENT SHEET ── */}
      <AnimatePresence>
        {showRecipientSheet && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end"
            onClick={e => { if (e.target === e.currentTarget) setShowRecipientSheet(false); }}
          >
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="w-full bg-white rounded-t-3xl p-6 flex flex-col gap-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-[18px] font-black text-[#1C1C1E]">Send Crypto</h3>
                <button onClick={() => setShowRecipientSheet(false)} className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-black/40 hover:text-black"><X size={16} /></button>
              </div>
              <p className="text-[13px] text-black/50">Enter the recipient wallet address (0x...)</p>
              <input value={cryptoRecipient} onChange={e => setCryptoRecipient(e.target.value)}
                placeholder="0x..." className="w-full px-4 py-3 rounded-2xl border border-black/10 text-[15px] font-mono outline-none focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20"
                spellCheck={false} autoComplete="off"
              />
              <button
                disabled={!/^0x[0-9a-fA-F]{40}$/.test(cryptoRecipient.trim())}
                onClick={() => { setShowRecipientSheet(false); setShowCryptoModal(true); }}
                className="w-full py-3.5 bg-[#25D366] disabled:bg-[#25D366]/40 text-white font-bold rounded-2xl transition-all active:scale-[0.98]"
              >
                Continue
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CRYPTO MODAL ── */}
      {showCryptoModal && (
        <NativeCryptoSendModal
          isOpen={showCryptoModal}
          recipientAddress={cryptoRecipient}
          onClose={() => setShowCryptoModal(false)}
          onSent={(txHash, amount, token) => {
            executeSend(`__PAYMENT__::${JSON.stringify({ amount, token, txHash, to: cryptoRecipient })}`);
            setShowCryptoModal(false);
          }}
        />
      )}

      {/* ── POLL CREATOR ── */}
      <AnimatePresence>
        {showPollCreator && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowPollCreator(false); }}
          >
            <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
              className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl flex flex-col gap-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-[17px] font-black text-[#1C1C1E]">Create Poll</h3>
                <button onClick={() => setShowPollCreator(false)} className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-black/40"><X size={16} /></button>
              </div>
              <input type="text" placeholder="Ask a question..." value={pollQuestion} onChange={e => setPollQuestion(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-black/10 text-[14px] outline-none focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/15"
              />
              <div className="flex flex-col gap-2">
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <input type="text" placeholder={`Option ${i + 1}`} value={opt}
                      onChange={e => setPollOptions(prev => prev.map((o, j) => j === i ? e.target.value : o))}
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-black/10 text-[13px] outline-none focus:border-[#25D366]"
                    />
                    {pollOptions.length > 2 && (
                      <button onClick={() => setPollOptions(prev => prev.filter((_, j) => j !== i))} className="text-black/30 hover:text-red-500"><X size={14} /></button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 5 && (
                  <button onClick={() => setPollOptions(p => [...p, ''])} className="text-[13px] font-bold text-[#25D366] hover:text-[#128C7E] text-left">+ Add option</button>
                )}
              </div>
              <button
                onClick={() => {
                  const validOpts = pollOptions.filter(o => o.trim());
                  if (!pollQuestion.trim() || validOpts.length < 2) { toast.error('Add a question and at least 2 options'); return; }
                  executeSend(`__POLL__poll_${Date.now()}__::${pollQuestion.trim()}__::${validOpts.join('|')}`);
                  setShowPollCreator(false); setPollQuestion(''); setPollOptions(['', '']);
                }}
                className="w-full py-3.5 bg-[#25D366] text-white font-bold rounded-2xl hover:bg-[#128C7E] transition-colors"
              >
                Send Poll
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
