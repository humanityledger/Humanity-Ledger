'use client';
import { BoundedLRU } from '@/lib/core/BoundedLRU';
import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, Video, Search, ChevronRight, X, Lock, Bell, Image as ImageIcon,
  Star, Palette, Clock, KeyRound, Download, Trash2, Ban, Copy, Check, Wallet, Link as LinkIcon,
} from 'lucide-react';
import { EncryptionInfoSheet } from './EncryptionInfoSheet';
import { wasVerified } from '@/lib/chat/verified-contacts';
import { setSynced, DEVICE_SYNC_EVENT, type DeviceSyncEventDetail } from '@/lib/sync/runtime';
import { WALLPAPER_OPTIONS } from './WallpaperPickerSheet';
import { isAgreementMessage } from '@/lib/aztec/agreement-message';
import { parseAttachmentMessage } from '@/lib/chat/remote-attachment';
import { useT } from '@/lib/i18n/client';
import { UserAvatar } from '@/components/chat/UserAvatar';
import { BodyPortal } from '@/components/chat/ui/BodyPortal';
import { useBackLayer } from '@/hooks/useMobileBackStack';
import { useCompactLayout } from '@/lib/layout/mobileViewport';
import { isPrivateNotesPeer } from '@/lib/chat/private-notes';

/**
 * Contact info for one chat, in two places that share one body (ContactInfoSections):
 *
 *   column  the details column beside the conversation on wide screens (ChatDetailsPanel), under the
 *           safety glyphs: About, Media and files, Personalization, Privacy, Actions.
 *   drawer  the same sections in a sheet from the right, on screens too narrow for the column.
 *
 * Mute is controlled by the chat when it passes isMuted and onToggleMute, so the Mute button in the
 * column, this toggle and the chat list always agree.
 */

const shortAddr = (addr: string) => (addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '');
const initials = (name: string, addr: string) => {
  if (name && name !== shortAddr(addr)) return name.slice(0, 2).toUpperCase();
  return addr ? addr.slice(2, 4).toUpperCase() : 'XX';
};

const ICON = { size: 17, strokeWidth: 1.75, 'aria-hidden': true } as const;
const TIMER_LABEL: Record<string, string> = { off: 'Off', '24h': '24 hours', '7d': '7 days', '90d': '90 days' };
const PAYMENT_PREFIXES = ['__PAYMENT__', '__ZK_MONEY_PAYMENT__', '__ZK_INVOICE__', '__ZK_TIP__', '__TIP__', '__ZK_STREAM__'];

function inner(content: string): string {
  return content.startsWith('__') && content.includes('__::') ? content.split('__::').pop() || '' : content;
}

/** What has been shared in the messages already loaded on this device. */
export function countShared(messages: { content?: unknown }[]) {
  let payments = 0;
  let files = 0;
  let links = 0;
  for (const m of messages) {
    if (typeof m.content !== 'string') continue;
    const c = inner(m.content);
    if (PAYMENT_PREFIXES.some((p) => c.startsWith(p)) || isAgreementMessage(c)) payments++;
    else if (parseAttachmentMessage(c) || c.startsWith('{"type":"hl.largefile"') || c.startsWith('[ATTACHMENT') || c.startsWith('__MEDIA__') || c.startsWith('[GIF]')) files++;
    else if (/https?:\/\/\S+/i.test(c) && !c.startsWith('__')) links++;
  }
  return { payments, files, links };
}

type PeerProfile = { bio?: string; avatarUrl?: string; displayName?: string };
const profileCache = new BoundedLRU<string, PeerProfile | null>({ max: 64, name: 'chat.profileCache' });

