'use client';
/**
 * The island's waveform. Two honest modes:
 *   stream   the bars follow the real loudness of that MediaStream (the other side of a call),
 *            read with an AnalyserNode and written straight to the bars, with no React render
 *            per frame. Nothing is played: the engine's <audio> element plays the voice.
 *   pulse    no stream to read (a voice note being recorded): the bars breathe on a loop, which
 *            says "live" without pretending to be a level.
 * Muted, or "reduce motion": the bars rest flat.
 */
import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import s from './activities.module.css';

const BARS = 5;
/** Each bar's share of the level: taller in the middle, like a voice. */
const SHAPE = [0.55, 0.85, 1, 0.8, 0.6];
const REST = 0.2;

type AudioCtor = typeof AudioContext;

export function Wave({ stream, muted = false, tone = 'live' }: { stream?: MediaStream | null; muted?: boolean; tone?: 'live' | 'danger' | 'violet' }) {
  const reduced = !!useReducedMotion();
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const hasAudio = !!stream && stream.getAudioTracks().some((t) => t.readyState === 'live');
  const mode: 'stream' | 'pulse' | 'rest' = muted || reduced ? 'rest' : hasAudio ? 'stream' : stream === undefined ? 'pulse' : 'rest';

  useEffect(() => {
    if (mode !== 'stream' || !stream) return;
    const Ctor: AudioCtor | undefined = typeof window !== 'undefined'
      ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext)
      : undefined;
    if (!Ctor) return;
    let ctx: AudioContext;
    try { ctx = new Ctor(); } catch { return; }
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.7;
    let source: MediaStreamAudioSourceNode | null = null;
    try { source = ctx.createMediaStreamSource(stream); source.connect(analyser); } catch { void ctx.close(); return; }
    void ctx.resume().catch(() => undefined);
    const bins = new Uint8Array(analyser.frequencyBinCount);
    const level = new Array(BARS).fill(REST);
    let frame = 0;
    let last = 0;
    const draw = (t: number) => {
      frame = requestAnimationFrame(draw);
      if (t - last < 33) return; // ~30 fps is plenty for five bars
      last = t;
      analyser.getByteFrequencyData(bins);
      // Five bands across the voice range (the first ~40 bins at 48 kHz cover up to ~7.5 kHz).
      for (let i = 0; i < BARS; i++) {
        let sum = 0;
        const from = 1 + i * 7;
        for (let j = from; j < from + 7; j++) sum += bins[j] ?? 0;
        const v = Math.min(1, (sum / 7 / 255) * 1.8) * SHAPE[i];
        // Rise fast, fall slowly: it reads as speech, not flicker.
        level[i] = v > level[i] ? v : level[i] * 0.82 + v * 0.18;
        const el = bars.current[i];
        if (el) el.style.transform = `scaleY(${Math.max(REST, level[i]).toFixed(3)})`;
      }
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      try { source?.disconnect(); } catch { /* already gone */ }
      void ctx.close().catch(() => undefined);
    };
  }, [mode, stream]);

  const toneClass = tone === 'danger' ? s.waveDanger : tone === 'violet' ? s.waveViolet : s.waveLive;
  return (
    <span className={`${s.wave} ${toneClass} ${mode === 'pulse' ? s.wavePulse : ''}`} aria-hidden="true">
      {SHAPE.map((_, i) => (
        <span key={i} ref={(el) => { bars.current[i] = el; }} className={s.waveBar} style={{ transform: `scaleY(${REST})`, animationDelay: `${i * -0.18}s` }} />
      ))}
    </span>
  );
}

export default Wave;
