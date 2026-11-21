'use client';

/**
 * components/chat/profile/ProfileShare.tsx — profile, username and the personal QR code, laid
 * out like Signal's Settings → Profile and Share screens, in the Ledger Chat design.
 *
 *   ProfileHeaderCard   the card at the top of Settings: photo, name, @username, QR button
 *   ProfilePanel        Settings → Profile: name, username (copy, change, delete), QR code or link
 *   UsernameEditor      choose or change the username; a name someone else holds cannot be saved
 *   ProfileSharePanel   the QR code on a coloured card, Save as image, Color, the link, Reset
 *
 * Usernames and links: lib/chat/usernames.ts, /api/chat/username. The QR code encodes the
 * profile link (a random token), never the wallet address or the username.
 */
import React, { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { BrandedQr, loadQrLogo } from './BrandedQr';
import { drawBrandedQr } from '@/lib/chat/brandedQr';
import { AtSign, Check, ChevronRight, Copy, Download, LoaderCircle, MoreHorizontal, Palette, Pencil, QrCode, Trash2, User } from 'lucide-react';
import { PeerAvatar } from '@/components/chat/ui/kit';
import { QR_COLORS, USERNAME_MAX, USERNAME_PROBLEM_TEXT, canonicalUsername, qrColor, usernameProblem, type QrColorId } from '@/lib/chat/usernames';
import { UsernameError, useUsername, usernameAvailable } from '@/lib/chat/useUsername';

const INK = '#15171C';
const INK_2 = '#5B606B';
const INK_3 = '#727A88';
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2754D6]';

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  } catch {
    toast.error('Could not copy. Select the text and copy it instead.');
  }
}

const shortAddr = (a: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');

// ─── Settings header card ───────────────────────────────────────────────────

export function ProfileHeaderCard({ address, name, photo, onOpenProfile, onOpenShare }: {
  address: string;
  name: string;
  photo?: string | null;
  onOpenProfile: () => void;
  onOpenShare: () => void;
}) {
  const { username, loaded } = useUsername(!!address);
  return (
    <div className="bg-white rounded-2xl border border-[#e6e8ec] flex items-center gap-3 pl-3 pr-2.5 py-3">
      <button type="button" onClick={onOpenProfile} className={`flex-1 min-w-0 flex items-center gap-3.5 text-left rounded-xl ${FOCUS}`} aria-label="Open your profile">
        <PeerAvatar address={address} name={name} photo={photo} size={56} />
        <span className="min-w-0">
          <span className="block text-[17px] font-semibold tracking-[-0.01em] truncate" style={{ color: INK }}>{name}</span>
          <span className="block text-[13.5px] truncate" style={{ color: INK_2 }}>
            {!loaded ? ' ' : username ? `@${username}` : 'Choose a username'}
          </span>
          <span className="block text-[12.5px] tabular-nums" style={{ color: INK_3 }}>{shortAddr(address)}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={onOpenShare}
        aria-label="Your QR code and link"
        className={`w-11 h-11 shrink-0 rounded-full bg-[#f2f4f7] hover:bg-[#e9ecf1] grid place-items-center ${FOCUS}`}
      >
        <QrCode size={19} strokeWidth={1.9} style={{ color: INK }} aria-hidden="true" />
      </button>
    </div>
  );
}

// ─── Profile panel ──────────────────────────────────────────────────────────

function Group({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div>
      <div className="bg-white rounded-2xl border border-[#e6e8ec] overflow-hidden">{children}</div>
      {footer && <p className="text-[12.5px] leading-relaxed px-1.5 mt-2" style={{ color: INK_3 }}>{footer}</p>}
    </div>
  );
}

function Row({ icon, children, onClick, trailing, label }: { icon: React.ReactNode; children: React.ReactNode; onClick?: () => void; trailing?: React.ReactNode; label?: string }) {
  const body = (
    <>
      <span className="w-6 grid place-items-center shrink-0" aria-hidden="true">{icon}</span>
      <span className="flex-1 min-w-0 text-[15px] truncate" style={{ color: INK }}>{children}</span>
      {trailing}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} aria-label={label} className={`w-full min-h-[52px] flex items-center gap-3.5 px-4 text-left hover:bg-[#f7f8fa] border-t border-[#f0f1f4] first:border-t-0 ${FOCUS}`}>
      {body}
    </button>
  ) : (
    <div className="w-full min-h-[52px] flex items-center gap-3.5 px-4 border-t border-[#f0f1f4] first:border-t-0">{body}</div>
  );
}

