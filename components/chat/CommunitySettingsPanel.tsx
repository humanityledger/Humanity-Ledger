'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, Users, Award, Lock, Trash2, Edit, Save, Share, Image as ImgIcon,
  MessageCircle, BarChart, Clock, Zap, UserPlus, Hash, CreditCard, ChevronRight, Check, MessageSquare, Globe
} from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';

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
      <span className="text-[14px] font-medium text-[#15171c]">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!enabled)}
        className={`w-[46px] h-[26px] rounded-full p-0.5 transition-colors duration-200 ease-in-out relative ${
          enabled ? (danger ? 'bg-red-500' : 'bg-[#15171c]') : 'bg-black/10'
        }`}
      >
        <motion.div
          animate={{ x: enabled ? 20 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="w-[22px] h-[22px] bg-white rounded-full shadow-xs"
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
      else toast.error('Failed to create channel');
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
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/[0.06] space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#727a88]">Channels</h3>
          <p className="text-[13px] text-[#727a88]">Organize discussions by topic or permission</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="text-[12.5px] font-semibold text-[#15171c] hover:underline"
        >
          {showAdd ? 'Cancel' : '+ Add Channel'}
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="bg-[#f2f4f7] rounded-2xl p-4 space-y-3 border border-black/[0.04]">
              <input
                type="text"
                placeholder="Channel Name (e.g. general, announcements)"
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value.toLowerCase().replace(/\s+/g, '-')})}
                className="w-full px-4 py-2.5 rounded-xl bg-white border border-black/[0.06] outline-none focus:border-[#15171c] text-[14px] text-[#15171c]"
              />
              <Toggle label="Paid Channel (Token Gated)" enabled={form.isPaid} onChange={v => setForm({...form, isPaid: v})} />
              {form.isPaid && (
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Price"
                    value={form.price}
                    onChange={e => setForm({...form, price: e.target.value})}
                    className="w-1/2 px-4 py-2.5 rounded-xl bg-white border border-black/[0.06] outline-none text-[14px] text-[#15171c]"
                  />
                  <select
                    value={form.currency}
                    onChange={e => setForm({...form, currency: e.target.value})}
                    className="w-1/2 px-4 py-2.5 rounded-xl bg-white border border-black/[0.06] outline-none text-[14px] text-[#15171c]"
                  >
                    <option value="USDC">USDC</option>
                    <option value="USDT">USDT</option>
                    <option value="ETH">ETH</option>
                  </select>
                </div>
              )}
              <button
                onClick={handleAdd}
                disabled={loading || !form.name.trim()}
                className="w-full py-2.5 bg-[#15171c] hover:bg-black text-white text-xs font-semibold rounded-xl disabled:opacity-40 shadow-sm transition-all active:scale-95"
              >
                {loading ? 'Creating...' : 'Create Channel'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {channels.map((c: any) => (
          <div key={c.id} className="flex items-center justify-between p-3.5 bg-[#f2f4f7] rounded-2xl hover:bg-[#eaeef3] transition-colors group">
            <div className="flex items-center gap-3 cursor-pointer flex-1 min-w-0" onClick={() => onChannelSelect?.(c.id)}>
              <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-[#15171c] shrink-0 border border-black/[0.04]">
                {c.isPaid ? <Lock size={14} /> : <Hash size={14} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-[#15171c] leading-tight truncate">{c.name}</p>
                {c.isPaid && <p className="text-[11px] font-semibold text-[#727a88] mt-0.5">{c.price} {c.currency} to access</p>}
              </div>
            </div>
            {c.name !== 'general' && (
              <button
                onClick={() => handleDelete(c.id)}
                className="p-2 text-[#727a88] hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-50"
                title="Delete channel"
              >
                <Trash2 size={15} />
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

  if (!community) return <div className="p-8 text-center text-[#727a88]">Loading settings...</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 pb-28 space-y-6">
      
      {/* ── PROFILE & GROUP PREVIEW CARD ── */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/[0.06]">
        <div className="flex flex-col md:flex-row gap-5 items-start">
          <div className="w-20 h-20 rounded-2xl bg-[#15171c] text-white font-bold text-3xl flex items-center justify-center shrink-0 shadow-sm">
            {profile.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 w-full min-w-0">
            {isEditingProfile ? (
              <div className="space-y-3">
                <input
                  value={profile.name}
                  onChange={e => setProfile({...profile, name: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-black/[0.08] text-[15px] font-bold text-[#15171c] outline-none focus:border-[#15171c]"
                  placeholder="Community Name"
                />
                <textarea
                  value={profile.description}
                  onChange={e => setProfile({...profile, description: e.target.value})}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-black/[0.08] text-[13px] text-[#15171c] outline-none focus:border-[#15171c] resize-none"
                  placeholder="Description (optional)"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className="px-4 py-2 bg-[#15171c] hover:bg-black text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    {savingProfile ? 'Saving...' : <><Save size={14} /> Save</>}
                  </button>
                  <button
                    onClick={() => setIsEditingProfile(false)}
                    className="px-4 py-2 bg-[#f2f4f7] hover:bg-[#e4e7ec] text-[#15171c] text-xs font-semibold rounded-xl"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[22px] font-bold text-[#15171c] leading-tight mb-1 truncate">
                      {community.name}
                    </h2>
                    <p className="text-[13.5px] text-[#727a88] leading-relaxed">
                      {community.description || 'No description provided.'}
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => setIsEditingProfile(true)}
                      className="p-2 rounded-xl bg-[#f2f4f7] hover:bg-[#e4e7ec] text-[#15171c] transition-colors shrink-0"
                      title="Edit community profile"
                    >
                      <Edit size={16} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-6 mt-5 pt-4 border-t border-black/[0.04]">
                  <div>
                    <span className="text-[18px] font-bold font-mono text-[#15171c] block">
                      {community.members?.length || community.membersCount || 1}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#727a88]">Members</span>
                  </div>
                  <div>
                    <span className="text-[18px] font-bold font-mono text-[#15171c] block">
                      {community.channels?.length || 1}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#727a88]">Channels</span>
                  </div>
                  <div>
                    <span className="text-[18px] font-bold font-mono text-[#15171c] block">
                      {new Date(community.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric'})}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#727a88]">Created</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── REAL NATIVE STATS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Users, label: 'Members', val: community?.membersCount ?? community?.members?.length ?? 1 },
          { icon: Hash, label: 'Channels', val: community?.channels?.length ?? 1 },
          { icon: MessageSquare, label: 'Posts', val: community?.postsCount ?? 0 },
          { icon: Award, label: 'Access', val: community?.isPrivate ? 'Private' : 'Public' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-black/[0.06] flex flex-col items-center text-center space-y-1">
            <div className="w-9 h-9 rounded-xl bg-[#f2f4f7] flex items-center justify-center text-[#15171c] mb-1">
              <s.icon size={16} />
            </div>
            <span className="text-[18px] font-bold font-mono text-[#15171c]">{s.val}</span>
            <span className="text-[10px] font-semibold text-[#727a88] uppercase tracking-wider">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── INVITE LINK ── */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/[0.06] space-y-4">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#727a88]">Invite Link</h3>
          <p className="text-[13px] text-[#727a88]">Share this link or QR code to invite members</p>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div
            className="w-24 h-24 rounded-2xl bg-white border border-black/[0.08] flex items-center justify-center shrink-0 p-2 shadow-xs cursor-pointer hover:border-black/20 transition-all"
            onClick={copyInvite}
            title="Click to copy invite"
          >
            <QRCodeSVG value={`https://humanidfi.com/join/${community?.joinCode || ''}`} size={76} level="M" />
          </div>
          <div className="flex-1 w-full flex flex-col justify-center gap-2">
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={`https://humanidfi.com/join/${community?.joinCode || ''}`}
                className="flex-1 px-4 py-2.5 bg-[#f2f4f7] rounded-xl text-[13px] font-mono text-[#15171c] outline-none border border-black/[0.04]"
              />
              <button
                onClick={copyInvite}
                className="px-5 py-2.5 bg-[#15171c] hover:bg-black text-white text-xs font-semibold rounded-xl transition-all shadow-sm shrink-0 active:scale-95"
              >
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
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/[0.06] space-y-4">
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#727a88]">Member Permissions</h3>
            <p className="text-[13px] text-[#727a88]">Control what sovereign accounts can do in this group</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 divide-y md:divide-y-0 divide-black/[0.03]">
            <Toggle label="Send Messages" enabled={perms.sendMessages} onChange={v => updatePerms({sendMessages: v})} />
            <Toggle label="Send Media & Audio" enabled={perms.sendMedia} onChange={v => updatePerms({sendMedia: v})} />
            <Toggle label="Send Polls" enabled={perms.sendPolls} onChange={v => updatePerms({sendPolls: v})} />
            <Toggle label="Embed Links" enabled={perms.embedLinks} onChange={v => updatePerms({embedLinks: v})} />
            <Toggle label="Pin Messages" enabled={perms.pinMessages} onChange={v => updatePerms({pinMessages: v})} />
            <Toggle label="Change Community Info" enabled={perms.changeInfo} onChange={v => updatePerms({changeInfo: v})} />
          </div>

          <div className="h-px bg-black/[0.04] my-2" />
          
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#727a88] mb-1">Moderation & Slow Mode</h3>
            <Toggle label="Anti-Spam Filter" enabled={perms.antiSpam} onChange={v => updatePerms({antiSpam: v})} />
            <Toggle label="Require Join Approval" enabled={perms.requireApproval} onChange={v => updatePerms({requireApproval: v})} />
          </div>
          
          <div className="pt-2">
            <span className="text-[13px] font-semibold text-[#15171c] mb-2 block">Slow Mode</span>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {[
                { l: 'Off', v: 0 }, { l: '10s', v: 10 }, { l: '30s', v: 30 },
                { l: '1m', v: 60 }, { l: '5m', v: 300 }, { l: '1h', v: 3600 }
              ].map(opt => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => updatePerms({slowModeSeconds: opt.v})}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all ${
                    perms.slowModeSeconds === opt.v ? 'bg-[#15171c] text-white shadow-sm' : 'bg-[#f2f4f7] text-[#727a88] hover:text-[#15171c]'
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
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/[0.06] space-y-4">
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#727a88]">Privacy & Discovery</h3>
            <p className="text-[13px] text-[#727a88]">Set group visibility across the protocol</p>
          </div>
          <div className="bg-[#f2f4f7] rounded-2xl p-4 border border-black/[0.03]">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-[#15171c] shrink-0 border border-black/[0.04]">
                {community.isPrivate ? <Lock size={15} /> : <Globe size={15} />}
              </div>
              <div>
                <p className="text-[14px] font-bold text-[#15171c]">{community.isPrivate ? 'Private Community' : 'Public Community'}</p>
                <p className="text-[12.5px] text-[#727a88] mt-0.5">
                  {community.isPrivate 
                    ? 'Only people with the invite link can join. Not visible in search.'
                    : 'Anyone can find and join this community on the network explorer.'}
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
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-red-100 space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-red-600">Danger Zone</h3>
          <p className="text-[13px] text-[#727a88] leading-relaxed">
            Deleting this community will permanently remove all channels, posts, messages, and vaults. This action cannot be undone.
          </p>
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
            className="px-5 py-2.5 bg-red-50 text-red-600 font-semibold text-xs rounded-xl hover:bg-red-100 transition-colors"
          >
            Delete Community
          </button>
        </div>
      )}

    </div>
  );
}
