'use client';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, Video, Search, ChevronRight, X, Lock, Bell, Image,
  Database, Star, Palette, Camera, Clock, Shield, Key, Users,
  Share2, Heart, List, Download, Trash2, Ban, Flag, Plus,
  MessageCircle, Link, FileText, ArrowLeft, Copy
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

const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <button
    onClick={() => onChange(!value)}
    className={`relative w-[51px] h-[31px] rounded-full transition-colors duration-200 ${value ? 'bg-[#34C759]' : 'bg-[#E9E9EB]'}`}
  >
    <span className={`absolute top-[2px] w-[27px] h-[27px] bg-white rounded-full shadow-md transition-transform duration-200 ${value ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
  </button>
);

const Row = ({ icon, label, value, onTap, danger = false, toggle, onToggle }: {
  icon: React.ReactNode; label: string; value?: string;
  onTap?: () => void; danger?: boolean;
  toggle?: boolean; onToggle?: (v: boolean) => void;
}) => (
  <button
    onClick={onTap}
    className={`w-full flex items-center gap-3 px-4 py-3 ${onTap || onToggle ? 'hover:bg-[#F2F2F7] active:bg-[#E5E5EA]' : ''} transition-colors text-left`}
  >
    <span className={`shrink-0 ${danger ? 'text-[#FF3B30]' : 'text-[#007AFF]'}`}>{icon}</span>
    <span className={`flex-1 text-[16px] font-normal ${danger ? 'text-[#FF3B30]' : 'text-[#1C1C1E]'}`}>{label}</span>
    {value && <span className="text-[14px] text-[#8E8E93] mr-1">{value}</span>}
    {onToggle !== undefined && toggle !== undefined ? (
      <Toggle value={toggle} onChange={onToggle} />
    ) : onTap ? (
      <ChevronRight size={16} className="text-[#C7C7CC] shrink-0" />
    ) : null}
  </button>
);

const Section = ({ title, children }: { title?: string; children: React.ReactNode }) => (
  <div className="mb-6">
    {title && <p className="px-4 mb-1 text-[13px] font-semibold uppercase tracking-wider text-[#6D6D72]">{title}</p>}
    <div className="bg-white rounded-2xl overflow-hidden mx-2 shadow-sm border border-black/[0.06]">
      {children}
    </div>
  </div>
);

const Divider = () => <div className="h-px bg-[#E5E5EA] ml-4" />;

const Modal = ({ title, onClose, children }: { title: string, onClose: () => void, children: React.ReactNode }) => (
  <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50">
    <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
      <div className="flex items-center justify-between p-4 border-b border-[#E5E5EA]">
        <h3 className="font-semibold text-[17px]">{title}</h3>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100"><X size={20} /></button>
      </div>
      <div className="p-4 overflow-y-auto">
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
  const [showDisappearingMenu, setShowDisappearingMenu] = useState(false);
  
  const [toast, setToast] = useState<string | null>(null);
  const [modal, setModal] = useState<string | null>(null); // media, storage, starred, theme, advPrivacy, encryption, contact, list
  const [listInput, setListInput] = useState('');
  const [theme, setTheme] = useState('Default');

  const [advPrivacy, setAdvPrivacy] = useState({
    hideRead: false,
    blockScreenshots: false,
    forwardProtection: false,
  });

  const displayName = peerName || shortAddr(peerAddress);

  useEffect(() => {
    setSaveToPhotos(localStorage.getItem('ledger_save_photos_' + peerAddress) === '1');
    setLockChat(localStorage.getItem('ledger_locked_' + peerAddress) === '1');
    setIsMuted(localStorage.getItem('ledger_muted_' + peerAddress) === '1');
    setDisappearing((localStorage.getItem('ledger_disappearing_' + peerAddress) as any) || 'off');
    setTheme(localStorage.getItem('ledger_theme_' + peerAddress) || 'Default');
    
    try {
      const favs = JSON.parse(localStorage.getItem('ledger_favourites') || '[]');
      setIsFav(favs.includes(peerAddress));
    } catch {}

    setAdvPrivacy({
      hideRead: localStorage.getItem(`ledger_adv_privacy_${peerAddress}_hideRead`) === '1',
      blockScreenshots: localStorage.getItem(`ledger_adv_privacy_${peerAddress}_blockScreenshots`) === '1',
      forwardProtection: localStorage.getItem(`ledger_adv_privacy_${peerAddress}_forwardProtection`) === '1',
    });
  }, [peerAddress]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleMute = (muted: boolean) => {
    setIsMuted(muted);
    if (muted) {
      localStorage.setItem('ledger_muted_' + peerAddress, '1');
      showToast('Chat muted');
    } else {
      localStorage.removeItem('ledger_muted_' + peerAddress);
      showToast('Notifications restored');
    }
  };

  const handleLock = (locked: boolean) => {
    setLockChat(locked);
    if (locked) {
      localStorage.setItem('ledger_locked_' + peerAddress, '1');
      showToast('Chat locked. Requires PIN to access.');
    } else {
      localStorage.removeItem('ledger_locked_' + peerAddress);
    }
  };

  const handleSaveToPhotos = (val: boolean) => {
    setSaveToPhotos(val);
    if (val) localStorage.setItem('ledger_save_photos_' + peerAddress, '1');
    else localStorage.removeItem('ledger_save_photos_' + peerAddress);
  };

  const handleDisappearing = (opt: 'off' | '24h' | '7d' | '90d') => {
    setDisappearing(opt);
    localStorage.setItem('ledger_disappearing_' + peerAddress, opt);
    setShowDisappearingMenu(false);
  };

  const handleTheme = (t: string) => {
    setTheme(t);
    localStorage.setItem('ledger_theme_' + peerAddress, t);
    setModal(null);
  };

  const handleAdvPrivacy = (key: keyof typeof advPrivacy, val: boolean) => {
    setAdvPrivacy(prev => ({ ...prev, [key]: val }));
    if (val) localStorage.setItem(`ledger_adv_privacy_${peerAddress}_${key}`, '1');
    else localStorage.removeItem(`ledger_adv_privacy_${peerAddress}_${key}`);
  };

  const toggleFav = () => {
    try {
      let favs = JSON.parse(localStorage.getItem('ledger_favourites') || '[]');
      if (favs.includes(peerAddress)) {
        favs = favs.filter((f: string) => f !== peerAddress);
        setIsFav(false);
        showToast('Removed from Favourites');
      } else {
        favs.push(peerAddress);
        setIsFav(true);
        showToast('⭐ Added to Favourites');
      }
      localStorage.setItem('ledger_favourites', JSON.stringify(favs));
    } catch {}
  };

  const handleAddList = () => {
    if (!listInput.trim()) return;
    try {
      const existing = JSON.parse(localStorage.getItem('ledger_list_' + listInput) || '[]');
      if (!existing.includes(peerAddress)) {
        localStorage.setItem('ledger_list_' + listInput, JSON.stringify([...existing, peerAddress]));
      }
      showToast(`Added to list: ${listInput}`);
      setModal(null);
      setListInput('');
    } catch {}
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: peerName, text: peerAddress, url: 'https://humanidfi.com/connect?peer=' + peerAddress }).catch(() => {});
    } else {
      navigator.clipboard.writeText(peerAddress);
      showToast('Contact address copied to clipboard');
    }
  };

  const handleExport = () => {
    const chatText = messages.map(m => `[${new Date(m.timestamp || m.sentAt).toLocaleString()}] ${m.senderAddress === myAddress ? 'Me' : displayName}: ${m.content}`).join('\n');
    const blob = new Blob([chatText], {type: 'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chat-' + peerAddress.slice(0,8) + '.txt';
    a.click();
  };

  const handleReport = async () => {
    try {
      const res = await fetch('/api/chat/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reporter: myAddress, reported: peerAddress, reason: 'spam' })
      });
      if (res.ok) showToast('Report submitted. Thank you.');
      else showToast('Failed to report.');
    } catch {
      showToast('Error submitting report.');
    }
  };

  const getStarred = () => {
    try {
      return JSON.parse(localStorage.getItem('ledger_starred_' + peerAddress) || '[]');
    } catch { return []; }
  };

  const copyText = (txt: string, msg: string) => {
    navigator.clipboard.writeText(txt);
    showToast(msg);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-[#F2F2F7] overflow-y-auto"
    >
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full z-[400] text-sm">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#F2F2F7]/90 backdrop-blur-xl border-b border-black/[0.06] px-4 pt-12 pb-3 flex items-center gap-3">
        <button onClick={onClose} className="flex items-center gap-1 text-[#007AFF] text-[16px]">
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>
        <span className="flex-1 text-center text-[17px] font-semibold text-[#1C1C1E]">Contact Info</span>
        <div className="w-16" />
      </div>

      <div className="pb-12">
        {/* Avatar + Name */}
        <div className="flex flex-col items-center py-8 px-4">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#007AFF] to-[#5856D6] flex items-center justify-center mb-3 shadow-lg">
            <span className="text-3xl font-bold text-white">{initials(displayName, peerAddress)}</span>
          </div>
          <h2 className="text-[22px] font-bold text-[#1C1C1E] mb-1">{displayName}</h2>
          <p className="text-[13px] font-mono text-[#8E8E93]">{peerAddress}</p>
        </div>

        {/* 3 Action Buttons */}
        <div className="flex justify-center gap-4 px-6 mb-8">
          {[
            { icon: <Phone size={22} />, label: 'Voice', action: onVoiceCall, color: '#007AFF' },
            { icon: <Video size={22} />, label: 'Video', action: onVideoCall, color: '#007AFF' },
            { icon: <Search size={22} />, label: 'Search', action: onSearch, color: '#007AFF' },
          ].map(({ icon, label, action, color }) => (
            <button
              key={label}
              onClick={action}
              className="flex flex-col items-center gap-2 flex-1"
            >
              <div className="w-[56px] h-[56px] rounded-2xl bg-white shadow-sm border border-black/[0.06] flex items-center justify-center" style={{ color }}>
                {icon}
              </div>
              <span className="text-[12px] font-semibold text-[#007AFF]">{label}</span>
            </button>
          ))}
        </div>

        {/* Media, Links & Docs */}
        <Section>
          <Row icon={<Image size={18} />} label="Media, Links & Docs" onTap={() => setModal('media')} />
          <Divider />
          <Row icon={<Database size={18} />} label="Manage Storage" onTap={() => setModal('storage')} />
          <Divider />
          <Row icon={<Star size={18} />} label="Starred Messages" onTap={() => setModal('starred')} />
        </Section>

        {/* Notifications & Appearance */}
        <Section title="Chat">
          <Row icon={<Bell size={18} />} label="Notifications" value={isMuted ? 'Muted' : 'Default'} toggle={isMuted} onToggle={handleMute} />
          <Divider />
          <Row icon={<Palette size={18} />} label="Chat Theme" value={theme} onTap={() => setModal('theme')} />
          <Divider />
          <Row icon={<Camera size={18} />} label="Save to Photos" toggle={saveToPhotos} onToggle={handleSaveToPhotos} />
        </Section>

        {/* Privacy */}
        <Section title="Privacy & Security">
          <Row
            icon={<Clock size={18} />}
            label="Disappearing Messages"
            value={disappearing === 'off' ? 'Off' : disappearing}
            onTap={() => setShowDisappearingMenu(m => !m)}
          />
          {showDisappearingMenu && (
            <div className="bg-[#F9F9F9] px-4 py-3 flex flex-col gap-2 border-t border-black/[0.06]">
              {(['off', '24h', '7d', '90d'] as const).map(opt => (
                <button key={opt} onClick={() => handleDisappearing(opt)}
                  className={`text-[15px] py-2 px-3 rounded-xl text-left ${disappearing === opt ? 'bg-[#007AFF]/10 text-[#007AFF] font-semibold' : 'text-[#1C1C1E]'}`}>
                  {opt === 'off' ? 'Off' : opt === '24h' ? '24 Hours' : opt === '7d' ? '7 Days' : '90 Days'}
                </button>
              ))}
            </div>
          )}
          <Divider />
          <Row icon={<Lock size={18} />} label="Lock Chat" toggle={lockChat} onToggle={handleLock} />
          <Divider />
          <Row icon={<Shield size={18} />} label="Advanced Chat Privacy" onTap={() => setModal('advPrivacy')} />
          <Divider />
          <Row icon={<Key size={18} />} label="Encryption" value="End-to-end encrypted" onTap={() => setModal('encryption')} />
        </Section>

        {/* Contact Details */}
        <Section title="Contact">
          <Row icon={<MessageCircle size={18} />} label="Contact Details" value={peerAddress ? shortAddr(peerAddress) : ''} onTap={() => setModal('contact')} />
        </Section>

        {/* Common Groups */}
        <Section title={groups.length > 0 ? `${groups.length} Group${groups.length !== 1 ? 's' : ''} in Common` : 'Groups'}>
          {groups.length > 0 ? groups.map((g, i) => (
            <React.Fragment key={g.id}>
              {i > 0 && <Divider />}
              <Row icon={<Users size={18} />} label={g.name} onTap={() => {}} />
            </React.Fragment>
          )) : (
            <Row icon={<Plus size={18} />} label="Add to Group" onTap={() => onAddToGroup?.()} />
          )}
        </Section>

        {/* Actions */}
        <Section>
          <Row icon={<Share2 size={18} />} label="Share Contact" onTap={handleShare} />
          <Divider />
          <Row icon={<Heart size={18} className={isFav ? 'fill-current text-[#FF3B30]' : ''} />} label={isFav ? "Remove from Favourites" : "Add to Favourites"} onTap={toggleFav} />
          <Divider />
          <Row icon={<List size={18} />} label="Add to List" onTap={() => setModal('list')} />
          <Divider />
          <Row icon={<Download size={18} />} label="Export Chat" onTap={handleExport} />
          <Divider />
          <Row icon={<Trash2 size={18} />} label="Clear Chat" onTap={() => onClearChat?.()} />
        </Section>

        {/* Danger Zone */}
        <Section>
          <Row icon={<Ban size={18} />} label={`Block "${displayName}"`} onTap={onBlock} danger />
          <Divider />
          <Row icon={<Flag size={18} />} label={`Report "${displayName}"`} onTap={handleReport} danger />
        </Section>
      </div>

      {/* Modals */}
      {modal === 'media' && (
        <Modal title="Media, Links & Docs" onClose={() => setModal(null)}>
          <div className="text-sm text-gray-500">
            {messages.filter(m => m.content.match(/https?:\/\//) || m.content.length > 200).map(m => (
              <div key={m.id} className="py-2 border-b last:border-0">{m.content.slice(0,50)}...</div>
            ))}
            {messages.filter(m => m.content.match(/https?:\/\//) || m.content.length > 200).length === 0 && 'No media or links found in this chat.'}
          </div>
        </Modal>
      )}

      {modal === 'storage' && (
        <Modal title="Manage Storage" onClose={() => setModal(null)}>
          <div className="flex flex-col items-center p-4">
            <Database size={48} className="text-[#007AFF] mb-4" />
            <h4 className="text-xl font-semibold">{((messages.length * 50) / 1024).toFixed(2)} KB</h4>
            <p className="text-gray-500">{messages.length} text messages</p>
          </div>
        </Modal>
      )}

      {modal === 'starred' && (
        <Modal title="Starred Messages" onClose={() => setModal(null)}>
          <div className="flex flex-col gap-2">
            {getStarred().map((sm: any, i: number) => (
              <div key={i} className="p-3 bg-gray-50 rounded-xl">
                <p className="text-sm">{sm.content}</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(sm.timestamp).toLocaleString()}</p>
              </div>
            ))}
            {getStarred().length === 0 && <p className="text-sm text-gray-500">No starred messages.</p>}
          </div>
        </Modal>
      )}

      {modal === 'theme' && (
        <Modal title="Chat Theme" onClose={() => setModal(null)}>
          <div className="grid grid-cols-3 gap-4">
            {['Default', 'Pink', 'Purple', 'Green', 'Blue', 'Dark'].map(t => (
              <button key={t} onClick={() => handleTheme(t)} className={`p-4 rounded-xl border ${theme === t ? 'border-[#007AFF] bg-blue-50' : 'border-gray-200'}`}>
                {t}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {modal === 'advPrivacy' && (
        <Modal title="Advanced Chat Privacy" onClose={() => setModal(null)}>
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span>Hide read receipts for this chat</span>
              <Toggle value={advPrivacy.hideRead} onChange={(v) => handleAdvPrivacy('hideRead', v)} />
            </div>
            <div className="flex justify-between items-center">
              <span>Block screenshots</span>
              <Toggle value={advPrivacy.blockScreenshots} onChange={(v) => handleAdvPrivacy('blockScreenshots', v)} />
            </div>
            <div className="flex justify-between items-center">
              <span>Forward protection</span>
              <Toggle value={advPrivacy.forwardProtection} onChange={(v) => handleAdvPrivacy('forwardProtection', v)} />
            </div>
          </div>
        </Modal>
      )}

      {modal === 'encryption' && (
        <Modal title="Encryption" onClose={() => setModal(null)}>
          <div className="flex flex-col gap-4 items-center text-center">
            <Key size={48} className="text-green-500" />
            <p className="text-sm">Messages are secured with end-to-end encryption. Your XMTP key fingerprint:</p>
            <p className="font-mono text-xs bg-gray-100 p-2 rounded-lg break-all">{peerAddress}</p>
            <button onClick={() => copyText(peerAddress, 'Fingerprint copied')} className="text-[#007AFF] font-medium flex items-center gap-2">
              <Copy size={16} /> Copy Fingerprint
            </button>
          </div>
        </Modal>
      )}

      {modal === 'contact' && (
        <Modal title="Contact Details" onClose={() => setModal(null)}>
          <div className="flex flex-col gap-4 items-center text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#007AFF] to-[#5856D6] flex items-center justify-center mb-2 shadow-lg">
              <span className="text-2xl font-bold text-white">{initials(displayName, peerAddress)}</span>
            </div>
            <h4 className="font-semibold text-lg">{displayName}</h4>
            <p className="font-mono text-xs bg-gray-100 p-2 rounded-lg break-all w-full">{peerAddress}</p>
            <button onClick={() => copyText(peerAddress, 'Address copied')} className="text-[#007AFF] font-medium flex items-center gap-2">
              <Copy size={16} /> Copy Address
            </button>
          </div>
        </Modal>
      )}

      {modal === 'list' && (
        <Modal title="Add to List" onClose={() => setModal(null)}>
          <div className="flex flex-col gap-4">
            <input 
              type="text" 
              placeholder="List name (e.g. Work, Friends)" 
              value={listInput} 
              onChange={e => setListInput(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-2 outline-none focus:border-[#007AFF]"
            />
            <button onClick={handleAddList} className="bg-[#007AFF] text-white py-2 rounded-xl font-medium">Add</button>
          </div>
        </Modal>
      )}

    </motion.div>
  );
};
