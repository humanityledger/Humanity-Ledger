import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Video, VideoOff, PhoneOff, UserPlus, Users, MoreVertical, Shield, ScreenShare, Copy, Check, MessageSquare, X, MonitorUp, Maximize2, Minimize2 } from 'lucide-react';
import { Participant } from '@/lib/engine/WebRTCEngine';
import { toast } from 'sonner';

interface GroupCallRoomProps {
  localStream: MediaStream | null;
  participants: Participant[];
  isMuted: boolean;
  isCameraOff: boolean;
  myAddress: string;
  roomId: string;
  roomPassword?: string;
  moderatorAddress: string;
  isScreenSharing: boolean;
  isMinimized: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onEndCall: () => void;               // Leave — you exit, others stay
  onEndCallForEveryone: () => void;    // End for all — moderator only
  onAddParticipant: () => void;
  onToggleScreenShare: () => void;
  onKickParticipant: (address: string) => void;
  onTransferModerator: (address: string) => void;
  onToggleMinimize: () => void;
}


const VideoStream = ({ stream, isLocal, muted, isSpeaking }: { stream: MediaStream | null; isLocal: boolean; muted: boolean; isSpeaking: boolean }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    const checkTracks = () => {
      if (!stream) {
        setHasVideo(false);
        return;
      }
      const vTracks = stream.getVideoTracks();
      setHasVideo(vTracks.length > 0 && vTracks[0].enabled);
    };
    checkTracks();
    if (stream) {
      if (videoRef.current) videoRef.current.srcObject = stream;
      if (audioRef.current) audioRef.current.srcObject = stream;
    }
    // Set up listeners for dynamic track changes (camera toggle)
    const interval = setInterval(checkTracks, 500); // Polling as fallback since track events don't always fire
    return () => clearInterval(interval);
  }, [stream]);

  return (
    <div className={`relative w-full h-full flex items-center justify-center bg-white rounded-2xl overflow-hidden transition-all duration-300 ${isSpeaking ? 'ring-4 ring-[#34C759]' : ''}`}>
      {/* ALWAYS render an audio element to ensure voice is heard even if video is off */}
      <audio ref={audioRef} autoPlay playsInline muted={isLocal || muted} className="hidden" />
      
      {/* Video element - always present but hidden if no video track */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal || muted}
        className={`absolute inset-0 w-full h-full object-contain bg-black transition-opacity duration-300 ${isLocal ? 'scale-x-[-1]' : ''} ${hasVideo ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />
      
      {/* Audio-only avatar fallback */}
      {!hasVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-white z-10 pointer-events-none">
            <div className="w-24 h-24 rounded-full bg-[#d1d1d6] flex items-center justify-center text-black text-3xl font-bold shadow-xl">
              <span>{isLocal ? 'Me' : 'Peer'}</span>
            </div>
        </div>
      )}
    </div>
  );
};

export function GroupCallRoom({
  localStream,
  participants,
  isMuted,
  isCameraOff,
  myAddress,
  roomId,
  roomPassword,
  moderatorAddress,
  isScreenSharing,
  isMinimized,
  onToggleMute,
  onToggleCamera,
  onEndCall,
  onEndCallForEveryone,
  onAddParticipant,
  onToggleScreenShare,
  onKickParticipant,
  onTransferModerator,
  onToggleMinimize
}: GroupCallRoomProps) {
  const [showControls, setShowControls] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{sender: string, text: string, time: number, isSystem?: boolean}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Listen for broadcast messages
  useEffect(() => {
    const handleData = (e: any) => {
      if (e.detail.type === 'chat') {
        setChatMessages(prev => [...prev, { sender: e.detail.payload.sender, text: e.detail.payload.text, time: Date.now() }]);
        if (!showChat) toast.info('New message in room chat');
      } else if (e.detail.type === 'system') {
        setChatMessages(prev => [...prev, { sender: 'System', text: e.detail.payload.text, time: Date.now(), isSystem: true }]);
      }
    };
    window.addEventListener('webrtc_data_message', handleData);
    return () => window.removeEventListener('webrtc_data_message', handleData);
  }, [showChat]);

  // Monitor participant joins/leaves to emit system messages locally
  const prevParticipantsRef = useRef(participants.map(p => p.address));
  useEffect(() => {
    const current = participants.map(p => p.address);
    const joined = current.filter(a => !prevParticipantsRef.current.includes(a));
    const left = prevParticipantsRef.current.filter(a => !current.includes(a));
    joined.forEach(a => setChatMessages(prev => [...prev, { sender: 'System', text: `${a.slice(0,6)}... just joined`, time: Date.now(), isSystem: true }]));
    left.forEach(a => setChatMessages(prev => [...prev, { sender: 'System', text: `${a.slice(0,6)}... left`, time: Date.now(), isSystem: true }]));
    prevParticipantsRef.current = current;
  }, [participants]);

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatMessages, showChat]);
  const [showRoomInfo, setShowRoomInfo] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  
  // Basic audio level detection (visual only)
  const [speakingMap, setSpeakingMap] = useState<Record<string, boolean>>({});

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => {
        if (!activeMenu && !showRoomInfo) setShowControls(false);
      }, 4000);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [activeMenu, showRoomInfo]);

  const copyRoomInfo = () => {
    const info = `Join my secure call on Humanity Ledger\nRoom ID: ${roomId}${roomPassword ? `\nPassword: ${roomPassword}` : ''}`;
    navigator.clipboard.writeText(info);
    setCopied(true);
    toast.success('Room info copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const isModerator = myAddress.toLowerCase() === moderatorAddress.toLowerCase();
  const totalParticipants = participants.length + 1;
  const gridCols = totalParticipants === 1 ? 'grid-cols-1' :
                   totalParticipants === 2 ? 'grid-cols-1 sm:grid-cols-2' :
                   totalParticipants <= 4 ? 'grid-cols-2' : 'grid-cols-3 md:grid-cols-4';

  // --- PiP View (Minimized) ---
  if (isMinimized) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.8, y: 50, x: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
        exit={{ opacity: 0, scale: 0.8 }}
        drag
        dragMomentum={false}
        dragElastic={0.05}
        whileDrag={{ scale: 1.05 }}
        className="fixed bottom-24 right-4 md:right-8 w-40 md:w-64 aspect-[3/4] bg-white rounded-3xl shadow-2xl border border-black/[0.08] overflow-hidden z-[500] cursor-grab active:cursor-grabbing flex flex-col select-none"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={onToggleMinimize}
      >
        <div className="flex-1 relative overflow-hidden">
          <VideoStream stream={isCameraOff ? null : localStream} isLocal={true} muted={true} isSpeaking={false} />
          {participants.length > 0 && (
            <div className="absolute top-2 right-2 bg-white/90 text-black backdrop-blur-md px-2 py-1 rounded-full text-[10px] text-black font-bold flex items-center gap-1">
              <Users size={12} /> +{participants.length}
            </div>
          )}
          {isScreenSharing && (
            <div className="absolute top-2 left-2 bg-green-500/80 backdrop-blur-md px-2 py-1 rounded-full text-[10px] text-black font-bold flex items-center gap-1">
              <MonitorUp size={12} />
            </div>
          )}
        </div>
        <div className="h-12 bg-white flex items-center justify-around px-2 border-t border-black/[0.08]" onClick={e => e.stopPropagation()}>
          <button onClick={onToggleMute} className={`p-2 rounded-full transition-colors ${isMuted ? 'text-red-500 bg-red-500/10' : 'text-black hover:bg-white/10'}`}>
            {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
          <button onClick={onEndCall} className="p-2 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors">
            <PhoneOff size={16} />
          </button>
          <button onClick={onToggleMinimize} className="p-2 rounded-full text-black/50 hover:text-black transition-colors hover:bg-white/10">
            <Maximize2 size={16} />
          </button>
        </div>
      </motion.div>
    );
  }

  // --- Fullscreen View ---
  return (
    <div className="fixed inset-0 z-[1000] bg-white flex flex-row overflow-hidden font-sans">
      <div className={`flex-1 flex flex-col relative transition-all duration-300 ${showChat ? 'mr-[380px]' : ''}`}>
      {/* Header */}
      <AnimatePresence>
        {showControls && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-50 bg-gradient-to-b from-black/80 to-transparent"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-black/[0.08]">
                <Shield size={24} className="text-green-400" />
              </div>
              <div>
                <h3 className="text-black font-bold text-lg flex items-center gap-2">
                  Secure Room
                  {roomId && <span className="text-xs font-mono bg-white/20 px-2 py-0.5 rounded-md">{roomId}</span>}
                </h3>
                <p className="text-black/60 text-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  E2E Encrypted
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {roomId && (
                <button 
                  onClick={() => setShowRoomInfo(!showRoomInfo)}
                  className="px-4 py-2 rounded-xl bg-white/10 backdrop-blur-md flex items-center gap-2 text-black hover:bg-white/20 transition-colors text-sm font-medium border border-black/[0.08]"
                >
                  <Users size={16} /> Invite
                </button>
              )}
            </div>
          </motion.div>
        )}
</AnimatePresence>

      {/* Room Info Modal */}
      <AnimatePresence>
        {showRoomInfo && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute top-24 right-6 w-80 bg-white border border-black/[0.08] rounded-2xl shadow-2xl p-5 z-[60]"
          >
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-black font-bold">Room Info</h4>
              <button onClick={() => setShowRoomInfo(false)} className="text-black/50 hover:text-black"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-black/50 uppercase tracking-wider font-bold mb-1 block">Room ID</label>
                <div className="bg-white border border-black/[0.08] rounded-xl p-3 font-mono text-black text-lg text-center tracking-[0.2em]">
                  {roomId}
                </div>
              </div>
              {roomPassword && (
                <div>
                  <label className="text-xs text-black/50 uppercase tracking-wider font-bold mb-1 block">Password</label>
                  <div className="bg-white border border-black/[0.08] rounded-xl p-3 font-mono text-black text-lg text-center tracking-[0.2em]">
                    {roomPassword}
                  </div>
                </div>
              )}
              <button 
                onClick={copyRoomInfo}
                className="w-full flex items-center justify-center gap-2 py-3 bg-white text-black font-bold rounded-xl hover:bg-white/90 transition-colors"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                <span>{copied ? 'Copied!' : 'Copy Invitation'}</span>
              </button>
            </div>
          </motion.div>
        )}
</AnimatePresence>

      {/* Video Grid */}
      <div className="flex-1 p-4 flex items-center justify-center pt-24 pb-32" onClick={() => setActiveMenu(null)}>
        <div className={`w-full h-full max-w-7xl grid ${gridCols} gap-4 auto-rows-fr`}>
          {/* Local Stream */}
          <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-white group">
            <VideoStream stream={localStream} isLocal={!isScreenSharing} muted={true} isSpeaking={!!speakingMap[myAddress]} />
            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
              <div className="bg-white/90 text-black backdrop-blur-md px-3 py-1.5 rounded-lg text-black text-sm font-medium flex items-center gap-2 border border-black/[0.08]">
                 You (Me) {isMuted && <MicOff size={14} className="text-red-500" />}
                 {isModerator && <Shield size={12} className="text-[#FF9500] ml-1" />}
              </div>
            </div>
          </div>

          {/* Remote Streams */}
          {participants.map((p) => {
            const isPeerModerator = p.address.toLowerCase() === moderatorAddress.toLowerCase();
            return (
              <div key={p.address} className="relative rounded-2xl overflow-hidden shadow-2xl bg-white group">
                <VideoStream stream={p.stream} isLocal={false} muted={p.isMuted} isSpeaking={!!speakingMap[p.address]} />
                <div className="absolute bottom-4 left-4 flex items-center gap-2">
                  <div className="bg-white/90 text-black backdrop-blur-md px-3 py-1.5 rounded-lg text-black text-sm font-medium flex items-center gap-2 border border-black/[0.08]">
                    {p.address.slice(0, 6)}...{p.address.slice(-4)}
                    {p.isMuted && <MicOff size={14} className="text-red-500" />}
                    {isPeerModerator && <Shield size={12} className="text-[#FF9500] ml-1" />}
                    {/* Network quality dot: green <100ms, yellow 100-250ms, red >250ms */}
                    {p.networkRtt !== undefined && (
                      <span
                        title={`RTT: ${Math.round(p.networkRtt)}ms${p.networkPacketLoss ? ` · Loss: ${p.networkPacketLoss}` : ''}`}
                        className={`w-2 h-2 rounded-full ml-1 ${p.networkRtt < 100 ? 'bg-green-400' : p.networkRtt < 250 ? 'bg-yellow-400' : 'bg-red-400'}`}
                      />
                    )}
                  </div>
                </div>

                {/* Moderator Actions Menu */}
                {isModerator && (
                  <div className="absolute top-4 right-4">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === p.address ? null : p.address); }}
                      className="w-8 h-8 rounded-full bg-white/90 text-black backdrop-blur-md flex items-center justify-center text-black opacity-0 group-hover:opacity-100 transition-opacity border border-black/[0.08]"
                    >
                      <MoreVertical size={16} />
                    </button>
                    {activeMenu === p.address && (
                      <div className="absolute top-10 right-0 w-48 bg-white border border-black/[0.08] rounded-xl shadow-2xl py-2 z-50">
                        <button 
                          onClick={() => { onTransferModerator(p.address); setActiveMenu(null); }}
                          className="w-full text-left px-4 py-2 text-sm text-black hover:bg-white/10 flex items-center gap-2"
                        >
                          <Shield size={14} /> Make Moderator
                        </button>
                        <button 
                          onClick={() => { onKickParticipant(p.address); setActiveMenu(null); }}
                          className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-400/10 flex items-center gap-2"
                        >
                          <PhoneOff size={14} /> Remove from call
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <AnimatePresence>
        {showControls && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 md:gap-4 bg-white/90 backdrop-blur-xl p-3 md:p-4 rounded-3xl border border-black/[0.08] z-50 shadow-2xl"
            style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <button 
              onClick={onToggleMute}
              className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-[#ff3b30] text-white' : 'bg-black/5 text-black hover:bg-black/10'}`}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
            </button>

            <button 
              onClick={onToggleCamera}
              className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all ${isCameraOff ? 'bg-[#ff3b30] text-white' : 'bg-black/5 text-black hover:bg-black/10'}`}
              title={isCameraOff ? "Turn Camera On" : "Turn Camera Off"}
            >
              {isCameraOff ? <VideoOff size={22} /> : <Video size={22} />}
            </button>

            <div className="w-px h-8 bg-white/20 mx-2" />

            <button 
              onClick={onToggleScreenShare}
              className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all ${isScreenSharing ? 'bg-green-500 text-white' : 'bg-black/5 text-black hover:bg-black/10'}`}
              title="Share Screen"
            >
              <MonitorUp size={22} />
            </button>

            {roomId && (
              <button 
                onClick={() => setShowRoomInfo(true)}
                className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-black/5 text-black hover:bg-black/10 flex items-center justify-center transition-all"
                title="Add Participants"
              >
                <UserPlus size={22} />
              </button>
            )}

            <div className="w-px h-8 bg-white/20 mx-2" />

            {/* LEAVE = you exit, others stay in the call */}
            <button 
              onClick={onEndCall}
              className="flex items-center gap-2 h-14 px-5 rounded-full bg-[#ff9500] hover:bg-[#ffaa22] text-white font-bold text-sm flex items-center justify-center transition-all shadow-lg"
              title="Leave Call (others stay)"
            >
              <PhoneOff size={20} />
              <span className="hidden md:inline">Leave</span>
            </button>

            {/* END FOR EVERYONE = only moderator can do this */}
            {isModerator && (
              <button 
                onClick={onEndCallForEveryone}
                className="flex items-center gap-2 h-14 px-5 rounded-full bg-[#ff3b30] hover:bg-[#ff4b40] text-white font-bold text-sm flex items-center justify-center transition-all shadow-lg hover:shadow-red-500/50"
                title="End Call for Everyone (Moderator)"
              >
                <PhoneOff size={20} />
                <span className="hidden md:inline">End All</span>
              </button>
            )}
          </motion.div>
        )}
