import React from 'react';

interface ChatCommunityGateProps {
    onAccept: () => void;
    onDecline: () => void;
}

// The wording below is the compliance text and stays verbatim; only its presentation changed.
const TERMS: { title: string; body: string }[] = [
    {
        title: 'Zero Tolerance for Objectionable Content',
        body: 'You will not post, transmit, or share any content that is abusive, harassing, threatening, defamatory, offensive, or otherwise objectionable.',
    },
    {
        title: 'User Moderation',
        body: 'You understand that other users may report your messages. If your account is reported multiple times for violating these guidelines, your access to Ledger Chat may be permanently revoked.',
    },
    {
        title: 'Blocking',
        body: 'You have the ability to block any user. Blocked users will not be able to contact you.',
    },
];

export function ChatCommunityGate({ onAccept, onDecline }: ChatCommunityGateProps) {
    return (
        <div
            className="fixed inset-0 z-[500] bg-white text-[#0b0c0e] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="community-gate-title"
            style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
            <div className="min-h-full flex items-center justify-center px-6 py-12">
                <div className="w-full max-w-[440px] animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <p className="text-[13px] font-medium tracking-[0.01em] text-[#8a909c]">Ledger Chat</p>
                    <h2 id="community-gate-title" className="mt-3 text-[30px] sm:text-[34px] leading-[1.08] font-semibold tracking-[-0.03em]">
                        Community Guidelines
                    </h2>
                    <p className="mt-4 text-[15px] leading-[1.6] text-[#4a505c]">
                        By using LedgerChat, you agree to the following terms required for compliance:
                    </p>

                    <ol className="mt-8 border-t border-[#eceef2]">
                        {TERMS.map((t, i) => (
                            <li key={t.title} className="grid grid-cols-[32px_1fr] gap-x-2 py-5 border-b border-[#eceef2]">
                                <span className="text-[13px] font-medium tabular-nums text-[#a3a9b4] pt-[3px]">{i + 1}.</span>
                                <div>
                                    <p className="text-[15px] font-semibold leading-[1.4] tracking-[-0.01em]">{t.title}</p>
                                    <p className="mt-1.5 text-[14px] leading-[1.6] text-[#5b6170]">{t.body}</p>
                                </div>
                            </li>
                        ))}
                    </ol>

                    <p className="mt-6 text-[13px] leading-[1.6] text-[#727a88]">
                        By clicking &quot;I Agree&quot;, you acknowledge that you have read and agree to these terms, and understand that violations will result in loss of access.
                    </p>

                    <div className="mt-8 flex flex-col gap-2">
                        <button
                            type="button"
                            onClick={onAccept}
                            autoFocus
                            className="h-[52px] w-full rounded-full bg-[#0b0c0e] text-white text-[15px] font-semibold tracking-[-0.01em] transition-[background-color,transform] duration-200 hover:bg-[#23262d] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-2"
                        >
                            I Agree
                        </button>
                        <button
                            type="button"
                            onClick={onDecline}
                            className="h-[48px] w-full rounded-full text-[15px] font-medium text-[#5b6170] transition-colors hover:bg-[#f2f4f7] hover:text-[#0b0c0e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
                        >
                            Decline
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
