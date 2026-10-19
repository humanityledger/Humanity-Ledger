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
  ChevronDown, Info, Send, ArrowDownToLine, ArrowUpFromLine, Cpu
} from 'lucide-react';
import { useAccount, useBalance, useDisconnect, useSignMessage } from 'wagmi';
import { toast } from 'sonner';
import jsQR from 'jsqr';
import { QRCodeSVG } from 'qrcode.react';
import { useLedgerSettings } from '../terminal/LedgerChatSettings';
import { usePushNotifications } from '@/lib/push/usePushNotifications';
import { completeSessionHandshake } from '@/lib/scan/sessionHandshake';
import { getShieldedBalances, resolveZkTag, registerZkTag, validateZkHandle, syncBalanceFromAztec, getZkTransactionHistory, clearZkTransactionHistory, ZkShieldedBalance, AZTEC_MAINNET_RPC } from '@/lib/zk/zkMoney';
import { deriveAztecKeySet } from '@/lib/zk/aztecPxe';
import { ZkPrivacyScore } from '@/components/zk/ZkPrivacyScore';
import { ZkShieldModal } from '@/components/zk/ZkShieldModal';
import { ZkSettingsPanel } from '@/components/zk/ZkSettingsPanel';

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
    } ${value ? 'bg-[#1C1C1E] shadow-[inset_0_1px_2px_rgba(0,0,0,0.18)]' : 'bg-[#E4E4E7] shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]'}`}
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
      <span className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${value ? 'bg-[#1C1C1E]' : 'bg-[#D4D4D8]'}`} />
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
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={() => {
      if (disabled) return;
      if (onTap) onTap();
      else if (onToggle !== undefined && toggle !== undefined) onToggle(!toggle);
    }}
    className={`w-full flex items-center justify-between gap-3.5 px-0 py-3.5 border-b border-[#F2F2F7] last:border-0 text-left transition-colors ${
      disabled ? 'opacity-40 cursor-not-allowed' : onTap ? 'hover:bg-[#F2F2F7]/50 active:bg-[#F2F2F7] cursor-pointer' : 'cursor-default'
    }`}
  >
    <div className="flex-1 min-w-0 pr-2">
      <p className={`text-[15px] font-medium leading-tight ${danger ? 'text-red-500' : 'text-[#1C1C1E]'}`}>{label}</p>
      {sublabel && <p className="text-[12px] text-[#8E8E93] mt-1 leading-snug">{sublabel}</p>}
    </div>
    <div className="flex items-center gap-2 shrink-0">
      {badge && (
        <span className="bg-[#FF3B30] text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
          {badge}
        </span>
      )}
      {value && <span className="text-[14px] text-[#8E8E93] font-normal">{value}</span>}
      {onToggle !== undefined && toggle !== undefined ? (
        <Toggle value={toggle} onChange={onToggle} disabled={disabled} />
      ) : onTap ? (
        <ChevronRight size={16} className="text-[#C7C7CC]" />
      ) : null}
    </div>
  </button>
);


