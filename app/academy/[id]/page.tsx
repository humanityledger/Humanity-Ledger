import React from "react";
import { notFound } from "next/navigation";
import { ALL_MODULES } from "@/lib/data/academy-curriculum";
import { SystemFooter } from "@/components/landing/SystemFooter";
import { ArrowLeft, Clock, Shield, Target, Zap, Activity, BookOpen, Terminal } from "lucide-react";
import Link from "next/link";
import { ScrollFloat } from "@/components/ui/ScrollFloat";

export const dynamic = "force-dynamic";

export default async function AcademyModulePage({ params }: { params: Promise<{ id: string }> }) {
    const { id: moduleId } = await params;
    const moduleData = ALL_MODULES.find(m => m.id === moduleId);

    if (!moduleData) {
        notFound();
    }

    return (
        <div className="bg-transparent text-[#0A0A0A] flex flex-col">
            {/* Header / Navigation */}
            <header className="sticky top-0 z-50 px-6 py-4 border-b border-black/5 bg-white/20 backdrop-blur-3xl flex items-center justify-between">
                <Link href="/academy" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-black/50 hover:text-black transition-colors">
                    <ArrowLeft size={14} />
                    Back to Curriculum
                </Link>
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-pulse" />
                    <span className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-widest">System Intel Network Active</span>
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center px-6 py-12 md:py-24">
                <div className="w-full max-w-5xl flex flex-col gap-12">
                    {/* Hero Section */}
                    <div className="flex flex-col gap-6">
                        <div className="flex items-center gap-3">
                            <span className="px-3 py-1.5 rounded-lg bg-black/5 text-[10px] font-black uppercase tracking-widest text-black border border-black/10">
                                {moduleData.category}
                            </span>
                            <span className="text-[10px] font-mono text-black/40 uppercase tracking-widest">
                                MODULE {moduleData.level}
                            </span>
                        </div>
                        
                        <div className="max-w-4xl">
                            <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-[1.1] text-black">
                                {moduleData.title}
                            </h1>
                        </div>

                        <p className="text-lg md:text-xl font-mono text-black/60 max-w-3xl leading-relaxed">
                            {moduleData.desc}
                        </p>

                        <div className="flex flex-wrap items-center gap-4 mt-4">
                            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-black/50">
                                <Clock size={14} />
                                {moduleData.time}
                            </div>
                            <div className="w-1 h-1 rounded-full bg-black/20" />
                            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-black/50">
                                <Activity size={14} />
                                Level {moduleData.level} Security Clearance
                            </div>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="w-full h-px bg-black/10" />

                    {/* Content Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                        {/* Main Reading / Documentation */}
                        <div className="lg:col-span-2 flex flex-col gap-8">
                            <div className="flex flex-col gap-4">
                                <h3 className="text-sm font-black uppercase tracking-widest text-black flex items-center gap-2">
                                    <BookOpen size={16} />
                                    Executive Summary
                                </h3>
                                <div className="p-6 md:p-8 rounded-3xl bg-white border border-black/5 shadow-sm text-[13px] md:text-[15px] font-mono text-black/80 leading-loose">
                                    <p className="mb-6">{moduleData.content}</p>
                                    <p className="mb-6">
                                        In sovereign environments, the precise architecture defined in this module governs billions in capital flow. A complete mastery of 
                                        this specific vector allows an operator to predict, simulate, and potentially capitalize on systemic inefficiencies.
                                    </p>
                                    <p>
                                        The protocols and defensive mechanisms described herein are active across major layer-1 and layer-2 solutions. 
                                        You are required to understand these principles not just theoretically, but functionally, anticipating tail-risk scenarios.
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-4">
                                <h3 className="text-sm font-black uppercase tracking-widest text-black flex items-center gap-2">
                                    <Terminal size={16} />
                                    Terminal Execution Directives
                                </h3>
                                <div className="p-6 md:p-8 rounded-3xl bg-[#0A0A0A] border border-black/90 shadow-sm relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        <Zap size={64} className="text-white" />
                                    </div>
                                    <div className="flex flex-col gap-4 relative z-10 text-[11px] font-mono text-white/70 uppercase tracking-widest">
                                        <div className="flex items-start gap-4">
                                            <span className="text-[#00C076]">&gt;</span>
                                            <p>Initialize localized node synchronizer to verify network state integrity.</p>
                                        </div>
                                        <div className="flex items-start gap-4">
                                            <span className="text-[#00C076]">&gt;</span>
                                            <p>Compute probabilistic finality given current block propagation variance.</p>
                                        </div>
                                        <div className="flex items-start gap-4">
                                            <span className="text-[#00C076]">&gt;</span>
                                            <p>Assess cryptographic vulnerability surface based on module parameters.</p>
                                        </div>
                                        <div className="mt-6 flex items-center gap-4">
                                            <button className="px-6 py-3 rounded-xl bg-white text-black font-black uppercase tracking-widest text-[10px] hover:bg-white/90 transition-colors">
                                                Execute Simulation
                                            </button>
                                            <span className="text-[#D4AF37] font-bold">READY</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Sidebar */}
                        <div className="flex flex-col gap-6">
                            <div className="p-6 rounded-3xl bg-white border border-black/5 flex flex-col gap-4 shadow-sm">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-black/40">Knowledge Vectors</h4>
                                <ul className="flex flex-col gap-3 text-[11px] font-black font-mono uppercase tracking-tight text-black/80">
                                    <li className="flex items-center gap-2">
                                        <Shield size={14} className="text-[#0052FF]" />
                                        Consensus Validation
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <Target size={14} className="text-[#FF3B30]" />
                                        Risk Surface Mapping
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <Activity size={14} className="text-[#00C076]" />
                                        Active Network Metrics
                                    </li>
                                </ul>
                            </div>

                            <div className="p-6 rounded-3xl bg-white/20 backdrop-blur-xl border border-black/5 flex flex-col gap-4 shadow-inner">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-black/40">Requirements</h4>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white font-black text-sm">
                                        {Math.max(1, moduleData.level - 1)}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-black">Previous Module</span>
                                        <span className="text-[9px] font-mono text-black/50 uppercase">Completion Mandatory</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <SystemFooter />
        </div>
    );
}
