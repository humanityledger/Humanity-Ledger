"use client";

import React from 'react';
import { Cloud, Database, RefreshCw, Check, Loader2, HardDrive, Download } from 'lucide-react';
import { useSettings } from '@/src/context/SettingsContext';
import { toast } from 'sonner';

/**
 * CloudSyncManager  Real sync status connected to Humanity Ledger system cloud.
 * Does NOT simulate fake cloud providers. All settings sync via /api/user/settings
 */
export function CloudSyncManager() {
    const {
        backupFrequency,
        setBackupFrequency,
        lastBackupAt,
        triggerBackup,
    } = useSettings();

    const handleLocalExport = () => {
        try {
            const raw = localStorage.getItem('hl_settings_v3');
            if (!raw) {
                toast.error("No local settings found.");
                return;
            }
            const blob = new Blob([raw], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Humanity Ledger-settings-${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success("Settings exported successfully.");
        } catch (e) {
            toast.error("Export failed.");
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header  Real Cloud Sync */}
            <div className="p-8 bg-gradient-to-br from-[#00f2ea]/10 to-[#25D366]/10 rounded-[2rem] border border-[#00f2ea]/20 relative overflow-hidden">
                <div className="absolute right-0 top-0 p-4 opacity-10">
                    <Cloud className="w-40 h-40 text-[#00f2ea]" />
                </div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-2 relative z-10">
                    <Database className="text-[#00f2ea]" size={24} />
                    Humanity Ledger System Cloud
                </h3>
                <p className="text-zinc-400 max-w-lg relative z-10 text-sm">
                    All your settings are encrypted and continuously synced to the Humanity Ledger system infrastructure.
                    No third-party cloud required. Your keys never leave your device.
                </p>

                <div className="mt-6 flex flex-col sm:flex-row gap-4 relative z-10">
                    <button
                        onClick={triggerBackup}
                        className="px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all bg-[#00f2ea]/10 text-[#00f2ea] border border-[#00f2ea]/30 hover:bg-[#00f2ea]/20"
                    >
                        <RefreshCw size={16} />
                        Force Sync Now
                    </button>
                    <div className="flex items-center gap-2 text-sm text-zinc-500 px-4 bg-white/5 rounded-xl border border-white/10">
                        <Check size={14} className="text-emerald-500" />
                        Last sync: {lastBackupAt ? lastBackupAt.toLocaleString() : 'Syncing...'}
                    </div>
                </div>
            </div>

            {/* Backup Frequency */}
            <div className="p-6 bg-white/[0.03] border border-white/10 rounded-[2rem]">
                <h4 className="text-white font-bold mb-1">Automated Sync Frequency</h4>
                <p className="text-zinc-500 text-sm mb-4">How often your settings are automatically backed up to the cloud.</p>
                <select
                    value={backupFrequency}
                    onChange={e => setBackupFrequency(e.target.value as any)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:border-[#00f2ea] outline-none"
                >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly (Recommended)</option>
                    <option value="monthly">Monthly</option>
                </select>
            </div>

            {/* Local Export Only */}
            <div className="p-6 bg-white/[0.03] border border-white/10 rounded-[2rem] flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/10 text-white rounded-xl">
                        <HardDrive size={20} />
                    </div>
                    <div>
                        <h4 className="font-bold text-white">Local Export</h4>
                        <p className="text-xs text-zinc-500">Download a JSON backup of your current settings.</p>
                    </div>
                </div>
                <button
                    onClick={handleLocalExport}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white text-sm font-bold rounded-xl border border-white/10 hover:bg-white/20 transition-colors"
                >
                    <Download size={14} />
                    Export
                </button>
            </div>
        </div>
    );
}


