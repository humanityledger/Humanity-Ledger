'use client';
import DOMPurify from 'dompurify';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, Users, Settings, Bell, X,
  MessageSquare, Hash, Link as LinkIcon, Edit, Shield,
  Globe, Lock, Image as ImageIcon, Search,
  Eye, EyeOff, Pin, Heart, Plus, AlertTriangle, Trash2
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
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingPost, setEditingPost] = useState<any>(null);
  const [community, setCommunity] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [localLikes, setLocalLikes] = useState<Record<string, number>>({});
  const [loadingPosts, setLoadingPosts] = useState(true);

  const fetchCommunity = async () => {
    try {
      // Try fetching by ID directly first
      const res = await fetch(`/api/chat/communities/${communityId}`, {
        headers: { 'x-web3-address': myAddress, 'x-verified-session-address': myAddress }
      });
      if (res.ok) {
        const d = await res.json();
        if (d.community) { setCommunity(d.community); return; }
      }
    } catch {}
    // Fallback: list communities and find by id
    try {
      const res = await fetch('/api/chat/communities', {
        headers: { 'x-web3-address': myAddress, 'x-verified-session-address': myAddress }
      });
      if (res.ok) {
        const d = await res.json();
        const found = d.communities?.find((c: any) => c.id === communityId);
        if (found) setCommunity(found);
      }
    } catch {}
  };

  const fetchPosts = async () => {
    try {
      const res = await fetch(`/api/chat/communities/${communityId}/posts`, {
        headers: { 'x-web3-address': myAddress }
      });
      if (res.ok) {
        const d = await res.json();
        // Posts tab shows items WITH a title or rich HTML content (not raw chat messages)
        const richPosts = (d.posts || []).filter((p: any) => p.title || (p.contentHtml && p.contentHtml.includes('<')));
        // If no rich posts, show all posts
        setPosts(richPosts.length > 0 ? richPosts : (d.posts || []));
      }
    } catch {}
    setLoadingPosts(false);
  };

  useEffect(() => {
    if (!communityId) return;
    fetchCommunity();
    fetchPosts();
    const interval = setInterval(fetchPosts, 10000);
    return () => clearInterval(interval);
  }, [communityId]);

  const AVATAR_COLORS = ['#25D366','#34C759','#FF9500','#FF3B30','#AF52DE','#FF2D55'];
  const avatarColor = communityId ? AVATAR_COLORS[(communityId.charCodeAt(0) || 0) % AVATAR_COLORS.length] : '#000';

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F2F2F7] relative">
      {/* ── HEADER ── */}
      <div className="h-[64px] px-4 border-b border-black/[0.08] flex items-center justify-between bg-white/95 backdrop-blur-md shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-xl hover:bg-black/5 text-black/40 transition-colors md:hidden">
            <ChevronLeft size={22} />
          </button>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-sm" style={{ background: avatarColor }}>
            {community?.name?.slice(0, 2).toUpperCase() || 'C'}
          </div>
          <div>
            <p className="text-[15px] font-bold text-[#1C1C1E] leading-tight flex items-center gap-1.5">
              {community?.name || 'Loading...'}
              {community?.isPrivate ? <Lock size={11} className="text-black/30" /> : <Globe size={11} className="text-black/30" />}
            </p>
            <p className="text-[11px] font-medium text-black/40">
              {community?.membersCount || community?.members?.length || 1} members
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {(['posts', 'chat', 'settings'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all ${activeTab === tab ? 'bg-[#1C1C1E] text-white shadow-sm' : 'text-black/40 hover:bg-black/5'}`}
            >
              {tab === 'settings' ? <Settings size={15} /> : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTENT BODY ── */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        {/* POSTS TAB */}
        {activeTab === 'posts' && (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto p-4 md:p-6 pb-28">
              {loadingPosts ? (
                <div className="flex items-center justify-center py-16 opacity-40">
                  <div className="w-8 h-8 border-3 border-[#25D366] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                  <Hash size={44} className="mb-3 text-[#25D366]" />
                  <p className="text-[16px] font-bold">No posts yet</p>
                  <p className="text-[13px] mt-1">Tap the compose button to write the first post</p>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {posts.map(post => (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-3xl shadow-sm border border-black/[0.05] overflow-hidden"
                    >
                      {post.title && (
                        <div className="px-6 pt-5 pb-1">
                          <h2 className="text-[19px] font-black leading-tight text-[#1C1C1E]">{post.title}</h2>
                        </div>
                      )}
                      <div
                        className="prose prose-sm max-w-none px-6 py-4 text-[#1C1C1E]/80 text-[14px] leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: typeof window !== 'undefined' ? DOMPurify.sanitize(post.contentHtml || post.content || '') : (post.content || '') }}
                      />
                      <div className="bg-[#FAFAFA] px-6 py-3 border-t border-black/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#25D366]/15 flex items-center justify-center text-[9px] font-black text-[#25D366]">
                            {(post.authorAddress || '0x').slice(2, 4).toUpperCase()}
                          </div>
                          <span className="text-[12px] font-medium text-black/50">
                            {post.authorAddress?.slice(0, 6)}...{post.authorAddress?.slice(-4)}
                          </span>
                          <span className="text-black/20">·</span>
                          <span className="text-[11px] text-black/40">
                            {new Date(post.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <button
                          onClick={() => setLocalLikes(prev => ({ ...prev, [post.id]: (prev[post.id] ?? (post.likes || 0)) + 1 }))}
                          className={`flex items-center gap-1.5 transition-colors ${localLikes[post.id] !== undefined ? 'text-red-500' : 'text-black/30 hover:text-red-500'}`}
                        >
                          <Heart size={14} fill={localLikes[post.id] !== undefined ? 'currentColor' : 'none'} />
                          <span className="text-[12px] font-bold">{localLikes[post.id] ?? (post.likes || 0)}</span>
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* FAB to compose */}
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => { setEditingPost(null); setShowEditor(true); }}
              className="fixed bottom-6 right-6 w-14 h-14 bg-[#1C1C1E] text-white rounded-full flex items-center justify-center shadow-2xl shadow-black/30 z-20 hover:bg-black"
            >
              <Edit size={22} />
            </motion.button>
          </div>
        )}

        {/* CHAT TAB */}
        {activeTab === 'chat' && (
          <div className="flex flex-1 overflow-hidden">
            {/* Channel sidebar */}
            {community?.channels && community.channels.length > 0 && (
              <div className="w-[180px] shrink-0 bg-white border-r border-black/5 flex flex-col py-3 overflow-y-auto">
                <p className="text-[10px] font-black uppercase tracking-widest text-black/30 px-4 mb-2">Channels</p>
                {community.channels.map((ch: any) => (
                  <button
                    key={ch.id}
                    onClick={() => setActiveChannelId(ch.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 text-left transition-all ${activeChannelId === ch.id ? 'bg-[#25D366]/10 text-[#25D366]' : 'text-black/50 hover:bg-black/5 hover:text-black/70'}`}
                  >
                    {ch.isPaid ? <Lock size={13} /> : <Hash size={13} />}
                    <span className="text-[13px] font-medium truncate">{ch.name}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex-1 overflow-hidden">
              <CommunityChatView
                communityId={communityId}
                channelId={activeChannelId}
                myAddress={myAddress}
                communityName={community?.name}
              />
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="flex-1 overflow-y-auto">
            <CommunitySettingsPanel
              community={community}
              myAddress={myAddress}
              onChannelSelect={(id) => { setActiveChannelId(id); setActiveTab('chat'); }}
              onCommunityUpdate={() => fetchCommunity()}
            />
          </div>
        )}
      </div>

      <RichPostEditorModal
        open={showEditor}
        onClose={() => setShowEditor(false)}
        myAddress={myAddress}
        communityName={community?.name}
        communityId={communityId}
        onPublished={(newPost) => {
          if (newPost && newPost.id) {
            setPosts(prev => [newPost, ...prev]);
          } else {
            // Refresh posts list
            fetchPosts();
          }
        }}
      />
    </div>
  );
}

