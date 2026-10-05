"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Chrome, Apple, Mail, Check, Twitter, Github, MessageCircle, Send } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { toast } from 'sonner';

export function EnterpriseFooter() {
    const { t } = useLanguage();
    const [email, setEmail] = useState('');
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleNewsletterSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !email.includes('@')) {
            toast.error('Por favor ingresa un email válido');
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch('/api/newsletter/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            if (!response.ok) throw new Error('Subscription failed');
            
            setIsSubscribed(true);
            toast.success('Thank you! Check your email to confirm.');
            setEmail('');
        } catch (error) {
            toast.error('Error subscribing. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadClick = async (platform: string) => {
        // Analytics tracking
        await fetch('/api/analytics/download-click', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform, timestamp: new Date().toISOString() })
        }).catch(() => {});

        // Redirect logic
        if (platform === 'chrome') {
            window.open('https://chrome.google.com/webstore/detail/human-wallet', '_blank');
        } else {
            toast.info('Próximamente en iOS y Android');
        }
    };

    return (
        <footer className="relative w-full py-20 overflow-hidden">
            {/* Gradient Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 opacity-95" />
            <div className="absolute inset-0 bg-[url('/patterns/grid.svg')] opacity-10" />

            <div className="relative z-10 max-w-[2560px] mx-auto px-6 text-left">
                {/* Download Section */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <h2 className="text-5xl md:text-6xl font-black text-white mb-4 tracking-tight">
                        Descarga <span className="bg-gradient-to-r from-yellow-300 to-orange-400 bg-clip-text text-transparent">Humanity Ledger Wallet</span>
                    </h2>
                    <p className="text-xl text-white/80 mb-10 max-w-2xl mx-auto font-light">
                        La wallet Web3 más segura y fácil de usar. Disponible en múltiples plataformas.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        <DownloadButton
                            icon={<Chrome className="w-6 h-6" />}
                            title="Extensión de Chrome"
                            subtitle="Disponible ahora"
                            onClick={() => handleDownloadClick('chrome')}
                            gradient="from-orange-500 to-red-500"
                        />
                        <DownloadButton
                            icon={<Apple className="w-6 h-6" />}
                            title="Mobile App — Coming Soon"
                            subtitle="Próximamente 2026"
                            onClick={() => handleDownloadClick('mobile')}
                            gradient="from-pink-500 to-purple-500"
                            disabled
                        />
                    </div>
                </motion.div>

                {/* Newsletter Section */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 }}
                    className="max-w-xl mx-auto mb-16"
                >
                    <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                                <Mail className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Newsletter</h3>
                                <p className="text-sm text-white/70">Actualizaciones y noticias exclusivas</p>
                            </div>
                        </div>

                        {!isSubscribed ? (
                            <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="tu@email.com"
                                    className="flex-1 px-4 py-3 bg-white/10 border border-white/30 rounded-xl text-white placeholder:text-white/50 outline-none focus:bg-white/20 transition-all"
                                />
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="px-6 py-3 bg-white text-purple-600 rounded-xl font-bold hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isLoading ? 'Enviando...' : 'Suscribir'}
                                    <Send className="w-4 h-4" />
                                </button>
                            </form>
                        ) : (
                            <div className="flex items-center gap-3 bg-green-500/20 border border-green-400/30 rounded-xl px-4 py-3">
                                <Check className="w-5 h-5 text-green-300" />
                                <span className="text-green-100 font-medium">Subscription successful! Check your email.</span>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Links Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
                    <FooterColumn
                        title="Producto"
                        links={[
                            { label: 'Wallet', href: '/wallet' },
                            { label: 'Ledger Card', href: '/tarjeta-human' },
                            { label: 'VIP Access', href: '/vip' },
                            { label: 'Developer API', href: '/developer' }
                        ]}
                    />
                    <FooterColumn
                        title="Empresa"
                        links={[
                            { label: 'Blog', href: '/blog' },
                            { label: 'Prensa', href: '/press' }
                        ]}
                    />
                    <FooterColumn
                        title="Recursos"
                        links={[

                            { label: 'Support', href: '/support' },
                            { label: 'FAQ', href: '/#faq' },
                            { label: 'Media Kit', href: '/media-kit' }
                        ]}
                    />
                    <FooterColumn
                        title="Legal"
                        links={[
                            { label: 'Privacidad', href: '/privacy' },
                            { label: 'Términos', href: '/terms' },
                            { label: 'Cookies', href: '/cookies' },
                            { label: 'Licencias', href: '/licenses' }
                        ]}
                    />
                </div>

                {/* Social Links */}
                <div className="flex justify-center gap-4 mb-12">
                    <SocialButton icon={<Twitter />} href="https://x.com/humanityledger" label="Twitter / X @humanityledger" />
                    <SocialButton icon={<Github />} href="https://github.com/humanwallet" label="GitHub" />
                    <SocialButton icon={<MessageCircle />} href="https://discord.gg/humanwallet" label="Discord" />
                    <SocialButton icon={<Send />} href="https://t.me/humanwallet" label="Telegram" />
                </div>

                {/* Bottom Bar */}
                <div className="border-t border-white/20 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="text-white/70 text-sm font-mono">
                        © 2026 Humanity Ledger. All rights reserved.
                    </div>
                    <div className="flex items-center gap-6 text-sm text-white/70">
                        <span>v4.0.0</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}

function DownloadButton({ 
    icon, 
    title, 
    subtitle, 
    onClick, 
    gradient, 
    disabled = false 
}: { 
    icon: React.ReactNode; 
    title: string; 
    subtitle: string; 
    onClick: () => void;
    gradient: string;
    disabled?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`
                group relative px-8 py-5 rounded-2xl font-bold text-lg
                flex items-center gap-4 transition-all duration-300
                ${disabled 
                    ? 'bg-white/10 text-white/40 cursor-not-allowed' 
                    : `bg-gradient-to-r ${gradient} text-white hover:scale-105 hover:shadow-2xl active:scale-95`
                }
            `}
        >
            <div className={disabled ? 'opacity-40' : ''}>{icon}</div>
            <div className="text-left">
                <div className="font-black tracking-tight">{title}</div>
                <div className="text-xs opacity-80 font-normal">{subtitle}</div>
            </div>
            {!disabled && (
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 rounded-2xl transition-opacity" />
            )}
        </button>
    );
}

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
    return (
        <div>
            <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">{title}</h4>
            <ul className="space-y-2">
                {links.map((link) => (
                    <li key={link.href}>
                        <a
                            href={link.href}
                            className="text-white/70 hover:text-white transition-colors text-sm font-medium"
                        >
                            {link.label}
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function SocialButton({ icon, href, label }: { icon: React.ReactNode; href: string; label: string }) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            className="w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-full flex items-center justify-center text-white transition-all hover:scale-110 active:scale-95"
        >
            {icon}
        </a>
    );
}


