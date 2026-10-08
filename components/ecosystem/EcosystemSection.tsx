'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { ScrollLottie } from '@/components/ui/ScrollLottie';
import { ecosystemFeatures, type FeatureContent } from '@/lib/ecosystem-content';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface ExpandableFeatureProps {
  feature: FeatureContent;
}

function ExpandableFeature({ feature }: ExpandableFeatureProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();
  const { title, subtitle, shortDesc, deepDive, humanEdge } = feature;
  const ctaText = feature.cta?.text;

  // Auto-scroll to content when expanded
  useEffect(() => {
    if (isExpanded && contentRef.current) {
      setTimeout(() => {
        contentRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start'
        });
      }, 100);
    }
  }, [isExpanded]);

  return (
    <div className="bg-zinc-900/80 border border-white/10 rounded-3xl overflow-hidden transition-all duration-500 hover:border-white/20">
      {/* Clickable Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-8 text-left hover:bg-white/5 transition-all group"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-2xl font-black text-white mb-2 group-hover:text-emerald-400 transition-colors uppercase tracking-widest">
              {title}
            </h3>
            <p className="text-[#25D366]/60 text-xs font-mono uppercase tracking-[0.2em] mb-3">
              {subtitle}
            </p>
            <p className="text-zinc-300 font-medium text-lg leading-tight">
              {shortDesc}
            </p>
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.3 }}
            className="flex-shrink-0"
          >
            <ChevronDown className="w-6 h-6 text-zinc-400 group-hover:text-white transition-colors" />
          </motion.div>
        </div>
      </button>

      {/* Expandable Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            ref={contentRef}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-8 pb-12 border-t border-white/10 bg-black/20">
              <div className="grid lg:grid-cols-2 gap-12 pt-8">
                {/* Left: Text Content */}
                <div className="space-y-8">
                  {/* Deep Dive */}
                  <div>
                    <h4 className="text-sm font-black text-emerald-400 mb-6 font-mono uppercase tracking-[0.3em]">
                      {t('ecosystem.deep_dive')}
                    </h4>
                    <div className="space-y-6">
                      {deepDive.map((paragraph, idx) => (
                        <p key={idx} className="text-zinc-400 leading-relaxed text-base font-medium">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </div>

                  {/* Human Edge */}
                  <div className="bg-[#25D366]/5 border border-[#25D366]/20 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden group/edge">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#25D366]/10 blur-[60px] rounded-full translate-x-10 -translate-y-10" />
                    <h4 className="text-sm font-black text-emerald-400 mb-4 font-mono uppercase tracking-[0.3em] relative z-10">
                      {t('ecosystem.why_hero')}
                    </h4>
                    <p className="text-white leading-relaxed text-lg font-bold relative z-10">
                      {humanEdge}
                    </p>
                  </div>

                  {/* CTA */}
                  {feature.cta && (
                    <motion.a
                      whileHover={{ x: 5 }}
                      href={feature.cta.link}
                      className="inline-flex items-center gap-3 text-emerald-400 hover:text-emerald-300 font-black uppercase tracking-[0.2em] text-sm transition-colors border-b-2 border-emerald-400/20 pb-1"
                    >
                      {ctaText}
                      <ExternalLink className="w-4 h-4" />
                    </motion.a>
                  )}
                </div>

                {/* Right: Lottie Animation */}
                <div className="flex items-center justify-center relative">
                   <div className="absolute inset-0 bg-[#25D366]/5 blur-[100px] rounded-full animate-pulse" />
                   <div className="w-full max-w-md aspect-square relative z-10">
                    <ScrollLottie
                      src={feature.lottieSrc}
                      className="w-full h-full"
                      speed={1}
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function EcosystemSection() {
  const { t } = useLanguage();
  const [activeCategory, setActiveCategory] = useState<string>('core');

  const categories = [
    { id: 'core', label: t('ecosystem.cat_core') },
    { id: 'attesting', label: t('ecosystem.cat_attesting') },
    { id: 'productos', label: t('ecosystem.cat_products') },
    { id: 'developer', label: t('ecosystem.cat_dev') },
    { id: 'about', label: t('ecosystem.cat_about') }
  ];

  const filteredFeatures = ecosystemFeatures.filter(
    f => f.category === activeCategory
  );

  return (
    <div className="w-full max-w-[2560px] mx-auto px-4 py-32 text-left">
      {/* Header */}
      <div className="text-center mb-20">
        <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-6xl md:text-8xl font-black text-white mb-8 tracking-tighter drop-shadow-2xl uppercase"
        >
          {t('ecosystem.title')}
        </motion.h2>
        <motion.p 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-xl text-zinc-400 max-w-2xl mx-auto font-medium leading-relaxed"
        >
          {t('ecosystem.subtitle')}
        </motion.p>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap justify-center gap-4 mb-16">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`
              px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest transition-all duration-300
              ${activeCategory === cat.id
                ? 'bg-white text-black shadow-[0_0_30px_rgba(255,255,255,0.3)] scale-105'
                : 'bg-zinc-900/80 text-zinc-500 hover:bg-zinc-800 border border-white/5 shadow-inner'
              }
            `}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Features List */}
      <div className="space-y-6">
        {filteredFeatures.map((feature) => (
          <ExpandableFeature key={feature.id} feature={feature} />
        ))}
      </div>
    </div>
  );
}


