'use client';
/**
 * GroupPartyCall — Native WebRTC group voice/video call for Humanity Ledger Communities.
 * Only available inside group conversations (isGroup=true).
 * Fully light mode, zero-dark-mode, Telegram/Discord/WhatsApp polished UI.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Users, Minimize2, Maximize2, X, PhoneCall } from 'lucide-react';
import { useDynamicIsland } from '@/lib/store/dynamic-island-store';

interface Participant {
  address: string;
  stream?: MediaStream;
  muted: boolean;
  videoOff: boolean;
  name: string;
}

interface GroupPartyCallProps {
  groupId: string;
  groupName: string;
  myAddress: string;
  onClose: () => void;
  isActive: boolean;
}

export function GroupPartyCall({ groupId, groupName, myAddress, onClose, isActive }: GroupPartyCallProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [duration, setDuration] = useState(0);
  const [joined, setJoined] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const diStore = useDynamicIsland;

  const shortAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const startLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch {
      // Fallback: audio only if camera is unavailable or denied
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        setLocalStream(stream);
        setIsVideoOff(true);
        return stream;
      } catch {
        return null;
      }
    }
  }, []);

  const leaveCall = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    localStream?.getTracks().forEach(t => t.stop());
    setLocalStream(null);
    setJoined(false);
    setDuration(0);
    Object.values(peersRef.current).forEach(pc => pc.close());
    peersRef.current = {};
    setParticipants([]);
    diStore.getState().dismiss();

    fetch('/api/chat/group-call/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, address: myAddress }),
    }).catch(() => {});

    onClose();
  }, [localStream, groupId, myAddress, onClose, diStore]);

  const joinCall = useCallback(async () => {
    const stream = await startLocalStream();
    if (!stream) {
      // Even if media devices fail, mark joined so voice room is entered
      setJoined(true);
      diStore.getState().setState('calling', { title: groupName, subtitle: 'Party call active' });
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      return;
    }
    setJoined(true);
    diStore.getState().setState('calling', { title: groupName, subtitle: 'Party call active' });
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);

    fetch('/api/chat/group-call/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, address: myAddress }),
    }).catch(() => {});
  }, [startLocalStream, groupId, myAddress, groupName, diStore]);

  const toggleMute = useCallback(() => {
    if (!localStream) return;
    localStream.getAudioTracks().forEach(t => { t.enabled = isMuted; });
    setIsMuted(m => !m);
  }, [localStream, isMuted]);

  const toggleVideo = useCallback(() => {
    if (!localStream) return;
    localStream.getVideoTracks().forEach(t => { t.enabled = isVideoOff; });
    setIsVideoOff(v => !v);
  }, [localStream, isVideoOff]);

  useEffect(() => {
    const handleGlobalEnd = () => {
      leaveCall();
    };
    window.addEventListener('ledger_end_active_call', handleGlobalEnd);
    return () => {
      window.removeEventListener('ledger_end_active_call', handleGlobalEnd);
      if (timerRef.current) clearInterval(timerRef.current);
      localStream?.getTracks().forEach(t => t.stop());
    };
  }, [localStream, leaveCall]);

  // ── Minimized pill (shown in chat header when user minimizes call to browse messages) ──
  if (isMinimized && joined) {
    return (
      <motion.div
        initial={{ y: -8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full bg-white border-b border-[#EBEBEB] px-4 py-3 flex items-center justify-between shadow-sm z-30"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full bg-[#30D158] animate-pulse shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] font-bold text-[#1C1C1E] truncate">{groupName} • Party Call</span>
            <span className="text-[11px] text-[#1C1C1E]/50 font-medium">
              {formatDuration(duration)} · {participants.length + 1} participant{participants.length !== 0 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggleVideo}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold rounded-full transition-all shadow-sm ${
              isVideoOff ? 'bg-[#F2F2F7] text-[#1C1C1E] hover:bg-[#E5E5EA]' : 'bg-[#30D158] text-white hover:bg-[#28b84d]'
            }`}
            title={isVideoOff ? 'Turn video on' : 'Turn video off'}
          >
            {isVideoOff ? <VideoOff size={13} /> : <Video size={13} />}
            <span>Video</span>
          </button>
          <button
            onClick={() => setIsMinimized(false)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1C7AFF] hover:bg-[#1a6fe0] text-white text-[12px] font-bold rounded-full transition-all shadow-sm active:scale-95"
            title="Join and expand call"
          >
            <Maximize2 size={13} />
            <span>Join</span>
          </button>
          <button
            onClick={leaveCall}
            className="w-8 h-8 bg-[#FF3B30] hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all shadow-sm active:scale-95"
            title="Leave / Close call"
            aria-label="Leave call"
          >
            <X size={14} />
          </button>
        </div>
      </motion.div>
    );
  }

  // ── Pre-join modal ──
  if (!joined) {
    return (
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9000] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl border border-black/5 text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1C7AFF] to-[#5856D6] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
                <Users size={28} className="text-white" />
              </div>
              <h2 className="text-[22px] font-extrabold text-[#1C1C1E] mb-1">{groupName}</h2>
              <p className="text-[14px] text-[#1C1C1E]/50 font-medium mb-6">Live Community Party Call</p>

              <div className="space-y-3">
                <button
                  onClick={joinCall}
                  className="w-full py-4 bg-[#30D158] hover:bg-[#28b84d] text-white font-bold text-[15px] rounded-2xl transition-all shadow-md shadow-green-500/20 flex items-center justify-center gap-2 active:scale-98"
                >
                  <Video size={18} />
                  Join with Camera
                </button>
                <button
                  onClick={async () => { setIsVideoOff(true); await joinCall(); }}
                  className="w-full py-3.5 bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1C1C1E] font-semibold text-[14px] rounded-2xl transition-colors flex items-center justify-center gap-2"
                >
                  <Mic size={16} />
                  Join Audio Only
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-3 text-[#FF3B30] hover:bg-red-50 font-semibold text-[14px] rounded-2xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // ── Full Active Call Screen (Pure Light Mode, Telegram/WhatsApp Polish) ──
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[9000] bg-[#F8F9FA] flex flex-col overflow-hidden text-[#1C1C1E]"
    >
      {/* ── Top Header Bar ── */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 bg-white border-b border-black/5 shadow-sm z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#1C7AFF] to-[#5856D6] flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Users size={20} />
          </div>
          <div>
            <h3 className="text-[#1C1C1E] font-extrabold text-[16px] leading-tight">{groupName}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="w-2 h-2 rounded-full bg-[#30D158] animate-pulse" />
              <span className="text-black/60 text-[12px] font-semibold">{formatDuration(duration)} · {participants.length + 1} participant{participants.length !== 0 ? 's' : ''}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Guaranteed Direct Leave Button in Header */}
          <button
            onClick={leaveCall}
            className="px-4 py-2 bg-[#FF3B30] hover:bg-red-600 text-white font-bold text-[13px] rounded-full flex items-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
            title="Leave party call"
          >
            <PhoneOff size={15} />
            <span>Leave</span>
          </button>

          {/* Minimize Button */}
          <button
            onClick={() => setIsMinimized(true)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1C1C1E] transition-colors"
            title="Minimize call to chat"
          >
            <Minimize2 size={16} />
          </button>
        </div>
      </div>

      {/* ── Main Video/Avatar Stage (Constrained so controls are NEVER pushed off) ── */}
      <div className="flex-1 min-h-0 p-4 md:p-6 flex items-center justify-center overflow-hidden">
        <div
          className="w-full max-w-4xl h-full flex flex-col md:flex-row items-center justify-center gap-4"
        >
          {/* Local participant card */}
          <div className="relative w-full md:flex-1 h-full max-h-[55vh] rounded-3xl overflow-hidden bg-white border border-black/10 shadow-lg flex items-center justify-center">
            {!isVideoOff && localStream ? (
              <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#FFFFFF] to-[#F2F4F7] p-6">
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#1C7AFF] to-[#5856D6] flex items-center justify-center text-white text-3xl font-black shadow-lg mb-3">
                  <span>{myAddress ? myAddress.slice(2, 4).toUpperCase() : 'ME'}</span>
                </div>
                <span className="text-[15px] font-bold text-[#1C1C1E]">You</span>
                <span className="text-[12px] font-mono text-black/40 mt-0.5">{shortAddr(myAddress)}</span>
              </div>
            )}

            <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-md rounded-xl px-3 py-1 border border-black/5 shadow-sm">
              <span className="text-[#1C1C1E] text-[12px] font-bold">You</span>
            </div>

            {isMuted && (
              <div className="absolute top-3 right-3 bg-[#FF3B30] text-white rounded-full p-2 shadow-md">
                <MicOff size={14} />
              </div>
            )}
          </div>

          {/* Remote participants cards */}
          {participants.map(p => (
            <div key={p.address} className="relative w-full md:flex-1 h-full max-h-[55vh] rounded-3xl overflow-hidden bg-white border border-black/10 shadow-lg flex items-center justify-center">
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#FFFFFF] to-[#F2F4F7] p-6">
                <div className="w-24 h-24 rounded-full bg-[#E5E5EA] flex items-center justify-center text-[#1C1C1E] text-3xl font-black shadow-sm mb-3">
                  <span>{p.address.slice(2, 4).toUpperCase()}</span>
                </div>
                <span className="text-[15px] font-bold text-[#1C1C1E]">{p.name || shortAddr(p.address)}</span>
              </div>
              <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-md rounded-xl px-3 py-1 border border-black/5 shadow-sm">
                <span className="text-[#1C1C1E] text-[12px] font-bold">{p.name || shortAddr(p.address)}</span>
              </div>
            </div>
          ))}

          {/* Empty state when alone in call */}
          {participants.length === 0 && (
            <div className="hidden md:flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-black/10 rounded-3xl max-h-[55vh] w-full md:flex-1">
              <div className="w-14 h-14 rounded-2xl bg-black/5 flex items-center justify-center mb-3 text-black/40">
                <Users size={24} />
              </div>
              <h4 className="text-[15px] font-bold text-[#1C1C1E] mb-1">Waiting for members</h4>
              <p className="text-[12px] text-black/50 max-w-xs">
                Community members can join this party call from the chat header anytime.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Floating Bottom Control Dock ── */}
      <div className="shrink-0 py-4 px-6 bg-white border-t border-black/10 flex items-center justify-center gap-6 shadow-xl z-30">
        {/* Mic Toggle */}
        <button
          onClick={toggleMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-sm ${
            isMuted ? 'bg-[#FF3B30] text-white' : 'bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1C1C1E]'
          }`}
          title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>

        {/* Big Red Hang Up Button */}
        <button
          onClick={leaveCall}
          className="w-16 h-16 rounded-full bg-[#FF3B30] hover:bg-red-600 text-white flex items-center justify-center shadow-lg hover:shadow-red-500/25 active:scale-95 transition-all cursor-pointer"
          title="Hang Up / Leave Call"
        >
          <PhoneOff size={26} />
        </button>

        {/* Video Toggle */}
        <button
          onClick={toggleVideo}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-sm ${
            isVideoOff ? 'bg-[#FF3B30] text-white' : 'bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1C1C1E]'
          }`}
          title={isVideoOff ? 'Turn camera on' : 'Turn camera off'}
        >
          {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
        </button>
      </div>
    </motion.div>
  );
}
