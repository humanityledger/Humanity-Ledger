"use client";

import React, { useState } from 'react';
import { toast } from 'sonner';

export default function NotificationsPreferencesPage() {
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise(r => setTimeout(r, 600));
    toast.success("Notification preferences saved");
    setIsSaving(false);
  };

  return (
    <div className="max-w-2xl animate-fade-in">
      <h2 className="sr-only">Notifications Preferences</h2>
      
      <div className="space-y-8">
        
        {/* General */}
        <section>
          <h3 className="text-sm font-bold text-black dark:text-white mb-4">General Notifications</h3>
          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="mt-1 w-4 h-4 text-emerald-600 rounded" />
              <div>
                <span className="block text-sm font-medium text-black dark:text-white">Notify when someone likes my post</span>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="mt-1 w-4 h-4 text-emerald-600 rounded" />
              <div>
                <span className="block text-sm font-medium text-black dark:text-white">Notify when I am mentioned</span>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="mt-1 w-4 h-4 text-emerald-600 rounded" />
              <div>
                <span className="block text-sm font-medium text-black dark:text-white">Notify on replies to my topics</span>
              </div>
            </label>
          </div>
        </section>

        {/* Active Notifications */}
        <section>
          <h3 className="text-sm font-bold text-black dark:text-white mb-4">Active Notifications</h3>
          <p className="text-xs text-black/50 dark:text-white/50 mb-3">Browser push notifications when you are active on the site.</p>
          <button className="px-4 py-2 border border-[#25D366] text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg text-sm font-bold transition-colors">
            Enable Push Notifications
          </button>
        </section>

        {/* Schedule */}
        <section>
          <h3 className="text-sm font-bold text-black dark:text-white mb-4">Notification Schedule</h3>
          <p className="text-xs text-black/50 dark:text-white/50 mb-3">Pause notifications during certain hours.</p>
          <select className="w-full max-w-xs bg-white dark:bg-black border border-black/20 dark:border-white/20 rounded-lg px-4 py-2 text-sm font-medium text-black dark:text-white outline-none focus:border-[#25D366] transition-colors">
            <option value="never">Never pause (Always send)</option>
            <option value="weekends">Pause on weekends</option>
            <option value="custom">Custom schedule...</option>
          </select>
        </section>

        {/* Save Button */}
        <div className="pt-4 border-t border-black/5 dark:border-white/10">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

      </div>
    </div>
  );
}

