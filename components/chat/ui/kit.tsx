'use client';

/*
 * Small building blocks shared by the Ledger Chat panels (calls, updates,
 * communities, settings, sheets). They exist so every panel looks like the
 * same product: light surfaces, ink text, sentence case, lucide icons.
 *
 * Colours: ink #15171c, secondary #4a505c, muted #727a88, faint #a3a9b4,
 * hairline #eceef2, border #e4e7ec, muted surface #f2f4f7 / #f7f8fa.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';

export const shortAddr = (addr?: string | null) => (addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '');

/** A soft colour per address, so the same person always looks the same. */
export function tintFor(address?: string | null) {
  const hex = (address || '').replace(/^0x/i, '').slice(0, 6);
  const hue = hex && /^[0-9a-f]+$/i.test(hex) ? parseInt(hex, 16) % 360 : 220;
  return { background: `hsl(${hue} 55% 91%)`, color: `hsl(${hue} 42% 28%)` };
}

export function initials(name?: string | null, address?: string | null) {
  const clean = (name || '').trim();
  if (clean && !/^0x[0-9a-f]/i.test(clean)) {
    const parts = clean.replace(/^@/, '').split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }
  return address ? address.slice(2, 4).toUpperCase() : '';
}

export function PeerAvatar({ address, name, photo, size = 44 }: { address?: string | null; name?: string | null; photo?: string | null; size?: number }) {
  return (
    <span
      className="rounded-full flex items-center justify-center shrink-0 overflow-hidden font-semibold select-none"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36), ...tintFor(address || name) }}
      aria-hidden="true"
    >
      {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : initials(name, address)}
    </span>
  );
}

/** A quiet heading above a group of rows. */
export function SectionLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`px-4 pt-4 pb-1.5 text-[13px] font-medium text-[#727a88] ${className}`}>{children}</p>;
}

export function EmptyState({ icon, title, text, action }: { icon: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center px-8 py-14">
      <span className="w-12 h-12 rounded-full bg-[#f2f4f7] text-[#4a505c] flex items-center justify-center mb-4" aria-hidden="true">{icon}</span>
      <p className="text-[15.5px] font-medium text-[#15171c]">{title}</p>
      {text && <p className="text-[14px] text-[#727a88] mt-1 leading-relaxed max-w-[280px]">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PrimaryButton({ children, className = '', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-[#15171c] hover:bg-[#2b2f38] disabled:bg-[#e4e7ec] disabled:text-[#a3a9b4] text-white text-[15px] font-medium transition-colors ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className = '', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-[#eff1f4] hover:bg-[#e4e7ec] text-[#15171c] text-[15px] font-medium transition-colors disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

export function IconButton({ label, children, className = '', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={`w-9 h-9 rounded-full flex items-center justify-center text-[#15171c] hover:bg-[#f2f4f7] transition-colors shrink-0 ${className}`}
    >
      {children}
    </button>
  );
}

export function SearchField({ value, onChange, placeholder, autoFocus }: { value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean }) {
  return (
    <label className="flex items-center gap-2 h-10 bg-[#f2f4f7] rounded-xl px-3">
      <Search size={16} strokeWidth={1.9} className="text-[#a3a9b4] shrink-0" aria-hidden="true" />
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="flex-1 min-w-0 bg-transparent text-[15px] outline-none text-[#15171c] placeholder:text-[#a3a9b4]"
      />
    </label>
  );
}

/** A bottom sheet on phones, a centred dialog on larger screens. */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  const id = React.useId();
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[1000] bg-[#15171c]/30 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-4"
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={id}
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 360 }}
            onClick={e => e.stopPropagation()}
            className={`bg-white w-full ${wide ? 'sm:max-w-lg' : 'sm:max-w-md'} rounded-t-3xl sm:rounded-3xl shadow-[0_24px_60px_-20px_rgba(16,24,40,0.35)] max-h-[88vh] flex flex-col overflow-hidden`}
          >
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
              <div className="min-w-0">
                <h2 id={id} className="text-[17px] font-semibold tracking-[-0.01em] text-[#15171c]">{title}</h2>
                {subtitle && <p className="text-[14px] text-[#727a88] mt-0.5">{subtitle}</p>}
              </div>
              <IconButton label="Close" onClick={onClose} className="-mr-1.5 -mt-1">
                <X size={18} strokeWidth={1.9} />
              </IconButton>
            </div>
            <div className="flex-1 overflow-y-auto">{children}</div>
            {footer && <div className="px-5 py-4 border-t border-[#eceef2]">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
