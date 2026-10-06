'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ExternalLink,
  Package,
  Leaf,
  MapPin,
  ShieldCheck,
  Hash,
  Tag,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowUpRight,
  Fingerprint,
  Globe,
  QrCode,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { passportPublicUrl } from '@/lib/scan/parseScanPayload';
import type { ProductPassportPublic } from '@/lib/passport/types';

/* ─────────────────────────────────────────────
   THEMES
───────────────────────────────────────────── */
interface ThemeConfig {
  bg: string;
  cardBg: string;
  cardBorder: string;
  headerBorder: string;
  textMain: string;
  textMuted: string;
  accentBg: string;
  accentText: string;
  iconColor: string;
  bannerVerifiedBg: string;
  bannerVerifiedText: string;
  bannerPendingBg: string;
  bannerPendingText: string;
  buttonBg: string;
}

const THEMES: Record<string, ThemeConfig> = {
  PHARMA: {
    bg: 'bg-slate-50',
    cardBg: 'bg-white',
    cardBorder: 'border-blue-100',
    headerBorder: 'border-blue-100',
    textMain: 'text-slate-900',
    textMuted: 'text-slate-500',
    accentBg: 'bg-blue-50',
    accentText: 'text-blue-700',
    iconColor: 'text-blue-400',
    bannerVerifiedBg: 'bg-blue-600',
    bannerVerifiedText: 'text-white',
    bannerPendingBg: 'bg-slate-200',
    bannerPendingText: 'text-slate-700',
    buttonBg: 'bg-blue-600 hover:bg-blue-700',
  },
  FOOD: {
    bg: 'bg-stone-50',
    cardBg: 'bg-white',
    cardBorder: 'border-emerald-100',
    headerBorder: 'border-emerald-100',
    textMain: 'text-stone-900',
    textMuted: 'text-stone-500',
    accentBg: 'bg-emerald-50',
    accentText: 'text-emerald-800',
    iconColor: 'text-emerald-500',
    bannerVerifiedBg: 'bg-emerald-700',
    bannerVerifiedText: 'text-white',
    bannerPendingBg: 'bg-stone-200',
    bannerPendingText: 'text-stone-700',
    buttonBg: 'bg-emerald-700 hover:bg-emerald-800',
  },
  TECH: {
    bg: 'bg-zinc-50',
    cardBg: 'bg-white',
    cardBorder: 'border-zinc-200',
    headerBorder: 'border-zinc-200',
    textMain: 'text-zinc-900',
    textMuted: 'text-zinc-500',
    accentBg: 'bg-zinc-100',
    accentText: 'text-zinc-800',
    iconColor: 'text-zinc-400',
    bannerVerifiedBg: 'bg-zinc-900',
    bannerVerifiedText: 'text-white',
    bannerPendingBg: 'bg-zinc-200',
    bannerPendingText: 'text-zinc-700',
    buttonBg: 'bg-zinc-900 hover:bg-zinc-800',
  },
  INFRASTRUCTURE: {
    bg: 'bg-[#FDFBF7]',
    cardBg: 'bg-white',
    cardBorder: 'border-orange-100',
    headerBorder: 'border-orange-100',
    textMain: 'text-neutral-900',
    textMuted: 'text-neutral-500',
    accentBg: 'bg-orange-50',
    accentText: 'text-orange-800',
    iconColor: 'text-orange-400',
    bannerVerifiedBg: 'bg-orange-600',
    bannerVerifiedText: 'text-white',
    bannerPendingBg: 'bg-neutral-200',
    bannerPendingText: 'text-neutral-700',
    buttonBg: 'bg-orange-600 hover:bg-orange-700',
  },
  TEXTILE: {
    bg: 'bg-[#FCFBF9]',
    cardBg: 'bg-white',
    cardBorder: 'border-stone-200',
    headerBorder: 'border-stone-200',
    textMain: 'text-[#2C2C2C]',
    textMuted: 'text-[#8A8A8A]',
    accentBg: 'bg-stone-100',
    accentText: 'text-stone-700',
    iconColor: 'text-stone-400',
    bannerVerifiedBg: 'bg-[#2C2C2C]',
    bannerVerifiedText: 'text-white',
    bannerPendingBg: 'bg-stone-200',
    bannerPendingText: 'text-stone-600',
    buttonBg: 'bg-[#2C2C2C] hover:bg-black',
  },
  DOCUMENTS: {
    bg: 'bg-[#FAF9F6]',
    cardBg: 'bg-white',
    cardBorder: 'border-amber-100',
    headerBorder: 'border-amber-100',
    textMain: 'text-slate-900',
    textMuted: 'text-slate-500',
    accentBg: 'bg-amber-50',
    accentText: 'text-amber-800',
    iconColor: 'text-amber-500',
    bannerVerifiedBg: 'bg-amber-700',
    bannerVerifiedText: 'text-white',
    bannerPendingBg: 'bg-slate-200',
    bannerPendingText: 'text-slate-600',
    buttonBg: 'bg-amber-700 hover:bg-amber-800',
  },
  DEFAULT: {
    bg: 'bg-[#FAFAFA]',
    cardBg: 'bg-white',
    cardBorder: 'border-black/8',
    headerBorder: 'border-black/8',
    textMain: 'text-[#050505]',
    textMuted: 'text-black/50',
    accentBg: 'bg-black/5',
    accentText: 'text-black/70',
    iconColor: 'text-black/30',
    bannerVerifiedBg: 'bg-white',
    bannerVerifiedText: 'text-white',
    bannerPendingBg: 'bg-black/5',
    bannerPendingText: 'text-black/60',
    buttonBg: 'bg-black hover:bg-black/80',
  }
};


