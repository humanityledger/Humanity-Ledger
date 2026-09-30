"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  WHITEPAPER_SECTIONS, MANIFESTO_SECTIONS, TOKENOMICS_SECTIONS, 
  DEVELOPER_SECTIONS, SECURITY_SECTIONS, ROADMAP_SECTIONS, 
  API_REFERENCE_SECTIONS, NOIR_CIRCUITS_SECTIONS 
} from '@/lib/content/footerPagesAztec';

// We need to group all docs
const ALL_DOCS = [
  { id: 'manifesto', title: 'Manifesto', sections: MANIFESTO_SECTIONS },
  { id: 'whitepaper', title: 'Whitepaper', sections: WHITEPAPER_SECTIONS },
  { id: 'tokenomics', title: 'Tokenomics', sections: TOKENOMICS_SECTIONS },
  { id: 'developer', title: 'Developer Guide', sections: DEVELOPER_SECTIONS },
  { id: 'api-reference', title: 'API Reference', sections: API_REFERENCE_SECTIONS },
  { id: 'noir-circuits', title: 'Noir Circuits', sections: NOIR_CIRCUITS_SECTIONS },
  { id: 'security', title: 'Security', sections: SECURITY_SECTIONS },
  { id: 'roadmap', title: 'Roadmap', sections: ROADMAP_SECTIONS },
];

export default function UnifiedDocsPage() {
  const [activeId, setActiveId] = useState('');

  // Simple intersection observer to highlight sidebar
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -80% 0px' }
    );
    
    document.querySelectorAll('section[id], div[id]').forEach((section) => {
      observer.observe(section);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="w-full min-h-screen bg-white text-[#050505] font-sans flex flex-col md:flex-row overflow-x-hidden">
      {/* LEFT SIDEBAR */}
      <aside className="w-full md:w-[280px] shrink-0 border-r border-[#E8E8E8] md:h-screen md:sticky top-0 overflow-y-auto bg-[#FAFAFA] pt-12 md:pt-20 pb-10">
        <div className="px-6 mb-6 flex flex-col gap-4">
          <Link href="/" className="text-[12px] font-bold text-black/50 hover:text-black transition-colors flex items-center gap-2">
            <span>←</span> Back to Home
          </Link>
          <h2 className="text-[12px] font-black uppercase tracking-widest text-[#050505] mt-4">Documentation</h2>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {ALL_DOCS.map(doc => (
            <div key={doc.id} className="mb-4">
              <a 
                href={`#${doc.id}`}
                className={`block px-3 py-1.5 text-[14px] font-bold rounded-lg transition-colors ${activeId === doc.id || activeId.startsWith(doc.id + '-') ? 'bg-black/5 text-black' : 'text-black/60 hover:bg-black/5'}`}
              >
                {doc.title}
              </a>
              <div className="flex flex-col mt-1 ml-2 pl-3 border-l border-black/10">
                {doc.sections.map((sec, idx) => {
                  const secId = sec.id || `${doc.id}-sec-${idx}`;
                  return (
                    <a
                      key={secId}
                      href={`#${secId}`}
                      className={`block px-2 py-1 text-[12.5px] rounded-md transition-colors ${activeId === secId ? 'text-black font-semibold' : 'text-black/50 hover:text-black hover:bg-black/5'}`}
                    >
                      {sec.title}
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 max-w-[920px] mx-auto px-6 py-16 md:py-24 overflow-x-hidden">
        <header className="mb-14 border-b border-black/8 pb-10">
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.35em] text-[#050505]/60 mb-4">
            Master Documentation
          </p>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-[#050505] mb-5 leading-[1.05]">
            Knowledge Base
          </h1>
          <p className="text-lg md:text-xl text-[#050505]/55 max-w-3xl leading-relaxed font-light">
            Everything you need to build, integrate, and verify on the Humanity Ledger protocol. All documentation in one place.
          </p>
        </header>

        <div className="space-y-24">
          {ALL_DOCS.map(doc => (
            <div key={doc.id} id={doc.id} className="scroll-mt-24 space-y-16 pt-8 border-t-2 border-black/5 first:border-0 first:pt-0">
              <h2 className="text-3xl md:text-5xl font-black tracking-tight text-[#050505] mb-8">
                {doc.title}
              </h2>
              
              <div className="space-y-14">
                {doc.sections.map((section, idx) => {
                  const secId = section.id || `${doc.id}-sec-${idx}`;
                  return (
                    <section key={secId} id={secId} className="scroll-mt-24">
                      <h3 className="text-2xl md:text-3xl font-black tracking-tight text-[#050505] mb-5">
                        {section.title}
                      </h3>
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
                              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {section.callout && (
                        <div className="mt-8 p-6 md:p-8 rounded-2xl border border-[#050505]/15 bg-white/[0.03]">
                          <p className="font-mono text-[9px] font-black uppercase tracking-[0.25em] text-[#050505]/70 mb-2">
                            {section.callout.title}
                          </p>
                          <p className="text-[14px] text-[#050505]/65 leading-relaxed mb-4">{section.callout.body}</p>
                          {section.callout.href && section.callout.hrefLabel && (
                            <a
                              href={section.callout.href}
                              className="inline-flex font-mono text-[10px] font-black uppercase tracking-widest text-[#050505] hover:opacity-70 transition-opacity"
                            >
                              {section.callout.hrefLabel} →
                            </a>
                          )}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
