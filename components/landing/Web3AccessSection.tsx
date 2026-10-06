"use client";

import React, { useState } from 'react';
import { Mail, BookOpen, Check, Loader2 } from 'lucide-react';
import { useAppKit } from '@reown/appkit/react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export function Web3AccessSection() {
    const { open } = useAppKit();
    const router = useRouter();
    const { t } = useLanguage();

    return (
        <div className="w-full max-w-[2560px] mx-auto px-4 py-24 flex flex-col gap-16 text-left">
            
            {/* 1. New to Web3? Card (Blue Style) */}
            <div className="w-full bg-[#Dbf1ff] rounded-3xl p-10 md:p-14 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-10 shadow-lg group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                
                <div className="flex-1 text-center md:text-left z-10">
                    <h2 className="text-5xl md:text-7xl font-black text-[#031d47] mb-6 leading-[0.9] tracking-tighter uppercase font-heading">
                        {t('web3.new_title')}
                    </h2>
                    <p className="text-[#031d47]/80 text-lg md:text-xl font-medium max-w-xl leading-relaxed mb-8">
                        {t('web3.new_desc')}
                    </p>
                    <button 
                        onClick={() => router.push('/wallet')}
                        className="bg-[#030b36] text-white px-8 py-4 rounded-full font-black text-lg hover:bg-blue-900 transition-all active:scale-95 shadow-xl hover:shadow-2xl uppercase tracking-widest"
                    >
                        {t('web3.new_cta')}
                    </button>
                </div>

                <div className="w-full md:w-1/3 h-64 md:h-full relative flex items-center justify-center">
                     <div className="w-40 h-40 md:w-56 md:h-56 bg-gradient-to-br from-[#25D366] to-indigo-700 rounded-3xl transform rotate-12 rotate-y-12 shadow-[0_20px_50px_rgba(0,0,255,0.3)] animate-float" />
                </div>
            </div>

            {/* 2. Subscription Card */}
            <SubscribeCard />

        </div>
    );
}

function SubscribeCard() {
    const { t } = useLanguage();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [subscribed, setSubscribed] = useState(false);
    const [preferences, setPreferences] = useState({ general: true, developer: false });

    const togglePref = (key: keyof typeof preferences) => {
        setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSubscribe = async () => {
        if (!email || !email.includes('@')) return toast.error(t('sub.error_email'));
        
        setLoading(true);
        try {
            const res = await fetch('/api/newsletter/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, preferences })
            });
            const data = await res.json();
            
            if (res.ok) {
                toast.success(t('sub.success_toast'));
                setSubscribed(true);
                setEmail('');
            } else {
                toast.error(data.error || t('sub.error_generic'));
            }
        } catch (e) {
            toast.error(t('sub.error_generic'));
        } finally {
            setLoading(false);
        }
    };

    if (subscribed) {
        return (
            <div className="w-full bg-[#E5B8FB] rounded-3xl p-12 text-center text-[#4A1D6E]">
                <h3 className="text-3xl font-black mb-4 uppercase tracking-tighter">{t('sub.success_title')}</h3>
                <p className="font-bold text-lg">{t('sub.success_desc')}</p>
            </div>
        );
    }

    return (
        <div className="w-full bg-[#E5B8FB] rounded-3xl overflow-hidden relative shadow-lg">
            <div className="absolute top-0 right-0 w-1/2 h-full bg-[#d69bf5] transform skew-x-12 translate-x-20 z-0" />
            
            <div className="relative z-10 p-8 md:p-14 max-w-4xl mx-auto">
                <h3 className="text-2xl md:text-4xl font-black text-[#24083a] mb-8 text-center uppercase tracking-tighter">
                    {t('sub.title')}
                </h3>

                <div className="flex flex-col md:flex-row gap-6 mb-8 justify-center">
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <div 
                            className={`w-6 h-6 border-2 border-[#4A1D6E] rounded flex items-center justify-center transition-colors ${preferences.general ? 'bg-[#4A1D6E]' : 'bg-transparent'}`}
                            onClick={() => togglePref('general')}
                        >
                            {preferences.general && <Check size={16} className="text-white" />}
                        </div>
                        <span className="text-[#24083a] font-black text-lg select-none group-hover:opacity-80 uppercase tracking-tight">{t('sub.pref_general')}</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer group">
                        <div 
                            className={`w-6 h-6 border-2 border-[#4A1D6E] rounded flex items-center justify-center transition-colors ${preferences.developer ? 'bg-[#4A1D6E]' : 'bg-transparent'}`}
                            onClick={() => togglePref('developer')}
                        >
                            {preferences.developer && <Check size={16} className="text-white" />}
                        </div>
                        <span className="text-[#24083a] font-black text-lg select-none group-hover:opacity-80 uppercase tracking-tight">{t('sub.pref_dev')}</span>
                    </label>
                </div>

                <div className="bg-white rounded-full p-2 flex items-center shadow-inner mb-8 border-2 border-[#4A1D6E]/10 focus-within:border-[#4A1D6E]/30 transition-all">
                    <input 
                        type="email" 
                        placeholder={t('sub.placeholder')}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="flex-1 bg-transparent px-6 py-3 text-[#24083a] outline-none placeholder:text-[#24083a]/30 font-bold text-lg"
                    />
                </div>

                <div className="flex flex-col md:flex-row items-end gap-8">
                    <button 
                        onClick={handleSubscribe}
                        disabled={loading}
                        className="bg-[#24083a] text-white px-10 py-5 rounded-full font-black text-lg hover:bg-[#3bf] hover:text-[#24083a] transition-all shadow-xl hover:shadow-2xl disabled:opacity-50 whitespace-nowrap order-2 md:order-1 uppercase tracking-widest"
                    >
                        {loading ? t('sub.cta_loading') : t('sub.cta')}
                    </button>

                     <p className="text-xs text-[#24083a]/70 leading-relaxed md:max-w-xl order-1 md:order-2 font-medium">
                        {t('sub.disclaimer')}
                    </p>
                </div>
            </div>
        </div>
    );
}