</AnimatePresence>
      </div>
      {/* Chat Sidebar */}
      {showChat && (
        <div className="absolute right-0 top-0 bottom-0 w-[380px] max-w-full bg-white border-l border-black/10 flex flex-col z-[2000] shadow-2xl animate-in slide-in-from-right">
          <div className="p-4 border-b border-black/[0.08] flex justify-between items-center bg-white">
            <h3 className="text-black font-bold text-lg flex items-center gap-2"><MessageSquare size={18}/> Room Chat</h3>
            <button onClick={() => setShowChat(false)} className="p-2 rounded-full hover:bg-white/10 text-black/60 hover:text-black"><X size={18} /></button>
          </div>
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {chatMessages.length === 0 && <p className="text-center text-black/30 text-sm mt-10">No messages yet. Say hello!</p>}
            {chatMessages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.sender === myAddress ? 'items-end' : m.isSystem ? 'items-center' : 'items-start'}`}>
                {!m.isSystem && <span className="text-[10px] text-black/40 mb-1 px-1">{m.sender === myAddress ? 'Me' : m.sender.slice(0,6)}</span>}
                <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${m.isSystem ? 'bg-black/5 text-black/60 rounded-full text-xs py-1 px-3' : m.sender === myAddress ? 'bg-[#34C759] text-white rounded-br-sm' : 'bg-[#f0f0f5] text-black rounded-bl-sm'}`}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 bg-white border-t border-black/5">
            <form onSubmit={e => { e.preventDefault(); if(chatInput.trim()) { window.dispatchEvent(new CustomEvent('webrtc_broadcast_request', { detail: { type: 'chat', payload: { text: chatInput, sender: myAddress } } })); setChatMessages(prev => [...prev, { sender: myAddress, text: chatInput, time: Date.now() }]); setChatInput(''); } }} className="flex gap-2">
              <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Message room..." className="flex-1 bg-[#f5f5f7] text-black text-sm rounded-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#34C759]/50" />
              <button type="submit" disabled={!chatInput.trim()} className="w-10 h-10 rounded-full bg-[#34C759] text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shrink-0"><Check size={16} /></button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}




