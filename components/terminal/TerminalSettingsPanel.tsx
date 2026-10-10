"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettingsStore, SystemSettings } from '@/lib/store/useSettingsStore';
import { useSystemTranslation } from '@/hooks/useSystemTranslation';
import { Loader2, Shield, Scale, FileText, Lock, Globe, ExternalLink } from 'lucide-react';
import { useSystemSignOut } from '@/hooks/useSystemSignOut';
import { toast } from 'sonner';
import Link from 'next/link';
import { useAccount, useBalance } from 'wagmi';

// We will construct categories inside the component to use the hook.

export function TerminalSettingsPanel() {
  const store = useSettingsStore();
  const { t } = useSystemTranslation();
  const { isLoading, updateSetting, fetchSettings } = store;
  const [activeTab, setActiveTab] = useState('general');
  const { nuclearDisconnect } = useSystemSignOut();

  const CATEGORIES = [
    { id: 'account', label: 'Account' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'general', label: t('GENERAL_SETTINGS') },
    { id: 'display', label: t('APPEARANCE') },
    { id: 'privacy', label: t('PRIVACY_SECURITY') },
    { id: 'payments', label: 'Payments & Unlocks' },
    { id: 'legal', label: 'Legal & Regulatory' },
  ];

  const LEGAL_LINKS = [
    { href: '/legal/privacy',   icon: FileText, label: 'Privacy Policy (GDPR)',  desc: 'Data processing, right of erasure and ZKP anonymization protocol.' },
    { href: '/legal/terms',     icon: FileText, label: 'Terms & Conditions',      desc: 'Platform terms and utility token classification.' },
    { href: '/legal/security',  icon: Globe,    label: 'Security Architecture',   desc: 'Noir circuit audit status, key management and incident response policy.' },
    { href: 'https://github.com/humanityledger/Humanity-Ledger', icon: Lock, label: 'GitHub Repository', desc: 'Open source code — Ledger Chat P2P protocol on Aztec V5.' },
  ];

  const handleTotalDisconnect = async () => {
    await nuclearDisconnect();
  };

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const settings: SystemSettings = store as unknown as SystemSettings;

  if (isLoading) {
    return (
      <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-white">
        <Loader2 className="animate-spin text-black/20" size={32} />
      </div>
    );
  }

  const renderToggle = (key: keyof SystemSettings, label: string, desc: string) => {
    const isActive = !!settings[key];
    return (
      <div className="flex items-center justify-between p-6 bg-white border border-black/10 rounded-2xl hover:border-black/30 transition-all cursor-pointer select-none" onClick={() => updateSetting(key, !isActive as never)}>
         <div className="flex flex-col pr-6">
            <span className="text-[12px] font-black uppercase tracking-widest text-black">{label}</span>
            <span className="text-[10px] text-black/40 font-mono mt-1.5 leading-relaxed">{desc}</span>
         </div>
         <div className={`w-11 h-6 rounded-full flex items-center p-1 transition-colors duration-300 ${isActive ? 'bg-black' : 'bg-black/10'}`}>
            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${isActive ? 'translate-x-5' : 'translate-x-0'}`} />
         </div>
      </div>
    );
  };

  const renderSelect = (key: keyof SystemSettings, label: string, desc: string, options: {value: string, label: string}[]) => {
    const currentValue = settings[key] as string;
    return (
      <div className="flex flex-col p-6 bg-white border border-black/10 rounded-2xl hover:border-black/30 transition-all">
         <span className="text-[12px] font-black uppercase tracking-widest text-black mb-1.5">{label}</span>
         <span className="text-[10px] text-black/40 font-mono mb-5 leading-relaxed">{desc}</span>
         <div className="flex flex-col gap-2">
            {options.map(opt => {
               const isSelected = currentValue === opt.value;
               return (
                  <button 
                    key={opt.value}
                    onClick={() => updateSetting(key, opt.value as never)}
                    className={`w-full px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border text-left ${isSelected ? 'bg-black text-white border-black' : 'bg-transparent text-black/50 border-black/10 hover:border-black/30 hover:text-black'}`}
                  >
                     {opt.label}
                  </button>
               )
            })}
         </div>
      </div>
    );
  };

  const renderInput = (key: keyof SystemSettings, label: string, desc: string, type: 'number' | 'text' = 'text', suffix?: string) => {
    return (
      <div className="flex flex-col p-6 bg-white border border-black/10 rounded-2xl hover:border-black/30 transition-all">
         <span className="text-[12px] font-black uppercase tracking-widest text-black mb-1.5">{label}</span>
         <span className="text-[10px] text-black/40 font-mono mb-4 leading-relaxed">{desc}</span>
         <div className="relative">
            <input 
              type={type}
              value={settings[key] as any}
              onChange={(e) => {
                 let val: any = e.target.value;
                 if (type === 'number') val = parseFloat(val) || 0;
                 updateSetting(key, val as never);
              }}
              className="w-full bg-white border border-black/10 rounded-xl px-5 py-3 text-[12px] font-mono text-black focus:border-black focus:outline-none transition-colors"
            />
            {suffix && <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-widest text-black/30 pointer-events-none">{suffix}</span>}
         </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row w-full h-full bg-white overflow-hidden font-sans">
      
      {/* Sidebar */}
      <div className="w-full md:w-[320px] border-b md:border-b-0 md:border-r border-black/10 flex flex-col p-8 bg-white shrink-0 min-h-[400px]">
         <div className="flex flex-col mb-10 px-2">
            <span className="text-[14px] font-black uppercase tracking-widest text-black mb-1">{t('SETTINGS')}</span>
            <span className="text-[10px] font-mono text-black/30 uppercase tracking-widest">{t('PREFERENCES')}</span>
         </div>

         <div className="flex flex-col gap-3">
            {CATEGORIES.map(c => {
               const isActive = activeTab === c.id;
               return (
                 <button 
                   key={c.id} 
                   onClick={() => setActiveTab(c.id)}
                   className={`flex items-center gap-3 px-5 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${isActive ? 'bg-black text-white' : 'bg-transparent text-black/40 hover:bg-black/5 hover:text-black'}`}
                 >
                    {c.label}
                 </button>
               )
            })}
         </div>

         <div className="flex-1 flex flex-col justify-end mt-12">
            <button
              onClick={handleTotalDisconnect}
              className="w-full flex items-center justify-center gap-3 px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-white text-red-500 hover:bg-red-50 hover:text-red-600 transition-all border border-red-100 active:scale-[0.98]"
            >
              {t('TOTAL_DISCONNECT')}
            </button>
         </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-8 md:p-12 lg:p-16 bg-white overflow-y-auto h-full custom-scrollbar">
         
         <div className="mb-12 max-w-4xl mx-auto">
            <h2 className="text-[20px] font-black uppercase tracking-widest mb-3 text-black">
               {CATEGORIES.find(c => c.id === activeTab)?.label}
            </h2>
            <p className="text-[11px] font-mono text-black/40 uppercase tracking-widest leading-relaxed">
               {t('MANAGE_CONFIG')}
            </p>
         </div>

         <div className="max-w-4xl mx-auto">
           <AnimatePresence mode="wait">
              <motion.div 
                 key={activeTab}
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: -10 }}
                 transition={{ duration: 0.2 }}
                 className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                                  {activeTab === 'account' && (
                    <>
                       {renderInput('displayName' as any, 'Display Name', 'Your visible name in chats', 'text')}
                       <div className="flex flex-col p-6 bg-white border border-black/10 rounded-2xl hover:border-black/30 transition-all">
                           <span className="text-[12px] font-black uppercase tracking-widest text-black mb-1.5">Wallet Address</span>
                           <span className="text-[10px] text-black/40 font-mono mb-4 leading-relaxed">Your primary identity</span>
                           <input disabled value={address ? `${address.slice(0, 6)}...${address.slice(-4)} (Connected Wallet)` : "Not Connected"} className="w-full bg-black/5 border border-transparent rounded-xl px-5 py-3 text-[12px] font-mono text-black/50 cursor-not-allowed" />
                       </div>
                       <div className="flex flex-col p-6 bg-white border border-black/10 rounded-2xl hover:border-black/30 transition-all">
                           <span className="text-[12px] font-black uppercase tracking-widest text-black mb-1.5">Linked Devices</span>
                           <span className="text-[10px] text-black/40 font-mono mb-4 leading-relaxed">Manage your active sessions</span>
                           <div className="text-[12px] font-black tracking-widest text-black">{typeof window !== "undefined" && localStorage.getItem("ledger_linked_device_qr") ? "2 devices" : "1 device (this device)"}</div>
                       </div>
                       <div className="flex flex-col p-6 bg-white border border-red-500/20 rounded-2xl hover:border-red-500/40 transition-all">
                           <span className="text-[12px] font-black uppercase tracking-widest text-red-600 mb-1.5">Danger Zone</span>
                           <span className="text-[10px] text-red-500/60 font-mono mb-4 leading-relaxed">Permanently delete your account and history</span>
                           <button className="w-full px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border bg-red-50 text-red-600 border-red-200 hover:bg-red-500 hover:text-white">Delete Account</button>
                       </div>
                    </>
                 )}

                 {activeTab === 'notifications' && (
                    <>
                       {renderToggle('notif_msgs' as any, 'Message Notifications', 'Alert for incoming messages')}
                       {renderToggle('notif_calls' as any, 'Call Notifications', 'Ring for incoming calls')}
                       {renderToggle('notif_sound' as any, 'Notification Sound', 'Play sound on new messages')}
                       {renderToggle('dnd' as any, 'Do Not Disturb', 'Silence all notifications')}
                       {renderToggle('notif_preview' as any, 'Message Preview', 'Show message text in notifications')}
                    </>
                 )}

                 {activeTab === 'payments' && (
                    <>
                       {renderToggle('payments_enabled' as any, 'Enable Crypto Payments', 'When disabled, all payment CTAs are hidden throughout the app')}
                       <div className="flex flex-col p-6 bg-white border border-black/10 rounded-2xl hover:border-black/30 transition-all">
                           <span className="text-[12px] font-black uppercase tracking-widest text-black mb-1.5">Sticker Premium Plan</span>
                           <span className="text-[10px] text-black/40 font-mono mb-4 leading-relaxed">Current: Free Plan</span>
                           <button className="w-full px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border bg-[#25D366] text-white border-transparent hover:bg-[#20bd5a]">Upgrade for €2.99/mo</button>
                       </div>
                       <div className="flex flex-col p-6 bg-white border border-black/10 rounded-2xl hover:border-black/30 transition-all">
                           <span className="text-[12px] font-black uppercase tracking-widest text-black mb-1.5">Crypto Balance</span>
                           <span className="text-[10px] text-black/40 font-mono mb-4 leading-relaxed">Available crypto</span>
                           <div className="text-[16px] font-black tracking-widest text-black">{balance ? parseFloat(balance.formatted).toFixed(4) : "0.00"} {balance?.symbol || "ETH"}</div>
                       </div>
                    </>
                 )}

                 {activeTab === 'general' && (
                    <>
                       {renderSelect('language', t('LANGUAGE'), t('INTERFACE_LANGUAGE'), [
                          {value: 'en', label: t('ENGLISH')},
                          {value: 'es-ES', label: t('SPANISH')},
                       ])}
                       {renderSelect('currency', t('BASE_CURRENCY'), t('DEFAULT_CURRENCY'), [
                          {value: 'USD', label: t('USD_DOLLAR')},
                          {value: 'EUR', label: t('EUR_EURO')},
                          {value: 'GBP', label: t('GBP_POUND')},
                          {value: 'JPY', label: t('JPY_YEN')}
                       ])}
                       {renderSelect('timeFormat', t('TIME_FORMAT'), t('TIME_LAYOUT'), [
                          {value: '12h', label: t('12_HOURS')},
                          {value: '24h', label: t('24_HOURS')}
                       ])}
                       {renderSelect('dateFormat', t('DATE_FORMAT'), t('DATE_ORDERING'), [
                          {value: 'DD/MM/YYYY', label: 'DD/MM/YYYY'},
                          {value: 'MM/DD/YYYY', label: 'MM/DD/YYYY'}
                       ])}
                       {renderSelect('addressFormat', t('ADDRESS_FORMAT'), t('CRYPTO_RENDER'), [
                          {value: 'truncated', label: t('ABBREVIATED')},
                          {value: 'full', label: t('FULL_ADDRESS')}
                       ])}
                    </>
                 )}

                 {activeTab === 'display' && (
                    <>
                       {renderSelect('density', t('DENSITY'), t('SPACING_DENSITY'), [
                          {value: 'relaxed', label: t('RELAXED')},
                          {value: 'compact', label: t('COMPACT')},
                          {value: 'dense', label: t('DENSE')}
                       ])}
                       {renderToggle('showBalances', t('SHOW_BALANCES'), t('DISPLAY_PORTFOLIO'))}
                       {renderToggle('hardwareAcceleration', t('HW_ACCELERATION'), t('ENABLE_GPU'))}
                    </>
                 )}

                  {activeTab === 'privacy' && (
                     <>
                        {renderInput('inactivityLockMinutes', t('INACTIVITY_TIMEOUT'), t('MINUTES_LOCK'), 'number', t('MIN'))}
                        {renderToggle('stealthMode', t('STEALTH_MODE'), t('OBFUSCATE_VIS'))}
                        {renderToggle('requireSignForExports', t('EXPORT_AUTH'), t('REQ_CRYPTO_SIGN'))}
                     </>
                  )}

                  {activeTab === 'legal' && (
                     <div className="col-span-1 md:col-span-2 flex flex-col gap-4">
                        <p className="text-[11px] font-mono text-black/40 uppercase tracking-widest leading-relaxed border-b border-black/10 pb-4">
                          Humanity Ledger S.L. — MiCA Title II Utility Token Issuer — Regulated under Regulation (EU) 2023/1114.
                          Full regulatory documentation suite: 27 documents. Access each document below.
                        </p>
                        {LEGAL_LINKS.map((item) => {
                          const Icon = item.icon;
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className="flex items-start gap-5 p-5 bg-white border border-black/10 rounded-2xl hover:border-black/40 hover:shadow-sm transition-all active:scale-[0.99] group"
                            >
                              <div className="mt-0.5 w-9 h-9 rounded-xl bg-black/5 flex items-center justify-center shrink-0 group-hover:bg-black group-hover:text-white transition-colors">
                                <Icon size={16} className="text-black group-hover:text-white transition-colors" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[12px] font-black uppercase tracking-widest text-black truncate">{item.label}</span>
                                  <ExternalLink size={12} className="text-black/20 group-hover:text-black/60 transition-colors shrink-0" />
                                </div>
                                <span className="text-[10px] font-mono text-black/40 leading-relaxed mt-1 block">{item.desc}</span>
                              </div>
                            </Link>
                          );
                        })}
                        <p className="text-[9px] font-mono text-black/25 uppercase tracking-widest text-center pt-2">
                          © 2026 Humanity Ledger S.L. (In process of incorporation) · All rights reserved
                        </p>
                     </div>
                  )}
               </motion.div>
            </AnimatePresence>
         </div>
      </div>
    </div>
  );
}
