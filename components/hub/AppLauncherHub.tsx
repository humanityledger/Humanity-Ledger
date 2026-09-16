'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAccount, useBalance, useEnsName, useDisconnect } from 'wagmi';
import { useHumanityAppchain } from '@/hooks/useHumanityAppchain';
import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, MessageSquare, ShieldCheck, TrendingUp,
  Globe, BookOpen, Package, Fingerprint,
  LogOut, ChevronRight, Coins, Vote, ScanLine,
} from 'lucide-react';

// ─── App definitions ─────────────────────────────────────────────────────────

export const PUBLIC_APP_MODULES = new Set(['chat']);
export const VISIBLE_LOCKED_MODULES = [
  'dashboard', 'markets', 'studio', 'governance', 'network', 'academy', 'qds', 'identity', 'registry', 'token'
] as const;

const APPS: {
  id: string;
  label: string;
  desc: string;
  href: string;
  icon: any;
  bg: string;
  fg: string;
  colSpan: string;
  locked: boolean;
  action?: () => void;
}[] = [
  {
    id: 'chat',
    label: 'Ledger Chat',
    desc: 'Encrypted communication',
    href: '/chat',
    icon: MessageSquare,
    bg: '#1C7AFF',
    fg: '#FFFFFF',
    colSpan: 'col-span-2 sm:col-span-2 lg:col-span-2',
    locked: false,
  },
  {
    id: 'link-session',
    label: 'Link Session',
    desc: 'Scan PC QR to link desktop',
    href: '/scan',
    icon: ScanLine,
    bg: '#FFFFFF',
    fg: '#0A0A0A',
    colSpan: 'col-span-1',
    locked: false,
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    desc: 'Portfolio intelligence',
    href: '#',
    icon: LayoutDashboard,
    bg: '#F5F5F7',
    fg: '#0A0A0A',
    colSpan: 'col-span-1',
    locked: true,
  },
  {
    id: 'markets',
    label: 'Markets',
    desc: 'Global block analytics',
    href: '#',
    icon: TrendingUp,
    bg: '#F5F5F7',
    fg: '#0A0A0A',
    colSpan: 'col-span-1',
    locked: true,
  },
  {
    id: 'studio',
    label: 'Studio',
    desc: 'Provenance registry. Not open while the module is under repair.',
    href: '#',
    icon: Package,
    bg: '#7C3AED',
    fg: '#FFFFFF',
    colSpan: 'col-span-1',
    locked: true,
  },
  {
    id: 'governance',
    label: 'Governance',
    desc: 'Vote on proposals',
    href: '#',
    icon: Vote,
    bg: '#F5F5F7',
    fg: '#0A0A0A',
    colSpan: 'col-span-1',
    locked: true,
  },
  {
    id: 'identity',
    label: 'Identity',
    desc: 'ZK sovereign credential',
    href: '#',
    icon: Fingerprint,
    bg: '#0A0A0A',
    fg: '#FFFFFF',
    colSpan: 'col-span-1',
    locked: true,
  },
  {
    id: 'network',
    label: 'Network',
    desc: 'Global node map',
    href: '#',
    icon: Globe,
    bg: '#F5F5F7',
    fg: '#0A0A0A',
    colSpan: 'col-span-1',
    locked: true,
  },
  {
    id: 'academy',
    label: 'Academy',
    desc: 'Learn cryptography',
    href: '#',
    icon: BookOpen,
    bg: '#F5F5F7',
    fg: '#0A0A0A',
    colSpan: 'col-span-1',
    locked: true,
  },
  {
    id: 'registry',
    label: 'Registry',
    desc: 'Asset passport explorer',
    href: '#',
    icon: ShieldCheck,
    bg: '#F5F5F7',
    fg: '#0A0A0A',
    colSpan: 'col-span-1',
    locked: true,
  },
  {
    id: 'token',
    label: 'QDS Token',
    desc: 'Stake & Vote',
    href: '#',
    icon: Coins,
    bg: '#F59E0B',
    fg: '#FFFFFF',
    colSpan: 'col-span-1 sm:col-span-2 lg:col-span-1',
    locked: true,
  },
];

// ─── App Card ────────────────────────────────────────────────────────────────

