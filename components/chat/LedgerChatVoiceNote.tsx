"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';

interface LedgerChatVoiceNoteProps {
  onSend: (audioBlob: Blob, durationSeconds: number) => void;
  onCancel: () => void;
}

const WAVEFORM_BARS = 20;

export function LedgerChatVoiceNote({ onSend, onCancel }: LedgerChatVoiceNoteProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [waveform, setWaveform] = useState<number[]>(Array(WAVEFORM_BARS).fill(4));
  const [permissionError, setPermissionError] = useState('');
  const [canSend, setCanSend] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAll = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const startRecording = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!mounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;

        // Set up AudioContext for waveform
        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;
        const analyser = audioCtx.createAnalyser();
        analyserRef.current = analyser;
        analyser.fftSize = 64;
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const animate = () => {
          if (!mounted) return;
          analyser.getByteFrequencyData(dataArray);
          const bars = Array.from({ length: WAVEFORM_BARS }, (_, i) => {
            const idx = Math.floor(i * dataArray.length / WAVEFORM_BARS);
            return Math.max(4, (dataArray[idx] / 255) * 40);
          });
          setWaveform(bars);
          animFrameRef.current = requestAnimationFrame(animate);
        };
        animFrameRef.current = requestAnimationFrame(animate);

        // Candidate-based MIME type negotiation with safe fallback for iOS Safari < 18.4
        // iOS 14.1–18.3 supports audio/mp4 and audio/aac, but neither webm nor ogg.
        // If no candidate matches isTypeSupported, pass undefined so the browser uses its native container.
        const candidates = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/mp4',
          'audio/aac',
          'audio/ogg;codecs=opus',
          'audio/ogg',
        ];
        let mimeType = '';
        if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
          for (const c of candidates) {
            if (MediaRecorder.isTypeSupported(c)) {
              mimeType = c;
              break;
            }
          }
        }

        const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        audioChunksRef.current = [];

        recorder.ondataavailable = e => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        recorder.start(100);
        setIsRecording(true);

        // Timer
        timerRef.current = setInterval(() => {
          setSeconds(s => {
            const next = s + 1;
            if (next >= 1) setCanSend(true);
            return next;
          });
        }, 1000);
      } catch (err: any) {
        if (!mounted) return;
        const isPermission = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
        setPermissionError(
          isPermission
            ? 'Microphone access denied. Please enable it in your browser settings.'
            : `Voice recording unavailable on this device (${err?.message || 'Unsupported audio format'}).`
        );
        console.error('[VoiceNote] mic error:', err);
      }
    };

    startRecording();

    return () => {
      mounted = false;
      stopAll();
    };
  }, [stopAll]);

  const handleSend = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(audioChunksRef.current, {
        type: mediaRecorderRef.current?.mimeType ?? 'audio/webm',
      });
      onSend(blob, seconds);
    };

    stopAll();
    setIsRecording(false);
  }, [onSend, seconds, stopAll]);

  const handleCancel = useCallback(() => {
    stopAll();
    onCancel();
  }, [onCancel, stopAll]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  if (permissionError) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border-t border-red-100">
        <button onClick={handleCancel} className="p-2 rounded-full bg-red-100 text-red-500">
          <X size={16} />
        </button>
        <p className="text-[12px] text-red-600 font-medium flex-1">{permissionError}</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="flex items-center gap-3 px-4 py-3 bg-white border-t border-black/10"
    >
      {/* Cancel */}
      <button
        onClick={handleCancel}
        className="w-9 h-9 flex items-center justify-center rounded-full bg-red-100 text-red-500 hover:bg-red-200 transition-colors shrink-0 active:scale-95"
      >
        <X size={18} />
      </button>

      {/* Waveform */}
      <div className="flex-1 flex items-center gap-[2px] h-10 overflow-hidden">
        {waveform.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-full bg-[#2754d6] transition-all duration-75"
            style={{ height: `${h}px`, minWidth: 2 }}
          />
        ))}
      </div>

      {/* Timer */}
      <span className="text-[13px] font-mono font-bold text-black/60 shrink-0 min-w-[38px] text-right">
        {formatTime(seconds)}
      </span>

      {/* Record indicator */}
      <div className="relative shrink-0">
        {isRecording && (
          <div className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-50" />
        )}
        <div className="relative w-9 h-9 rounded-full bg-red-500 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-white" />
        </div>
      </div>

      {/* Send */}
      <button
        onClick={handleSend}
        disabled={!canSend}
        className="w-9 h-9 flex items-center justify-center rounded-full bg-[#30d158] text-white disabled:opacity-30 hover:bg-[#28b34c] transition-colors active:scale-95 shrink-0"
      >
        <Check size={18} />
      </button>
    </motion.div>
  );
}
