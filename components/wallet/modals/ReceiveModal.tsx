"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, QrCode, Copy, Download, ExternalLink, Banknote, Wifi } from 'lucide-react';
import QRCodeLib from 'qrcode';
import { getExplorerAddressUrl } from '@/lib/wallet/chains';

// [LEGENDARY] Modes for specialized receive actions
export type ReceiveMode = 'standard' | 'invoice' | 'nfc';

interface ReceiveModalProps {
    isOpen: boolean;
    onClose: () => void;
    userAddress: string;
    chainId?: number;
    initialMode?: ReceiveMode;
}

export default function ReceiveModal({ isOpen, onClose, userAddress, chainId, initialMode = 'standard' }: ReceiveModalProps) {
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
    const [copied,setCopied] = useState(false);
    
    // Invoice Mode State
    const [invoiceAmount, setInvoiceAmount] = useState('');
    
    // NFC Mode State
    const [isScanning, setIsScanning] = useState(false);

    useEffect(() => {
        if (isOpen && userAddress) {
            generateQR();
        }
        if (isOpen && initialMode === 'nfc') {
            setIsScanning(true);
            // Simulate scanning timeout
            setTimeout(() => setIsScanning(false), 3000);
        }
    }, [isOpen, userAddress, invoiceAmount, initialMode]);

    const generateQR = async () => {
        try {
            // Include amount in QR if in invoice mode
            const value = initialMode === 'invoice' && invoiceAmount 
                ? `ethereum:${userAddress}?value=${invoiceAmount}` 
                : userAddress;

            const qr = await QRCodeLib.toDataURL(value, {
                width: 300,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF',
                },
            });
            setQrCodeDataUrl(qr);
        } catch (error) {
            console.error('QR generation failed', error);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(userAddress);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = qrCodeDataUrl;
        link.download = `wallet-${userAddress.slice(0, 8)}.png`;
        link.click();
    };

    const getModeConfig = () => {
        switch (initialMode) {
            case 'invoice':
                return { title: 'Create Invoice', desc: 'Generate payment request', icon: <Banknote className="text-emerald-400" size={24} />, color: 'bg-emerald-500/20' };
            case 'nfc':
                return { title: 'NFC Receive', desc: 'Tap to share address', icon: <Wifi className="text-emerald-400" size={24} />, color: 'bg-[#25D366]/20' };
            default:
                return { title: 'Receive Crypto', desc: 'Scan QR or copy address', icon: <QrCode className="text-green-400" size={24} />, color: 'bg-green-500/20' };
        }
    }

    const config = getModeConfig();

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
                        className="relative w-full max-w-md bg-gradient-to-br from-purple-900/90 to-black/90 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl"
                    >
                        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10">
                            <X size={20} className="text-white" />
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className={`p-3 ${config.color} rounded-full`}>
                                {config.icon}
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-white">{config.title}</h2>
                                <p className="text-sm text-white/60">{config.desc}</p>
                            </div>
                        </div>

                        {initialMode === 'invoice' && (
                            <div className="mb-4">
                                <label className="text-white/80 text-xs font-bold uppercase tracking-wider mb-2 block">
                                    Request Amount (ETH)
                                </label>
                                <input
                                    type="number"
                                    value={invoiceAmount}
                                    onChange={(e) => setInvoiceAmount(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-green-500/50"
                                />
                            </div>
                        )}

                        {initialMode === 'nfc' && (
                             <div className="mb-6 flex flex-col items-center justify-center py-8 border-2 border-dashed border-white/10 rounded-2xl bg-white/5">
                                <div className={`p-4 rounded-full bg-[#25D366]/10 mb-2 ${isScanning ? 'animate-pulse' : ''}`}>
                                    <Wifi size={32} className="text-emerald-400" />
                                </div>
                                <p className="text-white font-bold">{isScanning ? 'Ready to Tap...' : 'NFC Active'}</p>
                                <p className="text-white/40 text-xs mt-1">Bring device close to sender</p>
                             </div>
                        )}

                        {/* Only show QR if NOT NFC, or if NFC but also wanting backup */}
                        {initialMode !== 'nfc' && qrCodeDataUrl && (
                            <div className="bg-white p-4 rounded-2xl mb-6 relative group">
                                <img src={qrCodeDataUrl} alt="QR Code" className="w-full h-auto" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                                    <button onClick={handleDownload} className="p-3 bg-white rounded-full text-black font-bold flex items-center gap-2">
                                        <Download size={16} /> Save Image
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="mb-4 p-4 bg-white/5 rounded-xl">
                            <p className="text-white/60 text-xs mb-2">Your Address</p>
                            <p className="text-white font-mono text-sm break-all">{userAddress}</p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleCopy}
                                className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2"
                            >
                                <Copy size={18} />
                                {copied ? 'Copied!' : 'Copy Address'}
                            </button>
                           
                            <a
                                href={chainId ? getExplorerAddressUrl(chainId, userAddress) : `https://etherscan.io/address/${userAddress}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-white transition-all flex items-center justify-center"
                                title="View on Explorer"
                            >
                                <ExternalLink size={18} />
                            </a>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}


