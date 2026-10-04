"use client";
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useSystemAccount as useAccount } from '@/hooks/useSystemAccount';
import type { NodeType, NodeData, EdgeData } from './canvas-types';
import { AnimatePresence } from 'framer-motion';
import { CanvasNode as CanvasNodeComponent } from './CanvasNode';
import { CanvasEdges } from './CanvasEdges';
import { ContextMenu } from './ContextMenu';
import { TelemetryTerminal } from './TelemetryTerminal';
import { LedgerSonar } from './LedgerSonar';

// Re-export for backward compatibility with existing imports
export type { NodeType, NodeData, EdgeData } from './canvas-types';


// Debounce helper
function useDebounce<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debounced;
}

export function CanvasEngine() {
    const { address } = useAccount();
    const containerRef = useRef<HTMLDivElement>(null);

    // Real persistent state  loaded from DB
    const [nodes, setNodes] = useState<NodeData[]>([]);
    const [edges, setEdges] = useState<EdgeData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lastSynced, setLastSynced] = useState<Date | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, nodeId?: string } | null>(null);

    const isInitialized = useRef(false);

    // --- LOAD from DB on mount ---
    useEffect(() => {
        const load = async () => {
            if (!address) { setIsLoading(false); return; }
            try {
                const res = await fetch(`/api/terminal?address=${address}`, { cache: 'no-store' });
                if (!res.ok) throw new Error('Failed to load canvas');
                const data = await res.json();
                setNodes(Array.isArray(data.nodes) ? data.nodes : []);
                setEdges(Array.isArray(data.edges) ? data.edges : []);
                if (data.pan) setPan(data.pan);
                if (data.lastSyncedAt) setLastSynced(new Date(data.lastSyncedAt));
            } catch {
                setNodes([]);
                setEdges([]);
            } finally {
                setIsLoading(false);
                isInitialized.current = true;
            }
        };
        load();
    }, [address]);

    // --- AUTOSAVE to DB (debounced 1.5s after any change) ---
    const debouncedNodes = useDebounce(nodes, 1500);
    const debouncedEdges = useDebounce(edges, 1500);

    useEffect(() => {
        if (!isInitialized.current || isLoading || !address) return;

        const save = async () => {
            setIsSaving(true);
            try {
                const res = await fetch('/api/terminal', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        address,
                        nodes: debouncedNodes, 
                        edges: debouncedEdges,
                        pan 
                    }),
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.lastSyncedAt) setLastSynced(new Date(data.lastSyncedAt));
                }
            } finally {
                setIsSaving(false);
            }
        };

        save();
    }, [debouncedNodes, debouncedEdges, address, pan, isLoading]);

    // Context Menu
    const handleContextMenu = useCallback((e: React.MouseEvent, nodeId?: string) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, nodeId });
    }, []);

    // Canvas panning
    const handlePointerDown = (e: React.PointerEvent) => {
        if (e.button !== 0) return;
        if (contextMenu) setContextMenu(null);
        const target = e.target as HTMLElement;
        if (target.closest('.canvas-node')) return;
        setIsDraggingCanvas(true);
    };
    const handlePointerUp = () => setIsDraggingCanvas(false);
    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDraggingCanvas) return;
        setPan(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
    };

    // Node position update
    const updateNodePosition = (id: string, x: number, y: number) => {
        setNodes(prev => prev.map(n => n.id === id ? { ...n, x, y } : n));
    };

    // Add node at cursor
    const addNode = (type: NodeType, clientX: number, clientY: number) => {
        const canvasRect = containerRef.current?.getBoundingClientRect();
        if (!canvasRect) return;
        const x = clientX - canvasRect.left - pan.x;
        const y = clientY - canvasRect.top - pan.y;
        const newNode: NodeData = {
            id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `node-${Date.now()}-${performance.now().toString(36).replace('.', '')}`,
            type, x, y,
            title: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
            status: 'syncing',
            latency: 0
        };
        setNodes(prev => [...prev, newNode]);
        setContextMenu(null);
    };

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full bg-white overflow-hidden cursor-grab active:cursor-grabbing text-white"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onPointerMove={handlePointerMove}
            onContextMenu={(e) => handleContextMenu(e)}
        >
            {/* Infinite Grid */}
            <div
                className="absolute inset-0 pointer-events-none opacity-[0.15]"
                style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, var(--aztec-parchment) 1px, transparent 0)`,
                    backgroundSize: '40px 40px',
                    backgroundPosition: `${pan.x}px ${pan.y}px`
                }}
            />

            {/* Loading Overlay */}
            {isLoading && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80"
                     style={{ backdropFilter: 'var(--mobile-blur, blur(12px))', WebkitBackdropFilter: 'var(--mobile-blur, blur(12px))' }}>
                    <div className="text-center space-y-4">
                        <div className="w-12 h-12 border-2 border-[var(--aztec-orchid)] border-t-transparent rounded-full animate-spin mx-auto" />
                        <p className="font-aztec-mono text-[10px] uppercase tracking-widest text-white/40">Loading Canvas State...</p>
                    </div>
                </div>
            )}

            {/* Empty Canvas Guide */}
            {!isLoading && nodes.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                    <p className="font-aztec-mono text-[11px] uppercase tracking-widest text-white/20">
                        Right-click anywhere to deploy your first node
                    </p>
                    <div className="mt-4 w-px h-16 bg-gradient-to-b from-transparent via-[var(--aztec-orchid)]/20 to-transparent" />
                </div>
            )}

            {/* Transform Layer */}
            <div
                className="absolute inset-0 transform-gpu will-change-transform"
                style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
            >
                <CanvasEdges edges={edges} nodes={nodes} />
                {nodes.map(node => (
                    <CanvasNodeComponent
                        key={node.id}
                        data={node}
                        onDrag={(x, y) => updateNodePosition(node.id, x, y)}
                        onContextMenu={(e) => handleContextMenu(e, node.id)}
                    />
                ))}
            </div>

            {/* Sync Status Indicator */}
            <div className="absolute top-4 left-4 z-50 flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${isSaving ? 'bg-yellow-400 animate-pulse' : 'bg-[var(--aztec-chartreuse)]'}`} />
                <span className="font-mono text-[9px] uppercase tracking-widest text-white/30">
                    {isSaving ? 'Syncing...' : lastSynced ? `Saved ${lastSynced.toLocaleTimeString()}` : 'Ready'}
                </span>
            </div>

            {/* Overlays */}
            <LedgerSonar />
            <TelemetryTerminal nodes={nodes} />

            <AnimatePresence>
                {contextMenu && (
                    <ContextMenu
                        x={contextMenu.x}
                        y={contextMenu.y}
                        nodeId={contextMenu.nodeId}
                        onClose={() => setContextMenu(null)}
                        onAddNode={(type) => addNode(type, contextMenu.x, contextMenu.y)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
