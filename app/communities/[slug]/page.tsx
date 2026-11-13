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
    <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center">
      <p className="text-[13px] text-[#727A88]" role="status">Opening community…</p>
    </div>
  );
}
