'use client';
import React, {
  useState, useEffect, useRef, useCallback, useMemo
} from 'react';
import {
  Send, Plus, MapPin, CircleDollarSign, Smile, BarChart2,
  Image as ImgIcon, Mic, Hash, CheckCircle, X, Reply,
  Play, Pause, Pin, Search, Users, ChevronDown, Film,
  MoreVertical, Copy, Trash2, ThumbsUp, Heart, Laugh,
  AlertCircle, Lock, Volume2, Globe, Shield, ExternalLink, Zap, FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { NativeCryptoSendModal } from './NativeCryptoSendModal';
import { ZkMoneyModal } from './ZkMoneyModal';
import { CustomAudioPlayer } from './CustomAudioPlayer';
import { AnimatePresence, motion } from 'framer-motion';
import DOMPurify from 'dompurify';
import { sanitizeRichText } from '@/lib/security/sanitizeRichText';
import { parseZkPaymentPayload, parseEscrowPayload } from '@/lib/zk/zkMoney';
import { parseTipPayload, parseBountyPayload } from '@/lib/zk/zkCommunityPayments';
import { parseStreamPayload, encodeStreamPayload, ZkPaymentStream } from '@/lib/zk/zkStreaming';
import { parseInvoicePayload, encodeInvoicePayload, ZkInvoice } from '@/lib/zk/zkInvoice';
import { ZkWalletPanel } from '@/components/zk/ZkWalletPanel';
import { ZkShieldModal } from '@/components/zk/ZkShieldModal';
import { ZkEscrowCard } from '@/components/zk/ZkEscrowCard';
import { ZkStreamManager } from '@/components/zk/ZkStreamManager';
import { ZkInvoiceModal } from '@/components/zk/ZkInvoiceModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Shared sanitizer: no class/style, no remote images, safe links.
// See lib/security/sanitizeRichText.ts.
function safeHtml(raw: string): string {
  return sanitizeRichText(raw);
}
const addr = (a: string) => `${(a||'0x??').slice(0,6)}...${(a||'').slice(-4)}`;
const fmt2 = (s: number) =>
  `${Math.floor(s/60).toString().padStart(2,'0')}:${Math.floor(s%60).toString().padStart(2,'0')}`;
const AVATAR_COLORS = ['#1C1C1E','#3A3A3C','#636366','#FF9500','#FF3B30','#AF52DE','#FF2D55','#5856D6'];
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
function VoiceRecorder({ onSend, onCancel }: { onSend: (b64: string) => void; onCancel: () => void }) {
  const [secs, setSecs] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const chunksRef = useRef<Blob[]>([]);
  const mrRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isCancelledRef = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        // Audio Level Analyser for Live Waveform
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            const ctx = new AudioContextClass();
            audioCtxRef.current = ctx;
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);
            const dataArr = new Uint8Array(analyser.frequencyBinCount);
            const checkLevel = () => {
              if (!active) return;
              analyser.getByteFrequencyData(dataArr);
              let sum = 0;
              for (let i = 0; i < dataArr.length; i++) sum += dataArr[i];
              setAudioLevel(Math.min(100, Math.round((sum / dataArr.length) * 1.5)));
              animFrameRef.current = requestAnimationFrame(checkLevel);
            };
            checkLevel();
          }
        } catch {}

        const mimeType = typeof MediaRecorder !== 'undefined'
          ? MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : ''
          : '';

        const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        mrRef.current = mr;
        chunksRef.current = [];

        mr.ondataavailable = e => {
          if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };

        mr.onstop = () => {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
          }
          if (audioCtxRef.current) {
            try { audioCtxRef.current.close(); } catch {}
          }
          if (isCancelledRef.current) return;
          if (chunksRef.current.length === 0) {
            onCancel();
            return;
          }
          const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
          if (blob.size < 400) {
            toast.error('Voice note too short');
            onCancel();
            return;
          }
          const r = new FileReader();
          r.onloadend = () => {
            if (r.result) onSend(`__AUDIO__${r.result}`);
          };
          r.readAsDataURL(blob);
        };

        mr.start(100);
      } catch (err) {
        console.error('[VoiceRecorder] Mic error:', err);
        toast.error('Microphone access denied or unavailable');
        onCancel();
      }
    })();

    const t = setInterval(() => setSecs(s => s + 1), 1000);
    return () => {
      active = false;
      clearInterval(t);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (mrRef.current && mrRef.current.state !== 'inactive') {
        try { mrRef.current.stop(); } catch {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close(); } catch {}
      }
    };
  }, []);

  const handleCancel = () => {
    isCancelledRef.current = true;
    if (mrRef.current && mrRef.current.state !== 'inactive') {
      try { mrRef.current.stop(); } catch {}
    }
    onCancel();
  };

  const handleFinish = () => {
    isCancelledRef.current = false;
    if (mrRef.current && mrRef.current.state !== 'inactive') {
      try { mrRef.current.stop(); } catch {}
    }
  };

  return (
    <div className="flex-1 flex items-center justify-between gap-3 px-3 py-1 bg-white rounded-lg border border-black/[0.04] shadow-sm min-h-[42px]">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={handleCancel}
          className="p-1.5 rounded-full text-[#ea4335] hover:bg-red-50 transition-colors"
          title="Cancel recording"
        >
          <Trash2 size={18} />
        </button>
        <div className="w-2.5 h-2.5 rounded-full bg-[#ea4335] animate-pulse" />
        <span className="text-[14px] font-mono font-bold text-[#111b21]">{fmt2(secs)}</span>
      </div>

      {/* Dynamic Sound Waveform */}
      <div className="flex-1 flex items-center justify-center gap-1 max-w-[200px] h-6 px-2">
        {[20, 45, 75, 35, 90, 60, 30, 80, 50, 25, 65, 40].map((baseH, idx) => {
          const mod = Math.min(100, Math.max(15, (baseH * (audioLevel + 30)) / 80));
          return (
            <div
              key={idx}
              className="w-1 bg-[#1C1C1E] rounded-full transition-all duration-75"
              style={{ height: `${mod}%` }}
            />
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleFinish}
        className="w-9 h-9 bg-[#1C1C1E] text-white rounded-full flex items-center justify-center shadow hover:bg-black active:scale-95 transition-all shrink-0"
        title="Send voice note"
      >
        <Send size={15} className="-ml-0.5" />
      </button>
    </div>
  );
}

// ─── AUDIO PLAYER ─────────────────────────────────────────────────────────────
function AudioPlayer({ src, mine }: { src: string; mine: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dur, setDur] = useState(0);
  const [currTime, setCurrTime] = useState(0);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);
  const ref = useRef<HTMLAudioElement>(null);

  const toggle = () => {
    if (!ref.current) return;
    if (playing) {
      ref.current.pause();
      setPlaying(false);
    } else {
      ref.current.play().catch(e => console.warn('Audio play failed', e));
      setPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (ref.current && dur > 0) {
      const nextTime = (val / 100) * dur;
      ref.current.currentTime = nextTime;
      setProgress(val);
      setCurrTime(nextTime);
    }
  };

  const cycleSpeed = () => {
    const nextSpeed = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(nextSpeed);
    if (ref.current) ref.current.playbackRate = nextSpeed;
  };

  return (
    <div className="flex items-center gap-3 min-w-[230px] max-w-[290px] py-1 select-none">
      <audio
        ref={ref}
        src={src}
        onTimeUpdate={e => {
          const c = e.currentTarget.currentTime;
          const d = e.currentTarget.duration || dur;
          setCurrTime(c);
          if (d > 0) setProgress((c / d) * 100);
        }}
        onLoadedMetadata={e => {
          const d = e.currentTarget.duration;
          if (!isNaN(d) && isFinite(d)) setDur(d);
        }}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
          setCurrTime(0);
        }}
        className="hidden"
      />
      
      {/* Play/Pause round button */}
      <button
        type="button"
        onClick={toggle}
        className="w-9 h-9 rounded-full bg-[#1C1C1E] text-white flex items-center justify-center shrink-0 transition-transform active:scale-90 shadow-sm hover:bg-black"
      >
        {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" className="ml-0.5" />}
      </button>

      {/* Waveform track with seekable slider */}
      <div className="flex-1 flex flex-col justify-center gap-1">
        <div className="relative flex items-center h-4 w-full group cursor-pointer">
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={progress}
            onChange={handleSeek}
            className="w-full h-1.5 rounded-full appearance-none bg-black/15 accent-[#1C1C1E] cursor-pointer"
          />
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono text-[#667781] leading-none">
          <span>{fmt2(currTime)}</span>
          <span>{dur > 0 ? fmt2(dur) : '--:--'}</span>
        </div>
      </div>

      {/* Speed toggle pill */}
      <button
        type="button"
        onClick={cycleSpeed}
        className="px-1.5 py-0.5 text-[11px] font-bold rounded-md bg-black/5 text-[#54656f] hover:bg-black/10 transition-colors shrink-0"
        title="Playback speed"
      >
        {speed}x
      </button>
    </div>
  );
}

// ─── POLL BUBBLE (separate component so hooks are unconditional) ──────────────
function PollBubble({ content, mine }: { content: string; mine: boolean }) {
  const parts = content.split('__::');
  const question = parts[1] || '';
  const options = (parts[2] || '').split('|').filter(Boolean);
  const [voted, setVoted] = useState<number|null>(null);
  const [votes, setVotes] = useState(() => options.map(() => 0));
  const total = votes.reduce((a, b) => a + b, 0);
  return (
    <div className="min-w-[200px] max-w-[280px]">
      <p className={`text-[14px] font-bold mb-2.5 ${mine ? 'text-[#111b21]' : 'text-[#1C1C1E]'}`}>{question}</p>
      <div className="space-y-1.5">
        {options.map((o, i) => {
          const pct = total > 0 ? Math.round((votes[i] / total) * 100) : 0;
          const isVoted = voted === i;
          return (
            <button
              key={i}
              onClick={() => { setVoted(i); setVotes(prev => prev.map((v, j) => j === i ? v + 1 : v)); }}
              className={`relative w-full text-left text-[12px] font-semibold px-3 py-2 rounded-xl overflow-hidden transition-all ${isVoted ? 'text-[#1C1C1E] font-bold' : 'text-[#1C1C1E]/70'}`}
            >
              <div
                className={`absolute inset-y-0 left-0 rounded-xl transition-all ${isVoted ? 'bg-black/10' : 'bg-black/5'}`}
                style={{ width: `${voted !== null ? pct : 0}%` }}
              />
              <div className="relative flex justify-between">
                <span>{o}</span>
                {voted !== null && <span>{pct}%</span>}
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] mt-2 text-black/30">{total} vote{total !== 1 ? 's' : ''}</p>
    </div>
  );
}

// ─── MESSAGE CONTENT RENDERER ─────────────────────────────────────────────────
function MessageContent({ content, mine }: { content: string; mine: boolean }) {
  if (content.startsWith('__PAYMENT__::')) {
    try {
      const d = JSON.parse(content.replace('__PAYMENT__::', ''));
      return (
        <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 min-w-[220px] ${mine ? 'bg-white/15 border border-white/20' : 'bg-black/5 border border-black/10'}`}>
          <div className="w-9 h-9 rounded-full bg-black/10 flex items-center justify-center shrink-0">
            <CircleDollarSign size={18} className="text-[#1C1C1E]" />
          </div>
          <div>
            <p className={`text-[13px] font-black ${mine ? 'text-white' : 'text-[#1C1C1E]'}`}>{d.amount} {d.token}</p>
            <a href={`https://etherscan.io/tx/${d.txHash}`} target="_blank" rel="noopener noreferrer"
              className="text-[11px] text-[#1C1C1E] font-medium hover:underline">View on Etherscan ↗</a>
          </div>
          <CheckCircle size={16} className="text-[#1C1C1E] ml-auto shrink-0" />
        </div>
      );
    } catch { return <span className="text-[14px]">{content}</span>; }
  }

  if (content.startsWith('__AUDIO__')) return <CustomAudioPlayer src={content.replace('__AUDIO__', '')} isMe={mine} />;

  if (content.startsWith('[LOCATION]')) {
    const [lat, lon] = content.replace('[LOCATION]', '').split(',');
    return (
      <a href={`https://maps.google.com/?q=${lat},${lon}`} target="_blank" rel="noopener noreferrer"
        className={`flex items-center gap-2 text-[13px] font-semibold hover:underline ${mine ? 'text-white' : 'text-[#2754d6]'}`}>
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
    return <PollBubble content={content} mine={mine} />;
  }

  if (content.startsWith('__ZK_MONEY_PAYMENT__:')) {
    const payment = parseZkPaymentPayload(content);
    if (payment) {
      return (
        <div className="min-w-[240px] max-w-[280px] p-3 rounded-2xl bg-[#1C1C1E] text-white shadow-md border border-black/10 my-1">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center shadow-sm">
                <Lock size={13} className="text-white" />
              </div>
              <span className="text-[12px] font-bold text-white tracking-tight">zk.money</span>
            </div>
            <span className="text-[9px] font-black uppercase tracking-wider bg-white/10 text-white/90 px-2 py-0.5 rounded-full border border-white/15">
              Shielded Note
            </span>
          </div>

          <div className="py-1">
            <p className="text-[10px] text-white/60 uppercase font-semibold tracking-wider">Private Transfer</p>
            <p className="text-[20px] font-bold font-mono text-white mt-0.5">
              {payment.amount} <span className="text-white/80 text-[16px]">{payment.token}</span>
            </p>
          </div>

          <div className="text-[11px] text-white/75 space-y-0.5 mt-1 font-mono">
            <p className="truncate">To: <span className="text-white font-semibold">{payment.recipientTag}</span></p>
            {payment.memo && <p className="text-white/60 italic truncate">"{payment.memo}"</p>}
          </div>

          <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between">
            <span className="text-[10px] text-white/70 flex items-center gap-1">
              <Lock size={10} /> Verified on Aztec
            </span>
            <a
              href={payment.aztecExplorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-semibold text-white/80 hover:text-white flex items-center gap-0.5"
            >
              AztecScan <ExternalLink size={10} />
            </a>
          </div>
        </div>
      );
    }
  }

  if (content.startsWith('__ZK_ESCROW__:')) {
    const escrow = parseEscrowPayload(content);
    if (escrow) {
      return (
        <div className="min-w-[260px] max-w-[320px] my-1">
          <ZkEscrowCard escrow={escrow} currentUserTag={escrow.senderTag} />
        </div>
      );
    }
  }

  if (content.startsWith('__ZK_TIP__:')) {
    const tip = parseTipPayload(content);
    if (tip) {
      return (
        <div className="min-w-[220px] max-w-[280px] p-3 rounded-2xl bg-gradient-to-br from-[#1C1C1E] to-[#2C2C2E] text-white shadow-md border border-black/10 my-1 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1C1C1E]">Shielded Tip</span>
            <span className="text-[9px] font-mono text-white/50 bg-white/10 px-1.5 py-0.5 rounded-full">Aztec</span>
          </div>
          <div className="text-[20px] font-black text-white">
            +{tip.amount} <span className="text-[13px] text-[#1C1C1E]">zk{tip.token}</span>
          </div>
          <div className="text-[11px] text-white/70 font-mono">{tip.senderTag} → {tip.recipientTag}</div>
          {tip.message && <div className="text-[11px] italic text-white/80 bg-white/5 p-2 rounded-xl">"{tip.message}"</div>}
        </div>
      );
    }
  }

  if (content.startsWith('__ZK_BOUNTY__:')) {
    const bounty = parseBountyPayload(content);
    if (bounty) {
      return (
        <div className="min-w-[240px] max-w-[300px] p-3.5 rounded-2xl bg-white border border-black/10 shadow-sm my-1 space-y-2">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider bg-black/5 text-[#1C1C1E] px-2 py-0.5 rounded-full">
                Shielded Bounty
              </span>
              <h4 className="font-bold text-gray-900 text-[13px] mt-1">{bounty.title}</h4>
            </div>
            <div className="text-right font-black text-[#1C1C1E] text-[15px]">
              {bounty.reward} <span className="text-[10px] text-gray-400">zk{bounty.token}</span>
            </div>
          </div>
          <p className="text-[11px] text-gray-600 line-clamp-2">{bounty.description}</p>
        </div>
      );
    }
  }

  if (content.startsWith('__ZK_STREAM__:')) {
    const stream = parseStreamPayload(content);
    if (stream) {
      return (
        <div className="bg-[#1C1C1E] text-white rounded-2xl p-4 shadow-lg border border-black/10 min-w-[240px] max-w-[320px]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Zap size={14} />
              </div>
              <div>
                <span className="text-[12px] font-bold text-white">Private Stream</span>
                <span className="ml-1.5 text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">Aztec</span>
              </div>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="py-2 border-y border-white/10 my-2">
            <p className="text-[20px] font-black text-white font-mono">{(stream as any).totalAmount || stream.depositAmount} <span className="text-[12px] text-emerald-400">zk{stream.token}</span></p>
            <p className="text-[11px] text-white/50">{(stream as any).flowRate || stream.ratePerSecond} {stream.token}/sec</p>
          </div>
          <div className="text-[10px] font-mono text-white/60 flex justify-between">
            <span>To: {stream.recipientTag}</span>
            <span className="text-emerald-400">Live</span>
          </div>
        </div>
      );
    }
  }

  if (content.startsWith('__ZK_INVOICE__:')) {
    const invoice = parseInvoicePayload(content);
    if (invoice) {
      return (
        <div className="bg-[#1C1C1E] text-white rounded-2xl p-4 shadow-lg border border-black/10 min-w-[240px] max-w-[320px]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <FileText size={14} />
              </div>
              <span className="text-[12px] font-bold text-white">Shielded Invoice</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
              {invoice.status}
            </span>
          </div>
          <h4 className="font-bold text-white text-[13px]">{invoice.title || 'Private Invoice'}</h4>
          <p className="text-[11px] text-white/60 mb-2">{(invoice as any).description || invoice.notes || 'Confidential Invoice'}</p>
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <span className="text-[18px] font-black text-emerald-400">{(invoice as any).amount || invoice.totalAmount || '0'} <span className="text-[11px]">zk{invoice.token}</span></span>
            <span className="px-2.5 py-1 rounded-xl bg-white/10 text-white text-[11px] font-mono">
              zk.money
            </span>
          </div>
        </div>
      );
    }
  }

  if (content.startsWith('[STICKER]:')) {
    const name = content.replace('[STICKER]:', '');
    const stickers: Record<string,string> = { fire:'🔥', heart:'❤️', clap:'👏', '100':'💯', rocket:'🚀', wave:'👋', thumbsup:'👍', cool:'😎' };
    return <span className="text-4xl select-none">{stickers[name] || '🎭'}</span>;
  }

  if (/<[a-z][\s\S]*>/i.test(content)) {
    return (
      <div
        className="prose prose-sm max-w-none text-[14px] leading-relaxed [&_p]:my-0.5 [&_p]:inline"
        dangerouslySetInnerHTML={{ __html: safeHtml(content) }}
      />
    );
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
  const [showZkModal, setShowZkModal] = useState(false);
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
  // ZK Wallet Panel
  const [showZkWallet,       setShowZkWallet]       = useState(false);
  const [showZkShield,       setShowZkShield]       = useState(false);
  const [zkShieldMode,       setZkShieldMode]       = useState<'shield'|'unshield'>('shield');
  const [showZkStreamModal,  setShowZkStreamModal]  = useState(false);
  const [showZkInvoiceModal, setShowZkInvoiceModal] = useState(false);


  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
    setUnreadCount(0);
  }, []);

  // ─── FETCH MESSAGES ─────────────────────────────────────────────────────────
  const fetchMessages = useCallback(async (silent = true) => {
    if (!communityId) return;
    try {
      const url = `/api/chat/communities/posts?communityId=${communityId}${channelId ? `&channelId=${channelId}` : ''}`;
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) return;
      const data = await res.json();
      // API returns newest messages descending (orderBy desc, take 50); client reverses to render chronologically
      const rawPosts = data.posts || [];
      const ordered: Msg[] = [...rawPosts].reverse();

      setMessages(prev => {
        const confirmedIds = new Set(ordered.map(m => m.id));
        const kept = prev.filter(m => m.isOptimistic && !confirmedIds.has(m.id));
        const merged = [...ordered, ...kept];

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

      const pinned = ordered.filter(m => m.isPinned);
      if (pinned.length > 0) setPinnedMsgs(pinned);
    } catch (e) {
      console.error('[CommunityChatView] fetchMessages error', e);
    }
  }, [communityId, channelId, myAddress, isAtBottom, scrollToBottom]);


  useEffect(() => {
    fetchMessages(false);
    setTimeout(() => scrollToBottom(false), 150);
    // A tab in the background polls every 30 s instead of every few seconds.
    // Background tabs are most of the open tabs at any moment, and at the
    // foreground rate each one cost the database the same as an active user.
    let lastHiddenFetch = 0;
    pollIntervalRef.current = setInterval(() => {
      if (document.visibilityState === 'hidden') {
        if (Date.now() - lastHiddenFetch < 30_000) return;
        lastHiddenFetch = Date.now();
      }
      fetchMessages(true);
    }, 3000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
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
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          communityId,
          channelId: channelId || undefined,
          // NO title field — keeps this record as a chat message (title=null)
          content: text,
          contentHtml: text,
          // F2-02: plainText intentionally omitted — private community messages must not expose cleartext
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error || 'Failed to send. Make sure you are a member.');
        setMessages(prev => prev.filter(m => m.id !== optId));
        optimisticIds.current.delete(optId);
      } else {
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
    // Reset height to auto — lets CSS min-height take over, no jitter
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
    const val = e.target.value;
    setInput(val);
    const el = e.target;
    if (!el) return;
    // Always reset to auto first so shrink works correctly
    el.style.height = 'auto';
    if (val) {
      const nextH = Math.min(el.scrollHeight, 100);
      el.style.height = `${nextH}px`;
    }
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

  // ─── FILTER MESSAGES BY SEARCH & NON-EMPTY ─────────────────────────────────
  const displayMessages = useMemo(() => {
    const valid = messages.filter(m => m && m.content && m.content.trim().length > 0);
    if (!searchQuery.trim()) return valid;
    const q = searchQuery.toLowerCase();
    return valid.filter(m => m.content.toLowerCase().includes(q));
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
    // Explicit flex-1 flex-col w-full bg-[#efeae2] overflow-hidden min-h-0
    <div className="relative flex-1 flex flex-col w-full bg-[#efeae2] overflow-hidden min-h-0">

      {/* ── CHANNEL HEADER ── */}
      <div className="px-4 py-2.5 bg-white border-b border-black/[0.06] flex items-center gap-2 shrink-0 sticky top-0 z-20">
        <Hash size={14} className="text-black/30 shrink-0" />
        <span className="text-[13px] font-bold text-[#1C1C1E]/70 flex-1 min-w-0 truncate">
          {communityName || 'Channel'}
        </span>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowZkWallet(v => !v)}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${showZkWallet ? 'bg-[#1C1C1E] text-white' : 'text-black/30 hover:text-black hover:bg-black/5'}`}
            title="Shielded Wallet">
            <Lock size={13} />
          </button>
          <button onClick={() => setShowSearch(v => !v)}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${showSearch ? 'bg-[#1C1C1E] text-white' : 'text-black/30 hover:text-black/60 hover:bg-black/5'}`}>
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

      {/* ── MESSAGE LIST — WhatsApp Ivory Wallpaper Parity ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overscroll-contain w-full max-w-full"
        style={{ minHeight: 0 }}
        onClick={() => { setContextMenu(null); setEmojiPickerFor(null); }}
      >
        <div className="px-3 py-4 space-y-0.5 max-w-4xl mx-auto w-full">
          {/* Empty state */}
          {displayMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mb-4 shadow-sm">
                <Send size={24} className="text-[#1C1C1E]" />
              </div>
              <p className="text-[16px] font-bold text-[#111b21]">
                {searchQuery ? 'No messages found' : 'Start the conversation'}
              </p>
              <p className="text-[13px] text-[#667781] mt-1">
                {searchQuery ? 'Try another search term' : 'Be the first to send a message in this channel'}
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
                    <span className="text-[11px] font-mono font-semibold text-[#54656f]">
                      {addr(firstMsg.authorAddress)}
                    </span>
                  </div>
                )}

                {msgs.map((msg, idx) => {
                  const trimmed = (msg.content || '').trim();
                  if (!trimmed) return null;

                  const contentLower = trimmed.toLowerCase();
                  const isSystem = trimmed.startsWith('__SYSTEM__') ||
                                   trimmed.startsWith('[SYSTEM]') ||
                                   contentLower.startsWith('system...') ||
                                   contentLower.includes('joined the group') ||
                                   contentLower.includes('joined the community');
                  if (isSystem) {
                    const displayTxt = trimmed
                      .replace('__SYSTEM__', '')
                      .replace('[SYSTEM]', '')
                      .replace(/^system\.\.\.\s*/i, '');
                    return (
                      <div key={msg.id} className="w-full flex justify-center py-1.5 my-1">
                        <span className="text-[11px] font-medium text-[#54656f] bg-white/90 backdrop-blur-sm shadow-sm rounded-full px-3.5 py-1 border border-black/[0.05] select-text">
                          {displayTxt}
                        </span>
                      </div>
                    );
                  }

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
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-black shadow-sm"
                            style={{ background: avatarColor(msg.authorAddress || '0x00') }}>
                            {(msg.authorAddress || '??').slice(2,4).toUpperCase()}
                          </div>
                        ) : <div className="w-7" />}
                      </div>

                      {/* Bubble + reactions */}
                      <div className={`flex flex-col ${me ? 'items-end' : 'items-start'}`}>
                        {/* Reply preview */}
                        {replyTo?.id === msg.id && (
                          <div className={`text-[10px] mb-1 border-l-2 pl-2 rounded-r bg-black/[0.03] py-0.5 pr-2 ${me ? 'border-[#1C1C1E] text-[#111b21]' : 'border-[#1C1C1E] text-[#111b21]'}`}>
                            <span className="font-bold text-[#1C1C1E]">{addr(replyTo.authorAddress)}: </span>
                            <span className="text-[#667781]">{replyTo.content.slice(0,40)}</span>
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

                          {/* Bubble (WhatsApp Desktop Parity) */}
                          <div className={`relative px-3.5 py-2 select-text shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] border border-black/[0.03]
                            ${me
                              ? `bg-[#d9fdd3] text-[#111b21] ${msg.isOptimistic ? 'opacity-70' : ''}`
                              : 'bg-white text-[#111b21]'
                            }
                            ${isFirst && isLast ? 'rounded-2xl' :
                              isFirst ? me ? 'rounded-2xl rounded-br-md' : 'rounded-2xl rounded-bl-md' :
                              isLast ? me ? 'rounded-2xl rounded-tr-md' : 'rounded-2xl rounded-tl-md' :
                              me ? 'rounded-l-2xl rounded-r-md' : 'rounded-r-2xl rounded-l-md'
                            }`}>
                            <MessageContent content={msg.content} mine={me} />

                            {/* Time + WhatsApp status checks */}
                            <div className={`flex items-center gap-1 mt-1 ${me ? 'justify-end' : 'justify-start'}`}>
                              <span className="text-[11px] text-[#667781] leading-none">
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
                              </span>
                              {me && msg.isOptimistic && (
                                <div className="w-2.5 h-2.5 border-[1.5px] border-black/30 border-t-[#1C1C1E] rounded-full animate-spin" />
                              )}
                              {me && !msg.isOptimistic && (
                                <span className="text-[#53bdeb] text-[12px] font-bold leading-none select-none">✓✓</span>
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
                                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/5 border border-black/10 text-[11px] font-semibold text-[#1C1C1E] hover:bg-black/10 transition-colors active:scale-95">
                                <span>{emoji}</span>
                                <span className="text-[#1C1C1E]">1</span>
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
              className="flex items-center gap-1.5 bg-white shadow-lg border border-black/8 rounded-full pl-3 pr-2.5 py-1.5 text-[12px] font-bold text-[#1C1C1E] hover:bg-[#1C1C1E] hover:text-white hover:border-transparent transition-all">
              {unreadCount > 0 && (
                <span className="bg-[#1C1C1E] text-white text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none -ml-1 mr-0.5">
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
            className="px-4 py-2.5 bg-black/[0.02] border-t border-black/5 flex items-center gap-3 shrink-0">
            <div className="w-0.5 h-8 bg-[#1C1C1E] rounded-full shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-[#1C1C1E]">Replying to {addr(replyTo.authorAddress)}</p>
              <p className="text-[12px] text-black/50 truncate">{replyTo.content.slice(0, 80)}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="p-1.5 text-black/30 hover:text-black/60 rounded-lg hover:bg-black/5 shrink-0">
              <X size={14}/>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── WHATSAPP DESKTOP INPUT AREA (Mobile Ergonomics & iOS / Android Safe-Area) ── */}
      <div
        className="bg-[#f0f2f5] border-t border-[#e9edef] shrink-0 px-3 sm:px-4 py-2 sm:py-2.5 z-10"
        style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom, 10px))' }}
      >

        {/* App Drawer */}
        <AnimatePresence>
          {showAppDrawer && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-2">
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 p-3 bg-white rounded-2xl shadow-md border border-black/[0.04]">
                {[
                  { icon: Lock, label: 'zk.money', color: 'bg-[#1C1C1E]', fn: () => setShowZkModal(true) },
                  { icon: Zap, label: 'ZK Stream', color: 'bg-[#1C1C1E]', fn: () => setShowZkStreamModal(true) },
                  { icon: FileText, label: 'ZK Invoice', color: 'bg-[#1C1C1E]', fn: () => setShowZkInvoiceModal(true) },
                  { icon: ImgIcon, label: 'Photo/Video', color: 'bg-[#FF9500]', fn: () => fileInputRef.current?.click() },
                  { icon: CircleDollarSign, label: 'Crypto Send', color: 'bg-[#1C1C1E]', fn: () => { setCryptoRecipient(''); setShowRecipientSheet(true); } },
                  { icon: MapPin, label: 'Location', color: 'bg-[#3A3A3C]', fn: sendLocation },
                  { icon: BarChart2, label: 'Poll', color: 'bg-purple-500', fn: () => setShowPollCreator(true) },
                  { icon: Smile, label: 'Sticker', color: 'bg-orange-500', fn: () => executeSend('[STICKER]:fire') },
                ].map(({ icon: Icon, label, color, fn }) => (
                  <button key={label} onClick={() => { fn(); setShowAppDrawer(false); }}
                    className="flex flex-col items-center gap-1.5 group">
                    <div className={`w-11 h-11 ${color} text-white rounded-2xl flex items-center justify-center shadow-sm group-active:scale-90 transition-transform`}>
                      <Icon size={20}/>
                    </div>
                    <span className="text-[11px] font-semibold text-[#111b21]/70">{label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSend} className="flex items-end gap-2">
          <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept="image/*,video/*" />

          {recordingVoice ? (
            <VoiceRecorder
              onSend={async b64 => { setRecordingVoice(false); await executeSend(b64); }}
              onCancel={() => setRecordingVoice(false)}
            />
          ) : (
            <>
              {/* Plus (+) Attachment Button */}
              <button
                type="button"
                onClick={() => setShowAppDrawer(v => !v)}
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-[#54656f] hover:bg-black/5 hover:text-[#111b21] transition-all active:scale-95 mb-0.5 ${showAppDrawer ? 'rotate-45 text-[#1C1C1E]' : ''}`}
                title="Adjuntar"
              >
                <Plus size={22} />
              </button>

              {/* Emoji (😊) Button - hidden on mobile to maximize spacious input */}
              <button
                type="button"
                onClick={() => setEmojiPickerFor(prev => prev ? null : 'input')}
                className="hidden sm:flex w-10 h-10 rounded-full items-center justify-center shrink-0 text-[#54656f] hover:bg-black/5 hover:text-[#111b21] transition-all active:scale-95 mb-0.5"
                title="Emojis"
              >
                <Smile size={22} />
              </button>

              {/* Rounded White Text Box (Ergonomic on iOS & Android — min font-size 16px prevents browser zoom) */}
              <div className="flex-1 bg-white rounded-[24px] shadow-[0_1px_1px_rgba(11,20,26,0.1)] border border-black/[0.06] focus-within:border-black/30 min-h-[46px] max-h-[140px] flex items-center px-4 overflow-hidden transition-colors">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={autoGrow}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe un mensaje"
                  disabled={sending}
                  rows={1}
                  className="w-full bg-transparent outline-none text-[16px] sm:text-[15px] text-[#111b21] placeholder-[#8696a0] resize-none leading-[22px] max-h-[120px] overflow-y-auto disabled:opacity-50 py-[11px]"
                />
              </div>

              {/* Right Action: Mic when empty, Send when text present */}
              {!input.trim() ? (
                <button
                  type="button"
                  onClick={() => setRecordingVoice(true)}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-[#54656f] hover:bg-black/5 hover:text-[#111b21] active:scale-95 transition-all shrink-0 mb-0.5"
                  title="Grabar mensaje de voz"
                >
                  <Mic size={22} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={sending}
                  className="w-10 h-10 bg-[#1C1C1E] text-white rounded-full flex items-center justify-center shadow-sm hover:bg-black active:scale-95 transition-all shrink-0 disabled:opacity-40 mb-0.5"
                  title="Enviar"
                >
                  {sending ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send size={18} className="-ml-0.5" />
                  )}
                </button>
              )}
            </>
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
                className="w-full px-4 py-3 rounded-2xl border border-black/10 text-[15px] font-mono outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10 transition-all" />
              <button disabled={!/^0x[0-9a-fA-F]{40}$/.test(cryptoRecipient.trim())}
                onClick={() => { setShowRecipientSheet(false); setShowCryptoModal(true); }}
                className="w-full py-3.5 bg-[#1C1C1E] disabled:bg-[#1C1C1E]/40 text-white font-bold rounded-2xl transition-all active:scale-[0.98]">
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
                className="w-full px-4 py-3 rounded-2xl border border-black/10 text-[14px] outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10" />
              <div className="flex flex-col gap-2">
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <input type="text" placeholder={`Option ${i + 1}`} value={opt}
                      onChange={e => setPollOptions(prev => prev.map((o, j) => j === i ? e.target.value : o))}
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-black/10 text-[13px] outline-none focus:border-black/30" />
                    {pollOptions.length > 2 && (
                      <button onClick={() => setPollOptions(prev => prev.filter((_, j) => j !== i))}
                        className="text-black/30 hover:text-red-500 transition-colors"><X size={14}/></button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 6 && (
                  <button onClick={() => setPollOptions(p => [...p, ''])}
                    className="text-[13px] font-bold text-[#1C1C1E] hover:text-[#128C7E] text-left transition-colors">
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
                className="w-full py-3.5 bg-[#1C1C1E] text-white font-bold rounded-2xl hover:bg-black transition-colors active:scale-[0.98]">
                Send Poll
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ZK.MONEY PRIVATE PAYMENT MODAL ── */}
      <ZkMoneyModal
        isOpen={showZkModal}
        onClose={() => setShowZkModal(false)}
        myAddress={myAddress}
        communityName={communityName}
        onSuccess={(payload, result) => {
          executeSend(payload);
          setShowZkModal(false);
        }}
      />

      {/* ── ZK WALLET PANEL (slide-over with backdrop) ── */}
      <AnimatePresence>
        {showZkWallet && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowZkWallet(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[500]"
            />
            <motion.div
              initial={{ opacity: 0, x: '100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 right-0 w-full sm:w-[380px] z-[501] shadow-2xl overflow-hidden"
            >
              <ZkWalletPanel
                address={myAddress}
                onClose={() => setShowZkWallet(false)}
                onShield={() => { setZkShieldMode('shield'); setShowZkShield(true); }}
                onUnshield={() => { setZkShieldMode('unshield'); setShowZkShield(true); }}
                onSend={() => setShowZkModal(true)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── ZK SHIELD / UNSHIELD MODAL ── */}
      <AnimatePresence>
        {showZkShield && (
          <ZkShieldModal
            address={myAddress}
            mode={zkShieldMode}
            onClose={() => setShowZkShield(false)}
            onSuccess={() => setShowZkShield(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Aztec zk.money Payment Stream Modal ── */}
      {showZkStreamModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowZkStreamModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl border border-black/10 w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <ZkStreamManager
              userAddress={myAddress}
              onClose={() => setShowZkStreamModal(false)}
              onStreamCreated={(stream: any) => {
                executeSend(encodeStreamPayload(stream));
                setShowZkStreamModal(false);
                toast.success('Private Aztec payment stream active');
              }}
            />
          </div>
        </div>
      )}

      {/* ── Aztec zk.money Invoice Modal ── */}
      {showZkInvoiceModal && (
        <ZkInvoiceModal
          userAddress={myAddress}
          onClose={() => setShowZkInvoiceModal(false)}
          onInvoiceCreated={(invoice) => {
            executeSend(encodeInvoicePayload(invoice));
            setShowZkInvoiceModal(false);
            toast.success('Factura confidencial publicada!');
          }}
        />
      )}
    </div>
  );
}

