"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, User, Bell, Lock, Database, Paintbrush,
  Globe, Star, Phone, Folder, MonitorSmartphone, Bookmark,
  QrCode, Check, Shield, Trash2, Camera, Crown, ArrowRight,
  Plus, Zap, Bot, Eye, EyeOff, Cpu, Wifi, WifiOff, Key,
  RefreshCw, Download, AlertTriangle, Volume2, Vibrate,
  MessageCircle, Settings, Hash, Activity, Radio, AtSign,
  ChevronDown, ChevronRight, Flame, Clock
} from 'lucide-react';
import QRCode from 'react-qr-code';
import { toast } from 'sonner';
import { downscaleAvatar, pushPublicProfile } from '@/lib/chat/profileSync';
import { vault } from '@/lib/core/SecureVault';
import { getCallHistory, CallRecord } from '@/lib/wallet/callHistory';
import {
  pxeEngine,
  LedgerProtocolSettings,
  DEFAULT_PXE_SETTINGS
} from '@/lib/wallet/SettingsEnginePXE';
import { useAppKit } from '@reown/appkit/react';
import { useWalletStore } from '@/lib/store/wallet-store';
import { useT } from '@/lib/i18n/client';
import { AVATAR_RADIUS, UserAvatar } from '@/components/chat/UserAvatar';


// ─────────────────────────────────────────────────────────────────────────
//  HOOK: useLedgerSettings
//  Subscribes a component to the PXE engine for reactive setting updates.
// ─────────────────────────────────────────────────────────────────────────

export { useLedgerSettings } from '@/lib/hooks/useLedgerSettings';
import { useLedgerSettings } from '@/lib/hooks/useLedgerSettings';

// ─────────────────────────────────────────────────────────────────────────
//  MAIN ROUTER COMPONENT
// ─────────────────────────────────────────────────────────────────────────

export interface LedgerChatSettingsProps {
  onClose: () => void;
  address: string;
}

