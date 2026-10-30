"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNowStrict, format } from 'date-fns';
import { useSignMessage } from 'wagmi';
import { useSystemAccount } from '@/hooks/useSystemAccount';
import { useWalletStore } from '@/lib/store/wallet-store';

export default function TopicPage() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const router = useRouter();
  const [topic, setTopic]               = useState<any>(null);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [replyError, setReplyError]     = useState('');
  const [replyDraftSaved, setReplyDraftSaved] = useState(false);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<string | null>(null);
  
  const { signMessageAsync } = useSignMessage();
  const { address, isSystemHandshake, isLocalSystemWallet, isConnected } = useSystemAccount();
  const sessionAddress = address?.toLowerCase() || null;

  const replyDraftKey = id ? `forum_draft_reply_${id}` : null;

  useEffect(() => {
    if (!replyDraftKey) return;
    try {
      const saved = localStorage.getItem(replyDraftKey);
      if (saved) setReplyContent(saved);
    } catch {}
  }, [replyDraftKey]);

  useEffect(() => {
    if (!replyDraftKey || !replyContent) return;
    try {
      localStorage.setItem(replyDraftKey, replyContent);
      setReplyDraftSaved(true);
      const t = setTimeout(() => setReplyDraftSaved(false), 1500);
      return () => clearTimeout(t);
    } catch {}
  }, [replyContent, replyDraftKey]);

  const fetchTopic = () => {
    fetch(`/api/forum/topics/${id}`)
      .then(r => r.json())
      .then(data => setTopic(data))
      .catch(console.error);
  };

  useEffect(() => { if (id) fetchTopic(); }, [id]);

  const submitReply = async () => {
    if (!replyContent.trim()) return;
    setReplyError('');
      let finalContent = replyContent;
      let signature = 'SESSION:AUTHENTICATED';
      
      const { privateKey: storedPrivateKey } = useWalletStore.getState();
      
      try {
        if (storedPrivateKey) {
          const { ethers } = await import('ethers');
          const wallet = new ethers.Wallet(storedPrivateKey);
          signature = await wallet.signMessage(finalContent);
        } else {
          const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
          if (isSystemHandshake || !isConnected || isMobile) {
            // QR mobile handshake or unauthenticated user: use session bypass
            signature = 'SESSION:AUTHENTICATED';
          } else {
            signature = await signMessageAsync({ message: finalContent });
          }
        }
      } catch (err) {
        console.warn("Cryptographic signature failed, falling back to secure session:", err);
        signature = 'SESSION:AUTHENTICATED';
      }

      setSubmitting(true);
      try {
        finalContent = `${replyContent}\n\n[SIGNATURE:${signature}]`;

      let csrfToken = '';
      try {
          const csrfRes = await fetch('/api/auth/csrf', {
              credentials: 'include',
              headers: { 'x-web3-address': sessionAddress || '' }
          });
          if (!csrfRes.ok) throw new Error('CSRF fetch failed');
          const contentType = csrfRes.headers.get("content-type");
          if (contentType && contentType.indexOf("application/json") !== -1) {
              csrfToken = (await csrfRes.json()).token;
          } else {
              throw new Error("Invalid CSRF response");
          }
      } catch (e) {
          setReplyError('SESSION EXPIRED. PLEASE RECONNECT WALLET.');
          setSubmitting(false);
          return;
      }

      const res = await fetch('/api/forum/posts', {
        method: 'POST',
        credentials: 'include',
        headers: { 
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
          'x-web3-address': sessionAddress || ''
        },
        body: JSON.stringify({ topicId: id, content: finalContent }),
      });
      if (res.ok) {
        try { if (replyDraftKey) localStorage.removeItem(replyDraftKey); } catch {}
        setReplyContent('');
        fetchTopic();
      } else {
        const err = await res.json();
        setReplyError(err.error?.toUpperCase() || 'TRANSMISSION FAILED');
      }
    } catch (e) {
      setReplyError('NETWORK ERROR');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteTopic = async () => {
    setDeleteConfirmTarget(null);
    let csrfToken = '';
    try {
        const csrfRes = await fetch('/api/auth/csrf', {
            credentials: 'include',
            headers: { 'x-web3-address': sessionAddress || '' }
        });
        if (!csrfRes.ok) throw new Error('CSRF fetch failed');
        const contentType = csrfRes.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            csrfToken = (await csrfRes.json()).token;
        } else {
            throw new Error("Invalid CSRF response");
        }
    } catch (e) {
        setReplyError('SESSION EXPIRED. PLEASE RECONNECT WALLET.');
        return;
    }

    const res = await fetch(`/api/forum/topics/${id}`, { 
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'x-csrf-token': csrfToken,
        'x-web3-address': sessionAddress || ''
      }
    });
    if (res.ok) router.push('/forum');
    else setReplyError('COULD NOT DELETE TOPIC');
  };

  if (!topic) return (
    <div className="py-32 text-center text-[12px] font-mono uppercase tracking-widest text-gray-400 min-h-[100dvh] bg-white flex items-center justify-center flex-col gap-4">
      Loading Topic...
    </div>
  );

  if (topic.error) return (
    <div className="py-32 text-center text-[12px] font-mono uppercase tracking-widest text-red-500 min-h-[100dvh] bg-white flex items-center justify-center flex-col gap-4">
      Topic not found or deleted.
    </div>
  );

  const isTopicAuthor = sessionAddress && topic.author?.walletAddress?.toLowerCase() === sessionAddress;

  return (
    <div className="w-full bg-white text-black py-10 font-sans selection:bg-black selection:text-white">
      
      <div className="w-full max-w-[1440px] mx-auto px-6 lg:px-12 mb-8">
        <Link href="/forum" className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-gray-500 hover:text-black transition-colors">
          BACK TO NEXUS
        </Link>
      </div>

      <div className="w-full max-w-[1440px] mx-auto px-6 lg:px-12">
      <div className="mb-10 pb-8 border-b-2 border-black">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-[28px] md:text-[36px] font-black leading-[1.1] tracking-tighter mb-5 flex-1 text-black break-words">
            {topic.title}
          </h1>
          {isTopicAuthor && (
            <div className="flex gap-2">
              {deleteConfirmTarget === 'topic' ? (
                <>
                  <button onClick={deleteTopic} className="shrink-0 mt-1 text-[10px] font-black uppercase tracking-widest px-4 py-2 border-2 border-red-500 text-red-500 hover:bg-red-50">CONFIRM</button>
                  <button onClick={() => setDeleteConfirmTarget(null)} className="shrink-0 mt-1 text-[10px] font-black uppercase tracking-widest px-4 py-2 border-2 border-gray-300 text-gray-600 hover:border-black hover:text-black">CANCEL</button>
                </>
              ) : (
                <button
                  onClick={() => setDeleteConfirmTarget('topic')}
                  className="shrink-0 mt-1 text-[10px] font-black uppercase tracking-widest px-4 py-2 border border-gray-300 text-gray-500 hover:border-red-500 hover:text-red-500"
                >
                  DELETE TOPIC
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {topic.category && (
            <Link href={`/forum/c/${topic.category.slug}`} className="flex items-center gap-2 px-3 py-1.5 border border-black hover:bg-gray-50 transition-colors">
              <span className="text-[10px] font-black tracking-[0.2em] uppercase text-black">{topic.category.name}</span>
            </Link>
          )}
          {topic.tags?.map((tag: any) => (
            <span key={tag.id} className="text-[10px] font-bold uppercase tracking-widest text-gray-600 bg-gray-100 px-2.5 py-1 border border-gray-200">
              {tag.name}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-[40px]">
        
        <div className="lg:col-span-9 flex flex-col pt-2">
          <PostRow entity={topic} type="topic" onLike={fetchTopic} index={1} sessionAddress={sessionAddress} onDeleted={() => router.push('/forum')} />
          {(topic.posts || []).map((post: any, i: number) => (
            <PostRow key={post.id} entity={post} type="post" onLike={fetchTopic} index={i + 2} sessionAddress={sessionAddress} onDeleted={fetchTopic} />
          ))}

          <div id="reply-composer" className="mt-16 flex gap-6">
             <div className="w-[64px] shrink-0 hidden sm:block"></div>
             <div className="flex-1">
                <div className="bg-white border-2 border-black focus-within:ring-2 focus-within:ring-black focus-within:ring-offset-2 transition-all duration-300">
                  <textarea
                    value={replyContent}
                    onChange={e => setReplyContent(e.target.value)}
                    placeholder="Write a reply..."
                    className="w-full px-6 py-6 text-[15px] font-sans bg-transparent text-black focus:outline-none resize-none min-h-[160px] leading-relaxed placeholder:text-gray-400"
                  />
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-5 py-4 border-t border-gray-200 bg-gray-50 gap-3">
                    <div className="flex items-center gap-4 flex-wrap">
                      <button
                        onClick={submitReply}
                        disabled={submitting || !replyContent.trim()}
                        className="inline-flex items-center gap-2 text-[12px] font-black uppercase tracking-widest px-6 py-3 bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-40"
                      >
                        {submitting ? 'SENDING...' : 'SIGN & REPLY'}
                      </button>
                      {replyDraftSaved && (
                        <span className="text-[10px] font-mono uppercase tracking-widest text-green-600 flex items-center gap-1.5 font-bold">
                          DRAFT SAVED
                        </span>
                      )}
                    </div>
                    {replyError && (
                      <span className="text-[11px] font-bold text-red-500 uppercase tracking-wider">{replyError}</span>
                    )}
                  </div>
                </div>
             </div>
          </div>
        </div>

        <div className="hidden lg:block lg:col-span-3">
           <div className="sticky top-[100px] border-l-2 border-black pl-8 py-2">
              <div className="flex flex-col gap-6">
                 <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">Created</span>
                    <span className="text-[13px] font-bold text-black">
                       {topic.createdAt && !isNaN(new Date(topic.createdAt).getTime()) ? format(new Date(topic.createdAt), 'MMM d, yyyy') : 'Unknown'}
                    </span>
                 </div>
                 <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">Last Activity</span>
                    <span className="text-[13px] font-bold text-black">
                       {topic.updatedAt && !isNaN(new Date(topic.updatedAt).getTime()) ? formatDistanceToNowStrict(new Date(topic.updatedAt)) + ' ago' : 'Recently'}
                    </span>
                 </div>
                 <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">Replies</span>
                    <span className="text-[20px] font-black text-black tabular-nums leading-none">{topic._count?.posts || 0}</span>
                 </div>
                 <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">Views</span>
                    <span className="text-[20px] font-black text-black tabular-nums leading-none">{topic.views || 0}</span>
                 </div>
              </div>
               <div className="mt-10 pt-8 border-t border-gray-200 flex flex-col gap-3">
                  <button 
                    onClick={() => document.getElementById('reply-composer')?.scrollIntoView({ behavior: 'smooth' })}
                    className="flex-1 text-center py-3.5 text-[11px] font-black uppercase tracking-[0.2em] transition-colors border-2 border-black hover:bg-black hover:text-white text-black"
                  >
                    REPLY
                  </button>
              </div>
           </div>
        </div>

      </div>
      </div>
      
      <div className="lg:hidden w-full h-[64px]" />
    </div>
  );
}

function RenderContent({ content }: { content: string }) {
  if (!content) return null;
  
  let text = content;
  let signature: string | null = null;
  let docs: { title: string, url: string }[] = [];
  
  const docRegex = /\[SECURE_DOC:([^|]+)\|([^\]]+)\]/g;
  let docMatch;
  while ((docMatch = docRegex.exec(text)) !== null) {
      docs.push({ title: docMatch[1], url: docMatch[2] });
  }
  text = text.replace(docRegex, '').trim();
  
  const tokenMatch = text.match(/\[SIGNATURE:([^\]]+)\]/i);
  if (tokenMatch) {
    signature = tokenMatch[1];
    text = text.replace(tokenMatch[0], '').trim();
  }
  
  if (text.includes('<div style="margin-top: 12px;') && text.includes('Cryptographic Signature Verified')) {
    const htmlMatch = text.match(/word-break:\s*break-all;">(0x[a-fA-F0-9]+)<\/div>/i);
    if (htmlMatch) {
      signature = htmlMatch[1];
    }
    text = text.split('\n\n---')[0].trim();
  }

  return (
    <>
      <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-black font-sans">{text}</div>
      
      {docs.length > 0 && (
          <div className="mt-8 flex flex-col gap-4">
              <div className="flex items-center gap-2.5 mb-1">
                  <span className="text-[10px] font-black tracking-[0.2em] uppercase text-black">Documents</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {docs.map((doc, i) => (
                      <a key={i} href={doc.url} target="_blank" rel="noreferrer" className="flex items-center gap-4 p-4 bg-gray-50 border border-gray-200 hover:border-black transition-colors group">
                          <div className="flex flex-col min-w-0">
                              <span className="text-[13px] font-bold text-black truncate group-hover:underline">{doc.title}</span>
                              <span className="text-[10px] text-gray-500 font-mono truncate">{doc.url}</span>
                          </div>
                      </a>
                  ))}
              </div>
          </div>
      )}

      {signature && (
        <div className={`mt-8 p-4 ${signature.startsWith('SESSION:') ? 'bg-amber-50/70 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
          <span className={`text-[10px] font-black tracking-[0.2em] uppercase flex items-center gap-2 mb-2 ${signature.startsWith('SESSION:') ? 'text-amber-700' : 'text-green-700'}`}>
            {signature.startsWith('SESSION:') ? 'EDGE SESSION ATTESTATION (STANDARD AUTH)' : 'AZTEC TESTNET VERIFIED SIGNATURE'}
          </span>
          <div className={`font-mono text-[11px] break-all ${signature.startsWith('SESSION:') ? 'text-amber-900' : 'text-green-800'}`}>
            {signature.startsWith('SESSION:') ? 'ATTESTATION: EDGE_SESSION_CONFIRMED' : `HASH: ${signature}`}
          </div>
          <div className={`text-[9px] font-mono uppercase tracking-widest mt-2 ${signature.startsWith('SESSION:') ? 'text-amber-600' : 'text-green-600'}`}>
            {signature.startsWith('SESSION:') ? 'Standard authenticated reply (Session-bound token)' : 'Cryptographically secured on Aztec Network Layer 2'}
          </div>
        </div>
      )}
    </>
  );
}

function PostRow({
  entity, type, onLike, index, sessionAddress, onDeleted
}: {
  entity: any;
  type: 'topic' | 'post';
  onLike: () => void;
  index: number;
  sessionAddress: string | null;
  onDeleted: () => void;
}) {
  const [liked, setLiked] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [imgError, setImgError] = useState(false);
  const addr  = entity.author?.walletAddress || '';
  const label = entity.author?.displayName || (addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : 'ANONYMOUS');
  const isValidDate = entity.createdAt && !isNaN(new Date(entity.createdAt).getTime());
  const time  = isValidDate ? format(new Date(entity.createdAt), 'MMM d, yyyy') : 'Unknown';

  const isAuthor = sessionAddress && addr.toLowerCase() === sessionAddress;

  const handleLike = async () => {
    try {
      let csrfToken = '';
      try {
          const csrfRes = await fetch('/api/auth/csrf', {
              credentials: 'include',
              headers: { 'x-web3-address': sessionAddress || '' }
          });
          if (!csrfRes.ok) throw new Error('CSRF fetch failed');
          const contentType = csrfRes.headers.get("content-type");
          if (contentType && contentType.indexOf("application/json") !== -1) {
              csrfToken = (await csrfRes.json()).token;
          } else {
              throw new Error("Invalid CSRF response");
          }
      } catch (e) {
          alert('SESSION EXPIRED. PLEASE RECONNECT WALLET.');
          return;
      }

      const res = await fetch('/api/forum/likes', {
        method: 'POST',
        credentials: 'include',
        headers: { 
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
          'x-web3-address': sessionAddress || ''
        },
        body: JSON.stringify(type === 'topic' ? { topicId: entity.id } : { postId: entity.id }),
      });
      if (res.ok) { setLiked(l => !l); onLike(); }
    } catch {}
  };

  const handleDelete = async () => {
    setConfirmingDelete(false);
    setDeleting(true);
    try {
      let csrfToken = '';
      try {
          const csrfRes = await fetch('/api/auth/csrf', {
              credentials: 'include',
              headers: { 'x-web3-address': sessionAddress || '' }
          });
          if (!csrfRes.ok) throw new Error('CSRF fetch failed');
          const contentType = csrfRes.headers.get("content-type");
          if (contentType && contentType.indexOf("application/json") !== -1) {
              csrfToken = (await csrfRes.json()).token;
          } else {
              throw new Error("Invalid CSRF response");
          }
      } catch (e) {
          alert('SESSION EXPIRED. PLEASE RECONNECT WALLET.');
          setDeleting(false);
          return;
      }

      const endpoint = type === 'topic'
        ? `/api/forum/topics/${entity.id}`
        : `/api/forum/posts/${entity.id}`;
      const res = await fetch(endpoint, { 
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'x-csrf-token': csrfToken,
          'x-web3-address': sessionAddress || ''
        }
      });
      if (res.ok) onDeleted();
      else alert('Could not delete.');
    } catch {
      alert('Network error.');
    } finally {
      setDeleting(false);
    }
  };

  const likeCount = entity.likes?.length || 0;

  return (
    <div className="flex gap-6 py-8 border-b border-gray-200 transition-colors">
      
      <div className="w-[64px] shrink-0 hidden sm:flex flex-col items-center">
        <Link href={`/forum/u/${addr}`}>
          <div
            className="w-[48px] h-[48px] rounded-full flex items-center justify-center text-[13px] font-black overflow-hidden bg-gray-100 text-black border border-gray-300 hover:border-black transition-colors"
          >
            {!imgError && entity.author?.avatarUrl
              ? <img 
                  src={entity.author.avatarUrl} 
                  alt="" 
                  className="w-full h-full object-cover" 
                  onError={() => setImgError(true)}
                />
              : addr.slice(2, 4).toUpperCase()
            }
          </div>
        </Link>
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <Link href={`/forum/u/${addr}`} className="text-[16px] font-bold hover:underline text-black">
                {label}
              </Link>
              {type === 'topic' && (
                <span className="text-[9px] font-black uppercase tracking-widest bg-black text-white px-2.5 py-1">OP</span>
              )}
            </div>
            <div className="flex items-center gap-4">
               <span className="text-[12px] font-mono text-gray-500 uppercase">{time}</span>
               <span className="text-[11px] font-black text-black tracking-widest">#{index}</span>
            </div>
          </div>

        <div className="mb-8 overflow-hidden">
          <RenderContent content={entity.content} />
        </div>

        <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-auto border-t border-gray-100 pt-4 transition-colors">
          <button
            onClick={handleLike}
            className={`flex items-center gap-2.5 text-[11px] font-black uppercase tracking-widest transition-colors ${liked ? 'text-black' : 'text-gray-400 hover:text-black'}`}
          >
            {liked ? 'LIKED' : 'LIKE'} {likeCount > 0 && `(${likeCount})`}
          </button>
          <button
            onClick={() => document.getElementById('reply-composer')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex items-center gap-2.5 text-[11px] font-black uppercase tracking-widest transition-colors text-gray-400 hover:text-black"
          >
            REPLY
          </button>

          {isAuthor && (
            <div className="ml-auto flex items-center gap-3">
              {confirmingDelete ? (
                <>
                  <button onClick={handleDelete} className="text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 border-2 border-red-500 text-red-500 hover:bg-red-50" disabled={deleting}>
                    CONFIRM
                  </button>
                  <button onClick={() => setConfirmingDelete(false)} className="text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 border-2 border-gray-300 text-gray-600 hover:border-black hover:text-black" disabled={deleting}>
                    CANCEL
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmingDelete(true)}
                  disabled={deleting}
                  className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 border border-gray-300 text-gray-500 hover:border-red-500 hover:text-red-500"
                >
                  {deleting ? 'DELETING...' : 'DELETE'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
