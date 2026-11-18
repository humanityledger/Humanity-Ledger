"use client";

/**
 * ScrollProgressBar  Thin top-of-page progress indicator
 * Renders a 2px line that fills from left to right as the page scrolls.
 * CPU cost: zero after mount  runs entirely on scroll event + RAF.
 */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function ScrollProgressBar() {
  const barRef = useRef<HTMLDivElement>(null);
  // The landing has no progress line: nothing may resize on every scroll frame there.
  const off = usePathname() === "/";

  useEffect(() => {
    if (off) return;
    let scrollTarget: HTMLElement = document.documentElement;
    let fallbackTimer: NodeJS.Timeout;
    let rafId: number;

    const update = () => {
      const bar = barRef.current;
      if (!bar) return;
      
      const customContainer = document.getElementById("main-scroll-container");
      // If we haven't designated a recent target and there's a custom container, use it
      if (customContainer && scrollTarget === document.documentElement) {
          scrollTarget = customContainer;
      }
      
      const scrolled = scrollTarget.scrollTop;
      const max = scrollTarget.scrollHeight - scrollTarget.clientHeight;
      const pct = max > 0 ? (scrolled / max) * 100 : 0;
      bar.style.width = `${pct}%`;
    };

    const onScroll = (e: Event) => {
      if (e.target && e.target instanceof HTMLElement && e.target !== document.documentElement) {
          // If we detect an inner scroll container, track it
          if (e.target.scrollHeight > e.target.clientHeight) {
              scrollTarget = e.target;
          }
      } else {
          const custom = document.getElementById("main-scroll-container");
          scrollTarget = custom || document.documentElement;
      }
      
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    };

    // Use capture phase to intercept non-bubbling scroll events from inner containers
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    
    // Fallback sync for dynamic route changes
    fallbackTimer = setInterval(() => {
        const custom = document.getElementById("main-scroll-container");
        if (custom) scrollTarget = custom;
        update();
    }, 1000);

    update(); // initial
    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true } as EventListenerOptions);
      cancelAnimationFrame(rafId);
      clearInterval(fallbackTimer);
    };
  }, [off]);

  if (off) return null;
  return (
    <div
      className="fixed top-0 left-0 right-0 z-[999] pointer-events-none"
      style={{ height: "2px", background: "transparent" }}
    >
      <div
        ref={barRef}
        className="h-full hz-240"
        style={{
          width: "0%",
          background: "linear-gradient(90deg, #00F2EA, #00C4E0)",
          boxShadow: "0 0 8px rgba(0,242,234,0.6)",
          transition: "width 0.05s linear",
          transformOrigin: "left center",
        }}
      />
    </div>
  );
}
