'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Palette, Shield, Volume2, Zap, Brain,
  User, Globe, Bell, Network, X, ChevronRight,
  Check, Lock, Flame, Eye, EyeOff, Wifi, Radio,
  Music, Vibrate, Image, Type, Layers, Star,
  Bot, MessageSquare, Sparkles, Settings,
} from 'lucide-react';
import { useSettingsStore } from '@/lib/store/useSettingsStore';
import type { SystemSettings } from '@/lib/store/useSettingsStore';

// ── Legacy ChatSettings type for backward compat with MessageEngine ────────────
export type Theme = 'light' | 'dark' | 'midnight' | 'forest' | 'rose';
export type PrivacyMode = 'stealth' | 'standard' | 'institutional';
export type AutoDestructPreset = 'off' | '1m' | '1h' | '24h' | '7d';
export interface ChatSettings {
  theme: Theme;
  privacyMode: PrivacyMode;
  autoDestruct: AutoDestructPreset;
  showReadReceipts: boolean;
  textSize: number;
}
export const DEFAULT_SETTINGS: ChatSettings = {
  theme: 'dark',
  privacyMode: 'standard',
  autoDestruct: 'off',
  showReadReceipts: true,
  textSize: 4,
};

// ── Tab definitions ────────────────────────────────────────────────────────────

type TabId = 'vibes' | 'security' | 'audio' | 'defi' | 'ai' | 'identity' | 'network' | 'alerts';

const TABS: { id: TabId; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'vibes',    label: 'Vibes',      icon: <Palette size={16} />,       color: '#a855f7' },
  { id: 'security', label: 'Security',   icon: <Shield size={16} />,        color: '#ef4444' },
  { id: 'audio',    label: 'Audio',      icon: <Volume2 size={16} />,       color: '#3b82f6' },
  { id: 'defi',     label: 'DeFi',       icon: <Zap size={16} />,           color: '#f59e0b' },
  { id: 'ai',       label: 'AI Ghost',   icon: <Brain size={16} />,         color: '#10b981' },
  { id: 'identity', label: 'Identity',   icon: <User size={16} />,          color: '#6366f1' },
  { id: 'network',  label: 'Network',    icon: <Network size={16} />,       color: '#06b6d4' },
  { id: 'alerts',   label: 'Alerts',     icon: <Bell size={16} />,          color: '#f97316' },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-[0.12em] font-bold mb-2 px-1"
       style={{ color: 'rgba(255,255,255,0.35)' }}>
      {children}
    </p>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden mb-5"
         style={{ background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {children}
    </div>
  );
}

