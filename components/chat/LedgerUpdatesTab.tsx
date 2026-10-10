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

const AVATAR_COLORS = ['#25D366','#34C759','#FF9500','#FF3B30','#AF52DE','#FF2D55'];
const avatarColor = (addr: string) => AVATAR_COLORS[parseInt(addr?.slice(2,4) || '0', 16) % AVATAR_COLORS.length];
const shortAddr = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';
const initials = (name: string, addr: string) => name ? name.slice(0,2).toUpperCase() : addr ? addr.slice(2,4).toUpperCase() : '??';

export const LedgerUpdatesTab: React.FC<LedgerUpdatesTabProps> = ({ myAddress, myName, contacts, onOpenChat }) => {
  const [myStatus, setMyStatus] = useState<StatusUpdate[]>([]);
  const [contactStatuses, setContactStatuses] = useState<StatusUpdate[]>([]);
  const [showComposer, setShowComposer] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [draftPrivacy, setDraftPrivacy] = useState<'everyone' | 'contacts' | 'except'>('contacts');
  const [showPrivacyMenu, setShowPrivacyMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    fetchUpdates();
  }, [myAddress]);

  const fetchUpdates = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/chat/stories', { headers: { 'x-web3-address': myAddress }});
      if (res.ok) {
        const { stories } = await res.json();
        const mine = stories.filter((u: any) => u.authorAddress?.toLowerCase() === myAddress.toLowerCase());
        const others = stories.filter((u: any) => u.authorAddress?.toLowerCase() !== myAddress.toLowerCase());
        setMyStatus(mine);
        setContactStatuses(others);
      }
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  const postStatus = async (contentUrl?: string, mediaType?: string) => {
    if (!contentUrl && !draftText.trim()) return;
    try {
      const res = await fetch('/api/chat/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-web3-address': myAddress },
        body: JSON.stringify({
          contentUrl: contentUrl || draftText.trim(),
          mediaType: mediaType || 'text',
          privacy: draftPrivacy
        })
      });
      if (res.ok) {
        const { story } = await res.json();
        setMyStatus(prev => [story, ...prev]);
        setDraftText('');
        setShowComposer(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      await postStatus(dataUrl, isVideo ? 'video' : 'image');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const formatTime = (tsStr: string | number) => {
    const ts = new Date(tsStr).getTime();
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
              className="w-[54px] h-[54px] rounded-full flex items-center justify-center text-white font-bold text-xl overflow-hidden"
              style={{ background: avatarColor(myAddress) }}
            >
              {myStatus.length > 0 && myStatus[0].avatarUrl ? (
                <img src={myStatus[0].avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                initials(myName, myAddress)
              )}
            </div>
            {myStatus.length === 0 ? (
              <button
                onClick={() => setShowComposer(true)}
                className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#25D366] rounded-full border-2 border-white flex items-center justify-center"
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
          <button onClick={() => setShowComposer(true)} className="text-[#25D366] p-2">
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
        ) : contactStatuses.map((cs: any) => (
          <button
            key={cs.id}
            onClick={() => onOpenChat(cs.authorAddress)}
            className="w-full flex items-center gap-3 px-4 py-3 border-b border-black/[0.06] hover:bg-[#F2F2F7] text-left"
          >
            <div className="w-[54px] h-[54px] rounded-full ring-2 ring-[#25D366] ring-offset-2 flex items-center justify-center text-white font-bold overflow-hidden" style={{ background: avatarColor(cs.authorAddress) }}>
              {cs.avatarUrl ? (
                <img src={cs.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                initials('', cs.authorAddress)
              )}
            </div>
            <div className="flex-1">
              <p className="text-[16px] font-semibold text-[#1C1C1E]">{shortAddr(cs.authorAddress)}</p>
              <p className="text-[13px] text-[#8E8E93] truncate">{cs.mediaType === 'image' || cs.mediaType === 'video' ? '📷 Media' : cs.contentUrl}</p>
            </div>
            <span className="text-[12px] text-[#8E8E93]">{formatTime(cs.createdAt)}</span>
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
                <button onClick={() => setShowComposer(false)} className="text-[#25D366] text-[16px]">Cancel</button>
                <h3 className="text-[17px] font-semibold">New Status</h3>
                <button onClick={() => postStatus()} disabled={!draftText.trim()} className="text-[#25D366] text-[16px] font-semibold disabled:opacity-40">Post</button>
              </div>

              <textarea
                autoFocus
                value={draftText}
                onChange={e => setDraftText(e.target.value)}
                placeholder="What's on your mind?"
                maxLength={700}
                className="w-full min-h-[120px] text-[16px] text-[#1C1C1E] placeholder:text-[#8E8E93] resize-none outline-none border border-black/10 rounded-xl p-3 focus:ring-2 focus:ring-[#25D366]/20"
              />
              
              <div className="flex items-center justify-between mt-2">
                <div className="relative">
                  <input type="file" accept="image/*,video/*" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <button className="flex items-center gap-2 text-[#25D366] bg-[#25D366]/10 px-4 py-2 rounded-xl">
                    <Camera size={18} />
                    <span className="text-[14px] font-semibold">Photo/Video</span>
                  </button>
                </div>
                
                <button
                  onClick={() => setShowPrivacyMenu(m => !m)}
                  className="flex items-center gap-2 text-[#25D366] bg-[#25D366]/10 px-4 py-2 rounded-xl"
                >
                  {draftPrivacy === 'everyone' ? <Globe size={16} /> : draftPrivacy === 'contacts' ? <Users size={16} /> : <Lock size={16} />}
                  <span className="text-[14px] font-semibold">{privacyLabel[draftPrivacy]}</span>
                  <ChevronRight size={14} />
                </button>
              </div>

              {showPrivacyMenu && (
                <div className="flex flex-col gap-1 bg-[#F2F2F7] rounded-xl p-2">
                  {(['everyone', 'contacts', 'except'] as const).map(opt => (
                    <button key={opt} onClick={() => { setDraftPrivacy(opt); setShowPrivacyMenu(false); }}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-left ${draftPrivacy === opt ? 'bg-white' : ''}`}
                    >
                      <span className="text-[15px] text-[#1C1C1E]">{privacyLabel[opt]}</span>
                      {draftPrivacy === opt && <Check size={16} className="text-[#25D366]" />}
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

