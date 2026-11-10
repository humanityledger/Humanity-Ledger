"use client";

import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, ShieldCheck, Zap } from "lucide-react";
import s from "./Landing.module.css";

interface FilmChapter {
  src: string;
  title: string;
  tag: string;
  timeSec: number;
}

const CHAPTERS: FilmChapter[] = [
  {
    src: "/landing/preview.webp",
    title: "Sovereign MLS Identity",
    tag: "01 / Zero Phone Required",
    timeSec: 0,
  },
  {
    src: "/landing/preview (1).webp",
    title: "Adaptive Interface & Themes",
    tag: "02 / Classic, Midnight & AMOLED",
    timeSec: 4,
  },
  {
    src: "/landing/preview (2).webp",
    title: "End-to-End Encrypted Calling",
    tag: "03 / WebRTC DTLS-SRTP",
    timeSec: 8,
  },
  {
    src: "/landing/preview (3).webp",
    title: "Multi-Device Pairing",
    tag: "04 / QR Key Exchange",
    timeSec: 12,
  },
  {
    src: "/landing/preview (4).webp",
    title: "Shielded Freelance Invoice",
    tag: "05 / Instant Settlement",
    timeSec: 16,
  },
  {
    src: "/landing/preview (5).webp",
    title: "Aztec zk.money Execution",
    tag: "06 / Confidential L2 Rail",
    timeSec: 20,
  },
  {
    src: "/landing/preview (6).webp",
    title: "Noise-Suppressed Native Audio",
    tag: "07 / P2P Voice Network",
    timeSec: 24,
  },
  {
    src: "/landing/preview (7).webp",
    title: "Private Sovereign Communities",
    tag: "08 / Permissionless Ledger",
    timeSec: 28,
  },
];

/**
 * FilmSection – 30-Second Cinematic Protocol Showcase
 * Produced with Fable 5.2 High Profile (4K 60fps).
 */
export function FilmSection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);

  const seekToChapter = (idx: number) => {
    setActiveIdx(idx);
    const video = videoRef.current;
    if (!video) return;
    const targetTime = CHAPTERS[idx].timeSec;
    video.currentTime = targetTime;
    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const cur = video.currentTime;
      setCurrentTime(cur);

      // Determine active chapter based on timeSec
      let active = 0;
      for (let i = 0; i < CHAPTERS.length; i++) {
        if (cur >= CHAPTERS[i].timeSec) {
          active = i;
        }
      }
      setActiveIdx(active);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, []);

  const formatSec = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <section
      id="film"
      data-glow
      className={`${s.card} ${s.reveal} ${s.film}`}
      aria-labelledby="film-title"
    >
      <div className={`${s.sectionHead} ${s.filmHead}`}>
        <div className={s.filmBadgeRow}>
          <span className={s.filmPill}>
            <ShieldCheck size={14} className="text-[#10b981]" /> Aztec Alpha L2 Ready
          </span>
          <span className={s.filmPill}>
            <Zap size={14} className="text-[#f59e0b]" /> 30s Protocol Film • 4K 60FPS
          </span>
        </div>
        <h2 id="film-title" className={s.h2}>
          Everything Ledger Chat can do. <em>In 30 seconds.</em>
        </h2>
        <p className={s.lead}>
          End-to-end encrypted messaging, shielded freelance invoices, zero-knowledge settlement,
          and WebRTC peer-to-peer calling — demonstrated in one continuous take.
        </p>
      </div>

      <div className={s.filmWrap} onClick={togglePlay} role="region" aria-label="Video Player">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          className={s.filmVideo}
          src="/landing/ledgerchat-30s.mp4"
          poster="/landing/preview.webp"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-label="Ledger Chat 30-second product overview film"
        />

        {/* Dynamic Chapter Banner */}
        <div className={s.filmOverlayTop}>
          <div className={s.filmChapterBadge}>
            <span className={s.filmChapterTag}>{CHAPTERS[activeIdx].tag}</span>
            <span className={s.filmChapterTitle}>{CHAPTERS[activeIdx].title}</span>
          </div>
          <button
            type="button"
            onClick={toggleMute}
            className={s.filmMuteBtn}
            aria-label={isMuted ? "Unmute video" : "Mute video"}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>

        {/* Bottom Progress & Play Controls */}
        <div className={s.filmOverlayBottom}>
          <div className={s.filmControlsRow}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className={s.filmPlayBtn}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
            </button>
            <div className={s.filmTimelineTrack}>
              <div
                className={s.filmTimelineBar}
                style={{ width: `${Math.min(100, (currentTime / 30) * 100)}%` }}
              />
            </div>
            <span className={s.filmTimeText}>
              {formatSec(currentTime)} / 0:30
            </span>
          </div>
        </div>
      </div>

      {/* 8-Frame Chapter Navigation Gallery */}
      <div className={s.filmPosters} role="tablist" aria-label="Film chapters">
        {CHAPTERS.map((chap, idx) => (
          <button
            key={chap.src}
            type="button"
            role="tab"
            aria-selected={activeIdx === idx}
            aria-label={`Jump to chapter: ${chap.title}`}
            onClick={() => seekToChapter(idx)}
            className={`${s.filmPosterBtn}${activeIdx === idx ? " " + s.filmPosterActive : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={chap.src}
              alt={chap.title}
              width={104}
              height={58}
              className={s.filmPosterImg}
              loading="lazy"
              decoding="async"
            />
            <span className={s.filmPosterLabel}>{chap.title}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
