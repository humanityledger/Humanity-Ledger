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
 * Both photos and the 10 × 10 mosaic share the exact same rounded-square geometry
 * (`AVATAR_RADIUS = 29.17%`, matching `rx="7"` on a `24 × 24` viewBox) so every avatar
 * fills its rounded frame edge-to-edge without gaps or shape mismatches.
 *
 * Changing or removing your photo updates every avatar of yours at once (`ledger_settings_update`).
 * Anything that is not a wallet address (a community, a group) keeps its own picture elsewhere.
 */
import React, { useEffect, useState } from 'react';
import { WalletGlyph } from '@/components/chat/WalletGlyph';
import { getPeerProfile, requestPeerProfile, subscribePeerProfile } from '@/lib/chat/peerProfiles';

export const AVATAR_RADIUS = '29.17%';
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
  const [failedSrc, setFailedSrc] = useState<string>('');

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

  const rawSrc = photo || (me ? own : peer);
  const src = rawSrc && failedSrc !== rawSrc ? rawSrc : '';

  if (src) {
    return (
      <span
        className={`relative inline-block overflow-hidden shrink-0 lg-recessed ${className}`}
        style={{ width: size, height: size, borderRadius: AVATAR_RADIUS, lineHeight: 0 }}
        title={title}
      >
        <img
          src={src}
          alt=""
          className="block w-full h-full object-cover object-center"
          draggable={false}
          onError={() => setFailedSrc(rawSrc)}
        />
        <span
          className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/[0.09]"
          style={{ borderRadius: 'inherit' }}
          aria-hidden="true"
        />
      </span>
    );
  }
  return (
    <span
      className={`inline-block overflow-hidden shrink-0 ${className}`}
      style={{ width: size, height: size, borderRadius: AVATAR_RADIUS, lineHeight: 0 }}
      title={title}
      aria-hidden="true"
    >
      <WalletGlyph address={isWalletAddress(addr) || HEX_ID.test(addr) ? addr : ''} size={size} />
    </span>
  );
}

export default UserAvatar;
