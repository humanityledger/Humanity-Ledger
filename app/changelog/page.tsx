'use client';
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Zap, Shield, Bug, Package, ArrowUpRight, Calendar,
  Star, Sparkles, Cpu, Globe, Lock, MessageSquare, Users, BarChart2, Webhook
} from 'lucide-react';
import Link from 'next/link';

type ChangeType = 'new' | 'improved' | 'fixed' | 'security' | 'removed' | 'breaking';

interface ChangeEntry {
  type: ChangeType;
  text: string;
}

interface Release {
  version: string;
  date: string;
  title: string;
  description: string;
  tags: string[];
  highlight?: boolean;
  changes: ChangeEntry[];
}

const RELEASES: Release[] = [
  {
    version: 'v2.4.0',
    date: 'October 10, 2026',
    title: 'Communities Overhaul + Reactions + Analytics',
    description: 'A massive update to Communities: complete chat rewrite with stable layout, emoji reactions, pinned messages, analytics dashboard, and the Developer Portal.',
    tags: ['Communities', 'Analytics', 'Dev Portal'],
    highlight: true,
    changes: [
      { type: 'new', text: 'Communities chat complete rewrite — stable layout, no more descentering on message send.' },
      { type: 'new', text: 'Emoji reactions on any message — tap to react, tap again to remove.' },
      { type: 'new', text: 'Pinned messages banner in chat with preview and dismiss.' },
      { type: 'new', text: 'Smart scroll — auto-scroll to bottom with unread counter pill.' },
      { type: 'new', text: 'Message grouping — consecutive messages from same author grouped natively like iMessage.' },
      { type: 'new', text: 'Inline message search inside any community channel.' },
      { type: 'new', text: 'Community Analytics Dashboard (Member Heatmap, Growth, Churn Prediction).' },
      { type: 'new', text: 'Analytics tab added to communities alongside Posts, Chat, Settings.' },
      { type: 'new', text: 'Developer Portal launched at /developers with full SDK, REST API, Webhooks, Bot Framework and Noir Circuits docs.' },
      { type: 'new', text: 'Creator Dashboard launched at /creator/dashboard with USDC revenue tracking, MRR, payout automation.' },
      { type: 'new', text: 'Status Page launched at /status with real-time uptime metrics.' },
      { type: 'new', text: 'Roadmap page launched at /roadmap showing 2026-2028 execution phases.' },
      { type: 'new', text: 'Privacy Policy, Terms of Service, Cookie Policy and Data Retention pages.' },
      { type: 'improved', text: 'Poll bubbles now have interactive voting with animated progress bars.' },
      { type: 'improved', text: 'Audio player in chat now shows separate waveform progress for mine/other bubbles.' },
      { type: 'fixed', text: 'Message send causing full UI relayout — the critical descentering bug is now gone.' },
      { type: 'fixed', text: 'Optimistic messages sometimes persisting when network call failed.' },
      { type: 'fixed', text: 'Communities settings PATCH returning 403 for valid admins.' },
    ],
  },
  {
    version: 'v2.3.5',
    date: 'October 5, 2026',
    title: 'Download Page + Landing UX Improvements',
    description: 'Fixed critical JSX corruption in the landing Download section, added Linux download option, and polished all download buttons with correct OS logos.',
    tags: ['Landing', 'Downloads'],
    changes: [
      { type: 'fixed', text: 'Corrupted DownloadSection.tsx causing Railway build failures on every deploy.' },
      { type: 'new', text: 'Linux (.AppImage) download option added alongside Windows and macOS.' },
      { type: 'improved', text: 'Download buttons now show authentic OS brand logos (Windows, macOS, Linux).' },
      { type: 'improved', text: 'Download links now correctly point to GitHub Releases.' },
    ],
  },
  {
    version: 'v2.3.0',
    date: 'September 28, 2026',
    title: 'Voice Messages, Polls & Crypto Payments in Chat',
    description: 'Native voice recording, interactive polls, crypto send, location sharing, and stickers are now fully integrated into Communities chat.',
    tags: ['Chat', 'Payments', 'Voice'],
    changes: [
      { type: 'new', text: 'Voice recorder with live waveform, cancel and send — fully E2EE.' },
      { type: 'new', text: 'Audio player with progress bar and dual-state (mine/other) styling.' },
      { type: 'new', text: 'Interactive polls with real-time vote animation.' },
      { type: 'new', text: 'USDC / ETH crypto send directly in chat (via NativeCryptoSendModal).' },
      { type: 'new', text: 'Location sharing in chat — maps.google.com link generated privately.' },
      { type: 'new', text: 'App drawer (+ button) with Photo, Crypto, Location, Sticker, Poll.' },
      { type: 'new', text: 'Right-click context menu with Reply and Copy actions.' },
      { type: 'improved', text: 'Textarea auto-grows to 140px maximum with smooth animation.' },
    ],
  },
  {
    version: 'v2.2.0',
    date: 'September 15, 2026',
    title: 'Communities: Member Panel, Settings Panel, Rich Post Editor',
    description: 'Full member management panel, granular permission settings, and a Tiptap-based rich post editor for long-form community posts.',
    tags: ['Communities', 'Editor'],
    changes: [
      { type: 'new', text: 'CommunityMemberPanel — full member list with role badges, actions dropdown (Promote, Kick, Ban).' },
      { type: 'new', text: 'CommunitySettingsPanel — profile editor, invite link with QR, channel CRUD, permission toggles, privacy control, danger zone.' },
      { type: 'new', text: 'Rich Post Editor with Tiptap (bold, italic, headings, images, links).' },
      { type: 'new', text: 'Community analytics mini-cards in settings (Messages Today, New Members, Active Now).' },
      { type: 'new', text: 'Slow mode controls (Off, 10s, 30s, 1m, 5m, 1h).' },
      { type: 'new', text: 'Anti-spam toggle and Require Join Approval toggle.' },
      { type: 'security', text: 'All admin PATCH actions now require both x-web3-address and x-verified-session-address headers.' },
    ],
  },
  {
    version: 'v2.1.0',
    date: 'August 30, 2026',
    title: 'Token Gating + Paid Channels',
    description: 'Communities now support ERC-20 and ERC-721 token gating, subscription-based paid channels, and on-chain member verification.',
    tags: ['Communities', 'Token Gating', 'Payments'],
    changes: [
      { type: 'new', text: 'ERC-20 and ERC-721 token gating with customizable minimum balance.' },
      { type: 'new', text: 'Paid channel creation (price + currency: ETH, USDC, USDT).' },
      { type: 'new', text: 'On-chain member verification using wallet signature.' },
      { type: 'new', text: 'Revenue split — creator receives 95% of channel subscription revenue.' },
      { type: 'new', text: 'Channel categories sidebar (free/paid indicators).' },
    ],
  },
  {
    version: 'v2.0.0',
    date: 'August 1, 2026',
    title: 'Communities — Launched',
    description: 'The Communities feature launches: on-chain groups, real-time messaging, and channel-based organization.',
    tags: ['Communities', 'Major Release'],
    changes: [
      { type: 'new', text: 'Community creation with name, description, avatar, and privacy control.' },
      { type: 'new', text: 'Join communities via cryptographic invite links.' },
      { type: 'new', text: 'Multi-channel support within a community.' },
      { type: 'new', text: 'Real-time message polling (3s interval).' },
      { type: 'new', text: 'Posts tab for long-form content within communities.' },
      { type: 'new', text: 'LedgerCommunitiesTab integrated into main app sidebar.' },
    ],
  },
  {
    version: 'v1.5.0',
    date: 'June 20, 2026',
    title: 'XMTP v3 Integration',
    description: 'Upgraded from XMTP v1 to XMTP v3 with improved message delivery, inbox syncing and multi-device support.',
    tags: ['XMTP', 'Messaging'],
    changes: [
      { type: 'new', text: 'XMTP v3 message encoding with V3 content types.' },
      { type: 'improved', text: 'Inbox loads 3x faster with streamed message updates.' },
      { type: 'improved', text: 'Multi-device inbox sync — start on desktop, continue on mobile.' },
      { type: 'fixed', text: 'Conversations not loading for wallets with no prior XMTP history.' },
      { type: 'security', text: 'Upgraded libxmtp to address timing attack vulnerability in key exchange.' },
    ],
  },
];

