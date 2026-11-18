'use client';

/**
 * /u#<token> — a Ledger Chat profile link (lib/chat/usernames.ts).
 *
 * The token sits after "#", so it never reaches a server, a log or a link preview. This page only
 * hands it to the chat, which opens the conversation once the person is signed in.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ProfileLinkPage() {
  const router = useRouter();
  const [bad, setBad] = useState(false);
  useEffect(() => {
    const token = window.location.hash.slice(1);
    if (/^[A-Za-z0-9_-]{22}$/.test(token)) router.replace(`/chat#u=${token}`);
    else setBad(true);
  }, [router]);
  return (
    <main className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <p className="text-[17px] font-semibold text-[#15171c]">{bad ? 'This link is not complete' : 'Opening Ledger Chat…'}</p>
        <p className="mt-2 text-[14px] text-[#5b606b] leading-relaxed">
          {bad ? 'Ask the person for their link or QR code again.' : 'Sign in, and the chat with the person who shared this link opens.'}
        </p>
      </div>
    </main>
  );
}
