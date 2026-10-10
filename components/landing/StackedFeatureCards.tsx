"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, Shield, Zap, Globe, Sparkles, CheckCircle, ChevronRight,
  Bell, Radar, Activity
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface FeatureCard {
  id: number;
  title: string;
  category: string;
  description: string;
  detailedInfo: string;
  benefits: string[];
  icon: React.ReactNode;
  gradient: string;
}

const ICON_MAP = [
    { icon: <Bell className="w-10 h-10" />, gradient: "from-orange-500 to-red-600" },
    { icon: <Radar className="w-10 h-10" />, gradient: "from-[#25D366] to-cyan-600" },
    { icon: <Sparkles className="w-10 h-10" />, gradient: "from-purple-500 to-indigo-600" },
    { icon: <Globe className="w-10 h-10" />, gradient: "from-green-500 to-emerald-600" },
    { icon: <TrendingUp className="w-10 h-10" />, gradient: "from-yellow-500 to-orange-600" },
    { icon: <Shield className="w-10 h-10" />, gradient: "from-indigo-500 to-violet-600" },
];

export function StackedFeatureCards() {
  const { t } = useLanguage();
  
  const getFeatureCards = () => t.landing.features.items.map((item: any, idx: number) => ({
      id: idx + 1,
      ...item,
      icon: ICON_MAP[idx]?.icon || <Activity className="w-10 h-10" />,
      gradient: ICON_MAP[idx]?.gradient || "from-[#25D366] to-purple-600"
  }));

  const initialCards = getFeatureCards();
  const [cards, setCards] = useState(initialCards);
  const [activeCard, setActiveCard] = useState(initialCards[initialCards.length - 1]);

  useEffect(() => {
    const updated = getFeatureCards();
    setCards(updated);
    setActiveCard(updated[updated.length - 1]);
  }, [t.landing.features.items.length, t.landing.features.title]);

  const moveToEnd = (fromIndex: number) => {
    setCards((currentCards: FeatureCard[]) => {
      const newCards = [...currentCards];
      const [movedCard] = newCards.splice(fromIndex, 1);
      newCards.unshift(movedCard);
      setActiveCard(newCards[newCards.length - 1]);
      return newCards;
    });
  };

  return (
    <div className="relative w-full py-24 flex items-center justify-center overflow-visible bg-black">
      <div className="w-full max-w-[2560px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start text-left">
        
        {/* LEFT SIDE - Stacked Feature Cards */}
        <div className="relative w-full max-w-[420px] h-[550px] mx-auto lg:mx-0 lg:sticky lg:top-24">
          {cards.map((card: FeatureCard, index: number) => {
            const isTop = index === cards.length - 1;
            const offset = cards.length - 1 - index;
            
            return (
              <Card 
                key={card.id} 
                data={card} 
                index={index} 
                isTop={isTop}
                offset={offset}
                onSwipe={() => moveToEnd(index)}
              />
            );
          })}
        </div>

        {/* RIGHT SIDE - Detail Panel */}
        <div className="relative w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCard.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="bg-[#F5F1E8]/95 backdrop-blur-md rounded-3xl p-8 md:p-12 border-2 border-[#D4C5A0] shadow-2xl"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#E5D5B0] border border-[#C4B590] mb-6">
                <span className="text-xs font-black text-[#4A3F2E] uppercase tracking-widest">
                    {activeCard.category}
                </span>
              </div>

              <h2 className="text-4xl md:text-5xl font-black text-[#2C2416] mb-6 leading-tight">
                {activeCard.title}
              </h2>

              <p className="text-[#4A3F2E] text-lg leading-relaxed mb-8 font-medium">
                {activeCard.detailedInfo}
              </p>

              <div className="space-y-4">
                <h3 className="text-sm font-black text-[#7A6F5E] uppercase tracking-widest mb-4">
                  {t.landing.features.cta}
                </h3>
                {activeCard.benefits.map((benefit: string, idx: number) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + idx * 0.05 }}
                    className="flex items-start gap-3"
                  >
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-[#4A3F2E] font-medium">{benefit}</span>
                  </motion.div>
                ))}
              </div>

              <div className={`mt-8 h-1.5 w-full rounded-full bg-gradient-to-r ${activeCard.gradient}`} />
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-center gap-2 mt-6 text-[#7A6F5E] text-sm font-mono">
            <span>{t.landing.features.hint}</span>
            <ChevronRight className="w-4 h-4 animate-pulse" />
          </div>
        </div>

      </div>
    </div>
  );
}

function Card({ data, index, isTop, offset, onSwipe }: { 
    data: FeatureCard; 
    index: number; 
    isTop: boolean; 
    offset: number;
    onSwipe: () => void;
}) {
    const { t } = useLanguage();
    const scale = 1 - offset * 0.04;
    const yOffset = offset * -20; 
    const zIndex = 100 - offset;
    const brightness = 1 - offset * 0.15;

    return (
        <motion.div
            style={{ 
                zIndex,
                scale,
                y: yOffset,
                filter: `brightness(${brightness})`
            }}
            drag={isTop ? "x" : false}
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            dragElastic={0.6}
            onDragEnd={(_idx, info) => {
                if (Math.abs(info.offset.x) > 100) {
                    onSwipe();
                }
            }}
            onClick={isTop ? onSwipe : undefined}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale, opacity: 1, y: yOffset }}
            exit={{ x: 200, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className={`
                absolute top-0 left-0 w-full h-full 
                bg-[#F5F1E8] rounded-3xl p-8
                flex flex-col justify-between border-2 border-[#D4C5A0]
                shadow-[0_20px_50px_rgba(0,0,0,0.5)]
                ${isTop ? 'cursor-pointer hover:border-[#C4B590]' : 'cursor-default'}
            `}
        >
            <div className="relative z-10">
                <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${data.gradient} mb-6 shadow-lg`}>
                    <div className="text-white">
                        {data.icon}
                    </div>
                </div>
                <h3 className="text-3xl md:text-4xl font-black text-[#2C2416] mb-4 leading-tight">
                    {data.title}
                </h3>
                <p className="text-[#4A3F2E] text-lg leading-relaxed font-medium">
                    {data.description}
                </p>
            </div>

            <div className="relative h-32 rounded-2xl overflow-hidden bg-gradient-to-br from-[#E5D5B0] to-[#D4C5A0] border-2 border-[#C4B590]">
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
                <div className={`absolute inset-0 bg-gradient-to-br ${data.gradient} opacity-30`} />
                <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="w-16 h-16 text-[#4A3F2E] opacity-20" />
                </div>
            </div>

            <div className="flex justify-between items-center text-xs text-[#7A6F5E] font-mono uppercase tracking-widest pt-4">
                <span>{t.landing.features.feat} {String(data.id).padStart(2, '0')}</span>
                <span>{isTop ? t.landing.features.tap : t.landing.features.que}</span>
            </div>
        </motion.div>
    );
}