function AppCard({ app, index }: { app: typeof APPS[0]; index: number }) {
  const Icon = app.icon;
  const CardContent = (
    <div
      className={`relative h-full rounded-[24px] p-5 flex flex-col justify-between overflow-hidden select-none transition-all duration-200 ${
        app.locked
          ? 'opacity-70 grayscale-[50%] cursor-not-allowed'
          : 'cursor-pointer hover:scale-[1.025] active:scale-[0.97] hover:shadow-xl shadow-sm'
      }`}
      style={{ backgroundColor: app.bg, minHeight: '130px' }}
    >
      <div className="flex justify-between items-start">
        {/* Icon bubble */}
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: app.fg === '#FFFFFF' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)' }}
        >
          <Icon size={20} strokeWidth={1.8} color={app.fg} />
        </div>
      </div>

      {/* Label & Description */}
      <div className="mt-auto pt-6 flex flex-col gap-1 relative z-10">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-[15px] leading-tight" style={{ color: app.fg }}>
            {app.label}
          </p>
          {app.locked && (
            <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.1)', color: app.fg }}>
              Locked
            </span>
          )}
        </div>
        <p className="text-[12px] font-medium leading-snug pr-4" style={{ color: app.fg, opacity: 0.7 }}>
          {app.desc}
        </p>
      </div>

      {/* Action Indicator */}
      {!app.locked && (
        <ChevronRight
          size={16}
          className="absolute bottom-5 right-5"
          style={{ color: app.fg, opacity: 0.3 }}
        />
      )}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={app.colSpan}
    >
      {app.locked ? (
        <div className="block h-full" onClick={(e) => e.preventDefault()}>
          {CardContent}
        </div>
      ) : app.action ? (
        <button type="button" onClick={app.action} className="block h-full w-full text-left appearance-none">
          {CardContent}
        </button>
      ) : (
        <Link href={app.href} className="block h-full">
          {CardContent}
        </Link>
      )}
    </motion.div>
  );
}

// ─── Identity Panel ───────────────────────────────────────────────────────────

function IdentityPanel() {
  const { address, connector, chainId } = useAccount();
  const { data: balance } = useBalance({ address });
  const { data: ens } = useEnsName({ address, chainId: 1 });
  const { isReady, systemConfig } = useHumanityAppchain();
  const { disconnect } = useDisconnect();
  const router = useRouter();
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDate(now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const short = address ? `${address.slice(0, 6)}···${address.slice(-4)}` : null;
  const bal = balance ? `${parseFloat(balance.formatted).toFixed(4)} ${balance.symbol}` : null;

  if (!address) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="mb-6 bg-white rounded-[24px] border border-black/[0.06] p-6 shadow-sm"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 sm:gap-4">
        {/* Clock */}
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-black/40 mb-1">Appchain: {isReady ? "CONNECTED" : "SYNCING"}</p>
          <p className="font-mono text-[24px] sm:text-[28px] font-bold text-black tracking-tight tabular-nums leading-none">{time}</p>
          <p className="font-mono text-[11px] text-black/40 mt-1.5">{date}</p>
        </div>

        {/* Wallet info */}
        <div className="flex flex-col sm:items-end">
          <div className="inline-flex items-center gap-2 bg-black/[0.04] rounded-full px-4 py-2 mb-2 w-fit">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-[12px] font-bold text-black">{short}</span>
          </div>
          {ens && <p className="font-mono text-[11px] text-black/40 mb-1">{ens}</p>}
          {bal && <p className="font-mono text-[11px] text-black/40">{bal}</p>}
          {connector?.name && (
            <p className="font-mono text-[10px] text-black/30 mt-1">{connector.name}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-5 pt-4 border-t border-black/[0.05] flex items-center justify-between gap-2.5">
        <Link
          href="/docs"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black/[0.04] text-black/60 text-[12px] font-bold tracking-wide hover:bg-black/[0.08] transition-all active:scale-95"
        >
          <BookOpen size={13} />
          Docs
        </Link>
        <button
          onClick={() => {
            disconnect();
            try { localStorage.setItem('__disconnected__', '1'); sessionStorage.setItem('__disconnected__', '1'); } catch {}
            router.push('/');
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-black/10 text-black/40 text-[12px] font-bold tracking-wide hover:text-red-500 hover:border-red-200 transition-all active:scale-95 ml-auto"
        >
          <LogOut size={13} />
          Sign Out
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function AppLauncherHub() {
  return (
    <div>
      <IdentityPanel />

      {/* Section label */}
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-black/25 mb-4 px-1">
        Applications
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {APPS.map((app, i) => (
          <AppCard key={app.id} app={app} index={i} />
        ))}
      </div>
    </div>
  );
}

