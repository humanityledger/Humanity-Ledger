'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, Camera, Edit3, Eye, Clock, Users, Globe,
  Lock, ChevronRight, Check, Trash2
} from 'lucide-react';

interface StatusUpdate {
  id: string;
  text: string;
  emoji?: string;
  createdAt: number;
  expiresAt: number;
  privacy: 'everyone' | 'contacts' | 'except';
}

interface LedgerUpdatesTabProps {
  myAddress: string;
  myName: string;
  contacts: Array<{ peerAddress: string; name?: string }>;
  onOpenChat: (address: string) => void;
}

const AVATAR_COLORS = ['#007AFF','#34C759','#FF9500','#FF3B30','#AF52DE','#FF2D55'];
const avatarColor = (addr: string) => AVATAR_COLORS[parseInt(addr?.slice(2,4) || '0', 16) % AVATAR_COLORS.length];
const shortAddr = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';
const initials = (name: string, addr: string) => name ? name.slice(0,2).toUpperCase() : addr ? addr.slice(2,4).toUpperCase() : '??';

export const LedgerUpdatesTab: React.FC<LedgerUpdatesTabProps> = ({ myAddress, myName, contacts, onOpenChat }) => {
  const [myStatus, setMyStatus] = useState<StatusUpdate[]>([]);
  const [showComposer, setShowComposer] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [draftPrivacy, setDraftPrivacy] = useState<'everyone' | 'contacts' | 'except'>('contacts');
  const [showPrivacyMenu, setShowPrivacyMenu] = useState(false);

  // Simulated contact statuses (in prod these come from XMTP __STATUS__ signals)
  const contactStatuses: Array<{ address: string; name: string; status: string; ts: number }> = [];

  const postStatus = () => {
    if (!draftText.trim()) return;
    const now = Date.now();
    const newStatus: StatusUpdate = {
      id: `status-${now}`,
      text: draftText.trim(),
      createdAt: now,
      expiresAt: now + 24 * 60 * 60 * 1000,
      privacy: draftPrivacy
    };
    setMyStatus(prev => [newStatus, ...prev]);
    setDraftText('');
    setShowComposer(false);
  };

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return 'Yesterday';
  };

  const privacyLabel = {
    everyone: 'Everyone',
    contacts: 'My Contacts',
    except: 'Contacts Except...'
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#F2F2F7]">
      {/* My Status */}
      <div className="bg-white mb-6">
        <div className="px-4 py-2">
          <p className="text-[13px] font-semibold uppercase tracking-wider text-[#6D6D72]">My Status</p>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-black/[0.06]">
          {/* Avatar with + button */}
          <div className="relative shrink-0">
            <div
              className="w-[54px] h-[54px] rounded-full flex items-center justify-center text-white font-bold text-xl"
              style={{ background: avatarColor(myAddress) }}
            >
              {initials(myName, myAddress)}
            </div>
            {myStatus.length === 0 ? (
              <button
                onClick={() => setShowComposer(true)}
                className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#007AFF] rounded-full border-2 border-white flex items-center justify-center"
              >
                <Plus size={14} className="text-white" />
              </button>
            ) : (
              <div className="absolute inset-0 rounded-full ring-2 ring-[#34C759] ring-offset-2" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-[16px] font-semibold text-[#1C1C1E]">My Status</p>
            <p className="text-[13px] text-[#8E8E93]">
              {myStatus.length === 0 ? 'Tap to add status update' : `${myStatus.length} update${myStatus.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button onClick={() => setShowComposer(true)} className="text-[#007AFF] p-2">
            <Edit3 size={18} />
          </button>
        </div>

        {/* My status list */}
        {myStatus.map(s => (
          <div key={s.id} className="flex items-start gap-3 px-4 py-3 border-b border-black/[0.06]">
            <div className="w-1 h-1 rounded-full bg-[#34C759] mt-2.5 shrink-0" />
            <div className="flex-1">
              <p className="text-[15px] text-[#1C1C1E]">{s.text}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <Clock size={11} className="text-[#8E8E93]" />
                <p className="text-[12px] text-[#8E8E93]">{formatTime(s.createdAt)}</p>
                {s.privacy === 'everyone' ? <Globe size={11} className="text-[#8E8E93]" /> : s.privacy === 'contacts' ? <Users size={11} className="text-[#8E8E93]" /> : <Lock size={11} className="text-[#8E8E93]" />}
              </div>
            </div>
            <button onClick={() => setMyStatus(prev => prev.filter(x => x.id !== s.id))} className="p-1 text-[#FF3B30]">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      {/* Recent Updates */}
      <div className="bg-white">
        <div className="px-4 py-2">
          <p className="text-[13px] font-semibold uppercase tracking-wider text-[#6D6D72]">Recent Updates</p>
        </div>
        {contactStatuses.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-3 px-8">
            <div className="w-16 h-16 rounded-full bg-[#F2F2F7] flex items-center justify-center">
              <Eye size={28} className="text-[#8E8E93]" />
            </div>
            <p className="text-[15px] font-semibold text-[#1C1C1E] text-center">No Recent Updates</p>
            <p className="text-[13px] text-[#8E8E93] text-center">Status updates from your contacts will appear here. They disappear after 24 hours.</p>
          </div>
        ) : contactStatuses.map((cs, i) => (
          <button
            key={i}
            onClick={() => onOpenChat(cs.address)}
            className="w-full flex items-center gap-3 px-4 py-3 border-b border-black/[0.06] hover:bg-[#F2F2F7] text-left"
          >
            <div className="w-[54px] h-[54px] rounded-full ring-2 ring-[#007AFF] ring-offset-2 flex items-center justify-center text-white font-bold" style={{ background: avatarColor(cs.address) }}>
              {initials(cs.name, cs.address)}
            </div>
            <div className="flex-1">
              <p className="text-[16px] font-semibold text-[#1C1C1E]">{cs.name || shortAddr(cs.address)}</p>
              <p className="text-[13px] text-[#8E8E93] truncate">{cs.status}</p>
            </div>
            <span className="text-[12px] text-[#8E8E93]">{formatTime(cs.ts)}</span>
          </button>
        ))}
      </div>

      {/* Status Composer Modal */}
      <AnimatePresence>
        {showComposer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end"
            onClick={(e) => { if (e.target === e.currentTarget) setShowComposer(false); }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="w-full bg-white rounded-t-3xl p-6 flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <button onClick={() => setShowComposer(false)} className="text-[#007AFF] text-[16px]">Cancel</button>
                <h3 className="text-[17px] font-semibold">New Status</h3>
                <button onClick={postStatus} disabled={!draftText.trim()} className="text-[#007AFF] text-[16px] font-semibold disabled:opacity-40">Post</button>
              </div>

              <textarea
                autoFocus
                value={draftText}
                onChange={e => setDraftText(e.target.value)}
                placeholder="What's on your mind?"
                maxLength={700}
                className="w-full min-h-[120px] text-[16px] text-[#1C1C1E] placeholder:text-[#8E8E93] resize-none outline-none border border-black/10 rounded-xl p-3"
              />

              <button
                onClick={() => setShowPrivacyMenu(m => !m)}
                className="flex items-center gap-2 text-[#007AFF]"
              >
                {draftPrivacy === 'everyone' ? <Globe size={16} /> : draftPrivacy === 'contacts' ? <Users size={16} /> : <Lock size={16} />}
                <span className="text-[15px]">{privacyLabel[draftPrivacy]}</span>
                <ChevronRight size={14} />
              </button>

              {showPrivacyMenu && (
                <div className="flex flex-col gap-1 bg-[#F2F2F7] rounded-xl p-2">
                  {(['everyone', 'contacts', 'except'] as const).map(opt => (
                    <button key={opt} onClick={() => { setDraftPrivacy(opt); setShowPrivacyMenu(false); }}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-left ${draftPrivacy === opt ? 'bg-white' : ''}`}
                    >
                      <span className="text-[15px] text-[#1C1C1E]">{privacyLabel[opt]}</span>
                      {draftPrivacy === opt && <Check size={16} className="text-[#007AFF]" />}
                    </button>
                  ))}
                </div>
              )}

              <p className="text-[12px] text-[#8E8E93]">
                Status updates are visible to your selected audience and disappear after 24 hours. They are end-to-end encrypted.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
