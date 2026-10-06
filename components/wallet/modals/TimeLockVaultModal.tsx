"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Calendar, Loader2, Shield } from 'lucide-react';

interface TimeLockVaultModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function TimeLockVaultModal({ isOpen, onClose }: TimeLockVaultModalProps) {
    const [amount, setAmount] = useState('');
    const [unlockDate, setUnlockDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [vaults, setVaults] = useState<any[]>([]);
    const [balance, setBalance] = useState('0.00');

    const createVault = async () => {
        if (parseFloat(amount) > parseFloat(balance)) {
            alert(`Insufficient funds! You have ${balance} ETH and tried to lock ${amount} ETH.`);
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/wallet/timelock/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount, unlockDate }),
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.message || data.error || 'Failed to create vault');

            alert(` Vault Created! ${amount} ETH locked until ${unlockDate}`);
            fetchVaults();
            fetchBalance();
            setAmount('');
            setUnlockDate('');
        } catch (e: any) {
            alert(e.message || 'Failed to create vault');
        } finally {
            setLoading(false);
        }
    };

    const fetchBalance = async () => {
        try {
            const res = await fetch('/api/user/wallet');
            const data = await res.json();
            setBalance(data.balance || '0.00');
        } catch (e) {
            console.error("Failed to fetch balance:", e);
        }
    };

    const fetchVaults = async () => {
        const res = await fetch('/api/wallet/timelock/list');
        const data = await res.json();
        setVaults(data.vaults || []);
    };

    const unlockVault = async (vaultId: string) => {
        try {
            const res = await fetch('/api/wallet/timelock/unlock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vaultId }),
            });
            const data = await res.json();
            alert(` Vault unlocked! ${data.amount} ETH returned to your wallet.`);
            fetchVaults();
            fetchBalance();
        } catch (e: any) {
            alert(e.message || 'Cannot unlock vault yet');
        }
    };

    React.useEffect(() => {
        if (isOpen) {
            fetchVaults();
            fetchBalance();
        }
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-purple-900/90 to-black/90 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl"
                    >
                        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10">
                            <X size={20} className="text-white" />
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-yellow-500/20 rounded-full">
                                <Lock className="text-yellow-400" size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-white">Time-Locked Savings Vault</h2>
                                <p className="text-sm text-white/60">Lock funds until a future date</p>
                            </div>
                        </div>

                        {/* Create Vault */}
                        <div className="bg-white/5 rounded-2xl p-6 mb-6">
                            <h3 className="text-lg font-bold text-white mb-4">Create New Vault</h3>
                            
                            <div className="mb-4">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-white/80 text-sm block">Amount (ETH)</label>
                                    <span className="text-xs text-white/40">Balance: {balance} ETH</span>
                                </div>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0.0"
                                    className={`w-full px-4 py-3 bg-white/5 border ${parseFloat(amount) > parseFloat(balance) ? 'border-red-500' : 'border-white/10'} rounded-xl text-white`}
                                />
                                {parseFloat(amount) > parseFloat(balance) && (
                                    <p className="text-red-500 text-[10px] mt-1 font-bold">️ Amount exceeds your current balance</p>
                                )}
                            </div>

                            <div className="mb-4">
                                <label className="text-white/80 text-sm mb-2 block">Unlock Date</label>
                                <input
                                    type="date"
                                    value={unlockDate}
                                    onChange={(e) => setUnlockDate(e.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
                                />
                            </div>

                            <button
                                onClick={createVault}
                                disabled={loading || !amount || !unlockDate || parseFloat(amount) > parseFloat(balance)}
                                className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 disabled:bg-white/10 disabled:grayscale rounded-xl font-bold text-white flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : <Lock size={20} />}
                                {loading ? 'Creating Vault...' : parseFloat(amount) > parseFloat(balance) ? 'Insufficient Funds' : 'Lock Funds'}
                            </button>
                        </div>

                        {/* Active Vaults */}
                        <div>
                            <h3 className="text-lg font-bold text-white mb-4">Your Vaults</h3>
                            {vaults.length === 0 ? (
                                <p className="text-white/60 text-center py-8">No vaults yet. Create one above!</p>
                            ) : (
                                <div className="space-y-3">
                                    {vaults.map((vault) => (
                                        <div key={vault.id} className="bg-white/5 rounded-xl p-4 flex justify-between items-center">
                                            <div>
                                                <p className="text-white font-bold">{vault.amount} ETH</p>
                                                <p className="text-white/60 text-sm flex items-center gap-2">
                                                    <Calendar size={14} />
                                                    Unlocks: {new Date(vault.unlockDate).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => unlockVault(vault.id)}
                                                disabled={new Date(vault.unlockDate) > new Date()}
                                                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-white/10 disabled:cursor-not-allowed rounded-lg text-sm font-bold text-white"
                                            >
                                                {new Date(vault.unlockDate) > new Date() ? ' Locked' : ' Unlock'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="mt-6 p-4 bg-[#25D366]/10 border border-[#25D366]/20 rounded-xl">
                            <p className="text-blue-400 text-xs flex items-center gap-2">
                                <Shield size={14} />
                                <span>
                                    <strong>Security:</strong> Funds are locked in a smart contract. Even you cannot access them before the unlock date.
                                </span>
                            </p>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}


