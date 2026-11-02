'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Lock, Globe, Settings, Hash, Edit, Heart, Users,
  Pin, Search, X, Bell, BellOff, Share2, MoreVertical, RefreshCw,
  MessageSquare, FileText, BarChart2, Vote, Video, PhoneCall, Shield,
  LayoutGrid, Activity
} from 'lucide-react';
import { toast } from 'sonner';
import DOMPurify from 'dompurify';
import { sanitizeRichText } from '@/lib/security/sanitizeRichText';

import { CommunityChatView } from './CommunityChatView';
import { RichPostEditorModal } from './RichPostEditor';
import { CommunitySettingsPanel } from './CommunitySettingsPanel';
import { CommunityMemberPanel } from './CommunityMemberPanel';
import { PinnedMessagesPanel, MessageSearchPanel } from './CommunityMessageReactions';
import CommunityAnalytics from './CommunityAnalytics';
import { CommunityGovernanceView } from './CommunityGovernanceModal';
import { ZkCommunityTreasury } from '@/components/zk/ZkCommunityTreasury';
import { GroupPartyCall } from './GroupPartyCall';
import { CommunityApps } from './community-apps/CommunityApps';

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface CommunityViewProps {
  communityId: string;
  myAddress: string;
  onBack?: () => void;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#15171c','#3A3A3C','#636366','#FF9500','#FF3B30','#AF52DE','#FF2D55','#5856D6'];
const getAvatarColor = (id: string) => AVATAR_COLORS[(id?.charCodeAt(0) || 0) % AVATAR_COLORS.length];

// Shared sanitizer: no class/style, no remote images, safe links.
// See lib/security/sanitizeRichText.ts.
function safeHtml(raw: string): string {
  return sanitizeRichText(raw);
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
          <h2 className="text-[20px] font-semibold leading-snug text-[#15171c] mb-3">{post.title}</h2>
        )}
        <div
          className="prose prose-sm max-w-none text-[14px] leading-relaxed text-[#15171c]/80 line-clamp-6 whitespace-pre-wrap break-words"
          dangerouslySetInnerHTML={{ __html: safeHtml(post.contentHtml || post.content || '') }}
        />
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-[#f7f8fa] border-t border-black/[0.04] flex items-center gap-3">
        {/* Author avatar */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[12px] font-semibold shrink-0"
          style={{ backgroundColor: getAvatarColor(post.authorAddress || '0x') }}
        >
          {(post.authorAddress || '0x??').slice(2,4).toUpperCase()}
        </div>
        <span className="text-[12px] tabular-nums font-semibold text-black/40 truncate">{truncateAddr(post.authorAddress)}</span>
        <span className="text-black/20 text-[12px]">·</span>
        <span className="text-[12.5px] text-black/30">
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
              liked ? 'bg-red-50 text-[#d93036]' : 'text-black/30 hover:text-red-400 hover:bg-red-50'
            }`}
          >
            <Heart size={14} fill={liked ? 'currentColor' : 'none'} />
            <span className="text-[12px] font-semibold">{likeCount}</span>
          </button>
        </div>
      </div>
    </motion.article>
  );
}

// ─── MAIN COMMUNITY VIEW ─────────────────────────────────────────────────────

export function CommunityView({ communityId, myAddress, onBack }: CommunityViewProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<'posts' | 'chat' | 'apps' | 'treasury' | 'governance' | 'analytics' | 'settings'>('posts');
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
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [muted, setMuted] = useState(false);

  // Party Call state
  const [partyCallActive, setPartyCallActive] = useState(false);
  const [partyCallRoomId, setPartyCallRoomId] = useState<string | null>(null);
  const [partyCallParticipants, setPartyCallParticipants] = useState<string[]>([]);
  const [partyCallMode, setPartyCallMode] = useState<'voice' | 'video'>('voice');

  // Post refresh interval
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Inline Quick Post Composer state
  const [inlineTitle, setInlineTitle] = useState('');
  const [inlineBody, setInlineBody] = useState('');
  const [isPostingInline, setIsPostingInline] = useState(false);
  const [showInlineForm, setShowInlineForm] = useState(false);

  // ── Fetch Posts ─────────────────────────────────────────────────────────────
  const fetchPosts = useCallback(async () => {
    if (!communityId) return;
    try {
      const res = await fetch(`/api/chat/communities/${communityId}/posts?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'x-web3-address': myAddress, 'x-verified-session-address': myAddress },
      });
      if (res.ok) {
        const d = await res.json();
        const incoming: any[] = d.posts || [];
        setPosts(prev => {
          const incomingIds = new Set(incoming.map((p: any) => p.id));
          // Keep recently added local posts (under 2 minutes old) that haven't arrived from server yet
          const recentLocal = prev.filter(p => !incomingIds.has(p.id) && (Date.now() - new Date(p.createdAt || Date.now()).getTime() < 120000));
          const all = [...recentLocal, ...incoming];
          return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        });
      }
    } catch {}
    setLoadingPosts(false);
  }, [communityId, myAddress]);

  // ── Handle Inline Quick Post ───────────────────────────────────────────────
  const handlePublishInline = async () => {
    if (!inlineBody.trim()) {
      toast.error('Write something to publish');
      return;
    }
    setIsPostingInline(true);
    const postTitle = inlineTitle.trim() || 'Community Post';
    const postBody = inlineBody.trim();

    // Optimistic post insertion
    const optPost = {
      id: `opt-${Date.now()}`,
      communityId,
      authorAddress: myAddress.toLowerCase(),
      title: postTitle,
      content: postBody,
      contentHtml: postBody,
      likes: 0,
      createdAt: new Date().toISOString(),
    };
    setPosts(prev => [optPost, ...prev]);
    setInlineTitle('');
    setInlineBody('');
    setShowInlineForm(false);

    try {
      const res = await fetch(`/api/chat/communities/${communityId}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-web3-address': myAddress.toLowerCase(),
          'x-verified-session-address': myAddress.toLowerCase(),
        },
        body: JSON.stringify({
          communityId,
          authorAddress: myAddress.toLowerCase(),
          title: postTitle,
          content: postBody,
          contentHtml: postBody,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        toast.success('Published successfully!');
        if (d.post) {
          setPosts(prev => [d.post, ...prev.filter(p => p.id !== optPost.id)]);
        }
      } else {
        toast.error('Failed to publish');
        setPosts(prev => prev.filter(p => p.id !== optPost.id));
      }
    } catch {
      toast.error('Connection error');
      setPosts(prev => prev.filter(p => p.id !== optPost.id));
    } finally {
      setIsPostingInline(false);
      fetchPosts();
    }
  };



  useEffect(() => {
    fetchCommunity();
    fetchPosts();
    // Posts change rarely; only refresh while the tab is visible.
    refreshRef.current = setInterval(() => { if (document.visibilityState === 'visible') fetchPosts(); }, 6000);
    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
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
        el.classList.add('bg-black/5');
        setTimeout(() => el.classList.remove('bg-black/5'), 2500);
      }
    }, 400);
  };

  const avatarColor = '#15171c';
  const isAdmin = community?.ownerAddress?.toLowerCase() === myAddress?.toLowerCase()
    || community?.members?.some((m: any) => m.walletAddress?.toLowerCase() === myAddress?.toLowerCase() && (m.role === 'ADMIN' || m.role === 'MODERATOR'));

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f2f4f7] overflow-hidden min-h-0">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="h-[64px] px-3 md:px-5 border-b border-black/[0.07] flex items-center justify-between bg-white shrink-0 sticky top-0 z-30 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
        {/* Left: back + identity (tapping name/avatar opens info panel) */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="p-2 rounded-xl hover:bg-black/5 text-black/40 transition-colors md:hidden"
          >
            <ChevronLeft size={22} />
          </button>

          <button
            type="button"
            onClick={() => setShowInfoPanel(true)}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
            title="View group info"
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-semibold text-sm shadow-sm shrink-0"
              style={{ backgroundColor: avatarColor }}
            >
              {community?.name?.slice(0,2).toUpperCase() || 'C'}
            </div>

            <div className="min-w-0 text-left">
              {loadingCommunity ? (
                <div className="h-4 w-28 bg-black/8 rounded-lg animate-pulse mb-1" />
              ) : (
                <p className="text-[15px] font-semibold text-[#15171c] leading-tight flex items-center gap-1.5 truncate max-w-[180px]">
                  {community?.name || 'Community'}
                  {community?.isPrivate
                    ? <Lock size={11} className="text-black/25 shrink-0" />
                    : <Globe size={11} className="text-black/25 shrink-0" />
                  }
                </p>
              )}
              <p className="text-[12.5px] text-black/35 font-medium">
                {community?.membersCount || community?.members?.length || 1} members
              </p>
            </div>
          </button>
        </div>

        {/* Right: 3 primary tab pills + ··· menu */}
        <div className="flex items-center gap-1">
          {/* Primary 3 tabs — visible on desktop */}
          <div className="hidden sm:flex items-center gap-0.5 bg-[#f2f4f7] rounded-xl p-0.5 mr-1">
            {(['posts','chat','apps'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                  activeTab === tab
                    ? 'bg-white text-[#15171c] shadow-sm'
                    : 'text-black/40 hover:text-black/60'
                }`}
              >
                {tab === 'posts' ? 'Posts' : tab === 'chat' ? 'Chat' : 'Apps'}
              </button>
            ))}
          </div>

          {/* ··· context menu */}
          <div className="relative">
            <button
              onClick={() => setShowMoreMenu(p => !p)}
              className="p-2 rounded-xl hover:bg-black/5 text-black/30 hover:text-black transition-colors"
              title="More options"
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
                    className="absolute right-0 top-full mt-1 w-56 bg-white rounded-2xl shadow-2xl border border-black/5 py-1.5 z-50"
                  >
                    {/* Basic actions */}
                    {[
                      { label: 'View members', fn: () => { setShowMembersPanel(true); setShowMoreMenu(false); } },
                      { label: 'Search messages', fn: () => { setShowSearchPanel(true); setShowMoreMenu(false); } },
                      { label: 'Pinned messages', fn: () => { setShowPinnedPanel(true); setShowMoreMenu(false); } },
                      { label: 'Party call', fn: () => { const roomId = `party-${communityId}-${Date.now()}`; setPartyCallRoomId(roomId); setPartyCallMode('voice'); setPartyCallActive(true); setPartyCallParticipants([myAddress]); setShowMoreMenu(false); toast.success('Party call started'); } },
                    ].map(({ label, fn }) => (
                      <button key={label} onClick={fn} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#f2f4f7] transition-colors text-left">
                        <span className="text-[13px] font-medium text-[#15171c]">{label}</span>
                      </button>
                    ))}

                    {/* Separator */}
                    <div className="my-1 border-t border-black/[0.05]" />

                    {/* Advanced sections */}
                    {[
                      { label: 'Group Treasury', tab: 'treasury' as const },
                      { label: 'Governance & Votes', tab: 'governance' as const },
                      { label: 'Analytics & Activity', tab: 'analytics' as const },
                    ].map(({ label, tab }) => (
                      <button key={tab} onClick={() => { setActiveTab(tab); setShowMoreMenu(false); }} className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#f2f4f7] transition-colors text-left ${activeTab === tab ? 'bg-[#f2f4f7] font-semibold' : ''}`}>
                        <span className="text-[13px] font-medium text-[#15171c]">{label}</span>
                      </button>
                    ))}

                    {/* Separator */}
                    <div className="my-1 border-t border-black/[0.05]" />

                    {/* Settings & utilities */}
                    {[
                      { label: 'Group Settings', fn: () => { setActiveTab('settings'); setShowMoreMenu(false); } },
                      { label: muted ? 'Unmute' : 'Mute notifications', fn: () => { setMuted(m=>!m); toast.success(muted ? 'Unmuted' : 'Muted'); setShowMoreMenu(false); } },
                      { label: 'Copy invite link', fn: () => { navigator.clipboard.writeText(`https://humanidfi.com/join/${community?.joinCode}`); toast.success('Invite link copied!'); setShowMoreMenu(false); } },
                      { label: 'Refresh', fn: () => { fetchPosts(); fetchCommunity(); setShowMoreMenu(false); toast.success('Refreshed'); } },
                    ].map(({ label, fn }) => (
                      <button key={label} onClick={fn} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#f2f4f7] transition-colors text-left">
                        <span className="text-[13px] font-medium text-[#15171c]">{label}</span>
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── MOBILE TAB BAR (3 primary tabs only — Pure Typography) ───────────── */}
      <div className="relative sm:hidden flex items-center border-b border-black/5 bg-white shrink-0">
        {(['posts', 'chat', 'apps'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 flex flex-col items-center justify-center py-3 px-2 transition-colors ${
              activeTab === tab ? 'text-[#15171c] font-semibold' : 'text-black/35 font-medium'
            }`}
          >
            <span className="text-[13px] capitalize">{tab}</span>
            {activeTab === tab && (
              <span className="absolute bottom-0 w-8 h-[2px] bg-[#15171c] rounded-full" />
            )}
          </button>
        ))}
        {/* Advanced tab indicator strip — shown when on treasury/gov/analytics/settings */}
        {['treasury','governance','analytics','settings'].includes(activeTab) && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-black/10 rounded-full" />
        )}
      </div>

      {/* ── MAIN CONTENT ───────────────────────────────────────────────────── */}
      <div className="flex-1 w-full overflow-hidden flex flex-col min-h-0">

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
                {/* ── QUICK POST CREATOR CARD ── */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-black/[0.06] mb-5">
                  {!showInlineForm ? (
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 shadow-sm"
                        style={{ backgroundColor: myAddress ? getAvatarColor(myAddress) : '#15171c' }}
                      >
                        {(myAddress || '0x??').slice(2, 4).toUpperCase()}
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowInlineForm(true)}
                        className="flex-1 bg-[#f2f4f7] hover:bg-[#e9edef] text-left px-4 py-2.5 rounded-full text-[14px] text-[#727a88] transition-all border border-black/[0.04]"
                      >
                        Share an update with the community...
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowInlineForm(true)}
                        className="px-4 py-2 bg-[#15171c] hover:bg-black text-white rounded-full text-[13px] font-semibold shadow-sm transition-all active:scale-95 flex items-center gap-1.5 shrink-0"
                      >
                        <Edit size={14} />
                        <span className="hidden sm:inline">Post</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-black/[0.05] pb-2">
                        <span className="text-[13px] font-semibold text-[#15171c]">New Post</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => { setShowInlineForm(false); setShowEditor(true); }}
                            className="text-[12.5px] font-semibold text-[#15171c] hover:underline"
                          >
                            Full editor →
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowInlineForm(false)}
                            className="text-black/30 hover:text-black"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        placeholder="Post title (optional)..."
                        value={inlineTitle}
                        onChange={e => setInlineTitle(e.target.value)}
                        className="w-full bg-[#f2f4f7] rounded-xl px-3.5 py-2 text-[14px] font-semibold text-[#15171c] outline-none placeholder:text-[#727a88]"
                      />
                      <textarea
                        rows={3}
                        placeholder="Write your announcement or thoughts here..."
                        value={inlineBody}
                        onChange={e => setInlineBody(e.target.value)}
                        className="w-full bg-[#f2f4f7] rounded-xl px-3.5 py-2.5 text-[14px] text-[#15171c] outline-none resize-none placeholder:text-[#727a88]"
                      />
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowInlineForm(false)}
                          className="px-4 py-2 rounded-xl text-[13px] font-medium text-black/40 hover:bg-black/5"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isPostingInline || !inlineBody.trim()}
                          onClick={handlePublishInline}
                          className="px-5 py-2 bg-[#15171c] hover:bg-black disabled:opacity-50 text-white rounded-xl text-[13px] font-semibold shadow-sm transition-all active:scale-95 flex items-center gap-1.5"
                        >
                          {isPostingInline ? 'Posting…' : 'Publish Now'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

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
                    <div className="w-20 h-20 rounded-3xl bg-black/5 flex items-center justify-center mb-5">
                      <FileText size={36} className="text-[#15171c]" />
                    </div>
                    <h3 className="text-[20px] font-semibold text-[#15171c] mb-2">No posts yet</h3>
                    <p className="text-[14px] text-black/40 max-w-xs">
                      Be the first to write a post in this community.
                    </p>
                    <button
                      onClick={() => { setEditingPost(null); setShowEditor(true); }}
                      className="mt-6 px-6 py-3 bg-[#15171c] text-white font-semibold rounded-2xl hover:bg-black transition-colors"
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
                className="fixed bottom-6 right-6 w-14 h-14 bg-[#15171c] text-white rounded-full flex items-center justify-center shadow-2xl shadow-black/30 z-20 hover:bg-black"
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
              className="flex flex-1 w-full overflow-hidden min-h-0"
            >
              {/* Channel sidebar — only show if community has multiple channels */}
              {community?.channels && community.channels.length > 1 && (
                <div className="hidden md:flex w-[200px] shrink-0 bg-white border-r border-black/5 flex-col py-3 overflow-y-auto">
                  <p className="text-[12px] font-semibold text-black/25 px-4 mb-2">Channels</p>
                  {community.channels.map((ch: any) => (
                    <button
                      key={ch.id}
                      onClick={() => setActiveChannelId(ch.id)}
                      className={`flex items-center gap-2.5 px-4 py-2.5 text-left transition-all group ${
                        activeChannelId === ch.id
                          ? 'bg-black/5 text-[#15171c]'
                          : 'text-black/40 hover:bg-black/[0.03] hover:text-black/70'
                      }`}
                    >
                      {ch.isPaid ? <Lock size={13} className="shrink-0" /> : <Hash size={13} className="shrink-0" />}
                      <span className="text-[13px] font-semibold truncate">{ch.name}</span>
                      {ch.isPaid && (
                        <span className="ml-auto text-[12px] font-semibold bg-purple-100 text-purple-500 px-1.5 py-0.5 rounded-md">Paid</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex-1 w-full overflow-hidden min-h-0 flex flex-col">
                <CommunityChatView
                  communityId={communityId}
                  channelId={activeChannelId}
                  myAddress={myAddress}
                  communityName={community?.name}
                />
              </div>
            </motion.div>
          )}

          {/* APPS TAB */}
          {activeTab === 'apps' && (
            <motion.div
              key="apps"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 w-full overflow-hidden flex min-h-0"
            >
              <CommunityApps
                communityId={communityId}
                communityName={community?.name || 'this community'}
              />
            </motion.div>
          )}

          {/* TREASURY TAB */}
          {activeTab === 'treasury' && (
            <motion.div
              key="treasury"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 overflow-y-auto"
            >
              <div className="max-w-3xl mx-auto px-4 py-5 pb-28">
                <ZkCommunityTreasury
                  communityId={communityId}
                  communityName={community?.name || 'Community'}
                  isAdmin={isAdmin}
                  currentUserAddress={myAddress}
                />
              </div>
            </motion.div>
          )}

          {/* GOVERNANCE TAB */}
          {activeTab === 'governance' && (
            <motion.div
              key="governance"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 overflow-y-auto"
            >
              <CommunityGovernanceView
                communityId={communityId}
                communityName={community?.name || 'Community'}
                myAddress={myAddress}
              />
            </motion.div>
          )}

          {/* ANALYTICS TAB */}
          {activeTab === 'analytics' && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 overflow-y-auto"
            >
              <CommunityAnalytics communityId={communityId} community={community} />
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
                  <div className="w-6 h-6 border-2 border-[#1C7AFF]/30 border-t-[#1C7AFF] rounded-full animate-spin" />
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
        onPublished={newPost => {
          // Immediately show the new post at the top of the list
          if (newPost?.id) {
            setPosts(prev => [newPost, ...prev.filter(p => p.id !== newPost.id)]);
          }
          // Switch to posts tab immediately so user sees their post
          setActiveTab('posts');
          // Refresh from server in background to confirm persistence
          setTimeout(() => fetchPosts(), 1200);
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

      {/* ── NATIVE GROUP PARTY CALL ────────────────────────────────────────── */}
      <AnimatePresence>
        {partyCallActive && (
          <GroupPartyCall
            groupId={communityId}
            groupName={community?.name || 'Community'}
            myAddress={myAddress}
            onClose={() => {
              setPartyCallActive(false);
              setPartyCallRoomId(null);
              setPartyCallParticipants([]);
            }}
            isActive={partyCallActive}
          />
        )}
      </AnimatePresence>

      {/* ── GROUP INFO PANEL (tap avatar/name) ──────────────────────────────── */}
      <AnimatePresence>
        {showInfoPanel && community && (
          <>
            <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={() => setShowInfoPanel(false)} />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 36 }}
              className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-[#f2f4f7] flex flex-col shadow-2xl"
            >
              {/* Header */}
              <div className="h-[64px] px-4 border-b border-black/[0.07] flex items-center gap-3 bg-white shrink-0">
                <button onClick={() => setShowInfoPanel(false)} className="p-2 rounded-xl hover:bg-black/5 text-black/40 transition-colors">
                  <ChevronLeft size={22} />
                </button>
                <span className="text-[17px] font-semibold text-[#15171c]">Group Info</span>
              </div>

              <div className="flex-1 overflow-y-auto">
                {/* Avatar + Name block */}
                <div className="bg-white px-6 pt-8 pb-6 flex flex-col items-center gap-3 border-b border-black/[0.05]">
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-sm"
                    style={{ backgroundColor: avatarColor }}
                  >
                    {community.name?.slice(0,2).toUpperCase() || 'C'}
                  </div>
                  <div className="text-center">
                    <h2 className="text-[20px] font-semibold text-[#15171c] leading-tight">{community.name}</h2>
                    <p className="text-[13px] text-black/40 mt-0.5">
                      {community.membersCount || community.members?.length || 1} members · {community.isPrivate ? 'Private' : 'Public'}
                    </p>
                  </div>
                  {community.description && (
                    <p className="text-[14px] text-[#727a88] text-center leading-relaxed max-w-[260px]">{community.description}</p>
                  )}

                  {/* Quick actions (Pure Typography) */}
                  <div className="flex items-center gap-2 mt-2">
                    {[
                      { label: 'Message', fn: () => { setActiveTab('chat'); setShowInfoPanel(false); } },
                      { label: 'Call', fn: () => { const roomId = `party-${communityId}-${Date.now()}`; setPartyCallRoomId(roomId); setPartyCallMode('voice'); setPartyCallActive(true); setPartyCallParticipants([myAddress]); setShowInfoPanel(false); } },
                      { label: muted ? 'Unmute' : 'Mute', fn: () => { setMuted(m=>!m); toast.success(muted ? 'Unmuted' : 'Muted'); } },
                      { label: 'Search', fn: () => { setShowInfoPanel(false); setShowSearchPanel(true); } },
                    ].map(({ label, fn }) => (
                      <button
                        key={label}
                        onClick={fn}
                        className="px-3.5 py-2 bg-[#f2f4f7] rounded-xl text-[13px] font-semibold text-[#15171c] hover:bg-[#e9edef] transition-colors"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Info rows (Pure Typography) */}
                <div className="px-4 py-3 space-y-1">
                  {[
                    { label: 'Members', value: `${community.membersCount || community.members?.length || 1}`, fn: () => { setShowInfoPanel(false); setShowMembersPanel(true); } },
                    { label: 'Pinned messages', value: '', fn: () => { setShowInfoPanel(false); setShowPinnedPanel(true); } },
                    { label: 'Group Settings', value: '', fn: () => { setActiveTab('settings'); setShowInfoPanel(false); } },
                    { label: 'Copy invite link', value: '', fn: () => { navigator.clipboard.writeText(`https://humanidfi.com/join/${community.joinCode}`); toast.success('Invite link copied!'); } },
                  ].map(({ label, value, fn }) => (
                    <button key={label} onClick={fn} className="w-full flex items-center justify-between px-4 py-3.5 bg-white rounded-2xl hover:bg-[#f7f8fa] transition-colors text-left">
                      <span className="flex-1 text-[15px] font-medium text-[#15171c]">{label}</span>
                      {value && <span className="text-[14px] text-[#727a88] mr-2">{value}</span>}
                      <ChevronLeft size={16} className="text-black/20 rotate-180" />
                    </button>
                  ))}
                </div>

                {/* Leave group */}
                <div className="px-4 pb-8">
                  <button
                    onClick={() => {
                      if (confirm('Leave this group? You will lose access to future messages.')) {
                        toast.success('You left the group');
                        setShowInfoPanel(false);
                        onBack?.();
                      }
                    }}
                    className="w-full py-3.5 bg-white rounded-2xl text-[#d93036] font-semibold text-[15px] hover:bg-red-50 transition-colors"
                  >
                    Leave Group
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
