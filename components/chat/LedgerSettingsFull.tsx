'use client';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Lock, Shield, Eye, Bell, Database, Palette, Key, Trash2, X, ChevronRight, User
} from 'lucide-react';

interface LedgerSettingsFullProps {
  myAddress: string;
  myName?: string;
  onClose: () => void;
}

// Custom Minimalist Toggle
const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <button
    onClick={() => onChange(!value)}
    className={`w-10 h-5 border border-black rounded-none flex items-center p-0.5 transition-colors ${value ? 'bg-black' : 'bg-transparent'}`}
  >
    <div className={`w-3.5 h-3.5 bg-current transition-transform ${value ? 'translate-x-5 text-white' : 'translate-x-0 text-black'}`} />
  </button>
);

const Row = ({ icon, label, value, onTap, danger = false, toggle, onToggle }: {
  icon: React.ReactNode; label: string; value?: string;
  onTap?: () => void; danger?: boolean;
  toggle?: boolean; onToggle?: (v: boolean) => void;
}) => (
  <button
    onClick={onTap}
    className={`w-full flex items-center justify-between py-4 border-b border-black/10 group ${onTap || onToggle !== undefined ? 'hover:border-black transition-colors' : ''} text-left`}
  >
    <div className="flex items-center gap-4">
      <span className={`shrink-0 ${danger ? 'text-red-500' : 'text-black/40 group-hover:text-black transition-colors'}`}>{icon}</span>
      <span className={`text-[13px] font-bold uppercase tracking-wider ${danger ? 'text-red-500' : 'text-black'}`}>{label}</span>
    </div>
    <div className="flex items-center gap-3">
      {value && <span className="text-[12px] font-mono text-black/50">{value}</span>}
      {onToggle !== undefined && toggle !== undefined ? (
        <Toggle value={toggle} onChange={onToggle} />
      ) : onTap ? (
        <ChevronRight size={14} className="text-black/20 group-hover:text-black transition-colors shrink-0" />
      ) : null}
    </div>
  </button>
);

const Section = ({ title, children }: { title?: string; children: React.ReactNode }) => (
  <div className="mb-12">
    {title && <p className="mb-4 text-[10px] font-mono uppercase tracking-[0.2em] text-black/40">{title}</p>}
    <div className="flex flex-col">
      {children}
    </div>
  </div>
);

const Modal = ({ title, onClose, children }: { title: string, onClose: () => void, children: React.ReactNode }) => (
  <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-white/80 backdrop-blur-md">
    <div className="bg-white border border-black w-full max-w-md flex flex-col max-h-[80vh] shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
      <div className="flex items-center justify-between p-5 border-b border-black bg-[#F8F8F8]">
        <h3 className="font-bold uppercase tracking-widest text-[13px]">{title}</h3>
        <button onClick={onClose} className="p-1 hover:bg-black hover:text-white transition-colors"><X size={18} /></button>
      </div>
      <div className="p-6 overflow-y-auto">
        {children}
      </div>
    </div>
  </div>
);

import { useLedgerSettings } from '../terminal/LedgerChatSettings';

