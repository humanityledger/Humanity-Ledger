'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, Users, Settings, Bell, 
  MessageSquare, Hash, Link as LinkIcon, Edit, Shield,
  Globe, Lock, Image as ImageIcon, Search,
  Eye, EyeOff, Pin, Heart
} from 'lucide-react';
import { RichPostEditorModal } from './RichPostEditor';

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
    fetch(`/api/chat/community-posts?communityId=${communityId}`)
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
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500" />
                        <span className="text-[12px] font-medium text-black/40">{post.authorAddress.slice(0,6)}...{post.authorAddress.slice(-4)}</span>
                        <span className="text-[12px] text-black/20">•</span>
                        <span className="text-[12px] font-medium text-black/40">{new Date(post.createdAt).toLocaleDateString()}</span>
                      </div>
                      <button className="flex items-center gap-1.5 text-black/40 hover:text-red-500 transition-colors">
                        <Heart size={14} />
                        <span className="text-[12px] font-bold">{post.likes || 0}</span>
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

        {activeTab === 'chat' && (
          <div className="flex-1 flex items-center justify-center h-full text-black/40 font-bold">
            Live Chat is coming soon.
          </div>
        )}

        {activeTab === 'settings' && (
          <CommunitySettingsPanel community={community} />
        )}
      </div>

      <RichPostEditorModal 
        open={showEditor} 
        onClose={() => setShowEditor(false)} 
        myAddress={myAddress}
        communityName={community?.name}
        onPublished={() => {
          fetchPosts();
        }}
      />
    </div>
  );
}

// ─── SETTINGS PANEL (Telegram Style - Ultimate Edition) ────────────────────────

function CommunitySettingsPanel({ community }: { community: any }) {
  const [permissions, setPermissions] = useState({
    sendMessages: true,
    sendMedia: true,
    sendStickers: true,
    sendPolls: true,
    embedLinks: true,
    addUsers: false,
    pinMessages: false,
    changeInfo: false,
  });

  const [features, setFeatures] = useState({
    historyVisible: true,
    topicsEnabled: false,
    reactions: 'all', // 'all', 'some', 'none'
    slowMode: 0, // 0 = off, 10, 30, 60, 300, 900, 3600
    antiSpam: 'medium', // 'low', 'medium', 'aggressive'
    joinCaptcha: false,
  });

  const Toggle = ({ label, desc, checked, onChange, danger = false }: any) => (
    <div className="flex items-center justify-between py-3 cursor-pointer group" onClick={() => onChange(!checked)}>
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
            <span className="text-[12px] font-bold text-black/60 bg-black/5 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              {community?.isPrivate ? <Lock size={12}/> : <Globe size={12}/>}
              {community?.isPrivate ? 'Private Group' : 'Public Group'}
            </span>
          </div>
        </div>
      </div>

      {/* Invite Link */}
      <div className="bg-white rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-black/[0.04] overflow-hidden">
        <div className="px-6 py-4 border-b border-black/[0.04] bg-[#FAFAFA]/50">
          <p className="text-[12px] font-black uppercase tracking-[0.15em] text-[#007AFF]">Invitation Link</p>
        </div>
        <div className="p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#007AFF]/10 flex items-center justify-center text-[#007AFF] shrink-0">
            <LinkIcon size={20} strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-mono text-[#1C1C1E] truncate">{community?.joinLink || 'https://humanidfi.com/join/...'}</p>
            <p className="text-[12px] text-black/40 mt-0.5">Anyone with this link can join</p>
          </div>
          <button className="px-5 py-2.5 bg-[#1C1C1E] text-white text-[13px] font-bold rounded-xl hover:bg-black/80 transition-transform active:scale-95 shrink-0 shadow-lg shadow-black/10">Copy Link</button>
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
        <div className="p-6">
          <button className="w-full py-3.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-[14px] font-bold transition-colors shadow-lg shadow-red-500/20 active:scale-[0.98]">
            Delete Community
          </button>
          <p className="text-[12px] text-red-500/70 text-center mt-3">This action cannot be undone. All messages and posts will be permanently destroyed from the network.</p>
        </div>
      </div>
    </div>
  );
}
