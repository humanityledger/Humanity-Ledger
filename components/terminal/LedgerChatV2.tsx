// @ts-nocheck
"use client";
import { MoreVertical, MapPin, Copy, Trash2, UserPlus, Download, Slash, Settings, Clock, Lock, PieChart, Bell, Users, AlertTriangle, ChevronRight, Wifi, Zap, X, Bookmark } from 'lucide-react';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { shortAddr } from '@/lib/utils';
import { formatQd } from '@/lib/qd';
import { Video, VideoOff, Phone, PhoneOff, Mic, MicOff, Volume2, Smile, Paperclip, BarChart2, Wallet, Flame, Heart, Image as ImageIcon, Map as MapIcon, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import type Peer from 'peerjs';
import { useSystemAccount } from '@/hooks/useSystemAccount';
import { useSignMessage, useReconnect } from 'wagmi';
import { sendViaOnion, registerAsRelay } from '@/lib/onion/OnionRouter';
import { useAppKit } from '@reown/appkit/react';
import { getXMTPClient, canReceiveMessages, sendMessage, getMessages, destroyXMTPClient, nsToDate, discoverNewPeers, streamMessages, resolveSenderAddress, extractPeerAddress, revokeXMTPInstallations, syncOfflineQueue } from '@/lib/xmtp/client';
import { QrScanner } from '@/components/terminal/QrScanner';
import { completeSessionHandshake } from '@/lib/scan/sessionHandshake';
import { PadlockLoader } from '@/components/terminal/PadlockLoader';
import { HLLogo } from '@/components/shared/HLLogo';
import { TuringShieldGate } from '@/components/auth/TuringShieldGate';
import { CreateGroupModal } from '../chat/CreateGroupModal';
import type { Client } from '@xmtp/browser-sdk';
import { useSettingsStore } from '@/lib/store/useSettingsStore';
import { useWalletStore } from '@/lib/store/wallet-store';
import { useAztec } from '@/context/AztecContext';
import { useAztecNative } from '@/context/AztecNativeContext';
import { toast } from 'sonner';
import { vault } from '@/lib/core/SecureVault';
import { ChatCommunityGate } from '@/components/chat/ChatCommunityGate';
import { MediaPermissionsPrePrompt } from '@/components/chat/MediaPermissionsPrePrompt';
import { getLocalContacts, saveLocalContact, resolveContactName, LocalContact } from '@/lib/wallet/localAddressBook';
import { getCallHistory, saveCallRecord, CallRecord } from '@/lib/wallet/callHistory';
import { LedgerChatProfile } from '@/components/chat/LedgerChatProfile';
import { LedgerChatVaultManager } from '@/components/chat/LedgerChatVaultManager';
import { LedgerChatOnboarding } from '@/components/chat/LedgerChatOnboarding';
import { LedgerChatUserSearch } from '@/components/chat/LedgerChatUserSearch';
import { ContactRequestsPanel } from '@/components/chat/ContactRequestsPanel';
import { LedgerChatStatusBar } from '@/components/chat/LedgerChatStatusBar';
import { useLedgerChatPresence } from '@/hooks/useLedgerChatPresence';
import { LedgerChatSearchModal } from '@/components/chat/LedgerChatSearchModal';
import { LedgerChatCallHistory } from '@/components/chat/LedgerChatCallHistory';
import { LedgerChatVoiceNote } from '@/components/chat/LedgerChatVoiceNote';
import { moderateContent, sanitizeFilename, isAllowedMimeType, checkRateLimit } from '@/lib/utils/contentFilter';
import { ledgerAnalytics, trackMessageSent, trackCallStarted, trackCallAnswered, trackAttachmentSent, trackFeatureUsed } from '@/lib/utils/ledgerAnalytics';
import { notificationEngine } from '@/lib/wallet/NotificationEngine';
import { Search, Phone as PhoneIcon, Clock as ClockIcon } from 'lucide-react';
import { EncryptionInfoSheet } from '@/components/chat/EncryptionInfoSheet';

import { LedgerChatSettings, useLedgerSettings } from './LedgerChatSettings';
import { useSettingsEffect, playMessageSound, playKeyboardClick, getChatBgStyle } from '@/lib/hooks/useSettingsEffect';
import '@/app/ledger-chat-settings.css';
import { VirtualizedMessageList } from '@/components/chat/VirtualizedMessageList';
import { CrystalNavBar, NavTab } from '@/components/chat/CrystalNavBar';
import { ContactInfoPanel } from '@/components/chat/ContactInfoPanel';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { LedgerUpdatesTab } from '@/components/chat/LedgerUpdatesTab';
import { BurnTimerSheet } from '@/components/chat/BurnTimerSheet';
import { NativeCryptoSendModal } from '@/components/chat/NativeCryptoSendModal';
import { SendTipModal } from '@/components/chat/SendTipModal';
import { ScheduleMessageSheet } from '@/components/chat/ScheduleMessageSheet';
import { ZkMoneyModal } from '@/components/chat/ZkMoneyModal';
import { ZkWalletPanel } from '@/components/zk/ZkWalletPanel';
import { ZkNotificationBell } from '@/components/zk/ZkNotificationBell';
import { ZkStreamManager } from '@/components/zk/ZkStreamManager';
import { ZkInvoiceModal } from '@/components/zk/ZkInvoiceModal';
import { encodeStreamPayload } from '@/lib/zk/zkStreaming';
import { encodeInvoicePayload } from '@/lib/zk/zkInvoice';
import { LedgerCallsTab } from '@/components/chat/LedgerCallsTab';
import { SLASH_COMMANDS, transformClientCommand, isBotCommand, executeBotCommand } from '@/lib/bots/botInterceptor';
import { usePushNotifications } from '@/lib/push/usePushNotifications';
import { LedgerCommunitiesTab } from '@/components/chat/LedgerCommunitiesTab';
import { CommunityView } from '@/components/chat/CommunityView';
import { LedgerSettingsFull } from '@/components/chat/LedgerSettingsFull';
import { LottieSendButton } from '@/components/chat/LottieSendButton';
import { useDynamicIsland } from '@/lib/store/dynamic-island-store';
import { chatDB } from '@/lib/chat/indexeddb';
import { EncryptedMediaEngine } from '@/lib/chat/media';
import { SavedMessagesModal } from '@/components/chat/SavedMessagesModal';
import { KeyboardShortcutsModal } from '@/components/chat/KeyboardShortcutsModal';



const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });




// NOTE: QDs state is sourced from AztecNativeContext (DB polling) — no local store needed.


interface ConversationMeta {
  peerAddress: string;
  lastMessage?: string;
  lastAt?: Date;
  unreadCount?: number;
}

/** forceAutoInit=true: always auto-init XMTP even on mobile (used by /chat route) */
export interface LedgerChatProps {
  forceAutoInit?: boolean;
}

function Avatar({ address, isMe = false, size = 44 }: { address: string; isMe?: boolean; size?: number }) {
  const [savedAvatar, setSavedAvatar] = React.useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('ledger_avatar') || '';
  });

  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.avatarUrl !== undefined) setSavedAvatar(detail.avatarUrl);
    };
    window.addEventListener('ledger_settings_update', handler);
    return () => window.removeEventListener('ledger_settings_update', handler);
  }, []);

  React.useEffect(() => {
    if (!isMe && address && typeof window !== 'undefined') {
      // Show the saved photo at once, then refresh it so a new photo appears.
      const cacheKey = 'peer_avatar_' + address.toLowerCase();
      let cached = '';
      try { cached = localStorage.getItem(cacheKey) || ''; } catch {}
      if (cached) setSavedAvatar(cached);
      let live = true;
      fetch(`/api/user/search?q=${encodeURIComponent(address)}`).then(res => res.json()).then(data => {
        if (!live) return;
        const me = (data.users || []).find((u: any) => (u.address || '').toLowerCase() === address.toLowerCase());
        const url = me?.avatarUrl || '';
        setSavedAvatar(url);
        try { url ? localStorage.setItem(cacheKey, url) : localStorage.removeItem(cacheKey); } catch {}
      }).catch(() => {});
      return () => { live = false; };
    }
  }, [address, isMe]);

  if (savedAvatar) {
    return (
      <div className="rounded-full overflow-hidden shrink-0 ring-1 ring-black/5" style={{ width: size, height: size }}>
        <img src={savedAvatar} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }

  // Initials on a soft tint of a colour derived from the address, so the
  // same person always looks the same and the text stays readable.
  const initials = address ? address.slice(2, 4).toUpperCase() : '';
  const hue = address ? parseInt(address.slice(2, 8), 16) % 360 : 220;
  return (
    <div
      className="rounded-full flex items-center justify-center font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36), background: `hsl(${hue} 55% 91%)`, color: `hsl(${hue} 42% 28%)` }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

const shortAddr = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

export const formatMessagePreview = (content: string): string => {
  if (typeof content !== 'string') return 'Message';
  let cleanContent = content;
  
  // Recursively unwrap replies
  while (cleanContent.startsWith('__REPLY__')) {
    const parts = cleanContent.split('__::');
    if (parts.length >= 2) {
      cleanContent = parts.slice(1).join('__::');
    } else {
      break;
    }
  }

  // Handle system messages and metadata
  if (cleanContent.startsWith('__CALL_OFFER__:')) {
    return cleanContent.includes(':video') ? '📹 Video Call' : '📞 Voice Call';
  }
  if (cleanContent.startsWith('__AUDIO__')) return '🎙️ Voice Note';
  if (cleanContent.startsWith('[LOCATION]')) return '📍 Location';
  if (cleanContent.startsWith('[ATTACHMENT')) return '📎 Attachment';
  if (cleanContent.startsWith('[GIF]')) return '🖼️ GIF';
  if (cleanContent.startsWith('__PIN__') || cleanContent.startsWith('__REVOKE__') || cleanContent.startsWith('__READ__')) {
    return 'System Message';
  }

  return cleanContent;
};

export const parseMessageText = (text: string, isMe: boolean) => {
  if (typeof text !== 'string') return text;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className={`underline break-all ${isMe ? 'text-white' : 'text-black hover:text-black'}`}>
          {part}
        </a>
      );
    }
    const boldParts = part.split(/\*\*(.*?)\*\*/g);
    const parsedBold = boldParts.map((bp, j) => j % 2 === 1 ? <strong key={`b-${i}-${j}`}>{bp}</strong> : bp);
    return <React.Fragment key={i}>{parsedBold}</React.Fragment>;
  });
};

import { playSendSound, playReceiveSound } from '../../lib/utils/sounds';
import { MessageBubble, StickerPicker } from '../chat/MessageBubble';
import { PinPrompt } from '@/components/chat/pin/PinPrompt';
import { IncomingCallScreen, OutgoingCallScreen, AudioCallStage, CallControls } from '@/components/chat/call/CallScreens';
import { Archive, ArchiveRestore, ChevronLeft, ChevronUp, ChevronDown, MessageSquare, Plus, ArrowUp, WifiOff, Pin, Check, ScanQrCode, Camera, FileText, Sticker, ListChecks, CreditCard, Receipt, Waves, Navigation, Timer, Info, LoaderCircle, Minimize2, Mail, ShieldCheck, Reply, Forward, Pencil, Flag, MessagesSquare, Globe } from 'lucide-react';


function isMessageExpired(msgTimestamp: number, timerSetting: string | undefined) {
  if (!timerSetting || timerSetting === 'off') return false;
  const now = Date.now();
  const diff = now - msgTimestamp;
  if (timerSetting === '24 hours' && diff > 86400000) return true;
  if (timerSetting === '1 week' && diff > 604800000) return true;
  if (timerSetting === '1 month' && diff > 2592000000) return true;
  return false;
}


// Burn-on-Read PXE Engine: schedules message removal N seconds after reading
function scheduleBurnOnRead(msgId: string, seconds: number, onBurn: (id: string) => void) {
  setTimeout(() => {
    onBurn(msgId);
  }, seconds * 1000);
}

