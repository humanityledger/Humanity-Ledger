'use client';
// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Lock, Shield, Eye, Bell, Database, Palette, Key, Trash2, X,
  ChevronRight, User, Wallet, Copy, Check, LogOut, Camera, Phone,
  MessageSquare, Volume2, Vibrate, Moon, Globe, Download, ShieldCheck,
  Fingerprint, Zap, RefreshCw, AlertTriangle, Smartphone, Monitor,
  QrCode, Link, Unlink, Sun, Sliders, HardDrive, Archive, Clock,
  Mic, Video, WifiOff, BellOff, EyeOff, FileText, Star, Hash,
  ChevronDown, Info, Send, ArrowDownToLine, ArrowUpFromLine, Cpu, ChevronLeft
} from 'lucide-react';
import { useAccount, useBalance, useDisconnect, useSignMessage } from 'wagmi';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { useLedgerSettings } from '../terminal/LedgerChatSettings';
import { usePushNotifications } from '@/lib/push/usePushNotifications';
import { completeSessionHandshake } from '@/lib/scan/sessionHandshake';
import { getShieldedBalances, resolveZkTag, registerZkTag, validateZkHandle, syncBalanceFromAztec, getZkTransactionHistory, clearZkTransactionHistory, ZkShieldedBalance, AZTEC_MAINNET_RPC } from '@/lib/zk/zkMoney';
import { deriveAztecKeySet } from '@/lib/zk/aztecPxe';
import { ZkPrivacyScore } from '@/components/zk/ZkPrivacyScore';
import { ZkShieldModal } from '@/components/zk/ZkShieldModal';
import { ZkSettingsPanel } from '@/components/zk/ZkSettingsPanel';
import { chatTextPx, textSizeLabel, DEFAULT_TEXT_SIZE_LEVEL } from '@/lib/chat/textSize';
import { useSystemSignOut } from '@/hooks/useSystemSignOut';
import { exportableLocalStorage } from '@/lib/settings/exportSafety';
import { wipeLocalChatData } from '@/lib/settings/localWipe';
import { loadBlockList, saveBlockList } from '@/lib/chat/blockList';
import { downscaleAvatar, pushPublicProfile } from '@/lib/chat/profileSync';

function downloadSettingsBackup(): void {
  const data = exportableLocalStorage();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `ledger-settings-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface LedgerSettingsFullProps {
  myAddress: string;
  myName?: string;
  onClose: () => void;
}

// ─── Executive Swiss Precision Toggle (Serious, Elegant, No Tacky Wobble) ────────────
const Toggle = ({ value, onChange, disabled = false }: { value: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) => (
  <button
    type="button"
    role="switch"
    aria-checked={value}
    disabled={disabled}
    onClick={(e) => {
      e.stopPropagation();
      onChange?.(!value);
    }}
    className={`relative inline-flex h-[24px] w-[44px] shrink-0 cursor-pointer items-center rounded-full p-[2px] transition-colors duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] focus:outline-none border border-black/[0.08] ${
      disabled ? 'opacity-40 cursor-not-allowed' : ''
    } ${value ? 'bg-[#15171c] shadow-[inset_0_1px_2px_rgba(0,0,0,0.18)]' : 'bg-[#E4E4E7] shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]'}`}
  >
    <motion.span
      layout
      transition={{
        type: 'spring',
        stiffness: 700,
        damping: 42,
        mass: 0.5
      }}
      animate={{
        x: value ? 20 : 0,
      }}
      className="pointer-events-none relative inline-flex items-center justify-center h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.2),0_1px_1px_rgba(0,0,0,0.1)]"
    >
      {/* Precision Micro-Indicator Dot */}
      <span className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${value ? 'bg-[#15171c]' : 'bg-[#D4D4D8]'}`} />
    </motion.span>
  </button>
);

