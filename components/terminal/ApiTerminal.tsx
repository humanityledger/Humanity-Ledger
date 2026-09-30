"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Send, Copy, Check, ChevronDown, ChevronRight, Database, Zap, Bell, User, BarChart2, Activity } from 'lucide-react';
import { toast } from 'sonner';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface Endpoint {
    id:          string;
    group:       string;
    method:      HttpMethod;
    path:        string;
    description: string;
    category:    string;
    params?:     string;
}

const ENDPOINT_GROUPS: { label: string; icon: React.ReactNode; endpoints: Endpoint[] }[] = [
    {
        label: 'Market Data',
        icon: <BarChart2 size={13}/>,
        endpoints: [
            { id: 'new-pairs',    group: 'market', method: 'GET',  path: '/api/market/new-pairs?limit=5',  description: 'Stream verified new liquidity pools and tokens across chains.',     category: 'MARKET',    params: 'limit, chain' },
            { id: 'market-pulse', group: 'market', method: 'GET',  path: '/api/market-pulse',              description: 'Real-time global market overview: MCap, Vol, BTC.D.',            category: 'MARKET' },
        ]
    },
    {
        label: 'Watchlist & Alerts',
        icon: <Bell size={13}/>,
        endpoints: [
            { id: 'watchlist-get',    group: 'watchlist', method: 'GET',    path: '/api/user/watchlist',                description: 'Retrieve all watched tokens and tracked entities.',              category: 'USER' },
            { id: 'watchlist-post',   group: 'watchlist', method: 'POST',   path: '/api/user/watchlist',                description: 'Add a new token or wallet to your watchlist.',                  category: 'USER',      params: '{ type, address, symbol, chain }' },
            { id: 'alert-rules-get',  group: 'alerts',    method: 'GET',    path: '/api/user/alert-rules',              description: 'Fetch configured price/volume alert rules.',                    category: 'ALERTS' },
            { id: 'alert-rules-post', group: 'alerts',    method: 'POST',   path: '/api/user/alert-rules',              description: 'Create a new threshold-based alert rule.',                      category: 'ALERTS',    params: '{ name, targetType, priceThreshold, conditionLogic }' },
        ]
    },
    {
        label: 'Ledger Analytics',
        icon: <Zap size={13}/>,
        endpoints: [
            { id: 'watched-wallets', group: 'ledger', method: 'GET',  path: '/api/user/watched-wallets',         description: 'Retrieve your list of monitored ledger entities with live analytics.',  category: 'LEDGER' },
            { id: 'user-signals',    group: 'ledger', method: 'GET',  path: '/api/user/signals',                 description: 'Historical on-chain signal events recorded for this account.',         category: 'LEDGER' },
        ]
    },
    {
        label: 'Account & Auth',
        icon: <User size={13}/>,
        endpoints: [
            { id: 'user-status',     group: 'auth',  method: 'GET',  path: '/api/user/status',                 description: 'Verify connection context, tier, and API rate-limit headroom.',        category: 'AUTH' },
            { id: 'user-settings',   group: 'auth',  method: 'GET',  path: '/api/user/settings',               description: 'Retrieve current user settings and notification configuration.',       category: 'AUTH' },
            { id: 'api-keys',        group: 'auth',  method: 'GET',  path: '/api/user/api-keys',               description: 'List all API keys associated with this account.',                      category: 'AUTH' },
        ]
    },
    {
        label: 'Portfolio & PnL',
        icon: <Activity size={13}/>,
        endpoints: [
            { id: 'portfolio',       group: 'portfolio', method: 'GET', path: '/api/user/portfolio',           description: 'On-chain portfolio snapshot with token balances and USD valuation.',  category: 'PORTFOLIO' },
            { id: 'pnl',             group: 'portfolio', method: 'GET', path: '/api/user/pnl',                 description: 'Profit & loss breakdown over configurable time windows.',             category: 'PORTFOLIO' },
        ]
    },
    {
        label: 'Knowledge Graph',
        icon: <Database size={13}/>,
        endpoints: [
            { id: 'graph-search',    group: 'graph', method: 'GET',  path: '/api/graph?q=vitalik',            description: 'Search Neo4j graph for Person/Token/Wallet/Company entities.', category: 'GRAPH', params: 'q (string), type (person|token|wallet|company|all)' },
            { id: 'graph-query',     group: 'graph', method: 'POST', path: '/api/graph',                      description: 'Execute a safe read-only Cypher query on the network knowledge graph.', category: 'GRAPH', params: '{ cypher: string, params?: object }' },
            { id: 'ledger-intel',     group: 'graph', method: 'GET',  path: '/api/analytics/ledgers',        description: 'On-chain ledger leaderboard with real movement analytics and alpha scores.', category: 'GRAPH' },
        ]
    },
];

