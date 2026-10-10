'use client';
import React, {
  useState, useEffect, useRef, useCallback, useMemo
} from 'react';
import {
  Send, Plus, MapPin, CircleDollarSign, Smile, BarChart2,
  Image as ImgIcon, Mic, Hash, CheckCircle, X, Reply,
  Play, Pause, Pin, Search, Users, ChevronDown, Film,
  MoreVertical, Copy, Trash2, ThumbsUp, Heart, Laugh,
  AlertCircle, Lock, Volume2, Globe
} from 'lucide-react';
import { toast } from 'sonner';
import { NativeCryptoSendModal } from './NativeCryptoSendModal';
import { AnimatePresence, motion } from 'framer-motion';
import DOMPurify from 'dompurify';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function safeHtml(raw: string): string {
  if (typeof window === 'undefined') return raw;
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: ['b','i','u','s','em','strong','a','p','br','ul','ol','li',
      'blockquote','code','pre','h1','h2','h3','img','mark','span'],
    ALLOWED_ATTR: ['href','src','alt','class','target','rel'],
  });
}
const addr = (a: string) => `${(a||'0x??').slice(0,6)}...${(a||'').slice(-4)}`;
const fmt2 = (s: number) =>
  `${Math.floor(s/60).toString().padStart(2,'0')}:${Math.floor(s%60).toString().padStart(2,'0')}`;
const AVATAR_COLORS = ['#25D366','#007AFF','#FF9500','#FF3B30','#AF52DE','#FF2D55','#34C759','#5AC8FA'];
const avatarColor = (a: string) => AVATAR_COLORS[(parseInt((a||'0x0').slice(2,4),16)||0) % AVATAR_COLORS.length];

// ─── Types ────────────────────────────────────────────────────────────────────
interface Msg {
  id: string;
  authorAddress: string;
  content: string;
  contentHtml?: string;
  createdAt: string;
  channelId?: string;
  isOptimistic?: boolean;
  isPinned?: boolean;
  reactions?: Record<string, string[]>; // emoji -> addresses[]
}

interface CommunityChatViewProps {
  communityId: string;
  channelId?: string | null;
  myAddress: string;
  communityName?: string;
  community?: any;
}

// ─── QUICK EMOJI REACTIONS ────────────────────────────────────────────────────
const QUICK_EMOJIS = ['👍','❤️','😂','😮','😢','🔥','🚀','👏','💯','🎉'];

function ReactionPicker({ onPick, onClose }: { onPick:(e:string)=>void; onClose:()=>void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 8 }}
      className="absolute bottom-full mb-2 left-0 z-50 bg-white rounded-2xl shadow-2xl border border-black/8 p-2 flex gap-1"
      onClick={e => e.stopPropagation()}
    >
      {QUICK_EMOJIS.map(e => (
        <button key={e} onClick={() => { onPick(e); onClose(); }}
          className="w-8 h-8 flex items-center justify-center text-[18px] hover:bg-black/5 rounded-xl transition-colors active:scale-90">
          {e}
        </button>
      ))}
    </motion.div>
  );
}

// ─── VOICE RECORDER ──────────────────────────────────────────────────────────
function VoiceRecorder({ onSend, onCancel }: { onSend:(b64:string)=>void; onCancel:()=>void }) {
  const [secs, setSecs] = useState(0);
  const chunksRef = useRef<Blob[]>([]);
  const mrRef = useRef<MediaRecorder|null>(null);

  useEffect(() => {
    let stream: MediaStream;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mr = new MediaRecorder(stream);
        mrRef.current = mr;
        mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        mr.start(200);
      } catch { toast.error('Microphone access denied'); onCancel(); }
    })();
    const t = setInterval(() => setSecs(s => s + 1), 1000);
    return () => { clearInterval(t); mrRef.current?.stop(); stream?.getTracks().forEach(t => t.stop()); };
  }, []);

  const finish = () => {
    mrRef.current?.stop();
    setTimeout(() => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const r = new FileReader();
      r.onload = () => onSend(`__AUDIO__${r.result}`);
      r.readAsDataURL(blob);
    }, 300);
  };

  return (
    <div className="flex-1 flex items-center gap-3 px-2 py-1">
      <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
      <span className="text-[13px] font-mono font-bold text-[#1C1C1E] shrink-0">{fmt2(secs)}</span>
      <div className="flex-1 h-1.5 bg-red-100 rounded-full overflow-hidden">
        <div className="h-full bg-red-400 rounded-full transition-all" style={{ width: `${Math.min(100, secs*2)}%` }} />
      </div>
      <button onClick={onCancel} className="p-2 rounded-full hover:bg-black/5 text-black/40 shrink-0"><X size={16}/></button>
      <button onClick={finish} className="w-9 h-9 bg-[#25D366] text-white rounded-full flex items-center justify-center shadow hover:bg-[#128C7E] shrink-0">
        <Send size={14} className="-ml-0.5" />
      </button>
    </div>
  );
}

