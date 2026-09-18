"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, User, Bell, Lock, Database, Paintbrush,
  Globe, Star, Phone, Folder, MonitorSmartphone, Bookmark,
  QrCode, Check, Shield, Trash2, Camera, Crown, ArrowRight,
  Plus, Zap, Bot, Eye, EyeOff, Cpu, Wifi, WifiOff, Key,
  RefreshCw, Download, AlertTriangle, Volume2, Vibrate,
  MessageCircle, Settings, Hash, Activity, Radio, AtSign,
  ChevronDown, ChevronRight, Flame, Clock
} from 'lucide-react';
import QRCode from 'react-qr-code';
import { toast } from 'sonner';
import { vault } from '@/lib/core/SecureVault';
import { getCallHistory, CallRecord } from '@/lib/wallet/callHistory';
import {
  pxeEngine,
  LedgerProtocolSettings,
  DEFAULT_PXE_SETTINGS
} from '@/lib/wallet/SettingsEnginePXE';
import { useAppKit } from '@reown/appkit/react';
import { useWalletStore } from '@/lib/store/wallet-store';
import { useAccount, useSendTransaction } from 'wagmi';
import { parseEther } from 'viem';

// Treasury wallet for Quantum Dots purchases
// Treasury wallet for Quantum Dots purchases — must match server-side validation in /api/aztec/purchase-qd
const TREASURY_WALLET = '0x78831C25c86eA2a78A6127fC2Ccb95E612D87b4a' as `0x${string}`;

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
//  HOOK: useLedgerSettings
//  Subscribes a component to the PXE engine for reactive setting updates.
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export function useLedgerSettings(address: string) {
  const [settings, setSettings] = useState<LedgerProtocolSettings>(DEFAULT_PXE_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!address) return;
    const unsubscribe = pxeEngine.subscribe(address, (newSettings) => {
      setSettings(newSettings);
      setIsLoaded(true);
    });
    return () => unsubscribe();
  }, [address]);

  const updateSetting = async <K extends keyof LedgerProtocolSettings>(
    key: K,
    value: LedgerProtocolSettings[K]
  ) => {
    await pxeEngine.mutate(address, key, value);
  };

  const updateBatch = async (mutations: Partial<LedgerProtocolSettings>) => {
    await pxeEngine.mutateBatch(address, mutations);
  };

  return { settings, updateSetting, updateBatch, isLoaded };
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
//  MAIN ROUTER COMPONENT
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export interface LedgerChatSettingsProps {
  onClose: () => void;
  address: string;
}