function Row({ children, isLast }: { children: React.ReactNode; isLast?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3.5 ${!isLast ? 'border-b' : ''}`}
         style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
      {children}
    </div>
  );
}

function RowLabel({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[15px] font-medium text-white/90">{label}</span>
      {sub && <span className="text-[11px] text-white/40">{sub}</span>}
    </div>
  );
}

function Toggle({ value, onChange, color = '#6366f1' }: { value: boolean; onChange: (v: boolean) => void; color?: string }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="relative flex-shrink-0 transition-all duration-300"
      style={{
        width: 48, height: 28,
        borderRadius: 14,
        background: value ? color : 'rgba(255,255,255,0.15)',
      }}
    >
      <div
        className="absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white shadow-lg transition-transform duration-300"
        style={{ transform: value ? 'translateX(23px)' : 'translateX(3px)' }}
      />
    </button>
  );
}

function Chips<T extends string | number>({
  options, value, onChange, color,
}: { options: { val: T; label: string }[]; value: T; onChange: (v: T) => void; color?: string }) {
  return (
    <div className="flex flex-wrap gap-2 px-4 py-3">
      {options.map(o => (
        <button
          key={o.val}
          onClick={() => onChange(o.val)}
          className="px-3 py-1.5 rounded-full text-[13px] font-medium transition-all duration-200 active:scale-95"
          style={{
            background: value === o.val ? (color || '#6366f1') : 'rgba(255,255,255,0.08)',
            color: value === o.val ? '#fff' : 'rgba(255,255,255,0.6)',
            border: `1px solid ${value === o.val ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ColorSwatch({ hex, selected, onClick }: { hex: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-9 h-9 rounded-full transition-transform duration-200 active:scale-90 flex items-center justify-center"
      style={{ background: hex, border: selected ? '3px solid white' : '2px solid rgba(255,255,255,0.15)', boxShadow: selected ? `0 0 12px ${hex}99` : 'none' }}
    >
      {selected && <Check size={14} color="#fff" />}
    </button>
  );
}

// ── Tab Panel Components ───────────────────────────────────────────────────────

function VibesPanel({ s, u }: { s: SystemSettings; u: <K extends keyof SystemSettings>(k: K, v: SystemSettings[K]) => void }) {
  const ACCENT_PRESETS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#06b6d4'];
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <SectionLabel>Chat Background</SectionLabel>
      <Card>
        <Chips
          options={[
            { val: 'default', label: '🌑 Default' },
            { val: 'amoled', label: '⬛ AMOLED' },
            { val: 'holographic', label: '🌈 Holo' },
            { val: 'matrix', label: '🟢 Matrix' },
            { val: 'gradient', label: '🎨 Liquid' },
            { val: 'custom', label: '🖼 Custom' },
          ]}
          value={s.chatBackground}
          onChange={(v) => u('chatBackground', v)}
          color="#a855f7"
        />
        {s.chatBackground === 'custom' && (
          <Row isLast>
            <RowLabel label="Upload Image" sub="Max 2MB · PNG, JPG, WebP" />
            <button
              onClick={() => fileRef.current?.click()}
              className="text-[13px] font-medium px-3 py-1.5 rounded-xl transition active:scale-95"
              style={{ background: '#6366f1', color: '#fff' }}
            >
              Choose
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]; if (!f || f.size > 2e6) return;
                const reader = new FileReader();
                reader.onload = (ev) => u('chatBackgroundCustomUrl', ev.target?.result as string);
                reader.readAsDataURL(f);
              }}
            />
          </Row>
        )}
      </Card>

      <SectionLabel>Bubble Style</SectionLabel>
      <Card>
        <Chips
          options={[
            { val: 'default', label: '💬 Default' },
            { val: 'glass', label: '🔮 Glass' },
            { val: 'brutalist', label: '🧱 Brutal' },
            { val: 'cyberpunk', label: '⚡ Cyber' },
            { val: 'minimal', label: '○ Minimal' },
          ]}
          value={s.bubbleStyle}
          onChange={(v) => u('bubbleStyle', v)}
          color="#a855f7"
        />
      </Card>

      <SectionLabel>Accent Color</SectionLabel>
      <Card>
        <div className="px-4 py-3 flex flex-wrap gap-3">
          {ACCENT_PRESETS.map(hex => (
            <ColorSwatch key={hex} hex={hex} selected={s.accentColor === hex} onClick={() => u('accentColor', hex)} />
          ))}
          <label className="w-9 h-9 rounded-full cursor-pointer flex items-center justify-center overflow-hidden"
            style={{ border: '2px dashed rgba(255,255,255,0.3)' }}>
            <input type="color" value={s.accentColor} onChange={(e) => u('accentColor', e.target.value)}
              className="w-10 h-10 opacity-0 cursor-pointer absolute" />
            <Palette size={14} style={{ color: 'rgba(255,255,255,0.5)' }} />
          </label>
        </div>
      </Card>

      <SectionLabel>Typography</SectionLabel>
      <Card>
        <Chips
          options={[
            { val: 'inter', label: 'Inter' },
            { val: 'space-mono', label: 'Space Mono' },
            { val: 'fira-code', label: 'Fira Code' },
            { val: 'satoshi', label: 'Satoshi' },
          ]}
          value={s.chatFont}
          onChange={(v) => u('chatFont', v)}
          color="#a855f7"
        />
        <Row isLast>
          <RowLabel label="Text Size" sub={`${(s.textSize * 2 + 6)}px preview`} />
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-white/30">A</span>
            <input type="range" min={1} max={7} value={s.textSize}
              onChange={(e) => u('textSize', parseInt(e.target.value) as any)}
              className="w-24 accent-indigo-500" />
            <span className="text-[17px] text-white/60">A</span>
          </div>
        </Row>
      </Card>

      <SectionLabel>NFT Avatar Border</SectionLabel>
      <Card>
        <Row>
          <RowLabel label="Glow Border" sub="Radiant frame around your avatar" />
          <Toggle value={s.nftBorderEnabled} onChange={(v) => u('nftBorderEnabled', v)} color="#a855f7" />
        </Row>
        {s.nftBorderEnabled && (
          <Row isLast>
            <RowLabel label="Border Color" />
            <Chips
              options={[
                { val: 'ethereum', label: '🔵 ETH' },
                { val: 'polygon', label: '🟣 MATIC' },
                { val: 'gold', label: '🥇 Gold' },
                { val: 'rainbow', label: '🌈 Rainbow' },
              ]}
              value={s.nftBorderColor}
              onChange={(v) => u('nftBorderColor', v)}
              color="#a855f7"
            />
          </Row>
        )}
      </Card>
    </div>
  );
}

