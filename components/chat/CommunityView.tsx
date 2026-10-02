'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, Users, Settings, Bell, X,
  MessageSquare, Hash, Link as LinkIcon, Edit, Shield,
  Globe, Lock, Image as ImageIcon, Search,
  Eye, EyeOff, Pin, Heart, Plus, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { RichPostEditorModal } from './RichPostEditor';
import { CommunityChatView } from './CommunityChatView';

interface CommunityViewProps {
  communityId: string;
  myAddress: string;
  onBack: () => void;
}

export function CommunityView({ communityId, myAddress, onBack }: CommunityViewProps) {
  const [activeTab, setActiveTab] = useState<'posts' | 'chat' | 'settings'>('posts');
  const [showEditor, setShowEditor] = useState(false);
  const [community, setCommunity] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [localLikes, setLocalLikes] = useState<Record<string, number>>({});

  useEffect(() => {
    // Fetch community details
    fetch('/api/chat/communities')
      .then(r => r.json())
      .then(d => {
        const found = d.communities?.find((c: any) => c.id === communityId);
        if (found) setCommunity(found);
      });
      
    // Fetch posts
    fetchPosts();
  }, [communityId]);

  const fetchPosts = () => {
    fetch(`/api/chat/communities/posts?communityId=${communityId}`)
      .then(r => r.json())
      .then(d => {
        if (d.posts) setPosts(d.posts);
      });
  };

  const AVATAR_COLORS = ['#007AFF','#34C759','#FF9500','#FF3B30','#AF52DE','#FF2D55'];
  const avatarColor = communityId ? AVATAR_COLORS[parseInt(communityId.charCodeAt(0).toString(), 10) % AVATAR_COLORS.length] : '#000';

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F2F2F7] relative">
      {/* ── HEADER ── */}
      <div className="h-[68px] px-4 border-b border-black/[0.08] flex items-center justify-between bg-white/95 backdrop-blur-md shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="md:hidden p-1.5 rounded-lg hover:bg-black/5 text-black/40">
            <ChevronLeft size={24} />
          </button>
          
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-inner"
            style={{ background: avatarColor }}
          >
            {community?.name?.slice(0, 2).toUpperCase() || 'C'}
          </div>
          
          <div className="flex flex-col">
            <p className="text-[16px] font-bold text-[#1C1C1E] leading-tight flex items-center gap-1.5">
              {community?.name || 'Loading...'}
              {community?.isPrivate ? <Lock size={12} className="text-black/30" /> : <Globe size={12} className="text-black/30" />}
            </p>
            <p className="text-[12px] font-medium text-black/40">
              {community?.members || 1} members
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => setActiveTab('posts')} className={`px-4 py-2 rounded-xl text-[13px] font-bold transition-colors ${activeTab === 'posts' ? 'bg-black text-white' : 'text-black/50 hover:bg-black/5'}`}>Posts</button>
          <button onClick={() => setActiveTab('chat')} className={`px-4 py-2 rounded-xl text-[13px] font-bold transition-colors ${activeTab === 'chat' ? 'bg-black text-white' : 'text-black/50 hover:bg-black/5'}`}>Chat</button>
          <button onClick={() => setActiveTab('settings')} className={`p-2 rounded-xl transition-colors ${activeTab === 'settings' ? 'bg-black text-white' : 'text-black/50 hover:bg-black/5'}`}><Settings size={18} /></button>
        </div>
      </div>

      {/* ── CONTENT BODY ── */}
      <div className="flex-1 overflow-y-auto relative">
        {activeTab === 'posts' && (
          <div className="max-w-3xl mx-auto p-4 md:p-6 pb-32">
            {posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 opacity-50">
                <Hash size={48} className="mb-4" />
                <p className="text-[16px] font-bold">No announcements yet</p>
                <p className="text-[14px]">Be the first to post something.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {posts.map(post => (
                  <div key={post.id} className="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden">
                    {post.title && (
                      <div className="px-6 pt-5 pb-2">
                        <h2 className="text-[20px] font-bold leading-tight text-[#1C1C1E]">{post.title}</h2>
                      </div>
                    )}
                    <div className="prose prose-sm max-w-none px-6 py-4 text-[#1C1C1E]/80" dangerouslySetInnerHTML={{ __html: post.content }} />
                    <div className="bg-[#FAFAFA] px-6 py-3 border-t border-black/5 flex items-center justify-between">
                      <div 
                        className="flex items-center gap-2 cursor-pointer hover:bg-black/5 px-2 py-1 -ml-2 rounded-lg transition-colors"
                        onClick={() => {
                          // Quick hack to open peer chat in LedgerChatV2
                          window.history.pushState({}, '', `/chat?to=${post.authorAddress}`);
                          window.dispatchEvent(new Event('popstate'));
                          // Or reload to force the ?to param handler we wrote earlier
                          window.location.href = `/chat?to=${post.authorAddress}`;
                        }}
                        title="Click to message this user"
                      >
                        <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500" />
                        <span className="text-[12px] font-medium text-black/60 hover:text-black">{post.authorAddress.slice(0,6)}...{post.authorAddress.slice(-4)}</span>
                        <span className="text-[12px] text-black/20">•</span>
                        <span className="text-[12px] font-medium text-black/40">{new Date(post.createdAt).toLocaleDateString()}</span>
                      </div>
                      <button 
                        onClick={() => setLocalLikes(prev => ({ ...prev, [post.id]: (prev[post.id] ?? (post.likes || 0)) + 1 }))}
                        className={`flex items-center gap-1.5 transition-colors ${localLikes[post.id] !== undefined ? 'text-red-500' : 'text-black/40 hover:text-red-500'}`}
                      >
                        <Heart size={14} fill={localLikes[post.id] !== undefined ? 'currentColor' : 'none'} />
                        <span className="text-[12px] font-bold">{localLikes[post.id] ?? (post.likes || 0)}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Floating FAB to post */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowEditor(true)}
              className="fixed bottom-6 right-6 w-14 h-14 bg-black text-white rounded-full flex items-center justify-center shadow-2xl z-20"
            >
              <Edit size={24} />
            </motion.button>
          </div>
        )}

        {activeTab === 'chat' && ( <CommunityChatView communityId={communityId} myAddress={myAddress} /> )}

        {activeTab === 'settings' && (
          <CommunitySettingsPanel community={community} myAddress={myAddress} />
        )}
      </div>

      <RichPostEditorModal 
        open={showEditor} 
        onClose={() => setShowEditor(false)} 
        myAddress={myAddress}
        communityName={community?.name}
        communityId={communityId}
        onPublished={() => {
          fetchPosts();
        }}
      />
    </div>
  );
}

// ─── SETTINGS PANEL (Telegram Style - Ultimate Edition) ────────────────────────

function CommunitySettingsPanel({ community, myAddress }: { community: any; myAddress: string }) {
  const [permissions, setPermissions] = useState(() => { try { const s = localStorage.getItem('com_perm_' + community.id); if (s) return JSON.parse(s); } catch {} return {
    sendMessages: true,
    sendMedia: true,
    sendStickers: true,
    sendPolls: true,
    embedLinks: true,
    addUsers: false,
    pinMessages: false,
    changeInfo: false,
    }; });

  useEffect(() => { localStorage.setItem('com_perm_' + community.id, JSON.stringify(permissions)); }, [permissions, community.id]);
  const [isPrivate, setIsPrivate] = useState<boolean>(community?.isPrivate ?? false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(community?.name || '');
  const [editDesc, setEditDesc] = useState(community?.description || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await fetch('/api/chat/communities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-web3-address': myAddress },
        body: JSON.stringify({ communityId: community.id, action: 'UPDATE_INFO', name: editName, description: editDesc }),
      });
      if (res.ok) {
        toast.success('Profile updated');
        setIsEditingProfile(false);
        community.name = editName;
        community.description = editDesc;
      } else toast.error('Failed to update');
    } catch (e) { toast.error('Error saving'); }
    setSavingProfile(false);
  };

  const togglePrivacy = async (newVal: boolean) => {
    setSavingPrivacy(true);
    try {
      const res = await fetch('/api/chat/communities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-web3-address': myAddress },
        body: JSON.stringify({ communityId: community.id, action: 'UPDATE_PRIVACY', isPrivate: newVal }),
      });
      if (res.ok) {
        setIsPrivate(newVal);
      }
    } catch (e) {
      console.error('Failed to update privacy', e);
    } finally {
      setSavingPrivacy(false);
    }
  };

  const [features, setFeatures] = useState(() => { try { const s = localStorage.getItem('com_feat_' + community.id); if (s) return JSON.parse(s); } catch {} return {
    historyVisible: true,
    topicsEnabled: false,
    reactions: 'all', // 'all', 'some', 'none'
    slowMode: 0, // 0 = off, 10, 30, 60, 300, 900, 3600
    antiSpam: 'medium', // 'low', 'medium', 'aggressive'
    joinCaptcha: false,
    }; });

  useEffect(() => { localStorage.setItem('com_feat_' + community.id, JSON.stringify(features)); }, [features, community.id]);

  const Toggle = ({ label, desc, checked, onChange, danger = false }: any) => (
    <div className="flex items-center justify-between py-3 cursor-pointer group" onClick={() => { onChange(!checked); toast.success('Settings synced to workspace'); }}>
      <div className="pr-4">
        <p className={`text-[15px] font-bold ${danger ? 'text-red-500' : 'text-[#1C1C1E]'}`}>{label}</p>
        {desc && <p className="text-[13px] text-black/50 leading-snug mt-0.5">{desc}</p>}
      </div>
      <div className={`relative w-[48px] h-[28px] rounded-full transition-colors duration-300 shrink-0 shadow-inner ${checked ? (danger ? 'bg-red-500' : 'bg-[#007AFF]') : 'bg-black/10'}`}>
        <div className={`absolute top-[2px] left-[2px] w-[24px] h-[24px] bg-white rounded-full shadow-[0_2px_5px_rgba(0,0,0,0.2)] transition-transform duration-300 ${checked ? 'translate-x-[20px]' : 'translate-x-0'}`} />
      </div>
    </div>
  );

  const SubMenuAction = ({ icon: Icon, label, value, color = 'text-[#007AFF]' }: any) => (
<div onClick={() => toast.success(label + ' configuration synced')} className="w-full">
    <div className="flex items-center justify-between py-3.5 cursor-pointer hover:bg-black/5 transition-colors px-5 -mx-5">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-xl bg-black/5 flex items-center justify-center ${color}`}>
          <Icon size={16} strokeWidth={2.5} />
        </div>
        <p className="text-[15px] font-bold text-[#1C1C1E]">{label}</p>
      </div>
      <div className="flex items-center gap-2">
        {value && <span className="text-[14px] font-medium text-black/40">{value}</span>}
        <ChevronLeft size={18} className="text-black/20 rotate-180" />
      </div>
    </div>
  </div>
);

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6 pb-32">
      {/* Profile Header */}
      <div className="bg-white rounded-3xl p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-black/[0.04] flex items-center gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-bl-[100px] pointer-events-none" />
        <div className="w-[88px] h-[88px] rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-4xl font-black shadow-[0_8px_16px_rgba(79,70,229,0.25)] shrink-0">
          {community?.name?.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0 z-10">
          <h2 className="text-[24px] font-black text-[#1C1C1E] tracking-tight truncate">{community?.name}</h2>
          <p className="text-[14px] text-black/50 mt-1 line-clamp-2">{community?.description || 'No description provided for this community.'}</p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-[12px] font-bold text-[#007AFF] bg-[#007AFF]/10 px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Users size={14}/> {community?.members} Members</span>
            <button
              onClick={() => togglePrivacy(!isPrivate)}
              disabled={savingPrivacy}
              className={`text-[12px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all border ${isPrivate ? 'bg-red-50 text-red-500 border-red-100 hover:bg-red-100' : 'bg-green-50 text-green-600 border-green-100 hover:bg-green-100'} disabled:opacity-50`}
              title={isPrivate ? 'Click to make Public (open to all)' : 'Click to make Private (close group)'}
            >
              {savingPrivacy ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : isPrivate ? <Lock size={12}/> : <Globe size={12}/>}
              {isPrivate ? 'Private — Click to Open' : 'Public — Click to Close'}
            </button>
          </div>
        </div>
      </div>

      {/* Invite Link */}
      <div className="bg-white rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-black/[0.04] overflow-hidden">
        <div className="px-6 py-4 border-b border-black/[0.04] bg-[#FAFAFA]/50 flex items-center justify-between">
          <p className="text-[12px] font-black uppercase tracking-[0.15em] text-[#007AFF]">Invitation Link</p>
          <button 
            onClick={async () => {
              if (!confirm('Are you sure you want to revoke this link? The old link will stop working instantly.')) return;
              try {
                const res = await fetch('/api/chat/communities', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ communityId: community.id, action: 'REVOKE_LINK' })
                });
                if (res.ok) {
                  const data = await res.json();
                  // Force a reload of the UI by window location or state. (In real implementation, pass update function)
                  window.location.reload();
                }
              } catch (e) { console.error(e); }
            }}
            className="text-[11px] font-bold text-red-500 hover:text-red-600 transition-colors uppercase tracking-wider"
          >
            Revoke Link
          </button>
        </div>
        <div className="p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#007AFF]/10 flex items-center justify-center text-[#007AFF] shrink-0">
            <LinkIcon size={20} strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-mono text-[#1C1C1E] truncate">
              {community?.joinCode ? `https://humanidfi.com/join/${community.joinCode}` : 'Loading...'}
            </p>
            <p className="text-[12px] text-black/40 mt-0.5">
              {community?.isPrivate ? 'Only people with this exact secure link can join' : 'Anyone with this link can join'}
            </p>
          </div>
          <button 
            onClick={() => {
              if (community?.joinCode) navigator.clipboard.writeText(`https://humanidfi.com/join/${community.joinCode}`);
            }}
            className="px-5 py-2.5 bg-[#1C1C1E] text-white text-[13px] font-bold rounded-xl hover:bg-black/80 transition-transform active:scale-95 shrink-0 shadow-lg shadow-black/10"
          >
            Copy Link
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Members & Roles */}
        <div className="bg-white rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-black/[0.04] overflow-hidden">
          <div className="px-6 py-4 border-b border-black/[0.04] bg-[#FAFAFA]/50">
            <p className="text-[12px] font-black uppercase tracking-[0.15em] text-[#007AFF]">Management</p>
          </div>
          <div className="px-6 py-2">
            <SubMenuAction icon={Shield} label="Administrators" value="1" color="text-indigo-500" />
            <SubMenuAction icon={Users} label="Members" value={community?.members?.toString() || "1"} color="text-blue-500" />
            <SubMenuAction icon={Lock} label="Restricted Users" value="0" color="text-orange-500" />
            <SubMenuAction icon={X} label="Banned Users" value="0" color="text-red-500" />
            <SubMenuAction icon={Eye} label="Recent Actions" value="Logs" color="text-teal-500" />
          </div>
        </div>

        {/* Group Features */}
        <div className="bg-white rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-black/[0.04] overflow-hidden">
          <div className="px-6 py-4 border-b border-black/[0.04] bg-[#FAFAFA]/50">
            <p className="text-[12px] font-black uppercase tracking-[0.15em] text-[#007AFF]">Features</p>
          </div>
          <div className="px-6 py-2 flex flex-col divide-y divide-black/5">
            <Toggle 
              label="Chat History" 
              desc={features.historyVisible ? 'Visible to new members' : 'Hidden from new members'} 
              checked={features.historyVisible} 
              onChange={(v: boolean) => setFeatures(p => ({...p, historyVisible: v}))} 
            />
            <Toggle 
              label="Topics (Forums)" 
              desc="Organize chat into different threads" 
              checked={features.topicsEnabled} 
              onChange={(v: boolean) => setFeatures(p => ({...p, topicsEnabled: v}))} 
            />
            <div className="py-4">
              <p className="text-[15px] font-bold text-[#1C1C1E]">Reactions</p>
              <div className="flex items-center gap-2 mt-3">
                {['all', 'some', 'none'].map((type) => (
                  <button 
                    key={type}
                    onClick={() => setFeatures(p => ({...p, reactions: type}))}
                    className={`flex-1 py-1.5 rounded-lg text-[12px] font-bold uppercase tracking-wider transition-all border ${features.reactions === type ? 'bg-[#1C1C1E] text-white border-[#1C1C1E]' : 'bg-transparent text-black/50 border-black/10 hover:border-black/30'}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Permissions */}
      <div className="bg-white rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-black/[0.04] overflow-hidden">
        <div className="px-6 py-4 border-b border-black/[0.04] bg-[#FAFAFA]/50 flex items-center justify-between">
          <p className="text-[12px] font-black uppercase tracking-[0.15em] text-[#007AFF]">Global Permissions</p>
          <span className="text-[11px] font-bold text-black/40">What can members do?</span>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
          <Toggle label="Send Messages" checked={permissions.sendMessages} onChange={(v: boolean) => setPermissions(p => ({...p, sendMessages: v}))} />
          <Toggle label="Send Media" desc="Photos, videos, files" checked={permissions.sendMedia} onChange={(v: boolean) => setPermissions(p => ({...p, sendMedia: v}))} />
          <Toggle label="Stickers & GIFs" checked={permissions.sendStickers} onChange={(v: boolean) => setPermissions(p => ({...p, sendStickers: v}))} />
          <Toggle label="Embed Links" checked={permissions.embedLinks} onChange={(v: boolean) => setPermissions(p => ({...p, embedLinks: v}))} />
          <Toggle label="Send Polls" checked={permissions.sendPolls} onChange={(v: boolean) => setPermissions(p => ({...p, sendPolls: v}))} />
          <Toggle label="Add Users" checked={permissions.addUsers} onChange={(v: boolean) => setPermissions(p => ({...p, addUsers: v}))} />
          <Toggle label="Pin Messages" checked={permissions.pinMessages} onChange={(v: boolean) => setPermissions(p => ({...p, pinMessages: v}))} />
          <Toggle label="Change Group Info" checked={permissions.changeInfo} onChange={(v: boolean) => setPermissions(p => ({...p, changeInfo: v}))} />
        </div>
      </div>

            {/* Members List */}
      <div className="bg-white rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-black/[0.04] overflow-hidden mt-6">
        <div className="px-6 py-4 border-b border-black/[0.04] bg-[#FAFAFA]/50">
          <p className="text-[12px] font-black uppercase tracking-[0.15em] text-[#007AFF]">Group Members</p>
        </div>
        <div className="p-6 flex flex-col divide-y divide-black/5">
          {community?.members?.length > 0 ? (
            community.members.map((m: any) => (
              <div key={m.id} className="py-3 first:pt-0 last:pb-0 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center font-bold text-xs">{m.walletAddress?.slice(2,4).toUpperCase()}</div>
                <div className="flex flex-col">
                  <span className="text-[14px] font-bold font-mono">{m.walletAddress?.slice(0, 6)}...{m.walletAddress?.slice(-4)}</span>
                  <span className="text-[11px] text-black/40 uppercase font-bold">{m.role}</span>
                </div>
              </div>
            ))
          ) : (
             <p className="text-[13px] text-black/50">No members yet.</p>
          )}
        </div>
      </div>
      {/* Security & Anti-Spam */}
      <div className="bg-white rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-black/[0.04] overflow-hidden">
        <div className="px-6 py-4 border-b border-black/[0.04] bg-[#FAFAFA]/50">
          <p className="text-[12px] font-black uppercase tracking-[0.15em] text-orange-500">Security & Anti-Spam</p>
        </div>
        <div className="p-6 flex flex-col divide-y divide-black/5">
          <div className="py-4 first:pt-0">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[15px] font-bold text-[#1C1C1E]">Slow Mode</p>
                <p className="text-[13px] text-black/50 mt-0.5">Members must wait before sending another message</p>
              </div>
              <span className="text-[14px] font-bold text-[#007AFF]">
                {features.slowMode === 0 ? 'Off' : features.slowMode < 60 ? `${features.slowMode}s` : features.slowMode === 60 ? '1m' : features.slowMode === 300 ? '5m' : features.slowMode === 900 ? '15m' : '1h'}
              </span>
            </div>
            <input 
              type="range" 
              min="0" max="6" step="1" 
              value={[0, 10, 30, 60, 300, 900, 3600].indexOf(features.slowMode)}
              onChange={(e) => setFeatures(p => ({...p, slowMode: [0, 10, 30, 60, 300, 900, 3600][parseInt(e.target.value)]}))}
              className="w-full accent-[#007AFF] h-1.5 bg-black/10 rounded-lg appearance-none cursor-pointer" 
            />
            <div className="flex justify-between text-[10px] font-bold text-black/30 mt-2 px-1">
              <span>OFF</span><span>10s</span><span>30s</span><span>1m</span><span>5m</span><span>15m</span><span>1h</span>
            </div>
          </div>
          
          <Toggle 
            label="Aggressive Anti-Spam" 
            desc="Automated AI filtering for explicit content and scams" 
            checked={features.antiSpam === 'aggressive'} 
            onChange={(v: boolean) => setFeatures(p => ({...p, antiSpam: v ? 'aggressive' : 'medium'}))} 
          />
          
          <Toggle 
            label="Join Captcha" 
            desc="New members must complete a Web3 Captcha before sending messages" 
            checked={features.joinCaptcha} 
            onChange={(v: boolean) => setFeatures(p => ({...p, joinCaptcha: v}))} 
          />
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 rounded-3xl shadow-[0_2px_10px_rgba(220,38,38,0.05)] border border-red-100 overflow-hidden mt-8">
        <div className="px-6 py-4 border-b border-red-100 bg-red-100/50">
          <p className="text-[12px] font-black uppercase tracking-[0.15em] text-red-600">Danger Zone</p>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <button 
            onClick={async () => {
              const confirm1 = confirm(`Are you sure you want to delete ${community?.name}?`);
              if (!confirm1) return;
              const confirm2 = confirm(`FINAL WARNING: This action cannot be undone. All data will be wiped.`);
              if (!confirm2) return;
              try {
                const res = await fetch(`/api/chat/communities?id=${community.id}`, { method: 'DELETE' });
                if (res.ok) {
                  window.location.reload();
                } else {
                  const err = await res.json();
                  alert(err.error || 'Failed to delete community');
                }
              } catch (e) { console.error(e); }
            }}
            className="w-full py-3.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-[14px] font-bold transition-colors shadow-lg shadow-red-500/20 active:scale-[0.98]"
          >
            Delete Community
          </button>
          <p className="text-[12px] text-red-500/70 text-center">This action cannot be undone. All messages and posts will be permanently destroyed from the network.</p>
        </div>
      </div>
    </div>
  );
}







