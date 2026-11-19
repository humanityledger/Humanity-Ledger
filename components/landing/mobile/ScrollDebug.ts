/**
 * /?debug=scroll on the phone landing: frame intervals (p95 of the last 120 frames), long animation
 * frames and layout shifts, in a corner. Loaded only with the query; never part of the page's code.
 */
export function mount() {
  const box = document.createElement('pre');
  box.setAttribute('aria-hidden', 'true');
  box.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9;margin:0;padding:8px;font:12px/1.4 ui-monospace,monospace;background:#15171C;color:#F7F8FA;border-radius:8px;pointer-events:none';
  document.body.appendChild(box);
  const gaps: number[] = [];
  let last = performance.now(), loaf = 0, shift = 0;
  try { new PerformanceObserver((l) => { loaf += l.getEntries().filter((e) => e.duration > 50).length; }).observe({ type: 'long-animation-frame', buffered: true }); } catch { /* not supported */ }
  try { new PerformanceObserver((l) => { shift += l.getEntries().length; }).observe({ type: 'layout-shift', buffered: true }); } catch { /* not supported */ }
  const tick = (t: number) => { gaps.push(t - last); if (gaps.length > 120) gaps.shift(); last = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  setInterval(() => {
    const s = [...gaps].sort((a, b) => a - b);
    const p95 = s[Math.floor(s.length * 0.95)] ?? 0;
    box.textContent = `frame p95 ${p95.toFixed(1)} ms\nlong frames ${loaf}\nlayout shifts ${shift}\nscrollY ${Math.round(scrollY)}`;
  }, 500);
}