function SecurityPanel({ s, u }: { s: SystemSettings; u: <K extends keyof SystemSettings>(k: K, v: SystemSettings[K]) => void }) {
  return (
    <div>
      <SectionLabel>Message Security</SectionLabel>
      <Card>
        <Row>
          <RowLabel label="Burn-on-Read" sub="Auto-destroy messages after they're seen" />
          <Toggle value={s.burnOnRead} onChange={(v) => u('burnOnRead', v)} color="#ef4444" />
        </Row>
        {s.burnOnRead && (
          <Row>
            <RowLabel label="Burn Timer" />
            <Chips
              options={[
                { val: 3, label: '3s' }, { val: 10, label: '10s' },
                { val: 30, label: '30s' }, { val: 60, label: '60s' },
              ]}
              value={s.burnOnReadSeconds}
              onChange={(v) => u('burnOnReadSeconds', v as 3 | 10 | 30 | 60)}
              color="#ef4444"
            />
          </Row>
        )}
        <Row>
          <RowLabel label="Auto-Destruct Timer" sub="All messages disappear after set time" />
          <Chips
            options={[
              { val: 'off', label: 'Off' }, { val: '1m', label: '1m' },
              { val: '1h', label: '1h' }, { val: '24h', label: '24h' }, { val: '7d', label: '7d' },
            ]}
            value={s.autoDestruct}
            onChange={(v) => u('autoDestruct', v as any)}
            color="#ef4444"
          />
        </Row>
        <Row>
          <RowLabel label="Show Read Receipts" sub="Let sender know you've read their message" />
          <Toggle value={s.showReadReceipts} onChange={(v) => u('showReadReceipts', v)} color="#ef4444" />
        </Row>
        <Row isLast>
          <RowLabel label="Anti-Leak Watermark" sub="Overlay peer address on screen to trace leaks" />
          <Toggle value={s.watermarkEnabled} onChange={(v) => u('watermarkEnabled', v)} color="#ef4444" />
        </Row>
      </Card>

      <SectionLabel>Onion Routing</SectionLabel>
      <Card>
        <Row isLast>
          <RowLabel label="Privacy Hops" sub="More hops = more private, slightly slower" />
          <Chips
            options={[
              { val: 1, label: '⚡ Direct' },
              { val: 3, label: '🧅 Standard' },
              { val: 5, label: '🛡 Max' },
            ]}
            value={s.onionHops}
            onChange={(v) => u('onionHops', v as 1 | 3 | 5)}
            color="#ef4444"
          />
        </Row>
      </Card>

      <SectionLabel>Access Control</SectionLabel>
      <Card>
        <Row>
          <RowLabel label="Biometric Lock" sub="Require FaceID/fingerprint to open chat" />
          <Toggle value={s.biometricLock} onChange={(v) => u('biometricLock', v)} color="#ef4444" />
        </Row>
        <Row isLast>
          <RowLabel label="Stealth Mode" sub="Blur all balances and sensitive data" />
          <Toggle value={s.stealthMode} onChange={(v) => u('stealthMode', v)} color="#ef4444" />
        </Row>
      </Card>
    </div>
  );
}