export function ProfilePanel({ address, name, photo, onEditName, onEditUsername, onOpenShare, header, children }: {
  address: string;
  name: string;
  photo?: string | null;
  onEditName?: () => void;
  onEditUsername: () => void;
  onOpenShare: () => void;
  /** Replaces the read-only avatar at the top (Settings passes its editable profile card). */
  header?: React.ReactNode;
  /** More groups after the username, in the same page (devices, visibility, data, session). */
  children?: React.ReactNode;
}) {
  const u = useUsername(!!address);
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menu]);

  return (
    <div className="space-y-5">
      {header ?? (
        <div className="flex flex-col items-center pt-2">
          <PeerAvatar address={address} name={name} photo={photo} size={88} />
          {onEditName && (
            <button type="button" onClick={onEditName} className={`mt-3 h-8 px-3.5 rounded-full bg-[#eef0f3] hover:bg-[#e4e7ec] text-[13px] font-semibold ${FOCUS}`} style={{ color: INK }}>
              Edit name and photo
            </button>
          )}
        </div>
      )}

      {header ? (
        // The editable card already shows the name and the address: only the note stays.
        <p className="text-[12.5px] leading-relaxed px-1.5 -mt-2" style={{ color: INK_3 }}>
          Your name and photo are visible to the people you message, your contacts and your groups.
        </p>
      ) : (
        <Group footer="Your name and photo are visible to the people you message, your contacts and your groups.">
          <Row icon={<User size={18} strokeWidth={1.8} style={{ color: INK }} />} onClick={onEditName} label={onEditName ? 'Edit your name' : undefined}>
            {name}
          </Row>
          <Row icon={<span className="text-[12px] font-semibold" style={{ color: INK_3 }}>0x</span>} trailing={<button type="button" onClick={() => copy(address, 'Wallet address')} aria-label="Copy wallet address" className={`w-9 h-9 grid place-items-center rounded-full hover:bg-[#f2f4f7] ${FOCUS}`}><Copy size={15} strokeWidth={1.8} style={{ color: INK_2 }} /></button>}>
            <span className="tabular-nums">{shortAddr(address)}</span>
          </Row>
        </Group>
      )}

      <Group footer="Your username, QR code and link are not shown on your profile. Share them only with people you trust: anyone who has one can start a chat with you.">
        {!u.loaded ? (
          <Row icon={<LoaderCircle size={17} className="animate-spin motion-reduce:animate-none" style={{ color: INK_3 }} />}>
            <span style={{ color: INK_3 }}>Loading</span>
          </Row>
        ) : u.error && !u.username ? (
          <Row icon={<AtSign size={18} strokeWidth={1.8} style={{ color: INK }} />} trailing={<RetryButton onRetry={u.reload} />}>
            <span className="text-[14px] leading-snug" style={{ color: '#B42318' }} role="alert">{u.error}</span>
          </Row>
        ) : u.username ? (
          <div className="relative" ref={menuRef}>
            {confirmDelete ? (
              <div className="px-4 py-3 flex items-center gap-3" role="group" aria-label="Delete your username?">
                <span className="flex-1 text-[14px] leading-snug" style={{ color: INK }}>
                  Delete <span className="font-semibold">@{u.username}</span>? Your link and QR code stop working, and someone else can take the name.
                </span>
                <button type="button" onClick={() => setConfirmDelete(false)} className={`h-9 px-3 rounded-full text-[14px] font-semibold hover:bg-[#f2f4f7] ${FOCUS}`} style={{ color: INK }}>Cancel</button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await u.remove();
                      toast.success('Username deleted');
                    } catch (e) {
                      toast.error((e as Error).message);
                    } finally {
                      setBusy(false);
                      setConfirmDelete(false);
                    }
                  }}
                  className={`h-9 px-3 rounded-full text-[14px] font-semibold text-white bg-[#b42318] hover:bg-[#962018] disabled:opacity-40 ${FOCUS}`}
                >
                  Delete
                </button>
              </div>
            ) : (
              <Row
                icon={<AtSign size={18} strokeWidth={1.8} style={{ color: INK }} />}
                trailing={
                  <span className="flex items-center gap-1 shrink-0">
                    {/* Changing the username is one tap, in plain sight (18 November 2026: it was
                        only inside the ⋯ menu and people could not find it). */}
                    <button type="button" onClick={onEditUsername} className={`h-9 px-3.5 rounded-full bg-[#eef0f3] hover:bg-[#e4e7ec] text-[13.5px] font-semibold ${FOCUS}`} style={{ color: INK }} data-testid="change-username">
                      Change
                    </button>
                    <button type="button" onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu} aria-label="Username options" className={`w-9 h-9 grid place-items-center rounded-full hover:bg-[#f2f4f7] ${FOCUS}`}>
                      <MoreHorizontal size={18} strokeWidth={1.9} style={{ color: INK }} />
                    </button>
                  </span>
                }
              >
                @{u.username}
              </Row>
            )}
            {menu && (
              <div role="menu" aria-label="Username options" className="absolute right-3 top-[46px] z-20 w-[220px] bg-white rounded-2xl border border-[#e4e7ec] shadow-[0_16px_48px_-8px_rgba(16,24,40,0.28)] p-1.5">
                <MenuItem icon={<Copy size={16} strokeWidth={1.8} />} onClick={() => { setMenu(false); void copy(`@${u.username}`, 'Username'); }}>Copy username</MenuItem>
                <MenuItem icon={<Pencil size={16} strokeWidth={1.8} />} onClick={() => { setMenu(false); onEditUsername(); }}>Change username</MenuItem>
                <MenuItem icon={<Trash2 size={16} strokeWidth={1.8} />} danger onClick={() => { setMenu(false); setConfirmDelete(true); }}>Delete username</MenuItem>
              </div>
            )}
          </div>
        ) : (
          <Row icon={<AtSign size={18} strokeWidth={1.8} style={{ color: INK }} />} onClick={onEditUsername} trailing={<ChevronRight size={16} className="text-[#c9ced6]" />}>
            Choose a username
          </Row>
        )}
        <Row icon={<QrCode size={18} strokeWidth={1.8} style={{ color: INK }} />} onClick={onOpenShare} trailing={<ChevronRight size={16} className="text-[#c9ced6]" />}>
          QR code or link
        </Row>
      </Group>
      {children}
    </div>
  );
}

