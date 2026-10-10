"use client";

import React, { useState } from 'react';
import { toast } from 'sonner';

export default function InterfacePreferencesPage() {
  const [theme, setTheme] = useState('system');
  const [textSize, setTextSize] = useState('normal');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise(r => setTimeout(r, 600));
    toast.success("Interface preferences saved");
    setIsSaving(false);
  };

  return (
    <div className="max-w-2xl animate-fade-in">
      <h2 className="sr-only">Interface Preferences</h2>
      
      <div className="space-y-8">
        
        {/* Theme */}
        <section>
          <h3 className="text-sm font-bold text-black dark:text-white mb-3">Theme</h3>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="radio" 
                name="theme" 
                value="light" 
                checked={theme === 'light'} 
                onChange={(e) => setTheme(e.target.value)}
                className="w-4 h-4 text-emerald-600 focus:ring-[#25D366]"
              />
              <span className="text-sm font-medium text-black dark:text-white">Light</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="radio" 
                name="theme" 
                value="dark" 
                checked={theme === 'dark'} 
                onChange={(e) => setTheme(e.target.value)}
                className="w-4 h-4 text-emerald-600 focus:ring-[#25D366]"
              />
              <span className="text-sm font-medium text-black dark:text-white">Dark</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="radio" 
                name="theme" 
                value="system" 
                checked={theme === 'system'} 
                onChange={(e) => setTheme(e.target.value)}
                className="w-4 h-4 text-emerald-600 focus:ring-[#25D366]"
              />
              <span className="text-sm font-medium text-black dark:text-white">System automatic</span>
            </label>
          </div>
        </section>

        {/* Text Size */}
        <section>
          <h3 className="text-sm font-bold text-black dark:text-white mb-3">Text Size</h3>
          <select 
            value={textSize}
            onChange={(e) => setTextSize(e.target.value)}
            className="w-full max-w-xs bg-white dark:bg-black border border-black/20 dark:border-white/20 rounded-lg px-4 py-2 text-sm font-medium text-black dark:text-white outline-none focus:border-[#25D366] transition-colors"
          >
            <option value="smallest">Smallest</option>
            <option value="smaller">Smaller</option>
            <option value="normal">Normal</option>
            <option value="larger">Larger</option>
            <option value="largest">Largest</option>
          </select>
        </section>

        {/* Dynamic Updates */}
        <section>
          <h3 className="text-sm font-bold text-black dark:text-white mb-3">Dynamic Updates</h3>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" defaultChecked className="mt-1 w-4 h-4 text-emerald-600 rounded" />
            <div>
              <span className="block text-sm font-medium text-black dark:text-white">Show new topics and replies automatically</span>
              <span className="block text-xs text-black/50 dark:text-white/50">When disabled, a "Show X new posts" banner will appear instead.</span>
            </div>
          </label>
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

