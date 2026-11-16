'use client';

/**
 * /studio is closed. The studio application is not loaded.
 * A direct link lands here and cannot start a session, a prompt, or a model call.
 */

export default function StudioPage() {
  return (
    <main
      className="h-[100dvh] flex flex-col items-center justify-center gap-3 bg-white px-6 text-center"
      aria-disabled="true"
    >
      <span
        aria-hidden="true"
        className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#fdf3f2]"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e5484d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      </span>
      <h1 className="text-[18px] font-semibold text-[#15171c]">Ledger Studio is closed</h1>
      <p className="max-w-sm text-[14px] leading-relaxed text-[#4a505c]">
        It is not available. Nothing on this page can be opened, typed into, or sent.
      </p>
      <a href="/chat" className="mt-2 text-[14px] font-semibold text-[#15171c] underline">
        Back to Ledger Chat
      </a>
    </main>
  );
}
