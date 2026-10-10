'use client';
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Users, Shield, ShieldOff, MessageCircle, X, Search, Link,
  Crown, ChevronDown, MoreVertical, Ban, Trash2
} from 'lucide-react';

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface Member {
  address: string;
  role: 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER' | 'BANNED';
  joinedAt: string;
  lastActive?: string;
}

interface CommunityMemberPanelProps {
  community: any;
  myAddress: string;
  onClose: () => void;
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

const truncateAddr = (a: string) => a ? `${a.slice(0, 6)}...${a.slice(-4)}` : 'Unknown';

const getAvatarColor = (addr: string) => {
  const colors = ['#25D366', '#007AFF', '#FF9500', '#FF3B30', '#AF52DE', '#FF2D55', '#34C759'];
  const num = parseInt(addr?.slice(2, 6) || '0', 16);
  return colors[num % colors.length];
};

const ROLE_BADGES = {
  OWNER: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Owner', icon: Crown },
  ADMIN: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Admin', icon: Shield },
  MODERATOR: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Mod', icon: Shield },
  MEMBER: { bg: 'bg-black/5', text: 'text-black/50', label: 'Member', icon: null },
  BANNED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Banned', icon: Ban },
};

// ─── MEMBER ROW COMPONENT ───────────────────────────────────────────────────

function MemberRow({
  member,
  myRole,
  isMe,
  onAction
}: {
  member: Member;
  myRole: string;
  isMe: boolean;
  onAction: (action: string, address: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const badge = ROLE_BADGES[member.role] || ROLE_BADGES.MEMBER;
  const BadgeIcon = badge.icon;

  // Permissions logic
  const canManage = (myRole === 'OWNER' || myRole === 'ADMIN') && !isMe && member.role !== 'OWNER';
  const canBan = myRole === 'OWNER' || (myRole === 'ADMIN' && member.role === 'MEMBER');

  return (
    <div className="flex items-center gap-3 p-3 hover:bg-[#F2F2F7] rounded-2xl transition-colors group relative">
      {/* Avatar */}
      <div 
        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px] font-black shrink-0 relative"
        style={{ backgroundColor: getAvatarColor(member.address) }}
      >
        {member.address?.slice(2, 4).toUpperCase()}
        {member.role === 'OWNER' && (
          <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-white rounded-full p-0.5 border-2 border-white">
            <Crown size={10} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[14px] font-bold text-[#1C1C1E] font-mono truncate">
            {truncateAddr(member.address)}
          </span>
          {isMe && <span className="bg-[#25D366]/10 text-[#25D366] text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md">You</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md flex items-center gap-1 ${badge.bg} ${badge.text}`}>
            {BadgeIcon && <BadgeIcon size={10} />}
            {badge.label}
          </span>
          <span className="text-[11px] text-black/30">
            Joined {new Date(member.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Actions Dropdown */}
      {(!isMe && member.role !== 'BANNED') && (
        <div className="relative">
          <button 
            onClick={() => setShowMenu(p => !p)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-black/20 hover:text-black hover:bg-black/5 transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreVertical size={16} />
          </button>
          
          <AnimatePresence>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, transformOrigin: 'top right' }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1 w-48 bg-white rounded-2xl shadow-xl border border-black/5 py-1.5 z-50 overflow-hidden"
                >
                  <button onClick={() => { onAction('MESSAGE', member.address); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#F2F2F7] transition-colors">
                    <MessageCircle size={15} className="text-black/40" />
                    <span className="text-[13px] font-semibold text-[#1C1C1E]">Send Message</span>
                  </button>
                  
                  {canManage && (
                    <>
                      <div className="h-px bg-black/5 my-1" />
                      {member.role === 'MEMBER' && (
                        <button onClick={() => { onAction('PROMOTE_ADMIN', member.address); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#F2F2F7] transition-colors">
                          <Shield size={15} className="text-purple-500" />
                          <span className="text-[13px] font-semibold text-[#1C1C1E]">Promote to Admin</span>
                        </button>
                      )}
                      {member.role === 'ADMIN' && myRole === 'OWNER' && (
                        <button onClick={() => { onAction('DEMOTE_MEMBER', member.address); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#F2F2F7] transition-colors">
                          <ShieldOff size={15} className="text-orange-500" />
                          <span className="text-[13px] font-semibold text-[#1C1C1E]">Demote to Member</span>
                        </button>
                      )}
                      <button onClick={() => { onAction('KICK', member.address); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-red-50 text-red-600 transition-colors">
                        <Trash2 size={15} />
                        <span className="text-[13px] font-semibold">Kick Member</span>
                      </button>
                    </>
                  )}
                  {canBan && (
                    <button onClick={() => { onAction('BAN', member.address); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-red-50 text-red-600 transition-colors">
                      <Ban size={15} />
                      <span className="text-[13px] font-semibold">Ban User</span>
                    </button>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Unban button for Banned members */}
      {(member.role === 'BANNED' && (myRole === 'OWNER' || myRole === 'ADMIN')) && (
        <button 
          onClick={() => onAction('UNBAN', member.address)}
          className="text-[11px] font-bold text-black/40 hover:text-black bg-black/5 px-3 py-1.5 rounded-full transition-colors"
        >
          Unban
        </button>
      )}
    </div>
  );
}

// ─── MAIN PANEL COMPONENT ───────────────────────────────────────────────────

export function CommunityMemberPanel({ community, myAddress, onClose }: CommunityMemberPanelProps) {
  const [activeTab, setActiveTab] = useState<'ALL' | 'ADMINS' | 'BANNED'>('ALL');
  const [search, setSearch] = useState('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Derive members from community object or fallback mock data
  const members: Member[] = useMemo(() => {
    if (!community) return [];
    
    // If real members array exists from Prisma
    if (community.members && Array.isArray(community.members)) {
      return community.members.map((m: any) => ({
        address: m.walletAddress,
        role: m.role || 'MEMBER',
        joinedAt: m.joinedAt || new Date().toISOString(),
        lastActive: new Date().toISOString() // mock active
      }));
    }

    // Mock fallback if members aren't loaded correctly yet
    return [
      { address: community.ownerAddress || myAddress, role: 'OWNER', joinedAt: community.createdAt || new Date().toISOString() },
      { address: '0x1234000000000000000000000000000000005678', role: 'ADMIN', joinedAt: new Date(Date.now() - 86400000 * 5).toISOString() },
      { address: '0xabcd00000000000000000000000000000000efgh', role: 'MEMBER', joinedAt: new Date(Date.now() - 86400000 * 12).toISOString() },
      { address: '0x9999000000000000000000000000000000009999', role: 'BANNED', joinedAt: new Date(Date.now() - 86400000 * 20).toISOString() },
    ];
  }, [community, myAddress]);

  const myRole = members.find(m => m.address.toLowerCase() === myAddress.toLowerCase())?.role || 'MEMBER';

  // Stats
  const totalMembers = members.filter(m => m.role !== 'BANNED').length;
  const adminCount = members.filter(m => m.role === 'ADMIN' || m.role === 'OWNER').length;
  const activeToday = Math.max(1, Math.floor(totalMembers * 0.4)); // Mock stat

  // Filters
  const filteredMembers = useMemo(() => {
    let result = members;
    if (activeTab === 'ADMINS') result = members.filter(m => m.role === 'ADMIN' || m.role === 'OWNER');
    else if (activeTab === 'BANNED') result = members.filter(m => m.role === 'BANNED');
    else result = members.filter(m => m.role !== 'BANNED'); // ALL tab hides banned

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(m => m.address.toLowerCase().includes(q));
    }
    
    // Sort: Owner first, then admins, then newest
    return result.sort((a, b) => {
      if (a.role === 'OWNER') return -1;
      if (b.role === 'OWNER') return 1;
      if (a.role === 'ADMIN' && b.role !== 'ADMIN') return -1;
      if (b.role === 'ADMIN' && a.role !== 'ADMIN') return 1;
      return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime();
    });
  }, [members, activeTab, search]);

  const handleAction = async (action: string, targetAddress: string) => {
    if (action === 'MESSAGE') {
      // Logic to open 1-1 chat
      toast.info(`Opening chat with ${truncateAddr(targetAddress)}...`);
      return;
    }

    setLoadingAction(`${action}_${targetAddress}`);
    try {
      const apiAction = action === 'PROMOTE_ADMIN' ? 'UPDATE_MEMBER_ROLE' :
                        action === 'DEMOTE_MEMBER' ? 'UPDATE_MEMBER_ROLE' :
                        action === 'KICK' ? 'KICK_MEMBER' :
                        action === 'BAN' ? 'BAN_MEMBER' :
                        action === 'UNBAN' ? 'UNBAN_MEMBER' : '';
                        
      const role = action === 'PROMOTE_ADMIN' ? 'ADMIN' : 'MEMBER';

      const res = await fetch('/api/chat/communities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-web3-address': myAddress, 'x-verified-session-address': myAddress },
        body: JSON.stringify({ 
          action: apiAction, 
          communityId: community?.id, 
          targetAddress,
          role
        }),
      });

      if (!res.ok) throw new Error('Action failed');
      toast.success('Member updated successfully');
      // In a real app, we would mutate the local members state here or trigger a refresh
    } catch (e: any) {
      toast.error(e.message || 'Failed to update member');
    } finally {
      setLoadingAction(null);
    }
  };

  const copyInvite = () => {
    const link = `https://humanidfi.com/join/${community?.joinCode || 'demo-code'}`;
    navigator.clipboard.writeText(link);
    toast.success('Invite link copied!');
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9990] flex justify-end"
      >
        {/* Panel */}
        <motion.div
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-[400px] h-full bg-white shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="h-[72px] px-5 flex items-center justify-between border-b border-black/5 shrink-0 bg-white">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-inner"
                style={{ backgroundColor: getAvatarColor(community?.id || 'a') }}
              >
                {community?.name?.slice(0, 2).toUpperCase() || 'C'}
              </div>
              <div>
                <h2 className="text-[16px] font-bold text-[#1C1C1E] leading-tight">Members</h2>
                <p className="text-[12px] text-black/40 font-medium">{totalMembers} total members</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#F2F2F7] flex items-center justify-center text-black/40 hover:text-black transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Stats Row */}
          <div className="px-5 py-4 grid grid-cols-3 gap-2 border-b border-black/5 shrink-0 bg-[#FAFAFA]">
            <div className="bg-white p-3 rounded-2xl border border-black/[0.04] flex flex-col items-center justify-center text-center">
              <Users size={18} className="text-blue-500 mb-1" />
              <span className="text-[16px] font-black text-[#1C1C1E]">{totalMembers}</span>
              <span className="text-[9px] font-bold uppercase text-black/30">Total</span>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-black/[0.04] flex flex-col items-center justify-center text-center">
              <Shield size={18} className="text-purple-500 mb-1" />
              <span className="text-[16px] font-black text-[#1C1C1E]">{adminCount}</span>
              <span className="text-[9px] font-bold uppercase text-black/30">Admins</span>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-black/[0.04] flex flex-col items-center justify-center text-center">
              <div className="w-2 h-2 rounded-full bg-[#25D366] absolute top-3 right-3 animate-pulse" />
              <div className="relative">
                <Users size={18} className="text-[#25D366] mb-1" />
              </div>
              <span className="text-[16px] font-black text-[#1C1C1E]">{activeToday}</span>
              <span className="text-[9px] font-bold uppercase text-black/30">Active</span>
            </div>
          </div>

          {/* Search */}
          <div className="px-5 py-3 shrink-0">
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/30" />
              <input 
                type="text"
                placeholder="Search by 0x address..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-[#F2F2F7] rounded-xl text-[14px] font-medium outline-none focus:ring-2 focus:ring-[#25D366]/20 transition-all placeholder:text-black/30"
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center px-5 gap-4 border-b border-black/5 shrink-0">
            {[
              { id: 'ALL', label: 'All Members' },
              { id: 'ADMINS', label: 'Admins' },
              { id: 'BANNED', label: 'Banned' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-3 text-[13px] font-bold transition-colors relative ${activeTab === tab.id ? 'text-[#1C1C1E]' : 'text-black/30 hover:text-black/50'}`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div layoutId="memberTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#25D366]" />
                )}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {filteredMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center opacity-40 px-6">
                <Users size={40} className="mb-4" />
                <p className="text-[15px] font-bold">No members found</p>
                <p className="text-[13px] mt-1">Try a different search or tab</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredMembers.map(member => (
                  <MemberRow 
                    key={member.address} 
                    member={member} 
                    myRole={myRole} 
                    isMe={member.address.toLowerCase() === myAddress.toLowerCase()}
                    onAction={handleAction}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Invite Section */}
          {(myRole === 'OWNER' || myRole === 'ADMIN') && (
            <div className="p-5 border-t border-black/5 bg-[#FAFAFA] shrink-0">
              <p className="text-[11px] font-black uppercase text-black/30 mb-2">Invite Link</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white border border-black/10 rounded-xl px-3 py-2.5 flex items-center overflow-hidden">
                  <span className="text-[13px] font-mono text-black/50 truncate">
                    humanidfi.com/join/{community?.joinCode || 'demo-code'}
                  </span>
                </div>
                <button 
                  onClick={copyInvite}
                  className="w-10 h-10 rounded-xl bg-[#25D366] text-white flex items-center justify-center hover:bg-[#128C7E] transition-colors shrink-0 shadow-sm"
                >
                  <Link size={16} />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </>
  );
}
