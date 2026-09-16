"use client";
import React, { useState, useEffect } from 'react';
import { useHumanityAppchain } from '@/hooks/useHumanityAppchain';
import { useAccount } from 'wagmi';
import { Loader2, Send, ShieldCheck, Activity, Users } from 'lucide-react';
import { toast } from 'sonner';

export function LedgerChatOnChain() {
  const { address, isConnected } = useAccount();
  const { isReady, registerIdentity, sendOnChainMessage } = useHumanityAppchain();
  
  const [messages, setMessages] = useState<{sender: string, text: string}[]>([]);
  const [input, setInput] = useState('');
  const [activeRoom, setActiveRoom] = useState<string>('0x0000000000000000000000000000000000000000000000000000000000000001');
  const [isRegistering, setIsRegistering] = useState(false);

  // Simulated subscription to On-Chain events (Fase 2 demo)
  useEffect(() => {
    const timer = setInterval(() => {
      // In a real implementation this would be `useContractEvent` from wagmi
      // Here we just keep the UI alive and responsive
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleRegister = async () => {
    try {
      setIsRegistering(true);
      if (registerIdentity) {
        await registerIdentity({ args: ["Sovereign Human", "https://humanidfi.com/avatar.png", "On-Chain Pioneer", "0x0000000000000000000000000000000000000000000000000000000000000000"] });
        toast.success("Identity registered On-Chain (Gasless via Paymaster)");
      }
    } catch (e: any) {
      toast.error("Registration failed: " + e.message);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !sendOnChainMessage) return;

    const msg = input.trim();
    setInput('');
    
    // Optimistic UI update
    setMessages(prev => [...prev, { sender: address as string, text: msg }]);

    try {
      await sendOnChainMessage({ args: [activeRoom, msg] });
      toast.success("Message secured on Humanity Chain");
    } catch (e: any) {
      toast.error("Failed to broadcast on-chain: " + e.message);
    }
  };

  if (!isConnected) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white h-full font-mono">
        <ShieldCheck size={48} className="text-black/20 mb-4" />
        <h2 className="text-xl font-bold tracking-widest uppercase mb-2">Wallet Disconnected</h2>
        <p className="text-sm text-black/50">Connect your Web3 wallet to access the On-Chain Ledger</p>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white h-full font-mono">
        <Loader2 size={32} className="animate-spin text-black mb-4" />
        <p className="text-sm tracking-widest font-bold">SYNCING HUMANITY APPCHAIN...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white h-full font-sans border-x border-black/10 max-w-5xl mx-auto shadow-2xl relative overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-black/[0.08] flex justify-between items-center bg-black/5 backdrop-blur-md z-10">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-black flex items-center gap-2">
            <Activity className="text-green-500" />
            ON-CHAIN LEDGER CHAT
          </h1>
          <p className="text-xs font-mono text-black/50 uppercase tracking-widest mt-1">Secured by Humanity Paymaster • Gasless</p>
        </div>
        <button 
          onClick={handleRegister}
          disabled={isRegistering}
          className="px-4 py-2 bg-black text-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-black/80 transition-colors disabled:opacity-50"
        >
          {isRegistering ? 'Registering...' : 'Register Identity'}
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 z-10">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full opacity-30">
            <Users size={48} className="mb-4" />
            <p className="font-mono text-sm tracking-widest uppercase">Room is empty. Broadcast the first truth.</p>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex flex-col ${m.sender === address ? 'items-end' : 'items-start'}`}>
              <span className="text-[10px] text-black/40 font-mono mb-1">{m.sender === address ? 'Me' : m.sender.slice(0,6)}</span>
              <div className={`px-4 py-2 rounded-2xl max-w-[80%] shadow-sm ${m.sender === address ? 'bg-black text-white rounded-br-sm' : 'bg-black/5 text-black rounded-bl-sm'}`}>
                {m.text}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-black/[0.08] z-10">
        <form onSubmit={handleSend} className="flex gap-2">
          <input 
            type="text" 
            value={input} 
            onChange={(e) => setInput(e.target.value)}
            placeholder="Broadcast encrypted message on-chain..." 
            className="flex-1 bg-black/5 text-black px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/20 text-sm font-medium"
          />
          <button 
            type="submit" 
            disabled={!input.trim()}
            className="px-6 rounded-xl bg-black text-white flex items-center justify-center disabled:opacity-50 hover:bg-black/80 transition-colors"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
      
      {/* Aesthetic Background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-black/[0.02] blur-[120px] rounded-full pointer-events-none" />
    </div>
  );
}
