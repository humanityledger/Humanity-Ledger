import { useState, useEffect, useCallback, useRef } from 'react';
import { t as tr } from '@/lib/i18n/runtime';

interface UseSecureCameraOptions {
  facingMode?: 'user' | 'environment';
  onFrame?: (canvas: HTMLCanvasElement) => void;
}

export function useSecureCamera({ facingMode = 'user', onFrame }: UseSecureCameraOptions) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRafId = useRef<number>(0);
  const activeRequestRef = useRef<string | null>(null);
  const isInitializingRef = useRef(false);
  // Keep a stable ref to onFrame so the RAF loop always calls the latest version
  const onFrameRef = useRef(onFrame);
  useEffect(() => { onFrameRef.current = onFrame; }, [onFrame]);

  const startCamera = useCallback(async () => {
    // Use the ref guard — avoids startCamera getting a new reference on every state change
    if (isInitializingRef.current) return;
    isInitializingRef.current = true;
    setIsInitializing(true);
    setError(null);
    const activeRequestId = Math.random().toString();
    activeRequestRef.current = activeRequestId;

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('WebRTC API not supported in this browser.');
      }

      let stream: MediaStream;
      try {
        // ─── ROBUST SINGLE-CALL WEBRTC (Android Fix) ─────────────────────────
        // We must NEVER use nested try-catch fallbacks for getUserMedia on Android.
        // If the first request fails, the transient user-activation token is lost,
        // and all subsequent fallbacks will automatically throw NotAllowedError.
        // Therefore, we make exactly ONE robust request.
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode } },
          audio: false,
        });
      } catch (err) {
        throw err;
      }

      if (activeRequestRef.current !== activeRequestId) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      streamRef.current = stream;
      setHasPermission(true);

      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true'); // Critical for iOS PWA/Safari
        video.setAttribute('muted', 'true');
        video.setAttribute('autoplay', 'true');
        video.muted = true;
        video.playsInline = true;

        const startFrameLoop = () => {
          cancelAnimationFrame(frameRafId.current);
          const processFrame = () => {
            if (
              videoRef.current &&
              canvasRef.current &&
              videoRef.current.readyState >= videoRef.current.HAVE_ENOUGH_DATA &&
              videoRef.current.videoWidth > 0
            ) {
              const canvas = canvasRef.current;
              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              if (ctx) {
                canvas.width = videoRef.current.videoWidth;
                canvas.height = videoRef.current.videoHeight;
                ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                onFrameRef.current?.(canvas);
              }
            }
            frameRafId.current = requestAnimationFrame(processFrame);
          };
          frameRafId.current = requestAnimationFrame(processFrame);
        };

        video.onloadedmetadata = () => {
          video.play()
            .then(() => startFrameLoop())
            .catch(e => {
              console.error('Video play error:', e);
              setTimeout(() => {
                video.play().then(() => startFrameLoop()).catch(() => {});
              }, 300);
            });
        };

        // Also handle already-loaded streams (BFCache restore on iOS)
        if (video.readyState >= video.HAVE_ENOUGH_DATA) {
          video.play().then(() => startFrameLoop()).catch(() => {});
        }
      }
    } catch (err: any) {
      if (activeRequestRef.current === activeRequestId) {
        console.error('Camera initialization failed:', err);
        setHasPermission(false);
        // Provide friendly messages for common iOS/Android permission errors
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError(tr("Camera permission denied. Please allow camera access in your browser settings and try again."));
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError(tr("No camera found on this device."));
        } else if (err.name === 'NotReadableError') {
          setError(tr("Camera is in use by another app. Close it and try again."));
        } else {
          setError(err.message || tr("Camera access denied or unavailable."));
        }
      }
    } finally {
      if (activeRequestRef.current === activeRequestId) {
        isInitializingRef.current = false;
        setIsInitializing(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]); // IMPORTANT: isInitializing removed — it was causing infinite re-render loops

  const stopCamera = useCallback(() => {
    activeRequestRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    cancelAnimationFrame(frameRafId.current);
    isInitializingRef.current = false;
    setIsInitializing(false);
  }, []);

  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (context && video.videoWidth > 0 && video.videoHeight > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.85); // High quality JPEG
    }
    return null;
  }, []);

  // Frame loop is now started directly from video.onloadedmetadata → play()
  // inside startCamera(). This useEffect is kept only as a fallback for components
  // that mount after the stream is already active.
  useEffect(() => {
    if (!onFrame || !hasPermission) return;
    // If the frame loop is already running (frameRafId > 0), do nothing.
    if (frameRafId.current) return;
    // Fallback: start the loop if somehow video is already playing
    const video = videoRef.current;
    if (video && video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const processFrame = () => {
        if (video && canvas && video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            onFrameRef.current?.(canvas);
          }
        }
        frameRafId.current = requestAnimationFrame(processFrame);
      };
      frameRafId.current = requestAnimationFrame(processFrame);
      return () => cancelAnimationFrame(frameRafId.current);
    }
  }, [onFrame, hasPermission]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && hasPermission && !isInitializingRef.current) {
        const stream = streamRef.current;
        const tracks = stream?.getTracks() || [];
        const isActive = tracks.some(t => t.readyState === 'live');
        
        // If the video is stuck, paused, or the tracks died in the background, restart
        if (!isActive || (videoRef.current && videoRef.current.paused)) {
          startCamera();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [hasPermission, startCamera]);

  return {
    videoRef,
    canvasRef,
    hasPermission,
    isInitializing,
    error,
    startCamera,
    stopCamera,
    captureFrame,
  };
}
