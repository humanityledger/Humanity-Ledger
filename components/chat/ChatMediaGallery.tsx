import React, { useMemo, useState } from 'react';
import { File, Video, Music, Image as ImageIcon, X, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatMediaGalleryProps {
  messages: any[];
  onClose: () => void;
  onOpenLightbox: (url: string) => void;
}

export function ChatMediaGallery({ messages, onClose, onOpenLightbox }: ChatMediaGalleryProps) {
  const [activeTab, setActiveTab] = useState<'media' | 'docs' | 'links'>('media');

  const { media, docs, links } = useMemo(() => {
    const m: any[] = [];
    const d: any[] = [];
    const l: any[] = [];

    messages.forEach(msg => {
      const txt = msg.content;
      if (!txt) return;

      // Extract Attachments
      if (txt.startsWith('[ATTACHMENT:')) {
        const match = txt.match(/\[ATTACHMENT:(.*?)\](.*?)\|(.*)/);
        if (match) {
          const type = match[1];
          const url = match[2];
          const name = match[3];
          if (type.startsWith('image/') || type.startsWith('video/')) {
            m.push({ id: msg.id, type, url, name, time: msg.sentAtNs || msg.sent });
          } else {
            d.push({ id: msg.id, type, url, name, time: msg.sentAtNs || msg.sent });
          }
        }
      }

      // Extract GIFs
      if (txt.startsWith('[GIF]')) {
        const match = txt.match(/\[GIF\](.*)/);
        if (match) {
          m.push({ id: msg.id, type: 'image/gif', url: match[1], name: 'GIF', time: msg.sentAtNs || msg.sent });
        }
      }

      // Extract Links
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const foundLinks = txt.match(urlRegex);
      if (foundLinks && !txt.startsWith('[ATTACHMENT') && !txt.startsWith('[GIF]')) {
        foundLinks.forEach((url: string) => l.push({ id: msg.id, url, text: txt, time: msg.sentAtNs || msg.sent }));
      }
    });

    return { media: m.reverse(), docs: d.reverse(), links: l.reverse() };
  }, [messages]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute inset-0 bg-[#f4f4f4] z-50 flex flex-col h-full"
    >
      <div className="flex items-center justify-between p-4 bg-white border-b border-black/10 shadow-sm">
        <h2 className="text-[18px] font-black tracking-tight text-black uppercase">Shared Content</h2>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-black/5 rounded-full hover:bg-black/10 transition-colors">
          <X size={18} className="text-black" />
        </button>
      </div>

      <div className="flex bg-white border-b border-black/10">
        {[
          { id: 'media', label: 'Media', count: media.length },
          { id: 'docs', label: 'Docs', count: docs.length },
          { id: 'links', label: 'Links', count: links.length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-3 text-[13px] font-bold uppercase tracking-widest relative transition-colors ${activeTab === tab.id ? 'text-black' : 'text-black/40 hover:text-black/70'}`}
          >
            {tab.label} <span className="opacity-50 text-[10px] ml-1">({tab.count})</span>
            {activeTab === tab.id && (
              <motion.div layoutId="mediaTab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-black" />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="popLayout">
          {activeTab === 'media' && (
            <motion.div key="media" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-3 gap-2">
              {media.length === 0 && <p className="col-span-3 text-center text-black/40 font-mono text-sm py-10">No media shared.</p>}
              {media.map(item => (
                <button
                  key={item.id}
                  onClick={() => item.type.startsWith('image/') ? onOpenLightbox(item.url) : window.open(item.url)}
                  className="aspect-square bg-white border border-black/5 relative overflow-hidden group rounded-[8px]"
                >
                  {item.type.startsWith('video/') ? (
                    <>
                      <video src={item.url} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                        <Video size={24} className="text-white drop-shadow-md" />
                      </div>
                    </>
                  ) : (
                    <img src={item.url} alt="media" className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                  )}
                </button>
              ))}
            </motion.div>
          )}

          {activeTab === 'docs' && (
            <motion.div key="docs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-2">
              {docs.length === 0 && <p className="text-center text-black/40 font-mono text-sm py-10">No documents shared.</p>}
              {docs.map(item => (
                <a key={item.id} href={item.url} download={item.name} className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-black/5 hover:border-black/20 transition-all active:scale-[0.98]">
                  <div className="w-10 h-10 rounded-full bg-[#25D366]/10 flex items-center justify-center text-[#25D366]">
                    {item.type.includes('audio') ? <Music size={20} /> : <File size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-black truncate">{item.name}</p>
                    <p className="text-[11px] font-mono text-black/40 uppercase mt-0.5">{(item.type.split('/')[1] || 'FILE').substring(0,6)}</p>
                  </div>
                  <Download size={16} className="text-black/30" />
                </a>
              ))}
            </motion.div>
          )}

          {activeTab === 'links' && (
            <motion.div key="links" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-2">
              {links.length === 0 && <p className="text-center text-black/40 font-mono text-sm py-10">No links shared.</p>}
              {links.map((item, i) => (
                <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-white p-3 rounded-xl border border-black/5 hover:bg-black/5 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center">
                    <span className="text-black/40 text-[10px] font-bold">🔗</span>
                  </div>
                  <p className="text-[12px] font-mono text-black break-all line-clamp-2">{item.url}</p>
                </a>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