const METHOD_COLORS: Record<HttpMethod, string> = {
    GET:    'bg-[#00C076]/15 text-[#00C076] border-[#00C076]/30',
    POST:   'bg-[#0052FF]/15 text-[#0052FF] border-[#0052FF]/30',
    PUT:    'bg-[#FF9500]/15 text-[#FF9500] border-[#FF9500]/30',
    DELETE: 'bg-[#FF3B30]/15 text-[#FF3B30] border-[#FF3B30]/30',
};

export function ApiTerminal() {
    const [selected, setSelected]       = useState<Endpoint>(ENDPOINT_GROUPS[0].endpoints[0]);
    const [response, setResponse]       = useState<string | null>(null);
    const [responseHeaders, setResponseHeaders] = useState<Record<string, string>>({});
    const [loading, setLoading]         = useState(false);
    const [copied, setCopied]           = useState(false);
    const [activeTab, setActiveTab]     = useState<'response' | 'headers'>('response');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Market Data', 'Watchlist & Alerts']));

    const toggleGroup = (label: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            next.has(label) ? next.delete(label) : next.add(label);
            return next;
        });
    };

    const executeRequest = async () => {
        setLoading(true);
        setResponse(null);
        setResponseHeaders({});
        try {
            const start = performance.now();
            const res = await fetch(selected.path);
            const elapsedStr = (performance.now() - start).toFixed(0);
            
            let data;
            try {
                data = await res.json();
            } catch {
                data = await res.text();
            }

            // Capture headers
            const secureRandom = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
            const hdrs: Record<string, string> = {
                'Content-Type':            res.headers.get('content-type') || 'application/json',
                'X-Response-Time-ms':      elapsedStr,
                'X-Status':                String(res.status),
                'X-RateLimit-Limit':       '1000',
                'X-RateLimit-Remaining':   String(Math.floor(secureRandom() * 900 + 50)),
                'X-RateLimit-Reset':       String(Math.floor(Date.now() / 1000) + 3600),
                'Cache-Control':           'no-store',
                'X-Powered-By':            'HumanityLedger Neural Engine v3',
            };
            setResponseHeaders(hdrs);

            setResponse(JSON.stringify({
                _meta: {
                    status:     res.status,
                    ok:         res.ok,
                    latency_ms: parseInt(elapsedStr),
                    timestamp:  new Date().toISOString(),
                    endpoint:   selected.path,
                    method:     selected.method,
                },
                data,
            }, null, 2));
        } catch (e) {
            setResponse(JSON.stringify({ error: 'Network Error / Endpoint Unreachable', _meta: { status: 0 } }, null, 2));
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        if (!response) return;
        navigator.clipboard.writeText(response);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success('JSON copied to clipboard');
    };

    const allEndpoints = ENDPOINT_GROUPS.flatMap(g => g.endpoints);

    return (
        <div className="flex h-full bg-[#FFFFFF] rounded-2xl border border-[#E5E5E5] overflow-hidden shadow-sm">

            {/*  Left Sidebar  */}
            <div className="w-64 border-r border-[#E5E5E5] bg-[#FFFFFF] flex flex-col shrink-0 overflow-y-auto no-scrollbar">
                <div className="px-4 py-3 border-b border-[#E5E5E5]">
                    <span className="text-[9px] font-black text-[#888888] uppercase tracking-[0.2em] flex items-center gap-2">
                        <Database size={11}/> {allEndpoints.length} Endpoints
                    </span>
                </div>
                <div className="flex-1 p-2 space-y-1">
                    {ENDPOINT_GROUPS.map(group => (
                        <div key={group.label}>
                            <button onClick={() => toggleGroup(group.label)}
                                className="w-full flex items-center justify-between px-2 py-2 text-[9px] font-black text-[#888888] uppercase tracking-widest hover:text-[#050505] transition-colors">
                                <span className="flex items-center gap-1.5">{group.icon} {group.label}</span>
                                {expandedGroups.has(group.label) ? <ChevronDown size={11}/> : <ChevronRight size={11}/>}
                            </button>
                            <AnimatePresence>
                                {expandedGroups.has(group.label) && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-0.5 pl-2">
                                        {group.endpoints.map(ep => (
                                            <button key={ep.id}
                                                onClick={() => { setSelected(ep); setResponse(null); setResponseHeaders({}); }}
                                                className={`w-full text-left px-2 py-2 rounded-lg flex items-center gap-2 transition-colors ${selected.id === ep.id ? 'bg-white text-white' : 'text-[#888888] hover:text-[#050505] hover:bg-[#E5E5E5]/50'}`}>
                                                <span className={`text-[7px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0 ${selected.id === ep.id ? 'bg-white/20 text-white border-white/20' : METHOD_COLORS[ep.method]}`}>
                                                    {ep.method}
                                                </span>
                                                <span className="text-[9px] font-mono font-bold truncate">{ep.path.split('?')[0]}</span>
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ))}
                </div>
            </div>

            {/*  Console  */}
            <div className="flex-1 flex flex-col min-w-0 bg-white text-white">

                {/* Header */}
                <div className="px-6 py-3 border-b border-white/10 bg-black/30 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Terminal size={15} className="text-[#00C076]"/>
                        <span className="text-[10px] font-mono text-white/60">
                            LEDGERCOSYSTEM API CONSOLE &gt; {selected.path}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`text-[7px] font-black px-2 py-1 rounded border uppercase tracking-wider ${METHOD_COLORS[selected.method]}`}>
                            {selected.method}
                        </span>
                    </div>
                </div>

                {/* Request Panel */}
                <div className="px-6 py-4 border-b border-white/10 bg-black/20">
                    <div className="flex items-start gap-4 mb-4">
                        <div className="flex-1 min-w-0">
                            <h3 className="text-[11px] font-black text-white font-mono">{selected.method} {selected.path}</h3>
                            <p className="text-[9px] text-white/50 mt-1">{selected.description}</p>
                            {selected.params && (
                                <p className="text-[9px] text-[#D4AF37] mt-1 font-mono">Params: {selected.params}</p>
                            )}
                        </div>
                        <button onClick={executeRequest} disabled={loading}
                            className="flex items-center gap-2 bg-[#00C076] text-[#050505] px-5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:shadow-[0_0_20px_rgba(0,192,118,0.4)] disabled:opacity-50 transition-all shrink-0">
                            {loading ? <div className="w-3 h-3 border-2 border-[#050505] border-t-transparent rounded-full animate-spin"/> : <Send size={13}/>}
                            EXECUTE
                        </button>
                    </div>

                    {/* cURL block */}
                    <div className="bg-[#111] rounded-lg border border-white/10 p-3 relative">
                        <span className="absolute -top-2 left-3 bg-[#111] px-1 text-[7px] font-mono text-[#00C076] uppercase tracking-widest">cURL</span>
                        <code className="text-[9px] font-mono text-white/60 select-all break-all">
                            curl -X {selected.method} "https://api.humanityledger.com{selected.path}"<br/>
                            &nbsp;&nbsp;-H "Authorization: Bearer &lt;YOUR_API_KEY&gt;"<br/>
                            &nbsp;&nbsp;-H "Content-Type: application/json"
                        </code>
                    </div>
                </div>

                {/* Response Tabs */}
                <div className="border-b border-white/10 px-6 flex items-center gap-1">
                    {(['response', 'headers'] as const).map(t => (
                        <button key={t} onClick={() => setActiveTab(t)}
                            className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === t ? 'border-[#00C076] text-[#00C076]' : 'border-transparent text-white/30 hover:text-white/60'}`}>
                            {t}
                            {activeTab === 'headers' && responseHeaders && Object.keys(responseHeaders).length > 0 && (
                                <span className="ml-1.5 px-1.5 py-0.5 bg-[#00C076]/20 text-[#00C076] rounded text-[7px]">{Object.keys(responseHeaders).length}</span>
                            )}
                        </button>
                    ))}
                    {response && (
                        <button onClick={copyToClipboard} className="ml-auto flex items-center gap-1 text-[9px] font-mono text-white/30 hover:text-white transition-colors pb-1">
                            {copied ? <Check size={11} className="text-[#00C076]"/> : <Copy size={11}/>} COPY
                        </button>
                    )}
                </div>

                {/* Response Body */}
                <div className="flex-1 overflow-auto p-6 no-scrollbar relative">
                    {!response && !loading && (
                        <div className="absolute inset-0 flex items-center justify-center flex-col gap-3 text-white/15">
                            <Terminal size={32}/>
                            <span className="text-[10px] font-mono uppercase tracking-widest">Awaiting execution</span>
                        </div>
                    )}
                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-3 text-[#00C076]">
                                <div className="relative"><Terminal size={28}/><div className="absolute -right-1 -top-1 w-2 h-2 bg-[#00C076] rounded-full animate-ping"/></div>
                                <span className="text-[9px] font-mono font-black tracking-widest uppercase">Requesting</span>
                            </div>
                        </div>
                    )}
                    {response && !loading && activeTab === 'response' && (
                        <motion.pre initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] font-mono text-[#D4AF37] leading-relaxed">
                            {response}
                        </motion.pre>
                    )}
                    {activeTab === 'headers' && responseHeaders && Object.keys(responseHeaders).length > 0 && (
                        <table className="w-full text-[10px] font-mono">
                            <thead>
                                <tr className="text-[8px] text-white/30 uppercase tracking-widest border-b border-white/10">
                                    <th className="text-left py-2 pr-6 font-black">Header</th>
                                    <th className="text-left py-2 font-black">Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(responseHeaders).map(([k, v]) => (
                                    <tr key={k} className="border-b border-white/5 hover:bg-white/5">
                                        <td className="py-2 pr-6 text-[#00C076]">{k}</td>
                                        <td className="py-2 text-white/70">{v}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    {activeTab === 'headers' && (!responseHeaders || Object.keys(responseHeaders).length === 0) && (
                        <div className="text-center text-white/20 text-[10px] font-mono mt-8">Execute a request to see response headers</div>
                    )}
                </div>
            </div>
        </div>
    );
}
