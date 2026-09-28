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

export const LedgerSettingsFull: React.FC<LedgerSettingsFullProps> = ({ myAddress, myName, onClose }) => {
  const [toast, setToast] = useState<string | null>(null);
  const [modal, setModal] = useState<string | null>(null);

  // Settings State mapped directly to localStorage to ensure it WORKS
  const [settings, setSettings] = useState({
    securityNotifs: true,
    requireSignature: true,
    zkObfuscation: true,
    readReceipts: false,
    burnOnRead: 'off',
    theme: 'Minimal',
    relayMode: 'xmtp_production'
  });

  useEffect(() => {
    // Load from local storage
    const load = (key: string, def: any) => {
      const v = localStorage.getItem(`ledger_global_${key}`);
      if (v === null) return def;
      if (v === 'true') return true;
      if (v === 'false') return false;
      return v;
    };
    
    setSettings({
      securityNotifs: load('securityNotifs', true),
      requireSignature: load('requireSignature', true),
      zkObfuscation: load('zkObfuscation', true),
      readReceipts: load('readReceipts', false),
      burnOnRead: load('burnOnRead', 'off'),
      theme: load('theme', 'Minimal'),
      relayMode: load('relayMode', 'xmtp_production')
    });
  }, []);

  const updateSetting = (key: keyof typeof settings, val: any) => {
    setSettings(prev => ({ ...prev, [key]: val }));
    localStorage.setItem(`ledger_global_${key}`, String(val));
    showToast(`Configuration updated: ${key}`);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const clearCache = () => {
    // We only clear non-critical local cache
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('ledger_cache_')) {
        localStorage.removeItem(key);
      }
    }
    showToast('Local cache expunged');
    setModal(null);
  };

  const nukeState = () => {
    // Hard delete of all ledger settings
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith('ledger_')) {
        localStorage.removeItem(key);
      }
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
      className="absolute inset-0 z-[200] bg-[#FAFAFA] flex flex-col overflow-y-auto font-sans"
    >
      <div className="sticky top-0 z-10 bg-[#FAFAFA]/90 backdrop-blur-lg border-b border-black/10 px-6 py-4 flex items-center justify-between">
        <button onClick={onClose} className="p-2 -ml-2 text-black/50 hover:text-black transition-colors">
          <ArrowLeft size={20} />
        </button>
        <span className="text-[11px] font-mono tracking-[0.2em] uppercase font-bold text-black">Global Configuration</span>
        <div className="w-8" />
      </div>

      <div className="p-8 pb-12 flex flex-col max-w-2xl mx-auto w-full">
        <div className="mb-12 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-black flex items-center justify-center mb-4 shadow-2xl relative">
             <span className="text-2xl font-serif italic text-white z-10">
               {myName ? myName.slice(0,2).toUpperCase() : '0X'}
             </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight mb-1 text-black">{myName || 'Identity Node'}</h2>
          <p className="text-[11px] font-mono text-black/40 break-all">{myAddress}</p>
        </div>

        <Section title="Cryptographic Identity">
          <Row icon={<User size={16} />} label="Node Designation" value={myName || "Unnamed"} onTap={() => showToast("Node designation is bound to ENS/Web3 domain.")} />
          <Row icon={<Key size={16} />} label="Export ECDH Key" onTap={() => setModal('exportKey')} />
          <Row icon={<Shield size={16} />} label="Require Signature for Access" toggle={settings.requireSignature} onToggle={(v) => updateSetting('requireSignature', v)} />
        </Section>

        <Section title="Zero-Knowledge Privacy">
          <Row icon={<Lock size={16} />} label="ZK Graph Obfuscation" toggle={settings.zkObfuscation} onToggle={(v) => updateSetting('zkObfuscation', v)} />
          <Row icon={<Eye size={16} />} label="Broadcast Read Receipts" toggle={settings.readReceipts} onToggle={(v) => updateSetting('readReceipts', v)} />
          <Row icon={<Trash2 size={16} />} label="Global Burn-on-Read" value={settings.burnOnRead} onTap={() => setModal('burnOnRead')} />
        </Section>

        <Section title="Network Transport (XMTP)">
          <Row icon={<Database size={16} />} label="Relay Node" value={settings.relayMode} onTap={() => setModal('relay')} />
          <Row icon={<Bell size={16} />} label="Security Telemetry" toggle={settings.securityNotifs} onToggle={(v) => updateSetting('securityNotifs', v)} />
        </Section>

        <Section title="Interface & Storage">
          <Row icon={<Palette size={16} />} label="Terminal Aesthetic" value={settings.theme} onTap={() => setModal('theme')} />
          <Row icon={<Database size={16} />} label="Purge Local Cache" onTap={() => setModal('clearCache')} />
        </Section>

        <Section title="Danger Zone">
          <Row icon={<X size={16} />} label="Obliterate All State" danger onTap={() => setModal('nuke')} />
        </Section>
      </div>

      {toast && (
        <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white px-6 py-3 font-mono text-[11px] uppercase tracking-widest z-[400] whitespace-nowrap shadow-2xl">
          {toast}
        </motion.div>
      )}

      {/* Modals */}
      {modal === 'exportKey' && (
        <Modal title="Export ECDH Key" onClose={() => setModal(null)}>
          <div className="flex flex-col gap-6 items-center text-center py-4">
            <Shield size={32} className="text-red-500 mb-2" />
            <p className="text-[12px] font-bold uppercase text-red-500">Security Warning</p>
            <p className="text-[12px] font-mono text-black/60 leading-relaxed">
              Exporting your raw key circumvents the hardware enclave. Anyone with this payload can spoof your identity on the XMTP network.
            </p>
            <button onClick={() => showToast('Action blocked: Enclave strictly enforces non-exportability.')} className="w-full py-4 border border-black hover:bg-black hover:text-white transition-colors text-[11px] font-bold uppercase tracking-widest">
              Force Extraction
            </button>
          </div>
        </Modal>
      )}

      {modal === 'burnOnRead' && (
        <Modal title="Global Burn-on-Read" onClose={() => setModal(null)}>
          <div className="flex flex-col gap-3">
            {['off', '24h', '7d', '90d'].map(opt => (
              <button key={opt} onClick={() => { updateSetting('burnOnRead', opt); setModal(null); }} className={`p-4 border text-[12px] font-mono uppercase tracking-widest text-left ${settings.burnOnRead === opt ? 'border-black bg-black text-white' : 'border-black/20 text-black hover:border-black'}`}>
                {opt === 'off' ? 'Disabled' : `${opt} Obliteration`}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {modal === 'relay' && (
        <Modal title="Decentralized Relay Node" onClose={() => setModal(null)}>
          <div className="flex flex-col gap-3">
            {['xmtp_production', 'xmtp_dev', 'local_mesh'].map(opt => (
              <button key={opt} onClick={() => { updateSetting('relayMode', opt); setModal(null); }} className={`p-4 border text-[12px] font-mono uppercase tracking-widest text-left ${settings.relayMode === opt ? 'border-black bg-black text-white' : 'border-black/20 text-black hover:border-black'}`}>
                {opt}
              </button>
            ))}
            <p className="text-[10px] font-mono text-black/40 mt-4 text-center">Changing relay modes will require a network reconnection.</p>
          </div>
        </Modal>
      )}

      {modal === 'theme' && (
        <Modal title="Terminal Aesthetic" onClose={() => setModal(null)}>
          <div className="grid grid-cols-2 gap-4">
            {['Minimal', 'Terminal', 'OLED Black', 'Cyber'].map(t => (
              <button key={t} onClick={() => { updateSetting('theme', t); setModal(null); }} className={`p-4 border text-[12px] font-mono uppercase tracking-widest ${settings.theme === t ? 'border-black bg-black text-white' : 'border-black/20 text-black hover:border-black'}`}>
                {t}
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
