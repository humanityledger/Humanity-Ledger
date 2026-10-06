'use client';

import dynamic from 'next/dynamic';
import { useRef, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { Loader2 } from 'lucide-react';
import { GraphData, GraphNode, GraphLink } from '@/utils/graphData';

// Dynamically import generic 3D Graph to avoid SSR issues
// @ts-ignore
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-full text-zinc-500"><Loader2 className="animate-spin mr-2" /> Loading Star Chart...</div>
}) as any;

export function Constellation() {
    const { address } = (useAccount as any)();
    const graphRef = useRef<any>(null);
    const [data, setData] = useState<GraphData | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!address) return;

        const fetchAndBuildGraph = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/wallet/history/enriched?userAddress=${address}`);
                const { activities } = await res.json();
                
                if (!activities || activities.length === 0) {
                    // Fallback to minimal data if no tx (still better than mock)
                    setData({
                        nodes: [{ id: address, name: 'ME', val: 50, group: 'USER', color: '#ffffff' }],
                        links: []
                    });
                    return;
                }

                const nodes: Map<string, GraphNode> = new Map();
                const links: GraphLink[] = [];

                // Central Node
                nodes.set(address.toLowerCase(), { 
                    id: address.toLowerCase(), 
                    name: 'ME', 
                    val: 40, 
                    group: 'USER', 
                    color: '#ffffff' 
                });

                activities.forEach((tx: any) => {
                    const counterparty = tx.type === 'SEND' ? tx.to : tx.from;
                    const cpId = (tx.platform || counterparty || 'Unknown').toLowerCase();
                    const cpName = tx.platform || counterparty || 'Unknown';

                    if (!nodes.has(cpId)) {
                        let group: any = 'WALLET';
                        let color = '#10b981'; // Emerald for wallet

                        if (tx.platform) {
                            group = 'DEFI';
                            color = '#3b82f6'; // Blue for DeFi
                        }

                        nodes.set(cpId, {
                            id: cpId,
                            name: cpName.length > 15 ? cpName.slice(0, 6) + '...' + cpName.slice(-4) : cpName,
                            val: 10,
                            group: group,
                            color: color
                        });
                    }

                    // Link from user to counterparty
                    links.push({
                        source: address.toLowerCase(),
                        target: cpId,
                        value: 1
                    });
                });

                // Dedup and normalize node values based on interaction count
                const finalNodes = Array.from(nodes.values());
                finalNodes.forEach(node => {
                    if (node.group !== 'USER') {
                        const count = links.filter(l => l.target === node.id).length;
                        node.val = 10 + Math.min(20, count * 2);
                    }
                });

                setData({ nodes: finalNodes, links });
            } catch (error) {
                console.error("Constellation Build Error:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAndBuildGraph();
    }, [address]);

    const handleNodeClick = (node: any) => {
        if (!graphRef.current) return;

        // Fly camera to node
        const distance = 60;
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);

        graphRef.current.cameraPosition(
            { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, 
            node, 
            3000  
        );
    };

    if (isLoading || !data) return <div className="h-full w-full flex items-center justify-center text-zinc-500 bg-black/20 rounded-xl"><Loader2 className="animate-spin mr-2" /> Mapping Chronos Network...</div>;

    return (
        <div className="h-full w-full relative bg-black/20 rounded-xl overflow-hidden border border-white/5">
            <ForceGraph3D
                ref={graphRef}
                graphData={data}
                nodeLabel="name"
                nodeAutoColorBy="group"
                nodeRelSize={6}
                linkColor={() => "rgba(255,255,255,0.1)"}
                linkWidth={1}
                linkDirectionalParticles={1}
                linkDirectionalParticleSpeed={0.005}
                backgroundColor="rgba(0,0,0,0)" 
                showNavInfo={false}
                onNodeClick={handleNodeClick}
                nodeThreeObjectExtend={true}
                nodeColor={(node: any) => node.color}
                enableNodeDrag={false}
            />

            {/* Overlay Controls */}
            <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-md p-3 rounded-lg border border-white/10 flex justify-between items-center text-xs">
                <span className="font-mono text-zinc-400">CHRONOS_LIVE_NETWORK // v2.0</span>
                <div className="flex gap-4">
                    <span className="flex items-center gap-1 text-blue-400"><div className="w-2 h-2 rounded-full bg-[#25D366]"></div> Protocol</span>
                    <span className="flex items-center gap-1 text-emerald-400"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Peer</span>
                    <span className="flex items-center gap-1 text-white"><div className="w-2 h-2 rounded-full bg-white"></div> Me</span>
                </div>
            </div>
        </div>
    );
}


