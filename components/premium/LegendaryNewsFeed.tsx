"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Newspaper, ShieldCheck, ShieldAlert, TrendingUp, TrendingDown, Minus, ExternalLink, RefreshCw, Sparkles, BrainCircuit } from 'lucide-react';
import PremiumLocked from './PremiumLocked';

interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string;
  imageUrl?: string;
  category?: string;
  veracityScore?: number;
  veracityAnalysis?: string;
  isFake?: boolean;
  sentiment?: 'bullish' | 'bearish' | 'neutral';
}

interface LegendaryNewsFeedProps {
  isPremium: boolean;
  walletAddress?: string;
}

export default function LegendaryNewsFeed({ isPremium, walletAddress }: LegendaryNewsFeedProps) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/news');
      const data = await response.json();
      setArticles(data.news || []);
    } catch (error) {
      console.error('Failed to fetch news:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const res = await fetch('/api/news/sync');
      if (res.ok) {
        await fetchNews();
      } else {
        console.error('Sync API call failed with status:', res.status);
      }
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  // Auto-sync logic: Trigger sync if articles are empty after initial load
  useEffect(() => {
    if (!loading && articles.length === 0) {
      console.log("No articles found after initial fetch, triggering auto-sync...");
      handleSync();
    }
  }, [loading, articles.length]); // Depend on loading and articles.length to trigger after fetchNews completes


  return (
    <div className="space-y-8 relative">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-4xl font-black text-white flex items-center gap-4"
          >
            <div className="p-2 bg-[#25D366]/20 rounded-lg">
                <BrainCircuit className="text-blue-400 w-8 h-8" />
            </div>
            Humanity Ledger <span className="text-[#25D366]">OPERATIONS</span>
          </motion.h1>
          <p className="text-gray-400 mt-2 font-medium max-w-2xl">
            Accurate predictions in markets
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={syncing || !isPremium}
            className="group px-6 py-3 bg-blue-600 hover:bg-[#25D366] text-white rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-900/20 disabled:opacity-50"
          >
            <RefreshCw size={18} className={syncing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'} />
            {syncing ? 'PROCESSING...' : 'UPDATE NODES'}
          </button>
        </div>
      </div>

      {!isPremium && (
        <div className="absolute inset-0 z-30 pt-20">
          <PremiumLocked
            feature="Humanity Ledger NETWORK INTELLIGENCE"
            description="Access Elite-grade market data verified by decentralised oracles. Detect arbitrage opportunities and value bets."
            icon="sparkles"
            onUpgrade={() => console.log("Upgrade requested")}
          />
        </div>
      )}

      {/* NEWS GRID */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-50">
           {[1,2,3,4,5,6].map(i => (
             <div key={i} className="h-[450px] bg-white/5 rounded-3xl border border-white/10" />
           ))}
        </div>
      ) : (
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${!isPremium ? 'blur-md pointer-events-none' : ''}`}>
          <AnimatePresence>
            {articles.map((article, index) => (
              <LegendaryNewsCard key={article.id} article={article} index={index} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {articles.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
          <Newspaper size={48} className="text-white/20 mb-4" />
          <p className="text-xl font-bold text-white/40">No recent market data. Synchronize data nodes.</p>
        </div>
      )}
    </div>
  );
}

function LegendaryNewsCard({ article, index }: { article: NewsArticle; index: number }) {
  const veracityColor = article.isFake ? 'text-indigo-500' : 'text-blue-400';
  // If verifying or 0 score, show gray
  const score = article.veracityScore || 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -5 }}
      className="group relative flex flex-col bg-[#0a0a0a] rounded-[2rem] border border-white/5 overflow-hidden hover:border-[#25D366]/30 transition-all duration-500 shadow-2xl"
    >
      {/* 1. IMMERSIVE IMAGE */}
      <div className="relative h-64 w-full overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent z-10" />
        <img 
          src={article.imageUrl ? `/api/proxy-image?url=${encodeURIComponent(article.imageUrl)}` : `/api/proxy-image?seed=${index}`}
          alt={article.title}
          onError={(e) => {
            e.currentTarget.src = "/logo-mark.png";
          }}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 grayscale-[0.3] group-hover:grayscale-0"
        />
        
        {/* Source Badge (Top Left) */}
        <div className="absolute top-4 left-4 z-20 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 flex items-center gap-2">
            {article.isFake ? <ShieldAlert size={14} className="text-indigo-500" /> : <ShieldCheck size={14} className="text-blue-400" />}
            <span className="text-[10px] font-black uppercase tracking-widest text-white/90">
                {article.source}
            </span>
        </div>

        {/* Sentiment (Top Right) */}
        <div className="absolute top-4 right-4 z-20 p-2 bg-black/60 backdrop-blur-md rounded-lg border border-white/10">
            {article.sentiment === 'bullish' && <TrendingUp size={16} className="text-emerald-400" />}
            {article.sentiment === 'bearish' && <TrendingDown size={16} className="text-red-400" />}
            {article.sentiment === 'neutral' && <Minus size={16} className="text-gray-400" />}
        </div>
      </div>

      {/* 2. CONTENT CORE */}
      <div className="p-6 flex flex-col flex-grow -mt-6 relative z-20">
        
        {/* Headline */}
        <h3 className="text-xl font-black text-white leading-tight mb-4 group-hover:text-blue-400 transition-colors">
          {article.title}
        </h3>

        {/* 3. SENIOR ANALYSIS BLOCK */}
        <div className="flex-grow">
            <div className="pl-4 border-l-2 border-[#25D366]/30 py-1 mb-4">
                <p className="text-sm text-gray-400 font-medium leading-relaxed">
                    {article.veracityAnalysis || article.summary}
                </p>
            </div>
        </div>

        {/* 4. FOOTER METRICS */}
        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Veracity</span>
                    <span className={`text-lg font-black ${veracityColor}`}>{score}%</span>
                </div>
                {/* Mini Bar */}
                <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden mt-1">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${score}%` }}
                        className={`h-full ${article.isFake ? 'bg-indigo-500' : 'bg-[#25D366]'}`}
                    />
                </div>
            </div>

            <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-2 py-1 bg-white/5 rounded">
                    {article.category}
                </span>
                <a 
                    href={article.url}
                    target="_blank"
                    className="p-2 bg-white/5 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-all"
                >
                    <ExternalLink size={16} />
                </a>
            </div>
        </div>

      </div>
    </motion.div>
  );
}