export const LedgerSettingsFull: React.FC<LedgerSettingsFullProps> = ({ myAddress, myName, onClose }) => {
  const [toast, setToast] = useState<string | null>(null);
  const [modal, setModal] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'privacy'|'security'|'notifications'|'ai'|'network'>('privacy');

  const { settings, updateSetting, updateBatch } = useLedgerSettings(myAddress);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const clearCache = () => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('ledger_cache_')) localStorage.removeItem(key);
    }
    showToast('Local cache expunged');
    setModal(null);
  };

  const nukeState = () => {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith('ledger_')) localStorage.removeItem(key);
    }
    showToast('State completely obliterated');
    setModal(null);
    setTimeout(() => window.location.reload(), 1500);
  };

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'tween', duration: 0.3, ease: 'easeInOut' }}
      className="absolute inset-0 z-[200] bg-[#FAFAFA] flex flex-col font-sans"
    >
      <div className="sticky top-0 z-10 bg-[#FAFAFA]/90 backdrop-blur-lg border-b border-black/10 px-6 py-4 flex items-center justify-between shrink-0">
        <button onClick={onClose} className="p-2 -ml-2 text-black/50 hover:text-black transition-colors">
          <ArrowLeft size={20} />
        </button>
        <span className="text-[11px] font-mono tracking-[0.2em] uppercase font-bold text-black">Settings</span>
        <div className="w-8" />
      </div>

      <div className="flex border-b border-black/10 overflow-x-auto shrink-0 hide-scrollbar bg-white">
        {[
          { id: 'privacy', label: 'Privacy' },
          { id: 'security', label: 'Security' },
          { id: 'notifications', label: 'Alerts' },
          { id: 'ai', label: 'AI & Tools' },
          { id: 'network', label: 'Network' }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-6 py-4 text-[11px] font-mono uppercase tracking-widest whitespace-nowrap transition-colors ${activeTab === tab.id ? 'border-b-2 border-black text-black font-bold' : 'text-black/40 hover:text-black'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-8 pb-12">
        <div className="max-w-2xl mx-auto w-full">
          {activeTab === 'privacy' && (
            <>
              <Section title="Visibility">
                <Row icon={<Eye size={16} />} label="Last Seen" value={settings.privacy_last_seen} onTap={() => setModal('privacy_last_seen')} />
                <Row icon={<User size={16} />} label="Profile Photo" value={settings.privacy_profile_photo} onTap={() => setModal('privacy_profile_photo')} />
                <Row icon={<Eye size={16} />} label="Biography" value={settings.privacy_bio} onTap={() => setModal('privacy_bio')} />
                <Row icon={<Shield size={16} />} label="Group Invites" value={settings.privacy_group_invites} onTap={() => setModal('privacy_group_invites')} />
              </Section>
              <Section title="Self-Destruct & Logs">
                <Row icon={<Trash2 size={16} />} label="Auto-Delete Timer" value={settings.auto_delete_timer} onTap={() => setModal('auto_delete')} />
                <Row icon={<Lock size={16} />} label="Burn on Read" toggle={settings.burn_on_read} onToggle={(v) => updateSetting('burn_on_read', v)} />
                <Row icon={<Shield size={16} />} label="Anti-Screenshot" toggle={settings.anti_screenshot} onToggle={(v) => updateSetting('anti_screenshot', v)} />
              </Section>
            </>
          )}

          {activeTab === 'security' && (
            <>
              <Section title="Cryptography & Hardware">
                <Row icon={<Lock size={16} />} label="Biometric Lock" toggle={settings.biometric_lock} onToggle={(v) => updateSetting('biometric_lock', v)} />
                <Row icon={<Key size={16} />} label="App Passcode" toggle={settings.passcode_enabled} onToggle={(v) => updateSetting('passcode_enabled', v)} />
                <Row icon={<Shield size={16} />} label="ZK Obfuscation" toggle={settings.zkObfuscation} onToggle={(v) => updateSetting('zkObfuscation', v)} />
                <Row icon={<Lock size={16} />} label="Require Signature" toggle={settings.requireSignature} onToggle={(v) => updateSetting('requireSignature', v)} />
              </Section>
              <Section title="Network Transport">
                <Row icon={<Shield size={16} />} label="WebRTC IP Masking" toggle={settings.webrtc_ip_masking} onToggle={(v) => updateSetting('webrtc_ip_masking', v)} />
                <Row icon={<Database size={16} />} label="Tor Onion Hops" value={settings.onion_hops.toString()} onTap={() => setModal('onion_hops')} />
              </Section>
              <Section title="Danger Zone">
                <Row icon={<Database size={16} />} label="Purge Local Cache" onTap={() => setModal('clearCache')} />
                <Row icon={<X size={16} />} label="Obliterate All State" danger onTap={() => setModal('nuke')} />
              </Section>
            </>
          )}

          {activeTab === 'notifications' && (
            <>
              <Section title="Alerts & Sounds">
                <Row icon={<Bell size={16} />} label="Private Messages" toggle={settings.notifications_private} onToggle={(v) => updateSetting('notifications_private', v)} />
                <Row icon={<Bell size={16} />} label="Group Messages" toggle={settings.notifications_groups} onToggle={(v) => updateSetting('notifications_groups', v)} />
                <Row icon={<Bell size={16} />} label="Workspaces" toggle={settings.notifications_workspaces} onToggle={(v) => updateSetting('notifications_workspaces', v)} />
                <Row icon={<Bell size={16} />} label="Badge Count" toggle={settings.badge_count} onToggle={(v) => updateSetting('badge_count', v)} />
                <Row icon={<Bell size={16} />} label="Notification Sound" toggle={settings.notification_sound} onToggle={(v) => updateSetting('notification_sound', v)} />
                <Row icon={<Palette size={16} />} label="Sound Pack" value={settings.sound_pack} onTap={() => setModal('sound_pack')} />
              </Section>
              <Section title="Haptics & Feedback">
                <Row icon={<Lock size={16} />} label="Mechanical Keyboard" toggle={settings.mechanical_keyboard} onToggle={(v) => updateSetting('mechanical_keyboard', v)} />
                <Row icon={<Lock size={16} />} label="Haptics Intensity" value={settings.haptics_intensity.toString()} onTap={() => setModal('haptics')} />
              </Section>
            </>
          )}

          {activeTab === 'ai' && (
            <>
              <Section title="Aegis AI Core">
                <Row icon={<Shield size={16} />} label="Tone Translator" toggle={settings.tone_translator} onToggle={(v) => updateSetting('tone_translator', v)} />
                <Row icon={<User size={16} />} label="Ghost Auto-Reply" toggle={settings.ghost_auto_reply} onToggle={(v) => updateSetting('ghost_auto_reply', v)} />
              </Section>
              <Section title="Smart Tools">
                <Row icon={<Key size={16} />} label="Smart Macros" toggle={settings.smart_macros} onToggle={(v) => updateSetting('smart_macros', v)} />
                <Row icon={<Eye size={16} />} label="Ticker Widgets ($)" toggle={settings.ticker_widgets} onToggle={(v) => updateSetting('ticker_widgets', v)} />
                <Row icon={<Shield size={16} />} label="Contract Scanner" toggle={settings.contract_scanner} onToggle={(v) => updateSetting('contract_scanner', v)} />
                <Row icon={<User size={16} />} label="Attestation Badges" toggle={settings.show_attestation_badge} onToggle={(v) => updateSetting('show_attestation_badge', v)} />
              </Section>
            </>
          )}

          {activeTab === 'network' && (
            <>
              <Section title="Blockchain Options">
                <Row icon={<Shield size={16} />} label="Gas Preset" value={settings.gas_preset} onTap={() => setModal('gas_preset')} />
                <Row icon={<Lock size={16} />} label="MEV Protection" toggle={settings.mev_protection} onToggle={(v) => updateSetting('mev_protection', v)} />
                <Row icon={<Database size={16} />} label="Custom RPC" value={settings.custom_rpc_url || "Default"} onTap={() => setModal('custom_rpc')} />
              </Section>
              <Section title="Data & Media">
                <Row icon={<Eye size={16} />} label="Low Data Mode" toggle={settings.useLessData} onToggle={(v) => updateSetting('useLessData', v)} />
                <Row icon={<Database size={16} />} label="Save to Photos" toggle={settings.saveToPhotos} onToggle={(v) => updateSetting('saveToPhotos', v)} />
              </Section>
            </>
          )}
        </div>
      </div>

      {toast && (
        <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white px-6 py-3 font-mono text-[11px] uppercase tracking-widest z-[400] whitespace-nowrap shadow-2xl">
          {toast}
        </motion.div>
      )}

      {/* Dynamic Selector Modal */}
      {modal && ['privacy_last_seen', 'privacy_profile_photo', 'privacy_bio', 'privacy_group_invites'].includes(modal) && (
        <Modal title="Privacy Selection" onClose={() => setModal(null)}>
          <div className="flex flex-col gap-3">
            {['everybody', 'contacts', 'nobody'].map(opt => (
              <button key={opt} onClick={() => { updateSetting(modal as any, opt); setModal(null); }} className={`p-4 border text-[12px] font-mono uppercase tracking-widest text-left ${(settings as any)[modal] === opt ? 'border-black bg-black text-white' : 'border-black/20 text-black hover:border-black'}`}>
                {opt}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {modal === 'auto_delete' && (
        <Modal title="Auto-Delete Timer" onClose={() => setModal(null)}>
          <div className="flex flex-col gap-3">
            {['off', '24 hours', '1 week', '1 month'].map(opt => (
              <button key={opt} onClick={() => { updateSetting('auto_delete_timer', opt); setModal(null); }} className={`p-4 border text-[12px] font-mono uppercase tracking-widest text-left ${settings.auto_delete_timer === opt ? 'border-black bg-black text-white' : 'border-black/20 text-black hover:border-black'}`}>
                {opt === 'off' ? 'Disabled' : opt}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {modal === 'sound_pack' && (
        <Modal title="Sound Pack" onClose={() => setModal(null)}>
          <div className="flex flex-col gap-3">
            {['minimal', 'arcade', 'ledger', 'asmr'].map(opt => (
              <button key={opt} onClick={() => { updateSetting('sound_pack', opt); setModal(null); }} className={`p-4 border text-[12px] font-mono uppercase tracking-widest text-left ${settings.sound_pack === opt ? 'border-black bg-black text-white' : 'border-black/20 text-black hover:border-black'}`}>
                {opt}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {modal === 'gas_preset' && (
        <Modal title="Gas Preset" onClose={() => setModal(null)}>
          <div className="flex flex-col gap-3">
            {['ECONOMY', 'STANDARD', 'FAST', 'INSTANT'].map(opt => (
              <button key={opt} onClick={() => { updateSetting('gas_preset', opt); setModal(null); }} className={`p-4 border text-[12px] font-mono uppercase tracking-widest text-left ${settings.gas_preset === opt ? 'border-black bg-black text-white' : 'border-black/20 text-black hover:border-black'}`}>
                {opt}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {modal === 'onion_hops' && (
        <Modal title="Tor Onion Hops" onClose={() => setModal(null)}>
          <div className="flex flex-col gap-3">
            {[1, 3, 5].map(opt => (
              <button key={opt} onClick={() => { updateSetting('onion_hops', opt); setModal(null); }} className={`p-4 border text-[12px] font-mono uppercase tracking-widest text-left ${settings.onion_hops === opt ? 'border-black bg-black text-white' : 'border-black/20 text-black hover:border-black'}`}>
                {opt} Hop{opt > 1 ? 's' : ''}
              </button>
            ))}
            <p className="text-[10px] text-black/50 text-center mt-2">Higher hops increase privacy but degrade call latency.</p>
          </div>
        </Modal>
      )}

      {modal === 'haptics' && (
        <Modal title="Haptic Intensity" onClose={() => setModal(null)}>
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3].map(opt => (
              <button key={opt} onClick={() => { updateSetting('haptics_intensity', opt); setModal(null); }} className={`p-4 border text-[12px] font-mono uppercase tracking-widest text-left ${settings.haptics_intensity === opt ? 'border-black bg-black text-white' : 'border-black/20 text-black hover:border-black'}`}>
                {opt === 0 ? 'Off' : `Level ${opt}`}
              </button>
            ))}
          </div>
        </Modal>
      )}


      {modal === 'clearCache' && (
        <Modal title="Purge Local Cache" onClose={() => setModal(null)}>
          <div className="flex flex-col gap-4 text-center py-4">
            <p className="text-[12px] font-mono text-black/60">This will clear temporary UI state and network caches. Cryptographic keys are safe.</p>
            <button onClick={clearCache} className="w-full py-4 border border-black hover:bg-black hover:text-white transition-colors text-[11px] font-bold uppercase tracking-widest mt-4">
              Execute Purge
            </button>
          </div>
        </Modal>
      )}

      {modal === 'nuke' && (
        <Modal title="Obliterate All State" onClose={() => setModal(null)}>
          <div className="flex flex-col gap-4 text-center py-4">
            <p className="text-[12px] font-mono text-red-500 font-bold uppercase tracking-widest">CRITICAL WARNING</p>
            <p className="text-[12px] font-mono text-black/60">This action permanently deletes all local application state, conversation history, and preferences. You will be logged out.</p>
            <button onClick={nukeState} className="w-full py-4 bg-red-500 text-white hover:bg-red-600 transition-colors text-[11px] font-bold uppercase tracking-widest mt-4">
              Confirm Obliteration
            </button>
          </div>
        </Modal>
      )}

    </motion.div>
  );
};
