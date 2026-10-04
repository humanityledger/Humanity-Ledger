'use client';

import React, { useState, Suspense, lazy } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Zap, Activity, Globe, Lock, Cpu, RefreshCw, Layers, Loader2 } from 'lucide-react';
import { useDashboardStore } from '@/lib/store/useDashboardStore';
import { useSystemIntel } from '@/lib/api-client';

const WalkawayPanel = lazy(() => import('./WalkawayPanel').then(m => ({ default: m.WalkawayPanel })));

const SystemIntelTab: React.FC = () => {
    const { addLog } = useDashboardStore();
    const [isNodeActive, setIsNodeActive] = useState(false);
    const [vossSearch, setVossSearch] = useState('');

    // =========================================================================
    // INJECTED DATA HOOK
    // Enforcing strict on-chain reality. Waiting for endpoint assignment.
    // =========================================================================
    const { data: intelData, isLoading } = useSystemIntel('smartSignals');

    const mainframeData = intelData?.mainframe || {
        zScore: 0,
        mempoolDensity: 0,
        entropy: 0,
        walkawayDays: 0,
    };

    const nodeMetrics = intelData?.nodeInfo || { peers: 0, health: 'offline' };
    const directives: any[] = intelData?.directives || [];

    const filteredVoss = directives.filter(v => 
        (v.title || '').toLowerCase().includes(vossSearch.toLowerCase()) || 
        (v.categoryName || '').toLowerCase().includes(vossSearch.toLowerCase())
    );

    return (
        <div className="w-full h-full min-h-0 flex flex-col p-0 overflow-hidden bg-[#FFFFFF] ">
            {/* Header */}
            <div className="px-6 py-5 border border-[#E5E5E5]  bg-[#FFFFFF]  rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <Layers className="text-[#050505] " size={20} />
                        <h1 className="text-xl md:text-2xl font-black tracking-tighter text-[#050505]  uppercase">
                            System Intel
                        </h1>
                    </div>
                    <p className="text-[10px] text-[#888888] uppercase tracking-[0.2em] font-bold">
                        On-chain data and metadata analysis
                    </p>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-[9px] uppercase tracking-widest text-[#888888] mb-1">Network Identity</p>
                        <p className="text-[11px] font-black text-[#050505] ">SAL-GENESIS-NODE-01</p>
                    </div>
                    <div className={`w-2.5 h-2.5 rounded-full ${isNodeActive ? 'bg-[#00C076] shadow-[0_0_8px_rgba(0,192,118,0.5)]' : 'bg-[#E5E5E5] '} transition-all`} />
                </div>
            </div>

            {/* Main content area */}
            <main className="flex-1 flex flex-col min-h-0 w-full gap-4 mt-4 overflow-hidden">
                
                {isLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-[#888888]">
                        <Loader2 className="animate-spin mb-4" size={32} />
                        <p className="text-[11px] font-black uppercase tracking-[0.2em]">WAITING FOR ON-CHAIN ENDPOINT</p>
                        <p className="text-[9px] mt-2">Connecting to RPC Nodes...</p>
                    </div>
                ) : (
                    <>
                        {/* Network KPI Grid */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
                            <MetricCard 
                                title="Z-Score Atlas" 
                                value={mainframeData.zScore.toFixed(2)} 
                                subtitle="Statistical Anomaly Indicator"
                                icon={<Activity size={16} />}
                                accent="green"
                            />
                            <MetricCard 
                                title="Mempool Density" 
                                value={`${mainframeData.mempoolDensity.toFixed(1)}%`} 
                                subtitle="Transaction Heatmap"
                                icon={<RefreshCw size={16} />}
                                accent="amber"
                            />
                            <MetricCard 
                                title="Network Entropy" 
                                value={mainframeData.entropy.toString()} 
                                subtitle="Network Congestion Index"
                                icon={<Cpu size={16} />}
                                accent="black"
                            />
                            <MetricCard 
                                title="Walkaway Count" 
                                value={`${mainframeData.walkawayDays}d`} 
                                subtitle="Autonomous Trigger"
                                icon={<Lock size={16} />}
                                accent="red"
                            />
                        </div>

                        {/* Node Control / Network Map row */}
                        <div className="shrink-0 grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {/* Node Control Center */}
                            <Card className="lg:col-span-2 border-[#E5E5E5]  bg-[#FFFFFF]  shadow-sm relative overflow-hidden rounded-2xl">
                                <CardHeader className="flex flex-row items-center justify-between border-b border-[#F0F0F0]  pb-4">
                                    <div className="space-y-0.5">
                                        <CardTitle className="text-[#050505]  tracking-widest text-[11px] uppercase font-black">
                                            Local Node Configuration
                                        </CardTitle>
                                        <p className="text-[9px] text-[#888888] uppercase tracking-widest font-bold">
                                            Browser-Based Protocol Participant
                                        </p>
                                    </div>
                                    <Badge variant={isNodeActive ? "default" : "outline"} className={`px-3 py-1 uppercase tracking-widest text-[9px] font-black ${isNodeActive ? 'bg-[#00C076] hover:bg-[#00C076]/90 text-white border-transparent' : 'text-[#888888] border-[#E5E5E5] '}`}>
                                        {isNodeActive ? 'Active' : 'Dormant'}
                                    </Badge>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-4">
                                                <Switch
                                                    id="node-toggle"
                                                    checked={isNodeActive}
                                                    onCheckedChange={(val) => {
                                                        setIsNodeActive(val);
                                                        addLog(val ? 'Requesting Node Bootstrap...' : 'Deactivating Node...', val ? 'info' : 'warning');
                                                    }}
                                                    className="data-[state=checked]:bg-white "
                                                />
                                                <label htmlFor="node-toggle" className="text-sm font-black text-[#050505]  cursor-pointer">
                                                    {isNodeActive ? 'Node Status: ACTIVE' : 'Activate Local Node'}
                                                </label>
                                            </div>
                                            <p className="text-[11px] text-[#888888] max-w-md leading-relaxed font-medium">
                                                Activating the node allows your client to participate in the decentralised relay of block metadata and transactional signals. Network traffic is routed via secure WebRTC.
                                            </p>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
                                            <div className="p-4 rounded-xl bg-[#FFFFFF]  border border-[#E5E5E5]  text-center">
                                                <p className="text-[9px] text-[#888888] uppercase tracking-widest mb-1 font-bold">Active Peers</p>
                                                <p className="text-xl font-black text-[#050505] ">{nodeMetrics.peers}</p>
                                            </div>
                                            <div className="p-4 rounded-xl bg-[#FFFFFF]  border border-[#E5E5E5]  text-center">
                                                <p className="text-[9px] text-[#888888] uppercase tracking-widest mb-1 font-bold">Latency</p>
                                                <p className="text-xl font-black text-[#00C076]">{isNodeActive ? 'Active' : '--'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="space-y-4">
                                <Suspense fallback={<div className="h-44 rounded-2xl bg-[#E5E5E5] " />}>
                                    <WalkawayPanel />
                                </Suspense>
                            </div>
                        </div>

                        {/* NETWORK DIRECTIVES */}
                        <div className="flex-1 min-h-0 w-full flex flex-col border border-[#E5E5E5]  rounded-2xl bg-[#FFFFFF]  overflow-hidden shadow-sm">
                            <div className="px-5 py-3 border-b border-[#E5E5E5]  bg-[#FFFFFF]  flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-2">
                                    <Zap className="text-[#050505] " size={14} />
                                    <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#050505] ">
                                        Analytics Directives
                                    </h2>
                                </div>
                                <div className="relative">
                                    <input 
                                        value={vossSearch}
                                        onChange={e => setVossSearch(e.target.value)}
                                        placeholder="Filter directives..."
                                        className="bg-[#FFFFFF]  border border-[#E5E5E5]  px-3 py-1.5 rounded-lg text-[10px] font-medium outline-none focus:border-[#050505]  transition-colors w-64 placeholder:text-[#888888] text-[#050505] "
                                    />
                                </div>
                            </div>
                            
                            {/* The list header */}
                            <div className="grid grid-cols-12 gap-4 px-5 py-2.5 bg-[#FFFFFF]  border-b border-[#F0F0F0]  text-[9px] font-black text-[#888888] uppercase tracking-[0.18em] shrink-0">
                                <div className="col-span-1">ID</div>
                                <div className="col-span-3">Directive</div>
                                <div className="col-span-4">Description</div>
                                <div className="col-span-2">Competitive Edge</div>
                                <div className="col-span-2 text-right">Priority</div>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {filteredVoss.map(item => (
                                    <div key={item.id} className="grid grid-cols-12 gap-4 px-5 py-4 border-b border-[#F0F0F0]  hover:bg-[#FFFFFF]  transition-colors items-start">
                                        <div className="col-span-1 text-[10px] font-black text-[#888888] pt-0.5">
                                            #{item.id}
                                        </div>
                                        <div className="col-span-3 space-y-0.5">
                                            <div className="text-[11px] font-black text-[#050505] ">{item.title}</div>
                                            <div className="text-[8px] text-[#888888] font-bold uppercase tracking-widest">{item.categoryName}</div>
                                        </div>
                                        <div className="col-span-4 text-[10px] text-[#888888] leading-relaxed font-medium">
                                            {item.description}
                                        </div>
                                        <div className="col-span-2 text-[10px] text-[#050505]  font-bold leading-relaxed pt-0.5">
                                            {item.competitiveEdge}
                                        </div>
                                        <div className="col-span-2 flex items-center justify-end">
                                            <Badge variant="outline" className={`text-[8px] uppercase tracking-widest px-2 py-0.5 font-black ${
                                                item.priority === 'Crítica' ? 'bg-[#FF3B30]/10 text-[#FF3B30] border-[#FF3B30]/20' : 
                                                'bg-[#00C076]/10 text-[#00C076] border-[#00C076]/20'
                                            }`}>
                                                {item.priority}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                                {filteredVoss.length === 0 && (
                                    <div className="p-12 text-center text-[10px] uppercase tracking-widest text-[#888888] font-black">
                                        No on-chain directives found
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
};

const MetricCard = ({ title, value, subtitle, icon, accent }: { 
    title: string; value: string; subtitle: string; icon: React.ReactNode; accent: 'green' | 'amber' | 'red' | 'black' 
}) => {
    const colors = {
        green: 'text-[#00C076]',
        amber: 'text-[#FF9500]',
        red: 'text-[#FF3B30]',
        black: 'text-[#050505] '
    };
    
    return (
        <Card className="border-[#E5E5E5]  bg-[#FFFFFF]  shadow-sm rounded-2xl group hover:border-[#050505]/20  transition-all flex flex-col justify-between p-4">
            <div>
                <div className="flex items-center justify-between mb-3">
                    <span className="text-[9px] uppercase tracking-[0.15em] text-[#888888] font-black">{title}</span>
                    <span className="text-[#888888] group-hover:text-[#050505]  transition-colors">{icon}</span>
                </div>
                <div className={`text-2xl lg:text-3xl font-black ${colors[accent]} tracking-tighter`}>{value}</div>
            </div>
            <div className="mt-4 pt-3 border-t border-[#F0F0F0] ">
                <p className="text-[9px] uppercase tracking-widest text-[#888888] font-bold">{subtitle}</p>
            </div>
        </Card>
    );
};

export default SystemIntelTab;