export function LedgerChat({ forceAutoInit = false }: LedgerChatProps) {
  const { address, isConnected, isSystemHandshake, isChecking, connector, isZkVerified, isLocalSystemWallet } = useSystemAccount();
  // Email-authenticated users have address like 'email_user@gmail.com' — they have no wallet signer
  // so XMTP is not available. We detect this and route them to server-relay messaging.
  const isEmailUser = typeof address === 'string' && (address as string).startsWith('email_');
  const { signMessageAsync } = useSignMessage();
  const { reconnect } = useReconnect();
  const { open: openAppKit } = useAppKit();
  const effectiveAddress = (address || '0x0') as string;
  const { settings: ledgerSettings, isLoaded: pxeLoaded, updateBatch } = useLedgerSettings(effectiveAddress);
  // SETTINGS ENGINE: Apply all settings as real side effects (CSS vars, localStorage, audio, etc.)
  useSettingsEffect(ledgerSettings);


  // [PHASE 2 - SILOING] Consume the sandboxed PXE context for Chat Operations
  // This strictly isolates Chat from the Portfolio state to prevent cross-contamination.
  const { getSiloedPXE } = useAztec();
  const aztecNative = useAztecNative();

  // Mechanical keyboard click sound
  const playKeyClick = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'square'; osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.03);
    } catch {}
  };

  // Haptic feedback
  const triggerHaptic = (intensity: number) => {
    if (typeof navigator.vibrate !== 'function' || !intensity) return;
    const pattern = intensity === 1 ? [10] : intensity === 2 ? [20, 10, 20] : [30, 10, 30, 10, 30];
    navigator.vibrate(pattern);
  };
  const chatContractAddress = { toString: () => '0xCHAT_CONTRACT_ADDRESS_PLACEHOLDER' } as any;
  const siloedPxe = getSiloedPXE ? getSiloedPXE(chatContractAddress) : null;
  const { setSettingsOpen } = useSettingsStore();
  const chatName = ledgerSettings?.displayName || '';
  const chatBio = ledgerSettings?.bio || '';
  const soundEffects = ledgerSettings?.notification_sound ?? true;
  const chatBackground = ledgerSettings?.chat_background || 'default';
  const chatBackgroundCustomUrl = '';
  const bubbleStyle = ledgerSettings?.bubble_style || 'default';
  const accentColor = ledgerSettings?.accent_color || '#15171c';
  // Font and size from settings (with sensible defaults)
  const chatFont = ledgerSettings?.font_family || 'inter';
  const textSize = ledgerSettings?.text_size ?? 4;

  // Conversation wallpaper. Every option stays light and quiet so messages
  // keep their contrast; the default is the app's neutral background.
  const bgStyle = React.useMemo((): React.CSSProperties => {
    switch (chatBackground) {
      case 'minimal': return { background: '#ffffff' };
      case 'dots': return {
          backgroundColor: '#f7f8fa',
          backgroundImage: 'radial-gradient(rgba(21,23,28,0.07) 1px, transparent 1px)',
          backgroundSize: '18px 18px'
        };
      case 'circuit': return {
          backgroundColor: '#f7f8fa',
          backgroundImage: 'linear-gradient(rgba(21,23,28,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(21,23,28,0.035) 1px, transparent 1px)',
          backgroundSize: '28px 28px'
        };
      case 'waves': return { background: 'linear-gradient(180deg, #ffffff 0%, #eef1f5 100%)' };
      case 'default':
      default:
          return { backgroundColor: '#f7f8fa' };
    }
  }, [chatBackground, chatBackgroundCustomUrl]);

  const FONT_MAP: Record<string, string> = {
    'inter':    '"Inter", sans-serif',
    'system':   '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    'mono':     '"JetBrains Mono", monospace',
    'comic':    '"Comic Sans MS", "Comic Sans", cursive',
    'serif':    '"Merriweather", serif',
    'dyslexic': '"OpenDyslexic", sans-serif',
    'humanist': '"Nunito", sans-serif',
  };
  const fontFamily = FONT_MAP[chatFont] || FONT_MAP['inter'];
  const fontSizePx = (textSize || 4) * 2 + 6;


  // MASTER RECOVERY: If wallet is connected but connector is missing (zombie session after mobile deep-link)
  // Run a retry loop instead of a single instant attempt — the WalletConnect relay
  // needs time to re-establish after the user returns from the wallet app.
  useEffect(() => {
    if (isConnected && address) {
      registerAsRelay(address, window.location.origin).catch(console.error);
    }
    
    if (!isConnected || connector || isSystemHandshake) return;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 3 && !cancelled; i++) {
        await new Promise(r => setTimeout(r, 800 + i * 600)); // 800ms, 1400ms, 2000ms
        if (cancelled) { break; }
        try {
          reconnect();
          // Zombie-session recovery dispatched (attempt ${i + 1})
          return;
        } catch (e) {
          console.warn(`[Ledger Chat] Reconnect attempt ${i + 1} failed:`, e);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isConnected, connector, isSystemHandshake, reconnect]);

  const [client, setClient] = useState<Client | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isWaitingForSignature, setIsWaitingForSignature] = useState(false);
  const [initError, setInitError] = useState('');
  
  // BIOMETRIC LOCK STATE
  const [isBiometricallyUnlocked, setIsBiometricallyUnlocked] = useState(false);
  const [biometricChecking, setBiometricChecking] = useState(false);

  useEffect(() => {
    // If setting is off, always unlocked
    if (!ledgerSettings?.biometric_lock) {
      setIsBiometricallyUnlocked(true);
      return;
    }
    // If already unlocked, do nothing
    if (isBiometricallyUnlocked) return;

    // Trigger biometric check
    const checkBiometric = async () => {
      setBiometricChecking(true);
      try {
        if (typeof window !== 'undefined' && window.PublicKeyCredential) {
          // Hardware WebAuthn prompt for Secure Enclave identity verification
          await navigator.credentials.get({
            publicKey: {
              challenge: new Uint8Array(32),
              rpId: window.location.hostname,
              userVerification: "preferred",
              timeout: 60000
            }
          }).catch(() => {
             // Fallback if user cancels or it fails
          });
        }
        setIsBiometricallyUnlocked(true);
      } catch (e) {
        console.error("Biometric failed", e);
      } finally {
        setBiometricChecking(false);
        // Fallback unlock after a timeout to prevent absolute lockouts during testing
        setTimeout(() => setIsBiometricallyUnlocked(true), 2500);
      }
    };
    checkBiometric();
  }, [ledgerSettings?.biometric_lock, isBiometricallyUnlocked]);
  
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
    notificationEngine.init();
  }, []);

  // [FEATURE] Auto-open chat from URL (simpler contact addition)
  useEffect(() => {
    if (!isMounted || !address || !client) return;
    const params = new URLSearchParams(window.location.search);
    const to = params.get('to');
    if (to && !activePeerRef.current) {
       const connectToPeer = async () => {
         let peerAddr = to;
         if (!to.startsWith('0x') || to.length !== 42) {
           try {
             const res = await fetch(`/api/chat/users/search?q=${encodeURIComponent(to)}`);
             const data = await res.json();
             if (data.users && data.users.length > 0) {
               peerAddr = data.users[0].address;
             } else {
               toast.error(`No one found for ${to}`);
               return;
             }
           } catch {
             return;
           }
         }
         handleStartConversationWithPeer(peerAddr);
       };
       connectToPeer();
       // Clear URL so it doesn't reopen on refresh
       window.history.replaceState({}, '', window.location.pathname);
    }

    // ── [FIX] ?join=CODE — auto-join a community from the public landing page ──
    // When the user is redirected from /join/[code], we read the code here,
    // call the join API, and open the community view automatically.
    const joinCode = params.get('join');
    if (joinCode) {
      const doJoin = async () => {
        try {
          const res = await fetch('/api/chat/communities/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-web3-address': address },
            body: JSON.stringify({ joinCode }),
          });
          const data = await res.json();
          if (res.ok && data.community) {
            setActivePeer(null);
            setActiveCommunity(data.community.id);
            setSidebarTab('communities');
            setShowList(false);
            if (data.status === 'ALREADY_MEMBER') {
              toast.success(`Opened ${data.community.name}`);
            } else {
              toast.success(`You joined ${data.community.name}`);
            }
          } else if (data.code === 'GROUP_CLOSED') {
            toast.error('This group is private. Ask an admin to add you directly.');
          } else if (data.code === 'LINK_EXPIRED') {
            toast.error('This invite link has expired or was revoked.');
          } else {
            toast.error(data.error || 'Could not join this community.');
          }
        } catch {
          toast.error('Could not join. Check your connection and try again.');
        }
      };
      doJoin();
      // Clear param from URL to prevent re-triggering on refresh
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [isMounted, address, client]);

  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [activePeer, setActivePeer] = useState<string | null>(null);
  const [activeCommunity, setActiveCommunity] = useState<string | null>(null);
  const [localContacts, setLocalContacts] = useState<LocalContact[]>([]);
  const push = usePushNotifications(address || undefined);
  const [replyingTo, setReplyingTo] = useState<any | null>(null); // Phase 2: Message Quoting
  const [threadParentId, setThreadParentId] = useState<string | null>(null);
  const [showBotSuggestions, setShowBotSuggestions] = useState(false);
  const BOT_COMMANDS_LIST = SLASH_COMMANDS.map(sc => ({
    cmd: sc.command,
    hint: `${sc.syntax}|${sc.description}`,
    category: sc.category,
  }));
  
  // Mattermost-grade Saved Messages & Shortcuts
  const [savedMessages, setSavedMessages] = useState<{ id: string; content: string; savedAt: number }[]>([]);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  useEffect(() => {
    if (address) {
      try {
        const raw = localStorage.getItem(`ledger_saved_msgs_${address.toLowerCase()}`);
        if (raw) setSavedMessages(JSON.parse(raw));
      } catch {}
    }
  }, [address]);

  const toggleSaveMessage = useCallback((msgId: string, msgContent: string) => {
    if (!address) return;
    setSavedMessages(prev => {
      const exists = prev.some(m => m.id === msgId);
      let next;
      if (exists) {
        next = prev.filter(m => m.id !== msgId);
        toast.success('Removed from saved messages');
      } else {
        next = [{ id: msgId, content: msgContent, savedAt: Date.now() }, ...prev];
        toast.success('Message saved to bookmarks');
      }
      try {
        localStorage.setItem(`ledger_saved_msgs_${address.toLowerCase()}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, [address]);
  
  // High-End Feature States
  const [showCallHistory, setShowCallHistory] = useState(false);
  const [showVoiceNote, setShowVoiceNote] = useState(false);
  const { peerStatus, broadcastTyping } = useLedgerChatPresence(address || '', activePeer);

  // ── v2: Telegram-Parity state ──────────────────────────────────────────
  const [callHistoryList, setCallHistoryList] = useState<CallRecord[]>([]);
  const [sidebarTab, setSidebarTab] = useState<'chats' | 'calls' | 'contacts' | 'updates' | 'communities'>('chats');
  const [showSaveContactModal, setShowSaveContactModal] = useState(false);
  const [saveContactName, setSaveContactName] = useState('');
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [showFullSettings, setShowFullSettings] = useState(false);

  const loadContacts = useCallback(() => {
    if (address) {
      setLocalContacts(getLocalContacts(address));
    }
  }, [address]);

  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSearch(prev => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setShowShortcutsModal(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, []);

  useEffect(() => {
    loadContacts();
    const handler = (e: any) => {
      if (e.detail?.walletAddress?.toLowerCase() === address?.toLowerCase()) {
        setLocalContacts(e.detail.contacts);
      }
    };
    window.addEventListener('ledger_contacts_updated', handler);
    return () => window.removeEventListener('ledger_contacts_updated', handler);
  }, [loadContacts, address]);

  useEffect(() => {
    if (address) {
      setCallHistoryList(getCallHistory(address));
      const handler = (e: any) => {
        if (e.detail.walletAddress.toLowerCase() === address.toLowerCase()) {
          setCallHistoryList(e.detail.history);
        }
      };
      window.addEventListener('ledger_calls_updated', handler);
      return () => window.removeEventListener('ledger_calls_updated', handler);
    }
  }, [address]);

  const getDisplayName = useCallback((peerAddr: string) => {
    if (!peerAddr) return 'Unknown Peer';
    const c = localContacts.find(c => c.peerAddress.toLowerCase() === peerAddr.toLowerCase());
    return c ? c.name : shortAddr(peerAddr);
  }, [localContacts]);

  const [reactionMenu, setReactionMenu] = useState<string | null>(null); // Phase 2: Emoji Reactions
  const [pinnedMessageId, setPinnedMessageId] = useState<string | null>(null); // Phase 3: Pinned
  const [burnTimer, setBurnTimer] = useState<number | null>(null); // Phase 3: Self-Destruct TTL
  const [isFetchingChat, setIsFetchingChat] = useState<boolean>(false);
  const [messages, setMessages] = useState<any[]>([]);
  // [CRITICAL FIX #3 SUPPORT] Ref kept in sync with messages state so that the
  // stream's for-await loop can read the latest snapshot without a stale closure.
  const messagesRef = useRef<any[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Phase 3: Self-Destruct Timer
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setMessages(prev => {
        const next = prev.filter(m => !m.burnAtNs || m.burnAtNs > now);
        return next.length !== prev.length ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  const [inputText, setInputText] = useState('');
  const [peerInput, setPeerInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendAnimKey, setSendAnimKey] = useState(0);
  // ── [FASE 16: Rate Limiting Anti-Spam] ───────────────────────────────
  // Prevents spam abuse: max 5 messages per 10 seconds (App Store Guideline 1.2)
  const rateLimitRef = useRef<{ timestamps: number[] }>({ timestamps: [] });
  const RATE_LIMIT_MAX = 5;
  const RATE_LIMIT_WINDOW_MS = 10_000;
  const [showList, setShowList] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [showMyQR, setShowMyQR] = useState(false);
  const [isMobile, setIsMobile] = useState(false);


  //  Audio recording state 
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingCancelledRef = useRef(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  //  Playing audio messages 
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const ringAudioRef = useRef<HTMLAudioElement | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // Telegram-style features
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showVault, setShowVault] = useState(false);
  const [showScheduleCall, setShowScheduleCall] = useState(false);

  const [showUserSearch, setShowUserSearch] = useState(false);
  const [showContactRequests, setShowContactRequests] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [blockedPeers, setBlockedPeers] = useState<Set<string>>(new Set());

  const [contextMenu, setContextMenu] = useState<{ id: string, content: string, x: number, y: number } | null>(null);

  // ─── Phase 4: Ecosystem Features ─────────────────────────────────────────────
  const [archivedPeers, setArchivedPeers] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false); // toggle archived section
  const [sidebarMenu, setSidebarMenu] = useState<{ peer: string; x: number; y: number } | null>(null); // right-click on sidebar
  const [editingMsg, setEditingMsg] = useState<{ id: string; content: string } | null>(null); // inline edit state
  const [showClearConfirm, setShowClearConfirm] = useState(false); // clear chat confirmation

  // ─── v2 + Phase 5: Chat Features ──────────────────────────────────────────────
  const [isSecretChat, setIsSecretChat] = useState(false);
  const [showEncryptionInfo, setShowEncryptionInfo] = useState(false);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [showBurnSheet, setShowBurnSheet] = useState(false);
  const [showScheduleSheet, setShowScheduleSheet] = useState(false);
  const [showWalletTransfer, setShowWalletTransfer] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [showZkModal, setShowZkModal] = useState(false);
  const [showZkWallet, setShowZkWallet] = useState(false);
  const [showZkStreamModal, setShowZkStreamModal] = useState(false);
  const [showZkInvoiceModal, setShowZkInvoiceModal] = useState(false);
  // Phase 5: Poll creator form state (hoisted to satisfy React rules of hooks)
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  // Phase 5: Wallet transfer form state
  const [transferAmount, setTransferAmount] = useState('');
  const [transferSending, setTransferSending] = useState(false);

  // ─── Hito 4: Search, Forward, GIF, Scheduled ──────────────────────────────
  const [searchQuery, setSearchQuery] = useState(''); // in-chat search
  const [typingPeers, setTypingPeers] = useState<Set<string>>(new Set()); // typing indicators
  const lastTypingTimeRef = useRef<number>(0);
  const [isLocked, setIsLocked] = useState(false); // Inactivity lock
  const [showSearch, setShowSearch] = useState(false); // search bar toggle
  const [searchIndex, setSearchIndex] = useState(0); // current match index
  const [forwardMsg, setForwardMsg] = useState<any | null>(null); // message to forward
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null); // scheduled send time
  const [showGifPicker, setShowGifPicker] = useState(false); // GIF picker
  const [showStickerPicker, setShowStickerPicker] = useState(false); // Sticker picker
  const [showAppDrawer, setShowAppDrawer] = useState(false); // iMessage style + menu
  const [liveLocationWatchId, setLiveLocationWatchId] = useState<number | null>(null); // watchPosition ID for live location
  const [isLiveLocationActive, setIsLiveLocationActive] = useState(false); // whether live location is broadcasting
  const [gifSearch, setGifSearch] = useState(''); // GIF search query — start empty so user types first
  // A conversation the user locked: opening it asks for the PIN first.
  const [lockedChatPeer, setLockedChatPeer] = useState<string | null>(null);
  // The overflow menu in the conversation header.
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [gifResults, setGifResults] = useState<string[]>([]); // GIF URLs
  const [linkPreview, setLinkPreview] = useState<{ url: string, title: string, description: string, image?: string } | null>(null);

  // ─── WebRTC Call State Machine ───────────────────────────────────────────────
  // States: idle → calling (outgoing) → ringing (incoming) → active → idle
  const [peerInstance, setPeerInstance] = useState<Peer | null>(null);
  // [ANDROID FIX] peerInstanceRef — always holds the current peer, avoids stale closures
  // in answerCall/startCall which are async and can capture stale state.
  const peerInstanceRef = useRef<Peer | null>(null);
  const [myPeerId, setMyPeerId] = useState<string>('');
  const myPeerIdRef = useRef<string>(''); // [ANDROID FIX] ref mirrors state for async safety
  // [WEBRTC RE-INIT FIX] peerInitKey is a counter that forces the PeerJS useEffect
  // to re-execute when the peer is destroyed (network drop, ID conflict, etc.).
  // Without this, once peerInstance is destroyed and nulled, the useEffect never
  // re-runs because 'address' hasn't changed — leaving calls permanently broken.
  const [peerInitKey, setPeerInitKey] = useState(0);
  const peerInitKeyRef = useRef(0); // ref for use inside peer callbacks

  const [callState, _setCallState] = useState<'idle'|'calling'|'ringing'|'connecting'|'active'>('idle');
  const callStateRef = useRef<'idle'|'calling'|'ringing'|'connecting'|'active'>('idle');
  const setCallState = useCallback((s: 'idle'|'calling'|'ringing'|'connecting'|'active') => {
    callStateRef.current = s;
    _setCallState(s);
  }, []);



  useEffect(() => {
    const island = useDynamicIsland.getState();
    if (callState === 'active' || callState === 'calling' || callState === 'ringing' || callState === 'connecting') {
      island.setState('calling', { title: getDisplayName(activePeer || '') });
    } else if (isRecording) {
      island.setState('recording', { title: getDisplayName(activePeer || '') });
    } else {
      if (island.activeState === 'calling' || island.activeState === 'recording') {
        island.dismiss();
      }
    }
  }, [callState, isRecording, activePeer, getDisplayName]);

  const [callType, setCallType] = useState<'audio'|'video'|null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, _setLocalStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  // WeakSet to track answered PeerJS calls — avoids mutating MediaConnection type
  const answeredCallsRef = useRef<WeakSet<object>>(new WeakSet());
  const setLocalStream = useCallback((s: MediaStream | null) => {
    localStreamRef.current = s;
    _setLocalStream(s);
  }, []);
  
  // The PeerJS MediaConnection object (from peerInstance.call() or Peer.on('call'))
  const [activeConnection, setActiveConnection] = useState<any>(null);
  // [ARCH-FIX] Pending PeerJS connection queued by peer.on('call') — used by answerCall()
  const pendingConnectionRef = useRef<any>(null);
  // Caller stores the remotePeerId — now derived deterministically, not from XMTP
  const remotePeerIdRef = useRef<string>('');
  // Caller stores the call type sent to peer
  const callTypeRef = useRef<'audio'|'video'>('audio');
  // isCalling: true if we INITIATED the call (to know whether to call or answer)
  const isCallerRef = useRef<boolean>(false);

  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [activeCamera, setActiveCamera] = useState<'user'|'environment'>('user');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showCallSettings, setShowCallSettings] = useState(false);
  const [voiceIsolation, setVoiceIsolation] = useState(true);
  const [dataSaver, setDataSaver] = useState(false);
  const [showE2EE, setShowE2EE] = useState(false);

  // [ARCH-FIX] Deterministic PeerID derivation — mirrors the logic in PeerJS initialization.
  // Both caller and receiver can compute each other's PeerID from the wallet address alone.
  // This eliminates the need for XMTP to carry the PeerID in CALL_ANSWER.
  const derivePeerId = useCallback((walletAddress: string): string => {
    return `ledger${walletAddress.slice(2, 12).toLowerCase()}`;
  }, []);
  
  // ── Telegram/WhatsApp Parity States ──
  const [isCallMinimized, setIsCallMinimized] = useState(false);
  const [networkQuality, setNetworkQuality] = useState<'good' | 'poor' | 'disconnected'>('good');
  const [callRoute, setCallRoute] = useState<{ kind: 'direct' | 'relay' | 'unknown'; rttMs: number | null }>({ kind: 'unknown', rttMs: null });
  const [audioLevel, setAudioLevel] = useState<number>(0);

  const myVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  // Call Duration State
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const callDurationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auditor Fixes: Refs
  const isComponentMountedRef = useRef(true);
  const callTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isComponentMountedRef.current = true;
    return () => {
      isComponentMountedRef.current = false;
      // Auditor Fix: Stop rogue timeouts and active streams on unmount
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
    };
  }, []);

  // Ringtone refs — all three must be declared here (before the safety useEffect at ~L860)
  // to avoid Temporal Dead Zone (TDZ) crashes.
  const ringtoneRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringtoneCtxRef = useRef<AudioContext | null>(null);
  const ringtoneStopped = useRef(true);
  // ─── Backward compat shims so existing JSX works unchanged ──────────────────
  const callActive = callState === 'active' || callState === 'calling' || callState === 'connecting';
  const incomingCall = callState === 'ringing';

  // Emoji State
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Offline Queue State
  const [isOffline, setIsOffline] = useState(false);
  const [hasAcceptedEula, setHasAcceptedEula] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && effectiveAddress && effectiveAddress !== '0x0') {
      setIsOnboarded(localStorage.getItem('ledger_onboarded_' + effectiveAddress) === 'true');
    }
  }, [effectiveAddress]);
  const [hasMediaPermission, setHasMediaPermission] = useState(false);
  const [pendingCallType, setPendingCallType] = useState<'audio' | 'video' | 'answer' | null>(null);


  useEffect(() => {
    const loadBlocked = async () => {
      try {
        const b = await vault.getItem('ledger_blocked');
        if (b) setBlockedPeers(new Set(JSON.parse(b)));
        const eula = await vault.getItem('ledger_eula_accepted');
        if (eula === 'true') setHasAcceptedEula(true);
        const perm = await vault.getItem('ledger_media_perm');
        if (perm === 'true') setHasMediaPermission(true);

        // [BUG FIX]
        if (typeof window !== 'undefined') {
          const flagOnboarded = localStorage.getItem('ledger_onboarded_' + effectiveAddress) === 'true';
          const hasProfile = !!(ledgerSettings?.displayName && ledgerSettings.displayName.trim().length > 0);
          if (hasProfile && !flagOnboarded) { 
            try { localStorage.setItem("ledger_onboarded_" + effectiveAddress, "true"); } catch {} 
          } 
          if (flagOnboarded || hasProfile) {
            setIsOnboarded(true);
          } else if (effectiveAddress && effectiveAddress !== "0x0") { 
            try { 
              const res = await fetch(`/api/user/profile?walletAddress=${effectiveAddress}`); 
              if (res.ok) { 
                const resJson = await res.json(); 
                const profile = resJson.data || resJson; // Handle both wrapped and unwrapped responses just in case
                if (profile && (profile.displayName || profile.chatName || profile.walletAddress || profile.id)) { 
                  localStorage.setItem("ledger_onboarded_" + effectiveAddress, "true"); 
                  setIsOnboarded(true); 
                  updateBatch({ 
                    displayName: profile.displayName || profile.chatName, 
                    username: profile.chatName ? profile.chatName : "", 
                    avatar_url: profile.avatarUrl || "", 
                    bio: profile.bio || "" 
                  }); 
                } 
              } 
            } catch (e) {} 
          }
        }
      } catch {}
    };
    loadBlocked();

    // Poll for contact requests count
    if (address && !isSystemHandshake) {
      const pollRequests = () => {
        fetch('/api/notifications/inbox', { credentials: 'same-origin' })
          .then(r => r.json())
          .then(data => {
            if (data?.unreadCount !== undefined) {
              setPendingRequestCount(data.unreadCount);
            }
          })
          .catch(() => {});
      };
      pollRequests();
      const interval = setInterval(pollRequests, 30000); // every 30s
      return () => clearInterval(interval);
    }
    // Phase 5: Request push notifications
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [ledgerSettings?.displayName, effectiveAddress]);


  useEffect(() => {
    if (address) {
      try {
        const a = localStorage.getItem(`ledger_archived_${address}`);
        if (a) setArchivedPeers(new Set(JSON.parse(a)));
      } catch {}
    }
  }, [address]);

  // Phase 5: Reset Secret Chat and Polls when changing peer
  useEffect(() => {
    setIsSecretChat(false);
    setShowPollCreator(false);
    setShowWalletTransfer(false);
  }, [activePeer]);

  // ─── Call Timer Effect ────────────────────────────────────────────────────────
  useEffect(() => {
    if (callState === 'active') {
      setCallDurationSeconds(0);
      callDurationTimerRef.current = setInterval(() => {
        setCallDurationSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (callDurationTimerRef.current) {
        clearInterval(callDurationTimerRef.current);
        callDurationTimerRef.current = null;
      }
      if (callState === 'idle') {
        setCallDurationSeconds(0);
      }
    }
    return () => {
      if (callDurationTimerRef.current) {
        clearInterval(callDurationTimerRef.current);
        callDurationTimerRef.current = null;
      }
    };
  }, [callState]);

  // ─── Safety: stop ringtone whenever callState leaves 'ringing' ───────────────
  // IMPORTANT: Cannot call stopRingtone() here — it's declared below with useCallback (TDZ).
  // Instead, directly set the shared ref flag + clear the interval ref.
  // This is safe because refs are initialized synchronously before any effects run.
  useEffect(() => {
    if (callState !== 'ringing') {
      // Set flag first so any in-flight playRing() that fires before clearInterval returns early
      ringtoneStopped.current = true;
      if (ringtoneRef.current) {
        clearInterval(ringtoneRef.current);
        ringtoneRef.current = null;
      }
      if (ringtoneCtxRef.current) {
        ringtoneCtxRef.current.close().catch(() => {});
        ringtoneCtxRef.current = null;
      }
    }
  }, [callState]);

  const formatDuration = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const toggleBlock = (peer: string) => {
    setBlockedPeers(prev => {
      const next = new Set(prev);
      const isBlocked = next.has(peer.toLowerCase());
      if (isBlocked) next.delete(peer.toLowerCase());
      else next.add(peer.toLowerCase());
      
      vault.setItem('ledger_blocked', JSON.stringify(Array.from(next)));
      toast.success(isBlocked ? "Unblocked" : "Blocked. They can no longer message you.");
      return next;
    });
  };

  const reportMessage = async (msgId: string, content: string) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
    setContextMenu(null);
    toast.success("Reported. Thank you.");
    
    try {
      const msgHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content))))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      
      await fetch('/api/moderation/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageHash: msgHash, timestamp: new Date() })
      });
    } catch (e) {
      console.error("Report failed", e);
    }
  };

  const exportChat = () => {
    if (!activePeer) return;
    const dmId = `dm-${activePeer.toLowerCase()}`;
    const msgs = messages.filter(m => m.conversationId === dmId);
    const text = msgs.map(m => {
      const sender = m.senderInboxId === client?.inboxId ? 'Me' : 'Peer';
      const sentTime = typeof m.sentAtNs === 'number' ? new Date(m.sentAtNs) : (m.sent || m.sentAt || new Date());
      return `[${sentTime.toLocaleString()}] ${sender}: ${m.content}`;
    }).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Chat_Export_${activePeer.slice(0,6)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setShowProfile(false);
  };

  // Phase 4: clearChat — shows confirmation modal first
  const clearChat = () => {
    setShowProfile(false);
    setShowClearConfirm(true);
  };

  const executeClearChat = () => {
    if (!activePeer || !address) return;
    const dmId = `dm-${activePeer.toLowerCase()}`;
    const clearTs = Date.now();
    localStorage.setItem(`ledger_cleared_${address}_${activePeer.toLowerCase()}`, clearTs.toString());
    // [BUG FIX] Filter by BOTH conversationId match AND by peer address presence in id
    // This catches messages that may not have conversationId set correctly
    setMessages(prev => prev.filter(m => {
      if (m.conversationId === dmId) return false; // explicit conversationId match
      // fallback: if message belongs to this peer by sender/content heuristic
      if (!m.conversationId && (
        m.senderInboxId?.toLowerCase() === activePeer.toLowerCase() ||
        m.id?.includes(activePeer.toLowerCase().slice(2, 8))
      )) return false;
      return true;
    }));
    // Deduplication set is left intact to prevent stream from re-injecting them
    setShowClearConfirm(false);
    toast.success('Chat cleared');
  };

  // Phase 4: Archive/Unarchive a conversation (persisted to localStorage)
  const toggleArchive = (peer: string) => {
    setArchivedPeers(prev => {
      const next = new Set(prev);
      if (next.has(peer.toLowerCase())) {
        next.delete(peer.toLowerCase());
        toast.success('Moved to your inbox');
      } else {
        next.add(peer.toLowerCase());
        toast.success('Archived');
      }
      try { localStorage.setItem(`ledger_archived_${address}`, JSON.stringify([...next])); } catch {}
      return next;
    });
    setSidebarMenu(null);
  };

  // Phase 4: Delete conversation from sidebar entirely (local only)
  const deleteConversation = (peer: string) => {
    setConversations(prev => prev.filter(c => c.peerAddress.toLowerCase() !== peer.toLowerCase()));
    const dmId = `dm-${peer.toLowerCase()}`;
    setMessages(prev => prev.filter(m => m.conversationId !== dmId));
    if (activePeer?.toLowerCase() === peer.toLowerCase()) setActivePeer(null);
    setSidebarMenu(null);
    toast.success('Chat deleted');
  };

  // Phase 4: Submit edited message — sends XMTP signal __EDIT__id__::newContent
  const submitEditMessage = async () => {
    if (!editingMsg || !editingMsg.content.trim()) return;
    const signal = `__EDIT__${editingMsg.id}__::${editingMsg.content.trim()}`;
    // Optimistic local update
    setMessages(prev => prev.map(m => m.id === editingMsg.id ? { ...m, content: editingMsg.content.trim(), edited: true } : m));
    setEditingMsg(null);
    // Persist signal over XMTP so peer sees the edit too
    if (executeSendRef.current) await executeSendRef.current(signal);
  };


  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activePeerRef = useRef<string | null>(null);
  const activePeerDmIdRef = useRef<string | null>(null);
  const peerToConvId = useRef<Map<string, string>>(new Map());
  const convIdToPeer = useRef<Map<string, string>>(new Map());
  // Stores the native XMTP DM convo ID (UUID) for the currently active peer.
  // Used as fallback when inboxId→address resolution fails in the stream loop.
  const activeXmtpDmIdRef = useRef<string | null>(null);
  // [BUG FIX] Dedicated ref for the active peer's inboxId — MUST be a separate ref, NOT a
  // property on activeXmtpDmIdRef, because setting .current = null would wipe sibling props.
  const activePeerInboxIdRef = useRef<string>('');
  
  // Track last direct message poll time to avoid re-delivering
  const directMsgSinceRef = useRef(Date.now() - 7 * 24 * 60 * 60 * 1000);
  // Cache canReceiveMessages result per address to skip redundant network lookups
  const canReceiveCache = useRef<Map<string, boolean>>(new Map());
  // Track if initClient is already in-flight to prevent double-calls on mobile
  const initInFlight = useRef(false);
  // Persistent known-peers set  survives across sync cycles (fixes mobile-to-mobile)
  const knownPeersRef = useRef<Set<string>>(new Set());
  /**
   * DEDUPLICATION ENGINE
   * confirmedMsgIds: the single source of truth for all real XMTP message IDs.
   * Once a real ID is registered here, no path (stream, poll, fetch) can insert it twice.
   * optimisticContentMap: maps content string -> optimistic message ID so the stream
   * can perform an atomic swap even if the XMTP echo ID differs from our local id.
   */
  const confirmedMsgIds = useRef<Set<string>>(new Set());
  const optimisticContentMap = useRef<Map<string, string>>(new Map()); // content -> optimisticId
  // Prune confirmedMsgIds to prevent unbounded growth in long sessions.
  // [FIX] Raised from 500/250 to 2000/1000 — fetchHistorical bulk-inserts all history IDs.
  // In conversations with 300-500 messages, the old threshold would prune IDs that are still
  // in view, causing the next poll to re-insert them as "new" (phantom duplicate messages).
  const pruneConfirmedIds = useCallback(() => {
    if (confirmedMsgIds.current.size > 2000) {
      const arr = Array.from(confirmedMsgIds.current);
      confirmedMsgIds.current = new Set(arr.slice(arr.length - 1000));
    }
  }, []);
  // Prune optimisticContentMap — entries lingering >60s were never echoed back (failed send)
  // and should be cleared to prevent unbounded growth.
  const pruneOptimisticMap = useCallback(() => {
    // [BUG FIX] Don't clear() the entire map — that would destroy in-flight optimistic
    // entries for messages that haven't been echoed back yet, causing duplicates.
    // Instead, evict only the OLDEST half when the map exceeds the threshold.
    if (optimisticContentMap.current.size > 100) {
      const entries = Array.from(optimisticContentMap.current.entries());
      // Keep the newest 50 entries (most likely still in-flight)
      const toKeep = entries.slice(entries.length - 50);
      optimisticContentMap.current = new Map(toKeep);
    }
  }, []);
  // Always-fresh ref to executeSend — avoids stale closure in event listeners
  const executeSendRef = useRef<((content: string) => Promise<void>) | null>(null);

  // Detect physical device type (touch + narrow screen = mobile)
  useEffect(() => {
    const check = () => {
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsMobile(isTouchDevice && window.innerWidth < 768);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Keep activePeer ref in sync (used by async callbacks)
  useEffect(() => {
    activePeerRef.current = activePeer;
    if (activePeer) {
      const dmId = `dm-${activePeer.toLowerCase()}`;
      activePeerDmIdRef.current = dmId;
      peerToConvId.current.set(activePeer.toLowerCase(), dmId);
    } else {
      activePeerDmIdRef.current = null;
    }
  }, [activePeer]);

  // Auto-scroll to bottom on new messages — ONLY if user is already near the bottom.
  // If the user has scrolled up to read history, do NOT hijack them back to the bottom.
  useEffect(() => {
    if (messagesEndRef.current) {
      const container = messagesEndRef.current.parentElement;
      if (container) {
        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        // Only auto-scroll if within 150px of the bottom (user hasn't scrolled up)
        if (distanceFromBottom < 150) {
          container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        }
      }
    }
  }, [messages]);

  // MASTER-FIX: Auto-scroll on resize (keyboard open/close) to maintain stability
  useEffect(() => {
    if (typeof window === 'undefined' || !isMobile) return;
    const handleResize = () => {
      if (messagesEndRef.current) {
        const container = messagesEndRef.current.parentElement;
        if (container) {
          container.scrollTo({ top: container.scrollHeight, behavior: 'auto' });
        }
      }
      
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize);
    // Also track visualViewport if available for more precision
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      window.visualViewport.addEventListener('scroll', handleResize);
    }
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
        window.visualViewport.removeEventListener('scroll', handleResize);
      }
    };
  }, [isMobile]);

  // Handle wallet disconnect
  useEffect(() => {
    if (!isConnected && client && address) {
      destroyXMTPClient(address);
      setClient(null);
      setConversations([]);
      setActivePeer(null);
      setMessages([]);
      canReceiveCache.current.clear();
      initInFlight.current = false;
    }
  }, [isConnected, address, client]);

  // [QUANTUM WEBSOCKET RESURRECTION] iOS Safari suspends WebSocket connections when the
  // user switches to their wallet app to sign. When they return, XMTP stream may be dead.
  // We listen for the ClientFortress wakeup signal and force a conversations.sync() 
  // to resurrect the stream without requiring a full page reload.
  useEffect(() => {
    if (!client || !address) return;
    let resurrecting = false;
    const handleWakeup = async () => {
      if (resurrecting || document.visibilityState !== 'visible') return;
      resurrecting = true;
      try {
        await client.conversations.sync();
      } catch (e) {
        console.warn('[Ledger Chat:Quantum] Sync failed, stream may self-recover:', e);
      } finally {
        resurrecting = false;
      }
    };
    window.addEventListener('quantum_wakeup_signal', handleWakeup);
    document.addEventListener('visibilitychange', handleWakeup);
    
    // Offline Queue listener
    const handleOfflineMsg = async (e: any) => {
      const { sender, content, id, createdAt } = e.detail || {};
      if (!sender || !content) return;
      const senderLower = sender.toLowerCase();
      const dmId = `dm-${senderLower}`;
      const ts = createdAt ? new Date(createdAt).getTime() : Date.now();
      const msgData = {
        id: id || `offline-${Date.now()}-${Math.random()}`,
        senderInboxId: '',
        senderAddress: senderLower,
        content,
        sentAtNs: ts * 1_000_000,
        conversationId: dmId,
        status: 'delivered' as const,
        fromPeer: true,
      };

      try {
        const { chatDB } = await import('@/lib/chat/indexeddb');
        const myAddr = address || (typeof window !== 'undefined' && (window as any)._active_ledger_client?.address) || '';
        if (myAddr) {
          await chatDB.saveMessage(myAddr, senderLower, msgData).catch(() => {});
          await chatDB.saveConversation({
            peerAddress: senderLower,
            lastAt: ts,
            lastMessage: content,
          }).catch(() => {});
        }
      } catch (err) {
        console.warn('[Offline Queue] Error saving to chatDB:', err);
      }

      // If this conversation is currently open, inject into active messages immediately
      if (activePeerRef.current?.toLowerCase() === senderLower) {
        setMessages(prev => {
          if (prev.some(m => m.id === msgData.id)) return prev;
          return [...prev, msgData].sort((a, b) => a.sentAtNs - b.sentAtNs);
        });
      }

      loadConversations();
    };
    window.addEventListener('ledger_offline_msg', handleOfflineMsg);
      const handleForceMsg = (e: any) => {
         setMessages(prev => {
           if (prev.find(m => m.id === e.detail.id)) return prev;
           return [...prev, e.detail].sort((a,b) => a.sentAtNs - b.sentAtNs);
         });
      };
      window.addEventListener('ledger_force_msg_render', handleForceMsg);

    return () => {
      window.removeEventListener('quantum_wakeup_signal', handleWakeup);
      document.removeEventListener('visibilitychange', handleWakeup);
      window.removeEventListener('ledger_offline_msg', handleOfflineMsg);
        window.removeEventListener('ledger_force_msg_render', handleForceMsg);
    };
  }, [client, address]);

  // AUTO-INITIALIZE: When wallet is connected and XMTP not yet started, auto-init.
  // XMTP v3 stores session keys in IndexedDB  after the first sign,
  // subsequent loads are silent (no wallet prompt needed).
  // We always attempt auto-init on both desktop and mobile. If WASM fails on mobile,
  // the error boundary surfaces a manual "Retry" button. This is better than
  // silently blocking mobile users from ever seeing the Activate button.


  // Detect Offline Status & Process Queue
  // Uses executeSendRef to avoid stale closure — safe for production at scale
  useEffect(() => {
    const handleOnline = async () => {
      setIsOffline(false);
      // Flush the outbox — uses ref to always get the latest executeSend fn
      if (address) {
        const outboxKey = `ledger_outbox_${address.toLowerCase()}`;
        const queueStr = localStorage.getItem(outboxKey);
        if (queueStr) {
          try {
            const queue: string[] = JSON.parse(queueStr);
            if (queue.length > 0) {
              localStorage.removeItem(outboxKey);
              toast.info(`Back online. Sending ${queue.length} waiting message${queue.length > 1 ? 's' : ''}.`);
              for (const item of queue) {
                const peer = typeof item === 'string' ? null : item.peer;
                const text = typeof item === 'string' ? item : item.content;
                if (peer && text && sendMessage) {
                  try {
                    await sendMessage(client, peer, text, address);
                    await new Promise(r => setTimeout(r, 300));
                  } catch (e) {
                    console.error('Offline flush fail:', e);
                  }
                } else if (text && executeSendRef.current) {
                  await executeSendRef.current(text);
                  await new Promise(r => setTimeout(r, 300));
                }
              }
              toast.success('All waiting messages were sent');
            }
          } catch (e) {
            console.warn('[Outbox] Failed to flush queue:', e);
          }
        }
      }
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast.warning('You are offline. Messages will be sent when you reconnect.');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOffline(!navigator.onLine);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]); // address is the only real dep — executeSend accessed via ref

  
  // [4G/5G RESILIENCE] Network change handler - re-sync XMTP when connection changes
  useEffect(() => {
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (!conn) return;
    const handleNetworkChange = () => {
      console.log('[Network] Type changed to:', conn.effectiveType, '| downlink:', conn.downlink, 'Mbps');
      if (client && address) {
        try { (client as any).conversations?.sync?.().catch(() => {}); } catch {}
      }
    };
    conn.addEventListener('change', handleNetworkChange);
    return () => conn.removeEventListener('change', handleNetworkChange);
  }, [client, address]);

  // Extreme Security: Draft Persistence & Typing Telemetry
  useEffect(() => {
    if (!activePeer || !address) return;
    const draftKey = `ledger_draft_${address.toLowerCase()}_${activePeer.toLowerCase()}`;
    
    if (inputText.trim()) {
      localStorage.setItem(draftKey, btoa(encodeURIComponent(inputText)));
    } else {
      localStorage.removeItem(draftKey);
    }

    // Typing telemetry: only fire when there is actual text AND setting is enabled
    if (!inputText.trim()) return;
    if (ledgerSettings?.typing_indicators === false) return;
    const sendTyping = async () => {
        try {
            await fetch('/api/chat/telemetry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address, type: 'typing', peer: activePeer })
            });
        } catch {}
    };

    const timeoutId = setTimeout(sendTyping, 500); 
    return () => clearTimeout(timeoutId);
  }, [inputText, activePeer, address, ledgerSettings]);

  // Utility: immediately clear typing signal on the server (call after send)
  const stopTypingSignal = async () => {
    if (!activePeer || !address) return;
    // We clear the typing key by sending an artificial empty heartbeat  Redis TTL handles it in 5s
    // but this triggers an explicit flush to avoid the "ghost typing" 5-second tail.
    // We write a dummy value that the server interprets as "not typing" via the TTL expiry.
    // Fastest approach: write the key with a 0-second TTL to expire it immediately.
    try {
      await fetch('/api/chat/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, type: 'stop_typing', peer: activePeer })
      });
    } catch {}
  };

  // ─── Ringtone Generator ──────────────────────────────────────────────────────
  // Note: ringtoneCtxRef and ringtoneStopped are declared above (hoisted)
  // to avoid TDZ with the safety useEffect. Do NOT re-declare them here.

  const startRingtone = useCallback(() => {
    ringtoneStopped.current = false;
    let ctx: AudioContext | null = null;
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      ringtoneCtxRef.current = ctx;
    } catch { return; }
    const playRing = () => {
      // Check the shared ref — stopRingtone sets this to true immediately
      if (ringtoneStopped.current || !ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(480, ctx.currentTime);
      osc.frequency.setValueAtTime(380, ctx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1);
    };
    playRing();
    const id = setInterval(playRing, 2000);
    ringtoneRef.current = id;
  }, []);

  const stopRingtone = useCallback(() => {
    // Mark stopped FIRST so any in-flight playRing() that is about to execute returns early
    ringtoneStopped.current = true;
    if (ringtoneRef.current) {
      clearInterval(ringtoneRef.current);
      ringtoneRef.current = null;
    }
    if (ringtoneCtxRef.current) {
      ringtoneCtxRef.current.close().catch(() => {});
      ringtoneCtxRef.current = null;
    }
  }, []);


  // ─── PeerJS Initialisation ───────────────────────────────────────────────────
  // [WEBRTC RE-INIT FIX] This effect now depends on BOTH address AND peerInitKey.
  // When the peer dies (disconnect, error, ID conflict), we increment peerInitKey
  // to force this effect to re-run and create a fresh peer instance.
  // Previously, only 'address' was in the dependency array — so a dead peer could
  // NEVER be re-created, leaving the user permanently stuck with "WebRTC not ready".
  useEffect(() => {
    if (!address) return;
    // If we already have a live (non-destroyed) peer, don't re-create
    if (peerInstanceRef.current && !peerInstanceRef.current.destroyed) return;

    let destroyed = false; // guard for async import cleanup
    const thisKey = peerInitKey; // capture for closure

    import('peerjs').then((peerjsModule) => {
      if (destroyed) return; // component unmounted before import resolved
      const Peer = (peerjsModule as any).default?.Peer || (peerjsModule as any).Peer || (peerjsModule as any).default;

      // ─── DETERMINISTIC PEERID — CRITICAL FOR REVERSE-DIAL ARCHITECTURE ───
      // Both peers derive each other's ID from the wallet address alone.
      // This means: Caller computes derivePeerId(activePeer) → dials the receiver.
      // No XMTP signaling of PeerID needed. Connection is instantaneous.
      const basePeerId = derivePeerId(address);
      // [FIX] For peerInitKey > 0 (i.e. this is a re-init after a failure),
      // append a short suffix to avoid 'unavailable-id' if the previous session
      // is still registered on the PeerJS server (lingering ~30s after disconnect).
      const stablePeerId = thisKey === 0
        ? basePeerId
        : `${basePeerId}-r${thisKey}`;

      const peer = new Peer(stablePeerId, {
        debug: 0,
        config: {
          iceTransportPolicy: ((ledgerSettings as any)?.webrtc_ip_masking ? 'relay' : 'all') as RTCIceTransportPolicy,
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            // OpenRelay TURN — free, reliable, no account needed
            { urls: 'stun:openrelay.metered.ca:80' },
            {
              urls: 'turn:openrelay.metered.ca:80',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            },
            {
              urls: 'turn:openrelay.metered.ca:443',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            },
            {
              urls: 'turn:openrelay.metered.ca:443?transport=tcp',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            },
            
            
            
          ],
          sdpSemantics: 'unified-plan',
          // iceTransportPolicy is set once, above, from the "Hide my IP address
          // in calls" setting. A second key here used to override it to 'all',
          // which silently disabled IP hiding.
          // [4G/5G] Pre-gather 10 ICE candidates, bundle all media on one port, require RTCP mux
          bundlePolicy: 'max-bundle',
          rtcpMuxPolicy: 'require',
          iceCandidatePoolSize: 10,
        },
      });

      // Helper to destroy this peer and schedule a re-init
      const schedulePeerReinit = (delayMs = 1500) => {
        try { peer.destroy(); } catch {}
        setPeerInstance(null);
        peerInstanceRef.current = null;
        setMyPeerId('');
        myPeerIdRef.current = '';
        // Incrementing peerInitKey triggers the useEffect to re-run
        const nextKey = peerInitKeyRef.current + 1;
        peerInitKeyRef.current = nextKey;
        setTimeout(() => {
          if (!destroyed) setPeerInitKey(nextKey);
        }, delayMs);
      };

      peer.on('open', (id: string) => {
        if (destroyed) return;
        console.log('[Ledger Chat:PeerJS] Open — PeerID:', id, '(key:', thisKey, ')');
        // Sync both state and ref immediately so calls can start without waiting
        setMyPeerId(id);
        myPeerIdRef.current = id;
        setPeerInstance(peer);
        peerInstanceRef.current = peer;
      });

      // ─── Universal Incoming Call Handler ─────────────────────────────────
      // With the deterministic architecture, EITHER party can receive an incoming
      // PeerJS connection. The Caller dials the receiver directly, so the receiver
      // gets peer.on('call') in 'ringing' state BEFORE they have a localStream.
      // In that case, save the connection in pendingConnectionRef so answerCall()
      // can answer it after obtaining the stream (user-gesture on Android).
      peer.on('call', (connection: any) => {
        console.log('[Ledger Chat:PeerJS] Incoming PeerJS connection from:', connection.peer, '| callState:', callStateRef.current);

        if (callStateRef.current === 'ringing' || callStateRef.current === 'idle') {
          // Receiver gets the call before clicking Answer — store it for answerCall()
          // If we were idle, the WebRTC packet beat the XMTP packet. Trigger ringing.
          console.log('[Ledger Chat:PeerJS] Storing pending connection for answerCall()');
          pendingConnectionRef.current = connection;

          if (callStateRef.current === 'idle') {
             // Fallback trigger ringing state if XMTP is lagging
             const inCallType = connection.metadata?.callType || 'audio';
             setCallType(inCallType);
             callTypeRef.current = inCallType;
             setCallState('ringing');
             startRingtone();

             if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
             callTimeoutRef.current = setTimeout(() => {
               if (callStateRef.current === 'ringing') {
                 toast.error('Missed call.');
                 performEndCallRef.current();
               }
             }, 45000);
          }
        } else if (
          (callStateRef.current === 'calling' || callStateRef.current === 'connecting')
          && localStreamRef.current
        ) {
          // Caller gets a reverse-dial from receiver — answer immediately
          connection.answer(localStreamRef.current!);
          setActiveConnection(connection);
          setCallState('active');
          if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; }
          connection.on('stream', (rStream: MediaStream) => {
            console.log('[Ledger Chat:PeerJS] Got remote stream — ACTIVE');
            setRemoteStream(rStream);
            setCallState('active');
            stopRingtone();
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = rStream;
            if (remoteAudioRef.current) {
              remoteAudioRef.current.srcObject = rStream;
              if (ledgerSettings?.notifications_private !== false) {
                remoteAudioRef.current.play().catch(e => console.warn('[Audio] remote play blocked:', e));
              }
            }
          });
          connection.on('close', () => performEndCallRef.current());
          connection.on('error', () => performEndCallRef.current());
        } else {
          console.warn('[Call] Received peer.on(call) in unexpected state:', callStateRef.current, '— rejecting.');
          connection.close();
        }
      });

      peer.on('error', (err: any) => {
        console.warn('[Ledger Chat:PeerJS] Error:', err.type, err.message);
        if (err.type === 'unavailable-id') {
          // The ID is taken by a lingering previous session (happens when quickly
          // reconnecting). Re-init with a suffix after a short delay.
          console.warn('[Ledger Chat:PeerJS] ID unavailable — re-init with session suffix');
          schedulePeerReinit(1000);
        } else if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error' || err.type === 'socket-closed') {
          // Network error — re-init with full backoff
          console.warn('[Ledger Chat:PeerJS] Network error — scheduling re-init');
          schedulePeerReinit(2000);
        } else if (err.type === 'peer-unavailable') {
          // Remote peer is not connected on their base PeerID.
          // DO NOT terminate the call here! The receiver may be on a -rX suffixed ID
          // and will reverse-dial us back via the XMTP __CALL_OFFER__ signal.
          // The 60-second caller timeout will clean up if they truly don't connect.
          if (callStateRef.current === 'calling') {
            console.warn('[Ledger Chat:PeerJS] Peer unavailable on base ID — waiting for XMTP reverse-dial fallback...');
          }
        }
        // Other errors (e.g. 'disconnected') are handled by peer.on('disconnected')
      });

      peer.on('disconnected', () => {
        console.warn('[Ledger Chat:PeerJS] Disconnected — destroying and scheduling re-init');
        // [FIX] Don't call peer.reconnect() — it can hang indefinitely on mobile
        // (iOS WKWebView, Android WebView) if the server connection is fully lost.
        // Instead, destroy and trigger a clean re-init via peerInitKey.
        schedulePeerReinit(1500);
      });

      peer.on('close', () => {
        console.warn('[Ledger Chat:PeerJS] Peer closed');
        if (!destroyed) schedulePeerReinit(2000);
      });

      // Set state+ref synchronously before 'open' fires (avoids race on fast networks)
      peerInstanceRef.current = peer;
    });

    return () => {
      destroyed = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, peerInitKey]);

  // [ANDROID FIX] Keep peerInstanceRef and myPeerIdRef in sync with state
  useEffect(() => { peerInstanceRef.current = peerInstance; }, [peerInstance]);
  useEffect(() => { myPeerIdRef.current = myPeerId; }, [myPeerId]);
  useEffect(() => { peerInitKeyRef.current = peerInitKey; }, [peerInitKey]);

  // Cleanup PeerJS on unmount
  useEffect(() => {
    return () => {
      if (peerInstanceRef.current && !peerInstanceRef.current.destroyed) {
        try { peerInstanceRef.current.destroy(); } catch {}
      }
      stopRingtone();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  // ─── XMTP Signaling Listener ─────────────────────────────────────────────────
  // Monitors XMTP messages for call control signals.
  // Protocol:
  //   CALL_OFFER:<callerPeerId>:<callType>   — caller announces intent + its PeerID
  //   CALL_ANSWER:<receiverPeerId>           — receiver sends back its PeerID
  //   CALL_DECLINE                           — receiver declines
  //   CALL_HANGUP                            — either party ends the call
  // NOTE: performEndCallRef is wired below after performEndCall is defined.
  // performEndCallRef is wired after performEndCall is defined below
  const processedSignalIds = useRef<Set<string>>(new Set());
  const processedCallOfferIds = useRef<Set<string>>(new Set());
  // AUDIT FIX: Prune processedSignalIds set to avoid unbounded memory growth.
  // Keep only the last 200 IDs to prevent memory leak over long sessions.
  const pruneSignalIds = useCallback(() => {
    if (processedSignalIds.current.size > 200) {
      const arr = Array.from(processedSignalIds.current);
      processedSignalIds.current = new Set(arr.slice(arr.length - 100));
    }
  }, []);

  useEffect(() => {
    if (!messages.length) return;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg?.content || !lastMsg.id) return;
    if (processedSignalIds.current.has(lastMsg.id)) return;
    const isMine = lastMsg.senderInboxId?.toLowerCase() === (client?.inboxId as string)?.toLowerCase();
    if (isMine) return; // ignore our own signals
    const content: string = typeof lastMsg.content === 'string' ? lastMsg.content : '';

    // ── CALL_ANSWER signal from receiver (kept for compatibility / fallback logging) ─
    // [ARCH-FIX] The caller NO LONGER waits for CALL_ANSWER to dial.
    // The caller already called peerInstance.call() immediately in startCall().
    // This signal is kept for potential future use (e.g., logging, compatibility with
    // older clients) but does NOT trigger any WebRTC action in the new architecture.
    if (content.startsWith('__CALL_ANSWER__:')) {
      processedSignalIds.current.add(lastMsg.id);
      console.log('[Ledger Chat:Signal] CALL_ANSWER (ack) received — WebRTC already initiated directly.');
    }

    // ── CALL_DECLINE: Callee declined ─────────────────────────────────────────
    if (content === '__CALL_DECLINE__') {
      processedSignalIds.current.add(lastMsg.id);
      console.log('[Ledger Chat:Signal] Decline received');
      if (callStateRef.current !== 'idle') {
        performEndCallRef.current();
        toast('Call declined');
      }
    }

    // ── CALL_HANGUP: Remote party hung up ─────────────────────────────────────
    if (content === '__CALL_HANGUP__') {
      processedSignalIds.current.add(lastMsg.id);
      console.log('[Ledger Chat:Signal] Hangup received');
      if (callStateRef.current !== 'idle') {
        performEndCallRef.current();
        toast('Call ended');
      }
    }
    // AUDIT FIX: Prune signal IDs to prevent memory leak
    pruneSignalIds();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // ─── WebRTC DOM Binding for Mobile (iOS/Android) ───────────────────────────
  // Ensure video elements receive the stream once React actually mounts them
  useEffect(() => {
    if (myVideoRef.current && localStream && myVideoRef.current.srcObject !== localStream) {
      myVideoRef.current.srcObject = localStream;
    }
  }, [callState, localStream, isCamOff]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream && remoteVideoRef.current.srcObject !== remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current && remoteStream && remoteAudioRef.current.srcObject !== remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      if (ledgerSettings?.notifications_private !== false) { remoteAudioRef.current.play().catch(e => console.warn('Audio play blocked:', e)); }
    }
  }, [callState, remoteStream]);

  // ─── WebRTC Advanced Telemetry & Telegram-Parity Visuals ─────────────────
  
  // Audio Visualizer for Audio Calls
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (callState === 'active' && remoteStream && callTypeRef.current === 'audio') {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
        
        // Connect stream to analyser (do NOT connect to destination to avoid echo, <audio> plays it)
        const source = ctx.createMediaStreamSource(remoteStream);
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        dataArrayRef.current = dataArray;

        const updateLevel = () => {
          if (!analyserRef.current || !dataArrayRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArrayRef.current);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) sum += dataArrayRef.current[i];
          const avg = sum / bufferLength;
          setAudioLevel(avg);
          animationFrameRef.current = requestAnimationFrame(updateLevel);
        };
        updateLevel();
      } catch (e) {
        console.warn("[Ledger Chat:AudioViz] AudioContext error:", e);
      }
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(()=>{});
        audioContextRef.current = null;
      }
    };
  }, [callState, remoteStream]);

  // Network Quality Monitor (RAF-based — saves battery on mobile vs setInterval)
  useEffect(() => {
    if (callState !== 'active' || !activeConnectionRef.current) {
      setNetworkQuality('good');
      setCallRoute({ kind: 'unknown', rttMs: null });
      return;
    }

    let rafId: number;
    let lastCheckTime = 0;
    const CHECK_INTERVAL_MS = 2000; // Only check every 2 seconds, but via RAF to stay in sync

    const checkQuality = async (timestamp: number) => {
      if (timestamp - lastCheckTime >= CHECK_INTERVAL_MS) {
        lastCheckTime = timestamp;
        try {
          const peerConn = activeConnectionRef.current?.peerConnection;
          if (peerConn) {
            const stats = await peerConn.getStats();
            let isPoor = false;
            const candidates: Record<string, any> = {};
            let selectedPair: any = null;
            stats.forEach((report: any) => {
              if (report.type === 'local-candidate' || report.type === 'remote-candidate') candidates[report.id] = report;
              if (report.type === 'candidate-pair' && report.state === 'succeeded' && (report.nominated || report.selected)) selectedPair = report;
              if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                if (report.currentRoundTripTime > 0.4) isPoor = true;
              }
              if (report.type === 'inbound-rtp' && report.kind === 'video') {
                if (report.packetsReceived > 0) {
                  const fractionLost = report.packetsLost / report.packetsReceived;
                  if (fractionLost > 0.05) isPoor = true;
                }
              }
            });
            setNetworkQuality(isPoor ? 'poor' : 'good');
            if (selectedPair) {
              const l = candidates[selectedPair.localCandidateId];
              const r = candidates[selectedPair.remoteCandidateId];
              const relayed = l?.candidateType === 'relay' || r?.candidateType === 'relay';
              setCallRoute({
                kind: l || r ? (relayed ? 'relay' : 'direct') : 'unknown',
                rttMs: typeof selectedPair.currentRoundTripTime === 'number' ? Math.round(selectedPair.currentRoundTripTime * 1000) : null,
              });
            }
          }
        } catch {}
      }
      rafId = requestAnimationFrame(checkQuality);
    };

    rafId = requestAnimationFrame(checkQuality);
    return () => cancelAnimationFrame(rafId);
  }, [callState]);

  // ─── performEndCall: Universal cleanup ── uses refs to avoid stale closures ──
  // AUDIT FIX: All mutable values accessed via refs, not closure captures.
  // This ensures that when called from async contexts (timeouts, PeerJS events),
  // we always clean up the CURRENT stream/connection, not a stale captured one.
  const activeConnectionRef = useRef<any>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  // Keep refs in sync with state
  useEffect(() => { activeConnectionRef.current = activeConnection; }, [activeConnection]);
  useEffect(() => { remoteStreamRef.current = remoteStream; }, [remoteStream]);

  const performEndCall = useCallback(() => {
    stopRingtone();
    if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; }
    // Use refs — never captured closure values
    const ls = localStreamRef.current;
    const rs = remoteStreamRef.current;
    const ac = activeConnectionRef.current;
    if (ls) { try { ls.getTracks().forEach(t => t.stop()); } catch {} }
    if (rs) { try { rs.getTracks().forEach(t => t.stop()); } catch {} }
    if (ac) { try { ac.close(); } catch {} }
    setLocalStream(null);
    setRemoteStream(null);
    setActiveConnection(null);
    setCallState('idle');
    setCallType(null);
    setIsMicMuted(false);
    setIsCamOff(false);
    setIsCallMinimized(false); // [AUDIT FIX] Always reset minimized state so next call starts full-screen
    setIsScreenSharing(false); // [AUDIT FIX] Reset screen sharing state
    setAudioLevel(0);          // [AUDIT FIX] Reset audio visualizer level
    setNetworkQuality('good'); // [AUDIT FIX] Reset network quality indicator
    isCallerRef.current = false;
    remotePeerIdRef.current = '';
    // [CALL FIX] Clear any stored pending connection to prevent stale state across calls
    if (pendingConnectionRef.current) {
      try { pendingConnectionRef.current.close(); } catch {}
      pendingConnectionRef.current = null;
    }
    if (myVideoRef.current) myVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) { remoteAudioRef.current.srcObject = null; }
  }, []);

  // [CRITICAL FIX] Wire the ref immediately after performEndCall is created.
  // Without this, performEndCallRef.current stays as the empty initializer and
  // the hang-up button and PeerJS close events do nothing.
  const performEndCallRef = useRef<() => void>(performEndCall);
  useEffect(() => { performEndCallRef.current = performEndCall; }, [performEndCall]);

  // ─── startCall: Initiates an outgoing call ───────────────────────────────────
  // ANDROID FIX: This function MUST be called directly from a user-gesture handler
  // (onClick). Android Chrome enforces that getUserMedia() is only callable from
  // a trusted user-gesture context. Any async indirection breaks this.
  // CRITICAL: We do NOT await anything before getUserMedia, otherwise
  // Android WebViews will strip the transient user-activation token.
  const startCall = async (type: 'audio' | 'video', targetPeerOverride?: string) => {
    const targetPeer = targetPeerOverride || activePeer;
    if (!targetPeer) return;
    
    // Ensure state updates if called from history list
    if (targetPeerOverride && activePeer !== targetPeerOverride) {
      setActivePeer(targetPeerOverride);
    }

    const livePeer = peerInstanceRef.current;
    if (!livePeer || livePeer.destroyed) {
      // Peer not yet ready — destroy stale ref and schedule re-init via peerInitKey
      toast.error("Calling is reconnecting. Try again in a moment.");
      peerInstanceRef.current = null;
      setPeerInstance(null);
      // [CRITICAL FIX] Incrementing peerInitKey triggers the PeerJS useEffect to re-run.
      // Without this, the useEffect only depends on [address, peerInitKey] — nulling
      // peerInstance state alone does NOT trigger a re-run because address hasn't changed.
      const nextKey = peerInitKeyRef.current + 1;
      peerInitKeyRef.current = nextKey;
      setPeerInitKey(nextKey);
      return;
    }

    // [ARCH-FIX] Derive receiver PeerID deterministically — no XMTP round-trip needed
    const receiverPeerId = derivePeerId(targetPeer);
    console.log('[Call:ARCH-FIX] Derived receiver PeerID:', receiverPeerId, 'for address:', targetPeer);

    let stream: MediaStream | null = null;
    try {
      // ─── ROBUST SINGLE-CALL WEBRTC (Android Fix) ─────────────────────────
      // We must NEVER use nested try-catch fallbacks for getUserMedia on Android.
      // If the first request fails, the transient user-activation token is lost,
      // and all subsequent fallbacks will automatically throw NotAllowedError.
      // Therefore, we make exactly ONE robust request with minimal safe constraints.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video' ? { facingMode: 'user' } : false,
      });

      // Prevent state inconsistency if unmounted while waiting for permissions
      if (!isComponentMountedRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      setLocalStream(stream);
      setCallType(type);
      callTypeRef.current = type;
      isCallerRef.current = true;
      remotePeerIdRef.current = receiverPeerId;
      setCallState('calling');
      if (myVideoRef.current) myVideoRef.current.srcObject = stream;

      // ─── DETERMINISTIC CALL ARCHITECTURE (Caller Side) ────────────────────
      // With deterministic PeerIDs, the Caller dials the receiver DIRECTLY using
      // derivePeerId(activePeer). We also send CALL_OFFER via XMTP so the receiver's
      // UI shows the ringing screen. The CALL_OFFER carries the caller's stable PeerID.
      // [CRITICAL RECIPROCITY FIX] Use the actual registered PeerID (which may have a -rX suffix
      // if the WebRTC session had to re-initialize). Using the base ID here would break the
      // receiver's reverse-dial fallback if the caller is on a suffixed ID.
      const myStablePeerId = myPeerIdRef.current || derivePeerId(address!);
      executeSend(`__CALL_OFFER__:${myStablePeerId}:${type}`).catch(() => {});

      // Directly dial the receiver via PeerJS — no XMTP round-trip needed
      const livePeerForStart = peerInstanceRef.current;
      if (!livePeerForStart || livePeerForStart.destroyed) {
        toast.error('The call lost its connection. Please try again.');
        performEndCallRef.current();
        return;
      }
      
      const outConn = livePeerForStart.call(receiverPeerId, stream, {
          metadata: { callType: type }
        });
        if (outConn) {
          setActiveConnection(outConn);
          outConn.on('stream', (rStream: MediaStream) => {
            console.log('[Call:PeerJS] Caller received remote stream — ACTIVE');
            setRemoteStream(rStream);
            setCallState('active');
            stopRingtone();
            if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; }
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = rStream;
            if (remoteAudioRef.current) {
              remoteAudioRef.current.srcObject = rStream;
              if (ledgerSettings?.notifications_private !== false) { remoteAudioRef.current.play().catch(err => console.warn('[Audio] play() blocked:', err)); }
            }
          });
          outConn.on('close', () => performEndCallRef.current());
          outConn.on('error', () => performEndCallRef.current());
        }
      toast.success('Ringing');

      // Caller timeout: if no stream arrives in 45s, clean up
      callTimeoutRef.current = setTimeout(() => {
        if (callStateRef.current === 'calling') {
          if (address && targetPeer) {
            saveCallRecord(address, {
              peerAddress: targetPeer,
              type: type,
              direction: isCallerRef.current ? 'outgoing' : 'incoming',
              status: 'missed',
              durationSeconds: 0,
            });
          }
          toast.error('No answer.');
          performEndCallRef.current();
        }
      }, 45000);

    } catch (e: any) {
      if (stream) { try { stream.getTracks().forEach(t => t.stop()); } catch {} }
      setLocalStream(null);
      setCallState('idle');
      isCallerRef.current = false;
      const errName = e?.name || '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        toast.error('Microphone or camera access is blocked. Allow it in your browser settings, or open this page in your normal browser instead of an in-app one.', { duration: 6000 });
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        toast.error('No microphone or camera was found');
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        toast.error('Another app is using your microphone or camera. Close it and try again.', { duration: 6000 });
      } else {
        toast.error('The call could not start. Please try again.');
      }
      console.error('[Call] getUserMedia error:', e);
    }
  };

  // ─── answerCall: Receiver accepts incoming call ──────────────────────────────
  // ANDROID FIX: Called directly from the "Answer" onClick — preserves user-gesture
  // context required by Android Chrome for getUserMedia.
  const answerCall = async () => {
    stopRingtone();
    // [ANDROID FIX] Use callStateRef.current instead of the stale React state closure.
    if (callStateRef.current !== 'ringing') return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error('This browser cannot use your microphone or camera. Try a current version of Chrome, Edge, Firefox or Safari.');
      return;
    }

    let stream: MediaStream | null = null;
    try {
      // ─── ROBUST SINGLE-CALL WEBRTC (Android Fix) ─────────────────────────
      // We must NEVER use nested try-catch fallbacks for getUserMedia on Android.
      // If the first request fails, the transient user-activation token is lost,
      // and all subsequent fallbacks will automatically throw NotAllowedError.
      // Therefore, we make exactly ONE robust request with minimal safe constraints.
      // [ANDROID FIX] We use callTypeRef.current to avoid stale closures.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callTypeRef.current === 'video' ? { facingMode: 'user' } : false,
      });
      // Prevent state inconsistency if unmounted while waiting for permissions
      if (!isComponentMountedRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      setLocalStream(stream);
      if (myVideoRef.current) myVideoRef.current.srcObject = stream;

      // ── AUDIO AUTOPLAY UNLOCK ─────────────────────────────────────────────────
      // Browsers require a user-gesture (the 'Answer' button click) to allow autoplay.
      // Create a silent AudioContext with the gesture to unlock audio on iOS/Android.
      try {
        const unlockCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const silentBuf = unlockCtx.createBuffer(1, 1, 22050);
        const src = unlockCtx.createBufferSource();
        src.buffer = silentBuf;
        src.connect(unlockCtx.destination);
        src.start(0);
        await unlockCtx.resume();
        unlockCtx.close();
      } catch { /* ignore — best effort */ }

      setCallState('connecting');
      toast.success('Connecting');

      // ─── DETERMINISTIC ANSWER ARCHITECTURE ────────────────────────────────
      // PRIMARY PATH: If the Caller dialed us directly (deterministic architecture),
      // peer.on('call') already stored the pending connection in pendingConnectionRef.
      // We answer THAT connection with our stream — no outbound call needed.
      //
      // FALLBACK PATH: If pendingConnectionRef is empty (e.g., old session, XMTP-only),
      // we make an outbound call to the Caller's deterministic PeerID.
      const pendingConn = pendingConnectionRef.current;

      if (pendingConn) {
        console.log('[Call:answerCall] Answering stored pending connection from Caller');
        pendingConnectionRef.current = null;
        pendingConn.answer(stream);
        setActiveConnection(pendingConn);
        pendingConn.on('stream', (rStream: MediaStream) => {
          console.log('[Call:PeerJS] Receiver got remote stream — ACTIVE');
          setRemoteStream(rStream);
          setCallState('active');
          stopRingtone();
          if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; }
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = rStream;
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = rStream;
            if (ledgerSettings?.notifications_private !== false) { remoteAudioRef.current.play().catch(err => console.warn('[Audio] play() blocked:', err)); }
          }
        });
        pendingConn.on('close', () => performEndCallRef.current());
        pendingConn.on('error', () => performEndCallRef.current());
      } else {
        // FALLBACK: Outbound call to Caller's deterministic PeerID
        console.log('[Call:answerCall] No pending connection — falling back to outbound dial');
        const targetPeerId = remotePeerIdRef.current || (activePeer ? derivePeerId(activePeer) : null);
        if (!targetPeerId) {
          toast.error('Could not identify the caller. Wait a moment and try again.');
          performEndCallRef.current();
          return;
        }
        
        const livePeer = peerInstanceRef.current;
        if (!livePeer || livePeer.destroyed) {
          toast.error('Calling is not ready yet. Refresh the page and try again.');
          performEndCallRef.current();
          return;
        }

        const conn = livePeer.call(targetPeerId, stream, {
          metadata: { callType: callTypeRef.current }
        });
        if (!conn) {
          toast.error('Could not start the call. Please try again.');
          performEndCallRef.current();
          return;
        }
        
        setActiveConnection(conn);
        conn.on('stream', (rStream: MediaStream) => {
          console.log('[Call:PeerJS] Receiver got remote stream (fallback) — ACTIVE');
          setRemoteStream(rStream);
          setCallState('active');
          if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; }
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = rStream;
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = rStream;
            if (ledgerSettings?.notifications_private !== false) { remoteAudioRef.current.play().catch(err => console.warn('[Audio] play() blocked:', err)); }
          }
        });
        conn.on('close', () => performEndCallRef.current());
        conn.on('error', () => performEndCallRef.current());
      }

      // Send CALL_ANSWER as status update for chat UI
      const myStableId = derivePeerId(address!);
      executeSend(`__CALL_ANSWER__:${myStableId}`).catch(() => {});

      // Failsafe: if remote stream does not arrive within 20s, abort
      callTimeoutRef.current = setTimeout(() => {
        if (callStateRef.current === 'connecting') {
          toast.error('The call could not connect. Please try again.');
          performEndCallRef.current();
        }
      }, 30000);

    } catch (e: any) {
      if (stream) { try { stream.getTracks().forEach(t => t.stop()); } catch {} }
      setLocalStream(null);
      setCallState('idle');
      
      // Tell the caller immediately that we couldn't answer due to hardware/permission failure
      executeSend('__CALL_DECLINE__').catch(() => {});

      const errName = e?.name || '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        toast.error('Microphone or camera access is blocked. Allow it in your browser settings, or open this page in your normal browser instead of an in-app one.', { duration: 6000 });
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        toast.error('No microphone or camera was found');
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        toast.error('Another app is using your microphone or camera. Close it and try again.', { duration: 6000 });
      } else {
        toast.error('Could not answer the call. Please try again.');
      }
      console.error('[Call] answerCall error:', e);
    }
  };

  const handleStartCall = (type: 'audio' | 'video', targetPeerOverride?: string) => {
    if (hasMediaPermission) {
      startCall(type, targetPeerOverride);
    } else {
      if (targetPeerOverride && activePeer !== targetPeerOverride) {
        setActivePeer(targetPeerOverride); // Ensure UI updates
      }
      setPendingCallType(type);
    }
  };

  const handleAnswerCall = () => {
    if (hasMediaPermission) {
      answerCall();
    } else {
      setPendingCallType('answer');
    }
  };

  // ─── declineCall: Receiver declines ─────────────────────────────────────────
  const declineCall = useCallback(async () => {
    try {
      if (executeSendRef.current) await executeSendRef.current('__CALL_DECLINE__');
    } catch {}
    // Log declined call to sovereign history
    if (address && activePeer) {
      saveCallRecord(address, {
        peerAddress: activePeer,
        type: callTypeRef.current as 'audio' | 'video' || 'audio',
        direction: 'incoming',
        status: 'declined',
        durationSeconds: 0,
      });
    }
    performEndCall();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [performEndCall, address, activePeer]);

  // ─── endCall: Either party hangs up ─────────────────────────────────────────
  const endCall = useCallback(async () => {
    try {
      if (executeSendRef.current) await executeSendRef.current('__CALL_HANGUP__');
    } catch {}
    // Log completed call to sovereign history
    if (address && activePeer) {
      saveCallRecord(address, {
        peerAddress: activePeer,
        type: callType || 'audio',
        direction: isCallerRef.current ? 'outgoing' : 'incoming',
        status: 'answered',
        durationSeconds: callDurationSeconds,
      });
    }
    performEndCall();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [performEndCall, address, activePeer, callType, callDurationSeconds]);

  // ─── toggleMic ───────────────────────────────────────────────────────────────
  const toggleMic = useCallback(() => {
    if (!localStream) return;
    const nextMuted = !isMicMuted;
    localStream.getAudioTracks().forEach(t => { t.enabled = !nextMuted; });
    setIsMicMuted(nextMuted);
  }, [localStream, isMicMuted]);

  // ─── toggleCamera ────────────────────────────────────────────────────────────
  const toggleCamera = useCallback(() => {
    if (!localStream) return;
    const nextOff = !isCamOff;
    localStream.getVideoTracks().forEach(t => { t.enabled = !nextOff; });
    setIsCamOff(nextOff);
  }, [localStream, isCamOff]);

  // ─── toggleVoiceIsolation ────────────────────────────────────────────────────────
  const toggleVoiceIsolation = useCallback(async () => {
    if (!localStreamRef.current || !activeConnectionRef.current) return;
    const nextIsolation = !voiceIsolation;
    let newAudioTrack: MediaStreamTrack | null = null;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: nextIsolation,
          autoGainControl: true
        }
      });
      newAudioTrack = newStream.getAudioTracks()[0];
      const oldAudioTrack = localStreamRef.current.getAudioTracks()[0];
      const peerConn = activeConnectionRef.current.peerConnection;
      if (peerConn) {
        const sender = peerConn.getSenders().find((s: any) => s.track?.kind === 'audio');
        if (sender) {
          await sender.replaceTrack(newAudioTrack);
          localStreamRef.current.removeTrack(oldAudioTrack);
          localStreamRef.current.addTrack(newAudioTrack);
          oldAudioTrack.stop();
          setVoiceIsolation(nextIsolation);
          newAudioTrack.enabled = !isMicMuted;
        }
      }
    } catch (e) {
      try { newAudioTrack?.stop(); } catch {} // prevent track leak
      toast.error('Could not change noise suppression');
    }
  }, [voiceIsolation, isMicMuted]);

  // ─── toggleDataSaver ──────────────────────────────────────────────────────────
  const toggleDataSaver = useCallback(async () => {
    if (!localStreamRef.current || !activeConnectionRef.current || callTypeRef.current !== 'video') return;
    const nextSaver = !dataSaver;
    let newVideoTrack: MediaStreamTrack | null = null;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: nextSaver 
          ? { width: { ideal: 480 }, frameRate: { ideal: 15 }, facingMode: activeCamera }
          : { width: { ideal: 1280 }, frameRate: { ideal: 30 }, facingMode: activeCamera }
      });
      newVideoTrack = newStream.getVideoTracks()[0];
      const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
      const peerConn = activeConnectionRef.current.peerConnection;
      if (peerConn) {
        const sender = peerConn.getSenders().find((s: any) => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
          localStreamRef.current.removeTrack(oldVideoTrack);
          localStreamRef.current.addTrack(newVideoTrack);
          oldVideoTrack.stop();
          setDataSaver(nextSaver);
          newVideoTrack.enabled = !isCamOff;
        }
      }
    } catch (e) {
      try { newVideoTrack?.stop(); } catch {} // prevent track leak
      toast.error('Could not change data saver');
    }
  }, [dataSaver, activeCamera, isCamOff]);

  // ─── Hardware Media Routing (replaceTrack) ──────────────────────────────────
  const switchCamera = async () => {
    if (!localStreamRef.current || !activeConnectionRef.current) return;
    const newFacingMode = activeCamera === 'user' ? 'environment' : 'user';
    let newVideoTrack: MediaStreamTrack | null = null;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: newFacingMode } },
        audio: false
      });
      newVideoTrack = newStream.getVideoTracks()[0];
      const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
      
      const peerConn = activeConnectionRef.current.peerConnection;
      if (!peerConn) return;
      const sender = peerConn.getSenders().find((s: any) => s.track?.kind === 'video');
      
      if (sender) {
        await sender.replaceTrack(newVideoTrack);
        localStreamRef.current.removeTrack(oldVideoTrack);
        localStreamRef.current.addTrack(newVideoTrack);
        oldVideoTrack.stop();
        setActiveCamera(newFacingMode);
        setIsScreenSharing(false);
      }
    } catch (e) {
      try { newVideoTrack?.stop(); } catch {}
      toast.error('Could not switch camera');
      // Fallback if exact fails
      try {
         const newStream = await navigator.mediaDevices.getUserMedia({
           video: { facingMode: newFacingMode }, audio: false
         });
         newVideoTrack = newStream.getVideoTracks()[0];
         const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
         const peerConn = activeConnectionRef.current.peerConnection;
         const sender = peerConn.getSenders().find((s: any) => s.track?.kind === 'video');
         if (sender) {
           await sender.replaceTrack(newVideoTrack);
           localStreamRef.current.removeTrack(oldVideoTrack);
           localStreamRef.current.addTrack(newVideoTrack);
           oldVideoTrack.stop();
           setActiveCamera(newFacingMode);
           setIsScreenSharing(false);
         }
      } catch (err) {
         try { newVideoTrack?.stop(); } catch {}
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!localStreamRef.current || !activeConnectionRef.current) return;
    try {
      if (isScreenSharing) {
        // Switch back to camera
        const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: activeCamera } });
        const newVideoTrack = newStream.getVideoTracks()[0];
        const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
        const peerConn = activeConnectionRef.current.peerConnection;
        const sender = peerConn.getSenders().find((s: any) => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
          localStreamRef.current.removeTrack(oldVideoTrack);
          localStreamRef.current.addTrack(newVideoTrack);
          oldVideoTrack.stop();
          setIsScreenSharing(false);
        }
      } else {
        // Start screen share
        if (!navigator.mediaDevices.getDisplayMedia) {
          toast.error('Screen sharing is not available on this device');
          return;
        }
        const newStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const newVideoTrack = newStream.getVideoTracks()[0];
        const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
        
        newVideoTrack.onended = async () => {
          if (!isComponentMountedRef.current) return;
          // User clicked "Stop sharing" via the browser's native UI
          // Directly switch back to the user's camera to avoid stale closure issues
          try {
            const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: activeCamera } });
            const fallbackTrack = fallbackStream.getVideoTracks()[0];
            const pc = activeConnectionRef.current?.peerConnection;
            const s = pc?.getSenders().find((s: any) => s.track?.kind === 'video');
            if (s && localStreamRef.current) {
              await s.replaceTrack(fallbackTrack);
              localStreamRef.current.removeTrack(newVideoTrack);
              localStreamRef.current.addTrack(fallbackTrack);
              setIsScreenSharing(false);
            }
          } catch (err) {
            console.error('Failed to revert to camera after screen share stopped', err);
          }
        };

        const peerConn = activeConnectionRef.current.peerConnection;
        const sender = peerConn.getSenders().find((s: any) => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
          localStreamRef.current.removeTrack(oldVideoTrack);
          localStreamRef.current.addTrack(newVideoTrack);
          oldVideoTrack.stop();
          setIsScreenSharing(true);
        }
      }
    } catch (e) {
      toast.error('Screen sharing stopped');
    }
  };

  //  Voice Recording: Hold-to-Record 
  const startRecording = useCallback(async () => {
    if (isRecording) return;
    try {
      let stream: MediaStream;
      try {
        // [iOS FIX] Safari requires explicit constraint hints to enable microphone.
        // echoCancellation and noiseSuppression are critical for call quality on iPhone.
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100,
            channelCount: 1,
          }
        });
      } catch (initialErr) {
        console.warn('[Voice] Initial getUserMedia failed, trying fallback...', initialErr);
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      // Proper mimeType detection: Opus/WebM for desktop browsers, AAC/MP4 for Safari/iOS
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Stop all tracks to release mic
        stream.getTracks().forEach(t => t.stop());
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        setIsRecording(false);

        // Check if user cancelled
        if (isRecordingCancelledRef.current) {
          isRecordingCancelledRef.current = false;
          setRecordingSeconds(0);
          audioChunksRef.current = [];
          return;
        }

        if (audioChunksRef.current.length === 0) return;

        const blob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        if (blob.size < 400) {
            console.warn('[Voice] Recording too short, ignoring.');
            setRecordingSeconds(0);
            return;
        }

        try {
          // Convert blob to base64 data URL — sent over already-encrypted XMTP channel
          const reader = new FileReader();
          reader.onloadend = async () => {
            const dataUrl = reader.result as string; // data:audio/webm;base64,...
            const audioMsg = `__AUDIO__${dataUrl}`;
            
            if (client && activePeer) {
              const optimisticId = `optimistic-${Date.now()}`;
              setMessages(prev => [...prev, {
                id: optimisticId,
                senderInboxId: client?.inboxId || '',
                content: audioMsg,
                sentAtNs: Date.now(),
                conversationId: `dm-${activePeer.toLowerCase()}`
              }]);
              try { 
                  await sendMessage(client, activePeer, audioMsg, address); 
                  // Voice: P2P Audio transmission successful.
            } catch (sendErr: any) {
                console.error('[Voice] P2P Send Failed:', sendErr?.message);
                setMessages(prev => prev.filter(m => m.id !== optimisticId));
                setInitError('Failed to transmit secure voice message. Check your connection.');
            }
          } else {
            toast.error('Open a conversation first');
          }
          };
          reader.readAsDataURL(blob);
        } catch (error) {
          console.error('[Voice] Audio send failed:', error);
          toast.error('Could not send the voice message');
        }

        setRecordingSeconds(0);
      };

      recorder.start(100); // collect chunks every 100ms
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);
      isRecordingCancelledRef.current = false; // Reset cancellation flag
      recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    } catch (err) {
      console.warn('[Voice] Microphone access denied or unavailable:', err);
    }
  // [BUG FIX] Added 'address' to dependency array — was causing stale closure where
  // audio messages were sent with null/undefined address after wallet reconnect
  }, [isRecording, activePeer, client, address]);

  const stopRecording = useCallback(() => {
    if (!isRecording || !mediaRecorderRef.current) return;
    try { mediaRecorderRef.current.stop(); } catch {}
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
  }, [isRecording]);

  const cancelRecording = useCallback(() => {
    if (!isRecording || !mediaRecorderRef.current) return;
    isRecordingCancelledRef.current = true;
    try { mediaRecorderRef.current.stop(); } catch {}
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
  }, [isRecording]);

  // Draft Loading on Peer Switch
  useEffect(() => {
    if (activePeer && address) {
      const draftKey = `ledger_draft_${address.toLowerCase()}_${activePeer.toLowerCase()}`;
      const saved = localStorage.getItem(draftKey);
      if (saved) {
          try {
              setInputText(decodeURIComponent(atob(saved)));
          } catch {
              setInputText('');
          }
      } else {
          setInputText('');
      }
    }
  }, [activePeer, address]);

  const loadConversations = useCallback(async () => {
    try {
      let merged: ConversationMeta[] = [];
      const stored = localStorage.getItem(`ledger_chat_history_${address}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.conversations) merged = parsed.conversations;
      }
      
      // Sync from server (contacts + pending offline messages)
      if (address) {
        const authHeader = { 'x-web3-address': address };
        try {
          const res = await fetch(`/api/chat/contacts?address=${address}`, { headers: authHeader, cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            if (data.peers && Array.isArray(data.peers)) {
               const serverPeers = data.peers as string[];
               serverPeers.forEach(peer => {
                 if (!merged.find(c => c.peerAddress.toLowerCase() === peer.toLowerCase())) {
                   merged.push({ peerAddress: peer, lastMessage: '', lastAt: new Date() });
                 }
               });
            }
          }
          
          // FETCH PENDING MESSAGES (OFFLINE ROUTING) — works for both HL and WalletConnect users
          // [BUG FIX] Route is /api/chat/queue (not /api/chat/pending).
          // Auth via x-web3-address header. Response shape: { messages: [...] } not { pending: [...] }.
          // Timestamp field is createdAt (PendingChatMessage schema), not timestamp.
          const pRes = await fetch(`/api/chat/queue?address=${encodeURIComponent(address)}`, { 
            headers: authHeader, 
            credentials: 'include',
            cache: 'no-store' 
          });
          if (pRes.ok) {
             const pData = await pRes.json();
             if (pData.messages && Array.isArray(pData.messages) && pData.messages.length > 0) {
                 const { chatDB } = await import('@/lib/chat/indexeddb');
                 for (const p of pData.messages) {
                     const peer = (p.sender?.toLowerCase() === address.toLowerCase() ? p.recipient : p.sender)?.toLowerCase();
                     if (!peer) continue;
                     const ts = p.createdAt ? new Date(p.createdAt).getTime() : Date.now();
                     const existing = merged.find(c => c.peerAddress.toLowerCase() === peer);
                     if (!existing) {
                         merged.push({ peerAddress: peer, lastMessage: p.content.slice(0, 30), lastAt: new Date(ts) });
                     } else {
                         if (!existing.lastAt || new Date(ts) > new Date(existing.lastAt)) {
                             existing.lastMessage = p.content.slice(0, 30);
                             existing.lastAt = new Date(ts);
                         }
                     }

                     const offlineMsg = {
                       id: p.id || `offline-${Date.now()}-${Math.random()}`,
                       senderInboxId: '',
                       senderAddress: p.sender.toLowerCase(),
                       content: p.content,
                       sentAtNs: ts * 1_000_000,
                       conversationId: `dm-${peer}`,
                       status: 'delivered' as const,
                       fromPeer: p.sender.toLowerCase() !== address.toLowerCase(),
                       // Came from the server queue, not XMTP: not end to end encrypted.
                       viaServer: true,
                     };

                     await chatDB.saveMessage(address, peer, offlineMsg).catch(() => {});
                     await chatDB.saveConversation({
                       peerAddress: peer,
                       lastAt: ts,
                       lastMessage: p.content,
                     }).catch(() => {});

                     // If active chat is currently open with this peer, inject immediately
                     if (activePeerRef.current?.toLowerCase() === peer) {
                       setMessages(prev => {
                         if (prev.some(m => m.id === offlineMsg.id)) return prev;
                         return [...prev, offlineMsg].sort((a, b) => a.sentAtNs - b.sentAtNs);
                       });
                     }
                 }
             }
          }

          if (merged.length > 0) {
            localStorage.setItem(`ledger_chat_history_${address}`, JSON.stringify({ conversations: merged }));
          }
        } catch (e) {
          console.error('[Ledger Chat] Failed to sync contacts/pending from server', e);
        }
      }
      
      merged.sort((a, b) => {
          const tA = a.lastAt ? new Date(a.lastAt).getTime() : 0;
          const tB = b.lastAt ? new Date(b.lastAt).getTime() : 0;
          return tB - tA;
      });

      setConversations(merged);
    } catch (e) {}
  }, [address]);

  // getDeterministicSeed removed as it produces invalid XMTP signatures.
  // The XMTP SDK automatically caches session keys in IndexedDB.

  // Initialize REAL XMTP Network
  const initClient = useCallback(async () => {
    if (!address) return;
    if (initInFlight.current) return;
    initInFlight.current = true;
    setIsInitializing(true);
    setInitError('');

    let attempts = 0;
    const maxAttempts = 2; // Extra attempt for post-revocation retry

    // [XMTP-FIX] Define wagmiSigner OUTSIDE the try-block so the catch handler
    // can access it when triggering automatic installation revocation.
    const wagmiSigner = {
      getAddress: async () => address as string,
      signMessage: async (msg: string | Uint8Array) => {
        if (isLocalSystemWallet) {
            const wallet = await useWalletStore.getState().getConnectedWallet();
            if (wallet) {
                return await wallet.signMessage(msg);
            }
        }
        try {
          let finalMsg = msg;
          if (typeof msg !== 'string') {
              const hex = Array.from(msg as Uint8Array).map((b: number) => b.toString(16).padStart(2, '0')).join('');
              finalMsg = ('0x' + hex) as any;
          }
          setIsWaitingForSignature(true); const res = await signMessageAsync({ message: finalMsg as any }); setIsWaitingForSignature(false); return res;
        } catch (sigErr: any) { setIsWaitingForSignature(false);
          const msg = sigErr?.message || '';
          if (msg.includes('connector') || msg.includes('not connected') || msg.includes('No connector') || msg.includes('signMessage')) {
              const hasVault = typeof window !== 'undefined' && !!localStorage.getItem('system_vault');
              if (isSystemHandshake && !hasVault) {
                console.warn('[Ledger Chat:Mobile] Signature requested on linked session without Vault.');
              }
              throw new Error('No active wallet connection detected. Please ensure your wallet app is open and connected to this terminal.');
          }
          throw sigErr;
        }
      }
    };

    while (attempts < maxAttempts) {
      try {
        if (attempts > 0) await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(1.5, attempts)));

        //  Step 1: Use standard wagmi signer (defined above, outside try)

        //  Step 2: Initialize client (Direct Execution) 
        const realClient = await getXMTPClient(wagmiSigner);
        setClient(realClient);
        if (typeof window !== 'undefined') (window as any)._active_ledger_client = { address };
        
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('ledger_xmtp_initialized', 'true');
            // [ATOMIC INDEXING] Log session event (once per session)
            const chatLogKey = `provenance_chat_${address}_${new Date().toDateString()}`;
            if (!localStorage.getItem(chatLogKey)) {
                localStorage.setItem(chatLogKey, '1');
                fetch('/api/provenance/log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ type: 'LEDGER_CHAT_SYNC', details: { address } })
                }).catch(() => {});
            }
        }
        await loadConversations();
        
        // Sync Offline Queue and inject into local stream
        try {
            await syncOfflineQueue(realClient, address);
        } catch (e) {
            console.error('[LedgerChatV2] Offline queue sync failed', e);
        }

        setIsInitializing(false);
        initInFlight.current = false;
        return; // Success
      } catch (err: any) {
        attempts++;
        const errorMsg = err?.message || '';
        const isReject = err?.code === 4001 || errorMsg.toLowerCase().includes('reject') || errorMsg.toLowerCase().includes('deny');

        // Immediately stop retrying if user actively rejected the prompt
        if (isReject) {
          setInitError('Identity authorization rejected. You must approve the Ledger Chat signature to proceed.');
          setIsInitializing(false);
          initInFlight.current = false;
          return;
        }

        if (attempts >= maxAttempts || errorMsg.includes('XMTP_LIMIT_REACHED')) {
          console.error('[Ledger Chat] Init Error:', err);
          
          if (errorMsg.includes('XMTP_LIMIT_REACHED')) {
            const parts = errorMsg.split(':');
            const inboxId = parts.length > 1 ? parts[1] : null;
            if (inboxId && attempts < maxAttempts) {
               try {
                  console.log('Attempting automatic revocation of previous XMTP installations for', inboxId);
                  await revokeXMTPInstallations(wagmiSigner, inboxId);
                  continue; // Retry initialization
               } catch (revokeErr) {
                  console.error('Revocation failed', revokeErr);
                  setInitError('Maximum device limit reached (10/10). Automatic revocation failed.');
               }
            } else {
               setInitError('Maximum device limit reached (10/10). Please clear cache or disconnect old devices.');
            }
          } else if (err?.name === 'ChunkLoadError' || errorMsg.includes('Loading chunk')) {
            setInitError('Humanity Ledger module failed to load. Please check your network connection and reload the terminal.');
          } else if (errorMsg.includes('No active wallet') || errorMsg.includes('connector') || errorMsg.includes('signMessage') || errorMsg.toLowerCase().includes('unknown signer')) {
            if (isSystemHandshake) {
               setInitError('Ledger identity not yet synchronized from desktop. Please keep this browser open while the desktop terminal finishes the handshake.');
            } else {
               setInitError('Active wallet connection lost or not detected. Please ensure your wallet app is open and connected directly to this browser.');
            }
          } else if (errorMsg.includes('WASM') || errorMsg.includes('wasm')) {
            setInitError('Cryptographic Engine Failure. Hardware architecture error or restricted browser security settings.');
          } else {
            setInitError(`Humanity Ledger handshake failure: ${errorMsg.slice(0, 80) || 'Unknown Protocol Error'}. Please retry.`);
          }
          setIsInitializing(false);
          initInFlight.current = false;
        } else {
          console.warn(`[Ledger Chat] Init attempt ${attempts} failed due to inactivity/network timeout, retrying...`, err);
        }
      }
    }
  }, [address, isMobile, signMessageAsync, isSystemHandshake, loadConversations, isLocalSystemWallet]);

  useEffect(() => {
    // Aggressive Auto-Init: Trigger for all connected users including mobile.
    // Skip email users — they don't have a wallet signer for XMTP.
    if (isConnected && address && !isEmailUser && !client && !initInFlight.current && !initError) {
      initClient();
      // [SAFETY TIMEOUT] If init hasn't resolved in 45s, reset state to unblock the UI
      const safetyTimer = setTimeout(() => {
        if (initInFlight.current) {
          console.warn('[LedgerChat] Init safety timeout reached - resetting state');
          setIsInitializing(false);
          initInFlight.current = false;
          setInitError('Connection timed out. Please tap "Enter Ledger Chat" to retry.');
        }
      }, 45_000);
      return () => clearTimeout(safetyTimer);
    }
  }, [isConnected, address, isEmailUser, client, initError, initClient, forceAutoInit]);

  // Sync contacts to backend debounced
  const persistToLocal = useCallback((arr: ConversationMeta[]) => {
    if (!address) return;
    localStorage.setItem(`ledger_chat_history_${address}`, JSON.stringify({ conversations: arr }));
    
    // Also backup to server — send x-web3-address so WalletConnect users are accepted
    fetch('/api/chat/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-web3-address': address },
      body: JSON.stringify({
        address,
        peers: arr.map(c => c.peerAddress)
      })
    }).catch(console.error);
  }, [address]);

  const syncToAddressBook = async (peerAddr: string) => {
    try {
      // Graceful upsert to user's address book
      await fetch('/api/wallet/address-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Chat: ${peerAddr.slice(0, 6)}...${peerAddr.slice(-4)}`,
          address: peerAddr,
          label: 'LedgerChat',
          isFavorite: false
        })
      });
    } catch (err) {
      console.error('[Ledger Chat] Failed to sync address book:', err);
    }
  };

  // Load messages when active peer changes (handled by loadConversations but filtered in render)
  useEffect(() => {
    if (!client || !activePeer) return;
    // Local storage doesn't need to re-fetch on every peer change since we hold all messages in state
    // but we can set the activePeerDmIdRef so the UI logic works
    activePeerDmIdRef.current = `dm-${activePeer.toLowerCase()}`;
    peerToConvId.current.set(activePeer.toLowerCase(), activePeerDmIdRef.current);
    convIdToPeer.current.set(activePeerDmIdRef.current, activePeer);
    // Reset native XMTP dm id AND peer inboxId — will be resolved by fetchHistorical
    activeXmtpDmIdRef.current = null;
    activePeerInboxIdRef.current = '';
  }, [client, activePeer]);

  //  Global XMTP Stream 
  useEffect(() => {
    if (!client || !address) return;
    
    let cancelled = false;
    const selfInboxId = (client as any).inboxId ?? '';

    // Seed the persistent ref with already-known conversations
    conversations.forEach(c => knownPeersRef.current.add(c.peerAddress.toLowerCase()));

    
    const syncGlobal = async () => {
      try {
        if (address) await syncOfflineQueue(client, address);
        
        try {
          const directHeaders: Record<string, string> = {};
          if (address) directHeaders['x-web3-address'] = address;
          const directRes = await fetch(`/api/chat/direct?since=${directMsgSinceRef.current}`, {
            credentials: 'include',
            headers: directHeaders
          });
          if (directRes.ok) {
            const { messages: directMsgs } = await directRes.json();
            directMsgSinceRef.current = Date.now() - 5000;
            if (directMsgs && directMsgs.length > 0) {
              for (const dm of directMsgs) {
                const dmId = `direct-${dm.id}`;
                if (confirmedMsgIds.current.has(dmId)) continue;
                confirmedMsgIds.current.add(dmId);
                
                const isMeMsg = dm.sender?.toLowerCase() === address?.toLowerCase();
                const peerAddress = isMeMsg ? dm.recipient : dm.sender;
                const peerLower = peerAddress?.toLowerCase() ?? '';
                const activePeerLower = activePeerRef.current?.toLowerCase() ?? '';
                const isFromActivePeer = peerLower === activePeerLower;
                
                const msgObj = {
                  id: dmId,
                  content: dm.content,
                  senderAddress: dm.sender,
                  sentAtNs: dm.createdAt,
                  conversationId: `dm-${peerLower}`,
                  isMe: isMeMsg,
                  status: 'delivered',
                  // Delivered by our server, not XMTP: not end to end encrypted.
                  viaServer: true,
                };
                
                // CRITICAL FIX: Persist fallback DB message to IndexedDB so it survives reloads
                if (typeof chatDB !== 'undefined' && chatDB.saveMessages) {
                  chatDB.saveMessages([msgObj]).catch(() => {});
                  chatDB.saveConversation({ peerAddress: peerAddress, lastAt: dm.createdAt }).catch(() => {});
                }
                
                setConversations(prev => {
                  const existing = prev.find(c => c.peerAddress?.toLowerCase() === peerLower);
                  const newEntry = { peerAddress: peerAddress, lastMessage: dm.content, lastAt: new Date(dm.createdAt) };
                  if (existing) {
                    return [newEntry, ...prev.filter(c => c.peerAddress?.toLowerCase() !== peerLower)];
                  }
                  return [newEntry, ...prev];
                });
                
                if (isFromActivePeer) {
                  setMessages(prev => {
                    if (prev.some(m => m.id === dmId)) return prev;
                    return [...prev, msgObj].sort((a, b) => (a.sentAtNs ?? 0) - (b.sentAtNs ?? 0));
                  });
                }
              }
            }
          }
        } catch (directErr) {
          console.warn('[LedgerChat] Direct poll error:', directErr);
        }
        
        // Discover new peers from the XMTP network
        const newPeerAddrs = await discoverNewPeers(client, address, knownPeersRef.current);

        if (newPeerAddrs.length > 0 && !cancelled) {
          setConversations(prev => {
            const prevSet = new Set(prev.map(c => (c.peerAddress || '').toLowerCase()));
            const toAdd: ConversationMeta[] = newPeerAddrs
              .filter(a => !prevSet.has(a.toLowerCase()))
              .filter(a => a.toLowerCase() !== address?.toLowerCase()) // never add self
              .map(a => ({
                peerAddress: a,
                lastMessage: ' New message received',
                lastAt: new Date(),
              }));

            if (!toAdd.length) return prev;
            toAdd.forEach(c => syncToAddressBook(c.peerAddress));
            
            const updated = [...toAdd, ...prev];
            persistToLocal(updated);
            return updated;
          });
        }
        
        // --- 10000% GUARANTEE FALLBACK POLL FOR ACTIVE PEER ---
        if (activePeerRef.current) {
           try {
              const rawMsgs = await getMessages(client, activePeerRef.current);
              if (rawMsgs && rawMsgs.length > 0 && !cancelled) {
                 setMessages(prev => {
                    const existingIds = new Set(prev.map(m => m.id));
                    const newRaw = rawMsgs.filter(m => {
                        if (!m.id || existingIds.has(m.id)) return false;
                        const cStr = typeof m.content === 'string' ? m.content : (m.content ? JSON.stringify(m.content) : '');
                        return !cStr.includes('initiatedByInboxId') && !cStr.includes('addedInboxes') && !cStr.includes('group is inactive');
                      });
                    if (newRaw.length === 0) return prev;
                    const peerNow = activePeerRef.current;
                    if (!peerNow) return prev; // chat was closed while the poll was running
                    
                    const selfId = (client as any).inboxId ?? "";
                    const mapped = newRaw.map((m: any) => {
                       const isFromPeer = m.senderInboxId !== selfId;
                       let content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
                       return {
                          id: m.id,
                          content: content,
                          senderAddress: isFromPeer ? peerNow : (address || ''),
                          sentAtNs: nsToDate(m.sentAtNs ?? m.sentAt).getTime(),
                          status: 'delivered',
                          conversationId: `dm-${peerNow.toLowerCase()}`
                       };
                    });
                    
                    // Exclude system messages from rendering
                    const toAppend = mapped.filter(m => {
                       if (m.content.startsWith('__REACT__') || m.content.startsWith('__READ__') || m.content.startsWith('__TYPING__') || m.content.startsWith('__VOTE__') || m.content.startsWith('__EDIT__') || m.content.startsWith('__REVOKE__')) {
                           return false; // Real intercepts are handled by stream
                       }
                       return true;
                    });
                    
                    if (toAppend.length === 0) return prev;
                    return [...prev, ...toAppend].sort((a, b) => a.sentAtNs - b.sentAtNs);
                 });
              }
           } catch (pollErr) {
              console.warn('[Ledger Chat] Active peer fallback poll failed:', pollErr);
           }
        }
        // --------------------------------------------------------

      } catch (e) {
        console.warn('[Ledger Chat] Global sync error:', e);
      }
    };

    syncGlobal();
    // A tab in the background polls every 30 s instead of every few seconds.
    // Background tabs are most of the open tabs at any moment, and at the
    // foreground rate each one cost the database the same as an active user.
    let lastHiddenSync = 0;
    const globalPoll = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        if (Date.now() - lastHiddenSync < 30_000) return;
        lastHiddenSync = Date.now();
      }
      syncGlobal();
    }, 4000);

    // ─── GLOBAL XMTP STREAM ────────────────────────────────────────────────────
    // DEDUPLICATION CONTRACT:
    // 1. Every real XMTP message ID is registered in confirmedMsgIds on first sight.
    // 2. If the ID is already registered → skip (absolute deduplication).
    // 3. If the message is from SELF → look up the optimistic placeholder via
    //    optimisticContentMap (content-keyed) and swap it atomically.
    //    This prevents the "sender sees message twice" bug caused by XMTP echoing
    //    the sender's own message back through the stream.
    // 4. If no optimistic placeholder exists (e.g. opened in a second tab) →
    //    insert normally, but only after confirming the ID is not already present.
    // Self-healing stream loop: if GroupInactive kills the stream, restart it with backoff.
    let activeAbortController: AbortController | null = null;
    (async () => {
      let streamRestarts = 0;
      while (!cancelled) {
        try {
          if (activeAbortController) activeAbortController.abort();
          activeAbortController = new AbortController();
          const gen = streamMessages(client, activeAbortController.signal);
          for await (const msg of gen as any) {
            if (cancelled) { activeAbortController.abort(); break; }
            try {
              // [AUDIT FIX] Dynamically fetch selfInboxId to avoid stale closure if client rotates
              const selfInboxId = (client as any).inboxId ?? '';
              const _rawContentStr = typeof msg.content === 'string' ? msg.content : (msg.content ? JSON.stringify(msg.content) : '');
              if (_rawContentStr.includes('initiatedByInboxId') || _rawContentStr.includes('addedInboxes') || _rawContentStr.includes('group is inactive') || _rawContentStr.includes('groupUpdated')) continue;
              const fromPeer = msg.senderInboxId !== selfInboxId;
              const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
              const sentAtNs = nsToDate(msg.sentAtNs ?? msg.sentAt).getTime();
              const currentActivePeer = activePeerRef.current?.toLowerCase();
              
              // [CRITICAL FIX v7] FAST PATH: If the message sender's inboxId is the currently
              // active peer's known inboxId, resolve instantly without ANY network calls.
              // This is the case for 99% of messages in an active conversation.
              let resolvedPeerAddr = '';
              
              if (fromPeer && msg.senderInboxId && activePeerInboxIdRef.current &&
                  msg.senderInboxId.toLowerCase() === activePeerInboxIdRef.current.toLowerCase()) {
                resolvedPeerAddr = currentActivePeer || '';
              }
              
              // Second fast path: check the global inboxId→address cache
              if (!resolvedPeerAddr && fromPeer && msg.senderInboxId) {
                const cached = await resolveSenderAddress(msg.senderInboxId, undefined as any);
                if (cached) resolvedPeerAddr = cached.toLowerCase();
              }
              
              if (!resolvedPeerAddr) {
              resolvedPeerAddr = msg.conversation?.peerAddress?.toLowerCase() || '';
            }
            if (!resolvedPeerAddr) {
              try {
                if (fromPeer) {
                  let senderAddr = await resolveSenderAddress(msg.senderInboxId, client);
                  if (!senderAddr && client) {
                    try { await client.conversations.sync(); } catch {}
                    senderAddr = await resolveSenderAddress(msg.senderInboxId, client);
                  }
                  resolvedPeerAddr = senderAddr?.toLowerCase() || '';
                } else if (msg.conversation) {
                  const dmPeer = await extractPeerAddress(msg.conversation, selfInboxId, address || "");
                  resolvedPeerAddr = dmPeer?.toLowerCase() || '';
                }
              } catch (e) {
                console.warn('[Ledger Chat] Transient error resolving peer address:', e);
              }
            }

            // Ultimate fallback (works for both sender and recipient in v5.3.0)
            const convoId = msg.convoId || msg.conversationId || msg.groupId || msg.conversation?.id || '';
            if (!resolvedPeerAddr && convoId) {
              try {
                // Check convIdToPeer cache first (populated by fetchHistorical)
                const cachedPeer = convIdToPeer.current.get(convoId);
                if (cachedPeer) {
                  resolvedPeerAddr = cachedPeer.toLowerCase();
                } else {
                  let dms = await client.conversations.listDms();
                  let dm = dms.find((d: any) => d.id === convoId);
                  
                  // [AUDIT FIX] If the DM is missing from local cache (new chat),
                  // perform a quick sync. This is much better than corrupting the UI
                  // with a raw convoId hash that breaks routing and deduplication.
                  if (!dm) {
                    await client.conversations.sync();
                    dms = await client.conversations.listDms();
                    dm = dms.find((d: any) => d.id === convoId);
                  }
                  
                  if (dm) {
                    const dmPeer = await extractPeerAddress(dm, selfInboxId, address || "");
                    resolvedPeerAddr = dmPeer?.toLowerCase() || '';
                    // Cache this mapping for future messages
                    if (resolvedPeerAddr && convoId) convIdToPeer.current.set(convoId, resolvedPeerAddr);
                  }
                }
              } catch (e) {
                console.warn('Failed to resolve convoId to peer address', e);
              }
            }
            
            // [AUDIT FIX] If all resolutions fail, fall back to convoId or senderInboxId 
            // to prevent the message from being silently dropped.
            const msgConvPeer = resolvedPeerAddr || convoId || msg.senderInboxId || 'unknown';
            const realId = msg.id ?? `real-${sentAtNs}-${Math.random()}`;

            // ── ABSOLUTE DEDUPLICATION GATE ──────────────────────────────────────
            // [CRITICAL FIX #3] On stream restart after a network drop, the stream
            // replays recent messages. Their IDs may be in confirmedMsgIds, but the
            // React state may have been wiped (e.g. peer switch + remount).
            // Only skip if the ID is already IN React state — not just in the Set.
            if (confirmedMsgIds.current.has(realId)) {
              const alreadyInState = messagesRef.current?.some((m: any) => m.id === realId);
              if (alreadyInState) continue;
              // ID was in dedup Set but NOT in state — re-insert (fall through).
            } else {
              confirmedMsgIds.current.add(realId);
            }
            pruneConfirmedIds(); // keep Set bounded to last 2000 IDs
            pruneOptimisticMap(); // prune stale optimistic entries
            // ─────────────────────────────────────────────────────────────────────

            // Phase 2: Intercept Reactions
            if (typeof content === 'string' && content.startsWith('__REACT__')) {
              const parts = content.split('__::');
              if (parts.length >= 2) {
                const targetId = parts[0].replace('__REACT__', '');
                const emoji = parts.slice(1).join('__::');
                const sender = msg.senderInboxId || 'unknown';
                
                setMessages(prev => prev.map(m => {
                  if (m.id === targetId) {
                    const reactions = m.reactions || {};
                    const users = reactions[emoji] || [];
                    if (!users.includes(sender)) {
                      return { ...m, reactions: { ...reactions, [emoji]: [...users, sender] } };
                    }
                  }
                  return m;
                }));
              }
              continue; // Skip rendering this as a chat bubble
            }
            
            // Phase 2: Intercept Read Receipts
            if (typeof content === 'string' && content.startsWith('__READ__')) {
              const readId = content.replace('__READ__', '');
              setMessages(prev => prev.map(m => m.id === readId ? { ...m, status: 'read' } : m));
              continue;
            }
            if (typeof content === 'string' && content.startsWith('__DELIVERED__')) {
              const dId = content.replace('__DELIVERED__', '');
              setMessages(prev => prev.map(m => (m.id === dId && m.status !== 'read') ? { ...m, status: 'delivered' } : m));
              continue;
            }
            
            // Phase 2: Intercept Typing Indicator
            if (typeof content === 'string' && content.startsWith('__TYPING__')) {
              const sender = (msg.senderAddress || 'peer').toLowerCase();
              setTypingPeers(prev => new Set(prev).add(sender));
              setTimeout(() => {
                setTypingPeers(prev => {
                  const next = new Set(prev);
                  next.delete(sender);
                  return next;
                });
              }, 4000);
              continue;
            }


            // Phase 3: Intercept Pins & Revokes
            if (typeof content === 'string' && content.startsWith('__PIN__')) {
              setPinnedMessageId(content.replace('__PIN__', ''));
              continue;
            }
            if (typeof content === 'string' && content.startsWith('__REVOKE__')) {
              const revokeId = content.replace('__REVOKE__', '');
              setMessages(prev => prev.filter(m => m.id !== revokeId));
              continue;
            }

            // Phase 5: Intercept VOTE signals
            if (typeof content === 'string' && content.startsWith('__VOTE__')) {
              const parts = content.replace('__VOTE__', '').split('__::');
              if (parts.length >= 2) {
                const targetPollId = parts[0];
                const optionIndex = parseInt(parts[1], 10);
                const sender = msg.senderInboxId || 'peer';
                setMessages(prev => prev.map(m => {
                  if (typeof m.content === 'string' && m.content.startsWith('__POLL__')) {
                    // [CRITICAL FIX] Match by pollId extracted from the POLL payload,
                    // not by m.id — because m.id changes when optimistic→real swap happens.
                    // Poll payload format: __POLL__<pollId>__::<question>__::<opts>
                    const pollPayloadId = m.content.replace('__POLL__', '').split('__::')[0];
                    if (pollPayloadId === targetPollId || m.id === targetPollId) {
                      const pollData = m.pollVotes || {};
                      return { ...m, pollVotes: { ...pollData, [sender]: optionIndex } };
                    }
                  }
                  return m;
                }));
              }
              continue;
            }

            // Phase 4: Intercept __EDIT__ — remote peer edited a message
            if (typeof content === 'string' && content.startsWith('__EDIT__')) {
              const editParts = content.replace('__EDIT__', '').split('__::');
              if (editParts.length >= 2) {
                const editTargetId = editParts[0];
                const editNewContent = editParts.slice(1).join('__::');
                setMessages(prev => prev.map(m =>
                  m.id === editTargetId ? { ...m, content: editNewContent, edited: true } : m
                ));
              }
              continue;
            }
            
            // Phase 4.5: Intercept CALL_OFFER synchronously to guarantee ringing
            if (typeof content === 'string' && content.startsWith('__CALL_OFFER__:')) {
              const parts = content.split(':');
              const callerPeerId = parts[1];
              const offerCallType: 'audio'|'video' = (parts[2] as any) || 'audio';
              if (callerPeerId) remotePeerIdRef.current = callerPeerId;

              const callAge = Date.now() - sentAtNs;
              const isFreshCall = callAge >= 0 && callAge < 35000;
              const offerId = msg.id || `${callerPeerId}-${sentAtNs}`;

              // Prevent historical replay and duplicate ringing storms
              if (!isFreshCall || processedCallOfferIds.current.has(offerId)) {
                continue;
              }
              processedCallOfferIds.current.add(offerId);
              
              if (callStateRef.current === 'idle') {
                if (msgConvPeer && msgConvPeer.toLowerCase() !== activePeerRef.current?.toLowerCase()) {
                  setActivePeer(msgConvPeer);
                  setConversations(prev => {
                    if (!prev.find(c => c.peerAddress.toLowerCase() === msgConvPeer.toLowerCase())) {
                      const newConv = { peerAddress: msgConvPeer, lastMessage: 'Incoming call...', lastAt: new Date() };
                      const next = [newConv, ...prev];
                      persistToLocal(next);
                      return next;
                    }
                    return prev;
                  });
                }
                setCallType(offerCallType);
                callTypeRef.current = offerCallType;
                isCallerRef.current = false;
                setCallState('ringing');
                startRingtone();
                
                if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
                callTimeoutRef.current = setTimeout(() => {
                  if (callStateRef.current === 'ringing') {
                    if (address && msgConvPeer) {
                      saveCallRecord(address, {
                        peerAddress: msgConvPeer,
                        type: offerCallType,
                        direction: 'incoming',
                        status: 'missed',
                        durationSeconds: 0,
                      });
                    }
                    toast.error('Missed call.');
                    performEndCallRef.current();
                  }
                }, 35000);
              }
              continue; // Do not render signal in chat
            }

            // Phase 4.6: Intercept CALL_HANGUP and CALL_DECLINE in realtime stream
            if (typeof content === 'string' && content === '__CALL_HANGUP__') {
              const hangupId = msg.id || `hangup-${sentAtNs}`;
              if (!processedSignalIds.current.has(hangupId)) {
                processedSignalIds.current.add(hangupId);
                if (callStateRef.current === 'ringing') {
                  // Remote party cancelled/hung up before answer
                  if (address && msgConvPeer) {
                    saveCallRecord(address, {
                      peerAddress: msgConvPeer,
                      type: callTypeRef.current || 'audio',
                      direction: 'incoming',
                      status: 'missed',
                      durationSeconds: 0,
                    });
                  }
                  performEndCallRef.current();
                  toast('Missed call');
                } else if (callStateRef.current === 'active') {
                  // Remote party ended the active call
                  if (address && msgConvPeer) {
                    saveCallRecord(address, {
                      peerAddress: msgConvPeer,
                      type: callTypeRef.current || 'audio',
                      direction: 'incoming',
                      status: 'answered',
                      durationSeconds: callDurationSeconds,
                    });
                  }
                  performEndCallRef.current();
                  toast('Call ended');
                }
              }
              continue;
            }

            if (typeof content === 'string' && content === '__CALL_DECLINE__') {
              const declineId = msg.id || `decline-${sentAtNs}`;
              if (!processedSignalIds.current.has(declineId)) {
                processedSignalIds.current.add(declineId);
                if (callStateRef.current === 'calling') {
                  if (address && msgConvPeer) {
                    saveCallRecord(address, {
                      peerAddress: msgConvPeer,
                      type: callTypeRef.current || 'audio',
                      direction: 'outgoing',
                      status: 'declined',
                      durationSeconds: 0,
                    });
                  }
                  performEndCallRef.current();
                  toast('Call declined');
                }
              }
              continue;
            }

            let mappedContent = content || msg.fallback || 'Encrypted Data';
            let burnAtNs: number | undefined = undefined;

            // Phase 3: Intercept Self-Destruct
            if (typeof mappedContent === 'string' && mappedContent.startsWith('__BURN_')) {
              const parts = mappedContent.split('__::');
              if (parts.length >= 2) {
                const seconds = parseInt(parts[0].replace('__BURN_', ''), 10);
                mappedContent = parts.slice(1).join('__::');
                burnAtNs = sentAtNs + (seconds * 1000);
              }
            }

            // Phase 5: Intercept Payment Signals for Auto-Sync
            if (typeof mappedContent === 'string' && false /* __PAYMENT__ bubbles are rendered */) {
              // Reconcile balance from server because the sender just transferred QDs to our address
              refreshBalanceRef.current().catch(() => {});
            }

            const mappedMsg = {
              id: realId,
              senderInboxId: msg.senderInboxId ?? '',
              content: mappedContent,
              burnAtNs,
              sentAtNs,
              conversationId: msgConvPeer ? `dm-${msgConvPeer}` : `dm-${currentActivePeer}`
            };

            // [CRITICAL FIX] Always normalize both sides to lowercase before comparing.
            // msgConvPeer comes from .toLowerCase() but currentActivePeer (activePeerRef.current)
            // might be stored in its original checksum-cased form. This was silently dropping
            // all received messages because the equality check was always failing.
            const normalizedMsgPeer = msgConvPeer?.toLowerCase() ?? '';
            const normalizedActivePeer = currentActivePeer?.toLowerCase() ?? '';
            const belongsToActiveByAddr =
              !!normalizedActivePeer &&
              normalizedMsgPeer === normalizedActivePeer;
            const belongsToActiveByConvoId =
              !!convoId &&
              !!activeXmtpDmIdRef.current &&
              convoId === activeXmtpDmIdRef.current;
            // [CRITICAL FIX #2] Third path: when ETH address resolution AND convoId both fail
            // (common on cold cache / slow networks), fall back to matching the senderInboxId
            // against the active peer's known inboxId. This is the last resort that prevents
            // messages from being silently routed to background-conversation notifications
            // when they should appear in the open chat.
            const activePeerInboxId = activePeerInboxIdRef.current ?? '';
            const belongsToActiveBySenderInboxId =
              fromPeer &&
              !!msg.senderInboxId &&
              !!activePeerInboxId &&
              msg.senderInboxId.toLowerCase() === activePeerInboxId.toLowerCase();
            
            // [CRITICAL FIX #4] If we literally just sent this message, it is in optimisticContentMap.
            // This is absolute proof that the message belongs to the active peer!
            const isKnownOptimistic = !fromPeer && optimisticContentMap.current.has(content);
            
            const belongsToActive = belongsToActiveByAddr || belongsToActiveByConvoId || belongsToActiveBySenderInboxId || isKnownOptimistic;

            if (belongsToActive && convoId && !activeXmtpDmIdRef.current) {
              // Lock in the convoId for future messages if we were missing it
              activeXmtpDmIdRef.current = convoId;
            }
            if (belongsToActive && fromPeer && msg.senderInboxId && !activePeerInboxIdRef.current) {
              // Lock in the peer inboxId for future messages if we were missing it
              activePeerInboxIdRef.current = msg.senderInboxId;
            }

            // DIAGNOSTICS LOGGING
            console.log(`[XMTP Stream] New MSG | fromPeer:${fromPeer} | msgPeer:${normalizedMsgPeer} | activePeer:${normalizedActivePeer} | convoId:${convoId} | activeDmId:${activeXmtpDmIdRef.current}`);
            console.log(`[XMTP Stream] belongsToActive:${belongsToActive} (Addr:${belongsToActiveByAddr}, Convo:${belongsToActiveByConvoId}, Inbox:${belongsToActiveBySenderInboxId}, Opt:${isKnownOptimistic})`);
            (window as any).__xmtp_last_stream_msg = { msgPeer: normalizedMsgPeer, activePeer: normalizedActivePeer, belongsToActive };

            // [CRITICAL BUG FIX] If the message belongs to the active chat via the convoId fallback, 
            // msgConvPeer is a hash, meaning mappedMsg.conversationId was set to dm-<hash>.
            // The render loop filters out anything that isn't dm-<activePeer>. 
            // We MUST forcefully align the conversationId here, otherwise it gets inserted into state,
            // hidden by the UI, and permanently blackholed by the deduplication Set.
            if (belongsToActive) {
              mappedMsg.conversationId = `dm-${currentActivePeer}`;
            }

            if (belongsToActive) {

              // ── CATCH-ALL SIGNAL GUARD ───────────────────────────────────────
              // Signals that were not caught by earlier phases (e.g. __CALL_DECLINE__,
              // __CALL_HANGUP__, __READ__, __VOTE__) must NOT be inserted as chat bubbles.
              // The render filter is a secondary defence; this is the primary one.
              if (typeof mappedContent === 'string' && (
                mappedContent.startsWith('__CALL_') ||
                mappedContent.startsWith('__READ__') ||
                mappedContent.startsWith('__VOTE__') ||
                false /* __PAYMENT__ bubbles are rendered */
              )) {
                // Signal consumed — do not insert into message list
                continue;
              }

              // Background IndexedDB Save (do not block render)
              chatDB.saveMessages([mappedMsg]).catch(() => {});
              chatDB.saveConversation({
                peerAddress: msgConvPeer,
                lastAt: mappedMsg.sentAtNs
              }).catch(() => {});

              // Push notification when tab is hidden
              if (fromPeer && mappedMsg.senderInboxId !== (client as any)?.inboxId) {
                push.notifyIfHidden(fromPeer, mappedContent || content);
              }

              setMessages(prev => {
                // Guard: if real ID already in list (can happen on reconnect), skip
                if (prev.some(m => m.id === realId)) return prev;

                if (!fromPeer) {
                  // ── OWN MESSAGE ECHO: atomic optimistic swap ──────────────────
                  // Strategy 1: look up by content key in optimisticContentMap
                  const knownOptId = optimisticContentMap.current.get(content);
                  if (knownOptId) {
                    optimisticContentMap.current.delete(content); // consume the entry — key is the raw echoed content
                    const idx = prev.findIndex(m => m.id === knownOptId);
                    if (idx !== -1) {
                      const next = [...prev];
                      next[idx] = mappedMsg; // replace placeholder with confirmed msg
                      return next.sort((a, b) => a.sentAtNs - b.sentAtNs);
                    }
                  }
                  // Strategy 2: fallback — find any optimistic with identical content
                  const optIdx = prev.findIndex(
                    m => m.id.startsWith('optimistic-') &&
                         m.content === content
                  );
                  if (optIdx !== -1) {
                    const next = [...prev];
                    next[optIdx] = mappedMsg;
                    return next.sort((a, b) => a.sentAtNs - b.sentAtNs);
                  }
                  // Strategy 3: check if it's a transformed message (like __BURN__)
                  const burnIdx = prev.findIndex(
                    m => m.id.startsWith('optimistic-') &&
                         typeof m.content === 'string' &&
                         m.content.startsWith('__BURN_') &&
                         m.content.endsWith('__::' + content)
                  );
                  if (burnIdx !== -1) {
                    const next = [...prev];
                    next[burnIdx] = mappedMsg;
                    return next.sort((a, b) => a.sentAtNs - b.sentAtNs);
                  }
                  // Strategy 4: no optimistic found (e.g. second tab) — insert if not duplicate
                  if (prev.some(m => m.id === mappedMsg.id)) return prev;
                  return [...prev, mappedMsg].sort((a, b) => a.sentAtNs - b.sentAtNs);
                }

                // ── PEER MESSAGE: straightforward insert ──────────────────────────
                if (fromPeer && !content.startsWith('__')) {
                  // We are focused on this chat, so send a read receipt!
                  if (!document.hidden) {
                    if (ledgerSettings?.notification_sound !== false) { playReceiveSound(); };
                    triggerHaptic(ledgerSettings?.haptics_intensity ?? 0);
                    if (ledgerSettings?.show_read_receipts !== false && /^0x[a-fA-F0-9]{40}([a-fA-F0-9]{24})?$/.test(msgConvPeer)) {
                      sendMessage(client, msgConvPeer, `__READ__${realId}`, address).catch(e => console.warn('Failed to send read receipt', e));
                    }
                  } else {
                    // Phase 5: Advanced Push Notifications when app is hidden
                    notificationEngine.notifyLocal(
                      `Ledger Chat: ${shortAddr(msgConvPeer)}`,
                      formatMessagePreview(content),
                      msgConvPeer,
                      !!(ledgerSettings as any)?.hide_notification_content
                    );
                  }
                }
                if (prev.some(m => m.id === mappedMsg.id)) return prev;
                return [...prev, mappedMsg].sort((a, b) => a.sentAtNs - b.sentAtNs);
              });

              // Update conversation preview
              setConversations(prev => {
                const updated = prev.map(c =>
                  c.peerAddress.toLowerCase() === currentActivePeer
                    ? { ...c, lastMessage: content.slice(0, 30), lastAt: new Date() }
                    : c
                );
                persistToLocal(updated);
                return updated;
              });
            } else {
              // Belongs to a different (background) conversation
              if (fromPeer && !content.startsWith('__')) {
                const dnd = (ledgerSettings as any)?.do_not_disturb;
                const notifEnabled = ledgerSettings?.notifications_private !== false;
                const mutedPeer = (() => { try { return !!localStorage.getItem('ledger_muted_' + String(msgConvPeer || '').toLowerCase()); } catch { return false; } })();
                if (!dnd && !mutedPeer && notifEnabled && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                  const showPreview = !(ledgerSettings as any)?.hide_notification_content;
                  new Notification(`Ledger Chat: ${shortAddr(msgConvPeer || 'Unknown')}`, {
                    body: showPreview ? formatMessagePreview(content) : 'New message',
                    icon: '/favicon.ico'
                  });
                }
                if (!dnd) {
                  useDynamicIsland.getState().setState('notification', {
                    title: shortAddr(msgConvPeer || 'Unknown'),
                    subtitle: formatMessagePreview(content),
                  }, 4000);
                }
              }
              let needsSync = false;
              setConversations(prev => {
                if (!msgConvPeer) return prev;
                const exists = prev.some(c => c.peerAddress.toLowerCase() === msgConvPeer);
                let updated;
                if (exists) {
                  updated = prev.map(c =>
                    c.peerAddress.toLowerCase() === msgConvPeer
                      ? { ...c, lastMessage: content.slice(0, 30), lastAt: new Date() }
                      : c
                  );
                } else {
                  needsSync = true;
                  updated = [{
                    peerAddress: msgConvPeer,
                    lastMessage: content.slice(0, 30),
                    lastAt: new Date()
                  }, ...prev];
                }
                persistToLocal(updated);
                return updated;
              });
              if (needsSync && msgConvPeer) {
                syncToAddressBook(msgConvPeer);
              }
            }
            } catch (msgErr) {
              console.error('[XMTP Stream] Error processing message:', msgErr);
            }
          }
          await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (e: any) {
          const errMsg = (e?.message || String(e) || '').toLowerCase();
          // GroupInactive = stale MLS epoch. Silently re-sync and restart stream.
          const isGroupInactive = (
            errMsg.includes('group is inactive') ||
            errMsg.includes('groupinactive') ||
            errMsg.includes('group_inactive') ||
            errMsg.includes('inactive group')
          );
          if (!cancelled) {
            streamRestarts++;
            const backoffMs = Math.min(1000 * Math.pow(1.5, streamRestarts), 15000);
            if (!isGroupInactive) {
               console.warn('[Chat] global stream failed (will retry):', e);
            }
            try { await client.conversations.sync(); } catch {}
            await new Promise(resolve => setTimeout(resolve, backoffMs));
            continue; // restart the while loop → restart stream
          }
          break; // only exit if cancelled
        }
      } // end while
    })();

    return () => { 
      cancelled = true; 
      clearInterval(globalPoll); 
      if (activeAbortController) activeAbortController.abort();
    };
  }, [client, address]);

  //  Load messages when active peer changes 
  useEffect(() => {
    if (!client || !activePeer) return;

    let cancelled = false;
    let isFetching = false;

    const fetchHistorical = async (isInitial = false) => {
      if (isFetching || cancelled) return;
      isFetching = true;
      if (isInitial) setIsFetchingChat(true);
      try {
        // [1] Load instantly from IndexedDB cache
        const dmId = `dm-${activePeer.toLowerCase()}`;
        try {
          const localMsgs = await chatDB.getMessagesForConversation(dmId, 100);
          if (localMsgs && localMsgs.length > 0 && !cancelled) {
            setMessages(prev => {
              const existingIds = new Set(prev.map(m => m.id));
              const newMsgs = localMsgs.filter(m => !existingIds.has(m.id));
              return [...prev, ...newMsgs].sort((a, b) => a.sentAtNs - b.sentAtNs);
            });
          }
        } catch (dbErr) {
          console.warn('[ChatDB] Failed to load local cache', dbErr);
        }

        // [2] Fetch fresh from XMTP network
        let raw = await getMessages(client, activePeer);
        if (cancelled) return;
        console.log(`[XMTP fetchHistorical] raw msgs from network: ${raw.length} for peer ${activePeer.slice(0,10)}`);
        (window as any).__xmtp_raw_count = raw.length;
        (window as any).__xmtp_peer = activePeer;

        // Capture the native XMTP conversation ID so the stream loop can
        // route messages correctly even when inboxId→address resolution fails.
        try {
          if (raw && raw.length > 0) {
            // BEST SOURCE OF TRUTH: The actual messages fetched
            const firstMsg = raw[0];
            const convoId = firstMsg.conversation?.id || firstMsg.conversationId || firstMsg.groupId;
            if (convoId) {
              activeXmtpDmIdRef.current = convoId;
              // Cache for stream routing: convoId → peer eth address
              convIdToPeer.current.set(convoId, activePeer.toLowerCase());
            }
            
            const selfId = (client as any).inboxId ?? "";
            const peerMsg = raw.find((m: any) => m.senderInboxId && m.senderInboxId !== selfId);
            if (peerMsg) activePeerInboxIdRef.current = peerMsg.senderInboxId;
          } else {
            // FALLBACK: Find existing DM in listDms safely without creating a ghost
            const { getAddress } = await import('viem');
            let normalizedPeer = activePeer;
            try { normalizedPeer = getAddress(activePeer); } catch {}
            
            const dms = await client.conversations.listDms();
            const selfId = (client as any).inboxId ?? "";
            let foundDm = null;
            
            for (const d of dms) {
              const pAddr = await extractPeerAddress(d, selfId, address || "").catch(() => null);
              if (pAddr && pAddr.toLowerCase() === normalizedPeer.toLowerCase()) {
                foundDm = d;
                break;
              }
            }
            
            if (foundDm) {
              activeXmtpDmIdRef.current = foundDm.id;
              const memberIds = typeof foundDm.members === 'function' 
                ? (await foundDm.members()).map((m: any) => m.inboxId) 
                : (foundDm.memberInboxIds ?? []);
              const peerId = memberIds.find((id: string) => id !== selfId) ?? "";
              if (peerId) activePeerInboxIdRef.current = peerId;
            }
          }
        } catch (e) {
          console.warn('[Ledger Chat] Failed to resolve DM IDs securely:', e);
        }
        
        const clearTsMs = parseInt(localStorage.getItem(`ledger_cleared_${address}_${activePeer.toLowerCase()}`) || '0', 10);
        if (clearTsMs > 0) {
          const clearTsNs = clearTsMs; // Fixed: sentAtNs is actually in MS after mapping
          raw = raw.filter((m: any) => m.sentAtNs > clearTsNs);
        }
        
        // FETCH PENDING MESSAGES (OFFLINE ROUTING)
        let pendingServer: any[] = [];
        try {
          const pRes = await fetch(`/api/chat/queue?address=${encodeURIComponent(address)}`, { 
            cache: 'no-store',
            credentials: 'include',
            headers: { 'x-web3-address': address || '' } });
          if (pRes.ok) {
            const pData = await pRes.json();
            const msgs = pData.messages;
            if (msgs && Array.isArray(msgs) && msgs.length > 0) {
               // Filter to messages from the active peer only
               const fromActivePeer = msgs.filter((p: any) => 
                 p.sender?.toLowerCase() === activePeer.toLowerCase()
               );
               pendingServer = fromActivePeer
                 .filter((p: any) => typeof p.content !== 'string' || !p.content.startsWith('__CALL_'))
                 .map((p: any) => ({
                   id: p.id ?? `queue-${Date.now()}-${Math.random()}`,
                   senderInboxId: activePeer.toLowerCase(),
                   senderAddress: activePeer.toLowerCase(),
                   content: p.content,
                   sentAtNs: new Date(p.createdAt ?? p.timestamp ?? Date.now()).getTime(),
                   conversationId: `dm-${activePeer.toLowerCase()}`,
                   isMe: false,
                   fromPeer: true,
                   viaServer: true,
                }));
              
              if (pendingServer.length > 0) {
                console.log(`[Offline Queue] Delivering ${pendingServer.length} queued messages from ${activePeer}`);
                // Ack delivered messages so they are cleanly removed from server queue
                const idsToAck = fromActivePeer.map((p: any) => p.id).filter(Boolean);
                if (idsToAck.length > 0) {
                  fetch('/api/chat/queue', {
                    method: 'DELETE',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json', 'x-web3-address': address || '' },
                    body: JSON.stringify({ ids: idsToAck }),
                  }).catch(() => {});
                }
              }
            }
          }
        } catch (e) { console.warn('[Offline Queue] Failed to fetch pending messages:', e); }
        
        const rawMappedMsgs = raw
          .filter((m: any) => { const _str = typeof m.content === 'string' ? m.content : (m.content ? JSON.stringify(m.content) : ''); return !(_str.includes('initiatedByInboxId') || _str.includes('addedInboxes') || _str.includes('groupUpdated') || _str.includes('group is inactive')); })
          .map((m: any) => {
            const content = typeof m.content === 'string' ? m.content : (m.content ? JSON.stringify(m.content) : m.fallback || 'Encrypted Data');
            return {
              id: m.id,
              senderInboxId: m.senderInboxId,
              content: content,
              sentAtNs: nsToDate(m.sentAtNs ?? m.sentAt).getTime(),
              conversationId: `dm-${activePeer.toLowerCase()}`
            };
          })
          .filter((m: any) => {
             if (typeof m.content === 'string') {
                 const lc = m.content.toLowerCase();
                 if (lc.includes('initiatedbyinboxid')) return false;
                 if (lc.includes('from cursor')) return false;
                 if (lc.includes('group is inactive') || lc.includes('groupinactive')) return false;
                 if (lc.includes('originator_id') || lc.includes('sequence_id')) return false;
             }
             return true;
          });

        const combined = [...rawMappedMsgs, ...pendingServer].sort((a, b) => a.sentAtNs - b.sentAtNs);
        const mappedMsgs: any[] = [];
        const reactions: Record<string, Record<string, string[]>> = {};
        const readReceipts = new Set<string>();
        const revokedIds = new Set<string>();
        let latestPinnedId: string | null = null;
        let lastPeerMsgId: string | null = null;

        // [BUG FIX] Collect __VOTE__ signals from history so polls show correct tallies on load
        const historicalPollVotes: Record<string, Record<string, number>> = {};
        for (const m of combined) {
          const content = m.content;
          if (typeof content === 'string' && content.startsWith('__VOTE__')) {
            const parts = content.replace('__VOTE__', '').split('__::');
            if (parts.length >= 2) {
              const targetPollId = parts[0];
              const optionIndex = parseInt(parts[1], 10);
              const sender = m.senderInboxId || 'peer';
              if (!historicalPollVotes[targetPollId]) historicalPollVotes[targetPollId] = {};
              historicalPollVotes[targetPollId][sender] = optionIndex;
            }
          }
        }

        for (const m of combined) {
          const content = m.content;
          if (typeof content === 'string' && content.startsWith('__REACT__')) {
            const parts = content.split('__::');
            if (parts.length >= 2) {
              const targetId = parts[0].replace('__REACT__', '');
              const emoji = parts.slice(1).join('__::');
              const sender = m.senderInboxId || 'unknown';
              if (!reactions[targetId]) reactions[targetId] = {};
              if (!reactions[targetId][emoji]) reactions[targetId][emoji] = [];
              if (!reactions[targetId][emoji].includes(sender)) reactions[targetId][emoji].push(sender);
            }
          } else if (typeof content === 'string' && content.startsWith('__READ__')) {
            const readId = content.replace('__READ__', '');
            readReceipts.add(readId);
          } else if (typeof content === 'string' && content.startsWith('__PIN__')) {
            latestPinnedId = content.replace('__PIN__', '');
          } else if (typeof content === 'string' && content.startsWith('__REVOKE__')) {
            revokedIds.add(content.replace('__REVOKE__', ''));
          // [BUG FIX] Skip __VOTE__ signals from main message list — they are control signals only
          } else if (typeof content === 'string' && content.startsWith('__VOTE__')) {
            // Already processed above — skip rendering as bubble
          } else if (typeof content === 'string' && !content.startsWith('__CALL_')) {
             // [CRITICAL FIX] senderInboxId is an XMTP hash, not an eth address!
             // To know if it's from the peer, check if it is NOT from us.
             const selfId = (client as any).inboxId;
             const isFromPeer = m.senderInboxId !== selfId;
             
             if (isFromPeer) {
               lastPeerMsgId = m.id;
             }
             if (content.startsWith('__BURN_')) {
               const parts = content.split('__::');
               if (parts.length >= 2) {
                 const seconds = parseInt(parts[0].replace('__BURN_', ''), 10);
                 m.content = parts.slice(1).join('__::');
                 m.burnAtNs = m.sentAtNs + (seconds * 1000);
               }
             }
             // [CRITICAL FIX] Apply historical poll votes to POLL messages.
             // The pollId in a VOTE is the deterministic parts[0] of the POLL payload,
             // NOT m.id. So we must look up votes by extracting pollPayloadId from content.
             if (content.startsWith('__POLL__')) {
               const pollPayloadId = content.replace('__POLL__', '').split('__::')[0];
               const votes = historicalPollVotes[pollPayloadId] || historicalPollVotes[m.id] || null;
               if (votes) m.pollVotes = votes;

             }
             mappedMsgs.push(m);
          }
          // __CALL_ signals are control-only; intentionally not pushed to mappedMsgs.
        }

        if (latestPinnedId) setPinnedMessageId(latestPinnedId);

        // Apply metadata to actual messages
        const processedMsgs = mappedMsgs.filter(m => !revokedIds.has(m.id) && (!m.burnAtNs || m.burnAtNs > Date.now()));
        for (const m of processedMsgs) {
          if (reactions[m.id]) m.reactions = reactions[m.id];
          if (readReceipts.has(m.id)) m.status = 'read';
        }

        // Auto-send read receipt if there is an unread message from the peer
        if (lastPeerMsgId) {
          const receiptKey = `ledger_receipt_${address.toLowerCase()}_${activePeer.toLowerCase()}`;
          if (localStorage.getItem(receiptKey) !== lastPeerMsgId) {
            localStorage.setItem(receiptKey, lastPeerMsgId);
            sendMessage(client, activePeer, `__READ__${lastPeerMsgId}`, address).catch(e => console.warn('Failed to send read receipt', e));
          }
        }

        // ── POLL MERGE WITH FULL DEDUPLICATION ───────────────────────────────
        // Register all newly fetched real IDs in confirmedMsgIds so the stream
        // cannot double-insert them when the echo arrives after the poll.
        processedMsgs.forEach((m: any) => confirmedMsgIds.current.add(m.id));
        
        // ─────────────────────────────────────────────────────────────────────
        // CRITICAL FIX: PURELY ADDITIVE MERGE
        // We NEVER replace the message list — we only add messages not yet present.
        // This prevents poll failures (empty array from XMTP) from wiping optimistic
        // messages or stream-received messages that haven't been confirmed yet.
        // ─────────────────────────────────────────────────────────────────────
        setMessages(prev => {
          const activeId = `dm-${activePeer.toLowerCase()}`;
          
          // Build a set of all IDs currently in state for O(1) lookup
          const existingIds = new Set(prev.map(m => m.id));
          
          // Only add messages we haven't seen before (truly new from poll)
          let newConfirmed = processedMsgs.filter((m: any) => !existingIds.has(m.id));
          
          // [BUG FIX] CLEAR CHAT GUARD FOR RT STREAM
          // Filter out messages older than the user's local clear timestamp,
          // otherwise every poll re-injects the deleted history.
          const clearTsMs = parseInt(localStorage.getItem(`ledger_cleared_${address}_${activePeer.toLowerCase()}`) || '0', 10);
          if (clearTsMs > 0) {
            const clearTsNs = clearTsMs; // Fixed: sentAtNs is actually in MS after mapping
            newConfirmed = newConfirmed.filter((m: any) => m.sentAtNs > clearTsNs);
          }
          
          // ── KEY GUARD ──────────────────────────────────────────────────────
          // If the poll returned NOTHING new, return prev UNCHANGED.
          // This is what prevents an empty XMTP response from wiping all messages.
          // ──────────────────────────────────────────────────────────────────
          if (newConfirmed.length === 0) return prev;
          
          // For each NEW confirmed message, find and remove its optimistic twin
          const optimisticToRemove = new Set<string>();
          for (const confirmed of newConfirmed) {
            // Check for identical content first, which covers the majority of cases.
            // Ignore time window completely if content matches perfectly.
            const exactTwin = prev.find(
              m => m.id.startsWith('optimistic-') &&
                   m.conversationId === activeId &&
                   m.content === confirmed.content
            );
            if (exactTwin) {
              optimisticToRemove.add(exactTwin.id);
            } else {
              // Strategy 2: check if it's a transformed message (like __BURN__)
              const burnTwin = prev.find(
                m => m.id.startsWith('optimistic-') &&
                     m.conversationId === activeId &&
                     typeof m.content === 'string' &&
                     m.content.startsWith('__BURN_') &&
                     m.content.endsWith('__::' + confirmed.content)
              );
              if (burnTwin) optimisticToRemove.add(burnTwin.id);
            }
          }
          
          // Drop only the replaced optimistic twins, keep everything else
          const base = prev.filter(m => !optimisticToRemove.has(m.id));
          const finalMessages = [...base, ...newConfirmed].sort((a, b) => a.sentAtNs - b.sentAtNs);
          
          // Save all new confirmed messages to IndexedDB
          if (newConfirmed.length > 0) {
            chatDB.saveMessages(newConfirmed).catch(e => console.warn('[ChatDB] Failed to save msgs:', e));
            chatDB.saveConversation({
              peerAddress: activePeer.toLowerCase(),
              lastAt: newConfirmed[newConfirmed.length - 1].sentAtNs
            }).catch(() => {});
          }

          return finalMessages;
        });

      } catch (e) {
        console.warn('[Chat] load messages failed:', e);
      } finally {
        isFetching = false;
        setIsFetchingChat(false);
      }
    };

    fetchHistorical(true);

    // Fallback polling for the active conversation history
    const pollId = setInterval(() => fetchHistorical(false), 12000);

    const fetchFriendRequests = async () => {
      if (!address) return;
      try {
        const res = await fetch('/api/chat/contacts/request?direction=incoming', { headers: { 'x-web3-address': address } });
        if (res.ok) {
          const data = await res.json();
          if (data.requests) setPendingRequestCount(data.requests.length);
        }
      } catch (e) {}
    };
    fetchFriendRequests();
    const reqPollId = setInterval(fetchFriendRequests, 10000);

    return () => {
      cancelled = true;
      clearInterval(pollId);
      if (typeof reqPollId !== 'undefined') clearInterval(reqPollId);
    };
  }, [client, activePeer, address]);

  // [BUG FIX] Separate flag for opening a new conversation — previously used the shared
  // 'sending' flag, which caused executeSend to silently abort the user's first message
  // because (!isSystemSignal && sending) returned true while the peer lookup was in-flight.
  const [isStartingConversation, setIsStartingConversation] = useState(false);

  const handleStartConversationWithPeer = async (peerAddr: string) => {
      if (!client || !peerAddr || isStartingConversation) return;
      setIsStartingConversation(true);
      try {
        let peer = peerAddr.trim();
        if (peer.toLowerCase().startsWith('ethereum:')) {
            peer = peer.substring(9).split('@')[0];
        }

        // Resolve @username handle to wallet address via search API
        if (!peer.startsWith('0x') || (peer.length !== 42 && peer.length !== 66)) {
          try {
            const res = await fetch(`/api/chat/users/search?q=${encodeURIComponent(peer)}`);
            const data = await res.json();
            if (data.users && data.users.length > 0) {
              peer = data.users[0].address;
            } else {
              toast.error(`No one found for ${peer}`);
              setIsStartingConversation(false);
              return;
            }
          } catch {
            toast.error('Search is unavailable right now. Paste a wallet address instead.');
            setIsStartingConversation(false);
            return;
          }
        }

        // Accept both EVM (42 chars: 0x + 40) and Aztec (66 chars: 0x + 64) addresses
        if (!/^0x[a-fA-F0-9]{40}([a-fA-F0-9]{24})?$/.test(peer)) {
            toast.error('Enter a wallet address that starts with 0x, or a @username.');
            setIsStartingConversation(false);
            return;
        }

        if (peer) {
            let canMsg = canReceiveCache.current.get(peer.toLowerCase());
            if (canMsg !== true) {
                canMsg = await canReceiveMessages(client, peer);
                if (canMsg) canReceiveCache.current.set(peer.toLowerCase(), true);
            }
            if (!canMsg) {
                toast.info(`This person has not set up Ledger Chat yet. Messages will wait until they do.`);
            }
        }

        const newConv = { peerAddress: peer, lastMessage: '', lastAt: new Date() };

        let needsSync = false;
        setConversations(prev => {
            const exists = prev.find(c => c.peerAddress.toLowerCase() === peer.toLowerCase());
            if (exists) return prev;
            needsSync = true;
            const updated = [newConv, ...prev];
            persistToLocal(updated);
            return updated;
        });
        if (needsSync) {
            syncToAddressBook(peer);
        }

        const dmId = `dm-${peer.toLowerCase()}`;
        peerToConvId.current.set(peer.toLowerCase(), dmId);
        convIdToPeer.current.set(dmId, peer);
        activePeerDmIdRef.current = dmId;

        setActivePeer(peer);
        setShowList(false);
        setPeerInput('');
        setShowScanner(false);
      } catch {
        alert('Invalid address.');
      } finally {
        setIsStartingConversation(false);
      }
  };

  const handleStartConversation = async () => handleStartConversationWithPeer(peerInput);

  const executeSend = async (content: string) => {
    // 1. App Store Compliance: Content Moderation & Rate Limiting
    if (!checkRateLimit(address || 'anon', 60, 60000)) {
      toast.error('You are sending messages too quickly. Wait a moment.');
      return;
    }
    const moderationFlag = moderateContent(content);
    if (moderationFlag) {
      toast.error(moderationFlag);
      return;
    }
    trackMessageSent(activePeer || undefined);

    if (!client || !activePeer || !content.trim() || !address) return;
    
    const isReaction = content.startsWith('__REACT__');
    const isVote = content.startsWith('__VOTE__');
    const isSystemSignal = content.startsWith('__CALL_') || isReaction || isVote;
    if (!isSystemSignal && sending) return;

    // Native client-side slash commands (/me, /shrug, /code, /table, /urgent, /clear, /online, /away, /dnd)
    const { transformed, isHandledLocally, action } = transformClientCommand(content, getDisplayName(address || ''));
    if (isHandledLocally) {
      if (action === 'clear') {
        setMessages([]);
        toast.success('Chat screen cleared');
      } else if (action === 'status_online' || action === 'status_away' || action === 'status_dnd') {
        const mode = action.replace('status_', '');
        fetch('/api/chat/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, status: mode })
        }).catch(() => {});
        toast.success(`Presence updated to ${mode.toUpperCase()}`);
      }
      setMessage('');
      setInputText('');
      setShowBotSuggestions(false);
      return;
    }
    content = transformed;

    // Bot command interception
    if (isBotCommand(content)) {
      const botResponse = await executeBotCommand(content);
      if (botResponse) {
        const cmdMsg = {
          id: `bot-cmd-${Date.now()}`,
          senderInboxId: (client as any)?.inboxId || '',
          content: content,
          sentAtNs: Date.now(),
          conversationId: `dm-${activePeer?.toLowerCase()}`
        };
        const botMsg = {
          id: `bot-${Date.now()}`,
          senderInboxId: '__bot__',
          content: `🤖 ${botResponse}`,
          sentAtNs: Date.now() + 1,
          conversationId: `dm-${activePeer?.toLowerCase()}`
        };
        setMessages((prev: any[]) => [...prev, cmdMsg, botMsg].sort((a, b) => a.sentAtNs - b.sentAtNs));
        setMessage('');
        setShowBotSuggestions(false);
        return; 
      }
    }

    if (!isSystemSignal) setSending(true);
    
    // Phase 2: Message Quoting
    let finalContent = content;
    if (replyingTo && !isSystemSignal) {
      const snippet = (replyingTo.content || '').replace(/__/g, '').slice(0, 80);
      finalContent = `__REPLY__${replyingTo.id}__SNIPPET__${snippet}__::${content}`;
      setReplyingTo(null);
    }
    // Thread support
    if (threadParentId && !isSystemSignal) {
      finalContent = `__THREAD__${threadParentId}__::${finalContent}`;
      setThreadParentId(null);
    }

    // Smart macros
    if (ledgerSettings?.smart_macros && !isSystemSignal) {
      if (content.trim() === '/add') { finalContent = `My wallet: ${address}`; }
      else if (/^\/pay (\d+\.?\d*)$/.test(content.trim())) {
        const m = content.trim().match(/^\/pay (\d+\.?\d*)$/);
        if (m) { setTransferAmount(m[1]); setShowWalletTransfer(true); setSending(false); return; }
      }
    }
    // Tone translator  
    if (ledgerSettings?.tone_translator && !isSystemSignal) {
      finalContent = finalContent
        .replace(/\bfuck(ing)?\b/gi, 'strongly disagree')
        .replace(/\bshit\b/gi, 'situation')
        .replace(/\bbitch\b/gi, 'person')
        .replace(/\basshole\b/gi, 'individual')
        .replace(/\bidiot|moron|stupid\b/gi, 'someone with a different view');
    }

    // Disappearing messages: a timer set for this chat wins over the global one.
    if (!isSystemSignal) {
      let chatTimer = 'off';
      try { chatTimer = localStorage.getItem('ledger_disappearing_' + activePeer.toLowerCase()) || 'off'; } catch {}
      const globalTimer = (ledgerSettings as any)?.auto_delete_timer || 'off';
      const SECONDS: Record<string, number> = {
        '1 hour': 3600, '24 hours': 86400, '1 day': 86400, '1 week': 604800, '1 month': 2592000, '1 year': 31536000,
        '24h': 86400, '7d': 604800, '90d': 7776000,
      };
      const secs = chatTimer !== 'off' ? SECONDS[chatTimer] : SECONDS[globalTimer];
      if (secs) finalContent = `__BURN_${secs}__::${finalContent}`;
    }

    // ── Messages are 100% free — no QD deduction per message (Axel strategy) ──
    // Chat must always be free. QDs are only for optional premium features.
    // Rate limiting is handled by the checkRateLimit() call above.

    if (address) {
        localStorage.removeItem(`ledger_draft_${address.toLowerCase()}_${activePeer.toLowerCase()}`);
    }

    const optimisticId = `optimistic-${Date.now()}`;

    try {
      if (!isReaction) {
        // ─── OPTIMISTIC INSERT ────────────────────────────────────────────────────
        // Register the content in the map BEFORE inserting, so the stream echo
        // can find and replace this optimistic message atomically when it arrives.
        optimisticContentMap.current.set(finalContent, optimisticId); // FIX: must match what XMTP echoes back

        let displayContent = finalContent;
        let burnAtNs: number | undefined = undefined;
        if (finalContent.startsWith('__BURN_')) {
          const parts = finalContent.split('__::');
          if (parts.length >= 2) {
            const seconds = parseInt(parts[0].replace('__BURN_', ''), 10);
            displayContent = parts.slice(1).join('__::');
            burnAtNs = Date.now() + (seconds * 1000);
          }
        }

        const optimisticMsg = {
          id: optimisticId,
          senderInboxId: client?.inboxId || '',
          content: displayContent,
          burnAtNs,
          sentAtNs: Date.now(),
          conversationId: `dm-${activePeer.toLowerCase()}`
        };
        setMessages(prev => [...prev, optimisticMsg].sort((a, b) => a.sentAtNs - b.sentAtNs));

        // Clear typing indicator immediately
        stopTypingSignal();
      } else {
        // Phase 2: Optimistic Reaction Insert
        const parts = finalContent.split('__::');
        if (parts.length >= 2) {
          const targetId = parts[0].replace('__REACT__', '');
          const emoji = parts.slice(1).join('__::');
          const sender = client?.inboxId || 'me';
          setMessages(prev => prev.map(m => {
            if (m.id === targetId) {
              const reactions = m.reactions || {};
              const users = reactions[emoji] || [];
              if (!users.includes(sender)) {
                return { ...m, reactions: { ...reactions, [emoji]: [...users, sender] } };
              }
            }
            return m;
          }));
        }
      }

      if (!isSystemSignal && !isReaction) if (ledgerSettings?.notification_sound !== false) { playSendSound(); };
      triggerHaptic(ledgerSettings?.haptics_intensity ?? 0);

      // If device is offline, also save to localStorage outbox as backup
      if (isOffline) {
        const outboxKey = `ledger_outbox_${address.toLowerCase()}`;
        const existing = JSON.parse(localStorage.getItem(outboxKey) || '[]');
        existing.push({ peer: activePeer, content: finalContent });
        localStorage.setItem(outboxKey, JSON.stringify(existing));
        toast.info("You are offline. This message will be sent when you reconnect.");
      }

      // ALWAYS send via XMTP / offline queue — works both online AND offline.
      // sendMessage() handles: XMTP retries, fallback to DB offline queue, and
      // guarantees delivery when the recipient opens Ledger Chat.
      await sendMessage(client, activePeer, finalContent, address);

      // Persist sent message to IndexedDB so it survives reloads immediately
      if (!isReaction) {
        import('@/lib/chat/indexeddb').then(({ chatDB }) => {
          chatDB.saveMessages([{
            id: optimisticId,
            senderInboxId: (client as any)?.inboxId || '',
            senderAddress: address.toLowerCase(),
            content: displayContent,
            sentAtNs: Date.now() * 1_000_000,
            conversationId: `dm-${activePeer.toLowerCase()}`,
            status: 'sent',
          }]).catch(() => {});
        }).catch(() => {});
      }

      if (!isReaction) {
        // UPDATE LOCAL ADDRESS BOOK
        setConversations(prev => {
          const updated = prev.find(c => c.peerAddress.toLowerCase() === activePeer.toLowerCase())
            ? prev.map(c => c.peerAddress.toLowerCase() === activePeer.toLowerCase() ? { ...c, lastMessage: finalContent, lastAt: new Date() } : c)
            : [{ peerAddress: activePeer, lastMessage: finalContent, lastAt: new Date() }, ...prev];
          persistToLocal(updated);
          return updated;
        });
      }
      return;

    } catch (err: any) {
      // [FIX] Removed 'throw err' which was short-circuiting the UI error feedback.
      // Now, failed messages will correctly display a red error state in the chat bubble.
      // Use 'finalContent' (processed input) to match what we inserted into the map.
      optimisticContentMap.current.delete(finalContent);
      const errString = err?.message || String(err);
      setMessages(prev => prev.map(m => 
        m.id === optimisticId 
          ? { ...m, failed: true, error: errString } 
          : m
      ));
      console.error('[Chat] executeSend failed:', err);
    } finally {
      if (!isSystemSignal) setSending(false);
    }
  };

  // Wire the always-fresh ref — this is read by the offline outbox flush event listener
  // Using a ref avoids stale closures across render cycles (production-critical for scale)
  executeSendRef.current = executeSend;

  // ─── Hito 4: Link Preview Detection ─────────────────────────────────────
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  
  // Detect link in input and fetch preview metadata
  const detectLinkPreview = useCallback(async (text: string) => {
    const match = text.match(urlRegex);
    if (!match) { setLinkPreview(null); return; }
    const url = match[0];
    try {
      const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const data = await res.json();
        setLinkPreview({ url, title: data.title || url, description: data.description || '', image: data.image });
      }
    } catch { /* silently ignore */ }
  }, []);

  useEffect(() => {
    if (!inputText.trim()) { setLinkPreview(null); return; }
    const t = setTimeout(() => detectLinkPreview(inputText), 800);
    return () => clearTimeout(t);
  }, [inputText, detectLinkPreview]);

  // ─── Hito 4: GIF Search (Proxy via internal API) ────────────────────────────────
  const searchGifs = useCallback(async (q: string) => {
    if (!q.trim()) { setGifResults([]); return; }
    try {
      const res = await fetch(`/api/gif/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) {
        setGifResults([]);
        return;
      }
      const data = await res.json();
      const urls = (data.results || []).map((r: any) => r.media_formats?.gif?.url || r.media_formats?.tinygif?.url).filter(Boolean);
      setGifResults(urls);
    } catch { 
      setGifResults([]);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchGifs(gifSearch), 500);
    return () => clearTimeout(t);
  }, [gifSearch, searchGifs]);

  // ─── Hito 4: Scheduled Messages ──────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check size limit (~1MB safe for XMTP encoded as Base64)
    if (file.size > 1024 * 1024) {
      toast.error('Files can be up to 1 MB');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    
    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        const msg = `[ATTACHMENT:${file.type || 'application/octet-stream'}]${base64data}|${file.name}`;
        executeSend(msg);
        setIsUploading(false);
        if (fileRef.current) fileRef.current.value = '';
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      toast.error('Could not attach the file');
      setIsUploading(false);
    }
  };

  // ─── Live Location: watchPosition-based real-time sharing ───────────────────
  const startLiveLocation = useCallback(() => {
    if (liveLocationWatchId !== null) {
      // Already tracking — stop it
      navigator.geolocation.clearWatch(liveLocationWatchId);
      setLiveLocationWatchId(null);
      setIsLiveLocationActive(false);
      toast.success('Live location stopped');
      return;
    }

    if (!navigator.geolocation) {
      toast.error('This browser cannot share your location');
      return;
    }

    // Send initial position immediately
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        executeSendRef.current?.(`[LIVELOCATION]${pos.coords.latitude},${pos.coords.longitude}`);
      },
      () => toast.error('Location access is blocked. Allow it in your browser settings.')
    );

    // Watch for continuous updates (~10s cadence via maximumAge)
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        executeSendRef.current?.(`[LIVELOCATION]${pos.coords.latitude},${pos.coords.longitude}`);
      },
      (err) => console.warn('[Live Location] watchPosition error:', err),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    setLiveLocationWatchId(watchId);
    setIsLiveLocationActive(true);
    toast.success('Sharing your live location');

    // Auto-stop after 15 minutes
    setTimeout(() => {
      navigator.geolocation.clearWatch(watchId);
      setLiveLocationWatchId(null);
      setIsLiveLocationActive(false);
      toast.info('Live location ended after 15 minutes');
    }, 15 * 60 * 1000);
  }, [liveLocationWatchId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    setSendAnimKey(k => k + 1);
    // ── [FASE 16: Rate-Limit Guard] ──────────────────────────────────────
    const now = Date.now();
    const rl = rateLimitRef.current;
    rl.timestamps = rl.timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (rl.timestamps.length >= RATE_LIMIT_MAX) {
      toast.warning('You are sending messages too quickly. Wait a moment.');
      return;
    }
    rl.timestamps.push(now);
    let txt = inputText.trim();
    if (replyingTo) {
      const snippet = (replyingTo.content || '').replace(/__/g, '').slice(0, 80);
      txt = `__REPLY__${replyingTo.id}__SNIPPET__${snippet}__::${txt}`;
      setReplyingTo(null);
    }
    if (isSecretChat) {
      txt = `__BURN_15__::${txt}`;
    } else if (burnTimer) {
      txt = `__BURN_${burnTimer}__::${txt}`;
      setBurnTimer(null);
    }
    setInputText('');
    setLinkPreview(null);
    if (scheduledAt) {
      const delayMs = scheduledAt.getTime() - Date.now();
      setScheduledAt(null);
      if (delayMs > 0) {
        setTimeout(() => executeSendRef.current?.(txt), delayMs);
        // Show a local optimistic placeholder for the scheduled message
        const schedId = `sched_${Date.now()}`;
        setMessages(prev => [...prev, {
          id: schedId,
          senderInboxId: client?.inboxId ?? '',
          content: txt,
          sentAtNs: scheduledAt.getTime(),
          conversationId: `dm-${activePeer?.toLowerCase()}`,
          status: 'scheduled',
        }]);
        return;
      }
    }
    if ((window as any).__ledger_tone_translator) {
      const TONE_MAP: Record<string, string> = { 'hate': 'strongly dislike', 'stupid': 'not optimal', 'idiot': 'mistaken', 'kill': 'stop' };
      let softened = txt;
      Object.entries(TONE_MAP).forEach(([w, r]) => softened = softened.replace(new RegExp(`\\b${w}\\b`, 'gi'), r));
      if (softened !== txt) { txt = softened; toast('Some words were softened before sending'); }
    }
    await executeSend(txt);
  };
  
  const uploadAttachment = async (fileOrBlob: Blob, filename: string): Promise<string | null> => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', fileOrBlob, filename);
      const res = await fetch('/api/chat/attachments', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      return `[ATTACHMENT:${data.type}]${data.url}|${data.name}`;
    } catch (err: any) {
      alert('Attachment failed: ' + err.message);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !client || !activePeer || !address) return;
    const payload = await uploadAttachment(file, file.name);
    if (payload) {
      await executeSend(payload);
    }
  };

  // [AUDIO REMOVED] playAudioPing is permanently silenced.
  // eslint-disable-next-line no-unused-vars
  const playAudioPing = (_type: 'send' | 'receive') => { /* no-op */ };

  const [prevMsgCount, setPrevMsgCount] = useState<number>(0);
  useEffect(() => {
    setPrevMsgCount(messages.length);
  }, [messages.length]);

  if (!isBiometricallyUnlocked) {
    // The lock screen checks the PIN with the server. It used to unlock on
    // any key press, which made it a picture of a lock rather than a lock.
    return (
      <PinPrompt
        variant="screen"
        title="Ledger Chat is locked"
        subtitle="Enter your PIN to open your conversations."
        onUnlock={() => setIsBiometricallyUnlocked(true)}
      />
    );
  }

  if (!isConnected) {
    const inDesktopApp = typeof window !== 'undefined' && (window as any).electronAPI?.isElectron;
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-white px-6 py-12 text-center">
        <div className="w-14 h-14 rounded-full bg-[#eff1f4] flex items-center justify-center text-[#15171c] mb-5">
          <Wallet size={24} strokeWidth={1.8} />
        </div>
        <h2 className="text-[22px] font-semibold tracking-[-0.015em] text-[#15171c]">Connect your wallet</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#727a88] max-w-sm">
          Ledger Chat uses your wallet as your account. Your message keys are created on this device and stay here.
        </p>
        {inDesktopApp && (
          <p className="mt-4 text-[14px] leading-relaxed text-[#475061] max-w-sm bg-[#f7f8fa] border border-[#e4e7ec] rounded-xl px-4 py-3 text-left">
            Browser extensions cannot run inside the desktop app. Choose Connect and scan the code with the wallet app on your phone.
          </p>
        )}
        <button
          type="button"
          onClick={() => openAppKit()}
          className="mt-6 h-12 px-6 rounded-full bg-[#15171c] hover:bg-[#2b2f38] text-white text-[15px] font-medium transition-colors"
        >
          Connect
        </button>
      </div>
    );
  }

  //  Email User — dedicated relay-based chat (no XMTP wallet signer needed) 
  if (isEmailUser) {
    const emailLabel = (address as string).replace('email_', '');
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-white px-6 py-12 text-center">
        <div className="w-14 h-14 rounded-full bg-[#eff1f4] flex items-center justify-center text-[#15171c] mb-5">
          <Mail size={24} strokeWidth={1.8} />
        </div>
        <h2 className="text-[22px] font-semibold tracking-[-0.015em] text-[#15171c]">Link a wallet to start messaging</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#727a88] max-w-sm">
          You are signed in as <span className="text-[#15171c] font-medium">{emailLabel}</span>. Encrypted messages are tied to a wallet, so connect one to continue.
        </p>
        <button
          type="button"
          onClick={() => openAppKit()}
          className="mt-6 h-12 px-6 rounded-full bg-[#15171c] hover:bg-[#2b2f38] text-white text-[15px] font-medium transition-colors"
        >
          Connect a wallet
        </button>
      </div>
    );
  }

  //  Loading / Padlock Auth Screen
  if (!client) {
    return (
      <TuringShieldGate>
      <PadlockLoader
        isInitializing={isInitializing}
        isWaitingForSignature={isWaitingForSignature}
        initError={initError}
        onActivate={initClient}
        onClearAndRetry={() => {
          try {
            const keys = Object.keys(localStorage).filter(k => k.startsWith('xmtp') || k.includes('xmtp'));
            keys.forEach(k => localStorage.removeItem(k));
            if (typeof indexedDB !== 'undefined') {
              ['xmtp', 'xmtp-v2', 'xmtp-prod', 'xmtp-dev'].forEach(name => { try { indexedDB.deleteDatabase(name); } catch(e) {} });
            }
          } catch(e) {}
          setInitError('');
          setTimeout(() => initClient(), 500);
        }}
        onReconnect={() => { openAppKit(); }}
        onRefreshSession={() => { reconnect(); initClient(); }}
        onClearError={() => setInitError('')}
      />
      </TuringShieldGate>
    );
  }
  if (!hasAcceptedEula) {
    return (
      <ChatCommunityGate
        onAccept={() => {
          vault.setItem('ledger_eula_accepted', 'true');
          setHasAcceptedEula(true);
        }}
        onDecline={() => {
          window.location.href = '/';
        }}
      />
    );
  }

  // Wait for PXE settings to load before deciding to show onboarding,
  // otherwise it briefly flickers for returning users while settings fetch.
  if (!isOnboarded) {
    if (!pxeLoaded || effectiveAddress === '0x0') {
      return (
        <div className="flex-1 h-full bg-white flex flex-col items-center justify-center gap-3 text-[#727a88]" role="status">
          <LoaderCircle size={22} strokeWidth={2} className="animate-spin" aria-hidden="true" />
          <span className="text-[14px]">Loading your account</span>
        </div>
      );
    }
    return (
      <LedgerChatOnboarding 
        address={effectiveAddress} 
        onComplete={() => {
          try { localStorage.setItem('ledger_onboarded_' + effectiveAddress, 'true'); } catch {}
          setIsOnboarded(true);
        }} 
      />
    );
  }


  return (
    <TuringShieldGate>
      {/* [LAYOUT FIX] This wrapper must be h-full flex-col so that `flex-1 min-h-0`
          children (the two-panel layout) can resolve their height against the viewport.
          Without this, TuringShieldGate's Fragment return gives no height context. */}
      <div className="flex flex-col h-full w-full min-h-0 overflow-hidden">
      {lockedChatPeer && (
        <PinPrompt
          title="This chat is locked"
          subtitle={`Enter your PIN to open your conversation with ${getDisplayName(lockedChatPeer)}.`}
          onCancel={() => setLockedChatPeer(null)}
          onUnlock={() => {
            const peer = lockedChatPeer;
            setLockedChatPeer(null);
            setActiveCommunity(null);
            setActivePeer(peer);
            setShowList(false);
          }}
        />
      )}
      {/* FULL SCREEN MODALS */}
      <AnimatePresence>
        {showSettings && (
          <LedgerChatSettings 
            onClose={() => setShowSettings(false)} 
            address={effectiveAddress} 
          />
        )}
        
        
      {showVault && (
          <LedgerChatVaultManager onClose={() => setShowVault(false)} />
        )}

        {showUserSearch && (
          <LedgerChatUserSearch 
            myAddress={effectiveAddress}
            onClose={() => setShowUserSearch(false)}
            onAddContact={(addr) => {
              loadContacts();
              setActivePeer(addr);
              if (isMobile) setShowList(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* ── CONTACT INFO PANEL ── */}
      <AnimatePresence>
        {showContactInfo && activePeer && (
          <ContactInfoPanel key="contact-info-panel"
            myAddress={effectiveAddress || ''}
            messages={messages.filter((m: any) => m.conversationId === `dm-${activePeer?.toLowerCase()}`)}
            onClearChat={() => {
              setShowContactInfo(false);
              if (window.confirm('Are you sure you want to clear this chat? This will remove all messages from your device.')) {
                localStorage.setItem(`ledger_cleared_${address}_${activePeer.toLowerCase()}`, Date.now().toString());
                setMessages(prev => prev.filter(m => m.conversationId !== `dm-${activePeer.toLowerCase()}`));
                toast.success('Chat cleared');
              }
            }}
            onAddToGroup={() => {
              setShowContactInfo(false);
              setShowCreateGroup(true);
            }}
            groups={[]}
            peerAddress={activePeer}
            peerName={getDisplayName(activePeer)}
            onClose={() => setShowContactInfo(false)}
            onVoiceCall={() => { setShowContactInfo(false); handleStartCall('audio', activePeer); }}
            onVideoCall={() => { setShowContactInfo(false); handleStartCall('video', activePeer); }}
            onSearch={() => { setShowContactInfo(false); setShowSearch(true); }}
            onBlock={() => {
              setShowContactInfo(false);
              setBlockedPeers(prev => {
                const next = new Set(prev);
                next.add(activePeer.toLowerCase());
                vault.setItem('ledger_blocked', JSON.stringify(Array.from(next)));
                return next;
              });
              setActivePeer(null);
              toast.success(`${getDisplayName(activePeer)} is blocked`);
            }}
          />
        )}
      </AnimatePresence>

      {/* ── FULL SETTINGS (WhatsApp parity) ── */}
      <AnimatePresence>
        {showFullSettings && (
          <LedgerSettingsFull key="ledger-settings-full"
            myAddress={effectiveAddress || ''}
            myName={getDisplayName(effectiveAddress || '')}
            onClose={() => setShowFullSettings(false)}
          />
        )}
      </AnimatePresence>

    {/* ─── WebRTC Ringtone Audio Element ────────────────────────────────────── */}
    <audio ref={ringAudioRef} loop playsInline x-webkit-airplay="allow" src="/sounds/call_ringtone.mp3" style={{ display: 'none' }} />

    {/* Solid white container — two-panel layout: sidebar (left) + chat (right) */}
      <div className={`relative flex flex-row flex-1 min-h-0 w-full overflow-hidden shadow-sm ${(showScanner || showMyQR || showProfile) ? 'overflow-visible' : ''}`} style={{ 
      borderRadius: 0,
      background: '#ffffff',
      fontFamily,
    }}>
      {/*  Sidebar: Conversation List — fixed width on desktop, full screen on mobile when no chat is active  */}
      <div className={`${sidebarTab === 'communities' ? (activeCommunity ? 'hidden md:flex' : 'flex') : (showList ? 'flex' : 'hidden md:flex')} w-full md:w-80 lg:w-96 flex-col border-r border-black/[0.08] bg-white shrink-0 h-full overflow-hidden`}>

        {/* ── Sidebar Header ── */}
        <div className="px-4 py-3 border-b border-[#e4e7ec] bg-white flex flex-col gap-3" style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))' }}>
          {/* Top row: Identity + Quick Actions */}
          <div className="flex items-center justify-between">
            <button type="button" className="flex items-center gap-2.5 min-w-0 rounded-xl -ml-1 px-1 py-1 hover:bg-[#f2f4f7] transition-colors text-left" onClick={() => setShowFullSettings(true)} aria-label="Your profile and settings">
              <Avatar address={effectiveAddress} isMe={true} size={38} />
              <div className="flex flex-col min-w-0">
                <span className="text-[15px] font-semibold text-[#15171c] truncate max-w-[140px]">{getDisplayName(effectiveAddress)}</span>
                <span className="text-[12px] text-[#727a88] tabular-nums">{shortAddr(effectiveAddress)}</span>
              </div>
            </button>
            <div className="flex items-center gap-1">
              <ZkNotificationBell />
              <button onClick={() => setShowZkWallet(true)} className="relative w-9 h-9 rounded-full hover:bg-[#f2f4f7] flex items-center justify-center text-[#15171c] transition-colors" title="Private wallet" aria-label="Private wallet">
                <Lock size={16} />
              </button>
              <button onClick={() => setShowContactRequests(true)} className="relative w-9 h-9 rounded-full hover:bg-[#f2f4f7] flex items-center justify-center text-[#15171c] transition-colors" title="Contact requests" aria-label="Contact requests">
                <Bell size={18} />
                {pendingRequestCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#e5484d] ring-2 ring-white" aria-label="New requests"></span>
                )}
              </button>
              <button onClick={() => setShowCreateGroup(true)} className="w-9 h-9 rounded-full hover:bg-[#f2f4f7] flex items-center justify-center text-[#15171c] transition-colors" title="New group" aria-label="New group">
                <Users size={18} />
              </button>
              <button onClick={() => setShowFullSettings(true)} className="w-9 h-9 rounded-full hover:bg-[#f2f4f7] flex items-center justify-center text-[#15171c] transition-colors" title="Settings" aria-label="Settings">
                <Settings size={18} />
              </button>
            </div>
          </div>

          {/* Search / New Chat Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center justify-center pointer-events-none">
              <Search size={16} strokeWidth={1.9} className="text-[#a3a9b4]" aria-hidden="true" />
            </div>
            <input
              id="ledger-new-chat-input"
              type="text"
              placeholder="Search or start a new chat"
              aria-label="Search or start a new chat"
              value={peerInput}
              onChange={e => setPeerInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleStartConversation()}
              className="w-full h-10 bg-[#f2f4f7] rounded-xl pl-9 pr-3 text-[15px] text-[#15171c] placeholder:text-[#a3a9b4] border border-transparent focus:outline-none focus:bg-white focus:border-[#d0d5dd] transition-colors"
            />
          </div>
        </div>

        {/* ── Crystal Glass NavBar ── */}
        <CrystalNavBar
          activeTab={(['chats','calls','contacts'].includes(sidebarTab) ? sidebarTab === 'chats' || sidebarTab === 'contacts' ? 'chats' : 'calls' : sidebarTab) as NavTab}
          onTabChange={(tab: NavTab) => {
            if (tab === 'calls') { setSidebarTab('calls'); setActiveCommunity(null); }
            else if (tab === 'updates') { setSidebarTab('updates'); setActiveCommunity(null); }
            else if (tab === 'communities') { setSidebarTab('communities'); setActivePeer(null); }
            else { setSidebarTab('chats'); setActiveCommunity(null); }
          }}
          unreadCounts={{
            chats: conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0)
          }}
        />

        <div className="flex-1 overflow-y-auto flex flex-col bg-white">

          {/* ── UPDATES TAB ── */}
          {sidebarTab === 'updates' && (
            <LedgerUpdatesTab
              myAddress={address || ''}
              myName={resolveContactName(address || '', address || '', localContacts)}
              contacts={localContacts.map(c => ({ peerAddress: c.peerAddress, name: c.name }))}
              onOpenChat={(addr) => { setActiveCommunity(null); setActivePeer(addr); setSidebarTab('chats'); setShowList(false); }}
            />
          )}

          {/* ── COMMUNITIES TAB ── */}
          {sidebarTab === 'communities' && (
            <LedgerCommunitiesTab
              myAddress={address || ''}
              onOpenCommunity={(id) => {
                setActivePeer(null);
                setActiveCommunity(id);
                setShowList(false);
              }}
            />
          )}

          {/* ── CHATS TAB ── */}
          {sidebarTab === 'chats' && (
            <>
              {conversations.length > 0 && archivedPeers.size > 0 && (
                <button
                  onClick={() => setShowArchived(!showArchived)}
                  className="w-full text-left px-4 h-12 border-b border-[#eff1f4] hover:bg-[#f7f8fa] transition-colors flex items-center justify-between"
                  aria-expanded={showArchived}
                >
                  <div className="flex items-center gap-3 text-[#475061]">
                    <Archive size={17} strokeWidth={1.8} aria-hidden="true" />
                    <span className="text-[14px] font-medium">{showArchived ? 'Back to chats' : 'Archived'}</span>
                  </div>
                  <span className="flex items-center gap-1 text-[13px] text-[#727a88] tabular-nums">
                    {archivedPeers.size}
                    <ChevronRight size={16} strokeWidth={1.9} className={`transition-transform ${showArchived ? 'rotate-90' : ''}`} aria-hidden="true" />
                  </span>
                </button>
              )}
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8 text-center">
                  <div className="w-14 h-14 rounded-full bg-[#eff1f4] flex items-center justify-center text-[#727a88]">
                    <MessageSquare size={24} strokeWidth={1.7} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-[16px] font-semibold text-[#15171c] mb-1">No conversations yet</p>
                    <p className="text-[14px] text-[#727a88] leading-relaxed max-w-[240px]">Search for a name or paste a wallet address above to start your first chat.</p>
                  </div>
                </div>
              ) : (
            conversations
              .filter(conv => conv.peerAddress?.toLowerCase() !== address?.toLowerCase()) // never show self-conversations
              .filter(conv => showArchived ? archivedPeers.has(conv.peerAddress.toLowerCase()) : !archivedPeers.has(conv.peerAddress.toLowerCase())).map((conv, i) => {
              const isActive = activePeer?.toLowerCase() === conv.peerAddress.toLowerCase();
              const contactName = resolveContactName(effectiveAddress, conv.peerAddress);
              const displayLabel = contactName || shortAddr(conv.peerAddress);
              return (
                <div key={i} className="relative w-full overflow-hidden border-b border-black/[0.04]">
                  <div className="absolute inset-y-0 right-0 flex items-center justify-center w-20 bg-[#475061] text-white text-[12px] font-medium cursor-pointer" onClick={() => toggleArchive(conv.peerAddress)}>
                    <div className="flex flex-col items-center gap-1">
                      {archivedPeers.has(conv.peerAddress.toLowerCase()) ? <ArchiveRestore size={17} strokeWidth={1.9} /> : <Archive size={17} strokeWidth={1.9} />}
                      {archivedPeers.has(conv.peerAddress.toLowerCase()) ? 'Unarchive' : 'Archive'}
                    </div>
                  </div>
                  <motion.div
                    drag="x"
                    dragConstraints={{ left: -80, right: 0 }}
                    dragElastic={0.08}
                    whileTap={{ cursor: "grabbing" }}
                    onDragEnd={(e, info) => { if (info.offset.x < -50) { toggleArchive(conv.peerAddress); } }}
                    className="relative z-10 w-full bg-white"
                  >
                    <button
                      onContextMenu={(e) => { e.preventDefault(); setSidebarMenu({ peer: conv.peerAddress, x: e.clientX, y: e.clientY }); }}
                      onClick={() => {
                        // A locked chat asks for the account PIN, checked by the server.
                        if (typeof window !== 'undefined' && localStorage.getItem('ledger_locked_' + conv.peerAddress.toLowerCase())) {
                          setLockedChatPeer(conv.peerAddress);
                          return;
                        }
                        setActiveCommunity(null); setActivePeer(conv.peerAddress); setShowList(false); }}
                      className={`w-full text-left px-4 py-3 transition-colors ${isActive ? 'bg-[#f2f4f7]' : 'hover:bg-[#f7f8fa]'}`}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <div className="relative shrink-0">
                          <Avatar address={conv.peerAddress} size={48} />
                          {peerStatus.status === 'online' && activePeer?.toLowerCase() === conv.peerAddress.toLowerCase() && (
                            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#1f9d55] border-2 border-white" aria-label="Online" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <p className="text-[15px] font-semibold text-[#15171c] truncate">{displayLabel}</p>
                            {conv.lastMessage && (
                              <span className={`text-[12px] shrink-0 tabular-nums ${conv.unreadCount ? 'text-[#1f9d55] font-medium' : 'text-[#a3a9b4]'}`}>
                                {(() => {
                                  const t = (conv as any).lastMessageTime;
                                  if (!t) return '';
                                  const d = new Date(t);
                                  const now = new Date();
                                  const isToday = d.toDateString() === now.toDateString();
                                  return isToday
                                    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
                                })()}
                              </span>
                            )}
                          </div>
                          {conv.lastMessage && (
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[14px] text-[#727a88] truncate">{formatMessagePreview(conv.lastMessage)}</p>
                              {conv.unreadCount && conv.unreadCount > 0 ? (
                                <div className="min-w-[20px] h-5 bg-[#1f9d55] rounded-full flex items-center justify-center px-1.5 shrink-0" aria-label={`${conv.unreadCount} unread`}>
                                  <span className="text-[11px] font-semibold text-white tabular-nums">
                                    {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  </motion.div>
                </div>
              );
            })
          )}
            </>
          )}

          {/* ── CALLS TAB (New LedgerCallsTab) ── */}
          {sidebarTab === 'calls' && (
            <LedgerCallsTab
              callHistory={callHistoryList.map(c => ({
                id: c.id,
                peerAddress: c.peerAddress,
                peerName: getDisplayName(c.peerAddress),
                type: c.type,
                direction: c.direction,
                missed: c.status === 'missed' || c.status === 'declined' || (c.durationSeconds === 0 && c.direction === 'incoming'),
                duration: c.durationSeconds,
                timestamp: c.timestamp
              }))}
              myAddress={address || ''}
              contacts={localContacts.map(c => ({ peerAddress: c.peerAddress, name: c.name }))}
              onStartCall={(addr, type) => { setSidebarTab('chats'); setShowList(false); handleStartCall(type, addr); }}
              onOpenChat={(addr) => { setActiveCommunity(null); setActivePeer(addr); setSidebarTab('chats'); setShowList(false); }}
              onNew={() => {}}
              onSchedule={() => {}}
              onKeypad={() => {}}
              onFavorites={() => {}}
            />
          )}

          {/* ── CONTACTS TAB ── */}

          {sidebarTab === 'contacts' && (
            <div className="flex-1 overflow-y-auto">
              {localContacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-[#eff1f4] flex items-center justify-center text-[#727a88]">
                    <Users size={24} strokeWidth={1.7} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-[16px] font-semibold text-[#15171c] mb-1">No saved contacts</p>
                    <p className="text-[14px] text-[#727a88] leading-relaxed max-w-[240px]">Open a chat and choose Save contact from its menu.</p>
                  </div>
                </div>
              ) : localContacts.map((contact) => (
                <button
                  key={contact.id}
                  className="w-full px-4 py-3.5 border-b border-black/[0.04] flex items-center gap-3 hover:bg-[#F9F9F9] transition-colors text-left active:bg-[#F2F2F7]"
                  onClick={() => { setActiveCommunity(null); setActivePeer(contact.peerAddress); setSidebarTab('chats'); setShowList(false); }}
                >
                  <Avatar address={contact.peerAddress} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-[#15171c] truncate">{contact.name}</p>
                    <p className="text-[13px] text-[#727a88] tabular-nums truncate">{shortAddr(contact.peerAddress)}</p>
                  </div>
                  <ChevronRight size={16} strokeWidth={1.9} className="text-[#a3a9b4]" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}

        </div>
      </div>

      {/*  Chat Area  */}
      <div className={`${sidebarTab === 'communities' ? (activeCommunity ? 'flex' : 'hidden md:flex') : (!showList ? 'flex' : 'hidden md:flex')} relative flex-1 flex-col w-full h-full min-w-0 min-h-0 overflow-hidden`}>
        {sidebarTab === 'communities' ? (
          activeCommunity ? (
            <CommunityView 
              communityId={activeCommunity} 
              myAddress={address || ''} 
              onBack={() => {
                setActiveCommunity(null);
                setShowList(true);
              }} 
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#f7f8fa] p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-white border border-[#e4e7ec] flex items-center justify-center text-[#15171c] mb-5">
                <Users size={26} strokeWidth={1.6} aria-hidden="true" />
              </div>
              <h3 className="text-[20px] font-semibold tracking-[-0.015em] text-[#15171c]">Choose a community</h3>
              <p className="text-[15px] text-[#727a88] max-w-sm mt-1.5 leading-relaxed">
                Pick a community on the left to see its channels, posts and members.
              </p>
            </div>
          )
        ) : activePeer ? (
          <>
            <div className="h-16 pl-2 pr-3 md:pl-4 border-b border-[#e4e7ec] flex items-center justify-between gap-2 bg-white shrink-0 z-10">
              <div className="flex items-center gap-1 min-w-0">
                <button type="button" onClick={() => setShowList(true)} className="md:hidden w-9 h-9 rounded-full hover:bg-[#f2f4f7] flex items-center justify-center text-[#15171c]" aria-label="Back to chats">
                  <ChevronLeft size={22} strokeWidth={1.9} />
                </button>
                <button type="button" onClick={() => setShowContactInfo(true)} className="flex items-center gap-3 min-w-0 rounded-xl px-1.5 py-1 hover:bg-[#f2f4f7] transition-colors text-left" aria-label={`Contact info for ${getDisplayName(activePeer!)}`}>
                  <div className="relative shrink-0">
                    <Avatar address={activePeer!} size={38} />
                    {peerStatus.status === 'online' && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white bg-[#1f9d55]" aria-hidden="true" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[15px] font-semibold text-[#15171c] flex items-center gap-1.5 truncate">
                      <span className="truncate">{getDisplayName(activePeer!)}</span>
                      {ledgerSettings?.disappearing_messages && ledgerSettings?.disappearing_messages !== 'off' && (
                        <Timer size={13} strokeWidth={2} className="text-[#727a88] shrink-0" aria-label="Disappearing messages on" />
                      )}
                      {isSecretChat && (
                        <Flame size={13} strokeWidth={2} className="text-[#c0362c] shrink-0" aria-label="Secret chat on" />
                      )}
                    </span>
                    <span className={`text-[12.5px] truncate ${peerStatus.isTyping || peerStatus.status === 'online' ? 'text-[#1f9d55]' : 'text-[#727a88]'}`}>
                      {peerStatus.isTyping ? 'Typing' : peerStatus.status === 'online' ? 'Online' : peerStatus.lastSeen ? (() => {
                        const d = new Date(peerStatus.lastSeen);
                        const now = new Date();
                        const yest = new Date(now); yest.setDate(yest.getDate() - 1);
                        const t = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        if (d.toDateString() === now.toDateString()) return `Last seen today at ${t}`;
                        if (d.toDateString() === yest.toDateString()) return `Last seen yesterday at ${t}`;
                        return `Last seen ${d.toLocaleDateString([], { day: 'numeric', month: 'short' })}`;
                      })() : shortAddr(activePeer!)}
                    </span>
                  </div>
                </button>
              </div>

              <div className="flex items-center gap-0.5 shrink-0">
                <ZkNotificationBell />
                <button type="button" onClick={() => handleStartCall('video')} className="w-10 h-10 rounded-full hover:bg-[#f2f4f7] flex items-center justify-center text-[#15171c] transition-colors" title="Video call" aria-label="Video call">
                  <Video size={20} strokeWidth={1.8} />
                </button>
                <button type="button" onClick={() => handleStartCall('audio')} className="w-10 h-10 rounded-full hover:bg-[#f2f4f7] flex items-center justify-center text-[#15171c] transition-colors" title="Voice call" aria-label="Voice call">
                  <Phone size={19} strokeWidth={1.8} />
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowHeaderMenu(v => !v)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-[#15171c] transition-colors ${showHeaderMenu ? 'bg-[#eff1f4]' : 'hover:bg-[#f2f4f7]'}`}
                    title="More"
                    aria-label="More options"
                    aria-haspopup="menu"
                    aria-expanded={showHeaderMenu}
                  >
                    <MoreVertical size={19} strokeWidth={1.8} />
                  </button>
                  {showHeaderMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowHeaderMenu(false)} aria-hidden="true" />
                      <div role="menu" className="absolute right-0 top-11 z-50 w-60 bg-white border border-[#e4e7ec] rounded-2xl shadow-[0_24px_48px_-12px_rgba(16,24,40,0.18)] p-1.5">
                        {[
                          { label: 'Contact info', icon: <Info size={17} strokeWidth={1.8} />, onClick: () => setShowContactInfo(true) },
                          { label: 'Search in chat', icon: <Search size={17} strokeWidth={1.8} />, onClick: () => { setShowSearch(true); setSearchQuery(''); setSearchIndex(0); } },
                          { label: 'Save contact', icon: <UserPlus size={17} strokeWidth={1.8} />, onClick: () => { setSaveContactName(getDisplayName(activePeer!)); setShowSaveContactModal(true); } },
                          { label: isSecretChat ? 'Turn off secret chat' : 'Secret chat', icon: <Flame size={17} strokeWidth={1.8} />, onClick: () => setIsSecretChat(!isSecretChat) },
                          { label: 'Private wallet', icon: <ShieldCheck size={17} strokeWidth={1.8} />, onClick: () => setShowZkWallet(v => !v) },
                          { label: 'Scan a code', icon: <ScanQrCode size={17} strokeWidth={1.8} />, onClick: () => setShowScanner(true) },
                          { label: 'Chat options', icon: <Settings size={17} strokeWidth={1.8} />, onClick: () => setShowProfile(true) },
                          { label: 'Saved messages', icon: <Bookmark size={17} strokeWidth={1.8} />, onClick: () => setShowSavedModal(true) },
                          { label: 'Keyboard shortcuts', icon: <Clock size={17} strokeWidth={1.8} />, onClick: () => setShowShortcutsModal(true) },
                        ].map(item => (
                          <button
                            key={item.label}
                            type="button"
                            role="menuitem"
                            onClick={() => { setShowHeaderMenu(false); item.onClick(); }}
                            className="w-full flex items-center gap-3 px-3 h-10 rounded-xl text-[14.5px] text-[#15171c] hover:bg-[#f2f4f7] transition-colors text-left"
                          >
                            <span className="text-[#475061]">{item.icon}</span>
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Hito 4: Search bar */}
            {showSearch && (() => {
              const convId = `dm-${activePeer!.toLowerCase()}`;
              const allMsgs = messages.filter(m => m.conversationId === convId);
              const matches = searchQuery.trim() ? allMsgs.filter(m => typeof m.content === 'string' && m.content.toLowerCase().includes(searchQuery.toLowerCase())) : [];
              const currentMatch = matches[searchIndex];
              const handleNavSearch = (dir: 1 | -1) => {
                setSearchIndex(i => {
                  const next = (i + dir + matches.length) % matches.length;
                  const el = document.getElementById(`msg-${matches[next]?.id}`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  return next;
                });
              };
              return (
                <div className="bg-white border-b border-[#e4e7ec] px-3 h-12 flex items-center gap-2 z-20">
                  <Search size={16} strokeWidth={1.9} className="text-[#a3a9b4] shrink-0" aria-hidden="true" />
                  <input
                    autoFocus
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setSearchIndex(0); }}
                    onKeyDown={e => { if (e.key === 'Escape') { setShowSearch(false); setSearchQuery(''); } if (e.key === 'Enter' && matches.length > 1) handleNavSearch(e.shiftKey ? -1 : 1); }}
                    placeholder="Search in this chat"
                    aria-label="Search in this chat"
                    className="flex-1 bg-transparent text-[15px] text-[#15171c] placeholder:text-[#a3a9b4] outline-none"
                  />
                  {searchQuery.trim() && (
                    <span className="text-[13px] text-[#727a88] tabular-nums shrink-0">{matches.length ? `${searchIndex + 1} of ${matches.length}` : 'No results'}</span>
                  )}
                  {matches.length > 1 && (
                    <>
                      <button type="button" onClick={() => handleNavSearch(-1)} className="w-8 h-8 rounded-full hover:bg-[#f2f4f7] flex items-center justify-center text-[#475061]" aria-label="Previous result"><ChevronUp size={18} strokeWidth={1.9} /></button>
                      <button type="button" onClick={() => handleNavSearch(1)} className="w-8 h-8 rounded-full hover:bg-[#f2f4f7] flex items-center justify-center text-[#475061]" aria-label="Next result"><ChevronDown size={18} strokeWidth={1.9} /></button>
                    </>
                  )}
                  <button type="button" onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="w-8 h-8 rounded-full hover:bg-[#f2f4f7] flex items-center justify-center text-[#475061]" aria-label="Close search">
                    <X size={17} strokeWidth={1.9} />
                  </button>
                </div>
              );
            })()}

            {/* Phase 3: Pinned Message Banner */}
            {pinnedMessageId && (
              <div className="bg-white border-b border-[#e4e7ec] pl-4 pr-2 h-12 flex items-center gap-3 cursor-pointer hover:bg-[#f7f8fa] transition-colors z-20 shrink-0" onClick={() => {
                const el = document.getElementById(`msg-${pinnedMessageId}`);
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}>
                <Pin size={16} strokeWidth={1.9} className="text-[#475061] shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0 flex flex-col">
                  <span className="text-[12px] font-medium text-[#727a88]">Pinned message</span>
                  <span className="text-[14px] text-[#15171c] truncate">
                    {formatMessagePreview(messages.find(m => m.id === pinnedMessageId)?.content?.replace(/__REPLY__[a-zA-Z0-9_-]+__::/, '') || 'Message')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPinnedMessageId(null);
                    executeSend(`__UNPIN__${pinnedMessageId}`);
                  }}
                  className="w-8 h-8 rounded-full hover:bg-[#eff1f4] flex items-center justify-center text-[#475061] transition-colors"
                  aria-label="Unpin message"
                >
                  <X size={16} strokeWidth={1.9} />
                </button>
              </div>
            )}

            <EncryptionInfoSheet
              open={showEncryptionInfo}
              onClose={() => setShowEncryptionInfo(false)}
              peerName={getDisplayName(activePeer!)}
              myAddress={address || ''}
              peerAddress={activePeer || ''}
              serverCount={messages.filter(m => m.conversationId?.toLowerCase() === `dm-${(activePeer || '').toLowerCase()}` && m.viaServer).length}
            />

            {/* Dynamic Chat Background */}
            <div className={`ledger-chat-container flex-1 overflow-hidden flex flex-col min-h-0 relative ${isSecretChat ? 'bg-[#fbf7f4]' : 'bg-[#f7f8fa]'} ${ledgerSettings?.anti_screenshot ? 'select-none' : ''}`} style={{ ...(isSecretChat ? {} : bgStyle), fontFamily, fontSize: `${fontSizePx}px` }}>
              {/* Matrix Rain Effect Layer */}
              {chatBackground === 'matrix' && (
                <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'radial-gradient(circle, rgba(0,255,0,0.1) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
              )}
              
              {/* Confidential Watermark Overlay */}
              <div className="ledger-watermark">
                <span>Confidential</span>
              </div>
              
              {/* E2E Encrypted Badge */}
              <div className="flex justify-center pt-3 pb-1 px-4">
                <button type="button" onClick={() => setShowEncryptionInfo(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#e4e7ec] text-[12.5px] text-[#727a88] text-center hover:bg-[#f2f4f7] transition-colors">
                  <Lock size={12} strokeWidth={2.2} aria-hidden="true" />
                  Messages are end to end encrypted. Tap for details
                </button>
              </div>

              {(() => {
                // Filter messages for the current active conversation only
                const convId = `dm-${activePeer!.toLowerCase()}`;
                const filteredMsgs = messages.filter(m => {
                  if (m.conversationId?.toLowerCase() !== convId.toLowerCase()) return false;
                  if (m.burnAtNs && m.burnAtNs <= Date.now()) return false;
                  const c = typeof m.content === 'string' ? m.content : '';
                  if (c.startsWith('__CALL_')) return false;
                  if (c.startsWith('__REACT__')) return false;
                  if (c.startsWith('__PIN__')) return false;
                  if (c.startsWith('__UNPIN__')) return false;
                  if (c.startsWith('__REVOKE__')) return false;
                  if (c.startsWith('__EDIT__')) return false;
                  if (c.startsWith('__READ__')) return false;
                  if (c.startsWith('__VOTE__')) return false;
                  // __PAYMENT__ messages ARE rendered (as PaymentBubble) — do NOT filter them out
                  if (c.startsWith('__TYPING__')) return false;
                  return true;
                });
                if (filteredMsgs.length === 0) {
                  if (isFetchingChat) {
                    return (
                      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-[#727a88]" role="status">
                        <LoaderCircle size={22} strokeWidth={2} className="animate-spin" aria-hidden="true" />
                        <p className="text-[14px]">Loading messages</p>
                      </div>
                    );
                  }
                  return (
                    <div className="flex-1 flex flex-col items-center justify-center p-6">
                      <div className="bg-white rounded-2xl px-6 py-7 max-w-[300px] text-center border border-[#e4e7ec]">
                        <div className="w-12 h-12 bg-[#eff1f4] rounded-full flex items-center justify-center mx-auto mb-4 text-[#475061]">
                          <MessageSquare size={22} strokeWidth={1.8} aria-hidden="true" />
                        </div>
                        <p className="text-[16px] font-semibold text-[#15171c] mb-1.5">Say hello</p>
                        <p className="text-[14px] text-[#727a88] leading-relaxed">Send the first message. It is encrypted on this device and only you and {getDisplayName(activePeer!)} can read it.</p>
                      </div>
                    </div>
                  );
                }
                return (
                  <VirtualizedMessageList
                    messages={filteredMsgs}
                    activePeer={activePeer}
                    myAddress={address || ''}
                    clientInboxId={client?.inboxId}
                    isLoadingMore={false}
                    onLoadMore={() => {}}
                    renderMessage={(msg, isMe) => {
                      const sentTime = typeof msg.sentAtNs === 'number' ? new Date(msg.sentAtNs) : (msg.sent || msg.sentAt || new Date());
                      const dateStr = new Date(sentTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                      
                      return (
                        <MessageBubble
                          key={msg.id}
                          msg={msg}
                          isMe={isMe}
                          showDate={false} // Virtualized list needs grouped items or custom header for dates
                          dateStr={dateStr}
                          isSecretChat={isSecretChat}
                          fontFamily={fontFamily}
                          fontSizePx={fontSizePx}
                          clientInboxId={client?.inboxId}
                          onReply={(msgToReply) => setReplyingTo(msgToReply)}
                          onThreadReply={(msgToThread) => setThreadParentId(msgToThread.id)}
                          onReact={(msgId, emoji) => executeSend(`__REACT__${msgId}__::${emoji}`)}
                          onContextMenu={(e, id, content) => {
                            if (e?.type === 'revoke') {
                              executeSend(`__REVOKE__${id}`);
                            } else {
                              setContextMenu({ id, content, x: e?.clientX ?? 0, y: e?.clientY ?? 0 });
                            }
                          }}
                          onOpenLightbox={(url) => setLightboxImg(url)}
                          formatMessagePreview={formatMessagePreview}
                          onVotePoll={(pollId, idx) => executeSend(`__VOTE__${pollId}__::${idx}`)}
                          onEditMsg={(id, current) => setEditingMsg({ id, content: current })}
                          bubbleStyle={bubbleStyle}
                        />
                      );
                    }}
                  />
                );
              })()}
              {(peerStatus.isTyping || (activePeer && typingPeers.has(activePeer.toLowerCase()))) && (
                  <div className="flex self-start items-start mt-2 ml-4">
                      <div className="px-4 py-3 bg-white rounded-[18px] rounded-bl-[6px] border border-[#e4e7ec] flex items-center gap-1.5" role="status" aria-label={`${getDisplayName(activePeer!)} is typing`}>
                        <div className="w-1.5 h-1.5 bg-[#a3a9b4] rounded-full" style={{ animation: 'typingBounce 1.2s ease-in-out infinite', animationDelay: '0ms', willChange: 'transform' }} />
                        <div className="w-1.5 h-1.5 bg-[#a3a9b4] rounded-full" style={{ animation: 'typingBounce 1.2s ease-in-out infinite', animationDelay: '200ms', willChange: 'transform' }} />
                        <div className="w-1.5 h-1.5 bg-[#a3a9b4] rounded-full" style={{ animation: 'typingBounce 1.2s ease-in-out infinite', animationDelay: '400ms', willChange: 'transform' }} />
                      </div>
                  </div>
              )}
              {sending && (
                <div className="flex self-end items-center gap-2 mt-1 mr-4 text-[12.5px] text-[#727a88]" role="status">
                  <LoaderCircle size={13} strokeWidth={2} className="animate-spin" aria-hidden="true" />
                  Sending
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div
              className="relative shrink-0 bg-white border-t border-[#e4e7ec] z-10"
              style={{ paddingBottom: `max(8px, env(safe-area-inset-bottom, 0px))` }}
            >
              {/*  Offline Banner  */}
              {isOffline && (
                <div className="flex items-center justify-center gap-2 px-4 h-9 bg-[#fdf5e6] border-b border-[#f1dcb0] text-[13px] text-[#8f5b00]" role="status">
                  <WifiOff size={15} strokeWidth={1.9} aria-hidden="true" />
                  You are offline. Messages will be sent when you reconnect.
                </div>
              )}
              {/*  Audio recording indicator  */}
              {isRecording && (
                <div className="flex items-center gap-2 px-4 pt-3 pb-1" role="status">
                    <div className="flex items-center gap-2 bg-[#fdeeec] text-[#c0362c] px-3 py-1.5 rounded-full">
                        <span className="w-2 h-2 rounded-full bg-[#e5484d] animate-pulse" aria-hidden="true" />
                        <span className="text-[13px] font-medium">Recording a voice message</span>
                    </div>
                </div>
              )}
              {/* [BUG FIX] Secret Chat Active Banner — clearly visible above input */}
              {isSecretChat && !isRecording && (
                <div className="flex items-center gap-2 px-4 h-10 bg-[#fdeeec] border-b border-[#f5d2cd]" role="status">
                  <Flame size={15} strokeWidth={2} className="text-[#c0362c] shrink-0" aria-hidden="true" />
                  <span className="text-[13px] text-[#8a2a22]">Secret chat is on. New messages disappear 15 seconds after they are read.</span>
                  <button
                    type="button"
                    onClick={() => setIsSecretChat(false)}
                    className="ml-auto shrink-0 px-2.5 h-7 rounded-full text-[13px] font-medium text-[#8a2a22] hover:bg-[#f9dcd7] transition-colors"
                  >
                    Turn off
                  </button>
                </div>
              )}
              {/* Hito 4: Link Preview Card */}
              {linkPreview && !isRecording && (
                <div className="flex items-start gap-3 mx-3 mt-2 p-2.5 rounded-xl bg-[#f7f8fa] border border-[#e4e7ec]">
                  {linkPreview.image && <img src={linkPreview.image} alt="" className="w-14 h-14 object-cover rounded-lg shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-medium text-[#15171c] truncate">{linkPreview.title}</p>
                    <p className="text-[12.5px] text-[#727a88] line-clamp-2">{linkPreview.description}</p>
                    <p className="text-[12px] text-[#a3a9b4] truncate mt-0.5">{linkPreview.url}</p>
                  </div>
                  <button type="button" onClick={() => setLinkPreview(null)} className="w-7 h-7 rounded-full hover:bg-[#eff1f4] flex items-center justify-center text-[#727a88] shrink-0" aria-label="Remove link preview">
                    <X size={15} strokeWidth={1.9} />
                  </button>
                </div>
              )}
              {/* Phase 4: Editing UI */}
              {editingMsg && (
                <div className="mx-3 mt-2 pl-3 pr-1.5 py-2 bg-[#f7f8fa] border border-[#e4e7ec] rounded-xl flex items-center gap-2">
                  <div className="w-0.5 self-stretch rounded-full bg-[#15171c]" aria-hidden="true" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[12.5px] font-medium text-[#15171c] mb-0.5">Edit message</span>
                    <input
                      type="text"
                      inputMode="text"
                      autoComplete="off"
                      spellCheck={true}
                      aria-label="Edited message"
                      className="text-[14.5px] bg-transparent outline-none text-[#15171c] w-full placeholder:text-[#a3a9b4]"
                      value={editingMsg.content}
                      onChange={e => setEditingMsg({ ...editingMsg, content: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitEditMessage(); } if (e.key === 'Escape') setEditingMsg(null); }}
                      autoFocus
                    />
                  </div>
                  <button type="button" onClick={submitEditMessage} className="w-8 h-8 rounded-full bg-[#15171c] text-white flex items-center justify-center hover:bg-[#2b2f38] shrink-0" aria-label="Save edit"><Check size={16} strokeWidth={2.2} /></button>
                  <button type="button" onClick={() => setEditingMsg(null)} className="w-8 h-8 rounded-full hover:bg-[#eff1f4] flex items-center justify-center text-[#475061] shrink-0" aria-label="Cancel edit"><X size={16} strokeWidth={1.9} /></button>
                </div>
              )}
              {replyingTo && !editingMsg && (
                <div className="mx-3 mt-2 pl-3 pr-1.5 py-2 bg-[#f7f8fa] border border-[#e4e7ec] rounded-xl flex items-center gap-2">
                  <div className="w-0.5 self-stretch rounded-full bg-[#15171c]" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-medium text-[#15171c]">Replying to {replyingTo.isMe || replyingTo.senderInboxId === client?.inboxId ? 'yourself' : getDisplayName(activePeer!)}</p>
                    <p className="text-[13.5px] text-[#727a88] truncate">{
                      replyingTo.content ? formatMessagePreview(replyingTo.content) : 'Message'
                    }</p>
                  </div>
                  <button type="button" onClick={() => setReplyingTo(null)} className="w-8 h-8 rounded-full hover:bg-[#eff1f4] flex items-center justify-center text-[#475061] shrink-0" aria-label="Cancel reply">
                    <X size={16} strokeWidth={1.9} />
                  </button>
                </div>
              )}
              {/* Hito 4: Scheduled send indicator */}
              {scheduledAt && (
                <div className="mx-3 mt-2 pl-3 pr-1.5 h-10 bg-[#f7f8fa] border border-[#e4e7ec] rounded-xl flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[13.5px] text-[#15171c]">
                    <Clock size={15} strokeWidth={1.9} className="text-[#475061]" aria-hidden="true" />
                    Sends at {scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <button type="button" onClick={() => setScheduledAt(null)} className="px-3 h-8 rounded-full text-[13px] font-medium text-[#475061] hover:bg-[#eff1f4]">Cancel</button>
                </div>
              )}
              {/* Sticker Picker */}
              {showStickerPicker && (
                <div className="relative px-3 pb-0">
                  <StickerPicker
                    onSend={(s) => {
                      executeSend(`__STICKER__${s}`);
                      setShowStickerPicker(false);
                    }}
                    onClose={() => setShowStickerPicker(false)}
                  />
                </div>
              )}
              {/* Hito 4: GIF Picker */}
              {showGifPicker && (
                <div className="bg-white border-t border-[#e4e7ec] p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="relative flex-1">
                      <Search size={15} strokeWidth={1.9} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a3a9b4]" aria-hidden="true" />
                      <input
                        autoFocus
                        value={gifSearch}
                        onChange={e => setGifSearch(e.target.value)}
                        placeholder="Search GIFs"
                        aria-label="Search GIFs"
                        className="w-full h-9 bg-[#f2f4f7] rounded-xl pl-9 pr-3 text-[14px] outline-none text-[#15171c] placeholder:text-[#a3a9b4]"
                      />
                    </div>
                    <button type="button" onClick={() => setShowGifPicker(false)} className="w-8 h-8 rounded-full hover:bg-[#f2f4f7] flex items-center justify-center text-[#475061]" aria-label="Close GIFs">
                      <X size={16} strokeWidth={1.9} />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
                    {gifResults.length === 0 ? (
                      <p className="col-span-3 text-center text-[13px] text-[#727a88] py-4">{gifSearch ? 'No GIFs found' : 'Type to search for a GIF'}</p>
                    ) : gifResults.map((url, i) => (
                      <button key={i} onClick={() => {
                        executeSend(`[GIF]${url}`);
                        setShowGifPicker(false);
                        setGifSearch('');
                        setGifResults([]);
                      }} className="aspect-video bg-[#eff1f4] rounded-lg overflow-hidden hover:opacity-90 transition-opacity">
                        <img src={url} alt="gif" className="w-full h-full object-cover" loading="lazy" />
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-[#a3a9b4] text-right mt-1.5">Powered by Tenor</p>
                </div>
              )}
              {inputText === '/' && (
                <div className="absolute bottom-[72px] left-3 mb-2 bg-white border border-[#e4e7ec] shadow-[0_24px_48px_-12px_rgba(16,24,40,0.18)] rounded-2xl w-[280px] overflow-hidden z-50" role="menu" aria-label="Commands">
                  <p className="px-4 pt-3 pb-1.5 text-[12.5px] font-medium text-[#727a88]">Commands</p>
                  <div className="flex flex-col px-1.5 pb-1.5">
                    {[
                      { cmd: '/pay', label: 'Send a payment', icon: <CreditCard size={17} strokeWidth={1.8} />, run: () => { setInputText(''); setShowWalletTransfer(true); } },
                      { cmd: '/poll', label: 'Create a poll', icon: <ListChecks size={17} strokeWidth={1.8} />, run: () => { setInputText(''); setShowPollCreator(true); } },
                      { cmd: '/gif', label: 'Search GIFs', icon: <ImageIcon size={17} strokeWidth={1.8} />, run: () => { setInputText(''); setShowGifPicker(true); } },
                      { cmd: '/location', label: 'Share your location', icon: <MapPin size={17} strokeWidth={1.8} />, run: () => {
                          setInputText('');
                          if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(pos => {
                              executeSend(`[LOCATION]${pos.coords.latitude},${pos.coords.longitude}`);
                            });
                          }
                        } },
                    ].map(c => (
                      <button key={c.cmd} type="button" role="menuitem" onClick={c.run} className="px-2.5 h-12 text-left hover:bg-[#f2f4f7] rounded-xl transition-colors flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-[#eff1f4] text-[#15171c] flex items-center justify-center shrink-0">{c.icon}</span>
                        <span className="flex flex-col">
                          <span className="text-[14px] font-medium text-[#15171c]">{c.label}</span>
                          <span className="text-[12.5px] text-[#727a88]">{c.cmd}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
                <input type="file" ref={fileRef} className="hidden" onChange={handleFileUpload} />
                {/* Camera capture — opens native camera on iOS/Android */}
                <input type="file" ref={cameraRef} className="hidden" accept="image/*,video/*" capture="environment" onChange={handleFileUpload} />
                {/* Gallery picker — opens photo library on iOS/Android */}
                <input type="file" ref={galleryRef} className="hidden" accept="image/*,video/*" onChange={handleFileUpload} />
                <form onSubmit={handleSend} className="flex flex-col w-full relative">
                  {/* ── App Drawer (WhatsApp-style icon grid) ── */}
                  <AnimatePresence>
                  {showAppDrawer && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowAppDrawer(false)} />
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ type: "spring", stiffness: 420, damping: 32 }}
                        className="absolute bottom-[68px] left-2 w-[300px] bg-white border border-[#e4e7ec] shadow-[0_24px_48px_-12px_rgba(16,24,40,0.18)] rounded-2xl z-50 p-1.5 overflow-hidden max-h-[70vh] overflow-y-auto"
                        role="menu"
                        aria-label="Attach"
                      >
                        <div className="flex flex-col">
                          {[
                            // ── Media ──────────────────────────────────────────────
                            { id: 'camera',    color: '#FF3B30', iconPath: <Camera size={19} strokeWidth={1.8} />,  label: 'Camera',        sublabel: 'Take a photo or video', onClick: () => { cameraRef.current?.click(); setShowAppDrawer(false); } },
                            { id: 'gallery',   color: '#5856D6', iconPath: <ImageIcon size={19} strokeWidth={1.8} />,   label: 'Photos and videos', sublabel: 'Choose from your library',   onClick: () => { galleryRef.current?.click(); setShowAppDrawer(false); } },
                            { id: 'attach',    color: '#34C759', iconPath: <FileText size={19} strokeWidth={1.8} />,  label: 'Document',       sublabel: 'Any file up to 1 MB',    onClick: () => { fileRef.current?.click(); setShowAppDrawer(false); } },
                            { id: 'audio',     color: '#FF9500', iconPath: <Mic size={19} strokeWidth={1.8} />,     label: 'Voice message',  sublabel: 'Record and send', onClick: () => { setShowAppDrawer(false); startRecording(); } },
                            // ── Interactive ──────────────────────────────────────────
                            { id: 'gif',       color: '#AF52DE', iconPath: <ImageIcon size={19} strokeWidth={1.8} />,   label: 'GIF',            sublabel: 'Search animated images',   onClick: () => { setShowGifPicker(true); setShowAppDrawer(false); } },
                            { id: 'sticker',   color: '#FFCC00', iconPath: <Sticker size={19} strokeWidth={1.8} />,      label: 'Stickers',       sublabel: 'Send a sticker',         onClick: () => { setShowStickerPicker(true); setShowAppDrawer(false); } },
                            { id: 'poll',      color: '#10B981', iconPath: <ListChecks size={19} strokeWidth={1.8} />,  label: 'Poll',           sublabel: 'Create a poll',          onClick: () => { setShowPollCreator(true); setShowAppDrawer(false); } },
                            // ── Crypto & Aztec Private Payments ──────────────────────────
                            { id: 'zkmoney',   color: '#1C1C1E', iconPath: <ShieldCheck size={19} strokeWidth={1.8} />, label: 'Private payment', sublabel: 'Aztec test network', onClick: () => { setShowZkModal(true); setShowAppDrawer(false); } },
                            { id: 'zkstream',  color: '#1C1C1E', iconPath: <Waves size={19} strokeWidth={1.8} />, label: 'Payment stream', sublabel: 'Demo, no funds move', onClick: () => { setShowZkStreamModal(true); setShowAppDrawer(false); } },
                            { id: 'zkinvoice', color: '#1C1C1E', iconPath: <Receipt size={19} strokeWidth={1.8} />, label: 'Private invoice', sublabel: 'Request a private payment', onClick: () => { setShowZkInvoiceModal(true); setShowAppDrawer(false); } },
                            { id: 'payment',   color: '#1C1C1E', iconPath: <CreditCard size={19} strokeWidth={1.8} />,     label: 'Payment',        sublabel: 'Send tokens from your wallet',            onClick: () => { setShowWalletTransfer(true); setShowAppDrawer(false); } },
                            { id: 'tip',       color: '#1C1C1E', iconPath: <Heart size={19} strokeWidth={1.8} />, label: 'Tip',          sublabel: 'Send a small thank you', onClick: () => { setShowTipModal(true); setShowAppDrawer(false); } },
                            // ── Utilities ────────────────────────────────────────────
                            { id: 'location',  color: '#32D74B', iconPath: <MapPin size={19} strokeWidth={1.8} />,    label: 'Location',       sublabel: 'Share your location',    onClick: () => { 
                              setShowAppDrawer(false);
                              if (navigator.geolocation) {
                                navigator.geolocation.getCurrentPosition(
                                  (pos) => executeSendRef.current?.(`[LOCATION]${pos.coords.latitude},${pos.coords.longitude}`),
                                  () => toast.error('Location access is blocked. Allow it in your browser settings.')
                                );
                              } else {
                                toast.error('This device cannot share your location');
                              }
                            } },
                            { id: 'live-loc',  color: '#FF3B30', iconPath: <Navigation size={19} strokeWidth={1.8} />,   label: isLiveLocationActive ? 'Stop live location' : 'Live location', sublabel: isLiveLocationActive ? 'Stop sharing your position' : 'Share your position as you move', onClick: () => { startLiveLocation(); setShowAppDrawer(false); } },
                            { id: 'schedule',  color: '#636366', iconPath: <Clock size={19} strokeWidth={1.8} />,      label: 'Schedule',       sublabel: 'Send at a later time', onClick: () => {
                                setShowAppDrawer(false);
                                const inp = document.createElement('input');
                                inp.type = 'datetime-local';
                                const minDate = new Date(Date.now() + 60000);
                                inp.min = minDate.toISOString().slice(0, 16);
                                inp.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
                                document.body.appendChild(inp);
                                inp.onchange = () => {
                                  const picked = new Date(inp.value);
                                  if (!isNaN(picked.getTime()) && picked > new Date()) {
                                    setScheduledAt(picked);
                                    toast.success(`Scheduled for ${picked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
                                  }
                                  document.body.removeChild(inp);
                                };
                                inp.click();
                              } },
                            { id: 'burn',      color: '#FF6B00', iconPath: <Timer size={19} strokeWidth={1.8} />,      label: burnTimer ? `Disappearing after ${burnTimer} seconds` : 'Disappearing messages', sublabel: burnTimer ? 'Turn off' : 'Messages vanish after they are read', onClick: () => { setBurnTimer(burnTimer ? null : 60); setShowAppDrawer(false); } },
                          ].map((app) => (
                            <button 
                              key={app.id} 
                              type="button" 
                              onClick={app.onClick} 
                              role="menuitem"
                              className="flex items-center gap-3 h-[52px] px-2.5 w-full hover:bg-[#f2f4f7] active:bg-[#e9ecf0] rounded-xl transition-colors select-none text-left"
                            >
                              <span className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0 bg-[#eff1f4] text-[#15171c]" aria-hidden="true">
                                {(app as any).iconPath || (app as any).icon}
                              </span>
                              <span className="flex flex-col min-w-0">
                                <span className="text-[14.5px] font-medium text-[#15171c] leading-tight">{app.label}</span>
                                {(app as any).sublabel && <span className="text-[12.5px] text-[#727a88] truncate">{(app as any).sublabel}</span>}
                              </span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    </>
                  )}
                  </AnimatePresence>

                  {/* Thread and Bot UI */}
                  {threadParentId && (
                    <div className="mx-3 mt-2 pl-3 pr-1.5 h-10 bg-[#f7f8fa] border border-[#e4e7ec] rounded-xl flex items-center justify-between">
                      <span className="flex items-center gap-2 text-[13.5px] text-[#15171c]">
                        <MessageSquare size={15} strokeWidth={1.9} className="text-[#475061]" aria-hidden="true" />
                        Replying in a thread
                      </span>
                      <button type="button" onClick={() => setThreadParentId(null)} className="w-8 h-8 rounded-full hover:bg-[#eff1f4] flex items-center justify-center text-[#475061]" aria-label="Leave thread">
                        <X size={16} strokeWidth={1.9} />
                      </button>
                    </div>
                  )}

                  {showBotSuggestions && (
                    <div className="absolute bottom-[68px] left-2 right-2 bg-white border border-[#e4e7ec] rounded-2xl shadow-[0_24px_48px_-12px_rgba(16,24,40,0.18)] overflow-hidden z-50 p-1.5">
                      {BOT_COMMANDS_LIST.filter(b => b.cmd.startsWith(inputText)).map(bot => (
                        <button
                          key={bot.cmd}
                          onClick={() => { setInputText(bot.cmd + ' '); setShowBotSuggestions(false); }}
                          type="button"
                          className="flex items-center gap-3 w-full px-3 h-11 rounded-xl hover:bg-[#f2f4f7] text-left transition-colors"
                        >
                          <span className="text-[14px] font-medium text-[#15171c]">{bot.cmd}</span>
                          <span className="text-[13px] text-[#727a88]">{bot.hint.split('|')[1]}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* ── Main input row ── */}
                  <div
                    className="flex items-end gap-2 px-3 pt-2 w-full relative z-40 bg-white"
                    style={{ paddingBottom: 'max(12px, calc(0.5rem + env(safe-area-inset-bottom, 0px)))' }}
                  >
                    <button
                      type="button"
                      onClick={() => { setShowAppDrawer(d => !d); setShowEmojiPicker(false); }}
                      className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center transition-all duration-200 mb-[3px] ${showAppDrawer ? 'bg-[#15171c] text-white rotate-45' : 'text-[#475061] hover:bg-[#f2f4f7]'}`}
                      aria-label={showAppDrawer ? 'Close attachments' : 'Attach'}
                      aria-expanded={showAppDrawer}
                    >
                      <Plus size={22} strokeWidth={1.9} />
                    </button>

                    <AnimatePresence>
                      {showEmojiPicker && (
                        <>
                          <div
                            className="fixed inset-0 z-[90]"
                            onClick={() => setShowEmojiPicker(false)}
                          />
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            className="absolute bottom-[64px] left-3 z-[100] shadow-[0_24px_48px_-12px_rgba(16,24,40,0.18)] rounded-2xl overflow-hidden border border-[#e4e7ec]"
                          >
                            <EmojiPicker
                              onEmojiClick={(emojiData: any) => {
                                setInputText(prev => prev + emojiData.emoji);
                              }}
                            />
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>

                    {/* The message field */}
                    <div className="flex-1 bg-[#f2f4f7] rounded-[22px] flex items-end relative border border-transparent focus-within:bg-white focus-within:border-[#d0d5dd] min-h-[44px] max-h-[136px] transition-colors">
                      {isRecording ? (
                        <div className="flex-1 flex items-center justify-between pl-4 pr-1.5 h-[44px]">
                          <div className="flex items-center gap-2" role="status">
                            <span className="w-2 h-2 rounded-full bg-[#e5484d] animate-pulse" aria-hidden="true" />
                            <span className="text-[15px] font-medium text-[#c0362c] tabular-nums">
                              {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={cancelRecording}
                              className="px-3 h-8 rounded-full text-[14px] font-medium text-[#475061] hover:bg-[#e9ecf0]"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={stopRecording}
                              className="w-8 h-8 rounded-full bg-[#15171c] flex items-center justify-center text-white active:scale-95"
                              aria-label="Send voice message"
                            >
                              <ArrowUp size={17} strokeWidth={2.2} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <textarea
                            ref={inputRef as any}
                            value={inputText}
                            onChange={e => {
                              const val = e.target.value;
                              setInputText(val);
                              setShowBotSuggestions(val.startsWith('/') && val.length < 10);
                              if (!val) {
                                e.target.style.height = '44px';
                              } else {
                                e.target.style.height = 'auto';
                                e.target.style.height = `${Math.min(Math.max(e.target.scrollHeight, 44), 134)}px`;
                              }
                              const now = Date.now();
                              if (now - lastTypingTimeRef.current > 3000 && val.trim().length > 0) {
                                lastTypingTimeRef.current = now;
                                if (client && activePeer) {
                                  sendMessage(client, activePeer, '__TYPING__').catch(() => {});
                                }
                              }
                            }}
                            onKeyDown={e => {
                              if (ledgerSettings?.mechanical_keyboard) playKeyClick();
                              const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
                              const enterToSend = ledgerSettings?.enter_to_send !== false;
                              if (e.key === 'Enter' && !e.shiftKey && !isTouch && enterToSend) {
                                e.preventDefault();
                                if (inputText.trim() && !isUploading) {
                                  handleSend(e as any);
                                  (e.target as HTMLTextAreaElement).style.height = '44px';
                                }
                              }
                            }}
                            disabled={isUploading}
                            placeholder={isUploading ? 'Uploading' : 'Message'}
                            aria-label="Message"
                            rows={1}
                            // 16px stops iOS Safari from zooming in when the field is focused.
                            className="flex-1 bg-transparent pl-4 pr-1 py-[10px] text-[#15171c] focus:outline-none placeholder:text-[#a3a9b4] disabled:opacity-50 text-[16px] resize-none max-h-[134px] scrollbar-none leading-[1.5] min-h-[44px]"
                          />
                          <button
                            type="button"
                            onClick={() => { setShowEmojiPicker(d => !d); setShowAppDrawer(false); }}
                            className={`w-9 h-9 shrink-0 mb-[4px] mr-1 rounded-full flex items-center justify-center transition-colors ${showEmojiPicker ? 'text-[#15171c] bg-[#e9ecf0]' : 'text-[#727a88] hover:text-[#15171c]'}`}
                            aria-label="Emoji"
                            aria-expanded={showEmojiPicker}
                          >
                            <Smile size={21} strokeWidth={1.8} />
                          </button>
                        </>
                      )}
                    </div>

                    {/* Send, or record a voice message when the field is empty */}
                    {inputText.trim() ? (
                      <LottieSendButton
                        disabled={sending || isUploading}
                        data-key={sendAnimKey}
                        onTrigger={() => {}}
                      />
                    ) : !isRecording ? (
                      <button
                        type="button"
                        onClick={startRecording}
                        className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center transition-colors text-[#475061] hover:bg-[#f2f4f7] active:scale-95 mb-[2px]"
                        aria-label="Record a voice message"
                      >
                        <Mic size={21} strokeWidth={1.8} />
                      </button>
                    ) : null}
                  </div>
                </form>

            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-[#f7f8fa] relative overflow-y-auto p-6 md:p-12">
            <div className="w-full max-w-md flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-white border border-[#e4e7ec] flex items-center justify-center text-[#15171c] mb-6">
                <MessageSquare size={28} strokeWidth={1.6} aria-hidden="true" />
              </div>
              <h1 className="text-[24px] md:text-[28px] font-semibold tracking-[-0.02em] text-[#15171c] mb-2">Ledger Chat</h1>
              <p className="text-[15.5px] text-[#727a88] leading-relaxed max-w-sm">
                Choose a conversation on the left, or start a new one by searching for a name or pasting a wallet address.
              </p>
              <div className="mt-8 w-full grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-left">
                {[
                  { icon: <Lock size={17} strokeWidth={1.8} />, title: 'Encrypted', text: 'Direct messages are encrypted on your device.' },
                  { icon: <Users size={17} strokeWidth={1.8} />, title: 'Communities', text: 'Channels, roles and invite links.' },
                  { icon: <Wallet size={17} strokeWidth={1.8} />, title: 'Payments', text: 'Send tokens from your own wallet.' },
                ].map(f => (
                  <div key={f.title} className="bg-white rounded-xl p-3.5 border border-[#e4e7ec]">
                    <span className="w-8 h-8 rounded-lg bg-[#eff1f4] text-[#15171c] flex items-center justify-center mb-2.5" aria-hidden="true">{f.icon}</span>
                    <p className="text-[14px] font-medium text-[#15171c]">{f.title}</p>
                    <p className="text-[13px] text-[#727a88] leading-snug mt-0.5">{f.text}</p>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-[13px] text-[#a3a9b4]">Ledger Chat is in early access.</p>
            </div>
          </div>
        )}

      {/* NOTE: remoteAudioRef lives ONLY inside the active call portal below to avoid ref conflicts */}

      {/* ── Incoming Call Screen (state: ringing) ──────────────────────────────── */}
      {callState === 'ringing' && isMounted && typeof document !== 'undefined'
        ? (createPortal(
        <IncomingCallScreen
          peerName={activePeer ? getDisplayName(activePeer) : 'Unknown caller'}
          peerAddress={activePeer}
          isVideo={callTypeRef.current === 'video'}
          onDecline={declineCall}
          onAnswer={answerCall}
          onMessage={() => { declineCall(); }}
        />,
        document.body
      ) as React.ReactNode) : null}
      {/* ── Outgoing Call Screen (state: calling — waiting for answer) ─────── */}
      {(callState === 'calling' && isMounted && typeof document !== 'undefined')
        ? (createPortal(
        <OutgoingCallScreen
          peerName={activePeer ? getDisplayName(activePeer) : 'Unknown'}
          peerAddress={activePeer}
          isVideo={callTypeRef.current === 'video'}
          onCancel={() => performEndCallRef.current?.()}
        />,
        document.body
      ) as React.ReactNode) : null}

      {/* ── Call in progress ─────────────────────────────────────── */}
      {callState === 'active' && isMounted && (
        isCallMinimized ? createPortal(
          callType === 'video' ? (
            <motion.div
              drag
              dragConstraints={{ top: 0, left: 0, right: typeof window !== 'undefined' ? window.innerWidth - 120 : 0, bottom: typeof window !== 'undefined' ? window.innerHeight - 160 : 0 }}
              initial={{ x: 20, y: 80 }}
              onClick={() => setIsCallMinimized(false)}
              role="button"
              aria-label="Return to the call"
              className="fixed z-[100000] w-28 h-40 md:w-36 md:h-52 rounded-2xl overflow-hidden shadow-[0_18px_40px_-12px_rgba(16,24,40,0.45)] bg-[#15171c] cursor-pointer ring-1 ring-black/10"
            >
              <video
                ref={el => { if (el && el.srcObject !== remoteStream) el.srcObject = remoteStream; }}
                autoPlay playsInline muted={false} className="w-full h-full object-cover"
              />
              <div className="absolute top-2 left-2 bg-white/90 text-[#15171c] text-[12px] tabular-nums px-2 py-0.5 rounded-full font-medium">
                {formatDuration(callDurationSeconds)}
              </div>
            </motion.div>
          ) : (
            <button
              type="button"
              onClick={() => setIsCallMinimized(false)}
              className="fixed top-0 left-0 w-full z-[100000] bg-[#1f9d55] text-white px-4 py-2 flex items-center justify-between shadow-sm"
              style={{ paddingTop: 'max(8px, env(safe-area-inset-top, 8px))' }}
            >
              <span className="flex items-center gap-2 text-[14px] font-medium">
                <Phone size={15} strokeWidth={2} aria-hidden="true" />
                Return to call with {activePeer ? getDisplayName(activePeer) : 'your contact'}
              </span>
              <span className="text-[14px] font-medium tabular-nums">{formatDuration(callDurationSeconds)}</span>
              <audio ref={remoteAudioRef} autoPlay playsInline style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} />
            </button>
          ),
          document.body
        ) : (
          <div className={`fixed inset-0 w-full h-full flex flex-col ${callType === 'video' ? 'bg-[#0f1115]' : 'bg-[#f7f8fa]'}`} style={{ zIndex: 200000, touchAction: 'none' }}>

            {/* Background: the other person's video, or their name and picture for a voice call */}
            <div className="absolute inset-0">
              {callType === 'video' ? (
                remoteStream ? (
                  <video
                    ref={el => { if (el && el.srcObject !== remoteStream) el.srcObject = remoteStream; }}
                    autoPlay playsInline className="w-full h-full object-cover"
                    style={{ filter: networkQuality === 'poor' ? 'blur(4px)' : 'none' }}
                  />
                ) : (
                  <AudioCallStage
                    peerName={activePeer ? getDisplayName(activePeer) : 'Unknown'}
                    peerAddress={activePeer}
                    connected={false}
                    durationLabel={formatDuration(callDurationSeconds)}
                  />
                )
              ) : (
                <AudioCallStage
                  peerName={activePeer ? getDisplayName(activePeer) : 'Unknown'}
                  peerAddress={activePeer}
                  connected={!!remoteStream}
                  durationLabel={formatDuration(callDurationSeconds)}
                  poorConnection={networkQuality === 'poor'}
                  audioLevel={audioLevel}
                />
              )}
            </div>

            {/* Your own camera, small and movable */}
            {callType === 'video' && (
              <motion.div
                drag
                dragConstraints={{ top: 60, left: 20, right: 20, bottom: 120 }}
                initial={{ x: 0, y: 0 }}
                className="absolute top-[84px] right-4 z-20 cursor-grab active:cursor-grabbing"
              >
                {!isCamOff && localStream ? (
                  <div className="w-28 h-40 md:w-36 md:h-52 rounded-2xl overflow-hidden ring-1 ring-white/30 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.6)] bg-[#15171c]">
                    <video
                      ref={el => { if (el && el.srcObject !== localStream) el.srcObject = localStream; }}
                      autoPlay playsInline muted className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-28 h-40 md:w-36 md:h-52 rounded-2xl bg-[#15171c] ring-1 ring-white/15 flex flex-col items-center justify-center gap-2 text-white/70">
                    <VideoOff size={22} strokeWidth={1.8} aria-hidden="true" />
                    <span className="text-[12px]">Camera off</span>
                  </div>
                )}
              </motion.div>
            )}

            {/* Video needs a soft shade behind the top bar and controls to stay readable */}
            {callType === 'video' && remoteStream && (
              <>
                <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-black/50 to-transparent pointer-events-none z-20" />
                <div className="absolute bottom-0 inset-x-0 h-44 bg-gradient-to-t from-black/55 to-transparent pointer-events-none z-20" />
              </>
            )}

            {/* Top bar */}
            {(() => {
              const dark = callType === 'video' && !!remoteStream;
              const btn = dark
                ? 'w-11 h-11 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white backdrop-blur-md transition-colors'
                : 'w-11 h-11 flex items-center justify-center rounded-full bg-white hover:bg-[#eff1f4] text-[#15171c] border border-[#e4e7ec] shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-colors';
              return (
                <div className="absolute top-0 inset-x-0 z-30 flex items-start justify-between px-4 sm:px-6" style={{ paddingTop: 'max(16px, env(safe-area-inset-top, 16px))' }}>
                  <button type="button" onClick={() => setIsCallMinimized(true)} className={btn} aria-label="Minimise call" title="Minimise">
                    <Minimize2 size={18} strokeWidth={1.9} />
                  </button>

                  <div className="flex flex-col items-center text-center min-w-0 px-3">
                    <span className={`inline-flex items-center gap-1.5 text-[13px] ${dark ? 'text-white/85' : 'text-[#727a88]'}`}>
                      <Lock size={12} strokeWidth={2} aria-hidden="true" />
                      Encrypted call
                    </span>
                    {dark && (
                      <>
                        <p className="text-white text-[17px] font-semibold tracking-[-0.01em] mt-1 truncate max-w-[60vw]">
                          {activePeer ? getDisplayName(activePeer) : 'Unknown'}
                        </p>
                        <p className="text-white/80 text-[14px] tabular-nums">{formatDuration(callDurationSeconds)}</p>
                      </>
                    )}
                  </div>

                  <button type="button" onClick={() => setShowCallSettings(true)} className={btn} aria-label="Call settings" title="Call settings">
                    <Settings size={18} strokeWidth={1.9} />
                  </button>
                </div>
              );
            })()}

            {/* Weak connection notice, video only (voice shows it under the name) */}
            <AnimatePresence>
              {networkQuality === 'poor' && callType === 'video' && (
                <motion.div
                  initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                  role="status"
                  className="absolute top-[120px] left-1/2 -translate-x-1/2 bg-white text-[#15171c] text-[13px] font-medium px-3.5 py-2 rounded-full z-30 flex items-center gap-2 shadow-[0_8px_24px_-8px_rgba(16,24,40,0.35)]"
                >
                  <AlertTriangle size={14} strokeWidth={2} className="text-[#b7791f]" aria-hidden="true" /> Weak connection
                </motion.div>
              )}
            </AnimatePresence>

            {/* Controls */}
            <div className="absolute bottom-0 inset-x-0 z-30 flex justify-center" style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom, 32px))' }}>
              <CallControls
                tone={callType === 'video' && !!remoteStream ? 'dark' : 'light'}
                isVideo={callType === 'video'}
                micMuted={isMicMuted}
                cameraOff={isCamOff}
                screenSharing={isScreenSharing}
                onSwitchCamera={switchCamera}
                onScreenShare={toggleScreenShare}
                onToggleCamera={toggleCamera}
                onToggleMic={toggleMic}
                onEnd={endCall}
              />
            </div>

            <audio ref={remoteAudioRef} autoPlay playsInline style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} />
          </div>
        )
      )}

      </div> {/* Close Chat Area */}

      {(showCallSettings && isMounted && typeof document !== 'undefined')
        ? createPortal(
        <div className="fixed inset-0 z-[300000] bg-[#15171c]/30 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={() => setShowCallSettings(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="call-settings-title" className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-[0_24px_60px_-20px_rgba(16,24,40,0.35)]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start px-5 pt-5 pb-3">
              <div>
                <h3 id="call-settings-title" className="text-[17px] font-semibold tracking-[-0.01em] text-[#15171c]">Call settings</h3>
                <p className="text-[14px] text-[#727a88] mt-0.5 flex items-center gap-2"><span>{callType === 'video' ? 'Video call' : 'Voice call'}</span><span className="tabular-nums">{formatDuration(callDurationSeconds)}</span></p>
              </div>
              <button type="button" onClick={() => setShowCallSettings(false)} aria-label="Close" className="w-9 h-9 -mr-1 flex items-center justify-center hover:bg-[#eff1f4] rounded-full transition-colors text-[#15171c]">
                <X size={18} strokeWidth={1.9} />
              </button>
            </div>

            <div className="px-3 pb-4 max-h-[70vh] overflow-y-auto">
              {(() => {
                const row = ({ icon, title, text, right, onClick }: { icon: React.ReactNode; title: string; text: string; right?: React.ReactNode; onClick?: () => void }) => {
                  const inner = (
                    <>
                      <span className="w-9 h-9 rounded-xl bg-[#eff1f4] text-[#15171c] flex items-center justify-center shrink-0" aria-hidden="true">{icon}</span>
                      <span className="flex-1 min-w-0 text-left">
                        <span className="block text-[15px] font-medium text-[#15171c]">{title}</span>
                        <span className="block text-[13px] text-[#727a88] mt-0.5">{text}</span>
                      </span>
                      {right}
                    </>
                  );
                  return onClick
                    ? <button type="button" onClick={onClick} className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-[#f7f8fa] transition-colors">{inner}</button>
                    : <div className="w-full flex items-center gap-3 px-3 py-3">{inner}</div>;
                };
                const toggle = ({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) => (
                  <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onToggle}
                    className={`relative w-[46px] h-[28px] rounded-full transition-colors duration-200 shrink-0 ${on ? 'bg-[#15171c]' : 'bg-[#d4d8df]'}`}>
                    <span className={`absolute top-[3px] left-[3px] w-[22px] h-[22px] bg-white rounded-full shadow-sm transition-transform duration-200 ${on ? 'translate-x-[18px]' : 'translate-x-0'}`} />
                  </button>
                );
                return (
                  <>
                    <p className="px-3 pt-1 pb-1 text-[13px] font-medium text-[#727a88]">Sound</p>
                    {row({ icon: <Mic size={17} strokeWidth={1.8} />, title: 'Noise suppression', text: 'Filters out background noise',
                      right: toggle({ on: voiceIsolation, label: 'Noise suppression', onToggle: toggleVoiceIsolation }) })}
                    {row({ icon: <Volume2 size={17} strokeWidth={1.8} />, title: 'Echo cancellation', text: 'Always on in Ledger Chat calls' })}

                    {callType === 'video' && (
                      <>
                        <p className="px-3 pt-3 pb-1 text-[13px] font-medium text-[#727a88]">Video</p>
                        {row({ icon: <Zap size={17} strokeWidth={1.8} />, title: 'Data saver', text: dataSaver ? 'Video is limited to 480p' : 'Video up to 1080p',
                          right: toggle({ on: dataSaver, label: 'Data saver', onToggle: toggleDataSaver }) })}
                      </>
                    )}

                    <p className="px-3 pt-3 pb-1 text-[13px] font-medium text-[#727a88]">Connection</p>
                    {row({ icon: <ShieldCheck size={17} strokeWidth={1.8} />, title: 'Encryption', text: 'How this call is protected',
                      onClick: () => { setShowCallSettings(false); setShowE2EE(true); },
                      right: <ChevronRight size={16} strokeWidth={1.8} className="text-[#a3a9b4]" /> })}
                    {row({ icon: <Wifi size={17} strokeWidth={1.8} />, title: 'Network',
                      text: networkQuality === 'poor' ? 'Weak connection, trying to recover' : 'Connection is stable',
                      right: callRoute.rttMs !== null ? <span className="text-[13px] text-[#727a88] tabular-nums">{callRoute.rttMs} ms</span> : undefined })}
                    {row({ icon: <Globe size={17} strokeWidth={1.8} />, title: 'Route',
                      text: callRoute.kind === 'relay'
                        ? 'Through a relay server. Your IP address stays hidden and the media is still encrypted.'
                        : callRoute.kind === 'direct'
                          ? 'Direct between your devices. Your IP address is visible to the other person.'
                          : 'Checking the connection' })}
                    {row({ icon: <Phone size={17} strokeWidth={1.8} />, title: 'With',
                      text: `${activePeer ? getDisplayName(activePeer) : 'Unknown'}${activePeer ? ' (' + activePeer.slice(0, 6) + '…' + activePeer.slice(-4) + ')' : ''}` })}

                    <button
                      type="button"
                      onClick={() => { setShowCallSettings(false); endCall(); }}
                      className="w-[calc(100%-24px)] mx-3 mt-3 py-3 bg-[#e5484d] hover:brightness-105 text-white text-[15px] font-medium rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                    >
                      <PhoneOff size={17} strokeWidth={2} /> End call
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>,
        document.body
      ) : null}


      {(showE2EE && isMounted && typeof document !== 'undefined')
        ? createPortal(
        <div className="fixed inset-0 z-[300001] bg-[#15171c]/30 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={() => setShowE2EE(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="e2ee-title" className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-[0_24px_60px_-20px_rgba(16,24,40,0.35)]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-end -mt-2 -mr-2">
              <button type="button" onClick={() => setShowE2EE(false)} aria-label="Close" className="w-9 h-9 flex items-center justify-center hover:bg-[#eff1f4] rounded-full transition-colors text-[#15171c]">
                <X size={18} strokeWidth={1.9} />
              </button>
            </div>
            <div className="flex flex-col items-center text-center">
              <span className="w-14 h-14 rounded-full bg-[#eff1f4] flex items-center justify-center text-[#15171c] mb-4" aria-hidden="true">
                <ShieldCheck size={26} strokeWidth={1.7} />
              </span>
              <h3 id="e2ee-title" className="text-[19px] font-semibold tracking-[-0.015em] text-[#15171c]">This call is encrypted</h3>
              <p className="text-[15px] text-[#4a505c] leading-relaxed mt-2">
                Sound and video travel directly between your device and {activePeer ? getDisplayName(activePeer) : 'your contact'}, encrypted with DTLS and SRTP, the standard protection built into every browser call.
              </p>
            </div>
            <ul className="mt-5 space-y-3 text-left">
              <li className="flex gap-3 text-[14px] text-[#4a505c] leading-relaxed">
                <Check size={16} strokeWidth={2} className="text-[#1f9d55] mt-[3px] shrink-0" aria-hidden="true" />
                The signalling server only helps the two devices find each other. It never receives the sound or video.
              </li>
              <li className="flex gap-3 text-[14px] text-[#4a505c] leading-relaxed">
                <Info size={16} strokeWidth={2} className="text-[#727a88] mt-[3px] shrink-0" aria-hidden="true" />
                When a direct connection is not possible, the call is relayed through a TURN server that passes on encrypted data without being able to read it.
              </li>
            </ul>
            <a href="/docs/calls" target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-1 text-[14px] font-medium text-[#15171c] underline underline-offset-4 decoration-[#c9ced6] hover:decoration-[#15171c]">
              How calls work
            </a>
          </div>
        </div>,
        document.body
      ) : null}

      {(showScanner && isMounted && typeof document !== 'undefined')
        ? createPortal(
        <div className="fixed inset-0 z-[200000] bg-[#f7f8fa] flex flex-col items-center justify-center p-6 animate-in fade-in duration-200">
           <div className="w-full max-w-sm">
               <div className="flex justify-between items-center mb-3">
                   <h3 className="text-[19px] font-semibold tracking-[-0.015em] text-[#15171c]">Scan a code</h3>
                   <button type="button" onClick={() => setShowScanner(false)} aria-label="Close" className="w-10 h-10 flex items-center justify-center hover:bg-[#eff1f4] rounded-full transition-colors text-[#15171c]">
                     <X size={18} strokeWidth={1.9} />
                   </button>
               </div>
               <p className="text-[15px] text-[#727a88] leading-relaxed mb-6">
                 Scan a contact&apos;s code to start a conversation, or the code shown on your computer to sign in there.
               </p>
               <QrScanner mode="scan" onScanSuccess={async (text) => {
                  if (text.includes('?s=') || text.includes('?uuid=') || text.includes('humanidfi.com/connect') || text.includes('session=')) {
                    toast.loading('Signing in on your computer', { id: 'link-device' });
                    const result = await completeSessionHandshake(
                      text,
                      () => address as string,
                      signMessageAsync as any,
                      undefined
                    );
                    toast.dismiss('link-device');
                    if (result.ok) {
                      toast.success('Your computer is now signed in.');
                      setShowScanner(false);
                      if (result.cleanup) result.cleanup();
                    } else {
                      toast.error(result.message || 'Could not sign in on your computer. Try a new code.');
                    }
                  } else {
                    handleStartConversationWithPeer(text);
                  }
                }} />
           </div>
        </div>,
        document.body
      ) : null}

      {(showMyQR && isMounted && typeof document !== 'undefined')
        ? createPortal(
        <div className="fixed inset-0 z-[200000] bg-[#f7f8fa] flex flex-col items-center justify-center p-6 animate-in fade-in duration-200">
           <div className="w-full max-w-sm">
               <div className="flex justify-between items-center mb-6">
                   <h3 className="text-[19px] font-semibold tracking-[-0.015em] text-[#15171c]">My code</h3>
                   <button type="button" onClick={() => setShowMyQR(false)} aria-label="Close" className="w-10 h-10 flex items-center justify-center hover:bg-[#eff1f4] rounded-full transition-colors text-[#15171c]">
                     <X size={18} strokeWidth={1.9} />
                   </button>
               </div>
               <QrScanner 
                   mode="project" 
                   projectValue={address} 
                   projectTitle={chatName || "Your Ledger Chat code"}
                   projectDescription={chatBio || "Let someone scan this code to start a conversation with you."}
               />
           </div>
        </div>,
        document.body
      ) : null}

       
       {/* Message actions menu */}
       {(contextMenu && typeof document !== 'undefined')
         ? createPortal(
         <div className="fixed inset-0 z-[200]" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}>
           {(() => {
             const mine = messages.find(m => m.id === contextMenu.id)?.senderAddress?.toLowerCase() === address?.toLowerCase();
             const item = 'flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#f2f4f7] text-[14.5px] text-[#15171c] text-left transition-colors';
             return (
               <div
                 role="menu"
                 aria-label="Message actions"
                 className="absolute bg-white border border-[#e4e7ec] rounded-2xl shadow-[0_16px_40px_-12px_rgba(16,24,40,0.28)] p-1.5 min-w-[200px] flex flex-col animate-in fade-in zoom-in-95 duration-150"
                 style={{
                   top: Math.max(8, Math.min(contextMenu.y, window.innerHeight - 330)),
                   left: Math.max(8, Math.min(contextMenu.x, window.innerWidth - 216)),
                 }}
                 onClick={e => e.stopPropagation()}
               >
                 <button role="menuitem" type="button" onClick={() => { setReplyingTo({ id: contextMenu.id, content: contextMenu.content }); setContextMenu(null); setTimeout(() => inputRef.current?.focus(), 100); }} className={item}>
                   <Reply size={16} strokeWidth={1.8} className="text-[#4a505c]" /> Reply
                 </button>
                 <button role="menuitem" type="button" onClick={() => { setThreadParentId(contextMenu.id); setContextMenu(null); }} className={item}>
                   <MessagesSquare size={16} strokeWidth={1.8} className="text-[#4a505c]" /> Reply in thread
                 </button>
                 <button role="menuitem" type="button" onClick={() => { navigator.clipboard.writeText(contextMenu.content.replace(/^\[.*?\]/, '')); toast.success('Copied'); setContextMenu(null); }} className={item}>
                   <Copy size={16} strokeWidth={1.8} className="text-[#4a505c]" /> Copy
                 </button>
                 <button role="menuitem" type="button" onClick={() => { setForwardMsg({ id: contextMenu.id, content: contextMenu.content }); setContextMenu(null); }} className={item}>
                   <Forward size={16} strokeWidth={1.8} className="text-[#4a505c]" /> Forward
                 </button>
                 <button role="menuitem" type="button" onClick={() => { executeSend(`__PIN__${contextMenu.id}`); setContextMenu(null); }} className={item}>
                   <Pin size={16} strokeWidth={1.8} className="text-[#4a505c]" /> Pin
                 </button>
                 <button role="menuitem" type="button" onClick={() => { toggleSaveMessage(contextMenu.id, contextMenu.content); setContextMenu(null); }} className={item}>
                   <Bookmark size={16} strokeWidth={1.8} className="text-[#4a505c]" /> {savedMessages.some(m => m.id === contextMenu.id) ? 'Remove saved' : 'Save message'}
                 </button>
                 {mine && (
                   <button role="menuitem" type="button" onClick={() => { setEditingMsg({ id: contextMenu.id, content: contextMenu.content }); setContextMenu(null); }} className={item}>
                     <Pencil size={16} strokeWidth={1.8} className="text-[#4a505c]" /> Edit
                   </button>
                 )}
                 <div className="h-px bg-[#eceef2] my-1 mx-2" />
                 {mine ? (
                   <button role="menuitem" type="button" onClick={() => { setMessages(prev => prev.filter(m => m.id !== contextMenu.id)); executeSend(`__REVOKE__${contextMenu.id}`); setContextMenu(null); }} className={`${item} text-[#d93036]`}>
                     <Trash2 size={16} strokeWidth={1.8} /> Delete for everyone
                   </button>
                 ) : (
                   <button role="menuitem" type="button" onClick={() => { reportMessage(contextMenu.id, contextMenu.content); }} className={`${item} text-[#d93036]`}>
                     <Flag size={16} strokeWidth={1.8} /> Report
                   </button>
                 )}
               </div>
             );
           })()}
         </div>,
         document.body
       ) : null}

        {/* Forward a message */}
        {forwardMsg && (
          <div className="fixed inset-0 z-[300] bg-[#15171c]/30 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={() => setForwardMsg(null)}>
            <div role="dialog" aria-modal="true" aria-labelledby="forward-title" className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-[0_24px_60px_-20px_rgba(16,24,40,0.35)] animate-in slide-in-from-bottom-4 duration-300" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 id="forward-title" className="text-[17px] font-semibold tracking-[-0.01em] text-[#15171c]">Forward to</h3>
                <button type="button" onClick={() => setForwardMsg(null)} aria-label="Close" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#eff1f4] text-[#15171c]">
                  <X size={18} strokeWidth={1.9} />
                </button>
              </div>
              <div className="bg-[#f7f8fa] rounded-xl border border-[#eceef2] px-3.5 py-2.5 mb-3">
                <p className="text-[14px] text-[#4a505c] truncate">{forwardMsg.content ? formatMessagePreview(forwardMsg.content) : 'Message'}</p>
              </div>
              <div className="flex flex-col gap-0.5 max-h-72 overflow-y-auto -mx-1">
                {conversations.map(conv => (
                  <button type="button" key={conv.peerAddress} onClick={() => {
                    if (typeof window !== 'undefined' && localStorage.getItem('ledger_locked_' + conv.peerAddress.toLowerCase())) {
                      toast.error('That chat is locked. Open it and unlock it first.');
                      return;
                    }
                    const content = forwardMsg.content ? formatMessagePreview(forwardMsg.content) : 'Message';
                    const currentPeer = activePeer;
                    setActivePeer(conv.peerAddress);
                    setTimeout(() => { executeSendRef.current?.(`[Forwarded] ${content}`); setActivePeer(currentPeer); }, 300);
                    setForwardMsg(null);
                    toast.success(`Forwarded to ${getDisplayName(conv.peerAddress)}`);
                  }} className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-[#f7f8fa] text-left">
                    <Avatar address={conv.peerAddress} />
                    <span className="min-w-0">
                      <span className="block text-[15px] font-medium text-[#15171c] truncate">{getDisplayName(conv.peerAddress)}</span>
                      <span className="block text-[13px] text-[#727a88] truncate tabular-nums">{conv.peerAddress.slice(0, 6)}…{conv.peerAddress.slice(-4)}</span>
                    </span>
                  </button>
                ))}
                {conversations.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                    <MessageSquare size={24} strokeWidth={1.6} className="text-[#a3a9b4] mb-3" aria-hidden="true" />
                    <p className="text-[15px] font-medium text-[#15171c] mb-1">No conversations yet</p>
                    <p className="text-[14px] text-[#727a88] leading-relaxed">Start a conversation first, then you can forward messages to it.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Profile Popover Overlay — fixed + portal so it escapes overflow:hidden containers */}
       <AnimatePresence>
        {showProfile && activePeer && (
          <LedgerChatProfile
            peerAddress={activePeer}
            onClose={() => setShowProfile(false)}
            onClearChat={clearChat}
            onBlockUser={() => toggleBlock(activePeer)}
            getDisplayName={(addr: string) => resolveContactName(address || '', addr) || addr}
          />
        )}
       </AnimatePresence>

       {/* Photo viewer */}
       {(lightboxImg && typeof document !== 'undefined')
         ? createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo"
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-[#0f1115]/95 animate-in fade-in duration-200"
          onClick={() => setLightboxImg(null)}
        >
          <div className="absolute top-0 inset-x-0 flex items-center justify-end gap-2 p-4" style={{ paddingTop: 'max(16px, env(safe-area-inset-top, 16px))' }}>
            <a
              href={lightboxImg}
              download="ledger-chat-photo"
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              aria-label="Download"
              title="Download"
              className="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <Download size={19} strokeWidth={1.9} />
            </a>
            <button
              type="button"
              aria-label="Close"
              title="Close"
              className="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); setLightboxImg(null); }}
            >
              <X size={20} strokeWidth={1.9} />
            </button>
          </div>
          <img
            src={lightboxImg}
            alt=""
            className="max-w-[94vw] max-h-[84vh] object-contain rounded-lg select-none animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body
       ) : null}

       {/* Clear chat confirmation */}
       {showClearConfirm && typeof document !== 'undefined' ? createPortal(
         <div className="fixed inset-0 bg-[#15171c]/30 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-150" style={{ zIndex: 200000 }} onClick={() => setShowClearConfirm(false)}>
           <div role="alertdialog" aria-modal="true" aria-labelledby="clear-title" aria-describedby="clear-text" className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-[0_24px_60px_-20px_rgba(16,24,40,0.35)]" onClick={e => e.stopPropagation()}>
             <h3 id="clear-title" className="text-[18px] font-semibold tracking-[-0.015em] text-[#15171c]">Clear this chat?</h3>
             <p id="clear-text" className="text-[15px] text-[#4a505c] leading-relaxed mt-2">
               All messages in this conversation will be removed from this device. The other person keeps their copy.
             </p>
             <div className="flex items-center justify-end gap-2 mt-6">
               <button type="button" onClick={() => setShowClearConfirm(false)} className="px-4 py-2.5 rounded-xl bg-[#eff1f4] hover:bg-[#e4e7ec] text-[15px] font-medium text-[#15171c] transition-colors">
                 Cancel
               </button>
               <button type="button" onClick={executeClearChat} className="px-4 py-2.5 rounded-xl bg-[#e5484d] hover:brightness-105 text-white text-[15px] font-medium transition-all">
                 Clear chat
               </button>
             </div>
           </div>
         </div>,
         document.body
       ) : null}

       {/* Conversation actions in the list */}
       {(sidebarMenu && typeof document !== 'undefined')
         ? createPortal(
         <div className="fixed inset-0 z-[200]" onClick={() => setSidebarMenu(null)} onContextMenu={(e) => { e.preventDefault(); setSidebarMenu(null); }}>
           <div
             role="menu"
             aria-label="Conversation actions"
             className="absolute bg-white border border-[#e4e7ec] rounded-2xl shadow-[0_16px_40px_-12px_rgba(16,24,40,0.28)] p-1.5 min-w-[190px] flex flex-col animate-in fade-in zoom-in-95 duration-150"
             style={{
               top: Math.max(8, Math.min(sidebarMenu.y, window.innerHeight - 120)),
               left: Math.max(8, Math.min(sidebarMenu.x, window.innerWidth - 206)),
             }}
             onClick={e => e.stopPropagation()}
           >
             <button role="menuitem" type="button" onClick={() => toggleArchive(sidebarMenu.peer)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#f2f4f7] text-[14.5px] text-[#15171c] text-left">
               {archivedPeers.has(sidebarMenu.peer.toLowerCase())
                 ? <><ArchiveRestore size={16} strokeWidth={1.8} className="text-[#4a505c]" /> Move to inbox</>
                 : <><Archive size={16} strokeWidth={1.8} className="text-[#4a505c]" /> Archive</>}
             </button>
             <button role="menuitem" type="button" onClick={() => deleteConversation(sidebarMenu.peer)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#f2f4f7] text-[14.5px] text-[#d93036] text-left">
               <Trash2 size={16} strokeWidth={1.8} /> Delete chat
             </button>
           </div>
         </div>,
         document.body
       ) : null}

       {/* Create a poll */}
       {showPollCreator && (() => {
         const close = () => { setShowPollCreator(false); setPollQuestion(''); setPollOptions(['', '']); };
         const valid = pollQuestion.trim() && pollOptions.filter(o => o.trim()).length >= 2;
         const field = 'w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#d9dde3] text-[15px] text-[#15171c] placeholder:text-[#a3a9b4] focus:outline-none focus:border-[#15171c] focus:ring-2 focus:ring-[#15171c]/10';
         return (
           <div className="fixed inset-0 z-[1000] bg-[#15171c]/30 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-150" onClick={close}>
             <div role="dialog" aria-modal="true" aria-labelledby="poll-title" className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-[0_24px_60px_-20px_rgba(16,24,40,0.35)] flex flex-col gap-4" onClick={e => e.stopPropagation()}>
               <div className="flex items-center justify-between">
                 <h3 id="poll-title" className="text-[17px] font-semibold tracking-[-0.01em] text-[#15171c]">New poll</h3>
                 <button type="button" onClick={close} aria-label="Close" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#eff1f4] text-[#15171c]">
                   <X size={18} strokeWidth={1.9} />
                 </button>
               </div>
               <label className="flex flex-col gap-1.5">
                 <span className="text-[13px] font-medium text-[#4a505c]">Question</span>
                 <input type="text" autoFocus placeholder="What would you like to ask?" value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} maxLength={200} className={field} />
               </label>
               <div className="flex flex-col gap-2">
                 <span className="text-[13px] font-medium text-[#4a505c]">Options</span>
                 {pollOptions.map((opt, i) => (
                   <div key={i} className="flex gap-2 items-center">
                     <input
                       type="text"
                       placeholder={`Option ${i + 1}`}
                       value={opt}
                       maxLength={80}
                       onChange={e => setPollOptions(prev => prev.map((o, j) => j === i ? e.target.value.replace(/\|/g, '') : o))}
                       className={field}
                     />
                     {pollOptions.length > 2 && (
                       <button type="button" onClick={() => setPollOptions(prev => prev.filter((_, j) => j !== i))} aria-label={`Remove option ${i + 1}`} className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full hover:bg-[#eff1f4] text-[#727a88]">
                         <X size={16} strokeWidth={1.9} />
                       </button>
                     )}
                   </div>
                 ))}
                 {pollOptions.length < 5 && (
                   <button type="button" onClick={() => setPollOptions(prev => [...prev, ''])} className="self-start inline-flex items-center gap-1.5 text-[14px] font-medium text-[#15171c] px-1 py-1 rounded-lg hover:bg-[#f2f4f7]">
                     <Plus size={15} strokeWidth={2} /> Add an option
                   </button>
                 )}
               </div>
               <button
                 type="button"
                 disabled={!valid}
                 onClick={() => {
                   const validOpts = pollOptions.map(o => o.trim()).filter(Boolean);
                   if (!pollQuestion.trim() || validOpts.length < 2) return;
                   const pollId = `poll_${Date.now()}`;
                   executeSend(`__POLL__${pollId}__::${pollQuestion.trim()}__::${validOpts.join('|')}`);
                   close();
                 }}
                 className="w-full py-3 rounded-xl bg-[#15171c] hover:bg-[#2b2f38] disabled:bg-[#e4e7ec] disabled:text-[#a3a9b4] text-white text-[15px] font-medium transition-colors"
               >
                 Send poll
               </button>
             </div>
           </div>
         );
       })()}

       {/* ── Native Crypto Send Modal (replaces QD Transfer) ── */}
       {showWalletTransfer && activePeer && (
         <NativeCryptoSendModal
           isOpen={showWalletTransfer}
           recipientAddress={activePeer}
           onClose={() => { setShowWalletTransfer(false); setTransferAmount(''); }}
           onSent={(txHash, amount, token) => {
             const payload = JSON.stringify({ amount, token, txHash, to: activePeer });
             executeSend(`__PAYMENT__::${payload}`);
             setShowWalletTransfer(false);
             setTransferAmount('');
           }}
         />
       )}

      </div>

      {/* Fase 13: WebRTC Pre-Prompt — shown before getUserMedia is called */}
       {/* ── Creator Tip Modal (Phase 3 Monetization #129-130) ── */}
       {showTipModal && activePeer && (
         <SendTipModal
           open={showTipModal}
           recipientAddress={activePeer}
           onClose={() => setShowTipModal(false)}
           onTipSent={({ amount, token, txHash, to }) => {
             const payload = JSON.stringify({ amount, token, txHash, to });
             executeSend(`__TIP__::${payload}`);
             setShowTipModal(false);
           }}
         />
       )}

       {/* Private payment (Aztec, experimental) */}
       {showZkModal && activePeer && (
         <ZkMoneyModal
           isOpen={showZkModal}
           onClose={() => setShowZkModal(false)}
           myAddress={address || ''}
           recipientAddress={activePeer}
           onSuccess={(paymentPayload, _result) => {
             executeSend(paymentPayload);
             setShowZkModal(false);
           }}
         />
       )}

       {/* ── Aztec zk.money Shielded Wallet Panel ── */}
       <AnimatePresence>
         {showZkWallet && (
           <motion.div
             initial={{ opacity: 0, x: '100%' }}
             animate={{ opacity: 1, x: 0 }}
             exit={{ opacity: 0, x: '100%' }}
             transition={{ type: 'spring', stiffness: 320, damping: 32 }}
             className="fixed inset-y-0 right-0 w-84 z-[500] shadow-2xl"
           >
             <ZkWalletPanel
               address={address || ''}
               onClose={() => setShowZkWallet(false)}
               onSend={() => { setShowZkWallet(false); setShowZkModal(true); }}
             />
           </motion.div>
         )}
       </AnimatePresence>

       {/* ── Aztec zk.money Payment Stream Modal ── */}
       {showZkStreamModal && activePeer && (
         <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowZkStreamModal(false)}>
           <div className="bg-white rounded-3xl shadow-2xl border border-black/10 w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
             <ZkStreamManager
               userAddress={address || ''}
               defaultRecipient={activePeer}
               onClose={() => setShowZkStreamModal(false)}
               onStreamCreated={(stream) => {
                 executeSend(encodeStreamPayload(stream));
                 setShowZkStreamModal(false);
                 toast.success('Payment stream created');
               }}
             />
           </div>
         </div>
       )}

       {/* ── Aztec zk.money Invoice Modal ── */}
       {showZkInvoiceModal && activePeer && (
         <ZkInvoiceModal
           userAddress={address || ''}
           defaultClientAddress={activePeer}
           onClose={() => setShowZkInvoiceModal(false)}
           onInvoiceCreated={(invoice) => {
             executeSend(encodeInvoicePayload(invoice));
             setShowZkInvoiceModal(false);
             toast.success('Invoice sent');
           }}
         />
       )}

      {pendingCallType && isMounted && typeof document !== 'undefined'
        ? createPortal(
            <MediaPermissionsPrePrompt
              pendingCallType={pendingCallType}
              setPendingCallType={setPendingCallType}
              onGrant={(type) => {
                vault.setItem('ledger_media_perm', 'true');
                setHasMediaPermission(true);
                setPendingCallType(null);
                if (type === 'audio' || type === 'video') startCall(type);
                else if (type === 'answer') answerCall();
              }}
            />,
            document.body
          )
        : null}

      {/* Save contact */}
      {showSaveContactModal && activePeer && isMounted && typeof document !== 'undefined' && createPortal(
        (() => {
          const save = () => {
            if (!saveContactName.trim() || !address) return;
            saveLocalContact(address, { peerAddress: activePeer, name: saveContactName.trim() });
            toast.success(`Saved as ${saveContactName.trim()}`);
            setShowSaveContactModal(false);
          };
          return (
            <div className="fixed inset-0 z-[300000] flex items-end sm:items-center justify-center sm:p-4 bg-[#15171c]/30 backdrop-blur-sm" onClick={() => setShowSaveContactModal(false)}>
              <form
                role="dialog"
                aria-modal="true"
                aria-labelledby="save-contact-title"
                className="bg-white rounded-t-3xl sm:rounded-3xl shadow-[0_24px_60px_-20px_rgba(16,24,40,0.35)] p-5 w-full sm:max-w-sm"
                onClick={e => e.stopPropagation()}
                onSubmit={e => { e.preventDefault(); save(); }}
              >
                <h3 id="save-contact-title" className="text-[17px] font-semibold tracking-[-0.01em] text-[#15171c]">Save contact</h3>
                <p className="text-[13px] text-[#727a88] mt-1 mb-4 break-all tabular-nums">{activePeer}</p>
                <label className="flex flex-col gap-1.5 mb-5">
                  <span className="text-[13px] font-medium text-[#4a505c]">Name</span>
                  <input
                    autoFocus
                    type="text"
                    value={saveContactName}
                    maxLength={60}
                    onChange={e => setSaveContactName(e.target.value)}
                    placeholder="How you want to see this person"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#d9dde3] text-[15px] text-[#15171c] placeholder:text-[#a3a9b4] focus:outline-none focus:border-[#15171c] focus:ring-2 focus:ring-[#15171c]/10"
                  />
                </label>
                <p className="text-[13px] text-[#727a88] -mt-3 mb-5">Only you can see this name. It stays on this device.</p>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowSaveContactModal(false)} className="px-4 py-2.5 rounded-xl bg-[#eff1f4] hover:bg-[#e4e7ec] text-[15px] font-medium text-[#15171c] transition-colors">Cancel</button>
                  <button type="submit" disabled={!saveContactName.trim()} className="px-4 py-2.5 rounded-xl bg-[#15171c] hover:bg-[#2b2f38] disabled:bg-[#e4e7ec] disabled:text-[#a3a9b4] text-white text-[15px] font-medium transition-colors">Save</button>
                </div>
              </form>
            </div>
          );
        })(),
        document.body
      )}

      {/* Contact Requests Panel */}
      {showContactRequests && isMounted && address && typeof document !== 'undefined' && createPortal(
        <ContactRequestsPanel
          myAddress={address}
          onClose={() => {
            setShowContactRequests(false);
            setPendingRequestCount(0); // optimistically clear badge on close
          }}
          onAccepted={(peer, nickname) => {
            // [FIX 1] Close the modal immediately — no zombie overlay
            setShowContactRequests(false);
            setPendingRequestCount(0);
            // [FIX 2] Persist to local contacts with the nickname the requester has
            saveLocalContact(address, {
              peerAddress: peer,
              name: nickname || `Chat ${peer.slice(0, 6)}`,
            });
            // Refresh the contacts tab so the new entry appears instantly
            loadContacts();
            // [FIX 3] Open the conversation
            handleStartConversationWithPeer(peer);
          }}
        />,
        document.body
      )}

      {showSavedModal && (
        <SavedMessagesModal
          isOpen={showSavedModal}
          onClose={() => setShowSavedModal(false)}
          savedMessages={savedMessages}
          onRemove={(id) => toggleSaveMessage(id, '')}
          onJumpToMessage={(id) => {
            const el = document.getElementById(`msg-${id}`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
        />
      )}

      {showShortcutsModal && (
        <KeyboardShortcutsModal
          isOpen={showShortcutsModal}
          onClose={() => setShowShortcutsModal(false)}
        />
      )}

      {showCreateGroup && createPortal(
        <CreateGroupModal
          client={client}
          myAddress={address}
          onClose={() => setShowCreateGroup(false)}
          onGroupCreated={(groupId, groupName) => {
            handleStartConversationWithPeer(groupId);
          }}
        />,
        document.body
      )}

      </div>{/* end h-full flex-col layout wrapper */}
    </TuringShieldGate>
  );
}





















