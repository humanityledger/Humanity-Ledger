'use client';

import React, { useEffect, useId, useState } from 'react';

type Props = { chart: string; caption?: string };

// Theme config injected as %%{init}%% frontmatter — guaranteed per-diagram override
const THEME_INIT = {
  theme: 'base',
  themeVariables: {
    primaryColor: '#ffffff',
    primaryTextColor: '#111111',
    primaryBorderColor: '#444444',
    secondaryColor: '#f5f5f5',
    tertiaryColor: '#f5f5f5',
    lineColor: '#444444',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    fontSize: '14px',
    nodeBorder: '#444444',
    clusterBkg: '#f5f5f5',
    clusterBorder: '#aaaaaa',
    edgeLabelBackground: '#ffffff',
    nodeTextColor: '#111111',
    labelTextColor: '#111111',
    // sequence diagram
    actorBorder: '#444444',
    actorBkg: '#ffffff',
    actorTextColor: '#111111',
    actorLineColor: '#777777',
    signalColor: '#444444',
    signalTextColor: '#111111',
    noteBorderColor: '#cccccc',
    noteBkgColor: '#fffde7',
    noteTextColor: '#333333',
    activationBorderColor: '#444444',
    activationBkgColor: '#eeeeee',
  },
  flowchart: { htmlLabels: true },
};

// Scoped CSS injected INSIDE the SVG element — wins against any external stylesheet including Tailwind preflight
const SVG_SCOPED_CSS = `
  /* Force text visibility for BOTH SVG native text AND foreignObject HTML labels */
  text, tspan, .label, .nodeLabel, .edgeLabel, .cluster-label { 
    fill: #111111 !important; 
    color: #111111 !important; 
    font-family: Inter, ui-sans-serif, system-ui, sans-serif !important; 
  }
  .nodeLabel *, .edgeLabel * {
    color: #111111 !important;
  }
  .node rect, .node polygon { fill: #ffffff !important; stroke: #444444 !important; stroke-width: 1.5px !important; }
  .node circle, .node ellipse { fill: #ffffff !important; stroke: #444444 !important; stroke-width: 1.5px !important; }
  .node path { fill: #ffffff !important; stroke: #444444 !important; stroke-width: 1.5px !important; }
  .cluster rect { fill: #f5f5f5 !important; stroke: #aaaaaa !important; stroke-width: 1px !important; }
  .cluster text, .cluster-label text { fill: #333333 !important; }
  .edgePath .path { stroke: #444444 !important; fill: none !important; stroke-width: 1.5px !important; }
  .flowchart-link { stroke: #444444 !important; fill: none !important; }
  .arrowheadPath { fill: #444444 !important; stroke: none !important; }
  .marker { fill: #444444 !important; stroke: #444444 !important; }
  .edgeLabel { background: #ffffff !important; }
  .edgeLabel rect, .labelBkg { fill: #ffffff !important; opacity: 0.85 !important; }
  .edgeLabel text, .edgeLabel tspan { fill: #111111 !important; }
  /* sequence diagram */
  .actor { fill: #ffffff !important; stroke: #444444 !important; stroke-width: 1.5px !important; }
  .actor-line { stroke: #888888 !important; stroke-width: 1px !important; }
  .messageLine0, .messageLine1 { stroke: #444444 !important; fill: none !important; }
  .messageText { fill: #111111 !important; }
  .labelBox { fill: #f5f5f5 !important; stroke: #cccccc !important; }
  .labelText { fill: #111111 !important; }
  .loopText, .loopLine { fill: #111111 !important; stroke: #aaaaaa !important; }
  .note { fill: #fffde7 !important; stroke: #cccccc !important; }
  .noteText { fill: #333333 !important; }
  .activation0, .activation1, .activation2 { fill: #eeeeee !important; stroke: #444444 !important; }
  .sequenceNumber { fill: #ffffff !important; }
`;

let mermaidReady = false;

export function MermaidDiagram({ chart, caption }: Props) {
  const reactId = useId().replace(/:/g, '');
  const [svg, setSvg] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;

        // B-029: Initialize with securityLevel: 'strict' to prevent XSS via embedded scripts
        if (!mermaidReady) {
          mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
          mermaidReady = true;
        }

        // Prepend %%{init}%% so every chart carries its own theme regardless of global state
        const finalChart = `%%{init: ${JSON.stringify(THEME_INIT)}}%%\n${chart.trim()}`;
        const diagramId = `mmd-${reactId}-${Math.random().toString(36).substring(2, 9)}`;

        const { svg: raw } = await mermaid.render(diagramId, finalChart);

        if (!cancelled) {
          // Step 1: inject our scoped CSS override as a <style> tag inside the SVG
          // This beats Tailwind preflight and any external global styles
          const withStyles = raw.replace(
            /(<svg[^>]*>)/,
            `$1<style id="mmd-override">${SVG_SCOPED_CSS}</style>`,
          );

          // Step 2: make the SVG fully responsive
          // Remove mermaid's hardcoded width/height/max-width and let CSS handle sizing
          const responsive = withStyles
            .replace(/\sheight="[^"]*"/g, '')
            .replace(/\swidth="[^"]*"/g, '')
            .replace(/\sstyle="[^"]*max-width[^"]*"/g, 'style="width:100%;height:auto;display:block;"');

          setSvg(responsive);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setSvg('');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart, reactId]);

  return (
    <figure
      style={{
        margin: '40px 0',
        border: '1px solid rgba(0,0,0,0.1)',
        borderRadius: '4px',
        background: '#ffffff',
        overflow: 'hidden',
      }}
    >
      {/* overflow-x:auto so wide diagrams scroll on mobile instead of clipping */}
      <div
        style={{
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: '32px 24px',
          minHeight: '160px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {error ? (
          <pre
            style={{
              fontSize: '11px',
              color: '#cc0000',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxWidth: '100%',
            }}
          >
            {error}
          </pre>
        ) : svg ? (
          <div
            style={{ width: '100%', lineHeight: 1 }}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Mermaid SVG is trusted output
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.3em',
              color: 'rgba(0,0,0,0.2)',
            }}
          >
            Rendering…
          </span>
        )}
      </div>

      {caption && (
        <figcaption
          style={{
            padding: '10px 20px',
            borderTop: '1px solid rgba(0,0,0,0.06)',
            fontFamily: 'monospace',
            fontSize: '9px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.25em',
            color: 'rgba(0,0,0,0.35)',
          }}
        >
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
