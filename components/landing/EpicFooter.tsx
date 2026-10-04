"use client";

import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { LegendaryDownhead } from './LegendaryDownhead';

gsap.registerPlugin(ScrollTrigger);

export function EpicFooter() {
    const footerRef = useRef<HTMLElement>(null);
    const textRef = useRef<HTMLDivElement>(null);
    const ctaRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const ctx = gsap.context(() => {
            // Parallax Entry for Footer
            gsap.fromTo(textRef.current, 
                { y: -100, opacity: 0 },
                {
                    y: 0,
                    opacity: 1,
                    ease: "none",
                    scrollTrigger: {
                        trigger: footerRef.current,
                        start: "top bottom",
                        end: "top center",
                        scrub: true,
                    }
                }
            );

            // Button scaling up based on reverse scroll trigger
            gsap.fromTo(ctaRef.current,
                { scale: 0.8, opacity: 0 },
                {
                    scale: 1,
                    opacity: 1,
                    ease: "back.out(1.7)",
                    scrollTrigger: {
                        trigger: ctaRef.current,
                        start: "top bottom-=100",
                        toggleActions: "play none none reverse"
                    }
                }
            );
        }, footerRef);

        return () => ctx.revert();
    }, []);

    return (
        <footer ref={footerRef} className="relative w-full h-screen bg-white flex flex-col items-center justify-center overflow-hidden">
            
            {/* Massive Background Typography */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5 select-none">
                <span className="text-[20vw] font-black uppercase tracking-tighter text-white whitespace-nowrap">
                    Humanity Ledger
                </span>
            </div>

            <div className="relative z-10 w-full max-w-4xl px-6 text-center">
                <div ref={textRef}>
                    <h2 className="text-5xl md:text-8xl font-black text-white uppercase tracking-tighter mb-6 leading-none">
                        The Future <br/>Is Cyclic
                    </h2>
                    <p className="text-sm md:text-base text-white/40 font-mono mb-12 max-w-xl mx-auto">
                        Start the terminal. Secure your algorithmic advantage before the network memory refreshes.
                    </p>
                </div>

                <div ref={ctaRef}>
                    <button className="relative px-12 py-6 bg-white text-black text-xs font-black uppercase tracking-[0.3em] rounded-full overflow-hidden group hover:scale-105 transition-transform duration-300">
                        <div className="absolute inset-0 bg-[#ef4444] scale-y-0 origin-bottom transition-transform duration-300 ease-out group-hover:scale-y-100" />
                        <span className="relative z-10 group-hover:text-white transition-colors duration-300">
                            Start Terminal 
                        </span>
                    </button>
                    
                    <LegendaryDownhead />
                </div>
            </div>

            <div className="absolute bottom-6 left-6 text-[9px] text-white/20 font-mono uppercase">
                Humanity Ledger © 2026 // Nivel: Institucional
            </div>
            
        </footer>
    );
}

