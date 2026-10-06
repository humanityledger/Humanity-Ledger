"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Users, UserPlus, Loader2, Check } from 'lucide-react';

interface SocialRecoveryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SocialRecoveryModal({ isOpen, onClose }: SocialRecoveryModalProps) {
    const [guardians, setGuardians] = useState<string[]>([]);
    const [newGuardian, setNewGuardian] = useState('');
    const [threshold, setThreshold] = useState(2);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) fetchGuardians();
    }, [isOpen]);

    const fetchGuardians = async () => {
        const res = await fetch('/api/wallet/recovery/guardians');
        const data = await res.json();
        setGuardians(data.guardians || []);
        setThreshold(data.threshold || 2);
    };

    const addGuardian =() => {
        if (newGuardian && guardians.length < 5) {
            setGuardians([...guardians, newGuardian]);
            setNewGuardian('');
        }
    };

    const saveGuardians = async () => {
        setLoading(true);
        try {
            await fetch('/api/wallet/recovery/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ guardians, threshold }),
            });
            alert(` Social Recovery configured! ${threshold} of ${guardians.length} guardians required.`);
            onClose();
        } catch (e) {
            alert('Failed to save guardians');
        } finally {
            setLoading(false);
        }
    };

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
                        className="relative w-full max-w-lg bg-gradient-to-br from-purple-900/90 to-black/90 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl"
                    >
                        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10">
                            <X size={20} className="text-white" />
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-green-500/20 rounded-full">
                                <Shield className="text-green-400" size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-white">Social Recovery</h2>
                                <p className="text-sm text-white/60">Recover wallet without seed phrase</p>
                            </div>
                        </div>

                        <div className="bg-[#25D366]/10 border border-[#25D366]/20 rounded-xl p-4 mb-6">
                            <p className="text-blue-400 text-sm">
                                <strong>How it works:</strong> Choose 3-5 friends as guardians. If you lose access, 
                                {threshold} of them can approve a recovery request to restore your wallet. No seed phrase needed!
                            </p>
                        </div>

                        {/* Add Guardian */}
                        <div className="mb-6">
                            <label className="text-white/80 text-sm mb-2 block">Add Guardian (Email or Address)</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newGuardian}
                                    onChange={(e) => setNewGuardian(e.target.value)}
                                    placeholder="friend@example.com or 0x..."
                                    className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
                                />
                                <button
                                    onClick={addGuardian}
                                    disabled={!newGuardian || guardians.length >= 5}
                                    className="px-4 py-3 bg-green-600 hover:bg-green-500 disabled:bg-white/10 rounded-xl text-white"
                                >
                                    <UserPlus size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Guardians List */}
                        <div className="mb-6">
                            <h3 className="text-white font-bold mb-3">Your Guardians ({guardians.length}/5)</h3>
                            {guardians.length === 0 ? (
                                <p className="text-white/60 text-center py-4">No guardians yet</p>
                            ) : (
                                <div className="space-y-2">
                                    {guardians.map((g, i) => (
                                        <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                                                    <Users size={16} className="text-green-400" />
                                                </div>
                                                <span className="text-white text-sm font-mono">{g.slice(0, 20)}...</span>
                                            </div>
                                            <button
                                                onClick={() => setGuardians(guardians.filter((_idx, idx) => idx !== i))}
                                                className="text-red-400 hover:text-red-300 text-sm"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Threshold */}
                        <div className="mb-6">
                            <label className="text-white/80 text-sm mb-2 block">
                                Recovery Threshold: <strong>{threshold} of {guardians.length}</strong>
                            </label>
                            <input
                                type="range"
                                min="1"
                                max={Math.max(guardians.length, 1)}
                                value={threshold}
                                onChange={(e) => setThreshold(parseInt(e.target.value))}
                                className="w-full"
                            />
                        </div>

                        <button
                            onClick={saveGuardians}
                            disabled={loading || guardians.length < 2}
                            className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:bg-white/10 rounded-xl font-bold text-white flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                            {loading ? 'Saving...' : 'Save Guardians'}
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}


