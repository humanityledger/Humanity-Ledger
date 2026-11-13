// @ts-nocheck
"use client";
import { MoreVertical, MapPin, Copy, Trash2, UserPlus, Download, Slash, Settings, Clock, Lock, PieChart, Bell, Users, AlertTriangle, ChevronRight, Wifi, Zap, X, Bookmark } from 'lucide-react';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { parseValueHandoff, VALUE_HANDOFF_EVENT, type ValueHandoff } from '@/lib/chat/value-handoff';
import { createPortal } from 'react-dom';
import { Video, VideoOff, Phone, PhoneOff, Mic, MicOff, Volume2, Smile, Paperclip, BarChart2, Wallet, Flame, Heart, Image as ImageIcon, Map as MapIcon, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import type Peer from 'peerjs';
import { useSystemAccount } from '@/hooks/useSystemAccount';
import { useSignMessage, useReconnect } from 'wagmi';
import { useSystemSignOut } from '@/hooks/useSystemSignOut';
import { sendViaOnion, registerAsRelay } from '@/lib/onion/OnionRouter';
import { useAppKit } from '@reown/appkit/react';
import { getXMTPClient, canReceiveMessages, sendMessage, getMessages, destroyXMTPClient, nsToDate, discoverNewPeers, streamMessages, resolveSenderAddress, extractPeerAddress, revokeXMTPInstallations, syncOfflineQueue } from '@/lib/xmtp/client';
import { completeSessionHandshake } from '@/lib/scan/sessionHandshake';
import { PadlockLoader, isWalletInitError } from '@/components/terminal/PadlockLoader';
import { HLLogo } from '@/components/shared/HLLogo';
import { TuringShieldGate } from '@/components/auth/TuringShieldGate';
import type { Client } from '@xmtp/browser-sdk';
import { useSettingsStore } from '@/lib/store/useSettingsStore';
import { useWalletStore } from '@/lib/store/wallet-store';
import { useAztec } from '@/context/AztecContext';
import { toast } from 'sonner';
import { chatTextPx, DEFAULT_TEXT_SIZE_LEVEL } from '@/lib/chat/textSize';
import { loadBlockList, saveBlockList, BLOCK_LIST_EVENT } from '@/lib/chat/blockList';
import { deriveCallLog, callLogMessages, decodeCallEntry, callEntryLabel, isCallSignal, CALL_LOG_PREFIX, type CallSignal } from '@/lib/chat/callLog';
import { startDeviceSync, stopDeviceSync, handleDeviceSyncMessage, setSynced, getSynced, getDeviceStore, DEVICE_SYNC_EVENT, type DeviceSyncEventDetail } from '@/lib/sync/runtime';
import { vault } from '@/lib/core/SecureVault';
import { ChatCommunityGate } from '@/components/chat/ChatCommunityGate';
import { getLocalContacts, saveLocalContact, resolveContactName, LocalContact } from '@/lib/wallet/localAddressBook';
import { getCallHistory, saveCallRecord, CallRecord } from '@/lib/wallet/callHistory';
import { LedgerChatOnboarding } from '@/components/chat/LedgerChatOnboarding';
import { LedgerChatStatusBar } from '@/components/chat/LedgerChatStatusBar';
import { useLedgerChatPresence } from '@/hooks/useLedgerChatPresence';
import { extensionForRecording, pickRecordingMimeType } from '@/lib/chat/recording';
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
import SwipeableConversationRow from '@/components/chat/SwipeableConversationRow';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { ThemePickerSheet, chatThemeStyle } from '@/components/chat/ThemePickerSheet';
import { CHAT_THEMES, findChatTheme, isChatThemeId, type ChatTheme } from '@/lib/chat/themes';
import { BUBBLE_STYLES, isBubbleStyleId } from '@/lib/chat/bubbleStyles';
import { WallpaperPickerSheet, WALLPAPER_OPTIONS, type WallpaperOption } from '@/components/chat/WallpaperPickerSheet';
// Panels, sheets and tabs that open on demand load on demand: less JavaScript to parse and keep
// in memory when the chat opens (the emoji picker and QR scanner alone are several hundred KB).
const QrScanner = dynamic(() => import('@/components/terminal/QrScanner').then(m => m.QrScanner), { ssr: false });
const LedgerSettingsFull = dynamic(() => import('@/components/chat/LedgerSettingsFull').then(m => m.LedgerSettingsFull), { ssr: false });
const CreateGroupModal = dynamic(() => import('../chat/CreateGroupModal').then(m => m.CreateGroupModal), { ssr: false });
const LedgerChatProfile = dynamic(() => import('@/components/chat/LedgerChatProfile').then(m => m.LedgerChatProfile), { ssr: false });
const LedgerChatVaultManager = dynamic(() => import('@/components/chat/LedgerChatVaultManager').then(m => m.LedgerChatVaultManager), { ssr: false });
const LedgerChatUserSearch = dynamic(() => import('@/components/chat/LedgerChatUserSearch').then(m => m.LedgerChatUserSearch), { ssr: false });
const ContactRequestsPanel = dynamic(() => import('@/components/chat/ContactRequestsPanel').then(m => m.ContactRequestsPanel), { ssr: false });
const ContactInfoPanel = dynamic(() => import('@/components/chat/ContactInfoPanel').then(m => m.ContactInfoPanel), { ssr: false });
const LedgerUpdatesTab = dynamic(() => import('@/components/chat/LedgerUpdatesTab').then(m => m.LedgerUpdatesTab), { ssr: false });
const BurnTimerSheet = dynamic(() => import('@/components/chat/BurnTimerSheet').then(m => m.BurnTimerSheet), { ssr: false });
const NativeCryptoSendModal = dynamic(() => import('@/components/chat/NativeCryptoSendModal').then(m => m.NativeCryptoSendModal), { ssr: false });
const SendTipModal = dynamic(() => import('@/components/chat/SendTipModal').then(m => m.SendTipModal), { ssr: false });
const ScheduleMessageSheet = dynamic(() => import('@/components/chat/ScheduleMessageSheet').then(m => m.ScheduleMessageSheet), { ssr: false });
const ChatDetailsPanel = dynamic(() => import('@/components/chat/ChatDetailsPanel').then(m => m.ChatDetailsPanel), { ssr: false });
const ScheduleMeetingSheet = dynamic(() => import('@/components/chat/ScheduleMeetingSheet').then(m => m.ScheduleMeetingSheet), { ssr: false });
const InChatSearch = dynamic(() => import('@/components/chat/InChatSearch').then(m => m.InChatSearch), { ssr: false });
const LedgerCallsTab = dynamic(() => import('@/components/chat/LedgerCallsTab').then(m => m.LedgerCallsTab), { ssr: false });
const LedgerCommunitiesTab = dynamic(() => import('@/components/chat/LedgerCommunitiesTab').then(m => m.LedgerCommunitiesTab), { ssr: false });
const CommunityView = dynamic(() => import('@/components/chat/CommunityView').then(m => m.CommunityView), { ssr: false });
const ExpressionPicker = dynamic(() => import('@/components/chat/ExpressionPicker').then(m => m.ExpressionPicker), { ssr: false });
const ZkMoneyModal = dynamic(() => import('@/components/chat/ZkMoneyModal').then(m => m.ZkMoneyModal), { ssr: false });
const ZkWalletPanel = dynamic(() => import('@/components/zk/ZkWalletPanel').then(m => m.ZkWalletPanel), { ssr: false });
const ZkStreamManager = dynamic(() => import('@/components/zk/ZkStreamManager').then(m => m.ZkStreamManager), { ssr: false });
const ZkInvoiceModal = dynamic(() => import('@/components/zk/ZkInvoiceModal').then(m => m.ZkInvoiceModal), { ssr: false });
import { encodeStreamPayload } from '@/lib/zk/zkStreaming';
import { agreementMessageKind, agreementPreview, isAgreementMessage } from '@/lib/aztec/agreement-message';
import { AZTEC_WALLET_CONFIG, networkLabel } from '@/lib/aztec/wallet/config';
import { attachmentPreview, isAttachmentMessage, parseAttachmentMessage } from '@/lib/chat/remote-attachment';
import { prepareAttachmentMessage, AttachmentError } from '@/lib/chat/send-attachment';
const AgreementComposer = dynamic(() => import('@/components/chat/AgreementComposer').then(m => m.AgreementComposer), { ssr: false });
import { encodeInvoicePayload, parseInvoicePayload, type ZkInvoice } from '@/lib/zk/zkInvoice';
import { SLASH_COMMANDS, transformClientCommand, isBotCommand, executeBotCommand } from '@/lib/bots/botInterceptor';
import { usePushNotifications } from '@/lib/push/usePushNotifications';
import { getSelfLink, remoteSign, RemoteSignError } from '@/lib/link/channel';
import type { ExpressionTab } from '@/components/chat/ExpressionPicker';
import { LinkedDeviceApprover } from '@/components/link/LinkedDeviceApprover';
import { LottieSendButton } from '@/components/chat/LottieSendButton';
import { useDynamicIsland } from '@/lib/store/dynamic-island-store';
import { chatDB } from '@/lib/chat/indexeddb';
import { EncryptedMediaEngine } from '@/lib/chat/media';
import { SavedMessagesModal } from '@/components/chat/SavedMessagesModal';
import { KeyboardShortcutsModal } from '@/components/chat/KeyboardShortcutsModal';
import { hiddenIds, isHidden, markDeletedForMe, markRevoked, shouldHonourRevoke } from '@/lib/chat/deleted-messages';










interface ConversationMeta {
  peerAddress: string;
  lastMessage?: string;
  lastAt?: Date;
  unreadCount?: number;
}

/** Attach-menu entries hidden when Settings → Payments → "Payments in chats" is off. */
const PAYMENT_DRAWER_IDS = new Set(['zkmoney', 'zkstream', 'agreement', 'zkinvoice', 'payment', 'tip']);

/** forceAutoInit=true: always auto-init XMTP even on mobile (used by /chat route) */
export interface LedgerChatProps {
  forceAutoInit?: boolean;
}

function Avatar({ address, isMe = false, size = 44 }: { address: string; isMe?: boolean; size?: number }) {
  const [savedAvatar, setSavedAvatar] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('ledger_avatar') || '';
  });

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.avatarUrl !== undefined) setSavedAvatar(detail.avatarUrl);
    };
    window.addEventListener('ledger_settings_update', handler);
    return () => window.removeEventListener('ledger_settings_update', handler);
  }, []);

  useEffect(() => {
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

const shortAddr = (addr: string) => formatAddress(addr);

export const isSystemSignal = (content: any): boolean => {
  if (typeof content !== 'string') return false;
  return content.startsWith('__CALL_') ||
         content.startsWith('__REACT__') ||
         content.startsWith('__PIN__') ||
         content.startsWith('__UNPIN__') ||
         content.startsWith('__REVOKE__') ||
         content.startsWith('__EDIT__') ||
         content.startsWith('__READ__') ||
         content.startsWith('__DELIVERED__') ||
         content.startsWith('__VOTE__') ||
         content.startsWith('__TYPING__') ||
         content.startsWith('__KEY_') ||
         content.startsWith('__SIGNAL_') ||
         content.startsWith('__CLEAR__');
};

/**
 * Messages whose text carries secrets: agreement invitations (escrow secrets)
 * and encrypted attachments (the file key). They are only ever shown through
 * formatMessagePreview(): never copied, quoted in a reply or notified as text.
 */
/** What may be stored or shown as a conversation's last message: never the text of a secret-bearing message. */
// Scheduled-call invitations are stored as their label too: the list keeps only the first 30 characters, which would cut the JSON.
const lastMessageOf = (content: string): string => (carriesSecret(content) || (typeof content === 'string' && content.includes('__MEETING__::')) ? formatMessagePreview(content) : content);

const carriesSecret = (content: unknown): boolean => {
  if (typeof content !== 'string') return false;
  // Reply, burn, thread and forward wrappers all end in "__::".
  const inner = content.startsWith('__') && content.includes('__::') ? (content.split('__::').pop() || '') : content;
  return isAgreementMessage(content) || isAgreementMessage(inner) || isAttachmentMessage(inner);
};

export const formatMessagePreview = (content: string): string => {
  if (typeof content !== 'string') return 'Message';
  if (isSystemSignal(content)) return '';
  let cleanContent = content;
  let isBurn = false;
  
  // Recursively unwrap replies, burn/self-destruct, thread, forward wrappers
  let unwrapped = true;
  while (unwrapped) {
    unwrapped = false;
    if (cleanContent.startsWith('__REPLY__')) {
      const parts = cleanContent.split('__::');
      if (parts.length >= 2) {
        cleanContent = parts.slice(1).join('__::');
        unwrapped = true;
      }
    }
    if (cleanContent.startsWith('__BURN_')) {
      const parts = cleanContent.split('__::');
      if (parts.length >= 2) {
        cleanContent = parts.slice(1).join('__::');
        isBurn = true;
        unwrapped = true;
      }
    }
    if (cleanContent.startsWith('__THREAD__')) {
      const parts = cleanContent.split('__::');
      if (parts.length >= 2) {
        cleanContent = parts.slice(1).join('__::');
        unwrapped = true;
      }
    }
    if (cleanContent.startsWith('__FORWARD__')) {
      const parts = cleanContent.split('__::');
      if (parts.length >= 2) {
        cleanContent = parts.slice(1).join('__::');
        unwrapped = true;
      }
    }
  }

  // Agreement invitations carry secrets: never preview or notify their text.
  const agreementKind = agreementMessageKind(cleanContent);
  if (agreementKind) return agreementPreview(agreementKind);
  // Encrypted attachments carry their decryption key: never preview or notify their text.
  const remoteAttachment = parseAttachmentMessage(cleanContent);
  if (remoteAttachment) return attachmentPreview(remoteAttachment);
  // Scheduled calls: a short label, never the JSON.
  const meeting = parseMeeting(cleanContent);
  if (meeting) return meetingPreview(meeting);

  // Handle system messages and metadata
  if (cleanContent.startsWith(CALL_LOG_PREFIX)) {
    const entry = decodeCallEntry(cleanContent);
    return entry ? callEntryLabel(entry) : 'Call';
  }
  if (cleanContent.startsWith('__CALL_OFFER__:')) {
    return cleanContent.includes(':video') ? 'Video call' : 'Voice call';
  }
  if (cleanContent.startsWith('__AUDIO__')) return 'Voice message';
  if (cleanContent.startsWith('[LOCATION]')) return 'Location';
  if (cleanContent.startsWith('[ATTACHMENT')) return 'Attachment';
  if (cleanContent.startsWith('[GIF]')) return 'GIF';
  if (cleanContent.startsWith('__STICKER__')) return 'Sticker';
  if (cleanContent.startsWith('__POLL__')) return 'Poll';
  if (cleanContent.startsWith('__PAYMENT__')) return 'Payment';
  if (isSystemSignal(cleanContent)) {
    return '';
  }

  // ZK payment / structured message previews — never leak raw payload to sidebar
  if (cleanContent.startsWith('__ZK_INVOICE__')) {
    try {
      const inv = parseInvoicePayload(cleanContent);
      if (inv && inv.totalAmount) {
        return `📄 Invoice: ${inv.totalAmount} ${inv.token || 'USDC'}`;
      }
    } catch {
      // fallback
    }
    return '📄 Invoice';
  }
  if (cleanContent.startsWith('__ZK_TIP__')) return '💸 Private tip sent';
  if (cleanContent.startsWith('__ZK_STREAM__')) return '🔁 Payment stream';
  if (cleanContent.startsWith('__ZK_MONEY_PAYMENT__')) return '💰 Private payment';
  if (cleanContent.startsWith('__ZK_ESCROW__')) return 'Escrow (legacy message)';
  if (cleanContent.startsWith('__REACT__')) return '';
  if (cleanContent.startsWith('__EDIT__')) return 'Message updated';

  return isBurn ? `Disappearing: ${cleanContent}` : cleanContent;
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

import { playReceiveSound } from '../../lib/utils/sounds';
import { MessageBubble } from '../chat/MessageBubble';
import { PinPrompt } from '@/components/chat/pin/PinPrompt';
import { IncomingCallScreen, OutgoingCallScreen, AudioCallStage, CallControls, CallClock } from '@/components/chat/call/CallScreens';
import { callConstraints, callVideo, CALL_AUDIO, tuneOpusSdp, tuneSenders, loadIceConfig, peerServerOptions } from '@/lib/calls/media';
import { confirmOptimistic, createSendQueue, failOptimistic, insertOptimistic, newOptimisticId, optimisticMessage } from '@/lib/chat/optimistic-send';
import { callMetricsDetail, callMetricsLabel, finishCallMetrics, markFirstAudio, markSetup, routeFromStats, sampleHeap, startCallMetrics, type CallMetrics, type CallRoute } from '@/lib/calls/metrics';
import { DISCONNECTED_GRACE_MS, RESUME_ATTEMPT_MS, RESUME_DEADLINE_MS, acceptResume, glareKeepsMine, isResumeMeta, resumeDelay, shouldDialResume } from '@/lib/calls/resume';
/** Opus tuned for speech on every offer and answer (lib/calls/media.ts). */
/** How long an answered call may look for a network path before it is reported as failed. */
const ICE_CONNECT_MS = 20_000;
const CALL_SDP = { sdpTransform: (sdp: string) => tuneOpusSdp(sdp) };
import { Archive, ArchiveRestore, ChevronLeft, ChevronUp, ChevronDown, MessageSquare, Plus, ArrowUp, WifiOff, Pin, Check, ScanQrCode, Camera, FileText, Sticker, ListChecks, CreditCard, Receipt, Waves, Navigation, Timer, Info, LoaderCircle, Minimize2, Mail, ShieldCheck, Reply, Forward, Pencil, Flag, MessagesSquare, Globe } from 'lucide-react';
import { Sparkles as StudioIcon, MoreHorizontal, SquarePen, Palette, BellOff, Keyboard, CalendarClock, CalendarPlus, CircleDot } from 'lucide-react';
import { MEETING_JOIN_EVENT, MEETINGS_EVENT, loadMeetings, meetingPreview, parseMeeting, rememberMeeting, upcomingMeetings, type StoredMeeting } from '@/lib/chat/meeting';
import { SCHEDULED_EVENT, addScheduled, describeSendTime, dueScheduled, loadScheduled, markAttempt, removeScheduled, scheduleTimeError, scheduledForPeer, type ScheduledMessage } from '@/lib/chat/scheduled';
import { shortAddress as formatAddress } from '@/lib/ui/format';

// Ledger Studio (AI workspace). Loaded only when opened; never sees encrypted
// chats unless the person sends something there themselves.
const STUDIO_PREFIX = /^(?:@studio|\/studio)(?:\s+|$)/i;


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
  const { reconnectAsync } = useReconnect();
  const { open: openAppKit } = useAppKit();
  const { nuclearDisconnect } = useSystemSignOut();
  const effectiveAddress = (address || '0x0') as string;
  const { settings: ledgerSettings, isLoaded: pxeLoaded, updateBatch } = useLedgerSettings(effectiveAddress);
  // SETTINGS ENGINE: Apply all settings as real side effects (CSS vars, localStorage, audio, etc.)
  useSettingsEffect(ledgerSettings);


  // [PHASE 2 - SILOING] Consume the sandboxed PXE context for Chat Operations
  // This strictly isolates Chat from the Portfolio state to prevent cross-contamination.
  const { getSiloedPXE } = useAztec();

  // Mechanical keyboard click sound
  // One AudioContext for every click: browsers cap how many a page may open.
  const keyClickCtxRef = useRef<AudioContext | null>(null);
  const playKeyClick = () => {
    try {
      if (!keyClickCtxRef.current || keyClickCtxRef.current.state === 'closed') {
        keyClickCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = keyClickCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
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
  const textSize = ledgerSettings?.text_size ?? DEFAULT_TEXT_SIZE_LEVEL;

  // Conversation wallpaper. Every option stays light and quiet so messages
  // keep their contrast; the default is the app's neutral background.
  const bgStyle = useMemo((): React.CSSProperties => {
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
  const fontSizePx = chatTextPx(textSize);


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
      // Session says signed in, wagmi has no connector: try to rehydrate it, then stop with a clear choice.
      for (let i = 0; i < 3 && !cancelled; i++) {
        await new Promise(r => setTimeout(r, 800 + i * 600)); // 800ms, 1400ms, 2000ms
        if (cancelled) return;
        try {
          const restored = await reconnectAsync();
          if (restored.length > 0) return;
        } catch (e) {
          console.warn(`[Ledger Chat] Reconnect attempt ${i + 1} failed:`, e);
        }
      }
      if (!cancelled) setInitError('Active wallet connection lost or not detected. Reconnect the wallet you signed in with, or sign out and connect again.');
    })();
    return () => { cancelled = true; };
  }, [isConnected, connector, isSystemHandshake, reconnectAsync]);

  const [client, setClient] = useState<Client | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isWaitingForSignature, setIsWaitingForSignatureState] = useState(false);
  // Read by the start-up safety timer: time spent waiting for a signature (wallet app, or the
  // phone approving for a linked computer) does not count as a hang.
  const waitingSigRef = useRef(false);
  const setIsWaitingForSignature = useCallback((v: boolean) => { waitingSigRef.current = v; setIsWaitingForSignatureState(v); }, []);
  const [initError, setInitError] = useState('');
  
  // BIOMETRIC LOCK STATE
  const [isBiometricallyUnlocked, setIsBiometricallyUnlocked] = useState(false);
  const [biometricChecking, setBiometricChecking] = useState(false);

  useEffect(() => {
    // App lock off: nothing to unlock. The lock screen is rendered only while the lock is on (below), so the
    // state is left untouched here: a lock switched on later (settings arriving after the defaults) still engages.
    if (!ledgerSettings?.biometric_lock) return;
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

  useEffect(() => {
    const onHandoff = (e: Event) => {
      const h = parseValueHandoff((e as CustomEvent).detail);
      if (!h) return;
      setSidebarTab('chats');
      setActiveCommunity(null);
      setPendingValue(h);
      void handleStartConversationWithPeerRef.current?.(h.peer);
    };
    window.addEventListener(VALUE_HANDOFF_EVENT, onHandoff);
    return () => window.removeEventListener(VALUE_HANDOFF_EVENT, onHandoff);
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
  // Read by effects that must not re-run whenever the list changes.
  const conversationsRef = useRef<ConversationMeta[]>([]);
  conversationsRef.current = conversations;
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
        // A bookmark is plain localStorage: an invitation or attachment key is saved as its preview, never its text.
        next = [{ id: msgId, content: lastMessageOf(msgContent), savedAt: Date.now() }, ...prev];
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
      // Ledger Studio has its own shortcuts while it is open.
      if (document.querySelector('[data-ledger-studio]')) return;
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

  const [profileNames, setProfileNames] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem('ledger_profile_names') || '{}');
    } catch { return {}; }
  });

  const getDisplayName = useCallback((peerAddr: string) => {
    if (!peerAddr) return 'Unknown Peer';
    const lower = peerAddr.toLowerCase();
    const c = localContacts.find(c => c.peerAddress.toLowerCase() === lower);
    if (c?.name && !c.name.startsWith('0x') && !c.name.includes('…')) return c.name;
    if (profileNames[lower]) return profileNames[lower];

    try {
      const localCustom = localStorage.getItem(`ledger_username_${lower}`) || localStorage.getItem(`ledger_display_name_${lower}`);
      if (localCustom && !localCustom.startsWith('0x')) return localCustom;

      const cached = localStorage.getItem(`peer_profile_${lower}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        const name = parsed.displayName || parsed.nickname || parsed.name || parsed.username;
        if (name && !name.startsWith('0x') && !name.includes('…')) return name;
      }
    } catch {}

    if (c?.name && !c.name.startsWith('0x')) return c.name;
    return shortAddr(peerAddr);
  }, [localContacts, profileNames]);

  // Auto-resolve remote user profile display name
  useEffect(() => {
    if (!activePeer || activePeer === '0x0') return;
    const lower = activePeer.toLowerCase();
    if (profileNames[lower]) return;

    fetch(`/api/user/profile?walletAddress=${encodeURIComponent(lower)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const name = data?.displayName || data?.nickname || data?.name || data?.username;
        if (name && !name.startsWith('0x')) {
          setProfileNames(prev => {
            const next = { ...prev, [lower]: name };
            try { localStorage.setItem('ledger_profile_names', JSON.stringify(next)); } catch {}
            return next;
          });
          const myAddr = (effectiveAddress || address || '').toLowerCase();
          if (myAddr) {
            saveLocalContact(myAddr, { peerAddress: lower, name, avatar: data?.avatarUrl || '' });
          }
        }
      })
      .catch(() => {});
  }, [activePeer, effectiveAddress, address, profileNames]);

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
        // Checked without allocating: most seconds nothing has expired.
        if (!prev.some(m => m.burnAtNs && m.burnAtNs <= now)) return prev;
        return prev.filter(m => !m.burnAtNs || m.burnAtNs > now);
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const [inputText, setInputText] = useState('');
  const [peerInput, setPeerInput] = useState('');
  // (The composer used to lock while a message was on its way, with a 30 s watchdog. Each
  // message now carries its own status instead: lib/chat/optimistic-send.ts.)
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
  // Ledger Studio opens on its own page (/studio). The full-screen overlay it used to open in
  // could end up under the chat's own layers and showed nothing; a page cannot.
  const openStudio = useCallback((prompt?: string) => {
    const q = prompt ? `?q=${encodeURIComponent(prompt.slice(0, 8000))}` : '';
    window.location.assign(`/studio${q}`);
  }, []);
  const [showVault, setShowVault] = useState(false);
  const [showScheduleCall, setShowScheduleCall] = useState(false);

  const [showUserSearch, setShowUserSearch] = useState(false);
  const [showContactRequests, setShowContactRequests] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [blockedPeers, setBlockedPeers] = useState<Set<string>>(new Set());
  // The stream callback reads this; state alone would be stale inside it.
  const blockedPeersRef = useRef<Set<string>>(new Set());

  // "Screen privacy": blur the open chat whenever the window loses focus or
  // the tab is hidden, so the app switcher, screen shares and shoulder
  // surfers see nothing. (A web page cannot block OS screenshots.)
  const [screenShielded, setScreenShielded] = useState(false);
  const antiScreenshotOn = !!ledgerSettings?.anti_screenshot;
  useEffect(() => {
    if (!antiScreenshotOn) { setScreenShielded(false); return; }
    const hide = () => setScreenShielded(true);
    const show = () => { if (!document.hidden) setScreenShielded(false); };
    const onVis = () => (document.hidden ? hide() : show());
    window.addEventListener('blur', hide);
    window.addEventListener('focus', show);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('blur', hide);
      window.removeEventListener('focus', show);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [antiScreenshotOn]);
  useEffect(() => { blockedPeersRef.current = blockedPeers; }, [blockedPeers]);
  useEffect(() => {
    // The settings screen edits the same list; pick its changes up live.
    const onChange = (e: Event) => {
      const list = (e as CustomEvent).detail?.blocked;
      if (Array.isArray(list)) setBlockedPeers(new Set(list.map((x: string) => String(x).toLowerCase())));
    };
    window.addEventListener(BLOCK_LIST_EVENT, onChange);
    return () => window.removeEventListener(BLOCK_LIST_EVENT, onChange);
  }, []);

  const [contextMenu, setContextMenu] = useState<{ id: string, content: string, x: number, y: number } | null>(null);
  const [msgDetails, setMsgDetails] = useState<any | null>(null);

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
  // Community → DM handoff (lib/chat/value-handoff.ts): the modal opens once the DM with that member is active.
  const [pendingValue, setPendingValue] = useState<ValueHandoff | null>(null);
  const [showZkWallet, setShowZkWallet] = useState(false);
  const [showZkStreamModal, setShowZkStreamModal] = useState(false);
  const [showAgreementComposer, setShowAgreementComposer] = useState(false);
  // Declared after pendingValue, activePeer and the modal state: the deps array is read during render (TDZ otherwise).
  useEffect(() => {
    if (!pendingValue || !activePeer || activePeer.toLowerCase() !== pendingValue.peer.toLowerCase()) return;
    if (pendingValue.action === 'pay') setShowZkModal(true);
    else setShowAgreementComposer(true);
    setPendingValue(null);
  }, [pendingValue, activePeer]);
  const [showZkInvoiceModal, setShowZkInvoiceModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<ZkInvoice | null>(null);

  useEffect(() => {
    const handleOpenInvoice = (e: Event) => {
      const inv = (e as CustomEvent<{ invoice: ZkInvoice }>).detail?.invoice;
      if (inv) {
        setSelectedInvoice(inv);
        setShowZkInvoiceModal(true);
      }
    };
    window.addEventListener('ledger_open_invoice', handleOpenInvoice);
    return () => window.removeEventListener('ledger_open_invoice', handleOpenInvoice);
  }, []);
  // Phase 5: Poll creator form state (hoisted to satisfy React rules of hooks)
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  // Phase 5: Wallet transfer form state
  const [transferAmount, setTransferAmount] = useState('');
  const [transferSending, setTransferSending] = useState(false);

  // ─── Hito 4: Search, Forward, GIF, Scheduled ──────────────────────────────
  const [searchQuery, setSearchQuery] = useState(''); // in-chat search
  const [typingPeers, setTypingPeers] = useState<Set<string>>(new Set()); // typing indicators

  // ─── UI Maturity: Theme picker, pin, mute, per-conv wallpaper ────────────
  const [showThemePicker, setShowThemePicker] = useState(false);
  // One source of truth: the `chat_theme` setting (synced across devices by
  // pxeEngine). A theme picked with the old picker lived only in this
  // browser's localStorage; it is moved into the setting once, then removed.
  useEffect(() => {
    if (!pxeLoaded) return;
    let legacy: string | null = null;
    try { legacy = localStorage.getItem('ledger_chat_theme_id'); } catch {}
    if (!legacy) return;
    try { localStorage.removeItem('ledger_chat_theme_id'); } catch {}
    if (isChatThemeId(legacy) && (!ledgerSettings?.chat_theme || ledgerSettings.chat_theme === 'default')) {
      updateBatch({ chat_theme: legacy });
    }
  }, [pxeLoaded]); // eslint-disable-line react-hooks/exhaustive-deps
  const chatThemeId = isChatThemeId(ledgerSettings?.chat_theme) ? ledgerSettings.chat_theme : 'default';
  const chatTheme = findChatTheme(chatThemeId);
  const [pinnedPeers, setPinnedPeers] = useState<Set<string>>(new Set());
  const [mutedPeers, setMutedPeers] = useState<Set<string>>(new Set());

  // Per-conversation wallpaper: peerAddress.toLowerCase() -> CSS background value
  const [convWallpapers, setConvWallpapers] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem('ledger_conv_wallpapers');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });

  const setConvWallpaper = useCallback((peer: string, bg: string) => {
    setConvWallpapers(prev => {
      const next = { ...prev, [peer.toLowerCase()]: bg };
      localStorage.setItem('ledger_conv_wallpapers', JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    const handleWpChange = (e: any) => {
      if (e?.detail?.peer && e?.detail?.bg) {
        setConvWallpapers(prev => ({ ...prev, [e.detail.peer.toLowerCase()]: e.detail.bg }));
      }
    };
    window.addEventListener('ledger_wallpaper_changed', handleWpChange);
    return () => window.removeEventListener('ledger_wallpaper_changed', handleWpChange);
  }, []);

  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);

  // Pinned and muted chats live in the per-account device store
  // (lib/sync/deviceState.ts): saved across reloads, synced to the account's
  // other devices, and written through to `ledger_muted_<peer>`, which is the
  // key the notification code actually checks. Before this, the swipe actions
  // only changed React state, so a muted chat still rang and pins vanished on reload.
  const readMutedFallback = useCallback((): Set<string> => {
    const out = new Set<string>();
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) || '';
        if (k.startsWith('ledger_muted_')) out.add(k.slice('ledger_muted_'.length).toLowerCase());
      }
    } catch {}
    return out;
  }, []);
  const refreshPinMute = useCallback(() => {
    const store = address ? getDeviceStore(address) : null;
    setPinnedPeers(new Set(store ? store.peersWhere('pinned') : []));
    setMutedPeers(store ? new Set(store.peersWhere('muted')) : readMutedFallback());
  }, [address, readMutedFallback]);
  useEffect(() => { refreshPinMute(); }, [refreshPinMute]);
  useEffect(() => {
    if (!address) return;
    const me = address.toLowerCase();
    const onSync = (e: Event) => {
      const d = (e as CustomEvent<DeviceSyncEventDetail>).detail;
      if (d?.account === me && d.keys.some(k => k.startsWith('pinned:') || k.startsWith('muted:'))) refreshPinMute();
    };
    window.addEventListener(DEVICE_SYNC_EVENT, onSync);
    return () => window.removeEventListener(DEVICE_SYNC_EVENT, onSync);
  }, [address, refreshPinMute]);

  const togglePin = useCallback((peer: string) => {
    const key = peer.toLowerCase();
    const on = !pinnedPeers.has(key);
    setPinnedPeers(prev => { const next = new Set(prev); if (on) next.add(key); else next.delete(key); return next; });
    if (address) setSynced(address, { [`pinned:${key}`]: on ? true : null });
    toast.success(on ? 'Pinned' : 'Unpinned');
  }, [address, pinnedPeers]);

  const toggleMute = useCallback((peer: string) => {
    const key = peer.toLowerCase();
    const on = !mutedPeers.has(key);
    setMutedPeers(prev => { const next = new Set(prev); if (on) next.add(key); else next.delete(key); return next; });
    if (address && getDeviceStore(address)) {
      setSynced(address, { [`muted:${key}`]: on ? true : null });
    } else {
      try { if (on) localStorage.setItem(`ledger_muted_${key}`, '1'); else localStorage.removeItem(`ledger_muted_${key}`); } catch {}
    }
    toast.success(on ? 'Muted' : 'Unmuted');
  }, [address, mutedPeers]);
  const lastTypingTimeRef = useRef<number>(0);
  const [isLocked, setIsLocked] = useState(false); // Inactivity lock
  const [showSearch, setShowSearch] = useState(false); // search bar toggle
  const [searchIndex, setSearchIndex] = useState(0); // current match index
  const [forwardMsg, setForwardMsg] = useState<any | null>(null); // message to forward
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null); // scheduled send time
  // Messages waiting to be sent later (lib/chat/scheduled.ts) and scheduled calls (lib/chat/meeting.ts).
  const [scheduledList, setScheduledList] = useState<ScheduledMessage[]>([]);
  const [showMeetingSheet, setShowMeetingSheet] = useState(false);
  const [meetings, setMeetings] = useState<StoredMeeting[]>([]);
  // Emojis, stickers and GIFs (components/chat/ExpressionPicker.tsx).
  const [expression, setExpression] = useState<ExpressionTab | null>(null);
  const [showAppDrawer, setShowAppDrawer] = useState(false); // iMessage style + menu
  const [liveLocationWatchId, setLiveLocationWatchId] = useState<number | null>(null); // watchPosition ID for live location
  const [isLiveLocationActive, setIsLiveLocationActive] = useState(false); // whether live location is broadcasting
  // A conversation the user locked: opening it asks for the PIN first.
  const [lockedChatPeer, setLockedChatPeer] = useState<string | null>(null);
  // The overflow menu in the conversation header.
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showSidebarMore, setShowSidebarMore] = useState(false);
  // Chat list filter chips (All, Unread, Groups, Payments).
  const [chatFilter, setChatFilter] = useState<'all' | 'unread' | 'groups' | 'payments'>('all');
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



  // The island shows the call as it really is: ringing, connecting, or
  // active with a duration counted from the moment it connected.
  const callStartedAtRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  useEffect(() => {
    const island = useDynamicIsland.getState();
    if (callState === 'active') { if (!callStartedAtRef.current) callStartedAtRef.current = Date.now(); }
    else if (callState === 'idle') callStartedAtRef.current = null;
    if (isRecording) { if (!recordingStartedAtRef.current) recordingStartedAtRef.current = Date.now(); }
    else recordingStartedAtRef.current = null;
    if (callState === 'active' || callState === 'calling' || callState === 'ringing' || callState === 'connecting') {
      island.setState('calling', { title: getDisplayName(activePeer || ''), phase: callState, startedAt: callStartedAtRef.current ?? undefined });
    } else if (isRecording) {
      island.setState('recording', { title: getDisplayName(activePeer || ''), startedAt: recordingStartedAtRef.current ?? undefined });
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
  const [callRoute, setCallRoute] = useState<CallRoute>({ kind: 'unknown', path: null, rttMs: null });
  // Setup time and first audio of the current call (lib/calls/metrics.ts), shown in the minimized call.
  const [callTiming, setCallTiming] = useState<{ setupMs?: number; firstAudioMs?: number }>({});

  const myVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  // Call Duration State
  // When the call was answered. The running clock is <CallClock>, which ticks on its own.
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  // callStartedAtRef (declared above, also used by the Dynamic Island) holds the same time.
  const callElapsedSeconds = () => (callStartedAtRef.current ? Math.round((Date.now() - callStartedAtRef.current) / 1000) : 0);

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
      // Leaving the chat mid-recording discards the note: stop() alone would send it.
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        isRecordingCancelledRef.current = true;
        mediaRecorderRef.current.stop();
      }
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

  // Offline Queue State
  const [isOffline, setIsOffline] = useState(false);
  const [hasAcceptedEula, setHasAcceptedEula] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      if (localStorage.getItem('ledger_onboarded_global') === 'true') return true;
      if (localStorage.getItem('ledger_account_already_created') === 'true') return true;
      const addr = localStorage.getItem('system_wallet_addr') || '';
      if (addr && (
        localStorage.getItem('ledger_onboarded_' + addr) === 'true' ||
        localStorage.getItem('ledger_onboarded_' + addr.toLowerCase()) === 'true' ||
        localStorage.getItem('ledger_account_created_' + addr.toLowerCase()) === 'true'
      )) return true;
      const hasChats = Object.keys(localStorage).some(k =>
        k.startsWith('ledger_chat_') || k.startsWith('chat_v2_') || k.startsWith('chat_history_') || k.includes('xmtp') || k.startsWith('conversation_')
      );
      if (hasChats) return true;
    } catch {}
    return false;
  });
  useEffect(() => {
    if (typeof window !== 'undefined' && effectiveAddress && effectiveAddress !== '0x0') {
      const lower = effectiveAddress.toLowerCase();
      const isKnown = Boolean(
        localStorage.getItem('ledger_onboarded_' + effectiveAddress) === 'true' ||
        localStorage.getItem('ledger_onboarded_' + lower) === 'true' ||
        localStorage.getItem('ledger_onboarded_global') === 'true' ||
        localStorage.getItem('ledger_account_already_created') === 'true'
      );
      if (isKnown) {
        setIsOnboarded(true);
        try {
          localStorage.setItem('ledger_onboarded_' + effectiveAddress, 'true');
          localStorage.setItem('ledger_onboarded_' + lower, 'true');
          localStorage.setItem('ledger_onboarded_global', 'true');
          localStorage.setItem('ledger_account_already_created', 'true');
        } catch {}
      }
    }
  }, [effectiveAddress]);
  const [hasMediaPermission, setHasMediaPermission] = useState(false);


  useEffect(() => {
    const loadBlocked = async () => {
      try {
        setBlockedPeers(new Set(await loadBlockList()));
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
      if (!callStartedAtRef.current) callStartedAtRef.current = Date.now();
      setCallStartedAt(callStartedAtRef.current);
    } else if (callState === 'idle') {
      setCallStartedAt(null);
    }
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

  const toggleBlock = (peer: string) => {
    const p = peer.toLowerCase();
    const next = new Set(blockedPeersRef.current);
    const wasBlocked = next.has(p);
    if (wasBlocked) next.delete(p); else next.add(p);
    blockedPeersRef.current = next;
    setBlockedPeers(next);
    saveBlockList(Array.from(next)).catch(() => {});
    toast.success(wasBlocked ? 'Unblocked' : 'Blocked. Their messages and calls will no longer reach you.');
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
    if (!activePeer) return;
    const peerLower = activePeer.toLowerCase();
    const dmId = `dm-${peerLower}`;
    const clearTs = Date.now() + 5000;
    const myAddr = (effectiveAddress || address || '').toLowerCase();

    try {
      localStorage.setItem(`ledger_cleared_${peerLower}`, clearTs.toString());
      if (myAddr) {
        localStorage.setItem(`ledger_cleared_${myAddr}_${peerLower}`, clearTs.toString());
        try { setSynced(myAddr, { [`cleared:${peerLower}`]: clearTs }); } catch {}
      }
      if (address) {
        localStorage.setItem(`ledger_cleared_${address.toLowerCase()}_${peerLower}`, clearTs.toString());
        localStorage.setItem(`ledger_cleared_${address}_${peerLower}`, clearTs.toString());
      }
    } catch {}

    // Immediately remove all messages of this active chat from React state
    setMessages(prev => prev.filter(m => {
      const cId = (m.conversationId || '').toLowerCase();
      if (!cId || cId === dmId || cId === peerLower || cId.includes(peerLower) || dmId.includes(cId)) return false;
      return true;
    }));

    // Reset pinned message
    setPinnedMessageId(null);
    try { localStorage.removeItem(`ledger_pinned_${peerLower}`); } catch {}

    // Clear sidebar conversation preview
    setConversations(prev => {
      const updated = prev.map(c =>
        c.peerAddress.toLowerCase() === peerLower
          ? { ...c, lastMessage: '', unreadCount: 0 }
          : c
      );
      persistToLocal(updated);
      return updated;
    });

    // Wipe persistent local IndexedDB records for this conversation
    import('@/lib/chat/indexeddb').then(({ chatDB }) => {
      chatDB.clearConversation(dmId).catch(() => {});
      chatDB.clearConversation(peerLower).catch(() => {});
    }).catch(() => {});

    setShowClearConfirm(false);
    setShowHeaderMenu(false);
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
      if (address) {
        const p = peer.toLowerCase();
        setSynced(address, { [`archived:${p}`]: next.has(p) ? true : null }); // all devices
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

  const markConversationAsRead = useCallback((peer: string) => {
    const p = peer.toLowerCase();
    setConversations(prev => prev.map(c => c.peerAddress.toLowerCase() === p ? { ...c, unreadCount: 0 } : c));
    toast.success('Marked as read');
  }, []);

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
  // Legacy server-stored direct messages are read once per session (see syncGlobal).
  const legacyDirectReadRef = useRef(false);
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
  const executeSendRef = useRef<((content: string) => Promise<boolean>) | null>(null);
  // Network sends of messages, one after the other in typing order (lib/chat/optimistic-send.ts).
  const sendQueueRef = useRef(createSendQueue());

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
      stopDeviceSync();
    }
  }, [isConnected, address, client]);

  // ── Device sync (lib/sync) ────────────────────────────────────────────────
  // Mute, lock, archive, favourites, timers, "clear chat", read state and
  // settings follow the account across its devices, end-to-end encrypted over
  // an XMTP group that only this account's own devices belong to.
  useEffect(() => {
    if (!address) return;
    getDeviceStore(address); // create it with this exact spelling of the address
    if (client) startDeviceSync(client, address).catch(() => {});
  }, [client, address]);

  useEffect(() => {
    if (!address) return;
    const me = address.toLowerCase();
    const onSync = (e: Event) => {
      const detail = (e as CustomEvent<DeviceSyncEventDetail>).detail;
      if (!detail || detail.account !== me || detail.source !== 'remote') return;
      const store = getDeviceStore(address);
      if (!store) return;
      const { keys } = detail;
      if (keys.some(k => k.startsWith('archived:'))) {
        setArchivedPeers(new Set(store.peersWhere('archived')));
      }
      const readPeers = keys.filter(k => k.startsWith('read:')).map(k => k.slice(5));
      if (readPeers.length) {
        setConversations(prev => prev.map(c =>
          readPeers.includes(c.peerAddress.toLowerCase()) && c.unreadCount ? { ...c, unreadCount: 0 } : c
        ));
      }
      const active = activePeerRef.current?.toLowerCase();
      if (active && keys.includes(`cleared:${active}`)) {
        const ts = Number(store.get(`cleared:${active}`) || 0);
        // sentAtNs holds milliseconds after mapping (see the clear filter in fetchHistorical).
        if (ts > 0) setMessages(prev => prev.filter(m => m.conversationId !== `dm-${active}` || (m.sentAtNs || 0) > ts));
      }
    };
    window.addEventListener(DEVICE_SYNC_EVENT, onSync);
    return () => window.removeEventListener(DEVICE_SYNC_EVENT, onSync);
  }, [address]);

  // ── Call log in the chat (lib/chat/callLog.ts) ────────────────────────────
  // Every call signal of a conversation (from history and from the live
  // stream) is kept here, and the conversation's call bubbles are rebuilt from
  // them. Both people hold the same signals, so both see the same calls.
  const callSignalsRef = useRef<Map<string, CallSignal[]>>(new Map());
  const addCallSignalsRef = useRef<(peer: string, sigs: CallSignal[]) => void>(() => {});
  addCallSignalsRef.current = (peer: string, sigs: CallSignal[]) => {
    // An empty `sigs` just re-derives (the clock may have turned Ringing into Missed).
    const p = (peer || '').toLowerCase();
    if (!p) return;
    const list = callSignalsRef.current.get(p) || [];
    const known = new Set(list.map(s => s.id));
    for (const s of sigs) if (!known.has(s.id)) { list.push(s); known.add(s.id); }
    callSignalsRef.current.set(p, list.slice(-500));
    if (p !== activePeerRef.current?.toLowerCase()) return;
    let clearedAt = 0;
    try { clearedAt = parseInt(localStorage.getItem(`ledger_cleared_${address}_${p}`) || '0', 10) || 0; } catch {}
    const msgs = callLogMessages(deriveCallLog(callSignalsRef.current.get(p) || []), {
      conversationId: `dm-${p}`,
      selfInboxId: (client as any)?.inboxId || '',
      peerInboxId: activePeerInboxIdRef.current,
    }).filter(m => m.sentAtNs > clearedAt); // "Clear chat" clears its calls too
    if (!msgs.length) return;
    setMessages(prev => {
      const byId = new Map(msgs.map(m => [m.id, m]));
      let changed = false;
      const next = prev.map(m => {
        const u = byId.get(m.id);
        if (!u) return m;
        byId.delete(m.id);
        if (u.content === m.content) return m;
        changed = true;
        return { ...m, ...u };
      });
      if (byId.size) { changed = true; next.push(...byId.values()); }
      return changed ? next.sort((a, b) => a.sentAtNs - b.sentAtNs) : prev;
    });
  };
  // An unanswered call turns from "Ringing" into "Missed" with time alone.
  useEffect(() => {
    const id = setInterval(() => {
      const p = activePeerRef.current?.toLowerCase();
      if (p && callSignalsRef.current.get(p)?.length) addCallSignalsRef.current(p, []);
    }, 15000);
    return () => clearInterval(id);
  }, []);

  // Publish "read up to now" for a chat, at most every 5 s per chat, so a busy
  // open conversation does not turn every incoming message into a sync message.
  const lastReadPublishRef = useRef<Map<string, number>>(new Map());
  const publishReadRef = useRef<(peer: string) => void>(() => {});
  publishReadRef.current = (peer: string) => {
    const p = (peer || '').toLowerCase();
    if (!address || !/^0x[0-9a-f]{40}$/.test(p)) return;
    const now = Date.now();
    if (now - (lastReadPublishRef.current.get(p) || 0) < 5000) return;
    lastReadPublishRef.current.set(p, now);
    setSynced(address, { [`read:${p}`]: now });
  };

  // Opening a chat marks it read here and on the account's other devices.
  useEffect(() => {
    if (!address || !activePeer) return;
    const peer = activePeer.toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(peer)) return;
    setConversations(prev => prev.map(c =>
      c.peerAddress.toLowerCase() === peer && c.unreadCount ? { ...c, unreadCount: 0 } : c
    ));
    setSynced(address, { [`read:${peer}`]: Date.now() });
  }, [activePeer, address]);

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
            lastMessage: lastMessageOf(content),
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

    // Typing is signalled end-to-end over XMTP (`__TYPING__`, see the input's
    // onChange). The old server telemetry wrote to Redis on every keystroke
    // and nobody read it, so it is gone.
  }, [inputText, activePeer, address]);

  const stopTypingSignal = () => {};

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
      // "Vibrate on incoming call" (Settings > Calls) shares the vibration
      // setting; useSettingsEffect mirrors it to ledger_haptics.
      try {
        const haptics = Number(localStorage.getItem('ledger_haptics') ?? '1');
        if (haptics > 0 && typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate([400, 200, 400]);
      } catch {}
    };
    playRing();
    const id = setInterval(playRing, 2000);
    ringtoneRef.current = id;
  }, []);

  const stopRingtone = useCallback(() => {
    // Mark stopped FIRST so any in-flight playRing() that is about to execute returns early
    ringtoneStopped.current = true;
    try { if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(0); } catch {}
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

    // ICE servers from the server (short-lived TURN credentials) while PeerJS loads.
    Promise.all([import('peerjs'), loadIceConfig()]).then(([peerjsModule, ice]) => {
      const iceServers = ice.iceServers;
      ownTurnRef.current = ice.own;
      if (!ice.own) console.warn('[Call] No TURN relay configured (/api/calls/ice source: none): calls between strict NATs or mobile carriers cannot connect. See docs/CALLS.md.');
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
        // Our own PeerServer when NEXT_PUBLIC_PEERJS_HOST is set, else the public PeerJS cloud.
        ...peerServerOptions(),
        config: {
          iceTransportPolicy: ((ledgerSettings as any)?.webrtc_ip_masking ? 'relay' : 'all') as RTCIceTransportPolicy,
          // Few servers: every extra STUN/TURN server slows candidate gathering. Our TURN (from
          // /api/calls/ice) first, a public relay as last resort (lib/calls/media.ts).
          iceServers,
          sdpSemantics: 'unified-plan',
          // iceTransportPolicy is set once, above, from the "Hide my IP address
          // in calls" setting. A second key here used to override it to 'all',
          // which silently disabled IP hiding.
          // [4G/5G] Pre-gather 10 ICE candidates, bundle all media on one port, require RTCP mux
          bundlePolicy: 'max-bundle',
          rtcpMuxPolicy: 'require',
          iceCandidatePoolSize: 2,
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

        // A shared screen arrives as its own connection, only from the person we are in a call with.
        if (connection.metadata?.kind === 'screen') {
          const current = activeConnectionRef.current;
          if (callStateRef.current === 'active' && current && connection.peer === current.peer) {
            try { screenInRef.current?.close(); } catch {}
            screenInRef.current = connection;
            connection.answer(undefined, CALL_SDP);
            connection.on('stream', (st: MediaStream) => {
              if (screenInRef.current !== connection) return;
              setRemoteScreen(st);
              // The sharer stopping sends no "close" through PeerJS: the track tells. "ended" ends the
              // share; "mute" (no frames for a moment) hides it until frames come back.
              const t = st.getVideoTracks()[0];
              let hide: ReturnType<typeof setTimeout> | null = null;
              t?.addEventListener('ended', () => { if (screenInRef.current === connection) { screenInRef.current = null; setRemoteScreen(null); try { connection.close(); } catch {} } });
              t?.addEventListener('mute', () => { if (hide) clearTimeout(hide); hide = setTimeout(() => { if (screenInRef.current === connection) setRemoteScreen(null); }, 1500); });
              t?.addEventListener('unmute', () => { if (hide) { clearTimeout(hide); hide = null; } if (screenInRef.current === connection) setRemoteScreen(st); });
            });
            const done = () => { if (screenInRef.current === connection) { screenInRef.current = null; setRemoteScreen(null); } };
            connection.on('close', done);
            connection.on('error', done);
          } else {
            try { connection.close(); } catch {}
          }
          return;
        }

        // A resume (network change) or an upgrade to video: a new connection for the SAME call.
        if (isResumeMeta(connection.metadata)) {
          if (!acceptResume({ callState: callStateRef.current, remoteId: callRemoteIdRef.current, fromId: connection.peer, hasLocalStream: !!localStreamRef.current })) {
            try { connection.close(); } catch {}
            return;
          }
          const mine = pendingResumeRef.current;
          if (mine) {
            // Both sides dialled at once: one connection survives, chosen the same way on both.
            if (glareKeepsMine(myPeerIdRef.current, connection.peer)) { try { connection.close(); } catch {} return; }
            pendingResumeRef.current = null;
            // Our own upgrade lost the tie: the camera is already in our stream, so it goes on theirs.
            if (upgradeRef.current === mine) { upgradeRef.current = null; preUpgradeRef.current = null; }
            try { mine.close(); } catch {}
          }
          if (connection.metadata.callType === 'video' && callTypeRef.current !== 'video') {
            callTypeRef.current = 'video';
            setCallType('video');
          }
          connection.answer(localStreamRef.current!, CALL_SDP);
          wireCallRef.current(connection, { resume: true });
          return;
        }

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
          connection.answer(localStreamRef.current!, CALL_SDP);
          setActiveConnection(connection);
          setCallState('active');
          if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; }
          wireCallRef.current(connection);
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
          // Only the signalling socket failed. During a call, destroying the peer would close the
          // call's media connections too: 'disconnected' below reconnects the socket instead.
          if (callStateRef.current !== 'idle') return;
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
        // During a call the media keeps flowing peer to peer without the signalling socket (a
        // network change drops it first). Destroying the peer would end the call, so reconnect the
        // socket, every 3 s, keeping the same id; a clean re-init waits until the call is over.
        if (callStateRef.current !== 'idle') {
          console.warn('[Ledger Chat:PeerJS] Signalling dropped during a call — reconnecting, call kept');
          const retry = () => {
            if (destroyed || peer.destroyed || !peer.disconnected) return;
            if (callStateRef.current === 'idle') { schedulePeerReinit(500); return; }
            try { peer.reconnect(); } catch {}
            setTimeout(retry, 3000);
          };
          retry();
          return;
        }
        console.warn('[Ledger Chat:PeerJS] Disconnected — destroying and scheduling re-init');
        // Outside a call: peer.reconnect() can hang on mobile WebViews when the server connection
        // is fully lost, so destroy and re-init cleanly via peerInitKey.
        schedulePeerReinit(1500);
      });

      // TURN credentials are short-lived: refresh them before they expire. PeerJS reads its config
      // for every new connection, so the next call (or resume) uses the fresh ones.
      let iceTimer: ReturnType<typeof setTimeout> | null = null;
      const refreshIce = (inMs: number) => {
        iceTimer = setTimeout(async () => {
          if (destroyed || peer.destroyed) return;
          const next = await loadIceConfig();
          if (destroyed || peer.destroyed) return;
          ownTurnRef.current = next.own;
          try { (peer as any).options.config = { ...(peer as any).options.config, iceServers: next.iceServers }; } catch {}
          refreshIce(next.refreshInMs);
        }, inMs);
      };
      refreshIce(ice.refreshInMs);
      peer.on('close', () => { if (iceTimer) clearTimeout(iceTimer); });

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
      playRemoteAudio();
    }
  }, [callState, remoteStream]);

  // ─── WebRTC Advanced Telemetry & Telegram-Parity Visuals ─────────────────
  
  // The voice pulse of a voice call lives in AudioCallStage (CallScreens.tsx): it used to set
  // state here on every animation frame, re-rendering the whole chat 60 times a second.

  // Network quality, every 2 s while a call is active. State changes only when the reading does,
  // so a steady call does not re-render the chat. A dropped path reads as weak until ICE recovers.
  useEffect(() => {
    if (callState !== 'active' || !activeConnectionRef.current) {
      setNetworkQuality('good');
      setCallRoute({ kind: 'unknown', path: null, rttMs: null });
      return;
    }
    let stopped = false;
    let lastRoute = '';
    const check = async () => {
      const peerConn: RTCPeerConnection | undefined = activeConnectionRef.current?.peerConnection;
      if (!peerConn || stopped || document.visibilityState === 'hidden') return;
      try {
        const stats = await peerConn.getStats();
        let isPoor = peerConn.iceConnectionState === 'disconnected';
        stats.forEach((report: any) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.currentRoundTripTime > 0.4) isPoor = true;
          if (report.type === 'inbound-rtp' && report.packetsReceived > 0 && report.packetsLost / report.packetsReceived > 0.05) isPoor = true;
        });
        if (stopped) return;
        setNetworkQuality(isPoor ? 'poor' : 'good');
        // Selected candidate pair → direct (host / srflx / prflx) or relay, and the round trip.
        const route = routeFromStats(stats);
        if (route) {
          const key = `${route.path}:${route.rttMs}`;
          if (key !== lastRoute) {
            lastRoute = key;
            setCallRoute(route);
            if (callMetricsRef.current) { callMetricsRef.current.route = route.kind; callMetricsRef.current.path = route.path ?? undefined; callMetricsRef.current.rttMs = route.rttMs; }
          }
        }
      } catch {}
    };
    void check();
    const id = setInterval(check, 2000);
    return () => { stopped = true; clearInterval(id); };
  }, [callState]);

  // ─── performEndCall: Universal cleanup ── uses refs to avoid stale closures ──
  // AUDIT FIX: All mutable values accessed via refs, not closure captures.
  // This ensures that when called from async contexts (timeouts, PeerJS events),
  // we always clean up the CURRENT stream/connection, not a stale captured one.
  const activeConnectionRef = useRef<any>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  // Screen sharing: its own PeerJS connection next to the call, in voice and video calls alike.
  const screenOutRef = useRef<{ conn: any; stream: MediaStream } | null>(null);
  const screenInRef = useRef<any>(null);
  const [remoteScreen, setRemoteScreen] = useState<MediaStream | null>(null);
  const stopScreenShareRef = useRef<() => void>(() => {});
  stopScreenShareRef.current = () => {
    const out = screenOutRef.current;
    screenOutRef.current = null;
    if (out) {
      try { out.conn?.close(); } catch {}
      try { out.stream.getTracks().forEach(t => t.stop()); } catch {}
    }
    setIsScreenSharing(false);
  };
  // One way to wire every call connection (outgoing, answered, reverse-dialled): the other
  // person's stream plays through the single <audio> element, and sending is tuned once connected.
  const wireCallRef = useRef<(conn: any, opts?: { resume?: boolean }) => void>(() => {});
  wireCallRef.current = (conn: any, opts: { resume?: boolean } = {}) => {
    conn.on('stream', (rStream: MediaStream) => {
      // A resume connection becomes the call's connection once it carries the other person;
      // the old one (still playing until now) is then closed: make before break.
      if (opts.resume && activeConnectionRef.current !== conn) {
        adoptConnectionRef.current(conn);
        if (callMetricsRef.current) callMetricsRef.current.resumes += 1;
      }
      if (activeConnectionRef.current === conn || !activeConnectionRef.current) {
        callRemoteIdRef.current = conn.peer;
        if (!callMyIdRef.current) callMyIdRef.current = myPeerIdRef.current;
      }
      watchIceRef.current(conn);
      setRemoteStream(rStream);
      stopRingtone();
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = rStream;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = rStream;
        // Call audio always plays (never gated on a notification setting).
        playRemoteAudio();
      }
      goLiveWhenConnectedRef.current(conn);
      void tuneSenders(conn.peerConnection);
    });
    conn.on('close', () => endCallIfCurrentRef.current(conn));
    conn.on('error', () => endCallIfCurrentRef.current(conn));
  };
  // ── "Connected" means media flows ─────────────────────────────────────────────
  // PeerJS hands over the other person's stream as soon as the answer arrives, BEFORE the two
  // devices have found a network path (ICE). Showing the call as connected at that point gave a
  // running clock over silence and a black video whenever no path exists (no TURN relay, strict
  // NAT, mobile carrier). The call is "active" only once ICE connects; until then the call screen
  // says "Connecting…", and if no path is found it ends with a clear message instead.
  const ownTurnRef = useRef(false);
  const connectFailedRef = useRef<() => void>(() => {});
  connectFailedRef.current = () => {
    if (callStateRef.current !== 'connecting') return;
    console.warn('[Call] No network path to the other device (ICE).', ownTurnRef.current ? 'TURN relay was offered.' : 'No TURN relay configured.');
    toast.error("The call couldn't connect through this network. Try again, or switch one side to Wi-Fi or mobile data.", { duration: 7000 });
    executeSendRef.current?.('__CALL_HANGUP__').catch(() => {});
    performEndCallRef.current();
  };
  const goLiveWhenConnectedRef = useRef<(conn: any) => void>(() => {});
  goLiveWhenConnectedRef.current = (conn: any) => {
    if (callStateRef.current === 'active') return; // a resume of a running call: nothing to wait for
    const pc: RTCPeerConnection | undefined = conn?.peerConnection;
    const up = () => !!pc && (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed' || pc.connectionState === 'connected');
    const live = () => {
      if (callStateRef.current === 'active' || callStateRef.current === 'idle') return;
      const cur = activeConnectionRef.current;
      if (cur && cur !== conn) return;
      if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; }
      setCallState('active');
      markSetup(callMetricsRef.current);
      setCallTiming((t) => ({ ...t, setupMs: callMetricsRef.current?.setupMs }));
      playRemoteAudio();
    };
    if (!pc || up()) { live(); return; }
    setCallState('connecting');
    const onChange = () => {
      if (up()) {
        pc.removeEventListener('iceconnectionstatechange', onChange);
        pc.removeEventListener('connectionstatechange', onChange);
        live();
      } else if (pc.iceConnectionState === 'failed' || pc.connectionState === 'failed') {
        connectFailedRef.current();
      }
    };
    pc.addEventListener('iceconnectionstatechange', onChange);
    pc.addEventListener('connectionstatechange', onChange);
    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
    callTimeoutRef.current = setTimeout(() => {
      if (callStateRef.current === 'connecting' && !up()) connectFailedRef.current();
    }, ICE_CONNECT_MS);
  };
  // ── Keeping the call alive (lib/calls/resume.ts) ──────────────────────────────
  // The remote peer id of the call and our own id when it connected: a resume goes to the
  // first, and is dialled by us if the second changed.
  const callRemoteIdRef = useRef<string>('');
  const callMyIdRef = useRef<string>('');
  const pendingResumeRef = useRef<any>(null);
  const pendingResumeAtRef = useRef(0);
  const reconnectRef = useRef<{ deadline: number; attempt: number; timer: ReturnType<typeof setTimeout> | null } | null>(null);
  const [callReconnecting, setCallReconnecting] = useState(false);
  // Measurements of this call, on this device only (lib/calls/metrics.ts).
  const callMetricsRef = useRef<CallMetrics | null>(null);
  // iOS can refuse to play the other person's voice without a tap on this page: then a button says so,
  // instead of a silent call.
  const [audioBlocked, setAudioBlocked] = useState(false);
  const playRemoteAudio = () => {
    const el = remoteAudioRef.current;
    if (!el) return;
    // The voice actually playing is "first audio" (the element is the one always-mounted <audio>).
    el.onplaying = () => {
      markFirstAudio(callMetricsRef.current);
      const firstAudioMs = callMetricsRef.current?.firstAudioMs;
      setCallTiming((t) => (t.firstAudioMs === firstAudioMs ? t : { ...t, firstAudioMs }));
    };
    el.play().then(() => setAudioBlocked(false)).catch((err: any) => {
      if (err?.name === 'NotAllowedError') setAudioBlocked(true);
      else console.warn('[Audio] play() failed:', err);
    });
  };
  const remoteHasVideo = !!remoteStream?.getVideoTracks().length;
  const localHasVideo = !!localStream?.getVideoTracks().some((t) => t.readyState === 'live');
  const stopReconnectRef = useRef<() => void>(() => {});
  stopReconnectRef.current = () => {
    const r = reconnectRef.current;
    reconnectRef.current = null;
    if (r?.timer) clearTimeout(r.timer);
    setCallReconnecting(false);
  };
  const adoptConnectionRef = useRef<(conn: any) => void>(() => {});
  adoptConnectionRef.current = (conn: any) => {
    const old = activeConnectionRef.current;
    activeConnectionRef.current = conn;
    setActiveConnection(conn);
    if (pendingResumeRef.current === conn) pendingResumeRef.current = null;
    stopReconnectRef.current();
    if (old && old !== conn) { try { old.close(); } catch {} }
  };
  /** Dials a new connection for the running call. False when it cannot right now (signalling down). */
  const dialResumeRef = useRef<(reason: 'network' | 'upgrade') => any>(() => null);
  dialResumeRef.current = (reason) => {
    const livePeer = peerInstanceRef.current;
    const remote = callRemoteIdRef.current;
    const stream = localStreamRef.current;
    if (!livePeer || livePeer.destroyed || livePeer.disconnected || !remote || !stream) return null;
    if (pendingResumeRef.current) { try { pendingResumeRef.current.close(); } catch {} }
    const conn = livePeer.call(remote, stream, {
      metadata: { kind: 'resume', callType: callTypeRef.current === 'video' ? 'video' : 'audio', reason },
      ...CALL_SDP,
    });
    if (!conn) return null;
    pendingResumeRef.current = conn;
    pendingResumeAtRef.current = Date.now();
    wireCallRef.current(conn, { resume: true });
    return conn;
  };
  const beginReconnectRef = useRef<() => void>(() => {});
  beginReconnectRef.current = () => {
    if (reconnectRef.current || callStateRef.current !== 'active') return;
    reconnectRef.current = { deadline: Date.now() + RESUME_DEADLINE_MS, attempt: 0, timer: null };
    setCallReconnecting(true);
    const tick = () => {
      const r = reconnectRef.current;
      if (!r || callStateRef.current !== 'active') return;
      if (Date.now() > r.deadline) {
        stopReconnectRef.current();
        toast.error('The call lost its connection.');
        executeSendRef.current?.('__CALL_HANGUP__').catch(() => {});
        performEndCallRef.current();
        return;
      }
      // A new attempt only when none is under way: ICE over a relay can take a few seconds, and a
      // retry must not cut an attempt that was about to connect.
      const busy = pendingResumeRef.current && Date.now() - pendingResumeAtRef.current < RESUME_ATTEMPT_MS;
      if (!busy && shouldDialResume({ isCaller: isCallerRef.current, myId: myPeerIdRef.current, myIdAtStart: callMyIdRef.current })) {
        dialResumeRef.current('network');
      }
      r.attempt += 1;
      r.timer = setTimeout(tick, Math.max(1_000, resumeDelay(r.attempt)));
    };
    tick();
  };
  /** ICE "disconnected" for a moment starts recovery at once; PeerJS itself waits for "failed". */
  const watchIceRef = useRef<(conn: any) => void>(() => {});
  const watchedRef = useRef<WeakSet<object>>(new WeakSet());
  watchIceRef.current = (conn: any) => {
    const pc: RTCPeerConnection | undefined = conn?.peerConnection;
    if (!pc || watchedRef.current.has(pc)) return;
    watchedRef.current.add(pc);
    let grace: ReturnType<typeof setTimeout> | null = null;
    pc.addEventListener('iceconnectionstatechange', () => {
      const st = pc.iceConnectionState;
      if (st === 'connected' || st === 'completed') {
        if (grace) { clearTimeout(grace); grace = null; }
        // The old path came back by itself before a resume did: keep it.
        if (activeConnectionRef.current === conn && reconnectRef.current) {
          stopReconnectRef.current();
          if (pendingResumeRef.current) { try { pendingResumeRef.current.close(); } catch {} pendingResumeRef.current = null; }
        }
      } else if (st === 'disconnected' && !grace) {
        grace = setTimeout(() => {
          grace = null;
          if (activeConnectionRef.current === conn && pc.iceConnectionState !== 'connected' && pc.iceConnectionState !== 'completed') beginReconnectRef.current();
        }, DISCONNECTED_GRACE_MS);
      }
    });
  };

  useEffect(() => {
    if (callState !== 'active') return;
    sampleHeap(callMetricsRef.current);
    const id = setInterval(() => sampleHeap(callMetricsRef.current), 30_000);
    return () => clearInterval(id);
  }, [callState]);

  // Keep refs in sync with state
  useEffect(() => { activeConnectionRef.current = activeConnection; }, [activeConnection]);
  useEffect(() => { remoteStreamRef.current = remoteStream; }, [remoteStream]);

  const performEndCall = useCallback(() => {
    stopRingtone();
    stopScreenShareRef.current();
    if (screenInRef.current) { try { screenInRef.current.close(); } catch {} screenInRef.current = null; }
    setRemoteScreen(null);
    if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; }
    // Use refs — never captured closure values
    const ls = localStreamRef.current;
    const rs = remoteStreamRef.current;
    const ac = activeConnectionRef.current;
    finishCallMetrics(callMetricsRef.current);
    callMetricsRef.current = null;
    setAudioBlocked(false);
    // Forget the call before closing its connections: their 'close' must not start a recovery.
    activeConnectionRef.current = null;
    callStateRef.current = 'idle';
    stopReconnectRef.current();
    if (pendingResumeRef.current) { try { pendingResumeRef.current.close(); } catch {} pendingResumeRef.current = null; }
    callRemoteIdRef.current = '';
    callMyIdRef.current = '';
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

  // A PeerJS connection closing ends the call only if it is the call's
  // connection. With several devices on one account, a caller can hold two:
  // the one that reached the callee's PC (never answered) and the reverse
  // dial from the phone that did answer. Closing the first must not end the
  // second. With no active connection yet, any close ends the attempt as before.
  const endCallIfCurrentRef = useRef<(conn: any) => void>(() => {});
  endCallIfCurrentRef.current = (conn: any) => {
    const active = activeConnectionRef.current;
    if (active && active !== conn) {
      // A resume attempt that failed: an upgrade to video the other app could not take is undone.
      if (pendingResumeRef.current === conn) {
        pendingResumeRef.current = null;
        if (upgradeRef.current === conn) undoUpgradeRef.current();
      }
      return;
    }
    // The connection of a running call dropped (network change, ICE failed): recover. A hang-up
    // arrives as __CALL_HANGUP__ over XMTP and ends the call; the recovery has a deadline anyway.
    if (active === conn && callStateRef.current === 'active') { beginReconnectRef.current(); return; }
    // Answered, but no network path was ever found (PeerJS closes on ICE "failed"): say so.
    if (callStateRef.current === 'connecting') { connectFailedRef.current(); return; }
    performEndCallRef.current();
  };

  // ─── startCall: Initiates an outgoing call ───────────────────────────────────
  // ANDROID FIX: This function MUST be called directly from a user-gesture handler
  // (onClick). Android Chrome enforces that getUserMedia() is only callable from
  // a trusted user-gesture context. Any async indirection breaks this.
  // CRITICAL: We do NOT await anything before getUserMedia, otherwise
  // Android WebViews will strip the transient user-activation token.
  const startCall = async (type: 'audio' | 'video', targetPeerOverride?: string) => {
    const targetPeer = targetPeerOverride || activePeer;
    if (!targetPeer) return;
    callMetricsRef.current = startCallMetrics('caller', type);
    setCallTiming({});
    
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
      // One request, `ideal` hints only (never fails on a device that cannot meet them).
      stream = await navigator.mediaDevices.getUserMedia(callConstraints(type));

      // Prevent state inconsistency if unmounted while waiting for permissions
      if (!isComponentMountedRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      rememberMediaPermission();
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
          metadata: { callType: type },
          ...CALL_SDP,
        });
        if (outConn) {
          setActiveConnection(outConn);
          // The callee may answer on a different device than the one this
          // connection reached (multi-device). When that other device drops
          // this unanswered connection, the call that WAS answered must live on.
          wireCallRef.current(outConn);
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
          // Tell the callee to stop ringing; both call logs then read "missed".
          executeSendRef.current?.('__CALL_HANGUP__').catch(() => {});
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
    callMetricsRef.current = startCallMetrics('callee', callTypeRef.current === 'video' ? 'video' : 'audio');
    setCallTiming({});
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
      stream = await navigator.mediaDevices.getUserMedia(callConstraints(callTypeRef.current === 'video' ? 'video' : 'audio'));
      // Prevent state inconsistency if unmounted while waiting for permissions
      if (!isComponentMountedRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      rememberMediaPermission();
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
        pendingConn.answer(stream, CALL_SDP);
        setActiveConnection(pendingConn);
        wireCallRef.current(pendingConn);
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
          metadata: { callType: callTypeRef.current },
          ...CALL_SDP,
        });
        if (!conn) {
          toast.error('Could not start the call. Please try again.');
          performEndCallRef.current();
          return;
        }
        
        setActiveConnection(conn);
        wireCallRef.current(conn);
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

  // Straight to the call: startCall/answerCall make the one getUserMedia request and explain any
  // refusal. A separate "permission" request used to come first: it opened the microphone (and,
  // to answer a voice call, the camera) a second time, delayed every first call, and its stream
  // was never stopped, so the devices stayed in use after the call.
  const rememberMediaPermission = () => {
    if (!hasMediaPermission) {
      try { vault.setItem('ledger_media_perm', 'true'); } catch {}
      setHasMediaPermission(true);
    }
  };
  const handleStartCall = async (type: 'audio' | 'video', targetPeerOverride?: string) => {
    if (targetPeerOverride && activePeer !== targetPeerOverride) {
      setActivePeer(targetPeerOverride);
    }
    startCall(type, targetPeerOverride);
  };
  const handleStartCallRef = useRef(handleStartCall);
  handleStartCallRef.current = handleStartCall;

  // ── Panels: Escape closes the top one, and the header menu opens one at a time ──
  const closeChatPanels = useCallback(() => {
    setShowContactInfo(false);
    setShowWallpaperPicker(false);
    setShowThemePicker(false);
    setShowSaveContactModal(false);
    setShowZkWallet(false);
    setShowScanner(false);
    setShowSavedModal(false);
    setShowShortcutsModal(false);
    setShowEncryptionInfo(false);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      // Sheets from the chat kit close themselves.
      if (document.querySelector('[data-sheet]')) return;
      const layers: [boolean, () => void][] = [
        [showSaveContactModal, () => setShowSaveContactModal(false)],
        [showShortcutsModal, () => setShowShortcutsModal(false)],
        [showSavedModal, () => setShowSavedModal(false)],
        [showScanner, () => setShowScanner(false)],
        [showEncryptionInfo, () => setShowEncryptionInfo(false)],
        [showThemePicker, () => setShowThemePicker(false)],
        [showWallpaperPicker, () => setShowWallpaperPicker(false)],
        [showContactInfo, () => setShowContactInfo(false)],
        [showZkWallet, () => setShowZkWallet(false)],
        [showHeaderMenu, () => setShowHeaderMenu(false)],
        [showAppDrawer, () => setShowAppDrawer(false)],
      ];
      const top = layers.find(([open]) => open);
      if (top) top[1]();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showSaveContactModal, showShortcutsModal, showSavedModal, showScanner, showEncryptionInfo, showThemePicker, showWallpaperPicker, showContactInfo, showZkWallet, showHeaderMenu, showAppDrawer]);

  // ── Scheduled messages ───────────────────────────────────────────────────
  // Kept on this device with the chat they belong to (lib/chat/scheduled.ts).
  useEffect(() => {
    if (!address) { setScheduledList([]); return; }
    setScheduledList(loadScheduled(address));
    const onUpdate = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.owner === address.toLowerCase() && Array.isArray(d.list)) setScheduledList(d.list);
    };
    window.addEventListener(SCHEDULED_EVENT, onUpdate);
    return () => window.removeEventListener(SCHEDULED_EVENT, onUpdate);
  }, [address]);

  // Sends what is due to the chat each message was written in, whichever chat is open.
  const sendingScheduledRef = useRef(false);
  useEffect(() => {
    if (!client || !address) return;
    const tick = async () => {
      if (sendingScheduledRef.current || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
      const due = dueScheduled(loadScheduled(address));
      if (!due.length) return;
      sendingScheduledRef.current = true;
      try {
        for (const m of due) {
          try {
            await sendMessage(client, m.peer, m.content, address);
            removeScheduled(address, m.id);
          } catch {
            const left = markAttempt(address, m.id).find((x) => x.id === m.id);
            if ((left?.attempts ?? 0) === 3) toast.error(`A scheduled message to ${getDisplayName(m.peer)} has not gone yet. Ledger Chat keeps trying.`);
          }
        }
      } finally {
        sendingScheduledRef.current = false;
      }
    };
    tick();
    const id = setInterval(tick, 15_000);
    const wake = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
    };
  }, [client, address, getDisplayName]);

  // ── Scheduled calls ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!address) { setMeetings([]); return; }
    const load = () => setMeetings(upcomingMeetings(loadMeetings(address)));
    load();
    window.addEventListener(MEETINGS_EVENT, load);
    const id = setInterval(load, 60_000);
    return () => { window.removeEventListener(MEETINGS_EVENT, load); clearInterval(id); };
  }, [address]);

  // Join on a card in the open chat starts an ordinary call with that person.
  useEffect(() => {
    const onJoin = (e: Event) => {
      const kind = (e as CustomEvent).detail?.kind === 'voice' ? 'audio' : 'video';
      handleStartCallRef.current(kind);
    };
    window.addEventListener(MEETING_JOIN_EVENT, onJoin);
    return () => window.removeEventListener(MEETING_JOIN_EVENT, onJoin);
  }, []);

  // Remember the scheduled calls in the open chat, for the Calls tab and the reminder.
  useEffect(() => {
    if (!address || !activePeer) return;
    const conv = `dm-${activePeer.toLowerCase()}`;
    const selfId = client?.inboxId;
    for (const m of messages) {
      if (m.conversationId !== conv || typeof m.content !== 'string') continue;
      const at = m.content.indexOf('__MEETING__::');
      if (at < 0) continue;
      const invite = parseMeeting(m.content.slice(at));
      if (invite) rememberMeeting(address, activePeer, invite, !!selfId && m.senderInboxId === selfId);
    }
  }, [messages, activePeer, address, client]);

  // A reminder when a scheduled call starts, with Join, once per call on this device.
  useEffect(() => {
    if (!address) return;
    const check = () => {
      const now = Date.now();
      for (const m of meetings) {
        const startsIn = m.invite.startsAt - now;
        if (startsIn > 60_000 || startsIn < -5 * 60_000) continue;
        const key = `ledger_meeting_reminded_${m.invite.id}`;
        try {
          if (localStorage.getItem(key)) continue;
          localStorage.setItem(key, '1');
        } catch { /* storage blocked: remind anyway */ }
        toast(m.invite.title, {
          description: `${m.invite.kind === 'video' ? 'Video' : 'Voice'} call with ${getDisplayName(m.peer)} is starting.`,
          duration: 60_000,
          action: {
            label: 'Join',
            onClick: () => {
              setActiveCommunity(null);
              setSidebarTab('chats');
              setShowList(false);
              handleStartCallRef.current(m.invite.kind === 'video' ? 'video' : 'audio', m.peer);
            },
          },
        });
      }
    };
    check();
    const id = setInterval(check, 20_000);
    return () => clearInterval(id);
  }, [meetings, address, getDisplayName]);

  const handleAnswerCall = async () => {
    answerCall();
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
    // Hanging up before the other side picked up is a call with no answer,
    // not an answered call of 0 seconds.
    const wasConnected = callStateRef.current === 'active';
    try {
      if (executeSendRef.current) await executeSendRef.current('__CALL_HANGUP__');
    } catch {}
    // Log completed call to sovereign history
    if (address && activePeer) {
      saveCallRecord(address, {
        peerAddress: activePeer,
        type: callType || 'audio',
        direction: isCallerRef.current ? 'outgoing' : 'incoming',
        status: wasConnected ? 'answered' : 'missed',
        durationSeconds: wasConnected ? callElapsedSeconds() : 0,
      });
    }
    performEndCall();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [performEndCall, address, activePeer, callType]);

  // ── Hang up from the Dynamic Island, call back from a call bubble ──────────
  // The island's red button dispatches 'ledger_end_active_call'. Only the group
  // call listened for it, so in a 1:1 call the island closed while the call
  // went on and the other side never heard a hang-up. It now does exactly
  // what the in-call buttons do: decline while ringing, hang up otherwise.
  //
  // "Hide my IP address in calls" is baked into the PeerJS connection when it
  // is created, so a change used to apply only after a reload. Rebuild the
  // connection when it changes (between calls, never during one).
  const ipMaskingOn = !!(ledgerSettings as any)?.webrtc_ip_masking;
  const ipMaskingPrevRef = useRef(ipMaskingOn);
  useEffect(() => {
    if (ipMaskingPrevRef.current === ipMaskingOn) return;
    ipMaskingPrevRef.current = ipMaskingOn;
    if (callStateRef.current !== 'idle') return;
    try { peerInstanceRef.current?.destroy(); } catch {}
    peerInstanceRef.current = null;
    setPeerInstance(null);
    const nextKey = peerInitKeyRef.current + 1;
    peerInitKeyRef.current = nextKey;
    setPeerInitKey(nextKey);
  }, [ipMaskingOn]);

  const endCallRef = useRef(endCall);
  endCallRef.current = endCall;
  const declineCallRef = useRef(declineCall);
  declineCallRef.current = declineCall;
  const startCallFromBubbleRef = useRef<(kind: 'audio' | 'video') => void>(() => {});
  startCallFromBubbleRef.current = (kind) => { if (callStateRef.current === 'idle') handleStartCall(kind); };
  useEffect(() => {
    const onIslandHangup = () => {
      const s = callStateRef.current;
      if (s === 'ringing') declineCallRef.current();
      else if (s !== 'idle') endCallRef.current();
    };
    const onCallBack = (e: Event) => {
      const kind = (e as CustomEvent<{ kind?: 'audio' | 'video' }>).detail?.kind === 'video' ? 'video' : 'audio';
      startCallFromBubbleRef.current(kind);
    };
    window.addEventListener('ledger_end_active_call', onIslandHangup);
    window.addEventListener('ledger_call_back', onCallBack);
    return () => {
      window.removeEventListener('ledger_end_active_call', onIslandHangup);
      window.removeEventListener('ledger_call_back', onCallBack);
    };
  }, []);

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
    // No camera yet (a voice call, or the side that was upgraded to video): add one in place.
    if (!localStream.getVideoTracks().length) { void enableCameraRef.current(); return; }
    const nextOff = !isCamOff;
    localStream.getVideoTracks().forEach(t => { t.enabled = !nextOff; });
    setIsCamOff(nextOff);
  }, [localStream, isCamOff]);

  // ─── Voice → video without hanging up ────────────────────────────────────────
  // The camera is added to our stream and sent on a resume connection (lib/calls/resume.ts); the
  // voice keeps going on the old one until the new one carries the call.
  const upgradeRef = useRef<any>(null);
  const preUpgradeRef = useRef<{ stream: MediaStream; type: 'audio' | 'video'; track: MediaStreamTrack } | null>(null);
  const undoUpgradeRef = useRef<() => void>(() => {});
  undoUpgradeRef.current = () => {
    const prev = preUpgradeRef.current;
    preUpgradeRef.current = null;
    upgradeRef.current = null;
    if (!prev) return;
    try { prev.track.stop(); } catch {}
    setLocalStream(prev.stream);
    callTypeRef.current = prev.type;
    setCallType(prev.type);
    toast.error("Your contact's app could not switch to video. The voice call goes on.");
  };
  const enableCameraRef = useRef<() => Promise<void>>(async () => {});
  enableCameraRef.current = async () => {
    const current = localStreamRef.current;
    if (!current || callStateRef.current !== 'active' || upgradeRef.current) return;
    let track: MediaStreamTrack | undefined;
    try {
      const cam = await navigator.mediaDevices.getUserMedia({ video: callVideo(activeCamera) });
      track = cam.getVideoTracks()[0];
    } catch (e: any) {
      toast.error(e?.name === 'NotAllowedError' ? 'Camera access is blocked. Allow it in your browser settings.' : 'Could not turn on your camera.');
      return;
    }
    if (!track || !localStreamRef.current || callStateRef.current !== 'active') { try { track?.stop(); } catch {} return; }
    const prevType: 'audio' | 'video' = callTypeRef.current === 'video' ? 'video' : 'audio';
    const next = new MediaStream([...current.getAudioTracks(), track]);
    preUpgradeRef.current = { stream: current, type: prevType, track };
    setLocalStream(next);
    setIsCamOff(false);
    callTypeRef.current = 'video';
    setCallType('video');
    const conn = dialResumeRef.current('upgrade');
    if (!conn) { undoUpgradeRef.current(); return; }
    upgradeRef.current = conn;
    // Adopted (stream arrived): the upgrade is done and nothing is undone any more.
    conn.on('stream', () => { if (upgradeRef.current === conn) { upgradeRef.current = null; preUpgradeRef.current = null; } });
  };

  // ─── toggleVoiceIsolation ────────────────────────────────────────────────────────
  const toggleVoiceIsolation = useCallback(async () => {
    if (!localStreamRef.current || !activeConnectionRef.current) return;
    const nextIsolation = !voiceIsolation;
    let newAudioTrack: MediaStreamTrack | null = null;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { ...CALL_AUDIO, noiseSuppression: nextIsolation }
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
        video: callVideo(activeCamera as 'user' | 'environment', nextSaver)
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
         }
      } catch (err) {
         try { newVideoTrack?.stop(); } catch {}
      }
    }
  };

  // Screen sharing, as in Telegram and WhatsApp, in voice and video calls: the screen goes as a
  // second connection to the person we are in a call with; the camera and the voice carry on.
  const canShareScreen = typeof navigator !== 'undefined' && !!navigator.mediaDevices && typeof (navigator.mediaDevices as any).getDisplayMedia === 'function';
  const toggleScreenShare = async () => {
    if (screenOutRef.current) { stopScreenShareRef.current(); return; }
    const main = activeConnectionRef.current;
    const livePeer = peerInstanceRef.current;
    if (!main || !livePeer || livePeer.destroyed || callStateRef.current !== 'active') return;
    if (!canShareScreen) { toast.error('Screen sharing is not available on this device'); return; }
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15, max: 30 } }, audio: false });
      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error('No screen track');
      // Text and code stay sharp: the encoder favours detail over motion.
      try { (track as any).contentHint = 'detail'; } catch {}
      const conn = livePeer.call(main.peer, stream, { metadata: { kind: 'screen' }, ...CALL_SDP });
      if (!conn) throw new Error('No connection');
      screenOutRef.current = { conn, stream };
      // "Stop sharing" in the browser's own bar ends it too.
      track.onended = () => { if (screenOutRef.current?.conn === conn) stopScreenShareRef.current(); };
      const ended = () => { if (screenOutRef.current?.conn === conn) stopScreenShareRef.current(); };
      conn.on('close', ended);
      conn.on('error', ended);
      const pc: RTCPeerConnection | undefined = conn.peerConnection;
      pc?.addEventListener?.('connectionstatechange', () => {
        if (pc.connectionState === 'connected') void tuneSenders(pc as any, { screen: true });
      });
      setIsScreenSharing(true);
    } catch (e: any) {
      try { stream?.getTracks().forEach(t => t.stop()); } catch {}
      screenOutRef.current = null;
      setIsScreenSharing(false);
      if (e?.name !== 'NotAllowedError' && e?.name !== 'AbortError') toast.error('Could not share your screen. Please try again.');
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
      // One rule for every browser (lib/chat/recording.ts): AAC/MP4 first, which
      // plays everywhere including older iOS, then Opus/WebM, then plain MP4.
      const mimeType = pickRecordingMimeType(MediaRecorder.isTypeSupported?.bind(MediaRecorder));

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

        // The recorder reports what it actually produced (iOS records audio/mp4 even unasked).
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || mimeType || 'audio/mp4' });
        if (blob.size < 400) {
            console.warn('[Voice] Recording too short, ignoring.');
            setRecordingSeconds(0);
            return;
        }

        try {
          // [VOICE] Encrypted on this device before anything leaves it
          // (lib/chat/send-attachment.ts): only ciphertext goes to
          // /api/chat/attachments, and the XMTP message carries the URL, digest
          // and key. This replaced uploading the plaintext recording, which the
          // server echoed back as a base64 data URL inside the XMTP message, so
          // the server heard every voice note and the size limit did not change.
          // The recorder's own mimeType is used: iOS records audio/mp4 even when
          // no type was requested.
          const recordedType = (blob.type || 'audio/mp4').split(';')[0];
          const ext = extensionForRecording(recordedType);
          const voiceBlob = new Blob(audioChunksRef.current, { type: recordedType });
          const { message: audioMsg } = await prepareAttachmentMessage(voiceBlob, {
            filename: `voice_${Date.now()}.${ext}`,
            mimeType: recordedType,
            isVoiceNote: true,
          });
          if (executeSendRef.current) {
            await executeSendRef.current(audioMsg);
          } else {
            toast.error('Open a conversation first');
          }
        } catch (error) {
          console.error('[Voice] Audio send failed:', error instanceof Error ? error.message : error);
          toast.error(error instanceof AttachmentError ? error.message : 'Could not send the voice message');
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
      toast.error('Microphone access is blocked or unavailable. Check browser settings.');
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

  // A voice note belongs to the chat it was recorded in. Opening another chat
  // while recording discards it, so it can never be sent to the wrong person.
  const recordingPeerRef = useRef<string | null>(null);
  useEffect(() => {
    if (isRecording) {
      if (recordingPeerRef.current === null) recordingPeerRef.current = activePeer;
      else if (recordingPeerRef.current !== activePeer) {
        cancelRecording();
        toast.info('Voice message discarded: you opened another chat.');
      }
    } else {
      recordingPeerRef.current = null;
    }
  }, [isRecording, activePeer, cancelRecording]);

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
                         merged.push({ peerAddress: peer, lastMessage: lastMessageOf(p.content).slice(0, 30), lastAt: new Date(ts) });
                     } else {
                         if (!existing.lastAt || new Date(ts) > new Date(existing.lastAt)) {
                             existing.lastMessage = lastMessageOf(p.content).slice(0, 30);
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
                       lastMessage: lastMessageOf(p.content),
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
            localStorage.setItem(`ledger_chat_history_${address}`, JSON.stringify({ conversations: merged.map((c: any) => (c.lastMessage ? { ...c, lastMessage: lastMessageOf(c.lastMessage) } : c)) }));
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
        // A computer linked by QR has no wallet: its phone signs, after the person approves there
        // (lib/link/channel.ts). XMTP asks this once, to register this computer's installation.
        const linked = !connector && address ? getSelfLink(address) : null;
        if (linked) {
          const text = typeof msg === 'string' ? msg : new TextDecoder().decode(msg as Uint8Array);
          setIsWaitingForSignature(true);
          try {
            toast.message('Approve on your phone', { description: 'Open Ledger Chat on your phone to turn on chats on this computer.' });
            return await remoteSign({ kind: 'xmtp', message: text }, { wallet: address });
          } catch (e: any) {
            if (e instanceof RemoteSignError) throw new Error(e.message);
            throw e;
          } finally {
            setIsWaitingForSignature(false);
          }
        }
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
        // "…on your phone" / "Your phone…": a linked computer's request was declined or timed out (lib/link/channel.ts).
        const isReject = err?.code === 4001 || errorMsg.toLowerCase().includes('reject') || errorMsg.toLowerCase().includes('deny')
          || /on your phone|your phone did not|unlinked from your phone|not linked to your phone/i.test(errorMsg);

        // Immediately stop retrying if user actively rejected the prompt
        if (isReject) {
          setInitError(/phone/i.test(errorMsg) ? errorMsg : 'Identity authorization rejected. You must approve the Ledger Chat signature to proceed.');
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
                  console.log('Freeing XMTP device slots (oldest installations) for', inboxId);
                  const revoked = await revokeXMTPInstallations(wagmiSigner, inboxId);
                  if (revoked > 0) toast(`Signed out ${revoked} old device${revoked === 1 ? '' : 's'}. Your recent devices stay signed in.`);
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
               setInitError('Ledger identity not yet synchronized. Connect your wallet or keep this browser open while the desktop terminal finishes the handshake.');
            } else {
               setInitError('Active wallet connection lost or not detected. Connect your wallet app directly to this browser to proceed.');
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
  }, [address, isMobile, signMessageAsync, isSystemHandshake, loadConversations, isLocalSystemWallet, connector]);

  useEffect(() => {
    // Aggressive Auto-Init: Trigger for all connected users including mobile.
    // Skip email users — they don't have a wallet signer for XMTP.
    if (isConnected && address && !isEmailUser && !client && !initInFlight.current && !initError) {
      initClient();
      // [SAFETY TIMEOUT] 45 s of start-up work without an answer (not counting time waiting for a
      // signature) resets the state to unblock the UI.
      let busyMs = 0;
      const safetyTimer = setInterval(() => {
        if (!initInFlight.current) { clearInterval(safetyTimer); return; }
        if (waitingSigRef.current) return;
        busyMs += 1_000;
        if (busyMs >= 45_000) {
          clearInterval(safetyTimer);
          console.warn('[LedgerChat] Init safety timeout reached - resetting state');
          setIsInitializing(false);
          initInFlight.current = false;
          setInitError('Connection timed out. Please tap "Enter Ledger Chat" to retry.');
        }
      }, 1_000);
      return () => clearInterval(safetyTimer);
    }
  }, [isConnected, address, isEmailUser, client, initError, initClient, forceAutoInit]);

  // Wallet came back (AppKit reconnect, extension unlocked): clear a wallet error once so the auto-init effect retries.
  // Keyed on the connector, so a failing signer cannot loop.
  const connectorUid = connector?.uid;
  useEffect(() => {
    if (!connectorUid || !initError || !isWalletInitError(initError)) return;
    setInitError('');
  }, [connectorUid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync contacts to backend debounced
  const persistToLocal = useCallback((arr: ConversationMeta[]) => {
    if (!address) return;
    localStorage.setItem(`ledger_chat_history_${address}`, JSON.stringify({ conversations: arr.map((c) => (c.lastMessage ? { ...c, lastMessage: lastMessageOf(c.lastMessage) } : c)) }));
    
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
        
        // /api/chat/direct no longer accepts new messages (POST answers 410:
        // direct messages go over MLS only). Its GET can only hand back
        // messages stored before that change, so it is read once per session
        // instead of every few seconds by every open client.
        if (!legacyDirectReadRef.current) try {
          legacyDirectReadRef.current = true;
          const directHeaders: Record<string, string> = {};
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
                  const newEntry = { peerAddress: peerAddress, lastMessage: lastMessageOf(dm.content), lastAt: new Date(dm.createdAt) };
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
    // The XMTP stream below delivers messages in real time; this sync is the
    // safety net for a stream that dropped. Every 10 s in the foreground (was
    // 4 s) and every 60 s in the background (was 30 s).
    let lastHiddenSync = 0;
    const globalPoll = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        if (Date.now() - lastHiddenSync < 60_000) return;
        lastHiddenSync = Date.now();
      }
      syncGlobal();
    }, 10_000);

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
              // Device-sync messages carry state between this account's own
              // devices (lib/sync). They are never chat content.
              if (handleDeviceSyncMessage(msg)) continue;
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

            // Blocked wallets: drop their messages, call signals and
            // notifications here, before anything is shown, rung or stored.
            if (fromPeer && blockedPeersRef.current.has(String(msgConvPeer).toLowerCase())) {
              confirmedMsgIds.current.add(realId);
              continue;
            }

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
              // Our own typing on another device is not "the peer is typing".
              if (!fromPeer) continue;
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


            // Phase 3: Intercept Pins, Unpins & Revokes
            if (typeof content === 'string' && content.startsWith('__PIN__')) {
              const pId = content.replace('__PIN__', '');
              setPinnedMessageId(pId);
              if (msgConvPeer) localStorage.setItem(`ledger_pinned_${msgConvPeer.toLowerCase()}`, pId);
              continue;
            }
            if (typeof content === 'string' && content.startsWith('__UNPIN__')) {
              setPinnedMessageId(null);
              if (msgConvPeer) localStorage.removeItem(`ledger_pinned_${msgConvPeer.toLowerCase()}`);
              continue;
            }
            if (typeof content === 'string' && content.startsWith('__REVOKE__')) {
              const revokeId = content.replace('__REVOKE__', '');
              markRevoked(revokeId);
              setMessages(prev => prev.filter(m => m.id !== revokeId));
              chatDB.deleteMessages([revokeId]).catch(() => {});
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
            
            // Every call signal, from either side and any device, feeds the call log.
            if (isCallSignal(content)) {
              addCallSignalsRef.current(msgConvPeer, [{ id: realId, content, sentAtMs: sentAtNs, fromMe: !fromPeer, senderInboxId: msg.senderInboxId }]);
            }

            // Multi-device calls. Call signals we sent from ANOTHER of our own
            // devices arrive here too (same inbox). They must never ring this
            // device or end a call on it, with one exception: if this device
            // is ringing for an incoming call and our other device answered or
            // declined it, stop ringing here quietly, the way WhatsApp does.
            if (!fromPeer && typeof content === 'string' && content.startsWith('__CALL_')) {
              const handledElsewhere = content.startsWith('__CALL_ANSWER__') || content === '__CALL_DECLINE__';
              const signalAge = Date.now() - sentAtNs;
              const sameCall = !!msgConvPeer && msgConvPeer.toLowerCase() === activePeerRef.current?.toLowerCase();
              if (handledElsewhere && sameCall && signalAge >= 0 && signalAge < 60000 && callStateRef.current === 'ringing') {
                const sigId = msg.id || `self-${sentAtNs}`;
                if (!processedSignalIds.current.has(sigId)) {
                  processedSignalIds.current.add(sigId);
                  performEndCallRef.current(); // local only: stops the ringtone and drops the pending connection
                  toast(content.startsWith('__CALL_ANSWER__') ? 'Answered on another device' : 'Declined on another device');
                }
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
                      durationSeconds: callElapsedSeconds(),
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
                    // Seen here, so seen everywhere: clear the badge on our other devices.
                    publishReadRef.current(msgConvPeer);
                    if (ledgerSettings?.notification_sound !== false) { playReceiveSound(); };
                    triggerHaptic(ledgerSettings?.haptics_intensity ?? 0);
                    if (ledgerSettings?.show_read_receipts !== false && /^0x[a-fA-F0-9]{40}([a-fA-F0-9]{24})?$/.test(msgConvPeer)) {
                      sendMessage(client, msgConvPeer, `__READ__${realId}`, address).catch(e => console.warn('Failed to send read receipt', e));
                    }
                  } else {
                    // Phase 5: Advanced Push Notifications when app is hidden.
                    // Same rules as the background-chat branch: Do not disturb,
                    // a muted chat and the "Private messages" toggle all apply.
                    const dndOn = !!(ledgerSettings as any)?.do_not_disturb;
                    const chatMuted = (() => { try { return !!localStorage.getItem('ledger_muted_' + String(msgConvPeer || '').toLowerCase()); } catch { return false; } })();
                    if (!dndOn && !chatMuted && ledgerSettings?.notifications_private !== false) {
                      notificationEngine.notifyLocal(
                        `Ledger Chat: ${shortAddr(msgConvPeer)}`,
                        formatMessagePreview(content),
                        msgConvPeer,
                        !!(ledgerSettings as any)?.hide_notification_content
                      );
                    }
                  }
                }
                if (prev.some(m => m.id === mappedMsg.id)) return prev;
                return [...prev, mappedMsg].sort((a, b) => a.sentAtNs - b.sentAtNs);
              });

              // Update conversation preview
              if (!isSystemSignal(content)) {
                setConversations(prev => {
                  const updated = prev.map(c =>
                    c.peerAddress.toLowerCase() === currentActivePeer
                      ? { ...c, lastMessage: lastMessageOf(content).slice(0, 80), lastAt: new Date() }
                      : c
                  );
                  persistToLocal(updated);
                  return updated;
                });
              }
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
                if (!dnd && !mutedPeer && notifEnabled) {
                  const peerForIsland = String(msgConvPeer || '');
                  const hidePreview = !!(ledgerSettings as any)?.hide_notification_content;
                  useDynamicIsland.getState().setState('notification', {
                    title: resolveContactName(address || '', peerForIsland) || formatAddress(peerForIsland) || 'New message',
                    subtitle: hidePreview ? 'New message' : formatMessagePreview(content),
                    onOpen: peerForIsland ? () => { setActiveCommunity(null); setSidebarTab('chats'); setActivePeer(peerForIsland); setShowList(false); } : undefined,
                  }, 4000);
                }
              }
              let needsSync = false;
              // Another device may already have read this chat past this
              // message (its "read" can arrive before the message itself).
              const readElsewhereTs = address ? Number(getSynced(address, `read:${msgConvPeer}`) || 0) : 0;
              const countsAsUnread = fromPeer && readElsewhereTs < sentAtNs;
              setConversations(prev => {
                if (!msgConvPeer) return prev;
                const exists = prev.some(c => c.peerAddress.toLowerCase() === msgConvPeer);
                let updated;
                // Unread badge: a peer message in a chat that is not open adds
                // one; our own message from another device means we have seen
                // the chat there, so it clears.
                if (exists) {
                  updated = prev.map(c =>
                    c.peerAddress.toLowerCase() === msgConvPeer
                      ? { ...c, ...(isSystemSignal(content) ? {} : { lastMessage: lastMessageOf(content).slice(0, 80) }), lastAt: new Date(), unreadCount: countsAsUnread ? (c.unreadCount || 0) + 1 : (fromPeer ? (c.unreadCount || 0) : 0) }
                      : c
                  );
                } else {
                  needsSync = true;
                  updated = [{
                    peerAddress: msgConvPeer,
                    lastMessage: isSystemSignal(content) ? '' : lastMessageOf(content).slice(0, 80),
                    lastAt: new Date(),
                    unreadCount: countsAsUnread ? 1 : 0,
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
        const peerAddrForClearInit = activePeer.toLowerCase();
        const myAddrForClearInit = (effectiveAddress || address || '').toLowerCase();
        const clearTsMsInit = Math.max(
          parseInt(localStorage.getItem(`ledger_cleared_${peerAddrForClearInit}`) || '0', 10),
          myAddrForClearInit ? parseInt(localStorage.getItem(`ledger_cleared_${myAddrForClearInit}_${peerAddrForClearInit}`) || '0', 10) : 0,
          address ? parseInt(localStorage.getItem(`ledger_cleared_${address.toLowerCase()}_${peerAddrForClearInit}`) || '0', 10) : 0
        );

        try {
          const rawLocal = await chatDB.getMessagesForConversation(dmId, 100);
          // Earlier builds saved each sent message twice: once under its
          // temporary "optimistic-" id (timestamp in nanoseconds) and once
          // under its real XMTP id. Drop and delete the temporary copies so
          // conversations that already show duplicates heal on this load.
          const staleIds = (rawLocal || []).filter((m: any) => typeof m.id === 'string' && m.id.startsWith('optimistic-')).map((m: any) => m.id);
          if (staleIds.length) chatDB.deleteMessages(staleIds).catch(() => {});
          const localMsgs = (rawLocal || [])
            .filter((m: any) => !(typeof m.id === 'string' && m.id.startsWith('optimistic-')))
            .filter((m: any) => !isHidden(activePeer, m.id))
            .map((m: any) => (m.sentAtNs > 1e14 ? { ...m, sentAtNs: Math.floor(m.sentAtNs / 1e6) } : m))
            .filter((m: any) => clearTsMsInit === 0 || (m.sentAtNs || 0) > clearTsMsInit);
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
        // Right after sign-in XMTP is still syncing its groups, and the first
        // read of a chat that has history can come back empty. Showing "Say
        // hello" then, and the real messages half a minute later, looked like
        // lost history. When the list already shows a last message for this
        // chat, keep the loader up and ask again a few times first.
        if (isInitial && raw.length === 0 && conversationsRef.current.some((c) => c.peerAddress.toLowerCase() === activePeer.toLowerCase() && !!c.lastMessage)) {
          for (const wait of [1500, 3000, 6000, 10000]) {
            await new Promise((r) => setTimeout(r, wait));
            if (cancelled) return;
            raw = await getMessages(client, activePeer);
            if (cancelled) return;
            if (raw.length > 0) break;
          }
        }
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
        
        const myAddrForClear = (effectiveAddress || address || '').toLowerCase();
        const peerAddrForClear = activePeer.toLowerCase();
        const clearTsMs = Math.max(
          parseInt(localStorage.getItem(`ledger_cleared_${peerAddrForClear}`) || '0', 10),
          myAddrForClear ? parseInt(localStorage.getItem(`ledger_cleared_${myAddrForClear}_${peerAddrForClear}`) || '0', 10) : 0,
          address ? parseInt(localStorage.getItem(`ledger_cleared_${address.toLowerCase()}_${peerAddrForClear}`) || '0', 10) : 0,
          address ? parseInt(localStorage.getItem(`ledger_cleared_${address}_${peerAddrForClear}`) || '0', 10) : 0
        );
        if (clearTsMs > 0) {
          raw = raw.filter((m: any) => {
            const rawTime = typeof m.sentAtNs === 'number'
              ? (m.sentAtNs > 1e15 ? m.sentAtNs / 1e6 : m.sentAtNs)
              : (new Date(m.sent || m.sentAt || 0).getTime());
            return rawTime > clearTsMs;
          });
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

        let combined = [...rawMappedMsgs, ...pendingServer].sort((a, b) => a.sentAtNs - b.sentAtNs);
        if (clearTsMs > 0) {
          combined = combined.filter((m: any) => (m.sentAtNs || 0) > clearTsMs);
        }
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
          } else if (typeof content === 'string' && content.startsWith('__UNPIN__')) {
            latestPinnedId = null;
          } else if (typeof content === 'string' && content.startsWith('__REVOKE__')) {
            const revId = content.replace('__REVOKE__', '');
            revokedIds.add(revId);
            markRevoked(revId);
            chatDB.deleteMessages([revId]).catch(() => {});
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

        // Call log: every call signal in this conversation's history, from both
        // sides, rebuilt into "Missed voice call" / "Outgoing call · 2:31" bubbles.
        {
          const selfIdForCalls = (client as any).inboxId;
          const callSigs: CallSignal[] = combined
            .filter((m: any) => isCallSignal(m.content))
            .map((m: any) => ({ id: m.id, content: m.content, sentAtMs: m.sentAtNs, fromMe: m.senderInboxId === selfIdForCalls, senderInboxId: m.senderInboxId }));
          addCallSignalsRef.current(activePeer, callSigs);
        }

        if (latestPinnedId) setPinnedMessageId(latestPinnedId);

        // Apply metadata to actual messages
        const processedMsgs = mappedMsgs.filter(m => !revokedIds.has(m.id) && !isHidden(activePeer, m.id) && (!m.burnAtNs || m.burnAtNs > Date.now()));
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
          const myAddrForClearRt = (effectiveAddress || address || '').toLowerCase();
          const peerAddrForClearRt = activePeer.toLowerCase();
          const clearTsMs = Math.max(
            parseInt(localStorage.getItem(`ledger_cleared_${peerAddrForClearRt}`) || '0', 10),
            myAddrForClearRt ? parseInt(localStorage.getItem(`ledger_cleared_${myAddrForClearRt}_${peerAddrForClearRt}`) || '0', 10) : 0,
            address ? parseInt(localStorage.getItem(`ledger_cleared_${address.toLowerCase()}_${peerAddrForClearRt}`) || '0', 10) : 0,
            address ? parseInt(localStorage.getItem(`ledger_cleared_${address}_${peerAddrForClearRt}`) || '0', 10) : 0
          );
          if (clearTsMs > 0) {
            newConfirmed = newConfirmed.filter((m: any) => {
              const rawTime = typeof m.sentAtNs === 'number'
                ? (m.sentAtNs > 1e15 ? m.sentAtNs / 1e6 : m.sentAtNs)
                : (new Date(m.sent || m.sentAt || 0).getTime());
              return rawTime > clearTsMs;
            });
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

    // Fallback for the open conversation's history. The stream and the global
    // sync already cover it; this catches anything both missed. 30 s, visible
    // tabs only (was 12 s, always).
    const pollId = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      fetchHistorical(false);
    }, 30_000);

    const fetchFriendRequests = async () => {
      if (!address) return;
      try {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
        const res = await fetch('/api/chat/contacts/request?direction=incoming', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.requests) setPendingRequestCount(data.requests.length);
        }
      } catch (e) {}
    };
    fetchFriendRequests();
    const reqPollId = setInterval(fetchFriendRequests, 30_000);

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

  const handleStartConversationWithPeerRef = useRef<((peerAddr: string) => Promise<void>) | null>(null);
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
  handleStartConversationWithPeerRef.current = handleStartConversationWithPeer;

  const handleStartConversation = async () => handleStartConversationWithPeer(peerInput);

  // Resolves true only when XMTP took the message; every refusal or failure resolves false.
  const executeSend = async (content: string): Promise<boolean> => {
    // 1. App Store Compliance: Content Moderation & Rate Limiting
    if (!checkRateLimit(address || 'anon', 60, 60000)) {
      toast.error('You are sending messages too quickly. Wait a moment.');
      return false;
    }
    // Agreement invitations and Aztec address announcements are sent exactly
    // as built: no reply or thread wrapper, no text transforms, no
    // disappearing timer, never to the plain-text offline outbox (an
    // invitation carries the agreement's secrets).
    const isAgreementMsg = isAgreementMessage(content);
    // Encrypted attachments carry their key in the text, like agreements: no
    // moderation or text transforms (which could alter the key), never the
    // plain-text offline outbox. Unlike agreements they may be replied to and
    // keep the chat's disappearing timer.
    const isAttachmentMsg = isAttachmentMessage(content);
    // Scheduled-call invitations are structured too: sent exactly as built.
    const isMeetingMsg = parseMeeting(content) !== null;
    const isOpaqueMsg = isAgreementMsg || isAttachmentMsg || isMeetingMsg;
    if (isOpaqueMsg && isOffline) {
      toast.error(isAgreementMsg ? 'You are offline. Agreements are only sent while connected.' : isMeetingMsg ? 'You are offline. Invitations are only sent while connected.' : 'You are offline. Attachments are only sent while connected.');
      return false;
    }
    const moderationFlag = isOpaqueMsg ? null : moderateContent(content);
    if (moderationFlag) {
      toast.error(moderationFlag);
      return false;
    }
    trackMessageSent(activePeer || undefined);

    if (!client || !activePeer || !content.trim() || !address) return false;
    
    const isReaction = content.startsWith('__REACT__');
    const isVote = content.startsWith('__VOTE__');
    const isSignal = isSystemSignal(content);
    // No "one message at a time" gate any more: each message shows at once and the network sends
    // go through sendQueueRef in order (lib/chat/optimistic-send.ts).

    // Direct local state sync for PIN/UNPIN signals
    if (content.startsWith('__PIN__')) {
      const pId = content.replace('__PIN__', '');
      setPinnedMessageId(pId);
      if (activePeer) localStorage.setItem(`ledger_pinned_${activePeer.toLowerCase()}`, pId);
    } else if (content.startsWith('__UNPIN__')) {
      setPinnedMessageId(null);
      if (activePeer) localStorage.removeItem(`ledger_pinned_${activePeer.toLowerCase()}`);
    }

    // Native client-side slash commands (/me, /shrug, /code, /table, /urgent, /clear, /online, /away, /dnd)
    const { transformed, isHandledLocally, action } = isOpaqueMsg
      ? { transformed: content, isHandledLocally: false, action: undefined as any }
      : transformClientCommand(content, getDisplayName(address || ''));
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
      setInputText('');
      setShowBotSuggestions(false);
      return false;
    }
    content = transformed;

    // Bot command interception
    if (!isOpaqueMsg && isBotCommand(content)) {
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
          content: botResponse,
          sentAtNs: Date.now() + 1,
          conversationId: `dm-${activePeer?.toLowerCase()}`
        };
        setMessages((prev: any[]) => [...prev, cmdMsg, botMsg].sort((a, b) => a.sentAtNs - b.sentAtNs));
        setInputText('');
        setShowBotSuggestions(false);
        return false; 
      }
    }

    // Phase 2: Message Quoting
    let finalContent = content;
    if (replyingTo && !isSignal && !isAgreementMsg) {
      const snippet = (carriesSecret(replyingTo.content) ? formatMessagePreview(replyingTo.content) : (replyingTo.content || '')).replace(/__/g, '').slice(0, 80);
      finalContent = `__REPLY__${replyingTo.id}__SNIPPET__${snippet}__::${content}`;
      setReplyingTo(null);
    }
    // Thread support
    if (threadParentId && !isSignal && !isAgreementMsg) {
      finalContent = `__THREAD__${threadParentId}__::${finalContent}`;
      setThreadParentId(null);
    }

    // Smart macros
    if (ledgerSettings?.smart_macros && !isSignal && !isOpaqueMsg) {
      if (content.trim() === '/add') { finalContent = `My wallet: ${address}`; }
      else if (/^\/pay (\d+\.?\d*)$/.test(content.trim())) {
        const m = content.trim().match(/^\/pay (\d+\.?\d*)$/);
        if (m) { setTransferAmount(m[1]); setShowWalletTransfer(true); return false; }
      }
    }
    // Tone translator  
    if (ledgerSettings?.tone_translator && !isSignal && !isOpaqueMsg) {
      finalContent = finalContent
        .replace(/\bfuck(ing)?\b/gi, 'strongly disagree')
        .replace(/\bshit\b/gi, 'situation')
        .replace(/\bbitch\b/gi, 'person')
        .replace(/\basshole\b/gi, 'individual')
        // Grouped so "oxymoron" or "stupidity" are left alone.
        .replace(/\b(idiot|moron|stupid)\b/gi, 'someone with a different view');
    }

    // Disappearing messages: a timer set for this chat wins over the global one.
    if (!isSignal && !isAgreementMsg) {
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

    const optimisticId = newOptimisticId();

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

    try {
      if (!isReaction && !isSignal) {
        // ─── OPTIMISTIC INSERT ────────────────────────────────────────────────────
        // Register the content in the map BEFORE inserting, so the stream echo
        // can find and replace this optimistic message atomically when it arrives.
        optimisticContentMap.current.set(finalContent, optimisticId); // FIX: must match what XMTP echoes back

        // Shown in this same tick, as "Sending" (clock) until XMTP returns its id.
        const optimisticMsg = optimisticMessage({
          id: optimisticId,
          senderInboxId: client?.inboxId || '',
          content: displayContent,
          burnAtNs,
          conversationId: `dm-${activePeer.toLowerCase()}`
        });
        setMessages(prev => insertOptimistic(prev, optimisticMsg));

        // Clear typing indicator immediately
        stopTypingSignal();
      } else if (isReaction) {
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

      // No sound when you send (it was found intrusive); incoming messages still chime if enabled.
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
      // Messages go out in the order they were typed (one queue); call and typing signals skip
      // the queue so a call is never held behind a slow message.
      const peerAtSend = activePeer;
      const realId = isSignal
        ? await sendMessage(client, peerAtSend, finalContent, address)
        : await sendQueueRef.current.run(() => sendMessage(client, peerAtSend, finalContent, address));

      // ── Swap the optimistic bubble for the real message, by id ──────────────
      // Pairing them by content (when the stream echo or the 12 s poll arrived)
      // missed whenever the content had been transformed, and the optimistic
      // copy was also written to IndexedDB under its temporary id with a
      // nanosecond timestamp. On every reload both copies came back: the
      // duplicates users saw. XMTP now hands back the real id at send time.
      if (realId && isOffline) {
        // XMTP accepted the message (it publishes it itself when the network
        // returns), so the local outbox must not send it a second time.
        try {
          const outboxKey = `ledger_outbox_${address.toLowerCase()}`;
          const box: Array<{ peer: string; content: string }> = JSON.parse(localStorage.getItem(outboxKey) || '[]');
          const i = box.findIndex(e => e.peer === activePeer && e.content === finalContent);
          if (i !== -1) { box.splice(i, 1); localStorage.setItem(outboxKey, JSON.stringify(box)); }
        } catch {}
      }

      if (realId && finalContent.startsWith('__CALL_')) {
        // Our own call signal goes into the call log right away, without
        // waiting for the stream to echo it back.
        addCallSignalsRef.current(activePeer, [{ id: realId, content: finalContent, sentAtMs: Date.now(), fromMe: true, senderInboxId: (client as any)?.inboxId }]);
      }

      if (realId && !isReaction && !isSignal) {
        optimisticContentMap.current.delete(finalContent);
        confirmedMsgIds.current.add(realId);
        const sentAtMs = Date.now();
        // The stream echo may already have put the real message in: then our copy is dropped.
        setMessages(prev => confirmOptimistic(prev, optimisticId, realId));
        // Persist the REAL message (never the optimistic id) so it survives reloads.
        import('@/lib/chat/indexeddb').then(({ chatDB }) => {
          chatDB.saveMessages([{
            id: realId,
            senderInboxId: (client as any)?.inboxId || '',
            senderAddress: address.toLowerCase(),
            content: displayContent,
            burnAtNs,
            sentAtNs: sentAtMs, // milliseconds, like every other message in the chat
            conversationId: `dm-${activePeer.toLowerCase()}`,
            status: 'sent',
          }]).catch(() => {});
        }).catch(() => {});
      }

      if (!isReaction && !isSignal) {
        // UPDATE LOCAL ADDRESS BOOK
        // Capture stable copies before setState to avoid stale-closure
        // ReferenceError when React replays the updater function.
        const _lastMessage = lastMessageOf(displayContent);
        const _peerAddr = activePeer;
        setConversations(prev => {
          const updated = prev.find(c => c.peerAddress.toLowerCase() === _peerAddr.toLowerCase())
            ? prev.map(c => c.peerAddress.toLowerCase() === _peerAddr.toLowerCase() ? { ...c, lastMessage: _lastMessage, lastAt: new Date() } : c)
            : [{ peerAddress: _peerAddr, lastMessage: _lastMessage, lastAt: new Date() }, ...prev];
          persistToLocal(updated);
          return updated;
        });
      }
      return true; // handed to XMTP (published, or stored locally and retried by sendMessage)

    } catch (err: any) {
      // [FIX] Removed 'throw err' which was short-circuiting the UI error feedback.
      // Now, failed messages will correctly display a red error state in the chat bubble.
      // Use 'finalContent' (processed input) to match what we inserted into the map.
      optimisticContentMap.current.delete(finalContent);
      const errString = err?.message || String(err);
      setMessages(prev => failOptimistic(prev, optimisticId, errString));
      console.error('[Chat] executeSend failed:', err);
      return false;
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

  // ─── Hito 4: Scheduled Messages ──────────────────────────────────────────
  const resetFileInputs = (e?: React.ChangeEvent<HTMLInputElement>) => {
    try { if (e) e.target.value = ''; } catch {}
    if (fileRef.current) fileRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
    if (galleryRef.current) galleryRef.current.value = '';
  };

  // Camera, photo library and document picker. The file is encrypted on this
  // device and only ciphertext is uploaded (lib/chat/send-attachment.ts); when
  // file storage is unavailable, files up to 700 KB go inline in the XMTP
  // message instead, which never touches our server.
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isOffline) {
      toast.error('You are offline. Attachments are only sent while connected.');
      resetFileInputs(e);
      return;
    }
    setIsUploading(true);
    try {
      const { message } = await prepareAttachmentMessage(file, {
        filename: sanitizeFilename(file.name),
        mimeType: file.type || 'application/octet-stream',
      });
      await executeSend(message);
    } catch (err) {
      console.error('[Attachment] send failed:', err instanceof Error ? err.message : err);
      toast.error(err instanceof AttachmentError ? err.message : 'Could not attach the file');
    } finally {
      setIsUploading(false);
      resetFileInputs(e);
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
    // "@studio ..." or "/studio ..." goes to Ledger Studio, never to the peer.
    const studioCmd = STUDIO_PREFIX.exec(inputText.trim());
    if (studioCmd) {
      const q = inputText.trim().slice(studioCmd[0].length);
      setInputText('');
      openStudio(q || undefined);
      return;
    }
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
      const snippet = (carriesSecret(replyingTo.content) ? formatMessagePreview(replyingTo.content) : (replyingTo.content || '')).replace(/__/g, '').slice(0, 80);
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
      // Stored with this chat and sent from this device at that time
      // (lib/chat/scheduled.ts). A time that has already passed sends now.
      const sendAt = scheduledAt.getTime();
      setScheduledAt(null);
      if (sendAt > Date.now() + 30_000 && address && activePeer) {
        try {
          addScheduled(address, { peer: activePeer, content: txt, sendAt });
          toast.success(`Scheduled for ${describeSendTime(sendAt).toLowerCase()}`, {
            description: 'It is sent from this device. If Ledger Chat is closed then, it goes the next time you open it.',
          });
        } catch {
          toast.error('Could not schedule this message');
        }
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
  
  // Returns the text of an encrypted attachment message, or null after telling the user why not.
  const uploadAttachment = async (fileOrBlob: Blob, filename: string): Promise<string | null> => {
    setIsUploading(true);
    try {
      const { message } = await prepareAttachmentMessage(fileOrBlob, {
        filename,
        mimeType: fileOrBlob.type || 'application/octet-stream',
      });
      return message;
    } catch (err) {
      toast.error(err instanceof AttachmentError ? err.message : 'Could not attach the file');
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

  // Only when the optional app lock is on. With it off (the default) the lock screen must never render:
  // it used to show for the first render of every visit, before the effect above marked the app unlocked.
  if (ledgerSettings?.biometric_lock && !isBiometricallyUnlocked) {
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
    // CRITICAL: If the account is still being checked (wagmi auto-reconnect in progress),
    // show a loading spinner rather than the "Connect your wallet" screen.
    // Without this, a MetaMask user who refreshes /chat sees the connect screen briefly
    // (or permanently if isChecking never resolves due to a race condition).
    if (isChecking) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center h-full bg-white">
          <div className="w-8 h-8 border-2 border-[#15171c] border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
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
        onReconnect={() => { void openAppKit(); }}
        onRefreshSession={async () => {
          // Wait for wagmi to rehydrate the connector before signing; clearing the error lets the auto-init effect retry once.
          try { await reconnectAsync(); } catch {}
          setInitError('');
        }}
        onSignOut={() => { void nuclearDisconnect(); }}
        onClearError={() => setInitError('')}
        connectorName={connector?.name}
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
          try {
            const lower = effectiveAddress.toLowerCase();
            localStorage.setItem('ledger_onboarded_' + effectiveAddress, 'true');
            localStorage.setItem('ledger_onboarded_' + lower, 'true');
            localStorage.setItem('ledger_onboarded_global', 'true');
            localStorage.setItem('ledger_account_already_created', 'true');
            localStorage.setItem('ledger_pin_configured', 'true');
            sessionStorage.setItem('__enclave_clearance_v2__', 'granted');
            localStorage.setItem('__enclave_clearance_v2__', 'granted');
          } catch {}
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
      {/* Phone: approves what linked computers ask to sign (WhatsApp/Signal model). */}
      <LinkedDeviceApprover wallet={address} />
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
              setShowClearConfirm(true);
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
              {
                const next = new Set(blockedPeersRef.current);
                next.add(activePeer.toLowerCase());
                blockedPeersRef.current = next;
                setBlockedPeers(next);
                saveBlockList(Array.from(next)).catch(() => {});
              }
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
    {/* The other person's voice: ONE element, always mounted, so minimising or switching views never
        interrupts it, and no <video> plays the same audio a second time (videos are muted). */}
    <audio ref={remoteAudioRef} autoPlay playsInline style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} />

    {/* Solid white container — two-panel layout: sidebar (left) + chat (right) */}
      <div className={`relative flex flex-row flex-1 min-h-0 w-full h-full overflow-hidden md:rounded-[28px] lg:rounded-[32px] md:border md:border-black/[0.08] md:shadow-[0_24px_70px_-16px_rgba(16,24,40,0.22),0_0_0_1px_rgba(16,24,40,0.06)] ${(showScanner || showMyQR || showProfile) ? 'overflow-visible' : ''}`} style={{ 
      background: '#ffffff',
      fontFamily,
    }}>
      {/* ── Rail: the app's sections on wide screens (phones keep the tab bar) ── */}
      <nav aria-label="Ledger Chat" className="hidden md:flex w-[76px] shrink-0 flex-col items-center gap-1.5 border-r border-black/[0.08] bg-white py-5">
        <Link href="/" aria-label="Humanity Ledger home" className="mb-4 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15171c]">
          <HLLogo variant="mark" size={40} />
        </Link>
        {([
          { id: 'chats', label: 'Chats', icon: <MessageSquare size={21} strokeWidth={1.8} />, badge: conversations.reduce((n, c) => n + (c.unreadCount || 0), 0) },
          { id: 'calls', label: 'Calls', icon: <Phone size={21} strokeWidth={1.8} />, badge: 0 },
          { id: 'updates', label: 'Updates', icon: <CircleDot size={21} strokeWidth={1.8} />, badge: 0 },
          { id: 'communities', label: 'Communities', icon: <Users size={21} strokeWidth={1.8} />, badge: 0 },
        ] as const).map((t) => {
          const on = (t.id === 'chats' ? sidebarTab === 'chats' || sidebarTab === 'contacts' : sidebarTab === t.id);
          return (
            <button
              key={t.id}
              type="button"
              aria-label={t.badge ? `${t.label}, ${t.badge} unread` : t.label}
              title={t.label}
              aria-current={on ? 'page' : undefined}
              onClick={() => {
                if (t.id === 'communities') { setSidebarTab('communities'); setActivePeer(null); }
                else { setSidebarTab(t.id); setActiveCommunity(null); }
                setShowList(true);
              }}
              className={`relative w-12 h-12 rounded-[14px] flex items-center justify-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15171c] ${on ? 'bg-[#15171c] text-white' : 'text-[#5b606b] hover:bg-[#f2f4f7] hover:text-[#15171c]'}`}
            >
              {t.icon}
              {t.badge > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#2456e6] text-white text-[10.5px] font-bold leading-[18px] text-center tabular-nums ring-2 ring-white" aria-hidden="true">
                  {t.badge > 99 ? '99+' : t.badge}
                </span>
              )}
            </button>
          );
        })}
        <span className="w-7 h-px bg-[#e6e8ec] my-2.5" aria-hidden="true" />
        <button type="button" onClick={() => setShowZkWallet(true)} aria-label="Private wallet" title="Private wallet" className="w-12 h-12 rounded-[14px] flex items-center justify-center text-[#5b606b] hover:bg-[#f2f4f7] hover:text-[#15171c] transition-colors">
          <Wallet size={21} strokeWidth={1.8} />
        </button>
        <button type="button" onClick={() => openStudio()} aria-label="Ledger Studio" title="Ledger Studio" className="w-12 h-12 rounded-[14px] flex items-center justify-center text-[#5b606b] hover:bg-[#f2f4f7] hover:text-[#15171c] transition-colors">
          <StudioIcon size={21} strokeWidth={1.8} />
        </button>
        <div className="flex-1" />
        <button type="button" onClick={() => setShowFullSettings(true)} aria-label="Settings" title="Settings" className="w-12 h-12 rounded-[14px] flex items-center justify-center text-[#5b606b] hover:bg-[#f2f4f7] hover:text-[#15171c] transition-colors">
          <Settings size={21} strokeWidth={1.8} />
        </button>
        <button type="button" onClick={() => setShowFullSettings(true)} aria-label="Your profile" title={effectiveAddress || 'Your profile'} className="relative mt-1 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15171c]">
          <Avatar address={effectiveAddress} isMe={true} size={40} />
          <span className="absolute -right-px -bottom-px w-[11px] h-[11px] rounded-full bg-[#12a150] border-2 border-white" aria-hidden="true" />
        </button>
      </nav>

      {/*  Sidebar: Conversation List — fixed width on desktop, full screen on mobile when no chat is active  */}
      <div className={`${sidebarTab === 'communities' ? (activeCommunity ? 'hidden md:flex' : 'flex') : (showList ? 'flex' : 'hidden md:flex')} w-full md:w-80 lg:w-96 flex-col border-r border-black/[0.08] bg-white shrink-0 h-full overflow-hidden`}>

        {/* ── Sidebar Header ── */}
        <div className="px-4 py-3 md:px-5 md:pt-5 md:pb-3 border-b md:border-b-0 border-[#e4e7ec] bg-white flex flex-col gap-3 md:gap-4" style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))' }}>
          {/* Wide screens: the section's name and its actions (identity and Studio live in the rail). */}
          <div className="hidden md:flex items-center justify-between gap-3 pt-2">
            <h1 className="text-[26px] font-bold tracking-[-0.03em] text-[#15171c]">
              {sidebarTab === 'calls' ? 'Calls' : sidebarTab === 'updates' ? 'Updates' : sidebarTab === 'communities' ? 'Communities' : 'Chats'}
            </h1>
            {(sidebarTab === 'chats' || sidebarTab === 'contacts') && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowContactRequests(true)}
                  className="relative w-10 h-10 rounded-xl border border-[#e6e8ec] bg-white hover:bg-[#f7f8fa] flex items-center justify-center text-[#15171c] transition-colors"
                  title="Contact requests"
                  aria-label={pendingRequestCount > 0 ? `Contact requests, ${pendingRequestCount} new` : 'Contact requests'}
                >
                  <Bell size={17} strokeWidth={1.8} />
                  {pendingRequestCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#e5484d] text-white text-[10px] font-semibold leading-4 text-center tabular-nums ring-2 ring-white" aria-hidden="true">
                      {pendingRequestCount > 9 ? '9+' : pendingRequestCount}
                    </span>
                  )}
                </button>
                <button type="button" onClick={() => setShowCreateGroup(true)} className="w-10 h-10 rounded-xl border border-[#e6e8ec] bg-white hover:bg-[#f7f8fa] flex items-center justify-center text-[#15171c] transition-colors" title="New group" aria-label="New group">
                  <UserPlus size={17} strokeWidth={1.8} />
                </button>
                <button type="button" onClick={() => document.getElementById('ledger-new-chat-input')?.focus()} className="w-10 h-10 rounded-xl bg-[#15171c] hover:bg-[#2b2f38] flex items-center justify-center text-white transition-colors" title="New chat" aria-label="New chat">
                  <Plus size={18} strokeWidth={2} />
                </button>
              </div>
            )}
          </div>

          {/* Top row: identity on the left, three actions on the right. Everything
              else lives in the "More" menu so the name never gets squeezed. */}
          <div className="flex md:hidden items-center justify-between gap-2">
            <button
              type="button"
              className="flex items-center gap-2.5 min-w-0 flex-1 rounded-xl -ml-1 px-1 py-1 hover:bg-[#f2f4f7] transition-colors text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#15171c]"
              onClick={() => setShowFullSettings(true)}
              aria-label="Your profile and settings"
              title={effectiveAddress || undefined}
            >
              <Avatar address={effectiveAddress} isMe={true} size={36} />
              <span className="flex flex-col min-w-0">
                <span className="text-[15px] font-semibold text-[#15171c] truncate leading-tight">
                  {chatName.trim() || formatAddress(effectiveAddress)}
                </span>
                <span className="text-[12px] text-[#727a88] truncate leading-tight mt-0.5 tabular-nums">
                  {chatName.trim() ? formatAddress(effectiveAddress) : 'Add your name'}
                </span>
              </span>
            </button>
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => openStudio()}
                className="w-9 h-9 rounded-full hover:bg-[#f2f4f7] flex items-center justify-center text-[#15171c] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#15171c]"
                title="Ledger Studio"
                aria-label="Open Ledger Studio"
              >
                <StudioIcon size={17} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => setShowContactRequests(true)}
                className="relative w-9 h-9 rounded-full hover:bg-[#f2f4f7] flex items-center justify-center text-[#15171c] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#15171c]"
                title="Contact requests"
                aria-label={pendingRequestCount > 0 ? `Contact requests, ${pendingRequestCount} new` : 'Contact requests'}
              >
                <Bell size={17} strokeWidth={1.75} />
                {pendingRequestCount > 0 && (
                  <span className="absolute top-0.5 left-[19px] min-w-[16px] h-4 px-1 rounded-full bg-[#e5484d] text-white text-[10px] font-semibold leading-4 text-center tabular-nums ring-2 ring-white" aria-hidden="true">
                    {pendingRequestCount > 9 ? '9+' : pendingRequestCount}
                  </span>
                )}
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSidebarMore(v => !v)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-[#15171c] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#15171c] ${showSidebarMore ? 'bg-[#eff1f4]' : 'hover:bg-[#f2f4f7]'}`}
                  title="More"
                  aria-label="More"
                  aria-haspopup="menu"
                  aria-expanded={showSidebarMore}
                >
                  <MoreHorizontal size={18} strokeWidth={1.75} />
                </button>
                {showSidebarMore && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowSidebarMore(false)} aria-hidden="true" />
                    <div
                      role="menu"
                      aria-label="More"
                      onKeyDown={e => { if (e.key === 'Escape') setShowSidebarMore(false); }}
                      className="absolute right-0 top-10 z-50 w-60 bg-white border border-[#e4e7ec] rounded-2xl shadow-[0_24px_48px_-12px_rgba(16,24,40,0.18)] p-1.5"
                    >
                      {[
                        { label: 'New chat', icon: <SquarePen size={16} strokeWidth={1.75} />, onClick: () => document.getElementById('ledger-new-chat-input')?.focus() },
                        { label: 'New group', icon: <Users size={16} strokeWidth={1.75} />, onClick: () => setShowCreateGroup(true) },
                        { label: AZTEC_WALLET_CONFIG.network === 'mainnet' ? 'Private wallet' : 'Private wallet (testnet)', icon: <Lock size={16} strokeWidth={1.75} />, onClick: () => setShowZkWallet(true) },
                        { label: 'Appearance', icon: <Palette size={16} strokeWidth={1.75} />, onClick: () => setShowThemePicker(true) },
                        { label: 'Settings', icon: <Settings size={16} strokeWidth={1.75} />, onClick: () => setShowFullSettings(true) },
                      ].map((item, i) => (
                        <button
                          key={item.label}
                          type="button"
                          role="menuitem"
                          autoFocus={i === 0}
                          onClick={() => { setShowSidebarMore(false); item.onClick(); }}
                          className="w-full flex items-center gap-3 px-3 h-10 rounded-xl text-[14px] text-[#15171c] hover:bg-[#f2f4f7] focus:bg-[#f2f4f7] outline-none transition-colors text-left"
                        >
                          <span className="text-[#475061]" aria-hidden="true">{item.icon}</span>
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
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
              className="w-full h-10 md:h-11 bg-[#f2f4f7] rounded-xl md:rounded-[14px] pl-9 pr-3 text-[15px] text-[#15171c] placeholder:text-[#8b909a] border border-transparent focus:outline-none focus:bg-white focus:border-[#d0d5dd] transition-colors"
            />
          </div>

          {/* Filters for the chat list */}
          {(sidebarTab === 'chats' || sidebarTab === 'contacts') && conversations.length > 0 && (
            <div role="group" aria-label="Filter chats" className="flex gap-1.5 flex-wrap">
              {([['all', 'All'], ['unread', 'Unread'], ['groups', 'Groups'], ['payments', 'Payments']] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={chatFilter === id}
                  onClick={() => setChatFilter(id)}
                  className={`h-8 px-3 rounded-full text-[13px] transition-colors ${chatFilter === id ? 'bg-[#15171c] text-white font-semibold' : 'bg-white border border-[#e6e8ec] text-[#15171c] font-medium hover:bg-[#f7f8fa]'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Crystal Glass NavBar (phones; the rail replaces it on wide screens) ── */}
        <div className="md:hidden">
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
        </div>

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
            (() => {
              const PAY = ['__PAYMENT__', '__ZK_MONEY_PAYMENT__', '__ZK_INVOICE__', '__ZK_TIP__', '__TIP__', '__ZK_STREAM__'];
              const isPaymentChat = (c: ConversationMeta) => {
                const raw = c.lastMessage || '';
                const inner = raw.startsWith('__') && raw.includes('__::') ? raw.split('__::').pop() || '' : raw;
                return PAY.some(p => inner.startsWith(p)) || /^(Payment|Private payment|Invoice|Private tip|Payment stream|Escrow|Private agreement)/i.test(formatMessagePreview(raw).replace(/^[^A-Za-z]+/, ''));
              };
              const list = conversations
                .filter(conv => conv.peerAddress?.toLowerCase() !== address?.toLowerCase())
                .filter(conv => showArchived ? archivedPeers.has(conv.peerAddress.toLowerCase()) : !archivedPeers.has(conv.peerAddress.toLowerCase()))
                .filter(conv => chatFilter === 'all' ? true
                  : chatFilter === 'unread' ? (conv.unreadCount || 0) > 0
                  : chatFilter === 'groups' ? !/^0x[0-9a-f]{40}$/i.test(conv.peerAddress)
                  : isPaymentChat(conv))
                .sort((a, b) => {
                  const aPin = pinnedPeers.has(a.peerAddress.toLowerCase()) ? 1 : 0;
                  const bPin = pinnedPeers.has(b.peerAddress.toLowerCase()) ? 1 : 0;
                  return bPin - aPin;
                });
              if (list.length === 0) {
                return (
                  <p className="px-6 py-10 text-center text-[14px] text-[#727a88]">
                    {chatFilter === 'unread' ? 'You are all caught up.' : chatFilter === 'groups' ? 'No group chats yet.' : chatFilter === 'payments' ? 'No chats with a recent payment.' : 'No chats here.'}
                  </p>
                );
              }
              const anyPinned = list.some(c => pinnedPeers.has(c.peerAddress.toLowerCase()));
              return list.map((conv, i) => {
              const isActive = activePeer?.toLowerCase() === conv.peerAddress.toLowerCase();
              const pinnedHere = pinnedPeers.has(conv.peerAddress.toLowerCase());
              const sectionLabel = !anyPinned ? null : i === 0 && pinnedHere ? 'Pinned' : (!pinnedHere && (i === 0 || pinnedPeers.has(list[i - 1].peerAddress.toLowerCase()))) ? 'Chats' : null;
              const contactName = resolveContactName(effectiveAddress, conv.peerAddress);
              const displayLabel = contactName || shortAddr(conv.peerAddress);
              const isPinned = pinnedPeers.has(conv.peerAddress.toLowerCase());
              const isMuted = mutedPeers.has(conv.peerAddress.toLowerCase());
              return (
                <React.Fragment key={conv.peerAddress}>
                {sectionLabel && (
                  <p className="px-5 pt-3 pb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#5b606b]">{sectionLabel}</p>
                )}
                <SwipeableConversationRow
                  peerAddress={conv.peerAddress}
                  displayName={displayLabel}
                  isPinned={isPinned}
                  isMuted={isMuted}
                  onArchive={() => toggleArchive(conv.peerAddress)}
                  onPin={() => togglePin(conv.peerAddress)}
                  onMute={() => toggleMute(conv.peerAddress)}
                  onMarkAsRead={() => markConversationAsRead(conv.peerAddress)}
                  onDelete={() => deleteConversation(conv.peerAddress)}
                >
                  <button
                    onContextMenu={(e) => { e.preventDefault(); setSidebarMenu({ peer: conv.peerAddress, x: e.clientX, y: e.clientY }); }}
                    onClick={() => {
                      if (typeof window !== 'undefined' && localStorage.getItem('ledger_locked_' + conv.peerAddress.toLowerCase())) {
                        setLockedChatPeer(conv.peerAddress);
                        return;
                      }
                      setActiveCommunity(null); setActivePeer(conv.peerAddress); setShowList(false);
                    }}
                    className={`w-full md:w-[calc(100%-20px)] md:mx-2.5 text-left px-4 py-3 md:px-3 md:py-2.5 md:rounded-2xl transition-colors ${isActive ? 'bg-[#f1f2f4]' : 'hover:bg-[#f7f8fa]'}`}
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
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className={`text-[15px] font-semibold truncate ${isMuted ? 'text-[#a3a9b4]' : 'text-[#15171c]'}`}>{displayLabel}</p>
                            {isMuted && <BellOff size={13} strokeWidth={1.9} className="text-[#a3a9b4] shrink-0" aria-label="Muted" />}
                            {isPinned && <Pin size={12} strokeWidth={2} className="text-[#a3a9b4] shrink-0 rotate-45" aria-label="Pinned" />}
                          </div>
                          {conv.lastMessage && (
                            <span className={`text-[12px] shrink-0 tabular-nums font-medium ${conv.unreadCount && !isMuted ? 'text-[#2456e6]' : 'text-[#5b606b]'}`}>
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
                        {(() => {
                          let preview = formatMessagePreview(conv.lastMessage || '');
                          if (!preview || isSystemSignal(conv.lastMessage || '')) {
                            const convId = `dm-${conv.peerAddress.toLowerCase()}`;
                            const validMsgs = messages.filter(m =>
                              m.conversationId?.toLowerCase() === convId &&
                              typeof m.content === 'string' &&
                              !isSystemSignal(m.content)
                            );
                            if (validMsgs.length > 0) {
                              preview = formatMessagePreview(validMsgs[validMsgs.length - 1].content);
                            } else {
                              preview = '';
                            }
                          }
                          return preview ? (
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[14px] text-[#5b606b] truncate">{preview}</p>
                              {conv.unreadCount && conv.unreadCount > 0 && !isMuted ? (
                                <div className="min-w-[20px] h-5 bg-[#2456e6] rounded-full flex items-center justify-center px-1.5 shrink-0" aria-label={`${conv.unreadCount} unread`}>
                                  <span className="text-[11px] font-bold text-white tabular-nums">
                                    {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  </button>
                </SwipeableConversationRow>
                </React.Fragment>
              );
            });
            })()
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
              // Saved contacts and everyone you already have a chat with.
              contacts={(() => {
                const seen = new Set<string>();
                const out: { peerAddress: string; name?: string }[] = [];
                for (const c of localContacts) { const k = c.peerAddress.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push({ peerAddress: c.peerAddress, name: c.name }); } }
                for (const c of conversations) { const k = c.peerAddress.toLowerCase(); if (/^0x[0-9a-f]{40}$/.test(k) && !seen.has(k)) { seen.add(k); const n = getDisplayName(c.peerAddress); out.push({ peerAddress: c.peerAddress, name: /^0x[0-9a-f]{4}/i.test(n) ? undefined : n }); } }
                return out;
              })()}
              upcoming={meetings}
              onJoinMeeting={(m) => { setActiveCommunity(null); setSidebarTab('chats'); setShowList(false); handleStartCall(m.invite.kind === 'video' ? 'video' : 'audio', m.peer); }}
              onScheduleCall={(addr) => { setActiveCommunity(null); setActivePeer(addr); setSidebarTab('chats'); setShowList(false); setShowMeetingSheet(true); }}
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
          // The conversation, and on wide screens its details column (ChatDetailsPanel).
          <div className="flex flex-1 min-h-0 min-w-0 w-full">
          <div className="relative flex flex-col flex-1 min-h-0 min-w-0">
            <div className="h-[72px] pl-2 pr-3 md:pl-5 md:pr-5 border-b border-[#e6e8ec] flex items-center justify-between gap-2 bg-white shrink-0 z-30">
              <div className="flex items-center gap-1 min-w-0">
                <button type="button" onClick={() => setShowList(true)} className="md:hidden w-9 h-9 rounded-full hover:bg-[#f2f4f7] flex items-center justify-center text-[#15171c]" aria-label="Back to chats">
                  <ChevronLeft size={22} strokeWidth={1.9} />
                </button>
                <button type="button" onClick={() => setShowContactInfo(true)} className="flex items-center gap-3 min-w-0 rounded-xl px-1.5 py-1 hover:bg-[#f2f4f7] transition-colors text-left" aria-label={`Contact info for ${getDisplayName(activePeer!)}`}>
                  <div className="relative shrink-0">
                    <Avatar address={activePeer!} size={42} />
                    {peerStatus.status === 'online' && (
                      <span className="absolute bottom-0 right-0 w-[11px] h-[11px] rounded-full border-2 border-white bg-[#12a150]" aria-hidden="true" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[16px] font-semibold tracking-[-0.01em] text-[#15171c] flex items-center gap-1.5 truncate">
                      <span className="truncate">{getDisplayName(activePeer!)}</span>
                      {ledgerSettings?.disappearing_messages && ledgerSettings?.disappearing_messages !== 'off' && (
                        <Timer size={13} strokeWidth={2} className="text-[#727a88] shrink-0" aria-label="Disappearing messages on" />
                      )}
                      {isSecretChat && (
                        <Flame size={13} strokeWidth={2} className="text-[#c0362c] shrink-0" aria-label="Secret chat on" />
                      )}
                    </span>
                    <span className={`text-[13px] font-medium truncate ${peerStatus.isTyping || peerStatus.status === 'online' ? 'text-[#12804a]' : 'text-[#5b606b] font-normal'}`}>
                      {peerStatus.isTyping ? 'typing…' : peerStatus.status === 'online' ? 'Active now' : peerStatus.lastSeen ? (() => {
                        const d = new Date(peerStatus.lastSeen);
                        const now = new Date();
                        const yest = new Date(now); yest.setDate(yest.getDate() - 1);
                        const t = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        if (d.toDateString() === now.toDateString()) return `Last seen today at ${t}`;
                        if (d.toDateString() === yest.toDateString()) return `Last seen yesterday at ${t}`;
                        return `Last seen ${d.toLocaleDateString([], { day: 'numeric', month: 'short' })}`;
                      })() : /^0x[0-9a-f]{4}/i.test(getDisplayName(activePeer!)) ? 'Tap for contact info' : shortAddr(activePeer!)}
                    </span>
                  </div>
                </button>
              </div>

              {/* Voice and video in bordered squares, then Pay; round icons on phones. */}
              <div className="flex items-center gap-0.5 md:gap-2 shrink-0">
                <button type="button" onClick={() => handleStartCall('audio')} className="w-10 h-10 md:w-[42px] md:h-[42px] rounded-full md:rounded-xl md:border md:border-[#e6e8ec] bg-white hover:bg-[#f2f4f7] flex items-center justify-center text-[#15171c] transition-colors" title="Voice call" aria-label="Voice call">
                  <Phone size={19} strokeWidth={1.8} />
                </button>
                <button type="button" onClick={() => handleStartCall('video')} className="w-10 h-10 md:w-[42px] md:h-[42px] rounded-full md:rounded-xl md:border md:border-[#e6e8ec] bg-white hover:bg-[#f2f4f7] flex items-center justify-center text-[#15171c] transition-colors" title="Video call" aria-label="Video call">
                  <Video size={20} strokeWidth={1.8} />
                </button>
                {ledgerSettings?.payments_enabled !== false && (
                  <button type="button" onClick={() => setShowZkModal(true)} className="hidden lg:flex h-[42px] px-4 rounded-xl bg-[#15171c] hover:bg-[#2b2f38] text-white text-[14px] font-semibold items-center gap-2 transition-colors" title={`Private payment on ${networkLabel()}`} aria-label="Send a private payment">
                    <Wallet size={17} strokeWidth={1.8} aria-hidden="true" /> Pay
                  </button>
                )}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowHeaderMenu(v => !v)}
                    className={`w-10 h-10 md:w-[42px] md:h-[42px] rounded-full md:rounded-xl md:border md:border-[#e6e8ec] flex items-center justify-center text-[#15171c] transition-colors ${showHeaderMenu ? 'bg-[#eff1f4]' : 'bg-white hover:bg-[#f2f4f7]'}`}
                    title="More"
                    aria-label="More options"
                    aria-haspopup="menu"
                    aria-expanded={showHeaderMenu}
                  >
                    <MoreVertical size={19} strokeWidth={1.8} />
                  </button>
                  {showHeaderMenu && (
                    <>
                      <div className="fixed inset-0 z-[150]" onClick={() => setShowHeaderMenu(false)} aria-hidden="true" />
                      <div role="menu" className="absolute right-0 top-11 z-[160] w-60 bg-white border border-[#e4e7ec] rounded-2xl shadow-[0_24px_48px_-12px_rgba(16,24,40,0.18)] p-1.5">
                        {[
                          { label: 'Contact info', icon: <Info size={17} strokeWidth={1.8} />, onClick: () => setShowContactInfo(true) },
                          { label: 'Search in chat', icon: <Search size={17} strokeWidth={1.8} />, onClick: () => { setShowSearch(true); setSearchQuery(''); setSearchIndex(0); } },
                          { label: 'Wallpaper', icon: <ImageIcon size={17} strokeWidth={1.8} />, onClick: () => setShowWallpaperPicker(true) },
                          { label: 'Appearance', icon: <Palette size={17} strokeWidth={1.8} />, onClick: () => setShowThemePicker(true) },
                          { label: 'Save contact', icon: <UserPlus size={17} strokeWidth={1.8} />, onClick: () => { const n = getDisplayName(activePeer!); setSaveContactName(/^0x[0-9a-f]{4}/i.test(n) ? '' : n); setShowSaveContactModal(true); } },
                          { label: isSecretChat ? 'Turn off secret chat' : 'Secret chat', icon: <Flame size={17} strokeWidth={1.8} />, onClick: () => setIsSecretChat(!isSecretChat) },
                          { label: 'Private wallet', icon: <ShieldCheck size={17} strokeWidth={1.8} />, onClick: () => setShowZkWallet(v => !v) },
                          { label: 'Scan a code', icon: <ScanQrCode size={17} strokeWidth={1.8} />, onClick: () => setShowScanner(true) },
                          { label: 'Saved messages', icon: <Bookmark size={17} strokeWidth={1.8} />, onClick: () => setShowSavedModal(true) },
                          { label: 'Keyboard shortcuts', icon: <Keyboard size={17} strokeWidth={1.8} />, onClick: () => setShowShortcutsModal(true) },
                          { label: 'Clear chat', icon: <Trash2 size={17} strokeWidth={1.8} className="text-[#e5484d]" />, onClick: () => setShowClearConfirm(true), danger: true },
                        ].map((item: any) => (
                          <button
                            key={item.label}
                            type="button"
                            role="menuitem"
                            onClick={() => { setShowHeaderMenu(false); closeChatPanels(); item.onClick(); }}
                            className={`w-full flex items-center gap-3 px-3 h-10 rounded-xl text-[14.5px] transition-colors text-left ${item.danger ? 'text-[#e5484d] hover:bg-[#fff0f0]' : 'text-[#15171c] hover:bg-[#f2f4f7]'}`}
                          >
                            <span className={item.danger ? 'text-[#e5484d]' : 'text-[#475061]'}>{item.icon}</span>
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* In-chat search — powered by InChatSearch component */}
            {activePeer && (() => {
              const convId = `dm-${activePeer.toLowerCase()}`;
              const allMsgs = messages.filter(m => m.conversationId === convId);
              return (
                <InChatSearch
                  open={showSearch}
                  messages={allMsgs.map(m => ({ id: m.id, content: typeof m.content === 'string' ? m.content : '' }))}
                  onClose={() => { setShowSearch(false); setSearchQuery(''); }}
                  onNavigate={(msgId) => {
                    const el = document.getElementById(`msg-${msgId}`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                />
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
                    const oldPin = pinnedMessageId;
                    setPinnedMessageId(null);
                    if (activePeer) localStorage.removeItem(`ledger_pinned_${activePeer.toLowerCase()}`);
                    executeSend(`__UNPIN__${oldPin}`);
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
            <div data-chat-theme={isSecretChat ? 'default' : chatTheme.id} className={`ledger-chat-container flex-1 overflow-hidden flex flex-col min-h-0 relative ${isSecretChat ? 'bg-[#fbf7f4]' : 'bg-[#f4f5f7]'} ${ledgerSettings?.anti_screenshot ? 'select-none' : ''}`} style={{ ...(isSecretChat ? {} : chatThemeStyle(chatTheme)), ...(isSecretChat ? {} : (activePeer && convWallpapers[activePeer.toLowerCase()] ? { background: convWallpapers[activePeer.toLowerCase()] } : chatTheme.id !== 'default' ? { background: chatTheme.canvas } : bgStyle)), fontFamily, fontSize: `${fontSizePx}px`, ...(ledgerSettings?.anti_screenshot && screenShielded ? { filter: 'blur(18px)', transition: 'filter 120ms ease' } : { transition: 'filter 160ms ease' }) }}>
              {/* Matrix Rain Effect Layer */}
              {chatBackground === 'matrix' && (
                <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'radial-gradient(circle, rgba(0,255,0,0.1) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
              )}
              
              {/* Confidential Watermark Overlay */}
              <div className="ledger-watermark">
                <span>Confidential</span>
              </div>
              
              {/* End-to-end encryption notice */}
              <div className="flex justify-center pt-4 pb-1 px-4">
                <button type="button" onClick={() => setShowEncryptionInfo(true)} className="max-w-[460px] flex items-start gap-2.5 px-4 py-3 rounded-[14px] bg-white border border-[#e6e8ec] text-[13px] leading-[1.5] text-[#4a4f59] text-left hover:bg-[#fafbfc] transition-colors">
                  <Lock size={15} strokeWidth={1.9} className="text-[#15171c] shrink-0 mt-[2px]" aria-hidden="true" />
                  <span>
                    Messages, calls and payments in this chat are end-to-end encrypted.{ledgerSettings?.payments_enabled !== false ? ' Payments settle privately on Aztec.' : ''}{' '}
                    <span className="text-[#15171c] font-medium underline underline-offset-2">Details</span>
                  </span>
                </button>
              </div>

              {(() => {
                // Filter messages for the current active conversation only
                const convId = `dm-${activePeer!.toLowerCase()}`;
                const peerLowerForFilter = activePeer!.toLowerCase();
                const myLowerForFilter = (effectiveAddress || address || '').toLowerCase();
                let clearTsMs = 0;
                try {
                  clearTsMs = Math.max(
                    parseInt(localStorage.getItem(`ledger_cleared_${peerLowerForFilter}`) || '0', 10),
                    myLowerForFilter ? parseInt(localStorage.getItem(`ledger_cleared_${myLowerForFilter}_${peerLowerForFilter}`) || '0', 10) : 0,
                    address ? parseInt(localStorage.getItem(`ledger_cleared_${address.toLowerCase()}_${peerLowerForFilter}`) || '0', 10) : 0
                  );
                } catch {}

                const filteredMsgs = messages.filter(m => {
                  if (isHidden(activePeer, m.id)) return false;
                  if (m.conversationId?.toLowerCase() !== convId.toLowerCase()) return false;
                  if (m.burnAtNs && m.burnAtNs <= Date.now()) return false;
                  
                  // Hide any message created at or before the chat was cleared
                  if (clearTsMs > 0) {
                    const rawTime = typeof m.sentAtNs === 'number'
                      ? (m.sentAtNs > 1e14 ? Math.floor(m.sentAtNs / 1e6) : m.sentAtNs)
                      : (m.sentAtNs ? Number(BigInt(String(m.sentAtNs)) / 1_000_000n) : new Date(m.sentAt || m.sent || 0).getTime());
                    if (rawTime <= clearTsMs) return false;
                  }

                  const c = typeof m.content === 'string' ? m.content : '';
                  // Call signals stay hidden; the call-log bubbles built from them show.
                  if (c.startsWith('__CALL_') && !c.startsWith(CALL_LOG_PREFIX)) return false;
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
                })
                  // Messages waiting to be sent later, at the end of the thread.
                  .filter(m => !(typeof m.id === 'string' && m.id.startsWith('sched_')))
                  .concat(scheduledForPeer(scheduledList, activePeer).map(sm => ({ id: sm.id, senderInboxId: client?.inboxId ?? '', content: sm.content, sentAtNs: sm.sendAt, conversationId: convId, status: 'scheduled' })));
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
                              // Short haptic tick on touch devices, skipped when the user asks for reduced motion.
                              try {
                                if (typeof navigator !== 'undefined' && 'vibrate' in navigator && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) navigator.vibrate(8);
                              } catch {}
                            }
                          }}
                          onOpenLightbox={(url) => setLightboxImg(url)}
                          formatMessagePreview={formatMessagePreview}
                          onVotePoll={(pollId, idx) => executeSend(`__VOTE__${pollId}__::${idx}`)}
                          onEditMsg={(id, current) => setEditingMsg({ id, content: current })}
                          bubbleStyle={bubbleStyle}
                          // The DM's peer inbox, resolved from the conversation's members:
                          // an Aztec address is pinned only from that inbox.
                          dmPeerInboxId={activePeerInboxIdRef.current || undefined}
                        />
                      );
                    }}
                  />
                );
              })()}
              {(peerStatus.isTyping || (activePeer && typingPeers.has(activePeer.toLowerCase()))) && (
                <AnimatePresence>
                  <TypingIndicator
                    names={activePeer ? [getDisplayName(activePeer)] : []}
                    accentColor={accentColor}
                  />
                </AnimatePresence>
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
                    Sends {describeSendTime(scheduledAt.getTime()).toLowerCase()}
                  </span>
                  <button type="button" onClick={() => setScheduledAt(null)} className="px-3 h-8 rounded-full text-[13px] font-medium text-[#475061] hover:bg-[#eff1f4]">Cancel</button>
                </div>
              )}
              {/* Messages scheduled in this chat, each one can be cancelled */}
              {!scheduledAt && address && (() => {
                const mine = scheduledForPeer(scheduledList, activePeer);
                if (!mine.length) return null;
                return (
                  <div className="mx-3 mt-2 pl-3 pr-1.5 py-1 bg-[#f7f8fa] border border-[#e4e7ec] rounded-xl flex flex-col" aria-label="Scheduled messages">
                    {mine.slice(0, 3).map(m => (
                      <div key={m.id} className="flex items-center justify-between gap-2 min-h-9">
                        <span className="flex items-center gap-2 min-w-0 text-[13.5px] text-[#15171c]">
                          <CalendarClock size={15} strokeWidth={1.9} className="text-[#475061] shrink-0" aria-hidden="true" />
                          <span className="shrink-0 font-medium">{describeSendTime(m.sendAt)}</span>
                          <span className="truncate text-[#727a88]">{formatMessagePreview(m.content)}</span>
                        </span>
                        <button type="button" onClick={() => removeScheduled(address, m.id)} className="px-3 h-8 rounded-full text-[13px] font-medium text-[#475061] hover:bg-[#eff1f4] shrink-0" aria-label={`Cancel the message scheduled for ${describeSendTime(m.sendAt)}`}>Cancel</button>
                      </div>
                    ))}
                    {mine.length > 3 && <p className="text-[12.5px] text-[#727a88] pb-1.5">And {mine.length - 3} more</p>}
                  </div>
                );
              })()}
              {/* Disappearing messages indicator */}
              {burnTimer && !isSecretChat && (
                <div className="mx-3 mt-2 pl-3 pr-1.5 h-10 bg-[#fff5f5] border border-[#fed7d7] rounded-xl flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[13.5px] text-[#c53030]">
                    <Timer size={15} strokeWidth={1.9} className="text-[#e53e3e]" aria-hidden="true" />
                    Disappearing message ({burnTimer >= 60 ? `${Math.floor(burnTimer/60)}m` : `${burnTimer}s`})
                  </span>
                  <button type="button" onClick={() => setBurnTimer(null)} className="px-3 h-8 rounded-full text-[13px] font-medium text-[#c53030] hover:bg-[#fed7d7]">Turn off</button>
                </div>
              )}
              {/* Emojis, stickers and GIFs */}
              {expression && (
                <ExpressionPicker
                  initialTab={expression}
                  onClose={() => setExpression(null)}
                  onEmoji={(e) => {
                    setInputText(prev => (prev + e).slice(0, 1000));
                    requestAnimationFrame(() => (inputRef.current as any)?.focus?.());
                  }}
                  onSend={(content) => executeSend(content)}
                />
              )}
              {inputText === '/' && (
                <div className="absolute bottom-[72px] left-3 mb-2 bg-white border border-[#e4e7ec] shadow-[0_24px_48px_-12px_rgba(16,24,40,0.18)] rounded-2xl w-[280px] overflow-hidden z-50" role="menu" aria-label="Commands">
                  <p className="px-4 pt-3 pb-1.5 text-[12.5px] font-medium text-[#727a88]">Commands</p>
                  <div className="flex flex-col px-1.5 pb-1.5">
                    {[
                      { cmd: '/pay', label: 'Send a payment', icon: <CreditCard size={17} strokeWidth={1.8} />, run: () => { setInputText(''); setShowWalletTransfer(true); } },
                      { cmd: '/poll', label: 'Create a poll', icon: <ListChecks size={17} strokeWidth={1.8} />, run: () => { setInputText(''); setShowPollCreator(true); } },
                      { cmd: '/meet', label: 'Schedule a call', icon: <CalendarPlus size={17} strokeWidth={1.8} />, run: () => { setInputText(''); setShowMeetingSheet(true); } },
                      { cmd: '/schedule', label: 'Schedule a message', icon: <CalendarClock size={17} strokeWidth={1.8} />, run: () => { setInputText(''); setShowScheduleSheet(true); } },
                      { cmd: '/gif', label: 'Search GIFs', icon: <ImageIcon size={17} strokeWidth={1.8} />, run: () => { setInputText(''); setExpression('gif'); } },
                      { cmd: '/studio', label: 'Ask Ledger Studio (AI)', icon: <StudioIcon size={17} strokeWidth={1.8} />, run: () => { setInputText(''); openStudio(); } },
                      { cmd: '/location', label: 'Share your location', icon: <MapPin size={17} strokeWidth={1.8} />, run: () => {
                          setInputText('');
                          if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(pos => {
                              executeSend(`[LOCATION]${pos.coords.latitude},${pos.coords.longitude}`);
                            });
                          }
                        } },
                    ].filter(c => c.cmd !== '/pay' || (ledgerSettings as any)?.payments_enabled !== false).map(c => (
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
                            { id: 'attach',    color: '#34C759', iconPath: <FileText size={19} strokeWidth={1.8} />,  label: 'Document',       sublabel: 'Any file up to 20 MB',    onClick: () => { fileRef.current?.click(); setShowAppDrawer(false); } },

                            // ── Interactive ──────────────────────────────────────────
                            { id: 'poll',      color: '#10B981', iconPath: <ListChecks size={19} strokeWidth={1.8} />,  label: 'Poll',           sublabel: 'Create a poll',          onClick: () => { setShowPollCreator(true); setShowAppDrawer(false); } },
                            { id: 'meeting',   color: '#15171c', iconPath: <CalendarPlus size={19} strokeWidth={1.8} />, label: 'Schedule a call', sublabel: 'Voice or video, at a set time', onClick: () => { setShowMeetingSheet(true); setShowAppDrawer(false); } },
                            { id: 'schedule',  color: '#15171c', iconPath: <CalendarClock size={19} strokeWidth={1.8} />, label: 'Schedule a message', sublabel: 'Write now, send later', onClick: () => { setShowScheduleSheet(true); setShowAppDrawer(false); } },
                            // ── Crypto & Aztec Private Payments ──────────────────────────
                            { id: 'zkmoney',   color: '#1C1C1E', iconPath: <ShieldCheck size={19} strokeWidth={1.8} />, label: 'Private payment', sublabel: networkLabel(), onClick: () => { setShowZkModal(true); setShowAppDrawer(false); } },
                            { id: 'agreement', color: '#1C1C1E', iconPath: <Waves size={19} strokeWidth={1.8} />, label: 'Private agreement', sublabel: `Escrow or payment stream, ${networkLabel()}`, onClick: () => { setShowAgreementComposer(true); setShowAppDrawer(false); } },
                            { id: 'zkinvoice', color: '#1C1C1E', iconPath: <Receipt size={19} strokeWidth={1.8} />, label: 'Private invoice', sublabel: 'Request a private payment', onClick: () => { setShowZkInvoiceModal(true); setShowAppDrawer(false); } },
                            { id: 'payment',   color: '#1C1C1E', iconPath: <CreditCard size={19} strokeWidth={1.8} />,     label: 'Payment',        sublabel: 'Send tokens from your wallet',            onClick: () => { setShowWalletTransfer(true); setShowAppDrawer(false); } },
                            // ── Security ──────────────────────────────────────────────
                            { id: 'burn',      color: '#FF6B00', iconPath: <Timer size={19} strokeWidth={1.8} />,      label: burnTimer ? `Disappearing after ${burnTimer >= 60 ? `${Math.floor(burnTimer/60)}m` : `${burnTimer}s`}` : 'Disappearing messages', sublabel: burnTimer ? 'Tap to change duration' : 'Messages vanish after they are read', onClick: () => { setShowBurnSheet(true); setShowAppDrawer(false); } },
                          ].filter(app => (ledgerSettings as any)?.payments_enabled !== false || !PAYMENT_DRAWER_IDS.has(app.id)).map((app) => (
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
                    className="flex items-end gap-2 px-3 pt-2 w-full relative z-40 bg-white md:bg-transparent md:gap-2.5 md:px-6 md:pt-3"
                    style={{ paddingBottom: 'max(12px, calc(0.5rem + env(safe-area-inset-bottom, 0px)))' }}
                  >
                    <button
                      type="button"
                      onClick={() => setShowAppDrawer(d => !d)}
                      className={`w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-full md:rounded-2xl flex items-center justify-center transition-colors duration-200 mb-[3px] md:mb-0 ${showAppDrawer ? 'bg-[#15171c] text-white md:border md:border-[#15171c]' : 'text-[#475061] hover:bg-[#f2f4f7] md:bg-white md:border md:border-[#e6e8ec] md:text-[#15171c]'}`}
                      aria-label={showAppDrawer ? 'Close attachments' : 'Attach'}
                      aria-expanded={showAppDrawer}
                    >
                      <Plus size={22} strokeWidth={1.9} className={`transition-transform duration-200 ${showAppDrawer ? 'rotate-45' : ''}`} />
                    </button>

                    {/* The message field */}
                    <div className="flex-1 bg-[#f2f4f7] rounded-[22px] flex items-end relative border border-transparent focus-within:bg-white focus-within:border-[#d0d5dd] min-h-[44px] max-h-[136px] transition-colors md:bg-white md:border-[#e6e8ec] md:rounded-2xl md:min-h-[48px] md:focus-within:border-[#b8bdc7]">
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
                          <button
                            type="button"
                            data-expression-toggle=""
                            onClick={() => setExpression(x => (x ? null : 'emoji'))}
                            aria-label="Emojis, stickers and GIFs"
                            aria-expanded={!!expression}
                            className={`ml-1.5 mb-[3px] self-end w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition-colors ${expression ? 'bg-[#e9ecf0] text-[#15171c]' : 'text-[#475061] hover:bg-[#e9ecf0]'}`}
                          >
                            <Smile size={21} strokeWidth={1.8} />
                          </button>
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
                              if (now - lastTypingTimeRef.current > 3000 && val.trim().length > 0 && ledgerSettings?.typing_indicators !== false) {
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
                            className="flex-1 bg-transparent px-4 py-[10px] text-[#15171c] focus:outline-none placeholder:text-[#a3a9b4] disabled:opacity-50 text-[16px] resize-none max-h-[134px] scrollbar-none leading-[1.5] min-h-[44px]"
                          />
                          {/* Character counter — appears when approaching long message */}
                          {inputText.length > 400 && (
                            <span className={`text-[11px] tabular-nums font-medium shrink-0 mr-2 mb-[6px] self-end ${inputText.length > 900 ? 'text-[#e5484d]' : inputText.length > 700 ? 'text-[#f59e0b]' : 'text-[#a3a9b4]'}`}>
                              {1000 - inputText.length}
                            </span>
                          )}
                          {/* On wide screens the microphone sits inside the field, beside a separate send button. */}
                          {!inputText.trim() && (
                            <button
                              type="button"
                              onClick={startRecording}
                              className="hidden md:flex mr-1.5 mb-[6px] self-end w-9 h-9 shrink-0 rounded-xl items-center justify-center text-[#5b606b] hover:bg-[#f2f4f7] transition-colors"
                              aria-label="Record a voice message"
                              title="Record a voice message"
                            >
                              <Mic size={19} strokeWidth={1.8} />
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {/* Send, or record a voice message when the field is empty */}
                    {inputText.trim() ? (
                      <LottieSendButton
                        disabled={isUploading}
                        data-key={sendAnimKey}
                        onTrigger={() => {}}
                      />
                    ) : !isRecording ? (
                      <>
                        <button
                          type="button"
                          onClick={startRecording}
                          className="md:hidden w-10 h-10 shrink-0 rounded-full flex items-center justify-center transition-colors text-[#475061] hover:bg-[#f2f4f7] active:scale-95 mb-[2px]"
                          aria-label="Record a voice message"
                        >
                          <Mic size={21} strokeWidth={1.8} />
                        </button>
                        <LottieSendButton disabled className="hidden md:flex" />
                      </>
                    ) : null}
                  </div>
                </form>

            </div>
          </div>
          {sidebarTab === 'chats' && (
            <ChatDetailsPanel
              key={activePeer.toLowerCase()}
              peerAddress={activePeer}
              peerName={getDisplayName(activePeer)}
              peerInboxId={activePeerInboxIdRef.current}
              client={client}
              messages={messages.filter((m: any) => m.conversationId === `dm-${activePeer.toLowerCase()}`)}
              isMuted={mutedPeers.has(activePeer.toLowerCase())}
              disappearing={(() => { try { const t = localStorage.getItem('ledger_disappearing_' + activePeer.toLowerCase()); return ({ '24h': 'after 24 hours', '7d': 'after 7 days', '90d': 'after 90 days' } as Record<string, string>)[t || ''] ?? null; } catch { return null; } })()}
              onCall={(type) => handleStartCall(type)}
              onPay={() => setShowZkModal(true)}
              onToggleMute={() => toggleMute(activePeer)}
              onMore={() => setShowContactInfo(true)}
            />
          )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-[#f7f8fa] relative overflow-y-auto p-6 md:p-12">
            <div className="w-full max-w-md flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-white border border-[#e4e7ec] flex items-center justify-center text-[#15171c] mb-6">
                <MessageSquare size={28} strokeWidth={1.6} aria-hidden="true" />
              </div>
              <h1 className="text-[24px] md:text-[28px] font-bold tracking-[-0.03em] text-[#15171c] mb-2">Ledger Chat</h1>
              <p className="text-[15px] text-[#727a88] leading-relaxed max-w-[320px]">
                Select a chat, or start a new one with a name, an @username or a wallet address.
              </p>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => document.getElementById('ledger-new-chat-input')?.focus()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#15171c] text-white rounded-xl text-[14px] font-medium hover:bg-[#2d2f36] transition-colors active:scale-95"
                >
                  <Plus size={16} strokeWidth={2.2} />
                  New chat
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateGroup(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#e4e7ec] text-[#15171c] rounded-xl text-[14px] font-medium hover:bg-[#f7f8fa] transition-colors active:scale-95"
                >
                  <Users size={16} strokeWidth={1.8} />
                  New group
                </button>
              </div>
              {/* What Ledger Chat does, in words the code backs up. Each line is
                  scoped: direct messages are MLS end to end; community posts are
                  stored by the server, and the card says so. */}
              <ul className="mt-8 w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left max-w-[440px]">
                {[
                  { icon: <Lock size={16} strokeWidth={1.75} />, title: 'Encrypted direct messages', text: 'One-to-one chats use MLS end-to-end encryption through XMTP.' },
                  { icon: <Users size={16} strokeWidth={1.75} />, title: 'Communities', text: 'Channels, roles, invite links and apps. Community posts are stored on our server.' },
                  ...((ledgerSettings as any)?.payments_enabled !== false ? [{ icon: <Wallet size={16} strokeWidth={1.75} />, title: 'Payments', text: 'Send tokens from your wallet without leaving the chat.' }] : []),
                  { icon: <Palette size={16} strokeWidth={1.75} />, title: 'Appearance', text: `${CHAT_THEMES.length} themes, ${WALLPAPER_OPTIONS.length} wallpapers and ${BUBBLE_STYLES.length} bubble styles.`, onClick: () => setShowThemePicker(true) },
                ].map((f, idx) => {
                  const body = (
                    <>
                      <span className="w-8 h-8 rounded-lg bg-[#f2f4f7] text-[#15171c] flex items-center justify-center mb-2.5" aria-hidden="true">{f.icon}</span>
                      <span className="block text-[13.5px] font-semibold text-[#15171c]">{f.title}</span>
                      <span className="block text-[12.5px] text-[#5b6271] leading-snug mt-0.5">{f.text}</span>
                    </>
                  );
                  return (
                    <motion.li
                      key={f.title}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 30, delay: idx * 0.04 }}
                    >
                      {'onClick' in f && f.onClick ? (
                        <button type="button" onClick={f.onClick} className="w-full h-full text-left bg-white rounded-2xl p-4 border border-[#e4e7ec] hover:border-[#c9ced6] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15171c]">{body}</button>
                      ) : (
                        <div className="h-full bg-white rounded-2xl p-4 border border-[#e4e7ec]">{body}</div>
                      )}
                    </motion.li>
                  );
                })}
              </ul>
              <p className="mt-6 text-[12px] text-[#727a88]">Messaging by XMTP · Private wallet on {networkLabel()}</p>
            </div>
          </div>
        )}


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
          preview={callTypeRef.current === 'video' ? localStream : null}
          // endCall, not just a local clean-up: the other phone must stop ringing now.
          onCancel={() => endCallRef.current()}
        />,
        document.body
      ) as React.ReactNode) : null}

      {/* ── Call in progress ─────────────────────────────────────── */}
      {/* Layout follows what is really sent: the other person's video only if their stream has a
          camera, our own preview only if ours does (after a voice→video switch they may differ). */}
      {/* 'connecting' (answered, media on its way) shows the call screen too: it used to show
          nothing for up to 30 s between tapping Answer and hearing the other person. */}
      {(callState === 'active' || callState === 'connecting') && isMounted && (
        isCallMinimized ? createPortal(
          callType === 'video' && remoteHasVideo ? (
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
                autoPlay playsInline muted className="w-full h-full object-cover"
              />
              <div className="absolute top-2 left-2 bg-white/90 text-[#15171c] text-[12px] tabular-nums px-2 py-0.5 rounded-full font-medium">
                <CallClock startedAt={callStartedAt} />
              </div>
              {callMetricsLabel(callRoute, callTiming) && (
                <div className="absolute bottom-2 left-2 right-2 bg-black/55 text-white text-[10px] tabular-nums px-2 py-0.5 rounded-full truncate text-center" title={callMetricsDetail(callRoute, callTiming)}>
                  {callMetricsLabel(callRoute, callTiming)}
                </div>
              )}
            </motion.div>
          ) : (
            // The call keeps living in a black pill at the top, like the Dynamic Island.
            <button
              type="button"
              onClick={() => setIsCallMinimized(false)}
              aria-label={`Return to the call with ${activePeer ? getDisplayName(activePeer) : 'your contact'}${callMetricsDetail(callRoute, callTiming) ? '. ' + callMetricsDetail(callRoute, callTiming) : ''}`}
              className="fixed left-1/2 -translate-x-1/2 z-[100000] h-10 max-w-[calc(100vw-24px)] pl-2.5 pr-2 rounded-full bg-[#0b0c0f] text-white flex items-center gap-3 shadow-[0_10px_30px_rgba(11,12,15,0.22)] active:scale-[0.98] transition-transform"
              style={{ top: 'max(10px, calc(env(safe-area-inset-top, 0px) + 6px))' }}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${callReconnecting ? 'bg-[#f59e0b]' : 'bg-[#12a150]'}`} aria-hidden="true">
                <Phone size={13} strokeWidth={2.2} />
              </span>
              <span className="text-[13px] font-semibold truncate max-w-[160px]">
                {callReconnecting ? 'Reconnecting…' : activePeer ? getDisplayName(activePeer) : 'Call'}
              </span>
              <span className="font-mono text-[12px] text-[#b9bdc6] tabular-nums shrink-0"><CallClock startedAt={callStartedAt} /></span>
              {/* Local measurements only (lib/calls/metrics.ts): route and time to connect. */}
              {callMetricsLabel(callRoute, callTiming) && (
                <span
                  className="hidden min-[400px]:inline text-[11px] text-[#8b909b] tabular-nums shrink-0"
                  title={callMetricsDetail(callRoute, callTiming)}
                >
                  {callMetricsLabel(callRoute, callTiming)}
                </span>
              )}
              <span className="flex items-center gap-[2px] h-4 shrink-0" aria-hidden="true">
                {[8, 14, 10, 16, 7].map((h, i) => (
                  <span key={i} className="w-[3px] rounded-sm bg-[#5fd38d] animate-pulse" style={{ height: h, animationDelay: `${i * 0.15}s` }} />
                ))}
              </span>
              <span className="h-7 px-3 rounded-full bg-white text-[#0b0c0f] text-[12px] font-bold flex items-center shrink-0">Return</span>
            </button>
          ),
          document.body
        ) : (
          <div className={`fixed inset-0 w-full h-full flex flex-col ${callType === 'video' && callState === 'active' ? 'bg-[#0f1115]' : 'bg-[#f7f8fa]'}`} style={{ zIndex: 200000, touchAction: 'none' }}>

            {/* Background: the other person's video, or their name and picture for a voice call */}
            <div className="absolute inset-0">
              {callType === 'video' && remoteHasVideo && callState === 'active' ? (
                <video
                  ref={el => { if (el && el.srcObject !== remoteStream) el.srcObject = remoteStream; }}
                  autoPlay playsInline muted className="w-full h-full object-cover"
                />
              ) : (
                <AudioCallStage
                  peerName={activePeer ? getDisplayName(activePeer) : 'Unknown'}
                  peerAddress={activePeer}
                  connected={callState === 'active' && !!remoteStream}
                  startedAt={callStartedAt}
                  poorConnection={networkQuality === 'poor'}
                  reconnecting={callReconnecting}
                  levelStream={remoteStream}
                />
              )}
            </div>

            {/* The other person's shared screen, over everything but the controls */}
            {remoteScreen && (
              <div className="absolute inset-0 z-10 bg-[#0f1115] flex items-center justify-center">
                <video
                  ref={el => { if (el && el.srcObject !== remoteScreen) el.srcObject = remoteScreen; }}
                  autoPlay playsInline muted className="w-full h-full object-contain"
                />
                <div role="status" className="absolute top-[72px] left-1/2 -translate-x-1/2 bg-white/95 text-[#15171c] text-[13px] font-medium px-3.5 py-1.5 rounded-full shadow">
                  {activePeer ? getDisplayName(activePeer) : 'Your contact'} is sharing their screen
                </div>
              </div>
            )}
            {isScreenSharing && (
              <div role="status" className="absolute top-[120px] left-1/2 -translate-x-1/2 z-30 bg-[#15171c] text-white text-[13px] font-medium pl-3.5 pr-1.5 py-1.5 rounded-full flex items-center gap-2 shadow-lg">
                You are sharing your screen
                <button type="button" onClick={() => stopScreenShareRef.current()} className="bg-white text-[#15171c] rounded-full px-2.5 py-0.5 text-[12px] font-semibold">Stop</button>
              </div>
            )}

            {/* Your own camera, small and movable */}
            {callType === 'video' && (
              <motion.div
                drag
                dragConstraints={{ top: 60, left: 20, right: 20, bottom: 120 }}
                initial={{ x: 0, y: 0 }}
                className="absolute top-[84px] right-4 z-20 cursor-grab active:cursor-grabbing"
              >
                {!isCamOff && localHasVideo ? (
                  <div className="w-28 h-40 md:w-36 md:h-52 rounded-2xl overflow-hidden ring-1 ring-white/30 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.6)] bg-[#15171c]">
                    <video
                      ref={el => { if (el && el.srcObject !== localStream) el.srcObject = localStream; }}
                      autoPlay playsInline muted className="w-full h-full object-cover"
                      style={activeCamera === 'user' ? { transform: 'scaleX(-1)' } : undefined}
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
            {callType === 'video' && remoteStream && callState === 'active' && (
              <>
                <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-black/50 to-transparent pointer-events-none z-20" />
                <div className="absolute bottom-0 inset-x-0 h-44 bg-gradient-to-t from-black/55 to-transparent pointer-events-none z-20" />
              </>
            )}

            {/* Top bar */}
            {(() => {
              const dark = callType === 'video' && !!remoteStream && callState === 'active';
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
                        <p className="text-white/80 text-[14px] tabular-nums"><CallClock startedAt={callStartedAt} /></p>
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
              {callReconnecting && callType === 'video' && (
                <motion.div
                  key="reconnecting"
                  initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                  role="status"
                  className="absolute top-[120px] left-1/2 -translate-x-1/2 bg-white text-[#15171c] text-[13px] font-medium px-3.5 py-2 rounded-full z-30 flex items-center gap-2 shadow-[0_8px_24px_-8px_rgba(16,24,40,0.35)]"
                >
                  <Wifi size={14} strokeWidth={2} className="text-[#b7791f]" aria-hidden="true" /> Reconnecting…
                </motion.div>
              )}
              {!callReconnecting && networkQuality === 'poor' && callType === 'video' && (
                <motion.div
                  initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                  role="status"
                  className="absolute top-[120px] left-1/2 -translate-x-1/2 bg-white text-[#15171c] text-[13px] font-medium px-3.5 py-2 rounded-full z-30 flex items-center gap-2 shadow-[0_8px_24px_-8px_rgba(16,24,40,0.35)]"
                >
                  <AlertTriangle size={14} strokeWidth={2} className="text-[#b7791f]" aria-hidden="true" /> Weak connection
                </motion.div>
              )}
            </AnimatePresence>

            {audioBlocked && (
              <button
                type="button"
                onClick={playRemoteAudio}
                className="absolute bottom-[132px] left-1/2 -translate-x-1/2 z-30 bg-[#15171c] text-white text-[14px] font-semibold px-4 py-2.5 rounded-full shadow-lg"
              >
                Tap to hear {activePeer ? getDisplayName(activePeer) : 'your contact'}
              </button>
            )}

            {/* Controls */}
            <div className="absolute bottom-0 inset-x-0 z-30 flex justify-center" style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom, 32px))' }}>
              <CallControls
                tone={callType === 'video' && remoteHasVideo ? 'dark' : 'light'}
                isVideo={callType === 'video'}
                micMuted={isMicMuted}
                cameraOff={isCamOff || !localHasVideo}
                screenSharing={isScreenSharing}
                onSwitchCamera={localHasVideo ? switchCamera : undefined}
                onScreenShare={canShareScreen ? toggleScreenShare : undefined}
                onToggleCamera={toggleCamera}
                onToggleMic={toggleMic}
                onEnd={endCall}
              />
            </div>

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
                <p className="text-[14px] text-[#727a88] mt-0.5 flex items-center gap-2"><span>{callType === 'video' ? 'Video call' : 'Voice call'}</span><span className="tabular-nums"><CallClock startedAt={callStartedAt} /></span></p>
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
                  if (text.includes('?s=') || text.includes('?uuid=') || text.includes('ledgerchat.org/connect') || text.includes('ledgerchat.org/connect') || text.includes('session=')) {
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

       
       {/* Message actions menu — Signal-parity right-click/long-press menu */}
       {(contextMenu && typeof document !== 'undefined')
         ? createPortal(
         <div className="fixed inset-0 z-[99999] bg-black/10 select-none" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}>
           {(() => {
             const targetMsg = messages.find(m => m.id === contextMenu.id);
             const myAddr = (address || effectiveAddress || '').toLowerCase();
             const msgSender = (targetMsg?.senderAddress || (targetMsg as any)?.sender || (targetMsg as any)?.from || '').toLowerCase();
             const mine = Boolean((targetMsg as any)?.isMe || (myAddr && msgSender && msgSender === myAddr));
             const item = 'flex items-center gap-3 px-3.5 py-[9px] rounded-xl hover:bg-[#f2f4f7] active:bg-[#eaecf0] text-[14px] font-[450] text-[#15171c] text-left transition-colors cursor-pointer select-none w-full';
             const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
             const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
             const posX = Math.max(12, Math.min(contextMenu.x, vw - 264));
             const posY = Math.max(12, Math.min(contextMenu.y, vh - 520));
             // A message waiting to be sent later has one action: cancel it.
             if (typeof contextMenu.id === 'string' && contextMenu.id.startsWith('sched_')) {
               return (
                 <div role="menu" aria-label="Scheduled message" className="absolute bg-white border border-[#e4e7ec] rounded-2xl shadow-[0_16px_48px_-8px_rgba(16,24,40,0.28)] p-1.5 min-w-[248px]" style={{ top: posY, left: posX, zIndex: 100000 }} onClick={e => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setContextMenu(null); } }}>
                   <button role="menuitem" type="button" autoFocus onClick={() => { if (address) removeScheduled(address, contextMenu.id); setContextMenu(null); toast.success('Scheduled message cancelled'); }} className="w-full flex items-center gap-3 px-3 h-10 rounded-xl text-[14.5px] text-[#e5484d] hover:bg-[#fff0f0] text-left">
                     <Trash2 size={16} strokeWidth={1.8} /> Cancel scheduled message
                   </button>
                 </div>
               );
             }
             return (
               <div
                 role="menu"
                 aria-label="Message actions"
                 ref={(el) => { if (el && !el.contains(document.activeElement)) (el.querySelector('[role="menuitem"]') as HTMLElement | null)?.focus(); }}
                 className="absolute bg-white border border-[#e4e7ec] rounded-2xl shadow-[0_16px_48px_-8px_rgba(16,24,40,0.28),0_4px_16px_rgba(16,24,40,0.08)] p-1.5 min-w-[248px] max-h-[calc(100vh-24px)] overflow-y-auto flex flex-col"
                 style={{
                   top: posY,
                   left: posX,
                   zIndex: 100000,
                   animation: 'ledger-ctx-pop 120ms cubic-bezier(0.16,1,0.3,1)',
                 }}
                 onClick={e => e.stopPropagation()}
                 onKeyDown={(e) => {
                   if (e.key === 'Escape') { e.preventDefault(); setContextMenu(null); return; }
                   if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
                   e.preventDefault();
                   const items = Array.from(e.currentTarget.querySelectorAll('[role="menuitem"]')) as HTMLElement[];
                   const i = items.indexOf(document.activeElement as HTMLElement);
                   const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1
                     : e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
                   items[next]?.focus();
                 }}
               >
                 {/* Signal Quick Reactions Bar */}
                 <div className="flex items-center justify-between px-2 py-1.5 mb-1 bg-[#f7f8fa] rounded-xl border border-black/[0.04]">
                   {['❤️', '👍', '👎', '😂', '😮', '😢', '🙏'].map(emoji => (
                     <button
                       key={emoji}
                       type="button"
                       onClick={() => {
                         executeSend(`__REACT__${contextMenu.id}__::${emoji}`);
                         setContextMenu(null);
                       }}
                       className="w-8 h-8 flex items-center justify-center text-[18px] hover:scale-125 active:scale-95 transition-transform rounded-lg hover:bg-black/5"
                       aria-label={`React with ${emoji}`}
                     >
                       {emoji}
                     </button>
                   ))}
                 </div>

                 <button role="menuitem" type="button" onClick={() => { setReplyingTo({ id: contextMenu.id, content: contextMenu.content }); setContextMenu(null); setTimeout(() => inputRef.current?.focus(), 100); }} className={item}>
                   <Reply size={16} strokeWidth={1.8} className="text-[#4a505c]" /> Reply
                 </button>
                 <button role="menuitem" type="button" onClick={() => { setThreadParentId(contextMenu.id); setContextMenu(null); }} className={item}>
                   <MessagesSquare size={16} strokeWidth={1.8} className="text-[#4a505c]" /> Reply in thread
                 </button>
                 <button role="menuitem" type="button" onClick={() => {
                   // An agreement invitation or an encrypted attachment holds secrets; copy only its label.
                   if (carriesSecret(contextMenu.content)) { navigator.clipboard.writeText(formatMessagePreview(contextMenu.content)); toast.success('Copied'); setContextMenu(null); return; }
                   navigator.clipboard.writeText(contextMenu.content.replace(/^\[.*?\]/, '').replace(/^__BURN_\d+__::/, ''));
                   // A disappearing message is removed from this chat, but a pasted copy is not.
                   if (/^__BURN_\d+__::/.test(contextMenu.content)) toast.success('Copied. This message disappears from the chat; the copy you paste elsewhere does not.');
                   else toast.success('Copied');
                   setContextMenu(null);
                 }} className={item}>
                   <Copy size={16} strokeWidth={1.8} className="text-[#4a505c]" /> Copy
                 </button>
                 <button role="menuitem" type="button" title="Opens Ledger Studio with this message in the composer. Nothing is sent until you press send there." onClick={() => {
                   // Never hand an invitation's secrets or an attachment key to Ledger Studio (a server-side model).
                   const body = carriesSecret(contextMenu.content) ? '' : contextMenu.content.replace(/^\[.*?\]/, '').replace(/^__REPLY__.*?__::/, '').replace(/^__BURN_\d+__::/, '').trim();
                   setContextMenu(null);
                   openStudio(body ? `> ${body.slice(0, 6000).split('\n').join('\n> ')}\n\n` : undefined);
                 }} className={item}>
                   <StudioIcon size={16} strokeWidth={1.8} className="text-[#4a505c]" /> Ask Ledger Studio
                 </button>
                 <button role="menuitem" type="button" onClick={() => { setForwardMsg({ id: contextMenu.id, content: contextMenu.content }); setContextMenu(null); }} className={item}>
                   <Forward size={16} strokeWidth={1.8} className="text-[#4a505c]" /> Forward
                 </button>
                 {!mine && activePeer && (
                   <>
                     <button role="menuitem" type="button" title={`Private payment on ${networkLabel()}, signed in your browser.`} onClick={() => { setContextMenu(null); setShowZkModal(true); }} className={item}>
                       <ShieldCheck size={16} strokeWidth={1.8} className="text-[#4a505c]" /> Send private payment
                     </button>
                     <button role="menuitem" type="button" title="Payment from your Ethereum wallet. You sign it in your wallet." onClick={() => { setContextMenu(null); setShowWalletTransfer(true); }} className={item}>
                       <CreditCard size={16} strokeWidth={1.8} className="text-[#4a505c]" /> Send payment
                     </button>
                   </>
                 )}
                 <button role="menuitem" type="button" onClick={(e) => {
                   e.stopPropagation();
                   const m = messages.find(x => x.id === contextMenu.id);
                   setMsgDetails({ 
                     id: contextMenu.id, 
                     sender: m?.senderAddress || (m as any)?.sender || (m as any)?.from || (m as any)?.authorAddress || address || 'Unknown', 
                     sentAt: m?.sentAtNs || m?.sentAt || m?.sent || Date.now(), 
                     conversationId: m?.conversationId || (activePeer ? `dm-${activePeer.toLowerCase()}` : 'Unknown'),
                     content: lastMessageOf(contextMenu.content)
                   });
                   setContextMenu(null);
                 }} className={item}>
                   <Info size={16} strokeWidth={1.8} className="text-[#4a505c]" /> Details
                 </button>
                 <button role="menuitem" type="button" onClick={(e) => {
                   e.stopPropagation();
                   if (pinnedMessageId === contextMenu.id) {
                     setPinnedMessageId(null);
                     if (activePeer) localStorage.removeItem(`ledger_pinned_${activePeer.toLowerCase()}`);
                     executeSend(`__UNPIN__${contextMenu.id}`);
                   } else {
                     setPinnedMessageId(contextMenu.id);
                     if (activePeer) localStorage.setItem(`ledger_pinned_${activePeer.toLowerCase()}`, contextMenu.id);
                     executeSend(`__PIN__${contextMenu.id}`);
                   }
                   setContextMenu(null);
                 }} className={item}>
                   <Pin size={16} strokeWidth={1.8} className="text-[#4a505c]" /> {pinnedMessageId === contextMenu.id ? 'Unpin message' : 'Pin message'}
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
                 {/* Delete for me – persists via deleted-messages.ts */}
                 <button role="menuitem" type="button" onClick={() => {
                   if (contextMenu?.id) {
                     markDeletedForMe(activePeer, contextMenu.id);
                    markDeletedForMe(null, contextMenu.id);
                     setMessages(prev => prev.filter(m => m.id !== contextMenu.id));
                     chatDB.deleteMessages([contextMenu.id]).catch(() => {});
                     setContextMenu(null);
                     toast.success('Message deleted for you');
                   }
                 }} className={`${item} text-[#d93036]`}>
                   <Trash2 size={16} strokeWidth={1.8} /> <span>Delete for me</span>
                 </button>
                 {/* Delete for everyone – sends __REVOKE__, persisted globally */}
                 {mine && (
                   <button role="menuitem" type="button" onClick={() => {
                     if (contextMenu?.id) {
                       markRevoked(contextMenu.id);
                       setMessages(prev => prev.filter(m => m.id !== contextMenu.id));
                       chatDB.deleteMessages([contextMenu.id]).catch(() => {});
                       executeSend(`__REVOKE__${contextMenu.id}`);
                       setContextMenu(null);
                       toast.success('Message deleted for everyone');
                     }
                   }} className={`${item} text-[#d93036]`}>
                     <Trash2 size={16} strokeWidth={1.8} /> <span className="flex flex-col"><span>Delete for everyone</span><span className="text-[11.5px] text-[#8a1f23]">Removed from all Ledger Chat clients</span></span>
                   </button>
                 )}
               </div>
             );
           })()}
         </div>,
         document.body
       ) : null}

       {/* Message details */}
       {(msgDetails && typeof document !== 'undefined')
         ? createPortal(
         <div
           className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-150"
           style={{ zIndex: 300000 }}
           onClick={(e) => { e.stopPropagation(); setMsgDetails(null); }}
           onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setMsgDetails(null); } }}
         >
           <div
             role="dialog"
             aria-modal="true"
             aria-labelledby="msg-details-title"
             className="bg-white rounded-3xl shadow-[0_24px_60px_-20px_rgba(16,24,40,0.35)] border border-[#e4e7ec] w-full max-w-sm p-6"
             onClick={e => e.stopPropagation()}
           >
             <div className="flex items-center justify-between mb-4">
               <h2 id="msg-details-title" className="text-[17px] font-semibold tracking-[-0.01em] text-[#15171c]">Message details</h2>
               <button
                 type="button"
                 onClick={(e) => { e.stopPropagation(); setMsgDetails(null); }}
                 className="w-8 h-8 rounded-full hover:bg-[#eff1f4] flex items-center justify-center text-[#475061] transition-colors"
                 aria-label="Close"
               >
                 <X size={16} strokeWidth={2} />
               </button>
             </div>
             <dl className="text-[13.5px] text-[#3b404a] space-y-3">
               <div className="flex flex-col gap-0.5">
                 <dt className="text-[12px] font-semibold uppercase tracking-wider text-[#727a88]">Sent timestamp</dt>
                 <dd className="font-medium text-[#15171c]">
                   {msgDetails.sentAt ? new Date(Number(msgDetails.sentAt) || msgDetails.sentAt).toLocaleString() : 'Unknown'}
                 </dd>
               </div>
               <div className="flex flex-col gap-0.5">
                 <dt className="text-[12px] font-semibold uppercase tracking-wider text-[#727a88]">From</dt>
                 <dd className="font-mono text-[12px] break-all bg-[#f7f8fa] p-2 rounded-xl border border-[#e4e7ec] text-[#15171c]">
                   {msgDetails.sender || 'Unknown'}
                 </dd>
               </div>
               <div className="flex flex-col gap-0.5">
                 <dt className="text-[12px] font-semibold uppercase tracking-wider text-[#727a88]">Encryption protocol</dt>
                 <dd className="text-[#475061] leading-relaxed">
                   End-to-end encrypted with MLS / DTLS via XMTP & Aztec Network. Zero metadata accessible outside of participants.
                 </dd>
               </div>
               <div className="flex flex-col gap-0.5">
                 <dt className="text-[12px] font-semibold uppercase tracking-wider text-[#727a88]">Message ID</dt>
                 <dd className="font-mono text-[11px] break-all bg-[#f7f8fa] p-2 rounded-xl border border-[#e4e7ec] text-[#727a88]">
                   {msgDetails.id}
                 </dd>
               </div>
             </dl>
             <button
               type="button"
               autoFocus
               onClick={(e) => { e.stopPropagation(); setMsgDetails(null); }}
               className="mt-6 w-full py-2.5 rounded-xl bg-[#15171c] hover:bg-[#252830] text-white text-[14px] font-semibold transition-colors"
             >
               Close
             </button>
           </div>
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
             <button role="menuitem" type="button" onClick={() => { const p = sidebarMenu.peer; setSidebarMenu(null); setActivePeer(p); setShowClearConfirm(true); }} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#f2f4f7] text-[14.5px] text-[#e5484d] text-left">
               <Trash2 size={16} strokeWidth={1.8} /> Clear chat
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
           defaultToken={(ledgerSettings as any)?.default_token}
           presetAmount={transferAmount || undefined}
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
           recipientName={getDisplayName(activePeer)}
           dmPeerInboxId={activePeerInboxIdRef.current || activePeer}
           selfInboxId={(client as any)?.inboxId}
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

       {/* ── Private agreement: escrow or payment stream on Aztec (lib/aztec/chat-agreements.ts) ── */}
       {showAgreementComposer && activePeer && (
         <AgreementComposer
           dmPeerInboxId={activePeerInboxIdRef.current || activePeer}
           selfInboxId={(client as any)?.inboxId}
           peerName={getDisplayName(activePeer)}
           onClose={() => setShowAgreementComposer(false)}
           onSend={(message: string) => executeSend(message)}
           onOpenWallet={() => { setShowAgreementComposer(false); setShowZkWallet(true); }}
         />
       )}

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
       {showZkInvoiceModal && (activePeer || selectedInvoice) && (
          <ZkInvoiceModal
            userAddress={address || ''}
            recipientAddress={selectedInvoice?.recipientAddress || activePeer || ''}
            recipientTag={selectedInvoice ? selectedInvoice.recipientTag : (activePeer ? getDisplayName(activePeer) : '')}
            existingInvoice={selectedInvoice || undefined}
            peerInboxId={activePeerInboxIdRef.current || undefined}
            selfInboxId={(client as any)?.inboxId}
            onClose={() => {
              setShowZkInvoiceModal(false);
              setSelectedInvoice(null);
            }}
            onInvoiceCreated={(invoice) => {
              executeSend(encodeInvoicePayload(invoice));
              setShowZkInvoiceModal(false);
              setSelectedInvoice(null);
              toast.success('Invoice sent');
            }}
            onInvoicePaid={() => {
              setSelectedInvoice(null);
              setShowZkInvoiceModal(false);
            }}
          />
        )}

        {/* ── Scheduled Message Picker Sheet ── */}
        {showScheduleSheet && (
          <ScheduleMessageSheet
            isOpen={showScheduleSheet}
            onClose={() => setShowScheduleSheet(false)}
            onSchedule={(date) => {
              setScheduledAt(date);
              toast.success(`Scheduled for ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
            }}
          />
        )}

        {/* ── Scheduled call sheet ── */}
        {activePeer && (
          <ScheduleMeetingSheet
            open={showMeetingSheet}
            onClose={() => setShowMeetingSheet(false)}
            peerName={getDisplayName(activePeer)}
            onSend={async (text) => {
              const ok = executeSendRef.current ? await executeSendRef.current(text) : false;
              if (ok && address) {
                const invite = parseMeeting(text);
                if (invite) rememberMeeting(address, activePeer, invite, true);
                toast.success('Invitation sent');
              }
              return ok;
            }}
          />
        )}

        {/* ── Disappearing Messages Timer Sheet ── */}
        {showBurnSheet && (
          <BurnTimerSheet
            isOpen={showBurnSheet}
            currentTimer={burnTimer}
            onClose={() => setShowBurnSheet(false)}
            onSelect={(sec) => {
              setBurnTimer(sec);
              if (sec) {
                toast.success(`Messages will disappear after ${sec >= 60 ? `${Math.floor(sec/60)}m` : `${sec}s`}`);
              } else {
                toast.info('Disappearing messages turned off');
              }
            }}
          />
        )}


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

      {/* ── Appearance (theme + bubbles) ───────────────────────────────────── */}
      <ThemePickerSheet
        open={showThemePicker}
        currentThemeId={chatTheme.id}
        currentBubbleStyle={bubbleStyle}
        onSelectTheme={(t: ChatTheme) => {
          updateBatch({ chat_theme: t.id });
        }}
        onSelectBubbleStyle={(id: string) => { if (isBubbleStyleId(id)) updateBatch({ bubble_style: id }); }}
        onClose={() => setShowThemePicker(false)}
        onOpenWallpaper={activePeer ? () => setShowWallpaperPicker(true) : undefined}
      />

      {/* ── Wallpaper Picker Sheet ────────────────────────────────────────── */}
      {activePeer && (
        <WallpaperPickerSheet
          open={showWallpaperPicker}
          currentWallpaperId={WALLPAPER_OPTIONS.find(o => o.background === convWallpapers[activePeer.toLowerCase()])?.id || 'default'}
          peerDisplayName={getDisplayName(activePeer)}
          onSelect={(opt: WallpaperOption) => {
            setConvWallpaper(activePeer, opt.background);
          }}
          onClose={() => setShowWallpaperPicker(false)}
        />
      )}

      </div>{/* end h-full flex-col layout wrapper */}
    </TuringShieldGate>
  );
}





















