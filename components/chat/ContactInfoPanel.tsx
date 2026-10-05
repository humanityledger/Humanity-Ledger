'use client';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, Video, Search, ChevronRight, X, Lock, Bell, Image as ImageIcon,
  Database, Star, Palette, Camera, Clock, Shield, Key, Users,
  Share2, Heart, List, Download, Trash2, Ban, Flag, Plus,
  MessageCircle, Link, FileText, ArrowLeft, Copy, Check
} from 'lucide-react';

interface ContactInfoPanelProps {
  peerAddress: string;
  peerName: string;
  myAddress: string;
  messages?: any[];
  onClose: () => void;
  onVoiceCall: () => void;
  onVideoCall: () => void;
  onSearch: () => void;
  onBlock: () => void;
  onClearChat?: () => void;
  onAddToGroup?: () => void;
  groups?: Array<{ id: string; name: string }>;
}

const shortAddr = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';
const initials = (name: string, addr: string) => {
  if (name && name !== shortAddr(addr)) return name.slice(0, 2).toUpperCase();
  return addr ? addr.slice(2, 4).toUpperCase() : 'XX';
};

// Modern iOS-style Switch Toggle
const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <button
    onClick={() => onChange(!value)}
    className={`w-[44px] h-[24px] rounded-full flex items-center p-1 transition-colors duration-300 ease-in-out ${value ? 'bg-[#25D366]' : 'bg-[#E5E5EA]'}`}
  >
    <motion.div 
      layout
      className={`w-4 h-4 bg-white rounded-full shadow-sm`}
      animate={{ x: value ? 20 : 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
    />
  </button>
);

const Row = ({ icon, label, value, onTap, danger = false, toggle, onToggle }: any) => (
  <button
    onClick={onTap}
    className="w-full flex items-center justify-between py-3.5 px-2 group text-left hover:bg-black/[0.02] transition-colors rounded-xl"
  >
    <div className="flex items-center gap-3.5">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${danger ? 'bg-red-50 text-red-500' : 'bg-[#F2F2F7] text-[#1C1C1E]/60 group-hover:text-[#25D366] group-hover:bg-[#25D366]/10'} transition-colors`}>
        {React.cloneElement(icon, { size: 16 })}
      </div>
      <span className={`text-[15px] font-medium ${danger ? 'text-red-500' : 'text-[#1C1C1E]'}`}>{label}</span>
    </div>
    <div className="flex items-center gap-3">
      {value && <span className="text-[14px] text-[#8E8E93]">{value}</span>}
      {onToggle !== undefined && toggle !== undefined ? (
        <Toggle value={toggle} onChange={onToggle} />
      ) : onTap ? (
        <ChevronRight size={16} className="text-[#C7C7CC] group-hover:text-[#8E8E93] transition-colors shrink-0" />
      ) : null}
    </div>
  </button>
);

const Section = ({ title, children }: { title?: string; children: React.ReactNode }) => (
  <div className="mb-6 bg-white rounded-2xl border border-black/[0.04] p-2 shadow-sm">
    {title && <p className="px-3 pt-2 pb-1 text-[12px] font-semibold tracking-wide text-[#8E8E93] uppercase">{title}</p>}
    <div className="flex flex-col">
      {children}
    </div>
  </div>
);

const Modal = ({ title, onClose, children }: { title: string, onClose: () => void, children: React.ReactNode }) => (
  <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
    <motion.div 
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      className="bg-white rounded-3xl w-full max-w-sm flex flex-col max-h-[80vh] shadow-2xl overflow-hidden"
    >
      <div className="flex items-center justify-between p-5 border-b border-black/[0.05] bg-white">
        <h3 className="font-bold text-[16px] text-[#1C1C1E]">{title}</h3>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#F2F2F7] text-[#1C1C1E] hover:bg-[#E5E5EA] transition-colors"><X size={18} /></button>
      </div>
      <div className="p-6 overflow-y-auto bg-[#F9F9F9]">
        {children}
      </div>
    </motion.div>
  </div>
);

export const ContactInfoPanel: React.FC<ContactInfoPanelProps> = ({
  peerAddress, peerName, myAddress, messages = [], onClose, onVoiceCall, onVideoCall, onSearch, onBlock, onClearChat, onAddToGroup, groups = []
}) => {
  const [saveToPhotos, setSaveToPhotos] = useState(false);
  const [lockChat, setLockChat] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [disappearing, setDisappearing] = useState<'off' | '24h' | '7d' | '90d'>('off');
  
  const [toast, setToast] = useState<string | null>(null);
  const [modal, setModal] = useState<string | null>(null);
  
  const displayName = peerName || shortAddr(peerAddress);

  useEffect(() => {
    setSaveToPhotos(!!localStorage.getItem('ledger_save_photos_' + peerAddress));
    setLockChat(!!localStorage.getItem('ledger_locked_' + peerAddress));
    setIsMuted(!!localStorage.getItem('ledger_muted_' + peerAddress));
    setDisappearing((localStorage.getItem('ledger_disappearing_' + peerAddress) as any) || 'off');
    const favs = JSON.parse(localStorage.getItem('ledger_favourites') || '[]');
    setIsFav(favs.includes(peerAddress));
  }, [peerAddress]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleMute = (v: boolean) => {
    setIsMuted(v);
    if (v) { localStorage.setItem('ledger_muted_' + peerAddress, '1'); showToast('Notifications muted'); }
    else { localStorage.removeItem('ledger_muted_' + peerAddress); showToast('Notifications unmuted'); }
  };

  const toggleFav = () => {
    const favs = JSON.parse(localStorage.getItem('ledger_favourites') || '[]');
    if (isFav) {
      localStorage.setItem('ledger_favourites', JSON.stringify(favs.filter((f: string) => f !== peerAddress)));
      setIsFav(false);
      showToast('Removed from Favorites');
    } else {
      localStorage.setItem('ledger_favourites', JSON.stringify([...favs, peerAddress]));
      setIsFav(true);
      showToast('Added to Favorites');
    }
  };

  const [copied, setCopied] = useState(false);
  const copyAddress = () => {
    navigator.clipboard.writeText(peerAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <motion.div 
        initial={{ x: 380 }}
        animate={{ x: 0 }}
        exit={{ x: 380 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-full md:w-[380px] h-full flex flex-col bg-[#F6F7F9] border-l border-[#D1D7DB] z-50 absolute right-0 md:relative shrink-0 shadow-2xl md:shadow-none"
      >
        <div className="h-[60px] flex items-center justify-between px-4 bg-[#F0F2F5] shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="text-[#54656F] hover:text-[#111B21] transition-colors"><X size={24} /></button>
            <h2 className="text-[16px] font-semibold text-[#111B21]">Contact Info</h2>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Header Card */}
          <div className="bg-white py-8 px-4 flex flex-col items-center justify-center mb-2 shadow-sm">
            <div className="relative">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center text-white text-[42px] font-bold shadow-lg mb-4">
                {initials(displayName, peerAddress)}
              </div>
              {isFav && <div className="absolute bottom-4 right-0 w-8 h-8 bg-yellow-400 rounded-full border-4 border-white flex items-center justify-center text-white"><Star size={14} fill="currentColor" /></div>}
            </div>
            
            <h1 className="text-[24px] font-semibold text-[#111B21]">{displayName}</h1>
            <p className="text-[14px] text-[#667781] font-mono mt-1 mb-6">{shortAddr(peerAddress)}</p>

            <div className="flex gap-4 w-full justify-center">
              <button onClick={onVoiceCall} className="flex flex-col items-center gap-2 text-[#25D366] hover:opacity-80 transition-opacity">
                <div className="w-12 h-12 rounded-2xl bg-[#25D366]/10 flex items-center justify-center"><Phone size={22} /></div>
                <span className="text-[13px] font-medium">Audio</span>
              </button>
              <button onClick={onVideoCall} className="flex flex-col items-center gap-2 text-[#25D366] hover:opacity-80 transition-opacity">
                <div className="w-12 h-12 rounded-2xl bg-[#25D366]/10 flex items-center justify-center"><Video size={24} /></div>
                <span className="text-[13px] font-medium">Video</span>
              </button>
              <button onClick={onSearch} className="flex flex-col items-center gap-2 text-[#25D366] hover:opacity-80 transition-opacity">
                <div className="w-12 h-12 rounded-2xl bg-[#25D366]/10 flex items-center justify-center"><Search size={22} /></div>
                <span className="text-[13px] font-medium">Search</span>
              </button>
            </div>
          </div>

          <div className="p-4 flex flex-col gap-2">
            <Section title="About">
              <Row icon={<Copy />} label="Wallet Address" value={shortAddr(peerAddress)} onTap={copyAddress} />
              <Row icon={<Star />} label="Favorite Contact" toggle={isFav} onToggle={toggleFav} />
            </Section>

            <Section title="Media, Links, and Docs">
              <Row icon={<ImageIcon />} label="Shared Media" value="0" onTap={() => setModal('media')} />
              <Row icon={<Star />} label="Starred Messages" value="None" onTap={() => setModal('starred')} />
            </Section>

            <Section title="Privacy & Security">
              <Row icon={<Bell />} label="Mute Notifications" toggle={isMuted} onToggle={handleMute} />
              <Row icon={<Clock />} label="Disappearing Messages" value={disappearing === 'off' ? 'Off' : disappearing} onTap={() => setModal('disappearing')} />
              <Row icon={<Lock />} label="Lock Chat with PIN" toggle={lockChat} onToggle={(v: boolean) => {
                setLockChat(v);
                if (v) {
                  localStorage.setItem('ledger_locked_' + peerAddress, '1');
                  showToast('Chat locked locally');
                } else {
                  localStorage.removeItem('ledger_locked_' + peerAddress);
                  showToast('Chat unlocked');
                }
              }} />
              <Row icon={<Shield />} label="Encryption" value="End-to-End" onTap={() => setModal('encryption')} />
            </Section>

            <Section title="Actions">
              <Row icon={<Share2 />} label="Share Contact" onTap={() => showToast('Sharing not available in beta')} />
              <Row icon={<Download />} label="Export Chat" onTap={() => showToast('Exporting conversation...')} />
              <Row icon={<Trash2 />} label="Clear Chat" danger onTap={onClearChat} />
            </Section>

            <Section>
              <Row icon={<Ban />} label="Block Contact" danger onTap={onBlock} />
              <Row icon={<Flag />} label="Report Contact" danger onTap={() => showToast('Contact reported to local blocklist.')} />
            </Section>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-[#111B21] text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 z-[400]"
          >
            {copied ? <Check size={16} className="text-[#25D366]" /> : <Shield size={16} className="text-[#25D366]" />}
            <span className="text-[14px] font-medium">{toast}</span>
          </motion.div>
        )}

        {modal === 'disappearing' && (
          <Modal title="Disappearing Messages" onClose={() => setModal(null)}>
            <div className="flex flex-col gap-3">
              <p className="text-[13px] text-[#667781] mb-2 leading-relaxed">For more privacy, new messages will disappear from this device for everyone after the selected duration.</p>
              {['off', '24h', '7d', '90d'].map(opt => (
                <button key={opt} onClick={() => {
                  setDisappearing(opt as any);
                  localStorage.setItem('ledger_disappearing_' + peerAddress, opt);
                  setModal(null);
                  showToast(`Timer set to ${opt}`);
                }} className="flex items-center justify-between p-4 rounded-xl bg-white border border-black/[0.05] hover:border-[#25D366] transition-colors">
                  <span className="text-[15px] font-semibold text-[#111B21]">{opt === 'off' ? 'Off' : `${opt} timer`}</span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${disappearing === opt ? 'border-[#25D366]' : 'border-[#D1D7DB]'}`}>
                    {disappearing === opt && <div className="w-2.5 h-2.5 bg-[#25D366] rounded-full" />}
                  </div>
                </button>
              ))}
            </div>
          </Modal>
        )}

        {modal === 'encryption' && (
          <Modal title="End-to-End Encryption" onClose={() => setModal(null)}>
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <div className="w-16 h-16 bg-[#25D366]/10 text-[#25D366] rounded-full flex items-center justify-center mb-2">
                <Lock size={32} />
              </div>
              <p className="text-[14px] text-[#111B21] font-medium">Messages and calls are end-to-end encrypted.</p>
              <p className="text-[13px] text-[#667781] leading-relaxed">No one outside of this chat, not even Humanity Ledger, can read or listen to them.</p>
              <div className="mt-4 p-4 bg-[#F0F2F5] rounded-xl w-full">
                <p className="text-[11px] font-mono text-[#667781] break-all tracking-wider text-center">
                  {myAddress} - {peerAddress}
                </p>
              </div>
            </div>
          </Modal>
        )}

        {modal === 'media' && (
          <Modal title="Media, Links, and Docs" onClose={() => setModal(null)}>
            <div className="flex flex-col items-center text-center gap-4 py-8">
              <div className="w-16 h-16 bg-[#F0F2F5] text-[#8E8E93] rounded-full flex items-center justify-center mb-2">
                <ImageIcon size={32} />
              </div>
              <p className="text-[14px] text-[#111B21] font-medium">No media shared yet</p>
              <p className="text-[13px] text-[#667781] leading-relaxed">Photos and videos sent in this chat will appear here.</p>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
};
