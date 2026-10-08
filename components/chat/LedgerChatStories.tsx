"use client";
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Eye, MoreVertical, Heart, Share, Shield } from 'lucide-react';
import { useNetworkStatus } from '@/components/chat/LedgerChatNetworkBadge';

export interface StoryMedia {
  id: string;
  type: 'image' | 'video' | 'text';
  url?: string;
  text?: string;
  backgroundColor?: string;
  timestamp: number;
  duration?: number;
  viewers?: number;
}

export interface PeerStories {
  peerAddress: string;
  displayName: string;
  avatarColor: string;
  avatarInitials: string;
  items: StoryMedia[];
  hasUnread: boolean;
}

interface LedgerChatStoriesProps {
  stories: PeerStories[];
  initialPeerIndex?: number;
  onClose: () => void;
  myAddress?: string;
}

export function LedgerChatStories({ stories, initialPeerIndex = 0, onClose, myAddress }: LedgerChatStoriesProps) {
  const [peerIndex, setPeerIndex] = useState(initialPeerIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [networkQuality] = useState(useNetworkStatus().quality);

  const activePeer = stories[peerIndex];
  const activeStory = activePeer?.items[storyIndex];
  const totalStoriesForPeer = activePeer?.items.length || 0;

  const duration = activeStory?.duration || (activeStory?.type === 'video' ? 15000 : 5000);
  
  const timerRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);
  const progressRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // ─── Playback Controller ───────────────────────────────────────────────────
  useEffect(() => {
    if (!activeStory || isPaused) {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
      if (videoRef.current && !videoRef.current.paused) videoRef.current.pause();
      return;
    }

    if (activeStory.type === 'video' && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }

    lastUpdateRef.current = performance.now();
    
    const tick = (now: number) => {
      if (isPaused) return;
      
      const delta = now - lastUpdateRef.current;
      lastUpdateRef.current = now;
      
      progressRef.current += (delta / duration) * 100;
      
      if (progressRef.current >= 100) {
        handleNext();
      } else {
        setProgress(progressRef.current);
        timerRef.current = requestAnimationFrame(tick);
      }
    };
    
    timerRef.current = requestAnimationFrame(tick);
    
    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
    };
  }, [peerIndex, storyIndex, isPaused, activeStory, duration]);

  const resetProgress = () => {
    setProgress(0);
    progressRef.current = 0;
  };

  const handleNext = () => {
    if (storyIndex < totalStoriesForPeer - 1) {
      setStoryIndex(s => s + 1);
      resetProgress();
    } else if (peerIndex < stories.length - 1) {
      setPeerIndex(p => p + 1);
      setStoryIndex(0);
      resetProgress();
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (storyIndex > 0) {
      setStoryIndex(s => s - 1);
      resetProgress();
    } else if (peerIndex > 0) {
      setPeerIndex(p => p - 1);
      setStoryIndex(stories[peerIndex - 1].items.length - 1);
      resetProgress();
    }
  };

  // ─── Input Handling ────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'Escape') onClose();
      if (e.key === ' ') setIsPaused(p => !p);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [peerIndex, storyIndex, stories, totalStoriesForPeer, onClose]);

  if (!activePeer || !activeStory) return null;

  const isMe = activePeer.peerAddress === myAddress;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.05 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed inset-0 z-[100000] bg-black overflow-hidden select-none touch-none flex items-center justify-center"
      >
        <div className="relative w-full max-w-md h-[100dvh] sm:h-[90vh] sm:rounded-[36px] overflow-hidden bg-[#1c1c1e] shadow-2xl flex flex-col">
          
          {/* Progress Bars */}
          <div className="absolute top-0 left-0 right-0 z-50 flex gap-1.5 p-4 pt-12 sm:pt-6 bg-gradient-to-b from-black/60 to-transparent">
            {activePeer.items.map((_, i) => (
              <div key={i} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden backdrop-blur-sm">
                <div
                  className="h-full bg-white transition-all ease-linear"
                  style={{
                    width: i === storyIndex ? `${progress}%` : i < storyIndex ? '100%' : '0%'
                  }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-14 sm:top-8 left-0 right-0 z-50 flex items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-black text-white shadow-sm border border-white/20"
                style={{ background: activePeer.avatarColor }}
              >
                {activePeer.avatarInitials}
              </div>
              <div className="flex flex-col drop-shadow-md">
                <span className="text-[14px] font-black text-white leading-tight">
                  {isMe ? 'My Status' : activePeer.displayName}
                </span>
                <span className="text-[11px] font-bold text-white/70">
                  {new Date(activeStory.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-4 drop-shadow-md">
              <button className="text-white hover:text-white/70 transition-colors">
                <MoreVertical size={22} />
              </button>
              <button onClick={onClose} className="text-white hover:text-white/70 transition-colors">
                <X size={26} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div 
            className="flex-1 relative flex items-center justify-center overflow-hidden"
            onPointerDown={() => setIsPaused(true)}
            onPointerUp={() => setIsPaused(false)}
            onPointerLeave={() => setIsPaused(false)}
            onContextMenu={e => e.preventDefault()}
            style={{ backgroundColor: activeStory.type === 'text' ? activeStory.backgroundColor || '#25D366' : '#000' }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={`${peerIndex}-${storyIndex}`}
                initial={{ opacity: 0, filter: 'blur(10px)' }}
                animate={{ opacity: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                {activeStory.type === 'image' && activeStory.url && (
                  <img 
                    src={activeStory.url} 
                    alt="Status" 
                    className="w-full h-full object-contain"
                    draggable={false}
                  />
                )}

                {activeStory.type === 'video' && activeStory.url && (
                  <video 
                    ref={videoRef}
                    src={activeStory.url} 
                    className={`w-full h-full object-contain ${networkQuality === 'poor' ? 'blur-sm' : ''}`}
                    playsInline
                    muted
                    loop={false}
                  />
                )}

                {activeStory.type === 'text' && (
                  <p className="text-white text-3xl font-black text-center p-8 leading-tight drop-shadow-xl whitespace-pre-wrap">
                    {activeStory.text}
                  </p>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Tap Zones */}
            <div className="absolute inset-y-0 left-0 w-1/3 z-40 cursor-pointer" onClick={(e) => { e.stopPropagation(); handlePrev(); }} />
            <div className="absolute inset-y-0 right-0 w-1/3 z-40 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleNext(); }} />
          </div>

          {/* Footer controls (Reply / Views) */}
          <div className="absolute bottom-0 left-0 right-0 z-50 p-6 bg-gradient-to-t from-black/80 to-transparent">
            {isMe ? (
              <div className="flex flex-col items-center justify-center animate-bounce-slow">
                <Eye size={24} className="text-white drop-shadow-md mb-1" />
                <span className="text-white font-black text-[14px] drop-shadow-md">
                  {activeStory.viewers || 0}
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-center mb-2">
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
                    <Shield size={12} className="text-[#30d158]" />
                    <span className="text-[10px] font-mono font-bold text-white uppercase tracking-widest">End-to-End Encrypted</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-12 bg-black/40 backdrop-blur-md border border-white/20 rounded-full flex items-center px-4">
                    <span className="text-white/60 text-[15px] font-medium">Reply to {activePeer.displayName.split(' ')[0]}...</span>
                  </div>
                  <button className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
                    <Heart size={22} className="active:scale-125 transition-transform" />
                  </button>
                  <button className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
                    <Share size={20} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