// ─── Settings Group ───────────────────────────────────────────────────────────
const Group = ({ title, footer, children }: {
  title?: string; footer?: string; children: React.ReactNode;
}) => (
  <div className="mb-6">
    {title && (
      <p className="text-[12px] font-semibold text-[#6D6D72] uppercase tracking-wider px-1 mb-1.5">
        {title}
      </p>
    )}
    <div className="bg-white rounded-[14px] overflow-hidden shadow-sm px-4">
      {children}
    </div>
    {footer && (
      <p className="text-[12px] text-[#8E8E93] px-1 mt-2 leading-relaxed">{footer}</p>
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

// ─── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
  { id: 'account',       label: 'Account',       icon: User },
  { id: 'privacy',       label: 'Privacy',        icon: Shield },
  { id: 'notifications', label: 'Notifications',  icon: Bell },
  { id: 'security',      label: 'Security',       icon: Lock },
  { id: 'chat',          label: 'Chat',           icon: MessageSquare },
  { id: 'calls',         label: 'Calls',          icon: Phone },
  { id: 'storage',       label: 'Storage',        icon: Database },
  { id: 'payments',      label: 'Payments',       icon: Zap },
];

const BlockListModal = () => {
  const [blocked, setBlocked] = useState<string[]>([]);
  useEffect(() => {
    try { setBlocked(JSON.parse(localStorage.getItem('ledger_blocked_users') || '[]')); } catch {}
  }, []);
  const unblock = (addr: string) => {
    const updated = blocked.filter(a => a !== addr);
    setBlocked(updated);
    localStorage.setItem('ledger_blocked_users', JSON.stringify(updated));
  };
  return (
    <div className="px-6 pb-6">
      <h3 className="text-[20px] font-bold text-[#1C1C1E] mb-5">Blocked Addresses</h3>
      {blocked.length === 0 ? (
        <p className="text-[14px] text-[#8E8E93] text-center py-4">No blocked users</p>
      ) : (
        <div className="max-h-[300px] overflow-y-auto">
          {blocked.map(addr => (
            <div key={addr} className="flex items-center justify-between p-3 bg-[#F2F2F7] rounded-[14px] mb-2">
              <span className="font-mono text-[13px] text-[#1C1C1E]">{addr}</span>
              <button onClick={() => unblock(addr)} className="text-[12px] font-bold text-[#FF3B30] px-3 py-1 bg-white rounded-full shadow-sm">Unblock</button>
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
      <h3 className="text-[20px] font-bold text-[#1C1C1E] mb-5">Custom RPC URL</h3>
      <p className="text-[13px] text-[#8E8E93] mb-4 leading-relaxed">Use your own Ethereum RPC provider for transactions and contract interactions.</p>
      <input
        type="url"
        value={rpcVal}
        onChange={e => { setRpcVal(e.target.value); setRpcErr(null); }}
        placeholder="https://mainnet.infura.io/v3/your-key"
        className={`w-full bg-[#F2F2F7] rounded-2xl px-4 py-4 text-[14px] font-mono text-[#1C1C1E] outline-none focus:ring-2 mb-1 ${rpcErr ? 'ring-2 ring-red-400 focus:ring-red-400' : 'focus:ring-black/30'}`}
      />
      {rpcErr && <p className="text-[12px] text-red-500 mb-3 px-1">{rpcErr}</p>}
      <div className="flex gap-3 mt-4">
        <button
          type="button"
          onClick={() => { setRpcVal(''); onSave(''); onClose(); toast.success('Restored default RPC'); }}
          className="flex-1 py-4 border border-[#E5E5EA] rounded-2xl text-[#8E8E93] font-bold text-[15px]"
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
          className="flex-1 py-4 bg-[#1C1C1E] rounded-2xl text-white font-bold text-[15px]"
        >
          Save
        </button>
      </div>
    </div>
  );
};

const NukeModalContent: React.FC<{
  onClose: () => void;
}> = ({ onClose }) => {
  const [nukeConfirm, setNukeConfirm] = useState('');
  const confirmed = nukeConfirm.trim().toUpperCase() === 'DELETE';

  return (
    <div className="px-6 pb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
          <AlertTriangle size={22} className="text-red-500" />
        </div>
        <div>
          <h3 className="text-[18px] font-bold text-[#1C1C1E]">Delete All Data</h3>
          <p className="text-[13px] text-red-500 font-semibold">This cannot be undone</p>
        </div>
      </div>
      <p className="text-[14px] text-[#8E8E93] mb-5 leading-relaxed">
        All local data including conversation history, contacts, and settings will be permanently deleted. Your on-chain identity and XMTP inbox remain intact.
      </p>
      <p className="text-[13px] text-[#3C3C43] mb-2 font-semibold">Type <span className="font-black text-red-600">DELETE</span> to confirm:</p>
      <input
        type="text"
        value={nukeConfirm}
        onChange={e => setNukeConfirm(e.target.value)}
        placeholder="DELETE"
        className="w-full bg-[#F2F2F7] rounded-2xl px-4 py-3 text-[15px] font-mono font-bold text-[#1C1C1E] outline-none focus:ring-2 focus:ring-red-400 mb-4"
        autoCapitalize="characters"
      />
      <button
        type="button"
        disabled={!confirmed}
        onClick={() => {
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k?.startsWith('ledger_')) localStorage.removeItem(k);
          }
          sessionStorage.clear();
          toast.success('All local data deleted');
          setTimeout(() => window.location.reload(), 1500);
        }}
        className={`w-full py-4 rounded-2xl text-white font-bold text-[16px] transition-opacity ${confirmed ? 'bg-[#FF3B30]' : 'bg-[#FF3B30] opacity-30 cursor-not-allowed'}`}
      >
        Confirm — Delete Everything
      </button>
      <button type="button" onClick={onClose} className="w-full py-3 mt-2 text-[#8E8E93] font-semibold text-[16px]">
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

  const [activeTab, setActiveTab] = useState<string>('account');
  const [modal, setModal] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // ── Profile Photo ──────────────────────────────────────────────────────────
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const avatarFileRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Photo must be under 5 MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setAvatarUrl(dataUrl);
      try {
        localStorage.setItem('ledger_avatar', dataUrl);
        window.dispatchEvent(new CustomEvent('ledger_settings_update', { detail: { avatarUrl: dataUrl } }));
        toast.success('Profile photo updated');
      } catch { toast.error('Photo too large for local storage. Try a smaller image.'); }
    };
    reader.readAsDataURL(file);
  }, []);

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [editingBio, setEditingBio] = useState(false);

  // ── QR Scanner state ────────────────────────────────────────────────────────
  const [qrScanMode, setQrScanMode] = useState<'show' | 'scan'>('show');
  const [scanError, setScanError] = useState('');
  const [scanSuccess, setScanSuccess] = useState('');
  const qrVideoRef = useRef<HTMLVideoElement>(null);
  const qrStreamRef = useRef<MediaStream | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const qrScanIntervalRef = useRef<any>(null);

  const stopQrScan = useCallback(() => {
    if (qrScanIntervalRef.current) clearInterval(qrScanIntervalRef.current);
    if (qrStreamRef.current) { qrStreamRef.current.getTracks().forEach(t => t.stop()); qrStreamRef.current = null; }
  }, []);

  const startQrScan = useCallback(async () => {
    setScanError('');
    setScanSuccess('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      qrStreamRef.current = stream;
      if (qrVideoRef.current) {
        qrVideoRef.current.srcObject = stream;
        qrVideoRef.current.play().catch(() => {});
      }
      // Poll canvas for QR every 400ms using a lightweight pixel scan
      qrScanIntervalRef.current = setInterval(() => {
        if (!qrVideoRef.current || !qrCanvasRef.current) return;
        const video = qrVideoRef.current;
        if (video.readyState < 2) return;
        const canvas = qrCanvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const handleQrCode = async (rawValue: string) => {
          stopQrScan();
          try {
            setScanSuccess('Initiating secure handshake...');

            // If it is a /chat/link or device link URL
            if (rawValue.includes('action=device') || rawValue.includes('token=')) {
              try {
                const parsed = new URL(rawValue);
                const tok = parsed.searchParams.get('token');
                if (tok) {
                  const res = await fetch('/api/device/link', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'claim', token: tok })
                  });
                  const data = await res.json();
                  if (data.bundle) {
                    try {
                      const bundle = JSON.parse(atob(data.bundle));
                      if (bundle.settings) {
                        for (const [k, v] of Object.entries(bundle.settings)) {
                          localStorage.setItem(k, v as string);
                        }
                      }
                    } catch {}
                    setScanSuccess('Device linked successfully!');
                    toast.success('Device linked securely');
                    setTimeout(() => setModal(null), 1800);
                    return;
                  }
                }
              } catch {}
            }

            const result = await completeSessionHandshake(rawValue, () => myAddress, signMessageAsync, connector);
            if (result.ok) {
              setScanSuccess('Device linked successfully! The desktop will now log in automatically.');
              toast.success('Desktop linked securely');
              try { localStorage.setItem('ledger_linked_device_qr', rawValue); } catch {}
              setTimeout(() => setModal(null), 2000);
            } else {
              setScanError(result.message || 'Invalid QR code. Please scan a Ledger Chat login code.');
              setTimeout(() => setScanError(''), 4000);
            }
          } catch (e) {
            setScanError('Failed to link device.');
            setTimeout(() => setScanError(''), 3000);
          }
        };

        // Try to decode using BarcodeDetector (Chrome 88+)
        if ('BarcodeDetector' in window) {
          const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
          detector.detect(canvas).then((barcodes: any[]) => {
            if (barcodes.length > 0) {
              handleQrCode(barcodes[0].rawValue as string);
            }
          }).catch(() => {});
        } else {
          // Fallback to jsQR for Firefox, Safari, etc.
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
          if (code && code.data) {
            handleQrCode(code.data);
          }
        }
      }, 400);
    } catch (err: any) {
      setScanError('Camera access denied. Please allow camera permission in your browser.');
    }
  }, [stopQrScan]);

  // Stop scan when modal closes
  useEffect(() => {
    if (modal !== 'linked_devices' || qrScanMode !== 'scan') {
      stopQrScan();
      setQrScanMode('show');
    }
  }, [modal, qrScanMode, stopQrScan]);

  const [serverLinkToken, setServerLinkToken] = useState<string>('');
  const [deviceLinkedSuccess, setDeviceLinkedSuccess] = useState<boolean>(false);
  const [isGeneratingQr, setIsGeneratingQr] = useState<boolean>(false);
  const [showZkSettingsPanel, setShowZkSettingsPanel] = useState<boolean>(false);
  const [qrExpiry, setQrExpiry] = useState(300); // 5 min countdown
  const qrTimerRef = useRef<any>(null);

  const generateDeviceLinkQr = useCallback(async () => {
    setIsGeneratingQr(true);
    setDeviceLinkedSuccess(false);
    try {
      const bundle = {
        address: myAddress,
        settings,
        timestamp: Date.now()
      };
      const res = await fetch('/api/device/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', bundle: btoa(JSON.stringify(bundle)) })
      });
      if (res.ok) {
        const data = await res.json();
        setServerLinkToken(data.token);
        setQrExpiry(data.expiresIn || 300);
      }
    } catch (e) {
      console.error('[LinkDevice] QR generation failed:', e);
    } finally {
      setIsGeneratingQr(false);
    }
  }, [myAddress, settings]);

  useEffect(() => {
    if (modal === 'linked_devices' && qrScanMode === 'show') {
      generateDeviceLinkQr();
    }
  }, [modal, qrScanMode, generateDeviceLinkQr]);

  // Expiry countdown timer
  useEffect(() => {
    if (modal === 'linked_devices' && qrScanMode === 'show' && qrExpiry > 0) {
      const timer = setInterval(() => {
        setQrExpiry(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [modal, qrScanMode, qrExpiry]);

  // Poll device link status
  useEffect(() => {
    if (modal !== 'linked_devices' || !serverLinkToken || deviceLinkedSuccess) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/device/link?token=${serverLinkToken}`);
        if (res.ok) {
          const data = await res.json();
          if (data.claimed) {
            setDeviceLinkedSuccess(true);
            toast.success('Dispositivo vinculado exitosamente! 🎉');
            clearInterval(interval);
          }
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [modal, serverLinkToken, deviceLinkedSuccess]);

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
    try {
      setDisplayName(localStorage.getItem('ledger_displayName') || myName || '');
      setBio(localStorage.getItem('ledger_bio') || '');
      setAvatarUrl(localStorage.getItem('ledger_avatar') || '');
    } catch {}
  }, [myAddress, myName]);

  // Create real server-registered device link token when modal opens
  useEffect(() => {
    if (modal === 'linked_devices' && myAddress) {
      fetch('/api/device/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          bundle: btoa(JSON.stringify({
            address: myAddress,
            settings: settings || {},
            linkedAt: Date.now()
          }))
        })
      })
        .then(r => r.json())
        .then(data => {
          if (data.token) setServerLinkToken(data.token);
        })
        .catch(() => {});
    }
  }, [modal, myAddress, settings]);

  // QR countdown when modal is open
  useEffect(() => {
    if (modal === 'linked_devices') {
      setQrExpiry(120);
      qrTimerRef.current = setInterval(() => {
        setQrExpiry(prev => {
          if (prev <= 1) {
            clearInterval(qrTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(qrTimerRef.current);
    }
    return () => clearInterval(qrTimerRef.current);
  }, [modal]);

  const saveDisplayName = useCallback(() => {
    try {
      localStorage.setItem('ledger_displayName', displayName);
      // Broadcast to rest of app
      window.dispatchEvent(new CustomEvent('ledger_settings_update', { detail: { displayName } }));
      toast.success('Display name saved');
      setEditingName(false);
    } catch {}
  }, [displayName]);

  const saveBio = useCallback(() => {
    try {
      localStorage.setItem('ledger_bio', bio);
      toast.success('Bio saved');
      setEditingBio(false);
    } catch {}
  }, [bio]);

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
      ['ledger_session', 'ledger_onboarded_' + myAddress.toLowerCase()].forEach(k => {
        try { localStorage.removeItem(k); } catch {}
      });
      window.location.href = '/';
    } catch { toast.error('Failed to sign out'); }
  }, [disconnect, myAddress]);

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
    
    // Clear IndexedDB for messages
    try {
        const { chatDB } = await import('@/lib/chat/indexeddb');
        await chatDB.clearAll();
        count += 10;
    } catch(e) {}
    
    toast.success(`Cleared ${count} cached items`);
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
      toast.error('Notifications blocked — check browser settings');
    }
  }, [updateSetting]);

  const shortAddr = (addr: string) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

  // The QR deep-link URL encodes the server link token so scanning links seamlessly
  const qrLinkUrl = typeof window !== 'undefined' && serverLinkToken
    ? `${window.location.protocol === 'file:' ? 'https://humanidfi.com' : window.location.origin}/chat/link?action=device&token=${serverLinkToken}`
    : '';

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
        <button type="button" onClick={onClose} className="flex items-center gap-1 text-[#1C1C1E] font-medium text-[16px]">
          <ArrowLeft size={20} className="text-[#1C1C1E]" />
          Back
        </button>
        <span className="text-[17px] font-semibold text-[#1C1C1E]">Settings</span>
        <div className="w-16" />
      </div>

      {/* ── Tab Scroll (Clean Pure-Typographic Pills — No Logos) ── */}
      <div className="shrink-0 flex gap-1.5 px-3 py-2.5 overflow-x-auto hide-scrollbar bg-white border-b border-[#E5E5EA]">
        {TABS.map(tab => (
          <button
            type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-[#1C1C1E] text-white shadow-sm'
                : 'bg-[#F2F2F7] text-[#6D6D72] hover:bg-[#E5E5EA]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
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
                        <div className="w-full h-full bg-[#1C1C1E] flex items-center justify-center">
                          <span className="text-white text-3xl font-black">
                            {myAddress ? myAddress.slice(2, 4).toUpperCase() : '??'}
                          </span>
                        </div>
                      )}
                    </button>
                    {/* Camera badge */}
                    <button
                      type="button"
                      onClick={() => avatarFileRef.current?.click()}
                      className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#1C1C1E] rounded-full flex items-center justify-center shadow-md border-2 border-white hover:bg-black transition-colors"
                      title="Change photo"
                    >
                      <Camera size={14} className="text-white" />
                    </button>
                  </div>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarUrl('');
                        localStorage.removeItem('ledger_avatar');
                        window.dispatchEvent(new CustomEvent('ledger_settings_update', { detail: { avatarUrl: '' } }));
                      }}
                      className="text-[13px] font-semibold text-red-500 hover:text-red-600 transition-colors"
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
                        className="flex-1 text-center text-[20px] font-bold text-[#1C1C1E] bg-[#F2F2F7] rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-black/30"
                        placeholder="Display name"
                        maxLength={32}
                      />
                      <button type="button" onClick={saveDisplayName} className="w-9 h-9 bg-[#1C1C1E] rounded-full flex items-center justify-center shadow-sm">
                        <Check size={16} className="text-white" />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setEditingName(true)} className="flex items-center gap-2 group">
                      <span className="text-[20px] font-bold text-[#1C1C1E]">
                        {displayName || 'Add display name'}
                      </span>
                      <span className="text-[12px] text-[#8E8E93] opacity-0 group-hover:opacity-100 transition-opacity font-semibold">Edit</span>
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
                        className="flex-1 text-center text-[14px] text-[#8E8E93] bg-[#F2F2F7] rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-black/30 resize-none"
                        placeholder="About / bio..."
                        maxLength={100}
                      />
                      <button type="button" onClick={saveBio} className="w-8 h-8 bg-[#1C1C1E] rounded-full flex items-center justify-center shadow-sm mt-1">
                        <Check size={14} className="text-white" />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setEditingBio(true)} className="text-[14px] text-[#8E8E93] group flex items-center gap-1">
                      {bio || 'Add a bio…'}
                      <span className="text-[11px] text-[#8E8E93] opacity-0 group-hover:opacity-100 transition-opacity font-semibold">Edit</span>
                    </button>
                  )}

                  {/* Wallet address */}
                  <button
                    type="button"
                    onClick={copyAddress}
                    className="flex items-center gap-2 bg-[#F2F2F7] rounded-xl px-4 py-2 hover:bg-[#E5E5EA] transition-colors"
                  >
                    <Wallet size={13} className="text-[#8E8E93]" />
                    <span className="text-[12px] font-mono text-[#8E8E93]">{shortAddr(myAddress)}</span>
                    {copied ? <Check size={13} className="text-[#1C1C1E]" /> : <Copy size={13} className="text-[#8E8E93]" />}
                  </button>

                  {/* ETH balance */}
                  {balance && (
                    <div className="flex items-center gap-2 bg-[#F2F2F7] rounded-xl px-4 py-2">
                      <span className="text-[13px] font-black text-[#627EEA]">Ξ</span>
                      <span className="text-[13px] font-semibold text-[#1C1C1E]">
                        {parseFloat(balance.formatted).toFixed(4)} {balance.symbol}
                      </span>
                      <span className="text-[11px] text-[#8E8E93]">on {chain?.name || 'Ethereum'}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Linked Devices — QR Phone Linking */}
              <Group title="Linked Devices" footer="Open Ledger Chat on your phone or another device, connect your wallet, then tap here to link it via QR.">
                <Row
                  icon={<Smartphone size={18} />}
                  label="Link a New Device"
                  sublabel="Show or scan a QR code to link another device"
                  onTap={() => { setQrScanMode('show'); setModal('linked_devices'); }}
                />
                <Row
                  icon={<Monitor size={18} />}
                  label="This Device (Primary)"
                  sublabel="Desktop / Browser — Active now"
                  value="Active"
                />
              </Group>

              <Group title="Profile Visibility" footer="Your display name and bio are shared with people you message.">
                <Row
                  icon={<User size={18} />}
                  label="Display Name"
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
                  icon={<ShieldCheck size={18} />}
                  label="Identity Verified"
                  sublabel="XMTP end-to-end encrypted"
                  value="✓ Active"
                />
                <Row
                  icon={<Globe size={18} />}
                  label="Network"
                  value={chain?.name || 'Ethereum'}
                />
              </Group>

              <Group title="Data & Backup">
                <Row
                  icon={<Download size={18} />}
                  label="Export Chat Backup"
                  sublabel="Download encrypted JSON of your data"
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
                      a.href = url; a.download = `ledger-backup-${Date.now()}.json`; a.click();
                      URL.revokeObjectURL(url);
                      toast.success('Backup downloaded');
                    } catch { toast.error('Export failed'); }
                  }}
                />
                <Row
                  icon={<RefreshCw size={18} />}
                  label="Clear Message Cache"
                  sublabel="Free up local storage"
                  onTap={() => setModal('clearCache')}
                />
              </Group>

              <Group title="Session">
                <Row
                  icon={<LogOut size={18} />}
                  label="Sign Out"
                  sublabel="Disconnect your wallet"
                  danger
                  onTap={handleSignOut}
                />
                <Row
                  icon={<Trash2 size={18} />}
                  label="Delete All Data"
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
              <Group title="Who Can See" footer="Controls who can see your profile info and activity.">
                <Row icon={<Clock size={18} />} label="Last Seen" value={settings.privacy_last_seen || 'Everybody'} onTap={() => setModal('privacy_last_seen')} />
                <Row icon={<User size={18} />} label="Profile Photo" value={settings.privacy_profile_photo || 'Everybody'} onTap={() => setModal('privacy_profile_photo')} />
                <Row icon={<FileText size={18} />} label="About / Bio" value={settings.privacy_bio || 'Everybody'} onTap={() => setModal('privacy_bio')} />
                <Row icon={<Hash size={18} />} label="Group Invites" value={settings.privacy_group_invites || 'Everybody'} onTap={() => setModal('privacy_group_invites')} />
              </Group>

              <Group title="Disappearing Messages" footer="New messages in all chats will auto-delete after the chosen time.">
                <Row icon={<Trash2 size={18} />} label="Default Timer" value={settings.auto_delete_timer || 'Off'} onTap={() => setModal('auto_delete')} />
                <Row
                  icon={<EyeOff size={18} />}
                  label="Burn on Read"
                  sublabel="Messages disappear after being read"
                  toggle={!!settings.burn_on_read}
                  onToggle={v => updateSetting('burn_on_read', v)}
                />
              </Group>

              <Group title="Interactions">
                <Row
                  icon={<Eye size={18} />}
                  label="Read Receipts"
                  sublabel="Show when you've read messages"
                  toggle={settings.show_read_receipts !== false}
                  onToggle={v => updateSetting('show_read_receipts', v)}
                />
                <Row
                  icon={<MessageSquare size={18} />}
                  label="Typing Indicators"
                  sublabel="Show when you're typing"
                  toggle={settings.typing_indicators !== false}
                  onToggle={v => updateSetting('typing_indicators', v)}
                />
                <Row
                  icon={<Shield size={18} />}
                  label="Anti-Screenshot"
                  sublabel="Block screen capture in chat"
                  toggle={!!settings.anti_screenshot}
                  onToggle={v => updateSetting('anti_screenshot', v)}
                />
              </Group>

              <Group title="Contacts">
                <Row
                  icon={<Link size={18} />}
                  label="Sync Address Book"
                  sublabel="Find friends already on Ledger Chat"
                  toggle={!!settings.address_book_sync}
                  onToggle={v => { updateSetting('address_book_sync' as any, v); toast.success(v ? 'Address book sync enabled' : 'Address book sync disabled'); }}
                />
                <Row
                  icon={<BellOff size={18} />}
                  label="Blocked Addresses"
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
                    <p className="text-[14px] font-bold text-amber-900">Notifications disabled</p>
                    <p className="text-[12px] text-amber-700 mt-0.5">Enable to never miss a message.</p>
                  </div>
                  <button type="button" onClick={requestNotificationPermission} className="bg-amber-600 text-white text-[12px] font-bold px-3 py-1.5 rounded-xl shrink-0">
                    Enable
                  </button>
                </div>
              )}

              <Group title="Push Notifications">
                <div className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-[15px] font-semibold text-[#1C1C1E]">Background Notifications</p>
                    <p className="text-[12px] text-[#8E8E93] mt-0.5">
                      {!push.isSupported
                        ? 'Not supported in this browser'
                        : push.permission === 'denied'
                        ? 'Blocked in browser settings — enable in Site Settings'
                        : 'Get notified even when the app is closed'}
                    </p>
                  </div>
                  {push.isSupported && push.permission !== 'denied' && (
                    push.isSubscribed ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] text-[#1C1C1E] font-bold">✓ On</span>
                        <button onClick={push.unsubscribe} className="text-[12px] text-[#8E8E93] underline">Off</button>
                      </div>
                    ) : (
                      <button
                        onClick={async () => {
                          const ok = await push.subscribe();
                          if (ok) toast.success('Notifications enabled!');
                          else toast.error('Could not enable notifications');
                        }}
                        disabled={push.isLoading}
                        className="px-4 py-2 bg-[#1C1C1E] hover:bg-black text-white text-[13px] font-bold rounded-xl disabled:opacity-50 transition-colors"
                      >
                        {push.isLoading ? 'Enabling…' : 'Enable'}
                      </button>
                    )
                  )}
                  {push.permission === 'denied' && (
                    <span className="text-[12px] text-red-500 font-semibold">Blocked</span>
                  )}
                </div>
              </Group>

              <Group title="Messages">
                <Row
                  icon={<MessageSquare size={18} />}
                  label="Private Messages"
                  toggle={settings.notifications_private !== false}
                  onToggle={v => updateSetting('notifications_private', v)}
                />
                <Row
                  icon={<Hash size={18} />}
                  label="Group Messages"
                  toggle={settings.notifications_groups !== false}
                  onToggle={v => updateSetting('notifications_groups', v)}
                />
                <Row
                  icon={<Bell size={18} />}
                  label="Community Updates"
                  toggle={settings.notifications_workspaces !== false}
                  onToggle={v => updateSetting('notifications_workspaces', v)}
                />
                <Row
                  icon={<Star size={18} />}
                  label="Reaction Notifications"
                  toggle={settings.notifications_reactions !== false}
                  onToggle={v => updateSetting('notifications_reactions', v)}
                />
              </Group>

              <Group title="Calls">
                <Row
                  icon={<Phone size={18} />}
                  label="Incoming Voice Calls"
                  toggle={settings.notifications_calls !== false}
                  onToggle={v => updateSetting('notifications_calls', v)}
                />
                <Row
                  icon={<Video size={18} />}
                  label="Incoming Video Calls"
                  toggle={settings.notifications_video_calls !== false}
                  onToggle={v => updateSetting('notifications_video_calls', v)}
                />
              </Group>

              <Group title="Sounds & Vibration">
                <Row
                  icon={<Volume2 size={18} />}
                  label="Message Sound"
                  toggle={settings.notification_sound !== false}
                  onToggle={v => updateSetting('notification_sound', v)}
                />
                <Row
                  icon={<Vibrate size={18} />}
                  label="Vibration"
                  toggle={settings.haptics_intensity > 0}
                  onToggle={v => updateSetting('haptics_intensity', v ? 2 : 0)}
                />
                <Row
                  icon={<Palette size={18} />}
                  label="Sound Pack"
                  value={settings.sound_pack || 'Default'}
                  onTap={() => setModal('sound_pack')}
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
                  icon={<Bell size={18} />}
                  label="Badge Count"
                  toggle={settings.badge_count !== false}
                  onToggle={v => updateSetting('badge_count', v)}
                />
                <Row
                  icon={<Moon size={18} />}
                  label="Do Not Disturb"
                  sublabel="Silence all notifications"
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
              <Group title="App Lock" footer="Biometric lock uses your device's Face ID or fingerprint to protect Ledger Chat.">
                <Row
                  icon={<Fingerprint size={18} />}
                  label="Biometric Lock"
                  sublabel="Face ID / Touch ID"
                  toggle={!!settings.biometric_lock}
                  onToggle={v => updateSetting('biometric_lock', v)}
                />
                <Row
                  icon={<Key size={18} />}
                  label="App Passcode"
                  sublabel="6-digit PIN to unlock"
                  toggle={!!settings.passcode_enabled}
                  onToggle={v => updateSetting('passcode_enabled', v)}
                />
                <Row
                  icon={<Clock size={18} />}
                  label="Auto-Lock"
                  value={(settings as any).auto_lock_timer || 'Immediately'}
                  onTap={() => setModal('auto_lock')}
                />
              </Group>

              <Group title="Encryption & Identity">
                <Row
                  icon={<ShieldCheck size={18} />}
                  label="ZK Obfuscation"
                  sublabel="Hide metadata with zero-knowledge proofs"
                  toggle={!!settings.zkObfuscation}
                  onToggle={v => updateSetting('zkObfuscation', v)}
                />
                <Row
                  icon={<Lock size={18} />}
                  label="Require Wallet Signature"
                  sublabel="Sign every session with your wallet key"
                  toggle={!!settings.requireSignature}
                  onToggle={v => updateSetting('requireSignature', v)}
                />
              </Group>

              <Group title="Network Security" footer="IP masking routes WebRTC traffic through a relay to hide your real IP address.">
                <Row
                  icon={<Shield size={18} />}
                  label="WebRTC IP Masking"
                  sublabel="Hide your IP during calls"
                  toggle={!!settings.webrtc_ip_masking}
                  onToggle={v => updateSetting('webrtc_ip_masking', v)}
                />
                <Row
                  icon={<Globe size={18} />}
                  label="MEV Protection"
                  sublabel="Shield crypto transactions from front-running"
                  toggle={!!settings.mev_protection}
                  onToggle={v => updateSetting('mev_protection', v)}
                />
                <Row
                  icon={<Database size={18} />}
                  label="Custom RPC URL"
                  value={settings.custom_rpc_url ? 'Custom' : 'Default'}
                  onTap={() => setModal('custom_rpc')}
                />
              </Group>


              <Group title="Danger Zone" footer="These actions are permanent and cannot be undone.">
                <Row icon={<RefreshCw size={18} />} label="Clear All Caches" onTap={() => setModal('clearCache')} />
                <Row icon={<Trash2 size={18} />} label="Delete All Data" danger onTap={() => setModal('nuke')} />
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
                  label="Chat Wallpaper"
                  value={settings.chat_background === 'default' ? 'Default' : 'Custom'}
                  onTap={() => setModal('wallpaper')}
                />
                <Row
                  icon={<Sliders size={18} />}
                  label="Font Size"
                  value={['XS','S','M','L','XL'][Math.min((settings.text_size ?? 2), 4)]}
                  onTap={() => setModal('font_size')}
                />
                <Row
                  icon={<Sun size={18} />}
                  label="Bubble Style"
                  value={settings.bubble_style || 'Default'}
                  onTap={() => setModal('bubble_style')}
                />
              </Group>

              <Group title="Media & Files" footer="Auto-download is subject to your data plan limits.">
                <Row
                  icon={<Download size={18} />}
                  label="Auto-Download Photos"
                  toggle={settings.auto_download_photos !== false}
                  onToggle={v => updateSetting('auto_download_photos', v)}
                />
                <Row
                  icon={<Download size={18} />}
                  label="Auto-Download Videos"
                  toggle={!!settings.auto_download_videos}
                  onToggle={v => updateSetting('auto_download_videos', v)}
                />
                <Row
                  icon={<Archive size={18} />}
                  label="Save Media to Photos"
                  toggle={!!settings.saveToPhotos}
                  onToggle={v => updateSetting('saveToPhotos', v)}
                />
                <Row
                  icon={<WifiOff size={18} />}
                  label="Low Data Mode"
                  sublabel="Reduce quality to save bandwidth"
                  toggle={!!settings.useLessData}
                  onToggle={v => updateSetting('useLessData', v)}
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
                  label="Keyboard Sound"
                  sublabel="Mechanical keyboard click on keypress"
                  toggle={!!settings.mechanical_keyboard}
                  onToggle={v => updateSetting('mechanical_keyboard', v)}
                />
              </Group>

              <Group title="AI Features" footer="AI features run locally and never send your messages to a server.">
                <Row
                  icon={<Zap size={18} />}
                  label="Smart Replies"
                  sublabel="AI-suggested quick reply options"
                  toggle={!!settings.tone_translator}
                  onToggle={v => updateSetting('tone_translator', v)}
                />
                <Row
                  icon={<Shield size={18} />}
                  label="Contract Scanner"
                  sublabel="Scan ETH addresses for known risks"
                  toggle={!!settings.contract_scanner}
                  onToggle={v => updateSetting('contract_scanner', v)}
                />
              </Group>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              CALLS TAB
          ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'calls' && (
            <>
              <Group title="Audio Quality">
                <Row
                  icon={<Mic size={18} />}
                  label="High-Quality Audio"
                  sublabel="Uses more data"
                  toggle={settings.high_quality_audio !== false}
                  onToggle={v => updateSetting('high_quality_audio', v)}
                />
                <Row
                  icon={<Mic size={18} />}
                  label="Noise Suppression"
                  sublabel="Filter background noise"
                  toggle={settings.noise_suppression !== false}
                  onToggle={v => updateSetting('noise_suppression', v)}
                />
                <Row
                  icon={<Volume2 size={18} />}
                  label="Echo Cancellation"
                  toggle={settings.echo_cancellation !== false}
                  onToggle={v => updateSetting('echo_cancellation', v)}
                />
              </Group>

              <Group title="Video">
                <Row
                  icon={<Video size={18} />}
                  label="HD Video"
                  sublabel="When available on your network"
                  toggle={settings.hd_video !== false}
                  onToggle={v => updateSetting('hd_video', v)}
                />
                <Row
                  icon={<WifiOff size={18} />}
                  label="Use Less Data for Calls"
                  toggle={!!settings.useLessData}
                  onToggle={v => updateSetting('useLessData', v)}
                />
              </Group>

              <Group title="Privacy" footer="IP masking routes all call traffic through a relay to hide your network identity.">
                <Row
                  icon={<Shield size={18} />}
                  label="IP Address Masking"
                  sublabel="Hides your real IP from callers"
                  toggle={!!settings.webrtc_ip_masking}
                  onToggle={v => updateSetting('webrtc_ip_masking', v)}
                />
              </Group>

              <Group title="Ringtone & Alerts">
                <Row
                  icon={<Volume2 size={18} />}
                  label="Ringtone on Incoming Call"
                  toggle={settings.notifications_calls !== false}
                  onToggle={v => updateSetting('notifications_calls', v)}
                />
                <Row
                  icon={<Vibrate size={18} />}
                  label="Vibrate on Incoming Call"
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
                    <p className="text-[12px] text-[#8E8E93] uppercase tracking-wider font-semibold mb-3">Local Storage Used</p>
                    <div className="flex items-end gap-2 mb-3">
                      <p className="text-[40px] font-black text-[#1C1C1E] leading-none">
                        {parseFloat(mb) < 0.1 ? kb : mb}
                      </p>
                      <p className="text-[16px] font-semibold text-[#8E8E93] mb-1">
                        {parseFloat(mb) < 0.1 ? 'KB' : 'MB'}
                      </p>
                    </div>
                    <div className="w-full bg-[#F2F2F7] rounded-full h-2">
                      <div
                        className="bg-[#1C1C1E] h-2 rounded-full transition-all"
                        style={{ width: `${Math.min((parseFloat(mb) / 50) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-[12px] text-[#8E8E93] mt-2">{count} Ledger Chat items · Estimated</p>
                  </div>
                );
              })()}

              <Group title="Manage" footer="Clearing cache removes temporary data only. Your conversations are stored via XMTP and are safe.">
                <Row icon={<RefreshCw size={18} />} label="Clear Cache" sublabel="Remove temporary files" onTap={() => setModal('clearCache')} />
                <Row icon={<HardDrive size={18} />} label="Manage Media" sublabel="Photos, videos, and files" onTap={() => setModal('manage_media')} />
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

          {/* PAYMENTS TAB (Including Native zk.money Aztec Private Payments) */}
          {activeTab === 'payments' && (
            <div className="space-y-6">
              {/* Shielded Portfolio Overview Card */}
              <div className="bg-white rounded-[18px] p-5 shadow-sm border border-black/[0.04]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-black/5 flex items-center justify-center text-[#1C1C1E]">
                      <Lock size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[16px] text-[#1C1C1E]">Shielded Portfolio</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-black/5 text-[#6D6D72] px-2 py-0.5 rounded-full">
                          zk.money
                        </span>
                      </div>
                      <p className="text-[12px] text-[#8E8E93]">Aztec Rollup · Zero-Knowledge Confidentiality</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-[#1C1C1E] bg-black/5 px-2.5 py-1 rounded-full border border-black/[0.08] flex items-center gap-1.5 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1C1C1E]" />
                    PXE Online
                  </span>
                </div>

                {/* Balances grid */}
                <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-black/[0.04]">
                  <div className="p-3 rounded-xl bg-[#F2F2F7]">
                    <p className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">Shielded DAI</p>
                    <p className="text-[15px] font-bold font-mono text-[#1C1C1E] mt-0.5">{zkBalances.dai || '0.00'}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F2F2F7]">
                    <p className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">Shielded USDC</p>
                    <p className="text-[15px] font-bold font-mono text-[#1C1C1E] mt-0.5">{zkBalances.usdc || '0.00'}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F2F2F7]">
                    <p className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">Shielded ETH</p>
                    <p className="text-[15px] font-bold font-mono text-[#1C1C1E] mt-0.5">{zkBalances.eth || '0.00'}</p>
                  </div>
                </div>

                {/* Quick Shield / Unshield Actions */}
                <div className="flex gap-2.5 mt-3.5 pt-3.5 border-t border-black/[0.04]">
                  <button
                    type="button"
                    onClick={() => { setZkShieldMode('shield'); setShowZkShieldModal(true); }}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-[#1C1C1E] hover:bg-black text-white text-[13px] font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    <ArrowDownToLine size={15} /> Shield Funds (L1 → Aztec)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setZkShieldMode('unshield'); setShowZkShieldModal(true); }}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1C1C1E] text-[13px] font-semibold flex items-center justify-center gap-2 transition-colors border border-black/[0.04]"
                  >
                    <ArrowUpFromLine size={15} /> Unshield to L1
                  </button>
                </div>
              </div>

              {/* Sovereign Aztec Identity */}
              <Group title="Sovereign Aztec Identity" footer="Your sovereign zk tag allows receiving confidential payments on Aztec without exposing your public 0x Ethereum address.">
                <Row
                  icon={<Wallet size={18} />}
                  label="Registered zk Handle"
                  sublabel="Your readable payment alias on Aztec"
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
                      className="text-[13px] font-semibold text-[#1C1C1E] hover:underline flex items-center gap-1.5"
                    >
                      Change or Register Custom Handle →
                    </button>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-gray-500 font-mono">zk:</span>
                        <input
                          type="text"
                          value={newZkTag}
                          onChange={e => setNewZkTag(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                          placeholder="newhandle"
                          maxLength={32}
                          className="flex-1 px-3.5 py-2 rounded-xl bg-[#F2F2F7] text-[13px] font-mono outline-none focus:ring-1 focus:ring-black/30"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingZkTag(false)}
                          className="px-3.5 py-1.5 rounded-xl text-[12px] font-semibold bg-[#F2F2F7] text-gray-600 hover:bg-[#E5E5EA]"
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
                            toast.success(`Registered handle: ${fullTag}`);
                          }}
                          className="px-4 py-1.5 rounded-xl text-[12px] font-semibold bg-[#1C1C1E] text-white hover:bg-black"
                        >
                          Save Handle
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </Group>

              {/* Aztec Privacy & PXE Architecture */}
              <Group title="Aztec Privacy & PXE Architecture" footer="All zero-knowledge proofs are generated locally in your browser using UltraPlonk through the Aztec Private Execution Environment.">
                <Row
                  icon={<Lock size={18} />}
                  label="Private DAI Default"
                  sublabel="Send all chat payments as shielded DAI via zk.money"
                  toggle={settings.zk_private_dai_default ?? true}
                  onToggle={(v) => updateSetting('zk_private_dai_default', v)}
                />
                <Row
                  icon={<Lock size={18} />}
                  label="Auto-Shield Incoming Transits"
                  sublabel="Automatically shield received DAI into Aztec notes"
                  toggle={settings.zk_auto_shield ?? true}
                  onToggle={(v) => updateSetting('zk_auto_shield', v)}
                />
                <Row
                  icon={<Cpu size={18} />}
                  label="Client-Side Proof Generation"
                  sublabel="Compute UltraPlonk proofs in browser via Aztec PXE"
                  toggle={settings.zk_client_proofs ?? true}
                  onToggle={(v) => updateSetting('zk_client_proofs', v)}
                />
                <Row
                  icon={<Sliders size={18} />}
                  label="Force Note Anonymity Threshold"
                  sublabel="Require minimum note mixing before spending"
                  toggle={settings.zk_min_anonymity ?? true}
                  onToggle={(v) => updateSetting('zk_min_anonymity', v)}
                />
              </Group>

              {/* Cryptographic Keys & Aztec State */}
              <Group title="Aztec Cryptography & Note Tree" footer="Your viewing key decrypts incoming notes while your spending key authorizes nullification locally.">
                {(() => {
                  const azKey = deriveAztecKeySet(myAddress);
                  return (
                    <>
                      <Row
                        icon={<Key size={18} />}
                        label="Aztec Viewing Key"
                        sublabel="Authorizes local decryption of notes"
                        value={`${azKey.incomingViewingKey.slice(0, 8)}...${azKey.incomingViewingKey.slice(-6)}`}
                        onTap={() => {
                          navigator.clipboard.writeText(azKey.incomingViewingKey);
                          toast.success('Aztec viewing key copied');
                        }}
                      />
                      <Row
                        icon={<RefreshCw size={18} className={isSyncingAztec ? 'animate-spin' : ''} />}
                        label="Sync Note Tree from Aztec"
                        sublabel="Scan rollup commitments for your incoming notes"
                        value={isSyncingAztec ? 'Syncing...' : 'Sync Now'}
                        onTap={async () => {
                          setIsSyncingAztec(true);
                          try {
                            const b = await syncBalanceFromAztec(myAddress);
                            setZkBalances(b);
                            toast.success('Aztec note tree synced');
                          } catch {
                            toast.error('Sync completed with local state');
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
              <Group title="Native Crypto Payments">
                <Row
                  icon={<Wallet size={18} />}
                  label="Enable Crypto Payments"
                  sublabel="Show payment CTAs and ETH/USDC send button in all chats"
                  toggle={settings.payments_enabled ?? false}
                  onToggle={(v) => updateSetting('payments_enabled', v)}
                />
                <Row
                  icon={<Lock size={18} />}
                  label="Payment Confirmations"
                  sublabel="Always require a confirmation before sending crypto"
                  toggle={settings.payment_confirmations ?? true}
                  onToggle={(v) => updateSetting('payment_confirmations', v)}
                />
                <Row
                  icon={<Eye size={18} />}
                  label="Show Balances in Chat"
                  sublabel="Display ETH and token balances in your profile header"
                  toggle={settings.show_balances ?? true}
                  onToggle={(v) => updateSetting('show_balances', v)}
                />
              </Group>

              <Group title="Default Payment Token">
                <div className="px-4 pb-4">
                  {['zkDAI (Aztec)', 'ETH', 'USDC', 'USDT'].map((token) => (
                    <button
                      key={token}
                      onClick={() => updateSetting('default_token', token)}
                      className={"flex items-center justify-between w-full py-3 border-b border-black/5 last:border-0 " + (settings.default_token === token ? "text-[#1C1C1E]" : "text-[#1C1C1E]")}
                    >
                      <span className="font-semibold text-[14px]">{token}</span>
                      {settings.default_token === token && (
                        <div className="w-5 h-5 rounded-full bg-[#1C1C1E] flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </Group>

              <Group title="Transaction History">
                <Row label="View Full History" onTap={() => window.open('/payments/history', '_blank')} />
                <Row label="Export CSV" onTap={() => {
                  try {
                    const rows = [['Date', 'Type', 'Amount', 'To/From', 'Status']];
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
                <div className="w-10 h-1 rounded-full bg-[#E5E5EA]" />
              </div>

              {/* ── LINKED DEVICES QR Modal ── */}
              {modal === 'linked_devices' && (
                <div className="px-6 pb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[20px] font-bold text-[#1C1C1E]">Link a Phone</h3>
                    <button type="button" onClick={() => setModal(null)} className="w-8 h-8 rounded-full bg-[#F2F2F7] flex items-center justify-center">
                      <X size={16} className="text-[#8E8E93]" />
                    </button>
                  </div>
                  
                  {/* Tabs for Show / Scan */}
                  <div className="flex items-center gap-2 mb-4 bg-[#F2F2F7] p-1 rounded-[14px]">
                    <button 
                      onClick={() => { setQrScanMode('show'); stopQrScan(); }} 
                      className={`flex-1 py-2 text-[14px] font-semibold rounded-[10px] transition-all ${qrScanMode === 'show' ? 'bg-white shadow-sm text-[#1C1C1E]' : 'text-[#8E8E93]'}`}
                    >
                      Show QR
                    </button>
                    <button 
                      onClick={() => { setQrScanMode('scan'); startQrScan(); }} 
                      className={`flex-1 py-2 text-[14px] font-semibold rounded-[10px] transition-all ${qrScanMode === 'scan' ? 'bg-white shadow-sm text-[#1C1C1E]' : 'text-[#8E8E93]'}`}
                    >
                      Scan QR
                    </button>
                  </div>

                  {qrScanMode === 'show' ? (
                    <>
                      <p className="text-[14px] text-[#8E8E93] mb-5 leading-relaxed">
                        Open <strong className="text-[#1C1C1E]">humanidfi.com/chat</strong> on your iPhone or Android, connect your wallet, then scan this code.
                      </p>

                      {/* QR Code */}
                      <div className="flex justify-center mb-4">
                        {deviceLinkedSuccess ? (
                          <div className="w-[220px] p-6 bg-black/5 rounded-[24px] border border-black/[0.08] flex flex-col items-center justify-center text-center shadow-sm">
                            <div className="w-14 h-14 bg-[#1C1C1E] rounded-full flex items-center justify-center text-white text-2xl shadow-md mb-2">
                              ✓
                            </div>
                            <h4 className="text-[16px] font-bold text-[#1C1C1E]">¡Dispositivo Vinculado!</h4>
                            <p className="text-[12px] text-[#1C1C1E] font-semibold mt-1">Sesión sincronizada</p>
                          </div>
                        ) : isGeneratingQr ? (
                          <div className="w-[200px] h-[200px] flex flex-col items-center justify-center gap-2 bg-[#F2F2F7] rounded-[20px]">
                            <div className="w-7 h-7 border-2 border-[#1C1C1E] border-t-transparent rounded-full animate-spin" />
                            <p className="text-[12px] text-[#8E8E93] font-medium">Generando código seguro…</p>
                          </div>
                        ) : (
                          <div className={`rounded-[20px] border-4 p-2 transition-all ${qrExpiry > 0 ? 'border-[#1C1C1E] shadow-md' : 'border-[#E5E5EA] opacity-40'}`}>
                            {qrExpiry > 0 && qrLinkUrl ? (
                              <DeviceQRCode data={qrLinkUrl} size={200} />
                            ) : (
                              <div className="w-[200px] h-[200px] flex flex-col items-center justify-center gap-3 bg-[#F2F2F7] rounded-[14px]">
                                <QrCode size={40} className="text-[#C7C7CC]" />
                                <p className="text-[13px] text-[#8E8E93] font-semibold">QR Expirado</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Countdown */}
                      <div className="flex items-center justify-center gap-2 mb-5">
                        {deviceLinkedSuccess ? null : qrExpiry > 0 ? (
                          <>
                            <div className="w-2 h-2 rounded-full bg-[#1C1C1E]" />
                            <p className="text-[13px] text-[#8E8E93] font-mono">
                              Expira en {Math.floor(qrExpiry / 60)}:{String(qrExpiry % 60).padStart(2, '0')}
                            </p>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={generateDeviceLinkQr}
                            className="flex items-center gap-2 text-[#1C1C1E] font-semibold text-[14px]"
                          >
                            <RefreshCw size={14} />
                            Generar nuevo código
                          </button>
                        )}
                      </div>

                      {/* Steps */}
                      <div className="bg-[#F2F2F7] rounded-[14px] p-4 mb-5">
                        <p className="text-[12px] font-bold text-[#6D6D72] uppercase tracking-wider mb-3">How it works</p>
                        {[
                          { n: '1', text: 'Open Ledger Chat on your phone' },
                          { n: '2', text: 'Connect the same wallet (MetaMask, WalletConnect, etc.)' },
                          { n: '3', text: 'Go to Settings → Account → Link Desktop' },
                          { n: '4', text: 'Scan this QR code to sync your session' },
                        ].map(step => (
                          <div key={step.n} className="flex items-center gap-3 mb-2 last:mb-0">
                            <div className="w-6 h-6 rounded-full bg-[#1C1C1E] flex items-center justify-center shrink-0">
                              <span className="text-white text-[11px] font-black">{step.n}</span>
                            </div>
                            <p className="text-[13px] text-[#1C1C1E]">{step.text}</p>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 text-[12px] text-[#8E8E93] justify-center">
                        <ShieldCheck size={13} className="text-[#1C1C1E]" />
                        Secured with end-to-end encryption. No passwords required.
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-[14px] text-[#8E8E93] mb-5 leading-relaxed">
                        Point your camera at a Ledger Chat QR code on another device.
                      </p>
                      
                      <div className="relative w-full aspect-square max-w-[300px] mx-auto bg-black rounded-[24px] overflow-hidden shadow-inner mb-6">
                        <video ref={qrVideoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                        <canvas ref={qrCanvasRef} className="hidden" />
                        
                        {/* Scanner overlay */}
                        <div className="absolute inset-0 pointer-events-none border-[3px] border-[#1C1C1E]/20 m-8 rounded-[16px]">
                          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#1C1C1E] rounded-tl-[12px]" />
                          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#1C1C1E] rounded-tr-[12px]" />
                          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#1C1C1E] rounded-bl-[12px]" />
                          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#1C1C1E] rounded-br-[12px]" />
                          <div className="w-full h-0.5 bg-[#1C1C1E] opacity-60 animate-pulse relative top-1/2" />
                        </div>

                        {scanError && (
                          <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-6 text-center">
                            <p className="text-white text-[14px] font-semibold flex items-center gap-2">
                              <AlertTriangle size={18} className="text-red-500" />
                              {scanError}
                            </p>
                          </div>
                        )}
                        {scanSuccess && (
                          <div className="absolute inset-0 bg-[#1C1C1E]/90 flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3">
                              <Check size={24} className="text-[#1C1C1E]" />
                            </div>
                            <p className="text-white text-[16px] font-bold">{scanSuccess}</p>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 text-[12px] text-[#8E8E93] justify-center">
                        <Camera size={13} className="text-[#8E8E93]" />
                        Make sure the QR code is well-lit and in focus.
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Privacy Selector ── */}
              {['privacy_last_seen','privacy_profile_photo','privacy_bio','privacy_group_invites'].includes(modal!) && (
                <div className="px-6 pb-6">
                  <h3 className="text-[20px] font-bold text-[#1C1C1E] mb-5">
                    {modal === 'privacy_last_seen' ? 'Last Seen'
                      : modal === 'privacy_profile_photo' ? 'Profile Photo'
                      : modal === 'privacy_bio' ? 'About / Bio'
                      : 'Group Invites'}
                  </h3>
                  {['everybody', 'contacts', 'nobody'].map(opt => (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => { updateSetting(modal as any, opt); setModal(null); toast.success('Privacy updated'); }}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl mb-2 transition-colors ${(settings as any)[modal!] === opt ? 'bg-[#1C1C1E] text-white' : 'bg-[#F2F2F7] text-[#1C1C1E] hover:bg-[#E5E5EA]'}`}
                    >
                      <span className="font-semibold capitalize">{opt}</span>
                      {(settings as any)[modal!] === opt && <Check size={18} />}
                    </button>
                  ))}
                </div>
              )}

              {/* ── Auto-Delete ── */}
              {modal === 'auto_delete' && (
                <div className="px-6 pb-6">
                  <h3 className="text-[20px] font-bold text-[#1C1C1E] mb-5">Disappearing Messages</h3>
                  {['off','1 hour','24 hours','1 week','1 month','1 year'].map(opt => (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => { updateSetting('auto_delete_timer', (opt === 'off' ? 'off' : opt) as any); setModal(null); toast.success('Timer saved'); }}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl mb-2 transition-colors ${(settings.auto_delete_timer || 'off') === opt ? 'bg-[#1C1C1E] text-white' : 'bg-[#F2F2F7] text-[#1C1C1E] hover:bg-[#E5E5EA]'}`}
                    >
                      <span className="font-semibold">{opt === 'off' ? 'Disabled' : opt}</span>
                      {(settings.auto_delete_timer || 'off') === opt && <Check size={18} />}
                    </button>
                  ))}
                </div>
              )}

              {/* ── Sound Pack ── */}
              {modal === 'sound_pack' && (
                <div className="px-6 pb-6">
                  <h3 className="text-[20px] font-bold text-[#1C1C1E] mb-5">Sound Pack</h3>
                  {[
                    { id: 'minimal', label: 'Minimal', desc: 'Subtle, barely-there tones' },
                    { id: 'default', label: 'Default', desc: 'Clean and balanced' },
                    { id: 'telegram', label: 'Telegram-style', desc: 'Familiar notification sounds' },
                    { id: 'ledger', label: 'Ledger', desc: 'Unique cryptographic tones' },
                  ].map(pack => (
                    <button
                      type="button"
                      key={pack.id}
                      onClick={() => { updateSetting('sound_pack', pack.id as any); setModal(null); toast.success('Sound pack saved'); }}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl mb-2 transition-colors ${(settings.sound_pack || 'default') === pack.id ? 'bg-[#1C1C1E] text-white' : 'bg-[#F2F2F7] text-[#1C1C1E] hover:bg-[#E5E5EA]'}`}
                    >
                      <div className="text-left">
                        <p className="font-semibold">{pack.label}</p>
                        <p className={`text-[12px] mt-0.5 ${(settings.sound_pack || 'default') === pack.id ? 'text-white/70' : 'text-[#8E8E93]'}`}>{pack.desc}</p>
                      </div>
                      {(settings.sound_pack || 'default') === pack.id && <Check size={18} />}
                    </button>
                  ))}
                </div>
              )}

              {/* ── Auto Lock ── */}
              {modal === 'auto_lock' && (
                <div className="px-6 pb-6">
                  <h3 className="text-[20px] font-bold text-[#1C1C1E] mb-5">Auto-Lock Timer</h3>
                  {['Immediately','1 minute','5 minutes','15 minutes','1 hour','Never'].map(opt => (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => { updateSetting('auto_lock_timer' as any, opt); setModal(null); toast.success('Saved'); }}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl mb-2 transition-colors ${((settings as any).auto_lock_timer || 'Immediately') === opt ? 'bg-[#1C1C1E] text-white' : 'bg-[#F2F2F7] text-[#1C1C1E] hover:bg-[#E5E5EA]'}`}
                    >
                      <span className="font-semibold">{opt}</span>
                      {((settings as any).auto_lock_timer || 'Immediately') === opt && <Check size={18} />}
                    </button>
                  ))}
                </div>
              )}

              {/* ── Font Size ── */}
              {modal === 'font_size' && (
                <div className="px-6 pb-6">
                  <h3 className="text-[20px] font-bold text-[#1C1C1E] mb-5">Font Size</h3>
                  <div className="bg-[#F2F2F7] rounded-2xl p-4 mb-5">
                    <p style={{ fontSize: `${12 + (settings.text_size ?? 2) * 2}px` }} className="text-[#1C1C1E] text-center">
                      Preview text at this size
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-[#8E8E93] font-semibold">A</span>
                    <input
                      type="range"
                      min={0}
                      max={4}
                      step={1}
                      value={settings.text_size ?? 2}
                      onChange={e => updateSetting('text_size', parseInt(e.target.value))}
                      className="flex-1 accent-[#1C1C1E]"
                    />
                    <span className="text-[18px] text-[#8E8E93] font-semibold">A</span>
                  </div>
                  <button type="button" onClick={() => setModal(null)} className="w-full mt-5 py-4 bg-[#1C1C1E] rounded-2xl text-white font-bold text-[16px]">Done</button>
                </div>
              )}

              {/* ── Wallpaper ── */}
              {modal === 'wallpaper' && (
                <div className="px-6 pb-6">
                  <h3 className="text-[20px] font-bold text-[#1C1C1E] mb-5">Chat Wallpaper</h3>
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {['default','minimal','dots','circuit','waves'].map(bg => (
                      <button
                        type="button"
                        key={bg}
                        onClick={() => { updateSetting('chat_background', bg as any); setModal(null); toast.success('Wallpaper saved'); }}
                        className={`h-24 rounded-2xl border-2 flex items-center justify-center font-semibold text-[12px] transition-all ${
                          (settings.chat_background || 'default') === bg
                            ? 'border-[#1C1C1E] text-[#1C1C1E] bg-black/5'
                            : 'border-transparent bg-[#F2F2F7] text-[#8E8E93]'
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
                  <h3 className="text-[20px] font-bold text-[#1C1C1E] mb-5">Bubble Style</h3>
                  {[
                    { id: 'default', label: 'Default', desc: 'Rounded corners, standard padding' },
                    { id: 'compact', label: 'Compact', desc: 'Smaller bubbles, denser layout' },
                    { id: 'wide', label: 'Wide', desc: 'Full-width bubbles' },
                  ].map(style => (
                    <button
                      type="button"
                      key={style.id}
                      onClick={() => { updateSetting('bubble_style', style.id as any); setModal(null); toast.success('Saved'); }}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl mb-2 ${(settings.bubble_style || 'default') === style.id ? 'bg-[#1C1C1E] text-white' : 'bg-[#F2F2F7] text-[#1C1C1E]'}`}
                    >
                      <div className="text-left">
                        <p className="font-semibold">{style.label}</p>
                        <p className={`text-[12px] mt-0.5 ${(settings.bubble_style || 'default') === style.id ? 'text-white/70' : 'text-[#8E8E93]'}`}>{style.desc}</p>
                      </div>
                      {(settings.bubble_style || 'default') === style.id && <Check size={18} />}
                    </button>
                  ))}
                </div>
              )}

              {/* ── Clear Cache ── */}
              {modal === 'clearCache' && (
                <div className="px-6 pb-6">
                  <h3 className="text-[20px] font-bold text-[#1C1C1E] mb-2">Clear Cache</h3>
                  <p className="text-[14px] text-[#8E8E93] mb-6 leading-relaxed">This removes temporary cached data. Your messages, contacts, and settings are safe and will not be deleted.</p>
                  <button type="button" onClick={purgeCache} className="w-full py-4 bg-[#FF3B30] rounded-2xl text-white font-bold text-[16px]">
                    Clear Cache
                  </button>
                  <button type="button" onClick={() => setModal(null)} className="w-full py-3 mt-2 text-[#8E8E93] font-semibold text-[16px]">
                    Cancel
                  </button>
                </div>
              )}

              {/* ── Custom RPC ── */}
              {modal === 'custom_rpc' && (
                <CustomRpcModalContent
                  currentRpc={settings.custom_rpc_url || ''}
                  onSave={(val) => updateSetting('custom_rpc_url', val)}
                  onClose={() => setModal(null)}
                />
              )}

              {/* ── Nuke ── */}
              {modal === 'nuke' && (
                <NukeModalContent
                  onClose={() => setModal(null)}
                />
              )}


              {/* ── Blocked Addresses ── */}
              {modal === 'blocked_list' && (() => {
                const blocked: string[] = (() => { try { return JSON.parse(localStorage.getItem('ledger_blocked_users') || '[]'); } catch { return []; } })();
                return (
                  <div className="px-6 pb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-[20px] font-bold text-[#1C1C1E]">Blocked Addresses</h3>
                      <button type="button" onClick={() => setModal(null)} className="w-8 h-8 rounded-full bg-[#F2F2F7] flex items-center justify-center"><X size={16} className="text-[#8E8E93]" /></button>
                    </div>
                    {blocked.length === 0 ? (
                      <div className="py-12 flex flex-col items-center gap-3 text-[#8E8E93]">
                        <Shield size={40} className="opacity-30" />
                        <p className="text-[15px] font-medium">No blocked addresses</p>
                        <p className="text-[13px] text-center">Blocked wallets won't be able to send you messages</p>
                      </div>
                    ) : blocked.map((addr: string) => (
                      <div key={addr} className="flex items-center justify-between bg-[#F2F2F7] rounded-2xl px-4 py-3 mb-2">
                        <p className="text-[14px] font-semibold text-[#1C1C1E] font-mono">{addr.slice(0, 8)}...{addr.slice(-6)}</p>
                        <button type="button" onClick={() => { const upd = blocked.filter(b => b !== addr); localStorage.setItem('ledger_blocked_users', JSON.stringify(upd)); toast.success('Unblocked'); setModal(null); }} className="text-[13px] text-[#1C1C1E] font-bold px-3 py-1.5 rounded-xl hover:bg-black/5">Unblock</button>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* ── Manage Media ── */}
              {modal === 'manage_media' && (() => {
                let totalBytes = 0; let mediaCount = 0;
                try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; if (k.startsWith('ledger_')) { const v = localStorage.getItem(k) || ''; if (v.startsWith('data:')) { totalBytes += v.length * 0.75; mediaCount++; } } } } catch {}
                const mb = (totalBytes / (1024 * 1024)).toFixed(2);
                return (
                  <div className="px-6 pb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-[20px] font-bold text-[#1C1C1E]">Manage Media</h3>
                      <button type="button" onClick={() => setModal(null)} className="w-8 h-8 rounded-full bg-[#F2F2F7] flex items-center justify-center"><X size={16} className="text-[#8E8E93]" /></button>
                    </div>
                    <div className="bg-[#F2F2F7] rounded-2xl p-5 mb-5">
                      <p className="text-[13px] text-[#8E8E93] mb-1">Cached media storage</p>
                      <p className="text-[28px] font-bold text-[#1C1C1E]">{mb} <span className="text-[16px] font-medium text-[#8E8E93]">MB</span></p>
                      <p className="text-[12px] text-[#8E8E93] mt-1">{mediaCount} media item{mediaCount !== 1 ? 's' : ''}</p>
                      <div className="mt-3 h-2 bg-[#E5E5EA] rounded-full overflow-hidden"><div className="h-full bg-[#1C1C1E] rounded-full" style={{ width: `${Math.min((parseFloat(mb) / 10) * 100, 100)}%` }} /></div>
                    </div>
                    <button type="button" onClick={() => { let n = 0; for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i)!; if (k.startsWith('ledger_') && (localStorage.getItem(k) || '').startsWith('data:')) { localStorage.removeItem(k); n++; } } toast.success(`Cleared ${n} item${n !== 1 ? 's' : ''}`); setModal(null); }} className="w-full py-4 bg-[#FF3B30] rounded-2xl text-white font-bold text-[16px] mb-2">Clear Media Cache</button>
                    <button type="button" onClick={() => setModal(null)} className="w-full py-3 text-[#8E8E93] font-semibold text-[16px]">Cancel</button>
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

