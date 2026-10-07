"use client";

import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Wallet, Repeat, Grid3x3, Bell, Download, Apple, Chrome } from 'lucide-react';
import Image from 'next/image';

export function WalletShowcaseSection() {
    const { scrollYProgress } = useScroll();
    const y = useTransform(scrollYProgress, [0, 1], [0, -50]);

    return (
        <section className="relative w-full py-32 overflow-hidden">
            <div className="max-w-[2560px] mx-auto px-6 text-left">
                <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="text-center mb-20"
                >
                    <h2 className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter text-[#1F1F1F] mb-6 uppercase">
                        Gestiona Todo <br className="hidden md:block" /> En Un Solo Lugar
                    </h2>
                    <p className="text-xl md:text-2xl text-[#1F1F1F]/60 max-w-3xl mx-auto font-light leading-relaxed">
                        Multiple wallets, one unified ecosystem. The simplicity you expected.
                    </p>
                </motion.div>

                {/* Visual Grid - 3 Feature Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
                    <FeatureCard
                        icon={<Wallet className="w-10 h-10" />}
                        title="Cambia Entre Wallets"
                        description="Manage multiple identities with a single touch. Frictionless."
                        delay={0}
                    />
                    <FeatureCard
                        icon={<Repeat className="w-10 h-10" />}
                        title="Swaps Instantáneos"
                        description="Intercambia tokens sin salir de tu wallet. Liquidez agregada."
                        delay={0.1}
                    />
                    <FeatureCard
                        icon={<Grid3x3 className="w-10 h-10" />}
                        title="NFTs Unificados"
                        description="Toda tu colección en un solo vistazo. Belleza y utilidad."
                        delay={0.2}
                    />
                </div>
            </div>
        </section>
    );
}

function FeatureCard({ icon, title, description, delay }: { 
    icon: React.ReactNode; 
    title: string; 
    description: string; 
    delay: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay }}
            className="bg-white/40 backdrop-blur-md border border-white/60 rounded-[2.5rem] p-8 lg:p-10 hover:bg-white/60 transition-all duration-500 group relative overflow-hidden"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-[#25D366]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="relative z-10">
                <div className="w-16 h-16 bg-[#1F1F1F] rounded-2xl flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform duration-300">
                    {icon}
                </div>
                <h3 className="text-2xl font-black text-[#1F1F1F] mb-3 tracking-tight">
                    {title}
                </h3>
                <p className="text-[#1F1F1F]/70 leading-relaxed font-medium">
                    {description}
                </p>
            </div>
        </motion.div>
    );
}

export function NotificationsSection() {
    return (
        <section className="relative w-full py-32 bg-gradient-to-b from-transparent to-[#1F1F1F]/5">
            <div className="max-w-[2560px] mx-auto px-6 text-left">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="grid md:grid-cols-2 gap-16 items-center"
                >
                    <div>
                        <div className="inline-flex items-center gap-2 bg-[#1F1F1F] text-white px-4 py-2 rounded-full text-sm font-bold mb-6 uppercase tracking-wider">
                            <Bell className="w-4 h-4" />
                            Tiempo Real
                        </div>
                        <h2 className="text-5xl md:text-6xl font-black tracking-tighter text-[#1F1F1F] mb-6 uppercase leading-tight">
                            Notificado <br />Sobre Lo Que <br />Importa
                        </h2>
                        <p className="text-xl text-[#1F1F1F]/70 leading-relaxed mb-8 font-light">
                            Mints, ventas, swaps. Cada movimiento es transmitido 
                            a tu feed en milisegundos. Sin demoras, sin sorpresas.
                        </p>
                        <ul className="space-y-3">
                            {[
                                'Confirmaciones instantáneas',
                                'Alertas de ledger activity',
                                'Resumen diario personalizado'
                            ].map((item, i) => (
                                <li key={i} className="flex items-center gap-3 text-[#1F1F1F] font-medium">
                                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Visual Mockup */}
                    <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="bg-white/50 backdrop-blur-xl rounded-[3rem] p-8 border border-white/60 shadow-2xl"
                    >
                        <div className="space-y-4">
                            <NotificationItem
                                type="success"
                                title="Minteaste un NFT"
                                subtitle="Leisurist #1762 por Grand Leisure"
                                time="ahora"
                            />
                            <NotificationItem
                                type="info"
                                title="Swap exitoso"
                                subtitle="1 ETH  0.05759 SOCKS"
                                time="3h atrás"
                            />
                            <NotificationItem
                                type="warning"
                                title="vitalik.eth vendió un NFT"
                                subtitle="Bibo 0745 por 0.085 ETH"
                                time="1h atrás"
                            />
                        </div>
                    </motion.div>
                </motion.div>
            </div>
        </section>
    );
}

function NotificationItem({ type, title, subtitle, time }: {
    type: 'success' | 'info' | 'warning';
    title: string;
    subtitle: string;
    time: string;
}) {
    const colors = {
        success: 'bg-green-100 border-green-300',
        info: 'bg-blue-100 border-blue-300',
        warning: 'bg-orange-100 border-orange-300'
    };

    return (
        <div className={`p-4 rounded-2xl border-2 ${colors[type]} backdrop-blur-sm`}>
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <h4 className="font-bold text-[#1F1F1F] mb-1">{title}</h4>
                    <p className="text-sm text-[#1F1F1F]/70">{subtitle}</p>
                </div>
                <span className="text-xs text-[#1F1F1F]/50 font-mono">{time}</span>
            </div>
        </div>
    );
}

export function DownloadCTASection() {
    return (
        <section className="relative w-full py-32 overflow-hidden">
            {/* Ultra High Quality Lines Background for Download Zone */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <Image src="/ios-android-hq.jpg" alt="Waves Pattern" fill className="object-cover object-center opacity-30  mix-blend-multiply " quality={100} priority />
                <div className="absolute inset-0 bg-gradient-to-t from-[#FFFFFF] via-transparent to-[#FFFFFF]   " />
            </div>
            
            <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="space-y-8"
                >
                    <h2 className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter text-[#1F1F1F] uppercase leading-tight">
                        Descarga <br className="md:hidden" /> Humanity Ledger Wallet <br className="hidden md:block" /> Para Empezar
                    </h2>
                    <p className="text-xl md:text-2xl text-[#1F1F1F]/60 max-w-2xl mx-auto font-light leading-relaxed">
                        Disponible en navegador y pronto en iOS/Android. <br />
                        Tu soberanía financiera comienza hoy.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
                        <DownloadButton
                            icon={<Download className="w-6 h-6" />}
                            text="App de Windows"
                            subtext="Descargar .exe (64-bit)"
                            onClick={() => window.open('/LedgerChat-Setup-1.0.0.exe', '_blank')}
                        />
                        <DownloadButton
                            icon={<Chrome className="w-6 h-6" />}
                            text="Extensión de Chrome"
                            subtext="Disponible ahora"
                        />
                        <DownloadButton
                            icon={<Apple className="w-6 h-6" />}
                            text="App iOS/Android"
                            subtext="Próximamente"
                            disabled
                        />
                    </div>

                    <div className="pt-8 opacity-50 text-sm font-mono uppercase tracking-widest">
                        Multi-Chain  Non-Custodial  Open Source
                    </div>
                </motion.div>
            </div>
        </section>
    );
}

function DownloadButton({ 
    icon, 
    text, 
    subtext, 
    disabled = false,
    onClick
}: { 
    icon: React.ReactNode; 
    text: string; 
    subtext: string; 
    disabled?: boolean;
    onClick?: () => void;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`
                group relative px-8 py-5 rounded-[2rem] font-bold text-lg
                flex items-center gap-4 transition-all duration-300
                ${disabled 
                    ? 'bg-[#1F1F1F]/20 text-[#1F1F1F]/40 cursor-not-allowed' 
                    : 'bg-[#1F1F1F] text-white hover:scale-105 hover:shadow-2xl active:scale-95'
                }
            `}
        >
            <div className={disabled ? 'opacity-40' : ''}>{icon}</div>
            <div className="text-left">
                <div className="font-black uppercase tracking-tight">{text}</div>
                <div className="text-xs opacity-70 font-normal">{subtext}</div>
            </div>
            {!disabled && (
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 opacity-0 group-hover:opacity-100 rounded-[2rem] transition-opacity -z-10" />
            )}
        </button>
    );
}