export function LedgerChatSettings({ onClose, address }: LedgerChatSettingsProps) {
  const t = useT();
  const [viewStack, setViewStack] = useState<string[]>(['root']);
  const [direction, setDirection] = useState(1);
  const { settings, updateSetting, updateBatch, isLoaded } = useLedgerSettings(address);

  const view = viewStack[viewStack.length - 1];

  const navigate = (newView: string) => {
    setDirection(1);
    setViewStack(prev => [...prev, newView]);
  };

  const goBack = () => {
    if (viewStack.length === 1) { onClose(); return; }
    setDirection(-1);
    setViewStack(prev => prev.slice(0, -1));
  };

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 1 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 1 }),
  };

  if (!isLoaded) return null;

  const viewTitle = view === 'root' ? 'SETTINGS'
    : view === 'profile' ? 'MY PROFILE'
    : view === 'edit_profile' ? 'EDIT PROFILE'
    : view === 'notifications' ? 'ALERTS & SOUNDS'
    : view === 'privacy' ? 'PRIVACY'
    : view === 'data' ? 'DATA & STORAGE'
    : view === 'appearance' ? 'APPEARANCE'
    : view === 'language' ? 'LANGUAGE'
    : view === 'personal_vault' ? 'PERSONAL VAULT'
    : view === 'connection_log' ? 'CONNECTION LOG'
    : view === 'devices' ? 'ACTIVE DEVICES'
    : view === 'workspaces' ? 'WORKSPACES'
    : view === 'ghost_mode' ? 'AI ASSISTANT'
    : view === 'defi_tools' ? 'TOOLS'
    : view === 'network' ? 'NETWORK'
    : view.toUpperCase().replace(/_/g, ' ');

  return (
    <div className="fixed inset-0 z-[50] flex items-center justify-center pointer-events-none">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md pointer-events-auto" onClick={onClose} />
      <div className="relative w-full h-[100dvh] md:h-[90vh] md:w-[460px] bg-[#F8F8F8] pointer-events-auto flex flex-col font-sans overflow-hidden z-10 md:shadow-2xl border-0 md:border md:border-black/10">
        <div className="flex items-center justify-between px-6 py-5 bg-[#F8F8F8]/95 backdrop-blur-sm shrink-0 border-b border-black/8 z-10">
          <button onClick={goBack} className="text-black/50 hover:text-black transition-colors p-1 -ml-1 flex items-center gap-1.5">
            <ChevronLeft size={18} />
            <span className="text-[12px] font-bold uppercase tracking-wider">{view === 'root' ? t("Close") : t("Back")}</span>
          </button>
          <span className="text-[11px] font-mono tracking-[0.2em] uppercase font-bold text-black absolute left-1/2 -translate-x-1/2">
            {viewTitle}
          </span>
          <div className="w-16" />
        </div>

        <div className="relative flex-1 w-full overflow-hidden bg-[#F8F8F8]">
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={view}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              className="absolute inset-0 w-full h-full flex flex-col bg-[#F8F8F8] overflow-y-auto"
            >
              {view === 'root' && <RootView onNavigate={navigate} address={address} s={settings} />}
              {view === 'profile' && <ProfileView address={address} s={settings} />}
              {view === 'edit_profile' && <EditProfileView address={address} s={settings} update={updateSetting} updateBatch={updateBatch} goBack={goBack} />}
              {view === 'notifications' && <NotificationsView s={settings} update={updateSetting} />}
              {view === 'privacy' && <PrivacyView s={settings} update={updateSetting} />}
              {view === 'data' && <DataView s={settings} update={updateSetting} address={address} />}
              {view === 'appearance' && <AppearanceView s={settings} update={updateSetting} />}
              {view === 'language' && <LanguageView s={settings} update={updateSetting} />}
              {view === 'personal_vault' && <PersonalVaultView address={address} />}
              {view === 'connection_log' && <ConnectionLogView address={address} />}
              {view === 'devices' && <DevicesView />}
              {view === 'workspaces' && <WorkspacesView s={settings} update={updateSetting} />}
              {view === 'ghost_mode' && <GhostModeView s={settings} update={updateSetting} />}
              {view === 'defi_tools' && <DefiToolsView s={settings} update={updateSetting} />}
              {view === 'network' && <NetworkView s={settings} update={updateSetting} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  ROOT VIEW
// ─────────────────────────────────────────────────────────────────────────

function RootView({ onNavigate, address, s }: any) {
  const t = useT();
  return (
    <div className="w-full pb-20 px-6">
      <button onClick={() => onNavigate('profile')} className="w-full py-6 border-b border-black/8 flex items-center gap-5 text-left group">
        <UserAvatar address={address} photo={s.avatar_url || undefined} isMe size={56} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <span className="text-[18px] font-bold text-black tracking-tight truncate">{s.displayName}</span>
          <span className="text-[12px] font-mono text-black/40 truncate">{address}</span>
        </div>
        <ChevronRight size={16} className="text-black/20 group-hover:text-black transition-colors shrink-0" />
      </button>

      <div className="mt-8 flex flex-col">
        <BBlock>
          <BItem icon={<Bookmark size={16}/>} label={t("Personal Vault")} onClick={() => onNavigate('personal_vault')} />
          <BItem icon={<Phone size={16}/>} label={t("Connection Log")} onClick={() => onNavigate('connection_log')} />
          <BItem icon={<MonitorSmartphone size={16}/>} label={t("Active Devices")} onClick={() => onNavigate('devices')} />
          <BItem icon={<Folder size={16}/>} label={t("Workspaces")} onClick={() => onNavigate('workspaces')} noBorder />
        </BBlock>

        <div className="mt-10">
          <BBlock>
            <BItem icon={<Bell size={16}/>} label={t("Alerts & Sounds")} onClick={() => onNavigate('notifications')} />
            <BItem icon={<Shield size={16}/>} label={t("Privacy Engine")} onClick={() => onNavigate('privacy')} />
            <BItem icon={<Database size={16}/>} label={t("Data & Storage")} onClick={() => onNavigate('data')} />
            <BItem icon={<Paintbrush size={16}/>} label={t("Aesthetics")} onClick={() => onNavigate('appearance')} />
            <BItem icon={<Globe size={16}/>} label={t("Language")} onClick={() => onNavigate('language')} noBorder />
          </BBlock>
        </div>

        <div className="mt-10">
          <BBlock>
            <BItem icon={<Bot size={16}/>} label={t("AI Ghost Mode")} onClick={() => onNavigate('ghost_mode')} />
            <BItem icon={<Activity size={16}/>} label={t("Ledger Intelligence Tools")} onClick={() => onNavigate('defi_tools')} noBorder />
          </BBlock>
        </div>

        {/* Sticky profile footer */}
        <div className="sticky bottom-0 mt-10 pt-4 pb-6 bg-white/95 backdrop-blur-md border-t border-black/8 flex items-center gap-3 w-full">
          <UserAvatar address={address} photo={s.avatar_url || undefined} isMe size={40} />
          <div className="flex flex-col flex-1 overflow-hidden">
            <span className="text-[13px] font-bold text-black truncate">{s.displayName || t("My Profile")}</span>
            <span className="text-[10px] font-mono text-black/40 truncate">{address}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  PROFILE VIEW
// ─────────────────────────────────────────────────────────────────────────

function ProfileView({ address, s }: any) {
  const t = useT();
  const [showQR, setShowQR] = useState(false);
  return (
    <div className="w-full flex flex-col pb-20">
      <div className="w-full bg-black p-8 flex flex-col items-center text-white relative">
        <div className="mb-4 flex items-center justify-center">
          <UserAvatar address={address} photo={s.avatar_url || undefined} isMe size={112} />
        </div>
        <h2 className="text-2xl font-black uppercase text-center max-w-[90%] break-words">{s.displayName}</h2>
        <span className="text-zinc-400 text-sm font-bold mt-1">@{s.username}</span>
        <span className={`text-xs mt-2 px-2 py-0.5 border font-bold ${s.privacy_last_seen === 'nobody' ? 'border-zinc-600 text-zinc-600' : 'border-green-500 text-green-500'}`}>
          {s.privacy_last_seen === 'nobody' ? t("LAST SEEN: HIDDEN") : t("ONLINE")}
        </span>
        <button onClick={() => setShowQR(!showQR)} className="absolute top-4 right-4 p-2 bg-white text-black hover:bg-zinc-200">
          <QrCode size={20} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {showQR && (
          <div className="bg-white border-[3px] border-black p-6 flex flex-col items-center shadow-[8px_8px_0_0_#000]">
            <QRCode value={address || '0x0000000000000000000000000000000000000000'} size={180} fgColor="#000" />
            <span className="mt-4 text-[11px] font-bold bg-zinc-100 px-3 py-2 border border-black text-center break-all">{address}</span>
            <div className="flex gap-2 mt-3 w-full">
              <button onClick={() => { navigator.clipboard.writeText(address); toast.success(t("Address copied.")); }} className="flex-1 py-2 bg-black text-white font-black text-xs uppercase border-2 border-black">{t("COPY")}</button>
              <button onClick={() => {
                const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
                const shareUrl = `${appUrl}/chat?to=${encodeURIComponent(address)}`;
                if (navigator.share) {
                  navigator.share({ title: t("Connect on Humanity Ledger"), url: shareUrl }).catch(() => {});
                } else {
                  navigator.clipboard.writeText(shareUrl).then(() => toast.success(t("Chat link copied to clipboard!"))).catch(() => toast.error(t("Failed to copy link")));
                }
              }} className="flex-1 py-2 bg-white text-black font-black text-xs uppercase border-2 border-black hover:bg-zinc-100">{t("SHARE")}</button>
            </div>
          </div>
        )}
        <div className="bg-white border-[3px] border-black p-4 shadow-[4px_4px_0_0_#000]">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">{t("Biography")}</span>
          <p className="text-[14px] font-bold text-black whitespace-pre-wrap">{s.bio || '—'}</p>
        </div>
        <div className="bg-white border-[3px] border-black p-4 shadow-[4px_4px_0_0_#000] space-y-2">
          <InfoRow label={t("Onion Hops")} value={t("{onion_hops} hop{value}", { onion_hops: s.onion_hops, value: s.onion_hops !== 1 ? 's' : '' })} />
          <InfoRow label={t("Biometric Lock")} value={s.biometric_lock ? t("ENABLED") : t("DISABLED")} />
          <InfoRow label={t("Read Receipts")} value={s.show_read_receipts ? t("ON") : t("OFF")} />
          <InfoRow label={t("IP Masking")} value={s.webrtc_ip_masking ? t("ACTIVE") : t("OFF")} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  EDIT PROFILE VIEW
// ─────────────────────────────────────────────────────────────────────────

function EditProfileView({ address, s, update, updateBatch, goBack }: any) {
  const t = useT();
  const [name, setName] = useState(s.displayName);
  const [username, setUsername] = useState(s.username);
  const [bio, setBio] = useState(s.bio);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // The photo is made small enough for the server (lib/chat/profileSync.ts) and published, so the
  // people you chat with see it, not only this device (21 November 2026: this screen saved it locally).
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error(t("Choose an image file.")); return; }
    let dataUrl: string;
    try { dataUrl = await downscaleAvatar(file); } catch (err: any) { toast.error(err?.message || t("Could not open that photo.")); return; }
    await update('avatar_url', dataUrl);
    try { localStorage.setItem('ledger_avatar', dataUrl); } catch {}
    window.dispatchEvent(new CustomEvent('ledger_settings_update', { detail: { avatarUrl: dataUrl } }));
    const r = address ? await pushPublicProfile(address, { avatarUrl: dataUrl }) : { ok: false, error: 'no account' };
    if (r.ok) toast.success(t("Profile photo updated."));
    else if (r.error === 'offline') toast.message(t("Saved on this device. It will be shared once you are back online."));
    else toast.error(t("Saved on this device, but others cannot see it yet: {error}", { error: r.error }));
  };

  const handleSave = async () => {
    setSaving(true);
    await updateBatch({ displayName: name, username, bio });
    
    // [DB SYNC] Sync profile to central DB for searchability
    try {
      await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          displayName: name.trim(),
          chatName: username.replace('@', '').trim(),
          bio: bio.trim(),
        }),
      });
    } catch {}

    setSaving(false);
    toast.success(t("Profile updated."));
    goBack();
  };

  return (
    <div className="p-4 space-y-6 pb-20">
      <div className="flex justify-center">
        <button
          onClick={() => fileRef.current?.click()}
          className="w-24 h-24 flex items-center justify-center relative cursor-pointer group overflow-hidden p-0 leading-none"
          style={{ borderRadius: AVATAR_RADIUS }}
        >
          <UserAvatar address={address} photo={s.avatar_url || undefined} isMe size={96} />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Camera size={20} className="text-white" />
          </div>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
      </div>
      <BInput label={t("Display Name")} value={name} onChange={setName} />
      <BInput label={t("Username")} value={username} onChange={setUsername} prefix="@" />
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500">{t("Biography")}</label>
        <textarea
          className="w-full bg-white border-[3px] border-black p-3 text-[14px] font-bold outline-none focus:bg-yellow-50 resize-none h-24"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={200}
        />
        <span className="text-[10px] text-zinc-400 text-right">{bio.length}/200</span>
      </div>
      <button onClick={handleSave} disabled={saving} className="w-full py-4 bg-black text-white font-black uppercase tracking-widest border-[3px] border-black hover:bg-zinc-800 shadow-[6px_6px_0_0_#000] active:translate-y-1 disabled:opacity-50">
        {saving ? t("Saving...") : t("Save Changes")}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  ALERTS & SOUNDS VIEW
// ─────────────────────────────────────────────────────────────────────────

function NotificationsView({ s, update }: any) {
  const t = useT();
  return (
    <div className="p-4 space-y-6 pb-20">
      <SH title={t("Message Alerts")} />
      <BBlock>
        <TRow label={t("Direct Channels")} checked={s.notifications_private} onChange={(v: boolean) => update('notifications_private', v)} />
        <TRow label={t("Encrypted Groups")} checked={s.notifications_groups} onChange={(v: boolean) => update('notifications_groups', v)} />
        <TRow label={t("Workspaces")} checked={s.notifications_workspaces} onChange={(v: boolean) => update('notifications_workspaces', v)} noBorder />
      </BBlock>

      <SH title={t("Sound System")} />
      <BBlock>
        <TRow label={t("Notification Sound")} checked={s.notification_sound} onChange={(v: boolean) => update('notification_sound', v)} />
        <TRow label={t("Mechanical Keyboard")} checked={s.mechanical_keyboard} onChange={(v: boolean) => update('mechanical_keyboard', v)} />
        <TRow label={t("Show Unread Badge")} checked={s.badge_count} onChange={(v: boolean) => update('badge_count', v)} noBorder />
      </BBlock>

      <SH title={t("Sound Pack")} />
      <BBlock>
        {(['minimal', 'arcade', 'ledger', 'asmr'] as const).map((pack, i, arr) => (
          <div key={pack} onClick={() => update('sound_pack', pack)} className={`flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-100 ${i !== arr.length - 1 ? 'border-b-[3px] border-black' : ''}`}>
            <span className="font-black uppercase text-sm">{pack}</span>
            {s.sound_pack === pack && <Check size={18} />}
          </div>
        ))}
      </BBlock>

      <SH title={t("Haptics Intensity")} />
      <BBlock>
        {([0, 1, 2, 3] as const).map((level, i) => {
          const labels = ['OFF', 'LIGHT', 'MEDIUM', 'STRONG'];
          return (
            <div key={level} onClick={() => update('haptics_intensity', level)} className={`flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-100 ${i !== 3 ? 'border-b-[3px] border-black' : ''}`}>
              <div className="flex items-center gap-2">
                <Vibrate size={16} className={s.haptics_intensity >= level && level > 0 ? 'text-black' : 'text-zinc-300'} />
                <span className="font-black uppercase text-sm">{t(labels[level])}</span>
              </div>
              {s.haptics_intensity === level && <Check size={18} />}
            </div>
          );
        })}
      </BBlock>

      <button onClick={() => {
        update('notifications_private', true);
        update('notifications_groups', true);
        update('notification_sound', true);
        update('badge_count', true);
        toast.success(t("Alert system reset to defaults."));
      }} className="w-full py-4 bg-white text-red-600 font-black uppercase tracking-widest border-[3px] border-black shadow-[4px_4px_0_0_#000] active:translate-y-1">
        {t("Reset to Defaults")}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  PRIVACY ENGINE VIEW
// ─────────────────────────────────────────────────────────────────────────

function PrivacyView({ s, update }: any) {
  const t = useT();
  const [blocked, setBlocked] = useState<string[]>([]);
  const [showBlocked, setShowBlocked] = useState(false);

  useEffect(() => {
    vault.getItem('ledger_blocked').then(res => {
      if (res) { try { setBlocked(JSON.parse(res)); } catch(e) {} }
    });
  }, []);

  const unblock = (addr: string) => {
    const updated = blocked.filter(a => a !== addr);
    setBlocked(updated);
    vault.setItem('ledger_blocked', JSON.stringify(updated));
    toast.success(t("Address removed from blocklist."));
  };

  if (showBlocked) {
    return (
      <div className="p-4 space-y-4 pb-20">
        <button onClick={() => setShowBlocked(false)} className="mb-2 text-[12px] font-black uppercase tracking-widest border-2 border-black px-3 py-1 hover:bg-black hover:text-white transition-colors">
          {t("< BACK")}
        </button>
        <SH title={t("Blocked Nodes ({length})", { length: blocked.length })} />
        {blocked.length === 0
          ? <div className="p-6 bg-white border-[3px] border-black text-center font-bold text-sm shadow-[4px_4px_0_0_#000]">{t("NO BLOCKED ADDRESSES")}</div>
          : <BBlock>
              {blocked.map((b, i) => (
                <div key={b} className={`flex items-center justify-between p-4 ${i !== blocked.length - 1 ? 'border-b-[3px] border-black' : ''}`}>
                  <span className="font-bold text-[11px] truncate w-[60%]">{b}</span>
                  <button onClick={() => unblock(b)} className="px-3 py-1 bg-red-600 text-white font-black text-[10px] uppercase border-2 border-black hover:bg-red-700">{t("UNBLOCK")}</button>
                </div>
              ))}
            </BBlock>
        }
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 pb-20">
      <SH title={t("Security Controls")} />
      <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3">
        <Shield className="text-amber-600 shrink-0 mt-0.5" size={18} />
        <div>
          <h4 className="text-[13px] font-bold text-amber-900">{t("Security Advisory")}</h4>
          <p className="text-[11px] text-amber-800 leading-relaxed mt-0.5">
            {t("Accounts created before 7746250: move funds to a new wallet.")}
          </p>
        </div>
      </div>
      <BBlock>
        <TRow label={t("Hardware Passcode")} checked={s.passcode_enabled} onChange={(v: boolean) => update('passcode_enabled', v)} />
        <TRow label={t("Biometric Lock")} checked={s.biometric_lock} onChange={(v: boolean) => update('biometric_lock', v)} />
        <TRow label={t("WebRTC IP Masking")} checked={s.webrtc_ip_masking} onChange={(v: boolean) => update('webrtc_ip_masking', v)} />
        <BItem icon={<Lock size={16}/>} label={t("Blocked Addresses ({length})", { length: blocked.length })} onClick={() => setShowBlocked(true)} noBorder />
      </BBlock>

      <SH title={t("Visibility Settings")} />
      <BBlock>
        <CycleRow label={t("Last Seen")} value={s.privacy_last_seen} options={['nobody', 'contacts', 'everybody']} onChange={(v: boolean) => update('privacy_last_seen', v as any)} />
        <CycleRow label={t("Profile Photo")} value={s.privacy_profile_photo} options={['nobody', 'contacts', 'everybody']} onChange={(v: boolean) => update('privacy_profile_photo', v as any)} />
        <CycleRow label={t("Biography")} value={s.privacy_bio} options={['nobody', 'contacts', 'everybody']} onChange={(v: boolean) => update('privacy_bio', v as any)} />
        <CycleRow label={t("Group Invites")} value={s.privacy_group_invites} options={['nobody', 'contacts', 'everybody']} onChange={(v: boolean) => update('privacy_group_invites', v as any)} noBorder />
      </BBlock>

      <SH title={t("Communication Privacy")} />
      <BBlock>
        <TRow label={t("Show Read Receipts")} checked={s.show_read_receipts} onChange={(v: boolean) => update('show_read_receipts', v)} />
        <TRow label={t("Watermark Overlay")} checked={s.watermark_enabled} onChange={(v: boolean) => update('watermark_enabled', v)} noBorder />
      </BBlock>

      <SH title={t("Onion Routing (Tor Hops)")} />
      <BBlock>
        {([1, 3, 5] as const).map((hops, i) => {
          const labels: Record<number, string> = { 1: 'DIRECT (FASTEST)', 3: 'STANDARD (3 HOPS)', 5: 'MAXIMUM (5 HOPS)' };
          return (
            <div key={hops} onClick={() => update('onion_hops', hops)} className={`flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-100 ${i !== 2 ? 'border-b-[3px] border-black' : ''}`}>
              <span className="font-black uppercase text-sm">{t(labels[hops])}</span>
              {s.onion_hops === hops && <Check size={18} />}
            </div>
          );
        })}
      </BBlock>

      <SH title={t("Self-Destruct Protocol")} />
      <BBlock>
        <CycleRow label={t("Auto-Delete Timer")} value={s.auto_delete_timer} options={['off', '24 hours', '1 week', '1 month']} onChange={(v: boolean) => update('auto_delete_timer', v as any)} />
        <TRow label={t("Burn-on-Read")} checked={s.burn_on_read} onChange={(v: boolean) => update('burn_on_read', v)} />
        {s.burn_on_read && (
          <BBlock>
            {([3, 10, 30, 60] as const).map((sec, i, arr) => (
              <div key={sec} onClick={() => update('burn_on_read_seconds', sec)} className={`flex items-center justify-between p-3 cursor-pointer hover:bg-zinc-100 ${i !== arr.length - 1 ? 'border-b border-black/20' : ''}`}>
                <span className="font-black text-sm">{sec}s</span>
                {s.burn_on_read_seconds === sec && <Check size={16} />}
              </div>
            ))}
          </BBlock>
        )}
      </BBlock>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  DATA & STORAGE VIEW
// ─────────────────────────────────────────────────────────────────────────

function DataView({ s, update, address }: any) {
  const t = useT();
  const [stats, setStats] = useState({ sent: 0, received: 0 });

  useEffect(() => {
    // Calculate approximate storage usage from localStorage
    let totalBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || '';
      if (key.includes(address)) {
        totalBytes += (localStorage.getItem(key) || '').length * 2;
      }
    }
    setStats({ sent: Math.round(totalBytes / 1024), received: Math.round(totalBytes * 2.8 / 1024) });
  }, [address]);

  const purgeCacheWithConfirm = () => {
    if (confirm(t("This will clear all locally cached message data. Continue?"))) {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i) || '';
        if (key.includes('ledger_cache_')) localStorage.removeItem(key);
      }
      setStats({ sent: 0, received: 0 });
      toast.success(t("Cache purged successfully."));
    }
  };

  return (
    <div className="p-4 space-y-6 pb-20">
      <div className="bg-black text-white border-[3px] border-black p-6 flex flex-col items-center shadow-[6px_6px_0_0_#2754d6]">
        <div className="w-full flex justify-between items-end mb-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{t("Local Sent")}</span>
            <span className="text-xl font-black">{t("{sent} KB", { sent: stats.sent })}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{t("Local Rcvd")}</span>
            <span className="text-xl font-black text-[#2754d6]">{t("{received} KB", { received: stats.received })}</span>
          </div>
        </div>
        <div className="w-full h-3 bg-zinc-800 border border-white flex mb-4">
          <div className="h-full bg-white" style={{ width: `${Math.min(30, stats.sent / (stats.sent + stats.received + 1) * 100)}%` }} />
          <div className="h-full bg-[#2754d6]" style={{ width: `${Math.min(70, stats.received / (stats.sent + stats.received + 1) * 100)}%` }} />
        </div>
        <button onClick={purgeCacheWithConfirm} className="w-full py-2 bg-white text-black font-black uppercase text-sm border-2 border-transparent hover:border-[#2754d6] active:bg-zinc-200">
          {t("Clear Cache")}
        </button>
      </div>

      <SH title={t("Auto-Download")} />
      <BBlock>
        <TRow label={t("Auto-Fetch (WiFi)")} checked={s.auto_download_wifi} onChange={(v: boolean) => update('auto_download_wifi', v)} />
        <TRow label={t("Auto-Fetch (Cellular)")} checked={s.auto_download_cellular} onChange={(v: boolean) => update('auto_download_cellular', v)} />
        <TRow label={t("Save Media to Gallery")} checked={s.save_photos} onChange={(v: boolean) => update('save_photos', v)} noBorder />
      </BBlock>

      <SH title={t("Call Quality")} />
      <BBlock>
        <TRow label={t("Data-Saver WebRTC")} checked={s.data_saver_calls} onChange={(v: boolean) => update('data_saver_calls', v)} noBorder />
      </BBlock>

      <SH title={t("Privacy")} />
      <BBlock>
        <TRow label={t("Anonymous Telemetry")} checked={s.allow_analytics} onChange={(v: boolean) => update('allow_analytics', v)} noBorder />
      </BBlock>

      <button onClick={() => {
        if (confirm(t("This will wipe ALL Ledger Chat data for this wallet. This action cannot be undone."))) {
          localStorage.clear();
          window.location.reload();
        }
      }} className="w-full py-4 bg-white text-red-600 font-black uppercase tracking-widest border-[3px] border-black shadow-[4px_4px_0_0_#000] active:translate-y-1">
        {t("Delete All Data")}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  AESTHETICS VIEW
// ─────────────────────────────────────────────────────────────────────────

function AppearanceView({ s, update }: any) {
  const t = useT();
  return (
    <div className="p-4 space-y-6 pb-20">
      <SH title={t("Theme")} />
      <div className="grid grid-cols-2 gap-3">
        {(['brutalist', 'monochrome', 'neon_void', 'terminal'] as const).map(theme => (
          <div key={theme} onClick={() => update('theme', theme)} className={`border-[3px] p-4 cursor-pointer flex flex-col items-center gap-1 transition-all ${s.theme === theme ? 'bg-black text-white border-black shadow-[4px_4px_0_0_#2754d6]' : 'bg-white border-black text-black hover:bg-zinc-100'}`}>
            <span className="font-black uppercase text-[11px] tracking-widest">{theme.replace('_', ' ')}</span>
          </div>
        ))}
      </div>

      <SH title={t("Bubble Style")} />
      <BBlock>
        {(['default', 'brutalist', 'glass', 'minimal'] as const).map((style, i, arr) => (
          <div key={style} onClick={() => update('bubble_style', style)} className={`flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-100 ${i !== arr.length - 1 ? 'border-b-[3px] border-black' : ''}`}>
            <span className="font-black uppercase text-sm">{style}</span>
            {s.bubble_style === style && <Check size={18} />}
          </div>
        ))}
      </BBlock>

      <SH title={t("Chat Background")} />
      <BBlock>
        {(['default', 'amoled', 'holographic', 'matrix', 'gradient'] as const).map((bg, i, arr) => (
          <div key={bg} onClick={() => update('chat_background', bg)} className={`flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-100 ${i !== arr.length - 1 ? 'border-b-[3px] border-black' : ''}`}>
            <span className="font-black uppercase text-sm">{bg}</span>
            {s.chat_background === bg && <Check size={18} />}
          </div>
        ))}
      </BBlock>

      <SH title={t("UI Density")} />
      <BBlock>
        {(['relaxed', 'compact', 'dense'] as const).map((d, i, arr) => (
          <div key={d} onClick={() => update('ui_density', d)} className={`flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-100 ${i !== arr.length - 1 ? 'border-b-[3px] border-black' : ''}`}>
            <span className="font-black uppercase text-sm">{d}</span>
            {s.ui_density === d && <Check size={18} />}
          </div>
        ))}
      </BBlock>

      <SH title={t("Advanced")} />
      <BBlock>
        <TRow label={t("NFT Avatar Border")} checked={s.nft_border_enabled} onChange={(v: boolean) => update('nft_border_enabled', v)} />
        <TRow label={t("Watermark Overlay")} checked={s.watermark_enabled} onChange={(v: boolean) => update('watermark_enabled', v)} noBorder />
      </BBlock>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  LANGUAGE VIEW
// ─────────────────────────────────────────────────────────────────────────

function LanguageView({ s, update }: any) {
  const t = useT();
  const langs = [
    { code: 'en', label: t("ENGLISH") }, { code: 'es', label: t("ESPAÑOL") },
    { code: 'fr', label: t("FRANÇAIS") }, { code: 'de', label: t("DEUTSCH") },
    { code: 'jp', label: t("JAPANESE") }, { code: 'cn', label: t("CHINESE") },
  ];
  return (
    <div className="p-4 space-y-6 pb-20">
      <SH title={t("Interface Language")} />
      <BBlock>
        {langs.map(({ code, label }, i) => (
          <div key={code} onClick={() => update('language', code as any)} className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${i !== langs.length - 1 ? 'border-b-[3px] border-black' : ''} ${s.language === code ? 'bg-black text-white' : 'bg-white text-black hover:bg-zinc-100'}`}>
            <span className="font-black uppercase">{label}</span>
            {s.language === code && <Check size={18} />}
          </div>
        ))}
      </BBlock>

      <SH title={t("Format")} />
      <BBlock>
        <div onClick={() => update('time_format', s.time_format === '12h' ? '24h' : '12h')} className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-100 border-b-[3px] border-black">
          <span className="font-black uppercase text-sm">{t("Time Format")}</span>
          <span className="font-bold text-zinc-600 uppercase">{s.time_format}</span>
        </div>
        <div onClick={() => update('date_format', s.date_format === 'DD/MM/YYYY' ? 'MM/DD/YYYY' : 'DD/MM/YYYY')} className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-100">
          <span className="font-black uppercase text-sm">{t("Date Format")}</span>
          <span className="font-bold text-zinc-600 uppercase text-[11px]">{s.date_format}</span>
        </div>
      </BBlock>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  PERSONAL VAULT VIEW
// ─────────────────────────────────────────────────────────────────────────

function PersonalVaultView({ address }: { address: string }) {
  const t = useT();
  const [notes, setNotes] = useState<{ id: string; text: string; date: number }[]>([]);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    vault.getItem(`ledger_vault_notes_${address}`).then(res => {
      if (res) { try { setNotes(JSON.parse(res)); } catch(e) {} }
    });
  }, [address]);

  const saveNote = async () => {
    if (!draft.trim()) return;
    const updated = [{ id: crypto.randomUUID(), text: draft.trim(), date: Date.now() }, ...notes];
    setNotes(updated);
    await vault.setItem(`ledger_vault_notes_${address}`, JSON.stringify(updated));
    setDraft('');
    toast.success(t("Note saved to your vault."));
  };

  const deleteNote = async (id: string) => {
    const updated = notes.filter(n => n.id !== id);
    setNotes(updated);
    await vault.setItem(`ledger_vault_notes_${address}`, JSON.stringify(updated));
  };

  return (
    <div className="p-4 flex flex-col pb-20">
      <div className="w-full bg-white border-[3px] border-black p-3 flex shadow-[4px_4px_0_0_#000] mb-6">
        <input type="text" value={draft} onChange={e => setDraft(e.target.value)} placeholder={t("Enter secure fragment...")} className="flex-1 bg-transparent outline-none font-bold text-sm" onKeyDown={e => e.key === 'Enter' && saveNote()} />
        <button onClick={saveNote} className="bg-black text-white p-2 border-2 border-black hover:bg-zinc-800"><Plus size={16} /></button>
      </div>
      <div className="flex flex-col gap-4">
        {notes.length === 0
          ? <div className="w-full bg-black text-white p-6 border-[3px] border-black flex items-center justify-center border-dashed"><span className="font-mono text-zinc-400">{t("VAULT_EMPTY")}</span></div>
          : notes.map(note => (
              <div key={note.id} className="w-full bg-white border-[3px] border-black p-4 shadow-[4px_4px_0_0_#000]">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-black tracking-widest text-zinc-500 uppercase">{new Date(note.date).toLocaleString()}</span>
                  <button onClick={() => deleteNote(note.id)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
                </div>
                <p className="font-bold text-sm whitespace-pre-wrap break-words">{note.text}</p>
              </div>
            ))
        }
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  CONNECTION LOG VIEW
// ─────────────────────────────────────────────────────────────────────────

function ConnectionLogView({ address }: { address: string }) {
  const t = useT();
  const [history, setHistory] = useState<CallRecord[]>([]);
  const [filter, setFilter] = useState<'all' | 'missed' | 'incoming' | 'outgoing'>('all');

  useEffect(() => { setHistory(getCallHistory(address)); }, [address]);

  const filtered = filter === 'all' ? history : history.filter(c =>
    filter === 'missed' ? c.status === 'missed' : c.direction === filter
  );

  return (
    <div className="p-4 space-y-4 pb-20">
      <div className="flex gap-2 flex-wrap">
        {(['all', 'missed', 'incoming', 'outgoing'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 font-black text-[11px] uppercase border-2 border-black transition-colors ${filter === f ? 'bg-black text-white' : 'bg-white text-black hover:bg-zinc-100'}`}>{f}</button>
        ))}
      </div>
      {filtered.length === 0
        ? <div className="p-6 bg-white border-[3px] border-black text-center font-bold text-sm shadow-[4px_4px_0_0_#000]">{t("NO CONNECTIONS FOUND")}</div>
        : <BBlock>
            {filtered.map((call, i) => (
              <div key={call.id} className={`flex items-center justify-between p-4 ${i !== filtered.length - 1 ? 'border-b-[3px] border-black' : ''}`}>
                <div className="flex flex-col w-[70%]">
                  <span className="font-black text-[13px] truncate">{call.peerAddress}</span>
                  <span className={`text-[10px] font-bold uppercase ${call.status === 'missed' ? 'text-red-500' : 'text-zinc-500'}`}>
                    {call.direction} {call.type} • {call.status} • {new Date(call.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <Phone size={16} className={call.status === 'missed' ? 'text-red-500' : 'text-black'} />
                  {call.durationSeconds > 0 && <span className="text-[10px] font-black">{call.durationSeconds}s</span>}
                </div>
              </div>
            ))}
          </BBlock>
      }
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  DEVICES VIEW
// ─────────────────────────────────────────────────────────────────────────

function DevicesView() {
  const t = useT();
  const [sessions, setSessions] = React.useState<{ name: string; platform: string; network: string; status: string; isCurrent: boolean; lastSeen: string }[]>([]);

  useEffect(() => {
    // Build session list from available browser/storage data
    const now = new Date();
    const ua = navigator.userAgent;
    const platform = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'macOS' : /Win/.test(ua) ? 'Windows' : 'Unknown';
    const browser = /Chrome/.test(ua) && !/Edge/.test(ua) ? 'Chrome' : /Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : /Edge/.test(ua) ? 'Edge' : 'Browser';
    const current = { name: `${browser} on ${platform}`, platform, network: 'Current Browser Session', status: 'Active (This Device)', isCurrent: true, lastSeen: 'Just now' };

    // Pull any stored sessions from localStorage
    const stored: any[] = [];
    try {
      const raw = localStorage.getItem('hl_active_sessions');
      if (raw) stored.push(...JSON.parse(raw));
    } catch {}

    setSessions([current, ...stored.filter((s: any) => !s.isCurrent)]);

    // Write current session to localStorage so other devices can see it
    try {
      const existing: any[] = JSON.parse(localStorage.getItem('hl_active_sessions') || '[]');
      const updated = [{ name: current.name, platform, network: 'Remote Session', status: 'Active', isCurrent: false, lastSeen: now.toLocaleString() }, ...existing.filter((s: any) => !s.isCurrent).slice(0, 4)];
      localStorage.setItem('hl_active_sessions', JSON.stringify(updated));
    } catch {}
  }, []);

  return (
    <div className="p-4 space-y-6 pb-20">
      <button onClick={() => toast.info(t("To link a new device, open Ledger Chat on that device and sign in with the same wallet."))} className="w-full py-4 bg-[#2754d6] text-white font-black uppercase tracking-widest border-[3px] border-black shadow-[6px_6px_0_0_#000] active:translate-y-1">
        {t("Link New Device")}
      </button>
      <SH title={t("Active Sessions")} />
      <BBlock>
        {sessions.map((s, i) => (
          <div key={i} className={`p-4 flex flex-col ${i !== sessions.length - 1 ? 'border-b-[3px] border-black' : ''}`}>
            <span className="font-black text-[15px]">{s.name}</span>
            <span className="text-[11px] font-bold text-zinc-500">{s.platform} • {s.network}</span>
            <span className={`text-[11px] font-black uppercase mt-1 ${s.isCurrent ? 'text-green-600' : 'text-yellow-600'}`}>{s.status}</span>
            <span className="text-[10px] font-mono text-zinc-400 mt-0.5">{t("Last seen: {lastSeen}", { lastSeen: s.lastSeen })}</span>
          </div>
        ))}
      </BBlock>
      <button onClick={() => {
        try { localStorage.removeItem('hl_active_sessions'); } catch {}
        toast.success(t("All other sessions removed from record."));
        setSessions(prev => prev.filter(s => s.isCurrent));
      }} className="w-full py-4 bg-white text-red-600 font-black uppercase tracking-widest border-[3px] border-black shadow-[4px_4px_0_0_#000] active:translate-y-1">
        {t("Sign Out Other Devices")}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  WORKSPACES VIEW
// ─────────────────────────────────────────────────────────────────────────

function WorkspacesView({ s, update }: any) {
  const t = useT();
  const [folders, setFolders] = useState<string[]>(['Main Operations']);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    try { setFolders(JSON.parse(s.workspaces_json || '["Main Operations"]')); } catch(e) {}
  }, [s.workspaces_json]);

  const saveWorkspaces = async (updated: string[]) => {
    setFolders(updated);
    await update('workspaces_json', JSON.stringify(updated));
  };

  const addFolder = async () => {
    if (!newName.trim()) return;
    await saveWorkspaces([...folders, newName.trim()]);
    setNewName('');
  };

  const removeFolder = async (idx: number) => {
    if (idx === 0) { toast.error(t("Cannot remove the primary workspace.")); return; }
    await saveWorkspaces(folders.filter((_, i) => i !== idx));
  };

  return (
    <div className="p-4 space-y-6 pb-20">
      <div className="flex gap-2">
        <input type="text" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addFolder()} placeholder={t("New workspace name...")} className="flex-1 bg-white border-[3px] border-black p-3 text-[14px] font-bold outline-none focus:bg-yellow-50" />
        <button onClick={addFolder} className="bg-black text-white p-3 border-[3px] border-black hover:bg-zinc-800"><Plus size={18} /></button>
      </div>
      <BBlock>
        {folders.map((f, i) => (
          <div key={i} className={`p-4 flex items-center justify-between ${i !== folders.length - 1 ? 'border-b-[3px] border-black' : ''}`}>
            <span className="font-black uppercase truncate w-[70%]">{f}</span>
            <div className="flex items-center gap-2">
              {i === 0 && <span className="text-[10px] font-black text-zinc-400">{t("PRIMARY")}</span>}
              {i > 0 && (
                <button onClick={() => removeFolder(i)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={14} /></button>
              )}
            </div>
          </div>
        ))}
      </BBlock>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  AI GHOST MODE VIEW
// ─────────────────────────────────────────────────────────────────────────

function GhostModeView({ s, update }: any) {
  const t = useT();
  return (
    <div className="p-4 space-y-6 pb-20">
      <div className="bg-black border-[3px] border-black p-5 shadow-[6px_6px_0_0_#2754d6]">
        <div className="flex items-center gap-3 mb-2">
          <Bot size={24} className="text-[#2754d6]" />
          <span className="text-white font-black text-lg uppercase">{t("AI Ghost Mode")}</span>
        </div>
        <p className="text-zinc-400 text-[12px] font-bold">{t("When enabled, Ledger Chat will automatically reply to incoming messages on your behalf while you are away.")}</p>
      </div>

      <SH title={t("Auto-Reply")} />
      <BBlock>
        <TRow label={t("Ghost Auto-Reply")} checked={s.ghost_auto_reply} onChange={(v: boolean) => update('ghost_auto_reply', v)} noBorder />
      </BBlock>
      {s.ghost_auto_reply && (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500">{t("Reply Message")}</label>
          <textarea
            className="w-full bg-white border-[3px] border-black p-3 text-[13px] font-bold outline-none focus:bg-yellow-50 resize-none h-20"
            value={s.ghost_auto_reply_text}
            onChange={e => update('ghost_auto_reply_text', e.target.value)}
            maxLength={200}
          />
        </div>
      )}

      <SH title={t("Intelligence Tools")} />
      <BBlock>
        <TRow label={t("Tone Translator")} checked={s.tone_translator} onChange={(v: boolean) => update('tone_translator', v)} noBorder />
      </BBlock>
      <p className="text-[11px] font-bold text-zinc-500 ml-1">{t("Converts hostile outgoing messages to diplomatic language before sending.")}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  DEFI TOOLS VIEW
// ─────────────────────────────────────────────────────────────────────────

function DefiToolsView({ s, update }: any) {
  const t = useT();
  return (
    <div className="p-4 space-y-6 pb-20">
      <SH title={t("Chat Intelligence Overlays")} />
      <BBlock>
        <TRow label={t("$TICKER Price Widgets")} checked={s.ticker_widgets} onChange={(v: boolean) => update('ticker_widgets', v)} />
        <TRow label={t("Contract Risk Scanner")} checked={s.contract_scanner} onChange={(v: boolean) => update('contract_scanner', v)} />
        <TRow label={t("Smart Macros (/add, /send)")} checked={s.smart_macros} onChange={(v: boolean) => update('smart_macros', v)} />
        <TRow label={t("On-Chain Attestation Badge")} checked={s.show_attestation_badge} onChange={(v: boolean) => update('show_attestation_badge', v)} noBorder />
      </BBlock>
      <p className="text-[11px] font-bold text-zinc-500 ml-1">{t("These tools run natively inside the chat protocol without requiring external API calls.")}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  NETWORK PROTOCOL VIEW
// ─────────────────────────────────────────────────────────────────────────



function NetworkView({ s, update }: any) {
  const t = useT();
  return (
    <div className="p-4 space-y-4 pb-20">
      <SH title={t("Protocol Routing")} />
      <BBlock>
        {/* "MEV Protection" and "Tor Onion Routing" were removed on 23 October 2026:
            they were stored but changed nothing, so whoever switched them on believed
            they had a protection they did not have. */}
        <TRow label={t("Hide my IP address in calls")} checked={s.webrtc_ip_masking} onChange={(v: boolean) => update('webrtc_ip_masking', v)} noBorder />
      </BBlock>
      <SH title={t("Custom RPC")} />
      <BBlock>
        <div className="py-3">
          <input
            type="text"
            placeholder={t("https://mainnet.infura.io/v3/...")}
            value={s.custom_rpc_url || ''}
            onChange={e => update('custom_rpc_url', e.target.value)}
            className="w-full bg-transparent text-[13px] font-mono text-black outline-none placeholder:text-black/30"
          />
        </div>
      </BBlock>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────

function BBlock({ children }: { children: React.ReactNode }) {
  return <div className="w-full flex flex-col">{children}</div>;
}

function BItem({ icon, label, onClick, noBorder = false }: any) {
  return (
    <div onClick={onClick} className={`w-full flex items-center justify-between py-4 cursor-pointer group transition-colors ${noBorder ? '' : 'border-b border-black/8'}`}>
      <div className="flex items-center gap-4">
        <div className="text-black/40 group-hover:text-black transition-colors shrink-0">{icon}</div>
        <span className="text-[13px] font-bold uppercase tracking-wider text-black">{label}</span>
      </div>
      <ChevronRight size={14} className="text-black/20 group-hover:text-black transition-colors shrink-0" />
    </div>
  );
}

function TRow({ label, checked, onChange, noBorder = false }: any) {
  return (
    <div onClick={() => onChange(!checked)} className={`w-full flex items-center justify-between py-4 cursor-pointer ${noBorder ? '' : 'border-b border-black/8'}`}>
      <span className="text-[13px] font-bold uppercase tracking-wider text-black">{label}</span>
      <button
        className={`w-10 h-5 border border-black rounded-none flex items-center p-0.5 transition-colors shrink-0 ${checked ? 'bg-black' : 'bg-transparent'}`}
        onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      >
        <div className={`w-3.5 h-3.5 transition-transform ${checked ? 'translate-x-5 bg-white' : 'translate-x-0 bg-black'}`} />
      </button>
    </div>
  );
}

function CycleRow({ label, value, options, onChange, noBorder = false }: any) {
  const idx = options.indexOf(value);
  const next = () => onChange(options[(idx + 1) % options.length]);
  return (
    <div onClick={next} className={`w-full flex items-center justify-between py-4 cursor-pointer ${noBorder ? '' : 'border-b border-black/8'}`}>
      <span className="text-[13px] font-bold uppercase tracking-wider text-black">{label}</span>
      <span className="font-mono text-[11px] text-black/50 uppercase">{value}</span>
    </div>
  );
}

function BInput({ label, value, onChange, prefix }: any) {
  return (
    <div className="flex flex-col gap-2 w-full">
      <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-black/40">{label}</label>
      <div className="flex w-full border-b border-black/20 focus-within:border-black transition-colors">
        {prefix && <div className="text-black/40 font-mono text-sm pr-2 flex items-center">{prefix}</div>}
        <input type="text" value={value} onChange={e => onChange(e.target.value)} className="flex-1 bg-transparent py-3 text-[14px] font-bold outline-none text-black placeholder-black/20" />
      </div>
    </div>
  );
}

function SH({ title }: { title: string }) {
  return <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-black/40 block mb-3 mt-6 first:mt-0">{title}</span>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-black/5 last:border-0">
      <span className="text-[11px] font-mono uppercase tracking-wider text-black/40">{label}</span>
      <span className="text-[11px] font-bold uppercase text-black">{value}</span>
    </div>
  );
}






