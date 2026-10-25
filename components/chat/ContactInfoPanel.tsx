'use client';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, Video, Search, ChevronRight, X, Lock, Bell, Image as ImageIcon,
  Database, Star, Palette, Camera, Clock, Shield, Key, Users,
  Share2, Heart, List, Download, Trash2, Ban, Flag, Plus,
  MessageCircle, Link, FileText, ArrowLeft, Copy, Check
} from 'lucide-react';
import { EncryptionInfoSheet } from './EncryptionInfoSheet';

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

// ─── iOS-style Toggle ─────────────────────────────────────────────────────────
const Toggle = ({ value, onChange }: { value: boolean; onChange?: (v: boolean) => void }) => (
  <button
    type="button"
    onClick={() => onChange?.(!value)}
    className={`w-[51px] h-[31px] rounded-full flex items-center px-[2px] transition-all duration-200 shrink-0 ${
      value ? 'bg-[#15171c]' : 'bg-[#e4e7ec]'
    }`}
    aria-pressed={value}
  >
    <div className={`w-[27px] h-[27px] rounded-full bg-white shadow-md transform transition-transform duration-200 ${
      value ? 'translate-x-[20px]' : 'translate-x-0'
    }`} />
  </button>
);

// ─── Setting Row ─────────────────────────────────────────────────────────────
const Row = ({
  icon, label, sublabel, value, onTap, danger = false,
  toggle, onToggle, badge, disabled = false
}: {
  icon?: React.ReactNode; label: string; sublabel?: string; value?: string;
  onTap?: () => void; danger?: boolean; toggle?: boolean;
  onToggle?: (v: boolean) => void; badge?: string; disabled?: boolean;
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={() => {
      if (disabled) return;
      if (onTap) onTap();
      else if (onToggle !== undefined && toggle !== undefined) onToggle(!toggle);
    }}
    className={`w-full flex items-center gap-3.5 px-0 py-3.5 border-b border-[#f2f4f7] last:border-0 text-left transition-colors ${
      disabled ? 'opacity-40 cursor-not-allowed' : onTap ? 'active:bg-[#f2f4f7] cursor-pointer' : 'cursor-default'
    }`}
  >
    {icon && (
      <div className={`w-[34px] h-[34px] rounded-[9px] flex items-center justify-center shrink-0 ${
        danger ? 'bg-red-50' : 'bg-[#f2f4f7]'
      }`}>
        <span className={danger ? 'text-[#d93036]' : 'text-[#3C3C43]'}>{icon}</span>
      </div>
    )}
    <div className="flex-1 min-w-0">
      <p className={`text-[15px] font-medium leading-tight ${danger ? 'text-[#d93036]' : 'text-[#15171c]'}`}>{label}</p>
      {sublabel && <p className="text-[12px] text-[#727a88] mt-0.5 leading-snug">{sublabel}</p>}
    </div>
    <div className="flex items-center gap-2 shrink-0">
      {badge && (
        <span className="bg-[#e5484d] text-white text-[12.5px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
          {badge}
        </span>
      )}
      {value && <span className="text-[14px] text-[#727a88]">{value}</span>}
      {onToggle !== undefined && toggle !== undefined ? (
        <Toggle value={toggle} onChange={onToggle} />
      ) : onTap ? (
        <ChevronRight size={16} className="text-[#c9ced6]" />
      ) : null}
    </div>
  </button>
);

// ─── Settings Group ───────────────────────────────────────────────────────────
const Group = ({ title, footer, children }: {
  title?: string; footer?: string; children: React.ReactNode;
}) => (
  <div className="mb-6">
    {title && (
      <p className="text-[12px] font-semibold text-[#727a88] px-1 mb-1.5">
        {title}
      </p>
    )}
    <div className="bg-white rounded-[14px] overflow-hidden shadow-sm px-4">
      {children}
    </div>
    {footer && (
      <p className="text-[12px] text-[#727a88] px-1 mt-2 leading-relaxed">{footer}</p>
    )}
  </div>
);

const Modal = ({ title, onClose, children }: { title: string, onClose: () => void, children: React.ReactNode }) => (
  <div className="fixed inset-0 z-[250002] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
    <motion.div 
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      className="bg-white rounded-3xl w-full max-w-sm flex flex-col max-h-[80vh] shadow-2xl overflow-hidden"
    >
      <div className="flex items-center justify-between p-5 border-b border-black/[0.05] bg-white">
        <h3 className="font-semibold text-[16px] text-[#15171c]">{title}</h3>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#f2f4f7] text-[#15171c] hover:bg-[#e4e7ec] transition-colors"><X size={18} /></button>
      </div>
      <div className="p-6 overflow-y-auto bg-[#f7f8fa]">
        {children}
      </div>
    </motion.div>
  </div>
);

export const ContactInfoPanel: React.FC<ContactInfoPanelProps> = ({
  peerAddress: rawPeerAddress, peerName, myAddress, messages = [], onClose, onVoiceCall, onVideoCall, onSearch, onBlock, onClearChat, onAddToGroup, groups = []
}) => {
  const peerAddress = rawPeerAddress;
  const key = (peerAddress || '').toLowerCase();
  const [lockChat, setLockChat] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [disappearing, setDisappearing] = useState<'off' | '24h' | '7d' | '90d'>('off');
  const [peerProfile, setPeerProfile] = useState<{ bio?: string; avatarUrl?: string; displayName?: string } | null>(null);
  
  const [toast, setToast] = useState<string | null>(null);
  const [modal, setModal] = useState<string | null>(null);
  
  const displayName = peerProfile?.displayName || peerName || shortAddr(peerAddress);

  // Fetch peer profile from backend
  useEffect(() => {
    if (!peerAddress) return;
    fetch(`/api/user/profile?walletAddress=${encodeURIComponent(peerAddress)}`)
      .then(r => r.json())
      .then(data => {
        if (data.data || data.user || data.profile) {
          const u = data.data || data.user || data.profile;
          setPeerProfile({
            bio: u.bio && !u.bio.includes('Sovereign') ? u.bio : undefined,
            avatarUrl: u.avatarUrl || u.image,
            displayName: u.displayName || u.chatName || u.name
          });
        }
      })
      .catch(() => {});
  }, [peerAddress]);

  useEffect(() => {
    setLockChat(!!localStorage.getItem('ledger_locked_' + key));
    setIsMuted(!!localStorage.getItem('ledger_muted_' + key));
    setDisappearing((localStorage.getItem('ledger_disappearing_' + key) as any) || 'off');
    let favs: string[] = []; try { favs = JSON.parse(localStorage.getItem('ledger_favourites') || '[]'); } catch {}
    setIsFav(favs.includes(key));
  }, [peerAddress]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleMute = (v: boolean) => {
    setIsMuted(v);
    if (v) { 
      localStorage.setItem('ledger_muted_' + key, '1');
      showToast('Notifications muted'); 
    }
    else { 
      localStorage.removeItem('ledger_muted_' + key);
      showToast('Notifications unmuted'); 
    }
  };

  const handleBlock = () => {
    showToast('Contact blocked on this device');
    onBlock?.();
  };

  const toggleFav = () => {
    let favs: string[] = []; try { favs = JSON.parse(localStorage.getItem('ledger_favourites') || '[]'); } catch {}
    if (isFav) {
      localStorage.setItem('ledger_favourites', JSON.stringify(favs.filter((f: string) => f !== key)));
      setIsFav(false);
      showToast('Removed from Favorites');
    } else {
      localStorage.setItem('ledger_favourites', JSON.stringify([...favs, key]));
      setIsFav(true);
      showToast('Added to Favorites');
    }
  };

  const mediaCount = messages.filter((m: any) => typeof m.content === 'string' && (m.content.startsWith('__MEDIA__:') || m.content.startsWith('[ATTACHMENT:') || m.content.startsWith('[GIF]'))).length;

  const exportChat = () => {
    const lines = messages
      .filter((m: any) => typeof m.content === 'string' && !m.content.startsWith('__') || (typeof m.content === 'string' && m.content.startsWith('__BURN_')))
      .map((m: any) => {
        const t = new Date(typeof m.sentAtNs === 'number' ? m.sentAtNs : (m.sent || m.sentAt || Date.now())).toLocaleString();
        const mine = m.isMe || (m.senderAddress || '').toLowerCase() === (myAddress || '').toLowerCase();
        return `[${t}] ${mine ? 'Me' : displayName}: ${String(m.content).replace(/^__BURN_\d+__::/, '')}`;
      });
    if (!lines.length) { showToast('Nothing to export yet'); return; }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `chat-${key.slice(0, 8)}-${Date.now()}.txt`; a.click();
    URL.revokeObjectURL(url);
    showToast('Chat exported as a text file');
  };

  const [copied, setCopied] = useState(false);
  const copyAddress = () => {
    navigator.clipboard?.writeText(peerAddress);
    setCopied(true);
    showToast('Wallet address copied');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <motion.div key="contact-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-[250000] bg-black/25" aria-hidden="true" />
      <motion.aside
        role="dialog" aria-label="Contact info"
        initial={{ x: 420 }}
        animate={{ x: 0 }}
        exit={{ x: 420 }}
        transition={{ type: 'spring', damping: 28, stiffness: 240 }}
        className="fixed inset-y-0 right-0 z-[250001] w-full sm:w-[400px] flex flex-col bg-[#f2f4f7] border-l border-[#e4e7ec] shadow-2xl"
      >
        <div className="h-[60px] flex items-center justify-between px-4 bg-[#f2f4f7] shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={onClose} aria-label="Close" className="text-[#4a505c] hover:text-[#15171c] transition-colors"><X size={24} /></button>
            <h2 className="text-[16px] font-semibold text-[#15171c]">Contact info</h2>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Header Card */}
          <div className="bg-white py-8 px-4 flex flex-col items-center justify-center mb-6 shadow-sm">
            <div className="relative">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#15171c] to-[#2b2f38] flex items-center justify-center text-white text-[42px] font-semibold shadow-lg mb-4 overflow-hidden">
                {peerProfile?.avatarUrl ? (
                  <img src={peerProfile.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  initials(displayName, peerAddress)
                )}
              </div>
              {isFav && <div className="absolute bottom-4 right-0 w-8 h-8 bg-yellow-400 rounded-full border-4 border-white flex items-center justify-center text-white"><Star size={14} fill="currentColor" /></div>}
            </div>
            
            <h1 className="text-[24px] font-semibold text-[#15171c] mb-0">{displayName}</h1>
            {displayName !== shortAddr(peerAddress) && <p className="text-[14px] text-[#727a88] tabular-nums mt-1">{shortAddr(peerAddress)}</p>}
            {peerProfile?.bio && <p className="text-[13px] text-[#727a88] mt-2 mb-4 text-center max-w-[280px]">{peerProfile.bio}</p>}

            <div className="flex gap-4 w-full justify-center">
              <button onClick={onVoiceCall} className="flex flex-col items-center gap-2 text-[#15171c] hover:opacity-80 transition-opacity">
                <div className="w-12 h-12 rounded-2xl bg-[#eff1f4] flex items-center justify-center"><Phone size={22} /></div>
                <span className="text-[13px] font-medium">Audio</span>
              </button>
              <button onClick={onVideoCall} className="flex flex-col items-center gap-2 text-[#15171c] hover:opacity-80 transition-opacity">
                <div className="w-12 h-12 rounded-2xl bg-[#eff1f4] flex items-center justify-center"><Video size={24} /></div>
                <span className="text-[13px] font-medium">Video</span>
              </button>
              <button onClick={onSearch} className="flex flex-col items-center gap-2 text-[#15171c] hover:opacity-80 transition-opacity">
                <div className="w-12 h-12 rounded-2xl bg-[#eff1f4] flex items-center justify-center"><Search size={22} /></div>
                <span className="text-[13px] font-medium">Search</span>
              </button>
            </div>
          </div>

          <div className="p-4 flex flex-col gap-2">
            <Group title="About">
              <Row icon={<Copy />} label="Wallet address" sublabel="Tap to copy" value={shortAddr(peerAddress)} onTap={copyAddress} />
              <Row icon={<Star />} label="Favorite contact" toggle={isFav} onToggle={toggleFav} />
            </Group>

            <Group title="Media and files">
              <Row icon={<ImageIcon />} label="Shared media" value={String(mediaCount)} onTap={() => setModal('media')} />
            </Group>

            <Group title="Privacy" footer="Mute, timer and lock apply on this device.">
              <Row icon={<Bell />} label="Mute notifications" toggle={isMuted} onToggle={handleMute} />
              <Row icon={<Clock />} label="Disappearing messages" value={{ off: 'Off', '24h': '24 hours', '7d': '7 days', '90d': '90 days' }[disappearing]} onTap={() => setModal('disappearing')} />
              <Row icon={<Lock />} label="Lock chat with PIN" toggle={lockChat} onToggle={(v: boolean) => {
                setLockChat(v);
                if (v) {
                  localStorage.setItem('ledger_locked_' + key, '1');
                  showToast('Chat locked. Opening it asks for your PIN');
                } else {
                  localStorage.removeItem('ledger_locked_' + key);
                  showToast('Chat unlocked');
                }
              }} />
              <Row icon={<Shield />} label="Encryption" sublabel="Protocol and safety number" onTap={() => setModal('encryption')} />
            </Group>

            <Group title="Actions">
              <Row icon={<Download />} label="Export chat" sublabel="Save the messages on this device as text" onTap={exportChat} />
              {onClearChat && <Row icon={<Trash2 />} label="Clear chat" danger onTap={onClearChat} />}
            </Group>

            <Group>
              <Row icon={<Ban />} label="Block contact" danger onTap={handleBlock} />
            </Group>
          </div>
        </div>
      </motion.aside>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-[#111B21] text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 z-[250003]"
          >
            {copied ? <Check size={16} className="text-[#15171c]" /> : <Shield size={16} className="text-[#15171c]" />}
            <span className="text-[14px] font-medium">{toast}</span>
          </motion.div>
        )}

        {modal === 'disappearing' && (
          <Modal title="Disappearing messages" onClose={() => setModal(null)}>
            <div className="flex flex-col gap-3">
              <p className="text-[13px] text-[#727a88] mb-2 leading-relaxed">For more privacy, new messages in this chat disappear for both of you after the selected time. Messages already sent are not affected.</p>
              {['off', '24h', '7d', '90d'].map(opt => (
                <button key={opt} onClick={() => {
                  setDisappearing(opt as any);
                  localStorage.setItem('ledger_disappearing_' + key, opt);
                  setModal(null);
                  showToast(opt === 'off' ? 'Timer is off' : 'Timer saved');
                }} className="flex items-center justify-between p-4 rounded-xl bg-white border border-black/[0.05] hover:border-[#15171c] transition-colors">
                  <span className="text-[15px] font-semibold text-[#15171c]">{({ off: 'Off', '24h': '24 hours', '7d': '7 days', '90d': '90 days' } as any)[opt]}</span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${disappearing === opt ? 'border-[#15171c]' : 'border-[#D1D7DB]'}`}>
                    {disappearing === opt && <div className="w-2.5 h-2.5 bg-[#15171c] rounded-full" />}
                  </div>
                </button>
              ))}
            </div>
          </Modal>
        )}

        {modal === 'media' && (
          <Modal title="Shared media" onClose={() => setModal(null)}>
            <div className="flex flex-col items-center text-center gap-4 py-8">
              <div className="w-16 h-16 bg-[#f2f4f7] text-[#727a88] rounded-full flex items-center justify-center mb-2">
                <ImageIcon size={32} />
              </div>
              <p className="text-[14px] text-[#15171c] font-medium">{mediaCount ? `${mediaCount} shared in this chat` : 'No media shared yet'}</p>
              <p className="text-[13px] text-[#727a88] leading-relaxed">Photos, files and GIFs sent in this chat are counted here.</p>
            </div>
          </Modal>
        )}
      </AnimatePresence>
      <EncryptionInfoSheet open={modal === 'encryption'} onClose={() => setModal(null)} peerName={displayName} myAddress={myAddress} peerAddress={peerAddress} serverCount={messages.filter((m: any) => m.viaServer).length} />
    </>
  );
};
