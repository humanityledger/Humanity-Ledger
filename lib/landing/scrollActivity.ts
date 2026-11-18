/**
 * Whether the visitor is scrolling right now. Decorative work (the globe, the LivePhone's screen
 * loop) pauses while true, so the main thread is free for the scroll at the display's rate.
 */
let until = 0;
let installed = false;

export function isScrolling(): boolean {
  if (!installed && typeof window !== 'undefined') {
    installed = true;
    // Capture phase: scroll events from inner scrollers (the landing scrolls <main>) do not bubble.
    window.addEventListener('scroll', () => { until = performance.now() + 160; }, { passive: true, capture: true });
  }
  return typeof performance !== 'undefined' && performance.now() < until;
}
