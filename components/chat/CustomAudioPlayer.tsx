import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

export const CustomAudioPlayer = ({ src, isMe }: { src: string, isMe: boolean }) => {
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
        audio.currentTime = 1e101;
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
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [src]);

  const togglePlay = async () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        // [iOS/Android FIX] audio.play() returns a Promise that can be rejected
        // by the browser's autoplay policy (e.g. Capacitor WKWebView, Android Chrome).
        // We must await it and handle the rejection to keep state consistent.
        // Without this, isPlaying=true even though audio is actually silent,
        // and every subsequent tap toggles incorrectly.
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        // Play was blocked — state stays false. User can tap again.
        console.warn('[AudioPlayer] play() blocked by browser autoplay policy:', err);
        setIsPlaying(false);
      }
    }
  };

  const togglePlaybackRate = () => {
    const rates = [1, 1.5, 2];
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(nextRate);
    if (audioRef.current) audioRef.current.playbackRate = nextRate;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setProgress(time);
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
        
        {/* WhatsApp Green Play/Pause Round Button */}
        <button 
          type="button"
          onClick={togglePlay}
          className="w-9 h-9 rounded-full bg-[#25D366] hover:bg-[#128C7E] text-white flex items-center justify-center shrink-0 shadow-sm transition-all active:scale-90"
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
                    isActive ? 'bg-[#25D366]' : 'bg-black/20'
                  }`}
                  style={{ height: `${height}%` }}
                />
              );
            })}
          </div>
          
          <div className="flex items-center justify-between text-[11px] font-mono text-[#667781] leading-none px-0.5">
            <span>{isPlaying ? formatTime(progress) : formatTime(duration)}</span>
            {duration > 0 && <span>{formatTime(duration)}</span>}
          </div>
        </div>

        {/* Speed toggle pill */}
        <button 
          type="button"
          onClick={togglePlaybackRate}
          className="px-1.5 py-0.5 rounded-md text-[11px] font-bold bg-black/5 hover:bg-black/10 text-[#54656f] transition-colors shrink-0 font-mono"
        >
          {playbackRate}x
        </button>
      </div>

      {showTranscript && (
        <div className="px-3 py-1.5 rounded-xl text-[12px] italic bg-black/5 text-[#54656f]">
          Transcribing audio note...
        </div>
      )}
    </div>
  );
};