function RetryButton({ onRetry }: { onRetry: () => Promise<void> | void }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onRetry();
        } finally {
          setBusy(false);
        }
      }}
      className={`h-9 px-3.5 rounded-full bg-[#eef0f3] hover:bg-[#e4e7ec] text-[13.5px] font-semibold shrink-0 disabled:opacity-50 ${FOCUS}`}
      style={{ color: INK }}
    >
      {busy ? 'Trying…' : 'Try again'}
    </button>
  );
}

function MenuItem({ icon, children, onClick, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 h-10 rounded-xl text-[14.5px] text-left ${danger ? 'text-[#b42318] hover:bg-[#fff1f0]' : 'text-[#15171c] hover:bg-[#f2f4f7]'} ${FOCUS}`}
    >
      {icon}
      {children}
    </button>
  );
}

// ─── Username editor ────────────────────────────────────────────────────────

export function UsernameEditor({ onDone }: { onDone: () => void }) {
  const u = useUsername(true);
  const inputId = useId();
  const [value, setValue] = useState(u.username ?? '');
  const [touched, setTouched] = useState(false);
  const [availability, setAvailability] = useState<'idle' | 'checking' | 'free' | 'taken' | 'unknown'>('idle');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (u.loaded && !touched && u.username) setValue(u.username);
  }, [u.loaded, u.username, touched]);

  const canonical = canonicalUsername(value);
  const problem = usernameProblem(value);
  const unchanged = !!u.username && canonical === u.username;

  useEffect(() => {
    setServerError(null);
    if (problem || unchanged) {
      setAvailability('idle');
      return;
    }
    setAvailability('checking');
    let live = true;
    const t = setTimeout(async () => {
      const free = await usernameAvailable(canonical, u.username);
      if (live) setAvailability(free === null ? 'unknown' : free ? 'free' : 'taken');
    }, 450);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [canonical, problem, unchanged, u.username]);

  const save = async () => {
    setTouched(true);
    if (problem || unchanged) return;
    setBusy(true);
    try {
      await u.save(canonical);
      toast.success(`Your username is @${canonical}`);
      onDone();
    } catch (e) {
      const err = e as UsernameError;
      setServerError(err.message);
      if (err.problem === 'taken') {
        setAvailability('taken');
        setSuggestions(err.suggestions);
      }
    } finally {
      setBusy(false);
    }
  };

  const status =
    touched && problem
      ? { tone: 'bad', text: USERNAME_PROBLEM_TEXT[problem] }
      : serverError
        ? { tone: 'bad', text: serverError }
        : availability === 'taken'
          ? { tone: 'bad', text: `@${canonical} is taken. Usernames are unique: choose another one.` }
          : availability === 'free'
            ? { tone: 'ok', text: `@${canonical} is available.` }
            : availability === 'checking'
              ? { tone: 'quiet', text: 'Checking…' }
              : availability === 'unknown'
                ? { tone: 'quiet', text: 'Could not check right now. Saving will tell you.' }
                : null;

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={inputId} className="block text-[13px] font-medium px-1 mb-1.5" style={{ color: INK_3 }}>Username</label>
        <div className={`flex items-center h-14 px-4 rounded-2xl bg-white border-2 ${status?.tone === 'bad' ? 'border-[#d92d20]' : status?.tone === 'ok' ? 'border-[#0a7a55]' : 'border-[#e4e7ec] focus-within:border-[#15171c]'}`}>
          <span className="text-[17px] font-semibold mr-0.5" style={{ color: INK_3 }} aria-hidden="true">@</span>
          <input
            id={inputId}
            value={value}
            onChange={(e) => {
              setValue(e.target.value.replace(/\s/g, '').slice(0, USERNAME_MAX + 1));
              setSuggestions([]);
            }}
            onBlur={() => setTouched(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save();
            }}
            placeholder="name"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={USERNAME_MAX + 1}
            aria-describedby={`${inputId}-status ${inputId}-help`}
            aria-invalid={status?.tone === 'bad' || undefined}
            className="flex-1 min-w-0 bg-transparent text-[17px] font-medium focus:outline-none"
            style={{ color: INK }}
          />
          {availability === 'checking' && <LoaderCircle size={17} className="animate-spin motion-reduce:animate-none" style={{ color: INK_3 }} aria-hidden="true" />}
          {availability === 'free' && !problem && <Check size={18} strokeWidth={2.2} style={{ color: '#0a7a55' }} aria-hidden="true" />}
        </div>
        <p id={`${inputId}-status`} role="status" aria-live="polite" className="min-h-[20px] mt-1.5 px-1 text-[13px]" style={{ color: status?.tone === 'bad' ? '#b42318' : status?.tone === 'ok' ? '#0a7a55' : INK_3 }}>
          {status?.text ?? ''}
        </p>
        {suggestions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2 px-1" aria-label="Free usernames">
            {suggestions.map((s) => (
              <button key={s} type="button" onClick={() => { setValue(s); setSuggestions([]); setTouched(true); }} className={`h-9 px-3.5 rounded-full bg-white border border-[#e4e7ec] hover:bg-[#f7f8fa] text-[14px] font-medium ${FOCUS}`} style={{ color: INK }}>
                @{s}
              </button>
            ))}
          </div>
        )}
      </div>

      <ul id={`${inputId}-help`} className="space-y-1.5 px-1 text-[13px] leading-snug" style={{ color: INK_2 }}>
        <li>Unique in the world: nobody else can save the same username.</li>
        <li>Letters a to z, numbers and &quot;_&quot;, starting with a letter. You can end it with a dot and numbers, like name.01.</li>
        <li>People find you by your exact username. Nobody can search for it by its first letters.</li>
      </ul>

      <div className="grid grid-cols-[auto_1fr] gap-2">
        <button type="button" onClick={onDone} disabled={busy} className={`min-h-[52px] px-5 rounded-2xl border border-[#e4e7ec] bg-white hover:bg-[#f2f4f7] text-[16px] font-semibold disabled:opacity-40 ${FOCUS}`} style={{ color: INK }}>
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !!problem || unchanged || availability === 'taken' || availability === 'checking'}
          className={`min-h-[52px] rounded-2xl bg-[#15171c] hover:bg-[#262932] text-white text-[16px] font-semibold disabled:bg-[#e4e7ec] disabled:text-[#5b606b] ${FOCUS}`}
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ─── Share: QR code and link ────────────────────────────────────────────────

