'use client';

import React, { useState, useCallback } from 'react';
import { createSecureGroup } from '@/lib/xmtp/groups';
import { toast } from 'sonner';
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
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [memberInput, setMemberInput] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  // Validate an Ethereum address strictly before adding to the list
  const isValidEthAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);

  const handleAddMember = useCallback(() => {
    const addr = memberInput.trim().toLowerCase();
    // Security: validate EIP-55 format
    if (!isValidEthAddress(addr) && !isValidEthAddress(memberInput.trim())) {
      toast.error('Invalid Ethereum address format.');
      return;
    }
    // Security: prevent adding self
    if (addr === myAddress.toLowerCase()) {
      toast.error('You are automatically added as the group creator.');
      return;
    }
    // Prevent duplicates
    if (members.map(m => m.toLowerCase()).includes(addr)) {
      toast.error('Address already added.');
      return;
    }
    // Hard cap: max 99 additional members (100 total including creator)
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
    if (!groupName.trim()) {
      toast.error('Please enter a group name.');
      return;
    }
    if (members.length < 1) {
      toast.error('Add at least 1 member to create a group.');
      return;
    }

    setIsCreating(true);
    try {
      const groupId = await createSecureGroup(
        client,
        members,
        groupName.trim(),
        description.trim()
      );
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-t-3xl p-6 flex flex-col gap-5 shadow-2xl"
        onClick={e => e.stopPropagation()} // Prevent backdrop click from closing
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">New Group</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-black/5 text-black/50 hover:bg-black/10 transition-colors">✕</button>
        </div>

        {/* Group Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-black/40 uppercase tracking-wider">Group Name *</label>
          <input
            type="text"
            maxLength={64}
            placeholder="e.g. DeFi Alpha Squad"
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            className="px-4 py-3 rounded-xl border border-black/10 text-sm focus:outline-none focus:border-black focus:ring-2 focus:ring-black/10 transition-all"
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-black/40 uppercase tracking-wider">Description (optional)</label>
          <input
            type="text"
            maxLength={128}
            placeholder="What's this group about?"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="px-4 py-3 rounded-xl border border-black/10 text-sm focus:outline-none focus:border-black focus:ring-2 focus:ring-black/10 transition-all"
          />
        </div>

        {/* Add Members */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-black/40 uppercase tracking-wider">Add Members (by wallet address)</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="0x..."
              value={memberInput}
              onChange={e => setMemberInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddMember()}
              className="flex-1 px-4 py-3 rounded-xl border border-black/10 text-sm font-mono focus:outline-none focus:border-black focus:ring-2 focus:ring-black/10 transition-all"
            />
            <button
              onClick={handleAddMember}
              className="px-4 py-3 bg-black text-white text-sm font-semibold rounded-xl hover:bg-black/80 transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        {/* Member List */}
        {members.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-black/40 uppercase tracking-wider">{members.length} Member{members.length !== 1 ? 's' : ''} Added</p>
            <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
              {members.map(addr => (
                <div key={addr} className="flex items-center justify-between px-3 py-2 bg-black/[0.03] rounded-xl">
                  <span className="text-xs font-mono text-black/70">{addr.slice(0, 10)}...{addr.slice(-6)}</span>
                  <button
                    onClick={() => handleRemoveMember(addr)}
                    className="text-red-400 hover:text-red-600 text-xs font-bold transition-colors ml-2"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Security Notice */}
        <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
          <p className="text-xs text-emerald-700">
            🔒 <strong>End-to-End Encrypted</strong> — Messages are protected by XMTP's MLS protocol. Removed members lose access to all future messages immediately. You cannot decrypt messages from before you joined.
          </p>
        </div>

        {/* Create Button */}
        <button
          onClick={handleCreate}
          disabled={isCreating || !groupName.trim() || members.length < 1}
          className="w-full py-4 bg-black text-white font-bold rounded-2xl text-sm hover:bg-black/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isCreating ? 'Creating Group...' : `Create Group (${members.length + 1} members)`}
        </button>
      </div>
    </div>
  );
};
