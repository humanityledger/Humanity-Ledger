'use client';
import React, { useState } from 'react';

export function XMTPInstallations({ installations = [] }: { installations: any[] }) {
  const [list, setList] = useState(installations);
  return (
    <div className="space-y-4">
      <h3 className="font-bold text-base">Connected Devices & Installations</h3>
      <p className="text-xs text-neutral-500">Manage client devices authorized to receive MLS messages.</p>
      <div className="divide-y divide-neutral-200">
        {list.map((inst, i) => (
          <div key={i} className="py-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">{inst.name || 'Browser Session'}</div>
              <div className="text-xs font-mono text-neutral-400">{inst.id?.slice(0, 16)}...</div>
            </div>
            <button className="text-xs font-bold text-rose-600 hover:text-rose-700">Revoke</button>
          </div>
        ))}
      </div>
    </div>
  );
}