// ─── Setting Row (Clean Minimalist Typography — No Cluttered Logos/Icons) ────────
const Row = ({
  label, sublabel, value, onTap, danger = false,
  toggle, onToggle, badge, disabled = false
}: {
  icon?: React.ReactNode; label: string; sublabel?: string; value?: string;
  onTap?: () => void; danger?: boolean; toggle?: boolean;
  onToggle?: (v: boolean) => void; badge?: string; disabled?: boolean;
}) => {
  const hasToggle = onToggle !== undefined && toggle !== undefined;

  return (
    <div
      role={onTap ? 'button' : undefined}
      tabIndex={onTap && !disabled ? 0 : undefined}
      onClick={() => {
        if (disabled) return;
        if (onTap) onTap();
        else if (hasToggle) onToggle(!toggle);
      }}
      onKeyDown={(e) => {
        if (!disabled && onTap && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onTap();
        }
      }}
      className={`w-full flex items-center justify-between gap-3.5 px-0 py-3.5 border-b border-[#f2f4f7] last:border-0 text-left transition-colors select-none ${
        disabled ? 'opacity-40 cursor-not-allowed' : (onTap || hasToggle) ? 'hover:bg-[#f2f4f7]/50 active:bg-[#f2f4f7] cursor-pointer' : 'cursor-default'
      }`}
    >
      <div className="flex-1 min-w-0 pr-2">
        <p className={`text-[15px] font-medium leading-tight ${danger ? 'text-[#d93036]' : 'text-[#15171c]'}`}>{label}</p>
        {sublabel && <p className="text-[12px] text-[#727a88] mt-1 leading-snug">{sublabel}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {badge && (
          <span className="bg-[#e5484d] text-white text-[12.5px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
            {badge}
          </span>
        )}
        {value && <span className="text-[14px] text-[#727a88] font-normal">{value}</span>}
        {hasToggle ? (
          <Toggle value={toggle} onChange={onToggle} disabled={disabled} />
        ) : onTap ? (
          <ChevronRight size={16} className="text-[#c9ced6]" />
        ) : null}
      </div>
    </div>
  );
};


// ─── Settings Group ───────────────────────────────────────────────────────────
const Group = ({ title, footer, children }: {
  title?: string; footer?: string; children: React.ReactNode;
}) => (
  <div className="mb-6">
    {title && (
      <p className="text-[12px] font-semibold text-[#727a88] px-1 mb-1.5">
        {title}
      </p>
    )}
    <div className="bg-white rounded-[14px] overflow-hidden shadow-sm px-4">
      {children}
    </div>
    {footer && (
      <p className="text-[12px] text-[#727a88] px-1 mt-2 leading-relaxed">{footer}</p>
    )}
  </div>
);

// ─── Real ISO-Compliant QR Code (Scannable by Any Camera / Phone) ─────────────
const DeviceQRCode = ({ data, size = 200 }: { data: string; size?: number }) => (
  <div className="p-3 bg-white rounded-[16px] shadow-sm flex items-center justify-center">
    <QRCodeSVG
      value={data || 'https://humanidfi.com/chat'}
      size={size}
      level="M"
      includeMargin={false}
      className="rounded-[10px]"
    />
  </div>
);

// Settings grouped as Swiss-precision typography sections (No Cluttered Icons)
const SETTINGS_SECTIONS = [
  {
    title: 'MY ACCOUNT',
    items: [
      { id: 'account', label: 'Profile & Devices', sublabel: 'Name, photo, wallet address' },
    ],
  },
  {
    title: 'MESSAGES',
    items: [
      { id: 'notifications', label: 'Notifications', sublabel: 'Sounds, vibration, alerts' },
      { id: 'chat', label: 'Chat Appearance', sublabel: 'Wallpaper, typography, bubbles' },
    ],
  },
  {
    title: 'PRIVACY & SECURITY',
    items: [
      { id: 'privacy', label: 'Privacy', sublabel: 'Who can see your info' },
      { id: 'security', label: 'Security', sublabel: 'Sessions, authentication' },
    ],
  },
  {
    title: 'CALLS',
    items: [
      { id: 'calls', label: 'Calls', sublabel: 'Camera, microphone, audio quality' },
    ],
  },
  {
    title: 'STORAGE',
    items: [
      { id: 'storage', label: 'Storage & Data', sublabel: 'Cache, network usage' },
    ],
  },
  {
    title: 'ADVANCED',
    items: [
      { id: 'payments', label: 'Payments & Crypto', sublabel: 'Wallet, ZK identity, RPC' },
    ],
  },
];

const BlockListModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [blocked, setBlocked] = useState<string[] | null>(null);
  useEffect(() => {
    // Same list the chat enforces (vault `ledger_blocked`).
    let alive = true;
    loadBlockList().then(list => { if (alive) setBlocked(list); }).catch(() => { if (alive) setBlocked([]); });
    return () => { alive = false; };
  }, []);
  const unblock = (addr: string) => {
    const updated = (blocked || []).filter(a => a !== addr);
    setBlocked(updated);
    saveBlockList(updated).then(() => toast.success('Unblocked')).catch(() => toast.error('Could not unblock. Try again.'));
  };
  return (
    <div className="px-6 pb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[20px] font-semibold text-[#15171c]">Blocked addresses</h3>
        <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-[#f2f4f7] flex items-center justify-center"><X size={16} className="text-[#727a88]" /></button>
      </div>
      {blocked === null ? (
        <p className="text-[14px] text-[#727a88] text-center py-10">Loading…</p>
      ) : blocked.length === 0 ? (
        <div className="py-12 flex flex-col items-center gap-3 text-[#727a88]">
          <Shield size={40} className="opacity-30" />
          <p className="text-[15px] font-medium">No blocked addresses</p>
          <p className="text-[13px] text-center">Blocked wallets can't message or call you. Block someone from their chat info.</p>
        </div>
      ) : (
        <div className="max-h-[320px] overflow-y-auto">
          {blocked.map(addr => (
            <div key={addr} className="flex items-center justify-between bg-[#f2f4f7] rounded-2xl px-4 py-3 mb-2">
              <p className="text-[14px] font-semibold text-[#15171c] tabular-nums" title={addr}>{addr.length > 16 ? `${addr.slice(0, 8)}…${addr.slice(-6)}` : addr}</p>
              <button type="button" onClick={() => unblock(addr)} className="text-[13px] text-[#15171c] font-semibold px-3 py-1.5 rounded-xl hover:bg-black/5">Unblock</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Modal Subcomponents (Extracting out of render to adhere to React Hook Rules) ─────
const CustomRpcModalContent: React.FC<{
  currentRpc: string;
  onSave: (url: string) => void;
  onClose: () => void;
}> = ({ currentRpc, onSave, onClose }) => {
  const [rpcVal, setRpcVal] = useState(currentRpc || '');
  const [rpcErr, setRpcErr] = useState<string | null>(null);

  return (
    <div className="px-6 pb-6">
      <h3 className="text-[20px] font-semibold text-[#15171c] mb-5">Custom RPC URL</h3>
      <p className="text-[13px] text-[#727a88] mb-4 leading-relaxed">Use your own Ethereum RPC provider for transactions and contract interactions.</p>
      <input
        type="url"
        value={rpcVal}
        onChange={e => { setRpcVal(e.target.value); setRpcErr(null); }}
        placeholder="https://mainnet.infura.io/v3/your-key"
        className={`w-full bg-[#f2f4f7] rounded-2xl px-4 py-4 text-[14px] tabular-nums text-[#15171c] outline-none focus:ring-2 mb-1 ${rpcErr ? 'ring-2 ring-red-400 focus:ring-red-400' : 'focus:ring-black/30'}`}
      />
      {rpcErr && <p className="text-[12px] text-[#d93036] mb-3 px-1">{rpcErr}</p>}
      <div className="flex gap-3 mt-4">
        <button
          type="button"
          onClick={() => { setRpcVal(''); onSave(''); onClose(); toast.success('Restored default RPC'); }}
          className="flex-1 py-4 border border-[#e4e7ec] rounded-2xl text-[#727a88] font-semibold text-[15px]"
        >
          Reset to Default
        </button>
        <button
          type="button"
          onClick={() => {
            if (!rpcVal) { onSave(''); onClose(); toast.success('Restored default RPC'); return; }
            try {
              const u = new URL(rpcVal);
              if (u.protocol !== 'https:' && u.protocol !== 'http:') { setRpcErr('Only https:// and http:// URLs are allowed.'); return; }
              if (!u.hostname.includes('.') || u.hostname === 'localhost') { setRpcErr('Local network URLs are not allowed.'); return; }
            } catch { setRpcErr('Please enter a valid URL.'); return; }
            onSave(rpcVal.slice(0, 512));
            onClose();
            toast.success('RPC URL saved');
          }}
          className="flex-1 py-4 bg-[#15171c] rounded-2xl text-white font-semibold text-[15px]"
        >
          Save
        </button>
      </div>
    </div>
  );
};

const NukeModalContent: React.FC<{
  onClose: () => void;
  onConfirm: () => Promise<void>;
}> = ({ onClose, onConfirm }) => {
  const [nukeConfirm, setNukeConfirm] = useState('');
  const [working, setWorking] = useState(false);
  const confirmed = nukeConfirm.trim().toUpperCase() === 'DELETE' && !working;

  return (
    <div className="px-6 pb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
          <AlertTriangle size={22} className="text-[#d93036]" />
        </div>
        <div>
          <h3 className="text-[18px] font-semibold text-[#15171c]">Delete all data</h3>
          <p className="text-[13px] text-[#d93036] font-semibold">This cannot be undone</p>
        </div>
      </div>
      <p className="text-[14px] text-[#727a88] mb-5 leading-relaxed">
        Erases what Ledger Chat keeps on this device: cached messages, contacts, blocked list, notes, saved files and settings, and signs you out. Your messages stay in your encrypted inbox and come back when you sign in again. Your wallet and funds are not touched.
      </p>
      <p className="text-[13px] text-[#3C3C43] mb-2 font-semibold">Type <span className="font-semibold text-red-600">DELETE</span> to confirm:</p>
      <input
        type="text"
        value={nukeConfirm}
        onChange={e => setNukeConfirm(e.target.value)}
        placeholder="DELETE"
        className="w-full bg-[#f2f4f7] rounded-2xl px-4 py-3 text-[15px] tabular-nums font-semibold text-[#15171c] outline-none focus:ring-2 focus:ring-red-400 mb-4"
        autoCapitalize="characters"
      />
      <button
        type="button"
        disabled={!confirmed}
        onClick={async () => {
          setWorking(true);
          try { await onConfirm(); } catch { setWorking(false); toast.error('Could not delete everything. Try again.'); }
        }}
        className={`w-full py-4 rounded-2xl text-white font-semibold text-[16px] transition-opacity ${confirmed ? 'bg-[#e5484d]' : 'bg-[#e5484d] opacity-30 cursor-not-allowed'}`}
      >
        {working ? 'Deleting…' : 'Delete everything'}
      </button>
      <button type="button" onClick={onClose} className="w-full py-3 mt-2 text-[#727a88] font-semibold text-[16px]">
        Cancel
      </button>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const LedgerSettingsFull: React.FC<LedgerSettingsFullProps> = ({ myAddress, myName, onClose }) => {
  const { connector, address, chain } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address: (address || myAddress) as `0x${string}` });
  const { settings, updateSetting } = useLedgerSettings(myAddress);
  const push = usePushNotifications(myAddress);

  const [activeTab, setActiveTab] = useState<string>('home');
  const [modal, setModal] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // ── Profile Photo ──────────────────────────────────────────────────────────
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const avatarFileRef = useRef<HTMLInputElement>(null);

  // Profile changes are applied locally at once, synced to your other devices
  // through the settings engine, and published so the people you chat with
  // see them. A failed publish is reported, not hidden.
  const publishProfile = useCallback(async (patch: { displayName?: string; bio?: string; avatarUrl?: string }, okMsg: string) => {
    const r = await pushPublicProfile(myAddress, patch);
    if (r.ok) toast.success(okMsg);
    else if (r.error === 'offline') toast.message(`${okMsg} on this device. It will be shared once you are back online.`);
    else toast.error(`Saved on this device, but others cannot see it yet: ${r.error}`);
  }, [myAddress]);

  const handleAvatarChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Choose an image file.'); return; }
    if (file.size > 15 * 1024 * 1024) { toast.error('Photo must be under 15 MB'); return; }
    let dataUrl: string;
    try { dataUrl = await downscaleAvatar(file); } catch (err: any) { toast.error(err?.message || 'Could not open that photo.'); return; }
    setAvatarUrl(dataUrl);
    try { localStorage.setItem('ledger_avatar', dataUrl); } catch {}
    try { updateSetting('avatar_url', dataUrl); } catch {}
    window.dispatchEvent(new CustomEvent('ledger_settings_update', { detail: { avatarUrl: dataUrl } }));
    await publishProfile({ avatarUrl: dataUrl }, 'Profile photo updated');
  }, [publishProfile, updateSetting]);

  const removeAvatar = useCallback(async () => {
    setAvatarUrl('');
    try { localStorage.removeItem('ledger_avatar'); } catch {}
    try { updateSetting('avatar_url', ''); } catch {}
    window.dispatchEvent(new CustomEvent('ledger_settings_update', { detail: { avatarUrl: '' } }));
    await publishProfile({ avatarUrl: '' }, 'Profile photo removed');
  }, [publishProfile, updateSetting]);

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [editingBio, setEditingBio] = useState(false);


  const [showZkSettingsPanel, setShowZkSettingsPanel] = useState<boolean>(false);

  const [zkBalances, setZkBalances] = useState<ZkShieldedBalance>(() => getShieldedBalances(myAddress));
  const [currentZkTag, setCurrentZkTag] = useState(() => resolveZkTag(myAddress));
  const [editingZkTag, setEditingZkTag] = useState(false);
  const [newZkTag, setNewZkTag] = useState('');
  const [showZkShieldModal, setShowZkShieldModal] = useState(false);
  const [zkShieldMode, setZkShieldMode] = useState<'shield' | 'unshield'>('shield');
  const [isSyncingAztec, setIsSyncingAztec] = useState(false);

  // Sync zk.money balances
  useEffect(() => {
    if (myAddress) {
      setZkBalances(getShieldedBalances(myAddress));
    }
    const onBalanceUpdate = () => {
      if (myAddress) setZkBalances(getShieldedBalances(myAddress));
    };
    window.addEventListener('ledger_zk_balance_updated', onBalanceUpdate);
    return () => window.removeEventListener('ledger_zk_balance_updated', onBalanceUpdate);
  }, [myAddress]);

  // Load saved profile info
  useEffect(() => {
    // The settings engine is the synced source; localStorage covers older builds.
    try {
      setDisplayName((settings as any)?.displayName || localStorage.getItem('ledger_displayName') || myName || '');
      setBio((settings as any)?.bio ?? localStorage.getItem('ledger_bio') ?? '');
      setAvatarUrl((settings as any)?.avatar_url || localStorage.getItem('ledger_avatar') || '');
    } catch {}
  }, [myAddress, myName, (settings as any)?.displayName, (settings as any)?.bio, (settings as any)?.avatar_url]);

  const saveDisplayName = useCallback(async () => {
    const name = displayName.trim().slice(0, 50);
    setDisplayName(name);
    setEditingName(false);
    try { localStorage.setItem('ledger_displayName', name); } catch {}
    try { updateSetting('displayName', name); } catch {}
    window.dispatchEvent(new CustomEvent('ledger_settings_update', { detail: { displayName: name } }));
    await publishProfile({ displayName: name }, 'Display name saved');
  }, [displayName, publishProfile, updateSetting]);

  const saveBio = useCallback(async () => {
    const text = bio.trim().slice(0, 250);
    setBio(text);
    setEditingBio(false);
    try { localStorage.setItem('ledger_bio', text); } catch {}
    try { updateSetting('bio', text); } catch {}
    await publishProfile({ bio: text }, 'Bio saved');
  }, [bio, publishProfile, updateSetting]);

  const copyAddress = useCallback(() => {
    navigator.clipboard.writeText(myAddress).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Address copied');
  }, [myAddress]);

  // Full sign-out: ends the server session (httpOnly cookies included),
  // disconnects the wallet and locks the vault. Asked for in a sheet, not a
  // blocking browser dialog.
  const { nuclearDisconnect } = useSystemSignOut();
  const [signingOut, setSigningOut] = useState(false);
  const handleSignOut = useCallback(() => setModal('signout'), []);
  const confirmSignOut = useCallback(async () => {
    setSigningOut(true);
    try { await nuclearDisconnect(); } catch { setSigningOut(false); toast.error('Failed to sign out'); }
  }, [nuclearDisconnect]);

  const deleteAllData = useCallback(async () => {
    await wipeLocalChatData(myAddress);
    toast.success('Local data deleted. Signing you out…');
    await nuclearDisconnect();
  }, [myAddress, nuclearDisconnect]);

  const purgeCache = useCallback(async () => {
    let count = 0;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (
        k?.startsWith('ledger_cache_') || 
        k?.startsWith('ledger_msg_cache_') || 
        k?.startsWith('ledger_chat_history_')
      ) {
        localStorage.removeItem(k); count++;
      }
    }
    
    // Clear IndexedDB for messages (they re-sync from the encrypted inbox)
    let clearedDb = false;
    try {
        const { chatDB } = await import('@/lib/chat/indexeddb');
        await chatDB.clearAll();
        clearedDb = true;
    } catch(e) {}

    toast.success(clearedDb ? 'Message cache cleared. Reloading…' : `Cleared ${count} cached item${count === 1 ? '' : 's'}`);
    setModal(null);
    setTimeout(() => window.location.reload(), 1000);
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) { toast.error('Notifications not supported'); return; }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      toast.success('Notifications enabled');
      updateSetting('notifications_private', true);
    } else {
      toast.error('Notifications are blocked. Check your browser settings.');
    }
  }, [updateSetting]);

  const shortAddr = (addr: string) =>
    addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '';

  // Signing in on another device needs no secret, so the QR code is only a
  // convenient way to open the sign in page there.
  const connectUrl = typeof window !== 'undefined' ? `${window.location.origin}/connect` : '';

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 36 }}
      className="absolute inset-0 z-[200] bg-[#f2f4f7] flex flex-col overflow-hidden"
    >
      {/* ── Header ── */}
      <div
        className="shrink-0 bg-white border-b border-[#e4e7ec] flex items-center justify-between px-4"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))', paddingBottom: '12px' }}
      >
        <button type="button" onClick={onClose} className="flex items-center gap-1 text-[#15171c] font-medium text-[16px]">
          <ArrowLeft size={20} className="text-[#15171c]" />
          Back
        </button>
        <span className="text-[17px] font-semibold text-[#15171c]">Settings</span>
        <div className="w-16" />
      </div>

      {/* ── Section Navigation: iOS grouped list when no section selected ── */}
      {activeTab === 'home' && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto w-full px-4 py-5 pb-16 space-y-6">
            {SETTINGS_SECTIONS.map(section => (
              <div key={section.title}>
                <p className="text-[11.5px] font-semibold text-[#727a88] px-1 mb-2 tracking-wide">{section.title}</p>
                <div className="bg-white rounded-[14px] overflow-hidden shadow-sm">
                  {section.items.map((item, idx) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#f7f8fa] transition-colors ${
                        idx < section.items.length - 1 ? 'border-b border-black/[0.05]' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0 pr-3">
                        <p className="text-[15px] font-semibold text-[#15171c] leading-tight">{item.label}</p>
                        {item.sublabel && <p className="text-[12.5px] text-[#727a88] mt-1 leading-snug">{item.sublabel}</p>}
                      </div>
                      <ChevronRight size={16} className="text-[#c9ced6] shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Section sub-header breadcrumb (when inside a section) ── */}
      {activeTab !== 'home' && (
        <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-white border-b border-[#e4e7ec]">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-1 text-[#15171c] font-medium text-[14px] hover:opacity-70 transition-opacity"
          >
            <ChevronLeft size={18} />
            Settings
          </button>
          <span className="text-[#c9ced6]">/</span>
          <span className="text-[14px] text-[#727a88] font-medium capitalize">
            {SETTINGS_SECTIONS.flatMap(s => s.items).find(i => i.id === activeTab)?.label || activeTab}
          </span>
        </div>
      )}

      {/* ── Content (shown when a section is selected) ── */}
      {activeTab !== 'home' && (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full px-4 py-5 pb-16">

          {/* ════════════════════════════════════════════════════════════════════
              ACCOUNT TAB
          ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'account' && (
            <>
              {/* Profile card */}
              <div className="bg-white rounded-[18px] shadow-sm overflow-hidden mb-6">
                <div className="flex flex-col items-center py-8 px-6 gap-4">
                  {/* Avatar */}
                  <div className="relative">
                    {/* Hidden file input */}
                    <input
                      ref={avatarFileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                    {/* Avatar circle */}
                    <button
                      type="button"
                      onClick={() => avatarFileRef.current?.click()}
                      className="w-[88px] h-[88px] rounded-full overflow-hidden shadow-lg ring-4 ring-black/[0.08] hover:ring-black/20 transition-all active:scale-95"
                      title="Change profile photo"
                    >
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-[#15171c] flex items-center justify-center">
                          <span className="text-white text-3xl font-semibold">
                            {myAddress ? myAddress.slice(2, 4).toUpperCase() : '??'}
                          </span>
                        </div>
                      )}
                    </button>
                    {/* Camera badge */}
                    <button
                      type="button"
                      onClick={() => avatarFileRef.current?.click()}
                      className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#15171c] rounded-full flex items-center justify-center shadow-md border-2 border-white hover:bg-black transition-colors"
                      title="Change photo"
                    >
                      <Camera size={14} className="text-white" />
                    </button>
                  </div>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => { removeAvatar(); }}
                      className="text-[13px] font-semibold text-[#d93036] hover:text-red-600 transition-colors"
                    >
                      Remove photo
                    </button>
                  )}

                  {/* Display name */}
                  {editingName ? (
                    <div className="flex items-center gap-2 w-full max-w-[280px]">
                      <input
                        autoFocus
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveDisplayName()}
                        className="flex-1 text-center text-[20px] font-semibold text-[#15171c] bg-[#f2f4f7] rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-black/30"
                        placeholder="Display name"
                        maxLength={32}
                      />
                      <button type="button" onClick={saveDisplayName} className="w-9 h-9 bg-[#15171c] rounded-full flex items-center justify-center shadow-sm">
                        <Check size={16} className="text-white" />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setEditingName(true)} className="flex items-center gap-2 group">
                      <span className="text-[20px] font-semibold text-[#15171c]">
                        {displayName || 'Add display name'}
                      </span>
                      <span className="text-[12px] text-[#727a88] opacity-0 group-hover:opacity-100 transition-opacity font-semibold">Edit</span>
                    </button>
                  )}

                  {/* Bio */}
                  {editingBio ? (
                    <div className="flex items-start gap-2 w-full max-w-[280px]">
                      <textarea
                        autoFocus
                        value={bio}
                        onChange={e => setBio(e.target.value)}
                        rows={2}
                        className="flex-1 text-center text-[14px] text-[#727a88] bg-[#f2f4f7] rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-black/30 resize-none"
                        placeholder="About / bio"
                        maxLength={100}
                      />
                      <button type="button" onClick={saveBio} className="w-8 h-8 bg-[#15171c] rounded-full flex items-center justify-center shadow-sm mt-1">
                        <Check size={14} className="text-white" />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setEditingBio(true)} className="text-[14px] text-[#727a88] group flex items-center gap-1">
                      {bio || 'Add a bio'}
                      <span className="text-[12.5px] text-[#727a88] opacity-0 group-hover:opacity-100 transition-opacity font-semibold">Edit</span>
                    </button>
                  )}

                  {/* Wallet address */}
                  <button
                    type="button"
                    onClick={copyAddress}
                    className="flex items-center gap-2 bg-[#f2f4f7] rounded-xl px-4 py-2 hover:bg-[#e4e7ec] transition-colors"
                  >
                    <Wallet size={13} className="text-[#727a88]" />
                    <span className="text-[12px] tabular-nums text-[#727a88]">{shortAddr(myAddress)}</span>
                    {copied ? <Check size={13} className="text-[#15171c]" /> : <Copy size={13} className="text-[#727a88]" />}
                  </button>

                  {/* ETH balance */}
                  {balance && (
                    <div className="flex items-center gap-2 bg-[#f2f4f7] rounded-xl px-4 py-2">
                      <span className="text-[13px] font-semibold text-[#627EEA]">Ξ</span>
                      <span className="text-[13px] font-semibold text-[#15171c]">
                        {parseFloat(balance.formatted).toFixed(4)} {balance.symbol}
                      </span>
                      <span className="text-[12.5px] text-[#727a88]">on {chain?.name || 'Ethereum'}</span>
                    </div>
                  )}
                </div>
              </div>

              <Group title="Devices" footer="Your account is your wallet. To use Ledger Chat on another device, sign in there with the same wallet.">
                <Row
                  icon={<Smartphone size={18} />}
                  label="Use on another device"
                  sublabel="Open the sign in page on your phone or computer"
                  onTap={() => setModal('linked_devices')}
                />
                <Row
                  icon={<Monitor size={18} />}
                  label="This device"
                  sublabel="This browser, signed in now"
                  value="Active"
                />
              </Group>

              <Group title="Profile visibility" footer="Your display name and bio are shared with people you message.">
                <Row
                  icon={<User size={18} />}
                  label="Display name"
                  value={displayName || 'Not set'}
                  onTap={() => setEditingName(true)}
                />
                <Row
                  icon={<FileText size={18} />}
                  label="Bio"
                  value={bio || 'Not set'}
                  onTap={() => setEditingBio(true)}
                />
                
                <Row
                  icon={<Globe size={18} />}
                  label="Network"
                  value={chain?.name || 'Ethereum'}
                />
              </Group>

              <Group title="Data & backup">
                <Row
                  icon={<Download size={18} />}
                  label="Export settings"
                  sublabel="Your preferences as a JSON file. Keys and sessions are never included."
                  onTap={() => {
                    try { downloadSettingsBackup(); toast.success('Settings exported'); }
                    catch { toast.error('Export failed'); }
                  }}
                />
                <Row
                  icon={<RefreshCw size={18} />}
                  label="Clear message cache"
                  sublabel="Free up local storage"
                  onTap={() => setModal('clearCache')}
                />
              </Group>

              <Group title="Session">
                <Row
                  icon={<LogOut size={18} />}
                  label="Sign out"
                  sublabel="Disconnect your wallet"
                  danger
                  onTap={handleSignOut}
                />
                <Row
                  icon={<Trash2 size={18} />}
                  label="Delete all data"
                  sublabel="Permanently erase everything"
                  danger
                  onTap={() => setModal('nuke')}
                />
              </Group>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              PRIVACY TAB
          ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'privacy' && (
            <>
              <Group title="Who can see" footer="Last seen and online are only ever shown to contacts who added you back. If you choose Nobody, you won't see theirs either.">
                <Row icon={<Clock size={18} />} label="Last seen & online" value={({ everybody: 'My contacts', contacts: 'My contacts', nobody: 'Nobody' } as Record<string, string>)[settings.privacy_last_seen || 'contacts'] || 'My contacts'} onTap={() => setModal('privacy_last_seen')} />
              </Group>

              <Group title="Disappearing messages" footer="New messages in all chats will auto-delete after the chosen time.">
                <Row icon={<Trash2 size={18} />} label="Default timer" value={settings.auto_delete_timer || 'Off'} onTap={() => setModal('auto_delete')} />
                <Row
                  icon={<EyeOff size={18} />}
                  label="Burn after reading"
                  sublabel={`Messages you receive are removed from this device ${(settings as any).burn_on_read_seconds || 10} s after you open them`}
                  toggle={!!settings.burn_on_read}
                  onToggle={v => updateSetting('burn_on_read', v)}
                />
              </Group>

              <Group title="Interactions">
                <Row
                  icon={<Eye size={18} />}
                  label="Read receipts"
                  sublabel="Show when you've read messages"
                  toggle={settings.show_read_receipts !== false}
                  onToggle={v => updateSetting('show_read_receipts', v)}
                />
                <Row
                  icon={<MessageSquare size={18} />}
                  label="Typing indicators"
                  sublabel="Show when you're typing"
                  toggle={settings.typing_indicators !== false}
                  onToggle={v => updateSetting('typing_indicators', v)}
                />
                <Row
                  icon={<Shield size={18} />}
                  label="Screen privacy"
                  sublabel="Blurs the chat when you switch apps and turns off text selection. Browsers can't block screenshots."
                  toggle={!!settings.anti_screenshot}
                  onToggle={v => updateSetting('anti_screenshot', v)}
                />
              </Group>

              <Group title="Contacts">
                <Row
                  icon={<BellOff size={18} />}
                  label="Blocked addresses"
                  sublabel="Manage blocked wallets"
                  onTap={() => setModal('blocked_list')}
                />
              </Group>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              NOTIFICATIONS TAB
          ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'notifications' && (
            <>
              {/* Permission banner */}
              {typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted' && (
                <div className="bg-amber-50 border border-amber-200 rounded-[14px] p-4 mb-5 flex items-start gap-3">
                  <AlertTriangle size={17} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[14px] font-semibold text-amber-900">Notifications disabled</p>
                    <p className="text-[12px] text-amber-700 mt-0.5">Enable to never miss a message.</p>
                  </div>
                  <button type="button" onClick={requestNotificationPermission} className="bg-amber-600 text-white text-[12px] font-semibold px-3 py-1.5 rounded-xl shrink-0">
                    Enable
                  </button>
                </div>
              )}

              <Group title="Push notifications">
                <div className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-[15px] font-semibold text-[#15171c]">Background notifications</p>
                    <p className="text-[12px] text-[#727a88] mt-0.5">
                      {!push.isSupported
                        ? 'Not supported in this browser'
                        : push.permission === 'denied'
                        ? 'Blocked in your browser. Allow them in the site settings.'
                        : 'Get notified even when the app is closed'}
                    </p>
                  </div>
                  {push.isSupported && push.permission !== 'denied' && (
                    push.isSubscribed ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] text-[#15171c] font-semibold">On</span>
                        <button onClick={push.unsubscribe} className="text-[12px] text-[#727a88] underline">Off</button>
                      </div>
                    ) : (
                      <button
                        onClick={async () => {
                          const ok = await push.subscribe();
                          if (ok) toast.success('Notifications enabled');
                          else toast.error('Could not enable notifications');
                        }}
                        disabled={push.isLoading}
                        className="px-4 py-2 bg-[#15171c] hover:bg-black text-white text-[13px] font-semibold rounded-xl disabled:opacity-50 transition-colors"
                      >
                        {push.isLoading ? 'Enabling' : 'Enable'}
                      </button>
                    )
                  )}
                  {push.permission === 'denied' && (
                    <span className="text-[12px] text-[#d93036] font-semibold">Blocked</span>
                  )}
                </div>
              </Group>

              <Group title="Messages">
                <Row
                  icon={<MessageSquare size={18} />}
                  label="Message notifications"
                  sublabel="Alerts for new messages in your chats"
                  toggle={settings.notifications_private !== false}
                  onToggle={v => updateSetting('notifications_private', v)}
                />
              </Group>

              <Group title="Sounds & vibration">
                <Row
                  icon={<Volume2 size={18} />}
                  label="Message sound"
                  toggle={settings.notification_sound !== false}
                  onToggle={v => updateSetting('notification_sound', v)}
                />
                <Row
                  icon={<Vibrate size={18} />}
                  label="Vibration"
                  toggle={settings.haptics_intensity > 0}
                  onToggle={v => updateSetting('haptics_intensity', v ? 2 : 0)}
                />
              </Group>

              <Group title="Display">
                <Row
                  icon={<Eye size={18} />}
                  label="Show Preview in Notifications"
                  sublabel="Display message content in alerts"
                  toggle={settings.notifications_private !== false && !(settings as any).hide_notification_content}
                  onToggle={v => updateSetting('hide_notification_content' as any, !v)}
                />
                <Row
                  icon={<Moon size={18} />}
                  label="Do not disturb"
                  sublabel="No message alerts or banners. Calls still ring."
                  toggle={!!(settings as any).do_not_disturb}
                  onToggle={v => updateSetting('do_not_disturb' as any, v)}
                />
              </Group>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              SECURITY TAB
          ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'security' && (
            <>
              <Group title="App lock" footer="Biometric lock uses your device's Face ID or fingerprint to protect Ledger Chat.">
                <Row
                  icon={<Fingerprint size={18} />}
                  label="Biometric lock"
                  sublabel="Face ID / Touch ID"
                  toggle={!!settings.biometric_lock}
                  onToggle={v => updateSetting('biometric_lock', v)}
                />
              </Group>

              <Group title="Encryption" footer="Direct messages use XMTP with MLS. Messages marked as sent through the server fallback are not end to end encrypted.">
                <Row
                  icon={<ShieldCheck size={18} />}
                  label="How your chats are protected"
                  sublabel="Protocol, call encryption and limits"
                  onTap={() => setModal('encryption')}
                />
              </Group>

              <Group title="Network security" footer="IP masking routes WebRTC traffic through a relay to hide your real IP address.">
                <Row
                  icon={<Shield size={18} />}
                  label="WebRTC IP masking"
                  sublabel="Hide your IP during calls"
                  toggle={!!settings.webrtc_ip_masking}
                  onToggle={v => updateSetting('webrtc_ip_masking', v)}
                />
              </Group>


              <Group title="Danger zone" footer="These actions are permanent and cannot be undone.">
                <Row icon={<RefreshCw size={18} />} label="Clear all caches" onTap={() => setModal('clearCache')} />
                <Row icon={<Trash2 size={18} />} label="Delete all data" danger onTap={() => setModal('nuke')} />
              </Group>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              CHAT TAB
          ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'chat' && (
            <>
              <Group title="Appearance">
                <Row
                  icon={<Palette size={18} />}
                  label="Chat wallpaper"
                  value={settings.chat_background === 'default' ? 'Default' : 'Custom'}
                  onTap={() => setModal('wallpaper')}
                />
                <Row
                  icon={<Sliders size={18} />}
                  label="Font size"
                  value={textSizeLabel(settings.text_size ?? DEFAULT_TEXT_SIZE_LEVEL)}
                  onTap={() => setModal('font_size')}
                />
                <Row
                  icon={<Sun size={18} />}
                  label="Bubble style"
                  value={settings.bubble_style || 'Default'}
                  onTap={() => setModal('bubble_style')}
                />
              </Group>

              <Group title="Composing">
                <Row
                  icon={<Send size={18} />}
                  label="Enter to Send"
                  sublabel="Press Enter to send, Shift+Enter for newline"
                  toggle={settings.enter_to_send !== false}
                  onToggle={v => updateSetting('enter_to_send', v)}
                />
                <Row
                  icon={<Zap size={18} />}
                  label="Keyboard sound"
                  sublabel="Mechanical keyboard click on keypress"
                  toggle={!!settings.mechanical_keyboard}
                  onToggle={v => updateSetting('mechanical_keyboard', v)}
                />
              </Group>

              <Group title="Writing help" footer="Runs on this device. Your messages are not sent anywhere to be checked.">
                <Row
                  icon={<Zap size={18} />}
                  label="Soften strong language"
                  sublabel="Replaces insults and swear words in messages you send"
                  toggle={!!settings.tone_translator}
                  onToggle={v => updateSetting('tone_translator', v)}
                />
              </Group>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              CALLS TAB
          ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'calls' && (
            <>


              <Group title="Privacy" footer="IP masking routes all call traffic through a relay to hide your network identity.">
                <Row
                  icon={<Shield size={18} />}
                  label="IP address masking"
                  sublabel="Hides your real IP from callers"
                  toggle={!!settings.webrtc_ip_masking}
                  onToggle={v => updateSetting('webrtc_ip_masking', v)}
                />
              </Group>

              <Group title="Ringtone & alerts">
                <Row
                  icon={<Vibrate size={18} />}
                  label="Vibrate"
                  sublabel="For incoming calls and new messages (same switch as in Notifications)"
                  toggle={settings.haptics_intensity > 0}
                  onToggle={v => updateSetting('haptics_intensity', v ? 2 : 0)}
                />
              </Group>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              STORAGE TAB
          ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'storage' && (
            <>
              {(() => {
                let total = 0, count = 0;
                try {
                  for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i)!;
                    const v = localStorage.getItem(k) || '';
                    if (k.startsWith('ledger_')) { total += v.length * 2; count++; }
                  }
                } catch {}
                const kb = (total / 1024).toFixed(1);
                const mb = (total / 1024 / 1024).toFixed(2);
                return (
                  <div className="bg-white rounded-[18px] p-5 mb-6 shadow-sm">
                    <p className="text-[12px] text-[#727a88] font-semibold mb-3">Local storage used</p>
                    <div className="flex items-end gap-2 mb-3">
                      <p className="text-[40px] font-semibold text-[#15171c] leading-none">
                        {parseFloat(mb) < 0.1 ? kb : mb}
                      </p>
                      <p className="text-[16px] font-semibold text-[#727a88] mb-1">
                        {parseFloat(mb) < 0.1 ? 'KB' : 'MB'}
                      </p>
                    </div>
                    <div className="w-full bg-[#f2f4f7] rounded-full h-2">
                      <div
                        className="bg-[#15171c] h-2 rounded-full transition-all"
                        style={{ width: `${Math.min((parseFloat(mb) / 50) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-[12px] text-[#727a88] mt-2">About {count} Ledger Chat items</p>
                  </div>
                );
              })()}

              <Group title="Manage" footer="Clearing cache removes temporary data only. Your conversations are stored via XMTP and are safe.">
                <Row icon={<RefreshCw size={18} />} label="Clear cache" sublabel="Remove temporary files" onTap={() => setModal('clearCache')} />
                <Row icon={<HardDrive size={18} />} label="Manage media" sublabel="Photos, videos, and files" onTap={() => setModal('manage_media')} />
              </Group>

              <Group>
                <Row
                  icon={<Download size={18} />}
                  label="Export settings"
                  sublabel="Your preferences as a JSON file. Keys and sessions are never included."
                  onTap={() => {
                    try { downloadSettingsBackup(); toast.success('Settings exported'); }
                    catch { toast.error('Export failed'); }
                  }}
                />
              </Group>
            </>
          )}

          {/* PAYMENTS TAB (Including Native zk.money Aztec Private Payments) */}
          {activeTab === 'payments' && (
            <div className="space-y-6">
              {/* Shielded Portfolio Overview Card */}
              <div className="bg-white rounded-[18px] p-5 shadow-sm border border-black/[0.04]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-black/5 flex items-center justify-center text-[#15171c]">
                      <Lock size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[16px] text-[#15171c]">Shielded portfolio</span>
                        <span className="text-[12px] font-semibold bg-black/5 text-[#727a88] px-2 py-0.5 rounded-full">
                          zk.money
                        </span>
                      </div>
                      <p className="text-[12px] text-[#727a88]">Simulated balances on this device. No real funds move.</p>
                    </div>
                  </div>
                  <span className="text-[12.5px] tabular-nums text-[#15171c] bg-black/5 px-2.5 py-1 rounded-full border border-black/[0.08] flex items-center gap-1.5 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#15171c]" />
                    Demo mode
                  </span>
                </div>

                {/* Balances grid */}
                <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-black/[0.04]">
                  <div className="p-3 rounded-xl bg-[#f2f4f7]">
                    <p className="text-[12px] font-semibold text-[#727a88]">Shielded DAI</p>
                    <p className="text-[15px] font-semibold tabular-nums text-[#15171c] mt-0.5">{zkBalances.dai || '0.00'}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#f2f4f7]">
                    <p className="text-[12px] font-semibold text-[#727a88]">Shielded USDC</p>
                    <p className="text-[15px] font-semibold tabular-nums text-[#15171c] mt-0.5">{zkBalances.usdc || '0.00'}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#f2f4f7]">
                    <p className="text-[12px] font-semibold text-[#727a88]">Shielded ETH</p>
                    <p className="text-[15px] font-semibold tabular-nums text-[#15171c] mt-0.5">{zkBalances.eth || '0.00'}</p>
                  </div>
                </div>

                {/* Quick Shield / Unshield Actions */}
                <div className="flex gap-2.5 mt-3.5 pt-3.5 border-t border-black/[0.04]">
                  <button
                    type="button"
                    onClick={() => { setZkShieldMode('shield'); setShowZkShieldModal(true); }}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-[#15171c] hover:bg-black text-white text-[13px] font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    <ArrowDownToLine size={15} /> Shield funds
                  </button>
                  <button
                    type="button"
                    onClick={() => { setZkShieldMode('unshield'); setShowZkShieldModal(true); }}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-[#f2f4f7] hover:bg-[#e4e7ec] text-[#15171c] text-[13px] font-semibold flex items-center justify-center gap-2 transition-colors border border-black/[0.04]"
                  >
                    <ArrowUpFromLine size={15} /> Unshield funds
                  </button>
                </div>
              </div>

              {/* Sovereign Aztec Identity */}
              <Group title="Your zk handle" footer="Demo feature. The handle is stored on this device and is not yet registered on the Aztec network.">
                <Row
                  icon={<Wallet size={18} />}
                  label="zk handle"
                  sublabel="A readable alias for payments (demo)"
                  value={currentZkTag}
                  onTap={() => {
                    navigator.clipboard.writeText(currentZkTag);
                    toast.success('zk.money handle copied');
                  }}
                />
                <div className="px-4 py-3 border-t border-black/[0.04]">
                  {!editingZkTag ? (
                    <button
                      type="button"
                      onClick={() => { setNewZkTag(currentZkTag.replace('zk:', '')); setEditingZkTag(true); }}
                      className="text-[13px] font-semibold text-[#15171c] hover:underline flex items-center gap-1.5"
                    >
                      Change handle
                    </button>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-gray-500 tabular-nums">zk:</span>
                        <input
                          type="text"
                          value={newZkTag}
                          onChange={e => setNewZkTag(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                          placeholder="newhandle"
                          maxLength={32}
                          className="flex-1 px-3.5 py-2 rounded-xl bg-[#f2f4f7] text-[13px] tabular-nums outline-none focus:ring-1 focus:ring-black/30"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingZkTag(false)}
                          className="px-3.5 py-1.5 rounded-xl text-[12px] font-semibold bg-[#f2f4f7] text-gray-600 hover:bg-[#e4e7ec]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const fullTag = `zk:${newZkTag}`;
                            const validation = validateZkHandle(fullTag);
                            if (!validation.valid) {
                              toast.error(validation.error || 'Invalid handle');
                              return;
                            }
                            registerZkTag(myAddress, fullTag);
                            setCurrentZkTag(fullTag);
                            setEditingZkTag(false);
                            toast.success(`Handle saved: ${fullTag}`);
                          }}
                          className="px-4 py-1.5 rounded-xl text-[12px] font-semibold bg-[#15171c] text-white hover:bg-black"
                        >
                          Save handle
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </Group>

              {/* Cryptographic Keys & Aztec State */}
              <Group title="Demo keys and sync" footer="Demo keys derived on this device. They do not control real funds.">
                {(() => {
                  const azKey = deriveAztecKeySet(myAddress);
                  return (
                    <>
                      <Row
                        icon={<Key size={18} />}
                        label="Aztec viewing key"
                        sublabel="Demo key, stored on this device"
                        value={`${azKey.incomingViewingKey.slice(0, 8)}…${azKey.incomingViewingKey.slice(-6)}`}
                        onTap={() => {
                          navigator.clipboard.writeText(azKey.incomingViewingKey);
                          toast.success('Aztec viewing key copied');
                        }}
                      />
                      <Row
                        icon={<RefreshCw size={18} className={isSyncingAztec ? 'animate-spin' : ''} />}
                        label="Sync demo balances"
                        sublabel="Refresh the simulated balances"
                        value={isSyncingAztec ? 'Syncing' : 'Sync now'}
                        onTap={async () => {
                          setIsSyncingAztec(true);
                          try {
                            const b = await syncBalanceFromAztec(myAddress);
                            setZkBalances(b);
                            toast.success('Balances refreshed');
                          } catch {
                            toast.info('Synced with local state');
                          } finally {
                            setIsSyncingAztec(false);
                          }
                        }}
                      />
                    </>
                  );
                })()}
              </Group>

              {/* Native Crypto Payments */}
              <Group title="Native crypto payments">
                <Row
                  icon={<Wallet size={18} />}
                  label="Payments in chats"
                  sublabel="Show Payment, Tip and private payment options in the attach menu and /pay"
                  toggle={settings.payments_enabled !== false}
                  onToggle={(v) => updateSetting('payments_enabled', v)}
                />
              </Group>

              <Group title="Default payment token">
                <div className="px-4 pb-4">
                  {/* The tokens the payment sheet can actually send; it opens on this one. */}
                  {['ETH', 'USDC', 'USDT'].map((token) => (
                    <button
                      key={token}
                      onClick={() => updateSetting('default_token', token)}
                      className={"flex items-center justify-between w-full py-3 border-b border-black/5 last:border-0 " + ((settings.default_token || 'ETH') === token ? "text-[#15171c]" : "text-[#15171c]")}
                    >
                      <span className="font-semibold text-[14px]">{token}</span>
                      {(settings.default_token || 'ETH') === token && (
                        <div className="w-5 h-5 rounded-full bg-[#15171c] flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </Group>

              <Group title="Transaction history">
                <Row label="View full history" onTap={() => window.open('/payments/history', '_blank')} />
                <Row label="Export CSV" onTap={() => {
                  try {
                    const rows = [['Date', 'Type', 'Amount', 'Peer', 'Status']];
                    for (let i = 0; i < localStorage.length; i++) {
                      const k = localStorage.key(i)!;
                      if (k.startsWith('ledger_tx_')) {
                        try { const tx = JSON.parse(localStorage.getItem(k) || '{}'); rows.push([tx.date || '', tx.type || '', tx.amount || '', tx.peer || '', tx.status || '']); } catch {}
                      }
                    }
                    if (rows.length === 1) { toast.info('No transactions recorded yet'); return; }
                    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `ledger-payments-${Date.now()}.csv`; a.click();
                    toast.success('CSV exported');
                  } catch { toast.error('Export failed'); }
                }} />
              </Group>
            </div>
          )}

        </div>
      </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          MODALS (Bottom Sheet)
      ════════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {modal && (
          <motion.div
            key={modal}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] bg-black/50 backdrop-blur-sm flex items-end justify-center"
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
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-[#e4e7ec]" />
              </div>

              {/* ── Devices ── */}
              {modal === 'linked_devices' && (
                <div className="px-6 pb-6">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-[20px] font-semibold text-[#15171c]">Use Ledger Chat on another device</h3>
                    <button type="button" onClick={() => setModal(null)} aria-label="Close" className="w-8 h-8 rounded-full bg-[#f2f4f7] flex items-center justify-center shrink-0">
                      <X size={16} className="text-[#727a88]" />
                    </button>
                  </div>
                  <p className="text-[14px] text-[#727a88] mb-5 leading-relaxed">
                    Your account is your wallet, so there is nothing to transfer. Sign in with the same wallet on the other device.
                  </p>

                  <div className="flex justify-center mb-3">
                    {connectUrl ? <DeviceQRCode data={connectUrl} size={180} /> : null}
                  </div>
                  <p className="text-[13px] text-[#727a88] text-center mb-4">
                    Scan this code with the other device to open the sign in page. It contains no secret.
                  </p>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard?.writeText(connectUrl).then(() => toast.success('Link copied')).catch(() => toast.error('Could not copy the link')); }}
                    className="w-full h-11 rounded-xl bg-[#eff1f4] hover:bg-[#e4e7ec] text-[#15171c] text-[15px] font-medium flex items-center justify-center gap-2 mb-5 transition-colors"
                  >
                    <Copy size={16} strokeWidth={1.9} /> Copy sign in link
                  </button>

                  <div className="bg-[#f7f8fa] rounded-2xl p-4 mb-4">
                    <p className="text-[13px] font-medium text-[#727a88] mb-3">How it works</p>
                    {[
                      'Open the link on the other device',
                      'Choose your wallet and sign the message',
                      'That device creates its own encryption keys',
                    ].map((text, i) => (
                      <div key={text} className="flex items-start gap-3 mb-2 last:mb-0">
                        <span className="w-6 h-6 rounded-full bg-[#15171c] text-white text-[12.5px] font-semibold flex items-center justify-center shrink-0">{i + 1}</span>
                        <p className="text-[14px] text-[#15171c] leading-snug pt-[2px]">{text}</p>
                      </div>
                    ))}
                  </div>

                  <p className="flex items-start gap-2 text-[13px] text-[#4a505c] leading-relaxed">
                    <ShieldCheck size={15} strokeWidth={1.9} className="mt-[2px] shrink-0 text-[#727a88]" aria-hidden="true" />
                    Your keys never leave a device and Ledger Chat never sees your wallet's private key.
                  </p>
                </div>
              )}

              {/* ── Privacy Selector ── */}
              {['privacy_last_seen','privacy_profile_photo','privacy_bio','privacy_group_invites'].includes(modal!) && (
                <div className="px-6 pb-6">
                  <h3 className="text-[20px] font-semibold text-[#15171c] mb-5">
                    {modal === 'privacy_last_seen' ? 'Last seen'
                      : modal === 'privacy_profile_photo' ? 'Profile photo'
                      : modal === 'privacy_bio' ? 'About / bio'
                      : 'Group invites'}
                  </h3>
                  {/* Presence is only ever shared with mutual contacts, so "Everybody"
                      would promise something the server never does. */}
                  {(modal === 'privacy_last_seen' ? ['contacts', 'nobody'] : ['everybody', 'contacts', 'nobody']).map(opt => {
                    const current = (settings as any)[modal!] === 'everybody' && modal === 'privacy_last_seen' ? 'contacts' : (settings as any)[modal!];
                    const label = ({ everybody: 'Everybody', contacts: 'My contacts', nobody: 'Nobody' } as Record<string, string>)[opt];
                    return (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => { updateSetting(modal as any, opt); setModal(null); toast.success('Privacy updated'); }}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl mb-2 transition-colors ${current === opt ? 'bg-[#15171c] text-white' : 'bg-[#f2f4f7] text-[#15171c] hover:bg-[#e4e7ec]'}`}
                    >
                      <span className="font-semibold">{label}</span>
                      {current === opt && <Check size={18} />}
                    </button>
                    );
                  })}
                </div>
              )}

              {/* ── Encryption details ── */}
              {modal === 'encryption' && (
                <div className="px-6 pb-6 max-h-[80vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[20px] font-semibold text-[#15171c]">How your chats are protected</h3>
                    <button type="button" onClick={() => setModal(null)} aria-label="Close" className="w-8 h-8 rounded-full bg-[#f2f4f7] flex items-center justify-center shrink-0">
                      <X size={16} className="text-[#727a88]" />
                    </button>
                  </div>
                  {[
                    ['Direct messages', 'Sent with XMTP using MLS (Messaging Layer Security). Only you and the other person can read them.'],
                    ['Server fallback', 'If XMTP is unavailable, a message can go through our server. Those messages are not end to end encrypted and are marked in the chat.'],
                    ['Calls', 'Voice and video use WebRTC with DTLS SRTP. With IP masking on, media is relayed through a TURN server but stays encrypted.'],
                    ['Communities', 'Community posts are stored on our server and are not end to end encrypted.'],
                    ['Your account', 'Your wallet is your account. To use another device, sign in with the same wallet there.'],
                    ['Payments', 'Shielded payments are a demo and do not move real funds.'],
                  ].map(([t, d]) => (
                    <div key={t} className="py-3 border-t border-black/[0.05] first:border-0">
                      <p className="text-[14px] font-semibold text-[#15171c]">{t}</p>
                      <p className="text-[13px] text-[#4a505c] leading-relaxed mt-0.5">{d}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Auto-Delete ── */}
              {modal === 'auto_delete' && (
                <div className="px-6 pb-6">
                  <h3 className="text-[20px] font-semibold text-[#15171c] mb-5">Disappearing messages</h3>
                  {['off','1 hour','24 hours','1 week','1 month','1 year'].map(opt => (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => { updateSetting('auto_delete_timer', (opt === 'off' ? 'off' : opt) as any); setModal(null); toast.success('Timer saved'); }}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl mb-2 transition-colors ${(settings.auto_delete_timer || 'off') === opt ? 'bg-[#15171c] text-white' : 'bg-[#f2f4f7] text-[#15171c] hover:bg-[#e4e7ec]'}`}
                    >
                      <span className="font-semibold">{opt === 'off' ? 'Disabled' : opt}</span>
                      {(settings.auto_delete_timer || 'off') === opt && <Check size={18} />}
                    </button>
                  ))}
                </div>
              )}

              {/* ── Font Size ── */}
              {modal === 'font_size' && (
                <div className="px-6 pb-6">
                  <h3 className="text-[20px] font-semibold text-[#15171c] mb-5">Font size</h3>
                  <div className="bg-[#f2f4f7] rounded-2xl p-4 mb-5">
                    <p style={{ fontSize: `${chatTextPx(settings.text_size ?? DEFAULT_TEXT_SIZE_LEVEL)}px` }} className="text-[#15171c] text-center">
                      Preview text at this size
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-[#727a88] font-semibold">A</span>
                    <input
                      type="range"
                      min={0}
                      max={4}
                      step={1}
                      value={settings.text_size ?? DEFAULT_TEXT_SIZE_LEVEL}
                      onChange={e => updateSetting('text_size', parseInt(e.target.value))}
                      className="flex-1 accent-[#15171c]"
                    />
                    <span className="text-[18px] text-[#727a88] font-semibold">A</span>
                  </div>
                  <button type="button" onClick={() => setModal(null)} className="w-full mt-5 py-4 bg-[#15171c] rounded-2xl text-white font-semibold text-[16px]">Done</button>
                </div>
              )}

              {/* ── Wallpaper ── */}
              {modal === 'wallpaper' && (
                <div className="px-6 pb-6">
                  <h3 className="text-[20px] font-semibold text-[#15171c] mb-5">Chat wallpaper</h3>
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {['default','minimal','dots','circuit','waves'].map(bg => (
                      <button
                        type="button"
                        key={bg}
                        onClick={() => { updateSetting('chat_background', bg as any); setModal(null); toast.success('Wallpaper saved'); }}
                        className={`h-24 rounded-2xl border-2 flex items-center justify-center font-semibold text-[12px] transition-all ${
                          (settings.chat_background || 'default') === bg
                            ? 'border-[#15171c] text-[#15171c] bg-black/5'
                            : 'border-transparent bg-[#f2f4f7] text-[#727a88]'
                        }`}
                      >
                        {bg}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Bubble Style ── */}
              {modal === 'bubble_style' && (
                <div className="px-6 pb-6">
                  <h3 className="text-[20px] font-semibold text-[#15171c] mb-5">Bubble style</h3>
                  {[
                    { id: 'default', label: 'Default', desc: 'Rounded corners, standard padding' },
                    { id: 'compact', label: 'Compact', desc: 'Smaller bubbles, denser layout' },
                    { id: 'wide', label: 'Wide', desc: 'Full-width bubbles' },
                  ].map(style => (
                    <button
                      type="button"
                      key={style.id}
                      onClick={() => { updateSetting('bubble_style', style.id as any); setModal(null); toast.success('Saved'); }}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl mb-2 ${(settings.bubble_style || 'default') === style.id ? 'bg-[#15171c] text-white' : 'bg-[#f2f4f7] text-[#15171c]'}`}
                    >
                      <div className="text-left">
                        <p className="font-semibold">{style.label}</p>
                        <p className={`text-[12px] mt-0.5 ${(settings.bubble_style || 'default') === style.id ? 'text-white/70' : 'text-[#727a88]'}`}>{style.desc}</p>
                      </div>
                      {(settings.bubble_style || 'default') === style.id && <Check size={18} />}
                    </button>
                  ))}
                </div>
              )}

              {/* ── Clear Cache ── */}
              {modal === 'clearCache' && (
                <div className="px-6 pb-6">
                  <h3 className="text-[20px] font-semibold text-[#15171c] mb-2">Clear cache</h3>
                  <p className="text-[14px] text-[#727a88] mb-6 leading-relaxed">This removes temporary cached data. Your messages, contacts, and settings are safe and will not be deleted.</p>
                  <button type="button" onClick={purgeCache} className="w-full py-4 bg-[#e5484d] rounded-2xl text-white font-semibold text-[16px]">
                    Clear Cache
                  </button>
                  <button type="button" onClick={() => setModal(null)} className="w-full py-3 mt-2 text-[#727a88] font-semibold text-[16px]">
                    Cancel
                  </button>
                </div>
              )}

              {/* ── Nuke ── */}
              {modal === 'nuke' && (
                <NukeModalContent
                  onClose={() => setModal(null)}
                  onConfirm={deleteAllData}
                />
              )}

              {/* ── Sign out ── */}
              {modal === 'signout' && (
                <div className="px-6 pb-6">
                  <h3 className="text-[20px] font-semibold text-[#15171c] mb-2">Sign out?</h3>
                  <p className="text-[14px] text-[#727a88] mb-6 leading-relaxed">
                    This ends your session on this device and disconnects your wallet. Your chats stay in your encrypted inbox; sign in again with the same wallet to see them.
                  </p>
                  <button
                    type="button"
                    disabled={signingOut}
                    onClick={confirmSignOut}
                    className={`w-full py-4 bg-[#e5484d] rounded-2xl text-white font-semibold text-[16px] ${signingOut ? 'opacity-60 cursor-wait' : ''}`}
                  >
                    {signingOut ? 'Signing out…' : 'Sign out'}
                  </button>
                  <button type="button" disabled={signingOut} onClick={() => setModal(null)} className="w-full py-3 mt-2 text-[#727a88] font-semibold text-[16px]">
                    Cancel
                  </button>
                </div>
              )}


              {/* ── Blocked Addresses ── */}
              {modal === 'blocked_list' && <BlockListModal onClose={() => setModal(null)} />}

              {/* ── Manage Media ── */}
              {modal === 'manage_media' && (() => {
                let totalBytes = 0; let mediaCount = 0;
                try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; if (k.startsWith('ledger_')) { const v = localStorage.getItem(k) || ''; if (v.startsWith('data:')) { totalBytes += v.length * 0.75; mediaCount++; } } } } catch {}
                const mb = (totalBytes / (1024 * 1024)).toFixed(2);
                return (
                  <div className="px-6 pb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-[20px] font-semibold text-[#15171c]">Manage media</h3>
                      <button type="button" onClick={() => setModal(null)} className="w-8 h-8 rounded-full bg-[#f2f4f7] flex items-center justify-center"><X size={16} className="text-[#727a88]" /></button>
                    </div>
                    <div className="bg-[#f2f4f7] rounded-2xl p-5 mb-5">
                      <p className="text-[13px] text-[#727a88] mb-1">Cached media storage</p>
                      <p className="text-[28px] font-semibold text-[#15171c]">{mb} <span className="text-[16px] font-medium text-[#727a88]">MB</span></p>
                      <p className="text-[12px] text-[#727a88] mt-1">{mediaCount} media item{mediaCount !== 1 ? 's' : ''}</p>
                      <div className="mt-3 h-2 bg-[#e4e7ec] rounded-full overflow-hidden"><div className="h-full bg-[#15171c] rounded-full" style={{ width: `${Math.min((parseFloat(mb) / 10) * 100, 100)}%` }} /></div>
                    </div>
                    <button type="button" onClick={() => { let n = 0; for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i)!; if (k.startsWith('ledger_') && (localStorage.getItem(k) || '').startsWith('data:')) { localStorage.removeItem(k); n++; } } toast.success(`Cleared ${n} item${n !== 1 ? 's' : ''}`); setModal(null); }} className="w-full py-4 bg-[#e5484d] rounded-2xl text-white font-semibold text-[16px] mb-2">Clear media cache</button>
                    <button type="button" onClick={() => setModal(null)} className="w-full py-3 text-[#727a88] font-semibold text-[16px]">Cancel</button>
                  </div>
                );
              })()}

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ZkShieldModal for Settings ── */}
      <AnimatePresence>
        {showZkShieldModal && (
          <ZkShieldModal
            address={myAddress}
            mode={zkShieldMode}
            onClose={() => setShowZkShieldModal(false)}
            onSuccess={() => {
              setShowZkShieldModal(false);
              setZkBalances(getShieldedBalances(myAddress));
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Advanced zk.money Architecture Panel ── */}
      <AnimatePresence>
        {showZkSettingsPanel && (
          <ZkSettingsPanel
            userAddress={myAddress}
            onClose={() => setShowZkSettingsPanel(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

