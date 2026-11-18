/**
 * The one loading mark of Ledger Chat (18 November 2026). Every screen that is shown while the
 * app opens (the PIN gate check, the chat bundle, the account settings) draws this same mark in
 * the same place, on the same background as the screen that follows, so opening Ledger Chat reads
 * as one calm step instead of a sequence of different white and grey screens. Same emblem as
 * PadlockLoader (the channel screen). Motion is one turning arc, off under reduced motion.
 */
export function BootMark({ label = 'Opening Ledger Chat' }: { label?: string }) {
  return (
    <div className="hl-boot" role="status" aria-label={label}>
      <span className="hl-boot-arc" aria-hidden="true" />
      <span className="hl-boot-logo" aria-hidden="true">
        <img src="/boot-mark.webp" alt="" width={72} height={72} draggable={false} decoding="sync" />
      </span>
      <span className="sr-only">{label}</span>
    </div>
  );
}
