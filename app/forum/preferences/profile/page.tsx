"use client";

import React, { useState } from 'react';
import { toast } from 'sonner';

export default function ProfilePreferencesPage() {
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [location, setLocation] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise(r => setTimeout(r, 600));
    toast.success("Profile preferences saved");
    setIsSaving(false);
  };

  return (
    <div className="max-w-2xl animate-fade-in">
      <h2 className="sr-only">Profile Preferences</h2>
      
      <div className="space-y-8">
        
        {/* About me */}
        <section>
          <h3 className="text-sm font-bold text-black dark:text-white mb-2">About me</h3>
          <textarea 
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            className="w-full bg-white dark:bg-black border border-black/20 dark:border-white/20 rounded-lg px-4 py-3 text-sm font-medium text-black dark:text-white outline-none focus:border-[#25D366] transition-colors mb-2 resize-none"
            placeholder="Tell us a little about yourself..."
          />
          <p className="text-xs text-black/50 dark:text-white/50">Describe yourself in a few words.</p>
        </section>

        {/* Location */}
        <section>
          <h3 className="text-sm font-bold text-black dark:text-white mb-2">Location</h3>
          <input 
            type="text" 
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full max-w-md bg-white dark:bg-black border border-black/20 dark:border-white/20 rounded-lg px-4 py-2 text-sm font-medium text-black dark:text-white outline-none focus:border-[#25D366] transition-colors mb-1"
          />
          <p className="text-xs text-black/50 dark:text-white/50">Where are you based?</p>
        </section>

        {/* Web Site */}
        <section>
          <h3 className="text-sm font-bold text-black dark:text-white mb-2">Web Site</h3>
          <input 
            type="url" 
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="w-full max-w-md bg-white dark:bg-black border border-black/20 dark:border-white/20 rounded-lg px-4 py-2 text-sm font-medium text-black dark:text-white outline-none focus:border-[#25D366] transition-colors mb-1"
            placeholder="https://"
          />
        </section>

        {/* Save Button */}
        <div className="pt-4 border-t border-black/5 dark:border-white/10">
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