const colorKey = (a: string) => `hl.qr.color.${a.toLowerCase()}`;

/** The coloured card as a PNG, drawn on a canvas: the same layout as on screen. */
async function qrCardPng(link: string, handle: string, colorId: QrColorId): Promise<Blob> {
  const logo = await loadQrLogo();
  const c = qrColor(colorId);
  const W = 1080, H = 1260, pad = 120, qrBox = W - pad * 2;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const round = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  ctx.fillStyle = c.card;
  round(0, 0, W, H, 72);
  ctx.fill();
  drawBrandedQr(ctx, link, pad, pad, qrBox, logo, 48);
  ctx.fillStyle = c.text;
  ctx.font = '600 56px Inter, "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`@${handle}`, W / 2, pad + qrBox + 116);
  ctx.font = '500 34px Inter, "Segoe UI", system-ui, sans-serif';
  ctx.globalAlpha = 0.78;
  ctx.fillText('Ledger Chat', W / 2, pad + qrBox + 172);
  ctx.globalAlpha = 1;
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'));
}

export function ProfileSharePanel({ address, onEditUsername }: { address: string; onEditUsername: () => void }) {
  const u = useUsername(!!address);
  const [colorId, setColorId] = useState<QrColorId>('ink');
  const [colorOpen, setColorOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    try {
      const v = localStorage.getItem(colorKey(address));
      if (v && QR_COLORS.some((c) => c.id === v)) setColorId(v as QrColorId);
    } catch {
      /* default colour */
    }
  }, [address]);
  const pick = (id: QrColorId) => {
    setColorId(id);
    setColorOpen(false);
    try {
      localStorage.setItem(colorKey(address), id);
    } catch {
      /* this session only */
    }
  };
  const c = qrColor(colorId);

  if (!u.loaded) {
    return <div className="h-[420px] rounded-3xl bg-white border border-[#e6e8ec] animate-pulse motion-reduce:animate-none" aria-busy="true" aria-label="Loading your QR code" />;
  }
  if (u.error && !u.username) {
    return (
      <div className="bg-white rounded-2xl border border-[#e6e8ec] p-6 text-center" role="alert">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-[#fff1f0] grid place-items-center">
          <QrCode size={24} strokeWidth={1.8} style={{ color: '#B42318' }} aria-hidden="true" />
        </div>
        <p className="mt-4 text-[17px] font-semibold" style={{ color: INK }}>Your QR code could not load</p>
        <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: INK_2 }}>{u.error}</p>
        <div className="mt-5 flex justify-center">
          <RetryButton onRetry={u.reload} />
        </div>
      </div>
    );
  }
  if (!u.username || !u.link) {
    return (
      <div className="bg-white rounded-2xl border border-[#e6e8ec] p-6 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-[#f2f4f7] grid place-items-center">
          <QrCode size={24} strokeWidth={1.8} style={{ color: INK }} aria-hidden="true" />
        </div>
        <p className="mt-4 text-[17px] font-semibold" style={{ color: INK }}>Choose a username first</p>
        <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: INK_2 }}>
          Your QR code and link open a chat with you without showing your wallet address. They need a username.
        </p>
        <button type="button" onClick={onEditUsername} className={`mt-5 min-h-[48px] px-6 rounded-2xl bg-[#15171c] hover:bg-[#262932] text-white text-[15px] font-semibold ${FOCUS}`}>
          Choose a username
        </button>
      </div>
    );
  }

  const link = u.link;
  const handle = u.username;

  return (
    <div className="flex flex-col items-center">
      <div className="w-[248px] rounded-[28px] p-5 pb-4 shadow-[0_18px_40px_-20px_rgba(16,24,40,0.45)]" style={{ background: c.card }}>
        <div className="bg-white rounded-[20px] overflow-hidden">
          <BrandedQr value={link} title={`QR code for @${handle}`} />
        </div>
        <button
          type="button"
          onClick={() => copy(`@${handle}`, 'Username')}
          className={`mt-3.5 mx-auto flex items-center justify-center gap-1.5 max-w-full rounded-lg px-1 ${FOCUS}`}
          style={{ color: c.text }}
          aria-label={`Copy username @${handle}`}
        >
          <Copy size={15} strokeWidth={2} aria-hidden="true" />
          <span className="text-[17px] font-semibold truncate">@{handle}</span>
        </button>
      </div>

      <div className="mt-4 flex gap-2.5">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const blob = await qrCardPng(link, handle, colorId);
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `ledger-chat-${handle}.png`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 2000);
            } catch {
              toast.error('Could not save the image. Try again.');
            } finally {
              setBusy(false);
            }
          }}
          className={`w-[76px] h-[60px] rounded-2xl bg-white border border-[#e6e8ec] hover:bg-[#f7f8fa] flex flex-col items-center justify-center gap-1 text-[12.5px] font-medium disabled:opacity-50 ${FOCUS}`}
          style={{ color: INK }}
        >
          <Download size={17} strokeWidth={1.9} aria-hidden="true" />
          Save
        </button>
        <button
          type="button"
          onClick={() => setColorOpen((o) => !o)}
          aria-haspopup="true"
          aria-expanded={colorOpen}
          className={`w-[76px] h-[60px] rounded-2xl bg-white border ${colorOpen ? 'border-[#15171c] bg-[#f7f8fa]' : 'border-[#e6e8ec] hover:bg-[#f7f8fa]'} flex flex-col items-center justify-center gap-1 text-[12.5px] font-medium transition-colors ${FOCUS}`}
          style={{ color: INK }}
        >
          <Palette size={17} strokeWidth={1.9} aria-hidden="true" />
          Color
        </button>
      </div>

      {colorOpen && (
        <div role="radiogroup" aria-label="QR code colour" className="mt-3 w-full max-w-[280px] bg-white rounded-2xl border border-[#e4e7ec] shadow-[0_4px_20px_-4px_rgba(16,24,40,0.12)] p-3 grid grid-cols-4 gap-2.5 transition-all">
          {QR_COLORS.map((k) => (
            <button
              key={k.id}
              type="button"
              role="radio"
              aria-checked={k.id === colorId}
              aria-label={k.name}
              title={k.name}
              onClick={() => pick(k.id)}
              className={`w-10 h-10 rounded-full mx-auto grid place-items-center ring-offset-2 ${k.id === colorId ? 'ring-2 ring-[#15171c]' : 'ring-1 ring-black/10 hover:scale-105'} transition-all ${FOCUS}`}
              style={{ background: k.card }}
            >
              {k.id === colorId && <Check size={16} strokeWidth={2.4} style={{ color: k.text }} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => copy(link, 'Link')}
        className={`mt-5 w-full flex items-start gap-3 text-left bg-white rounded-2xl border border-[#e6e8ec] hover:bg-[#f7f8fa] px-4 py-3.5 ${FOCUS}`}
        aria-label="Copy your link"
      >
        <Copy size={17} strokeWidth={1.8} className="mt-0.5 shrink-0" style={{ color: INK }} aria-hidden="true" />
        <span className="min-w-0 text-[14px] leading-snug break-all font-mono" style={{ color: INK }}>{link}</span>
      </button>

      <p className="mt-3 px-2 text-center text-[12.5px] leading-relaxed" style={{ color: INK_3 }}>
        Share your QR code and link only with people you trust. Anyone who has them sees your username and can start a chat with you.
      </p>

      {confirmReset ? (
        <div className="mt-3 w-full bg-white rounded-2xl border border-[#e6e8ec] p-4" role="group" aria-label="Reset your link?">
          <p className="text-[14px] leading-snug" style={{ color: INK }}>
            Reset your QR code and link? The ones you shared stop working. Your username stays the same.
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmReset(false)} className={`h-10 px-4 rounded-full text-[14px] font-semibold hover:bg-[#f2f4f7] ${FOCUS}`} style={{ color: INK }}>Cancel</button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await u.resetLink();
                  toast.success('New QR code and link ready');
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setBusy(false);
                  setConfirmReset(false);
                }
              }}
              className={`h-10 px-4 rounded-full text-[14px] font-semibold text-white bg-[#15171c] hover:bg-[#262932] disabled:opacity-40 ${FOCUS}`}
            >
              Reset
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirmReset(true)} className={`mt-2 h-10 px-4 rounded-full text-[14px] font-semibold text-[#2754d6] hover:bg-[#eef3ff] ${FOCUS}`}>
          Reset
        </button>
      )}
    </div>
  );
}
