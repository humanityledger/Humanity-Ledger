/**
 * Picture in picture shows both faces. The old path handed the remote <video> alone to the browser,
 * so the floating window showed only the other person (bug reported 20/11/2026).
 */
import fs from 'node:fs';
import { composeFrame, INSET } from '@/components/activities/callPip';

type Call = [string, ...unknown[]];
function fakeCtx() {
  const calls: Call[] = [];
  const rec = (name: string) => (...a: unknown[]) => { calls.push([name, ...a]); };
  const ctx: Record<string, unknown> = { calls, fillStyle: '', strokeStyle: '', lineWidth: 0 };
  for (const m of ['fillRect', 'drawImage', 'save', 'restore', 'translate', 'scale', 'beginPath', 'moveTo', 'arcTo', 'closePath', 'clip', 'stroke']) ctx[m] = rec(m);
  return ctx as unknown as CanvasRenderingContext2D & { calls: Call[] };
}
const video = (w: number, h: number) => ({ videoWidth: w, videoHeight: h }) as HTMLVideoElement;

describe('composed picture in picture', () => {
  it('draws the remote frame and our camera as a mirrored inset', () => {
    const ctx = fakeCtx();
    composeFrame(ctx, 640, 360, video(1280, 720), video(640, 480), true);
    const draws = ctx.calls.filter((c) => c[0] === 'drawImage');
    expect(draws).toHaveLength(2);
    // remote covers the whole frame
    expect(draws[0].slice(-4)).toEqual([0, 0, 640, 360]);
    // self inset: 30 % wide, bottom-right inside the margin, clipped and mirrored
    const iw = Math.round(640 * INSET.widthShare);
    expect(draws[1].slice(-2)).toEqual([iw, expect.any(Number)]);
    expect(ctx.calls.some((c) => c[0] === 'clip')).toBe(true);
    expect(ctx.calls.some((c) => c[0] === 'scale' && c[1] === -1)).toBe(true);
  });
  it('with our camera off, only the remote frame is drawn', () => {
    const ctx = fakeCtx();
    composeFrame(ctx, 640, 360, video(1280, 720), video(640, 480), false);
    expect(ctx.calls.filter((c) => c[0] === 'drawImage')).toHaveLength(1);
  });
  it('a remote without frames yet leaves a plain background, no crash', () => {
    const ctx = fakeCtx();
    composeFrame(ctx, 640, 360, video(0, 0), video(640, 480), true);
    expect(ctx.calls.filter((c) => c[0] === 'drawImage')).toHaveLength(1);
  });
});

describe('the call window never offers the remote-only floating window', () => {
  const src = fs.readFileSync('components/activities/CallWindow.tsx', 'utf8');
  const pip = fs.readFileSync('components/activities/callPip.ts', 'utf8');
  it('uses enterCallPip with both streams and keeps them updated', () => {
    expect(src).toMatch(/enterCallPip\(\{\s*remote,\s*local,/);
    expect(src).toMatch(/updateCallPip\(/);
    expect(src).toMatch(/exitCallPip\(\)/);
    expect(src).not.toMatch(/requestPictureInPicture|enterBrowserPip/);
    expect(fs.existsSync('components/activities/browserPip.ts')).toBe(false);
  });
  it('document mode renders both videos and the call controls; audio never moves', () => {
    expect(pip).toMatch(/documentPictureInPicture/);
    expect(pip).toMatch(/selfBox\.appendChild\(selfEl\)/);
    expect(pip).toMatch(/'End call'/);
    expect(pip).toMatch(/v\.muted = true/);
    expect(pip).not.toMatch(/\.muted = false/);
  });
  it('the composed mode is paced by a worker so a hidden tab keeps its frame rate', () => {
    expect(pip).toMatch(/new Worker\(url\)/);
    expect(pip).toMatch(/captureStream\(24\)/);
  });
});
