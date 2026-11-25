'use client';
import { useT } from '@/lib/i18n/client';

export function PrintButton({ className }: { className?: string }) {
  const t = useT();
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      {t("Print or save as PDF")}
    </button>
  );
}
