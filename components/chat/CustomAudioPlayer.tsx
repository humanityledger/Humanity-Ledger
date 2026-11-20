import React, { useState, useRef, useEffect } from 'react';
import { useMediaUrl } from '@/lib/chat/media-url';
import { Play, Pause, Download } from 'lucide-react';

export const CustomAudioPlayer = ({ src: rawSrc, isMe }: { src: string, isMe: boolean }) => {
  // data: voice notes are played from a blob: URL, which the CSP allows (lib/chat/media-url.ts).
  const src = useMediaUrl(rawSrc) ?? '';
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setProgress(audio.currentTime);
    const handleLoadedMetadata = () => {
      if (audio.duration === Infinity) {
        // Chrome's WebM recordings have no duration until the end is read: seek there once.
        try { audio.currentTime = 1e101; } catch { return; }
        audio.ontimeupdate = () => {
          audio.ontimeupdate = () => setProgress(audio.currentTime);
          audio.currentTime = 0;
          setDuration(audio.duration);
        };
      } else {
        setDuration(audio.duration);
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    const handleError = () => { if (audio.error?.code === 4) setIsPlaying(false); };
    audio.addEventListener('error', handleError);
    return () => {
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [src]);

  // ── Safari ─────────────────────────────────────────────────────────────────
  // Safari's <audio> cannot play some recordings other browsers make (Opus in WebM before
  // iOS 18.4, some MP4 variants), and it then fails without a sound. When the element cannot
  // play the file, the bytes are decoded with Web Audio instead, which often can; when that
  // fails too, the message says so and offers the file, instead of a silent play button.
  const web = useRef<{
    ctx: AudioContext;
    buffer: AudioBuffer | null;
    node: AudioBufferSourceNode | null;
    startedAt: number;
    offset: number;
    raf: number;
  } | null>(null);
  const [unplayable, setUnplayable] = useState(false);

  useEffect(() => () => {
    const w = web.current;
    web.current = null;
    if (!w) return;
    cancelAnimationFrame(w.raf);
    try { w.node?.stop(); } catch { /* not started */ }
    w.ctx.close().catch(() => {});
  }, [src]);

  const elementCannotPlay = () => {
    const a = audioRef.current;
    return !!a && (a.error?.code === 4 /* MEDIA_ERR_SRC_NOT_SUPPORTED */ || a.networkState === 3 /* NETWORK_NO_SOURCE */);
  };

  const stopWeb = (keepOffset: boolean) => {
    const w = web.current;
    if (!w) return;
    cancelAnimationFrame(w.raf);
    if (w.node) {
      w.node.onended = null;
      try { w.node.stop(); } catch { /* not started */ }
      if (keepOffset) w.offset += (w.ctx.currentTime - w.startedAt) * playbackRate;
      w.node = null;
    }
  };

  const playWeb = async (ctx: AudioContext) => {
    let w = web.current;
    if (!w) {
      w = { ctx, buffer: null, node: null, startedAt: 0, offset: 0, raf: 0 };
      web.current = w;
    } else if (w.ctx !== ctx) {
      ctx.close().catch(() => {});
    }
    if (w.ctx.state === 'suspended') await w.ctx.resume();
    if (!w.buffer) {
      const bytes = await (await fetch(src)).arrayBuffer();
      // The callback form: older Safari has no promise from decodeAudioData.
      w.buffer = await new Promise<AudioBuffer>((resolve, reject) => {
        try {
          const r = w!.ctx.decodeAudioData(bytes, resolve, reject);
          if (r && typeof (r as Promise<AudioBuffer>).then === 'function') (r as Promise<AudioBuffer>).then(resolve, reject);
        } catch (e) { reject(e); }
      });
      setDuration(w.buffer.duration);
    }
    if (w.offset >= w.buffer.duration - 0.05) w.offset = 0;
    const node = w.ctx.createBufferSource();
    node.buffer = w.buffer;
    node.playbackRate.value = playbackRate;
    node.connect(w.ctx.destination);
    node.start(0, w.offset);
    w.node = node;
    w.startedAt = w.ctx.currentTime;
    node.onended = () => {
      if (web.current?.node !== node) return;
      stopWeb(false);
      web.current.offset = 0;
      setIsPlaying(false);
      setProgress(0);
    };
    const tick = () => {
      const cur = web.current;
      if (!cur || cur.node !== node) return;
      setProgress(Math.min(cur.buffer!.duration, cur.offset + (cur.ctx.currentTime - cur.startedAt) * node.playbackRate.value));
      cur.raf = requestAnimationFrame(tick);
    };
    w.raf = requestAnimationFrame(tick);
    setIsPlaying(true);
  };

  const togglePlay = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (isPlaying) {
      if (web.current?.node) stopWeb(true);
      else a.pause();
      setIsPlaying(false);
      return;
    }
    // The audio context is made now, inside the tap: Safari only lets one start from a gesture.
    const Ctx: typeof AudioContext | undefined = typeof window !== 'undefined' ? (window.AudioContext || (window as any).webkitAudioContext) : undefined;
    const useWeb = !!web.current?.buffer || elementCannotPlay();
    const ctx = useWeb && Ctx ? (web.current?.ctx ?? new Ctx()) : null;
    if (ctx) {
      try { await playWeb(ctx); } catch (e) {
        console.warn('[AudioPlayer] This browser cannot decode this voice message:', e);
        setUnplayable(true);
        setIsPlaying(false);
      }
      return;
    }
    try {
      // [iOS/Android FIX] audio.play() returns a Promise that can be rejected
      // by the browser's autoplay policy (e.g. Capacitor WKWebView, Android Chrome).
      // We must await it and handle the rejection to keep state consistent.
      // Without this, isPlaying=true even though audio is actually silent,
      // and every subsequent tap toggles incorrectly.
      // Safari can leave a blob source unloaded until asked.
      if (a.readyState === 0 && a.networkState !== 2 /* LOADING */) a.load();
      await a.play();
      setIsPlaying(true);
    } catch (err: any) {
      if (err?.name === 'NotSupportedError' || elementCannotPlay()) {
        // The element cannot play this file: Web Audio. A new context may need a second tap in
        // Safari (this one was spent on play()); the button stays ready for it.
        const ctx2 = Ctx ? new Ctx() : null;
        if (ctx2) {
          try { await playWeb(ctx2); return; } catch (e) {
            console.warn('[AudioPlayer] This browser cannot decode this voice message:', e);
            setUnplayable(true);
          }
        } else {
          setUnplayable(true);
        }
      } else {
        // Play was blocked — state stays false. User can tap again.
        console.warn('[AudioPlayer] play() blocked by browser autoplay policy:', err);
      }
      setIsPlaying(false);
    }
  };

  const togglePlaybackRate = () => {
    const rates = [1, 1.5, 2];
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(nextRate);
    if (audioRef.current) audioRef.current.playbackRate = nextRate;
    const w = web.current;
    if (w?.node) {
      // Keep the position: what has played so far at the old speed, then the new speed from here.
      w.offset += (w.ctx.currentTime - w.startedAt) * w.node.playbackRate.value;
      w.startedAt = w.ctx.currentTime;
      w.node.playbackRate.value = nextRate;
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setProgress(time);
    const w = web.current;
    if (w?.buffer) {
      const playing = !!w.node;
      stopWeb(false);
      w.offset = time;
      if (playing) void playWeb(w.ctx);
      return;
    }
    if (audioRef.current) audioRef.current.currentTime = time;
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-1 w-full select-none">
      <div className="flex items-center gap-2.5 min-w-[220px] max-w-[290px] py-1">
        <audio ref={audioRef} src={src} preload="auto" playsInline x-webkit-airplay="allow" />
        
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
          className="w-9 h-9 rounded-full bg-[#15171c] hover:bg-[#2b2f38] text-white flex items-center justify-center shrink-0 transition-all active:scale-95"
        >
          {isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" className="ml-0.5" />}
        </button>

        <div className="flex-1 flex flex-col gap-1 mx-1 justify-center">
          {/* Waveform track with seekable slider */}
          <div className="relative w-full h-7 flex items-center gap-[2px] cursor-pointer">
            <input
              type="range"
              min={0}
              max={duration || 1}
              step="0.05"
              value={progress}
              onChange={handleSeek}
              aria-label="Position in voice message"
              className="absolute z-20 w-full opacity-0 cursor-pointer h-full inset-0"
            />
            {/* Generate 30 bars for the waveform */}
            {Array.from({ length: 28 }).map((_, i) => {
              const isActive = duration > 0 && (i / 28) <= (progress / duration);
              const height = 24 + ((i * 19) % 56); 
              return (
                <div 
                  key={i} 
                  className={`flex-1 rounded-full transition-colors duration-100 ${
                    isActive ? 'bg-[#15171c]' : 'bg-[#d4d8df]'
                  }`}
                  style={{ height: `${height}%` }}
                />
              );
            })}
          </div>
          
          <div className="flex items-center justify-between text-[12px] tabular-nums text-[#727a88] leading-none px-0.5">
            <span>{isPlaying ? formatTime(progress) : formatTime(duration)}</span>
            {duration > 0 && <span>{formatTime(duration)}</span>}
          </div>
        </div>

        {/* Speed toggle pill */}
        <button
          type="button"
          onClick={togglePlaybackRate}
          aria-label="Playback speed"
          className="px-2 py-0.5 rounded-full text-[12px] font-medium tabular-nums bg-[#eff1f4] hover:bg-[#e4e7ec] text-[#4a505c] transition-colors shrink-0"
        >
          {playbackRate}x
        </button>
      </div>

      {unplayable && (
        <p className="flex items-center gap-2 px-0.5 text-[12.5px] text-[#727a88]">
          This browser cannot play this recording.
          <a href={src} download="voice-message" className="inline-flex items-center gap-1 font-medium text-[#15171c] underline underline-offset-2">
            <Download size={13} strokeWidth={2} aria-hidden="true" /> Save it
          </a>
        </p>
      )}
      {showTranscript && (
        <div className="px-3 py-1.5 rounded-xl text-[13px] bg-[#f2f4f7] text-[#4a505c]">
          Transcribing
        </div>
      )}
    </div>
  );
};