// ─── SETTINGS PANEL (Telegram Style - Ultimate Edition) ────────────────────────

function CommunitySettingsPanel({ community, myAddress, onChannelSelect, onCommunityUpdate }: { community: any; myAddress: string; onChannelSelect?: (id: string) => void; onCommunityUpdate?: () => void }) {
  // Merge initial permissions from API or default
  const defaultPerms = community?.permissions || {
    sendMessages: true, sendMedia: true, sendStickers: true, sendPolls: true,
    embedLinks: true, addUsers: false, pinMessages: false, changeInfo: false,
    slowModeSeconds: 0, antiSpam: false
  };

  const [permissions, setPermissions] = useState(defaultPerms);
  const [channels, setChannels] = useState<any[]>(community?.channels || []);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [isPrivate, setIsPrivate] = useState<boolean>(community?.isPrivate ?? false);

  const [showChannelsModal, setShowChannelsModal] = useState(false);
  
  // Real sync to DB
  const savePermissions = async (newPerms: any) => { const { id, communityId, createdAt, updatedAt, ...cleanPerms } = newPerms; setPermissions(newPerms); try { const res = await fetch('/api/chat/communities', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-web3-address': myAddress, 'x-verified-session-address': myAddress }, body: JSON.stringify({ communityId: community?.id, action: 'UPDATE_PERMISSIONS', permissions: cleanPerms }) }); if (!res.ok) throw new Error('Failed'); toast.success('Permissions updated'); } catch (e) { toast.error('Failed to update permissions'); } };

  const ChannelManagement = () => {
    const [isCreating, setIsCreating] = useState(false);
    const [newChannel, setNewChannel] = useState({ name: '', isPaid: false, price: '', currency: 'USDC' });

    const createChannel = async () => {
      if (!newChannel.name) return toast.error('Name is required');
      try {
        const res = await fetch('/api/chat/communities', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-web3-address': myAddress, 'x-verified-session-address': myAddress },
          body: JSON.stringify({
            communityId: community?.id,
            action: 'CREATE_CHANNEL',
            name: newChannel.name,
            isPaid: newChannel.isPaid,
            price: newChannel.price,
            currency: newChannel.currency
          }),
        });
        if (res.ok) {
          const { channel } = await res.json();
          setChannels([...channels, channel]);
          setIsCreating(false);
          setNewChannel({ name: '', isPaid: false, price: '', currency: 'USDC' });
          toast.success('Channel created');
        } else {
          toast.error('Error creating channel');
        }
      } catch (e) { toast.error('Error creating channel'); }
    };

    const deleteChannel = async (id: string) => {
      if (!confirm('Delete this channel?')) return;
      try {
        await fetch('/api/chat/communities', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-web3-address': myAddress, 'x-verified-session-address': myAddress },
          body: JSON.stringify({ communityId: community?.id, action: 'DELETE_CHANNEL', channelId: id }),
        });
        setChannels(channels.filter(c => c.id !== id));
        toast.success('Channel deleted');
      } catch (e) {}
    };

    const paidChannels = channels.filter(c => c.isPaid);
    const freeChannels = channels.filter(c => !c.isPaid);

    return (
      <div className="fixed inset-0 z-[9999] bg-[#FAFAFA] flex flex-col">
        <div className="flex items-center gap-4 px-6 py-4 border-b border-black/5 bg-white">
          <button onClick={() => setShowChannelsModal(false)} className="p-2 bg-[#F2F2F7] rounded-full text-[#25D366]">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-[20px] font-bold">Channels & Monetization</h2>
        </div>
        
        <div className="p-6 overflow-y-auto max-w-2xl mx-auto w-full flex-1">
          {isCreating ? (
            <div className="bg-white rounded-[24px] border border-black/5 p-6 shadow-sm mb-6">
              <h3 className="text-[17px] font-bold mb-4 flex items-center gap-2">Create Channel</h3>
              <input 
                type="text" placeholder="Channel name (e.g. general)"
                className="w-full p-3 bg-[#F2F2F7] rounded-xl outline-none mb-4"
                value={newChannel.name} onChange={e => setNewChannel({...newChannel, name: e.target.value.toLowerCase().replace(/\\s+/g, '-')})}
              />
              <label className="flex items-center gap-2 mb-4 cursor-pointer">
                <input type="checkbox" checked={newChannel.isPaid} onChange={e => setNewChannel({...newChannel, isPaid: e.target.checked})} />
                <span className="font-bold">Paid Channel</span>
              </label>
              {newChannel.isPaid && (
                <div className="flex gap-2 mb-4">
                  <input type="number" placeholder="Price" className="w-1/2 p-3 bg-[#F2F2F7] rounded-xl outline-none" value={newChannel.price} onChange={e => setNewChannel({...newChannel, price: e.target.value})} />
                  <select className="w-1/2 p-3 bg-[#F2F2F7] rounded-xl outline-none" value={newChannel.currency} onChange={e => setNewChannel({...newChannel, currency: e.target.value})}>
                    <option value="USDC">USDC</option>
                    <option value="ETH">ETH</option>
                  </select>
                </div>
              )}
              <div className="flex gap-2 mt-4">
                <button onClick={() => setIsCreating(false)} className="flex-1 py-3 bg-black/5 rounded-xl font-bold">Cancel</button>
                <button onClick={createChannel} className="flex-1 py-3 bg-[#25D366] text-white rounded-xl font-bold">Create</button>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-[24px] border border-black/5 p-6 mb-6 shadow-sm">
                <h3 className="text-[17px] font-bold mb-4 flex items-center gap-2"><Lock size={18} className="text-[#25D366]"/> Paid Entry Channels</h3>
                <p className="text-[14px] text-black/50 mb-6">Create exclusive zones. Users must pay crypto directly to your wallet to unlock them.</p>
                
                <div className="space-y-4">
                  {paidChannels.map((c: any) => (
                      <div key={c.id} onClick={() => { onChannelSelect?.(c.id); setShowChannelsModal(false); }} className="flex items-center justify-between p-4 bg-[#F2F2F7] rounded-[16px] cursor-pointer hover:bg-[#e5e5ea] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#25D366]/10 text-[#25D366] flex items-center justify-center"><Lock size={18} /></div>
                        <div>
                          <p className="font-bold text-[15px]"># {c.name}</p>
                          <p className="text-[12px] text-black/40">Price: {c.price} {c.currency}</p>
                        </div>
                      </div>
                      <button onClick={() => deleteChannel(c.id)} className="p-2 text-red-500 bg-red-100 rounded-full hover:bg-red-200"><Trash2 size={16}/></button>
                    </div>
                  ))}
                  {paidChannels.length === 0 && <p className="text-[13px] text-black/40 text-center py-4">No paid channels yet</p>}
                </div>
                
                <button onClick={() => { setIsCreating(true); setNewChannel({...newChannel, isPaid: true}); }} className="w-full mt-6 py-4 bg-[#25D366]/10 text-[#25D366] font-bold rounded-[16px] flex items-center justify-center gap-2 hover:bg-[#25D366]/20 transition-colors">
                  <Plus size={18} /> Create Paid Channel
                </button>
              </div>

              <div className="bg-white rounded-[24px] border border-black/5 p-6 shadow-sm">
                <h3 className="text-[17px] font-bold mb-4 flex items-center gap-2"><Globe size={18} className="text-[#25D366]"/> Public Channels</h3>
                <div className="space-y-4">
                  {freeChannels.map((c: any) => (
                      <div key={c.id} onClick={() => { onChannelSelect?.(c.id); setShowChannelsModal(false); }} className="flex items-center justify-between p-4 bg-[#F2F2F7] rounded-[16px] cursor-pointer hover:bg-[#e5e5ea] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-black/5 text-black flex items-center justify-center"><Hash size={18} /></div>
                        <div>
                          <p className="font-bold text-[15px]"># {c.name}</p>
                          <p className="text-[12px] text-black/40">Free</p>
                        </div>
                      </div>
                      <button onClick={() => deleteChannel(c.id)} className="p-2 text-red-500 bg-red-100 rounded-full hover:bg-red-200"><Trash2 size={16}/></button>
                    </div>
                  ))}
                  {freeChannels.length === 0 && <p className="text-[13px] text-black/40 text-center py-4">No public channels</p>}
                </div>
                <button onClick={() => { setIsCreating(true); setNewChannel({...newChannel, isPaid: false}); }} className="w-full mt-6 py-4 bg-black/5 text-black font-bold rounded-[16px] flex items-center justify-center gap-2 hover:bg-black/10 transition-colors">
                  <Plus size={18} /> Create Free Channel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const togglePrivacy = async (newVal: boolean) => {
    setSavingPrivacy(true);
    try {
      const res = await fetch('/api/chat/communities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-web3-address': myAddress, 'x-verified-session-address': myAddress },
        body: JSON.stringify({ communityId: community?.id, action: 'UPDATE_PRIVACY', isPrivate: newVal }),
      });
      if (res.ok) {
        setIsPrivate(newVal);
      }
    } catch (e) {}
    setSavingPrivacy(false);
  };

  const Toggle = ({ label, desc, checked, onChange, danger = false }: any) => (
    <div className="flex items-center justify-between py-3 cursor-pointer group" onClick={() => onChange(!checked)}>
      <div className="pr-4">
        <p className={`text-[15px] font-bold ${danger ? 'text-red-500' : 'text-[#1C1C1E]'}`}>{label}</p>
        {desc && <p className="text-[13px] text-black/50 leading-snug mt-0.5">{desc}</p>}
      </div>
      <div className={`relative w-[48px] h-[28px] rounded-full transition-colors duration-300 shrink-0 shadow-inner ${checked ? (danger ? 'bg-red-500' : 'bg-[#25D366]') : 'bg-black/10'}`}>
        <div className={`absolute top-[2px] left-[2px] w-[24px] h-[24px] bg-white rounded-full shadow-[0_2px_5px_rgba(0,0,0,0.2)] transition-transform duration-300 ${checked ? 'translate-x-[20px]' : 'translate-x-0'}`} />
      </div>
    </div>
  );

  const SubMenuAction = ({ icon: Icon, label, value, color = 'text-[#25D366]', onClick }: any) => (
    <div onClick={onClick} className="w-full">
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
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-#25D366/10 to-transparent rounded-bl-[100px] pointer-events-none" />
        <div className="w-[88px] h-[88px] rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-4xl font-black shadow-[0_8px_16px_rgba(79,70,229,0.25)] shrink-0">
          {(community?.name || 'C').slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0 z-10">
          <h2 className="text-[24px] font-black text-[#1C1C1E] tracking-tight truncate">{community?.name}</h2>
          <p className="text-[14px] text-black/50 mt-1 line-clamp-2">{community?.description || 'No description provided for this community.'}</p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-[12px] font-bold text-[#25D366] bg-[#25D366]/10 px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Users size={14}/> {community?.members?.length || 1} Members</span>
            <button
              onClick={() => togglePrivacy(!isPrivate)}
              disabled={savingPrivacy}
              className={`text-[12px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all border ${isPrivate ? 'bg-red-50 text-red-500 border-red-100 hover:bg-red-100' : 'bg-green-50 text-green-600 border-green-100 hover:bg-green-100'} disabled:opacity-50`}
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
          <p className="text-[12px] font-black uppercase tracking-[0.15em] text-[#25D366]">Invitation Link</p>
          <button 
            onClick={async () => {
              if (!confirm('Are you sure you want to revoke this link? The old link will stop working instantly.')) return;
              try {
                const res = await fetch('/api/chat/communities', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json', 'x-web3-address': myAddress, 'x-verified-session-address': myAddress },
                  body: JSON.stringify({ communityId: community?.id, action: 'REVOKE_LINK' })
                });
                if (res.ok) window.location.reload();
              } catch (e) {}
            }}
            className="text-[11px] font-bold text-red-500 hover:text-red-600 transition-colors uppercase tracking-wider"
          >
            Revoke Link
          </button>
        </div>
        <div className="p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#25D366]/10 flex items-center justify-center text-[#25D366] shrink-0">
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
            onClick={() => { if (community?.joinCode) navigator.clipboard.writeText(`https://humanidfi.com/join/${community.joinCode}`); toast.success('Copied!'); }}
            className="px-5 py-2.5 bg-[#1C1C1E] text-white text-[13px] font-bold rounded-xl hover:bg-black/80 transition-transform active:scale-95 shrink-0 shadow-lg shadow-black/10"
          >
            Copy Link
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Management */}
        <div className="bg-white rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-black/[0.04] overflow-hidden">
          <div className="px-6 py-4 border-b border-black/[0.04] bg-[#FAFAFA]/50">
            <p className="text-[12px] font-black uppercase tracking-[0.15em] text-[#25D366]">Management</p>
          </div>
          <div className="px-6 py-2">
            <SubMenuAction icon={Hash} label="Channels & Monetization" value={channels.length.toString()} color="text-[#25D366]" onClick={() => setShowChannelsModal(true)} />
            <SubMenuAction icon={Shield} label="Administrators" value="1" color="text-indigo-500" />
            <SubMenuAction icon={Users} label="Members" value={community?.members?.length?.toString() || "1"} color="text-black" />
          </div>
        </div>

        {/* Global Permissions */}
        <div className="bg-white rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-black/[0.04] overflow-hidden">
          <div className="px-6 py-4 border-b border-black/[0.04] bg-[#FAFAFA]/50">
            <p className="text-[12px] font-black uppercase tracking-[0.15em] text-[#25D366]">Global Permissions</p>
          </div>
          <div className="px-6 py-2 flex flex-col divide-y divide-black/5">
            <Toggle label="Send Messages" checked={permissions.sendMessages} onChange={(v: boolean) => savePermissions({...permissions, sendMessages: v})} />
            <Toggle label="Send Media" desc="Photos, videos, files" checked={permissions.sendMedia} onChange={(v: boolean) => savePermissions({...permissions, sendMedia: v})} />
            <Toggle label="Embed Links" checked={permissions.embedLinks} onChange={(v: boolean) => savePermissions({...permissions, embedLinks: v})} />
          </div>
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
              <span className="text-[14px] font-bold text-[#25D366]">
                {permissions.slowModeSeconds === 0 ? 'Off' : permissions.slowModeSeconds < 60 ? `${permissions.slowModeSeconds}s` : permissions.slowModeSeconds === 60 ? '1m' : permissions.slowModeSeconds === 300 ? '5m' : permissions.slowModeSeconds === 900 ? '15m' : '1h'}
              </span>
            </div>
            <input 
              type="range" 
              min="0" max="6" step="1" 
              value={[0, 10, 30, 60, 300, 900, 3600].indexOf(permissions.slowModeSeconds)}
              onChange={(e) => savePermissions({...permissions, slowModeSeconds: [0, 10, 30, 60, 300, 900, 3600][parseInt(e.target.value)]})}
              className="w-full accent-[#25D366] h-1.5 bg-black/10 rounded-lg appearance-none cursor-pointer" 
            />
            <div className="flex justify-between text-[10px] font-bold text-black/30 mt-2 px-1">
              <span>OFF</span><span>10s</span><span>30s</span><span>1m</span><span>5m</span><span>15m</span><span>1h</span>
            </div>
          </div>
          
          <Toggle 
            label="Aggressive Anti-Spam" 
            desc="Automated AI filtering for explicit content and scams" 
            checked={permissions.antiSpam} 
            onChange={(v: boolean) => savePermissions({...permissions, antiSpam: v})} 
          />
          <Toggle 
            label="Require Join Approval" 
            desc="Admins must approve new members" 
            checked={permissions.requireApproval || false} 
            onChange={(v: boolean) => savePermissions({...permissions, requireApproval: v})} 
          />
          <Toggle 
            label="Member Posts Need Approval" 
            desc="Admins review posts before publishing" 
            checked={permissions.postApproval || false} 
            onChange={(v: boolean) => savePermissions({...permissions, postApproval: v})} 
          />
          <Toggle 
            label="New Member Alerts" 
            desc="Get notified when someone joins" 
            checked={permissions.notifyNewMember !== false} 
            onChange={(v: boolean) => savePermissions({...permissions, notifyNewMember: v})} 
          />
        </div>
      </div>

      {/* DANGER ZONE */}
      <div className="bg-white rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-red-500/20 overflow-hidden mt-6">
        <div className="px-6 py-4 border-b border-red-500/10 bg-red-50/50">
          <p className="text-[12px] font-black uppercase tracking-[0.15em] text-red-500">Danger Zone</p>
        </div>
        <div className="p-6">
          <p className="text-[13px] text-black/60 mb-4">Deleting this community is permanent. All channels, messages, and member data will be irrevocably destroyed.</p>
          <button
            onClick={async () => {
              if (!confirm('Are you absolutely sure you want to delete this community? This action cannot be undone.')) return;
              try {
                const res = await fetch(`/api/chat/communities/${community?.id}`, {
                  method: 'DELETE',
                  headers: { 'x-web3-address': myAddress, 'x-verified-session-address': myAddress }
                });
                if (res.ok) {
                  window.location.reload();
                } else {
                  alert('Only the owner can delete this community.');
                }
              } catch (e) {
                alert('Network error');
              }
            }}
            className="w-full py-3 bg-red-500 text-white font-bold rounded-[16px] hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
          >
            Delete Community
          </button>
        </div>
      </div>

      {showChannelsModal && <ChannelManagement />}
    </div>
  );
}







