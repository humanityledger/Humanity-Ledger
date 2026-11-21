/**
 * The one loading mark of Ledger Chat. Every screen shown while the app opens (the PIN gate check,
 * the chat bundle, the account settings) draws this same lockup in the same place, on the same
 * background as the screen that follows, so opening Ledger Chat reads as one calm step.
 *
 * Design (21 November 2026): the company mark, small, beside the product name, over a thin line
 * with one sliding segment, like the session panel that follows (PadlockLoader). No spinning ring.
 * Motion is transform only and stops under reduced motion.
 */
export function BootMark({ label = 'Opening Ledger Chat' }: { label?: string }) {
  return (
    <div className="hl-boot" role="status" aria-label={label}>
      <span className="hl-boot-lockup" aria-hidden="true">
        <span className="hl-boot-logo">
          <img src="/boot-mark.webp" alt="" width={28} height={28} draggable={false} decoding="sync" />
        </span>
        <span className="hl-boot-name">Ledger Chat</span>
      </span>
      <span className="hl-boot-line" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
