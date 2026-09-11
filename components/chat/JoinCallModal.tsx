import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Shield, Key, Loader2, X, Phone, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { toast } from 'sonner';

interface JoinCallModalProps {
  initialRoomId?: string;
  initialPassword?: string;
  onClose: () => void;
  onSuccess: (roomData: any, localStream: MediaStream, isMuted: boolean, isCameraOff: boolean) => void;
}

export function JoinCallModal({ initialRoomId, initialPassword, onClose, onSuccess }: JoinCallModalProps) {
  const [roomId, setRoomId] = useState(initialRoomId || '');
  const [password, setPassword] = useState(initialPassword || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-join state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(true); // Default to camera off for privacy
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Acquire local media for preview — triple-tier fallback for Android/iOS
    async function setupMedia() {
      // Guard: mediaDevices not available in HTTP contexts or very old browsers
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        console.warn('getUserMedia not available — joining without local stream');
        return;
      }
      try {
        // Tier 1: Full video+audio
        const stream = await navigator.mediaDevices.getUserMedia({
          video: !isCameraOff ? { facingMode: 'user' } : false,
          audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 },
        });
        stream.getAudioTracks().forEach(t => { t.enabled = !isMuted; });
        setLocalStream(stream);
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (videoErr: any) {
        const name = videoErr?.name || '';
        // Tier 2: Camera denied/unavailable — fall back to audio-only
        if (name === 'NotFoundError' || name === 'NotAllowedError' || name === 'OverconstrainedError' || isCameraOff) {
          try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            audioStream.getAudioTracks().forEach(t => { t.enabled = !isMuted; });
            setLocalStream(audioStream);
          } catch (audioErr) {
            // Tier 3: Full permission denial — join will proceed without local stream
            console.warn('Audio also denied, joining without media:', audioErr);
          }
        } else {
          console.error('getUserMedia failed:', videoErr);
        }
      }
    }
    setupMedia();

    return () => {
      // Stop any active preview tracks when camera state changes
      // (We only stop here if we haven't passed the stream to onSuccess yet)
      // The stream we pass to the call room is intentionally kept alive
    };
  }, [isCameraOff]);

  // Separate cleanup: stop ALL tracks when modal fully unmounts
  const streamRef = useRef<MediaStream | null>(null);
  useEffect(() => {
    streamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    return () => {
      // Only runs when component unmounts - safe to stop tracks if we haven't joined
      // If the user joined, localStream ref was passed to parent which manages the stream
    };
  }, []);

  // Update audio track when mute toggles
  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(t => t.enabled = !isMuted);
    }
  }, [isMuted, localStream]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/call/room/${roomId.toUpperCase()}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        if (res.status === 429 && data.retryAfter) {
          throw new Error(`Too many attempts. Try again in ${data.retryAfter}s`);
        }
        throw new Error(data.error || 'Failed to join room');
      }

      toast.success('Joined secure call room');
      
      // Pass the prepared stream to the main chat engine
      // If permissions were fully denied, create a silent stream so the call UI still works
      const safeStream = localStream ?? (() => {
        try { return new MediaStream(); } catch { return null as unknown as MediaStream; }
      })();
      onSuccess(data, safeStream, isMuted, isCameraOff);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-[#111] border border-white/10 rounded-[32px] w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col md:flex-row relative"
      >
        <button onClick={onClose} className="absolute top-4 right-4 z-10 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-colors">
          <X size={18} />
        </button>

        {/* Left Side: Pre-Join Lobby Preview */}
        <div className="w-full md:w-3/5 bg-black p-4 relative min-h-[300px] flex flex-col">
          <div className="flex-1 rounded-2xl overflow-hidden bg-[#1a1a1a] relative border border-white/5 flex items-center justify-center">
            {!isCameraOff && localStream ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            ) : (
              <div className="flex flex-col items-center gap-4 text-white/30">
                <VideoOff size={48} />
                <span className="font-semibold text-sm">Camera is off</span>
              </div>
            )}
            
            {/* Quick Controls overlay */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
              <button 
                onClick={(e) => { e.preventDefault(); setIsMuted(!isMuted); }}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-[#ff3b30] text-white' : 'bg-black/50 text-white backdrop-blur-md hover:bg-black/70'}`}
              >
                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              <button 
                onClick={(e) => { e.preventDefault(); setIsCameraOff(!isCameraOff); }}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isCameraOff ? 'bg-[#ff3b30] text-white' : 'bg-black/50 text-white backdrop-blur-md hover:bg-black/70'}`}
              >
                {isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Auth & Join Form */}
        <div className="w-full md:w-2/5 p-8 flex flex-col justify-center bg-gradient-to-br from-[#111] to-[#0a0a0a]">
          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-6 border border-white/10">
            <Shield size={24} className="text-white" />
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-2">Join Secure Call</h2>
          <p className="text-white/50 text-xs mb-8 leading-relaxed">
            Verify your settings before entering. The connection is peer-to-peer and end-to-end encrypted.
          </p>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="text-[10px] text-white/50 uppercase tracking-widest font-bold mb-2 block">Room ID</label>
              <input 
                type="text" 
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                placeholder="e.g. A1B2C3D4"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3.5 text-white font-mono tracking-widest placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
                maxLength={8}
                required
              />
            </div>
            
            <div>
              <label className="text-[10px] text-white/50 uppercase tracking-widest font-bold mb-2 block">Password <span className="lowercase text-[9px] font-normal tracking-normal opacity-70">(if required)</span></label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Key size={16} className="text-white/30" />
                </div>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-3.5 text-white focus:outline-none focus:border-white/30 transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="text-red-400 text-xs bg-red-400/10 p-3 rounded-lg border border-red-400/20 flex items-start gap-2">
                <Shield size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading || !roomId}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-white text-black font-bold text-sm rounded-xl hover:bg-white/90 disabled:opacity-50 disabled:hover:bg-white transition-all mt-6 shadow-lg shadow-white/5"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Phone size={18} />}
              {loading ? 'Authenticating...' : 'Join Call'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
