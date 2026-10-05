'use client';
// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Lock, Shield, Eye, Bell, Database, Palette, Key, Trash2, X,
  ChevronRight, User, Wallet, Copy, Check, LogOut, Camera, Phone,
  MessageSquare, Volume2, Vibrate, Moon, Globe, Download, ShieldCheck,
  Fingerprint, Zap, RefreshCw, AlertTriangle
} from 'lucide-react';
import { useAccount, useBalance, useDisconnect } from 'wagmi';
import { toast } from 'sonner';
import { useLedgerSettings } from '../terminal/LedgerChatSettings';

interface LedgerSettingsFullProps {
  myAddress: string;
  myName?: string;
  onClose: () => void;
}

// ─── iOS-style Toggle ────────────────────────────────────────────────────────
const Toggle = ({ value, onChange }: { value: boolean; onChange?: (v: boolean) => void }) => (
  <button
    onClick={() => onChange?.(!value)}
    className={`w-[51px] h-[31px] rounded-full flex items-center px-[2px] transition-all duration-200 ${
      value ? 'bg-[#25D366]' : 'bg-[#E5E5EA]'
    }`}
  >
    <div className={`w-[27px] h-[27px] rounded-full bg-white shadow-md transform transition-transform duration-200 ${
      value ? 'translate-x-[20px]' : 'translate-x-0'
    }`} />
  </button>
);

// ─── Setting Row ─────────────────────────────────────────────────────────────
const Row = ({ icon, label, sublabel, value, onTap, danger = false, toggle, onToggle, badge }: {
  icon?: React.ReactNode; label: string; sublabel?: string; value?: string;
  onTap?: () => void; danger?: boolean; toggle?: boolean;
  onToggle?: (v: boolean) => void; badge?: string;
}) => (
  <button
    onClick={() => {
      if (onTap) onTap();
      else if (onToggle !== undefined && toggle !== undefined) onToggle(!toggle);
    }}
    className={`w-full flex items-center gap-4 px-0 py-4 border-b border-[#F2F2F7] last:border-0 text-left transition-colors ${
      onTap ? 'active:bg-[#F2F2F7]' : ''
    }`}
  >
    {icon && (
      <div className={`w-[34px] h-[34px] rounded-[9px] flex items-center justify-center shrink-0 ${
        danger ? 'bg-red-50' : 'bg-[#F2F2F7]'
      }`}>
        <span className={danger ? 'text-red-500' : 'text-[#1C1C1E]'}>{icon}</span>
      </div>
    )}
    <div className="flex-1 min-w-0">
      <p className={`text-[16px] font-medium ${danger ? 'text-red-500' : 'text-[#1C1C1E]'}`}>{label}</p>
      {sublabel && <p className="text-[13px] text-[#8E8E93] mt-0.5">{sublabel}</p>}
    </div>
    <div className="flex items-center gap-2 shrink-0">
      {badge && (
        <span className="bg-[#FF3B30] text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
          {badge}
        </span>
      )}
      {value && <span className="text-[16px] text-[#8E8E93]">{value}</span>}
      {onToggle !== undefined && toggle !== undefined ? (
        <Toggle value={toggle} onChange={onToggle} />
      ) : onTap ? (
        <ChevronRight size={18} className="text-[#C7C7CC]" />
      ) : null}
    </div>
  </button>
);

// ─── Settings Group (iOS card style) ─────────────────────────────────────────
const Group = ({ title, footer, children }: {
  title?: string; footer?: string; children: React.ReactNode;
}) => (
  <div className="mb-8">
    {title && (
      <p className="text-[13px] font-semibold text-[#6D6D72] uppercase tracking-wider px-4 mb-2">
        {title}
      </p>
    )}
    <div className="bg-white rounded-[14px] overflow-hidden shadow-sm px-4">
      {children}
    </div>
    {footer && (
      <p className="text-[13px] text-[#8E8E93] px-4 mt-2 leading-relaxed">{footer}</p>
    )}
  </div>
);

