import { useEffect, useRef } from 'react';

export function useVisibilityPause(callback: () => void, intervalMs: number) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    const start = () => {
      if (!timer) timer = setInterval(() => cbRef.current(), intervalMs);
    };
    const stop = () => {
      if (timer) { clearInterval(timer); timer = null; }
    };

    const handleVisibility = () => {
      if (document.hidden) stop();
      else { cbRef.current(); start(); }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    if (!document.hidden) start();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      stop();
    };
  }, [intervalMs]);
}
