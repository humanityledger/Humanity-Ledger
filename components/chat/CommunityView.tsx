'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Lock, Globe, Settings, Hash, Edit, Heart, Users,
  Pin, Search, X, Bell, BellOff, Share2, MoreVertical, RefreshCw,
  MessageSquare, FileText, BarChart2
} from 'lucide-react';
import { toast } from 'sonner';
import DOMPurify from 'dompurify';

import { CommunityChatView } from './CommunityChatView';
import { RichPostEditorModal } from './RichPostEditor';
import { CommunitySettingsPanel } from './CommunitySettingsPanel';
import { CommunityMemberPanel } from './CommunityMemberPanel';
import { PinnedMessagesPanel, MessageSearchPanel } from './CommunityMessageReactions';

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface CommunityViewProps {
  communityId: string;
  myAddress: string;
  onBack?: () => void;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#25D366','#34C759','#FF9500','#FF3B30','#AF52DE','#FF2D55','#5856D6'];
const getAvatarColor = (id: string) => AVATAR_COLORS[(id?.charCodeAt(0) || 0) % AVATAR_COLORS.length];

function safeHtml(raw: string): string {
  if (typeof window === 'undefined' || !raw) return raw || '';
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: ['b','i','u','s','em','strong','a','p','br','ul','ol','li','blockquote','code','pre','h1','h2','h3','img','mark','span'],
    ALLOWED_ATTR: ['href','src','alt','class','style'],
  });
}

function truncateAddr(addr: string): string {
  if (!addr) return '...';
  return `${addr.slice(0,6)}...${addr.slice(-4)}`;
}

// ─── POST CARD COMPONENT ─────────────────────────────────────────────────────

interface PostCardProps {
  post: any;
  myAddress: string;
  onEdit?: (post: any) => void;
  onLike?: (postId: string) => void;
  localLikes: Record<string, number>;
}