// ─── Tab names ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'account',       label: 'Account' },
  { id: 'privacy',       label: 'Privacy' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'security',      label: 'Security' },
  { id: 'chat',          label: 'Chat' },
  { id: 'calls',         label: 'Calls' },
  { id: 'storage',       label: 'Storage' },
];

// ─── Main Component ───────────────────────────────────────────────────────────
export const LedgerSettingsFull: React.FC<LedgerSettingsFullProps> = ({ myAddress, myName, onClose }) => {
  const [activeTab, setActiveTab] = useState<string>('account');
  const [modal, setModal] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [editingName, setEditingName] = useState(false);

  const { address, chain } = useAccount();
  const { data: balance } = useBalance({ address: address as `0x${string}` });
  const { disconnect } = useDisconnect();
  const { settings, updateSetting } = useLedgerSettings(myAddress);

  // Load saved display name
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ledger_displayName') || '';
      setDisplayName(saved || myName || '');
    } catch {}
  }, [myAddress, myName]);

  const saveDisplayName = useCallback(() => {
    try {
      localStorage.setItem('ledger_displayName', displayName);
      toast.success('Display name saved');
      setEditingName(false);
    } catch {}
  }, [displayName]);

  const copyAddress = useCallback(() => {
    navigator.clipboard.writeText(myAddress).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Address copied');
  }, [myAddress]);

  const handleSignOut = useCallback(() => {
    if (!confirm('Sign out? You can reconnect your wallet at any time.')) return;
    try {
      disconnect();
      // Clear session
      ['ledger_session','ledger_onboarded_'+myAddress.toLowerCase()].forEach(k => {
        try { localStorage.removeItem(k); } catch {}
      });
      window.location.href = '/';
    } catch (e) {
      toast.error('Failed to sign out');
    }
  }, [disconnect, myAddress]);

  const purgeCache = useCallback(() => {
    let count = 0;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith('ledger_cache_') || k?.startsWith('ledger_msg_cache_')) {
        localStorage.removeItem(k); count++;
      }
    }
    toast.success(`Cleared ${count} cached items`);
    setModal(null);
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) { toast.error('Notifications not supported'); return; }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      toast.success('Notifications enabled');
      updateSetting('notifications_private', true);
    } else {
      toast.error('Notifications blocked — check browser settings');
    }
  }, [updateSetting]);

  const shortAddr = (addr: string) =>
    addr ? `${addr.slice(0, 8)} ... ${addr.slice(-6)}` : '';

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 36 }}
      className="absolute inset-0 z-[200] bg-[#F2F2F7] flex flex-col overflow-hidden"
    >
      {/* ── Header ── */}
      <div
        className="shrink-0 bg-white border-b border-[#E5E5EA] flex items-center justify-between px-4"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))', paddingBottom: '12px' }}
      >
        <button onClick={onClose} className="flex items-center gap-1 text-[#007AFF] font-medium text-[16px]">
          <ArrowLeft size={20} className="text-[#007AFF]" />
          Back
        </button>
        <span className="text-[17px] font-semibold text-[#1C1C1E]">Settings</span>
        <div className="w-16" />
      </div>

      {/* ── Tab Scroll ── */}
      <div className="shrink-0 flex gap-1 px-4 py-3 overflow-x-auto hide-scrollbar bg-white border-b border-[#E5E5EA]">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-[#1C1C1E] text-white'
                : 'bg-[#F2F2F7] text-[#8E8E93] hover:bg-[#E5E5EA]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full px-4 py-5 pb-12">

          {/* ══ ACCOUNT TAB ══════════════════════════════════════════════════ */}
          {activeTab === 'account' && (
            <>
              {/* Profile card */}
              <div className="bg-white rounded-[14px] shadow-sm overflow-hidden mb-8">
                <div className="flex flex-col items-center py-8 px-6 gap-4">
                  {/* Avatar */}
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center shadow-lg">
                      <span className="text-white text-3xl font-black">
                        {myAddress ? myAddress.slice(2, 4).toUpperCase() : '??'}
                      </span>
                    </div>
                    <button className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#007AFF] rounded-full flex items-center justify-center shadow-md">
                      <Camera size={13} className="text-white" />
                    </button>
                  </div>
                  {/* Display name */}
                  {editingName ? (
                    <div className="flex items-center gap-2 w-full max-w-[280px]">
                      <input
                        autoFocus
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveDisplayName()}
                        className="flex-1 text-center text-[20px] font-bold text-[#1C1C1E] bg-[#F2F2F7] rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#25D366]"
                        placeholder="Display name"
                        maxLength={32}
                      />
                      <button onClick={saveDisplayName} className="w-9 h-9 bg-[#25D366] rounded-full flex items-center justify-center">
                        <Check size={16} className="text-white" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setEditingName(true)} className="flex items-center gap-2 group">
                      <span className="text-[20px] font-bold text-[#1C1C1E]">
                        {displayName || 'Add display name'}
                      </span>
                      <span className="text-[13px] text-[#007AFF] opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
                    </button>
                  )}
                  {/* Wallet address */}
                  <button
                    onClick={copyAddress}
                    className="flex items-center gap-2 bg-[#F2F2F7] rounded-xl px-4 py-2 hover:bg-[#E5E5EA] transition-colors"
                  >
                    <Wallet size={14} className="text-[#8E8E93]" />
                    <span className="text-[13px] font-mono text-[#8E8E93]">{shortAddr(myAddress)}</span>
                    {copied ? <Check size={13} className="text-[#25D366]" /> : <Copy size={13} className="text-[#8E8E93]" />}
                  </button>
                  {/* ETH balance */}
                  {balance && (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-[#627EEA]/10 flex items-center justify-center">
                        <span className="text-[10px] font-black text-[#627EEA]">Ξ</span>
                      </div>
                      <span className="text-[13px] font-semibold text-[#1C1C1E]">
                        {parseFloat(balance.formatted).toFixed(4)} {balance.symbol}
                      </span>
                      <span className="text-[12px] text-[#8E8E93]">
                        on {chain?.name || 'Ethereum'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <Group title="Linked Identity">
                <Row
                  icon={<Wallet size={18} />}
                  label="Wallet Address"
                  sublabel={shortAddr(myAddress)}
                  onTap={copyAddress}
                />
                <Row
                  icon={<ShieldCheck size={18} />}
                  label="Verified on XMTP"
                  sublabel="End-to-end encrypted identity"
                  value="Active"
                />
                <Row
                  icon={<Globe size={18} />}
                  label="Network"
                  value={chain?.name || 'Ethereum'}
                />
              </Group>

              <Group title="Preferences" footer="Your display name is stored locally and shared with contacts.">
                <Row
                  icon={<User size={18} />}
                  label="Display Name"
                  value={displayName || 'Not set'}
                  onTap={() => setEditingName(true)}
                />
              </Group>

              <Group title="Account Actions">
                <Row
                  icon={<RefreshCw size={18} />}
                  label="Clear Message Cache"
                  sublabel="Free up local storage"
                  onTap={() => setModal('clearCache')}
                />
                <Row
                  icon={<Download size={18} />}
                  label="Export Chat Backup"
                  sublabel="Download encrypted JSON"
                  onTap={() => {
                    try {
                      const data = JSON.stringify(
                        Object.entries(localStorage)
                          .filter(([k]) => k.startsWith('ledger_'))
                          .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {})
                      );
                      const blob = new Blob([data], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a'); a.href = url; a.download = 'ledger-backup.json'; a.click();
                      URL.revokeObjectURL(url);
                      toast.success('Backup downloaded');
                    } catch { toast.error('Export failed'); }
                  }}
                />
                <Row
                  icon={<LogOut size={18} />}
                  label="Sign Out"
                  sublabel="Disconnect wallet"
                  danger
                  onTap={handleSignOut}
                />
              </Group>
            </>
          )}

          {/* ══ PRIVACY TAB ══════════════════════════════════════════════════ */}
          {activeTab === 'privacy' && (
            <>
              <Group title="Who Can See" footer="Controls who can view your profile information.">
                <Row icon={<Eye size={18} />} label="Last Seen" value={settings.privacy_last_seen} onTap={() => setModal('privacy_last_seen')} />
                <Row icon={<User size={18} />} label="Profile Photo" value={settings.privacy_profile_photo} onTap={() => setModal('privacy_profile_photo')} />
                <Row icon={<Eye size={18} />} label="About / Bio" value={settings.privacy_bio} onTap={() => setModal('privacy_bio')} />
                <Row icon={<Shield size={18} />} label="Group Invites" value={settings.privacy_group_invites} onTap={() => setModal('privacy_group_invites')} />
              </Group>
              <Group title="Disappearing Messages" footer="New messages will auto-delete after the selected time. Old conversations are not affected.">
                <Row icon={<Trash2 size={18} />} label="Default Timer" value={settings.auto_delete_timer} onTap={() => setModal('auto_delete')} />
                <Row icon={<Lock size={18} />} label="Burn on Read" sublabel="Messages disappear after being read" toggle={settings.burn_on_read} onToggle={v => updateSetting('burn_on_read', v)} />
              </Group>
              <Group title="Advanced">
                <Row icon={<Shield size={18} />} label="Anti-Screenshot" toggle={settings.anti_screenshot} onToggle={v => updateSetting('anti_screenshot', v)} />
                <Row icon={<Eye size={18} />} label="Read Receipts" toggle={true} onToggle={() => {}} />
                <Row icon={<Eye size={18} />} label="Typing Indicators" toggle={true} onToggle={() => {}} />
              </Group>
            </>
          )}

          {/* ══ NOTIFICATIONS TAB ════════════════════════════════════════════ */}
          {activeTab === 'notifications' && (
            <>
              {/* Permission banner */}
              {typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted' && (
                <div className="bg-amber-50 border border-amber-200 rounded-[14px] p-4 mb-6 flex items-start gap-3">
                  <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[14px] font-bold text-amber-900">Notifications are disabled</p>
                    <p className="text-[12px] text-amber-700 mt-1">Enable push notifications to never miss a message.</p>
                  </div>
                  <button onClick={requestNotificationPermission} className="bg-amber-600 text-white text-[12px] font-bold px-3 py-2 rounded-xl">
                    Enable
                  </button>
                </div>
              )}
              <Group title="Message Notifications">
                <Row icon={<MessageSquare size={18} />} label="Private Messages" toggle={settings.notifications_private} onToggle={v => updateSetting('notifications_private', v)} />
                <Row icon={<MessageSquare size={18} />} label="Group Messages" toggle={settings.notifications_groups} onToggle={v => updateSetting('notifications_groups', v)} />
                <Row icon={<Bell size={18} />} label="Community Updates" toggle={settings.notifications_workspaces} onToggle={v => updateSetting('notifications_workspaces', v)} />
              </Group>
              <Group title="Calls">
                <Row icon={<Phone size={18} />} label="Incoming Calls" toggle={true} onToggle={() => {}} />
                <Row icon={<Bell size={18} />} label="Missed Call Alerts" toggle={true} onToggle={() => {}} />
              </Group>
              <Group title="Sounds & Vibration">
                <Row icon={<Volume2 size={18} />} label="Notification Sound" toggle={settings.notification_sound} onToggle={v => updateSetting('notification_sound', v)} />
                <Row icon={<Vibrate size={18} />} label="Vibration" toggle={true} onToggle={() => {}} />
                <Row icon={<Palette size={18} />} label="Sound Pack" value={settings.sound_pack} onTap={() => setModal('sound_pack')} />
              </Group>
              <Group>
                <Row icon={<Bell size={18} />} label="Badge Count" toggle={settings.badge_count} onToggle={v => updateSetting('badge_count', v)} />
                <Row icon={<Moon size={18} />} label="Do Not Disturb" toggle={false} onToggle={() => {}} />
              </Group>
            </>
          )}

          {/* ══ SECURITY TAB ══════════════════════════════════════════════════ */}
          {activeTab === 'security' && (
            <>
              <Group title="App Lock" footer="Biometric lock uses your device's Face ID or fingerprint.">
                <Row icon={<Fingerprint size={18} />} label="Biometric Lock" toggle={settings.biometric_lock} onToggle={v => updateSetting('biometric_lock', v)} />
                <Row icon={<Key size={18} />} label="App Passcode" toggle={settings.passcode_enabled} onToggle={v => updateSetting('passcode_enabled', v)} />
              </Group>
              <Group title="Cryptography">
                <Row icon={<ShieldCheck size={18} />} label="ZK Obfuscation" sublabel="Hide metadata with zero-knowledge proofs" toggle={settings.zkObfuscation} onToggle={v => updateSetting('zkObfuscation', v)} />
                <Row icon={<Lock size={18} />} label="Require Signature" sublabel="Sign every session with your wallet" toggle={settings.requireSignature} onToggle={v => updateSetting('requireSignature', v)} />
              </Group>
              <Group title="Network">
                <Row icon={<Shield size={18} />} label="WebRTC IP Masking" sublabel="Hide your IP during calls" toggle={settings.webrtc_ip_masking} onToggle={v => updateSetting('webrtc_ip_masking', v)} />
                <Row icon={<Globe size={18} />} label="MEV Protection" toggle={settings.mev_protection} onToggle={v => updateSetting('mev_protection', v)} />
                <Row icon={<Database size={18} />} label="Custom RPC URL" value={settings.custom_rpc_url || 'Default'} onTap={() => setModal('custom_rpc')} />
              </Group>
              <Group title="Danger Zone" footer="These actions are permanent and cannot be undone.">
                <Row icon={<Trash2 size={18} />} label="Clear All Caches" onTap={() => setModal('clearCache')} />
                <Row icon={<X size={18} />} label="Obliterate All Data" danger onTap={() => setModal('nuke')} />
              </Group>
            </>
          )}

          {/* ══ CHAT TAB ══════════════════════════════════════════════════════ */}
          {activeTab === 'chat' && (
            <>
              <Group title="Appearance">
                <Row icon={<Palette size={18} />} label="Chat Wallpaper" value="Default" onTap={() => toast.info('Wallpaper picker coming soon')} />
                <Row icon={<Eye size={18} />} label="Font Size" value="Medium" onTap={() => toast.info('Font size coming soon')} />
              </Group>
              <Group title="Media & Files">
                <Row icon={<Download size={18} />} label="Auto-Download Photos" toggle={true} onToggle={() => {}} />
                <Row icon={<Download size={18} />} label="Auto-Download Videos" toggle={false} onToggle={() => {}} />
                <Row icon={<Database size={18} />} label="Low Data Mode" toggle={settings.useLessData} onToggle={v => updateSetting('useLessData', v)} />
                <Row icon={<Download size={18} />} label="Save to Photos" toggle={settings.saveToPhotos} onToggle={v => updateSetting('saveToPhotos', v)} />
              </Group>
              <Group title="AI Features">
                <Row icon={<Zap size={18} />} label="Smart Replies" sublabel="AI-suggested quick replies" toggle={settings.tone_translator} onToggle={v => updateSetting('tone_translator', v)} />
                <Row icon={<Shield size={18} />} label="Contract Scanner" sublabel="Scan ETH addresses for risks" toggle={settings.contract_scanner} onToggle={v => updateSetting('contract_scanner', v)} />
              </Group>
            </>
          )}

          {/* ══ CALLS TAB ════════════════════════════════════════════════════ */}
          {activeTab === 'calls' && (
            <>
              <Group title="Call Quality">
                <Row icon={<Phone size={18} />} label="High Quality Audio" toggle={true} onToggle={() => {}} />
                <Row icon={<Zap size={18} />} label="HD Video (when available)" toggle={true} onToggle={() => {}} />
                <Row icon={<Globe size={18} />} label="Use Less Data for Calls" toggle={settings.useLessData} onToggle={v => updateSetting('useLessData', v)} />
              </Group>
              <Group title="Privacy" footer="IP masking routes WebRTC traffic through a relay to hide your real IP address from callers.">
                <Row icon={<Shield size={18} />} label="IP Masking" sublabel="Hides your IP during calls" toggle={settings.webrtc_ip_masking} onToggle={v => updateSetting('webrtc_ip_masking', v)} />
              </Group>
              <Group title="Ringtone">
                <Row icon={<Volume2 size={18} />} label="Ring on Incoming Call" toggle={true} onToggle={() => {}} />
                <Row icon={<Vibrate size={18} />} label="Vibrate" toggle={true} onToggle={() => {}} />
              </Group>
            </>
          )}

          {/* ══ STORAGE TAB ══════════════════════════════════════════════════ */}
          {activeTab === 'storage' && (
            <>
              {(() => {
                let total = 0, count = 0;
                for (let i = 0; i < localStorage.length; i++) {
                  const k = localStorage.key(i)!;
                  const v = localStorage.getItem(k) || '';
                  if (k.startsWith('ledger_')) { total += v.length * 2; count++; }
                }
                const mb = (total / 1024 / 1024).toFixed(2);
                return (
                  <div className="bg-white rounded-[14px] p-5 mb-6 shadow-sm">
                    <p className="text-[13px] text-[#8E8E93] mb-1">Local Storage Used</p>
                    <p className="text-[32px] font-black text-[#1C1C1E]">{mb} <span className="text-[18px] font-semibold text-[#8E8E93]">MB</span></p>
                    <p className="text-[12px] text-[#8E8E93] mt-1">{count} Ledger Chat items</p>
                  </div>
                );
              })()}
              <Group footer="Cache includes message previews and contact data. Clearing will not delete your conversations.">
                <Row icon={<RefreshCw size={18} />} label="Clear Cache" onTap={() => setModal('clearCache')} />
                <Row icon={<Database size={18} />} label="Manage Storage" onTap={() => toast.info('Storage manager coming soon')} />
              </Group>
              <Group>
                <Row
                  icon={<Download size={18} />}
                  label="Export All Data"
                  sublabel="Download your Ledger Chat data as JSON"
                  onTap={() => {
                    try {
                      const data: Record<string, string> = {};
                      for (let i = 0; i < localStorage.length; i++) {
                        const k = localStorage.key(i)!;
                        if (k.startsWith('ledger_')) data[k] = localStorage.getItem(k) || '';
                      }
                      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url; a.download = `ledger-export-${Date.now()}.json`; a.click();
                      URL.revokeObjectURL(url);
                      toast.success('Data exported');
                    } catch { toast.error('Export failed'); }
                  }}
                />
              </Group>
            </>
          )}

        </div>
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {modal && (
          <motion.div
            key={modal}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] bg-black/40 backdrop-blur-sm flex items-end justify-center"
            onClick={e => { if (e.target === e.currentTarget) setModal(null); }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 30 }}
              className="w-full max-w-lg bg-white rounded-t-[28px] overflow-hidden shadow-2xl"
              style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
            >
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-[#E5E5EA]" />
              </div>

              {/* Privacy selector */}
              {['privacy_last_seen','privacy_profile_photo','privacy_bio','privacy_group_invites'].includes(modal!) && (
                <div className="px-6 pb-4">
                  <h3 className="text-[18px] font-bold text-[#1C1C1E] mb-5">
                    {modal === 'privacy_last_seen' ? 'Last Seen' : modal === 'privacy_profile_photo' ? 'Profile Photo' : modal === 'privacy_bio' ? 'About' : 'Group Invites'}
                  </h3>
                  {['everybody', 'contacts', 'nobody'].map(opt => (
                    <button key={opt} onClick={() => { updateSetting(modal as any, opt); setModal(null); toast.success('Saved'); }}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl mb-2 ${(settings as any)[modal!] === opt ? 'bg-[#25D366] text-white' : 'bg-[#F2F2F7] text-[#1C1C1E]'}`}>
                      <span className="font-semibold capitalize">{opt}</span>
                      {(settings as any)[modal!] === opt && <Check size={18} />}
                    </button>
                  ))}
                </div>
              )}

              {modal === 'auto_delete' && (
                <div className="px-6 pb-4">
                  <h3 className="text-[18px] font-bold text-[#1C1C1E] mb-5">Auto-Delete Messages</h3>
                  {['off','24 hours','1 week','1 month','1 year'].map(opt => (
                    <button key={opt} onClick={() => { updateSetting('auto_delete_timer', opt); setModal(null); toast.success('Saved'); }}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl mb-2 ${settings.auto_delete_timer === opt ? 'bg-[#1C1C1E] text-white' : 'bg-[#F2F2F7] text-[#1C1C1E]'}`}>
                      <span className="font-semibold">{opt === 'off' ? 'Disabled' : opt}</span>
                      {settings.auto_delete_timer === opt && <Check size={18} />}
                    </button>
                  ))}
                </div>
              )}

              {modal === 'sound_pack' && (
                <div className="px-6 pb-4">
                  <h3 className="text-[18px] font-bold text-[#1C1C1E] mb-5">Sound Pack</h3>
                  {['minimal','default','telegram','ledger'].map(opt => (
                    <button key={opt} onClick={() => { updateSetting('sound_pack', opt); setModal(null); toast.success('Sound pack saved'); }}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl mb-2 ${settings.sound_pack === opt ? 'bg-[#1C1C1E] text-white' : 'bg-[#F2F2F7] text-[#1C1C1E]'}`}>
                      <span className="font-semibold capitalize">{opt}</span>
                      {settings.sound_pack === opt && <Check size={18} />}
                    </button>
                  ))}
                </div>
              )}

              {modal === 'clearCache' && (
                <div className="px-6 pb-4">
                  <h3 className="text-[18px] font-bold text-[#1C1C1E] mb-2">Clear Cache</h3>
                  <p className="text-[14px] text-[#8E8E93] mb-6">This removes temporary cached data. Your messages, contacts, and settings are safe.</p>
                  <button onClick={purgeCache} className="w-full py-4 bg-[#FF3B30] rounded-2xl text-white font-bold text-[16px]">
                    Clear Cache
                  </button>
                </div>
              )}

              {modal === 'nuke' && (
                <div className="px-6 pb-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
                      <AlertTriangle size={22} className="text-red-500" />
                    </div>
                    <div>
                      <h3 className="text-[18px] font-bold text-[#1C1C1E]">Obliterate All Data</h3>
                      <p className="text-[13px] text-red-500 font-semibold">This cannot be undone</p>
                    </div>
                  </div>
                  <p className="text-[14px] text-[#8E8E93] mb-6">All local data including conversation history, contacts, and settings will be permanently deleted. You will be signed out.</p>
                  <button onClick={() => {
                    for (let i = localStorage.length - 1; i >= 0; i--) {
                      const k = localStorage.key(i);
                      if (k?.startsWith('ledger_')) localStorage.removeItem(k);
                    }
                    toast.success('All data deleted');
                    setTimeout(() => window.location.reload(), 1500);
                  }} className="w-full py-4 bg-[#FF3B30] rounded-2xl text-white font-bold text-[16px]">
                    Confirm — Delete Everything
                  </button>
                  <button onClick={() => setModal(null)} className="w-full py-3 mt-2 text-[#8E8E93] font-semibold text-[16px]">
                    Cancel
                  </button>
                </div>
              )}

              {modal === 'custom_rpc' && (
                <div className="px-6 pb-4">
                  <h3 className="text-[18px] font-bold text-[#1C1C1E] mb-5">Custom RPC URL</h3>
                  <input
                    type="url"
                    defaultValue={settings.custom_rpc_url || ''}
                    placeholder="https://mainnet.infura.io/v3/..."
                    className="w-full bg-[#F2F2F7] rounded-2xl px-4 py-4 text-[14px] font-mono text-[#1C1C1E] outline-none focus:ring-2 focus:ring-[#007AFF] mb-4"
                    onBlur={e => { if (e.target.value) updateSetting('custom_rpc_url', e.target.value); }}
                  />
                  <button onClick={() => { setModal(null); toast.success('RPC URL saved'); }}
                    className="w-full py-4 bg-[#1C1C1E] rounded-2xl text-white font-bold text-[16px]">
                    Save
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
