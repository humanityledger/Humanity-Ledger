'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function CommunityRedirectPage() {
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    const slug = params?.slug as string;
    if (slug) {
      router.replace(`/chat?join=${encodeURIComponent(slug)}`);
    } else {
      router.replace('/communities');
    }
  }, [params, router]);

  return (
    <div className="min-h-screen bg-[#F6F7F9] flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-4 border-black/10 border-t-[#25D366] rounded-full animate-spin"></div>
      <p className="text-[13px] font-bold text-black/50 uppercase tracking-widest">Opening Community...</p>
    </div>
  );
}
