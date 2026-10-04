"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BookOpen, Lock, CheckCircle, PlayCircle,
    TrendingUp, Globe, Clock, ChevronRight, Star, Code, BarChart2
} from 'lucide-react';
import useSWR from 'swr';

interface Lesson {
    id: string;
    title: string;
    duration: string;
    level: 'Beginner' | 'Intermediate' | 'Advanced';
    completed: boolean;
    locked: boolean;
    description: string;
}

interface Course {
    id: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    lessons: Lesson[];
    progress: number;
    totalDuration: string;
    badge?: string;
}

const LEVEL_COLORS: Record<string, string> = {
    Beginner: '#00C076',
    Intermediate: '#FF9500',
    Advanced: '#FF3B30'
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function LedgerAcademy() {
    const { data: rawData, mutate } = useSWR('/api/academy', fetcher);

    const MAPPED_ICONS: Record<string, React.ReactNode> = {
        'ledger-basics': <Globe size={20} />,
        'defi-mastery': <TrendingUp size={20} />,
        'api-terminal': <Code size={20} />,
        'portfolio-mgmt': <BarChart2 size={20} />
    };
    const MAPPED_COLORS: Record<string, string> = {
        'ledger-basics': '#627EEA',
        'defi-mastery': '#00C076',
        'api-terminal': '#9945FF',
        'portfolio-mgmt': '#D4AF37'
    };

    const COURSES: Course[] = rawData?.data?.map((co: any) => ({
        ...co,
        icon: MAPPED_ICONS[co.id] || <BookOpen size={20} />,
        color: MAPPED_COLORS[co.id] || '#050505'
    })) || [];

    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

    const markLessonComplete = async () => {
        if (!selectedLesson) return;
        try {
            await fetch('/api/academy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lessonId: selectedLesson.id })
            });
            mutate();
            setSelectedLesson({ ...selectedLesson, completed: true });
            if (selectedCourse) setSelectedCourse({
                ...selectedCourse,
                lessons: selectedCourse.lessons.map(l => l.id === selectedLesson.id ? { ...l, completed: true } : l)
            });
        } catch (e) {
            console.error("Failure updating lesson", e);
        }
    };

    //  Lesson view 
    if (selectedLesson && selectedCourse) {
        return (
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                    <button onClick={() => setSelectedLesson(null)}
                        className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#888888] hover:text-[#050505] transition-colors">
                        <ChevronRight size={13} className="rotate-180" /> Back
                    </button>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#CCCCCC]">
                        / {selectedCourse.title}
                    </span>
                </div>

                <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-[8px] px-2 py-1 rounded-lg font-black uppercase tracking-widest"
                            style={{ background: LEVEL_COLORS[selectedLesson.level] + '15', color: LEVEL_COLORS[selectedLesson.level] }}>
                            {selectedLesson.level}
                        </span>
                        <span className="text-[9px] font-mono flex items-center gap-1 text-[#888888]">
                            <Clock size={10} />{selectedLesson.duration}
                        </span>
                    </div>
                    <h2 className="text-xl font-bold text-[#050505] uppercase tracking-[0.1em] mb-2">{selectedLesson.title}</h2>
                    <p className="text-[11px] text-[#555555] leading-relaxed mb-6">{selectedLesson.description}</p>

                    <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-xl p-5 mb-6">
                        <div className="flex items-center gap-2 mb-3">
                            <PlayCircle size={16} className="text-[#050505]" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#050505]">Video Lesson</span>
                        </div>
                        <div className="aspect-video rounded-xl bg-[#F0F0F0] border border-[#E5E5E5] flex flex-col items-center justify-center">
                            <PlayCircle size={40} className="text-[#CCCCCC] mb-2" />
                            <p className="text-[9px] font-black uppercase tracking-widest text-[#CCCCCC]">Premium access required</p>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={() => setSelectedLesson(null)}
                            className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-[#E5E5E5] text-[#888888] hover:text-[#050505] hover:border-[#050505] transition-all">
                             Back
                        </button>
                        <button onClick={markLessonComplete}
                            className="flex-1 py-2.5 rounded text-[10px] font-bold uppercase tracking-widest bg-white text-white hover:bg-[#A0A0A0] transition-colors flex items-center justify-center gap-2 border border-transparent">
                            <CheckCircle size={13} />
                            {selectedLesson.completed ? 'COMPLETED' : 'MARK COMPLETE'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    //  Course detail view 
    if (selectedCourse) {
        return (
            <div className="flex flex-col gap-4">
                <button onClick={() => setSelectedCourse(null)}
                    className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#888888] hover:text-[#050505] transition-colors w-fit">
                    <ChevronRight size={13} className="rotate-180" /> All Courses
                </button>

                <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5 shadow-sm">
                    <div className="flex items-start gap-4 mb-4">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0"
                            style={{ background: selectedCourse.color }}>
                            {selectedCourse.icon}
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <h2 className="text-sm font-black text-[#050505] uppercase tracking-tight">{selectedCourse.title}</h2>
                                {selectedCourse.badge && (
                                    <span className="text-[7px] px-1.5 py-0.5 rounded font-black uppercase bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20">
                                        {selectedCourse.badge}
                                    </span>
                                )}
                            </div>
                            <p className="text-[10px] text-[#888888] leading-relaxed mb-3">{selectedCourse.description}</p>
                            <div className="flex items-center gap-3">
                                <div className="flex-1 max-w-[200px] h-1.5 rounded-full bg-[#F0F0F0] overflow-hidden">
                                    <div className="h-full rounded-full transition-all" style={{ width: `${selectedCourse.progress}%`, background: selectedCourse.color }} />
                                </div>
                                <span className="text-[9px] font-black uppercase text-[#888888]">{selectedCourse.progress}%</span>
                                <span className="text-[9px] font-mono flex items-center gap-1 text-[#888888]">
                                    <Clock size={9} />{selectedCourse.totalDuration}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    {selectedCourse.lessons.map((lesson, i) => (
                        <motion.div key={lesson.id}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                            onClick={() => !lesson.locked && setSelectedLesson(lesson)}
                            className={`bg-white border border-[#E5E5E5] rounded-xl p-4 flex items-center gap-4 transition-all shadow-sm ${lesson.locked ? 'opacity-40 cursor-not-allowed' : 'hover:border-[#050505] hover:shadow-md cursor-pointer'}`}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                style={{ background: lesson.completed ? '#00C076' : '#FFFFFF', border: '1px solid #E5E5E5', color: lesson.completed ? '#fff' : '#888888' }}>
                                {lesson.completed ? <CheckCircle size={15} /> : lesson.locked ? <Lock size={13} /> : <PlayCircle size={15} />}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-[9px] font-black uppercase text-[#CCCCCC]">Lesson {i + 1}</span>
                                    <span className="text-[7px] px-1.5 py-0.5 rounded font-black uppercase"
                                        style={{ background: LEVEL_COLORS[lesson.level] + '15', color: LEVEL_COLORS[lesson.level] }}>
                                        {lesson.level}
                                    </span>
                                </div>
                                <p className="text-[11px] font-black text-[#050505]">{lesson.title}</p>
                                <p className="text-[9px] mt-0.5 text-[#888888]">{lesson.description}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[9px] font-mono flex items-center gap-1 text-[#888888]">
                                    <Clock size={9} />{lesson.duration}
                                </span>
                                <ChevronRight size={13} className="text-[#CCCCCC]" />
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        );
    }

    //  Main grid 
    return (
        <div className="h-full min-h-0 overflow-y-auto no-scrollbar flex flex-col gap-5 pb-4">
            {/* Header */}
            <div className="shrink-0 px-6 pt-5 pb-4 border-b border-[#E5E5E5] bg-white rounded-2xl shadow-sm flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-xl md:text-2xl font-bold uppercase tracking-[0.1em] text-[#050505]">
                            RESEARCH LIBRARY
                        </h1>
                    </div>
                    <p className="text-[10px] text-[#050505]/40 font-bold uppercase tracking-[0.2em] leading-tight">
                        Cognitive expansion through structured on-chain curriculum.
                    </p>
                </div>
                <div className="ml-auto hidden md:flex items-center gap-5">
                    {[
                        { label: 'Total Hours', value: '12h+' },
                        { label: 'Courses', value: COURSES.length.toString() },
                        { label: 'Rating', value: '4.9' },
                    ].map((s, i) => (
                        <div key={i} className="text-center">
                            <div className="text-base font-bold font-mono text-[#050505]">{s.value}</div>
                            <div className="text-[8px] uppercase tracking-widest text-[#888888]">{s.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Courses grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {COURSES.length === 0 ? (
                    [1, 2, 3, 4].map(i => (
                        <div key={i} className="bg-white border border-[#E5E5E5] rounded-2xl h-40 animate-pulse shadow-sm" />
                    ))
                ) : COURSES.map((course, i) => (
                    <motion.div key={course.id}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                        onClick={() => setSelectedCourse(course)}
                        className="bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden hover:border-[#050505] hover:shadow-md transition-all cursor-pointer shadow-sm group">
                        <div className="h-1" style={{ background: course.color }} />
                        <div className="p-5">
                            <div className="flex items-start gap-4 mb-4">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                                    style={{ background: course.color }}>
                                    {course.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <h3 className="text-[11px] font-bold text-[#050505] uppercase tracking-tight truncate">{course.title}</h3>
                                        {course.badge && (
                                            <span className="text-[7px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 bg-[#FFFFFF] text-[#A0A0A0] border border-[#E5E5E5]">
                                                {course.badge}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[9px] text-[#888888] leading-relaxed line-clamp-2">{course.description}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 mb-4">
                                <div className="flex-1 h-1 rounded-full bg-[#F0F0F0] overflow-hidden">
                                    <div className="h-full rounded-full transition-all" style={{ width: `${course.progress}%`, background: course.color }} />
                                </div>
                                <span className="text-[8px] font-black text-[#888888] shrink-0">{course.progress}%</span>
                            </div>

                            <div className="flex items-center gap-4 text-[9px] text-[#888888]">
                                <span className="flex items-center gap-1"><BookOpen size={10} />{course.lessons.length} lessons</span>
                                <span className="flex items-center gap-1"><Clock size={10} />{course.totalDuration}</span>
                                <span className="flex items-center gap-1 text-[#D4AF37]"><Star size={10} className="fill-[#D4AF37]" />4.9</span>
                            </div>

                            <div className="flex gap-1 mt-3">
                                {(['Beginner', 'Intermediate', 'Advanced'] as const).map(lvl => {
                                    const count = course.lessons.filter(l => l.level === lvl).length;
                                    return count > 0 ? (
                                        <span key={lvl} className="text-[7px] px-1.5 py-0.5 rounded font-black uppercase"
                                            style={{ background: LEVEL_COLORS[lvl] + '15', color: LEVEL_COLORS[lvl] }}>
                                            {count} {lvl}
                                        </span>
                                    ) : null;
                                })}
                            </div>
                        </div>
                        <div className="px-5 py-3 flex items-center justify-between border-t border-[#F0F0F0] bg-[#FFFFFF]">
                            <span className="text-[9px] font-black uppercase tracking-widest text-[#888888]">
                                {course.lessons.filter(l => l.completed).length}/{course.lessons.length} completed
                            </span>
                            <span className="text-[9px] font-black text-[#050505] flex items-center gap-1 group-hover:gap-2 transition-all">
                                {course.progress === 0 ? 'Start Course' : course.progress === 100 ? 'Review' : 'Continue'}
                                <ChevronRight size={12} />
                            </span>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
