import React from "react";
import { TuringAcademicShield } from "@/components/academy/TuringAcademicShield";

export const dynamic = 'force-dynamic';

export default function AcademyPage() {
    return (
        <div className="flex flex-col bg-white text-slate-900 w-full">
            <div className="w-full flex flex-col items-center justify-start p-4 md:p-8">

                {/* ── ICAIEPHE 2026 — Turing Shield Anti-AI/Plagiarism Engine ── */}
                <div className="w-full max-w-[1200px] mt-4 mb-6 flex flex-col gap-3">
                    <div className="h-px w-full bg-slate-200" />
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-[11px] font-mono font-bold uppercase tracking-[0.25em] text-slate-400">
                                Academic Integrity Engine
                            </h2>
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                                Turing Shield — Anti-Plagiarism System
                            </h3>
                            <p className="text-[13px] text-slate-500 font-medium leading-relaxed max-w-2xl">
                                Zero-Knowledge proof engine for academic integrity verification.
                                Paste or upload your document to generate a cryptographic authenticity certificate anchored on Aztec Network.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="w-full max-w-[1200px] pb-16 flex flex-col">
                    <TuringAcademicShield />
                </div>
            </div>
        </div>
    );
}
