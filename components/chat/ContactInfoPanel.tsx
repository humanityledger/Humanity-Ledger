'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, Video, Search, ChevronRight, X, Lock, Bell, Image,
  Database, Star, Palette, Camera, Clock, Shield, Key, Users,
  Share2, Heart, List, Download, Trash2, Ban, Flag, Plus,
  MessageCircle, Link, FileText, ArrowLeft
} from 'lucide-react';

interface ContactInfoPanelProps {
  peerAddress: string;
  peerName: string;
  onClose: () => void;
  onVoiceCall: () => void;
  onVideoCall: () => void;
  onSearch: () => void;
  onBlock: () => void;
  groups?: Array<{ id: string; name: string }>;
}

const shortAddr = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';
const initials = (name: string, addr: string) => {
  if (name && name !== shortAddr(addr)) return name.slice(0, 2).toUpperCase();
  return addr ? addr.slice(2, 4).toUpperCase() : 'XX';
};

const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <button
    onClick={() => onChange(!value)}
    className={`relative w-[51px] h-[31px] rounded-full transition-colors duration-200 ${value ? 'bg-[#34C759]' : 'bg-[#E9E9EB]'}`}
  >
    <span className={`absolute top-[2px] w-[27px] h-[27px] bg-white rounded-full shadow-md transition-transform duration-200 ${value ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
  </button>
);

const Row = ({ icon, label, value, onTap, danger = false, toggle, onToggle }: {
  icon: React.ReactNode; label: string; value?: string;
  onTap?: () => void; danger?: boolean;
  toggle?: boolean; onToggle?: (v: boolean) => void;
}) => (
  <button
    onClick={onTap}
    className={`w-full flex items-center gap-3 px-4 py-3 ${onTap || onToggle ? 'hover:bg-[#F2F2F7] active:bg-[#E5E5EA]' : ''} transition-colors text-left`}
  >
    <span className={`shrink-0 ${danger ? 'text-[#FF3B30]' : 'text-[#007AFF]'}`}>{icon}</span>
    <span className={`flex-1 text-[16px] font-normal ${danger ? 'text-[#FF3B30]' : 'text-[#1C1C1E]'}`}>{label}</span>
    {value && <span className="text-[14px] text-[#8E8E93] mr-1">{value}</span>}
    {onToggle !== undefined && toggle !== undefined ? (
      <Toggle value={toggle} onChange={onToggle} />
    ) : onTap ? (
      <ChevronRight size={16} className="text-[#C7C7CC] shrink-0" />
    ) : null}
  </button>
);

const Section = ({ title, children }: { title?: string; children: React.ReactNode }) => (
  <div className="mb-6">
    {title && <p className="px-4 mb-1 text-[13px] font-semibold uppercase tracking-wider text-[#6D6D72]">{title}</p>}
    <div className="bg-white rounded-2xl overflow-hidden mx-2 shadow-sm border border-black/[0.06]">
      {children}
    </div>
  </div>
);

const Divider = () => <div className="h-px bg-[#E5E5EA] ml-4" />;

export const ContactInfoPanel: React.FC<ContactInfoPanelProps> = ({
  peerAddress, peerName, onClose, onVoiceCall, onVideoCall, onSearch, onBlock, groups = []
}) => {
  const [saveToPhotos, setSaveToPhotos] = useState(false);
  const [lockChat, setLockChat] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [disappearing, setDisappearing] = useState<'off' | '24h' | '7d' | '90d'>('off');
  const [showDisappearingMenu, setShowDisappearingMenu] = useState(false);
  const displayName = peerName || shortAddr(peerAddress);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-[#F2F2F7] overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#F2F2F7]/90 backdrop-blur-xl border-b border-black/[0.06] px-4 pt-12 pb-3 flex items-center gap-3">
        <button onClick={onClose} className="flex items-center gap-1 text-[#007AFF] text-[16px]">
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>
        <span className="flex-1 text-center text-[17px] font-semibold text-[#1C1C1E]">Contact Info</span>
        <div className="w-16" />
      </div>

      <div className="pb-12">
        {/* Avatar + Name */}
        <div className="flex flex-col items-center py-8 px-4">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#007AFF] to-[#5856D6] flex items-center justify-center mb-3 shadow-lg">
            <span className="text-3xl font-bold text-white">{initials(displayName, peerAddress)}</span>
          </div>
          <h2 className="text-[22px] font-bold text-[#1C1C1E] mb-1">{displayName}</h2>
          <p className="text-[13px] font-mono text-[#8E8E93]">{peerAddress}</p>
        </div>

        {/* 3 Action Buttons */}
        <div className="flex justify-center gap-4 px-6 mb-8">
          {[
            { icon: <Phone size={22} />, label: 'Voice', action: onVoiceCall, color: '#007AFF' },
            { icon: <Video size={22} />, label: 'Video', action: onVideoCall, color: '#007AFF' },
            { icon: <Search size={22} />, label: 'Search', action: onSearch, color: '#007AFF' },
          ].map(({ icon, label, action, color }) => (
            <button
              key={label}
              onClick={action}
              className="flex flex-col items-center gap-2 flex-1"
            >
              <div className="w-[56px] h-[56px] rounded-2xl bg-white shadow-sm border border-black/[0.06] flex items-center justify-center" style={{ color }}>
                {icon}
              </div>
              <span className="text-[12px] font-semibold text-[#007AFF]">{label}</span>
            </button>
          ))}
        </div>

        {/* Media, Links & Docs */}
        <Section>
          <Row icon={<Image size={18} />} label="Media, Links & Docs" onTap={() => {}} />
          <Divider />
          <Row icon={<Database size={18} />} label="Manage Storage" onTap={() => {}} />
          <Divider />
          <Row icon={<Star size={18} />} label="Starred Messages" onTap={() => {}} />
        </Section>

        {/* Notifications & Appearance */}
        <Section title="Chat">
          <Row icon={<Bell size={18} />} label="Notifications" value={isMuted ? 'Muted' : 'Default'} onTap={() => setIsMuted(m => !m)} />
          <Divider />
          <Row icon={<Palette size={18} />} label="Chat Theme" onTap={() => {}} />
          <Divider />
          <Row icon={<Camera size={18} />} label="Save to Photos" toggle={saveToPhotos} onToggle={setSaveToPhotos} />
        </Section>

        {/* Privacy */}
        <Section title="Privacy & Security">
          <Row
            icon={<Clock size={18} />}
            label="Disappearing Messages"
            value={disappearing === 'off' ? 'Off' : disappearing}
            onTap={() => setShowDisappearingMenu(m => !m)}
          />
          {showDisappearingMenu && (
            <div className="bg-[#F9F9F9] px-4 py-3 flex flex-col gap-2 border-t border-black/[0.06]">
              {(['off', '24h', '7d', '90d'] as const).map(opt => (
                <button key={opt} onClick={() => { setDisappearing(opt); setShowDisappearingMenu(false); }}
                  className={`text-[15px] py-2 px-3 rounded-xl text-left ${disappearing === opt ? 'bg-[#007AFF]/10 text-[#007AFF] font-semibold' : 'text-[#1C1C1E]'}`}>
                  {opt === 'off' ? 'Off' : opt === '24h' ? '24 Hours' : opt === '7d' ? '7 Days' : '90 Days'}
                </button>
              ))}
            </div>
          )}
          <Divider />
          <Row icon={<Lock size={18} />} label="Lock Chat" toggle={lockChat} onToggle={setLockChat} />
          <Divider />
          <Row icon={<Shield size={18} />} label="Advanced Chat Privacy" onTap={() => {}} />
          <Divider />
          <Row icon={<Key size={18} />} label="Encryption" value="End-to-end encrypted" onTap={() => {}} />
        </Section>

        {/* Contact Details */}
        <Section title="Contact">
          <Row icon={<MessageCircle size={18} />} label="Contact Details" value={peerAddress ? shortAddr(peerAddress) : ''} onTap={() => {}} />
        </Section>

        {/* Common Groups */}
        <Section title={groups.length > 0 ? `${groups.length} Group${groups.length !== 1 ? 's' : ''} in Common` : 'Groups'}>
          {groups.length > 0 ? groups.map((g, i) => (
            <React.Fragment key={g.id}>
              {i > 0 && <Divider />}
              <Row icon={<Users size={18} />} label={g.name} onTap={() => {}} />
            </React.Fragment>
          )) : (
            <Row icon={<Plus size={18} />} label="Add to Group" onTap={() => {}} />
          )}
        </Section>

        {/* Actions */}
        <Section>
          <Row icon={<Share2 size={18} />} label="Share Contact" onTap={() => {}} />
          <Divider />
          <Row icon={<Heart size={18} />} label="Add to Favourites" onTap={() => {}} />
          <Divider />
          <Row icon={<List size={18} />} label="Add to List" onTap={() => {}} />
          <Divider />
          <Row icon={<Download size={18} />} label="Export Chat" onTap={() => {}} />
          <Divider />
          <Row icon={<Trash2 size={18} />} label="Clear Chat" onTap={() => {}} />
        </Section>

        {/* Danger Zone */}
        <Section>
          <Row icon={<Ban size={18} />} label={`Block "${displayName}"`} onTap={onBlock} danger />
          <Divider />
          <Row icon={<Flag size={18} />} label={`Report "${displayName}"`} onTap={() => {}} danger />
        </Section>
      </div>

      {/* Disappearing timer menu backdrop */}
      <AnimatePresence>
        {showDisappearingMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-0"
            onClick={() => setShowDisappearingMenu(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};