function AudioPanel({ s, u }: { s: SystemSettings; u: <K extends keyof SystemSettings>(k: K, v: SystemSettings[K]) => void }) {
  return (
    <div>
      <SectionLabel>Sound Pack</SectionLabel>
      <Card>
        <Chips
          options={[
            { val: 'minimal', label: '💧 Minimal' },
            { val: 'arcade', label: '🕹 Arcade' },
            { val: 'ledger', label: '🐋 Ledger' },
            { val: 'asmr', label: '✨ ASMR' },
          ]}
          value={s.soundPack}
          onChange={(v) => u('soundPack', v as any)}
          color="#3b82f6"
        />
      </Card>

      <SectionLabel>Sound Options</SectionLabel>
      <Card>
        <Row>
          <RowLabel label="Notification Sound" sub="Play sound on new messages" />
          <Toggle value={s.notificationSound} onChange={(v) => u('notificationSound', v)} color="#3b82f6" />
        </Row>
        <Row>
          <RowLabel label="Mechanical Keyboard" sub="Satisfying click sounds while typing" />
          <Toggle value={s.mechanicalKeyboard} onChange={(v) => u('mechanicalKeyboard', v)} color="#3b82f6" />
        </Row>
        <Row isLast>
          <RowLabel label="All Sound Effects" sub="Message send/receive, reactions" />
          <Toggle value={s.soundEffects} onChange={(v) => u('soundEffects', v)} color="#3b82f6" />
        </Row>
      </Card>

      <SectionLabel>Haptics</SectionLabel>
      <Card>
        <Row isLast>
          <RowLabel label="Intensity" sub="Vibration strength on interactions" />
          <Chips
            options={[
              { val: 0, label: 'Off' }, { val: 1, label: 'Light' },
              { val: 2, label: 'Medium' }, { val: 3, label: 'Strong' },
            ]}
            value={s.hapticsIntensity}
            onChange={(v) => u('hapticsIntensity', v as 0 | 1 | 2 | 3)}
            color="#3b82f6"
          />
        </Row>
      </Card>
    </div>
  );
}

function DefiPanel({ s, u }: { s: SystemSettings; u: <K extends keyof SystemSettings>(k: K, v: SystemSettings[K]) => void }) {
  return (
    <div>
      <SectionLabel>Ledger Tools</SectionLabel>
      <Card>
        <Row>
          <RowLabel label="Ticker Widgets" sub="$BTC shows live price in chat bubbles" />
          <Toggle value={s.tickerWidgets} onChange={(v) => u('tickerWidgets', v)} color="#f59e0b" />
        </Row>
        <Row>
          <RowLabel label="Contract Scanner" sub="0x... addresses get verified/honeypot badge" />
          <Toggle value={s.contractScanner} onChange={(v) => u('contractScanner', v)} color="#f59e0b" />
        </Row>
        <Row>
          <RowLabel label="Smart Macros" sub="/add sends your wallet address + QR code" />
          <Toggle value={s.smartMacros} onChange={(v) => u('smartMacros', v)} color="#f59e0b" />
        </Row>
        <Row isLast>
          <RowLabel label="Attestation Badges" sub="Show ZK-verified score on messages" />
          <Toggle value={s.showAttestationBadge} onChange={(v) => u('showAttestationBadge', v)} color="#f59e0b" />
        </Row>
      </Card>

      <SectionLabel>Network & Gas</SectionLabel>
      <Card>
        <Row>
          <RowLabel label="Gas Preset" />
          <Chips
            options={[
              { val: 'ECONOMY', label: '🐢 Eco' },
              { val: 'STANDARD', label: '🚗 Std' },
              { val: 'FAST', label: '🏎 Fast' },
              { val: 'INSTANT', label: '⚡ Now' },
            ]}
            value={s.gasPreset}
            onChange={(v) => u('gasPreset', v as any)}
            color="#f59e0b"
          />
        </Row>
        <Row isLast>
          <RowLabel label="MEV Protection" sub="Protect swaps from front running bots" />
          <Toggle value={s.mevProtection} onChange={(v) => u('mevProtection', v)} color="#f59e0b" />
        </Row>
      </Card>
    </div>
  );
}