// ─── AUDIO PLAYER ─────────────────────────────────────────────────────────────
function AudioPlayer({ src, mine }: { src: string; mine: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dur, setDur] = useState(0);
  const ref = useRef<HTMLAudioElement>(null);
  const toggle = () => {
    if (!ref.current) return;
    playing ? ref.current.pause() : ref.current.play();
    setPlaying(p => !p);
  };
  return (
    <div className="flex items-center gap-2.5 min-w-[200px] max-w-[260px]">
      <audio ref={ref} src={src} onTimeUpdate={e => setProgress((e.currentTarget.currentTime/e.currentTarget.duration)*100||0)}
        onLoadedMetadata={e => setDur(e.currentTarget.duration)} onEnded={() => setPlaying(false)} className="hidden" />
      <button onClick={toggle} className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors ${mine ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-[#25D366]/15 text-[#25D366] hover:bg-[#25D366]/25'}`}>
        {playing ? <Pause size={15}/> : <Play size={15} className="ml-0.5"/>}
      </button>
      <div className="flex-1">
        <div className={`h-1 rounded-full overflow-hidden ${mine ? 'bg-white/30' : 'bg-black/10'}`}>
          <div className={`h-full rounded-full transition-all ${mine ? 'bg-white' : 'bg-[#25D366]'}`} style={{ width: `${progress}%` }} />
        </div>
        <p className={`text-[10px] mt-0.5 font-mono ${mine ? 'text-white/60' : 'text-black/40'}`}>{fmt2((progress/100)*dur)} / {fmt2(dur)}</p>
      </div>
    </div>
  );
}

// ─── MESSAGE CONTENT RENDERER ─────────────────────────────────────────────────
function MessageContent({ content, mine }: { content: string; mine: boolean }) {
  if (content.startsWith('__PAYMENT__::')) {
    try {
      const d = JSON.parse(content.replace('__PAYMENT__::', ''));
      return (
        <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 min-w-[220px] ${mine ? 'bg-white/15 border border-white/20' : 'bg-[#25D366]/10 border border-[#25D366]/20'}`}>
          <div className="w-9 h-9 rounded-full bg-[#25D366]/20 flex items-center justify-center shrink-0">
            <CircleDollarSign size={18} className="text-[#25D366]" />
          </div>
          <div>
            <p className={`text-[13px] font-black ${mine ? 'text-white' : 'text-[#1C1C1E]'}`}>{d.amount} {d.token}</p>
            <a href={`https://etherscan.io/tx/${d.txHash}`} target="_blank" rel="noopener noreferrer"
              className="text-[11px] text-[#25D366] font-medium hover:underline">View on Etherscan ↗</a>
          </div>
          <CheckCircle size={16} className="text-[#25D366] ml-auto shrink-0" />
        </div>
      );
    } catch { return <span className="text-[14px]">{content}</span>; }
  }

  if (content.startsWith('__AUDIO__')) return <AudioPlayer src={content.replace('__AUDIO__', '')} mine={mine} />;

  if (content.startsWith('[LOCATION]')) {
    const [lat, lon] = content.replace('[LOCATION]', '').split(',');
    return (
      <a href={`https://maps.google.com/?q=${lat},${lon}`} target="_blank" rel="noopener noreferrer"
        className={`flex items-center gap-2 text-[13px] font-semibold hover:underline ${mine ? 'text-white' : 'text-[#25D366]'}`}>
        <MapPin size={14} /> Location shared ↗
      </a>
    );
  }

  if (content.startsWith('__MEDIA__')) {
    const rest = content.replace('__MEDIA__', '');
    const sep = rest.indexOf('__::');
    if (sep !== -1) {
      const mime = rest.substring(0, sep);
      const data = rest.substring(sep + 4);
      if (mime.startsWith('image/')) return <img src={data} alt="attachment" className="max-w-[260px] rounded-xl border border-black/5" loading="lazy" />;
      if (mime.startsWith('video/')) return <video src={data} controls className="max-w-[260px] rounded-xl" />;
    }
  }

  if (content.startsWith('__POLL__')) {
    const parts = content.split('__::');
    const question = parts[1] || '';
    const options = (parts[2] || '').split('|').filter(Boolean);
    const [voted, setVoted] = useState<number|null>(null);
    const [votes, setVotes] = useState(() => options.map(() => Math.floor(Math.random()*5)));
    const total = votes.reduce((a,b)=>a+b, 0);
    return (
      <div className="min-w-[200px] max-w-[280px]">
        <p className={`text-[14px] font-bold mb-2.5 ${mine ? 'text-white' : 'text-[#1C1C1E]'}`}>{question}</p>
        <div className="space-y-1.5">
          {options.map((o, i) => {
            const pct = total > 0 ? Math.round((votes[i]/total)*100) : 0;
            const isVoted = voted === i;
            return (
              <button key={i} onClick={() => { setVoted(i); setVotes(prev => prev.map((v,j)=>j===i?v+1:v)); }}
                className={`relative w-full text-left text-[12px] font-semibold px-3 py-2 rounded-xl overflow-hidden transition-all ${isVoted ? (mine ? 'text-white' : 'text-[#25D366]') : mine ? 'text-white/80' : 'text-[#1C1C1E]/70'}`}>
                <div className={`absolute inset-0 rounded-xl transition-all ${isVoted ? (mine?'bg-white/20':'bg-[#25D366]/15') : 'bg-black/5'}`} style={{width:`${voted !== null ? pct : 0}%`}} />
                <div className="relative flex justify-between">
                  <span>{o}</span>
                  {voted !== null && <span>{pct}%</span>}
                </div>
              </button>
            );
          })}
        </div>
        <p className={`text-[10px] mt-2 ${mine ? 'text-white/40' : 'text-black/30'}`}>{total} votes</p>
      </div>
    );
  }

  if (content.startsWith('[STICKER]:')) {
    const name = content.replace('[STICKER]:', '');
    const stickers: Record<string,string> = { fire:'🔥', heart:'❤️', clap:'👏', '100':'💯', rocket:'🚀', wave:'👋', thumbsup:'👍', cool:'😎' };
    return <span className="text-4xl select-none">{stickers[name] || '🎭'}</span>;
  }

  if (content.includes('<') && content.includes('>') && content.length > 20) {
    return <div className="prose prose-sm max-w-none text-[14px] leading-relaxed"
      dangerouslySetInnerHTML={{ __html: safeHtml(content) }} />;
  }

  return <span className="text-[14px] leading-[1.45] whitespace-pre-wrap break-words">{content}</span>;
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export function CommunityChatView({
  communityId, channelId, myAddress, communityName, community
}: CommunityChatViewProps) {
  const [messages, setMessages] = useState<Msg[]>([]);
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
  const [replyTo, setReplyTo] = useState<Msg|null>(null);
  const [contextMenu, setContextMenu] = useState<{msg:Msg;x:number;y:number}|null>(null);
  const [emojiPickerFor, setEmojiPickerFor] = useState<string|null>(null);
  const [localReactions, setLocalReactions] = useState<Record<string,Record<string,boolean>>>({});
  const [pinnedMsgs, setPinnedMsgs] = useState<Msg[]>([]);
  const [showPinnedBanner, setShowPinnedBanner] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const optimisticIds = useRef<Set<string>>(new Set());
  const prevCount = useRef(0);

  const isMe = (m: Msg) => m.authorAddress?.toLowerCase() === myAddress?.toLowerCase();

  // ─── SCROLL DETECTION ──────────────────────────────────────────────────────
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setIsAtBottom(atBottom);
    if (atBottom) setUnreadCount(0);
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    setUnreadCount(0);
  }, []);

  // ─── FETCH MESSAGES ─────────────────────────────────────────────────────────
  const fetchMessages = useCallback(async (silent = true) => {
    if (!communityId) return;
    try {
      const url = `/api/chat/communities/posts?communityId=${communityId}${channelId ? `&channelId=${channelId}` : ''}`;
      const res = await fetch(url, {
        headers: { 'x-web3-address': myAddress, 'x-verified-session-address': myAddress },
      });
      if (!res.ok) return;
      const data = await res.json();
      const raw: Msg[] = (data.posts || []);
      const chatMsgs = raw.filter(p => !p.title);
      const filtered = channelId
        ? chatMsgs.filter(m => m.channelId === channelId || !m.channelId)
        : chatMsgs;
      const ordered = [...filtered].reverse();

      setMessages(prev => {
        const confirmedIds = new Set(ordered.map(m => m.id));
        const kept = prev.filter(m => m.isOptimistic && !confirmedIds.has(m.id));
        const merged = [...ordered, ...kept];

        // Check if new messages arrived
        const realCount = ordered.length;
        if (realCount > prevCount.current) {
          if (!isAtBottom) {
            setUnreadCount(c => c + (realCount - prevCount.current));
          } else {
            setTimeout(() => scrollToBottom(true), 50);
          }
        }
        prevCount.current = realCount;
        return merged;
      });

      // Update pinned
      const pinned = ordered.filter(m => m.isPinned);
      if (pinned.length > 0) setPinnedMsgs(pinned);
    } catch (e) {
      console.error('[CommunityChatView] fetchMessages error', e);
    }
  }, [communityId, channelId, myAddress, isAtBottom, scrollToBottom]);

  useEffect(() => {
    fetchMessages(false);
    setTimeout(() => scrollToBottom(false), 150);
    pollIntervalRef.current = setInterval(() => fetchMessages(true), 3000);
    return () => clearInterval(pollIntervalRef.current);
  }, [fetchMessages]);

  // ─── SEND MESSAGE ───────────────────────────────────────────────────────────
  const executeSend = useCallback(async (text: string) => {
    if (!text.trim() || !myAddress) return;
    setSending(true);

    const optId = `opt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    optimisticIds.current.add(optId);
    const optimistic: Msg = {
      id: optId,
      authorAddress: myAddress.toLowerCase(),
      content: text,
      createdAt: new Date().toISOString(),
      channelId: channelId || undefined,
      isOptimistic: true,
    };

    setMessages(prev => [...prev, optimistic]);
    setTimeout(() => scrollToBottom(true), 60);
    setReplyTo(null);
    setShowAppDrawer(false);

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
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error || 'Failed to send. Make sure you are a member.');
        setMessages(prev => prev.filter(m => m.id !== optId));
        optimisticIds.current.delete(optId);
      } else {
        // Immediately refresh to replace optimistic with real
        await fetchMessages(true);
        setMessages(prev => prev.filter(m => m.id !== optId));
        optimisticIds.current.delete(optId);
      }
    } catch {
      toast.error('Network error. Please try again.');
      setMessages(prev => prev.filter(m => m.id !== optId));
      optimisticIds.current.delete(optId);
    } finally {
      setSending(false);
    }
  }, [communityId, channelId, myAddress, fetchMessages, scrollToBottom]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const txt = input.trim();
    if (!txt || sending) return;
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
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
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };

  // ─── FILE UPLOAD ────────────────────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error('File exceeds 20 MB limit'); return; }
    const reader = new FileReader();
    reader.onload = () => executeSend(`__MEDIA__${file.type}__::${reader.result}`);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ─── LOCATION ───────────────────────────────────────────────────────────────
  const sendLocation = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
    toast.info('Getting your location...');
    navigator.geolocation.getCurrentPosition(
      pos => executeSend(`[LOCATION]${pos.coords.latitude},${pos.coords.longitude}`),
      () => toast.error('Location permission denied')
    );
  };

  // ─── LOCAL REACTIONS ────────────────────────────────────────────────────────
  const toggleReaction = (msgId: string, emoji: string) => {
    setLocalReactions(prev => {
      const cur = prev[msgId] || {};
      const next = { ...cur, [emoji]: !cur[emoji] };
      return { ...prev, [msgId]: next };
    });
  };

  // ─── FILTER MESSAGES BY SEARCH ──────────────────────────────────────────────
  const displayMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter(m => m.content.toLowerCase().includes(q));
  }, [messages, searchQuery]);

  // ─── GROUPED MESSAGES (group consecutive from same author) ──────────────────
  const groupedMessages = useMemo(() => {
    const groups: { key: string; msgs: Msg[] }[] = [];
    let currentGroup: Msg[] | null = null;
    let currentAuthor = '';
    let currentSide = false;

    displayMessages.forEach(msg => {
      const me = isMe(msg);
      if (!currentGroup || currentAuthor !== msg.authorAddress || currentSide !== me) {
        currentGroup = [msg];
        currentAuthor = msg.authorAddress;
        currentSide = me;
        groups.push({ key: msg.id, msgs: currentGroup });
      } else {
        currentGroup.push(msg);
      }
    });
    return groups;
  }, [displayMessages]);

  return (
    // The key to stable layout: explicit flex-col with overflow-hidden on container
    <div className="flex flex-col bg-[#F2F2F7] overflow-hidden" style={{ height: '100%', minHeight: 0 }}>

      {/* ── CHANNEL HEADER ── */}
      <div className="px-4 py-2 bg-white/95 backdrop-blur-md border-b border-black/[0.06] flex items-center gap-2 shrink-0 z-10">
        <Hash size={14} className="text-black/30 shrink-0" />
        <span className="text-[13px] font-bold text-[#1C1C1E]/70 flex-1 min-w-0 truncate">
          {communityName || 'Channel'}
        </span>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowSearch(v => !v)}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${showSearch ? 'bg-[#25D366] text-white' : 'text-black/30 hover:text-black/60 hover:bg-black/5'}`}>
            <Search size={13} />
          </button>
          <button onClick={() => fetchMessages(false)}
            className="w-7 h-7 rounded-full flex items-center justify-center text-black/30 hover:text-black/60 hover:bg-black/5 transition-colors">
            <Globe size={13} />
          </button>
        </div>
      </div>

      {/* ── SEARCH BAR ── */}
      <AnimatePresence>
        {showSearch && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-white border-b border-black/[0.06] shrink-0">
            <div className="px-4 py-2 flex items-center gap-2">
              <Search size={14} className="text-black/30 shrink-0" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search messages..."
                className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-black/30" autoFocus />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-black/30 hover:text-black/60"><X size={13}/></button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PINNED BANNER ── */}
      <AnimatePresence>
        {pinnedMsgs.length > 0 && showPinnedBanner && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden shrink-0">
            <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 flex items-center gap-2">
              <Pin size={12} className="text-amber-600 shrink-0" />
              <span className="text-[11px] font-bold text-amber-700 flex-1 truncate">
                {pinnedMsgs[0]?.content?.slice(0,50)}…
              </span>
              <button onClick={() => setShowPinnedBanner(false)}
                className="text-amber-400 hover:text-amber-600 ml-1 shrink-0">
                <X size={11}/>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MESSAGE LIST — flex-1 + overflow-y-auto is the critical layout fix ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{ minHeight: 0 }}
        onClick={() => { setContextMenu(null); setEmojiPickerFor(null); }}
      >
        <div className="px-3 py-4 space-y-0.5">
          {/* Empty state */}
          {displayMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-full bg-[#25D366]/10 flex items-center justify-center mb-4">
                <Send size={22} className="text-[#25D366]" />
              </div>
              <p className="text-[15px] font-bold text-[#1C1C1E]">
                {searchQuery ? 'No messages found' : 'Start the conversation'}
              </p>
              <p className="text-[13px] text-black/40 mt-1">
                {searchQuery ? 'Try a different search term' : 'Be the first to send a message'}
              </p>
            </div>
          )}

          {/* Message groups */}
          {groupedMessages.map(({ key, msgs }) => {
            const firstMsg = msgs[0];
            const me = isMe(firstMsg);

            return (
              <div key={key} className={`flex flex-col gap-0.5 mb-2 ${me ? 'items-end' : 'items-start'}`}>
                {/* Author label (only once per group) */}
                {!me && (
                  <div className="flex items-center gap-1.5 mb-0.5 ml-9">
                    <span className="text-[10px] font-mono font-semibold text-black/40">
                      {addr(firstMsg.authorAddress)}
                    </span>
                  </div>
                )}

                {msgs.map((msg, idx) => {
                  const isSystem = msg.content.startsWith('__SYSTEM__');
                  if (isSystem) return (
                    <div key={msg.id} className="w-full flex justify-center py-1">
                      <span className="text-[11px] text-black/40 bg-black/[0.05] rounded-full px-3 py-1">
                        {msg.content.replace('__SYSTEM__', '')}
                      </span>
                    </div>
                  );

                  const isFirst = idx === 0;
                  const isLast = idx === msgs.length - 1;
                  const myReactions = localReactions[msg.id] || {};
                  const hasReactions = Object.keys(myReactions).some(k => myReactions[k]);

                  return (
                    <div key={msg.id} className={`flex items-end gap-1.5 max-w-[80%] group ${me ? 'flex-row-reverse' : 'flex-row'}`}
                      onContextMenu={e => { e.preventDefault(); setContextMenu({ msg, x: e.clientX, y: e.clientY }); }}>

                      {/* Avatar — only show for first message in group */}
                      <div className={`w-7 shrink-0 ${me ? 'hidden' : ''}`}>
                        {isFirst ? (
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-black"
                            style={{ background: avatarColor(msg.authorAddress || '0x00') }}>
                            {(msg.authorAddress || '??').slice(2,4).toUpperCase()}
                          </div>
                        ) : <div className="w-7" />}
                      </div>

                      {/* Bubble + reactions */}
                      <div className={`flex flex-col ${me ? 'items-end' : 'items-start'}`}>
                        {/* Reply preview */}
                        {replyTo?.id === msg.id && (
                          <div className={`text-[10px] opacity-60 mb-1 border-l-2 pl-2 ${me ? 'border-white/50 text-white' : 'border-[#25D366] text-[#1C1C1E]'}`}>
                            {addr(replyTo.authorAddress)}: {replyTo.content.slice(0,40)}
                          </div>
                        )}

                        <div className="relative">
                          {/* Emoji picker */}
                          <AnimatePresence>
                            {emojiPickerFor === msg.id && (
                              <ReactionPicker
                                onPick={e => toggleReaction(msg.id, e)}
                                onClose={() => setEmojiPickerFor(null)}
                              />
                            )}
                          </AnimatePresence>

                          {/* Bubble */}
                          <div className={`relative px-3.5 py-2 shadow-sm select-text
                            ${me
                              ? `bg-[#25D366] text-white ${msg.isOptimistic ? 'opacity-60' : ''}`
                              : 'bg-white text-[#1C1C1E] border border-black/[0.06]'
                            }
                            ${isFirst && isLast ? 'rounded-2xl' :
                              isFirst ? me ? 'rounded-2xl rounded-br-md' : 'rounded-2xl rounded-bl-md' :
                              isLast ? me ? 'rounded-2xl rounded-tr-md' : 'rounded-2xl rounded-tl-md' :
                              me ? 'rounded-l-2xl rounded-r-md' : 'rounded-r-2xl rounded-l-md'
                            }`}>
                            <MessageContent content={msg.content} mine={me} />

                            {/* Time + status */}
                            <div className={`flex items-center gap-1 mt-1 ${me ? 'justify-end' : 'justify-start'}`}>
                              <span className={`text-[10px] ${me ? 'text-white/55' : 'text-black/30'}`}>
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
                              </span>
                              {me && msg.isOptimistic && (
                                <div className="w-2.5 h-2.5 border-[1.5px] border-white/40 border-t-white rounded-full animate-spin" />
                              )}
                              {me && !msg.isOptimistic && (
                                <CheckCircle size={11} className="text-white/55" />
                              )}
                            </div>
                          </div>

                          {/* Hover actions */}
                          <div className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${me ? '-left-16' : '-right-16'}`}>
                            <button onClick={() => setEmojiPickerFor(id => id === msg.id ? null : msg.id)}
                              className="w-6 h-6 rounded-full bg-white shadow border border-black/8 flex items-center justify-center text-black/40 hover:text-black/70 transition-colors">
                              <Smile size={11}/>
                            </button>
                            <button onClick={() => setReplyTo(msg)}
                              className="w-6 h-6 rounded-full bg-white shadow border border-black/8 flex items-center justify-center text-black/40 hover:text-black/70 transition-colors">
                              <Reply size={11}/>
                            </button>
                            <button onClick={() => setContextMenu({ msg, x: 0, y: 0 })}
                              className="w-6 h-6 rounded-full bg-white shadow border border-black/8 flex items-center justify-center text-black/40 hover:text-black/70 transition-colors">
                              <MoreVertical size={11}/>
                            </button>
                          </div>
                        </div>

                        {/* Reaction pills */}
                        {hasReactions && (
                          <div className={`flex flex-wrap gap-1 mt-1 ${me ? 'justify-end' : 'justify-start'}`}>
                            {Object.entries(myReactions).filter(([,on]) => on).map(([emoji]) => (
                              <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#25D366]/10 border border-[#25D366]/20 text-[11px] font-semibold text-[#1C1C1E] hover:bg-[#25D366]/20 transition-colors active:scale-95">
                                <span>{emoji}</span>
                                <span className="text-[#25D366]">1</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Scroll anchor */}
          <div ref={bottomRef} className="h-1" />
        </div>
      </div>

      {/* ── SCROLL TO BOTTOM PILL ── */}
      <AnimatePresence>
        {!isAtBottom && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="absolute bottom-[80px] right-4 z-20 flex items-center gap-2">
            <button onClick={() => scrollToBottom(true)}
              className="flex items-center gap-1.5 bg-white shadow-lg border border-black/8 rounded-full pl-3 pr-2.5 py-1.5 text-[12px] font-bold text-[#1C1C1E] hover:bg-[#25D366] hover:text-white hover:border-transparent transition-all">
              {unreadCount > 0 && (
                <span className="bg-[#25D366] text-white text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none -ml-1 mr-0.5">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
              <ChevronDown size={14}/>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CONTEXT MENU ── */}
      <AnimatePresence>
        {contextMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              style={{
                position: 'fixed',
                top: contextMenu.y || '50%',
                left: contextMenu.x ? Math.min(contextMenu.x, window.innerWidth - 200) : '50%',
                transform: contextMenu.x ? 'none' : 'translate(-50%,-50%)',
                zIndex: 9999,
              }}
              className="bg-white/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-black/8 py-1.5 w-52 overflow-hidden">
              {[
                { label: 'Reply', icon: Reply, fn: () => { setReplyTo(contextMenu.msg); setContextMenu(null); } },
                { label: 'Copy text', icon: Copy, fn: () => { navigator.clipboard.writeText(contextMenu.msg.content); toast.success('Copied to clipboard'); setContextMenu(null); } },
                { label: 'React', icon: Smile, fn: () => { setEmojiPickerFor(contextMenu.msg.id); setContextMenu(null); } },
              ].map(({ label, icon: Icon, fn }) => (
                <button key={label} onClick={fn}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-black/[0.04] text-left transition-colors">
                  <Icon size={15} className="text-black/40 shrink-0" />
                  <span className="text-[13px] font-medium text-[#1C1C1E]">{label}</span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── REPLY PREVIEW BAR ── */}
      <AnimatePresence>
        {replyTo && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="px-4 py-2.5 bg-[#25D366]/5 border-t border-[#25D366]/15 flex items-center gap-3 shrink-0">
            <div className="w-0.5 h-8 bg-[#25D366] rounded-full shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-[#25D366]">Replying to {addr(replyTo.authorAddress)}</p>
              <p className="text-[12px] text-black/50 truncate">{replyTo.content.slice(0, 80)}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="p-1.5 text-black/30 hover:text-black/60 rounded-lg hover:bg-black/5 shrink-0">
              <X size={14}/>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── INPUT AREA — shrink-0 keeps it pinned at the bottom ── */}
      <div className="bg-white border-t border-black/[0.06] shrink-0 px-3 pt-2 pb-3">

        {/* App Drawer */}
        <AnimatePresence>
          {showAppDrawer && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="grid grid-cols-5 gap-3 px-1 py-3">
                {[
                  { icon: ImgIcon, label: 'Photo', color: 'bg-[#FF9500]', fn: () => fileInputRef.current?.click() },
                  { icon: CircleDollarSign, label: 'Crypto', color: 'bg-[#007AFF]', fn: () => { setCryptoRecipient(''); setShowRecipientSheet(true); } },
                  { icon: MapPin, label: 'Location', color: 'bg-[#25D366]', fn: sendLocation },
                  { icon: BarChart2, label: 'Poll', color: 'bg-purple-500', fn: () => setShowPollCreator(true) },
                  { icon: Smile, label: 'Sticker', color: 'bg-orange-500', fn: () => executeSend('[STICKER]:fire') },
                ].map(({ icon: Icon, label, color, fn }) => (
                  <button key={label} onClick={() => { fn(); setShowAppDrawer(false); }}
                    className="flex flex-col items-center gap-1.5 group">
                    <div className={`w-12 h-12 ${color} text-white rounded-[18px] flex items-center justify-center shadow-sm group-active:scale-90 transition-transform`}>
                      <Icon size={22}/>
                    </div>
                    <span className="text-[10px] font-semibold text-[#1C1C1E]/60">{label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSend} className="flex items-end gap-2">
          <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept="image/*,video/*" />

          {/* Plus / Close drawer button */}
          <button type="button" onClick={() => setShowAppDrawer(v => !v)}
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 ${showAppDrawer ? 'bg-[#25D366] text-white rotate-45' : 'bg-[#F2F2F7] text-[#1C1C1E]/50 hover:bg-[#E5E5EA]'}`}>
            <Plus size={20}/>
          </button>

          {/* Main input area or voice recorder */}
          {recordingVoice ? (
            <div className="flex-1 flex items-center bg-[#F2F2F7] rounded-3xl min-h-[44px] px-3">
              <VoiceRecorder
                onSend={async b64 => { setRecordingVoice(false); await executeSend(b64); }}
                onCancel={() => setRecordingVoice(false)}
              />
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
                className="flex-1 bg-transparent outline-none text-[14px] text-[#1C1C1E] placeholder:text-black/30 resize-none leading-relaxed max-h-[140px] overflow-y-auto disabled:opacity-50 self-end"
                style={{ height: 'auto' }}
              />
              <div className="flex items-end gap-1.5 shrink-0 pb-0.5">
                {!input.trim() ? (
                  <button type="button" onClick={() => setRecordingVoice(true)}
                    className="text-black/30 hover:text-[#25D366] transition-colors active:scale-90">
                    <Mic size={20}/>
                  </button>
                ) : (
                  <button type="submit" disabled={sending}
                    className="w-8 h-8 bg-[#25D366] text-white rounded-full flex items-center justify-center disabled:opacity-40 hover:bg-[#128C7E] transition-all active:scale-90 shadow">
                    {sending
                      ? <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"/>
                      : <Send size={14} className="-ml-0.5"/>
                    }
                  </button>
                )}
              </div>
            </div>
          )}
        </form>
      </div>

      {/* ── RECIPIENT SHEET ── */}
      <AnimatePresence>
        {showRecipientSheet && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end"
            onClick={e => { if (e.target === e.currentTarget) setShowRecipientSheet(false); }}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 34 }}
              className="w-full bg-white rounded-t-3xl p-6 flex flex-col gap-4 shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-[18px] font-black text-[#1C1C1E]">Send Crypto</h3>
                <button onClick={() => setShowRecipientSheet(false)} className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-black/40 hover:text-black">
                  <X size={16}/>
                </button>
              </div>
              <p className="text-[13px] text-black/50">Enter the recipient wallet address</p>
              <input value={cryptoRecipient} onChange={e => setCryptoRecipient(e.target.value)}
                placeholder="0x..." autoFocus autoComplete="off" spellCheck={false}
                className="w-full px-4 py-3 rounded-2xl border border-black/10 text-[15px] font-mono outline-none focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/15 transition-all" />
              <button disabled={!/^0x[0-9a-fA-F]{40}$/.test(cryptoRecipient.trim())}
                onClick={() => { setShowRecipientSheet(false); setShowCryptoModal(true); }}
                className="w-full py-3.5 bg-[#25D366] disabled:bg-[#25D366]/40 text-white font-bold rounded-2xl transition-all active:scale-[0.98]">
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
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowPollCreator(false); }}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl flex flex-col gap-4"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-[17px] font-black text-[#1C1C1E]">Create Poll</h3>
                <button onClick={() => setShowPollCreator(false)} className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-black/40"><X size={16}/></button>
              </div>
              <input type="text" placeholder="Ask a question..." value={pollQuestion} autoFocus
                onChange={e => setPollQuestion(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-black/10 text-[14px] outline-none focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/15" />
              <div className="flex flex-col gap-2">
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <input type="text" placeholder={`Option ${i + 1}`} value={opt}
                      onChange={e => setPollOptions(prev => prev.map((o, j) => j === i ? e.target.value : o))}
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-black/10 text-[13px] outline-none focus:border-[#25D366]" />
                    {pollOptions.length > 2 && (
                      <button onClick={() => setPollOptions(prev => prev.filter((_, j) => j !== i))}
                        className="text-black/30 hover:text-red-500 transition-colors"><X size={14}/></button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 6 && (
                  <button onClick={() => setPollOptions(p => [...p, ''])}
                    className="text-[13px] font-bold text-[#25D366] hover:text-[#128C7E] text-left transition-colors">
                    + Add option
                  </button>
                )}
              </div>
              <button onClick={() => {
                const validOpts = pollOptions.filter(o => o.trim());
                if (!pollQuestion.trim() || validOpts.length < 2) { toast.error('Add a question and at least 2 options'); return; }
                executeSend(`__POLL__poll_${Date.now()}__::${pollQuestion.trim()}__::${validOpts.join('|')}`);
                setShowPollCreator(false); setPollQuestion(''); setPollOptions(['', '']);
              }}
                className="w-full py-3.5 bg-[#25D366] text-white font-bold rounded-2xl hover:bg-[#128C7E] transition-colors active:scale-[0.98]">
                Send Poll
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
