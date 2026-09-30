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

// ─── SETTINGS PANEL (Telegram Style) ─────────────────────────────────────────

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

  const Toggle = ({ label, desc, checked, onChange }: any) => (
    <div className="flex items-center justify-between py-3 cursor-pointer" onClick={() => onChange(!checked)}>
      <div className="pr-4">
        <p className="text-[15px] font-bold text-[#1C1C1E]">{label}</p>
        {desc && <p className="text-[13px] text-black/50 leading-snug mt-0.5">{desc}</p>}
      </div>
      <div className={`relative w-[50px] h-[30px] rounded-full transition-colors duration-200 shrink-0 ${checked ? 'bg-[#34C759]' : 'bg-[#E5E5EA]'}`}>
        <div className={`absolute top-[2px] left-[2px] w-[26px] h-[26px] bg-white rounded-full shadow-sm transition-transform duration-200 ${checked ? 'translate-x-[20px]' : 'translate-x-0'}`} />
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6 pb-20">
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-black/5 flex items-center gap-5">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-black shadow-inner">
          {community?.name?.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h2 className="text-[22px] font-bold text-[#1C1C1E]">{community?.name}</h2>
          <p className="text-[14px] text-black/50">{community?.description || 'No description provided.'}</p>
          <div className="flex items-center gap-4 mt-3">
            <span className="text-[12px] font-bold text-[#007AFF] bg-[#007AFF]/10 px-2.5 py-1 rounded-md flex items-center gap-1.5"><Users size={12}/> {community?.members} Members</span>
            <span className="text-[12px] font-bold text-black/50 bg-black/5 px-2.5 py-1 rounded-md">{community?.isPrivate ? 'Private Group' : 'Public Group'}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden">
        <div className="px-5 py-3 border-b border-black/5 bg-[#FAFAFA]">
          <p className="text-[11px] font-black uppercase tracking-widest text-black/40">Invite Link</p>
        </div>
        <div className="p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#007AFF]/10 flex items-center justify-center text-[#007AFF] shrink-0">
            <LinkIcon size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-mono text-[#1C1C1E] truncate">{community?.joinLink || 'https://humanidfi.com/join/...'}</p>
          </div>
          <button className="px-4 py-2 bg-black text-white text-[13px] font-bold rounded-xl hover:bg-black/80 transition-colors shrink-0">Copy</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden">
        <div className="px-5 py-3 border-b border-black/5 bg-[#FAFAFA]">
          <p className="text-[11px] font-black uppercase tracking-widest text-black/40">Member Permissions</p>
        </div>
        <div className="p-5 flex flex-col divide-y divide-black/5">
          <Toggle label="Send Messages" checked={permissions.sendMessages} onChange={(v: boolean) => setPermissions(p => ({...p, sendMessages: v}))} />
          <Toggle label="Send Media" desc="Photos, videos, files" checked={permissions.sendMedia} onChange={(v: boolean) => setPermissions(p => ({...p, sendMedia: v}))} />
          <Toggle label="Send Stickers & GIFs" checked={permissions.sendStickers} onChange={(v: boolean) => setPermissions(p => ({...p, sendStickers: v}))} />
          <Toggle label="Embed Links" checked={permissions.embedLinks} onChange={(v: boolean) => setPermissions(p => ({...p, embedLinks: v}))} />
          <Toggle label="Add Users" checked={permissions.addUsers} onChange={(v: boolean) => setPermissions(p => ({...p, addUsers: v}))} />
          <Toggle label="Pin Messages" checked={permissions.pinMessages} onChange={(v: boolean) => setPermissions(p => ({...p, pinMessages: v}))} />
          <Toggle label="Change Group Info" checked={permissions.changeInfo} onChange={(v: boolean) => setPermissions(p => ({...p, changeInfo: v}))} />
        </div>
      </div>
      
      <div className="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden">
        <div className="px-5 py-3 border-b border-black/5 bg-[#FAFAFA]">
          <p className="text-[11px] font-black uppercase tracking-widest text-black/40">Administrators</p>
        </div>
        <div className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center"><Shield size={18} className="text-black/40"/></div>
            <div>
              <p className="text-[15px] font-bold">Manage Admins</p>
              <p className="text-[13px] text-black/50">1 Administrator</p>
            </div>
          </div>
          <ChevronLeft size={20} className="text-black/20 rotate-180" />
        </div>
      </div>
    </div>
  );
}
