'use client';

/**
 * Markdown for Studio answers. Raw HTML in the model's text is not rendered
 * (react-markdown escapes it by default), links open in a new tab without a
 * referrer, and code blocks get a copy button.
 */

import React, { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';

function CodeBlock({ lang, code, copyLabel, copiedLabel }: { lang: string; code: string; copyLabel: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="my-3 rounded-xl border border-[#e4e7ec] bg-[#f8f9fb] overflow-hidden">
      <div className="flex items-center justify-between px-3 h-8 border-b border-[#e4e7ec] bg-[#f2f4f7]">
        <span className="text-[11.5px] font-mono text-[#727a88]">{lang || 'text'}</span>
        <button
          type="button"
          onClick={() => { navigator.clipboard?.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }}
          className="flex items-center gap-1 text-[11.5px] text-[#4a505c] hover:text-[#15171c]"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? copiedLabel : copyLabel}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[12.5px] leading-[1.55] font-mono text-[#15171c]"><code>{code}</code></pre>
    </div>
  );
}

const SAFE_URL = /^(https?:|mailto:|#)/i;

function StudioMarkdownImpl({ text, copyLabel = 'Copy', copiedLabel = 'Copied' }: { text: string; copyLabel?: string; copiedLabel?: string }) {
  return (
    <div className="studio-md text-[14.5px] leading-[1.65] text-[#15171c] break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => (SAFE_URL.test(url) ? url : '')}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-[#2456d6] underline underline-offset-2 hover:text-[#1a3fa3]">{children}</a>
          ),
          code: ({ className, children, ...rest }) => {
            const m = /language-([\w+-]+)/.exec(className || '');
            const raw = String(children ?? '');
            const block = !!m || raw.includes('\n');
            if (!block) return <code className="px-1.5 py-0.5 rounded-md bg-[#eff1f4] font-mono text-[0.88em]" {...rest}>{children}</code>;
            return <CodeBlock lang={m?.[1] ?? ''} code={raw.replace(/\n$/, '')} copyLabel={copyLabel} copiedLabel={copiedLabel} />;
          },
          pre: ({ children }) => <>{children}</>,
          p: ({ children }) => <p className="my-2.5">{children}</p>,
          ul: ({ children }) => <ul className="my-2.5 pl-5 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="my-2.5 pl-5 list-decimal space-y-1">{children}</ol>,
          h1: ({ children }) => <h1 className="mt-5 mb-2 text-[20px] font-semibold tracking-[-0.01em]">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-5 mb-2 text-[17.5px] font-semibold tracking-[-0.01em]">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-4 mb-1.5 text-[15.5px] font-semibold">{children}</h3>,
          blockquote: ({ children }) => <blockquote className="my-3 border-l-[3px] border-[#d0d5dd] pl-3 text-[#4a505c]">{children}</blockquote>,
          table: ({ children }) => <div className="my-3 overflow-x-auto"><table className="w-full border-collapse text-[13.5px]">{children}</table></div>,
          th: ({ children }) => <th className="border border-[#e4e7ec] bg-[#f8f9fb] px-2.5 py-1.5 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border border-[#e4e7ec] px-2.5 py-1.5 align-top">{children}</td>,
          hr: () => <hr className="my-4 border-[#eceef2]" />,
          img: ({ alt }) => <span className="text-[#727a88]">[{alt || 'image'}]</span>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export const StudioMarkdown = memo(StudioMarkdownImpl);