/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const CHAIN_EXPLORERS: Record<number, { name: string; base: string }> = {
  1:    { name: 'Etherscan',    base: 'https://etherscan.io/tx/' },
  8453: { name: 'Basescan',    base: 'https://basescan.org/tx/' },
  137:  { name: 'Polygonscan', base: 'https://polygonscan.com/tx/' },
  2151908: { name: 'AztecScan', base: 'https://aztecscan.xyz/tx-effect/' },
};

/* ─────────────────────────────────────────────
   UTILITIES
───────────────────────────────────────────── */
function explorerUrl(chainId: number | null, txHash: string | null): string | null {
  if (!txHash || !chainId) return null;
  if (chainId === 2151908 || chainId === 89021716) return 'https://aztecscan.xyz';
  const explorer = CHAIN_EXPLORERS[chainId];
  return explorer ? `${explorer.base}${txHash}` : null;
}

function explorerName(chainId: number | null): string {
  if (!chainId) return 'blockchain explorer';
  return CHAIN_EXPLORERS[chainId]?.name ?? 'explorer';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatDatetime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatEventType(eventType: string): string {
  const labels: Record<string, string> = {
    manufactured:       'Manufactured',
    shipped:            'Shipped',
    received:           'Received',
    inspected:          'Inspected',
    certified:          'Certified',
    on_chain_confirmed: 'Confirmed on blockchain',
    revoked:            'Revoked',
    note:               'Note added',
  };
  return labels[eventType] ?? eventType.replace(/_/g, ' ');
}

/* ─────────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────────── */

/** Detail row inside a card */
function DetailRow({
  icon,
  label,
  value,
  mono = false,
  theme = THEMES.DEFAULT,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  theme?: ThemeConfig;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={`mt-0.5 shrink-0 ${theme.iconColor}`}>{icon}</div>
      <div className="min-w-0">
        <p className={`text-[9px] font-black uppercase tracking-[0.2em] mb-0.5 ${theme.textMuted}`}>
          {label}
        </p>
        <p className={`text-sm break-words ${theme.textMain} ${mono ? 'font-mono text-xs' : 'font-medium'}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

/** Section wrapper */
function Card({
  title,
  children,
  theme = THEMES.DEFAULT,
}: {
  title?: string;
  children: React.ReactNode;
  theme?: ThemeConfig;
}) {
  return (
    <section className={`rounded-2xl border overflow-hidden ${theme.cardBorder} ${theme.cardBg}`}>
      {title && (
        <div className={`px-5 py-3.5 border-b ${theme.cardBorder}`}>
          <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${theme.textMuted}`}>{title}</p>
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
export function PassportView({ passport }: { passport: ProductPassportPublic }) {
  const p = passport.payload;
  const txUrl = explorerUrl(passport.chainId, passport.txHash);
  const passportUrl = passportPublicUrl(passport.slug);
  const isAnchored = !!passport.txHash;
  const [activeModal, setActiveModal] = useState<'records' | 'how' | null>(null);

  const theme = THEMES[passport.category || 'OTHER'] || THEMES.DEFAULT;

  // Separate on_chain_confirmed events from other events for the timeline
  const timelineEvents = passport.events.filter(
    (ev) => ev.eventType !== 'on_chain_confirmed'
  );
  const anchorEvent = passport.events.find(
    (ev) => ev.eventType === 'on_chain_confirmed'
  );

  return (
    <div className={`min-h-[100vh] ${theme.bg} ${theme.textMain}`}>

      {/* ── Verification banner ── */}
      <div
        className={`w-full px-5 py-3 flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest ${
          isAnchored
            ? `${theme.bannerVerifiedBg} ${theme.bannerVerifiedText}`
            : `${theme.bannerPendingBg} ${theme.bannerPendingText}`
        }`}
      >
        {isAnchored ? (
          <>
            <ShieldCheck size={14} />
            Verified on blockchain
          </>
        ) : (
          <>
            <AlertCircle size={13} />
            Public record · Not yet on blockchain
          </>
        )}
      </div>

      {/* ── Header ── */}
      <header className={`border-b px-5 pt-6 pb-8 ${theme.cardBg} ${theme.headerBorder}`}>
        <div className="max-w-lg mx-auto text-center space-y-2">
          <p className={`text-[9px] font-black uppercase tracking-[0.3em] ${theme.textMuted}`}>
            Product record · Studio Provenance
          </p>
          <h1 className={`text-2xl sm:text-3xl font-black tracking-tight leading-tight ${theme.textMain}`}>
            {passport.title}
          </h1>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {passport.category && (
              <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${theme.accentBg} ${theme.accentText} ${theme.cardBorder}`}>
                <Tag size={9} />
                {passport.category}
              </span>
            )}
            {p?.batchId && (
              <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border font-mono ${theme.accentBg} ${theme.accentText} ${theme.cardBorder}`}>
                <Hash size={9} />
                {p.batchId}
              </span>
            )}
            <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${theme.accentBg} ${theme.accentText} ${theme.cardBorder}`}>
              <Clock size={9} />
              {formatDate(passport.createdAt)}
            </span>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="max-w-lg mx-auto px-5 py-6 space-y-4">

        {/* Description */}
        {p?.description && (
          <Card theme={theme} title="About this product">
            <p className={`text-sm leading-relaxed opacity-90 ${theme.textMain}`}>{p.description}</p>
          </Card>
        )}

        {/* Details */}
        {(p?.origin || p?.batchId || p?.carbonKg != null || passport.gs1Gtin) && (
          <Card theme={theme} title="Product details">
            <div className="space-y-4">
              {p?.origin && (
                <DetailRow theme={theme} icon={<MapPin size={15} />} label="Country or region of origin" value={p.origin} />
              )}
              {p?.batchId && (
                <DetailRow theme={theme} icon={<Package size={15} />} label="Batch identifier" value={p.batchId} mono />
              )}
              {typeof p?.carbonKg === 'number' && (
                <DetailRow
                  theme={theme}
                  icon={<Leaf size={15} />}
                  label="Reported carbon footprint"
                  value={`${p.carbonKg} kg CO₂e`}
                />
              )}
              {passport.gs1Gtin && (
                <DetailRow
                  theme={theme}
                  icon={<QrCode size={15} />}
                  label="GS1 barcode number"
                  value={passport.gs1Gtin}
                  mono
                />
              )}
            </div>
          </Card>
        )}

        {/* Certifications */}
        {p?.certifications && p.certifications.length > 0 && (
          <Card theme={theme} title="Certifications">
            <ul className="flex flex-wrap gap-2">
              {p.certifications.map((cert) => (
                <li
                  key={cert}
                  className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border ${theme.accentBg} ${theme.textMain} ${theme.cardBorder}`}
                >
                  <CheckCircle2 size={10} className={theme.iconColor} />
                  {cert}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Event timeline */}
        {timelineEvents.length > 0 && (
          <Card theme={theme} title="Product history">
            <ol className="space-y-0">
              {timelineEvents.map((ev, i) => (
                <li key={ev.id} className="relative flex gap-3">
                  {/* Vertical connector line */}
                  {i < timelineEvents.length - 1 && (
                    <div className="absolute left-[7px] top-5 w-px bottom-0 bg-black/10" />
                  )}
                  {/* Dot */}
                  <div
                    className={`mt-1 w-3.5 h-3.5 rounded-full border-2 shrink-0 z-10 ${
                      ev.eventType === 'revoked'
                        ? 'border-black/50 bg-black/20'
                        : `${theme.cardBg} border-black/80`
                    }`}
                  />
                  <div className="pb-5 min-w-0 flex-1">
                    <p className={`text-[10px] font-black uppercase tracking-widest ${theme.textMuted}`}>
                      {formatDatetime(ev.createdAt)}
                    </p>
                    <p className={`text-sm font-bold mt-0.5 ${theme.textMain}`}>
                      {formatEventType(ev.eventType)}
                    </p>
                    {!!(ev.payload as any)?.location && (
                      <p className={`text-xs mt-0.5 flex items-center gap-1 ${theme.textMuted}`}>
                        <MapPin size={10} />
                        {String((ev.payload as any).location)}
                      </p>
                    )}
                    {!!(ev.payload as any)?.note && (
                      <p className={`text-xs mt-0.5 leading-relaxed opacity-90 ${theme.textMain}`}>
                        {String((ev.payload as any).note)}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        )}

        {/* Blockchain proof section */}
        <Card theme={theme} title="Blockchain record">
          {isAnchored ? (
            <div className="space-y-4">
              {/* Status */}
              <div className={`flex items-start gap-3 p-4 rounded-xl ${theme.bannerVerifiedBg} ${theme.bannerVerifiedText}`}>
                <ShieldCheck size={18} className="shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold mb-0.5">Record confirmed on blockchain</p>
                  <p className="text-[11px] opacity-80 leading-relaxed">
                    A permanent, tamper-proof reference to this record exists on the public ledger.
                    The information shown here matches what was registered. Any modification would
                    invalidate this confirmation.
                  </p>
                </div>
              </div>

              {/* Anchor event from timeline */}
              {!!(anchorEvent?.payload as any)?.confirmedAt && (
                <DetailRow
                  theme={theme}
                  icon={<Clock size={15} />}
                  label="Confirmed on"
                  value={formatDatetime(String((anchorEvent!.payload as any).confirmedAt))}
                />
              )}

              {/* Issuer */}
              {passport.issuerAddress && (
                <DetailRow
                  theme={theme}
                  icon={<Fingerprint size={15} />}
                  label="Issuing organisation address"
                  value={passport.issuerAddress}
                  mono
                />
              )}

              {/* Entropy receipt */}
              {passport.coreEntropy && (
                <DetailRow
                  theme={theme}
                  icon={<Hash size={15} />}
                  label="Record fingerprint"
                  value={passport.coreEntropy}
                  mono
                />
              )}

              {/* Transaction link */}
              {txUrl && (
                <div className="pt-1">
                  <a
                    href={txUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest border rounded-xl px-4 py-2.5 transition-colors ${theme.textMain} ${theme.cardBorder} hover:opacity-70`}
                  >
                    View on {explorerName(passport.chainId)}
                    <ExternalLink size={11} />
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle size={16} className={`shrink-0 mt-0.5 ${theme.iconColor}`} />
                <div>
                  <p className={`text-sm font-bold ${theme.textMain}`}>
                    No blockchain confirmation yet
                  </p>
                  <p className={`text-xs mt-1 leading-relaxed opacity-90 ${theme.textMain}`}>
                    This record exists in the Studio Provenance database but has not been
                    confirmed on the public blockchain. The issuing organisation can add
                    blockchain confirmation from the Studio.
                  </p>
                </div>
              </div>
              {passport.issuerAddress && (
                <DetailRow
                  theme={theme}
                  icon={<Fingerprint size={15} />}
                  label="Issuing organisation address"
                  value={passport.issuerAddress}
                  mono
                />
              )}
            </div>
          )}
        </Card>

        {/* QR Code for re-sharing */}
        <Card theme={theme} title="Share this record">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            <div className={`border rounded-xl p-2.5 shrink-0 ${theme.cardBg} ${theme.cardBorder}`}>
              <QRCodeSVG value={passportUrl} size={120} level="M" />
            </div>
            <div className="flex-1 min-w-0 space-y-2 text-center sm:text-left">
              <p className={`text-xs leading-relaxed opacity-90 ${theme.textMain}`}>
                Anyone who scans this code will see this public record. Print it on packaging,
                labels, or documents.
              </p>
              <p className={`text-[10px] font-mono break-all ${theme.textMuted}`}>{passportUrl}</p>
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                <button
                  onClick={() => setActiveModal('records')}
                  className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest transition-colors cursor-pointer ${theme.textMuted} hover:opacity-70`}
                >
                  <Globe size={10} />
                  All records
                </button>
                <button
                  onClick={() => setActiveModal('how')}
                  className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest transition-colors cursor-pointer ${theme.textMuted} hover:opacity-70`}
                >
                  How this works
                  <ArrowUpRight size={10} />
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* Aztec footer attribution */}
        <div className={`rounded-2xl border p-4 flex items-center justify-between gap-3 ${theme.cardBg} ${theme.cardBorder}`}>
          <div>
            <p className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${theme.textMuted}`}>
              Powered by
            </p>
            <p className={`text-xs font-bold ${theme.textMain}`}>Studio Provenance · Aztec Network</p>
            <p className={`text-[10px] mt-0.5 leading-relaxed ${theme.textMuted}`}>
              Public verification. Private data.
            </p>
          </div>
          <a
            href="https://aztec.network"
            target="_blank"
            rel="noopener noreferrer"
            className={`shrink-0 text-[9px] font-black uppercase tracking-widest transition-colors flex items-center gap-1 ${theme.textMuted} hover:opacity-70`}
          >
            aztec.network
            <ExternalLink size={9} />
          </a>
        </div>

        {/* Legal */}
        <p className={`text-center text-[10px] pb-2 ${theme.textMuted}`}>
          <Link href="/privacy#product-scan" className="underline underline-offset-2 hover:opacity-70">
            Privacy — how scanning works
          </Link>
        </p>
      </main>

      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 px-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveModal(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={`relative w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-black/10 ${theme.cardBg}`}
            >
              {activeModal === 'how' ? (
                <div className="p-6">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-4 ${theme.accentBg}`}>
                    <ShieldCheck size={20} className={theme.iconColor} />
                  </div>
                  <h3 className={`text-lg font-black tracking-tight mb-2 ${theme.textMain}`}>Zero Knowledge Provenance</h3>
                  <p className={`text-sm leading-relaxed mb-4 opacity-90 ${theme.textMain}`}>
                    This Product Passport is cryptographically anchored to the <span className="font-bold">Aztec Network</span>. 
                    It uses Zero Knowledge Proofs (ZK-SNARKs) to prove the item's authenticity and origin without exposing sensitive manufacturing or supply chain data.
                  </p>
                  <p className={`text-xs mb-6 leading-relaxed ${theme.textMuted}`}>
                    The QR code you scanned contains a unique signature that was verified mathematically on your device, ensuring it was created by the verified issuer.
                  </p>
                  <button
                    onClick={() => setActiveModal(null)}
                    className={`w-full py-3 text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-colors ${theme.buttonBg}`}
                  >
                    Understood
                  </button>
                </div>
              ) : (
                <div className="p-6">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-4 ${theme.accentBg}`}>
                    <Globe size={20} className={theme.iconColor} />
                  </div>
                  <h3 className={`text-lg font-black tracking-tight mb-2 ${theme.textMain}`}>Humanity Ledger Registry</h3>
                  <p className={`text-sm leading-relaxed mb-4 opacity-90 ${theme.textMain}`}>
                    You are currently viewing an isolated, public-facing record. The Global Registry is a private environment restricted to verified manufacturers and auditors.
                  </p>
                  <div className={`border rounded-xl p-3 mb-6 ${theme.bg} ${theme.cardBorder}`}>
                    <p className={`text-[10px] uppercase tracking-widest font-black mb-1 ${theme.textMuted}`}>Issuer Status</p>
                    <p className={`text-xs font-medium ${theme.textMain}`}>Verified & Anchored</p>
                  </div>
                  <button
                    onClick={() => setActiveModal(null)}
                    className={`w-full py-3 text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-colors ${theme.buttonBg}`}
                  >
                    Close
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

