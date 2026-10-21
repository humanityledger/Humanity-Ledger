// lib/chat/voiceNote.ts
export function calculateWaveformPeaks(audioBuffer: Float32Array, bars = 40): number[] {
  const blockSize = Math.floor(audioBuffer.length / bars);
  const peaks: number[] = [];
  for (let i = 0; i < bars; i++) {
    const start = i * blockSize;
    let sum = 0;
    for (let j = 0; j < blockSize; j++) {
      sum += Math.abs(audioBuffer[start + j] || 0);
    }
    peaks.push(Math.min(1, Math.max(0.1, (sum / blockSize) * 2)));
  }
  return peaks;
}
