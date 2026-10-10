"use client";

import React, { useState } from 'react';

interface Props {
    title: string;
    subtitle?: string;
    image?: React.ReactNode;
    children?: React.ReactNode;
    color?: string;
}

export function InteractiveCard({ title, subtitle, image, children, color = "from-[#25D366] to-cyan-500" }: Props) {
    // Simple 3D Tilt logic
    const [rotation, setRotation] = useState({ x: 0, y: 0 });

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const card = e.currentTarget;
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((y - centerY) / centerY) * -10; // Max 10 deg
        const rotateY = ((x - centerX) / centerX) * 10;

        setRotation({ x: rotateX, y: rotateY });
    };

    const handleMouseLeave = () => {
        setRotation({ x: 0, y: 0 });
    };

    return (
        <div 
            className="relative perspective-1000 group w-full h-64 md:h-80"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            <div 
                className="
                    w-full h-full rounded-2xl p-6 
                    bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-md border border-white/10
                    shadow-xl transition-transform duration-100 ease-out
                    flex flex-col justify-between overflow-hidden relative
                "
                style={{
                    transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
                    transformStyle: 'preserve-3d'
                }}
            >
                {/* Background Glow */}
                <div className={`absolute -inset-20 bg-gradient-to-tr ${color} opacity-0 group-hover:opacity-20 blur-3xl transition-opacity duration-500 pointer-events-none`} />

                {/* Content Layer (Z-elevated) */}
                <div className="relative z-10 transform translate-z-10">
                    <div className="text-2xl font-bold text-white mb-2">{title}</div>
                    {subtitle && <div className="text-white/60 text-sm">{subtitle}</div>}
                </div>

                {/* Center Image/Icon */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500">
                    {image}
                </div>

                {/* Reveal Content on Hover */}
                <div className="relative z-10 transform translate-y-10 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                    {children}
                </div>
            </div>
        </div>
    );
}


