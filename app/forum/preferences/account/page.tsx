"use client";

import React, { useState } from 'react';
import { Github, Edit2, Download, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AccountPreferencesPage() {
  const [username, setUsername] = useState('humanityledger');
  const [name, setName] = useState('humanityledger');
  const [email, setEmail] = useState('humanityledger@gmail.com');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate API call
    await new Promise(r => setTimeout(r, 600));
    toast.success("Preferences saved successfully");
    setIsSaving(false);
  };

  return (
    <div className="max-w-2xl animate-fade-in">
      <h2 className="sr-only">Account Preferences</h2>
      
      <div className="space-y-10">
        {/* Username */}
        <section>
          <h3 className="text-sm font-bold text-black mb-2">Username</h3>
          <p className="text-black/80 font-medium mb-1">{username}</p>
          <p className="text-xs text-black/50">People can mention you as @{username}</p>
        </section>

        {/* Profile Picture */}
        <section>
          <h3 className="text-sm font-bold text-black mb-3">Profile Picture</h3>
          <div className="flex items-start gap-4">
            <div className="w-24 h-24 rounded-full border border-black/10 overflow-hidden relative group">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Ledger" alt="Avatar" className="w-full h-full object-cover" />
              <button className="absolute bottom-1 right-1 w-6 h-6 bg-white border border-black/10 rounded-full flex items-center justify-center text-black/60 hover:text-black opacity-0 group-hover:opacity-100 transition-opacity">
                <Edit2 size={12} />
              </button>
            </div>
          </div>
        </section>

        {/* Email */}
        <section>
          <h3 className="text-sm font-bold text-black mb-2">Email</h3>
          <div className="flex items-center gap-3 mb-1">
            <p className="text-black/80 font-medium">{email}</p>
            <button className="text-black/40 hover:text-black"><Edit2 size={14} /></button>
          </div>
          <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold uppercase tracking-wider rounded-md mb-2">Primary</span>
          <p className="text-xs text-black/50 mb-3">Never shown to the public.</p>
          <button className="text-sm font-bold text-blue-600 hover:underline flex items-center gap-2">
            + Add Alternate Email
          </button>
        </section>

        {/* Associated Accounts */}
        <section>
          <h3 className="text-sm font-bold text-black mb-4">Associated Accounts</h3>
          <div className="flex items-center justify-between p-4 border border-black/10 rounded-xl bg-black/[0.02]">
            <div className="flex items-center gap-4">
              <Github size={24} className="text-black" />
              <div>
                <p className="text-sm font-bold text-black">GitHub</p>
                <p className="text-xs text-black/50">josejordan29222@gmail.com</p>
              </div>
            </div>
            <button className="w-8 h-8 flex items-center justify-center bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors">
              <Trash2 size={16} />
            </button>
          </div>
        </section>

        {/* Name */}
        <section>
          <h3 className="text-sm font-bold text-black mb-2">Name</h3>
          <input 
            type="text" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full max-w-md bg-white border border-black/20 rounded-lg px-4 py-2 text-sm font-medium text-black outline-none focus:border-blue-500 transition-colors mb-1"
          />
          <p className="text-xs text-black/50">Your full name (optional)</p>
        </section>

        {/* Export Data */}
        <section>
          <h3 className="text-sm font-bold text-black mb-3">Export your data</h3>
          <button className="flex items-center gap-2 px-4 py-2 bg-black/5 hover:bg-black/10 text-black rounded-lg text-sm font-bold transition-colors mb-2">
            <Download size={16} />
            Request Archive
          </button>
          <p className="text-xs text-black/50">Download an archive of your account activity and preferences.</p>
        </section>

        {/* Save Button */}
        <div className="pt-4 border-t border-black/5">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

      </div>
    </div>
  );
}
