'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Link, Users, Globe, Lock, ChevronRight, X, Search, Compass, Star, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

interface Community {
  id: string;
  name: string;
  description: string;
  membersCount: number;
  isPrivate: boolean;
  createdAt: number;
  joinCode: string;
  myRole?: string;
}

interface LedgerCommunitiesTabProps {
  myAddress: string;
  onOpenCommunity: (id: string) => void;
}

export const LedgerCommunitiesTab: React.FC<LedgerCommunitiesTabProps> = ({ myAddress, onOpenCommunity }) => {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [activeTab, setActiveTab] = useState<'my' | 'discover'>('my');
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [joinLink, setJoinLink] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  React.useEffect(() => {
    fetchCommunities();
  }, [myAddress]);

  const fetchCommunities = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/chat/communities', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCommunities(data.communities || []);
      }
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  const createCommunity = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch('/api/chat/communities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim(), isPrivate }),
      });
      if (res.ok) {
        await fetchCommunities();
        setNewName('');
        setNewDesc('');
        setIsPrivate(false);
        setShowCreate(false);
        toast.success('Community created');
      } else {
        const d = await res.json();
        toast.error(d.error || 'Failed to create community');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const joinCommunity = async () => {
    let code = joinLink.trim();
    const idMatch = joinLink.match(/\/join\/([A-Z0-9]+)/i);
    if (idMatch) code = idMatch[1].toUpperCase();
    if (!code || joining) return;
    setJoining(true);
    try {
      const res = await fetch('/api/chat/communities/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ joinCode: code }),
      });
      if (res.ok) {
        await fetchCommunities();
        setJoinLink('');
        setShowJoin(false);
        toast.success('Joined successfully');
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to join community');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const AVATAR_COLORS = ['#25D366', '#34C759', '#FF9500', '#FF3B30', '#AF52DE', '#FF2D55', '#5856D6', '#007AFF'];
  const avatarColor = (id: string) => AVATAR_COLORS[parseInt(id.charCodeAt(0).toString(), 10) % AVATAR_COLORS.length];

  return (
    <div className="flex-1 overflow-y-auto flex flex-col bg-[#F2F2F7]">

      {/* HEADER */}
      <div className="bg-white px-4 pt-3 pb-3 shadow-sm z-10 sticky top-0">
        {/* Segmented control */}
        <div className="flex items-center p-1 bg-[#F2F2F7] rounded-xl mb-3">
          <button
            onClick={() => setActiveTab('my')}
            className={`flex-1 py-2 text-[14px] font-semibold rounded-lg transition-all ${activeTab === 'my' ? 'bg-white text-black shadow-sm' : 'text-black/50'}`}
          >
            My Groups
          </button>
          <button
            onClick={() => setActiveTab('discover')}
            className={`flex-1 py-2 text-[14px] font-semibold rounded-lg transition-all ${activeTab === 'discover' ? 'bg-white text-black shadow-sm' : 'text-black/50'}`}
          >
            Discover
          </button>
        </div>

        {activeTab === 'my' && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreate(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#25D366] hover:bg-[#20bd59] transition-colors rounded-xl text-white font-bold text-[14px] shadow-sm"
            >
              <Plus size={18} /> Create Group
            </button>
            <button
              onClick={() => setShowJoin(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-black/5 hover:bg-black/10 transition-colors rounded-xl text-black font-bold text-[14px]"
            >
              <Link size={18} /> Join
            </button>
          </div>
        )}

        {activeTab === 'discover' && (
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />
            <input
              type="text"
              placeholder="Search public groups..."
              className="w-full bg-[#F2F2F7] rounded-xl py-2.5 pl-10 pr-4 text-[14px] font-medium outline-none placeholder:text-black/40 focus:ring-2 focus:ring-[#25D366]/50"
            />
          </div>
        )}
      </div>

      {/* CONTENT */}
      {activeTab === 'my' ? (
        <div className="flex-1 flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <span className="w-8 h-8 border-4 border-[#25D366]/20 border-t-[#25D366] rounded-full animate-spin" />
            </div>
          ) : communities.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 py-16">
              <div className="w-24 h-24 rounded-full bg-[#25D366]/10 flex items-center justify-center">
                <Users size={36} className="text-[#25D366]" />
              </div>
              <div className="text-center">
                <p className="text-[19px] font-black text-[#1C1C1E] mb-2">No groups yet</p>
                <p className="text-[14px] text-[#8E8E93] leading-relaxed max-w-[260px] mx-auto">
                  Create a private space for your team, project, or friends. Invite people with a link.
                </p>
              </div>
              <button
                onClick={() => setShowCreate(true)}
                className="px-6 py-3 bg-[#25D366] text-white font-bold rounded-xl text-[14px] hover:bg-[#20bd59] transition-colors shadow-sm"
              >
                Create your first group
              </button>
            </div>
          ) : (
            <div className="p-4 flex flex-col gap-3">
              {communities.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onOpenCommunity(c.id)}
                  className="w-full bg-white p-4 rounded-2xl shadow-sm border border-black/[0.04] flex items-center gap-4 hover:shadow-md transition-all group text-left relative overflow-hidden active:scale-[0.98]"
                >
                  {/* Hover accent */}
                  <div className="absolute top-0 bottom-0 left-0 w-1 bg-[#25D366] opacity-0 group-hover:opacity-100 transition-opacity rounded-l-2xl" />

                  {/* Avatar */}
                  <div
                    className="w-[56px] h-[56px] rounded-[18px] flex items-center justify-center text-white font-black text-[20px] shrink-0"
                    style={{ background: avatarColor(c.id) }}
                  >
                    {c.name.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-[16px] font-bold text-[#1C1C1E] truncate">{c.name}</p>
                        {c.isPrivate
                          ? <Lock size={12} className="text-[#8E8E93] shrink-0" />
                          : <Globe size={12} className="text-[#8E8E93] shrink-0" />}
                      </div>
                      <ChevronRight size={16} className="text-black/20 group-hover:text-[#25D366] transition-colors shrink-0" />
                    </div>

                    <p className="text-[13px] text-[#8E8E93] truncate mb-2">
                      {c.description || 'Welcome to our community'}
                    </p>

                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[11px] font-bold text-black/40 bg-black/5 px-2 py-1 rounded-md">
                        <Users size={11} /> {c.membersCount || 1} members
                      </span>
                      {c.myRole === 'ADMIN' && (
                        <span className="text-[11px] font-bold text-[#25D366] bg-[#25D366]/10 px-2 py-1 rounded-md">
                          Admin
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* DISCOVER TAB */
        <div className="flex-1 flex flex-col p-4 gap-6">
          <div className="bg-[#1C1C1E] rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 w-40 h-40 bg-[#25D366]/10 rounded-full blur-2xl" />
            <Compass size={30} className="mb-4 text-[#25D366]" />
            <h2 className="text-[20px] font-black leading-tight mb-2">Explore Public Groups</h2>
            <p className="text-[13px] text-white/60 font-medium leading-relaxed">
              Join public communities, DAOs, and alpha groups.
            </p>
          </div>

          <div>
            <h3 className="text-[14px] font-bold text-black/60 mb-3 flex items-center gap-2">
              <TrendingUp size={15} className="text-[#25D366]" /> Trending
            </h3>
            <div className="bg-white rounded-2xl shadow-sm border border-black/5 p-8 flex flex-col items-center justify-center text-center">
              <Star size={28} className="text-[#FFCC00] mb-3" />
              <p className="font-bold text-[15px] mb-1">Coming soon</p>
              <p className="text-[13px] text-black/40">Public group discovery launches in the next update.</p>
            </div>
          </div>
        </div>
      )}

      {/* CREATE COMMUNITY MODAL */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="w-full max-w-md bg-white rounded-3xl p-6 flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[20px] font-black text-[#1C1C1E]">Create a group</h2>
                <button
                  onClick={() => setShowCreate(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-black/5 text-black/50 hover:text-black hover:bg-black/10 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="text-[13px] text-black/40 font-medium mb-5 leading-relaxed">
                You can change the name, description, and privacy settings at any time from the group settings.
              </p>

              <div className="flex flex-col gap-4 mb-6">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-black/40 ml-1 mb-1.5 block">Group Name</label>
                  <input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) createCommunity(); }}
                    placeholder="e.g. Protocol Core Team"
                    className="w-full px-4 py-3.5 rounded-xl bg-[#F2F2F7] text-[15px] font-semibold outline-none border-2 border-transparent focus:border-[#25D366] transition-colors"
                    maxLength={64}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-black/40 ml-1 mb-1.5 block">Description <span className="font-medium normal-case text-[10px]">(optional)</span></label>
                  <textarea
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    placeholder="What is this group about?"
                    className="w-full px-4 py-3.5 rounded-xl bg-[#F2F2F7] text-[14px] outline-none border-2 border-transparent focus:border-[#25D366] transition-colors resize-none min-h-[90px]"
                    maxLength={256}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-black/40 ml-1 mb-2 block">Visibility</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setIsPrivate(false)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${!isPrivate ? 'border-[#25D366] bg-[#25D366]/5' : 'border-black/5 hover:bg-black/5'}`}
                    >
                      <Globe size={22} className={!isPrivate ? 'text-[#25D366]' : 'text-black/40'} />
                      <span className={`text-[13px] font-bold ${!isPrivate ? 'text-[#1C1C1E]' : 'text-black/40'}`}>Public</span>
                    </button>
                    <button
                      onClick={() => setIsPrivate(true)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${isPrivate ? 'border-[#1C1C1E] bg-[#1C1C1E]/5' : 'border-black/5 hover:bg-black/5'}`}
                    >
                      <Lock size={22} className={isPrivate ? 'text-[#1C1C1E]' : 'text-black/40'} />
                      <span className={`text-[13px] font-bold ${isPrivate ? 'text-[#1C1C1E]' : 'text-black/40'}`}>Private</span>
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={createCommunity}
                disabled={!newName.trim() || creating}
                className="w-full py-4 bg-[#25D366] text-white font-bold rounded-xl shadow-lg shadow-[#25D366]/20 disabled:opacity-40 disabled:shadow-none hover:bg-[#20bd59] transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {creating ? (
                  <>
                    <motion.div
                      className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    />
                    Creating...
                  </>
                ) : 'Create group'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* JOIN COMMUNITY MODAL */}
      <AnimatePresence>
        {showJoin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowJoin(false); }}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="w-full max-w-sm bg-white rounded-3xl p-6 flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[20px] font-black text-[#1C1C1E]">Join a group</h2>
                <button
                  onClick={() => setShowJoin(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-black/5 text-black/50 hover:text-black hover:bg-black/10 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="text-[13px] text-black/45 mb-5 font-medium leading-relaxed">
                Paste an invite link or code to join the group.
              </p>

              <input
                value={joinLink}
                onChange={e => setJoinLink(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && joinLink.trim()) joinCommunity(); }}
                placeholder="https://humanidfi.com/join/..."
                className="w-full px-4 py-3.5 mb-5 rounded-xl bg-[#F2F2F7] text-[14px] font-mono outline-none border-2 border-transparent focus:border-[#25D366] transition-colors"
                autoFocus
              />

              <button
                onClick={joinCommunity}
                disabled={!joinLink.trim() || joining}
                className="w-full py-3.5 bg-[#1C1C1E] text-white font-bold rounded-xl shadow-lg shadow-black/10 disabled:opacity-40 disabled:shadow-none hover:bg-black transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {joining ? (
                  <>
                    <motion.div
                      className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    />
                    Joining...
                  </>
                ) : 'Join now'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
