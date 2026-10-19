'use client';

/**
 * ═════════════════════════════════════════════════════════════════════════════
 *  RichPostEditor — Ledger Chat Native Post Composer
 *  Full-featured, dependency-free rich text editor for Communities & Group announcements
 *  Pure HTML5 contentEditable · Framer Motion · Tailwind CSS
 *
 *  Features:
 *  ─ Bold, Italic, Underline, Strikethrough
 *  ─ H1, H2, H3 headings, Paragraph
 *  ─ Bullet list, Ordered list
 *  ─ Blockquote, Code block, Inline code
 *  ─ Hyperlinks (modal input)
 *  ─ Text highlight (8 colours)
 *  ─ Text colour (8 colours)
 *  ─ Align left / centre / right / justify
 *  ─ Subscript / Superscript
 *  ─ Horizontal divider
 *  ─ Image upload (base64 inline)
 *  ─ Character + word counter
 *  ─ Undo / Redo with keyboard shortcuts (⌘Z / ⌘⇧Z)
 *  ─ Full-screen mode
 *  ─ Preview mode (rendered HTML)
 *  ─ Instant publish or cancel
 * ═════════════════════════════════════════════════════════════════════════════
 */

import React, {
  useState, useRef, useCallback, useEffect,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bold, Italic, Underline, Strikethrough,
  Link2, Image as ImageIcon, Code, AlignLeft, AlignCenter,
  AlignRight, AlignJustify, List, ListOrdered,
  Quote, Heading1, Heading2, Heading3,
  Highlighter, Palette, Subscript, Superscript,
  Minus, Undo2, Redo2, Maximize2, Minimize2,
  Eye, EyeOff, Send, X,
  ZapIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { safeHTML } from '@/hooks/useSanitizer';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const HIGHLIGHT_COLORS = [
  { label: 'Yellow', value: '#FEF08A' },
  { label: 'Green', value: '#BBF7D0' },
  { label: 'Blue', value: '#BFDBFE' },
  { label: 'Pink', value: '#FBCFE8' },
  { label: 'Orange', value: '#FED7AA' },
  { label: 'Purple', value: '#E9D5FF' },
  { label: 'Red', value: '#FECACA' },
  { label: 'Teal', value: '#99F6E4' },
];

const TEXT_COLORS = [
  { label: 'Default', value: '#1C1C1E' },
  { label: 'Blue', value: '#2563EB' },
  { label: 'Green', value: '#16A34A' },
  { label: 'Red', value: '#DC2626' },
  { label: 'Orange', value: '#EA580C' },
  { label: 'Purple', value: '#9333EA' },
  { label: 'Gray', value: '#6B7280' },
  { label: 'Cyan', value: '#0891B2' },
];

// ─── TOOLBAR BUTTON ──────────────────────────────────────────────────────────

function TB({
  icon: Icon, label, onClick, active = false, disabled = false, danger = false,
}: {
  icon: any;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      onMouseDown={(e) => {
        // Prevent losing focus from contentEditable
        e.preventDefault();
        onClick(e);
      }}
      disabled={disabled}
      className={`
        relative flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150
        ${active
          ? 'bg-[#1C1C1E] text-white shadow-sm'
          : danger
          ? 'text-red-500 hover:bg-red-50'
          : 'text-[#1C1C1E]/60 hover:text-[#1C1C1E] hover:bg-black/5'
        }
        disabled:opacity-30 disabled:cursor-not-allowed
      `}
    >
      <Icon size={15} strokeWidth={2} />
    </button>
  );
}

// ─── DIVIDER ─────────────────────────────────────────────────────────────────
function TDiv() {
  return <div className="w-px h-5 bg-black/10 mx-0.5 shrink-0" />;
}

// ─── COLOUR PICKER POPUP ─────────────────────────────────────────────────────
function ColorPicker({
  colors, onSelect, onClose, label,
}: { colors: typeof HIGHLIGHT_COLORS; onSelect: (v: string) => void; onClose: () => void; label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.96 }}
      className="absolute top-full left-0 mt-1 z-50 bg-white border border-black/10 rounded-xl shadow-2xl p-3 w-48"
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-2">{label}</p>
      <div className="grid grid-cols-4 gap-1.5">
        {colors.map((c) => (
          <button
            key={c.value}
            type="button"
            title={c.label}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(c.value);
              onClose();
            }}
            className="w-8 h-8 rounded-lg border-2 border-white hover:scale-110 transition-transform shadow-sm"
            style={{ backgroundColor: c.value }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ─── MAIN EDITOR PROPS ───────────────────────────────────────────────────────

export interface RichPostEditorProps {
  /** Called with { html, text, json, title } when user submits */
  onPublish: (content: { html: string; text: string; json: any; title?: string }) => void | Promise<void>;
  /** Optional title for the modal */
  title?: string;
  /** Optional initial content (HTML) */
  initialContent?: string;
  /** Placeholder inside the editor */
  placeholder?: string;
  /** Max character limit */
  maxChars?: number;
  /** Community or group name shown in the header */
  communityName?: string;
  onClose?: () => void;
}

export function RichPostEditor({
  onPublish,
  title = 'New Post',
  initialContent = '',
  placeholder = 'Write your post here... Use the toolbar above to format headings, quotes, and links.',
  maxChars = 4096,
  communityName,
  onClose,
}: RichPostEditorProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [charCount, setCharCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [htmlContent, setHtmlContent] = useState(initialContent);

  const editorRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  // Sync initial content on mount
  useEffect(() => {
    if (editorRef.current && initialContent) {
      editorRef.current.innerHTML = initialContent;
      updateStats();
    }
  }, [initialContent]);

  const updateStats = useCallback(() => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText || '';
    setCharCount(text.length);
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    setWordCount(words);
    setHtmlContent(editorRef.current.innerHTML);
  }, []);

  // Format execution helper using document.execCommand
  const exec = useCallback((command: string, value: string | undefined = undefined) => {
    if (typeof document === 'undefined') return;
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    updateStats();
  }, [updateStats]);

  // Close pickers on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element)?.closest('[data-picker]')) {
        setShowHighlightPicker(false);
        setShowColorPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      if (src) {
        exec('insertHTML', `<img src="${src}" alt="Uploaded image" style="max-width:100%; border-radius:12px; margin:12px 0;" />`);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [exec]);

  const setLink = useCallback(() => {
    if (!linkUrl.trim()) {
      exec('unlink');
    } else {
      const finalUrl = linkUrl.startsWith('http://') || linkUrl.startsWith('https://')
        ? linkUrl
        : `https://${linkUrl}`;
      exec('createLink', finalUrl);
    }
    setShowLinkInput(false);
    setLinkUrl('');
  }, [exec, linkUrl]);

  const handlePublish = async () => {
    const html = editorRef.current?.innerHTML || htmlContent;
    const text = editorRef.current?.innerText || '';
    if (!text.trim() && !postTitle.trim()) {
      toast.error('Post content or title cannot be empty');
      return;
    }
    setPublishing(true);
    try {
      await onPublish({
        html,
        text,
        json: { type: 'doc', content: html },
        title: postTitle.trim() || 'Community Post',
      });
    } finally {
      setPublishing(false);
    }
  };

  const isOverLimit = charCount > maxChars * 0.9;

  return (
    <div
      className={`
        flex flex-col bg-white transition-all duration-300
        ${isFullscreen
          ? 'fixed inset-0 z-[99999]'
          : 'relative w-full h-full rounded-2xl overflow-hidden border border-black/8 shadow-2xl'
        }
      `}
    >
      {/* ── HEADER ── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-black/8 bg-white/95 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors"
            >
              <X size={16} className="text-black/50" />
            </button>
          )}
          <div>
            <p className="text-[13px] font-bold text-[#1C1C1E] leading-tight">{title}</p>
            {communityName && (
              <p className="text-[11px] text-black/40 font-medium">{communityName}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (!isPreview && editorRef.current) {
                setHtmlContent(editorRef.current.innerHTML);
              }
              setIsPreview(p => !p);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all ${isPreview ? 'bg-[#1C1C1E] text-white' : 'text-black/50 hover:bg-black/5'}`}
          >
            {isPreview ? <EyeOff size={13} /> : <Eye size={13} />}
            {isPreview ? 'Edit' : 'Preview'}
          </button>
          <button
            type="button"
            onClick={() => setIsFullscreen(f => !f)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-black/40 hover:bg-black/5 hover:text-black/70 transition-all"
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </div>

      {/* ── POST TITLE INPUT ── */}
      <div className="shrink-0 px-5 pt-4 pb-0">
        <input
          value={postTitle}
          onChange={e => setPostTitle(e.target.value)}
          placeholder="Post title (optional)"
          className="w-full text-[22px] font-bold text-[#1C1C1E] placeholder:text-black/25 outline-none bg-transparent leading-tight"
        />
      </div>

      {/* ── TOOLBAR ── */}
      {!isPreview && (
        <div className="shrink-0 border-b border-black/6 bg-[#FAFAFA] px-2 py-2">
          <div className="flex items-center gap-0.5 flex-wrap">
            <TB icon={Undo2} label="Undo (⌘Z)" onClick={() => exec('undo')} />
            <TB icon={Redo2} label="Redo (⌘⇧Z)" onClick={() => exec('redo')} />
            <TDiv />

            <TB icon={Heading1} label="Heading 1" onClick={() => exec('formatBlock', '<h1>')} />
            <TB icon={Heading2} label="Heading 2" onClick={() => exec('formatBlock', '<h2>')} />
            <TB icon={Heading3} label="Heading 3" onClick={() => exec('formatBlock', '<h3>')} />
            <TDiv />

            <TB icon={Bold} label="Bold (⌘B)" onClick={() => exec('bold')} />
            <TB icon={Italic} label="Italic (⌘I)" onClick={() => exec('italic')} />
            <TB icon={Underline} label="Underline (⌘U)" onClick={() => exec('underline')} />
            <TB icon={Strikethrough} label="Strikethrough" onClick={() => exec('strikeThrough')} />
            <TB icon={Code} label="Inline code" onClick={() => exec('insertHTML', '<code>' + (window.getSelection()?.toString() || 'code') + '</code>')} />
            <TDiv />

            {/* Highlight colour picker */}
            <div className="relative" data-picker>
              <button
                type="button"
                title="Highlight text"
                onClick={() => { setShowHighlightPicker(p => !p); setShowColorPicker(false); }}
                className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${showHighlightPicker ? 'bg-[#1C1C1E] text-white' : 'text-black/60 hover:bg-black/5'}`}
              >
                <Highlighter size={15} />
              </button>
              <AnimatePresence>
                {showHighlightPicker && (
                  <ColorPicker
                    colors={HIGHLIGHT_COLORS}
                    label="Highlight"
                    onSelect={(v) => exec('hiliteColor', v)}
                    onClose={() => setShowHighlightPicker(false)}
                  />
                )}
              </AnimatePresence>
            </div>

            {/* Text colour picker */}
            <div className="relative" data-picker>
              <button
                type="button"
                title="Text colour"
                onClick={() => { setShowColorPicker(p => !p); setShowHighlightPicker(false); }}
                className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${showColorPicker ? 'bg-[#1C1C1E] text-white' : 'text-black/60 hover:bg-black/5'}`}
              >
                <Palette size={15} />
              </button>
              <AnimatePresence>
                {showColorPicker && (
                  <ColorPicker
                    colors={TEXT_COLORS}
                    label="Text colour"
                    onSelect={(v) => exec('foreColor', v)}
                    onClose={() => setShowColorPicker(false)}
                  />
                )}
              </AnimatePresence>
            </div>
            <TDiv />

            {/* Align */}
            <TB icon={AlignLeft} label="Align left" onClick={() => exec('justifyLeft')} />
            <TB icon={AlignCenter} label="Align center" onClick={() => exec('justifyCenter')} />
            <TB icon={AlignRight} label="Align right" onClick={() => exec('justifyRight')} />
            <TB icon={AlignJustify} label="Justify" onClick={() => exec('justifyFull')} />
            <TDiv />

            {/* Lists */}
            <TB icon={List} label="Bullet list" onClick={() => exec('insertUnorderedList')} />
            <TB icon={ListOrdered} label="Numbered list" onClick={() => exec('insertOrderedList')} />
            <TDiv />

            {/* Block elements */}
            <TB icon={Quote} label="Blockquote" onClick={() => exec('formatBlock', '<blockquote>')} />
            <TB icon={ZapIcon} label="Code block" onClick={() => exec('insertHTML', '<pre><code>' + (window.getSelection()?.toString() || 'Code block') + '</code></pre>')} />
            <TB icon={Minus} label="Horizontal rule" onClick={() => exec('insertHorizontalRule')} />
            <TDiv />

            {/* Sub/Superscript */}
            <TB icon={Subscript} label="Subscript" onClick={() => exec('subscript')} />
            <TB icon={Superscript} label="Superscript" onClick={() => exec('superscript')} />
            <TDiv />

            {/* Link */}
            <div className="relative">
              <TB
                icon={Link2}
                label="Insert link"
                onClick={() => setShowLinkInput(l => !l)}
                active={showLinkInput}
              />
              <AnimatePresence>
                {showLinkInput && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="absolute top-full left-0 mt-1 z-50 bg-white border border-black/10 rounded-xl shadow-xl p-2 flex gap-2 w-72"
                  >
                    <input
                      autoFocus
                      value={linkUrl}
                      onChange={e => setLinkUrl(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') setLink(); if (e.key === 'Escape') setShowLinkInput(false); }}
                      placeholder="https://..."
                      className="flex-1 text-[12px] px-2 py-1.5 rounded-lg border border-black/10 outline-none focus:border-[#2563EB] text-[#1C1C1E]"
                    />
                    <button
                      type="button"
                      onClick={setLink}
                      className="px-3 py-1.5 bg-[#1C1C1E] text-white text-[11px] font-bold rounded-lg hover:opacity-80"
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      onClick={() => { exec('unlink'); setShowLinkInput(false); }}
                      className="px-2 py-1.5 text-red-500 hover:bg-red-50 rounded-lg text-[11px] font-bold"
                    >
                      Remove
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Image upload */}
            <button
              type="button"
              title="Insert image"
              onClick={() => imageRef.current?.click()}
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-all text-black/60 hover:bg-black/5 hover:text-[#1C1C1E]"
            >
              <ImageIcon size={15} />
            </button>
            <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </div>
        </div>
      )}

      {/* ── EDITOR CONTENT / PREVIEW ── */}
      <div className="flex-1 overflow-y-auto relative p-5">
        {isPreview ? (
          <div
            className="prose prose-sm max-w-none text-[15px] leading-relaxed"
            dangerouslySetInnerHTML={safeHTML(htmlContent || '<p className="text-black/40 italic">Nothing to preview yet.</p>')}
          />
        ) : (
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={updateStats}
            onKeyUp={updateStats}
            data-placeholder={placeholder}
            className="native-rich-editor outline-none min-h-[220px] text-[15px] leading-relaxed text-[#1C1C1E]"
          />
        )}
      </div>

      {/* ── FOOTER ── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-t border-black/8 bg-white/95 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className={`text-[11px] font-mono ${isOverLimit ? 'text-orange-500 font-bold' : 'text-black/30'}`}>
            {charCount}/{maxChars}
          </span>
          <span className="text-[11px] text-black/25">{wordCount} words</span>
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-[13px] font-bold text-black/50 hover:bg-black/5 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing || (charCount === 0 && !postTitle.trim())}
            className="flex items-center gap-2 px-5 py-2 bg-[#1C1C1E] hover:bg-black text-white text-[13px] font-bold rounded-xl transition-all shadow-lg shadow-black/15 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          >
            {publishing ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send size={14} />
            )}
            Publish
          </button>
        </div>
      </div>

      {/* ── NATIVE RICH EDITOR STYLES ── */}
      <style>{`
        .native-rich-editor:empty:before {
          content: attr(data-placeholder);
          color: rgba(28,28,30,0.3);
          pointer-events: none;
          display: block;
        }
        .native-rich-editor h1 { font-size: 24px; font-weight: 800; margin: 14px 0 8px; }
        .native-rich-editor h2 { font-size: 20px; font-weight: 700; margin: 12px 0 6px; }
        .native-rich-editor h3 { font-size: 17px; font-weight: 700; margin: 10px 0 4px; }
        .native-rich-editor p { margin: 0 0 6px; }
        .native-rich-editor ul { list-style-type: disc; padding-left: 24px; margin: 6px 0; }
        .native-rich-editor ol { list-style-type: decimal; padding-left: 24px; margin: 6px 0; }
        .native-rich-editor li { margin: 2px 0; }
        .native-rich-editor blockquote { border-left: 3px solid #1C1C1E; padding-left: 14px; margin: 8px 0; opacity: 0.75; font-style: italic; }
        .native-rich-editor code { background: rgba(28,28,30,0.08); border-radius: 4px; padding: 1px 5px; font-size: 13px; font-family: monospace; }
        .native-rich-editor pre { background: #1C1C1E; color: #FFF; border-radius: 10px; padding: 12px 16px; margin: 8px 0; overflow-x: auto; }
        .native-rich-editor hr { border: none; border-top: 1px solid rgba(28,28,30,0.1); margin: 14px 0; }
        .native-rich-editor a { color: #2563EB; text-decoration: underline; }
      `}</style>
    </div>
  );
}

// ─── MODAL WRAPPER ───────────────────────────────────────────────────────────

export function RichPostEditorModal({
  postToEdit,
  open,
  onClose,
  communityName,
  communityId,
  myAddress,
  onPublished,
}: {
  open: boolean;
  onClose: () => void;
  communityName?: string;
  communityId?: string;
  myAddress: string;
  postToEdit?: any;
  onPublished?: (post: any) => void;
}) {
  const handlePublish = async (content: { html: string; text: string; json: any; title?: string }) => {
    try {
      if (!communityId) {
        toast.error('No community selected');
        return;
      }
      if (!myAddress || myAddress.trim() === '') {
        toast.error('Wallet not connected — cannot publish post');
        return;
      }

      const postTitle = (content.title || '').trim() || 'Community Post';

      const res = await fetch(`/api/chat/communities/${communityId}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-web3-address': myAddress.toLowerCase(),
          'x-verified-session-address': myAddress.toLowerCase(),
        },
        body: JSON.stringify({
          communityId,
          authorAddress: myAddress.toLowerCase(),
          title: postTitle,
          content: content.html || content.text,
          contentHtml: content.html,
          plainText: content.text,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.error || 'Failed to publish post');
        return;
      }

      const data = await res.json().catch(() => ({}));
      toast.success('Post published!');
      onPublished?.(data.post || null);
      onClose();
    } catch (e) {
      console.error('[RichPostEditorModal] Publish failed:', e);
      toast.error('Network error. Please try again.');
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9990] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Editor panel */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 360, damping: 38 }}
        className="fixed bottom-0 left-0 right-0 z-[9991] w-full h-[90vh] rounded-t-[32px] overflow-hidden shadow-2xl"
      >
        <RichPostEditor
          title={communityName ? `Post in ${communityName}` : 'New Post'}
          communityName={communityName}
          initialContent={postToEdit?.contentHtml || postToEdit?.content || ''}
          onPublish={handlePublish}
          onClose={onClose}
        />
      </motion.div>
    </>
  );
}
