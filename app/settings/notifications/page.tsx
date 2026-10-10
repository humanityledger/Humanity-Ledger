'use client';
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bell, BellOff, MessageSquare, Users, Zap, Moon, Sun,
  Clock, Shield, Volume2, VolumeX, ChevronRight, CheckCircle2, X
} from 'lucide-react';
import { toast } from 'sonner';

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`w-[48px] h-[28px] rounded-full p-0.5 transition-colors duration-300 shrink-0 ${enabled ? 'bg-[#25D366]' : 'bg-black/10'}`}
    >
      <motion.div
        animate={{ x: enabled ? 20 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="w-[24px] h-[24px] bg-white rounded-full shadow"
      />
    </button>
  );
}

function SettingRow({ label, desc, enabled, onChange }: { label: string; desc?: string; enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-black/[0.05] last:border-0">
      <div className="flex-1 pr-4">
        <p className="text-[15px] font-medium text-[#1C1C1E]">{label}</p>
        {desc && <p className="text-[12px] text-black/40 mt-0.5">{desc}</p>}
      </div>
      <Toggle enabled={enabled} onChange={onChange} />
    </div>
  );
}

const DND_OPTIONS = [
  { label: 'Off', value: 'off' },
  { label: '1 hour', value: '1h' },
  { label: '8 hours', value: '8h' },
  { label: 'Until tomorrow', value: 'tomorrow' },
  { label: 'Custom', value: 'custom' },
];

const SOUND_OPTIONS = [
  { label: 'Default', value: 'default' },
  { label: 'Ping', value: 'ping' },
  { label: 'Chord', value: 'chord' },
  { label: 'None', value: 'none' },
];

