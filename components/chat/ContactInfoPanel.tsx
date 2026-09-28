'use client';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, Video, Search, ChevronRight, X, Lock, Bell, Image,
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

// Custom Minimalist Toggle
const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <button
    onClick={() => onChange(!value)}
    className={`w-10 h-5 border border-black rounded-none flex items-center p-0.5 transition-colors ${value ? 'bg-black' : 'bg-transparent'}`}
  >
    <div className={`w-3.5 h-3.5 bg-current transition-transform ${value ? 'translate-x-5 text-white' : 'translate-x-0 text-black'}`} />
  </button>
);

const Row = ({ icon, label, value, onTap, danger = false, toggle, onToggle }: {
  icon: React.ReactNode; label: string; value?: string;
  onTap?: () => void; danger?: boolean;
  toggle?: boolean; onToggle?: (v: boolean) => void;
}) => (
  <button
    onClick={onTap}
    className={`w-full flex items-center justify-between py-3 border-b border-black/10 group ${onTap || onToggle !== undefined ? 'hover:border-black transition-colors' : ''} text-left`}
  >
    <div className="flex items-center gap-4">
      <span className={`shrink-0 ${danger ? 'text-red-500' : 'text-black/40 group-hover:text-black transition-colors'}`}>{icon}</span>
      <span className={`text-[13px] font-bold uppercase tracking-wider ${danger ? 'text-red-500' : 'text-black'}`}>{label}</span>
    </div>
    <div className="flex items-center gap-3">
      {value && <span className="text-[12px] font-mono text-black/50">{value}</span>}
      {onToggle !== undefined && toggle !== undefined ? (
        <Toggle value={toggle} onChange={onToggle} />
      ) : onTap ? (
        <ChevronRight size={14} className="text-black/20 group-hover:text-black transition-colors shrink-0" />
      ) : null}
    </div>
  </button>
);

const Section = ({ title, children }: { title?: string; children: React.ReactNode }) => (
  <div className="mb-10">
    {title && <p className="mb-4 text-[10px] font-mono uppercase tracking-[0.2em] text-black/40">{title}</p>}
    <div className="flex flex-col">
      {children}
    </div>
  </div>
);

