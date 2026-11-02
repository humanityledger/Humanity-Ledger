"use client";

import React, { useEffect, useRef, useState } from "react";
import { RemoteLottie } from "@/components/ui/RemoteLottie";

/**
 * HeroMap — the animated world map behind the landing hero.
 *
 * The animation (public/lottie/map-world.json) is about 750 KB, so it never
 * blocks first paint. The page shows the static mark straight away and only
 * fetches the animation once the browser is idle. Visitors who ask for
 * reduced motion, or whose browser reports data saver, keep the static image.
 */
export function HeroMap({ className }: { className?: string }) {
  const [load, setLoad] = useState(false);
  const [ready, setReady] = useState(false);
  const animRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as unknown as { connection?: { saveData?: boolean } }).connection?.saveData;
    if (reduce || saveData) return;

    const start = () => setLoad(true);
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
      .requestIdleCallback;
    if (ric) {
      const id = ric(start, { timeout: 2000 });
      return () => (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(start, 600);
    return () => window.clearTimeout(t);
  }, []);

  // Swap from the static image once the animation has actually drawn.
  useEffect(() => {
    if (!load || !animRef.current) return;
    const el = animRef.current;
    const check = () => {
      if (el.querySelector("svg")) {
        setReady(true);
        return true;
      }
      return false;
    };
    if (check()) return;
    const mo = new MutationObserver(() => {
      if (check()) mo.disconnect();
    });
    mo.observe(el, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [load]);

  return (
    <div className={className} style={{ position: "relative", width: "100%", aspectRatio: "16 / 9" }} aria-hidden="true">
      <img
        src="/worldmap.png"
        alt=""
        draggable={false}
        style={{
          position: "absolute",
          inset: "8% 4%",
          width: "92%",
          height: "84%",
          objectFit: "contain",
          opacity: ready ? 0 : 0.09,
          transition: "opacity 600ms ease",
          pointerEvents: "none",
          userSelect: "none",
        }}
      />
      {load && (
        <div
          ref={animRef}
          style={{ position: "absolute", inset: 0, opacity: ready ? 1 : 0, transition: "opacity 600ms ease" }}
        >
          <RemoteLottie path="/lottie/map-world.json" loop speed={0.7} width="100%" height="100%" />
        </div>
      )}
    </div>
  );
}

export default HeroMap;
