"use client";

import React, { useEffect, useState } from "react";
import { Twitter, ExternalLink, RefreshCw } from "lucide-react";
import { useT } from '@/lib/i18n/client';

interface HumanityLedgerTweetFeedProps {
  height?: number;
  showHeader?: boolean;
  theme?: "dark" | "light";
}

export function HumanityLedgerTweetFeed({
  height = 500,
  showHeader = true,
  theme = "dark",
}: HumanityLedgerTweetFeedProps) {
  const t = useT();
  const isDark = theme === "dark";
  const bgClass = isDark ? "bg-black" : "bg-white";
  const borderClass = isDark ? "border-white/10" : "border-black/10";
  const [key, setKey] = useState(0);

  useEffect(() => {
    // Load Twitter widgets script if not already loaded
    if (!(window as any).twttr) {
      const script = document.createElement("script");
      script.src = "https://platform.twitter.com/widgets.js";
      script.async = true;
      script.charset = "utf-8";
      document.body.appendChild(script);
    } else if ((window as any).twttr.widgets) {
      // If already loaded, force re-parsing
      (window as any).twttr.widgets.load();
    }
  }, [key, theme]);

  const refreshFeed = () => {
    setKey((prev) => prev + 1);
  };

  return (
    <div className="flex flex-col w-full h-full font-sans">
      {/*  Header  */}
      {showHeader && (
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#1d9bf0]/20 border border-[#1d9bf0]/30 flex items-center justify-center">
              <Twitter size={14} className="text-[#1d9bf0]" />
            </div>
            <div className="flex flex-col">
              <span className={`text-[11px] font-black uppercase tracking-widest ${isDark ? 'text-white/80' : 'text-black/80'}`}>
                {t("@humanityledger")}
              </span>
              {/* "Active Feed" text has been explicitly removed as requested */}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refreshFeed}
              className={`p-1.5 rounded-lg border transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10 border-white/10 text-white/40' : 'bg-black/5 hover:bg-black/10 border-black/10 text-black/40'}`}
              title={t("Refresh Feed")}
            >
              <RefreshCw size={11} className="currentColor" />
            </button>
            <a
              href="https://twitter.com/humanityledger"
              target="_blank"
              rel="noopener noreferrer"
              className={`p-1.5 rounded-lg border transition-all ${isDark ? 'bg-white/5 hover:bg-[#1d9bf0]/20 border-white/10 hover:border-[#1d9bf0]/30 text-white/40' : 'bg-black/5 hover:bg-[#1d9bf0]/10 border-black/10 hover:border-[#1d9bf0]/30 text-black/40'}`}
              title={t("Open @humanityledger on X")}
            >
              <ExternalLink size={11} className="hover:text-[#1d9bf0] currentColor" />
            </a>
          </div>
        </div>
      )}

      {/*  Widget Container  */}
      <div
        className={`relative flex-1 rounded-xl overflow-hidden border ${bgClass} ${borderClass} flex flex-col`}
        style={{ height }}
      >
        <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth p-0">
           <a 
              key={key}
              className="twitter-timeline" 
              data-theme={theme}
              data-chrome="noheader nofooter noborders transparent"
              href="https://twitter.com/humanityledger?ref_src=twsrc%5Etfw">
           </a>
        </div>
      </div>
    </div>
  );
}
