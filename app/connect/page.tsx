"use client";
import { Suspense } from 'react';
import dynamic from 'next/dynamic';

/** Shown for the moment the sign-in code loads: the same grey page and white card. */
function ConnectLoading() {
  return (
    <div
      role="status"
      aria-label="Loading sign in"
      style={{ minHeight: '100dvh', background: '#f2f3f5', padding: 12, display: 'flex' }}
    >
      <div
        style={{
          flex: 1,
          borderRadius: 28,
          background: '#fff',
          border: '1px solid rgba(16,24,40,0.06)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: '2px solid rgba(16,24,40,0.1)',
            borderTopColor: '#0A0A0A',
            animation: 'hl-connect-spin 0.9s linear infinite',
          }}
        />
        <style>{'@keyframes hl-connect-spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    </div>
  );
}

// Wallet libraries only run in the browser.
const ConnectPage = dynamic(() => import('@/components/landing/ConnectPage'), {
  ssr: false,
  loading: () => <ConnectLoading />,
});

export default function Page() {
  return (
    <Suspense fallback={<ConnectLoading />}>
      <ConnectPage />
    </Suspense>
  );
}
