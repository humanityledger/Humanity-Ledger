"use client";

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Waves } from 'lucide-react';
import type { FlowNode, FlowLink } from '@/hooks/useLedgerFeed';

interface Props {
    nodes: FlowNode[];
    links: FlowLink[];
}

//  Simple Sankey-like SVG layout (no d3-sankey dependency) 

const CANVAS_W = 560;
const CANVAS_H = 320;
const NODE_W = 120;
const NODE_H = 32;
const COL_LEFT = 20;
const COL_RIGHT = CANVAS_W - NODE_W - 20;

function buildLayout(nodes: FlowNode[], links: FlowLink[]) {
    const leftNodes = new Set(links.map(l => l.source));
    const rightNodes = new Set(links.map(l => l.target));

    // Split nodes into source (left) and sink (right) columns
    const sources = nodes.filter(n => leftNodes.has(n.id) && !rightNodes.has(n.id));
    const sinks = nodes.filter(n => rightNodes.has(n.id));
    const both = nodes.filter(n => leftNodes.has(n.id) && rightNodes.has(n.id));

    const leftList = [...sources, ...both];
    const rightList = sinks.length > 0 ? sinks : nodes.filter(n => !leftList.find(l => l.id === n.id));

    const leftH = CANVAS_H / Math.max(leftList.length, 1);
    const rightH = CANVAS_H / Math.max(rightList.length, 1);

    const nodePos: Record<string, { x: number; y: number; cy: number; color: string }> = {};

    leftList.forEach((n, i) => {
        nodePos[n.id] = {
            x: COL_LEFT,
            y: i * leftH + (leftH - NODE_H) / 2,
            cy: i * leftH + leftH / 2,
            color: n.color,
        };
    });
    rightList.forEach((n, i) => {
        nodePos[n.id] = {
            x: COL_RIGHT,
            y: i * rightH + (rightH - NODE_H) / 2,
            cy: i * rightH + rightH / 2,
            color: n.color,
        };
    });

    // Compute max value for stroke-width scaling
    const maxVal = Math.max(...links.map(l => l.value), 1);

    const renderedLinks = links.map(l => {
        const src = nodePos[l.source];
        const dst = nodePos[l.target];
        if (!src || !dst) return null;
        const x1 = src.x + NODE_W;
        const y1 = src.cy;
        const x2 = dst.x;
        const y2 = dst.cy;
        const mx = (x1 + x2) / 2;
        const width = 2 + (l.value / maxVal) * 14;
        return { ...l, x1, y1, x2, y2, mx, width, srcColor: src.color, dstColor: dst.color };
    }).filter(Boolean) as (typeof links[0] & { x1: number; y1: number; x2: number; y2: number; mx: number; width: number; srcColor: string; dstColor: string })[];

    return { nodePos, renderedLinks, leftList, rightList };
}

