"use client";

import React from 'react';
import { CheckCircle2, Copy, ExternalLink, Hexagon } from 'lucide-react';
import { motion } from 'framer-motion';

interface CoreReceiptProps {
    receiptId: string;
    sender: string;
    receiver: string;
    amount: string;
    timestamp: string;
    memo: string;
    txHash: string;
}

export default function CoreReceipt({
    receiptId = "QDR-00001",
    sender = "0x1234...abcd",
    receiver = "0x9876...fedc",
    amount = "5.000000",
    timestamp = new Date().toISOString(),
    memo = "Pago servicio premium",
    txHash = "0xabc123...def456"
}: Partial<CoreReceiptProps>) {
    
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        // Toast can go here
    };

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-sm mx-auto bg-white rounded-[24px] overflow-hidden shadow-2xl border border-neutral-100"
        >
            {/* Header */}
            <div className="bg-white p-8 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[50px] rounded-full" />
                <div className="relative z-10">
                    <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full mx-auto flex items-center justify-center mb-4">
                        <CheckCircle2 size={32} strokeWidth={2.5} />
                    </div>
                    <h3 className="text-white text-xl font-black tracking-tight uppercase">Transferencia Exitosa</h3>
                    <p className="text-white/50 text-xs font-mono mt-2">ID: {receiptId}</p>
                </div>
            </div>

            {/* Content */}
            <div className="p-8 space-y-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-blend-soft-light bg-neutral-50/50">
                <div className="text-center pb-6 border-b border-dashed border-neutral-200">
                    <p className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-1">Monto (QDs)</p>
                    <p className="text-4xl font-black text-neutral-900 tracking-tighter">{amount}</p>
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">De</span>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-mono font-medium text-neutral-900">{sender}</span>
                            <button onClick={() => copyToClipboard(sender)} className="text-neutral-400 hover:text-neutral-900"><Copy size={14}/></button>
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Para</span>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-mono font-medium text-neutral-900">{receiver}</span>
                            <button onClick={() => copyToClipboard(receiver)} className="text-neutral-400 hover:text-neutral-900"><Copy size={14}/></button>
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Fecha</span>
                        <span className="text-sm font-medium text-neutral-900">{new Date(timestamp).toLocaleDateString()} {new Date(timestamp).toLocaleTimeString()}</span>
                    </div>
                    {memo && (
                        <div className="flex justify-between items-start gap-4">
                            <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Memo</span>
                            <span className="text-sm font-medium text-neutral-900 text-right">{memo}</span>
                        </div>
                    )}
                </div>

                <div className="pt-6 border-t border-dashed border-neutral-200">
                    <a 
                        href={`https://aztecscan.xyz`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="w-full py-4 rounded-xl bg-neutral-100 text-neutral-900 font-bold text-sm flex items-center justify-center gap-2 hover:bg-neutral-200 transition-colors"
                    >
                        Ver en Blockchain <ExternalLink size={16} />
                    </a>
                </div>
            </div>

            <div className="bg-neutral-900 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                    <Hexagon size={16} className="text-emerald-400" />
                    <span className="text-xs font-black uppercase tracking-widest">CoreLedger</span>
                </div>
                <span className="text-[10px] font-mono text-neutral-500">Secured On-Chain</span>
            </div>
        </motion.div>
    );
}
