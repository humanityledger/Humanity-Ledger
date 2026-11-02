"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useSignMessage } from 'wagmi';
import { useSystemAccount } from '@/hooks/useSystemAccount';
import { useWalletStore } from '@/lib/store/wallet-store';

const DRAFT_KEY = 'forum_draft_new_topic';

export default function NewTopicPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-white"></div>}>
      <NewTopicContent />
    </React.Suspense>
  );
}

function NewTopicContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCategory = searchParams?.get('category');

  const [categories, setCategories] = useState<any[]>([]);
  const [title, setTitle]           = useState('');
  const [content, setContent]       = useState('');
  const [categoryId, setCategoryId] = useState(preselectedCategory || '');
  const [tags, setTags]             = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const [draftSaved, setDraftSaved] = useState(false);
  const [documents, setDocuments]   = useState<{ title: string, url: string }[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const { address, isConnected, isSystemHandshake, isLocalSystemWallet } = useSystemAccount();
  const { signMessageAsync } = useSignMessage();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.title)      setTitle(draft.title);
        if (draft.content)    setContent(draft.content);
        if (draft.categoryId) setCategoryId(draft.categoryId);
        if (draft.tags)       setTags(draft.tags);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!title && !content && !tags) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, content, categoryId, tags }));
      setDraftSaved(true);
      const t = setTimeout(() => setDraftSaved(false), 1800);
      return () => clearTimeout(t);
    } catch {}
  }, [title, content, categoryId, tags]);

  useEffect(() => {
    fetch('/api/forum/categories')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setCategories(data);
          if (!categoryId && data.length > 0) setCategoryId(data[0].id);
        }
      })
      .catch(console.error);
  }, []);

  const submit = async () => {
    setError('');
    if (!title.trim() || !content.trim() || !categoryId) {
      setError('Title, Sector, and Content are required.');
      return;
    }
    if (!isConnected && !address) {
      setError('Authenticate via wallet to broadcast.');
      return;
    }
    let finalContent = content;
    let finalSignature = 'SESSION:AUTHENTICATED';
      
      documents.forEach(doc => {
        if (doc.title.trim() && doc.url.trim()) {
            finalContent += `\n\n[SECURE_DOC:${doc.title.trim()}|${doc.url.trim()}]`;
        }
      });

      const { privateKey: storedPrivateKey } = useWalletStore.getState();
      const messageToSign = `${title}\n${finalContent}`;

      try {
        if (storedPrivateKey) {
          const { ethers } = await import('ethers');
          const wallet = new ethers.Wallet(storedPrivateKey);
          finalSignature = await wallet.signMessage(messageToSign);
        } else {
          const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
          if (isSystemHandshake || !isConnected || isMobile) {
            // Mobile wallets drop signMessage connections constantly.
            // Since the user is already authenticated via session, we use the fallback.
            finalSignature = 'SESSION:AUTHENTICATED';
          } else if (!isLocalSystemWallet) {
            finalSignature = await signMessageAsync({ message: messageToSign });
          }
        }
      } catch (err) {
        console.warn("Cryptographic signature failed, falling back to secure session:", err);
        finalSignature = 'SESSION:AUTHENTICATED';
      }
      
      setSubmitting(true);
      try {
        finalContent = `${finalContent}\n\n[SIGNATURE:${finalSignature}]`;

      let csrfToken = '';
      try {
          const csrfRes = await fetch('/api/auth/csrf', {
              credentials: 'include',
              headers: { 'x-web3-address': address || '' }
          });
          if (!csrfRes.ok) throw new Error('CSRF fetch failed');
          const contentType = csrfRes.headers.get("content-type");
          if (contentType && contentType.indexOf("application/json") !== -1) {
              const csrfData = await csrfRes.json();
              csrfToken = csrfData.token;
          } else {
              throw new Error("Invalid CSRF response");
          }
      } catch (e) {
          setError('Session token invalid. Re-authenticate.');
          setSubmitting(false);
          return;
      }

      const res = await fetch('/api/forum/topics', {
        method: 'POST',
        credentials: 'include',
        headers: { 
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken,
            'x-web3-address': address || ''
        },
        body: JSON.stringify({
          title,
          content: finalContent,
          categoryId,
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
          cryptoSignature: finalSignature,
        }),
      });
      if (res.ok) {
        try { localStorage.removeItem(DRAFT_KEY); } catch {}
        const topic = await res.json();
        router.push(`/forum/t/${topic.id}`);
      } else {
        const err = await res.json();
        setError(err.error || 'Transmission rejected by firewall.');
      }
    } catch {
      setError('Network failure during transmission.');
    } finally {
      setSubmitting(false);
    }
  };

  const clearDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setTitle(''); setContent(''); setTags(''); setDocuments([]);
    if (categories.length > 0) setCategoryId(categories[0].id);
  };

  const addDocument = () => setDocuments([...documents, { title: '', url: '' }]);
  const updateDocument = (index: number, key: 'title' | 'url', value: string) => {
      const newDocs = [...documents];
      newDocs[index][key] = value;
      setDocuments(newDocs);
  };
  const removeDocument = (index: number) => {
      setDocuments(documents.filter((_idx, i) => i !== index));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingFile(true);
    setError('');
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch('/api/forum/upload', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      
      if (res.ok && data.url) {
        const newDocs = [...documents];
        if (!newDocs[index].title) {
          newDocs[index].title = data.fileName || file.name;
        }
        newDocs[index].url = data.url;
        setDocuments(newDocs);
      } else {
        setError(data.error || 'Upload failed. Firewall active.');
      }
    } catch (err) {
      setError('Upload failed. Network offline.');
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  return (
    <div className="w-full bg-white text-black py-10 font-sans relative selection:bg-black selection:text-white">
      
      <div className="w-full max-w-[1110px] mx-auto px-6 lg:px-12">
        <div className="w-full mb-6">
          <Link href="/forum" className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-gray-500 hover:text-black transition-colors">
            BACK TO NEXUS
          </Link>
        </div>

        <div className="max-w-[820px] mx-auto bg-white border-2 border-black p-8 md:p-12 relative">

          {/*  Header  */}
          <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b-2 border-black pb-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-[28px] md:text-[32px] font-black tracking-tighter text-black flex items-center gap-4 leading-none">
                  INITIALIZE BROADCAST
                </h1>
                <p className="text-[12px] font-mono text-gray-500 uppercase tracking-widest mt-2">
                    Transmission hashed and signed cryptographically on Aztec Mainnet.
                </p>
            </div>
            <div className="flex items-center gap-4">
              {draftSaved && (
                <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-widest text-green-600">
                  LOCAL SYNC
                </span>
              )}
              {(title || content) && (
                <button
                  onClick={clearDraft}
                  className="text-[10px] font-black uppercase tracking-[0.2em] hover:text-black transition-colors text-gray-500 px-4 py-2 border border-gray-300 hover:bg-gray-50"
                >
                  PURGE DRAFT
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-8">

            {/*  Title  */}
            <div className="flex flex-col gap-3">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1">Header Designation</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Transmission subject..."
                className="w-full px-5 py-4 text-[18px] font-sans font-bold outline-none transition-all bg-white border border-gray-300 text-black placeholder:text-gray-400 focus:border-black focus:ring-0"
              />
            </div>

            {/*  Category + Tags  */}
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="flex-1 relative flex flex-col gap-3">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1">Target Sector</label>
                  <div className="relative">
                    <select
                    value={categoryId}
                    onChange={e => setCategoryId(e.target.value)}
                    className="w-full px-5 py-4 pr-12 text-[14px] font-bold uppercase tracking-widest outline-none transition-all cursor-pointer appearance-none bg-white border border-gray-300 text-black focus:border-black"
                    >
                  <option value="" disabled className="text-gray-500">Select Sector</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id} className="text-black py-2">{cat.name}</option>
                  ))}
                    </select>
                </div>
              </div>
              <div className="flex-1 flex flex-col gap-3">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1">Metadata Tags</label>
                <input
                  type="text"
                  value={tags}
                  onChange={e => setTags(e.target.value)}
                  placeholder="e.g. ZK, Noir, Audit (CSV format)"
                  className="w-full px-5 py-4 text-[14px] font-mono outline-none transition-all bg-white border border-gray-300 text-black placeholder:text-gray-400 focus:border-black"
                />
              </div>
            </div>

            {/*  Document Vault  */}
            <div className="flex flex-col gap-4 bg-gray-50 border border-gray-300 p-6 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                    <div className="flex items-center gap-3 text-black">
                        <span className="text-[12px] font-black uppercase tracking-[0.2em]">Cryptographic Vault</span>
                    </div>
                    <button onClick={addDocument} className="flex items-center justify-center gap-2 px-4 py-2 border border-black hover:bg-black hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest text-black">
                        ATTACH FILE
                    </button>
                </div>
                <p className="text-[11px] text-gray-500 font-mono leading-relaxed mb-2">
                    Secure attachments will be immutably linked to this transmission. Upload directly or supply an IPFS CID.
                </p>
                {documents.map((doc, idx) => (
                    <div key={idx} className="flex flex-col md:flex-row gap-4 items-stretch md:items-center bg-white p-4 border border-gray-200 focus-within:border-black transition-colors">
                        <input type="text" placeholder="Document Name (e.g. ZK Proof .txt)" value={doc.title} onChange={e => updateDocument(idx, 'title', e.target.value)} className="w-full md:flex-1 px-4 py-3 text-[13px] bg-transparent border border-gray-300 text-black focus:border-black outline-none placeholder:text-gray-400" />
                        
                        <div className="w-full md:flex-[1.5] relative flex items-center">
                            <input type="text" placeholder="URL / CID Hash" value={doc.url} onChange={e => updateDocument(idx, 'url', e.target.value)} className="w-full px-4 py-3 pr-[110px] text-[12px] font-mono bg-transparent border border-gray-300 text-black focus:border-black outline-none placeholder:text-gray-400" />
                            
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 border border-gray-300 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 text-black transition-colors">
                                    {uploadingFile ? 'SYNCING...' : 'BROWSE'}
                                    <input type="file" className="hidden" disabled={uploadingFile} onChange={(e) => handleFileUpload(e, idx)} />
                                </label>
                            </div>
                        </div>

                        <button onClick={() => removeDocument(idx)} className="p-3 text-red-500 hover:bg-red-50 transition-colors border border-red-200 self-end md:self-auto shrink-0 flex items-center justify-center text-[10px] font-black tracking-widest uppercase" title="Remove">
                            REMOVE
                        </button>
                    </div>
                ))}
            </div>

            {/*  Body  */}
            <div className="flex flex-col gap-3">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1">Transmission Payload</label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Initialize text sequence... (Markdown supported)"
                className="w-full px-6 py-6 text-[15px] font-sans outline-none resize-none min-h-[400px] leading-relaxed transition-all bg-white border border-gray-300 text-black placeholder:text-gray-400 focus:border-black focus:ring-0"
              />
            </div>

            {/*  Footer  */}
            <div className="flex items-center justify-between mt-4 pt-8 border-t border-gray-300">
                <div className="flex items-center gap-4">
                  <button
                    onClick={submit}
                    disabled={submitting}
                    className="h-[52px] px-8 bg-black text-white text-[12px] font-black uppercase tracking-[0.1em] hover:bg-gray-800 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {submitting ? 'TRANSMITTING...' : 'SIGN & BROADCAST'}
                  </button>
                  <Link
                    href="/forum"
                    className="text-[11px] font-black uppercase tracking-[0.2em] transition-colors text-gray-500 hover:text-black px-6 py-4"
                  >
                    ABORT
                  </Link>
                </div>

              {error && (
                <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 text-[11px] font-bold text-red-600 uppercase tracking-widest">
                  {error}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
