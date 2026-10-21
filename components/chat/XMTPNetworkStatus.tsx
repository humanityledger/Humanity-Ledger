'use client';
import React from 'react';

export function XMTPNetworkStatus({ status }: { status: 'connected' | 'connecting' | 'disconnected' }) {
  const colors = {
    connected: 'bg-emerald-500',
    connecting: 'bg-amber-500 animate-pulse',
    disconnected: 'bg-rose-500',
  };
  return (
    <div className="flex items-center gap-1.5 text-xs text-neutral-600 font-mono">
      <span className={`w-2 h-2 rounded-full ${colors[status]}`} />
      <span className="capitalize">{status}</span>
    </div>
  );
}