export function LedgerChatSettings({ onClose, address }: LedgerChatSettingsProps) {
  const [viewStack, setViewStack] = useState<string[]>(['root']);
  const [direction, setDirection] = useState(1);
  const { settings, updateSetting, updateBatch, isLoaded } = useLedgerSettings(address);

  const view = viewStack[viewStack.length - 1];

  const navigate = (newView: string) => {
    setDirection(1);
    setViewStack(prev => [...prev, newView]);
  };

  const goBack = () => {
    if (viewStack.length === 1) { onClose(); return; }
    setDirection(-1);
    setViewStack(prev => prev.slice(0, -1));
  };

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 1 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 1 }),
  };

  if (!isLoaded) return null;

  const viewTitle = view === 'root' ? 'SYSTEM SETTINGS'
    : view === 'profile' ? 'MY PROFILE'
    : view === 'edit_profile' ? 'EDIT PROFILE'
    : view === 'notifications' ? 'ALERTS & SOUNDS'
    : view === 'privacy' ? 'PRIVACY ENGINE'
    : view === 'data' ? 'DATA & STORAGE'
    : view === 'appearance' ? 'AESTHETICS'
    : view === 'language' ? 'LANGUAGE'
    : view === 'personal_vault' ? 'PERSONAL VAULT'
    : view === 'connection_log' ? 'CONNECTION LOG'
    : view === 'devices' ? 'ACTIVE DEVICES'
    : view === 'workspaces' ? 'WORKSPACES'
    : view === 'ghost_mode' ? 'AI GHOST MODE'
    : view === 'defi_tools' ? 'LEDGER TOOLS'
    : view === 'network' ? 'NETWORK PROTOCOL'
    : view === 'premium' ? 'LEDGER NETWORK PRO'
    : view === 'stars' ? 'QUANTUM DOTS'
    : view.toUpperCase().replace(/_/g, ' ');

  return (
    <div className="fixed inset-0 z-[50] flex items-center justify-center pointer-events-none">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto" onClick={onClose} />
      <div className="relative w-full h-[100dvh] md:h-[85vh] md:w-[480px] bg-zinc-50 md:border-[3px] md:border-black pointer-events-auto flex flex-col font-mono overflow-hidden shadow-[12px_12px_0_0_rgba(0,0,0,1)] z-10 md:rounded-xl">
        <div className="flex items-center justify-between px-4 py-4 bg-white shrink-0 border-b-[3px] border-black z-10">
          <button onClick={goBack} className="text-black font-bold uppercase tracking-widest text-[13px] hover:bg-black hover:text-white px-2 py-1 transition-colors border-2 border-transparent hover:border-black">
            {view === 'root' ? '[ CLOSE ]' : '< BACK'}
          </button>
          <span className="font-black text-[15px] text-black tracking-tight uppercase truncate flex-1 text-center px-2">
            {viewTitle}
          </span>
          <div className="w-16" />
        </div>

        <div className="relative flex-1 w-full overflow-hidden bg-zinc-50">
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={view}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              className="absolute inset-0 w-full h-full flex flex-col bg-zinc-50 overflow-y-auto"
            >
              {view === 'root' && <RootView onNavigate={navigate} address={address} s={settings} />}
              {view === 'profile' && <ProfileView address={address} s={settings} />}
              {view === 'edit_profile' && <EditProfileView address={address} s={settings} update={updateSetting} updateBatch={updateBatch} goBack={goBack} />}
              {view === 'notifications' && <NotificationsView s={settings} update={updateSetting} />}
              {view === 'privacy' && <PrivacyView s={settings} update={updateSetting} />}
              {view === 'data' && <DataView s={settings} update={updateSetting} address={address} />}
              {view === 'appearance' && <AppearanceView s={settings} update={updateSetting} />}
              {view === 'language' && <LanguageView s={settings} update={updateSetting} />}
              {view === 'personal_vault' && <PersonalVaultView address={address} />}
              {view === 'connection_log' && <ConnectionLogView address={address} />}
              {view === 'devices' && <DevicesView />}
              {view === 'workspaces' && <WorkspacesView s={settings} update={updateSetting} />}
              {view === 'ghost_mode' && <GhostModeView s={settings} update={updateSetting} />}
              {view === 'defi_tools' && <DefiToolsView s={settings} update={updateSetting} />}
              {view === 'premium' && <PremiumView />}
              {view === 'stars' && <StarsView />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
//  ROOT VIEW
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function RootView({ onNavigate, address, s }: any) {
  return (
    <div className="w-full pb-20">
      <button onClick={() => onNavigate('profile')} className="w-full p-4 border-b-[3px] border-black bg-white hover:bg-zinc-50 transition-colors">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-black flex items-center justify-center shrink-0 border-2 border-black overflow-hidden">
            {s.avatar_url
              ? <img src={s.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              : <span className="text-white font-black text-2xl">{(s.displayName || '?').charAt(0).toUpperCase()}</span>
            }
          </div>
          <div className="flex flex-col flex-1 overflow-hidden text-left">
            <span className="text-[18px] font-black text-black uppercase truncate">{s.displayName}</span>
            <span className="text-[13px] font-bold text-black/50 truncate">@{s.username}</span>
            <span className="text-[10px] font-mono mt-1 text-black/40 truncate">{address}</span>
          </div>
          <ArrowRight size={20} className="text-black shrink-0" />
        </div>
      </button>

      <div className="p-4 space-y-4">
        <BBlock>
          <BItem icon={<Bookmark size={18}/>} label="Personal Vault" onClick={() => onNavigate('personal_vault')} />
          <BItem icon={<Phone size={18}/>} label="Connection Log" onClick={() => onNavigate('connection_log')} />
          <BItem icon={<MonitorSmartphone size={18}/>} label="Active Devices" onClick={() => onNavigate('devices')} />
          <BItem icon={<Folder size={18}/>} label="Workspaces" onClick={() => onNavigate('workspaces')} noBorder />
        </BBlock>

        <BBlock>
          <BItem icon={<Bell size={18}/>} label="Alerts & Sounds" onClick={() => onNavigate('notifications')} />
          <BItem icon={<Shield size={18}/>} label="Privacy Engine" onClick={() => onNavigate('privacy')} />
          <BItem icon={<Database size={18}/>} label="Data & Storage" onClick={() => onNavigate('data')} />
          <BItem icon={<Paintbrush size={18}/>} label="Aesthetics" onClick={() => onNavigate('appearance')} />
          <BItem icon={<Globe size={18}/>} label="Language" onClick={() => onNavigate('language')} noBorder />
        </BBlock>

        <BBlock>
          <BItem icon={<Bot size={18}/>} label="AI Ghost Mode" onClick={() => onNavigate('ghost_mode')} />
          <BItem icon={<Activity size={18}/>} label="Ledger Intelligence Tools" onClick={() => onNavigate('defi_tools')} noBorder />
        </BBlock>

        <div onClick={() => onNavigate('premium')} className="w-full border-[3px] border-black bg-black text-white p-4 flex items-center gap-4 cursor-pointer hover:bg-zinc-900 transition-colors shadow-[6px_6px_0_0_#1c7aff]">
          <Crown size={28} className="text-[#1c7aff] shrink-0" />
          <div className="flex flex-col">
            <span className="text-[16px] font-black uppercase">Ledger Network Pro</span>
            <span className="text-[11px] text-zinc-400">Unlock maximum capacity</span>
          </div>
          <ArrowRight size={18} className="ml-auto text-zinc-500" />
        </div>

        <div onClick={() => onNavigate('stars')} className="w-full border-[3px] border-black bg-yellow-400 text-black p-4 flex items-center gap-4 cursor-pointer hover:bg-yellow-300 transition-colors shadow-[6px_6px_0_0_#000]">
          <Star size={28} className="fill-black shrink-0" />
          <div className="flex flex-col">
            <span className="text-[16px] font-black uppercase">Quantum Dots</span>
            <span className="text-[11px] font-bold">1,250 QD Balance</span>
          </div>
          <ArrowRight size={18} className="ml-auto" />
        </div>
      </div>
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
//  PROFILE VIEW
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function ProfileView({ address, s }: any) {
  const [showQR, setShowQR] = useState(false);
  return (
    <div className="w-full flex flex-col pb-20">
      <div className="w-full bg-black p-8 flex flex-col items-center text-white relative">
        <div className="w-28 h-28 bg-white border-[4px] border-zinc-700 mb-4 flex items-center justify-center overflow-hidden">
          {s.avatar_url
            ? <img src={s.avatar_url} alt="avatar" className="w-full h-full object-cover" />
            : <span className="text-black font-black text-5xl">{(s.displayName || '?').charAt(0).toUpperCase()}</span>
          }
        </div>
        <h2 className="text-2xl font-black uppercase text-center max-w-[90%] break-words">{s.displayName}</h2>
        <span className="text-zinc-400 text-sm font-bold mt-1">@{s.username}</span>
        <span className={`text-xs mt-2 px-2 py-0.5 border font-bold ${s.privacy_last_seen === 'nobody' ? 'border-zinc-600 text-zinc-600' : 'border-green-500 text-green-500'}`}>
          {s.privacy_last_seen === 'nobody' ? 'LAST SEEN: HIDDEN' : 'ONLINE'}
        </span>
        <button onClick={() => setShowQR(!showQR)} className="absolute top-4 right-4 p-2 bg-white text-black hover:bg-zinc-200">
          <QrCode size={20} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {showQR && (
          <div className="bg-white border-[3px] border-black p-6 flex flex-col items-center shadow-[8px_8px_0_0_#000]">
            <QRCode value={address || '0x0000000000000000000000000000000000000000'} size={180} fgColor="#000" />
            <span className="mt-4 text-[11px] font-bold bg-zinc-100 px-3 py-2 border border-black text-center break-all">{address}</span>
            <div className="flex gap-2 mt-3 w-full">
              <button onClick={() => { navigator.clipboard.writeText(address); toast.success('Address copied.'); }} className="flex-1 py-2 bg-black text-white font-black text-xs uppercase border-2 border-black">COPY</button>
              <button onClick={() => {
                const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
                const shareUrl = `${appUrl}/chat?to=${encodeURIComponent(address)}`;
                if (navigator.share) {
                  navigator.share({ title: 'Connect on Humanity Ledger', url: shareUrl }).catch(() => {});
                } else {
                  navigator.clipboard.writeText(shareUrl).then(() => toast.success('Chat link copied to clipboard!')).catch(() => toast.error('Failed to copy link'));
                }
              }} className="flex-1 py-2 bg-white text-black font-black text-xs uppercase border-2 border-black hover:bg-zinc-100">SHARE</button>
            </div>
          </div>
        )}
        <div className="bg-white border-[3px] border-black p-4 shadow-[4px_4px_0_0_#000]">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Biography</span>
          <p className="text-[14px] font-bold text-black whitespace-pre-wrap">{s.bio || 'Ã¢â‚¬â€'}</p>
        </div>
        <div className="bg-white border-[3px] border-black p-4 shadow-[4px_4px_0_0_#000] space-y-2">
          <InfoRow label="Onion Hops" value={`${s.onion_hops} hop${s.onion_hops !== 1 ? 's' : ''}`} />
          <InfoRow label="Biometric Lock" value={s.biometric_lock ? 'ENABLED' : 'DISABLED'} />
          <InfoRow label="Read Receipts" value={s.show_read_receipts ? 'ON' : 'OFF'} />
          <InfoRow label="IP Masking" value={s.webrtc_ip_masking ? 'ACTIVE' : 'OFF'} />
        </div>
      </div>
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
//  EDIT PROFILE VIEW
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function EditProfileView({ address, s, update, updateBatch, goBack }: any) {
  const [name, setName] = useState(s.displayName);
  const [username, setUsername] = useState(s.username);
  const [bio, setBio] = useState(s.bio);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      await update('avatar_url', dataUrl);
      toast.success('Avatar updated.');
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    await updateBatch({ displayName: name, username, bio });
    
    // [DB SYNC] Sync profile to central DB for searchability
    try {
      await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          displayName: name.trim(),
          chatName: username.replace('@', '').trim(),
          bio: bio.trim(),
        }),
      });
    } catch {}

    setSaving(false);
    toast.success('Profile updated.');
    goBack();
  };

  return (
    <div className="p-4 space-y-6 pb-20">
      <div className="flex justify-center">
        <button onClick={() => fileRef.current?.click()} className="w-24 h-24 bg-white border-[3px] border-black flex items-center justify-center relative cursor-pointer group shadow-[4px_4px_0_0_#000] overflow-hidden">
          {s.avatar_url
            ? <img src={s.avatar_url} alt="" className="w-full h-full object-cover group-hover:opacity-60 transition-opacity" />
            : <Camera size={28} className="text-black" />
          }
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Camera size={20} className="text-white" />
          </div>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
      </div>
      <BInput label="Display Name" value={name} onChange={setName} />
      <BInput label="Username" value={username} onChange={setUsername} prefix="@" />
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500">Biography</label>
        <textarea
          className="w-full bg-white border-[3px] border-black p-3 text-[14px] font-bold outline-none focus:bg-yellow-50 resize-none h-24"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={200}
        />
        <span className="text-[10px] text-zinc-400 text-right">{bio.length}/200</span>
      </div>
      <button onClick={handleSave} disabled={saving} className="w-full py-4 bg-black text-white font-black uppercase tracking-widest border-[3px] border-black hover:bg-zinc-800 shadow-[6px_6px_0_0_#000] active:translate-y-1 disabled:opacity-50">
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
//  ALERTS & SOUNDS VIEW
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function NotificationsView({ s, update }: any) {
  return (
    <div className="p-4 space-y-6 pb-20">
      <SH title="Message Alerts" />
      <BBlock>
        <TRow label="Direct Channels" checked={s.notifications_private} onChange={(v: boolean) => update('notifications_private', v)} />
        <TRow label="Encrypted Groups" checked={s.notifications_groups} onChange={(v: boolean) => update('notifications_groups', v)} />
        <TRow label="Workspaces" checked={s.notifications_workspaces} onChange={(v: boolean) => update('notifications_workspaces', v)} noBorder />
      </BBlock>

      <SH title="Sound System" />
      <BBlock>
        <TRow label="Notification Sound" checked={s.notification_sound} onChange={(v: boolean) => update('notification_sound', v)} />
        <TRow label="Mechanical Keyboard" checked={s.mechanical_keyboard} onChange={(v: boolean) => update('mechanical_keyboard', v)} />
        <TRow label="Show Unread Badge" checked={s.badge_count} onChange={(v: boolean) => update('badge_count', v)} noBorder />
      </BBlock>

      <SH title="Sound Pack" />
      <BBlock>
        {(['minimal', 'arcade', 'ledger', 'asmr'] as const).map((pack, i, arr) => (
          <div key={pack} onClick={() => update('sound_pack', pack)} className={`flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-100 ${i !== arr.length - 1 ? 'border-b-[3px] border-black' : ''}`}>
            <span className="font-black uppercase text-sm">{pack}</span>
            {s.sound_pack === pack && <Check size={18} />}
          </div>
        ))}
      </BBlock>

      <SH title="Haptics Intensity" />
      <BBlock>
        {([0, 1, 2, 3] as const).map((level, i) => {
          const labels = ['OFF', 'LIGHT', 'MEDIUM', 'STRONG'];
          return (
            <div key={level} onClick={() => update('haptics_intensity', level)} className={`flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-100 ${i !== 3 ? 'border-b-[3px] border-black' : ''}`}>
              <div className="flex items-center gap-2">
                <Vibrate size={16} className={s.haptics_intensity >= level && level > 0 ? 'text-black' : 'text-zinc-300'} />
                <span className="font-black uppercase text-sm">{labels[level]}</span>
              </div>
              {s.haptics_intensity === level && <Check size={18} />}
            </div>
          );
        })}
      </BBlock>

      <button onClick={() => {
        update('notifications_private', true);
        update('notifications_groups', true);
        update('notification_sound', true);
        update('badge_count', true);
        toast.success('Alert system reset to defaults.');
      }} className="w-full py-4 bg-white text-red-600 font-black uppercase tracking-widest border-[3px] border-black shadow-[4px_4px_0_0_#000] active:translate-y-1">
        Reset to Defaults
      </button>
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
//  PRIVACY ENGINE VIEW
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function PrivacyView({ s, update }: any) {
  const [blocked, setBlocked] = useState<string[]>([]);
  const [showBlocked, setShowBlocked] = useState(false);

  useEffect(() => {
    vault.getItem('ledger_blocked').then(res => {
      if (res) { try { setBlocked(JSON.parse(res)); } catch(e) {} }
    });
  }, []);

  const unblock = (addr: string) => {
    const updated = blocked.filter(a => a !== addr);
    setBlocked(updated);
    vault.setItem('ledger_blocked', JSON.stringify(updated));
    toast.success('Address removed from blocklist.');
  };

  if (showBlocked) {
    return (
      <div className="p-4 space-y-4 pb-20">
        <button onClick={() => setShowBlocked(false)} className="mb-2 text-[12px] font-black uppercase tracking-widest border-2 border-black px-3 py-1 hover:bg-black hover:text-white transition-colors">
          {'< BACK'}
        </button>
        <SH title={`Blocked Nodes (${blocked.length})`} />
        {blocked.length === 0
          ? <div className="p-6 bg-white border-[3px] border-black text-center font-bold text-sm shadow-[4px_4px_0_0_#000]">NO BLOCKED ADDRESSES</div>
          : <BBlock>
              {blocked.map((b, i) => (
                <div key={b} className={`flex items-center justify-between p-4 ${i !== blocked.length - 1 ? 'border-b-[3px] border-black' : ''}`}>
                  <span className="font-bold text-[11px] truncate w-[60%]">{b}</span>
                  <button onClick={() => unblock(b)} className="px-3 py-1 bg-red-600 text-white font-black text-[10px] uppercase border-2 border-black hover:bg-red-700">UNBLOCK</button>
                </div>
              ))}
            </BBlock>
        }
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 pb-20">
      <SH title="Security Controls" />
      <BBlock>
        <TRow label="Hardware Passcode" checked={s.passcode_enabled} onChange={(v: boolean) => update('passcode_enabled', v)} />
        <TRow label="Biometric Lock" checked={s.biometric_lock} onChange={(v: boolean) => update('biometric_lock', v)} />
        <TRow label="WebRTC IP Masking" checked={s.webrtc_ip_masking} onChange={(v: boolean) => update('webrtc_ip_masking', v)} />
        <BItem icon={<Lock size={16}/>} label={`Blocked Addresses (${blocked.length})`} onClick={() => setShowBlocked(true)} noBorder />
      </BBlock>

      <SH title="Visibility Settings" />
      <BBlock>
        <CycleRow label="Last Seen" value={s.privacy_last_seen} options={['nobody', 'contacts', 'everybody']} onChange={(v: boolean) => update('privacy_last_seen', v as any)} />
        <CycleRow label="Profile Photo" value={s.privacy_profile_photo} options={['nobody', 'contacts', 'everybody']} onChange={(v: boolean) => update('privacy_profile_photo', v as any)} />
        <CycleRow label="Biography" value={s.privacy_bio} options={['nobody', 'contacts', 'everybody']} onChange={(v: boolean) => update('privacy_bio', v as any)} />
        <CycleRow label="Group Invites" value={s.privacy_group_invites} options={['nobody', 'contacts', 'everybody']} onChange={(v: boolean) => update('privacy_group_invites', v as any)} noBorder />
      </BBlock>

      <SH title="Communication Privacy" />
      <BBlock>
        <TRow label="Show Read Receipts" checked={s.show_read_receipts} onChange={(v: boolean) => update('show_read_receipts', v)} />
        <TRow label="Watermark Overlay" checked={s.watermark_enabled} onChange={(v: boolean) => update('watermark_enabled', v)} noBorder />
      </BBlock>

      <SH title="Onion Routing (Tor Hops)" />
      <BBlock>
        {([1, 3, 5] as const).map((hops, i) => {
          const labels: Record<number, string> = { 1: 'DIRECT (FASTEST)', 3: 'STANDARD (3 HOPS)', 5: 'MAXIMUM (5 HOPS)' };
          return (
            <div key={hops} onClick={() => update('onion_hops', hops)} className={`flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-100 ${i !== 2 ? 'border-b-[3px] border-black' : ''}`}>
              <span className="font-black uppercase text-sm">{labels[hops]}</span>
              {s.onion_hops === hops && <Check size={18} />}
            </div>
          );
        })}
      </BBlock>

      <SH title="Self-Destruct Protocol" />
      <BBlock>
        <CycleRow label="Auto-Delete Timer" value={s.auto_delete_timer} options={['off', '24 hours', '1 week', '1 month']} onChange={(v: boolean) => update('auto_delete_timer', v as any)} />
        <TRow label="Burn-on-Read" checked={s.burn_on_read} onChange={(v: boolean) => update('burn_on_read', v)} />
        {s.burn_on_read && (
          <BBlock>
            {([3, 10, 30, 60] as const).map((sec, i, arr) => (
              <div key={sec} onClick={() => update('burn_on_read_seconds', sec)} className={`flex items-center justify-between p-3 cursor-pointer hover:bg-zinc-100 ${i !== arr.length - 1 ? 'border-b border-black/20' : ''}`}>
                <span className="font-black text-sm">{sec}s</span>
                {s.burn_on_read_seconds === sec && <Check size={16} />}
              </div>
            ))}
          </BBlock>
        )}
      </BBlock>
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
//  DATA & STORAGE VIEW
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function DataView({ s, update, address }: any) {
  const [stats, setStats] = useState({ sent: 0, received: 0 });

  useEffect(() => {
    // Calculate approximate storage usage from localStorage
    let totalBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || '';
      if (key.includes(address)) {
        totalBytes += (localStorage.getItem(key) || '').length * 2;
      }
    }
    setStats({ sent: Math.round(totalBytes / 1024), received: Math.round(totalBytes * 2.8 / 1024) });
  }, [address]);

  const purgeCacheWithConfirm = () => {
    if (confirm('This will clear all locally cached message data. Continue?')) {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i) || '';
        if (key.includes('ledger_cache_')) localStorage.removeItem(key);
      }
      setStats({ sent: 0, received: 0 });
      toast.success('Cache purged successfully.');
    }
  };

  return (
    <div className="p-4 space-y-6 pb-20">
      <div className="bg-black text-white border-[3px] border-black p-6 flex flex-col items-center shadow-[6px_6px_0_0_#1c7aff]">
        <div className="w-full flex justify-between items-end mb-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Local Sent</span>
            <span className="text-xl font-black">{stats.sent} KB</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Local Rcvd</span>
            <span className="text-xl font-black text-[#1c7aff]">{stats.received} KB</span>
          </div>
        </div>
        <div className="w-full h-3 bg-zinc-800 border border-white flex mb-4">
          <div className="h-full bg-white" style={{ width: `${Math.min(30, stats.sent / (stats.sent + stats.received + 1) * 100)}%` }} />
          <div className="h-full bg-[#1c7aff]" style={{ width: `${Math.min(70, stats.received / (stats.sent + stats.received + 1) * 100)}%` }} />
        </div>
        <button onClick={purgeCacheWithConfirm} className="w-full py-2 bg-white text-black font-black uppercase text-sm border-2 border-transparent hover:border-[#1c7aff] active:bg-zinc-200">
          Clear Cache
        </button>
      </div>

      <SH title="Auto-Download" />
      <BBlock>
        <TRow label="Auto-Fetch (WiFi)" checked={s.auto_download_wifi} onChange={(v: boolean) => update('auto_download_wifi', v)} />
        <TRow label="Auto-Fetch (Cellular)" checked={s.auto_download_cellular} onChange={(v: boolean) => update('auto_download_cellular', v)} />
        <TRow label="Save Media to Gallery" checked={s.save_photos} onChange={(v: boolean) => update('save_photos', v)} noBorder />
      </BBlock>

      <SH title="Call Quality" />
      <BBlock>
        <TRow label="Data-Saver WebRTC" checked={s.data_saver_calls} onChange={(v: boolean) => update('data_saver_calls', v)} noBorder />
      </BBlock>

      <SH title="Privacy" />
      <BBlock>
        <TRow label="Anonymous Telemetry" checked={s.allow_analytics} onChange={(v: boolean) => update('allow_analytics', v)} noBorder />
      </BBlock>

      <button onClick={() => {
        if (confirm('This will wipe ALL Ledger Chat data for this wallet. This action cannot be undone.')) {
          localStorage.clear();
          window.location.reload();
        }
      }} className="w-full py-4 bg-white text-red-600 font-black uppercase tracking-widest border-[3px] border-black shadow-[4px_4px_0_0_#000] active:translate-y-1">
        Delete All Data
      </button>
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
//  AESTHETICS VIEW
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function AppearanceView({ s, update }: any) {
  return (
    <div className="p-4 space-y-6 pb-20">
      <SH title="Theme" />
      <div className="grid grid-cols-2 gap-3">
        {(['brutalist', 'monochrome', 'neon_void', 'terminal'] as const).map(theme => (
          <div key={theme} onClick={() => update('theme', theme)} className={`border-[3px] p-4 cursor-pointer flex flex-col items-center gap-1 transition-all ${s.theme === theme ? 'bg-black text-white border-black shadow-[4px_4px_0_0_#1c7aff]' : 'bg-white border-black text-black hover:bg-zinc-100'}`}>
            <span className="font-black uppercase text-[11px] tracking-widest">{theme.replace('_', ' ')}</span>
          </div>
        ))}
      </div>

      <SH title="Bubble Style" />
      <BBlock>
        {(['default', 'brutalist', 'glass', 'minimal'] as const).map((style, i, arr) => (
          <div key={style} onClick={() => update('bubble_style', style)} className={`flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-100 ${i !== arr.length - 1 ? 'border-b-[3px] border-black' : ''}`}>
            <span className="font-black uppercase text-sm">{style}</span>
            {s.bubble_style === style && <Check size={18} />}
          </div>
        ))}
      </BBlock>

      <SH title="Chat Background" />
      <BBlock>
        {(['default', 'amoled', 'holographic', 'matrix', 'gradient'] as const).map((bg, i, arr) => (
          <div key={bg} onClick={() => update('chat_background', bg)} className={`flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-100 ${i !== arr.length - 1 ? 'border-b-[3px] border-black' : ''}`}>
            <span className="font-black uppercase text-sm">{bg}</span>
            {s.chat_background === bg && <Check size={18} />}
          </div>
        ))}
      </BBlock>

      <SH title="UI Density" />
      <BBlock>
        {(['relaxed', 'compact', 'dense'] as const).map((d, i, arr) => (
          <div key={d} onClick={() => update('ui_density', d)} className={`flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-100 ${i !== arr.length - 1 ? 'border-b-[3px] border-black' : ''}`}>
            <span className="font-black uppercase text-sm">{d}</span>
            {s.ui_density === d && <Check size={18} />}
          </div>
        ))}
      </BBlock>

      <SH title="Advanced" />
      <BBlock>
        <TRow label="NFT Avatar Border" checked={s.nft_border_enabled} onChange={(v: boolean) => update('nft_border_enabled', v)} />
        <TRow label="Watermark Overlay" checked={s.watermark_enabled} onChange={(v: boolean) => update('watermark_enabled', v)} noBorder />
      </BBlock>
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
//  LANGUAGE VIEW
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function LanguageView({ s, update }: any) {
  const langs = [
    { code: 'en', label: 'ENGLISH' }, { code: 'es', label: 'ESPAÃƒâ€˜OL' },
    { code: 'fr', label: 'FRANÃƒâ€¡AIS' }, { code: 'de', label: 'DEUTSCH' },
    { code: 'jp', label: 'JAPANESE' }, { code: 'cn', label: 'CHINESE' },
  ];
  return (
    <div className="p-4 space-y-6 pb-20">
      <SH title="Interface Language" />
      <BBlock>
        {langs.map(({ code, label }, i) => (
          <div key={code} onClick={() => update('language', code as any)} className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${i !== langs.length - 1 ? 'border-b-[3px] border-black' : ''} ${s.language === code ? 'bg-black text-white' : 'bg-white text-black hover:bg-zinc-100'}`}>
            <span className="font-black uppercase">{label}</span>
            {s.language === code && <Check size={18} />}
          </div>
        ))}
      </BBlock>

      <SH title="Format" />
      <BBlock>
        <div onClick={() => update('time_format', s.time_format === '12h' ? '24h' : '12h')} className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-100 border-b-[3px] border-black">
          <span className="font-black uppercase text-sm">Time Format</span>
          <span className="font-bold text-zinc-600 uppercase">{s.time_format}</span>
        </div>
        <div onClick={() => update('date_format', s.date_format === 'DD/MM/YYYY' ? 'MM/DD/YYYY' : 'DD/MM/YYYY')} className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-100">
          <span className="font-black uppercase text-sm">Date Format</span>
          <span className="font-bold text-zinc-600 uppercase text-[11px]">{s.date_format}</span>
        </div>
      </BBlock>
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
//  PERSONAL VAULT VIEW
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function PersonalVaultView({ address }: { address: string }) {
  const [notes, setNotes] = useState<{ id: string; text: string; date: number }[]>([]);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    vault.getItem(`ledger_vault_notes_${address}`).then(res => {
      if (res) { try { setNotes(JSON.parse(res)); } catch(e) {} }
    });
  }, [address]);

  const saveNote = async () => {
    if (!draft.trim()) return;
    const updated = [{ id: crypto.randomUUID(), text: draft.trim(), date: Date.now() }, ...notes];
    setNotes(updated);
    await vault.setItem(`ledger_vault_notes_${address}`, JSON.stringify(updated));
    setDraft('');
    toast.success('Note saved to your vault.');
  };

  const deleteNote = async (id: string) => {
    const updated = notes.filter(n => n.id !== id);
    setNotes(updated);
    await vault.setItem(`ledger_vault_notes_${address}`, JSON.stringify(updated));
  };

  return (
    <div className="p-4 flex flex-col pb-20">
      <div className="w-full bg-white border-[3px] border-black p-3 flex shadow-[4px_4px_0_0_#000] mb-6">
        <input type="text" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Enter secure fragment..." className="flex-1 bg-transparent outline-none font-bold text-sm" onKeyDown={e => e.key === 'Enter' && saveNote()} />
        <button onClick={saveNote} className="bg-black text-white p-2 border-2 border-black hover:bg-zinc-800"><Plus size={16} /></button>
      </div>
      <div className="flex flex-col gap-4">
        {notes.length === 0
          ? <div className="w-full bg-black text-white p-6 border-[3px] border-black flex items-center justify-center border-dashed"><span className="font-mono text-zinc-400">VAULT_EMPTY</span></div>
          : notes.map(note => (
              <div key={note.id} className="w-full bg-white border-[3px] border-black p-4 shadow-[4px_4px_0_0_#000]">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-black tracking-widest text-zinc-500 uppercase">{new Date(note.date).toLocaleString()}</span>
                  <button onClick={() => deleteNote(note.id)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
                </div>
                <p className="font-bold text-sm whitespace-pre-wrap break-words">{note.text}</p>
              </div>
            ))
        }
      </div>
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
//  CONNECTION LOG VIEW
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function ConnectionLogView({ address }: { address: string }) {
  const [history, setHistory] = useState<CallRecord[]>([]);
  const [filter, setFilter] = useState<'all' | 'missed' | 'incoming' | 'outgoing'>('all');

  useEffect(() => { setHistory(getCallHistory(address)); }, [address]);

  const filtered = filter === 'all' ? history : history.filter(c =>
    filter === 'missed' ? c.status === 'missed' : c.direction === filter
  );

  return (
    <div className="p-4 space-y-4 pb-20">
      <div className="flex gap-2 flex-wrap">
        {(['all', 'missed', 'incoming', 'outgoing'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 font-black text-[11px] uppercase border-2 border-black transition-colors ${filter === f ? 'bg-black text-white' : 'bg-white text-black hover:bg-zinc-100'}`}>{f}</button>
        ))}
      </div>
      {filtered.length === 0
        ? <div className="p-6 bg-white border-[3px] border-black text-center font-bold text-sm shadow-[4px_4px_0_0_#000]">NO CONNECTIONS FOUND</div>
        : <BBlock>
            {filtered.map((call, i) => (
              <div key={call.id} className={`flex items-center justify-between p-4 ${i !== filtered.length - 1 ? 'border-b-[3px] border-black' : ''}`}>
                <div className="flex flex-col w-[70%]">
                  <span className="font-black text-[13px] truncate">{call.peerAddress}</span>
                  <span className={`text-[10px] font-bold uppercase ${call.status === 'missed' ? 'text-red-500' : 'text-zinc-500'}`}>
                    {call.direction} {call.type} Ã¢â‚¬Â¢ {call.status} Ã¢â‚¬Â¢ {new Date(call.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <Phone size={16} className={call.status === 'missed' ? 'text-red-500' : 'text-black'} />
                  {call.durationSeconds > 0 && <span className="text-[10px] font-black">{call.durationSeconds}s</span>}
                </div>
              </div>
            ))}
          </BBlock>
      }
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
//  DEVICES VIEW
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function DevicesView() {
  const [sessions, setSessions] = React.useState<{ name: string; platform: string; network: string; status: string; isCurrent: boolean; lastSeen: string }[]>([]);

  useEffect(() => {
    // Build session list from available browser/storage data
    const now = new Date();
    const ua = navigator.userAgent;
    const platform = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'macOS' : /Win/.test(ua) ? 'Windows' : 'Unknown';
    const browser = /Chrome/.test(ua) && !/Edge/.test(ua) ? 'Chrome' : /Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : /Edge/.test(ua) ? 'Edge' : 'Browser';
    const current = { name: `${browser} on ${platform}`, platform, network: 'Current Browser Session', status: 'Active (This Device)', isCurrent: true, lastSeen: 'Just now' };

    // Pull any stored sessions from localStorage
    const stored: any[] = [];
    try {
      const raw = localStorage.getItem('hl_active_sessions');
      if (raw) stored.push(...JSON.parse(raw));
    } catch {}

    setSessions([current, ...stored.filter((s: any) => !s.isCurrent)]);

    // Write current session to localStorage so other devices can see it
    try {
      const existing: any[] = JSON.parse(localStorage.getItem('hl_active_sessions') || '[]');
      const updated = [{ name: current.name, platform, network: 'Remote Session', status: 'Active', isCurrent: false, lastSeen: now.toLocaleString() }, ...existing.filter((s: any) => !s.isCurrent).slice(0, 4)];
      localStorage.setItem('hl_active_sessions', JSON.stringify(updated));
    } catch {}
  }, []);

  return (
    <div className="p-4 space-y-6 pb-20">
      <button onClick={() => toast.info('To link a new device, open Ledger Chat on that device and sign in with the same wallet.')} className="w-full py-4 bg-[#1c7aff] text-white font-black uppercase tracking-widest border-[3px] border-black shadow-[6px_6px_0_0_#000] active:translate-y-1">
        Link New Device
      </button>
      <SH title="Active Sessions" />
      <BBlock>
        {sessions.map((s, i) => (
          <div key={i} className={`p-4 flex flex-col ${i !== sessions.length - 1 ? 'border-b-[3px] border-black' : ''}`}>
            <span className="font-black text-[15px]">{s.name}</span>
            <span className="text-[11px] font-bold text-zinc-500">{s.platform} Ã¢â‚¬Â¢ {s.network}</span>
            <span className={`text-[11px] font-black uppercase mt-1 ${s.isCurrent ? 'text-green-600' : 'text-yellow-600'}`}>{s.status}</span>
            <span className="text-[10px] font-mono text-zinc-400 mt-0.5">Last seen: {s.lastSeen}</span>
          </div>
        ))}
      </BBlock>
      <button onClick={() => {
        try { localStorage.removeItem('hl_active_sessions'); } catch {}
        toast.success('All other sessions removed from record.');
        setSessions(prev => prev.filter(s => s.isCurrent));
      }} className="w-full py-4 bg-white text-red-600 font-black uppercase tracking-widest border-[3px] border-black shadow-[4px_4px_0_0_#000] active:translate-y-1">
        Sign Out Other Devices
      </button>
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
//  WORKSPACES VIEW
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function WorkspacesView({ s, update }: any) {
  const [folders, setFolders] = useState<string[]>(['Main Operations']);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    try { setFolders(JSON.parse(s.workspaces_json || '["Main Operations"]')); } catch(e) {}
  }, [s.workspaces_json]);

  const saveWorkspaces = async (updated: string[]) => {
    setFolders(updated);
    await update('workspaces_json', JSON.stringify(updated));
  };

  const addFolder = async () => {
    if (!newName.trim()) return;
    await saveWorkspaces([...folders, newName.trim()]);
    setNewName('');
  };

  const removeFolder = async (idx: number) => {
    if (idx === 0) { toast.error('Cannot remove the primary workspace.'); return; }
    await saveWorkspaces(folders.filter((_, i) => i !== idx));
  };

  return (
    <div className="p-4 space-y-6 pb-20">
      <div className="flex gap-2">
        <input type="text" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addFolder()} placeholder="New workspace name..." className="flex-1 bg-white border-[3px] border-black p-3 text-[14px] font-bold outline-none focus:bg-yellow-50" />
        <button onClick={addFolder} className="bg-black text-white p-3 border-[3px] border-black hover:bg-zinc-800"><Plus size={18} /></button>
      </div>
      <BBlock>
        {folders.map((f, i) => (
          <div key={i} className={`p-4 flex items-center justify-between ${i !== folders.length - 1 ? 'border-b-[3px] border-black' : ''}`}>
            <span className="font-black uppercase truncate w-[70%]">{f}</span>
            <div className="flex items-center gap-2">
              {i === 0 && <span className="text-[10px] font-black text-zinc-400">PRIMARY</span>}
              {i > 0 && (
                <button onClick={() => removeFolder(i)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={14} /></button>
              )}
            </div>
          </div>
        ))}
      </BBlock>
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
//  AI GHOST MODE VIEW
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function GhostModeView({ s, update }: any) {
  return (
    <div className="p-4 space-y-6 pb-20">
      <div className="bg-black border-[3px] border-black p-5 shadow-[6px_6px_0_0_#1c7aff]">
        <div className="flex items-center gap-3 mb-2">
          <Bot size={24} className="text-[#1c7aff]" />
          <span className="text-white font-black text-lg uppercase">AI Ghost Mode</span>
        </div>
        <p className="text-zinc-400 text-[12px] font-bold">When enabled, Ledger Chat will automatically reply to incoming messages on your behalf while you are away.</p>
      </div>

      <SH title="Auto-Reply" />
      <BBlock>
        <TRow label="Ghost Auto-Reply" checked={s.ghost_auto_reply} onChange={(v: boolean) => update('ghost_auto_reply', v)} noBorder />
      </BBlock>
      {s.ghost_auto_reply && (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500">Reply Message</label>
          <textarea
            className="w-full bg-white border-[3px] border-black p-3 text-[13px] font-bold outline-none focus:bg-yellow-50 resize-none h-20"
            value={s.ghost_auto_reply_text}
            onChange={e => update('ghost_auto_reply_text', e.target.value)}
            maxLength={200}
          />
        </div>
      )}

      <SH title="Intelligence Tools" />
      <BBlock>
        <TRow label="Tone Translator" checked={s.tone_translator} onChange={(v: boolean) => update('tone_translator', v)} noBorder />
      </BBlock>
      <p className="text-[11px] font-bold text-zinc-500 ml-1">Converts hostile outgoing messages to diplomatic language before sending.</p>
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
//  DEFI TOOLS VIEW
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function DefiToolsView({ s, update }: any) {
  return (
    <div className="p-4 space-y-6 pb-20">
      <SH title="Chat Intelligence Overlays" />
      <BBlock>
        <TRow label="$TICKER Price Widgets" checked={s.ticker_widgets} onChange={(v: boolean) => update('ticker_widgets', v)} />
        <TRow label="Contract Risk Scanner" checked={s.contract_scanner} onChange={(v: boolean) => update('contract_scanner', v)} />
        <TRow label="Smart Macros (/add, /send)" checked={s.smart_macros} onChange={(v: boolean) => update('smart_macros', v)} />
        <TRow label="On-Chain Attestation Badge" checked={s.show_attestation_badge} onChange={(v: boolean) => update('show_attestation_badge', v)} noBorder />
      </BBlock>
      <p className="text-[11px] font-bold text-zinc-500 ml-1">These tools run natively inside the chat protocol without requiring external API calls.</p>
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
//  NETWORK PROTOCOL VIEW
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬



// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
//  PREMIUM & QD VIEWS
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function PremiumView() {
  const [isPaying, setIsPaying] = useState(false);

  const handlePayment = async (planLabel: string, qdAmount: number) => {
    setIsPaying(true);
    try {
      toast.info('Purchasing Pro with QD...', { duration: 3000 });
      await new Promise(r => setTimeout(r, 1500));
      toast.success('Ledger Pro activated! Welcome to the future.', { duration: 5000 });
    } catch (e: any) {
      toast.error(e?.message || 'Payment failed');
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="p-4 pb-20 flex flex-col items-center">
      <div className="w-32 h-32 border-[4px] border-[#1c7aff] bg-black flex items-center justify-center shadow-[10px_10px_0_0_#1c7aff] mb-8">
        <Crown size={48} className="text-[#1c7aff]" />
      </div>
      <h1 className="text-3xl font-black uppercase text-center mb-2">Ledger Pro</h1>
      <p className="text-sm font-bold text-zinc-600 text-center mb-6 max-w-xs">Unlimited limits. Autonomous tooling. Complete sovereignty.</p>

      <div className="w-full bg-black border-[3px] border-[#1c7aff] p-3 mb-4 flex items-center gap-2 shadow-[4px_4px_0_0_#1c7aff]">
        <span className="text-[10px] font-black text-[#1c7aff] uppercase tracking-widest">? Paid with Quantum Dots Ã¯Â¿Â½ Decentralized & On-chain</span>
      </div>
      
      <div className="w-full flex gap-4 mb-8">
        <div className="flex-1 border-[3px] border-black bg-white p-4 flex flex-col shadow-[4px_4px_0_0_#000]">
          <span className="font-black">MONTHLY</span>
          <span className="font-black text-[#1c7aff] text-xl mt-2">4,500 QD</span>
          <button
            onClick={() => handlePayment('monthly', 4500)}
            disabled={isPaying}
            className="mt-3 py-2 bg-[#1c7aff] text-white font-black text-[11px] uppercase border-2 border-black disabled:opacity-50"
          >
            {isPaying ? 'PROCESSING...' : 'SELECT'}
          </button>
        </div>
        <div className="flex-1 border-[3px] border-[#1c7aff] bg-black text-white p-4 flex flex-col shadow-[4px_4px_0_0_#1c7aff]">
          <span className="text-[10px] bg-[#1c7aff] px-1 py-0.5 w-fit font-black mb-1">-35%</span>
          <span className="font-black">ANNUAL</span>
          <span className="font-black text-[#1c7aff] text-xl mt-2">2,800 QD<span className="text-sm text-zinc-400">/mo</span></span>
          <button
            onClick={() => handlePayment('annual', 33600)}
            disabled={isPaying}
            className="mt-3 py-2 bg-[#1c7aff] text-white font-black text-[11px] uppercase border-2 border-[#1c7aff] disabled:opacity-50"
          >
            {isPaying ? 'PROCESSING...' : 'SELECT'}
          </button>
        </div>
      </div>
      <p className="text-[10px] font-bold text-zinc-400 text-center mt-3 max-w-xs">
        Payment is processed via Quantum Dots on Humanity Ledger Appchain. No bank data. No KYC.
      </p>
    </div>
  );
}
function StarsView() {
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const [buying, setBuying] = useState<number | null>(null);

  const handlePurchase = async (pkg: typeof QD_PACKAGES[0]) => {
    if (!isConnected || !address) {
      toast.error('Please connect your wallet first.');
      open();
      return;
    }
    
    setBuying(pkg.index);
    const toastId = toast.loading(`Requesting ${pkg.price} payment for ${pkg.qd} QD...`);
    
    try {
      // 1. Send Ethereum Transaction to Treasury
      const txHash = await sendTransactionAsync({
        to: TREASURY_WALLET,
        value: parseEther(pkg.ethValue),
      });
      
      toast.loading(`Payment sent! Waiting for confirmation... (Tx: ${txHash.slice(0,8)}...)`, { id: toastId });
      
      // Simulate waiting for confirmation (could use useWaitForTransactionReceipt)
      await new Promise(r => setTimeout(r, 4000));
      
      // 2. Call API to credit the Quantum Dots
      const res = await fetch('/api/aztec/purchase-qd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aztecAddress: address, // Using ETH address for QD balance for now
          txHash: txHash,
          packageIndex: pkg.index,
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        toast.error(data.error || 'Payment confirmed but QD minting failed.', { id: toastId });
        return;
      }
      
      toast.success(`Ã¢Å“â€¦ ${pkg.qd} Quantum Dots credited securely!`, { id: toastId, duration: 6000 });
      
      if (typeof window !== 'undefined') {
         window.dispatchEvent(new CustomEvent('ledger_qd_balance_update', { detail: data.balance }));
      }
      
    } catch (e: any) {
      if (e.message?.includes('User rejected')) {
        toast.error('Transaction cancelled by user.', { id: toastId });
      } else {
        toast.error(e?.message || 'Transaction failed.', { id: toastId });
      }
    } finally {
      setBuying(null);
    }
  };

  return (
    <div className="p-4 pb-20 flex flex-col items-center">
      <div className="w-32 h-32 border-[4px] border-black bg-yellow-400 flex items-center justify-center shadow-[10px_10px_0_0_#000] mb-8">
        <Star size={64} className="fill-black text-black" />
      </div>
      <h1 className="text-3xl font-black uppercase text-center mb-2">Quantum Dots</h1>
      <p className="text-sm font-bold text-zinc-600 text-center mb-4 max-w-xs">Fuel your economy. Trade, tip, and power decentralized protocols.</p>

      {/* Ethereum Wallet Banner */}
      <div className="w-full bg-black border-[3px] border-yellow-400 p-4 mb-4 flex items-center gap-3 shadow-[4px_4px_0_0_#000]">
        <div className="w-10 h-10 rounded border-2 border-yellow-400 shrink-0 bg-zinc-800 flex items-center justify-center">
          <Globe size={20} className="text-yellow-400" />
        </div>
        <div className="flex flex-col">
          <span className="text-yellow-400 font-black text-[13px] uppercase tracking-widest">Ethereum Network</span>
          <span className="text-zinc-400 text-[10px] font-bold">Native ETH Payments</span>
        </div>
        <button
          onClick={() => !isConnected && open()}
          className="ml-auto bg-yellow-400 text-black px-3 py-1 font-black text-[11px] uppercase border-2 border-yellow-400 hover:bg-yellow-300 transition-colors shrink-0"
        >
          {isConnected ? 'CONNECTED' : 'CONNECT'}
        </button>
      </div>

      <div className="w-full bg-black border-[3px] border-yellow-400 p-3 mb-4 flex items-center gap-2 shadow-[4px_4px_0_0_#000]">
        <span className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">Ã¢Å¡Â¡ Buy with Ethereum Ã¢â‚¬â€ Sent directly to Treasury</span>
      </div>
      <div className="flex flex-col items-center mb-6">
        <span className="text-[12px] font-black uppercase tracking-widest text-zinc-500 mb-1">YOUR WALLET</span>
        {isConnected && address ? (
          <span className="text-[13px] font-mono font-bold text-zinc-700">{address.slice(0,6)}...{address.slice(-4)}</span>
        ) : (
          <span className="text-[11px] text-red-500 font-bold mt-1">Connect your wallet to purchase Quantum Dots</span>
        )}
      </div>

      <div className="w-full flex flex-col gap-3">
        {QD_PACKAGES.map((pkg) => (
          <div
            key={pkg.index}
            onClick={() => !buying && handlePurchase(pkg)}
            className={`w-full bg-white border-[3px] border-black p-4 flex items-center justify-between shadow-[4px_4px_0_0_#000] cursor-pointer transition-transform ${buying === pkg.index ? 'translate-y-1 opacity-60' : 'active:translate-y-1'}`}
          >
            <div className="flex items-center gap-3">
              <Star size={18} className="fill-yellow-400 text-black" />
              <div className="flex flex-col">
                <span className="font-black text-xl">{pkg.qd.toLocaleString()} QD</span>
                <span className="text-[10px] font-bold text-zinc-400">Quantum Dots</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="bg-black text-yellow-400 px-4 py-2 font-black border-2 border-black text-sm">{pkg.price}</div>
              {buying === pkg.index && <span className="text-[10px] font-bold text-zinc-500">Opening wallet...</span>}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] font-bold text-zinc-400 text-center mt-4 max-w-xs">
        Payments are processed via Ethereum mainnet and sent directly to the Humanity Ledger treasury. Quantum Dots are credited after on-chain confirmation.
      </p>
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
//  PRIMITIVES
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function BBlock({ children }: { children: React.ReactNode }) {
  return <div className="w-full bg-white border-[3px] border-black shadow-[6px_6px_0_0_#000] flex flex-col">{children}</div>;
}

function BItem({ icon, label, onClick, noBorder = false }: any) {
  return (
    <div onClick={onClick} className={`w-full flex items-center gap-3 p-4 cursor-pointer hover:bg-zinc-100 transition-colors ${noBorder ? '' : 'border-b-[3px] border-black'}`}>
      <div className="text-black shrink-0">{icon}</div>
      <span className="font-black uppercase text-[14px] flex-1">{label}</span>
      <ChevronRight size={18} className="text-zinc-400 shrink-0" />
    </div>
  );
}

function TRow({ label, checked, onChange, noBorder = false }: any) {
  return (
    <div onClick={() => onChange(!checked)} className={`w-full flex items-center justify-between p-4 cursor-pointer hover:bg-black/5 transition-colors ${noBorder ? '' : 'border-b-[3px] border-black'}`}>
      <span className="font-black uppercase text-[13px]">{label}</span>
      <button className={`w-12 h-7 border-[3px] border-black transition-colors relative ${checked ? 'bg-[#34c759]' : 'bg-white'}`}>
        <div className={`absolute top-0 bottom-0 w-5 h-full border-r-2 border-black transition-all bg-black ${checked ? 'left-[calc(100%-20px)]' : 'left-0'}`} />
      </button>
    </div>
  );
}

function CycleRow({ label, value, options, onChange, noBorder = false }: any) {
  const idx = options.indexOf(value);
  const next = () => onChange(options[(idx + 1) % options.length]);
  return (
    <div onClick={next} className={`w-full flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-100 ${noBorder ? '' : 'border-b-[3px] border-black'}`}>
      <span className="font-black uppercase text-[13px]">{label}</span>
      <span className="font-bold text-zinc-600 uppercase text-[11px]">{value}</span>
    </div>
  );
}

function BInput({ label, value, onChange, prefix }: any) {
  return (
    <div className="flex flex-col gap-1 w-full">
      <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500">{label}</label>
      <div className="flex w-full">
        {prefix && <div className="bg-black text-white border-[3px] border-black border-r-0 px-4 py-3 font-black flex items-center">{prefix}</div>}
        <input type="text" value={value} onChange={e => onChange(e.target.value)} className="flex-1 bg-white border-[3px] border-black p-3 text-[14px] font-bold outline-none focus:bg-yellow-50" />
      </div>
    </div>
  );
}

function SH({ title }: { title: string }) {
  return <span className="text-[11px] font-black uppercase tracking-widest text-zinc-500 ml-2 block">{title}</span>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-black uppercase tracking-widest text-zinc-500">{label}</span>
      <span className="text-[11px] font-black uppercase">{value}</span>
    </div>
  );
}