function PostCard({ post, myAddress, onEdit, onLike, localLikes }: PostCardProps) {
  const isOwn = post.authorAddress?.toLowerCase() === myAddress?.toLowerCase();
  const likeCount = localLikes[post.id] ?? (post.likes || 0);
  const liked = localLikes[post.id] !== undefined;

  const previewText = (post.contentHtml || post.content || '')
    .replace(/<[^>]+>/g, '')
    .trim()
    .slice(0, 240);

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl shadow-sm border border-black/[0.05] overflow-hidden group"
    >
      {/* Header */}
      <div className="px-6 pt-5 pb-3">
        {post.title && (
          <h2 className="text-[20px] font-black leading-snug text-[#1C1C1E] mb-3">{post.title}</h2>
        )}
        <div
          className="prose prose-sm max-w-none text-[14px] leading-relaxed text-[#1C1C1E]/80 line-clamp-6"
          dangerouslySetInnerHTML={{ __html: safeHtml(post.contentHtml || post.content || '') }}
        />
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-[#FAFAFA] border-t border-black/[0.04] flex items-center gap-3">
        {/* Author avatar */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-black shrink-0"
          style={{ backgroundColor: getAvatarColor(post.authorAddress || '0x') }}
        >
          {(post.authorAddress || '0x??').slice(2,4).toUpperCase()}
        </div>
        <span className="text-[12px] font-mono font-bold text-black/40 truncate">{truncateAddr(post.authorAddress)}</span>
        <span className="text-black/20 text-[10px]">·</span>
        <span className="text-[11px] text-black/30">
          {new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {isOwn && onEdit && (
            <button
              onClick={() => onEdit(post)}
              className="p-1.5 rounded-lg bg-black/5 hover:bg-black/10 text-black/30 hover:text-black transition-colors opacity-0 group-hover:opacity-100"
            >
              <Edit size={14} />
            </button>
          )}
          <button
            onClick={() => onLike?.(post.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-all active:scale-90 ${
              liked ? 'bg-red-50 text-red-500' : 'text-black/30 hover:text-red-400 hover:bg-red-50'
            }`}
          >
            <Heart size={14} fill={liked ? 'currentColor' : 'none'} />
            <span className="text-[12px] font-bold">{likeCount}</span>
          </button>
        </div>
      </div>
    </motion.article>
  );
}

// ─── MAIN COMMUNITY VIEW ─────────────────────────────────────────────────────

export function CommunityView({ communityId, myAddress, onBack }: CommunityViewProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<'posts' | 'chat' | 'settings'>('posts');
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);

  // Community data
  const [community, setCommunity] = useState<any>(null);
  const [loadingCommunity, setLoadingCommunity] = useState(true);

  // Posts state
  const [posts, setPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [localLikes, setLocalLikes] = useState<Record<string, number>>({});

  // Panels
  const [showEditor, setShowEditor] = useState(false);
  const [editingPost, setEditingPost] = useState<any>(null);
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [showPinnedPanel, setShowPinnedPanel] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [muted, setMuted] = useState(false);

  // Post refresh interval
  const refreshRef = useRef<ReturnType<typeof setInterval>>();

  // ── Fetch Community ─────────────────────────────────────────────────────────
  const fetchCommunity = useCallback(async () => {
    if (!communityId) return;
    try {
      // Try direct community endpoint first
      const res = await fetch(`/api/chat/communities/${communityId}`, {
        headers: { 'x-web3-address': myAddress, 'x-verified-session-address': myAddress },
      });
      if (res.ok) {
        const d = await res.json();
        if (d.community) { setCommunity(d.community); setLoadingCommunity(false); return; }
      }
    } catch {}

    // Fallback: list all communities and find by id
    try {
      const res = await fetch('/api/chat/communities', {
        headers: { 'x-web3-address': myAddress, 'x-verified-session-address': myAddress },
      });
      if (res.ok) {
        const d = await res.json();
        const found = (d.communities || []).find((c: any) => c.id === communityId);
        if (found) setCommunity(found);
      }
    } catch {}
    setLoadingCommunity(false);
  }, [communityId, myAddress]);

  // ── Fetch Posts ─────────────────────────────────────────────────────────────
  const fetchPosts = useCallback(async () => {
    if (!communityId) return;
    try {
      const res = await fetch(`/api/chat/communities/${communityId}/posts`, {
        headers: { 'x-web3-address': myAddress, 'x-verified-session-address': myAddress },
      });
      if (res.ok) {
        const d = await res.json();
        const allPosts: any[] = d.posts || [];
        // Posts tab = items that have a title or are rich HTML (not raw chat messages)
        const richPosts = allPosts.filter(p => p.title || (p.contentHtml && p.contentHtml.includes('<')));
        setPosts(richPosts.length > 0 ? richPosts : allPosts);
      }
    } catch {}
    setLoadingPosts(false);
  }, [communityId, myAddress]);

  useEffect(() => {
    fetchCommunity();
    fetchPosts();
    refreshRef.current = setInterval(fetchPosts, 12000);
    return () => clearInterval(refreshRef.current);
  }, [fetchCommunity, fetchPosts]);

  // ── Like handler ────────────────────────────────────────────────────────────
  const handleLike = (postId: string) => {
    setLocalLikes(prev => {
      if (prev[postId] !== undefined) return prev; // already liked
      return { ...prev, [postId]: (posts.find(p => p.id === postId)?.likes || 0) + 1 };
    });
    // Optimistic — no API yet for likes
  };

  // ── Jump to message ─────────────────────────────────────────────────────────
  const jumpToMessage = (msgId: string) => {
    setActiveTab('chat');
    setTimeout(() => {
      const el = document.getElementById(`msg-${msgId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('bg-[#25D366]/10');
        setTimeout(() => el.classList.remove('bg-[#25D366]/10'), 2500);
      }
    }, 400);
  };

  const avatarColor = community?.id ? getAvatarColor(community.id) : '#25D366';
  const isAdmin = community?.ownerAddress?.toLowerCase() === myAddress?.toLowerCase()
    || community?.members?.some((m: any) => m.walletAddress?.toLowerCase() === myAddress?.toLowerCase() && (m.role === 'ADMIN' || m.role === 'MODERATOR'));

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F2F2F7] overflow-hidden">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="h-[64px] px-3 md:px-5 border-b border-black/[0.07] flex items-center justify-between bg-white/95 backdrop-blur-md shrink-0 z-10 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
        {/* Left: back + identity */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="p-2 rounded-xl hover:bg-black/5 text-black/40 transition-colors md:hidden"
          >
            <ChevronLeft size={22} />
          </button>

          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0"
            style={{ backgroundColor: avatarColor }}
          >
            {community?.name?.slice(0,2).toUpperCase() || 'C'}
          </div>

          <div className="min-w-0">
            {loadingCommunity ? (
              <div className="h-4 w-28 bg-black/8 rounded-lg animate-pulse mb-1" />
            ) : (
              <p className="text-[15px] font-bold text-[#1C1C1E] leading-tight flex items-center gap-1.5 truncate max-w-[180px]">
                {community?.name || 'Community'}
                {community?.isPrivate
                  ? <Lock size={11} className="text-black/25 shrink-0" />
                  : <Globe size={11} className="text-black/25 shrink-0" />
                }
              </p>
            )}
            <p className="text-[11px] text-black/35 font-medium">
              {community?.membersCount || community?.members?.length || 1} members
            </p>
          </div>
        </div>

        {/* Right: tabs + actions */}
        <div className="flex items-center gap-1">
          {/* Tab pills */}
          <div className="hidden sm:flex items-center gap-0.5 bg-[#F2F2F7] rounded-xl p-0.5 mr-1">
            {(['posts','chat','settings'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all ${
                  activeTab === tab
                    ? 'bg-white text-[#1C1C1E] shadow-sm'
                    : 'text-black/40 hover:text-black/60'
                }`}
              >
                {tab === 'posts' ? 'Posts' : tab === 'chat' ? 'Chat' : <Settings size={13} />}
              </button>
            ))}
          </div>

          {/* Action icons */}
          <button
            onClick={() => setShowSearchPanel(true)}
            className="p-2 rounded-xl hover:bg-black/5 text-black/30 hover:text-black transition-colors"
            title="Search messages"
          >
            <Search size={17} />
          </button>

          <button
            onClick={() => setShowPinnedPanel(true)}
            className="p-2 rounded-xl hover:bg-black/5 text-black/30 hover:text-black transition-colors"
            title="Pinned messages"
          >
            <Pin size={17} />
          </button>

          <button
            onClick={() => setShowMembersPanel(true)}
            className="p-2 rounded-xl hover:bg-black/5 text-black/30 hover:text-black transition-colors"
            title="Members"
          >
            <Users size={17} />
          </button>

          {/* More menu */}
          <div className="relative">
            <button
              onClick={() => setShowMoreMenu(p => !p)}
              className="p-2 rounded-xl hover:bg-black/5 text-black/30 hover:text-black transition-colors"
            >
              <MoreVertical size={17} />
            </button>
            <AnimatePresence>
              {showMoreMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="absolute right-0 top-full mt-1 w-48 bg-white rounded-2xl shadow-2xl border border-black/5 py-1.5 z-50"
                  >
                    {[
                      { icon: muted ? Bell : BellOff, label: muted ? 'Unmute' : 'Mute', fn: () => { setMuted(m=>!m); toast.success(muted ? 'Unmuted' : 'Muted'); setShowMoreMenu(false); } },
                      { icon: Share2, label: 'Share Invite', fn: () => { navigator.clipboard.writeText(`https://humanidfi.com/join/${community?.joinCode}`); toast.success('Invite link copied!'); setShowMoreMenu(false); } },
                      { icon: RefreshCw, label: 'Refresh', fn: () => { fetchPosts(); fetchCommunity(); setShowMoreMenu(false); toast.success('Refreshed'); } },
                    ].map(({ icon: Icon, label, fn }) => (
                      <button key={label} onClick={fn} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#F2F2F7] transition-colors text-left">
                        <Icon size={15} className="text-black/40" />
                        <span className="text-[13px] font-medium text-[#1C1C1E]">{label}</span>
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── MOBILE TAB BAR ─────────────────────────────────────────────────── */}
      <div className="sm:hidden flex items-center border-b border-black/5 bg-white shrink-0">
        {([
          { id: 'posts', icon: FileText, label: 'Posts' },
          { id: 'chat', icon: MessageSquare, label: 'Chat' },
          { id: 'settings', icon: Settings, label: 'Settings' },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors ${
              activeTab === tab.id ? 'text-[#25D366]' : 'text-black/30'
            }`}
          >
            <tab.icon size={18} />
            <span className="text-[10px] font-bold">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── MAIN CONTENT ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col">

        {/* POSTS TAB */}
        <AnimatePresence mode="wait">
          {activeTab === 'posts' && (
            <motion.div
              key="posts"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 overflow-y-auto"
            >
              <div className="max-w-3xl mx-auto px-4 py-5 pb-28">
                {loadingPosts ? (
                  // Skeleton loaders
                  <div className="space-y-5">
                    {[1,2,3].map(i => (
                      <div key={i} className="bg-white rounded-3xl p-6 border border-black/5 animate-pulse">
                        <div className="h-5 bg-black/5 rounded-xl w-3/4 mb-3" />
                        <div className="h-3 bg-black/5 rounded-xl w-full mb-2" />
                        <div className="h-3 bg-black/5 rounded-xl w-5/6 mb-2" />
                        <div className="h-3 bg-black/5 rounded-xl w-2/3" />
                      </div>
                    ))}
                  </div>
                ) : posts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-20 h-20 rounded-3xl bg-[#25D366]/10 flex items-center justify-center mb-5">
                      <FileText size={36} className="text-[#25D366]" />
                    </div>
                    <h3 className="text-[20px] font-black text-[#1C1C1E] mb-2">No posts yet</h3>
                    <p className="text-[14px] text-black/40 max-w-xs">
                      Be the first to write a post in this community.
                    </p>
                    <button
                      onClick={() => { setEditingPost(null); setShowEditor(true); }}
                      className="mt-6 px-6 py-3 bg-[#1C1C1E] text-white font-bold rounded-2xl hover:bg-black transition-colors"
                    >
                      Write the first post
                    </button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {posts.map(post => (
                      <PostCard
                        key={post.id}
                        post={post}
                        myAddress={myAddress}
                        onEdit={p => { setEditingPost(p); setShowEditor(true); }}
                        onLike={handleLike}
                        localLikes={localLikes}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* FAB */}
              <motion.button
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => { setEditingPost(null); setShowEditor(true); }}
                className="fixed bottom-6 right-6 w-14 h-14 bg-[#1C1C1E] text-white rounded-full flex items-center justify-center shadow-2xl shadow-black/30 z-20 hover:bg-black"
              >
                <Edit size={22} />
              </motion.button>
            </motion.div>
          )}

          {/* CHAT TAB */}
          {activeTab === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 overflow-hidden min-h-0"
            >
              {/* Channel sidebar — only show if community has multiple channels */}
              {community?.channels && community.channels.length > 1 && (
                <div className="w-[180px] md:w-[200px] shrink-0 bg-white border-r border-black/5 flex flex-col py-3 overflow-y-auto">
                  <p className="text-[10px] font-black uppercase tracking-widest text-black/25 px-4 mb-2">Channels</p>
                  {community.channels.map((ch: any) => (
                    <button
                      key={ch.id}
                      onClick={() => setActiveChannelId(ch.id)}
                      className={`flex items-center gap-2.5 px-4 py-2.5 text-left transition-all group ${
                        activeChannelId === ch.id
                          ? 'bg-[#25D366]/10 text-[#25D366]'
                          : 'text-black/40 hover:bg-black/[0.03] hover:text-black/70'
                      }`}
                    >
                      {ch.isPaid ? <Lock size={13} className="shrink-0" /> : <Hash size={13} className="shrink-0" />}
                      <span className="text-[13px] font-semibold truncate">{ch.name}</span>
                      {ch.isPaid && (
                        <span className="ml-auto text-[9px] font-black bg-purple-100 text-purple-500 px-1.5 py-0.5 rounded-md uppercase">Paid</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex-1 overflow-hidden min-h-0">
                <CommunityChatView
                  communityId={communityId}
                  channelId={activeChannelId}
                  myAddress={myAddress}
                  communityName={community?.name}
                />
              </div>
            </motion.div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 overflow-y-auto"
            >
              {community ? (
                <CommunitySettingsPanel
                  community={community}
                  myAddress={myAddress}
                  onChannelSelect={id => { setActiveChannelId(id); setActiveTab('chat'); }}
                  onCommunityUpdate={fetchCommunity}
                />
              ) : (
                <div className="flex items-center justify-center h-40">
                  <div className="w-8 h-8 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── RICH POST EDITOR MODAL ───────────────────────────────────────── */}
      <RichPostEditorModal
        open={showEditor}
        onClose={() => { setShowEditor(false); setEditingPost(null); }}
        myAddress={myAddress}
        communityName={community?.name}
        communityId={communityId}
        initialPost={editingPost}
        onPublished={newPost => {
          if (newPost?.id) {
            setPosts(prev => [newPost, ...prev.filter(p => p.id !== newPost.id)]);
          } else {
            fetchPosts();
          }
        }}
      />

      {/* ── MEMBER PANEL ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showMembersPanel && community && (
          <CommunityMemberPanel
            community={community}
            myAddress={myAddress}
            onClose={() => setShowMembersPanel(false)}
          />
        )}
      </AnimatePresence>

      {/* ── PINNED MESSAGES PANEL ────────────────────────────────────────── */}
      <AnimatePresence>
        {showPinnedPanel && (
          <PinnedMessagesPanel
            communityId={communityId}
            myAddress={myAddress}
            isAdmin={isAdmin}
            onClose={() => setShowPinnedPanel(false)}
            onJumpTo={jumpToMessage}
          />
        )}
      </AnimatePresence>

      {/* ── MESSAGE SEARCH PANEL ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showSearchPanel && (
          <MessageSearchPanel
            communityId={communityId}
            myAddress={myAddress}
            onClose={() => setShowSearchPanel(false)}
            onSelect={msg => {
              setShowSearchPanel(false);
              jumpToMessage(msg.id);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