function AiPanel({ s, u }: { s: SystemSettings; u: <K extends keyof SystemSettings>(k: K, v: SystemSettings[K]) => void }) {
  return (
    <div>
      <SectionLabel>Ghost AI</SectionLabel>
      <Card>
        <Row>
          <RowLabel label="Tone Translator" sub="Convert angry messages to diplomatic before sending" />
          <Toggle value={s.toneTranslator} onChange={(v) => u('toneTranslator', v)} color="#10b981" />
        </Row>
        <Row isLast>
          <RowLabel label="Ghost Auto-Reply" sub="Reply automatically when you're away" />
          <Toggle value={s.ghostAutoReply} onChange={(v) => u('ghostAutoReply', v)} color="#10b981" />
        </Row>
      </Card>

      {s.ghostAutoReply && (
        <>
          <SectionLabel>Auto-Reply Message</SectionLabel>
          <Card>
            <div className="px-4 py-3">
              <textarea
                value={s.ghostAutoReplyText}
                onChange={(e) => u('ghostAutoReplyText', e.target.value)}
                rows={3}
                maxLength={280}
                placeholder="The Ledger is away..."
                className="w-full bg-transparent text-[14px] text-white/80 placeholder-white/20 resize-none outline-none leading-relaxed"
              />
              <p className="text-[11px] text-white/30 text-right mt-1">{s.ghostAutoReplyText.length}/280</p>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function IdentityPanel({ s, u }: { s: SystemSettings; u: <K extends keyof SystemSettings>(k: K, v: SystemSettings[K]) => void }) {
  return (
    <div>
      <SectionLabel>Profile</SectionLabel>
      <Card>
        <Row>
          <RowLabel label="Display Name" />
          <input
            value={s.chatName}
            onChange={(e) => u('chatName', e.target.value)}
            maxLength={30}
            className="bg-transparent text-right text-[15px] text-white/80 outline-none w-36 placeholder-white/25"
            placeholder="Ledger User"
          />
        </Row>
        <Row isLast>
          <RowLabel label="Bio" />
          <input
            value={s.chatBio}
            onChange={(e) => u('chatBio', e.target.value)}
            maxLength={80}
            className="bg-transparent text-right text-[13px] text-white/60 outline-none w-36 placeholder-white/25"
            placeholder="Your bio..."
          />
        </Row>
      </Card>
    </div>
  );
}

function NetworkPanel({ s, u }: { s: SystemSettings; u: <K extends keyof SystemSettings>(k: K, v: SystemSettings[K]) => void }) {
  return (
    <div>
      <SectionLabel>Mode</SectionLabel>
      <Card>
        <Row>
          <RowLabel label="Testnet Mode" sub="Use test networks only" />
          <Toggle value={s.testnetMode} onChange={(v) => u('testnetMode', v)} color="#06b6d4" />
        </Row>
        <Row isLast>
          <RowLabel label="Max Slippage" sub={`${s.maxSlippage}%`} />
          <input
            type="range" min={0.1} max={5} step={0.1} value={s.maxSlippage}
            onChange={(e) => u('maxSlippage', parseFloat(e.target.value))}
            className="w-24 accent-cyan-500"
          />
        </Row>
      </Card>

      <SectionLabel>Custom RPC</SectionLabel>
      <Card>
        <Row isLast>
          <input
            value={s.customRpcUrl}
            onChange={(e) => u('customRpcUrl', e.target.value)}
            placeholder="https://..."
            className="bg-transparent text-[13px] text-white/70 outline-none w-full placeholder-white/25"
          />
        </Row>
      </Card>
    </div>
  );
}

function AlertsPanel({ s, u }: { s: SystemSettings; u: <K extends keyof SystemSettings>(k: K, v: SystemSettings[K]) => void }) {
  return (
    <div>
      <SectionLabel>Channels</SectionLabel>
      <Card>
        <Row>
          <RowLabel label="Audio Alerts" sub="Sound when a ledger move is detected" />
          <Toggle value={s.audioAlerts} onChange={(v) => u('audioAlerts', v)} color="#f97316" />
        </Row>
        <Row>
          <RowLabel label="Email Alerts" />
          <Toggle value={s.emailAlerts} onChange={(v) => u('emailAlerts', v)} color="#f97316" />
        </Row>
        <Row isLast>
          <RowLabel label="Telegram Alerts" />
          <Toggle value={s.telegramAlerts} onChange={(v) => u('telegramAlerts', v)} color="#f97316" />
        </Row>
      </Card>

      <SectionLabel>Thresholds</SectionLabel>
      <Card>
        <Row isLast>
          <RowLabel label="Ledger Alert" sub="Alert when move exceeds this value (USD)" />
          <Chips
            options={[
              { val: 100000, label: '$100K' },
              { val: 500000, label: '$500K' },
              { val: 1000000, label: '$1M' },
              { val: 10000000, label: '$10M' },
            ]}
            value={s.ledgerAlertThreshold}
            onChange={(v) => u('ledgerAlertThreshold', v)}
            color="#f97316"
          />
        </Row>
      </Card>
    </div>
  );
}

// ── Main Modal ─────────────────────────────────────────────────────────────────

export default function AdvancedSettingsModal({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<TabId>('vibes');
  const store = useSettingsStore();
  const s = store as unknown as SystemSettings;
  const u = store.updateSetting;

  const activeTabDef = TABS.find(t => t.id === activeTab)!;

  const panelMap: Record<TabId, React.ReactNode> = {
    vibes:    <VibesPanel s={s} u={u} />,
    security: <SecurityPanel s={s} u={u} />,
    audio:    <AudioPanel s={s} u={u} />,
    defi:     <DefiPanel s={s} u={u} />,
    ai:       <AiPanel s={s} u={u} />,
    identity: <IdentityPanel s={s} u={u} />,
    network:  <NetworkPanel s={s} u={u} />,
    alerts:   <AlertsPanel s={s} u={u} />,
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(20px)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[780px] max-h-[88vh] flex flex-col rounded-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, rgba(18,18,28,0.98) 0%, rgba(10,10,20,0.99) 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05) inset',
        }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0"
             style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                 style={{ background: activeTabDef.color, boxShadow: `0 0 16px ${activeTabDef.color}66` }}>
              {activeTabDef.icon}
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-white tracking-tight">Settings</h2>
              <p className="text-[11px] text-white/35">{activeTabDef.label}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition active:scale-90"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            <X size={15} color="rgba(255,255,255,0.7)" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* ── Sidebar ── */}
          <div className="w-[200px] shrink-0 py-3 overflow-y-auto hidden md:block"
               style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className="w-full flex items-center gap-3 px-4 py-2.5 transition-all duration-150 relative"
                style={{ color: activeTab === t.id ? t.color : 'rgba(255,255,255,0.45)' }}
              >
                {activeTab === t.id && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-xl mx-2"
                    style={{ background: `${t.color}18`, border: `1px solid ${t.color}33` }}
                    transition={{ duration: 0.2 }}
                  />
                )}
                <span className="relative z-10">{t.icon}</span>
                <span className="relative z-10 text-[13px] font-medium">{t.label}</span>
              </button>
            ))}
          </div>

          {/* ── Mobile horizontal tab bar ── */}
          <div className="md:hidden flex gap-2 px-4 py-2 overflow-x-auto shrink-0 w-full"
               style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all"
                style={{
                  background: activeTab === t.id ? t.color : 'rgba(255,255,255,0.07)',
                  color: activeTab === t.id ? '#fff' : 'rgba(255,255,255,0.5)',
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* ── Content Panel ── */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                {panelMap[activeTab]}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
