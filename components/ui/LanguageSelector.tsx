"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const languages = [
    { code: 'en', label: 'English', flag: '' },
    { code: 'es', label: 'Spanish', flag: '' },
    { code: 'ru', label: 'Русский', flag: '' },
    { code: 'de', label: 'Deutsch', flag: '' },
] as const;

export function LanguageSelector() {
    const { locale, setLocale } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 backdrop-blur-md transition-colors text-sm font-medium text-gray-200"
            >
                <Globe size={16} className="text-blue-400" />
                <span className="uppercase">{locale}</span>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="absolute right-0 mt-2 w-40 z-50 rounded-xl border border-white/10 bg-[#0D0D12]/90 backdrop-blur-xl shadow-xl overflow-hidden"
                        >
                            <div className="p-1">
                                {languages.map((lang) => (
                                    <button
                                        key={lang.code}
                                        onClick={() => {
                                            setLocale(lang.code as any);
                                            setIsOpen(false);
                                        }}
                                        className={cn(
                                            "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
                                            locale === lang.code
                                                ? "bg-[#25D366]/20 text-blue-300"
                                                : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                                        )}
                                    >
                                        <span className="flex items-center gap-2">
                                            <span>{lang.flag}</span>
                                            <span>{lang.label}</span>
                                        </span>
                                        {locale === lang.code && <Check size={14} />}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}