export function LedgerFlow({ nodes, links }: Props) {
    const { nodePos, renderedLinks, leftList, rightList } = buildLayout(nodes, links);
    const maxVal = Math.max(...links.map(l => l.value), 1);

    return (
        <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Waves className="text-blue-400" size={22} />
                    <h2 className="text-white font-bold text-lg">Ledger Flow</h2>
                    <span className="text-[10px] font-black bg-[#25D366]/20 text-blue-300 px-2 py-0.5 rounded-full border border-[#25D366]/30 ml-1">LIVE</span>
                </div>
                <span className="text-xs text-gray-600">BTC flow visualization</span>
            </div>

            {/* Legend */}
            {nodes.length > 0 && (
                <div className="flex flex-wrap gap-3">
                    {nodes.slice(0, 6).map(n => (
                        <div key={n.id} className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: n.color }} />
                            <span className="text-[10px] text-gray-500">{n.label}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* SVG Canvas */}
            {nodes.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-gray-600 text-sm">
                    <Waves size={28} className="mr-2 opacity-30" /> Collecting flow data...
                </div>
            ) : (
                <div className="w-full overflow-x-auto">
                    <motion.svg
                        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
                        className="w-full"
                        style={{ minWidth: 320, maxHeight: 320 }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.8 }}
                    >
                        <defs>
                            {renderedLinks.map((link, i) => (
                                <linearGradient key={i} id={`grad-${i}`} x1="0%" x2="100%">
                                    <stop offset="0%" stopColor={link.srcColor} stopOpacity={0.7} />
                                    <stop offset="100%" stopColor={link.dstColor} stopOpacity={0.7} />
                                </linearGradient>
                            ))}
                        </defs>

                        {/* Curved flow paths */}
                        {renderedLinks.map((link, i) => (
                            <motion.path
                                key={i}
                                d={`M${link.x1},${link.y1} C${link.mx},${link.y1} ${link.mx},${link.y2} ${link.x2},${link.y2}`}
                                fill="none"
                                stroke={`url(#grad-${i})`}
                                strokeWidth={link.width}
                                strokeLinecap="round"
                                initial={{ pathLength: 0, opacity: 0 }}
                                animate={{ pathLength: 1, opacity: 0.8 }}
                                transition={{ duration: 1.2, delay: i * 0.1, ease: 'easeInOut' }}
                            />
                        ))}

                        {/* Source nodes (left column) */}
                        {leftList.map(n => {
                            const pos = nodePos[n.id];
                            if (!pos) return null;
                            return (
                                <g key={`src-${n.id}`}>
                                    <rect x={pos.x} y={pos.y} width={NODE_W} height={NODE_H} rx={8} fill={pos.color} fillOpacity={0.2} stroke={pos.color} strokeOpacity={0.5} strokeWidth={1} />
                                    <text x={pos.x + NODE_W / 2} y={pos.cy + 1} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={9} fontWeight="bold" fontFamily="monospace">
                                        {n.label.length > 14 ? n.label.slice(0, 12) + '' : n.label}
                                    </text>
                                </g>
                            );
                        })}

                        {/* Sink nodes (right column) */}
                        {rightList.map(n => {
                            const pos = nodePos[n.id];
                            if (!pos) return null;
                            const totalIn = links.filter(l => l.target === n.id).reduce((s, l) => s + l.value, 0);
                            return (
                                <g key={`dst-${n.id}`}>
                                    <rect x={pos.x} y={pos.y} width={NODE_W} height={NODE_H} rx={8} fill={pos.color} fillOpacity={0.2} stroke={pos.color} strokeOpacity={0.5} strokeWidth={1} />
                                    <text x={pos.x + NODE_W / 2} y={pos.cy - 5} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={9} fontWeight="bold" fontFamily="monospace">
                                        {n.label.length > 14 ? n.label.slice(0, 12) + '' : n.label}
                                    </text>
                                    <text x={pos.x + NODE_W / 2} y={pos.cy + 7} textAnchor="middle" dominantBaseline="middle" fill={pos.color} fontSize={8} fontFamily="monospace">
                                        {totalIn.toFixed(1)} BTC
                                    </text>
                                </g>
                            );
                        })}
                    </motion.svg>
                </div>
            )}

            {/* Top flows table */}
            {links.length > 0 && (
                <div className="space-y-1">
                    <p className="text-[10px] text-gray-600 uppercase tracking-wider font-bold">Top Flows</p>
                    {links.slice(0, 4).map((link, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(link.value / maxVal) * 100}%` }}
                                    transition={{ delay: i * 0.1, duration: 0.8 }}
                                    className="h-full rounded-full"
                                    style={{ background: nodes.find(n => n.id === link.source)?.color }}
                                />
                            </div>
                            <span className="text-gray-600 whitespace-nowrap w-32 truncate">{link.source}  {link.target}</span>
                            <span className="text-white font-mono font-bold shrink-0">{link.value.toFixed(1)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}


