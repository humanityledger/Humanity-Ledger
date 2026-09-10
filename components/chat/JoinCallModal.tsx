import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Key, Loader2, X, Phone } from 'lucide-react';
import { toast } from 'sonner';

interface JoinCallModalProps {
  onClose: () => void;
  onSuccess: (roomData: any) => void;
}

export function JoinCallModal({ onClose, onSuccess }: JoinCallModalProps) {
  const [roomId, setRoomId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        throw new Error(data.error || 'Failed to join room');
      }

      toast.success('Joined secure call room');
      onSuccess(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#111] border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors">
          <X size={20} />
        </button>

        <div className="p-8">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-6 border border-white/10">
            <Shield size={32} className="text-white" />
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-2">Join Secure Call</h2>
          <p className="text-white/50 text-sm mb-8 leading-relaxed">
            Enter the Room ID and password provided by the host. The connection is peer-to-peer and end-to-end encrypted.
          </p>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="text-xs text-white/50 uppercase tracking-wider font-bold mb-2 block">Room ID</label>
              <input 
                type="text" 
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                placeholder="e.g. A1B2C3D4"
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-4 text-white font-mono tracking-widest placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
                maxLength={8}
                required
              />
            </div>
            
            <div>
              <label className="text-xs text-white/50 uppercase tracking-wider font-bold mb-2 block">Password <span className="lowercase text-[10px] font-normal tracking-normal">(if required)</span></label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Key size={16} className="text-white/30" />
                </div>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full bg-black border border-white/10 rounded-xl pl-11 pr-4 py-4 text-white focus:outline-none focus:border-white/30 transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="text-red-400 text-sm bg-red-400/10 p-3 rounded-lg border border-red-400/20">
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading || !roomId}
              className="w-full flex items-center justify-center gap-2 py-4 bg-white text-black font-bold rounded-xl hover:bg-white/90 disabled:opacity-50 disabled:hover:bg-white transition-all mt-4"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : <Phone size={20} />}
              {loading ? 'Authenticating...' : 'Join Call'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
