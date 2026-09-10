// @ts-nocheck
"use client";
import { MoreVertical, MapPin, Copy, Trash2, UserPlus, Download, Slash, Settings, Clock, Lock, PieChart, Bell, BrainCircuit, Droplet, ShieldCheck, ArrowRightLeft, Radio, LayoutGrid } from 'lucide-react';
import React, { useState, useEffect, useRef, useCallback } from 'react';

import { useChatEngine } from '@/context/ChatEngineProvider';
import { createPortal } from 'react-dom';
import { Video, VideoOff, Phone, PhoneOff, Mic, MicOff, Volume2, Smile, Paperclip, BarChart2, Wallet, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import type Peer from 'peerjs';
import { useSystemAccount } from '@/hooks/useSystemAccount';
import { useSignMessage, useReconnect } from 'wagmi';
import { sendViaOnion, registerAsRelay } from '@/lib/onion/OnionRouter';
import { useAppKit } from '@reown/appkit/react';
import { getXMTPClient, canReceiveMessages, sendMessage, getMessages, destroyXMTPClient, nsToDate, discoverNewPeers, streamMessages, resolveSenderAddress, extractPeerAddress, revokeXMTPInstallations } from '@/lib/xmtp/client';
import { QrScanner } from '@/components/terminal/QrScanner';
import { TuringShieldGate } from '@/components/auth/TuringShieldGate';
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

import { IncomingCallOverlay } from '@/components/chat/IncomingCallOverlay';
import { SyndicateModal } from '@/components/chat/SyndicateModal';
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

import { LedgerChatSettings, useLedgerSettings } from './LedgerChatSettings';
import { LottieSendButton } from '@/components/chat/LottieSendButton';
import { useDynamicIsland } from '@/lib/store/dynamic-island-store';

import { GroupCallRoom } from '@/components/chat/GroupCallRoom';
import { JoinCallModal } from '@/components/chat/JoinCallModal';
import { WebRTCEngine, Participant } from '@/lib/engine/WebRTCEngine';

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

function Avatar({ address }: { address: string }) {
  const initials = address.slice(2, 4).toUpperCase();
  const hue = parseInt(address.slice(2, 8), 16) % 360;
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0"
      style={{ background: `hsl(${hue},70%,45%)` }}
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

  // [PHASE 2 - SILOING] Consume the sandboxed PXE context for Chat Operations
  // This strictly isolates Chat from the Portfolio state to prevent cross-contamination.
  const { getSiloedPXE } = useAztec();
  const aztecNative = useAztecNative();
  const { spendQDs, balance, aztecAddress, refresh: refreshBalance } = aztecNative;
  const refreshBalanceRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => { refreshBalanceRef.current = refreshBalance; }, [refreshBalance]);

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
  const accentColor = ledgerSettings?.accent_color || '#1c7aff';
  const chatFont = 'inter';
  const textSize = ledgerSettings?.text_size || 4;

  const bgStyle = React.useMemo((): React.CSSProperties => {
    switch (chatBackground) {
      case 'amoled': return { background: '#ffffff' };
      case 'holographic':
        return {
          background: 'linear-gradient(135deg, rgba(240,249,255,1) 0%, rgba(224,231,255,1) 100%)',
        };
      case 'matrix': return { background: '#f8fafc' };
      case 'gradient': return { background: 'linear-gradient(to bottom right, #ffffff, #f1f5f9)' };
      default: return { background: '#ffffff' };
    }
  }, [chatBackground, chatBackgroundCustomUrl]);


  const FONT_MAP: Record<string, string> = {
    'inter': '"Inter", sans-serif',
    'mono': '"JetBrains Mono", monospace',
    'comic': '"Comic Sans MS", "Comic Sans", cursive',
    'serif': '"Merriweather", serif',
    'dyslexic': '"OpenDyslexic", sans-serif'
  };
  const fontFamily = FONT_MAP[chatFont || 'inter'] || FONT_MAP['inter'];
  const fontSizePx = (textSize || 2) * 2 + 6;

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
  const [isInitTimeout, setIsInitTimeout] = useState(false);
  const initTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [initError, setInitError] = useState<string>('');
  
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
               toast.error('User not found: ' + to);
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
  }, [isMounted, address, client]);

  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [activePeer, setActivePeer] = useState<string | null>(null);
  const [localContacts, setLocalContacts] = useState<LocalContact[]>([]);
  const [replyingTo, setReplyingTo] = useState<any | null>(null); // Phase 2: Message Quoting
  
  // High-End Feature States
  const [showCallHistory, setShowCallHistory] = useState(false);
  const [showVoiceNote, setShowVoiceNote] = useState(false);
  const { peerStatus, broadcastTyping } = useLedgerChatPresence(address || '', activePeer);

  // ── v2: Telegram-Parity state ──────────────────────────────────────────
  const [callHistoryList, setCallHistoryList] = useState<CallRecord[]>([]);
  const [sidebarTab, setSidebarTab] = useState<'chats' | 'calls' | 'contacts' | 'groups'>('chats');
  const [showSaveContactModal, setShowSaveContactModal] = useState(false);
  const [saveContactName, setSaveContactName] = useState('');

  const loadContacts = useCallback(() => {
    if (address) {
      setLocalContacts(getLocalContacts(address));
    }
  }, [address]);

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

  const [showSyndicateModal, setShowSyndicateModal] = useState(false);
  const [showSyndicateModal2, _] = useState(false); // alias
  const [reactionMenu, setReactionMenu] = useState<string | null>(null); // Phase 2: Emoji Reactions
  const [pinnedMessageId, setPinnedMessageId] = useState<string | null>(null); // Phase 3: Pinned
  const [burnTimer, setBurnTimer] = useState<number | null>(null); // Phase 3: Self-Destruct TTL
  
    const { messages, sendMessage: engineSendMessage, startCall: engineStartCall, endCall: engineEndCall, setActivePeer: engineSetActivePeer } = useChatEngine();
    // Dummy setMessages to prevent old effects (like burnTimer) from crashing the syntax or runtime
    const setMessages = (updater: any) => { console.log('setMessages bypassed by Quantum Engine'); };

    // [AEGIS AUDIT FIX] Sync local activePeer with Quantum Engine
    useEffect(() => {
        if (activePeer) engineSetActivePeer(activePeer);
    }, [activePeer, engineSetActivePeer]);
    


  
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

  // Telegram-style features
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showVault, setShowVault] = useState(false);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [showContactRequests, setShowContactRequests] = useState(false);
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
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [showWalletTransfer, setShowWalletTransfer] = useState(false);
  // Phase 5: Poll creator form state (hoisted to satisfy React rules of hooks)
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  // Phase 5: Wallet transfer form state
  const [transferAmount, setTransferAmount] = useState('');
  const [transferSending, setTransferSending] = useState(false);

  // ─── Hito 4: Search, Forward, GIF, Scheduled ──────────────────────────────
  const [searchQuery, setSearchQuery] = useState(''); // in-chat search
  const [showSearch, setShowSearch] = useState(false); // search bar toggle
  const [searchIndex, setSearchIndex] = useState(0); // current match index
  const [forwardMsg, setForwardMsg] = useState<any | null>(null); // message to forward
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null); // scheduled send time
  const [showGifPicker, setShowGifPicker] = useState(false); // GIF picker
  const [showStickerPicker, setShowStickerPicker] = useState(false); // Sticker picker
  const [showAppDrawer, setShowAppDrawer] = useState(false); // iMessage style + menu
  const [gifSearch, setGifSearch] = useState(''); // GIF search query — start empty so user types first
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
  
  // -- GROUP CALLS & NEW WEBRTC ENGINE STATE --
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [groupCallActive, setGroupCallActive] = useState(false);
  const [groupCallRoomId, setGroupCallRoomId] = useState('');
  const [groupCallPassword, setGroupCallPassword] = useState('');
  const [groupCallModerator, setGroupCallModerator] = useState('');
  const [groupCallParticipants, setGroupCallParticipants] = useState<Participant[]>([]);
  const [groupCallLocalStream, setGroupCallLocalStream] = useState<MediaStream | null>(null);
  const [groupCallMuted, setGroupCallMuted] = useState(false);
  const [groupCallCameraOff, setGroupCallCameraOff] = useState(false);
  const [groupCallScreenSharing, setGroupCallScreenSharing] = useState(false);
  const [groupCallMinimized, setGroupCallMinimized] = useState(false);

  
  // Lazy initialize engine once per component mount
  const webrtcEngineRef = useRef<WebRTCEngine | null>(null);
  if (!webrtcEngineRef.current && typeof window !== 'undefined' && effectiveAddress) {
    webrtcEngineRef.current = new WebRTCEngine(effectiveAddress);
    webrtcEngineRef.current.initialize();
  }

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

  // Ringtone state
  const ringtoneRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // ─── Backward compat shims so existing JSX works unchanged ──────────────────
  const callActive = callState === 'active' || callState === 'calling' || callState === 'connecting';
  const incomingCall = callState === 'ringing';

  // Emoji State
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Offline Queue State
  const [isOffline, setIsOffline] = useState(false);
  const [hasAcceptedEula, setHasAcceptedEula] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('ledger_onboarded_' + (effectiveAddress || '0x0')) === 'true' : false);
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
      toast.success(isBlocked ? "User unblocked." : "User blocked. They can no longer message you.");
      return next;
    });
  };

  const reportMessage = async (msgId: string, content: string) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
    setContextMenu(null);
    toast.success("Message reported. Thank you.");
    
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
    toast.success('✅ Chat cleared.');
  };

  // Phase 4: Archive/Unarchive a conversation (persisted to localStorage)
  const toggleArchive = (peer: string) => {
    setArchivedPeers(prev => {
      const next = new Set(prev);
      if (next.has(peer.toLowerCase())) {
        next.delete(peer.toLowerCase());
        toast.success('Chat unarchived.');
      } else {
        next.add(peer.toLowerCase());
        toast.success('Chat archived.');
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
    toast.success('Conversation removed.');
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
  // We keep the last 500 IDs to guarantee deduplication for any reasonable message history.
  const pruneConfirmedIds = useCallback(() => {
    if (confirmedMsgIds.current.size > 500) {
      const arr = Array.from(confirmedMsgIds.current);
      confirmedMsgIds.current = new Set(arr.slice(arr.length - 250));
    }
  }, []);
  // Prune optimisticContentMap — entries lingering >60s were never echoed back (failed send)
  // and should be cleared to prevent unbounded growth.
  const pruneOptimisticMap = useCallback(() => {
    if (optimisticContentMap.current.size > 100) {
      optimisticContentMap.current.clear();
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

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      const container = messagesEndRef.current.parentElement;
      if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
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
    return () => {
      window.removeEventListener('quantum_wakeup_signal', handleWakeup);
      document.removeEventListener('visibilitychange', handleWakeup);
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
              toast.info(`📤 Back online — sending ${queue.length} queued message${queue.length > 1 ? 's' : ''}...`);
              for (const msgContent of queue) {
                if (executeSendRef.current) {
                  await executeSendRef.current(msgContent);
                  await new Promise(r => setTimeout(r, 300)); // throttle to avoid XMTP rate limit
                }
              }
              toast.success('✅ All queued messages delivered.');
            }
          } catch (e) {
            console.warn('[Outbox] Failed to flush queue:', e);
          }
        }
      }
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast.warning('📶 No internet connection. Messages will be queued.');
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

  // Extreme Security: Draft Persistence & Typing Telemetry
  useEffect(() => {
    if (!activePeer || !address) return;
    const draftKey = `ledger_draft_${address.toLowerCase()}_${activePeer.toLowerCase()}`;
    
    if (inputText.trim()) {
      localStorage.setItem(draftKey, btoa(encodeURIComponent(inputText)));
    } else {
      localStorage.removeItem(draftKey);
    }

    // Typing telemetry: only fire when there is actual text
    if (!inputText.trim()) return;
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
  }, [inputText, activePeer, address]);

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
  const ringtoneCtxRef = useRef<AudioContext | null>(null);
  
  const startRingtone = useCallback(() => {
    let ctx: AudioContext | null = null;
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      ringtoneCtxRef.current = ctx;
    } catch { return () => {}; }
    let stopped = false;
    const playRing = () => {
      if (stopped || !ctx) return;
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
    return () => { stopped = true; clearInterval(id); ctx?.close(); };
  }, []);

  const stopRingtone = useCallback(() => {
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
          iceTransportPolicy: 'all' as RTCIceTransportPolicy,
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
          // Remote peer is not connected — this is expected, not a fatal error.
          // Only show an error if we are actively trying to call.
          if (callStateRef.current === 'calling' || callStateRef.current === 'connecting') {
            toast.error('Peer is not available. They may be offline.');
            performEndCallRef.current();
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

    // ── CALL_OFFER: Peer is calling us (XMTP notification only — ring the device) ─
    // [ARCH-FIX] XMTP CALL_OFFER is now only a ring notification.
    // The actual WebRTC connection is initiated by the caller directly via PeerJS WebSocket.
    // The receiver's peer.on('call') will fire immediately from PeerJS, independent of XMTP latency.
    if (content.startsWith('__CALL_OFFER__:')) {
      processedSignalIds.current.add(lastMsg.id);
      const parts = content.split(':');
      const callerPeerId = parts[1];
      const offerCallType: 'audio'|'video' = (parts[2] as any) || 'audio';
      
      // ─── REVERSE-DIAL ARCHITECTURE ─────────────────────────────────────────
      // We must save the Caller's dynamic PeerID so that when the user clicks
      // "Answer", we know who to initiate the WebRTC connection back to.
      if (callerPeerId) {
        remotePeerIdRef.current = callerPeerId;
      }

      if (callStateRef.current === 'idle') {
        setCallType(offerCallType);
        isCallerRef.current = false;
        setCallState('ringing');
        startRingtone();
      }
      console.log('[Ledger Chat:Signal] CALL_OFFER received, callerPeerId:', callerPeerId, 'type:', offerCallType);
    }

    // ── CALL_ANSWER signal from receiver (kept for compatibility / fallback logging) ─
    // [ARCH-FIX] The caller NO LONGER waits for CALL_ANSWER to dial.
    // The caller already called peerInstance.call() immediately in startCall().
    // This signal is kept for potential future use (e.g., logging, compatibility with
    // older clients) but does NOT trigger any WebRTC action in the new architecture.
    if (content.startsWith('__CALL_ANSWER__:')) {
      processedSignalIds.current.add(lastMsg.id);
      console.log('[Ledger Chat:Signal] CALL_ANSWER (ack) received — WebRTC already initiated directly.');
    }

    // ── CALL_DECLINE: Callee declined ──────────────────────────────────────────
    if (content === '__CALL_DECLINE__') {
      processedSignalIds.current.add(lastMsg.id);
      if (callState !== 'idle') {
        performEndCallRef.current();
        toast('📵 Call declined.');
      }
    }

    // ── CALL_HANGUP: Remote party hung up ─────────────────────────────────────
    if (content === '__CALL_HANGUP__') {
      processedSignalIds.current.add(lastMsg.id);
      if (callState !== 'idle') {
        performEndCallRef.current();
        toast('📵 Call ended by peer.');
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
            stats.forEach((report: any) => {
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
      toast.error("WebRTC is not ready. Reconnecting… please try again in a moment.");
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
      const myStablePeerId = derivePeerId(address!);
      executeSend(`__CALL_OFFER__:${myStablePeerId}:${type}`).catch(() => {});

      // Directly dial the receiver via PeerJS — no XMTP round-trip needed
      const livePeerForStart = peerInstanceRef.current;
      if (livePeerForStart && !livePeerForStart.destroyed) {
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
      }
      toast.success('Ringing...');

      // Caller timeout: if no stream arrives in 60s, clean up
      callTimeoutRef.current = setTimeout(() => {
        if (callStateRef.current === 'calling') {
          toast.error('No answer — call timed out.');
          performEndCallRef.current();
        }
      }, 60000);

    } catch (e: any) {
      if (stream) { try { stream.getTracks().forEach(t => t.stop()); } catch {} }
      setLocalStream(null);
      setCallState('idle');
      isCallerRef.current = false;
      const errName = e?.name || '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        toast.error('Mic/Camera access denied. If allowed in OS, check Chrome Site Settings or open outside of in-app browsers (Telegram/Twitter).', { duration: 6000 });
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        toast.error('No microphone or camera found on this device.');
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        toast.error('Camera/Microphone is in use by another app. Please close it.', { duration: 6000 });
      } else {
        toast.error(`Call failed: ${e?.message || 'Unknown error'}`);
      }
      console.error('[Call] getUserMedia error:', e);
    }
  };

  // ─── answerCall: Receiver accepts incoming call ──────────────────────────────
  // --- GROUP CALLS LOGIC ---
  useEffect(() => {
    const handleParticipantsUpdated = (e: any) => {
      setGroupCallParticipants(e.detail.participants);
    };
    const handleCallEnded = () => {
      setGroupCallActive(false);
      setGroupCallParticipants([]);
      setGroupCallLocalStream(null);
      setGroupCallRoomId('');
      setGroupCallModerator('');
      toast('Group call ended');
    };
    
    window.addEventListener('webrtc_participants_updated', handleParticipantsUpdated);
    window.addEventListener('webrtc_call_ended', handleCallEnded);
    return () => {
      window.removeEventListener('webrtc_participants_updated', handleParticipantsUpdated);
      window.removeEventListener('webrtc_call_ended', handleCallEnded);
    };
  }, []);

  const createGroupCall = async (password: string) => {
    try {
      const res = await fetch('/api/call/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, isVideo: true })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setGroupCallRoomId(data.roomId);
      setGroupCallModerator(data.moderatorAddress);
      setGroupCallPassword(password);
      
      const stream = await webrtcEngineRef.current?.getLocalStream(true);
      if (stream) setGroupCallLocalStream(stream);
      setGroupCallActive(true);
      setGroupCallMinimized(false);
      toast.success('Secure group call room created');
      
      // Drop an invite into the current active chat if available
      if (activePeer && executeSendRef.current) {
        executeSendRef.current(`__CALL_GROUP_CREATED__::${data.roomId}::${password || ''}`);
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to create room');
    }
  };

  const handleJoinSuccess = async (data: any, localStream: MediaStream, isMuted: boolean, isCameraOff: boolean) => {
    setShowJoinModal(false);
    setGroupCallRoomId(data.roomId);
    setGroupCallModerator(data.moderatorAddress);
    
    // Set the state from the pre-join lobby
    setGroupCallLocalStream(localStream);
    setGroupCallMuted(isMuted);
    setGroupCallCameraOff(isCameraOff);
    setGroupCallActive(true);
    setGroupCallMinimized(false);

    // Call the host to join the mesh
    if (data.hostAddress && data.hostAddress !== effectiveAddress) {
      webrtcEngineRef.current?.setLocalStream(localStream); // Update engine's local stream if needed
      webrtcEngineRef.current?.callParticipant(data.hostAddress, true);
    }
  };

  const leaveGroupCall = async () => {
    if (groupCallRoomId) {
      await fetch(`/api/call/room/${groupCallRoomId}/join`, { method: 'DELETE' }).catch(() => {});
    }
    webrtcEngineRef.current?.endCall();
    setGroupCallActive(false);
  };

  const handleKickParticipant = async (targetAddress: string) => {
    if (!groupCallRoomId) return;
    try {
      const res = await fetch(`/api/call/room/${groupCallRoomId}/moderate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'kick', targetAddress })
      });
      if (res.ok) {
        webrtcEngineRef.current?.removeParticipant(targetAddress);
        toast.success(`Removed ${targetAddress.slice(0,6)} from call`);
      }
    } catch { toast.error('Failed to kick participant'); }
  };

  const handleTransferModerator = async (targetAddress: string) => {
    if (!groupCallRoomId) return;
    try {
      const res = await fetch(`/api/call/room/${groupCallRoomId}/moderate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'transfer', targetAddress })
      });
      if (res.ok) {
        setGroupCallModerator(targetAddress);
        toast.success(`Moderator transferred`);
      }
    } catch { toast.error('Failed to transfer moderator'); }
  };
  // -------------------------

  // ANDROID FIX: Called directly from the "Answer" onClick — preserves user-gesture
  // context required by Android Chrome for getUserMedia.
  const answerCall = async () => {
    stopRingtone();
    // [ANDROID FIX] Use callStateRef.current instead of the stale React state closure.
    if (callStateRef.current !== 'ringing') return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error('Your browser does not support media access. Please use Chrome.');
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
      toast.success('Answering call...');

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
        const targetPeerId = remotePeerIdRef.current || derivePeerId(activePeer!);
        const livePeer = peerInstanceRef.current;
        if (!livePeer || livePeer.destroyed) {
          toast.error('WebRTC: Peer connection not ready. Please refresh.');
          performEndCallRef.current();
          return;
        }

        const conn = livePeer.call(targetPeerId, stream, {
          metadata: { callType: callTypeRef.current }
        });
        if (!conn) {
          toast.error('WebRTC: Failed to initiate connection.');
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
          toast.error('Call timed out — no media stream received.');
          performEndCallRef.current();
        }
      }, 20000);

    } catch (e: any) {
      if (stream) { try { stream.getTracks().forEach(t => t.stop()); } catch {} }
      setLocalStream(null);
      setCallState('idle');
      
      // Tell the caller immediately that we couldn't answer due to hardware/permission failure
      executeSend('__CALL_DECLINE__').catch(() => {});

      const errName = e?.name || '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        toast.error('Mic/Camera access denied. If allowed in OS, check Chrome Site Settings or open outside of in-app browsers (Telegram/Twitter).', { duration: 6000 });
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        toast.error('No microphone or camera found on this device.');
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        toast.error('Camera/Microphone is in use by another app. Please close it.', { duration: 6000 });
      } else {
        toast.error(`Failed to answer call: ${e?.message || 'Unknown error'}`);
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
        direction: 'outgoing',
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
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: nextIsolation,
          autoGainControl: true
        }
      });
      const newAudioTrack = newStream.getAudioTracks()[0];
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
      toast.error('Failed to change voice isolation settings.');
    }
  }, [voiceIsolation, isMicMuted]);

  // ─── toggleDataSaver ──────────────────────────────────────────────────────────
  const toggleDataSaver = useCallback(async () => {
    if (!localStreamRef.current || !activeConnectionRef.current || callTypeRef.current !== 'video') return;
    const nextSaver = !dataSaver;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: nextSaver 
          ? { width: { ideal: 480 }, frameRate: { ideal: 15 }, facingMode: activeCamera }
          : { width: { ideal: 1280 }, frameRate: { ideal: 30 }, facingMode: activeCamera }
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
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
      toast.error('Failed to apply data saver mode.');
    }
  }, [dataSaver, activeCamera, isCamOff]);

  // ─── Hardware Media Routing (replaceTrack) ──────────────────────────────────
  const switchCamera = async () => {
    if (!localStreamRef.current || !activeConnectionRef.current) return;
    const newFacingMode = activeCamera === 'user' ? 'environment' : 'user';
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: newFacingMode } },
        audio: false
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
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
      toast.error('Rear camera not found or access denied.');
      // Fallback if exact fails
      try {
         const newStream = await navigator.mediaDevices.getUserMedia({
           video: { facingMode: newFacingMode }, audio: false
         });
         const newVideoTrack = newStream.getVideoTracks()[0];
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
      } catch (err) {}
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
          toast.error('Screen sharing is not supported on this device/browser.');
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
      toast.error('Screen sharing cancelled or unsupported.');
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
      // [iOS FIX] Safari does NOT support audio/webm or audio/webm;codecs=opus.
      // It only supports audio/mp4 (AAC). We must check in correct priority order.
      const mimeType = MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
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

        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        if (blob.size < 1000) {
            console.warn('[Voice] Recording too short, ignoring.');
            setRecordingSeconds(0);
            return;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = reader.result as string;
          
          // XMTP Limit Check: Typical message limit is 1MB. 
          // Base64 overhead is ~33%. A 750KB blob is roughly the safe limit.
          if (dataUrl.length > 1024 * 1024) {
              setInitError('Voice message is too long for the secure P2P network. Please record a shorter message (under 30s).');
              setRecordingSeconds(0);
              return;
          }

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
                await engineSendMessage(activePeer, audioMsg); 
                // Voice: P2P Audio transmission successful.
            } catch (sendErr: any) {
                console.error('[Voice] P2P Send Failed:', sendErr?.message);
                setMessages(prev => prev.filter(m => m.id !== optimisticId));
                setInitError('Failed to transmit secure voice message. Check your connection.');
            }
          } else {
            // [UX FIX] If no peer selected when stopping recording, show a helpful message
            toast.error('Select a contact first to send the voice message.');
          }
        };
        reader.readAsDataURL(blob);

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
          const pRes = await fetch(`/api/chat/pending?address=${address}`, { headers: authHeader, cache: 'no-store' });
          if (pRes.ok) {
             const pData = await pRes.json();
             if (pData.pending && Array.isArray(pData.pending)) {
                 pData.pending.forEach((p: any) => {
                     const peer = p.sender.toLowerCase() === address.toLowerCase() ? p.recipient : p.sender;
                     const existing = merged.find(c => c.peerAddress.toLowerCase() === peer.toLowerCase());
                     if (!existing) {
                         merged.push({ peerAddress: peer, lastMessage: p.content.slice(0, 30), lastAt: new Date(p.timestamp) });
                     } else {
                         if (!existing.lastAt || new Date(p.timestamp) > new Date(existing.lastAt)) {
                             existing.lastMessage = p.content.slice(0, 30);
                             existing.lastAt = new Date(p.timestamp);
                         }
                     }
                 });
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
    setIsInitTimeout(false);
    setInitError('');
    // Safety: show 'Retry' UI after 8s if still waiting (MetaMask popup dismissed/ignored)
    if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current);
    initTimeoutRef.current = setTimeout(() => setIsInitTimeout(true), 8000);

    // HARD DEADLINE — guarantees the UI is NEVER permanently frozen.
    // If XMTP, Aztec, or any await hangs beyond 20s, we force-exit with an error.
    let hardDeadlineCleared = false;
    const hardDeadline = setTimeout(() => {
      if (!hardDeadlineCleared && initInFlight.current) {
        initInFlight.current = false;
        setIsInitializing(false);
        setIsInitTimeout(false);
        if (initTimeoutRef.current) { clearTimeout(initTimeoutRef.current); initTimeoutRef.current = null; }
        setInitError('Connection timed out. Please check your wallet is connected and try again.');
      }
    }, 20000);

    let attempts = 0;
    const maxAttempts = 2; // Reduced from 4 — fewer retries means faster failure feedback


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
        setIsWaitingForSignature(true);
        try {
          let finalMsg = msg;
          if (typeof msg !== 'string') {
              const hex = Array.from(msg as Uint8Array).map((b: number) => b.toString(16).padStart(2, '0')).join('');
              finalMsg = ('0x' + hex) as any;
          }
          const res = await signMessageAsync({ message: finalMsg as any });
          setIsWaitingForSignature(false);
          return res;
        } catch (sigErr: any) {
          setIsWaitingForSignature(false);
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
        // loadConversations in background — does NOT block chat opening
        loadConversations().catch(() => {});

        // Aztec identity mint: completely fire-and-forget, never blocks success path
        const isWalletConnect = connector?.id?.toLowerCase().includes('walletconnect');
        if (isWalletConnect || !isLocalSystemWallet) {
            const mintKey = `qds_identity_mint_${address}`;
            if (typeof localStorage !== 'undefined' && !localStorage.getItem(mintKey)) {
                localStorage.setItem(mintKey, 'true');
                (async () => {
                    try {
                        let targetAztecAddress = aztecAddress;
                        if (!targetAztecAddress) {
                            const deriveRes = await fetch('/api/aztec/derive-address', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ evmAddress: address })
                            });
                            const deriveData = await deriveRes.json();
                            if (deriveData.success) targetAztecAddress = deriveData.aztecAddress;
                        }
                        if (targetAztecAddress) {
                            await fetch('/api/aztec/airdrop', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ address: targetAztecAddress, amount: 10 })
                            });
                        }
                    } catch (e) {
                        console.error('[Aztec] Identity airdrop failed (non-fatal):', e);
                    }
                })();
            }
        }

        // SUCCESS — cancel all safety timers and release init lock
        hardDeadlineCleared = true;
        clearTimeout(hardDeadline);
        setIsInitializing(false);
        setIsInitTimeout(false);
        if (initTimeoutRef.current) { clearTimeout(initTimeoutRef.current); initTimeoutRef.current = null; }
        initInFlight.current = false;
        return; // Success
      } catch (err: any) {
        attempts++;
        const errorMsg = err?.message || '';
        const isReject = err?.code === 4001 || errorMsg.toLowerCase().includes('reject') || errorMsg.toLowerCase().includes('deny');

        // Immediately stop retrying if user actively rejected the prompt
        if (isReject) {
          hardDeadlineCleared = true;
          clearTimeout(hardDeadline);
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
        // Discover new peers from the XMTP network
        const newPeerAddrs = await discoverNewPeers(client, address, knownPeersRef.current);

        if (newPeerAddrs.length > 0 && !cancelled) {
          setConversations(prev => {
            const prevSet = new Set(prev.map(c => c.peerAddress.toLowerCase()));
            const toAdd: ConversationMeta[] = newPeerAddrs
              .filter(a => !prevSet.has(a.toLowerCase()))
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
      } catch (e) {
        console.warn('[Ledger Chat] Global sync error:', e);
      }
    };

    syncGlobal();
    const globalPoll = setInterval(syncGlobal, 6000);

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
    (async () => {
      let streamRestarts = 0;
      while (!cancelled) {
        try {
        const abortController = new AbortController();
          const gen = [] as any; // streamMessages(client, abortController.signal);
        for await (const msg of gen as any) {
          if (cancelled) { abortController.abort(); break; }
          
          const fromPeer = msg.senderInboxId !== selfInboxId;
          const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
          const sentAtNs = nsToDate(msg.sentAtNs ?? msg.sentAt).getTime();
          const currentActivePeer = activePeerRef.current?.toLowerCase();
          
          let resolvedPeerAddr = msg.conversation?.peerAddress?.toLowerCase() || '';
          if (!resolvedPeerAddr) {
            if (fromPeer) {
              const senderAddr = await resolveSenderAddress(msg.senderInboxId, client);
              resolvedPeerAddr = senderAddr?.toLowerCase() || '';
            } else if (msg.conversation) {
              const dmPeer = await extractPeerAddress(msg.conversation, selfInboxId);
              resolvedPeerAddr = dmPeer?.toLowerCase() || '';
            }
          }

          // Ultimate fallback (works for both sender and recipient in v5.3.0)
          if (!resolvedPeerAddr) {
            const convoId = msg.convoId || msg.conversationId || msg.groupId || msg.conversation?.id;
            if (convoId) {
              try {
                let dms = await client.conversations.listDms();
                let dm = dms.find((d: any) => d.id === convoId);
                if (!dm) {
                  // Message from a NEW conversation not yet synced locally!
                  await client.conversations.sync().catch(()=>{});
                  dms = await client.conversations.listDms();
                  dm = dms.find((d: any) => d.id === convoId);
                }
                if (dm) {
                  const dmPeer = await extractPeerAddress(dm, selfInboxId);
                  resolvedPeerAddr = dmPeer?.toLowerCase() || '';
                }
              } catch (e) {
                console.warn('Failed to resolve convoId to peer address', e);
              }
            }
          }
          const msgConvPeer = resolvedPeerAddr;
          const realId = msg.id ?? `real-${sentAtNs}-${Math.random()}`;

          // ── ABSOLUTE DEDUPLICATION GATE ──────────────────────────────────────
          if (confirmedMsgIds.current.has(realId)) continue;
          confirmedMsgIds.current.add(realId);
          pruneConfirmedIds(); // keep Set bounded to last 500 IDs
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
          if (typeof mappedContent === 'string' && mappedContent.startsWith('__PAYMENT__')) {
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

          const belongsToActive = !!msgConvPeer && (msgConvPeer === currentActivePeer);

          if (belongsToActive) {

            setMessages(prev => {
              // Guard: if real ID already in list (can happen on reconnect), skip
              if (prev.some(m => m.id === realId)) return prev;

              if (!fromPeer) {
                // ── OWN MESSAGE ECHO: atomic optimistic swap ──────────────────
                // Strategy 1: look up by content key in optimisticContentMap
                const knownOptId = optimisticContentMap.current.get(content);
                if (knownOptId) {
                  optimisticContentMap.current.delete(finalContent); // consume the entry
                  const idx = prev.findIndex(m => m.id === knownOptId);
                  if (idx !== -1) {
                    const next = [...prev];
                    next[idx] = mappedMsg; // replace placeholder with confirmed msg
                    return next.sort((a, b) => a.sentAtNs - b.sentAtNs);
                  }
                }
                // Strategy 2: fallback — find any optimistic with identical content
                // within a 30-second window (handles slow networks and retry delays)
                const optIdx = prev.findIndex(
                  m => m.id.startsWith('optimistic-') &&
                       m.content === content &&
                       Math.abs(m.sentAtNs - sentAtNs) < 30_000
                );
                if (optIdx !== -1) {
                  const next = [...prev];
                  next[optIdx] = mappedMsg;
                  return next.sort((a, b) => a.sentAtNs - b.sentAtNs);
                }
                // Strategy 3: no optimistic found (e.g. second tab) — insert if not duplicate
                return [...prev, mappedMsg].sort((a, b) => a.sentAtNs - b.sentAtNs);
              }

              // ── PEER MESSAGE: straightforward insert ──────────────────────────
              if (fromPeer && !content.startsWith('__')) {
                // We are focused on this chat, so send a read receipt!
                if (!document.hidden) {
                  if (ledgerSettings?.notification_sound !== false) { playReceiveSound(); };
                  triggerHaptic(ledgerSettings?.haptics_intensity ?? 0);
                  if (ledgerSettings?.show_read_receipts !== false) {
                    engineSendMessage(msgConvPeer, `__READ__${realId}`).catch(e => console.warn('Failed to send read receipt', e));
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

                if (ledgerSettings?.ghost_auto_reply && ledgerSettings?.ghost_auto_reply_text) {
                  const replyText = ledgerSettings.ghost_auto_reply_text;
                  setTimeout(() => {
                     engineSendMessage(msgConvPeer, replyText).catch(e => console.warn('Ghost auto-reply failed', e));
                  }, 1500);
                }
              }
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
              // Phase 5: Push Notifications & Dynamic Island when receiving a message in background chat
              if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                new Notification(`Ledger Chat: ${shortAddr(msgConvPeer || 'Unknown')}`, {
                  body: formatMessagePreview(content),
                  icon: '/favicon.ico'
                });
              }
              // Trigger Dynamic Island
              useDynamicIsland.getState().setState('notification', {
                title: shortAddr(msgConvPeer || 'Unknown'),
                subtitle: formatMessagePreview(content),
              }, 4000);
            }
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
                updated = [{
                  peerAddress: msgConvPeer,
                  lastMessage: content.slice(0, 30),
                  lastAt: new Date()
                }, ...prev];
              }
              persistToLocal(updated);
              return updated;
            });
          }
        }
      } catch (e: any) {
          const errMsg = (e?.message || String(e) || '').toLowerCase();
          // GroupInactive = stale MLS epoch. Silently re-sync and restart stream.
          const isGroupInactive = (
            errMsg.includes('group is inactive') ||
            errMsg.includes('groupinactive') ||
            errMsg.includes('group_inactive') ||
            errMsg.includes('inactive group')
          );
          if (isGroupInactive && streamRestarts < 5 && !cancelled) {
            streamRestarts++;
            const backoffMs = Math.min(1000 * Math.pow(1.5, streamRestarts), 15000);
            console.info(`[Chat] MLS GroupInactive — re-sync + stream restart #${streamRestarts} in ${backoffMs}ms`);
            try { await client.conversations.sync(); } catch {}
            await new Promise(resolve => setTimeout(resolve, backoffMs));
            continue; // restart the while loop → restart stream
          } else if (!cancelled) {
            console.warn('[Chat] global stream failed:', e);
          }
          break; // exit while loop for non-recoverable errors
        }
      } // end while
    })();

    return () => { cancelled = true; clearInterval(globalPoll); };
  }, [client, address]);

  //  Load messages when active peer changes 
  useEffect(() => {
    if (!client || !activePeer) return;

    let cancelled = false;
    let isFetching = false;

    const fetchHistorical = async () => {
      if (isFetching || cancelled) return;
      isFetching = true;
      try {
        let raw = [] as any; // await getMessages(client, activePeer);
        if (cancelled) return;
        
        const clearTsMs = parseInt(localStorage.getItem(`ledger_cleared_${address}_${activePeer.toLowerCase()}`) || '0', 10);
        if (clearTsMs > 0) {
          const clearTsNs = clearTsMs; // Fixed: sentAtNs is actually in MS after mapping
          raw = raw.filter((m: any) => m.sentAtNs > clearTsNs);
        }
        
        // FETCH PENDING MESSAGES (OFFLINE ROUTING)
        let pendingServer: any[] = [];
        try {
          const pRes = await fetch(`/api/chat/pending?address=${address}`, { 
            cache: 'no-store',
            headers: { 'x-web3-address': address || '' }
          });
          if (pRes.ok) {
            const pData = await pRes.json();
            if (pData.pending && Array.isArray(pData.pending)) {
               pendingServer = pData.pending.filter((p: any) => p.sender.toLowerCase() === activePeer.toLowerCase() || p.recipient.toLowerCase() === activePeer.toLowerCase()).map((p: any) => ({
                  id: p.id,
                  // XMTP uses client.inboxId but our fallback uses raw addresses to match UI logic
                  senderInboxId: p.sender.toLowerCase() === activePeer.toLowerCase() ? activePeer : (client?.inboxId || address),
                  content: p.content,
                  sentAtNs: new Date(p.timestamp).getTime(),
                  conversationId: `dm-${activePeer.toLowerCase()}`
               }));
               
               // CONSUME pending messages where we are the RECIPIENT:
               // This clears them from the server queue so they are marked as delivered.
               // Only delete messages addressed TO us — we must not delete messages we sent.
               const hasIncoming = pData.pending.some((p: any) => p.sender?.toLowerCase() !== address?.toLowerCase());
               
               if (hasIncoming) {
                 fetch(`/api/chat/pending?address=${address}`, {
                   method: 'DELETE',
                   headers: { 'x-web3-address': address || '' }
                 }).catch(err => console.warn('[PendingConsume] Failed to clear delivered messages:', err));
               }
            }
          }
        } catch (e) { console.error('Failed to fetch pending messages', e); }
        
        const rawMappedMsgs = raw
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
             if (m.senderInboxId?.toLowerCase() === activePeer.toLowerCase()) {
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
          } else {
             mappedMsgs.push(m);
          }
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
            engineSendMessage(activePeer, `__READ__${lastPeerMsgId}`).catch(e => console.warn('Failed to send read receipt', e));
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
            // Strategy 1: exact match via optimisticContentMap (fastest)
            const knownOptId = optimisticContentMap.current.get(confirmed.content);
            if (knownOptId && existingIds.has(knownOptId)) {
              optimisticToRemove.add(knownOptId);
              optimisticContentMap.current.delete(confirmed.content);
            } else {
              // Strategy 2: content + time window match (handles encoding edge cases)
              const twin = prev.find(
                m => m.id.startsWith('optimistic-') &&
                     m.conversationId === activeId &&
                     m.content === confirmed.content &&
                     Math.abs(m.sentAtNs - confirmed.sentAtNs) < 30_000
              );
              if (twin) optimisticToRemove.add(twin.id);
            }
          }
          
          // Drop only the replaced optimistic twins, keep everything else
          const base = prev.filter(m => !optimisticToRemove.has(m.id));
          return [...base, ...newConfirmed].sort((a, b) => a.sentAtNs - b.sentAtNs);
        });

      } catch (e) {
        console.warn('[Chat] load messages failed:', e);
      } finally {
        isFetching = false;
      }
    };

    fetchHistorical();

    // Fallback polling for the active conversation history
    const pollId = setInterval(fetchHistorical, 5000);

    return () => {
      cancelled = true;
      clearInterval(pollId);
    };
  }, [client, activePeer, address]);

  const handleStartConversationWithPeer = async (peerAddr: string) => {
      if (!client || !peerAddr || sending) return;
      setSending(true);
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
              toast.error(`User not found: ${peer}`);
              setSending(false);
              return;
            }
          } catch {
            toast.error('User search unavailable. Please enter a 0x wallet address.');
            setSending(false);
            return;
          }
        }

        // Accept both EVM (42 chars: 0x + 40) and Aztec (66 chars: 0x + 64) addresses
        if (!/^0x[a-fA-F0-9]{40}([a-fA-F0-9]{24})?$/.test(peer)) {
            toast.error('Invalid address format. Use a wallet address or @username.');
            setSending(false);
            return;
        }

        if (peer) {
            let canMsg = canReceiveCache.current.get(peer.toLowerCase());
            if (canMsg !== true) {
                canMsg = await canReceiveMessages(client, peer);
                if (canMsg) canReceiveCache.current.set(peer.toLowerCase(), true);
            }
            if (!canMsg) {
                // DON'T BLOCK. Tell them we'll queue it.
                toast.info(`Offline Routing: ${peer.slice(0,6)} is not registered on XMTP. Messages will be routed via System Vault until they connect.`);
            }
        }

        const newConv = { peerAddress: peer, lastMessage: '', lastAt: new Date() };

        setConversations(prev => {
            const exists = prev.find(c => c.peerAddress.toLowerCase() === peer.toLowerCase());
            if (exists) return prev;
            
            // Auto-sync manual new chat to Address Book
            syncToAddressBook(peer);
            
            const updated = [newConv, ...prev];
            persistToLocal(updated);
            return updated;
        });

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
        setSending(false);
      }
  };

  const handleStartConversation = async () => handleStartConversationWithPeer(peerInput);

  const executeSend = async (content: string) => {
    // 1. App Store Compliance: Content Moderation & Rate Limiting
    if (!checkRateLimit(address || 'anon', 60, 60000)) {
      toast.error('You are sending messages too fast. Please wait.');
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

    if (!isSystemSignal) setSending(true);
    
    // Phase 2: Message Quoting
    let finalContent = content;
    if (replyingTo && !isSystemSignal) {
      finalContent = `__REPLY__${replyingTo.id}__::${content}`;
      setReplyingTo(null);
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

    // --- QD DEDUCTION LOGIC ---
    // [FIX] Only gate on QDs if the user has an Sovereign Identity connected.
    // If aztecAddress is null (user hasn't claimed yet), balance = 0 is expected
    // and we should NOT block messaging — they can claim their identity later.
    // The tiny 0.0001 QD cost per message is essentially free and serves as
    // spam prevention only for users who already have an identity.
    const { aztecAddress: userAztecAddr } = aztecNative;
    if (!isSystemSignal && !isLocalSystemWallet && userAztecAddr) {
      // Only enforce QD balance if the user has a loaded Sovereign Identity
      if (balance < 0.0001) {
        toast.error("Insufficient QDs to send message.", { description: "Top up via the Sovereign Identity tab." });
        setSending(false);
        return;
      }
      // Deduct QDs — fire-and-forget, message always sends regardless of QD API result
      // [BALANCE FIX] After spending, force a refresh from DB so the balance counter
      // reflects the real server-side balance, not just the optimistic local deduction.
      spendQDs(0.0001, 'Ledger Chat message').then(() => {
        refreshBalance().catch(() => {}); // Reconcile balance with DB after spend
      }).catch((e: any) => console.warn('[Ledger Chat] QD deduction failed (non-blocking):', e));
    }

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

        const optimisticMsg = {
          id: optimisticId,
          senderInboxId: client?.inboxId || '',
          content: finalContent,
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

      // Always attempt to send directly via XMTP.
      // sendMessage() handles canReceive checks, retries with backoff,
      // and graceful offline queue internally — no need to pre-check here.
      if (isOffline) {
        const outboxKey = `ledger_outbox_${address.toLowerCase()}`;
        const existing = JSON.parse(localStorage.getItem(outboxKey) || '[]');
        existing.push(finalContent);
        localStorage.setItem(outboxKey, JSON.stringify(existing));
        toast.info("You are offline. Message queued to outbox.");
      } else {
        try {
          await engineSendMessage(activePeer, finalContent);
        } catch (err) { console.error('[Ledger Chat] Message send failed:', err); throw err; }
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
      throw err;
      // On failure, keep the message but mark it as failed so the user knows what happened
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
      toast.error('File exceeds 1MB limit for P2P messaging.');
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
      toast.error('Failed to attach file.');
      setIsUploading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    setSendAnimKey(k => k + 1);
    // ── [FASE 16: Rate-Limit Guard] ──────────────────────────────────────
    const now = Date.now();
    const rl = rateLimitRef.current;
    rl.timestamps = rl.timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (rl.timestamps.length >= RATE_LIMIT_MAX) {
      toast.warning('Slow down — you are sending messages too quickly.');
      return;
    }
    rl.timestamps.push(now);
    let txt = inputText.trim();
    if (replyingTo) {
      txt = `__REPLY__${replyingTo.id}__::${txt}`;
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const playAudioPing = (_type: 'send' | 'receive') => { /* no-op */ };

  const [prevMsgCount, setPrevMsgCount] = useState<number>(0);
  useEffect(() => {
    setPrevMsgCount(messages.length);
  }, [messages.length]);

  if (!isConnected) {
    return (
      <div className="flex-1 flex flex-col items-center justify-start h-full bg-white p-6 pt-12 gap-6 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-black/5 blur-[100px] rounded-full pointer-events-none" />
        
        <h3 className="text-[28px] font-black tracking-tight text-black relative z-10">Sovereign Chat</h3>
        <p className="text-[14px] font-medium text-[#555] text-center max-w-sm leading-relaxed relative z-10 px-4">
          Establish an end to end encrypted connection. Your keys never leave your device.
        </p>
        <button 
          onClick={() => openAppKit()} 
          className="relative z-10 h-[56px] px-8 bg-black hover:bg-black/85 text-white rounded-2xl text-[14px] font-bold tracking-wide active:scale-[0.98] transition-all shadow-lg shadow-black/20 flex items-center justify-center"
        >
          Connect Identity
        </button>
      </div>
    );
  }

  //  Email User — dedicated relay-based chat (no XMTP wallet signer needed) 
  if (isEmailUser) {
    const emailLabel = (address as string).replace('email_', '');
    return (
      <div className="flex-1 flex flex-col h-full bg-white items-center justify-center p-6 gap-6 relative overflow-hidden max-w-5xl mx-auto border-x border-black/10">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-black/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative z-10 w-full max-w-md bg-white border border-[#EBEBEB] shadow-2xl rounded-3xl p-10 flex flex-col items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-[#f5f5f7] border border-black/10 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#050505" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
          </div>
          <div className="text-center">
            <h2 className="text-[22px] font-black tracking-tight text-black mb-2">Email Account Active</h2>
            <p className="text-[12px] text-[#666] leading-relaxed">You are logged in as <span className="font-bold text-black">{emailLabel}</span>.</p>
          </div>
          <div className="w-full bg-[#f5f5f7] border border-black/10 rounded-xl p-4 text-center">
            <p className="text-[12px] font-semibold text-[#050505] leading-relaxed">
              Ledger Chat uses end to end encrypted wallet keys. To access encrypted messaging, connect a Web3 wallet.
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-4 py-2.5 bg-[#f5f5f7] border border-black/10 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-black shadow-sm animate-pulse" />
            <span className="text-[13px] font-mono font-bold text-[#050505]">{balance.toFixed(2)} QDs available</span>
          </div>
          <button
            onClick={() => openAppKit()}
            className="w-full h-[52px] bg-black text-white rounded-2xl font-bold text-[14px] tracking-wide active:scale-[0.98] transition-all shadow-lg shadow-black/20"
          >
            Connect Wallet for Chat
          </button>
        </div>
      </div>
    );
  }

  //  Loading / Auto-init state 
  if (!client) {
    return (
      <div className="flex-1 flex flex-col h-full bg-white items-center justify-start p-6 pt-12 relative overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-black/5 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative z-10 w-full max-w-md bg-white border border-[#EBEBEB] shadow-2xl rounded-3xl p-10 flex flex-col items-center">
          
          <div className="w-20 h-20 rounded-full border border-[#EBEBEB] bg-white flex items-center justify-center shadow-sm mb-8">
            {isInitializing ? (
              <div className="w-8 h-8 rounded-full border-2 border-black/10 border-t-black animate-spin" />
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-black">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            )}
          </div>

          <h2 className="text-[28px] font-black tracking-tight text-black mb-3 text-center">
            Zero Knowledge <br /> <span className="text-black/30">Transport.</span>
          </h2>
          
          <p className="text-[14px] font-medium text-[#555] text-center leading-[1.6] mb-6 max-w-[280px]">
            {isWaitingForSignature 
              ? <span className="text-blue-600 font-bold">Please check your wallet or extension and sign the request...</span> 
              : isInitializing 
                ? "Deriving session keys and verifying hardware enclave..." 
                : "Activate your cryptographic identity to access the sovereign network."}
          </p>

          {/* Shown after 15s if still loading — prevents permanent freeze */}
          {isInitTimeout && isInitializing && (
            <div className="flex flex-col gap-3 w-full mb-6 animate-in fade-in duration-500">
              <p className="text-[11px] text-center text-[#999] font-mono uppercase tracking-widest">Taking longer than expected...</p>
              <button
                onClick={() => {
                  if (initTimeoutRef.current) { clearTimeout(initTimeoutRef.current); initTimeoutRef.current = null; }
                  initInFlight.current = false;
                  setIsInitializing(false);
                  setIsInitTimeout(false);
                  setTimeout(() => initClient(), 300);
                }}
                className="w-full h-[44px] bg-black text-white rounded-xl font-bold text-[13px] tracking-wide active:scale-[0.98] transition-all"
              >
                Retry Connection
              </button>
              <button
                onClick={() => {
                  try {
                    const keys = Object.keys(localStorage).filter(k => k.startsWith('xmtp') || k.startsWith('ledger_xmtp'));
                    keys.forEach(k => localStorage.removeItem(k));
                    if (typeof indexedDB !== 'undefined') ['xmtp','xmtp-v2','xmtp-prod','xmtp-dev'].forEach(n => { try { indexedDB.deleteDatabase(n); } catch(e) {} });
                  } catch(e) {}
                  if (initTimeoutRef.current) { clearTimeout(initTimeoutRef.current); initTimeoutRef.current = null; }
                  initInFlight.current = false;
                  setIsInitializing(false);
                  setIsInitTimeout(false);
                  setTimeout(() => initClient(), 400);
                }}
                className="w-full h-[44px] bg-white border border-[#EBEBEB] text-black rounded-xl font-bold text-[13px] tracking-wide active:scale-[0.98] transition-all"
              >
                Clear Cache &amp; Retry
              </button>
            </div>
          )}

          {initError ? (
            <div className="flex flex-col items-center gap-4 w-full">
              <div className="w-full bg-[#f5f5f7] text-[#050505] text-[13px] font-medium p-4 rounded-xl border border-black/10 text-center leading-relaxed">
                {initError}
              </div>
              
              {(initError.toLowerCase().includes('limit') || initError.toLowerCase().includes('10/10')) ? (
                <div className="flex flex-col gap-3 w-full">
                  <button 
                    onClick={() => {
                      // Clear all XMTP-related IndexedDB and localStorage keys so a fresh installation can be created
                      try {
                        const keys = Object.keys(localStorage).filter(k => k.startsWith('xmtp') || k.startsWith('ledger_xmtp') || k.includes('xmtp'));
                        keys.forEach(k => localStorage.removeItem(k));
                        // Delete XMTP IndexedDB databases
                        if (typeof indexedDB !== 'undefined') {
                          const dbNames = ['xmtp', 'xmtp-v2', 'xmtp-prod', 'xmtp-dev'];
                          dbNames.forEach(name => { try { indexedDB.deleteDatabase(name); } catch(e) {} });
                        }
                      } catch(e) { console.warn('Cache clear partial', e); }
                      setInitError('');
                      setTimeout(() => initClient(), 500);
                    }} 
                    className="w-full h-[56px] bg-black text-white rounded-2xl font-bold tracking-wide active:scale-[0.98] transition-all"
                  >
                    Clear Cache &amp; Retry
                  </button>
                  <button onClick={() => { setInitError(''); initClient(); }} className="w-full h-[56px] bg-white border border-[#EBEBEB] text-black rounded-2xl font-bold tracking-wide active:scale-[0.98] transition-all">
                    Retry Without Clearing
                  </button>
                </div>
              ) : (initError.includes('wallet connection lost') || initError.includes('Connect your wallet') || initError.toLowerCase().includes('unknown signer')) ? (
                <div className="flex flex-col gap-3 w-full">
                  <button onClick={() => openAppKit()} className="w-full h-[56px] bg-black text-white rounded-2xl font-bold tracking-wide active:scale-[0.98] transition-all">
                    Reconnect Wallet
                  </button>
                  <button onClick={() => { reconnect(); initClient(); }} className="w-full h-[56px] bg-white border border-[#EBEBEB] text-black rounded-2xl font-bold tracking-wide active:scale-[0.98] transition-all">
                    Refresh Session
                  </button>
                </div>
              ) : (
                <button onClick={initClient} disabled={isInitializing} className="w-full h-[56px] bg-black text-white rounded-2xl font-bold tracking-wide active:scale-[0.98] transition-all disabled:opacity-50">
                  Try Again
                </button>
              )}
            </div>

          ) : !isInitializing ? (
            <div className="flex flex-col gap-4 w-full">
              <button
                onClick={initClient}
                className="w-full h-[56px] bg-black hover:bg-black/85 text-white rounded-2xl font-bold text-[14px] tracking-wide active:scale-[0.98] transition-all shadow-lg shadow-black/20"
              >
                Activate Identity
              </button>
              <p className="text-[9px] font-mono uppercase tracking-widest text-black/30 text-center">Protocol-level cryptographic activation</p>
            </div>
          ) : (
            isMobile && (
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-black mt-6 text-center animate-pulse">
                Confirm signature in wallet
              </p>
            )
          )}
        </div>
      </div>
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
    if (!pxeLoaded) {
      return <div className="min-h-screen bg-[#F6F7F9] flex items-center justify-center font-mono text-xs text-black/30">LOADING PROTOCOL...</div>;
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
      <IncomingCallOverlay />

      {/* ── GROUP CALL FULLSCREEN OVERLAY ── */}
      <AnimatePresence>
        {groupCallActive && (
          <GroupCallRoom
            localStream={groupCallLocalStream}
            participants={groupCallParticipants}
            isMuted={groupCallMuted}
            isCameraOff={groupCallCameraOff}
            myAddress={effectiveAddress || ''}
            roomId={groupCallRoomId}
            roomPassword={groupCallPassword}
            moderatorAddress={groupCallModerator}
            isScreenSharing={groupCallScreenSharing}
            isMinimized={groupCallMinimized}
            onToggleMinimize={() => setGroupCallMinimized(!groupCallMinimized)}
            onToggleMute={() => {
              const muted = webrtcEngineRef.current?.toggleMute();
              if (muted !== undefined) setGroupCallMuted(muted);
            }}
            onToggleCamera={() => {
              const off = webrtcEngineRef.current?.toggleCamera();
              if (off !== undefined) setGroupCallCameraOff(off);
            }}
            onToggleScreenShare={async () => {
              if (groupCallScreenSharing) {
                // Stop screen share — revert to camera
                webrtcEngineRef.current?.stopScreenShare();
                setGroupCallScreenSharing(false);
              } else {
                const ok = await webrtcEngineRef.current?.startScreenShare();
                if (ok) setGroupCallScreenSharing(true);
              }
            }}
            onAddParticipant={() => {
              // Show invite info
            }}
            onEndCall={leaveGroupCall}
            onKickParticipant={handleKickParticipant}
            onTransferModerator={handleTransferModerator}
          />
        )}
      </AnimatePresence>

      {/* ── JOIN CALL MODAL ── */}
      <AnimatePresence>
        {showJoinModal && (
          <JoinCallModal
            onClose={() => setShowJoinModal(false)}
            onSuccess={handleJoinSuccess}
          />
        )}
      </AnimatePresence>

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


    {/* ─── WebRTC Ringtone Audio Element ────────────────────────────────────── */}
    <audio ref={ringAudioRef} loop playsInline x-webkit-airplay="allow" src="/sounds/call_ringtone.mp3" style={{ display: 'none' }} />

    {/* Solid white container — two-panel layout: sidebar (left) + chat (right) */}
      <div className={`relative flex flex-row flex-1 min-h-0 w-full overflow-hidden shadow-sm ${(showScanner || showMyQR || showProfile) ? 'overflow-visible' : ''}`} style={{ 
      borderRadius: isMobile ? 0 : '0',
      ...bgStyle,
      fontFamily,
    }}>
      {/*  Sidebar: Conversation List — fixed width on desktop, full screen on mobile when no chat is active  */}
      <div className={`${showList ? 'flex' : 'hidden md:flex'} w-full md:w-80 lg:w-96 flex-col border-r border-black/[0.08] bg-white shrink-0 h-full overflow-hidden`}>

        {/* ── Sidebar Header ── */}
        {/* [iOS FIX] Use env(safe-area-inset-top) so "Messages" title doesn't hide behind the notch/status bar */}
        <div className="pb-0 px-4 border-b border-black/[0.06] bg-white" style={{ paddingTop: 'max(16px, env(safe-area-inset-top, 16px))' }}>
          {/* Top row: title + action buttons */}
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-[22px] font-black text-[#000000] tracking-tight">Messages</h1>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowUserSearch(true)}
                className="w-10 h-10 rounded-full bg-[#F2F2F7] flex items-center justify-center text-[#007AFF] hover:bg-[#E5E5EA] transition-all active:scale-95"
                title="Find people"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </button>
              <button
                onClick={() => {
                  setPeerInput('');
                  // focus the input below
                  setTimeout(() => document.getElementById('ledger-new-chat-input')?.focus(), 100);
                }}
                className="w-10 h-10 rounded-full bg-[#007AFF] flex items-center justify-center text-white hover:bg-[#0071E3] transition-all active:scale-95 shadow-sm"
                title="New conversation"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>
          </div>

          {/* New chat input */}
          <div className="flex gap-2 mb-3">
            <div className="flex-1 relative">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30 pointer-events-none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                id="ledger-new-chat-input"
                type="text"
                placeholder="@username or 0x wallet address"
                value={peerInput}
                onChange={e => setPeerInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleStartConversation()}
                className="w-full bg-[#F2F2F7] rounded-[12px] pl-9 pr-3 py-2.5 text-[16px] text-[#000000] placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 transition-all"
              />
            </div>
            <button
              onClick={handleStartConversation}
              disabled={sending || !peerInput.trim()}
              className="h-[42px] px-4 bg-[#007AFF] disabled:bg-[#C7C7CC] rounded-[12px] flex items-center justify-center text-white font-bold text-[14px] hover:bg-[#0071E3] transition-all active:scale-95 disabled:cursor-not-allowed whitespace-nowrap"
            >
              Open
            </button>
          </div>

          {/* Secondary actions row: QR, Vault, Settings */}
          <div className="flex items-center gap-2 pb-3">
            <button onClick={() => setShowScanner(true)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[10px] bg-[#F2F2F7] text-[#000000] hover:bg-[#E5E5EA] transition-all text-[12px] font-semibold active:scale-95">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/><rect x="3" y="16" width="5" height="5" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><line x1="21" y1="21" x2="21" y2="21.01"/><path d="M16 11V9a2 2 0 0 1 2-2h3"/><line x1="21" y1="9" x2="21" y2="9.01"/></svg>
              Scan QR
            </button>
            <button onClick={() => setShowMyQR(true)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[10px] bg-[#F2F2F7] text-[#000000] hover:bg-[#E5E5EA] transition-all text-[12px] font-semibold active:scale-95">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              My QR
            </button>
            <button onClick={() => setShowContactRequests(true)} className="relative flex items-center justify-center gap-1.5 py-2 px-3 rounded-[10px] bg-[#F2F2F7] text-[#000000] hover:bg-[#E5E5EA] transition-all text-[12px] font-semibold active:scale-95">
              <Bell size={13} />
              {pendingRequestCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-white">
                  {pendingRequestCount}
                </span>
              )}
            </button>
            <button onClick={() => setShowVault(true)} className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-[10px] bg-[#F2F2F7] text-[#000000] hover:bg-[#E5E5EA] transition-all text-[12px] font-semibold active:scale-95">
              <Lock size={13} />
            </button>
            <button onClick={() => window.location.href = '/portfolio'} className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-[10px] bg-[#F2F2F7] text-[#000000] hover:bg-[#E5E5EA] transition-all text-[12px] font-semibold active:scale-95">
              <PieChart size={13} />
            </button>
            {/* ── GROUP CALL BUTTONS ── */}
            <button
              onClick={() => createGroupCall('')}
              title="Start Group Video Call"
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-[10px] bg-[#34C759]/10 text-[#34C759] hover:bg-[#34C759]/20 transition-all text-[12px] font-semibold active:scale-95"
            >
              <Video size={13} />
            </button>
            <button
              onClick={() => setShowJoinModal(true)}
              title="Join Call by Room ID"
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-[10px] bg-[#007AFF]/10 text-[#007AFF] hover:bg-[#007AFF]/20 transition-all text-[12px] font-semibold active:scale-95"
            >
              <Radio size={13} />
            </button>
            <button onClick={() => setShowSettings(true)} className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-[10px] bg-[#F2F2F7] text-[#000000] hover:bg-[#E5E5EA] transition-all text-[12px] font-semibold active:scale-95">
              <Settings size={13} />
            </button>
          </div>

          {/* QD Balance */}
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-1.5 text-[12px] text-[#8E8E93]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34C759] animate-pulse" />
              <span className="font-mono">{balance.toFixed(4)} QD available</span>
            </div>
          </div>
        </div>

        {/* ── Tab Bar ── */}
        <div className="flex border-b border-black/[0.06] bg-white shrink-0">
          {(['chats', 'calls', 'contacts', 'groups'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => { setSidebarTab(tab); if (tab === 'groups') setShowSyndicateModal(true); }}
              className={`flex-1 py-3 flex flex-col items-center gap-0.5 transition-all ${
                sidebarTab === tab
                  ? 'text-[#007AFF]'
                  : 'text-[#8E8E93] hover:text-[#000000]'
              }`}
            >
              {tab === 'chats' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill={sidebarTab === 'chats' ? '#007AFF' : 'none'} stroke={sidebarTab === 'chats' ? '#007AFF' : '#8E8E93'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              ) : tab === 'calls' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill={sidebarTab === 'calls' ? '#007AFF' : 'none'} stroke={sidebarTab === 'calls' ? '#007AFF' : '#8E8E93'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13 19.79 19.79 0 0 1 1.6 4.35 2 2 0 0 1 3.57 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.1 6.1l.9-.9a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              ) : tab === 'contacts' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill={sidebarTab === 'contacts' ? '#007AFF' : 'none'} stroke={sidebarTab === 'contacts' ? '#007AFF' : '#8E8E93'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              ) : (
                /* Groups icon */
                <svg width="20" height="20" viewBox="0 0 24 24" fill={sidebarTab === 'groups' ? '#007AFF' : 'none'} stroke={sidebarTab === 'groups' ? '#007AFF' : '#8E8E93'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              )}
              <span className={`text-[10px] font-semibold tracking-wide ${sidebarTab === tab ? 'text-[#007AFF]' : 'text-[#8E8E93]'}`}>
                {tab === 'groups' ? 'Groups' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col bg-white">

          {/* ── CHATS TAB ── */}
          {sidebarTab === 'chats' && (
            <>
              {conversations.length > 0 && archivedPeers.size > 0 && (
                <button
                  onClick={() => setShowArchived(!showArchived)}
                  className="w-full text-left px-4 py-3 border-b border-black/[0.04] bg-[#F9F9F9] hover:bg-[#F2F2F7] transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 text-[#8E8E93]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                    <span className="text-[13px] font-semibold">Archived ({archivedPeers.size})</span>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`text-[#8E8E93] transition-transform ${showArchived ? 'rotate-90' : ''}`}><path d="M9 18l6-6-6-6"/></svg>
                </button>
              )}
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8 text-center">
                  <div className="w-20 h-20 rounded-full bg-[#F2F2F7] flex items-center justify-center">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  </div>
                  <div>
                    <p className="text-[16px] font-bold text-[#000000] mb-1">No Conversations Yet</p>
                    <p className="text-[13px] text-[#8E8E93] leading-relaxed">Enter a wallet address above<br/>to start your first chat.</p>
                  </div>
                </div>
              ) : (
            conversations.filter(conv => showArchived ? archivedPeers.has(conv.peerAddress.toLowerCase()) : !archivedPeers.has(conv.peerAddress.toLowerCase())).map((conv, i) => {
              const isActive = activePeer?.toLowerCase() === conv.peerAddress.toLowerCase();
              const contactName = resolveContactName(effectiveAddress, conv.peerAddress);
              const displayLabel = contactName || shortAddr(conv.peerAddress);
              return (
                <div key={i} className="relative w-full overflow-hidden border-b border-black/[0.04]">
                  <div className="absolute inset-y-0 right-0 flex items-center justify-center w-20 bg-[#FF3B30] text-white text-[11px] font-semibold cursor-pointer" onClick={() => toggleArchive(conv.peerAddress)}>
                    <div className="flex flex-col items-center gap-1">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/></svg>
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
                      onClick={() => { setActivePeer(conv.peerAddress); setShowList(false); }}
                      className={`w-full text-left px-4 py-3.5 transition-all ${isActive ? 'bg-[#F2F2F7]' : 'hover:bg-[#F9F9F9]'}`}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <div className="relative shrink-0">
                          <Avatar address={conv.peerAddress} />
                          {peerStatus.status === 'online' && activePeer?.toLowerCase() === conv.peerAddress.toLowerCase() && (
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#34C759] border-2 border-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <p className="text-[15px] font-semibold text-[#000000] truncate">{displayLabel}</p>
                            {conv.lastMessage && (
                              <span className="text-[12px] text-[#8E8E93] shrink-0">
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
                              <p className="text-[13px] text-[#8E8E93] truncate">{formatMessagePreview(conv.lastMessage)}</p>
                              {conv.unreadCount && conv.unreadCount > 0 ? (
                                <div className="min-w-[20px] h-5 bg-[#007AFF] rounded-full flex items-center justify-center px-1.5 shrink-0">
                                  <span className="text-[11px] font-bold text-white tabular-nums">
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

          {/* ── CALLS TAB ── */}
          {sidebarTab === 'calls' && (
            <div className="flex-1 overflow-y-auto">
              {callHistoryList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-[#F2F2F7] flex items-center justify-center">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13 19.79 19.79 0 0 1 1.6 4.35 2 2 0 0 1 3.57 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.1 6.1l.9-.9a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  </div>
                  <div>
                    <p className="text-[16px] font-bold text-[#000000] mb-1">No Calls Yet</p>
                    <p className="text-[13px] text-[#8E8E93]">Open a chat and tap the phone<br/>icon to start a call.</p>
                  </div>
                </div>
              ) : callHistoryList.map((call) => {
                const isToday = new Date(call.timestamp).toDateString() === new Date().toDateString();
                const isYesterday = new Date(call.timestamp).toDateString() === new Date(Date.now() - 86400000).toDateString();
                const timeLabel = isToday
                  ? new Date(call.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : isYesterday ? 'Yesterday'
                  : new Date(call.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
                const mins = Math.floor(call.durationSeconds / 60).toString().padStart(2, '0');
                const secs = (call.durationSeconds % 60).toString().padStart(2, '0');
                const isMissed = call.status === 'missed' || call.status === 'declined';
                return (
                  <button
                    key={call.id}
                    className="w-full px-4 py-3.5 border-b border-black/[0.04] flex items-center gap-3 hover:bg-[#F9F9F9] transition-colors text-left active:bg-[#F2F2F7]"
                    onClick={() => { setActivePeer(call.peerAddress); setSidebarTab('chats'); setShowList(false); }}
                  >
                    <div className="relative shrink-0">
                      <Avatar address={call.peerAddress} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-[#000000] truncate mb-0.5">{getDisplayName(call.peerAddress)}</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-[13px] font-medium ${isMissed ? 'text-[#FF3B30]' : 'text-[#8E8E93]'}`}>
                          {call.direction === 'incoming' ? '↙' : '↗'} {call.type === 'video' ? 'Video' : 'Voice'} • {isMissed ? 'Missed' : call.durationSeconds > 0 ? `${mins}:${secs}` : 'No answer'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[12px] text-[#8E8E93]">{timeLabel}</span>
                      <button
                        onClick={e => { e.stopPropagation(); setSidebarTab('chats'); setShowList(false); handleStartCall(call.type, call.peerAddress); }}
                        className="w-8 h-8 rounded-full bg-[#F2F2F7] flex items-center justify-center text-[#007AFF] hover:bg-[#E5E5EA] transition-all active:scale-90"
                        title={`Call back (${call.type})`}
                      >
                        {call.type === 'video' ? <Video size={14} /> : <Phone size={14} />}
                      </button>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── CONTACTS TAB ── */}
          {sidebarTab === 'contacts' && (
            <div className="flex-1 overflow-y-auto">
              {localContacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-[#F2F2F7] flex items-center justify-center">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </div>
                  <div>
                    <p className="text-[16px] font-bold text-[#000000] mb-1">No Saved Contacts</p>
                    <p className="text-[13px] text-[#8E8E93] leading-relaxed">Open a chat, then tap the<br/>person icon to save a contact.</p>
                  </div>
                </div>
              ) : localContacts.map((contact) => (
                <button
                  key={contact.id}
                  className="w-full px-4 py-3.5 border-b border-black/[0.04] flex items-center gap-3 hover:bg-[#F9F9F9] transition-colors text-left active:bg-[#F2F2F7]"
                  onClick={() => { setActivePeer(contact.peerAddress); setSidebarTab('chats'); setShowList(false); }}
                >
                  <Avatar address={contact.peerAddress} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-[#000000] truncate">{contact.name}</p>
                    <p className="text-[13px] text-[#8E8E93] font-mono truncate">{shortAddr(contact.peerAddress)}</p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                </button>
              ))}
            </div>
          )}

        </div>
      </div>

      {/*  Chat Area  */}
      <div className={`${!showList ? 'flex' : 'hidden md:flex'} relative flex-1 flex-col min-w-0 min-h-0`}>
        {activePeer ? (
          <>
            <div className="h-[68px] px-4 border-b border-black/[0.08] flex items-center justify-between bg-white shrink-0 z-10 shadow-[0_1px_8px_rgba(0,0,0,0.05)]">
              <div className="flex items-center gap-3">
                <button onClick={() => setShowList(true)} className="md:hidden p-1.5 rounded-lg hover:bg-black/5 text-black/40 text-[10px] font-black tracking-wider mr-1">
                  ←
                </button>
                <button onClick={() => setShowProfile(true)} className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity">
                  <div className="relative">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-black text-white shadow-lg"
                      style={{ background: `hsl(${parseInt(activePeer.slice(2, 8), 16) % 360},70%,45%)` }}
                    >
                      {activePeer.slice(2, 4).toUpperCase()}
                    </div>
                    {/* Online indicator */}
                    <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm ${peerStatus.status === 'online' ? 'bg-black' : 'bg-gray-400'}`} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[13px] font-black text-[#050505] font-mono flex items-center gap-1.5">
                      {getDisplayName(activePeer!)}
                    </span>
                    <span className={`text-[10px] font-semibold flex items-center gap-1 ${peerStatus.status === 'online' ? 'text-black' : 'text-black/50'}`}>
                      {peerStatus.isTyping ? (
                        <>
                          <span className="w-1 h-1 rounded-full bg-black animate-pulse inline-block" />
                          typing...
                        </>
                      ) : peerStatus.status === 'online' ? (
                        <>
                          <span className="w-1 h-1 rounded-full bg-black inline-block" />
                          Online
                        </>
                      ) : (
                        <>
                          <span className="w-1 h-1 rounded-full bg-gray-400 inline-block" />
                          {peerStatus.lastSeen ? (() => {
                            const d = new Date(peerStatus.lastSeen);
                            const now = new Date();
                            const todayStr = now.toDateString();
                            const yest = new Date(now); yest.setDate(yest.getDate() - 1);
                            const t = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            if (d.toDateString() === todayStr) return `Last seen ${t}`;
                            if (d.toDateString() === yest.toDateString()) return `Last seen yesterday ${t}`;
                            return `Last seen ${d.toLocaleDateString([], { day: '2-digit', month: '2-digit' })} ${t}`;
                          })() : 'Offline'}
                        </>
                      )}
                    </span>
                  </div>
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="hidden lg:flex items-center gap-1 px-2.5 py-1 bg-[#f5f5f7] border border-black/10 rounded-xl" title="Available QDs">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#050505] shadow-sm animate-pulse" />
                  <span className="text-[10px] font-mono font-bold text-black">{balance.toFixed(2)} QD</span>
                </div>
                {/* Phase 5: Secret Chat Toggle */}
                <button
                  onClick={() => setIsSecretChat(!isSecretChat)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${isSecretChat ? 'bg-[#050505] text-white shadow-lg shadow-black/10 animate-pulse' : 'bg-[#f5f5f7] text-black/40 hover:bg-black/5 hover:text-black/60'}`}
                  title={isSecretChat ? "Secret Chat Active (Auto-Burn 15s)" : "Start Secret Chat"}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </button>
                {/* v2: Save Contact Button */}
                <button
                  onClick={() => { setSaveContactName(getDisplayName(activePeer!)); setShowSaveContactModal(true); }}
                  className="w-9 h-9 bg-[#f5f5f7] hover:bg-[#e5e5ea] rounded-xl flex items-center justify-center text-black/40 hover:text-black transition-colors"
                  title="Save Contact"
                >
                  <UserPlus size={15} />
                </button>
                <button
                  onClick={() => handleStartCall('audio')}
                  className="w-9 h-9 bg-[#f5f5f7] hover:bg-[#e5e5ea] rounded-xl flex items-center justify-center text-black transition-colors"
                  title="Audio Call"
                >
                  <Phone size={16} />
                </button>
                <button
                  onClick={() => handleStartCall('video')}
                  className="w-9 h-9 bg-[#f5f5f7] hover:bg-[#e5e5ea] rounded-xl flex items-center justify-center text-black transition-colors"
                  title="Video Call"
                >
                  <Video size={16} />
                </button>
                <button
                  onClick={() => setShowScanner(true)}
                  className="lg:hidden w-9 h-9 bg-[#f5f5f7] hover:bg-[#e5e5ea] rounded-xl flex items-center justify-center text-black/50 transition-colors text-[11px] font-black"
                >
                  QR
                </button>
                <button 
                  onClick={() => { setShowSearch(s => !s); setSearchQuery(''); setSearchIndex(0); }}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${showSearch ? 'bg-black/10 text-black' : 'hover:bg-black/5 text-black/40'}`}
                  title="Search in chat"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </button>
                <button onClick={() => setShowProfile(true)} className="w-9 h-9 hover:bg-black/5 rounded-xl flex items-center justify-center text-black/40 transition-colors">
                  <MoreVertical size={16} />
                </button>
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
                <div className="bg-white/90 backdrop-blur-md border-b border-black/5 px-3 py-2 flex items-center gap-2 z-20 animate-in slide-in-from-top-2 duration-200">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-black/40 shrink-0"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input
                    autoFocus
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setSearchIndex(0); }}
                    placeholder="Search in conversation..."
                    className="flex-1 bg-transparent text-[13px] font-mono text-gray-800 placeholder:text-black/40 outline-none"
                  />
                  {matches.length > 0 && (
                    <span className="text-[11px] font-mono text-black/50 shrink-0">{searchIndex + 1}/{matches.length}</span>
                  )}
                  {matches.length > 1 && (
                    <>
                      <button onClick={() => handleNavSearch(-1)} className="p-1 hover:bg-black/5 rounded-lg text-black/50">↑</button>
                      <button onClick={() => handleNavSearch(1)} className="p-1 hover:bg-black/5 rounded-lg text-black/50">↓</button>
                    </>
                  )}
                  <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="p-1 hover:bg-black/5 rounded-lg text-black/40">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              );
            })()}

            {/* Phase 3: Pinned Message Banner */}
            {pinnedMessageId && (
              <div className="bg-white/80 backdrop-blur-md border-b border-black/5 px-4 py-2 flex items-center gap-3 cursor-pointer hover:bg-black/5 transition-colors z-20 shrink-0" onClick={() => {
                const el = document.getElementById(`msg-${pinnedMessageId}`);
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}>
                <div className="w-1 h-8 bg-[#050505] rounded-full" />
                <div className="flex-1 min-w-0 flex flex-col">
                  <span className="text-[10px] font-black text-black uppercase tracking-widest flex items-center gap-1"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg> Pinned Message</span>
                  <span className="text-[12px] font-mono font-medium text-black/70 truncate">
                    {messages.find(m => m.id === pinnedMessageId)?.content?.replace(/__REPLY__[a-zA-Z0-9_-]+__::/, '').replace('__AUDIO__', '🎙️ Voice Note') || 'Pinned Message'}
                  </span>
                </div>
                <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setPinnedMessageId(null); 
                    executeSend(`__UNPIN__${pinnedMessageId}`); // For parity, though we just unset locally for now
                  }}
                  className="p-1.5 hover:bg-black/10 rounded-full text-black/40 transition-colors"
                >
                  X
                </button>
              </div>
            )}

            {/* Dynamic Chat Background */}
            <div className={`flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0 relative ${isSecretChat ? 'bg-[#fffafa]' : ''}`} style={isSecretChat ? { fontFamily, fontSize: `${fontSizePx}px` } : { ...bgStyle, fontFamily, fontSize: `${fontSizePx}px` }}>
              {/* Matrix Rain Effect Layer */}
              {chatBackground === 'matrix' && (
                <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'radial-gradient(circle, rgba(0,255,0,0.1) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
              )}
              {(() => {
                // Filter messages for the current active conversation only
                const convId = `dm-${activePeer!.toLowerCase()}`;
                const filteredMsgs = messages.filter(m => {
                  if (m.conversationId !== convId && m.conversationId !== `dm-${activePeer!.toLowerCase()}`) return false;
                  if (m.burnAtNs && m.burnAtNs <= Date.now()) return false;
                  const c = typeof m.content === 'string' ? m.content : '';
                  if (c.startsWith('__CALL_ANSWER__')) return false;
                  // Allow __CALL_DECLINE__ and __CALL_HANGUP__ to render as missed/ended call bubbles
                  if (c.startsWith('__REACT__')) return false;
                  if (c.startsWith('__PIN__')) return false;
                  if (c.startsWith('__UNPIN__')) return false;
                  if (c.startsWith('__REVOKE__')) return false;
                  if (c.startsWith('__EDIT__')) return false;
                  return true;
                });
                if (filteredMsgs.length === 0) return (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="flex flex-col items-center max-w-[280px] text-center gap-6">
                      <div className="flex flex-col items-center opacity-40">
                        <p className="text-[12px] font-medium text-black/40">No messages yet. Start the conversation!</p>
                      </div>
                    </div>
                  </div>
                );
                let lastDate = '';
                return filteredMsgs.map(msg => {
                  const sentTime = typeof msg.sentAtNs === 'number' ? new Date(msg.sentAtNs) : (msg.sent || msg.sentAt || new Date());
                  const dateStr = new Date(sentTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                  const showDate = dateStr !== lastDate;
                  lastDate = dateStr;

                  const isMe = msg.senderInboxId
                    ? msg.senderInboxId?.toLowerCase() === (client?.inboxId as string)?.toLowerCase()
                    : false;
                  
                  return (
                    <MessageBubble
                      key={msg.id}
                      msg={msg}
                      isMe={isMe}
                      showDate={showDate}
                      dateStr={dateStr}
                      isSecretChat={isSecretChat}
                      fontFamily={fontFamily}
                      fontSizePx={fontSizePx}
                      clientInboxId={client?.inboxId}
                      onReply={(msgToReply) => setReplyingTo(msgToReply)}
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
                    />
                  );
                });
              })()}
              {peerStatus.isTyping && (
                  <div className="flex self-start items-start mt-2 ml-4">
                      <div className="px-4 py-3 bg-white/70 backdrop-blur-md rounded-2xl rounded-bl-sm border border-white shadow-sm flex items-center gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="w-2 h-2 bg-gray-400 rounded-full" style={{ animation: 'typingBounce 1.2s ease-in-out infinite', animationDelay: '0ms', willChange: 'transform' }} />
                        <div className="w-2 h-2 bg-gray-400 rounded-full" style={{ animation: 'typingBounce 1.2s ease-in-out infinite', animationDelay: '200ms', willChange: 'transform' }} />
                        <div className="w-2 h-2 bg-gray-400 rounded-full" style={{ animation: 'typingBounce 1.2s ease-in-out infinite', animationDelay: '400ms', willChange: 'transform' }} />
                      </div>
                  </div>
              )}
              {sending && (
                <div className="flex self-end items-center gap-2 mt-2 px-4 py-1.5 bg-white rounded-full shadow-sm border border-black/5">
                  <div className="w-1.5 h-1.5 bg-[#050505] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-[#050505] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-[#050505] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div
              className="relative shrink-0 bg-white/80 backdrop-blur-xl border-t border-black/10 z-10 shadow-[0_-4px_24px_rgba(0,0,0,0.02)]"
              style={{ paddingBottom: `max(8px, env(safe-area-inset-bottom, 0px))` }}
            >
              {/*  Offline Banner  */}
              {isOffline && (
                <div className="flex items-center gap-2 px-4 pt-2 pb-1 bg-gray-950/5 border-b border-black/5">
                  <span className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-gray-600 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-gray-400 animate-pulse inline-block" />
                    OFFLINE — Messages queued to outbox
                  </span>
                </div>
              )}
              {/*  Audio recording indicator  */}
              {isRecording && (
                <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                    <div className="flex items-center gap-1.5 bg-[#f5f5f7] text-[#050505] px-3 py-1.5 rounded-full">
                        <span className="w-2 h-2 rounded-full bg-[#050505] animate-pulse" />
                        <span className="text-[12px] font-medium">{recordingSeconds}s — Recording voice message</span>
                    </div>
                </div>
              )}
              {/* [BUG FIX] Secret Chat Active Banner — clearly visible above input */}
              {isSecretChat && !isRecording && (
                <div className="flex items-center gap-2 px-4 pt-2 pb-1 bg-black/5 border-b border-black/10 animate-in slide-in-from-top-1 duration-200">
                  <span className="flex items-center gap-1.5 text-[11px] font-mono font-black text-[#050505] uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-[#050505] animate-pulse inline-block" />
                    🔥 SECRET CHAT ACTIVE — Messages burn in 15s
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsSecretChat(false)}
                    className="ml-auto text-black/60 hover:text-black/80 text-[10px] font-black uppercase tracking-widest transition-colors"
                  >
                    Disable
                  </button>
                </div>
              )}
              {/* Hito 4: Link Preview Card */}
              {linkPreview && !isRecording && (
                <div className="flex items-start gap-3 px-4 pt-2 pb-1 bg-[#f5f5f7] border-t border-black/10/50 animate-in slide-in-from-bottom-2">
                  {linkPreview.image && <img src={linkPreview.image} alt="" className="w-14 h-14 object-cover rounded-xl border border-white shadow-sm shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-black truncate">{linkPreview.title}</p>
                    <p className="text-[11px] text-black/50 line-clamp-2">{linkPreview.description}</p>
                    <p className="text-[10px] font-mono text-black/50 truncate mt-0.5">{linkPreview.url}</p>
                  </div>
                  <button onClick={() => setLinkPreview(null)} className="text-black/40 hover:text-gray-600 p-1 shrink-0">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              )}
              {/* Phase 4: Editing UI */}
              {editingMsg && (
                <div className="mx-3 mt-2 px-4 py-2.5 bg-[#f5f5f7] border border-black/10 rounded-t-2xl flex items-center justify-between animate-in slide-in-from-bottom-2 duration-200">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-black uppercase tracking-widest text-black mb-0.5">Edit Message</span>
                    <input
                      type="text"
                      inputMode="text"
                      autoCorrect="off"
                      autoCapitalize="off"
                      autoComplete="off"
                      spellCheck={false}
                      className="text-[13px] bg-transparent outline-none text-[#050505] w-full font-mono placeholder:text-black/30"
                      value={editingMsg.content}
                      onChange={e => setEditingMsg({ ...editingMsg, content: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitEditMessage(); } }}
                      autoFocus
                    />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={submitEditMessage} className="p-1.5 bg-[#050505] text-white rounded-lg hover:opacity-80 shadow-sm"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg></button>
                    <button onClick={() => setEditingMsg(null)} className="p-1.5 text-black/50 hover:text-black"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                  </div>
                </div>
              )}
              {replyingTo && !editingMsg && (
                <div className="flex items-center justify-between px-4 pt-2 pb-1 bg-[#f5f5f7] border-t border-black/5 animate-in slide-in-from-bottom-2">
                  <div className="flex-1 pl-3 border-l-2 border-black/20 overflow-hidden">
                    <p className="text-[11px] font-bold text-black">Replying to</p>
                    <p className="text-[12px] text-black/50 truncate">{
                      replyingTo.content ? formatMessagePreview(replyingTo.content) : 'Message'
                    }</p>
                  </div>
                  <button onClick={() => setReplyingTo(null)} className="p-2 text-black/40 hover:text-black/70">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
              )}
              {/* Hito 4: Scheduled send indicator */}
              {scheduledAt && (
                <div className="flex items-center justify-between px-4 pt-2 pb-1 bg-[#f5f5f7] border-t border-black/10 animate-in slide-in-from-bottom-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-black/70">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
                    Scheduled: {scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <button onClick={() => setScheduledAt(null)} className="text-black/50 hover:text-black/70 text-[10px] font-bold">Cancel</button>
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
                <div className="bg-white/95 backdrop-blur-md border-t border-black/5 p-3 animate-in slide-in-from-bottom-4 duration-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[12px] font-black text-gray-700 uppercase tracking-wider">GIFs</span>
                    <input
                      autoFocus
                      value={gifSearch}
                      onChange={e => setGifSearch(e.target.value)}
                      placeholder="Search GIFs..."
                      className="flex-1 bg-gray-100 rounded-xl px-3 py-1.5 text-[13px] outline-none text-gray-800 placeholder:text-black/40"
                    />
                    <button onClick={() => setShowGifPicker(false)} className="p-1.5 hover:bg-black/5 rounded-lg text-black/40">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
                    {gifResults.length === 0 ? (
                      <p className="col-span-3 text-center text-[12px] text-black/40 py-4">{gifSearch ? 'No GIFs found' : 'Search for GIFs above...'}</p>
                    ) : gifResults.map((url, i) => (
                      <button key={i} onClick={() => {
                        executeSend(`[GIF]${url}`);
                        setShowGifPicker(false);
                        setGifSearch('');
                        setGifResults([]);
                      }} className="aspect-video bg-gray-100 rounded-xl overflow-hidden hover:scale-105 transition-transform">
                        <img src={url} alt="gif" className="w-full h-full object-cover" loading="lazy" />
                      </button>
                    ))}
                  </div>
                  <p className="text-[9px] text-black/40 text-right mt-1 font-mono">Powered by Tenor</p>
                </div>
              )}
              {inputText === '/' && (
                <div className="absolute bottom-[70px] left-4 mb-2 bg-white/90 backdrop-blur-xl border border-black/10 shadow-2xl rounded-2xl w-[260px] overflow-hidden z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
                  <div className="px-3 py-2 border-b border-black/5 bg-black/5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-black/50">Commands</span>
                  </div>
                  <div className="flex flex-col py-1">
                    <button type="button" onClick={() => { setInputText(''); setShowWalletTransfer(true); }} className="px-3 py-2.5 text-left hover:bg-black/5 transition-colors flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#050505] text-white flex items-center justify-center shrink-0">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[13px] font-bold text-[#050505]">/pay</span>
                        <span className="text-[10px] font-mono text-black/50">Send QD Tokens</span>
                      </div>
                    </button>
                    <button type="button" onClick={() => { setInputText(''); setShowPollCreator(true); }} className="px-3 py-2.5 text-left hover:bg-black/5 transition-colors flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[13px] font-bold text-[#050505]">/poll</span>
                        <span className="text-[10px] font-mono text-black/50">Create a Poll</span>
                      </div>
                    </button>
                    <button type="button" onClick={() => { setInputText(''); setShowGifPicker(true); }} className="px-3 py-2.5 text-left hover:bg-black/5 transition-colors flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center shrink-0">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[13px] font-bold text-[#050505]">/gif</span>
                        <span className="text-[10px] font-mono text-black/50">Search GIFs</span>
                      </div>
                    </button>
                    <button type="button" onClick={() => { 
                      setInputText(''); 
                      if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(pos => {
                          executeSend(`[LOCATION]${pos.coords.latitude},${pos.coords.longitude}`);
                        });
                      }
                    }} className="px-3 py-2.5 text-left hover:bg-black/5 transition-colors flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center shrink-0">
                        <MapPin size={14} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[13px] font-bold text-[#050505]">/location</span>
                        <span className="text-[10px] font-mono text-black/50">Share Real-time Location</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}
                <input type="file" ref={fileRef} className="hidden" onChange={handleFileUpload} />
                <form onSubmit={handleSend} className="flex flex-col w-full relative">
                  {/* ── App Drawer (iOS 17 iMessage Style) ── */}
                  <AnimatePresence>
                  {showAppDrawer && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.96 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      className="absolute bottom-full left-3 mb-2 w-[240px] max-h-[400px] bg-white/90 backdrop-blur-xl border border-black/[0.08] shadow-[0_16px_40px_rgba(0,0,0,0.12)] rounded-[24px] overflow-y-auto flex flex-col z-50"
                    >
                      {[
                        { id: 'attach', icon: <Paperclip size={18} />, label: 'Files', color: 'text-white', bg: 'bg-[#007AFF]', onClick: () => { fileRef.current?.click(); setShowAppDrawer(false); } },
                        { id: 'gif', icon: <span className="font-black text-[10px] tracking-widest">GIF</span>, label: 'GIFs (Beta)', color: 'text-white', bg: 'bg-[#FF2D55]', onClick: () => { setShowGifPicker(true); setShowAppDrawer(false); } },
                        { id: 'sticker', icon: <Smile size={18} />, label: 'Stickers', color: 'text-white', bg: 'bg-[#5856D6]', onClick: () => { setShowStickerPicker(true); setShowAppDrawer(false); } },
                        { id: 'poll', icon: <BarChart2 size={18} />, label: 'Polls', color: 'text-white', bg: 'bg-[#34C759]', onClick: () => { setShowPollCreator(true); setShowAppDrawer(false); } },
                        { id: 'qd', icon: <Wallet size={18} />, label: 'Pay', color: 'text-white', bg: 'bg-[#FF9500]', onClick: () => { setShowWalletTransfer(true); setShowAppDrawer(false); } },
                        { id: 'burn', icon: <Flame size={18} />, label: 'Burn Timer', color: 'text-white', bg: 'bg-[#FF3B30]', onClick: () => { setBurnTimer(burnTimer ? null : 60); setShowAppDrawer(false); } },
                        { id: 'location', icon: <MapPin size={18} />, label: 'Location', color: 'text-white', bg: 'bg-[#32ADE6]', onClick: () => { 
                          if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(
                              (pos) => executeSendRef.current?.(`[LOCATION]${pos.coords.latitude},${pos.coords.longitude}`),
                              () => toast.error('Location denied')
                            );
                          }
                          setShowAppDrawer(false); 
                        } },
                        { id: 'secret', icon: <Lock size={18} />, label: isSecretChat ? 'Exit Secret Mode' : 'Secret Mode', color: 'text-white', bg: isSecretChat ? 'bg-[#FF3B30]' : 'bg-[#30D158]', onClick: () => { setIsSecretChat((s: boolean) => !s); setShowAppDrawer(false); } },
                          { id: 'ai', icon: <BrainCircuit size={18} />, label: 'Aegis AI Core', color: 'text-white', bg: 'bg-[#FF2D55]', onClick: () => { executeSendRef.current?.('[AEGIS_AI] Analyze sentiment and facts'); setShowAppDrawer(false); toast.success('Aegis AI Agent invoked'); } },
                          { id: 'superfluid', icon: <Droplet size={18} />, label: 'Superfluid Stream', color: 'text-white', bg: 'bg-[#32ADE6]', onClick: () => { executeSendRef.current?.('[SUPERFLUID] Stream 100 USDC/month'); setShowAppDrawer(false); toast.success('Superfluid Stream Initialized'); } },
                          { id: 'escrow', icon: <ShieldCheck size={18} />, label: 'HTLC Escrow', color: 'text-white', bg: 'bg-[#FF9500]', onClick: () => { executeSendRef.current?.('[HTLC_ESCROW] Lock funds in smart contract'); setShowAppDrawer(false); toast.success('HTLC Escrow contract deployed'); } },
                          { id: 'crosschain', icon: <ArrowRightLeft size={18} />, label: 'Cross-Chain', color: 'text-white', bg: 'bg-[#AF52DE]', onClick: () => { executeSendRef.current?.('[CROSS_CHAIN] Bridge asset via CCIP'); setShowAppDrawer(false); toast.success('Cross-Chain Intent signed'); } },
                          { id: 'livepeer', icon: <Radio size={18} />, label: 'Live Broadcast', color: 'text-white', bg: 'bg-[#FF3B30]', onClick: () => { executeSendRef.current?.('[LIVEPEER] Start decentralized broadcast'); setShowAppDrawer(false); toast.success('Livepeer RTMP Node starting'); } },
                          { id: 'miniapp', icon: <LayoutGrid size={18} />, label: 'Mini App', color: 'text-white', bg: 'bg-[#5856D6]', onClick: () => { executeSendRef.current?.('[MINI_APP] Launch syndicate game'); setShowAppDrawer(false); toast.success('Mini-App execution loaded'); } },
                        { id: 'schedule', icon: <Clock size={18} />, label: 'Schedule Send', color: 'text-white', bg: 'bg-[#AF52DE]', onClick: () => {
                            setShowAppDrawer(false);
                            // Open a native datetime-local picker via a temporary hidden input
                            const inp = document.createElement('input');
                            inp.type = 'datetime-local';
                            // Set min to now + 1 minute
                            const minDate = new Date(Date.now() + 60000);
                            inp.min = minDate.toISOString().slice(0, 16);
                            inp.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
                            document.body.appendChild(inp);
                            inp.onchange = () => {
                              const picked = new Date(inp.value);
                              if (!isNaN(picked.getTime()) && picked > new Date()) {
                                setScheduledAt(picked);
                                toast.success(`Message scheduled for ${picked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
                              }
                              document.body.removeChild(inp);
                            };
                            inp.click();
                          } },
                        { id: 'ai', icon: <span className="font-bold text-[10px]">AI</span>, label: 'AI Reply', color: 'text-white', bg: 'bg-[#000000]', onClick: () => { setInputText('Sure, sounds good to me.'); setShowAppDrawer(false); } },
                      ].map((app, idx) => (
                        <button 
                          key={app.id} 
                          type="button" 
                          onClick={app.onClick} 
                          className={`flex items-center gap-3.5 px-4 py-3 hover:bg-black/5 active:bg-black/10 transition-colors w-full text-left ${idx !== 0 ? 'border-t border-black/[0.04]' : ''}`}
                        >
                          <div className={`w-8 h-8 rounded-full ${app.bg} ${app.color} flex items-center justify-center shrink-0 shadow-sm`}>
                            {app.icon}
                          </div>
                          <span className="text-[15px] font-semibold text-[#000000] tracking-tight">{app.label}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                  </AnimatePresence>

                  {/* ── Main Input Row ── */}
                  <div className="flex items-end gap-2 px-3 pb-3 pt-2 w-full relative z-40 bg-white">
                    <button
                      type="button"
                      onClick={() => { setShowAppDrawer(d => !d); setShowEmojiPicker(false); }}
                      className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition-all duration-300 mt-auto mb-0.5 ${showAppDrawer ? 'bg-[#000000] text-white rotate-45 scale-90 shadow-md' : 'bg-[#E5E5EA] text-[#8E8E93] hover:bg-[#D1D1D6] hover:text-[#000000]'}`}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setShowEmojiPicker(d => !d); setShowAppDrawer(false); }}
                      className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition-all duration-300 mt-auto mb-0.5 ${showEmojiPicker ? 'bg-[#1c7aff] text-white shadow-md scale-105' : 'bg-transparent text-[#8e8e93] hover:bg-[#E5E5EA] hover:text-[#000000]'}`}
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                    </button>

                    <AnimatePresence>
                      {showEmojiPicker && (
                        <>
                          <div 
                            className="fixed inset-0 z-[90]" 
                            onClick={() => setShowEmojiPicker(false)} 
                          />
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute bottom-[60px] left-2 z-[100] shadow-2xl rounded-[20px] overflow-hidden border border-black/10"
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

                    <div className="flex-1 bg-white border border-[#c8c8cc] rounded-3xl flex items-end relative shadow-sm overflow-hidden min-h-[38px] transition-all focus-within:border-blue-400">
                      {isRecording ? (
                        <div className="flex-1 flex items-center justify-between px-4 py-2 bg-[#f5f5f7] h-[38px]">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-[#ff3b30] animate-pulse" />
                            <span className="text-[14px] font-mono font-medium text-[#ff3b30]">
                              {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={cancelRecording}
                              className="text-black/40 hover:text-black/80 font-bold text-[12px] uppercase tracking-widest px-2 py-1"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={stopRecording}
                              className="w-7 h-7 rounded-full bg-[#30d158] flex items-center justify-center text-white shadow-sm active:scale-95"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="ml-0.5"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <textarea
                            ref={inputRef as any}
                            value={inputText}
                            onChange={e => {
                              setInputText(e.target.value);
                              e.target.style.height = '38px';
                              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                            }}
                            onKeyDown={e => {
                              if (ledgerSettings?.mechanical_keyboard) playKeyClick();
                              const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
                              if (e.key === 'Enter' && !e.shiftKey && !isTouch) {
                                e.preventDefault();
                                if (inputText.trim() && !isUploading) {
                                  handleSend(e as any);
                                  (e.target as HTMLTextAreaElement).style.height = '38px';
                                }
                              }
                            }}
                            disabled={isUploading}
                            placeholder={isUploading ? "Uploading..." : "Message"}
                            rows={1}
                            // [CRITICAL FIX] font-size: 16px is required on iOS Safari to prevent the UI from zooming in when focused!
                            className="flex-1 bg-transparent px-4 py-2 text-[#050505] focus:outline-none placeholder:text-black/30 disabled:opacity-50 text-[16px] resize-none max-h-[120px] scrollbar-none leading-relaxed min-h-[38px]"
                            style={{ paddingRight: inputText.trim() ? '45px' : '36px' }}
                          />
                          
                          {/* Inside input right-side actions */}
                          <div className="absolute right-1 bottom-[3px] flex items-center">
                            {inputText.trim() ? (
                              <LottieSendButton
                                disabled={sending || isUploading}
                                data-key={sendAnimKey}
                                onTrigger={() => {}}
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={startRecording}
                                className="w-8 h-8 rounded-full flex items-center justify-center transition-all text-[#8e8e93] hover:text-black active:scale-95"
                              >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </form>

            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-[#f9f9fb] relative overflow-y-auto p-6 md:p-12 border-l border-black/10 shadow-inner">
            {/* Ambient glows */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#1c7aff]/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="w-full max-w-xl flex flex-col items-center text-center relative z-10">
              <div className="w-20 h-20 rounded-[28px] bg-gradient-to-br from-[#1c7aff] to-[#5856D6] flex items-center justify-center mb-8 shadow-2xl">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              </div>
              <h1 className="text-[32px] md:text-[42px] font-bold tracking-tight text-[#1C1C1E] mb-4">Select a conversation</h1>
              <p className="text-[16px] md:text-[18px] text-[#1C1C1E]/50 font-medium leading-relaxed max-w-sm mb-10">
                Choose from your existing contacts, or start a new conversation by entering a wallet address.
              </p>
              <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
                {[
                  { icon: '🔐', label: 'End-to-End Encrypted' },
                  { icon: '🌐', label: 'Decentralized Network' },
                  { icon: '🔥', label: 'Burn on Read' },
                  { icon: '💎', label: 'Send QD Tokens' }
                ].map((f) => (
                  <div key={f.label} className="bg-white rounded-2xl p-4 border border-black/5 shadow-sm flex flex-col items-center gap-2 text-center">
                    <span className="text-2xl">{f.icon}</span>
                    <span className="text-[12px] font-bold text-[#1C1C1E]/70">{f.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      {/* NOTE: remoteAudioRef lives ONLY inside the active call portal below to avoid ref conflicts */}

      {/* ── Incoming Call Banner (state: ringing) ───────────────────────────── */}
      {callState === 'ringing' && isMounted && typeof document !== 'undefined'
        ? (createPortal(
        <div className="fixed inset-0 w-full h-full flex flex-col items-center justify-between bg-white" style={{ zIndex: 200000, touchAction: 'none' }}>
          {/* Top section */}
          <div className="flex flex-col items-center w-full pt-[max(60px,env(safe-area-inset-top,60px))] px-6">
            <p className="text-black/40 text-[11px] font-semibold uppercase tracking-[0.3em] mb-2">
              {callTypeRef.current === 'video' ? '📹 Incoming Video Call' : '🎙️ Incoming Voice Call'}
            </p>
            <p className="text-black/25 text-[13px] font-mono mb-10">Ledger Chat · End-to-end encrypted</p>

            {/* Animated avatar */}
            <div className="relative flex items-center justify-center mb-8">
              <div className="absolute w-56 h-56 rounded-full border border-black/10 animate-ping" style={{ animationDuration: '3s' }} />
              <div className="absolute w-44 h-44 rounded-full border border-black/10 animate-ping" style={{ animationDuration: '2.2s', animationDelay: '0.4s' }} />
              <div className="absolute w-36 h-36 rounded-full border border-black/10 animate-ping" style={{ animationDuration: '1.8s', animationDelay: '0.8s' }} />
              <div className="w-28 h-28 rounded-full flex items-center justify-center relative z-10 shadow-xl bg-[#f5f5f7] border border-black/10">
                <span className="text-black text-4xl font-black">{activePeer ? activePeer.slice(2, 4).toUpperCase() : '🐳'}</span>
              </div>
            </div>

            <p className="text-black text-[28px] font-black tracking-tight mb-1">{activePeer ? getDisplayName(activePeer) : 'Unknown Peer'}</p>
            <p className="text-black/50 text-[13px] font-mono animate-pulse">Ringing...</p>
          </div>

          {/* Bottom controls */}
          <div className="w-full flex items-end justify-between px-12 pb-[max(48px,env(safe-area-inset-bottom,48px))]">
            {/* Decline */}
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={declineCall}
                className="w-[72px] h-[72px] rounded-full flex items-center justify-center transition-all active:scale-90 shadow-sm bg-[#f5f5f7] border border-black/10"
              >
                <PhoneOff size={30} className="text-[#050505]" />
              </button>
              <span className="text-black/50 text-[11px] font-medium tracking-widest uppercase">Decline</span>
            </div>

            {/* Answer */}
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={answerCall}
                className="w-[84px] h-[84px] rounded-full flex items-center justify-center transition-all active:scale-90 shadow-xl bg-[#050505]"
              >
                <Phone size={36} className="text-white" />
              </button>
              <span className="text-black/50 text-[11px] font-medium tracking-widest uppercase">Answer</span>
            </div>
          </div>
        </div>,
        document.body
      ) as React.ReactNode) : null}
      {/* ── Outgoing Call (state: calling — waiting for answer) ─────────────── */}
      {(callState === 'calling' && isMounted && typeof document !== 'undefined')
        ? (createPortal(
        <div className="fixed inset-0 w-full h-full flex flex-col items-center justify-between bg-white" style={{ zIndex: 200000, touchAction: 'none' }}>
          <div className="flex flex-col items-center w-full pt-[max(60px,env(safe-area-inset-top,60px))] px-6">
            <p className="text-black/40 text-[11px] font-semibold uppercase tracking-[0.3em] mb-2">
              {callTypeRef.current === 'video' ? '📹 Video Call' : '🎙️ Voice Call'}
            </p>
            <p className="text-black/25 text-[13px] font-mono mb-10">Ledger Chat · End-to-end encrypted</p>

            <div className="relative flex items-center justify-center mb-8">
              <div className="absolute w-52 h-52 rounded-full border border-black/10 animate-ping" style={{ animationDuration: '3s' }} />
              <div className="absolute w-40 h-40 rounded-full border border-black/10 animate-ping" style={{ animationDuration: '2.2s', animationDelay: '0.4s' }} />
              <div className="w-28 h-28 rounded-full flex items-center justify-center relative z-10 shadow-xl bg-[#f5f5f7] border border-black/10">
                <span className="text-black text-4xl font-black">{activePeer ? activePeer.slice(2, 4).toUpperCase() : '🐳'}</span>
              </div>
            </div>

            <p className="text-black text-[28px] font-black tracking-tight mb-1">{activePeer ? getDisplayName(activePeer) : 'Unknown Peer'}</p>
            <p className="text-black/40 text-[13px] font-mono animate-pulse">Calling...</p>
          </div>

          <div className="w-full flex flex-col items-center pb-[max(32px,env(safe-area-inset-bottom,32px))]">
             <button
                onClick={performEndCallRef.current}
                className="w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-sm bg-[#f5f5f7] border border-black/10"
              >
                <PhoneOff size={28} className="text-[#050505]" />
              </button>
              <span className="text-black/40 text-[11px] font-mono mt-3 uppercase tracking-widest">Cancel</span>
          </div>
        </div>,
        document.body
      ) as React.ReactNode) : null}

      {/* ── Active Call Overlay — WhatsApp/Telegram parity ──────── */}
      {callState === 'active' && isMounted && (
        isCallMinimized ? createPortal(
          /* ── MINIMIZED VIEW (Floating Banner or Video PiP) ── */
          callType === 'video' ? (
             <motion.div
              drag
              dragConstraints={{ top: 0, left: 0, right: typeof window !== 'undefined' ? window.innerWidth - 120 : 0, bottom: typeof window !== 'undefined' ? window.innerHeight - 160 : 0 }}
              initial={{ x: 20, y: 80 }}
              onClick={() => setIsCallMinimized(false)}
              className="fixed z-[100000] w-28 h-40 md:w-36 md:h-52 rounded-2xl overflow-hidden shadow-2xl bg-black cursor-pointer border-2 border-black/30"
            >
               <video 
                  ref={el => { if (el && el.srcObject !== remoteStream) el.srcObject = remoteStream; }} 
                  autoPlay playsInline muted={false} className="w-full h-full object-cover" 
               />
               <div className="absolute top-2 left-2 bg-black text-white text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                 {formatDuration(callDurationSeconds)}
               </div>
            </motion.div>
          ) : (
            <div 
              onClick={() => setIsCallMinimized(false)}
              className="fixed top-0 left-0 w-full z-[100000] bg-black text-white px-4 py-2 flex items-center justify-between cursor-pointer shadow-lg animate-in slide-in-from-top"
              style={{ paddingTop: 'max(8px, env(safe-area-inset-top, 8px))' }}
            >
              <div className="flex items-center gap-2">
                <Volume2 size={16} className="animate-pulse" />
                <span className="text-xs font-bold font-mono">Tap to return to call</span>
              </div>
              <span className="text-xs font-mono font-black">{formatDuration(callDurationSeconds)}</span>
              <audio ref={remoteAudioRef} autoPlay playsInline style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} />
            </div>
          ),
          document.body
        ) : (
          /* ── FULL SCREEN VIEW ── */
          <div className="fixed inset-0 w-full h-full bg-black flex flex-col" style={{ zIndex: 200000, touchAction: 'none' }}>
            
            {/* ── BACKGROUND ── */}
            <div className="absolute inset-0">
              {callTypeRef.current === 'video' ? (
                remoteStream ? (
                  <video 
                     ref={el => { if (el && el.srcObject !== remoteStream) el.srcObject = remoteStream; }} 
                     autoPlay playsInline className="w-full h-full object-cover" 
                     style={{ filter: networkQuality === 'poor' ? 'blur(4px)' : 'none' }} 
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-[#f5f5f7]">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-full bg-black/5 animate-ping scale-150" style={{ animationDuration: '2s' }} />
                      <div className="w-28 h-28 rounded-full flex items-center justify-center shadow-xl relative z-10 bg-white border border-black/5">
                        <span className="text-black text-4xl font-black">{activePeer ? activePeer.slice(2, 4).toUpperCase() : '🐳'}</span>
                      </div>
                    </div>
                    <p className="text-black/50 text-sm font-mono uppercase tracking-widest animate-pulse">Connecting video...</p>
                  </div>
                )
              ) : (
                /* ── AUDIO CALL ── */
                <div className="w-full h-full flex flex-col items-center justify-center bg-[#f5f5f7]">
                  <div className="relative z-10 flex flex-col items-center gap-8">
                    {/* Audio Visualizer Rings */}
                    <div className="relative flex items-center justify-center">
                      {remoteStream && (
                        <>
                          <div className="absolute rounded-full border border-black/10 transition-all duration-75" style={{ width: 140 + audioLevel * 1.5, height: 140 + audioLevel * 1.5, opacity: Math.min(1, audioLevel / 50 + 0.1) }} />
                          <div className="absolute rounded-full bg-black/5 transition-all duration-75" style={{ width: 120 + audioLevel, height: 120 + audioLevel, opacity: Math.min(1, audioLevel / 100 + 0.2) }} />
                        </>
                      )}
                      <div className="w-32 h-32 rounded-full flex items-center justify-center shadow-lg relative z-10 bg-white border border-black/5">
                        <span className="text-black text-5xl font-black">{activePeer ? activePeer.slice(2, 4).toUpperCase() : '🐳'}</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-black text-[30px] font-black tracking-tight mb-2">{activePeer ? getDisplayName(activePeer) : 'Unknown Peer'}</p>
                      {remoteStream ? (
                        <span className={`text-[13px] font-mono uppercase tracking-[0.25em] flex items-center gap-2 justify-center ${networkQuality === 'poor' ? 'text-black/50' : 'text-black/80'}`}>
                          <span className={`w-2 h-2 rounded-full animate-pulse ${networkQuality === 'poor' ? 'bg-black/50' : 'bg-black/80'}`} />
                          {networkQuality === 'poor' ? 'Poor Connection' : formatDuration(callDurationSeconds)}
                        </span>
                      ) : (
                        <span className="text-black/40 text-[13px] font-mono uppercase tracking-widest animate-pulse">Establishing audio...</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── PiP LOCAL VIDEO ── */}
            {callType === 'video' && (
              <motion.div
                drag
                dragConstraints={{ top: 60, left: 20, right: 20, bottom: 120 }}
                initial={{ x: 0, y: 0 }}
                className="absolute top-[80px] right-4 z-20 cursor-grab active:cursor-grabbing"
              >
                {!isCamOff && localStream ? (
                  <div className="w-28 h-40 md:w-36 md:h-52 rounded-2xl overflow-hidden border-2 border-white/60 shadow-[0_20px_60px_rgba(0,0,0,0.5)] bg-black">
                    <video 
                       ref={el => { if (el && el.srcObject !== localStream) el.srcObject = localStream; }} 
                       autoPlay playsInline muted className="w-full h-full object-cover" 
                    />
                  </div>
                ) : (
                  <div className="w-28 h-40 md:w-36 md:h-52 rounded-2xl bg-black/80 border-2 border-white/20 flex items-center justify-center">
                    <VideoOff size={24} className="text-white/40" />
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Top Bar ── */}
            <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-5 pointer-events-none" style={{ paddingTop: 'max(16px, env(safe-area-inset-top, 16px))' }}>
              <div className="flex items-center gap-3 bg-white/90 backdrop-blur-xl rounded-2xl px-4 py-2.5 border border-black/10 shadow-sm pointer-events-auto">
                <div className="w-8 h-8 rounded-full bg-[#f5f5f7] border border-black/10 flex items-center justify-center">
                  <span className="text-black text-xs font-black">{activePeer ? activePeer.slice(2, 4).toUpperCase() : '??'}</span>
                </div>
                <div>
                  <p className="text-black text-[13px] font-bold leading-none">{activePeer ? getDisplayName(activePeer) : 'Peer'}</p>
                  <p className="text-black/50 text-[10px] font-mono mt-0.5">{callType === 'video' ? '📹 Video' : '🎙️ Audio'}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowCallSettings(true)}
                  className="bg-white/90 hover:bg-white active:scale-95 transition-all backdrop-blur-xl rounded-full w-10 h-10 flex items-center justify-center border border-black/10 shadow-sm pointer-events-auto text-black"
                >
                  <Settings size={20} />
                </button>
                <button 
                  onClick={() => setIsCallMinimized(true)}
                  className="bg-white/90 hover:bg-white active:scale-95 transition-all backdrop-blur-xl rounded-full w-10 h-10 flex items-center justify-center border border-black/10 shadow-sm pointer-events-auto"
                >
                  <div className="w-3 h-3 border-b-2 border-l-2 border-black transform -rotate-45" />
                </button>
              </div>
            </div>

            {/* ── Network Alert ── */}
            {networkQuality === 'poor' && (
              <div className="absolute top-[100px] left-1/2 -translate-x-1/2 bg-[#050505]/90 backdrop-blur text-white text-[11px] font-mono font-bold px-4 py-1.5 rounded-full z-20 flex items-center gap-2">
                 ⚠️ Weak Connection
              </div>
            )}

            {/* ── Expanded Controls ── */}
            <div
              className="absolute bottom-0 inset-x-0 z-30 flex flex-col gap-4 pb-8"
              style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom, 32px))' }}
            >
              {/* Secondary Controls Row (Camera Flip, Screen Share) */}
              <div className="flex items-center justify-center gap-6 opacity-90 mb-2">
                 {callType === 'video' && (
                   <>
                     <button onClick={switchCamera} className="w-12 h-12 rounded-full bg-white/90 backdrop-blur flex items-center justify-center text-black hover:bg-white transition-all border border-black/10 shadow-sm">
                       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.29 7 12 12 20.71 7"></polyline><line x1="12" y1="22" x2="12" y2="12"></line></svg>
                     </button>
                     <button onClick={toggleScreenShare} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all border border-black/10 shadow-sm ${isScreenSharing ? 'bg-black text-white' : 'bg-white/90 backdrop-blur text-black hover:bg-white'}`}>
                       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                     </button>
                   </>
                 )}
                 {callType === 'audio' && (
                   <button className="w-12 h-12 rounded-full bg-white/90 backdrop-blur flex items-center justify-center text-black border border-black/10 cursor-not-allowed opacity-50 shadow-sm">
                     <Volume2 size={20} />
                   </button>
                 )}
              </div>

              {/* Primary Controls Row */}
              <div className="flex items-center justify-center gap-8 mx-auto bg-white/90 backdrop-blur-2xl px-8 py-4 rounded-[2.5rem] border border-black/10 shadow-xl">
                <button
                  onClick={toggleMic}
                  className={`w-[60px] h-[60px] rounded-full flex items-center justify-center transition-all active:scale-90 shadow-sm ${
                    isMicMuted
                      ? 'bg-black text-white'
                      : 'bg-[#f5f5f7] text-black hover:bg-[#e5e5ea]'
                  }`}
                >
                  {isMicMuted ? <MicOff size={24} /> : <Mic size={24} />}
                </button>

                <button
                  onClick={endCall}
                  className="w-[72px] h-[72px] bg-[#050505] rounded-[28px] flex items-center justify-center text-white hover:opacity-80 active:scale-90 transition-all shadow-[0_8px_32px_rgba(0,0,0,0.15)]"
                >
                  <PhoneOff size={32} />
                </button>

                {callType === 'video' ? (
                  <button
                    onClick={toggleCamera}
                    className={`w-[60px] h-[60px] rounded-full flex items-center justify-center transition-all active:scale-90 shadow-sm ${
                      isCamOff
                        ? 'bg-black text-white'
                        : 'bg-[#f5f5f7] text-black hover:bg-[#e5e5ea]'
                    }`}
                  >
                    {isCamOff ? <VideoOff size={24} /> : <Video size={24} />}
                  </button>
                ) : (
                  <div className="w-[60px] h-[60px]" />
                )}
              </div>
            </div>

            <audio ref={remoteAudioRef} autoPlay playsInline style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} />
          </div>
        )
      )}

      </div> {/* Close Chat Area */}

      {(showCallSettings && isMounted && typeof document !== 'undefined')
        ? createPortal(
        <div className="fixed inset-0 z-[300000] bg-black/30 backdrop-blur-sm flex flex-col items-center justify-center p-6 animate-in fade-in duration-200" onClick={() => setShowCallSettings(false)}>
           <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
               <div className="flex justify-between items-center mb-8">
                   <h3 className="text-[13px] font-black uppercase tracking-[0.25em] text-[#050505]">Call Settings</h3>
                   <button onClick={() => setShowCallSettings(false)} className="w-10 h-10 flex items-center justify-center hover:bg-black/5 rounded-full transition-colors text-[#050505]">
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                   </button>
               </div>
               
               <div className="space-y-4">
                 {/* Voice Isolation */}
                 <div className="flex items-center justify-between p-4 bg-[#f5f5f7] rounded-2xl">
                   <div>
                     <h4 className="text-[13px] font-bold text-black">Voice Isolation</h4>
                     <p className="text-[11px] font-mono text-black/50 mt-1">Filters out background noise</p>
                   </div>
                   <button 
                     onClick={toggleVoiceIsolation}
                     className={`w-12 h-6 rounded-full transition-colors relative ${voiceIsolation ? 'bg-[#050505]' : 'bg-black/20'}`}
                   >
                     <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all ${voiceIsolation ? 'left-6' : 'left-0.5'}`} />
                   </button>
                 </div>

                 {/* Data Saver Mode */}
                 <div className="flex items-center justify-between p-4 bg-[#f5f5f7] rounded-2xl">
                   <div>
                     <h4 className="text-[13px] font-bold text-black">Data Saver</h4>
                     <p className="text-[11px] font-mono text-black/50 mt-1">Reduces video quality (480p)</p>
                   </div>
                   <button 
                     onClick={toggleDataSaver}
                     className={`w-12 h-6 rounded-full transition-colors relative ${dataSaver ? 'bg-[#050505]' : 'bg-black/20'}`}
                   >
                     <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all ${dataSaver ? 'left-6' : 'left-0.5'}`} />
                   </button>
                 </div>

                 {/* End-to-End Encryption Verification */}
                 <button 
                   onClick={() => { setShowCallSettings(false); setShowE2EE(true); }}
                   className="w-full p-4 bg-black/5 hover:bg-black/10 transition-colors rounded-2xl flex items-center justify-between"
                 >
                   <div>
                     <h4 className="text-[13px] font-bold text-black text-left">E2EE Verification</h4>
                     <p className="text-[11px] font-mono text-black/50 mt-1">Verify connection security</p>
                   </div>
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                 </button>
               </div>
           </div>
        </div>,
        document.body
      ) : null}

      {(showE2EE && isMounted && typeof document !== 'undefined')
        ? createPortal(
        <div className="fixed inset-0 z-[200000] bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
           <div className="w-full max-w-sm">
               <div className="flex justify-between items-center mb-8">
                   <h3 className="text-[13px] font-black uppercase tracking-[0.25em] text-[#050505]">E2EE Status</h3>
                   <button onClick={() => setShowE2EE(false)} className="w-10 h-10 flex items-center justify-center hover:bg-black/5 rounded-full transition-colors text-[11px] font-black uppercase text-[#050505]">
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                   </button>
               </div>
               
               <div className="flex flex-col items-center justify-center gap-4 mb-6">
                 <div className="w-16 h-16 rounded-full bg-[#f5f5f7] flex items-center justify-center text-[#050505]">
                   <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                 </div>
                 <h4 className="text-[18px] font-black text-black">Connection is Secure</h4>
                 <p className="text-[12px] font-mono text-black/60 text-center px-4">
                   Your call with <br/> <span className="font-bold text-black">{activePeer ? shortAddr(activePeer) : 'this peer'}</span> <br/> is End-to-End Encrypted.
                 </p>
               </div>

               <div className="p-4 bg-[#f5f5f7] rounded-2xl break-all text-center">
                 <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-2">Verification Hash</p>
                 <p className="text-[11px] font-mono text-black font-bold">
                   {activePeer ? (activePeer + address!).replace(/0x/g, '').slice(0, 32).toUpperCase().match(/.{1,4}/g)?.join(' ') : '...'}
                 </p>
               </div>
           </div>
        </div>,
        document.body
      ) : null}

      {(showScanner && isMounted && typeof document !== 'undefined')
        ? createPortal(
        <div className="fixed inset-0 z-[200000] bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
           <div className="w-full max-w-sm">
               <div className="flex justify-between items-center mb-8">
                   <h3 className="text-[13px] font-black uppercase tracking-[0.25em] text-[#050505]">Scan Peer QR</h3>
                   <button onClick={() => setShowScanner(false)} className="w-10 h-10 flex items-center justify-center hover:bg-black/5 rounded-full transition-colors text-[11px] font-black uppercase text-[#050505]">
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                   </button>
               </div>
               <div className="mb-8">
                 <p className="text-[10px] text-black/40 text-center font-mono leading-relaxed px-4">
                   Establish a cryptographically secured P2P channel by scanning a peer&apos;s System QR identity.
                 </p>
               </div>
               <QrScanner mode="scan" onScanSuccess={(addr) => handleStartConversationWithPeer(addr)} />
           </div>
        </div>,
        document.body
      ) : null}

      {(showMyQR && isMounted && typeof document !== 'undefined')
        ? createPortal(
        <div className="fixed inset-0 z-[200000] bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
           <div className="w-full max-w-sm">
               <div className="flex justify-between items-center mb-8">
                   <h3 className="text-[13px] font-black uppercase tracking-[0.25em] text-[#050505]">My Identity QR</h3>
                   <button onClick={() => setShowMyQR(false)} className="w-10 h-10 flex items-center justify-center hover:bg-black/5 rounded-full transition-colors text-[11px] font-black uppercase text-[#050505]">
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                   </button>
               </div>
               <QrScanner 
                   mode="project" 
                   projectValue={address} 
                   projectTitle={chatName || "KYC Identity"} 
                   projectDescription={chatBio || "Present this code to a peer. Once scanned, you can start messaging securely."} 
               />
           </div>
        </div>,
        document.body
      ) : null}

       {/* Context Menu Overlay */}
       {(contextMenu && typeof document !== 'undefined')
         ? createPortal(
         <div className="fixed inset-0 z-[200]" onClick={() => setContextMenu(null)}>
           <div 
             className="absolute bg-white  border border-black/10  rounded-2xl shadow-xl p-2 min-w-[160px] flex flex-col"
             style={{ 
               top: Math.min(contextMenu.y / (typeof window !== 'undefined' ? parseFloat(getComputedStyle(document.documentElement).zoom || '1') : 1), window.innerHeight - 150), 
               left: Math.min(contextMenu.x / (typeof window !== 'undefined' ? parseFloat(getComputedStyle(document.documentElement).zoom || '1') : 1), window.innerWidth - 180) 
             }}
             onClick={e => e.stopPropagation()}
           >
             <button onClick={() => {
                 navigator.clipboard.writeText(contextMenu.content.replace(/^\[.*?\]/, ''));
                 setContextMenu(null);
             }} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-black/5  text-[11px] font-mono text-[#050505]  text-left">
                <Copy size={14} /> Copy Text
             </button>
             <button onClick={() => {
                 setReplyingTo({ id: contextMenu.id, content: contextMenu.content });
                 setContextMenu(null);
                 setTimeout(() => inputRef.current?.focus(), 100);
             }} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-black/5 text-[11px] font-mono text-[#050505] text-left">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg> Reply
             </button>
             <button onClick={() => {
                 setForwardMsg({ id: contextMenu.id, content: contextMenu.content });
                 setContextMenu(null);
             }} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-black/5 text-[11px] font-mono text-[#050505] text-left">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/></svg> Forward
             </button>
             <button onClick={() => {
                 executeSend(`__PIN__${contextMenu.id}`);
                 setContextMenu(null);
             }} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-black/5 text-[11px] font-mono text-[#050505] text-left">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg> Pin Message
             </button>
             <button onClick={() => {
                 setMessages(prev => prev.filter(m => m.id !== contextMenu.id));
                 executeSend(`__REVOKE__${contextMenu.id}`);
                 setContextMenu(null);
             }} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-black/5 text-[11px] font-mono text-[#050505] text-left">
                <Trash2 size={14} /> Delete for everyone
             </button>
             <button onClick={() => {
                 reportMessage(contextMenu.id, contextMenu.content);
             }} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-black/5 text-[11px] font-mono text-red-500 text-left">
                🚩 Report Message
             </button>
           </div>
         </div>,
         document.body
       ) : null}

        {/* Hito 4: Forward Message Modal */}
        {forwardMsg && (
          <div className="fixed inset-0 z-[300] bg-black/30 backdrop-blur-sm flex items-end justify-center" onClick={() => setForwardMsg(null)}>
            <div className="w-full max-w-md bg-white rounded-t-3xl p-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-300" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[13px] font-black uppercase tracking-widest text-gray-800">Forward to...</h3>
                <button onClick={() => setForwardMsg(null)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#e5e5ea] text-black/40">✕</button>
              </div>
              <div className="bg-[#f5f5f7] rounded-xl border border-black/5 px-3 py-2 mb-3">
                <p className="text-[11px] font-mono text-black/50 truncate">{forwardMsg.content ? formatMessagePreview(forwardMsg.content) : 'Message'}</p>
              </div>
              <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
                {conversations.map(conv => (
                  <button key={conv.peerAddress} onClick={() => {
                    const content = forwardMsg.content ? formatMessagePreview(forwardMsg.content) : 'Message';
                    const currentPeer = activePeer;
                    setActivePeer(conv.peerAddress);
                    setTimeout(() => { executeSendRef.current?.(`[Forwarded] ${content}`); setActivePeer(currentPeer); }, 300);
                    setForwardMsg(null);
                  }} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#f5f5f7] text-left">
                    <Avatar address={conv.peerAddress} />
                    <span className="text-[12px] font-mono text-gray-700 truncate">{conv.peerAddress.slice(0, 8)}...{conv.peerAddress.slice(-4)}</span>
                  </button>
                ))}
                {conversations.length === 0 && <p className="text-center text-[12px] text-black/40 py-6">No conversations yet</p>}
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

       {/* Phase 2: Immersive Lightbox Modal */}
       {(lightboxImg && typeof document !== 'undefined')
         ? createPortal(
        <div 
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/95 backdrop-blur-lg animate-in fade-in duration-200"
          onClick={() => setLightboxImg(null)}
        >
          <button 
            className="absolute top-6 right-6 text-white/50 hover:text-white bg-black/20 hover:bg-black/40 rounded-full p-2 transition-all"
            onClick={(e) => { e.stopPropagation(); setLightboxImg(null); }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
          <img 
            src={lightboxImg} 
            alt="Fullscreen" 
            className="max-w-[95vw] max-h-[90vh] object-contain shadow-2xl animate-in zoom-in-95 duration-300 select-none"
            onClick={(e) => e.stopPropagation()} 
          />
          <a 
            href={lightboxImg} 
            download="Ledger Chat_Media" 
            target="_blank" 
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="absolute bottom-8 flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-full backdrop-blur-md text-[13px] font-bold font-mono transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Download Original
          </a>
        </div>,
        document.body
       ) : null}

       {/* Phase 4: Clear Chat Confirmation Modal */}
       {showClearConfirm && typeof document !== 'undefined' ? createPortal(
         <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in zoom-in duration-200" style={{ zIndex: 200000 }}>
           <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center">
             <div className="w-16 h-16 rounded-full bg-[#f5f5f7] flex items-center justify-center text-[#050505] mb-4">
               <Trash2 size={28} />
             </div>
             <h3 className="text-[18px] font-black tracking-tight text-gray-900 mb-2">Clear Chat?</h3>
             <p className="text-[13px] text-black/50 mb-6 px-4">
               Are you sure you want to clear this conversation? This will remove all messages from your device.
             </p>
             <div className="flex items-center gap-3 w-full">
               <button onClick={() => setShowClearConfirm(false)} className="flex-1 py-3.5 rounded-xl bg-[#f5f5f7] hover:bg-[#e5e5ea] text-[13px] font-bold text-gray-700 transition-colors">
                 Cancel
               </button>
               <button onClick={executeClearChat} className="flex-1 py-3.5 rounded-xl bg-[#050505] hover:bg-[#050505] text-white text-[13px] font-bold transition-colors shadow-lg shadow-black/10">
                 Clear Chat
               </button>
             </div>
           </div>
         </div>,
         document.body
       ) : null}

       {/* Phase 4: Sidebar Context Menu */}
       {(sidebarMenu && typeof document !== 'undefined')
         ? createPortal(
         <div className="fixed inset-0 z-[200]" onClick={() => setSidebarMenu(null)} onContextMenu={(e) => { e.preventDefault(); setSidebarMenu(null); }}>
           <div 
             className="absolute bg-white border border-black/10 rounded-2xl shadow-xl p-2 min-w-[160px] flex flex-col animate-in fade-in zoom-in-95 duration-150"
             style={{ 
               top: Math.min(sidebarMenu.y, window.innerHeight - 150), 
               left: Math.min(sidebarMenu.x, window.innerWidth - 180) 
             }}
             onClick={e => e.stopPropagation()}
           >
             <button onClick={() => toggleArchive(sidebarMenu.peer)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-black/5 text-[11px] font-mono text-[#050505] text-left">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg> 
                {archivedPeers.has(sidebarMenu.peer.toLowerCase()) ? 'Unarchive' : 'Archive'}
             </button>
             <button onClick={() => deleteConversation(sidebarMenu.peer)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-black/5 text-[11px] font-mono text-[#050505] text-left mt-1">
                <Trash2 size={14} /> Delete Chat
             </button>
           </div>
         </div>,
         document.body
       ) : null}

       {/* Phase 5: Poll Creator Modal */}
       {showPollCreator && (
           <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
             <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl flex flex-col gap-4">
               <div className="flex items-center justify-between">
                 <h3 className="text-[16px] font-black tracking-tight text-gray-900">Create Poll</h3>
                 <button onClick={() => { setShowPollCreator(false); setPollQuestion(''); setPollOptions(['', '']); }} className="p-2 rounded-full hover:bg-[#e5e5ea] text-black/40">✕</button>
               </div>
               <input
                 type="text"
                 placeholder="Ask a question..."
                 value={pollQuestion}
                 onChange={e => setPollQuestion(e.target.value)}
                 className="w-full px-4 py-2.5 rounded-xl border border-black/10 text-[13px] font-medium focus:outline-none focus:border-black focus:ring-2 focus:ring-black/10"
               />
               <div className="flex flex-col gap-2">
                 {pollOptions.map((opt, i) => (
                   <div key={i} className="flex gap-2 items-center">
                     <input
                       type="text"
                       placeholder={`Option ${i + 1}`}
                       value={opt}
                       onChange={e => setPollOptions(prev => prev.map((o, j) => j === i ? e.target.value : o))}
                       className="flex-1 px-3 py-2 rounded-xl border border-black/10 text-[13px] focus:outline-none focus:border-black focus:ring-2 focus:ring-black/10"
                     />
                     {pollOptions.length > 2 && (
                       <button onClick={() => setPollOptions(prev => prev.filter((_, j) => j !== i))} className="text-black/40 hover:text-black/60 text-[12px] font-black">✕</button>
                     )}
                   </div>
                 ))}
                 {pollOptions.length < 5 && (
                   <button onClick={() => setPollOptions(prev => [...prev, ''])} className="text-black text-[12px] font-bold hover:underline text-left">+ Add option</button>
                 )}
               </div>
               <button
                 onClick={() => {
                   const validOpts = pollOptions.filter(o => o.trim());
                   if (!pollQuestion.trim() || validOpts.length < 2) return;
                   const pollId = `poll_${Date.now()}`;
                   const payload = `__POLL__${pollId}__::${pollQuestion.trim()}__::${validOpts.join('|')}`;
                   executeSend(payload);
                   setShowPollCreator(false);
                   setPollQuestion('');
                   setPollOptions(['', '']);
                 }}
                 className="w-full py-3.5 rounded-xl bg-[#050505] hover:opacity-80 text-white text-[13px] font-bold shadow-sm transition-colors"
               >
                 Send Poll
               </button>
             </div>
           </div>
       )}

       {/* Phase 5: Wallet QD Transfer Modal */}
       {showWalletTransfer && (
           <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
             <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl flex flex-col gap-4">
               <div className="flex items-center justify-between">
                 <div>
                   <h3 className="text-[16px] font-black tracking-tight text-gray-900">Send QD Tokens</h3>
                   <p className="text-[11px] text-black/40 font-mono mt-0.5">Balance: {balance.toFixed(4)} QD</p>
                 </div>
                 <button onClick={() => { setShowWalletTransfer(false); setTransferAmount(''); }} className="p-2 rounded-full hover:bg-[#e5e5ea] text-black/40">✕</button>
               </div>
               <div className="w-16 h-16 rounded-2xl bg-gradient-to-br bg-[#f5f5f7] border border-black/10 flex items-center justify-center self-center shadow-sm">
                 <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#050505" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
               </div>
               <p className="text-[12px] text-black/50 text-center font-mono">To: {shortAddr(activePeer!)}</p>
               <input
                 type="number"
                 placeholder="Amount in QD..."
                 value={transferAmount}
                 onChange={e => setTransferAmount(e.target.value)}
                 min="0.01"
                 step="0.01"
                 className="w-full px-4 py-3 rounded-xl border border-black/10 text-[18px] font-black text-center focus:outline-none focus:border-black focus:ring-2 focus:ring-black/10 font-mono"
               />
               <button
                 disabled={!transferAmount || parseFloat(transferAmount) <= 0 || parseFloat(transferAmount) > balance || transferSending}
                 onClick={async () => {
                   const parsed = parseFloat(transferAmount);
                   if (isNaN(parsed) || parsed <= 0 || parsed > balance) return;
                   if (!activePeer) { toast.error('No recipient selected.'); return; }
                   setTransferSending(true);
                   try {
                     // CRITICAL FIX: pass activePeer as recipient — previously QDs went to 0x000 burn address!
                     const ok = await spendQDs(parsed, `Transfer to ${shortAddr(activePeer!)}`, activePeer);
                     if (!ok) {
                       toast.error('Transfer failed. Check your Sovereign Identity balance.');
                       return;
                     }
                     // Only send XMTP payment signal AFTER confirmed transfer
                     executeSend(`__PAYMENT__::${parsed}`);
                     refreshBalanceRef.current().catch(() => {}); // Refresh sender QD balance
                     toast.success(`Sent ${parsed} QD to ${shortAddr(activePeer!)}!`);
                     setShowWalletTransfer(false);
                     setTransferAmount('');
                   } catch {
                     toast.error('Transfer failed. Please try again.');
                   } finally {
                     setTransferSending(false);
                   }
                 }}
                 className="w-full py-3.5 rounded-xl bg-[#050505] hover:opacity-80 text-white text-[13px] font-bold shadow-lg shadow-black/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
               >
                 {transferSending ? 'Processing...' : `Send ${transferAmount || '0'} QD`}
               </button>
             </div>
           </div>
       )}

      </div>

      {/* Fase 13: WebRTC Pre-Prompt — shown before getUserMedia is called */}
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

      {/* ── Save Contact Modal ── */}
      {showSaveContactModal && activePeer && isMounted && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[300000] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowSaveContactModal(false)}>
          <div
            className="bg-white rounded-3xl shadow-2xl border border-black/5 p-6 w-80 mx-4"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-[13px] font-black uppercase tracking-widest text-[#050505] mb-1">Save Contact</h3>
            <p className="text-[11px] text-black/40 font-mono mb-4 break-all">{activePeer}</p>
            <input
              autoFocus
              type="text"
              value={saveContactName}
              onChange={e => setSaveContactName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && saveContactName.trim() && address) {
                  saveLocalContact(address, { peerAddress: activePeer, name: saveContactName.trim() });
                  toast.success(`Contact saved as "${saveContactName.trim()}"`);
                  setShowSaveContactModal(false);
                }
              }}
              placeholder="Enter a name..."
              className="w-full bg-[#f5f5f7] rounded-xl px-4 py-2.5 text-[13px] text-[#050505] outline-none focus:ring-1 focus:ring-black/20 placeholder:text-black/30 font-mono mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowSaveContactModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#f5f5f7] text-[12px] font-bold text-black/50 hover:bg-black/5 transition-colors"
              >Cancel</button>
              <button
                onClick={() => {
                  if (saveContactName.trim() && address) {
                    saveLocalContact(address, { peerAddress: activePeer, name: saveContactName.trim() });
                    toast.success(`Contact saved as "${saveContactName.trim()}"`);
                    setShowSaveContactModal(false);
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#050505] text-[12px] font-bold text-white hover:opacity-80 transition-opacity disabled:opacity-30"
                disabled={!saveContactName.trim()}
              >Save</button>
            </div>
          </div>
        </div>,
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
          onAccepted={(peer) => {
            handleStartConversationWithPeer(peer);
          }}
        />,
        document.body
      )}
      </div>{/* end h-full flex-col layout wrapper */}
    <IncomingCallOverlay />
      <SyndicateModal isOpen={showSyndicateModal} onClose={() => setShowSyndicateModal(false)} client={client} onGroupCreated={() => setShowSyndicateModal(false)} />
    </TuringShieldGate>
  );
}


