/** Contact info and its dialogs are never clipped by the drawer on iPhone (portalled, full screen). */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (p: string) => fs.readFileSync(p, 'utf8');

describe('Contact info on phones', () => {
  it('every chat dialog renders into <body> through BodyPortal', () => {
    expect(read('components/chat/ui/BodyPortal.tsx')).toContain('createPortal(children, document.body)');
    for (const f of [
      'components/chat/ContactInfoPanel.tsx', 'components/chat/EncryptionInfoSheet.tsx', 'components/chat/ui/kit.tsx',
      'components/chat/WallpaperPickerSheet.tsx', 'components/chat/ThemePickerSheet.tsx', 'components/chat/BurnTimerSheet.tsx',
    ]) {
      expect(read(f), f).toContain('<BodyPortal>');
    }
  });

  it('the panel covers the whole screen on phones; the 400 px drawer is only for wide screens', () => {
    const src = read('components/chat/ContactInfoPanel.tsx');
    expect(src).not.toContain('w-full sm:w-[400px]');
    expect(src).toContain("'lg-canvas fixed inset-0 z-[250001] w-full max-w-none flex flex-col'");
    expect(src).toContain('const compact = useCompactLayout();');
    expect(src).toContain('pt-[max(8px,env(safe-area-inset-top))]');
    expect(src).toContain('pb-[max(28px,env(safe-area-inset-bottom))]');
  });

  it('dialogs fit the screen width and sit above the panel', () => {
    const panel = read('components/chat/ContactInfoPanel.tsx');
    expect(panel).toContain('w-[min(calc(100vw-24px),420px)]');
    expect(panel).toContain('z-[260000]');
    const enc = read('components/chat/EncryptionInfoSheet.tsx');
    expect(enc).toContain('z-[260500]');
    expect(enc).toContain('max-h-[85dvh]');
    expect(enc).toContain('useBackLayer(open, onClose);');
  });
});
