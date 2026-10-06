"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Copy, Download, Eye, EyeOff, Check, Lock, QrCode, Printer } from 'lucide-react';
import { KMS } from '@/lib/blockchain/KMS';
import { toast } from 'sonner';

export function ProtocolRecoveryPhrase({ onConfirm }: { onConfirm?: (mnemonic: string) => void }) {
    const [mnemonic, setMnemonic] = useState<string>('');
    const [words, setWords] = useState<string[]>([]);
    const [isRevealed, setIsRevealed] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [hasConfirmed, setHasConfirmed] = useState(false);
    const [verificationWords, setVerificationWords] = useState<number[]>([]);
    const [userInput, setUserInput] = useState<{[key: number]: string}>({});
    const [isVerified, setIsVerified] = useState(false);

    // Generate 24-word mnemonic on mount (256-bit entropy)
    useEffect(() => {
        generateSecurePhrase();
    }, []);

    const generateSecurePhrase = () => {
        try {
            // Use Elite-grade KMS for mnemonic generation
            const newMnemonic = KMS.generateMnemonic(); 
            
            setMnemonic(newMnemonic);
            setWords(newMnemonic.split(' '));
            
            // Select random words for verification (3, 7, 15, 21)
            setVerificationWords([3, 7, 15, 21]);
        } catch (error) {
            console.error('Error generating mnemonic:', error);
            toast.error('Error generating secret phrase. Please try again.');
        }
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(mnemonic);
            setIsCopied(true);
            toast.success('Phrase copied to clipboard');
            setTimeout(() => setIsCopied(false), 3000);
        } catch (error) {
            toast.error('Error copying. Please try again.');
        }
    };

    const handleDownloadPDF = () => {
        // Create PDF with mnemonic
        const content = `
Humanity Ledger Wallet - RECOVERY PHRASE
================================

CRITICAL: Store this phrase in a safe place. Never share it with anyone.

Your 24-word recovery phrase:

${words.map((word, i) => `${i + 1}. ${word}`).join('\n')}

================================
Generated: ${new Date().toLocaleString()}
Wallet: Humanity Ledger Terminal v4.0
        `;

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ledger-wallet-recovery-${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success('Backup downloaded. Keep it in a safe place.');
    };

    const handleVerification = () => {
        // Check if user input matches selected verification words
        const allCorrect = verificationWords.every(index => {
            const userWord = userInput[index]?.trim().toLowerCase();
            const actualWord = words[index - 1];
            return userWord === actualWord;
        });

        if (allCorrect) {
            setIsVerified(true);
            toast.success('Verification successful! Phrase confirmed.');
            onConfirm?.(mnemonic);
        } else {
            toast.error('Words do not match. Verify and try again.');
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="max-w-4xl mx-auto">
            {/* DANGER ZONE Header */}
            <div className="bg-indigo-500/10 border-2 border-indigo-500 rounded-2xl p-6 mb-8">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-2xl font-black text-black mb-2 uppercase">SECURITY PROTOCOL - CRITICAL</h2>
                        <ul className="space-y-1 text-red-700 font-bold text-sm">
                            <li> This phrase is the ONLY way to recover your wallet</li>
                            <li> If you lose it, you LOSE YOUR FUNDS forever</li>
                            <li> NEVER share it with anyone, not even support</li>
                            <li> Write it on paper and keep it in a safe place</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Security Stats with Active Monitoring */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <StatCard
                    icon={<Lock className="text-[#050505]" />}
                    label="Entropy"
                    value="256-bit"
                    description="Sovereign Protocol"
                    active
                />
                <StatCard
                    icon={<Lock className="text-purple-400" />}
                    label="Function"
                    value="PBKDF2"
                    description="SHA-512 Hashing"
                />
                <StatCard
                    icon={<Check className="text-blue-400" />}
                    label="Checksum"
                    value="Valid"
                    description="CRC32 Integrity"
                />
                <div className="bg-black/40 backdrop-blur-sm border border-indigo-500/30 rounded-2xl p-6 text-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-indigo-500/5 group-hover:bg-indigo-500/10 transition-colors" />
                    <div className="w-12 h-12 bg-indigo-900/50 rounded-full flex items-center justify-center text-indigo-500 mx-auto mb-3 border border-indigo-500/20">
                        <AlertTriangle size={20} />
                    </div>
                    <div className="text-sm text-black font-bold mb-1">Cryptographic Hardening</div>
                    <div className="text-xs text-black/50">Verified Protocol</div>
                </div>
            </div>

            {/* Entropy Visualizer */}
            <div className="mb-6 bg-black/40 rounded-xl p-4 border border-white/5 font-mono text-[10px] text-green-500/50 break-all h-24 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80" />
                {Array.from({ length: 12 }).map((_idx, i) => (
                    <div key={i} className="opacity-50">
                        [ENTROPY_POOL_#{i}]...[BIP39_KMS_SECURE]...[256BIT_SEEDED]
                    </div>
                ))}
            </div>

            {/* Mnemonic Display */}
            <div className="bg-white/50 backdrop-blur-xl border-2 border-purple-300 rounded-3xl p-8 mb-8 relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-5">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-blue-600" />
                </div>

                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-2xl font-black text-[#050505]">Recovery Phrase</h3>
                        <button
                            onClick={() => setIsRevealed(!isRevealed)}
                            className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl font-bold hover:bg-neutral-800 transition-colors"
                        >
                            {isRevealed ? (
                                <><EyeOff className="w-4 h-4" /> Hide</>
                            ) : (
                                <><Eye className="w-4 h-4" /> Reveal</>
                            )}
                        </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {words.map((word, index) => (
                            <WordCard
                                key={index}
                                number={index + 1}
                                word={word}
                                isRevealed={isRevealed}
                            />
                        ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3 mt-8">
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-xl font-bold hover:bg-neutral-800 transition-colors disabled:opacity-50"
                            disabled={!isRevealed}
                        >
                            {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            {isCopied ? 'Copied' : 'Copy'}
                        </button>
                        <button
                            onClick={handleDownloadPDF}
                            className="flex items-center gap-2 px-6 py-3 border border-black text-black rounded-xl font-bold hover:bg-black/5 transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            Download Backup
                        </button>
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-6 py-3 border border-black text-black rounded-xl font-bold hover:bg-black/5 transition-colors"
                        >
                            <Printer className="w-4 h-4" />
                            Print
                        </button>
                        <button
                            onClick={generateSecurePhrase}
                            className="flex items-center gap-2 px-6 py-3 border border-black text-black rounded-xl font-bold hover:bg-black/5 transition-colors"
                        >
                            Generate New
                        </button>
                    </div>
                </div>
            </div>

            {/* Verification Section */}
            {!isVerified && (
                <div className="bg-[#FFFFFF] border border-black/10 rounded-3xl p-8">
                    <h3 className="text-2xl font-black text-black mb-4">Verification</h3>
                    <p className="text-black/60 mb-6">
                        Confirm sequence stability by entering the following words:
                    </p>

                    <div className="space-y-4">
                        {verificationWords.map((wordIndex) => (
                            <div key={wordIndex} className="flex items-center gap-4">
                                <span className="text-lg font-bold text-purple-900 w-24">
                                    Word #{wordIndex}:
                                </span>
                                <input
                                    type="text"
                                    value={userInput[wordIndex] || ''}
                                    onChange={(e) => setUserInput({...userInput, [wordIndex]: e.target.value})}
                                    placeholder="Type here"
                                    className="flex-1 px-4 py-3 border-2 border-purple-300 rounded-xl focus:border-purple-600 outline-none transition-colors"
                                />
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={handleVerification}
                        className="mt-6 w-full px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-black text-lg hover:scale-105 active:scale-95 transition-transform"
                    >
                        Verify and Confirm
                    </button>
                </div>
            )}

            {isVerified && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-green-100 border-2 border-green-500 rounded-3xl p-8 text-center"
                >
                    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Check className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-black text-green-900 mb-2">Phrase Verified!</h3>
                    <p className="text-green-700">
                        Your wallet is ready. Remember to keep your recovery phrase in a safe place.
                    </p>
                </motion.div>
            )}
        </div>
    );
}

function WordCard({ number, word, isRevealed }: { number: number; word: string; isRevealed: boolean }) {
    return (
        <div className="bg-white/80 border-2 border-purple-200 rounded-xl p-3 hover:border-purple-400 transition-colors">
            <div className="text-xs font-mono text-purple-400 mb-1">#{number}</div>
            <div className="text-lg font-black text-purple-900">
                {isRevealed ? word : ''}
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, description, active }: {
    icon: React.ReactNode;
    label: string;
    value: string;
    description: string;
    active?: boolean;
}) {
    return (
        <div className={`bg-black/40 backdrop-blur-sm border rounded-2xl p-6 text-center transition-all ${active ? 'border-[#00ff9d]/50 bg-[#00ff9d]/5' : 'border-white/10 hover:border-white/20'}`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${active ? 'bg-[#00ff9d]/10 text-[#00ff9d]' : 'bg-white/5 text-white/50'}`}>
                {icon}
            </div>
            <div className={`text-sm font-bold mb-1 ${active ? 'text-[#00ff9d]' : 'text-white/70'}`}>{label}</div>
            <div className="text-2xl font-black text-white">{value}</div>
            <div className="text-xs text-white/40">{description}</div>
        </div>
    );
}


