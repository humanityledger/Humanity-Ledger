/**
 * A photograph of a hand holding an iPhone, with Ledger Chat drawn on its display.
 *
 * The app is laid out in a 300 x 652.2 box (an iPhone 16 Pro screen, 402 x 874 pt) and projected
 * onto the display of the photo with one matrix3d, fitted to the photo's display edges
 * (lib/landing/mockups.ts). A mask cut from the same photo clips it to the display and keeps the
 * fingers that sit in front of the screen in front of the app.
 *
 * No script: the stage is scaled with a fixed factor per breakpoint, because each mock has a
 * fixed width per breakpoint (see .mock in site.module.css). So the server HTML is already exact.
 */
import React from 'react';
import { MOCKUPS, SCREEN_H, SCREEN_W, type MockupId } from '@/lib/landing/mockups';
import s from './site.module.css';

/** Width of the mock at each breakpoint: xs < 380 px, sm < 768 px, md < 1100 px, xl from 1100 px. */
const TIERS = {
  hero: { xs: 300, sm: 340, md: 420, xl: 540 },
  row: { xs: 300, sm: 340, md: 400, xl: 500 },
} as const;

export function PhotoMockup({
  id,
  size = 'row',
  label,
  priority,
  children,
  className,
}: {
  id: MockupId;
  size?: keyof typeof TIERS;
  /** What the picture shows, for screen readers. Omit when the screen inside is itself readable. */
  label?: string;
  priority?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const m = MOCKUPS[id];
  const vars: Record<string, string> = {};
  for (const [tier, w] of Object.entries(TIERS[size])) {
    vars[`--w-${tier}`] = `${w}px`;
    vars[`--k-${tier}`] = String(Math.round((w / m.width) * 1e6) / 1e6);
  }
  const [bx, by, bw, bh] = m.maskBox;
  const mask = `url(${m.mask})`;
  return (
    <figure
      className={`${s.mock} ${className ?? ''}`}
      style={{ ...vars, aspectRatio: `${m.width} / ${m.height}` } as React.CSSProperties}
      {...(label ? { role: 'img', 'aria-label': label } : {})}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={s.mockPhoto}
        src={m.src}
        width={m.width}
        height={m.height}
        alt=""
        decoding="async"
        loading={priority ? 'eager' : 'lazy'}
        {...(priority ? { fetchPriority: 'high' as const } : {})}
      />
      <div className={s.mockStage} style={{ width: m.width, height: m.height }} {...(label ? { 'aria-hidden': true } : {})}>
        <div
          className={s.mockClip}
          style={{
            WebkitMaskImage: mask,
            maskImage: mask,
            WebkitMaskPosition: `${bx}px ${by}px`,
            maskPosition: `${bx}px ${by}px`,
            WebkitMaskSize: `${bw}px ${bh}px`,
            maskSize: `${bw}px ${bh}px`,
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
          }}
        >
          <div className={s.mockScreen} style={{ width: SCREEN_W, height: SCREEN_H, transform: m.matrix }}>
            {children}
          </div>
        </div>
      </div>
    </figure>
  );
}

/** The display of the phone: status bar and Dynamic Island over the app, light or dark. */
export function DeviceScreen({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div className={`${s.handset} ${dark ? s.handsetDark : ''}`}>
      <div className={s.dStatus} aria-hidden="true">
        <span className={s.dClock}>9:41</span>
        <span className={s.dIsland} />
        <span className={s.dIcons}>
          <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="1" /><rect x="4.5" y="5" width="3" height="6" rx="1" /><rect x="9" y="2.5" width="3" height="8.5" rx="1" /><rect x="13.5" y="0" width="3" height="11" rx="1" /></svg>
          <svg width="15" height="11" viewBox="0 0 15 11"><path d="M7.5 2.2c2 0 3.9.8 5.3 2.1l1-1.1A9.1 9.1 0 0 0 7.5.7 9.1 9.1 0 0 0 1.2 3.2l1 1.1a7.6 7.6 0 0 1 5.3-2.1zm0 3.1c1.2 0 2.3.4 3.1 1.2l1-1.1a6 6 0 0 0-8.2 0l1 1.1c.8-.8 1.9-1.2 3.1-1.2zm0 3.1c-.5 0-.9.2-1.2.5l1.2 1.3 1.2-1.3c-.3-.3-.7-.5-1.2-.5z" /></svg>
          <svg width="25" height="12" viewBox="0 0 25 12"><rect x="0.5" y="0.5" width="21" height="11" rx="3.2" fill="none" stroke="currentColor" opacity=".4" /><rect x="2" y="2" width="18" height="8" rx="2" /><path d="M23 4v4c.8-.3 1.3-1.1 1.3-2S23.8 4.3 23 4z" opacity=".45" /></svg>
        </span>
      </div>
      {children}
      <span className={s.dHome} aria-hidden="true" />
    </div>
  );
}
