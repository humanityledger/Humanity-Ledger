"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import useSWR from "swr";

interface TransactionStatusBannerProps {
    voteId: string | null;
}

export function TransactionStatusBanner({ voteId }: TransactionStatusBannerProps) {
    const [shouldPoll, setShouldPoll] = useState(false);

    useEffect(() => {
        if (voteId) setShouldPoll(true);
    }, [voteId]);

    const { data, error } = useSWR(
        shouldPoll ? `/api/user/vote-status?voteId=${voteId}` : null,
        (url) => fetch(url).then(r => r.json()),
        { refreshInterval: 4000 } // Poll every 4s
    );

    if (!voteId || !data) return null;

    const status = data.status; // PENDING_RELAY, SUBMITTED, CONFIRMED, FAILED
    const txHash = data.txHash;

    // Stop polling if final state
    if (status === 'CONFIRMED' || status === 'FAILED') {
        if (shouldPoll) setShouldPoll(false);
    }

    const getStatusColor = () => {
        switch (status) {
            case 'CONFIRMED': return 'bg-[#25D366]/10 border-[#25D366]/20 text-emerald-400';
            case 'FAILED': return 'bg-red-500/10 border-red-500/20 text-red-400';
            default: return 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400';
        }
    };

    const getStatusIcon = () => {
        switch (status) {
            case 'CONFIRMED': return <CheckCircle2 size={18} />;
            case 'FAILED': return <XCircle size={18} />;
            default: return <Loader2 size={18} className="animate-spin" />;
        }
    };

    const getStatusText = () => {
        switch (status) {
            case 'PENDING_RELAY': return 'Signing & Relaying...';
            case 'SUBMITTED': return 'Broadcasting to Base...';
            case 'CONFIRMED': return 'Vote Confirmed On-Chain';
            case 'FAILED': return 'Transaction Failed';
            default: return 'Processing...';
        }
    };

    return (
        <div className={`fixed bottom-8 right-8 z-50 p-4 rounded-xl border backdrop-blur-md shadow-2xl flex items-center gap-4 max-w-sm w-full transition-all animate-in slide-in-from-bottom-5 ${getStatusColor()}`}>
            <div className="shrink-0">
                {getStatusIcon()}
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">{getStatusText()}</p>
                {txHash && (
                    <a
                        href={`https://basescan.org/tx/${txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs opacity-70 hover:opacity-100 flex items-center gap-1 mt-1 truncate"
                    >
                        View on Explorer <ExternalLink size={10} />
                    </a>
                )}
            </div>
        </div>
    );
}


