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
      <div className="flex flex-col gap-2 w-full">
        <div className={`flex items-center gap-2 min-w-[200px] max-w-[280px] p-2 rounded-2xl transition-all ${isMe ? 'bg-[#050505]' : 'bg-gray-100/50'}`}>
          <audio ref={audioRef} src={src} preload="auto" playsInline x-webkit-airplay="allow" />
          
          <button 
            onClick={togglePlay}
            className={`w-9 h-9 flex items-center justify-center shrink-0 rounded-full transition-colors ${
              isMe ? 'bg-white text-black hover:bg-white/90' : 'bg-[#050505] text-white hover:bg-black/90'
            }`}
          >
            {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-1" />}
          </button>

          <div className="flex-1 flex flex-col gap-1 mx-1 justify-center">
            {/* Synthetic Waveform aesthetic */}
            <div className="relative w-full h-8 flex items-center">
              <input
                type="range"
                min={0}
                max={duration || 1}
                value={progress}
                onChange={handleSeek}
                className="absolute z-20 w-full opacity-0 cursor-pointer h-full"
              />
              <div className={`w-full h-1.5 rounded-full relative overflow-hidden ${isMe ? 'bg-white/20' : 'bg-black/10'}`}>
                <div 
                  className={`absolute top-0 left-0 h-full rounded-full transition-all duration-75 ${isMe ? 'bg-white' : 'bg-[#050505]'}`}
                  style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }}
                />
              </div>
            </div>
            
            <div className={`flex items-center justify-between px-1 ${isMe ? 'text-white/60' : 'text-black/50'}`}>
              <span className="text-[9px] font-mono font-medium tracking-wider">
                {isPlaying ? formatTime(progress) : formatTime(duration)}
              </span>
            </div>
          </div>

          <button 
            onClick={togglePlaybackRate}
            className={`w-8 h-8 flex items-center justify-center rounded-full text-[10px] font-bold font-mono transition-colors shrink-0 ${
              isMe ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-black/5 hover:bg-black/10 text-black'
            }`}
          >
            {playbackRate}x
          </button>
        </div>

        {showTranscript && (
          <div className={`px-3 py-2 rounded-xl text-[13px] italic ${isMe ? 'bg-white/10 text-white/90' : 'bg-black/5 text-black/80'}`}>
            "This is a simulated AI voice transcription. In production, this runs via whisper.cpp on the Edge node."
          </div>
        )}
      </div>
  );
};