export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState({
    masterEnabled: true,
    messages: true,
    mentions: true,
    communityUpdates: true,
    newMembers: false,
    payments: true,
    announcements: true,
    bots: false,
    soundEnabled: true,
    vibration: true,
    preview: true,
    badge: true,
    groupByApp: true,
    criticalAlerts: false,
  });

  const [dnd, setDnd] = useState('off');
  const [sound, setSound] = useState('default');
  const [saved, setSaved] = useState(false);

  const update = (key: keyof typeof settings) => (val: boolean) => {
    setSettings(prev => ({ ...prev, [key]: val }));
    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
    toast.success('Notification preferences saved');
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      {/* Header */}
      <div className="bg-white/95 backdrop-blur-md border-b border-black/[0.06] sticky top-0 z-20">
        <div className="max-w-xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-[17px] font-black text-[#1C1C1E]">Notifications</h1>
          <button onClick={handleSave}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-bold transition-all ${saved ? 'bg-[#25D366]/15 text-[#25D366]' : 'bg-[#25D366] text-white hover:bg-[#128C7E]'}`}>
            {saved ? <><CheckCircle2 size={13}/> Saved</> : 'Save'}
          </button>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-4">

        {/* Master toggle */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-5 shadow-sm border border-black/[0.06]">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${settings.masterEnabled ? 'bg-[#25D366]/10' : 'bg-black/5'}`}>
              {settings.masterEnabled ? <Bell size={18} className="text-[#25D366]" /> : <BellOff size={18} className="text-black/30" />}
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-bold text-[#1C1C1E]">Allow Notifications</p>
              <p className="text-[12px] text-black/40">Master switch for all Humanity Ledger notifications</p>
            </div>
            <Toggle enabled={settings.masterEnabled} onChange={update('masterEnabled')} />
          </div>

          {!settings.masterEnabled && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 flex items-center gap-2">
              <BellOff size={14} className="text-amber-600 shrink-0" />
              <p className="text-[12px] text-amber-700 font-medium">All notifications are disabled. You may miss important messages and payments.</p>
            </div>
          )}
        </motion.div>

        {/* Do Not Disturb */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-white rounded-3xl p-5 shadow-sm border border-black/[0.06]">
          <div className="flex items-center gap-2 mb-4">
            <Moon size={14} className="text-purple-500" />
            <h2 className="text-[13px] font-black uppercase tracking-widest text-black/40">Do Not Disturb</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {DND_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setDnd(opt.value)}
                className={`py-2.5 px-3 rounded-2xl text-[13px] font-bold transition-all text-left ${dnd === opt.value ? 'bg-[#1C1C1E] text-white' : 'bg-[#F2F2F7] text-black/50 hover:bg-[#E5E5EA]'}`}>
                {opt.label}
              </button>
            ))}
          </div>
          {dnd !== 'off' && (
            <p className="text-[12px] text-purple-500 font-semibold mt-3 flex items-center gap-1">
              <Moon size={11} /> DND active — notifications silenced until {dnd === '1h' ? '1 hour from now' : dnd === '8h' ? '8 hours from now' : 'tomorrow morning'}
            </p>
          )}
        </motion.div>

        {/* Message notifications */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white rounded-3xl px-5 shadow-sm border border-black/[0.06]">
          <div className="flex items-center gap-2 py-4 border-b border-black/5">
            <MessageSquare size={14} className="text-[#25D366]" />
            <h2 className="text-[13px] font-black uppercase tracking-widest text-black/40">Messages</h2>
          </div>
          <SettingRow label="Direct Messages" desc="New messages in your inbox" enabled={settings.messages} onChange={update('messages')} />
          <SettingRow label="Mentions" desc="When someone @mentions you" enabled={settings.mentions} onChange={update('mentions')} />
          <SettingRow label="Payment Received" desc="When crypto arrives in your wallet" enabled={settings.payments} onChange={update('payments')} />
        </motion.div>

        {/* Community notifications */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-white rounded-3xl px-5 shadow-sm border border-black/[0.06]">
          <div className="flex items-center gap-2 py-4 border-b border-black/5">
            <Users size={14} className="text-[#007AFF]" />
            <h2 className="text-[13px] font-black uppercase tracking-widest text-black/40">Communities</h2>
          </div>
          <SettingRow label="Community Updates" desc="Channel messages in communities you're in" enabled={settings.communityUpdates} onChange={update('communityUpdates')} />
          <SettingRow label="Announcements" desc="Important announcements from admins" enabled={settings.announcements} onChange={update('announcements')} />
          <SettingRow label="New Members" desc="When someone joins a community you own" enabled={settings.newMembers} onChange={update('newMembers')} />
          <SettingRow label="Bot Messages" desc="Automated messages from bots" enabled={settings.bots} onChange={update('bots')} />
        </motion.div>

        {/* Sound & Haptics */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-white rounded-3xl px-5 shadow-sm border border-black/[0.06]">
          <div className="flex items-center gap-2 py-4 border-b border-black/5">
            <Volume2 size={14} className="text-[#FF9500]" />
            <h2 className="text-[13px] font-black uppercase tracking-widest text-black/40">Sound & Haptics</h2>
          </div>
          <SettingRow label="Sound" desc="Play a sound for notifications" enabled={settings.soundEnabled} onChange={update('soundEnabled')} />
          <SettingRow label="Vibration" desc="Vibrate on notifications (mobile)" enabled={settings.vibration} onChange={update('vibration')} />

          {settings.soundEnabled && (
            <div className="py-4">
              <p className="text-[14px] font-medium text-[#1C1C1E] mb-3">Notification Sound</p>
              <div className="flex gap-2 flex-wrap">
                {SOUND_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setSound(opt.value)}
                    className={`px-4 py-2 rounded-xl text-[13px] font-bold transition-colors ${sound === opt.value ? 'bg-[#25D366] text-white' : 'bg-[#F2F2F7] text-black/50 hover:bg-[#E5E5EA]'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Display */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="bg-white rounded-3xl px-5 shadow-sm border border-black/[0.06]">
          <div className="flex items-center gap-2 py-4 border-b border-black/5">
            <Zap size={14} className="text-purple-500" />
            <h2 className="text-[13px] font-black uppercase tracking-widest text-black/40">Display</h2>
          </div>
          <SettingRow label="Show Preview" desc="Show message content in notifications" enabled={settings.preview} onChange={update('preview')} />
          <SettingRow label="Badge Count" desc="Show unread count on app icon" enabled={settings.badge} onChange={update('badge')} />
          <SettingRow label="Group by Community" desc="Group notifications by community" enabled={settings.groupByApp} onChange={update('groupByApp')} />
          <SettingRow label="Critical Alerts" desc="Override DND for payment and security alerts" enabled={settings.criticalAlerts} onChange={update('criticalAlerts')} />
        </motion.div>

        {/* Privacy notice */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-[#25D366]/5 rounded-3xl p-5 border border-[#25D366]/15">
          <div className="flex items-start gap-3">
            <Shield size={16} className="text-[#25D366] shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-bold text-[#25D366] mb-1">Privacy-preserving notifications</p>
              <p className="text-[12px] text-black/50 leading-relaxed">
                Humanity Ledger pushes notifications without revealing message content to our servers. 
                Only an encrypted signal is sent — your messages stay private end-to-end.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Save button */}
        <button onClick={handleSave}
          className="w-full py-4 bg-[#1C1C1E] text-white font-black text-[16px] rounded-3xl hover:bg-black transition-colors active:scale-[0.98]">
          Save Preferences
        </button>

        <p className="text-[11px] text-black/25 text-center pb-8">
          Notification preferences are stored locally on your device.
        </p>
      </div>
    </div>
  );
}
