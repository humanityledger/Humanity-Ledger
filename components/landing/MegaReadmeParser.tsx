import React from 'react';

const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

export const MegaReadmeParser = ({ content }: { content: string }) => {
  const blocks = content.split('\n\n').filter(b => b.trim() !== '');

  return (
    <div className="w-full text-left space-y-6 md:space-y-8 mt-12 font-mono text-xs md:text-sm text-[#050505]/80">
      {blocks.map((block, idx) => {
        if (block.startsWith('## ')) {
          const title = block.replace('## ', '').trim();
          return (
            <h2 key={idx} id={slugify(title)} className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-[#050505] py-4 border-b-4 border-[#050505]/20 mt-12 mb-6 leading-tight">
              {title}
            </h2>
          );
        }
        if (block.startsWith('### ')) {
          const title = block.replace('### ', '').trim();
          return (
            <h3 key={idx} id={slugify(title)} className="text-xl md:text-2xl font-bold uppercase tracking-tight text-[#050505] border-l-4 border-[#050505] pl-4 my-6">
              {title}
            </h3>
          );
        }
        if (block.startsWith('**') && block.endsWith('**')) {
           return <div key={idx} className="bg-white text-[#FFFFFF] p-6 font-bold uppercase tracking-widest my-8 text-center">{block.replace(/\*\*/g, '')}</div>;
        }
        if (block.match(/^[0-9]+\./)) {
           return <p key={idx} className="font-bold border border-[#050505]/10 p-4 bg-[#FFFFFF]">{block}</p>;
        }
        return (
          <p key={idx} className="leading-relaxed text-left opacity-90 px-4 md:px-0">
            {block}
          </p>
        );
      })}
    </div>
  );
};