/** The peer's public profile, fetched once per address per page load. */
export function usePeerProfile(peerAddress: string): PeerProfile | null {
  const key = (peerAddress || '').toLowerCase();
  const [profile, setProfile] = useState<PeerProfile | null>(() => profileCache.get(key) ?? null);
  useEffect(() => {
    // Private Notes is not a person: never ask /api/user/profile about it.
    if (!key || isPrivateNotesPeer(key)) return;
    if (profileCache.has(key)) {
      setProfile(profileCache.get(key) ?? null);
      return;
    }
    let live = true;
    fetch(`/api/user/profile?walletAddress=${encodeURIComponent(peerAddress)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const u = data && (data.data || data.user || data.profile);
        const p: PeerProfile | null = u
          ? {
              bio: typeof u.bio === 'string' && u.bio.trim() && !u.bio.includes('Sovereign') ? u.bio.trim() : undefined,
              avatarUrl: u.avatarUrl || u.image || undefined,
              displayName: u.displayName || u.chatName || u.name || undefined,
            }
          : null;
        profileCache.set(key, p);
        if (live) setProfile(p);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [key, peerAddress]);
  return profile;
}

// ─── Controls ────────────────────────────────────────────────────────────────

const Toggle = ({ value }: { value: boolean }) => (
  <span
    aria-hidden="true"
    className={`icon-btn w-[44px] h-[26px] rounded-full flex items-center px-[2px] transition-colors duration-150 shrink-0 ${value ? 'bg-[#15171c]' : 'bg-[#d0d5dd]'}`}
  >
    <span className={`icon-btn w-[22px] h-[22px] rounded-full bg-white transition-transform duration-150 ${value ? 'translate-x-[18px]' : 'translate-x-0'}`} />
  </span>
);

const Row = ({
  icon, label, sublabel, value, onTap, danger = false, toggle, compact = false,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  value?: string;
  onTap?: () => void;
  danger?: boolean;
  toggle?: boolean;
  compact?: boolean;
}) => {
  return ((
  <button
    type="button"
    onClick={onTap}
    disabled={!onTap}
    role={toggle !== undefined ? 'switch' : undefined}
    aria-checked={toggle !== undefined ? toggle : undefined}
    className={`w-full min-h-[48px] flex items-center gap-3 border-b border-[#eef0f3] last:border-0 text-left transition-colors ${
      compact ? 'py-2.5 px-1 -mx-1 rounded-lg hover:bg-[#f7f8fa]' : 'py-3 active:bg-[#f7f8fa]'
    } disabled:cursor-default`}
  >
    <span
      className={`${compact ? 'w-8 h-8 rounded-[9px]' : 'w-[34px] h-[34px] rounded-[10px]'} flex items-center justify-center shrink-0 ${
        danger ? 'bg-[#FFF4F4] text-[#B42318]' : 'lg-recessed text-[#344054]'
      }`}
    >
      {icon}
    </span>
    <span className="flex-1 min-w-0">
      <span className={`block ${compact ? 'text-[14px]' : 'text-[15px]'} font-medium leading-tight ${danger ? 'text-[#B42318]' : 'text-[#15171c]'}`}>{label}</span>
      {sublabel && <span className="block text-[12px] text-[#727a88] mt-0.5 leading-snug">{sublabel}</span>}
    </span>
    <span className="flex items-center gap-2 shrink-0">
      {value && <span className="text-[13.5px] text-[#727a88] tabular-nums">{value}</span>}
      {toggle !== undefined ? <Toggle value={toggle} /> : onTap && !danger ? <ChevronRight size={16} strokeWidth={1.75} className="text-[#c9ced6]" aria-hidden="true" /> : null}
    </span>
  </button>
));
};

const Group = ({ title, footer, variant, children }: { title?: string; footer?: string; variant: 'drawer' | 'column'; children: React.ReactNode }) => (
  <section aria-label={title} className={variant === 'column' ? '' : 'mb-5'}>
    {title && (
      <h4 className={variant === 'column' ? 'mb-0.5 text-[13px] font-semibold text-[#15171c]' : 'text-[12.5px] font-semibold text-[#727a88] px-1 mb-1.5'}>
        {title}
      </h4>
    )}
    <div className={variant === 'column' ? 'flex flex-col' : 'lg-group rounded-[18px] overflow-hidden px-4'}>{children}</div>
    {footer && <p className="text-[12px] text-[#727a88] px-1 mt-2 leading-relaxed">{footer}</p>}
  </section>
);

const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => {
  const tr = useT();
  // Back closes this dialog only; the Contact info panel underneath stays open.
  useBackLayer(true, onClose);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  // Portalled to <body>: inside the drawer (transformed, overflow-clipped) WebKit cut it in half.
  return ((
  <BodyPortal>
  <div className="lg-scrim fixed inset-0 z-[260000] flex items-center justify-center p-3" onClick={onClose}>
    <motion.div
      role="dialog"
      aria-label={title}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      onClick={(e) => e.stopPropagation()}
      className="lg-sheet rounded-[28px] w-[min(calc(100vw-24px),420px)] flex flex-col max-h-[85dvh] overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 h-[60px] border-b border-black/[0.06]">
        <h3 className="font-semibold text-[16px] text-[#15171c]">{title}</h3>
        <button type="button" onClick={onClose} aria-label={tr("Close")} className="w-11 h-11 -mr-2 flex items-center justify-center rounded-full text-[#15171c] hover:bg-[#f2f4f7] transition-colors">
          <X size={18} strokeWidth={1.75} />
        </button>
      </div>
      <div className="p-5 overflow-y-auto overscroll-contain pb-[max(20px,env(safe-area-inset-bottom))]">{children}</div>
    </motion.div>
  </div>
  </BodyPortal>
));
};

// ─── Sections ────────────────────────────────────────────────────────────────

export interface ContactInfoSectionsProps {
  peerAddress: string;
  displayName: string;
  myAddress: string;
  messages?: any[];
  variant: 'drawer' | 'column';
  onBlock: () => void;
  onClearChat?: () => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
  /** The signed-in XMTP client, for the device-based safety number. */
  client?: any;
}

export function ContactInfoSections({
  peerAddress, displayName, myAddress, messages = [], variant, onBlock, onClearChat, isMuted: mutedProp, onToggleMute, client,
}: ContactInfoSectionsProps) {
  const tr = useT();
  const key = (peerAddress || '').toLowerCase();
  const compact = variant === 'column';
  const profile = usePeerProfile(peerAddress);
  const [lockChat, setLockChat] = useState(false);
  const [mutedLocal, setMutedLocal] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [disappearing, setDisappearing] = useState<'off' | '24h' | '7d' | '90d'>('off');
  const [toast, setToast] = useState<string | null>(null);
  const [modal, setModal] = useState<'disappearing' | 'media' | 'wallpaper' | 'encryption' | null>(null);
  const controlled = mutedProp !== undefined && !!onToggleMute;
  const isMuted = controlled ? !!mutedProp : mutedLocal;

  const shared = useMemo(() => countShared(messages), [messages]);

  const readLocalPrefs = () => {
    try {
      setLockChat(!!localStorage.getItem('ledger_locked_' + key));
      setMutedLocal(!!localStorage.getItem('ledger_muted_' + key));
      setDisappearing((localStorage.getItem('ledger_disappearing_' + key) as any) || 'off');
      let favs: string[] = [];
      try { favs = JSON.parse(localStorage.getItem('ledger_favourites') || '[]'); } catch {}
      setIsFav(favs.includes(key));
    } catch {}
  };

  useEffect(() => {
    readLocalPrefs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Mute, lock, timer and favourite follow the account to its other devices (lib/sync).
  useEffect(() => {
    const onSync = (e: Event) => {
      const d = (e as CustomEvent<DeviceSyncEventDetail>).detail;
      if (d?.source === 'remote' && d.keys.some((k) => k.endsWith(':' + key))) readLocalPrefs();
    };
    window.addEventListener(DEVICE_SYNC_EVENT, onSync);
    return () => window.removeEventListener(DEVICE_SYNC_EVENT, onSync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const syncFlag = (ns: 'muted' | 'locked' | 'fav', on: boolean) => {
    if (myAddress) setSynced(myAddress, { [`${ns}:${key}`]: on ? true : null });
  };

  const toggleMute = () => {
    if (controlled) {
      onToggleMute!();
      setToast(isMuted ? tr("Notifications unmuted") : tr("Notifications muted"));
      return;
    }
    const v = !mutedLocal;
    setMutedLocal(v);
    syncFlag('muted', v);
    try { if (v) localStorage.setItem('ledger_muted_' + key, '1'); else localStorage.removeItem('ledger_muted_' + key); } catch {}
    setToast(v ? tr("Notifications muted") : tr("Notifications unmuted"));
  };

  const toggleLock = () => {
    const v = !lockChat;
    setLockChat(v);
    syncFlag('locked', v);
    try { if (v) localStorage.setItem('ledger_locked_' + key, '1'); else localStorage.removeItem('ledger_locked_' + key); } catch {}
    setToast(v ? tr("Chat locked. Opening it asks for your PIN") : tr("Chat unlocked"));
  };

  const toggleFav = () => {
    syncFlag('fav', !isFav);
    let favs: string[] = [];
    try { favs = JSON.parse(localStorage.getItem('ledger_favourites') || '[]'); } catch {}
    try {
      if (isFav) localStorage.setItem('ledger_favourites', JSON.stringify(favs.filter((f) => f !== key)));
      else localStorage.setItem('ledger_favourites', JSON.stringify(Array.from(new Set([...favs, key]))));
    } catch {}
    setIsFav(!isFav);
    setToast(isFav ? tr("Removed from favorites") : tr("Added to favorites"));
  };

  const exportChat = () => {
    const lines = messages
      .filter((m: any) => typeof m.content === 'string' && (!m.content.startsWith('__') || m.content.startsWith('__BURN_')))
      .map((m: any) => {
        const t = new Date(typeof m.sentAtNs === 'number' ? m.sentAtNs : m.sent || m.sentAt || Date.now()).toLocaleString();
        const mine = m.isMe || (m.senderAddress || '').toLowerCase() === (myAddress || '').toLowerCase();
        return `[${t}] ${mine ? 'Me' : displayName}: ${String(m.content).replace(/^__BURN_\d+__::/, '')}`;
      });
    if (!lines.length) { setToast(tr("Nothing to export yet")); return; }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${key.slice(0, 8)}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setToast(tr("Chat exported as a text file"));
  };

  const copyAddress = () => {
    navigator.clipboard?.writeText(peerAddress).then(() => setToast(tr("Wallet address copied")), () => setToast(tr("Copy is not available here")));
  };

  const chooseTimer = (opt: 'off' | '24h' | '7d' | '90d') => {
    setDisappearing(opt);
    try { localStorage.setItem('ledger_disappearing_' + key, opt); } catch {}
    if (myAddress) setSynced(myAddress, { [`disappearing:${key}`]: opt === 'off' ? null : opt });
    setModal(null);
    setToast(opt === 'off' ? tr("Timer is off") : tr("Timer saved"));
  };

  const g = { variant } as const;

  return (
    <>
      <div className={compact ? 'flex flex-col gap-5' : 'flex flex-col'}>
        <Group title={tr("About")} {...g}>
          {profile?.bio && <p className="py-3 text-[14px] leading-relaxed text-[#344054] border-b border-[#eef0f3]">{profile.bio}</p>}
          <Row compact={compact} icon={<Copy {...ICON} />} label={tr("Wallet address")} sublabel={tr("Tap to copy")} value={shortAddr(peerAddress)} onTap={copyAddress} />
          <Row compact={compact} icon={<Star {...ICON} />} label={tr("Favorite contact")} toggle={isFav} onTap={toggleFav} />
        </Group>

        <Group title={tr("Media and files")} {...g}>
          <Row compact={compact} icon={<ImageIcon {...ICON} />} label={tr("Photos and files")} value={String(shared.files)} onTap={() => setModal('media')} />
          <Row compact={compact} icon={<Wallet {...ICON} />} label={tr("Payments")} value={String(shared.payments)} />
          <Row compact={compact} icon={<LinkIcon {...ICON} />} label={tr("Links")} value={String(shared.links)} />
        </Group>

        <Group title={tr("Personalization")} {...g}>
          <Row compact={compact} icon={<Palette {...ICON} />} label={tr("Chat wallpaper")} sublabel={tr("A background for this chat only")} onTap={() => setModal('wallpaper')} />
        </Group>

        <Group title={tr("Privacy")} footer={tr("Mute, timer and lock apply on every device signed in to this account.")} {...g}>
          <Row compact={compact} icon={<Bell {...ICON} />} label={tr("Mute notifications")} toggle={isMuted} onTap={toggleMute} />
          <Row compact={compact} icon={<Clock {...ICON} />} label={tr("Disappearing messages")} value={tr(TIMER_LABEL[disappearing])} onTap={() => setModal('disappearing')} />
          <Row compact={compact} icon={<Lock {...ICON} />} label={tr("Lock chat with PIN")} toggle={lockChat} onTap={toggleLock} />
          <Row compact={compact} icon={<KeyRound {...ICON} />} label={tr("Verify encryption")} sublabel={wasVerified(peerAddress) ? tr("Verified on this device. Check the safety number again") : tr("Compare your safety number with them")} onTap={() => setModal('encryption')} />
        </Group>

        <Group title={tr("Actions")} {...g}>
          <Row compact={compact} icon={<Download {...ICON} />} label={tr("Export chat")} sublabel={tr("Save the messages on this device as text")} onTap={exportChat} />
          {onClearChat && <Row compact={compact} icon={<Trash2 {...ICON} />} label={tr("Clear chat")} danger onTap={onClearChat} />}
          <Row compact={compact} icon={<Ban {...ICON} />} label={tr("Block contact")} danger onTap={onBlock} />
        </Group>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#15171c] lg-ink text-white px-5 h-11 rounded-full flex items-center gap-2.5 z-[250003]"
          >
            <Check size={16} strokeWidth={1.75} aria-hidden="true" />
            <span className="text-[14px] font-medium">{toast}</span>
          </motion.div>
        )}

        {modal === 'disappearing' && (
          <Modal title={tr("Disappearing messages")} onClose={() => setModal(null)}>
            <div className="flex flex-col gap-2.5">
              <p className="text-[13px] text-[#727a88] mb-1 leading-relaxed">
                {tr("New messages in this chat disappear for both of you after the time you choose. Messages already sent are not affected.")}
              </p>
              {(['off', '24h', '7d', '90d'] as const).map((opt) => (
                <button
                  type="button"
                  key={opt}
                  onClick={() => chooseTimer(opt)}
                  aria-pressed={disappearing === opt}
                  className="flex items-center justify-between min-h-[52px] px-4 rounded-xl lg-card hover:border-[#15171c] transition-colors"
                >
                  <span className="text-[15px] font-semibold text-[#15171c]">{tr(TIMER_LABEL[opt])}</span>
                  <span className={`icon-btn w-5 h-5 rounded-full border-2 flex items-center justify-center ${disappearing === opt ? 'border-[#15171c]' : 'border-[#d0d5dd]'}`}>
                    {disappearing === opt && <span className="w-2.5 h-2.5 bg-[#15171c] rounded-full" />}
                  </span>
                </button>
              ))}
            </div>
          </Modal>
        )}

        {modal === 'media' && (
          <Modal title={tr("Photos and files")} onClose={() => setModal(null)}>
            <div className="flex flex-col items-center text-center gap-3 py-6">
              <span className="w-14 h-14 lg-pill text-[#475467] rounded-full flex items-center justify-center">
                <ImageIcon size={26} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <p className="text-[14px] text-[#15171c] font-medium">{shared.files ? tr("{files} shared in this chat", { files: shared.files }) : tr("Nothing shared yet")}</p>
              <p className="text-[13px] text-[#727a88] leading-relaxed">{tr("Photos, files and GIFs in the messages loaded on this device.")}</p>
            </div>
          </Modal>
        )}

        {modal === 'wallpaper' && (
          <Modal title={tr("Chat wallpaper")} onClose={() => setModal(null)}>
            <p className="text-[13px] text-[#727a88] mb-3 leading-relaxed">{tr("Choose a background for your chat with {displayName}.", { displayName })}</p>
            <div className="grid grid-cols-3 gap-2.5 max-h-[340px] overflow-y-auto pr-1">
              {WALLPAPER_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => {
                    try {
                      const stored = JSON.parse(localStorage.getItem('ledger_conv_wallpapers') || '{}');
                      stored[key] = opt.background;
                      localStorage.setItem('ledger_conv_wallpapers', JSON.stringify(stored));
                      window.dispatchEvent(new CustomEvent('ledger_wallpaper_changed', { detail: { peer: key, bg: opt.background } }));
                    } catch {}
                    setModal(null);
                    setToast(tr("Wallpaper updated for {displayName}", { displayName }));
                  }}
                  className="rounded-xl overflow-hidden border border-[#e4e7ec] hover:border-[#15171c] transition-colors text-left"
                >
                  <div className="w-full h-14" style={opt.preview} />
                  <div className="bg-white px-1.5 py-1 text-center">
                    <span className="text-[11px] font-medium text-[#15171c] truncate block">{tr(opt.label)}</span>
                  </div>
                </button>
              ))}
            </div>
          </Modal>
        )}
      </AnimatePresence>
      <EncryptionInfoSheet
        open={modal === 'encryption'}
        onClose={() => setModal(null)}
        peerName={displayName}
        myAddress={myAddress}
        peerAddress={peerAddress}
        serverCount={messages.filter((m: any) => m.viaServer).length}
        client={client}
      />
    </>
  );
}

// ─── Drawer ──────────────────────────────────────────────────────────────────

interface ContactInfoPanelProps {
  peerAddress: string;
  peerName: string;
  myAddress: string;
  messages?: any[];
  onClose: () => void;
  onVoiceCall: () => void;
  onVideoCall: () => void;
  onSearch: () => void;
  onBlock: () => void;
  onClearChat?: () => void;
  onAddToGroup?: () => void;
  groups?: Array<{ id: string; name: string }>;
  isMuted?: boolean;
  onToggleMute?: () => void;
  client?: any;
}

export const ContactInfoPanel: React.FC<ContactInfoPanelProps> = ({
  peerAddress, peerName, myAddress, messages = [], onClose, onVoiceCall, onVideoCall, onSearch, onBlock, onClearChat, isMuted, onToggleMute, client,
}) => {
  const tr = useT();
  const profile = usePeerProfile(peerAddress);
  const displayName = profile?.displayName || peerName || shortAddr(peerAddress);
  // Phones and screens under 1024 px: the panel covers the whole screen, edge to edge.
  const compact = useCompactLayout();
  const quick = [
    { label: tr("Audio"), icon: <Phone size={20} strokeWidth={1.75} aria-hidden="true" />, onClick: onVoiceCall },
    { label: tr("Video"), icon: <Video size={20} strokeWidth={1.75} aria-hidden="true" />, onClick: onVideoCall },
    { label: tr("Search"), icon: <Search size={20} strokeWidth={1.75} aria-hidden="true" />, onClick: onSearch },
  ];

  return (
    <BodyPortal>
      <motion.div key="contact-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onClick={onClose} className={`fixed inset-0 z-[250000] ${compact ? 'bg-white' : 'lg-scrim'}`} aria-hidden="true" />
      <motion.aside
        role="dialog"
        aria-label={tr("Contact info")}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
        data-hl-side-panel={compact ? '' : undefined}
        style={compact ? { height: '100dvh' } : undefined}
        className={compact
          ? 'lg-canvas fixed inset-0 z-[250001] w-full max-w-none flex flex-col'
          : 'lg-canvas lg-drawer fixed inset-y-0 right-0 z-[250001] w-[400px] max-w-[100vw] flex flex-col'}
      >
        <div className="lg-bar sticky top-0 z-10 min-h-[60px] pt-[max(8px,env(safe-area-inset-top))] pb-1 flex items-center gap-2 px-2 shrink-0">
          <button type="button" onClick={onClose} aria-label={tr("Close")} className="w-11 h-11 min-w-[44px] flex items-center justify-center rounded-full text-[#15171c] hover:bg-black/[0.05] active:scale-95 transition">
            <X size={22} strokeWidth={1.75} />
          </button>
          <h2 className="text-[16px] font-semibold text-[#15171c]">{tr("Contact info")}</h2>
        </div>

        <div data-hl-scroll className="flex-1 overflow-y-auto overscroll-contain pb-[max(28px,env(safe-area-inset-bottom))]">
          <div className="pt-7 pb-6 px-4 flex flex-col items-center mb-2">
            <div className="mb-4 flex items-center justify-center leading-none"><UserAvatar address={peerAddress} photo={profile?.avatarUrl} size={112} /></div>
            <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-[#15171c] text-center">{displayName}</h1>
            {displayName !== shortAddr(peerAddress) && <p className="text-[14px] text-[#727a88] font-mono tabular-nums mt-1">{shortAddr(peerAddress)}</p>}
            <div className="mt-5 grid grid-cols-3 gap-2 w-full max-w-[300px]">
              {quick.map((q) => (
                <button key={q.label} type="button" onClick={q.onClick} className="lg-tile h-[68px] rounded-2xl text-[#15171c] flex flex-col items-center justify-center gap-1.5 active:scale-[0.97] transition">
                  {q.icon}
                  <span className="text-[12.5px] font-semibold leading-none">{tr(q.label)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="px-4 pb-6">
            <ContactInfoSections
              variant="drawer"
              peerAddress={peerAddress}
              displayName={displayName}
              myAddress={myAddress}
              messages={messages}
              onBlock={onBlock}
              onClearChat={onClearChat}
              isMuted={isMuted}
              onToggleMute={onToggleMute}
              client={client}
            />
          </div>
        </div>
      </motion.aside>
    </BodyPortal>
  );
};
