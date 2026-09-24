'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ChevronRight, Star, Radio, LaptopMinimal, Plus,
  Bell, Lock, Eye, EyeOff, Mail, Key, User, Phone, Trash2,
  Globe, Shield, Users, MessageCircle, Clock, Camera, Image,
  Database, Wifi, BarChart, Download, Settings, HelpCircle,
  Send, FileText, Package, Heart, Crown, Zap, Monitor, Palette,
  Volume2, Vibrate, Hash, Check, ToggleLeft, X, AlertTriangle, Mic
} from 'lucide-react';

interface LedgerSettingsFullProps {
  myAddress: string;
  myName?: string;
  onClose: () => void;
}

const Toggle2 = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <button onClick={() => onChange(!value)}
    className={`relative w-[51px] h-[31px] rounded-full transition-colors ${value ? 'bg-[#34C759]' : 'bg-[#E9E9EB]'}`}>
    <span className={`absolute top-[2px] w-[27px] h-[27px] bg-white rounded-full shadow transition-transform ${value ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
  </button>
);

interface SettingRowProps {
  icon?: React.ReactNode;
  iconBg?: string;
  label: string;
  value?: string;
  onTap?: () => void;
  danger?: boolean;
  toggle?: boolean;
  onToggle?: (v: boolean) => void;
  badge?: number;
}

const SettingRow: React.FC<SettingRowProps> = ({ icon, iconBg, label, value, onTap, danger, toggle, onToggle, badge }) => (
  <button onClick={onTap}
    className={`w-full flex items-center gap-3 px-4 py-3 ${onTap || onToggle !== undefined ? 'hover:bg-[#F9F9F9] active:bg-[#F2F2F7]' : ''} transition-colors text-left`}>
    {icon && (
      <div className="w-[30px] h-[30px] rounded-[8px] flex items-center justify-center shrink-0 text-white"
        style={{ background: iconBg || '#007AFF' }}>
        {icon}
      </div>
    )}
    <span className={`flex-1 text-[16px] ${danger ? 'text-[#FF3B30]' : 'text-[#1C1C1E]'}`}>{label}</span>
    {badge !== undefined && badge > 0 && (
      <span className="mr-1 min-w-[20px] h-5 px-1.5 bg-[#FF3B30] rounded-full text-white text-[11px] font-bold flex items-center justify-center">{badge}</span>
    )}
    {value && <span className="text-[14px] text-[#8E8E93] mr-1">{value}</span>}
    {onToggle !== undefined && toggle !== undefined ? (
      <Toggle2 value={toggle} onChange={onToggle} />
    ) : onTap ? (
      <ChevronRight size={16} className="text-[#C7C7CC] shrink-0" />
    ) : null}
  </button>
);

const Section = ({ title, children }: { title?: string; children: React.ReactNode }) => (
  <div className="mb-6">
    {title && <p className="px-4 mb-1 text-[13px] font-semibold uppercase tracking-wider text-[#6D6D72]">{title}</p>}
    <div className="bg-white rounded-2xl overflow-hidden mx-2 shadow-sm border border-black/[0.06]">
      {React.Children.map(children, (child, i) =>
        i > 0 ? <><div className="h-px bg-[#E5E5EA] ml-[60px]" />{child}</> : child
      )}
    </div>
  </div>
);

const shortAddr = (a: string) => a ? `${a.slice(0,6)}...${a.slice(-4)}` : '';

export const LedgerSettingsFull: React.FC<LedgerSettingsFullProps> = ({ myAddress, myName, onClose }) => {
  // Toggles
  const [securityNotifs, setSecurityNotifs] = useState(true);
  const [twoStep, setTwoStep] = useState(false);
  const [passkeys, setPasskeys] = useState(false);
  const [lastSeenPublic, setLastSeenPublic] = useState(true);
  const [profilePublic, setProfilePublic] = useState(true);
  const [aboutPublic, setAboutPublic] = useState(true);
  const [groupsPublic, setGroupsPublic] = useState(true);
  const [statusPublic, setStatusPublic] = useState(true);
  const [allowCameraEffects, setAllowCameraEffects] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);
  const [appLock, setAppLock] = useState(false);
  const [silenceUnknown, setSilenceUnknown] = useState(false);
  const [protectIP, setProtectIP] = useState(true);
  const [disableLinkPreviews, setDisableLinkPreviews] = useState(false);
  const [saveToPhotos, setSaveToPhotos] = useState(false);
  const [stickerSuggestions, setStickerSuggestions] = useState(true);
  const [voiceTranscripts, setVoiceTranscripts] = useState(false);
  const [archiveKeep, setArchiveKeep] = useState(false);
  const [animations, setAnimations] = useState(true);
  const [inAppNotifs, setInAppNotifs] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [msgNotifs, setMsgNotifs] = useState(true);
  const [groupNotifs, setGroupNotifs] = useState(true);
  const [useLessData, setUseLessData] = useState(false);
  const [e2eBackup, setE2eBackup] = useState(false);

  const [activeSection, setActiveSection] = useState<string | null>(null);
  const displayName = myName || shortAddr(myAddress);

  if (activeSection) {
    return (
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed inset-0 z-[300] bg-[#F2F2F7] overflow-y-auto">
        <div className="sticky top-0 z-10 bg-[#F2F2F7]/90 backdrop-blur-xl border-b border-black/[0.06] px-4 pt-12 pb-3 flex items-center gap-3">
          <button onClick={() => setActiveSection(null)} className="flex items-center gap-1 text-[#007AFF] text-[16px]">
            <ArrowLeft size={20} /><span>Settings</span>
          </button>
          <span className="flex-1 text-center text-[17px] font-semibold text-[#1C1C1E]">{activeSection}</span>
          <div className="w-20" />
        </div>
        <div className="py-6">
          {activeSection === 'Privacy' && (
            <>
              <Section title="Who Can See">
                <SettingRow icon={<Eye size={16} />} iconBg="#8E8E93" label="Last Seen & Online" value={lastSeenPublic ? 'Everyone' : 'Nobody'} onTap={() => setLastSeenPublic(v => !v)} />
                <SettingRow icon={<User size={16} />} iconBg="#007AFF" label="Profile Picture" value={profilePublic ? 'Everyone' : 'Contacts'} onTap={() => setProfilePublic(v => !v)} />
                <SettingRow icon={<Hash size={16} />} iconBg="#AF52DE" label="About" value={aboutPublic ? 'Everyone' : 'Contacts'} onTap={() => setAboutPublic(v => !v)} />
                <SettingRow icon={<Users size={16} />} iconBg="#34C759" label="Groups" value={groupsPublic ? 'Everyone' : 'Contacts'} onTap={() => setGroupsPublic(v => !v)} />
                <SettingRow icon={<BarChart size={16} />} iconBg="#FF9500" label="Status" value={statusPublic ? 'Contacts' : 'Nobody'} onTap={() => setStatusPublic(v => !v)} />
              </Section>
              <Section title="Messages">
                <SettingRow icon={<Clock size={16} />} iconBg="#FF9500" label="Default Message Timer" value="Off" onTap={() => {}} />
                <SettingRow icon={<Clock size={16} />} iconBg="#AF52DE" label="Disappearing Messages" value="Off" onTap={() => {}} />
                <SettingRow icon={<Camera size={16} />} iconBg="#007AFF" label="Allow Camera Effects" toggle={allowCameraEffects} onToggle={setAllowCameraEffects} />
              </Section>
              <Section title="Safety">
                <SettingRow icon={<Eye size={16} />} iconBg="#8E8E93" label="Live Location" value="Not Sharing" onTap={() => {}} />
                <SettingRow icon={<EyeOff size={16} />} iconBg="#8E8E93" label="Blocked Contacts" value="0" onTap={() => {}} />
                <SettingRow icon={<Check size={16} />} iconBg="#34C759" label="Read Receipts" toggle={readReceipts} onToggle={setReadReceipts} />
              </Section>
              <Section title="App">
                <SettingRow icon={<Lock size={16} />} iconBg="#007AFF" label="App Lock" toggle={appLock} onToggle={setAppLock} />
                <SettingRow icon={<Lock size={16} />} iconBg="#AF52DE" label="Chat Lock" onTap={() => {}} />
              </Section>
              <Section title="Calls">
                <SettingRow icon={<Phone size={16} />} iconBg="#34C759" label="Silence Unknown Callers" toggle={silenceUnknown} onToggle={setSilenceUnknown} />
                <SettingRow icon={<Shield size={16} />} iconBg="#007AFF" label="Protect IP Address in Calls" toggle={protectIP} onToggle={setProtectIP} />
              </Section>
              <Section title="Advanced">
                <SettingRow icon={<Globe size={16} />} iconBg="#8E8E93" label="Disable Link Previews" toggle={disableLinkPreviews} onToggle={setDisableLinkPreviews} />
                <SettingRow icon={<AlertTriangle size={16} />} iconBg="#FF3B30" label="Block Unknown Account Messages" onTap={() => {}} />
                <SettingRow icon={<Shield size={16} />} iconBg="#8E8E93" label="Strict Account Settings Links" onTap={() => {}} />
              </Section>
            </>
          )}

          {activeSection === 'Security' && (
            <>
              <Section>
                <SettingRow icon={<Bell size={16} />} iconBg="#FF9500" label="Security Notifications" toggle={securityNotifs} onToggle={setSecurityNotifs} />
                <SettingRow icon={<Key size={16} />} iconBg="#007AFF" label="Two-Step Verification" toggle={twoStep} onToggle={setTwoStep} />
                <SettingRow icon={<Mail size={16} />} iconBg="#34C759" label="Email Address" value={twoStep ? 'Set' : 'Not Set'} onTap={() => {}} />
                <SettingRow icon={<Key size={16} />} iconBg="#AF52DE" label="Passkeys" toggle={passkeys} onToggle={setPasskeys} />
              </Section>
            </>
          )}

          {activeSection === 'Notifications' && (
            <>
              <Section title="General">
                <SettingRow icon={<Bell size={16} />} iconBg="#FF3B30" label="In-App Notifications" toggle={inAppNotifs} onToggle={setInAppNotifs} />
                <SettingRow icon={<Eye size={16} />} iconBg="#8E8E93" label="Show Preview" toggle={showPreview} onToggle={setShowPreview} />
                <SettingRow icon={<Bell size={16} />} iconBg="#007AFF" label="Reset Notification Settings" danger onTap={() => {}} />
              </Section>
              <Section title="Messages">
                <SettingRow icon={<MessageCircle size={16} />} iconBg="#34C759" label="Show Notifications" toggle={msgNotifs} onToggle={setMsgNotifs} />
                <SettingRow icon={<Volume2 size={16} />} iconBg="#007AFF" label="Sound" value="Note" onTap={() => {}} />
                <SettingRow icon={<Heart size={16} />} iconBg="#FF2D55" label="Reaction Notifications" onTap={() => {}} />
              </Section>
              <Section title="Groups">
                <SettingRow icon={<Users size={16} />} iconBg="#FF9500" label="Show Notifications" toggle={groupNotifs} onToggle={setGroupNotifs} />
                <SettingRow icon={<Volume2 size={16} />} iconBg="#007AFF" label="Sound" value="Note" onTap={() => {}} />
                <SettingRow icon={<Heart size={16} />} iconBg="#FF2D55" label="Reaction Notifications" onTap={() => {}} />
              </Section>
              <Section>
                <SettingRow icon={<Clock size={16} />} iconBg="#8E8E93" label="Clear Badge" danger onTap={() => {}} />
                <SettingRow icon={<Bell size={16} />} iconBg="#AF52DE" label="Reminders" value="Off" onTap={() => {}} />
              </Section>
            </>
          )}

          {activeSection === 'Storage & Data' && (
            <>
              <Section>
                <SettingRow icon={<Database size={16} />} iconBg="#007AFF" label="Manage Storage" onTap={() => {}} />
                <SettingRow icon={<Wifi size={16} />} iconBg="#34C759" label="Network Usage" onTap={() => {}} />
                <SettingRow icon={<BarChart size={16} />} iconBg="#8E8E93" label="Reset Statistics" danger onTap={() => {}} />
              </Section>
              <Section title="Calls">
                <SettingRow icon={<Phone size={16} />} iconBg="#34C759" label="Use Less Data for Calls" toggle={useLessData} onToggle={setUseLessData} />
              </Section>
              <Section title="Media Auto-Download">
                <SettingRow icon={<Image size={16} />} iconBg="#007AFF" label="Photos" value="Wi-Fi" onTap={() => {}} />
                <SettingRow icon={<Volume2 size={16} />} iconBg="#FF9500" label="Audio" value="Wi-Fi" onTap={() => {}} />
                <SettingRow icon={<Camera size={16} />} iconBg="#FF3B30" label="Video" value="Never" onTap={() => {}} />
                <SettingRow icon={<FileText size={16} />} iconBg="#8E8E93" label="Documents" value="Wi-Fi" onTap={() => {}} />
                <SettingRow icon={<X size={16} />} iconBg="#8E8E93" label="Reset Auto-Download Settings" danger onTap={() => {}} />
              </Section>
              <Section>
                <SettingRow icon={<Shield size={16} />} iconBg="#8E8E93" label="Proxy" value="Off" onTap={() => {}} />
                <SettingRow icon={<Download size={16} />} iconBg="#007AFF" label="Upload Quality" value="Auto" onTap={() => {}} />
              </Section>
            </>
          )}

          {activeSection === 'Chats' && (
            <>
              <Section title="Display">
                <SettingRow icon={<Image size={16} />} iconBg="#007AFF" label="Save to Photos" toggle={saveToPhotos} onToggle={setSaveToPhotos} />
                <SettingRow icon={<Hash size={16} />} iconBg="#AF52DE" label="Sticker Suggestions" toggle={stickerSuggestions} onToggle={setStickerSuggestions} />
              </Section>
              <Section title="History">
                <SettingRow icon={<Download size={16} />} iconBg="#34C759" label="Chat Backup" onTap={() => {}} />
                <SettingRow icon={<Shield size={16} />} iconBg="#007AFF" label="End-to-End Encrypted Backup" toggle={e2eBackup} onToggle={setE2eBackup} />
                <SettingRow icon={<Download size={16} />} iconBg="#8E8E93" label="Export Chat" onTap={() => {}} />
                <SettingRow icon={<Trash2 size={16} />} iconBg="#FF3B30" label="Clear All Chats" danger onTap={() => {}} />
              </Section>
              <Section title="Voice Messages">
                <SettingRow icon={<Mic size={16} />} iconBg="#007AFF" label="Voice Message Transcripts" toggle={voiceTranscripts} onToggle={setVoiceTranscripts} />
              </Section>
              <Section title="Archive">
                <SettingRow icon={<Package size={16} />} iconBg="#8E8E93" label="Keep Chats Archived" toggle={archiveKeep} onToggle={setArchiveKeep} />
                <SettingRow icon={<Package size={16} />} iconBg="#8E8E93" label="Archive All Chats" danger onTap={() => {}} />
              </Section>
              <Section title="Transfer">
                <SettingRow icon={<Monitor size={16} />} iconBg="#007AFF" label="Move Chats to Android" onTap={() => {}} />
                <SettingRow icon={<Monitor size={16} />} iconBg="#8E8E93" label="Transfer Chat History" onTap={() => {}} />
                <SettingRow icon={<Monitor size={16} />} iconBg="#007AFF" label="Transfer Chats to iPhone" onTap={() => {}} />
              </Section>
            </>
          )}

          {activeSection === 'Appearance' && (
            <>
              <Section>
                <SettingRow icon={<Palette size={16} />} iconBg="#007AFF" label="Default Chat Theme" value="Ledger Dark" onTap={() => {}} />
                <SettingRow icon={<Zap size={16} />} iconBg="#FF9500" label="Animations" toggle={animations} onToggle={setAnimations} />
                <SettingRow icon={<Monitor size={16} />} iconBg="#8E8E93" label="App Icon" value="Default" onTap={() => {}} />
                <SettingRow icon={<Moon size={16} />} iconBg="#1C1C1E" label="App Theme" value="System" onTap={() => {}} />
              </Section>
            </>
          )}

          {activeSection === 'Linked Devices' && (
            <Section>
              <div className="px-4 py-8 flex flex-col items-center gap-3">
                <div className="w-16 h-16 bg-[#F2F2F7] rounded-2xl flex items-center justify-center">
                  <Laptop size={28} className="text-[#8E8E93]" />
                </div>
                <p className="text-[16px] font-semibold text-[#1C1C1E]">Link a Device</p>
                <p className="text-[13px] text-[#8E8E93] text-center">Use Ledger on your desktop, tablet, or second phone. All messages are end-to-end encrypted.</p>
                <button className="mt-2 px-6 py-2.5 bg-[#007AFF] rounded-2xl text-white font-semibold text-[15px]">Link Device</button>
              </div>
            </Section>
          )}

          {activeSection === 'Account' && (
            <>
              <Section>
                <SettingRow icon={<User size={16} />} iconBg="#007AFF" label="Username" value="@ledger" onTap={() => {}} />
                <SettingRow icon={<Phone size={16} />} iconBg="#34C759" label="Change Wallet Address" onTap={() => {}} />
                <SettingRow icon={<Download size={16} />} iconBg="#8E8E93" label="Request Account Info" onTap={() => {}} />
                <SettingRow icon={<Package size={16} />} iconBg="#FF9500" label="Third-Party Chats" onTap={() => {}} />
              </Section>
              <Section title="Danger">
                <SettingRow icon={<Trash2 size={16} />} iconBg="#FF3B30" label="Delete Account" danger onTap={() => {}} />
              </Section>
            </>
          )}

          {activeSection === 'Help' && (
            <>
              <Section>
                <SettingRow icon={<HelpCircle size={16} />} iconBg="#007AFF" label="Help Centre" onTap={() => window.open('https://humanidfi.com/help', '_blank')} />
                <SettingRow icon={<Send size={16} />} iconBg="#34C759" label="Send Feedback" onTap={() => {}} />
                <SettingRow icon={<FileText size={16} />} iconBg="#8E8E93" label="Terms and Privacy Policy" onTap={() => {}} />
                <SettingRow icon={<Flag size={16} />} iconBg="#FF3B30" label="Channel Reports" onTap={() => {}} />
                <SettingRow icon={<Package size={16} />} iconBg="#8E8E93" label="Licenses" onTap={() => {}} />
                <SettingRow icon={<Heart size={16} />} iconBg="#FF2D55" label="Invite a Friend" onTap={() => {}} />
                <SettingRow icon={<Crown size={16} />} iconBg="#FF9500" label="Subscriptions" onTap={() => {}} />
              </Section>
            </>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-[#F2F2F7] overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#F2F2F7]/90 backdrop-blur-xl border-b border-black/[0.06] px-4 pt-12 pb-3 flex items-center gap-3">
        <button onClick={onClose} className="flex items-center gap-1 text-[#007AFF] text-[16px]">
          <ArrowLeft size={20} /><span>Back</span>
        </button>
        <span className="flex-1 text-center text-[17px] font-semibold text-[#1C1C1E]">Settings</span>
        <div className="w-16" />
      </div>

      <div className="pb-12 pt-2">
        {/* Profile Card */}
        <Section>
          <button onClick={() => setActiveSection('Account')} className="w-full flex items-center gap-4 px-4 py-4 hover:bg-[#F9F9F9] text-left">
            <div className="w-[62px] h-[62px] rounded-full bg-gradient-to-br from-[#007AFF] to-[#5856D6] flex items-center justify-center shrink-0">
              <span className="text-2xl font-bold text-white">{displayName.slice(0,2).toUpperCase()}</span>
            </div>
            <div className="flex-1">
              <p className="text-[18px] font-semibold text-[#1C1C1E]">{displayName}</p>
              <p className="text-[13px] text-[#8E8E93] font-mono">{shortAddr(myAddress)}</p>
              <p className="text-[13px] text-[#8E8E93] mt-0.5">Tap to edit profile</p>
            </div>
            <ChevronRight size={16} className="text-[#C7C7CC]" />
          </button>
        </Section>

        {/* Favorites, Lists, Starred */}
        <Section>
          <SettingRow icon={<Heart size={16} />} iconBg="#FF2D55" label="Favourites" onTap={() => {}} />
          <SettingRow icon={<List size={16} />} iconBg="#007AFF" label="Lists" onTap={() => {}} />
          <SettingRow icon={<Star size={16} />} iconBg="#FF9500" label="Starred Messages" onTap={() => {}} />
          <SettingRow icon={<Broadcast size={16} />} iconBg="#34C759" label="Broadcast Messages" onTap={() => {}} />
        </Section>

        {/* Account & Linked */}
        <Section>
          <SettingRow icon={<Laptop size={16} />} iconBg="#8E8E93" label="Linked Devices" onTap={() => setActiveSection('Linked Devices')} />
          <SettingRow icon={<Plus size={16} />} iconBg="#007AFF" label="Add Account" onTap={() => {}} />
        </Section>

        {/* Core Settings */}
        <Section>
          <SettingRow icon={<User size={16} />} iconBg="#007AFF" label="Account" onTap={() => setActiveSection('Account')} />
          <SettingRow icon={<Eye size={16} />} iconBg="#8E8E93" label="Privacy" onTap={() => setActiveSection('Privacy')} />
          <SettingRow icon={<Lock size={16} />} iconBg="#34C759" label="Security" onTap={() => setActiveSection('Security')} />
        </Section>

        {/* Chat & Notifications */}
        <Section>
          <SettingRow icon={<MessageCircle size={16} />} iconBg="#25D366" label="Chats" onTap={() => setActiveSection('Chats')} />
          <SettingRow icon={<Bell size={16} />} iconBg="#FF3B30" label="Notifications" onTap={() => setActiveSection('Notifications')} />
          <SettingRow icon={<Database size={16} />} iconBg="#8E8E93" label="Storage & Data" onTap={() => setActiveSection('Storage & Data')} />
        </Section>

        {/* Appearance */}
        <Section>
          <SettingRow icon={<Palette size={16} />} iconBg="#007AFF" label="Appearance" onTap={() => setActiveSection('Appearance')} />
        </Section>

        {/* Parental Controls */}
        <Section>
          <SettingRow icon={<Shield size={16} />} iconBg="#AF52DE" label="Parental Controls" onTap={() => {}} />
        </Section>

        {/* Help */}
        <Section>
          <SettingRow icon={<HelpCircle size={16} />} iconBg="#007AFF" label="Help and Feedback" onTap={() => setActiveSection('Help')} />
        </Section>
      </div>
    </div>
  );
};

// Missing import
function Moon(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>; }
function List(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>; }
function Broadcast(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></svg>; }
function Laptop(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="20" x2="22" y2="20"/></svg>; }
function Flag(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>; }
