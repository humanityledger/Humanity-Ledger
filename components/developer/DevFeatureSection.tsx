'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ScrollLottie } from '@/components/ui/ScrollLottie';

interface DevFeatureSectionProps {
    title: string;
    description: string;
    details: string[]; // List of technical points
    lottieSrc: string;
    align?: 'left' | 'right';
    codeSnippet?: string;
}

export function DevFeatureSection({ title, description, details, lottieSrc, align = 'left', codeSnippet }: DevFeatureSectionProps) {
    const isLeft = align === 'left';

    return (
        <section className="py-24 px-6 relative overflow-hidden">
            <div className={`max-w-[2560px] mx-auto flex flex-col ${isLeft ? 'md:flex-row' : 'md:flex-row-reverse'} items-start gap-16 text-left`}>
                
                {/* TEXT CONTENT */}
                <motion.div 
                    initial={{ opacity: 0, x: isLeft ? -50 : 50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.8 }}
                    className="flex-1 space-y-8"
                >
                    <h2 className="text-4xl md:text-5xl font-black text-neutral-900 leading-tight">
                        {title}
                    </h2>
                    <p className="text-xl text-neutral-500 font-medium leading-relaxed">
                        {description}
                    </p>

                    <ul className="space-y-4">
                        {details.map((point, i) => (
                            <li key={i} className="flex items-start gap-4 text-neutral-600 font-mono text-sm border-l-2 border-neutral-200 pl-4">
                                <span className="text-blue-600 font-bold">0{i + 1}.</span>
                                {point}
                            </li>
                        ))}
                    </ul>

                    {codeSnippet && (
                        <div className="bg-[#1e1e1e] p-6 rounded-2xl shadow-xl overflow-x-auto border border-neutral-800">
                             <pre className="text-xs font-mono text-emerald-400">
                                 <code>{codeSnippet}</code>
                             </pre>
                        </div>
                    )}
                </motion.div>

                {/* VISUAL CONTENT (Lottie) */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="flex-1 relative w-full h-[500px]"
                >
                    {/* Background blob for depth */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-blue-50/50 to-purple-50/50 rounded-full blur-3xl opacity-50 transform scale-75" />
                    
                    <div className="relative z-10 w-full h-full drop-shadow-2xl">
                        <ScrollLottie src={lottieSrc} className="w-full h-full" speed={1} />
                    </div>
                </motion.div>

            </div>
        </section>
    );
}


