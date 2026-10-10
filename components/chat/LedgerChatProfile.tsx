"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, BellOff, Trash2, Ban, EyeOff, FileText, Image as ImageIcon, Link2, Copy, CheckCircle2, AlertTriangle, UserCircle2 } from 'lucide-react';
import { getBlocklist, unblockUser } from '@/lib/wallet/blocklist';

interface LedgerChatProfileProps {
  peerAddress: string;
  onClose: () => void;
  onClearChat: () => void;
  onBlockUser: () => void;
  getDisplayName: (addr: string) => string;
}

export function LedgerChatProfile({
  peerAddress,
  onClose,
  onClearChat,
  onBlockUser,
  getDisplayName
}: LedgerChatProfileProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'media' | 'privacy'>('info');
  const [copied, setCopied] = useState(false);

  const displayName = getDisplayName(peerAddress);
  const initials = peerAddress.slice(2, 4).toUpperCase();
  const hue = parseInt(peerAddress.slice(2, 8), 16) % 360;

  const handleCopy = () => {
    navigator.clipboard.writeText(peerAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 350, damping: 35 }}
      className="absolute inset-y-0 right-0 w-full sm:w-[400px] bg-white shadow-2xl z-[100] border-l border-black/10 flex flex-col"
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-black/5 shrink-0 bg-[#f5f5f7]">
        <h2 className="text-[17px] font-black text-black">Contact Info</h2>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 transition-colors">
          <X size={20} className="text-black" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Avatar Section */}
        <div className="flex flex-col items-center py-8 border-b border-black/5">
          <div 
            className="w-28 h-28 rounded-full flex items-center justify-center text-4xl font-black text-white shadow-lg mb-4"
            style={{ background: `hsl(${hue},70%,45%)` }}
          >
            {initials}
          </div>
          <h1 className="text-[24px] font-black tracking-tight text-black">{displayName}</h1>
          
          <button 
            onClick={handleCopy}
            className="mt-2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/5 hover:bg-black/10 transition-colors"
          >
            <span className="text-[13px] font-mono text-black/60">
              {peerAddress.slice(0, 8)}...{peerAddress.slice(-6)}
            </span>
            {copied ? <CheckCircle2 size={14} className="text-[#30d158]" /> : <Copy size={14} className="text-black/40" />}
          </button>
        </div>

        {/* Action Row */}
        <div className="flex items-center justify-center gap-6 py-6 border-b border-black/5">
          <button className="flex flex-col items-center gap-2 group">
            <div className="w-12 h-12 rounded-full bg-[#25D366]/10 flex items-center justify-center text-[#25D366] group-hover:bg-[#25D366]/20 transition-colors">
              <BellOff size={22} />
            </div>
            <span className="text-[12px] font-bold text-black/60 group-hover:text-[#25D366]">Mute</span>
          </button>
          <button className="flex flex-col items-center gap-2 group">
            <div className="w-12 h-12 rounded-full bg-[#30d158]/10 flex items-center justify-center text-[#30d158] group-hover:bg-[#30d158]/20 transition-colors">
              <UserCircle2 size={22} />
            </div>
            <span className="text-[12px] font-bold text-black/60 group-hover:text-[#30d158]">Add</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center border-b border-black/5">
          {(['info', 'media', 'privacy'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-[13px] font-black uppercase tracking-widest relative ${activeTab === tab ? 'text-black' : 'text-black/40 hover:text-black/60'}`}
            >
              {tab}
              {activeTab === tab && (
                <motion.div layoutId="profileTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-4">
          <AnimatePresence mode="wait">
            {activeTab === 'info' && (
              <motion.div
                key="info"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="bg-[#f5f5f7] rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <Shield size={20} className="text-[#30d158] shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-[14px] font-black text-black">End-to-End Encrypted</h3>
                      <p className="text-[13px] text-black/60 mt-1 leading-relaxed">
                        Messages and calls with this contact are secured by the XMTP protocol. No third party can read them.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-[#f5f5f7] rounded-2xl p-4">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-black/40 mb-3">About</h3>
                  <p className="text-[15px] font-medium text-black">"Sovereign individual building on L2."</p>
                </div>
              </motion.div>
            )}

            {activeTab === 'media' && (
              <motion.div
                key="media"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="grid grid-cols-3 gap-2">
                  <div className="aspect-square bg-[#f5f5f7] rounded-xl flex items-center justify-center cursor-pointer hover:bg-black/5 transition-colors">
                    <ImageIcon size={24} className="text-black/20" />
                  </div>
                  <div className="aspect-square bg-[#f5f5f7] rounded-xl flex items-center justify-center cursor-pointer hover:bg-black/5 transition-colors">
                    <FileText size={24} className="text-black/20" />
                  </div>
                  <div className="aspect-square bg-[#f5f5f7] rounded-xl flex items-center justify-center cursor-pointer hover:bg-black/5 transition-colors">
                    <Link2 size={24} className="text-black/20" />
                  </div>
                </div>
                <p className="text-center text-[12px] font-bold text-black/40 mt-4">
                  Media gallery integration pending.
                </p>
              </motion.div>
            )}

            {activeTab === 'privacy' && (
              <motion.div
                key="privacy"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-2"
              >
                <div className="bg-[#f5f5f7] rounded-2xl overflow-hidden">
                  <button className="w-full flex items-center justify-between p-4 hover:bg-black/5 transition-colors text-left border-b border-black/5">
                    <div className="flex items-center gap-3">
                      <EyeOff size={20} className="text-black" />
                      <div>
                        <span className="block text-[15px] font-bold text-black">Read Receipts</span>
                        <span className="block text-[12px] text-black/50">Allow peer to see when you read</span>
                      </div>
                    </div>
                    <div className="w-10 h-6 bg-[#30d158] rounded-full relative">
                      <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                    </div>
                  </button>
                  <button 
                    onClick={onClearChat}
                    className="w-full flex items-center gap-3 p-4 hover:bg-black/5 transition-colors text-left border-b border-black/5"
                  >
                    <Trash2 size={20} className="text-red-500" />
                    <span className="block text-[15px] font-bold text-red-500">Clear Chat History</span>
                  </button>
                  <button 
                    onClick={onBlockUser}
                    className="w-full flex items-center gap-3 p-4 hover:bg-red-50 transition-colors text-left group"
                  >
                    <Ban size={20} className="text-red-500" />
                    <div>
                      <span className="block text-[15px] font-bold text-red-500">Block Contact</span>
                      <span className="block text-[12px] text-red-500/70">They won't be able to message you</span>
                    </div>
                  </button>
                </div>

                <div className="bg-red-50 rounded-2xl p-4 mt-4 border border-red-100 flex items-start gap-3">
                  <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-[13px] font-black text-red-600">Report Abuse</h4>
                    <p className="text-[12px] text-red-600/80 mt-1">
                      If this contact is sending spam or violating guidelines, report them. This action blocks them and flags the conversation.
                    </p>
                    <button className="mt-2 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 text-[11px] font-black uppercase tracking-wider rounded-lg transition-colors">
                      Report User
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
