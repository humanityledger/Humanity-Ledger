"use client";
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Link2, FileText, Image as ImageIcon, ExternalLink, ChevronRight } from 'lucide-react';

// ─── Link Preview Types ──────────────────────────────────────────────────────
export interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
}

// ─── Link Preview Card ───────────────────────────────────────────────────────
interface LinkPreviewCardProps {
  preview: LinkPreviewData;
  compact?: boolean;
  onDismiss?: () => void;
}

export function LinkPreviewCard({ preview, compact = false, onDismiss }: LinkPreviewCardProps) {
  const [imageError, setImageError] = useState(false);

  const domain = (() => {
    try {
      return new URL(preview.url).hostname.replace('www.', '');
    } catch {
      return preview.url;
    }
  })();

  if (compact) {
    // Used inside message bubbles
    return (
      <a
        href={preview.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block mt-2 border border-[#e6e8ec] rounded-xl overflow-hidden hover:border-[#d4d8df] transition-colors bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {preview.image && !imageError && (
          <div className="relative w-full h-32 bg-[#f2f4f7]">
            <img
              src={preview.image}
              alt={preview.title || 'Link preview'}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          </div>
        )}
        <div className="p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            {preview.favicon && (
              <img src={preview.favicon} alt="" className="w-3 h-3 rounded-full" />
            )}
            <span className="text-[12px] text-[#727a88]">{domain}</span>
          </div>
          {preview.title && (
            <p className="text-[14px] font-medium text-[#15171c] leading-snug line-clamp-2">{preview.title}</p>
          )}
          {preview.description && (
            <p className="text-[13px] text-[#727a88] mt-0.5 leading-snug line-clamp-2">{preview.description}</p>
          )}
        </div>
      </a>
    );
  }

  // Full card in compose input area
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="mx-3 mb-2 border border-[#e6e8ec] rounded-2xl overflow-hidden bg-white flex"
    >
      {preview.image && !imageError && (
        <div className="w-20 h-20 shrink-0 bg-black/5">
          <img
            src={preview.image}
            alt={preview.title || ''}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        </div>
      )}
      <div className="flex-1 p-3 min-w-0">
        <div className="flex items-center gap-1 mb-1">
          {preview.favicon && (
            <img src={preview.favicon} alt="" className="w-3 h-3 rounded-sm" />
          )}
          <span className="text-[12px] text-[#727a88] truncate">{domain}</span>
        </div>
        {preview.title && (
          <p className="text-[14px] font-medium text-[#15171c] leading-snug line-clamp-1">{preview.title}</p>
        )}
        {preview.description && (
          <p className="text-[13px] text-[#727a88] leading-snug line-clamp-2 mt-0.5">{preview.description}</p>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 w-10 flex items-center justify-center hover:bg-black/5 transition-colors"
        >
          <X size={14} className="text-black/30" />
        </button>
      )}
    </motion.div>
  );
}

// ─── Link Detector (finds first URL in text) ─────────────────────────────────
export function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : null;
}

// ─── Local Preview Cache (avoid refetching same URL) ─────────────────────────
const previewCache = new Map<string, LinkPreviewData | null>();
const MAX_CACHE_SIZE = 50;

export function useLinkPreview(url: string | null): {
  preview: LinkPreviewData | null;
  loading: boolean;
} {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!url) {
      setPreview(null);
      setLoading(false);
      return;
    }

    if (previewCache.has(url)) {
      setPreview(previewCache.get(url) ?? null);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);

    (async () => {
      try {
        const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`, {
          signal: ctrl.signal,
          cache: 'force-cache',
        });
        if (!res.ok) throw new Error('bad response');
        const data: LinkPreviewData = await res.json();
        
        // LRU Eviction Policy
        if (previewCache.size >= MAX_CACHE_SIZE) {
          const firstKey = previewCache.keys().next().value;
          if (firstKey) previewCache.delete(firstKey);
        }
        
        previewCache.set(url, data);
        setPreview(data);
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          if (previewCache.size >= MAX_CACHE_SIZE) {
            const firstKey = previewCache.keys().next().value;
            if (firstKey) previewCache.delete(firstKey);
          }
          previewCache.set(url, null); // cache negative to avoid re-fetching
          setPreview(null);
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [url]);

  return { preview, loading };
}
