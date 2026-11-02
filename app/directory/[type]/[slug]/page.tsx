import React from 'react';
import { runQuery } from '@/lib/neo4j';
import { Activity, Landmark, Wallet, Network } from 'lucide-react';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function KnowledgeGraphEntityPage({
  params
}: {
  params: Promise<{ type: string, slug: string }>
}) {
  const { type, slug } = await params;

  // Allowed dynamic types: 'people', 'companies', 'tokens'
  const TypeMapping: Record<string, string> = {
    'people': 'Person',
    'companies': 'Company',
    'tokens': 'Token'
  };

  const label = TypeMapping[type];
  if (!label) return notFound();

  // Simple Cypher query matching the specific label and slug,
  // fetching inbound and outbound relationships for the full Context Graph
  const query = `
    MATCH (n:${label} {slug: $slug})
    OPTIONAL MATCH (n)-[r_out]->(outbound)
    OPTIONAL MATCH (inbound)-[r_in]->(n)
    RETURN 
      n AS entity, 
      collect(DISTINCT {relation: type(r_out), node: outbound, label: labels(outbound)[0]}) AS outEdges,
      collect(DISTINCT {relation: type(r_in), node: inbound, label: labels(inbound)[0]}) AS inEdges
  `;

  const result = await runQuery(query, { slug });

  if (result.records.length === 0) {
    return notFound();
  }

  const record = result.records[0];
  const entity = record.get('entity').properties;
  const outEdges = record.get('outEdges').filter((e: any) => e.node);
  const inEdges = record.get('inEdges').filter((e: any) => e.node);

  return (
    <div className="min-h-screen bg-transparent text-[#050505] p-12">
      <header className="mb-12 border-b border-black/10 pb-6 flex justify-between items-end">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.25em] opacity-40 mb-2 block text-indigo-600">
            Ledger Directory / {label} // Private TERMINAL INDEX
          </span>
          <h1 className="text-6xl font-black tracking-tighter uppercase italic drop-shadow-sm">
            {entity.name || slug}
          </h1>
        </div>
        <div className="text-right">
           <span className="text-xs font-bold uppercase tracking-widest opacity-30">Status</span>
           <p className="font-mono text-sm tracking-widest text-[#00C076] animate-pulse">ON-CHAIN SYNCED</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Metric Cards Grid */}
        <div className="col-span-1 space-y-4">
           {entity.capitalInfluenced && (
             <div className="bg-white p-6 border border-black/5 shadow-xl shadow-black/5 rounded-3xl">
                <div className="flex items-center gap-3 mb-4 opacity-50">
                   <Landmark size={18} />
                   <span className="text-[9px] font-black uppercase tracking-[0.2em]">Capital Influenced</span>
                </div>
                <div className="font-sans text-3xl font-light">
                  ${(entity.capitalInfluenced / 1000000000).toFixed(2)}<span className="text-xl opacity-40 ml-1">B</span>
                </div>
             </div>
           )}
           {entity.balanceUsd && (
             <div className="bg-white p-6 border border-black/5 shadow-xl shadow-black/5 rounded-3xl">
                <div className="flex items-center gap-3 mb-4 opacity-50">
                   <Wallet size={18} />
                   <span className="text-[9px] font-black uppercase tracking-[0.2em]">Identified Wallets Balance</span>
                </div>
                <div className="font-sans text-3xl font-light">
                  ${(entity.balanceUsd / 1000000).toFixed(2)}<span className="text-xl opacity-40 ml-1">M</span>
                </div>
             </div>
           )}
           {/* General Properties List */}
           <div className="bg-white p-6 border border-black/5 rounded-3xl">
              <h3 className="text-[11px] font-black tracking-widest uppercase mb-4 pb-2 border-b border-black/5 opacity-60">Graph Properties</h3>
              {Object.entries(entity).map(([key, val]) => (
                key !== 'name' && key !== 'slug' && key !== 'capitalInfluenced' && key !== 'balanceUsd' && (
                  <div key={key} className="flex justify-between items-center py-2">
                     <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">{key}</span>
                     <span className="font-mono text-xs">{String(val)}</span>
                  </div>
                )
              ))}
           </div>
        </div>

        {/* Global Relationship Graph Representation */}
        <div className="col-span-1 md:col-span-2 space-y-6">
           <div className="bg-white p-8 border border-black/5 shadow-2xl rounded-[2.5rem] min-h-[400px]">
              <div className="flex items-center gap-3 mb-8">
                 <Network size={20} className="text-indigo-600" />
                 <h2 className="text-[14px] font-black uppercase tracking-[0.25em]">System Web3 Ontology</h2>
              </div>
              
              <div className="space-y-6">
                 {/* OUTBOUND */}
                 {outEdges.length > 0 && (
                   <div>
                      <h4 className="text-[10px] uppercase font-bold tracking-widest opacity-30 mb-3">Outgoing Relations</h4>
                      <div className="grid grid-cols-2 gap-4">
                         {outEdges.map((edge: any, i: number) => (
                           <div key={i} className="p-4 bg-white/20 backdrop-blur-md border border-black/5 rounded-2xl flex items-center gap-4 hover:border-indigo-600/30 transition-colors cursor-pointer group">
                              <span className="text-[9px] font-mono font-black uppercase text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md">{edge.relation}</span>
                              <div className="flex flex-col">
                                 <span className="font-bold text-[12px]">{edge.node.properties.name || edge.node.properties.address || edge.node.properties.symbol}</span>
                                 <span className="text-[9px] uppercase tracking-widest opacity-50">{edge.label}</span>
                              </div>
                           </div>
                         ))}
                      </div>
                   </div>
                 )}

                 {/* INBOUND */}
                 {inEdges.length > 0 && (
                   <div>
                      <h4 className="text-[10px] uppercase font-bold tracking-widest opacity-30 mb-3 mt-6">Incoming Flows</h4>
                      <div className="grid grid-cols-2 gap-4">
                         {inEdges.map((edge: any, i: number) => (
                           <div key={i} className="p-4 bg-white/20 backdrop-blur-md border border-black/5 rounded-2xl flex items-center gap-4 hover:border-black/20 transition-colors cursor-pointer group">
                              <span className="text-[9px] font-mono font-black uppercase text-black/50 bg-black/5 px-2 py-1 rounded-md">{edge.relation}</span>
                              <div className="flex flex-col">
                                 <span className="font-bold text-[12px]">{edge.node.properties.name || edge.node.properties.address || edge.node.properties.symbol}</span>
                                 <span className="text-[9px] uppercase tracking-widest opacity-50">{edge.label}</span>
                              </div>
                           </div>
                         ))}
                      </div>
                   </div>
                 )}

                 {outEdges.length === 0 && inEdges.length === 0 && (
                    <div className="text-center opacity-30 py-12">
                       <p className="text-[11px] font-mono uppercase tracking-widest">Awaiting Nexus Connections</p>
                    </div>
                 )}
              </div>
           </div>
        </div>

      </div>
    </div>
  );
}
