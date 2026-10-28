'use client';

/**
 * Mermaid diagrams written by Studio. The text may come from web pages the
 * model read, so the rendered SVG is never inserted into Ledger Chat's own
 * DOM: it is shown inside the same sandboxed, network-blocked iframe as HTML
 * artifacts (opaque origin, scripts disabled for this one).
 */

import React, { useEffect, useId, useState } from 'react';
import { sandboxDocument } from '@/lib/studio/artifacts';

let ready = false;

export function StudioMermaid({ chart, title }: { chart: string; title: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        if (!ready) {
          mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', flowchart: { htmlLabels: false } });
          ready = true;
        }
        const { svg: out } = await mermaid.render(`studio-mmd-${id}-${Date.now().toString(36)}`, chart.slice(0, 50_000));
        if (!cancelled) { setSvg(out); setError(''); }
      } catch (e) {
        if (!cancelled) { setSvg(''); setError(e instanceof Error ? e.message.slice(0, 300) : String(e).slice(0, 300)); }
      }
    })();
    return () => { cancelled = true; };
  }, [chart, id]);

  if (error) return <pre className="p-3 text-[12.5px] text-[#a3242a] whitespace-pre-wrap">{error}</pre>;
  if (!svg) return null;
  return (
    <iframe
      title={title}
      sandbox=""
      referrerPolicy="no-referrer"
      srcDoc={sandboxDocument({ type: 'svg', content: svg })}
      className="w-full h-full min-h-[320px] border-0 bg-white"
    />
  );
}
