'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function DeviceLinkPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing device link...');

  useEffect(() => {
    const token = params.get('token');
    const action = params.get('action');

    if (action === 'device' && token) {
      // Import device bundle
      fetch('/api/device/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'claim', token })
      })
        .then(r => r.json())
        .then(data => {
          if (data.bundle) {
            const bundle = JSON.parse(atob(data.bundle));
            for (const [k, v] of Object.entries(bundle.settings || {})) {
              localStorage.setItem(k, v as string);
            }
            setStatus('success');
            setMessage('Device linked successfully! Redirecting...');
            setTimeout(() => router.push('/chat'), 2000);
          } else {
            setStatus('error');
            setMessage(data.error || 'Link expired or invalid.');
          }
        })
        .catch(() => { setStatus('error'); setMessage('Failed to claim link.'); });
    } else {
      setStatus('error');
      setMessage('Invalid link parameters.');
    }
  }, [params, router]);

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-lg text-center">
        <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
          style={{ background: status === 'success' ? '#25D366' : status === 'error' ? '#FF3B30' : '#F2F2F7' }}>
          {status === 'loading' && <div className="w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />}
          {status === 'success' && <span className="text-2xl text-white">✓</span>}
          {status === 'error' && <span className="text-2xl text-white">✗</span>}
        </div>
        <h2 className="text-[20px] font-bold text-[#1C1C1E] mb-2">Device Link</h2>
        <p className="text-[14px] text-[#8E8E93]">{message}</p>
        {status === 'error' && (
          <button onClick={() => router.push('/chat')} className="mt-4 px-6 py-3 bg-[#25D366] text-white font-bold rounded-2xl">
            Go to Chat
          </button>
        )}
      </div>
    </div>
  );
}
