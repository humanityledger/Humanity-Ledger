'use client';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, Users, Shield, Lock, Trash2, Edit, Save, Share, Image as ImgIcon,
  MessageCircle, BarChart, Clock, Zap, UserPlus, Hash, CreditCard, ChevronRight, Check
} from 'lucide-react';
import { toast } from 'sonner';

// ─── TYPES ──────────────────────────────────────────────────────────────────
interface CommunitySettingsPanelProps {
  community: any;
  myAddress: string;
  onChannelSelect?: (id: string) => void;
  onCommunityUpdate?: () => void;
}

// ─── REUSABLE TOGGLE ────────────────────────────────────────────────────────
function Toggle({ label, enabled, onChange, danger = false }: { label: string; enabled: boolean; onChange: (v: boolean) => void; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-[15px] font-medium text-[#1C1C1E]">{label}</span>
      <button
        onClick={() => onChange(!enabled)}
        className={`w-[48px] h-[28px] rounded-full p-0.5 transition-colors duration-300 ease-in-out relative ${
          enabled ? (danger ? 'bg-red-500' : 'bg-[#25D366]') : 'bg-black/10'
        }`}
      >
        <motion.div
          animate={{ x: enabled ? 20 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="w-[24px] h-[24px] bg-white rounded-full shadow-sm"
        />
      </button>
    </div>
  );
}

// ─── CHANNEL MANAGEMENT ─────────────────────────────────────────────────────
function ChannelManagement({ community, myAddress, onChannelSelect, onUpdate }: any) {
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', isPaid: false, price: '10', currency: 'USDC' });
  const channels = community?.channels || [];

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/chat/communities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-web3-address': myAddress, 'x-verified-session-address': myAddress },
        body: JSON.stringify({ action: 'CREATE_CHANNEL', communityId: community.id, ...form }),
      });
      if (res.ok) { toast.success('Channel created'); setShowAdd(false); onUpdate?.(); }
      else toast.error('Failed to create');
    } catch { toast.error('Network error'); }
    setLoading(false);
  };

  const handleDelete = async (channelId: string) => {
    if (!confirm('Delete this channel? All messages will be lost forever.')) return;
    try {
      const res = await fetch('/api/chat/communities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-web3-address': myAddress, 'x-verified-session-address': myAddress },
        body: JSON.stringify({ action: 'DELETE_CHANNEL', communityId: community.id, channelId }),
      });
      if (res.ok) { toast.success('Channel deleted'); onUpdate?.(); }
    } catch { toast.error('Error deleting channel'); }
  };

  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-black/5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[13px] font-black uppercase tracking-widest text-[#25D366]">Channels</h3>
        <button onClick={() => setShowAdd(!showAdd)} className="text-[13px] font-bold text-[#25D366] hover:text-[#128C7E]">
          {showAdd ? 'Cancel' : '+ Add Channel'}
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="bg-[#F2F2F7] rounded-2xl p-4 mb-4 flex flex-col gap-3">
              <input type="text" placeholder="Channel Name (e.g. general)" value={form.name} onChange={e => setForm({...form, name: e.target.value.toLowerCase().replace(/\s+/g, '-')})} className="w-full px-4 py-2.5 rounded-xl border border-black/10 outline-none focus:border-[#25D366] text-[14px]" />
              <Toggle label="Paid Channel (Token Gated)" enabled={form.isPaid} onChange={v => setForm({...form, isPaid: v})} />
              {form.isPaid && (
                <div className="flex gap-2">
                  <input type="number" placeholder="Price" value={form.price} onChange={e => setForm({...form, price: e.target.value})} className="w-1/2 px-4 py-2.5 rounded-xl border border-black/10 outline-none text-[14px]" />
                  <select value={form.currency} onChange={e => setForm({...form, currency: e.target.value})} className="w-1/2 px-4 py-2.5 rounded-xl border border-black/10 outline-none text-[14px] bg-white">
                    <option value="USDC">USDC</option><option value="USDT">USDT</option><option value="ETH">ETH</option>
                  </select>
                </div>
              )}
              <button onClick={handleAdd} disabled={loading || !form.name.trim()} className="w-full py-3 bg-[#25D366] text-white font-bold rounded-xl disabled:opacity-50 mt-1">
                {loading ? 'Creating...' : 'Create Channel'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {channels.map((c: any) => (
          <div key={c.id} className="flex items-center justify-between p-3 bg-[#F2F2F7] rounded-2xl hover:bg-[#E5E5EA] transition-colors group">
            <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => onChannelSelect?.(c.id)}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${c.isPaid ? 'bg-purple-100 text-purple-500' : 'bg-black/5 text-black/50'}`}>
                {c.isPaid ? <Lock size={15} /> : <Hash size={15} />}
              </div>
              <div>
                <p className="text-[15px] font-bold text-[#1C1C1E] leading-tight">{c.name}</p>
                {c.isPaid && <p className="text-[11px] font-bold text-purple-500 mt-0.5">{c.price} {c.currency} to access</p>}
              </div>
            </div>
            {c.name !== 'general' && (
              <button onClick={() => handleDelete(c.id)} className="p-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg hover:bg-red-50">
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN SETTINGS PANEL ────────────────────────────────────────────────────
export function CommunitySettingsPanel({ community, myAddress, onChannelSelect, onCommunityUpdate }: CommunitySettingsPanelProps) {
  const [perms, setPerms] = useState(community?.permissions || {
    sendMessages: true, sendMedia: true, sendStickers: true, sendPolls: true,
    embedLinks: true, addUsers: false, pinMessages: false, changeInfo: false,
    slowModeSeconds: 0, antiSpam: false, requireApproval: false
  });
  
  const [profile, setProfile] = useState({ name: community?.name || '', description: community?.description || '' });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Sync state if community updates from parent
  useEffect(() => {
    if (community?.permissions) setPerms(community.permissions);
    setProfile({ name: community?.name || '', description: community?.description || '' });
  }, [community]);

  const isAdmin = community?.ownerAddress?.toLowerCase() === myAddress.toLowerCase() || 
                  community?.members?.some((m: any) => m.walletAddress.toLowerCase() === myAddress.toLowerCase() && m.role === 'ADMIN');

  const updatePerms = async (updates: any) => {
    const next = { ...perms, ...updates };
    setPerms(next);
    try {
      await fetch('/api/chat/communities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-web3-address': myAddress, 'x-verified-session-address': myAddress },
        body: JSON.stringify({ action: 'UPDATE_PERMISSIONS', communityId: community.id, permissions: next }),
      });
      onCommunityUpdate?.();
    } catch { toast.error('Failed to save permissions'); }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await fetch('/api/chat/communities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-web3-address': myAddress, 'x-verified-session-address': myAddress },
        body: JSON.stringify({ action: 'UPDATE_INFO', communityId: community.id, name: profile.name, description: profile.description }),
      });
      if (res.ok) {
        toast.success('Profile updated');
        setIsEditingProfile(false);
        onCommunityUpdate?.();
      }
    } catch { toast.error('Failed to update profile'); }
    setSavingProfile(false);
  };

  const copyInvite = () => {
    navigator.clipboard.writeText(`https://humanidfi.com/join/${community?.joinCode}`);
    toast.success('Invite link copied!');
  };

  const AVATAR_COLORS = ['#25D366','#007AFF','#FF9500','#FF3B30','#AF52DE','#5856D6'];
  const avatarColor = community?.id ? AVATAR_COLORS[(community.id.charCodeAt(0) || 0) % AVATAR_COLORS.length] : '#000';

  if (!community) return <div className="p-8 text-center text-black/40">Loading settings...</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 pb-28 flex flex-col gap-6">
      
      {/* ── PROFILE CARD ── */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/5 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-24 opacity-20" style={{ background: `linear-gradient(to bottom, ${avatarColor}, transparent)` }} />
        
        <div className="relative flex flex-col md:flex-row gap-6 items-start">
          <div className="w-24 h-24 rounded-3xl flex items-center justify-center text-white font-black text-4xl shadow-xl shrink-0" style={{ backgroundColor: avatarColor }}>
            {profile.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 w-full">
            {isEditingProfile ? (
              <div className="flex flex-col gap-3">
                <input value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-black/10 text-[16px] font-bold outline-none focus:border-[#25D366]" placeholder="Community Name" />
                <textarea value={profile.description} onChange={e => setProfile({...profile, description: e.target.value})} rows={3} className="w-full px-4 py-2.5 rounded-xl border border-black/10 text-[14px] outline-none focus:border-[#25D366] resize-none" placeholder="Description (optional)" />
                <div className="flex gap-2">
                  <button onClick={handleSaveProfile} disabled={savingProfile} className="px-5 py-2 bg-[#25D366] text-white font-bold rounded-xl hover:bg-[#128C7E] flex items-center gap-2">
                    {savingProfile ? 'Saving...' : <><Save size={16} /> Save</>}
                  </button>
                  <button onClick={() => setIsEditingProfile(false)} className="px-5 py-2 bg-[#F2F2F7] text-[#1C1C1E] font-bold rounded-xl hover:bg-[#E5E5EA]">Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-[24px] font-black text-[#1C1C1E] leading-tight mb-2">{community.name}</h2>
                    <p className="text-[14px] text-black/60 leading-relaxed max-w-lg">{community.description || 'No description provided.'}</p>
                  </div>
                  {isAdmin && (
                    <button onClick={() => setIsEditingProfile(true)} className="p-2.5 rounded-xl bg-black/5 hover:bg-black/10 text-black/50 hover:text-black transition-colors">
                      <Edit size={18} />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-6 pt-5 border-t border-black/5">
                  <div className="flex flex-col">
                    <span className="text-[18px] font-black text-[#1C1C1E]">{community.members?.length || 1}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-black/30">Members</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[18px] font-black text-[#1C1C1E]">{community.channels?.length || 0}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-black/30">Channels</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[18px] font-black text-[#1C1C1E]">{new Date(community.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric'})}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-black/30">Created</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── ANALYTICS (Mocked UI) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: MessageCircle, label: 'Messages Today', val: Math.floor(Math.random()*150)+50, color: 'text-blue-500', bg: 'bg-blue-50' },
          { icon: UserPlus, label: 'New Members', val: Math.floor(Math.random()*20)+2, color: 'text-green-500', bg: 'bg-green-50' },
          { icon: Zap, label: 'Active Now', val: '24%', color: 'text-amber-500', bg: 'bg-amber-50' },
          { icon: BarChart, label: 'Engagement', val: 'High', color: 'text-purple-500', bg: 'bg-purple-50' },
        ].map((s,i) => (
          <div key={i} className="bg-white rounded-3xl p-5 shadow-sm border border-black/5 flex flex-col items-center text-center">
            <div className={`w-10 h-10 rounded-2xl ${s.bg} flex items-center justify-center mb-3 ${s.color}`}>
              <s.icon size={18} />
            </div>
            <span className="text-[20px] font-black text-[#1C1C1E] leading-none mb-1">{s.val}</span>
            <span className="text-[11px] font-bold text-black/40 uppercase">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── INVITE LINK ── */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-black/5">
        <h3 className="text-[13px] font-black uppercase tracking-widest text-[#25D366] mb-4">Invite Link</h3>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="w-24 h-24 rounded-2xl bg-black/5 border border-black/10 flex items-center justify-center shrink-0 overflow-hidden relative group cursor-pointer" onClick={copyInvite}>
            {/* Fake QR pattern */}
            <div className="absolute inset-2 grid grid-cols-5 grid-rows-5 gap-0.5 opacity-30">
              {Array.from({length:25}).map((_,i)=><div key={i} className={`bg-black ${Math.random()>0.4?'rounded-sm':''}`} style={{opacity: Math.random()}} />)}
            </div>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Share size={20} className="text-white" />
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <p className="text-[13px] text-black/50 mb-2">Share this link to invite people to your community.</p>
            <div className="flex items-center gap-2">
              <input readOnly value={`https://humanidfi.com/join/${community?.joinCode}`} className="flex-1 px-4 py-3 bg-[#F2F2F7] rounded-xl text-[14px] font-mono font-bold text-black/60 outline-none" />
              <button onClick={copyInvite} className="px-5 py-3 bg-[#1C1C1E] text-white font-bold rounded-xl hover:bg-black transition-colors">
                Copy
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── CHANNELS ── */}
      {isAdmin && <ChannelManagement community={community} myAddress={myAddress} onChannelSelect={onChannelSelect} onUpdate={onCommunityUpdate} />}

      {/* ── PERMISSIONS ── */}
      {isAdmin && (
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-black/5">
          <h3 className="text-[13px] font-black uppercase tracking-widest text-[#25D366] mb-4">Member Permissions</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-1">
            <Toggle label="Send Messages" enabled={perms.sendMessages} onChange={v => updatePerms({sendMessages: v})} />
            <Toggle label="Send Media & Audio" enabled={perms.sendMedia} onChange={v => updatePerms({sendMedia: v})} />
            <Toggle label="Send Polls" enabled={perms.sendPolls} onChange={v => updatePerms({sendPolls: v})} />
            <Toggle label="Embed Links" enabled={perms.embedLinks} onChange={v => updatePerms({embedLinks: v})} />
            <Toggle label="Pin Messages" enabled={perms.pinMessages} onChange={v => updatePerms({pinMessages: v})} />
            <Toggle label="Change Community Info" enabled={perms.changeInfo} onChange={v => updatePerms({changeInfo: v})} />
          </div>

          <div className="h-px bg-black/5 my-5" />
          
          <h3 className="text-[13px] font-black uppercase tracking-widest text-[#25D366] mb-4">Moderation</h3>
          <Toggle label="Anti-Spam Filter" enabled={perms.antiSpam} onChange={v => updatePerms({antiSpam: v})} />
          <Toggle label="Require Join Approval" enabled={perms.requireApproval} onChange={v => updatePerms({requireApproval: v})} />
          
          <div className="mt-4">
            <span className="text-[15px] font-medium text-[#1C1C1E] mb-3 block">Slow Mode</span>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {[
                { l: 'Off', v: 0 }, { l: '10s', v: 10 }, { l: '30s', v: 30 },
                { l: '1m', v: 60 }, { l: '5m', v: 300 }, { l: '1h', v: 3600 }
              ].map(opt => (
                <button
                  key={opt.v}
                  onClick={() => updatePerms({slowModeSeconds: opt.v})}
                  className={`px-4 py-2 rounded-xl text-[13px] font-bold shrink-0 transition-colors ${
                    perms.slowModeSeconds === opt.v ? 'bg-[#25D366] text-white' : 'bg-[#F2F2F7] text-black/40 hover:bg-[#E5E5EA]'
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── PRIVACY ── */}
      {isAdmin && (
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-black/5">
          <h3 className="text-[13px] font-black uppercase tracking-widest text-[#25D366] mb-4">Privacy & Security</h3>
          <div className="bg-[#FAFAFA] rounded-2xl p-4 border border-black/5 mb-4">
            <div className="flex items-start gap-3">
              <Shield className={community.isPrivate ? "text-purple-500" : "text-green-500"} size={20} />
              <div>
                <p className="text-[15px] font-bold text-[#1C1C1E]">{community.isPrivate ? 'Private Community' : 'Public Community'}</p>
                <p className="text-[13px] text-black/50 mt-1">
                  {community.isPrivate 
                    ? 'Only people with the invite link can join. Not visible in search.'
                    : 'Anyone can find and join this community. Visible on network explorer.'}
                </p>
              </div>
            </div>
          </div>
          <Toggle 
            label="Make Community Private" 
            enabled={community.isPrivate} 
            onChange={async (v) => {
              await fetch('/api/chat/communities', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'x-web3-address': myAddress, 'x-verified-session-address': myAddress },
                body: JSON.stringify({ action: 'UPDATE_PRIVACY', communityId: community.id, isPrivate: v }),
              });
              onCommunityUpdate?.();
            }} 
          />
        </div>
      )}

      {/* ── DANGER ZONE ── */}
      {community.ownerAddress?.toLowerCase() === myAddress.toLowerCase() && (
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-red-100">
          <h3 className="text-[13px] font-black uppercase tracking-widest text-red-500 mb-4">Danger Zone</h3>
          <p className="text-[13px] text-black/50 mb-4">Deleting this community will permanently remove all channels, messages, and files. This action cannot be undone.</p>
          <button 
            onClick={async () => {
              if (prompt(`Type "${community.name}" to confirm deletion:`) !== community.name) return;
              try {
                const res = await fetch('/api/chat/communities', {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json', 'x-web3-address': myAddress, 'x-verified-session-address': myAddress },
                  body: JSON.stringify({ communityId: community.id }),
                });
                if (res.ok) { toast.success('Community deleted'); window.location.href = '/chat'; }
              } catch { toast.error('Delete failed'); }
            }}
            className="px-6 py-3 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors w-full sm:w-auto"
          >
            Delete Community
          </button>
        </div>
      )}

    </div>
  );
}