const TYPE_CONFIG: Record<ChangeType, { label: string; color: string; bg: string }> = {
  new:      { label: 'New', color: 'text-[#25D366]', bg: 'bg-[#25D366]/10' },
  improved: { label: 'Improved', color: 'text-[#007AFF]', bg: 'bg-[#007AFF]/10' },
  fixed:    { label: 'Fixed', color: 'text-[#FF9500]', bg: 'bg-[#FF9500]/10' },
  security: { label: 'Security', color: 'text-red-500', bg: 'bg-red-50' },
  removed:  { label: 'Removed', color: 'text-black/40', bg: 'bg-black/5' },
  breaking: { label: 'Breaking', color: 'text-red-600', bg: 'bg-red-100' },
};

export default function ChangelogPage() {
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const allTags = Array.from(new Set(RELEASES.flatMap(r => r.tags)));

  const filtered = activeTag
    ? RELEASES.filter(r => r.tags.includes(activeTag))
    : RELEASES;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-black/[0.06] bg-white/95 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-[15px] font-black text-[#1C1C1E] hover:text-[#25D366] transition-colors">
            Humanity Ledger
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/status" className="text-[13px] font-semibold text-black/50 hover:text-black transition-colors">Status</Link>
            <Link href="/roadmap" className="text-[13px] font-semibold text-black/50 hover:text-black transition-colors">Roadmap</Link>
            <Link href="/developers" className="text-[13px] font-semibold text-black/50 hover:text-black transition-colors">Developers</Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Title */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-[#25D366]" />
            <span className="text-[12px] font-black uppercase tracking-widest text-[#25D366]">Changelog</span>
          </div>
          <h1 className="text-[48px] font-black text-[#1C1C1E] leading-tight mb-4">
            What's new
          </h1>
          <p className="text-[17px] text-black/50 max-w-lg leading-relaxed">
            Every release, every fix, every feature. Full transparency on how Humanity Ledger evolves.
          </p>
        </div>

        {/* Tag filters */}
        <div className="flex flex-wrap gap-2 mb-10">
          <button onClick={() => setActiveTag(null)}
            className={`px-3.5 py-1.5 rounded-full text-[12px] font-bold transition-colors ${!activeTag ? 'bg-[#1C1C1E] text-white' : 'bg-[#F2F2F7] text-black/50 hover:bg-[#E5E5EA]'}`}>
            All
          </button>
          {allTags.map(tag => (
            <button key={tag} onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`px-3.5 py-1.5 rounded-full text-[12px] font-bold transition-colors ${activeTag === tag ? 'bg-[#25D366] text-white' : 'bg-[#F2F2F7] text-black/50 hover:bg-[#E5E5EA]'}`}>
              {tag}
            </button>
          ))}
        </div>

        {/* Releases */}
        <div className="space-y-10">
          {filtered.map((release, idx) => (
            <motion.article
              key={release.version}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`relative pl-8 border-l-2 ${release.highlight ? 'border-[#25D366]' : 'border-black/10'}`}
            >
              {/* Timeline dot */}
              <div className={`absolute -left-[7px] top-1 w-3 h-3 rounded-full border-2 border-white ${release.highlight ? 'bg-[#25D366]' : 'bg-black/20'}`} />

              <div className={`rounded-3xl p-6 border ${release.highlight ? 'bg-[#F8FFFA] border-[#25D366]/20' : 'bg-white border-black/[0.06]'} shadow-sm`}>
                <div className="flex flex-wrap items-start gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[13px] font-black font-mono ${release.highlight ? 'text-[#25D366]' : 'text-black/40'}`}>
                        {release.version}
                      </span>
                      {release.highlight && (
                        <span className="px-2 py-0.5 bg-[#25D366] text-white text-[10px] font-black rounded-full uppercase tracking-widest">
                          Latest
                        </span>
                      )}
                    </div>
                    <h2 className="text-[20px] font-black text-[#1C1C1E] leading-tight">{release.title}</h2>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5 text-[12px] text-black/30 font-medium shrink-0">
                    <Calendar size={12} />
                    {release.date}
                  </div>
                </div>

                <p className="text-[14px] text-black/55 leading-relaxed mb-5">{release.description}</p>

                <div className="flex flex-wrap gap-1.5 mb-5">
                  {release.tags.map(tag => (
                    <span key={tag} className="px-2.5 py-1 bg-black/5 text-[11px] font-bold text-black/50 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="space-y-2">
                  {release.changes.map((change, i) => {
                    const cfg = TYPE_CONFIG[change.type];
                    return (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className={`mt-0.5 px-2 py-0.5 text-[10px] font-black uppercase rounded-md shrink-0 ${cfg.color} ${cfg.bg}`}>
                          {cfg.label}
                        </span>
                        <span className="text-[13px] text-black/65 leading-relaxed">{change.text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.article>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="mt-16 text-center">
          <p className="text-[14px] text-black/40 mb-4">
            See everything on GitHub for the full commit history
          </p>
          <a href="https://github.com/humanityledger/Humanity-Ledger/commits/main" target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#1C1C1E] text-white font-bold rounded-2xl hover:bg-black transition-colors text-[14px]">
            View on GitHub <ArrowUpRight size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
