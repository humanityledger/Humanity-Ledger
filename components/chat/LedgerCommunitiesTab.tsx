'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Link, Users, Globe, Copy, Check, Lock, ChevronRight, X } from 'lucide-react';

interface Community {
  id: string;
  name: string;
  description: string;
  members: number;
  isPrivate: boolean;
  createdAt: number;
  joinLink: string;
}

interface LedgerCommunitiesTabProps {
  myAddress: string;
  onOpenCommunity: (id: string) => void;
}

const generateRoomId = () => Math.random().toString(36).substring(2, 10).toUpperCase();

export const LedgerCommunitiesTab: React.FC<LedgerCommunitiesTabProps> = ({ myAddress, onOpenCommunity }) => {
  const [communities, setCommunities] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [joinLink, setJoinLink] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    fetchCommunities();
  }, [myAddress]);

  const fetchCommunities = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/chat/communities', { headers: { 'x-web3-address': myAddress } });
      if (res.ok) {
        const data = await res.json();
        setCommunities(data.communities);
      }
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  const createCommunity = async () => {
    if (!newName.trim()) return;
    try {
      const res = await fetch('/api/chat/communities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-web3-address': myAddress },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim(), isPrivate })
      });
      if (res.ok) {
        await fetchCommunities();
        setNewName('');
        setNewDesc('');
        setIsPrivate(false);
        setShowCreate(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const joinCommunity = async () => {
    // allow pasting the full link or just the code
    let code = joinLink.trim();
    const idMatch = joinLink.match(/\/join\/([A-Z0-9]+)/i);
    if (idMatch) code = idMatch[1].toUpperCase();

    if (!code) return;

    try {
      const res = await fetch('/api/chat/communities/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-web3-address': myAddress },
        body: JSON.stringify({ joinCode: code })
      });
      if (res.ok) {
        await fetchCommunities();
        setJoinLink('');
        setShowJoin(false);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to join community');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const copyLink = async (link: string, id: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  };

  const AVATAR_COLORS = ['#25D366','#34C759','#FF9500','#FF3B30','#AF52DE','#FF2D55'];
  const avatarColor = (id: string) => AVATAR_COLORS[parseInt(id.charCodeAt(0).toString(), 10) % AVATAR_COLORS.length];

  return (
    <div className="flex-1 overflow-y-auto flex flex-col bg-[#F2F2F7]">
      {/* Header Actions */}
      <div className="bg-white mb-2 px-4 py-3 flex gap-3">
        <button
          onClick={() => setShowCreate(true)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#25D366] rounded-2xl text-white font-semibold text-[14px]"
        >
          <Plus size={18} /> New Community
        </button>
        <button
          onClick={() => setShowJoin(true)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#25D366]/10 rounded-2xl text-[#25D366] font-semibold text-[14px]"
        >
          <Link size={18} /> Join via Link
        </button>
      </div>

      {/* Communities List */}
      {communities.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 py-16">
          <div className="w-20 h-20 rounded-3xl bg-white shadow-sm border border-black/[0.06] flex items-center justify-center">
            <Users size={32} className="text-[#25D366]" />
          </div>
          <p className="text-[17px] font-bold text-[#1C1C1E] text-center">Communities</p>
          <p className="text-[14px] text-[#8E8E93] text-center leading-relaxed">
            Create a community or join one with a link. Host parties, meet-ups, and more — all end-to-end encrypted.
          </p>
        </div>
      ) : (
        <div className="bg-white">
          {communities.map((c, i) => (
            <React.Fragment key={c.id}>
              {i > 0 && <div className="h-px bg-[#E5E5EA] ml-[76px]" />}
              <button
                onClick={() => onOpenCommunity(c.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F9F9F9] text-left"
              >
                {/* Avatar */}
                <div className="w-[54px] h-[54px] rounded-2xl flex items-center justify-center text-white font-bold text-xl shrink-0"
                  style={{ background: avatarColor(c.id) }}>
                  {c.name.slice(0,2).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[16px] font-semibold text-[#1C1C1E] truncate">{c.name}</p>
                    {c.isPrivate ? <Lock size={12} className="text-[#8E8E93] shrink-0" /> : <Globe size={12} className="text-[#8E8E93] shrink-0" />}
                  </div>
                  <p className="text-[13px] text-[#8E8E93] truncate">{c.description || `${c.members} member${c.members !== 1 ? 's' : ''}`}</p>
                </div>

                <button
                  onClick={e => { e.stopPropagation(); copyLink(`https://humanidfi.com/join/${c.joinCode}`, c.id); }}
                  className="w-8 h-8 rounded-full bg-[#25D366]/10 flex items-center justify-center shrink-0"
                  title="Copy invite link"
                >
                  {copiedId === c.id ? <Check size={15} className="text-[#34C759]" /> : <Copy size={15} className="text-[#25D366]" />}
                </button>
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Create Community Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end"
            onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="w-full bg-white rounded-t-3xl p-6 flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <button onClick={() => setShowCreate(false)} className="text-[#25D366]"><X size={20} /></button>
                <h3 className="text-[17px] font-semibold">New Community</h3>
                <button onClick={createCommunity} disabled={!newName.trim()} className="text-[#25D366] font-semibold disabled:opacity-40">Create</button>
              </div>

              <div className="flex flex-col gap-3">
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Community name"
                  className="w-full px-4 py-3 rounded-xl border border-black/10 text-[16px] outline-none"
                  maxLength={64}
                />
                <textarea
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="Description (optional)"
                  className="w-full px-4 py-3 rounded-xl border border-black/10 text-[15px] outline-none resize-none min-h-[80px]"
                  maxLength={256}
                />
                <button
                  onClick={() => setIsPrivate(v => !v)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${isPrivate ? 'border-[#25D366] bg-[#25D366]/5' : 'border-black/10'}`}
                >
                  {isPrivate ? <Lock size={18} className="text-[#25D366]" /> : <Globe size={18} className="text-[#8E8E93]" />}
                  <div className="flex-1 text-left">
                    <p className="text-[15px] font-medium text-[#1C1C1E]">{isPrivate ? 'Private' : 'Public'}</p>
                    <p className="text-[12px] text-[#8E8E93]">{isPrivate ? 'Invite only' : 'Anyone with the link can join'}</p>
                  </div>
                  {isPrivate && <Check size={16} className="text-[#25D366]" />}
                </button>
              </div>
              <p className="text-[12px] text-[#8E8E93] text-center">End-to-end encrypted · Members can join via invite link</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Join via Link Modal */}
      <AnimatePresence>
        {showJoin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end"
            onClick={e => { if (e.target === e.currentTarget) setShowJoin(false); }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="w-full bg-white rounded-t-3xl p-6 flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <button onClick={() => setShowJoin(false)} className="text-[#25D366]"><X size={20} /></button>
                <h3 className="text-[17px] font-semibold">Join via Link</h3>
                <button onClick={joinCommunity} disabled={!joinLink.trim()} className="text-[#25D366] font-semibold disabled:opacity-40">Join</button>
              </div>
              <input
                value={joinLink}
                onChange={e => setJoinLink(e.target.value)}
                placeholder="Paste community link here..."
                className="w-full px-4 py-3 rounded-xl border border-black/10 text-[15px] font-mono outline-none"
              />
              <p className="text-[12px] text-[#8E8E93] text-center">You can join any community you are invited to. Your connection is end-to-end encrypted.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
