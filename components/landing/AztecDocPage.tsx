import React from 'react';
import Link from 'next/link';

import { MermaidDiagram } from '@/components/privacy/MermaidDiagram';

export type AztecDocSection = {
  id?: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  diagram?: { chart: string; caption?: string };
  callout?: { title: string; body: string; href?: string; hrefLabel?: string };
};

export type AztecDocPageProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  sections: AztecDocSection[];
  children?: React.ReactNode;
};

export function AztecDocPage({ eyebrow, title, subtitle, sections, children }: AztecDocPageProps) {
  return (
    <div data-doc-page className="w-full min-h-screen bg-white text-[#050505] font-sans" style={{ backgroundColor: '#ffffff', color: '#050505' }}>
      <div className="w-full max-w-[920px] mx-auto px-6 py-16 md:py-20">
        <header className="mb-14 border-b border-black/8 pb-10">
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.35em] text-[#2a1b4d]/60 mb-4">
            {eyebrow}
          </p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-[#050505] mb-5 leading-[1.05]">
            {title}
          </h1>
          <p className="text-lg md:text-xl text-[#050505]/55 max-w-3xl leading-relaxed font-light">
            {subtitle}
          </p>
          <p className="mt-6 text-[13px] text-[#050505]/40">
            Built on{' '}
            <a href="https://aztec.network" className="underline hover:text-[#050505]/70">
              Aztec
            </a>
            {' '}with{' '}
            <a href="https://noir-lang.org" className="underline hover:text-[#050505]/70">
              Noir
            </a>
            {' '}and Barretenberg proving.
          </p>
        </header>

        <div className="space-y-14">
          {sections.map((section) => (
            <section key={section.id ?? section.title} id={section.id} className="scroll-mt-24">
              <h2 className="text-2xl md:text-3xl font-black tracking-tight text-[#050505] mb-5">
                {section.title}
              </h2>
              <div className="space-y-4 text-[15px] md:text-base text-[#050505]/70 leading-relaxed">
                {section.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
              {section.bullets && section.bullets.length > 0 && (
                <ul className="mt-5 space-y-3 pl-0 list-none">
                  {section.bullets.map((b, i) => (
                    <li
                      key={i}
                      className="flex gap-3 text-[14px] md:text-[15px] text-[#050505]/65 leading-relaxed"
                    >
                      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#2a1b4d] shrink-0" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
              {section.diagram && (
                <div className="mt-8">
                  <MermaidDiagram chart={section.diagram.chart} caption={section.diagram.caption} />
                </div>
              )}
              {section.callout && (
                <div className="mt-8 rounded-2xl border border-[#2a1b4d]/15 overflow-hidden">
                  <div className="px-5 py-3 bg-[#2a1b4d]/[0.05] border-b border-[#2a1b4d]/10">
                    <p className="font-mono text-[9px] font-black uppercase tracking-[0.25em] text-[#2a1b4d]/70">
                      {section.callout.title}
                    </p>
                  </div>
                  {section.callout.body.includes('\n') ? (
                    <pre className="p-5 md:p-6 bg-[#0f0f14] overflow-x-auto text-[13px] leading-relaxed text-[#e2e8f0] font-mono whitespace-pre">
                      <code>{section.callout.body}</code>
                    </pre>
                  ) : (
                    <div className="p-5 md:p-6 bg-[#2a1b4d]/[0.02]">
                      <p className="text-[14px] text-[#050505]/65 leading-relaxed">{section.callout.body}</p>
                    </div>
                  )}
                  {section.callout.href && section.callout.hrefLabel && (
                    <div className="px-5 py-3 border-t border-[#2a1b4d]/10 bg-[#2a1b4d]/[0.03]">
                      <Link
                        href={section.callout.href}
                        className="inline-flex font-mono text-[10px] font-black uppercase tracking-widest text-[#2a1b4d] hover:text-black transition-colors"
                      >
                        {section.callout.hrefLabel} →
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </section>
          ))}
        </div>

        {children && <div className="mt-16 pt-10 border-t border-black/8">{children}</div>}
      </div>
    </div>
  );
}
