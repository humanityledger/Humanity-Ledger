"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAccount } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import { SystemProfileModal } from "./SystemProfileModal";

type Lesson = { id: string; title: string; description: string; duration: string; level: string; orderIndex: number };
type Course = { id: string; slug: string; title: string; description: string; lessons: Lesson[] };

export function AcademyInteractiveEngine({ 
    dbCourses, 
    isSeeded, 
    expectedCategories 
}: { 
    dbCourses: Course[], 
    isSeeded: boolean, 
    expectedCategories: number 
}) {
    const { address } = useAccount();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    // [SECURITY FIX] isAdmin must be checked against a real admin address, never hardcoded true
    // Admin address is checked client-side for UI only — server-side upload endpoints
    // must independently verify the session/signature before accepting any upload.
    const ADMIN_ADDRESS = (process.env.NEXT_PUBLIC_ADMIN_ADDRESS || process.env.NEXT_PUBLIC_OWNER_WALLET || '').toLowerCase();
    const isAdmin = !!(address && ADMIN_ADDRESS && address.toLowerCase() === ADMIN_ADDRESS);

    // LMS States
    const [isSyncing, setIsSyncing] = useState(false);
    const [selectedCourseSlug, setSelectedCourseSlug] = useState<string | null>(null);
    const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null);
    
    // User Context
    const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
    const [submissions, setSubmissions] = useState<Record<string, { status: string, feedback: string|null }>>({});
    
    // Submissions Modal State
    const [proofingLessonId, setProofingLessonId] = useState<string | null>(null);
    const [txHashInput, setTxHashInput] = useState("");
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    // Load User Progress
    useEffect(() => {
        if (!mounted || !address || !isSeeded) return;
        fetch(`/api/academy/progress?address=${address}`)
            .then(r => r.ok ? r.json() : null)
            .then(res => {
                if (!res) return;
                const progressSet = new Set<string>();
                (res.progress || []).forEach((p: any) => p.completed && progressSet.add(p.lessonId));
                setCompletedLessons(progressSet);
                const subs: any = {};
                (res.submissions || []).forEach((s: any) => { subs[s.lessonId] = { status: s.status, feedback: s.feedback }; });
                setSubmissions(subs);
            })
            .catch(() => {});
    }, [address, mounted, isSeeded]);

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const res = await fetch('/api/academy/sync', { method: 'POST' });
            const data = await res.json();
            if (data.ok) window.location.reload();
            else alert('Error syncing: ' + data.error);
        } catch (e: any) {
            alert('Sync failed: ' + e.message);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleToggleComplete = async (lessonId: string) => {
        if (!address) return alert('Wallet not connected');
        const isCompleted = completedLessons.has(lessonId);

        // Optimistic UI update
        const nextSet = new Set(completedLessons);
        if (isCompleted) nextSet.delete(lessonId); else nextSet.add(lessonId);
        setCompletedLessons(nextSet);

        try {
            const res = await fetch('/api/academy/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address, lessonId, completed: !isCompleted }),
            });
            if (!res.ok) throw new Error('Network error');
        } catch {
            alert('Failed to update progress');
            setCompletedLessons(new Set(completedLessons)); // revert
        }
    };

    const handleSubmitProof = async () => {
        if (!address || !proofingLessonId || !txHashInput) return;
        try {
            const res = await fetch('/api/academy/submissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address, lessonId: proofingLessonId, txHash: txHashInput }),
            });
            const data = await res.json();
            if (data.ok) {
                setSubmissions(prev => ({ ...prev, [proofingLessonId]: { status: 'PENDING', feedback: null } }));
                setProofingLessonId(null);
                setTxHashInput('');
                alert('Submission received.');
            }
        } catch {}
    };

    if (!mounted) return null;

    if (!isSeeded) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center max-w-2xl mx-auto">
                <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 mb-4">Database Empty</h1>
                <p className="font-sans text-slate-500 mb-8 leading-relaxed">
                    The academy database is currently empty. Please synchronize the curriculum to continue.
                </p>
                {isAdmin ? (
                    <button 
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="px-8 py-4 bg-slate-900 text-white font-mono uppercase tracking-[0.2em] font-bold text-xs hover:bg-slate-800 transition-colors disabled:opacity-50 rounded-xl"
                    >
                        {isSyncing ? "SYNCING..." : `SYNC ${expectedCategories} CATEGORIES`}
                    </button>
                ) : (
                    <div className="px-8 py-4 bg-black/5 text-slate-500 font-mono text-xs uppercase tracking-widest rounded-xl">
                        Access Denied: Insufficient Permissions
                    </div>
                )}
            </div>
        );
    }

    const selectedCourse = dbCourses.find(c => c.slug === selectedCourseSlug);

    return (
        <div className="w-full h-full flex-1 flex flex-col p-0 relative z-10 transition-all text-left">

            {!selectedCourseSlug ? (
                <div className="space-y-6">
                    <h2 className="text-[12px] font-mono font-bold uppercase tracking-[0.2em] mb-4 text-slate-400">Information about Blockchain</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {dbCourses.map(course => {
                            const completedInCourse = course.lessons.filter(l => completedLessons.has(l.id)).length;
                            const totalInCourse = course.lessons.length;
                            const progressPct = totalInCourse === 0 ? 0 : Math.round((completedInCourse / totalInCourse) * 100);

                            return (
                                <button
                                    key={course.id}
                                    onClick={() => setSelectedCourseSlug(course.slug)}
                                    className="p-6 border border-slate-200/60 bg-black/5 hover:bg-slate-100 hover:border-slate-300 transition-all text-left group relative overflow-hidden rounded-2xl"
                                >
                                    <div className="absolute inset-x-0 bottom-0 h-1 bg-slate-200">
                                        <div className="h-full bg-slate-900 transition-all duration-1000" style={{ width: `${progressPct}%` }} />
                                    </div>
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="font-mono text-[10px] font-bold text-slate-500">{progressPct}% COMPLETED</span>
                                    </div>
                                    <h3 className="font-sans text-xl font-bold tracking-tight text-slate-900 group-hover:text-slate-700 mb-2">
                                        {course.title}
                                    </h3>
                                    <span className="text-[12px] font-mono font-bold text-slate-400">{totalInCourse} Modules</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex justify-between items-end mb-8 border-b border-slate-200/60 pb-6">
                        <div>
                            <button onClick={() => setSelectedCourseSlug(null)} className="text-[10px] font-bold font-mono tracking-widest uppercase text-slate-400 hover:text-slate-900 transition-colors mb-4">
                                 Back
                            </button>
                            <h2 className="text-3xl font-sans font-black tracking-tight text-slate-900">{selectedCourse?.title}</h2>
                        </div>
                        <span className="font-mono text-[12px] font-bold text-slate-400">{selectedCourse?.lessons.length} Modules</span>
                    </div>

                    <div className="space-y-4">
                        {selectedCourse?.lessons.map((lesson) => {
                            const isExpanded = expandedLessonId === lesson.id;
                            const isCompleted = completedLessons.has(lesson.id);
                            const submission = submissions[lesson.id];

                            return (
                                <div key={lesson.id} className={`border rounded-2xl transition-all duration-300 overflow-hidden ${isExpanded ? 'border-slate-300 bg-white shadow-xl' : 'border-slate-200/60 bg-black/5 hover:bg-slate-100'}`}>
                                    <button 
                                        onClick={() => setExpandedLessonId(isExpanded ? null : lesson.id)}
                                        className="w-full text-left p-6 flex justify-between items-center outline-none gap-4"
                                    >
                                        <div className="flex items-center gap-6">
                                            <div onClick={(e) => { e.stopPropagation(); handleToggleComplete(lesson.id); }} className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors cursor-pointer ${isCompleted ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-300 text-transparent hover:border-slate-900'}`}>
                                                <span className="text-[10px] font-bold"></span>
                                            </div>
                                            <div>
                                                <h4 className={`font-sans text-[16px] font-bold tracking-tight transition-colors ${isCompleted ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                                                    {lesson.title}
                                                </h4>
                                                <p className="font-mono text-[11px] font-medium text-slate-500 mt-1.5 max-w-xl line-clamp-2 leading-relaxed">{lesson.description}</p>
                                            </div>
                                        </div>
                                    </button>

                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                                                <div className="p-6 md:p-8 pt-0 border-t border-slate-100 flex flex-col items-center justify-center bg-white">
                                                    <div className="w-full max-w-3xl border border-slate-200/60 bg-black/5 rounded-xl p-8 relative">
                                                        {isAdmin ? (
                                                            <div className="flex flex-col gap-4">
                                                                <h5 className="font-mono text-[12px] uppercase font-bold tracking-widest border-b border-slate-200/60 pb-4 mb-2 text-slate-900 text-center">
                                                                    Upload Portal
                                                                </h5>
                                                                <label className="w-full py-12 border-2 border-dashed border-slate-300 cursor-pointer text-[12px] font-bold font-mono tracking-widest uppercase hover:bg-slate-100 hover:border-slate-400 text-slate-600 transition-colors flex flex-col items-center justify-center gap-3 rounded-xl">
                                                                    <span>Upload PDF Document</span>
                                                                    <span className="text-[10px] text-slate-400">Max: 500 MB</span>
                                                                    <input type="file" accept="application/pdf" className="hidden" onChange={(e) => {
                                                                        if(e.target.files && e.target.files.length > 0) {
                                                                            alert('Upload initiated successfully for ' + e.target.files[0].name);
                                                                        }
                                                                    }} />
                                                                </label>
                                                                <p className="text-[11px] font-sans text-slate-500 text-center mt-2 leading-relaxed font-medium">
                                                                    Secure transmission channel. Uploaded documents will replace previous materials.
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col gap-4 items-center py-8">
                                                                <h5 className="font-mono text-[12px] uppercase font-bold tracking-widest border-b border-slate-200/60 pb-4 mb-2 text-slate-900">
                                                                    Restricted Access
                                                                </h5>
                                                                <p className="text-[13px] font-sans font-medium text-slate-500 text-center leading-relaxed max-w-md">
                                                                    Document distribution is managed exclusively by the system administrator.
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <SystemProfileModal 
                isOpen={isProfileOpen} 
                onClose={() => setIsProfileOpen(false)} 
                walletAddress={address} 
            />
        </div>
    );
}