const Modal = ({ title, onClose, children }: { title: string, onClose: () => void, children: React.ReactNode }) => (
  <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-white/80 backdrop-blur-md">
    <div className="bg-white border border-black w-full max-w-md flex flex-col max-h-[80vh] shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
      <div className="flex items-center justify-between p-5 border-b border-black bg-[#F8F8F8]">
        <h3 className="font-bold uppercase tracking-widest text-[13px]">{title}</h3>
        <button onClick={onClose} className="p-1 hover:bg-black hover:text-white transition-colors"><X size={18} /></button>
      </div>
      <div className="p-6 overflow-y-auto">
        {children}
      </div>
    </div>
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
  const [listInput, setListInput] = useState('');
  const [theme, setTheme] = useState('Minimal');

  const displayName = peerName || shortAddr(peerAddress);

  useEffect(() => {
    setSaveToPhotos(!!localStorage.getItem('ledger_save_photos_' + peerAddress));
    setLockChat(!!localStorage.getItem('ledger_locked_' + peerAddress));
    setIsMuted(!!localStorage.getItem('ledger_muted_' + peerAddress));
    setDisappearing((localStorage.getItem('ledger_disappearing_' + peerAddress) as any) || 'off');
    setTheme(localStorage.getItem('ledger_theme_' + peerAddress) || 'Minimal');
    const favs = JSON.parse(localStorage.getItem('ledger_favourites') || '[]');
    setIsFav(favs.includes(peerAddress));
  }, [peerAddress]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const [advPrivacy, setAdvPrivacy] = useState({
    hideRead: !!localStorage.getItem(`ledger_adv_privacy_${peerAddress}_hideRead`),
    blockScreenshots: !!localStorage.getItem(`ledger_adv_privacy_${peerAddress}_blockScreenshots`),
    forwardProtection: !!localStorage.getItem(`ledger_adv_privacy_${peerAddress}_forwardProtection`),
  });

  const handleAdvPrivacy = (key: keyof typeof advPrivacy, val: boolean) => {
    setAdvPrivacy(prev => ({ ...prev, [key]: val }));
    if (val) localStorage.setItem(`ledger_adv_privacy_${peerAddress}_${key}`, '1');
    else localStorage.removeItem(`ledger_adv_privacy_${peerAddress}_${key}`);
  };

  const handleMute = (v: boolean) => {
    setIsMuted(v);
    if (v) { localStorage.setItem('ledger_muted_' + peerAddress, '1'); showToast('Chat notifications muted'); }
    else { localStorage.removeItem('ledger_muted_' + peerAddress); showToast('Notifications restored'); }
  };

  const toggleFav = () => {
    const favs = JSON.parse(localStorage.getItem('ledger_favourites') || '[]');
    if (isFav) {
      localStorage.setItem('ledger_favourites', JSON.stringify(favs.filter((f: string) => f !== peerAddress)));
      setIsFav(false);
      showToast('Removed from Identity Registry');
    } else {
      localStorage.setItem('ledger_favourites', JSON.stringify([...favs, peerAddress]));
      setIsFav(true);
      showToast('Registered to Identity Registry');
    }
  };

  const handleTheme = (t: string) => {
    setTheme(t);
    localStorage.setItem('ledger_theme_' + peerAddress, t);
    setModal(null);
  };

  const handleSavePhotos = (v: boolean) => {
    setSaveToPhotos(v);
    if (v) localStorage.setItem('ledger_save_photos_' + peerAddress, '1');
    else localStorage.removeItem('ledger_save_photos_' + peerAddress);
  };

  const handleLock = (v: boolean) => {
    setLockChat(v);
    if (v) { localStorage.setItem('ledger_locked_' + peerAddress, '1'); showToast('State shielding engaged'); }
    else localStorage.removeItem('ledger_locked_' + peerAddress);
  };

  const copyText = (txt: string, msg: string) => {
    navigator.clipboard.writeText(txt);
    showToast(msg);
    setModal(null);
  };

  const handleShare = async () => {
    const url = 'https://humanidfi.com/connect?peer=' + peerAddress;
    if (navigator.share) {
      try { await navigator.share({ title: displayName, text: peerAddress, url }); } catch (e) {}
    } else copyText(url, 'Connection protocol copied');
  };

  const handleExport = () => {
    const chatText = messages.map(m => `[${new Date(m.timestamp).toISOString()}] ${m.senderInboxId === peerAddress ? peerAddress : 'Me'}: ${m.content}`).join('\n');
    const blob = new Blob([chatText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledger-state-${peerAddress.slice(0, 8)}.txt`;
    a.click();
  };

  const handleReport = async () => {
    try {
      await fetch('/api/chat/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reporter: myAddress, reported: peerAddress, reason: 'spam' })
      });
      showToast('Telemetry report dispatched.');
    } catch (e) {
      showToast('Report dispatch failed.');
    }
  };

  const getStarred = () => JSON.parse(localStorage.getItem('ledger_starred_' + peerAddress) || '[]');
  const handleDisappearing = (opt: any) => {
    setDisappearing(opt);
    localStorage.setItem('ledger_disappearing_' + peerAddress, opt);
  };

  const handleAddList = () => {
    if (!listInput.trim()) return;
    const lists = JSON.parse(localStorage.getItem('ledger_lists') || '{}');
    if (!lists[listInput]) lists[listInput] = [];
    if (!lists[listInput].includes(peerAddress)) lists[listInput].push(peerAddress);
    localStorage.setItem('ledger_lists', JSON.stringify(lists));
    showToast(`Appended to matrix: ${listInput}`);
    setModal(null);
  };

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'tween', duration: 0.3, ease: 'easeInOut' }}
      className="absolute inset-0 z-50 bg-[#FAFAFA] flex flex-col overflow-y-auto font-sans"
    >
      <div className="sticky top-0 z-10 bg-[#FAFAFA]/90 backdrop-blur-lg border-b border-black/10 px-6 py-4 flex items-center justify-between">
        <button onClick={onClose} className="p-2 -ml-2 text-black/50 hover:text-black transition-colors">
          <ArrowLeft size={20} />
        </button>
        <span className="text-[11px] font-mono tracking-[0.2em] uppercase font-bold text-black">Identity Matrix</span>
        <div className="w-8" />
      </div>

      <div className="p-8 flex flex-col items-center">
        <div className="w-24 h-24 bg-black flex items-center justify-center mb-6 border border-black/10 shadow-2xl relative">
          <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay"></div>
          <span className="text-3xl font-serif italic text-white z-10">{initials(displayName, peerAddress)}</span>
        </div>
        <h2 className="text-2xl font-bold tracking-tight mb-2 text-black">{displayName}</h2>
        <p className="text-[12px] font-mono text-black/40 break-all text-center">{peerAddress}</p>

        <div className="flex gap-4 mt-8 w-full">
          <button onClick={onVoiceCall} className="flex-1 flex flex-col items-center gap-3 py-4 border border-black/10 hover:bg-black hover:text-white transition-all group">
            <Phone size={18} className="text-black group-hover:text-white" />
            <span className="text-[10px] font-mono uppercase tracking-widest">Audio</span>
          </button>
          <button onClick={onVideoCall} className="flex-1 flex flex-col items-center gap-3 py-4 border border-black/10 hover:bg-black hover:text-white transition-all group">
            <Video size={18} className="text-black group-hover:text-white" />
            <span className="text-[10px] font-mono uppercase tracking-widest">Visual</span>
          </button>
          <button onClick={onSearch} className="flex-1 flex flex-col items-center gap-3 py-4 border border-black/10 hover:bg-black hover:text-white transition-all group">
            <Search size={18} className="text-black group-hover:text-white" />
            <span className="text-[10px] font-mono uppercase tracking-widest">Query</span>
          </button>
        </div>
      </div>

      <div className="px-8 pb-12 flex flex-col">
        <Section title="Media & Storage">
          <Row icon={<Image size={16} />} label="Encrypted Artifacts" value={`${messages.filter(m => m.content.match(/https?:\/\//)).length}`} onTap={() => setModal('media')} />
          <Row icon={<Database size={16} />} label="State Footprint" value={`${((messages.length * 50) / 1024).toFixed(1)} KB`} onTap={() => setModal('storage')} />
          <Row icon={<Star size={16} />} label="Saved Vectors" value={`${getStarred().length}`} onTap={() => setModal('starred')} />
        </Section>

        <Section title="Protocol Parameters">
          <Row icon={<Bell size={16} />} label="Mute Telemetry" toggle={isMuted} onToggle={handleMute} />
          <Row icon={<Palette size={16} />} label="Interface Theme" value={theme} onTap={() => setModal('theme')} />
          <Row icon={<Camera size={16} />} label="Save Media Local" toggle={saveToPhotos} onToggle={handleSavePhotos} />
        </Section>

        <Section title="Cryptographic Constraints">
          <Row icon={<Clock size={16} />} label="Burn-on-Read" value={disappearing} onTap={() => setModal('disappearing')} />
          <Row icon={<Lock size={16} />} label="State Shielding" toggle={lockChat} onToggle={handleLock} />
          <Row icon={<Shield size={16} />} label="Advanced ZK Parameters" onTap={() => setModal('advPrivacy')} />
          <Row icon={<Key size={16} />} label="ECDH Fingerprint" value="Verified" onTap={() => setModal('encryption')} />
        </Section>

        <Section title="Actions">
          <Row icon={<Share2 size={16} />} label="Export Protocol Link" onTap={handleShare} />
          <Row icon={<Heart size={16} className={isFav ? 'fill-black' : ''} />} label={isFav ? "Remove Vector" : "Save Identity Vector"} onTap={toggleFav} />
          <Row icon={<List size={16} />} label="Append to Matrix" onTap={() => setModal('list')} />
          <Row icon={<Download size={16} />} label="Extract State Log" onTap={handleExport} />
          <Row icon={<Trash2 size={16} />} label="Obliterate State" onTap={() => onClearChat?.()} />
        </Section>

        <Section title="Danger Zone">
          <Row icon={<Ban size={16} />} label={`Block Identity`} onTap={onBlock} danger />
          <Row icon={<Flag size={16} />} label={`Report Malfeasance`} onTap={handleReport} danger />
        </Section>
      </div>

      {toast && (
        <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white px-6 py-3 font-mono text-[11px] uppercase tracking-widest z-[400] whitespace-nowrap shadow-2xl">
          {toast}
        </motion.div>
      )}

      {/* Modals */}
      {modal === 'media' && (
        <Modal title="Encrypted Artifacts" onClose={() => setModal(null)}>
          <div className="text-sm font-mono text-black/50 flex flex-col gap-3">
            {messages.filter(m => m.content.match(/https?:\/\//) || m.content.length > 200).map(m => (
              <div key={m.id} className="p-3 border border-black/10">{m.content.slice(0,50)}...</div>
            ))}
            {messages.filter(m => m.content.match(/https?:\/\//) || m.content.length > 200).length === 0 && 'No artifacts detected in current state.'}
          </div>
        </Modal>
      )}

      {modal === 'storage' && (
        <Modal title="State Footprint" onClose={() => setModal(null)}>
          <div className="flex flex-col items-center py-6">
            <Database size={32} className="text-black mb-6" />
            <h4 className="text-4xl font-black font-sans">{((messages.length * 50) / 1024).toFixed(2)} KB</h4>
            <p className="text-[11px] font-mono uppercase tracking-widest text-black/40 mt-2">{messages.length} data packets</p>
          </div>
        </Modal>
      )}

      {modal === 'starred' && (
        <Modal title="Saved Vectors" onClose={() => setModal(null)}>
          <div className="flex flex-col gap-3">
            {getStarred().map((sm: any, i: number) => (
              <div key={i} className="p-4 border border-black flex flex-col gap-2 bg-[#F8F8F8]">
                <p className="text-sm font-sans">{sm.content}</p>
                <p className="text-[10px] font-mono text-black/40">{new Date(sm.timestamp).toLocaleString()}</p>
              </div>
            ))}
            {getStarred().length === 0 && <p className="text-sm font-mono text-black/50">No saved vectors.</p>}
          </div>
        </Modal>
      )}

      {modal === 'theme' && (
        <Modal title="Interface Theme" onClose={() => setModal(null)}>
          <div className="grid grid-cols-2 gap-4">
            {['Minimal', 'Terminal', 'OLED Black', 'Cyber'].map(t => (
              <button key={t} onClick={() => handleTheme(t)} className={`p-4 border text-[12px] font-mono uppercase tracking-widest ${theme === t ? 'border-black bg-black text-white' : 'border-black/20 text-black hover:border-black'}`}>
                {t}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {modal === 'disappearing' && (
        <Modal title="Burn-on-Read Settings" onClose={() => setModal(null)}>
          <div className="flex flex-col gap-3">
            {['off', '24h', '7d', '90d'].map(opt => (
              <button key={opt} onClick={() => { handleDisappearing(opt); setModal(null); }} className={`p-4 border text-[12px] font-mono uppercase tracking-widest text-left ${disappearing === opt ? 'border-black bg-black text-white' : 'border-black/20 text-black hover:border-black'}`}>
                {opt === 'off' ? 'Disabled' : `${opt} Obliteration`}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {modal === 'advPrivacy' && (
        <Modal title="Advanced ZK Parameters" onClose={() => setModal(null)}>
          <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <span className="text-[12px] font-bold uppercase tracking-wider">Obfuscate Read State</span>
              <Toggle value={advPrivacy.hideRead} onChange={(v) => handleAdvPrivacy('hideRead', v)} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[12px] font-bold uppercase tracking-wider">Screenshot Blackout</span>
              <Toggle value={advPrivacy.blockScreenshots} onChange={(v) => handleAdvPrivacy('blockScreenshots', v)} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[12px] font-bold uppercase tracking-wider">Anti-Forward Propagation</span>
              <Toggle value={advPrivacy.forwardProtection} onChange={(v) => handleAdvPrivacy('forwardProtection', v)} />
            </div>
          </div>
        </Modal>
      )}

      {modal === 'encryption' && (
        <Modal title="Cryptographic Integrity" onClose={() => setModal(null)}>
          <div className="flex flex-col gap-6 items-center text-center py-6">
            <Key size={32} className="text-black" />
            <p className="text-[12px] font-mono text-black/60 uppercase tracking-widest leading-relaxed">
              Payloads are secured via ECDH key exchange. XMTP Node routing fingerprint:
            </p>
            <p className="font-mono text-xs bg-black text-white p-4 break-all w-full">{peerAddress}</p>
            <button onClick={() => copyText(peerAddress, 'Fingerprint copied')} className="px-6 py-3 border border-black hover:bg-black hover:text-white transition-colors text-[11px] font-bold uppercase tracking-widest">
              Copy Hash
            </button>
          </div>
        </Modal>
      )}

      {modal === 'list' && (
        <Modal title="Append to Matrix" onClose={() => setModal(null)}>
          <div className="flex flex-col gap-4">
            <input 
              type="text" 
              placeholder="Matrix Identifier (e.g. CORE_TEAM)" 
              value={listInput} 
              onChange={e => setListInput(e.target.value)}
              className="w-full border border-black px-4 py-3 outline-none focus:bg-black/5 font-mono text-sm uppercase"
            />
            <button onClick={handleAddList} className="bg-black text-white py-3 font-bold uppercase tracking-widest text-[12px]">Append Vector</button>
          </div>
        </Modal>
      )}

    </motion.div>
  );
};
