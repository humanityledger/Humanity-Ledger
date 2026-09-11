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

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (!stream || stream.getVideoTracks().length === 0 || stream.getVideoTracks()[0].enabled === false) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-[#1a1a1a] rounded-2xl overflow-hidden transition-all duration-300 ${isSpeaking ? 'ring-4 ring-green-500' : ''}`}>
         <div className="w-24 h-24 rounded-full bg-[#333] flex items-center justify-center text-white text-3xl font-bold">
           {isLocal ? 'Me' : 'Peer'}
         </div>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={isLocal || muted}
      className={`w-full h-full object-cover rounded-2xl bg-black transition-all duration-300 ${isLocal ? 'scale-x-[-1]' : ''} ${isSpeaking ? 'ring-4 ring-green-500' : ''}`}
    />
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
        className="fixed bottom-24 right-4 md:right-8 w-40 md:w-64 aspect-[3/4] bg-black rounded-3xl shadow-2xl border border-white/20 overflow-hidden z-[500] cursor-grab active:cursor-grabbing flex flex-col select-none"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={onToggleMinimize}
      >
        <div className="flex-1 relative overflow-hidden">
          <VideoStream stream={isCameraOff ? null : localStream} isLocal={true} muted={true} isSpeaking={false} />
          {participants.length > 0 && (
            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-full text-[10px] text-white font-bold flex items-center gap-1">
              <Users size={12} /> +{participants.length}
            </div>
          )}
          {isScreenSharing && (
            <div className="absolute top-2 left-2 bg-green-500/80 backdrop-blur-md px-2 py-1 rounded-full text-[10px] text-white font-bold flex items-center gap-1">
              <MonitorUp size={12} />
            </div>
          )}
        </div>
        <div className="h-12 bg-[#111] flex items-center justify-around px-2 border-t border-white/10" onClick={e => e.stopPropagation()}>
          <button onClick={onToggleMute} className={`p-2 rounded-full transition-colors ${isMuted ? 'text-red-400 bg-red-400/10' : 'text-white hover:bg-white/10'}`}>
            {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
          <button onClick={onEndCall} className="p-2 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors">
            <PhoneOff size={16} />
          </button>
          <button onClick={onToggleMinimize} className="p-2 rounded-full text-white/50 hover:text-white transition-colors hover:bg-white/10">
            <Maximize2 size={16} />
          </button>
        </div>
      </motion.div>
    );
  }

  // --- Fullscreen View ---
  return (
    <div className="fixed inset-0 z-[1000] bg-black flex flex-col overflow-hidden font-sans">
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
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10">
                <Shield size={24} className="text-green-400" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  Secure Room
                  {roomId && <span className="text-xs font-mono bg-white/20 px-2 py-0.5 rounded-md">{roomId}</span>}
                </h3>
                <p className="text-white/60 text-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  E2E Encrypted
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {roomId && (
                <button 
                  onClick={() => setShowRoomInfo(!showRoomInfo)}
                  className="px-4 py-2 rounded-xl bg-white/10 backdrop-blur-md flex items-center gap-2 text-white hover:bg-white/20 transition-colors text-sm font-medium border border-white/10"
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
            className="absolute top-24 right-6 w-80 bg-[#1a1a1a] border border-[#333] rounded-2xl shadow-2xl p-5 z-[60]"
          >
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-white font-bold">Room Info</h4>
              <button onClick={() => setShowRoomInfo(false)} className="text-white/50 hover:text-white"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/50 uppercase tracking-wider font-bold mb-1 block">Room ID</label>
                <div className="bg-black border border-[#333] rounded-xl p-3 font-mono text-white text-lg text-center tracking-[0.2em]">
                  {roomId}
                </div>
              </div>
              {roomPassword && (
                <div>
                  <label className="text-xs text-white/50 uppercase tracking-wider font-bold mb-1 block">Password</label>
                  <div className="bg-black border border-[#333] rounded-xl p-3 font-mono text-white text-lg text-center tracking-[0.2em]">
                    {roomPassword}
                  </div>
                </div>
              )}
              <button 
                onClick={copyRoomInfo}
                className="w-full flex items-center justify-center gap-2 py-3 bg-white text-black font-bold rounded-xl hover:bg-white/90 transition-colors"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? 'Copied!' : 'Copy Invitation'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video Grid */}
      <div className="flex-1 p-4 flex items-center justify-center pt-24 pb-32" onClick={() => setActiveMenu(null)}>
        <div className={`w-full h-full max-w-7xl grid ${gridCols} gap-4 auto-rows-fr`}>
          {/* Local Stream */}
          <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-[#111] group">
            <VideoStream stream={localStream} isLocal={!isScreenSharing} muted={true} isSpeaking={!!speakingMap[myAddress]} />
            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
              <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-white text-sm font-medium flex items-center gap-2 border border-white/10">
                 You (Me) {isMuted && <MicOff size={14} className="text-red-400" />}
                 {isModerator && <Shield size={12} className="text-yellow-400 ml-1" />}
              </div>
            </div>
          </div>

          {/* Remote Streams */}
          {participants.map((p) => {
            const isPeerModerator = p.address.toLowerCase() === moderatorAddress.toLowerCase();
            return (
              <div key={p.address} className="relative rounded-2xl overflow-hidden shadow-2xl bg-[#111] group">
                <VideoStream stream={p.stream} isLocal={false} muted={p.isMuted} isSpeaking={!!speakingMap[p.address]} />
                <div className="absolute bottom-4 left-4 flex items-center gap-2">
                  <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-white text-sm font-medium flex items-center gap-2 border border-white/10">
                    {p.address.slice(0, 6)}...{p.address.slice(-4)}
                    {p.isMuted && <MicOff size={14} className="text-red-400" />}
                    {isPeerModerator && <Shield size={12} className="text-yellow-400 ml-1" />}
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
                      className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity border border-white/10"
                    >
                      <MoreVertical size={16} />
                    </button>
                    {activeMenu === p.address && (
                      <div className="absolute top-10 right-0 w-48 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl py-2 z-50">
                        <button 
                          onClick={() => { onTransferModerator(p.address); setActiveMenu(null); }}
                          className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 flex items-center gap-2"
                        >
                          <Shield size={14} /> Make Moderator
                        </button>
                        <button 
                          onClick={() => { onKickParticipant(p.address); setActiveMenu(null); }}
                          className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-400/10 flex items-center gap-2"
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
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 md:gap-4 bg-[#111]/80 backdrop-blur-xl p-3 md:p-4 rounded-3xl border border-white/10 z-50 shadow-2xl"
            style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <button 
              onClick={onToggleMute}
              className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-[#ff3b30] text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
            </button>

            <button 
              onClick={onToggleCamera}
              className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all ${isCameraOff ? 'bg-[#ff3b30] text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
              title={isCameraOff ? "Turn Camera On" : "Turn Camera Off"}
            >
              {isCameraOff ? <VideoOff size={22} /> : <Video size={22} />}
            </button>

            <div className="w-px h-8 bg-white/20 mx-2" />

            <button 
              onClick={onToggleScreenShare}
              className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all ${isScreenSharing ? 'bg-green-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
              title="Share Screen"
            >
              <MonitorUp size={22} />
            </button>

            {roomId && (
              <button 
                onClick={() => setShowRoomInfo(true)}
                className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-all"
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
  );
}

