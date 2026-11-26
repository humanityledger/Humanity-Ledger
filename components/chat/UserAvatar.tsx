'use client';
/**
 * The one avatar of Ledger Chat, used everywhere a person is shown.
 *
 *   1. a photo passed in (a profile already loaded by the caller), else
 *   2. your own photo, on your own address (Settings → Profile; `ledger_avatar`), else
 *   3. the contact's photo from the shared profile cache (lib/chat/peerProfiles.ts), else
 *   4. the 10 × 10 mosaic of the address (WalletGlyph): the same for the same person on every
 *      screen and every device, and the design of the human presence check on /connect.
 *
 * Changing or removing your photo updates every avatar of yours at once (`ledger_settings_update`).
 * Anything that is not a wallet address (a community, a group) keeps its own picture elsewhere.
 */
import React, { useEffect, useState } from 'react';
import { WalletGlyph } from '@/components/chat/WalletGlyph';
import { getPeerProfile, requestPeerProfile, subscribePeerProfile } from '@/lib/chat/peerProfiles';

export const isWalletAddress = (a?: string | null): a is string => !!a && /^0x[0-9a-f]{40}$/i.test(a.trim());
const HEX_ID = /^(0x)?[0-9a-f]{16,}$/i;

/** The wallet this browser is signed in with (set at sign-in), lower case, or ''. */
export function selfAddress(): string {
  if (typeof window === 'undefined') return '';
  try { return (sessionStorage.getItem('system_wallet_addr') || localStorage.getItem('system_wallet_addr') || '').toLowerCase(); } catch { return ''; }
}

function readOwnPhoto(): string {
  try { return localStorage.getItem('ledger_avatar') || ''; } catch { return ''; }
}

export function UserAvatar({ address, photo, size = 44, isMe, className = '', title }: {
  address?: string | null;
  photo?: string | null;
  size?: number;
  /** Force "this is me" (otherwise: the address equals the signed-in wallet). */
  isMe?: boolean;
  className?: string;
  title?: string;
}) {
  const addr = (address || '').trim();
  const me = isMe ?? (!!addr && addr.toLowerCase() === selfAddress());
  const [own, setOwn] = useState<string>(() => (me && typeof window !== 'undefined' ? readOwnPhoto() : ''));
  const [peer, setPeer] = useState<string>(() => (!me && isWalletAddress(addr) && typeof window !== 'undefined' ? getPeerProfile(addr)?.avatarUrl || '' : ''));

  useEffect(() => {
    if (!me) return;
    setOwn(readOwnPhoto());
    const onUpdate = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d && d.avatarUrl !== undefined) setOwn(String(d.avatarUrl || ''));
    };
    const onStorage = (e: StorageEvent) => { if (e.key === 'ledger_avatar') setOwn(e.newValue || ''); };
    window.addEventListener('ledger_settings_update', onUpdate);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('ledger_settings_update', onUpdate); window.removeEventListener('storage', onStorage); };
  }, [me]);

  useEffect(() => {
    if (me || !isWalletAddress(addr)) return;
    const sync = () => setPeer(getPeerProfile(addr)?.avatarUrl || '');
    sync();
    const off = subscribePeerProfile(addr, sync);
    requestPeerProfile(addr);
    return off;
  }, [addr, me]);

  const src = photo || (me ? own : peer);
  if (src) {
    return (
      <span className={`inline-block rounded-full overflow-hidden shrink-0 ring-1 ring-black/5 ${className}`} style={{ width: size, height: size }} title={title}>
        <img src={src} alt="" className="w-full h-full object-cover" />
      </span>
    );
  }
  return (
    <span className={`inline-block shrink-0 ${className}`} style={{ width: size, height: size, lineHeight: 0 }} title={title} aria-hidden="true">
      <WalletGlyph address={isWalletAddress(addr) || HEX_ID.test(addr) ? addr : ''} size={size} />
    </span>
  );
}

export default UserAvatar;
