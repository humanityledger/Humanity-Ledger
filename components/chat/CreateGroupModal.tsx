'use client';

import React, { useState, useCallback } from 'react';
import { createSecureGroup } from '@/lib/xmtp/groups';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Lock, Globe, Check, X, UserPlus } from 'lucide-react';
import type { Client } from '@xmtp/browser-sdk';

interface CreateGroupModalProps {
  client: Client;
  myAddress: string;
  onClose: () => void;
  onGroupCreated: (groupId: string, groupName: string) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  client,
  myAddress,
  onClose,
  onGroupCreated,
}) => {
  // ── Wizard state ──────────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [memberInput, setMemberInput] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const isValidEthAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);

  const handleAddMember = useCallback(() => {
    const addr = memberInput.trim().toLowerCase();
    if (!isValidEthAddress(addr) && !isValidEthAddress(memberInput.trim())) {
      toast.error('Invalid Ethereum address format.');
      return;
    }
    if (addr === myAddress.toLowerCase()) {
      toast.error('You are already included as the group creator.');
      return;
    }
    if (members.map(m => m.toLowerCase()).includes(addr)) {
      toast.error('This address has already been added.');
      return;
    }
    if (members.length >= 99) {
      toast.error('Maximum group size is 100 members.');
      return;
    }
    setMembers(prev => [...prev, memberInput.trim()]);
    setMemberInput('');
  }, [memberInput, members, myAddress]);

  const handleRemoveMember = (addr: string) => {
    setMembers(prev => prev.filter(m => m !== addr));
  };

  const handleCreate = async () => {
    if (!groupName.trim()) { toast.error('Please enter a group name.'); return; }
    if (members.length < 1) { toast.error('Please add at least 1 member.'); return; }
    setIsCreating(true);
    try {
      const groupId = await createSecureGroup(client, members, groupName.trim(), description.trim());
      toast.success(`Group "${groupName}" created successfully!`);
      onGroupCreated(groupId, groupName.trim());
      onClose();
    } catch (err: any) {
      console.error('[CreateGroup] Error:', err);
      toast.error(err?.message || 'Failed to create group. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const canProceedStep1 = groupName.trim().length > 0;
  const canProceedStep3 = members.length >= 1;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 38 }}
        className="w-full max-w-md bg-[#f2f4f7] rounded-t-3xl sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden"
        style={{ maxHeight: '92vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 bg-white border-b border-black/[0.05] shrink-0">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(s => (s - 1) as 1 | 2 | 3)}
                className="p-1.5 rounded-xl hover:bg-black/5 text-black/40 transition-colors"
                title="Go back to previous step"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            <div>
              <h2 className="text-[17px] font-semibold text-[#15171c]">New Group</h2>
              <p className="text-[12px] text-[#727a88]">Step {step} of 3</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-black/5 text-black/40 hover:bg-black/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Step progress bar ── */}
        <div className="flex gap-1.5 px-5 py-3 bg-white border-b border-black/[0.05] shrink-0">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={`flex-1 h-1 rounded-full transition-colors duration-300 ${
                s <= step ? 'bg-[#15171c]' : 'bg-black/10'
              }`}
            />
          ))}
        </div>

        {/* ── Step content ── */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {/* ─── STEP 1: Name + Description ─────────────────────────────── */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="px-5 py-6 space-y-5"
              >
                <div className="text-center pb-2">
                  <div className="w-16 h-16 rounded-2xl bg-[#15171c] flex items-center justify-center mx-auto mb-4 shadow-md">
                    <span className="text-white text-2xl font-bold">
                      {groupName.trim().slice(0, 1).toUpperCase() || '#'}
                    </span>
                  </div>
                  <h3 className="text-[18px] font-semibold text-[#15171c]">Group Details</h3>
                  <p className="text-[13px] text-[#727a88] mt-1">Provide a clear name so members can identify the group</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[12px] font-semibold text-[#727a88] mb-1.5 px-1">Group Name *</label>
                    <input
                      type="text"
                      autoFocus
                      maxLength={64}
                      placeholder="e.g. Executive Committee, Family, Core Team..."
                      value={groupName}
                      onChange={e => setGroupName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && canProceedStep1 && setStep(2)}
                      className="w-full px-4 py-3.5 bg-white rounded-2xl border border-black/[0.08] text-[15px] text-[#15171c] outline-none focus:ring-2 focus:ring-black/20 transition-all placeholder:text-[#c0c5cf]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-[#727a88] mb-1.5 px-1">Description (optional)</label>
                    <input
                      type="text"
                      maxLength={128}
                      placeholder="What is this group about?"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      className="w-full px-4 py-3.5 bg-white rounded-2xl border border-black/[0.08] text-[15px] text-[#15171c] outline-none focus:ring-2 focus:ring-black/20 transition-all placeholder:text-[#c0c5cf]"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* ─── STEP 2: Privacy ─────────────────────────────────────────── */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="px-5 py-6 space-y-4"
              >
                <div className="text-center pb-2">
                  <h3 className="text-[18px] font-semibold text-[#15171c]">Who can join?</h3>
                  <p className="text-[13px] text-[#727a88] mt-1">You can change this anytime in group settings</p>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      id: true,
                      title: 'Private',
                      subtitle: 'Members must be invited by an admin or receive an invite link. Recommended for friends, family, and teams.',
                    },
                    {
                      id: false,
                      title: 'Public',
                      subtitle: 'Anyone can discover and join this group without prior approval.',
                    },
                  ].map(option => (
                    <button
                      key={String(option.id)}
                      type="button"
                      onClick={() => setIsPrivate(option.id)}
                      className={`w-full flex items-start justify-between p-4 rounded-2xl border-2 text-left transition-all ${
                        isPrivate === option.id
                          ? 'border-[#15171c] bg-white shadow-sm'
                          : 'border-transparent bg-white hover:border-black/10'
                      }`}
                    >
                      <div className="flex-1 pr-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[15px] font-semibold text-[#15171c]">{option.title}</p>
                          {isPrivate === option.id && <span className="text-[11px] font-bold text-[#15171c] tracking-wider uppercase">Active</span>}
                        </div>
                        <p className="text-[13px] text-[#727a88] leading-snug">{option.subtitle}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ─── STEP 3: Members + Create ─────────────────────────────────── */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="px-5 py-6 space-y-5"
              >
                <div className="text-center pb-2">
                  <h3 className="text-[18px] font-semibold text-[#15171c]">Add Members</h3>
                  <p className="text-[13px] text-[#727a88] mt-1">Enter member wallet addresses or identifiers</p>
                </div>

                {/* Add member input */}
                <div>
                  <label className="block text-[12px] font-semibold text-[#727a88] mb-1.5 px-1">Wallet Address (0x...)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="0x..."
                      value={memberInput}
                      onChange={e => setMemberInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddMember()}
                      className="flex-1 px-4 py-3.5 bg-white rounded-2xl border border-black/[0.08] text-[13px] tabular-nums text-[#15171c] outline-none focus:ring-2 focus:ring-black/20 transition-all placeholder:text-[#c0c5cf]"
                    />
                    <button
                      type="button"
                      onClick={handleAddMember}
                      className="px-5 py-3 bg-[#15171c] text-white text-[13px] font-semibold rounded-2xl hover:bg-black transition-colors shrink-0"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Members list */}
                {members.length > 0 && (
                  <div>
                    <p className="text-[12px] font-semibold text-[#727a88] mb-2 px-1">
                      {members.length} {members.length === 1 ? 'member added' : 'members added'}
                    </p>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {members.map(addr => (
                        <div key={addr} className="flex items-center justify-between px-4 py-3 bg-white rounded-2xl border border-black/[0.05]">
                          <span className="text-[13px] tabular-nums text-[#15171c] font-medium">{addr.slice(0, 10)}…{addr.slice(-6)}</span>
                          <button onClick={() => handleRemoveMember(addr)} className="text-[#d93036] hover:text-red-700 text-[12px] font-semibold transition-colors ml-3">
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Summary */}
                <div className="bg-white rounded-2xl p-4 border border-black/[0.05] space-y-2">
                  <p className="text-[11px] font-semibold text-[#727a88] uppercase tracking-wider">Group Summary</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] text-[#727a88]">Name</span>
                    <span className="text-[14px] font-semibold text-[#15171c]">{groupName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] text-[#727a88]">Visibility</span>
                    <span className="text-[14px] font-semibold text-[#15171c]">{isPrivate ? 'Private' : 'Public'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] text-[#727a88]">Total Members</span>
                    <span className="text-[14px] font-semibold text-[#15171c]">{members.length + 1} (including you)</span>
                  </div>
                </div>

                {/* Security notice (Pure Typography) */}
                <div className="px-4 py-3 bg-black/[0.03] rounded-2xl">
                  <p className="text-[12px] text-[#727a88] leading-relaxed">
                    <strong className="text-[#15171c]">End-to-End Encrypted:</strong> Messages are protected with XMTP's MLS cryptographic protocol. Removed members immediately lose decryption capability.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Footer CTA ── */}
        <div className="px-5 py-4 bg-white border-t border-black/[0.05] shrink-0">
          {step < 3 ? (
            <button
              type="button"
              disabled={step === 1 && !canProceedStep1}
              onClick={() => setStep(s => (s + 1) as 1 | 2 | 3)}
              className="w-full py-4 bg-[#15171c] text-white font-semibold text-[15px] rounded-2xl hover:bg-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Continue →
            </button>
          ) : (
            <button
              type="button"
              disabled={isCreating || !canProceedStep3}
              onClick={handleCreate}
              className="w-full py-4 bg-[#15171c] text-white font-semibold text-[15px] rounded-2xl hover:bg-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating group…
                </>
              ) : (
                `Create Group (${members.length + 1} members)`
              )}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
