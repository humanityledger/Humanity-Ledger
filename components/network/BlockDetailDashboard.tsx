"use client";

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Box, ArrowLeft, Loader, Clock, Database, HardDrive, Hash, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';

import { safeToFixed, safeToLocaleString } from '@/lib/utils/number-format';
interface BlockDetailDashboardProps {
    hash: string;
}

export function BlockDetailDashboard({ hash }: BlockDetailDashboardProps) {
    const { data: block, isLoading } = useQuery({
        queryKey: ['network', 'block', hash],
        queryFn: async () => {
            const res = await fetch(`/api/network/block/${hash}`);
            if (!res.ok) throw new Error('Failed to fetch block');
            return res.json();
        },
        enabled: !!hash,
    });

    if (isLoading || !block) {
        return (
            <div className="min-h-screen bg-[#0D0D12] pt-24 pb-12 px-6 flex justify-center">
                 <Loader className="animate-spin text-[#25D366]" size={40} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0D0D12] pt-24 pb-12 px-6">
            <div className="max-w-[2560px] mx-auto space-y-8 text-left">
                 {/* Header */}
                <div className="flex items-center gap-4">
                    <Link href="/network/blocks" className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 text-sm text-emerald-400 font-bold uppercase tracking-wider">
                            Block
                        </div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                            <Box className="text-gray-500" size={32} />
                            #{safeToLocaleString(block.height)}
                        </h1>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     <Card className="bg-white/5 border-white/10 p-6 md:col-span-2 lg:col-span-3">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             <div>
                                 <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                     <Hash size={20} className="text-gray-400" /> Hash
                                 </h3>
                                 <code className="text-sm font-mono text-gray-300 break-all bg-black/30 p-4 rounded-xl block border border-white/5">
                                     {block.id}
                                 </code>
                             </div>
                              <div>
                                 <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                     <Database size={20} className="text-gray-400" /> Details
                                 </h3>
                                 <div className="grid grid-cols-2 gap-4">
                                     <div>
                                         <div className="text-gray-500 text-xs uppercase tracking-wider">Size</div>
                                         <div className="text-white font-mono">{safeToFixed(block.size / 1000000, 2)} MB</div>
                                     </div>
                                     <div>
                                         <div className="text-gray-500 text-xs uppercase tracking-wider">Weight</div>
                                         <div className="text-white font-mono">{safeToFixed(block.weight / 1000000, 2)} MWU</div>
                                     </div>
                                      <div>
                                         <div className="text-gray-500 text-xs uppercase tracking-wider">Transactions</div>
                                         <div className="text-white font-mono">{safeToLocaleString(block.extras?.tx_count || 0)}</div>
                                     </div>
                                      <div>
                                         <div className="text-gray-500 text-xs uppercase tracking-wider">Timestamp</div>
                                         <div className="text-white font-mono">
                                            {(() => {
                                                try {
                                                    if (!block.timestamp) return "Unknown";
                                                    const date = new Date(block.timestamp * 1000);
                                                    if (isNaN(date.getTime())) return "Invalid";
                                                    return format(date, 'HH:mm:ss');
                                                } catch (e) {
                                                    return "N/A";
                                                }
                                            })()}
                                        </div>
                                     </div>
                                 </div>
                             </div>
                         </div>
                     </Card>
                </div>

                <div className="flex justify-between items-center bg-white/5 border border-white/10 p-4 rounded-xl">
                    <Link href={`/network/blocks/${block.previousblockhash}`} className="text-gray-400 hover:text-white flex items-center gap-2 text-sm">
                        <ArrowLeft size={16} /> Previous Block
                    </Link>
                     <div className="text-gray-600">|</div>
                     {/* We assume next block isn't easily linked unless fetched separately, but usually simple enough if height known. 
                         For now, just Previous link is safer without extra complexity.
                      */}
                     <span className="text-gray-500 text-sm">Next Block <ChevronRight size={16} className="inline opacity-50"/></span>
                </div>
            </div>
        </div>
    );
}


